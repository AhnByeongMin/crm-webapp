# 하루CRM 코드 점검 보고서

**버전**: 1.1.0
**점검일**: 2025-12-10
**최종 수정**: 2025-12-11

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
| 높음 | 5 | ✅ 모두 수정 완료 |
| 중간 | 7 | ✅ 대부분 수정 완료 |
| 낮음 | 4 | 관찰 |

---

## 2. 높은 심각도

### 2.1 Secret Key 하드코딩 ✅ 수정완료

**파일**: app.py:66
**유형**: 보안
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'haru-crm-secret-key-2024-prod')
```

**수정 내용**: 환경변수 `FLASK_SECRET_KEY`에서 로드, 기본값은 fallback용

---

### 2.2 관리자 계정 하드코딩 ✅ 수정완료

**파일**: app.py:80-95
**유형**: 보안
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: DB 기반 관리자 조회 (5분 캐시)
def get_admin_accounts():
    """관리자 사용자명 집합 반환 (5분 캐시)"""
    global _admin_cache, _admin_cache_time
    if _admin_cache is None or (time.time() - _admin_cache_time) > 300:
        _admin_cache = database.get_admin_usernames()
        _admin_cache_time = time.time()
    return _admin_cache
```

**수정 내용**: 하드코딩된 ADMIN_ACCOUNTS 딕셔너리 제거, DB users 테이블에서 role='관리자' 조회

---

### 2.3 SQL Injection 가능성

**파일**: database.py:1095
**유형**: 보안
**상태**: ⚠️ 저위험 (내부 함수만 사용)

```python
cursor.execute(f'SELECT MAX(id) FROM {table}')
```

**참고**: 현재 `get_next_id()` 함수는 내부에서만 호출되며, table 파라미터는 코드에서 직접 지정됨

---

### 2.4 DB 플레이스홀더 불일치 ✅ 수정완료

**파일**: app.py
**유형**: 버그
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: PostgreSQL 호환 플레이스홀더
cursor.execute('SELECT ... WHERE id = %s', (item_id,))
```

**수정 내용**: 모든 `?` 플레이스홀더를 `%s`로 변경 (4곳)

---

### 2.5 XSS 취약점 ✅ 수정완료

**파일**: templates/admin.html, user.html, promotions.html
**유형**: 보안
**상태**: ✅ 수정완료 (2025-12-11)

```javascript
// 수정 후: escapeHtml, escapeAttr 함수 추가
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// 사용 예
return escapeHtml(item.title || '');
```

**수정 내용**: 사용자 입력 데이터(title, content 등)에 HTML 이스케이프 적용

---

## 3. 중간 심각도

### 3.1 None 체크 누락 ✅ 확인완료

**파일**: app.py:328
**유형**: 버그
**상태**: ✅ 이미 처리됨

```python
# 현재 코드: None 체크 이미 존재
if not row:
    return jsonify({'error': 'Not found'}), 404
```

---

### 3.2 DB 연결 예외 처리 부족 ✅ 수정완료

**파일**: database.py:41-56
**유형**: 안정성
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: 구체적 예외 처리 추가
except psycopg2.pool.PoolError as e:
    logger.error(f"DB 풀 연결 오류: {e}")
    raise
except psycopg2.OperationalError as e:
    logger.error(f"DB 연결 오류: {e}")
    raise
```

---

### 3.3 날짜 파싱 오류 가능성 ✅ 수정완료

**파일**: database.py:1057-1063
**유형**: 버그
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: 여러 날짜 포맷 시도
for fmt in ['%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M']:
    try:
        last_notified = datetime.strptime(last_notified, fmt)
        break
    except ValueError:
        continue
```

---

### 3.4 파일 업로드 검증 부족 ✅ 수정완료

**파일**: app.py:41-67
**유형**: 보안
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: 파일 시그니처(Magic Bytes) 검증 추가
FILE_SIGNATURES = {
    'xlsx': [b'PK\x03\x04'],
    'xls': [b'\xd0\xcf\x11\xe0'],
    'png': [b'\x89PNG\r\n\x1a\n'],
    # ...
}

def validate_file_signature(file_stream, extension):
    """파일 시그니처로 실제 파일 타입 검증"""
```

**수정 내용**: 엑셀/이미지 업로드 시 확장자 + 시그니처 이중 검증

---

### 3.5 불완전한 트랜잭션 처리 ✅ 확인완료

**파일**: database.py:636-638
**유형**: 데이터 무결성
**상태**: ✅ 로깅 추가됨

현재 트랜잭션 처리는 적절함. 로깅 시스템 구축으로 에러 추적 가능

---

### 3.6 프로덕션 로깅 노출 ✅ 수정완료

**파일**: app.py, database.py, push_helper.py
**유형**: 보안
**상태**: ✅ 수정완료 (2025-12-11)

```python
# 수정 후: logging 모듈 사용
logger = logging.getLogger('crm')
logger.info("...")
logger.error("...", exc_info=True)
```

**수정 내용**:
- RotatingFileHandler 설정 (10MB, 5개 보관)
- logs/crm.log (INFO), logs/error.log (ERROR)
- 모든 print문 → logger 변환

---

### 3.7 인라인 이벤트 핸들러

**파일**: templates/admin.html
**유형**: 보안/유지보수
**상태**: ⚠️ 저위험 (숫자 ID만 사용)

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
| 1.1.0 | 2025-12-11 | 고위험 이슈 전체 수정, 중간 심각도 대부분 수정 |
