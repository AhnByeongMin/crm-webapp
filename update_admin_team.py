"""
관리자를 별도 팀으로 분류하는 스크립트
"""
import database

# 관리자 계정
ADMIN_ACCOUNTS = ['김은아', '김지원', '민건희', '홍민지', '안병민']

def update_admin_team():
    """관리자를 '관리자' 팀으로 분류"""
    with database.get_db_connection() as conn:
        cursor = conn.cursor()

        # 관리자 계정을 '관리자' 팀으로 업데이트
        for admin in ADMIN_ACCOUNTS:
            cursor.execute(
                "UPDATE users SET team = '관리자' WHERE username = ?",
                (admin,)
            )
            print(f"[OK] {admin} -> 관리자 팀으로 이동")

        conn.commit()

        # 결과 확인
        print("\n" + "=" * 60)
        print("팀별 사용자 현황")
        print("=" * 60)

        cursor.execute("""
            SELECT team, COUNT(*) as count
            FROM users
            WHERE team IS NOT NULL
            GROUP BY team
            ORDER BY team
        """)

        for row in cursor.fetchall():
            team = row['team']
            count = row['count']
            print(f"[{team}] {count}명")

        cursor.execute("SELECT COUNT(*) as count FROM users WHERE team IS NULL")
        no_team_count = cursor.fetchone()['count']
        if no_team_count > 0:
            print(f"[팀 없음] {no_team_count}명")

        print("=" * 60)

if __name__ == '__main__':
    update_admin_team()
