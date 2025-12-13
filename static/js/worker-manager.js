/**
 * 웹 워커 매니저
 * 무거운 계산을 백그라운드 스레드에서 처리
 */

(function() {
    'use strict';

    // 워커 인스턴스 캐시
    const workers = new Map();
    const pendingRequests = new Map();
    let requestId = 0;

    /**
     * 워커 생성 또는 가져오기
     */
    function getWorker(workerPath) {
        if (!workers.has(workerPath)) {
            if (!window.Worker) {
                console.warn('[WorkerManager] Web Worker not supported');
                return null;
            }

            try {
                const worker = new Worker(workerPath);

                worker.onmessage = (e) => {
                    const { id, result, error } = e.data;
                    const pending = pendingRequests.get(id);

                    if (pending) {
                        pendingRequests.delete(id);
                        if (error) {
                            pending.reject(new Error(error));
                        } else {
                            pending.resolve(result);
                        }
                    }
                };

                worker.onerror = (error) => {
                    console.error('[WorkerManager] Worker error:', error);
                };

                workers.set(workerPath, worker);
            } catch (err) {
                console.error('[WorkerManager] Failed to create worker:', err);
                return null;
            }
        }

        return workers.get(workerPath);
    }

    /**
     * 워커에 메시지 전송
     */
    function postMessage(workerPath, type, data, transferable = []) {
        return new Promise((resolve, reject) => {
            const worker = getWorker(workerPath);

            if (!worker) {
                // 폴백: 메인 스레드에서 실행
                reject(new Error('Worker not available'));
                return;
            }

            const id = ++requestId;
            pendingRequests.set(id, { resolve, reject });

            worker.postMessage({ type, data, id }, transferable);

            // 타임아웃 (30초)
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Worker request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * 워커 종료
     */
    function terminateWorker(workerPath) {
        const worker = workers.get(workerPath);
        if (worker) {
            worker.terminate();
            workers.delete(workerPath);
        }
    }

    /**
     * 모든 워커 종료
     */
    function terminateAll() {
        workers.forEach(worker => worker.terminate());
        workers.clear();
        pendingRequests.clear();
    }

    // ========== 검색 워커 API ==========

    const SEARCH_WORKER = '/static/js/workers/search-worker.js';

    /**
     * 검색 인덱스 생성
     */
    async function buildSearchIndex(items, fields) {
        try {
            return await postMessage(SEARCH_WORKER, 'INDEX', { items, fields });
        } catch (err) {
            console.warn('[WorkerManager] Fallback to main thread indexing');
            return { indexed: items.length, tokens: 0 };
        }
    }

    /**
     * 검색 실행
     */
    async function search(query, options = {}) {
        try {
            return await postMessage(SEARCH_WORKER, 'SEARCH', { query, options });
        } catch (err) {
            console.warn('[WorkerManager] Search fallback');
            return { query, total: 0, results: [] };
        }
    }

    /**
     * 필터링
     */
    async function filter(items, filters) {
        try {
            return await postMessage(SEARCH_WORKER, 'FILTER', { items, filters });
        } catch (err) {
            // 폴백: 메인 스레드에서 필터링
            return filterFallback(items, filters);
        }
    }

    /**
     * 정렬
     */
    async function sort(items, sortBy) {
        try {
            return await postMessage(SEARCH_WORKER, 'SORT', { items, sortBy });
        } catch (err) {
            // 폴백: 메인 스레드에서 정렬
            return sortFallback(items, sortBy);
        }
    }

    /**
     * 집계
     */
    async function aggregate(items, groupBy, aggregations) {
        try {
            return await postMessage(SEARCH_WORKER, 'AGGREGATE', { items, groupBy, aggregations });
        } catch (err) {
            console.warn('[WorkerManager] Aggregate fallback not implemented');
            return [];
        }
    }

    // ========== 폴백 함수 ==========

    function filterFallback(items, filters) {
        const results = items.filter(item => {
            return filters.every(f => {
                const value = getNestedValue(item, f.field);

                switch (f.operator) {
                    case 'eq': return value === f.value;
                    case 'contains': return String(value).toLowerCase().includes(String(f.value).toLowerCase());
                    default: return true;
                }
            });
        });

        return { total: results.length, items: results };
    }

    function sortFallback(items, sortBy) {
        return [...items].sort((a, b) => {
            for (const s of sortBy) {
                const aVal = getNestedValue(a, s.field);
                const bVal = getNestedValue(b, s.field);
                const cmp = aVal < bVal ? -1 : (aVal > bVal ? 1 : 0);
                if (cmp !== 0) return s.direction === 'desc' ? -cmp : cmp;
            }
            return 0;
        });
    }

    function getNestedValue(obj, path) {
        return path.split('.').reduce((c, k) => c && c[k], obj);
    }

    // ========== 유틸리티 ==========

    /**
     * 무거운 작업을 워커에서 실행
     */
    async function runHeavyTask(fn, ...args) {
        // 인라인 워커 생성
        const blob = new Blob([`
            self.onmessage = function(e) {
                try {
                    const fn = new Function('return ' + e.data.fn)();
                    const result = fn(...e.data.args);
                    self.postMessage({ result });
                } catch (error) {
                    self.postMessage({ error: error.message });
                }
            };
        `], { type: 'application/javascript' });

        const workerUrl = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            const worker = new Worker(workerUrl);

            worker.onmessage = (e) => {
                URL.revokeObjectURL(workerUrl);
                worker.terminate();

                if (e.data.error) {
                    reject(new Error(e.data.error));
                } else {
                    resolve(e.data.result);
                }
            };

            worker.onerror = (err) => {
                URL.revokeObjectURL(workerUrl);
                worker.terminate();
                reject(err);
            };

            worker.postMessage({
                fn: fn.toString(),
                args
            });
        });
    }

    /**
     * 청크 단위로 배열 처리
     */
    async function processInChunks(items, processor, chunkSize = 100) {
        const results = [];

        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const processed = await processor(chunk);
            results.push(...processed);

            // UI 업데이트 기회 제공
            await new Promise(r => setTimeout(r, 0));
        }

        return results;
    }

    /**
     * requestIdleCallback 래퍼
     */
    function runWhenIdle(fn, timeout = 5000) {
        return new Promise(resolve => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(
                    (deadline) => {
                        resolve(fn(deadline));
                    },
                    { timeout }
                );
            } else {
                setTimeout(() => resolve(fn()), 1);
            }
        });
    }

    // 페이지 언로드 시 워커 정리
    window.addEventListener('beforeunload', terminateAll);

    // 전역 노출
    window.WorkerManager = {
        getWorker,
        postMessage,
        terminateWorker,
        terminateAll,
        // 검색 API
        buildSearchIndex,
        search,
        filter,
        sort,
        aggregate,
        // 유틸리티
        runHeavyTask,
        processInChunks,
        runWhenIdle
    };
})();
