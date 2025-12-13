/**
 * 폼 유효성 검사 모듈
 * 실시간 유효성 검사 및 사용자 친화적 피드백
 */

(function() {
    'use strict';

    // 기본 유효성 검사 규칙
    const RULES = {
        required: {
            validate: (value) => value !== null && value !== undefined && String(value).trim() !== '',
            message: '필수 입력 항목입니다.'
        },
        email: {
            validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: '올바른 이메일 형식이 아닙니다.'
        },
        phone: {
            validate: (value) => !value || /^[\d\-+() ]{9,20}$/.test(value),
            message: '올바른 전화번호 형식이 아닙니다.'
        },
        minLength: {
            validate: (value, param) => !value || String(value).length >= param,
            message: (param) => `최소 ${param}자 이상 입력해주세요.`
        },
        maxLength: {
            validate: (value, param) => !value || String(value).length <= param,
            message: (param) => `최대 ${param}자까지 입력 가능합니다.`
        },
        min: {
            validate: (value, param) => !value || Number(value) >= param,
            message: (param) => `${param} 이상의 값을 입력해주세요.`
        },
        max: {
            validate: (value, param) => !value || Number(value) <= param,
            message: (param) => `${param} 이하의 값을 입력해주세요.`
        },
        pattern: {
            validate: (value, param) => !value || new RegExp(param).test(value),
            message: '입력 형식이 올바르지 않습니다.'
        },
        match: {
            validate: (value, param, form) => {
                const otherField = form.querySelector(`[name="${param}"]`);
                return !value || (otherField && value === otherField.value);
            },
            message: '값이 일치하지 않습니다.'
        },
        date: {
            validate: (value) => !value || !isNaN(Date.parse(value)),
            message: '올바른 날짜 형식이 아닙니다.'
        },
        futureDate: {
            validate: (value) => !value || new Date(value) > new Date(),
            message: '미래 날짜를 선택해주세요.'
        },
        pastDate: {
            validate: (value) => !value || new Date(value) < new Date(),
            message: '과거 날짜를 선택해주세요.'
        },
        url: {
            validate: (value) => {
                if (!value) return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: '올바른 URL 형식이 아닙니다.'
        },
        numeric: {
            validate: (value) => !value || /^\d+$/.test(value),
            message: '숫자만 입력 가능합니다.'
        },
        alpha: {
            validate: (value) => !value || /^[a-zA-Z가-힣]+$/.test(value),
            message: '문자만 입력 가능합니다.'
        },
        alphanumeric: {
            validate: (value) => !value || /^[a-zA-Z0-9가-힣]+$/.test(value),
            message: '문자와 숫자만 입력 가능합니다.'
        }
    };

    /**
     * 커스텀 규칙 추가
     */
    function addRule(name, validate, message) {
        RULES[name] = { validate, message };
    }

    /**
     * 단일 필드 유효성 검사
     */
    function validateField(field, rules, form) {
        const value = field.type === 'checkbox' ? field.checked : field.value;
        const errors = [];

        for (const [ruleName, ruleParam] of Object.entries(rules)) {
            const rule = RULES[ruleName];
            if (!rule) {
                console.warn(`[FormValidator] 알 수 없는 규칙: ${ruleName}`);
                continue;
            }

            const isValid = rule.validate(value, ruleParam, form);
            if (!isValid) {
                const message = typeof rule.message === 'function'
                    ? rule.message(ruleParam)
                    : rule.message;
                errors.push(message);
            }
        }

        return errors;
    }

    /**
     * 필드 에러 표시
     */
    function showFieldError(field, errors) {
        clearFieldError(field);

        if (errors.length === 0) {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            return;
        }

        field.classList.remove('is-valid');
        field.classList.add('is-invalid');

        // 에러 메시지 요소 생성
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = errors[0];  // 첫 번째 에러만 표시

        // 필드 다음에 삽입
        field.parentNode.insertBefore(errorDiv, field.nextSibling);

        // 접근성: aria-describedby 설정
        const errorId = `error-${field.name || field.id || Math.random().toString(36).substr(2, 9)}`;
        errorDiv.id = errorId;
        field.setAttribute('aria-describedby', errorId);
        field.setAttribute('aria-invalid', 'true');
    }

    /**
     * 필드 에러 제거
     */
    function clearFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        field.classList.remove('is-invalid', 'is-valid');
        field.removeAttribute('aria-describedby');
        field.removeAttribute('aria-invalid');
    }

    /**
     * 폼 전체 유효성 검사
     */
    function validateForm(form, schema) {
        const errors = {};
        let isValid = true;

        for (const [fieldName, rules] of Object.entries(schema)) {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!field) continue;

            const fieldErrors = validateField(field, rules, form);
            if (fieldErrors.length > 0) {
                errors[fieldName] = fieldErrors;
                isValid = false;
                showFieldError(field, fieldErrors);
            } else {
                showFieldError(field, []);
            }
        }

        return { isValid, errors };
    }

    /**
     * 실시간 유효성 검사 설정
     */
    function setupLiveValidation(form, schema, options = {}) {
        const {
            validateOnBlur = true,
            validateOnInput = true,
            debounceMs = 300
        } = options;

        let debounceTimer = null;

        for (const [fieldName, rules] of Object.entries(schema)) {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!field) continue;

            // blur 시 검사
            if (validateOnBlur) {
                field.addEventListener('blur', () => {
                    const errors = validateField(field, rules, form);
                    showFieldError(field, errors);
                });
            }

            // input 시 검사 (debounce 적용)
            if (validateOnInput) {
                field.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        const errors = validateField(field, rules, form);
                        showFieldError(field, errors);
                    }, debounceMs);
                });
            }
        }

        // 폼 제출 시 전체 검사
        form.addEventListener('submit', (e) => {
            const { isValid, errors } = validateForm(form, schema);

            if (!isValid) {
                e.preventDefault();

                // 첫 번째 에러 필드에 포커스
                const firstErrorField = Object.keys(errors)[0];
                const field = form.querySelector(`[name="${firstErrorField}"]`);
                if (field) {
                    field.focus();
                }

                // 토스트 알림
                if (window.toast) {
                    toast.warning('입력 내용을 확인해주세요.');
                }
            }
        });
    }

    /**
     * 데이터 속성 기반 자동 스키마 생성
     */
    function getSchemaFromDataAttributes(form) {
        const schema = {};

        form.querySelectorAll('[data-validate]').forEach(field => {
            const fieldName = field.name;
            if (!fieldName) return;

            const rules = {};
            const validateAttr = field.dataset.validate;

            // 파이프로 구분된 규칙 파싱
            validateAttr.split('|').forEach(rule => {
                const [ruleName, param] = rule.split(':');
                rules[ruleName] = param !== undefined ? (isNaN(param) ? param : Number(param)) : true;
            });

            schema[fieldName] = rules;
        });

        return schema;
    }

    /**
     * 자동 초기화 (data-validate 속성 사용)
     */
    function autoInit() {
        document.querySelectorAll('form[data-validate-auto]').forEach(form => {
            const schema = getSchemaFromDataAttributes(form);
            if (Object.keys(schema).length > 0) {
                setupLiveValidation(form, schema);
            }
        });
    }

    /**
     * 스타일 추가
     */
    function addStyles() {
        if (document.getElementById('form-validator-styles')) return;

        const style = document.createElement('style');
        style.id = 'form-validator-styles';
        style.textContent = `
            /* 유효성 검사 스타일 */
            .is-valid {
                border-color: #28a745 !important;
            }

            .is-invalid {
                border-color: #dc3545 !important;
            }

            .is-valid:focus {
                box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.2) !important;
            }

            .is-invalid:focus {
                box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.2) !important;
            }

            .field-error {
                color: #dc3545;
                font-size: 12px;
                margin-top: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .field-error::before {
                content: '⚠';
                font-size: 14px;
            }

            /* 필수 필드 표시 */
            label.required::after {
                content: ' *';
                color: #dc3545;
            }

            /* 문자 카운터 */
            .char-counter {
                font-size: 11px;
                color: #999;
                text-align: right;
                margin-top: 2px;
            }

            .char-counter.warning {
                color: #ffc107;
            }

            .char-counter.danger {
                color: #dc3545;
            }

            /* 비밀번호 강도 표시 */
            .password-strength {
                height: 4px;
                border-radius: 2px;
                margin-top: 6px;
                background: #e9ecef;
                overflow: hidden;
            }

            .password-strength-bar {
                height: 100%;
                transition: width 0.3s, background 0.3s;
            }

            .password-strength-bar.weak {
                width: 25%;
                background: #dc3545;
            }

            .password-strength-bar.fair {
                width: 50%;
                background: #ffc107;
            }

            .password-strength-bar.good {
                width: 75%;
                background: #17a2b8;
            }

            .password-strength-bar.strong {
                width: 100%;
                background: #28a745;
            }

            .password-strength-text {
                font-size: 11px;
                margin-top: 4px;
                color: #666;
            }

            /* 다크모드 */
            [data-theme="dark"] .field-error {
                color: #ff6b6b;
            }

            [data-theme="dark"] .is-valid {
                border-color: #51cf66 !important;
            }

            [data-theme="dark"] .is-invalid {
                border-color: #ff6b6b !important;
            }

            [data-theme="dark"] .char-counter {
                color: #888;
            }

            [data-theme="dark"] .password-strength {
                background: #333;
            }

            [data-theme="dark"] .password-strength-text {
                color: #aaa;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 문자 카운터 추가
     */
    function addCharCounter(field, maxLength) {
        const counter = document.createElement('div');
        counter.className = 'char-counter';

        const updateCounter = () => {
            const length = field.value.length;
            counter.textContent = `${length} / ${maxLength}`;

            counter.classList.remove('warning', 'danger');
            if (length >= maxLength * 0.9) {
                counter.classList.add('danger');
            } else if (length >= maxLength * 0.7) {
                counter.classList.add('warning');
            }
        };

        updateCounter();
        field.addEventListener('input', updateCounter);
        field.parentNode.appendChild(counter);

        return counter;
    }

    /**
     * 비밀번호 강도 표시 추가
     */
    function addPasswordStrength(field) {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="password-strength">
                <div class="password-strength-bar"></div>
            </div>
            <div class="password-strength-text"></div>
        `;

        const bar = container.querySelector('.password-strength-bar');
        const text = container.querySelector('.password-strength-text');

        const checkStrength = (password) => {
            let strength = 0;
            const checks = {
                length: password.length >= 8,
                lowercase: /[a-z]/.test(password),
                uppercase: /[A-Z]/.test(password),
                numbers: /\d/.test(password),
                special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
            };

            strength = Object.values(checks).filter(Boolean).length;

            bar.className = 'password-strength-bar';
            if (strength <= 1) {
                bar.classList.add('weak');
                text.textContent = '약함';
            } else if (strength === 2) {
                bar.classList.add('fair');
                text.textContent = '보통';
            } else if (strength === 3) {
                bar.classList.add('good');
                text.textContent = '좋음';
            } else {
                bar.classList.add('strong');
                text.textContent = '강함';
            }
        };

        field.addEventListener('input', () => {
            if (field.value) {
                container.style.display = 'block';
                checkStrength(field.value);
            } else {
                container.style.display = 'none';
            }
        });

        container.style.display = 'none';
        field.parentNode.appendChild(container);

        return container;
    }

    // 초기화
    function init() {
        addStyles();

        // DOM 로드 후 자동 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoInit);
        } else {
            autoInit();
        }
    }

    init();

    // 전역 노출
    window.FormValidator = {
        RULES,
        addRule,
        validateField,
        validateForm,
        setupLiveValidation,
        getSchemaFromDataAttributes,
        showFieldError,
        clearFieldError,
        addCharCounter,
        addPasswordStrength
    };
})();
