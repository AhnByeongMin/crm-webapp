"""
pytest 설정 및 공통 픽스처
"""
import pytest
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app():
    """Flask 앱 테스트용 픽스처"""
    # eventlet monkey patch 전에 import
    import eventlet
    eventlet.monkey_patch()

    from app import app as flask_app

    flask_app.config.update({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,  # 테스트에서 CSRF 비활성화
        'SESSION_COOKIE_SECURE': False,
    })

    yield flask_app


@pytest.fixture
def client(app):
    """테스트 클라이언트 픽스처"""
    return app.test_client()


@pytest.fixture
def runner(app):
    """CLI 테스트 러너 픽스처"""
    return app.test_cli_runner()


@pytest.fixture
def auth_client(client):
    """인증된 테스트 클라이언트 (관리자)"""
    with client.session_transaction() as sess:
        sess['username'] = 'admin'
        sess['role'] = '관리자'
    return client


@pytest.fixture
def user_client(client):
    """인증된 테스트 클라이언트 (일반 사용자)"""
    with client.session_transaction() as sess:
        sess['username'] = 'testuser'
        sess['role'] = '상담사'
    return client
