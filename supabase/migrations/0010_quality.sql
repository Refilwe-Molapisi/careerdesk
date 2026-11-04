-- ============================================================================
-- Career Desk - Prompt 22 (quality) + 23/24 settings columns.
-- ============================================================================

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.application_documents (id) on delete set null,
  original_text text not null,
  edited_text text not null,
  reason_tag text not null check (reason_tag in (
    'inaccurate', 'too_strong', 'wrong_tone', 'irrelevant',
    'missing_detail', 'other'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  job_text text not null,
  expectations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.corrections enable row level security;
alter table public.prompt_rules enable row level security;
alter table public.eval_cases enable row level security;

create policy "corrections owner all" on public.corrections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prompt_rules owner all" on public.prompt_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eval_cases owner all" on public.eval_cases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prompt 23: the salary floor; Prompt 24: spending cap and retention.
alter table public.user_settings
  add column if not exists minimum_salary numeric(12, 2),
  add column if not exists minimum_salary_currency text,
  add column if not exists monthly_cap_usd numeric(10, 2),
  add column if not exists recording_retention_days integer;
