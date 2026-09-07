-- AI Study Coach — lets a student mark a topic's study guide as done, so
-- the daily plan can reflect it (and award a small amount of XP for it).
-- Safe to re-run: guarded with IF NOT EXISTS.

alter table public.topic_study_materials
  add column if not exists completed_at timestamptz;
