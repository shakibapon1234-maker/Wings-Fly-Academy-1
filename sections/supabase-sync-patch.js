/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY — SUPABASE SYNC PATCH (V3 — Full Module Guard)
 * File: sections/supabase-sync-patch.js
 *
 * এই ফাইল supabase-sync-SMART-V39.js এর পরে লোড হবে।
 *
 * ════════ V3 নতুন কী যোগ হয়েছে ════════
 *
 * ✅ NOTICE BOARD RESURRECTION GUARD:
 *    → Pull-এর পরে পুরনো notice ফেরত আসলে block করা হবে
 *    → wings_notice_cleared_at timestamp দিয়ে validate করা হয়
 *    → Pull-পরবর্তী initNoticeBoard() call নিশ্চিত
 *
 * ✅ KEEP RECORDS RESURRECTION GUARD:
 *    → localStorage wingsfly_keep_records কে recycle bin এর বিপরীতে check করা হয়
 *    → Pull-এর পরে deleted notes ফেরত না আসার নিশ্চয়তা
 *    → renderKeepRecordNotes() auto-refresh
 *
 * ✅ VISITORS RESURRECTION GUARD:
 *    → globalData.visitors array থেকে deleted items সরানো হয়
 *    → other bucket check করা হয় (type='visitor')
 *
 * ✅ ADVANCE PAYMENT (finance[] এর অংশ):
 *    → finance[] guard ইতিমধ্যে cover করে (type: 'Advance', 'Advance Return')
 *    → কোনো আলাদা guard দরকার নেই — already fixed in V2
 *
 * ✅ ANALYTICS MODULE:
 *    → Pull-এর পরে refreshAnalytics() auto-call যোগ হয়েছে
 *
 * ════════ V2 থেকে যা ছিল (বহাল) ════════
 *
 * ✅ Finance Tab, Salary Hub, Accounts Tab → finance[]
 * ✅ Students Tab → students[]
 * ✅ Employee Tab → employees[]
 * ✅ Exam Tab → examRegistrations[] (other bucket)
 * ✅ BUG A FIX — DELETE RESURRECTION (pull-এর পরে guard)
 * ✅ BUG B FIX — RESTORE AFTER DELETE (snapshot rebuild)
 * ✅ HELPER — wfIsInRecycleBin(type, id)
 *
 * ════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  if (window._wfSyncPatchLoaded) {
    console.log('[SyncPatch] Already loaded, skipping...');
    return;
  }
  window._wfSyncPatchLoaded = true;

  // ══════════════════════════════════════════════════════════════
  // CORE HELPER: Recycle Bin ID set builder
  // ══════════════════════════════════════════════════════════════
  function _buildBinIdSet(binArr, keyFn) {
    var set = new Set();
    (binArr || []).forEach(function(entry) {
      var src = entry.item || {};
      var id = keyFn(src);
      if (id) set.add(String(id));
    });
    return set;
  }

  // ══════════════════════════════════════════════════════════════
  // UNIVERSAL RESURRECTION GUARD
  // pull-এর পরে Recycle Bin-এ থাকা সব items live array থেকে সরায়
  // ══════════════════════════════════════════════════════════════
  function _removeResurrectedItems() {
    try {
      var gd = window.globalData;
      if (!gd) return;
      var di = gd.deletedItems;
      if (!di || Array.isArray(di)) return;

      var totalRemoved = 0;
      var needBalanceRebuild = false;

      // ── 1. FINANCE (Finance Tab, Salary Hub, Accounts Tab, Dashboard, Advance Payment) ──
      // Finance array-এ type: 'Advance', 'Advance Return' entries-ও থাকে।
      // এই একটি guard দিয়ে সব cover হয়।
      if (Array.isArray(gd.finance) && (di.finance || []).length > 0) {
        var finIds = _buildBinIdSet(di.finance, function(s) {
          return s.id || s.timestamp;
        });
        if (finIds.size > 0) {
          var finBefore = gd.finance.length;
          gd.finance = gd.finance.filter(function(f) {
            var id = String(f.id || f.timestamp || '');
            if (finIds.has(id)) {
              console.warn('[SyncPatch] 🔥 Finance resurrection blocked:', f.type, '৳' + f.amount, f.date, 'id=' + id);
              return false;
            }
            return true;
          });
          var finRemoved = finBefore - gd.finance.length;
          if (finRemoved > 0) {
            totalRemoved += finRemoved;
            needBalanceRebuild = true;
            console.log('[SyncPatch] ✅ Blocked ' + finRemoved + ' resurrected finance item(s) (incl. Advance/Salary)');
          }
        }
      }

      // ── 2. STUDENTS (Students Tab) ──
      if (Array.isArray(gd.students) && (di.students || []).length > 0) {
        var stuIds = _buildBinIdSet(di.students, function(s) {
          return s.studentId || s.id || s.phone || s.name;
        });
        if (stuIds.size > 0) {
          var stuBefore = gd.students.length;
          gd.students = gd.students.filter(function(s) {
            var id = String(s.studentId || s.id || s.phone || s.name || '');
            if (stuIds.has(id)) {
              console.warn('[SyncPatch] 🔥 Student resurrection blocked:', s.name, 'id=' + id);
              return false;
            }
            return true;
          });
          var stuRemoved = stuBefore - gd.students.length;
          if (stuRemoved > 0) {
            totalRemoved += stuRemoved;
            console.log('[SyncPatch] ✅ Blocked ' + stuRemoved + ' resurrected student(s)');
          }
        }
      }

      // ── 3. EMPLOYEES (Employee Tab) ──
      if (Array.isArray(gd.employees) && (di.employees || []).length > 0) {
        var empIds = _buildBinIdSet(di.employees, function(s) { return s.id; });
        if (empIds.size > 0) {
          var empBefore = gd.employees.length;
          gd.employees = gd.employees.filter(function(e) {
            var id = String(e.id || '');
            if (empIds.has(id)) {
              console.warn('[SyncPatch] 🔥 Employee resurrection blocked:', e.name, 'id=' + id);
              return false;
            }
            return true;
          });
          var empRemoved = empBefore - gd.employees.length;
          if (empRemoved > 0) {
            totalRemoved += empRemoved;
            console.log('[SyncPatch] ✅ Blocked ' + empRemoved + ' resurrected employee(s)');
          }
        }
      }

      // ── 4. EXAM REGISTRATIONS (Exam Tab — other bucket-এ থাকে) ──
      if (Array.isArray(gd.examRegistrations) && (di.other || []).length > 0) {
        var examBin = (di.other || []).filter(function(e) {
          return (e.type || '').toLowerCase().indexOf('exam') !== -1;
        });
        if (examBin.length > 0) {
          var examIds = _buildBinIdSet(examBin, function(s) {
            return s.regId || s.id || s.registrationId;
          });
          if (examIds.size > 0) {
            var examBefore = gd.examRegistrations.length;
            gd.examRegistrations = gd.examRegistrations.filter(function(r) {
              var id = String(r.regId || r.id || r.registrationId || '');
              if (examIds.has(id)) {
                console.warn('[SyncPatch] 🔥 Exam registration resurrection blocked: id=' + id);
                return false;
              }
              return true;
            });
            var examRemoved = examBefore - gd.examRegistrations.length;
            if (examRemoved > 0) {
              totalRemoved += examRemoved;
              console.log('[SyncPatch] ✅ Blocked ' + examRemoved + ' resurrected exam registration(s)');
            }
          }
        }
      }

      // ── 5. VISITORS (Visitor Tab — other bucket-এ থাকে) ──
      if (Array.isArray(gd.visitors) && (di.other || []).length > 0) {
        var visitorBin = (di.other || []).filter(function(e) {
          var t = (e.type || '').toLowerCase();
          return t.indexOf('visitor') !== -1;
        });
        if (visitorBin.length > 0) {
          var visitorIds = _buildBinIdSet(visitorBin, function(s) {
            return s.id || s.visitId || s.phone || s.name;
          });
          if (visitorIds.size > 0) {
            var visBefore = gd.visitors.length;
            gd.visitors = gd.visitors.filter(function(v) {
              var id = String(v.id || v.visitId || v.phone || v.name || '');
              if (visitorIds.has(id)) {
                console.warn('[SyncPatch] 🔥 Visitor resurrection blocked:', v.name, 'id=' + id);
                return false;
              }
              return true;
            });
            var visRemoved = visBefore - gd.visitors.length;
            if (visRemoved > 0) {
              totalRemoved += visRemoved;
              console.log('[SyncPatch] ✅ Blocked ' + visRemoved + ' resurrected visitor(s)');
            }
          }
        }
      }

      // ── 6. KEEP RECORDS (localStorage-based, other bucket-এ থাকে) ──
      // Keep Records globalData-এ নেই — wingsfly_keep_records localStorage key-এ থাকে।
      // Recycle bin-এ 'keeprecord' type দিয়ে other bucket-এ থাকে।
      _removeResurrectedKeepRecords(di);

      // ── globalData পরিবর্তন হয়েছে, save করো ──
      if (totalRemoved > 0) {
        try { localStorage.setItem('wingsfly_data', JSON.stringify(gd)); } catch(e) {}
      }

      // ── Balance rebuild (finance পরিবর্তন হলে) ──
      if (needBalanceRebuild && typeof window.feRebuildAllBalances === 'function') {
        try { window.feRebuildAllBalances(); } catch(e) {}
      }

      // ── UI refresh ──
      if (totalRemoved > 0) {
        setTimeout(function() {
          if (typeof window.renderLedger === 'function') window.renderLedger(gd.finance);
          if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
          if (typeof window.render === 'function') window.render(gd.students);
          if (typeof window.renderStudents === 'function') window.renderStudents();
          if (typeof window.renderEmployeeList === 'function') window.renderEmployeeList();
          if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
          if (typeof window.renderSalaryCards === 'function') window.renderSalaryCards();
          if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
          if (typeof window.renderAccountList === 'function') window.renderAccountList();
          if (typeof window.renderKeepRecordNotes === 'function') window.renderKeepRecordNotes();
          if (typeof window.refreshAnalytics === 'function') window.refreshAnalytics();
        }, 150);
        console.log('[SyncPatch] ✅ Universal guard done: ' + totalRemoved + ' resurrection(s) blocked');
      }

      // ── 7. NOTICE BOARD: Pull-এর পরে পুরনো notice ফেরত এলে block করো ──
      _guardNoticeBoardAfterPull();

    } catch(e) {
      console.warn('[SyncPatch] _removeResurrectedItems error:', e);
    }
  }
  window._wfRemoveResurrectedItems = _removeResurrectedItems;

  // ══════════════════════════════════════════════════════════════
  // KEEP RECORDS RESURRECTION GUARD
  // localStorage wingsfly_keep_records থেকে deleted notes সরায়
  // ══════════════════════════════════════════════════════════════
  function _removeResurrectedKeepRecords(di) {
    try {
      var otherBin = di && (di.other || []);
      if (!otherBin || otherBin.length === 0) return;

      // 'keeprecord' type-এর entries খোঁজো
      var keepBin = otherBin.filter(function(e) {
        var t = (e.type || '').toLowerCase();
        return t.indexOf('keeprecord') !== -1 || t.indexOf('keep_record') !== -1 || t.indexOf('note') !== -1;
      });
      if (keepBin.length === 0) return;

      var keepIds = _buildBinIdSet(keepBin, function(s) {
        return s.id || s.noteId;
      });
      if (keepIds.size === 0) return;

      var KEY = 'wingsfly_keep_records';
      var raw = localStorage.getItem(KEY);
      if (!raw) return;

      var records = [];
      try { records = JSON.parse(raw); } catch(e) { return; }
      if (!Array.isArray(records) || records.length === 0) return;

      var before = records.length;
      var filtered = records.filter(function(r) {
        var id = String(r.id || r.noteId || '');
        if (keepIds.has(id)) {
          console.warn('[SyncPatch] 🔥 Keep Record resurrection blocked: id=' + id, r.title || '');
          return false;
        }
        return true;
      });

      if (filtered.length < before) {
        localStorage.setItem(KEY, JSON.stringify(filtered));
        console.log('[SyncPatch] ✅ Blocked ' + (before - filtered.length) + ' resurrected keep record(s)');
        if (typeof window.renderKeepRecordNotes === 'function') {
          setTimeout(function() { window.renderKeepRecordNotes(); }, 200);
        }
      }
    } catch(e) {
      console.warn('[SyncPatch] _removeResurrectedKeepRecords error:', e);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // NOTICE BOARD RESURRECTION GUARD
  // Pull-এর পরে পুরনো notice ফেরত এলে clear করো
  // ══════════════════════════════════════════════════════════════
  function _guardNoticeBoardAfterPull() {
    try {
      var clearedAt = parseInt(localStorage.getItem('wings_notice_cleared_at') || '0');
      if (clearedAt <= 0) {
        // কোনো delete ছিল না — notice board init করো (নতুন notice দেখাতে)
        if (typeof window.initNoticeBoard === 'function') {
          setTimeout(function() { window.initNoticeBoard(); }, 300);
        }
        return;
      }

      // Delete marker আছে — globalData-এ পুরনো notice এলে সরাও
      var gd = window.globalData;
      if (gd && gd.settings && gd.settings.activeNotice) {
        var notice = gd.settings.activeNotice;
        var createdAt = notice.createdAt || 0;
        if (createdAt <= clearedAt) {
          // পুরনো notice — সরাও
          delete gd.settings.activeNotice;
          localStorage.removeItem('wingsfly_notice_board');
          localStorage.setItem('wingsfly_data', JSON.stringify(gd));
          console.warn('[SyncPatch] 🔥 Notice resurrection blocked — cleared notice returned from cloud');
        }
      }

      // Notice board re-init করো
      if (typeof window.initNoticeBoard === 'function') {
        setTimeout(function() { window.initNoticeBoard(); }, 300);
      }
    } catch(e) {
      console.warn('[SyncPatch] _guardNoticeBoardAfterPull error:', e);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC HELPER: wfIsInRecycleBin(type, id)
  // যেকোনো ফাইল থেকে call করা যাবে:
  //   wfIsInRecycleBin('finance', f.id)
  //   wfIsInRecycleBin('student', s.studentId)
  //   wfIsInRecycleBin('employee', e.id)
  //   wfIsInRecycleBin('visitor', v.id)
  //   wfIsInRecycleBin('keeprecord', note.id)
  // ══════════════════════════════════════════════════════════════
  window.wfIsInRecycleBin = function(type, id) {
    try {
      var di = window.globalData && window.globalData.deletedItems;
      if (!di || Array.isArray(di)) return false;
      var bucket = (type === 'student') ? 'students'
                 : (type === 'employee') ? 'employees'
                 : (type === 'finance' || type === 'salary_payment' || type === 'advance') ? 'finance'
                 : 'other';
      var arr = di[bucket] || [];
      var sid = String(id || '');
      return arr.some(function(e) {
        var src = e.item || {};
        var eid = String(src.id || src.studentId || src.timestamp || src.phone || src.name || src.visitId || '');
        return eid === sid;
      });
    } catch(e) { return false; }
  };

  // Console থেকে manual trigger: wfFixResurrection()
  window.wfFixResurrection = function() {
    _removeResurrectedItems();
    console.log('[SyncPatch] Manual resurrection fix applied');
  };

  // ══════════════════════════════════════════════════════════════
  // PATCH wingsSync.pullFromCloud — pull-এর পরে guard চালাও
  // ══════════════════════════════════════════════════════════════
  function _waitAndPatch() {
    var tries = 0;
    function attempt() {
      var ws = window.wingsSync;
      if (!ws) {
        if (tries < 40) { tries++; setTimeout(attempt, 500); }
        return;
      }
      if (ws._patchApplied) return;

      // ── pullFromCloud patch ──
      var origPullFn = ws.pullFromCloud;
      if (typeof origPullFn === 'function' && !origPullFn._wfPatched) {
        ws.pullFromCloud = async function(showUI, forceFullPull) {
          var result = await origPullFn.apply(ws, arguments);
          // Pull শেষে সব guard চালাও
          _removeResurrectedItems();
          // Analytics refresh — pull-এর পরে নতুন data দিয়ে chart update
          if (typeof window.refreshAnalytics === 'function') {
            setTimeout(function() { window.refreshAnalytics(); }, 500);
          }
          return result;
        };
        ws.pullFromCloud._wfPatched = true;
        console.log('[SyncPatch] ✅ pullFromCloud patched — universal resurrection guard active');
      }

      // ── scheduleSyncPush patch — restore-এর পরে snapshot rebuild ──
      var origSchedulePush = ws.scheduleSyncPush;
      if (typeof origSchedulePush === 'function' && !origSchedulePush._wfPatched) {
        ws.scheduleSyncPush = function(reason) {
          if (reason && String(reason).toLowerCase().indexOf('restore') !== -1) {
            var rebuildFn = ws._rebuildSnapshots || window._rebuildSnapshots;
            if (typeof rebuildFn === 'function') rebuildFn();
          }
          return origSchedulePush.apply(ws, arguments);
        };
        ws.scheduleSyncPush._wfPatched = true;
        console.log('[SyncPatch] ✅ scheduleSyncPush patched — restore snapshot rebuild active');
      }

      ws._patchApplied = true;
      console.log('[SyncPatch] ✅ All patches applied to wingsSync');
    }
    attempt();
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitAndPatch);
  } else {
    _waitAndPatch();
  }
  setTimeout(_waitAndPatch, 3000);

  // Page load-এ একবার চালাও — login-এর পরে data ready হলে
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_removeResurrectedItems, 5000);
  });

  console.log('[SyncPatch] ✅ V3 Loaded — Full Module Guard active (Finance + Students + Employees + Exam + Visitors + KeepRecords + NoticeBoard + Analytics)');

})();
