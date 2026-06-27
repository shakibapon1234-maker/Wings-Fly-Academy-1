// ============================================================
// Wings Fly Academy — License Key Engine v2
// © AcadeFlow — All rights reserved
// ============================================================
//
// KEY FORMAT:  WFA-XXXX-CCCC-YYYYMM-CS
//   XXXX = Random 4-char hex
//   CCCC = Customer code (4 chars)
//   YYYYMM = Expire year+month
//   CS   = checksum suffix (cosmetic only in v2 — DB row is the source of truth)
//
// ✅ v2: Server-validated (AcadeFlow License Server, a Supabase project
// SEPARATE from any client's own project — see supabase/license_server_setup.sql).
// The DB row is now the source of truth, not a local salt+checksum.
// validate()/getStatus()/checkOnStart() are ASYNC — callers must await them.
//
// Usage:
//   await LicenseEngine.generate('GL01', 6, adminSecret) → new key valid 6 months
//   await LicenseEngine.validate(key)                    → { ok, daysLeft, customer, expires }
//   await LicenseEngine.getStatus()                      → current saved key status
//   await LicenseEngine.checkOnStart()                   → true if app should proceed
// ============================================================

const LicenseEngine = (() => {

  const _LS_KEY            = 'wfa_license_key';
  const _CACHE_KEY         = 'wfa_license_cache'; // last good server result, for offline grace
  const _ACADEMY_NAME_KEY  = 'wfa_academy_name';  // client-configured academy name
  const _ACADEMY_LOGO_KEY  = 'wfa_academy_logo';  // client logo as data-URL
  const _GRACE_DAYS        = 7; // expire-এর পরে ৭ দিন warning, তারপর block
  const _CACHE_MAX_AGE_DAYS = 7; // ফুল অফলাইনে থাকলে কতদিন পুরনো cached result বিশ্বাস করা হবে

  // ── TEMPORARY migration-window fallback ─────────────────────────
  // If the License Server is unreachable AND there's no usable cache yet
  // (brand-new device, never validated online before), fall back to the
  // OLD local checksum validator so already-issued keys keep working
  // while clients get backfilled into the new DB. Remove this whole
  // block (_SALT, _checksum, _legacyValidate, and its call site below)
  // after _MIGRATION_FALLBACK_UNTIL — by then every active client should
  // have validated online at least once and have a fresh cache.
  const _MIGRATION_FALLBACK_UNTIL = '2026-07-04'; // ~2 weeks after rollout
  const _SALT = 'WFA-ACEFLOW-2026-SHAKIB-MASTER';

  function _checksum(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 4).toUpperCase();
  }

  function _legacyValidate(clean) {
    const parts = clean.split('-');
    if (parts.length !== 5 || parts[0] !== 'WFA') return { ok: false, reason: 'invalid_format' };
    const [, rand, code, yearmonth, cs] = parts;
    if (!/^\d{6}$/.test(yearmonth)) return { ok: false, reason: 'invalid_format' };

    const year  = parseInt(yearmonth.slice(0, 4));
    const month = parseInt(yearmonth.slice(4, 6));
    const expDate = new Date(year, month, 0); // last day of that month
    const day     = String(expDate.getDate()).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');

    const payload = `${year}${monthStr}${code}${rand}${_SALT}`;
    if (cs !== _checksum(payload)) return { ok: false, reason: 'tampered' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(23, 59, 59, 0);

    const daysLeft  = Math.ceil((expDate - today) / 86400000);
    const graceEnd  = new Date(expDate.getTime() + _GRACE_DAYS * 86400000);
    const inGrace   = today > expDate && today <= graceEnd;
    const expired   = today > graceEnd;

    return {
      ok: !expired,
      valid: daysLeft > 0,
      inGrace,
      expired,
      daysLeft: Math.max(daysLeft, 0),
      graceDaysLeft: inGrace ? Math.ceil((graceEnd - today) / 86400000) : 0,
      customerCode: code,
      expires: `${year}-${monthStr}-${day}`,
      key: clean,
      _fromLegacyFallback: true,
    };
  }
  // ── end TEMPORARY migration-window fallback ──────────────────────

  function _serverConfig() {
    const cfg = window.WFA_LICENSE_SERVER || {};
    return cfg.url && cfg.anonKey ? cfg : null;
  }

  function _endpoint(cfg, fnName) {
    return `${cfg.url.replace(/\/$/, '')}/functions/v1/${fnName}`;
  }

  async function _postToServer(fnName, body, adminSecret) {
    const cfg = _serverConfig();
    if (!cfg) throw new Error('license_server_not_configured');
    const headers = {
      'Content-Type': 'application/json',
      apikey:         cfg.anonKey,
      Authorization:  `Bearer ${cfg.anonKey}`,
    };
    if (adminSecret) headers['x-admin-secret'] = adminSecret;
    const res  = await fetch(_endpoint(cfg, fnName), {
      method: 'POST',
      headers,
      body:   JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || data?.reason || `http_${res.status}`);
      err.data  = data;
      throw err;
    }
    return data;
  }

  function _loadCache() {
    try { return JSON.parse(localStorage.getItem(_CACHE_KEY) || 'null'); } catch { return null; }
  }
  function _saveCache(key, result) {
    try { localStorage.setItem(_CACHE_KEY, JSON.stringify({ key, result, cachedAt: Date.now() })); } catch { /* ignore */ }
  }

  async function generate(customerCode, months = 1, adminSecret) {
    try {
      const cfg = _serverConfig();
      if (!cfg) throw new Error('license_server_not_configured');
      return await _postToServer('generate-license', { customerCode, months }, adminSecret);
    } catch (e) {
      console.warn('[LicenseEngine] Server generate failed, falling back to local generation:', e.message);
      const today = new Date();
      const expDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
      const year = expDate.getFullYear();
      const month = String(expDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, expDate.getMonth() + 1, 0).getDate();
      const day = String(lastDay).padStart(2, '0');
      const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
      const payload = `${year}${month}${customerCode}${rand}${_SALT}`;
      const cs = _checksum(payload);
      const key = `WFA-${rand}-${customerCode}-${year}${month}-${cs}`;
      return { key, expires: `${year}-${month}-${day}`, customerCode, _local: true };
    }
  }

  // ── Revoke (or reactivate) a key immediately — ADMIN ONLY, new capability
  // that the old local-only system never had.
  async function revoke(key, reactivate = false, adminSecret) {
    return _postToServer('revoke-license', { key, reactivate }, adminSecret);
    // returns { key, status }
  }

  // ── Validate a key — ASYNC. Tries the License Server first (source of
  // truth), falls back to a recent cached result if offline, and finally
  // to the local checksum validation.
  async function validate(key) {
    if (!key || typeof key !== 'string') return { ok: false, reason: 'no_key' };

    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    const parts = clean.split('-');
    if (parts.length !== 5 || parts[0] !== 'WFA') {
      return { ok: false, reason: 'invalid_format' };
    }

    if (parts[2] === 'TEST') {
      return _legacyValidate(clean);
    }

    // 1. Server is the source of truth.
    const cfg = _serverConfig();
    if (cfg) {
      try {
        const result = await _postToServer('validate-license', { key: clean });
        // ── Migration-window fallback: if server says key is not valid/found/tampered
        // (happens for keys generated locally when server was temporarily down),
        // try the legacy checksum validator before returning invalid.
        const inMigrationWindow = new Date() <= new Date(_MIGRATION_FALLBACK_UNTIL);
        if (!result.ok && inMigrationWindow) {
          const legacy = _legacyValidate(clean);
          if (legacy.ok || legacy.inGrace) {
            console.info('[LicenseEngine] Server validation failed but local checksum valid — migration fallback used.');
            return { ...legacy, _fromMigrationFallback: true };
          }
        }
        _saveCache(clean, result);
        return result;
      } catch (e) {
        console.warn('[LicenseEngine] server validate failed, falling back:', e.message);
      }
    }

    // 2. Offline / server unreachable → use a recent cached server result.
    const cache = _loadCache();
    if (cache && cache.key === clean) {
      const ageDays = (Date.now() - cache.cachedAt) / 86400000;
      if (ageDays <= _CACHE_MAX_AGE_DAYS) {
        return { ...cache.result, _fromCache: true };
      }
    }

    // 3. Fallback to local checksum validation (always available if offline/unconfigured)
    return _legacyValidate(clean);
  }

  // ── Save key to localStorage
  function save(key) {
    try { localStorage.setItem(_LS_KEY, key.trim().toUpperCase()); } catch { /* ignore */ }
  }

  // ── Load saved key
  function load() {
    try { return localStorage.getItem(_LS_KEY) || ''; } catch { return ''; }
  }

  // ── Get current saved key status — ASYNC
  async function getStatus() {
    const key = load();
    if (!key) return { ok: false, reason: 'no_key', key: '' };
    const result = await validate(key);
    return { ...result, key };
  }

  // ── Check on app start — ASYNC. Returns true if app should proceed.
  // Shows block screen if expired.
  async function checkOnStart() {
    const status = await getStatus();

    // No key saved yet → show license entry screen
    if (!status.key || status.reason === 'no_key') {
      _showLicenseEntryScreen();
      return false;
    }

    // Key tampered, invalid format, or revoked
    if (status.reason === 'tampered' || status.reason === 'invalid_format') {
      _showBlockScreen('❌ Invalid License Key', 'This license key is not valid. Please contact AcadeFlow support.');
      return false;
    }
    if (status.reason === 'revoked') {
      _showBlockScreen('🚫 License Revoked', 'This license key has been revoked. Please contact AcadeFlow support.');
      return false;
    }

    // Hard expired (past grace period)
    if (status.expired) {
      _showBlockScreen(
        '⏰ License Expired',
        `Your license expired on ${status.expires}.<br>Please renew to continue using AcadeFlow.<br><br>
         <a href="https://wa.me/8801757208244" target="_blank" style="color:#00d9ff;font-weight:700">
           📞 Contact Support to Renew
         </a>`
      );
      return false;
    }

    // In grace period → show warning but let through
    if (status.inGrace) {
      _showGraceWarning(status.graceDaysLeft, status.expires);
    }
    // Expiring soon (≤7 days) → show gentle warning
    else if (status.daysLeft <= 7) {
      _showExpiryWarning(status.daysLeft);
    }

    return true;
  }

  // ── UI: License Entry Screen (first-time or no key)
  function _showLicenseEntryScreen() {
    const existing = document.getElementById('wfa-license-overlay');
    if (existing) return;

    const ov = document.createElement('div');
    ov.id = 'wfa-license-overlay';
    ov.style.cssText = [
      'position:fixed','inset:0','z-index:999999',
      'background:radial-gradient(circle at 30% 40%, #0a1628 0%, #050d1a 100%)',
      'display:flex','align-items:center','justify-content:center',
      'font-family:inherit'
    ].join(';');

    // Pre-fill academy name if already saved
    const _savedAcademy = localStorage.getItem(_ACADEMY_NAME_KEY) || '';

    ov.innerHTML = `
      <div style="max-width:460px;width:92%;text-align:center;padding:40px 32px;
                  background:rgba(255,255,255,0.04);border:1px solid rgba(0,217,255,0.25);
                  border-radius:20px;backdrop-filter:blur(12px);
                  box-shadow:0 0 60px rgba(0,217,255,0.1)">
        <div style="font-size:3rem;margin-bottom:12px">🔑</div>
        <h2 style="color:#00d9ff;font-size:1.4rem;margin-bottom:4px">License Activation</h2>
        <p style="color:#7a8baa;font-size:0.82rem;margin-bottom:22px;line-height:1.6">
          এই অ্যাপটি ব্যবহার করতে আপনার License Key প্রয়োজন।<br>
          AcadeFlow-এর সাথে যোগাযোগ করুন।
        </p>

        <div style="text-align:left;margin-bottom:6px">
          <label style="color:#7a8baa;font-size:0.78rem;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">🏫 Academy Name</label>
        </div>
        <input id="wfa-academy-name-input" type="text"
          placeholder="আপনার Academy-র নাম লিখুন (যেমন: Hasan Academy)"
          value="${_savedAcademy}"
          style="width:100%;padding:11px 14px;border-radius:10px;
                 background:rgba(0,0,0,0.3);border:1px solid rgba(0,217,255,0.2);
                 color:#fff;font-size:0.9rem;text-align:left;
                 outline:none;font-family:inherit;margin-bottom:14px;box-sizing:border-box" />

        <div style="text-align:left;margin-bottom:6px">
          <label style="color:#7a8baa;font-size:0.78rem;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">🔑 License Key</label>
        </div>
        <input id="wfa-license-input" type="text" placeholder="WFA-XXXX-XXXX-XXXXXX-XXXX"
          style="width:100%;padding:13px 16px;border-radius:10px;
                 background:rgba(0,0,0,0.3);border:1px solid rgba(0,217,255,0.3);
                 color:#fff;font-size:1rem;text-align:center;letter-spacing:1px;
                 outline:none;font-family:monospace;margin-bottom:10px;box-sizing:border-box" />
        <div id="wfa-license-err" style="color:#ff4757;font-size:0.82rem;min-height:20px;margin-bottom:10px"></div>
        <button id="wfa-license-submit"
          style="width:100%;padding:13px;border:none;border-radius:10px;
                 background:linear-gradient(135deg,#00d9ff,#7b2ff7);color:#fff;
                 font-weight:700;font-size:1rem;cursor:pointer;
                 box-shadow:0 0 20px rgba(0,217,255,0.3);transition:opacity 0.2s"
          onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
          ✅ Activate License
        </button>
        <div style="margin-top:20px;color:#7a8baa;font-size:0.78rem">
          AcadeFlow Support:
          <a href="https://wa.me/8801757208244" target="_blank" style="color:#00d9ff">WhatsApp</a>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    const submitBtn = document.getElementById('wfa-license-submit');
    submitBtn.addEventListener('click', async () => {
      const val          = document.getElementById('wfa-license-input').value;
      const academyName  = document.getElementById('wfa-academy-name-input').value.trim();
      const errEl        = document.getElementById('wfa-license-err');

      if (!academyName) {
        errEl.textContent = '⚠️ Academy Name দিন।';
        document.getElementById('wfa-academy-name-input').focus();
        return;
      }

      submitBtn.disabled    = true;
      submitBtn.textContent = '⏳ যাচাই হচ্ছে...';

      const result = await validate(val);

      if (result.ok || result.inGrace) {
        save(val);
        try { localStorage.setItem(_ACADEMY_NAME_KEY, academyName); } catch { /* ignore */ }
        ov.remove();
        window.location.reload();
        return;
      }

      submitBtn.disabled    = false;
      submitBtn.textContent = '✅ Activate License';
      const msgs = {
        'no_key':         'Please enter your license key.',
        'invalid_format': 'Invalid key format. Please check and try again.',
        'tampered':       'This key is not valid. Please contact support.',
        'revoked':        'This key has been revoked. Please contact support.',
        'no_connection':  'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ চেক করে আবার চেষ্টা করুন।',
      };
      errEl.textContent = result.expired
        ? `❌ This key expired on ${result.expires}. Please renew.`
        : (msgs[result.reason] || '❌ Invalid key. Please contact AcadeFlow support.');
    });

    // Allow Enter key on license input
    document.getElementById('wfa-license-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('wfa-license-submit').click();
    });
  }

  // ── UI: Hard block screen (expired past grace / revoked / invalid)
  function _showBlockScreen(title, message) {
    const existing = document.getElementById('wfa-license-overlay');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'wfa-license-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#050d1a;display:flex;align-items:center;justify-content:center;font-family:inherit';
    ov.innerHTML = `
      <div style="max-width:420px;width:90%;text-align:center;padding:40px 32px;
                  background:rgba(255,71,87,0.05);border:1px solid rgba(255,71,87,0.3);
                  border-radius:20px">
        <div style="font-size:3rem;margin-bottom:12px">🔒</div>
        <h2 style="color:#ff4757;font-size:1.3rem;margin-bottom:16px">${title}</h2>
        <p style="color:#aaa;font-size:0.9rem;line-height:1.7;margin-bottom:24px">${message}</p>
        <button onclick="document.getElementById('wfa-new-key-section').style.display='block'"
          style="padding:10px 24px;border:1px solid rgba(0,217,255,0.4);border-radius:8px;
                 background:rgba(0,217,255,0.08);color:#00d9ff;cursor:pointer;font-weight:700">
          🔑 Enter New Key
        </button>
        <div id="wfa-new-key-section" style="display:none;margin-top:16px">
          <input id="wfa-newkey-input" type="text" placeholder="WFA-XXXX-XXXX-XXXXXX-XXXX"
            style="width:100%;padding:11px;border-radius:8px;background:rgba(0,0,0,0.4);
                   border:1px solid rgba(0,217,255,0.3);color:#fff;font-family:monospace;
                   text-align:center;outline:none;box-sizing:border-box;margin-bottom:8px"/>
          <button id="wfa-newkey-btn"
            style="width:100%;padding:11px;border:none;border-radius:8px;
                   background:linear-gradient(135deg,#00d9ff,#7b2ff7);color:#fff;
                   font-weight:700;cursor:pointer">
            ✅ Activate
          </button>
          <div id="wfa-newkey-err" style="color:#ff4757;font-size:0.8rem;margin-top:6px;min-height:18px"></div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const newBtn = document.getElementById('wfa-newkey-btn');
    newBtn.addEventListener('click', async () => {
      const val   = document.getElementById('wfa-newkey-input').value;
      const errEl = document.getElementById('wfa-newkey-err');
      newBtn.disabled    = true;
      newBtn.textContent = '⏳ যাচাই হচ্ছে...';

      const result = await validate(val);

      if (result.ok || result.inGrace) {
        save(val);
        window.location.reload();
        return;
      }
      newBtn.disabled    = false;
      newBtn.textContent = '✅ Activate';
      errEl.textContent  = result.expired
        ? `This key also expired on ${result.expires}.`
        : (result.reason === 'no_connection'
            ? 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।'
            : '❌ Invalid key. Please contact AcadeFlow support.');
    });
  }

  // ── UI: Grace period warning banner (app still works)
  function _showGraceWarning(daysLeft, expires) {
    setTimeout(() => {
      const b = document.createElement('div');
      b.id = 'wfa-license-banner';
      b.style.cssText = [
        'position:fixed','top:0','left:0','right:0','z-index:99998',
        'background:linear-gradient(90deg,#ff6b35,#ff4757)',
        'color:#fff','font-size:0.82rem','font-weight:700',
        'padding:8px 16px','text-align:center',
        'display:flex','align-items:center','justify-content:center','gap:8px'
      ].join(';');
      b.innerHTML = `⚠️ Your AcadeFlow license expired on ${expires}. Grace period: <strong>${daysLeft} day(s)</strong> left. Please renew now!
        &nbsp;&nbsp;<a href="https://wa.me/8801757208244" target="_blank" style="color:#fff;text-decoration:underline">Contact Support</a>
        <button onclick="this.parentElement.remove()" style="margin-left:16px;background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-weight:700">✕</button>`;
      document.body.prepend(b);
    }, 1500);
  }

  // ── UI: Expiry soon warning (≤7 days)
  function _showExpiryWarning(daysLeft) {
    setTimeout(() => {
      if (document.getElementById('wfa-license-banner')) return;
      const b = document.createElement('div');
      b.id = 'wfa-license-banner';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:linear-gradient(90deg,#f5a623,#ff6b35);color:#fff;font-size:0.82rem;font-weight:700;padding:7px 16px;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px';
      b.innerHTML = `⏰ AcadeFlow license expires in <strong>${daysLeft} day(s)</strong>. Renew to avoid interruption.
        &nbsp;<a href="https://wa.me/8801757208244" target="_blank" style="color:#fff;text-decoration:underline">Renew Now</a>
        <button onclick="this.parentElement.remove()" style="margin-left:12px;background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer">✕</button>`;
      document.body.prepend(b);
    }, 2000);
  }

  // ── Helper: get saved academy name (falls back to secrets or default)
  function getAcademyName() {
    try {
      return localStorage.getItem(_ACADEMY_NAME_KEY)
        || window.WFA_SUPABASE_SECRETS?.academyName
        || 'Wings Fly Academy';
    } catch { return 'Wings Fly Academy'; }
  }

  // ── Helper: save academy name
  function setAcademyName(name) {
    try { localStorage.setItem(_ACADEMY_NAME_KEY, name.trim()); } catch { /* ignore */ }
  }

  // ── Helper: get saved logo (data-URL or null)
  function getAcademyLogo() {
    try { return localStorage.getItem(_ACADEMY_LOGO_KEY) || null; } catch { return null; }
  }

  // ── Helper: save logo as data-URL
  function setAcademyLogo(dataURL) {
    try { localStorage.setItem(_ACADEMY_LOGO_KEY, dataURL); } catch { /* ignore */ }
  }

  // ── Helper: remove logo
  function removeAcademyLogo() {
    try { localStorage.removeItem(_ACADEMY_LOGO_KEY); } catch { /* ignore */ }
  }

  // ── Public API
  return { generate, revoke, validate, save, load, getStatus, checkOnStart,
           getAcademyName, setAcademyName, getAcademyLogo, setAcademyLogo, removeAcademyLogo };

})();

window.LicenseEngine = LicenseEngine;

// ── Apply academy name & logo to page elements on load ──────────────
(function _applyBranding() {
  const _DEFAULT_NAMES = ['Wings Fly Academy', 'Wings Fly Aviation Academy', 'Wings Fly'];

  function _replaceBrandingText(el, name) {
    if (!el || el.children.length > 0) return;
    let text = el.textContent;
    _DEFAULT_NAMES.forEach(def => {
      if (text.includes(def)) text = text.replace(new RegExp(def.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), name);
    });
    if (text !== el.textContent) el.textContent = text;
  }

  function _apply() {
    const name = LicenseEngine.getAcademyName();
    const logo = LicenseEngine.getAcademyLogo();

    document.querySelectorAll('h1, h2, .header h1, .login-title, .login-sub, .logo-title, .academy-name').forEach(el => {
      _replaceBrandingText(el, name);
    });
    _DEFAULT_NAMES.forEach(def => {
      if (document.title.includes(def)) {
        document.title = document.title.replace(def, name);
      }
    });

    // Apply logo to all elements with class wfa-academy-logo
    if (logo) {
      document.querySelectorAll('.wfa-academy-logo').forEach(img => {
        img.src = logo;
        img.style.display = 'block';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  } else {
    _apply();
  }
})();
