# CRM 웹 애플리케이션 배포 가이드

## 🚀 성능 개선 사항

### 1. Gunicorn + Eventlet 도입
- 기존: Flask 개발 서버 (단일 스레드)
- 개선: Gunicorn + Eventlet (다중 워커)
- 예상 효과: **동시 접속 처리 속도 5-10배 향상**

### 2. 정적 파일 캐싱
- 기존: 모든 파일 매번 새로 로드
- 개선: CSS/JS/이미지 1시간 캐싱
- 예상 효과: **페이지 로드 속도 30-50% 단축**

### 3. DB 쿼리 최적화
- 기존: 전체 데이터 조회 후 필터링
- 개선: 필요한 데이터만 조회
- 예상 효과: **API 응답 속도 2-3배 향상**

---

## 📦 설치 순서

### 1단계: 패키지 설치
```bash
cd /svc/was/crm/crm-webapp
pip install -r requirements.txt
```

### 2단계: 로그 디렉토리 생성
```bash
mkdir -p /svc/was/crm/crm-webapp/logs
chmod 755 /svc/was/crm/crm-webapp/logs
```

### 3단계: Gunicorn 테스트 실행
```bash
# 현재 실행 중인 프로세스가 있다면 안전하게 종료 (5000번 포트만)
./scripts/stop.sh

# Gunicorn으로 실행 (테스트)
gunicorn -c gunicorn_config.py app:app
```

브라우저에서 `http://서버IP:5000` 접속하여 정상 작동 확인 후 `Ctrl+C`로 종료

**⚠️ 중요:** `scripts/stop.sh`는 5000번 포트만 종료하므로 다른 서비스(8501 등)는 영향 없음

### 4단계: systemd 서비스 등록
```bash
# 서비스 파일 복사
cp /svc/was/crm/crm-webapp/crm-webapp.service /etc/systemd/system/

# systemd 리로드
systemctl daemon-reload

# 서비스 시작
systemctl start crm-webapp

# 서비스 상태 확인
systemctl status crm-webapp

# 부팅 시 자동 시작 설정
systemctl enable crm-webapp
```

---

## 🔧 서비스 관리 명령어

### ⭐ 추천: 안전한 스크립트 사용 (5000번 포트만 관리)
```bash
# 상태 확인
./scripts/status.sh

# 시작
./scripts/start.sh

# 중지 (5000번 포트만 안전하게 종료, 다른 포트는 건드리지 않음)
./scripts/stop.sh

# 재시작
./scripts/restart.sh
```

**⚠️ 중요:**
- 스크립트는 **5000번 포트만** 대상으로 하며, 8501 등 다른 포트의 서비스는 절대 건드리지 않습니다
- `lsof`로 포트를 정확히 확인한 후 해당 프로세스만 종료합니다

### systemd 서비스 명령어
```bash
systemctl start crm-webapp    # 시작
systemctl stop crm-webapp     # 중지 (내부적으로 scripts/stop.sh 사용)
systemctl restart crm-webapp  # 재시작
systemctl reload crm-webapp   # 설정 리로드 (무중단)
```

### 로그 확인
```bash
# 실시간 로그 보기
journalctl -u crm-webapp -f

# 최근 100줄 보기
journalctl -u crm-webapp -n 100

# 오늘 로그만 보기
journalctl -u crm-webapp --since today

# 애플리케이션 로그 파일
tail -f /svc/was/crm/crm-webapp/logs/access.log
tail -f /svc/was/crm/crm-webapp/logs/error.log
```

### 서비스 상태 확인
```bash
systemctl status crm-webapp  # 전체 상태
ps aux | grep gunicorn       # 워커 프로세스 확인
netstat -tlnp | grep 5000    # 포트 확인
```

---

## ⚙️ 설정 조정

### 워커 수 조정 (gunicorn_config.py)
```python
# CPU 코어에 따라 자동 조정 (권장)
workers = multiprocessing.cpu_count() * 2 + 1

# 또는 고정값 설정
workers = 5  # 예: 5개 워커
```

**권장 워커 수:**
- 2 코어 서버: 5개 워커
- 4 코어 서버: 9개 워커
- 8 코어 서버: 17개 워커

### 메모리 사용량 최적화
서버 메모리가 부족할 경우:
```python
# gunicorn_config.py 수정
workers = 3  # 워커 수 감소
max_requests = 500  # 재시작 주기 단축
```

---

## 🔥 방화벽 설정 (필요시)

```bash
# firewalld 사용 시
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload

# iptables 사용 시
iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
service iptables save
```

---

## 🐛 문제 해결

### 1. 서비스가 시작되지 않을 때
```bash
# 상세 에러 확인
journalctl -u crm-webapp -n 50 --no-pager

# 파이썬 경로 확인
which python3
which gunicorn

# 서비스 파일의 ExecStart 경로 수정 필요 시
vi /etc/systemd/system/crm-webapp.service
systemctl daemon-reload
systemctl restart crm-webapp
```

### 2. 포트가 이미 사용 중일 때
```bash
# 5000 포트만 안전하게 종료
./scripts/stop.sh

# 또는 수동으로 확인
lsof -i :5000
netstat -tlnp | grep 5000
```

**⚠️ 주의:** 절대 `pkill python` 같은 명령어 사용 금지! 다른 포트의 Python 서비스도 함께 종료됨

### 3. 권한 문제
```bash
# 앱 디렉토리 권한 확인
ls -la /svc/was/crm/crm-webapp/

# 필요시 권한 조정
chown -R root:root /svc/was/crm/crm-webapp
chmod -R 755 /svc/was/crm/crm-webapp
chmod 644 /svc/was/crm/crm-webapp/crm.db
```

### 4. DB 락 문제
```bash
# DB WAL 모드 확인
sqlite3 /svc/was/crm/crm-webapp/crm.db "PRAGMA journal_mode;"

# WAL 파일 정리
cd /svc/was/crm/crm-webapp
sqlite3 crm.db "VACUUM;"
```

---

## 📊 성능 모니터링

### 리소스 사용량 확인
```bash
# 실시간 프로세스 모니터링
htop

# Gunicorn 워커별 메모리 사용량
ps aux | grep gunicorn | awk '{print $2, $4, $11}' | column -t
```

### 접속자 로그 분석
```bash
# 시간대별 접속 통계
cat /svc/was/crm/crm-webapp/logs/access.log | cut -d' ' -f4 | cut -d':' -f2 | sort | uniq -c

# 가장 많이 호출된 API
cat /svc/was/crm/crm-webapp/logs/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head -10
```

---

## 🔄 코드 업데이트 후 재배포

### 방법 1: 스크립트 사용 (추천)
```bash
cd /svc/was/crm/crm-webapp

# 1. 코드 업데이트 (git pull 또는 파일 수정)
# git pull origin main

# 2. 의존성 업데이트 (필요시)
pip install -r requirements.txt --upgrade

# 3. 안전한 재시작 (5000번 포트만)
./scripts/restart.sh
```

### 방법 2: systemd 사용
```bash
# 무중단 재배포 (권장)
systemctl reload crm-webapp

# 또는 완전 재시작
systemctl restart crm-webapp
```

**⚠️ 중요:** 두 방법 모두 5000번 포트만 안전하게 관리하며, 다른 서비스는 영향 없음

---

## 📌 추가 최적화 옵션 (선택사항)

### Nginx 리버스 프록시 도입
정적 파일을 Nginx가 직접 서빙하면 추가 성능 향상 가능:
```nginx
upstream crm_app {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name your-domain.com;

    # 정적 파일은 Nginx가 직접 서빙
    location /static/ {
        alias /svc/was/crm/crm-webapp/static/;
        expires 1h;
    }

    location /uploads/ {
        alias /svc/was/crm/crm-webapp/uploads/;
        expires 1h;
    }

    # 동적 요청은 Gunicorn으로 프록시
    location / {
        proxy_pass http://crm_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket 지원
    location /socket.io/ {
        proxy_pass http://crm_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## ✅ 배포 체크리스트

- [ ] requirements.txt 패키지 설치 완료
- [ ] logs 디렉토리 생성 완료
- [ ] Gunicorn 테스트 실행 성공
- [ ] systemd 서비스 등록 완료
- [ ] 서비스 자동 시작 설정 완료
- [ ] 방화벽 포트 오픈 완료 (필요시)
- [ ] 웹 브라우저 접속 테스트 완료
- [ ] 채팅 실시간 기능 테스트 완료
- [ ] 로그 파일 생성 확인 완료

---

## 📞 문제 발생 시

1. 로그 확인: `journalctl -u crm-webapp -n 100`
2. 에러 로그: `tail -100 /svc/was/crm/crm-webapp/logs/error.log`
3. 프로세스 상태: `systemctl status crm-webapp`
