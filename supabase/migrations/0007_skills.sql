-- ============================================================================
-- Career Desk - Prompt 12: Skills Intelligence.
-- Skills become first-class data linked to the Career Record.
-- ============================================================================

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in (
    'technical', 'analytical', 'economics', 'business', 'research',
    'finance', 'operations', 'communication', 'ai'
  )),
  proficiency text not null default 'not_started' check (proficiency in (
    'not_started', 'learning', 'basic', 'working', 'intermediate',
    'advanced', 'professional'
  )),
  learning_status text not null default 'not_started' check (learning_status in (
    'not_started', 'learning', 'practising', 'applied', 'maintained'
  )),
  practical_experience boolean not null default false,
  last_used date,
  target_role_families text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  career_entry_id uuid references public.career_entries (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  evidence_type text not null check (evidence_type in (
    'employment', 'education', 'project', 'certificate', 'self_study'
  )),
  description text not null,
  link text,
  date date,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proposed_level text not null check (proposed_level in (
    'not_started', 'learning', 'basic', 'working', 'intermediate',
    'advanced', 'professional'
  )),
  reasoning text not null,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'proposed' check (status in (
    'proposed', 'accepted', 'changed', 'rejected'
  )),
  decided_level text check (decided_level in (
    'not_started', 'learning', 'basic', 'working', 'intermediate',
    'advanced', 'professional'
  )),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.role_skill_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  skill_name text not null,
  skill_id uuid references public.skills (id) on delete set null,
  importance text not null check (importance in ('essential', 'desirable')),
  seen_in_posting_text text
);

create table if not exists public.ai_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  subject_id uuid,
  content_json jsonb not null,
  status text not null default 'proposed' check (status in (
    'proposed', 'confirmed', 'dismissed'
  )),
  created_at timestamptz not null default now()
);

alter table public.skills enable row level security;
alter table public.skill_evidence enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.role_skill_requirements enable row level security;
alter table public.ai_assessments enable row level security;

create policy "skills owner all" on public.skills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "skill_evidence owner all" on public.skill_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "skill_assessments owner all" on public.skill_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "role_skill_requirements owner all" on public.role_skill_requirements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_assessments owner all" on public.ai_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- Code-enforced rules (not just the AI's good behaviour):
-- 1. intermediate+ requires at least one employment or project evidence row.
-- 2. certificate/self_study/education evidence alone caps the level at basic.
-- ============================================================================

create or replace function public.enforce_skill_level_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_practical_count int;
  v_strong_count int;
  v_any_count int;
begin
  select count(*) into v_any_count
    from public.skill_evidence
   where skill_id = new.id;

  select count(*) into v_practical_count
    from public.skill_evidence
   where skill_id = new.id and evidence_type in ('employment', 'project');

  select count(*) into v_strong_count
    from public.skill_evidence
   where skill_id = new.id
     and evidence_type in ('employment', 'project', 'certificate');

  -- Rule 1: intermediate and above need employment or project evidence.
  if new.proficiency in ('intermediate', 'advanced', 'professional')
     and v_practical_count = 0 then
    raise exception
      'EVIDENCE_REQUIRED: a skill cannot be intermediate or above without at least one employment or project evidence row.';
  end if;

  -- Rule 2: without employment or project evidence, certificates and study
  -- cap the level at basic.
  if new.proficiency in ('working', 'intermediate', 'advanced', 'professional')
     and v_strong_count = 0 and v_any_count > 0 then
    raise exception
      'EVIDENCE_CAP: a certificate or course alone caps the level at basic. Add employment or project evidence to go higher.';
  end if;

  new.practical_experience := v_practical_count > 0;
  return new;
end;
$$;

drop trigger if exists skills_level_rules on public.skills;
create trigger skills_level_rules
  before insert or update of proficiency on public.skills
  for each row execute function public.enforce_skill_level_rules();

-- Also enforce when evidence rows are removed: dropping the last practical
-- evidence under an intermediate+ skill must fail rather than leave the
-- claim unsupported.
create or replace function public.enforce_skill_evidence_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_skill record;
  v_practical_count int;
begin
  if tg_op = 'DELETE' then
    select * into v_skill from public.skills where id = old.skill_id;
    if found and v_skill.proficiency in ('intermediate', 'advanced', 'professional') then
      select count(*) into v_practical_count
        from public.skill_evidence
       where skill_id = old.skill_id
         and evidence_type in ('employment', 'project')
         and id <> old.id;
      if v_practical_count = 0 then
        raise exception
          'EVIDENCE_REQUIRED: lower the skill level before removing its last employment or project evidence.';
      end if;
    end if;
  end if;
  return coalesce(old, new);
end;
$$;

drop trigger if exists skill_evidence_rules on public.skill_evidence;
create trigger skill_evidence_rules
  before delete on public.skill_evidence
  for each row execute function public.enforce_skill_evidence_rules();

-- The spec's spec-skills seed data lives in code (lib/data/queries/skills.ts)
-- because names and categories are seeded per user on first visit.
