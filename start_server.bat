@echo off
echo ========================================
echo Flask CRM 서버 자동 시작
echo ========================================

REM 중복 실행 방지 - 이미 실행 중인지 확인
echo.
echo [0/4] 기존 서버 확인 중...
tasklist | findstr /I "python.*app.py" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 서버가 이미 실행 중입니다
    echo 종료합니다...
    exit /b 0
)
echo ✓ 서버 실행 가능

REM 방화벽 규칙 추가 (관리자 권한 필요)
echo.
echo [1/4] 방화벽 규칙 확인 중...
netsh advfirewall firewall show rule name="Flask CRM App" >nul 2>&1
if %errorlevel% neq 0 (
    echo 방화벽 규칙이 없습니다. 추가 중...
    netsh advfirewall firewall add rule name="Flask CRM App" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✓ 방화벽 규칙 추가 완료
    ) else (
        echo ✗ 방화벽 규칙 추가 실패 (관리자 권한 필요)
    )
) else (
    echo ✓ 방화벽 규칙 이미 존재
)

REM CRM 디렉토리로 이동
echo.
echo [2/4] 작업 디렉토리로 이동 중...
cd /d "c:\Users\User\Desktop\crm"
if %errorlevel% equ 0 (
    echo ✓ 디렉토리 이동 완료: %cd%
) else (
    echo ✗ 디렉토리 이동 실패
    pause
    exit /b 1
)

REM Flask 서버 시작
echo.
echo [3/4] 모든 기존 Python 프로세스 종료 중...
python kill_python.py >nul 2>&1
echo ✓ 기존 프로세스 정리 완료

echo.
echo [4/4] Flask 서버 시작 중...
echo 서버 주소: http://172.31.13.99:5000
echo 종료하려면 Ctrl+C 를 누르세요
echo ========================================
echo.
python app.py

pause
