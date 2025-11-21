@echo off
echo ====================================
echo Port Forwarding Complete Setup
echo (55 PC -> 99 PC)
echo ====================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges!
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM 기존 규칙 삭제
echo [1/6] Cleaning up existing rules...
netsh interface portproxy delete v4tov4 listenport=5000 listenaddress=172.31.13.55 >nul 2>&1
netsh interface portproxy delete v4tov4 listenport=8501 listenaddress=172.31.13.55 >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 5000" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 8501" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 5000 In" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 8501 In" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 5000 Out" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 8501 Out" >nul 2>&1
echo Done.
echo.

REM 포트포워딩 추가
echo [2/6] Adding port forwarding rules...
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=172.31.13.55 connectport=5000 connectaddress=172.31.13.99
netsh interface portproxy add v4tov4 listenport=8501 listenaddress=172.31.13.55 connectport=8501 connectaddress=172.31.13.99
echo Done.
echo.

REM 인바운드 방화벽 규칙 추가 (외부에서 55 PC로 들어오는 연결 허용)
echo [3/6] Adding inbound firewall rules...
netsh advfirewall firewall add rule name="Port Forward 5000 In" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="Port Forward 8501 In" dir=in action=allow protocol=TCP localport=8501
echo Done.
echo.

REM 아웃바운드 방화벽 규칙 추가 (55 PC에서 99 PC로 나가는 연결 허용)
echo [4/6] Adding outbound firewall rules...
netsh advfirewall firewall add rule name="Port Forward 5000 Out" dir=out action=allow protocol=TCP remoteport=5000 remoteip=172.31.13.99
netsh advfirewall firewall add rule name="Port Forward 8501 Out" dir=out action=allow protocol=TCP remoteport=8501 remoteip=172.31.13.99
echo Done.
echo.

REM IP 포워딩 활성화
echo [5/6] Enabling IP routing...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v IPEnableRouter /t REG_DWORD /d 1 /f >nul
echo Done.
echo.

REM 설정 확인
echo [6/6] Verifying configuration...
echo.
echo Current port forwarding rules:
echo ------------------------------------
netsh interface portproxy show all
echo.
echo ------------------------------------
echo.
echo Setup completed successfully!
echo.
echo IMPORTANT: IP routing has been enabled.
echo You may need to restart the computer for all changes to take effect.
echo.
echo Access URLs from other PCs:
echo - CRM App: http://172.31.13.55:5000
echo - Streamlit: http://172.31.13.55:8501
echo.
echo Direct access (from 99 PC):
echo - CRM App: http://172.31.13.99:5000
echo - Streamlit: http://172.31.13.99:8501
echo ====================================
pause
