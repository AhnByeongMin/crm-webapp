/**
 * Pull-to-Refresh 모듈
 * 모바일에서 당겨서 새로고침 기능 제공
 */

class PullToRefresh {
    constructor(options = {}) {
        this.threshold = options.threshold || 80;  // 트리거 임계값 (px)
        this.maxPull = options.maxPull || 120;     // 최대 당김 거리
        this.onRefresh = options.onRefresh || null; // 새로고침 콜백
        this.container = options.container || document.body;

        this.startY = 0;
        this.currentY = 0;
        this.pulling = false;
        this.refreshing = false;
        this.indicator = null;

        // 모바일에서만 활성화
        if (this.isMobile()) {
            this.init();
        }
    }

    isMobile() {
        return window.innerWidth <= 768 ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    init() {
        this.createIndicator();
        this.bindEvents();
    }

    createIndicator() {
        // 기존 인디케이터 제거
        const existing = document.getElementById('ptr-indicator');
        if (existing) existing.remove();

        this.indicator = document.createElement('div');
        this.indicator.id = 'ptr-indicator';
        this.indicator.innerHTML = `
            <div class="ptr-content">
                <div class="ptr-icon">↓</div>
                <div class="ptr-text">당겨서 새로고침</div>
            </div>
        `;
        document.body.insertBefore(this.indicator, document.body.firstChild);

        // 스타일 추가
        if (!document.getElementById('ptr-styles')) {
            const style = document.createElement('style');
            style.id = 'ptr-styles';
            style.textContent = `
                #ptr-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 0;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    z-index: 9998;
                    transition: height 0.2s ease;
                }

                #ptr-indicator.pulling {
                    transition: none;
                }

                #ptr-indicator.refreshing {
                    height: 50px !important;
                }

                .ptr-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                }

                .ptr-icon {
                    font-size: 20px;
                    transition: transform 0.2s;
                }

                #ptr-indicator.ready .ptr-icon {
                    transform: rotate(180deg);
                }

                #ptr-indicator.refreshing .ptr-icon {
                    animation: ptr-spin 1s linear infinite;
                }

                @keyframes ptr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .ptr-text {
                    font-size: 13px;
                }

                /* 다크모드 */
                [data-theme="dark"] #ptr-indicator {
                    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                }

                /* 페이지 전체 이동 방지 */
                body.ptr-pulling {
                    overflow: hidden;
                    touch-action: none;
                }
            `;
            document.head.appendChild(style);
        }
    }

    bindEvents() {
        let touchStartY = 0;
        let scrollTop = 0;

        this.container.addEventListener('touchstart', (e) => {
            if (this.refreshing) return;

            scrollTop = window.scrollY || document.documentElement.scrollTop;

            // 페이지 최상단에서만 활성화
            if (scrollTop > 5) return;

            touchStartY = e.touches[0].clientY;
            this.startY = touchStartY;
            this.pulling = false;
        }, { passive: true });

        this.container.addEventListener('touchmove', (e) => {
            if (this.refreshing) return;

            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop > 5) {
                this.resetIndicator();
                return;
            }

            const touchY = e.touches[0].clientY;
            const diff = touchY - this.startY;

            // 아래로 당기는 경우만
            if (diff > 0) {
                this.pulling = true;
                document.body.classList.add('ptr-pulling');
                this.indicator.classList.add('pulling');

                // 저항감 있는 당김 (1/2 비율)
                const pullDistance = Math.min(diff * 0.5, this.maxPull);
                this.indicator.style.height = pullDistance + 'px';

                // 임계값 초과 시 준비 상태
                if (pullDistance >= this.threshold * 0.5) {
                    this.indicator.classList.add('ready');
                    this.indicator.querySelector('.ptr-text').textContent = '놓아서 새로고침';
                    this.indicator.querySelector('.ptr-icon').textContent = '↑';
                } else {
                    this.indicator.classList.remove('ready');
                    this.indicator.querySelector('.ptr-text').textContent = '당겨서 새로고침';
                    this.indicator.querySelector('.ptr-icon').textContent = '↓';
                }
            }
        }, { passive: true });

        this.container.addEventListener('touchend', () => {
            if (!this.pulling || this.refreshing) {
                this.resetIndicator();
                return;
            }

            const pullDistance = parseInt(this.indicator.style.height) || 0;

            if (pullDistance >= this.threshold * 0.5) {
                this.startRefresh();
            } else {
                this.resetIndicator();
            }
        });
    }

    startRefresh() {
        this.refreshing = true;
        this.indicator.classList.remove('pulling', 'ready');
        this.indicator.classList.add('refreshing');
        this.indicator.querySelector('.ptr-icon').textContent = '⟳';
        this.indicator.querySelector('.ptr-text').textContent = '새로고침 중...';
        document.body.classList.remove('ptr-pulling');

        // 콜백 실행
        if (this.onRefresh) {
            Promise.resolve(this.onRefresh())
                .then(() => this.endRefresh())
                .catch(() => this.endRefresh());
        } else {
            // 기본 동작: 페이지 새로고침
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    }

    endRefresh() {
        this.refreshing = false;
        this.indicator.classList.remove('refreshing');
        this.resetIndicator();

        // 토스트 알림
        if (window.toast) {
            toast.success('새로고침 완료');
        }
    }

    resetIndicator() {
        this.pulling = false;
        document.body.classList.remove('ptr-pulling');
        this.indicator.classList.remove('pulling', 'ready');
        this.indicator.style.height = '0';
    }
}

// 자동 초기화 (목록 페이지에서)
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // 목록 페이지들에서만 활성화
    const listPages = ['/', '/chats', '/reminders', '/users', '/promotions', '/admin'];
    const isListPage = listPages.some(p => path === p || path === p + '/');

    if (isListPage) {
        window.pullToRefresh = new PullToRefresh({
            onRefresh: async () => {
                // 페이지별 새로고침 함수 호출
                if (typeof loadChats === 'function') {
                    await loadChats();
                } else if (typeof loadReminders === 'function') {
                    await loadReminders();
                } else if (typeof loadUsers === 'function') {
                    await loadUsers();
                } else if (typeof loadPromotions === 'function') {
                    await loadPromotions();
                } else if (typeof loadTasks === 'function') {
                    await loadTasks();
                } else {
                    // 기본: 페이지 새로고침
                    window.location.reload();
                    return new Promise(() => {}); // 리로드 완료까지 대기
                }
            }
        });
    }
});

// 전역 노출
window.PullToRefresh = PullToRefresh;
