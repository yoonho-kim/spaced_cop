# Space D - 시스템 아키텍처 문서

## 1. 개요 (Overview)
**Space D**는 사내 오피스 관리를 위한 모바일 웹 애플리케이션입니다. 직원 간의 소통(피드), 회의실 예약, 봉사활동 참여, 비품 신청 등의 기능을 통합하여 제공합니다. 트위터(X) 스타일의 익명 닉네임 기반 소셜 기능과 관리자 전용 기능을 포함하고 있습니다.

## 2. 기술 스택 (Tech Stack)

### Frontend
- **Framework**: React 18+ (Vite 빌드 도구 사용)
- **Language**: JavaScript (ES6+)
- **Styling**: Plain CSS (모듈화 및 유틸리티 클래스 혼용)
- **Chart**: Recharts (통계 시각화)
- **Deployment**: Vercel

### Backend & Database
- **Platform**: Supabase (BaaS)
- **Database**: PostgreSQL
- **Auth**:
    - 일반 사용자: 닉네임 기반 간편 로그인 (로컬 스토리지 활용)
    - 관리자: 별도 비밀번호 인증

## 3. 프로젝트 구조 (Directory Structure)

```
/src
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── Button.jsx       # 공통 버튼
│   ├── Modal.jsx        # 기본 모달
│   ├── *Modal.jsx       # 기능별 모달 (참여자 목록, 봉사활동 상세 등)
│   └── ...
├── pages/               # 주요 탭(Tab) 화면
│   ├── Feed.jsx         # 탭1: 소통 및 공지사항 피드
│   ├── Meeting.jsx      # 탭2: 회의실 예약 시스템
│   ├── Volunteer.jsx    # 탭3: 봉사활동 신청 및 조회
│   ├── Supplies.jsx     # 탭4: 비품/간식 신청
│   └── Admin.jsx        # 탭5: 관리자 패널
├── utils/               # 유틸리티 및 API 통신
│   ├── storage.js       # Supabase 데이터 CRUD 함수 집합
│   ├── auth.js          # 인증 관련 로직
│   └── supabase.js      # Supabase 클라이언트 설정
├── hooks/               # 커스텀 훅
│   └── usePullToRefresh.jsx # 모바일 당겨서 새로고침 구현
├── App.jsx              # 메인 라우팅 및 레이아웃 설정
└── main.jsx             # 진입점 (Entry Point)
```

## 4. 핵심 모듈 및 기능 (Core Modules)

### 4.1. 인증 (Authentication)
- **닉네임 시스템**: 별도의 복잡한 가입 절차 없이 닉네임만으로 활동.
- **관리자 권한**: 특정 비밀번호 입력을 통해 관리자 모드 활성화. 로컬 스토리지에 인증 상태 저장.

### 4.2. 피드 (Feed)
- **기능**: 게시글 작성(일반/공지/봉사), 좋아요, 댓글.
- **특이사항**: 관리자만 '공지' 및 '봉사' 카테고리 글 작성 가능.
- **데이터 구조**: `posts`, `post_likes`, `post_comments` 테이블 연동.

### 4.3. 회의실 예약 (Meeting Rooms)
- **기능**: 회의실 조회, 시간대별 예약(09:00~18:00), 반복 예약 설정(매주/매월).
- **데이터 구조**: `meeting_rooms`, `meeting_reservations`, `recurring_reservation_rules`.

### 4.4. 봉사활동 (Volunteer Activities)
- **기능**:
    - **활동 생성**: 관리자가 제목, 날짜, 정원, **인정 시간** 등을 설정하여 생성.
    - **신청**: 사용자가 사번을 입력하여 신청.
    - **추첨 시스템**: 정원 초과 시, 과거 참여 횟수(올해 기준)가 적은 순으로 관리자가 추첨/확정.
    - **상세 보기**: 팝업을 통해 상세 정보(위치, 설명, 인정 시간 등) 확인.
- **데이터 구조**: `volunteer_activities`, `volunteer_registrations`.

### 4.5. 비품 신청 (Supply Requests)
- **기능**: 필요한 비품/간식 신청 및 사유 작성.
- **관리**: 관리자가 승인/거절 처리.
- **데이터 구조**: `supply_requests`.

### 4.6. 관리자 (Admin)
- **기능**: 위 모든 모듈에 대한 생성/수정/삭제(CRUD) 권한.
- **통계**: 봉사활동 참여 통계 등 데이터 대시보드 제공.

## 5. 데이터 흐름 (Data Flow)

1.  **Frontend Components** (`pages/*`, `components/*`)에서 사용자 인터랙션 발생.
2.  **Utils Layer** (`utils/storage.js`)의 비동기 함수 호출.
3.  **Supabase Client**가 PostgreSQL 데이터베이스에 쿼리 실행.
4.  **Real-time**: 데이터 변경 시 UI 업데이트 (주로 `loadData` 함수를 통한 재조회 방식 사용, `usePullToRefresh`로 수동 갱신 지원).

## 6. 데이터베이스 스키마 요약
- `users`: 사용자 정보 (닉네임, 프로필 등)
- `posts`: 피드 게시글
- `meeting_rooms`: 회의실 정보
- `meeting_reservations`: 회의실 예약 내역
- `volunteer_activities`: 봉사활동 정보 (**recognition_hours** 포함)
- `volunteer_registrations`: 봉사활동 신청 내역 (**employee_id** 포함)
- `supply_requests`: 비품 신청 내역
