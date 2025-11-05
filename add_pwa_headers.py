import os
import re

PWA_HEADER = '''
    <!-- PWA 메타 태그 -->
    <meta name="description" content="긴급 상황을 위한 업무 할당 및 채팅 시스템">
    <meta name="theme-color" content="#667eea">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="업무관리">
    <link rel="manifest" href="/static/manifest.json">
    <link rel="icon" type="image/png" sizes="192x192" href="/static/icon-192.png">
    <link rel="apple-touch-icon" href="/static/icon-192.png">
'''

SERVICE_WORKER_SCRIPT = '''
        // PWA 서비스 워커 등록
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/static/service-worker.js')
                .then(registration => {
                    console.log('Service Worker 등록 성공:', registration.scope);
                })
                .catch(error => {
                    console.log('Service Worker 등록 실패:', error);
                });
        }
'''

# 처리할 HTML 파일 목록 (이미 처리한 login.html과 admin.html 제외)
html_files = [
    'templates/user.html',
    'templates/admin_chat.html',
    'templates/chat_list.html',
    'templates/chat_create.html',
    'templates/chat_room.html'
]

for filepath in html_files:
    print(f'\n처리 중: {filepath}')

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # PWA 헤더가 이미 있는지 확인
    if 'PWA 메타 태그' in content:
        print(f'  - PWA 헤더 이미 존재, 스킵')
        continue

    # <title> 태그 다음에 PWA 헤더 삽입
    content = re.sub(
        r'(<title>.*?</title>)',
        r'\1' + PWA_HEADER,
        content,
        count=1
    )

    # 서비스 워커 스크립트가 이미 있는지 확인
    if 'Service Worker 등록' not in content:
        # </script> 태그 직전에 서비스 워커 등록 코드 삽입 (마지막 스크립트 태그에)
        # </body> 바로 앞의 </script> 찾기
        last_script_pos = content.rfind('</script>')
        if last_script_pos != -1:
            # 해당 </script> 이전에 서비스 워커 코드 삽입
            content = content[:last_script_pos] + SERVICE_WORKER_SCRIPT + content[last_script_pos:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'  - PWA 헤더 및 서비스 워커 추가 완료')

print('\n모든 HTML 파일 처리 완료!')
