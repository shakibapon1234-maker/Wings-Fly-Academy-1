// ============================================================
// Wings Fly Aviation Academy — Service Worker
// ============================================================
const CACHE_NAME = 'wfa-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './css/attendance.css',
  './css/exam.css',
  './css/print.css',
  './js/core/supabase-config.js',
  './js/core/supabase-sync.js',
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
  './assets/logo.jpg.jpeg',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
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
