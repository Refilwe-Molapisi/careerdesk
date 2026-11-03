-- ============================================================================
-- Career Desk - RLS isolation test (SQL editor)
--
-- Confirms that another user cannot read your rows. Run the WHOLE file at
-- once in the Supabase SQL editor (it must run as the postgres role, which
-- is what the SQL editor uses). Nothing is committed: the transaction rolls
-- back, so it leaves no test data behind.
--
-- If your postgres role cannot `SET ROLE authenticated`, use the equivalent
-- end-to-end test instead: supabase/tests/rls-test.mjs
-- ============================================================================

begin;

-- Act as an authenticated user A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.jobs (user_id, title, company, description, status)
values (auth.uid(), 'Secret job for user A', 'Acme Ltd', 'A private description only user A should see.', 'saved');

insert into public.career_entries (user_id, type, title, evidence)
values (auth.uid(), 'job', 'Secret role', 'Private evidence.');

-- Switch to user B and try to read user A's data.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select count(*) as jobs_user_b_can_see from public.jobs;          -- must be 0
select count(*) as entries_user_b_can_see from public.career_entries; -- must be 0

-- User B also cannot modify or delete user A's rows (policies return no rows).
update public.jobs set status = 'closed'
 where user_id = '11111111-1111-1111-1111-111111111111';           -- 0 rows
delete from public.jobs
 where user_id = '11111111-1111-1111-1111-111111111111';           -- 0 rows

-- The anonymous role (not signed in) sees nothing either.
set local role anon;
select count(*) as jobs_anon_can_see from public.jobs;             -- must be 0

rollback;
