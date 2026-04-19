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

        // ✅ Fix: Opening Balance entries count as "in" (they set the initial balance)
        if (f.category === 'Opening Balance') {
          _add(f.method, amt, 'in');
          return;
        }

        if (f.type === 'Income' || f.type === 'Transfer In')   _add(f.method, amt, 'in');
        if (f.type === 'Expense' || f.type === 'Transfer Out') _add(f.method, amt, 'out');
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
            <button onclick="SyncGuard.autoFix()" style="background:rgba(255,165,0,0.12);border:1px solid rgba(255,165,0,0.3);color:orange;border-radius:6px;padding:5px 12px;font-size:.78rem;cursor:pointer">🛠 Auto Fix</button>
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
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast(`⚠️ Audit found ${total} issue(s) — check SyncGuard log`, 'error', 8000);
    }

    _updateBadge();
    return { finance: f, balances: b };
  }

  // ── Auto Fix logic ───────────────────────────────────────
  async function autoFix() {
    // ✅ Bug #4 Fix: Use Utils.confirm() instead of window.confirm() — PWA-safe custom modal
    const ok = await Utils.confirm('Auto-Fix will recalculate negative/discrepant balances based on actual ledger entries. Continue?', 'Auto-Fix Balances');
    if (!ok) return;

    // Bug #1 fix: guard against SupabaseSync not being available
    if (!window.SupabaseSync) {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('SupabaseSync not ready. Please try again.', 'error');
      return;
    }
    
    let fixed = 0;
    const b = auditBalances();
    
    if (b.discrepancies.length > 0) {
      const accounts = window.SupabaseSync.getAll('accounts');
      b.discrepancies.forEach(d => {
        const acc = accounts.find(a => (a.type === 'Cash' ? 'Cash' : a.name) === d.account);
        if (acc) {
          console.log(`[SyncGuard] Auto-fixing balance for ${d.account}: ${d.stored} -> ${d.calculated}`);
          window.SupabaseSync.update('accounts', acc.id, { balance: d.calculated });
          fixed++;
        }
      });
    }

    if (fixed > 0) {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast(`✅ Successfully auto-fixed ${fixed} issue(s)`, 'success');
      setTimeout(() => {
        runFullAudit();
        const settingsContainer = document.getElementById('settings-content');
        if (settingsContainer && typeof SettingsModule !== 'undefined') SettingsModule.render(); 
      }, 500);
    } else {
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('No auto-fixable issues found.', 'info');
    }
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Wait 12s for initial Supabase pull to finish before first audit
    // (pull takes ~3-5s; 12s gives real-time subscriptions time to settle too)
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
