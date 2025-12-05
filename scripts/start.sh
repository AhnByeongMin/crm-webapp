#!/bin/bash
#
# CRM 웹앱 시작 스크립트 (이중 인스턴스 - 무중단 서비스)
#

set -e

PORT1=5001
PORT2=5002
APP_DIR="/svc/was/crm/crm-webapp"
GUNICORN_BIN="$(which gunicorn)"

echo "=========================================="
echo "CRM 웹앱 시작 (이중 인스턴스)"
echo "포트: $PORT1, $PORT2"
echo "=========================================="

# 1. 작업 디렉토리 이동
cd "$APP_DIR"

# 2. 포트 사용 중인지 확인
for PORT in $PORT1 $PORT2; do
    if lsof -ti :$PORT > /dev/null 2>&1; then
        echo "✗ 오류: 포트 $PORT 가 이미 사용 중입니다."
        echo ""
        echo "실행 중인 프로세스:"
        lsof -i :$PORT
        echo ""
        echo "종료하려면: $APP_DIR/scripts/stop.sh"
        exit 1
    fi
done

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

# 5. Gunicorn 인스턴스 1 시작 (5001)
echo "✓ Gunicorn 인스턴스 1 시작 (포트 $PORT1)..."
$GUNICORN_BIN -c gunicorn_config_5001.py app:app &
PID1=$!
sleep 1

# 6. Gunicorn 인스턴스 2 시작 (5002)
echo "✓ Gunicorn 인스턴스 2 시작 (포트 $PORT2)..."
$GUNICORN_BIN -c gunicorn_config_5002.py app:app &
PID2=$!
sleep 1

# 7. 프로세스 확인
SUCCESS=0
if ps -p $PID1 > /dev/null 2>&1; then
    echo "✓ 인스턴스 1 시작 완료 (PID: $PID1, 포트: $PORT1)"
    SUCCESS=$((SUCCESS + 1))
else
    echo "✗ 오류: 인스턴스 1 시작 실패"
    echo "에러 로그 확인: tail -50 $APP_DIR/logs/error_5001.log"
fi

if ps -p $PID2 > /dev/null 2>&1; then
    echo "✓ 인스턴스 2 시작 완료 (PID: $PID2, 포트: $PORT2)"
    SUCCESS=$((SUCCESS + 1))
else
    echo "✗ 오류: 인스턴스 2 시작 실패"
    echo "에러 로그 확인: tail -50 $APP_DIR/logs/error_5002.log"
fi

if [ $SUCCESS -eq 0 ]; then
    echo "✗ 모든 인스턴스 시작 실패"
    exit 1
elif [ $SUCCESS -eq 1 ]; then
    echo "⚠ 경고: 1개 인스턴스만 실행 중 (무중단 서비스 불가)"
fi

echo ""
echo "✓ 접속 주소: http://58.232.66.210:5000/ (Nginx 로드밸런서)"
echo ""
echo "로그 확인:"
echo "  tail -f $APP_DIR/logs/access_5001.log"
echo "  tail -f $APP_DIR/logs/access_5002.log"
echo "=========================================="
