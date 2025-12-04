#!/usr/bin/env python3
"""
Script to replace all alert() calls with showAlert() modal calls
"""

import re
import os

# Files to process with their alert patterns
files_to_process = {
    '/svc/was/crm/crm-webapp/templates/chat_list.html': [
        ("alert('채팅방이 삭제되었습니다.');", "showAlert('채팅방이 삭제되었습니다.', 'success');"),
        ("alert('삭제 실패: ' + (data.error || '알 수 없는 오류'));", "showAlert('삭제 실패: ' + (data.error || '알 수 없는 오류'), 'error');"),
        ("alert('삭제 중 오류가 발생했습니다.');", "showAlert('삭제 중 오류가 발생했습니다.', 'error');"),
    ],
    '/svc/was/crm/crm-webapp/templates/chat_room.html': [
        ("alert(`${file.name}은(는) 50MB를 초과합니다.`);", "showAlert(`${file.name}은(는) 50MB를 초과합니다.`, 'warning');"),
        ("alert(`${file.name} 업로드 실패`);", "showAlert(`${file.name} 업로드 실패`, 'error');"),
        ("alert(`${file.name} 업로드 중 오류 발생`);", "showAlert(`${file.name} 업로드 중 오류 발생`, 'error');"),
    ],
    '/svc/was/crm/crm-webapp/templates/chat_create.html': [
        ("alert('최소 한 명의 참여자를 선택하세요.');", "showAlert('최소 한 명의 참여자를 선택하세요.', 'warning');"),
        ("alert('채팅방 제목을 입력하세요.');", "showAlert('채팅방 제목을 입력하세요.', 'warning');"),
        ("alert('채팅방이 생성되었습니다!');", "showAlert('채팅방이 생성되었습니다!', 'success');"),
        ("alert('채팅방 생성에 실패했습니다.');", "showAlert('채팅방 생성에 실패했습니다.', 'error');"),
    ],
    '/svc/was/crm/crm-webapp/templates/admin_chat.html': [
        ("alert('최소 1명의 참여자를 선택하세요.');", "showAlert('최소 1명의 참여자를 선택하세요.', 'warning');"),
        ("alert('채팅방 제목을 입력하세요.');", "showAlert('채팅방 제목을 입력하세요.', 'warning');"),
        ("alert('채팅방이 생성되었습니다.');", "showAlert('채팅방이 생성되었습니다.', 'success');"),
        ("alert('삭제되었습니다.');", "showAlert('삭제되었습니다.', 'success');"),
    ],
    '/svc/was/crm/crm-webapp/templates/admin.html': [
        ("alert('제목을 입력하세요.');", "showAlert('제목을 입력하세요.', 'warning');"),
        ("alert('레이아웃 이름을 입력하세요.');", "showAlert('레이아웃 이름을 입력하세요.', 'warning');"),
        ("alert('시작과 끝 값을 모두 입력해주세요.');", "showAlert('시작과 끝 값을 모두 입력해주세요.', 'warning');"),
        ("alert('값을 입력해주세요.');", "showAlert('값을 입력해주세요.', 'warning');"),
        ("alert('유효한 값을 입력해주세요.');", "showAlert('유효한 값을 입력해주세요.', 'warning');"),
        ("alert('이 앱을 설치하려면:\\n\\n1. Chrome 주소창 오른쪽 메뉴(⋮) 클릭\\n2. \"앱 설치\" 또는 \"바로가기 만들기\" 선택\\n\\n또는 브라우저 설정에서 바로가기를 만들어주세요.');", "showAlert('이 앱을 설치하려면:\\n\\n1. Chrome 주소창 오른쪽 메뉴(⋮) 클릭\\n2. \"앱 설치\" 또는 \"바로가기 만들기\" 선택\\n\\n또는 브라우저 설정에서 바로가기를 만들어주세요.', 'info');"),
    ],
}

def add_include_if_needed(filepath):
    """Add alert modal include if not already present"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    include_line = "{% include 'includes/alert_modal.html' %}"

    if include_line not in content:
        # Add at the beginning
        content = include_line + '\n\n' + content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def replace_alerts(filepath, replacements):
    """Replace alert() calls with showAlert() calls"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return count

def main():
    print("Replacing alert() calls with showAlert() modals...\n")

    total_replaced = 0
    for filepath, replacements in files_to_process.items():
        if not os.path.exists(filepath):
            print(f"⚠️  File not found: {filepath}")
            continue

        # Add include
        added_include = add_include_if_needed(filepath)
        if added_include:
            print(f"✅ Added alert modal include to {os.path.basename(filepath)}")

        # Replace alerts
        count = replace_alerts(filepath, replacements)
        total_replaced += count
        print(f"✅ Replaced {count} alert() calls in {os.path.basename(filepath)}")

    print(f"\n🎉 Total: {total_replaced} alert() calls replaced across {len(files_to_process)} files")

if __name__ == '__main__':
    main()
