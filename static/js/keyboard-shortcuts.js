/**
 * 공통 키보드 단축키
 * - "/" : 검색창 포커스
 * - "Esc" : 모달 닫기
 * - "?" : 도움말 모달 열기
 */

document.addEventListener('keydown', function(e) {
    // 입력 필드에서는 단축키 비활성화 (Esc 제외)
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    // Esc: 모달 닫기
    if (e.key === 'Escape') {
        // 열려있는 모달 찾기 (우선순위: 가장 위에 있는 모달)
        const modals = [
            { id: 'helpModal', close: 'closeHelpModal' },
            { id: 'todayRemindersModal', close: 'closeTodayRemindersModal' },
            { id: 'editModal', close: 'closeEditModal' },
            { id: 'bulkUploadModal', close: 'closeBulkUploadModal' },
            { id: 'reminderModal', close: 'closeReminderModal' },
            { id: 'modalOverlay', close: 'closeModal' },
            { id: 'notificationSettingsModal', close: 'closeNotificationSettingsModal' },
            { id: 'imageModal', close: null } // 클릭으로 닫힘
        ];

        for (const modal of modals) {
            const el = document.getElementById(modal.id);
            if (el && (el.classList.contains('active') || el.style.display === 'flex' || el.style.display === 'block')) {
                if (modal.close && typeof window[modal.close] === 'function') {
                    window[modal.close]();
                } else if (modal.id === 'imageModal') {
                    el.style.display = 'none';
                } else {
                    el.classList.remove('active');
                    document.body.style.overflow = '';
                }
                e.preventDefault();
                return;
            }
        }

        // 검색창에서 Esc 누르면 포커스 해제
        if (isInputFocused) {
            document.activeElement.blur();
            e.preventDefault();
        }
        return;
    }

    // 입력 필드에서는 다른 단축키 무시
    if (isInputFocused) return;

    // "/" : 검색창 포커스
    if (e.key === '/') {
        const searchInputs = [
            'searchInput',
            'searchInputMobile',
            'chatSearchInput'
        ];

        for (const id of searchInputs) {
            const input = document.getElementById(id);
            if (input && input.offsetParent !== null) { // 보이는 요소인지 확인
                input.focus();
                input.select();
                e.preventDefault();
                return;
            }
        }
    }

    // "?" (Shift + /) : 도움말 모달 열기
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (typeof openHelpModal === 'function') {
            openHelpModal();
            e.preventDefault();
        }
    }
});

// 단축키 도움말 툴팁 (선택적)
function showShortcutHint() {
    const hint = document.createElement('div');
    hint.id = 'shortcutHint';
    hint.innerHTML = `
        <div style="position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 12px 16px; border-radius: 8px; font-size: 13px; z-index: 9999; animation: fadeIn 0.3s;">
            <div style="font-weight: bold; margin-bottom: 8px;">키보드 단축키</div>
            <div><kbd style="background: #555; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">/</kbd> 검색</div>
            <div><kbd style="background: #555; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">?</kbd> 도움말</div>
            <div><kbd style="background: #555; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Esc</kbd> 닫기</div>
        </div>
    `;
    document.body.appendChild(hint);

    setTimeout(() => {
        hint.style.opacity = '0';
        hint.style.transition = 'opacity 0.3s';
        setTimeout(() => hint.remove(), 300);
    }, 3000);
}
