/**
 * 검색 히스토리 관리 모듈
 * 최근 검색어를 저장하고 자동완성 드롭다운 제공
 */

class SearchHistory {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'crm_search_history';
        this.maxItems = options.maxItems || 10;
        this.inputSelector = options.inputSelector || '.search-box';
        this.pageKey = options.pageKey || window.location.pathname;
        this.onSearch = options.onSearch || null;

        this.history = this.load();
        this.dropdown = null;
        this.input = null;

        this.init();
    }

    init() {
        // 입력 필드 찾기
        this.input = document.querySelector(this.inputSelector);
        if (!this.input) return;

        // 이미 초기화된 경우 스킵
        if (this.input.dataset.searchHistoryInit) return;
        this.input.dataset.searchHistoryInit = 'true';

        // 드롭다운 생성
        this.createDropdown();

        // 이벤트 바인딩
        this.bindEvents();

        // 스타일 추가
        this.addStyles();
    }

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                return parsed[this.pageKey] || [];
            }
        } catch (e) {
            console.error('검색 히스토리 로드 실패:', e);
        }
        return [];
    }

    save() {
        try {
            let allData = {};
            const existing = localStorage.getItem(this.storageKey);
            if (existing) {
                allData = JSON.parse(existing);
            }
            allData[this.pageKey] = this.history.slice(0, this.maxItems);
            localStorage.setItem(this.storageKey, JSON.stringify(allData));
        } catch (e) {
            console.error('검색 히스토리 저장 실패:', e);
        }
    }

    add(query) {
        if (!query || query.trim().length === 0) return;

        const trimmed = query.trim();

        // 중복 제거
        this.history = this.history.filter(item => item.toLowerCase() !== trimmed.toLowerCase());

        // 맨 앞에 추가
        this.history.unshift(trimmed);

        // 최대 개수 초과 시 삭제
        if (this.history.length > this.maxItems) {
            this.history = this.history.slice(0, this.maxItems);
        }

        this.save();
    }

    remove(query) {
        this.history = this.history.filter(item => item !== query);
        this.save();
        this.render();
    }

    clear() {
        this.history = [];
        this.save();
        this.render();
        this.hideDropdown();
    }

    createDropdown() {
        // 부모 요소에 relative 추가
        const wrapper = this.input.parentElement;
        if (wrapper && getComputedStyle(wrapper).position === 'static') {
            wrapper.style.position = 'relative';
        }

        // 기존 드롭다운 있으면 제거
        const existing = wrapper.querySelector('.search-history-dropdown');
        if (existing) existing.remove();

        // 새 드롭다운 생성
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'search-history-dropdown';
        wrapper.appendChild(this.dropdown);
    }

    bindEvents() {
        // 포커스 - 드롭다운 표시
        this.input.addEventListener('focus', () => {
            if (this.history.length > 0 || this.input.value.length > 0) {
                this.render();
                this.showDropdown();
            }
        });

        // 입력 - 필터링
        this.input.addEventListener('input', () => {
            this.render();
            if (this.history.length > 0 || this.input.value.length > 0) {
                this.showDropdown();
            }
        });

        // 블러 - 드롭다운 숨기기 (딜레이 필요)
        this.input.addEventListener('blur', () => {
            setTimeout(() => this.hideDropdown(), 200);
        });

        // Enter 키 - 검색 실행 및 히스토리 저장
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = this.input.value.trim();
                if (query) {
                    this.add(query);
                    this.hideDropdown();
                    if (this.onSearch) {
                        this.onSearch(query);
                    }
                }
            } else if (e.key === 'Escape') {
                this.hideDropdown();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.focusNextItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.focusPrevItem();
            }
        });

        // 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    render() {
        const query = this.input.value.toLowerCase().trim();

        // 필터링된 히스토리
        let filtered = this.history;
        if (query) {
            filtered = this.history.filter(item =>
                item.toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            this.dropdown.innerHTML = `
                <div class="search-history-empty">
                    ${query ? '일치하는 검색 기록이 없습니다' : '최근 검색 기록이 없습니다'}
                </div>
            `;
            return;
        }

        this.dropdown.innerHTML = `
            <div class="search-history-header">
                <span>최근 검색어</span>
                <button class="search-history-clear-all" type="button">전체 삭제</button>
            </div>
            <ul class="search-history-list">
                ${filtered.map((item, index) => `
                    <li class="search-history-item" data-query="${this.escapeHtml(item)}" data-index="${index}">
                        <span class="search-history-icon">🔍</span>
                        <span class="search-history-text">${this.highlightMatch(item, query)}</span>
                        <button class="search-history-delete" data-query="${this.escapeHtml(item)}" type="button" title="삭제">×</button>
                    </li>
                `).join('')}
            </ul>
        `;

        // 전체 삭제 버튼
        const clearAllBtn = this.dropdown.querySelector('.search-history-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clear();
            });
        }

        // 아이템 클릭
        this.dropdown.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('search-history-delete')) return;

                const query = item.dataset.query;
                this.input.value = query;
                this.add(query);
                this.hideDropdown();

                if (this.onSearch) {
                    this.onSearch(query);
                }

                // input 이벤트 트리거
                this.input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

        // 삭제 버튼 클릭
        this.dropdown.querySelectorAll('.search-history-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const query = btn.dataset.query;
                this.remove(query);
            });
        });
    }

    highlightMatch(text, query) {
        if (!query) return this.escapeHtml(text);

        const escaped = this.escapeHtml(text);
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    showDropdown() {
        this.dropdown.classList.add('show');
    }

    hideDropdown() {
        this.dropdown.classList.remove('show');
        this.focusedIndex = -1;
    }

    focusNextItem() {
        const items = this.dropdown.querySelectorAll('.search-history-item');
        if (items.length === 0) return;

        if (this.focusedIndex === undefined) this.focusedIndex = -1;
        this.focusedIndex = Math.min(this.focusedIndex + 1, items.length - 1);
        this.updateFocus(items);
    }

    focusPrevItem() {
        const items = this.dropdown.querySelectorAll('.search-history-item');
        if (items.length === 0) return;

        if (this.focusedIndex === undefined) this.focusedIndex = 0;
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
        this.updateFocus(items);
    }

    updateFocus(items) {
        items.forEach((item, i) => {
            if (i === this.focusedIndex) {
                item.classList.add('focused');
                this.input.value = item.dataset.query;
            } else {
                item.classList.remove('focused');
            }
        });
    }

    addStyles() {
        if (document.getElementById('search-history-styles')) return;

        const style = document.createElement('style');
        style.id = 'search-history-styles';
        style.textContent = `
            /* 검색 히스토리 드롭다운 */
            .search-history-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 2px solid #667eea;
                border-top: none;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                z-index: 1000;
                display: none;
                max-height: 280px;
                overflow-y: auto;
            }

            .search-history-dropdown.show {
                display: block;
                animation: dropdownSlide 0.2s ease;
            }

            @keyframes dropdownSlide {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* 헤더 */
            .search-history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 14px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
                font-size: 12px;
                color: #666;
            }

            .search-history-clear-all {
                background: none;
                border: none;
                color: #dc3545;
                cursor: pointer;
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .search-history-clear-all:hover {
                background: #fee;
                text-decoration: underline;
            }

            /* 리스트 */
            .search-history-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }

            .search-history-item {
                display: flex;
                align-items: center;
                padding: 10px 14px;
                cursor: pointer;
                transition: background 0.15s;
                border-bottom: 1px solid #f5f5f5;
            }

            .search-history-item:last-child {
                border-bottom: none;
            }

            .search-history-item:hover,
            .search-history-item.focused {
                background: #f0f4ff;
            }

            .search-history-icon {
                font-size: 14px;
                margin-right: 10px;
                opacity: 0.6;
            }

            .search-history-text {
                flex: 1;
                font-size: 14px;
                color: #333;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .search-history-text mark {
                background: #ffeaa7;
                color: inherit;
                padding: 0 2px;
                border-radius: 2px;
            }

            .search-history-delete {
                background: none;
                border: none;
                color: #999;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                line-height: 1;
                border-radius: 4px;
                opacity: 0;
                transition: all 0.2s;
            }

            .search-history-item:hover .search-history-delete {
                opacity: 1;
            }

            .search-history-delete:hover {
                background: #fee;
                color: #dc3545;
            }

            /* 빈 상태 */
            .search-history-empty {
                padding: 20px;
                text-align: center;
                color: #999;
                font-size: 13px;
            }

            /* 다크모드 */
            [data-theme="dark"] .search-history-dropdown {
                background: #1f2937;
                border-color: #4f46e5;
            }

            [data-theme="dark"] .search-history-header {
                background: #111827;
                border-color: #374151;
                color: #9ca3af;
            }

            [data-theme="dark"] .search-history-clear-all {
                color: #f87171;
            }

            [data-theme="dark"] .search-history-clear-all:hover {
                background: #451a1a;
            }

            [data-theme="dark"] .search-history-item {
                border-color: #374151;
            }

            [data-theme="dark"] .search-history-item:hover,
            [data-theme="dark"] .search-history-item.focused {
                background: #374151;
            }

            [data-theme="dark"] .search-history-text {
                color: #e5e7eb;
            }

            [data-theme="dark"] .search-history-text mark {
                background: #854d0e;
                color: #fef3c7;
            }

            [data-theme="dark"] .search-history-delete {
                color: #6b7280;
            }

            [data-theme="dark"] .search-history-delete:hover {
                background: #451a1a;
                color: #f87171;
            }

            [data-theme="dark"] .search-history-empty {
                color: #6b7280;
            }

            /* 모바일 */
            @media (max-width: 480px) {
                .search-history-dropdown {
                    max-height: 200px;
                }

                .search-history-item {
                    padding: 12px 14px;
                }

                .search-history-delete {
                    opacity: 1;
                    padding: 6px 10px;
                }
            }

            /* 애니메이션 모션 감소 설정 */
            @media (prefers-reduced-motion: reduce) {
                .search-history-dropdown.show {
                    animation: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 전역 인스턴스 팩토리
window.createSearchHistory = function(options) {
    return new SearchHistory(options);
};

// 전역 SearchHistory 클래스 노출
window.SearchHistory = SearchHistory;
