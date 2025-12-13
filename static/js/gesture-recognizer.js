/**
 * 제스처 인식 모듈
 * 스와이프, 핀치 줌, 롱 프레스, 더블 탭 등 지원
 */

(function() {
    'use strict';

    // 제스처 타입
    const GestureType = {
        SWIPE_LEFT: 'swipe-left',
        SWIPE_RIGHT: 'swipe-right',
        SWIPE_UP: 'swipe-up',
        SWIPE_DOWN: 'swipe-down',
        PINCH_IN: 'pinch-in',
        PINCH_OUT: 'pinch-out',
        ROTATE: 'rotate',
        LONG_PRESS: 'long-press',
        DOUBLE_TAP: 'double-tap',
        PAN: 'pan'
    };

    // 기본 설정
    const DEFAULT_OPTIONS = {
        swipeThreshold: 50,      // 스와이프 인식 최소 거리 (px)
        swipeVelocity: 0.3,      // 스와이프 최소 속도 (px/ms)
        longPressDelay: 500,     // 롱 프레스 지연 시간 (ms)
        doubleTapDelay: 300,     // 더블 탭 최대 간격 (ms)
        pinchThreshold: 0.1      // 핀치 인식 최소 스케일 변화
    };

    /**
     * 제스처 리스너 클래스
     */
    class GestureListener {
        constructor(element, options = {}) {
            this.element = element;
            this.options = { ...DEFAULT_OPTIONS, ...options };
            this.handlers = {};

            // 터치 상태
            this.touchState = {
                startX: 0,
                startY: 0,
                startTime: 0,
                lastTapTime: 0,
                initialDistance: 0,
                initialAngle: 0,
                longPressTimer: null,
                isMoving: false
            };

            this.bindEvents();
        }

        /**
         * 이벤트 바인딩
         */
        bindEvents() {
            this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

            // 마우스 이벤트 (데스크톱 지원)
            this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
            this.element.addEventListener('mouseleave', this.handleMouseUp.bind(this));

            // 휠 이벤트 (핀치 줌 대체)
            this.element.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        }

        /**
         * 터치 시작
         */
        handleTouchStart(e) {
            const touch = e.touches[0];

            this.touchState.startX = touch.clientX;
            this.touchState.startY = touch.clientY;
            this.touchState.startTime = Date.now();
            this.touchState.isMoving = false;

            // 롱 프레스 타이머 시작
            this.touchState.longPressTimer = setTimeout(() => {
                if (!this.touchState.isMoving) {
                    this.trigger(GestureType.LONG_PRESS, {
                        x: touch.clientX,
                        y: touch.clientY
                    });
                }
            }, this.options.longPressDelay);

            // 멀티터치 (핀치/로테이트)
            if (e.touches.length === 2) {
                this.touchState.initialDistance = this.getDistance(e.touches[0], e.touches[1]);
                this.touchState.initialAngle = this.getAngle(e.touches[0], e.touches[1]);
            }
        }

        /**
         * 터치 이동
         */
        handleTouchMove(e) {
            this.touchState.isMoving = true;

            // 롱 프레스 취소
            if (this.touchState.longPressTimer) {
                clearTimeout(this.touchState.longPressTimer);
                this.touchState.longPressTimer = null;
            }

            // 멀티터치 제스처
            if (e.touches.length === 2) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const currentAngle = this.getAngle(e.touches[0], e.touches[1]);

                // 핀치 감지
                const scale = currentDistance / this.touchState.initialDistance;
                if (Math.abs(scale - 1) > this.options.pinchThreshold) {
                    const gestureType = scale > 1 ? GestureType.PINCH_OUT : GestureType.PINCH_IN;
                    this.trigger(gestureType, {
                        scale,
                        center: this.getCenter(e.touches[0], e.touches[1])
                    });
                }

                // 로테이트 감지
                const rotation = currentAngle - this.touchState.initialAngle;
                if (Math.abs(rotation) > 10) {
                    this.trigger(GestureType.ROTATE, {
                        angle: rotation,
                        center: this.getCenter(e.touches[0], e.touches[1])
                    });
                }

                e.preventDefault();
            }

            // 단일 터치 - 팬
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - this.touchState.startX;
                const deltaY = touch.clientY - this.touchState.startY;

                this.trigger(GestureType.PAN, {
                    deltaX,
                    deltaY,
                    x: touch.clientX,
                    y: touch.clientY
                });
            }
        }

        /**
         * 터치 종료
         */
        handleTouchEnd(e) {
            // 롱 프레스 타이머 취소
            if (this.touchState.longPressTimer) {
                clearTimeout(this.touchState.longPressTimer);
                this.touchState.longPressTimer = null;
            }

            const endTime = Date.now();
            const duration = endTime - this.touchState.startTime;

            // 터치가 남아있으면 무시
            if (e.touches.length > 0) return;

            const changedTouch = e.changedTouches[0];
            const deltaX = changedTouch.clientX - this.touchState.startX;
            const deltaY = changedTouch.clientY - this.touchState.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const velocity = distance / duration;

            // 스와이프 감지
            if (distance >= this.options.swipeThreshold && velocity >= this.options.swipeVelocity) {
                const direction = this.getSwipeDirection(deltaX, deltaY);
                this.trigger(direction, {
                    distance,
                    velocity,
                    deltaX,
                    deltaY
                });
            }
            // 더블 탭 감지
            else if (distance < 10 && duration < 200) {
                const now = Date.now();
                if (now - this.touchState.lastTapTime < this.options.doubleTapDelay) {
                    this.trigger(GestureType.DOUBLE_TAP, {
                        x: changedTouch.clientX,
                        y: changedTouch.clientY
                    });
                    this.touchState.lastTapTime = 0;
                } else {
                    this.touchState.lastTapTime = now;
                }
            }
        }

        /**
         * 터치 취소
         */
        handleTouchCancel() {
            if (this.touchState.longPressTimer) {
                clearTimeout(this.touchState.longPressTimer);
                this.touchState.longPressTimer = null;
            }
        }

        /**
         * 마우스 다운
         */
        handleMouseDown(e) {
            this.touchState.startX = e.clientX;
            this.touchState.startY = e.clientY;
            this.touchState.startTime = Date.now();
            this.touchState.isMoving = false;
            this.touchState.mouseDown = true;

            // 롱 프레스 타이머
            this.touchState.longPressTimer = setTimeout(() => {
                if (!this.touchState.isMoving && this.touchState.mouseDown) {
                    this.trigger(GestureType.LONG_PRESS, {
                        x: e.clientX,
                        y: e.clientY
                    });
                }
            }, this.options.longPressDelay);
        }

        /**
         * 마우스 이동
         */
        handleMouseMove(e) {
            if (!this.touchState.mouseDown) return;

            this.touchState.isMoving = true;

            if (this.touchState.longPressTimer) {
                clearTimeout(this.touchState.longPressTimer);
            }

            const deltaX = e.clientX - this.touchState.startX;
            const deltaY = e.clientY - this.touchState.startY;

            this.trigger(GestureType.PAN, {
                deltaX,
                deltaY,
                x: e.clientX,
                y: e.clientY
            });
        }

        /**
         * 마우스 업
         */
        handleMouseUp(e) {
            if (!this.touchState.mouseDown) return;

            this.touchState.mouseDown = false;

            if (this.touchState.longPressTimer) {
                clearTimeout(this.touchState.longPressTimer);
            }

            const endTime = Date.now();
            const duration = endTime - this.touchState.startTime;
            const deltaX = e.clientX - this.touchState.startX;
            const deltaY = e.clientY - this.touchState.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const velocity = distance / duration;

            if (distance >= this.options.swipeThreshold && velocity >= this.options.swipeVelocity) {
                const direction = this.getSwipeDirection(deltaX, deltaY);
                this.trigger(direction, { distance, velocity, deltaX, deltaY });
            }
        }

        /**
         * 휠 이벤트 (핀치 대체)
         */
        handleWheel(e) {
            if (e.ctrlKey) {
                e.preventDefault();

                const scale = e.deltaY > 0 ? 0.9 : 1.1;
                const gestureType = scale > 1 ? GestureType.PINCH_OUT : GestureType.PINCH_IN;

                this.trigger(gestureType, {
                    scale,
                    center: { x: e.clientX, y: e.clientY }
                });
            }
        }

        /**
         * 스와이프 방향 계산
         */
        getSwipeDirection(deltaX, deltaY) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                return deltaX > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;
            } else {
                return deltaY > 0 ? GestureType.SWIPE_DOWN : GestureType.SWIPE_UP;
            }
        }

        /**
         * 두 터치 포인트 간 거리
         */
        getDistance(touch1, touch2) {
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        /**
         * 두 터치 포인트 간 각도
         */
        getAngle(touch1, touch2) {
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            return Math.atan2(dy, dx) * 180 / Math.PI;
        }

        /**
         * 두 터치 포인트 중앙점
         */
        getCenter(touch1, touch2) {
            return {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }

        /**
         * 이벤트 핸들러 등록
         */
        on(gestureType, handler) {
            if (!this.handlers[gestureType]) {
                this.handlers[gestureType] = [];
            }
            this.handlers[gestureType].push(handler);
            return this;
        }

        /**
         * 이벤트 핸들러 제거
         */
        off(gestureType, handler) {
            if (this.handlers[gestureType]) {
                const index = this.handlers[gestureType].indexOf(handler);
                if (index > -1) {
                    this.handlers[gestureType].splice(index, 1);
                }
            }
            return this;
        }

        /**
         * 이벤트 트리거
         */
        trigger(gestureType, data) {
            if (this.handlers[gestureType]) {
                this.handlers[gestureType].forEach(handler => {
                    handler({ type: gestureType, ...data });
                });
            }

            // 커스텀 이벤트 발생
            this.element.dispatchEvent(new CustomEvent('gesture', {
                detail: { type: gestureType, ...data }
            }));
        }

        /**
         * 정리
         */
        destroy() {
            this.handlers = {};
            // 이벤트 리스너 제거는 클로저 문제로 생략
        }
    }

    /**
     * 제스처 리스너 생성 헬퍼
     */
    function createGestureListener(element, options) {
        return new GestureListener(element, options);
    }

    /**
     * 이미지 핀치 줌 설정
     */
    function setupPinchZoom(element, options = {}) {
        const {
            minScale = 0.5,
            maxScale = 4,
            initialScale = 1
        } = options;

        let scale = initialScale;
        let translateX = 0;
        let translateY = 0;

        const gesture = createGestureListener(element);

        gesture.on(GestureType.PINCH_IN, (e) => {
            scale = Math.max(minScale, scale * e.scale);
            applyTransform();
        });

        gesture.on(GestureType.PINCH_OUT, (e) => {
            scale = Math.min(maxScale, scale * e.scale);
            applyTransform();
        });

        gesture.on(GestureType.PAN, (e) => {
            if (scale > 1) {
                translateX += e.deltaX;
                translateY += e.deltaY;
                applyTransform();
            }
        });

        gesture.on(GestureType.DOUBLE_TAP, () => {
            if (scale > 1) {
                scale = 1;
                translateX = 0;
                translateY = 0;
            } else {
                scale = 2;
            }
            applyTransform();
        });

        function applyTransform() {
            element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }

        return {
            gesture,
            reset: () => {
                scale = initialScale;
                translateX = 0;
                translateY = 0;
                applyTransform();
            },
            getScale: () => scale
        };
    }

    /**
     * 스와이프 네비게이션 설정
     */
    function setupSwipeNavigation(element, options = {}) {
        const {
            onSwipeLeft,
            onSwipeRight,
            onSwipeUp,
            onSwipeDown
        } = options;

        const gesture = createGestureListener(element);

        if (onSwipeLeft) gesture.on(GestureType.SWIPE_LEFT, onSwipeLeft);
        if (onSwipeRight) gesture.on(GestureType.SWIPE_RIGHT, onSwipeRight);
        if (onSwipeUp) gesture.on(GestureType.SWIPE_UP, onSwipeUp);
        if (onSwipeDown) gesture.on(GestureType.SWIPE_DOWN, onSwipeDown);

        return gesture;
    }

    /**
     * 자동 설정
     */
    function autoSetup() {
        // data-pinch-zoom 속성이 있는 요소에 핀치 줌 설정
        document.querySelectorAll('[data-pinch-zoom]').forEach(el => {
            if (el.dataset.pinchZoomSetup) return;
            setupPinchZoom(el);
            el.dataset.pinchZoomSetup = 'true';
        });
    }

    // 초기화
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoSetup);
        } else {
            autoSetup();
        }
    }

    init();

    // 전역 노출
    window.GestureRecognizer = {
        GestureType,
        create: createGestureListener,
        setupPinchZoom,
        setupSwipeNavigation
    };
})();
