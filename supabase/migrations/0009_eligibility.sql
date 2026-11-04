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
