/**
 * 파일 업로드 진행률 표시 모듈
 * XHR/Fetch 업로드 진행 상황 시각화
 */

(function() {
    'use strict';

    // 활성 업로드 추적
    const activeUploads = new Map();
    let uploadId = 0;

    /**
     * 진행률 UI 생성
     */
    function createProgressUI() {
        if (document.getElementById('uploadProgressContainer')) {
            return document.getElementById('uploadProgressContainer');
        }

        const container = document.createElement('div');
        container.id = 'uploadProgressContainer';
        container.className = 'upload-progress-container';
        document.body.appendChild(container);

        return container;
    }

    /**
     * 업로드 항목 UI 생성
     */
    function createUploadItem(id, fileName, fileSize) {
        const container = createProgressUI();

        const item = document.createElement('div');
        item.id = `upload-${id}`;
        item.className = 'upload-item';
        item.innerHTML = `
            <div class="upload-item-header">
                <span class="upload-filename" title="${fileName}">${truncateFileName(fileName)}</span>
                <button class="upload-cancel-btn" onclick="UploadProgress.cancel(${id})" title="취소">✕</button>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <div class="upload-item-footer">
                <span class="upload-status">준비 중...</span>
                <span class="upload-size">${formatFileSize(fileSize)}</span>
            </div>
        `;

        container.appendChild(item);
        return item;
    }

    /**
     * 진행률 업데이트
     */
    function updateProgress(id, percent, status) {
        const item = document.getElementById(`upload-${id}`);
        if (!item) return;

        const fill = item.querySelector('.upload-progress-fill');
        const statusEl = item.querySelector('.upload-status');

        fill.style.width = `${percent}%`;

        if (status) {
            statusEl.textContent = status;
        } else if (percent < 100) {
            statusEl.textContent = `${percent}% 업로드 중...`;
        }

        // 상태에 따른 색상
        if (percent >= 100) {
            fill.classList.add('complete');
        }
    }

    /**
     * 업로드 완료
     */
    function completeUpload(id, success = true, message = '') {
        const item = document.getElementById(`upload-${id}`);
        if (!item) return;

        const fill = item.querySelector('.upload-progress-fill');
        const statusEl = item.querySelector('.upload-status');
        const cancelBtn = item.querySelector('.upload-cancel-btn');

        cancelBtn.style.display = 'none';

        if (success) {
            fill.style.width = '100%';
            fill.classList.add('complete');
            statusEl.textContent = message || '완료';
            item.classList.add('success');
        } else {
            fill.classList.add('error');
            statusEl.textContent = message || '실패';
            item.classList.add('error');
        }

        activeUploads.delete(id);

        // 3초 후 자동 제거
        setTimeout(() => {
            item.classList.add('fade-out');
            setTimeout(() => {
                item.remove();
                cleanupContainer();
            }, 300);
        }, 3000);
    }

    /**
     * 업로드 취소
     */
    function cancelUpload(id) {
        const upload = activeUploads.get(id);
        if (upload && upload.xhr) {
            upload.xhr.abort();
        }

        activeUploads.delete(id);
        completeUpload(id, false, '취소됨');
    }

    /**
     * 컨테이너 정리
     */
    function cleanupContainer() {
        const container = document.getElementById('uploadProgressContainer');
        if (container && container.children.length === 0) {
            container.remove();
        }
    }

    /**
     * XHR 기반 파일 업로드
     */
    function uploadWithXHR(url, file, options = {}) {
        const {
            method = 'POST',
            headers = {},
            fieldName = 'file',
            extraData = {},
            onProgress,
            onComplete,
            onError
        } = options;

        const id = ++uploadId;
        const item = createUploadItem(id, file.name, file.size);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();

            formData.append(fieldName, file);

            // 추가 데이터
            Object.entries(extraData).forEach(([key, value]) => {
                formData.append(key, value);
            });

            activeUploads.set(id, { xhr, file });

            // 진행률 이벤트
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    updateProgress(id, percent);

                    if (onProgress) {
                        onProgress({
                            loaded: e.loaded,
                            total: e.total,
                            percent
                        });
                    }
                }
            };

            // 완료 이벤트
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    let response;
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch {
                        response = xhr.responseText;
                    }

                    completeUpload(id, true, '업로드 완료');

                    if (onComplete) {
                        onComplete(response);
                    }

                    resolve(response);
                } else {
                    const error = new Error(`Upload failed: ${xhr.status}`);
                    completeUpload(id, false, `오류 (${xhr.status})`);

                    if (onError) {
                        onError(error);
                    }

                    reject(error);
                }
            };

            // 에러 이벤트
            xhr.onerror = () => {
                const error = new Error('Network error');
                completeUpload(id, false, '네트워크 오류');

                if (onError) {
                    onError(error);
                }

                reject(error);
            };

            // 취소 이벤트
            xhr.onabort = () => {
                reject(new Error('Upload cancelled'));
            };

            xhr.open(method, url);

            // 헤더 설정 (Content-Type 제외 - FormData가 자동 설정)
            Object.entries(headers).forEach(([key, value]) => {
                if (key.toLowerCase() !== 'content-type') {
                    xhr.setRequestHeader(key, value);
                }
            });

            xhr.send(formData);
        });
    }

    /**
     * 여러 파일 업로드
     */
    async function uploadMultiple(url, files, options = {}) {
        const {
            sequential = false,
            maxConcurrent = 3,
            ...uploadOptions
        } = options;

        const results = [];

        if (sequential) {
            for (const file of files) {
                try {
                    const result = await uploadWithXHR(url, file, uploadOptions);
                    results.push({ file, success: true, result });
                } catch (error) {
                    results.push({ file, success: false, error });
                }
            }
        } else {
            // 동시 업로드 (제한 있음)
            const pending = [...files];
            const executing = [];

            while (pending.length > 0 || executing.length > 0) {
                while (pending.length > 0 && executing.length < maxConcurrent) {
                    const file = pending.shift();
                    const promise = uploadWithXHR(url, file, uploadOptions)
                        .then(result => ({ file, success: true, result }))
                        .catch(error => ({ file, success: false, error }));

                    executing.push(promise);
                }

                if (executing.length > 0) {
                    const completed = await Promise.race(executing);
                    results.push(completed);
                    executing.splice(executing.indexOf(completed), 1);
                }
            }
        }

        return results;
    }

    /**
     * 드래그 앤 드롭 업로드 설정
     */
    function setupDropZone(element, url, options = {}) {
        const {
            onDragEnter,
            onDragLeave,
            onDrop,
            accept = '*',
            maxSize = 50 * 1024 * 1024, // 50MB
            ...uploadOptions
        } = options;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
        });

        element.addEventListener('dragenter', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
            if (onDragEnter) onDragEnter(e);
        });

        element.addEventListener('dragleave', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            if (onDragLeave) onDragLeave(e);
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);

            // 파일 필터링
            const validFiles = files.filter(file => {
                if (accept !== '*' && !file.type.match(accept)) {
                    if (window.toast) {
                        toast.warning(`${file.name}: 지원하지 않는 파일 형식`);
                    }
                    return false;
                }

                if (file.size > maxSize) {
                    if (window.toast) {
                        toast.warning(`${file.name}: 파일 크기 초과 (최대 ${formatFileSize(maxSize)})`);
                    }
                    return false;
                }

                return true;
            });

            if (validFiles.length > 0) {
                if (onDrop) onDrop(validFiles);
                await uploadMultiple(url, validFiles, uploadOptions);
            }
        });
    }

    // ========== 유틸리티 ==========

    function truncateFileName(name, maxLength = 25) {
        if (name.length <= maxLength) return name;

        const ext = name.split('.').pop();
        const baseName = name.slice(0, -(ext.length + 1));
        const truncated = baseName.slice(0, maxLength - ext.length - 4);

        return `${truncated}...${ext}`;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('upload-progress-styles')) return;

        const style = document.createElement('style');
        style.id = 'upload-progress-styles';
        style.textContent = `
            .upload-progress-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 320px;
            }

            .upload-item {
                background: white;
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideIn 0.3s ease;
            }

            .upload-item.fade-out {
                animation: slideOut 0.3s ease forwards;
            }

            .upload-item.success {
                border-left: 4px solid #28a745;
            }

            .upload-item.error {
                border-left: 4px solid #dc3545;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }

            .upload-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .upload-filename {
                font-size: 13px;
                font-weight: 500;
                color: #333;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 240px;
            }

            .upload-cancel-btn {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
            }

            .upload-cancel-btn:hover {
                background: #f0f0f0;
                color: #666;
            }

            .upload-progress-bar {
                height: 6px;
                background: #e9ecef;
                border-radius: 3px;
                overflow: hidden;
            }

            .upload-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 3px;
                transition: width 0.3s ease;
            }

            .upload-progress-fill.complete {
                background: #28a745;
            }

            .upload-progress-fill.error {
                background: #dc3545;
            }

            .upload-item-footer {
                display: flex;
                justify-content: space-between;
                margin-top: 6px;
                font-size: 11px;
                color: #666;
            }

            /* 드래그 오버 스타일 */
            .drag-over {
                background: rgba(102, 126, 234, 0.1) !important;
                border-color: #667eea !important;
                border-style: dashed !important;
            }

            /* 다크모드 */
            [data-theme="dark"] .upload-item {
                background: #2d2d2d;
            }

            [data-theme="dark"] .upload-filename {
                color: #e0e0e0;
            }

            [data-theme="dark"] .upload-cancel-btn:hover {
                background: #404040;
            }

            [data-theme="dark"] .upload-progress-bar {
                background: #404040;
            }

            [data-theme="dark"] .upload-item-footer {
                color: #999;
            }
        `;
        document.head.appendChild(style);
    }

    // 초기화
    addStyles();

    // 전역 노출
    window.UploadProgress = {
        upload: uploadWithXHR,
        uploadMultiple,
        setupDropZone,
        cancel: cancelUpload,
        updateProgress,
        complete: completeUpload
    };
})();
