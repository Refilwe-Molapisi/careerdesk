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
