-- ============================================
-- Space D - users 테이블 호칭(honorifics) 컬럼 추가
-- ============================================
-- 관리자 사용자 기본정보 수정에서 사용하는 호칭 배열 컬럼입니다.
-- 프론트/서버에서 한글 1~4글자, 최대 2개를 검증하며
-- DB에서는 개수 제한(최대 2개)을 체크합니다.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS honorifics TEXT[] DEFAULT '{}'::text[];

-- 기존 null 데이터 정리
UPDATE users
SET honorifics = '{}'::text[]
WHERE honorifics IS NULL;

-- 최대 2개 제한 체크 제약
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
