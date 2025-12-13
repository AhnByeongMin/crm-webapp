/**
 * 전역 폰트 크기 설정
 * localStorage에 저장된 설정을 페이지 로드 시 적용
 */
(function() {
    const FONT_SIZE_KEY = 'crm_font_size';
    const fontSizes = {
        small: '14px',
        medium: '16px',
        large: '18px'
    };

    const savedSize = localStorage.getItem(FONT_SIZE_KEY) || 'medium';
    document.documentElement.style.fontSize = fontSizes[savedSize];
})();
