/**
 * 애니메이션 최적화 모듈
 * GPU 가속, will-change 관리, 리듀스드 모션 지원
 */

(function() {
    'use strict';

    // 리듀스드 모션 선호도 감지
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 저전력 모드 감지 (배터리 API)
    let isLowPowerMode = false;

    /**
     * 배터리 상태 확인
     */
    async function checkBatteryStatus() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                isLowPowerMode = battery.level < 0.2 && !battery.charging;

                battery.addEventListener('levelchange', () => {
                    isLowPowerMode = battery.level < 0.2 && !battery.charging;
                    updateAnimationMode();
                });

                battery.addEventListener('chargingchange', () => {
                    isLowPowerMode = battery.level < 0.2 && !battery.charging;
                    updateAnimationMode();
                });
            } catch (e) {
                // 배터리 API 실패 무시
            }
        }
    }

    /**
     * 애니메이션 모드 업데이트
     */
    function updateAnimationMode() {
        const shouldReduce = prefersReducedMotion || isLowPowerMode;

        document.body.classList.toggle('reduce-motion', shouldReduce);
        document.body.classList.toggle('low-power', isLowPowerMode);
    }

    /**
     * will-change 동적 관리
     * 애니메이션 시작 전 설정, 완료 후 제거
     */
    function manageWillChange(element, properties, duration = 300) {
        // 애니메이션 시작 전 will-change 설정
        element.style.willChange = properties;

        // 애니메이션 완료 후 제거
        const cleanup = () => {
            element.style.willChange = 'auto';
        };

        // transitionend 또는 animationend로 정리
        const handler = () => {
            cleanup();
            element.removeEventListener('transitionend', handler);
            element.removeEventListener('animationend', handler);
        };

        element.addEventListener('transitionend', handler, { once: true });
        element.addEventListener('animationend', handler, { once: true });

        // 폴백: 일정 시간 후 강제 정리
        setTimeout(cleanup, duration + 100);

        return cleanup;
    }

    /**
     * GPU 가속 적용
     */
    function enableGPU(element) {
        element.style.transform = 'translateZ(0)';
        element.style.backfaceVisibility = 'hidden';
    }

    /**
     * GPU 가속 해제
     */
    function disableGPU(element) {
        element.style.transform = '';
        element.style.backfaceVisibility = '';
    }

    /**
     * 스크롤 기반 애니메이션 최적화
     * Intersection Observer 사용
     */
    function observeForAnimation(selector, animationClass, options = {}) {
        const {
            threshold = 0.1,
            rootMargin = '0px',
            once = true
        } = options;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // will-change 설정
                    entry.target.style.willChange = 'opacity, transform';

                    // 애니메이션 클래스 추가
                    requestAnimationFrame(() => {
                        entry.target.classList.add(animationClass);
                    });

                    // will-change 정리
                    setTimeout(() => {
                        entry.target.style.willChange = 'auto';
                    }, 500);

                    if (once) {
                        observer.unobserve(entry.target);
                    }
                } else if (!once) {
                    entry.target.classList.remove(animationClass);
                }
            });
        }, { threshold, rootMargin });

        document.querySelectorAll(selector).forEach(el => observer.observe(el));

        return observer;
    }

    /**
     * 부드러운 스크롤 (requestAnimationFrame 기반)
     */
    function smoothScrollTo(target, duration = 500) {
        const targetElement = typeof target === 'string' ? document.querySelector(target) : target;
        if (!targetElement) return;

        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);

            // easeInOutCubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            window.scrollTo(0, startPosition + distance * ease);

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }

        requestAnimationFrame(animation);
    }

    /**
     * 페이드 애니메이션
     */
    function fadeIn(element, duration = 300) {
        if (prefersReducedMotion) {
            element.style.opacity = '1';
            element.style.display = '';
            return Promise.resolve();
        }

        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.display = '';
            element.style.willChange = 'opacity';
            element.style.transition = `opacity ${duration}ms ease`;

            requestAnimationFrame(() => {
                element.style.opacity = '1';
            });

            setTimeout(() => {
                element.style.willChange = 'auto';
                element.style.transition = '';
                resolve();
            }, duration);
        });
    }

    function fadeOut(element, duration = 300) {
        if (prefersReducedMotion) {
            element.style.opacity = '0';
            element.style.display = 'none';
            return Promise.resolve();
        }

        return new Promise(resolve => {
            element.style.willChange = 'opacity';
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '0';

            setTimeout(() => {
                element.style.display = 'none';
                element.style.willChange = 'auto';
                element.style.transition = '';
                resolve();
            }, duration);
        });
    }

    /**
     * 슬라이드 애니메이션
     */
    function slideDown(element, duration = 300) {
        if (prefersReducedMotion) {
            element.style.display = '';
            element.style.height = 'auto';
            return Promise.resolve();
        }

        return new Promise(resolve => {
            element.style.display = '';
            const height = element.scrollHeight;

            element.style.overflow = 'hidden';
            element.style.height = '0';
            element.style.willChange = 'height';
            element.style.transition = `height ${duration}ms ease`;

            requestAnimationFrame(() => {
                element.style.height = height + 'px';
            });

            setTimeout(() => {
                element.style.height = 'auto';
                element.style.overflow = '';
                element.style.willChange = 'auto';
                element.style.transition = '';
                resolve();
            }, duration);
        });
    }

    function slideUp(element, duration = 300) {
        if (prefersReducedMotion) {
            element.style.display = 'none';
            return Promise.resolve();
        }

        return new Promise(resolve => {
            const height = element.scrollHeight;
            element.style.height = height + 'px';
            element.style.overflow = 'hidden';
            element.style.willChange = 'height';
            element.style.transition = `height ${duration}ms ease`;

            requestAnimationFrame(() => {
                element.style.height = '0';
            });

            setTimeout(() => {
                element.style.display = 'none';
                element.style.height = '';
                element.style.overflow = '';
                element.style.willChange = 'auto';
                element.style.transition = '';
                resolve();
            }, duration);
        });
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('animation-optimizer-styles')) return;

        const style = document.createElement('style');
        style.id = 'animation-optimizer-styles';
        style.textContent = `
            /* 리듀스드 모션 */
            .reduce-motion *,
            .reduce-motion *::before,
            .reduce-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }

            /* 저전력 모드 */
            .low-power * {
                animation: none !important;
                transition: none !important;
            }

            .low-power .card,
            .low-power .modal {
                box-shadow: none !important;
            }

            /* GPU 가속 헬퍼 클래스 */
            .gpu-accelerated {
                transform: translateZ(0);
                backface-visibility: hidden;
                perspective: 1000px;
            }

            /* 공통 애니메이션 클래스 */
            .fade-in {
                animation: fadeInAnim 0.3s ease forwards;
            }

            .fade-out {
                animation: fadeOutAnim 0.3s ease forwards;
            }

            .slide-up {
                animation: slideUpAnim 0.3s ease forwards;
            }

            .slide-down {
                animation: slideDownAnim 0.3s ease forwards;
            }

            .scale-in {
                animation: scaleInAnim 0.2s ease forwards;
            }

            @keyframes fadeInAnim {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes fadeOutAnim {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            @keyframes slideUpAnim {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideDownAnim {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes scaleInAnim {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            /* 스크롤 애니메이션용 초기 상태 */
            .animate-on-scroll {
                opacity: 0;
                transform: translateY(30px);
                transition: opacity 0.5s ease, transform 0.5s ease;
            }

            .animate-on-scroll.visible {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 초기화
     */
    function init() {
        addStyles();
        checkBatteryStatus();
        updateAnimationMode();

        // 리듀스드 모션 설정 변경 감지
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            updateAnimationMode();
        });

        // 스크롤 애니메이션 자동 적용
        if (!prefersReducedMotion) {
            observeForAnimation('.animate-on-scroll', 'visible');
        }
    }

    // DOM 로드 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.AnimationOptimizer = {
        prefersReducedMotion: () => prefersReducedMotion,
        isLowPower: () => isLowPowerMode,
        manageWillChange,
        enableGPU,
        disableGPU,
        observeForAnimation,
        smoothScrollTo,
        fadeIn,
        fadeOut,
        slideDown,
        slideUp
    };
})();
