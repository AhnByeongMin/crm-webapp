/**
 * 전체 화면 모드 지원
 * Fullscreen API 및 집중 모드
 */

(function() {
    'use strict';

    // Fullscreen API 호환성
    const fullscreenApi = {
        request: document.documentElement.requestFullscreen ||
                 document.documentElement.webkitRequestFullscreen ||
                 document.documentElement.mozRequestFullScreen ||
                 document.documentElement.msRequestFullscreen,
        exit: document.exitFullscreen ||
              document.webkitExitFullscreen ||
              document.mozCancelFullScreen ||
              document.msExitFullscreen,
        element: () => document.fullscreenElement ||
                       document.webkitFullscreenElement ||
                       document.mozFullScreenElement ||
                       document.msFullscreenElement,
        enabled: document.fullscreenEnabled ||
                 document.webkitFullscreenEnabled ||
                 document.mozFullScreenEnabled ||
                 document.msFullscreenEnabled
    };

    // 상태
    let focusMode = false;
    let originalStyles = new Map();

    /**
     * 전체 화면 전환
     */
    function toggleFullscreen(element = document.documentElement) {
        if (isFullscreen()) {
            exitFullscreen();
        } else {
            enterFullscreen(element);
        }
    }

    /**
     * 전체 화면 진입
     */
    async function enterFullscreen(element = document.documentElement) {
        if (!fullscreenApi.enabled) {
            if (window.toast) {
                toast.warning('이 브라우저는 전체 화면을 지원하지 않습니다.');
            }
            return false;
        }

        try {
            const requestFn = element.requestFullscreen ||
                              element.webkitRequestFullscreen ||
                              element.mozRequestFullScreen ||
                              element.msRequestFullscreen;

            if (requestFn) {
                await requestFn.call(element);
                return true;
            }
        } catch (error) {
            console.error('[Fullscreen] Enter failed:', error);
        }

        return false;
    }

    /**
     * 전체 화면 종료
     */
    async function exitFullscreen() {
        try {
            const exitFn = document.exitFullscreen ||
                           document.webkitExitFullscreen ||
                           document.mozCancelFullScreen ||
                           document.msExitFullscreen;

            if (exitFn) {
                await exitFn.call(document);
                return true;
            }
        } catch (error) {
            console.error('[Fullscreen] Exit failed:', error);
        }

        return false;
    }

    /**
     * 전체 화면 상태 확인
     */
    function isFullscreen() {
        return !!fullscreenApi.element();
    }

    /**
     * 집중 모드 토글
     */
    function toggleFocusMode(target) {
        if (focusMode) {
            exitFocusMode();
        } else {
            enterFocusMode(target);
        }
    }

    /**
     * 집중 모드 진입
     */
    function enterFocusMode(target) {
        if (!target) return;

        focusMode = true;
        document.body.classList.add('focus-mode');

        // 타겟 요소 하이라이트
        target.classList.add('focus-target');

        // 다른 요소들 흐리게
        document.querySelectorAll('body > *:not(.focus-overlay):not(#focusModeBackdrop)').forEach(el => {
            if (el !== target && !el.contains(target) && !target.contains(el)) {
                originalStyles.set(el, {
                    opacity: el.style.opacity,
                    pointerEvents: el.style.pointerEvents
                });
                el.style.opacity = '0.3';
                el.style.pointerEvents = 'none';
            }
        });

        // 배경 오버레이
        const backdrop = document.createElement('div');
        backdrop.id = 'focusModeBackdrop';
        backdrop.className = 'focus-mode-backdrop';
        backdrop.onclick = exitFocusMode;
        document.body.appendChild(backdrop);

        // ESC 키로 종료
        document.addEventListener('keydown', handleFocusModeEsc);

        // 종료 버튼 추가
        const exitBtn = document.createElement('button');
        exitBtn.id = 'focusModeExit';
        exitBtn.className = 'focus-mode-exit';
        exitBtn.innerHTML = '✕ 집중 모드 종료';
        exitBtn.onclick = exitFocusMode;
        document.body.appendChild(exitBtn);

        if (window.toast) {
            toast.info('집중 모드 - ESC로 종료', { duration: 2000 });
        }
    }

    /**
     * 집중 모드 종료
     */
    function exitFocusMode() {
        if (!focusMode) return;

        focusMode = false;
        document.body.classList.remove('focus-mode');

        // 타겟 하이라이트 제거
        document.querySelectorAll('.focus-target').forEach(el => {
            el.classList.remove('focus-target');
        });

        // 원래 스타일 복원
        originalStyles.forEach((styles, el) => {
            el.style.opacity = styles.opacity;
            el.style.pointerEvents = styles.pointerEvents;
        });
        originalStyles.clear();

        // 배경 제거
        const backdrop = document.getElementById('focusModeBackdrop');
        if (backdrop) backdrop.remove();

        // 종료 버튼 제거
        const exitBtn = document.getElementById('focusModeExit');
        if (exitBtn) exitBtn.remove();

        document.removeEventListener('keydown', handleFocusModeEsc);
    }

    /**
     * ESC 키 핸들러
     */
    function handleFocusModeEsc(e) {
        if (e.key === 'Escape' && focusMode) {
            exitFocusMode();
        }
    }

    /**
     * 화면 고정 (스크롤 방지)
     */
    function lockScreen() {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }

    /**
     * 화면 고정 해제
     */
    function unlockScreen() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }

    /**
     * Picture-in-Picture 지원 (비디오용)
     */
    async function enterPiP(videoElement) {
        if (!document.pictureInPictureEnabled) {
            if (window.toast) {
                toast.warning('PIP 모드를 지원하지 않습니다.');
            }
            return false;
        }

        try {
            await videoElement.requestPictureInPicture();
            return true;
        } catch (error) {
            console.error('[PiP] Enter failed:', error);
            return false;
        }
    }

    /**
     * Picture-in-Picture 종료
     */
    async function exitPiP() {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        }
    }

    /**
     * 전체 화면 버튼 자동 설정
     */
    function autoSetup() {
        // 전체 화면 버튼
        document.querySelectorAll('[data-fullscreen]').forEach(btn => {
            if (btn.dataset.fullscreenSetup) return;

            btn.addEventListener('click', () => {
                const targetSelector = btn.dataset.fullscreen;
                const target = targetSelector === 'document'
                    ? document.documentElement
                    : document.querySelector(targetSelector);

                if (target) {
                    toggleFullscreen(target);
                }
            });

            btn.dataset.fullscreenSetup = 'true';
        });

        // 집중 모드 버튼
        document.querySelectorAll('[data-focus]').forEach(btn => {
            if (btn.dataset.focusSetup) return;

            btn.addEventListener('click', () => {
                const targetSelector = btn.dataset.focus;
                const target = document.querySelector(targetSelector);

                if (target) {
                    toggleFocusMode(target);
                }
            });

            btn.dataset.focusSetup = 'true';
        });
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('fullscreen-styles')) return;

        const style = document.createElement('style');
        style.id = 'fullscreen-styles';
        style.textContent = `
            /* 전체 화면 스타일 */
            :fullscreen {
                background: white;
            }

            :-webkit-full-screen {
                background: white;
            }

            :-moz-full-screen {
                background: white;
            }

            :-ms-fullscreen {
                background: white;
            }

            [data-theme="dark"]:fullscreen,
            [data-theme="dark"]:-webkit-full-screen {
                background: #1a1a1a;
            }

            /* 집중 모드 */
            .focus-mode-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9990;
                animation: fadeIn 0.3s ease;
            }

            .focus-target {
                position: relative;
                z-index: 9995 !important;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
            }

            .focus-mode-exit {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: none;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                transition: all 0.2s;
            }

            .focus-mode-exit:hover {
                background: #f0f0f0;
                transform: scale(1.05);
            }

            /* 전체 화면 버튼 스타일 */
            .fullscreen-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                font-size: 18px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .fullscreen-btn:hover {
                opacity: 1;
            }

            /* 전체 화면 토글 표시 */
            .fullscreen-btn::before {
                content: '⛶';
            }

            :fullscreen .fullscreen-btn::before,
            :-webkit-full-screen .fullscreen-btn::before {
                content: '⛶';
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            /* 다크모드 */
            [data-theme="dark"] .focus-mode-exit {
                background: #2d2d2d;
                color: #e0e0e0;
            }

            [data-theme="dark"] .focus-mode-exit:hover {
                background: #404040;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 전체 화면 변경 이벤트 리스너
     */
    function setupEventListeners() {
        const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];

        events.forEach(event => {
            document.addEventListener(event, () => {
                const isFs = isFullscreen();
                document.body.classList.toggle('is-fullscreen', isFs);

                // 커스텀 이벤트 발생
                window.dispatchEvent(new CustomEvent('fullscreenchange', {
                    detail: { isFullscreen: isFs }
                }));
            });
        });
    }

    // 초기화
    function init() {
        addStyles();
        setupEventListeners();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoSetup);
        } else {
            autoSetup();
        }

        // DOM 변경 감지
        const observer = new MutationObserver(autoSetup);
        observer.observe(document.body, { childList: true, subtree: true });

        // F11 키보드 단축키 (선택적)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
        });
    }

    init();

    // 전역 노출
    window.FullscreenMode = {
        isSupported: fullscreenApi.enabled,
        toggle: toggleFullscreen,
        enter: enterFullscreen,
        exit: exitFullscreen,
        isFullscreen,
        toggleFocus: toggleFocusMode,
        enterFocus: enterFocusMode,
        exitFocus: exitFocusMode,
        isFocusMode: () => focusMode,
        lockScreen,
        unlockScreen,
        enterPiP,
        exitPiP
    };
})();
