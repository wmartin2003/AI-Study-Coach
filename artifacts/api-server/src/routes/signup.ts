import { Router, type IRouter } from "express";
import { SignupBody, SignupResponse, GetSignupConfigResponse } from "@workspace/api-zod";
import { supabaseAdmin } from "../lib/supabase";
import { createIpRateLimit } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Signup is now fully public with no account ceiling behind it — the only
// thing standing between this URL and a script hammering it is this limit,
// so it's deliberately tighter than aiRateLimit's 20/min or the 5/min this
// used to be.
const signupRateLimit = createIpRateLimit({
  windowMs: 300_000,
  maxRequests: 3,
  message: "Too many attempts. Please wait a few minutes and try again.",
});

const GENERIC_INVITE_ERROR = "That invite code isn't valid or has already been used.";
const GENERIC_CREATE_ERROR = "Something went wrong creating your account. Please try again.";

// Invite-only stays one env var away — flip this back to true for the real
// beta (January) without touching any code. invite_codes, redeem_invite_code,
// and the whole redemption path are left fully intact either way.
function requiresInviteCode(): boolean {
  return process.env["SIGNUP_REQUIRE_INVITE"] === "true";
}

/**
 * Lets the frontend ask the API — rather than duplicating env vars across
 * two separately-deployed hosts (Vercel for the frontend, a different host
 * for this API) and risking them disagreeing about whether signup is open.
 * `open` is always true now — the account ceiling (MAX_ACCOUNTS) is gone —
 * but the field stays so a future cap (or a maintenance pause) doesn't need
 * a new field and a new frontend release to use.
 */
router.get("/signup/config", (_req, res) => {
  return res.json(
    GetSignupConfigResponse.parse({
      open: true,
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
 * There is no account ceiling here anymore — signup is open to anyone with
 * the URL. What keeps that from becoming open-ended AI spend is entirely
 * downstream, in lib/usage.ts: USER_MONTHLY_BUDGET_USD (per-student) and
 * ai_service_state.monthly_budget_usd (global) are unchanged by this and
 * are the only ceilings left. Whether an invite code is required at all is
 * controlled entirely by SIGNUP_REQUIRE_INVITE (see requiresInviteCode above).
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

  // Deliberate: email_confirm is true, not false. The Supabase project has
  // "Confirm email" turned on, and admin.createUser never sends a
  // confirmation email itself (unlike the client-side signUp flow) — so
  // `false` here created an account that could never sign in, ever, with no
  // error the student could act on beyond "Email not confirmed". This app
  // does not verify email addresses at 1.0. If that changes, the fix is
  // generating and sending a real confirmation link (supabaseAdmin.auth.
  // admin.generateLink({ type: "signup", ... })), not flipping this back —
  // flipping it back reintroduces this exact dead end.
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
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
