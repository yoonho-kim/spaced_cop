-- ============================================
-- Event Popup Settings Table
-- ============================================

create table if not exists app_event_settings (
  id integer primary key default 1,
  is_active boolean default false,
  description text,
  image_url text,
  image_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table app_event_settings
  add column if not exists image_url text;

alter table app_event_settings
  add column if not exists image_path text;

-- Enable RLS
alter table app_event_settings enable row level security;

drop policy if exists "Enable all access for app_event_settings" on app_event_settings;
drop policy if exists "app_event_settings_read_all" on app_event_settings;
drop policy if exists "app_event_settings_write_authenticated" on app_event_settings;
drop policy if exists "app_event_settings_update_authenticated" on app_event_settings;
drop policy if exists "app_event_settings_delete_authenticated" on app_event_settings;

create policy "app_event_settings_read_all" on app_event_settings
  for select using (true);

create policy "app_event_settings_write_authenticated" on app_event_settings
  for insert to authenticated with check (true);

create policy "app_event_settings_update_authenticated" on app_event_settings
  for update to authenticated using (true) with check (true);

create policy "app_event_settings_delete_authenticated" on app_event_settings
  for delete to authenticated using (true);
