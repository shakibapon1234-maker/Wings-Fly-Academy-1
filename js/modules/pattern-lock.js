// ============================================================
// Wings Fly Aviation Academy — Pattern Lock Module
// v3.0 — Added: confirm on register, Security Question + Backup PIN recovery
// ============================================================

const PatternLockModule = (() => {
  let modal = null;
  let activeNodes = [];
  let isDrawing = false;
  let currentMode = 'login'; // 'login' | 'register' | 'recovery'
  let _stopDrawingFn = null;
  let _stopDrawingTouchFn = null;
  // Register flow state
  let _firstPattern = null;
  let _confirmedPattern = null;
  let _registerStep = 'pattern'; // 'pattern' | 'question' | 'pin'

  // ── Styles ───────────────────────────────────────────────
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
      .pl-recovery-panel {
        display: none;
        flex-direction: column;
        gap: 14px;
        margin-top: 10px;
      }
      .pl-recovery-panel.active { display: flex; }
      .pl-input {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(0,217,255,0.3);
        border-radius: 10px;
        color: #fff;
        font-size: 0.95rem;
        padding: 10px 14px;
        width: 100%;
        box-sizing: border-box;
        outline: none;
        transition: border 0.2s;
      }
      .pl-input:focus { border-color: #00d4ff; }
      .pl-input::placeholder { color: rgba(255,255,255,0.35); }
      .pl-btn {
        padding: 10px 0;
        border-radius: 10px;
        border: none;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        width: 100%;
      }
      .pl-btn:hover { opacity: 0.85; }
      .pl-btn-primary { background: #00d4ff; color: #000; }
      .pl-btn-ghost {
        background: transparent;
        color: rgba(0,217,255,0.8);
        border: 1px solid rgba(0,217,255,0.3);
        margin-top: 6px;
        font-size: 0.85rem;
      }
      .pl-forgot-link {
        font-size: 0.8rem;
        color: rgba(0,217,255,0.7);
        cursor: pointer;
        margin-top: 2px;
        display: inline-block;
        text-decoration: underline;
      }
      .pl-forgot-link:hover { color: #00d4ff; }
      .pl-step-badge {
        display: inline-block;
        background: rgba(0,217,255,0.15);
        border: 1px solid rgba(0,217,255,0.3);
        border-radius: 20px;
        padding: 2px 12px;
        font-size: 0.75rem;
        color: #00d4ff;
        margin-bottom: 8px;
      }
      .pl-select {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(0,217,255,0.3);
        border-radius: 10px;
        color: #fff;
        font-size: 0.9rem;
        padding: 10px 14px;
        width: 100%;
        box-sizing: border-box;
        outline: none;
        appearance: none;
      }
      .pl-select option { background: #0a1428; color: #fff; }
    `;
    document.head.appendChild(style);
  }

  // ── Modal HTML ───────────────────────────────────────────
  function _buildModal() {
    modal = document.createElement('div');
    modal.className = 'pl-modal-backdrop';
    modal.innerHTML = `
      <div class="pl-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
          <div style="font-size:1.2rem; font-weight:700; color:#fff">
            <i class="fa fa-lock" style="color:#00d4ff"></i> Pattern Lock
          </div>
          <button onclick="PatternLockModule.close()" style="background:none;border:none;color:#aaa;font-size:1.2rem;cursor:pointer">✕</button>
        </div>

        <!-- Pattern grid view -->
        <div id="pl-pattern-view">
          <div id="pl-step-badge" class="pl-step-badge" style="display:none"></div>
          <div id="pl-status" class="pl-status" style="color:#00d4ff">Draw your pattern</div>
          <div class="pl-grid" id="pl-grid">
            <svg class="pl-svg" id="pl-svg"></svg>
            ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="pl-node" data-id="${i}"></div>`).join('')}
          </div>
          <div id="pl-forgot-wrap" style="display:none">
            <span class="pl-forgot-link" onclick="PatternLockModule._showRecoveryMenu()">🔑 Forgot Pattern?</span>
          </div>
        </div>

        <!-- Recovery menu -->
        <div id="pl-recovery-menu" style="display:none; margin-top:8px">
          <div style="color:#ffa502; font-weight:600; margin-bottom:14px">🔑 Pattern Recovery</div>
          <button class="pl-btn pl-btn-primary" style="margin-bottom:10px" onclick="PatternLockModule._showRecoveryPanel('question')">
            🛡️ Security Question দিয়ে
          </button>
          <button class="pl-btn pl-btn-primary" onclick="PatternLockModule._showRecoveryPanel('pin')">
            🔢 Backup PIN দিয়ে
          </button>
          <button class="pl-btn pl-btn-ghost" onclick="PatternLockModule._backToPattern()">← ফিরে যাও</button>
        </div>

        <!-- Recovery: Security Question -->
        <div id="pl-recovery-question" style="display:none; margin-top:8px">
          <div style="color:#00d4ff; font-weight:600; margin-bottom:14px">🛡️ Security Question</div>
          <div id="pl-sq-display" style="background:rgba(0,217,255,0.08); border-radius:10px; padding:12px; color:#fff; font-size:0.9rem; margin-bottom:12px; text-align:left"></div>
          <input id="pl-sq-answer-input" class="pl-input" type="text" placeholder="উত্তর লিখুন..." />
          <button class="pl-btn pl-btn-primary" style="margin-top:10px" onclick="PatternLockModule._verifySecurityQuestion()">✅ যাচাই করুন</button>
          <button class="pl-btn pl-btn-ghost" onclick="PatternLockModule._showRecoveryMenu()">← ফিরে যাও</button>
          <div id="pl-sq-error" style="color:#ff4757; font-size:0.85rem; margin-top:8px; min-height:20px"></div>
        </div>

        <!-- Recovery: Backup PIN -->
        <div id="pl-recovery-pin" style="display:none; margin-top:8px">
          <div style="color:#00d4ff; font-weight:600; margin-bottom:14px">🔢 Backup PIN</div>
          <input id="pl-pin-input" class="pl-input" type="password" inputmode="numeric" maxlength="6" placeholder="PIN লিখুন..." />
          <button class="pl-btn pl-btn-primary" style="margin-top:10px" onclick="PatternLockModule._verifyBackupPin()">✅ যাচাই করুন</button>
          <button class="pl-btn pl-btn-ghost" onclick="PatternLockModule._showRecoveryMenu()">← ফিরে যাও</button>
          <div id="pl-pin-error" style="color:#ff4757; font-size:0.85rem; margin-top:8px; min-height:20px"></div>
        </div>

        <!-- Recovery: Set new pattern after success -->
        <div id="pl-recovery-new-pattern" style="display:none; margin-top:8px">
          <div style="color:#00ff88; font-weight:600; margin-bottom:8px">✅ যাচাই সফল!</div>
          <div style="color:rgba(255,255,255,0.7); font-size:0.9rem; margin-bottom:16px">এখন নতুন প্যাটার্ন সেট করুন</div>
          <div id="pl-status-recovery" class="pl-status" style="color:#00d4ff">নতুন প্যাটার্ন আঁকুন</div>
          <div class="pl-grid" id="pl-grid-recovery">
            <svg class="pl-svg" id="pl-svg-recovery"></svg>
            ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="pl-node-r" data-id="${i}"></div>`).join('')}
          </div>
        </div>

        <!-- Register: Security Question setup -->
        <div id="pl-setup-question" style="display:none; margin-top:8px">
          <div class="pl-step-badge">ধাপ ২ / ৩ — Security Question</div>
          <div style="color:#fff; font-size:0.9rem; margin-bottom:14px; margin-top:8px">একটি গোপন প্রশ্ন ও উত্তর সেট করুন</div>
          <select id="pl-sq-select" class="pl-select">
            <option value="">— প্রশ্ন বেছে নিন —</option>
            <option value="আপনার মায়ের ডাকনাম কী?">আপনার মায়ের ডাকনাম কী?</option>
            <option value="আপনার প্রথম স্কুলের নাম কী?">আপনার প্রথম স্কুলের নাম কী?</option>
            <option value="আপনার জন্মশহরের নাম কী?">আপনার জন্মশহরের নাম কী?</option>
            <option value="আপনার প্রিয় শিক্ষকের নাম কী?">আপনার প্রিয় শিক্ষকের নাম কী?</option>
            <option value="আপনার শৈশবের বন্ধুর নাম কী?">আপনার শৈশবের বন্ধুর নাম কী?</option>
            <option value="custom">✏️ নিজে লিখুন...</option>
          </select>
          <input id="pl-sq-custom" class="pl-input" type="text" placeholder="নিজের প্রশ্ন লিখুন..." style="display:none; margin-top:10px" />
          <input id="pl-sq-answer" class="pl-input" type="text" placeholder="উত্তর লিখুন (মনে রাখবেন)..." style="margin-top:10px" />
          <button class="pl-btn pl-btn-primary" style="margin-top:12px" onclick="PatternLockModule._saveSecurityQuestion()">পরবর্তী →</button>
          <div id="pl-sq-setup-error" style="color:#ff4757; font-size:0.85rem; margin-top:8px; min-height:18px"></div>
        </div>

        <!-- Register: Backup PIN setup -->
        <div id="pl-setup-pin" style="display:none; margin-top:8px">
          <div class="pl-step-badge">ধাপ ৩ / ৩ — Backup PIN</div>
          <div style="color:#fff; font-size:0.9rem; margin-bottom:14px; margin-top:8px">৪–৬ ডিজিটের একটি backup PIN সেট করুন</div>
          <input id="pl-new-pin" class="pl-input" type="password" inputmode="numeric" maxlength="6" placeholder="PIN লিখুন (৪–৬ ডিজিট)..." />
          <input id="pl-new-pin-confirm" class="pl-input" type="password" inputmode="numeric" maxlength="6" placeholder="PIN আবার লিখুন..." style="margin-top:10px" />
          <button class="pl-btn pl-btn-primary" style="margin-top:12px" onclick="PatternLockModule._saveBackupPin()">✅ সম্পন্ন করুন</button>
          <div id="pl-pin-setup-error" style="color:#ff4757; font-size:0.85rem; margin-top:8px; min-height:18px"></div>
        </div>

      </div>
    `;
    document.body.appendChild(modal);
    _attachGridEvents();
    _attachRecoveryGridEvents();

    // Security question custom toggle
    document.getElementById('pl-sq-select').addEventListener('change', function() {
      const customInput = document.getElementById('pl-sq-custom');
      customInput.style.display = this.value === 'custom' ? 'block' : 'none';
    });
  }

  // ── Open ─────────────────────────────────────────────────
  function open(mode = 'login') {
    initStyles();
    currentMode = mode;
    activeNodes = [];
    isDrawing = false;
    _firstPattern = null;
    _confirmedPattern = null;
    _registerStep = 'pattern';

    if (!modal) _buildModal();

    // Hide all panels, show pattern view
    _showPanel('pl-pattern-view');

    const statusEl = document.getElementById('pl-status');
    const stepBadge = document.getElementById('pl-step-badge');
    const forgotWrap = document.getElementById('pl-forgot-wrap');

    resetGrid();

    if (mode === 'register') {
      stepBadge.style.display = 'inline-block';
      stepBadge.textContent = 'ধাপ ১ / ৩ — Pattern';
      statusEl.textContent = 'নতুন প্যাটার্ন আঁকুন (কমপক্ষে ৪ ডট)';
      forgotWrap.style.display = 'none';
    } else {
      stepBadge.style.display = 'none';
      statusEl.textContent = 'প্যাটার্ন আঁকুন';
      forgotWrap.style.display = isPatternRegistered() ? 'block' : 'none';
    }
    statusEl.style.color = '#00d4ff';
    modal.style.display = 'flex';
  }

  // ── Panel helper ─────────────────────────────────────────
  function _showPanel(id) {
    const panels = [
      'pl-pattern-view','pl-recovery-menu','pl-recovery-question',
      'pl-recovery-pin','pl-recovery-new-pattern','pl-setup-question','pl-setup-pin'
    ];
    panels.forEach(p => {
      const el = document.getElementById(p);
      if (el) el.style.display = (p === id) ? (p === 'pl-pattern-view' ? 'block' : 'block') : 'none';
    });
  }

  // ── Grid events (main) ───────────────────────────────────
  function _attachGridEvents() {
    const grid = document.getElementById('pl-grid');

    const startDrawing = (e) => { isDrawing = true; resetGrid(); handleMove(e); };
    const handleMove = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const el = document.elementFromPoint(clientX, clientY);
      if (el && el.classList.contains('pl-node')) {
        const id = el.getAttribute('data-id');
        if (!activeNodes.includes(id)) { activeNodes.push(id); el.classList.add('active'); drawLines(); }
      }
    };

    _stopDrawingFn = () => { if (!isDrawing) return; isDrawing = false; processPattern(); };
    _stopDrawingTouchFn = _stopDrawingFn;

    grid.addEventListener('mousedown', startDrawing);
    grid.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', _stopDrawingFn);
    grid.addEventListener('touchstart', startDrawing, { passive: false });
    grid.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', _stopDrawingTouchFn);
  }

  // ── Grid events (recovery new-pattern grid) ───────────────
  let _recoveryNodes = [];
  let _recoveryFirstPattern = null;
  let _recoveryDrawing = false;

  function _attachRecoveryGridEvents() {
    const grid = document.getElementById('pl-grid-recovery');

    const start = (e) => { _recoveryDrawing = true; _resetRecoveryGrid(); _rmove(e); };
    const _rmove = (e) => {
      if (!_recoveryDrawing) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const el = document.elementFromPoint(clientX, clientY);
      if (el && el.classList.contains('pl-node-r')) {
        const id = el.getAttribute('data-id');
        if (!_recoveryNodes.includes(id)) { _recoveryNodes.push(id); el.classList.add('active'); _drawRecoveryLines(); }
      }
    };
    const stop = () => { if (!_recoveryDrawing) return; _recoveryDrawing = false; _processRecoveryPattern(); };

    grid.addEventListener('mousedown', start);
    grid.addEventListener('mousemove', _rmove);
    window.addEventListener('mouseup', stop);
    grid.addEventListener('touchstart', start, { passive: false });
    grid.addEventListener('touchmove', _rmove, { passive: false });
    window.addEventListener('touchend', stop);
  }

  function _resetRecoveryGrid() {
    _recoveryNodes = [];
    document.querySelectorAll('.pl-node-r').forEach(n => n.classList.remove('active'));
    const svg = document.getElementById('pl-svg-recovery');
    if (svg) svg.innerHTML = '';
  }

  function _drawRecoveryLines() {
    const svg = document.getElementById('pl-svg-recovery');
    if (!svg || _recoveryNodes.length < 2) return;
    svg.innerHTML = '';
    for (let i = 0; i < _recoveryNodes.length - 1; i++) {
      const p1 = document.querySelector(`.pl-node-r[data-id="${_recoveryNodes[i]}"]`);
      const p2 = document.querySelector(`.pl-node-r[data-id="${_recoveryNodes[i+1]}"]`);
      if (!p1 || !p2) continue;
      const r1 = p1.getBoundingClientRect(), r2 = p2.getBoundingClientRect();
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

  function _processRecoveryPattern() {
    const statusEl = document.getElementById('pl-status-recovery');
    if (_recoveryNodes.length < 4) {
      statusEl.textContent = 'কমপক্ষে ৪ ডট সংযুক্ত করুন।';
      statusEl.style.color = '#ff4757';
      setTimeout(_resetRecoveryGrid, 1000);
      return;
    }
    const pattern = _recoveryNodes.join('-');
    if (_recoveryFirstPattern === null) {
      _recoveryFirstPattern = pattern;
      statusEl.textContent = 'আবার একই প্যাটার্ন আঁকুন (নিশ্চিত করুন) ✏️';
      statusEl.style.color = '#ffa502';
      setTimeout(_resetRecoveryGrid, 800);
    } else {
      if (_recoveryFirstPattern === pattern) {
        localStorage.setItem('wfa_admin_pattern', pattern);
        _recoveryFirstPattern = null;
        statusEl.textContent = 'নতুন প্যাটার্ন সেভ হয়েছে! ✅';
        statusEl.style.color = '#00ff88';
        if (typeof Utils !== 'undefined') Utils.toast('নতুন Pattern সেট হয়েছে!', 'success');
        setTimeout(() => { close(); triggerLoginSuccess(); }, 1500);
      } else {
        _recoveryFirstPattern = null;
        statusEl.textContent = 'প্যাটার্ন মিলছে না! আবার চেষ্টা করুন ❌';
        statusEl.style.color = '#ff4757';
        setTimeout(() => {
          _resetRecoveryGrid();
          statusEl.textContent = 'নতুন প্যাটার্ন আঁকুন';
          statusEl.style.color = '#00d4ff';
        }, 1200);
      }
    }
  }

  // ── Close ─────────────────────────────────────────────────
  function close() {
    if (modal) modal.style.display = 'none';
  }

  // ── Main grid helpers ─────────────────────────────────────
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
      const r1 = p1.getBoundingClientRect(), r2 = p2.getBoundingClientRect();
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

  // ── Process pattern (main grid) ───────────────────────────
  function processPattern() {
    const statusEl = document.getElementById('pl-status');
    if (activeNodes.length < 4) {
      statusEl.textContent = 'কমপক্ষে ৪ ডট সংযুক্ত করুন!';
      statusEl.style.color = '#ff4757';
      setTimeout(resetGrid, 1000);
      return;
    }
    const patternString = activeNodes.join('-');

    if (currentMode === 'register') {
      if (_firstPattern === null) {
        _firstPattern = patternString;
        statusEl.textContent = 'আবার একই প্যাটার্ন আঁকুন ✏️';
        statusEl.style.color = '#ffa502';
        setTimeout(resetGrid, 800);
      } else {
        if (_firstPattern === patternString) {
          _confirmedPattern = patternString;
          _firstPattern = null;
          statusEl.textContent = 'প্যাটার্ন নিশ্চিত হয়েছে ✅';
          statusEl.style.color = '#00ff88';
          setTimeout(() => _showSetupQuestion(), 900);
        } else {
          _firstPattern = null;
          statusEl.textContent = 'প্যাটার্ন মিলছে না! আবার শুরু করুন ❌';
          statusEl.style.color = '#ff4757';
          _shake();
          setTimeout(() => {
            resetGrid();
            statusEl.textContent = 'নতুন প্যাটার্ন আঁকুন (কমপক্ষে ৪ ডট)';
            statusEl.style.color = '#00d4ff';
          }, 1200);
        }
      }
    }
    else if (currentMode === 'login') {
      const savedPattern = localStorage.getItem('wfa_admin_pattern');
      if (savedPattern === patternString) {
        statusEl.textContent = 'প্যাটার্ন মিলেছে! ✅';
        statusEl.style.color = '#00ff88';
        setTimeout(() => { close(); triggerLoginSuccess(); }, 500);
      } else {
        statusEl.textContent = 'ভুল প্যাটার্ন!';
        statusEl.style.color = '#ff4757';
        _shake();
        setTimeout(resetGrid, 800);
      }
    }
  }

  // ── Register: setup security question ────────────────────
  function _showSetupQuestion() {
    _showPanel('pl-setup-question');
    document.getElementById('pl-sq-setup-error').textContent = '';
    document.getElementById('pl-sq-select').value = '';
    document.getElementById('pl-sq-answer').value = '';
    document.getElementById('pl-sq-custom').style.display = 'none';
  }

  function _saveSecurityQuestion() {
    const select = document.getElementById('pl-sq-select');
    const customInput = document.getElementById('pl-sq-custom');
    const answerInput = document.getElementById('pl-sq-answer');
    const errEl = document.getElementById('pl-sq-setup-error');

    let question = select.value === 'custom' ? customInput.value.trim() : select.value;
    const answer = answerInput.value.trim();

    if (!question) { errEl.textContent = 'একটি প্রশ্ন বেছে নিন বা লিখুন।'; return; }
    if (!answer) { errEl.textContent = 'উত্তর লিখতে হবে।'; return; }

    localStorage.setItem('wfa_security_question', question);
    localStorage.setItem('wfa_security_answer', answer.toLowerCase());

    errEl.textContent = '';
    _showSetupPin();
  }

  // ── Register: setup backup PIN ────────────────────────────
  function _showSetupPin() {
    _showPanel('pl-setup-pin');
    document.getElementById('pl-new-pin').value = '';
    document.getElementById('pl-new-pin-confirm').value = '';
    document.getElementById('pl-pin-setup-error').textContent = '';
  }

  function _saveBackupPin() {
    const pin = document.getElementById('pl-new-pin').value.trim();
    const pinConfirm = document.getElementById('pl-new-pin-confirm').value.trim();
    const errEl = document.getElementById('pl-pin-setup-error');

    if (!/^\d{4,6}$/.test(pin)) { errEl.textContent = 'PIN অবশ্যই ৪–৬ ডিজিটের সংখ্যা হতে হবে।'; return; }
    if (pin !== pinConfirm) { errEl.textContent = 'PIN দুটো মিলছে না!'; return; }

    localStorage.setItem('wfa_admin_pattern', _confirmedPattern);
    localStorage.setItem('wfa_backup_pin', pin);
    _confirmedPattern = null;

    errEl.textContent = '';
    if (typeof Utils !== 'undefined') Utils.toast('Pattern Lock সম্পূর্ণরূপে সেটআপ হয়েছে! ✅', 'success');
    setTimeout(close, 1500);
  }

  // ── Recovery flow ─────────────────────────────────────────
  function _showRecoveryMenu() {
    _showPanel('pl-recovery-menu');
  }

  function _showRecoveryPanel(type) {
    if (type === 'question') {
      const q = localStorage.getItem('wfa_security_question');
      if (!q) { alert('Security Question সেট করা নেই।'); return; }
      document.getElementById('pl-sq-display').textContent = '❓ ' + q;
      document.getElementById('pl-sq-answer-input').value = '';
      document.getElementById('pl-sq-error').textContent = '';
      _showPanel('pl-recovery-question');
    } else {
      document.getElementById('pl-pin-input').value = '';
      document.getElementById('pl-pin-error').textContent = '';
      _showPanel('pl-recovery-pin');
    }
  }

  function _verifySecurityQuestion() {
    const input = document.getElementById('pl-sq-answer-input').value.trim().toLowerCase();
    const saved = localStorage.getItem('wfa_security_answer');
    const errEl = document.getElementById('pl-sq-error');
    if (input === saved) {
      _showRecoveryNewPattern();
    } else {
      errEl.textContent = 'উত্তর সঠিক নয়। আবার চেষ্টা করুন।';
      document.getElementById('pl-sq-answer-input').value = '';
    }
  }

  function _verifyBackupPin() {
    const input = document.getElementById('pl-pin-input').value.trim();
    const saved = localStorage.getItem('wfa_backup_pin');
    const errEl = document.getElementById('pl-pin-error');
    if (input === saved) {
      _showRecoveryNewPattern();
    } else {
      errEl.textContent = 'PIN সঠিক নয়। আবার চেষ্টা করুন।';
      document.getElementById('pl-pin-input').value = '';
    }
  }

  function _showRecoveryNewPattern() {
    _recoveryFirstPattern = null;
    _resetRecoveryGrid();
    document.getElementById('pl-status-recovery').textContent = 'নতুন প্যাটার্ন আঁকুন';
    document.getElementById('pl-status-recovery').style.color = '#00d4ff';
    _showPanel('pl-recovery-new-pattern');
  }

  function _backToPattern() {
    _showPanel('pl-pattern-view');
    resetGrid();
  }

  // ── Shake animation ────────────────────────────────────────
  function _shake() {
    const box = document.querySelector('.pl-box');
    if (!box) return;
    box.style.transform = 'translateX(10px)';
    setTimeout(() => { box.style.transform = 'translateX(-10px)'; }, 100);
    setTimeout(() => { box.style.transform = 'translateX(0)'; }, 200);
  }

  // ── Login success ─────────────────────────────────────────
  function triggerLoginSuccess() {
    if (typeof App !== 'undefined') {
      if (window.SessionStore) SessionStore.setAdminSession();
      else {
        localStorage.setItem('wfa_logged_in', 'true');
        localStorage.setItem('wfa_login_time', String(Date.now()));
        localStorage.setItem('wfa_user_role', 'admin');
        localStorage.setItem('wfa_user_name', 'admin');
        localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
      }
      App.showApp(true);
      if (typeof Utils !== 'undefined') Utils.toast('Pattern Lock দিয়ে লগইন সফল ✅', 'success');
    }
  }

  function isPatternRegistered() {
    return !!localStorage.getItem('wfa_admin_pattern');
  }

  // Public API
  return {
    open, close, isPatternRegistered,
    _showRecoveryMenu, _showRecoveryPanel,
    _verifySecurityQuestion, _verifyBackupPin,
    _backToPattern,
    _saveSecurityQuestion, _saveBackupPin
  };
})();

window.PatternLockModule = PatternLockModule;
