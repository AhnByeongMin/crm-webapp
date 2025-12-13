"""
Rate Limiting 모듈
로그인 시도 및 API 요청 제한
"""

from flask import request, jsonify, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging
import time
from functools import wraps

logger = logging.getLogger('crm')

# 실패한 로그인 시도 추적 (메모리 기반, 프로덕션에서는 Redis 사용 권장)
_login_attempts = {}
_login_lockout = {}

# 설정
MAX_LOGIN_ATTEMPTS = 5  # 최대 로그인 시도 횟수
LOCKOUT_DURATION = 300  # 잠금 시간 (초) - 5분
ATTEMPT_WINDOW = 60     # 시도 횟수 카운트 윈도우 (초) - 1분


def get_client_ip():
    """실제 클라이언트 IP 주소 가져오기 (프록시 환경 지원)"""
    # Nginx 프록시 뒤에서는 X-Real-IP 또는 X-Forwarded-For 헤더 사용
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    if request.headers.get('X-Forwarded-For'):
        # 첫 번째 IP가 실제 클라이언트
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr


def create_limiter(app):
    """Flask-Limiter 인스턴스 생성"""
    limiter = Limiter(
        app=app,
        key_func=get_client_ip,
        storage_uri="redis://127.0.0.1:6379/1",  # Redis DB 1 사용
        storage_options={"socket_connect_timeout": 5},
        strategy="fixed-window",
        default_limits=["200 per minute", "1000 per hour"],  # 기본 제한
        headers_enabled=True,  # Rate limit 헤더 추가
        retry_after="delta-seconds"
    )

    # 제한 초과 시 에러 핸들러
    @app.errorhandler(429)
    def ratelimit_handler(e):
        logger.warning(f"Rate limit exceeded: {get_client_ip()} - {request.path}")
        return jsonify({
            'error': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            'retry_after': e.description
        }), 429

    return limiter


def check_login_lockout(username):
    """로그인 잠금 상태 확인"""
    ip = get_client_ip()
    key = f"{ip}:{username}"

    if key in _login_lockout:
        lockout_time = _login_lockout[key]
        if time.time() < lockout_time:
            remaining = int(lockout_time - time.time())
            return True, remaining
        else:
            # 잠금 해제
            del _login_lockout[key]
            if key in _login_attempts:
                del _login_attempts[key]

    return False, 0


def record_login_attempt(username, success=False):
    """로그인 시도 기록"""
    ip = get_client_ip()
    key = f"{ip}:{username}"
    current_time = time.time()

    if success:
        # 성공 시 기록 초기화
        if key in _login_attempts:
            del _login_attempts[key]
        if key in _login_lockout:
            del _login_lockout[key]
        return

    # 실패 시 카운트 증가
    if key not in _login_attempts:
        _login_attempts[key] = []

    # 오래된 시도 제거
    _login_attempts[key] = [
        t for t in _login_attempts[key]
        if current_time - t < ATTEMPT_WINDOW
    ]

    # 새 시도 추가
    _login_attempts[key].append(current_time)

    # 최대 시도 횟수 초과 시 잠금
    if len(_login_attempts[key]) >= MAX_LOGIN_ATTEMPTS:
        _login_lockout[key] = current_time + LOCKOUT_DURATION
        logger.warning(f"Login lockout: IP={ip}, username={username}")
        return True

    return False


def get_remaining_attempts(username):
    """남은 로그인 시도 횟수"""
    ip = get_client_ip()
    key = f"{ip}:{username}"

    current_time = time.time()

    if key in _login_attempts:
        # 유효한 시도만 카운트
        valid_attempts = [
            t for t in _login_attempts[key]
            if current_time - t < ATTEMPT_WINDOW
        ]
        return MAX_LOGIN_ATTEMPTS - len(valid_attempts)

    return MAX_LOGIN_ATTEMPTS


def require_not_locked(f):
    """로그인 잠금 상태 확인 데코레이터"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # POST 요청에서 username 추출
        username = request.form.get('username', '') or request.json.get('username', '') if request.is_json else ''

        if username:
            locked, remaining = check_login_lockout(username)
            if locked:
                return jsonify({
                    'error': f'너무 많은 로그인 시도로 계정이 잠겼습니다. {remaining}초 후 다시 시도해주세요.',
                    'locked': True,
                    'retry_after': remaining
                }), 429

        return f(*args, **kwargs)
    return decorated_function


# Rate limit 규칙 정의 (문자열 형태)
RATE_LIMITS = {
    # 인증 관련 (엄격)
    'login': "5 per minute",
    'register': "3 per minute",
    'password_reset': "3 per hour",

    # 일반 API (보통)
    'api': "60 per minute",
    'search': "30 per minute",

    # 파일 업로드 (제한적)
    'upload': "10 per minute",

    # 채팅 (높은 빈도 허용)
    'chat_send': "60 per minute",
    'chat_read': "120 per minute",

    # 관리자 기능
    'admin': "100 per minute",
}


def get_limit_string(category):
    """카테고리별 제한 문자열 반환"""
    return RATE_LIMITS.get(category, "60 per minute")


# 클린업 함수 (주기적으로 호출 권장)
def cleanup_old_attempts():
    """오래된 로그인 시도 기록 정리"""
    current_time = time.time()

    # 잠금 해제된 항목 정리
    expired_lockouts = [
        key for key, lockout_time in _login_lockout.items()
        if current_time >= lockout_time
    ]
    for key in expired_lockouts:
        del _login_lockout[key]

    # 오래된 시도 기록 정리
    for key in list(_login_attempts.keys()):
        _login_attempts[key] = [
            t for t in _login_attempts[key]
            if current_time - t < ATTEMPT_WINDOW
        ]
        if not _login_attempts[key]:
            del _login_attempts[key]
