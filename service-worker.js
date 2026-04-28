// ============================================================
// Wings Fly Aviation Academy — Service Worker v2
// ✅ Enhanced: Offline API caching + Static asset caching
// ============================================================
const DEPLOY_ID = '20260428-offline-mode';
const CACHE_NAME = `wfa-v5-${DEPLOY_ID}`;
const API_CACHE = 'wfa-api-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/mobile.css',
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
  './js/core/inline-handlers.js',
  './js/core/app-updater.js',
  './js/core/mobile-nav.js',
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

// ── Install: Pre-cache static assets ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
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

// ── Activate: Clean old caches ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// ── Fetch: Smart caching strategy ──
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // ── Supabase API: Network first, cache fallback (offline support) ──
  if (url.hostname.includes('supabase')) {
    // Only cache GET requests (reads)
    if (e.request.method === 'GET') {
      e.respondWith(
        fetch(e.request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(API_CACHE).then(cache => cache.put(e.request, clone));
            }
            return res;
          })
          .catch(() => {
            // Offline: serve from cache
            return caches.match(e.request).then(cached => {
              if (cached) {
                console.info('[SW] Serving API from cache (offline):', url.pathname);
                return cached;
              }
              return new Response(JSON.stringify({ error: 'offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
          })
      );
    }
    // POST/PATCH/DELETE — let through (they'll fail offline, queue handles it)
    return;
  }

  // ── CDN resources (fonts, icons, etc.): Cache first ──
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && e.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // ── Static assets: Network first, cache fallback ──
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      }))
  );
});
