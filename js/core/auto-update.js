// ============================================================
// Auto-Update Module — Remote URL Loading + Version Check
// Wings Fly Aviation Academy
// ============================================================

const AutoUpdateModule = (() => {
  const VERSION_FILE_URL = 'https://wings-fly.vercel.app/version.json'; // CHANGE THIS TO YOUR DOMAIN
  const LOCAL_VERSION_KEY = 'wfa_app_version';
  const LAST_CHECK_KEY = 'wfa_last_update_check';
  const CHECK_INTERVAL_HOURS = 1; // Check every 1 hour

  // ── Check if new version available ──
  async function checkForUpdate() {
    try {
      if (!navigator.onLine) {
        console.log('[AutoUpdate] Offline - skipping check');
        return { available: false, reason: 'offline' };
      }

      const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
      const now = Date.now();
      const hoursSinceCheck = (now - lastCheck) / (1000 * 60 * 60);

      if (lastCheck && hoursSinceCheck < CHECK_INTERVAL_HOURS) {
        console.log('[AutoUpdate] Checked recently, skipping');
        return { available: false, reason: 'too-soon' };
      }

      console.log('[AutoUpdate] Checking for updates...');
      const response = await fetch(VERSION_FILE_URL, { cache: 'no-store' });
      
      if (!response.ok) {
        console.warn('[AutoUpdate] Failed to fetch version:', response.status);
        return { available: false, reason: 'fetch-failed' };
      }

      const remoteVersion = await response.json();
      const localVersion = localStorage.getItem(LOCAL_VERSION_KEY) || '1.0.0';

      // Update last check time
      localStorage.setItem(LAST_CHECK_KEY, now.toString());

      const hasUpdate = compareVersions(remoteVersion.version, localVersion) > 0;

      if (hasUpdate) {
        console.log('[AutoUpdate] New version available:', remoteVersion.version);
        return {
          available: true,
          version: remoteVersion.version,
          changelog: remoteVersion.changelog || 'নতুন আপডেট পাওয়া গেছে',
          size: remoteVersion.size || 'unknown'
        };
      }

      console.log('[AutoUpdate] Already on latest version:', localVersion);
      return { available: false, reason: 'up-to-date' };

    } catch (error) {
      console.error('[AutoUpdate] Check failed:', error);
      return { available: false, reason: 'error', error: error.message };
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
        <strong>Version ${updateInfo.version}</strong><br>
        ${updateInfo.changelog}
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
          console.log('[AutoUpdate] Android update initiated via Cordova');
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

  // ── Initialize auto-check on app start ──
  function init() {
    // Check on app load
    checkForUpdate().then(result => {
      if (result.available) {
        console.log('[AutoUpdate] Update available, showing prompt');
        showUpdatePrompt(result);
      }
    });

    // Check periodically (every hour)
    setInterval(() => {
      checkForUpdate().then(result => {
        if (result.available) {
          showUpdatePrompt(result);
        }
      });
    }, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);

    // Check when online
    window.addEventListener('online', () => {
      console.log('[AutoUpdate] Back online, checking for updates');
      checkForUpdate().then(result => {
        if (result.available) {
          showUpdatePrompt(result);
        }
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
