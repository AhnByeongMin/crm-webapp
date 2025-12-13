/**
 * 파일 뷰어 모달
 * 텍스트 기반 파일을 모달에서 미리보기
 */

(function() {
    'use strict';

    // 텍스트로 볼 수 있는 파일 확장자
    const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'py', 'log', 'sql', 'yaml', 'yml', 'ini', 'conf', 'sh', 'bat'];

    // 코드 하이라이팅이 필요한 확장자
    const CODE_EXTENSIONS = ['js', 'py', 'json', 'html', 'css', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bat'];

    // 마크다운 확장자
    const MARKDOWN_EXTENSIONS = ['md', 'markdown'];

    // 파일 확장자 추출
    function getExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // 텍스트 파일인지 확인
    function isTextFile(filename) {
        const ext = getExtension(filename);
        return TEXT_EXTENSIONS.includes(ext);
    }

    // 마크다운 파일인지 확인
    function isMarkdown(filename) {
        const ext = getExtension(filename);
        return MARKDOWN_EXTENSIONS.includes(ext);
    }

    // 코드 파일인지 확인
    function isCodeFile(filename) {
        const ext = getExtension(filename);
        return CODE_EXTENSIONS.includes(ext);
    }

    // HTML 이스케이프
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 간단한 마크다운 렌더링
    function renderMarkdown(text) {
        let html = escapeHtml(text);

        // 코드 블록 (```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>');

        // 인라인 코드 (`)
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // 헤더 (# ~ ######)
        html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // 굵게 (**text**)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 기울임 (*text*)
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 취소선 (~~text~~)
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 링크 ([text](url))
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 순서 없는 목록 (- item)
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // 순서 있는 목록 (1. item)
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // 인용문 (> text)
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

        // 수평선 (---)
        html = html.replace(/^---$/gm, '<hr>');

        // 줄바꿈
        html = html.replace(/\n/g, '<br>');

        // 연속된 br 정리
        html = html.replace(/(<br>){3,}/g, '<br><br>');

        return html;
    }

    // CSV를 테이블로 렌더링
    function renderCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return escapeHtml(text);

        let html = '<table class="csv-table"><thead><tr>';

        // 헤더
        const headers = parseCSVLine(lines[0]);
        headers.forEach(h => {
            html += `<th>${escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 데이터 행 (최대 100행)
        const maxRows = Math.min(lines.length, 101);
        for (let i = 1; i < maxRows; i++) {
            const cols = parseCSVLine(lines[i]);
            html += '<tr>';
            cols.forEach(c => {
                html += `<td>${escapeHtml(c)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';

        if (lines.length > 101) {
            html += `<p class="truncate-notice">... ${lines.length - 101}개 행 더 있음</p>`;
        }

        return html;
    }

    // CSV 행 파싱 (간단한 버전)
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    // JSON 포맷팅
    function renderJSON(text) {
        try {
            const obj = JSON.parse(text);
            const formatted = JSON.stringify(obj, null, 2);
            return `<pre class="code-block json-content">${escapeHtml(formatted)}</pre>`;
        } catch (e) {
            return `<pre class="code-block">${escapeHtml(text)}</pre>`;
        }
    }

    // 코드 렌더링 (줄번호 포함)
    function renderCode(text, ext) {
        const lines = text.split('\n');
        let html = '<div class="code-with-lines">';

        lines.forEach((line, i) => {
            html += `<div class="code-line">`;
            html += `<span class="line-number">${i + 1}</span>`;
            html += `<span class="line-content">${escapeHtml(line) || '&nbsp;'}</span>`;
            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    // 모달 생성
    function createModal() {
        if (document.getElementById('fileViewerModal')) {
            return document.getElementById('fileViewerModal');
        }

        const modal = document.createElement('div');
        modal.id = 'fileViewerModal';
        modal.className = 'file-viewer-modal';
        modal.innerHTML = `
            <div class="file-viewer-backdrop" onclick="FileViewer.close()"></div>
            <div class="file-viewer-container">
                <div class="file-viewer-header">
                    <div class="file-viewer-title">
                        <span class="file-icon">📄</span>
                        <span class="file-name"></span>
                    </div>
                    <div class="file-viewer-actions">
                        <button class="file-viewer-btn" onclick="FileViewer.download()" title="다운로드">
                            <span>⬇️</span> 다운로드
                        </button>
                        <button class="file-viewer-btn" onclick="FileViewer.copyContent()" title="복사">
                            <span>📋</span> 복사
                        </button>
                        <button class="file-viewer-close" onclick="FileViewer.close()" title="닫기">✕</button>
                    </div>
                </div>
                <div class="file-viewer-content">
                    <div class="file-viewer-loading">
                        <div class="spinner"></div>
                        <span>파일 로딩 중...</span>
                    </div>
                    <div class="file-viewer-body"></div>
                    <div class="file-viewer-error" style="display:none;">
                        <span>❌</span>
                        <p>파일을 불러올 수 없습니다.</p>
                    </div>
                </div>
            </div>
        `;

        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            .file-viewer-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                animation: fadeIn 0.2s ease-out;
            }
            .file-viewer-modal.active {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .file-viewer-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
            }
            .file-viewer-container {
                position: relative;
                width: 90%;
                max-width: 900px;
                max-height: 85vh;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: slideUp 0.3s ease-out;
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .file-viewer-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            }
            .file-viewer-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 600;
                font-size: 16px;
                color: #1f2937;
                overflow: hidden;
            }
            .file-viewer-title .file-icon {
                font-size: 24px;
            }
            .file-viewer-title .file-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .file-viewer-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .file-viewer-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                color: #374151;
                transition: all 0.2s;
            }
            .file-viewer-btn:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
            }
            .file-viewer-close {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 20px;
                color: #6b7280;
                transition: all 0.2s;
            }
            .file-viewer-close:hover {
                background: #fee2e2;
                color: #dc2626;
            }
            .file-viewer-content {
                flex: 1;
                overflow: auto;
                padding: 20px;
                background: #fff;
            }
            .file-viewer-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px;
                color: #6b7280;
                gap: 16px;
            }
            .file-viewer-loading .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e5e7eb;
                border-top-color: #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .file-viewer-body {
                display: none;
                line-height: 1.6;
                font-size: 14px;
            }
            .file-viewer-body.loaded {
                display: block;
            }
            .file-viewer-error {
                text-align: center;
                padding: 60px;
                color: #dc2626;
            }
            .file-viewer-error span {
                font-size: 48px;
            }

            /* 마크다운 스타일 */
            .file-viewer-body.markdown h1 { font-size: 2em; margin: 0.5em 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
            .file-viewer-body.markdown h2 { font-size: 1.5em; margin: 0.5em 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
            .file-viewer-body.markdown h3 { font-size: 1.25em; margin: 0.5em 0; }
            .file-viewer-body.markdown h4,
            .file-viewer-body.markdown h5,
            .file-viewer-body.markdown h6 { font-size: 1em; margin: 0.5em 0; }
            .file-viewer-body.markdown blockquote {
                border-left: 4px solid #667eea;
                padding-left: 16px;
                margin: 16px 0;
                color: #4b5563;
                background: #f9fafb;
                padding: 12px 16px;
                border-radius: 0 8px 8px 0;
            }
            .file-viewer-body.markdown ul,
            .file-viewer-body.markdown ol {
                padding-left: 24px;
                margin: 12px 0;
            }
            .file-viewer-body.markdown li {
                margin: 4px 0;
            }
            .file-viewer-body.markdown hr {
                border: none;
                border-top: 2px solid #e5e7eb;
                margin: 24px 0;
            }
            .file-viewer-body.markdown a {
                color: #667eea;
                text-decoration: none;
            }
            .file-viewer-body.markdown a:hover {
                text-decoration: underline;
            }

            /* 코드 스타일 */
            .code-block {
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                line-height: 1.5;
                margin: 12px 0;
            }
            .inline-code {
                background: #f3f4f6;
                color: #e11d48;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 0.9em;
            }
            .code-with-lines {
                background: #1e1e1e;
                color: #d4d4d4;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
            }
            .code-line {
                display: flex;
                line-height: 1.6;
            }
            .code-line:hover {
                background: rgba(255,255,255,0.05);
            }
            .line-number {
                display: inline-block;
                min-width: 50px;
                padding: 0 12px;
                text-align: right;
                color: #6b7280;
                background: rgba(0,0,0,0.2);
                user-select: none;
                border-right: 1px solid #374151;
            }
            .line-content {
                flex: 1;
                padding: 0 16px;
                white-space: pre;
            }

            /* CSV 테이블 스타일 */
            .csv-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .csv-table th,
            .csv-table td {
                border: 1px solid #e5e7eb;
                padding: 8px 12px;
                text-align: left;
            }
            .csv-table th {
                background: #f3f4f6;
                font-weight: 600;
                position: sticky;
                top: 0;
            }
            .csv-table tr:hover {
                background: #f9fafb;
            }
            .truncate-notice {
                text-align: center;
                color: #6b7280;
                padding: 12px;
                font-style: italic;
            }

            /* 일반 텍스트 */
            .plain-text {
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: 'Consolas', 'Monaco', monospace;
                background: #f9fafb;
                padding: 16px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }

            /* 다크 모드 */
            [data-theme="dark"] .file-viewer-container {
                background: #1f2937;
            }
            [data-theme="dark"] .file-viewer-header {
                background: #111827;
                border-bottom-color: #374151;
            }
            [data-theme="dark"] .file-viewer-title {
                color: #f3f4f6;
            }
            [data-theme="dark"] .file-viewer-btn {
                background: #374151;
                border-color: #4b5563;
                color: #d1d5db;
            }
            [data-theme="dark"] .file-viewer-btn:hover {
                background: #4b5563;
            }
            [data-theme="dark"] .file-viewer-close:hover {
                background: rgba(220, 38, 38, 0.2);
            }
            [data-theme="dark"] .file-viewer-content {
                background: #1f2937;
                color: #d1d5db;
            }
            [data-theme="dark"] .file-viewer-body.markdown h1,
            [data-theme="dark"] .file-viewer-body.markdown h2 {
                border-bottom-color: #374151;
            }
            [data-theme="dark"] .file-viewer-body.markdown blockquote {
                background: #111827;
                color: #9ca3af;
            }
            [data-theme="dark"] .inline-code {
                background: #374151;
                color: #f472b6;
            }
            [data-theme="dark"] .csv-table th,
            [data-theme="dark"] .csv-table td {
                border-color: #374151;
            }
            [data-theme="dark"] .csv-table th {
                background: #111827;
            }
            [data-theme="dark"] .csv-table tr:hover {
                background: #111827;
            }
            [data-theme="dark"] .plain-text {
                background: #111827;
                border-color: #374151;
            }

            /* 모바일 */
            @media (max-width: 768px) {
                .file-viewer-container {
                    width: 95%;
                    max-height: 90vh;
                    border-radius: 8px;
                }
                .file-viewer-header {
                    padding: 12px 16px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .file-viewer-title {
                    width: 100%;
                }
                .file-viewer-btn span:last-child {
                    display: none;
                }
                .file-viewer-btn {
                    padding: 8px 10px;
                }
                .file-viewer-content {
                    padding: 12px;
                }
                .line-number {
                    min-width: 36px;
                    padding: 0 8px;
                    font-size: 11px;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                FileViewer.close();
            }
        });

        return modal;
    }

    // 현재 파일 정보
    let currentFile = {
        url: '',
        filename: '',
        content: ''
    };

    // 파일 뷰어 객체
    window.FileViewer = {
        // 파일 열기
        open: function(url, filename) {
            const modal = createModal();
            const loading = modal.querySelector('.file-viewer-loading');
            const body = modal.querySelector('.file-viewer-body');
            const error = modal.querySelector('.file-viewer-error');
            const nameEl = modal.querySelector('.file-name');
            const iconEl = modal.querySelector('.file-icon');

            // 초기화
            currentFile = { url, filename, content: '' };
            nameEl.textContent = filename;
            iconEl.textContent = this.getFileIcon(filename);
            loading.style.display = 'flex';
            body.style.display = 'none';
            body.className = 'file-viewer-body';
            body.innerHTML = '';
            error.style.display = 'none';

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // 파일 내용 가져오기
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load: ' + response.status);
                    return response.text();
                })
                .then(text => {
                    currentFile.content = text;
                    loading.style.display = 'none';

                    const ext = getExtension(filename);
                    let html = '';

                    if (isMarkdown(filename)) {
                        html = renderMarkdown(text);
                        body.classList.add('markdown');
                    } else if (ext === 'csv') {
                        html = renderCSV(text);
                    } else if (ext === 'json') {
                        html = renderJSON(text);
                    } else if (isCodeFile(filename)) {
                        html = renderCode(text, ext);
                    } else {
                        html = `<div class="plain-text">${escapeHtml(text)}</div>`;
                    }

                    body.innerHTML = html;
                    body.style.display = 'block';
                    body.classList.add('loaded');
                })
                .catch(err => {
                    console.error('File load error:', err);
                    loading.style.display = 'none';
                    error.style.display = 'block';
                });
        },

        // 파일 아이콘 가져오기
        getFileIcon: function(filename) {
            const ext = getExtension(filename);
            const icons = {
                'md': '📝',
                'txt': '📄',
                'csv': '📊',
                'json': '🔧',
                'xml': '📋',
                'html': '🌐',
                'css': '🎨',
                'js': '⚡',
                'py': '🐍',
                'sql': '🗃️',
                'log': '📜',
                'yaml': '⚙️',
                'yml': '⚙️',
                'ini': '⚙️',
                'conf': '⚙️',
                'sh': '💻',
                'bat': '💻'
            };
            return icons[ext] || '📄';
        },

        // 닫기
        close: function() {
            const modal = document.getElementById('fileViewerModal');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        // 다운로드
        download: function() {
            if (currentFile.url) {
                const a = document.createElement('a');
                a.href = currentFile.url;
                a.download = currentFile.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        },

        // 내용 복사
        copyContent: function() {
            if (currentFile.content) {
                navigator.clipboard.writeText(currentFile.content)
                    .then(() => {
                        if (window.toast) {
                            toast.success('클립보드에 복사되었습니다');
                        } else {
                            alert('복사되었습니다');
                        }
                    })
                    .catch(err => {
                        console.error('Copy failed:', err);
                        if (window.toast) {
                            toast.error('복사에 실패했습니다');
                        }
                    });
            }
        },

        // 텍스트 파일인지 확인 (외부에서 사용)
        isTextFile: isTextFile
    };

    // 전역 함수로 파일 열기 (채팅에서 사용)
    window.openFileViewer = function(url, filename) {
        if (FileViewer.isTextFile(filename)) {
            FileViewer.open(url, filename);
        } else {
            // 텍스트가 아닌 파일은 새 탭에서 열기
            window.open(url, '_blank');
        }
    };

})();
