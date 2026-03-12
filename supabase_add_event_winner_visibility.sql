alter table if exists public.app_event_settings
  add column if not exists show_winner_list boolean default true;
