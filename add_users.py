"""
사용자 일괄 추가 스크립트
"""
import database

# 추가할 사용자 목록
new_users = [
    '김미정',
    '이연석',
    '이지영',
    '천대영',
    '경도형',
    '전향봉',
    '황선애',
    '임명숙',
    '정문희',
    '장희경',
    '유태경',
    '김태희',
    '조경애',
    '정진경',
    '주성덕',
    '김서윤',
    '신순옥',
    '왕은경',
    '안주연',
    '김원영',
    '이은경',
    '김보경',
    '구준모',
    '이보람',
    '강하나'
]

def add_new_users():
    """신규 사용자 추가"""
    print("=" * 60)
    print("사용자 추가 시작")
    print("=" * 60)

    # 기존 사용자 목록 조회
    existing_users = set(database.load_users())
    print(f"\n기존 사용자: {len(existing_users)}명")

    # 추가할 사용자 필터링 (중복 제거)
    users_to_add = [user for user in new_users if user not in existing_users]

    if not users_to_add:
        print("\n추가할 신규 사용자가 없습니다.")
        return

    print(f"\n추가할 사용자: {len(users_to_add)}명")
    for user in users_to_add:
        print(f"  - {user}")

    # 사용자 추가
    print("\n사용자 추가 중...")
    for user in users_to_add:
        database.add_user(user)

    # 결과 확인
    final_users = database.load_users()
    print(f"\n[완료] 총 사용자: {len(final_users)}명")

    print("\n추가된 사용자 목록:")
    for user in users_to_add:
        print(f"  ✓ {user}")

    print("\n" + "=" * 60)
    print("[SUCCESS] 사용자 추가 완료!")
    print("=" * 60)

if __name__ == '__main__':
    add_new_users()
