/**
 * 전역 폰트 크기 설정
 * CSS zoom을 사용하여 고정 px 값도 함께 확대/축소
 */
(function() {
    const FONT_SIZE_KEY = 'crm_font_size';
    const zoomLevels = {
        small: 0.9,    // 90%
        medium: 1.0,   // 100%
        large: 1.15    // 115%
    };

    const savedSize = localStorage.getItem(FONT_SIZE_KEY) || 'medium';

    // CSS zoom 적용
    function applyZoom(size) {
        const zoom = zoomLevels[size] || 1.0;

        // 다양한 메인 컨테이너 셀렉터
        const containerSelectors = [
            '.container',
            '.chat-container',
            '.page-content',
            '.page-container',
            'main',
            '.content'
        ];

        let applied = false;
        for (const selector of containerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                el.style.zoom = zoom;
                applied = true;
                break;
            }
        }

        // fallback: body에 적용하되 헤더는 리셋
        if (!applied && document.body) {
            document.body.style.zoom = zoom;
            const header = document.querySelector('.header');
            if (header) {
                header.style.zoom = 1 / zoom;
            }
        }
    }

    // DOMContentLoaded에서 적용
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            applyZoom(savedSize);
        });
    } else {
        // 이미 로드된 경우 즉시 적용
        applyZoom(savedSize);
    }

    // 전역 함수로 노출
    window.applyFontZoom = applyZoom;
})();
