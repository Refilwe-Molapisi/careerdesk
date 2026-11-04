-- Career Desk: all migrations, consolidated and idempotent.
-- Safe to paste into the Supabase SQL Editor even if some migrations
-- have already run: existing tables, columns, policies and triggers
-- are left alone.

-- ======== 0001_core_schema.sql ========
-- ============================================================================
-- Career Desk - Prompt 3: core schema
-- Every table carries user_id (references auth.users) and has Row Level
-- Security enabled with policies that restrict every operation to the
-- owning user (user_id = auth.uid()).
-- Run in the Supabase SQL editor, or with: supabase db push
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Career Record
-- ---------------------------------------------------------------------------

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
  -- Required in practice: a number, a link, a file or a plain statement of
  -- what the user can show. The UI warns when it is empty.
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

-- ---------------------------------------------------------------------------
-- Jobs and applications
-- ---------------------------------------------------------------------------

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
  -- One tracked application per job; document versions live in
  -- application_documents and re-applications show up in status_history.
  constraint applications_job_id_key unique (job_id)
);

-- Audit trail written only by the trigger in 0002_triggers.sql.
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

-- ---------------------------------------------------------------------------
-- Plan and portfolio
-- ---------------------------------------------------------------------------

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
  -- one review per week per user
  constraint weekly_reviews_user_week_key unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table, all four operations, owner only.
-- status_history deliberately has NO insert policy: rows are written only by
-- the security-definer trigger in 0002_triggers.sql so the audit trail cannot
-- be forged directly.
-- ---------------------------------------------------------------------------

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
-- ============================================================================
-- Career Desk - Prompt 3: triggers
-- 1. Every change to jobs.status writes a status_history row (with time) and
--    refreshes jobs.status_updated_at.
-- 2. Approved application_documents can never be altered or deleted; the only
--    permitted change is marking them superseded. A sent document can never
--    be quietly edited.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. jobs.status -> status_history
--
-- Two triggers:
--   AFTER INSERT  - writes the creation row (after the job row exists, so the
--                   status_history foreign key is satisfied).
--   BEFORE UPDATE OF status - writes the transition row and refreshes
--                   status_updated_at (WHEN clause skips no-op changes).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. Approved documents are immutable (except superseding)
--
-- 'approved' rows: only change allowed is status -> 'superseded'.
-- 'superseded' rows: fully locked. They were approved and may already have
-- been sent, so their content can never be rewritten either.
-- ---------------------------------------------------------------------------

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
-- ============================================================================
-- Career Desk - Prompt 3: private Storage bucket "documents"
-- Files live under <user_id>/... and each user can only read and write inside
-- their own folder. CVs, cover letters and later exports are stored here.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update
  set public = false,
      file_size_limit = coalesce(storage.buckets.file_size_limit, 52428800);

drop policy if exists "documents_select_own" on storage.objects;

do $$ begin
  execute 'create policy "documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = ''documents''
    and (storage.foldername(name))[1] = auth.uid()::text
  )';
exception
  when duplicate_object then null;
end $$;

drop policy if exists "documents_insert_own" on storage.objects;

do $$ begin
  execute 'create policy "documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = ''documents''
    and (storage.foldername(name))[1] = auth.uid()::text
  )';
exception
  when duplicate_object then null;
end $$;

drop policy if exists "documents_update_own" on storage.objects;

do $$ begin
  execute 'create policy "documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = ''documents''
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = ''documents''
    and (storage.foldername(name))[1] = auth.uid()::text
  )';
exception
  when duplicate_object then null;
end $$;

drop policy if exists "documents_delete_own" on storage.objects;

do $$ begin
  execute 'create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = ''documents''
    and (storage.foldername(name))[1] = auth.uid()::text
  )';
exception
  when duplicate_object then null;
end $$;

-- ======== 0004_user_settings.sql ========
-- ============================================================================
-- Career Desk - Prompt 4: user settings (banned-phrase list)
-- One row per user. The banned phrases feed the claim check and style rules.
-- Pre-filled with the spec's default list; the user can add and remove
-- entries in Settings.
-- ============================================================================

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

do $$ begin
  execute 'create policy user_settings_select_own
  on public.user_settings for select
  to authenticated
  using (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

drop policy if exists user_settings_insert_own on public.user_settings;

do $$ begin
  execute 'create policy user_settings_insert_own
  on public.user_settings for insert
  to authenticated
  with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

drop policy if exists user_settings_update_own on public.user_settings;

do $$ begin
  execute 'create policy user_settings_update_own
  on public.user_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

drop policy if exists user_settings_delete_own on public.user_settings;

do $$ begin
  execute 'create policy user_settings_delete_own
  on public.user_settings for delete
  to authenticated
  using (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

-- ======== 0005_job_extraction_fields.sql ========
-- ============================================================================
-- Career Desk - Prompt 5: job extraction fields + mark-as-applied
--
-- 1. Extra columns the job intake extraction needs. The spec's extraction
--    returns preferred skills, seniority, closing date, application
--    instructions and a one-line role family reason; the Prompt 3 schema had
--    nowhere to keep them, so they are added here rather than squeezed into
--    notes or required_skills.
--
-- 2. mark_job_applied(): one atomic, auditable operation used by the
--    "Mark as applied" button. It flips the job to 'applied' (which the
--    trigger records in status_history) and creates the applications row in
--    the same transaction. The app never submits applications on the user's
--    behalf: applied_manually is always true.
-- ============================================================================

alter table public.jobs
  add column if not exists preferred_skills text[] not null default '{}',
  add column if not exists seniority text,
  add column if not exists closing_date date,
  add column if not exists application_instructions text,
  add column if not exists role_family_reason text;

-- One application per job (used by ON CONFLICT in mark_job_applied).
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
-- ============================================================================
-- Career Desk - Prompt 8/9 additions: profile name, reminder settings, no
-- Sunday scheduling, and the document-verified mark_job_applied.
-- ============================================================================

alter table public.user_settings
  add column if not exists full_name text,
  add column if not exists reminder_email text,
  add column if not exists reminders_enabled boolean not null default true;

-- Sunday is rest and cannot be scheduled (isodow 7 = Sunday).
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

-- mark_job_applied gains optional verified documents: when document ids are
-- supplied they must belong to the caller, be approved, and have an exported
-- PDF; their exact paths and SHA-256 hashes are copied into the application.
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

-- Exported PDF bookkeeping: an approved row's content is immutable, but the
-- storage path and hash of the PDF generated FROM that content may be written
-- (and refreshed) by the export route. Nothing else may change.
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

do $$ begin
  execute 'create policy "skills owner all" on public.skills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "skill_evidence owner all" on public.skill_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "skill_assessments owner all" on public.skill_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "role_skill_requirements owner all" on public.role_skill_requirements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "ai_assessments owner all" on public.ai_assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

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
-- because names and categories are seeded per user on first visit.;

-- ======== 0008_ai_usage.sql ========
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

do $$ begin
  execute 'create policy "ai_usage owner all" on public.ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- ======== 0009_eligibility.sql ========
-- ============================================================================
-- Career Desk - Prompt 14: International Eligibility Checker.
-- The candidate lives in South Africa; "remote" never means global.
-- ============================================================================

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

do $$ begin
  execute 'create policy "corrections owner all" on public.corrections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "prompt_rules owner all" on public.prompt_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  execute 'create policy "eval_cases owner all" on public.eval_cases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
exception
  when duplicate_object then null;
end $$;

-- Prompt 23: the salary floor; Prompt 24: spending cap and retention.
alter table public.user_settings
  add column if not exists minimum_salary numeric(12, 2),
  add column if not exists minimum_salary_currency text,
  add column if not exists monthly_cap_usd numeric(10, 2),
  add column if not exists recording_retention_days integer;

-- ======== 0011_recommendation.sql ========
-- ============================================================================
-- Career Desk - Prompt 23: application prioritisation columns.
-- The recommendation is decided by rules in code; these columns store the
-- decision, the factor table that produced it and the owner's overrides.
-- ============================================================================

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
