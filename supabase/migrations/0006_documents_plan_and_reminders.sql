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
