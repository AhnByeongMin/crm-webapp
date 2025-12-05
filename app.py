# Eventlet monkey patching (최상단 필수!)
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_compress import Compress
from werkzeug.utils import secure_filename
import json
import os
import uuid
import threading
from datetime import datetime
import database  # SQLite 데이터베이스 헬퍼
import pandas as pd
import random
from cache_manager import app_cache, cached, invalidate_cache, generate_etag

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB 최대 파일 크기
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000  # 1년 캐시 (asset versioning으로 제어)
app.config['TEMPLATES_AUTO_RELOAD'] = True  # 템플릿 자동 리로드

# Compression 설정
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/javascript'
]
app.config['COMPRESS_LEVEL'] = 6
app.config['COMPRESS_MIN_SIZE'] = 500

Compress(app)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'}
EXCEL_EXTENSIONS = {'xls', 'xlsx'}

# Socket.IO 초기화 (eventlet + Redis)
socketio = SocketIO(
    app,
    async_mode='eventlet',
    message_queue='redis://127.0.0.1:6379/0',
    cors_allowed_origins="*",
    max_http_buffer_size=50 * 1024 * 1024,
    logger=False,
    engineio_logger=False
)

# 관리자 계정 (이름: 비밀번호)
ADMIN_ACCOUNTS = {
    '김은아': 'admin1234',
    '김지원': 'admin1234',
    '민건희': 'admin1234',
    '홍민지': 'admin1234',
    '안병민': 'admin1234'
}

# SQLite 데이터베이스 함수 사용
load_data = database.load_data
save_data = database.save_data
load_chats = database.load_chats
save_chats = database.save_chats
load_users = database.load_users
save_users = database.save_users
load_promotions = database.load_promotions
save_promotions = database.save_promotions
add_user = database.add_user
load_users_by_team = database.load_users_by_team
load_teams = database.load_teams
load_users_with_team = database.load_users_with_team

def is_localhost():
    # Nginx 프록시 뒤에서는 X-Real-IP 헤더 사용
    real_ip = request.headers.get('X-Real-IP', request.remote_addr)
    return real_ip in ['127.0.0.1', 'localhost', '::1']

def is_admin():
    """실제 관리자 권한 확인 (로컬호스트 또는 관리자 역할)"""
    if is_localhost():
        return True

    # 세션에 role이 있고 관리자인 경우
    if 'role' in session and session['role'] == '관리자':
        return True

    # 하위 호환성: ADMIN_ACCOUNTS에 있는 경우 (마이그레이션 중)
    if 'username' in session and session['username'] in ADMIN_ACCOUNTS:
        return True

    return False

def require_login():
    """로그인 필수 체크 - 로그인하지 않은 경우 로그인 페이지로 리다이렉트"""
    if is_localhost():
        return None  # localhost는 항상 허용

    if 'username' not in session:
        return redirect(url_for('login'))

    return None

def require_admin():
    """관리자 권한 필수 체크 - 권한 없으면 access_denied 페이지로"""
    if is_localhost():
        return None  # localhost는 항상 허용

    if 'username' not in session:
        return redirect(url_for('login'))

    if not is_admin():
        return render_template('access_denied.html',
                             message='이 페이지는 관리자만 접근할 수 있습니다.',
                             redirect_url=url_for('index'))

    return None

# Asset versioning for cache busting
_asset_manifest = None
def load_asset_manifest():
    """Load asset manifest with file hashes"""
    global _asset_manifest
    if _asset_manifest is None:
        manifest_path = os.path.join(app.root_path, 'static', 'asset_manifest.json')
        if os.path.exists(manifest_path):
            with open(manifest_path, 'r') as f:
                _asset_manifest = json.load(f)
        else:
            _asset_manifest = {}
    return _asset_manifest

@app.context_processor
def utility_processor():
    """템플릿에서 asset_version 함수 사용 가능하게"""
    def asset_version(filename):
        manifest = load_asset_manifest()
        # Extract base name without extension
        base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
        # Common.css → common_css 형식으로 변환
        key = base_name.replace('.', '_').replace('/', '_').replace('-', '_')

        if key in manifest:
            return f"{filename}?v={manifest[key]}"
        return filename

    return dict(asset_version=asset_version)

@app.after_request
def add_cache_headers(response):
    """캐시 헤더 최적화: 정적 파일은 캐싱, 동적 콘텐츠는 no-cache"""
    # 정적 파일 (CSS, JS, 이미지, 폰트 등)은 1시간 캐싱
    if request.path.startswith('/static/') or request.path.startswith('/uploads/'):
        response.headers['Cache-Control'] = 'public, max-age=3600'
    # 동적 콘텐츠는 캐시 비활성화
    else:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
    return response

@app.route('/')
def index():
    # localhost는 항상 admin으로
    if is_localhost():
        return redirect(url_for('admin'))

    # 세션 없으면 로그인 페이지로
    if 'username' not in session:
        return redirect(url_for('login'))

    # 관리자 계정은 관리자 페이지로
    if is_admin():
        return redirect(url_for('admin'))

    # 일반 사용자는 user 페이지로
    return render_template('user.html',
                         username=session['username'],
                         is_admin=False,
                         page_title='내 할일',
                         current_page='tasks')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if is_localhost():
        return redirect(url_for('admin'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if not username:
            return render_template('login.html', error='이름을 입력하세요.')

        if not password:
            return render_template('login.html', error='비밀번호를 입력하세요.', username=username)

        # 데이터베이스에서 사용자 검증
        user = database.verify_user_login(username, password)

        if user:
            # 로그인 성공
            session['username'] = user['username']
            session['role'] = user['role']
            return redirect(url_for('index'))
        else:
            # 로그인 실패 (잘못된 이름/비밀번호 또는 비활성 계정)
            return render_template('login.html', error='이름 또는 비밀번호가 올바르지 않거나 비활성 계정입니다.', username=username)

    return render_template('login.html')

@app.route('/admin')
def admin():
    # 관리자 권한 검증
    auth_check = require_admin()
    if auth_check:
        return auth_check

    username = session.get('username', 'Admin')
    return render_template('admin.html',
                         username=username,
                         is_admin=True,
                         page_title='할일 관리',
                         current_page='admin')

@app.route('/api/items', methods=['GET'])
def get_items():
    if is_admin():
        # 관리자는 전체 조회
        data = load_data()
        return jsonify(data)

    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # 일반 사용자는 자신에게 할당된 항목만 조회 (최적화)
    username = session['username']
    user_items = database.load_data_by_assigned(username)
    return jsonify(user_items)

@app.route('/api/items', methods=['POST'])
def create_item():
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = load_data()
    new_item = request.json
    new_item['id'] = database.get_next_id('tasks')
    new_item['created_at'] = datetime.now().isoformat()
    data.append(new_item)
    save_data(data)

    return jsonify(new_item), 201

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    """할일 수정 (제목, 내용) - 관리자 전용"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    updated_data = request.json
    title = updated_data.get('title')
    content = updated_data.get('content')

    if not title or not content:
        return jsonify({'error': 'Title and content required'}), 400

    success = database.update_task(item_id, title, content)

    if success:
        # 업데이트된 항목 반환
        data = database.load_data()
        for item in data:
            if item['id'] == item_id:
                return jsonify(item)
        return jsonify({'error': 'Not found'}), 404
    else:
        return jsonify({'error': 'Update failed'}), 500

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    # 최적화된 delete_task 함수 사용 (개별 삭제)
    success = database.delete_task(item_id)

    return jsonify({'success': success})

@app.route('/api/items/<int:item_id>/unassign', methods=['POST'])
def unassign_item(item_id):
    """할일 배정 해제 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    try:
        database.update_task_assignment(item_id, None)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/items/<int:item_id>/status', methods=['PUT'])
def update_item_status(item_id):
    """할일 상태 변경 (일반 사용자: 자신에게 배정된 항목만)"""
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    status = request.json.get('status')
    if status not in ['대기중', '진행중', '완료']:
        return jsonify({'error': 'Invalid status'}), 400

    # 일반 사용자는 자신에게 배정된 항목만 변경 가능
    if not is_admin():
        # 최적화: 단일 항목만 조회
        with database.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT assigned_to FROM tasks WHERE id = ?', (item_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({'error': 'Not found'}), 404
            if row['assigned_to'] != session['username']:
                return jsonify({'error': 'Forbidden'}), 403

    database.update_task_status(item_id, status)

    # Socket.IO로 할당자에게 배지 업데이트 전송
    with database.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT assigned_to FROM tasks WHERE id = ?', (item_id,))
        row = cursor.fetchone()
        if row and row['assigned_to']:
            assignee = row['assigned_to']
            counts = calculate_nav_counts(assignee)
            socketio.emit('nav_counts_update', counts, room=f'user_{assignee}')

    return jsonify({'success': True, 'status': status})

@app.route('/api/items/<int:item_id>/assign', methods=['PUT'])
def update_item_assignment(item_id):
    """할일 배정/회수 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    assigned_to = request.json.get('assigned_to')  # None이면 회수

    # 이전 할당자 확인 (배지 업데이트용)
    old_assignee = None
    with database.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT assigned_to FROM tasks WHERE id = ?', (item_id,))
        row = cursor.fetchone()
        if row:
            old_assignee = row['assigned_to']

    database.update_task_assignment(item_id, assigned_to)

    # Socket.IO로 배지 업데이트 전송 (이전 할당자 + 새 할당자)
    if old_assignee:
        counts = calculate_nav_counts(old_assignee)
        socketio.emit('nav_counts_update', counts, room=f'user_{old_assignee}')
    if assigned_to:
        counts = calculate_nav_counts(assigned_to)
        socketio.emit('nav_counts_update', counts, room=f'user_{assigned_to}')

    return jsonify({'success': True, 'assigned_to': assigned_to})

@app.route('/api/items/bulk-assign', methods=['POST'])
def bulk_assign_items():
    """할일 일괄 배정 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    task_ids = request.json.get('task_ids', [])
    assign_mode = request.json.get('mode')  # 'individual', 'random', 'sequential'
    users = request.json.get('users', [])  # 배정할 사용자 목록

    if not task_ids or not users:
        return jsonify({'error': 'Invalid parameters'}), 400

    try:
        if assign_mode == 'random':
            # 랜덤 배정:
            # 1. 먼저 항목 순서를 랜덤하게 섞음
            # 2. 나누어떨어지는 수만큼 균등 분배 (모두에게 최소 보장)
            # 3. 나머지는 랜덤하게 추가 분배
            shuffled_tasks = task_ids.copy()
            random.shuffle(shuffled_tasks)

            items_per_person = len(shuffled_tasks) // len(users)
            base_count = items_per_person * len(users)
            remainder = len(shuffled_tasks) - base_count

            print(f"[랜덤배정] 전체: {len(shuffled_tasks)}개, 인원: {len(users)}명")
            print(f"[랜덤배정] 1인당: {items_per_person}개, 균등배정: {base_count}개, 나머지: {remainder}개")

            # 1단계: 균등 분배 (모두에게 동일하게)
            for i, task_id in enumerate(shuffled_tasks[:base_count]):
                user = users[i % len(users)]
                database.update_task_assignment(task_id, user)

            print(f"[랜덤배정] 1단계 완료: {base_count}개 균등 배정")

            # 2단계: 나머지를 랜덤하게 선정된 사람들에게 1개씩 분배
            remainder_tasks = shuffled_tasks[base_count:]
            print(f"[랜덤배정] 2단계 시작: {len(remainder_tasks)}개 나머지 랜덤 배정")

            if remainder_tasks:
                # 나머지 개수만큼 사람을 랜덤하게 선정 (중복 없이)
                selected_users = random.sample(users, len(remainder_tasks))
                for task_id, user in zip(remainder_tasks, selected_users):
                    database.update_task_assignment(task_id, user)
                    print(f"[랜덤배정] 나머지 task_id={task_id} -> {user}")

            print(f"[랜덤배정] 완료: 총 {len(shuffled_tasks)}개 배정")

        elif assign_mode == 'sequential':
            # 순차 배정: 딱 나누어떨어지는 수만큼만 순차 분배, 나머지는 미배정
            items_per_person = len(task_ids) // len(users)
            assignable_count = items_per_person * len(users)

            for i, task_id in enumerate(task_ids[:assignable_count]):
                user = users[i % len(users)]
                database.update_task_assignment(task_id, user)

        elif assign_mode == 'individual':
            # 개별 배정: task_ids와 users가 1:1 매칭
            for task_id, user in zip(task_ids, users):
                database.update_task_assignment(task_id, user)

        return jsonify({'success': True, 'count': len(task_ids)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/items/bulk-upload', methods=['POST'])
def bulk_upload_items():
    """엑셀 파일로 할일 일괄 등록 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    if 'file' not in request.files:
        return jsonify({'error': '파일이 없습니다'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400

    # 엑셀 파일 확인
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in EXCEL_EXTENSIONS):
        return jsonify({'error': '엑셀 파일만 업로드 가능합니다 (.xlsx, .xls)'}), 400

    try:
        # 엑셀 파일 읽기
        df = pd.read_excel(file)

        # 필수 컬럼 확인
        required_columns = ['제목', '내용']
        if not all(col in df.columns for col in required_columns):
            return jsonify({'error': f'필수 컬럼이 없습니다: {", ".join(required_columns)}'}), 400

        # 데이터 검증 및 등록
        added_count = 0
        skipped_count = 0

        for _, row in df.iterrows():
            title = str(row['제목']).strip() if pd.notna(row['제목']) else ''
            content = str(row['내용']).strip() if pd.notna(row['내용']) else ''

            # 제목이 비어있으면 스킵
            if not title:
                skipped_count += 1
                continue

            # 대상 처리 로직
            assigned_to = None
            if '대상' in df.columns and pd.notna(row['대상']):
                target_user = str(row['대상']).strip()
                if target_user:  # 빈 문자열이 아닌 경우만 검증
                    # DB에 사용자가 존재하는지 확인
                    if database.user_exists(target_user):
                        assigned_to = target_user
                    # 존재하지 않는 사용자명은 자동으로 미배정(None)으로 처리

            # 개별 삽입 (ID 자동 증가)
            database.add_task(assigned_to, title, content, '대기중')
            added_count += 1

        return jsonify({'success': True, 'count': added_count, 'skipped': skipped_count})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'파일 처리 오류: {str(e)}'}), 500

@app.route('/api/users/non-admin', methods=['GET'])
def get_non_admin_users():
    """관리자가 아닌 일반 사용자 목록 조회 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    all_users = database.load_users()
    # 관리자 계정 제외
    non_admin_users = [user for user in all_users if user not in ADMIN_ACCOUNTS]
    return jsonify(non_admin_users)

@app.route('/api/teams', methods=['GET'])
def get_teams():
    """팀 목록 조회 (관리자 전용) - 배정 가능한 팀만 반환"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    teams = load_teams()
    # '관리자' 팀은 배정 대상이 아니므로 제외
    teams = [team for team in teams if team != '관리자']
    return jsonify(teams)

@app.route('/api/users/by-team', methods=['GET'])
def get_users_by_team():
    """팀별 사용자 목록 조회 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    team = request.args.get('team')

    if team == '전체':
        # 전체 팀원 (관리자 팀 제외, 팀 없는 사용자 제외)
        users = load_users_by_team()
        # 관리자 계정은 배정 대상에서 제외
        users = [user for user in users if user not in ADMIN_ACCOUNTS]
    elif team == '관리자':
        # 관리자 팀은 배정 대상이 아니므로 빈 리스트 반환
        users = []
    elif team:
        # 특정 팀 사용자
        users = load_users_by_team(team)
        # 혹시 모를 경우를 대비해 관리자 제외
        users = [user for user in users if user not in ADMIN_ACCOUNTS]
    else:
        # 팀 파라미터 없으면 전체 사용자 (관리자 제외)
        users = database.load_all_users_detail()
        users = [user for user in users if user not in ADMIN_ACCOUNTS]

    return jsonify(users)

@app.route('/api/users/with-team', methods=['GET'])
def get_users_with_team():
    """팀 정보를 포함한 사용자 목록 조회 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    users = load_users_with_team()
    # 관리자 계정 제외
    users = [user for user in users if user['username'] not in ADMIN_ACCOUNTS]
    return jsonify(users)

@app.route('/download/template/tasks')
def download_tasks_template():
    """할일 등록용 엑셀 템플릿 다운로드"""
    if not is_admin():
        return "Access Denied", 403

    # 템플릿 데이터 생성
    template_data = {
        '제목': ['예시: 고객 문의 응대', '예시: 보고서 작성'],
        '내용': ['고객 A의 문의사항 확인 및 답변', '월간 실적 보고서 작성 및 제출'],
        '대상자': ['홍길동', '']  # 비워두면 미배정
    }

    df = pd.DataFrame(template_data)

    # 임시 파일로 저장
    template_path = os.path.join(app.config['UPLOAD_FOLDER'], 'tasks_template.xlsx')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    df.to_excel(template_path, index=False, engine='openpyxl')

    return send_from_directory(app.config['UPLOAD_FOLDER'], 'tasks_template.xlsx',
                             as_attachment=True, download_name='할일목록_업로드양식.xlsx')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/favicon.ico')
def favicon():
    # 빈 응답 반환 (404 오류 방지)
    return '', 204

# 파일 업로드/다운로드
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '파일이 없습니다'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400

    if file and allowed_file(file.filename):
        # 고유한 파일명 생성
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

        # uploads 폴더가 없으면 생성
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

        file.save(filepath)

        # 파일 정보 반환
        file_info = {
            'filename': filename,
            'unique_filename': unique_filename,
            'size': os.path.getsize(filepath),
            'url': f'/uploads/{unique_filename}'
        }

        return jsonify(file_info), 200

    return jsonify({'error': '허용되지 않는 파일 형식입니다'}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# 채팅 관련 라우트
@app.route('/chats')
def chat_list():
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    username = session.get('username', 'Admin')
    admin = is_admin()
    localhost = is_localhost()
    return render_template('chat_list.html',
                         username=username,
                         is_admin=admin,
                         is_localhost=localhost,
                         page_title='채팅 목록',
                         current_page='chats')

@app.route('/chats/all')
def chat_list_admin():
    """관리자 전용 채팅 관리 페이지 - /chats로 리다이렉트"""
    return redirect(url_for('chat_list'))

@app.route('/chat/create')
def chat_create_page():
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    return render_template('chat_create.html')

@app.route('/chat/<chat_id>')
def chat_room(chat_id):
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    chats = load_chats()
    if chat_id not in chats:
        return "Chat not found", 404

    username = session.get('username', 'Admin')
    chat_info = chats[chat_id]

    # 로컬호스트(진짜 서버 관리자)만 모든 채팅방 입장 가능
    # 관리자 계정 포함 일반 사용자는 자신이 참여자인 채팅방만 입장 가능
    if not is_localhost() and username not in chat_info['participants']:
        return render_template('access_denied.html',
                             message='이 채팅방의 참여자만 입장할 수 있습니다.',
                             redirect_url=url_for('chats'))

    return render_template('chat_room.html',
                         chat_id=chat_id,
                         username=username,
                         chat_title=chat_info['title'],
                         page_title=chat_info['title'],
                         current_page='chat_room',
                         is_admin=is_admin())

@app.route('/api/chats', methods=['GET'])
def get_chats():
    """채팅 목록 조회 API (최적화: 최신 메시지 1개만 반환)"""
    chats = load_chats()

    # limit 파라미터: 각 채팅방당 반환할 메시지 개수 (기본값: 1)
    message_limit = request.args.get('limit', 1, type=int)

    # 로컬호스트(진짜 서버 관리자)만 모든 채팅방 조회 가능
    if is_localhost():
        # 로컬호스트도 메시지 제한 적용
        optimized_chats = {}
        for chat_id, chat_info in chats.items():
            chat_data = chat_info.copy()
            if message_limit > 0 and 'messages' in chat_data:
                chat_data['messages'] = chat_data['messages'][-message_limit:]  # 최신 N개만
            optimized_chats[chat_id] = chat_data
        return jsonify(optimized_chats)

    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # 관리자 계정 포함 모든 사용자는 자신이 참여한 채팅방만 조회
    username = session['username']
    user_chats = {}

    for chat_id, chat_info in chats.items():
        if username in chat_info['participants']:
            # 안 읽은 메시지 개수 계산
            unread_count = 0
            for msg in chat_info.get('messages', []):
                read_by = msg.get('read_by', [])
                # 내가 보낸 메시지가 아니고, 내가 읽지 않은 메시지
                if msg.get('username') != username and username not in read_by:
                    unread_count += 1

            # 디버깅 로그
            if unread_count > 0:
                print(f"[DEBUG] 채팅방 {chat_id} ({chat_info.get('title')}): 사용자 {username}의 안 읽은 메시지 = {unread_count}")

            # 채팅방 정보에 unread_count 추가 + 메시지 제한
            chat_data = chat_info.copy()
            chat_data['unread_count'] = unread_count

            # 최적화: 채팅 목록용으로는 최신 N개 메시지만 반환
            if message_limit > 0 and 'messages' in chat_data:
                chat_data['messages'] = chat_data['messages'][-message_limit:]

            user_chats[chat_id] = chat_data

    return jsonify(user_chats)

@app.route('/api/chats/all', methods=['GET'])
def get_all_chats():
    """관리자가 모든 채팅방 목록을 보기 위한 API (삭제 관리용)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    chats = load_chats()
    return jsonify(chats)

@app.route('/api/chats', methods=['POST'])
def create_chat():
    # 로그인한 모든 사용자가 채팅방 생성 가능
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    chats = load_chats()
    new_chat = request.json

    # 다음 채팅방 ID 가져오기
    chat_id = str(database.get_next_id('chats'))

    creator = session.get('username', 'Admin')

    # 참여자 목록에 생성자 포함
    participants = new_chat.get('participants', [])
    if creator not in participants:
        participants.append(creator)

    # 1:1 채팅인지 확인 (참여자가 2명인 경우)
    is_one_to_one = len(participants) == 2

    # 1:1 채팅인 경우 상대방 이름을 제목으로 사용
    if is_one_to_one:
        other_user = [p for p in participants if p != creator][0]
        title = other_user
    else:
        # 다중 채팅인 경우 제목 필요
        title = new_chat.get('title', 'New Chat')

    chats[chat_id] = {
        'title': title,
        'participants': participants,
        'creator': creator,
        'messages': [],
        'is_one_to_one': is_one_to_one,
        'created_at': datetime.now().isoformat()
    }

    save_chats(chats)
    return jsonify({'chat_id': chat_id, 'chat': chats[chat_id]}), 201

@app.route('/api/chats/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    chats = load_chats()
    if chat_id in chats:
        del chats[chat_id]
        save_chats(chats)

    return jsonify({'success': True})

@app.route('/api/chats/<chat_id>/messages', methods=['GET'])
def get_chat_messages(chat_id):
    """
    채팅방 메시지 페이지네이션 API

    Query Parameters:
        - limit: 반환할 메시지 개수 (기본값: 50)
        - offset: 건너뛸 메시지 개수 (기본값: 0)
        - before_id: 특정 메시지 ID 이전의 메시지만 가져오기 (무한 스크롤용)

    Returns:
        {
            'messages': [...],
            'total': 전체 메시지 개수,
            'has_more': 더 가져올 메시지가 있는지 여부
        }
    """
    # 로그인 확인
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    chats = load_chats()

    if chat_id not in chats:
        return jsonify({'error': 'Chat not found'}), 404

    chat_info = chats[chat_id]

    # 권한 확인: 참여자만 메시지 조회 가능
    if not is_localhost():
        username = session['username']
        if username not in chat_info['participants']:
            return jsonify({'error': 'Forbidden'}), 403

    # 파라미터 파싱
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    before_id = request.args.get('before_id', type=int)  # 무한 스크롤용

    messages = chat_info.get('messages', [])
    total = len(messages)

    # before_id가 있으면 해당 메시지 이전의 메시지만 가져오기
    if before_id is not None:
        # 메시지에 ID가 없으면 인덱스를 ID로 사용
        before_index = None
        for idx, msg in enumerate(messages):
            msg_id = msg.get('id', idx)
            if msg_id == before_id:
                before_index = idx
                break

        if before_index is not None:
            # before_id 이전 메시지들만 선택
            messages = messages[:before_index]
            total = len(messages)

    # 오프셋과 리밋 적용 (최신 메시지부터 가져오려면 역순으로)
    start_idx = max(0, total - offset - limit)
    end_idx = total - offset

    paginated_messages = messages[start_idx:end_idx]
    has_more = start_idx > 0

    return jsonify({
        'messages': paginated_messages,
        'total': total,
        'has_more': has_more,
        'offset': offset,
        'limit': limit
    })

@app.route('/api/search_users', methods=['GET'])
def search_users():
    # 로그인한 사용자는 누구나 검색 가능
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    query = request.args.get('q', '').lower()

    # 로그인한 사용자 목록 + 할당된 사용자 목록
    users = set(load_users())  # 로그인한 사용자들

    # 항목에 할당된 사용자도 추가
    data = load_data()
    for item in data:
        if 'assigned_to' in item:
            users.add(item['assigned_to'])

    # 관리자 계정도 추가
    users.update(ADMIN_ACCOUNTS.keys())

    if query:
        users = [u for u in users if query in u.lower()]
    else:
        users = list(users)

    return jsonify(sorted(users))

# WebSocket 이벤트 핸들러
@socketio.on('join')
def on_join(data):
    chat_id = data['chat_id']
    username = data['username']
    join_room(chat_id)
    emit('user_joined', {'username': username}, room=chat_id)

@socketio.on('join_user_room')
def on_join_user_room(data):
    """사용자별 개인 room에 join (전역 알림용)"""
    username = data['username']
    join_room(f'user_{username}')

@socketio.on('leave')
def on_leave(data):
    chat_id = data['chat_id']
    username = data['username']
    leave_room(chat_id)
    emit('user_left', {'username': username}, room=chat_id)

@socketio.on('send_message')
def handle_message(data):
    chat_id = data['chat_id']
    username = data['username']
    message = data['message']
    file_info = data.get('file_info')  # 파일 정보 (추후 구현)

    # 메시지 저장
    chats = load_chats()
    if chat_id in chats:
        msg_obj = {
            'username': username,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'read_by': [username],  # 보낸 사람은 자동으로 읽음 처리
            'file_info': file_info  # 파일 정보 (이미지, 문서 등)
        }

        # file_info를 file_path/file_name으로 변환 (DB 저장용)
        if file_info and len(file_info) > 0:
            first_file = file_info[0]
            msg_obj['file_path'] = first_file.get('url')
            msg_obj['file_name'] = first_file.get('filename')

        chats[chat_id]['messages'].append(msg_obj)
        save_chats(chats)

        # 방의 모든 사용자에게 브로드캐스트
        emit('new_message', msg_obj, room=chat_id)

        # 채팅 참여자들에게 알림 브로드캐스트 (채팅방 밖에 있는 사람들을 위해)
        chat_info = chats[chat_id]
        for participant in chat_info['participants']:
            if participant != username:  # 보낸 사람 제외
                # 최적화: participants 배열 제거, 필요한 데이터만 전송
                emit('global_new_message', {
                    'chat_id': chat_id,
                    'chat_title': chat_info['title'],
                    'sender': username,
                    'message': message[:100],  # 메시지 미리보기만 전송 (100자)
                    'is_one_to_one': chat_info.get('is_one_to_one', False)
                }, room=f'user_{participant}')

                # 네비게이션 배지 실시간 업데이트 (읽지 않은 채팅 +1)
                with app.app_context():
                    participant_counts = calculate_nav_counts(participant)
                    emit('nav_counts_update', participant_counts, room=f'user_{participant}')

@socketio.on('typing_start')
def handle_typing_start(data):
    chat_id = data['chat_id']
    username = data['username']
    # 같은 방의 다른 사용자들에게 타이핑 시작 알림
    emit('user_typing_start', {'username': username}, room=chat_id, include_self=False)

@socketio.on('typing_stop')
def handle_typing_stop(data):
    chat_id = data['chat_id']
    username = data['username']
    # 같은 방의 다른 사용자들에게 타이핑 중지 알림
    emit('user_typing_stop', {'username': username}, room=chat_id, include_self=False)

@socketio.on('mark_as_read')
def handle_mark_as_read(data):
    """메시지를 읽음으로 표시"""
    chat_id = data['chat_id']
    username = data['username']
    message_index = data.get('message_index')  # 특정 메시지 인덱스 (옵션)

    chats = load_chats()
    if chat_id in chats:
        messages = chats[chat_id]['messages']

        if message_index is not None:
            # 특정 메시지만 읽음 처리
            if message_index < len(messages):
                if 'read_by' not in messages[message_index]:
                    messages[message_index]['read_by'] = []
                if username not in messages[message_index]['read_by']:
                    messages[message_index]['read_by'].append(username)
        else:
            # 모든 메시지를 읽음 처리
            for msg in messages:
                if 'read_by' not in msg:
                    msg['read_by'] = []
                if username not in msg['read_by']:
                    msg['read_by'].append(username)

        save_chats(chats)

        # 같은 방의 다른 사용자들에게 읽음 상태 브로드캐스트
        if message_index is not None and message_index >= 0:
            # 특정 메시지 읽음 처리
            emit('read_receipt_update', {
                'chat_id': chat_id,
                'username': username,
                'message_index': message_index,
                'read_by': messages[message_index]['read_by']
            }, room=chat_id, include_self=False)
        else:
            # 모든 메시지 읽음 처리 - 전체 메시지 배열의 read_by 정보 전송
            emit('read_receipt_update', {
                'chat_id': chat_id,
                'username': username,
                'message_index': -1,
                'all_messages_read': True
            }, room=chat_id, include_self=False)

        # 네비게이션 배지 실시간 업데이트 (메시지 읽음 처리 후)
        with app.app_context():
            user_counts = calculate_nav_counts(username)
            emit('nav_counts_update', user_counts, room=f'user_{username}')

# ============== 프로모션 게시판 ==============

# 프로모션 편집 잠금 상태 (promotion_id: username)
promotion_locks = {}

@socketio.on('lock_promotion_edit')
def handle_lock_promotion_edit(data):
    """프로모션 수정 잠금"""
    promo_id = str(data['promo_id'])
    username = data['username']

    # 이미 다른 사용자가 편집 중인지 확인
    if promo_id in promotion_locks and promotion_locks[promo_id] != username:
        emit('promotion_locked', {
            'promo_id': promo_id,
            'locked_by': promotion_locks[promo_id]
        })
        return

    # 잠금 설정
    promotion_locks[promo_id] = username

    # 모든 사용자에게 잠금 상태 브로드캐스트
    emit('promotion_edit_status', {
        'promo_id': promo_id,
        'locked_by': username,
        'is_locked': True
    }, broadcast=True)

@socketio.on('unlock_promotion_edit')
def handle_unlock_promotion_edit(data):
    """프로모션 수정 잠금 해제"""
    promo_id = str(data['promo_id'])
    username = data['username']

    # 본인이 잠근 경우만 해제 가능
    if promo_id in promotion_locks and promotion_locks[promo_id] == username:
        del promotion_locks[promo_id]

        # 모든 사용자에게 잠금 해제 브로드캐스트
        emit('promotion_edit_status', {
            'promo_id': promo_id,
            'locked_by': None,
            'is_locked': False
        }, broadcast=True)

@app.route('/promotions')
def promotions_page():
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    return render_template('promotions.html',
                         username=session['username'],
                         is_admin=is_admin(),
                         page_title='프로모션 게시판',
                         current_page='promotions')

@app.route('/api/promotions', methods=['GET'])
def get_promotions():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    promotions = load_promotions()

    # 필터링 (쿼리 파라미터)
    category = request.args.get('category')
    product_name = request.args.get('product_name')
    channel = request.args.get('channel')
    promotion_name = request.args.get('promotion_name')
    search = request.args.get('search')

    filtered = promotions

    if category:
        filtered = [p for p in filtered if p.get('category') == category]
    if product_name:
        filtered = [p for p in filtered if p.get('product_name') == product_name]
    if channel:
        filtered = [p for p in filtered if p.get('channel') == channel]
    if promotion_name:
        filtered = [p for p in filtered if p.get('promotion_name') == promotion_name]
    if search:
        # 검색어로 모든 필드 검색
        search_lower = search.lower()
        filtered = [p for p in filtered if
                   search_lower in str(p.get('product_name', '')).lower() or
                   search_lower in str(p.get('channel', '')).lower() or
                   search_lower in str(p.get('promotion_name', '')).lower() or
                   search_lower in str(p.get('promotion_code', '')).lower() or
                   search_lower in str(p.get('content', '')).lower()]

    return jsonify(filtered)

@app.route('/api/promotions', methods=['POST'])
def create_promotion():
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json

    # 필수 값 검증
    required_fields = ['category', 'product_name', 'channel', 'promotion_name', 'content', 'start_date']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field}는 필수 항목입니다'}), 400

    promotions = load_promotions()

    new_promotion = {
        'id': database.get_next_id('promotions'),
        'category': data['category'],
        'product_name': data['product_name'],
        'channel': data['channel'],
        'promotion_name': data['promotion_name'],
        'discount_amount': data.get('discount_amount', ''),
        'session_exemption': data.get('session_exemption', ''),
        'subscription_types': data.get('subscription_types', []),
        'promotion_code': data.get('promotion_code', ''),
        'content': data['content'],
        'start_date': data['start_date'],
        'end_date': data.get('end_date', '무기한'),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'created_by': session['username']
    }

    promotions.append(new_promotion)
    save_promotions(promotions)

    return jsonify(new_promotion), 201

@app.route('/api/promotions/<int:promo_id>', methods=['GET'])
def get_promotion(promo_id):
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    promotions = load_promotions()
    promo = next((p for p in promotions if p.get('id') == promo_id), None)

    if not promo:
        return jsonify({'error': 'Not found'}), 404

    return jsonify(promo)

@app.route('/api/promotions/<int:promo_id>', methods=['PUT'])
def update_promotion(promo_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    promotions = load_promotions()

    for i, p in enumerate(promotions):
        if p.get('id') == promo_id:
            # 필수 값 검증
            required_fields = ['category', 'product_name', 'channel', 'promotion_name', 'content', 'start_date']
            for field in required_fields:
                if field in data and not data[field]:
                    return jsonify({'error': f'{field}는 필수 항목입니다'}), 400

            # 업데이트
            promotions[i].update({
                'category': data.get('category', p.get('category', '안마의자')),
                'product_name': data.get('product_name', p['product_name']),
                'channel': data.get('channel', p['channel']),
                'promotion_name': data.get('promotion_name', p['promotion_name']),
                'discount_amount': data.get('discount_amount', p.get('discount_amount', '')),
                'session_exemption': data.get('session_exemption', p.get('session_exemption', '')),
                'subscription_types': data.get('subscription_types', p.get('subscription_types', [])),
                'promotion_code': data.get('promotion_code', p.get('promotion_code', '')),
                'content': data.get('content', p['content']),
                'start_date': data.get('start_date', p['start_date']),
                'end_date': data.get('end_date', p.get('end_date', '무기한')),
                'updated_at': datetime.now().isoformat()
            })

            save_promotions(promotions)
            return jsonify(promotions[i])

    return jsonify({'error': 'Not found'}), 404

@app.route('/api/promotions/<int:promo_id>', methods=['DELETE'])
def delete_promotion(promo_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    promotions = load_promotions()
    promotions = [p for p in promotions if p.get('id') != promo_id]
    save_promotions(promotions)

    return jsonify({'success': True})

@app.route('/api/promotions/filters', methods=['GET'])
def get_promotion_filters():
    """필터링을 위한 고유 값 목록 반환"""
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    promotions = load_promotions()

    categories = list(set(p.get('category') for p in promotions if p.get('category')))
    products = list(set(p.get('product_name') for p in promotions if p.get('product_name')))
    channels = list(set(p.get('channel') for p in promotions if p.get('channel')))
    promo_names = list(set(p.get('promotion_name') for p in promotions if p.get('promotion_name')))

    # 대분류별 상품 매핑 생성
    category_products = {}
    for promo in promotions:
        cat = promo.get('category')
        prod = promo.get('product_name')
        if cat and prod:
            if cat not in category_products:
                category_products[cat] = set()
            category_products[cat].add(prod)

    # set을 list로 변환하고 정렬
    for cat in category_products:
        category_products[cat] = sorted(list(category_products[cat]))

    return jsonify({
        'categories': sorted(categories),
        'products': sorted(products),
        'channels': sorted(channels),
        'promotion_names': sorted(promo_names),
        'category_products': category_products  # 대분류별 상품 매핑 추가
    })

@app.route('/api/promotions/template', methods=['GET'])
def download_promotion_template():
    """프로모션 일괄등록 엑셀 양식 다운로드"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO

    wb = Workbook()
    ws = wb.active
    ws.title = "프로모션 일괄등록"

    # 스타일 정의
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    required_fill = PatternFill(start_color="FFE699", end_color="FFE699", fill_type="solid")  # 연한 노란색
    optional_fill = PatternFill(start_color="E7E6E6", end_color="E7E6E6", fill_type="solid")  # 연한 회색
    example_fill = PatternFill(start_color="F0F8FF", end_color="F0F8FF", fill_type="solid")  # 연한 파랑
    guide_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")  # 연한 노랑

    header_font = Font(bold=True, color="FFFFFF", size=11)
    bold_font = Font(bold=True, size=10)
    normal_font = Font(size=10)
    small_font = Font(size=9, color="666666")

    center_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    # 제목 (1행)
    ws.merge_cells('A1:K1')
    title_cell = ws['A1']
    title_cell.value = "📊 프로모션 일괄등록 양식"
    title_cell.font = Font(bold=True, size=14, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="305496", end_color="305496", fill_type="solid")
    title_cell.alignment = center_alignment
    ws.row_dimensions[1].height = 25

    # 필수/옵션 안내 (2행)
    ws.merge_cells('A2:K2')
    info_cell = ws['A2']
    info_cell.value = "💡 필수 항목(노란색 배경)은 반드시 입력해야 하며, 옵션 항목(회색 배경)은 선택사항입니다"
    info_cell.font = Font(size=10, color="C00000")
    info_cell.fill = guide_fill
    info_cell.alignment = left_alignment
    ws.row_dimensions[2].height = 30

    # 헤더 (3행) - 필수/옵션 표시
    headers_with_required = [
        ("대분류", True),       # 필수
        ("상품명", True),       # 필수
        ("채널", True),         # 필수
        ("프로모션명", True),   # 필수
        ("금액할인", False),    # 옵션
        ("회차면제", False),    # 옵션
        ("중복여부", False),    # 옵션
        ("프로모션코드", False),# 옵션
        ("프로모션내용", True), # 필수
        ("시작일", True),       # 필수
        ("종료일", False)       # 옵션
    ]

    for col_num, (header, is_required) in enumerate(headers_with_required, 1):
        cell = ws.cell(row=3, column=col_num)
        cell.value = f"{header} *" if is_required else header
        cell.fill = required_fill if is_required else optional_fill
        cell.font = header_font if is_required else Font(bold=True, color="000000", size=11)
        cell.alignment = center_alignment
        cell.border = thin_border

    ws.row_dimensions[3].height = 35

    # 설명 (4행)
    descriptions = [
        "상품 분류",
        "등록된 상품명\n입력 필수",
        "판매 채널\n입력 필수",
        "프로모션 이름\n입력 필수",
        "할인 금액\n예: 10,000원",
        "면제 회차\n예: 1회차",
        "기존/결합/지인\n콤마로 구분",
        "프로모션 코드\n영문+숫자",
        "상세 설명\n입력 필수",
        "YYYY-MM-DD\n입력 필수",
        "YYYY-MM-DD\n비우면 무기한"
    ]

    for col_num, desc in enumerate(descriptions, 1):
        cell = ws.cell(row=4, column=col_num)
        cell.value = desc
        cell.font = small_font
        cell.alignment = center_alignment
        cell.border = thin_border

    ws.row_dimensions[4].height = 40

    # 예시 데이터 1 (5행)
    example_data_1 = [
        "안마의자",
        "안마의자 프리미엄",
        "온라인",
        "신규고객 특별할인",
        "10,000원",
        "1회차 면제",
        "기존,결합",
        "NEW2024",
        "신규 가입 고객 대상 10,000원 할인 프로모션",
        "2024-01-01",
        "2024-12-31"
    ]

    for col_num, value in enumerate(example_data_1, 1):
        cell = ws.cell(row=5, column=col_num)
        cell.value = value
        cell.font = normal_font
        cell.fill = example_fill
        cell.alignment = left_alignment
        cell.border = thin_border

    ws.row_dimensions[5].height = 30

    # 예시 데이터 2 (6행)
    example_data_2 = [
        "공기청정기",
        "공기청정기 스탠다드",
        "오프라인",
        "회차면제 프로모션",
        "",
        "2회차 면제",
        "결합",
        "FREE2024",
        "첫 2회차 렌탈료 면제 프로모션",
        "2024-06-01",
        ""
    ]

    for col_num, value in enumerate(example_data_2, 1):
        cell = ws.cell(row=6, column=col_num)
        cell.value = value
        cell.font = normal_font
        cell.fill = example_fill
        cell.alignment = left_alignment
        cell.border = thin_border

    ws.row_dimensions[6].height = 30

    # 안내 메시지 (8-15행)
    ws.merge_cells('A8:K8')
    guide_title = ws['A8']
    guide_title.value = "📋 작성 가이드"
    guide_title.font = Font(bold=True, size=11, color="C00000")
    guide_title.fill = guide_fill
    guide_title.alignment = left_alignment

    # 9-16행: 가이드 (17행은 헤더이므로 여기서 멈춤)
    guides = [
        "",
        "💡 위 5-6행은 예시용입니다. 삭제하지 않아도 자동으로 무시됩니다.",
        "",
        "✅ 필수 항목 (노란색): 대분류, 상품명, 채널, 프로모션명, 프로모션내용, 시작일",
        "📌 옵션 항목 (회색): 금액할인, 회차면제, 중복여부, 프로모션코드, 종료일",
        "",
        "🔹 아래 17행은 헤더, 실제 데이터는 18행부터 입력하세요 🔹",
        ""
    ]

    for idx, guide in enumerate(guides, 9):
        ws.merge_cells(f'A{idx}:K{idx}')
        cell = ws[f'A{idx}']
        cell.value = guide
        cell.font = Font(size=9)
        cell.alignment = left_alignment
        if "⚠️" in guide or "🔹" in guide:
            cell.font = Font(bold=True, size=10, color="C00000")

    # 컬럼 너비 조정
    column_widths = [12, 20, 12, 20, 12, 12, 15, 15, 40, 12, 12]
    for col_num, width in enumerate(column_widths, 1):
        ws.column_dimensions[chr(64 + col_num)].width = width

    # 데이터 입력 시작 행 (17행)에 헤더 재표시
    for col_num, (header, is_required) in enumerate(headers_with_required, 1):
        cell = ws.cell(row=17, column=col_num)
        cell.value = f"{header} *" if is_required else header
        cell.fill = required_fill if is_required else optional_fill
        cell.font = Font(bold=True, color="000000", size=10)
        cell.alignment = center_alignment
        cell.border = thin_border

    ws.row_dimensions[17].height = 25

    # 18행부터 여유 공간 (사용자 입력용)
    for row in range(18, 21):
        for col in range(1, 12):
            cell = ws.cell(row=row, column=col)
            cell.border = thin_border

    # BytesIO로 저장
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='프로모션_일괄등록_양식.xlsx'
    )

@app.route('/api/promotions/bulk-upload', methods=['POST'])
def bulk_upload_promotions():
    """엑셀 파일을 파싱하여 JSON 형태로 반환 (저장하지 않음)"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    if 'file' not in request.files:
        return jsonify({'error': '파일이 없습니다'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다'}), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': '엑셀 파일만 업로드 가능합니다'}), 400

    try:
        from openpyxl import load_workbook
        from io import BytesIO

        # 파일을 메모리에 로드
        file_content = BytesIO(file.read())
        wb = load_workbook(file_content, data_only=True)
        ws = wb.active

        # 헤더 확인 (17번째 행 - 데이터 입력 시작 행)
        expected_headers = [
            "대분류", "상품명", "채널", "프로모션명",
            "금액할인", "회차면제", "중복여부", "프로모션코드",
            "프로모션내용", "시작일", "종료일"
        ]

        # 헤더 검증 (17번째 행에서 헤더 확인, * 제거 후 비교)
        actual_headers = [str(cell.value).replace(' *', '').strip() if cell.value else '' for cell in ws[17]]
        if actual_headers[:len(expected_headers)] != expected_headers:
            return jsonify({'error': '엑셀 양식이 올바르지 않습니다. 제공된 양식을 사용해주세요.'}), 400

        # 데이터 파싱 (18번째 행부터, 예시 데이터와 가이드 제외하고 실제 데이터만)
        promotions_data = []
        errors = []

        for row_num, row in enumerate(ws.iter_rows(min_row=18, values_only=True), start=18):
            # 빈 행 스킵
            if not any(row):
                continue

            # 주의사항 행 스킵
            if row[0] and str(row[0]).startswith('※'):
                continue

            # 필수 필드 검증
            category, product_name, channel, promotion_name, \
            discount_amount, session_exemption, subscription_types_str, promotion_code, \
            content, start_date, end_date = row[:11]

            # 필수 필드 체크
            if not all([category, product_name, channel, promotion_name, content, start_date]):
                errors.append(f"행 {row_num}: 필수 항목이 누락되었습니다 (대분류, 상품명, 채널, 프로모션명, 내용, 시작일은 필수)")
                continue

            # 중복여부 파싱
            subscription_types = []
            if subscription_types_str:
                types_list = [t.strip() for t in str(subscription_types_str).split(',')]
                for t in types_list:
                    if t in ['기존', '결합', '지인']:
                        subscription_types.append(t)

            # 날짜 형식 변환
            def format_date(date_val):
                if date_val is None:
                    return None
                if isinstance(date_val, str):
                    return date_val
                # datetime 객체인 경우
                try:
                    return date_val.strftime('%Y-%m-%d')
                except:
                    return str(date_val)

            start_date_str = format_date(start_date)
            end_date_str = format_date(end_date) if end_date else '무기한'

            promotion_data = {
                'category': str(category) if category else '',
                'product_name': str(product_name),
                'channel': str(channel),
                'promotion_name': str(promotion_name),
                'discount_amount': str(discount_amount) if discount_amount else '',
                'session_exemption': str(session_exemption) if session_exemption else '',
                'subscription_types': subscription_types,
                'promotion_code': str(promotion_code) if promotion_code else '',
                'content': str(content),
                'start_date': start_date_str,
                'end_date': end_date_str
            }

            promotions_data.append(promotion_data)

        if errors:
            return jsonify({'error': '\n'.join(errors)}), 400

        if not promotions_data:
            return jsonify({'error': '등록할 데이터가 없습니다'}), 400

        return jsonify({
            'success': True,
            'count': len(promotions_data),
            'data': promotions_data
        })

    except Exception as e:
        return jsonify({'error': f'파일 처리 중 오류 발생: {str(e)}'}), 500

@app.route('/api/promotions/bulk-save', methods=['POST'])
def bulk_save_promotions():
    """미리보기에서 수정된 프로모션 목록을 일괄 저장"""
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    try:
        data = request.get_json()
        promotions_to_save = data.get('promotions', [])

        if not promotions_to_save:
            return jsonify({'error': '저장할 데이터가 없습니다'}), 400

        # 기존 프로모션 로드
        existing_promotions = load_promotions()

        # 새 ID 생성을 위한 최대 ID 찾기
        max_id = max([p.get('id', 0) for p in existing_promotions], default=0)

        # 현재 사용자 정보
        username = session.get('username', 'Admin')
        now = datetime.now().isoformat()

        # 새 프로모션 추가
        for promo in promotions_to_save:
            max_id += 1
            promo['id'] = max_id
            promo['created_at'] = now
            promo['created_by'] = username
            promo['updated_at'] = now
            existing_promotions.append(promo)

        # 저장
        save_promotions(existing_promotions)

        return jsonify({
            'success': True,
            'count': len(promotions_to_save),
            'message': f'{len(promotions_to_save)}개의 프로모션이 등록되었습니다'
        })

    except Exception as e:
        return jsonify({'error': f'저장 중 오류 발생: {str(e)}'}), 500

# ==================== 개인 예약 관리 ====================

@app.route('/reminders')
def reminders_page():
    """예약 관리 페이지"""
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    username = session.get('username', 'Admin')
    return render_template('reminders.html',
                         username=username,
                         is_admin=is_admin(),
                         page_title='내 예약 관리',
                         current_page='reminders')

# ==================== 마이페이지 ====================

@app.route('/mypage')
def mypage():
    """마이페이지"""
    # 로그인 필수
    auth_check = require_login()
    if auth_check:
        return auth_check

    username = session.get('username', 'Admin')
    user_info = database.get_user_info(username) if not is_localhost() else {
        'username': 'Admin',
        'role': '관리자',
        'team': None,
        'status': 'active',
        'created_at': None
    }

    return render_template('mypage.html',
                         username=username,
                         user_info=user_info,
                         is_admin=is_admin(),
                         page_title='마이페이지',
                         current_page='mypage')

@app.route('/api/change-password', methods=['POST'])
def change_password():
    """비밀번호 변경"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    if is_localhost():
        return jsonify({'error': '로컬호스트에서는 비밀번호 변경이 불가능합니다.'}), 400

    data = request.json
    current_password = data.get('current_password', '').strip()
    new_password = data.get('new_password', '').strip()
    confirm_password = data.get('confirm_password', '').strip()

    if not current_password or not new_password or not confirm_password:
        return jsonify({'error': '모든 필드를 입력해주세요.'}), 400

    if new_password != confirm_password:
        return jsonify({'error': '새 비밀번호가 일치하지 않습니다.'}), 400

    if len(new_password) < 4:
        return jsonify({'error': '비밀번호는 최소 4자 이상이어야 합니다.'}), 400

    username = session.get('username')
    success, message = database.change_user_password(username, current_password, new_password)

    if success:
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'error': message}), 400

@app.route('/api/reminders', methods=['GET'])
def get_reminders():
    """예약 목록 조회"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    show_completed = request.args.get('show_completed', 'false').lower() == 'true'

    reminders = database.load_reminders(username, show_completed)
    return jsonify(reminders)

@app.route('/api/reminders', methods=['POST'])
def create_reminder():
    """새 예약 생성"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    data = request.json

    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    scheduled_date = data.get('scheduled_date', '').strip()
    scheduled_time = data.get('scheduled_time', '').strip()

    if not title or not scheduled_date or not scheduled_time:
        return jsonify({'error': 'Missing required fields'}), 400

    reminder_id = database.add_reminder(username, title, content, scheduled_date, scheduled_time)

    # Socket.IO로 배지 업데이트 전송
    counts = calculate_nav_counts(username)
    socketio.emit('nav_counts_update', counts, room=f'user_{username}')

    return jsonify({'id': reminder_id, 'success': True}), 201

@app.route('/api/reminders/<int:reminder_id>', methods=['PUT'])
def update_reminder(reminder_id):
    """예약 수정"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    data = request.json

    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    scheduled_date = data.get('scheduled_date', '').strip()
    scheduled_time = data.get('scheduled_time', '').strip()

    if not title or not scheduled_date or not scheduled_time:
        return jsonify({'error': 'Missing required fields'}), 400

    success = database.update_reminder(reminder_id, username, title, content, scheduled_date, scheduled_time)

    if not success:
        return jsonify({'error': 'Reminder not found or unauthorized'}), 404

    return jsonify({'success': True})

@app.route('/api/reminders/<int:reminder_id>', methods=['DELETE'])
def delete_reminder(reminder_id):
    """예약 삭제"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    success = database.delete_reminder(reminder_id, username)

    if not success:
        return jsonify({'error': 'Reminder not found or unauthorized'}), 404

    return jsonify({'success': True})

@app.route('/api/reminders/<int:reminder_id>/complete', methods=['PATCH'])
def toggle_reminder_complete(reminder_id):
    """예약 완료 상태 토글"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    success = database.toggle_reminder_complete(reminder_id, username)

    if not success:
        return jsonify({'error': 'Reminder not found or unauthorized'}), 404

    # Socket.IO로 배지 업데이트 전송
    counts = calculate_nav_counts(username)
    socketio.emit('nav_counts_update', counts, room=f'user_{username}')

    return jsonify({'success': True})

@app.route('/api/reminders/notifications', methods=['GET'])
def get_pending_notifications():
    """알림 필요한 예약 목록 (30분 전 알림용)"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username', 'Admin')
    reminders = database.get_pending_notifications(username)
    return jsonify(reminders)

@app.route('/api/reminders/<int:reminder_id>/notify', methods=['POST'])
def mark_reminder_notified(reminder_id):
    """30분 전 알림 발송 완료 표시"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    database.mark_reminder_notified(reminder_id)
    return jsonify({'success': True})

@app.route('/api/reminders/banner-check', methods=['GET'])
def check_reminder_banner():
    """배너 표시용 예약 체크 (당일 + 지난 미완료 예약)"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username')
    from datetime import date
    today = str(date.today())

    # 당일 + 지난 미완료 예약 필터링
    today_count = 0
    overdue_count = 0

    # 로컬호스트 또는 로그인하지 않은 경우: 모든 사용자의 예약 확인
    if is_localhost() or not username:
        users = database.load_all_users_detail()
        for user in users:
            user_reminders = database.load_reminders(user['username'], show_completed=True)
            for r in user_reminders:
                # PostgreSQL: is_completed는 0(미완료) 또는 1(완료)
                if r.get('is_completed') == 1:
                    continue
                reminder_date = r.get('scheduled_date', '')
                if reminder_date == today:
                    today_count += 1
                elif reminder_date < today:
                    overdue_count += 1
    else:
        # 로그인된 사용자: 본인 예약만 확인
        reminders = database.load_reminders(username, show_completed=True)
        for r in reminders:
            # PostgreSQL: is_completed는 0(미완료) 또는 1(완료)
            if r.get('is_completed') == 1:
                continue
            reminder_date = r.get('scheduled_date', '')
            if reminder_date == today:
                today_count += 1
            elif reminder_date < today:
                overdue_count += 1

    return jsonify({
        'has_reminders': today_count > 0 or overdue_count > 0,
        'today_count': today_count,
        'overdue_count': overdue_count,
        'total_count': today_count + overdue_count
    })

@app.route('/api/reminders/today', methods=['GET'])
def get_today_reminders():
    """당일 예약 목록 (시간순 정렬)"""
    if 'username' not in session and not is_localhost():
        return jsonify({'error': 'Unauthorized'}), 401

    username = session.get('username')
    from datetime import date
    today = str(date.today())

    # 당일 미완료 예약 필터링
    today_reminders = []

    # 로컬호스트 또는 로그인하지 않은 경우: 모든 사용자의 예약 확인
    if is_localhost() or not username:
        users = database.load_all_users_detail()
        for user in users:
            user_reminders = database.load_reminders(user['username'])
            for r in user_reminders:
                if r.get('is_completed'):
                    continue
                if r.get('scheduled_date', '') == today:
                    today_reminders.append(r)
    else:
        # 로그인된 사용자: 본인 예약만 확인
        reminders = database.load_reminders(username)
        for r in reminders:
            if r.get('is_completed'):
                continue
            if r.get('scheduled_date', '') == today:
                today_reminders.append(r)

    # 시간순 정렬
    today_reminders.sort(key=lambda x: x.get('scheduled_time', ''))

    return jsonify(today_reminders)

@app.route('/api/holidays', methods=['GET'])
def get_holidays():
    """공휴일 목록 조회 (년도별)"""
    year = request.args.get('year', type=int)

    holidays = database.load_holidays(year)

    # 날짜를 키로 하는 딕셔너리로 변환
    holidays_dict = {}
    for h in holidays:
        date_str = str(h['holiday_date'])
        holidays_dict[date_str] = h['holiday_name']

    return jsonify(holidays_dict)

# ==================== 사용자 관리 API ====================

@app.route('/users')
def users_page():
    """사용자 관리 페이지 (관리자 전용)"""
    # 관리자 권한 검증
    auth_check = require_admin()
    if auth_check:
        return auth_check

    username = session.get('username', 'Admin')
    return render_template('users.html',
                         username=username,
                         is_admin=is_admin(),
                         page_title='사용자 관리',
                         current_page='users')

@app.route('/api/users', methods=['GET'])
def get_users():
    """모든 사용자 목록 조회 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    users = database.load_all_users_detail()
    return jsonify(users)

@app.route('/api/users', methods=['POST'])
def create_user_account():
    """새 사용자 생성 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    username = data.get('username', '').strip()
    role = data.get('role', '상담사')
    status = data.get('status', 'active')
    team = data.get('team', '').strip() or None

    if not username or not role:
        return jsonify({'error': 'Username and role are required'}), 400

    # 초기 비밀번호 설정
    password = 'admin1234' if role == '관리자' else 'body123!'

    success = database.create_user(username, password, role, status, team)

    if success:
        return jsonify({'success': True, 'message': 'User created successfully'})
    else:
        return jsonify({'error': 'Username already exists'}), 400

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user_account(user_id):
    """사용자 삭제 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    success = database.delete_user(user_id)

    if success:
        return jsonify({'success': True, 'message': 'User deleted successfully'})
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/users/<int:user_id>/status', methods=['PATCH'])
def update_user_status_api(user_id):
    """사용자 상태 변경 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    status = data.get('status')

    if status not in ['active', 'inactive']:
        return jsonify({'error': 'Invalid status'}), 400

    success = database.update_user_status(user_id, status)

    if success:
        return jsonify({'success': True, 'message': 'Status updated successfully'})
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/users/<int:user_id>/team', methods=['PATCH'])
def update_user_team_api(user_id):
    """사용자 팀 변경 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    team_value = data.get('team')
    # None이거나 빈 문자열이면 None으로 처리
    team = team_value.strip() if team_value and isinstance(team_value, str) else None
    if team == '':
        team = None

    success = database.update_user_team(user_id, team)

    if success:
        return jsonify({'success': True, 'message': 'Team updated successfully'})
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/users/<int:user_id>/role', methods=['PATCH'])
def update_user_role_api(user_id):
    """사용자 권한 변경 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    role = data.get('role')

    if role not in ['상담사', '관리자']:
        return jsonify({'error': 'Invalid role'}), 400

    success = database.update_user_role(user_id, role)

    if success:
        return jsonify({'success': True, 'message': 'Role updated successfully'})
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
def reset_user_password_api(user_id):
    """사용자 비밀번호 초기화 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    role = data.get('role')

    if role not in ['상담사', '관리자']:
        return jsonify({'error': 'Invalid role'}), 400

    success = database.reset_user_password(user_id, role)

    if success:
        return jsonify({'success': True, 'message': 'Password reset successfully'})
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/teams', methods=['GET'])
def get_teams_api():
    """팀 목록 조회 (관리자 전용)"""
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    teams = database.load_teams()
    return jsonify(teams)

@cached(ttl=30, key_prefix='nav_counts')
def calculate_nav_counts(username):
    """네비게이션 바 카운트 계산 (헬퍼 함수) - 30초 캐시"""
    counts = {
        'pending_tasks': 0,
        'unread_chats': 0,
        'today_reminders': 0
    }

    try:
        # 읽지 않은 채팅 메시지 개수 계산
        chats = database.load_chats()
        for chat_id, chat in chats.items():
            if username in chat['participants']:
                for msg in chat.get('messages', []):
                    if msg.get('username') != username:
                        read_by = msg.get('read_by', [])
                        if username not in read_by:
                            counts['unread_chats'] += 1

        # 상담사: 내게 할당된 미완료 할일 개수 (assigned_to 사용)
        if username not in ADMIN_ACCOUNTS:
            with database.get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT COUNT(*) as count
                    FROM tasks
                    WHERE assigned_to = ? AND status != '완료'
                ''', (username,))
                row = cursor.fetchone()
                counts['pending_tasks'] = row['count'] if row else 0

        # 당일 예약 개수
        from datetime import date
        today = str(date.today())
        reminders = database.load_reminders(username)
        today_reminders = [r for r in reminders if r.get('scheduled_date') == today and not r.get('completed')]
        counts['today_reminders'] = len(today_reminders)

    except Exception as e:
        print(f"Error calculating nav counts for {username}: {e}")

    return counts

@app.route('/api/nav-counts', methods=['GET'])
def get_nav_counts():
    """네비게이션 바 카운트 조회 (할일, 읽지 않은 채팅, 당일 예약)"""
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    username = session['username']
    counts = calculate_nav_counts(username)
    print(f"[DEBUG] Final nav-counts for {username}: {counts}")
    return jsonify(counts)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
