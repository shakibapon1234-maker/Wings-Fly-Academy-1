/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * FINANCE INTEGRITY GUARD — v1.0
 * ============================================================
 *
 * এই module টা automatic monitor হিসেবে কাজ করে।
 * App load হলে এবং যেকোনো financial operation এর পরে
 * accounts integrity check করে।
 *
 * যদি কিছু ভুল থাকে → admin কে সাথে সাথে alert দেয়।
 * সব ঠিক থাকলে → console এ ✅ দেখায়।
 *
 * Public API:
 *   financeGuard.run()       → manual check চালাও
 *   financeGuard.status()    → last check result দেখো
 *   financeGuard.silence()   → alert বন্ধ করো (debug mode)
 * ============================================================
 */

(function () {
  'use strict';

  if (window._financeGuardLoaded) return;
  window._financeGuardLoaded = true;

  // ── SOUND ALERT — guard RED হলে "tuk tuk" শব্দ ─────────
  var _lastAlertTime = 0;
  function _playAlert() {
    var now = Date.now();
    if (now - _lastAlertTime < 10000) return; // ১০ সেকেন্ডে একবারই
    _lastAlertTime = now;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      // "tuk tuk" — দুইটা short beep
      [0, 200].forEach(function(delay) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = 800;
        gain.gain.value = 0.15;
        osc.start(ctx.currentTime + delay / 1000);
        osc.stop(ctx.currentTime + delay / 1000 + 0.08);
      });
    } catch(e) { /* audio not supported */ }
  }

  // ── Expected canonical values (finance-engine.js এর সাথে sync) ──
  var EXPECTED_INCOME_TYPES  = ['Income', 'Registration', 'Refund'];
  var EXPECTED_EXPENSE_TYPES = ['Expense', 'Salary', 'Rent', 'Utilities'];
  var ALL_VALID_TYPES = [
    'Income', 'Registration', 'Refund',
    'Expense', 'Salary', 'Rent', 'Utilities',
    'Loan Given', 'Loan Giving', 'Loan Received', 'Loan Receiving',
    'Transfer In', 'Transfer Out',
    'Advance', 'Advance Return',
    'Investment', 'Investment Return'
  ];

  var _silenced = false;
  var _lastStatus = null;

  // ── MAIN CHECK FUNCTION ───────────────────────────────────

  function runGuard(silent) {
    var gd = window.globalData;
    if (!gd || !gd.finance) {
      console.warn('[FinanceGuard] globalData not ready — skipping check');
      return null;
    }

    var issues = [];
    var warnings = [];

    // ── CHECK 1: finance-engine লোড হয়েছে কিনা ─────────────
    // ✅ FIX: hardcoded type list এর সাথে compare করা বাদ দেওয়া হয়েছে।
    // কারণ: finance-engine এ নতুন type যোগ হলে এটা সবসময় false alarm দিত।
    // এখন শুধু engine লোড হয়েছে কিনা check করা হয়।
    var actualIncome  = window.FE_STAT_INCOME;
    var actualExpense = window.FE_STAT_EXPENSE;

    if (!actualIncome || !Array.isArray(actualIncome)) {
      issues.push('finance-engine.js লোড হয়নি — FE_STAT_INCOME পাওয়া যায়নি');
    }
    if (!actualExpense || !Array.isArray(actualExpense)) {
      issues.push('finance-engine.js লোড হয়নি — FE_STAT_EXPENSE পাওয়া যায়নি');
    }
    // FE_STAT_INCOME এ অন্তত Income থাকা উচিত
    if (actualIncome && !actualIncome.includes('Income')) {
      issues.push('FE_STAT_INCOME এ "Income" নেই — finance-engine এ মূল type missing');
    }
    // FE_STAT_EXPENSE এ অন্তত Expense থাকা উচিত  
    if (actualExpense && !actualExpense.includes('Expense')) {
      issues.push('FE_STAT_EXPENSE এ "Expense" নেই — finance-engine এ মূল type missing');
    }

    // ── CHECK 2: Finance engine functions ──────────────────
    if (typeof window.feCalcStats !== 'function') {
      issues.push('feCalcStats লোড হয়নি — P&L calculation কাজ করবে না');
    }
    if (typeof window.feApplyEntryToAccount !== 'function') {
      issues.push('feApplyEntryToAccount লোড হয়নি — account balance update কাজ করবে না');
    }
    if (typeof window.feRebuildAllBalances !== 'function') {
      warnings.push('feRebuildAllBalances পাওয়া যায়নি');
    }

    // ── CHECK 3: Unknown transaction types ─────────────────
    var unknownTypes = {};
    var fin = (gd.finance || []).filter(function (f) { return !f._deleted; });
    fin.forEach(function (f) {
      if (f.type && !ALL_VALID_TYPES.includes(f.type)) {
        unknownTypes[f.type] = (unknownTypes[f.type] || 0) + 1;
      }
    });
    var unknownList = Object.keys(unknownTypes);
    if (unknownList.length > 0) {
      issues.push('অজানা transaction type পাওয়া গেছে: ' + unknownList.map(function (t) { return '"' + t + '" (' + unknownTypes[t] + 'টি)'; }).join(', '));
    }

    // ── CHECK 4: Student paid/due vs finance ledger ────────
    // শুধু student-সম্পর্কিত types গোনা হবে — Loan, Advance, Transfer, Investment বাদ
    // feSyncStudentPaid এর মতো একই logic ব্যবহার করো (person field + description fallback)
    var STUDENT_PAYMENT_TYPES = ['Income', 'Registration', 'Refund'];
    var finByPerson = {};
    fin.forEach(function (f) {
      if (!STUDENT_PAYMENT_TYPES.includes(f.type)) return;
      var amount = parseFloat(f.amount) || 0;

      // person field দিয়ে match
      if (f.person) {
        finByPerson[f.person] = (finByPerson[f.person] || 0) + amount;
      }

      // description এ নাম থাকলেও count করো (fallback — person field না থাকলে)
      if (!f.person && f.description) {
        (gd.students || []).forEach(function (student) {
          if (student && student.name && f.description.indexOf(student.name) !== -1) {
            finByPerson[student.name] = (finByPerson[student.name] || 0) + amount;
          }
        });
      }
    });

    var mismatchStudents = [];
    (gd.students || []).forEach(function (s) {
      if (!s || !s.name) return;
      var finTotal    = finByPerson[s.name] || 0;
      var studentPaid = parseFloat(s.paid) || 0;
      var diff = Math.abs(finTotal - studentPaid);
      if (diff > 1) {
        mismatchStudents.push({ name: s.name, studentPaid: studentPaid, financeTotal: finTotal, diff: diff });
      }
    });
    if (mismatchStudents.length > 0) {
      warnings.push(mismatchStudents.length + ' জন student এর paid/due finance ledger এর সাথে মিলছে না');
      mismatchStudents.forEach(function (m) {
        console.warn('[FinanceGuard] Mismatch: ' + m.name + ' | student.paid=৳' + m.studentPaid + ' | finance=৳' + m.financeTotal + ' | diff=৳' + m.diff);
      });
    }

    // ── CHECK 5: P&L sanity ────────────────────────────────
    if (typeof window.feCalcStats === 'function') {
      var stats = window.feCalcStats(gd.finance || []);
      var totalBal = (parseFloat(gd.cashBalance) || 0)
        + (gd.bankAccounts || []).reduce(function (s, a) { return s + (parseFloat(a.balance) || 0); }, 0)
        + (gd.mobileBanking || []).reduce(function (s, a) { return s + (parseFloat(a.balance) || 0); }, 0);

      // Sanity: account balance should never be NaN
      if (isNaN(totalBal)) {
        issues.push('Account balance NaN — কোনো account এ ভুল value আছে');
      }
      if (isNaN(stats.income) || isNaN(stats.expense)) {
        issues.push('Income/Expense calculation NaN — finance entries এ ভুল amount থাকতে পারে');
      }
    }

    // ── CHECK 5b: Orphaned Payments ────────────────────────
    // Finance এ এমন Student Fee entry আছে যার student আর নেই
    // ✅ CORRECT LOGIC: deleted student এর finance যদি saveToStorage এ
    // সঠিকভাবে মোছা হয় তাহলে এটা আর দেখাবে না।
    // শুধু সত্যিকারের orphan দেখাও — _deleted flag নেই এমন entries
    var studentNameSet = new Set();
    (gd.students || []).forEach(function(s) {
      if (s && s.name) studentNameSet.add(s.name.trim().toLowerCase());
    });

    var orphanedPayments = [];
    fin.forEach(function(f) {
      if (f._deleted) return;
      if (f.category !== 'Student Fee' && f.type !== 'Income') return;
      // person field থেকে student name নাও
      var pName = (f.person || f.studentName || '').trim();
      if (!pName) return; // name নেই — orphan check skip
      // student list এ আছে কিনা
      if (!studentNameSet.has(pName.toLowerCase())) {
        orphanedPayments.push({ id: f.id, name: pName, date: f.date, amount: f.amount });
      }
    });

    if (orphanedPayments.length > 0) {
      warnings.push('Orphaned Payments (' + orphanedPayments.length + 'টি): finance এ student নেই এমন ' + orphanedPayments.length + ' টি payment আছে');
      // details store করো যাতে Warning modal এ action button কাজ করে
      _lastStatus = _lastStatus || {};
      _lastStatus._orphanedPayments = orphanedPayments;
    }

    // ── CHECK 6: Loan types should NOT appear in income/expense stats ──
    var loanTypes = ['Loan Given', 'Loan Giving', 'Loan Received', 'Loan Receiving'];
    var loanInStats = false;
    fin.forEach(function (f) {
      if (loanTypes.includes(f.type)) {
        if (window.feIsStatIncome && window.feIsStatIncome(f.type)) loanInStats = true;
        if (window.feIsStatExpense && window.feIsStatExpense(f.type)) loanInStats = true;
      }
    });
    if (loanInStats) {
      issues.push('Loan types ভুলভাবে Income/Expense stats এ count হচ্ছে — finance-engine.js ঠিক করুন');
    }

    // ── RESULT ────────────────────────────────────────────
    var ok = issues.length === 0;
    _lastStatus = {
      ok: ok,
      issues: issues,
      warnings: warnings,
      mismatchStudents: mismatchStudents,
      checkedAt: new Date().toISOString(),
      financeEntries: fin.length
    };

    _updateDot(ok, issues.length + warnings.length);

    // ✅ FIX: Sound alert when guard turns RED (data mismatch)
    if (!ok && !_silenced) {
      _playAlert();
    }

    if (!silent) {
      if (ok && warnings.length === 0) {
        console.log('%c✅ [FinanceGuard] সব ঠিক আছে — Accounts integrity OK (' + fin.length + ' entries)', 'color:#00c853;font-weight:bold;');
      } else if (ok && warnings.length > 0) {
        console.group('%c⚠️ [FinanceGuard] ' + warnings.length + ' টি সতর্কতা', 'color:#ff9800;font-weight:bold;');
        warnings.forEach(function (w) { console.warn('[FinanceGuard]', w); });
        console.groupEnd();
        _showToast('warn', '⚠️ Accounts Guard: ' + warnings.length + ' টি warning — console দেখুন');
      } else {
        console.group('%c🚨 [FinanceGuard] ' + issues.length + ' টি সমস্যা পাওয়া গেছে!', 'color:#f44336;font-weight:bold;');
        issues.forEach(function (msg) { console.error('[FinanceGuard]', msg); });
        if (warnings.length > 0) warnings.forEach(function (w) { console.warn('[FinanceGuard]', w); });
        console.groupEnd();
        if (!_silenced) {
          _showToast('error', '🚨 Accounts Guard: ' + issues.length + ' টি সমস্যা! Console দেখুন।');
        }
      }
    }

    return _lastStatus;
  }

  // ── UI DOT INDICATOR ──────────────────────────────────────

  function _injectDot() {
    if (document.getElementById('financeGuardDot')) return;

    var dot = document.createElement('div');
    dot.id = 'financeGuardDot';
    dot.title = '⏳ Accounts checking...';
    dot.textContent = '🛡️';
    dot.style.cssText = [
      'width:22px',
      'height:22px',
      'border-radius:50%',
      'background:rgba(80,80,80,0.9)',
      'cursor:pointer',
      'transition:background 0.4s',
      'font-size:12px',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 0 6px rgba(0,0,0,0.4)',
      'flex-shrink:0',
      'margin-left:6px'
    ].join(';');

    dot.addEventListener('click', function () {
      var s = _lastStatus;
      if (!s) { runGuard(); return; }
      if (s.ok && s.warnings.length === 0) {
        alert('✅ Accounts Healthy\n' + s.financeEntries + ' entries checked\nLast: ' + s.checkedAt);
      } else {
        var msg = '🚨 Issues:\n' + s.issues.join('\n');
        if (s.warnings.length) msg += '\n\n⚠️ Warnings:\n' + s.warnings.join('\n');
        alert(msg);
      }
    });

    // Insert after "Welcome back, Admin!" h4 in the top bar
    var welcomeH4 = null;
    document.querySelectorAll('.top-bar h4, header h4').forEach(function(el) {
      if (el.textContent.indexOf('Welcome') !== -1) welcomeH4 = el;
    });
    if (welcomeH4) {
      welcomeH4.insertAdjacentElement('afterend', dot);
    } else {
      document.body.appendChild(dot);
    }
  }

  function _updateDot(ok, problemCount) {
    var dot = document.getElementById('financeGuardDot');
    if (!dot) return;

    if (ok && problemCount === 0) {
      dot.style.background = '#00c853'; // green
      dot.title = '✅ Accounts Healthy';
    } else if (ok && problemCount > 0) {
      dot.style.background = '#ff9800'; // orange
      dot.title = '⚠️ ' + problemCount + ' warning(s) — click for details';
    } else {
      dot.style.background = '#f44336'; // red
      dot.title = '🚨 ' + problemCount + ' issue(s) — click for details';
    }
  }

  // ── TOAST HELPER ──────────────────────────────────────────

  function _showToast(level, msg) {
    if (level === 'error' && typeof window.showErrorToast === 'function') {
      window.showErrorToast(msg);
    } else if (typeof window.showSuccessToast === 'function') {
      window.showSuccessToast(msg);
    }
  }

  // ── AUTO-HOOK: re-run after key operations ────────────────
  // Finance operations শেষ হলে guard automatically re-check করবে

  function _hookAfter(fnName, delay) {
    delay = delay || 1500;
    var orig = window[fnName];
    if (typeof orig !== 'function') return;
    // ✅ FIX: double-wrap protection — sync-guard ও একই function hook করে
    // যদি আগে থেকে finance-guard wrap করা থাকে, আর করবো না
    if (orig._fgHooked) return;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      setTimeout(function () { runGuard(true); }, delay);
      return result;
    };
    wrapped._fgHooked = true;
    window[fnName] = wrapped;
  }

  function _installHooks() {
    // Student payment operations
    _hookAfter('handleAddInstallment',       1500);
    _hookAfter('deleteInstallment',          1500);
    // General finance operations
    _hookAfter('deleteTransaction',          1500);
    _hookAfter('handleEditTransactionSubmit',1500);
    // Loan operations
    _hookAfter('deleteLoanTransaction',      1500);
    // Salary operations
    _hookAfter('handleSalarySubmit',         1500);
    _hookAfter('handleSalaryEditSubmit',     1500);
    _hookAfter('deleteSalaryRecord',         1500);
    _hookAfter('deleteSalaryPayment',        1500);
    // Transfer operations
    _hookAfter('handleTransferSubmit',       1500);
    // Recycle bin restore
    var origRestore = window.restoreDeletedItem;
    if (typeof origRestore === 'function') {
      window.restoreDeletedItem = function () {
        var result = origRestore.apply(this, arguments);
        setTimeout(function () { runGuard(true); }, 2000);
        return result;
      };
    }
    console.log('[FinanceGuard] ✅ Hooks installed on: handleAddInstallment, deleteInstallment, deleteTransaction, handleEditTransactionSubmit, deleteLoanTransaction, handleSalarySubmit, handleSalaryEditSubmit, deleteSalaryRecord, deleteSalaryPayment, handleTransferSubmit, restoreDeletedItem');
  }

  // ── PUBLIC API ────────────────────────────────────────────

  window.financeGuard = {
    /** Manual full check — result console এ দেখাবে */
    run:     function () { return runGuard(false); },
    /** Silent check — শুধু result return করবে */
    check:   function () { return runGuard(true);  },
    /** Last check result */
    status:  function () { return _lastStatus; },
    /** Toast alert বন্ধ করো (debug mode) */
    silence: function () { _silenced = true;  console.log('[FinanceGuard] Alerts silenced'); },
    /** Toast alert চালু করো */
    unmute:  function () { _silenced = false; console.log('[FinanceGuard] Alerts active'); },
    /** Expected canonical types দেখো */
    expected: function () {
      return { income: EXPECTED_INCOME_TYPES, expense: EXPECTED_EXPENSE_TYPES, allValid: ALL_VALID_TYPES };
    }
  };

  // ── STARTUP ───────────────────────────────────────────────

  function _startup() {
    _injectDot(); // UI dot inject করো

    if (window.globalData && window.globalData.finance) {
      _installHooks();
      runGuard(false);
    } else {
      // Data লোড হওয়ার অপেক্ষা করো
      var attempts = 0;
      var interval = setInterval(function () {
        attempts++;
        if (window.globalData && window.globalData.finance) {
          clearInterval(interval);
          _installHooks();
          runGuard(false);
        } else if (attempts >= 20) {
          clearInterval(interval);
          console.warn('[FinanceGuard] globalData লোড হয়নি — guard চালু হয়নি');
        }
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_startup, 3500); });
  } else {
    setTimeout(_startup, 3500);
  }

  console.log('✅ finance-guard.js v1.0 loaded');

})();
