// sections/snapshot-system.js
// Wings Fly Aviation Academy

// AUTO SNAPSHOT SYSTEM - Wings Fly Aviation Academy
// প্রতি ১ ঘন্টায় auto snapshot, last ৭টা রাখে
// =====================================================

// Snapshot constants (moved to bottom, defined as var to avoid hoisting issues)
var SNAPSHOT_KEY = 'wingsfly_snapshots';
var MAX_SNAPSHOTS = 7;
var SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;
var MONITOR_KEY = 'wingsfly_monitor_history';
var MONITOR_MAX = 10;

function takeSnapshot() {
  try {
    var _KEY = 'wingsfly_snapshots';
    var _MAX = 7;
    // ✅ V39.3 FIX: Cross-device login-এ cloud pull শেষ না হলে snapshot বন্ধ
    // wf_just_logged_in = login সবে হয়েছে, sync এখনো চলছে
    // _wf_pull_complete = false → pull এখনো শেষ হয়নি
    if (sessionStorage.getItem('wf_just_logged_in') === 'true') {
      console.warn('[Snapshot] SKIPPED — login sync এখনো চলছে (cross-device guard)');
      return;
    }
    if (window._wf_sync_in_progress) {
      console.warn('[Snapshot] SKIPPED — sync চলছে, data incomplete হতে পারে');
      return;
    }

    // ✅ V34.7 FIX: Snapshot নেওয়ার আগে data integrity check করো
    // যদি local finance < lastKnown হয় তাহলে snapshot skip করো
    // এটা login এর পরে corrupt data snapshot হওয়া বন্ধ করে
    var _finCount = (window.globalData?.finance || []).length;
    var _studCount = (window.globalData?.students || []).length;
    var _lastKnownFin = parseInt(localStorage.getItem('wings_last_known_finance')) || 0;
    var _lastKnownStud = parseInt(localStorage.getItem('wings_last_known_count')) || 0;
    if (_lastKnownFin > 10 && _finCount < _lastKnownFin - 2) {
      console.warn('[Snapshot] SKIPPED — finance data incomplete: local=' + _finCount + ' known=' + _lastKnownFin);
      return;
    }
    if (_lastKnownStud > 5 && _studCount < _lastKnownStud - 2) {
      console.warn('[Snapshot] SKIPPED — student data incomplete: local=' + _studCount + ' known=' + _lastKnownStud);
      return;
    }

    // ✅ V39.3 FIX: সবসময় window.globalData থেকে snapshot নাও
    // localStorage-এ delay থাকতে পারে — globalData সবসময় latest (post-sync) state
    var data;
    if (window.globalData && Object.keys(window.globalData).length > 0) {
      data = JSON.stringify(window.globalData);
      // localStorage-ও sync করে দাও
      localStorage.setItem('wingsfly_data', data);
    } else {
      data = localStorage.getItem('wingsfly_data');
    }
    if (!data) { console.warn('Snapshot: no data found'); return; }

    var existingRaw = localStorage.getItem(_KEY);
    var snapshots = [];
    try { snapshots = JSON.parse(existingRaw) || []; } catch (e) { snapshots = []; }

    var newSnap = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      label: new Date().toLocaleString('en-BD', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }),
      data: data
    };

    snapshots.unshift(newSnap);
    if (snapshots.length > _MAX) { snapshots.splice(_MAX); }

    localStorage.setItem(_KEY, JSON.stringify(snapshots));
    console.log('📸 Snapshot taken:', newSnap.label);

    if (typeof renderSnapshotList === 'function') renderSnapshotList();
  } catch (e) {
    console.warn('Snapshot error:', e);
  }
}

function getSnapshots() {
  try {
    return JSON.parse(localStorage.getItem('wingsfly_snapshots')) || [];
  } catch (e) { return []; }
}

function getMonitorHistory() {
  try {
    var rows = JSON.parse(localStorage.getItem(MONITOR_KEY)) || [];
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
}

function _monitorSafeNum(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _monitorBuildBalanceSnapshot(gd) {
  gd = gd || {};
  var cash = _monitorSafeNum(gd.cashBalance);
  var banks = (gd.bankAccounts || []).map(function (a) {
    return { name: a && a.name ? String(a.name) : 'Bank', balance: _monitorSafeNum(a && a.balance) };
  });
  var mobiles = (gd.mobileBanking || []).map(function (a) {
    return { name: a && a.name ? String(a.name) : 'Mobile', balance: _monitorSafeNum(a && a.balance) };
  });
  var grand = cash;
  banks.forEach(function (b) { grand += b.balance; });
  mobiles.forEach(function (m) { grand += m.balance; });
  return { cash: cash, banks: banks, mobiles: mobiles, grand: grand };
}

function _monitorGetLatestChange(gd) {
  var finance = (gd && gd.finance || []).filter(function (f) { return f && !f._deleted; });
  if (!finance.length) {
    return { type: 'System', category: 'Snapshot', person: '-', method: '-', amount: 0, date: '' };
  }
  var sorted = finance.slice().sort(function (a, b) {
    var ta = new Date(a._updatedAt || a.updatedAt || a.timestamp || a.createdAt || a.date || 0).getTime();
    var tb = new Date(b._updatedAt || b.updatedAt || b.timestamp || b.createdAt || b.date || 0).getTime();
    if (tb !== ta) return tb - ta;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  var f = sorted[0];
  return {
    type: f.type || '-',
    category: f.category || '-',
    person: f.person || '-',
    method: f.method || '-',
    amount: _monitorSafeNum(f.amount),
    date: f.date || ''
  };
}

function _monitorChangeKey(latest) {
  latest = latest || {};
  return [
    String(latest.type || ''),
    String(latest.category || ''),
    String(latest.person || ''),
    String(latest.method || ''),
    String(_monitorSafeNum(latest.amount)),
    String(latest.date || '')
  ].join('|');
}

function _monitorFingerprint(gd, latest) {
  gd = gd || {};
  latest = latest || {};
  return JSON.stringify({
    c: _monitorSafeNum(gd.cashBalance),
    b: (gd.bankAccounts || []).map(function (a) { return [a.name || '', _monitorSafeNum(a.balance)]; }),
    m: (gd.mobileBanking || []).map(function (a) { return [a.name || '', _monitorSafeNum(a.balance)]; }),
    sc: (gd.students || []).length,
    fc: (gd.finance || []).filter(function (x) { return x && !x._deleted; }).length,
    ec: (gd.employees || []).length,
    l: [latest.type || '', latest.category || '', latest.person || '', latest.method || '', _monitorSafeNum(latest.amount), latest.date || '']
  });
}

function recordMonitorChange(reason) {
  try {
    // ✅ FIX: window.globalData সরাসরি ব্যবহার করো (live, post-rebuild balance)
    // localStorage parse করলে feRebuildAllBalances এর আগের stale data আসত
    var gd = window.globalData || {};
    if (!gd || typeof gd !== 'object') return;

    var latest = _monitorGetLatestChange(gd);
    var fp = _monitorFingerprint(gd, latest);
    var cKey = _monitorChangeKey(latest);
    var rows = getMonitorHistory();
    if (rows[0] && rows[0].fingerprint === fp) return;

    // Deduplicate: একই fingerprint হলে (balance + finance count সব same) update করো
    // ✅ FIX: 15 min window সরানো — শুধু exact fingerprint match এ deduplicate করো
    // এতে delete/edit আলাদা row হিসেবে ঠিকমতো record হবে
    if (rows[0]) {
      var withinWindow = rows[0].changeKey === cKey && rows[0].fingerprint === fp;
      if (withinWindow) {
        rows[0].timestamp = new Date().toISOString();
        rows[0].label = new Date().toLocaleString('en-BD', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        });
        rows[0].reason = reason || rows[0].reason || 'saveToStorage';
        rows[0].snapshot = _monitorBuildBalanceSnapshot(gd);
        rows[0].counts = {
          students: (gd.students || []).length,
          finance: (gd.finance || []).filter(function (f) { return f && !f._deleted; }).length,
          employees: (gd.employees || []).length
        };
        rows[0].fingerprint = fp;
        localStorage.setItem(MONITOR_KEY, JSON.stringify(rows.slice(0, MONITOR_MAX)));
        return;
      }
    }

    var row = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      label: new Date().toLocaleString('en-BD', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }),
      reason: reason || 'saveToStorage',
      user: sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin',
      change: latest,
      counts: {
        students: (gd.students || []).length,
        finance: (gd.finance || []).filter(function (f) { return f && !f._deleted; }).length,
        employees: (gd.employees || []).length
      },
      snapshot: _monitorBuildBalanceSnapshot(gd),
      changeKey: cKey,
      fingerprint: fp
    };

    rows.unshift(row);
    if (rows.length > MONITOR_MAX) rows = rows.slice(0, MONITOR_MAX);
    localStorage.setItem(MONITOR_KEY, JSON.stringify(rows));
  } catch (e) {
    console.warn('[Monitor] record error:', e);
  }
}

function _installMonitorSaveHook() {
  var tries = 0;
  function attempt() {
    var orig = window.saveToStorage;
    if (typeof orig !== 'function') {
      tries++;
      if (tries < 30) setTimeout(attempt, 500);
      return;
    }
    if (orig._wfMonitorPatched) return;
    window.saveToStorage = function () {
      var result = orig.apply(this, arguments);
      if (result !== false) {
        // ✅ FIX: 60ms → 800ms — feRebuildAllBalances() শেষ হওয়ার পরে snapshot নাও
        // 60ms এ balance rebuild হয়নি থাকত, তাই snapshot এ ভুল balance যেত
        setTimeout(function () {
          recordMonitorChange('saveToStorage');
          if (typeof window.renderMonitor === 'function') window.renderMonitor();
        }, 800);
      }
      return result;
    };
    window.saveToStorage._wfMonitorPatched = true;
  }
  attempt();
}

function restoreSnapshot(id) {
  const snapshots = getSnapshots();
  const snap = snapshots.find(s => s.id === id);
  if (!snap) return;

  try {
    localStorage.setItem('wingsfly_data', snap.data);
    window.globalData = JSON.parse(snap.data);
    if (typeof renderLedger === 'function') renderLedger(window.globalData.finance || []);
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    if (typeof showSuccessToast === 'function') showSuccessToast('✅ Snapshot restore সফল! ' + snap.label);
    if (typeof renderSnapshotList === 'function') renderSnapshotList();
  } catch (e) {
    if (typeof showErrorToast === 'function') showErrorToast('Restore failed: ' + e.message);
  }
}

function downloadSnapshot(id) {
  const snapshots = getSnapshots();
  const snap = snapshots.find(s => s.id === id);
  if (!snap) return;

  const blob = new Blob([snap.data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'WingsFly_Snapshot_' + new Date(snap.id).toISOString().slice(0, 16).replace('T', '_').replace(':', '-') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function deleteSnapshot(id) {
  var snapshots = getSnapshots();
  snapshots = snapshots.filter(function (s) { return s.id !== id; });
  localStorage.setItem('wingsfly_snapshots', JSON.stringify(snapshots));
  if (typeof renderSnapshotList === 'function') renderSnapshotList();
}

function renderSnapshotList() {
  const container = document.getElementById('snapshotListContainer');
  if (!container) return;

  const snapshots = getSnapshots();

  if (snapshots.length === 0) {
    container.innerHTML = '<div class="text-center py-3" style="color:#888;">এখনো কোনো snapshot নেই। "এখনই নিন" বাটনে ক্লিক করুন।</div>';
    return;
  }

  container.innerHTML = snapshots.map((snap, i) => `
    <div class="d-flex align-items-center gap-2 p-2 mb-2 rounded-3" style="background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.15);">
      <div style="min-width:20px;text-align:center;color:#00d9ff;font-weight:bold;font-size:0.8rem;">#${i + 1}</div>
      <div class="flex-grow-1" style="font-size:0.85rem;color:#c0e0ff;">📸 ${snap.label}</div>
      <button class="btn btn-sm py-0 px-2" style="background:rgba(0,200,100,0.2);color:#00cc66;border:1px solid #00cc66;font-size:0.75rem;" onclick="restoreSnapshot(${snap.id})">↩️ Restore</button>
      <button class="btn btn-sm py-0 px-2" style="background:rgba(0,150,255,0.2);color:#00aaff;border:1px solid #00aaff;font-size:0.75rem;" onclick="downloadSnapshot(${snap.id})">⬇️</button>
      <button class="btn btn-sm py-0 px-2" style="background:rgba(255,50,50,0.15);color:#ff6666;border:1px solid #ff4444;font-size:0.75rem;" onclick="deleteSnapshot(${snap.id})">🗑️</button>
    </div>
  `).join('');
}

// Global expose
window.takeSnapshot = takeSnapshot;
window.restoreSnapshot = restoreSnapshot;
window.downloadSnapshot = downloadSnapshot;
window.deleteSnapshot = deleteSnapshot;
window.renderSnapshotList = renderSnapshotList;
window.getMonitorHistory = getMonitorHistory;
window.recordMonitorChange = recordMonitorChange;

// Page load হলে hourly snapshot interval শুরু করো
// ⚠️ DOMContentLoaded-এ snapshot নেওয়া হয় না — cloud sync হওয়ার আগে খালি data যাবে
// ✅ Login-এর পরে showDashboard() থেকে 5 সেকেন্ড পর snapshot নেওয়া হয়
document.addEventListener('DOMContentLoaded', function () {
  var ONE_HOUR = 60 * 60 * 1000;

  // প্রতি ৫ মিনিটে check, ১ ঘন্টা পার হলে নতুন নাও
  setInterval(function () {
    // শুধু logged in থাকলে snapshot নাও
    if (!sessionStorage.getItem('isLoggedIn')) return;
    var snaps = getSnapshots();
    var last = snaps[0];
    if (!last || (Date.now() - last.id) > ONE_HOUR) {
      takeSnapshot();
    }
  }, 5 * 60 * 1000);

  // Settings Modal খোলার সময় সব refresh
  // ✅ FIX: Lazy-loaded modal এর জন্য document level এ delegate করো
  // settingsModal DOM এ না থাকলেও কাজ করবে
  document.addEventListener('shown.bs.modal', function (e) {
    if (!e.target || e.target.id !== 'settingsModal') return;
    try {
      var raw = localStorage.getItem('wingsfly_data');
      if (raw) window.globalData = JSON.parse(raw);
      // ✅ FIX: deletedItems MUST be object {students,finance,employees} — never array!
      if (!window.globalData.deletedItems || Array.isArray(window.globalData.deletedItems)) {
        window.globalData.deletedItems = { students: [], finance: [], employees: [], other: [] };
      }
      ['students','finance','employees','other'].forEach(function(k) {
        if (!Array.isArray(window.globalData.deletedItems[k])) window.globalData.deletedItems[k] = [];
      });
      if (!window.globalData.activityHistory) window.globalData.activityHistory = [];
    } catch (e) { }
    if (typeof renderSnapshotList === 'function') renderSnapshotList();
    if (typeof renderActivityLog === 'function') renderActivityLog();
    if (typeof renderRecycleBin === 'function') renderRecycleBin();
  });

  _installMonitorSaveHook();
});


// ================================================================
// AUTO-HEAL ENGINE — REMOVED (V39 Cleanup)
// ================================================================
// ✅ Duplicate Auto-Heal code সরানো হয়েছে।
// auto-heal.js ফাইলে 13-module Auto-Heal Engine আছে যা এই basic
// version-এর চেয়ে অনেক বেশি comprehensive।
// দুটো একসাথে load হলে window._runHeal, window._healLog overwrite
// হয়ে যেত এবং auto-heal.js-এর advanced modules কাজ করত না।
// ================================================================

// ================================================================
// BALANCE RECONCILIATION — REMOVED (V4.3 Cleanup)
// ================================================================
// feRebuildAllBalances() (finance-engine.js) handles this with
// canonical ACCOUNT_IN/OUT_TYPES. No separate reconciliation needed.
// ================================================================

