/**
 * CRM 페이지 전환 애니메이션
 * 부드러운 페이지 전환 효과를 제공합니다.
 */

(function() {
    'use strict';

    // 페이지 로드 시 애니메이션 적용
    document.addEventListener('DOMContentLoaded', function() {
        // 컨테이너에 페이지 전환 애니메이션 클래스 추가
        const container = document.querySelector('.container');
        if (container) {
            container.classList.add('page-transition');
        }

        // 섹션 애니메이션 적용 (필터 섹션, 메인 레이아웃 등)
        const sections = document.querySelectorAll('.filter-section, .main-layout, .controls, .table-container, .tabs');
        sections.forEach((section, index) => {
            section.classList.add('section-animate');
            section.style.animationDelay = `${0.05 + index * 0.05}s`;
        });
    });

    // 내부 링크 클릭 시 페이지 떠나기 애니메이션
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href]');

        if (!link) return;

        const href = link.getAttribute('href');

        // 외부 링크, 해시 링크, 새 탭 링크는 제외
        if (!href ||
            href.startsWith('#') ||
            href.startsWith('http') ||
            href.startsWith('javascript:') ||
            link.target === '_blank' ||
            e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }

        // 같은 페이지 내 링크 제외
        if (href === window.location.pathname) {
            return;
        }

        e.preventDefault();

        const container = document.querySelector('.container');
        if (container) {
            container.classList.remove('page-transition');
            container.classList.add('page-leaving');

            setTimeout(function() {
                window.location.href = href;
            }, 200);
        } else {
            window.location.href = href;
        }
    });

    // 브라우저 뒤로가기/앞으로가기 시에도 애니메이션 적용
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            // 캐시된 페이지에서 돌아왔을 때
            const container = document.querySelector('.container');
            if (container) {
                container.classList.remove('page-leaving');
                container.classList.add('page-transition');
            }
        }
    });

    // 폼 제출 시 페이지 떠나기 애니메이션 (GET 요청인 경우)
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form.method.toLowerCase() === 'get') {
            const container = document.querySelector('.container');
            if (container) {
                container.classList.add('page-leaving');
            }
        }
    });
})();
