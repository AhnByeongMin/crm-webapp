/**
 * CRM 자동완성 컴포넌트
 * 검색 입력 시 실시간으로 제안 목록을 보여줍니다.
 */

class CRMAutocomplete {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            minLength: 1,           // 최소 입력 글자 수
            delay: 200,             // 검색 딜레이 (ms)
            maxResults: 8,          // 최대 결과 수
            dataSource: null,       // 데이터 소스 함수 또는 배열
            onSelect: null,         // 선택 시 콜백
            renderItem: null,       // 커스텀 렌더링 함수
            placeholder: '검색...',
            noResultsText: '검색 결과가 없습니다',
            ...options
        };

        this.dropdown = null;
        this.selectedIndex = -1;
        this.results = [];
        this.debounceTimer = null;
        this.isOpen = false;

        this.init();
    }

    init() {
        // 입력 필드 래퍼 생성
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'autocomplete-wrapper';
        this.wrapper.style.position = 'relative';
        this.wrapper.style.width = '100%';

        // 입력 필드를 래퍼로 감싸기
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);

        // 드롭다운 생성
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.wrapper.appendChild(this.dropdown);

        // 이벤트 바인딩
        this.bindEvents();

        // 스타일 추가 (한 번만)
        if (!document.getElementById('autocomplete-styles')) {
            this.addStyles();
        }
    }

    bindEvents() {
        // 입력 이벤트
        this.input.addEventListener('input', (e) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.search(e.target.value);
            }, this.options.delay);
        });

        // 키보드 네비게이션
        this.input.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigate(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigate(-1);
                    break;
                case 'Enter':
                    if (this.selectedIndex >= 0) {
                        e.preventDefault();
                        this.selectItem(this.selectedIndex);
                    }
                    break;
                case 'Escape':
                    this.close();
                    break;
            }
        });

        // 포커스 아웃 시 닫기
        this.input.addEventListener('blur', () => {
            setTimeout(() => this.close(), 200);
        });

        // 포커스 시 결과가 있으면 다시 열기
        this.input.addEventListener('focus', () => {
            if (this.results.length > 0 && this.input.value.length >= this.options.minLength) {
                this.open();
            }
        });
    }

    async search(query) {
        if (query.length < this.options.minLength) {
            this.close();
            return;
        }

        let results = [];

        if (typeof this.options.dataSource === 'function') {
            results = await this.options.dataSource(query);
        } else if (Array.isArray(this.options.dataSource)) {
            const lowerQuery = query.toLowerCase();
            results = this.options.dataSource.filter(item => {
                const searchText = typeof item === 'string' ? item : (item.label || item.name || '');
                return searchText.toLowerCase().includes(lowerQuery);
            });
        }

        this.results = results.slice(0, this.options.maxResults);
        this.render();
    }

    render() {
        if (this.results.length === 0) {
            this.dropdown.innerHTML = `
                <div class="autocomplete-no-results">
                    ${this.options.noResultsText}
                </div>
            `;
            this.open();
            return;
        }

        this.dropdown.innerHTML = this.results.map((item, index) => {
            const html = this.options.renderItem
                ? this.options.renderItem(item, index)
                : this.defaultRenderItem(item, index);
            return `<div class="autocomplete-item ${index === this.selectedIndex ? 'selected' : ''}"
                        data-index="${index}">${html}</div>`;
        }).join('');

        // 아이템 클릭 이벤트
        this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.selectItem(parseInt(item.dataset.index));
            });
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.updateSelection();
            });
        });

        this.open();
    }

    defaultRenderItem(item, index) {
        if (typeof item === 'string') {
            return `<span class="autocomplete-label">${this.highlight(item)}</span>`;
        }

        const label = item.label || item.name || item.title || '';
        const sublabel = item.sublabel || item.phone || item.description || '';
        const icon = item.icon || '';

        return `
            ${icon ? `<span class="autocomplete-icon">${icon}</span>` : ''}
            <div class="autocomplete-content">
                <span class="autocomplete-label">${this.highlight(label)}</span>
                ${sublabel ? `<span class="autocomplete-sublabel">${sublabel}</span>` : ''}
            </div>
        `;
    }

    highlight(text) {
        const query = this.input.value;
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    navigate(direction) {
        const newIndex = this.selectedIndex + direction;
        if (newIndex >= -1 && newIndex < this.results.length) {
            this.selectedIndex = newIndex;
            this.updateSelection();
        }
    }

    updateSelection() {
        this.dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }

    selectItem(index) {
        const item = this.results[index];
        if (!item) return;

        const value = typeof item === 'string' ? item : (item.value || item.label || item.name || '');
        this.input.value = value;

        if (this.options.onSelect) {
            this.options.onSelect(item, index);
        }

        this.close();

        // 입력 이벤트 트리거 (필터 적용을 위해)
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    open() {
        this.dropdown.classList.add('open');
        this.isOpen = true;
    }

    close() {
        this.dropdown.classList.remove('open');
        this.isOpen = false;
        this.selectedIndex = -1;
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'autocomplete-styles';
        style.textContent = `
            .autocomplete-wrapper {
                position: relative;
                display: inline-block;
                width: 100%;
            }

            .autocomplete-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                display: none;
            }

            .autocomplete-dropdown.open {
                display: block;
            }

            .autocomplete-item {
                display: flex;
                align-items: center;
                padding: 10px 15px;
                cursor: pointer;
                transition: background 0.15s;
                border-bottom: 1px solid #f0f0f0;
            }

            .autocomplete-item:last-child {
                border-bottom: none;
            }

            .autocomplete-item:hover,
            .autocomplete-item.selected {
                background: #f5f7ff;
            }

            .autocomplete-icon {
                margin-right: 10px;
                font-size: 18px;
            }

            .autocomplete-content {
                flex: 1;
                display: flex;
                flex-direction: column;
            }

            .autocomplete-label {
                font-size: 14px;
                color: #333;
            }

            .autocomplete-sublabel {
                font-size: 12px;
                color: #888;
                margin-top: 2px;
            }

            .autocomplete-label mark {
                background: #fff3cd;
                color: inherit;
                padding: 0 2px;
                border-radius: 2px;
            }

            .autocomplete-no-results {
                padding: 15px;
                text-align: center;
                color: #999;
                font-size: 14px;
            }

            /* 최근 검색어 헤더 */
            .autocomplete-header {
                padding: 8px 15px;
                background: #f8f9fa;
                font-size: 12px;
                color: #666;
                font-weight: 600;
                border-bottom: 1px solid #eee;
            }

            /* 다크모드 */
            [data-theme="dark"] .autocomplete-dropdown {
                background: var(--card-bg, #1e1e1e);
                border-color: var(--border-color, #333);
            }

            [data-theme="dark"] .autocomplete-item {
                border-bottom-color: var(--border-color, #333);
            }

            [data-theme="dark"] .autocomplete-item:hover,
            [data-theme="dark"] .autocomplete-item.selected {
                background: var(--bg-hover, #2a2a2a);
            }

            [data-theme="dark"] .autocomplete-label {
                color: var(--text-primary, #e0e0e0);
            }

            [data-theme="dark"] .autocomplete-sublabel {
                color: var(--text-muted, #888);
            }

            [data-theme="dark"] .autocomplete-label mark {
                background: #665200;
                color: #ffc107;
            }

            [data-theme="dark"] .autocomplete-no-results {
                color: var(--text-muted, #888);
            }

            [data-theme="dark"] .autocomplete-header {
                background: var(--bg-tertiary, #2a2a2a);
                color: var(--text-muted, #888);
            }
        `;
        document.head.appendChild(style);
    }

    // 데이터 소스 업데이트
    setDataSource(dataSource) {
        this.options.dataSource = dataSource;
    }

    // 외부에서 결과 설정
    setResults(results) {
        this.results = results.slice(0, this.options.maxResults);
        this.render();
    }

    // 인스턴스 제거
    destroy() {
        clearTimeout(this.debounceTimer);
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.insertBefore(this.input, this.wrapper);
            this.wrapper.remove();
        }
    }
}

// 전역에서 사용 가능하도록
window.CRMAutocomplete = CRMAutocomplete;
