/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/finance.js
   Finance Ledger — Income, Expense, Loan, Transfer
════════════════════════════════════════════════ */

const Finance = (() => {

  let filterType   = '';
  let filterMethod = '';
  let filterFrom   = '';
  let filterTo     = '';
  let searchQuery  = '';
  let editingId    = null;

  // ✅ Module-level helper: balance direction for a transaction type
  // Returns 'in' (balance বাড়ে) | 'out' (balance কমে) | null (skip)
  function _balanceDir(t) {
    if (t === 'Income' || t === 'Transfer In' || t === 'Loan Receiving' || t === 'Investment In') return 'in';
    if (t === 'Expense' || t === 'Transfer Out' || t === 'Investment Out' || t === 'Loan Giving') return 'out';
    return null;
  }

  /** Running-balance delta aligned with _balanceDir (account ledger direction). */
  function _ledgerDelta(type, amount) {
    const dir = _balanceDir(type);
    if (dir === 'in') return amount;
    if (dir === 'out') return -amount;
    return 0;
  }
  let currentPage  = 1;
  let pageSize     = 20;

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  let _renderPending = false;
  function render() {
    const container = document.getElementById('finance-content');
    if (!container) return;
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') {
      console.warn('[Finance] Core dependencies not loaded'); return;
    }
    // Non-blocking: yield to browser so modal can open after navigateTo
    if (_renderPending) return;
    _renderPending = true;
    requestAnimationFrame(() => { _renderPending = false; _doRender(container); });
  }

  function _doRender(container) {
    const all      = SupabaseSync.getAll(DB.finance);
    const filtered = applyFilters(all);
    /* Totals */
    const income   = filtered.filter(f=>f.type==='Income').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const expense  = filtered.filter(f=>f.type==='Expense').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const loanGiv  = filtered.filter(f=>f.type==='Loan Giving').reduce((s,f)=>s+Utils.safeNum(f.amount),0);
    const net      = income - expense;

    /* Running balance — start from implied initial balance so values don't go negative.
     * initialBalance = sum of all stored account balances − net of all ledger entries.
     * This represents funds the academy had before the first logged transaction.
     * When filters are active the view is partial, so we start from 0 instead. */
    const _accts = SupabaseSync.getAll(DB.accounts || 'accounts');
    const _totalStored = _accts.reduce((s, a) => s + Utils.safeNum(a.balance), 0);
    let _allNet = 0;
    all.forEach(f => {
      _allNet += _ledgerDelta(f.type, Utils.safeNum(f.amount));
    });
    const _noFilters = !searchQuery && !filterType && !filterMethod && !filterFrom && !filterTo;
    const _initialBal = _noFilters ? (_totalStored - _allNet) : 0;

     let running = _initialBal;
     // Sort chronologically: by date (asc) first, and by insertion time (_inserted_at) or ID (asc) second.
     // This guarantees that the running balance is calculated in the exact order they were created,
     // and after reversing, the latest entries appear at the very top of the table.
     const sortedChronologically = [...filtered].sort((a, b) => {
       const dateA = a.date || '';
       const dateB = b.date || '';
       if (dateA !== dateB) {
         return dateA < dateB ? -1 : 1;
       }
       const timeA = a._inserted_at ? new Date(a._inserted_at).getTime() : 0;
       const timeB = b._inserted_at ? new Date(b._inserted_at).getTime() : 0;
       if (timeA !== timeB) {
         return timeA < timeB ? -1 : 1;
       }
       const idA = String(a.id || '');
       const idB = String(b.id || '');
       return idA < idB ? -1 : (idA > idB ? 1 : 0);
     });

     const withBalance = sortedChronologically.map(f=>{
       running += _ledgerDelta(f.type, Utils.safeNum(f.amount));
       return {...f, _running: running};
     }).reverse();

    container.innerHTML = `
      <!-- Summary -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        ${sCard('fa-arrow-trend-up','green','Total Income',Utils.takaEn(income),'#00ff88')}
        ${sCard('fa-arrow-trend-down','red','Total Expense',Utils.takaEn(expense),'#ff4757')}
        ${sCard('fa-scale-balanced',net>=0?'green':'red','Net',Utils.takaEn(net),net>=0?'#00e5ff':'#ff6b35')}
        ${sCard('fa-hand-holding-dollar','amber','Loan (Given)',Utils.takaEn(loanGiv),'#ffaa00')}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar" style="flex-wrap:wrap;gap:8px;align-items:center">
        <div class="search-input-wrapper" style="flex:1;min-width:160px">
          <i class="fa fa-search"></i>
          <input id="fin-search" class="form-control" placeholder="Description Search\u2026" value="${Utils.escAttr(searchQuery)}" oninput="Finance.onSearch(this.value)" />
        </div>
        <select class="form-control" style="flex:0 0 auto;width:auto" onchange="Finance.onFilter('type',this.value)">
          <option value="">All Types</option>
          <option value="Income"         ${filterType==='Income'?'selected':''}>Income</option>
          <option value="Expense"        ${filterType==='Expense'?'selected':''}>Expense</option>
          <option value="Loan Giving"    ${filterType==='Loan Giving'?'selected':''}>Loan Given</option>
          <option value="Loan Receiving" ${filterType==='Loan Receiving'?'selected':''}>Loan Taken</option>
          <option value="Transfer In"    ${filterType==='Transfer In'?'selected':''}>Transfer In</option>
          <option value="Transfer Out"   ${filterType==='Transfer Out'?'selected':''}>Transfer Out</option>
          <option value="Investment In"  ${filterType==='Investment In'?'selected':''}>Investment In</option>
          <option value="Investment Out" ${filterType==='Investment Out'?'selected':''}>Investment Out</option>
        </select>
        <select class="form-control" style="flex:0 0 auto;width:auto" onchange="Finance.onFilter('method',this.value)">
          <option value="">All Methods</option>
          ${Utils.getPaymentMethodsHTML(filterMethod)}
        </select>
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:5px 12px;flex-shrink:0;color-scheme:dark">
          <i class="fa fa-calendar-days" style="color:#00d4ff;font-size:0.78rem"></i>
          <span style="font-size:0.7rem;color:rgba(0,212,255,0.7);font-weight:700;letter-spacing:0.5px">FROM</span>
          <input id="fin-from" type="date" style="background:rgba(255,255,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:5px;outline:none;color:#e0f4ff;font-size:0.8rem;width:120px;cursor:pointer;color-scheme:dark;padding:2px 6px" value="${filterFrom}" onchange="Finance.onFilter('from',this.value)" title="Start Date" />
          <span style="color:#00d4ff;font-size:0.85rem;font-weight:700">→</span>
          <span style="font-size:0.7rem;color:rgba(0,212,255,0.7);font-weight:700;letter-spacing:0.5px">TO</span>
          <input id="fin-to" type="date" style="background:rgba(255,255,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:5px;outline:none;color:#e0f4ff;font-size:0.8rem;width:120px;cursor:pointer;color-scheme:dark;padding:2px 6px" value="${filterTo}" onchange="Finance.onFilter('to',this.value)" title="End Date" />
        </div>
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

        <!-- Totals Footer -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;padding:14px 18px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);border-radius:10px;align-items:center">
          <span style="font-size:0.72rem;font-weight:800;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-right:4px">Σ Totals:</span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-arrow-trend-up" style="color:#00ff88;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">INCOME</span>
            <span style="font-size:0.92rem;font-weight:800;color:#00ff88;font-family:var(--font-ui)">${Utils.takaEn(income)}</span>
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-arrow-trend-down" style="color:#ff4757;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">EXPENSE</span>
            <span style="font-size:0.92rem;font-weight:800;color:#ff4757;font-family:var(--font-ui)">${Utils.takaEn(expense)}</span>
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:${net>=0?'rgba(0,229,255,0.08)':'rgba(255,107,53,0.08)'};border:1px solid ${net>=0?'rgba(0,229,255,0.2)':'rgba(255,107,53,0.2)'};border-radius:20px;padding:4px 14px">
            <i class="fa fa-scale-balanced" style="color:${net>=0?'#00e5ff':'#ff6b35'};font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">NET</span>
            <span style="font-size:0.92rem;font-weight:800;color:${net>=0?'#00e5ff':'#ff6b35'};font-family:var(--font-ui)">${net>=0?'+':''}${Utils.takaEn(net)}</span>
          </span>
          ${(filterFrom||filterTo||filterType||filterMethod||searchQuery)?`<span style="font-size:0.72rem;color:rgba(255,255,255,0.3);margin-left:auto">${filterFrom?Utils.formatDateDMY(filterFrom):'All'} → ${filterTo?Utils.formatDateDMY(filterTo):'Today'} &nbsp;&bull;&nbsp; ${filtered.length} records</span>`:''}
        </div>
      </div>
    `;
    // ✅ Req 4: DD/MM/YYYY for filter bar date inputs (fin-from, fin-to)
    setTimeout(() => { if (typeof Utils !== 'undefined') Utils.initFilterDatePickers(container); }, 50);
  }  // end _doRender

  function renderRows(rows, startIndex = 0) {
    if (!rows.length) return Utils.noDataRow(9, 'No records found');
    return rows.map((f, i) => {
      const isPos = f.type==='Income'||f.type==='Loan Receiving'||f.type==='Transfer In'||f.type==='Investment In';
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${startIndex + i + 1}</td>
        <td style="font-size:0.82rem;white-space:nowrap">${Utils.formatDateDMY(f.date)}</td>
        <td>${typeBadge(f.type)}</td>
        <td style="font-size:0.82rem;color:var(--text-secondary)">${Utils.esc(f.category||'—')}</td>
        <td style="max-width:200px;font-size:0.85rem">${Utils.esc(Utils.truncate(f.description||'—',35))}</td>
        <td>${Utils.methodBadge(f.method||'Cash')}</td>
        <td class="${isPos?'ledger-income':'ledger-expense'}" style="font-family:var(--font-en);font-weight:600">
          ${isPos?'+':'-'}${Utils.takaEn(f.amount)}
        </td>
        <td class="ledger-balance" style="font-family:var(--font-en);color:${(f._running||0)>=0?'#00e5ff':'#ff4757'}">${(f._running||0)<0?'-':''}${Utils.takaEn(Math.abs(f._running||0))}</td>
        <td class="no-print">
          <div class="table-actions">
            <button class="btn-outline btn-xs" onclick="Finance.openEditModal('${Utils.escAttr(f.id)}')"><i class="fa fa-pen"></i></button>
            <button class="btn-danger btn-xs"  onclick="Finance.deleteEntry('${Utils.escAttr(f.id)}')"><i class="fa fa-trash"></i></button>
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
      'Investment Out': ['Investment Out', 'muted'],
    };
    const [label, type2] = map[type]||[type,'primary'];
    return Utils.badge(label, type2);
  }

  function sCard(icon, color, label, val, valColor) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fa ${icon}"></i></div>
      <div class="stat-info"><div class="stat-label">${label}</div><div class="stat-value" style="color:${valColor||'inherit'};text-shadow:0 0 10px ${valColor?valColor+'55':'transparent'}">${val}</div></div>
    </div>`;
  }

  /* ══════════════════════════════════════════
     HELPERS & SETTINGS SYNC
  ══════════════════════════════════════════ */
  function getCategories(type) {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    let arr;
    if (type === 'Income' || type === 'Transfer In' || type === 'Loan Receiving') {
      arr = cfg.income_categories ? (Utils.safeJSON(cfg.income_categories) || ['Course Fee', 'Incentive', 'Loan Received', 'Other']) : ['Course Fee', 'Incentive', 'Loan Received', 'Other'];
    } else {
      arr = cfg.expense_categories ? (Utils.safeJSON(cfg.expense_categories) || ['Rent', 'Salary', 'Loan Given', 'Other']) : ['Rent', 'Salary', 'Loan Given', 'Other'];
    }
    return arr;
  }

  function updateCategoryDropdown(selectObj) {
    const catEl = document.getElementById('ff-category');
    if (!catEl) return;
    const type = selectObj.value;
    const categories = getCategories(type);
    catEl.innerHTML = categories.map(c => `<option value="${Utils.esc(c)}">${Utils.esc(c)}</option>`).join(''); // ✅ Fix H-03: XSS escape
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
    filterType = filterMethod = filterFrom = filterTo = searchQuery = '';
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

  // ✅ Fix #11: Finance form CSS moved to css/main.css (CSP-safe static file).
  // _injectFinanceCSS() removed — no more dynamic style injection needed.

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
      <div class="ff-wrap">
        <div>
          <div class="ff-section-title"><i class="fa fa-money-bill-wave"></i> Transaction Details</div>
          <div class="ff-grid-2" style="margin-bottom:12px;">
            <div class="ff-field">
              <label class="ff-label">Type <span class="req">*</span></label>
              <select id="ff-type" class="ff-select" onchange="Finance.updateCategoryDropdown(this)">
                <option value="Income"         ${d.type==='Income'?'selected':''}>Income (+)</option>
                <option value="Expense"        ${d.type==='Expense'?'selected':''}>Expense (-)</option>
                <option value="Loan Giving"    ${d.type==='Loan Giving'?'selected':''}>Loan Given</option>
                <option value="Loan Receiving" ${d.type==='Loan Receiving'?'selected':''}>Loan Taken</option>
                <option value="Transfer In"    ${d.type==='Transfer In'?'selected':''}>Transfer In</option>
                <option value="Transfer Out"   ${d.type==='Transfer Out'?'selected':''}>Transfer Out</option>
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
                ${getCategories(d.type || 'Income').map(c => `<option value="${Utils.esc(c)}" ${d.category===c?'selected':''}>${Utils.esc(c)}</option>`).join('')}
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
            <input id="ff-description" class="ff-input" value="${Utils.escAttr(d.description||'')}" placeholder="Transaction description" maxlength="200" />
          </div>
          <div class="ff-grid-2">
            <div class="ff-field">
              <label class="ff-label">Amount (৳) <span class="req">*</span></label>
              <div class="ff-amount-wrap">
                <span class="ff-taka">৳</span>
                <input id="ff-amount" type="number" class="ff-input" value="${d.amount||''}" placeholder="0" min="0.01" max="99999999" step="0.01" />
              </div>
            </div>
            <div class="ff-field">
              <label class="ff-label">Notes</label>
              <input id="ff-note" class="ff-input" value="${Utils.escAttr(d.note||'')}" placeholder="Optional notes" />
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

  /* ══════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════ */
  function saveEntry() {
    const amount = Math.abs(Utils.safeNum(Utils.formVal('ff-amount'))); // ✅ Fix M-06: Force positive amount
    const type   = Utils.formVal('ff-type');
    const method = Utils.formVal('ff-method');
    const date   = Utils.formVal('ff-date');
    const errEl  = document.getElementById('ff-error');
    errEl.classList.add('hidden');
    
    // ✅ Phase 2: Comprehensive finance form validation
    if (!method) { errEl.textContent = 'Please select a Payment Method.'; errEl.classList.remove('hidden'); return; }
    if (!amount || amount <= 0) { errEl.textContent = 'Please enter a valid amount (> 0).'; errEl.classList.remove('hidden'); return; }
    if (amount > 99999999) { errEl.textContent = 'Amount exceeds maximum limit (99,999,999).'; errEl.classList.remove('hidden'); return; }
    if (!date) { errEl.textContent = 'Please select a valid date.'; errEl.classList.remove('hidden'); return; }
    const todayStr = new Date().toISOString().split('T')[0];
    if (date > todayStr) { errEl.textContent = 'Date cannot be in the future.'; errEl.classList.remove('hidden'); return; }

    // ✅ Balance validation — edit-aware net-effect check
    // একটাই রুল: কোনো account কখনো negative হবে না
    const _newDir = _balanceDir(type);
    if (editingId) {
      // Edit mode: old entry reverse + new entry apply করার পরে balance simulate করো
      const _old = SupabaseSync.getById(DB.finance, editingId);
      if (_old && !_old._isLoan) {
        const _oldDir = _balanceDir(_old.type);
        const _sameMethod = (_old.method === method);
        if (_sameMethod) {
          // Same account: net effect = reverse old + apply new
          const _curBal     = Utils.getAccountBalance(method);
          const _afterRev   = _oldDir === 'in'  ? _curBal - Utils.safeNum(_old.amount)
                            : _oldDir === 'out' ? _curBal + Utils.safeNum(_old.amount)
                            : _curBal;
          const _finalBal   = _newDir === 'in'  ? _afterRev + amount
                            : _newDir === 'out' ? _afterRev - amount
                            : _afterRev;
          if (_finalBal < 0) {
            errEl.textContent = `❌ Balance insufficient in "${method}": after edit, deficit would be ৳${Utils.formatMoneyPlain(Math.abs(_finalBal))}. Reduce amount or adjust related expenses first.`;
            errEl.classList.remove('hidden');
            return;
          }
        } else {
          // Method changed: check old account reversal separately
          if (_oldDir === 'in') {
            const _oldBal = Utils.getAccountBalance(_old.method);
            if (_oldBal - Utils.safeNum(_old.amount) < 0) {
              errEl.textContent = `❌ Cannot reverse old entry: "${_old.method}" balance ৳${Utils.formatMoneyPlain(_oldBal)} is less than ৳${Utils.formatMoneyPlain(_old.amount)}.`;
              errEl.classList.remove('hidden');
              return;
            }
          }
          // Check new account for outgoing
          if (_newDir === 'out') {
            const _newBal = Utils.getAccountBalance(method);
            if (amount > _newBal) {
              errEl.textContent = `❌ Insufficient funds in "${method}". Only ৳${Utils.formatMoneyPlain(_newBal)} available.`;
              errEl.classList.remove('hidden');
              return;
            }
          }
        }
      }
    } else {
      // New entry: simple check for outgoing types
      if (_newDir === 'out') {
        const available = Utils.getAccountBalance(method);
        if (amount > available) {
          errEl.textContent = `Insufficient funds in ${method}. Only ৳${Utils.formatMoneyPlain(available)} available.`;
          errEl.classList.remove('hidden');
          return;
        }
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
    const isLoanType = type === 'Loan Giving' || type === 'Loan Receiving';

    if (editingId) {
      const oldEntry = SupabaseSync.getById(DB.finance, editingId);
      if (oldEntry && oldEntry.method && !oldEntry._isLoan) {
        const oldDir = _balanceDir(oldEntry.type);
        const reverseDir = oldDir === 'in' ? 'out' : oldDir === 'out' ? 'in' : null;
        if (reverseDir && typeof SupabaseSync.updateAccountBalance === 'function') {
          // ✅ No force=true — validation above already confirmed this won't go negative
          SupabaseSync.updateAccountBalance(oldEntry.method, Utils.safeNum(oldEntry.amount), reverseDir);
        }
      }
      SupabaseSync.update(DB.finance, editingId, record, { bypassLog: true });
      if (typeof SupabaseSync.logActivity === 'function') {
        const desc = record.description || record.person_name || record.category || '—';
        SupabaseSync.logActivity('edit', 'finance',
          `আয়-ব্যয় লেজার আপডেট: ${record.category || type} — ${type} ৳${Utils.formatMoneyPlain(amount)} (${method}) — ${desc}${record.date ? ' — তারিখ: ' + record.date : ''}`
        );
      }
      if (!isLoanType) {
        const newDir = _balanceDir(type);
        if (newDir && typeof SupabaseSync.updateAccountBalance === 'function') {
          SupabaseSync.updateAccountBalance(method, amount, newDir);
        }
      }
      Utils.toast('Transaction updated ✓','success');
    } else {
      SupabaseSync.insert(DB.finance, record, { bypassLog: true });
      if (typeof SupabaseSync.logActivity === 'function') {
        const desc = record.description || record.person_name || '—';
        SupabaseSync.logActivity('add', 'finance',
          `আয়-ব্যয় লেজারে যোগ: ${record.category || type} — ${type} ৳${Utils.formatMoneyPlain(amount)} (${method}) — ${desc}${record.date ? ' — তারিখ: ' + record.date : ''}`
        );
      }
      if (!isLoanType) {
        const newDir = _balanceDir(type);
        if (newDir && typeof SupabaseSync.updateAccountBalance === 'function') {
          SupabaseSync.updateAccountBalance(method, amount, newDir);
        }
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
      ref_id:      entry.ref_id      || '',
    };
    SupabaseSync.insert(DB.finance, record, { bypassLog: true });

    // ── Account balance স্বয়ংক্রিয় আপডেট ──────────────────────────
    // Expense → balance কমে (out), Income → বাড়ে (in)
    // Transfer In/Out → Accounts module নিজে handle করে, এখানে skip
    const dirMap = {
      'Expense':      'out',
      'Income':       'in',
      'Transfer Out': 'out',
      'Transfer In':  'in',
      'Investment Out': 'out',
    };
    const dir = dirMap[record.type];
    if (dir && record.method && record.amount > 0 && typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(record.method, record.amount, dir);
    }

    // If Finance tab is currently visible, re-render
    try { render(); } catch(e) { if (window.__WFA_DEV__) console.warn('[Finance] render error:', e); }
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
      // Reverse direction: Income→out, Expense→in, etc.
      const _entryDir = _balanceDir(entry.type);
      const reverseDir = _entryDir === 'in' ? 'out' : _entryDir === 'out' ? 'in' : null;

      // ✅ একটাই রুল: reversal balance negative করলে DELETE BLOCKED
      // Income/Transfer-In ডিলিট করলে balance কমে — কমার পরে negative হলে block
      if (reverseDir === 'out') {
        const currentBal = Utils.getAccountBalance(entry.method);
        const afterReversal = currentBal - Utils.safeNum(entry.amount);
        if (afterReversal < 0) {
          Utils.toast(
            `❌ ডিলিট করা যাবে না — "${entry.method}"-এ বর্তমান ব্যালেন্স ৳${Utils.formatMoneyPlain(currentBal)}, ` +
            `কিন্তু এই ইন্ট্রি মুছলে ৳${Utils.formatMoneyPlain(Math.abs(afterReversal))} ঘাটতি হবে। ` +
            `আগে সংশ্লিষ্ট Expense/Transfer মুছুন, তারপর এটি ডিলিট করুন।`,
            'error', 8000
          );
          return; // ❌ DELETE BLOCKED
        }
      }

      if (reverseDir && typeof SupabaseSync.updateAccountBalance === 'function') {
        // ✅ No force=true — pre-check above guarantees no negative
        SupabaseSync.updateAccountBalance(entry.method, Utils.safeNum(entry.amount), reverseDir);
      }

      // ── Student Fee হলে student-এর paid/due ও reverse করো ──
      // ✅ FIX: Recalculate from finance ledger (source of truth), not just subtraction
      // Prevents drift if installments deleted out of order or data manually edited
      if (entry.type === 'Income' && entry.category === 'Student Fee' && entry.ref_id) {
        const students = SupabaseSync.getAll(DB.students);
        // ✅ Bug #3 Fix: ref_id can match either s.id (IDB key) or s.student_id (UUID)
        const sIdx = students.findIndex(s => s.id === entry.ref_id || s.student_id === entry.ref_id);
        if (sIdx !== -1) {
          const s = students[sIdx];
          // Get ALL remaining student fee payments (excluding this one being deleted)
          const allFin = SupabaseSync.getAll(DB.finance);

          // Ledger sum BEFORE delete (to calculate unrecorded initial)
          const ledgerBeforeDelete = allFin
            .filter(f => f.category === 'Student Fee' &&
                         (f.ref_id === entry.ref_id || f.ref_id === s.student_id))
            .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);

// Ledger sum AFTER delete (excluding this entry)
           const ledgerAfterDelete = allFin
             .filter(f => f.id !== id && f.category === 'Student Fee' &&
                              (f.ref_id === entry.ref_id || f.ref_id === s.student_id))
             .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);

          // Unrecorded initial = any amount in s.paid NOT in the ledger (legacy/migrated data)
          const unrecordedInitial = Math.max(0, Utils.safeNum(s.paid) - ledgerBeforeDelete);

          // Final paid = remaining ledger + preserved unrecorded initial
          const newPaid = Math.max(0, ledgerAfterDelete + unrecordedInitial);
          const newDue  = Math.max(0, Utils.safeNum(s.total_fee) - newPaid);
          SupabaseSync.update(DB.students, s.id, { paid: newPaid, due: newDue }, { bypassLog: true });
        }
      }
    }
    SupabaseSync.remove(DB.finance, id, { bypassLog: true });
    if (typeof SupabaseSync.logActivity === 'function') {
      const desc = entry?.description || entry?.person_name || entry?.category || '—';
      SupabaseSync.logActivity('delete', 'finance',
        `আয়-ব্যয় লেজার থেকে মুছে ফেলা: ${entry?.category || entry?.type || '—'} — ${entry?.type || ''} ৳${entry?.amount ? Utils.formatMoneyPlain(entry.amount) : '0'} (${entry?.method || '—'}) — ${desc}`
      );
    }
    Utils.toast('Transaction deleted — RecycleBin-এ আছে','info');
    render();
  }

  /* ══════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════ */
  function exportExcel() {
    const all      = SupabaseSync.getAll(DB.finance);
    const students = SupabaseSync.getAll(DB.students);
    const filtered = applyFilters(all);
    const rows     = filtered.map(f => {
      let studentId = '';
      if (f.ref_id) {
        const s = students.find(s => s.id === f.ref_id);
        if (s) studentId = s.student_id;
      } else if (f.description && f.description.match(/\((WF-[^)]+)\)/)) {
        studentId = f.description.match(/\((WF-[^)]+)\)/)[1];
      }
      return {
        'Date':    f.date||'',
        'Type':      f.type||'',
        'Category':    f.category||'',
        'Student ID': studentId,
        'Description':    f.description||'',
        'Method':   f.method||'',
        'Amount':   f.amount||0,
        'Notes':      f.note||'',
      };
    });
    Utils.exportExcel(rows,'finance_ledger','Finance Ledger');
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openAddModal, openEditModal, updateCategoryDropdown,
    saveEntry, deleteEntry, exportExcel,
    addExternalTransaction,
    _syncDate,
  };

})();
window.Finance = Finance;
