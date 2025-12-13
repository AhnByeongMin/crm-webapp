"""
CSRF 보호 모듈
폼 및 AJAX 요청에 대한 CSRF 토큰 검증
"""

from flask_wtf.csrf import CSRFProtect, CSRFError
from flask import jsonify, request
import logging

logger = logging.getLogger('crm')

# CSRF 보호 인스턴스
csrf = CSRFProtect()


def init_csrf(app):
    """CSRF 보호 초기화"""
    # CSRF 설정
    app.config['WTF_CSRF_ENABLED'] = True
    app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # 토큰 유효시간: 1시간
    app.config['WTF_CSRF_SSL_STRICT'] = False  # 개발 환경에서는 False
    app.config['WTF_CSRF_CHECK_DEFAULT'] = True

    # CSRF 초기화
    csrf.init_app(app)

    # CSRF 에러 핸들러
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        logger.warning(f"CSRF error: {e.description} - IP: {request.remote_addr} - Path: {request.path}")
        return jsonify({
            'error': 'CSRF 토큰이 유효하지 않습니다. 페이지를 새로고침 후 다시 시도해주세요.',
            'csrf_error': True
        }), 400

    return csrf


def exempt_csrf(view):
    """특정 뷰에서 CSRF 보호 제외"""
    return csrf.exempt(view)


# CSRF 제외할 엔드포인트 목록 (웹소켓, 외부 API 콜백 등)
CSRF_EXEMPT_ENDPOINTS = [
    # Socket.IO는 자체 인증 사용
    'socket.io',
    # 내부 API (세션 인증으로 보호됨)
    '/api/',
    # 파일 업로드 (세션 인증으로 보호됨)
    '/upload',
    # 서비스 워커 관련
    '/service-worker.js',
    '/sw.js',
]


def is_csrf_exempt(path):
    """CSRF 제외 대상인지 확인"""
    for exempt in CSRF_EXEMPT_ENDPOINTS:
        if exempt in path:
            return True
    return False
