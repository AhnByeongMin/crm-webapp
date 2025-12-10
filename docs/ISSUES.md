# 하루CRM 코드 점검 보고서

**버전**: 1.0.0
**점검일**: 2025-12-10

---

## 목차

1. [요약](#1-요약)
2. [높은 심각도](#2-높은-심각도)
3. [중간 심각도](#3-중간-심각도)
4. [낮은 심각도](#4-낮은-심각도)
5. [권장 개선사항](#5-권장-개선사항)

---

## 1. 요약

| 심각도 | 건수 | 상태 |
|--------|------|------|
| 높음 | 5 | 우선 개선 필요 |
| 중간 | 7 | 계획적 개선 |
| 낮음 | 4 | 관찰 |

---

## 2. 높은 심각도

### 2.1 Secret Key 하드코딩

**파일**: app.py:21
**유형**: 보안

```python
app.secret_key = 'your-secret-key-change-in-production'
```

**위험**: 세션 위조 가능
**권장**: 환경변수로 관리
```python
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))
```

---

### 2.2 관리자 계정 하드코딩

**파일**: app.py:52-58
**유형**: 보안

```python
ADMIN_ACCOUNTS = {
    '김은아': 'admin1234',
    ...
}
```

**위험**: 소스 노출 시 계정 유출
**권장**: 데이터베이스에서 관리, 비밀번호 해시 적용

---

### 2.3 SQL Injection 가능성

**파일**: database.py:1056
**유형**: 보안

```python
cursor.execute(f'SELECT MAX(id) FROM {table}')
```

**위험**: 테이블명이 외부 입력일 경우 SQL Injection
**권장**: 화이트리스트 검증
```python
ALLOWED_TABLES = ['tasks', 'reminders', 'messages']
if table not in ALLOWED_TABLES:
    raise ValueError(f"Invalid table: {table}")
```

---

### 2.4 DB 플레이스홀더 불일치

**파일**: app.py:317, 329, 350
**유형**: 버그

```python
cursor.execute('SELECT ... WHERE id = ?', (item_id,))  # SQLite 문법
```

**위험**: PostgreSQL에서는 `?` 대신 `%s` 사용
**권장**:
```python
cursor.execute('SELECT ... WHERE id = %s', (item_id,))
```

---

### 2.5 XSS 취약점

**파일**: templates/admin.html:585, 593
**유형**: 보안

```javascript
modalMessage.innerHTML = message;
return `<button onclick="${btn.onclick}">${btn.text}</button>`;
```

**위험**: 사용자 입력이 HTML로 렌더링
**권장**: textContent 사용 또는 이스케이프 처리

---

## 3. 중간 심각도

### 3.1 None 체크 누락

**파일**: app.py:318, 330, 351
**유형**: 버그

```python
row = cursor.fetchone()
if row['assigned_to'] != session['username']:  # row가 None일 수 있음
```

**권장**:
```python
row = cursor.fetchone()
if row and row['assigned_to'] != session['username']:
```

---

### 3.2 DB 연결 예외 처리 부족

**파일**: database.py:38-48
**유형**: 안정성

```python
@contextmanager
def get_db_connection():
    conn = connection_pool.getconn()  # 실패 시 예외 미처리
```

**권장**: try-except로 연결 실패 처리

---

### 3.3 날짜 파싱 오류 가능성

**파일**: app.py:1038
**유형**: 버그

```python
last_notified = datetime.strptime(last_notified, '%Y-%m-%d %H:%M:%S.%f')
```

**위험**: 마이크로초 없는 경우 ValueError
**권장**: 여러 포맷 시도 또는 dateutil.parser 사용

---

### 3.4 파일 업로드 검증 부족

**파일**: app.py:449-451
**유형**: 보안

```python
if file.filename.rsplit('.', 1)[1].lower() in EXCEL_EXTENSIONS:
```

**위험**: 확장자만 검증, MIME 타입 미검증
**권장**: python-magic으로 실제 파일 타입 확인

---

### 3.5 불완전한 트랜잭션 처리

**파일**: database.py:609-611
**유형**: 데이터 무결성

```python
except Exception as e:
    conn.rollback()
    raise e
```

**권장**: 로깅 추가, 재시도 로직 고려

---

### 3.6 프로덕션 로깅 노출

**파일**: app.py 여러 위치
**유형**: 보안

```python
print(f"Debug: {sensitive_data}")
```

**권장**: logging 모듈 사용, 로그 레벨 관리

---

### 3.7 인라인 이벤트 핸들러

**파일**: templates/admin.html:2455-2457
**유형**: 보안/유지보수

```javascript
return `<button onclick="assignItem(${item.id})">`;
```

**권장**: 이벤트 위임 패턴 사용

---

## 4. 낮은 심각도

### 4.1 일반적인 예외 처리

**파일**: app.py:299, 432, 490 등
**유형**: 디버깅

```python
except Exception as e:
    return jsonify({'error': str(e)}), 500
```

**권장**: 구체적인 예외 타입 처리, 상세 로깅

---

### 4.2 push_helper 예외 처리

**파일**: push_helper.py:196-200
**유형**: 디버깅

```python
print(f"Error saving subscription: {e}")
return False
```

**권장**: 로깅 프레임워크 사용, 에러 코드 반환

---

### 4.3 None 반환 일관성

**파일**: database.py:375, 387
**유형**: 코드 품질

```python
return dict(row) if row else None  # 일부는 빈 딕셔너리 반환
```

**권장**: 반환 타입 일관성 유지

---

### 4.4 커서 누수 가능성

**파일**: app.py:2336-2378
**유형**: 리소스 관리

**권장**: with 문으로 커서 관리 명시

---

## 5. 권장 개선사항

### 5.1 즉시 개선 (1-2주)

1. **Secret Key 환경변수화**
   - `.env` 파일 또는 시스템 환경변수 사용
   - python-dotenv 도입

2. **관리자 계정 DB 이관**
   - users 테이블에 is_admin 컬럼 추가
   - 비밀번호 bcrypt 해시 적용

3. **SQL 플레이스홀더 수정**
   - `?` → `%s` 일괄 변경

### 5.2 단기 개선 (1개월)

1. **로깅 시스템 구축**
   - Python logging 모듈 적용
   - 로그 레벨별 분리 (DEBUG, INFO, ERROR)
   - 파일 로테이션

2. **입력 검증 강화**
   - 파일 업로드 MIME 검증
   - XSS 방지 (escape 처리)

3. **예외 처리 고도화**
   - 구체적 예외 타입 정의
   - 사용자 친화적 에러 메시지

### 5.3 중장기 개선 (3개월)

1. **보안 강화**
   - JWT 인증 도입
   - Rate Limiting
   - CSRF 토큰

2. **코드 품질**
   - 타입 힌트 추가
   - 단위 테스트 작성
   - 코드 리뷰 프로세스

3. **모니터링**
   - 에러 모니터링 (Sentry 등)
   - 성능 모니터링
   - 알림 시스템

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-12-10 | 최초 작성 |
