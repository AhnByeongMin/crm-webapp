const CACHE_NAME = 'crm-cache-v1';
const urlsToCache = [
  '/',
  '/static/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png',
  'https://cdn.socket.io/4.5.4/socket.io.min.js'
];

// 설치 이벤트 - 캐시 생성
self.addEventListener('install', event => {
  console.log('[Service Worker] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 캐시 생성');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('[Service Worker] 캐시 생성 실패:', err);
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
    })
  );
  return self.clients.claim();
});

// Fetch 이벤트 - 네트워크 우선, 실패시 캐시 사용
self.addEventListener('fetch', event => {
  // Socket.IO 요청은 캐싱하지 않음
  if (event.request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 유효한 응답인 경우 캐시에 저장
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패시 캐시에서 가져오기
        return caches.match(event.request)
          .then(response => {
            if (response) {
              console.log('[Service Worker] 캐시에서 응답:', event.request.url);
              return response;
            }
            // 캐시에도 없으면 기본 오프라인 페이지 표시 (선택사항)
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

// 푸시 알림 수신 (향후 확장 가능)
self.addEventListener('push', event => {
  console.log('[Service Worker] 푸시 알림 수신');
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다',
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('업무 관리 시스템', options)
  );
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] 알림 클릭됨');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
