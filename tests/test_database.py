"""
database.py 단위 테스트
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database


class TestDatabaseFunctions:
    """데이터베이스 함수 테스트"""

    def test_init_connection_pool(self):
        """연결 풀 초기화 테스트"""
        database.init_connection_pool()
        assert database.connection_pool is not None

    def test_get_db_connection(self):
        """데이터베이스 연결 테스트"""
        with database.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 as test')
            result = cursor.fetchone()
            assert result['test'] == 1

    def test_load_data(self):
        """할일 데이터 로드 테스트"""
        data = database.load_data()
        assert isinstance(data, list)
        # 데이터가 있을 경우 필수 필드 확인
        if data:
            assert 'id' in data[0]
            assert 'title' in data[0]

    def test_load_users(self):
        """사용자 목록 로드 테스트"""
        users = database.load_users()
        assert isinstance(users, list)

    def test_load_teams(self):
        """팀 목록 로드 테스트"""
        teams = database.load_teams()
        assert isinstance(teams, list)

    def test_load_chats(self):
        """채팅 데이터 로드 테스트"""
        chats = database.load_chats()
        assert isinstance(chats, dict)

    def test_load_promotions(self):
        """프로모션 데이터 로드 테스트"""
        promotions = database.load_promotions()
        assert isinstance(promotions, list)

    def test_get_unread_chat_count(self):
        """읽지 않은 채팅 개수 테스트"""
        count = database.get_unread_chat_count('nonexistent_user')
        assert isinstance(count, int)
        assert count >= 0

    def test_get_next_id(self):
        """다음 ID 조회 테스트"""
        next_id = database.get_next_id('tasks')
        assert isinstance(next_id, int)
        assert next_id > 0

    def test_user_exists(self):
        """사용자 존재 여부 확인 테스트"""
        # 존재하지 않는 사용자
        exists = database.user_exists('definitely_nonexistent_user_12345')
        assert exists is False

    def test_is_user_admin(self):
        """관리자 여부 확인 테스트"""
        # 존재하지 않는 사용자
        is_admin = database.is_user_admin('definitely_nonexistent_user_12345')
        assert is_admin is False

    def test_get_admin_usernames(self):
        """관리자 사용자명 목록 테스트"""
        admins = database.get_admin_usernames()
        assert isinstance(admins, set)

    def test_load_holidays(self):
        """공휴일 로드 테스트"""
        holidays = database.load_holidays()
        assert isinstance(holidays, list)

    def test_load_holidays_by_year(self):
        """연도별 공휴일 로드 테스트"""
        holidays = database.load_holidays(year=2025)
        assert isinstance(holidays, list)

    def test_get_user_notification_settings(self):
        """알림 설정 조회 테스트"""
        settings = database.get_user_notification_settings('test_user')
        assert isinstance(settings, dict)
        assert 'reminder_minutes' in settings

    def test_load_reminders(self):
        """예약 알림 로드 테스트"""
        reminders = database.load_reminders('test_user')
        assert isinstance(reminders, list)


class TestSlowQueryDecorator:
    """느린 쿼리 로깅 데코레이터 테스트"""

    def test_decorator_does_not_break_function(self):
        """데코레이터가 함수를 망가뜨리지 않는지 테스트"""
        # load_data는 @log_slow_query 데코레이터 적용됨
        result = database.load_data()
        assert isinstance(result, list)

    def test_decorator_returns_correct_result(self):
        """데코레이터가 올바른 결과를 반환하는지 테스트"""
        # get_chat_info는 @log_slow_query 데코레이터 적용됨
        result = database.get_chat_info(99999)  # 존재하지 않는 ID
        assert result is None
