-- ============================================
-- Space D - Quick Vote Settings (칭찬하기 대상자 지정)
-- ============================================
-- Supabase 대시보드 > SQL Editor에서 실행하세요

create table if not exists app_quick_vote_settings (
  id bigint primary key check (id = 1),
  praise_member_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into app_quick_vote_settings (id, praise_member_ids)
values (1, '{}')
on conflict (id) do nothing;

alter table app_quick_vote_settings enable row level security;

drop policy if exists "app_quick_vote_settings_read_all" on app_quick_vote_settings;
drop policy if exists "app_quick_vote_settings_write_authenticated" on app_quick_vote_settings;
drop policy if exists "app_quick_vote_settings_update_authenticated" on app_quick_vote_settings;
drop policy if exists "app_quick_vote_settings_delete_authenticated" on app_quick_vote_settings;

create policy "app_quick_vote_settings_read_all" on app_quick_vote_settings
for select using (true);

create policy "app_quick_vote_settings_write_authenticated" on app_quick_vote_settings
for insert with check (true);

create policy "app_quick_vote_settings_update_authenticated" on app_quick_vote_settings
for update using (true)
with check (true);

create policy "app_quick_vote_settings_delete_authenticated" on app_quick_vote_settings
for delete using (true);
