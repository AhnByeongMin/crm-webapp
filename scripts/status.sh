#!/bin/bash
#
# CRM 웹앱 상태 확인 스크립트 (이중 인스턴스)
#

APP_DIR="/svc/was/crm/crm-webapp"
LOG_DIR="$APP_DIR/logs"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 인스턴스 정보
PORTS=(5001 5002)

echo "=========================================="
echo "CRM 웹앱 상태 (이중 인스턴스)"
echo "=========================================="
echo ""

# 인스턴스 상태 확인
RUNNING_COUNT=0
echo -e "${CYAN}[인스턴스 상태]${NC}"
for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti :$PORT 2>/dev/null | head -1 || true)
    if [ -n "$PID" ]; then
        # 프로세스 정보 가져오기
        INFO=$(ps -p $PID -o %cpu,%mem,etime --no-headers 2>/dev/null || echo "- - -")
        CPU=$(echo $INFO | awk '{print $1}')
        MEM=$(echo $INFO | awk '{print $2}')
        UPTIME=$(echo $INFO | awk '{print $3}')

        echo -e "  포트 $PORT: ${GREEN}✓ 실행 중${NC}"
        echo "    PID: $PID | CPU: ${CPU}% | MEM: ${MEM}% | Uptime: $UPTIME"
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
    else
        echo -e "  포트 $PORT: ${RED}✗ 중지됨${NC}"
    fi
done

echo ""

# 전체 상태 판정
if [ $RUNNING_COUNT -eq 2 ]; then
    echo -e "전체 상태: ${GREEN}✓ 정상 (무중단 서비스 가능)${NC}"
elif [ $RUNNING_COUNT -eq 1 ]; then
    echo -e "전체 상태: ${YELLOW}⚠ 주의 (1개만 실행 중 - 무중단 불가)${NC}"
else
    echo -e "전체 상태: ${RED}✗ 중지됨${NC}"
fi

echo ""

# Redis 상태
echo -e "${CYAN}[Redis 상태]${NC}"
if redis-cli ping > /dev/null 2>&1; then
    REDIS_CLIENTS=$(redis-cli info clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r')
    echo -e "  ${GREEN}✓ 연결됨${NC} (클라이언트: ${REDIS_CLIENTS}개)"
else
    echo -e "  ${RED}✗ 연결 실패${NC}"
fi

echo ""

# Nginx upstream 상태
echo -e "${CYAN}[Nginx 상태]${NC}"
if pgrep nginx > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ 실행 중${NC}"

    # upstream 연결 테스트
    for PORT in "${PORTS[@]}"; do
        if curl -s --max-time 2 "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
            echo -e "    → 127.0.0.1:$PORT ${GREEN}응답${NC}"
        else
            echo -e "    → 127.0.0.1:$PORT ${RED}무응답${NC}"
        fi
    done
else
    echo -e "  ${RED}✗ 중지됨${NC}"
fi

echo ""

# 네트워크 연결
echo -e "${CYAN}[활성 연결]${NC}"
CONN_5001=$(ss -tn 2>/dev/null | grep ":5001 " | wc -l)
CONN_5002=$(ss -tn 2>/dev/null | grep ":5002 " | wc -l)
CONN_5000=$(ss -tn 2>/dev/null | grep ":5000 " | wc -l)
echo "  포트 5000 (Nginx): $CONN_5000 개"
echo "  포트 5001: $CONN_5001 개"
echo "  포트 5002: $CONN_5002 개"

echo ""

# 최근 에러 로그
echo -e "${CYAN}[최근 에러]${NC}"
ERROR_COUNT=0
for PORT in "${PORTS[@]}"; do
    ERROR_FILE="$LOG_DIR/error_${PORT}.log"
    if [ -f "$ERROR_FILE" ]; then
        RECENT=$(tail -100 "$ERROR_FILE" 2>/dev/null | grep -iE "(error|exception|critical)" | wc -l)
        ERROR_COUNT=$((ERROR_COUNT + RECENT))
    fi
done

if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "  ${YELLOW}최근 100줄 내 에러: $ERROR_COUNT 건${NC}"
    echo "  확인: tail -50 $LOG_DIR/error_5001.log"
else
    echo -e "  ${GREEN}최근 에러 없음${NC}"
fi

echo ""
echo "=========================================="
echo "관리 명령어:"
echo "  시작:   $APP_DIR/scripts/start.sh"
echo "  중지:   $APP_DIR/scripts/stop.sh"
echo "  재시작: $APP_DIR/scripts/restart.sh"
echo "=========================================="
