# Flask CRM 웹 애플리케이션 기능 명세서

**작성일**: 2025-12-04
**버전**: 1.0
**프로젝트명**: Flask CRM Web Application
**접속 URL**: http://58.232.66.210:5000

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [기술 스택](#기술-스택)
3. [주요 기능](#주요-기능)
4. [사용자 역할 및 권한](#사용자-역할-및-권한)
5. [페이지별 상세 기능](#페이지별-상세-기능)
6. [API 엔드포인트](#api-엔드포인트)
7. [데이터베이스 구조](#데이터베이스-구조)
8. [보안 및 개인정보 보호](#보안-및-개인정보-보호)
9. [알림 시스템](#알림-시스템)
10. [파일 구조](#파일-구조)

---

## 시스템 개요

### 목적
고객 관계 관리(CRM) 및 내부 업무 협업을 위한 통합 웹 애플리케이션

### 핵심 가치
- **실시간 협업**: Socket.IO 기반 실시간 채팅 및 알림
- **업무 효율화**: 할일 관리, 예약 관리, 프로모션 관리 통합
- **개인정보 보호**: 전화번호 자동 감지 및 차단 시스템
- **관리자 친화적**: 일괄 등록, 엑셀 업로드 등 대량 작업 지원

### 접근성
- **PWA 지원**: 모바일 앱처럼 설치 가능
- **반응형 디자인**: 모바일/태블릿/데스크톱 모두 지원
- **웹 접근성**: ARIA 레이블, 키보드 네비게이션 지원

---

## 기술 스택

### Backend
- **Framework**: Flask 3.1.0
- **Real-time**: Flask-SocketIO 5.4.1
- **Database**: PostgreSQL 14+ (crm_db)
- **Server**: Gunicorn + Nginx
- **OS**: Linux (CentOS 9)

### Frontend
- **Core**: Vanilla JavaScript (ES6+)
- **Template Engine**: Jinja2
- **Styling**: CSS3 (Grid, Flexbox, Gradients)
- **Icons**: Emoji + Unicode
- **Animations**: CSS Keyframes

### 데이터 저장
- **주 데이터베이스**: PostgreSQL (구조화된 데이터)
- **파일 저장**: 로컬 파일시스템 (`/uploads/chat_files/`)
- **세션 관리**: Flask Session (서버 사이드)

### 데이터베이스 마이그레이션 히스토리
프로젝트는 다음과 같은 점진적 마이그레이션을 거쳐 발전했습니다:

1. **Phase 1: JSON 파일 기반** (초기)
   - 간단한 프로토타입을 위해 JSON 파일로 데이터 저장
   - 파일 기반 저장으로 빠른 개발 가능
   - 동시성 및 성능 이슈로 다음 단계로 이전

2. **Phase 2: SQLite** (중기)
   - 관계형 데이터베이스 도입
   - SQL 쿼리 및 트랜잭션 지원
   - 로컬 파일 기반으로 간편한 배포
   - 다중 사용자 환경에서 잠금 이슈 발생

3. **Phase 3: PostgreSQL** (현재)
   - 프로덕션급 RDBMS로 최종 마이그레이션
   - 동시성 제어 개선 (MVCC)
   - 고급 기능 활용 (JSON 타입, Full-text Search, 트리거)
   - 연결 풀링으로 성능 최적화
   - 대용량 데이터 처리 가능

---

## 주요 기능

### 1. 인증 및 사용자 관리
- 세션 기반 로그인/로그아웃
- 역할 기반 접근 제어 (Admin, Local Admin, User)
- 비밀번호 변경 (마이페이지)
- 관리자 전용 사용자 추가/삭제/수정

### 2. 할일 관리 (Admin Only)
- 할일 CRUD (생성, 읽기, 수정, 삭제)
- 레이아웃 기반 그룹핑 (기본, 버튼, 슬라이더)
- 완료 상태 토글
- 할일별 담당자 지정 및 진행 상태 추적

### 3. 예약(리마인더) 관리
- 예약 CRUD 및 완료 처리
- 개인정보 보호: 전화번호 자동 감지 및 차단
- 당일 예약 빠른 확인 모달
- 예약 배너 자동 표시 (오늘 예약 있을 시)
- 캘린더 뷰 및 목록 뷰
- 공휴일 자동 표시

### 4. 프로모션 관리
- 프로모션 CRUD
- 다중 필터링 (채널, 대분류, 상품, 프로모션명, 상태)
- 종료된 프로모션 토글 표시
- **일괄 등록 (2가지 방식)**:
  - 📁 엑셀 업로드 (템플릿 다운로드 → 작성 → 업로드)
  - ✏️ 직접 입력 (모달 내 행 추가/삭제)
- 미리보기 및 수정 기능
- 수정 잠금 (다른 관리자 수정 중 방지)

### 5. 실시간 채팅
- 1:1 채팅 및 그룹 채팅
- 파일 첨부 (최대 50MB, 다중 업로드 지원)
- 읽음 표시 및 읽지 않은 메시지 배지
- 실시간 메시지 전송/수신 (Socket.IO)
- 채팅방 검색 (제목, 참여자, 메시지 내용)
- 관리자: 전체 채팅방 조회 및 삭제 권한

### 6. 알림 시스템
- **모달 알림**: 4가지 타입 (info, error, success, warning)
- **토스트 알림**: 새 메시지 도착 시 우하단 표시
- **브라우저 알림**: 페이지 비활성화 시
- **제목 깜빡임**: 읽지 않은 메시지 개수 표시
- **배너 알림**: 당일 예약 존재 시 상단 빨간 배너

---

## 사용자 역할 및 권한

### 👑 Local Admin (최고 관리자)
- **모든 권한 보유**
- 할일 관리 (생성, 수정, 삭제)
- 모든 채팅방 입장 및 메시지 확인
- 채팅방 삭제
- 프로모션 일괄 등록
- 사용자 관리 (추가, 삭제, 역할 변경)

### 🔧 Admin (일반 관리자)
- 프로모션 관리 (CRUD, 일괄 등록)
- 자신이 참여한 채팅방만 입장
- 모든 채팅방 조회 및 삭제 (메시지 확인 불가)
- 예약 관리

### 👤 User (일반 사용자)
- 자신의 채팅방만 조회/입장
- 예약 관리 (본인 예약만)
- 프로모션 조회 (수정 불가)

---

## 페이지별 상세 기능

### 1. 로그인 페이지 (`/`)
**경로**: `/`
**접근 권한**: 비로그인 사용자

**기능**:
- 사용자명 및 비밀번호 입력
- 세션 생성 및 역할 확인
- 로그인 실패 시 에러 메시지 표시

**보안**:
- 비밀번호 해시 검증
- 세션 기반 인증

---

### 2. 관리자 페이지 (`/admin`)
**경로**: `/admin`
**접근 권한**: Local Admin only

#### 2.1 할일 관리
**기능**:
- 할일 추가/수정/삭제
- 레이아웃별 그룹핑 (기본, 버튼, 슬라이더)
- 완료 상태 토글
- 담당자 및 진행 상태 관리

**레이아웃 타입**:
- `default`: 기본 텍스트 할일
- `button`: 버튼 형태 (값 선택 - 시작/끝)
- `slider`: 슬라이더 형태 (범위 값 입력)

**UI 요소**:
- 할일 그룹별 카드 형태 표시
- 인라인 편집 (클릭 시 수정 모드)
- 드래그 앤 드롭 (미구현 - 순서 변경용)

#### 2.2 채팅 관리
**기능**:
- 모든 채팅방 조회
- 채팅방 생성 (참여자 선택)
- 채팅방 삭제
- 모든 채팅방 입장 가능 (Local Admin만)

---

### 3. 예약 관리 페이지 (`/reminders`)
**경로**: `/reminders`
**접근 권한**: 로그인 사용자 전체

#### 3.1 캘린더 뷰
**기능**:
- 월별 캘린더 표시
- 예약 있는 날짜에 배지 표시
- 날짜 클릭 시 해당 날짜 예약 모달
- 공휴일 자동 표시 (빨간색)

#### 3.2 예약 CRUD
**기능**:
- 예약 추가 (제목, 내용, 날짜, 시간)
- 예약 수정/삭제
- 완료 처리 (체크박스)
- 개인정보 보호: 전화번호 입력 차단

**전화번호 감지 패턴**:
```javascript
/01[016789]-?\d{3,4}-?\d{4}/g  // 010-1234-5678
/01[016789]\s?\d{3,4}\s?\d{4}/g  // 010 1234 5678
/\d{3}-\d{3,4}-\d{4}/g  // 02-123-4567
/\d{10,11}/g  // 01012345678
```

**예외 처리**:
- 상담번호 (CO로 시작): `CO2511082391109`
- 고객번호 (CU로 시작): `CU12215795`

#### 3.3 당일 예약 빠른 확인
**기능**:
- 우하단 빨간 버튼 (📅 아이콘)
- 배지로 당일 예약 개수 표시
- 클릭 시 모달로 당일 예약 목록
- 완료 처리 및 수정 가능

---

### 4. 프로모션 관리 페이지 (`/promotions`)
**경로**: `/promotions`
**접근 권한**: 로그인 사용자 전체 (Admin만 수정 가능)

#### 4.1 필터링 시스템
**3단계 필터링**:
1. **1줄**: 채널, 대분류, 프로모션명, 종료 프로모션 포함 여부
2. **2줄**: 상품명 (대분류 선택 시 자동 필터링)
3. **3줄**: 검색창 (전체 필드 통합 검색)

**필터 조합 예시**:
- 채널: "쿠팡" + 대분류: "헬스/건강" → 해당 상품만 표시
- 검색어: "할인" → 프로모션명/내용에 "할인" 포함된 것만

#### 4.2 프로모션 CRUD
**기능**:
- 프로모션 추가/수정/삭제 (Admin only)
- 수정 잠금 시스템 (다른 관리자 수정 중 방지)
- 종료일 기준 자동 상태 관리

**필드 구조**:
```javascript
{
  category: "대분류",
  product_name: "상품명*",
  channel: "채널*",
  promotion_name: "프로모션명*",
  discount_amount: "금액할인",
  session_exemption: "회차면제",
  subscription_types: ["중복여부"],
  promotion_code: "프로모션코드",
  content: "프로모션내용*",
  start_date: "시작일*",
  end_date: "종료일"
}
```

#### 4.3 일괄 등록 (2가지 방식)
**방식 1: 📁 엑셀 업로드**
1. 양식 다운로드 (템플릿 제공)
2. 엑셀에 데이터 입력 (18행부터)
3. 파일 업로드 (드래그 앤 드롭 지원)
4. 미리보기 및 수정
5. 일괄 등록

**방식 2: ✏️ 직접 입력**
1. 직접 입력 탭 선택
2. "➕ 새 행 추가" 또는 "➕ 5행 추가" 클릭
3. 테이블에서 직접 데이터 입력
4. 미리보기 및 수정
5. 일괄 등록

**공통 기능**:
- 미리보기 테이블에서 행 추가/삭제 가능
- 엑셀 업로드 후 추가 행 입력 가능
- 실시간 필드 검증
- 자동 스크롤 (마지막 행으로)

---

### 5. 채팅 목록 페이지 (`/chats`)
**경로**: `/chats`
**접근 권한**: 로그인 사용자 전체

#### 5.1 채팅방 목록
**기능**:
- 내 채팅방 목록 (참여 중인 채팅방)
- 전체 채팅 관리 (Admin only)
- 읽지 않은 메시지 배지
- 최신 메시지 미리보기
- 시간 표시 (방금, N분 전, N시간 전)

#### 5.2 검색 기능
**검색 대상**:
- 채팅방 제목
- 참여자 이름
- 메시지 내용

**검색 방식**:
- 실시간 검색 (입력 시마다 필터링)
- 대소문자 구분 없음
- 부분 일치 검색

#### 5.3 탭 전환 (Admin only)
- **내 채팅**: 자신이 참여 중인 채팅방만
- **전체 채팅 관리**: 모든 채팅방 조회 및 삭제

---

### 6. 채팅방 페이지 (`/chat/<chat_id>`)
**경로**: `/chat/<chat_id>`
**접근 권한**: 참여자 또는 Local Admin

#### 6.1 실시간 메시지
**기능**:
- 메시지 전송/수신 (Socket.IO)
- 읽음 표시 (✓✓)
- 시간 표시 (상대적 시간)
- 자동 스크롤 (새 메시지 시)

**메시지 타입**:
- 텍스트 메시지
- 파일 첨부 (최대 50MB)
- 시스템 메시지 (입장/퇴장)

#### 6.2 파일 업로드
**기능**:
- 다중 파일 업로드 (한 번에 여러 개)
- 파일 크기 검증 (최대 50MB)
- 진행률 표시
- 다운로드 링크 제공

**지원 형식**: 모든 파일 형식

#### 6.3 읽음 처리
**로직**:
- 채팅방 입장 시 자동 읽음 처리
- 메시지 수신 시 자동 읽음 처리 (페이지 활성화 시)
- Socket.IO로 실시간 읽음 상태 동기화

---

### 7. 마이페이지 (`/mypage`)
**경로**: `/mypage`
**접근 권한**: 로그인 사용자 전체

**기능**:
- 사용자 정보 조회 (이름, 역할)
- 비밀번호 변경
- 로그아웃

---

### 8. 사용자 관리 페이지 (`/users`)
**경로**: `/users`
**접근 권한**: Local Admin only

**기능**:
- 사용자 목록 조회
- 사용자 추가 (이름, 역할, 비밀번호)
- 사용자 삭제
- 역할 변경 (User ↔ Admin ↔ Local Admin)

**역할 종류**:
- `local_admin`: 최고 관리자
- `admin`: 일반 관리자
- `user`: 일반 사용자

---

## API 엔드포인트

### 인증 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| POST | `/login` | 로그인 | 비로그인 |
| GET | `/logout` | 로그아웃 | 로그인 |

### 할일 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/todos` | 할일 목록 조회 | Local Admin |
| POST | `/api/todos` | 할일 추가 | Local Admin |
| PUT | `/api/todos/<id>` | 할일 수정 | Local Admin |
| DELETE | `/api/todos/<id>` | 할일 삭제 | Local Admin |

### 예약 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/reminders` | 예약 목록 조회 | 로그인 |
| POST | `/api/reminders` | 예약 추가 | 로그인 |
| PUT | `/api/reminders/<id>` | 예약 수정 | 로그인 |
| DELETE | `/api/reminders/<id>` | 예약 삭제 | 로그인 |
| GET | `/api/reminders/today` | 오늘 예약 조회 | 로그인 |
| GET | `/api/reminders/banner-check` | 배너 표시 여부 | 로그인 |

### 프로모션 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/promotions` | 프로모션 목록 조회 | 로그인 |
| POST | `/api/promotions` | 프로모션 추가 | Admin |
| PUT | `/api/promotions/<id>` | 프로모션 수정 | Admin |
| DELETE | `/api/promotions/<id>` | 프로모션 삭제 | Admin |
| GET | `/api/promotions/template` | 엑셀 템플릿 다운로드 | Admin |
| POST | `/api/promotions/bulk-upload` | 엑셀 업로드 | Admin |
| POST | `/api/promotions/bulk-save` | 일괄 저장 | Admin |
| POST | `/api/promotions/<id>/lock` | 수정 잠금 | Admin |
| DELETE | `/api/promotions/<id>/unlock` | 잠금 해제 | Admin |

### 채팅 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/chats` | 채팅방 목록 조회 | 로그인 |
| POST | `/api/chats` | 채팅방 생성 | 로그인 |
| GET | `/api/chats/<id>` | 채팅방 상세 조회 | 참여자 |
| DELETE | `/api/chats/<id>` | 채팅방 삭제 | Admin |
| POST | `/api/chats/<id>/messages` | 메시지 전송 | 참여자 |
| POST | `/api/chats/<id>/read` | 읽음 처리 | 참여자 |
| POST | `/api/chats/<id>/upload` | 파일 업로드 | 참여자 |

### 사용자 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/users` | 사용자 목록 조회 | Admin |
| POST | `/api/users` | 사용자 추가 | Local Admin |
| PUT | `/api/users/<id>` | 사용자 수정 | Local Admin |
| DELETE | `/api/users/<id>` | 사용자 삭제 | Local Admin |
| POST | `/api/change-password` | 비밀번호 변경 | 로그인 |

### 공휴일 API
| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|------------|------|------|
| GET | `/api/holidays` | 공휴일 목록 조회 | 로그인 |

---

## 데이터베이스 구조

### 테이블: `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    team VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 테이블: `tasks` (할일)
```sql
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    assigned_to VARCHAR(255),
    title TEXT NOT NULL,
    content TEXT,
    status VARCHAR(50) DEFAULT '대기중',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP,
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(username)
);
```

### 테이블: `reminders` (예약)
```sql
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(username)
);
```

### 테이블: `promotions`
```sql
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,
    channel VARCHAR(255) NOT NULL,
    promotion_name VARCHAR(255) NOT NULL,
    discount_amount VARCHAR(255),
    session_exemption VARCHAR(255),
    promotion_code VARCHAR(255),
    content TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    locked_by VARCHAR(255),
    locked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(255)
);
```

### 테이블: `promotion_subscription_types` (중복여부)
```sql
CREATE TABLE promotion_subscription_types (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL,
    subscription_type VARCHAR(255) NOT NULL,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
);
```

### 테이블: `chats`
```sql
CREATE TABLE chats (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    creator VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator) REFERENCES users(username)
);
```

### 테이블: `chat_participants` (채팅 참여자)
```sql
CREATE TABLE chat_participants (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
    UNIQUE (chat_id, username)
);
```

### 테이블: `messages` (채팅 메시지)
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    sender VARCHAR(255) NOT NULL,
    message TEXT,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender) REFERENCES users(username)
);
```

### 테이블: `message_reads` (읽음 표시)
```sql
CREATE TABLE message_reads (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
    UNIQUE (message_id, username)
);
```

### 테이블: `holidays` (공휴일)
```sql
CREATE TABLE holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    UNIQUE (date)
);
```

---

## 보안 및 개인정보 보호

### 1. 인증 보안
- 세션 기반 인증 (Flask Session)
- 비밀번호 해시 저장 (Werkzeug Security)
- CSRF 보호 (Flask 기본 제공)
- 역할 기반 접근 제어 (RBAC)

### 2. 개인정보 보호
**전화번호 입력 차단 시스템**:
```javascript
function detectPhoneNumber(text) {
    if (isExceptionOrderNumber(text)) {
        return false; // 주문번호는 예외 처리
    }

    const patterns = [
        /01[016789]-?\d{3,4}-?\d{4}/g,
        /01[016789]\s?\d{3,4}\s?\d{4}/g,
        /\d{3}-\d{3,4}-\d{4}/g,
        /\d{10,11}/g
    ];

    for (let pattern of patterns) {
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}
```

**예외 처리**:
- `CO`로 시작하는 상담번호
- `CU`로 시작하는 고객번호
- 패턴: `/[A-Za-z]{2}\d{8,}/`

### 3. 파일 업로드 보안
- 파일 크기 제한: 50MB
- 파일명 검증 (secure_filename)
- 업로드 경로 제한 (`/uploads/chat_files/`)
- 파일 타입 검증 (선택적)

### 4. SQL Injection 방지
- SQLite 파라미터 바인딩 사용
- 사용자 입력 검증
- ORM 사용 (일부 쿼리)

---

## 알림 시스템

### 1. 모달 알림 (Alert Modal)
**타입**:
- `info`: 일반 정보 (파란색)
- `error`: 오류 (빨간색)
- `success`: 성공 (초록색)
- `warning`: 경고 (노란색)

**사용 예시**:
```javascript
showAlert('메시지 내용', 'success');
showAlert('에러 발생', 'error', '커스텀 제목');
```

**특징**:
- 중앙 모달 표시
- 키보드(ESC) 및 오버레이 클릭으로 닫기
- 아이콘 자동 표시
- 애니메이션 효과

### 2. 토스트 알림
**사용처**:
- 새 메시지 도착 시
- 예약 저장 성공 시
- 파일 업로드 완료 시

**특징**:
- 우하단 표시
- 3초 후 자동 사라짐
- 여러 개 동시 표시 가능
- 슬라이드 애니메이션

### 3. 브라우저 알림
**조건**:
- 사용자가 알림 권한 허용
- 페이지가 비활성화 상태
- 새 메시지 도착

**내용**:
- 제목: 채팅방 이름
- 내용: 발신자 + 메시지 미리보기
- 아이콘: 애플리케이션 로고

### 4. 제목 깜빡임
**조건**:
- 페이지가 비활성화 상태
- 읽지 않은 메시지 존재

**표시 형식**:
```
"🔴 (3) 새 메시지" ↔ "CRM - 채팅"
```

### 5. 배너 알림
**표시 조건**:
- 당일 예약 존재
- 완료되지 않은 예약

**위치**: 페이지 최상단 (고정)

**내용**:
```
🔔 오늘 예약이 N건 있습니다! [예약 확인] [닫기]
```

---

## 파일 구조

```
/svc/was/crm/crm-webapp/
├── app.py                          # 메인 애플리케이션
├── database.py                     # 데이터베이스 초기화
├── gunicorn_config.py              # Gunicorn 설정
├── requirements.txt                # Python 의존성
├── crm.db                          # SQLite 데이터베이스
├── replace_alerts.py               # Alert 자동 변환 스크립트
├── add_holidays_table.sql          # 공휴일 테이블 생성 SQL
│
├── scripts/                        # 운영 스크립트
│   ├── start.sh                    # 서버 시작
│   ├── stop.sh                     # 서버 중지
│   ├── restart.sh                  # 서버 재시작
│   └── status.sh                   # 서버 상태 확인
│
├── templates/                      # Jinja2 템플릿
│   ├── login.html                  # 로그인 페이지
│   ├── admin.html                  # 관리자 페이지
│   ├── reminders.html              # 예약 관리
│   ├── promotions.html             # 프로모션 관리
│   ├── chat_list.html              # 채팅 목록
│   ├── chat_room.html              # 채팅방
│   ├── chat_create.html            # 채팅방 생성
│   ├── admin_chat.html             # 관리자 채팅 관리
│   ├── mypage.html                 # 마이페이지
│   ├── users.html                  # 사용자 관리
│   ├── access_denied.html          # 접근 거부
│   │
│   └── includes/                   # 재사용 컴포넌트
│       ├── header.html             # 헤더
│       ├── alert_modal.html        # 알림 모달
│       ├── reminder_modal.html     # 예약 모달
│       ├── today_reminders.html    # 당일 예약 버튼
│       └── bulk_upload_modal.html  # 일괄등록 모달
│
├── static/                         # 정적 파일
│   ├── manifest.json               # PWA 매니페스트
│   ├── service-worker.js           # Service Worker
│   ├── icons/                      # 앱 아이콘
│   └── uploads/                    # 업로드 파일
│       └── chat_files/             # 채팅 첨부 파일
│
└── logs/                           # 로그 파일
    ├── access.log                  # 접근 로그
    └── error.log                   # 에러 로그
```

---

## PWA 지원

### Manifest 설정
```json
{
  "name": "CRM 웹 애플리케이션",
  "short_name": "CRM",
  "description": "고객 관계 관리 및 협업 도구",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [...]
}
```

### Service Worker 기능
- 오프라인 지원 (제한적)
- 백그라운드 알림
- 캐시 전략

---

## 성능 최적화

### Backend
- Gunicorn 워커: 4개
- 워커 재시작 주기: 10,000 요청
- 타임아웃: 120초
- Keep-Alive: 5초

### Frontend
- CSS/JS 인라인 (번들링 없음)
- 이미지 최적화 (Emoji 사용)
- 지연 로딩 (이미지, 컴포넌트)
- 디바운싱 (검색, 필터링)

### Database (PostgreSQL)
- 인덱스: `username`, `chat_id`, `scheduled_date`, `assigned_to`
- 트랜잭션 사용 (MVCC)
- 연결 풀링 (ThreadedConnectionPool, 1-20 connections)
- 외래 키 제약조건 (참조 무결성)
- CASCADE 삭제 (채팅/메시지 관계)

---

## 운영 환경

### 서버 정보
- **OS**: CentOS 9 (Linux 5.14.0)
- **Python**: 3.9+
- **Web Server**: Nginx
- **WSGI Server**: Gunicorn
- **Database**: PostgreSQL 14+

### 프로세스 관리
```bash
./scripts/start.sh    # 서버 시작
./scripts/stop.sh     # 서버 중지
./scripts/restart.sh  # 서버 재시작
./scripts/status.sh   # 상태 확인
```

### 로그 확인
```bash
# 에러 로그
tail -f logs/error.log

# 접근 로그
tail -f logs/access.log
```

---

## 향후 개선 계획

### 단기 (1개월)
- [ ] 다크 모드 지원
- [ ] 프로모션 복사 기능
- [ ] 채팅방 알림 설정 (On/Off)
- [ ] 예약 반복 설정

### 중기 (3개월)
- [x] PostgreSQL 마이그레이션 (완료)
- [ ] Redis 캐싱 도입
- [ ] 파일 미리보기 (이미지, PDF)
- [ ] 대시보드 (통계, 차트)

### 장기 (6개월)
- [ ] 모바일 앱 (React Native)
- [ ] 음성 메시지
- [ ] 화상 회의 통합
- [ ] AI 챗봇 지원

---

## 문의 및 지원

**개발**: Claude Code (Anthropic)
**운영**: Local Admin
**버전**: 1.0
**최종 업데이트**: 2025-12-04

---

**© 2025 Flask CRM Application. All rights reserved.**
