#!/bin/bash
#
# CRM 웹앱 시작 스크립트 (이중 인스턴스 - 무중단 서비스)
#

set -e

APP_DIR="/svc/was/crm/crm-webapp"
GUNICORN_BIN="/home/haruhome/miniconda3/bin/gunicorn"
LOG_DIR="$APP_DIR/logs"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 인스턴스 정보
declare -A INSTANCES
INSTANCES[5001]="gunicorn_config_5001.py"
INSTANCES[5002]="gunicorn_config_5002.py"

echo "=========================================="
echo "CRM 웹앱 시작 (이중 인스턴스)"
echo "=========================================="
echo ""

# 작업 디렉토리 이동
cd "$APP_DIR"

# 로그 디렉토리 확인
if [ ! -d "$LOG_DIR" ]; then
    echo "로그 디렉토리 생성: $LOG_DIR"
    mkdir -p "$LOG_DIR"
fi

# Gunicorn 확인
if [ ! -f "$GUNICORN_BIN" ]; then
    echo -e "${RED}✗ 오류: Gunicorn이 설치되지 않았습니다.${NC}"
    echo "설치 명령: pip install -r requirements.txt"
    exit 1
fi

# 헬스체크 함수
health_check() {
    local PORT=$1
    local MAX_WAIT=30
    local COUNT=0

    while [ $COUNT -lt $MAX_WAIT ]; do
        if curl -s --max-time 2 "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        COUNT=$((COUNT + 1))
        echo -n "."
    done
    return 1
}

# 인스턴스 시작 함수
start_instance() {
    local PORT=$1
    local CONFIG=${INSTANCES[$PORT]}

    echo -e "${YELLOW}[포트 $PORT]${NC}"

    # 이미 실행 중인지 확인
    if lsof -ti :$PORT > /dev/null 2>&1; then
        local EXISTING_PID=$(lsof -ti :$PORT | head -1)
        echo -e "  ${GREEN}✓ 이미 실행 중${NC} (PID: $EXISTING_PID)"
        return 0
    fi

    # Gunicorn 시작
    echo "  → Gunicorn 시작..."
    $GUNICORN_BIN -c "$CONFIG" app:app --daemon 2>&1

    sleep 1

    # 헬스체크
    echo -n "  → 헬스체크"
    if health_check $PORT; then
        echo ""
        local NEW_PID=$(lsof -ti :$PORT | head -1)
        echo -e "  ${GREEN}✓ 시작 완료${NC} (PID: $NEW_PID)"
        return 0
    else
        echo ""
        echo -e "  ${RED}✗ 시작 실패${NC}"
        echo "  로그 확인: tail -50 $LOG_DIR/error_${PORT}.log"
        return 1
    fi
}

# 인스턴스 시작 (5001 먼저)
SUCCESS_COUNT=0
for PORT in 5001 5002; do
    if start_instance $PORT; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    fi
    echo ""
done

echo "=========================================="
echo "최종 상태"
echo "=========================================="

# 최종 확인
for PORT in "${!INSTANCES[@]}"; do
    PID=$(lsof -ti :$PORT 2>/dev/null | head -1 || true)
    if [ -n "$PID" ]; then
        echo -e "  포트 $PORT: ${GREEN}✓ 실행 중${NC} (PID: $PID)"
    else
        echo -e "  포트 $PORT: ${RED}✗ 중지됨${NC}"
    fi
done

echo ""
if [ $SUCCESS_COUNT -eq 2 ]; then
    echo -e "${GREEN}✓ 모든 인스턴스 시작 완료 (무중단 서비스 가능)${NC}"
elif [ $SUCCESS_COUNT -eq 1 ]; then
    echo -e "${YELLOW}⚠ 1개 인스턴스만 실행 중 (무중단 서비스 불가)${NC}"
else
    echo -e "${RED}✗ 시작 실패${NC}"
    exit 1
fi

echo ""
echo "접속 URL:"
echo "  - https://haruittl.asuscomm.com:5000/"
echo "  - https://haruittl.asuscomm.com/crm-webapp/"
echo ""
echo "로그 확인:"
echo "  tail -f $LOG_DIR/access_5001.log"
echo "  tail -f $LOG_DIR/access_5002.log"
echo "=========================================="
