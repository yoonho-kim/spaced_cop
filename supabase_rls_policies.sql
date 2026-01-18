-- ============================================
-- Row Level Security (RLS) 정책 설정
-- ============================================

-- 모든 테이블에 대해 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 개발 환경용 정책 (모든 사용자에게 읽기/쓰기 허용)
-- ============================================

-- Posts
CREATE POLICY "Enable all access for posts" ON posts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for post_likes" ON post_likes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for post_comments" ON post_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Meeting Rooms
CREATE POLICY "Enable all access for meeting_rooms" ON meeting_rooms
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for meeting_reservations" ON meeting_reservations
  FOR ALL USING (true) WITH CHECK (true);

-- Volunteer Activities
CREATE POLICY "Enable all access for volunteer_activities" ON volunteer_activities
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for volunteer_registrations" ON volunteer_registrations
  FOR ALL USING (true) WITH CHECK (true);

-- Supply Requests
CREATE POLICY "Enable all access for supply_requests" ON supply_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Users
CREATE POLICY "Enable all access for users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 운영 환경용 정책 (예시 - 필요시 사용)
-- ============================================

/*
-- 위의 개발용 정책을 삭제하고 아래 정책으로 교체하세요

-- Posts: 모든 사용자가 읽을 수 있고, 작성자만 수정/삭제 가능
DROP POLICY IF EXISTS "Enable all access for posts" ON posts;
CREATE POLICY "Enable read access for all users" ON posts
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Enable update for post owners" ON posts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for post owners" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- Post Likes: 모든 사용자가 읽을 수 있고, 인증된 사용자만 추가/삭제 가능
DROP POLICY IF EXISTS "Enable all access for post_likes" ON post_likes;
CREATE POLICY "Enable read access for all users" ON post_likes
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Enable delete for like owners" ON post_likes
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Meeting Reservations: 모든 사용자가 읽을 수 있고, 예약자만 삭제 가능
DROP POLICY IF EXISTS "Enable all access for meeting_reservations" ON meeting_reservations;
CREATE POLICY "Enable read access for all users" ON meeting_reservations
  FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON meeting_reservations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Enable delete for reservation owners" ON meeting_reservations
  FOR DELETE USING (auth.uid() IS NOT NULL);
*/
