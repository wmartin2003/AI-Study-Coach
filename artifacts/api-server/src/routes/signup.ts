import { Router, type IRouter } from "express";
import { SignupBody, SignupResponse } from "@workspace/api-zod";
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

const GENERIC_ERROR = "That invite code isn't valid or has already been used.";

/**
 * Creates a new account. This is the *only* way an account can be created —
 * public signup is turned off in the Supabase dashboard, so a client calling
 * `supabase.auth.signUp` directly gets rejected there. An invite code check
 * anywhere else (this route included, if it just gated a call to the client
 * SDK) would be bypassable, since the anon key ships in the browser bundle —
 * so this route creates the user itself via supabaseAdmin.auth.admin, which
 * requires the service-role key the browser never sees.
 */
router.post("/signup", signupRateLimit, async (req, res) => {
  const input = SignupBody.parse(req.body);
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const inviteCode = input.inviteCode.trim();

  if (!email || !input.password || !firstName || !lastName || !inviteCode) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Claims a use atomically in the database (see redeem_invite_code in
  // supabase/migrations/0007_usage_and_invites.sql) so two people redeeming
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
    return res.status(403).json({ error: GENERIC_ERROR });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: false,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (createError || !created.user) {
    // The code was already claimed above — give the use back so a genuine
    // failure here (duplicate email, Supabase hiccup, ...) doesn't burn a
    // limited-use invite for nothing.
    await releaseInviteCode(inviteCode);
    logger.error({ err: createError }, "Account creation failed after invite code was redeemed");
    return res.status(403).json({ error: GENERIC_ERROR });
  }

  // The handle_new_user trigger (supabase/migrations/0003) already created
  // the profile + user_stats rows — just record which code this account
  // used on top of that.
  await supabaseAdmin.from("profiles").update({ invite_code: inviteCode }).eq("id", created.user.id);

  return res.status(201).json(SignupResponse.parse({ ok: true }));
});

async function releaseInviteCode(code: string): Promise<void> {
  const { data: row } = await supabaseAdmin.from("invite_codes").select("used_count").eq("code", code).maybeSingle();
  if (!row) return;
  await supabaseAdmin
    .from("invite_codes")
    .update({ used_count: Math.max(0, row.used_count - 1) })
    .eq("code", code);
}

export default router;
