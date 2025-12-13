/**
 * CSRF 토큰 헬퍼
 * 모든 AJAX 요청에 CSRF 토큰 자동 포함
 */

(function() {
    'use strict';

    // CSRF 토큰 메타 태그에서 가져오기
    function getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    }

    // fetch 오버라이드하여 CSRF 토큰 자동 추가
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // GET, HEAD, OPTIONS는 CSRF 제외
        const method = (options.method || 'GET').toUpperCase();
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return originalFetch(url, options);
        }

        // CSRF 토큰 헤더 추가
        const token = getCSRFToken();
        if (token) {
            options.headers = options.headers || {};
            if (options.headers instanceof Headers) {
                if (!options.headers.has('X-CSRFToken')) {
                    options.headers.set('X-CSRFToken', token);
                }
            } else {
                if (!options.headers['X-CSRFToken']) {
                    options.headers['X-CSRFToken'] = token;
                }
            }
        }

        return originalFetch(url, options);
    };

    // XMLHttpRequest 오버라이드
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._csrfMethod = method.toUpperCase();
        return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(body) {
        // POST, PUT, DELETE, PATCH에 CSRF 토큰 추가
        if (!['GET', 'HEAD', 'OPTIONS'].includes(this._csrfMethod)) {
            const token = getCSRFToken();
            if (token && !this._csrfTokenSet) {
                this.setRequestHeader('X-CSRFToken', token);
                this._csrfTokenSet = true;
            }
        }
        return originalXHRSend.call(this, body);
    };

    // jQuery AJAX 설정 (jQuery 사용 시)
    if (typeof $ !== 'undefined' && $.ajaxSetup) {
        $.ajaxSetup({
            beforeSend: function(xhr, settings) {
                if (!['GET', 'HEAD', 'OPTIONS'].includes(settings.type?.toUpperCase())) {
                    const token = getCSRFToken();
                    if (token) {
                        xhr.setRequestHeader('X-CSRFToken', token);
                    }
                }
            }
        });
    }

    // 폼에 CSRF 토큰 자동 추가
    function addCSRFToForms() {
        const token = getCSRFToken();
        if (!token) return;

        document.querySelectorAll('form').forEach(form => {
            // 이미 있으면 스킵
            if (form.querySelector('input[name="csrf_token"]')) return;

            // GET 메서드는 제외
            if (form.method?.toUpperCase() === 'GET') return;

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'csrf_token';
            input.value = token;
            form.appendChild(input);
        });
    }

    // DOM 로드 후 폼에 토큰 추가
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addCSRFToForms);
    } else {
        addCSRFToForms();
    }

    // 동적 폼 감지
    const observer = new MutationObserver(() => {
        addCSRFToForms();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // CSRF 에러 처리
    window.addEventListener('unhandledrejection', function(event) {
        if (event.reason?.message?.includes('CSRF')) {
            console.error('CSRF 토큰 오류. 페이지를 새로고침하세요.');
            if (window.toast) {
                toast.error('세션이 만료되었습니다. 페이지를 새로고침해주세요.');
            }
        }
    });

    // 글로벌 노출
    window.CSRFHelper = {
        getToken: getCSRFToken,
        refreshToken: function() {
            // 토큰 갱신이 필요한 경우 페이지 새로고침
            location.reload();
        }
    };
})();
