-- ============================================================================
-- Career Desk - Prompt 13: AI usage ledger. Filled by the task runner from
-- each provider's usage fields; task name, duration and token counts are
-- logged, never prompt content.
-- ============================================================================

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task text not null,
  provider text not null default 'deepseek',
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  audio_seconds numeric(12, 2) not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  status text not null default 'ok' check (status in ('ok', 'failed')),
  retry_count integer not null default 0,
  entries_used integer,
  created_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

create policy "ai_usage owner all" on public.ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);
