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
  page_url text,
  created_at timestamptz not null default now()
);
alter table public.projects
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_on date,
  created_at timestamptz not null default now()
);
alter table public.project_deliverables
  add column if not exists created_at timestamptz not null default now();

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
