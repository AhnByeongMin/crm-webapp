const CACHE_NAME = 'crm-cache-v11';
const NETWORK_TIMEOUT = 5000; // 5초 타임아웃

// 캐시할 정적 리소스
const STATIC_CACHE = [
  '/static/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/offline.html',
  'https://cdn.socket.io/4.5.4/socket.io.min.js'
];

// 캐시할 HTML 페이지 (App Shell)
const HTML_CACHE = [
  '/',
  '/tasks',
  '/chats',
  '/reminders',
  '/promotions',
  '/mypage'
];

// 설치 이벤트 - 캐시 생성
self.addEventListener('install', event => {
  console.log('[Service Worker v11] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker v11] 캐시 생성');
        // 정적 리소스 먼저 캐싱 (실패해도 계속 진행)
        return cache.addAll(STATIC_CACHE)
          .then(() => {
            // HTML 페이지는 개별적으로 캐싱 (일부 실패해도 OK)
            return Promise.allSettled(
              HTML_CACHE.map(url =>
                fetch(url).then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                })
              )
            );
          });
      })
      .catch(err => {
        console.log('[Service Worker v11] 캐시 생성 실패:', err);
      })
  );
  self.skipWaiting();
});

// 활성화 이벤트 - 오래된 캐시 삭제
self.addEventListener('activate', event => {
  console.log('[Service Worker v11] 활성화');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker v11] 오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker v11] 모든 클라이언트 즉시 제어');
      return self.clients.claim();
    })
  );
});

// 네트워크 요청 with 타임아웃
function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeout);

    fetch(request)
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// HTML 페이지인지 확인
function isHTMLRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';

  // Accept 헤더에 text/html이 있거나, 경로가 HTML 페이지인 경우
  return accept.includes('text/html') ||
         HTML_CACHE.includes(url.pathname) ||
         url.pathname.startsWith('/chat/') ||
         url.pathname === '/admin' ||
         url.pathname === '/login';
}

// 정적 리소스인지 확인
function isStaticResource(url) {
  return url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.ico') ||
         url.pathname.endsWith('.json') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.includes('/static/');
}

// Fetch 이벤트 - 네트워크 우선 + 타임아웃 + 캐시 폴백
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 캐싱하지 않을 요청들 (바로 네트워크로)
  if (
    event.request.url.includes('socket.io') ||  // Socket.IO
    event.request.url.includes('/api/') ||      // API 응답
    event.request.method !== 'GET'              // POST/PUT/DELETE 등
  ) {
    return;
  }

  // HTML 페이지 요청
  if (isHTMLRequest(event.request)) {
    event.respondWith(
      fetchWithTimeout(event.request, NETWORK_TIMEOUT)
        .then(response => {
          // 성공하면 캐시에 저장
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // 네트워크 실패 또는 타임아웃 시 캐시 확인
          console.log('[Service Worker v11] 네트워크 실패, 캐시 확인:', event.request.url);

          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            console.log('[Service Worker v11] 캐시에서 응답:', event.request.url);
            return cachedResponse;
          }

          // 캐시에도 없으면 오프라인 페이지
          const offlinePage = await caches.match('/static/offline.html');
          if (offlinePage) {
            return offlinePage;
          }

          // 오프라인 페이지도 없으면 기본 응답
          return new Response(getOfflineHTML(), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html; charset=utf-8'
            })
          });
        })
    );
    return;
  }

  // 정적 리소스 요청
  if (isStaticResource(url)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // 캐시에 있으면 바로 반환하면서 백그라운드에서 업데이트
          if (cachedResponse) {
            // 백그라운드에서 네트워크 업데이트 (stale-while-revalidate)
            fetch(event.request).then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, response);
                });
              }
            }).catch(() => {});

            return cachedResponse;
          }

          // 캐시에 없으면 네트워크에서 가져와서 캐싱
          return fetch(event.request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // 기타 요청은 네트워크 우선
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// 인라인 오프라인 HTML (캐시가 완전히 비어있을 때 폴백)
function getOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>연결 끊김 - 하루CRM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
    .retry-info {
      margin-top: 20px;
      font-size: 14px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>인터넷 연결 끊김</h1>
    <p>네트워크 연결을 확인해주세요.<br>연결이 복구되면 자동으로 다시 시도합니다.</p>
    <button onclick="location.reload()">다시 시도</button>
    <div class="retry-info">WiFi 또는 모바일 데이터 연결을 확인하세요</div>
  </div>
  <script>
    // 온라인 상태가 되면 자동 새로고침
    window.addEventListener('online', () => {
      location.reload();
    });
  </script>
</body>
</html>`;
}

// 푸시 알림 수신
self.addEventListener('push', event => {
  console.log('[Service Worker v11] 푸시 알림 수신', event);

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
      console.error('[Service Worker v11] 푸시 데이터 파싱 실패:', e);
      notificationData.body = event.data.text();
    }
  }

  // 알림을 표시할지 확인 (모든 창이 포커스 아웃 상태인지 체크)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnowned: true }).then(clientList => {
      console.log('[Service Worker v11] 전체 클라이언트 수:', clientList.length);

      // 포커스된 창이 하나라도 있는지 확인
      let hasAnyFocusedWindow = false;

      for (let client of clientList) {
        if (client.focused) {
          hasAnyFocusedWindow = true;
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
        return self.registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          vibrate: notificationData.vibrate,
          tag: notificationData.tag,
          requireInteraction: notificationData.requireInteraction,
          data: notificationData.data
        });
      }
    })
  );
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker v11] 알림 클릭됨', event.notification);
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
  console.log('[Service Worker v11] Message 수신:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker v11] SKIP_WAITING 명령 수신 - 즉시 활성화');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker v11] CLEAR_CACHE 명령 수신 - 모든 캐시 삭제');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[Service Worker v11] 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[Service Worker v11] 모든 캐시 삭제 완료');
        // 클라이언트에게 완료 알림
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
        });
      })
    );
  }
});
