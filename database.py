"""
PostgreSQL 데이터베이스 헬퍼 함수 (최적화 버전)
- N+1 쿼리 제거 (JOIN 사용)
- 부분 조회 기능 추가
- 연결 풀링
"""
import psycopg2
import psycopg2.extras
import psycopg2.pool
import threading
import logging
from contextlib import contextmanager

logger = logging.getLogger('crm')

# PostgreSQL 연결 설정
DB_CONFIG = {
    'host': '127.0.0.1',
    'database': 'crm_db',
    'user': 'crm_user',
    'password': 'crm_password_2024'
}

# 연결 풀 (Thread-safe)
connection_pool = None
pool_lock = threading.Lock()

def init_connection_pool(minconn=1, maxconn=20):
    """연결 풀 초기화"""
    global connection_pool
    if connection_pool is None:
        with pool_lock:
            if connection_pool is None:
                connection_pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn, maxconn, **DB_CONFIG
                )

# 데이터베이스 연결 락 (동시성 제어)
db_lock = threading.Lock()

@contextmanager
def get_db_connection():
    """데이터베이스 연결을 안전하게 관리하는 컨텍스트 매니저"""
    conn = None
    try:
        init_connection_pool()
        conn = connection_pool.getconn()
        # dict-like cursor 사용
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        yield conn
    except psycopg2.pool.PoolError as e:
        logger.error(f"DB 풀 연결 오류: {e}")
        raise
    except psycopg2.OperationalError as e:
        logger.error(f"DB 연결 오류: {e}")
        raise
    finally:
        if conn is not None:
            connection_pool.putconn(conn)

# ==================== 할일 관리 ====================

def load_data():
    """할일 목록 조회 (users와 JOIN하여 team 정보 포함)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                t.id,
                t.assigned_to,
                t.title,
                t.content,
                t.status,
                TO_CHAR(t.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
                TO_CHAR(t.assigned_at, 'YYYY-MM-DD HH24:MI:SS') as assigned_at,
                TO_CHAR(t.updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
                TO_CHAR(t.completed_at, 'YYYY-MM-DD HH24:MI:SS') as completed_at,
                u.team as team
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.username
            ORDER BY t.id
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def load_data_by_assigned(username):
    """특정 사용자에게 배정된 할일만 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                id,
                assigned_to,
                title,
                content,
                status,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
                TO_CHAR(assigned_at, 'YYYY-MM-DD HH24:MI:SS') as assigned_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
                TO_CHAR(completed_at, 'YYYY-MM-DD HH24:MI:SS') as completed_at
            FROM tasks
            WHERE assigned_to = %s
            ORDER BY id
        ''', (username,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def load_data_unassigned():
    """미배정 할일 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                id,
                assigned_to,
                title,
                content,
                status,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
                TO_CHAR(assigned_at, 'YYYY-MM-DD HH24:MI:SS') as assigned_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
                TO_CHAR(completed_at, 'YYYY-MM-DD HH24:MI:SS') as completed_at
            FROM tasks
            WHERE assigned_to IS NULL
            ORDER BY id
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def save_data(data):
    """할일 목록 저장 (전체 덮어쓰기 - 호환성 유지)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM tasks')
            for task in data:
                cursor.execute('''
                    INSERT INTO tasks (id, assigned_to, title, content, created_at, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (task['id'], task.get('assigned_to'), task['title'],
                      task['content'], task['created_at'], task.get('status', '대기중')))
            conn.commit()

def update_task_status(task_id, status):
    """할일 상태 업데이트"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # 완료일 업데이트 (완료 상태로 변경 시)
            if status == '완료':
                cursor.execute('''
                    UPDATE tasks
                    SET status = %s,
                        updated_at = CURRENT_TIMESTAMP,
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (status, task_id))
            else:
                cursor.execute('''
                    UPDATE tasks
                    SET status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (status, task_id))
            conn.commit()

def update_task_assignment(task_id, assigned_to):
    """할일 배정 업데이트 (배정/회수) - 배정일만 업데이트, 수정일은 변경하지 않음"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE tasks
                SET assigned_to = %s,
                    assigned_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (assigned_to, task_id))
            conn.commit()

def add_task(assigned_to, title, content, status='대기중'):
    """새 할일 추가 (개별 삽입)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # assigned_to가 있으면 배정일도 함께 저장
            if assigned_to:
                cursor.execute('''
                    INSERT INTO tasks (assigned_to, title, content, status, created_at, assigned_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                ''', (assigned_to, title, content, status))
            else:
                cursor.execute('''
                    INSERT INTO tasks (assigned_to, title, content, status, created_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    RETURNING id
                ''', (assigned_to, title, content, status))
            conn.commit()
            return cursor.fetchone()['id']

def update_task(task_id, title, content):
    """할일 수정 (제목, 내용)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE tasks
                SET title = %s,
                    content = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (title, content, task_id))
            conn.commit()
            return cursor.rowcount > 0

def delete_task(task_id):
    """할일 삭제"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM tasks WHERE id = %s', (task_id,))
            conn.commit()
            return cursor.rowcount > 0

# ==================== 사용자 관리 ====================

def load_users():
    """사용자 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT username FROM users ORDER BY username')
        return [row['username'] for row in cursor.fetchall()]


def get_admin_usernames():
    """관리자 사용자명 목록 조회 (캐시용)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM users WHERE role = '관리자' AND status = 'active'")
        return set(row['username'] for row in cursor.fetchall())


def is_user_admin(username):
    """특정 사용자가 관리자인지 확인"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM users WHERE username = %s AND role = '관리자' AND status = 'active'",
            (username,)
        )
        return cursor.fetchone() is not None

def save_users(users):
    """사용자 목록 저장"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM users')
            for username in users:
                cursor.execute('INSERT INTO users (username) VALUES (%s)', (username,))
            conn.commit()

def add_user(username):
    """사용자 추가"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('INSERT INTO users (username) VALUES (%s)', (username,))
                conn.commit()
            except psycopg2.IntegrityError:
                conn.rollback()

def user_exists(username):
    """사용자 존재 여부 확인"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM users WHERE username = %s', (username,))
        result = cursor.fetchone()
        return result['count'] > 0

def load_users_by_team(team=None):
    """팀별 사용자 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if team:
            cursor.execute('SELECT username FROM users WHERE team = %s ORDER BY username', (team,))
        else:
            cursor.execute('SELECT username FROM users WHERE team IS NOT NULL ORDER BY username')
        return [row['username'] for row in cursor.fetchall()]

def load_teams():
    """팀 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT team FROM users WHERE team IS NOT NULL AND team != \'\' ORDER BY team')
        return [row['team'] for row in cursor.fetchall()]

def load_users_with_team():
    """팀 정보를 포함한 사용자 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT username, team FROM users ORDER BY team, username')
        return [{'username': row['username'], 'team': row['team']} for row in cursor.fetchall()]

def load_all_users_detail():
    """모든 사용자 정보 조회 (관리자용)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, role, status, team, created_at
            FROM users
            ORDER BY created_at DESC
        ''')
        return [dict(row) for row in cursor.fetchall()]

def create_user(username, password, role, status='active', team=None):
    """새 사용자 생성 (관리자용)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    INSERT INTO users (username, password, role, status, team)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (username, password, role, status, team))
                conn.commit()
                return True
            except psycopg2.IntegrityError:
                conn.rollback()
                return False  # 중복 username

def delete_user(user_id):
    """사용자 삭제 (관리자용)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))
            conn.commit()
            return cursor.rowcount > 0

def update_user_status(user_id, status):
    """사용자 활성/비활성 상태 변경"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET status = %s
                WHERE id = %s
            ''', (status, user_id))
            conn.commit()
            return cursor.rowcount > 0

def update_user_team(user_id, team):
    """사용자 팀 변경"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET team = %s
                WHERE id = %s
            ''', (team, user_id))
            conn.commit()
            return cursor.rowcount > 0

def update_user_role(user_id, role):
    """사용자 권한 변경"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET role = %s
                WHERE id = %s
            ''', (role, user_id))
            conn.commit()
            return cursor.rowcount > 0

def reset_user_password(user_id, role):
    """사용자 비밀번호 초기화"""
    default_password = 'admin1234' if role == '관리자' else 'body123!'
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET password = %s
                WHERE id = %s
            ''', (default_password, user_id))
            conn.commit()
            return cursor.rowcount > 0

def verify_user_login(username, password):
    """사용자 로그인 검증 (비밀번호 확인 + 활성 상태 확인)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT username, role, status
            FROM users
            WHERE username = %s AND password = %s AND status = 'active'
        ''', (username, password))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_info(username):
    """사용자 정보 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, role, status, team, created_at
            FROM users
            WHERE username = %s
        ''', (username,))
        row = cursor.fetchone()
        return dict(row) if row else None

def change_user_password(username, current_password, new_password):
    """사용자 비밀번호 변경 (본인만 가능)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # 현재 비밀번호 확인
            cursor.execute('''
                SELECT id FROM users
                WHERE username = %s AND password = %s
            ''', (username, current_password))

            if not cursor.fetchone():
                return False, '현재 비밀번호가 일치하지 않습니다.'

            # 비밀번호 업데이트
            cursor.execute('''
                UPDATE users
                SET password = %s
                WHERE username = %s
            ''', (new_password, username))
            conn.commit()

            return True, '비밀번호가 변경되었습니다.'

# ==================== 채팅 관리 (최적화) ====================

def load_chats():
    """채팅 목록 조회 (최적화: 단일 쿼리로 모든 데이터 로드)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        chats = {}

        # 1. 모든 채팅방 조회
        cursor.execute('SELECT * FROM chats ORDER BY id')
        for chat_row in cursor.fetchall():
            chat_id = str(chat_row['id'])
            chats[chat_id] = {
                'title': chat_row['title'],
                'creator': chat_row['creator'],
                'created_at': str(chat_row['created_at']),
                'participants': [],
                'messages': []
            }

        # 2. 모든 참여자를 한 번에 조회 (N+1 제거)
        cursor.execute('''
            SELECT chat_id, username
            FROM chat_participants
            ORDER BY chat_id
        ''')
        for row in cursor.fetchall():
            chat_id = str(row['chat_id'])
            if chat_id in chats:
                chats[chat_id]['participants'].append(row['username'])

        # 3. 모든 메시지를 한 번에 조회 (N+1 제거)
        cursor.execute('''
            SELECT m.id, m.chat_id, m.username, m.message, m.timestamp,
                   m.file_path, m.file_name
            FROM messages m
            ORDER BY m.chat_id, m.id
        ''')

        messages_by_id = {}
        for msg_row in cursor.fetchall():
            chat_id = str(msg_row['chat_id'])
            if chat_id in chats:
                msg = {
                    'id': msg_row['id'],  # 메시지 ID 추가 (검색/스크롤용)
                    'username': msg_row['username'],
                    'message': msg_row['message'],
                    'timestamp': str(msg_row['timestamp'])
                }
                if msg_row['file_path']:
                    msg['file_path'] = msg_row['file_path']
                if msg_row['file_name']:
                    msg['file_name'] = msg_row['file_name']

                messages_by_id[msg_row['id']] = msg
                chats[chat_id]['messages'].append(msg)

        # 4. 모든 읽음 상태를 한 번에 조회 (N+1 제거)
        cursor.execute('''
            SELECT message_id, username
            FROM message_reads
            ORDER BY message_id
        ''')

        read_by_dict = {}
        for row in cursor.fetchall():
            msg_id = row['message_id']
            if msg_id not in read_by_dict:
                read_by_dict[msg_id] = []
            read_by_dict[msg_id].append(row['username'])

        # 읽음 상태를 메시지에 추가
        for msg_id, msg in messages_by_id.items():
            if msg_id in read_by_dict:
                msg['read_by'] = read_by_dict[msg_id]

        return chats

def load_chat_by_id(chat_id):
    """특정 채팅방만 조회 (최적화: 필요한 데이터만 로드)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 채팅방 정보
        cursor.execute('SELECT * FROM chats WHERE id = %s', (int(chat_id),))
        chat_row = cursor.fetchone()
        if not chat_row:
            return None

        chat = {
            'title': chat_row['title'],
            'creator': chat_row['creator'],
            'created_at': str(chat_row['created_at']),
            'participants': [],
            'messages': []
        }

        # 참여자
        cursor.execute('''
            SELECT username FROM chat_participants
            WHERE chat_id = %s
        ''', (int(chat_id),))
        chat['participants'] = [row['username'] for row in cursor.fetchall()]

        # 메시지
        cursor.execute('''
            SELECT m.id, m.username, m.message, m.timestamp,
                   m.file_path, m.file_name
            FROM messages m
            WHERE m.chat_id = %s
            ORDER BY m.id
        ''', (int(chat_id),))

        messages_by_id = {}
        for msg_row in cursor.fetchall():
            msg = {
                'username': msg_row['username'],
                'message': msg_row['message'],
                'timestamp': str(msg_row['timestamp'])
            }
            if msg_row['file_path']:
                msg['file_path'] = msg_row['file_path']
            if msg_row['file_name']:
                msg['file_name'] = msg_row['file_name']

            messages_by_id[msg_row['id']] = msg
            chat['messages'].append(msg)

        # 읽음 상태
        if messages_by_id:
            placeholders = ','.join(['%s'] * len(messages_by_id))
            cursor.execute(f'''
                SELECT message_id, username
                FROM message_reads
                WHERE message_id IN ({placeholders})
            ''', list(messages_by_id.keys()))

            read_by_dict = {}
            for row in cursor.fetchall():
                msg_id = row['message_id']
                if msg_id not in read_by_dict:
                    read_by_dict[msg_id] = []
                read_by_dict[msg_id].append(row['username'])

            for msg_id, msg in messages_by_id.items():
                if msg_id in read_by_dict:
                    msg['read_by'] = read_by_dict[msg_id]

        return {str(chat_id): chat}

def save_chats(chats):
    """채팅 데이터 저장 (트랜잭션 최적화)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            try:
                # 기존 데이터 삭제 (CASCADE로 관련 데이터도 자동 삭제)
                cursor.execute('DELETE FROM chats')

                # 새 데이터 삽입
                for chat_id, chat in chats.items():
                    # 채팅방
                    cursor.execute('''
                        INSERT INTO chats (id, title, creator, created_at)
                        VALUES (%s, %s, %s, %s)
                    ''', (int(chat_id), chat['title'], chat['creator'], chat['created_at']))

                    # 참여자 (배치 삽입)
                    if chat['participants']:
                        participant_data = [(int(chat_id), p) for p in chat['participants']]
                        psycopg2.extras.execute_batch(cursor, '''
                            INSERT INTO chat_participants (chat_id, username)
                            VALUES (%s, %s)
                        ''', participant_data)

                    # 메시지
                    for msg in chat['messages']:
                        cursor.execute('''
                            INSERT INTO messages (chat_id, username, message, timestamp, file_path, file_name)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            RETURNING id
                        ''', (int(chat_id), msg['username'], msg['message'], msg['timestamp'],
                              msg.get('file_path'), msg.get('file_name')))

                        message_id = cursor.fetchone()['id']

                        # 읽음 상태 (배치 삽입)
                        if 'read_by' in msg and msg['read_by']:
                            read_data = [(message_id, reader) for reader in msg['read_by']]
                            psycopg2.extras.execute_batch(cursor, '''
                                INSERT INTO message_reads (message_id, username)
                                VALUES (%s, %s)
                            ''', read_data)

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise e


def save_message(chat_id, message):
    """
    개별 메시지 저장 (최적화: 전체 데이터 로드/저장 없이 단일 INSERT)

    Args:
        chat_id: 채팅방 ID
        message: 메시지 딕셔너리 (username, message, timestamp, file_path, file_name, read_by)

    Returns:
        int: 저장된 메시지 ID
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 메시지 INSERT
        cursor.execute('''
            INSERT INTO messages (chat_id, username, message, timestamp, file_path, file_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            int(chat_id),
            message['username'],
            message['message'],
            message['timestamp'],
            message.get('file_path'),
            message.get('file_name')
        ))

        msg_id = cursor.fetchone()['id']

        # 읽음 상태 INSERT (보낸 사람)
        read_by = message.get('read_by', [message['username']])
        if read_by:
            for reader in read_by:
                cursor.execute('''
                    INSERT INTO message_reads (message_id, username)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                ''', (msg_id, reader))

        conn.commit()
        return msg_id


def mark_messages_as_read(chat_id, username):
    """
    채팅방의 모든 메시지를 읽음 처리 (최적화: 직접 INSERT)

    Args:
        chat_id: 채팅방 ID
        username: 읽은 사용자명

    Returns:
        int: 새로 읽음 처리된 메시지 수
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 아직 읽지 않은 메시지에 대해 읽음 상태 추가
        cursor.execute('''
            INSERT INTO message_reads (message_id, username)
            SELECT m.id, %s
            FROM messages m
            WHERE m.chat_id = %s
            AND NOT EXISTS (
                SELECT 1 FROM message_reads mr
                WHERE mr.message_id = m.id AND mr.username = %s
            )
        ''', (username, int(chat_id), username))

        affected = cursor.rowcount
        conn.commit()
        return affected


def mark_single_message_as_read(chat_id, message_id, username):
    """
    특정 메시지 하나를 읽음 처리

    Args:
        chat_id: 채팅방 ID
        message_id: 메시지 ID
        username: 읽은 사용자명

    Returns:
        bool: 성공 여부
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO message_reads (message_id, username)
            VALUES (%s, %s)
            ON CONFLICT (message_id, username) DO NOTHING
        ''', (int(message_id), username))
        conn.commit()
        return cursor.rowcount > 0


def get_message_read_by(message_id):
    """
    특정 메시지의 읽은 사용자 목록 조회

    Args:
        message_id: 메시지 ID

    Returns:
        list: 읽은 사용자 username 리스트
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT username FROM message_reads
            WHERE message_id = %s
            ORDER BY read_at
        ''', (int(message_id),))
        return [row['username'] for row in cursor.fetchall()]


def get_chat_info(chat_id):
    """
    특정 채팅방 정보 조회 (참여자 목록 포함)

    Args:
        chat_id: 채팅방 ID

    Returns:
        dict: 채팅방 정보 또는 None
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 채팅방 기본 정보
        cursor.execute('SELECT * FROM chats WHERE id = %s', (int(chat_id),))
        chat_row = cursor.fetchone()

        if not chat_row:
            return None

        # 참여자 목록
        cursor.execute(
            'SELECT username FROM chat_participants WHERE chat_id = %s',
            (int(chat_id),)
        )
        participants = [row['username'] for row in cursor.fetchall()]

        return {
            'id': chat_row['id'],
            'title': chat_row['title'],
            'creator': chat_row['creator'],
            'created_at': str(chat_row['created_at']),
            'participants': participants
        }


def get_unread_chat_count(username):
    """
    특정 사용자의 읽지 않은 채팅 메시지 개수 조회 (최적화: 단일 쿼리)

    Args:
        username: 사용자명

    Returns:
        int: 읽지 않은 메시지 개수
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 내가 참여한 채팅방에서, 내가 보내지 않은 메시지 중, 내가 읽지 않은 메시지 개수
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM messages m
            INNER JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE cp.username = %s
            AND m.username != %s
            AND NOT EXISTS (
                SELECT 1 FROM message_reads mr
                WHERE mr.message_id = m.id AND mr.username = %s
            )
        ''', (username, username, username))

        row = cursor.fetchone()
        return row['count'] if row else 0


# ==================== 프로모션 관리 (최적화) ====================

def load_promotions():
    """프로모션 목록 조회 (최적화: JOIN으로 단일 쿼리)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. 모든 프로모션 조회
        cursor.execute('SELECT * FROM promotions ORDER BY id')
        promotions = []
        promo_dict = {}

        for row in cursor.fetchall():
            promo = dict(row)
            # Timestamp를 문자열로 변환
            if 'created_at' in promo and promo['created_at']:
                promo['created_at'] = str(promo['created_at'])
            if 'updated_at' in promo and promo['updated_at']:
                promo['updated_at'] = str(promo['updated_at'])
            promo['subscription_types'] = []
            promotions.append(promo)
            promo_dict[row['id']] = promo

        # 2. 모든 구독 유형을 한 번에 조회 (N+1 제거)
        cursor.execute('''
            SELECT promotion_id, subscription_type
            FROM promotion_subscription_types
            ORDER BY promotion_id
        ''')

        for row in cursor.fetchall():
            promo_id = row['promotion_id']
            if promo_id in promo_dict:
                promo_dict[promo_id]['subscription_types'].append(row['subscription_type'])

        return promotions

def save_promotions(promotions):
    """프로모션 데이터 저장 (트랜잭션 최적화)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            try:
                # 기존 데이터 삭제 (CASCADE로 관련 데이터도 자동 삭제)
                cursor.execute('DELETE FROM promotions')

                # 새 데이터 삽입
                for promo in promotions:
                    cursor.execute('''
                        INSERT INTO promotions
                        (id, category, product_name, channel, promotion_name, promotion_code,
                         content, start_date, end_date, created_at, updated_at, created_by,
                         discount_amount, session_exemption)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (promo['id'], promo['category'], promo['product_name'],
                          promo['channel'], promo['promotion_name'], promo.get('promotion_code', ''),
                          promo['content'], promo['start_date'], promo['end_date'],
                          promo['created_at'], promo['updated_at'], promo['created_by'],
                          promo.get('discount_amount'), promo.get('session_exemption')))

                    # 구독 유형 (배치 삽입)
                    if 'subscription_types' in promo and promo['subscription_types']:
                        sub_data = [(promo['id'], st) for st in promo['subscription_types']]
                        psycopg2.extras.execute_batch(cursor, '''
                            INSERT INTO promotion_subscription_types (promotion_id, subscription_type)
                            VALUES (%s, %s)
                        ''', sub_data)

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise e

# ==================== 개인 예약 관리 ====================

def load_reminders(user_id, show_completed=False):
    """개인 예약 목록 조회 (사용자별)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if show_completed:
            cursor.execute('''
                SELECT * FROM reminders
                WHERE user_id = %s
                ORDER BY scheduled_date ASC, scheduled_time ASC
            ''', (user_id,))
        else:
            cursor.execute('''
                SELECT * FROM reminders
                WHERE user_id = %s AND is_completed = 0
                ORDER BY scheduled_date ASC, scheduled_time ASC
            ''', (user_id,))
        rows = cursor.fetchall()
        # Timestamp를 문자열로 변환
        result = []
        for row in rows:
            r = dict(row)
            if 'created_at' in r and r['created_at']:
                r['created_at'] = str(r['created_at'])
            if 'updated_at' in r and r['updated_at']:
                r['updated_at'] = str(r['updated_at'])
            result.append(r)
        return result

def add_reminder(user_id, title, content, scheduled_date, scheduled_time):
    """새 예약 추가"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reminders (user_id, title, content, scheduled_date, scheduled_time)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            ''', (user_id, title, content, scheduled_date, scheduled_time))
            conn.commit()
            return cursor.fetchone()['id']

def update_reminder(reminder_id, user_id, title, content, scheduled_date, scheduled_time):
    """예약 수정 (본인 것만 수정 가능)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE reminders
                SET title = %s, content = %s, scheduled_date = %s, scheduled_time = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
            ''', (title, content, scheduled_date, scheduled_time, reminder_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

def delete_reminder(reminder_id, user_id):
    """예약 삭제 (본인 것만 삭제 가능)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM reminders WHERE id = %s AND user_id = %s', (reminder_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

def toggle_reminder_complete(reminder_id, user_id):
    """예약 완료 상태 토글"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE reminders
                SET is_completed = CASE WHEN is_completed = 0 THEN 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
            ''', (reminder_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

def mark_reminder_notified(reminder_id):
    """30분 전 알림 발송 완료 표시"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE reminders
                SET notified_30min = 1
                WHERE id = %s
            ''', (reminder_id,))
            conn.commit()

def get_pending_notifications(user_id):
    """알림이 필요한 예약 목록 (30분 전, 아직 알림 안 보낸 것)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM reminders
            WHERE user_id = %s AND is_completed = 0 AND notified_30min = 0
            ORDER BY scheduled_date ASC, scheduled_time ASC
        ''', (user_id,))
        rows = cursor.fetchall()
        # Timestamp를 문자열로 변환
        result = []
        for row in rows:
            r = dict(row)
            if 'created_at' in r and r['created_at']:
                r['created_at'] = str(r['created_at'])
            if 'updated_at' in r and r['updated_at']:
                r['updated_at'] = str(r['updated_at'])
            result.append(r)
        return result


def get_all_pending_reminder_notifications():
    """모든 사용자의 30분 이내 예약 알림 목록 (스케줄러용)"""
    from datetime import datetime, timedelta

    now = datetime.now()
    today = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M')

    # 30분 후 시간 계산
    time_30min_later = (now + timedelta(minutes=30)).strftime('%H:%M')

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 당일 예약 중 현재~30분 이내, 아직 알림 안 보낸 것
        cursor.execute('''
            SELECT * FROM reminders
            WHERE scheduled_date = %s
              AND scheduled_time > %s
              AND scheduled_time <= %s
              AND is_completed = 0
              AND notified_30min = 0
            ORDER BY scheduled_time ASC
        ''', (today, current_time, time_30min_later))
        rows = cursor.fetchall()

        result = []
        for row in rows:
            r = dict(row)
            if 'created_at' in r and r['created_at']:
                r['created_at'] = str(r['created_at'])
            if 'updated_at' in r and r['updated_at']:
                r['updated_at'] = str(r['updated_at'])
            result.append(r)
        return result


# ==================== 사용자 알림 설정 ====================

def get_user_notification_settings(username):
    """사용자의 알림 설정 조회 (없으면 기본값 반환)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM user_notification_settings WHERE username = %s
        ''', (username,))
        row = cursor.fetchone()

        if row:
            result = dict(row)
            if 'created_at' in result and result['created_at']:
                result['created_at'] = str(result['created_at'])
            if 'updated_at' in result and result['updated_at']:
                result['updated_at'] = str(result['updated_at'])
            return result

        # 기본값 반환
        return {
            'username': username,
            'reminder_minutes': 30,
            'repeat_enabled': False,
            'repeat_interval': 5,
            'repeat_until_minutes': 0,
            'daily_summary_enabled': True,
            'daily_summary_time': '09:00',
            'last_daily_summary_date': None
        }


def save_user_notification_settings(username, settings):
    """사용자 알림 설정 저장 (UPSERT)"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO user_notification_settings
                    (username, reminder_minutes, repeat_enabled, repeat_interval,
                     repeat_until_minutes, daily_summary_enabled, daily_summary_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (username) DO UPDATE SET
                    reminder_minutes = EXCLUDED.reminder_minutes,
                    repeat_enabled = EXCLUDED.repeat_enabled,
                    repeat_interval = EXCLUDED.repeat_interval,
                    repeat_until_minutes = EXCLUDED.repeat_until_minutes,
                    daily_summary_enabled = EXCLUDED.daily_summary_enabled,
                    daily_summary_time = EXCLUDED.daily_summary_time,
                    updated_at = CURRENT_TIMESTAMP
            ''', (
                username,
                settings.get('reminder_minutes', 30),
                settings.get('repeat_enabled', False),
                settings.get('repeat_interval', 5),
                settings.get('repeat_until_minutes', 0),
                settings.get('daily_summary_enabled', True),
                settings.get('daily_summary_time', '09:00')
            ))
            conn.commit()
            return True


def update_last_daily_summary(username, date_str):
    """일일 요약 발송 날짜 업데이트"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_notification_settings
                SET last_daily_summary_date = %s, updated_at = CURRENT_TIMESTAMP
                WHERE username = %s
            ''', (date_str, username))
            conn.commit()


def get_users_needing_daily_summary():
    """일일 요약이 필요한 사용자 목록 (오늘 아직 안 보낸 사람)"""
    from datetime import date
    today = str(date.today())

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 설정이 있는 사용자 중 오늘 요약 안 보낸 사람
        cursor.execute('''
            SELECT username, daily_summary_time
            FROM user_notification_settings
            WHERE daily_summary_enabled = true
              AND (last_daily_summary_date IS NULL OR last_daily_summary_date < %s)
        ''', (today,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_all_reminder_users():
    """예약이 있는 모든 사용자 목록"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT user_id FROM reminders WHERE is_completed = 0
        ''')
        rows = cursor.fetchall()
        return [row['user_id'] for row in rows]


def get_today_reminder_count(username):
    """사용자의 당일 예약 개수"""
    from datetime import date
    today = str(date.today())

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT COUNT(*) as count FROM reminders
            WHERE user_id = %s AND scheduled_date = %s AND is_completed = 0
        ''', (username, today))
        row = cursor.fetchone()
        return row['count'] if row else 0


def get_today_reminders_list(username):
    """사용자의 당일 예약 목록 (시간순)"""
    from datetime import date
    today = str(date.today())

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title, scheduled_time FROM reminders
            WHERE user_id = %s AND scheduled_date = %s AND is_completed = 0
            ORDER BY scheduled_time ASC
        ''', (username, today))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def update_reminder_notification(reminder_id):
    """예약 알림 발송 기록 업데이트"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE reminders
                SET last_notified_at = CURRENT_TIMESTAMP,
                    notification_count = notification_count + 1,
                    notified_30min = 1
                WHERE id = %s
            ''', (reminder_id,))
            conn.commit()


def get_pending_reminders_for_notification():
    """알림이 필요한 모든 예약 목록 (사용자별 설정 적용)"""
    from datetime import datetime, timedelta

    now = datetime.now()
    today = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M')

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 당일 미완료 예약 + 사용자 설정 조인
        cursor.execute('''
            SELECT r.*,
                   COALESCE(s.reminder_minutes, 30) as reminder_minutes,
                   COALESCE(s.repeat_enabled, false) as repeat_enabled,
                   COALESCE(s.repeat_interval, 5) as repeat_interval,
                   COALESCE(s.repeat_until_minutes, 0) as repeat_until_minutes
            FROM reminders r
            LEFT JOIN user_notification_settings s ON r.user_id = s.username
            WHERE r.scheduled_date = %s
              AND r.is_completed = 0
              AND r.scheduled_time > %s
            ORDER BY r.scheduled_time ASC
        ''', (today, current_time))
        rows = cursor.fetchall()

        result = []
        for row in rows:
            r = dict(row)
            # 예약 시간 파싱
            scheduled_time = datetime.strptime(f"{today} {r['scheduled_time']}", '%Y-%m-%d %H:%M')
            minutes_until = (scheduled_time - now).total_seconds() / 60

            # 첫 알림 체크 (설정된 분 전)
            reminder_minutes = r.get('reminder_minutes', 30)
            if minutes_until <= reminder_minutes and r.get('notification_count', 0) == 0:
                r['should_notify'] = True
                r['notify_reason'] = 'first'
                result.append(r)
                continue

            # 반복 알림 체크
            if r.get('repeat_enabled') and r.get('notification_count', 0) > 0:
                repeat_interval = r.get('repeat_interval', 5)
                repeat_until = r.get('repeat_until_minutes', 0)

                # 마지막 알림 이후 repeat_interval분 경과했는지
                last_notified = r.get('last_notified_at')
                if last_notified:
                    if isinstance(last_notified, str):
                        # 여러 날짜 포맷 시도
                        for fmt in ['%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M']:
                            try:
                                last_notified = datetime.strptime(last_notified, fmt)
                                break
                            except ValueError:
                                continue
                    minutes_since_last = (now - last_notified).total_seconds() / 60

                    # repeat_until 체크 (예약 시간까지 또는 설정된 분까지)
                    if minutes_until > repeat_until and minutes_since_last >= repeat_interval:
                        r['should_notify'] = True
                        r['notify_reason'] = 'repeat'
                        result.append(r)

        return result


# ==================== 유틸리티 ====================

def get_next_id(table):
    """다음 사용할 ID 반환"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'SELECT MAX(id) FROM {table}')
        result = cursor.fetchone()['max']
        return (result or 0) + 1

def vacuum_database():
    """데이터베이스 최적화 (PostgreSQL은 VACUUM 자동 실행)"""
    with get_db_connection() as conn:
        old_isolation = conn.isolation_level
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        cursor.execute('VACUUM ANALYZE')
        conn.set_isolation_level(old_isolation)
        logger.info("Database vacuumed successfully")

# ==================== 공휴일 관리 ====================

def load_holidays(year=None):
    """공휴일 조회
    Args:
        year: 연도 (None이면 모든 공휴일)
    Returns:
        list: 공휴일 목록 [{'holiday_date': 'YYYY-MM-DD', 'holiday_name': 'name', ...}, ...]
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if year:
            cursor.execute('''
                SELECT holiday_date, holiday_name, year
                FROM holidays
                WHERE year = %s
                ORDER BY holiday_date
            ''', (year,))
        else:
            cursor.execute('''
                SELECT holiday_date, holiday_name, year
                FROM holidays
                ORDER BY holiday_date
            ''')

        rows = cursor.fetchall()
        return [dict(row) for row in rows]
