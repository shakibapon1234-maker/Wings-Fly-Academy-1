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
  let currentPage  = 1;
  let pageSize     = 20;

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function render() {
    const container = document.getElementById('finance-content');
    if (!container) return;
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') {
      console.warn('[Finance] Core dependencies not loaded'); return;
    }

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
        ${sCard('fa-arrow-trend-up','green','Total Income',Utils.takaEn(income),'#00ff88')}
        ${sCard('fa-arrow-trend-down','red','Total Expense',Utils.takaEn(expense),'#ff4757')}
        ${sCard('fa-scale-balanced',net>=0?'green':'red','Net',Utils.takaEn(net),net>=0?'#00e5ff':'#ff6b35')}
        ${sCard('fa-hand-holding-dollar','amber','Loan (Given)',Utils.takaEn(loanGiv),'#ffaa00')}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar" style="flex-wrap:wrap;gap:8px;align-items:center">
        <div class="search-input-wrapper" style="flex:1;min-width:160px">
          <i class="fa fa-search"></i>
          <input id="fin-search" class="form-control" placeholder="Description Search…" value="${searchQuery}" oninput="Finance.onSearch(this.value)" />
        </div>
        <select class="form-control" style="flex:0 0 auto;width:auto" onchange="Finance.onFilter('type',this.value)">
          <option value="">All Types</option>
          <option value="Income"         ${filterType==='Income'?'selected':''}>Income</option>
          <option value="Expense"        ${filterType==='Expense'?'selected':''}>Expense</option>
          <option value="Loan Giving"    ${filterType==='Loan Giving'?'selected':''}>Loan Given</option>
          <option value="Loan Receiving" ${filterType==='Loan Receiving'?'selected':''}>Loan Taken</option>
          <option value="Transfer In"    ${filterType==='Transfer In'?'selected':''}>Transfer In</option>
          <option value="Transfer Out"   ${filterType==='Transfer Out'?'selected':''}>Transfer Out</option>
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
  }

  function renderRows(rows, startIndex = 0) {
    if (!rows.length) return Utils.noDataRow(9, 'No records found');
    return rows.map((f, i) => {
      const isPos = f.type==='Income'||f.type==='Loan Receiving'||f.type==='Transfer In';
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
    let arr = [];
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
            <input id="ff-description" class="ff-input" value="${d.description||''}" placeholder="Transaction description" maxlength="200" />
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
    const date   = Utils.formVal('ff-date');
    const errEl  = document.getElementById('ff-error');
    errEl.classList.add('hidden');
    
    // ✅ Phase 2: Comprehensive finance form validation
    if (!method) { errEl.textContent = 'Please select a Payment Method.'; errEl.classList.remove('hidden'); return; }
    if (!amount || amount <= 0) { errEl.textContent = 'Please enter a valid amount (> 0).'; errEl.classList.remove('hidden'); return; }
    if (amount > 99999999) { errEl.textContent = 'Amount exceeds maximum limit (99,999,999).'; errEl.classList.remove('hidden'); return; }
    if (!date) { errEl.textContent = 'Please select a valid date.'; errEl.classList.remove('hidden'); return; }
    // Validate date is not in the future (with 1 day tolerance for timezone)
    const inputDate = new Date(date + 'T23:59:59');
    const tomorrow  = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (inputDate > tomorrow) { errEl.textContent = 'Date cannot be in the future.'; errEl.classList.remove('hidden'); return; }

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
        if (reverseDir && typeof SupabaseSync.updateAccountBalance === 'function') {
          SupabaseSync.updateAccountBalance(oldEntry.method, Utils.safeNum(oldEntry.amount), reverseDir);
        }
      }
      SupabaseSync.update(DB.finance, editingId, record);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'finance', 
          `Updated transaction: ${type} ৳${Utils.formatMoneyPlain(amount)} via ${method}`
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
      SupabaseSync.insert(DB.finance, record);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'finance', 
          `Added transaction: ${type} ৳${Utils.formatMoneyPlain(amount)} via ${method}`
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
    };
    SupabaseSync.insert(DB.finance, record);

    // ── Account balance স্বয়ংক্রিয় আপডেট ──────────────────────────
    // Expense → balance কমে (out), Income → বাড়ে (in)
    // Transfer In/Out → Accounts module নিজে handle করে, এখানে skip
    const dirMap = {
      'Expense':      'out',
      'Income':       'in',
      'Transfer Out': 'out',
      'Transfer In':  'in',
    };
    const dir = dirMap[record.type];
    if (dir && record.method && record.amount > 0 && typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(record.method, record.amount, dir);
    }

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
      const dirMap = { 'Income': 'out', 'Expense': 'in', 'Transfer In': 'out', 'Transfer Out': 'in' };
      const reverseDir = dirMap[entry.type];
      if (reverseDir && typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(entry.method, Utils.safeNum(entry.amount), reverseDir);
      }

      // ── Student Fee হলে student-এর paid/due ও reverse করো ──
      if (entry.type === 'Income' && entry.category === 'Student Fee' && entry.ref_id) {
        const students = SupabaseSync.getAll(DB.students);
        const sIdx = students.findIndex(s => s.id === entry.ref_id);
        if (sIdx !== -1) {
          const s = students[sIdx];
          const newPaid = Math.max(0, (parseFloat(s.paid) || 0) - Utils.safeNum(entry.amount));
          const newDue  = Math.max(0, (parseFloat(s.total_fee) || 0) - newPaid);
          SupabaseSync.update(DB.students, s.id, { paid: newPaid, due: newDue });
        }
      }
    }
    SupabaseSync.remove(DB.finance, id);
    if (typeof SupabaseSync.logActivity === 'function') {
      const typeStr = entry?.type || 'Unknown';
      const amountStr = entry?.amount ? `৳${Utils.formatMoneyPlain(entry.amount)}` : 'N/A';
      SupabaseSync.logActivity('delete', 'finance', 
        `Deleted transaction: ${typeStr} ${amountStr}`
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
window.Finance = Finance;
