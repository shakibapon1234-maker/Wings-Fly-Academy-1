// ============================================================
// Wings Fly Aviation Academy — Utility Functions
// ============================================================

const Utils = (() => {

  // ── Date Formatting ───────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatDateEN(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // ── Number Formatting ─────────────────────────────────────
  function formatMoney(amount) {
    const n = parseFloat(amount) || 0;
    return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatMoneyPlain(amount) {
    return (parseFloat(amount) || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // ── String Helpers ────────────────────────────────────────
  function truncate(str, len = 30) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function slugify(str) {
    return (str || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── DOM Helpers ───────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function qs(sel, parent = document) { return parent.querySelector(sel); }
  function qsa(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }

  function show(id) { const e = el(id); if (e) e.style.display = ''; }
  function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }
  function toggle(id) { const e = el(id); if (e) e.style.display = e.style.display === 'none' ? '' : 'none'; }

  // ── Toast Notifications ───────────────────────────────────
  function toast(msg, type = 'info', duration = 3000) {
    let container = el('toast-container');
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

  // ── Modal Helpers ─────────────────────────────────────────
  function openModal(id) {
    const m = el(id);
    if (m) { m.style.display = 'flex'; requestAnimationFrame(() => m.classList.add('open')); }
  }

  function closeModal(id) {
    const m = el(id);
    if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 250); }
  }

  // ── Confirm Dialog ────────────────────────────────────────
  function confirm(msg) {
    return window.confirm(msg);
  }

  // ── Export helpers ────────────────────────────────────────
  function downloadCSV(filename, rows) {
    if (!rows || rows.length === 0) { toast('কোনো ডেটা নেই', 'warn'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Pagination ────────────────────────────────────────────
  function paginate(arr, page, pageSize) {
    const start = (page - 1) * pageSize;
    return { items: arr.slice(start, start + pageSize), total: arr.length, pages: Math.ceil(arr.length / pageSize) };
  }

  // ── Search/Filter ─────────────────────────────────────────
  function searchFilter(arr, term, fields) {
    if (!term) return arr;
    const t = term.toLowerCase();
    return arr.filter(row => fields.some(f => (row[f] || '').toString().toLowerCase().includes(t)));
  }

  // ── Debounce ──────────────────────────────────────────────
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  return {
    formatDate, formatDateEN, todayISO, nowISO,
    formatMoney, formatMoneyPlain,
    truncate, slugify, capitalize,
    el, qs, qsa, show, hide, toggle,
    toast, openModal, closeModal, confirm,
    downloadCSV, paginate, searchFilter, debounce,
  };
})();

window.Utils = Utils;
