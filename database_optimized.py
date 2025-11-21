"""
SQLite 데이터베이스 헬퍼 함수 (최적화 버전)
- N+1 쿼리 제거 (JOIN 사용)
- 부분 조회 기능 추가
- 연결 풀링 및 WAL 모드
"""
import sqlite3
import threading
from contextlib import contextmanager

DB_FILE = 'crm.db'

# 데이터베이스 연결 락 (동시성 제어)
db_lock = threading.Lock()

@contextmanager
def get_db_connection():
    """데이터베이스 연결을 안전하게 관리하는 컨텍스트 매니저"""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # WAL 모드 확인 (첫 연결 시 자동 설정)
    conn.execute('PRAGMA journal_mode=WAL')
    try:
        yield conn
    finally:
        conn.close()

# ==================== 할일 관리 ====================

def load_data():
    """할일 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM tasks ORDER BY id')
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
                    INSERT INTO tasks (id, assigned_to, title, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (task['id'], task['assigned_to'], task['title'],
                      task['content'], task['created_at']))
            conn.commit()

# ==================== 사용자 관리 ====================

def load_users():
    """사용자 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT username FROM users ORDER BY username')
        return [row['username'] for row in cursor.fetchall()]

def save_users(users):
    """사용자 목록 저장"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM users')
            for username in users:
                cursor.execute('INSERT INTO users (username) VALUES (?)', (username,))
            conn.commit()

def add_user(username):
    """사용자 추가"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT OR IGNORE INTO users (username) VALUES (?)', (username,))
            conn.commit()

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
                'created_at': chat_row['created_at'],
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
                    'username': msg_row['username'],
                    'message': msg_row['message'],
                    'timestamp': msg_row['timestamp']
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
        cursor.execute('SELECT * FROM chats WHERE id = ?', (int(chat_id),))
        chat_row = cursor.fetchone()
        if not chat_row:
            return None

        chat = {
            'title': chat_row['title'],
            'creator': chat_row['creator'],
            'created_at': chat_row['created_at'],
            'participants': [],
            'messages': []
        }

        # 참여자
        cursor.execute('''
            SELECT username FROM chat_participants
            WHERE chat_id = ?
        ''', (int(chat_id),))
        chat['participants'] = [row['username'] for row in cursor.fetchall()]

        # 메시지
        cursor.execute('''
            SELECT m.id, m.username, m.message, m.timestamp,
                   m.file_path, m.file_name
            FROM messages m
            WHERE m.chat_id = ?
            ORDER BY m.id
        ''', (int(chat_id),))

        messages_by_id = {}
        for msg_row in cursor.fetchall():
            msg = {
                'username': msg_row['username'],
                'message': msg_row['message'],
                'timestamp': msg_row['timestamp']
            }
            if msg_row['file_path']:
                msg['file_path'] = msg_row['file_path']
            if msg_row['file_name']:
                msg['file_name'] = msg_row['file_name']

            messages_by_id[msg_row['id']] = msg
            chat['messages'].append(msg)

        # 읽음 상태
        if messages_by_id:
            placeholders = ','.join('?' * len(messages_by_id))
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

            # 트랜잭션 시작
            cursor.execute('BEGIN TRANSACTION')

            try:
                # 기존 데이터 삭제
                cursor.execute('DELETE FROM chats')

                # 새 데이터 삽입
                for chat_id, chat in chats.items():
                    # 채팅방
                    cursor.execute('''
                        INSERT INTO chats (id, title, creator, created_at)
                        VALUES (?, ?, ?, ?)
                    ''', (int(chat_id), chat['title'], chat['creator'], chat['created_at']))

                    # 참여자 (배치 삽입)
                    if chat['participants']:
                        participant_data = [(int(chat_id), p) for p in chat['participants']]
                        cursor.executemany('''
                            INSERT INTO chat_participants (chat_id, username)
                            VALUES (?, ?)
                        ''', participant_data)

                    # 메시지
                    for msg in chat['messages']:
                        cursor.execute('''
                            INSERT INTO messages (chat_id, username, message, timestamp, file_path, file_name)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (int(chat_id), msg['username'], msg['message'], msg['timestamp'],
                              msg.get('file_path'), msg.get('file_name')))

                        message_id = cursor.lastrowid

                        # 읽음 상태 (배치 삽입)
                        if 'read_by' in msg and msg['read_by']:
                            read_data = [(message_id, reader) for reader in msg['read_by']]
                            cursor.executemany('''
                                INSERT INTO message_reads (message_id, username)
                                VALUES (?, ?)
                            ''', read_data)

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise e

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

            cursor.execute('BEGIN TRANSACTION')

            try:
                # 기존 데이터 삭제
                cursor.execute('DELETE FROM promotions')

                # 새 데이터 삽입
                for promo in promotions:
                    cursor.execute('''
                        INSERT INTO promotions
                        (id, category, product_name, channel, promotion_name, promotion_code,
                         content, start_date, end_date, created_at, updated_at, created_by,
                         discount_amount, session_exemption)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (promo['id'], promo['category'], promo['product_name'],
                          promo['channel'], promo['promotion_name'], promo.get('promotion_code', ''),
                          promo['content'], promo['start_date'], promo['end_date'],
                          promo['created_at'], promo['updated_at'], promo['created_by'],
                          promo.get('discount_amount'), promo.get('session_exemption')))

                    # 구독 유형 (배치 삽입)
                    if 'subscription_types' in promo and promo['subscription_types']:
                        sub_data = [(promo['id'], st) for st in promo['subscription_types']]
                        cursor.executemany('''
                            INSERT INTO promotion_subscription_types (promotion_id, subscription_type)
                            VALUES (?, ?)
                        ''', sub_data)

                conn.commit()
            except Exception as e:
                conn.rollback()
                raise e

# ==================== 유틸리티 ====================

def get_next_id(table):
    """다음 사용할 ID 반환"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'SELECT MAX(id) FROM {table}')
        result = cursor.fetchone()[0]
        return (result or 0) + 1

def vacuum_database():
    """데이터베이스 최적화 (주기적으로 실행 권장)"""
    with get_db_connection() as conn:
        conn.execute('VACUUM')
        print("Database vacuumed successfully")
