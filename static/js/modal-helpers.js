/**
 * 모달 헬퍼 함수 - body 스크롤 제어 포함
 */

// 도움말 모달 열기
function openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// 도움말 모달 닫기
function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 당일 예약 모달 열기
function openTodayRemindersModal() {
    const modal = document.getElementById('todayRemindersModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (typeof loadTodayReminders === 'function') {
            loadTodayReminders();
        }
    }
}

// 당일 예약 모달 닫기
function closeTodayRemindersModal() {
    const modal = document.getElementById('todayRemindersModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 모달 외부 클릭 시 닫기 이벤트 등록
document.addEventListener('DOMContentLoaded', () => {
    // 도움말 모달
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                closeHelpModal();
            }
        });
    }

    // 당일 예약 모달
    const todayRemindersModal = document.getElementById('todayRemindersModal');
    if (todayRemindersModal) {
        todayRemindersModal.addEventListener('click', (e) => {
            if (e.target === todayRemindersModal) {
                closeTodayRemindersModal();
            }
        });
    }
});
