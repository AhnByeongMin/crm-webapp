@echo off
echo ========================================
echo CRM ���� ���� �׽�Ʈ
echo ========================================
echo.

echo [1/4] IP �ּ� Ȯ��
ipconfig | findstr IPv4

echo.
echo [2/4] 99 PC�� Ping �׽�Ʈ
ping 172.31.13.99 -n 2

echo.
echo [3/4] 55 PC�� Ping �׽�Ʈ
ping 172.31.13.55 -n 2

echo.
echo [4/4] �����ͷ� Ping �׽�Ʈ
ping 172.31.13.1 -n 2

echo.
echo ========================================
echo �׽�Ʈ �Ϸ�
echo ========================================
pause
