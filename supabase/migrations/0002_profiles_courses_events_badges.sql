-- AI Study Coach — educational profile fields, course lifecycle/metadata,
-- a calendar/events table, and richer badge + document metadata.
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------------------
-- Profiles — structured educational info for real personalization.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists country text,
  add column if not exists education_level text
    check (education_level in ('high_school', 'college', 'university', 'other')),
  add column if not exists institution_name text,
  add column if not exists program_major text,
  add column if not exists grade_year text,
  add column if not exists expected_completion_date date;

-- ---------------------------------------------------------------------------
-- Courses — lifecycle status + real metadata; the old single `exam_date`
-- becomes `completion_date`, an optional rough target, now that specific
-- dated things (exams, assignments, ...) live in course_events instead.
-- ---------------------------------------------------------------------------

alter table public.courses rename column exam_date to completion_date;

alter table public.courses
  add column if not exists status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  add column if not exists course_code text,
  add column if not exists institution text,
  add column if not exists instructor text,
  add column if not exists term text,
  add column if not exists completed_at timestamptz;

create index if not exists courses_status_idx on public.courses (user_id, status);

-- ---------------------------------------------------------------------------
-- Course events — the calendar: exams, midterms, assignments, quizzes,
-- projects, and other deadlines, either added manually or confirmed from a
-- syllabus extraction.
-- ---------------------------------------------------------------------------

create table if not exists public.course_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  type text not null check (type in ('exam', 'midterm', 'final', 'assignment', 'quiz', 'project', 'other')),
  title text not null,
  event_date date not null,
  description text,
  source text not null default 'manual' check (source in ('manual', 'syllabus')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_events_user_id_idx on public.course_events (user_id);
create index if not exists course_events_course_id_idx on public.course_events (course_id, event_date);

alter table public.course_events enable row level security;

drop policy if exists "course_events_select_own" on public.course_events;
create policy "course_events_select_own" on public.course_events for select using (auth.uid() = user_id);
drop policy if exists "course_events_insert_own" on public.course_events;
create policy "course_events_insert_own" on public.course_events for insert with check (auth.uid() = user_id);
drop policy if exists "course_events_update_own" on public.course_events;
create policy "course_events_update_own" on public.course_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "course_events_delete_own" on public.course_events;
create policy "course_events_delete_own" on public.course_events for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Achievements — extend the existing table to carry course-completion badges.
-- ---------------------------------------------------------------------------

alter table public.achievements
  add column if not exists course_id uuid references public.courses (id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Documents — type + syllabus extraction review state.
-- ---------------------------------------------------------------------------

alter table public.documents
  add column if not exists document_type text not null default 'other'
    check (document_type in ('syllabus', 'lecture', 'notes', 'study_guide', 'other')),
  add column if not exists extraction jsonb,
  add column if not exists extraction_confirmed boolean not null default false;
