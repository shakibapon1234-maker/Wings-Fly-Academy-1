/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/core/utils.js
   Global helper functions — সব module ব্যবহার করে
════════════════════════════════════════════════ */

const Utils = (() => {

  /* ══════════════════════════════════════════
     ID GENERATION
  ══════════════════════════════════════════ */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  function generateStudentId(existingIds = []) {
    const settings = SupabaseSync.localGetObj(SupabaseSync.LS.settings);
    const prefix = settings.student_id_prefix || 'WFA';
    const year = new Date().getFullYear().toString().slice(-2);
    let num = 1;
    while (existingIds.includes(`${prefix}-${year}-${String(num).padStart(3,'0')}`)) num++;
    return `${prefix}-${year}-${String(num).padStart(3,'0')}`;
  }

  function generateRegId(existingIds = []) {
    const year = new Date().getFullYear().toString().slice(-2);
    let num = 1;
    while (existingIds.includes(`REG-${year}-${String(num).padStart(4,'0')}`)) num++;
    return `REG-${year}-${String(num).padStart(4,'0')}`;
  }

  /* ══════════════════════════════════════════
     DATE & TIME
  ══════════════════════════════════════════ */
  function today() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  function now() {
    return new Date().toISOString();
  }

  function formatDate(dateStr, locale = 'bn-BD') {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch { return dateStr; }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('bn-BD', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  function monthName(monthStr) {
    /* monthStr: "2026-04" */
    if (!monthStr) return '';
    const [y, m] = monthStr.split('-');
    const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    return `${months[parseInt(m)-1]} ${y}`;
  }

  function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  /* Countdown from expiry timestamp */
  function timeLeft(expiresAt) {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'মেয়াদ শেষ';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 24) return `${Math.floor(h/24)} দিন বাকি`;
    if (h > 0)  return `${h} ঘণ্টা ${m} মিনিট বাকি`;
    return `${m} মিনিট বাকি`;
  }

  /* ══════════════════════════════════════════
     NUMBER / CURRENCY
  ══════════════════════════════════════════ */
  function taka(amount, showSign = false) {
    const n = parseFloat(amount) || 0;
    const formatted = n.toLocaleString('bn-BD', { maximumFractionDigits: 2 });
    const sign = showSign && n > 0 ? '+' : '';
    return `${sign}৳${formatted}`;
  }

  function takaEn(amount) {
    const n = parseFloat(amount) || 0;
    return '৳' + n.toLocaleString('en-BD', { maximumFractionDigits: 2 });
  }

  function safeNum(val) {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  /* ══════════════════════════════════════════
     TOAST NOTIFICATIONS
  ══════════════════════════════════════════ */
  const TOAST_ICONS = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info',
  };

  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa ${TOAST_ICONS[type] || 'fa-circle-info'}"></i><span>${message}</span>`;
    container.appendChild(el);

    const remove = () => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 320);
    };
    el.addEventListener('click', remove);
    setTimeout(remove, duration);
  }

  /* ══════════════════════════════════════════
     CONFIRM DIALOG
  ══════════════════════════════════════════ */
  function confirm(message, title = 'নিশ্চিত করুন') {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-overlay');
      const msgEl   = document.getElementById('confirm-message');
      const titleEl = document.getElementById('confirm-title');
      const yesBtn  = document.getElementById('confirm-yes');
      const noBtn   = document.getElementById('confirm-no');
      if (!overlay) { resolve(false); return; }

      titleEl.textContent = title;
      msgEl.textContent   = message;
      overlay.classList.remove('hidden');

      const cleanup = (val) => {
        overlay.classList.add('hidden');
        yesBtn.replaceWith(yesBtn.cloneNode(true));
        noBtn.replaceWith(noBtn.cloneNode(true));
        resolve(val);
      };

      document.getElementById('confirm-yes').addEventListener('click', () => cleanup(true),  { once: true });
      document.getElementById('confirm-no').addEventListener('click',  () => cleanup(false), { once: true });
    });
  }

  /* ══════════════════════════════════════════
     MODAL HELPERS
  ══════════════════════════════════════════ */
  function openModal(title, bodyHTML, size = '') {
    const overlay = document.getElementById('modal-overlay');
    const box     = document.getElementById('modal-box');
    const titleEl = document.getElementById('modal-title');
    const body    = document.getElementById('modal-body');
    if (!overlay) return;

    titleEl.innerHTML = title;
    body.innerHTML    = bodyHTML;
    box.className     = 'modal-box ' + size;
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  /* ══════════════════════════════════════════
     FORM HELPERS
  ══════════════════════════════════════════ */
  function formVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function formSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }

  function formData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('[name]').forEach(el => {
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return data;
  }

  function setError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════
     TABLE HELPERS
  ══════════════════════════════════════════ */
  function noDataRow(cols, message = 'কোনো ডেটা নেই') {
    return `<tr><td colspan="${cols}" class="no-data">
      <i class="fa fa-inbox"></i>${message}
    </td></tr>`;
  }

  function actionBtns(id, options = {}) {
    const { edit = true, del = true, extra = '' } = options;
    let html = `<div class="table-actions">`;
    if (edit) html += `<button class="btn-outline btn-xs" onclick="${options.editFn || 'null'}('${id}')">
      <i class="fa fa-pen"></i></button>`;
    if (del)  html += `<button class="btn-danger btn-xs" onclick="${options.delFn || 'null'}('${id}')">
      <i class="fa fa-trash"></i></button>`;
    html += extra + `</div>`;
    return html;
  }

  /* ══════════════════════════════════════════
     PRINT
  ══════════════════════════════════════════ */
  function printArea(elementId) {
    const content = document.getElementById(elementId);
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Wings Fly Aviation Academy</title>
      <link rel="stylesheet" href="css/main.css">
      <link rel="stylesheet" href="css/print.css">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=Hind+Siliguri:wght@400;600&display=swap" rel="stylesheet">
      <style>body{background:#fff;color:#000;padding:20px;}</style>
    </head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  /* ══════════════════════════════════════════
     EXCEL EXPORT (SheetJS)
  ══════════════════════════════════════════ */
  function exportExcel(data, filename = 'export', sheetName = 'Sheet1') {
    if (!window.XLSX) { toast('XLSX library লোড হয়নি', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${today()}.xlsx`);
  }

  /* ══════════════════════════════════════════
     SEARCH / FILTER
  ══════════════════════════════════════════ */
  function searchFilter(rows, query, fields) {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(row =>
      fields.some(f => (row[f] || '').toString().toLowerCase().includes(q))
    );
  }

  function dateRangeFilter(rows, dateField, from, to) {
    return rows.filter(row => {
      const d = row[dateField] ? row[dateField].split('T')[0] : '';
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }

  /* ══════════════════════════════════════════
     BADGE HELPERS
  ══════════════════════════════════════════ */
  function badge(text, type = 'primary') {
    return `<span class="badge badge-${type}">${text}</span>`;
  }

  function dueBadge(due) {
    if (due <= 0) return badge('পরিশোধিত', 'success');
    return badge(`বাকি ৳${safeNum(due).toLocaleString()}`, 'danger');
  }

  function statusBadge(status) {
    const map = {
      'Active':   ['সক্রিয়',   'success'],
      'active':   ['সক্রিয়',   'success'],
      'Inactive': ['নিষ্ক্রিয়', 'muted'],
      'inactive': ['নিষ্ক্রিয়', 'muted'],
      'Paid':     ['পরিশোধিত', 'success'],
      'paid':     ['পরিশোধিত', 'success'],
      'Unpaid':   ['অপরিশোধিত','danger'],
      'unpaid':   ['অপরিশোধিত','danger'],
      'Partial':  ['আংশিক',    'warning'],
      'partial':  ['আংশিক',    'warning'],
      'Pass':     ['পাস',       'success'],
      'Fail':     ['ফেল',       'danger'],
    };
    const [label, type] = map[status] || [status, 'primary'];
    return badge(label, type);
  }

  function methodBadge(method) {
    const map = {
      'Cash':          ['নগদ',        'method-cash'],
      'Bank':          ['ব্যাংক',     'method-bank'],
      'Mobile Banking':['মোবাইল ব্যাংকিং','method-mobile'],
    };
    const [label, cls] = map[method] || [method, ''];
    return `<span class="method-badge ${cls}">${label}</span>`;
  }

  /* ══════════════════════════════════════════
     STRING HELPERS
  ══════════════════════════════════════════ */
  function truncate(str, max = 30) {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  function initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  /* ══════════════════════════════════════════
     MISC
  ══════════════════════════════════════════ */
  function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function sortBy(arr, key, dir = 'asc') {
    return [...arr].sort((a, b) => {
      const va = a[key] ?? ''; const vb = b[key] ?? '';
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  /* Public API */
  return {
    generateId, generateStudentId, generateRegId,
    today, now, formatDate, formatDateTime, monthName, currentMonth, timeLeft,
    taka, takaEn, safeNum, pct,
    toast, confirm,
    openModal, closeModal,
    formVal, formSet, formData, setError,
    noDataRow, actionBtns,
    printArea, exportExcel,
    searchFilter, dateRangeFilter,
    badge, dueBadge, statusBadge, methodBadge,
    truncate, initials,
    debounce, sortBy,
  };

})();
