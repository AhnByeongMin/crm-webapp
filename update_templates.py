#!/usr/bin/env python3
"""
Template Update Script
Replaces inline styles with external minified CSS references
"""
import re
from pathlib import Path

def update_admin_html():
    """Update admin.html to use external CSS and fix banner.js"""
    path = Path('templates/admin.html')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add defer to banner.js if not already present
    if '<script src="/static/js/banner.js"></script>' in content:
        content = content.replace(
            '<script src="/static/js/banner.js"></script>',
            '<script src="/static/js/banner.js" defer></script>'
        )

    # Find and replace the <style> block
    # Look for the opening <style> tag after Socket.IO
    style_start = content.find('<style>', content.find('socket.io.min.js'))
    if style_start != -1:
        style_end = content.find('</style>', style_start) + 8

        # Replace inline style with external CSS links
        css_links = '''    <!-- Preconnect to CDN -->
    <link rel="preconnect" href="https://cdn.socket.io" crossorigin>

    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">
    <link rel="stylesheet" href="/static/css/{{ asset_version('admin.min.css') }}">'''

        content = content[:style_start] + css_links + '\n' + content[style_end:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Updated {path}")

def update_promotions_html():
    """Update promotions.html to use external CSS"""
    path = Path('templates/promotions.html')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find and replace the <style> block
    style_start = content.find('<style>')
    if style_start != -1:
        style_end = content.find('</style>', style_start) + 8

        css_links = '''    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">
    <link rel="stylesheet" href="/static/css/{{ asset_version('promotions.min.css') }}">'''

        content = content[:style_start] + css_links + '\n' + content[style_end:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Updated {path}")

def update_chat_room_html():
    """Update chat_room.html to use external CSS"""
    path = Path('templates/chat_room.html')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find and replace the <style> block
    style_start = content.find('<style>')
    if style_start != -1:
        style_end = content.find('</style>', style_start) + 8

        css_links = '''    <!-- Preconnect to CDN -->
    <link rel="preconnect" href="https://cdn.socket.io" crossorigin>

    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">
    <link rel="stylesheet" href="/static/css/{{ asset_version('chat.min.css') }}">'''

        content = content[:style_start] + css_links + '\n' + content[style_end:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Updated {path}")

def update_reminders_html():
    """Update reminders.html to use external CSS"""
    path = Path('templates/reminders.html')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find and replace the <style> block
    style_start = content.find('<style>')
    if style_start != -1:
        style_end = content.find('</style>', style_start) + 8

        css_links = '''    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">
    <link rel="stylesheet" href="/static/css/{{ asset_version('reminders.min.css') }}">'''

        content = content[:style_start] + css_links + '\n' + content[style_end:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Updated {path}")

def update_simple_templates():
    """Update templates that only need common.min.css"""
    templates = ['user.html', 'chat_list.html', 'login.html', 'mypage.html',
                 'users.html', 'chat_create.html', 'admin_chat.html']

    for template_name in templates:
        path = Path(f'templates/{template_name}')
        if not path.exists():
            continue

        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find and replace the <style> block
        style_start = content.find('<style>')
        if style_start != -1:
            style_end = content.find('</style>', style_start) + 8

            # Check if Socket.IO is used (for preconnect)
            has_socketio = 'socket.io.min.js' in content

            if has_socketio:
                css_links = '''    <!-- Preconnect to CDN -->
    <link rel="preconnect" href="https://cdn.socket.io" crossorigin>

    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">'''
            else:
                css_links = '''    <!-- External CSS -->
    <link rel="stylesheet" href="/static/css/{{ asset_version('common.min.css') }}">'''

            content = content[:style_start] + css_links + '\n' + content[style_end:]

            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"✓ Updated {path}")

def main():
    print("🔄 Updating HTML templates...")
    print()

    # Update major templates with specific CSS
    update_admin_html()
    update_promotions_html()
    update_chat_room_html()
    update_reminders_html()

    # Update simple templates
    update_simple_templates()

    print()
    print("✅ All templates updated!")

if __name__ == '__main__':
    main()
