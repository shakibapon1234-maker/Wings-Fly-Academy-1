// ============================================================
// Wings Fly Aviation Academy — Service Worker
// ============================================================
const CACHE_NAME = 'wfa-v1';

const STATIC_ASSETS = [
  '/',
  '/Wings-Fly-Academy/',
  '/Wings-Fly-Academy/index.html',
  '/Wings-Fly-Academy/css/main.css',
  '/Wings-Fly-Academy/css/attendance.css',
  '/Wings-Fly-Academy/css/print.css',
  '/Wings-Fly-Academy/js/core/supabase-config.js',
  '/Wings-Fly-Academy/js/core/supabase-sync.js',
  '/Wings-Fly-Academy/js/core/app.js',
  '/Wings-Fly-Academy/js/core/utils.js',
  '/Wings-Fly-Academy/js/ui/dashboard.js',
  '/Wings-Fly-Academy/js/ui/login.js',
  '/Wings-Fly-Academy/js/ui/settings.js',
  '/Wings-Fly-Academy/js/modules/students.js',
  '/Wings-Fly-Academy/js/modules/finance.js',
  '/Wings-Fly-Academy/js/modules/accounts.js',
  '/Wings-Fly-Academy/js/modules/loans.js',
  '/Wings-Fly-Academy/js/modules/exam.js',
  '/Wings-Fly-Academy/js/modules/attendance.js',
  '/Wings-Fly-Academy/js/modules/salary.js',
  '/Wings-Fly-Academy/js/modules/hr-staff.js',
  '/Wings-Fly-Academy/js/modules/visitors.js',
  '/Wings-Fly-Academy/js/modules/id-cards.js',
  '/Wings-Fly-Academy/js/modules/certificates.js',
  '/Wings-Fly-Academy/js/modules/notice-board.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first, fallback to cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
