"""
Gunicorn 설정 파일 (Flask-SocketIO 최적화)
"""
import multiprocessing

# 서버 소켓
bind = '0.0.0.0:5000'
backlog = 2048

# 워커 설정 (SocketIO는 eventlet 사용)
worker_class = 'eventlet'
# ⚠️ Socket.IO는 단일 워커만 사용 (메시지 브로커 없이는 다중 워커 불가)
# 다중 워커 사용 시 WebSocket 세션이 워커 간 공유되지 않아 400 에러 발생
workers = 1
worker_connections = 1000
timeout = 120
keepalive = 5

# 로깅
accesslog = '/svc/was/crm/crm-webapp/logs/access.log'
errorlog = '/svc/was/crm/crm-webapp/logs/error.log'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 프로세스 이름
proc_name = 'crm_webapp'

# 재시작 설정
max_requests = 1000  # 메모리 누수 방지
max_requests_jitter = 50
graceful_timeout = 30

# 보안
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
