/**
 * 드래그앤드롭 리스트 재정렬 모듈
 * 목록 항목의 순서를 드래그로 변경
 */

class DragDropList {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            console.error('DragDropList: 컨테이너를 찾을 수 없습니다.');
            return;
        }

        this.options = {
            itemSelector: options.itemSelector || '.drag-item',
            handleSelector: options.handleSelector || '.drag-handle',
            dragClass: options.dragClass || 'dragging',
            overClass: options.overClass || 'drag-over',
            placeholderClass: options.placeholderClass || 'drag-placeholder',
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 200,
            axis: options.axis || null,  // 'x', 'y', or null (both)
            onStart: options.onStart || null,
            onMove: options.onMove || null,
            onEnd: options.onEnd || null,
            onReorder: options.onReorder || null,
        };

        this.draggedItem = null;
        this.placeholder = null;
        this.initialIndex = -1;

        this.init();
    }

    init() {
        this.addStyles();
        this.bindEvents();
    }

    bindEvents() {
        // 아이템에 드래그 속성 설정
        const items = this.container.querySelectorAll(this.options.itemSelector);
        items.forEach(item => this.setupDragItem(item));

        // 컨테이너 이벤트
        this.container.addEventListener('dragover', this.handleDragOver.bind(this));
        this.container.addEventListener('drop', this.handleDrop.bind(this));

        // 터치 이벤트 (모바일)
        this.setupTouchEvents();

        // MutationObserver로 동적 아이템 감지
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches(this.options.itemSelector)) {
                        this.setupDragItem(node);
                    }
                });
            });
        });

        this.observer.observe(this.container, { childList: true, subtree: true });
    }

    setupDragItem(item) {
        // 이미 설정된 경우 스킵
        if (item.dataset.dragInit) return;
        item.dataset.dragInit = 'true';

        item.setAttribute('draggable', 'true');

        item.addEventListener('dragstart', this.handleDragStart.bind(this));
        item.addEventListener('dragend', this.handleDragEnd.bind(this));
        item.addEventListener('dragenter', this.handleDragEnter.bind(this));
        item.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    handleDragStart(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        // 핸들이 있으면 핸들에서만 드래그 시작
        if (this.options.handleSelector !== this.options.itemSelector) {
            const handle = item.querySelector(this.options.handleSelector);
            if (handle && !handle.contains(e.target)) {
                e.preventDefault();
                return;
            }
        }

        this.draggedItem = item;
        this.initialIndex = this.getItemIndex(item);

        // 드래그 이미지 설정
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.initialIndex.toString());

            // 드래그 이미지 (투명한 클론)
            const ghost = item.cloneNode(true);
            ghost.style.opacity = '0.8';
            ghost.style.position = 'absolute';
            ghost.style.top = '-1000px';
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, e.offsetX, e.offsetY);
            setTimeout(() => ghost.remove(), 0);
        }

        // 플레이스홀더 생성
        this.createPlaceholder(item);

        // 스타일 적용
        setTimeout(() => {
            item.classList.add(this.options.dragClass);
        }, 0);

        if (this.options.onStart) {
            this.options.onStart({
                item,
                index: this.initialIndex
            });
        }
    }

    handleDragEnd(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        item.classList.remove(this.options.dragClass);

        // 플레이스홀더 제거
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        this.placeholder = null;

        // over 클래스 제거
        this.container.querySelectorAll(`.${this.options.overClass}`).forEach(el => {
            el.classList.remove(this.options.overClass);
        });

        const newIndex = this.getItemIndex(item);

        if (this.options.onEnd) {
            this.options.onEnd({
                item,
                oldIndex: this.initialIndex,
                newIndex
            });
        }

        if (this.initialIndex !== newIndex && this.options.onReorder) {
            this.options.onReorder({
                item,
                oldIndex: this.initialIndex,
                newIndex,
                items: this.getItems()
            });
        }

        this.draggedItem = null;
        this.initialIndex = -1;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const afterElement = this.getDragAfterElement(e.clientY);
        const item = this.draggedItem;

        if (!item) return;

        if (this.options.onMove) {
            this.options.onMove({
                item,
                afterElement,
                y: e.clientY
            });
        }

        // 플레이스홀더 위치 이동
        if (this.placeholder) {
            if (afterElement) {
                this.container.insertBefore(this.placeholder, afterElement);
            } else {
                this.container.appendChild(this.placeholder);
            }
        }
    }

    handleDragEnter(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (item && item !== this.draggedItem) {
            item.classList.add(this.options.overClass);
        }
    }

    handleDragLeave(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (item) {
            item.classList.remove(this.options.overClass);
        }
    }

    handleDrop(e) {
        e.preventDefault();

        const afterElement = this.getDragAfterElement(e.clientY);

        if (this.draggedItem) {
            if (afterElement) {
                this.container.insertBefore(this.draggedItem, afterElement);
            } else {
                this.container.appendChild(this.draggedItem);
            }
        }
    }

    createPlaceholder(item) {
        this.placeholder = document.createElement('div');
        this.placeholder.className = this.options.placeholderClass;
        this.placeholder.style.height = item.offsetHeight + 'px';
        this.placeholder.style.marginBottom = getComputedStyle(item).marginBottom;

        item.parentNode.insertBefore(this.placeholder, item.nextSibling);
    }

    getDragAfterElement(y) {
        const items = [...this.container.querySelectorAll(
            `${this.options.itemSelector}:not(.${this.options.dragClass})`
        )];

        return items.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    getItemIndex(item) {
        const items = this.getItems();
        return items.indexOf(item);
    }

    getItems() {
        return [...this.container.querySelectorAll(this.options.itemSelector)];
    }

    // 터치 이벤트 (모바일 지원)
    setupTouchEvents() {
        let touchStartY = 0;
        let touchStartX = 0;
        let currentItem = null;
        let touchMoved = false;

        this.container.addEventListener('touchstart', (e) => {
            const target = e.target.closest(this.options.itemSelector);
            if (!target) return;

            // 핸들 체크
            if (this.options.handleSelector !== this.options.itemSelector) {
                const handle = target.querySelector(this.options.handleSelector);
                if (!handle || !handle.contains(e.target)) return;
            }

            currentItem = target;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            touchMoved = false;

            // 롱프레스로 드래그 시작 (300ms)
            this.touchTimer = setTimeout(() => {
                if (currentItem) {
                    this.draggedItem = currentItem;
                    this.initialIndex = this.getItemIndex(currentItem);
                    currentItem.classList.add(this.options.dragClass);
                    this.createPlaceholder(currentItem);

                    // 햅틱 피드백 (지원되는 경우)
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }
            }, 300);
        }, { passive: true });

        this.container.addEventListener('touchmove', (e) => {
            if (!this.draggedItem) {
                // 아직 드래그 시작 안됨 - 스크롤 허용
                const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                const deltaX = Math.abs(e.touches[0].clientX - touchStartX);

                if (deltaY > 10 || deltaX > 10) {
                    clearTimeout(this.touchTimer);
                }
                return;
            }

            e.preventDefault();
            touchMoved = true;

            const y = e.touches[0].clientY;
            const afterElement = this.getDragAfterElement(y);

            if (this.placeholder) {
                if (afterElement) {
                    this.container.insertBefore(this.placeholder, afterElement);
                } else {
                    this.container.appendChild(this.placeholder);
                }
            }

            // 드래그 중인 아이템 위치 업데이트 (시각적)
            this.draggedItem.style.transform = `translateY(${y - touchStartY}px)`;
        }, { passive: false });

        this.container.addEventListener('touchend', (e) => {
            clearTimeout(this.touchTimer);

            if (!this.draggedItem) return;

            // 최종 위치에 삽입
            if (this.placeholder && this.placeholder.parentNode) {
                this.placeholder.parentNode.insertBefore(this.draggedItem, this.placeholder);
            }

            // 스타일 리셋
            this.draggedItem.classList.remove(this.options.dragClass);
            this.draggedItem.style.transform = '';

            // 플레이스홀더 제거
            if (this.placeholder && this.placeholder.parentNode) {
                this.placeholder.remove();
            }
            this.placeholder = null;

            const newIndex = this.getItemIndex(this.draggedItem);

            if (this.options.onEnd) {
                this.options.onEnd({
                    item: this.draggedItem,
                    oldIndex: this.initialIndex,
                    newIndex
                });
            }

            if (this.initialIndex !== newIndex && this.options.onReorder) {
                this.options.onReorder({
                    item: this.draggedItem,
                    oldIndex: this.initialIndex,
                    newIndex,
                    items: this.getItems()
                });
            }

            this.draggedItem = null;
            currentItem = null;
            this.initialIndex = -1;
        });

        this.container.addEventListener('touchcancel', () => {
            clearTimeout(this.touchTimer);

            if (this.draggedItem) {
                this.draggedItem.classList.remove(this.options.dragClass);
                this.draggedItem.style.transform = '';
            }

            if (this.placeholder && this.placeholder.parentNode) {
                this.placeholder.remove();
            }

            this.placeholder = null;
            this.draggedItem = null;
            currentItem = null;
        });
    }

    // 프로그래매틱하게 아이템 이동
    moveItem(fromIndex, toIndex) {
        const items = this.getItems();
        if (fromIndex < 0 || fromIndex >= items.length) return;
        if (toIndex < 0 || toIndex >= items.length) return;
        if (fromIndex === toIndex) return;

        const item = items[fromIndex];
        const targetItem = items[toIndex];

        if (fromIndex < toIndex) {
            this.container.insertBefore(item, targetItem.nextSibling);
        } else {
            this.container.insertBefore(item, targetItem);
        }

        if (this.options.onReorder) {
            this.options.onReorder({
                item,
                oldIndex: fromIndex,
                newIndex: toIndex,
                items: this.getItems()
            });
        }
    }

    // 정리
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }

        const items = this.getItems();
        items.forEach(item => {
            item.removeAttribute('draggable');
            delete item.dataset.dragInit;
        });
    }

    addStyles() {
        if (document.getElementById('drag-drop-styles')) return;

        const style = document.createElement('style');
        style.id = 'drag-drop-styles';
        style.textContent = `
            /* 드래그 핸들 */
            .drag-handle {
                cursor: grab;
                touch-action: none;
                user-select: none;
            }

            .drag-handle:active {
                cursor: grabbing;
            }

            /* 드래그 중인 아이템 */
            .dragging {
                opacity: 0.5;
                background: #e8f0fe !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
                z-index: 1000;
            }

            /* 드래그 오버 상태 */
            .drag-over {
                border-top: 2px solid #667eea !important;
            }

            /* 플레이스홀더 */
            .drag-placeholder {
                background: #f0f4ff;
                border: 2px dashed #667eea;
                border-radius: 8px;
                transition: height 0.2s ease;
            }

            /* 드래그 가능한 아이템 */
            [draggable="true"] {
                transition: transform 0.2s ease, opacity 0.2s ease;
            }

            /* 다크모드 */
            [data-theme="dark"] .dragging {
                background: #374151 !important;
            }

            [data-theme="dark"] .drag-over {
                border-top-color: #818cf8 !important;
            }

            [data-theme="dark"] .drag-placeholder {
                background: #1e293b;
                border-color: #818cf8;
            }

            /* 애니메이션 모션 감소 설정 */
            @media (prefers-reduced-motion: reduce) {
                [draggable="true"] {
                    transition: none;
                }

                .drag-placeholder {
                    transition: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 전역 노출
window.DragDropList = DragDropList;

/**
 * 간편 초기화 함수
 */
window.initDragDrop = function(container, options) {
    return new DragDropList(container, options);
};
