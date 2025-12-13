"""
Gunicorn 설정 파일 - 포트 5002 (Flask-SocketIO + Redis + gevent)
무중단 서비스를 위한 이중 인스턴스 구성 (TEST: gevent worker)
"""
import multiprocessing

# 서버 소켓
bind = '127.0.0.1:5002'
backlog = 2048

# 워커 설정 (eventlet - Socket.IO 안정성 우선)
worker_class = 'eventlet'
# eventlet은 싱글 워커 권장 (Socket.IO 호환성)
workers = 1
worker_connections = 1000
timeout = 120
keepalive = 5

# 로깅
accesslog = '/svc/was/crm/crm-webapp/logs/access_5002.log'
errorlog = '/svc/was/crm/crm-webapp/logs/error_5002.log'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 프로세스 이름
proc_name = 'crm_webapp_5002'

# 재시작 설정 (주기적 갱신으로 메모리 안정성 확보)
max_requests = 50000   # 5만 (재시작 오버헤드 미미, 안정성 우선)
max_requests_jitter = 5000
graceful_timeout = 30

# 보안
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
