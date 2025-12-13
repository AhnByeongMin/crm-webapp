#!/usr/bin/env python3
"""
비밀번호 마이그레이션 스크립트
기존 평문 비밀번호를 bcrypt 해시로 일괄 변환

사용법:
    python scripts/migrate_passwords.py [--dry-run]

옵션:
    --dry-run: 실제 변경 없이 마이그레이션 대상만 확인
"""
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from password_helper import hash_password, is_hashed
import database


def migrate_passwords(dry_run: bool = False) -> dict:
    """
    모든 평문 비밀번호를 bcrypt로 마이그레이션

    Args:
        dry_run: True면 실제 변경 없이 대상만 확인

    Returns:
        dict: 마이그레이션 결과 통계
    """
    stats = {
        'total': 0,
        'already_hashed': 0,
        'migrated': 0,
        'failed': 0,
        'users': []
    }

    print("=" * 50)
    print("비밀번호 마이그레이션 스크립트")
    print("=" * 50)

    if dry_run:
        print("🔍 DRY RUN 모드 - 실제 변경 없음\n")
    else:
        print("⚠️  실제 마이그레이션 모드\n")

    # 모든 사용자 조회
    with database.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, password, role FROM users')
        users = cursor.fetchall()

    stats['total'] = len(users)
    print(f"총 사용자 수: {stats['total']}\n")

    for user in users:
        user_id = user['id']
        username = user['username']
        password = user['password']
        role = user['role']

        if is_hashed(password):
            stats['already_hashed'] += 1
            print(f"  ✓ {username}: 이미 해싱됨")
        else:
            stats['users'].append(username)
            if dry_run:
                print(f"  → {username}: 마이그레이션 필요 (role: {role})")
                stats['migrated'] += 1
            else:
                try:
                    # 해싱 및 업데이트
                    hashed_pw = hash_password(password)
                    with database.db_lock:
                        with database.get_db_connection() as conn:
                            cursor = conn.cursor()
                            cursor.execute(
                                'UPDATE users SET password = %s WHERE id = %s',
                                (hashed_pw, user_id)
                            )
                            conn.commit()
                    print(f"  ✓ {username}: 마이그레이션 완료")
                    stats['migrated'] += 1
                except Exception as e:
                    print(f"  ✗ {username}: 마이그레이션 실패 - {e}")
                    stats['failed'] += 1

    # 결과 출력
    print("\n" + "=" * 50)
    print("마이그레이션 결과")
    print("=" * 50)
    print(f"  총 사용자: {stats['total']}")
    print(f"  이미 해싱됨: {stats['already_hashed']}")
    print(f"  마이그레이션됨: {stats['migrated']}")
    if stats['failed'] > 0:
        print(f"  실패: {stats['failed']}")

    if dry_run and stats['users']:
        print(f"\n마이그레이션 대상 사용자: {', '.join(stats['users'])}")

    return stats


def main():
    dry_run = '--dry-run' in sys.argv

    if not dry_run:
        print("\n⚠️  경고: 이 작업은 모든 사용자의 비밀번호를 변경합니다!")
        print("    --dry-run 옵션으로 먼저 확인하세요.\n")
        confirm = input("계속하시겠습니까? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("취소되었습니다.")
            return

    migrate_passwords(dry_run=dry_run)


if __name__ == '__main__':
    main()
