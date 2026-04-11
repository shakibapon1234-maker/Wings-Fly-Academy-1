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
    Utils.openModal('<i class="fa fa-plus"></i> New Transaction', formHTML(prefill));
  }

  function openEditModal(id) {
    const f = SupabaseSync.getById(DB.finance, id);
    if (!f) return;
    editingId = id;
    Utils.openModal('<i class="fa fa-pen"></i> Transaction Edit', formHTML(f));
  }

  function formHTML(d={}) {
    // ── Date parts ────────────────────────────────────────────
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

    // ── Loan person names for dropdown ────────────────────────
    // (edit mode-এ Loan Giving/Receiving type দেখানোর জন্য রাখা হয়েছে)
    const isLoan = d.type==='Loan Giving' || d.type==='Loan Receiving';

    return `
      <div class="form-row">
        <div class="form-group">
          <label>Type <span class="req">*</span></label>
          <select id="ff-type" class="form-control" onchange="Finance.updateCategoryDropdown(this)">
            <option value="Income"       ${d.type==='Income'?'selected':''}>Income</option>
            <option value="Expense"      ${d.type==='Expense'?'selected':''}>Expense</option>
            <option value="Transfer In"  ${d.type==='Transfer In'?'selected':''}>Transfer In</option>
            <option value="Transfer Out" ${d.type==='Transfer Out'?'selected':''}>Transfer Out</option>
          </select>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px;">
            <i class="fa fa-info-circle"></i> লোন যোগ করতে
            <a href="#" onclick="Utils.closeModal();App&&App.navigate&&App.navigate('loans');return false;"
               style="color:var(--brand-primary);font-weight:700;text-decoration:none;">
              Loans <i class="fa fa-arrow-right"></i>
            </a> ট্যাবে যান
          </div>
        </div>
        <div class="form-group">
          <label>Method <span class="req">*</span></label>
          <select id="ff-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'ff-bal-display')">
            <option value="">Select Method</option>
            ${Utils.getPaymentMethodsHTML(d.method)}
          </select>
          <div id="ff-bal-display" style="display:none;"></div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="ff-category" class="form-control">
            ${getCategories(d.type || 'Income').map(c => `<option value="${c}" ${d.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <div style="display:flex; gap:6px;">
            <select id="ff-date-dd" class="form-control" style="flex:0 0 70px;" onchange="Finance._syncDate()">
              ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
            </select>
            <select id="ff-date-mm" class="form-control" style="flex:1;" onchange="Finance._syncDate()">
              ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
            </select>
            <select id="ff-date-yyyy" class="form-control" style="flex:0 0 90px;" onchange="Finance._syncDate()">
              ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <input type="hidden" id="ff-date" value="${yyyy}-${mm}-${dd}" />
        </div>
      </div>

      <div class="form-group">
        <label>Description</label>
        <input id="ff-description" class="form-control" value="${d.description||''}" placeholder="Transaction details" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (৳) <span class="req">*</span></label>
          <input id="ff-amount" type="number" class="form-control" value="${d.amount||''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input id="ff-note" class="form-control" value="${d.note||''}" placeholder="Optional" />
        </div>
      </div>
      <div id="ff-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Finance.saveEntry()"><i class="fa fa-floppy-disk"></i> Save</button>
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

    /* Loan Giving/Receiving → loans table এ আর insert করা হচ্ছে না
       কারণ loans.js নিজেই DB.loans এ insert করে এবং
       account balance track এর জন্য DB.finance এ Loan type entry রাখা হয় */

    if (editingId) {
      SupabaseSync.update(DB.finance, editingId, record);
      Utils.toast('Transaction updated ✓','success');
    } else {
      SupabaseSync.insert(DB.finance, record);
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
    SupabaseSync.remove(DB.finance, id);
    Utils.toast('Transaction deleted','info');
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
