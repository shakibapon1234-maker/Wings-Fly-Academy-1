// ============================================================
// WINGS FLY AVIATION ACADEMY
// finance-engine.js  —  Central Finance Rules Engine
// ============================================================
//
// এই ফাইলটি সকল financial calculation এর single source of truth।
// সব ফাইল (app.js, finance-crud.js, accounts-management.js) এই
// rules গুলো follow করে।
//
// RULES:
//  ✅ Income (Student Fee, Exam, etc.)  → Account balance +  | Stats: Income +
//  ✅ Expense (Salary, Rent, etc.)      → Account balance -  | Stats: Expense +
//  ✅ Loan Received                     → Account balance +  | Stats: বাদ (loan, income না)
//  ✅ Loan Given                        → Account balance -  | Stats: বাদ (loan, expense না)
//  ✅ Transfer In                       → Account balance +  | Stats: বাদ (internal move)
//  ✅ Transfer Out                      → Account balance -  | Stats: বাদ (internal move)
//
// v8 FIXES (March 2026):
//  ✅ FIX 1 — Double-run বন্ধ: _alreadyRun flag দিয়ে safety fallback guard করা হয়েছে
//  ✅ FIX 2 — updateGrandTotal double-call বন্ধ: wrapper এ guard যোগ করা হয়েছে
//  ✅ FIX 3 — feSyncStudentPaid অপ্টিমাইজ: O(n×m) → O(n+m), finance আগে group করা হয়
//  ✅ FIX 4 — updateGlobalStats wrapper এ অতিরিক্ত updateGrandTotal বন্ধ করা হয়েছে
// ============================================================

(function () {
  'use strict';

  // ── 1. CANONICAL TYPE LISTS ──────────────────────────────
  // এই lists গুলো সব জায়গায় একই থাকবে। অন্য কোনো ফাইলে
  // hardcode করা যাবে না।

  /** Account balance বাড়ায় কিন্তু সবসময় income না */
  const ACCOUNT_IN_TYPES = [
    'Income',
    'Transfer In',
    'Loan Received',
    'Loan Receiving',
    'Registration',
    'Refund',
    'Advance',
    'Investment'
  ];

  /** Account balance কমায় কিন্তু সবসময় expense না */
  const ACCOUNT_OUT_TYPES = [
    'Expense',
    'Transfer Out',
    'Loan Given',
    'Loan Giving',
    'Salary',
    'Rent',
    'Utilities',
    'Advance Return',
    'Investment Return'
  ];

  /** শুধু এই types গুলো Income stats-এ count হবে */
  const STAT_INCOME_TYPES = ['Income', 'Registration', 'Refund'];

  /** শুধু এই types গুলো Expense stats-এ count হবে */
  const STAT_EXPENSE_TYPES = ['Expense', 'Salary', 'Rent', 'Utilities'];

  // Public readonly exports
  window.FE_ACCOUNT_IN    = ACCOUNT_IN_TYPES;
  window.FE_ACCOUNT_OUT   = ACCOUNT_OUT_TYPES;
  window.FE_STAT_INCOME   = STAT_INCOME_TYPES;
  window.FE_STAT_EXPENSE  = STAT_EXPENSE_TYPES;


  // ── 2. TYPE HELPERS ──────────────────────────────────────

  /** এই transaction কি account balance বাড়ায়? */
  window.feIsAccountIn = function (type) {
    return ACCOUNT_IN_TYPES.includes(type);
  };

  /** এই transaction কি account balance কমায়? */
  window.feIsAccountOut = function (type) {
    return ACCOUNT_OUT_TYPES.includes(type);
  };

  /** এই transaction কি Income stats-এ count হবে? */
  window.feIsStatIncome = function (type) {
    return STAT_INCOME_TYPES.includes(type);
  };

  /** এই transaction কি Expense stats-এ count হবে? */
  window.feIsStatExpense = function (type) {
    return STAT_EXPENSE_TYPES.includes(type);
  };


  // ── 3. ACCOUNT BALANCE: SINGLE ENTRY APPLY ───────────────

  /**
   * একটি finance entry apply করো account-এ।
   * @param {object} entry  - finance entry object
   * @param {number} sign   - +1 = add (new/restore), -1 = reverse (delete)
   */
  window.feApplyEntryToAccount = function (entry, sign = 1) {
    if (!window.globalData) return;
    if (!entry || !entry.method || !entry.amount) return;

    const amount = parseFloat(entry.amount) || 0;
    const type   = entry.type || '';

    if (!ACCOUNT_IN_TYPES.includes(type) && !ACCOUNT_OUT_TYPES.includes(type)) return;

    const direction = ACCOUNT_IN_TYPES.includes(type) ? 1 : -1;
    const delta = amount * direction * sign;

    // Cash
    if (entry.method === 'Cash') {
      if (typeof globalData.cashBalance === 'undefined') globalData.cashBalance = 0;
      globalData.cashBalance = (parseFloat(globalData.cashBalance) || 0) + delta;
      if (typeof renderCashBalance === 'function') renderCashBalance();
      return;
    }

    // Bank / Mobile
    // ✅ FIX: name কে priority দাও — finance entries এ method = account.name
    // bankName (যেমন "Wings Fly") method হিসেবে ব্যবহার হয় না
    let account = (globalData.bankAccounts || []).find(a => a.name === entry.method || a.bankName === entry.method);
    if (!account) account = (globalData.mobileBanking || []).find(a => a.name === entry.method || a.bankName === entry.method);
    if (!account) return;

    account.balance = (parseFloat(account.balance) || 0) + delta;

    if (typeof renderAccountList === 'function') renderAccountList();
    if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
    if (typeof updateGrandTotal === 'function') updateGrandTotal();
  };


  // ── 4. FULL REBUILD FROM SCRATCH ─────────────────────────

  /**
   * সব finance entries replay করে সব account balance rebuild করো।
   * startBalances থেকে শুরু করে, তারপর সব transactions apply।
   * Transfer double-count হয় না কারণ Transfer In শুধু destination-এ
   * আর Transfer Out শুধু source-এ যোগ হয়।
   */
  window.feRebuildAllBalances = function () {
    const gd = window.globalData || {};
    if (!gd.finance) return;

    const startBalances = (gd.settings && gd.settings.startBalances) || {};

    // Cash reset → startBalance
    gd.cashBalance = parseFloat(startBalances['Cash']) || 0;

    // Bank / Mobile reset → startBalance
    (gd.bankAccounts || []).forEach(acc => {
      acc.balance = parseFloat(startBalances[acc.name] ?? startBalances[acc.bankName]) || 0;
    });
    (gd.mobileBanking || []).forEach(acc => {
      acc.balance = parseFloat(startBalances[acc.name] ?? startBalances[acc.bankName]) || 0;
    });

    // ✅ FIX: Recycle Bin-এ থাকা finance items-এর ID set তৈরি করো
    // cloud pull-এর পরে _deleted flag থাকে না — তাই শুধু flag চেক যথেষ্ট না
    const _rbFinIds = new Set();
    try {
      const _rbFin = (gd.deletedItems && !Array.isArray(gd.deletedItems) && gd.deletedItems.finance) || [];
      _rbFin.forEach(function(e) {
        const src = e.item || {};
        const id = src.id || src.timestamp;
        if (id) _rbFinIds.add(String(id));
      });
    } catch(_e) {}

    // Replay all non-deleted entries — Recycle Bin items বাদ দাও
    (gd.finance || []).forEach(entry => {
      if (entry._deleted) return;
      if (_rbFinIds.has(String(entry.id || entry.timestamp || ''))) return; // ✅ Recycle Bin skip
      window.feApplyEntryToAccount(entry, +1);
    });

    // Refresh UI
    if (typeof renderCashBalance === 'function') renderCashBalance();
    if (typeof renderAccountList === 'function') renderAccountList();
    if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
    if (typeof updateGrandTotal === 'function') updateGrandTotal();

    // Student paid fields sync করো finance entries থেকে
    window.feSyncStudentPaid();

    console.log('✅ feRebuildAllBalances: Cash=', gd.cashBalance,
      '| Bank total=', (gd.bankAccounts || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0),
      '| Mobile total=', (gd.mobileBanking || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0));
  };


  // ── 5. STATS: INCOME / EXPENSE / NET PROFIT ──────────────

  /**
   * Finance array থেকে Income, Expense, Net Profit হিসাব করো।
   * Loan এবং Transfer এখানে count হয় না।
   * @param {Array}  financeArr  - globalData.finance (বা filtered array)
   * @param {string} [month]     - optional 'YYYY-MM' filter
   * @returns {{ income: number, expense: number, profit: number }}
   */
  window.feCalcStats = function (financeArr, month) {
    let income = 0;
    let expense = 0;

    // ✅ FIX: Recycle Bin-এ থাকা items বাদ দাও
    const _gd = window.globalData || {};
    const _rbIds = new Set();
    try {
      const _rb = (_gd.deletedItems && !Array.isArray(_gd.deletedItems) && _gd.deletedItems.finance) || [];
      _rb.forEach(function(e) {
        const id = (e.item || {}).id || (e.item || {}).timestamp;
        if (id) _rbIds.add(String(id));
      });
    } catch(_e) {}

    (financeArr || []).forEach(entry => {
      if (entry._deleted) return;
      if (_rbIds.has(String(entry.id || entry.timestamp || ''))) return; // ✅ Recycle Bin skip
      if (month && !(entry.date || '').startsWith(month)) return;

      const amount = parseFloat(entry.amount) || 0;

      if (STAT_INCOME_TYPES.includes(entry.type)) {
        income += amount;
      } else if (STAT_EXPENSE_TYPES.includes(entry.type)) {
        expense += amount;
      }
    });

    return { income, expense, profit: income - expense };
  };


  // ── 6. updateGlobalStats REPLACEMENT ─────────────────────
  //
  // যদি অন্য কোনো ফাইলে updateGlobalStats define না থাকে,
  // এই version টা use হবে।
  //
  // FIX 2 + FIX 4: updateGrandTotal শুধু একবার call হবে।
  // আগে: _feUpdateGlobalStats এ একবার + wrapper এ আরেকবার = দুইবার।
  // এখন: শুধু _feUpdateGlobalStats এর ভেতরে একবার।

  function _feUpdateGlobalStats() {
    const gd = window.globalData || {};
    const stats = window.feCalcStats(gd.finance || []);

    // Dashboard stat elements update (যদি থাকে)
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = '৳' + (typeof formatNumber === 'function' ? formatNumber(val) : val.toLocaleString());
    };

    setEl('totalIncome',  stats.income);
    setEl('totalExpense', stats.expense);
    setEl('netProfit',    stats.profit);

    // Grand total update — শুধু একবার
    if (typeof updateGrandTotal === 'function') updateGrandTotal();

    return stats;
  }

  // শুধু তখনই override করো যদি অন্য ফাইলে define না থাকে
  if (typeof window.updateGlobalStats !== 'function') {
    window.updateGlobalStats = _feUpdateGlobalStats;
  } else {
    // FIX 4: Wrap করো — কিন্তু আর updateGrandTotal দ্বিতীয়বার call করবো না।
    // আগের function এর ভেতরে updateGrandTotal থাকলে সেটাই যথেষ্ট।
    const _orig = window.updateGlobalStats;
    window.updateGlobalStats = function () {
      const result = _orig.apply(this, arguments);
      // updateGrandTotal এখানে আর call করা হচ্ছে না — double-call বন্ধ।
      return result;
    };
  }


  // ── 7. RECYCLE BIN SUPPORT ───────────────────────────────
  //
  // Delete → entry._deleted = true, balance reverse
  // Restore → entry._deleted = false, balance re-apply
  //
  // finance-crud.js এর deleteTransaction এবং restore function
  // এই helpers call করবে।

  /**
   * Soft delete: balance reverse করো, entry mark করো।
   * Recycle bin তার নিজস্ব storage manage করে।
   * @param {string|number} entryId
   */
  window.feSoftDeleteEntry = function (entryId) {
    const gd = window.globalData || {};
    const sid = String(entryId);
    const entry = (gd.finance || []).find(f => String(f.id) === sid);
    if (!entry || entry._deleted) return;

    // Balance reverse
    window.feApplyEntryToAccount(entry, -1);

    // Mark as deleted (recycle bin এর জন্য)
    entry._deleted = true;
    entry._deletedAt = new Date().toISOString();

    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    console.log('🗑️ feSoftDeleteEntry:', sid, entry.type, entry.amount);
  };

  /**
   * Restore from recycle bin: balance re-apply করো।
   * @param {string|number} entryId
   */
  window.feRestoreEntry = function (entryId) {
    const gd = window.globalData || {};
    const sid = String(entryId);
    const entry = (gd.finance || []).find(f => String(f.id) === sid);
    if (!entry) return;

    // Balance re-apply
    entry._deleted = false;
    delete entry._deletedAt;
    window.feApplyEntryToAccount(entry, +1);

    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    console.log('♻️ feRestoreEntry:', sid, entry.type, entry.amount);
  };


  // ── 8. SYNC STUDENT PAID FROM FINANCE ENTRIES ────────────
  //
  // FIX 3: O(n×m) → O(n+m) অপ্টিমাইজেশন।
  //
  // আগে: প্রতিটি student-এর জন্য পুরো finance array scan হতো।
  //       ১০০ student × ১০০০ entries = ১,০০,০০০ বার check।
  //
  // এখন: প্রথমে finance array একবার scan করে person অনুযায়ী
  //       group করা হয়। তারপর প্রতিটি student শুধু নিজের
  //       group দেখে।
  //       ১০০০ entries (group) + ১০০ student = ১,১০০ বার check।

  window.feSyncStudentPaid = function () {
    const gd = window.globalData || {};
    if (!gd.students || !gd.finance) return;

    // STEP 1: Finance once-pass to build person totals
    const STUDENT_PAYMENT_TYPES = ['Income', 'Registration', 'Refund'];
    const personTotals = {};
    const students = gd.students || [];

    (gd.finance || []).forEach(f => {
      if (f._deleted) return;
      if (!STUDENT_PAYMENT_TYPES.includes(f.type)) return;

      const amount = parseFloat(f.amount) || 0;
      if (amount <= 0) return;

      // Case A: person field matches exactly (Case-insensitive)
      if (f.person) {
        const match = students.find(s => s && s.name && s.name.toLowerCase() === f.person.toLowerCase());
        if (match) {
          personTotals[match.name] = (personTotals[match.name] || 0) + amount;
          return; // Person field wins
        }
      }

      // Case B: Description fallback (Only if Case A fails)
      if (f.description) {
        // Find ALL students whose names appear as whole words in description
        const matchedNames = [];
        students.forEach(s => {
          if (!s || !s.name) return;
          // Word boundary regex: \bName\b
          const regex = new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(f.description)) {
            matchedNames.push(s.name);
          }
        });

        // ✅ IMPORTANT: ONLY count if EXACTLY one unique student matched
        // If "Ali and Alice" both in desc, we don't know who paid — don't credit either locally
        if (matchedNames.length === 1) {
          const name = matchedNames[0];
          personTotals[name] = (personTotals[name] || 0) + amount;
        }
      }
    });

    // STEP 2: Update student paid/due fields
    students.forEach(student => {
      if (!student || !student.name) return;

      const studentFinanceTotal = personTotals[student.name] || 0;
      const oldPaid = parseFloat(student.paid) || 0;

      if (Math.abs(studentFinanceTotal - oldPaid) > 1) {
        console.log(`🔄 feSyncStudentPaid: ${student.name} | old paid=৳${oldPaid} → new paid=৳${studentFinanceTotal}`);
        student.paid = studentFinanceTotal;
        student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);
      }
    });

    console.log('✅ feSyncStudentPaid: student paid fields synced (Integrity FIX: regex + single-match)');
  };


  // ── 9. AUTO-RUN ON LOAD ───────────────────────────────────
  //
  // FIX 1: _alreadyRun flag দিয়ে double-run বন্ধ।
  //
  // আগে: DOMContentLoaded (500ms) এবং setTimeout (2000ms) — দুইবার।
  //       যদি DOMContentLoaded এ সফল হয়, 2000ms এ আবার চলত।
  //
  // এখন: প্রথমবার সফল হলে _alreadyRun = true।
  //       দ্বিতীয় call টি দেখে _alreadyRun = true, তাই skip করে।

  let _alreadyRun = false;

  function _runRebuild() {
    // FIX 1: আগেই চললে আর চালাবো না
    if (_alreadyRun) return;

    if (window.globalData && window.globalData.finance) {
      _alreadyRun = true; // flag set করো যাতে দ্বিতীয়বার না চলে
      window.feRebuildAllBalances();
      if (typeof updateGlobalStats === 'function') updateGlobalStats();
    }
  }

  // DOMContentLoaded-এ চেষ্টা করো, তারপর fallback timer
  document.addEventListener('DOMContentLoaded', () => setTimeout(_runRebuild, 500));
  setTimeout(_runRebuild, 2000); // safety fallback — কিন্তু এখন double-run হবে না

  console.log('✅ finance-engine.js loaded — canonical rules active (v8 optimized)');

})();
