/**
 * Service Worker 버전 기반 자동 업데이트 시스템
 * - 서버 버전 체크
 * - 로컬스토리지 버전 관리
 * - 캐시 강제 초기화
 * - 즉시 활성화
 */

const SW_VERSION_KEY = 'crm_sw_version';
const SW_LAST_CHECK = 'crm_sw_last_check';
const CHECK_INTERVAL = 60000; // 60초마다 버전 체크 (트래픽 최적화)

class ServiceWorkerUpdater {
  constructor() {
    this.currentVersion = null;
    this.serverVersion = null;
    this.isUpdating = false;
  }

  async init() {
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Updater] Service Worker 미지원 브라우저');
      return;
    }

    console.log('[SW Updater] 초기화 중...');

    // 로컬 버전 로드
    this.currentVersion = localStorage.getItem(SW_VERSION_KEY);
    console.log('[SW Updater] 현재 로컬 버전:', this.currentVersion);

    // 서버 버전 확인
    await this.checkServerVersion();

    // Service Worker Ready 대기
    navigator.serviceWorker.ready.then(registration => {
      console.log('[SW Updater] Service Worker 준비 완료');

      // 즉시 업데이트 체크
      registration.update();

      // 대기 중인 워커가 있으면 즉시 활성화
      if (registration.waiting) {
        console.log('[SW Updater] 대기 중인 워커 발견 - 즉시 활성화');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 업데이트 감지 리스너
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[SW Updater] 새 Service Worker 설치 중...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('[SW Updater] 새 버전 설치 완료 - 즉시 활성화');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
              console.log('[SW Updater] 첫 설치 완료');
            }
          }
        });
      });

      // 주기적 버전 체크 (60초마다)
      setInterval(() => this.checkServerVersion(), CHECK_INTERVAL);
    });

    // Controller 변경 감지 (업데이트 완료)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        console.log('[SW Updater] Controller 변경 감지 - 페이지 새로고침');
        refreshing = true;
        window.location.reload();
      }
    });

    // Service Worker 메시지 수신
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'CACHE_CLEARED') {
        console.log('[SW Updater] 캐시 삭제 완료 알림 수신');
      }
    });
  }

  async checkServerVersion() {
    try {
      const response = await fetch('/api/sw-version', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) {
        console.error('[SW Updater] 서버 버전 조회 실패:', response.status);
        return;
      }

      const versionInfo = await response.json();
      this.serverVersion = versionInfo.version;

      console.log('[SW Updater] 서버 버전:', this.serverVersion);
      console.log('[SW Updater] 로컬 버전:', this.currentVersion);

      // 버전 불일치 = 업데이트 필요
      if (this.serverVersion !== this.currentVersion) {
        console.log('[SW Updater] ⚠️ 버전 불일치 감지! 강제 업데이트 시작...');
        console.log(`[SW Updater] ${this.currentVersion} → ${this.serverVersion}`);
        await this.forceUpdate();
      } else {
        console.log('[SW Updater] ✓ 버전 일치 - 최신 상태');
      }

      // 마지막 체크 시간 저장
      localStorage.setItem(SW_LAST_CHECK, Date.now().toString());

    } catch (error) {
      console.error('[SW Updater] 버전 체크 중 오류:', error);
    }
  }

  async forceUpdate() {
    if (this.isUpdating) {
      console.log('[SW Updater] 이미 업데이트 진행 중...');
      return;
    }

    this.isUpdating = true;

    try {
      console.log('[SW Updater] 🔥 강제 업데이트 시작');

      // 1단계: 모든 Service Worker 등록 해제
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`[SW Updater] Service Worker ${registrations.length}개 발견`);

      for (let registration of registrations) {
        console.log('[SW Updater] Service Worker 등록 해제:', registration.scope);
        await registration.unregister();
      }

      // 2단계: 모든 캐시 삭제
      const cacheNames = await caches.keys();
      console.log(`[SW Updater] 캐시 ${cacheNames.length}개 발견`);

      for (let cacheName of cacheNames) {
        console.log('[SW Updater] 캐시 삭제:', cacheName);
        await caches.delete(cacheName);
      }

      // 3단계: 로컬 스토리지 버전 업데이트
      localStorage.setItem(SW_VERSION_KEY, this.serverVersion);
      console.log('[SW Updater] 로컬 버전 업데이트:', this.serverVersion);

      // 4단계: Service Worker 재등록
      console.log('[SW Updater] Service Worker 재등록 중...');
      const newRegistration = await navigator.serviceWorker.register('/static/service-worker.js');
      console.log('[SW Updater] Service Worker 재등록 완료:', newRegistration.scope);

      // 5단계: 새 SW가 활성화될 때까지 대기
      await navigator.serviceWorker.ready;
      console.log('[SW Updater] Service Worker 활성화 완료');

      // 6단계: 페이지 새로고침
      console.log('[SW Updater] ✅ 강제 업데이트 완료 - 페이지 새로고침');
      setTimeout(() => {
        window.location.reload(true);
      }, 500);

    } catch (error) {
      console.error('[SW Updater] 강제 업데이트 실패:', error);
      this.isUpdating = false;
    }
  }

  async clearAllCaches() {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[SW Updater] 모든 캐시 삭제 완료');
    } catch (error) {
      console.error('[SW Updater] 캐시 삭제 실패:', error);
    }
  }
}

// 자동 초기화
if ('serviceWorker' in navigator) {
  const updater = new ServiceWorkerUpdater();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updater.init());
  } else {
    updater.init();
  }

  // 전역 접근을 위해 window에 추가
  window.swUpdater = updater;
}
