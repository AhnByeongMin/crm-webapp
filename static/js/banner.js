/**
 * 배너 알림 공통 모듈
 * - 중복 API 호출 제거
 * - Socket.IO를 통한 실시간 배너 업데이트
 */

// 배너 체크 함수 (전역으로 한 번만 호출)
async function checkTodayReminders() {
    try {
        const response = await fetch('/api/reminders/banner-check');
        const data = await response.json();

        updateBanner(data);
    } catch (error) {
        console.log('예약 체크 실패:', error);
    }
}

// 배너 업데이트 함수
function updateBanner(data) {
    const banner = document.getElementById('reminderBanner');
    const bannerText = document.getElementById('bannerText');

    if (!banner || !bannerText) return;

    if (data.has_reminders) {
        // 배너 메시지 구성
        let message = '';
        if (data.overdue_count > 0 && data.today_count > 0) {
            message = `⚠️ 지난 예약 ${data.overdue_count}건, 오늘 예약 ${data.today_count}건이 있습니다!`;
        } else if (data.overdue_count > 0) {
            message = `⚠️ 지난 예약 ${data.overdue_count}건이 있습니다!`;
        } else {
            message = `오늘 예약 ${data.today_count}건이 있습니다!`;
        }

        bannerText.textContent = message;
        banner.classList.add('show');
        document.body.classList.add('has-banner');
    } else {
        // 배너 숨김
        banner.classList.remove('show');
        document.body.classList.remove('has-banner');
    }
}

// 배너 닫기 함수
function closeBanner() {
    const banner = document.getElementById('reminderBanner');
    if (banner) {
        banner.classList.remove('show');
        document.body.classList.remove('has-banner');
    }
}

// Socket.IO 이벤트 리스너 (Socket.IO 연결이 있는 경우에만)
if (typeof socket !== 'undefined') {
    // 예약 변경 이벤트 수신 (생성, 완료, 삭제)
    socket.on('reminder_created', () => {
        checkTodayReminders();
    });

    socket.on('reminder_completed', () => {
        checkTodayReminders();
    });

    socket.on('reminder_deleted', () => {
        checkTodayReminders();
    });
}

// 페이지 로드 시 한 번만 체크
document.addEventListener('DOMContentLoaded', () => {
    checkTodayReminders();
});
