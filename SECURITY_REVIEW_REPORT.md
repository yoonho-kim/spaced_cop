# Space D 정보보안성 검토 및 시큐어코딩 보고서

| 항목 | 내용 |
|---|---|
| 프로젝트 | Space D (`/Users/uno/Documents/study/cl_spaced_demo`) |
| 검토일 | 2026-02-26 |
| 검토 방식 | 정적 코드 리뷰 (소스/SQL/배포 설정 기반) |
| 범위 | React/Vite 프론트엔드, Vercel API, Supabase SQL/RLS, 환경변수 사용 패턴 |

## 1. 총괄 요약

본 프로젝트는 프론트엔드에서 Supabase에 직접 접근하는 구조이며, 현재 저장소의 SQL 기준으로 RLS가 `FOR ALL USING (true)` 형태로 설정되어 있어 DB 레벨 접근통제가 사실상 비활성화되어 있습니다. 또한 인증/인가, 비밀번호 처리, API 보호가 클라이언트 신뢰에 크게 의존하고 있어 운영 환경 기준으로는 즉시 보완이 필요합니다.

| 심각도 | 건수 |
|---|---:|
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 2 |
| 합계 | 14 |

## 2. 주요 취약점 상세

### CRITICAL-01. RLS 정책 무력화로 인한 전체 데이터 무단 접근 가능
- 근거:
  - `supabase_rls_policies.sql:21-50` (`posts`, `users`, `meeting_*`, `volunteer_*`, `supply_requests`에 `FOR ALL USING (true)`)
  - `supabase_event_settings.sql:24-25` (`app_event_settings` 전체 허용)
  - `supabase_event_entries.sql:21-22` (`app_event_entries` 전체 허용)
  - `supabase_recurring_rules.sql:29` (`meeting_recurring_rules` 전체 허용)
- 영향:
  - Anon Key를 가진 누구나 테이블 CRUD 수행 가능.
  - 사용자 정보/게시물/예약/봉사 데이터 변조 및 삭제 가능.
- 권고:
  - 운영용 RLS로 즉시 전환(`auth.uid()` 기반 사용자 소유권, 관리자 역할 분리).
  - 관리자 쓰기 작업은 서버 함수(Service Role)로 이관.

### CRITICAL-02. 클라이언트 신뢰 기반 인증/인가 (권한 위조 가능)
- 근거:
  - `src/utils/auth.js:302-305` (`isAdmin()`이 localStorage 세션값 신뢰)
  - `src/App.jsx:22-25` (`getCurrentUser()` 기반 클라이언트 세션 복원)
  - `src/pages/MainLayout.jsx:23`, `src/pages/MainLayout.jsx:234-236` (클라이언트 판단으로 관리자 탭 노출)
  - `src/utils/storage.js`의 관리자성 작업들(`addMeetingRoom`, `deleteMeetingRoom`, `updateVolunteerRegistration`, `deleteVolunteerActivity` 등)에 서버측 인가 부재
- 영향:
  - localStorage 조작 또는 직접 API 호출로 권한 상승 시도 가능.
  - RLS가 완화된 상태와 결합 시 전체 기능 장악 위험.
- 권고:
  - Supabase Auth/JWT 기반 서버측 인가로 전환.
  - 관리자 기능은 서버 API에서 토큰 검증 후 수행.

### CRITICAL-03. 비밀번호 처리 취약 (클라이언트 SHA-256 + salt 없음)
- 근거:
  - `src/utils/auth.js:41-47` (SHA-256 단일 해시)
  - `src/utils/auth.js:138-151` (`users` 조회 후 클라이언트에서 해시 비교)
  - `src/utils/auth.js:77-81` (DB에 `password_hash` 직접 저장)
  - `supabase_rls_policy.sql:15-17` (`users` 조회 전체 허용 정책 스크립트 존재)
- 영향:
  - 해시 유출 시 오프라인 크래킹이 매우 쉬움.
  - salt 부재로 동일 비밀번호 식별 및 사전공격 취약.
- 권고:
  - 서버측 `bcrypt/Argon2id`로 전환(권장: Supabase Auth 사용).
  - 클라이언트에서 비밀번호 해시 비교 로직 제거.

### HIGH-01. API 키 클라이언트 노출 (`VITE_*` 비밀 사용)
- 근거:
  - `src/utils/openaiService.js:4`, `src/utils/openaiService.js:39-44` (`VITE_GEMINI_API_KEY` 직접 사용)
  - `src/utils/huggingfaceService.js:6`, `src/utils/huggingfaceService.js:509` (`VITE_HUGGINGFACE_API_KEY` 사용)
  - `vite.config.js:58` (개발 프록시 헤더에 `VITE_HUGGINGFACE_API_KEY`)
- 영향:
  - 브라우저 번들/네트워크를 통해 키 노출 가능.
  - 외부 무단 호출 및 비용 과금 위험.
- 권고:
  - 비밀키는 서버 환경변수만 사용(클라이언트에서 제거).
  - 클라이언트는 인증된 내부 API만 호출.

### HIGH-02. 주요 서버 API 인증 부재
- 근거:
  - `api/gemini.js`, `api/huggingface.js`, `api/event-image-upload.js`, `api/event-image-delete.js`에 사용자 인증 검증 로직 없음
  - 대비: `api/volunteer-auto-lottery.js:79-82`는 Cron Secret 검증 존재
- 영향:
  - 익명 사용자의 API 오남용, 비용 폭증, 데이터 손상 가능.
- 권고:
  - API 공통 인증 미들웨어(예: Supabase JWT verify) 적용.
  - 엔드포인트별 권한 모델 정의(일반/관리자).

### HIGH-03. Blob 삭제 API의 임의 파일 삭제 가능성
- 근거:
  - `api/event-image-delete.js:50-55` (도메인 포함 여부만 검사)
  - `api/event-image-delete.js:57-59` (`del(pathString)` 직접 실행)
- 영향:
  - 경로를 알면 다른 Blob 객체 삭제 가능(무결성 훼손).
- 권고:
  - 인증 + 소유권/관리자 검증 필수.
  - 허용 prefix(`event_img/`) 검증 및 서버 저장 메타데이터 대조.

### HIGH-04. 과도한 CORS 허용
- 근거:
  - `api/huggingface.js:5-6`
  - `api/gemini.js:5-6`
  - `api/event-image-upload.js:5-6`
  - `api/event-image-delete.js:5-6`
  - `api/volunteer-auto-lottery.js:46-47`
  - 공통적으로 `Access-Control-Allow-Origin: *`
- 영향:
  - 외부 도메인에서 API 호출 남용 가능.
- 권고:
  - 허용 Origin 화이트리스트 적용.
  - 필요시 `credentials` 비활성화.

### HIGH-05. Rate Limit 부재로 API/비용 자원 고갈 위험
- 근거:
  - 모든 `api/*.js`에 호출 빈도 제한 없음
  - 특히 이미지 생성/업로드/삭제 API가 고비용 또는 파괴적 작업
- 영향:
  - 서비스 거부(DoS), 비용 급증, 운영 장애.
- 권고:
  - IP/사용자 단위 rate limit 도입(예: Edge Middleware + KV).

### MEDIUM-01. 기본/약한 관리자 자격정보 흔적
- 근거:
  - `src/utils/storage.js:12-13` (`spaced_admin_password = '1234'` 저장)
  - `supabase_seed_admin.sql:2`, `supabase_seed_admin.sql:12-15` (예측 가능한 admin 시드)
- 영향:
  - 운영 혼선 및 오구성 시 즉시 계정 탈취 위험.
- 권고:
  - 기본 자격정보 완전 제거.
  - 초기 관리자 생성/비밀번호 변경 강제 플로우 도입.

### MEDIUM-02. 비밀번호 정책 약함
- 근거:
  - `src/components/SignUpModal.jsx:184-186` (최소 4자)
  - `src/components/ChangePasswordModal.jsx:60-62` (최소 4자)
- 영향:
  - 추측/사전 대입 공격 성공률 증가.
- 권고:
  - 최소 8~12자 + 복잡도 정책 + 금지 비밀번호 목록 적용.

### MEDIUM-03. 입력 검증/형식 검증 부족
- 근거:
  - `api/gemini.js:31-35` (`model`, `body` 존재 여부만 확인)
  - 다수 CRUD 함수(`src/utils/storage.js`)에서 길이/형식/범위 검증 미흡
- 영향:
  - 비정상 데이터 저장, 운영 안정성 저하, 우회성 공격면 증가.
- 권고:
  - 서버 스키마 검증(zod/joi) 도입.
  - 길이, enum, 타입, 허용 문자셋 일관 검증.

### MEDIUM-04. 개인정보(사번) 노출 범위 과다
- 근거:
  - `src/utils/storage.js:315-317` (`employee_id` 조회)
  - `src/pages/Feed.jsx:678` (프로필에 사번 표시)
  - `src/pages/Volunteer.jsx:242-244` (랭킹에 사번 노출)
- 영향:
  - 내부자 개인정보 최소수집/최소노출 원칙 위반 가능.
- 권고:
  - 사번은 관리자/본인만 조회 가능하도록 제한.
  - 화면 노출은 마스킹 처리.

### LOW-01. 보안 헤더/CSP 미설정
- 근거:
  - `vercel.json`에 `headers` 정책 부재
  - `index.html`에 CSP 메타/헤더 부재
- 영향:
  - XSS/클릭재킹/콘텐츠 스니핑 방어력 저하.
- 권고:
  - `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` 적용.

### LOW-02. 상세 오류 메시지 외부 노출
- 근거:
  - `api/huggingface.js:64`, `api/gemini.js:55` (`error.message` 직접 응답)
  - 환경변수 구성 노출 메시지 다수 (`api/gemini.js:28`, `api/volunteer-auto-lottery.js:90-91`)
- 영향:
  - 내부 구조/설정 정보 노출.
- 권고:
  - 외부 응답은 일반화된 오류 메시지 사용, 상세는 서버 로그로만 기록.

## 3. 시큐어코딩 점검 결과

| 영역 | 평가 | 코멘트 |
|---|---|---|
| 입력값 검증 | 미흡 | 서버측 검증 계층 부재, 프론트 의존 |
| 출력값 인코딩/XSS | 양호 | React 렌더링 기반, 위험 API 사용 흔적 적음 |
| 인증/인가 | 미흡 | 클라이언트 신뢰 + RLS 완화 정책 |
| 암호화/비밀번호 | 미흡 | SHA-256 단일 해시, salt 없음 |
| 세션 관리 | 미흡 | localStorage 기반 권한 상태 저장 |
| 비밀정보 관리 | 미흡 | `VITE_*` 키 사용으로 클라이언트 노출 |
| API 보안 | 미흡 | 인증·rate limit·CORS 제한 부족 |
| 로깅/오류 처리 | 보통 | 에러 상세 외부 노출 일부 존재 |

## 4. 우선 조치 로드맵

### 24시간 이내
1. Supabase 운영용 RLS 정책 즉시 적용 (`FOR ALL true` 제거).
2. 외부 노출 API(`gemini`, `huggingface`, `event-image-*`)에 인증 미들웨어 적용.
3. 클라이언트의 `VITE_GEMINI_API_KEY`, `VITE_HUGGINGFACE_API_KEY` 사용 제거.

### 7일 이내
1. 인증 구조를 Supabase Auth/JWT 기반으로 전환.
2. 비밀번호 저장 방식을 서버측 `bcrypt/Argon2id`로 교체.
3. Blob 삭제 로직에 prefix/소유권 검증 및 감사로그 추가.
4. CORS 화이트리스트 + Rate Limit 도입.

### 30일 이내
1. 서버 입력 검증 레이어(zod/joi) 전면 적용.
2. 개인정보(사번) 최소노출 정책과 화면 마스킹 적용.
3. 보안 헤더/CSP 표준 정책 배포.

## 5. 양호 사항

- `.env`가 `.gitignore`에 포함되어 기본적인 키 파일 추적 방지 설정은 존재.
- `src/utils/storage.js:141-143`, `api/event-image-upload.js:61-63` 등 업로드 용량 제한 구현.
- 파일명 새니타이징(`api/event-image-upload.js:56`) 적용.
- Cron 엔드포인트 인증 개념(`api/volunteer-auto-lottery.js:79-82`)은 존재.

## 6. 검토 한계

- 동적 침투 테스트(실서버 대상) 및 실제 Supabase 콘솔 정책 반영 상태 검증은 본 검토에 포함되지 않음.
- 본 문서는 저장소 내 코드/SQL 파일 기준의 보안 상태를 평가함.

