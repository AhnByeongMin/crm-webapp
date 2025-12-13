/**
 * CRM 확장 키보드 단축키
 * 전역 및 페이지별 키보드 단축키를 지원합니다.
 *
 * 기본 단축키:
 * - "/" : 검색창 포커스
 * - "Esc" : 모달 닫기
 * - "?" : 도움말 모달 열기
 *
 * 네비게이션 (g + key):
 * - "g h" : 할일 페이지
 * - "g p" : 프로모션
 * - "g c" : 채팅
 * - "g r" : 내 예약
 * - "g m" : 마이페이지
 *
 * 작업:
 * - "n" : 새로 만들기
 * - "r" : 새로고침
 * - "d" : 다크모드 전환
 */

(function() {
    'use strict';

    // g + key 조합을 위한 상태
    let gPressed = false;
    let gTimeout = null;
    let shortcutsModalOpen = false;

    // 단축키 도움말 모달 스타일
    function addShortcutsStyles() {
        if (document.getElementById('keyboard-shortcuts-extended-styles')) return;

        const style = document.createElement('style');
        style.id = 'keyboard-shortcuts-extended-styles';
        style.textContent = `
            .shortcuts-help-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10002;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            }

            .shortcuts-help-modal.show {
                display: flex;
            }

            .shortcuts-help-content {
                background: white;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: shortcutsModalIn 0.3s ease;
            }

            @keyframes shortcutsModalIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .shortcuts-help-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #eee;
            }

            .shortcuts-help-header h2 {
                margin: 0;
                font-size: 20px;
                color: #333;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .shortcuts-help-close {
                background: none;
                border: none;
                font-size: 28px;
                color: #999;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }

            .shortcuts-help-close:hover {
                color: #333;
            }

            .shortcuts-help-body {
                padding: 20px 24px;
                overflow-y: auto;
                max-height: calc(80vh - 70px);
            }

            .shortcuts-section {
                margin-bottom: 24px;
            }

            .shortcuts-section:last-child {
                margin-bottom: 0;
            }

            .shortcuts-section h3 {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #667eea;
                margin: 0 0 12px 0;
                font-weight: 600;
            }

            .shortcuts-grid {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .shortcut-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .shortcut-keys {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .shortcut-keys kbd {
                display: inline-block;
                padding: 4px 8px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                color: #333;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                min-width: 24px;
                text-align: center;
            }

            .shortcut-keys .then {
                color: #999;
                font-size: 11px;
            }

            .shortcut-description {
                color: #666;
                font-size: 14px;
            }

            /* 다크모드 */
            [data-theme="dark"] .shortcuts-help-content {
                background: #1e1e1e;
            }

            [data-theme="dark"] .shortcuts-help-header {
                border-bottom-color: #333;
            }

            [data-theme="dark"] .shortcuts-help-header h2 {
                color: #e0e0e0;
            }

            [data-theme="dark"] .shortcuts-help-close {
                color: #666;
            }

            [data-theme="dark"] .shortcuts-help-close:hover {
                color: #e0e0e0;
            }

            [data-theme="dark"] .shortcut-row {
                background: #2d2d2d;
            }

            [data-theme="dark"] .shortcut-keys kbd {
                background: #1e1e1e;
                border-color: #444;
                color: #e0e0e0;
            }

            [data-theme="dark"] .shortcut-description {
                color: #999;
            }

            /* 모바일에서는 숨김 */
            @media (max-width: 768px) {
                .shortcuts-help-modal {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 단축키 도움말 모달 표시
    function showShortcutsHelpModal() {
        if (shortcutsModalOpen) return;

        addShortcutsStyles();

        let modal = document.getElementById('shortcuts-help-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shortcuts-help-modal';
            modal.className = 'shortcuts-help-modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="shortcuts-help-content">
                <div class="shortcuts-help-header">
                    <h2>⌨️ 키보드 단축키</h2>
                    <button class="shortcuts-help-close" onclick="closeShortcutsHelpModal()">×</button>
                </div>
                <div class="shortcuts-help-body">
                    <div class="shortcuts-section">
                        <h3>네비게이션</h3>
                        <div class="shortcuts-grid">
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>G</kbd> <span class="then">→</span> <kbd>H</kbd></div>
                                <div class="shortcut-description">할일 페이지</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>G</kbd> <span class="then">→</span> <kbd>P</kbd></div>
                                <div class="shortcut-description">프로모션 페이지</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>G</kbd> <span class="then">→</span> <kbd>C</kbd></div>
                                <div class="shortcut-description">채팅 페이지</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>G</kbd> <span class="then">→</span> <kbd>R</kbd></div>
                                <div class="shortcut-description">내 예약 페이지</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>G</kbd> <span class="then">→</span> <kbd>M</kbd></div>
                                <div class="shortcut-description">마이페이지</div>
                            </div>
                        </div>
                    </div>

                    <div class="shortcuts-section">
                        <h3>작업</h3>
                        <div class="shortcuts-grid">
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>/</kbd></div>
                                <div class="shortcut-description">검색창 포커스</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>N</kbd></div>
                                <div class="shortcut-description">새로 만들기</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>R</kbd></div>
                                <div class="shortcut-description">목록 새로고침</div>
                            </div>
                        </div>
                    </div>

                    <div class="shortcuts-section">
                        <h3>설정</h3>
                        <div class="shortcuts-grid">
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>D</kbd></div>
                                <div class="shortcut-description">다크모드 전환</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>T</kbd></div>
                                <div class="shortcut-description">튜토리얼 다시보기</div>
                            </div>
                        </div>
                    </div>

                    <div class="shortcuts-section">
                        <h3>일반</h3>
                        <div class="shortcuts-grid">
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>?</kbd></div>
                                <div class="shortcut-description">이 도움말 표시</div>
                            </div>
                            <div class="shortcut-row">
                                <div class="shortcut-keys"><kbd>Esc</kbd></div>
                                <div class="shortcut-description">모달/도움말 닫기</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('show');
        shortcutsModalOpen = true;
    }

    // 단축키 도움말 모달 닫기
    window.closeShortcutsHelpModal = function() {
        const modal = document.getElementById('shortcuts-help-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        shortcutsModalOpen = false;
    };

    // 메인 키 이벤트 핸들러
    document.addEventListener('keydown', function(e) {
        // 입력 필드에서는 단축키 비활성화 (Esc 제외)
        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) ||
                               document.activeElement.isContentEditable;

        // Esc: 모달 닫기
        if (e.key === 'Escape') {
            // 단축키 도움말 닫기
            if (shortcutsModalOpen) {
                closeShortcutsHelpModal();
                e.preventDefault();
                return;
            }

            // 열려있는 모달 찾기 (우선순위: 가장 위에 있는 모달)
            const modals = [
                { id: 'helpModal', close: 'closeHelpModal' },
                { id: 'todayRemindersModal', close: 'closeTodayRemindersModal' },
                { id: 'editModal', close: 'closeEditModal' },
                { id: 'bulkUploadModal', close: 'closeBulkUploadModal' },
                { id: 'reminderModal', close: 'closeReminderModal' },
                { id: 'modalOverlay', close: 'closeModal' },
                { id: 'notificationSettingsModal', close: 'closeNotificationSettingsModal' },
                { id: 'addModal', close: 'closeAddModal' },
                { id: 'imageModal', close: null }
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

        // 모달이 열려있으면 무시
        if (shortcutsModalOpen) return;

        // g 키 조합 처리
        if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
            gPressed = true;
            clearTimeout(gTimeout);
            gTimeout = setTimeout(() => {
                gPressed = false;
            }, 1500);
            return;
        }

        // g + key 네비게이션
        if (gPressed) {
            const key = e.key.toLowerCase();
            let navigated = false;

            switch (key) {
                case 'h':
                    window.location.href = '/';
                    navigated = true;
                    break;
                case 'p':
                    window.location.href = '/promotions';
                    navigated = true;
                    break;
                case 'c':
                    window.location.href = '/chats';
                    navigated = true;
                    break;
                case 'r':
                    window.location.href = '/reminders';
                    navigated = true;
                    break;
                case 'm':
                    window.location.href = '/mypage';
                    navigated = true;
                    break;
                case 'u':
                    window.location.href = '/users';
                    navigated = true;
                    break;
                case 'a':
                    window.location.href = '/admin';
                    navigated = true;
                    break;
            }

            if (navigated) {
                e.preventDefault();
            }
            gPressed = false;
            clearTimeout(gTimeout);
            return;
        }

        // "/" : 검색창 포커스
        if (e.key === '/') {
            const searchInputs = [
                'searchInput',
                'searchKeyword',
                'searchInputMobile',
                'chatSearchInput'
            ];

            for (const id of searchInputs) {
                const input = document.getElementById(id);
                if (input && input.offsetParent !== null) {
                    input.focus();
                    input.select();
                    e.preventDefault();
                    return;
                }
            }

            // placeholder로 검색 필드 찾기
            const searchByPlaceholder = document.querySelector('input[placeholder*="검색"]');
            if (searchByPlaceholder && searchByPlaceholder.offsetParent !== null) {
                searchByPlaceholder.focus();
                searchByPlaceholder.select();
                e.preventDefault();
                return;
            }
        }

        // "?" (Shift + /) : 도움말 모달 열기
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            showShortcutsHelpModal();
            e.preventDefault();
            return;
        }

        // "n" : 새로 만들기
        if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
            const path = window.location.pathname;

            if (path.includes('/chats')) {
                window.location.href = '/chat/create';
                e.preventDefault();
            } else if (path.includes('/reminders')) {
                const addBtn = document.getElementById('addReminderBtn');
                if (addBtn) {
                    addBtn.click();
                    e.preventDefault();
                }
            } else if (path.includes('/promotions')) {
                const addBtn = document.querySelector('[onclick*="openAddModal"]');
                if (addBtn) {
                    addBtn.click();
                    e.preventDefault();
                }
            } else if (path.includes('/users')) {
                const addBtn = document.getElementById('addUserBtn');
                if (addBtn) {
                    addBtn.click();
                    e.preventDefault();
                }
            }
            return;
        }

        // "r" : 새로고침
        if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
            if (typeof loadChats === 'function') {
                loadChats();
                if (window.toast) toast.info('채팅 목록을 새로고침했습니다');
            } else if (typeof loadReminders === 'function') {
                loadReminders();
                if (window.toast) toast.info('예약 목록을 새로고침했습니다');
            } else if (typeof loadPromotions === 'function') {
                loadPromotions();
                if (window.toast) toast.info('프로모션 목록을 새로고침했습니다');
            } else if (typeof loadUsers === 'function') {
                loadUsers();
                if (window.toast) toast.info('사용자 목록을 새로고침했습니다');
            }
            e.preventDefault();
            return;
        }

        // "d" : 다크모드 전환
        if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
            if (typeof headerToggleDarkMode === 'function') {
                headerToggleDarkMode();
                e.preventDefault();
            }
            return;
        }

        // "t" : 튜토리얼 다시보기
        if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
            if (typeof restartTutorial === 'function') {
                restartTutorial();
                e.preventDefault();
            }
            return;
        }
    });
})();

// 단축키 도움말 툴팁 (선택적 - 첫 방문 시 표시)
function showShortcutHint() {
    // 이미 표시한 적 있으면 무시
    if (localStorage.getItem('crm_shortcuts_hint_shown')) return;

    const hint = document.createElement('div');
    hint.id = 'shortcutHint';
    hint.innerHTML = `
        <div style="position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.85); color: white; padding: 16px 20px; border-radius: 12px; font-size: 14px; z-index: 9999; animation: fadeIn 0.3s; max-width: 280px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <div style="font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                ⌨️ 키보드 단축키 지원
            </div>
            <div style="line-height: 1.6; color: #ccc;">
                <kbd style="background: #555; padding: 2px 8px; border-radius: 4px; margin-right: 8px; font-family: monospace;">?</kbd> 를 눌러 단축키 목록을 확인하세요
            </div>
            <button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('crm_shortcuts_hint_shown', 'true');"
                    style="position: absolute; top: 8px; right: 10px; background: none; border: none; color: #888; cursor: pointer; font-size: 18px;">×</button>
        </div>
    `;
    document.body.appendChild(hint);

    setTimeout(() => {
        if (hint.parentElement) {
            hint.style.opacity = '0';
            hint.style.transition = 'opacity 0.5s';
            setTimeout(() => hint.remove(), 500);
            localStorage.setItem('crm_shortcuts_hint_shown', 'true');
        }
    }, 8000);
}

// 페이지 로드 후 힌트 표시 (데스크탑에서만)
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth > 768) {
        setTimeout(showShortcutHint, 3000);
    }
});
