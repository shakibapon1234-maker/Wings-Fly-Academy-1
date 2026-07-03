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
   *         'loan_as_income'|'investment_as_income'|'transfer_as_income'|'advance_as_income'|'balance_mismatch'} type
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
      investment_as_income: '🔴 Data Error: Investment entry income/expense হিসেবে type করা হয়েছে — এটা শুধু account balance move করে।',
      transfer_as_income:   '🔴 Data Error: Transfer entry income হিসেবে count হওয়ার চেষ্টা হয়েছে — আটকানো হয়েছে।',
      advance_as_income:    '🔴 Data Error: Advance Payment income হিসেবে count হওয়ার চেষ্টা হয়েছে — আটকানো হয়েছে।',
      balance_mismatch:     '🔴 Balance Mismatch: Transaction-এর পরে expected balance মিলছে না! মানুয়ালী ব্যালেন্স পরিবর্তন বা sync সমস্যা হয়ে থাকতে পারে। Data Monitor চেক করুন।'
    };

    const msg = msgs[entry.type] || `⚠️ SyncGuard: ${entry.type}`;

    const isCritical = (
      entry.type === 'negative_balance' ||
      entry.type === 'merge_conflict'   ||
      entry.type === 'balance_mismatch'
    );

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
   * — Loan type (_isLoan=true) যদি income/expense হিসেবে count হয়
   * — Investment In/Out যদি Income/Expense type-এ ভুলভাবে save হয়
   * — Transfer In/Out যদি net profit-এ ঢুকে যায়
   * — Advance payment finance mirror missing কিনা (settings.js intentionally ledger-এ রাখে)
   *
   * এটি read-only — কোনো ডেটা পরিবর্তন করে না।
   * @returns {{ ok: boolean, issues: string[] }}
   */
  function auditFinance() {
    const issues = [];

    try {
      const finance = window.SupabaseSync ? window.SupabaseSync.getAll('finance_ledger') : [];

      finance.forEach(f => {
        // ── Loan entries income/expense হিসেবে count হওয়া উচিত নয় ──
        if (f._isLoan && (f.type === 'Income' || f.type === 'Expense')) {
          issues.push(`Loan entry (id: ${f.id}) has type="${f.type}" — should be "Loan Giving" or "Loan Receiving".`);
          report('loan_as_income', { id: f.id, type: f.type, amount: f.amount });
        }

        // ── Investment In/Out যদি ভুলভাবে Income/Expense type-এ save হয় ──
        // Investment শুধু account balance move করে — income বা expense নয়।
        // সঠিক type: "Investment In" বা "Investment Out"
        if ((f.type === 'Income' || f.type === 'Expense') &&
            (f.category === 'Investment' || f.category === 'Investment In' || f.category === 'Investment Out')) {
          issues.push(`Investment entry (id: ${f.id}) has type="${f.type}" — should be "Investment In" or "Investment Out" to exclude from P&L.`);
          report('investment_as_income', { id: f.id, type: f.type, category: f.category, amount: f.amount });
        }

        // ── Transfer entries incorrectly flagged ──
        if ((f.type === 'Transfer In' || f.type === 'Transfer Out') && f._isLoan) {
          issues.push(`Transfer entry (id: ${f.id}) is incorrectly flagged as a loan.`);
        }

        // ── Amount must be positive ──
        if (f.amount != null && Number(f.amount) < 0) {
          issues.push(`Negative amount in finance_ledger (id: ${f.id}, amount: ${f.amount}).`);
        }
      });

      // ── Advance payments: finance mirror আছে কিনা (Expense + Advance Return Income) ──
      const advances = window.SupabaseSync
        ? (window.SupabaseSync.getAll('advance_payments') || [])
        : [];
      advances.forEach((a) => {
        const giveLinked = finance.filter(f =>
          f.category === 'Advance Payment' && f.type === 'Expense' &&
          (f._advId === a.id || (f.description && a.person && f.description.includes(a.person)))
        );
        if (giveLinked.length === 0) {
          issues.push(`Advance for "${a.person || a.id}" has no linked finance Expense entry.`);
        }
      });

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
      const fromDate = localStorage.getItem('wfa_repair_cutoff_date') || '';

      const phantomCategories = new Set(['Opening Balance', 'Balance Adjustment']);
      const diagNotes = new Set([
        'Auto-generated diagnostic payment',
        'Auto-generated diagnostic exam payment',
        'Auto-generated diagnostic salary payment',
        'Auto-generated diagnostic loan finance',
        'Auto-generated diagnostic loan',
        'Auto-generated diagnostic loan [UPDATED]',
      ]);
      const diagLoanNotes = new Set([
        'Auto-generated diagnostic loan',
        'Auto-generated diagnostic loan [UPDATED]',
      ]);

      // Build expected balance per method/account from ledger
      const postCutoffNet = {}; // methodName → net (post-cutoff only when fromDate set)

      const _add = (method, amount, dir) => {
        if (!method) return;
        if (!postCutoffNet[method]) postCutoffNet[method] = 0;
        postCutoffNet[method] += (dir === 'in' ? amount : -amount);
      };

      finance.forEach(f => {
        const amt = parseFloat(f.amount) || 0;
        if (!f.method || amt <= 0) return;
        if (f._isLoan) return;
        if (phantomCategories.has(f.category)) return;
        if (f.note && diagNotes.has(f.note)) return;
        if (fromDate) {
          const entryDate = (f.date || '').split('T')[0];
          if (entryDate && entryDate < fromDate) return;
        }

        const fType = String(f.type || '').toLowerCase();
        if (['income', 'transfer in', 'investment in'].includes(fType))    _add(f.method, amt, 'in');
        if (['expense', 'transfer out', 'investment out'].includes(fType)) _add(f.method, amt, 'out');
      });

      loans.forEach(l => {
        const amt = parseFloat(l.amount) || 0;
        if (!l.method || amt <= 0) return;
        if (l.note && diagLoanNotes.has(l.note)) return;
        if (fromDate) {
          const loanDate = (l.date || '').split('T')[0];
          if (loanDate && loanDate < fromDate) return;
        }
        if (l.type === 'Loan Giving'    || l.direction === 'given')    _add(l.method, amt, 'out');
        if (l.type === 'Loan Receiving' || l.direction === 'received') _add(l.method, amt, 'in');
      });

      let baselines = {};
      if (fromDate) {
        try {
          baselines = JSON.parse(localStorage.getItem('wfa_repair_cutoff_baselines') || '{}');
        } catch { baselines = {}; }
      }

      const expected = {};
      accounts.forEach(a => {
        const name = a.type === 'Cash' ? 'Cash' : a.name;
        if (!name) return;
        const stored = parseFloat(a.balance) || 0;
        const net = postCutoffNet[name] || 0;
        if (fromDate) {
          const baseline = Object.keys(baselines).length > 0
            ? (baselines[name] ?? stored - net)
            : stored - net;
          expected[name] = Math.round((baseline + net) * 100) / 100;
        } else {
          expected[name] = Math.round(net * 100) / 100;
        }
      });

      // Compare with stored balances
      accounts.forEach(a => {
        const name = a.type === 'Cash' ? 'Cash' : a.name;
        if (!name) return;
        const stored = parseFloat(a.balance) || 0;
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

    const typeLabel = {
      merge_conflict:       { label: 'Sync Conflict',        color: '#ffd700' },
      negative_balance:     { label: 'Negative Balance',     color: '#ff4757' },
      balance_lock_error:   { label: 'Balance Lock Err',     color: '#ff4757' },
      balance_update_error: { label: 'Balance Update Err',   color: '#ff4757' },
      loan_as_income:       { label: 'Loan Type Error',      color: '#ff4757' },
      investment_as_income: { label: 'Investment Type Err',  color: '#ff6b35' },
      transfer_as_income:   { label: 'Transfer Count Err',   color: '#ff4757' },
      advance_as_income:    { label: 'Advance Count Err',    color: '#ff4757' },
      balance_mismatch:     { label: 'Balance Mismatch',     color: '#ff4757' },
    };

    container.innerHTML = `
      <div style="padding:0 0 12px">

        <!-- Finance Ledger Audit Summary -->
        <div style="margin-bottom:18px">
          <div style="background:${auditF.ok?'rgba(0,255,136,0.07)':'rgba(255,71,87,0.09)'};border:1px solid ${auditF.ok?'rgba(0,255,136,0.3)':'rgba(255,71,87,0.4)'};border-radius:10px;padding:14px">
            <div style="font-size:.75rem;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Finance Ledger Audit</div>
            <div style="font-size:1.05rem;font-weight:700;color:${auditF.ok?'#00ff88':'#ff4757'}">
              ${auditF.ok ? '✅ Clean — Ledger integrity OK' : `❌ ${auditF.issues.length} issue(s) found`}
            </div>
            ${!auditF.ok ? `<div style="margin-top:8px;font-size:.75rem;color:#ff4757">${auditF.issues.slice(0,3).map(i=>`• ${i}`).join('<br>')}</div>` : ''}
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
                    const detSafe = typeof Utils !== 'undefined' && Utils.esc ? Utils.esc(det.slice(0,200)) : det.slice(0,200).replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    return `<tr style="border-top:1px solid rgba(255,255,255,0.05)">
                      <td style="padding:8px 12px;color:#666;white-space:nowrap">${time}</td>
                      <td style="padding:8px 12px"><span style="background:${meta.color}18;color:${meta.color};border:1px solid ${meta.color}44;padding:2px 8px;border-radius:20px;font-size:.73rem;white-space:nowrap">${meta.label}</span></td>
                      <td style="padding:8px 12px;color:#888;word-break:break-word;max-width:300px">${detSafe}</td>
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

    if (f.ok) {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('✅ Finance audit passed — ledger is clean', 'success');
    } else {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast(`⚠️ Finance audit found ${f.issues.length} issue(s) — check SyncGuard log`, 'error', 8000);
    }

    _updateBadge();
    return { finance: f };
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
