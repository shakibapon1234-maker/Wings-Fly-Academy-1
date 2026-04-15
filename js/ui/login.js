// ============================================================
// Wings Fly Aviation Academy — Login UI
// ============================================================

const LoginUI = (() => {

  /* ── Safe helpers ─────────────────────────────────────── */
  function _getSettings() {
    // Helper: pick best settings row from parsed value (array or object)
    function _bestRow(parsed) {
      if (!parsed) return null;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows.find(r => r && r.security_question) ||
             rows.find(r => r && r.admin_password) ||
             (rows[0] && Object.keys(rows[0]).length > 0 ? rows[0] : null);
    }

    // Primary: try SupabaseSync in-memory DB (works right after save without reload)
    try {
      const sync = window.SupabaseSync;
      const db   = window.DB;
      if (sync && db && db.settings) {
        const row = _bestRow(sync.getAll(db.settings));
        if (row) return row;
      }
    } catch (e) { /* ignore */ }

    // Direct: try the known localStorage key 'wfa_settings' first (fastest after reload)
    try {
      const raw = localStorage.getItem('wfa_settings');
      if (raw) {
        const row = _bestRow(JSON.parse(raw));
        if (row) return row;
      }
    } catch (e) { /* ignore */ }

    // Fallback: scan all localStorage keys containing 'setting'
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.toLowerCase().includes('setting')) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const row = _bestRow(JSON.parse(raw));
            if (row && (row.security_question || row.admin_password)) return row;
          } catch(e2) { /* skip */ }
        }
      }
      // Broader scan: any wfa_ key that has security_question anywhere in its rows
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('wfa_')) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const row = _bestRow(JSON.parse(raw));
          if (row && row.security_question) return row;
        } catch(e2) { /* skip */ }
      }
    } catch (e) { /* ignore */ }

    return {};
  }

  /* ── Floating particle generator ──────────────────────────── */
  function spawnParticles() {
    const container = document.getElementById('login-particles');
    if (!container) return;
    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div');
      p.className = 'login-particle';
      const size = Math.random() * 3.5 + 1;
      const isLight = Math.random() > 0.5;
      p.style.cssText = `
        width:${size}px;height:${size}px;
        left:${Math.random() * 100}%;bottom:-10px;
        animation-duration:${Math.random() * 12 + 9}s;
        animation-delay:${Math.random() * 14}s;
        background:${isLight ? 'rgba(0,160,255,0.75)' : 'rgba(0,80,220,0.65)'};
        box-shadow:0 0 ${size*4}px ${isLight ? 'rgba(0,160,255,0.65)' : 'rgba(0,100,255,0.55)'};
      `;
      container.appendChild(p);
    }
  }

  /* ── Eye toggle ───────────────────────────────────────────── */
  function initEyeToggle() {
    const toggle  = document.getElementById('login-eye-toggle');
    const pwInput = document.getElementById('login-password');
    const icon    = document.getElementById('login-eye-icon');
    if (!toggle || !pwInput) return;
    toggle.addEventListener('click', () => {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'fa fa-eye-slash' : 'fa fa-eye';
    });
  }

  /* ── Forgot password modal ────────────────────────────────── */
  function showForgotModal() {
    const modal = document.getElementById('forgot-pw-modal');
    const body  = document.getElementById('forgot-pw-body');
    if (!modal || !body) return;

    const settings = _getSettings();
    const qMap = {
      pet:       'What is the name of your first pet?',
      city:      'In what city were you born?',
      school:    'What is the name of your first school?',
      childhood: 'What was your childhood nickname?'
    };
    const question = qMap[settings.security_question || ''] || '';

    if (!question) {
      /* ── No security question configured yet ── */
      body.innerHTML = `
        <div style="text-align:center;padding:4px 0 12px">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,170,0,0.12);
                      border:1px solid rgba(255,170,0,0.35);display:inline-flex;align-items:center;
                      justify-content:center;margin-bottom:12px">
            <i class="fa fa-triangle-exclamation" style="color:#ffaa00;font-size:1.3rem"></i>
          </div>
          <div style="font-weight:700;color:#fff;font-size:.95rem;margin-bottom:6px">
            No Recovery Question Set
          </div>
          <div style="color:rgba(255,255,255,0.45);font-size:.8rem;line-height:1.55;margin-bottom:18px">
            A security question has not been configured yet.<br/>
            Set one up inside <strong style="color:#00d9ff">Settings &rarr; Security</strong> after logging in.
          </div>
        </div>

        <div style="background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.18);
                    border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:.78rem;color:#00d9ff;font-weight:700;letter-spacing:.4px;margin-bottom:8px">
            <i class="fa fa-key" style="margin-right:6px;opacity:.8"></i>MASTER PIN RECOVERY
          </div>
          <div style="font-size:.8rem;color:rgba(255,255,255,0.5);margin-bottom:12px;line-height:1.5">
            Enter the master PIN (current admin password) to confirm your identity and reveal it.
          </div>
          <div style="position:relative">
            <input type="password" id="master-pin-input" placeholder="Enter master PIN"
              onkeydown="if(event.key==='Enter')LoginUI.checkMasterPin()"
              style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.35);
                     border:1.5px solid rgba(0,217,255,0.22);border-radius:10px;
                     color:#fff;font-size:.9rem;padding:11px 44px 11px 14px;
                     outline:none;font-family:var(--font-ui);" />
            <i class="fa fa-eye" id="master-pin-eye"
               style="position:absolute;right:13px;top:50%;transform:translateY(-50%);
                      color:rgba(0,217,255,0.5);cursor:pointer;font-size:.85rem"
               onclick="const p=document.getElementById('master-pin-input');
                        p.type=p.type==='password'?'text':'password';
                        document.getElementById('master-pin-eye').className=
                        p.type==='password'?'fa fa-eye':'fa fa-eye-slash';"></i>
          </div>
          <div id="master-pin-result" style="min-height:24px;margin-top:10px;font-size:.8rem;text-align:center"></div>
          <button onclick="LoginUI.checkMasterPin()" style="
            margin-top:10px;width:100%;background:linear-gradient(90deg,#0055cc,#0099ff);
            border:none;border-radius:10px;color:#fff;font-weight:800;padding:12px;
            cursor:pointer;font-size:.88rem;letter-spacing:.4px;font-family:var(--font-ui);
          "><i class="fa fa-unlock-keyhole"></i>&nbsp; Verify PIN</button>
        </div>

        <div style="text-align:center;font-size:.75rem;color:rgba(255,255,255,0.25)">
          Default master PIN is
          <code style="color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.06);
                       padding:1px 6px;border-radius:4px">admin123</code>
          if it has never been changed
        </div>`;
    } else {
      /* ── Security question configured — show it ── */
      body.innerHTML = `
        <p style="font-size:.82rem;color:rgba(255,255,255,0.5);margin-bottom:14px;line-height:1.5">
          Answer your security question to view your password.
        </p>
        <div style="background:rgba(0,217,255,0.07);border:1px solid rgba(0,217,255,0.22);
                    border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:.83rem;color:#00d9ff;">
          <i class="fa fa-circle-question" style="margin-right:6px;opacity:.7"></i>${question}
        </div>
        <input type="text" id="forgot-answer-input" placeholder="Your answer"
          onkeydown="if(event.key==='Enter')LoginUI.checkSecurityAnswer()"
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);
                 border:1.5px solid rgba(0,217,255,0.22);border-radius:10px;
                 color:#fff;font-size:.9rem;padding:11px 14px;outline:none;
                 margin-bottom:14px;font-family:var(--font-ui);" />
        <div id="forgot-result" style="min-height:28px;margin-bottom:10px;font-size:.83rem;text-align:center"></div>
        <button onclick="LoginUI.checkSecurityAnswer()" style="
          width:100%;background:linear-gradient(90deg,#00a8f0,#1565ff);border:none;
          border-radius:10px;color:#fff;font-weight:800;padding:13px;cursor:pointer;
          font-size:.9rem;letter-spacing:.5px;font-family:var(--font-ui);
        "><i class="fa fa-unlock-keyhole"></i>&nbsp; Verify Answer</button>`;
    }

    modal.classList.remove('hidden');
    setTimeout(() => { const f = body.querySelector('input'); if (f) f.focus(); }, 120);
  }

  function closeForgotModal() {
    const m = document.getElementById('forgot-pw-modal');
    if (m) m.classList.add('hidden');
  }

  /* ── Security-question verify ─────────────────────────────── */
  function checkSecurityAnswer() {
    const input  = document.getElementById('forgot-answer-input');
    const result = document.getElementById('forgot-result');
    if (!input || !result) return;

    const settings = _getSettings();
    const correct  = (settings.security_answer || '').trim().toLowerCase();
    const given    = (input.value || '').trim().toLowerCase();

    if (!given) {
      result.innerHTML = `<span style="color:#ff6b7a">Please enter your answer.</span>`;
      return;
    }
    if (given === correct) {
      // SECURITY: পাসওয়ার্ড কখনো দেখানো হবে না — শুধু reset করতে বলো
      result.innerHTML = `
        <div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);
                    border-radius:8px;padding:10px 14px;color:#00ff88;text-align:left">
          <i class="fa fa-check-circle" style="margin-right:6px"></i>
          Correct answer! For security, your password cannot be displayed.
          <div style="margin-top:8px;font-size:.82rem;color:#aaa">
            Please go to <strong style="color:#fff">Settings → Change Password</strong> to set a new password.
          </div>
        </div>`;
    } else {
      result.innerHTML = `<span style="color:#ff6b7a">
        <i class="fa fa-xmark" style="margin-right:4px"></i>Incorrect answer. Try again.
      </span>`;
      input.style.borderColor = 'rgba(255,71,87,0.6)';
      setTimeout(() => { input.style.borderColor = 'rgba(0,217,255,0.22)'; }, 1500);
    }
  }

  /* ── Master PIN verify (fallback when no security question) ── */
  async function checkMasterPin() {
    const input  = document.getElementById('master-pin-input');
    const result = document.getElementById('master-pin-result');
    if (!input || !result) return;

    const settings  = _getSettings();
    const masterPin = settings.admin_password || 'admin123';
    const given     = (input.value || '').trim();

    if (!given) {
      result.innerHTML = `<span style="color:#ff6b7a">Please enter the master PIN.</span>`;
      return;
    }

    // ✅ Support both plaintext and SHA-256 hashed passwords
    const _isHashed = (s) => /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');
    let match = false;
    if (_isHashed(masterPin)) {
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(given));
        const inputHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
        match = inputHash === masterPin;
      } catch (e) {
        // Fallback non-crypto hash (same as app.js _hashPw)
        let hash = 0;
        for (let i = 0; i < given.length; i++) { hash = ((hash << 5) - hash) + given.charCodeAt(i); hash |= 0; }
        match = ('fb_' + Math.abs(hash).toString(16)) === masterPin;
      }
    } else {
      match = given === masterPin;
    }

    if (match) {
      result.innerHTML = `
        <div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);
                    border-radius:8px;padding:10px 14px;color:#00ff88;text-align:left">
          <i class="fa fa-check-circle" style="margin-right:6px"></i>
          Verified! You can now change your password in <strong style="color:#fff">Settings → Change Password</strong>.
        </div>`;
    } else {
      result.innerHTML = `<span style="color:#ff6b7a">
        <i class="fa fa-xmark" style="margin-right:4px"></i>Incorrect PIN. Try again.
      </span>`;
      input.style.borderColor = 'rgba(255,71,87,0.6)';
      setTimeout(() => { input.style.borderColor = 'rgba(0,217,255,0.22)'; }, 1500);
    }
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    spawnParticles();
    initEyeToggle();
    setTimeout(() => {
      const u = document.getElementById('login-username');
      if (u) u.focus();
    }, 350);
    const modal = document.getElementById('forgot-pw-modal');
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) closeForgotModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { showForgotModal, closeForgotModal, checkSecurityAnswer, checkMasterPin };
})();
window.LoginUI = LoginUI;
