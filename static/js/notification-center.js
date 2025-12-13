/**
 * 실시간 알림 센터
 * 인앱 알림을 수집하고 관리하는 드롭다운 패널
 */

class NotificationCenter {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 50;
        this.unreadCount = 0;
        this.isOpen = false;
        this.storageKey = 'crm_notifications';
        this.container = null;
        this.bell = null;
        this.panel = null;

        this.init();
    }

    init() {
        // 저장된 알림 불러오기
        this.loadFromStorage();

        // UI 생성
        this.createUI();

        // 이벤트 리스너
        this.bindEvents();

        // Socket.IO 알림 수신
        this.setupSocketListener();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.notifications = data.notifications || [];
                this.unreadCount = data.unreadCount || 0;

                // 오래된 알림 정리 (24시간 이상)
                const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
                this.notifications = this.notifications.filter(n => n.timestamp > dayAgo);
            }
        } catch (e) {
            console.error('알림 로드 실패:', e);
            this.notifications = [];
            this.unreadCount = 0;
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                notifications: this.notifications.slice(0, this.maxNotifications),
                unreadCount: this.unreadCount
            }));
        } catch (e) {
            console.error('알림 저장 실패:', e);
        }
    }

    createUI() {
        // 컨테이너 생성
        this.container = document.createElement('div');
        this.container.className = 'notification-center';
        this.container.innerHTML = `
            <button class="notification-bell" id="notificationBell" title="알림">
                <span class="bell-icon">🔔</span>
                <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
            </button>
            <div class="notification-panel" id="notificationPanel">
                <div class="notification-header">
                    <h3>알림</h3>
                    <div class="notification-actions">
                        <button class="notification-mark-all" id="markAllRead" title="모두 읽음 표시">✓</button>
                        <button class="notification-clear" id="clearNotifications" title="전체 삭제">🗑️</button>
                    </div>
                </div>
                <div class="notification-list" id="notificationList">
                    <div class="notification-empty">
                        <span class="empty-icon">🔕</span>
                        <p>알림이 없습니다</p>
                    </div>
                </div>
                <div class="notification-footer">
                    <button class="notification-settings-btn" id="notificationSettingsBtn">
                        ⚙️ 알림 설정
                    </button>
                </div>
            </div>
        `;

        // 헤더 설정 영역에 추가
        const headerSettings = document.querySelector('.header-settings');
        if (headerSettings) {
            headerSettings.insertBefore(this.container, headerSettings.firstChild);
        }

        this.bell = document.getElementById('notificationBell');
        this.panel = document.getElementById('notificationPanel');

        // 스타일 추가
        this.addStyles();

        // 초기 렌더링
        this.render();
    }

    bindEvents() {
        // 벨 클릭 - 패널 토글
        this.bell.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        // 패널 내부 클릭은 전파 중지
        this.panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 외부 클릭 시 닫기
        document.addEventListener('click', () => {
            if (this.isOpen) {
                this.closePanel();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closePanel();
            }
        });

        // 모두 읽음 버튼
        document.getElementById('markAllRead').addEventListener('click', () => {
            this.markAllAsRead();
        });

        // 전체 삭제 버튼
        document.getElementById('clearNotifications').addEventListener('click', () => {
            this.clearAll();
        });

        // 알림 설정 버튼
        document.getElementById('notificationSettingsBtn').addEventListener('click', () => {
            this.openSettings();
        });
    }

    setupSocketListener() {
        // Socket.IO가 있으면 실시간 알림 수신
        if (typeof io !== 'undefined') {
            // 기존 socket 재사용 또는 새로 생성
            const socket = window.notificationSocket || io();
            window.notificationSocket = socket;

            socket.on('notification', (data) => {
                this.addNotification(data);
            });

            // 채팅 메시지 알림
            socket.on('new_message', (data) => {
                // 현재 채팅방이 아닌 경우에만 알림
                const currentRoom = window.currentChatRoomId;
                if (!currentRoom || currentRoom !== data.room_id) {
                    this.addNotification({
                        type: 'chat',
                        title: '새 메시지',
                        message: `${data.sender}: ${data.preview || '새 메시지가 있습니다'}`,
                        link: `/chat/${data.room_id}`,
                        icon: '💬'
                    });
                }
            });

            // 예약 알림
            socket.on('reminder_alert', (data) => {
                this.addNotification({
                    type: 'reminder',
                    title: '예약 알림',
                    message: data.message || '예약이 있습니다',
                    link: '/reminders',
                    icon: '📅'
                });
            });
        }
    }

    addNotification(data) {
        const notification = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            type: data.type || 'info',
            title: data.title || '알림',
            message: data.message,
            link: data.link || null,
            icon: data.icon || this.getDefaultIcon(data.type),
            timestamp: Date.now(),
            read: false
        };

        // 맨 앞에 추가
        this.notifications.unshift(notification);
        this.unreadCount++;

        // 최대 개수 초과 시 삭제
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // 저장 및 렌더링
        this.saveToStorage();
        this.render();

        // 벨 애니메이션
        this.animateBell();

        // 토스트 표시 (패널이 닫혀있을 때)
        if (!this.isOpen && window.toast) {
            const toastOptions = {
                title: notification.title,
                duration: 5000,
                onClick: notification.link ? () => {
                    window.location.href = notification.link;
                } : null
            };

            switch (notification.type) {
                case 'success':
                    toast.success(notification.message, toastOptions);
                    break;
                case 'warning':
                    toast.warning(notification.message, toastOptions);
                    break;
                case 'error':
                    toast.error(notification.message, toastOptions);
                    break;
                default:
                    toast.info(notification.message, toastOptions);
            }
        }

        return notification;
    }

    getDefaultIcon(type) {
        const icons = {
            chat: '💬',
            reminder: '📅',
            task: '📋',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || '🔔';
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.saveToStorage();
            this.render();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveToStorage();
        this.render();

        if (window.toast) {
            toast.success('모든 알림을 읽음 표시했습니다', { duration: 2000 });
        }
    }

    removeNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index > -1) {
            const notification = this.notifications[index];
            if (!notification.read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
            this.notifications.splice(index, 1);
            this.saveToStorage();
            this.render();
        }
    }

    clearAll() {
        if (this.notifications.length === 0) return;

        this.notifications = [];
        this.unreadCount = 0;
        this.saveToStorage();
        this.render();

        if (window.toast) {
            toast.success('모든 알림을 삭제했습니다', { duration: 2000 });
        }
    }

    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        this.isOpen = true;
        this.panel.classList.add('open');
        this.bell.classList.add('active');
    }

    closePanel() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        this.bell.classList.remove('active');
    }

    animateBell() {
        this.bell.classList.add('shake');
        setTimeout(() => {
            this.bell.classList.remove('shake');
        }, 500);
    }

    openSettings() {
        // 마이페이지 알림 설정으로 이동
        window.location.href = '/mypage#notifications';
    }

    render() {
        // 배지 업데이트
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // 알림 목록 렌더링
        const list = document.getElementById('notificationList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-empty">
                    <span class="empty-icon">🔕</span>
                    <p>알림이 없습니다</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.notifications.map(n => `
            <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                <div class="notification-item-icon">${n.icon}</div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${this.escapeHtml(n.title)}</div>
                    <div class="notification-item-message">${this.escapeHtml(n.message)}</div>
                    <div class="notification-item-time">${this.formatTime(n.timestamp)}</div>
                </div>
                <button class="notification-item-close" data-id="${n.id}" title="삭제">×</button>
            </div>
        `).join('');

        // 알림 아이템 클릭 이벤트
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('notification-item-close')) return;

                const id = item.dataset.id;
                const notification = this.notifications.find(n => n.id === id);

                if (notification) {
                    this.markAsRead(id);
                    if (notification.link) {
                        window.location.href = notification.link;
                    }
                }
            });
        });

        // 삭제 버튼 클릭 이벤트
        list.querySelectorAll('.notification-item-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.removeNotification(id);
            });
        });
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        return `${days}일 전`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addStyles() {
        if (document.getElementById('notification-center-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-center-styles';
        style.textContent = `
            /* 알림 센터 컨테이너 */
            .notification-center {
                position: relative;
            }

            /* 알림 벨 버튼 */
            .notification-bell {
                background: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                position: relative;
                transition: all 0.3s;
            }

            .notification-bell:hover {
                background: #e8e8e8;
                transform: scale(1.05);
            }

            .notification-bell.active {
                background: #667eea;
                border-color: #667eea;
            }

            .notification-bell.active .bell-icon {
                filter: brightness(0) invert(1);
            }

            .bell-icon {
                font-size: 18px;
                line-height: 1;
            }

            /* 벨 흔들림 애니메이션 */
            .notification-bell.shake {
                animation: bellShake 0.5s ease;
            }

            @keyframes bellShake {
                0%, 100% { transform: rotate(0); }
                20% { transform: rotate(15deg); }
                40% { transform: rotate(-15deg); }
                60% { transform: rotate(10deg); }
                80% { transform: rotate(-10deg); }
            }

            /* 알림 배지 */
            .notification-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                background: #dc3545;
                color: white;
                font-size: 11px;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                animation: badgePop 0.3s ease;
            }

            @keyframes badgePop {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }

            /* 알림 패널 */
            .notification-panel {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                width: 360px;
                max-height: 480px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                z-index: 10001;
                display: none;
                flex-direction: column;
                overflow: hidden;
                transform: translateY(-10px);
                opacity: 0;
                transition: all 0.2s ease;
            }

            .notification-panel.open {
                display: flex;
                transform: translateY(0);
                opacity: 1;
            }

            /* 패널 헤더 */
            .notification-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border-bottom: 1px solid #eee;
            }

            .notification-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }

            .notification-actions {
                display: flex;
                gap: 8px;
            }

            .notification-mark-all,
            .notification-clear {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .notification-mark-all:hover,
            .notification-clear:hover {
                background: #f0f0f0;
            }

            /* 알림 목록 */
            .notification-list {
                flex: 1;
                overflow-y: auto;
                max-height: 360px;
            }

            /* 빈 상태 */
            .notification-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                color: #999;
            }

            .notification-empty .empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .notification-empty p {
                margin: 0;
                font-size: 14px;
            }

            /* 알림 아이템 */
            .notification-item {
                display: flex;
                align-items: flex-start;
                padding: 12px 16px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.2s;
                position: relative;
            }

            .notification-item:hover {
                background: #f8f9fa;
            }

            .notification-item.unread {
                background: #f0f4ff;
            }

            .notification-item.unread:hover {
                background: #e8edff;
            }

            .notification-item-icon {
                font-size: 20px;
                margin-right: 12px;
                flex-shrink: 0;
            }

            .notification-item-content {
                flex: 1;
                min-width: 0;
            }

            .notification-item-title {
                font-size: 14px;
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }

            .notification-item-message {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }

            .notification-item-time {
                font-size: 11px;
                color: #999;
                margin-top: 4px;
            }

            .notification-item-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                font-size: 18px;
                color: #999;
                cursor: pointer;
                padding: 4px;
                line-height: 1;
                border-radius: 4px;
                opacity: 0;
                transition: all 0.2s;
            }

            .notification-item:hover .notification-item-close {
                opacity: 1;
            }

            .notification-item-close:hover {
                background: #eee;
                color: #333;
            }

            /* 패널 푸터 */
            .notification-footer {
                padding: 12px 16px;
                border-top: 1px solid #eee;
                background: #fafafa;
            }

            .notification-settings-btn {
                width: 100%;
                background: none;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                color: #666;
                transition: all 0.2s;
            }

            .notification-settings-btn:hover {
                background: #667eea;
                border-color: #667eea;
                color: white;
            }

            /* 다크모드 */
            [data-theme="dark"] .notification-bell {
                background: #374151;
                border-color: #4b5563;
            }

            [data-theme="dark"] .notification-bell:hover {
                background: #4b5563;
            }

            [data-theme="dark"] .notification-panel {
                background: #1f2937;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            }

            [data-theme="dark"] .notification-header {
                border-color: #374151;
            }

            [data-theme="dark"] .notification-header h3 {
                color: #e5e7eb;
            }

            [data-theme="dark"] .notification-mark-all:hover,
            [data-theme="dark"] .notification-clear:hover {
                background: #374151;
            }

            [data-theme="dark"] .notification-item {
                border-color: #374151;
            }

            [data-theme="dark"] .notification-item:hover {
                background: #374151;
            }

            [data-theme="dark"] .notification-item.unread {
                background: #1e3a5f;
            }

            [data-theme="dark"] .notification-item.unread:hover {
                background: #234b73;
            }

            [data-theme="dark"] .notification-item-title {
                color: #e5e7eb;
            }

            [data-theme="dark"] .notification-item-message {
                color: #9ca3af;
            }

            [data-theme="dark"] .notification-item-time {
                color: #6b7280;
            }

            [data-theme="dark"] .notification-item-close {
                color: #6b7280;
            }

            [data-theme="dark"] .notification-item-close:hover {
                background: #4b5563;
                color: #e5e7eb;
            }

            [data-theme="dark"] .notification-footer {
                background: #111827;
                border-color: #374151;
            }

            [data-theme="dark"] .notification-settings-btn {
                border-color: #4b5563;
                color: #9ca3af;
            }

            [data-theme="dark"] .notification-settings-btn:hover {
                background: #667eea;
                border-color: #667eea;
                color: white;
            }

            [data-theme="dark"] .notification-empty {
                color: #6b7280;
            }

            /* 모바일 반응형 */
            @media (max-width: 480px) {
                .notification-panel {
                    position: fixed;
                    top: auto;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    width: 100%;
                    max-height: 70vh;
                    border-radius: 16px 16px 0 0;
                    transform: translateY(100%);
                }

                .notification-panel.open {
                    transform: translateY(0);
                }

                .notification-list {
                    max-height: calc(70vh - 130px);
                }
            }

            /* 애니메이션 모션 감소 설정 */
            @media (prefers-reduced-motion: reduce) {
                .notification-bell.shake {
                    animation: none;
                }

                .notification-badge {
                    animation: none;
                }

                .notification-panel {
                    transition: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 전역 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 페이지 제외
    if (window.location.pathname !== '/login' && window.location.pathname !== '/login/') {
        window.notificationCenter = new NotificationCenter();
    }
});

// 전역 알림 추가 함수
window.addNotification = function(data) {
    if (window.notificationCenter) {
        return window.notificationCenter.addNotification(data);
    }
};
