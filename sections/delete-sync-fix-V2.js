/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * DELETE SYNC FIX — V2.0 "ROOT CAUSE RESOLVED"
 * ════════════════════════════════════════════════════════════════
 *
 * index.html-এ এই ফাইলটি LAST-এ load করুন (সব JS-এর পরে):
 *   <script src="delete-sync-fix-V2.js"></script>
 *
 * ══════════════════════════════════════════════
 * V1.0 কেন কাজ করেনি — ROOT CAUSE ANALYSIS:
 * ══════════════════════════════════════════════
 *
 * মূল সমস্যা ৩টি layer-এ:
 *
 * ❌ ROOT CAUSE 1 — "snapshotWasEmpty + content-range count" trap:
 *   Student মুছলে local students কমে।
 *   pushToCloud() → _getDelta() → prevSnapshot আছে কিন্তু
 *   delete হওয়া entry snapshot-এ নেই (সরে গেছে) → changed=[] হয়।
 *   তারপর stuSnapEmpty=false কিন্তু cloud count check হয়:
 *   content-range header দিয়ে cloud count নেয় — এটা TOTAL rows
 *   (deleted=true সহ) return করতে পারে, তাই cloudCount >= localCount
 *   হয় এবং _skipDataPush=true হয়।
 *   DELETE MARKERS-এর জন্য আলাদা block আছে কিন্তু সেটা
 *   deletedItems.students থেকে filter করে i._synced===false items।
 *   প্রথম push-এ _synced set হওয়ার আগেই pull হলে cloud থেকে
 *   student আবার আসে → resurrection guard ব্লক করে → কিন্তু
 *   আবার auto pull-এ ফিরে আসে → loop!
 *
 * ❌ ROOT CAUSE 2 — deletedItems.students-এ item structure মিলছে না:
 *   moveToTrash() → deletedItems.students.unshift({ id, type, item, ... })
 *   pushToCloud() → _getDeletedRecordId(item, 'student') কল করে।
 *   _getDeletedRecordId() কোড দেখলে বোঝা যায় এটা item.item.studentId
 *   খোঁজে কিন্তু কখনো কখনো item.studentId (nested না করে) থাকে।
 *   ফলে recordId=null → delete marker row তৈরি হয় না → push হয় না!
 *
 * ❌ ROOT CAUSE 3 — pullNow() patch conflict (V1.0 bug):
 *   delete-sync-fix-V1.js → ws.pullNow patch করে।
 *   supabase-sync-patch.js → ws.pullFromCloud patch করে।
 *   কিন্তু wingsSync.pullNow() internally pullFromCloud() ডাকে,
 *   এবং wingsSync.pullNow ≠ ws.pullFromCloud — দুটো আলাদা।
 *   তাই V1.0-এর pullNow patch এবং sync-patch-এর pullFromCloud patch
 *   দুটোই চলে কিন্তু order-এ conflict — _applyDeleteMarkersFromCloud()
 *   resurrection guard-এর আগে চলে, ফলে guard আবার ফিরিয়ে দেয়।
 *
 * ════════════════════════════════════════════════════════════════
 * V2.0 FIX STRATEGY:
 * ════════════════════════════════════════════════════════════════
 *
 * Fix A: moveToTrash-এর পরে IMMEDIATELY direct cloud upsert করো
 *         (sync engine bypass করে)। এটাই সবচেয়ে reliable।
 *
 * Fix B: _getDeletedRecordId()-এর মতো নিজস্ব ID extraction —
 *         nested item.item.studentId বা সরাসরি item.studentId
 *         উভয়ই handle করো।
 *
 * Fix C: deleteStudent/deleteFinanceEntry-এ direct cloud delete
 *         marker push করো — sync engine-এর উপর নির্ভর না করে।
 *
 * Fix D: Startup-এ cloud deleted=true rows এনে local থেকে সরাও।
 *         এটা অন্য PC থেকে delete হওয়া items সরাবে।
 *
 * Fix E: pullFromCloud-এর পরে delete markers verify করো এবং
 *         resurrection guard-এর সাথে coordinate করো।
 *
 * ════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  if (window._wfDeleteSyncV2Loaded) {
    console.log('[DeleteSyncV2] Already loaded.');
    return;
  }
  window._wfDeleteSyncV2Loaded = true;
  console.log('[DeleteSyncV2] ✅ V2.0 Loading...');

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  function _cfg() { return window.SUPABASE_CONFIG || {}; }

  function _headers() {
    const c = _cfg();
    return {
      'apikey': c.KEY || '',
      'Authorization': 'Bearer ' + (c.KEY || ''),
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    };
  }

  function _aid() {
    return _cfg().ACADEMY_ID || 'wingsfly_main';
  }

  /**
   * FIX B: Robust ID extraction — item হলো deletedItems-এর entry।
   * entry.item-এ actual data থাকে অথবা entry নিজেই data হতে পারে।
   */
  function _extractId(entry, type) {
    if (!entry) return null;
    // entry.item-এ actual data থাকার কথা (moveToTrash structure)
    const data = entry.item || entry;
    const t = (type || '').toLowerCase();

    if (t === 'student') {
      return data.studentId || data.id || data.phone || data.name || null;
    } else if (t === 'finance' || t === 'salary_payment' || t === 'advance') {
      return data.id || data.timestamp || null;
    } else if (t === 'employee') {
      return data.id || null;
    }
    return data.id || data.studentId || data.timestamp || null;
  }

  function _getTable(type) {
    const c = _cfg();
    const t = (type || '').toLowerCase();
    if (t === 'student') return c.TBL_STUDENTS || 'wf_students';
    if (t === 'finance' || t === 'salary_payment' || t === 'advance') return c.TBL_FINANCE || 'wf_finance';
    if (t === 'employee') return c.TBL_EMPLOYEES || 'wf_employees';
    return null;
  }

  function _getPrefix(type) {
    const t = (type || '').toLowerCase();
    if (t === 'student') return 'stu';
    if (t === 'finance' || t === 'salary_payment' || t === 'advance') return 'fin';
    if (t === 'employee') return 'emp';
    return null;
  }

  // ══════════════════════════════════════════════════════════════
  // FIX A + C: DIRECT CLOUD DELETE MARKER PUSH
  //
  // Sync engine-এর উপর নির্ভর না করে সরাসরি Supabase-এ
  // deleted=true, data=null set করো।
  // ══════════════════════════════════════════════════════════════

  async function _pushDeleteMarkerDirect(type, rawId) {
    const c = _cfg();
    if (!c.URL || !c.KEY || !rawId) return false;

    const table = _getTable(type);
    const prefix = _getPrefix(type);
    if (!table || !prefix) return false;

    const recordId = `${_aid()}_${prefix}_${rawId}`;

    try {
      const payload = JSON.stringify([{
        id: recordId,
        academy_id: _aid(),
        data: null,
        deleted: true
      }]);

      const res = await fetch(`${c.URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: _headers(),
        body: payload
      });

      if (res.ok || res.status === 201 || res.status === 204) {
        console.log('[DeleteSyncV2] ✅ Delete marker pushed:', recordId);
        return true;
      } else {
        const err = await res.text().catch(() => '');
        console.warn('[DeleteSyncV2] ⚠️ Delete marker push failed:', res.status, err);
        return false;
      }
    } catch (e) {
      console.warn('[DeleteSyncV2] _pushDeleteMarkerDirect error:', e);
      return false;
    }
  }

  // Retry queue — network failure হলে retry করবে
  var _retryQueue = []; // [{ type, rawId, attempts, nextRetry }]

  function _enqueueRetry(type, rawId) {
    const exists = _retryQueue.some(r => r.type === type && r.rawId === String(rawId));
    if (exists) return;
    _retryQueue.push({ type, rawId: String(rawId), attempts: 0, nextRetry: Date.now() + 5000 });
    console.log('[DeleteSyncV2] 📋 Retry queued:', type, rawId);
  }

  async function _processRetryQueue() {
    if (_retryQueue.length === 0) return;
    const now = Date.now();
    const pending = _retryQueue.filter(r => r.nextRetry <= now && r.attempts < 5);

    for (const r of pending) {
      r.attempts++;
      const ok = await _pushDeleteMarkerDirect(r.type, r.rawId);
      if (ok) {
        _retryQueue = _retryQueue.filter(x => !(x.type === r.type && x.rawId === r.rawId));
        console.log('[DeleteSyncV2] ✅ Retry succeeded:', r.type, r.rawId);
      } else {
        r.nextRetry = now + Math.min(30000, 5000 * r.attempts); // exponential backoff
      }
    }
    // 5 বার ব্যর্থ হলে বাদ দাও
    _retryQueue = _retryQueue.filter(r => r.attempts < 5);
  }

  // প্রতি 10 সেকেন্ডে retry চেক করো
  setInterval(_processRetryQueue, 10000);

  // ══════════════════════════════════════════════════════════════
  // FIX A: moveToTrash PATCH — delete করার সাথে সাথে cloud push
  // ══════════════════════════════════════════════════════════════

  function _patchMoveToTrash() {
    const orig = window.moveToTrash;
    if (typeof orig !== 'function' || orig._v2Patched) return;

    window.moveToTrash = function (type, item) {
      const result = orig.apply(this, arguments);

      // Item-এর ID বের করো
      const rawId = _extractId({ item: item }, type) || _extractId(item, type);
      if (rawId) {
        // Async — main thread block করবে না
        _pushDeleteMarkerDirect(type, rawId).then(ok => {
          if (!ok) _enqueueRetry(type, rawId);
          // Push delete marker-এর পরে snapshot rebuild করো
          // যাতে পরের push-এ snapshot correct থাকে
          const ws = window.wingsSync;
          if (ws && typeof ws._rebuildSnapshots === 'function') {
            setTimeout(() => ws._rebuildSnapshots(), 500);
          } else if (typeof window._rebuildSnapshots === 'function') {
            setTimeout(() => window._rebuildSnapshots(), 500);
          }
        });
      } else {
        console.warn('[DeleteSyncV2] moveToTrash: could not extract ID for', type, item);
      }

      return result;
    };
    window.moveToTrash._v2Patched = true;
    console.log('[DeleteSyncV2] ✅ moveToTrash patched — immediate cloud delete marker');
  }

  // ══════════════════════════════════════════════════════════════
  // FIX D: STARTUP + PULL SYNC — cloud deleted=true rows apply
  //
  // অন্য PC/browser থেকে delete হওয়া items এই PC-তে সরাবে।
  // Resurrection guard-এর পরে চলবে যাতে conflict না হয়।
  // ══════════════════════════════════════════════════════════════

  async function _applyCloudDeleteMarkers() {
    const c = _cfg();
    if (!c.URL || !c.KEY) return 0;

    try {
      const aid = encodeURIComponent(_aid());
      const hdrs = { apikey: c.KEY, Authorization: 'Bearer ' + c.KEY };

      const [finRes, stuRes, empRes] = await Promise.all([
        fetch(`${c.URL}/rest/v1/${c.TBL_FINANCE || 'wf_finance'}?academy_id=eq.${aid}&deleted=eq.true&select=id`, { headers: hdrs }),
        fetch(`${c.URL}/rest/v1/${c.TBL_STUDENTS || 'wf_students'}?academy_id=eq.${aid}&deleted=eq.true&select=id`, { headers: hdrs }),
        fetch(`${c.URL}/rest/v1/${c.TBL_EMPLOYEES || 'wf_employees'}?academy_id=eq.${aid}&deleted=eq.true&select=id`, { headers: hdrs }),
      ]);

      const finDelRows = finRes.ok ? await finRes.json() : [];
      const stuDelRows = stuRes.ok ? await stuRes.json() : [];
      const empDelRows = empRes.ok ? await empRes.json() : [];

      const gd = window.globalData;
      if (!gd) return 0;

      let totalRemoved = 0;

      // Helper: row.id থেকে raw ID extract করো
      // Format: "wingsfly_main_fin_SAL_123" → "SAL_123"
      // Format: "wingsfly_main_stu_abc" → "abc"
      function extractRawId(rowId, prefix) {
        const full = `${_aid()}_${prefix}_`;
        return String(rowId || '').startsWith(full)
          ? String(rowId).slice(full.length)
          : null;
      }

      // Finance
      if (Array.isArray(finDelRows) && finDelRows.length > 0 && Array.isArray(gd.finance)) {
        const delIds = new Set();
        finDelRows.forEach(r => {
          const rawId = extractRawId(r.id, 'fin');
          if (rawId) delIds.add(rawId);
        });
        if (delIds.size > 0) {
          const before = gd.finance.length;
          gd.finance = gd.finance.filter(f => {
            const fid = String(f.id || f.timestamp || '');
            if (delIds.has(fid)) {
              console.warn('[DeleteSyncV2] 🗑️ Finance removed via cloud delete marker:', f.type, '৳' + f.amount, 'id=' + fid);
              return false;
            }
            return true;
          });
          totalRemoved += before - gd.finance.length;
        }
      }

      // Students
      if (Array.isArray(stuDelRows) && stuDelRows.length > 0 && Array.isArray(gd.students)) {
        const delIds = new Set();
        stuDelRows.forEach(r => {
          const rawId = extractRawId(r.id, 'stu');
          if (rawId) delIds.add(rawId);
        });
        if (delIds.size > 0) {
          const before = gd.students.length;
          gd.students = gd.students.filter(s => {
            // student ID হতে পারে studentId, id, phone, বা name
            const possibleIds = [
              String(s.studentId || ''),
              String(s.id || ''),
              String(s.phone || ''),
              String(s.name || ''),
            ].filter(Boolean);
            if (possibleIds.some(id => delIds.has(id))) {
              console.warn('[DeleteSyncV2] 🗑️ Student removed via cloud delete marker:', s.name);
              return false;
            }
            return true;
          });
          totalRemoved += before - gd.students.length;
        }
      }

      // Employees
      if (Array.isArray(empDelRows) && empDelRows.length > 0 && Array.isArray(gd.employees)) {
        const delIds = new Set();
        empDelRows.forEach(r => {
          const rawId = extractRawId(r.id, 'emp');
          if (rawId) delIds.add(rawId);
        });
        if (delIds.size > 0) {
          const before = gd.employees.length;
          gd.employees = gd.employees.filter(e => {
            const eid = String(e.id || '');
            if (delIds.has(eid)) {
              console.warn('[DeleteSyncV2] 🗑️ Employee removed via cloud delete marker:', e.name);
              return false;
            }
            return true;
          });
          totalRemoved += before - gd.employees.length;
        }
      }

      if (totalRemoved > 0) {
        // Balance rebuild করো
        if (typeof window.feRebuildAllBalances === 'function') {
          try { window.feRebuildAllBalances(); } catch (e) {}
        }

        // LocalStorage save করো
        try { localStorage.setItem('wingsfly_data', JSON.stringify(gd)); } catch (e) {}

        // Snapshots rebuild করো — পরের push-এ correct delta যাবে
        if (window.wingsSync && typeof window.wingsSync._rebuildSnapshots === 'function') {
          try { window.wingsSync._rebuildSnapshots(); } catch (e) {}
        } else if (typeof window._rebuildSnapshots === 'function') {
          try { window._rebuildSnapshots(); } catch (e) {}
        }

        // UI refresh
        setTimeout(function () {
          if (typeof window.renderStudents === 'function') window.renderStudents();
          else if (typeof window.render === 'function') window.render(gd.students);
          if (typeof window.renderLedger === 'function') window.renderLedger(gd.finance);
          if (typeof window.renderEmployeeList === 'function') window.renderEmployeeList();
          if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
          if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
          if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
          if (typeof window.refreshAnalytics === 'function') window.refreshAnalytics();
          if (typeof window.renderFullUI === 'function') window.renderFullUI();
        }, 300);

        console.log('[DeleteSyncV2] ✅ Applied ' + totalRemoved + ' cloud delete marker(s)');
      }

      return totalRemoved;

    } catch (e) {
      console.warn('[DeleteSyncV2] _applyCloudDeleteMarkers error:', e);
      return 0;
    }
  }

  window.wfApplyCloudDeleteMarkers = _applyCloudDeleteMarkers;

  // ══════════════════════════════════════════════════════════════
  // FIX E: pullFromCloud/pullNow PATCH
  //
  // Pull-এর পরে cloud delete markers apply করো।
  // Resurrection guard (supabase-sync-patch.js) চলার পরে চালাই
  // যাতে conflict না হয়।
  // ══════════════════════════════════════════════════════════════

  function _patchWingsSync() {
    const ws = window.wingsSync;
    if (!ws || ws._v2PatchApplied) return false;

    // pullNow patch
    const origPullNow = ws.pullNow;
    if (typeof origPullNow === 'function' && !origPullNow._v2Patched) {
      ws.pullNow = async function () {
        const result = await origPullNow.apply(ws, arguments);
        // Resurrection guard চলার জন্য 200ms অপেক্ষা করো,
        // তারপর cloud delete markers apply করো
        setTimeout(async () => {
          await _applyCloudDeleteMarkers();
        }, 400);
        return result;
      };
      ws.pullNow._v2Patched = true;
      console.log('[DeleteSyncV2] ✅ pullNow patched');
    }

    // fullSync patch
    const origFullSync = ws.fullSync;
    if (typeof origFullSync === 'function' && !origFullSync._v2Patched) {
      ws.fullSync = async function () {
        const result = await origFullSync.apply(ws, arguments);
        setTimeout(async () => {
          await _applyCloudDeleteMarkers();
        }, 400);
        return result;
      };
      ws.fullSync._v2Patched = true;
    }

    ws._v2PatchApplied = true;
    console.log('[DeleteSyncV2] ✅ wingsSync methods patched');
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // MANUAL TOOLS
  // ══════════════════════════════════════════════════════════════

  /**
   * Console থেকে call করুন: wfForceDeleteSync()
   * সব deleted=true rows cloud থেকে এনে local-এ apply করবে।
   */
  window.wfForceDeleteSync = async function () {
    console.log('[DeleteSyncV2] 🔄 Manual delete sync started...');
    const removed = await _applyCloudDeleteMarkers();
    const msg = removed > 0
      ? '✅ ' + removed + ' টি deleted item sync হয়েছে'
      : '✅ সব কিছু sync আছে';
    console.log('[DeleteSyncV2]', msg);
    if (typeof window.showSuccessToast === 'function') window.showSuccessToast(msg);
    return removed;
  };

  /**
   * Console থেকে: wfPushDeleteMarker('student', 'STU1001')
   * নির্দিষ্ট একটি item-এর delete marker cloud-এ push করবে।
   */
  window.wfPushDeleteMarker = async function (type, rawId) {
    console.log('[DeleteSyncV2] Manual delete marker push:', type, rawId);
    const ok = await _pushDeleteMarkerDirect(type, String(rawId));
    if (ok) {
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast('✅ Delete marker pushed to cloud');
    } else {
      if (typeof window.showErrorToast === 'function') window.showErrorToast('❌ Delete marker push failed — check console');
    }
    return ok;
  };

  // ══════════════════════════════════════════════════════════════
  // STARTUP SEQUENCE
  // ══════════════════════════════════════════════════════════════

  async function _startup() {
    console.log('[DeleteSyncV2] 🚀 Startup sequence...');

    // 1. moveToTrash patch — সাথে সাথে করো
    _patchMoveToTrash();

    // 2. wingsSync patch — ready হওয়ার জন্য অপেক্ষা করো
    let tries = 0;
    const waitForWingsSync = setInterval(() => {
      tries++;
      const patched = _patchWingsSync();
      if (patched || tries >= 40) {
        clearInterval(waitForWingsSync);
        if (!patched) console.warn('[DeleteSyncV2] ⚠️ wingsSync not found after 20s — sync patches skipped');
      }
    }, 500);

    // 3. Initial delete sync — pull complete হওয়ার পরে
    //    _wf_pull_complete flag set হয় pullFromCloud() শেষে
    let pullWait = 0;
    const waitForPull = setInterval(async () => {
      pullWait++;
      if (window._wf_pull_complete || pullWait >= 30) {
        clearInterval(waitForPull);
        console.log('[DeleteSyncV2] Running initial delete marker sync...');
        await _applyCloudDeleteMarkers();
      }
    }, 1000);
  }

  // ══════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_startup, 1000));
  } else {
    setTimeout(_startup, 1000);
  }

  console.log('[DeleteSyncV2] ✅ V2.0 Loaded');
  console.log('[DeleteSyncV2] Commands: wfForceDeleteSync() | wfPushDeleteMarker(type, id)');

})();
