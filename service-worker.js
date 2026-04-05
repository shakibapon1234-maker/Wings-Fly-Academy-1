// ================================================================
// WINGS FLY AVIATION ACADEMY - PWA SERVICE WORKER
// Offline support: app files cache করে রাখে
// Version বাড়ালে নতুন files আবার download হবে
// ================================================================

const CACHE_NAME = 'wingsfly-cache-v8'; // ✅ v8: Hide Person/Counterparty field for Income/Expense by default

// এই files গুলো offline-এও কাজ করবে
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './supabase-sync-SMART-V37.js',  // ✅ V37 filename updated
  './supabase-config.js',
  './styles.css',
  './manifest.json',
  // NOTE: CDN URLs (Bootstrap, Font Awesome, Chart.js etc.) are intentionally
  // excluded here because they are loaded via <script>/<link> tags in index.html
  // and caching them via fetch() causes CSP violations on the deployed site.
];

// ── Install: সব file cache করো ──
self.addEventListener('install', function (event) {
  console.log('[SW] Installing Wings Fly Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] Caching app files...');
      // প্রতিটা file আলাদাভাবে cache করি, একটা fail করলে বাকিগুলো থাকবে
      return Promise.allSettled(
        FILES_TO_CACHE.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    }).then(function () {
      console.log('[SW] ✅ Installation complete');
      return self.skipWaiting(); // নতুন SW সাথে সাথে active হবে
    })
  );
});

// ── Activate: পুরনো cache মুছো ──
self.addEventListener('activate', function (event) {
  console.log('[SW] Activating new Service Worker...');
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      console.log('[SW] ✅ Activation complete');
      return self.clients.claim();
    })
  );
});

// ── Fetch: Network first, Cache fallback ──
// Internet থাকলে নতুন version নাও, না থাকলে cache থেকে দাও
self.addEventListener('fetch', function (event) {
  // POST request cache করা যায় না
  if (event.request.method !== 'GET') return;

  // Supabase API calls cache করব না (real-time data)
  const url = event.request.url;
  if (url.includes('supabase.co') || url.includes('supabase.io')) {
    return; // Supabase সরাসরি network থেকে নাও
  }

  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        // Network থেকে পেলে cache-ও update করো
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function () {
        // Network নেই — cache থেকে দাও
        return caches.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', event.request.url);
            return cachedResponse;
          }
          // Cache-ও নেই — offline page দেখাও
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ── Background Sync: Internet আসলে Supabase sync করো ──
self.addEventListener('sync', function (event) {
  if (event.tag === 'wingsfly-sync') {
    console.log('[SW] Background sync triggered');
    // app.js-এর pushToCloud() call হবে যখন net আসবে
  }
});

console.log('[SW] Wings Fly Service Worker loaded ✅');
