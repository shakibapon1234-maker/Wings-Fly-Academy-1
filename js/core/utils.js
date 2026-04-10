// ============================================================
// Wings Fly Aviation Academy — Utility Functions
// ============================================================

const Utils = (() => {

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
      box.style.maxWidth = sizeClass === 'modal-sm' ? '420px' : sizeClass === 'modal-lg' ? '760px' : '560px';
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
    debounce, paginate,
  };
})();

window.Utils = Utils;
