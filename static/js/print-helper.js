/**
 * 인쇄 도우미 모듈
 * 페이지 인쇄 최적화 및 인쇄 미리보기 기능
 */

(function() {
    'use strict';

    /**
     * 인쇄 실행
     */
    function printPage(options = {}) {
        const {
            title = document.title,
            showHeader = true,
            showFooter = true,
            beforePrint,
            afterPrint
        } = options;

        // 인쇄 전 콜백
        if (beforePrint) beforePrint();

        // 인쇄 헤더 추가
        if (showHeader) {
            addPrintHeader(title);
        }

        // 인쇄 푸터 추가
        if (showFooter) {
            addPrintFooter();
        }

        // 인쇄 대화상자
        window.print();

        // 인쇄 후 정리 (약간의 지연)
        setTimeout(() => {
            removePrintElements();
            if (afterPrint) afterPrint();
        }, 1000);
    }

    /**
     * 특정 요소만 인쇄
     */
    function printElement(selector, options = {}) {
        const element = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!element) {
            console.error('[PrintHelper] Element not found:', selector);
            return;
        }

        const {
            title = document.title,
            styles = true
        } = options;

        // 새 창에서 인쇄
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            if (window.toast) {
                toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
            }
            return;
        }

        // 스타일 수집
        let styleContent = '';
        if (styles) {
            document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
                if (el.tagName === 'LINK') {
                    styleContent += `<link rel="stylesheet" href="${el.href}">`;
                } else {
                    styleContent += el.outerHTML;
                }
            });
        }

        // 인쇄용 HTML 생성
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                ${styleContent}
                <link rel="stylesheet" href="/static/css/print.css">
                <style>
                    body { padding: 20px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="print-header print-only">
                    <h1>${title}</h1>
                    <div class="print-date">인쇄일: ${formatDate(new Date())}</div>
                </div>
                ${element.outerHTML}
                <div class="print-footer print-only">
                    © ${new Date().getFullYear()} CRM System
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();

        // 로드 완료 후 인쇄
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    }

    /**
     * 테이블 데이터 인쇄
     */
    function printTable(data, options = {}) {
        const {
            title = '데이터 출력',
            columns = [],
            orientation = 'portrait'
        } = options;

        // 컬럼 헤더
        const headers = columns.length > 0
            ? columns.map(c => c.label || c.key)
            : Object.keys(data[0] || {});

        const keys = columns.length > 0
            ? columns.map(c => c.key)
            : Object.keys(data[0] || {});

        // 테이블 HTML 생성
        let tableHtml = `
            <table class="${orientation === 'landscape' ? 'print-landscape' : ''}">
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>
                            ${keys.map(key => `<td>${formatValue(getNestedValue(row, key))}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // 임시 컨테이너 생성
        const container = document.createElement('div');
        container.innerHTML = tableHtml;
        document.body.appendChild(container);

        // 인쇄
        printElement(container, { title });

        // 정리
        document.body.removeChild(container);
    }

    /**
     * 채팅 내역 인쇄
     */
    function printChatHistory(messages, options = {}) {
        const {
            chatName = '채팅',
            participants = []
        } = options;

        let chatHtml = `
            <div class="chat-print-container">
                <div class="chat-info">
                    <h2>${chatName}</h2>
                    ${participants.length > 0 ? `<p>참여자: ${participants.join(', ')}</p>` : ''}
                    <p>메시지 수: ${messages.length}</p>
                </div>
                <div class="chat-messages">
                    ${messages.map(msg => `
                        <div class="message-bubble ${msg.is_mine ? 'sent' : 'received'}">
                            <div class="message-sender">${msg.sender || '알 수 없음'}</div>
                            <div class="message-content">${msg.content}</div>
                            <div class="message-time">${formatDate(new Date(msg.timestamp))}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // 임시 컨테이너
        const container = document.createElement('div');
        container.innerHTML = chatHtml;
        document.body.appendChild(container);

        printElement(container, { title: `${chatName} - 채팅 내역` });

        document.body.removeChild(container);
    }

    /**
     * 인쇄 헤더 추가
     */
    function addPrintHeader(title) {
        if (document.getElementById('printHeader')) return;

        const header = document.createElement('div');
        header.id = 'printHeader';
        header.className = 'print-header print-only';
        header.innerHTML = `
            <h1>${title}</h1>
            <div class="print-date">인쇄일: ${formatDate(new Date())}</div>
        `;

        const mainContent = document.querySelector('main, .container, .page-content, body');
        if (mainContent && mainContent !== document.body) {
            mainContent.insertBefore(header, mainContent.firstChild);
        } else {
            document.body.insertBefore(header, document.body.firstChild);
        }
    }

    /**
     * 인쇄 푸터 추가
     */
    function addPrintFooter() {
        if (document.getElementById('printFooter')) return;

        const footer = document.createElement('div');
        footer.id = 'printFooter';
        footer.className = 'print-footer print-only';
        footer.innerHTML = `© ${new Date().getFullYear()} CRM System`;

        document.body.appendChild(footer);
    }

    /**
     * 인쇄 요소 제거
     */
    function removePrintElements() {
        const header = document.getElementById('printHeader');
        const footer = document.getElementById('printFooter');

        if (header) header.remove();
        if (footer) footer.remove();
    }

    /**
     * 인쇄 버튼 추가
     */
    function addPrintButton(options = {}) {
        const {
            position = 'bottom-right',
            icon = '🖨️',
            title = '인쇄'
        } = options;

        // 이미 존재하면 무시
        if (document.getElementById('printHelperBtn')) return;

        const btn = document.createElement('button');
        btn.id = 'printHelperBtn';
        btn.className = 'print-preview-btn no-print';
        btn.innerHTML = icon;
        btn.title = title;

        // 위치 설정
        const positions = {
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-left': { bottom: '20px', left: '20px' },
            'top-right': { top: '80px', right: '20px' },
            'top-left': { top: '80px', left: '20px' }
        };

        Object.assign(btn.style, positions[position] || positions['bottom-right']);

        btn.addEventListener('click', () => {
            printPage({ title: document.title });
        });

        document.body.appendChild(btn);
    }

    /**
     * PDF 다운로드 (html2pdf 라이브러리 필요)
     */
    async function downloadPdf(selector, options = {}) {
        const {
            filename = 'document.pdf',
            margin = 10,
            pageSize = 'a4',
            orientation = 'portrait'
        } = options;

        // html2pdf 라이브러리 확인
        if (typeof html2pdf === 'undefined') {
            console.warn('[PrintHelper] html2pdf library not loaded');
            if (window.toast) {
                toast.warning('PDF 다운로드를 위해 html2pdf 라이브러리가 필요합니다.');
            }
            return false;
        }

        const element = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!element) {
            console.error('[PrintHelper] Element not found');
            return false;
        }

        const opt = {
            margin,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: pageSize, orientation }
        };

        try {
            await html2pdf().set(opt).from(element).save();
            return true;
        } catch (error) {
            console.error('[PrintHelper] PDF generation failed:', error);
            return false;
        }
    }

    // ========== 유틸리티 ==========

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}`;
    }

    function formatValue(value) {
        if (value === null || value === undefined) return '-';
        if (value instanceof Date) return formatDate(value);
        if (typeof value === 'boolean') return value ? '예' : '아니오';
        return String(value);
    }

    function getNestedValue(obj, path) {
        return path.split('.').reduce((c, k) => c && c[k], obj);
    }

    /**
     * 인쇄 이벤트 리스너 등록
     */
    function onBeforePrint(callback) {
        window.addEventListener('beforeprint', callback);
    }

    function onAfterPrint(callback) {
        window.addEventListener('afterprint', callback);
    }

    /**
     * 키보드 단축키 (Ctrl+P)
     */
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+P로 커스텀 인쇄
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                printPage({ title: document.title });
            }
        });
    }

    // 초기화
    function init() {
        setupKeyboardShortcut();

        // data-print-button 속성이 있으면 인쇄 버튼 추가
        if (document.querySelector('[data-print-button]')) {
            addPrintButton();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 노출
    window.PrintHelper = {
        print: printPage,
        printElement,
        printTable,
        printChatHistory,
        addButton: addPrintButton,
        downloadPdf,
        onBeforePrint,
        onAfterPrint
    };
})();
