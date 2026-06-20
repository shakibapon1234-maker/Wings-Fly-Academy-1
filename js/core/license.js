// ============================================================
// Wings Fly Academy — License Key Engine
// © AcadeFlow — All rights reserved
// ============================================================
//
// KEY FORMAT:  WFA-YYYY-XXXX-CCCC-EM
//   YYYY = Year (e.g. 2026)
//   XXXX = Random 4-char hex
//   CCCC = Customer code (4 chars)
//   EM   = Expire Month as 2-digit (01-12), year encoded in salt
//
// Usage:
//   LicenseEngine.generate('GL01', 6)  → new key valid 6 months
//   LicenseEngine.validate(key)        → { ok, daysLeft, customer, expires }
//   LicenseEngine.getStatus()          → current saved key status
// ============================================================

const LicenseEngine = (() => {

  // ── Master secret — শুধু আপনি জানেন, কেউ কপি করতে পারবে না
  const _SALT = 'WFA-ACEFLOW-2026-SHAKIB-MASTER';
  const _LS_KEY = 'wfa_license_key';
  const _GRACE_DAYS = 7; // expire-এর পরে ৭ দিন warning, তারপর block

  // ── Simple deterministic checksum (tamper detection)
  function _checksum(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 4).toUpperCase();
  }

  // ── Generate a new license key
  // customerCode: 4-char code (e.g. 'GL01' for Green Leaf #1)
  // months: validity in months (default 1)
  function generate(customerCode, months = 1) {
    const code = (customerCode || 'C001').toUpperCase().slice(0, 4).padEnd(4, '0');
    const now = new Date();
    const expDate = new Date(now);
    expDate.setMonth(expDate.getMonth() + months);

    const year = expDate.getFullYear();
    const month = String(expDate.getMonth() + 1).padStart(2, '0');
    const day = String(expDate.getDate()).padStart(2, '0');

    // random part
    const rand = Math.random().toString(16).slice(2, 6).toUpperCase();

    // encode expiry into payload
    const payload = `${year}${month}${day}${code}${rand}${_SALT}`;
    const cs = _checksum(payload);

    // KEY = WFA-RAND-CODE-YEARMONTH-CS
    const key = `WFA-${rand}-${code}-${year}${month}-${cs}`;
    return { key, expires: `${year}-${month}-${day}`, customerCode: code };
  }

  // ── Validate a key
  function validate(key) {
    if (!key || typeof key !== 'string') return { ok: false, reason: 'no_key' };

    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    const parts = clean.split('-');

    // Expected: WFA-RAND-CODE-YEARMONTH-CS  → 5 parts
    if (parts.length !== 5 || parts[0] !== 'WFA') {
      return { ok: false, reason: 'invalid_format' };
    }

    const [, rand, code, yearmonth, cs] = parts;

    // yearmonth must be 6 digits: YYYYMM
    if (!/^\d{6}$/.test(yearmonth)) return { ok: false, reason: 'invalid_format' };

    const year  = parseInt(yearmonth.slice(0, 4));
    const month = parseInt(yearmonth.slice(4, 6));

    // Reconstruct expire date as last day of the expire month
    const expDate = new Date(year, month, 0); // day=0 → last day of prev month = last day of our month
    const day = String(expDate.getDate()).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');

    // Verify checksum
    const payload = `${year}${monthStr}${day}${code}${rand}${_SALT}`;
    const expectedCs = _checksum(payload);

    if (cs !== expectedCs) {
      return { ok: false, reason: 'tampered' };
    }

    // Check expiry
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(23, 59, 59, 0);

    const daysLeft = Math.ceil((expDate - today) / 86400000);
    const graceEnd = new Date(expDate.getTime() + _GRACE_DAYS * 86400000);
    const inGrace  = today > expDate && today <= graceEnd;
    const expired  = today > graceEnd;

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
    };
  }

  // ── Save key to localStorage
  function save(key) {
    try { localStorage.setItem(_LS_KEY, key.trim().toUpperCase()); } catch {}
  }

  // ── Load saved key
  function load() {
    try { return localStorage.getItem(_LS_KEY) || ''; } catch { return ''; }
  }

  // ── Get current saved key status
  function getStatus() {
    const key = load();
    if (!key) return { ok: false, reason: 'no_key', key: '' };
    return { ...validate(key), key };
  }

  // ── Check on app start — returns true if app should proceed
  // Shows block screen if expired
  function checkOnStart() {
    const status = getStatus();

    // No key saved yet → show license entry screen
    if (!status.key || status.reason === 'no_key') {
      _showLicenseEntryScreen();
      return false;
    }

    // Key tampered or invalid format
    if (status.reason === 'tampered' || status.reason === 'invalid_format') {
      _showBlockScreen('❌ Invalid License Key', 'This license key is not valid. Please contact AcadeFlow support.');
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

    ov.innerHTML = `
      <div style="max-width:440px;width:90%;text-align:center;padding:40px 32px;
                  background:rgba(255,255,255,0.04);border:1px solid rgba(0,217,255,0.25);
                  border-radius:20px;backdrop-filter:blur(12px);
                  box-shadow:0 0 60px rgba(0,217,255,0.1)">
        <div style="font-size:3rem;margin-bottom:12px">🔑</div>
        <h2 style="color:#00d9ff;font-size:1.4rem;margin-bottom:6px">License Key Required</h2>
        <p style="color:#7a8baa;font-size:0.85rem;margin-bottom:24px;line-height:1.6">
          এই অ্যাপটি ব্যবহার করতে আপনার License Key প্রয়োজন।<br>
          AcadeFlow-এর সাথে যোগাযোগ করুন।
        </p>
        <input id="wfa-license-input" type="text" placeholder="WFA-XXXX-XXXX-XXXXXX-XXXX"
          style="width:100%;padding:13px 16px;border-radius:10px;
                 background:rgba(0,0,0,0.3);border:1px solid rgba(0,217,255,0.3);
                 color:#fff;font-size:1rem;text-align:center;letter-spacing:1px;
                 outline:none;font-family:monospace;margin-bottom:12px;box-sizing:border-box" />
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

    document.getElementById('wfa-license-submit').addEventListener('click', () => {
      const val = document.getElementById('wfa-license-input').value;
      const result = validate(val);
      const errEl = document.getElementById('wfa-license-err');

      if (result.ok || result.inGrace) {
        save(val);
        ov.remove();
        // Reload so the app starts fresh with the valid key
        window.location.reload();
      } else {
        const msgs = {
          'no_key':         'Please enter your license key.',
          'invalid_format': 'Invalid key format. Please check and try again.',
          'tampered':       'This key is not valid. Please contact support.',
        };
        errEl.textContent = result.expired
          ? `❌ This key expired on ${result.expires}. Please renew.`
          : (msgs[result.reason] || '❌ Invalid key. Please contact AcadeFlow support.');
      }
    });

    // Allow Enter key
    document.getElementById('wfa-license-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('wfa-license-submit').click();
    });
  }

  // ── UI: Hard block screen (expired past grace)
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

    document.getElementById('wfa-newkey-btn').addEventListener('click', () => {
      const val = document.getElementById('wfa-newkey-input').value;
      const result = validate(val);
      if (result.ok || result.inGrace) {
        save(val);
        window.location.reload();
      } else {
        document.getElementById('wfa-newkey-err').textContent = result.expired
          ? `This key also expired on ${result.expires}.`
          : '❌ Invalid key. Please contact AcadeFlow support.';
      }
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

  // ── Public API
  return { generate, validate, save, load, getStatus, checkOnStart };

})();

window.LicenseEngine = LicenseEngine;
