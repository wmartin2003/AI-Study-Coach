-- AI Study Coach — initial schema, RLS policies, storage buckets, and auth trigger.
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  grade_level text,
  study_minutes_per_day int,
  learning_style text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp int not null default 0,
  streak_days int not null default 0,
  longest_streak int not null default 0,
  last_study_date date,
  total_study_minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  level text not null default 'Undergraduate',
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courses_user_id_idx on public.courses (user_id);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  mastery_level text not null default 'not_started'
    check (mastery_level in ('not_started', 'learning', 'developing', 'proficient', 'mastered')),
  mastery_score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists topics_user_id_idx on public.topics (user_id);
create index if not exists topics_course_id_idx on public.topics (course_id);

create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  description text not null,
  target_date date,
  minutes_per_day int,
  created_at timestamptz not null default now()
);
create index if not exists study_goals_user_id_idx on public.study_goals (user_id);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  name text not null,
  exam_date date not null,
  confidence int check (confidence between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists exams_user_id_idx on public.exams (user_id);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  activities jsonb not null default '[]'::jsonb,
  questions_answered int not null default 0,
  accuracy numeric,
  mastery_change numeric,
  created_at timestamptz not null default now()
);
create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  mode text not null default 'learn'
    check (mode in ('learn', 'homework_help', 'practice', 'explain', 'exam_prep', 'review', 'quick_question')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_id_idx on public.conversations (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id, created_at);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_id_idx on public.documents (user_id);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists document_chunks_user_id_idx on public.document_chunks (user_id);
create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id, chunk_index);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  title text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  total_questions int not null default 10,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists quizzes_user_id_idx on public.quizzes (user_id);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  question_number int not null,
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  difficulty text not null default 'core',
  created_at timestamptz not null default now()
);
create index if not exists quiz_questions_user_id_idx on public.quiz_questions (user_id);
create index if not exists quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id, question_number);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_answer text not null,
  correct boolean not null,
  xp_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_id_idx on public.quiz_attempts (user_id);

create table if not exists public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists flashcard_sets_user_id_idx on public.flashcard_sets (user_id);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  flashcard_set_id uuid not null references public.flashcard_sets (id) on delete cascade,
  front text not null,
  back text not null,
  confidence int not null default 0,
  times_seen int not null default 0,
  times_correct int not null default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists flashcards_user_id_idx on public.flashcards (user_id);
create index if not exists flashcards_set_id_idx on public.flashcards (flashcard_set_id);

create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  question_text text not null,
  student_answer text,
  correct_answer text not null,
  explanation text,
  attempts int not null default 1,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mistakes_user_id_idx on public.mistakes (user_id);

create table if not exists public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  mastery_score numeric not null default 0,
  level text not null default 'not_started'
    check (level in ('not_started', 'learning', 'developing', 'proficient', 'mastered')),
  questions_answered int not null default 0,
  questions_correct int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);
create index if not exists topic_mastery_user_id_idx on public.topic_mastery (user_id);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  icon text,
  earned_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists achievements_user_id_idx on public.achievements (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every table is user-owned; policies restrict all
-- access to rows where user_id = auth.uid(). No table trusts a client-sent
-- user_id for anything other than matching against the authenticated JWT.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles', 'user_stats', 'courses', 'topics', 'study_goals', 'exams',
      'study_sessions', 'conversations', 'messages', 'documents', 'document_chunks',
      'quizzes', 'quiz_questions', 'quiz_attempts', 'flashcard_sets', 'flashcards',
      'mistakes', 'topic_mastery', 'achievements'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- profiles / user_stats use `id` / `user_id` directly as the owner column.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own" on public.user_stats for select using (auth.uid() = user_id);
drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own" on public.user_stats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own" on public.user_stats for insert with check (auth.uid() = user_id);

-- All remaining tables share the same shape: a `user_id` column owns the row.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'courses', 'topics', 'study_goals', 'exams', 'study_sessions', 'conversations',
      'messages', 'documents', 'document_chunks', 'quizzes', 'quiz_questions',
      'quiz_attempts', 'flashcard_sets', 'flashcards', 'mistakes', 'topic_mastery',
      'achievements'
    ])
  loop
    execute format('drop policy if exists "%s_select_own" on public.%I;', t, t);
    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id);', t, t);

    execute format('drop policy if exists "%s_insert_own" on public.%I;', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id);', t, t);

    execute format('drop policy if exists "%s_update_own" on public.%I;', t, t);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t, t);

    execute format('drop policy if exists "%s_delete_own" on public.%I;', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id);', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: create a profile + stats row the moment someone signs
-- up, so they can start using the app with no extra setup step.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage buckets — private by default; objects are namespaced
-- `user_id/course_id/filename` and RLS restricts access to the owner.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('study-documents', 'study-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('study-images', 'study-images', false)
on conflict (id) do nothing;

drop policy if exists "study_documents_owner_select" on storage.objects;
create policy "study_documents_owner_select" on storage.objects for select
  using (bucket_id = 'study-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_documents_owner_insert" on storage.objects;
create policy "study_documents_owner_insert" on storage.objects for insert
  with check (bucket_id = 'study-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_documents_owner_update" on storage.objects;
create policy "study_documents_owner_update" on storage.objects for update
  using (bucket_id = 'study-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_documents_owner_delete" on storage.objects;
create policy "study_documents_owner_delete" on storage.objects for delete
  using (bucket_id = 'study-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_images_owner_select" on storage.objects;
create policy "study_images_owner_select" on storage.objects for select
  using (bucket_id = 'study-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_images_owner_insert" on storage.objects;
create policy "study_images_owner_insert" on storage.objects for insert
  with check (bucket_id = 'study-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_images_owner_update" on storage.objects;
create policy "study_images_owner_update" on storage.objects for update
  using (bucket_id = 'study-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "study_images_owner_delete" on storage.objects;
create policy "study_images_owner_delete" on storage.objects for delete
  using (bucket_id = 'study-images' and (storage.foldername(name))[1] = auth.uid()::text);
