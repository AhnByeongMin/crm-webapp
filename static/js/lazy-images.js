/**
 * 이미지 Lazy Loading 모듈
 * Intersection Observer API를 사용한 이미지 지연 로딩
 */

class LazyImageLoader {
    constructor(options = {}) {
        this.rootMargin = options.rootMargin || '50px';
        this.threshold = options.threshold || 0.1;
        this.loadedClass = options.loadedClass || 'lazy-loaded';
        this.errorClass = options.errorClass || 'lazy-error';
        this.placeholderSrc = options.placeholderSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';

        this.observer = null;
        this.init();
    }

    init() {
        // Intersection Observer 지원 확인
        if (!('IntersectionObserver' in window)) {
            // 폴백: 모든 이미지 즉시 로드
            this.loadAllImages();
            return;
        }

        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: this.rootMargin,
                threshold: this.threshold
            }
        );

        // 스타일 추가
        this.addStyles();

        // 기존 이미지 관찰
        this.observeImages();

        // DOM 변경 감지 (동적으로 추가되는 이미지)
        this.observeMutations();
    }

    addStyles() {
        if (document.getElementById('lazy-image-styles')) return;

        const style = document.createElement('style');
        style.id = 'lazy-image-styles';
        style.textContent = `
            /* Lazy 이미지 기본 상태 */
            img[data-src],
            img.lazy {
                opacity: 0;
                transition: opacity 0.3s ease;
                background: #f0f0f0;
            }

            /* 로드 완료 */
            img.lazy-loaded {
                opacity: 1;
            }

            /* 로드 실패 */
            img.lazy-error {
                opacity: 0.5;
                filter: grayscale(100%);
            }

            /* 프로필 이미지 플레이스홀더 */
            .profile-image-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-weight: bold;
                font-size: 14px;
            }

            /* 채팅 이미지 플레이스홀더 */
            .chat-image-placeholder {
                background: #e9ecef;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #adb5bd;
                font-size: 24px;
            }

            /* 다크모드 */
            [data-theme="dark"] img[data-src],
            [data-theme="dark"] img.lazy {
                background: #374151;
            }

            [data-theme="dark"] .chat-image-placeholder {
                background: #374151;
                color: #6b7280;
            }

            /* 스켈레톤 애니메이션 */
            img[data-src]:not(.lazy-loaded)::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: lazy-shimmer 1.5s infinite;
            }

            @keyframes lazy-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    observeImages() {
        // data-src 속성이 있는 이미지
        const images = document.querySelectorAll('img[data-src]:not(.lazy-loaded)');
        images.forEach(img => this.observe(img));
    }

    observe(img) {
        if (!this.observer || img.classList.contains(this.loadedClass)) return;

        // 플레이스홀더 설정
        if (!img.src || img.src === '') {
            img.src = this.placeholderSrc;
        }

        this.observer.observe(img);
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.loadImage(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    }

    loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;

        // 이미지 프리로드
        const tempImage = new Image();

        tempImage.onload = () => {
            img.src = src;
            img.classList.add(this.loadedClass);
            img.classList.remove(this.errorClass);

            // 커스텀 이벤트 발생
            img.dispatchEvent(new CustomEvent('lazyloaded', { detail: { src } }));
        };

        tempImage.onerror = () => {
            // 에러 시 플레이스홀더 유지 또는 에러 이미지
            img.classList.add(this.errorClass);
            console.warn('Image load failed:', src);

            // 프로필 이미지인 경우 이니셜 표시
            if (img.dataset.fallbackInitial) {
                this.showInitialFallback(img);
            }
        };

        tempImage.src = src;
    }

    showInitialFallback(img) {
        const initial = img.dataset.fallbackInitial || '?';
        const wrapper = document.createElement('div');
        wrapper.className = 'profile-image-placeholder';
        wrapper.style.cssText = img.style.cssText;
        wrapper.style.width = img.width + 'px';
        wrapper.style.height = img.height + 'px';
        wrapper.style.borderRadius = getComputedStyle(img).borderRadius;
        wrapper.textContent = initial;

        img.parentNode.replaceChild(wrapper, img);
    }

    observeMutations() {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        // 추가된 노드가 이미지인 경우
                        if (node.tagName === 'IMG' && node.dataset.src) {
                            this.observe(node);
                        }
                        // 자식 중 이미지 찾기
                        const images = node.querySelectorAll?.('img[data-src]:not(.lazy-loaded)');
                        images?.forEach(img => this.observe(img));
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    loadAllImages() {
        // 폴백: 모든 lazy 이미지 즉시 로드
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.classList.add(this.loadedClass);
            }
        });
    }

    // 수동 트리거
    refresh() {
        this.observeImages();
    }
}

// 유틸리티: 이미지 src를 lazy로 변환
function makeLazy(img) {
    if (!img.dataset.src && img.src) {
        img.dataset.src = img.src;
        img.src = window.lazyImageLoader?.placeholderSrc || '';
        img.classList.remove('lazy-loaded');
        window.lazyImageLoader?.observe(img);
    }
}

// 프로필 이미지 헬퍼
function createLazyProfileImage(src, name, size = 40) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return `<img
        data-src="${src}"
        data-fallback-initial="${initial}"
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'%3E%3Crect fill='%23667eea' width='${size}' height='${size}'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='white' font-size='${size/2}' font-family='sans-serif'%3E${initial}%3C/text%3E%3C/svg%3E"
        alt="${name}"
        width="${size}"
        height="${size}"
        style="border-radius: 50%;"
    >`;
}

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.lazyImageLoader = new LazyImageLoader();
});

// 전역 노출
window.LazyImageLoader = LazyImageLoader;
window.makeLazy = makeLazy;
window.createLazyProfileImage = createLazyProfileImage;
