/**
 * CRM 온보딩 튜토리얼 시스템
 * 신규 사용자를 위한 기능 가이드 투어
 */

class CRMOnboarding {
    constructor(options = {}) {
        this.options = {
            storageKey: 'crm_onboarding_completed',
            steps: [],
            onComplete: null,
            onSkip: null,
            allowSkip: true,
            showProgress: true,
            overlayOpacity: 0.6,
            ...options
        };

        this.currentStep = 0;
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
        this.isActive = false;

        this.init();
    }

    init() {
        // 스타일 추가
        if (!document.getElementById('onboarding-styles')) {
            this.addStyles();
        }
    }

    // 튜토리얼 시작
    start(forceStart = false) {
        // 이미 완료한 경우 건너뛰기
        if (!forceStart && this.isCompleted()) {
            return false;
        }

        if (this.options.steps.length === 0) {
            console.warn('No onboarding steps defined');
            return false;
        }

        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);

        return true;
    }

    // 완료 여부 확인
    isCompleted() {
        const completed = localStorage.getItem(this.options.storageKey);
        return completed === 'true';
    }

    // 완료 상태 저장
    setCompleted(value = true) {
        localStorage.setItem(this.options.storageKey, value ? 'true' : 'false');
    }

    // 완료 상태 리셋
    reset() {
        localStorage.removeItem(this.options.storageKey);
    }

    createOverlay() {
        // 오버레이
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-overlay';
        document.body.appendChild(this.overlay);

        // 스포트라이트 영역
        this.spotlight = document.createElement('div');
        this.spotlight.className = 'onboarding-spotlight';
        document.body.appendChild(this.spotlight);

        // 툴팁
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'onboarding-tooltip';
        document.body.appendChild(this.tooltip);
    }

    showStep(index) {
        if (index < 0 || index >= this.options.steps.length) {
            this.complete();
            return;
        }

        const step = this.options.steps[index];
        const target = document.querySelector(step.target);

        if (!target) {
            console.warn(`Onboarding target not found: ${step.target}`);
            this.nextStep();
            return;
        }

        this.currentStep = index;

        // 스크롤하여 타겟 보이게
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 스크롤 완료 후 위치 조정
        setTimeout(() => {
            this.positionSpotlight(target);
            this.positionTooltip(target, step);
        }, 300);
    }

    positionSpotlight(target) {
        const rect = target.getBoundingClientRect();
        const padding = 10;

        this.spotlight.style.left = `${rect.left - padding}px`;
        this.spotlight.style.top = `${rect.top - padding}px`;
        this.spotlight.style.width = `${rect.width + padding * 2}px`;
        this.spotlight.style.height = `${rect.height + padding * 2}px`;
        this.spotlight.classList.add('active');

        // 타겟 강조
        target.classList.add('onboarding-highlight');
    }

    positionTooltip(target, step) {
        const rect = target.getBoundingClientRect();
        const position = step.position || 'bottom';
        const totalSteps = this.options.steps.length;

        // 툴팁 내용
        let progressHTML = '';
        if (this.options.showProgress) {
            progressHTML = `
                <div class="onboarding-progress">
                    <span class="onboarding-progress-text">${this.currentStep + 1} / ${totalSteps}</span>
                    <div class="onboarding-progress-bar">
                        <div class="onboarding-progress-fill" style="width: ${((this.currentStep + 1) / totalSteps) * 100}%"></div>
                    </div>
                </div>
            `;
        }

        this.tooltip.innerHTML = `
            ${progressHTML}
            <div class="onboarding-content">
                ${step.title ? `<h4 class="onboarding-title">${step.title}</h4>` : ''}
                <p class="onboarding-description">${step.description}</p>
            </div>
            <div class="onboarding-actions">
                ${this.options.allowSkip ? `<button class="onboarding-btn onboarding-skip">건너뛰기</button>` : ''}
                ${this.currentStep > 0 ? `<button class="onboarding-btn onboarding-prev">이전</button>` : ''}
                <button class="onboarding-btn onboarding-next primary">
                    ${this.currentStep < totalSteps - 1 ? '다음' : '완료'}
                </button>
            </div>
        `;

        // 버튼 이벤트
        const skipBtn = this.tooltip.querySelector('.onboarding-skip');
        const prevBtn = this.tooltip.querySelector('.onboarding-prev');
        const nextBtn = this.tooltip.querySelector('.onboarding-next');

        if (skipBtn) skipBtn.addEventListener('click', () => this.skip());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevStep());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());

        // 위치 계산
        const tooltipWidth = 320;
        const tooltipHeight = this.tooltip.offsetHeight || 200;
        const margin = 15;
        let left, top;

        switch (position) {
            case 'top':
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                top = rect.top - tooltipHeight - margin;
                break;
            case 'bottom':
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                top = rect.bottom + margin;
                break;
            case 'left':
                left = rect.left - tooltipWidth - margin;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case 'right':
                left = rect.right + margin;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
        }

        // 화면 경계 체크
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tooltipWidth - 10;
        }
        if (top < 10) top = rect.bottom + margin;
        if (top + tooltipHeight > window.innerHeight - 10) {
            top = rect.top - tooltipHeight - margin;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.classList.add('active');
        this.tooltip.dataset.position = position;
    }

    nextStep() {
        this.clearHighlight();
        if (this.currentStep < this.options.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.complete();
        }
    }

    prevStep() {
        this.clearHighlight();
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    skip() {
        this.clearHighlight();
        this.setCompleted(true);
        this.cleanup();

        if (this.options.onSkip) {
            this.options.onSkip();
        }
    }

    complete() {
        this.clearHighlight();
        this.setCompleted(true);
        this.cleanup();

        if (this.options.onComplete) {
            this.options.onComplete();
        }

        // 완료 메시지
        if (window.toast) {
            window.toast.success('튜토리얼을 완료했습니다!', {
                title: '환영합니다!',
                duration: 3000
            });
        }
    }

    clearHighlight() {
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
        });
    }

    cleanup() {
        this.isActive = false;

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.spotlight) {
            this.spotlight.remove();
            this.spotlight = null;
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'onboarding-styles';
        style.textContent = `
            .onboarding-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                z-index: 9998;
                pointer-events: none;
            }

            .onboarding-spotlight {
                position: fixed;
                border-radius: 8px;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
                transition: all 0.4s ease;
                z-index: 9999;
                pointer-events: none;
                opacity: 0;
            }

            .onboarding-spotlight.active {
                opacity: 1;
            }

            .onboarding-highlight {
                position: relative;
                z-index: 10000 !important;
                pointer-events: auto !important;
            }

            .onboarding-tooltip {
                position: fixed;
                width: 320px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
                overflow: hidden;
            }

            .onboarding-tooltip.active {
                opacity: 1;
                transform: translateY(0);
            }

            .onboarding-progress {
                padding: 12px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .onboarding-progress-text {
                font-size: 12px;
                opacity: 0.9;
            }

            .onboarding-progress-bar {
                height: 4px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 2px;
                margin-top: 8px;
                overflow: hidden;
            }

            .onboarding-progress-fill {
                height: 100%;
                background: white;
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            .onboarding-content {
                padding: 20px;
            }

            .onboarding-title {
                margin: 0 0 10px 0;
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .onboarding-description {
                margin: 0;
                font-size: 14px;
                line-height: 1.6;
                color: #666;
            }

            .onboarding-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 12px 16px;
                background: #f8f9fa;
                border-top: 1px solid #eee;
            }

            .onboarding-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .onboarding-btn:not(.primary) {
                background: transparent;
                color: #666;
            }

            .onboarding-btn:not(.primary):hover {
                background: #e9ecef;
            }

            .onboarding-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .onboarding-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            /* 화살표 */
            .onboarding-tooltip::before {
                content: '';
                position: absolute;
                width: 12px;
                height: 12px;
                background: white;
                transform: rotate(45deg);
            }

            .onboarding-tooltip[data-position="bottom"]::before {
                top: -6px;
                left: 50%;
                margin-left: -6px;
            }

            .onboarding-tooltip[data-position="top"]::before {
                bottom: -6px;
                left: 50%;
                margin-left: -6px;
            }

            .onboarding-tooltip[data-position="left"]::before {
                right: -6px;
                top: 50%;
                margin-top: -6px;
            }

            .onboarding-tooltip[data-position="right"]::before {
                left: -6px;
                top: 50%;
                margin-top: -6px;
            }

            /* 다크모드 */
            [data-theme="dark"] .onboarding-tooltip {
                background: #2d2d2d;
            }

            [data-theme="dark"] .onboarding-title {
                color: #e0e0e0;
            }

            [data-theme="dark"] .onboarding-description {
                color: #b0b0b0;
            }

            [data-theme="dark"] .onboarding-actions {
                background: #252525;
                border-color: #333;
            }

            [data-theme="dark"] .onboarding-btn:not(.primary) {
                color: #b0b0b0;
            }

            [data-theme="dark"] .onboarding-btn:not(.primary):hover {
                background: #333;
            }

            [data-theme="dark"] .onboarding-tooltip::before {
                background: #2d2d2d;
            }

            /* 모바일 */
            @media (max-width: 480px) {
                .onboarding-tooltip {
                    width: calc(100% - 20px);
                    left: 10px !important;
                    right: 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 전역에서 사용 가능하도록
window.CRMOnboarding = CRMOnboarding;

// 편의 함수: 페이지별 튜토리얼 정의
window.initPageOnboarding = function(pageName, steps) {
    const onboarding = new CRMOnboarding({
        storageKey: `crm_onboarding_${pageName}`,
        steps: steps
    });

    // 자동 시작 (첫 방문 시)
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            onboarding.start();
        }, 500);
    });

    return onboarding;
};
