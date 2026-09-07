-- AI Study Coach — AI spend controls and invite-only signup.
--
-- Three tables here are deliberately locked down tighter than the rest of
-- this schema: a signed-in user holds a real JWT and RLS would otherwise let
-- them write their own rows (including a usage ledger they could edit to
-- reset their own quota). `ai_usage` gets a select-own policy and nothing
-- else; `invite_codes` and `ai_service_state` get zero policies at all.
-- Every write to any of the three happens exclusively through the service
-- role (supabaseAdmin) from application code.
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------------------
-- ai_usage — one row per Anthropic call, written only after the call
-- actually happened, with the real token counts from response.usage.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  feature text not null check (feature in ('tutor', 'quiz', 'study_guide', 'syllabus', 'topics')),
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  estimated_cost_usd numeric(10, 6) not null
);
create index if not exists ai_usage_user_id_occurred_at_idx on public.ai_usage (user_id, occurred_at);

alter table public.ai_usage enable row level security;

-- Select-own only. No insert/update/delete policy exists for this table —
-- a user's own anon-key session cannot write a row here under any
-- circumstance; only supabaseAdmin (which bypasses RLS entirely) can.
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- invite_codes — service role only. Zero policies means no anon/authenticated
-- role can select, insert, update, or delete a single row here, even their
-- own — the only way in is supabaseAdmin or the redeem_invite_code() function
-- below (security definer).
-- ---------------------------------------------------------------------------

create table if not exists public.invite_codes (
  code text primary key,
  note text,
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- ---------------------------------------------------------------------------
-- ai_service_state — a single-row kill switch and global budget, service
-- role only (zero policies).
-- ---------------------------------------------------------------------------

create table if not exists public.ai_service_state (
  id int primary key default 1 check (id = 1),
  paused boolean not null default false,
  paused_reason text,
  monthly_budget_usd numeric not null default 40
);

alter table public.ai_service_state enable row level security;

insert into public.ai_service_state (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- profiles — per-user budget override and the invite code redeemed at signup.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists monthly_budget_usd numeric,
  add column if not exists invite_code text;

-- ---------------------------------------------------------------------------
-- courses — flags a hardcoded, zero-AI-cost sample course seeded on
-- onboarding completion so a brand-new account has something to look at.
-- ---------------------------------------------------------------------------

alter table public.courses
  add column if not exists is_sample boolean not null default false;

-- ---------------------------------------------------------------------------
-- redeem_invite_code — atomically claims one use of a code. Done in SQL
-- (rather than a read-then-write in application code) specifically so two
-- simultaneous redemptions of the last remaining use cannot both succeed:
-- the UPDATE's WHERE clause re-checks used_count < max_uses in the same
-- statement that increments it, and Postgres serializes concurrent updates
-- to the same row. security definer so it can run even though invite_codes
-- has no policies granting access to the calling role.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_invite_code(code text)
returns text
language sql
security definer set search_path = public
as $$
  update public.invite_codes
  set used_count = used_count + 1
  where invite_codes.code = redeem_invite_code.code
    and used_count < max_uses
    and (expires_at is null or expires_at > now())
  returning invite_codes.code;
$$;
