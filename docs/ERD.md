# 하루CRM ERD 정의서

**버전**: 1.0.0
**최종 수정일**: 2025-12-10
**데이터베이스**: PostgreSQL 15+

---

## 목차

1. [ERD 다이어그램](#1-erd-다이어그램)
2. [테이블 상세 정의](#2-테이블-상세-정의)
3. [인덱스 정의](#3-인덱스-정의)
4. [관계 설명](#4-관계-설명)

---

## 1. ERD 다이어그램

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │     tasks       │       │   reminders     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id          PK  │       │ id          PK  │       │ id          PK  │
│ username    UQ  │◄──────│ assigned_to     │       │ user_id     FK  │──────►│
│ password        │       │ title           │       │ title           │
│ team            │       │ content         │       │ content         │
│ role            │       │ status          │       │ scheduled_date  │
│ status          │       │ team            │       │ scheduled_time  │
│ created_at      │       │ created_at      │       │ is_completed    │
└─────────────────┘       │ assigned_at     │       │ notified_30min  │
        │                 │ completed_at    │       │ last_notified_at│
        │                 │ updated_at      │       │ notification_cnt│
        │                 └─────────────────┘       │ created_at      │
        │                                           │ updated_at      │
        │                                           └─────────────────┘
        │
        │         ┌─────────────────┐       ┌─────────────────┐
        │         │     chats       │       │    messages     │
        │         ├─────────────────┤       ├─────────────────┤
        │         │ id          PK  │◄──────│ chat_id     FK  │
        │         │ title           │       │ id          PK  │
        │         │ creator         │       │ username        │
        │         │ created_at      │       │ message         │
        │         └────────┬────────┘       │ timestamp       │
        │                  │                │ file_path       │
        │                  │                │ file_name       │
        │                  ▼                └────────┬────────┘
        │         ┌─────────────────┐                │
        │         │chat_participants│                │
        │         ├─────────────────┤                ▼
        └────────►│ chat_id     FK  │       ┌─────────────────┐
                  │ username    FK  │       │  message_reads  │
                  │ id          PK  │       ├─────────────────┤
                  └─────────────────┘       │ id          PK  │
                                            │ message_id  FK  │
                                            │ username        │
                                            └─────────────────┘

┌─────────────────┐       ┌─────────────────────────┐
│   promotions    │       │promotion_subscription_  │
├─────────────────┤       │        types            │
│ id          PK  │◄──────├─────────────────────────┤
│ category        │       │ id                  PK  │
│ product_name    │       │ promotion_id        FK  │
│ channel         │       │ subscription_type       │
│ promotion_name  │       └─────────────────────────┘
│ promotion_code  │
│ content         │
│ start_date      │       ┌─────────────────────────┐
│ end_date        │       │push_subscriptions       │
│ discount_amount │       ├─────────────────────────┤
│ session_exempt  │       │ id                  PK  │
│ created_at      │       │ username            FK  │
│ updated_at      │       │ endpoint            UQ  │
│ created_by      │       │ p256dh                  │
└─────────────────┘       │ auth                    │
                          │ created_at              │
                          │ updated_at              │
┌─────────────────┐       └─────────────────────────┘
│   holidays      │
├─────────────────┤       ┌─────────────────────────┐
│ id          PK  │       │user_notification_       │
│ holiday_date    │       │      settings           │
│ holiday_name    │       ├─────────────────────────┤
│ year            │       │ id                  PK  │
│ created_at      │       │ username            FK  │
└─────────────────┘       │ reminder_minutes        │
                          │ repeat_enabled          │
                          │ repeat_interval         │
                          │ repeat_until_minutes    │
                          │ daily_summary_enabled   │
                          │ daily_summary_time      │
                          │ last_daily_summary_date │
                          │ created_at              │
                          │ updated_at              │
                          └─────────────────────────┘
```

---

## 2. 테이블 상세 정의

### 2.1 users (사용자)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| username | TEXT | NO | - | 사용자명 (UQ) |
| password | TEXT | YES | - | 비밀번호 (해시) |
| team | TEXT | YES | - | 소속 팀 |
| role | TEXT | YES | '상담사' | 역할 (상담사/관리자) |
| status | TEXT | YES | 'active' | 상태 (active/inactive) |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 생성일시 |

---

### 2.2 tasks (할일)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| assigned_to | TEXT | YES | - | 담당자 (users.username) |
| title | TEXT | NO | - | 제목 |
| content | TEXT | NO | - | 내용 |
| status | TEXT | NO | '대기중' | 상태 (대기중/처리중/완료/보류) |
| team | TEXT | YES | - | 담당 팀 |
| created_at | TIMESTAMP | NO | - | 생성일시 |
| assigned_at | TIMESTAMP | YES | - | 배정일시 |
| completed_at | TIMESTAMP | YES | - | 완료일시 |
| updated_at | TIMESTAMP | YES | - | 수정일시 |

---

### 2.3 chats (채팅방)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| title | TEXT | NO | - | 채팅방 제목 |
| creator | TEXT | NO | - | 생성자 |
| created_at | TIMESTAMP | NO | - | 생성일시 |

---

### 2.4 chat_participants (채팅 참여자)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| chat_id | INTEGER | NO | - | FK → chats.id |
| username | TEXT | NO | - | 참여자명 |

**제약조건**: UNIQUE(chat_id, username)

---

### 2.5 messages (채팅 메시지)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| chat_id | INTEGER | NO | - | FK → chats.id |
| username | TEXT | NO | - | 발신자 |
| message | TEXT | NO | - | 메시지 내용 |
| timestamp | TIMESTAMP | NO | - | 전송 시간 |
| file_path | TEXT | YES | - | 첨부파일 경로 |
| file_name | TEXT | YES | - | 첨부파일명 |

---

### 2.6 message_reads (메시지 읽음 상태)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| message_id | INTEGER | NO | - | FK → messages.id |
| username | TEXT | NO | - | 읽은 사용자 |

**제약조건**: UNIQUE(message_id, username)

---

### 2.7 reminders (예약/리마인더)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| user_id | TEXT | NO | - | 사용자명 |
| title | TEXT | NO | - | 제목 |
| content | TEXT | YES | - | 내용 |
| scheduled_date | TEXT | NO | - | 예약일 (YYYY-MM-DD) |
| scheduled_time | TEXT | NO | - | 예약시간 (HH:MM) |
| is_completed | INTEGER | YES | 0 | 완료 여부 (0/1) |
| notified_30min | INTEGER | YES | 0 | 30분 전 알림 여부 |
| last_notified_at | TIMESTAMP | YES | - | 마지막 알림 시간 |
| notification_count | INTEGER | YES | 0 | 알림 발송 횟수 |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 수정일시 |

---

### 2.8 promotions (프로모션)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| category | TEXT | NO | - | 카테고리 |
| product_name | TEXT | NO | - | 상품명 |
| channel | TEXT | NO | - | 채널 |
| promotion_name | TEXT | NO | - | 프로모션명 |
| promotion_code | TEXT | YES | - | 프로모션 코드 |
| content | TEXT | NO | - | 내용 |
| start_date | TEXT | NO | - | 시작일 |
| end_date | TEXT | NO | - | 종료일 |
| discount_amount | TEXT | YES | - | 할인금액 |
| session_exemption | TEXT | YES | - | 세션 면제 |
| created_at | TIMESTAMP | NO | - | 생성일시 |
| updated_at | TIMESTAMP | NO | - | 수정일시 |
| created_by | TEXT | NO | - | 생성자 |

---

### 2.9 promotion_subscription_types (프로모션 가입유형)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| promotion_id | INTEGER | NO | - | FK → promotions.id |
| subscription_type | TEXT | NO | - | 가입유형 |

---

### 2.10 push_subscriptions (푸시 구독)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| username | VARCHAR | NO | - | 사용자명 |
| endpoint | TEXT | NO | - | 푸시 엔드포인트 (UQ) |
| p256dh | TEXT | NO | - | 공개키 |
| auth | TEXT | NO | - | 인증키 |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 수정일시 |

---

### 2.11 user_notification_settings (사용자 알림 설정)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| username | TEXT | NO | - | 사용자명 (UQ) |
| reminder_minutes | INTEGER | YES | 30 | 알림 시간 (분 전) |
| repeat_enabled | BOOLEAN | YES | false | 반복 알림 여부 |
| repeat_interval | INTEGER | YES | 5 | 반복 간격 (분) |
| repeat_until_minutes | INTEGER | YES | 0 | 반복 종료 시점 (분) |
| daily_summary_enabled | BOOLEAN | YES | true | 일일 요약 여부 |
| daily_summary_time | TEXT | YES | '09:00' | 일일 요약 시간 |
| last_daily_summary_date | TEXT | YES | - | 마지막 일일 요약 날짜 |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 수정일시 |

---

### 2.12 holidays (공휴일)

| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|-------------|------|--------|------|
| id | SERIAL | NO | auto | PK |
| holiday_date | DATE | NO | - | 공휴일 날짜 |
| holiday_name | TEXT | NO | - | 공휴일명 |
| year | INTEGER | NO | - | 연도 |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 생성일시 |

---

## 3. 인덱스 정의

```sql
-- users
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- tasks
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- chats
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);

-- chat_participants
CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX idx_chat_participants_username ON chat_participants(username);
CREATE UNIQUE INDEX idx_chat_participants_unique ON chat_participants(chat_id, username);

-- messages
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_chat_timestamp ON messages(chat_id, timestamp DESC);

-- message_reads
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE UNIQUE INDEX idx_message_reads_unique ON message_reads(message_id, username);

-- reminders
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_date, scheduled_time);

-- push_subscriptions
CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_push_subscriptions_username ON push_subscriptions(username);

-- user_notification_settings
CREATE UNIQUE INDEX idx_user_notification_settings_username ON user_notification_settings(username);

-- holidays
CREATE UNIQUE INDEX idx_holidays_date ON holidays(holiday_date);
```

---

## 4. 관계 설명

### 4.1 사용자 ↔ 할일
- users.username → tasks.assigned_to (1:N)
- 한 사용자는 여러 할일을 배정받을 수 있음

### 4.2 채팅방 ↔ 참여자
- chats.id → chat_participants.chat_id (1:N)
- 한 채팅방에 여러 참여자 가능

### 4.3 채팅방 ↔ 메시지
- chats.id → messages.chat_id (1:N)
- 한 채팅방에 여러 메시지 가능

### 4.4 메시지 ↔ 읽음상태
- messages.id → message_reads.message_id (1:N)
- 한 메시지를 여러 사용자가 읽을 수 있음

### 4.5 프로모션 ↔ 가입유형
- promotions.id → promotion_subscription_types.promotion_id (1:N)
- 한 프로모션에 여러 가입유형 가능

### 4.6 사용자 ↔ 푸시구독
- users.username → push_subscriptions.username (1:1)
- 한 사용자는 하나의 푸시 구독만 유지 (최신 것만)

### 4.7 사용자 ↔ 알림설정
- users.username → user_notification_settings.username (1:1)
- 한 사용자는 하나의 알림 설정

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-12-10 | 최초 작성 |
