/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/accounts.js
   Accounts — Cash / Bank / Mobile Banking
════════════════════════════════════════════════ */

const Accounts = (() => {

  const CATEGORIES = ['Cash', 'Bank', 'Mobile Banking'];

  let searchResMethod = '';
  let searchResFrom = '';
  let searchResTo = '';
  let histResFrom = '';
  let histResTo = '';

  function getPrimaryCashAccount(accounts) {
    const cashAccounts = accounts.filter(a => a.type === 'Cash' && a.name === 'Cash');
    if (cashAccounts.length === 0) return { id: '', type: 'Cash', balance: 0 };
    return cashAccounts.reduce((best, a) => {
      return Math.abs(Utils.safeNum(a.balance)) < Math.abs(Utils.safeNum(best.balance)) ? a : best;
    });
  }

  function normalizeAccounts(accounts) {
    const seen = new Set();
    const normalized = [];
    accounts.forEach(a => {
      const name = String(a.name || '').trim();
      if (a.type === 'Cash' && name !== 'Cash') return;
      if (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') {
        const invalid = !name || /^\d+$/.test(name) || /^Bank \d+$/.test(name) || /^Mobile Banking \d+$/.test(name);
        if (invalid) return;
      }
      const key = `${a.type}||${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(a);
    });
    return normalized;
  }

  function render() {
    const container = document.getElementById('accounts-content');
    if (!container) return;

    const finance  = SupabaseSync.getAll(DB.finance);
    const accounts = normalizeAccounts(SupabaseSync.getAll(DB.accounts));

    // Filter accounts by class
    const cashAcc = getPrimaryCashAccount(accounts);
    const bankDetails = accounts.filter(a => a.type === 'Bank_Detail');
    const mobileDetails = accounts.filter(a => a.type === 'Mobile_Detail');

    // Calculate initial sums
    const bankInitialSum = bankDetails.reduce((s,a) => s + Utils.safeNum(a.balance), 0);
    const mobileInitialSum = mobileDetails.reduce((s,a) => s + Utils.safeNum(a.balance), 0);

    // Account balances are already FINAL in the database
    // They already include all transactions (income, expense, transfers)
    // Just use them directly without recalculating
    const cashBal = Utils.safeNum(cashAcc.balance);
    const bankBal = bankInitialSum;
    const mobileBal = mobileInitialSum;

    const totalAll = cashBal + bankBal + mobileBal;

    container.innerHTML = `
      <!-- Cash Hero Section -->
      <div style="background:var(--bg-surface); border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; box-shadow:inset 0 0 40px rgba(0,212,255,0.05); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background-image:linear-gradient(rgba(0,212,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.05) 1px, transparent 1px); background-size:20px 20px; z-index:0;"></div>
        <div style="display:flex; align-items:center; gap:16px; position:relative; z-index:1;">
          <div style="background:rgba(0,212,255,0.1); width:60px; height:60px; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:2rem; border:1px solid rgba(0,212,255,0.3);">💵</div>
          <div>
            <div style="color:#ffd700; font-size:1.6rem; font-weight:800; letter-spacing:1px; line-height:1;">CASH</div>
            <div style="color:var(--text-muted); font-size:0.9rem; font-weight:600; margin-top:4px;">Physical cash on hand</div>
          </div>
        </div>
        <div style="text-align:right; position:relative; z-index:1;">
          <div style="color:#ffd700; font-size:2.8rem; font-weight:800; font-family:var(--font-en); text-shadow:0 0 15px rgba(255,215,0,0.4); margin-bottom:10px; line-height:1;">${Utils.takaEn(cashBal)}</div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button class="btn btn-outline btn-sm" style="background:#fff; color:#0e1628; border:none; font-weight:700; padding:6px 16px; border-radius:20px;" onclick="Accounts.openSetModal('Cash','${Utils.safeNum(cashAcc?.balance||0)}','${cashAcc?.id||''}')">
              <i class="fa fa-pen" style="font-size:0.8rem;"></i> UPDATE CASH
            </button>
            <button class="btn btn-outline btn-sm" style="color:var(--text-muted); border-color:rgba(255,255,255,0.2); font-weight:600; border-radius:20px;" onclick="if(typeof SyncEngine!=='undefined')SyncEngine.pull({silent:false})">
              <i class="fa fa-rotate"></i> SYNC
            </button>
          </div>
        </div>
      </div>

      <!-- Search All Accounts -->
      <div class="card" style="padding:16px; border-radius:8px; border:1px solid rgba(0,212,255,0.15); margin-bottom:20px;">
        <div style="color:var(--brand-primary); font-weight:700; margin-bottom:12px; font-size:0.95rem;">
          <i class="fa fa-search"></i> Search All Accounts (💵 Cash + 🏦 Bank + 📱 Mobile Banking)
        </div>
        <div class="form-row" style="margin-bottom:0">
          <div class="form-group">
            <label class="filter-label" style="color:#00d4ff">Select Account</label>
            <select id="acc-search-type" class="form-control" style="border-color:rgba(0,212,255,0.3)">
              <option value="">-- Select an Account --</option>
              ${CATEGORIES.map(t=>`<option value="${t}" ${searchResMethod===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="filter-label" style="color:#00ff88">From Date</label>
            <input type="date" class="form-control" id="acc-search-from" value="${searchResFrom}" style="border-color:rgba(0,255,136,0.3)" />
          </div>
          <div class="form-group">
            <label class="filter-label" style="color:#00d4ff">To Date</label>
            <input type="date" class="form-control" id="acc-search-to" value="${searchResTo||Utils.today()}" style="border-color:rgba(0,212,255,0.3)" />
          </div>
          <div class="form-group" style="flex:0 0 auto; display:flex; gap:10px; align-items:flex-end;">
            <button class="btn btn-outline" style="border-color:rgba(0,212,255,0.4); color:#00d4ff" onclick="Accounts.doSearch()"><i class="fa fa-search"></i></button>
            <button class="btn btn-ghost" style="border:1px solid rgba(255,71,87,0.3); color:#ff4757" onclick="Accounts.clearSearch()"><i class="fa fa-times"></i></button>
          </div>
        </div>
      </div>
      <div id="acc-search-results-area" style="margin-bottom:20px;">
        ${renderSearchResults(finance, accounts)}
      </div>

      <!-- Internal Balance Transfer -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div>
          <h3 style="color:#00d4ff; text-transform:uppercase; font-weight:800; letter-spacing:1px; margin:0;"><i class="fa fa-money-bill-transfer"></i> INTERNAL BALANCE TRANSFER</h3>
          <span style="color:#cc7700; font-size:0.85rem; font-weight:600;">Move funds between Cash, Bank & Mobile accounts Instantly</span>
        </div>
        <button class="btn btn-warning" onclick="Accounts.openTransferModal()" style="font-weight:800; color:#000; padding:10px 20px;">
          <i class="fa fa-arrow-right-arrow-left"></i> TRANSFER NOW
        </button>
      </div>
      <div class="card" style="padding:16px; border-radius:12px; border:1px solid rgba(0,212,255,0.15); margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h4 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;"><i class="fa fa-clock-rotate-left" style="color:#ffd700"></i> Transfer History</h4>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="color:var(--text-muted); font-size:0.8rem;">From:</span>
            <input type="date" id="hist-from" class="form-control" style="padding:4px 8px; font-size:0.85rem; max-width:130px; border-color:rgba(255,255,255,0.1)" value="${histResFrom}" />
            <span style="color:var(--text-muted); font-size:0.8rem;">To:</span>
            <input type="date" id="hist-to" class="form-control" style="padding:4px 8px; font-size:0.85rem; max-width:130px; border-color:rgba(255,255,255,0.1)" value="${histResTo || Utils.today()}" />
            <button class="btn btn-warning btn-sm" onclick="Accounts.filterHistory()" style="color:#000; font-weight:800;"><i class="fa fa-filter"></i> FILTER</button>
            <button class="btn btn-ghost btn-sm" onclick="Accounts.clearHistoryFilter()"><i class="fa fa-times"></i> CLEAR</button>
          </div>
        </div>
        ${renderTransferHistory(finance)}
      </div>

      <!-- Bank Details -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="color:#00d4ff; text-transform:uppercase; font-weight:800; letter-spacing:1px; margin:0;"><i class="fa fa-folder" style="color:#00d4ff"></i> BANK DETAILS</h3>
        <button class="btn btn-primary" onclick="Accounts.openBankModal()" style="font-weight:700;"><i class="fa fa-plus"></i> ADD NEW BANK ACCOUNT</button>
      </div>
      <div class="table-wrapper" style="margin-bottom:30px; border-radius:8px; overflow:hidden; border:1px solid rgba(0,212,255,0.2);">
        <table class="table" style="margin:0; width:100%; border-collapse:collapse; background:transparent;">
          <thead style="background:rgba(0,212,255,0.05); border-bottom:1px solid rgba(0,212,255,0.2);">
            <tr>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">SL.</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">NAME</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">BRANCH</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">BANK NAME</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">ACCOUNT NO.</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:right;">BALANCE</th>
              <th style="color:#00d4ff; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:center;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${bankDetails.length === 0 ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">No bank accounts added yet.</td></tr>` : 
              bankDetails.map((b, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px;">${i+1}</td>
                <td style="padding:12px; font-weight:700;">${Utils.esc(b.name||"—")}</td>
                <td style="padding:12px; color:var(--text-secondary);">${b.branch||'—'}</td>
                <td style="padding:12px;"> <span style="background:rgba(0,212,255,0.1); color:#00d4ff; padding:4px 10px; border-radius:20px; font-size:0.75rem; border:1px solid rgba(0,212,255,0.2);">${b.bankName||'—'}</span> </td>
                <td style="padding:12px; font-family:var(--font-en); font-size:0.85rem;">${b.accountNo||'—'}</td>
                <td style="padding:12px; text-align:right; color:#00ff88; font-weight:700; font-family:var(--font-en); text-shadow:0 0 5px rgba(0,255,136,0.3);">${Utils.takaEn(b.balance)}</td>
                <td style="padding:12px; text-align:center;">
                  <button class="btn btn-ghost btn-xs" style="color:#00d4ff" onclick="Accounts.openBankModal('${b.id}')"><i class="fa fa-edit"></i></button>
                  <button class="btn btn-ghost btn-xs" style="color:#ff4757" onclick="Accounts.deleteBank('${b.id}')"><i class="fa fa-trash"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile Banking -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="color:#00ff88; text-transform:uppercase; font-weight:800; letter-spacing:1px; margin:0;"><i class="fa fa-mobile-screen" style="color:#00ff88"></i> MOBILE BANKING</h3>
        <button class="btn btn-success" onclick="Accounts.openMobileModal()" style="font-weight:700;"><i class="fa fa-plus"></i> ADD MOBILE ACCOUNT</button>
      </div>
      <div class="table-wrapper" style="margin-bottom:30px; border-radius:8px; overflow:hidden; border:1px solid rgba(0,255,136,0.2);">
        <table class="table" style="margin:0; width:100%; border-collapse:collapse; background:transparent;">
          <thead style="background:rgba(0,255,136,0.05); border-bottom:1px solid rgba(0,255,136,0.2);">
            <tr>
              <th style="color:#00ff88; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">SL.</th>
              <th style="color:#00ff88; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">ACCOUNT NAME</th>
              <th style="color:#00ff88; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:left;">ACCOUNT NO.</th>
              <th style="color:#00ff88; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:right;">BALANCE</th>
              <th style="color:#00ff88; font-weight:700; padding:12px; text-transform:uppercase; font-size:0.8rem; text-align:center;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${mobileDetails.length === 0 ? `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No mobile accounts added yet.</td></tr>` : 
              mobileDetails.map((m, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px;">${i+1}</td>
                <td style="padding:12px; font-weight:700;">${Utils.esc(m.name||"—")}</td>
                <td style="padding:12px; font-family:var(--font-en); font-size:0.85rem;">${m.accountNo||'—'}</td>
                <td style="padding:12px; text-align:right; color:#00ff88; font-weight:700; font-family:var(--font-en); text-shadow:0 0 5px rgba(0,255,136,0.3);">${Utils.takaEn(m.balance)}</td>
                <td style="padding:12px; text-align:center;">
                  <button class="btn btn-ghost btn-xs" style="color:#00d4ff" onclick="Accounts.openMobileModal('${m.id}')"><i class="fa fa-edit"></i></button>
                  <button class="btn btn-ghost btn-xs" style="color:#ff4757" onclick="Accounts.deleteMobile('${m.id}')"><i class="fa fa-trash"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot style="background:rgba(0,255,136,0.1); border-top:1px solid rgba(0,255,136,0.3);">
            <tr>
              <td colspan="3" style="padding:16px 12px; font-weight:800; color:#00ff88; font-size:1.1rem;">Total Mobile Balance</td>
              <td colspan="2" style="padding:16px 12px; font-weight:800; color:#00ff88; text-align:left; font-size:1.3rem; text-shadow:0 0 10px rgba(0,255,136,0.4); font-family:var(--font-en);">${Utils.takaEn(mobileInitialSum)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Total Balance Overview -->
      <div class="card" style="border:1px solid rgba(0,212,255,0.1); border-radius:12px; padding:24px;">
        <div style="text-align:center; margin-bottom:24px;">
          <h3 style="color:#a8b2c1; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; margin:0; text-transform:uppercase; letter-spacing:1px;">
            <i class="fa fa-sack-dollar" style="color:#ffd700"></i> TOTAL BALANCE OVERVIEW
          </h3>
          <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:4px;">Cash • Bank • Mobile Banking Combined</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:16px; justify-content:center;">
          <div style="flex:1; min-width:220px; max-width:320px; background:linear-gradient(135deg, rgba(255,20,100,0.15) 0%, rgba(255,20,100,0.02) 100%); border:1px solid rgba(255,20,100,0.3); border-radius:16px; padding:24px; text-align:center; box-shadow:0 8px 32px rgba(255,20,100,0.05);">
             <div style="color:#ff4757; font-size:2rem; margin-bottom:12px;"><i class="fa fa-money-bill"></i></div>
             <div style="color:#fff; font-weight:800; font-size:0.95rem; letter-spacing:2px; margin-bottom:8px;">CASH</div>
             <div style="color:#ff4757; font-size:2.2rem; font-weight:900; text-shadow:0 0 15px rgba(255,71,87,0.4); font-family:var(--font-en);">${Utils.takaEn(cashBal)}</div>
          </div>
          <div style="flex:1; min-width:220px; max-width:320px; background:linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.02) 100%); border:1px solid rgba(0,212,255,0.3); border-radius:16px; padding:24px; text-align:center; box-shadow:0 8px 32px rgba(0,212,255,0.05);">
             <div style="color:#00d4ff; font-size:2rem; margin-bottom:12px;"><i class="fa fa-building-columns"></i></div>
             <div style="color:#fff; font-weight:800; font-size:0.95rem; letter-spacing:2px; margin-bottom:8px;">BANK</div>
             <div style="color:#00d4ff; font-size:2.2rem; font-weight:900; text-shadow:0 0 15px rgba(0,212,255,0.4); font-family:var(--font-en);">${Utils.takaEn(bankBal)}</div>
          </div>
          <div style="flex:1; min-width:220px; max-width:320px; background:linear-gradient(135deg, rgba(0,255,136,0.15) 0%, rgba(0,255,136,0.02) 100%); border:1px solid rgba(0,255,136,0.3); border-radius:16px; padding:24px; text-align:center; box-shadow:0 8px 32px rgba(0,255,136,0.05);">
             <div style="color:#00ff88; font-size:2rem; margin-bottom:12px;"><i class="fa fa-mobile-button"></i></div>
             <div style="color:#fff; font-weight:800; font-size:0.95rem; letter-spacing:2px; margin-bottom:8px;">MOBILE BANKING</div>
             <div style="color:#00ff88; font-size:2.2rem; font-weight:900; text-shadow:0 0 15px rgba(0,255,136,0.4); font-family:var(--font-en);">${Utils.takaEn(mobileBal)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSearchResults(finance, accounts) {
    if (!searchResMethod && !searchResFrom && !searchResTo) return '';
    let filtered = searchResMethod
      ? finance.filter(f => Utils.financeMatchesAccountCategory(f.method, searchResMethod, accounts))
      : finance;
    if (searchResFrom) filtered = filtered.filter(f => f.date >= searchResFrom);
    if (searchResTo)   filtered = filtered.filter(f => f.date <= searchResTo);
    filtered = Utils.sortBy(filtered, 'date', 'desc');

    if (filtered.length === 0) return `<div style="text-align:center; padding:20px; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">No transactions found for this search.</div>`;

    let html = `<div class="table-wrapper" style="border-radius:8px; overflow:hidden; border:1px solid rgba(0,212,255,0.2); margin-bottom:20px;">
      <table class="table" style="margin:0; width:100%; border-collapse:collapse;">
        <thead style="background:rgba(0,212,255,0.05); border-bottom:1px solid rgba(0,212,255,0.2);">
          <tr>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">Date</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">Type</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">Account</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">Description</th>
             <th style="padding:10px;text-align:right;color:#00d4ff;font-size:0.8rem;">Amount</th>
          </tr>
        </thead>
        <tbody>`;
    html += filtered.map(f => {
      const isPos = ['Income','Loan Receiving','Transfer In'].includes(f.type);
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:10px;font-size:0.85rem;">${Utils.formatDate(f.date)}</td>
        <td style="padding:10px;">${f.type}</td>
        <td style="padding:10px;">${Utils.methodBadge(f.method||'Cash')}</td>
        <td style="padding:10px;font-size:0.85rem;color:var(--text-secondary);">${Utils.truncate(f.description||f.category||'—', 35)}</td>
        <td style="padding:10px;text-align:right;font-family:var(--font-en);font-weight:700;color:${isPos?'#00ff88':'#ff4757'}">${isPos?'+':'-'}${Utils.takaEn(f.amount)}</td>
      </tr>`;
    }).join('');
    html += `</tbody></table></div>`;
    return html;
  }

  function renderTransferHistory(finance) {
    let transfers = finance.filter(f => f.type === 'Transfer Out' && f.category === 'Transfer');
    if (histResFrom) transfers = transfers.filter(f => f.date >= histResFrom);
    if (histResTo)   transfers = transfers.filter(f => f.date <= histResTo);
    transfers = Utils.sortBy(transfers, 'date', 'desc');

    if (transfers.length === 0) {
      return `<div style="text-align:center; padding:40px; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:8px;">
        <i class="fa fa-clock-rotate-left" style="font-size:2rem; margin-bottom:10px; opacity:0.3; display:block;"></i>
        No transfers found. Use "Transfer Now" to move funds.
      </div>`;
    }

    return `<div class="table-wrapper" style="overflow-x:auto;">
      <table class="table" style="width:100%; border-collapse:collapse; margin:0;">
        <thead style="border-bottom:2px solid rgba(0,212,255,0.3);">
          <tr>
            <th style="text-align:left; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">#</th>
            <th style="text-align:left; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">DATE</th>
            <th style="text-align:left; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">FROM</th>
            <th style="text-align:left; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">TO</th>
            <th style="text-align:right; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">AMOUNT</th>
            <th style="text-align:left; padding:12px; font-weight:800; font-size:0.85rem; color:#fff;">NOTES</th>
          </tr>
        </thead>
        <tbody>
          ${transfers.map((t, i) => {
            const from = t.method;
            const toDesc = (t.description||'').split(' → ');
            const to = toDesc.length > 1 ? toDesc[1] : '?';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:12px; color:var(--text-muted);">${i+1}</td>
              <td style="padding:12px; font-size:0.85rem;">${Utils.formatDate(t.date)}</td>
              <td style="padding:12px; font-weight:700;">${from}</td>
              <td style="padding:12px; font-weight:700;">${to}</td>
              <td style="padding:12px; text-align:right; font-weight:700; font-family:var(--font-en); color:#ffd700;">${Utils.takaEn(t.amount)}</td>
              <td style="padding:12px; color:var(--text-secondary); font-size:0.85rem;">${t.note||'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  /* ── Modals & Logic ── */

  function openSetModal(type, currentBal, existingId) {
    Utils.openModal(`<i class="fa fa-wallet"></i> Set Initial Balance — ${type}`, `
      <div class="form-group">
        <label>Initial Balance (৳)</label>
        <input id="acc-bal" type="number" class="form-control" value="${currentBal}" placeholder="0" />
        <div class="form-hint">This affects the base balance of ${type}. Transactions will heavily alter this.</div>
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

  /* Bank Details Modal */
  function openBankModal(id = null) {
    const isEdit = !!id;
    let b = {};
    if (id) {
      b = SupabaseSync.getAll(DB.accounts).find(a => a.id === id) || {};
    }
    Utils.openModal(`<i class="fa fa-building-columns"></i> ${isEdit ? 'Edit Bank Account' : 'Add New Bank Account'}`, `
      <div class="form-group">
        <label>Account Name <span class="req">*</span></label>
        <input type="text" id="bm-name" class="form-control" placeholder="e.g. CITY BANK" value="${b.name||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
           <label>Bank Name</label>
           <input type="text" id="bm-bank" class="form-control" placeholder="City Bank Ltd." value="${b.bankName||''}" />
        </div>
        <div class="form-group">
           <label>Branch</label>
           <input type="text" id="bm-branch" class="form-control" placeholder="Bonosree" value="${b.branch||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
           <label>Account No</label>
           <input type="text" id="bm-acno" class="form-control" placeholder="1493xxxxxxx" value="${b.accountNo||''}" />
        </div>
        <div class="form-group">
           <label>Initial Balance (৳)</label>
           <input type="number" id="bm-bal" class="form-control" placeholder="0" value="${b.balance||''}" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Accounts.saveBank('${id||''}')"><i class="fa fa-save"></i> Save</button>
      </div>
    `);
  }

  function saveBank(id) {
    const name = Utils.formVal('bm-name');
    if (!name) { Utils.toast('Account Name required','error'); return; }
    
    const record = {
      type: 'Bank_Detail',
      name,
      bankName: Utils.formVal('bm-bank'),
      branch: Utils.formVal('bm-branch'),
      accountNo: Utils.formVal('bm-acno'),
      balance: Utils.safeNum(Utils.formVal('bm-bal'))
    };

    if (id) {
       SupabaseSync.update(DB.accounts, id, record);
       Utils.toast('Bank account updated','success');
    } else {
       SupabaseSync.insert(DB.accounts, record);
       Utils.toast('Bank account added','success');
    }
    Utils.closeModal();
    render();
  }

  async function deleteBank(id) {
    if (await Utils.confirm('Are you sure you want to delete this bank account?')) {
      SupabaseSync.remove(DB.accounts, id);
      Utils.toast('Account deleted', 'info');
      render();
    }
  }

  /* Mobile Banking Modal */
  function openMobileModal(id = null) {
    const isEdit = !!id;
    let m = {};
    if (id) {
      m = SupabaseSync.getAll(DB.accounts).find(a => a.id === id) || {};
    }
    Utils.openModal(`<i class="fa fa-mobile-screen"></i> ${isEdit ? 'Edit Mobile Account' : 'Add Mobile Account'}`, `
      <div class="form-group">
        <label>Account Name <span class="req">*</span></label>
        <input type="text" id="mm-name" class="form-control" placeholder="e.g. Bikash, Nagad" value="${m.name||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
           <label>Account No.</label>
           <input type="text" id="mm-acno" class="form-control" placeholder="e.g. 017xxxxxxxx" value="${m.accountNo||''}" />
        </div>
        <div class="form-group">
           <label>Initial Balance (৳)</label>
           <input type="number" id="mm-bal" class="form-control" placeholder="0" value="${m.balance||''}" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Accounts.saveMobile('${id||''}')"><i class="fa fa-save"></i> Save</button>
      </div>
    `);
  }

  function saveMobile(id) {
    const name = Utils.formVal('mm-name');
    if (!name) { Utils.toast('Account Name required','error'); return; }
    
    const record = {
      type: 'Mobile_Detail',
      name,
      accountNo: Utils.formVal('mm-acno'),
      balance: Utils.safeNum(Utils.formVal('mm-bal'))
    };

    if (id) {
       SupabaseSync.update(DB.accounts, id, record);
       Utils.toast('Mobile account updated','success');
    } else {
       SupabaseSync.insert(DB.accounts, record);
       Utils.toast('Mobile account added','success');
    }
    Utils.closeModal();
    render();
  }

  async function deleteMobile(id) {
    if (await Utils.confirm('Are you sure you want to delete this mobile account?')) {
      SupabaseSync.remove(DB.accounts, id);
      Utils.toast('Account deleted', 'info');
      render();
    }
  }

  /* Internal Transfer */
  function openTransferModal() {
    Utils.openModal(`<i class="fa fa-arrow-right-arrow-left"></i> Internal Balance Transfer`, `
      <div class="form-row">
        <div class="form-group">
          <label>From <span class="req">*</span></label>
          <select id="tr-from" class="form-control">
            <option value="">-- From Account --</option>
            ${CATEGORIES.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>To <span class="req">*</span></label>
          <select id="tr-to" class="form-control">
            <option value="">-- To Account --</option>
            ${CATEGORIES.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (৳) <span class="req">*</span></label>
          <input type="number" id="tr-amount" class="form-control" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <input type="date" id="tr-date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="tr-notes" class="form-control" placeholder="Optional notes about transfer" />
      </div>
      <div id="tr-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-warning" style="font-weight:bold;color:#000;" onclick="Accounts.doTransfer()"><i class="fa fa-check"></i> TRANSFER NOW</button>
      </div>
    `);
  }

  function doTransfer() {
    const from   = Utils.formVal('tr-from');
    const to     = Utils.formVal('tr-to');
    const amount = Utils.safeNum(Utils.formVal('tr-amount'));
    const date   = Utils.formVal('tr-date');
    const notes  = Utils.formVal('tr-notes');
    const errEl  = document.getElementById('tr-error');

    if (!from || !to) { errEl.textContent='Please select both accounts'; errEl.classList.remove('hidden'); return; }
    if (from===to) { errEl.textContent='Cannot transfer to the same account'; errEl.classList.remove('hidden'); return; }
    if (!amount||amount<=0) { errEl.textContent='Amount required'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');

    SupabaseSync.insert(DB.finance, {
      type:'Transfer Out', method:from, category:'Transfer',
      description:`${from} → ${to}`, amount, date, note: notes
    });
    SupabaseSync.updateAccountBalance(from, amount, 'out');
    
    SupabaseSync.insert(DB.finance, {
      type:'Transfer In', method:to, category:'Transfer',
      description:`${from} → ${to}`, amount, date, note: notes
    });
    SupabaseSync.updateAccountBalance(to, amount, 'in');

    Utils.toast(`Transfer completed ✓`,'success');
    Utils.closeModal();
    render();
  }

  /* Filters */
  function doSearch() {
    searchResMethod = Utils.formVal('acc-search-type');
    searchResFrom = Utils.formVal('acc-search-from');
    searchResTo = Utils.formVal('acc-search-to');
    if (!searchResMethod) { Utils.toast('Select an account to search', 'warn'); return; }
    render();
  }
  function clearSearch() {
    searchResMethod = ''; searchResFrom = ''; searchResTo = '';
    render();
  }
  function filterHistory() {
    histResFrom = Utils.formVal('hist-from');
    histResTo = Utils.formVal('hist-to');
    render();
  }
  function clearHistoryFilter() {
    histResFrom = ''; histResTo = '';
    render();
  }

  return {
    render, 
    openSetModal, saveBalance, 
    openBankModal, saveBank, deleteBank,
    openMobileModal, saveMobile, deleteMobile,
    openTransferModal, doTransfer,
    doSearch, clearSearch, filterHistory, clearHistoryFilter
  };

})();
window.Accounts = Accounts;

