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
