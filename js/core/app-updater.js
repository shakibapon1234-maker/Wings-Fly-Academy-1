/**
 * Wings Fly Academy — Auto-Update Checker
 * Checks GitHub releases for new versions and prompts user to update.
 * Works with Capacitor Android builds.
 */
const AppUpdater = (() => {

  // ── Config ──
  const GITHUB_REPO = 'shakibapon1234-maker/Wings-Fly-Academy-1';
  const VERSION_KEY = 'wfa_app_version';
  const LAST_CHECK_KEY = 'wfa_update_last_check';
  const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // Check every 6 hours
  const CURRENT_VERSION = '1.0.0';

  function init() {
    // Save current version if not set
    if (!localStorage.getItem(VERSION_KEY)) {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
    // Check for updates on app start (with throttle)
    const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
    if (Date.now() - lastCheck > CHECK_INTERVAL) {
      setTimeout(checkForUpdate, 5000); // Delay 5s to not block startup
    }
  }

  async function checkForUpdate() {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) return;

      const release = await res.json();
      const remoteVersion = release.tag_name?.replace(/^v/, '') || '';
      const localVersion = localStorage.getItem(VERSION_KEY) || CURRENT_VERSION;

      localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

      if (remoteVersion && remoteVersion !== localVersion && _isNewer(remoteVersion, localVersion)) {
        _showUpdatePrompt(remoteVersion, release);
      } else {
        console.info('[AppUpdater] App is up to date:', localVersion);
      }
    } catch (e) {
      console.warn('[AppUpdater] Check failed (offline?):', e.message);
    }
  }

  function _isNewer(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      if ((r[i] || 0) > (l[i] || 0)) return true;
      if ((r[i] || 0) < (l[i] || 0)) return false;
    }
    return false;
  }

  function _showUpdatePrompt(version, release) {
    // Find APK download URL
    const apkAsset = release.assets?.find(a => a.name?.endsWith('.apk'));
    const downloadUrl = apkAsset?.browser_download_url || release.html_url;
    const changelog = release.body || 'Bug fixes and improvements';

    const overlay = document.createElement('div');
    overlay.id = 'update-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,0.8); backdrop-filter:blur(8px);
      display:flex; align-items:center; justify-content:center;
      animation: fadeIn 0.3s ease;
    `;
    overlay.innerHTML = `
      <div style="
        background:linear-gradient(135deg, #0a0e27, #0f0a28);
        border:1.5px solid rgba(0,212,255,0.3);
        border-radius:16px; padding:28px; max-width:380px; width:90%;
        box-shadow:0 0 40px rgba(0,212,255,0.15);
        text-align:center; color:#fff;
      ">
        <div style="font-size:2.5rem;margin-bottom:12px;">🚀</div>
        <div style="font-size:1.2rem;font-weight:800;color:#00d4ff;margin-bottom:6px;">
          আপডেট পাওয়া গেছে!
        </div>
        <div style="font-size:0.85rem;color:rgba(255,255,255,0.6);margin-bottom:16px;">
          Version <strong style="color:#00ff88;">${version}</strong> available
        </div>
        <div style="
          background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.15);
          border-radius:8px; padding:12px; margin-bottom:20px;
          font-size:0.78rem; color:rgba(255,255,255,0.7); text-align:left;
          max-height:120px; overflow-y:auto;
        ">${changelog.replace(/\n/g, '<br>')}</div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button onclick="AppUpdater.dismissUpdate('${version}')" style="
            padding:10px 20px; border-radius:8px; font-weight:700;
            background:transparent; color:rgba(255,255,255,0.5);
            border:1px solid rgba(255,255,255,0.15); cursor:pointer;
          ">পরে করব</button>
          <button onclick="AppUpdater.downloadUpdate('${downloadUrl}')" style="
            padding:10px 24px; border-radius:8px; font-weight:800;
            background:linear-gradient(135deg,#00d4ff,#00ff88);
            color:#0a0e27; border:none; cursor:pointer;
            box-shadow:0 0 15px rgba(0,212,255,0.3);
          ">⬇️ আপডেট করুন</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function dismissUpdate(version) {
    const overlay = document.getElementById('update-overlay');
    if (overlay) overlay.remove();
    // Don't show again for this version for 24 hours
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  }

  function downloadUpdate(url) {
    window.open(url, '_system');
    const overlay = document.getElementById('update-overlay');
    if (overlay) overlay.remove();
  }

  function skipVersion(version) {
    localStorage.setItem(VERSION_KEY, version);
    const overlay = document.getElementById('update-overlay');
    if (overlay) overlay.remove();
  }

  return { init, checkForUpdate, dismissUpdate, downloadUpdate, skipVersion };
})();

// Auto-init
if (document.readyState === 'complete') AppUpdater.init();
else window.addEventListener('load', () => setTimeout(AppUpdater.init, 3000));
