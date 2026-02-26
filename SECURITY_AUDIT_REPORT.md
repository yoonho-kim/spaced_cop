# Space D - 정보보안성 검토 및 시큐어코딩 보고서

| 항목 | 내용 |
|------|------|
| **프로젝트명** | Space D (사내 오피스 관리 플랫폼) |
| **검토일** | 2026-02-26 |
| **검토 범위** | 프론트엔드(React), 백엔드 API(Vercel Serverless), DB(Supabase), 인프라 설정 |
| **기술 스택** | React 19 + Vite 7, Supabase(PostgreSQL), Vercel Serverless Functions, Vercel Blob Storage |

---

## 1. 총괄 요약 (Executive Summary)

본 보고서는 Space D 프로젝트에 대한 정보보안성 검토 결과를 담고 있습니다. OWASP Top 10, 행정안전부 시큐어코딩 가이드, 그리고 일반적인 웹 애플리케이션 보안 모범사례를 기준으로 분석하였습니다.

### 발견 현황

| 심각도 | 건수 | 설명 |
|--------|------|------|
| **CRITICAL** | 2건 | 즉시 조치 필요 - 비밀번호 해시 취약, 기본 관리자 비밀번호 |
| **HIGH** | 5건 | 1주 내 조치 필요 - CORS, 클라이언트 인증, API 보안 |
| **MEDIUM** | 7건 | 1개월 내 조치 필요 - 입력 검증, 세션 관리, CSRF 등 |
| **LOW** | 4건 | 개선 권장 - 보안 헤더, 로깅 정리 |
| **INFO** | 2건 | 참고 사항 |
| **합계** | **20건** | |

### 위험도 평가 차트

```
CRITICAL ████████████████████ 2건
HIGH     ██████████████████████████████████████████████████ 5건
MEDIUM   ██████████████████████████████████████████████████████████████████████ 7건
LOW      ████████████████████████████████████████ 4건
INFO     ████████████████████ 2건
```

---

## 2. 상세 취약점 분석

---

### CRITICAL-01: 취약한 비밀번호 해시 알고리즘 (CWE-916)

| 항목 | 내용 |
|------|------|
| **심각도** | CRITICAL |
| **위치** | `src/utils/auth.js:41-47` |
| **OWASP** | A02:2021 - Cryptographic Failures |
| **CWE** | CWE-916 (Use of Password Hash With Insufficient Computational Effort) |

**취약 코드:**
```javascript
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
```

**문제점:**
1. **Salt 미사용**: 동일한 비밀번호는 항상 동일한 해시값을 생성하여 Rainbow Table 공격에 취약
2. **SHA-256은 비밀번호 해싱에 부적합**: 범용 해시 함수로, GPU를 사용하면 초당 수십억 회 연산이 가능하여 무차별 대입(Brute Force)에 취약
3. **클라이언트 사이드 해싱**: 해싱이 브라우저에서 수행되므로, 네트워크 스니핑으로 해시값을 탈취하면 해시 자체가 비밀번호 역할을 함 (Pass-the-Hash)

**실제 위험 시나리오:**
- DB 유출 시: Salt가 없으므로 미리 계산된 SHA-256 Rainbow Table로 대부분의 비밀번호 즉시 복원 가능
- 관리자 시드 파일(`supabase_seed_admin.sql`)에 `admin`의 SHA-256 해시가 하드코딩되어 있어 관리자 비밀번호가 `admin`임을 즉시 확인 가능

**권장 조치:**
```
- 서버사이드에서 bcrypt(cost factor ≥ 12) 또는 Argon2id 사용
- 사용자별 고유 Salt 자동 생성 (bcrypt는 내장)
- Supabase Auth 서비스 활용 검토
```

---

### CRITICAL-02: 하드코딩된 기본 관리자 비밀번호 (CWE-798)

| 항목 | 내용 |
|------|------|
| **심각도** | CRITICAL |
| **위치** | `src/utils/storage.js:12-14`, `supabase_seed_admin.sql:2-3` |
| **OWASP** | A07:2021 - Identification and Authentication Failures |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |

**취약 코드:**
```javascript
// storage.js:12-14
if (!localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD)) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, '1234');
}
```

```sql
-- supabase_seed_admin.sql
-- 비밀번호: 'admin' → SHA-256 해시
INSERT INTO users (nickname, password_hash, is_admin, employee_id)
SELECT 'admin',
       '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
       true, '000000' ...
```

**문제점:**
1. 관리자 기본 비밀번호가 `1234` (localStorage) 및 `admin` (DB)으로 하드코딩
2. 소스코드가 공개되면 누구나 관리자 계정에 즉시 접근 가능
3. SQL 시드 파일에 비밀번호 해시값이 그대로 노출

**권장 조치:**
```
- 초기 배포 시 관리자 비밀번호 강제 변경 플로우 구현
- 기본 비밀번호를 코드에서 완전 제거
- 환경 변수를 통한 초기 비밀번호 설정 또는 이메일 기반 초기화 메커니즘 도입
```

---

### HIGH-01: 과도하게 허용적인 CORS 설정 (CWE-942)

| 항목 | 내용 |
|------|------|
| **심각도** | HIGH |
| **위치** | `api/huggingface.js:4-5`, `api/gemini.js:4-5`, `api/event-image-upload.js:4-5`, `api/event-image-delete.js:4-5`, `api/volunteer-auto-lottery.js:45-46` |
| **OWASP** | A05:2021 - Security Misconfiguration |
| **CWE** | CWE-942 (Permissive Cross-domain Policy) |

**취약 코드 (모든 API 엔드포인트 공통):**
```javascript
response.setHeader('Access-Control-Allow-Credentials', true);
response.setHeader('Access-Control-Allow-Origin', '*');
```

**문제점:**
1. `Access-Control-Allow-Origin: *`는 모든 외부 도메인에서의 API 호출을 허용
2. `Allow-Credentials: true`와 `Origin: *`의 조합은 CORS 명세상 무효이나, 일부 브라우저 구현에 따라 보안 위험 발생 가능
3. 악의적 외부 사이트에서 사용자의 브라우저를 통해 API를 무단 호출 가능

**권장 조치:**
```
- 허용된 Origin을 명시적으로 지정 (예: https://your-domain.vercel.app)
- 환경 변수로 허용 Origin 목록 관리
- Credentials 사용 시 와일드카드(*) 대신 명시적 Origin 사용 필수
```

---

### HIGH-02: 클라이언트 사이드 전용 인증/인가 (CWE-602)

| 항목 | 내용 |
|------|------|
| **심각도** | HIGH |
| **위치** | `src/utils/auth.js:254-274`, `src/utils/auth.js:302-305` |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-602 (Client-Side Enforcement of Server-Side Security) |

**취약 코드:**
```javascript
// 게스트 로그인 - 서버 검증 없음
export const login = async (nickname, password = null) => {
    const user = {
        nickname,
        isAdmin: false,
        isRegistered: false,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };
    setItem(STORAGE_KEYS.USER, user);  // localStorage에 저장
    return { success: true, user };
};

// 관리자 확인 - 클라이언트 측에서만 검증
export const isAdmin = () => {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
};
```

**문제점:**
1. 사용자 세션이 `localStorage`에만 저장되어, 브라우저 개발자도구에서 직접 조작 가능
2. `isAdmin: true`를 수동으로 설정하면 관리자 권한 획득
3. Supabase RLS 정책이 `FOR ALL USING (true)`로 설정되어 DB 수준의 보호도 부재
4. API 엔드포인트(`/api/*`)에 사용자 인증 미들웨어 부재 (cron endpoint 제외)

**실제 위험 시나리오:**
```
1. 브라우저 콘솔에서 실행:
   localStorage.setItem('spaced_user', JSON.stringify({
     nickname: 'hacker', isAdmin: true, isRegistered: true,
     expiresAt: new Date(Date.now() + 999999999).toISOString()
   }));
2. 페이지 새로고침 → 관리자 패널 접근 가능
3. 모든 사용자/봉사활동/게시물 수정/삭제 가능
```

**권장 조치:**
```
- Supabase Auth 또는 서버 사이드 JWT 세션 도입
- 모든 민감한 작업에 서버 사이드 인가 검증 추가
- Supabase RLS 정책을 운영 환경용으로 전환 (supabase_rls_policies.sql 내 주석 처리된 정책 활성화)
```

---

### HIGH-03: API 엔드포인트 인증 부재 (CWE-306)

| 항목 | 내용 |
|------|------|
| **심각도** | HIGH |
| **위치** | `api/huggingface.js`, `api/gemini.js`, `api/event-image-upload.js`, `api/event-image-delete.js` |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-306 (Missing Authentication for Critical Function) |

**문제점:**
1. `/api/huggingface` - 누구나 이미지 생성 API 호출 가능 (비용 발생)
2. `/api/gemini` - 누구나 AI 모델 호출 가능 (비용 발생)
3. `/api/event-image-upload` - 누구나 이미지 업로드 가능 (스토리지 남용)
4. `/api/event-image-delete` - 누구나 이미지 삭제 가능 (데이터 손실)

**권장 조치:**
```
- API 엔드포인트에 Bearer Token 또는 API Key 인증 추가
- Supabase JWT 토큰 검증 미들웨어 구현
- IP 기반 접근 제어 또는 Rate Limiting 적용
```

---

### HIGH-04: SSRF 취약 가능성 - Gemini API 프록시 (CWE-918)

| 항목 | 내용 |
|------|------|
| **심각도** | HIGH |
| **위치** | `api/gemini.js:31-48` |
| **OWASP** | A10:2021 - Server-Side Request Forgery (SSRF) |
| **CWE** | CWE-918 (Server-Side Request Forgery) |

**취약 코드:**
```javascript
const { model, body } = request.body;
// model 값에 대한 검증 없이 URL 구성
const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { ... }
);
```

**문제점:**
1. 사용자가 제공한 `model` 값이 검증 없이 URL에 삽입
2. Path Traversal을 통해 의도하지 않은 API 엔드포인트 호출 가능성
3. 예: `model: "../../other-api-path"` → 다른 Google API 호출 시도

**비교: huggingface.js는 모델 ID 검증이 존재:**
```javascript
// huggingface.js:35 - 정규식으로 모델 ID 검증 (양호)
const isValidModelId = /^[\w.-]+\/[\w.-]+$/.test(requestedModel);
```

**권장 조치:**
```
- 허용된 모델 ID 화이트리스트 적용 (예: ['gemini-pro', 'gemini-pro-vision'])
- 또는 huggingface.js와 동일한 정규식 검증 적용
- URL 인코딩 및 Path Traversal 방지 로직 추가
```

---

### HIGH-05: RLS 정책 미적용 (개발 모드) (CWE-862)

| 항목 | 내용 |
|------|------|
| **심각도** | HIGH |
| **위치** | `supabase_rls_policies.sql:17-50` |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-862 (Missing Authorization) |

**취약 코드:**
```sql
-- 개발 환경용 정책 (모든 사용자에게 읽기/쓰기 허용)
CREATE POLICY "Enable all access for posts" ON posts
  FOR ALL USING (true) WITH CHECK (true);
-- ... 모든 테이블에 동일 적용
```

**문제점:**
1. 9개 테이블 모두 `USING (true) WITH CHECK (true)` 정책 적용
2. Supabase Anon Key를 가진 누구나 모든 데이터에 대해 CRUD 수행 가능
3. Anon Key는 프론트엔드에 노출되므로, 외부 공격자가 직접 Supabase API 호출 가능

**권장 조치:**
```
- supabase_rls_policies.sql 내 주석 처리된 운영 환경용 정책으로 즉시 전환
- 테이블별 세분화된 권한 정책 적용
- 관리자 전용 작업은 Service Role Key를 사용하는 서버사이드 함수로 분리
```

---

### MEDIUM-01: CSRF 보호 미구현 (CWE-352)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | 모든 API 엔드포인트 (`api/*.js`) |
| **OWASP** | A01:2021 - Broken Access Control |
| **CWE** | CWE-352 (Cross-Site Request Forgery) |

**문제점:**
- 상태 변경 API(POST/DELETE)에 CSRF 토큰 미적용
- CORS `Origin: *` 설정과 결합 시 외부 사이트에서 사용자 모르게 API 호출 가능
- 이미지 업로드/삭제, 봉사활동 추첨 등 주요 기능 노출

**권장 조치:**
```
- SameSite=Strict 쿠키 정책 적용
- CSRF 토큰 기반 검증 구현
- 또는 Double-Submit Cookie 패턴 적용
```

---

### MEDIUM-02: Rate Limiting 미구현 (CWE-770)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | 모든 API 엔드포인트 |
| **CWE** | CWE-770 (Allocation of Resources Without Limits) |

**문제점:**
| 엔드포인트 | 위험 |
|-----------|------|
| `/api/huggingface` | 무제한 이미지 생성 → HuggingFace API 비용 폭증 |
| `/api/gemini` | 무제한 AI 호출 → Google API 비용 폭증 |
| `/api/event-image-upload` | 무제한 업로드 → 스토리지 고갈 |
| `/api/event-image-delete` | 무제한 삭제 → 데이터 손실 |

**권장 조치:**
```
- Vercel Edge Middleware를 활용한 IP 기반 Rate Limiting
- 엔드포인트별 차등 제한 (예: 이미지 생성 10회/시간, 업로드 20회/일)
- 429 Too Many Requests 응답 구현
```

---

### MEDIUM-03: 파일 업로드 MIME 타입 검증 우회 가능 (CWE-434)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | `api/event-image-upload.js:51-54` |
| **OWASP** | A04:2021 - Insecure Design |
| **CWE** | CWE-434 (Unrestricted Upload of File with Dangerous Type) |

**취약 코드:**
```javascript
if (!fileType.startsWith('image/')) {
    response.status(400).json({ success: false, error: '이미지 파일만 업로드할 수 있습니다.' });
    return;
}
```

**문제점:**
1. `fileType`이 클라이언트가 보내는 값이므로 조작 가능
2. 서버에서 파일의 실제 매직바이트(File Signature) 검증 미수행
3. 악성 스크립트를 이미지로 위장하여 업로드 가능

**양호 사항:**
- 파일 크기 제한 (3MB) 존재
- 파일명 새니타이징 (`safeName`) 적용
- 랜덤 경로명 생성으로 경로 예측 방지

**권장 조치:**
```
- 파일 매직바이트 검증 추가 (예: file-type 라이브러리 사용)
- 허용 확장자 화이트리스트: jpg, jpeg, png, gif, webp
- Content-Disposition: attachment 헤더 추가
```

---

### MEDIUM-04: 과도한 세션 유지 시간 (CWE-613)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | `src/utils/auth.js:5` |
| **CWE** | CWE-613 (Insufficient Session Expiration) |

**취약 코드:**
```javascript
const SESSION_DURATION = 10 * 60 * 60 * 1000; // 10시간
```

**문제점:**
- 10시간 동안 세션이 유효하여, 공유 단말 환경에서 세션 탈취 위험 증가
- Refresh Token 메커니즘 미구현
- 비활동 타임아웃(Idle Timeout) 미구현

**권장 조치:**
```
- 기본 세션: 1~2시간으로 단축
- Idle Timeout: 30분 비활동 시 자동 로그아웃
- Refresh Token 메커니즘 도입
```

---

### MEDIUM-05: 비밀번호 복잡성 정책 미적용 (CWE-521)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | `src/components/SignUpModal.jsx`, `src/utils/auth.js` |
| **CWE** | CWE-521 (Weak Password Requirements) |

**문제점:**
- 회원가입/비밀번호 변경 시 비밀번호 강도 검증 로직 미구현
- 최소 길이, 대소문자 혼합, 특수문자, 숫자 포함 등 정책 없음
- 관리자 시드 비밀번호가 `admin`으로 매우 취약

**권장 조치:**
```
- 최소 8자 이상, 대문자+소문자+숫자+특수문자 중 3종 이상 조합
- 연속 문자(1234, abcd) 및 일반적인 취약 비밀번호 차단
- 비밀번호 강도 표시기(Strength Meter) UI 추가
```

---

### MEDIUM-06: Cron Secret 타이밍 공격 취약 (CWE-208)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | `api/volunteer-auto-lottery.js:54-58` |
| **CWE** | CWE-208 (Observable Timing Discrepancy) |

**취약 코드:**
```javascript
const isAuthorizedCronRequest = (request, cronSecret) => {
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    return !!cronSecret && !!bearerToken && bearerToken === cronSecret;
    //                                      ^^^^^^^^^^^^^^^^^^^^^^^^
    //                                      일반 문자열 비교 → 타이밍 공격 취약
};
```

**문제점:**
- JavaScript의 `===` 연산자는 상수 시간 비교가 아님
- 응답 시간 차이를 분석하여 토큰 값을 한 글자씩 추론 가능

**권장 조치:**
```javascript
import { timingSafeEqual } from 'crypto';
const isAuthorized = timingSafeEqual(
    Buffer.from(bearerToken), Buffer.from(cronSecret)
);
```

---

### MEDIUM-07: 환경변수 설정 상태 정보 노출 (CWE-209)

| 항목 | 내용 |
|------|------|
| **심각도** | MEDIUM |
| **위치** | `api/gemini.js:28`, `api/event-image-upload.js:39`, `api/volunteer-auto-lottery.js:75,88-91` |
| **CWE** | CWE-209 (Information Exposure Through Error Message) |

**취약 코드:**
```javascript
// gemini.js
if (!API_KEY) {
    return response.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
}
// volunteer-auto-lottery.js
response.status(500).json({
    error: 'VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.',
});
```

**문제점:**
- 서버 내부 구성 정보(환경변수 이름)가 외부 클라이언트에 노출
- 공격자에게 서버 구성 및 사용 중인 서비스에 대한 정보 제공

**권장 조치:**
```
- 클라이언트 응답: "서버 오류가 발생했습니다." (일반적인 메시지)
- 서버 로그: 상세 에러 정보 기록 (console.error 또는 모니터링 서비스)
```

---

### LOW-01: 보안 응답 헤더 미설정 (CWE-693)

| 항목 | 내용 |
|------|------|
| **심각도** | LOW |
| **위치** | 모든 API 엔드포인트 |
| **CWE** | CWE-693 (Protection Mechanism Failure) |

**누락된 보안 헤더:**

| 헤더 | 목적 | 권장 값 |
|------|------|---------|
| `X-Content-Type-Options` | MIME 스니핑 방지 | `nosniff` |
| `X-Frame-Options` | 클릭재킹 방지 | `DENY` |
| `Strict-Transport-Security` | HTTPS 강제 | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | XSS/인젝션 방지 | 정책에 맞게 설정 |
| `X-XSS-Protection` | 레거시 XSS 필터 | `1; mode=block` |

---

### LOW-02: 프로덕션 환경 콘솔 로깅 (CWE-532)

| 항목 | 내용 |
|------|------|
| **심각도** | LOW |
| **위치** | 전체 소스코드 (13개 파일, 89개 구문) |
| **CWE** | CWE-532 (Insertion of Sensitive Information into Log File) |

**문제점:**
- 89개의 `console.log/error/warn` 구문이 프로덕션 빌드에 포함
- 브라우저 개발자도구에서 에러 상세 정보, DB 스키마 정보 등이 노출될 수 있음

**영향 파일:**
| 파일 | 건수 |
|------|------|
| `src/utils/auth.js` | 15건 |
| `src/utils/newsService.js` | 6건 |
| `src/utils/storage.js` | 50건 |
| `src/utils/openaiService.js` | 4건 |
| `src/utils/huggingfaceService.js` | 3건 |
| 기타 8개 파일 | 11건 |

**권장 조치:**
```
- Vite 빌드 설정에서 console 구문 자동 제거: esbuild.drop: ['console']
- 또는 환경별 로깅 레벨 관리 라이브러리 도입
```

---

### LOW-03: localStorage에 민감 정보 저장 (CWE-922)

| 항목 | 내용 |
|------|------|
| **심각도** | LOW |
| **위치** | `src/utils/storage.js:40-47`, `src/utils/auth.js:167` |
| **CWE** | CWE-922 (Insecure Storage of Sensitive Information) |

**문제점:**
- 사용자 세션 정보(닉네임, 관리자 여부, 사번 등)가 localStorage에 저장
- XSS 공격 시 localStorage 전체 데이터 탈취 가능
- 브라우저 동기화 기능을 통해 의도하지 않은 장치에서 세션 노출 가능

**권장 조치:**
```
- HttpOnly, Secure, SameSite 쿠키로 세션 관리 전환
- 또는 Supabase Auth의 내장 세션 관리 활용
```

---

### LOW-04: 에러 응답 내 스택 트레이스 노출 가능 (CWE-209)

| 항목 | 내용 |
|------|------|
| **심각도** | LOW |
| **위치** | `api/huggingface.js:64`, `api/gemini.js:55` |
| **CWE** | CWE-209 (Information Exposure Through Error Message) |

**취약 코드:**
```javascript
// huggingface.js:64
return response.status(500).json({ error: error.message });

// gemini.js:55
return response.status(500).json({ error: error.message });
```

**문제점:**
- `error.message`에 내부 구현 세부 정보, 파일 경로, 스택 정보가 포함될 수 있음

**권장 조치:**
```
- 클라이언트: 일반적인 에러 메시지 반환
- 서버: error.message + error.stack을 서버 로그에만 기록
```

---

### INFO-01: XSS 방어 (양호)

| 항목 | 내용 |
|------|------|
| **심각도** | INFO (양호 사항) |
| **위치** | 전체 프론트엔드 |

**양호 사항:**
- `dangerouslySetInnerHTML` 사용 없음
- `innerHTML` 직접 조작 없음
- React의 기본 XSS 방어 메커니즘(자동 이스케이핑) 활용
- `eval()`, `new Function()` 등 위험한 함수 사용 없음

---

### INFO-02: .env 파일 관리 (양호)

| 항목 | 내용 |
|------|------|
| **심각도** | INFO (양호 사항) |
| **위치** | `.gitignore`, `.env`, `.env.example` |

**양호 사항:**
- `.env` 파일이 `.gitignore`에 포함되어 git 추적에서 제외됨
- `.env.example` 파일에 실제 키 값이 포함되지 않음
- git 이력에 `.env` 파일이 커밋된 기록 없음

**주의사항:**
- `VITE_` 접두사가 붙은 환경변수는 프론트엔드 빌드에 포함됨
- `VITE_SUPABASE_ANON_KEY`는 의도적으로 공개 가능 (Supabase 설계 원칙)
- `SUPABASE_SERVICE_ROLE_KEY`에는 절대 `VITE_` 접두사 사용 금지

---

## 3. 시큐어코딩 관점 평가 (행안부 가이드 기준)

### 3.1 입력 데이터 검증 및 표현

| 점검 항목 | 상태 | 비고 |
|-----------|------|------|
| SQL 삽입 방지 | **양호** | Supabase 클라이언트가 파라미터화된 쿼리 자동 처리 |
| XSS 방지 | **양호** | React 자동 이스케이핑, dangerouslySetInnerHTML 미사용 |
| 경로 조작 방지 | **양호** | 파일 업로드 시 랜덤 경로명 사용, safeName 새니타이징 |
| 운영체제 명령어 삽입 방지 | **양호** | exec/spawn 등 OS 명령 실행 함수 미사용 |
| 입력값 길이/형식 검증 | **미흡** | API 엔드포인트별 입력값 길이 제한 및 형식 검증 미비 |
| HTTP 응답 분할 방지 | **양호** | 사용자 입력이 HTTP 헤더에 직접 삽입되는 경로 없음 |

### 3.2 보안 기능

| 점검 항목 | 상태 | 비고 |
|-----------|------|------|
| 적절한 인증 | **미흡** | 클라이언트 사이드 전용 인증, 게스트 로그인 허용 |
| 적절한 인가 | **미흡** | RLS 미적용, 서버사이드 인가 검증 부재 |
| 비밀번호 안전 저장 | **미흡** | SHA-256 + Salt 미사용 |
| 비밀번호 정책 | **미흡** | 복잡성 요구사항 없음 |
| 세션 관리 | **미흡** | localStorage 기반, 10시간 유효기간 |
| CSRF 방어 | **미흡** | CSRF 토큰 미구현 |
| 암호화 통신 | **양호** | Vercel HTTPS 기본 적용, Supabase HTTPS 통신 |

### 3.3 에러 처리

| 점검 항목 | 상태 | 비고 |
|-----------|------|------|
| 에러 상세 정보 제한 | **미흡** | error.message를 클라이언트에 직접 반환 |
| 내부 정보 노출 방지 | **미흡** | 환경변수명, DB 에러 메시지 클라이언트 노출 |
| 프로덕션 로깅 정리 | **미흡** | 89건의 콘솔 로그 구문 |

### 3.4 코드 오류

| 점검 항목 | 상태 | 비고 |
|-----------|------|------|
| Null 포인터 역참조 방지 | **양호** | Optional chaining(?.) 적절히 사용 |
| 리소스 해제 | **양호** | React 컴포넌트 언마운트 시 정리 로직 확인 |
| 초기화되지 않은 변수 사용 방지 | **양호** | 기본값 설정 및 null 체크 적절 |

### 3.5 캡슐화

| 점검 항목 | 상태 | 비고 |
|-----------|------|------|
| 민감 데이터 노출 제한 | **미흡** | API 키가 클라이언트 번들에 포함 (VITE_ 접두사) |
| 디버그 코드 제거 | **미흡** | 프로덕션 빌드에 콘솔 로그 잔존 |

---

## 4. 양호 사항 (Positive Findings)

보안 관점에서 다음 사항은 적절하게 구현되어 있습니다:

1. **SQL 인젝션 방어**: Supabase 클라이언트 라이브러리의 파라미터화된 쿼리 사용으로 SQL 인젝션 원천 차단
2. **XSS 방어**: React의 자동 이스케이핑 활용, 위험한 HTML 삽입 API 미사용
3. **명령어 인젝션 방어**: OS 명령 실행 함수(exec, spawn 등) 미사용
4. **파일명 새니타이징**: 업로드 파일명에서 특수문자 제거 및 랜덤 경로 생성
5. **파일 크기 제한**: 3MB 업로드 제한 적용
6. **HTTPS 통신**: Vercel 및 Supabase 모두 HTTPS 기본 적용
7. **환경변수 분리**: `.env` 파일이 git 추적에서 제외됨
8. **HuggingFace 모델 ID 검증**: 정규식을 통한 입력값 검증 (`/^[\w.-]+\/[\w.-]+$/`)
9. **세션 만료 메커니즘**: 10시간 후 자동 만료 및 주기적 검사 (60초 간격)
10. **Cron 엔드포인트 인증**: Bearer Token 기반 인증 구현

---

## 5. 조치 우선순위 로드맵

### Phase 1 - 긴급 조치 (1주 이내)

| 순번 | 조치 항목 | 관련 취약점 | 예상 공수 |
|------|-----------|-------------|-----------|
| 1 | 비밀번호 해시를 bcrypt/Argon2id로 전환 | CRITICAL-01 | 1일 |
| 2 | 하드코딩된 기본 비밀번호 제거 및 초기화 플로우 구현 | CRITICAL-02 | 0.5일 |
| 3 | Supabase RLS 정책 운영 환경용으로 전환 | HIGH-05 | 0.5일 |
| 4 | CORS Origin 화이트리스트 적용 | HIGH-01 | 0.5일 |

### Phase 2 - 단기 조치 (1개월 이내)

| 순번 | 조치 항목 | 관련 취약점 | 예상 공수 |
|------|-----------|-------------|-----------|
| 5 | Supabase Auth 또는 JWT 기반 서버 사이드 인증 도입 | HIGH-02 | 3일 |
| 6 | API 엔드포인트 인증 미들웨어 추가 | HIGH-03 | 1일 |
| 7 | Gemini API model 파라미터 화이트리스트 적용 | HIGH-04 | 0.5일 |
| 8 | Rate Limiting 구현 | MEDIUM-02 | 1일 |
| 9 | 비밀번호 복잡성 정책 적용 | MEDIUM-05 | 0.5일 |
| 10 | 에러 응답에서 내부 정보 제거 | MEDIUM-07, LOW-04 | 0.5일 |

### Phase 3 - 중기 조치 (3개월 이내)

| 순번 | 조치 항목 | 관련 취약점 | 예상 공수 |
|------|-----------|-------------|-----------|
| 11 | CSRF 보호 메커니즘 구현 | MEDIUM-01 | 1일 |
| 12 | 파일 업로드 매직바이트 검증 추가 | MEDIUM-03 | 0.5일 |
| 13 | 세션 정책 개선 (시간 단축, Idle Timeout) | MEDIUM-04 | 0.5일 |
| 14 | Cron Secret 타이밍 세이프 비교 적용 | MEDIUM-06 | 0.5일 |
| 15 | 보안 응답 헤더 추가 | LOW-01 | 0.5일 |
| 16 | 프로덕션 빌드 콘솔 로그 제거 | LOW-02 | 0.5일 |
| 17 | 세션 저장소를 HttpOnly 쿠키로 전환 | LOW-03 | 1일 |

---

## 6. 보안 아키텍처 개선 권장안

### 현재 아키텍처의 보안 문제

```
┌─────────────────────────────────────────────────────────┐
│ 현재 구조                                                │
│                                                         │
│  브라우저 ──(anon key)──→ Supabase DB                   │
│     │         ↑                  ↑                      │
│     │    인증 없음          RLS: 전체 허용               │
│     │                                                   │
│     └──(인증 없음)──→ Vercel API ──→ 외부 서비스         │
│                         ↑                               │
│                    CORS: *                              │
│                    Rate Limit: 없음                     │
└─────────────────────────────────────────────────────────┘
```

### 권장 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│ 개선된 구조                                                  │
│                                                             │
│  브라우저 ──(JWT)──→ Vercel API ──(service key)──→ Supabase │
│     │                    ↑                            ↑     │
│     │              인증 미들웨어                  엄격한 RLS │
│     │              Rate Limiting                            │
│     │              CORS 화이트리스트                         │
│     │              CSRF 토큰 검증                           │
│     │                    │                                  │
│     │                    └──(API Key)──→ 외부 서비스         │
│     │                                                       │
│     └──(anon key + RLS)──→ Supabase (읽기 전용)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 결론

Space D 프로젝트는 React의 기본 XSS 방어, Supabase의 파라미터화된 쿼리, HTTPS 통신 등 프레임워크 수준의 보안은 적절히 활용하고 있습니다. 그러나 **인증/인가**, **비밀번호 관리**, **API 접근 제어** 영역에서 프로덕션 배포 전 반드시 해결해야 할 취약점들이 존재합니다.

가장 시급한 조치는:
1. **비밀번호 해시 알고리즘 전환** (SHA-256 → bcrypt)
2. **하드코딩된 기본 비밀번호 제거**
3. **Supabase RLS 정책 운영 모드 전환**
4. **API 엔드포인트 인증 및 CORS 정책 강화**

이 4가지 항목을 우선 처리하면 전체 보안 수준이 크게 향상됩니다.

---

*본 보고서는 정적 코드 분석 기반으로 작성되었으며, 동적 침투 테스트(Penetration Testing)는 포함되지 않았습니다. 프로덕션 배포 전 전문 보안 업체의 침투 테스트를 권장합니다.*
