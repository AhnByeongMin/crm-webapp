@echo off
echo Flask CRM 방화벽 규칙 추가 중...
netsh advfirewall firewall add rule name="Flask CRM App" dir=in action=allow protocol=TCP localport=5000
if %errorlevel% equ 0 (
    echo 방화벽 규칙이 성공적으로 추가되었습니다!
    netsh advfirewall firewall show rule name="Flask CRM App"
) else (
    echo 오류: 관리자 권한으로 실행해주세요!
    echo 이 파일을 마우스 우클릭 후 "관리자 권한으로 실행"을 선택하세요.
)
pause
