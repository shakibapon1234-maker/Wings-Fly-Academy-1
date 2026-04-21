/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/accounts.js
   Accounts — Cash / Bank / Mobile Banking
════════════════════════════════════════════════ */

const Accounts = (() => {

  const CATEGORIES = ['Cash', 'Bank', 'Mobile Banking'];

  // ── Opening Balance Helper ──────────────────────────────────────────────
  // Account-এ balance set করলে Finance-এ একটা Income entry তৈরি/আপডেট করে
  // যাতে SyncGuard-এর balance audit মিলে যায়।
  function _upsertOpeningEntry(accountName, balance) {
    if (!accountName || typeof SupabaseSync === 'undefined') return;
    try {
      const all = SupabaseSync.getAll(DB.finance);
      const existing = all.find(f =>
        f.category === 'Opening Balance' &&
        (f.method === accountName || f.account === accountName)
      );
      const entry = {
        type: 'Income',
        category: 'Opening Balance',
        method: accountName,
        account: accountName,
        amount: balance,
        date: Utils.today ? Utils.today() : new Date().toISOString().split('T')[0],
        note: `Opening balance for ${accountName}`,
        description: `Opening balance for ${accountName}`,
      };
      if (existing) {
        SupabaseSync.update(DB.finance, existing.id, entry);
      } else if (balance > 0) {
        SupabaseSync.insert(DB.finance, entry);
      }
    } catch (e) {
      console.warn('[Accounts] _upsertOpeningEntry error:', e);
    }
  }

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
        // ✅ Bug #9 Fix: শুধু সত্যিকারের empty/numeric placeholder drop করুন।
        // "Bank 1", "Mobile Banking 1" user-created account হতে পারে — এগুলো drop করা যাবে না।
        const invalid = !name || /^\d+$/.test(name);
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

    try {
      // ✅ BUG FIX: Proper error handling for balance calculations
      const finance  = SupabaseSync.getAll(DB.finance) || [];
      const accounts = normalizeAccounts(SupabaseSync.getAll(DB.accounts) || []);

      // Filter accounts by class
      const cashAcc = getPrimaryCashAccount(accounts) || { id: '', type: 'Cash', balance: 0 };
      const bankDetails = (accounts.filter(a => a.type === 'Bank_Detail') || []);
      const mobileDetails = (accounts.filter(a => a.type === 'Mobile_Detail') || []);

      // Calculate initial sums with error handling
      let bankInitialSum = 0;
      try {
        bankInitialSum = bankDetails.reduce((s, a) => {
          const bal = Utils.safeNum(a?.balance || 0);
          return s + (isNaN(bal) ? 0 : bal);
        }, 0);
      } catch (e) {
        console.warn('[Accounts] Bank balance calculation error:', e);
        bankInitialSum = 0;
      }

      let mobileInitialSum = 0;
      try {
        mobileInitialSum = mobileDetails.reduce((s, a) => {
          const bal = Utils.safeNum(a?.balance || 0);
          return s + (isNaN(bal) ? 0 : bal);
        }, 0);
      } catch (e) {
        console.warn('[Accounts] Mobile balance calculation error:', e);
        mobileInitialSum = 0;
      }

      // Account balances are already FINAL in the database
      // They already include all transactions (income, expense, transfers)
      // Just use them directly without recalculating
      const cashBal = Utils.safeNum(cashAcc?.balance || 0);
      const bankBal = isNaN(bankInitialSum) ? 0 : bankInitialSum;
      const mobileBal = isNaN(mobileInitialSum) ? 0 : mobileInitialSum;

      const totalAll = cashBal + bankBal + mobileBal;

      // ✅ BUG FIX: Wrap HTML generation in try-catch
      try {
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
              <option value="__all__" ${searchResMethod==='__all__'?'selected':''}>🏦 All Accounts</option>
              <optgroup label="── Cash ──">
                <option value="Cash" ${searchResMethod==='Cash'?'selected':''}>💵 Cash</option>
              </optgroup>
              ${bankDetails.length?`<optgroup label="── Bank ──">${bankDetails.map(b=>`<option value="${Utils.escAttr(b.name)}" ${searchResMethod===b.name?'selected':''}>🏦 ${Utils.esc(b.name)}</option>`).join('')}</optgroup>`:''}
              ${mobileDetails.length?`<optgroup label="── Mobile Banking ──">${mobileDetails.map(m=>`<option value="${Utils.escAttr(m.name)}" ${searchResMethod===m.name?'selected':''}>📱 ${Utils.esc(m.name)}</option>`).join('')}</optgroup>`:''}
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
        <!-- Grand Total Row -->
        <div style="text-align:center; margin-top:28px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.07);">
          <div style="color:#888; font-size:0.72rem; font-weight:700; letter-spacing:2px; margin-bottom:10px;">★ GRAND TOTAL</div>
          <div style="color:#ffd700; font-size:3rem; font-weight:900; font-family:var(--font-en); text-shadow:0 0 30px rgba(255,215,0,0.5); line-height:1;">${Utils.takaEn(totalAll)}</div>
          <div style="color:var(--text-muted); font-size:0.78rem; margin-top:8px;">Cash + Bank + Mobile Banking Combined</div>
        </div>
      </div>
    `;
      } catch (e) {
        console.error('[Accounts] Render error:', e);
        container.innerHTML = `<div style="color:#ff4757; padding:20px; text-align:center; background:rgba(255,71,87,0.1); border-radius:8px; border:1px solid rgba(255,71,87,0.3);">
          ❌ Error loading accounts. Please refresh the page. <br><small style="color:var(--text-muted); margin-top:8px; display:block;">${Utils.esc(e.message||'Unknown error')}</small>
        </div>`;
      }
    } catch (e) {
      console.error('[Accounts] Render fatal error:', e);
      if (container) {
        container.innerHTML = `<div style="color:#ff4757; padding:20px; text-align:center;">Fatal error in accounts module</div>`;
      }
    }
  }

  function renderSearchResults(finance, accounts) {
    if (!searchResMethod && !searchResFrom && !searchResTo) return '';

    const isAll = (searchResMethod === '__all__' || !searchResMethod);

    // Apply date filters first
    let dateFiltered = finance;
    if (searchResFrom) dateFiltered = dateFiltered.filter(f => f.date >= searchResFrom);
    if (searchResTo)   dateFiltered = dateFiltered.filter(f => f.date <= searchResTo);

    let filtered;
    if (isAll) {
      // All accounts: show everything
      filtered = Utils.sortBy(dateFiltered, 'date', 'desc');
    } else {
      // Specific account: match by method/account name exactly
      filtered = dateFiltered.filter(f => {
        const method = f.method || 'Cash';
        // Exact match by account name (Cash, bank name, mobile name)
        if (method === searchResMethod) return true;
        // Also match settlement key for composite methods
        if (typeof Utils.getSettlementKey === 'function') {
          return Utils.getSettlementKey(method) === searchResMethod;
        }
        return false;
      });
      filtered = Utils.sortBy(filtered, 'date', 'desc');
    }

    if (filtered.length === 0) return `<div style="text-align:center; padding:20px; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">No transactions found for this filter.</div>`;

    // ── Export/Print bar ────────────────────────────────────
    const exportBar = `
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px;">
        <button class="btn btn-sm" style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88;border-radius:6px;padding:5px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;" onclick="Accounts.exportSearchExcel()">
          <i class="fa fa-file-excel"></i> EXCEL
        </button>
        <button class="btn btn-sm" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;border-radius:6px;padding:5px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;" onclick="Accounts.printSearch()">
          <i class="fa fa-print"></i> PRINT
        </button>
        <button class="btn btn-sm" style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);color:#ff4757;border-radius:6px;padding:5px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;" onclick="Accounts.clearSearch()">
          <i class="fa fa-times"></i>
        </button>
      </div>`;

    // ── All Accounts Summary Card ───────────────────────────
    let summaryHTML = '';
    if (isAll) {
      const cashTx   = filtered.filter(f => (f.method||'Cash') === 'Cash' || Utils.getPaymentMethodBucket(f.method, accounts) === 'cash');
      const bankTx   = filtered.filter(f => Utils.getPaymentMethodBucket(f.method, accounts) === 'bank');
      const mobileTx = filtered.filter(f => Utils.getPaymentMethodBucket(f.method, accounts) === 'mobile');

      const sum = (txs, positive) => txs
        .filter(f => positive ? ['Income','Loan Receiving','Transfer In'].includes(f.type) : ['Expense','Loan Giving','Transfer Out'].includes(f.type))
        .reduce((s,f) => s + Utils.safeNum(f.amount), 0);

      const cashNet   = sum(cashTx, true)   - sum(cashTx, false);
      const bankNet   = sum(bankTx, true)   - sum(bankTx, false);
      const mobileNet = sum(mobileTx, true) - sum(mobileTx, false);
      const totalNet  = cashNet + bankNet + mobileNet;

      summaryHTML = `
        <div style="background:linear-gradient(135deg,rgba(0,20,60,0.9),rgba(0,10,40,0.95));border:1px solid rgba(0,212,255,0.25);border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 4px 32px rgba(0,0,0,0.4);">
          <div style="font-size:0.75rem;font-weight:800;letter-spacing:2px;color:#00d4ff;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            <i class="fa fa-building-columns"></i> ALL ACCOUNTS SUMMARY
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;">
            <div style="flex:1;min-width:100px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:14px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;">CASH</div>
              <div style="color:#00ff88;font-size:1.3rem;font-weight:800;font-family:var(--font-en);">${Utils.takaEn(cashNet)}</div>
            </div>
            <div style="flex:1;min-width:100px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:14px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;">BANK</div>
              <div style="color:#00d4ff;font-size:1.3rem;font-weight:800;font-family:var(--font-en);">${Utils.takaEn(bankNet)}</div>
            </div>
            <div style="flex:1;min-width:100px;background:rgba(180,100,255,0.08);border:1px solid rgba(180,100,255,0.25);border-radius:10px;padding:14px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;">MOBILE</div>
              <div style="color:#b464ff;font-size:1.3rem;font-weight:800;font-family:var(--font-en);">${Utils.takaEn(mobileNet)}</div>
            </div>
            <div style="flex:1;min-width:100px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:10px;padding:14px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;">TOTAL</div>
              <div style="color:#ffd700;font-size:1.3rem;font-weight:800;font-family:var(--font-en);">${Utils.takaEn(totalNet)}</div>
            </div>
          </div>
        </div>`;
    }

    // ── Transaction Table ───────────────────────────────────
    let html = `<div class="table-wrapper" style="border-radius:8px; overflow:hidden; border:1px solid rgba(0,212,255,0.2); margin-bottom:20px;">
      <table class="table" style="margin:0; width:100%; border-collapse:collapse;">
        <thead style="background:rgba(0,212,255,0.05); border-bottom:1px solid rgba(0,212,255,0.2);">
          <tr>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">DATE</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">TYPE</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">ACCOUNT</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">CATEGORY</th>
             <th style="padding:10px;text-align:left;color:#00d4ff;font-size:0.8rem;">DETAILS</th>
             <th style="padding:10px;text-align:right;color:#00d4ff;font-size:0.8rem;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>`;
    html += filtered.map(f => {
      const isPos = ['Income','Loan Receiving','Transfer In'].includes(f.type);
      const typeColor = isPos ? 'rgba(0,255,136,0.15)' : 'rgba(255,71,87,0.15)';
      const typeTextColor = isPos ? '#00ff88' : '#ff4757';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:10px 10px;font-size:0.82rem;color:var(--text-secondary);white-space:nowrap;">${f.date ? f.date.slice(0,10) : '—'}</td>
        <td style="padding:10px;"><span style="background:${typeColor};color:${typeTextColor};padding:3px 9px;border-radius:20px;font-size:0.72rem;font-weight:700;">${f.type}</span></td>
        <td style="padding:10px;">${Utils.methodBadge(f.method||'Cash')}</td>
        <td style="padding:10px;font-size:0.82rem;color:var(--text-muted);">${Utils.esc(f.category||'—')}</td>
        <td style="padding:10px;font-size:0.82rem;color:var(--text-secondary);max-width:220px;word-break:break-word;">${Utils.esc(Utils.truncate(f.description||'—', 40))}</td>
        <td style="padding:10px;text-align:right;font-family:var(--font-en);font-weight:700;font-size:0.9rem;color:${typeTextColor};white-space:nowrap;">${isPos?'+':'-'}${Utils.takaEn(f.amount)}</td>
      </tr>`;
    }).join('');
    html += `</tbody></table></div>`;

    // ── Per-Account Transaction Summary (for specific account search) ──
    let perAccountSummary = '';
    if (!isAll) {
      const totalIn  = filtered
        .filter(f => ['Income','Loan Receiving','Transfer In'].includes(f.type))
        .reduce((s,f) => s + Utils.safeNum(f.amount), 0);
      const totalOut = filtered
        .filter(f => ['Expense','Loan Giving','Transfer Out'].includes(f.type))
        .reduce((s,f) => s + Utils.safeNum(f.amount), 0);
      const netTotal = totalIn - totalOut;
      const netColor = netTotal >= 0 ? '#00ff88' : '#ff4757';

      perAccountSummary = `
        <div style="background:linear-gradient(135deg,rgba(0,10,40,0.95),rgba(0,20,60,0.9));border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:20px;margin-top:4px;box-shadow:0 4px 32px rgba(0,0,0,0.4);">
          <div style="font-size:0.72rem;font-weight:800;letter-spacing:2px;color:#00d4ff;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            <i class="fa fa-chart-pie"></i> TRANSACTION SUMMARY
            <span style="font-size:0.68rem;color:#555;font-weight:500;margin-left:4px;">
              ${searchResFrom||'All'} → ${searchResTo||'Today'} &nbsp;·&nbsp; ${filtered.length} transactions
            </span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;">
            <div style="flex:1;min-width:120px;background:rgba(0,255,136,0.07);border:1px solid rgba(0,255,136,0.2);border-radius:10px;padding:16px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;"><i class="fa fa-arrow-down"></i> TOTAL IN</div>
              <div style="color:#00ff88;font-size:1.4rem;font-weight:800;font-family:var(--font-en);">+${Utils.takaEn(totalIn)}</div>
            </div>
            <div style="flex:1;min-width:120px;background:rgba(255,71,87,0.07);border:1px solid rgba(255,71,87,0.2);border-radius:10px;padding:16px;text-align:center;">
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;"><i class="fa fa-arrow-up"></i> TOTAL OUT</div>
              <div style="color:#ff4757;font-size:1.4rem;font-weight:800;font-family:var(--font-en);">-${Utils.takaEn(totalOut)}</div>
            </div>
            <div style="flex:1.5;min-width:140px;background:rgba(255,215,0,0.07);border:2px solid ${netColor}44;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden;">
              <div style="position:absolute;inset:0;background:linear-gradient(135deg,${netColor}08,transparent);border-radius:10px;"></div>
              <div style="color:#888;font-size:0.68rem;font-weight:700;letter-spacing:1px;margin-bottom:6px;position:relative;">★ NET TOTAL</div>
              <div style="color:${netColor};font-size:1.7rem;font-weight:900;font-family:var(--font-en);text-shadow:0 0 16px ${netColor}66;position:relative;">${netTotal>=0?'+':''}${Utils.takaEn(netTotal)}</div>
            </div>
          </div>
        </div>`;
    }

    return exportBar + summaryHTML + html + perAccountSummary;
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
              <td style="padding:12px; font-size:0.85rem;">${Utils.formatDateDMY(t.date)}</td>
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
    const accountName = type; // Cash, etc.

    if (bal < 0) {
      Utils.toast('Balance cannot be negative.', 'error');
      return;
    }

    if (existingId) {
      // Get old balance to calculate difference
      const old = SupabaseSync.getById(DB.accounts, existingId);
      const oldBal = parseFloat(old?.balance) || 0;
      SupabaseSync.update(DB.accounts, existingId, { type, balance: bal });

      // Adjust opening balance finance entry if balance changed
      if (bal !== oldBal) {
        _upsertOpeningEntry(accountName, bal);
      }
    } else {
      SupabaseSync.insert(DB.accounts, { type, balance: bal });
      if (bal > 0) _upsertOpeningEntry(accountName, bal);
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
       const old = SupabaseSync.getById(DB.accounts, id);
       const oldBal = parseFloat(old?.balance) || 0;
       SupabaseSync.update(DB.accounts, id, record);
       if (record.balance !== oldBal) _upsertOpeningEntry(name, record.balance);
       Utils.toast('Bank account updated','success');
    } else {
       SupabaseSync.insert(DB.accounts, record);
       if (record.balance > 0) _upsertOpeningEntry(name, record.balance);
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
       const old = SupabaseSync.getById(DB.accounts, id);
       const oldBal = parseFloat(old?.balance) || 0;
       SupabaseSync.update(DB.accounts, id, record);
       if (record.balance !== oldBal) _upsertOpeningEntry(name, record.balance);
       Utils.toast('Mobile account updated','success');
    } else {
       SupabaseSync.insert(DB.accounts, record);
       if (record.balance > 0) _upsertOpeningEntry(name, record.balance);
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

    // ✅ লজিক ৬: Transfer করার আগে balance check
    const fromBalance = Utils.getAccountBalance ? Utils.getAccountBalance(from) : Infinity;
    if (amount > fromBalance) {
      errEl.textContent = `Insufficient funds in ${from}. Only ৳${Utils.formatMoneyPlain(fromBalance)} available.`;
      errEl.classList.remove('hidden');
      return;
    }
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

    // ✅ লজিক ৬: Transfer specific activity log
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('transfer', 'accounts',
        `Transfer: ${from} → ${to} ৳${Utils.formatMoneyPlain(amount)}`);
    }

    Utils.toast(`Transfer completed ✓`,'success');
    Utils.closeModal();
    render();
  }

  /* Filters */
  function doSearch() {
    searchResMethod = Utils.formVal('acc-search-type') || '__all__';
    searchResFrom = Utils.formVal('acc-search-from');
    searchResTo = Utils.formVal('acc-search-to');
    render();
  }

  function exportSearchExcel() {
    const finance  = SupabaseSync.getAll(DB.finance);
    const accounts = normalizeAccounts(SupabaseSync.getAll(DB.accounts));
    const isAll = (searchResMethod === '__all__' || !searchResMethod);
    let filtered = finance;
    if (searchResFrom) filtered = filtered.filter(f => f.date >= searchResFrom);
    if (searchResTo)   filtered = filtered.filter(f => f.date <= searchResTo);
    if (!isAll) filtered = filtered.filter(f => (f.method||'Cash') === searchResMethod || (typeof Utils.getSettlementKey === 'function' && Utils.getSettlementKey(f.method||'Cash') === searchResMethod));
    const rows = filtered.map(f => ({
      'Date': f.date||'', 'Type': f.type||'', 'Account': f.method||'Cash',
      'Category': f.category||'', 'Details': f.description||'',
      'Amount': Utils.safeNum(f.amount)
    }));
    Utils.exportExcel(rows, `accounts_${searchResMethod}_${Utils.today()}`, 'Transactions');
  }

  function printSearch() {
    const area = document.getElementById('acc-search-results-area');
    if (area) Utils.printArea('acc-search-results-area');
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

  // 🆕 BUG #5 FIX: Verify account balance against finance records
  function verifyAccountBalance(accountName, storedBalance) {
    try {
      if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return null;
      const finance = SupabaseSync.getAll(DB.finance) || [];
      
      // Find all transactions for this account
      let calculated = 0;
      finance.forEach(f => {
        if ((f.method === accountName || f.account === accountName) && f.type !== 'Loan Receiving' && f.type !== 'Loan Giving') {
          const amt = Utils.safeNum(f.amount);
          if (f.type === 'Income' || f.type === 'Transfer In') {
            calculated += amt;
          } else if (f.type === 'Expense' || f.type === 'Transfer Out') {
            calculated -= amt;
          }
        }
      });
      
      // Compare
      const diff = Math.abs(calculated - storedBalance);
      if (diff > 1) { // Allow 1 taka rounding difference
        console.warn('[Accounts]', accountName, 'balance mismatch:', { stored: storedBalance, calculated: calculated, difference: diff });
        return false; // Mismatch detected
      }
      return true;
    } catch (e) {
      console.error('[Accounts] Balance verification error:', e);
      return null;
    }
  }

  // 🆕 BUG #5 FIX: Recalculate balance from finance records
  function recalculateBalance(accountName) {
    try {
      if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return false;
      const finance = SupabaseSync.getAll(DB.finance) || [];
      let newBalance = 0;
      
      finance.forEach(f => {
        if (f.method === accountName || f.account === accountName) {
          const amt = Utils.safeNum(f.amount);
          if (f.type === 'Income' || f.type === 'Transfer In' || f.type === 'Loan Receiving') {
            newBalance += amt;
          } else {
            newBalance -= amt;
          }
        }
      });
      
      // Update account
      const accounts = SupabaseSync.getAll(DB.accounts) || [];
      const account = accounts.find(a => a.name === accountName);
      if (account) {
        account.balance = Math.max(0, newBalance);
        SupabaseSync.update(DB.accounts, account.id, account);
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast('✅ Balance recalculated and updated', 'success');
        }
        render();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[Accounts] Recalculate error:', e);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('❌ Recalculation failed', 'error');
      }
      return false;
    }
  }

  return {
    render,
    openSetModal, saveBalance,
    openBankModal, saveBank, deleteBank,
    openMobileModal, saveMobile, deleteMobile,
    openTransferModal, doTransfer,
    doSearch, clearSearch, filterHistory, clearHistoryFilter,
    exportSearchExcel, printSearch,
    // 🆕 BUG #5: Verification functions
    verifyAccountBalance, recalculateBalance
  };

})();
window.Accounts = Accounts;

