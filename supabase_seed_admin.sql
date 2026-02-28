-- SECURITY NOTE:
-- 예측 가능한 기본 관리자 계정/비밀번호는 절대 시드하지 않습니다.
-- (예: admin / 1234 / 0000 / 고정 해시값)

-- 1) 권장 방식: 이미 생성된 사용자 계정을 관리자 권한으로 승격
--    아래 닉네임을 실제 운영 관리자 계정으로 바꾼 뒤 실행하세요.
UPDATE users
SET is_admin = true
WHERE nickname = 'replace_with_real_admin_nickname';

-- 2) 비밀번호를 DB에서 직접 갱신해야 할 경우
--    반드시 강한 비밀번호 정책을 만족하는 PBKDF2 해시를 생성해 수동으로 입력하세요.
--    (고정값/예제값 사용 금지)
--
-- UPDATE users
-- SET password_hash = 'pbkdf2_sha256$210000$<base64_salt>$<base64_hash>'
-- WHERE nickname = 'replace_with_real_admin_nickname';
