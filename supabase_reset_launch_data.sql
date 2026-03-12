-- ============================================
-- 오픈 전 데이터 초기화 (admin 계정 유지)
-- ============================================
-- 대상: 계정(비관리자), 피드, 봉사활동, 회의실 예약 현황, 이벤트, 퀵투표, 비품신청
-- 비대상: meeting_rooms(회의실 마스터 정보)는 유지

BEGIN;

DO $$
BEGIN
  -- 1) Feed
  IF to_regclass('public.post_comments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.post_comments';
  END IF;

  IF to_regclass('public.post_likes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.post_likes';
  END IF;

  IF to_regclass('public.posts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.posts';
  END IF;

  -- 2) Volunteer
  IF to_regclass('public.volunteer_registrations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.volunteer_registrations';
  END IF;

  IF to_regclass('public.volunteer_activities') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.volunteer_activities';
  END IF;

  -- 3) Meeting reservation status
  -- recurring_rule_id FK가 meeting_reservations -> meeting_recurring_rules 이므로 예약 먼저 삭제
  IF to_regclass('public.meeting_reservations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.meeting_reservations';
  END IF;

  IF to_regclass('public.meeting_recurring_rules') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.meeting_recurring_rules';
  END IF;

  -- 4) Event
  IF to_regclass('public.app_event_entries') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.app_event_entries';
  END IF;

  IF to_regclass('public.app_event_settings') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.app_event_settings (id, is_active, description, image_url, image_path, show_winner_list, updated_at)
      VALUES (1, false, NULL, NULL, NULL, true, now())
      ON CONFLICT (id)
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        image_path = EXCLUDED.image_path,
        show_winner_list = EXCLUDED.show_winner_list,
        updated_at = EXCLUDED.updated_at
    $q$;
  END IF;

  -- 5) Quick votes / praise settings
  IF to_regclass('public.quick_votes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.quick_votes';
  END IF;

  IF to_regclass('public.app_quick_vote_settings') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.app_quick_vote_settings (id, praise_member_ids, updated_at)
      VALUES (1, '{}'::text[], now())
      ON CONFLICT (id)
      DO UPDATE SET
        praise_member_ids = '{}'::text[],
        updated_at = now()
    $q$;
  END IF;

  -- 6) Supplies
  IF to_regclass('public.supply_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.supply_requests';
  END IF;

  -- 7) Accounts (admin 제외)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'is_admin'
  ) THEN
    EXECUTE 'DELETE FROM public.users WHERE COALESCE(is_admin, false) = false';
  ELSE
    -- 혹시 legacy 스키마라 is_admin이 없으면 nickname=admin만 보존
    EXECUTE 'DELETE FROM public.users WHERE lower(COALESCE(nickname, '''')) <> ''admin''';
  END IF;
END $$;

COMMIT;

-- 실행 후 확인용
SELECT id, nickname, employee_id, is_admin
FROM public.users
ORDER BY is_admin DESC, created_at ASC;
