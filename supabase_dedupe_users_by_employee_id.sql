-- ============================================
-- users 테이블 사번 중복 정리 + 중복 방지 인덱스
-- ============================================
-- Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1) 중복 사번 현황 확인
select
  employee_id,
  count(*) as duplicate_count
from users
where employee_id is not null
  and btrim(employee_id) <> ''
group by employee_id
having count(*) > 1
order by duplicate_count desc, employee_id asc;

-- 2) 공백 사번 정리
update users
set employee_id = nullif(btrim(employee_id), '')
where employee_id is not null;

-- 3) 중복 삭제 (각 사번당 1명만 유지)
--    우선순위: 관리자 > 최근 생성 > 큰 id
with ranked as (
  select
    id,
    employee_id,
    row_number() over (
      partition by employee_id
      order by is_admin desc, created_at desc nulls last, id desc
    ) as rn
  from users
  where employee_id is not null
    and employee_id <> ''
)
delete from users u
using ranked r
where u.id = r.id
  and r.rn > 1;

-- 4) 이후 중복 방지 (부분 유니크 인덱스)
create unique index if not exists users_employee_id_unique_idx
on users (employee_id)
where employee_id is not null
  and employee_id <> '';
