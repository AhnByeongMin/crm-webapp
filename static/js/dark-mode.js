/**
 * 전역 다크 모드 설정
 * localStorage에 저장된 설정을 페이지 로드 시 적용
 */
(function() {
    const DARK_MODE_KEY = 'crm_dark_mode';

    // 저장된 다크 모드 설정 적용
    const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);

    if (savedDarkMode === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (savedDarkMode === null) {
        // 시스템 설정 따르기 (처음 방문 시)
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem(DARK_MODE_KEY, 'true');
        }
    }
})();

/**
 * 다크 모드 토글 함수 (마이페이지에서 사용)
 */
function toggleDarkMode() {
    const DARK_MODE_KEY = 'crm_dark_mode';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(DARK_MODE_KEY, 'false');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(DARK_MODE_KEY, 'true');
    }

    // 토글 스위치 UI 업데이트
    updateDarkModeToggle();

    return !isDark;
}

/**
 * 다크 모드 토글 UI 업데이트
 */
function updateDarkModeToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const toggleSwitch = document.querySelector('.toggle-switch');
    const toggleLabel = document.querySelector('.toggle-label');

    if (toggleSwitch) {
        toggleSwitch.classList.toggle('active', isDark);
    }

    if (toggleLabel) {
        toggleLabel.textContent = isDark ? '다크 모드 켜짐' : '다크 모드 꺼짐';
    }
}

/**
 * 현재 다크 모드 상태 반환
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}
