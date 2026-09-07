-- AI Study Coach — lower the default spend caps before opening signup to
-- anyone with the URL. Better a tester hits their cap and says something
-- than the bill being the first sign anything changed.
--
-- The per-user default ($1) lives in code (USER_MONTHLY_BUDGET_USD,
-- lib/usage.ts) — nothing to migrate there. The global monthly ceiling is a
-- column default plus an already-seeded row (0007_usage_and_invites.sql), so
-- both need updating: the column default for any future re-seed, and the
-- existing row directly. The row update is guarded to only touch it while
-- it's still at the old default (40) — if you've already changed it by hand,
-- this won't stomp on that.
-- Safe to re-run: guarded with a where clause and a plain column default.

alter table public.ai_service_state
  alter column monthly_budget_usd set default 35;

update public.ai_service_state
set monthly_budget_usd = 35
where id = 1 and monthly_budget_usd = 40;
