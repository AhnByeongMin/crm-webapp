#!/bin/bash
#
# CRM 웹앱 무중단 롤링 재시작 스크립트
# - 한 번에 하나의 인스턴스만 재시작하여 서비스 중단 없음
# - 새 인스턴스가 정상 작동 확인 후 다음 인스턴스 재시작
#

set -e

APP_DIR="/svc/was/crm/crm-webapp"
GUNICORN_BIN="/home/haruhome/miniconda3/bin/gunicorn"
LOG_DIR="$APP_DIR/logs"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 인스턴스 정보
declare -A INSTANCES
INSTANCES[5001]="gunicorn_config_5001.py"
INSTANCES[5002]="gunicorn_config_5002.py"

echo "=========================================="
echo "CRM 웹앱 무중단 롤링 재시작"
echo "=========================================="
echo ""

# 작업 디렉토리 이동
cd "$APP_DIR"

# 인스턴스 상태 확인 함수
check_instance() {
    local PORT=$1
    local PID=$(lsof -ti :$PORT 2>/dev/null | head -1)

    if [ -n "$PID" ]; then
        echo "$PID"
        return 0
    else
        echo ""
        return 1
    fi
}

# 헬스체크 함수
health_check() {
    local PORT=$1
    local MAX_WAIT=30
    local COUNT=0

    while [ $COUNT -lt $MAX_WAIT ]; do
        # 포트가 열려있고 응답하는지 확인
        if curl -s --max-time 2 "http://127.0.0.1:$PORT/health" > /dev/null 2>&1 || \
           curl -s --max-time 2 "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        COUNT=$((COUNT + 1))
        echo -n "."
    done

    return 1
}

# 단일 인스턴스 재시작 함수
restart_instance() {
    local PORT=$1
    local CONFIG=${INSTANCES[$PORT]}

    echo -e "${YELLOW}[인스턴스 $PORT]${NC}"

    # 1. 현재 PID 확인
    local OLD_PID=$(check_instance $PORT)

    if [ -n "$OLD_PID" ]; then
        echo "  현재 PID: $OLD_PID"

        # 2. Graceful 종료 (SIGTERM)
        echo "  → Graceful 종료 요청 (SIGTERM)..."
        kill -TERM $OLD_PID 2>/dev/null || true

        # 3. 종료 대기 (최대 30초)
        local TIMEOUT=30
        local COUNT=0
        while ps -p $OLD_PID > /dev/null 2>&1 && [ $COUNT -lt $TIMEOUT ]; do
            sleep 1
            COUNT=$((COUNT + 1))
            echo -n "."
        done
        echo ""

        # 4. 아직 살아있으면 강제 종료
        if ps -p $OLD_PID > /dev/null 2>&1; then
            echo "  → 강제 종료 (SIGKILL)..."
            kill -9 $OLD_PID 2>/dev/null || true
            sleep 2
        fi

        echo -e "  ${GREEN}✓ 기존 프로세스 종료${NC}"
    else
        echo "  (기존 프로세스 없음)"
    fi

    # 5. 포트 해제 대기
    sleep 1

    # 6. 새 인스턴스 시작
    echo "  → 새 인스턴스 시작..."
    $GUNICORN_BIN -c "$CONFIG" app:app --daemon 2>&1

    # 7. 헬스체크
    echo -n "  → 헬스체크"
    if health_check $PORT; then
        echo ""
        local NEW_PID=$(check_instance $PORT)
        echo -e "  ${GREEN}✓ 정상 시작 (PID: $NEW_PID)${NC}"
        return 0
    else
        echo ""
        echo -e "  ${RED}✗ 시작 실패!${NC}"
        echo "  로그 확인: tail -50 $LOG_DIR/error_${PORT}.log"
        return 1
    fi
}

# 실행 중인 인스턴스 수 확인
count_running() {
    local COUNT=0
    for PORT in "${!INSTANCES[@]}"; do
        if check_instance $PORT > /dev/null 2>&1; then
            COUNT=$((COUNT + 1))
        fi
    done
    echo $COUNT
}

# 메인 로직
echo "현재 상태 확인..."
RUNNING_COUNT=$(count_running)
echo "  실행 중인 인스턴스: $RUNNING_COUNT/2"
echo ""

# 롤링 재시작 (5002 먼저, 그 다음 5001)
# 5001이 주 인스턴스이므로 5002 먼저 재시작
for PORT in 5002 5001; do
    restart_instance $PORT
    echo ""

    # 첫 번째 인스턴스 재시작 후 잠시 대기
    if [ $PORT -eq 5002 ]; then
        echo "다음 인스턴스 재시작 전 안정화 대기 (3초)..."
        sleep 3
        echo ""
    fi
done

echo "=========================================="
echo "최종 상태"
echo "=========================================="

# 최종 확인
ALL_OK=true
for PORT in "${!INSTANCES[@]}"; do
    PID=$(check_instance $PORT)
    if [ -n "$PID" ]; then
        echo -e "  포트 $PORT: ${GREEN}✓ 실행 중${NC} (PID: $PID)"
    else
        echo -e "  포트 $PORT: ${RED}✗ 중지됨${NC}"
        ALL_OK=false
    fi
done

echo ""
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✓ 무중단 재시작 완료${NC}"
    echo ""
    echo "접속 URL:"
    echo "  - https://haruittl.asuscomm.com:5000/"
    echo "  - https://haruittl.asuscomm.com/crm-webapp/"
else
    echo -e "${YELLOW}⚠ 일부 인스턴스 문제 발생${NC}"
    echo "로그 확인:"
    echo "  tail -50 $LOG_DIR/error_5001.log"
    echo "  tail -50 $LOG_DIR/error_5002.log"
    exit 1
fi
echo "=========================================="
