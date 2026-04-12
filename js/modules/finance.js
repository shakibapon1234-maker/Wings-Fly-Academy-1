/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/finance.js
   Finance Ledger — Income, Expense, Loan, Transfer
════════════════════════════════════════════════ */

const Finance = (() => {

  let filterType   = '';
  let filterMethod = '';
  let filterFrom   = '';
  let filterTo     = Utils.today();
  let searchQuery  = '';
  let editingId    = null;
  let currentPage  = 1;
  let pageSize     = 20;

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function render() {
    const container = document.getElementById('finance-content');
    if (!container) return;

    const all      = SupabaseSync.getAll(DB.finance);
    const filtered = applyFilters(all);
    const sorted   = Utils.sortBy(filtered, 'date', 'desc');

    /* Totals */
    const income   = filtered.filter(f=>f.type==='Income').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const expense  = filtered.filter(f=>f.type==='Expense').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const loanGiv  = filtered.filter(f=>f.type==='Loan Giving').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const loanRec  = filtered.filter(f=>f.type==='Loan Receiving').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const net      = income - expense;

    /* Running balance */
    let running = 0;
    const withBalance = [...Utils.sortBy(filtered,'date','asc')].map(f=>{
      const amt = Utils.safeNum(f.amount);
      if (f.type==='Income'||f.type==='Loan Receiving'||f.type==='Transfer In') running+=amt;
      else running-=amt;
      return {...f, _running: running};
    }).reverse();

    container.innerHTML = `
      <!-- Summary -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        ${sCard('fa-arrow-trend-up','green','Total Income',Utils.takaEn(income))}
        ${sCard('fa-arrow-trend-down','red','Total Expense',Utils.takaEn(expense))}
        ${sCard('fa-scale-balanced',net>=0?'green':'red','Net',Utils.takaEn(net))}
        ${sCard('fa-hand-holding-dollar','amber','Loan (Given)',Utils.takaEn(loanGiv))}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="fin-search" class="form-control" placeholder="Description Search…" value="${searchQuery}" oninput="Finance.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Finance.onFilter('type',this.value)">
          <option value="">All Types</option>
          <option value="Income"         ${filterType==='Income'?'selected':''}>Income</option>
          <option value="Expense"        ${filterType==='Expense'?'selected':''}>Expense</option>
          <option value="Loan Giving"    ${filterType==='Loan Giving'?'selected':''}>Loan Given</option>
          <option value="Loan Receiving" ${filterType==='Loan Receiving'?'selected':''}>Loan Taken</option>
          <option value="Transfer In"    ${filterType==='Transfer In'?'selected':''}>Transfer In</option>
          <option value="Transfer Out"   ${filterType==='Transfer Out'?'selected':''}>Transfer Out</option>
        </select>
        <select class="form-control" onchange="Finance.onFilter('method',this.value)">
          <option value="">All Methods</option>
          <option value="Cash"           ${filterMethod==='Cash'?'selected':''}>Cash</option>
          <option value="Bank"           ${filterMethod==='Bank'?'selected':''}>Bank</option>
          <option value="Mobile Banking" ${filterMethod==='Mobile Banking'?'selected':''}>Mobile Banking</option>
        </select>
        <input id="fin-from" type="date" class="form-control" style="max-width:150px" value="${filterFrom}" onchange="Finance.onFilter('from',this.value)" title="Start Date" />
        <input id="fin-to"   type="date" class="form-control" style="max-width:150px" value="${filterTo || Utils.today()}"   onchange="Finance.onFilter('to',this.value)"   title="End Date" />
        <button class="btn-secondary btn-sm" onclick="Finance.resetFilters()"><i class="fa fa-rotate-left"></i></button>
        <button class="btn-success btn-sm"   onclick="Finance.exportExcel()"><i class="fa fa-file-excel"></i> Excel</button>
        <button class="btn-secondary btn-sm" onclick="Utils.printArea('finance-print-area')"><i class="fa fa-print"></i></button>
      </div>

      <!-- Table -->
      <div id="finance-print-area">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Balance</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const pageData = Utils.paginate(withBalance, currentPage, pageSize);
                return renderRows(pageData.items, (currentPage - 1) * pageSize);
              })()}
            </tbody>
          </table>
        </div>
        ${(() => {
          const pageData = Utils.paginate(withBalance, currentPage, pageSize);
          return (pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'Finance') : '';
        })()}
      </div>
    `;
  }

  function renderRows(rows, startIndex = 0) {
    if (!rows.length) return Utils.noDataRow(9, 'No records found');
    return rows.map((f, i) => {
      const isPos = f.type==='Income'||f.type==='Loan Receiving'||f.type==='Transfer In';
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${startIndex + i + 1}</td>
        <td style="font-size:0.82rem;white-space:nowrap">${Utils.formatDate(f.date)}</td>
        <td>${typeBadge(f.type)}</td>
        <td style="font-size:0.82rem;color:var(--text-secondary)">${f.category||'—'}</td>
        <td style="max-width:200px;font-size:0.85rem">${Utils.truncate(f.description||'—',35)}</td>
        <td>${Utils.methodBadge(f.method||'Cash')}</td>
        <td class="${isPos?'ledger-income':'ledger-expense'}" style="font-family:var(--font-en);font-weight:600">
          ${isPos?'+':'-'}${Utils.takaEn(f.amount)}
        </td>
        <td class="ledger-balance" style="font-family:var(--font-en)">${Utils.takaEn(f._running||0)}</td>
        <td class="no-print">
          <div class="table-actions">
            <button class="btn-outline btn-xs" onclick="Finance.openEditModal('${f.id}')"><i class="fa fa-pen"></i></button>
            <button class="btn-danger btn-xs"  onclick="Finance.deleteEntry('${f.id}')"><i class="fa fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function typeBadge(type) {
    const map = {
      'Income':         ['Income',           'success'],
      'Expense':        ['Expense',          'danger'],
      'Loan Giving':    ['Loan Given',    'warning'],
      'Loan Receiving': ['Loan Taken',    'info'],
      'Transfer In':    ['Transfer In',   'primary'],
      'Transfer Out':   ['Transfer Out',  'muted'],
    };
    const [label, type2] = map[type]||[type,'primary'];
    return Utils.badge(label, type2);
  }

  function sCard(icon,color,label,val) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fa ${icon}"></i></div>
      <div class="stat-info"><div class="stat-label">${label}</div><div class="stat-value">${val}</div></div>
    </div>`;
  }

  /* ══════════════════════════════════════════
     HELPERS & SETTINGS SYNC
  ══════════════════════════════════════════ */
  function getCategories(type) {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    let arr = [];
    if (type === 'Income' || type === 'Transfer In' || type === 'Loan Receiving') {
      arr = cfg.income_categories ? JSON.parse(cfg.income_categories) : ['Course Fee', 'Incentive', 'Loan Received', 'Other'];
    } else {
      arr = cfg.expense_categories ? JSON.parse(cfg.expense_categories) : ['Rent', 'Salary', 'Loan Given', 'Other'];
    }
    return arr;
  }

  function updateCategoryDropdown(selectObj) {
    const catEl = document.getElementById('ff-category');
    if (!catEl) return;
    const type = selectObj.value;
    const categories = getCategories(type);
    catEl.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* ══════════════════════════════════════════
     FILTERS
  ══════════════════════════════════════════ */
  function applyFilters(rows) {
    let r = rows;
    // ── _isLoan entries Finance ledger-এ default লুকানো থাকবে ─────────
    // Loan Management module এ এগুলো দেখা যায়
    // Finance-এ শুধু type filter দিয়ে explicitly select করলে দেখাবে
    if (!filterType || (filterType !== 'Loan Giving' && filterType !== 'Loan Receiving')) {
      r = r.filter(f => !f._isLoan);
    }
    if (searchQuery)  r = Utils.searchFilter(r, searchQuery, ['description','category','note']);
    if (filterType)   r = r.filter(f=>f.type===filterType);
    if (filterMethod) r = r.filter(f=>f.method===filterMethod);
    if (filterFrom||filterTo) r = Utils.dateRangeFilter(r,'date',filterFrom,filterTo);
    return r;
  }

  const debouncedRender = Utils.debounce(()=>render(),250);
  function onSearch(val) { searchQuery = val; currentPage = 1; debouncedRender(); }
  function onFilter(t, v) {
    if (t === 'type') filterType = v;
    if (t === 'method') filterMethod = v;
    if (t === 'from') filterFrom = v;
    if (t === 'to') filterTo = v;
    currentPage = 1;
    render();
  }
  function resetFilters() {
    filterType = filterMethod = filterFrom = searchQuery = '';
    filterTo = Utils.today();
    currentPage = 1;
    render();
  }
  
  function changePage(p) { currentPage = p; render(); }
  function changePageSize(s) { pageSize = parseInt(s); currentPage = 1; render(); }

  /* ══════════════════════════════════════════
     ADD MODAL
  ══════════════════════════════════════════ */
  function openAddModal(prefill={}) {
    editingId = null;
    Utils.openModal('<i class="fa fa-plus"></i> New Transaction', formHTML(prefill), 'modal-lg');
  }

  function openEditModal(id) {
    const f = SupabaseSync.getById(DB.finance, id);
    if (!f) return;
    editingId = id;
    Utils.openModal('<i class="fa fa-pen"></i> Transaction Edit', formHTML(f), 'modal-lg');
  }

  function formHTML(d={}) {
    const dateStr  = (d.date || Utils.today()).split('T')[0];
    const dateParts = dateStr.split('-');
    const yyyy = dateParts[0] || String(new Date().getFullYear());
    const mm   = dateParts[1] || String(new Date().getMonth()+1).padStart(2,'0');
    const dd   = dateParts[2] || String(new Date().getDate()).padStart(2,'0');
    const months = [
      ['01','January'],['02','February'],['03','March'],['04','April'],
      ['05','May'],['06','June'],['07','July'],['08','August'],
      ['09','September'],['10','October'],['11','November'],['12','December']
    ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length:8}, (_,i) => currentYear - 3 + i);

    return `
      <style>
        .ff-wrap { display:flex; flex-direction:column; gap:16px; }
        .ff-section-title {
          font-size:0.68rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
          color:var(--brand-primary); margin-bottom:10px; padding-bottom:6px;
          border-bottom:1px solid rgba(0,212,255,0.15);
          display:flex; align-items:center; gap:6px;
        }
        .ff-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .ff-field { display:flex; flex-direction:column; gap:5px; }
        .ff-label {
          font-size:0.7rem; font-weight:600; letter-spacing:0.8px; text-transform:uppercase;
          color:var(--text-muted);
        }
        .ff-label .req { color:#ff4d6d; margin-left:2px; }
        .ff-input, .ff-select {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius:8px; color:var(--text-primary);
          font-size:0.88rem; padding:10px 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline:none; width:100%; box-sizing:border-box;
        }
        .ff-input:focus, .ff-select:focus {
          border-color:rgba(0,212,255,0.6);
          box-shadow:0 0 0 3px rgba(0,212,255,0.1), 0 0 12px rgba(0,212,255,0.12);
        }
        .ff-input::placeholder { color:rgba(255,255,255,0.22); }
        .ff-select { cursor:pointer; }
        .ff-amount-wrap { position:relative; }
        .ff-taka {
          position:absolute; left:12px; top:50%; transform:translateY(-50%);
          color:var(--brand-primary); font-weight:700; font-size:0.9rem; pointer-events:none;
        }
        .ff-amount-wrap .ff-input { padding-left:28px; }
        .ff-date-row { display:flex; gap:6px; }
        .ff-date-row .ff-select:first-child  { flex:0 0 72px; }
        .ff-date-row .ff-select:nth-child(2) { flex:1; }
        .ff-date-row .ff-select:last-child   { flex:0 0 94px; }
        .ff-save-btn {
          width:100%; padding:13px; border:none; border-radius:10px; cursor:pointer;
          font-size:0.95rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
          background:linear-gradient(90deg,#00d4ff,#7b2ff7); color:#fff;
          box-shadow:0 0 20px rgba(0,212,255,0.3),0 0 40px rgba(123,47,247,0.2);
          transition:filter 0.2s,transform 0.1s;
        }
        .ff-save-btn:hover { filter:brightness(1.15); transform:translateY(-1px); }
        .ff-cancel-btn {
          padding:11px 20px; border:1px solid rgba(255,255,255,0.15); border-radius:10px;
          background:transparent; color:var(--text-muted); font-size:0.88rem; cursor:pointer;
        }
        .ff-cancel-btn:hover { border-color:rgba(255,255,255,0.35); color:var(--text-primary); }
        .ff-actions { display:flex; gap:10px; align-items:center; }
        .ff-actions .ff-save-btn { flex:1; }
      </style>

      <div class="ff-wrap">
        <div>
          <div class="ff-section-title"><i class="fa fa-money-bill-wave"></i> Transaction Details</div>
          <div class="ff-grid-2" style="margin-bottom:12px;">
            <div class="ff-field">
              <label class="ff-label">Type <span class="req">*</span></label>
              <select id="ff-type" class="ff-select" onchange="Finance.updateCategoryDropdown(this)">
                <option value="Income"       ${d.type==='Income'?'selected':''}>Income (+)</option>
                <option value="Expense"      ${d.type==='Expense'?'selected':''}>Expense (-)</option>
                <option value="Transfer In"  ${d.type==='Transfer In'?'selected':''}>Transfer In</option>
                <option value="Transfer Out" ${d.type==='Transfer Out'?'selected':''}>Transfer Out</option>
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Payment Method <span class="req">*</span></label>
              <select id="ff-method" class="ff-select" onchange="Utils.onPaymentMethodChange(this,'ff-bal-display')">
                <option value="">Select Payment Method</option>
                ${Utils.getPaymentMethodsHTML(d.method)}
              </select>
              <div id="ff-bal-display" style="display:none;"></div>
            </div>
          </div>
          <div class="ff-grid-2" style="margin-bottom:12px;">
            <div class="ff-field">
              <label class="ff-label">Category</label>
              <select id="ff-category" class="ff-select">
                ${getCategories(d.type || 'Income').map(c => `<option value="${c}" ${d.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="ff-field">
              <label class="ff-label">Date <span class="req">*</span></label>
              <div class="ff-date-row">
                <select id="ff-date-dd" class="ff-select" onchange="Finance._syncDate()">
                  ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
                </select>
                <select id="ff-date-mm" class="ff-select" onchange="Finance._syncDate()">
                  ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
                </select>
                <select id="ff-date-yyyy" class="ff-select" onchange="Finance._syncDate()">
                  ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
                </select>
              </div>
              <input type="hidden" id="ff-date" value="${yyyy}-${mm}-${dd}" />
            </div>
          </div>
          <div class="ff-field" style="margin-bottom:12px;">
            <label class="ff-label">Description</label>
            <input id="ff-description" class="ff-input" value="${d.description||''}" placeholder="Transaction details..." />
          </div>
          <div class="ff-grid-2">
            <div class="ff-field">
              <label class="ff-label">Amount (৳) <span class="req">*</span></label>
              <div class="ff-amount-wrap">
                <span class="ff-taka">৳</span>
                <input id="ff-amount" type="number" class="ff-input" value="${d.amount||''}" placeholder="0" />
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Notes</label>
              <input id="ff-note" class="ff-input" value="${d.note||''}" placeholder="Optional notes" />
            </div>
          </div>
        </div>

        <div id="ff-error" class="form-error hidden"></div>
        <div class="ff-actions">
          <button class="ff-cancel-btn" onclick="Utils.closeModal()">Cancel</button>
          <button class="ff-save-btn" onclick="Finance.saveEntry()">
            <i class="fa fa-floppy-disk" style="margin-right:7px;"></i> Save Transaction
          </button>
        </div>
      </div>
    `;
  }


  /* Date sync — DD/MM/YYYY dropdowns → hidden input */
  function _syncDate() {
    const dd   = document.getElementById('ff-date-dd')?.value   || '';
    const mm   = document.getElementById('ff-date-mm')?.value   || '';
    const yyyy = document.getElementById('ff-date-yyyy')?.value || '';
    const h    = document.getElementById('ff-date');
    if (h) h.value = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
  }

  /* Person dropdown select → text input এ নাম বসাও */
  function _onPersonSelect() {
    const sel = document.getElementById('ff-person-select');
    const inp = document.getElementById('ff-person');
    if (sel && inp && sel.value) inp.value = sel.value;
  }

  /* ══════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════ */
  function saveEntry() {
    const amount = Utils.safeNum(Utils.formVal('ff-amount'));
    const type   = Utils.formVal('ff-type');
    const method = Utils.formVal('ff-method');
    const errEl  = document.getElementById('ff-error');
    errEl.classList.add('hidden');
    
    if (!method) { errEl.textContent = 'Please select a Payment Method.'; errEl.classList.remove('hidden'); return; }
    if (!amount || amount <= 0) { errEl.textContent = 'Please enter a valid amount.'; errEl.classList.remove('hidden'); return; }

    // Prevent negative balance for Expense / Transfer Out
    if (type === 'Expense' || type === 'Transfer Out') {
      const available = Utils.getAccountBalance(method);
      if (amount > available) {
        errEl.textContent = `Insufficient funds in ${method}. Only ৳${Utils.formatMoneyPlain(available)} available.`;
        errEl.classList.remove('hidden');
        return;
      }
    }

    const record = {
      type,
      method,
      category:    Utils.formVal('ff-category'),
      description: Utils.formVal('ff-description'),
      amount,
      date:        Utils.formVal('ff-date') || Utils.today(),
      note:        Utils.formVal('ff-note'),
    };

    /* ── Account Balance স্বয়ংক্রিয় আপডেট ──────────────────────────
       Income                     → balance বাড়ে (+) — income হিসেবে count হয়
       Expense                    → balance কমে (-)  — expense হিসেবে count হয়
       Transfer In / Transfer Out → balance move হয়, কিন্তু income/expense নয়
       Loan Giving / Receiving    → loans.js handle করে — এখানে SKIP
       ─────────────────────────────────────────────────────────────── */
    const isRealIncome  = type === 'Income';
    const isRealExpense = type === 'Expense';
    const isXferIn      = type === 'Transfer In';
    const isXferOut     = type === 'Transfer Out';
    const isLoanType    = type === 'Loan Giving' || type === 'Loan Receiving';

    // Helper: account balance direction for this type
    function _balanceDir(t) {
      if (t === 'Income' || t === 'Transfer In')   return 'in';
      if (t === 'Expense' || t === 'Transfer Out') return 'out';
      return null; // Loan types: skip
    }

    if (editingId) {
      const oldEntry = SupabaseSync.getById(DB.finance, editingId);
      if (oldEntry && oldEntry.method && !oldEntry._isLoan) {
        const oldDir = _balanceDir(oldEntry.type);
        const reverseDir = oldDir === 'in' ? 'out' : oldDir === 'out' ? 'in' : null;
        if (reverseDir) SupabaseSync.updateAccountBalance(oldEntry.method, Utils.safeNum(oldEntry.amount), reverseDir);
      }
      SupabaseSync.update(DB.finance, editingId, record);
      if (!isLoanType) {
        const newDir = _balanceDir(type);
        if (newDir) SupabaseSync.updateAccountBalance(method, amount, newDir);
      }
      Utils.toast('Transaction updated ✓','success');
    } else {
      SupabaseSync.insert(DB.finance, record);
      if (!isLoanType) {
        const newDir = _balanceDir(type);
        if (newDir) SupabaseSync.updateAccountBalance(method, amount, newDir);
      }
      Utils.toast('Transaction added ✓','success');
    }

    Utils.closeModal();
    render();
  }

  /* ══════════════════════════════════════════
     EXTERNAL TRANSACTION (Salary, Loans etc.)
     Other modules এই function call করে Finance-এ entry দেয়
  ══════════════════════════════════════════ */
  function addExternalTransaction(entry) {
    if (!entry || !entry.type || !entry.amount) return;
    const record = {
      type:        entry.type        || 'Expense',
      category:    entry.category    || 'Other',
      method:      entry.method      || 'Cash',
      description: entry.description || '',
      amount:      Utils.safeNum(entry.amount),
      date:        entry.date        || Utils.today(),
      note:        entry.note        || '',
      person_name: entry.person_name || '',
    };
    SupabaseSync.insert(DB.finance, record);
    // If Finance tab is currently visible, re-render
    try { render(); } catch { /* ignore if not mounted */ }
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteEntry(id) {
    const ok = await Utils.confirm('Delete this transaction?','Delete Transaction');
    if (!ok) return;
    // Balance reverse করো — RecycleBin-এ যাওয়ার আগে
    const entry = SupabaseSync.getById(DB.finance, id);
    if (entry && entry.method && !entry._isLoan) {
      // Transfer In/Out ও balance reverse হয়, কিন্তু Loan type হলে loans.js handle করে
      const dirMap = { 'Income': 'out', 'Expense': 'in', 'Transfer In': 'out', 'Transfer Out': 'in' };
      const reverseDir = dirMap[entry.type];
      if (reverseDir) SupabaseSync.updateAccountBalance(entry.method, Utils.safeNum(entry.amount), reverseDir);
    }
    SupabaseSync.remove(DB.finance, id); // RecycleBin-এ যাবে
    Utils.toast('Transaction deleted — RecycleBin-এ আছে','info');
    render();
  }

  /* ══════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════ */
  function exportExcel() {
    const all      = SupabaseSync.getAll(DB.finance);
    const filtered = applyFilters(all);
    const rows     = filtered.map(f=>({
      'Date':    f.date||'',
      'Type':      f.type||'',
      'Category':    f.category||'',
      'Description':    f.description||'',
      'Method':   f.method||'',
      'Amount':   f.amount||0,
      'Notes':      f.note||'',
    }));
    Utils.exportExcel(rows,'finance_ledger','Finance Ledger');
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openAddModal, openEditModal, updateCategoryDropdown,
    saveEntry, deleteEntry, exportExcel,
    addExternalTransaction,
    _syncDate, _onPersonSelect,
  };

})();
