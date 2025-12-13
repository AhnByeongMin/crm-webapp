#!/bin/bash
#
# CRM 웹앱 무중단 롤링 재시작 스크립트 v2
# - 한 번에 하나의 인스턴스만 재시작
# - 다른 인스턴스가 트래픽 처리하는 동안 재시작
# - 연속 헬스체크 성공 + 충분한 안정화 대기
#

set -e

APP_DIR="/svc/was/crm/crm-webapp"
GUNICORN_BIN="/home/haruhome/miniconda3/bin/gunicorn"
LOG_DIR="$APP_DIR/logs"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 인스턴스 정보
declare -A INSTANCES
INSTANCES[5001]="gunicorn_config_5001.py"
INSTANCES[5002]="gunicorn_config_5002.py"

# 안정화 대기 시간 (Nginx upstream 인식 + 기존 연결 drain)
STABILIZATION_WAIT=10

echo "=========================================="
echo "CRM 웹앱 무중단 롤링 재시작 v2"
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

# 인스턴스 직접 헬스체크 (연속 5회 성공 필요)
health_check() {
    local PORT=$1
    local MAX_WAIT=45
    local COUNT=0
    local SUCCESS_REQUIRED=5
    local SUCCESS_COUNT=0

    while [ $COUNT -lt $MAX_WAIT ]; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$PORT/api/version" 2>/dev/null || echo "000")

        if [ "$HTTP_CODE" = "200" ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            echo -n "✓"
            if [ $SUCCESS_COUNT -ge $SUCCESS_REQUIRED ]; then
                return 0
            fi
        else
            SUCCESS_COUNT=0  # 연속 성공이어야 함
            echo -n "."
        fi
        sleep 1
        COUNT=$((COUNT + 1))
    done

    return 1
}

# Nginx를 통한 서비스 헬스체크 (연속 3회 성공 필요)
nginx_health_check() {
    local MAX_WAIT=20
    local COUNT=0
    local SUCCESS_REQUIRED=3
    local SUCCESS_COUNT=0

    while [ $COUNT -lt $MAX_WAIT ]; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:5000/api/version" 2>/dev/null || echo "000")

        if [ "$HTTP_CODE" = "200" ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            if [ $SUCCESS_COUNT -ge $SUCCESS_REQUIRED ]; then
                return 0
            fi
        else
            SUCCESS_COUNT=0
        fi
        sleep 1
        COUNT=$((COUNT + 1))
        echo -n "."
    done

    return 1
}

# 단일 인스턴스 재시작 함수 (다른 인스턴스가 살아있어야 함)
restart_instance() {
    local PORT=$1
    local OTHER_PORT=$2
    local CONFIG=${INSTANCES[$PORT]}

    echo -e "${YELLOW}[인스턴스 $PORT 재시작]${NC}"

    # 1. 다른 인스턴스가 살아있는지 확인
    local OTHER_PID=$(check_instance $OTHER_PORT)
    if [ -z "$OTHER_PID" ]; then
        echo -e "  ${RED}⚠ 경고: 백업 인스턴스($OTHER_PORT)가 없음!${NC}"
        echo -e "  ${RED}  서비스 중단 발생 가능${NC}"
    else
        echo -e "  ${GREEN}✓ 백업 인스턴스 $OTHER_PORT (PID: $OTHER_PID) 트래픽 처리 중${NC}"
    fi

    # 2. 현재 인스턴스 PID 확인
    local OLD_PID=$(check_instance $PORT)

    if [ -n "$OLD_PID" ]; then
        echo "  → 기존 인스턴스 종료 중 (PID: $OLD_PID)..."

        # Graceful 종료 (SIGTERM)
        kill -TERM $OLD_PID 2>/dev/null || true

        # 종료 대기 (최대 30초)
        local TIMEOUT=30
        local COUNT=0
        while ps -p $OLD_PID > /dev/null 2>&1 && [ $COUNT -lt $TIMEOUT ]; do
            sleep 1
            COUNT=$((COUNT + 1))
            echo -n "."
        done
        echo ""

        # 아직 살아있으면 강제 종료
        if ps -p $OLD_PID > /dev/null 2>&1; then
            echo "  → 강제 종료 (SIGKILL)..."
            kill -9 $OLD_PID 2>/dev/null || true
            sleep 2
        fi

        echo -e "  ${GREEN}✓ 기존 인스턴스 종료 완료${NC}"
    else
        echo "  (기존 프로세스 없음)"
    fi

    # 3. 포트 완전 해제 대기
    sleep 2

    # 4. 새 인스턴스 시작
    echo "  → 새 인스턴스 시작..."
    $GUNICORN_BIN -c "$CONFIG" app:app --daemon 2>&1

    # 5. 헬스체크 (연속 5회 성공 필요)
    echo -n "  → 헬스체크 (연속 5회 성공 필요) "
    if health_check $PORT; then
        echo ""
        local NEW_PID=$(check_instance $PORT)
        echo -e "  ${GREEN}✓ 새 인스턴스 정상 (PID: $NEW_PID)${NC}"
        return 0
    else
        echo ""
        echo -e "  ${RED}✗ 시작 실패!${NC}"
        echo "  로그: tail -100 $LOG_DIR/error_${PORT}.log"
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

# 프로그레스 바 출력
show_progress() {
    local SECONDS=$1
    local MSG=$2
    echo -n "$MSG "
    for i in $(seq 1 $SECONDS); do
        echo -n "▓"
        sleep 1
    done
    echo " 완료"
}

# 메인 로직
echo "현재 상태 확인..."
RUNNING_COUNT=$(count_running)
echo "  실행 중인 인스턴스: $RUNNING_COUNT/2"

for PORT in "${!INSTANCES[@]}"; do
    PID=$(check_instance $PORT)
    if [ -n "$PID" ]; then
        echo "    - 포트 $PORT: PID $PID"
    else
        echo "    - 포트 $PORT: 중지됨"
    fi
done
echo ""

# 초기 Nginx 상태 확인
echo -n "Nginx 로드밸런서 상태 확인"
if nginx_health_check; then
    echo -e " ${GREEN}✓ 정상${NC}"
else
    echo -e " ${YELLOW}⚠ 응답 없음 (계속 진행)${NC}"
fi
echo ""

# ========== 1단계: 5002 재시작 ==========
echo -e "${BLUE}=== 1단계: 인스턴스 5002 재시작 ===${NC}"
echo -e "${BLUE}    (5001이 모든 트래픽 처리)${NC}"
restart_instance 5002 5001
echo ""

# 안정화 대기
show_progress $STABILIZATION_WAIT "Nginx upstream 안정화 대기"
echo ""

# Nginx 헬스체크 (실패해도 계속 진행 - 인스턴스 직접 확인이 더 중요)
echo -n "로드밸런서 헬스체크"
if nginx_health_check; then
    echo -e " ${GREEN}✓ 정상${NC}"
else
    echo -e " ${YELLOW}⚠ 응답 없음 (인스턴스 직접 확인으로 대체)${NC}"
    # 5002가 살아있으면 계속 진행
    if check_instance 5002 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ 인스턴스 5002 직접 응답 확인됨${NC}"
    else
        echo -e "  ${RED}✗ 인스턴스 5002 응답 없음${NC}"
        exit 1
    fi
fi
echo ""

# ========== 2단계: 5001 재시작 ==========
echo -e "${BLUE}=== 2단계: 인스턴스 5001 재시작 ===${NC}"
echo -e "${BLUE}    (5002가 모든 트래픽 처리)${NC}"
restart_instance 5001 5002
echo ""

# 최종 안정화 대기
show_progress $STABILIZATION_WAIT "최종 안정화 대기"
echo ""

# 최종 Nginx 헬스체크
echo -n "최종 로드밸런서 헬스체크"
if nginx_health_check; then
    echo -e " ${GREEN}✓ 정상${NC}"
else
    echo -e " ${YELLOW}⚠ 응답 지연${NC}"
fi
echo ""

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
    echo "  tail -100 $LOG_DIR/error_5001.log"
    echo "  tail -100 $LOG_DIR/error_5002.log"
    exit 1
fi
echo "=========================================="
