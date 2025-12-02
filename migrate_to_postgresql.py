#!/usr/bin/env python3
"""
SQLite to PostgreSQL 데이터 마이그레이션 스크립트
"""
import sqlite3
import psycopg2
from datetime import datetime

# SQLite 연결
sqlite_db = '/svc/was/crm/crm-webapp/crm.db'
sqlite_conn = sqlite3.connect(sqlite_db)
sqlite_conn.row_factory = sqlite3.Row

# PostgreSQL 연결
pg_conn = psycopg2.connect(
    host='127.0.0.1',
    database='crm_db',
    user='crm_user',
    password='crm_password_2024'
)
pg_conn.autocommit = False

def convert_timestamp(ts_str):
    """SQLite TEXT timestamp를 PostgreSQL TIMESTAMP로 변환"""
    if not ts_str:
        return None
    try:
        # ISO 8601 형식 시도
        return datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
    except:
        try:
            # 다양한 형식 시도
            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f']:
                try:
                    return datetime.strptime(ts_str, fmt)
                except:
                    continue
        except:
            pass
    return ts_str

def migrate_table(table_name, columns, transform_fn=None):
    """테이블 데이터 마이그레이션"""
    print(f"\n마이그레이션 중: {table_name}")

    cursor = sqlite_conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()

    if not rows:
        print(f"  {table_name}: 데이터 없음")
        return

    pg_cursor = pg_conn.cursor()

    # 컬럼 리스트 생성
    cols = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))

    insert_count = 0
    for row in rows:
        values = []
        for col in columns:
            val = row[col] if col in row.keys() else None
            if transform_fn:
                val = transform_fn(col, val)
            values.append(val)

        try:
            pg_cursor.execute(
                f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})",
                values
            )
            insert_count += 1
        except Exception as e:
            print(f"  오류 (row {insert_count}): {e}")
            print(f"  값: {values}")
            raise

    pg_conn.commit()
    print(f"  {table_name}: {insert_count}개 레코드 마이그레이션 완료")

def transform_users(col, val):
    """users 테이블 변환"""
    if col == 'created_at' and val:
        return convert_timestamp(val)
    return val

def transform_chats(col, val):
    """chats 테이블 변환"""
    if col == 'created_at' and val:
        return convert_timestamp(val)
    return val

def transform_messages(col, val):
    """messages 테이블 변환"""
    if col == 'timestamp' and val:
        return convert_timestamp(val)
    return val

def transform_promotions(col, val):
    """promotions 테이블 변환"""
    if col in ['created_at', 'updated_at'] and val:
        return convert_timestamp(val)
    return val

def transform_tasks(col, val):
    """tasks 테이블 변환"""
    if col in ['created_at', 'assigned_at', 'updated_at', 'completed_at'] and val:
        return convert_timestamp(val)
    return val

def transform_reminders(col, val):
    """reminders 테이블 변환"""
    if col in ['created_at', 'updated_at'] and val:
        return convert_timestamp(val)
    return val

try:
    print("=" * 60)
    print("SQLite → PostgreSQL 데이터 마이그레이션 시작")
    print("=" * 60)

    # 1. users 테이블
    migrate_table('users',
        ['id', 'username', 'created_at', 'team', 'password', 'role', 'status'],
        transform_users)

    # 2. chats 테이블
    migrate_table('chats',
        ['id', 'title', 'creator', 'created_at'],
        transform_chats)

    # 3. chat_participants 테이블
    migrate_table('chat_participants',
        ['id', 'chat_id', 'username'])

    # 4. messages 테이블
    migrate_table('messages',
        ['id', 'chat_id', 'username', 'message', 'timestamp', 'file_path', 'file_name'],
        transform_messages)

    # 5. message_reads 테이블
    migrate_table('message_reads',
        ['id', 'message_id', 'username'])

    # 6. promotions 테이블
    migrate_table('promotions',
        ['id', 'category', 'product_name', 'channel', 'promotion_name', 'promotion_code',
         'content', 'start_date', 'end_date', 'created_at', 'updated_at', 'created_by',
         'discount_amount', 'session_exemption'],
        transform_promotions)

    # 7. promotion_subscription_types 테이블
    migrate_table('promotion_subscription_types',
        ['id', 'promotion_id', 'subscription_type'])

    # 8. tasks 테이블
    migrate_table('tasks',
        ['id', 'assigned_to', 'title', 'content', 'created_at', 'status',
         'assigned_at', 'updated_at', 'completed_at', 'team'],
        transform_tasks)

    # 9. reminders 테이블
    migrate_table('reminders',
        ['id', 'user_id', 'title', 'content', 'scheduled_date', 'scheduled_time',
         'is_completed', 'created_at', 'updated_at', 'notified_30min'],
        transform_reminders)

    # 시퀀스 업데이트 (SERIAL 컬럼의 다음 값 설정)
    print("\n시퀀스 업데이트 중...")
    pg_cursor = pg_conn.cursor()

    tables_with_serial = [
        'users', 'chats', 'chat_participants', 'messages', 'message_reads',
        'promotions', 'promotion_subscription_types', 'tasks', 'reminders'
    ]

    for table in tables_with_serial:
        pg_cursor.execute(f"SELECT MAX(id) FROM {table}")
        max_id = pg_cursor.fetchone()[0]
        if max_id:
            pg_cursor.execute(f"SELECT setval('{table}_id_seq', {max_id})")
            print(f"  {table}_id_seq → {max_id}")

    pg_conn.commit()

    print("\n" + "=" * 60)
    print("마이그레이션 완료!")
    print("=" * 60)

    # 검증
    print("\n데이터 카운트 검증:")
    print(f"{'테이블':<30} {'SQLite':<15} {'PostgreSQL':<15}")
    print("-" * 60)

    for table in ['users', 'chats', 'chat_participants', 'messages', 'message_reads',
                  'promotions', 'promotion_subscription_types', 'tasks', 'reminders']:
        sqlite_cursor = sqlite_conn.cursor()
        sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        sqlite_count = sqlite_cursor.fetchone()[0]

        pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        pg_count = pg_cursor.fetchone()[0]

        match = "✓" if sqlite_count == pg_count else "✗"
        print(f"{table:<30} {sqlite_count:<15} {pg_count:<15} {match}")

except Exception as e:
    print(f"\n오류 발생: {e}")
    import traceback
    traceback.print_exc()
    pg_conn.rollback()
    exit(1)

finally:
    sqlite_conn.close()
    pg_conn.close()
