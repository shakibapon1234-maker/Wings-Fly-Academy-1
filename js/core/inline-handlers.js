/**
 * inline-handlers.js
 * Extracted from index.html inline <script> blocks to satisfy CSP
 * (no 'unsafe-inline' needed when code is in external files).
 *
 * Contains:
 *  1. Service Worker registration (PWA)
 *  2. Animated background canvas (Growing Cells)
 *  3. SyncGuard badge click handler (replaces inline onclick)
 */

/* ── 1. Service Worker Registration ─────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function (reg) {
        console.log('Service Worker registered:', reg.scope);
      })
      .catch(function (err) {
        console.warn('Service Worker registration failed:', err);
      });
  });
}

/* ── 2. SyncGuard Badge click handler ───────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const badge = document.getElementById('syncguard-badge');
  if (badge) {
    badge.addEventListener('click', function () {
      if (typeof SettingsModule !== 'undefined') {
        if (typeof SettingsModule.openModal === 'function') {
          SettingsModule.openModal();
        }
        setTimeout(function () {
          if (typeof SettingsModule.switchTab === 'function') {
            SettingsModule.switchTab('syncguard');
          }
        }, 100);
      }
    });
  }
});

/* ── 3. Animated Background: Growing Cells ──────────────────── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, cells = [];
  let animFrameId = null;
  let isVisible = !document.hidden;
  const BG = '#0a0e27';
  // ✅ Phase 3: Reduced cell count from 26 → 18 to lower memory footprint
  const MAX_CELLS = 18;
  const COLORS = [
    { r: 0,   g: 217, b: 255 },   // cyan
    { r: 181, g: 55,  b: 242 },   // purple
    { r: 255, g: 255, b: 255 },   // white
    { r: 0,   g: 255, b: 200 },   // teal
  ];

  // ✅ Phase 3: Debounced resize to prevent excessive canvas re-allocations
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
    // ✅ Phase 3: Stop animation loop when page is hidden (prevents memory leak)
    if (!isVisible) { animFrameId = null; return; }

    ctx.clearRect(0, 0, W, H);

    // deep space base
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // subtle dot grid
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
        c.r     += c.speed;
        c.alpha  = Math.min(c.maxAlpha, c.alpha + 0.004);
        if (c.r >= c.maxR) c.growing = false;
      } else {
        c.r     += c.speed * 0.3;
        c.alpha -= 0.003;
        if (c.alpha <= 0) { cells[i] = makeCell(); return; }
      }

      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) ||
          !Number.isFinite(c.r) || c.r <= 0) {
        cells[i] = makeCell();
        return;
      }

      const { r: cr, g: cg, b: cb } = c.col;

      // filled radial gradient
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      grad.addColorStop(0,    `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(c.alpha * 0.35).toFixed(3)})`);
      grad.addColorStop(0.85, `rgba(${cr},${cg},${cb},${c.alpha.toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // bright ring edge
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(c.alpha * 2.2, 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // white highlight spark at ring peak
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
  // ✅ Phase 3: Use debounced resize handler
  window.addEventListener('resize', debouncedResize);

  // ✅ Phase 3: Pause/resume animation with Page Visibility API
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible && !animFrameId) {
      animFrameId = requestAnimationFrame(draw);
    }
  });

  draw();
})();
