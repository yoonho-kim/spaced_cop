-- ============================================
-- Space D - 회원가입을 위한 RLS 정책 추가
-- ============================================

-- 0. 기존 완화 정책 제거
DROP POLICY IF EXISTS "Enable insert for authentication" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "users_insert_signup_non_admin" ON users;
DROP POLICY IF EXISTS "users_select_authenticated_only" ON users;

-- 1. users INSERT 정책 (회원가입 허용 + 관리자 계정 생성 차단)
CREATE POLICY "users_insert_signup_non_admin"
ON users FOR INSERT TO anon, authenticated
WITH CHECK (COALESCE(is_admin, false) = false);

-- 2. users SELECT 정책 (로그인 사용자로 제한)
CREATE POLICY "users_select_authenticated_only"
ON users FOR SELECT TO authenticated
USING (true);

-- 3. 스토리지 버킷 정책 (아이콘 업로드용 - 필요한 경우)
-- insert into storage.buckets (id, name, public) values ('profiles', 'profiles', true);
-- create policy "Avatar images are publicly accessible." on storage.objects for select using ( bucket_id = 'profiles' );
-- create policy "Anyone can upload an avatar." on storage.objects for insert with check ( bucket_id = 'profiles' );
