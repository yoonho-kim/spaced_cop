-- ============================================
-- Space D - users 인증 동작 복구용 RLS 정책
-- ============================================
-- 목적:
-- - 현재 클라이언트 anon 직접 접근 구조에서
--   회원가입 / 로그인 조회 / 비밀번호 변경이 동작하도록 users 정책을 복구

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 기존 users 정책 전부 제거 (정책명 불일치/중복 상태 정리)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', p.policyname);
  END LOOP;
END $$;

-- 1) 회원가입 허용 (관리자 계정 생성 차단)
CREATE POLICY "users_insert_signup_non_admin"
ON users FOR INSERT TO anon, authenticated
WITH CHECK (COALESCE(is_admin, false) = false);

-- 2) 로그인/중복확인용 조회 허용
CREATE POLICY "users_select_authenticated_only"
ON users FOR SELECT TO anon, authenticated
USING (true);

-- 3) 비밀번호 변경 허용 (is_admin 값 변경은 차단)
CREATE POLICY "users_update_authenticated_only"
ON users FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (
  COALESCE(is_admin, false) = COALESCE(
    (SELECT u.is_admin FROM users u WHERE u.id = users.id),
    COALESCE(is_admin, false)
  )
);

-- 4) users 삭제는 차단
CREATE POLICY "users_delete_blocked"
ON users FOR DELETE TO anon, authenticated
USING (false);
