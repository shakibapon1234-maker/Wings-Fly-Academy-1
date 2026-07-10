/**
 * settings-monitor.js — Data Monitor panel (settings.js থেকে আলাদা করা হয়েছে)
 *
 * এই module settings.js-এর ভেতরে inject() pattern ব্যবহার করে।
 * সমস্ত Data Monitor UI এবং logic এখানে।
 *
 * ROOT CAUSE FIX (এই version):
 * আগে supabase-sync.js-এ _logRecentChange() _pendingSnapshot:true দিয়ে entry তৈরি করতো,
 * তারপর updateAccountBalance() শেষে _finalizeMonitorSnapshot() snapshot নিতো।
 * কিন্তু finance.js-এ order ছিল: updateAccountBalance() → SupabaseSync.insert()।
 * তাই _finalizeMonitorSnapshot() call হতো insert()-এর আগে — তখন কোনো pending entry নেই।
 * 2s fallback দিয়ে finalize হতো কিন্তু isFallback=true তাই snapshot কার্যত empty থাকতো।
 *
 * FIX: supabase-sync.js-এ _logRecentChange()-এ সরাসরি _getMonitorSnapshot() call করা হয়
 * কারণ balance update ইতিমধ্যে complete। কোনো deferred/pending mechanism নেই।
 */

'use strict';

window.SettingsMonitor = (function () {

  /* ══════════════════════════════════════════════════════════
     PANEL HTML
  ══════════════════════════════════════════════════════════ */
  function buildPanelHTML(activeTab) {
    const transactions = _loadTransactions();

    const txBadge = type => {
      const t = String(type || '').toLowerCase();
      if (t === 'income')           return 'badge-success';
      if (t === 'expense')          return 'badge-error';
      if (t.startsWith('transfer')) return 'badge-warning';
      if (t === 'loan giving')      return 'badge-warning';
      if (t === 'loan receiving')   return 'badge-info';
      return 'badge-info';
    };

    const rows = transactions.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">No transactions yet — Income বা Expense add করলে এখানে দেখাবে।</td></tr>`
      : transactions.map((c, i) => {
          const actionLabel = c.action === 'update'  ? '✏️ Edit'
                           : c.action === 'delete'  ? '🗑️ Delete'
                           : c.action === 'restore' ? '↩️ Restore'
                           : '➕ New';
          const actionColor = c.action === 'update'  ? '#00d9ff'
                           : c.action === 'delete'  ? '#ff4757'
                           : c.action === 'restore' ? '#ffd700'
                           : '#00ff88';
          const actionBg = c.action === 'update'  ? 'rgba(0,217,255,0.10)'
                        : c.action === 'delete'  ? 'rgba(255,71,87,0.10)'
                        : c.action === 'restore' ? 'rgba(255,215,0,0.10)'
                        : 'rgba(0,255,136,0.10)';

          // rebuilt vs real snapshot indicator
          const hasSnap = !!(c.snapshot && c.snapshot.accounts && c.snapshot.accounts.list);
          const snapshotBadge = c.rebuilt
            ? '<span style="font-size:.62rem;color:#ffd700;opacity:.7;margin-left:4px" title="Rebuild থেকে তৈরি — আসল snapshot নয়">🔄</span>'
            : hasSnap
              ? '<span style="font-size:.62rem;color:#00ff88;opacity:.5;margin-left:4px" title="Real-time snapshot ✓">📸</span>'
              : '<span style="font-size:.62rem;color:#ff4757;opacity:.6;margin-left:4px" title="Snapshot নেই">⚠️</span>';

          const amtColor = String(c.type || '').toLowerCase() === 'expense' ? 'var(--error)' : 'var(--success)';
          // Read-only audit trail: show stored snapshots only, never recalculate balances.
          const afterTotal = Number(c.snapshot?.accounts?.totalBalance);
          const beforeTotal = Number(transactions[i + 1]?.snapshot?.accounts?.totalBalance);
          const balanceTrail = Number.isFinite(afterTotal)
            ? `${Number.isFinite(beforeTotal) ? _taka(beforeTotal) + ' → ' : '— → '}${_taka(afterTotal)}`
            : 'Snapshot নেই';

          return `
          <tr class="monitor-recent-row" style="cursor:pointer" onclick="SettingsMonitor.showSnapshot(${i})" title="Click to see account snapshot at this transaction">
            <td>${i + 1}${snapshotBadge}</td>
            <td style="font-size:.82rem">${c.date || '—'}</td>
            <td><span style="font-size:.72rem;font-weight:700;color:${actionColor};background:${actionBg};border:1px solid ${actionColor}44;padding:2px 8px;border-radius:20px;white-space:nowrap">${actionLabel}</span></td>
            <td><span class="badge ${txBadge(c.type)}">${c.type || '—'}</span></td>
            <td style="font-size:.82rem">${_esc(c.category) || '—'}</td>
            <td style="font-size:.82rem">${_esc(c.person) || '—'}</td>
            <td class="text-right" style="font-family:var(--font-ui);font-size:.85rem;color:${amtColor}">${c.amount ? _taka(c.amount) : '—'}</td><td class="text-right" style="font-family:var(--font-ui);font-size:.76rem;color:#f0c040;white-space:nowrap">${balanceTrail}</td>
          </tr>
          <tr><td colspan="7" style="padding:0"><div class="monitor-bar" style="width:${Math.max(15, 100 - i * 9)}%"></div></td></tr>`;
        }).join('');

    return `
    <div class="settings-panel ${activeTab === 'monitor' ? 'active' : ''}" data-panel="monitor">
      <div class="settings-card glow-purple">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> DATA MONITOR</div>
          <div style="display:flex;align-items:center;gap:10px">
            <button type="button" class="btn btn-outline btn-sm" onclick="SettingsMonitor.refresh()"><i class="fa fa-rotate"></i> Refresh</button>

          </div>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Last 15 financial transactions। একটি row-এ click করলে সেই সময়ের account balance snapshot দেখাবে।</p>

        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>DATE</th><th>ACTION</th><th>TYPE</th><th>CATEGORY</th><th>PERSON / DETAIL</th><th class="text-right">AMOUNT</th><th class="text-right">RECORDED BALANCE</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     SHOW SNAPSHOT MODAL
  ══════════════════════════════════════════════════════════ */
  function showSnapshot(index) {
    const transactions = _loadTransactions();
    const item = transactions[index];
    if (!item) return _showLiveSnapshot();

    const snapshot       = item.snapshot || {};
    const isRebuilt      = !!item.rebuilt;
    const hasRealSnap    = !!(snapshot.accounts && snapshot.accounts.list);

    const students   = snapshot.students  || {};
    const accounts   = snapshot.accounts  || {};
    const finance    = snapshot.finance   || {};
    const batchSnap  = snapshot.batch     || {};
    const accountList = accounts.list || [];
    const grandTotal  = accounts.totalBalance || 0;

    const snapshotTime = snapshot.recordedAt
      ? new Date(snapshot.recordedAt).toLocaleString('en-BD', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : (item.date || '—');

    // Type color
    const typeColorMap = {
      'Income':        { bg:'rgba(0,255,136,0.12)',  border:'rgba(0,255,136,0.30)',  text:'#00ff88' },
      'Expense':       { bg:'rgba(255,71,87,0.12)',  border:'rgba(255,71,87,0.30)',  text:'#ff4757' },
      'Transfer In':   { bg:'rgba(255,170,0,0.12)',  border:'rgba(255,170,0,0.30)',  text:'#ffaa00' },
      'Transfer Out':  { bg:'rgba(255,170,0,0.12)',  border:'rgba(255,170,0,0.30)',  text:'#ffaa00' },
      'Loan Giving':   { bg:'rgba(255,107,53,0.12)', border:'rgba(255,107,53,0.30)', text:'#ff6b35' },
      'Loan Receiving':{ bg:'rgba(0,212,255,0.12)',  border:'rgba(0,212,255,0.30)',  text:'#00d4ff' },
    };
    const tc = typeColorMap[item.type] || { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.2)', text:'#fff' };

    // Account balance cards
    const accountCards = accountList.length > 0
      ? accountList.map(a => {
          const isMobile   = ['mobile','bkash','nagad','rocket','bikash'].some(k => (a.name||'').toLowerCase().includes(k) || (a.type||'').toLowerCase().includes(k));
          const isBank     = (a.type||'').toLowerCase().includes('bank');
          const icon       = isMobile ? '📱' : isBank ? '🏦' : '💵';
          const hasBalance = a.balance > 0;
          const borderCol  = hasBalance ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.08)';
          const glowCol    = hasBalance ? '0 0 18px rgba(0,212,255,0.12)' : 'none';
          const valColor   = hasBalance ? '#f0c040' : 'rgba(255,255,255,0.35)';
          return `<div style="padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid ${borderCol};border-radius:12px;box-shadow:${glowCol};min-width:0">
            <div style="font-size:.72rem;color:rgba(255,255,255,0.45);margin-bottom:8px;display:flex;align-items:center;gap:6px;font-weight:600">
              <span style="font-size:.85rem">${icon}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(a.name)}</span>
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:${valColor};font-family:var(--font-ui)">${_taka(a.balance)}</div>
          </div>`;
        }).join('')
      : `<div style="color:var(--text-muted);font-size:.85rem;padding:16px;text-align:center;grid-column:1/-1"><i class="fa fa-circle-info" style="margin-right:6px"></i>No account data in this snapshot.</div>`;

    // Net profit
    const netProfit   = (finance.totalIncome || 0) - (finance.totalExpense || 0);
    const profitColor = netProfit >= 0 ? '#00ff88' : '#ff4757';

    // Running batch section
    const batchName = batchSnap.name || '';
    const batchRow  = batchName ? `
      <div style="margin-bottom:14px;padding:12px 16px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.18);border-radius:10px">
        <div style="font-size:.68rem;font-weight:800;letter-spacing:1.5px;color:#00d4ff;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="fa fa-graduation-cap"></i> RUNNING BATCH OVERVIEW
          <span style="background:rgba(0,212,255,0.12);padding:2px 10px;border-radius:20px;font-size:.65rem;color:#00d4ff;border:1px solid rgba(0,212,255,0.25)">${_esc(batchName)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${_miniCard('Students', batchSnap.students || 0, '#00e5ff', false)}
          ${_miniCard('Collection', _taka(batchSnap.collection || 0), '#00ff88', false)}
          ${_miniCard('Expense', _taka(batchSnap.expense || 0), '#ff6b7a', false)}
          ${_miniCard('Net P/L', _taka(batchSnap.net || 0), (batchSnap.net||0) >= 0 ? '#00ff88' : '#ff4757', false)}
        </div>
      </div>` : '';

    // Warning banner
    const warningBanner = (!hasRealSnap) ? `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(255,215,0,0.10);border:1px solid rgba(255,215,0,0.35);border-radius:10px;display:flex;align-items:flex-start;gap:10px">
        <i class="fa fa-triangle-exclamation" style="color:#ffd700;margin-top:2px;flex-shrink:0"></i>
        <div style="font-size:.80rem;color:#ffd700;line-height:1.6">
          <strong>⚠ Snapshot data নেই।</strong><br>
          ${isRebuilt
            ? 'এই entry <strong>Rebuild</strong> বাটন দিয়ে তৈরি — সেই transaction-এর সময়ের snapshot নয়।'
            : 'এই entry-র কোনো stored snapshot নেই।'
          }<br>
          <span style="opacity:.75;font-size:.74rem">নতুন transaction add করলে real-time snapshot স্বয়ংক্রিয়ভাবে সেভ হবে।</span>
        </div>
      </div>` : '';

    const body = `
      ${warningBanner}
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px;padding:10px 14px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.18);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:rgba(0,212,255,0.9);font-weight:700">
          <i class="fa fa-camera" style="font-size:.8rem"></i>
          <span>Balance Snapshot — ${snapshotTime}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="background:${tc.bg};border:1px solid ${tc.border};color:${tc.text};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:800">${item.type || '—'}</span>
          <span style="font-size:.75rem;color:rgba(255,255,255,0.45)">${_esc(item.category || '—')}</span>
          ${item.person ? `<span style="font-size:.75rem;color:rgba(255,255,255,0.35)">• ${_esc(item.person)}</span>` : ''}
          ${item.amount ? `<span style="font-size:.8rem;font-weight:700;color:${tc.text};font-family:var(--font-ui)">${_taka(item.amount)}</span>` : ''}
          ${item.method ? `<span style="font-size:.72rem;color:rgba(255,255,255,0.35)">(${_esc(item.method)})</span>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px">
        ${accountCards}
      </div>

      <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:18px">
        <div style="padding:10px 20px;background:rgba(240,192,64,0.08);border:1px solid rgba(240,192,64,0.25);border-radius:10px;font-size:1.05rem;font-weight:900;color:#f0c040;font-family:var(--font-ui)">
          Grand Total: ${_taka(grandTotal)}
        </div>
      </div>

      ${batchRow}

      <div style="font-size:.65rem;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:8px">★ CUMULATIVE UP TO THIS TRANSACTION</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${_miniCard('Students', students.totalStudents || 0, '#00e5ff')}
        ${_miniCard('Income', _taka(finance.totalIncome || 0), '#00ff88')}
        ${_miniCard('Expense', _taka(finance.totalExpense || 0), '#ff6b7a')}
        ${_miniCard('Net P/L', _taka(netProfit), profitColor)}
      </div>

      <div style="font-size:.72rem;color:rgba(255,255,255,0.28);padding:8px 0 2px;border-top:1px solid rgba(255,255,255,0.07);line-height:1.6">
        <i class="fa fa-circle-info" style="margin-right:5px;opacity:.6"></i>
        প্রতিটি row-এর snapshot সেই transaction add হওয়ার সময় নেওয়া হয়েছে।
        পুরনো entry-তে snapshot না থাকলে সেটি historicalভাবে পুনর্গঠন করা হয় না।
      </div>`;

    _openModal(
      `<span style="display:inline-flex;align-items:center;gap:8px"><i class="fa fa-camera" style="color:#00d9ff"></i><span>Monitor — Account Balances</span></span>`,
      body,
      '720px'
    );
  }

  /* ══════════════════════════════════════════════════════════
     REBUILD DATA
  ══════════════════════════════════════════════════════════ */
  function rebuildData() {
    try {
      const DB        = window.DB;
      const allFinance = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.finance) : [];
      const allowedTypes = [
        'income', 'expense', 'transfer in', 'transfer out',
        'loan giving', 'loan receiving', 'investment in', 'investment out',
      ];

      const filtered = allFinance
        .filter(f => allowedTypes.includes(String(f.type || '').toLowerCase()))
        .filter(f => f.category !== 'Opening Balance' && f.category !== 'Balance Adjustment')
        .sort((a, b) => {
          const da = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
          const db = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
          return db - da;
        })
        .slice(0, 15);

      if (filtered.length === 0) {
        _toast('কোনো ট্রান্সেকশন পাওয়া যায়নি — আগে Income বা Expense add করুন', 'warn');
        return;
      }

      // Current snapshot = rebuilt snapshot (best we can do for historical data)
      const currentSnapshot = typeof SupabaseSync.getMonitorSnapshot === 'function'
        ? SupabaseSync.getMonitorSnapshot()
        : {};

      const entries = filtered.map(record => ({
        date:     record.created_at ? new Date(record.created_at).toLocaleString() : (record.date || new Date().toLocaleString()),
        action:   'insert',
        type:     record.type,
        category: String(record.category || record.type || '').slice(0, 100),
        person:   String(record.person_name || record.description || record.note || '—').slice(0, 100),
        amount:   Number(record.amount || 0),
        method:   record.method || '',
        table:    DB.finance,
        recordId: record.id,
        recordAt: record.created_at || record.updated_at || record.date || null,
        item:     `${record.category || record.type} — ৳${Number(record.amount || 0).toLocaleString()}`,
        snapshot: currentSnapshot,
        rebuilt:  true,
      }));

      localStorage.setItem('wfa_recent_changes', JSON.stringify(entries));
      _toast(`✅ ${entries.length}টি ট্রান্সেকশন Data Monitor-এ restore হয়েছে`, 'success');
      _refreshModal();
    } catch (err) {
      console.error('[SettingsMonitor] rebuildData failed:', err);
      _toast('Rebuild ব্যর্থ হয়েছে — console চেক করুন', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     REFRESH
  ══════════════════════════════════════════════════════════ */
  function refresh() {
    _refreshModal();
    _toast('Refreshed', 'info');
  }

  /* ══════════════════════════════════════════════════════════
     INJECT PATTERN (settings.js calls this)
  ══════════════════════════════════════════════════════════ */
  function inject() {
    // settings.js-এ panelMonitor() এর জায়গায় এই function call হবে
    // কিন্তু যেহেতু settings.js পুরো HTML এক সাথে build করে,
    // inject pattern এখানে প্রযোজ্য নয়।
    // settings.js এর buildModalHTML() এ SettingsMonitor.buildPanelHTML(activeTab) call হবে।
    // এবং exposed functions গুলো window.SettingsMonitor.* হিসেবে accessible।
  }

  /* ══════════════════════════════════════════════════════════
     PRIVATE HELPERS
  ══════════════════════════════════════════════════════════ */
  function _loadTransactions() {
    try {
      return JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]');
    } catch {
      return [];
    }
  }

  function _showLiveSnapshot() {
    if (typeof SettingsModule !== 'undefined' && typeof SettingsModule.showLiveAccountSnapshot === 'function') {
      SettingsModule.showLiveAccountSnapshot();
    }
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function _taka(n) {
    if (typeof Utils !== 'undefined' && Utils.takaEn) return Utils.takaEn(n);
    return '৳' + Number(n || 0).toLocaleString();
  }

  function _toast(msg, type) {
    if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(msg, type);
  }

  function _refreshModal() {
    if (typeof SettingsModule !== 'undefined' && typeof SettingsModule.refreshModal === 'function') {
      SettingsModule.refreshModal();
    }
  }

  function _miniCard(label, value, color, textOnly = true) {
    return `<div style="padding:12px 14px;background:rgba(${_hexToRgb(color)},0.06);border:1px solid rgba(${_hexToRgb(color)},0.18);border-radius:10px;text-align:center">
      <div style="font-size:.68rem;color:rgba(${_hexToRgb(color)},0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">${label}</div>
      <div style="font-size:${textOnly ? '1.4rem' : '1.1rem'};font-weight:900;color:${color}">${value}</div>
    </div>`;
  }

  function _hexToRgb(hex) {
    // Simple map for known colors
    const m = {
      '#00e5ff': '0,229,255',
      '#00ff88': '0,255,136',
      '#ff6b7a': '255,107,122',
      '#ff4757': '255,71,87',
      '#f0c040': '240,192,64',
      '#00d4ff': '0,212,255',
    };
    return m[hex] || '200,200,200';
  }

  function _openModal(title, body, maxWidth) {
    if (typeof SettingsModule !== 'undefined' && typeof SettingsModule.openSettingsInternalModal === 'function') {
      SettingsModule.openSettingsInternalModal(title, body, maxWidth || '720px');
    }
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */
  return {
    buildPanelHTML,   // settings.js থেকে call হয়
    showSnapshot,     // table row onclick
    // Historical rebuild intentionally unavailable: it would not be a real snapshot.
    refresh,          // Refresh button
    inject,           // lazy-modules compatibility
  };

})();
