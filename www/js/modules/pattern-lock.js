// ============================================================
// Wings Fly Aviation Academy — Pattern Lock Module
// Fixed bugs:
// - mouseup/touchend listeners leaking after modal close
// - duplicate event listeners on re-open
// ============================================================

const PatternLockModule = (() => {
  let modal = null;
  let activeNodes = [];
  let isDrawing = false;
  let currentMode = 'login';
  // FIX: keep references to listeners so they can be removed
  let _stopDrawingFn = null;
  let _stopDrawingTouchFn = null;

  function initStyles() {
    if (document.getElementById('pattern-lock-styles')) return;
    const style = document.createElement('style');
    style.id = 'pattern-lock-styles';
    style.innerHTML = `
      .pl-modal-backdrop {
        display: none; position: fixed; inset: 0; z-index: 999999;
        background: rgba(0, 5, 20, 0.85); backdrop-filter: blur(10px);
        align-items: center; justify-content: center;
      }
      .pl-box {
        background: rgba(10, 20, 40, 0.95);
        border: 1px solid rgba(0, 217, 255, 0.3);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0, 217, 255, 0.1);
        padding: 30px;
        text-align: center;
        width: 340px;
        transition: transform 0.1s ease;
      }
      .pl-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 25px;
        width: 250px;
        margin: 30px auto;
        position: relative;
        touch-action: none;
        user-select: none;
      }
      .pl-node {
        width: 100%;
        padding-bottom: 100%;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pl-node::after {
        content: '';
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 12px; height: 12px;
        background: #fff;
        border-radius: 50%;
        opacity: 0.5;
        transition: all 0.2s ease;
      }
      .pl-node.active {
        background: rgba(0, 217, 255, 0.2);
        box-shadow: 0 0 15px rgba(0, 217, 255, 0.4);
      }
      .pl-node.active::after {
        background: #00d4ff;
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.5);
      }
      .pl-svg {
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none; z-index: 10;
      }
      .pl-line { stroke: #00d4ff; stroke-width: 4; stroke-linecap: round; opacity: 0.8; }
      .pl-status { font-size: 0.95rem; margin-bottom: 10px; font-weight: 600; min-height: 24px; }
    `;
    document.head.appendChild(style);
  }

  function open(mode = 'login') {
    initStyles();
    currentMode = mode;
    activeNodes = [];
    isDrawing = false;

    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'pl-modal-backdrop';
      modal.innerHTML = `
        <div class="pl-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
             <div style="font-size:1.2rem; font-weight:700; color:#fff"><i class="fa fa-lock" style="color:#00d4ff"></i> Pattern Lock</div>
             <button onclick="PatternLockModule.close()" style="background:none;border:none;color:#aaa;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div id="pl-status" class="pl-status" style="color:var(--text-muted)">Draw your pattern</div>
          <div class="pl-grid" id="pl-grid">
             <svg class="pl-svg" id="pl-svg"></svg>
             ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="pl-node" data-id="${i}"></div>`).join('')}
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      _attachGridEvents();
    }

    resetGrid();
    document.getElementById('pl-status').textContent = mode === 'register' ? 'Draw a new pattern (min 4 dots)' : 'Draw your pattern to unlock';
    document.getElementById('pl-status').style.color = '#00d4ff';
    modal.style.display = 'flex';
  }

  function _attachGridEvents() {
    const grid = document.getElementById('pl-grid');

    const startDrawing = (e) => {
      isDrawing = true;
      resetGrid();
      handleMove(e);
    };

    const handleMove = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const el = document.elementFromPoint(clientX, clientY);
      if (el && el.classList.contains('pl-node')) {
        const id = el.getAttribute('data-id');
        if (!activeNodes.includes(id)) {
          activeNodes.push(id);
          el.classList.add('active');
          drawLines();
        }
      }
    };

    // FIX: store stopDrawing reference so we can remove it later
    _stopDrawingFn = () => { if (!isDrawing) return; isDrawing = false; processPattern(); };
    _stopDrawingTouchFn = _stopDrawingFn;

    grid.addEventListener('mousedown', startDrawing);
    grid.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', _stopDrawingFn);

    grid.addEventListener('touchstart', startDrawing, { passive: false });
    grid.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', _stopDrawingTouchFn);
  }

  function close() {
    if (modal) modal.style.display = 'none';

    // FIX: remove global listeners to prevent memory leak
    if (_stopDrawingFn) {
      window.removeEventListener('mouseup', _stopDrawingFn);
      window.removeEventListener('touchend', _stopDrawingTouchFn);
      _stopDrawingFn = null;
      _stopDrawingTouchFn = null;
    }
  }

  function resetGrid() {
    activeNodes = [];
    document.querySelectorAll('.pl-node').forEach(n => n.classList.remove('active'));
    const svg = document.getElementById('pl-svg');
    if (svg) svg.innerHTML = '';
  }

  function drawLines() {
    const svg = document.getElementById('pl-svg');
    if (!svg || activeNodes.length < 2) return;
    svg.innerHTML = '';
    for (let i = 0; i < activeNodes.length - 1; i++) {
      const p1 = document.querySelector(`.pl-node[data-id="${activeNodes[i]}"]`);
      const p2 = document.querySelector(`.pl-node[data-id="${activeNodes[i+1]}"]`);
      if (!p1 || !p2) continue;
      const r1 = p1.getBoundingClientRect();
      const r2 = p2.getBoundingClientRect();
      const gr = svg.getBoundingClientRect();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', r1.left - gr.left + r1.width / 2);
      line.setAttribute('y1', r1.top  - gr.top  + r1.height / 2);
      line.setAttribute('x2', r2.left - gr.left + r2.width / 2);
      line.setAttribute('y2', r2.top  - gr.top  + r2.height / 2);
      line.setAttribute('class', 'pl-line');
      svg.appendChild(line);
    }
  }

  function processPattern() {
    const statusEl = document.getElementById('pl-status');
    if (activeNodes.length < 4) {
      statusEl.textContent = 'Too short! Connect at least 4 dots.';
      statusEl.style.color = '#ff4757';
      setTimeout(resetGrid, 1000);
      return;
    }

    const patternString = activeNodes.join('-');

    if (currentMode === 'register') {
      localStorage.setItem('wfa_admin_pattern', patternString);
      statusEl.textContent = 'Pattern saved! ✅';
      statusEl.style.color = '#00ff88';
      if (typeof Utils !== 'undefined') Utils.toast('Pattern Lock enabled! Use it on the login page.', 'success');
      setTimeout(close, 1500);
    }
    else if (currentMode === 'login') {
      const savedPattern = localStorage.getItem('wfa_admin_pattern');
      if (savedPattern === patternString) {
        statusEl.textContent = 'Pattern Matched! ✅';
        statusEl.style.color = '#00ff88';
        setTimeout(() => { close(); triggerLoginSuccess(); }, 500);
      } else {
        statusEl.textContent = 'Incorrect Pattern!';
        statusEl.style.color = '#ff4757';
        // shake animation
        const box = document.querySelector('.pl-box');
        if (box) {
          box.style.transform = 'translateX(10px)';
          setTimeout(() => { box.style.transform = 'translateX(-10px)'; }, 100);
          setTimeout(() => { box.style.transform = 'translateX(0)'; }, 200);
        }
        setTimeout(resetGrid, 800);
      }
    }
  }

  function triggerLoginSuccess() {
    if (typeof App !== 'undefined') {
      localStorage.setItem('wfa_logged_in', 'true');
      localStorage.setItem('wfa_user_role', 'admin');
      localStorage.setItem('wfa_user_name', 'admin');
      localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
      App.showApp(true);
      if (typeof Utils !== 'undefined') Utils.toast('Logged in via Pattern Lock ✅', 'success');
    }
  }

  return { open, close };
})();

window.PatternLockModule = PatternLockModule;
