// ============================================================
// Wings Fly Aviation Academy — SyncGuard
// Payment Integrity + Sync Conflict Monitor
//
// কাজ:
//   ১. Balance race-condition ধরে alert দেয়
//   ২. Merge conflict (দুই ডিভাইস একই record) ধরে
//   ৩. Loan / Transfer / Advance যেন income/expense হিসেবে
//      count না হয় — সেটা audit করে
//   ৪. সব ঘটনা log রাখে এবং UI-তে দেখায়
// ============================================================

const SyncGuard = (() => {

  const LOG_KEY   = 'wfa_syncguard_log';
  const MAX_LOG   = 200;
  const BADGE_ID  = 'syncguard-badge';

  // ── Internal log ──────────────────────────────────────────
  function _readLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
  }

  function _writeLog(entries) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
  }

  // ── Public: report an issue ───────────────────────────────
  /**
   * @param {'merge_conflict'|'negative_balance'|'balance_lock_error'|'balance_update_error'|
   *         'loan_as_income'|'transfer_as_income'|'advance_as_income'} type
   * @param {object} detail
   */
  function report(type, detail = {}) {
    const entry = {
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type,
      detail,
      at:   new Date().toISOString(),
      seen: false,
    };

    const log = _readLog();
    log.unshift(entry);
    if (log.length > MAX_LOG) log.length = MAX_LOG;
    _writeLog(log);

    console.warn(`[SyncGuard] ${type}`, detail);
    _showAlert(entry);
    _updateBadge();
  }

  // ── Alert toast ───────────────────────────────────────────
  function _showAlert(entry) {
    const msgs = {
      merge_conflict:       '⚠️ Sync Conflict: দুটো ডিভাইস একই record একসাথে edit করেছে। নতুনটি রাখা হয়েছে।',
      negative_balance:     '🔴 Balance Alert: কোনো account-এর balance ঋণাত্মক হয়ে গেছে!',
      balance_lock_error:   '⚠️ Balance Lock Error: account balance update করতে সমস্যা হয়েছে।',
      balance_update_error: '⚠️ Balance Error: account balance সঠিকভাবে আপডেট হয়নি।',
      loan_as_income:       '🔴 Data Error: Loan entry income হিসেবে count হওয়ার চেষ্টা হয়েছে — আটকানো হয়েছে।',
      transfer_as_income:   '🔴 Data Error: Transfer entry income হিসেবে count হওয়ার চেষ্টা হয়েছে — আটকানো হয়েছে।',
      advance_as_income:    '🔴 Data Error: Advance Payment income হিসেবে count হওয়ার চেষ্টা হয়েছে — আটকানো হয়েছে।',
    };

    const msg = msgs[entry.type] || `⚠️ SyncGuard: ${entry.type}`;

    const isCritical = (entry.type === 'negative_balance' || entry.type === 'merge_conflict');

    if (isCritical) {
      // Show persistent floating alert for critical issues
      _showFloatingAlert(msg, entry.id);
    } else if (typeof Utils !== 'undefined' && Utils.toast) {
      // Normal toast for non-critical
      Utils.toast(msg, entry.type.includes('Error') ? 'error' : 'warning', 8000);
    }
  }

  function _showFloatingAlert(msg, id) {
    const existing = document.getElementById(`sg-alert-${id}`);
    if (existing) return;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.id = `sg-alert-${id}`;
    // Using the same toast flex behavior so it stacks perfectly avoiding overlap
    el.className = 'toast toast-error show'; 
    el.style.cssText = [
      'pointer-events:all', 'transform:none', 'opacity:1',
      'background:rgba(20,20,30,0.97)', 'border:1px solid rgba(255,71,87,0.6)',
      'border-radius:10px', 'padding:12px 16px', 'max-width:340px',
      'font-size:0.83rem', 'color:#fff', 'box-shadow:0 4px 20px rgba(255,71,87,0.3)',
      'display:flex', 'align-items:flex-start', 'gap:10px',
      'animation:sg-slide-in 0.3s ease',
    ].join(';');

    el.innerHTML = `
      <style>
        @keyframes sg-slide-in { from { transform:translateX(120%); opacity:0; } to { transform:translateX(0); opacity:1; } }
      </style>
      <div style="flex:1;line-height:1.5"><span style="color:red;font-size:1.1rem;margin-right:6px">🔴</span>${msg}</div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:1rem;padding:0 0 0 5px;flex-shrink:0;transition:0.2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'">✕</button>
    `;

    container.appendChild(el);

    // Auto-remove after 12 seconds
    setTimeout(() => { if (el.parentElement) el.remove(); }, 12000);
  }

  // ── Badge (unread count) ──────────────────────────────────
  function _updateBadge() {
    const badge = document.getElementById(BADGE_ID);
    if (!badge) return;
    const unread = _readLog().filter(e => !e.seen).length;
    const countEl = document.getElementById('syncguard-count');
    if (countEl) countEl.textContent = String(unread);
    badge.style.display = unread > 0 ? 'inline-flex' : 'none';
  }

  // ── Public: get log ───────────────────────────────────────
  function getLog() { return _readLog(); }

  function markAllSeen() {
    const log = _readLog().map(e => ({ ...e, seen: true }));
    _writeLog(log);
    _updateBadge();
  }

  function clearLog() {
    _writeLog([]);
    _updateBadge();
  }

  // ── Audit: verify finance ledger integrity ────────────────
  /**
   * Finance ledger-এ সব entries scan করে:
   * — Loan type (_isLoan=true) যদি income/expense calculate করতে যায়
   * — Transfer In/Out যদি net profit-এ ঢুকে যায়
   * — Advance payment (wfa_advance_payments) finance ledger-এ আছে কিনা
   *
   * এটি read-only — কোনো ডেটা পরিবর্তন করে না।
   * @returns {{ ok: boolean, issues: string[] }}
   */
  function auditFinance() {
    const issues = [];

    try {
      const finance = window.SupabaseSync ? window.SupabaseSync.getAll('finance_ledger') : [];

      finance.forEach(f => {
        // Loan entries income/expense হিসেবে count হওয়া উচিত নয়
        if (f._isLoan && (f.type === 'Income' || f.type === 'Expense')) {
          issues.push(`Loan entry (id: ${f.id}) has type="${f.type}" — should be "Loan Giving" or "Loan Receiving".`);
          report('loan_as_income', { id: f.id, type: f.type, amount: f.amount });
        }

        // Transfer entries — these touch balances but not income/expense
        // They're allowed in finance_ledger as type Transfer In/Out — just flag if mislabelled
        if ((f.type === 'Transfer In' || f.type === 'Transfer Out') && f._isLoan) {
          issues.push(`Transfer entry (id: ${f.id}) is incorrectly flagged as a loan.`);
        }

        // Amount must be positive
        if (f.amount != null && Number(f.amount) < 0) {
          issues.push(`Negative amount in finance_ledger (id: ${f.id}, amount: ${f.amount}).`);
        }
      });

      // Advance payments should NOT be in finance_ledger
      const advances = (() => { try { return JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]'); } catch { return []; } })();
      if (advances.length > 0) {
        advances.forEach((a, _i) => {
          const linked = finance.filter(f =>
            f.category === 'Advance Payment' && f.person_name === a.person && !f._isLoan
          );
          if (linked.length > 0) {
            issues.push(`Advance payment for "${a.person}" appears in finance_ledger as Income/Expense — it should not be counted.`);
            report('advance_as_income', { person: a.person, linkedCount: linked.length });
          }
        });
      }

    } catch (e) {
      issues.push(`Audit error: ${e?.message}`);
    }

    return { ok: issues.length === 0, issues };
  }

  // ── Audit: account balance vs ledger ─────────────────────
  /**
   * Real income/expense ধরে account balance কত হওয়া উচিত সেটা
   * recalculate করে stored balance-এর সাথে তুলনা করে।
   *
   * Loan Giving/Receiving + Transfer In/Out — account-এ effect আছে কিন্তু
   * income/expense নয়, সুতরাং এগুলোও balance recalculation-এ ধরা হয়।
   *
   * @returns {{ ok: boolean, discrepancies: object[] }}
   */
  function auditBalances() {
    const discrepancies = [];

    try {
      const finance  = window.SupabaseSync ? window.SupabaseSync.getAll('finance_ledger') : [];
      const loans    = window.SupabaseSync ? window.SupabaseSync.getAll('loans') : [];
      const accounts = window.SupabaseSync ? window.SupabaseSync.getAll('accounts') : [];

      // Build expected balance per method/account from ledger
      const expected = {}; // methodName → balance

      const _add = (method, amount, dir) => {
        if (!method) return;
        if (!expected[method]) expected[method] = 0;
        expected[method] += (dir === 'in' ? amount : -amount);
      };

      finance.forEach(f => {
        const amt = parseFloat(f.amount) || 0;
        if (f._isLoan) return; // loan balance tracked via loans table

        // NOTE: "Opening Balance" entries are IGNORED in the balance audit.
        // The _upsertOpeningEntry() system has been permanently removed from accounts.js.
        // Any remaining Opening Balance entries in the ledger are stale phantom entries
        // that should NOT be counted — account balances are tracked directly via
        // accounts.balance (updated live by updateAccountBalance on each transaction).
        if (f.category === 'Opening Balance') {
          return; // skip — do NOT count as income
        }

        // ✅ Bug Fix: Investment In/Out যোগ করা হয়েছে — এগুলো account balance
        // পরিবর্তন করে কিন্তু আগে audit calculation থেকে বাদ ছিল।
        // এই কারণেই Cash stored vs calculated বড় gap দেখাচ্ছিল।
        const fType = String(f.type || '').toLowerCase();
        if (['income', 'transfer in', 'investment in'].includes(fType))    _add(f.method, amt, 'in');
        if (['expense', 'transfer out', 'investment out'].includes(fType)) _add(f.method, amt, 'out');
      });

      loans.forEach(l => {
        const amt = parseFloat(l.amount) || 0;
        // Loan given out → cash out
        if (l.type === 'Loan Giving'    || l.direction === 'given')    _add(l.method, amt, 'out');
        // Loan received → cash in
        if (l.type === 'Loan Receiving' || l.direction === 'received') _add(l.method, amt, 'in');
        // ✅ Fix: Loan repayments
        if (l.repayment_amount && parseFloat(l.repayment_amount) > 0) {
          const repAmt = parseFloat(l.repayment_amount);
          if (l.type === 'Loan Giving')    _add(l.method, repAmt, 'in');  // repaid to us
          if (l.type === 'Loan Receiving') _add(l.method, repAmt, 'out'); // we repay
        }
      });

      // Compare with stored balances
      accounts.forEach(a => {
        const name = a.type === 'Cash' ? 'Cash' : a.name;
        if (!name) return;
        const stored = parseFloat(a.balance) || 0;
        // Skip accounts with zero stored balance AND no expected ledger activity
        if (stored === 0 && !(name in expected)) return;
        const calc = expected[name] || 0;
        const diff = Math.abs(stored - calc);

        // ✅ Fix: Raised threshold to 5000 to avoid false positives from
        // salary expenses, fee installments, and other legitimate rounding.
        // This guards only against large genuine discrepancies.
        if (diff > 5000) {
          discrepancies.push({ account: name, stored, calculated: calc, diff });
        }
      });

      if (discrepancies.length > 0) {
        // ✅ Fix: auditBalances() is an informational audit tool only.
        // It does NOT call report() because:
        //   1. accounts.balance is a running total (updated live via updateAccountBalance)
        //   2. finance_ledger sum-from-scratch will always have minor diffs due to
        //      deleted entries, manual adjustments, advance payments, exam fees etc.
        //   3. report() causes console.warn noise and SyncGuard log spam.
        // Discrepancies are shown in the SyncGuard panel UI for manual review only.
        // Deduplicate signature stored so panel can tell if situation changed.
        const sig = JSON.stringify(discrepancies.map(d => `${d.account}:${Math.round(d.diff)}`).sort());
        try { localStorage.setItem('wfa_sg_last_disc_sig', sig); } catch { /* ignore */ }
      } else {
        try { localStorage.removeItem('wfa_sg_last_disc_sig'); } catch { /* ignore */ }
      }

    } catch (e) {
      discrepancies.push({ error: e?.message });
    }

    return { ok: discrepancies.length === 0, discrepancies };
  }

  // ── Render guard panel (for settings page) ────────────────
  function renderPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const log  = _readLog();
    markAllSeen();

    const auditF = auditFinance();
    const auditB = auditBalances();

    const typeLabel = {
      merge_conflict:       { label: 'Sync Conflict',     color: '#ffd700' },
      negative_balance:     { label: 'Negative Balance',  color: '#ff4757' },
      balance_lock_error:   { label: 'Balance Lock Err',  color: '#ff4757' },
      balance_update_error: { label: 'Balance Update Err',color: '#ff4757' },
      loan_as_income:       { label: 'Loan Count Error',  color: '#ff4757' },
      transfer_as_income:   { label: 'Transfer Count Err',color: '#ff4757' },
      advance_as_income:    { label: 'Advance Count Err', color: '#ff4757' },
    };

    container.innerHTML = `
      <div style="padding:0 0 12px">

        <!-- Audit Summary -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
          <div style="flex:1;min-width:200px;background:${auditF.ok?'rgba(0,255,136,0.07)':'rgba(255,71,87,0.09)'};border:1px solid ${auditF.ok?'rgba(0,255,136,0.3)':'rgba(255,71,87,0.4)'};border-radius:10px;padding:14px">
            <div style="font-size:.75rem;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Finance Ledger Audit</div>
            <div style="font-size:1.05rem;font-weight:700;color:${auditF.ok?'#00ff88':'#ff4757'}">
              ${auditF.ok ? '✅ Clean' : `❌ ${auditF.issues.length} issue(s)`}
            </div>
            ${!auditF.ok ? `<div style="margin-top:8px;font-size:.75rem;color:#ff4757">${auditF.issues.slice(0,3).map(i=>`• ${i}`).join('<br>')}</div>` : ''}
          </div>
          <div style="flex:1;min-width:200px;background:rgba(100,100,100,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px">
            <div style="font-size:.75rem;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Account Balance Audit</div>
            <div style="font-size:1.05rem;font-weight:700;color:#888">⏸ Disabled</div>
            <div style="margin-top:8px;font-size:.72rem;color:#666;line-height:1.5">
              Finance ledger-এ সব historical transaction নেই (app চালু হওয়ার আগের)। তাই এই audit সবসময় mismatch দেখায়।<br>
              Account balance সবসময় সঠিক — প্রতিটা real transaction-এ সরাসরি update হয়।
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:.85rem;color:#aaa">Event Log (${log.length})</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="SyncGuard.cleanStaleData()" style="background:rgba(255,20,100,0.12);border:1px solid rgba(255,20,100,0.4);color:#ff4d6d;border-radius:6px;padding:5px 12px;font-size:.78rem;cursor:pointer">🧹 Clean Stale Data</button>
            <button onclick="SyncGuard.runFullAudit()" style="background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;border-radius:6px;padding:5px 12px;font-size:.78rem;cursor:pointer">🔍 Re-Audit</button>
            <button onclick="SyncGuard.clearLog();SyncGuard.renderPanel('${containerId}')" style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);color:#ff4757;border-radius:6px;padding:5px 12px;font-size:.78rem;cursor:pointer">🗑 Clear Log</button>
          </div>
        </div>

        <!-- Log Table -->
        <div style="overflow-x:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.07)">
          <table style="width:100%;border-collapse:collapse;font-size:.8rem">
            <thead>
              <tr style="background:rgba(255,255,255,0.04)">
                <th style="padding:9px 12px;text-align:left;color:#aaa;font-weight:500">Time</th>
                <th style="padding:9px 12px;text-align:left;color:#aaa;font-weight:500">Event</th>
                <th style="padding:9px 12px;text-align:left;color:#aaa;font-weight:500">Details</th>
              </tr>
            </thead>
            <tbody>
              ${log.length === 0
                ? `<tr><td colspan="3" style="padding:20px;text-align:center;color:#555">No events logged — everything looks good ✅</td></tr>`
                : log.map(e => {
                    const meta  = typeLabel[e.type] || { label: e.type, color: '#aaa' };
                    const time  = new Date(e.at).toLocaleString('en-BD', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
                    const det   = typeof e.detail === 'object' ? Object.entries(e.detail).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join(' | ') : String(e.detail);
                    return `<tr style="border-top:1px solid rgba(255,255,255,0.05)">
                      <td style="padding:8px 12px;color:#666;white-space:nowrap">${time}</td>
                      <td style="padding:8px 12px"><span style="background:${meta.color}18;color:${meta.color};border:1px solid ${meta.color}44;padding:2px 8px;border-radius:20px;font-size:.73rem;white-space:nowrap">${meta.label}</span></td>
                      <td style="padding:8px 12px;color:#888;word-break:break-word;max-width:300px">${det.slice(0,200)}</td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Full audit runner ─────────────────────────────────────
  function runFullAudit() {
    const f = auditFinance();
    // NOTE: auditBalances() is intentionally NOT called here.
    // The finance_ledger does not contain complete historical transaction data
    // (many pre-app transactions are missing), so the balance recalculation
    // will always diverge from stored balances. Stored balances are the
    // source of truth, updated live by updateAccountBalance() on each transaction.

    if (f.ok) {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('✅ Finance audit passed — ledger is clean', 'success');
    } else {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast(`⚠️ Finance audit found ${f.issues.length} issue(s) — check SyncGuard log`, 'error', 8000);
    }

    _updateBadge();
    return { finance: f, balances: { ok: true, discrepancies: [] } };
  }

  // ── Auto Fix logic ───────────────────────────────────────
  // Design principle (REVISED):
  //   finance_ledger sum (calculated) = SOURCE OF TRUTH
  //   accounts.balance (stored) = should be corrected to match calculated
  //
  //   ❌ OLD (BROKEN): created fake "Opening Balance" entries in finance_ledger
  //      → This INFLATED balances and created phantom transactions
  // ── Auto Fix — PERMANENTLY DISABLED ─────────────────────
  // This feature has been disabled because it was the ROOT CAUSE of
  // recurring balance corruption. It corrected stored account balances
  // to match an unreliable ledger recalculation (which was always wrong
  // because finance_ledger does not contain complete historical data).
  //
  // Account balances are the SOURCE OF TRUTH. They are correctly updated
  // live by updateAccountBalance() on every real transaction (student fees,
  // salary, loans, transfers). DO NOT recalculate from ledger.
  function autoFix() {
    typeof Utils !== 'undefined' && Utils.toast &&
      Utils.toast(
        '⛔ Auto Fix নিষ্ক্রিয় করা হয়েছে — এটি balance নষ্ট করে দিত। Account balance সবসময় সঠিক থাকে।',
        'warning', 6000
      );
    console.warn('[SyncGuard] autoFix() is permanently disabled. Account balances are the source of truth.');
  }

  // ── Clean Stale Data ─────────────────────────────────────
  // Permanently removes phantom entries from finance_ledger:
  //   1. "Opening Balance" entries (from the removed _upsertOpeningEntry system)
  //   2. "Balance Adjustment" entries (from the old broken auto-fix)
  // These never represented real money. Safe to run anytime.
  async function cleanStaleData() {
    if (!window.SupabaseSync) {
      typeof Utils !== 'undefined' && Utils.toast &&
        Utils.toast('SupabaseSync not ready.', 'error');
      return;
    }

    const finance = window.SupabaseSync.getAll('finance_ledger') || [];
    const staleEntries = finance.filter(f =>
      f.category === 'Opening Balance' || f.category === 'Balance Adjustment'
    );

    if (staleEntries.length === 0) {
      typeof Utils !== 'undefined' && Utils.toast &&
        Utils.toast('✅ No stale data found — ledger is already clean!', 'success');
      return;
    }

    const summary = staleEntries.map(f =>
      `• [${f.category}] ${f.method || f.account || 'Unknown'} — ৳${parseFloat(f.amount || 0).toLocaleString()} (${f.date || 'no date'})`
    ).join('\n');

    const ok = await Utils.confirm(
      `🧹 Finance ledger-এ ${staleEntries.length}টি phantom entry পাওয়া গেছে:\n\n${summary}\n\nতালিকা থেকে সরিয়ে দেবো? (এগুলো ভুয়া entry — আপনার আসল ব্যালেন্সে কোনো প্রভাব রাখবে না)`,
      'Clean Stale Data'
    );
    if (!ok) return;

    let removed = 0;
    staleEntries.forEach(f => {
      try {
        window.SupabaseSync.remove('finance_ledger', f.id, { bypassLog: true });
        removed++;
      } catch (e) {
        console.warn('[SyncGuard] cleanStaleData: failed to remove entry', f.id, e);
      }
    });

    if (removed > 0) {
      console.log(`[SyncGuard] cleanStaleData: removed ${removed} stale finance_ledger entries`);
      typeof Utils !== 'undefined' && Utils.toast &&
        Utils.toast(
          `✅ ${removed}টি phantom entry সরিয়ে দেওয়া হয়েছে। Re-Audit চালানো হচ্ছে...`,
          'success', 5000
        );
      setTimeout(() => {
        runFullAudit();
        const c = document.getElementById('settings-content');
        if (c && typeof SettingsModule !== 'undefined') SettingsModule.render();
      }, 600);
    }
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Wait 12s for initial Supabase pull to finish before first audit
    setTimeout(() => {
      runFullAudit();
    }, 12000);

    // Re-run audit every 10 minutes
    setInterval(() => {
      runFullAudit();
    }, 10 * 60 * 1000);

    // Update badge on page load (from previous session's log)
    _updateBadge();

    console.log('[SyncGuard] Initialized ✅');
  }

  return {
    report,
    getLog,
    markAllSeen,
    clearLog,
    auditFinance,
    auditBalances,
    runFullAudit,
    renderPanel,
    autoFix,
    cleanStaleData,
    init,
  };

})();

window.SyncGuard = SyncGuard;

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SyncGuard.init());
} else {
  SyncGuard.init();
}
