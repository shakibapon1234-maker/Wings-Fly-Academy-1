/**
 * ============================================
 * WINGS FLY — AUTO-HEAL ENGINE v4.0
 * ============================================
 * Background-এ চলে, সমস্যা detect করে নিজে fix করে।
 * কোনো command ছাড়াই কাজ করে।
 *
 * HEAL MODULES (11টি active, 3টি removed):
 *  1.  Student due recalculation
 *  2.  Cash balance integrity
 *  3.  Duplicate finance entry removal
 *  4.  UI dashboard refresh
 *  5.  Student duplicate detection (warn only)
 *  6.  Employee & bank data corruption fix
 *  7.  Orphaned payment detection (warn only)
 *  8.  Finance total recalculation
 *  9.  Missing array field init
 *  10. Student overpayment detection (warn only)
 *  11. Paid vs Finance mismatch fix
 *  12. Finance-engine balance rebuild (periodic)
 *  13. Cloud vs Local sync mismatch (version-based)
 *  14. Sync Conflict Watchdog (নতুন) — user কে alert করে
 *  15. Retroactive Student Fee Backfill (সকল স্টুডেন্টের প্রথম পেমেন্ট 'Student Fee' তে রূপান্তর)
 *
 * ✅ v4.3 পরিবর্তন:
 *   - Dead code cleanup: Module 12, 13, 15 সরানো হয়েছে
 *   - Module 12 (Periodic Rebuild): Module 8 via feRebuildAllBalances() handles
 *   - Module 13 (Sync Mismatch): V39 Sync system handles
 *   - Module 15 (Fee Backfill): One-time migration, no longer needed
 */

(function () {
  'use strict';

  const HEAL_INTERVAL = 3600 * 1000;  // ✅ V4.2: প্রতি ৬০ মিনিটে — performance ভালো রাখতে

  // ✅ FIX: সবসময় window.SUPABASE_CONFIG থেকে নাও — hardcoded পুরানো URL বাদ
  // পুরানো account: gtoldrltxjrwshubplfp ← এটা আর ব্যবহার হবে না
  // নতুন account: supabase-config.js এ আছে
  const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || '';
  const SUPABASE_KEY = window.SUPABASE_CONFIG?.KEY || '';
  const TABLE_NAME   = window.SUPABASE_CONFIG?.TABLE || 'academy_data';
  const RECORD_ID    = window.SUPABASE_CONFIG?.MAIN_RECORD || 'wingsfly_main';
  const API_URL = SUPABASE_URL
    ? `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${RECORD_ID}&select=version,last_device,last_action`
    : null;
  const HEADERS = SUPABASE_KEY
    ? { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    : {};

  // ── Finance-engine constants (sync with finance-engine.js) ──
  const ACCOUNT_IN = () => typeof window.FE_ACCOUNT_IN !== 'undefined'
    ? window.FE_ACCOUNT_IN
    : ['Income', 'Loan Received', 'Loan Receiving', 'Transfer In', 'Registration', 'Refund'];
  const ACCOUNT_OUT = () => typeof window.FE_ACCOUNT_OUT !== 'undefined'
    ? window.FE_ACCOUNT_OUT
    : ['Expense', 'Loan Given', 'Loan Giving', 'Transfer Out', 'Salary', 'Rent', 'Utilities'];

  // ── Stats ──
  const healStats = {
    totalRuns: 0, totalFixes: 0,
    lastRun: null, lastFix: null,
    log: [],           // max 50 entries
    moduleStats: {},   // per-module fix counts
  };
  window.healStats = healStats;

  // ── Delete cooldown tracking ──
  let _lastDeleteCount = parseInt(localStorage.getItem('wings_total_deleted') || '0');
  let _lastDeleteTime = 0;

  // ============================================
  // LOGGING
  // ============================================
  function hLog(type, msg, module = '') {
    const entry = { time: new Date().toLocaleTimeString('bn-BD'), type, msg, module };
    healStats.log.unshift(entry);
    if (healStats.log.length > 50) healStats.log.pop();

    const icon = { info: 'ℹ️', fix: '🔧', warn: '⚠️', ok: '✅', err: '❌' }[type] || '•';
    console.log(`[AutoHeal] ${icon} ${msg}`);
    _refreshHealLogUI();
  }

  function _refreshHealLogUI() {
    const container = document.getElementById('heal-log-container');
    if (!container) return;
    container.innerHTML = healStats.log.slice(0, 20).map(e => {
      const colors = { fix: '#d1fae5', warn: '#fef3c7', err: '#fee2e2', ok: '#d1fae5', info: '#eff6ff' };
      const textColors = { fix: '#065f46', warn: '#92400e', err: '#991b1b', ok: '#065f46', info: '#1e40af' };
      return `<div style="background:${colors[e.type]||'#f9fafb'};color:${textColors[e.type]||'#374151'};
        padding:5px 10px;border-radius:6px;margin-bottom:4px;font-size:0.78rem;font-family:monospace;">
        <span style="opacity:0.6">[${e.time}]</span>${e.module ? ` <b>${e.module}</b>` : ''} ${e.msg}
      </div>`;
    }).join('');
  }

  // ============================================
  // TOAST (non-blocking mini notification)
  // ============================================
  function healToast(msg, type = 'info') {
    const toast = document.createElement('div');
    const color = type === 'fix' ? '#00ff88' : (type === 'warn' ? '#ff2366' : '#00d9ff');
    const icon = type === 'fix' ? '🔧' : (type === 'warn' ? '⚠️' : 'ℹ️');
    toast.style.cssText = `position:fixed;bottom:10px;right:10px;background:rgba(10,14,37,0.85);color:${color};
      border:1px solid ${color}44;padding:4px 10px;border-radius:4px;font-size:0.65rem;font-weight:600;
      z-index:10000;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.35);
      pointer-events:none;transform:translateY(20px);opacity:0;transition:all 0.2s;`;
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.transform = 'translateY(-10px)'; toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 1800);
  }

  // ============================================
  // MODULE 1: Student Due Recalculation
  // ============================================
  function healStudentDues() {
    const data = window.globalData;
    if (!data?.students) return 0;
    let fixed = 0;
    data.students.forEach(s => {
      const correct = Math.max(0, (parseFloat(s.totalPayment)||0) - (parseFloat(s.paid)||0));
      if (Math.abs(correct - (parseFloat(s.due)||0)) > 0.5) {
        hLog('fix', `Due fix: "${s.name}" ৳${s.due}→৳${correct}`, 'DUE');
        s.due = correct; fixed++;
      }
    });
    if (fixed > 0) { localStorage.setItem('wingsfly_data', JSON.stringify(data)); healToast(`${fixed} student dues fixed`, 'fix'); }
    return fixed;
  }

  // ============================================
  // MODULE 2: Cash Balance Integrity
  // ============================================
  function healCashBalance() {
    const data = window.globalData;
    if (!data) return 0;
    let fixed = 0;
    if (isNaN(parseFloat(data.cashBalance)) || data.cashBalance === undefined || data.cashBalance === null) {
      hLog('fix', `Cash balance invalid (${data.cashBalance}) → 0`, 'CASH');
      data.cashBalance = 0; fixed++;
    }
    [data.bankAccounts || [], data.mobileBanking || []].flat().forEach(acc => {
      if (isNaN(parseFloat(acc.balance))) { acc.balance = 0; hLog('fix', `Account "${acc.name}" balance → 0`, 'CASH'); fixed++; }
    });
    if (fixed > 0) { localStorage.setItem('wingsfly_data', JSON.stringify(data)); }
    return fixed;
  }

  // ============================================
  // MODULE 3: Duplicate Finance Entry Removal
  // ============================================
  function healDuplicateFinance() {
    const data = window.globalData;
    if (!data?.finance) return 0;
    const seen = new Set(), cleaned = [];
    let removed = 0;
    data.finance.forEach(f => {
      // ✅ V4.2 FIX: description যোগ করা হয়েছে key-তে
      // আগে description ছিল না, তাই Due ও Bonus আলাদা entry ভুলে duplicate ধরতো
      const rt = f.timestamp ? Math.floor(new Date(f.timestamp).getTime() / 300000) : f.date;
      const desc = (f.description || '').replace(/\s+/g, '').toLowerCase();
      const key = `${f.type}|${f.amount}|${f.date}|${(f.person||'').trim().toLowerCase()}|${f.category||''}|${desc}|${rt}`;
      if (seen.has(key)) { hLog('fix', `Dupe finance removed: ${f.type} ৳${f.amount} (${f.date}) ${f.person}`, 'DUPE'); removed++; }
      else { seen.add(key); cleaned.push(f); }
    });
    if (removed > 0) {
      data.finance = cleaned;
      if (typeof window.saveToStorage === 'function') window.saveToStorage();
      else localStorage.setItem('wingsfly_data', JSON.stringify(data));
      healToast(`${removed} dupe txns removed`, 'fix');
    }
    return removed;
  }

  // ============================================
  // MODULE 4: UI Dashboard Refresh
  // ============================================
  function healUIRefresh() {
    const el = document.getElementById('dashTotalStudents');
    if (!el) return 0;
    const displayed = parseInt(el.innerText) || 0;
    const actual = (window.globalData?.students || []).length;
    if (actual > 0 && displayed === 0) {
      hLog('fix', `Dashboard 0 দেখাচ্ছিল, actual ${actual} — refresh`, 'UI');
      if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      return 1;
    }
    return 0;
  }

  // ============================================
  // MODULE 5: Student Duplicate Detection (warn only)
  // ============================================
  function healStudentDuplicates() {
    const data = window.globalData;
    if (!data?.students) return 0;
    const seen = new Map(), dups = [];
    data.students.forEach(s => {
      const key = `${(s.name||'').trim().toLowerCase()}|${(s.phone||'').trim()}`;
      if (seen.has(key) && key !== '|') dups.push(s);
      else seen.set(key, true);
    });
    if (dups.length > 0) {
      hLog('warn', `${dups.length}টি সম্ভাব্য duplicate student (name+phone) — auto-delete করা হয়নি`, 'DUP-STD');
      dups.slice(0, 3).forEach(s => hLog('info', `Dup: "${s.name}" (${s.phone||'no phone'})`, 'DUP-STD'));
      healToast(`${dups.length} duplicate students (no auto-delete)`, 'warn');
    }
    return 0; // warn only
  }

  // ============================================
  // MODULE 6: Employee & Bank Data Corruption Fix
  // ============================================
  function healEmployeeBankData() {
    const data = window.globalData;
    if (!data) return 0;
    let fixed = 0;
    (data.employees || []).forEach(e => {
      if (isNaN(parseFloat(e.salary))) { hLog('fix', `Employee "${e.name}" salary → 0`, 'EMP'); e.salary = 0; fixed++; }
      if (!e.id) { e.id = 'EMP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); hLog('fix', `Employee "${e.name}" ID auto-generated`, 'EMP'); fixed++; }
    });
    (data.bankAccounts || []).forEach(a => {
      if (!a.name) { a.name = 'Unnamed Account'; fixed++; }
      if (isNaN(parseFloat(a.balance))) { a.balance = 0; fixed++; }
    });
    (data.mobileBanking || []).forEach(a => {
      if (!a.name) { a.name = 'Unnamed Mobile'; fixed++; }
      if (isNaN(parseFloat(a.balance))) { a.balance = 0; fixed++; }
    });
    if (fixed > 0) { localStorage.setItem('wingsfly_data', JSON.stringify(data)); healToast(`${fixed} data errors fixed`, 'fix'); }
    return fixed;
  }

  // ============================================
  // MODULE 7: Orphaned Payment Detection (warn only)
  // ============================================
  function healOrphanedPayments() {
    const data = window.globalData;
    if (!data?.finance || !data?.students) return 0;
    const SKIP_TYPES = new Set(['Loan Received', 'Loan Receiving', 'Loan Given', 'Loan Giving', 'Transfer In', 'Transfer Out']);
    const STUDENT_CATS = new Set(['Student Fee', 'Student Installment', 'Admission Fee', 'ভর্তি ফি', 'টিউশন ফি']);
    const names = new Set(data.students.map(s => (s.name||'').trim().toLowerCase()));
    const orphaned = data.finance.filter(f => {
      if (SKIP_TYPES.has(f.type)) return false;
      if (!STUDENT_CATS.has(f.category || '')) return false;
      const p = ((f.person||f.studentName||'')).trim().toLowerCase();
      return p && !names.has(p);
    });
    if (orphaned.length > 0) hLog('warn', `${orphaned.length}টি orphaned payment — student নেই`, 'ORPHAN');
    return 0;
  }

  // ============================================
  // MODULE 8: Finance Total Recalculation
  // ============================================
  function healFinanceRecalculation() {
    // ✅ V4.2 FIX: শুধু feRebuildAllBalances() delegate করো — নিজে calculate করো না
    if (typeof window.feRebuildAllBalances !== 'function') return 0;
    const data = window.globalData;
    if (!data?.finance) return 0;
    const prevCash = parseFloat(data.cashBalance) || 0;
    window.feRebuildAllBalances();
    const newCash = parseFloat(data.cashBalance) || 0;
    const gap = Math.abs(newCash - prevCash);
    if (gap > 1) {
      hLog('fix', `Cash recalc: ৳${prevCash.toFixed(0)} → ৳${newCash.toFixed(0)} (gap ৳${gap.toFixed(0)})`, 'FIN-RECALC');
      if (typeof window.saveToStorage === 'function') window.saveToStorage();
      return 1;
    }
    return 0;
  }

  // ============================================
  // MODULE 9: Missing Array Fields Auto-Init
  // ============================================
  function healMissingArrayFields() {
    const data = window.globalData;
    if (!data) return 0;
    let fixed = 0;
    ['students', 'finance', 'employees', 'bankAccounts', 'mobileBanking',
      'incomeCategories', 'expenseCategories', 'courseNames', 'users',
      'examRegistrations', 'visitors', 'loans'].forEach(key => {
        if (!Array.isArray(data[key])) { hLog('fix', `data.${key} → [] init`, 'INIT'); data[key] = []; fixed++; }
      });
    if (!data.settings || typeof data.settings !== 'object') { data.settings = {}; fixed++; }
    if (!data.attendance || typeof data.attendance !== 'object') { data.attendance = {}; fixed++; }
    if (fixed > 0) localStorage.setItem('wingsfly_data', JSON.stringify(data));
    return fixed;
  }

  // ============================================
  // MODULE 10: Overpayment Detection (warn only)
  // ============================================
  function healOverpaymentCheck() {
    const data = window.globalData;
    if (!data?.students) return 0;
    let count = 0;
    data.students.forEach(s => {
      const paid = parseFloat(s.paid) || 0, total = parseFloat(s.totalPayment) || 0;
      if (total > 0 && paid > total + 1) { count++; hLog('warn', `Overpaid: "${s.name}" paid ৳${paid} / total ৳${total}`, 'OVERPAY'); }
    });
    if (count > 0) healToast(`${count} overpaid students`, 'warn');
    return 0;
  }

  // ============================================
  // MODULE 11: Paid vs Finance Mismatch Fix
  // ============================================
  function healPaidFinanceMismatch(manual = false) {
    const data = window.globalData;
    if (!data?.students || !data?.finance) return 0;

    // Delete cooldown (non-manual)
    if (!manual) {
      const cur = parseInt(localStorage.getItem('wings_total_deleted') || '0');
      if (cur > _lastDeleteCount) { _lastDeleteCount = cur; _lastDeleteTime = Date.now(); return 0; }
      if (_lastDeleteTime > 0 && (Date.now() - _lastDeleteTime) < 180000) return 0;
    }

    let fixed = 0, mismatch = 0;
    const finance = data.finance;

    data.students.forEach(student => {
      if (!student.name) return;
      const nameLower = student.name.trim().toLowerCase();
      const studentPaid = parseFloat(student.paid) || 0;
      if (studentPaid === 0) return;

      const finTotal = finance
        .filter(f => (f.person||'').trim().toLowerCase() === nameLower &&
          (f.category === 'Student Fee' || f.category === 'Student Installment') && f.type === 'Income')
        .reduce((s, f) => s + (parseFloat(f.amount)||0), 0);

      if (finTotal === 0) return;
      const diff = studentPaid - finTotal;
      if (Math.abs(diff) > 1) {
        mismatch++;
        if (manual || diff < -1) {
          student.paid = Math.round(finTotal * 100) / 100;
          student.due = Math.max(0, (parseFloat(student.totalPayment)||0) - student.paid);
          hLog('fix', `Paid fix (${student.name}): ৳${studentPaid}→৳${student.paid}`, 'PAID-FIN');
          fixed++;
        }
      }
    });

    if (fixed > 0) {
      localStorage.setItem('wingsfly_data', JSON.stringify(data));
      healToast(`${fixed} payments synced`, 'fix');
      if (typeof window.updatePaidFinanceStatusBadge === 'function') window.updatePaidFinanceStatusBadge();
      if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush(`Auto-Heal: Paid fix (${fixed})`);
    } else if (manual) {
      if (mismatch === 0) healToast('সব data নিখুঁত আছে! ✅', 'ok');
      else healToast(`${mismatch}টি mismatch পাওয়া কিন্তু fix যায়নি`, 'warn');
    }
    return fixed;
  }

  // Status badge
  function _updatePaidFinanceStatusBadge() {
    const badge = document.getElementById('krPaidFinanceStatus');
    if (!badge || !window.globalData) return;
    const finance = window.globalData.finance || [];
    let mismatch = 0;
    (window.globalData.students || []).forEach(s => {
      const paid = parseFloat(s.paid) || 0;
      if (paid === 0) return;
      const ft = finance.filter(f => f.person === s.name && (f.category === 'Student Fee' || f.category === 'Student Installment') && f.type === 'Income')
        .reduce((sum, f) => sum + (parseFloat(f.amount)||0), 0);
      if (ft > 0 && Math.abs(ft - paid) > 1) mismatch++;
    });
    badge.innerHTML = mismatch === 0
      ? '<span style="color:#00ff88;font-weight:700;">✅ সব ঠিক আছে</span>'
      : `<span style="color:#ffcc00;font-weight:700;">⚠️ ${mismatch}টি mismatch — auto-heal চলছে...</span>`;
  }
  window.updatePaidFinanceStatusBadge = _updatePaidFinanceStatusBadge;

  // Module 12, 13 — REMOVED (V4.3 Cleanup)
  // Module 12 (Periodic Balance Rebuild): Module 8 via feRebuildAllBalances() handles this
  // Module 13 (Cloud Sync Mismatch): V39 Sync system handles this


  // ============================================
  // MODULE 14: Sync Conflict Watchdog (নতুন)
  // সিন্ক conflict হলে user কে সাথে সাথে alert করা
  // ============================================
  function healSyncConflictWatchdog() {
    // ConflictTracker flag পড়া (supabase-sync-SMART-V37.js লেখে)
    let conflict = null;
    try {
      const raw = localStorage.getItem('wf_last_conflict');
      if (raw) conflict = JSON.parse(raw);
    } catch (e) { return 0; }

    if (!conflict) return 0;
    if (conflict.seen) return 0;  // user আগেই দেখেছে

    // 30 সেকেন্ডের মধ্যে হলে show করব না (সিন্ক শেষ হওয়ার আগে)
    if (Date.now() - conflict.time < 30000) return 0;

    const ageMin = Math.round((Date.now() - conflict.time) / 60000);
    const typeLabel = {
      push_blocked: 'ডাটা Save ব্লক হয়েছিল',
      version_gap:  'অন্য Device আগে Sync করেছে',
      count_drop:   'ডাটা Count কমে গেছে',
    }[conflict.type] || 'Sync সমস্যা';

    hLog('warn', `Conflict detected: ${conflict.type} (${ageMin} min ago) — ${conflict.detail}`, 'CONFLICT');

    // Activity log এ লেখা
    if (typeof window.logActivity === 'function') {
      window.logActivity('heal', 'SYNC_CONFLICT',
        `⚠️ Sync Conflict: ${typeLabel} — ${conflict.detail}`,
        { type: conflict.type, localCount: conflict.localCount, cloudCount: conflict.cloudCount, ageMin }
      );
    }

    // বড় Warning Modal দেখানো
    _showConflictWarningModal(conflict, typeLabel, ageMin);

    return 1;  // 1 = found conflict
  }

  // বড় Center Warning Modal
  function _showConflictWarningModal(conflict, typeLabel, ageMin) {
    // একাধিক modal prevent করা
    if (document.getElementById('wf-conflict-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'wf-conflict-modal';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.65)', 'backdrop-filter:blur(4px)',
      'animation:wfConflictFadeIn 0.3s ease',
    ].join(';');

    const localN  = conflict.localCount;
    const cloudN  = conflict.cloudCount;
    const diff    = cloudN - localN;
    const diffTxt = diff > 0
      ? `Cloud-এ ${diff}টি বেশি record ছিল`
      : `Cloud-এ ${Math.abs(diff)}টি কম record`;

    overlay.innerHTML = `
      <style>
        @keyframes wfConflictFadeIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
        #wf-conflict-modal .wf-cm-btn {
          padding:10px 22px; border-radius:8px; border:none;
          font-size:0.9rem; font-weight:600; cursor:pointer; transition:opacity 0.2s;
        }
        #wf-conflict-modal .wf-cm-btn:hover { opacity:0.85; }
      </style>
      <div style="
        background:linear-gradient(135deg,#1a0a2e,#0d1b40);
        border:2px solid #f59e0b;
        border-radius:16px;
        padding:32px 36px;
        max-width:480px;
        width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.7),0 0 40px rgba(245,158,11,0.2);
        color:#fff;
        font-family:system-ui,sans-serif;
      ">
        <div style="font-size:2.5rem;text-align:center;margin-bottom:12px;">⚠️</div>
        <h3 style="color:#f59e0b;text-align:center;margin:0 0 8px;font-size:1.25rem;">Sync Conflict সতর্কবার্তা!</h3>
        <p style="text-align:center;color:#cbd5e1;font-size:0.85rem;margin:0 0 20px;">${typeLabel} — ${ageMin} মিনিট আগে</p>

        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:0.85rem;line-height:1.7;">
          <div style="color:#fbbf24;font-weight:600;margin-bottom:6px;">📋 বিস্তারিত:</div>
          <div style="color:#e2e8f0;">${conflict.detail}</div>
          ${diff !== 0 ? `<div style="color:#94a3b8;margin-top:6px;font-size:0.8rem;">${diffTxt}</div>` : ''}
        </div>

        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:0.8rem;color:#6ee7b7;">
          ✅ System স্বয়ংক্রিয়ভাবে Cloud থেকে latest data pull করেছে।
          আপনার শেষ কাজটি সঠিকভাবে save হয়েছে কিনা একবার confirm করুন।
        </div>

        <div style="display:flex;gap:10px;">
          <button class="wf-cm-btn" onclick="
            window.wingsSync && window.wingsSync.pullNow && window.wingsSync.pullNow().then(function(){ window.renderFullUI && window.renderFullUI(); });
            window.wfConflictTracker && window.wfConflictTracker.markSeen();
            document.getElementById('wf-conflict-modal').remove();
          " style="flex:1;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;">
            🔄 এখনই Refresh করুন
          </button>
          <button class="wf-cm-btn" onclick="
            window.wfConflictTracker && window.wfConflictTracker.markSeen();
            document.getElementById('wf-conflict-modal').remove();
          " style="flex:0.7;background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.15);">
            জানি, বন্ধ করুন
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    hLog('warn', '🚨 Conflict warning modal দেখানো হয়েছে', 'CONFLICT');
  }

  // Module 15 (Fee Backfill) — REMOVED (V4.3 Cleanup)
  // Was a one-time migration tool, no longer needed

  // ============================================
  // Network reconnect handler
  // ============================================
  let _pendingReconnectSync = false;
  window.addEventListener('offline', () => { _pendingReconnectSync = true; hLog('warn', 'Network offline', 'NET'); });
  window.addEventListener('online', async () => {
    hLog('info', 'Network ফিরেছে — pending sync...', 'NET');
    await new Promise(r => setTimeout(r, 2000));
    if (_pendingReconnectSync) {
      _pendingReconnectSync = false;
      if (typeof window.saveToCloud === 'function') { await window.saveToCloud(); hLog('fix', 'Reconnect-এর পর data sync সম্পন্ন', 'NET'); healToast('Network ফিরেছে — sync সম্পন্ন ✓', 'fix'); }
    }
  });

  // ============================================
  // UPDATE HEAL STATS UI
  // ============================================
  function _updateHealStatsUI() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('heal-stats-total-runs', healStats.totalRuns);
    set('heal-stats-total-fixes', healStats.totalFixes);
    set('heal-stats-last-run', healStats.lastRun || '—');
    set('heal-stats-last-fix', healStats.lastFix || 'কোনো fix দরকার হয়নি');

    // Module stats table if present
    const moduleEl = document.getElementById('heal-module-stats');
    if (moduleEl && Object.keys(healStats.moduleStats).length > 0) {
      moduleEl.innerHTML = Object.entries(healStats.moduleStats)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:2px 0;">
          <span style="color:#00d4ff;">${k}</span><span style="color:#00ff88;">+${v}</span></div>`)
        .join('') || '<span style="color:#888;font-size:0.75rem;">এখনো কোনো fix হয়নি</span>';
    }
  }

  // ============================================
  // MAIN HEAL CYCLE
  // ============================================
  async function runHealCycle() {
    // V31 Guard
    if (window.initialSyncComplete === false) { hLog('info', 'Waiting for initial cloud sync...', 'GUARD'); return; }
    if (sessionStorage.getItem('isLoggedIn') !== 'true') return;
    if (!window.globalData) return;

    healStats.totalRuns++;
    healStats.lastRun = new Date().toLocaleTimeString('bn-BD');
    hLog('info', `Heal cycle #${healStats.totalRuns} শুরু...`);

    let totalFixed = 0;
    const moduleResults = {};

    const run = async (name, fn) => {
      const f = await fn();
      moduleResults[name] = f;
      if (f > 0) {
        healStats.moduleStats[name] = (healStats.moduleStats[name] || 0) + f;
        totalFixed += f;
      }
    };

    await run('DUE',        () => healStudentDues());
    await run('CASH',       () => healCashBalance());
    await run('DUPE-FIN',   () => healDuplicateFinance());
    await run('UI',         () => healUIRefresh());
    await run('DUP-STD',    () => healStudentDuplicates());
    await run('EMP',        () => healEmployeeBankData());
    await run('ORPHAN',     () => healOrphanedPayments());
    await run('FIN-RECALC', () => healFinanceRecalculation());
    await run('INIT',       () => healMissingArrayFields());
    await run('OVERPAY',    () => healOverpaymentCheck());
    await run('PAID-FIN',   () => healPaidFinanceMismatch());
    // Module 15, 12, 13 — REMOVED in V4.3 cleanup
    await run('CONFLICT',   () => healSyncConflictWatchdog());  // ✅ Module 14

    if (totalFixed > 0) {
      healStats.totalFixes += totalFixed;
      healStats.lastFix = new Date().toLocaleTimeString('bn-BD');
      hLog('fix', `Heal cycle #${healStats.totalRuns} সম্পন্ন — ${totalFixed}টি fix ✓`);
      if (typeof window.logActivity === 'function') {
        // window.logActivity('heal', 'FIX', `🔧 Auto-Heal #${healStats.totalRuns}: ${totalFixed}টি fix`, { fixes: totalFixed, run: healStats.totalRuns, modules: moduleResults });
      }
      if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush(`Auto-Heal: ${totalFixed} fixes`);
      else if (typeof window.saveToCloud === 'function') await window.saveToCloud();
    } else {
      hLog('ok', `Heal cycle #${healStats.totalRuns} — কোনো সমস্যা নেই ✓`);
      if (healStats.totalRuns % 10 === 0 && typeof window.logActivity === 'function') {
        // window.logActivity('heal', 'TEST', `✅ Auto-Heal #${healStats.totalRuns}: সব ঠিক আছে`, { run: healStats.totalRuns });
      }
    }

    _updateHealStatsUI();
  }

  // ============================================
  // PUBLIC API
  // ============================================
  window.runAutoHealRepair = async function () {
    hLog('info', 'Manual Data Repair শুরু হচ্ছে...');
    const fixed = healPaidFinanceMismatch(true);
    if (fixed > 0) {
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast(`✅ ${fixed}টি data mismatch fix হয়েছে!`);
    }
  };

  window.autoHeal = {
    runNow: runHealCycle,
    getStats: () => healStats,
    getLogs: () => healStats.log,
    fixPaidFinance: () => healPaidFinanceMismatch(true),
    repairNow: window.runAutoHealRepair,
  };

  // ============================================
  // START
  // ============================================
  function start() {
    hLog('info', `🛡️ Auto-Heal Engine v4.3 চালু — 11 modules active (প্রতি 60min)`);
    setTimeout(runHealCycle, 10 * 1000);
    setInterval(runHealCycle, HEAL_INTERVAL);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  console.log(`%c🛡️ Wings Fly Auto-Heal Engine v4.3 loaded`, 'color:#00ff88;font-weight:bold');

})();
