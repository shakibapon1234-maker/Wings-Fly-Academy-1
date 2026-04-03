/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * AVIATION LOADING SCREEN — v1.0
 * ════════════════════════════════════════════════════════════════
 *
 * Login → Dashboard যাওয়ার সময় একটি সুন্দর বিমান animation দেখায়।
 * আসল loading সময়কে hide করে user experience উন্নত করে।
 *
 * ব্যবহার:
 *   WingsLoader.show();          // loading শুরু
 *   WingsLoader.hide();          // loading শেষ
 *   WingsLoader.showThen(fn);    // show করো, fn শেষে auto-hide
 *
 * ════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const LOADER_ID = 'wf-aviation-loader';

  const MESSAGES = [
    'Preparing your dashboard...',
    'Loading student records...',
    'Syncing flight data...',
    'Checking financial logs...',
    'Almost ready for takeoff...',
    'Connecting to cloud...',
    'Finalizing your workspace...',
  ];

  function _buildHTML() {
    return `
<div id="${LOADER_ID}" style="
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: linear-gradient(160deg, #020818 0%, #050d2a 50%, #0a0520 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Segoe UI', sans-serif;
  transition: opacity 0.5s ease;
  opacity: 0;
">

  <!-- Stars background -->
  <canvas id="wf-stars-canvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>

  <!-- Logo area -->
  <div style="position:relative;z-index:2;text-align:center;margin-bottom:48px;">
    <div style="
      width: 72px; height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(0,217,255,0.15), rgba(181,55,242,0.15));
      border: 1.5px solid rgba(0,217,255,0.35);
      display: flex; align-items: center; justify-content: center;
      font-size: 36px;
      margin: 0 auto 16px;
      box-shadow: 0 0 30px rgba(0,217,255,0.12);
    ">✈️</div>
    <div style="color:#deeeff;font-size:1.05rem;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Wings Fly Aviation Academy</div>
    <div style="color:rgba(0,200,255,0.45);font-size:0.72rem;letter-spacing:1.5px;margin-top:4px;text-transform:uppercase;">Management System</div>
  </div>

  <!-- Runway + plane animation -->
  <div style="position:relative;z-index:2;width:340px;margin-bottom:36px;">

    <!-- Runway -->
    <div style="
      position:relative;
      height:4px;
      background: rgba(255,255,255,0.08);
      border-radius:2px;
      overflow:visible;
    ">
      <!-- Runway dashes -->
      <div style="
        position:absolute;
        top:0; left:0; right:0; bottom:0;
        background: repeating-linear-gradient(
          90deg,
          rgba(0,217,255,0.3) 0px, rgba(0,217,255,0.3) 24px,
          transparent 24px, transparent 48px
        );
        border-radius:2px;
        animation: wf-runway 1.2s linear infinite;
      "></div>

      <!-- Progress fill -->
      <div id="wf-progress-fill" style="
        position:absolute;
        top:0; left:0; height:100%;
        width:0%;
        background: linear-gradient(90deg, #00d9ff, #b537f2);
        border-radius:2px;
        transition: width 0.4s ease;
        box-shadow: 0 0 8px rgba(0,217,255,0.5);
      "></div>

      <!-- Plane -->
      <div id="wf-plane" style="
        position:absolute;
        top: -14px;
        left: 0%;
        font-size: 28px;
        transform: translateX(-50%);
        transition: left 0.4s ease;
        filter: drop-shadow(0 0 6px rgba(0,217,255,0.6));
        animation: wf-bob 1.8s ease-in-out infinite;
        line-height: 1;
      ">✈</div>
    </div>

    <!-- Percent -->
    <div style="
      display:flex; justify-content:space-between;
      margin-top:12px;
    ">
      <div id="wf-percent" style="color:rgba(0,217,255,0.7);font-size:0.75rem;font-weight:600;letter-spacing:1px;">0%</div>
      <div style="color:rgba(255,255,255,0.2);font-size:0.75rem;">100%</div>
    </div>
  </div>

  <!-- Status message -->
  <div id="wf-loader-msg" style="
    position:relative;z-index:2;
    color:rgba(180,210,255,0.6);
    font-size:0.8rem;
    letter-spacing:0.8px;
    min-height:20px;
    text-align:center;
    transition: opacity 0.3s ease;
  ">Preparing your dashboard...</div>

  <!-- Dots -->
  <div style="position:relative;z-index:2;display:flex;gap:6px;margin-top:20px;">
    <div style="width:5px;height:5px;border-radius:50%;background:rgba(0,217,255,0.6);animation:wf-dot 1.2s ease-in-out infinite;"></div>
    <div style="width:5px;height:5px;border-radius:50%;background:rgba(0,217,255,0.6);animation:wf-dot 1.2s ease-in-out 0.2s infinite;"></div>
    <div style="width:5px;height:5px;border-radius:50%;background:rgba(0,217,255,0.6);animation:wf-dot 1.2s ease-in-out 0.4s infinite;"></div>
  </div>

  <style>
    @keyframes wf-bob {
      0%,100% { transform: translateX(-50%) translateY(0); }
      50%      { transform: translateX(-50%) translateY(-5px); }
    }
    @keyframes wf-runway {
      from { background-position: 0 0; }
      to   { background-position: -48px 0; }
    }
    @keyframes wf-dot {
      0%,80%,100% { opacity: 0.3; transform: scale(0.8); }
      40%          { opacity: 1;   transform: scale(1.2); }
    }
    @keyframes wf-star-twinkle {
      0%,100% { opacity: 0.2; }
      50%      { opacity: 0.9; }
    }
  </style>
</div>`;
  }

  function _drawStars(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = 120;
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
      });
    }
    let running = true;
    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const alpha = 0.2 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,220,255,${alpha.toFixed(2)})`;
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return function stopStars() { running = false; };
  }

  let _stopStars = null;
  let _progressTimer = null;
  let _msgTimer = null;
  let _msgIndex = 0;
  let _currentProgress = 0;

  function _setProgress(pct) {
    _currentProgress = Math.min(pct, 100);
    const fill  = document.getElementById('wf-progress-fill');
    const plane = document.getElementById('wf-plane');
    const pctEl = document.getElementById('wf-percent');
    if (fill)  fill.style.width = _currentProgress + '%';
    if (plane) plane.style.left = _currentProgress + '%';
    if (pctEl) pctEl.textContent = Math.round(_currentProgress) + '%';
  }

  function _nextMessage() {
    const el = document.getElementById('wf-loader-msg');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function () {
      _msgIndex = (_msgIndex + 1) % MESSAGES.length;
      el.textContent = MESSAGES[_msgIndex];
      el.style.opacity = '1';
    }, 300);
  }

  function _startAutoProgress(durationMs) {
    // Smooth fake progress: 0 → 85% over durationMs, then holds
    const start = Date.now();
    const target = 85;
    clearInterval(_progressTimer);
    _progressTimer = setInterval(function () {
      const elapsed = Date.now() - start;
      const pct = target * (1 - Math.exp(-4 * elapsed / durationMs));
      _setProgress(pct);
      if (pct >= target - 0.5) clearInterval(_progressTimer);
    }, 60);

    // Message rotation every 1.8s
    clearInterval(_msgTimer);
    _msgIndex = 0;
    _msgTimer = setInterval(_nextMessage, 1800);
  }

  function _stopTimers() {
    clearInterval(_progressTimer);
    clearInterval(_msgTimer);
  }

  // ── PUBLIC API ─────────────────────────────────────────────────

  window.WingsLoader = {

    show: function (estimatedMs) {
      if (document.getElementById(LOADER_ID)) return; // already shown
      estimatedMs = estimatedMs || 3500;

      document.body.insertAdjacentHTML('beforeend', _buildHTML());
      const el = document.getElementById(LOADER_ID);

      // Fade in
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.style.opacity = '1'; });
      });

      // Stars
      _stopStars = _drawStars(document.getElementById('wf-stars-canvas'));

      // Auto progress
      _startAutoProgress(estimatedMs);
    },

    setProgress: function (pct) {
      _setProgress(pct);
    },

    hide: function () {
      const el = document.getElementById(LOADER_ID);
      if (!el) return;

      _stopTimers();
      if (_stopStars) { _stopStars(); _stopStars = null; }

      // Finish the bar before hiding
      _setProgress(100);
      setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 500);
      }, 300);
    },

    // Show loader, run async fn, then hide
    showThen: async function (asyncFn, estimatedMs) {
      WingsLoader.show(estimatedMs || 3500);
      try {
        await asyncFn();
      } finally {
        WingsLoader.hide();
      }
    },
  };

  console.log('✈️ WingsLoader ready');
})();
