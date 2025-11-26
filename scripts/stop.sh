#!/bin/bash
#
# CRM 웹앱 중지 스크립트 (5000번 포트만 안전하게 종료)
# 다른 포트의 서비스는 절대 건드리지 않음
#

set -e

PORT=5000
APP_DIR="/svc/was/crm/crm-webapp"

echo "=========================================="
echo "CRM 웹앱 중지 (포트 $PORT)"
echo "=========================================="

# 1. 5000번 포트를 사용하는 PID 찾기
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    echo "✓ 포트 $PORT 에서 실행 중인 프로세스가 없습니다."
    exit 0
fi

echo "발견된 PID: $PIDS"

# 2. 각 PID에 대해 프로세스 정보 출력 및 확인
for PID in $PIDS; do
    if ps -p $PID > /dev/null 2>&1; then
        CMDLINE=$(ps -p $PID -o cmd= 2>/dev/null || echo "unknown")
        echo ""
        echo "PID $PID 정보:"
        echo "  명령어: $CMDLINE"

        # gunicorn 또는 python app.py인지 확인
        if echo "$CMDLINE" | grep -qE "(gunicorn|python.*app\.py)"; then
            echo "  → CRM 웹앱 프로세스로 확인됨"

            # SIGTERM으로 정상 종료 시도
            echo "  → SIGTERM 전송 (정상 종료 시도)..."
            kill -TERM $PID 2>/dev/null || true

            # 최대 10초 대기
            TIMEOUT=10
            COUNT=0
            while ps -p $PID > /dev/null 2>&1 && [ $COUNT -lt $TIMEOUT ]; do
                sleep 1
                COUNT=$((COUNT + 1))
                echo -n "."
            done
            echo ""

            # 아직 살아있으면 SIGKILL
            if ps -p $PID > /dev/null 2>&1; then
                echo "  → 정상 종료 실패, SIGKILL 전송..."
                kill -9 $PID 2>/dev/null || true
                sleep 1
            fi

            # 최종 확인
            if ps -p $PID > /dev/null 2>&1; then
                echo "  ✗ PID $PID 종료 실패!"
            else
                echo "  ✓ PID $PID 종료 완료"
            fi
        else
            echo "  ✗ 경고: CRM 웹앱이 아닌 다른 프로세스가 포트 $PORT 사용 중!"
            echo "  ✗ 수동으로 확인 필요: $CMDLINE"
        fi
    fi
done

echo ""
echo "=========================================="

# 3. 최종 포트 확인
REMAINING=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -z "$REMAINING" ]; then
    echo "✓ 포트 $PORT 정리 완료"
    exit 0
else
    echo "✗ 경고: 포트 $PORT 에 프로세스가 남아있음 (PID: $REMAINING)"
    exit 1
fi
