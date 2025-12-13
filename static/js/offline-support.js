/**
 * 오프라인 지원 모듈
 * 네트워크 상태 감지 및 오프라인 시 캐시된 데이터 활용
 */

class OfflineSupport {
    constructor() {
        this.isOnline = navigator.onLine;
        this.statusBar = null;
        this.pendingRequests = [];

        this.init();
    }

    init() {
        this.createStatusBar();
        this.bindEvents();
        this.updateStatus();
    }

    createStatusBar() {
        // 기존 상태바 제거
        const existing = document.getElementById('offline-status-bar');
        if (existing) existing.remove();

        this.statusBar = document.createElement('div');
        this.statusBar.id = 'offline-status-bar';
        this.statusBar.innerHTML = `
            <div class="offline-content">
                <span class="offline-icon">📡</span>
                <span class="offline-text">오프라인 상태입니다</span>
            </div>
        `;
        document.body.appendChild(this.statusBar);

        // 스타일 추가
        if (!document.getElementById('offline-styles')) {
            const style = document.createElement('style');
            style.id = 'offline-styles';
            style.textContent = `
                #offline-status-bar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #ff6b6b;
                    color: white;
                    text-align: center;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    z-index: 10002;
                    transform: translateY(-100%);
                    transition: transform 0.3s ease;
                }

                #offline-status-bar.visible {
                    transform: translateY(0);
                }

                #offline-status-bar.reconnecting {
                    background: #ffa502;
                }

                #offline-status-bar.online {
                    background: #28a745;
                }

                .offline-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .offline-icon {
                    font-size: 14px;
                }

                /* 오프라인일 때 헤더 위치 조정 */
                body.is-offline .header {
                    top: 37px;
                }

                body.is-offline.has-banner .header {
                    top: 87px;
                }

                /* 오프라인 오버레이 (선택적) */
                .offline-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.1);
                    z-index: 9997;
                    pointer-events: none;
                }

                /* 오프라인 배지 */
                .offline-badge {
                    display: inline-block;
                    background: #ff6b6b;
                    color: white;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    margin-left: 8px;
                }

                /* 다크모드 */
                [data-theme="dark"] #offline-status-bar {
                    background: #dc3545;
                }

                [data-theme="dark"] #offline-status-bar.reconnecting {
                    background: #fd7e14;
                }

                [data-theme="dark"] #offline-status-bar.online {
                    background: #20c997;
                }
            `;
            document.head.appendChild(style);
        }
    }

    bindEvents() {
        // 온라인/오프라인 이벤트
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // fetch 래핑하여 오프라인 처리
        this.wrapFetch();
    }

    handleOnline() {
        console.log('[Offline Support] 온라인 상태로 전환');
        this.isOnline = true;
        document.body.classList.remove('is-offline');

        // 재연결 표시
        this.statusBar.classList.remove('visible');
        this.statusBar.classList.add('online');
        this.statusBar.querySelector('.offline-text').textContent = '다시 연결되었습니다!';
        this.statusBar.querySelector('.offline-icon').textContent = '✓';
        this.statusBar.classList.add('visible');

        // 2초 후 숨김
        setTimeout(() => {
            this.statusBar.classList.remove('visible', 'online');
        }, 2000);

        // 토스트 알림
        if (window.toast) {
            toast.success('인터넷에 다시 연결되었습니다');
        }

        // 데이터 새로고침
        this.refreshData();

        // 보류된 요청 처리
        this.processPendingRequests();
    }

    handleOffline() {
        console.log('[Offline Support] 오프라인 상태로 전환');
        this.isOnline = false;
        document.body.classList.add('is-offline');

        // 상태바 표시
        this.statusBar.classList.remove('online', 'reconnecting');
        this.statusBar.querySelector('.offline-text').textContent = '오프라인 상태입니다. 일부 기능이 제한됩니다.';
        this.statusBar.querySelector('.offline-icon').textContent = '📡';
        this.statusBar.classList.add('visible');

        // 토스트 알림
        if (window.toast) {
            toast.warning('인터넷 연결이 끊겼습니다');
        }
    }

    updateStatus() {
        if (!navigator.onLine) {
            this.handleOffline();
        }
    }

    wrapFetch() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = async function(url, options = {}) {
            // 오프라인 상태에서 GET 요청은 캐시 시도
            if (!self.isOnline && (!options.method || options.method === 'GET')) {
                // 캐시된 데이터 확인
                if (window.dataCache) {
                    const cached = window.dataCache.get(url);
                    if (cached) {
                        console.log('[Offline Support] 캐시된 데이터 사용:', url);
                        return new Response(JSON.stringify(cached), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }

                // Service Worker 캐시 폴백
                try {
                    const cache = await caches.open('crm-cache-v10');
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        console.log('[Offline Support] SW 캐시 데이터 사용:', url);
                        return cachedResponse;
                    }
                } catch (e) {
                    console.warn('[Offline Support] 캐시 접근 실패:', e);
                }
            }

            // 오프라인 상태에서 POST/PUT/DELETE는 보류
            if (!self.isOnline && options.method && options.method !== 'GET') {
                console.log('[Offline Support] 요청 보류:', url);

                // 중요한 요청만 저장 (선택적)
                if (self.shouldQueueRequest(url, options)) {
                    self.queueRequest(url, options);
                    throw new Error('오프라인 상태입니다. 연결 후 다시 시도해주세요.');
                }
            }

            try {
                return await originalFetch(url, options);
            } catch (error) {
                // 네트워크 오류 시 오프라인 처리
                if (!navigator.onLine) {
                    self.handleOffline();
                }
                throw error;
            }
        };
    }

    shouldQueueRequest(url, options) {
        // 중요한 요청만 큐에 저장
        const importantPaths = ['/api/reminders', '/api/chats', '/api/messages'];
        return importantPaths.some(path => url.includes(path));
    }

    queueRequest(url, options) {
        this.pendingRequests.push({
            url,
            options,
            timestamp: Date.now()
        });

        // localStorage에도 저장 (새로고침 대비)
        try {
            localStorage.setItem('crm_pending_requests', JSON.stringify(this.pendingRequests));
        } catch (e) {
            console.warn('[Offline Support] 보류 요청 저장 실패:', e);
        }

        if (window.toast) {
            toast.info('오프라인 상태입니다. 연결되면 자동으로 저장됩니다.');
        }
    }

    async processPendingRequests() {
        // 저장된 요청 불러오기
        try {
            const saved = localStorage.getItem('crm_pending_requests');
            if (saved) {
                this.pendingRequests = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[Offline Support] 보류 요청 불러오기 실패:', e);
        }

        if (this.pendingRequests.length === 0) return;

        console.log(`[Offline Support] 보류된 요청 ${this.pendingRequests.length}개 처리 중...`);

        // 상태바 업데이트
        this.statusBar.classList.add('reconnecting');
        this.statusBar.querySelector('.offline-text').textContent = `보류된 요청 처리 중... (${this.pendingRequests.length}개)`;

        const originalFetch = window._originalFetch || window.fetch;

        for (const request of this.pendingRequests) {
            try {
                await originalFetch(request.url, request.options);
                console.log('[Offline Support] 보류 요청 처리 완료:', request.url);
            } catch (error) {
                console.error('[Offline Support] 보류 요청 처리 실패:', request.url, error);
            }
        }

        // 완료 후 정리
        this.pendingRequests = [];
        localStorage.removeItem('crm_pending_requests');

        if (window.toast) {
            toast.success('보류된 작업이 모두 처리되었습니다');
        }
    }

    refreshData() {
        // 현재 페이지에 맞는 데이터 새로고침
        if (typeof loadChats === 'function') loadChats();
        if (typeof loadReminders === 'function') loadReminders();
        if (typeof loadUsers === 'function') loadUsers();
        if (typeof loadPromotions === 'function') loadPromotions();
        if (typeof fetchNavCounts === 'function') fetchNavCounts();
    }

    // 수동으로 오프라인 상태 확인
    checkConnection() {
        return navigator.onLine;
    }
}

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.offlineSupport = new OfflineSupport();
});

// 전역 노출
window.OfflineSupport = OfflineSupport;
