"""
비밀번호 해싱 헬퍼 모듈
bcrypt를 사용한 안전한 비밀번호 저장 및 검증
"""
from __future__ import annotations
import bcrypt
import logging

logger = logging.getLogger('crm')


def hash_password(password: str) -> str:
    """
    비밀번호를 bcrypt로 해싱

    Args:
        password: 평문 비밀번호

    Returns:
        str: 해싱된 비밀번호 (bcrypt 형식)
    """
    # bcrypt는 자동으로 salt를 생성하고 포함시킴
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))
    return hashed.decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증

    Args:
        password: 입력된 평문 비밀번호
        hashed_password: 저장된 해시 비밀번호

    Returns:
        bool: 일치 여부
    """
    try:
        password_bytes = password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def is_hashed(password: str) -> bool:
    """
    비밀번호가 이미 해싱되어 있는지 확인
    bcrypt 해시는 '$2b$' 또는 '$2a$'로 시작함

    Args:
        password: 확인할 비밀번호 문자열

    Returns:
        bool: 해싱 여부
    """
    return password.startswith('$2b$') or password.startswith('$2a$')


def needs_rehash(hashed_password: str, rounds: int = 12) -> bool:
    """
    해시가 재해싱이 필요한지 확인 (보안 강화 시)

    Args:
        hashed_password: 해시된 비밀번호
        rounds: 원하는 rounds 수

    Returns:
        bool: 재해싱 필요 여부
    """
    try:
        # bcrypt 해시에서 rounds 추출 (예: $2b$12$...)
        parts = hashed_password.split('$')
        if len(parts) >= 3:
            current_rounds = int(parts[2])
            return current_rounds < rounds
    except (ValueError, IndexError):
        pass
    return True
