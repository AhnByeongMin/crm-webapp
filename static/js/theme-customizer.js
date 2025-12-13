/**
 * 테마 커스터마이징 모듈
 * 사용자별 색상 테마 선택 및 저장
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'crm_theme_settings';

    // 기본 테마 색상
    const DEFAULT_THEME = {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        accent: '#17a2b8'
    };

    // 프리셋 테마
    const PRESET_THEMES = {
        default: {
            name: '기본',
            colors: { ...DEFAULT_THEME }
        },
        ocean: {
            name: '오션',
            colors: {
                primary: '#0077b6',
                secondary: '#00b4d8',
                success: '#2a9d8f',
                warning: '#e9c46a',
                danger: '#e76f51',
                accent: '#023e8a'
            }
        },
        forest: {
            name: '포레스트',
            colors: {
                primary: '#2d6a4f',
                secondary: '#40916c',
                success: '#52b788',
                warning: '#d4a373',
                danger: '#bc6c25',
                accent: '#1b4332'
            }
        },
        sunset: {
            name: '선셋',
            colors: {
                primary: '#e85d04',
                secondary: '#f48c06',
                success: '#606c38',
                warning: '#ffd166',
                danger: '#d62828',
                accent: '#9d4edd'
            }
        },
        berry: {
            name: '베리',
            colors: {
                primary: '#9d4edd',
                secondary: '#c77dff',
                success: '#38b000',
                warning: '#ffbe0b',
                danger: '#ff006e',
                accent: '#3a0ca3'
            }
        },
        monochrome: {
            name: '모노크롬',
            colors: {
                primary: '#495057',
                secondary: '#6c757d',
                success: '#343a40',
                warning: '#868e96',
                danger: '#212529',
                accent: '#adb5bd'
            }
        },
        coral: {
            name: '코랄',
            colors: {
                primary: '#ff6b6b',
                secondary: '#ffa8a8',
                success: '#51cf66',
                warning: '#ffd43b',
                danger: '#f03e3e',
                accent: '#339af0'
            }
        },
        midnight: {
            name: '미드나잇',
            colors: {
                primary: '#4c6ef5',
                secondary: '#748ffc',
                success: '#40c057',
                warning: '#fab005',
                danger: '#fa5252',
                accent: '#7950f2'
            }
        }
    };

    // 현재 테마 설정
    let currentTheme = { ...DEFAULT_THEME };
    let activePreset = 'default';

    /**
     * 테마 설정 로드
     */
    function loadTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                currentTheme = { ...DEFAULT_THEME, ...parsed.colors };
                activePreset = parsed.preset || 'custom';
                applyTheme(currentTheme);
            }
        } catch (e) {
            console.warn('[ThemeCustomizer] Failed to load theme:', e);
        }
    }

    /**
     * 테마 설정 저장
     */
    function saveTheme() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                preset: activePreset,
                colors: currentTheme
            }));
        } catch (e) {
            console.warn('[ThemeCustomizer] Failed to save theme:', e);
        }
    }

    /**
     * 테마 적용
     */
    function applyTheme(colors) {
        const root = document.documentElement;

        // CSS 변수 설정
        Object.entries(colors).forEach(([key, value]) => {
            root.style.setProperty(`--theme-${key}`, value);

            // RGB 값도 추가 (opacity 지원)
            const rgb = hexToRgb(value);
            if (rgb) {
                root.style.setProperty(`--theme-${key}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }
        });

        // 그라데이션 업데이트
        root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`);

        // 버튼 스타일 업데이트
        updateButtonStyles(colors);

        currentTheme = { ...colors };
    }

    /**
     * 버튼 스타일 동적 업데이트
     */
    function updateButtonStyles(colors) {
        let styleEl = document.getElementById('theme-customizer-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'theme-customizer-styles';
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = `
            /* 테마 커스터마이저 스타일 */
            .nav a:not(.secondary),
            .nav button:not(.secondary):not(.success) {
                background: ${colors.primary} !important;
            }
            .nav a:not(.secondary):hover,
            .nav button:not(.secondary):not(.success):hover {
                background: ${adjustColor(colors.primary, -15)} !important;
            }
            .nav a.active {
                background: ${adjustColor(colors.primary, -15)} !important;
            }
            .nav button.success {
                background: ${colors.success} !important;
            }
            .nav button.success:hover {
                background: ${adjustColor(colors.success, -15)} !important;
            }
            .admin-badge {
                background: ${colors.primary} !important;
            }
            .btn-primary, button.primary {
                background: ${colors.primary} !important;
                border-color: ${colors.primary} !important;
            }
            .btn-primary:hover, button.primary:hover {
                background: ${adjustColor(colors.primary, -15)} !important;
            }
            .header-font-btn.active {
                background: ${colors.primary} !important;
            }
            .header-tutorial-btn:hover {
                background: ${colors.primary} !important;
                border-color: ${colors.primary} !important;
            }
            /* 진행바 그라데이션 */
            .upload-progress-fill,
            .progress-bar-fill {
                background: linear-gradient(90deg, ${colors.primary}, ${colors.secondary}) !important;
            }
            /* 포커스 링 */
            :focus-visible {
                outline-color: ${colors.primary} !important;
            }
            /* 선택 하이라이트 */
            ::selection {
                background: ${colors.primary}33 !important;
            }
        `;
    }

    /**
     * 프리셋 테마 적용
     */
    function applyPreset(presetName) {
        const preset = PRESET_THEMES[presetName];
        if (preset) {
            activePreset = presetName;
            applyTheme(preset.colors);
            saveTheme();
            return true;
        }
        return false;
    }

    /**
     * 커스텀 색상 설정
     */
    function setColor(colorKey, value) {
        if (currentTheme.hasOwnProperty(colorKey)) {
            currentTheme[colorKey] = value;
            activePreset = 'custom';
            applyTheme(currentTheme);
            saveTheme();
        }
    }

    /**
     * 테마 리셋
     */
    function resetTheme() {
        activePreset = 'default';
        applyTheme(DEFAULT_THEME);
        saveTheme();
    }

    /**
     * 테마 커스터마이저 UI 표시
     */
    function showCustomizer() {
        let modal = document.getElementById('themeCustomizerModal');
        if (modal) {
            modal.classList.add('show');
            return;
        }

        modal = document.createElement('div');
        modal.id = 'themeCustomizerModal';
        modal.className = 'theme-customizer-modal';
        modal.innerHTML = `
            <div class="theme-customizer-content">
                <div class="theme-customizer-header">
                    <h3>테마 설정</h3>
                    <button class="theme-customizer-close" onclick="ThemeCustomizer.hide()">&times;</button>
                </div>
                <div class="theme-customizer-body">
                    <div class="theme-section">
                        <h4>프리셋 테마</h4>
                        <div class="theme-presets">
                            ${Object.entries(PRESET_THEMES).map(([key, preset]) => `
                                <button class="theme-preset-btn ${activePreset === key ? 'active' : ''}"
                                        data-preset="${key}"
                                        onclick="ThemeCustomizer.applyPreset('${key}')">
                                    <span class="preset-preview" style="background: linear-gradient(135deg, ${preset.colors.primary}, ${preset.colors.secondary})"></span>
                                    <span class="preset-name">${preset.name}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="theme-section">
                        <h4>커스텀 색상</h4>
                        <div class="theme-colors">
                            ${Object.entries(currentTheme).map(([key, value]) => `
                                <div class="color-picker-group">
                                    <label>${getColorLabel(key)}</label>
                                    <div class="color-input-wrapper">
                                        <input type="color" value="${value}"
                                               onchange="ThemeCustomizer.setColor('${key}', this.value)">
                                        <input type="text" value="${value}"
                                               class="color-hex-input"
                                               onchange="ThemeCustomizer.setColor('${key}', this.value)">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="theme-customizer-footer">
                    <button class="theme-reset-btn" onclick="ThemeCustomizer.reset()">기본으로 리셋</button>
                    <button class="theme-save-btn" onclick="ThemeCustomizer.hide()">확인</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 클릭 외부 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideCustomizer();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                hideCustomizer();
                document.removeEventListener('keydown', escHandler);
            }
        });

        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * 테마 커스터마이저 UI 숨기기
     */
    function hideCustomizer() {
        const modal = document.getElementById('themeCustomizerModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    /**
     * 색상 라벨 반환
     */
    function getColorLabel(key) {
        const labels = {
            primary: '메인 색상',
            secondary: '보조 색상',
            success: '성공',
            warning: '경고',
            danger: '위험',
            accent: '강조'
        };
        return labels[key] || key;
    }

    /**
     * HEX to RGB 변환
     */
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * 색상 밝기 조절
     */
    function adjustColor(hex, percent) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;

        const adjust = (value) => {
            const adjusted = value + (value * percent / 100);
            return Math.min(255, Math.max(0, Math.round(adjusted)));
        };

        const r = adjust(rgb.r).toString(16).padStart(2, '0');
        const g = adjust(rgb.g).toString(16).padStart(2, '0');
        const b = adjust(rgb.b).toString(16).padStart(2, '0');

        return `#${r}${g}${b}`;
    }

    /**
     * 테마 내보내기
     */
    function exportTheme() {
        return JSON.stringify({
            preset: activePreset,
            colors: currentTheme
        }, null, 2);
    }

    /**
     * 테마 가져오기
     */
    function importTheme(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.colors) {
                activePreset = data.preset || 'custom';
                applyTheme({ ...DEFAULT_THEME, ...data.colors });
                saveTheme();
                return true;
            }
        } catch (e) {
            console.error('[ThemeCustomizer] Import failed:', e);
        }
        return false;
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('theme-customizer-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'theme-customizer-modal-styles';
        style.textContent = `
            /* 테마 커스터마이저 모달 */
            .theme-customizer-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s;
            }
            .theme-customizer-modal.show {
                opacity: 1;
                visibility: visible;
            }
            .theme-customizer-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                transform: scale(0.9);
                transition: transform 0.3s;
            }
            .theme-customizer-modal.show .theme-customizer-content {
                transform: scale(1);
            }
            .theme-customizer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #eee;
            }
            .theme-customizer-header h3 {
                margin: 0;
                font-size: 18px;
                color: #333;
            }
            .theme-customizer-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #999;
                cursor: pointer;
                padding: 0 4px;
            }
            .theme-customizer-close:hover {
                color: #333;
            }
            .theme-customizer-body {
                padding: 20px;
            }
            .theme-section {
                margin-bottom: 24px;
            }
            .theme-section:last-child {
                margin-bottom: 0;
            }
            .theme-section h4 {
                margin: 0 0 12px;
                font-size: 14px;
                color: #666;
                font-weight: 600;
            }
            .theme-presets {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
            }
            .theme-preset-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                padding: 10px;
                background: #f8f9fa;
                border: 2px solid transparent;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .theme-preset-btn:hover {
                background: #e9ecef;
            }
            .theme-preset-btn.active {
                border-color: var(--theme-primary, #667eea);
                background: rgba(102, 126, 234, 0.1);
            }
            .preset-preview {
                width: 36px;
                height: 36px;
                border-radius: 50%;
            }
            .preset-name {
                font-size: 11px;
                color: #666;
            }
            .theme-colors {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            .color-picker-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .color-picker-group label {
                font-size: 12px;
                color: #666;
            }
            .color-input-wrapper {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .color-input-wrapper input[type="color"] {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                padding: 0;
            }
            .color-hex-input {
                flex: 1;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-family: monospace;
                font-size: 13px;
            }
            .theme-customizer-footer {
                display: flex;
                justify-content: space-between;
                padding: 16px 20px;
                border-top: 1px solid #eee;
            }
            .theme-reset-btn {
                padding: 10px 20px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            .theme-reset-btn:hover {
                background: #5a6268;
            }
            .theme-save-btn {
                padding: 10px 20px;
                background: var(--theme-primary, #667eea);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            .theme-save-btn:hover {
                opacity: 0.9;
            }

            /* 다크 모드 */
            [data-theme="dark"] .theme-customizer-content {
                background: #1e1e1e;
            }
            [data-theme="dark"] .theme-customizer-header {
                border-bottom-color: #333;
            }
            [data-theme="dark"] .theme-customizer-header h3 {
                color: #e0e0e0;
            }
            [data-theme="dark"] .theme-section h4 {
                color: #aaa;
            }
            [data-theme="dark"] .theme-preset-btn {
                background: #2d2d2d;
            }
            [data-theme="dark"] .theme-preset-btn:hover {
                background: #3d3d3d;
            }
            [data-theme="dark"] .preset-name {
                color: #aaa;
            }
            [data-theme="dark"] .color-picker-group label {
                color: #aaa;
            }
            [data-theme="dark"] .color-hex-input {
                background: #2d2d2d;
                border-color: #444;
                color: #e0e0e0;
            }
            [data-theme="dark"] .theme-customizer-footer {
                border-top-color: #333;
            }

            /* 모바일 */
            @media (max-width: 480px) {
                .theme-presets {
                    grid-template-columns: repeat(3, 1fr);
                }
                .theme-colors {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * CSS 변수 기본값 설정
     */
    function setCssVariables() {
        const style = document.createElement('style');
        style.id = 'theme-customizer-variables';
        style.textContent = `
            :root {
                --theme-primary: ${DEFAULT_THEME.primary};
                --theme-secondary: ${DEFAULT_THEME.secondary};
                --theme-success: ${DEFAULT_THEME.success};
                --theme-warning: ${DEFAULT_THEME.warning};
                --theme-danger: ${DEFAULT_THEME.danger};
                --theme-accent: ${DEFAULT_THEME.accent};
                --theme-gradient: linear-gradient(135deg, ${DEFAULT_THEME.primary} 0%, ${DEFAULT_THEME.secondary} 100%);
            }
        `;
        document.head.insertBefore(style, document.head.firstChild);
    }

    // 초기화
    function init() {
        setCssVariables();
        addStyles();
        loadTheme();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.ThemeCustomizer = {
        show: showCustomizer,
        hide: hideCustomizer,
        applyPreset,
        setColor,
        reset: resetTheme,
        getTheme: () => ({ ...currentTheme }),
        getPresets: () => ({ ...PRESET_THEMES }),
        exportTheme,
        importTheme
    };
})();
