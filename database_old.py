"""
SQLite 데이터베이스 헬퍼 함수
app.py에서 사용할 데이터베이스 CRUD 함수들
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
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # 딕셔너리처럼 접근 가능
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
            # 기존 데이터 삭제
            cursor.execute('DELETE FROM tasks')
            # 새 데이터 삽입
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

# ==================== 채팅 관리 ====================

def load_chats():
    """채팅 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM chats ORDER BY id')
        chats = {}

        for chat_row in cursor.fetchall():
            chat_id = str(chat_row['id'])
            chats[chat_id] = {
                'title': chat_row['title'],
                'creator': chat_row['creator'],
                'created_at': chat_row['created_at'],
                'participants': [],
                'messages': []
            }

            # 참여자 조회
            cursor.execute('''
                SELECT username FROM chat_participants
                WHERE chat_id = ?
            ''', (chat_row['id'],))
            chats[chat_id]['participants'] = [row['username'] for row in cursor.fetchall()]

            # 메시지 조회
            cursor.execute('''
                SELECT * FROM messages
                WHERE chat_id = ?
                ORDER BY id
            ''', (chat_row['id'],))

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

                # 읽음 상태 조회
                cursor.execute('''
                    SELECT username FROM message_reads
                    WHERE message_id = ?
                ''', (msg_row['id'],))
                read_by = [row['username'] for row in cursor.fetchall()]
                if read_by:
                    msg['read_by'] = read_by

                chats[chat_id]['messages'].append(msg)

        return chats

def save_chats(chats):
    """채팅 데이터 저장"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 기존 데이터 삭제
            cursor.execute('DELETE FROM chats')
            cursor.execute('DELETE FROM chat_participants')
            cursor.execute('DELETE FROM messages')
            cursor.execute('DELETE FROM message_reads')

            # 새 데이터 삽입
            for chat_id, chat in chats.items():
                # 채팅방
                cursor.execute('''
                    INSERT INTO chats (id, title, creator, created_at)
                    VALUES (?, ?, ?, ?)
                ''', (int(chat_id), chat['title'], chat['creator'], chat['created_at']))

                # 참여자
                for participant in chat['participants']:
                    cursor.execute('''
                        INSERT INTO chat_participants (chat_id, username)
                        VALUES (?, ?)
                    ''', (int(chat_id), participant))

                # 메시지
                for msg in chat['messages']:
                    cursor.execute('''
                        INSERT INTO messages (chat_id, username, message, timestamp, file_path, file_name)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (int(chat_id), msg['username'], msg['message'], msg['timestamp'],
                          msg.get('file_path'), msg.get('file_name')))

                    message_id = cursor.lastrowid

                    # 읽음 상태
                    if 'read_by' in msg:
                        for reader in msg['read_by']:
                            cursor.execute('''
                                INSERT INTO message_reads (message_id, username)
                                VALUES (?, ?)
                            ''', (message_id, reader))

            conn.commit()

# ==================== 프로모션 관리 ====================

def load_promotions():
    """프로모션 목록 조회"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM promotions ORDER BY id')
        promotions = []

        for row in cursor.fetchall():
            promo = dict(row)

            # 구독 유형 조회
            cursor.execute('''
                SELECT subscription_type FROM promotion_subscription_types
                WHERE promotion_id = ?
            ''', (row['id'],))
            promo['subscription_types'] = [r['subscription_type'] for r in cursor.fetchall()]

            promotions.append(promo)

        return promotions

def save_promotions(promotions):
    """프로모션 데이터 저장"""
    with db_lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 기존 데이터 삭제
            cursor.execute('DELETE FROM promotions')
            cursor.execute('DELETE FROM promotion_subscription_types')

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

                # 구독 유형
                if 'subscription_types' in promo:
                    for sub_type in promo['subscription_types']:
                        cursor.execute('''
                            INSERT INTO promotion_subscription_types (promotion_id, subscription_type)
                            VALUES (?, ?)
                        ''', (promo['id'], sub_type))

            conn.commit()

# ==================== 유틸리티 ====================

def get_next_id(table):
    """다음 사용할 ID 반환"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'SELECT MAX(id) FROM {table}')
        result = cursor.fetchone()[0]
        return (result or 0) + 1
