// ============================================================
// Auto-Update Module — Remote URL Loading + Version Check
// Wings Fly Aviation Academy
// ============================================================

const AutoUpdateModule = (() => {
  const VERSION_FILE_URL = 'https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/version.json'; // GitHub Pages hosted version
  const LOCAL_VERSION_KEY = 'wfa_app_version';
  const LOCAL_VERSION_FALLBACK = '4.9.17';
  const LAST_CHECK_KEY = 'wfa_last_update_check';
  const CHECK_INTERVAL_HOURS = 24; // Check once per day to avoid 503 spam

  // ── Detect dev/local environment — skip update check to avoid CSP noise ──
  function _isDevEnvironment() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h === '';
  }

  // ── Check if new version available ──
  async function checkForUpdate() {
    try {
      // ✅ Fix: Skip entirely on localhost/dev — avoid CSP violation noise in console
      if (_isDevEnvironment()) {
        return { available: false, reason: 'dev-environment' };
      }

      if (!navigator.onLine) return { available: false, reason: 'offline' };

      const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
      const now = Date.now();
      const hoursSinceCheck = (now - lastCheck) / (1000 * 60 * 60);

      if (lastCheck && hoursSinceCheck < CHECK_INTERVAL_HOURS) {
        return { available: false, reason: 'too-soon' };
      }

      let response;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        response = await fetch(VERSION_FILE_URL, {
          cache: 'no-store',
          mode: 'cors',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch {
        // CSP block, network error, or timeout — silently skip
        return { available: false, reason: 'fetch-blocked' };
      }

      if (!response || !response.ok) return { available: false, reason: 'fetch-failed' };

      const remoteVersion = await response.json();
      // BUG-C3/S7 fix: validate remote JSON schema before using
      if (!remoteVersion || typeof remoteVersion.version !== 'string' || !remoteVersion.version.trim()) {
        return { available: false, reason: 'invalid-version-json' };
      }
      let localVersion = localStorage.getItem(LOCAL_VERSION_KEY) || LOCAL_VERSION_FALLBACK;
      if (localVersion === '1.0.0') {
        localVersion = LOCAL_VERSION_FALLBACK;
        localStorage.setItem(LOCAL_VERSION_KEY, localVersion);
      }
      localStorage.setItem(LAST_CHECK_KEY, now.toString());

      const hasUpdate = compareVersions(remoteVersion.version, localVersion) > 0;
      if (hasUpdate) {
        return {
          available: true,
          version: remoteVersion.version,
          changelog: remoteVersion.changelog || 'নতুন আপডেট পাওয়া গেছে',
          size: remoteVersion.size || 'unknown'
        };
      }
      return { available: false, reason: 'up-to-date' };

    } catch {
      return { available: false, reason: 'error' };
    }
  }

  // ── Compare semantic versions: 1.2.3 vs 1.2.4 etc ──
  function compareVersions(v1, v2) {
    const parts1 = (v1 || '0.0.0').split('.').map(Number);
    const parts2 = (v2 || '0.0.0').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    return 0;
  }

  // ── Show update notification ──
  function showUpdatePrompt(updateInfo) {
    const promptId = 'auto-update-prompt';
    
    // Remove if already exists
    const existing = document.getElementById(promptId);
    if (existing) existing.remove();

    const prompt = document.createElement('div');
    prompt.id = promptId;
    prompt.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 9999;
      max-width: 350px;
      animation: slideInUp 0.3s ease-out;
    `;

    prompt.innerHTML = `
      <style>
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .update-title {
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 8px;
        }
        .update-info {
          font-size: 0.9rem;
          margin-bottom: 12px;
          opacity: 0.95;
        }
        .update-actions {
          display: flex;
          gap: 10px;
        }
        .update-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .update-btn-accept {
          background: rgba(255,255,255,0.3);
          color: white;
        }
        .update-btn-accept:hover {
          background: rgba(255,255,255,0.5);
          transform: translateY(-2px);
        }
        .update-btn-dismiss {
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .update-btn-dismiss:hover {
          background: rgba(255,255,255,0.1);
        }
      </style>

      <div class="update-title">✨ নতুন আপডেট পাওয়া গেছে!</div>
      <div class="update-info">
        <strong>Version ${Utils.esc(updateInfo.version)}</strong><br>
        ${Utils.esc(updateInfo.changelog).replace(/\n/g, '<br>')}
      </div>
      <div class="update-actions">
        <button class="update-btn update-btn-accept" onclick="AutoUpdateModule.applyUpdate()">
          আপডেট করুন
        </button>
        <button class="update-btn update-btn-dismiss" onclick="this.closest('#auto-update-prompt').remove()">
          পরে করুন
        </button>
      </div>
    `;

    document.body.appendChild(prompt);

    // Auto-remove after 8 seconds if not dismissed
    setTimeout(() => {
      if (document.getElementById(promptId)) {
        prompt.remove();
      }
    }, 8000);
  }

  // ── Apply update by properly downloading and installing ──
  async function applyUpdate() {
    try {
      if (typeof Utils !== 'undefined') {
        Utils.toast('আপডেট প্রস্তুত করছি...', 'info', 5000);
      }

      // Remove update prompt
      const prompt = document.getElementById('auto-update-prompt');
      if (prompt) prompt.remove();

      // Step 1: Clear all service worker caches to ensure fresh download
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('[AutoUpdate] Service worker caches cleared');
        } catch(e) { console.warn('[AutoUpdate] Cache clear failed:', e); }
      }

      // Step 2: Clear offline data cache to force re-download
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SKIP_WAITING',
            action: 'clearCache'
          });
        }
      } catch(e) { console.warn('[AutoUpdate] Service worker message failed:', e); }

      // Step 3: Remove local version marker
      localStorage.removeItem('wfa_app_version');
      localStorage.removeItem('wfa_last_update_check');
      localStorage.setItem('wfa_update_in_progress', 'true');

      // Step 4: For Android APK - initiate download if available
      if (typeof cordova !== 'undefined' && cordova.plugins && cordova.plugins.AppUpdate) {
        try {
          cordova.plugins.AppUpdate.startUpdate();
          if (window.__WFA_DEV__) console.log('[AutoUpdate] Android update initiated via Cordova');
          return; // Don't reload for Android
        } catch(e) { console.warn('[AutoUpdate] Cordova update failed:', e); }
      }

      // Step 5: Force full page reload after delay (for web/PWA)
      // This ensures service worker gets fresh version and index.html
      setTimeout(() => {
        // Use hard reload to bypass cache
        window.location.href = window.location.href.split('?')[0] + '?force-update=' + Date.now();
      }, 800);

    } catch (error) {
      console.error('[AutoUpdate] Failed to apply update:', error);
      localStorage.removeItem('wfa_update_in_progress');
      if (typeof Utils !== 'undefined') {
        Utils.toast('আপডেট প্রস্তুত ব্যর্থ। পরে চেষ্টা করুন।', 'error');
      }
    }
  }

  // ── Sync local version from bundled version.json ──
  // Ensures localStorage always has the correct deployed version
  // instead of relying on the fallback '1.2.3'.
  async function syncLocalVersion() {
    try {
      const stored = localStorage.getItem(LOCAL_VERSION_KEY);
      // Only sync if not set or still the old fallback
      if (!stored || stored === LOCAL_VERSION_FALLBACK || stored === '1.0.0') {
        const res = await fetch('./version.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.version) {
            localStorage.setItem(LOCAL_VERSION_KEY, data.version);
            console.log(`[AutoUpdate] Synced local version to ${data.version}`);
          }
        }
      }
    } catch {
      // Silently ignore — non-critical
    }
  }

  // ── Initialize auto-check on app start ──
  function init() {
    // Sync local version from bundled version.json first
    syncLocalVersion();

    // Delay check by 5s so it doesn't slow down initial app load
    setTimeout(() => {
      checkForUpdate().then(result => {
        if (result.available) showUpdatePrompt(result);
      }).catch(e => {
        if (window.__WFA_DEV__) console.error('[AutoUpdate] Check failed:', e);
      });
    }, 5000);

    // Check periodically (every hour)
    setInterval(() => {
      checkForUpdate().then(result => {
        if (result.available) showUpdatePrompt(result);
      }).catch(e => {
        if (window.__WFA_DEV__) console.error('[AutoUpdate] Check failed:', e);
      });
    }, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);

    // Check when back online
    window.addEventListener('online', () => {
      checkForUpdate().then(result => {
        if (result.available) showUpdatePrompt(result);
      }).catch(e => {
        if (window.__WFA_DEV__) console.error('[AutoUpdate] Check failed:', e);
      });
    });
  }

  return {
    init,
    checkForUpdate,
    applyUpdate,
    showUpdatePrompt
  };
})();

// Auto-initialize on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AutoUpdateModule.init());
} else {
  AutoUpdateModule.init();
}

// Export for Capacitor if needed
if (typeof window !== 'undefined') {
  window.AutoUpdateModule = AutoUpdateModule;
}
