// ============================================================
// AcadeFlow — First-Time Setup Wizard
// Shown when a client opens their new deployment for the first time.
// Flow: License Key → Admin Password Setup → App Ready
// ============================================================

const SetupWizard = (() => {

  let _onComplete = null;

  // ── Public API ──────────────────────────────────────────────
  /**
   * Check if this is a first-time setup (no admin password, no data).
   * Returns true if Setup Wizard should be shown.
   */
  async function isFirstTimeSetup() {
    try {
      // If supabase client is not available, skip wizard
      if (!window.supabaseClient && !(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.client)) {
        return false;
      }

      const client = window.supabaseClient || window.SUPABASE_CONFIG.client;

      // Check settings table for admin_password
      const { data: settings, error } = await client
        .from('settings')
        .select('admin_password, id')
        .limit(1)
        .maybeSingle();

      if (error) {
        // Table might not exist yet — definitely first time
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return true;
        }
        // Other error — skip wizard, go to normal login
        return false;
      }

      // No settings row at all = first time
      if (!settings) return true;

      // Settings exists but no password = first time
      if (!settings.admin_password) return true;

      // Password exists = NOT first time
      return false;
    } catch (e) {
      console.warn('[SetupWizard] isFirstTimeSetup check failed:', e.message);
      return false;
    }
  }

  /**
   * Show the Setup Wizard overlay.
   * @param {Function} onComplete - Called when setup is complete.
   */
  function show(onComplete) {
    _onComplete = onComplete;
    _renderWizard();
    // ✅ Pre-populate license key if pre-provisioned in deployment secrets
    setTimeout(() => {
      const preKey = window.WFA_SUPABASE_SECRETS?.licenseKey;
      const keyInput = document.getElementById('sw-license-key');
      if (preKey && keyInput && !keyInput.value) {
        keyInput.value = preKey;
        keyInput.style.borderColor = 'rgba(0,255,136,0.4)';
      }
    }, 100);
  }

  // ── Rendering ───────────────────────────────────────────────
  function _renderWizard() {
    // Remove if already exists
    document.getElementById('setup-wizard-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'setup-wizard-overlay';
    overlay.innerHTML = `
      <div class="sw-backdrop"></div>
      <div class="sw-modal">
        <div class="sw-logo">
          <div class="sw-logo-icon">🎓</div>
          <h1 class="sw-title">AcadeFlow Setup</h1>
          <p class="sw-subtitle">আপনার academy management system সক্রিয় করুন</p>
        </div>

        <!-- Step 1: License Key -->
        <div id="sw-step-1" class="sw-step active">
          <div class="sw-step-header">
            <span class="sw-step-num">১</span>
            <h2>License Key দিন</h2>
          </div>
          <p class="sw-step-desc">আপনার প্রদানকারীর কাছ থেকে পাওয়া license key-টি নিচে দিন।</p>
          <div class="sw-field">
            <label>🔑 License Key</label>
            <input type="text" id="sw-license-key" placeholder="WFA-XXXX-XXXX-YYYYMM-CS"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" />
          </div>
          <div id="sw-license-error" class="sw-error hidden"></div>
          <button id="sw-btn-validate" class="sw-btn-primary">
            <span class="sw-btn-text">✅ Validate License</span>
            <span class="sw-btn-loader hidden">⏳ যাচাই হচ্ছে…</span>
          </button>
        </div>

        <!-- Step 2: Admin Setup -->
        <div id="sw-step-2" class="sw-step hidden">
          <div class="sw-step-header">
            <span class="sw-step-num">২</span>
            <h2>Admin Account তৈরি করুন</h2>
          </div>
          <p class="sw-step-desc">আপনার academy-র admin পাসওয়ার্ড সেট করুন। এটি পরে পরিবর্তন করা যাবে।</p>
          <div class="sw-field">
            <label>🏫 Academy Name (ঐচ্ছিক)</label>
            <input type="text" id="sw-academy-name" placeholder="যেমন: Green Leaf Academy" autocomplete="off" />
          </div>
          <div class="sw-field">
            <label>🔐 Admin Password</label>
            <input type="password" id="sw-admin-password" placeholder="কমপক্ষে ৬ অক্ষর" autocomplete="new-password" />
          </div>
          <div class="sw-field">
            <label>🔐 Confirm Password</label>
            <input type="password" id="sw-admin-password-confirm" placeholder="পাসওয়ার্ড আবার দিন" autocomplete="new-password" />
          </div>
          <div id="sw-admin-error" class="sw-error hidden"></div>
          <button id="sw-btn-create-admin" class="sw-btn-primary">
            <span class="sw-btn-text">🚀 Setup Complete & Start</span>
            <span class="sw-btn-loader hidden">⏳ সেটআপ হচ্ছে…</span>
          </button>
        </div>

        <!-- Step 3: Success -->
        <div id="sw-step-3" class="sw-step hidden">
          <div class="sw-success-icon">🎉</div>
          <h2 class="sw-success-title">Setup সম্পন্ন!</h2>
          <p class="sw-success-desc">আপনার academy management system প্রস্তুত। এখন login করুন।</p>
          <div class="sw-license-badge" id="sw-success-info"></div>
          <button id="sw-btn-done" class="sw-btn-primary">▶ App চালু করুন</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    _injectStyles();
    _attachEvents();
  }

  // ── Event Handlers ──────────────────────────────────────────
  function _attachEvents() {
    // Step 1 — Validate License
    document.getElementById('sw-btn-validate').addEventListener('click', _validateLicense);
    document.getElementById('sw-license-key').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _validateLicense();
    });

    // Step 2 — Create Admin
    document.getElementById('sw-btn-create-admin').addEventListener('click', _createAdmin);

    // Step 3 — Done
    document.getElementById('sw-btn-done').addEventListener('click', () => {
      document.getElementById('setup-wizard-overlay')?.remove();
      if (typeof _onComplete === 'function') _onComplete();
    });
  }

  async function _validateLicense() {
    const keyInput  = document.getElementById('sw-license-key');
    const errorEl   = document.getElementById('sw-license-error');
    const btnText   = document.querySelector('#sw-btn-validate .sw-btn-text');
    const btnLoader = document.querySelector('#sw-btn-validate .sw-btn-loader');

    const key = (keyInput.value || '').trim().toUpperCase().replace(/\s/g, '');

    if (!key) {
      _showError(errorEl, 'License key দিন।');
      return;
    }

    // ── Customer Code binding check ──────────────────────────────
    // Key format: WFA-RAND-CODE-YYYYMM-CS  (index 2 = customer code)
    const secrets = window.WFA_SUPABASE_SECRETS;
    if (secrets && secrets.customerCode) {
      const parts = key.split('-');
      const codeInKey = parts.length >= 3 ? parts[2] : '';
      if (codeInKey !== secrets.customerCode) {
        _showError(errorEl,
          `এই license key এই deployment-এর জন্য নয়। ` +
          `আপনার provider থেকে "${secrets.customerCode}" কোডের key নিন।`
        );
        return;
      }
    }

    // Show loading
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    _hideError(errorEl);

    try {
      // Use LicenseEngine if available
      if (typeof LicenseEngine !== 'undefined' && LicenseEngine.validate) {
        const result = await LicenseEngine.validate(key);
        if (!result.ok) {
          const reasons = {
            tampered:        'এই license key টি বৈধ নয়।',
            expired:         'এই license key-এর মেয়াদ শেষ হয়ে গেছে।',
            revoked:         'এই license key টি বাতিল করা হয়েছে।',
            no_key:          'License key দিন।',
            no_connection:   '⚠️ License Server-এর সাথে সংযোগ হচ্ছে না। ইন্টারনেট চেক করে আবার চেষ্টা করুন।',
            server_required: '⚠️ এই key-টি Server-এ যাচাই করতে হবে। ইন্টারনেট সংযোগ নিশ্চিত করে আবার চেষ্টা করুন।',
          };
          _showError(errorEl, reasons[result.reason] || `License যাচাই ব্যর্থ: ${result.reason}`);
          return;
        }

        // Valid! Store key
        localStorage.setItem('wfa_license_key', key);
        window._sw_license_result = result;

        // Move to Step 2
        _goToStep(2);
        const nameInput = document.getElementById('sw-academy-name');
        if (nameInput && !nameInput.value) {
          const preset = window.WFA_SUPABASE_SECRETS?.academyName
            || result.academyName
            || result.customerName
            || '';
          if (preset) nameInput.value = preset;
        }
      } else {
        _showError(errorEl, 'License engine লোড হয়নি। পেজ রিফ্রেশ করুন।');
      }
    } catch (e) {
      _showError(errorEl, 'License যাচাই করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }


  async function _createAdmin() {
    const academyName    = (document.getElementById('sw-academy-name').value || '').trim();
    const password       = document.getElementById('sw-admin-password').value;
    const passwordConfirm = document.getElementById('sw-admin-password-confirm').value;
    const errorEl        = document.getElementById('sw-admin-error');
    const btnText        = document.querySelector('#sw-btn-create-admin .sw-btn-text');
    const btnLoader      = document.querySelector('#sw-btn-create-admin .sw-btn-loader');

    if (!password || password.length < 6) {
      _showError(errorEl, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (password !== passwordConfirm) {
      _showError(errorEl, 'পাসওয়ার্ড দুটো মিলছে না।');
      return;
    }

    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    _hideError(errorEl);

    try {
      const client = window.supabaseClient || (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.client);
      if (!client) throw new Error('Supabase সংযোগ নেই।');

      // Hash password (reuse App's _hashPw if available, else use subtle crypto)
      const hashPw = async (pw) => {
        try {
          const enc = new TextEncoder();
          const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
          // Fallback FNV for HTTP
          const salt = 'wfa_2026_';
          const salted = salt + pw + pw.length.toString(16);
          let h = 0x811c9dc5;
          for (let round = 0; round < 3; round++) {
            const input = round === 0 ? salted : salted + (h >>> 0).toString(16);
            for (let i = 0; i < input.length; i++) {
              h ^= input.charCodeAt(i);
              h = Math.imul(h, 0x01000193);
            }
          }
          return 'fb_' + (h >>> 0).toString(16).padStart(8, '0') + ((h >>> 0) ^ 0x9e3779b9 >>> 0).toString(16).padStart(8, '0');
        }
      };

      const hashedPw = await hashPw(password);

      // Insert settings row with admin password
      const { error } = await client
        .from('settings')
        .upsert([{
          id:            'main',
          admin_password: hashedPw,
          academy_name:  academyName || null,
          updated_at:    new Date().toISOString(),
        }], { onConflict: 'id' });

      if (error) throw new Error(error.message);

      if (academyName && typeof LicenseEngine !== 'undefined' && LicenseEngine.setAcademyName) {
        LicenseEngine.setAcademyName(academyName);
      }

      // ✅ Bootstrap Cash account — LOCAL-FIRST (IndexedDB) + cloud push.
      // AUDIT_IGNORE Section 7: শুধু এখানেই Cash account তৈরি হয়, অন্য কোথাও নয়।
      //
      // 🔴 FIX (2026-07-02): আগে এখানে সরাসরি `client.from('accounts').upsert()` দিয়ে
      // শুধু CLOUD-এ Cash account তৈরি হতো — লোকাল IndexedDB-তে কিছুই লেখা হতো না।
      // Setup wizard শেষ হয়ে সাথে সাথে app ব্যবহার শুরু করলে (student payment ইত্যাদি),
      // `_updateBalanceCoreInternal()` লোকাল `accounts` টেবিলে Cash account খুঁজে পেত না
      // (কারণ সেটা তখনো শুধু cloud-এ ছিল, পরের একটা full sync pull না হওয়া পর্যন্ত local-এ
      // নামেনি), তাই AUDIT_IGNORE Section 7-এর "auto-create করা যাবে না" নিয়ম মেনে
      // balance update চুপচাপ skip (return false) হয়ে যেত। ফলাফল: Finance Ledger-এ
      // payment entry ঠিকই রেকর্ড হতো (+৳1,000), কিন্তু Accounts/Dashboard balance ৳0-ই
      // থেকে যেত।
      //
      // ফিক্স: `SupabaseSync.insert()` ব্যবহার করা হচ্ছে, যেটা local IndexedDB-তে সাথে সাথে
      // লেখে এবং cloud-এ push/queue করে — দুটো এক লাইনে, race condition ছাড়াই।
      try {
        if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.getAll === 'function') {
          const existingAccounts = SupabaseSync.getAll('accounts') || [];
          const hasCash = existingAccounts.some(a =>
            a.type === 'Cash' && String(a.name || '').trim() === 'Cash'
          );
          if (!hasCash) {
            SupabaseSync.insert('accounts', { type: 'Cash', name: 'Cash', balance: 0 }, { bypassLog: true });
          }
        } else {
          // SupabaseSync লোড না থাকলে (edge case) — cloud-only fallback, আগের মতো।
          const { error: accErr } = await client
            .from('accounts')
            .upsert(
              [{ type: 'Cash', name: 'Cash', balance: 0 }],
              { onConflict: 'type,name', ignoreDuplicates: true }
            );
          if (accErr) {
            const { data: existingCash } = await client
              .from('accounts')
              .select('id')
              .eq('type', 'Cash')
              .eq('name', 'Cash')
              .limit(1);
            if (!existingCash || existingCash.length === 0) {
              const { error: insErr } = await client
                .from('accounts')
                .insert([{ type: 'Cash', name: 'Cash', balance: 0 }]);
              if (insErr) console.warn('[SetupWizard] Cash account seed failed:', insErr.message);
            }
          }
        }
      } catch (e) {
        console.warn('[SetupWizard] Cash account bootstrap error:', e.message);
      }
      // ✅ ensureDefaultCashAccount() এখানে কল করা হচ্ছে না — সেটা এখনো শুধু detect-only duplicate-checker

      // Success — show completion screen
      const licResult = window._sw_license_result || {};
      const infoEl = document.getElementById('sw-success-info');
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="sw-info-row">🔑 License: <strong>${localStorage.getItem('wfa_license_key') || ''}</strong></div>
          ${licResult.expires ? `<div class="sw-info-row">📅 Expires: <strong>${licResult.expires}</strong></div>` : ''}
          ${academyName ? `<div class="sw-info-row">🏫 Academy: <strong>${academyName}</strong></div>` : ''}
        `;
      }

      _goToStep(3);
    } catch (e) {
      _showError(errorEl, 'Setup ব্যর্থ হয়েছে: ' + e.message);
    } finally {
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  // ── Helpers ─────────────────────────────────────────────────
  function _goToStep(n) {
    document.querySelectorAll('.sw-step').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });
    const target = document.getElementById(`sw-step-${n}`);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }
  }

  function _showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function _hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  // ── Styles ──────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('setup-wizard-styles')) return;
    const style = document.createElement('style');
    style.id = 'setup-wizard-styles';
    style.textContent = `
      #setup-wizard-overlay {
        position: fixed; inset: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', 'Segoe UI', sans-serif;
      }
      .sw-backdrop {
        position: absolute; inset: 0;
        background: rgba(5, 8, 22, 0.92);
        backdrop-filter: blur(12px);
      }
      .sw-modal {
        position: relative; z-index: 1;
        background: linear-gradient(145deg, #0f1629 0%, #1a2040 100%);
        border: 1px solid rgba(120, 140, 255, 0.25);
        border-radius: 20px;
        padding: 40px 36px;
        width: 100%; max-width: 460px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(120,140,255,0.1);
        animation: sw-slidein 0.4s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes sw-slidein {
        from { opacity: 0; transform: translateY(30px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .sw-logo { text-align: center; margin-bottom: 28px; }
      .sw-logo-icon { font-size: 48px; margin-bottom: 8px; }
      .sw-title { font-size: 22px; font-weight: 700; color: #fff; margin: 0 0 4px; }
      .sw-subtitle { font-size: 13px; color: #8892b0; margin: 0; }

      .sw-step { animation: sw-fadein 0.3s ease; }
      @keyframes sw-fadein { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: none; } }
      .sw-step.hidden { display: none !important; }

      .sw-step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .sw-step-num {
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, #7c6fff, #4f8bff);
        color: #fff; font-weight: 700; font-size: 14px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .sw-step-header h2 { font-size: 18px; font-weight: 600; color: #e0e6ff; margin: 0; }
      .sw-step-desc { font-size: 13px; color: #8892b0; margin: 4px 0 20px; line-height: 1.5; }

      .sw-field { margin-bottom: 14px; }
      .sw-field label { display: block; font-size: 12px; font-weight: 600; color: #8892b0; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .sw-field input {
        width: 100%; padding: 10px 14px; border-radius: 10px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(120,140,255,0.2);
        color: #e0e6ff; font-size: 14px; outline: none; transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .sw-field input:focus { border-color: #7c6fff; background: rgba(124,111,255,0.08); }
      .sw-field input::placeholder { color: #4a5580; }

      .sw-btn-primary {
        width: 100%; padding: 13px; margin-top: 8px;
        background: linear-gradient(135deg, #7c6fff 0%, #4f8bff 100%);
        color: #fff; font-weight: 700; font-size: 15px; border: none;
        border-radius: 12px; cursor: pointer; transition: all 0.2s;
        position: relative;
      }
      .sw-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,111,255,0.4); }
      .sw-btn-primary:active { transform: translateY(0); }
      .sw-btn-loader { display: inline; }
      .sw-btn-loader.hidden, .sw-btn-text.hidden { display: none; }

      .sw-error {
        background: rgba(255, 80, 80, 0.1); border: 1px solid rgba(255,80,80,0.3);
        color: #ff7070; border-radius: 8px; padding: 8px 12px;
        font-size: 13px; margin-bottom: 10px;
      }
      .sw-error.hidden { display: none; }

      .sw-success-icon { font-size: 60px; text-align: center; margin-bottom: 12px; }
      .sw-success-title { font-size: 22px; font-weight: 700; color: #56cfb0; text-align: center; margin: 0 0 8px; }
      .sw-success-desc { font-size: 14px; color: #8892b0; text-align: center; margin: 0 0 20px; }
      .sw-license-badge {
        background: rgba(86,207,176,0.08); border: 1px solid rgba(86,207,176,0.2);
        border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;
      }
      .sw-info-row { font-size: 13px; color: #8892b0; margin-bottom: 4px; }
      .sw-info-row strong { color: #e0e6ff; }
    `;
    document.head.appendChild(style);
  }

  return { isFirstTimeSetup, show };
})();

window.SetupWizard = SetupWizard;
