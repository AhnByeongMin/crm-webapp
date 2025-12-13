/**
 * 성능 최적화 유틸리티
 * debounce, throttle, requestAnimationFrame 활용
 */

(function() {
    'use strict';

    /**
     * Debounce - 연속 호출 시 마지막 호출만 실행
     * @param {Function} func - 실행할 함수
     * @param {number} wait - 대기 시간 (ms)
     * @param {boolean} immediate - 첫 호출 즉시 실행 여부
     */
    function debounce(func, wait = 300, immediate = false) {
        let timeout;

        return function executedFunction(...args) {
            const context = this;

            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            const callNow = immediate && !timeout;

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) func.apply(context, args);
        };
    }

    /**
     * Throttle - 일정 간격으로만 실행
     * @param {Function} func - 실행할 함수
     * @param {number} limit - 실행 간격 (ms)
     */
    function throttle(func, limit = 100) {
        let inThrottle;
        let lastFunc;
        let lastRan;

        return function executedFunction(...args) {
            const context = this;

            if (!inThrottle) {
                func.apply(context, args);
                lastRan = Date.now();
                inThrottle = true;

                setTimeout(() => {
                    inThrottle = false;
                    if (lastFunc) {
                        lastFunc();
                        lastFunc = null;
                    }
                }, limit);
            } else {
                lastFunc = () => func.apply(context, args);
            }
        };
    }

    /**
     * requestAnimationFrame 기반 throttle
     * 화면 렌더링에 최적화
     */
    function rafThrottle(func) {
        let rafId = null;

        return function executedFunction(...args) {
            const context = this;

            if (rafId) return;

            rafId = requestAnimationFrame(() => {
                func.apply(context, args);
                rafId = null;
            });
        };
    }

    /**
     * 지연 실행 (Idle Callback 활용)
     * 브라우저가 한가할 때 실행
     */
    function whenIdle(func, timeout = 2000) {
        if ('requestIdleCallback' in window) {
            return requestIdleCallback(func, { timeout });
        } else {
            return setTimeout(func, 1);
        }
    }

    /**
     * 검색 입력에 debounce 자동 적용
     */
    function setupSearchDebounce() {
        const searchInputs = document.querySelectorAll(
            'input[type="search"], input[type="text"][id*="search"], input[type="text"][id*="Search"], #searchInput, #searchKeyword'
        );

        searchInputs.forEach(input => {
            if (input.dataset.debounced) return;

            const originalOnInput = input.oninput;
            const originalOnKeyup = input.onkeyup;

            if (originalOnInput) {
                input.oninput = debounce(function(e) {
                    originalOnInput.call(this, e);
                }, 300);
            }

            if (originalOnKeyup) {
                input.onkeyup = debounce(function(e) {
                    originalOnKeyup.call(this, e);
                }, 300);
            }

            input.dataset.debounced = 'true';
        });
    }

    /**
     * 스크롤 이벤트 최적화
     */
    function optimizeScrollHandlers() {
        const scrollElements = document.querySelectorAll('.messages, .chat-list, .reminders-section');

        scrollElements.forEach(el => {
            if (el.dataset.scrollOptimized) return;

            const handlers = el._scrollHandlers || [];

            // 기존 핸들러 수집 (제거 불가능한 경우)
            el._optimizedScrollHandler = rafThrottle(function(e) {
                handlers.forEach(handler => handler.call(el, e));
            });

            el.dataset.scrollOptimized = 'true';
        });
    }

    /**
     * resize 이벤트 최적화
     */
    function optimizeResizeHandler() {
        let resizeHandlers = [];

        // 기존 resize 핸들러 수집
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = function(type, handler, options) {
            if (type === 'resize') {
                resizeHandlers.push(handler);
                return;
            }
            return originalAddEventListener.call(this, type, handler, options);
        };

        // 최적화된 resize 핸들러
        const optimizedResizeHandler = debounce(function(e) {
            resizeHandlers.forEach(handler => {
                try {
                    handler(e);
                } catch (err) {
                    console.error('Resize handler error:', err);
                }
            });
        }, 150);

        originalAddEventListener.call(window, 'resize', optimizedResizeHandler);
    }

    /**
     * 이미지 프리로드
     */
    function preloadImages(urls) {
        return Promise.all(
            urls.map(url => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(url);
                    img.onerror = () => reject(url);
                    img.src = url;
                });
            })
        );
    }

    /**
     * 메모이제이션 (함수 결과 캐싱)
     */
    function memoize(func, keyResolver) {
        const cache = new Map();

        return function memoized(...args) {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);

            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = func.apply(this, args);
            cache.set(key, result);

            // 캐시 크기 제한 (100개)
            if (cache.size > 100) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }

            return result;
        };
    }

    /**
     * 배치 DOM 업데이트
     * 여러 DOM 변경을 한 번에 처리
     */
    function batchDOMUpdates(updates) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                // 레이아웃 읽기 먼저
                const reads = updates.filter(u => u.type === 'read').map(u => u.fn());

                // 그 다음 쓰기
                updates.filter(u => u.type === 'write').forEach(u => u.fn());

                resolve(reads);
            });
        });
    }

    /**
     * 포커스 트랩 (무한 스크롤용)
     * 스크롤 끝에 도달하면 더 로드
     */
    function setupInfiniteScroll(container, loadMore, options = {}) {
        const {
            threshold = 100,  // 끝에서 몇 픽셀 전에 로드 시작
            throttleMs = 200
        } = options;

        const handleScroll = throttle(function() {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            // 하단 근처
            if (scrollHeight - scrollTop - clientHeight < threshold) {
                loadMore('bottom');
            }

            // 상단 근처
            if (scrollTop < threshold) {
                loadMore('top');
            }
        }, throttleMs);

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => container.removeEventListener('scroll', handleScroll);
    }

    // 초기화
    function init() {
        whenIdle(() => {
            setupSearchDebounce();
            optimizeScrollHandlers();
        });
    }

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.PerformanceUtils = {
        debounce,
        throttle,
        rafThrottle,
        whenIdle,
        preloadImages,
        memoize,
        batchDOMUpdates,
        setupInfiniteScroll,
        setupSearchDebounce
    };

    // 단축 전역 함수
    window.debounce = debounce;
    window.throttle = throttle;
})();
