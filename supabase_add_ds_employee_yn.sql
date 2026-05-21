-- ============================================
-- Space D - users 테이블 DS직원 여부 컬럼 추가
-- ============================================
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS ds_employee_yn VARCHAR(1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_ds_employee_yn_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_ds_employee_yn_check
    CHECK (ds_employee_yn IN ('Y', 'N') OR ds_employee_yn IS NULL);
  END IF;
END $$;

COMMENT ON COLUMN users.ds_employee_yn IS 'DS직원 여부: Y, N, NULL';
