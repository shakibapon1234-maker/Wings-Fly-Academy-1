// ============================================================
// Wings Fly Aviation Academy — Utility Functions
// ============================================================

const Utils = (() => {

  // ── XSS Protection ─────────────────────────────────────────
  // User input সরাসরি innerHTML এ বসানোর আগে এই function দিয়ে
  // escape করতে হবে। যেমন: `<div>${Utils.esc(s.name)}</div>`
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // ── Date Helpers ───────────────────────────────────────────
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  function todayISO() { return today(); }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateEN(dateStr) { return formatDate(dateStr); }

  // ── Number Helpers ─────────────────────────────────────────
  function safeNum(val) {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function takaEn(amount) {
    const n = safeNum(amount);
    return '৳' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatMoney(amount) { return takaEn(amount); }
  function formatMoneyPlain(amount) {
    return safeNum(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // ── String Helpers ─────────────────────────────────────────
  function truncate(str, len = 30) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── Form Helpers ──────────────────────────────────────────
  function formVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function formSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ── DOM Helpers ───────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  // ── Toast Notifications ───────────────────────────────────
  function toast(msg, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
  }

  // ── Modal ─────────────────────────────────────────────────
  function openModal(title, bodyHTML, sizeClass) {
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const box = backdrop?.querySelector('.modal-box');
    if (!backdrop || !titleEl || !bodyEl) return;

    titleEl.innerHTML = title;
    bodyEl.innerHTML = bodyHTML;

    if (box) {
      box.style.maxWidth = sizeClass === 'modal-sm' ? '420px' : sizeClass === 'modal-lg' ? '720px' : sizeClass === 'modal-xl' ? '980px' : sizeClass === 'modal-xxl' ? '1200px' : '560px';
      box.style.width = sizeClass === 'modal-xl' ? '98vw' : sizeClass === 'modal-xxl' ? '98vw' : '';
      
      // Dynamic PowerPoint-style Entrance Animations
      box.classList.remove('anim-slide-left', 'anim-slide-right', 'anim-drop-spin', 'anim-zoom-in', 'anim-fade-up', 'anim-slide-down');
      
      const t = (title || '').toLowerCase();
      let animClass = 'anim-fade-up';
      if (t.includes('student')) animClass = 'anim-slide-left';
      else if (t.includes('transaction') || t.includes('finance')) animClass = 'anim-slide-right';
      else if (t.includes('visitor')) animClass = 'anim-drop-spin';
      else if (t.includes('exam')) animClass = 'anim-zoom-in';
      else {
        const anims = ['anim-slide-left', 'anim-slide-right', 'anim-slide-down', 'anim-fade-up', 'anim-zoom-in'];
        animClass = anims[Math.floor(Math.random() * anims.length)];
      }
      
      box.classList.add(animClass);
    }

    backdrop.classList.add('open');
  }

  function closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  // ── Confirm Dialog ────────────────────────────────────────
  function confirm(msg, title) {
    return new Promise((resolve) => {
      const backdrop = document.getElementById('confirm-backdrop');
      const titleEl = document.getElementById('confirm-title');
      const msgEl = document.getElementById('confirm-message');
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');

      if (!backdrop) { resolve(window.confirm(msg)); return; }

      if (titleEl) titleEl.textContent = title || 'Confirm';
      if (msgEl) msgEl.textContent = msg;

      backdrop.classList.add('open');

      function cleanup() {
        backdrop.classList.remove('open');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
      }
      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }

  // ── Badge Helpers ─────────────────────────────────────────
  function badge(label, type) {
    const classMap = {
      success: 'badge-success', danger: 'badge-error', error: 'badge-error',
      warning: 'badge-warning', info: 'badge-info', primary: 'badge-info',
      muted: 'badge-muted',
    };
    return `<span class="badge ${classMap[type] || 'badge-info'}">${label}</span>`;
  }

  function statusBadge(status) {
    const map = {
      'Active': ['Active', 'success'], 'Inactive': ['Inactive', 'muted'],
      'Paid': ['Paid', 'success'], 'Outstanding': ['Due', 'warning'],
      'Registered': ['Registered', 'info'], 'Appeared': ['Present', 'primary'],
      'Passed': ['Passed', 'success'], 'Failed': ['Failed', 'danger'],
      'Present': ['Present', 'success'], 'Absent': ['Absent', 'danger'],
      'Late': ['Late', 'warning'], 'Leave': ['Leave', 'muted'],
    };
    const [label, type] = map[status] || [status, 'info'];
    return badge(label, type);
  }

  function methodBadge(method) {
    if (!method) return badge('—', 'muted');
    if (method.startsWith('Cheque::')) {
      return badge('Cheque — ' + method.slice(8), 'info');
    }
    if (method.startsWith('Card::')) {
      return badge('Card — ' + method.slice(6), 'warning');
    }
    const map = {
      'Cash': ['💵 Cash', 'success'], 'Bank': ['🏦 Bank', 'info'],
      'Mobile Banking': ['📱 Mobile', 'warning'],
    };
    const [label, type] = map[method] || [method, 'muted'];
    return badge(label, type);
  }

  // ── Table Helpers ─────────────────────────────────────────
  function noDataRow(colspan, msg) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:30px;color:var(--text-muted);font-family:var(--font-bn)">
      <i class="fa fa-inbox" style="font-size:2rem;display:block;margin-bottom:8px;opacity:.4"></i>${msg || 'No data available'}
    </td></tr>`;
  }

  // ── Sort & Filter ─────────────────────────────────────────
  function sortBy(arr, field, direction = 'asc') {
    return [...arr].sort((a, b) => {
      const va = a[field] || '';
      const vb = b[field] || '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  function searchFilter(arr, term, fields) {
    if (!term) return arr;
    const t = term.toLowerCase();
    return arr.filter(row => fields.some(f => (row[f] || '').toString().toLowerCase().includes(t)));
  }

  function dateRangeFilter(arr, field, from, to) {
    return arr.filter(r => {
      const d = r[field];
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  // ── Student ID Generator ──────────────────────────────────
  function generateStudentId(existingIds) {
    const prefix = 'WFA-';
    let num = 1001;
    if (existingIds && existingIds.length) {
      const numbers = existingIds.map(id => parseInt((id || '').replace(/\D/g, '')) || 0);
      num = Math.max(...numbers, 1000) + 1;
    }
    return prefix + num;
  }

  // ── Print ─────────────────────────────────────────────────
  function printArea(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Print</title>
      <link rel="stylesheet" href="css/main.css" />
      <link rel="stylesheet" href="css/print.css" />
      <style>body{padding:20px;background:#fff;color:#000}table{width:100%}.no-print{display:none!important}</style>
      </head><body>${el.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); printWindow.close(); };
  }

  // ── Excel Export (SheetJS) ────────────────────────────────
  function exportExcel(rows, filename, sheetName) {
    if (!rows || !rows.length) { toast('No data available', 'warn'); return; }
    if (typeof XLSX === 'undefined') { toast('Excel library Not loaded', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    XLSX.writeFile(wb, `${filename || 'export'}_${today()}.xlsx`);
    toast('Excel Downloaded ✓', 'success');
  }

  // ── CSV Export ────────────────────────────────────────────
  function downloadCSV(filename, rows) {
    if (!rows || rows.length === 0) { toast('No data available', 'warn'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Debounce ──────────────────────────────────────────────
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  // ── Pagination ────────────────────────────────────────────
  function paginate(arr, page, pageSize) {
    const start = (page - 1) * pageSize;
    return { items: arr.slice(start, start + pageSize), total: arr.length, pages: Math.ceil(arr.length / pageSize) };
  }

  function renderPaginationUI(totalItems, currentPage, pageSize, moduleName) {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    let pagesHtml = '';
    
    // Previous button
    pagesHtml += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="${currentPage > 1 ? `${moduleName}.changePage(${currentPage - 1})` : ''}"><i class="fa fa-chevron-left"></i></button>`;
    
    // Page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      pagesHtml += `<button class="page-btn" onclick="${moduleName}.changePage(1)">1</button>`;
      if (startPage > 2) pagesHtml += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${moduleName}.changePage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pagesHtml += `<span class="page-dots">...</span>`;
      pagesHtml += `<button class="page-btn" onclick="${moduleName}.changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    pagesHtml += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="${currentPage < totalPages ? `${moduleName}.changePage(${currentPage + 1})` : ''}"><i class="fa fa-chevron-right"></i></button>`;

    return `
      <div class="pagination-wrapper" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 16px;">
        ${pagesHtml}
        <select class="page-size-select" onchange="${moduleName}.changePageSize(this.value)" style="margin-left: 8px; padding: 6px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; outline: none; cursor: pointer;">
          <option value="10" ${pageSize==10?'selected':''}>10 / page</option>
          <option value="20" ${pageSize==20?'selected':''}>20 / page</option>
          <option value="50" ${pageSize==50?'selected':''}>50 / page</option>
          <option value="100" ${pageSize==100?'selected':''}>100 / page</option>
        </select>
      </div>
    `;
  }

    // ── Payment methods: settlement account + rollups (Cheque:: / Card:: composite values) ──
    function escAttr(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function escText(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }

    /** Account whose balance is affected (Cash, bank name, or mobile wallet name). */
    function getSettlementKey(method) {
      if (!method || method === 'Cash') return 'Cash';
      if (method.startsWith('Cheque::')) {
        const rest = method.slice(8);
        return rest || 'Cash';
      }
      if (method.startsWith('Card::')) {
        const rest = method.slice(6);
        return rest || 'Cash';
      }
      return method;
    }

    /** Bucket for dashboard / accounts hero totals: cash | bank | mobile */
    function getPaymentMethodBucket(method, accounts) {
      if (!accounts && window.SupabaseSync && window.DB) {
        accounts = window.SupabaseSync.getAll(window.DB.accounts);
      }
      accounts = accounts || [];
      const key = getSettlementKey(method);
      if (key === 'Cash') return 'cash';
      if (method === 'Bank') return 'bank';
      if (method === 'Mobile Banking') return 'mobile';
      const acc = accounts.find(a => a.name === key);
      if (acc?.type === 'Bank_Detail') return 'bank';
      if (acc?.type === 'Mobile_Detail') return 'mobile';
      return 'bank';
    }

    /** Accounts search: category is Cash | Bank | Mobile Banking */
    function financeMatchesAccountCategory(method, categoryUi, accounts) {
      const b = getPaymentMethodBucket(method, accounts);
      if (categoryUi === 'Cash') return b === 'cash';
      if (categoryUi === 'Bank') return b === 'bank';
      if (categoryUi === 'Mobile Banking') return b === 'mobile';
      return false;
    }

    // ── Payment Methods Dropdown ──────────────────────────────
    function getPaymentMethodsHTML(selectedValue = '') {
      const accounts = window.SupabaseSync ? window.SupabaseSync.getAll(window.DB.accounts) : [];
      const sel = selectedValue;
      const opt = (val, label) =>
        `<option value="${escAttr(val)}" ${sel === val ? 'selected' : ''}>${escText(label)}</option>`;

      let h = opt('Cash', 'Cash');

      const banks = accounts.filter(a => a.type === 'Bank_Detail' && a.name && a.name.trim());
      banks.forEach(b => {
        const name = b.name.trim();
        h += opt(name, name);
      });

      const mobiles = accounts.filter(a => a.type === 'Mobile_Detail' && a.name && a.name.trim());
      mobiles.forEach(m => {
        const name = m.name.trim();
        h += opt(name, name);
      });

      return h;
    }

    function getAccountBalance(methodName) {
      if (!window.SupabaseSync || !methodName) return 0;
      const accounts = window.SupabaseSync.getAll(window.DB.accounts);
      const finance = window.SupabaseSync.getAll(window.DB.finance);
      const settle = getSettlementKey(methodName);

      let balance = 0;
      if (settle === 'Cash') {
        const cashAcc = accounts.find(a => a.type === 'Cash');
        balance = cashAcc ? parseFloat(cashAcc.balance) || 0 : 0;
      } else {
        const acc = accounts.find(a => a.name === settle);
        if (acc) balance = parseFloat(acc.balance) || 0;
      }
      return balance;
    }

    // ── Payment Methods Event Listener Helper ──
    function onPaymentMethodChange(selectEl, displayElId) {
      if (!selectEl) return;
      const method = selectEl.value;
      const displayEl = document.getElementById(displayElId);
      if (!displayEl) return;
      if (!method) {
        displayEl.innerHTML = '';
        displayEl.style.display = 'none';
        return;
      }
      const bal = getAccountBalance(method);
      displayEl.innerHTML = `<span>&#128181; Available Balance: ${formatMoneyPlain(bal)}</span>`;
      displayEl.style.display = 'inline-flex';
      displayEl.style.alignItems = 'center';
      displayEl.style.marginTop = '8px';
      displayEl.style.padding = '6px 14px';
      displayEl.style.borderRadius = '8px';
      displayEl.style.fontSize = '0.85rem';
      displayEl.style.fontWeight = '700';
      displayEl.style.color = '#00ff88';
      displayEl.style.background = 'rgba(0, 255, 136, 0.08)';
      displayEl.style.border = '1px solid rgba(0, 255, 136, 0.2)';
      displayEl.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.05)';
      displayEl.style.transition = 'all 0.3s ease';
    }

    return {
      // Date
      today, todayISO, nowISO, formatDate, formatDateEN,
      // Number
      safeNum, takaEn, formatMoney, formatMoneyPlain,
      // String
      truncate, capitalize,
      // Form
      formVal, formSet,
      // DOM
      el,
      // Toast
      toast,
      // XSS Protection
      esc,
      // Modal
      openModal, closeModal, confirm,
      // Badges
      badge, statusBadge, methodBadge,
      // Table
      noDataRow,
      // Sort & Filter
      sortBy, searchFilter, dateRangeFilter,
      // Student ID
      generateStudentId,
      // Print & Export
      printArea, exportExcel, downloadCSV,
      // Misc
      debounce, paginate, renderPaginationUI,
      getPaymentMethodsHTML, getAccountBalance, onPaymentMethodChange,
      getSettlementKey, getPaymentMethodBucket, financeMatchesAccountCategory,
    };
})();

window.Utils = Utils;
