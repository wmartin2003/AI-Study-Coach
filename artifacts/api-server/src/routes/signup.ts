import { Router, type IRouter } from "express";
import { SignupBody, SignupResponse, GetSignupConfigResponse } from "@workspace/api-zod";
import { supabaseAdmin } from "../lib/supabase";
import { createIpRateLimit } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Tighter than aiRateLimit's 20/min — this is a public, unauthenticated
// endpoint, so it's the first thing a script would hammer to try to burn
// through invite codes or spam account creation.
const signupRateLimit = createIpRateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  message: "Too many attempts. Please wait a moment and try again.",
});

const GENERIC_INVITE_ERROR = "That invite code isn't valid or has already been used.";
const CLOSED_MESSAGE = "Sign-ups are closed for now — join the waitlist and I'll open a spot.";
const GENERIC_CREATE_ERROR = "Something went wrong creating your account. Please try again.";

// Invite-only stays one env var away — flip this back to true for the real
// beta (January) without touching any code. invite_codes, redeem_invite_code,
// and the whole redemption path are left fully intact either way.
function requiresInviteCode(): boolean {
  return process.env["SIGNUP_REQUIRE_INVITE"] === "true";
}

function maxAccounts(): number {
  const raw = Number(process.env["MAX_ACCOUNTS"] ?? 40);
  return Number.isFinite(raw) && raw > 0 ? raw : 40;
}

async function countAccounts(): Promise<number | null> {
  const { count, error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
  if (error) {
    logger.error({ err: error }, "Failed to read account count");
    return null;
  }
  return count ?? 0;
}

/**
 * Lets the frontend ask the API — rather than duplicating env vars across
 * two separately-deployed hosts (Vercel for the frontend, a different host
 * for this API) and risking them disagreeing about whether signup is open.
 */
router.get("/signup/config", async (_req, res) => {
  const count = await countAccounts();
  if (count === null) return res.status(500).json({ error: "Something went wrong. Please try again." });

  return res.json(
    GetSignupConfigResponse.parse({
      open: count < maxAccounts(),
      requiresInviteCode: requiresInviteCode(),
    }),
  );
});

/**
 * Creates a new account. This is the *only* way an account can be created —
 * public signup is turned off in the Supabase dashboard, so a client calling
 * `supabase.auth.signUp` directly gets rejected there. An invite code check
 * anywhere else (this route included, if it just gated a call to the client
 * SDK) would be bypassable, since the anon key ships in the browser bundle —
 * so this route creates the user itself via supabaseAdmin.auth.admin, which
 * requires the service-role key the browser never sees.
 *
 * Whether an invite code is actually required is controlled entirely by
 * SIGNUP_REQUIRE_INVITE (see requiresInviteCode above); when it's off, a
 * MAX_ACCOUNTS ceiling is what keeps "open to anyone with the URL" from
 * becoming "open-ended AI spend."
 */
router.post("/signup", signupRateLimit, async (req, res) => {
  const input = SignupBody.parse(req.body);
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const requireInvite = requiresInviteCode();
  // When invite codes aren't required, ignore anything sent for this field —
  // it was never validated, so it must never be trusted or stored.
  const inviteCode = requireInvite ? (input.inviteCode ?? "").trim() : "";

  if (!email || !input.password || !firstName || !lastName) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (requireInvite && !inviteCode) {
    return res.status(400).json({ error: "An invite code is required." });
  }

  // A small race is acceptable here (per design) — this is a simple count,
  // not a lock, so a burst of concurrent signups right at the cap could let
  // a few extra accounts through. Logged so it's visible, not guarded.
  const count = await countAccounts();
  if (count === null) return res.status(500).json({ error: "Something went wrong. Please try again." });
  if (count >= maxAccounts()) {
    logger.warn({ count, maxAccounts: maxAccounts() }, "Signup rejected: account cap reached");
    return res.status(503).json({ error: CLOSED_MESSAGE });
  }

  let redeemedCode: string | null = null;
  if (requireInvite) {
    // Claims a use atomically in the database (see redeem_invite_code in
    // supabase/migrations/0007_usage_and_invites.sql, locked down to
    // service_role in 0009_lock_down_functions.sql) so two people redeeming
    // the last use of the same code at the same moment can't both succeed.
    const { data: redeemed, error: redeemError } = await supabaseAdmin.rpc("redeem_invite_code", { code: inviteCode });
    if (redeemError) {
      logger.error({ err: redeemError }, "Invite code redemption query failed");
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
    if (!redeemed) {
      // Never reveal whether the code was invalid, expired, already used up,
      // or (separately) whether the email is already registered — one
      // generic message for every failure mode in this flow.
      return res.status(403).json({ error: GENERIC_INVITE_ERROR });
    }
    redeemedCode = redeemed;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: false,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (createError || !created.user) {
    // If a code was claimed above, give the use back so a genuine failure
    // here (duplicate email, Supabase hiccup, ...) doesn't burn a
    // limited-use invite for nothing.
    if (redeemedCode) await releaseInviteCode(redeemedCode);
    logger.error({ err: createError }, "Account creation failed" + (redeemedCode ? " after invite code was redeemed" : ""));
    // Generic on purpose — never reveals whether the email was already
    // registered.
    return res.status(500).json({ error: GENERIC_CREATE_ERROR });
  }

  // The handle_new_user trigger (supabase/migrations/0003) already created
  // the profile + user_stats rows — just record which code this account
  // used, when one was involved.
  if (redeemedCode) {
    await supabaseAdmin.from("profiles").update({ invite_code: redeemedCode }).eq("id", created.user.id);
  }

  return res.status(201).json(SignupResponse.parse({ ok: true }));
});

async function releaseInviteCode(code: string): Promise<void> {
  // A single atomic SQL statement (supabase/migrations/0009_lock_down_functions.sql)
  // rather than a select-then-update from here — the same reasoning as
  // redeem_invite_code: two concurrent failed signups reading the same
  // used_count and both writing back count - 1 would give back only one use
  // instead of two.
  const { error } = await supabaseAdmin.rpc("release_invite_code", { code });
  if (error) logger.error({ err: error, code }, "Failed to release invite code after failed signup");
}

export default router;
