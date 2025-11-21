"""
데이터베이스 마이그레이션: tasks 테이블에 status 필드 추가
- status 컬럼 추가 (기본값: '대기중')
- assigned_to 컬럼을 NULL 허용으로 변경 (미배정 가능)
"""
import sqlite3
import os

DB_FILE = 'crm.db'

def migrate():
    """마이그레이션 실행"""
    if not os.path.exists(DB_FILE):
        print(f"[ERROR] {DB_FILE} 파일이 존재하지 않습니다.")
        print("먼저 init_db.py를 실행하여 데이터베이스를 생성하세요.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        print("=" * 60)
        print("데이터베이스 마이그레이션 시작")
        print("=" * 60)

        # 1. 기존 테이블 구조 확인
        print("\n[1/4] 기존 테이블 구조 확인...")
        cursor.execute("PRAGMA table_info(tasks)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        print(f"현재 컬럼: {', '.join(column_names)}")

        # status 컬럼이 이미 있는지 확인
        if 'status' in column_names:
            print("[INFO] status 컬럼이 이미 존재합니다. 마이그레이션을 건너뜁니다.")
            return

        # 2. 새 테이블 생성 (status 추가, assigned_to NULL 허용)
        print("\n[2/4] 새 테이블 생성 중...")
        cursor.execute('''
            CREATE TABLE tasks_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assigned_to TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '대기중'
            )
        ''')
        print("[OK] tasks_new 테이블 생성 완료")

        # 3. 기존 데이터 복사 (status는 '대기중'으로 기본값 설정)
        print("\n[3/4] 기존 데이터 복사 중...")
        cursor.execute('''
            INSERT INTO tasks_new (id, assigned_to, title, content, created_at, status)
            SELECT id, assigned_to, title, content, created_at, '대기중'
            FROM tasks
        ''')
        copied_rows = cursor.rowcount
        print(f"[OK] {copied_rows}개 행 복사 완료")

        # 4. 테이블 교체
        print("\n[4/4] 테이블 교체 중...")
        cursor.execute('DROP TABLE tasks')
        cursor.execute('ALTER TABLE tasks_new RENAME TO tasks')
        print("[OK] 테이블 교체 완료")

        # 5. 인덱스 재생성
        print("\n[5/5] 인덱스 재생성 중...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
        print("[OK] 인덱스 재생성 완료")

        conn.commit()

        # 6. 검증
        print("\n[검증] 새 테이블 구조:")
        cursor.execute("PRAGMA table_info(tasks)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'} {f'DEFAULT {col[4]}' if col[4] else ''}")

        cursor.execute('SELECT COUNT(*) FROM tasks')
        count = cursor.fetchone()[0]
        print(f"\n[검증] 총 {count}개 할일 항목 확인")

        print("\n" + "=" * 60)
        print("[SUCCESS] 마이그레이션 완료!")
        print("=" * 60)

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] 마이그레이션 실패: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
