"""
SQLite 데이터베이스 최적화 스크립트
WAL 모드 활성화 및 성능 최적화 설정
"""
import sqlite3

DB_FILE = 'crm.db'

def optimize_database():
    """데이터베이스 성능 최적화"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    print("SQLite 데이터베이스 최적화 시작...")

    # 1. WAL (Write-Ahead Logging) 모드 활성화
    # - 동시 읽기/쓰기 성능 10배 향상
    # - 읽기 작업이 쓰기 작업을 차단하지 않음
    cursor.execute('PRAGMA journal_mode=WAL')
    result = cursor.fetchone()[0]
    print(f"[1/7] WAL 모드 활성화: {result}")

    # 2. 동기화 모드 최적화 (NORMAL)
    # - FULL: 안전하지만 느림
    # - NORMAL: 일반적인 상황에서 안전하고 빠름 (권장)
    # - OFF: 빠르지만 위험 (전원 차단 시 데이터 손실 가능)
    cursor.execute('PRAGMA synchronous=NORMAL')
    print("[2/7] 동기화 모드: NORMAL")

    # 3. 캐시 크기 증가 (10MB)
    # - 기본값: -2000 (약 2MB)
    # - -10000 = 약 10MB (더 많은 데이터를 메모리에 캐시)
    cursor.execute('PRAGMA cache_size=-10000')
    print("[3/7] 캐시 크기: 10MB")

    # 4. 임시 저장소를 메모리에
    # - 임시 테이블과 인덱스를 디스크 대신 메모리에 생성
    cursor.execute('PRAGMA temp_store=MEMORY')
    print("[4/7] 임시 저장소: 메모리")

    # 5. mmap 크기 설정 (30MB)
    # - 메모리 매핑을 통해 I/O 성능 향상
    cursor.execute('PRAGMA mmap_size=30000000')
    print("[5/7] mmap 크기: 30MB")

    # 6. 페이지 크기 확인
    cursor.execute('PRAGMA page_size')
    page_size = cursor.fetchone()[0]
    print(f"[6/7] 페이지 크기: {page_size} bytes")

    # 7. 추가 인덱스 생성 (성능 향상)
    print("[7/7] 추가 인덱스 생성 중...")

    # message_reads 테이블 인덱스
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_message_reads_message
        ON message_reads(message_id)
    ''')

    # promotions 테이블 추가 인덱스
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_promotions_category
        ON promotions(category)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_promotions_channel
        ON promotions(channel)
    ''')

    # messages 테이블에 timestamp 인덱스
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp
        ON messages(timestamp)
    ''')

    print("    - idx_message_reads_message")
    print("    - idx_promotions_category")
    print("    - idx_promotions_channel")
    print("    - idx_messages_timestamp")

    conn.commit()

    # 최적화 상태 확인
    print("\n[최적화 상태 확인]")
    cursor.execute('PRAGMA journal_mode')
    print(f"  Journal Mode: {cursor.fetchone()[0]}")

    cursor.execute('PRAGMA synchronous')
    print(f"  Synchronous: {cursor.fetchone()[0]}")

    cursor.execute('PRAGMA cache_size')
    print(f"  Cache Size: {cursor.fetchone()[0]}")

    conn.close()
    print("\n[완료] 데이터베이스 최적화 완료!")

if __name__ == '__main__':
    optimize_database()
