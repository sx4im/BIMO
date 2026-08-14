-- Bimo · initial Supabase Postgres schema.
--
-- Run this once in Supabase → SQL editor. All tables are RLS-protected so the
-- service-role key (used by the Render gateway) can read/write on behalf of
-- any authenticated user, while the anon key cannot reach data directly.

create extension if not exists "pgcrypto";

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  provider    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Conversations ----------
create table if not exists public.conversations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null default 'New conversation',
  model          text,
  system_prompt  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);

-- ---------- Messages ----------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  attachments     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ---------- Feedback ----------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  message_id  uuid not null references public.messages(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  correctness text not null check (correctness in ('correct', 'partially_correct', 'incorrect')),
  length      text not null check (length in ('too_short', 'ideal', 'too_long')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists feedback_user_idx on public.feedback(user_id);

-- ---------- Row Level Security ----------
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.feedback      enable row level security;

-- profiles: each user can read/write their own row.
drop policy if exists "profiles read"  on public.profiles;
drop policy if exists "profiles write" on public.profiles;
create policy "profiles read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles write" on public.profiles for all    using (auth.uid() = id) with check (auth.uid() = id);

-- conversations: owner only.
drop policy if exists "conversations read"  on public.conversations;
drop policy if exists "conversations write" on public.conversations;
create policy "conversations read"  on public.conversations for select using (auth.uid() = user_id);
create policy "conversations write" on public.conversations for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: scoped via parent conversation.
drop policy if exists "messages read"  on public.messages;
drop policy if exists "messages write" on public.messages;
create policy "messages read" on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);
create policy "messages write" on public.messages for all using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);

-- feedback: owner only.
drop policy if exists "feedback read"  on public.feedback;
drop policy if exists "feedback write" on public.feedback;
create policy "feedback read"  on public.feedback for select using (auth.uid() = user_id);
create policy "feedback write" on public.feedback for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Storage ----------
-- Private bucket for chat attachments. Files live under
--   <user_id>/<random>/<filename>
-- and the gateway returns signed URLs to the UI.
insert into storage.buckets (id, name, public)
values ('bimo-attachments', 'bimo-attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments owner read"  on storage.objects;
drop policy if exists "attachments owner write" on storage.objects;
create policy "attachments owner read"
  on storage.objects for select
  using (
    bucket_id = 'bimo-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "attachments owner write"
  on storage.objects for all
  using (
    bucket_id = 'bimo-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'bimo-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
