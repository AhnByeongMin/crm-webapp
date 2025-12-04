"""
보안 설정 모듈
HTTP 환경에서의 보안 강화 설정
"""
import secrets
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timedelta
import threading

# ==================== Rate Limiting ====================
class RateLimiter:
    """간단한 Rate Limiter (IP 기반)"""
    def __init__(self):
        self.requests = {}  # {ip: [(timestamp, endpoint), ...]}
        self.lock = threading.Lock()
        self.cleanup_interval = 60  # 1분마다 정리
        self.last_cleanup = datetime.now()

    def is_allowed(self, ip, endpoint, max_requests=60, window_seconds=60):
        """
        IP당 시간 창 내 요청 허용 여부
        기본: 60초에 60개 요청 (초당 1개)
        """
        with self.lock:
            now = datetime.now()

            # 주기적으로 오래된 데이터 정리
            if (now - self.last_cleanup).seconds > self.cleanup_interval:
                self._cleanup()
                self.last_cleanup = now

            # IP의 요청 기록 가져오기
            if ip not in self.requests:
                self.requests[ip] = []

            # 시간 창 밖의 요청 제거
            cutoff_time = now - timedelta(seconds=window_seconds)
            self.requests[ip] = [
                (ts, ep) for ts, ep in self.requests[ip]
                if ts > cutoff_time
            ]

            # 현재 endpoint에 대한 요청 수 확인
            endpoint_requests = [
                ep for ts, ep in self.requests[ip]
                if ep == endpoint
            ]

            if len(endpoint_requests) >= max_requests:
                return False

            # 요청 기록
            self.requests[ip].append((now, endpoint))
            return True

    def _cleanup(self):
        """오래된 데이터 정리"""
        now = datetime.now()
        cutoff_time = now - timedelta(seconds=300)  # 5분 이전 데이터 삭제

        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                (ts, ep) for ts, ep in self.requests[ip]
                if ts > cutoff_time
            ]
            # 빈 리스트는 삭제
            if not self.requests[ip]:
                del self.requests[ip]

# 전역 Rate Limiter 인스턴스
rate_limiter = RateLimiter()

def rate_limit(max_requests=60, window_seconds=60):
    """Rate limit 데코레이터"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            ip = request.remote_addr
            endpoint = request.endpoint or 'unknown'

            # localhost는 rate limit 제외
            if ip in ['127.0.0.1', 'localhost', '::1']:
                return f(*args, **kwargs)

            if not rate_limiter.is_allowed(ip, endpoint, max_requests, window_seconds):
                return jsonify({
                    'error': 'Too many requests',
                    'message': f'{window_seconds}초에 최대 {max_requests}개 요청만 가능합니다.'
                }), 429

            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ==================== 보안 헤더 ====================
def add_security_headers(response):
    """보안 헤더 추가"""
    # XSS 보호
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'

    # HTTP 환경이므로 HSTS는 제외 (HTTPS 전용)
    # response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # CSP (Content Security Policy) - 인라인 스크립트 허용하되 제한적으로
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Socket.IO 등을 위해 unsafe-inline 필요
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss:; "  # WebSocket 지원
        "frame-ancestors 'self'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    response.headers['Content-Security-Policy'] = csp

    # Referrer 정책
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    # 권한 정책 (Permissions Policy)
    response.headers['Permissions-Policy'] = (
        'geolocation=(), '
        'microphone=(), '
        'camera=(), '
        'payment=(), '
        'usb=(), '
        'magnetometer=(), '
        'gyroscope=(), '
        'accelerometer=()'
    )

    return response

# ==================== 콘솔 비활성화 스크립트 ====================
CONSOLE_DISABLE_SCRIPT = """
<script>
(function() {
    // 프로덕션 환경에서만 콘솔 비활성화
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // 콘솔 메서드 비활성화
        const noop = function() {};
        const methods = ['log', 'debug', 'info', 'warn', 'error', 'dir', 'dirxml',
                        'trace', 'assert', 'clear', 'table', 'group', 'groupEnd',
                        'groupCollapsed', 'time', 'timeEnd', 'timeLog', 'count',
                        'countReset', 'profile', 'profileEnd'];

        methods.forEach(method => {
            if (console[method]) {
                console[method] = noop;
            }
        });

        // F12, Ctrl+Shift+I 등 개발자 도구 단축키 차단
        document.addEventListener('keydown', function(e) {
            // F12
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+I (개발자 도구)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+J (콘솔)
            if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+C (요소 검사)
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.keyCode === 67)) {
                e.preventDefault();
                return false;
            }
            // Ctrl+U (소스 보기)
            if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
                e.preventDefault();
                return false;
            }
        });

        // 우클릭 메뉴 비활성화
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });

        // 텍스트 선택 방지 (선택적 사용)
        // document.addEventListener('selectstart', function(e) {
        //     e.preventDefault();
        //     return false;
        // });

        // 개발자 도구 열림 감지 (완벽하지 않음)
        const devtools = {
            isOpen: false,
            orientation: null
        };

        const threshold = 160;
        const emitEvent = (isOpen, orientation) => {
            window.dispatchEvent(new CustomEvent('devtoolschange', {
                detail: { isOpen, orientation }
            }));
        };

        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            const orientation = widthThreshold ? 'vertical' : 'horizontal';

            if (!(heightThreshold && widthThreshold) &&
                ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) ||
                 widthThreshold || heightThreshold)) {
                if (!devtools.isOpen || devtools.orientation !== orientation) {
                    emitEvent(true, orientation);
                }
                devtools.isOpen = true;
                devtools.orientation = orientation;
            } else {
                if (devtools.isOpen) {
                    emitEvent(false, null);
                }
                devtools.isOpen = false;
                devtools.orientation = null;
            }
        }, 500);

        // 개발자 도구 열림 시 경고 (선택적)
        // window.addEventListener('devtoolschange', e => {
        //     if (e.detail.isOpen) {
        //         alert('개발자 도구 사용이 감지되었습니다.');
        //     }
        // });
    }
})();
</script>
"""

def generate_secret_key():
    """안전한 SECRET_KEY 생성"""
    return secrets.token_hex(32)

# ==================== 세션 보안 설정 ====================
SESSION_CONFIG = {
    'SESSION_COOKIE_SECURE': False,  # HTTP이므로 False (HTTPS면 True)
    'SESSION_COOKIE_HTTPONLY': True,  # JavaScript에서 접근 불가
    'SESSION_COOKIE_SAMESITE': 'Lax',  # CSRF 보호
    'PERMANENT_SESSION_LIFETIME': timedelta(hours=12),  # 12시간 세션 유지
    'SESSION_COOKIE_NAME': 'crm_session',  # 커스텀 쿠키 이름
}

# ==================== 로그인 시도 제한 ====================
class LoginAttemptTracker:
    """로그인 시도 추적 및 제한"""
    def __init__(self):
        self.attempts = {}  # {ip: [(timestamp, username, success), ...]}
        self.lock = threading.Lock()
        self.max_attempts = 5  # 5회 실패 시 차단
        self.lockout_duration = 900  # 15분 차단

    def record_attempt(self, ip, username, success):
        """로그인 시도 기록"""
        with self.lock:
            now = datetime.now()
            if ip not in self.attempts:
                self.attempts[ip] = []

            self.attempts[ip].append((now, username, success))

            # 1시간 이전 기록 삭제
            cutoff = now - timedelta(hours=1)
            self.attempts[ip] = [
                (ts, un, sc) for ts, un, sc in self.attempts[ip]
                if ts > cutoff
            ]

    def is_locked_out(self, ip):
        """차단 여부 확인"""
        with self.lock:
            if ip not in self.attempts:
                return False

            now = datetime.now()
            recent_attempts = [
                (ts, un, sc) for ts, un, sc in self.attempts[ip]
                if (now - ts).seconds < self.lockout_duration
            ]

            # 최근 실패 시도 수 확인
            failed_attempts = [
                sc for ts, un, sc in recent_attempts
                if not sc
            ]

            return len(failed_attempts) >= self.max_attempts

    def get_remaining_lockout_time(self, ip):
        """남은 차단 시간 (초)"""
        with self.lock:
            if ip not in self.attempts:
                return 0

            now = datetime.now()
            failed_attempts = [
                ts for ts, un, sc in self.attempts[ip]
                if not sc
            ]

            if len(failed_attempts) < self.max_attempts:
                return 0

            # 가장 최근 실패 시도부터 lockout_duration 계산
            last_failed = max(failed_attempts)
            elapsed = (now - last_failed).seconds
            remaining = self.lockout_duration - elapsed

            return max(0, remaining)

# 전역 로그인 시도 추적기
login_tracker = LoginAttemptTracker()
