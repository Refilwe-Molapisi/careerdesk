-- Career Desk: all migrations, consolidated and idempotent.
-- Safe to paste into the Supabase SQL Editor even if some migrations
-- have already run: existing tables, columns and triggers are left
-- alone, and policies are dropped and recreated (they hold no data).

-- ======== 0001_core_schema.sql ========
create table if not exists public.career_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in ('education', 'job', 'project', 'skill', 'achievement', 'certification', 'other')
  ),
  title text not null,
  organisation text,
  start_date date,
  end_date date,
  description text,
      evidence text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint career_entries_dates_check
    check (start_date is null or end_date is null or end_date >= start_date)
);
create index if not exists career_entries_user_type_idx
  on public.career_entries (user_id, type);
create table if not exists public.voice_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  company text,
  location text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'onsite', 'unknown')),
  source_url text,
  description text,
  required_skills text[] not null default '{}',
  role_family text not null default 'other' check (
    role_family in (
      'bi_reporting', 'commercial_analysis', 'market_research',
      'risk_fraud', 'operations_analysis', 'administration', 'other'
    )
  ),
  date_found date not null default current_date,
  status text not null default 'saved' check (
    status in (
      'saved', 'tailoring', 'ready', 'applied', 'interviewing',
      'offer', 'rejected', 'withdrawn', 'closed'
    )
  ),
  status_updated_at timestamptz not null default now(),
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status);
create index if not exists jobs_user_follow_up_idx on public.jobs (user_id, follow_up_date)
  where follow_up_date is not null;
create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null check (kind in ('cv', 'cover_letter')),
  version int not null,
  parent_version_id uuid references public.application_documents (id) on delete set null,
  template text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  content_json jsonb,
  source_map jsonb,
  pdf_path text,
  pdf_sha256 text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint application_documents_job_kind_version_key unique (job_id, kind, version)
);
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  submitted_cv_id uuid references public.application_documents (id) on delete set null,
  submitted_cover_letter_id uuid references public.application_documents (id) on delete set null,
  submitted_cv_pdf_path text,
  submitted_cv_sha256 text,
  submitted_cover_letter_pdf_path text,
  submitted_cover_letter_sha256 text,
  applied_on date not null default current_date,
  applied_manually boolean not null default true,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now(),
      constraint applications_job_id_key unique (job_id)
);
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status text check (
    from_status is null or from_status in (
      'saved', 'tailoring', 'ready', 'applied', 'interviewing',
      'offer', 'rejected', 'withdrawn', 'closed'
    )
  ),
  to_status text not null check (
    to_status in (
      'saved', 'tailoring', 'ready', 'applied', 'interviewing',
      'offer', 'rejected', 'withdrawn', 'closed'
    )
  ),
  changed_at timestamptz not null default now()
);
create index if not exists status_history_job_idx on public.status_history (job_id, changed_at);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  question text,
  status text not null default 'planned' check (status in ('planned', 'building', 'published')),
  repo_url text,
  page_url text
);
create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_on date
);
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('learning_topic', 'checklist', 'task')),
  month date,
  category text,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_date date,
  project_id uuid references public.projects (id) on delete set null,
  notes text
);
create table if not exists public.hour_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  category text not null check (
    category in (
      'technical_learning', 'portfolio_projects', 'live_platform',
      'independent_research', 'career_development'
    )
  ),
  hours numeric(4, 1) not null check (hours > 0 and hours <= 24),
  note text,
  constraint hour_logs_user_date_category_key unique (user_id, log_date, category)
);
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  exam_week boolean not null default false,
  target_hours int,
  built text,
  skill_shown text,
  next_deliverable text,
  blocked text,
  protected_university boolean,
  next_publish_or_apply text,
  created_at timestamptz not null default now(),
    constraint weekly_reviews_user_week_key unique (user_id, week_start)
);
do $$
declare
  t text;
begin
  foreach t in array array[
    'career_entries', 'voice_samples', 'jobs', 'application_documents',
    'applications', 'status_history', 'projects', 'project_deliverables',
    'plan_items', 'hour_logs', 'weekly_reviews'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      t || '_select_own', t);

    -- status_history: trigger is the only writer (no insert policy).
    if t <> 'status_history' then
      execute format(
        'drop policy if exists %I on public.%I', t || '_insert_own', t);
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
        t || '_insert_own', t);
    end if;

    execute format(
      'drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_update_own', t);

    execute format(
      'drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_delete_own', t);
  end loop;
end
$$;

-- ======== 0002_triggers.sql ========
create or replace function public.handle_job_status_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.status_history (user_id, job_id, from_status, to_status)
  values (new.user_id, new.id, null, new.status);
  return new;
end;
$$;
create or replace function public.handle_job_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status) then
    insert into public.status_history (user_id, job_id, from_status, to_status)
    values (new.user_id, new.id, old.status, new.status);
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists jobs_status_history_insert_trigger on public.jobs;
create trigger jobs_status_history_insert_trigger
  after insert on public.jobs
  for each row
  execute function public.handle_job_status_insert();
drop trigger if exists jobs_status_history_update_trigger on public.jobs;
create trigger jobs_status_history_update_trigger
  before update of status on public.jobs
  for each row
  when (new.status is distinct from old.status)
  execute function public.handle_job_status_update();
create or replace function public.protect_approved_application_documents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    if old.status in ('approved', 'superseded') then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: approved documents cannot be deleted. Supersede them instead.';
    end if;
    return old;
  end if;

  -- UPDATE of an approved row: only status -> 'superseded' is allowed and
  -- nothing else on the row may change.
  if old.status = 'approved' then
    if new.status is distinct from 'superseded' then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: approved documents cannot be altered. Only superseding is allowed.';
    end if;

    if new.user_id is distinct from old.user_id
      or new.job_id is distinct from old.job_id
      or new.kind is distinct from old.kind
      or new.version is distinct from old.version
      or new.parent_version_id is distinct from old.parent_version_id
      or new.template is distinct from old.template
      or new.content_json is distinct from old.content_json
      or new.source_map is distinct from old.source_map
      or new.pdf_path is distinct from old.pdf_path
      or new.pdf_sha256 is distinct from old.pdf_sha256
      or new.approved_at is distinct from old.approved_at
      or new.created_at is distinct from old.created_at then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: only the status may change when superseding an approved document.';
    end if;
    return new;
  end if;

  -- UPDATE of a superseded row: nothing may change.
  if old.status = 'superseded' then
    raise exception
      'APPROVED_DOCUMENT_LOCKED: a superseded (possibly sent) document can never be altered.';
  end if;

  return new;
end;
$$;
drop trigger if exists application_documents_protect_approved on public.application_documents;
create trigger application_documents_protect_approved
  before update or delete on public.application_documents
  for each row
  execute function public.protect_approved_application_documents();

-- ======== 0003_storage_documents_bucket.sql ========
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update
  set public = false,
      file_size_limit = coalesce(storage.buckets.file_size_limit, 52428800);
drop policy if exists "documents_select_own" on storage.objects;
drop policy if exists "documents_select_own" on public.storage;
create policy "documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "documents_insert_own" on storage.objects;
drop policy if exists "documents_insert_own" on public.storage;
create policy "documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "documents_update_own" on storage.objects;
drop policy if exists "documents_update_own" on public.storage;
create policy "documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "documents_delete_own" on storage.objects;
drop policy if exists "documents_delete_own" on public.storage;
create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======== 0004_user_settings.sql ========
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  banned_phrases text[] not null default '{
    passionate,results-driven,leverage,synergy,dynamic,go-getter,
    team player,detail-oriented,proven track record,spearheaded,
    cutting-edge,innovative,self-starter
  }',
  created_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy user_settings_select_own
  on public.user_settings for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists user_settings_insert_own on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy user_settings_insert_own
  on public.user_settings for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists user_settings_update_own on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy user_settings_update_own
  on public.user_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists user_settings_delete_own on public.user_settings;
drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy user_settings_delete_own
  on public.user_settings for delete
  to authenticated
  using (user_id = auth.uid());

-- ======== 0005_job_extraction_fields.sql ========
alter table public.jobs
  add column if not exists preferred_skills text[] not null default '{}',
  add column if not exists seniority text,
  add column if not exists closing_date date,
  add column if not exists application_instructions text,
  add column if not exists role_family_reason text;
create unique index if not exists applications_job_id_uniq
  on public.applications (job_id);
create or replace function public.mark_job_applied(
  p_job_id uuid,
  p_applied_on date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED: sign in to record applications.';
  end if;

  if p_job_id is null then
    raise exception 'JOB_REQUIRED: a job id is required.';
  end if;

  update public.jobs
     set status = 'applied'
   where id = p_job_id
     and user_id = v_user;

  if not found then
    raise exception 'JOB_NOT_FOUND: job does not exist or does not belong to you.';
  end if;

  insert into public.applications (user_id, job_id, applied_on, applied_manually)
  values (v_user, p_job_id, coalesce(p_applied_on, current_date), true)
  on conflict (job_id) do nothing;
end;
$$;
revoke all on function public.mark_job_applied(uuid, date) from public;
grant execute on function public.mark_job_applied(uuid, date) to authenticated;

-- ======== 0006_documents_plan_and_reminders.sql ========
alter table public.user_settings
  add column if not exists full_name text,
  add column if not exists reminder_email text,
  add column if not exists reminders_enabled boolean not null default true;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hour_logs_not_sunday' and conrelid = 'public.hour_logs'::regclass
  ) then
    alter table public.hour_logs
      add constraint hour_logs_not_sunday
      check (extract(isodow from log_date) between 1 and 6);
  end if;
end
$$;
drop function if exists public.mark_job_applied(uuid, date);
create or replace function public.mark_job_applied(
  p_job_id uuid,
  p_applied_on date default current_date,
  p_cv_document_id uuid default null,
  p_cover_letter_document_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cv_path text;
  v_cv_hash text;
  v_letter_path text;
  v_letter_hash text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED: sign in to record applications.';
  end if;

  if p_job_id is null then
    raise exception 'JOB_REQUIRED: a job id is required.';
  end if;

  if p_cv_document_id is not null then
    select pdf_path, pdf_sha256 into v_cv_path, v_cv_hash
      from public.application_documents
     where id = p_cv_document_id and user_id = v_user
       and status = 'approved' and pdf_path is not null;
    if not found then
      raise exception
        'DOCUMENT_NOT_APPROVED: the CV must be an approved version with an exported PDF.';
    end if;
  end if;

  if p_cover_letter_document_id is not null then
    select pdf_path, pdf_sha256 into v_letter_path, v_letter_hash
      from public.application_documents
     where id = p_cover_letter_document_id and user_id = v_user
       and status = 'approved' and pdf_path is not null;
    if not found then
      raise exception
        'DOCUMENT_NOT_APPROVED: the cover letter must be an approved version with an exported PDF.';
    end if;
  end if;

  update public.jobs
     set status = 'applied'
   where id = p_job_id
     and user_id = v_user;

  if not found then
    raise exception 'JOB_NOT_FOUND: job does not exist or does not belong to you.';
  end if;

  insert into public.applications (
    user_id, job_id, applied_on, applied_manually,
    submitted_cv_id, submitted_cover_letter_id,
    submitted_cv_pdf_path, submitted_cv_sha256,
    submitted_cover_letter_pdf_path, submitted_cover_letter_sha256
  ) values (
    v_user, p_job_id, coalesce(p_applied_on, current_date), true,
    p_cv_document_id, p_cover_letter_document_id,
    v_cv_path, v_cv_hash,
    v_letter_path, v_letter_hash
  )
  on conflict (job_id) do nothing;
end;
$$;
revoke all on function public.mark_job_applied(uuid, date, uuid, uuid) from public;
grant execute on function public.mark_job_applied(uuid, date, uuid, uuid) to authenticated;
create or replace function public.protect_approved_application_documents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    if old.status in ('approved', 'superseded') then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: approved documents cannot be deleted. Supersede them instead.';
    end if;
    return old;
  end if;

  -- UPDATE of an approved row: the status may only move to 'superseded', and
  -- content and identity are immutable. pdf_path and pdf_sha256 are the only
  -- other columns that may change: they are export bookkeeping derived from
  -- the immutable content.
  if old.status = 'approved' then
    if new.status is distinct from old.status and new.status is distinct from 'superseded' then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: approved documents cannot be altered. Only superseding is allowed.';
    end if;

    if new.user_id is distinct from old.user_id
      or new.job_id is distinct from old.job_id
      or new.kind is distinct from old.kind
      or new.version is distinct from old.version
      or new.parent_version_id is distinct from old.parent_version_id
      or new.template is distinct from old.template
      or new.content_json is distinct from old.content_json
      or new.source_map is distinct from old.source_map
      or new.approved_at is distinct from old.approved_at
      or new.created_at is distinct from old.created_at then
      raise exception
        'APPROVED_DOCUMENT_LOCKED: only the status may change when superseding an approved document.';
    end if;
    return new;
  end if;

  -- UPDATE of a superseded row: nothing may change.
  if old.status = 'superseded' then
    raise exception
      'APPROVED_DOCUMENT_LOCKED: a superseded (possibly sent) document can never be altered.';
  end if;

  return new;
end;
$$;

-- ======== 0007_skills.sql ========
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
drop policy if exists "skills owner all" on public.skills;
create policy "skills owner all" on public.skills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "skill_evidence owner all" on public.skill_evidence;
create policy "skill_evidence owner all" on public.skill_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "skill_assessments owner all" on public.skill_assessments;
create policy "skill_assessments owner all" on public.skill_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "role_skill_requirements owner all" on public.role_skill_requirements;
create policy "role_skill_requirements owner all" on public.role_skill_requirements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ai_assessments owner all" on public.ai_assessments;
create policy "ai_assessments owner all" on public.ai_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
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

-- ======== 0008_ai_usage.sql ========
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
drop policy if exists "ai_usage owner all" on public.ai_usage;
create policy "ai_usage owner all" on public.ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- ======== 0009_eligibility.sql ========
alter table public.jobs
  add column if not exists employer_country text,
  add column if not exists eligible_countries text[] not null default '{}',
  add column if not exists candidate_location_eligible boolean,
  add column if not exists employment_type text
    check (employment_type in ('permanent', 'fixed_term', 'contract', 'unknown')),
  add column if not exists engagement_model text
    check (engagement_model in ('local_employment', 'eor', 'contractor', 'unknown')),
  add column if not exists timezone text,
  add column if not exists required_overlap_hours text,
  add column if not exists salary_currency text,
  add column if not exists salary_min numeric(12, 2),
  add column if not exists salary_max numeric(12, 2),
  add column if not exists eligibility_status text
    not null default 'unverified'
    check (eligibility_status in (
      'eligible', 'potentially_eligible', 'ineligible', 'unverified'
    )),
  add column if not exists eligibility_evidence jsonb
    not null default '[]',
  add column if not exists eligibility_checked_at timestamptz;

-- ======== 0010_quality.sql ========
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
drop policy if exists "corrections owner all" on public.corrections;
create policy "corrections owner all" on public.corrections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "prompt_rules owner all" on public.prompt_rules;
create policy "prompt_rules owner all" on public.prompt_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "eval_cases owner all" on public.eval_cases;
create policy "eval_cases owner all" on public.eval_cases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.user_settings
  add column if not exists minimum_salary numeric(12, 2),
  add column if not exists minimum_salary_currency text,
  add column if not exists monthly_cap_usd numeric(10, 2),
  add column if not exists recording_retention_days integer;

-- ======== 0011_recommendation.sql ========
alter table public.jobs
  add column if not exists recommendation text
    check (recommendation in (
      'apply', 'apply_with_reservations', 'develop_first', 'do_not_apply'
    )),
  add column if not exists recommendation_factors jsonb,
  add column if not exists recommendation_note text,
  add column if not exists recommendation_overridden boolean
    not null default false,
  add column if not exists override_reason text;
