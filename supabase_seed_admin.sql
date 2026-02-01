-- 1. 관리자(admin) 계정이 이미 존재하는지 확인 후, 없다면 추가합니다.
-- 비밀번호 해시는 'admin' 문자열을 SHA-256으로 해싱한 값입니다: 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
-- (직접 만든 hashPassword 함수와 동일한 로직입니다)

INSERT INTO users (
    nickname, 
    password_hash, 
    is_admin, 
    employee_id
)
SELECT 
    'admin', 
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 
    true, 
    '000000'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE nickname = 'admin'
);

-- 2. 이미 존재하는 계정을 관리자로 승격시키고 싶은 경우 아래 쿼리를 사용하세요:
-- UPDATE users SET is_admin = true WHERE nickname = '원하는닉네임';

-- 3. 기존에 'admin' 계정이 있었는데 비밀번호를 초기화하고 싶은 경우:
-- UPDATE users SET 
--     password_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
--     is_admin = true
-- WHERE nickname = 'admin';
