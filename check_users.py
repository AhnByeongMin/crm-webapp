"""
사용자 목록 확인 스크립트
"""
import database

def check_users():
    """현재 사용자 목록 조회"""
    users = database.load_users()

    print("=" * 60)
    print(f"총 사용자: {len(users)}명")
    print("=" * 60)

    for i, user in enumerate(users, 1):
        print(f"{i:2d}. {user}")

    print("=" * 60)

if __name__ == '__main__':
    check_users()
