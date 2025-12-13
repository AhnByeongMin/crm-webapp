/**
 * 음성 입력 모듈
 * Web Speech API를 활용한 음성-텍스트 변환
 */

(function() {
    'use strict';

    // Speech Recognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // 지원 여부
    const isSupported = !!SpeechRecognition;

    // 활성 인스턴스
    let recognition = null;
    let isListening = false;
    let currentTarget = null;

    /**
     * 음성 인식 시작
     */
    function startListening(options = {}) {
        if (!isSupported) {
            if (window.toast) {
                toast.error('이 브라우저는 음성 입력을 지원하지 않습니다.');
            }
            return false;
        }

        if (isListening) {
            stopListening();
            return false;
        }

        const {
            target,
            language = 'ko-KR',
            continuous = false,
            interimResults = true,
            maxAlternatives = 1,
            onStart,
            onResult,
            onEnd,
            onError
        } = options;

        currentTarget = target;

        recognition = new SpeechRecognition();
        recognition.lang = language;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.maxAlternatives = maxAlternatives;

        recognition.onstart = () => {
            isListening = true;
            showListeningIndicator();

            if (onStart) onStart();
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // 타겟 입력 필드에 결과 삽입
            if (currentTarget) {
                if (finalTranscript) {
                    insertText(currentTarget, finalTranscript);
                }

                // 임시 결과 표시 (선택적)
                if (interimTranscript) {
                    showInterimResult(currentTarget, interimTranscript);
                }
            }

            if (onResult) {
                onResult({
                    final: finalTranscript,
                    interim: interimTranscript,
                    isFinal: event.results[event.results.length - 1].isFinal
                });
            }
        };

        recognition.onerror = (event) => {
            console.error('[VoiceInput] Error:', event.error);

            let errorMessage = '음성 인식 오류';

            switch (event.error) {
                case 'no-speech':
                    errorMessage = '음성이 감지되지 않았습니다.';
                    break;
                case 'audio-capture':
                    errorMessage = '마이크를 찾을 수 없습니다.';
                    break;
                case 'not-allowed':
                    errorMessage = '마이크 권한이 필요합니다.';
                    break;
                case 'network':
                    errorMessage = '네트워크 오류가 발생했습니다.';
                    break;
                case 'aborted':
                    errorMessage = '음성 입력이 취소되었습니다.';
                    break;
            }

            if (window.toast && event.error !== 'aborted') {
                toast.error(errorMessage);
            }

            if (onError) onError(event.error, errorMessage);

            stopListening();
        };

        recognition.onend = () => {
            isListening = false;
            hideListeningIndicator();
            clearInterimResult();

            if (onEnd) onEnd();
        };

        try {
            recognition.start();
            return true;
        } catch (error) {
            console.error('[VoiceInput] Start failed:', error);
            return false;
        }
    }

    /**
     * 음성 인식 중지
     */
    function stopListening() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        isListening = false;
        hideListeningIndicator();
        clearInterimResult();
    }

    /**
     * 텍스트 삽입
     */
    function insertText(target, text) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const currentValue = target.value;

            // 커서 위치에 텍스트 삽입
            target.value = currentValue.substring(0, start) + text + currentValue.substring(end);

            // 커서 위치 업데이트
            const newPosition = start + text.length;
            target.setSelectionRange(newPosition, newPosition);

            // input 이벤트 발생
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (target.isContentEditable) {
            document.execCommand('insertText', false, text);
        }
    }

    /**
     * 임시 결과 표시
     */
    function showInterimResult(target, text) {
        let indicator = document.getElementById('voiceInterimResult');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voiceInterimResult';
            indicator.className = 'voice-interim-result';
            document.body.appendChild(indicator);
        }

        // 위치 설정
        const rect = target.getBoundingClientRect();
        indicator.style.top = `${rect.bottom + 5}px`;
        indicator.style.left = `${rect.left}px`;
        indicator.style.width = `${rect.width}px`;

        indicator.textContent = text;
        indicator.style.display = 'block';
    }

    /**
     * 임시 결과 제거
     */
    function clearInterimResult() {
        const indicator = document.getElementById('voiceInterimResult');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 듣기 표시기 표시
     */
    function showListeningIndicator() {
        let indicator = document.getElementById('voiceListeningIndicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voiceListeningIndicator';
            indicator.className = 'voice-listening-indicator';
            indicator.innerHTML = `
                <div class="voice-waves">
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
                <span class="voice-text">듣는 중...</span>
            `;
            document.body.appendChild(indicator);
        }

        indicator.classList.add('show');
    }

    /**
     * 듣기 표시기 숨김
     */
    function hideListeningIndicator() {
        const indicator = document.getElementById('voiceListeningIndicator');
        if (indicator) {
            indicator.classList.remove('show');
        }
    }

    /**
     * 음성 입력 버튼 추가
     */
    function addVoiceButton(input, options = {}) {
        if (!isSupported) return null;

        const {
            position = 'inside', // inside, after
            language = 'ko-KR'
        } = options;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'voice-input-btn';
        button.innerHTML = '🎤';
        button.title = '음성으로 입력';

        button.addEventListener('click', (e) => {
            e.preventDefault();

            if (isListening) {
                stopListening();
                button.classList.remove('listening');
            } else {
                startListening({
                    target: input,
                    language,
                    onStart: () => button.classList.add('listening'),
                    onEnd: () => button.classList.remove('listening')
                });
            }
        });

        if (position === 'inside') {
            // 입력 필드 내부 오른쪽에 배치
            const wrapper = input.parentElement;
            if (!wrapper.classList.contains('voice-input-wrapper')) {
                const newWrapper = document.createElement('div');
                newWrapper.className = 'voice-input-wrapper';
                input.parentNode.insertBefore(newWrapper, input);
                newWrapper.appendChild(input);
                newWrapper.appendChild(button);
            } else {
                wrapper.appendChild(button);
            }
        } else {
            // 입력 필드 다음에 배치
            input.parentNode.insertBefore(button, input.nextSibling);
        }

        return button;
    }

    /**
     * 자동으로 음성 버튼 추가
     */
    function autoSetup() {
        if (!isSupported) return;

        document.querySelectorAll('[data-voice-input]').forEach(input => {
            if (input.dataset.voiceSetup) return;

            addVoiceButton(input, {
                position: input.dataset.voicePosition || 'inside',
                language: input.dataset.voiceLang || 'ko-KR'
            });

            input.dataset.voiceSetup = 'true';
        });
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('voice-input-styles')) return;

        const style = document.createElement('style');
        style.id = 'voice-input-styles';
        style.textContent = `
            /* 음성 입력 버튼 */
            .voice-input-wrapper {
                position: relative;
                display: inline-block;
                width: 100%;
            }

            .voice-input-wrapper input,
            .voice-input-wrapper textarea {
                padding-right: 40px;
            }

            .voice-input-btn {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                opacity: 0.6;
                transition: all 0.2s;
                border-radius: 50%;
            }

            .voice-input-btn:hover {
                opacity: 1;
                background: rgba(102, 126, 234, 0.1);
            }

            .voice-input-btn.listening {
                opacity: 1;
                color: #dc3545;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { transform: translateY(-50%) scale(1); }
                50% { transform: translateY(-50%) scale(1.1); }
            }

            /* 듣기 표시기 */
            .voice-listening-indicator {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                border-radius: 30px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                z-index: 10001;
                opacity: 0;
                transition: all 0.3s ease;
            }

            .voice-listening-indicator.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }

            .voice-waves {
                display: flex;
                align-items: center;
                gap: 3px;
                height: 20px;
            }

            .voice-waves span {
                width: 3px;
                height: 100%;
                background: white;
                border-radius: 2px;
                animation: wave 0.5s ease-in-out infinite;
            }

            .voice-waves span:nth-child(1) { animation-delay: 0s; }
            .voice-waves span:nth-child(2) { animation-delay: 0.1s; }
            .voice-waves span:nth-child(3) { animation-delay: 0.2s; }
            .voice-waves span:nth-child(4) { animation-delay: 0.3s; }
            .voice-waves span:nth-child(5) { animation-delay: 0.4s; }

            @keyframes wave {
                0%, 100% { height: 4px; }
                50% { height: 20px; }
            }

            .voice-text {
                font-size: 14px;
                font-weight: 500;
            }

            /* 임시 결과 */
            .voice-interim-result {
                position: fixed;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                color: #666;
                font-style: italic;
                z-index: 10000;
                max-width: 100%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* 다크모드 */
            [data-theme="dark"] .voice-input-btn:hover {
                background: rgba(102, 126, 234, 0.2);
            }

            [data-theme="dark"] .voice-interim-result {
                background: #2d2d2d;
                border-color: #404040;
                color: #aaa;
            }
        `;
        document.head.appendChild(style);
    }

    // 초기화
    function init() {
        addStyles();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoSetup);
        } else {
            autoSetup();
        }

        // DOM 변경 감지
        const observer = new MutationObserver(autoSetup);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    init();

    // 전역 노출
    window.VoiceInput = {
        isSupported,
        isListening: () => isListening,
        start: startListening,
        stop: stopListening,
        addButton: addVoiceButton
    };
})();
