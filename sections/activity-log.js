// ====================================
// WINGS FLY AVIATION ACADEMY
// ACTIVITY LOG — logActivity, Trash/Recycle Bin System
// Extracted from app.js (Phase 5)
// ====================================

function logActivity(type, action, description, data) {
  data = data || null;
  try {
    if (!window.globalData || !window.globalData.activityHistory) {
      if (window.globalData) window.globalData.activityHistory = [];
      else return;
    }

    // ✅ FIX: salary_payment type → finance হিসেবে normalize করো
    // যাতে Activity Log-এ সবসময় দেখায়
    var normalizedType = (type || 'general').toLowerCase();
    if (normalizedType === 'salary_payment') normalizedType = 'finance';

    // ✅ FIX: action normalize — DELETE সবসময় uppercase হবে
    var normalizedAction = (action || 'OTHER').toUpperCase();

    // system/autotest/heal spam বাদ দাও — কিন্তু finance DELETE বাদ দেবে না
    if (normalizedType === 'heal' || normalizedType === 'system' || normalizedType === 'autotest') return;

    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: normalizedType,
      action: normalizedAction,
      description: description || '',
      timestamp: new Date().toISOString(),
      user: sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin',
      data: data ? (function() { try { return JSON.parse(JSON.stringify(data)); } catch(e) { return {}; } })() : {}
    };

    window.globalData.activityHistory.unshift(entry);

    // Max 1000 entries রাখো
    if (window.globalData.activityHistory.length > 1000) {
      window.globalData.activityHistory = window.globalData.activityHistory.slice(0, 1000);
    }

    // ✅ Save — saveToStorage loop এড়াতে direct localStorage ব্যবহার করো
    try {
      localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    } catch(e) { console.warn('[logActivity] save error:', e); }

    // ✅ markDirty কল করো — sync faster হবে
    if (typeof window.markDirty === 'function') {
      window.markDirty('activity');
    }

    console.log('[Activity Log]', normalizedAction, normalizedType, description);
  } catch (e) {
    console.warn('[logActivity] error:', e);
  }
}
window.logActivity = logActivity;

// Move item to trash (soft delete)
function moveToTrash(type, item) {
  try {
    // ✅ FIX: deletedItems সবসময় object হবে, array নয়
    if (!window.globalData.deletedItems || Array.isArray(window.globalData.deletedItems)) {
      window.globalData.deletedItems = { students: [], finance: [], employees: [], other: [] };
    }
    if (!Array.isArray(window.globalData.deletedItems.students)) window.globalData.deletedItems.students = [];
    if (!Array.isArray(window.globalData.deletedItems.finance)) window.globalData.deletedItems.finance = [];
    if (!Array.isArray(window.globalData.deletedItems.employees)) window.globalData.deletedItems.employees = [];
    if (!Array.isArray(window.globalData.deletedItems.other)) window.globalData.deletedItems.other = [];

    // ✅ FIX: Duplicate trash prevention
    if (item._trash_moved) {
      console.log('[moveToTrash] Skip — already in trash:', item.id || item.studentId);
      return;
    }
    item._trash_moved = true;

    const trashEntry = {
      id: 'TRASH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: type,
      item: JSON.parse(JSON.stringify(item)), // deep copy
      deletedAt: new Date().toISOString(),
      deletedBy: sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin',
      _synced: false  // ✅ cloud sync marker
    };

    // ✅ FIX: salary_payment → finance bucket-এ যাবে
    var t = (type || '').toLowerCase();
    if (t === 'student') {
      window.globalData.deletedItems.students.unshift(trashEntry);
      if (window.globalData.deletedItems.students.length > 300) window.globalData.deletedItems.students = window.globalData.deletedItems.students.slice(0, 300);
    } else if (t === 'finance' || t === 'salary_payment') {
      window.globalData.deletedItems.finance.unshift(trashEntry);
      if (window.globalData.deletedItems.finance.length > 300) window.globalData.deletedItems.finance = window.globalData.deletedItems.finance.slice(0, 300);
    } else if (t === 'employee') {
      window.globalData.deletedItems.employees.unshift(trashEntry);
      if (window.globalData.deletedItems.employees.length > 300) window.globalData.deletedItems.employees = window.globalData.deletedItems.employees.slice(0, 300);
    } else {
      window.globalData.deletedItems.other.unshift(trashEntry);
      if (window.globalData.deletedItems.other.length > 300) window.globalData.deletedItems.other = window.globalData.deletedItems.other.slice(0, 300);
    }

    // ✅ FIX: Activity Log-এ DELETE action লিখো — salary_payment → finance normalize
    var logType = (t === 'salary_payment') ? 'finance' : t;
    var itemName = item.name || item.studentName || item.title || item.description || item.category || item.id || 'Item';
    var logDesc = '';
    if (logType === 'finance') {
      logDesc = '🗑️ Deleted: ' + (item.type || '') + ' — ' + (item.description || item.category || '') + ' | ৳' + (item.amount || 0) + ' | ' + (item.method || '') + ' | ' + (item.date || '');
    } else if (logType === 'student') {
      logDesc = '🗑️ Deleted Student: ' + itemName;
    } else if (logType === 'employee') {
      logDesc = '🗑️ Deleted Employee: ' + itemName;
    } else {
      logDesc = '🗑️ Deleted ' + type + ': ' + itemName;
    }
    logActivity(logType, 'DELETE', logDesc, item);

    // ✅ Save locally
    try {
      localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
      localStorage.setItem('wingsfly_deleted_backup', JSON.stringify(window.globalData.deletedItems));
    } catch(e) { console.warn('[moveToTrash] save error:', e); }

    // ✅ Cloud sync trigger
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('moveToTrash: ' + type);
    }

    console.log('[moveToTrash] ✓', type, itemName, '→ Recycle Bin');
    return trashEntry.id;
  } catch (e) {
    console.warn('[moveToTrash] error:', e);
  }
}
window.moveToTrash = moveToTrash;

// Load and render Activity History tab
function loadActivityHistory() {
  const container = document.getElementById('activityHistoryList');
  if (!container) return;

  let history = window.globalData.activityHistory || [];
  // Filter out system and auto-heal spam
  history = history.filter(function(h) {
    return h.type !== 'heal' && h.type !== 'system' && h.type !== 'autotest';
  });

  // ✅ FIX: salary_payment → finance normalize করো display-এর আগে
  history = history.map(function(h) {
    if ((h.type || '') === 'salary_payment') {
      return Object.assign({}, h, { type: 'finance' });
    }
    return h;
  });

  // Newest first
  history = history.sort(function(a, b) {
    return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
  });

  const filterVal = document.getElementById('historyFilter') ? document.getElementById('historyFilter').value : 'all';
  const filtered = filterVal === 'all' ? history : history.filter(function(h) { return h.type === filterVal; });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-5"><div style="font-size:3rem">📋</div><p>কোনো Activity নেই।</p></div>';
    return;
  }

  const icons = { student: '🎓', finance: '💰', employee: '👤', settings: '⚙️', login: '🔐', system: '🔍', autotest: '🧬', heal: '🔧', keeprecord: '📝', visitor: '🧑', notice: '📢', default: '📝' };
  const colors = { ADD: '#00ff88', EDIT: '#00d9ff', DELETE: '#ff4444', RESTORE: '#00ffc8', LOGIN: '#b537f2', LOGOUT: '#ffaa00', WARN: '#ffcc00', TEST: '#00d4ff', FIX: '#00ff88', default: '#ffffff' };
  const actionBadge = { ADD: 'success', EDIT: 'info', DELETE: 'danger', RESTORE: 'success', LOGIN: 'primary', LOGOUT: 'warning', SETTING_CHANGE: 'secondary', WARN: 'warning', TEST: 'info', FIX: 'success' };

  container.innerHTML = filtered.map(function(h) {
    const d = new Date(h.timestamp);
    const timeStr = d.toLocaleString('en-BD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const icon = icons[h.type] || icons.default;
    const badge = actionBadge[h.action] || 'secondary';

    return '<div class="d-flex align-items-start gap-3 p-3 mb-2 rounded-3" style="background: rgba(0,217,255,0.05); border: 1px solid rgba(0,217,255,0.15);">'
      + '<div style="font-size:1.5rem; min-width:36px; text-align:center;">' + icon + '</div>'
      + '<div class="flex-grow-1">'
      + '<div class="d-flex align-items-center gap-2 mb-1">'
      + '<span class="badge bg-' + badge + ' text-uppercase" style="font-size:0.65rem;">' + (h.action || 'OTHER') + '</span>'
      + '<span class="text-muted small">' + (h.type || '') + '</span>'
      + '<span class="ms-auto text-muted" style="font-size:0.75rem;">⏱ ' + timeStr + '</span>'
      + '</div>'
      + '<div style="color:#ffffff; font-size:0.9rem;">' + (h.description || '') + '</div>'
      + '<div class="text-muted" style="font-size:0.75rem;">👤 ' + (h.user || 'Admin') + '</div>'
      + '</div></div>';
  }).join('');
}
window.loadActivityHistory = loadActivityHistory;

// Clear activity history
function clearActivityHistory() {
  if (!confirm('সব Activity History মুছে ফেলবেন?')) return;

  // ✅ V40.3 FIX: _activityClearedAt timestamp store করো globalData-তে।
  // sync pull-এ এই timestamp check করলে cloud এর পুরোনো ডেটা আর overwrite করতে পারবে না।
  const clearTime = new Date().toISOString();
  const clearTs = Date.now();
  window.globalData._activityClearedAt = clearTime;
  window.globalData._activityClearedTs = clearTs;

  // CLEAR marker রাখো যাতে array empty না থাকে (length > 0 check pass হয় push-এ)
  window.globalData.activityHistory = [{
    id: 'CLEARED_' + Date.now(),
    type: 'system',
    action: 'CLEAR',
    description: 'Activity History cleared by user',
    timestamp: clearTime,
    user: sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin'
  }];
  try {
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    // ✅ V40.3: clearTime + clearTs দুটোই save করো — pull guard দুটোই check করবে
    localStorage.setItem('wf_activity_cleared_at', clearTime);
    localStorage.setItem('wf_activity_cleared_ts', String(clearTs));
  } catch(e) {}
  loadActivityHistory();
  showSuccessToast('Activity History cleared!');

  // Trigger sync push explicitly — cloud-এও clear পাঠাও
  if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Clear Activity History');
  }
}
window.clearActivityHistory = clearActivityHistory;

// ══════════════════════════════════════════════════════════════
// ACTIVITY LOG RESURRECTION GUARD
// Pull-এর পরে clear করা activity log cloud থেকে ফেরত আসলে block করো
// ══════════════════════════════════════════════════════════════
function _guardActivityLogAfterPull() {
  try {
    var clearedTs = parseInt(localStorage.getItem('wf_activity_cleared_ts') || '0');
    if (clearedTs <= 0) return; // কোনো clear হয়নি — কিছু করার নেই

    var gd = window.globalData;
    if (!gd || !Array.isArray(gd.activityHistory) || gd.activityHistory.length === 0) return;

    // যদি cloud থেকে আসা activityHistory-তে clearTime-এর আগের entries থাকে — সেগুলো বাদ দাও
    var before = gd.activityHistory.length;
    gd.activityHistory = gd.activityHistory.filter(function(h) {
      // CLEAR marker নিজেই রেখে দাও
      if (h.action === 'CLEAR') return true;
      // system/autotest বাদ দাও
      if (h.type === 'system' || h.type === 'heal' || h.type === 'autotest') return true;
      // timestamp check: clearTs-এর আগের entries বাদ দাও
      var entryTs = new Date(h.timestamp || 0).getTime();
      return entryTs >= clearedTs;
    });

    // globalData-এও cleared timestamp আপডেট করো যাতে পরের pull-এও কাজ করে
    gd._activityClearedAt = localStorage.getItem('wf_activity_cleared_at') || gd._activityClearedAt;
    gd._activityClearedTs = clearedTs;

    if (gd.activityHistory.length < before) {
      console.warn('[ActivityLog] 🔥 Resurrection blocked: ' + (before - gd.activityHistory.length) + ' old activity entries removed after pull');
      try { localStorage.setItem('wingsfly_data', JSON.stringify(gd)); } catch(e) {}
      // UI refresh
      if (document.getElementById('activityHistoryList')) {
        loadActivityHistory();
      }
    }
  } catch(e) {
    console.warn('[ActivityLog] _guardActivityLogAfterPull error:', e);
  }
}
window._wfGuardActivityLogAfterPull = _guardActivityLogAfterPull;

// wingsSync.pullFromCloud patch — pull-এর পরে activity log guard চালাও
(function _hookPullForActivityLog() {
  var tries = 0;
  function attempt() {
    var ws = window.wingsSync;
    if (!ws) {
      if (tries < 40) { tries++; setTimeout(attempt, 500); }
      return;
    }
    if (ws._activityLogPatchApplied) return;

    var origPull = ws.pullFromCloud;
    if (typeof origPull === 'function' && !origPull._activityLogPatched) {
      ws.pullFromCloud = async function() {
        var result = await origPull.apply(ws, arguments);
        // Pull শেষে activity log guard চালাও
        setTimeout(_guardActivityLogAfterPull, 200);
        return result;
      };
      ws.pullFromCloud._activityLogPatched = true;
      console.log('[ActivityLog] ✅ pullFromCloud patched — activity log resurrection guard active');
    }
    ws._activityLogPatchApplied = true;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(attempt, 1000); });
  } else {
    setTimeout(attempt, 1000);
  }
  setTimeout(attempt, 4000); // double-attempt safety
})();

// Load and render Deleted Items (Trash) tab
function loadDeletedItems() {
  const container = document.getElementById('deletedItemsList');
  if (!container) return;

  // ✅ BUG I FIX: deletedItems object হিসেবে handle — সব category flatten করো
  var rawDeleted = window.globalData.deletedItems || {};
  var deleted;
  if (Array.isArray(rawDeleted)) {
    deleted = rawDeleted;
  } else {
    deleted = [].concat(
      rawDeleted.students || [],
      rawDeleted.finance || [],
      rawDeleted.employees || [],
      rawDeleted.other || []
    );
  }
  const filterVal = document.getElementById('trashFilter')?.value || 'all';

  const filtered = filterVal === 'all' ? deleted : deleted.filter(d => (d.type || '').toLowerCase() === filterVal.toLowerCase());

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-5"><div style="font-size:3rem">🗑️</div><p>Trash খালি। কোনো deleted item নেই।</p></div>';
    return;
  }

  const icons = { student: '🎓', finance: '💰', employee: '👤', installment: '💳' };

  container.innerHTML = filtered.map((d, idx) => {
    const date = new Date(d.deletedAt);
    const dateStr = date.toLocaleString('en-BD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const typeIconMap = { student: '🎓', finance: '💰', employee: '👤', keeprecord: '📝', keep_record: '📝', visitor: '🧑', notice: '📢', loan: '💳', idcard: '🪪', installment: '💳' };
    const icon = typeIconMap[(d.type || '').toLowerCase()] || '📄';

    // Build display name
    let name = '';
    const t = (d.type || '').toLowerCase();
    if (t === 'student') name = d.item.name || d.item.studentName || 'Unknown Student';
    else if (t === 'finance') name = (d.item.description || d.item.category || 'Transaction') + ' — ৳' + (d.item.amount || 0);
    else if (t === 'installment') name = (d.item.description || ('Installment: ' + (d.item.studentName || '') + ' — ৳' + (d.item.amount || 0)));
    else if (t === 'employee') name = d.item.name || 'Unknown Employee';
    else if (t === 'keeprecord' || t === 'keep_record') name = '📝 ' + (d.item.title || d.item.content || 'Note').substring(0, 50);
    else if (t === 'visitor') name = d.item.name || d.item.visitorName || 'Visitor';
    else if (t === 'notice') name = d.item.title || 'Notice';
    else if (t === 'loan') name = (d.item.studentName || d.item.name || 'Loan') + ' — ৳' + (d.item.amount || 0);
    else name = (d.item.name || d.item.title || JSON.stringify(d.item)).substring(0, 60);

    return `
    <div class="d-flex align-items-start gap-3 p-3 mb-2 rounded-3" style="background: rgba(255,68,68,0.05); border: 1px solid rgba(255,68,68,0.2);">
      <div style="font-size:1.5rem; min-width:36px; text-align:center;">${icon}</div>
      <div class="flex-grow-1">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge bg-secondary text-uppercase" style="font-size:0.65rem;">${d.type}</span>
          <span class="ms-auto text-muted" style="font-size:0.75rem;">🗑️ ${dateStr}</span>
        </div>
        <div style="color:#ffffff; font-size:0.9rem; font-weight:500;">${name}</div>
        <div class="text-muted" style="font-size:0.75rem;">Deleted by: ${d.deletedBy || 'Admin'}</div>
      </div>
      <div class="d-flex flex-column gap-1">
        <button class="btn btn-sm btn-success" onclick="restoreDeletedItem('${d.id}')" title="Restore">
          ↩️ Restore
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="permanentDelete('${d.id}')" title="Delete Forever">
          ❌
        </button>
      </div>
    </div>`;
  }).join('');
}
window.loadDeletedItems = loadDeletedItems;

// Restore a deleted item
function restoreDeletedItem(trashId) {
  if (!confirm('এই item টি restore করবেন?')) return;

  // ✅ FIX: object-based deletedItems — সব category থেকে খুঁজো
  var rawDeleted = window.globalData.deletedItems || {};
  var allItems;
  if (Array.isArray(rawDeleted)) {
    allItems = rawDeleted;
  } else {
    allItems = [].concat(
      rawDeleted.students || [],
      rawDeleted.finance || [],
      rawDeleted.employees || [],
      rawDeleted.other || []
    );
  }
  const trashEntry = allItems.find(function(d) { return d.id === trashId; });
  if (!trashEntry) { alert('Item পাওয়া যায়নি!'); return; }

  const item = trashEntry.item;
  // ✅ FIX: _trash_moved ও _synced flag clear করো — re-delete & re-sync এর জন্য
  delete item._trash_moved;
  delete item._synced;
  delete item._deleted;
  delete item._deletedAt;

  // ✅ FIX: salary_payment → finance হিসেবে restore করো
  const rawType = (trashEntry.type || '').toLowerCase();
  const type = (rawType === 'salary_payment') ? 'finance' : rawType;
  const itemName = item.name || item.studentName || item.title || item.content || item.description || item.category || 'Item';

  if (type === 'student') {
    if (!window.globalData.students) window.globalData.students = [];
    window.globalData.students.push(item);
    logActivity('student', 'ADD', `✅ Restored student: ${itemName}`, item);
    if (typeof render === 'function') setTimeout(() => render(window.globalData.students), 100);
    if (typeof renderStudents === 'function') setTimeout(renderStudents, 100);

  } else if (type === 'installment') {
    // ✅ Installment restore — student.installments এ ফিরিয়ে দাও + paid বাড়াও + finance entry তৈরি করো
    const studentName = (item.studentName || '').trim();
    const restoreAmount = parseFloat(item.amount) || 0;
    const restoreMethod = item.method || 'Cash';
    const restoreDate = item.date || new Date().toISOString().split('T')[0];
    const student = studentName ? (window.globalData.students || []).find(s => (s.name || '').trim() === studentName) : null;

    if (student) {
      // installments array তে ফিরিয়ে দাও
      if (!student.installments) student.installments = [];
      student.installments.push({ amount: restoreAmount, date: restoreDate, method: restoreMethod });

      // paid/due update
      student.paid = (parseFloat(student.paid) || 0) + restoreAmount;
      student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);

      // Finance entry ফিরিয়ে দাও
      if (!window.globalData.finance) window.globalData.finance = [];
      window.globalData.finance.push({
        id: Date.now(),
        type: 'Income',
        method: restoreMethod,
        date: restoreDate,
        category: 'Student Installment',
        person: studentName,
        amount: restoreAmount,
        description: `[Restored] Installment for ${studentName}`,
        timestamp: new Date().toISOString()
      });

      // Account balance update
      if (typeof updateAccountBalance === 'function') {
        updateAccountBalance(restoreMethod, restoreAmount, 'Income', true);
      }

      logActivity('finance', 'ADD', `✅ Restored installment: ৳${restoreAmount} | ${studentName}`, item);
      if (typeof render === 'function') setTimeout(() => render(window.globalData.students), 100);
      if (typeof renderLedger === 'function') setTimeout(() => renderLedger(window.globalData.finance), 100);
    } else {
      logActivity('finance', 'ADD', `⚠️ Installment restored but student "${studentName}" not found`, item);
    }

  } else if (type === 'finance') {
    if (!window.globalData.finance) window.globalData.finance = [];

    // ✅ FIX: clean flags, duplicate check by id
    var restoredItem = Object.assign({}, item);
    restoredItem._deleted = false;
    delete restoredItem._deletedAt;
    delete restoredItem._trash_moved;
    delete restoredItem._synced;

    // ✅ FIX: duplicate check — একই id ইতোমধ্যে থাকলে push করো না
    var alreadyExists = window.globalData.finance.some(function(f) {
      return f.id && f.id === restoredItem.id;
    });
    if (!alreadyExists) {
      window.globalData.finance.push(restoredItem);
    }

    // ✅ Balance rebuild — feRebuildAllBalances সবচেয়ে নির্ভরযোগ্য
    if (typeof window.feRebuildAllBalances === 'function') {
      try { window.feRebuildAllBalances(); } catch(e) {}
    } else if (typeof window.feApplyEntryToAccount === 'function') {
      window.feApplyEntryToAccount(restoredItem, +1);
    } else if (typeof updateAccountBalance === 'function') {
      updateAccountBalance(restoredItem.method, restoredItem.amount, restoredItem.type, true);
    }

    // ✅ FIX: Salary Payment restore-এ meaningful description দাও
    var restoreDesc = '♻️ Restored: ' + (item.type || 'Finance') + ' — ' + (item.description || item.category || '') + ' | ৳' + (item.amount || 0) + ' | ' + (item.method || '') + ' | ' + (item.date || '');
    logActivity('finance', 'RESTORE', restoreDesc, item);

    if (typeof renderLedger === 'function') setTimeout(function() { renderLedger(window.globalData.finance); }, 100);
    if (typeof updateGrandTotal === 'function') setTimeout(updateGrandTotal, 150);

  } else if (type === 'employee') {
    if (!window.globalData.employees) window.globalData.employees = [];
    window.globalData.employees.push(item);
    logActivity('employee', 'ADD', `✅ Restored employee: ${itemName}`, item);
    if (typeof renderEmployeeList === 'function') setTimeout(renderEmployeeList, 100);

  } else if (type === 'keeprecord' || type === 'keep_record') {
    // ✅ FIX: Keep Record → wingsfly_keep_records localStorage এ ফেরত দাও
    try {
      const KEEP_KEY = 'wingsfly_keep_records';
      const existing = JSON.parse(localStorage.getItem(KEEP_KEY) || '[]');
      if (!existing.find(r => r.id === item.id)) {
        existing.unshift(item);
        localStorage.setItem(KEEP_KEY, JSON.stringify(existing));
      }
      logActivity('keeprecord', 'ADD', `✅ Restored note: ${item.title || item.content || 'Note'}`, item);
      if (typeof renderKeepRecordNotes === 'function') setTimeout(renderKeepRecordNotes, 100);
    } catch (e) { console.warn('Keep record restore error:', e); }

  } else if (type === 'visitor') {
    if (!window.globalData.visitors) window.globalData.visitors = [];
    window.globalData.visitors.push(item);
    logActivity('visitor', 'ADD', `✅ Restored visitor: ${itemName}`, item);
    if (typeof renderVisitors === 'function') setTimeout(renderVisitors, 100);

  } else if (type === 'notice') {
    if (!window.globalData.notices) window.globalData.notices = [];
    window.globalData.notices.push(item);
    logActivity('notice', 'ADD', `✅ Restored notice: ${item.title || 'Notice'}`, item);

  } else if (type === 'loan') {
    if (!window.globalData.loans) window.globalData.loans = [];
    window.globalData.loans.push(item);
    logActivity('loan', 'ADD', `✅ Restored loan: ${itemName}`, item);
    if (typeof renderLoanSummary === 'function') setTimeout(renderLoanSummary, 100);

  } else {
    // fallback typeMap
    const typeMap = {
      'bankaccount': 'bankAccounts', 'mobileaccount': 'mobileBanking',
      'examregistration': 'examRegistrations', 'idcard': 'idCards'
    };
    const key = typeMap[type];
    if (key) {
      if (!Array.isArray(window.globalData[key])) window.globalData[key] = [];
      window.globalData[key].push(item);
      logActivity(type, 'ADD', `✅ Restored ${type}: ${itemName}`, item);
    }
  }

  // ✅ FIX: Recycle Bin থেকে সরাও — object-based deletedItems
  if (Array.isArray(window.globalData.deletedItems)) {
    window.globalData.deletedItems = window.globalData.deletedItems.filter(function(d) { return d.id !== trashId; });
  } else {
    ['students','finance','employees','other'].forEach(function(cat) {
      if (Array.isArray(window.globalData.deletedItems[cat])) {
        window.globalData.deletedItems[cat] = window.globalData.deletedItems[cat].filter(function(x) { return x.id !== trashId; });
      }
    });
  }
  localStorage.setItem('wingsfly_deleted_backup', JSON.stringify(window.globalData.deletedItems));

  // ✅ FIX: Save locally — saveToStorage loop এড়াতে direct write, তারপর forced push
  try {
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
  } catch(e) {}

  setTimeout(loadDeletedItems, 150);
  showSuccessToast('✅ ' + itemName + ' সফলভাবে restore হয়েছে!');
  if (typeof updateGlobalStats === 'function') setTimeout(updateGlobalStats, 200);

  // ✅ FIX: Cloud-এ restore push করো — এটা না হলে পরের pull-এ deleted marker দেখে আবার মুছে দেয়
  // Restore মানে cloud-এ delete marker সরিয়ে fresh record push করতে হবে
  if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Restore: ' + type);
  }
}
window.restoreDeletedItem = restoreDeletedItem;

// Permanently delete from trash
function permanentDelete(trashId) {
  if (!confirm('এই item টি চিরতরে মুছে ফেলবেন? এটি আর ফিরিয়ে আনা যাবে না।')) return;

  // ✅ BUG I FIX: object-based deletedItems handle
  if (Array.isArray(window.globalData.deletedItems)) {
    window.globalData.deletedItems = window.globalData.deletedItems.filter(d => d.id !== trashId);
  } else {
    ['students','finance','employees','other'].forEach(function(cat) {
      if (Array.isArray(window.globalData.deletedItems[cat])) {
        window.globalData.deletedItems[cat] = window.globalData.deletedItems[cat].filter(function(x) { return x.id !== trashId; });
      }
    });
  }
  saveToStorage(true);
  loadDeletedItems();
  showSuccessToast('Item permanently deleted.');
}
window.permanentDelete = permanentDelete;

// Empty entire trash
function emptyTrash() {
  if (!confirm('সব Deleted Items চিরতরে মুছে ফেলবেন?')) return;
  // ✅ BUG I FIX: object ব্যবহার করো, array নয়
  // ✅ V40.1 FIX: Store a timestamp to prevent sync engine from pulling old data back
  window.globalData.deletedItems = {
      _clearedAt: new Date().toISOString(),
      students: [], finance: [], employees: [], other: []
  };
  try {
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    localStorage.setItem('wingsfly_deleted_backup', JSON.stringify(window.globalData.deletedItems));
  } catch(e) {}
  loadDeletedItems();
  showSuccessToast('Trash emptied!');

  // Trigger sync push explicitly
  if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Empty Trash');
  }
}
window.emptyTrash = emptyTrash;



// Version check handled globally to avoid redeclaration errors
console.log('🚀 Wings Fly Aviation - Core Logic Loading...');

// Legacy internal sync system removed.
// All data synchronization is now handled externally.


// ===================================
// DATA RESET (Fresh Start)
// ===================================


window.logActivity = logActivity;
window.moveToTrash = moveToTrash;
window.loadActivityHistory = loadActivityHistory;
window.clearActivityHistory = clearActivityHistory;
window.loadDeletedItems = loadDeletedItems;
window.restoreDeletedItem = restoreDeletedItem;
window.permanentDelete = permanentDelete;
window.emptyTrash = emptyTrash;
