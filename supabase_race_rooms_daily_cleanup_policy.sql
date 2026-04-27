-- ============================================
-- Space D - Realtime Pinball Daily Cleanup Policy
-- ============================================
-- 기존 app_race_rooms 테이블에 일일 초기화용 DELETE 권한만 추가합니다.

drop policy if exists "app_race_rooms_delete_all" on public.app_race_rooms;

create policy "app_race_rooms_delete_all"
  on public.app_race_rooms for delete
  using (true);

-- 필요 시 SQL Editor에서 아래 쿼리로 오늘 이전 방을 즉시 정리할 수 있습니다.
-- delete from public.app_race_rooms
-- where created_at < date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
