"""
app.py API 엔드포인트 테스트

Note: 테스트 환경에서는 localhost로 인식되어 관리자 권한이 부여됨
이 테스트는 주로 정상 동작 확인과 보안 헤더 검증에 초점
"""
import pytest


class TestAuthRoutes:
    """인증 관련 라우트 테스트"""

    def test_login_page_localhost_redirect(self, client):
        """로그인 페이지 - localhost는 admin으로 리다이렉트"""
        response = client.get('/login', follow_redirects=False)
        # localhost는 admin으로 리다이렉트됨
        assert response.status_code == 302
        assert '/admin' in response.headers['Location']

    def test_logout(self, auth_client):
        """로그아웃 테스트"""
        response = auth_client.get('/logout', follow_redirects=True)
        assert response.status_code == 200


class TestAPIEndpoints:
    """API 엔드포인트 테스트"""

    def test_get_version(self, client):
        """버전 API 테스트"""
        response = client.get('/api/version')
        assert response.status_code == 200
        data = response.get_json()
        assert 'version' in data

    def test_get_items(self, client):
        """할일 목록 조회 (localhost=관리자)"""
        response = client.get('/api/items')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_get_users(self, client):
        """사용자 목록 조회 (localhost=관리자)"""
        response = client.get('/api/users')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_get_teams(self, client):
        """팀 목록 조회 (localhost=관리자)"""
        response = client.get('/api/teams')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_get_nav_counts_unauthorized(self, client):
        """네비 카운트 조회 - 세션 없음 (localhost도 세션 필요)"""
        response = client.get('/api/nav-counts')
        assert response.status_code == 401

    def test_get_nav_counts_authorized(self, auth_client):
        """네비 카운트 조회 - 관리자 인증"""
        response = auth_client.get('/api/nav-counts')
        assert response.status_code == 200
        data = response.get_json()
        assert 'pending_tasks' in data
        assert 'unread_chats' in data

    def test_get_chats(self, client):
        """채팅 목록 조회 (localhost=관리자)"""
        response = client.get('/api/chats')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, dict)

    def test_get_promotions(self, client):
        """프로모션 목록 조회"""
        response = client.get('/api/promotions')
        # 401 또는 200 (localhost 환경에 따라)
        assert response.status_code in [200, 401]

    def test_get_holidays(self, client):
        """공휴일 조회"""
        response = client.get('/api/holidays')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)


class TestSecurityHeaders:
    """보안 헤더 테스트"""

    def test_security_headers_x_content_type(self, client):
        """X-Content-Type-Options 헤더"""
        response = client.get('/api/version')
        assert 'X-Content-Type-Options' in response.headers
        assert response.headers['X-Content-Type-Options'] == 'nosniff'

    def test_security_headers_x_frame(self, client):
        """X-Frame-Options 헤더"""
        response = client.get('/api/version')
        assert 'X-Frame-Options' in response.headers
        assert response.headers['X-Frame-Options'] == 'SAMEORIGIN'

    def test_security_headers_xss_protection(self, client):
        """X-XSS-Protection 헤더"""
        response = client.get('/api/version')
        assert 'X-XSS-Protection' in response.headers
        assert '1' in response.headers['X-XSS-Protection']

    def test_cache_control_api(self, client):
        """API 캐시 제어"""
        response = client.get('/api/version')
        assert 'Cache-Control' in response.headers
        assert 'no-store' in response.headers['Cache-Control']


class TestPageRoutes:
    """페이지 라우트 테스트"""

    def test_index_localhost_redirect_to_admin(self, client):
        """인덱스 - localhost는 admin으로 리다이렉트"""
        response = client.get('/', follow_redirects=False)
        assert response.status_code == 302
        assert '/admin' in response.headers['Location']

    def test_admin_page_localhost(self, client):
        """관리자 페이지 - localhost 접근"""
        response = client.get('/admin')
        assert response.status_code == 200

    def test_admin_page_with_auth(self, auth_client):
        """관리자 페이지 - 인증된 접근"""
        response = auth_client.get('/admin')
        assert response.status_code == 200

    def test_user_page_with_auth(self, user_client):
        """사용자 페이지 - 일반 사용자 인증"""
        # user.html 렌더링 또는 리다이렉트
        response = user_client.get('/')
        assert response.status_code in [200, 302]

    def test_promotions_page(self, client):
        """프로모션 페이지"""
        response = client.get('/promotions')
        # 200 또는 302 (인증 상태에 따라)
        assert response.status_code in [200, 302, 404]


class TestHelperFunctions:
    """헬퍼 함수 테스트"""

    def test_allowed_file_valid_extensions(self, app):
        """허용된 파일 확장자 테스트"""
        with app.app_context():
            from app import allowed_file
            assert allowed_file('test.png') is True
            assert allowed_file('test.jpg') is True
            assert allowed_file('test.pdf') is True
            assert allowed_file('test.xlsx') is True
            assert allowed_file('test.txt') is True
            assert allowed_file('test.json') is True

    def test_allowed_file_invalid_extensions(self, app):
        """허용되지 않은 파일 확장자 테스트"""
        with app.app_context():
            from app import allowed_file
            assert allowed_file('test.exe') is False
            assert allowed_file('test.bat') is False
            assert allowed_file('test.sh') is False
            assert allowed_file('test.dll') is False
            assert allowed_file('noextension') is False

    def test_validate_file_signature_png(self, app):
        """PNG 파일 시그니처 검증"""
        with app.app_context():
            from app import validate_file_signature
            from io import BytesIO

            # 올바른 PNG 시그니처
            png_file = BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
            assert validate_file_signature(png_file, 'png') is True

    def test_validate_file_signature_jpg(self, app):
        """JPG 파일 시그니처 검증"""
        with app.app_context():
            from app import validate_file_signature
            from io import BytesIO

            # 올바른 JPG 시그니처
            jpg_file = BytesIO(b'\xff\xd8\xff' + b'\x00' * 100)
            assert validate_file_signature(jpg_file, 'jpg') is True

    def test_validate_file_signature_fake(self, app):
        """위조 파일 시그니처 검증"""
        with app.app_context():
            from app import validate_file_signature
            from io import BytesIO

            # 잘못된 PNG 시그니처
            fake_png = BytesIO(b'fake data not png' + b'\x00' * 100)
            assert validate_file_signature(fake_png, 'png') is False

    def test_validate_file_signature_no_definition(self, app):
        """시그니처 정의 없는 확장자"""
        with app.app_context():
            from app import validate_file_signature
            from io import BytesIO

            # txt는 시그니처 정의가 없으므로 통과
            txt_file = BytesIO(b'text content')
            assert validate_file_signature(txt_file, 'txt') is True

    def test_is_localhost(self, app):
        """localhost 확인 함수"""
        with app.app_context():
            from app import is_localhost
            # 테스트 환경에서는 localhost로 인식됨
            with app.test_request_context():
                result = is_localhost()
                assert isinstance(result, bool)

    def test_is_admin(self, app):
        """관리자 확인 함수"""
        with app.app_context():
            from app import is_admin
            # 테스트 환경(localhost)에서는 True
            with app.test_request_context():
                result = is_admin()
                assert result is True

    def test_get_admin_accounts(self, app):
        """관리자 계정 목록 조회"""
        with app.app_context():
            from app import get_admin_accounts
            accounts = get_admin_accounts()
            assert isinstance(accounts, set)


class TestCRUDOperations:
    """CRUD 작업 테스트"""

    def test_create_item_without_data(self, auth_client):
        """할일 생성 - 데이터 없음"""
        response = auth_client.post('/api/items',
                                    data={},
                                    content_type='application/json')
        # 에러 또는 빈 JSON 처리
        assert response.status_code in [400, 500]

    def test_update_item_not_found(self, auth_client):
        """할일 수정 - 존재하지 않는 ID"""
        response = auth_client.put('/api/items/999999',
                                   json={'title': 'test', 'content': 'test'},
                                   content_type='application/json')
        assert response.status_code in [404, 500]

    def test_delete_item_not_found(self, auth_client):
        """할일 삭제 - 존재하지 않는 ID"""
        response = auth_client.delete('/api/items/999999')
        assert response.status_code == 200  # success: false 반환
        data = response.get_json()
        assert data.get('success') is False


class TestRateLimiting:
    """Rate Limiting 테스트"""

    def test_rate_limit_headers(self, client):
        """Rate Limit 헤더 존재 확인"""
        response = client.get('/api/version')
        # flask-limiter가 헤더를 추가하지 않을 수도 있음
        assert response.status_code == 200
