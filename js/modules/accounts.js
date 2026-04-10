/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/accounts.js
   Accounts — Cash / Bank / Mobile Banking
════════════════════════════════════════════════ */

const Accounts = (() => {

  const TYPES = ['Cash', 'Bank', 'bKash', 'Nagad', 'Rocket', 'Cheque', 'Card'];

  function render() {
    const container = document.getElementById('accounts-content');
    if (!container) return;

    const finance  = SupabaseSync.getAll(DB.finance);
    const accounts = SupabaseSync.getAll(DB.accounts);

    /* Compute balances */
    const balances = { Cash:0, Bank:0, bKash:0, Nagad:0, Rocket:0, Cheque:0, Card:0 };

    /* Initial balances from accounts table */
    accounts.forEach(a => {
      if (balances[a.type] !== undefined) balances[a.type] += Utils.safeNum(a.balance);
    });

    /* Adjust with finance movements */
    finance.forEach(f => {
      const amt = Utils.safeNum(f.amount);
      const m   = f.method;
      if (!balances.hasOwnProperty(m)) return;
      const isIn = ['Income','Loan Receiving','Transfer In'].includes(f.type);
      balances[m] += isIn ? amt : -amt;
    });

    const total = Object.values(balances).reduce((s,v)=>s+v,0);

    container.innerHTML = `
      <!-- Balance Cards -->
      <div class="grid-3" style="margin-bottom:20px">
        ${Object.entries(balances).map(([type,bal]) => `
          <div class="account-balance-card">
            <div class="icon">${type==='Cash'?'💵':type==='Bank'?'🏦':type==='bKash'?'👛':type==='Nagad'?'📱':type==='Rocket'?'🚀':type==='Card'?'💳':'🧾'}</div>
            <div class="label">${type}</div>
            <div class="amount" style="color:${bal>=0?'var(--text-primary)':'var(--danger-light)'}">${Utils.takaEn(bal)}</div>
            <div style="margin-top:12px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
              <button class="btn-outline btn-xs" onclick="Accounts.openSetModal('${type}','${Utils.safeNum(accounts.find(a=>a.type===type)?.balance||0)}','${accounts.find(a=>a.type===type)?.id||''}')">
                <i class="fa fa-pen"></i> Set Balance
              </button>
              </button>
            </div>
          </div>`).join('')}
      </div>

      <!-- Total + Transfer -->
      <div class="grid-2" style="margin-bottom:20px">
        <div class="card" style="text-align:center">
          <div class="card-title">Total Balance</div>
          <div style="font-family:var(--font-en);font-size:2.2rem;font-weight:800;color:var(--accent);margin-top:8px">${Utils.takaEn(total)}</div>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:14px"><i class="fa fa-arrow-right-arrow-left" style="color:var(--primary-light)"></i> Account Transfer</div>
          <div class="form-row">
            <div class="form-group">
              <label>From</label>
              <select id="tr-from" class="form-control">
                ${TYPES.map(t=>`<option value="${t}">${t==='Cash'?'Cash':t==='Bank'?'Bank':'Mobile Banking'}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>To</label>
              <select id="tr-to" class="form-control">
                ${TYPES.map((t,i)=>`<option value="${t}" ${i===1?'selected':''}>${t==='Cash'?'Cash':t==='Bank'?'Bank':'Mobile Banking'}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Amount (৳)</label>
              <input id="tr-amount" type="number" class="form-control" placeholder="0" />
            </div>
            <div class="form-group">
              <label>Date</label>
              <input id="tr-date" type="date" class="form-control" value="${Utils.today()}" />
            </div>
          </div>
          <div id="tr-error" class="form-error hidden"></div>
          <button class="btn-primary" style="width:100%" onclick="Accounts.doTransfer()">
            <i class="fa fa-arrow-right-arrow-left"></i> Transfer Funds
          </button>
        </div>
      </div>

      <!-- Per-account Ledger -->
      <div class="card">
        <div class="card-title" style="margin-bottom:14px"><i class="fa fa-list" style="color:var(--primary-light)"></i> Account Based Ledger</div>
        <div class="sub-tabs" id="acc-tabs">
          ${TYPES.map((t,i)=>`<button class="sub-tab-btn ${i===0?'active':''}" onclick="Accounts.showLedger('${t}',this)">${t==='Cash'?'Cash':t==='Bank'?'Bank':'Mobile Banking'}</button>`).join('')}
        </div>
        <div id="acc-ledger-body">${renderLedger('Cash',finance)}</div>
      </div>
    `;
  }

  function renderLedger(type, finance) {
    const rows = Utils.sortBy(
      finance.filter(f=>f.method===type),
      'date','desc'
    );
    if (!rows.length) return `<div class="no-data"><i class="fa fa-inbox"></i>No transactions found</div>`;
    return `<div class="table-wrapper"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>${rows.map(f=>{
        const isIn = ['Income','Loan Receiving','Transfer In'].includes(f.type);
        return `<tr>
          <td style="font-size:0.82rem">${Utils.formatDate(f.date)}</td>
          <td>${Finance.typeBadge?Finance.typeBadge(f.type):Utils.badge(f.type,'primary')}</td>
          <td style="font-size:0.85rem">${Utils.truncate(f.description||f.category||'—',30)}</td>
          <td class="${isIn?'ledger-income':'ledger-expense'}" style="font-family:var(--font-en);font-weight:600">
            ${isIn?'+':'-'}${Utils.takaEn(f.amount)}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  function showLedger(type, btn) {
    document.querySelectorAll('#acc-tabs .sub-tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const finance = SupabaseSync.getAll(DB.finance);
    document.getElementById('acc-ledger-body').innerHTML = renderLedger(type, finance);
  }

  /* ── Set/Update initial balance ── */
  function openSetModal(type, currentBal, existingId) {
    Utils.openModal(`<i class="fa fa-wallet"></i> Set Balance — ${type}`, `
      <div class="form-group">
        <label>Initial Balance (৳)</label>
        <input id="acc-bal" type="number" class="form-control" value="${currentBal}" placeholder="0" />
        <div class="form-hint">This is the account's initial balance — the amount before any transactions.</div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Accounts.saveBalance('${type}','${existingId}')"><i class="fa fa-floppy-disk"></i> Save</button>
      </div>
    `,'modal-sm');
  }

  function saveBalance(type, existingId) {
    const bal = Utils.safeNum(Utils.formVal('acc-bal'));
    if (existingId) {
      SupabaseSync.update(DB.accounts, existingId, { type, balance: bal });
    } else {
      SupabaseSync.insert(DB.accounts, { type, balance: bal });
    }
    Utils.toast('Balance updated ✓','success');
    Utils.closeModal();
    render();
  }

  /* ── Transfer ── */
  function doTransfer() {
    const from   = document.getElementById('tr-from')?.value;
    const to     = document.getElementById('tr-to')?.value;
    const amount = Utils.safeNum(document.getElementById('tr-amount')?.value);
    const date   = document.getElementById('tr-date')?.value;
    const errEl  = document.getElementById('tr-error');

    if (from===to) { errEl.textContent='Cannot transfer to the same account'; errEl.classList.remove('hidden'); return; }
    if (!amount||amount<=0) { errEl.textContent='Amount required'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');

    const fromLabel = from==='Cash'?'Cash':from==='Bank'?'Bank':'Mobile Banking';
    const toLabel   = to==='Cash'?'Cash':to==='Bank'?'Bank':'Mobile Banking';

    SupabaseSync.insert(DB.finance, {
      type:'Transfer Out', method:from, category:'Transfer',
      description:`${fromLabel} → ${toLabel}`, amount, date,
    });
    SupabaseSync.insert(DB.finance, {
      type:'Transfer In', method:to, category:'Transfer',
      description:`${fromLabel} from ${toLabel}`, amount, date,
    });

    Utils.toast(`Transfer completed ✓`,'success');
    document.getElementById('tr-amount').value = '';
    render();
  }

  return { render, showLedger, openSetModal, saveBalance, doTransfer };

})();
