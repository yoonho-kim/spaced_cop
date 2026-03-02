-- ============================================
-- Space D - 기존 users 테이블에 컬럼 추가 SQL
-- ============================================
-- 이 SQL을 Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. 성향 질문 답변 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS personality_time VARCHAR(50),
ADD COLUMN IF NOT EXISTS personality_feeling VARCHAR(50),
ADD COLUMN IF NOT EXISTS personality_place VARCHAR(50);

-- 2. AI 생성 프로필 아이콘 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_icon_url TEXT,
ADD COLUMN IF NOT EXISTS profile_icon_prompt TEXT;

-- 3. 비밀번호 해시 컬럼 추가 (없는 경우)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 4. 사번 컬럼 추가 (없는 경우)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(20);

-- 5. 성별 컬럼 추가 (없는 경우)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- 6. 사용자 호칭 컬럼 추가 (없는 경우, 최대 2개)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS honorifics TEXT[] DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_honorifics_max_two'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_honorifics_max_two
    CHECK (cardinality(honorifics) <= 2);
  END IF;
END $$;

-- 7. 사번 중복 방지 인덱스
-- 기존 중복 데이터가 있으면 실패할 수 있으니, 필요 시
-- supabase_dedupe_users_by_employee_id.sql을 먼저 실행하세요.
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_unique_idx
ON users(employee_id)
WHERE employee_id IS NOT NULL
  AND employee_id <> '';

-- ============================================
-- 기존 테이블 구조 확인용 쿼리
-- ============================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
