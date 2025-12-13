const CACHE_NAME = 'crm-cache-v10';
const urlsToCache = [
  '/',
  '/static/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png',
  'https://cdn.socket.io/4.5.4/socket.io.min.js'
];

// 설치 이벤트 - 캐시 생성
self.addEventListener('install', event => {
  console.log('[Service Worker v10] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker v10] 캐시 생성');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('[Service Worker v10] 캐시 생성 실패:', err);
      })
  );
  self.skipWaiting();
});

// 활성화 이벤트 - 오래된 캐시 삭제
self.addEventListener('activate', event => {
  console.log('[Service Worker] 활성화');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] 모든 클라이언트 즉시 제어');
      return self.clients.claim();
    })
  );
});

// Fetch 이벤트 - 네트워크 우선, App Shell만 캐싱
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 캐싱하지 않을 요청들
  if (
    event.request.url.includes('socket.io') ||  // Socket.IO
    event.request.url.includes('/api/') ||      // API 응답
    event.request.method !== 'GET'              // POST/PUT/DELETE 등
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 정적 리소스만 캐싱 (App Shell)
        const shouldCache = (
          response &&
          response.status === 200 &&
          (
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.json') ||
            url.pathname === '/' ||
            url.pathname.includes('/static/')
          )
        );

        if (shouldCache) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패시 캐시에서 가져오기 (정적 리소스만)
        return caches.match(event.request)
          .then(response => {
            if (response) {
              console.log('[Service Worker] 캐시에서 응답:', event.request.url);
              return response;
            }
            // 캐시에도 없으면 기본 오프라인 페이지
            return new Response('오프라인 상태입니다.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// 푸시 알림 수신
self.addEventListener('push', event => {
  console.log('[Service Worker] 푸시 알림 수신', event);

  let notificationData = {
    title: '업무 관리 시스템',
    body: '새로운 알림이 있습니다',
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    data: {}
  };

  // 푸시 데이터 파싱
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        vibrate: [200, 100, 200],
        tag: payload.data?.tag || 'notification',
        requireInteraction: payload.data?.requireInteraction || false,
        data: payload.data || {}
      };
    } catch (e) {
      console.error('[Service Worker] 푸시 데이터 파싱 실패:', e);
      notificationData.body = event.data.text();
    }
  }

  // 알림을 표시할지 확인 (모든 창이 포커스 아웃 상태인지 체크)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnowned: true }).then(clientList => {
      console.log('[Service Worker] 전체 클라이언트 수:', clientList.length);
      
      // 모든 클라이언트의 상태 로깅
      clientList.forEach((client, index) => {
        console.log(`[Service Worker] Client ${index}: URL=${client.url}, focused=${client.focused}, visibilityState=${client.visibilityState}`);
      });

      // 포커스된 창이 하나라도 있는지 확인
      let hasAnyFocusedWindow = false;

      for (let client of clientList) {
        if (client.focused) {
          hasAnyFocusedWindow = true;
          console.log('[Service Worker] ❌ 포커스된 창이 있어 알림 표시 안 함:', client.url);
          break;
        }
      }

      // 모든 클라이언트에 알림 센터 업데이트 메시지 전송
      clientList.forEach(client => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          title: notificationData.title,
          body: notificationData.body,
          icon: notificationData.data?.icon || '🔔',
          url: notificationData.data?.url || null,
          notificationType: notificationData.data?.type || 'info'
        });
      });

      // 모든 창이 포커스 아웃 상태일 때만 알림 표시
      if (!hasAnyFocusedWindow) {
        console.log('[Service Worker] ✅ 모든 창이 포커스 아웃 상태 - 알림 표시');
        return self.registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          vibrate: notificationData.vibrate,
          tag: notificationData.tag,
          requireInteraction: notificationData.requireInteraction,
          data: notificationData.data
        });
      } else {
        console.log('[Service Worker] ⚠️ 알림 표시 건너뜀 - 포커스된 창 존재');
      }
    })
  );
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] 알림 클릭됨', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // 알림 타입에 따라 이동할 URL 결정
  if (data.type === 'chat' && data.chatId) {
    url = `/chat/${data.chatId}`;
  } else if (data.type === 'reminder' && data.reminderId) {
    url = `/reminders?id=${data.reminderId}`;
  } else if (data.url) {
    url = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnowned: true }).then(clientList => {
      // 이미 열려있는 창이 있으면 포커스
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf(url) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message 리스너 - 클라이언트에서 강제 업데이트 명령 수신
self.addEventListener('message', event => {
  console.log('[Service Worker v10] Message 수신:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker v10] SKIP_WAITING 명령 수신 - 즉시 활성화');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker v10] CLEAR_CACHE 명령 수신 - 모든 캐시 삭제');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[Service Worker v10] 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[Service Worker v10] 모든 캐시 삭제 완료');
        // 클라이언트에게 완료 알림
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
        });
      })
    );
  }
});
