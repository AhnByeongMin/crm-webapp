# Claude Code 운영 가이드

## 네트워크 모니터링 (중요!)

### 1. 실시간 연결 모니터링 (30초마다)
- **스크립트**: `/tmp/connection_monitor.sh`
- **로그**: `/var/log/connection_monitor.log`
- **상태 확인**: `pgrep -f connection_monitor.sh`

```bash
# 실시간 로그 확인
tail -f /var/log/connection_monitor.log

# 지금까지 기록된 문제 확인
cat /var/log/connection_monitor.log
```

**감지 항목:**
| 항목 | 의미 |
|------|------|
| ExtHTTP | 외부 도메인으로 HTTPS 접속 (200이면 정상) |
| GW | 공유기 ping (1이면 정상) |
| Ext | 외부 인터넷 ping (1이면 정상) |

**문제 패턴 분석:**
- `GW=0, Ext=0`: 공유기 자체 문제 또는 내부 네트워크 단절
- `GW=1, Ext=0`: 공유기-ISP 간 연결 문제
- `GW=1, Ext=1, ExtHTTP≠200`: 포트포워딩 또는 NAT 문제

### 2. 크론 기반 모니터링 (매 분)
- **스크립트**: `/usr/local/bin/network-monitor.sh`
- **로그**: `/var/log/network-monitor.log`

### 수동 진단
```bash
# 심층 네트워크 진단
bash /home/haruhome/deep_network_check.sh

# 시스템 전체 진단
bash /home/haruhome/system_check.sh
```

---

## nginx 헬스체크

### 스크립트 위치
- `/usr/local/bin/nginx-healthcheck.sh` - 5분마다 실행

### 로그 확인
```bash
cat /var/log/nginx-healthcheck.log
```

---

## CRM 웹앱 (gunicorn)

### 서버 상태 확인
```bash
# 5001, 5002 포트 확인
ss -tlnp | grep -E "500[12]"

# 프로세스 확인
ps aux | grep gunicorn_config
```

### 수동 재시작
```bash
# 5001 서버
cd /svc/was/crm/crm-webapp
/home/haruhome/miniconda3/bin/gunicorn -c gunicorn_config_5001.py app:app --daemon

# 5002 서버
/home/haruhome/miniconda3/bin/gunicorn -c gunicorn_config_5002.py app:app --daemon
```

### 재시작 로그
```bash
cat /svc/was/crm/crm-webapp/logs/restart.log
```

---

## 크론잡 목록

| 스케줄 | 스크립트 | 설명 |
|--------|----------|------|
| 매 분 | `/usr/local/bin/network-monitor.sh` | 네트워크 연결 모니터링 |
| 5분마다 | `/usr/local/bin/nginx-healthcheck.sh` | nginx 헬스체크 |
| 매 시간 | `/usr/local/bin/auto_blacklist_updater.sh` | nginx 자동 방어 |
| 매일 4시 | `/svc/was/crm/crm-webapp/scripts/graceful_restart.sh` | CRM 워커 재시작 |

### 크론잡 확인/수정
```bash
crontab -l    # 확인
crontab -e    # 수정
```

---

## 주요 로그 파일

| 로그 | 경로 |
|------|------|
| 네트워크 모니터링 | `/var/log/network-monitor.log` |
| nginx 헬스체크 | `/var/log/nginx-healthcheck.log` |
| nginx 방어 | `/var/log/nginx_auto_defense.log` |
| CRM 앱 | `/svc/was/crm/crm-webapp/logs/crm.log` |
| CRM 에러 | `/svc/was/crm/crm-webapp/logs/error_5001.log` |
| CRM 재시작 | `/svc/was/crm/crm-webapp/logs/restart.log` |
