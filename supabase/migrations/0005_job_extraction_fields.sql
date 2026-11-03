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
