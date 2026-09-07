-- AI Study Coach — standardized country code, verified institution lookup
-- fields, a degree field, and a personalization opt-out. Purely additive:
-- every new column is nullable (or has a safe default), and the existing
-- free-text `country` / `institution_name` columns are untouched, so no
-- existing row or client is broken.

alter table public.profiles
  -- ISO 3166-1 alpha-2 code for the student's own country, selected from a
  -- standardized list. `country` (free text) is kept for any legacy value
  -- that couldn't be confidently matched to a code — see the backfill script.
  add column if not exists country_code text,

  -- Degree type (e.g. "Bachelor of Science"), distinct from program_major
  -- (e.g. "Computer Science") — university-level only, optional.
  add column if not exists degree text,

  -- Institution lookup results. institution_name already existed (free
  -- text); these three are only populated when the student actually picked
  -- a result from the institution search rather than typing a name that
  -- didn't match anything, so their presence itself means "verified via
  -- lookup" — the AI context builder relies on that distinction.
  add column if not exists institution_country_code text,
  add column if not exists institution_website text,
  add column if not exists institution_domain text,

  -- Settings > AI & Personalization: when false, the tutor context builder
  -- omits profile-derived fields (education level, institution, program,
  -- mastery-based framing) entirely rather than just phrasing around them.
  add column if not exists personalization_enabled boolean not null default true;
