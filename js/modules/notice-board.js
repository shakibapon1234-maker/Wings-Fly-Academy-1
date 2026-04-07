// ============================================================
// notice-board.js — বাংলা Notice Board Module
// Wings Fly Aviation Academy
// ============================================================

const NoticeBoardModule = (() => {
  let notices = [];
  let timerInterval = null;

  const TYPES = {
    warning:  { label: 'সতর্কতা',  icon: '⚠️', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
    info:     { label: 'তথ্য',     icon: 'ℹ️', color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
    urgent:   { label: 'জরুরি',   icon: '🚨', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
    success:  { label: 'সফলতা',   icon: '✅', color: '#22c55e', bg: '#f0fdf4', border: '#86efac' },
  };

  // Preset durations (ms)
  const DURATIONS = {
    '30m':  30 * 60 * 1000,
    '1h':   60 * 60 * 1000,
    '3h':   3 * 60 * 60 * 1000,
    '6h':   6 * 60 * 60 * 1000,
    '12h':  12 * 60 * 60 * 1000,
    '1d':   24 * 60 * 60 * 1000,
    '3d':   3 * 24 * 60 * 60 * 1000,
    '1w':   7 * 24 * 60 * 60 * 1000,
    'never': null,
  };

  const DURATION_LABELS = {
    '30m': '৩০ মিনিট', '1h': '১ ঘন্টা', '3h': '৩ ঘন্টা',
    '6h': '৬ ঘন্টা', '12h': '১২ ঘন্টা', '1d': '১ দিন',
    '3d': '৩ দিন', '1w': '১ সপ্তাহ', 'never': 'মেয়াদ নেই',
  };

  // ── Load / Save ───────────────────────────────────────────
  function load() {
    notices = Utils.storage('wfa_notices') || [];
    purgeExpired();
    startTimer();
  }

  function save() {
    Utils.storage('wfa_notices', notices);
    SyncEngine.markDirty('notices');
  }

  // ── CRUD ──────────────────────────────────────────────────
  function add(data) {
    const durMs = DURATIONS[data.duration] !== undefined ? DURATIONS[data.duration] : DURATIONS['1d'];
    const expiresAt = durMs ? new Date(Date.now() + durMs).toISOString() : null;

    const notice = {
      id: Utils.uid('NOT'),
      title: data.title?.trim() || '',
      body: data.body?.trim() || '',
      type: data.type || 'info',
      duration: data.duration || '1d',
      expiresAt,
      pinned: !!data.pinned,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy || 'Admin',
    };
    notices.unshift(notice);
    save();
    return notice;
  }

  function update(id, data) {
    const idx = notices.findIndex(n => n.id === id);
    if (idx === -1) return false;
    // If duration changed, recalculate expiry
    if (data.duration && data.duration !== notices[idx].duration) {
      const durMs = DURATIONS[data.duration] !== undefined ? DURATIONS[data.duration] : DURATIONS['1d'];
      data.expiresAt = durMs ? new Date(Date.now() + durMs).toISOString() : null;
    }
    notices[idx] = { ...notices[idx], ...data, updatedAt: new Date().toISOString() };
    save();
    return notices[idx];
  }

  function remove(id) {
    notices = notices.filter(n => n.id !== id);
    save();
  }

  function togglePin(id) {
    const n = notices.find(n => n.id === id);
    if (n) { n.pinned = !n.pinned; save(); }
  }

  function getAll() {
    purgeExpired();
    return [...notices].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getActive() {
    return getAll().filter(n => !isExpired(n));
  }

  // ── Expiry Helpers ────────────────────────────────────────
  function isExpired(n) {
    if (!n.expiresAt) return false;
    return new Date(n.expiresAt) < new Date();
  }

  function purgeExpired() {
    const before = notices.length;
    notices = notices.filter(n => !isExpired(n) || n.pinned);
    if (notices.length !== before) save();
  }

  function timeRemaining(n) {
    if (!n.expiresAt) return 'মেয়াদ নেই';
    const ms = new Date(n.expiresAt) - Date.now();
    if (ms <= 0) return 'মেয়াদ শেষ';
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} দিন বাকি`;
    if (hours > 0) return `${hours} ঘন্টা বাকি`;
    return `${mins} মিনিট বাকি`;
  }

  // ── Timer (auto-purge & UI refresh) ──────────────────────
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      purgeExpired();
      // Re-render if notice board section visible
      const section = document.getElementById('section-notice-board');
      if (section && !section.classList.contains('hidden')) {
        renderNoticeBoard();
      }
    }, 60 * 1000); // every minute
  }

  // ── Render ────────────────────────────────────────────────
  function renderNoticeBoard(containerId = 'notice-board-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const list = getActive();

    if (list.length === 0) {
      container.innerHTML = `<div class="notice-empty">কোনো সক্রিয় নোটিস নেই</div>`;
      return;
    }

    container.innerHTML = list.map(n => {
      const t = TYPES[n.type] || TYPES.info;
      return `
<div class="notice-card ${n.type} ${n.pinned ? 'pinned' : ''}" data-id="${n.id}"
  style="border-left:4px solid ${t.border}; background:${t.bg}">
  <div class="notice-card-header">
    <span class="notice-type-badge" style="color:${t.color}">${t.icon} ${t.label}</span>
    ${n.pinned ? '<span class="notice-pin-badge">📌 পিন করা</span>' : ''}
    <span class="notice-time-remaining" style="color:${t.color}">${timeRemaining(n)}</span>
  </div>
  ${n.title ? `<div class="notice-title">${n.title}</div>` : ''}
  <div class="notice-body">${n.body.replace(/\n/g, '<br>')}</div>
  <div class="notice-card-footer">
    <span class="notice-meta">— ${n.createdBy} | ${Utils.formatDate(n.createdAt)}</span>
    <div class="notice-actions">
      <button class="btn-icon" onclick="NoticeBoardModule.togglePin('${n.id}');NoticeBoardModule.renderNoticeBoard()" title="পিন/আনপিন">📌</button>
      <button class="btn-icon" onclick="NoticeBoardModule.openEdit('${n.id}')" title="সম্পাদনা">✏️</button>
      <button class="btn-icon danger" onclick="NoticeBoardModule.confirmDelete('${n.id}')" title="মুছুন">🗑️</button>
    </div>
  </div>
</div>`;
    }).join('');
  }

  // ── UI Helpers ────────────────────────────────────────────
  function openEdit(id) {
    const n = notices.find(n => n.id === id);
    if (!n) return;
    document.getElementById('notice-edit-id').value = n.id;
    document.getElementById('notice-type').value = n.type;
    document.getElementById('notice-title').value = n.title;
    document.getElementById('notice-body').value = n.body;
    document.getElementById('notice-duration').value = n.duration;
    document.getElementById('notice-pinned').checked = n.pinned;
    document.getElementById('notice-modal-title').textContent = 'নোটিস সম্পাদনা';
    Utils.openModal('notice-modal');
  }

  function confirmDelete(id) {
    if (confirm('এই নোটিস মুছে ফেলবেন?')) {
      remove(id);
      renderNoticeBoard();
    }
  }

  return {
    load, add, update, remove, togglePin, getAll, getActive,
    renderNoticeBoard, openEdit, confirmDelete,
    TYPES, DURATIONS, DURATION_LABELS, timeRemaining,
  };
})();
