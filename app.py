from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.utils import secure_filename
import json
import os
import uuid
import threading
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB 최대 파일 크기
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'}

socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=50 * 1024 * 1024)

DATA_FILE = 'data.json'
CHAT_FILE = 'chats.json'
USERS_FILE = 'users.json'
PROMOTIONS_FILE = 'promotions.json'

# 파일 쓰기 동기화를 위한 락
chat_file_lock = threading.Lock()
promotions_file_lock = threading.Lock()

# 관리자 계정 (이름: 비밀번호)
ADMIN_ACCOUNTS = {
    '김은아': 'admin1234',
    '김지원': 'admin1234',
    '민건희': 'admin1234',
    '홍민지': 'admin1234',
    '안병민': 'admin1234'
}

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_chats():
    with chat_file_lock:
        if os.path.exists(CHAT_FILE):
            try:
                with open(CHAT_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                print(f"[ERROR] chats.json 파싱 오류: {e}")
                # 백업 파일 생성
                import shutil
                backup_file = f'chats_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                if os.path.exists(CHAT_FILE):
                    shutil.copy(CHAT_FILE, backup_file)
                    print(f"[ERROR] 손상된 파일을 {backup_file}로 백업했습니다")
                return {}
        return {}

def save_chats(chats):
    with chat_file_lock:
        # 임시 파일에 먼저 저장 후 원본 파일로 이동 (원자적 쓰기)
        import shutil
        temp_file = CHAT_FILE + '.tmp'
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(chats, f, ensure_ascii=False, indent=2)
            # 임시 파일을 원본으로 교체
            shutil.move(temp_file, CHAT_FILE)
        except Exception as e:
            print(f"[ERROR] chats.json 저장 오류: {e}")
            if os.path.exists(temp_file):
                os.remove(temp_file)

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_promotions():
    with promotions_file_lock:
        if os.path.exists(PROMOTIONS_FILE):
            try:
                with open(PROMOTIONS_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                print(f"[ERROR] promotions.json 파싱 오류: {e}")
                import shutil
                backup_file = f'promotions_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                if os.path.exists(PROMOTIONS_FILE):
                    shutil.copy(PROMOTIONS_FILE, backup_file)
                    print(f"[ERROR] 손상된 파일을 {backup_file}로 백업했습니다")
                return []
        return []

def save_promotions(promotions):
    with promotions_file_lock:
        import shutil
        temp_file = PROMOTIONS_FILE + '.tmp'
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(promotions, f, ensure_ascii=False, indent=2)
            shutil.move(temp_file, PROMOTIONS_FILE)
        except Exception as e:
            print(f"[ERROR] promotions.json 저장 오류: {e}")
            if os.path.exists(temp_file):
                os.remove(temp_file)

def add_user(username):
    """로그인한 사용자를 사용자 목록에 추가"""
    users = load_users()
    if username not in users:
        users.append(username)
        save_users(users)

def is_localhost():
    return request.remote_addr in ['127.0.0.1', 'localhost', '::1']

def is_admin():
    """실제 관리자 권한 확인 (로컬호스트 또는 관리자 계정으로 로그인)"""
    if is_localhost():
        return True

    # 관리자 계정으로 로그인한 경우
    if 'username' in session and session['username'] in ADMIN_ACCOUNTS:
        return True

    return False

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
    return render_template('user.html', username=session['username'])

@app.route('/login', methods=['GET', 'POST'])
def login():
    if is_localhost():
        return redirect(url_for('admin'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if not username:
            return render_template('login.html', error='이름을 입력하세요.')

        # 관리자 계정으로 로그인 시도
        if username in ADMIN_ACCOUNTS:
            # 비밀번호 확인
            if not password:
                return render_template('login.html', error='관리자 계정은 비밀번호가 필요합니다.', username=username)

            if password != ADMIN_ACCOUNTS[username]:
                return render_template('login.html', error='비밀번호가 올바르지 않습니다.', username=username)

        # 일반 사용자는 비밀번호 불필요
        session['username'] = username
        add_user(username)  # 사용자 목록에 추가
        return redirect(url_for('index'))

    return render_template('login.html')

@app.route('/admin')
def admin():
    if not is_admin():
        return "Access Denied", 403

    username = session.get('username', 'Admin')
    return render_template('admin.html', username=username)

@app.route('/api/items', methods=['GET'])
def get_items():
    data = load_data()

    if is_admin():
        return jsonify(data)

    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    # 일반 사용자는 자신에게 할당된 항목만 조회
    username = session['username']
    user_items = [item for item in data if item.get('assigned_to') == username]

    return jsonify(user_items)

@app.route('/api/items', methods=['POST'])
def create_item():
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = load_data()
    new_item = request.json
    new_item['id'] = max([item.get('id', 0) for item in data], default=0) + 1
    new_item['created_at'] = datetime.now().isoformat()
    data.append(new_item)
    save_data(data)

    return jsonify(new_item), 201

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = load_data()
    updated_data = request.json

    for i, item in enumerate(data):
        if item.get('id') == item_id:
            data[i].update(updated_data)
            data[i]['id'] = item_id
            data[i]['updated_at'] = datetime.now().isoformat()
            save_data(data)
            return jsonify(data[i])

    return jsonify({'error': 'Not found'}), 404

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if not is_admin():
        return jsonify({'error': 'Forbidden'}), 403

    data = load_data()
    data = [item for item in data if item.get('id') != item_id]
    save_data(data)

    return jsonify({'success': True})

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
    if 'username' not in session and not is_localhost():
        return redirect(url_for('login'))

    # 관리자는 관리 페이지로
    if is_admin():
        username = session.get('username', 'Admin')
        return render_template('admin_chat.html', username=username, is_admin=True)

    return render_template('chat_list.html', username=session.get('username'), is_admin=False)

@app.route('/chats/all')
def chat_list_admin():
    """관리자 전용 채팅 관리 페이지"""
    if not is_admin():
        return redirect(url_for('chat_list'))

    username = session.get('username', 'Admin')
    return render_template('admin_chat.html', username=username, is_admin=True)

@app.route('/chat/create')
def chat_create_page():
    if 'username' not in session and not is_localhost():
        return redirect(url_for('login'))

    return render_template('chat_create.html')

@app.route('/chat/<chat_id>')
def chat_room(chat_id):
    if 'username' not in session and not is_localhost():
        return redirect(url_for('login'))

    chats = load_chats()
    if chat_id not in chats:
        return "Chat not found", 404

    username = session.get('username', 'Admin')
    chat_info = chats[chat_id]

    # 로컬호스트(진짜 서버 관리자)만 모든 채팅방 입장 가능
    # 관리자 계정 포함 일반 사용자는 자신이 참여자인 채팅방만 입장 가능
    if not is_localhost() and username not in chat_info['participants']:
        return "Access Denied - 참여자만 입장 가능합니다", 403

    return render_template('chat_room.html',
                         chat_id=chat_id,
                         username=username,
                         chat_title=chat_info['title'])

@app.route('/api/chats', methods=['GET'])
def get_chats():
    chats = load_chats()

    # 로컬호스트(진짜 서버 관리자)만 모든 채팅방 조회 가능
    if is_localhost():
        return jsonify(chats)

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

            # 채팅방 정보에 unread_count 추가
            chat_data = chat_info.copy()
            chat_data['unread_count'] = unread_count
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

    # 기존 ID 중 최대값을 찾아서 +1 (삭제로 인한 ID 중복 방지)
    if chats:
        max_id = max(int(cid) for cid in chats.keys())
        chat_id = str(max_id + 1)
    else:
        chat_id = '1'

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
        chats[chat_id]['messages'].append(msg_obj)
        save_chats(chats)

        # 방의 모든 사용자에게 브로드캐스트
        emit('new_message', msg_obj, room=chat_id)

        # 채팅 참여자들에게 알림 브로드캐스트 (채팅방 밖에 있는 사람들을 위해)
        chat_info = chats[chat_id]
        for participant in chat_info['participants']:
            if participant != username:  # 보낸 사람 제외
                emit('global_new_message', {
                    'chat_id': chat_id,
                    'chat_title': chat_info['title'],
                    'sender': username,
                    'message': message,
                    'is_one_to_one': chat_info.get('is_one_to_one', False),
                    'participants': chat_info['participants']
                }, room=f'user_{participant}')

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
        emit('read_receipt_update', {
            'chat_id': chat_id,
            'username': username,
            'message_index': message_index
        }, room=chat_id, include_self=False)

# ============== 프로모션 게시판 ==============

@app.route('/promotions')
def promotions_page():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('promotions.html',
                         username=session['username'],
                         is_admin=is_admin())

@app.route('/api/promotions', methods=['GET'])
def get_promotions():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    promotions = load_promotions()

    # 필터링 (쿼리 파라미터)
    product_name = request.args.get('product_name')
    channel = request.args.get('channel')
    promotion_name = request.args.get('promotion_name')
    search = request.args.get('search')

    filtered = promotions

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
        'id': max([p.get('id', 0) for p in promotions], default=0) + 1,
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

    return jsonify({
        'categories': sorted(categories),
        'products': sorted(products),
        'channels': sorted(channels),
        'promotion_names': sorted(promo_names)
    })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
