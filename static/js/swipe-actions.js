/**
 * CRM 스와이프 액션 컴포넌트
 * 모바일에서 스와이프로 수정/삭제 등의 액션을 수행합니다.
 */

class SwipeActions {
    constructor(options = {}) {
        this.options = {
            selector: '.swipeable',          // 스와이프 대상 선택자
            threshold: 80,                    // 스와이프 임계값 (px)
            maxSwipe: 120,                    // 최대 스와이프 거리
            resistance: 0.7,                  // 저항값 (0-1)
            leftActions: null,                // 왼쪽 액션들 [{icon, color, action}]
            rightActions: null,               // 오른쪽 액션들
            onSwipeStart: null,
            onSwipeEnd: null,
            ...options
        };

        this.activeItem = null;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.isSwiping = false;
        this.direction = null;

        this.init();
    }

    init() {
        // 스타일 추가
        if (!document.getElementById('swipe-actions-styles')) {
            this.addStyles();
        }

        // 터치 이벤트 바인딩
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

        // 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (this.activeItem && !this.activeItem.contains(e.target)) {
                this.resetItem(this.activeItem);
            }
        });
    }

    handleTouchStart(e) {
        const target = e.target.closest(this.options.selector);
        if (!target) return;

        // 이전 활성 아이템 리셋
        if (this.activeItem && this.activeItem !== target) {
            this.resetItem(this.activeItem);
        }

        this.activeItem = target;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.currentX = 0;
        this.direction = null;

        // 스와이프 컨텐츠 래퍼 확인/생성
        this.ensureSwipeWrapper(target);
    }

    handleTouchMove(e) {
        if (!this.activeItem) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - this.startX;
        const deltaY = touchY - this.startY;

        // 수직 스크롤이 더 큰 경우 스와이프 취소
        if (!this.isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
            this.activeItem = null;
            return;
        }

        // 수평 움직임이 충분하면 스와이프 시작
        if (!this.isSwiping && Math.abs(deltaX) > 10) {
            this.isSwiping = true;
            this.direction = deltaX > 0 ? 'right' : 'left';

            if (this.options.onSwipeStart) {
                this.options.onSwipeStart(this.activeItem, this.direction);
            }
        }

        if (!this.isSwiping) return;

        e.preventDefault();

        // 스와이프 거리 계산 (저항 적용)
        let swipeDistance = deltaX;
        const maxSwipe = this.options.maxSwipe;

        // 허용된 방향 확인
        const hasLeftActions = this.options.leftActions && this.options.leftActions.length > 0;
        const hasRightActions = this.options.rightActions && this.options.rightActions.length > 0;

        if (deltaX > 0 && !hasRightActions) {
            swipeDistance = deltaX * 0.2; // 강한 저항
        } else if (deltaX < 0 && !hasLeftActions) {
            swipeDistance = deltaX * 0.2;
        }

        // 최대값 제한
        if (Math.abs(swipeDistance) > maxSwipe) {
            const excess = Math.abs(swipeDistance) - maxSwipe;
            swipeDistance = (swipeDistance > 0 ? 1 : -1) * (maxSwipe + excess * this.options.resistance * 0.3);
        }

        this.currentX = swipeDistance;
        this.updateSwipePosition(this.activeItem, swipeDistance);
    }

    handleTouchEnd(e) {
        if (!this.activeItem || !this.isSwiping) {
            this.activeItem = null;
            return;
        }

        const threshold = this.options.threshold;
        const item = this.activeItem;

        if (Math.abs(this.currentX) >= threshold) {
            // 임계값 초과 - 액션 영역 표시
            const finalPosition = this.currentX > 0 ? this.options.maxSwipe : -this.options.maxSwipe;
            this.updateSwipePosition(item, finalPosition, true);

            // 액션 실행 여부 확인
            if (this.currentX < 0 && this.options.leftActions) {
                this.showActions(item, 'left');
            } else if (this.currentX > 0 && this.options.rightActions) {
                this.showActions(item, 'right');
            }
        } else {
            // 임계값 미만 - 원위치
            this.resetItem(item);
        }

        if (this.options.onSwipeEnd) {
            this.options.onSwipeEnd(item, this.direction, Math.abs(this.currentX) >= threshold);
        }

        this.isSwiping = false;
        this.direction = null;
    }

    ensureSwipeWrapper(item) {
        if (item.querySelector('.swipe-content')) return;

        // 기존 내용을 래퍼로 감싸기
        const content = document.createElement('div');
        content.className = 'swipe-content';

        while (item.firstChild) {
            content.appendChild(item.firstChild);
        }

        item.appendChild(content);
        item.classList.add('swipe-enabled');

        // 액션 영역 생성
        if (this.options.leftActions) {
            const leftContainer = this.createActionsContainer(item, 'left', this.options.leftActions);
            item.insertBefore(leftContainer, content);
        }

        if (this.options.rightActions) {
            const rightContainer = this.createActionsContainer(item, 'right', this.options.rightActions);
            item.appendChild(rightContainer);
        }
    }

    createActionsContainer(item, side, actions) {
        const container = document.createElement('div');
        container.className = `swipe-actions swipe-actions-${side}`;

        actions.forEach((action, index) => {
            const btn = document.createElement('button');
            btn.className = 'swipe-action-btn';
            btn.style.background = action.color || '#667eea';
            btn.innerHTML = `
                <span class="swipe-action-icon">${action.icon || ''}</span>
                ${action.label ? `<span class="swipe-action-label">${action.label}</span>` : ''}
            `;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (action.action) {
                    action.action(item, e);
                }
                this.resetItem(item);
            });

            container.appendChild(btn);
        });

        return container;
    }

    showActions(item, side) {
        item.classList.add(`swipe-open-${side}`);
    }

    updateSwipePosition(item, distance, animate = false) {
        const content = item.querySelector('.swipe-content');
        if (!content) return;

        if (animate) {
            content.style.transition = 'transform 0.3s ease';
        } else {
            content.style.transition = 'none';
        }

        content.style.transform = `translateX(${distance}px)`;
    }

    resetItem(item) {
        if (!item) return;

        const content = item.querySelector('.swipe-content');
        if (content) {
            content.style.transition = 'transform 0.3s ease';
            content.style.transform = 'translateX(0)';
        }

        item.classList.remove('swipe-open-left', 'swipe-open-right');

        if (this.activeItem === item) {
            this.activeItem = null;
        }
    }

    // 모든 아이템 리셋
    resetAll() {
        document.querySelectorAll(this.options.selector).forEach(item => {
            this.resetItem(item);
        });
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'swipe-actions-styles';
        style.textContent = `
            .swipe-enabled {
                position: relative;
                overflow: hidden;
            }

            .swipe-content {
                position: relative;
                z-index: 2;
                background: inherit;
                will-change: transform;
            }

            .swipe-actions {
                position: absolute;
                top: 0;
                bottom: 0;
                display: flex;
                align-items: stretch;
                z-index: 1;
            }

            .swipe-actions-left {
                right: 0;
            }

            .swipe-actions-right {
                left: 0;
                flex-direction: row-reverse;
            }

            .swipe-action-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: none;
                color: white;
                padding: 0 20px;
                min-width: 70px;
                cursor: pointer;
                font-size: 12px;
                transition: opacity 0.2s;
            }

            .swipe-action-btn:active {
                opacity: 0.8;
            }

            .swipe-action-icon {
                font-size: 20px;
                margin-bottom: 4px;
            }

            .swipe-action-label {
                font-size: 11px;
                font-weight: 500;
            }

            /* 터치 힌트 애니메이션 */
            @keyframes swipeHint {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(-20px); }
            }

            .swipe-hint .swipe-content {
                animation: swipeHint 1s ease-in-out;
            }

            /* 다크모드 */
            [data-theme="dark"] .swipe-content {
                background: var(--card-bg, #1e1e1e);
            }
        `;
        document.head.appendChild(style);
    }

    // 스와이프 힌트 표시
    showHint(item) {
        item.classList.add('swipe-hint');
        setTimeout(() => {
            item.classList.remove('swipe-hint');
        }, 1000);
    }
}

// 전역에서 사용 가능하도록
window.SwipeActions = SwipeActions;
