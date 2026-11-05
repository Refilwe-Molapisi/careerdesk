-- ============================================================================
-- Career Desk - Prompt 4: user settings (banned-phrase list)
-- One row per user. The banned phrases feed the claim check and style rules.
-- Pre-filled with the spec's default list; the user can add and remove
-- entries in Settings.
-- ============================================================================

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  banned_phrases text[] not null default '{passionate,results-driven,leverage,synergy,dynamic,go-getter,team player,detail-oriented,proven track record,spearheaded,cutting-edge,innovative,self-starter}',
  created_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own
  on public.user_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own
  on public.user_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own
  on public.user_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own
  on public.user_settings for delete
  to authenticated
  using (user_id = auth.uid());
