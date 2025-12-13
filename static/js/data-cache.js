/**
 * 데이터 캐싱 모듈
 * API 응답을 캐싱하여 네트워크 요청을 줄이고 빠른 로딩 제공
 * 서버 버전 확인으로 캐시 무효화 지원
 */

// 앱 버전 (배포 시 업데이트 필요)
const APP_VERSION = '2024121301';
const VERSION_KEY = 'crm_app_version';

class DataCache {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'crm_data_cache';
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000;  // 기본 5분
        this.maxSize = options.maxSize || 50;  // 최대 캐시 항목 수
        this.cache = new Map();

        // 버전 체크 후 로드
        this.checkVersion();
        this.loadFromStorage();
    }

    /**
     * 앱 버전 체크 - 버전이 다르면 캐시 초기화
     */
    checkVersion() {
        const savedVersion = localStorage.getItem(VERSION_KEY);

        if (savedVersion !== APP_VERSION) {
            console.log(`[Cache] 버전 변경 감지: ${savedVersion} -> ${APP_VERSION}, 캐시 초기화`);
            localStorage.removeItem(this.storageKey);
            localStorage.setItem(VERSION_KEY, APP_VERSION);
        }
    }

    /**
     * 서버 버전 확인 API 호출
     */
    async checkServerVersion() {
        try {
            const response = await fetch('/api/version', {
                method: 'GET',
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                const serverVersion = data.version;
                const savedVersion = localStorage.getItem(VERSION_KEY);

                if (serverVersion && savedVersion !== serverVersion) {
                    console.log(`[Cache] 서버 버전 변경: ${savedVersion} -> ${serverVersion}`);
                    this.clearAll();
                    localStorage.setItem(VERSION_KEY, serverVersion);

                    // 서비스 워커 캐시도 클리어
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CLEAR_CACHE'
                        });
                    }

                    // 페이지 새로고침 알림
                    if (window.toast) {
                        toast.info('새 버전이 있습니다. 페이지를 새로고침 해주세요.', {
                            duration: 0,
                            action: {
                                text: '새로고침',
                                onClick: () => window.location.reload()
                            }
                        });
                    }

                    return true;  // 버전 변경됨
                }
            }
        } catch (e) {
            console.warn('[Cache] 서버 버전 확인 실패:', e);
        }
        return false;  // 버전 동일 또는 확인 실패
    }

    /**
     * 전체 캐시 삭제
     */
    clearAll() {
        this.cache.clear();
        localStorage.removeItem(this.storageKey);
        console.log('[Cache] 전체 캐시 삭제됨');
    }

    /**
     * localStorage에서 캐시 로드
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                const now = Date.now();

                // 만료되지 않은 항목만 로드
                Object.entries(data).forEach(([key, value]) => {
                    if (value.expiry > now) {
                        this.cache.set(key, value);
                    }
                });
            }
        } catch (e) {
            console.error('캐시 로드 실패:', e);
            this.cache.clear();
        }
    }

    /**
     * localStorage에 캐시 저장
     */
    saveToStorage() {
        try {
            const data = {};
            this.cache.forEach((value, key) => {
                data[key] = value;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            // 저장 용량 초과 시 오래된 캐시 정리
            console.error('캐시 저장 실패:', e);
            this.pruneOldEntries();
        }
    }

    /**
     * 캐시에 데이터 저장
     */
    set(key, data, ttl = this.defaultTTL) {
        // 최대 크기 초과 시 정리
        if (this.cache.size >= this.maxSize) {
            this.pruneOldEntries();
        }

        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            expiry: Date.now() + ttl
        });

        this.saveToStorage();
    }

    /**
     * 캐시에서 데이터 가져오기
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // 만료 확인
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            this.saveToStorage();
            return null;
        }

        return entry.data;
    }

    /**
     * 캐시에 키가 존재하고 유효한지 확인
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 캐시에서 키 삭제
     */
    delete(key) {
        this.cache.delete(key);
        this.saveToStorage();
    }

    /**
     * 특정 패턴의 키 삭제
     */
    deleteByPattern(pattern) {
        const regex = new RegExp(pattern);
        const keysToDelete = [];

        this.cache.forEach((value, key) => {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.cache.delete(key));
        this.saveToStorage();
    }

    /**
     * 전체 캐시 삭제
     */
    clear() {
        this.cache.clear();
        localStorage.removeItem(this.storageKey);
    }

    /**
     * 오래된 항목 정리
     */
    pruneOldEntries() {
        const now = Date.now();
        const entries = [];

        // 모든 항목 수집 및 만료 체크
        this.cache.forEach((value, key) => {
            if (now > value.expiry) {
                this.cache.delete(key);
            } else {
                entries.push({ key, timestamp: value.timestamp });
            }
        });

        // 크기 초과 시 오래된 것부터 삭제
        if (entries.length > this.maxSize * 0.7) {
            entries.sort((a, b) => a.timestamp - b.timestamp);
            const toDelete = entries.slice(0, Math.floor(entries.length * 0.3));
            toDelete.forEach(e => this.cache.delete(e.key));
        }

        this.saveToStorage();
    }

    /**
     * 캐시된 fetch wrapper
     * @param {string} url - API URL
     * @param {object} options - fetch options + cacheOptions
     */
    async fetch(url, options = {}) {
        const {
            cacheKey = url,
            ttl = this.defaultTTL,
            forceRefresh = false,
            staleWhileRevalidate = true,
            ...fetchOptions
        } = options;

        // GET 요청만 캐싱
        const method = (fetchOptions.method || 'GET').toUpperCase();
        if (method !== 'GET') {
            return this.doFetch(url, fetchOptions);
        }

        // 캐시 확인
        const cached = this.get(cacheKey);

        if (cached && !forceRefresh) {
            // stale-while-revalidate: 캐시 반환 후 백그라운드 업데이트
            if (staleWhileRevalidate) {
                this.revalidate(url, cacheKey, ttl, fetchOptions);
            }
            return cached;
        }

        // 캐시 없으면 fetch
        const data = await this.doFetch(url, fetchOptions);
        this.set(cacheKey, data, ttl);
        return data;
    }

    /**
     * 실제 fetch 수행
     */
    async doFetch(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * 백그라운드에서 캐시 갱신
     */
    async revalidate(url, cacheKey, ttl, fetchOptions) {
        try {
            const data = await this.doFetch(url, fetchOptions);
            this.set(cacheKey, data, ttl);

            // 캐시 갱신 이벤트 발생
            window.dispatchEvent(new CustomEvent('cache-updated', {
                detail: { key: cacheKey, data }
            }));
        } catch (e) {
            console.error('캐시 갱신 실패:', e);
        }
    }

    /**
     * 캐시 통계 조회
     */
    getStats() {
        const now = Date.now();
        let validCount = 0;
        let totalSize = 0;

        this.cache.forEach((value, key) => {
            if (value.expiry > now) {
                validCount++;
                totalSize += JSON.stringify(value.data).length;
            }
        });

        return {
            totalEntries: this.cache.size,
            validEntries: validCount,
            estimatedSize: Math.round(totalSize / 1024) + ' KB'
        };
    }
}

// 전역 인스턴스
window.dataCache = new DataCache();

// 편의 함수
window.cachedFetch = async function(url, options = {}) {
    return window.dataCache.fetch(url, options);
};

/**
 * 캐시 인밸리데이션 헬퍼
 * 데이터가 변경되었을 때 관련 캐시 삭제
 */
window.invalidateCache = function(patterns) {
    if (!Array.isArray(patterns)) {
        patterns = [patterns];
    }

    patterns.forEach(pattern => {
        window.dataCache.deleteByPattern(pattern);
    });
};

/**
 * API별 캐싱 설정
 * 자주 사용되는 API에 대한 캐시 TTL 설정
 */
window.CacheConfig = {
    // 자주 변하지 않는 데이터 - 긴 캐시
    USERS: { ttl: 10 * 60 * 1000, key: 'users_list' },           // 10분
    TEAMS: { ttl: 10 * 60 * 1000, key: 'teams_list' },           // 10분
    PROMOTIONS: { ttl: 5 * 60 * 1000, key: 'promotions_list' },  // 5분

    // 자주 변하는 데이터 - 짧은 캐시
    CHATS: { ttl: 1 * 60 * 1000, key: 'chats_list' },            // 1분
    REMINDERS: { ttl: 2 * 60 * 1000, key: 'reminders_list' },    // 2분
    NAV_COUNTS: { ttl: 30 * 1000, key: 'nav_counts' },           // 30초
};

/**
 * 데이터 변경 시 자동 캐시 인밸리데이션
 * POST/PUT/DELETE 요청 후 관련 캐시 삭제
 */
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    const result = await originalFetch(url, options);

    // 데이터 변경 요청인 경우 관련 캐시 삭제
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        // URL 패턴에 따라 캐시 인밸리데이션
        if (url.includes('/api/users')) {
            window.invalidateCache(['users']);
        } else if (url.includes('/api/chats') || url.includes('/api/chat/')) {
            window.invalidateCache(['chats']);
        } else if (url.includes('/api/reminders')) {
            window.invalidateCache(['reminders']);
        } else if (url.includes('/api/promotions')) {
            window.invalidateCache(['promotions']);
        } else if (url.includes('/api/teams')) {
            window.invalidateCache(['teams']);
        }
    }

    return result;
};

/**
 * 페이지 떠날 때 캐시 정리
 */
window.addEventListener('beforeunload', () => {
    if (window.dataCache) {
        window.dataCache.pruneOldEntries();
    }
});

/**
 * 네트워크 상태 감지 - 오프라인일 때 캐시 우선 사용
 */
window.addEventListener('online', () => {
    console.log('온라인 상태 - 캐시 갱신 시작');
    window.dataCache.pruneOldEntries();
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태 - 캐시 사용');
});

/**
 * 페이지 로드 시 서버 버전 확인
 * 버전이 변경되었으면 캐시 초기화 후 알림
 */
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 페이지 제외
    if (window.location.pathname !== '/login' && window.location.pathname !== '/login/') {
        // 페이지 로드 후 2초 뒤 서버 버전 확인 (성능 영향 최소화)
        setTimeout(() => {
            if (window.dataCache && window.dataCache.checkServerVersion) {
                window.dataCache.checkServerVersion();
            }
        }, 2000);
    }
});

/**
 * 페이지 포커스 시에도 버전 확인 (탭 전환 후)
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // 5분마다만 확인 (너무 자주 확인하지 않도록)
        const lastCheck = parseInt(localStorage.getItem('crm_version_last_check') || '0');
        const now = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;

        if (now - lastCheck > FIVE_MINUTES) {
            localStorage.setItem('crm_version_last_check', now.toString());
            if (window.dataCache && window.dataCache.checkServerVersion) {
                window.dataCache.checkServerVersion();
            }
        }
    }
});
