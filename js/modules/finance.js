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
        ${sCard('fa-arrow-trend-up','green','মোট আয়',Utils.takaEn(income))}
        ${sCard('fa-arrow-trend-down','red','মোট ব্যয়',Utils.takaEn(expense))}
        ${sCard('fa-scale-balanced',net>=0?'green':'red','নিট',Utils.takaEn(net))}
        ${sCard('fa-hand-holding-dollar','amber','লোন (দেওয়া)',Utils.takaEn(loanGiv))}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="fin-search" class="form-control" placeholder="বিবরণ খুঁজুন…" value="${searchQuery}" oninput="Finance.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Finance.onFilter('type',this.value)">
          <option value="">সব ধরন</option>
          <option value="Income"         ${filterType==='Income'?'selected':''}>আয়</option>
          <option value="Expense"        ${filterType==='Expense'?'selected':''}>ব্যয়</option>
          <option value="Loan Giving"    ${filterType==='Loan Giving'?'selected':''}>লোন দেওয়া</option>
          <option value="Loan Receiving" ${filterType==='Loan Receiving'?'selected':''}>লোন নেওয়া</option>
          <option value="Transfer In"    ${filterType==='Transfer In'?'selected':''}>Transfer In</option>
          <option value="Transfer Out"   ${filterType==='Transfer Out'?'selected':''}>Transfer Out</option>
        </select>
        <select class="form-control" onchange="Finance.onFilter('method',this.value)">
          <option value="">সব পদ্ধতি</option>
          <option value="Cash"           ${filterMethod==='Cash'?'selected':''}>নগদ</option>
          <option value="Bank"           ${filterMethod==='Bank'?'selected':''}>ব্যাংক</option>
          <option value="Mobile Banking" ${filterMethod==='Mobile Banking'?'selected':''}>মোবাইল ব্যাংকিং</option>
        </select>
        <input id="fin-from" type="date" class="form-control" style="max-width:150px" value="${filterFrom}" onchange="Finance.onFilter('from',this.value)" title="শুরুর তারিখ" />
        <input id="fin-to"   type="date" class="form-control" style="max-width:150px" value="${filterTo}"   onchange="Finance.onFilter('to',this.value)"   title="শেষ তারিখ" />
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
                <th>তারিখ</th>
                <th>ধরন</th>
                <th>বিভাগ</th>
                <th>বিবরণ</th>
                <th>পদ্ধতি</th>
                <th>পরিমাণ</th>
                <th>ব্যালেন্স</th>
                <th class="no-print">কাজ</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(withBalance)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderRows(rows) {
    if (!rows.length) return Utils.noDataRow(9,'কোনো লেনদেন পাওয়া যায়নি');
    return rows.map((f,i) => {
      const isPos = f.type==='Income'||f.type==='Loan Receiving'||f.type==='Transfer In';
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${i+1}</td>
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
      'Income':         ['আয়',           'success'],
      'Expense':        ['ব্যয়',          'danger'],
      'Loan Giving':    ['লোন দেওয়া',    'warning'],
      'Loan Receiving': ['লোন নেওয়া',    'info'],
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
     FILTERS
  ══════════════════════════════════════════ */
  function applyFilters(rows) {
    let r = rows;
    if (searchQuery)  r = Utils.searchFilter(r, searchQuery, ['description','category','note']);
    if (filterType)   r = r.filter(f=>f.type===filterType);
    if (filterMethod) r = r.filter(f=>f.method===filterMethod);
    if (filterFrom||filterTo) r = Utils.dateRangeFilter(r,'date',filterFrom,filterTo);
    return r;
  }

  const debouncedRender = Utils.debounce(()=>render(),250);
  function onSearch(val) { searchQuery=val; debouncedRender(); }
  function onFilter(key,val) {
    if(key==='type')  filterType=val;
    if(key==='method')filterMethod=val;
    if(key==='from')  filterFrom=val;
    if(key==='to')    filterTo=val;
    render();
  }
  function resetFilters() {
    filterType=filterMethod=filterFrom=filterTo=searchQuery='';
    render();
  }

  /* ══════════════════════════════════════════
     ADD MODAL
  ══════════════════════════════════════════ */
  function openAddModal(prefill={}) {
    editingId = null;
    Utils.openModal('<i class="fa fa-plus"></i> নতুন লেনদেন', formHTML(prefill));
  }

  function openEditModal(id) {
    const f = SupabaseSync.getById(DB.finance, id);
    if (!f) return;
    editingId = id;
    Utils.openModal('<i class="fa fa-pen"></i> লেনদেন সম্পাদনা', formHTML(f));
  }

  function formHTML(d={}) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>ধরন <span class="req">*</span></label>
          <select id="ff-type" class="form-control">
            <option value="Income"         ${d.type==='Income'?'selected':''}>আয়</option>
            <option value="Expense"        ${d.type==='Expense'?'selected':''}>ব্যয়</option>
            <option value="Loan Giving"    ${d.type==='Loan Giving'?'selected':''}>লোন দেওয়া</option>
            <option value="Loan Receiving" ${d.type==='Loan Receiving'?'selected':''}>লোন নেওয়া</option>
            <option value="Transfer In"    ${d.type==='Transfer In'?'selected':''}>Transfer In</option>
            <option value="Transfer Out"   ${d.type==='Transfer Out'?'selected':''}>Transfer Out</option>
          </select>
        </div>
        <div class="form-group">
          <label>পদ্ধতি <span class="req">*</span></label>
          <select id="ff-method" class="form-control">
            <option value="Cash"           ${(d.method||'Cash')==='Cash'?'selected':''}>নগদ</option>
            <option value="Bank"           ${d.method==='Bank'?'selected':''}>ব্যাংক</option>
            <option value="Mobile Banking" ${d.method==='Mobile Banking'?'selected':''}>মোবাইল ব্যাংকিং</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>বিভাগ</label>
          <input id="ff-category" class="form-control" list="fin-cat-list" value="${d.category||''}" placeholder="যেমন: Student Fee, Rent…" />
          <datalist id="fin-cat-list">
            <option value="Student Fee"><option value="Exam Fee"><option value="Salary">
            <option value="Rent"><option value="Utilities"><option value="Equipment">
            <option value="Marketing"><option value="Miscellaneous">
          </datalist>
        </div>
        <div class="form-group">
          <label>তারিখ <span class="req">*</span></label>
          <input id="ff-date" type="date" class="form-control" value="${(d.date||Utils.today()).split('T')[0]}" />
        </div>
      </div>
      <div class="form-group">
        <label>বিবরণ</label>
        <input id="ff-description" class="form-control" value="${d.description||''}" placeholder="লেনদেনের বিস্তারিত বিবরণ" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পরিমাণ (৳) <span class="req">*</span></label>
          <input id="ff-amount" type="number" class="form-control" value="${d.amount||''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label>নোট</label>
          <input id="ff-note" class="form-control" value="${d.note||''}" placeholder="ঐচ্ছিক" />
        </div>
      </div>
      <div id="ff-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn-primary" onclick="Finance.saveEntry()"><i class="fa fa-floppy-disk"></i> সংরক্ষণ</button>
      </div>
    `;
  }

  /* ══════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════ */
  function saveEntry() {
    const amount = Utils.safeNum(Utils.formVal('ff-amount'));
    const type   = Utils.formVal('ff-type');
    const date   = Utils.formVal('ff-date');
    const errEl  = document.getElementById('ff-error');

    if (!amount || amount<=0) { errEl.textContent='পরিমাণ আবশ্যক'; errEl.classList.remove('hidden'); return; }
    if (!date)                { errEl.textContent='তারিখ আবশ্যক';  errEl.classList.remove('hidden'); return; }

    const record = {
      type,
      method:      Utils.formVal('ff-method') || 'Cash',
      category:    Utils.formVal('ff-category'),
      description: Utils.formVal('ff-description'),
      amount,
      date,
      note:        Utils.formVal('ff-note'),
    };

    /* Loan Giving/Receiving → loans table-এও entry */
    if (type==='Loan Giving'||type==='Loan Receiving') {
      SupabaseSync.insert(DB.loans, {
        direction:   type==='Loan Giving'?'given':'received',
        person:      record.description||'অজানা',
        amount,
        date,
        note:        record.note,
        status:      'Outstanding',
      });
    }

    if (editingId) {
      SupabaseSync.update(DB.finance, editingId, record);
      Utils.toast('লেনদেন আপডেট হয়েছে ✓','success');
    } else {
      SupabaseSync.insert(DB.finance, record);
      Utils.toast('লেনদেন যোগ হয়েছে ✓','success');
    }

    Utils.closeModal();
    render();
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteEntry(id) {
    const ok = await Utils.confirm('এই লেনদেন মুছে ফেলবেন?','লেনদেন মুছুন');
    if (!ok) return;
    SupabaseSync.remove(DB.finance, id);
    Utils.toast('মুছে ফেলা হয়েছে','info');
    render();
  }

  /* ══════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════ */
  function exportExcel() {
    const all      = SupabaseSync.getAll(DB.finance);
    const filtered = applyFilters(all);
    const rows     = filtered.map(f=>({
      'তারিখ':    f.date||'',
      'ধরন':      f.type||'',
      'বিভাগ':    f.category||'',
      'বিবরণ':    f.description||'',
      'পদ্ধতি':   f.method||'',
      'পরিমাণ':   f.amount||0,
      'নোট':      f.note||'',
    }));
    Utils.exportExcel(rows,'finance_ledger','আর্থিক লেজার');
  }

  return {
    render, onSearch, onFilter, resetFilters,
    openAddModal, openEditModal,
    saveEntry, deleteEntry, exportExcel,
  };

})();
