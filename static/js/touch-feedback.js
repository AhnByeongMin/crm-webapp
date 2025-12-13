/**
 * 터치 피드백 및 접근성 개선 모듈
 * 모바일 터치 반응 개선 및 키보드 접근성 향상
 */

(function() {
    'use strict';

    // 터치 피드백 클래스
    const TOUCH_ACTIVE_CLASS = 'touch-active';

    // 스타일 추가
    function addStyles() {
        if (document.getElementById('touch-feedback-styles')) return;

        const style = document.createElement('style');
        style.id = 'touch-feedback-styles';
        style.textContent = `
            /* 터치 피드백 */
            .touch-active {
                opacity: 0.7 !important;
                transform: scale(0.98) !important;
            }

            /* 버튼, 링크 기본 터치 피드백 */
            button, a, .clickable, [role="button"] {
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            }

            button:active, a:active, .clickable:active, [role="button"]:active {
                opacity: 0.8;
            }

            /* 포커스 표시 개선 (키보드 사용자용) */
            :focus-visible {
                outline: 2px solid #667eea !important;
                outline-offset: 2px !important;
            }

            /* 마우스 클릭 시 포커스 숨김 */
            :focus:not(:focus-visible) {
                outline: none;
            }

            /* 리플 효과 */
            .ripple-container {
                position: relative;
                overflow: hidden;
            }

            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.4);
                transform: scale(0);
                animation: ripple-effect 0.6s linear;
                pointer-events: none;
            }

            @keyframes ripple-effect {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }

            /* 스킵 네비게이션 (접근성) */
            .skip-nav {
                position: absolute;
                top: -100%;
                left: 0;
                background: #667eea;
                color: white;
                padding: 10px 20px;
                z-index: 10000;
                transition: top 0.2s;
                text-decoration: none;
                font-weight: bold;
            }

            .skip-nav:focus {
                top: 0;
            }

            /* 터치 스크롤 개선 */
            .smooth-scroll {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
            }

            /* 긴 터치 방지 (컨텍스트 메뉴) */
            .no-context-menu {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }

            /* 다크모드 포커스 */
            [data-theme="dark"] :focus-visible {
                outline-color: #8b9bff !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 터치 피드백 적용
    function applyTouchFeedback(element) {
        let touchStartTime = 0;

        element.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
            this.classList.add(TOUCH_ACTIVE_CLASS);
        }, { passive: true });

        element.addEventListener('touchend', function(e) {
            const touchDuration = Date.now() - touchStartTime;
            // 짧은 터치면 바로 제거, 긴 터치면 약간 지연
            const delay = touchDuration < 100 ? 0 : 100;

            setTimeout(() => {
                this.classList.remove(TOUCH_ACTIVE_CLASS);
            }, delay);
        }, { passive: true });

        element.addEventListener('touchcancel', function() {
            this.classList.remove(TOUCH_ACTIVE_CLASS);
        }, { passive: true });
    }

    // 리플 효과 추가
    function addRippleEffect(element) {
        element.classList.add('ripple-container');

        element.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    }

    // 키보드 접근성 개선
    function enhanceKeyboardAccessibility() {
        // Enter/Space로 클릭 가능한 요소 활성화
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target;

                if (target.matches('[role="button"], .clickable, .chat-item, .reminder-card')) {
                    e.preventDefault();
                    target.click();
                }
            }
        });

        // 모달 트랩 (모달 내에서만 Tab 이동)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal-overlay.active, .modal.show');
                if (modal) {
                    trapFocus(modal, e);
                }
            }

            // ESC로 모달 닫기
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal-overlay.active, .modal.show');
                if (modal) {
                    const closeBtn = modal.querySelector('.close-btn, [data-dismiss="modal"], .btn-close');
                    if (closeBtn) closeBtn.click();
                }
            }
        });
    }

    // 포커스 트랩
    function trapFocus(element, e) {
        const focusableElements = element.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }

    // 스킵 네비게이션 추가
    function addSkipNavigation() {
        if (document.querySelector('.skip-nav')) return;

        const mainContent = document.querySelector('main, .container, #content, .main-content');
        if (!mainContent) return;

        mainContent.id = mainContent.id || 'main-content';

        const skipLink = document.createElement('a');
        skipLink.className = 'skip-nav';
        skipLink.href = '#' + mainContent.id;
        skipLink.textContent = '본문으로 건너뛰기';

        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    // 스크롤 영역에 부드러운 스크롤 적용
    function applySmoothScroll() {
        const scrollableElements = document.querySelectorAll(
            '.messages, .chat-list, .reminders-section, .user-list, [style*="overflow"]'
        );

        scrollableElements.forEach(el => {
            el.classList.add('smooth-scroll');
        });
    }

    // 초기화
    function init() {
        addStyles();
        enhanceKeyboardAccessibility();
        addSkipNavigation();
        applySmoothScroll();

        // 버튼에 터치 피드백 적용
        document.querySelectorAll('button, .btn, [role="button"]').forEach(btn => {
            applyTouchFeedback(btn);
        });

        // 주요 버튼에 리플 효과 적용
        document.querySelectorAll('.btn-primary, .btn-success').forEach(btn => {
            addRippleEffect(btn);
        });

        // DOM 변경 감지하여 새 요소에도 적용
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        // 버튼
                        if (node.matches && node.matches('button, .btn, [role="button"]')) {
                            applyTouchFeedback(node);
                        }
                        // 자식 버튼
                        const buttons = node.querySelectorAll?.('button, .btn, [role="button"]');
                        buttons?.forEach(btn => applyTouchFeedback(btn));
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.TouchFeedback = {
        applyTouchFeedback,
        addRippleEffect,
        trapFocus
    };
})();
