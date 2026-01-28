-- ============================================
-- Space D - 회원가입을 위한 RLS 정책 추가
-- ============================================

-- 1. users 테이블의 INSERT 정책 추가 (누구나 회원가입 가능하도록)
-- 기존 정책이 있다면 충돌할 수 있으므로, 기존 정책 확인 후 실행 권장
-- DROP POLICY IF EXISTS "Enable insert for authentication" ON users;

CREATE POLICY "Enable insert for authentication" 
ON users FOR INSERT 
WITH CHECK (true);

-- 2. users 테이블의 SELECT 정책 확인 (이미 있다면 생략 가능)
-- (내 정보만 볼 수 있게 하거나, 로그인 시 확인을 위해 필요)
CREATE POLICY "Enable read access for all users" 
ON users FOR SELECT 
USING (true);

-- 3. 스토리지 버킷 정책 (아이콘 업로드용 - 필요한 경우)
-- insert into storage.buckets (id, name, public) values ('profiles', 'profiles', true);
-- create policy "Avatar images are publicly accessible." on storage.objects for select using ( bucket_id = 'profiles' );
-- create policy "Anyone can upload an avatar." on storage.objects for insert with check ( bucket_id = 'profiles' );
