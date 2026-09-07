-- AI Study Coach — closed-beta landing page waitlist.
-- Service role only (zero policies) — written exclusively via
-- POST /api/waitlist, same convention as invite_codes and ai_service_state
-- in supabase/migrations/0007_usage_and_invites.sql.
-- Safe to re-run: every statement is guarded.

create table if not exists public.waitlist (
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
