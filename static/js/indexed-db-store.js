/**
 * IndexedDB 기반 오프라인 데이터 저장소
 * 대용량 데이터 캐싱 및 오프라인 지원
 */

(function() {
    'use strict';

    const DB_NAME = 'crm_offline_db';
    const DB_VERSION = 1;

    // 스토어 정의
    const STORES = {
        CHATS: 'chats',
        MESSAGES: 'messages',
        REMINDERS: 'reminders',
        USERS: 'users',
        SETTINGS: 'settings',
        PENDING_ACTIONS: 'pending_actions'  // 오프라인 중 대기 중인 작업
    };

    let db = null;

    /**
     * 데이터베이스 열기/생성
     */
    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[IndexedDB] 열기 실패:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                console.log('[IndexedDB] 연결됨');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // 채팅방 스토어
                if (!database.objectStoreNames.contains(STORES.CHATS)) {
                    const chatStore = database.createObjectStore(STORES.CHATS, { keyPath: 'id' });
                    chatStore.createIndex('updated_at', 'updated_at', { unique: false });
                }

                // 메시지 스토어
                if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
                    const msgStore = database.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
                    msgStore.createIndex('chat_id', 'chat_id', { unique: false });
                    msgStore.createIndex('timestamp', 'timestamp', { unique: false });
                    msgStore.createIndex('chat_timestamp', ['chat_id', 'timestamp'], { unique: false });
                }

                // 리마인더 스토어
                if (!database.objectStoreNames.contains(STORES.REMINDERS)) {
                    const reminderStore = database.createObjectStore(STORES.REMINDERS, { keyPath: 'id' });
                    reminderStore.createIndex('reminder_date', 'reminder_date', { unique: false });
                    reminderStore.createIndex('completed', 'completed', { unique: false });
                }

                // 사용자 스토어
                if (!database.objectStoreNames.contains(STORES.USERS)) {
                    const userStore = database.createObjectStore(STORES.USERS, { keyPath: 'id' });
                    userStore.createIndex('username', 'username', { unique: true });
                }

                // 설정 스토어
                if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                    database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                }

                // 대기 중인 작업 스토어
                if (!database.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
                    const pendingStore = database.createObjectStore(STORES.PENDING_ACTIONS, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    pendingStore.createIndex('created_at', 'created_at', { unique: false });
                    pendingStore.createIndex('type', 'type', { unique: false });
                }

                console.log('[IndexedDB] 스키마 업그레이드 완료');
            };
        });
    }

    /**
     * 트랜잭션 헬퍼
     */
    async function getTransaction(storeNames, mode = 'readonly') {
        const database = await openDatabase();
        return database.transaction(storeNames, mode);
    }

    /**
     * 단일 항목 저장
     */
    async function put(storeName, data) {
        const tx = await getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 여러 항목 저장 (배치)
     */
    async function putMany(storeName, items) {
        const tx = await getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            let completed = 0;

            items.forEach(item => {
                const request = store.put(item);
                request.onsuccess = () => {
                    completed++;
                    if (completed === items.length) {
                        resolve(completed);
                    }
                };
                request.onerror = () => reject(request.error);
            });

            if (items.length === 0) {
                resolve(0);
            }
        });
    }

    /**
     * 단일 항목 가져오기
     */
    async function get(storeName, key) {
        const tx = await getTransaction(storeName);
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 모든 항목 가져오기
     */
    async function getAll(storeName) {
        const tx = await getTransaction(storeName);
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 인덱스로 조회
     */
    async function getByIndex(storeName, indexName, value) {
        const tx = await getTransaction(storeName);
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);

        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 범위 조회
     */
    async function getByRange(storeName, indexName, lowerBound, upperBound) {
        const tx = await getTransaction(storeName);
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const range = IDBKeyRange.bound(lowerBound, upperBound);

        return new Promise((resolve, reject) => {
            const request = index.getAll(range);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 항목 삭제
     */
    async function remove(storeName, key) {
        const tx = await getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 스토어 비우기
     */
    async function clear(storeName) {
        const tx = await getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 항목 수 가져오기
     */
    async function count(storeName) {
        const tx = await getTransaction(storeName);
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ========== 비즈니스 로직 헬퍼 ==========

    /**
     * 채팅 목록 캐시
     */
    async function cacheChats(chats) {
        const chatArray = Object.entries(chats).map(([id, chat]) => ({
            id,
            ...chat,
            cached_at: Date.now()
        }));

        await putMany(STORES.CHATS, chatArray);
        console.log(`[IndexedDB] ${chatArray.length}개 채팅방 캐시됨`);
    }

    /**
     * 캐시된 채팅 목록 가져오기
     */
    async function getCachedChats() {
        const chats = await getAll(STORES.CHATS);
        // 객체 형태로 변환
        const result = {};
        chats.forEach(chat => {
            result[chat.id] = chat;
        });
        return result;
    }

    /**
     * 메시지 캐시
     */
    async function cacheMessages(chatId, messages) {
        const msgArray = messages.map(msg => ({
            ...msg,
            chat_id: chatId,
            cached_at: Date.now()
        }));

        await putMany(STORES.MESSAGES, msgArray);
        console.log(`[IndexedDB] ${msgArray.length}개 메시지 캐시됨 (chat: ${chatId})`);
    }

    /**
     * 캐시된 메시지 가져오기
     */
    async function getCachedMessages(chatId, limit = 50) {
        const messages = await getByIndex(STORES.MESSAGES, 'chat_id', chatId);
        // 최신순 정렬 후 limit 적용
        return messages
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit)
            .reverse();
    }

    /**
     * 리마인더 캐시
     */
    async function cacheReminders(reminders) {
        const reminderArray = reminders.map(r => ({
            ...r,
            cached_at: Date.now()
        }));

        await putMany(STORES.REMINDERS, reminderArray);
        console.log(`[IndexedDB] ${reminderArray.length}개 리마인더 캐시됨`);
    }

    /**
     * 캐시된 리마인더 가져오기
     */
    async function getCachedReminders(options = {}) {
        let reminders = await getAll(STORES.REMINDERS);

        if (options.completed !== undefined) {
            reminders = reminders.filter(r => r.completed === options.completed);
        }

        if (options.date) {
            reminders = reminders.filter(r => r.reminder_date === options.date);
        }

        return reminders.sort((a, b) =>
            new Date(a.reminder_datetime) - new Date(b.reminder_datetime)
        );
    }

    /**
     * 오프라인 작업 추가
     */
    async function addPendingAction(action) {
        const pendingAction = {
            ...action,
            created_at: Date.now(),
            status: 'pending'
        };

        const id = await put(STORES.PENDING_ACTIONS, pendingAction);
        console.log('[IndexedDB] 대기 작업 추가:', action.type);
        return id;
    }

    /**
     * 대기 중인 작업 가져오기
     */
    async function getPendingActions() {
        return await getAll(STORES.PENDING_ACTIONS);
    }

    /**
     * 대기 작업 처리 완료
     */
    async function completePendingAction(id) {
        await remove(STORES.PENDING_ACTIONS, id);
    }

    /**
     * 대기 작업 동기화
     */
    async function syncPendingActions() {
        if (!navigator.onLine) {
            console.log('[IndexedDB] 오프라인 - 동기화 스킵');
            return;
        }

        const actions = await getPendingActions();
        console.log(`[IndexedDB] ${actions.length}개 대기 작업 동기화 시작`);

        for (const action of actions) {
            try {
                await executeAction(action);
                await completePendingAction(action.id);
                console.log('[IndexedDB] 작업 완료:', action.type);
            } catch (error) {
                console.error('[IndexedDB] 작업 실패:', action.type, error);
                // 실패한 작업은 남겨둠
            }
        }
    }

    /**
     * 대기 작업 실행
     */
    async function executeAction(action) {
        const { type, data } = action;

        switch (type) {
            case 'SEND_MESSAGE':
                await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                break;

            case 'UPDATE_REMINDER':
                await fetch(`/api/reminders/${data.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                break;

            case 'COMPLETE_REMINDER':
                await fetch(`/api/reminders/${data.id}/complete`, {
                    method: 'POST'
                });
                break;

            default:
                console.warn('[IndexedDB] 알 수 없는 작업 타입:', type);
        }
    }

    /**
     * 설정 저장
     */
    async function saveSetting(key, value) {
        await put(STORES.SETTINGS, { key, value, updated_at: Date.now() });
    }

    /**
     * 설정 가져오기
     */
    async function getSetting(key, defaultValue = null) {
        const setting = await get(STORES.SETTINGS, key);
        return setting ? setting.value : defaultValue;
    }

    /**
     * 캐시 크기 계산 (대략적)
     */
    async function getCacheSize() {
        const counts = {};
        for (const storeName of Object.values(STORES)) {
            counts[storeName] = await count(storeName);
        }
        return counts;
    }

    /**
     * 오래된 캐시 정리
     */
    async function pruneOldCache(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7일
        const cutoff = Date.now() - maxAge;

        for (const storeName of [STORES.CHATS, STORES.MESSAGES, STORES.REMINDERS]) {
            const tx = await getTransaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.cached_at && cursor.value.cached_at < cutoff) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        }

        console.log('[IndexedDB] 오래된 캐시 정리 완료');
    }

    /**
     * 데이터베이스 삭제
     */
    function deleteDatabase() {
        return new Promise((resolve, reject) => {
            if (db) {
                db.close();
                db = null;
            }

            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => {
                console.log('[IndexedDB] 데이터베이스 삭제됨');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 온라인 복귀 시 자동 동기화
    window.addEventListener('online', () => {
        setTimeout(syncPendingActions, 1000);
    });

    // 초기화
    openDatabase().catch(err => {
        console.error('[IndexedDB] 초기화 실패:', err);
    });

    // 전역 노출
    window.OfflineStore = {
        STORES,
        // 기본 CRUD
        put,
        putMany,
        get,
        getAll,
        getByIndex,
        getByRange,
        remove,
        clear,
        count,
        // 비즈니스 로직
        cacheChats,
        getCachedChats,
        cacheMessages,
        getCachedMessages,
        cacheReminders,
        getCachedReminders,
        addPendingAction,
        getPendingActions,
        syncPendingActions,
        saveSetting,
        getSetting,
        // 관리
        getCacheSize,
        pruneOldCache,
        deleteDatabase
    };
})();
