-- Pin important conversations to the top of the sidebar recents list.
alter table public.conversations
  add column if not exists pinned boolean not null default false;

create index if not exists conversations_user_pinned_idx
  on public.conversations (user_id, pinned desc, updated_at desc);
