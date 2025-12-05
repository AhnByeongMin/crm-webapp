"""
Gunicorn 설정 파일 - 포트 5001 (Flask-SocketIO 최적화)
무중단 서비스를 위한 이중 인스턴스 구성
"""
import multiprocessing

# 서버 소켓
bind = '127.0.0.1:5001'
backlog = 2048

# 워커 설정 (SocketIO는 eventlet 사용)
worker_class = 'eventlet'
# Socket.IO sticky session을 위해 단일 워커 사용
workers = 1
worker_connections = 1000
timeout = 120
keepalive = 5

# 로깅
accesslog = '/svc/was/crm/crm-webapp/logs/access_5001.log'
errorlog = '/svc/was/crm/crm-webapp/logs/error_5001.log'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 프로세스 이름
proc_name = 'crm_webapp_5001'

# 재시작 설정
max_requests = 10000  # 메모리 누수 방지
max_requests_jitter = 500
graceful_timeout = 30

# 보안
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
