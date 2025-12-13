/**
 * Service Worker 업데이트 관리 모듈
 * 새 버전 감지 시 사용자에게 알림 및 업데이트 유도
 */

class ServiceWorkerUpdater {
    constructor() {
        this.registration = null;
        this.updateFound = false;
        this.init();
    }

    async init() {
        if (!('serviceWorker' in navigator)) {
            console.log('[SW Updater] Service Worker 미지원');
            return;
        }

        try {
            // 현재 등록된 SW 가져오기
            this.registration = await navigator.serviceWorker.ready;
            console.log('[SW Updater] Service Worker 준비 완료');

            // 업데이트 체크
            this.checkForUpdates();

            // 주기적 업데이트 체크 (30분마다)
            setInterval(() => this.checkForUpdates(), 30 * 60 * 1000);

            // 페이지 포커스 시 체크
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.checkForUpdates();
                }
            });

            // 컨트롤러 변경 감지 (새 SW 활성화)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW Updater] 새 Service Worker 활성화됨');
                // 자동 새로고침 (선택적)
                // window.location.reload();
            });

        } catch (error) {
            console.error('[SW Updater] 초기화 실패:', error);
        }
    }

    async checkForUpdates() {
        if (!this.registration) return;

        try {
            // SW 업데이트 체크
            await this.registration.update();
            console.log('[SW Updater] 업데이트 체크 완료');

            // 대기 중인 SW가 있는지 확인
            if (this.registration.waiting) {
                this.showUpdateNotification();
            }

            // 설치 중인 SW 감시
            if (this.registration.installing) {
                this.trackInstalling(this.registration.installing);
            }

            // updatefound 이벤트 리스너
            this.registration.addEventListener('updatefound', () => {
                console.log('[SW Updater] 새 버전 발견!');
                const newWorker = this.registration.installing;
                if (newWorker) {
                    this.trackInstalling(newWorker);
                }
            });

        } catch (error) {
            console.error('[SW Updater] 업데이트 체크 실패:', error);
        }
    }

    trackInstalling(worker) {
        worker.addEventListener('statechange', () => {
            console.log('[SW Updater] SW 상태 변경:', worker.state);

            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // 새 SW가 설치되고 대기 중
                this.showUpdateNotification();
            }
        });
    }

    showUpdateNotification() {
        if (this.updateFound) return; // 중복 방지
        this.updateFound = true;

        console.log('[SW Updater] 업데이트 알림 표시');

        // 토스트 사용 가능하면 토스트로
        if (window.toast) {
            toast.info('새 버전이 있습니다!', {
                duration: 0, // 수동으로 닫을 때까지 유지
                action: {
                    text: '지금 업데이트',
                    onClick: () => this.applyUpdate()
                }
            });
        } else {
            // 토스트 없으면 커스텀 배너
            this.showUpdateBanner();
        }
    }

    showUpdateBanner() {
        // 기존 배너 제거
        const existing = document.getElementById('sw-update-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.innerHTML = `
            <div class="sw-update-content">
                <span class="sw-update-icon">🔄</span>
                <span class="sw-update-text">새 버전이 있습니다!</span>
                <button class="sw-update-btn" onclick="window.swUpdater.applyUpdate()">업데이트</button>
                <button class="sw-update-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(banner);

        // 스타일 추가
        if (!document.getElementById('sw-update-styles')) {
            const style = document.createElement('style');
            style.id = 'sw-update-styles';
            style.textContent = `
                #sw-update-banner {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 50px;
                    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                    z-index: 10001;
                    animation: swBannerSlide 0.3s ease;
                }

                @keyframes swBannerSlide {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                .sw-update-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .sw-update-icon {
                    font-size: 18px;
                }

                .sw-update-text {
                    font-size: 14px;
                    font-weight: 500;
                }

                .sw-update-btn {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s;
                }

                .sw-update-btn:hover {
                    transform: scale(1.05);
                }

                .sw-update-close {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.7);
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0 4px;
                    line-height: 1;
                }

                .sw-update-close:hover {
                    color: white;
                }

                /* 모바일 */
                @media (max-width: 480px) {
                    #sw-update-banner {
                        left: 10px;
                        right: 10px;
                        transform: none;
                        border-radius: 12px;
                    }

                    .sw-update-content {
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    applyUpdate() {
        if (!this.registration || !this.registration.waiting) {
            console.log('[SW Updater] 대기 중인 SW 없음, 페이지 새로고침');
            window.location.reload();
            return;
        }

        console.log('[SW Updater] SKIP_WAITING 메시지 전송');

        // 대기 중인 SW에게 즉시 활성화 요청
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // 잠시 후 새로고침
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    // 수동 업데이트 체크
    async forceCheck() {
        this.updateFound = false;
        await this.checkForUpdates();
    }
}

// 서버 버전과 연동하여 강제 업데이트
async function checkServerVersionUpdate() {
    try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            const serverVersion = data.version;
            const localVersion = localStorage.getItem('crm_app_version');

            if (serverVersion && localVersion && serverVersion !== localVersion) {
                console.log(`[Version Check] 서버 버전 불일치: ${localVersion} -> ${serverVersion}`);

                // 캐시 클리어
                if (window.dataCache) {
                    window.dataCache.clearAll();
                }

                // SW 캐시 클리어
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
                }

                // 버전 업데이트
                localStorage.setItem('crm_app_version', serverVersion);

                // 알림 및 새로고침
                if (window.toast) {
                    toast.info('앱이 업데이트되었습니다. 새로고침합니다.', { duration: 2000 });
                }

                setTimeout(() => window.location.reload(), 2000);
                return true;
            }
        }
    } catch (e) {
        console.warn('[Version Check] 서버 버전 확인 실패:', e);
    }
    return false;
}

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.swUpdater = new ServiceWorkerUpdater();

    // 페이지 로드 후 서버 버전 체크 (2초 지연)
    setTimeout(checkServerVersionUpdate, 2000);
});

// 전역 노출
window.ServiceWorkerUpdater = ServiceWorkerUpdater;
window.checkServerVersionUpdate = checkServerVersionUpdate;
