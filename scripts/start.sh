#!/bin/bash
#
# CRM 웹앱 시작 스크립트
#

set -e

PORT=5000
APP_DIR="/svc/was/crm/crm-webapp"
GUNICORN_BIN="$(which gunicorn)"

echo "=========================================="
echo "CRM 웹앱 시작 (포트 $PORT)"
echo "=========================================="

# 1. 작업 디렉토리 이동
cd "$APP_DIR"

# 2. 포트 사용 중인지 확인
if lsof -ti :$PORT > /dev/null 2>&1; then
    echo "✗ 오류: 포트 $PORT 가 이미 사용 중입니다."
    echo ""
    echo "실행 중인 프로세스:"
    lsof -i :$PORT
    echo ""
    echo "종료하려면: $APP_DIR/scripts/stop.sh"
    exit 1
fi

# 3. 로그 디렉토리 확인
if [ ! -d "$APP_DIR/logs" ]; then
    echo "로그 디렉토리 생성: $APP_DIR/logs"
    mkdir -p "$APP_DIR/logs"
fi

# 4. Gunicorn 설치 확인
if [ ! -f "$GUNICORN_BIN" ]; then
    echo "✗ 오류: Gunicorn이 설치되지 않았습니다."
    echo "설치 명령: pip install -r requirements.txt"
    exit 1
fi

# 5. Gunicorn 시작
echo "✓ Gunicorn 시작..."
$GUNICORN_BIN -c gunicorn_config.py app:app &
GUNICORN_PID=$!

# 6. 프로세스 시작 대기
sleep 2

# 7. 프로세스 확인
if ps -p $GUNICORN_PID > /dev/null 2>&1; then
    echo "✓ CRM 웹앱 시작 완료 (PID: $GUNICORN_PID)"
    echo "✓ 접속 주소: http://0.0.0.0:$PORT"
    echo ""
    echo "로그 확인:"
    echo "  tail -f $APP_DIR/logs/access.log"
    echo "  tail -f $APP_DIR/logs/error.log"
else
    echo "✗ 오류: Gunicorn 시작 실패"
    echo "에러 로그 확인: tail -50 $APP_DIR/logs/error.log"
    exit 1
fi

echo "=========================================="
