"""
SQLite 데이터베이스 초기화 및 마이그레이션 스크립트
기존 JSON 데이터를 SQLite로 마이그레이션합니다.
"""
import sqlite3
import json
import os
from datetime import datetime

DB_FILE = 'crm.db'

def create_database():
    """데이터베이스 스키마 생성"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. 할일 관리 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assigned_to TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    # 2. 사용자 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 3. 채팅방 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            creator TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    # 4. 채팅방 참여자 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            UNIQUE(chat_id, username)
        )
    ''')

    # 5. 메시지 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            file_path TEXT,
            file_name TEXT,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        )
    ''')

    # 6. 메시지 읽음 상태 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS message_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            UNIQUE(message_id, username)
        )
    ''')

    # 7. 프로모션 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            product_name TEXT NOT NULL,
            channel TEXT NOT NULL,
            promotion_name TEXT NOT NULL,
            promotion_code TEXT,
            content TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            discount_amount TEXT,
            session_exemption TEXT
        )
    ''')

    # 8. 프로모션 구독 유형 테이블 (다대다 관계)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS promotion_subscription_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            promotion_id INTEGER NOT NULL,
            subscription_type TEXT NOT NULL,
            FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
        )
    ''')

    # 인덱스 생성 (성능 향상)
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_participants(chat_id)')

    conn.commit()
    conn.close()
    print("[OK] 데이터베이스 스키마 생성 완료")

def migrate_data():
    """기존 JSON 데이터를 SQLite로 마이그레이션"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # 1. 할일 데이터 마이그레이션
        if os.path.exists('data.json'):
            with open('data.json', 'r', encoding='utf-8') as f:
                tasks = json.load(f)

            for task in tasks:
                cursor.execute('''
                    INSERT INTO tasks (id, assigned_to, title, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (task['id'], task['assigned_to'], task['title'],
                      task['content'], task['created_at']))
            print(f"[OK] 할일 {len(tasks)}개 마이그레이션 완료")

        # 2. 사용자 데이터 마이그레이션
        if os.path.exists('users.json'):
            with open('users.json', 'r', encoding='utf-8') as f:
                users = json.load(f)

            for username in users:
                cursor.execute('''
                    INSERT OR IGNORE INTO users (username)
                    VALUES (?)
                ''', (username,))
            print(f"[OK] 사용자 {len(users)}명 마이그레이션 완료")

        # 3. 채팅 데이터 마이그레이션
        if os.path.exists('chats.json'):
            with open('chats.json', 'r', encoding='utf-8') as f:
                chats_data = json.load(f)

            message_count = 0
            for chat_id, chat in chats_data.items():
                # 채팅방 생성
                cursor.execute('''
                    INSERT INTO chats (id, title, creator, created_at)
                    VALUES (?, ?, ?, ?)
                ''', (int(chat_id), chat['title'], chat['creator'], chat['created_at']))

                # 참여자 추가
                for participant in chat['participants']:
                    cursor.execute('''
                        INSERT OR IGNORE INTO chat_participants (chat_id, username)
                        VALUES (?, ?)
                    ''', (int(chat_id), participant))

                # 메시지 추가
                for msg in chat['messages']:
                    cursor.execute('''
                        INSERT INTO messages (chat_id, username, message, timestamp, file_path, file_name)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (int(chat_id), msg['username'], msg['message'], msg['timestamp'],
                          msg.get('file_path'), msg.get('file_name')))

                    message_id = cursor.lastrowid
                    message_count += 1

                    # 읽음 상태 추가
                    if 'read_by' in msg:
                        for reader in msg['read_by']:
                            cursor.execute('''
                                INSERT OR IGNORE INTO message_reads (message_id, username)
                                VALUES (?, ?)
                            ''', (message_id, reader))

            print(f"[OK] 채팅방 {len(chats_data)}개, 메시지 {message_count}개 마이그레이션 완료")

        # 4. 프로모션 데이터 마이그레이션
        if os.path.exists('promotions.json'):
            with open('promotions.json', 'r', encoding='utf-8') as f:
                promotions = json.load(f)

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

                # 구독 유형 추가
                if 'subscription_types' in promo:
                    for sub_type in promo['subscription_types']:
                        cursor.execute('''
                            INSERT INTO promotion_subscription_types (promotion_id, subscription_type)
                            VALUES (?, ?)
                        ''', (promo['id'], sub_type))

            print(f"[OK] 프로모션 {len(promotions)}개 마이그레이션 완료")

        conn.commit()
        print("\n[SUCCESS] 모든 데이터 마이그레이션 완료!")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] 마이그레이션 오류: {e}")
        raise
    finally:
        conn.close()

def backup_json_files():
    """기존 JSON 파일 백업"""
    backup_dir = 'json_backup_' + datetime.now().strftime('%Y%m%d_%H%M%S')
    os.makedirs(backup_dir, exist_ok=True)

    json_files = ['data.json', 'users.json', 'chats.json', 'promotions.json']
    for filename in json_files:
        if os.path.exists(filename):
            import shutil
            shutil.copy(filename, os.path.join(backup_dir, filename))

    print(f"[OK] JSON 파일 백업 완료: {backup_dir}")
    return backup_dir

def verify_migration():
    """마이그레이션 검증"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    print("\n[INFO] 마이그레이션 결과:")

    tables = ['tasks', 'users', 'chats', 'messages', 'promotions']
    for table in tables:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        print(f"  - {table}: {count}개")

    conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("SQLite 마이그레이션 시작")
    print("=" * 60)

    # 1. JSON 백업
    print("\n[1/4] JSON 파일 백업 중...")
    backup_dir = backup_json_files()

    # 2. 데이터베이스 생성
    print("\n[2/4] 데이터베이스 스키마 생성 중...")
    create_database()

    # 3. 데이터 마이그레이션
    print("\n[3/4] 데이터 마이그레이션 중...")
    migrate_data()

    # 4. 검증
    print("\n[4/4] 마이그레이션 검증 중...")
    verify_migration()

    print("\n" + "=" * 60)
    print("[OK] 마이그레이션 완료!")
    print(f"[INFO] 백업 위치: {backup_dir}")
    print(f"[INFO] 데이터베이스: {DB_FILE}")
    print("=" * 60)
