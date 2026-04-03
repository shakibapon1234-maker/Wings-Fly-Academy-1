// sections/notice-board.js
// Wings Fly Aviation Academy

// NOTICE BOARD SYSTEM - Wings Fly Aviation Academy
// =====================================================

var NOTICE_STORAGE_KEY = 'wingsfly_notice_board';
var noticeCountdownInterval = null;

// =====================================================
// NOTICE BOARD - CORE STORAGE (sync-safe)
// Notice সবসময় globalData.settings.activeNotice এ থাকবে
// localStorage শুধু cache হিসেবে ব্যবহার হবে
// =====================================================

function _noticeSave(notice) {
  // globalData এ রাখো (primary source of truth)
  try {
    if (!window.globalData) window.globalData = {};
    if (!window.globalData.settings) window.globalData.settings = {};
    if (notice) {
      window.globalData.settings.activeNotice = notice;
    } else {
      delete window.globalData.settings.activeNotice;
    }
    // localStorage cache update
    if (notice) {
      localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(notice));
    } else {
      localStorage.removeItem(NOTICE_STORAGE_KEY);
    }
    // wingsfly_data save → monitor trigger → cloud push
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    // Immediate cloud push (bypass debounce)
    if (typeof window.wingsSync?.pushNow === 'function') {
      window.wingsSync.pushNow(notice ? 'Notice Published' : 'Notice Deleted');
    } else if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush(notice ? 'Notice Published' : 'Notice Deleted');
    }
  } catch (e) { console.warn('Notice save error:', e); }
}

function _noticeRead() {
  // Priority: globalData > localStorage
  try {
    // ✅ FIX: Check if notice was manually deleted — if so, block sync restore
    const clearedAt = parseInt(localStorage.getItem('wings_notice_cleared_at') || '0');

    const gd = window.globalData?.settings?.activeNotice;
    if (gd && gd.expiresAt) {
      // ✅ FIX: If notice was created BEFORE the delete timestamp, reject it
      if (clearedAt > 0 && (gd.createdAt || 0) <= clearedAt) {
        // Stale notice from sync — remove it
        delete window.globalData.settings.activeNotice;
        return null;
      }
      if (Date.now() < gd.expiresAt) {
        // Sync to localStorage
        localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(gd));
        return gd;
      } else {
        // Expired — clean up both places
        _noticeSave(null);
        return null;
      }
    }
    // Fallback: localStorage
    const raw = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!raw) return null;
    const n = JSON.parse(raw);
    if (!n || !n.expiresAt) return null;
    // ✅ FIX: Block stale localStorage notice too
    if (clearedAt > 0 && (n.createdAt || 0) <= clearedAt) {
      localStorage.removeItem(NOTICE_STORAGE_KEY);
      return null;
    }
    if (Date.now() > n.expiresAt) {
      localStorage.removeItem(NOTICE_STORAGE_KEY);
      return null;
    }
    // Restore to globalData from localStorage
    if (window.globalData?.settings) {
      window.globalData.settings.activeNotice = n;
    }
    return n;
  } catch (e) { return null; }
}

function updateSidebarNoticeDot(hasActive) {
  const dot = document.getElementById('sidebarNoticeActiveDot');
  if (dot) dot.style.display = hasActive ? 'inline-block' : 'none';
}

// ----- Load & Display on page init -----
function initNoticeBoard() {
  const notice = _noticeRead();
  if (notice) {
    showNoticeBanner(notice);
  } else {
    hideNoticeBanner();
  }
}

function getActiveNotice() {
  return _noticeRead();
}

function showNoticeBanner(notice) {
  const banner = document.getElementById('noticeBoardBanner');
  const addBtn = document.getElementById('noticeBoardAddBtn');
  const textEl = document.getElementById('noticeBannerText');
  if (!banner || !textEl) return;

  textEl.textContent = notice.text;
  banner.className = '';
  banner.className = 'notice-' + (notice.type || 'warning');
  banner.style.display = 'block';
  if (addBtn) addBtn.style.display = 'none';

  updateSidebarNoticeDot(true);
  startCountdown(notice.expiresAt);
}

function hideNoticeBanner() {
  const banner = document.getElementById('noticeBoardBanner');
  const addBtn = document.getElementById('noticeBoardAddBtn');
  if (banner) banner.style.display = 'none';
  if (addBtn) addBtn.style.display = 'block';
  updateSidebarNoticeDot(false);
  if (noticeCountdownInterval) {
    clearInterval(noticeCountdownInterval);
    noticeCountdownInterval = null;
  }
}

let _countdownExpiresAt = null;

function updateCountdown() {
  const remaining = (_countdownExpiresAt || 0) - Date.now();
  if (remaining <= 0) {
    clearInterval(noticeCountdownInterval);
    localStorage.removeItem(NOTICE_STORAGE_KEY);
    hideNoticeBanner();
    return;
  }
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  let label = '';
  if (d > 0) label = `${d}দ ${h}ঘ ${m}মি`;
  else if (h > 0) label = `${h}ঘ ${m}মি ${s}সে`;
  else label = `${m}মি ${s}সে`;

  const el = document.getElementById('noticeTimeLeft');
  if (el) el.textContent = label;
}

function startCountdown(expiresAt) {
  if (noticeCountdownInterval) clearInterval(noticeCountdownInterval);
  _countdownExpiresAt = expiresAt;
  updateCountdown();
  noticeCountdownInterval = setInterval(updateCountdown, 1000);
}

// ----- Modal -----
function openNoticeModal() {
  // Show current notice status
  const notice = getActiveNotice();
  const statusCard = document.getElementById('currentNoticeStatus');
  const noActiveMsg = document.getElementById('noActiveNoticeMsg');

  if (notice) {
    if (statusCard) statusCard.style.display = 'block';
    if (noActiveMsg) noActiveMsg.style.display = 'none';
    const textEl = document.getElementById('currentNoticeText');
    const expEl = document.getElementById('currentNoticeExpire');
    if (textEl) textEl.textContent = notice.text;
    if (expEl) {
      const remaining = notice.expiresAt - Date.now();
      const d = Math.floor(remaining / 86400000);
      const h = Math.floor((remaining % 86400000) / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      let label = '';
      if (d > 0) label = `${d} দিন ${h} ঘণ্টা বাকি`;
      else if (h > 0) label = `${h} ঘণ্টা ${m} মিনিট বাকি`;
      else label = `${m} মিনিট বাকি`;
      expEl.textContent = `⏳ মেয়াদ: ${label}`;
    }
  } else {
    if (statusCard) statusCard.style.display = 'none';
    if (noActiveMsg) noActiveMsg.style.display = 'block';
  }

  // Reset form
  const textInput = document.getElementById('noticeTextInput');
  if (textInput) textInput.value = '';
  const charCount = document.getElementById('noticeCharCount');
  if (charCount) charCount.textContent = '0';
  const preview = document.getElementById('noticePreviewArea');
  if (preview) preview.style.display = 'none';

  // Char counter
  if (textInput) {
    textInput.oninput = function () {
      if (charCount) charCount.textContent = this.value.length;
    };
  }

  // Modal খোলো
  try {
    var modalEl = document.getElementById('noticeBoardModal');
    if (!modalEl) {
      console.warn('[NoticeBoard] noticeBoardModal element পাওয়া যায়নি — index.html check করুন');
      return;
    }
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    } else {
      // Bootstrap fallback
      modalEl.style.display = 'block';
      modalEl.classList.add('show');
      document.body.classList.add('modal-open');
      var backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = '_noticeBackdrop';
      document.body.appendChild(backdrop);
    }
  } catch (e) {
    console.error('[NoticeBoard] Modal open error:', e);
  }
}

function toggleCustomDuration() {
  const sel = document.getElementById('noticeDurationSelect');
  const row = document.getElementById('customDurationRow');
  if (!sel || !row) return;
  row.style.display = sel.value === 'custom' ? 'flex' : 'none';
}

function previewNotice() {
  const text = document.getElementById('noticeTextInput')?.value?.trim();
  if (!text) { showErrorToast('নোটিসের বিষয়বস্তু লিখুন!'); return; }
  const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
  const previewBanner = document.getElementById('noticePreviewBanner');
  const previewText = document.getElementById('noticePreviewText');
  const previewArea = document.getElementById('noticePreviewArea');

  if (previewBanner) {
    previewBanner.className = 'notice-preview-banner';
    if (type === 'danger') previewBanner.classList.add('preview-danger');
    else if (type === 'info') previewBanner.classList.add('preview-info');
    else if (type === 'success') previewBanner.classList.add('preview-success');
  }
  if (previewText) previewText.textContent = text;
  if (previewArea) previewArea.style.display = 'block';
}

// Safe toast helper for notice system
function noticeToast(msg, type) {
  try {
    if (type === 'error' && typeof showErrorToast === 'function') { showErrorToast(msg); return; }
    if (typeof showSuccessToast === 'function') { showSuccessToast(msg); return; }
  } catch (e) { }
  // Fallback: simple alert-style
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;background:${type === 'error' ? '#dc2626' : '#16a34a'};color:#fff;padding:12px 24px;border-radius:12px;font-weight:700;font-size:0.95rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Safe modal close helper
function closeNoticeModal() {
  const modalEl = document.getElementById('noticeBoardModal');
  if (!modalEl) return;
  try {
    let m = bootstrap.Modal.getInstance(modalEl);
    if (!m) m = bootstrap.Modal.getOrCreateInstance(modalEl);
    m.hide();
  } catch (e) {
    // fallback: hide manually
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
  }
}

function publishNotice() {
  const text = document.getElementById('noticeTextInput')?.value?.trim();
  if (!text) { noticeToast('নোটিসের বিষয়বস্তু লিখুন!', 'error'); return; }

  const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
  const durSel = document.getElementById('noticeDurationSelect');
  let durationMinutes = 720;

  if (durSel?.value === 'custom') {
    const d = parseInt(document.getElementById('customDays')?.value) || 0;
    const h = parseInt(document.getElementById('customHours')?.value) || 0;
    const m = parseInt(document.getElementById('customMinutes')?.value) || 0;
    durationMinutes = d * 1440 + h * 60 + m;
    if (durationMinutes < 1) { noticeToast('কমপক্ষে ১ মিনিট সময় দিন!', 'error'); return; }
  } else {
    durationMinutes = parseInt(durSel?.value) || 720;
  }

  const notice = {
    text: text,
    type: type,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMinutes * 60 * 1000
  };

  // Save + immediate cloud push
  // ✅ FIX: Clear the delete-block flag so new notice is not blocked
  try { localStorage.removeItem('wings_notice_cleared_at'); } catch (e) { }
  _noticeSave(notice);

  closeNoticeModal();
  showNoticeBanner(notice);

  const dLabel = durationMinutes >= 1440
    ? `${Math.floor(durationMinutes / 1440)} দিন`
    : durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)} ঘণ্টা`
      : `${durationMinutes} মিনিট`;

  noticeToast(`✅ নোটিস প্রকাশিত! মেয়াদ: ${dLabel}`, 'success');

  // ✅ V39.8: Activity Log entry
  if (typeof window.logActivity === 'function') {
    window.logActivity('settings', 'ADD', 'নোটিস প্রকাশিত: ' + text.substring(0, 60) + (text.length > 60 ? '...' : ''));
  }
  if (window.markDirty) window.markDirty('activity');
}
function deleteNotice() {
  // Notice board এর activeNotice delete (settings এ stored)
  // recycle-bin-fix এর deleteNotice patch Notice array এর জন্য
  // এটা শুধু activeNotice/banner clear করে

  // ✅ FIX: Save delete timestamp — sync pull যেন পুরনো notice ফেরত না আনে
  try {
    localStorage.setItem('wings_notice_cleared_at', Date.now().toString());
  } catch (e) { }

  _noticeSave(null);
  hideNoticeBanner();
  closeNoticeModal();

  // ✅ FIX: Delete cooldown trigger — sync pull যেন পুরনো notice ফেরত না আনে
  try {
    var _delCount = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
    localStorage.setItem('wings_total_deleted', _delCount.toString());
  } catch (e) { }

  noticeToast('🗑️ নোটিস মুছে ফেলা হয়েছে', 'success');

  // ✅ V39.8: Activity Log entry
  if (typeof window.logActivity === 'function') {
    window.logActivity('settings', 'DELETE', 'নোটিস মুছে ফেলা হয়েছে');
  }
  if (window.markDirty) window.markDirty('activity');
}
// deleteActiveNotice = banner notice clear করার alias
window.deleteActiveNotice = function () {
  _noticeSave(null);
  hideNoticeBanner();
  closeNoticeModal();

  // ✅ FIX: Delete cooldown trigger
  try {
    var _delCount = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
    localStorage.setItem('wings_total_deleted', _delCount.toString());
  } catch (e) { }

  if (typeof window.logActivity === 'function') {
    window.logActivity('settings', 'DELETE', 'নোটিস মুছে ফেলা হয়েছে');
  }
  if (window.markDirty) window.markDirty('activity');
  noticeToast('🗑️ নোটিস মুছে ফেলা হয়েছে', 'success');
};

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(initNoticeBoard, 800);
});

// Also run after login (switchTab calls this)
function refreshNoticeBoardOnLogin() {
  initNoticeBoard();
}

// ✅ FIX: renderFullUI-এর পরে Notice Board re-init হবে
// Pull থেকে নতুন notice আসলে সাথে সাথে দেখাবে
(function _hookRenderFullUI() {
  var _origRenderFullUI = window.renderFullUI;
  if (typeof _origRenderFullUI === 'function' && !_origRenderFullUI._noticeBoardHooked) {
    window.renderFullUI = function () {
      var result = _origRenderFullUI.apply(this, arguments);
      try { initNoticeBoard(); } catch (e) { }
      return result;
    };
    window.renderFullUI._noticeBoardHooked = true;
  } else {
    // renderFullUI পরে লোড হলেও catch করো
    var _hookInterval = setInterval(function () {
      if (typeof window.renderFullUI === 'function' && !window.renderFullUI._noticeBoardHooked) {
        var _orig2 = window.renderFullUI;
        window.renderFullUI = function () {
          var result = _orig2.apply(this, arguments);
          try { initNoticeBoard(); } catch (e) { }
          return result;
        };
        window.renderFullUI._noticeBoardHooked = true;
        clearInterval(_hookInterval);
      }
    }, 500);
    setTimeout(function () { clearInterval(_hookInterval); }, 15000);
  }
})();

// Also expose globally
window.initNoticeBoard = initNoticeBoard;
window.openNoticeModal = openNoticeModal;
window.publishNotice = publishNotice;
window.deleteNotice = deleteNotice;
window.toggleCustomDuration = toggleCustomDuration;
window.previewNotice = previewNotice;



// ===================================
// SETTINGS TAB FUNCTION ALIASES
// (HTML uses renderActivityLog / renderRecycleBin)
// ===================================
function renderActivityLog() {
  try {
    if (!window.globalData) window.globalData = {};
    // backup থেকে নাও — cloud pull এ হারায় না
    var bk = localStorage.getItem('wingsfly_activity_backup');
    var bkData = bk ? JSON.parse(bk) : [];
    var cur = window.globalData.activityHistory || [];
    window.globalData.activityHistory = bkData.length >= cur.length ? bkData : cur;
  } catch (e) { console.warn('renderActivityLog:', e); }
  if (typeof loadActivityHistory === 'function') loadActivityHistory();
}
function renderRecycleBin() {
  try {
    if (!window.globalData) window.globalData = {};
    // backup থেকে নাও — cloud pull এ হারায় না
    var bk = localStorage.getItem('wingsfly_deleted_backup');
    var bkData = bk ? JSON.parse(bk) : [];
    var cur = window.globalData.deletedItems || [];
    window.globalData.deletedItems = bkData.length >= cur.length ? bkData : cur;
  } catch (e) { console.warn('renderRecycleBin:', e); }
  if (typeof loadDeletedItems === 'function') loadDeletedItems();
}
function clearRecycleBin() {
  if (typeof emptyTrash === 'function') emptyTrash();
}
window.renderActivityLog = renderActivityLog;
window.renderRecycleBin = renderRecycleBin;
window.clearRecycleBin = clearRecycleBin;
window.clearActivityLog = function () {
  if (!confirm('সব Activity History মুছে ফেলবেন?')) return;
  if (!window.globalData) return;
  window.globalData.activityHistory = [];
  localStorage.setItem('wingsfly_activity_backup', '[]');
  localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
  if (typeof saveToStorage === 'function') saveToStorage(true);
  if (typeof window.loadActivityHistory === 'function') window.loadActivityHistory();
  if (typeof showSuccessToast === 'function') showSuccessToast('Activity History cleared!');
};

// Map HTML element IDs to our functions
// activityHistoryList -> recycleBinContainer (alias)
// logFilterType -> historyFilter (alias)
// binFilterType -> trashFilter (alias)
const _origLoadActivityHistory = window.loadActivityHistory;
window.loadActivityHistory = function () {
  // Support both container IDs
  const h1 = document.getElementById('activityHistoryList');
  const h2 = document.getElementById('activityLogContainer');

  const history = (window.globalData && window.globalData.activityHistory) || [];
  const filterEl = document.getElementById('historyFilter') || document.getElementById('logFilterType');
  const filterVal = filterEl ? filterEl.value : 'all';
  const searchEl = document.getElementById('logSearch');
  const searchVal = searchEl ? searchEl.value.toLowerCase() : '';

  const isActionFilter = filterEl && filterEl.id === 'logFilterType';
  const filtered = history.filter(h => {
    const typeOk = filterVal === 'all' ||
      (isActionFilter ? (h.action || '').toUpperCase() === filterVal.toUpperCase() : h.type === filterVal);
    const searchOk = !searchVal ||
      (h.description || '').toLowerCase().includes(searchVal) ||
      (h.user || '').toLowerCase().includes(searchVal);
    return typeOk && searchOk;
  });

  const icons = { student: '🎓', finance: '💰', employee: '👤', settings: '⚙️', login: '🔐' };
  const actionBadge = { ADD: 'success', EDIT: 'info', DELETE: 'danger', LOGIN: 'primary', LOGOUT: 'warning', SETTING_CHANGE: 'secondary' };

  const html = filtered.length === 0
    ? '<div class="text-center text-muted py-5"><div style="font-size:3rem">📋</div><p>কোনো Activity নেই।</p></div>'
    : filtered.map(h => {
      const d = new Date(h.timestamp);
      const timeStr = d.toLocaleString('en-BD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const icon = icons[h.type] || '📝';
      const badge = actionBadge[h.action] || 'secondary';
      return `<div class="d-flex align-items-start gap-3 p-3 mb-2 rounded-3" style="background:rgba(0,217,255,0.05);border:1px solid rgba(0,217,255,0.15);">
          <div style="font-size:1.5rem;min-width:36px;text-align:center;">${icon}</div>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-${badge} text-uppercase" style="font-size:0.65rem;">${h.action}</span>
              <span class="text-muted small">${h.type}</span>
              <span class="ms-auto text-muted" style="font-size:0.75rem;">⏱ ${timeStr}</span>
            </div>
            <div style="color:#fff;font-size:0.9rem;">${h.description}</div>
            <div class="text-muted" style="font-size:0.75rem;">👤 ${h.user || 'Admin'}</div>
          </div>
        </div>`;
    }).join('');

  if (h1) h1.innerHTML = html;
  if (h2) h2.innerHTML = html;
};

const _origLoadDeletedItems = window.loadDeletedItems;
window.loadDeletedItems = function () {
  const c1 = document.getElementById('deletedItemsList');
  const c2 = document.getElementById('recycleBinContainer');

  const deleted = (window.globalData && window.globalData.deletedItems) || [];
  const filterEl = document.getElementById('trashFilter') || document.getElementById('binFilterType');
  const filterVal = filterEl ? filterEl.value : 'all';

  const filtered = filterVal === 'all' ? deleted : deleted.filter(d => d.type === filterVal || d.type === filterVal.toLowerCase());

  const icons = { student: '🎓', finance: '💰', employee: '👤', visitor: '🙋', Student: '🎓', Finance: '💰', Employee: '👤', Visitor: '🙋' };

  const html = filtered.length === 0
    ? '<div class="text-center text-muted py-5"><div style="font-size:3rem">🗑️</div><p>Trash খালি।</p></div>'
    : filtered.map(d => {
      const date = new Date(d.deletedAt);
      const dateStr = date.toLocaleString('en-BD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const icon = icons[d.type] || '📄';
      let name = '';
      const t = (d.type || '').toLowerCase();
      if (t === 'student') name = d.item.name || 'Unknown Student';
      else if (t === 'finance') name = (d.item.description || d.item.category || 'Transaction') + ' — ৳' + (d.item.amount || 0);
      else if (t === 'employee') name = d.item.name || 'Unknown Employee';
      else name = JSON.stringify(d.item).substring(0, 60);

      return `<div class="d-flex align-items-start gap-3 p-3 mb-2 rounded-3" style="background:rgba(255,68,68,0.05);border:1px solid rgba(255,68,68,0.2);">
          <div style="font-size:1.5rem;min-width:36px;text-align:center;">${icon}</div>
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-secondary" style="font-size:0.65rem;">${d.type}</span>
              <span class="ms-auto text-muted" style="font-size:0.75rem;">🗑️ ${dateStr}</span>
            </div>
            <div style="color:#fff;font-size:0.9rem;font-weight:500;">${name}</div>
            <div class="text-muted" style="font-size:0.75rem;">Deleted by: ${d.deletedBy || 'Admin'}</div>
          </div>
          <div class="d-flex flex-column gap-1">
            <button class="btn btn-sm btn-success" onclick="restoreDeletedItem('${d.id}')">↩️ Restore</button>
            <button class="btn btn-sm btn-outline-danger" onclick="permanentDelete('${d.id}')">❌ Remove</button>
          </div>
        </div>`;
    }).join('');

  if (c1) c1.innerHTML = html;
  if (c2) c2.innerHTML = html;
};

// =====================================================

// === GLOBAL EXPOSURE ===
window._noticeSave = _noticeSave;
window._noticeRead = _noticeRead;
window.updateSidebarNoticeDot = updateSidebarNoticeDot;
window.getActiveNotice = getActiveNotice;
window.showNoticeBanner = showNoticeBanner;
window.hideNoticeBanner = hideNoticeBanner;
window.startCountdown = startCountdown;
window.updateCountdown = updateCountdown;
window.noticeToast = noticeToast;
window.closeNoticeModal = closeNoticeModal;
window.refreshNoticeBoardOnLogin = refreshNoticeBoardOnLogin;

// Modal Interactions
window.openNoticeModal = openNoticeModal;
window.toggleCustomDuration = toggleCustomDuration;
window.previewNotice = previewNotice;
window.publishNotice = publishNotice;
window.deleteNotice = deleteNotice;
