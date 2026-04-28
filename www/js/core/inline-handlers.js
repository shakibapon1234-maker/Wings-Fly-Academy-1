/**
 * inline-handlers.js  — Wings Fly Academy
 * ===========================================
 * Replaces ALL inline onclick="" attributes from index.html.
 * This file keeps the CSP clean: no 'unsafe-inline' needed.
 *
 * Sections:
 *  1. Service Worker Registration (PWA)
 *  2. Animated Background Canvas (Growing Cells)
 *  3. DOM-ready: all button event listeners
 */

/* ══════════════════════════════════════════════════════
   1. SERVICE WORKER REGISTRATION
══════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function (reg) {
        console.log('[SW] Registered:', reg.scope);
      })
      .catch(function (err) {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

/* ══════════════════════════════════════════════════════
   2. ANIMATED BACKGROUND: Growing Cells
══════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, cells = [];
  let animFrameId = null;
  let isVisible = !document.hidden;
  const BG = '#0a0e27';
  const MAX_CELLS = 18;
  const COLORS = [
    { r: 0,   g: 217, b: 255 },  // cyan
    { r: 181, g: 55,  b: 242 },  // purple
    { r: 255, g: 255, b: 255 },  // white
    { r: 0,   g: 255, b: 200 },  // teal
  ];

  let resizeTimer = null;
  function resize() {
    W = Math.max(1, window.innerWidth  || 1);
    H = Math.max(1, window.innerHeight || 1);
    canvas.width  = W;
    canvas.height = H;
  }
  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  function makeCell() {
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:        Number.isFinite(W) ? Math.random() * W : 0,
      y:        Number.isFinite(H) ? Math.random() * H : 0,
      r:        Math.random() * 3 + 1,
      maxR:     Math.random() * 200 + 70,
      speed:    Math.random() * 0.4 + 0.18,
      col,
      alpha:    0,
      maxAlpha: Math.random() * 0.18 + 0.1,
      growing:  true,
      delay:    Math.random() * 250 | 0,
    };
  }

  for (let i = 0; i < MAX_CELLS; i++) cells.push(makeCell());

  function draw() {
    if (!isVisible) { animFrameId = null; return; }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(0,217,255,0.06)';
    const G = 45;
    for (let x = G; x < W; x += G)
      for (let y = G; y < H; y += G) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

    cells.forEach((c, i) => {
      if (c.delay > 0) { c.delay--; return; }
      if (c.growing) {
        c.r    += c.speed;
        c.alpha = Math.min(c.maxAlpha, c.alpha + 0.004);
        if (c.r >= c.maxR) c.growing = false;
      } else {
        c.r    += c.speed * 0.3;
        c.alpha -= 0.003;
        if (c.alpha <= 0) { cells[i] = makeCell(); return; }
      }
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) ||
          !Number.isFinite(c.r) || c.r <= 0) {
        cells[i] = makeCell(); return;
      }
      const { r: cr, g: cg, b: cb } = c.col;
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      grad.addColorStop(0,    `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(c.alpha * 0.35).toFixed(3)})`);
      grad.addColorStop(0.85, `rgba(${cr},${cg},${cb},${c.alpha.toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(c.alpha * 2.2, 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (c.growing) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(c.alpha * 1.5, 0.25).toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    });

    animFrameId = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', debouncedResize);
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible && !animFrameId) animFrameId = requestAnimationFrame(draw);
  });
  draw();
})();

/* ══════════════════════════════════════════════════════
   3. DOM-READY: ALL BUTTON EVENT LISTENERS
   (replaces every onclick="..." removed from index.html)
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── Helper: safe call ── */
  function safe(fn) {
    return function (e) {
      try { fn(e); } catch (err) { console.warn('[Handler]', err); }
    };
  }

  /* ── Login: Face ID ── */
  const faceIdBtn = document.getElementById('face-id-login-btn');
  if (faceIdBtn) {
    faceIdBtn.addEventListener('click', safe(function () {
      if (typeof FaceIDModule !== 'undefined') FaceIDModule.openScannerModal('login');
    }));
  }

  /* ── Login: Pattern Lock ── */
  const patternBtn = document.getElementById('pattern-lock-login-btn');
  if (patternBtn) {
    patternBtn.addEventListener('click', safe(function () {
      if (typeof PatternLockModule !== 'undefined') PatternLockModule.open('login');
    }));
  }

  /* ── Login: Forgot Password ── */
  const forgotBtn = document.getElementById('btn-forgot-pw');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', safe(function () {
      if (typeof LoginUI !== 'undefined') LoginUI.showForgotModal();
    }));
  }

  /* ── Login: Close Forgot Modal ── */
  const forgotClose = document.getElementById('btn-forgot-close');
  if (forgotClose) {
    forgotClose.addEventListener('click', safe(function () {
      if (typeof LoginUI !== 'undefined') LoginUI.closeForgotModal();
    }));
  }

  /* ── Topbar: Notification Bell → Finance ── */
  const notifBtn = document.getElementById('btn-notif');
  if (notifBtn) {
    notifBtn.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.navigateTo('finance');
    }));
  }

  /* ── Topbar: Logout ── */
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.logout();
    }));
  }

  /* ── Quick Add: Student ── */
  const qaStudent = document.getElementById('btn-quick-student');
  if (qaStudent) {
    qaStudent.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.quickAction('student');
    }));
  }

  /* ── Quick Add: Transaction ── */
  const qaTransaction = document.getElementById('btn-quick-transaction');
  if (qaTransaction) {
    qaTransaction.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.quickAction('transaction');
    }));
  }

  /* ── Quick Add: Exam ── */
  const qaExam = document.getElementById('btn-quick-exam');
  if (qaExam) {
    qaExam.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.quickAction('exam');
    }));
  }

  /* ── Quick Add: Visitor ── */
  const qaVisitor = document.getElementById('btn-quick-visitor');
  if (qaVisitor) {
    qaVisitor.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.quickAction('visitor');
    }));
  }

  /* ── Loans: Add Loan ── */
  const addLoanBtn = document.getElementById('btn-add-loan');
  if (addLoanBtn) {
    addLoanBtn.addEventListener('click', safe(function () {
      if (typeof Loans !== 'undefined') Loans.openAddModal();
    }));
  }

  /* ── Notice Board: Close (go to dashboard) ── */
  const noticeClose = document.getElementById('btn-notice-close');
  if (noticeClose) {
    noticeClose.addEventListener('click', safe(function () {
      if (typeof App !== 'undefined') App.navigateTo('dashboard');
    }));
  }

  /* ── Global Modal: Close ── */
  const modalClose = document.getElementById('btn-modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', safe(function () {
      if (typeof Utils !== 'undefined') Utils.closeModal();
    }));
  }

  /* ── SyncGuard Badge ── */
  const syncguardBadge = document.getElementById('syncguard-badge');
  if (syncguardBadge) {
    syncguardBadge.addEventListener('click', safe(function () {
      if (typeof SettingsModule !== 'undefined') {
        if (typeof SettingsModule.openModal === 'function') SettingsModule.openModal();
        setTimeout(function () {
          if (typeof SettingsModule.switchTab === 'function') SettingsModule.switchTab('syncguard');
        }, 100);
      }
    }));
  }

});
