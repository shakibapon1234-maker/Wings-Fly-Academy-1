/* ============================================================
   Wings Fly Academy — Student Portal Background Engine
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, cells = [];
  let animFrameId = null;
  let isVisible = !document.hidden;
  const BG = '#080c14'; // Match theme-dark bg
  const MAX_CELLS = 18;
  const COLORS = [
    { r: 0,   g: 217, b: 255 },  // Cyan
    { r: 245, g: 158, b: 11 },   // Amber
    { r: 255, g: 255, b: 255 },  // White
    { r: 59,  g: 130, b: 246 },  // Blue
  ];

  let resizeTimer = null;
  let pendingResize = false;
  function resize() {
    pendingResize = false;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    if (w === W && h === H) return;
    W = Math.max(1, w);
    H = Math.max(1, h);
    canvas.width = W;
    canvas.height = H;
  }
  function debouncedResize() {
    if (pendingResize) return;
    pendingResize = true;
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

    ctx.fillStyle = 'rgba(0,217,255,0.05)';
    const G = 45;
    for (let x = G; x < W; x += G) {
      for (let y = G; y < H; y += G) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
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

  function startAnimation() {
    resize();
    window.addEventListener('resize', debouncedResize);
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !animFrameId) animFrameId = requestAnimationFrame(draw);
    });
    draw();
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(startAnimation, { timeout: 2000 });
  } else {
    setTimeout(startAnimation, 300);
  }
})();
