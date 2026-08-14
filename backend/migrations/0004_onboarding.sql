-- Bimo · onboarding / "What's new in Bimo 5" survey.
--
-- Run this once in Supabase → SQL editor. We hang the survey answers off the
-- existing per-user `profiles` row (already RLS-scoped to its owner) rather
-- than a new table — it's a strict 1:1 with the user.

alter table public.profiles
  add column if not exists birthday        date,
  add column if not exists role            text,
  add column if not exists onboarding_seen boolean not null default false;
