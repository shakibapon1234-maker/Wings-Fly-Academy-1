// ============================================================
// Wings Fly Aviation Academy — Service Worker
// ✅ Fix: DEPLOY_ID forces SW replacement on every deploy
// ============================================================
const DEPLOY_ID = '20260422-bug-fixes-1to15';
const CACHE_NAME = `wfa-v4-${DEPLOY_ID}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/attendance.css',
  './css/exam.css',
  './css/cert-v2.css',
  './css/print.css',
  './css/ai-assistant.css',
  './js/core/supabase-config.js',
  './js/core/supabase-sync.js',
  './js/core/sync-guard.js',
  './js/core/integrity-guard.js',
  './js/core/app.js',
  './js/core/utils.js',
  './js/ui/dashboard.js',
  './js/ui/login.js',
  './js/ui/settings.js',
  './js/modules/students.js',
  './js/modules/finance.js',
  './js/modules/accounts.js',
  './js/modules/loans.js',
  './js/modules/exam.js',
  './js/modules/attendance.js',
  './js/modules/salary.js',
  './js/modules/hr-staff.js',
  './js/modules/visitors.js',
  './js/modules/id-cards.js',
  './js/modules/certificates.js',
  './js/modules/notice-board.js',
  './js/core/backup-restore.js',
  './js/modules/voice-assistant.js',
  './js/modules/command-palette.js',
  './js/modules/face-id.js',
  './js/modules/pattern-lock.js',
  './assets/logo.jpg',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './migrate.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll এর বদলে individual fetch — একটা fail করলে বাকিগুলো চলবে
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          fetch(url).then(res => {
            if (!res.ok) throw new Error(`${url}: ${res.status}`);
            return cache.put(url, res);
          }).catch(err => console.warn('[SW] Cache miss:', err.message))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Supabase API calls — always network, never cache
  if (e.request.url.includes('supabase.co')) {
    return; // browser default
  }
  // Static assets — Network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Successful network response → cache-এ update করো
        if (res.ok && e.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Fallback: index.html দাও (SPA navigation এর জন্য)
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      }))
  );
});
