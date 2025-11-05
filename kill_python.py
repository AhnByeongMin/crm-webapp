import os
import psutil

# 현재 프로세스 제외하고 모든 python3.12.exe 종료
current_pid = os.getpid()
killed = []

for proc in psutil.process_iter(['pid', 'name']):
    try:
        if 'python' in proc.info['name'].lower() and proc.info['pid'] != current_pid:
            proc.kill()  # SIGTERM 대신 kill() 사용
            killed.append(proc.info['pid'])
            print(f"종료: PID {proc.info['pid']}")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

print(f"총 {len(killed)}개 프로세스 종료됨")
