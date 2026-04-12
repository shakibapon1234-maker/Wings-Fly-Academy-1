// ============================================================
// Wings Fly Aviation Academy — Login UI
// ============================================================

const LoginUI = (() => {

  /* Floating particle generator */
  function spawnParticles() {
    const container = document.getElementById('login-particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'login-particle';
      const size = Math.random() * 3 + 1;
      const isPurple = Math.random() > 0.6;
      p.style.cssText = `
        width:${size}px;height:${size}px;
        left:${Math.random() * 100}%;bottom:-10px;
        animation-duration:${Math.random() * 10 + 8}s;
        animation-delay:${Math.random() * 12}s;
        background:${isPurple ? 'rgba(181,55,242,0.7)' : 'rgba(0,217,255,0.65)'};
        box-shadow:0 0 ${size*3}px ${isPurple ? 'rgba(181,55,242,0.6)' : 'rgba(0,217,255,0.6)'};
      `;
      container.appendChild(p);
    }
  }

  /* Eye toggle */
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

  /* Forgot password modal */
  function showForgotModal() {
    const modal = document.getElementById('forgot-pw-modal');
    const body  = document.getElementById('forgot-pw-body');
    if (!modal || !body) return;

    const settings = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const qMap = {
      pet: "What is the name of your first pet?",
      city: "In what city were you born?",
      school: "What is the name of your first school?",
      childhood: "What was your childhood nickname?"
    };
    const question = qMap[settings.security_question || ''] || '';

    if (!question) {
      body.innerHTML = `<div style="color:rgba(255,255,255,0.55);font-size:.85rem;text-align:center;padding:10px 0">
        <i class="fa fa-triangle-exclamation" style="color:#ffaa00;font-size:1.4rem;display:block;margin-bottom:10px"></i>
        No security question configured.<br/>Contact your administrator.
      </div>`;
    } else {
      body.innerHTML = `
        <p style="font-size:.82rem;color:rgba(255,255,255,0.5);margin-bottom:14px;line-height:1.5">
          Answer your security question to view your password hint.
        </p>
        <div style="background:rgba(0,217,255,0.07);border:1px solid rgba(0,217,255,0.22);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:.83rem;color:#00d9ff;">
          <i class="fa fa-circle-question" style="margin-right:6px;opacity:.7"></i>${question}
        </div>
        <input type="text" id="forgot-answer-input" placeholder="Your answer" style="
          width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(0,217,255,0.22);border-radius:10px;
          color:#fff;font-size:.9rem;padding:11px 14px;outline:none;
          margin-bottom:14px;font-family:var(--font-ui);
        "/>
        <div id="forgot-result" style="min-height:28px;margin-bottom:10px;font-size:.83rem;text-align:center"></div>
        <button onclick="LoginUI.checkSecurityAnswer()" style="
          width:100%;background:linear-gradient(90deg,#00a8f0,#1565ff);border:none;
          border-radius:10px;color:#fff;font-weight:800;padding:13px;cursor:pointer;
          font-size:.9rem;letter-spacing:.5px;font-family:var(--font-ui);
        "><i class="fa fa-unlock-keyhole"></i> Verify Answer</button>`;
    }
    modal.classList.remove('hidden');
  }

  function closeForgotModal() {
    const m = document.getElementById('forgot-pw-modal');
    if (m) m.classList.add('hidden');
  }

  function checkSecurityAnswer() {
    const input  = document.getElementById('forgot-answer-input');
    const result = document.getElementById('forgot-result');
    if (!input || !result) return;
    const settings = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const correct  = (settings.security_answer || '').trim().toLowerCase();
    const given    = (input.value || '').trim().toLowerCase();
    if (!given) { result.innerHTML = `<span style="color:#ff6b7a">Please enter your answer.</span>`; return; }
    if (given === correct) {
      const pw = settings.admin_password || 'admin123';
      result.innerHTML = `<div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:8px;padding:10px 14px;color:#00ff88;text-align:left">
        <i class="fa fa-check-circle" style="margin-right:6px"></i>
        Correct! Password: <strong style="font-family:monospace;letter-spacing:1px;color:#fff;font-size:1rem">${pw}</strong>
      </div>`;
    } else {
      result.innerHTML = `<span style="color:#ff6b7a"><i class="fa fa-xmark" style="margin-right:4px"></i>Incorrect. Try again.</span>`;
      input.style.borderColor = 'rgba(255,71,87,0.6)';
      setTimeout(() => { input.style.borderColor = 'rgba(0,217,255,0.22)'; }, 1500);
    }
  }

  /* Init */
  function init() {
    spawnParticles();
    initEyeToggle();
    setTimeout(() => { const u = document.getElementById('login-username'); if (u) u.focus(); }, 350);
    const modal = document.getElementById('forgot-pw-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeForgotModal(); });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { showForgotModal, closeForgotModal, checkSecurityAnswer };
})();
