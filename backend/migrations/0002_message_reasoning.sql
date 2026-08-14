-- Bimo · add the reasoning column used by the deep-reasoning (Nexos) mode.
--
-- store.add_message() persists the model's chain-of-thought in
-- messages.reasoning; without this column every assistant insert silently
-- retries without it and the Thought Process block is lost on reload.
-- Run once in Supabase → SQL editor (safe to re-run).

alter table public.messages
  add column if not exists reasoning text;
