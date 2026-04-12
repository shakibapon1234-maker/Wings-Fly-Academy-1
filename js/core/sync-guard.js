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

    // Show toast if Utils available
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(msg, entry.type.includes('Error') || entry.type === 'negative_balance' ? 'error' : 'warning');
    }

    // Also show a persistent floating alert for critical issues
    if (entry.type === 'negative_balance' || entry.type === 'merge_conflict') {
      _showFloatingAlert(msg, entry.id);
    }
  }

  function _showFloatingAlert(msg, id) {
    const existing = document.getElementById(`sg-alert-${id}`);
    if (existing) return;

    const el = document.createElement('div');
    el.id = `sg-alert-${id}`;
    el.style.cssText = [
      'position:fixed', 'bottom:80px', 'right:20px', 'z-index:99999',
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
      <div style="flex:1;line-height:1.5">${msg}</div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:1rem;padding:0;flex-shrink:0">✕</button>
    `;

    document.body.appendChild(el);

    // Auto-remove after 12 seconds
    setTimeout(() => { el.remove(); }, 12000);
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
      const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
      if (advances.length > 0) {
        advances.forEach((a, i) => {
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

      // Build expected balance per account from ledger
      const expected = {}; // methodName → balance

      const _add = (method, amount, dir) => {
        if (!method) return;
        if (!expected[method]) expected[method] = 0;
        expected[method] += (dir === 'in' ? amount : -amount);
      };

      finance.forEach(f => {
        const amt = parseFloat(f.amount) || 0;
        if (f._isLoan) return; // loan balance tracked via loans table
        if (f.type === 'Income' || f.type === 'Transfer In')   _add(f.method, amt, 'in');
        if (f.type === 'Expense' || f.type === 'Transfer Out') _add(f.method, amt, 'out');
      });

      loans.forEach(l => {
        const amt = parseFloat(l.amount) || 0;
        if (l.type === 'Loan Giving'    || l.direction === 'given')    _add(l.method, amt, 'out');
        if (l.type === 'Loan Receiving' || l.direction === 'received') _add(l.method, amt, 'in');
      });

      // Compare with stored balances
      accounts.forEach(a => {
        const name = a.type === 'Cash' ? 'Cash' : a.name;
        if (!name || !(name in expected)) return;
        const stored = parseFloat(a.balance) || 0;
        const calc   = expected[name] || 0;
        const diff   = Math.abs(stored - calc);

        if (diff > 1) { // allow ৳1 rounding tolerance
          discrepancies.push({ account: name, stored, calculated: calc, diff });
        }
      });

      if (discrepancies.length > 0) {
        report('negative_balance', { message: 'Balance discrepancy detected', discrepancies });
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
          <div style="flex:1;min-width:200px;background:${auditB.ok?'rgba(0,255,136,0.07)':'rgba(255,71,87,0.09)'};border:1px solid ${auditB.ok?'rgba(0,255,136,0.3)':'rgba(255,71,87,0.4)'};border-radius:10px;padding:14px">
            <div style="font-size:.75rem;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Account Balance Audit</div>
            <div style="font-size:1.05rem;font-weight:700;color:${auditB.ok?'#00ff88':'#ff4757'}">
              ${auditB.ok ? '✅ Balanced' : `❌ ${auditB.discrepancies.length} mismatch(es)`}
            </div>
            ${!auditB.ok ? `<div style="margin-top:8px;font-size:.75rem;color:#ff4757">
              ${auditB.discrepancies.slice(0,3).map(d=>
                d.error ? `• Error: ${d.error}` :
                `• ${d.account}: stored ৳${Math.round(d.stored).toLocaleString()} vs calculated ৳${Math.round(d.calculated).toLocaleString()} (diff ৳${Math.round(d.diff).toLocaleString()})`
              ).join('<br>')}
            </div>` : ''}
          </div>
        </div>

        <!-- Controls -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:.85rem;color:#aaa">Event Log (${log.length})</div>
          <div style="display:flex;gap:8px">
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
    const b = auditBalances();

    if (f.ok && b.ok) {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('✅ Full audit passed — no issues found', 'success');
    } else {
      const total = f.issues.length + b.discrepancies.length;
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast(`⚠️ Audit found ${total} issue(s) — check SyncGuard log`, 'error');
    }

    _updateBadge();
    return { finance: f, balances: b };
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Run audit shortly after page load
    setTimeout(() => {
      runFullAudit();
    }, 3500);

    // Re-run audit every 5 minutes
    setInterval(() => {
      runFullAudit();
    }, 5 * 60 * 1000);

    // Update badge on page load
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
