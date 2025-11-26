#!/bin/bash
#
# CRM 웹앱 상태 확인 스크립트
#

PORT=5000
APP_DIR="/svc/was/crm/crm-webapp"

echo "=========================================="
echo "CRM 웹앱 상태 (포트 $PORT)"
echo "=========================================="
echo ""

# 1. 포트 사용 여부 확인
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    echo "상태: ✗ 중지됨"
    echo "포트 $PORT 에서 실행 중인 프로세스가 없습니다."
    echo ""
    echo "시작하려면: $APP_DIR/scripts/start.sh"
    exit 1
fi

echo "상태: ✓ 실행 중"
echo ""

# 2. 각 프로세스 정보 출력
echo "실행 중인 프로세스:"
for PID in $PIDS; do
    if ps -p $PID > /dev/null 2>&1; then
        echo ""
        echo "PID: $PID"
        ps -p $PID -o pid,ppid,user,%cpu,%mem,etime,cmd --no-headers | awk '{
            printf "  부모 PID: %s\n", $2
            printf "  사용자: %s\n", $3
            printf "  CPU: %s%%\n", $4
            printf "  메모리: %s%%\n", $5
            printf "  실행 시간: %s\n", $6
            printf "  명령어: "
            for(i=7; i<=NF; i++) printf "%s ", $i
            printf "\n"
        }'
    fi
done

# 3. 워커 프로세스 확인
echo ""
echo "Gunicorn 워커:"
WORKERS=$(pgrep -P $PIDS 2>/dev/null || true)
if [ -z "$WORKERS" ]; then
    echo "  (워커 정보 없음)"
else
    for WORKER_PID in $WORKERS; do
        if ps -p $WORKER_PID > /dev/null 2>&1; then
            ps -p $WORKER_PID -o pid,%cpu,%mem,cmd --no-headers | awk '{
                printf "  [%s] CPU: %s%%, MEM: %s%%\n", $1, $2, $3
            }'
        fi
    done
fi

# 4. 네트워크 연결 상태
echo ""
echo "네트워크 연결:"
netstat -tnp 2>/dev/null | grep ":$PORT " | awk '{print "  "$5" -> "$6}' | head -5
CONN_COUNT=$(netstat -tn 2>/dev/null | grep ":$PORT " | wc -l)
if [ $CONN_COUNT -gt 5 ]; then
    echo "  ... (총 $CONN_COUNT 개 연결)"
elif [ $CONN_COUNT -eq 0 ]; then
    echo "  (활성 연결 없음)"
fi

# 5. 최근 로그 (에러만)
if [ -f "$APP_DIR/logs/error.log" ]; then
    RECENT_ERRORS=$(tail -20 "$APP_DIR/logs/error.log" 2>/dev/null | grep -i error | wc -l)
    if [ $RECENT_ERRORS -gt 0 ]; then
        echo ""
        echo "⚠ 최근 에러 로그 ($RECENT_ERRORS 건):"
        tail -20 "$APP_DIR/logs/error.log" | grep -i error | tail -3
    fi
fi

echo ""
echo "=========================================="
echo "✓ 상태 확인 완료"
echo ""
echo "로그 확인: tail -f $APP_DIR/logs/access.log"
echo "중지: $APP_DIR/scripts/stop.sh"
echo "재시작: $APP_DIR/scripts/restart.sh"
echo "=========================================="
