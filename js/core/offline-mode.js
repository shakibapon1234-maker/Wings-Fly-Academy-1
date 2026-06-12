// ============================================================
// Offline Mode Module — Service Worker Cache + IndexedDB Queue
// Wings Fly Aviation Academy
// ============================================================

const OfflineModeModule = (() => {
  // ✅ Fix #1 (2026-06): DB_NAME corrected to 'WingsAcademyDB' (matches supabase-sync.js / WFA_IDB).
  //   DB_VERSION bumped to 3 to match the main database version so both
  //   modules open the SAME database at the SAME version — no downgrade conflict.
  //   onupgradeneeded only creates the offline-specific stores if missing;
  //   it never touches the main 'tables' store owned by supabase-sync.js.
  const DB_NAME    = 'WingsAcademyDB';
  const DB_VERSION = 3;

  let db = null;
  let isOnline = navigator.onLine;


  // ── Initialize IndexedDB ──
  async function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        
        // Create object stores
        if (!database.objectStoreNames.contains('api-cache')) {
          database.createObjectStore('api-cache', { keyPath: 'url' });
        }
        if (!database.objectStoreNames.contains('offline-queue')) {
          database.createObjectStore('offline-queue', { keyPath: 'id', autoIncrement: true });
        }
        if (!database.objectStoreNames.contains('student-data')) {
          database.createObjectStore('student-data', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('attendance-data')) {
          database.createObjectStore('attendance-data', { keyPath: 'id' });
        }
      };
    });
  }

  // ── Enqueue an offline action ──
  async function enqueueAction(action, table, data) {
    try {
      if (!db) await initDB();

      const transaction = db.transaction(['offline-queue'], 'readwrite');
      const store = transaction.objectStore('offline-queue');
      
       const item = {
         action,           // 'INSERT', 'UPDATE', 'DELETE'
         table,            // table name
         data,             // data to sync
         timestamp: Date.now(),
         status: 'pending', // pending, synced, failed
         retries: 0        // CRITICAL FIX: Initialize retry counter
       };

      return new Promise((resolve, reject) => {
        const request = store.add(item);
        request.onsuccess = () => {
          console.log('[Offline] Action enqueued:', action, table);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });

    } catch (e) {
      console.error('[Offline] Failed to enqueue:', e);
      throw e;
    }
  }

  // ── Get all pending actions ──
  async function getPendingQueue() {
    try {
      if (!db) await initDB();

      const transaction = db.transaction(['offline-queue'], 'readonly');
      const store = transaction.objectStore('offline-queue');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

    } catch (e) {
      console.error('[Offline] Failed to get queue:', e);
      return [];
    }
  }

   // ── Sync pending actions with server ──
   async function syncQueue() {
     if (!isOnline) {
       if (window.__WFA_DEV__) console.log('[Offline] Still offline, sync skipped');
       return { synced: 0, failed: 0 };
     }

     try {
       const queue = await getPendingQueue();
       if (queue.length === 0) return { synced: 0, failed: 0 };

       if (window.__WFA_DEV__) console.log('[Offline] Syncing', queue.length, 'pending actions...');

       let synced = 0;
       let failed = 0;

       // CRITICAL FIX #3: Add retry counter and max retry limit
       // When network drops mid-sync, items won't be orphaned
       const MAX_RETRIES = 3;

       for (const item of queue) {
         try {
           // Check retry count before attempting
           const retries = item.retries || 0;
           if (retries >= MAX_RETRIES) {
             console.warn(`[Offline] Item ${item.id} exceeded max retries, marking as failed`);
             await markItemFailed(item.id);
             failed++;
             continue;
           }

           const success = await syncItem(item);
           if (success) {
             await markItemSynced(item.id);
             synced++;
           } else {
             // Increment retry counter on failure
             await incrementRetryCount(item.id);
             failed++;
           }
         } catch (e) {
           console.error('[Offline] Sync failed for item:', item.id, e);
           // Increment retry on exception too
           await incrementRetryCount(item.id);
           failed++;
         }
       }

       // Clean up synced items
       await cleanupSyncedQueue();
       
       // Clean up permanently failed items after max retries
       await cleanupFailedQueue();

      if (window.__WFA_DEV__) console.log('[Offline] Sync complete:', synced, 'synced,', failed, 'failed');
       
       if (typeof Utils !== 'undefined') {
         Utils.toast(`অফলাইন ডেটা সিঙ্ক হয়েছে: ${synced} successful, ${failed} failed`, 'success');
       }

       return { synced, failed };

     } catch (e) {
       console.error('[Offline] Sync queue failed:', e);
       return { synced: 0, failed: queue.length };
     }
   }

   // ── Increment retry counter for failed items ──
   async function incrementRetryCount(itemId) {
     try {
       if (!db) await initDB();
       const transaction = db.transaction(['offline-queue'], 'readwrite');
       const store = transaction.objectStore('offline-queue');
       
       return new Promise((resolve, reject) => {
         const getRequest = store.get(itemId);
         getRequest.onsuccess = () => {
           const item = getRequest.result;
           if (item) {
             item.retries = (item.retries || 0) + 1;
             item.lastRetry = Date.now();
             item.status = item.retries >= 3 ? 'failed' : 'pending';
             const putRequest = store.put(item);
             putRequest.onsuccess = () => resolve(true);
             putRequest.onerror = () => reject(putRequest.error);
           }
         };
       });
     } catch (e) {
       console.error('[Offline] Failed to increment retry:', e);
       return false;
     }
   }

   // ── Mark item as permanently failed ──
   async function markItemFailed(itemId) {
     try {
       if (!db) await initDB();
       const transaction = db.transaction(['offline-queue'], 'readwrite');
       const store = transaction.objectStore('offline-queue');
       
       return new Promise((resolve, reject) => {
         const getRequest = store.get(itemId);
         getRequest.onsuccess = () => {
           const item = getRequest.result;
           if (item) {
             item.status = 'failed';
             const putRequest = store.put(item);
             putRequest.onsuccess = () => resolve(true);
             putRequest.onerror = () => reject(putRequest.error);
           }
         };
       });
     } catch (e) {
       console.error('[Offline] Failed to mark item as failed:', e);
       return false;
     }
   }

   // ── Clean up permanently failed items ──
   async function cleanupFailedQueue() {
     try {
       if (!db) await initDB();
       const transaction = db.transaction(['offline-queue'], 'readwrite');
       const store = transaction.objectStore('offline-queue');
       const queue = await getPendingQueue();
       
       for (const item of queue) {
         if (item.status === 'failed' && item.retries >= 3) {
           store.delete(item.id);
           console.warn(`[Offline] Removed permanently failed item: ${item.id}`);
         }
       }
     } catch (e) {
       console.error('[Offline] Cleanup failed items failed:', e);
     }
   }

  // ── Sync individual item ──
  async function syncItem(item) {
    try {
      // Use real Supabase URL/Key from global config
      const _creds   = window.WFA_SUPABASE_SECRETS || {};
      const supaUrl  = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ? SUPABASE_URL : (_creds.url || '');
      const supaKey  = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) ? SUPABASE_ANON_KEY : (_creds.anonKey || _creds.anon_key || '');
      const endpoint = `${supaUrl}/rest/v1/${item.table}`;
      const authToken = localStorage.getItem('wfa_session_token') || supaKey;

      let method = 'POST';
      let body = item.data;

      if (item.action === 'UPDATE') {
        method = 'PATCH';
      } else if (item.action === 'DELETE') {
        method = 'DELETE';
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': supaKey,
          'Authorization': `Bearer ${authToken}`
        },
        body: method === 'DELETE' ? null : JSON.stringify(body)
      });

      return response.ok;

    } catch (e) {
      console.error('[Offline] Sync item error:', e);
      return false;
    }
  }

  // ── Mark item as synced ──
  async function markItemSynced(itemId) {
    try {
      if (!db) await initDB();

      const transaction = db.transaction(['offline-queue'], 'readwrite');
      const store = transaction.objectStore('offline-queue');

      return new Promise((resolve, reject) => {
        const getRequest = store.get(itemId);
        getRequest.onsuccess = () => {
          const item = getRequest.result;
          if (item) {
            item.status = 'synced';
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve(true);
            putRequest.onerror = () => reject(putRequest.error);
          }
        };
      });

    } catch (e) {
      console.error('[Offline] Failed to mark synced:', e);
      return false;
    }
  }

  // ── Clean up old synced items ──
  async function cleanupSyncedQueue() {
    try {
      if (!db) await initDB();

      const transaction = db.transaction(['offline-queue'], 'readwrite');
      const store = transaction.objectStore('offline-queue');
      const queue = await getPendingQueue();

      for (const item of queue) {
        if (item.status === 'synced') {
          store.delete(item.id);
        }
      }

    } catch (e) {
      console.error('[Offline] Cleanup failed:', e);
    }
  }

  // ── Cache API response ──
  async function cacheResponse(url, response) {
    try {
      if (!db) await initDB();

      const clone = response.clone();
      const data = await clone.text();

      const transaction = db.transaction(['api-cache'], 'readwrite');
      const store = transaction.objectStore('api-cache');

      store.put({
        url,
        data,
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type')
        },
        timestamp: Date.now()
      });

    } catch (e) {
      console.warn('[Offline] Cache response failed:', e);
    }
  }

  // ── Get cached response ──
  async function getCachedResponse(url) {
    try {
      if (!db) await initDB();

      const transaction = db.transaction(['api-cache'], 'readonly');
      const store = transaction.objectStore('api-cache');

      return new Promise((resolve, _reject) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const cached = request.result;
          if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            // Valid cache (less than 24 hours old)
            resolve(new Response(cached.data, {
              status: cached.status,
              headers: cached.headers
            }));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });

    } catch (e) {
      console.error('[Offline] Get cached response failed:', e);
      return null;
    }
  }

  // ── Initialize offline mode ──
  async function init() {
    try {
      // Initialize IndexedDB
      await initDB();
      if (window.__WFA_DEV__) console.log('[Offline] IndexedDB initialized');

      // Listen for online/offline events
      window.addEventListener('online', async () => {
        isOnline = true;
        if (window.__WFA_DEV__) console.log('[Offline] Back online, syncing...');
        if (typeof Utils !== 'undefined') {
          Utils.toast('ইন্টারনেট সংযোগ পুনরুদ্ধার হয়েছে', 'success');
        }
        await syncQueue();
      });

      window.addEventListener('offline', () => {
        isOnline = false;
        if (window.__WFA_DEV__) console.log('[Offline] Lost internet connection');
        if (typeof Utils !== 'undefined') {
          Utils.toast('অফলাইন মোডে কাজ করছি', 'warning');
        }
      });

      // ✅ FIXED: Service Worker registration moved to inline-handlers.js (single source of truth)

      // Auto-sync when coming online
      if (!isOnline && navigator.onLine) {
        setTimeout(() => syncQueue(), 2000);
      }

    } catch (e) {
      console.error('[Offline] Initialization failed:', e);
    }
  }

  // ── Get offline status ──
  function isOffline() {
    return !isOnline;
  }

  // ── Get queue status ──
  async function getQueueStatus() {
    try {
      const queue = await getPendingQueue();
      const pending = queue.filter(item => item.status === 'pending').length;
      const failed = queue.filter(item => item.status === 'failed').length;

      return {
        isOnline,
        queueLength: queue.length,
        pending,
        failed
      };
    } catch (e) {
      console.error('[Offline] Get status failed:', e);
      return { isOnline, queueLength: 0, pending: 0, failed: 0 };
    }
  }

  return {
    init,
    enqueueAction,
    syncQueue,
    getCachedResponse,
    cacheResponse,
    isOffline,
    getQueueStatus
  };
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OfflineModeModule.init());
} else {
  OfflineModeModule.init();
}

// Export
if (typeof window !== 'undefined') {
  window.OfflineModeModule = OfflineModeModule;
}
