@echo off
echo ====================================
echo Port Forwarding Setup (55 PC -> 99 PC)
echo ====================================
echo.

REM 기존 포트포워딩 규칙 삭제 (있을 경우)
echo [1/4] Removing existing port forwarding rules...
netsh interface portproxy delete v4tov4 listenport=5000 listenaddress=172.31.13.55 >nul 2>&1
netsh interface portproxy delete v4tov4 listenport=8501 listenaddress=172.31.13.55 >nul 2>&1
echo Done.
echo.

REM 새 포트포워딩 규칙 추가
echo [2/4] Adding port forwarding rules...
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=172.31.13.55 connectport=5000 connectaddress=172.31.13.99
netsh interface portproxy add v4tov4 listenport=8501 listenaddress=172.31.13.55 connectport=8501 connectaddress=172.31.13.99
echo Done.
echo.

REM 방화벽 규칙 추가
echo [3/4] Adding firewall rules...
netsh advfirewall firewall delete rule name="Port Forward 5000" >nul 2>&1
netsh advfirewall firewall delete rule name="Port Forward 8501" >nul 2>&1
netsh advfirewall firewall add rule name="Port Forward 5000" dir=in action=allow protocol=TCP localport=5000 >nul
netsh advfirewall firewall add rule name="Port Forward 8501" dir=in action=allow protocol=TCP localport=8501 >nul
echo Done.
echo.

REM 설정 확인
echo [4/4] Current port forwarding configuration:
echo ====================================
netsh interface portproxy show all
echo.
echo ====================================
echo Setup completed successfully!
echo.
echo Access URLs:
echo - CRM App: http://172.31.13.55:5000
echo - Streamlit: http://172.31.13.55:8501
echo ====================================
pause
