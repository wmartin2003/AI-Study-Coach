-- AI Study Coach — per-topic AI study guides, generated from (and kept in
-- sync with) the student's own uploaded course materials.
-- Safe to re-run: every statement is guarded.

create table if not exists public.topic_study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  key_terms jsonb not null default '[]'::jsonb,
  next_step text not null default '',
  -- True only when at least one uploaded-document chunk actually contributed
  -- to this guide — never set from the AI's own say-so.
  grounded_in_materials boolean not null default false,
  sources jsonb not null default '[]'::jsonb,
  -- Snapshot of the course's ready-document/chunk counts at generation time.
  -- Compared against the current counts to decide whether the cached guide
  -- is stale (a document was added, replaced, or removed) without needing
  -- to re-run the model on every view.
  source_document_count int not null default 0,
  source_chunk_count int not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id)
);
create index if not exists topic_study_materials_user_id_idx on public.topic_study_materials (user_id);

alter table public.topic_study_materials enable row level security;

drop policy if exists "topic_study_materials_select_own" on public.topic_study_materials;
create policy "topic_study_materials_select_own" on public.topic_study_materials for select using (auth.uid() = user_id);

drop policy if exists "topic_study_materials_insert_own" on public.topic_study_materials;
create policy "topic_study_materials_insert_own" on public.topic_study_materials for insert with check (auth.uid() = user_id);

drop policy if exists "topic_study_materials_update_own" on public.topic_study_materials;
create policy "topic_study_materials_update_own" on public.topic_study_materials for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "topic_study_materials_delete_own" on public.topic_study_materials;
create policy "topic_study_materials_delete_own" on public.topic_study_materials for delete using (auth.uid() = user_id);
