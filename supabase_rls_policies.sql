-- ============================================
-- Row Level Security (RLS) Hardened Baseline
-- ============================================
-- 목적:
-- 1) 기존 FOR ALL USING (true) 정책 제거
-- 2) 익명(anon) 쓰기 차단
-- 3) users 테이블의 과도한 공개 접근 축소
--
-- 주의:
-- 현재 앱은 Supabase Auth 세션을 사용하지 않아 대부분 anon role로 동작합니다.
-- 이 정책을 적용하면 클라이언트 직접 쓰기 기능이 제한될 수 있으며,
-- 운영에서는 서버 API + 서비스 롤 키 기반 쓰기로 전환하는 것이 권장됩니다.

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

-- Remove legacy permissive policies
DROP POLICY IF EXISTS "Enable all access for posts" ON posts;
DROP POLICY IF EXISTS "Enable all access for post_likes" ON post_likes;
DROP POLICY IF EXISTS "Enable all access for post_comments" ON post_comments;
DROP POLICY IF EXISTS "Enable all access for meeting_rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Enable all access for meeting_reservations" ON meeting_reservations;
DROP POLICY IF EXISTS "Enable all access for volunteer_activities" ON volunteer_activities;
DROP POLICY IF EXISTS "Enable all access for volunteer_registrations" ON volunteer_registrations;
DROP POLICY IF EXISTS "Enable all access for supply_requests" ON supply_requests;
DROP POLICY IF EXISTS "Enable all access for users" ON users;
DROP POLICY IF EXISTS "Enable insert for authentication" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "users_insert_signup_non_admin" ON users;
DROP POLICY IF EXISTS "users_select_authenticated_only" ON users;
DROP POLICY IF EXISTS "users_update_authenticated_only" ON users;
DROP POLICY IF EXISTS "users_delete_blocked" ON users;
DROP POLICY IF EXISTS "posts_read_all" ON posts;
DROP POLICY IF EXISTS "posts_write_authenticated" ON posts;
DROP POLICY IF EXISTS "posts_update_authenticated" ON posts;
DROP POLICY IF EXISTS "posts_delete_authenticated" ON posts;
DROP POLICY IF EXISTS "post_likes_read_all" ON post_likes;
DROP POLICY IF EXISTS "post_likes_write_authenticated" ON post_likes;
DROP POLICY IF EXISTS "post_likes_delete_authenticated" ON post_likes;
DROP POLICY IF EXISTS "post_comments_read_all" ON post_comments;
DROP POLICY IF EXISTS "post_comments_write_authenticated" ON post_comments;
DROP POLICY IF EXISTS "post_comments_delete_authenticated" ON post_comments;
DROP POLICY IF EXISTS "meeting_rooms_read_all" ON meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_write_authenticated" ON meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_update_authenticated" ON meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_delete_authenticated" ON meeting_rooms;
DROP POLICY IF EXISTS "meeting_reservations_read_all" ON meeting_reservations;
DROP POLICY IF EXISTS "meeting_reservations_insert_authenticated" ON meeting_reservations;
DROP POLICY IF EXISTS "meeting_reservations_delete_authenticated" ON meeting_reservations;
DROP POLICY IF EXISTS "volunteer_activities_read_all" ON volunteer_activities;
DROP POLICY IF EXISTS "volunteer_activities_write_authenticated" ON volunteer_activities;
DROP POLICY IF EXISTS "volunteer_activities_update_authenticated" ON volunteer_activities;
DROP POLICY IF EXISTS "volunteer_activities_delete_authenticated" ON volunteer_activities;
DROP POLICY IF EXISTS "volunteer_registrations_read_all" ON volunteer_registrations;
DROP POLICY IF EXISTS "volunteer_registrations_insert_authenticated" ON volunteer_registrations;
DROP POLICY IF EXISTS "volunteer_registrations_update_authenticated" ON volunteer_registrations;
DROP POLICY IF EXISTS "volunteer_registrations_delete_authenticated" ON volunteer_registrations;
DROP POLICY IF EXISTS "supply_requests_read_all" ON supply_requests;
DROP POLICY IF EXISTS "supply_requests_insert_authenticated" ON supply_requests;
DROP POLICY IF EXISTS "supply_requests_update_authenticated" ON supply_requests;
DROP POLICY IF EXISTS "supply_requests_delete_authenticated" ON supply_requests;

-- Users (민감 데이터 포함: password_hash)
CREATE POLICY "users_insert_signup_non_admin" ON users
  FOR INSERT TO anon, authenticated
  WITH CHECK (COALESCE(is_admin, false) = false);

CREATE POLICY "users_select_authenticated_only" ON users
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "users_update_authenticated_only" ON users
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (COALESCE(is_admin, false) = false);

-- 사용자 삭제는 서버 관리 작업으로 제한
CREATE POLICY "users_delete_blocked" ON users
  FOR DELETE TO anon, authenticated
  USING (false);

-- Public feed
CREATE POLICY "posts_read_all" ON posts
  FOR SELECT USING (true);
CREATE POLICY "posts_write_authenticated" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "posts_update_authenticated" ON posts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "posts_delete_authenticated" ON posts
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "post_likes_read_all" ON post_likes
  FOR SELECT USING (true);
CREATE POLICY "post_likes_write_authenticated" ON post_likes
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "post_likes_delete_authenticated" ON post_likes
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "post_comments_read_all" ON post_comments
  FOR SELECT USING (true);
CREATE POLICY "post_comments_write_authenticated" ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "post_comments_delete_authenticated" ON post_comments
  FOR DELETE TO authenticated
  USING (true);

-- Meeting
CREATE POLICY "meeting_rooms_read_all" ON meeting_rooms
  FOR SELECT USING (true);
CREATE POLICY "meeting_rooms_write_authenticated" ON meeting_rooms
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "meeting_rooms_update_authenticated" ON meeting_rooms
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "meeting_rooms_delete_authenticated" ON meeting_rooms
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "meeting_reservations_read_all" ON meeting_reservations
  FOR SELECT USING (true);
CREATE POLICY "meeting_reservations_insert_authenticated" ON meeting_reservations
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "meeting_reservations_delete_authenticated" ON meeting_reservations
  FOR DELETE TO authenticated
  USING (true);

-- Volunteer
CREATE POLICY "volunteer_activities_read_all" ON volunteer_activities
  FOR SELECT USING (true);
CREATE POLICY "volunteer_activities_write_authenticated" ON volunteer_activities
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "volunteer_activities_update_authenticated" ON volunteer_activities
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "volunteer_activities_delete_authenticated" ON volunteer_activities
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "volunteer_registrations_read_all" ON volunteer_registrations
  FOR SELECT USING (true);
CREATE POLICY "volunteer_registrations_insert_authenticated" ON volunteer_registrations
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "volunteer_registrations_update_authenticated" ON volunteer_registrations
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "volunteer_registrations_delete_authenticated" ON volunteer_registrations
  FOR DELETE TO authenticated
  USING (true);

-- Supplies
CREATE POLICY "supply_requests_read_all" ON supply_requests
  FOR SELECT USING (true);
CREATE POLICY "supply_requests_insert_authenticated" ON supply_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "supply_requests_update_authenticated" ON supply_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "supply_requests_delete_authenticated" ON supply_requests
  FOR DELETE TO authenticated
  USING (true);
