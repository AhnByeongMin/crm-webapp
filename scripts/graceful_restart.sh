#!/bin/bash
# CRM 웹앱 새벽 자동 Graceful Restart 스크립트
# 목적: max_requests 도달 전 미리 워커를 갱신하여 사용자 영향 최소화
# 주의: 오직 CRM 웹앱(5001, 5002 포트)만 대상으로 함

LOG_FILE="/svc/was/crm/crm-webapp/logs/restart.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
SCRIPT_DIR="/svc/was/crm/crm-webapp"

echo "[$DATE] === Graceful Restart 시작 ===" >> $LOG_FILE

# 안전 체크: 스크립트 디렉토리 확인
if [ ! -d "$SCRIPT_DIR" ]; then
    echo "[$DATE] 오류: CRM 웹앱 디렉토리가 없음 - 종료" >> $LOG_FILE
    exit 1
fi

# 5001 워커 재시작 (정확한 경로 패턴으로 검색)
PID_5001=$(pgrep -f "${SCRIPT_DIR}/gunicorn_config_5001.py" | head -1)
if [ -n "$PID_5001" ]; then
    # 추가 검증: 해당 PID가 실제로 gunicorn인지 확인
    PROC_NAME=$(ps -p $PID_5001 -o comm= 2>/dev/null)
    if [[ "$PROC_NAME" == *"python"* ]] || [[ "$PROC_NAME" == *"gunicorn"* ]]; then
        echo "[$DATE] 5001 마스터 PID: $PID_5001 ($PROC_NAME) - HUP 시그널 전송" >> $LOG_FILE
        kill -HUP $PID_5001
        echo "[$DATE] 5001 Graceful restart 완료" >> $LOG_FILE
    else
        echo "[$DATE] 경고: PID $PID_5001 은 gunicorn이 아님 ($PROC_NAME) - 건너뜀" >> $LOG_FILE
    fi
else
    echo "[$DATE] 경고: 5001 프로세스를 찾을 수 없음" >> $LOG_FILE
fi

# 5초 대기 (한 번에 둘 다 재시작하지 않도록)
sleep 5

# 5002 워커 재시작 (정확한 경로 패턴으로 검색)
PID_5002=$(pgrep -f "${SCRIPT_DIR}/gunicorn_config_5002.py" | head -1)
if [ -n "$PID_5002" ]; then
    # 추가 검증: 해당 PID가 실제로 gunicorn인지 확인
    PROC_NAME=$(ps -p $PID_5002 -o comm= 2>/dev/null)
    if [[ "$PROC_NAME" == *"python"* ]] || [[ "$PROC_NAME" == *"gunicorn"* ]]; then
        echo "[$DATE] 5002 마스터 PID: $PID_5002 ($PROC_NAME) - HUP 시그널 전송" >> $LOG_FILE
        kill -HUP $PID_5002
        echo "[$DATE] 5002 Graceful restart 완료" >> $LOG_FILE
    else
        echo "[$DATE] 경고: PID $PID_5002 은 gunicorn이 아님 ($PROC_NAME) - 건너뜀" >> $LOG_FILE
    fi
else
    echo "[$DATE] 경고: 5002 프로세스를 찾을 수 없음" >> $LOG_FILE
fi

echo "[$DATE] === Graceful Restart 종료 ===" >> $LOG_FILE
