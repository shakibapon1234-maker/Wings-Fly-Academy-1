// ============================================================
// Wings Fly Aviation Academy — Service Worker v2
// ✅ Enhanced: Offline API caching + Static asset caching
// ============================================================
// ✅ S-1 Fix: DEPLOY_ID synced with version.json deploy_id (was: 20260606-cert-login-fix)
// ✅ Bumped 2026-07-02: many core/module files changed since 20260626 without a cache-bust
// (app.js, supabase-sync.js, students.js, certificates.js, license.js, id-cards.js,
// result-sheet.js, institution-mode.js, backup-restore.js, utils.js). See AUDIT.md changelog.
// ✅ Bumped 2026-07-08: Activity Log rebuilt — extracted into new js/ui/activity-log.js
// (added to precache below), settings.js updated to delegate to it.
const DEPLOY_ID = '20260710-monitor-real-snapshots';

const CACHE_NAME = `wfa-v10-${DEPLOY_ID}`;
const API_CACHE = 'wfa-api-cache-v1';

// js/core/types.js is intentionally NOT listed (JSDoc only — never load in browser or SW cache).
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/login-critical.css',
  './css/mobile.css',
  './css/attendance.css',
  './css/exam.css',
  './css/cert-v2.css',
  './css/print.css',
  // ✅ BUG #1 Fix: ai-assistant.css exists in project — added back to cache
  './css/ai-assistant.css',
  './js/modules/ai-assistant.js',
  './js/core/supabase-secrets.stub.js',
  './js/core/session-store.js',
  './js/core/supabase-standalone-creds.js',
  './js/core/supabase-config.js',
  './js/core/supabase-sync.js',
  './js/core/sync-guard.js',
  './js/core/integrity-guard.js',
  './js/core/app.js',
  // ✅ Fix: license.js was missing from precache — without it, offline PWA
  // would silently SKIP the license check entirely (app.js guards the call
  // with `typeof LicenseEngine !== 'undefined'`), letting the app run
  // without a valid key whenever the file failed to load from network.
  './js/core/license-server-config.stub.js',
  './js/core/license.js',
  './js/core/license-manager.js',
  './js/core/clients-metadata.js',
  './js/core/utils.js',
  './js/core/lazy-libs.js',
  './js/core/lazy-modules.js',
  './js/core/inline-handlers.js',
  './js/core/i18n.js',
  // BUG-S5 fix: language.js and translations-en.js were missing from SW cache
  './js/core/language.js',
  './js/core/translations-en.js',
  './js/core/mobile-nav.js',
  './js/ui/dashboard.js',
  './js/ui/login.js',
  './js/ui/activity-log.js',
  './js/ui/settings.js',
  './js/ui/settings-student-portal.js',
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
  './js/core/admin-panel.js',
  // ✅ Bug Fix: Missing critical files added to SW cache
  './js/core/secure-storage.js',
  './js/core/auto-update.js',
  './js/core/settings-diagnostics.js',
  './js/core/push-notifications.js',
  './js/core/offline-mode.js',
  './js/core/loading-state.js',
  './js/core/system-diagnostics.js',
  // voice-assistant.js: NOT precached — lazy-loaded after login (see app.js) to avoid OOM on low-memory devices
  './js/modules/command-palette.js',
  './js/modules/face-id.js',
  './js/modules/pattern-lock.js',
  './assets/logo.jpg',
  // ✅ Fix S-2: logo.webp and logo-80.webp added to precache — index.html preloads logo.webp
  // as fetchpriority="high" LCP image; without this it fails offline on the login screen.
  './assets/logo.webp',
  './assets/logo-80.webp',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './migrate.html',
  './admin.html',
  './certificate.html',
  './exam.html',
  './visitor-form.html',
  './idb-cleaner.html',
  './student-portal.html',
  './css/student-portal.css',
  './js/core/student-auth.js',
  './js/ui/student-dashboard.js',
  './js/core/institution-mode.js',
  './js/core/school-engine.js',
  './js/core/settings-institution.js',
  './js/core/payment-engine.js',
  './js/core/routine-engine.js',
  './js/core/sms-engine.js',
  './js/modules/school-classes.js',
  './js/modules/subject-marks.js',
  './js/modules/result-sheet.js',
  './js/modules/payment-requests.js',
  './js/modules/routine-builder.js',
  // ✅ Fix #5: version.json intentionally NOT pre-cached.
  // auto-update.js fetches it with cache:'no-store'; SW fetch handler is 'network first'
  // so a cached copy would never be served offline anyway. Removed to avoid confusion.
  // Vendor libs (offline CDN fallback)
  './js/lib/chart.umd.min.js',
  './js/lib/xlsx.full.min.js',
  './js/lib/supabase.min.js',
  './js/lib/qrcode.min.js',
  './js/lib/flatpickr.min.js',
  './js/lib/html2canvas.min.js',
  './js/lib/jspdf.umd.min.js',
  './css/lib/font-awesome.min.css',
  './css/lib/flatpickr-dark.css',
  './css/webfonts/fa-solid-900.woff2',
  './css/webfonts/fa-regular-400.woff2',
  './css/webfonts/fa-brands-400.woff2',
  // BUG-07 Fix: face-api.min.js (~1.3MB) ও face-api model files (~12MB) precache-এ রাখা হচ্ছে না।
  // কারণ: SW install-এ এত বড় file fetch করলে slow network-এ install fail হয়,
  // ফলে পুরো PWA offline কাজ করে না।
  // Solution: এই files fetch handler-এ lazy cache হবে — প্রথমবার Face ID use করলে
  // automatically cache হয়ে যাবে। Offline mode-এ Face ID ছাড়া বাকি সব কাজ করবে।
];

// certificate.html PDF export (local path with CDN fallback in HTML)
const CDN_CERT_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  // Bug #6 Fix: Font Awesome CDN webfonts — pre-cached so offline works
  // even when local css/lib/font-awesome.min.css fails & browser falls back to CDN.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2',
];

// ── Install: Pre-cache static assets ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const allUrls = [...STATIC_ASSETS, ...CDN_CERT_LIBS];
      return Promise.allSettled(
        allUrls.map(url =>
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
    // Exam/settings must always be fresh — never serve stale cached questions or results
    const noCachePaths = ['/rest/v1/settings', '/rest/v1/exams', '/rest/v1/exam_reports'];
    if (e.request.method === 'GET' && noCachePaths.some(p => url.pathname.startsWith(p))) {
      e.respondWith(fetch(e.request));
      return;
    }
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
