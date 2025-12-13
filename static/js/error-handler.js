/**
 * 전역 에러 핸들러
 * JavaScript 에러, Promise 에러, 네트워크 에러 처리
 */

(function() {
    'use strict';

    // 에러 로그 저장 (최대 50개)
    const errorLog = [];
    const MAX_ERROR_LOG = 50;

    // 무시할 에러 패턴
    const IGNORED_ERRORS = [
        'ResizeObserver loop',
        'Script error.',
        'Non-Error promise rejection',
        'Loading chunk',
        'ChunkLoadError'
    ];

    /**
     * 에러 정보 수집
     */
    function collectErrorInfo(error, source = 'unknown') {
        return {
            message: error.message || String(error),
            stack: error.stack || '',
            source,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            networkStatus: navigator.onLine ? 'online' : 'offline'
        };
    }

    /**
     * 에러 로그에 추가
     */
    function logError(errorInfo) {
        // 무시할 에러 체크
        if (IGNORED_ERRORS.some(pattern => errorInfo.message.includes(pattern))) {
            return;
        }

        // 중복 에러 체크 (같은 메시지가 최근에 있으면 무시)
        const recentSameError = errorLog.find(e =>
            e.message === errorInfo.message &&
            Date.now() - new Date(e.timestamp).getTime() < 5000
        );

        if (recentSameError) {
            return;
        }

        errorLog.unshift(errorInfo);

        // 최대 개수 초과 시 오래된 것 제거
        if (errorLog.length > MAX_ERROR_LOG) {
            errorLog.pop();
        }

        // 콘솔에 출력 (개발용)
        console.error('[ErrorHandler]', errorInfo.message, errorInfo);
    }

    /**
     * 사용자에게 에러 알림
     */
    function notifyUser(errorInfo, options = {}) {
        const {
            showToast = true,
            showModal = false,
            retryAction = null
        } = options;

        // 사용자 친화적 메시지 생성
        let userMessage = '오류가 발생했습니다.';

        if (errorInfo.message.includes('network') || errorInfo.message.includes('fetch')) {
            userMessage = '네트워크 연결을 확인해주세요.';
        } else if (errorInfo.message.includes('timeout')) {
            userMessage = '요청 시간이 초과되었습니다.';
        } else if (errorInfo.message.includes('permission')) {
            userMessage = '권한이 필요합니다.';
        } else if (errorInfo.message.includes('not found') || errorInfo.message.includes('404')) {
            userMessage = '요청하신 항목을 찾을 수 없습니다.';
        }

        // 토스트 알림
        if (showToast && window.toast) {
            if (retryAction) {
                toast.error(userMessage, {
                    duration: 0,
                    action: {
                        text: '다시 시도',
                        onClick: retryAction
                    }
                });
            } else {
                toast.error(userMessage, { duration: 5000 });
            }
        }

        // 모달 알림 (심각한 에러)
        if (showModal) {
            showErrorModal(userMessage, errorInfo);
        }
    }

    /**
     * 에러 모달 표시
     */
    function showErrorModal(message, errorInfo) {
        // 기존 모달 제거
        const existing = document.getElementById('errorModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'errorModal';
        modal.innerHTML = `
            <div class="error-modal-overlay">
                <div class="error-modal-box">
                    <div class="error-modal-icon">⚠️</div>
                    <div class="error-modal-title">오류 발생</div>
                    <div class="error-modal-message">${message}</div>
                    <div class="error-modal-actions">
                        <button class="error-modal-btn primary" onclick="window.location.reload()">
                            새로고침
                        </button>
                        <button class="error-modal-btn secondary" onclick="document.getElementById('errorModal').remove()">
                            닫기
                        </button>
                    </div>
                    <details class="error-modal-details">
                        <summary>기술적 세부사항</summary>
                        <pre>${errorInfo.message}\n${errorInfo.stack || ''}</pre>
                    </details>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * API 에러 처리
     */
    function handleApiError(response, options = {}) {
        const { retryAction, silent = false } = options;

        let errorMessage = '';

        switch (response.status) {
            case 400:
                errorMessage = '잘못된 요청입니다.';
                break;
            case 401:
                errorMessage = '로그인이 필요합니다.';
                // 로그인 페이지로 리다이렉트
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
                    return;
                }
                break;
            case 403:
                errorMessage = '권한이 없습니다.';
                break;
            case 404:
                errorMessage = '요청하신 항목을 찾을 수 없습니다.';
                break;
            case 429:
                errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
                break;
            case 500:
            case 502:
            case 503:
                errorMessage = '서버 오류가 발생했습니다.';
                break;
            default:
                errorMessage = `오류가 발생했습니다. (${response.status})`;
        }

        const errorInfo = collectErrorInfo(new Error(errorMessage), 'api');
        errorInfo.statusCode = response.status;

        logError(errorInfo);

        if (!silent) {
            notifyUser(errorInfo, { retryAction });
        }

        return errorInfo;
    }

    /**
     * fetch 래퍼 (에러 처리 포함)
     */
    async function safeFetch(url, options = {}) {
        const { retryCount = 0, maxRetries = 2, silent = false, ...fetchOptions } = options;

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                handleApiError(response, {
                    silent,
                    retryAction: retryCount < maxRetries ? () => safeFetch(url, { ...options, retryCount: retryCount + 1 }) : null
                });
                return null;
            }

            return response;
        } catch (error) {
            const errorInfo = collectErrorInfo(error, 'fetch');
            logError(errorInfo);

            if (!silent) {
                notifyUser(errorInfo, {
                    retryAction: retryCount < maxRetries ? () => safeFetch(url, { ...options, retryCount: retryCount + 1 }) : null
                });
            }

            return null;
        }
    }

    /**
     * try-catch 래퍼
     */
    function tryCatch(fn, fallback = null, options = {}) {
        return function(...args) {
            try {
                const result = fn.apply(this, args);

                // Promise 처리
                if (result instanceof Promise) {
                    return result.catch(error => {
                        const errorInfo = collectErrorInfo(error, 'async');
                        logError(errorInfo);

                        if (!options.silent) {
                            notifyUser(errorInfo);
                        }

                        return typeof fallback === 'function' ? fallback(error) : fallback;
                    });
                }

                return result;
            } catch (error) {
                const errorInfo = collectErrorInfo(error, 'sync');
                logError(errorInfo);

                if (!options.silent) {
                    notifyUser(errorInfo);
                }

                return typeof fallback === 'function' ? fallback(error) : fallback;
            }
        };
    }

    /**
     * 에러 로그 가져오기
     */
    function getErrorLog() {
        return [...errorLog];
    }

    /**
     * 에러 로그 지우기
     */
    function clearErrorLog() {
        errorLog.length = 0;
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('error-handler-styles')) return;

        const style = document.createElement('style');
        style.id = 'error-handler-styles';
        style.textContent = `
            .error-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.2s ease;
            }

            .error-modal-box {
                background: white;
                border-radius: 12px;
                padding: 30px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }

            .error-modal-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }

            .error-modal-title {
                font-size: 20px;
                font-weight: bold;
                color: #dc3545;
                margin-bottom: 10px;
            }

            .error-modal-message {
                color: #666;
                margin-bottom: 20px;
                line-height: 1.5;
            }

            .error-modal-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
            }

            .error-modal-btn {
                padding: 10px 24px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }

            .error-modal-btn.primary {
                background: #667eea;
                color: white;
            }

            .error-modal-btn.primary:hover {
                background: #5568d3;
            }

            .error-modal-btn.secondary {
                background: #f0f0f0;
                color: #333;
            }

            .error-modal-btn.secondary:hover {
                background: #e0e0e0;
            }

            .error-modal-details {
                margin-top: 20px;
                text-align: left;
                font-size: 12px;
                color: #999;
            }

            .error-modal-details summary {
                cursor: pointer;
                padding: 5px;
            }

            .error-modal-details pre {
                background: #f5f5f5;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                max-height: 150px;
                font-size: 11px;
            }

            /* 다크모드 */
            [data-theme="dark"] .error-modal-box {
                background: #1e1e1e;
            }

            [data-theme="dark"] .error-modal-message {
                color: #aaa;
            }

            [data-theme="dark"] .error-modal-btn.secondary {
                background: #333;
                color: #e0e0e0;
            }

            [data-theme="dark"] .error-modal-details pre {
                background: #2d2d2d;
                color: #ccc;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 전역 에러 핸들러 등록
     */
    function setupGlobalHandlers() {
        // JavaScript 에러
        window.onerror = function(message, source, lineno, colno, error) {
            const errorInfo = collectErrorInfo(error || new Error(message), 'global');
            errorInfo.source = source;
            errorInfo.line = lineno;
            errorInfo.column = colno;

            logError(errorInfo);

            // 심각한 에러만 사용자에게 알림
            if (message.includes('TypeError') || message.includes('ReferenceError')) {
                notifyUser(errorInfo, { showToast: true });
            }

            return false;  // 기본 에러 처리 유지
        };

        // Promise 에러
        window.addEventListener('unhandledrejection', function(event) {
            const error = event.reason;
            const errorInfo = collectErrorInfo(error, 'promise');

            logError(errorInfo);

            // 네트워크 관련 에러만 사용자에게 알림
            if (errorInfo.message.includes('fetch') || errorInfo.message.includes('network')) {
                notifyUser(errorInfo, { showToast: true });
            }
        });

        // 리소스 로딩 에러
        window.addEventListener('error', function(event) {
            if (event.target !== window) {
                // 이미지, 스크립트 등 리소스 로딩 실패
                const target = event.target;
                const src = target.src || target.href || '';

                const errorInfo = {
                    message: `리소스 로딩 실패: ${src}`,
                    source: 'resource',
                    resourceType: target.tagName,
                    url: src,
                    timestamp: new Date().toISOString()
                };

                logError(errorInfo);
            }
        }, true);
    }

    /**
     * 초기화
     */
    function init() {
        addStyles();
        setupGlobalHandlers();
    }

    // 즉시 초기화 (가능한 빨리 에러 캐치)
    init();

    // 전역 노출
    window.ErrorHandler = {
        handleApiError,
        safeFetch,
        tryCatch,
        getErrorLog,
        clearErrorLog,
        notifyUser,
        logError: (error, source) => logError(collectErrorInfo(error, source))
    };
})();
