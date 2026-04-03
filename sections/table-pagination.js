// ============================================================
// WINGS FLY AVIATION ACADEMY
// sections/table-pagination.js  —  Universal Pagination Engine
// ============================================================
// সব table এর জন্য একটাই pagination system।
// render() বা renderLedger() এর মতো যেকোনো render function-এ
// এই module ব্যবহার করা যাবে।
//
// কীভাবে কাজ করে:
//   1. WFPaginator(data, pageSize) — paginator object তৈরি করো
//   2. paginator.getPage(n)        — n নম্বর page এর data পাও
//   3. renderPaginationBar(...)    — pagination UI render করো
//
// ============================================================

(function () {
  'use strict';

  // ── STYLES (একবার inject হবে) ─────────────────────────────
  const STYLE_ID = 'wf-pagination-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ===== WF Pagination Bar ===== */
      .wf-pagination-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        padding: 12px 4px 4px;
        user-select: none;
      }
      .wf-pagination-info {
        font-size: 0.82rem;
        color: rgba(255,255,255,0.55);
        white-space: nowrap;
      }
      .wf-pagination-info strong {
        color: rgba(0, 217, 255, 0.9);
      }
      .wf-pagination-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .wf-pg-btn {
        min-width: 34px;
        height: 34px;
        padding: 0 8px;
        border-radius: 8px;
        border: 1px solid rgba(0,217,255,0.2);
        background: rgba(0,217,255,0.05);
        color: rgba(255,255,255,0.75);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .wf-pg-btn:hover:not(:disabled) {
        background: rgba(0,217,255,0.15);
        border-color: rgba(0,217,255,0.5);
        color: #00d9ff;
      }
      .wf-pg-btn.active {
        background: linear-gradient(135deg, #00d9ff22, #00d9ff11);
        border-color: #00d9ff;
        color: #00d9ff;
        box-shadow: 0 0 8px rgba(0,217,255,0.25);
      }
      .wf-pg-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .wf-pg-btn.wf-pg-ellipsis {
        border-color: transparent;
        background: transparent;
        cursor: default;
        color: rgba(255,255,255,0.3);
      }
      .wf-page-size-select {
        height: 34px;
        padding: 0 28px 0 10px;
        border-radius: 8px;
        border: 1px solid rgba(0,217,255,0.2);
        background: rgba(0,0,0,0.3);
        color: rgba(255,255,255,0.75);
        font-size: 0.82rem;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2300d9ff55'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        transition: border-color 0.15s;
      }
      .wf-page-size-select:focus {
        outline: none;
        border-color: rgba(0,217,255,0.5);
      }
      .wf-page-size-select option {
        background: #1a1a2e;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }


  // ── 1. PAGINATOR CLASS ────────────────────────────────────

  /**
   * WFPaginator — data array কে page-wise ভাগ করে।
   *
   * @param {Array}  data      - full data array
   * @param {number} pageSize  - প্রতি page-এ কতো row (default: 20)
   */
  function WFPaginator(data, pageSize) {
    this._data = data || [];
    this._pageSize = parseInt(pageSize) || 20;
    this._currentPage = 1;
  }

  WFPaginator.prototype = {

    get total() { return this._data.length; },

    get pageSize() { return this._pageSize; },

    set pageSize(v) {
      this._pageSize = parseInt(v) || 20;
      this._currentPage = 1;
    },

    get totalPages() {
      if (this._pageSize <= 0) return 1;
      return Math.max(1, Math.ceil(this._data.length / this._pageSize));
    },

    get currentPage() { return this._currentPage; },

    set currentPage(n) {
      this._currentPage = Math.max(1, Math.min(n, this.totalPages));
    },

    /** n নম্বর page এর data slice */
    getPage: function (n) {
      if (n !== undefined) this.currentPage = n;
      const start = (this._currentPage - 1) * this._pageSize;
      const end   = start + this._pageSize;
      return this._data.slice(start, end);
    },

    /** current page এর data (page set না করে) */
    currentPageData: function () {
      return this.getPage(this._currentPage);
    },

    /** info string — বাংলায় */
    infoText: function () {
      if (this.total === 0) return 'কোনো ডেটা নেই';
      const start = (this._currentPage - 1) * this._pageSize + 1;
      const end   = Math.min(this._currentPage * this._pageSize, this.total);
      return `<strong>${start}–${end}</strong> দেখাচ্ছে <strong>${this.total}</strong> এর মধ্যে`;
    },

    /** page numbers array (ellipsis সহ) */
    pageNumbers: function () {
      const total = this.totalPages;
      const cur   = this._currentPage;
      if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      const pages = [1];
      if (cur > 3) pages.push('…');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
        pages.push(i);
      }
      if (cur < total - 2) pages.push('…');
      pages.push(total);
      return pages;
    }
  };


  // ── 2. renderPaginationBar ────────────────────────────────

  /**
   * একটি DOM container-এ pagination bar render করে।
   *
   * @param {string}      containerId   - pagination bar inject হবে এই element-এ
   * @param {WFPaginator} paginator     - WFPaginator instance
   * @param {Function}    onPageChange  - page বদলালে call হবে (newPage, paginator) => void
   * @param {object}      [opts]        - { pageSizes: [10,20,50] }
   */
  function renderPaginationBar(containerId, paginator, onPageChange, opts) {
    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;

    const sizes = (opts && opts.pageSizes) || [10, 20, 50, 100];
    const pages = paginator.pageNumbers();
    const cur   = paginator.currentPage;
    const total = paginator.totalPages;

    // Page size options
    const sizeOptions = sizes.map(s =>
      `<option value="${s}" ${paginator.pageSize === s ? 'selected' : ''}>${s} টি</option>`
    ).join('');

    // Page buttons
    const btns = pages.map(p => {
      if (p === '…') {
        return `<button class="wf-pg-btn wf-pg-ellipsis" disabled>…</button>`;
      }
      return `<button class="wf-pg-btn${p === cur ? ' active' : ''}" data-page="${p}">${p}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="wf-pagination-wrap">
        <div class="wf-pagination-info">${paginator.infoText()}</div>
        <div class="wf-pagination-controls">
          <button class="wf-pg-btn" data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} title="আগের পেজ">
            <i class="bi bi-chevron-left"></i>
          </button>
          ${btns}
          <button class="wf-pg-btn" data-page="${cur + 1}" ${cur >= total ? 'disabled' : ''} title="পরের পেজ">
            <i class="bi bi-chevron-right"></i>
          </button>
          <select class="wf-page-size-select ms-2" title="প্রতি পেজে কতো">
            ${sizeOptions}
          </select>
        </div>
      </div>
    `;

    // Page button click events
    container.querySelectorAll('.wf-pg-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', function () {
        const p = parseInt(this.getAttribute('data-page'));
        if (!isNaN(p) && p !== cur) {
          paginator.currentPage = p;
          onPageChange(paginator.currentPage, paginator);
        }
      });
    });

    // Page size change event
    const sel = container.querySelector('.wf-page-size-select');
    if (sel) {
      sel.addEventListener('change', function () {
        paginator.pageSize = parseInt(this.value);
        paginator.currentPage = 1;
        onPageChange(paginator.currentPage, paginator);
      });
    }
  }


  // ── 3. TABLE SCROLL TO TOP HELPER ────────────────────────

  /**
   * Page change হলে table এর top-এ scroll করো।
   * @param {string} tableId - scroll target element id
   */
  function scrollToTableTop(tableId) {
    const el = document.getElementById(tableId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight * 0.5) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }


  // ── 4. GLOBAL STATE STORE ─────────────────────────────────
  // প্রতিটি table এর paginator এখানে রাখা হয়।
  // key = table identifier, value = WFPaginator instance

  window._wfPaginators = window._wfPaginators || {};


  // ── 5. PUBLIC API ─────────────────────────────────────────

  window.WFPaginator          = WFPaginator;
  window.renderPaginationBar  = renderPaginationBar;
  window.scrollToTableTop     = scrollToTableTop;

  console.log('✅ table-pagination.js loaded — WFPaginator ready');

})();
