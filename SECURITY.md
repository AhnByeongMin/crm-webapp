# 보안 가이드

## 개요
HTTP 환경(포트포워딩 방식)에서 운영되는 Flask CRM 웹 애플리케이션의 보안 강화 사항

**보안 업데이트 날짜**: 2025-12-04
**적용 버전**: 1.1

---

## 적용된 보안 조치

### 1. 브라우저 콘솔 및 개발자 도구 차단 ⭐
프로덕션 환경(localhost 제외)에서 브라우저 개발자 도구 사용 차단

**차단 항목**:
- ✅ F12 (개발자 도구)
- ✅ Ctrl+Shift+I (개발자 도구)
- ✅ Ctrl+Shift+J (콘솔)
- ✅ Ctrl+Shift+C (요소 검사)
- ✅ Ctrl+U (소스 보기)
- ✅ 우클릭 메뉴 (컨텍스트 메뉴)
- ✅ 콘솔 API 비활성화 (console.log, console.error 등)
- ✅ 개발자 도구 열림 감지

**구현 위치**: `security_config.py` → `CONSOLE_DISABLE_SCRIPT`

**예외**: localhost (127.0.0.1)에서는 개발을 위해 모든 도구 사용 가능

---

### 2. Rate Limiting (요청 제한)
IP 기반 요청 빈도 제한으로 무차별 대입 공격(Brute Force) 방어

**제한 설정**:
- **로그인 엔드포인트**: 분당 10회 요청 제한
- **일반 API**: 기본 60초에 60회 요청 제한 (커스터마이징 가능)
- **차단 시간**: 15분 (5회 로그인 실패 시)

**구현**:
```python
@app.route('/login')
@rate_limit(max_requests=10, window_seconds=60)
def login():
    ...
```

**동작**:
- 제한 초과 시 `429 Too Many Requests` 응답
- IP별 독립적 추적 (localhost 제외)
- 자동 데이터 정리 (메모리 최적화)

---

### 3. 로그인 시도 추적 및 계정 잠금
반복적인 로그인 실패 시 자동 차단

**보호 메커니즘**:
- **최대 실패 횟수**: 5회
- **차단 기간**: 15분
- **추적 방식**: IP 기반
- **리셋**: 로그인 성공 또는 1시간 경과 시

**사용자 피드백**:
```
로그인 시도 횟수를 초과했습니다. 14분 32초 후 다시 시도하세요.
```

---

### 4. 보안 HTTP 헤더
다양한 웹 공격 벡터 차단

**적용된 헤더**:

#### XSS 보호
```
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```
- MIME 타입 스니핑 차단
- 브라우저 내장 XSS 필터 활성화

#### 클릭재킹 방어
```
X-Frame-Options: SAMEORIGIN
```
- iframe 삽입 제한 (동일 출처만 허용)

#### Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self';
                         script-src 'self' 'unsafe-inline' 'unsafe-eval';
                         style-src 'self' 'unsafe-inline';
                         img-src 'self' data: blob:;
                         font-src 'self' data:;
                         connect-src 'self' ws: wss:;
                         frame-ancestors 'self';
                         base-uri 'self';
                         form-action 'self';
```
- 외부 스크립트 로드 차단
- WebSocket 통신 허용 (Socket.IO)
- 인라인 스크립트 제한적 허용

#### 기타 보안 헤더
```
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), ...
```
- Referrer 정보 제한
- 민감한 브라우저 API 접근 차단

---

### 5. 세션 보안 강화
안전한 세션 관리 설정

**설정**:
```python
SESSION_COOKIE_HTTPONLY = True     # JavaScript 접근 차단
SESSION_COOKIE_SAMESITE = 'Lax'    # CSRF 보호
SESSION_COOKIE_NAME = 'crm_session' # 커스텀 쿠키 이름
PERMANENT_SESSION_LIFETIME = 12시간  # 자동 로그아웃
```

**주의**: `SESSION_COOKIE_SECURE=False` (HTTP 환경이므로 HTTPS에서만 True)

---

### 6. SECRET_KEY 보안
고정된 시크릿 키 대신 환경변수 또는 자동 생성

**기존 (취약)**:
```python
app.secret_key = 'your-secret-key-change-in-production'
```

**개선**:
```python
app.secret_key = os.environ.get('FLASK_SECRET_KEY', generate_secret_key())
```

**권장 사항**:
```bash
# 환경변수 설정 (서버 재시작 시 변경되지 않음)
export FLASK_SECRET_KEY="생성된_64자_랜덤_문자열"
```

---

## 보안 테스트

### 1. 보안 헤더 확인
```bash
curl -I http://58.232.66.210:5000/
```

**확인 항목**:
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Content-Security-Policy
- ✅ Referrer-Policy
- ✅ Permissions-Policy

### 2. Rate Limiting 테스트
```bash
# 연속 15회 로그인 시도
for i in {1..15}; do
  curl -X POST http://58.232.66.210:5000/login \
       -d "username=test&password=wrong" \
       -c cookies.txt -b cookies.txt
done
```

**예상 결과**: 10회 이후 `429 Too Many Requests` 응답

### 3. 콘솔 비활성화 확인
1. 브라우저에서 `http://58.232.66.210:5000` 접속
2. F12 키 → 차단 확인
3. 우클릭 → 비활성화 확인
4. 콘솔에서 `console.log('test')` → 출력 없음

---

## 추가 권장 사항

### 1. HTTPS 마이그레이션 (장기)
현재 HTTP 환경이므로 다음 보안 기능 미적용:
- ❌ HSTS (Strict-Transport-Security)
- ❌ Secure Cookie Flag

**해결책**:
- Let's Encrypt 무료 SSL 인증서
- Cloudflare Tunnel (도메인 없이 가능)
- Nginx SSL Termination

### 2. IP 화이트리스트 (선택)
특정 IP 대역만 접근 허용

**방화벽 설정 예시**:
```bash
# 방화벽에서 5000번 포트 제거
sudo firewall-cmd --permanent --remove-port=5000/tcp

# 특정 IP 대역만 허용 (Rich Rule)
sudo firewall-cmd --permanent --add-rich-rule='
  rule family="ipv4"
  source address="192.168.50.0/24"
  port port="5000" protocol="tcp"
  accept'

sudo firewall-cmd --reload
```

### 3. 실패한 로그인 로깅
로그인 실패 이력을 파일 또는 DB에 기록

**구현 예시**:
```python
# security_config.py에 추가
def log_failed_login(ip, username, timestamp):
    with open('/var/log/crm/failed_logins.log', 'a') as f:
        f.write(f"{timestamp} | IP: {ip} | User: {username}\n")
```

### 4. 2FA (Two-Factor Authentication)
추가 인증 계층 (Google Authenticator, SMS)

**라이브러리**:
- `pyotp` (TOTP)
- `Flask-Security-Too`

### 5. 정기적인 보안 감사
```bash
# 의존성 취약점 검사
pip install safety
safety check

# 코드 보안 스캔
pip install bandit
bandit -r /svc/was/crm/crm-webapp/
```

---

## 현재 남은 위험 요소

### 1. HTTP 통신 (중간자 공격)
**위험도**: 🔴 높음
**설명**: 모든 통신이 평문으로 전송되어 패킷 스니핑 가능
**완화책**:
- 내부 네트워크에서만 사용
- VPN 터널 사용
- HTTPS 마이그레이션

### 2. SQL Injection
**위험도**: 🟡 중간
**설명**: 현재 파라미터 바인딩 사용 중이지만 검증 필요
**완화책**: 입력값 검증 강화, ORM 사용 확대

### 3. 파일 업로드 취약점
**위험도**: 🟡 중간
**설명**: 50MB 파일 업로드 허용, 악성 파일 검증 부족
**완화책**:
- 파일 타입 화이트리스트 엄격화
- 파일 크기 제한 재검토
- 업로드 디렉토리 실행 권한 제거

---

## 보안 설정 파일

### 주요 파일
- `security_config.py`: 모든 보안 설정 및 유틸리티
- `app.py`: 보안 기능 통합 (rate_limit, headers, login_tracker)
- `templates/includes/header.html`: 콘솔 비활성화 스크립트 주입

### 환경변수 (선택)
```bash
# .env 파일 또는 시스템 환경변수
export FLASK_SECRET_KEY="your-64-char-random-string"
export FLASK_ENV="production"
```

---

## 보안 업데이트 이력

| 날짜 | 버전 | 변경사항 |
|------|------|----------|
| 2025-12-04 | 1.1 | 초기 보안 강화 (콘솔 차단, Rate Limiting, 보안 헤더, 세션 보안) |

---

## 문의
보안 이슈 발견 시 즉시 관리자에게 보고하세요.

**연락처**: Local Admin
**긴급 상황**: 서버 즉시 중지 (`./scripts/stop.sh`)

---

**⚠️ 주의**: 이 문서는 외부에 공개하지 마세요. 내부 보안 가이드입니다.
