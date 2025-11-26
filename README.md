# CRM 웹 애플리케이션

Flask + SocketIO 기반 실시간 채팅 CRM 시스템 (프로덕션 최적화 버전)

## 빠른 시작

### 설치
```bash
cd /svc/was/crm/crm-webapp
pip install -r requirements.txt
```

### 실행
```bash
# 스크립트 사용 (추천)
./scripts/start.sh

# 또는 systemd 서비스
systemctl start crm-webapp
```

### 상태 확인
```bash
./scripts/status.sh
```

### 중지
```bash
./scripts/stop.sh
```

## 주요 기능

### 1. 할일 관리 (관리자)
- ✅ 업무 항목 생성, 수정, 삭제
- ✅ 대상자별 업무 할당 (개별/랜덤/순차)
- ✅ 엑셀 일괄 등록
- ✅ 실시간 업데이트

### 2. 실시간 채팅
- ✅ Socket.IO 기반 실시간 메시징
- ✅ 1:1 채팅 및 그룹 채팅
- ✅ 읽음 표시 (KakaoTalk 스타일)
- ✅ 파일 공유 (클립보드 붙여넣기 지원)
- ✅ 채팅 알림 토글 기능
- ✅ 타이핑 인디케이터

### 3. 프로모션 게시판
- ✅ 관리자: CRUD 권한
- ✅ 일반 사용자: 읽기 권한
- ✅ 상품별/채널별/프로모션별 필터링
- ✅ 실시간 검색

## 관리 스크립트 (⭐ 안전한 포트 관리)

모든 스크립트는 **5000번 포트만** 안전하게 관리합니다
(8501 등 다른 포트의 서비스는 절대 건드리지 않음)

| 스크립트 | 설명 |
|---------|------|
| `scripts/start.sh` | 서비스 시작 |
| `scripts/stop.sh` | 서비스 중지 (5000번 포트만) |
| `scripts/restart.sh` | 서비스 재시작 |
| `scripts/status.sh` | 상태 및 리소스 확인 |

## 기술 스택

- **Backend:** Flask 3.0, Flask-SocketIO 5.3
- **Server:** Gunicorn 21.2 + Eventlet (다중 워커)
- **Database:** SQLite3 (WAL 모드)
- **Frontend:** Vanilla JavaScript, Socket.IO Client

## 성능 최적화

- ✅ Gunicorn + Eventlet 다중 워커 (동시 접속 5-10배 향상)
- ✅ 정적 파일 브라우저 캐싱 (페이지 로드 30-50% 단축)
- ✅ DB 쿼리 최적화 (API 응답 2-3배 향상)
- ✅ N+1 쿼리 제거 (JOIN 사용)
- ✅ 트랜잭션 배치 처리

## 문서

- [DEPLOY.md](DEPLOY.md) - 상세 배포 가이드
- [gunicorn_config.py](gunicorn_config.py) - Gunicorn 설정

## 포트

- **5000:** CRM 웹 애플리케이션 (HTTP + WebSocket)

## 로그 확인

```bash
# 애플리케이션 로그
tail -f logs/access.log
tail -f logs/error.log

# systemd 로그
journalctl -u crm-webapp -f
```

## 재배포

코드 수정 후:

```bash
# 안전한 재시작 (5000번 포트만)
./scripts/restart.sh

# 또는 무중단 리로드
systemctl reload crm-webapp
```

## 문제 해결

```bash
# 상태 확인
./scripts/status.sh

# 로그 확인
tail -100 logs/error.log
journalctl -u crm-webapp -n 100

# 포트 확인
lsof -i :5000
```

상세 내용은 [DEPLOY.md](DEPLOY.md#-문제-해결) 참고
