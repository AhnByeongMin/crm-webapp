/**
 * 네트워크 적응형 최적화 모듈
 * 연결 상태에 따라 이미지 품질, 요청 빈도 등 조절
 */

(function() {
    'use strict';

    // 네트워크 상태 타입
    const NetworkState = {
        FAST: 'fast',      // 4G, WiFi
        SLOW: 'slow',      // 3G, 2G
        OFFLINE: 'offline'
    };

    // 현재 네트워크 상태
    let currentState = NetworkState.FAST;
    let saveDataMode = false;

    /**
     * 네트워크 상태 감지
     */
    function detectNetworkState() {
        // 오프라인 체크
        if (!navigator.onLine) {
            return NetworkState.OFFLINE;
        }

        // Network Information API 지원 여부
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection) {
            // 데이터 절약 모드
            saveDataMode = connection.saveData === true;

            // effectiveType 기반 판단
            const effectiveType = connection.effectiveType;

            if (effectiveType === '4g') {
                return NetworkState.FAST;
            } else if (effectiveType === '3g' || effectiveType === '2g' || effectiveType === 'slow-2g') {
                return NetworkState.SLOW;
            }

            // downlink 기반 판단 (Mbps)
            if (connection.downlink !== undefined) {
                if (connection.downlink >= 1.5) {
                    return NetworkState.FAST;
                } else {
                    return NetworkState.SLOW;
                }
            }
        }

        // 기본값: 빠름
        return NetworkState.FAST;
    }

    /**
     * 네트워크 상태 업데이트
     */
    function updateNetworkState() {
        const newState = detectNetworkState();

        if (newState !== currentState) {
            const oldState = currentState;
            currentState = newState;

            // 상태 변경 이벤트 발생
            window.dispatchEvent(new CustomEvent('networkstatechange', {
                detail: { oldState, newState, saveDataMode }
            }));

            // 사용자 알림 (선택적)
            if (newState === NetworkState.SLOW && window.toast) {
                toast.info('느린 네트워크 감지 - 데이터 절약 모드 활성화', { duration: 3000 });
            } else if (newState === NetworkState.FAST && oldState === NetworkState.SLOW && window.toast) {
                toast.success('빠른 네트워크 연결됨', { duration: 2000 });
            }
        }

        return currentState;
    }

    /**
     * 이미지 품질 설정 가져오기
     */
    function getImageQuality() {
        if (saveDataMode || currentState === NetworkState.SLOW) {
            return {
                quality: 60,
                maxWidth: 800,
                format: 'webp',
                lazy: true
            };
        }

        return {
            quality: 85,
            maxWidth: 1920,
            format: 'webp',
            lazy: true
        };
    }

    /**
     * 요청 설정 가져오기
     */
    function getRequestConfig() {
        if (currentState === NetworkState.OFFLINE) {
            return {
                timeout: 5000,
                retries: 0,
                useCache: true
            };
        }

        if (currentState === NetworkState.SLOW || saveDataMode) {
            return {
                timeout: 15000,
                retries: 2,
                useCache: true,
                batchSize: 10  // 한 번에 로드할 항목 수 제한
            };
        }

        return {
            timeout: 10000,
            retries: 3,
            useCache: true,
            batchSize: 50
        };
    }

    /**
     * 적응형 fetch 래퍼
     */
    async function adaptiveFetch(url, options = {}) {
        const config = getRequestConfig();

        // 오프라인이면 캐시에서 시도
        if (currentState === NetworkState.OFFLINE) {
            if ('caches' in window) {
                const cache = await caches.open('crm-api-cache');
                const cached = await cache.match(url);
                if (cached) return cached;
            }
            throw new Error('오프라인 상태입니다');
        }

        // AbortController로 타임아웃 처리
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const fetchOptions = {
            ...options,
            signal: controller.signal
        };

        let lastError;
        for (let i = 0; i <= config.retries; i++) {
            try {
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                // 캐시에 저장 (GET 요청만)
                if (config.useCache && options.method !== 'POST' && response.ok) {
                    try {
                        const cache = await caches.open('crm-api-cache');
                        cache.put(url, response.clone());
                    } catch (e) {
                        // 캐시 저장 실패 무시
                    }
                }

                return response;
            } catch (error) {
                lastError = error;
                if (error.name === 'AbortError') {
                    console.warn(`요청 타임아웃: ${url}`);
                }
                // 재시도 전 짧은 대기
                if (i < config.retries) {
                    await new Promise(r => setTimeout(r, 500 * (i + 1)));
                }
            }
        }

        clearTimeout(timeoutId);
        throw lastError;
    }

    /**
     * 이미지 프리로드 (네트워크 상태 고려)
     */
    function preloadImage(url, priority = 'low') {
        // 오프라인이거나 느린 네트워크에서 저우선순위 프리로드 건너뛰기
        if (currentState !== NetworkState.FAST && priority === 'low') {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;

            // 품질 조정된 URL (서버에서 지원하는 경우)
            const quality = getImageQuality();
            let adjustedUrl = url;

            // URL 파라미터로 품질 전달 (서버 지원 시)
            if (url.includes('?')) {
                adjustedUrl += `&q=${quality.quality}&w=${quality.maxWidth}`;
            } else {
                adjustedUrl += `?q=${quality.quality}&w=${quality.maxWidth}`;
            }

            img.src = adjustedUrl;
        });
    }

    /**
     * 비디오 품질 설정
     */
    function getVideoQuality() {
        if (saveDataMode || currentState === NetworkState.SLOW) {
            return '480p';
        }
        return '720p';
    }

    /**
     * 폴링 간격 가져오기
     */
    function getPollingInterval(baseInterval) {
        if (currentState === NetworkState.OFFLINE) {
            return null;  // 폴링 중지
        }

        if (currentState === NetworkState.SLOW || saveDataMode) {
            return baseInterval * 2;  // 2배로 늘림
        }

        return baseInterval;
    }

    /**
     * CSS 클래스로 네트워크 상태 표시
     */
    function updateNetworkClasses() {
        document.body.classList.remove('network-fast', 'network-slow', 'network-offline', 'save-data');

        document.body.classList.add(`network-${currentState}`);

        if (saveDataMode) {
            document.body.classList.add('save-data');
        }
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('network-adaptive-styles')) return;

        const style = document.createElement('style');
        style.id = 'network-adaptive-styles';
        style.textContent = `
            /* 느린 네트워크에서 애니메이션 축소 */
            .network-slow *,
            .save-data * {
                animation-duration: 0.1s !important;
                transition-duration: 0.1s !important;
            }

            /* 느린 네트워크에서 그림자 제거 */
            .network-slow .card,
            .network-slow .modal,
            .save-data .card,
            .save-data .modal {
                box-shadow: none !important;
            }

            /* 느린 네트워크 이미지 플레이스홀더 */
            .network-slow img:not(.lazy-loaded),
            .save-data img:not(.lazy-loaded) {
                background: #f0f0f0;
            }

            /* 오프라인 상태 배지 */
            .network-offline::after {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: #ff6b6b;
                z-index: 10000;
            }

            /* 네트워크 상태 인디케이터 */
            .network-indicator {
                position: fixed;
                bottom: 70px;
                right: 20px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 9990;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
                pointer-events: none;
            }

            .network-indicator.show {
                opacity: 1;
                transform: translateY(0);
            }

            .network-indicator.slow {
                background: #fff3cd;
                color: #856404;
            }

            .network-indicator.offline {
                background: #f8d7da;
                color: #721c24;
            }

            /* 다크모드 */
            [data-theme="dark"] .network-indicator.slow {
                background: #3d3020;
                color: #f39c12;
            }

            [data-theme="dark"] .network-indicator.offline {
                background: #3d2020;
                color: #e74c3c;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 네트워크 인디케이터 표시
     */
    function showNetworkIndicator() {
        let indicator = document.getElementById('networkIndicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'networkIndicator';
            indicator.className = 'network-indicator';
            document.body.appendChild(indicator);
        }

        indicator.classList.remove('slow', 'offline', 'show');

        if (currentState === NetworkState.SLOW) {
            indicator.textContent = '📶 느린 연결';
            indicator.classList.add('slow', 'show');
        } else if (currentState === NetworkState.OFFLINE) {
            indicator.textContent = '📵 오프라인';
            indicator.classList.add('offline', 'show');
        }

        // 5초 후 숨김 (오프라인 제외)
        if (currentState !== NetworkState.OFFLINE) {
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 5000);
        }
    }

    /**
     * 초기화
     */
    function init() {
        addStyles();

        // 초기 상태 감지
        updateNetworkState();
        updateNetworkClasses();

        // 온라인/오프라인 이벤트 리스너
        window.addEventListener('online', () => {
            updateNetworkState();
            updateNetworkClasses();
            showNetworkIndicator();
        });

        window.addEventListener('offline', () => {
            currentState = NetworkState.OFFLINE;
            updateNetworkClasses();
            showNetworkIndicator();
        });

        // Network Information API 변경 감지
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connection.addEventListener('change', () => {
                updateNetworkState();
                updateNetworkClasses();
                showNetworkIndicator();
            });
        }

        // 초기 인디케이터 표시 (느리거나 오프라인인 경우)
        if (currentState !== NetworkState.FAST) {
            showNetworkIndicator();
        }
    }

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.NetworkAdaptive = {
        NetworkState,
        getState: () => currentState,
        isSaveData: () => saveDataMode,
        getImageQuality,
        getRequestConfig,
        getPollingInterval,
        getVideoQuality,
        adaptiveFetch,
        preloadImage,
        updateState: updateNetworkState
    };
})();
