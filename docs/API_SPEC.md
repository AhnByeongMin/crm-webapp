# 하루CRM API 연동규격서

**버전**: 1.1.0
**최종 수정일**: 2025-12-13
**Base URL**: `https://haruittl.asuscomm.com/crm-webapp`

---

## Swagger UI (API 문서)

인터랙티브 API 문서를 다음 URL에서 확인할 수 있습니다:

- **URL**: `/api/docs/`
- **OpenAPI 스펙**: `/apispec.json`

| 접속 환경 | API 문서 열람 | Try it out (테스트) | 서버 정보 |
|-----------|--------------|-------------------|----------|
| 내부망 | ✅ 가능 | ✅ 가능 | ✅ 표시 |
| 외부망 | ✅ 가능 | ❌ 비활성화 | ❌ 숨김 |

> 외부망에서 `/apispec.json` 직접 접근 시 403 Forbidden 응답

---

## 목차

1. [인증](#1-인증)
2. [할일 관리 API](#2-할일-관리-api)
3. [채팅 API](#3-채팅-api)
4. [예약(리마인더) API](#4-예약리마인더-api)
5. [프로모션 API](#5-프로모션-api)
6. [푸시 알림 API](#6-푸시-알림-api)
7. [사용자 관리 API](#7-사용자-관리-api)
8. [WebSocket 이벤트](#8-websocket-이벤트)

---

## 1. 인증

### 1.1 로그인

세션 기반 인증을 사용합니다.

### 보안 설정 (v1.1.0)

| 항목 | 설정값 |
|------|--------|
| 비밀번호 해싱 | bcrypt (rounds=12) |
| CSRF 보호 | Flask-WTF (모든 POST 요청) |
| Rate Limiting | 로그인 5분당 10회, API 분당 200회 |
| 세션 쿠키 | Secure, HttpOnly, SameSite=Lax |
| 세션 만료 | 24시간 |

**Endpoint**: `POST /login`

**Request Body** (form-data):
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| username | string | O | 사용자명 |
| password | string | O | 비밀번호 |

**Response**:
- 성공: 302 Redirect → `/` 또는 `/admin`
- 실패: 로그인 페이지 재렌더링 (에러 메시지 포함)

**쿠키**:
- `session`: Flask 세션 쿠키 (자동 설정)

---

### 1.2 로그아웃

**Endpoint**: `GET /logout`

**Response**: 302 Redirect → `/login`

---

## 2. 할일 관리 API

### 2.1 할일 목록 조회

**Endpoint**: `GET /api/items`

**Query Parameters**:
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| status | string | - | 필터: pending, completed, all |
| assigned_to | string | - | 담당자 필터 |

**Response**:
```json
[
  {
    "id": 1,
    "title": "고객 미팅",
    "content": "상세 내용",
    "date": "2025-12-10",
    "time": "14:00",
    "priority": "high",
    "status": "pending",
    "assigned_to": "홍길동",
    "created_at": "2025-12-09T10:00:00",
    "created_by": "Admin"
  }
]
```

---

### 2.2 할일 생성

**Endpoint**: `POST /api/items`

**Request Body** (JSON):
```json
{
  "title": "할일 제목",
  "content": "상세 내용",
  "date": "2025-12-10",
  "time": "14:00",
  "priority": "high",
  "assigned_to": "홍길동"
}
```

**Response**:
```json
{
  "id": 1,
  "title": "할일 제목",
  ...
}
```

---

### 2.3 할일 수정

**Endpoint**: `PUT /api/items/<id>`

**Request Body** (JSON): 수정할 필드만 포함

**Response**: 수정된 항목 객체

---

### 2.4 할일 삭제

**Endpoint**: `DELETE /api/items/<id>`

**Response**:
```json
{"success": true}
```

---

### 2.5 할일 상태 변경

**Endpoint**: `POST /api/items/<id>/complete`

**Response**:
```json
{"success": true, "status": "completed"}
```

---

### 2.6 엑셀 일괄 업로드

**Endpoint**: `POST /api/items/bulk-upload`

**Request Body** (multipart/form-data):
| 필드 | 타입 | 설명 |
|------|------|------|
| file | file | xlsx/xls 파일 |

**엑셀 컬럼 형식**:
| 컬럼명 | 필수 | 설명 |
|--------|------|------|
| 제목 | O | 할일 제목 |
| 내용 | X | 상세 내용 |
| 날짜 | X | YYYY-MM-DD |
| 시간 | X | HH:MM |
| 우선순위 | X | high/medium/low |
| 담당자 | X | 사용자명 |

**Response**:
```json
{
  "success": true,
  "imported": 10,
  "failed": 0
}
```

---

## 3. 채팅 API

### 3.1 채팅방 목록 조회

**Endpoint**: `GET /api/chats`

**Query Parameters**:
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| limit | int | 0 | 메시지 수 제한 (0=무제한) |

**Response**:
```json
{
  "1": {
    "id": "1",
    "title": "일반 채팅방",
    "participants": ["홍길동", "김철수"],
    "unread_count": 5,
    "last_message": "안녕하세요",
    "last_message_time": "2025-12-10 14:30:00"
  }
}
```

---

### 3.2 채팅방 생성

**Endpoint**: `POST /api/chats`

**Request Body** (JSON):
```json
{
  "title": "새 채팅방",
  "participants": ["홍길동", "김철수"]
}
```

**Response**:
```json
{
  "id": "2",
  "title": "새 채팅방",
  "participants": ["홍길동", "김철수"]
}
```

---

### 3.3 채팅 메시지 조회 (페이지네이션)

**Endpoint**: `GET /api/chats/<chat_id>/messages`

**Query Parameters**:
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| limit | int | 50 | 조회할 메시지 수 |
| offset | int | 0 | 건너뛸 메시지 수 (최신 기준) |

**Response**:
```json
{
  "messages": [
    {
      "id": 12345,
      "username": "홍길동",
      "message": "안녕하세요",
      "timestamp": "2025-12-10 14:30:00.123456",
      "read_by": ["홍길동", "김철수"],
      "file_path": "/uploads/image.jpg",
      "file_name": "image.jpg"
    }
  ],
  "total": 1500,
  "has_more": true,
  "offset": 0,
  "limit": 50
}
```

---

### 3.4 메시지 검색

**Endpoint**: `GET /api/chats/<chat_id>/search`

**Query Parameters**:
| 필드 | 타입 | 설명 |
|------|------|------|
| q | string | 검색어 |
| date | string | 날짜 필터 (YYYY-MM-DD) |

**Response**:
```json
{
  "results": [
    {
      "id": 12345,
      "index": 100,
      "username": "홍길동",
      "message": "검색된 메시지",
      "timestamp": "2025-12-10 14:30:00"
    }
  ],
  "total": 5,
  "query": "검색어",
  "date": ""
}
```

---

### 3.5 채팅 날짜 목록 조회

**Endpoint**: `GET /api/chats/<chat_id>/dates`

**Response**:
```json
{
  "dates": ["2025-12-01", "2025-12-05", "2025-12-10"],
  "total": 3
}
```

---

### 3.6 메시지 컨텍스트 조회

특정 메시지 ID 주변의 메시지를 조회합니다 (검색/날짜 이동용).

**Endpoint**: `GET /api/chats/<chat_id>/messages/context/<msg_id>`

**Query Parameters**:
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| before | int | 25 | 이전 메시지 수 |
| after | int | 25 | 이후 메시지 수 |

**Response**:
```json
{
  "messages": [...],
  "target_index": 25,
  "first_msg_index": 100,
  "total_messages": 1500,
  "has_more_before": true,
  "has_more_after": true
}
```

---

### 3.7 파일 업로드

**Endpoint**: `POST /api/chats/<chat_id>/upload`

**Request Body** (multipart/form-data):
| 필드 | 타입 | 설명 |
|------|------|------|
| files | file[] | 업로드할 파일들 |

**Response**:
```json
{
  "files": [
    {
      "filename": "image.jpg",
      "url": "/uploads/chats/1/abc123_image.jpg",
      "size": 102400
    }
  ]
}
```

---

## 4. 예약(리마인더) API

### 4.1 예약 목록 조회

**Endpoint**: `GET /api/reminders`

**Response**:
```json
[
  {
    "id": 1,
    "title": "고객 미팅",
    "date": "2025-12-10",
    "time": "14:00",
    "status": "pending",
    "assigned_to": "홍길동"
  }
]
```

---

### 4.2 예약 완료 처리

**Endpoint**: `POST /api/reminders/<id>/complete`

**Response**:
```json
{"success": true}
```

---

## 5. 프로모션 API

### 5.1 프로모션 목록 조회

**Endpoint**: `GET /api/promotions`

**Response**:
```json
[
  {
    "id": 1,
    "title": "여름 할인 이벤트",
    "content": "전 품목 20% 할인",
    "created_at": "2025-12-10T10:00:00",
    "created_by": "Admin"
  }
]
```

---

### 5.2 프로모션 생성

**Endpoint**: `POST /api/promotions`

**Request Body** (JSON):
```json
{
  "title": "프로모션 제목",
  "content": "프로모션 내용"
}
```

---

## 6. 푸시 알림 API

### 6.1 VAPID 공개키 조회

**Endpoint**: `GET /api/push/vapid-public-key`

**Response**:
```json
{
  "publicKey": "BBSkW16r_E0ubLKXVNTv..."
}
```

---

### 6.2 푸시 구독 등록

**Endpoint**: `POST /api/push/subscribe`

**Request Body** (JSON):
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

**Response**:
```json
{"success": true}
```

---

### 6.3 푸시 구독 해제

**Endpoint**: `POST /api/push/unsubscribe`

**Request Body** (JSON):
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

---

### 6.4 테스트 알림 발송

**Endpoint**: `POST /api/push/test`

**Response**:
```json
{
  "success": true,
  "sent": 1,
  "failed": 0
}
```

---

### 6.5 알림 설정 조회

**Endpoint**: `GET /api/notification-settings`

**Response**:
```json
{
  "reminder_minutes": 15,
  "repeat_enabled": false,
  "repeat_interval": 5,
  "repeat_until_done": false,
  "morning_summary_enabled": false,
  "morning_summary_time": "08:00"
}
```

---

### 6.6 알림 설정 저장

**Endpoint**: `POST /api/notification-settings`

**Request Body** (JSON):
```json
{
  "reminder_minutes": 30,
  "repeat_enabled": true,
  "repeat_interval": 10,
  "morning_summary_enabled": true,
  "morning_summary_time": "09:00"
}
```

---

## 7. 사용자 관리 API

### 7.1 사용자 검색

**Endpoint**: `GET /api/search_users`

**Query Parameters**:
| 필드 | 타입 | 설명 |
|------|------|------|
| q | string | 검색어 |

**Response**:
```json
["홍길동", "김철수", "이영희"]
```

---

### 7.2 네비게이션 카운트 조회

**Endpoint**: `GET /api/nav-counts`

**Response**:
```json
{
  "pending_tasks": 5,
  "unread_chats": 3,
  "today_reminders": 2
}
```

---

### 7.3 사용자 목록 조회 (관리자)

**Endpoint**: `GET /api/users`

**Response**:
```json
[
  {
    "username": "홍길동",
    "is_admin": false,
    "created_at": "2025-12-01T10:00:00"
  }
]
```

---

### 7.4 사용자 생성 (관리자)

**Endpoint**: `POST /api/users`

**Request Body** (JSON):
```json
{
  "username": "새사용자",
  "password": "password123"
}
```

---

### 7.5 사용자 삭제 (관리자)

**Endpoint**: `DELETE /api/users/<username>`

---

## 8. WebSocket 이벤트

Socket.IO를 사용합니다.

### 8.1 연결

```javascript
const socket = io();
```

---

### 8.2 클라이언트 → 서버 이벤트

#### join
채팅방 입장
```javascript
socket.emit('join', { chat_id: '1', username: '홍길동' });
```

#### leave
채팅방 퇴장
```javascript
socket.emit('leave', { chat_id: '1', username: '홍길동' });
```

#### message
메시지 전송
```javascript
socket.emit('message', {
  chat_id: '1',
  username: '홍길동',
  message: '안녕하세요',
  file_info: [{ filename: 'image.jpg', url: '/uploads/...', size: 1024 }]
});
```

#### typing
타이핑 상태 전송
```javascript
socket.emit('typing', { chat_id: '1', username: '홍길동' });
```

#### stop_typing
타이핑 중지
```javascript
socket.emit('stop_typing', { chat_id: '1', username: '홍길동' });
```

#### mark_as_read
읽음 처리
```javascript
socket.emit('mark_as_read', { chat_id: '1', username: '홍길동' });
```

#### join_user_room
사용자 개인 룸 입장 (전역 알림용)
```javascript
socket.emit('join_user_room', { username: '홍길동' });
```

---

### 8.3 서버 → 클라이언트 이벤트

#### message
새 메시지 수신
```javascript
socket.on('message', (data) => {
  // data: { username, message, timestamp, file_info, read_by }
});
```

#### user_joined
사용자 입장 알림
```javascript
socket.on('user_joined', (data) => {
  // data: { username }
});
```

#### user_left
사용자 퇴장 알림
```javascript
socket.on('user_left', (data) => {
  // data: { username }
});
```

#### user_typing
타이핑 중 알림
```javascript
socket.on('user_typing', (data) => {
  // data: { username }
});
```

#### user_typing_stop
타이핑 중지 알림
```javascript
socket.on('user_typing_stop', (data) => {
  // data: { username }
});
```

#### read_receipt
읽음 상태 업데이트
```javascript
socket.on('read_receipt', (data) => {
  // data: { username, read_by }
});
```

#### nav_counts_update
네비게이션 카운트 업데이트
```javascript
socket.on('nav_counts_update', (counts) => {
  // counts: { pending_tasks, unread_chats, today_reminders }
});
```

---

## 에러 응답

모든 API는 에러 시 다음 형식으로 응답합니다:

```json
{
  "error": "에러 메시지"
}
```

**HTTP 상태 코드**:
| 코드 | 설명 |
|------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-12-10 | 최초 작성 |
| 1.1.0 | 2025-12-13 | Swagger UI 정보, 보안 설정(bcrypt, CSRF, Rate Limit) 추가 |
