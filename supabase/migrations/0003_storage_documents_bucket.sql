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
create policy "documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_insert_own" on storage.objects;
create policy "documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_update_own" on storage.objects;
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
create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
