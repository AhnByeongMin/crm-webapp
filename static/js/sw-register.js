/**
 * Service Worker 등록
 * 모든 페이지에서 가장 먼저 실행되어야 합니다
 */

if ('serviceWorker' in navigator) {
    // Service Worker 등록 - 루트 스코프로 등록하여 모든 페이지에서 푸시 알림 지원
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then(registration => {
            console.log('[SW Register] Service Worker 등록 성공:', registration.scope);

            // 등록 완료 이벤트 발생 (다른 스크립트들이 사용할 수 있도록)
            window.dispatchEvent(new CustomEvent('swRegistered', { detail: { registration } }));
        })
        .catch(error => {
            console.error('[SW Register] Service Worker 등록 실패:', error);
        });
} else {
    console.warn('[SW Register] 이 브라우저는 Service Worker를 지원하지 않습니다');
}
