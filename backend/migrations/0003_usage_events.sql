-- Bimo · per-turn usage metering for the 5-hour + weekly soft limits.
--
-- One row per completed chat turn. The gateway sums the trailing 5h / 7d
-- windows (weighting each model in Python) to show "usage left" and to block
-- new turns once a window is exhausted. There is NO paid tier — an over-limit
-- user simply waits for the window to roll. Run once in Supabase (safe to re-run).

create table if not exists public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  model       text not null,   -- friendly lane: fast | thinking | deep
  tokens      int  not null,   -- estimated raw tokens (prompt + reply + reasoning)
  created_at  timestamptz not null default now()
);
create index if not exists usage_events_user_time_idx on public.usage_events(user_id, created_at desc);

alter table public.usage_events enable row level security;
drop policy if exists "usage read"  on public.usage_events;
drop policy if exists "usage write" on public.usage_events;
create policy "usage read"  on public.usage_events for select using (auth.uid() = user_id);
create policy "usage write" on public.usage_events for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
