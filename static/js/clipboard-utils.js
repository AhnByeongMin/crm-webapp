/**
 * 클립보드 유틸리티
 * 텍스트/이미지 복사, 붙여넣기 지원
 */

(function() {
    'use strict';

    /**
     * 텍스트 복사
     */
    async function copyText(text) {
        try {
            // 최신 Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                showCopyFeedback('복사됨');
                return true;
            }
        } catch (err) {
            console.warn('[Clipboard] API 실패, 폴백 사용:', err);
        }

        // 폴백: execCommand
        return copyTextFallback(text);
    }

    /**
     * 텍스트 복사 폴백 (구버전 브라우저)
     */
    function copyTextFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');

        document.body.appendChild(textarea);
        textarea.select();

        let success = false;
        try {
            success = document.execCommand('copy');
            if (success) {
                showCopyFeedback('복사됨');
            }
        } catch (err) {
            console.error('[Clipboard] execCommand 실패:', err);
        }

        document.body.removeChild(textarea);
        return success;
    }

    /**
     * 텍스트 읽기 (붙여넣기)
     */
    async function readText() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                return text;
            }
        } catch (err) {
            console.warn('[Clipboard] 읽기 권한 없음:', err);
        }

        return null;
    }

    /**
     * 이미지 복사
     */
    async function copyImage(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({
                    [blob.type]: blob
                });
                await navigator.clipboard.write([item]);
                showCopyFeedback('이미지 복사됨');
                return true;
            }
        } catch (err) {
            console.error('[Clipboard] 이미지 복사 실패:', err);
        }

        // 이미지 폴백: URL 복사
        return copyText(imageUrl);
    }

    /**
     * Canvas를 이미지로 복사
     */
    async function copyCanvas(canvas) {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({
                    'image/png': blob
                });
                await navigator.clipboard.write([item]);
                showCopyFeedback('이미지 복사됨');
                return true;
            }
        } catch (err) {
            console.error('[Clipboard] Canvas 복사 실패:', err);
        }

        return false;
    }

    /**
     * HTML 복사
     */
    async function copyHtml(html, plainText) {
        try {
            if (navigator.clipboard && navigator.clipboard.write) {
                const htmlBlob = new Blob([html], { type: 'text/html' });
                const textBlob = new Blob([plainText || html], { type: 'text/plain' });

                const item = new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                });

                await navigator.clipboard.write([item]);
                showCopyFeedback('복사됨');
                return true;
            }
        } catch (err) {
            console.warn('[Clipboard] HTML 복사 실패:', err);
        }

        // 폴백: 일반 텍스트 복사
        return copyText(plainText || html);
    }

    /**
     * 클립보드에서 이미지 읽기
     */
    async function readImage() {
        try {
            if (navigator.clipboard && navigator.clipboard.read) {
                const items = await navigator.clipboard.read();

                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            return blob;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[Clipboard] 이미지 읽기 실패:', err);
        }

        return null;
    }

    /**
     * 복사 피드백 표시
     */
    function showCopyFeedback(message) {
        if (window.toast) {
            toast.success(message, { duration: 1500 });
        }
    }

    /**
     * 복사 버튼 자동 설정
     */
    function setupCopyButtons() {
        document.querySelectorAll('[data-copy]').forEach(btn => {
            if (btn.dataset.copySetup) return;

            btn.addEventListener('click', async (e) => {
                e.preventDefault();

                const target = btn.dataset.copy;
                let textToCopy = '';

                if (target === 'self') {
                    // 버튼 자체의 텍스트
                    textToCopy = btn.dataset.copyText || btn.textContent;
                } else if (target.startsWith('#')) {
                    // ID로 요소 찾기
                    const element = document.querySelector(target);
                    if (element) {
                        textToCopy = element.value || element.textContent;
                    }
                } else {
                    // 직접 텍스트
                    textToCopy = target;
                }

                if (textToCopy) {
                    const success = await copyText(textToCopy);

                    // 버튼 상태 변경
                    if (success) {
                        const originalText = btn.textContent;
                        const originalIcon = btn.innerHTML;

                        btn.textContent = '복사됨!';
                        btn.classList.add('copied');

                        setTimeout(() => {
                            btn.innerHTML = originalIcon;
                            btn.classList.remove('copied');
                        }, 1500);
                    }
                }
            });

            btn.dataset.copySetup = 'true';
        });
    }

    /**
     * 붙여넣기 이벤트 처리
     */
    function setupPasteHandler(element, callback) {
        element.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                // 이미지 붙여넣기
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob && callback) {
                        callback({ type: 'image', data: blob });
                    }
                    return;
                }

                // 파일 붙여넣기
                if (item.kind === 'file') {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file && callback) {
                        callback({ type: 'file', data: file });
                    }
                    return;
                }

                // 텍스트 붙여넣기
                if (item.type === 'text/plain') {
                    item.getAsString((text) => {
                        if (callback) {
                            callback({ type: 'text', data: text });
                        }
                    });
                }
            }
        });
    }

    /**
     * URL 복사 헬퍼
     */
    function copyCurrentUrl() {
        return copyText(window.location.href);
    }

    /**
     * 선택 영역 복사
     */
    function copySelection() {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
            return copyText(selection.toString());
        }
        return false;
    }

    /**
     * 공유 API 활용 (가능한 경우)
     */
    async function share(data) {
        const { title, text, url, files } = data;

        // Web Share API 지원 확인
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url,
                    files: files || undefined
                });
                return true;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('[Share] 공유 실패:', err);
                }
            }
        }

        // 폴백: URL만 복사
        if (url) {
            await copyText(url);
            if (window.toast) {
                toast.info('링크가 복사되었습니다.');
            }
            return true;
        }

        return false;
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('clipboard-styles')) return;

        const style = document.createElement('style');
        style.id = 'clipboard-styles';
        style.textContent = `
            /* 복사 버튼 스타일 */
            [data-copy] {
                cursor: pointer;
                transition: all 0.2s;
            }

            [data-copy]:hover {
                opacity: 0.8;
            }

            [data-copy].copied {
                color: #28a745 !important;
            }

            /* 복사 가능 텍스트 */
            .copyable {
                cursor: pointer;
                border-bottom: 1px dashed #999;
            }

            .copyable:hover {
                background: rgba(102, 126, 234, 0.1);
            }

            /* 인라인 복사 버튼 */
            .copy-btn-inline {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                background: #f0f0f0;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-left: 4px;
                vertical-align: middle;
                transition: all 0.2s;
            }

            .copy-btn-inline:hover {
                background: #e0e0e0;
            }

            .copy-btn-inline.copied {
                background: #d4edda;
                color: #28a745;
            }

            /* 다크모드 */
            [data-theme="dark"] .copyable:hover {
                background: rgba(102, 126, 234, 0.2);
            }

            [data-theme="dark"] .copy-btn-inline {
                background: #333;
            }

            [data-theme="dark"] .copy-btn-inline:hover {
                background: #444;
            }

            [data-theme="dark"] .copy-btn-inline.copied {
                background: #1e4620;
                color: #51cf66;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 복사 가능 요소 설정
     */
    function setupCopyableElements() {
        document.querySelectorAll('.copyable').forEach(el => {
            if (el.dataset.copyableSetup) return;

            el.addEventListener('click', () => {
                copyText(el.textContent);
            });

            el.title = '클릭하여 복사';
            el.dataset.copyableSetup = 'true';
        });
    }

    // 초기화
    function init() {
        addStyles();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupCopyButtons();
                setupCopyableElements();
            });
        } else {
            setupCopyButtons();
            setupCopyableElements();
        }

        // DOM 변경 감지
        const observer = new MutationObserver(() => {
            setupCopyButtons();
            setupCopyableElements();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    init();

    // 전역 노출
    window.ClipboardUtils = {
        copyText,
        readText,
        copyImage,
        copyCanvas,
        copyHtml,
        readImage,
        copyCurrentUrl,
        copySelection,
        share,
        setupPasteHandler
    };
})();
