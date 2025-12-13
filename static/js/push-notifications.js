/**
 * 푸시 알림 관리 모듈
 * 브라우저 푸시 알림 권한 요청 및 구독 관리
 * iOS 16.4+ PWA 지원 포함
 */

class PushNotificationManager {
    constructor() {
        this.vapidPublicKey = null;
        this.isSubscribed = false;
        this.swRegistration = null;
        this.isIOS = this.detectIOS();
        this.isIOSPWA = this.detectIOSPWA();
    }

    /**
     * iOS 디바이스 감지
     */
    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * iOS PWA 모드 감지 (홈 화면에서 실행)
     */
    detectIOSPWA() {
        return this.detectIOS() &&
               (window.navigator.standalone === true ||
                window.matchMedia('(display-mode: standalone)').matches);
    }

    /**
     * 푸시 알림 초기화
     */
    async initialize() {
        console.log('[Push Notifications] initialize() 시작');
        console.log('[Push Notifications] iOS 감지:', this.isIOS, 'PWA:', this.isIOSPWA);

        // 브라우저가 푸시 알림을 지원하는지 확인
        console.log('[Push Notifications] 브라우저 지원 체크:', {
            serviceWorker: 'serviceWorker' in navigator,
            pushManager: 'PushManager' in window,
            notification: 'Notification' in window
        });

        // iOS Safari (비-PWA)에서는 푸시 지원 안 함
        if (this.isIOS && !this.isIOSPWA) {
            console.log('[Push Notifications] iOS Safari - PWA로 설치 필요');
            return false;
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push Notifications] 푸시 알림이 지원되지 않는 브라우저입니다.');
            return false;
        }

        try {
            // Service Worker 등록 확인
            console.log('[Push Notifications] Service Worker ready 대기 중...');
            this.swRegistration = await navigator.serviceWorker.ready;
            console.log('[Push Notifications] Service Worker ready 완료:', this.swRegistration);

            // VAPID 공개키 가져오기
            console.log('[Push Notifications] VAPID 공개키 로드 시작');
            await this.loadVapidPublicKey();
            console.log('[Push Notifications] VAPID 공개키 로드 완료');

            // 현재 구독 상태 확인
            console.log('[Push Notifications] 구독 상태 확인 시작');
            await this.checkSubscription();
            console.log('[Push Notifications] 구독 상태 확인 완료');

            console.log('[Push Notifications] initialize() 성공');
            return true;
        } catch (error) {
            console.error('[Push Notifications] 푸시 알림 초기화 실패:', error);
            console.error('[Push Notifications] 에러 스택:', error.stack);
            return false;
        }
    }

    /**
     * VAPID 공개키 로드
     */
    async loadVapidPublicKey() {
        try {
            console.log('[Push Notifications] VAPID 공개키 요청 중...');
            const response = await fetch('/api/push/vapid-public-key');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[Push Notifications] VAPID 응답:', data);

            if (!data.publicKey) {
                throw new Error('publicKey가 응답에 없습니다');
            }

            this.vapidPublicKey = data.publicKey;
            console.log('[Push Notifications] VAPID 공개키 로드 성공:', this.vapidPublicKey.substring(0, 20) + '...');
            return this.vapidPublicKey;
        } catch (error) {
            console.error('[Push Notifications] VAPID 공개키 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 현재 구독 상태 확인 및 재검증
     */
    async checkSubscription() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            this.isSubscribed = (subscription !== null);

            // 구독이 있으면 서버와 동기화 확인
            if (subscription) {
                console.log('[Push Notifications] 기존 구독 발견, 서버 동기화 확인');
                // 서버에 현재 구독이 유효한지 확인 후 필요시 재등록
                await this.sendSubscriptionToServer(subscription);
            }

            return this.isSubscribed;
        } catch (error) {
            console.error('구독 상태 확인 실패:', error);
            return false;
        }
    }

    /**
     * 푸시 알림 권한 요청 및 구독
     */
    async subscribe() {
        try {
            // 알림 권한 요청
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                console.log('알림 권한이 거부되었습니다.');
                return false;
            }

            // VAPID 공개키를 Uint8Array로 변환
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            // 푸시 구독
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            // 서버에 구독 정보 저장
            const success = await this.sendSubscriptionToServer(subscription);

            if (success) {
                this.isSubscribed = true;
                console.log('푸시 알림 구독 성공');
                return true;
            } else {
                console.error('서버에 구독 정보 저장 실패');
                return false;
            }
        } catch (error) {
            console.error('푸시 알림 구독 실패:', error);
            return false;
        }
    }

    /**
     * 푸시 알림 구독 취소
     */
    async unsubscribe() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();

            if (!subscription) {
                console.log('구독 정보가 없습니다.');
                return true;
            }

            // 브라우저에서 구독 취소
            await subscription.unsubscribe();

            // 서버에서 구독 정보 삭제
            await this.removeSubscriptionFromServer(subscription);

            this.isSubscribed = false;
            console.log('푸시 알림 구독 취소 성공');
            return true;
        } catch (error) {
            console.error('푸시 알림 구독 취소 실패:', error);
            return false;
        }
    }

    /**
     * 서버에 구독 정보 전송
     */
    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON()
                })
            });

            return response.ok;
        } catch (error) {
            console.error('서버 구독 정보 전송 실패:', error);
            return false;
        }
    }

    /**
     * 서버에서 구독 정보 삭제
     */
    async removeSubscriptionFromServer(subscription) {
        try {
            const response = await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint
                })
            });

            return response.ok;
        } catch (error) {
            console.error('서버 구독 정보 삭제 실패:', error);
            return false;
        }
    }

    /**
     * Base64 URL을 Uint8Array로 변환
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * 푸시 알림 지원 여부 확인
     */
    isSupported() {
        // iOS Safari는 PWA 모드에서만 지원
        if (this.isIOS && !this.isIOSPWA) {
            return false;
        }
        return ('serviceWorker' in navigator) && ('PushManager' in window);
    }

    /**
     * 알림 권한 상태 확인
     */
    getPermissionStatus() {
        // iOS Safari 브라우저 (비-PWA)
        if (this.isIOS && !this.isIOSPWA) {
            return 'ios-safari';
        }
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    /**
     * iOS PWA 설치 안내 표시
     */
    showIOSInstallPrompt() {
        if (!this.isIOS || this.isIOSPWA) return;

        // 이미 표시한 적 있으면 스킵
        if (localStorage.getItem('crm_ios_install_prompt_shown')) return;

        const prompt = document.createElement('div');
        prompt.id = 'ios-install-prompt';
        prompt.innerHTML = `
            <div style="position: fixed; bottom: 20px; left: 20px; right: 20px; background: white; border-radius: 16px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                <button onclick="this.parentElement.parentElement.remove(); localStorage.setItem('crm_ios_install_prompt_shown', 'true');"
                        style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; color: #999; cursor: pointer;">×</button>
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="font-size: 40px;">📲</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #333;">
                            푸시 알림을 받으시겠어요?
                        </div>
                        <div style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
                            홈 화면에 앱을 추가하면 푸시 알림을 받을 수 있습니다.
                        </div>
                        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; font-size: 13px; color: #555;">
                            <div style="margin-bottom: 6px;">1. 하단의 <strong>공유</strong> 버튼 <span style="font-size: 16px;">⎙</span> 탭</div>
                            <div>2. <strong>"홈 화면에 추가"</strong> 선택</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(prompt);

        // 30초 후 자동 닫기
        setTimeout(() => {
            if (prompt.parentElement) {
                prompt.remove();
                localStorage.setItem('crm_ios_install_prompt_shown', 'true');
            }
        }, 30000);
    }
}

// 전역 인스턴스 생성
window.pushNotificationManager = new PushNotificationManager();

// 페이지 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Push Notifications] DOMContentLoaded - 초기화 시작');

    // 로그인 페이지에서는 푸시 알림 초기화 건너뛰기 (인증 필요)
    if (window.location.pathname === '/login' || window.location.pathname === '/login/') {
        console.log('[Push Notifications] 로그인 페이지 - 초기화 건너뜀');
        return;
    }

    if (window.pushNotificationManager.isSupported()) {
        const initialized = await window.pushNotificationManager.initialize();
        console.log('[Push Notifications] 초기화 결과:', initialized);
        console.log('[Push Notifications] VAPID 키:', window.pushNotificationManager.vapidPublicKey);

        if (initialized && !window.pushNotificationManager.isSubscribed) {
            // 자동 구독 시도 (사용자가 이전에 허용한 경우)
            if (window.pushNotificationManager.getPermissionStatus() === 'granted') {
                console.log('[Push Notifications] 자동 구독 시도');
                await window.pushNotificationManager.subscribe();
            }
        }
    } else if (window.pushNotificationManager.isIOS && !window.pushNotificationManager.isIOSPWA) {
        // iOS Safari 사용자에게 PWA 설치 안내 (3초 후)
        setTimeout(() => {
            window.pushNotificationManager.showIOSInstallPrompt();
        }, 3000);
    }
});

/**
 * 브라우저 푸시와 알림 센터 통합 헬퍼
 * 푸시 알림을 받으면 알림 센터에도 추가
 */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PUSH_RECEIVED') {
            // 현재 보고 있는 채팅방 메시지면 무시
            const url = event.data.url;
            if (url && url.includes('/chat/')) {
                const roomId = url.split('/chat/')[1];
                if (window.currentChatRoomId && window.currentChatRoomId === roomId) {
                    // 현재 보고 있는 채팅방이면 알림 추가 안 함
                    return;
                }
            }

            // 알림 센터에 추가
            if (window.notificationCenter) {
                window.notificationCenter.addNotification({
                    type: event.data.notificationType || 'info',
                    title: event.data.title || '알림',
                    message: event.data.body || '',
                    link: url || null,
                    icon: event.data.icon || '🔔'
                });
            }
        }
    });
}
