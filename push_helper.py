"""
푸시 알림 헬퍼 모듈
웹 푸시 알림을 발송하기 위한 유틸리티 함수들
"""

import os
import json
from pywebpush import webpush, WebPushException
from database import get_db_connection


def get_vapid_keys():
    """VAPID 키 경로와 claims를 반환합니다."""
    private_key_path = os.path.join(os.path.dirname(__file__), 'vapid_private.pem')

    return {
        'private_key_path': private_key_path,
        'claims': {
            'sub': 'mailto:admin@haruittl.asuscomm.com'
        }
    }


def get_user_subscriptions(username):
    """특정 사용자의 모든 푸시 구독 정보를 가져옵니다."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, endpoint, p256dh, auth
            FROM push_subscriptions
            WHERE username = %s
        """, (username,))

        subscriptions = []
        for row in cur.fetchall():
            subscriptions.append({
                'id': row['id'],
                'endpoint': row['endpoint'],
                'keys': {
                    'p256dh': row['p256dh'],
                    'auth': row['auth']
                }
            })

        return subscriptions


def send_push_notification(username, title, body, data=None):
    """
    사용자에게 푸시 알림을 발송합니다.

    Args:
        username (str): 알림을 받을 사용자 이름
        title (str): 알림 제목
        body (str): 알림 본문
        data (dict, optional): 추가 데이터

    Returns:
        dict: 발송 결과 {'success': int, 'failed': int, 'errors': list}
    """
    subscriptions = get_user_subscriptions(username)

    if not subscriptions:
        return {
            'success': 0,
            'failed': 0,
            'errors': ['No subscriptions found for user']
        }

    vapid_keys = get_vapid_keys()

    # 푸시 메시지 페이로드
    payload = {
        'title': title,
        'body': body,
        'icon': '/static/icon-192.png',
        'badge': '/static/icon-192.png',
        'data': data or {}
    }

    results = {
        'success': 0,
        'failed': 0,
        'errors': []
    }

    with get_db_connection() as conn:
        cur = conn.cursor()

        for subscription in subscriptions:
            try:
                # 푸시 알림 발송
                webpush(
                    subscription_info={
                        'endpoint': subscription['endpoint'],
                        'keys': subscription['keys']
                    },
                    data=json.dumps(payload),
                    vapid_private_key=vapid_keys['private_key_path'],
                    vapid_claims=vapid_keys['claims']
                )
                results['success'] += 1

            except WebPushException as e:
                results['failed'] += 1
                error_msg = f"Subscription {subscription['id']}: {str(e)}"
                results['errors'].append(error_msg)

                # 410 Gone 또는 404 Not Found 에러는 구독이 만료된 것이므로 DB에서 삭제
                if e.response and e.response.status_code in [410, 404]:
                    try:
                        cur.execute(
                            "DELETE FROM push_subscriptions WHERE id = %s",
                            (subscription['id'],)
                        )
                        conn.commit()
                    except Exception as del_error:
                        results['errors'].append(f"Failed to delete subscription {subscription['id']}: {str(del_error)}")

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Subscription {subscription['id']}: {str(e)}")

    return results


def send_push_to_multiple_users(usernames, title, body, data=None):
    """
    여러 사용자에게 푸시 알림을 발송합니다.

    Args:
        usernames (list): 알림을 받을 사용자 이름 목록
        title (str): 알림 제목
        body (str): 알림 본문
        data (dict, optional): 추가 데이터

    Returns:
        dict: 전체 발송 결과
    """
    total_results = {
        'success': 0,
        'failed': 0,
        'errors': []
    }

    for username in usernames:
        result = send_push_notification(username, title, body, data)
        total_results['success'] += result['success']
        total_results['failed'] += result['failed']
        total_results['errors'].extend(result['errors'])

    return total_results


def save_subscription(username, subscription_data):
    """
    푸시 구독 정보를 저장합니다.

    Args:
        username (str): 사용자 이름
        subscription_data (dict): 구독 정보 {'endpoint': str, 'keys': {'p256dh': str, 'auth': str}}

    Returns:
        bool: 성공 여부
    """
    try:
        endpoint = subscription_data['endpoint']
        p256dh = subscription_data['keys']['p256dh']
        auth = subscription_data['keys']['auth']

        with get_db_connection() as conn:
            cur = conn.cursor()
            # UPSERT: endpoint가 이미 있으면 username 업데이트, 없으면 삽입
            cur.execute("""
                INSERT INTO push_subscriptions (username, endpoint, p256dh, auth)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (endpoint)
                DO UPDATE SET
                    username = EXCLUDED.username,
                    p256dh = EXCLUDED.p256dh,
                    auth = EXCLUDED.auth,
                    updated_at = CURRENT_TIMESTAMP
            """, (username, endpoint, p256dh, auth))

            conn.commit()
            return True

    except Exception as e:
        print(f"Error saving subscription: {e}")
        import traceback
        traceback.print_exc()
        return False


def remove_subscription(endpoint):
    """
    푸시 구독 정보를 삭제합니다.

    Args:
        endpoint (str): 구독 엔드포인트 URL

    Returns:
        bool: 성공 여부
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM push_subscriptions WHERE endpoint = %s",
                (endpoint,)
            )
            conn.commit()
            return True

    except Exception as e:
        print(f"Error removing subscription: {e}")
        return False
