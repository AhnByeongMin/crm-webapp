/**
 * CRM 토스트 알림 시스템
 * 성공, 경고, 에러, 정보 타입을 지원합니다.
 */

class CRMToast {
    constructor() {
        this.container = null;
        this.queue = [];
        this.maxVisible = 5;
        this.init();
    }

    init() {
        // 컨테이너가 없으면 생성
        if (!document.getElementById('crm-toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'crm-toast-container';
            this.container.className = 'crm-toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('crm-toast-container');
        }

        // 스타일 추가
        if (!document.getElementById('crm-toast-styles')) {
            this.addStyles();
        }
    }

    show(message, options = {}) {
        const config = {
            type: 'info',           // success, warning, error, info
            title: null,            // 제목 (선택)
            duration: 4000,         // 표시 시간 (ms)
            closable: true,         // 닫기 버튼
            progress: false,        // 진행률 표시
            progressValue: 0,       // 진행률 값 (0-100)
            icon: null,             // 커스텀 아이콘
            position: 'bottom-right', // 위치
            action: null,           // 액션 버튼 { text, onClick }
            onClick: null,          // 클릭 시 콜백
            ...options
        };

        const toast = this.createToast(message, config);
        this.container.appendChild(toast);

        // 애니메이션 시작
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // 자동 닫기
        if (config.duration > 0) {
            const hideTimer = setTimeout(() => {
                this.hide(toast);
            }, config.duration);

            toast.dataset.hideTimer = hideTimer;
        }

        // 최대 개수 초과 시 오래된 것 제거
        const toasts = this.container.querySelectorAll('.crm-toast');
        if (toasts.length > this.maxVisible) {
            this.hide(toasts[0]);
        }

        return toast;
    }

    createToast(message, config) {
        const toast = document.createElement('div');
        toast.className = `crm-toast crm-toast-${config.type}`;

        if (config.onClick) {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', (e) => {
                if (!e.target.classList.contains('crm-toast-close') &&
                    !e.target.classList.contains('crm-toast-action')) {
                    config.onClick();
                }
            });
        }

        const iconMap = {
            success: '✓',
            warning: '⚠',
            error: '✕',
            info: 'ℹ'
        };

        const icon = config.icon || iconMap[config.type] || iconMap.info;

        let html = `
            <div class="crm-toast-icon">${icon}</div>
            <div class="crm-toast-content">
                ${config.title ? `<div class="crm-toast-title">${config.title}</div>` : ''}
                <div class="crm-toast-message">${message}</div>
                ${config.action ? `
                    <button class="crm-toast-action" onclick="event.stopPropagation();">
                        ${config.action.text}
                    </button>
                ` : ''}
            </div>
        `;

        if (config.closable) {
            html += `<button class="crm-toast-close" aria-label="닫기">&times;</button>`;
        }

        if (config.progress) {
            html += `
                <div class="crm-toast-progress">
                    <div class="crm-toast-progress-bar" style="width: ${config.progressValue}%"></div>
                </div>
            `;
        }

        toast.innerHTML = html;

        // 닫기 버튼 이벤트
        const closeBtn = toast.querySelector('.crm-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide(toast));
        }

        // 액션 버튼 이벤트
        const actionBtn = toast.querySelector('.crm-toast-action');
        if (actionBtn && config.action && config.action.onClick) {
            actionBtn.addEventListener('click', () => {
                config.action.onClick();
                this.hide(toast);
            });
        }

        return toast;
    }

    hide(toast) {
        if (!toast || toast.classList.contains('hiding')) return;

        toast.classList.add('hiding');
        toast.classList.remove('show');

        // 타이머 클리어
        if (toast.dataset.hideTimer) {
            clearTimeout(parseInt(toast.dataset.hideTimer));
        }

        // 애니메이션 후 제거
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // 편의 메서드들
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }

    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error', duration: 6000 });
    }

    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }

    // 진행률 토스트 (업로드 등)
    progress(message, options = {}) {
        return this.show(message, {
            ...options,
            type: 'info',
            progress: true,
            duration: 0,  // 수동으로 닫아야 함
            closable: false
        });
    }

    // 진행률 업데이트
    updateProgress(toast, value, message = null) {
        if (!toast) return;

        const progressBar = toast.querySelector('.crm-toast-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${value}%`;
        }

        if (message) {
            const msgEl = toast.querySelector('.crm-toast-message');
            if (msgEl) {
                msgEl.textContent = message;
            }
        }

        // 100% 도달 시 자동 닫기
        if (value >= 100) {
            setTimeout(() => this.hide(toast), 1000);
        }
    }

    // 모든 토스트 닫기
    clearAll() {
        const toasts = this.container.querySelectorAll('.crm-toast');
        toasts.forEach(toast => this.hide(toast));
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'crm-toast-styles';
        style.textContent = `
            .crm-toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column-reverse;
                gap: 10px;
                max-width: 400px;
                pointer-events: none;
            }

            .crm-toast {
                display: flex;
                align-items: flex-start;
                background: white;
                padding: 14px 16px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                transform: translateX(120%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                position: relative;
                overflow: hidden;
            }

            .crm-toast.show {
                transform: translateX(0);
                opacity: 1;
            }

            .crm-toast.hiding {
                transform: translateX(120%);
                opacity: 0;
            }

            .crm-toast-icon {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                flex-shrink: 0;
                margin-right: 12px;
            }

            .crm-toast-content {
                flex: 1;
                min-width: 0;
            }

            .crm-toast-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
            }

            .crm-toast-message {
                font-size: 14px;
                color: #555;
                line-height: 1.4;
                word-break: break-word;
            }

            .crm-toast-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #999;
                cursor: pointer;
                padding: 0;
                margin-left: 10px;
                line-height: 1;
                transition: color 0.2s;
            }

            .crm-toast-close:hover {
                color: #333;
            }

            .crm-toast-action {
                background: none;
                border: none;
                color: inherit;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                padding: 4px 0;
                margin-top: 8px;
                text-decoration: underline;
            }

            .crm-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: rgba(0,0,0,0.1);
            }

            .crm-toast-progress-bar {
                height: 100%;
                background: currentColor;
                transition: width 0.3s ease;
                border-radius: 0 2px 2px 0;
            }

            /* 타입별 스타일 */
            .crm-toast-success {
                border-left: 4px solid #28a745;
            }
            .crm-toast-success .crm-toast-icon {
                background: #d4edda;
                color: #28a745;
            }
            .crm-toast-success .crm-toast-action {
                color: #28a745;
            }

            .crm-toast-warning {
                border-left: 4px solid #ffc107;
            }
            .crm-toast-warning .crm-toast-icon {
                background: #fff3cd;
                color: #856404;
            }
            .crm-toast-warning .crm-toast-action {
                color: #856404;
            }

            .crm-toast-error {
                border-left: 4px solid #dc3545;
            }
            .crm-toast-error .crm-toast-icon {
                background: #f8d7da;
                color: #dc3545;
            }
            .crm-toast-error .crm-toast-action {
                color: #dc3545;
            }

            .crm-toast-info {
                border-left: 4px solid #667eea;
            }
            .crm-toast-info .crm-toast-icon {
                background: #e8ecff;
                color: #667eea;
            }
            .crm-toast-info .crm-toast-action {
                color: #667eea;
            }

            /* 다크모드 */
            [data-theme="dark"] .crm-toast {
                background: #2d2d2d;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            }

            [data-theme="dark"] .crm-toast-title {
                color: #e0e0e0;
            }

            [data-theme="dark"] .crm-toast-message {
                color: #b0b0b0;
            }

            [data-theme="dark"] .crm-toast-close {
                color: #888;
            }

            [data-theme="dark"] .crm-toast-close:hover {
                color: #e0e0e0;
            }

            [data-theme="dark"] .crm-toast-success .crm-toast-icon {
                background: #1e4620;
                color: #4caf50;
            }

            [data-theme="dark"] .crm-toast-warning .crm-toast-icon {
                background: #4d3800;
                color: #ffc107;
            }

            [data-theme="dark"] .crm-toast-error .crm-toast-icon {
                background: #4a1a1a;
                color: #f44336;
            }

            [data-theme="dark"] .crm-toast-info .crm-toast-icon {
                background: #1a2744;
                color: #7c8fff;
            }

            [data-theme="dark"] .crm-toast-progress {
                background: rgba(255,255,255,0.1);
            }

            /* 모바일 */
            @media (max-width: 480px) {
                .crm-toast-container {
                    left: 10px;
                    right: 10px;
                    bottom: 10px;
                    max-width: none;
                }

                .crm-toast {
                    transform: translateY(120%);
                }

                .crm-toast.show {
                    transform: translateY(0);
                }

                .crm-toast.hiding {
                    transform: translateY(120%);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 싱글톤 인스턴스
const toast = new CRMToast();

// 전역 함수로 노출 (기존 코드 호환성)
window.showToast = function(message, type = 'info', options = {}) {
    return toast.show(message, { ...options, type });
};

// 개별 메서드
window.toast = toast;
