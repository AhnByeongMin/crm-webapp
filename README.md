# CRM 웹 애플리케이션

Flask 기반의 실시간 채팅 및 업무 관리 시스템

## 주요 기능

### 1. 할일 관리 (Admin)
- 업무 항목 생성, 수정, 삭제
- 대상자별 업무 할당
- 실시간 업데이트

### 2. 실시간 채팅
- Socket.IO 기반 실시간 메시징
- 1:1 채팅 및 그룹 채팅
- 읽음 표시 (KakaoTalk 스타일)
- 파일 공유 (클립보드 붙여넣기 지원)
- 채팅 알림 토글 기능

### 3. 프로모션 게시판
- 관리자: CRUD 권한
- 일반 사용자: 읽기 권한
- 상품별/채널별/프로모션별 필터링 및 검색

## 기술 스택

- Backend: Flask 3.1.0
- Real-time: Flask-SocketIO 5.4.1
- Data Storage: JSON 파일
- Frontend: Vanilla JavaScript

## 설치 방법

```bash
pip install -r requirements.txt
python app.py
```

## 서버 주소

- http://127.0.0.1:5000
- http://172.31.13.99:5000
