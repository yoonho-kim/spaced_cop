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

-- Enable RLS and allow all access (dev policy)
alter table app_event_settings enable row level security;

create policy "Enable all access for app_event_settings" on app_event_settings
  for all using (true) with check (true);
