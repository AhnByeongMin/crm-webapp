"""
팀 구조 추가 및 사용자 팀 배정
"""
import sqlite3

DB_FILE = 'crm.db'

def add_team_structure():
    """팀 테이블 추가 및 사용자에 팀 필드 추가"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        print("=" * 60)
        print("팀 구조 추가 시작")
        print("=" * 60)

        # 1. users 테이블에 team 컬럼 추가
        print("\n[1/5] users 테이블에 team 컬럼 추가...")
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN team TEXT')
            print("[OK] team 컬럼 추가 완료")
        except sqlite3.OperationalError as e:
            if 'duplicate column name' in str(e):
                print("[INFO] team 컬럼이 이미 존재합니다")
            else:
                raise

        # 2. 기존 사용자들을 CRM파트로 배정 (테스트 제외)
        print("\n[2/5] 기존 사용자들을 CRM파트로 배정...")
        cursor.execute("UPDATE users SET team = 'CRM파트' WHERE username != '테스트'")
        print(f"[OK] {cursor.rowcount}명을 CRM파트로 배정")

        # 3. 테스트 사용자는 팀 없음으로 설정
        print("\n[3/5] 테스트 사용자 처리...")
        cursor.execute("UPDATE users SET team = NULL WHERE username = '테스트'")
        print("[OK] 테스트 사용자는 팀 없음으로 설정")

        # 4. 온라인파트 사용자 추가
        print("\n[4/5] 온라인파트 사용자 추가...")
        online_users = ['김부자', '최진영']
        for user in online_users:
            cursor.execute('INSERT OR IGNORE INTO users (username, team) VALUES (?, ?)',
                         (user, '온라인파트'))
        print(f"[OK] 온라인파트 사용자 {len(online_users)}명 추가")

        # 5. 팀별 인덱스 생성
        print("\n[5/5] 팀별 인덱스 생성...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_team ON users(team)')
        print("[OK] 인덱스 생성 완료")

        conn.commit()

        # 검증
        print("\n[검증] 팀별 사용자 현황:")
        cursor.execute('''
            SELECT team, COUNT(*) as count, GROUP_CONCAT(username, ', ') as members
            FROM users
            GROUP BY team
            ORDER BY team
        ''')

        for row in cursor.fetchall():
            team = row[0] if row[0] else '팀 없음'
            count = row[1]
            members = row[2]
            print(f"\n  [{team}] {count}명")
            # 멤버가 너무 많으면 일부만 표시
            if len(members) > 100:
                print(f"    {members[:100]}...")
            else:
                print(f"    {members}")

        print("\n" + "=" * 60)
        print("[SUCCESS] 팀 구조 추가 완료!")
        print("=" * 60)

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] 오류 발생: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    add_team_structure()
