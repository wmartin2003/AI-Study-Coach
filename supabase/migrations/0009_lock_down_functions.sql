-- AI Study Coach — close a real hole found in review: `redeem_invite_code`
-- is `security definer`, and Postgres grants EXECUTE on new functions to
-- PUBLIC by default. Supabase exposes every public-schema function over
-- PostgREST, so with the default grant, anyone holding the anon key (i.e.
-- anyone — it ships in the browser bundle) could call
-- `POST /rest/v1/rpc/redeem_invite_code` directly: that both leaks whether a
-- given code is valid/unused (the call returns the code back on success) and
-- burns a single-use code's only use without ever creating an account.
--
-- Fix: revoke EXECUTE from the roles PostgREST calls through (public covers
-- anon and authenticated too, since both inherit from it) and grant it only
-- to service_role, which is the only role that ever calls this function
-- (via supabaseAdmin.rpc in routes/signup.ts).
--
-- Audit of every other function this project has added, for the same class
-- of bug:
--   - handle_new_user() (0001_init.sql, 0003_trigger_first_last_name.sql):
--     declared `returns trigger`. Postgres refuses to invoke a trigger
--     function any way other than as a trigger ("trigger functions can only
--     be called as triggers") — this is enforced regardless of GRANT status,
--     so there's no equivalent hole here and no lockdown needed. (The
--     revoke/grant below would be harmless here too — trigger firing doesn't
--     go through the EXECUTE privilege check — but it's not needed.)
-- Safe to re-run: revoke/grant and create-or-replace are all idempotent.

revoke execute on function public.redeem_invite_code(text) from public, anon, authenticated;
grant execute on function public.redeem_invite_code(text) to service_role;

-- ---------------------------------------------------------------------------
-- release_invite_code — gives back a use that was redeemed but then not
-- actually consumed (account creation failed after redemption succeeded).
-- Previously done in application code as a select-then-update
-- (routes/signup.ts), which had the same race the atomic redeem was written
-- to avoid: two concurrent failed signups could read the same used_count and
-- both write back count - 1, giving back only one use instead of two. A
-- single atomic UPDATE fixes that, same reasoning as redeem_invite_code.
-- Locked down the same way — service_role only.
-- ---------------------------------------------------------------------------

create or replace function public.release_invite_code(code text)
returns void
language sql
security definer set search_path = public
as $$
  update public.invite_codes
  set used_count = greatest(used_count - 1, 0)
  where invite_codes.code = release_invite_code.code;
$$;

revoke execute on function public.release_invite_code(text) from public, anon, authenticated;
grant execute on function public.release_invite_code(text) to service_role;
