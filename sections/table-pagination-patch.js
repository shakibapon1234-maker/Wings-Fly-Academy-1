// ============================================================
// WINGS FLY AVIATION ACADEMY
// sections/table-pagination-patch.js
// ============================================================
// এই ফাইলটা বাকি সব table (Visitor, Employee, Salary, Exam,
// Loan) এ pagination inject করে — কোনো render function
// ভাঙা ছাড়াই।
//
// কীভাবে কাজ করে:
//   • প্রতিটি target tbody কে MutationObserver দিয়ে watch করে
//   • Row inject হলে WFPaginator দিয়ে paginate করে
//   • Original render function কে wrap করে (monkey-patch)
//
// REQUIRES: table-pagination.js আগে load হতে হবে
// ============================================================

(function () {
  'use strict';

  // ── CONFIG: কোন tbody তে pagination লাগবে ──────────────────
  var PATCH_TABLES = [
    {
      tbodyId:       'visitorTableBody',
      barId:         'visitorPaginationBar',
      renderFnName:  'renderVisitorTable',   // window[renderFnName]
      pageSize:      20,
      scrollTarget:  'visitorTableBody'
    },
    {
      tbodyId:       'employeeTableBody',
      barId:         'employeePaginationBar',
      renderFnName:  'renderEmployeeTable',
      pageSize:      20,
      scrollTarget:  'employeeTableBody'
    },
    {
      tbodyId:       'salaryTableBody',
      barId:         'salaryPaginationBar',
      renderFnName:  'loadSalaryHub',   // ✅ FIX: actual function name
      pageSize:      20,
      scrollTarget:  'salaryTableBody'
    },
    {
      tbodyId:       'examResultsTableBody',
      barId:         'examPaginationBar',
      renderFnName:  'renderExamResults',
      pageSize:      20,
      scrollTarget:  'examResultsTableBody'
    },
    {
      tbodyId:       'loanDetailBody',
      barId:         'loanPaginationBar',
      renderFnName:  'renderLoanTable',
      pageSize:      20,
      scrollTarget:  'loanDetailBody'
    },
    // ✅ FIX: Finance (Ledger) tab pagination
    {
      tbodyId:       'ledgerTableBody',
      barId:         'ledgerPaginationBar',
      renderFnName:  'renderLedger',
      pageSize:      20,
      scrollTarget:  'ledgerTableBody'
    }
  ];

  // ── WAIT for WFPaginator ───────────────────────────────────
  function waitForPaginator(cb, tries) {
    tries = tries || 0;
    if (typeof window.WFPaginator === 'function' && typeof window.renderPaginationBar === 'function') {
      cb();
    } else if (tries < 40) {
      setTimeout(function () { waitForPaginator(cb, tries + 1); }, 150);
    } else {
      console.warn('[PaginationPatch] WFPaginator not found after 6s — patch skipped');
    }
  }

  // ── CORE: pagination bar inject করো tbody এর পরে ──────────
  function ensurePaginationBar(cfg) {
    var bar = document.getElementById(cfg.barId);
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = cfg.barId;
    bar.className = 'wf-pagination-patch-bar';

    var tbody = document.getElementById(cfg.tbodyId);
    if (!tbody) return null;

    // table → table-responsive → parent এর পরে inject করো
    var tableWrap = tbody.closest('.table-responsive')
                 || tbody.closest('table')
                 || tbody.parentElement;
    if (tableWrap && tableWrap.parentNode) {
      tableWrap.parentNode.insertBefore(bar, tableWrap.nextSibling);
    }
    return bar;
  }

  // ── PAGINATOR STATE ────────────────────────────────────────
  if (!window._wfPaginators) window._wfPaginators = {};

  // ── PATCH: tbody এর সব rows নিয়ে paginate করো ────────────
  function patchTbody(cfg) {
    var tbody = document.getElementById(cfg.tbodyId);
    if (!tbody) return;

    // ✅ FIX: observer re-trigger prevent
    _patching[cfg.tbodyId] = true;

    var allRows = Array.from(tbody.querySelectorAll('tr'));
    if (allRows.length === 0) {
      // empty state — bar লুকাও
      var existingBar = document.getElementById(cfg.barId);
      if (existingBar) existingBar.innerHTML = '';
      return;
    }

    // শুধু একটি "no data" row থাকলে pagination লাগবে না
    if (allRows.length === 1) {
      var onlyRow = allRows[0];
      var tdCount = onlyRow.querySelectorAll('td').length;
      if (tdCount <= 1) {
        var existingBar2 = document.getElementById(cfg.barId);
        if (existingBar2) existingBar2.innerHTML = '';
        return;
      }
    }

    // pageSize মনে রাখো
    var existingPg = window._wfPaginators[cfg.tbodyId];
    var pageSize = existingPg ? existingPg.pageSize : cfg.pageSize;

    // ✅ FIX #2: Date column detect করে newest-first sort করো
    // প্রথম row এর cell গুলো দেখে date column খোঁজো
    var sortedRows = allRows.slice(); // copy
    try {
      var firstRow = allRows[0];
      if (firstRow) {
        var cells = firstRow.querySelectorAll('td');
        var dateColIdx = -1;
        // date-like content খোঁজো (YYYY-MM-DD বা DD Mon YYYY বা timestamp)
        var datePattern = /\d{4}[-/]\d{2}[-/]\d{2}|\d{2}\s+\w{3}\s+\d{4}|\w{3}\s+\d{1,2},\s+\d{4}/;
        for (var ci = 0; ci < cells.length; ci++) {
          var txt = cells[ci].textContent.trim();
          if (datePattern.test(txt)) { dateColIdx = ci; break; }
        }
        if (dateColIdx >= 0) {
          sortedRows.sort(function(a, b) {
            var ta = a.querySelectorAll('td')[dateColIdx];
            var tb = b.querySelectorAll('td')[dateColIdx];
            var da = ta ? new Date(ta.textContent.trim()) : new Date(0);
            var db = tb ? new Date(tb.textContent.trim()) : new Date(0);
            return db - da; // newest first
          });
          // tbody তে re-append sorted order এ
          sortedRows.forEach(function(r) { tbody.appendChild(r); });
        }
      }
    } catch (sortErr) { /* sort fail হলে original order রাখো */ }

    // সব rows কে data array হিসেবে নাও (DOM elements)
    var pg = new window.WFPaginator(sortedRows, pageSize);
    window._wfPaginators[cfg.tbodyId] = pg;

    // সব rows hide করো
    sortedRows.forEach(function (r) { r.style.display = 'none'; });

    // current page এর rows দেখাও
    function showPage(page) {
      sortedRows.forEach(function (r) { r.style.display = 'none'; });
      pg.getPage(page).forEach(function (r) { r.style.display = ''; });

      var bar = ensurePaginationBar(cfg);
      if (!bar) return;

      window.renderPaginationBar(
        cfg.barId,
        pg,
        function (newPage) {
          showPage(newPage);
          if (typeof window.scrollToTableTop === 'function') {
            window.scrollToTableTop(cfg.scrollTarget);
          }
        },
        { pageSizes: [10, 20, 50, 100] }
      );
    }

    ensurePaginationBar(cfg);
    showPage(1);

    // ✅ FIX: patch complete — observer আবার fire করতে পারবে
    _patching[cfg.tbodyId] = false;
  }

  // ── MUTATION OBSERVER: tbody content বদলালে re-patch ───────
  var _observers = {};

  // ── PATCHING FLAG — prevent observer re-trigger ───────────
  var _patching = {};

  function watchTbody(cfg) {
    // পুরনো observer বন্ধ করো
    if (_observers[cfg.tbodyId]) {
      _observers[cfg.tbodyId].disconnect();
    }

    function tryAttach(attempts) {
      var tbody = document.getElementById(cfg.tbodyId);
      if (!tbody) {
        if (attempts < 30) setTimeout(function () { tryAttach(attempts + 1); }, 300);
        return;
      }

      var debounceTimer = null;

      var observer = new MutationObserver(function () {
        // ✅ FIX: যদি এই moment এ patchTbody চলছে, observer ignore করো
        if (_patching[cfg.tbodyId]) return;
        // debounce — render শেষ হওয়ার পরে patch করো
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          if (!_patching[cfg.tbodyId]) patchTbody(cfg);
        }, 80);
      });

      observer.observe(tbody, { childList: true, subtree: false });
      _observers[cfg.tbodyId] = observer;

      // Initial patch যদি এখনই data থাকে
      patchTbody(cfg);
    }

    tryAttach(0);
  }

  // ── MONKEY-PATCH render functions ─────────────────────────
  // render function call হলে page 1 এ reset করো
  function monkeyPatchRenderFn(cfg) {
    if (!cfg.renderFnName) return;

    function doWrap() {
      var orig = window[cfg.renderFnName];
      if (typeof orig !== 'function') return false;
      if (orig._wfPatched) return true; // ইতিমধ্যে patched

      window[cfg.renderFnName] = function () {
        var result = orig.apply(this, arguments);
        // render এর পরে paginator reset করো page 1 এ
        var pg = window._wfPaginators && window._wfPaginators[cfg.tbodyId];
        if (pg) pg.currentPage = 1;
        return result;
      };
      window[cfg.renderFnName]._wfPatched = true;
      return true;
    }

    // এখনই try করো, না পারলে retry
    if (!doWrap()) {
      var attempts = 0;
      var timer = setInterval(function () {
        if (doWrap() || attempts++ > 20) clearInterval(timer);
      }, 500);
    }
  }

  // ── INIT ───────────────────────────────────────────────────
  waitForPaginator(function () {
    PATCH_TABLES.forEach(function (cfg) {
      watchTbody(cfg);
      monkeyPatchRenderFn(cfg);
    });

    // switchTab hook — tab switch এ pagination bar re-init
    // ✅ FIX: Hook-based instead of monkey-patching to avoid circular recursion
    if (!window._wfSwitchTabHooks) window._wfSwitchTabHooks = [];
    if (!window._wfSwitchTabHooks._paginationRegistered) {
      window._wfSwitchTabHooks.push(function (tabName) {
        setTimeout(function () {
          PATCH_TABLES.forEach(function (cfg) {
            var tbody = document.getElementById(cfg.tbodyId);
            if (tbody && tbody.querySelectorAll('tr').length > 0) {
              var pg = window._wfPaginators && window._wfPaginators[cfg.tbodyId];
              if (!pg || pg.currentPage <= 1) {
                patchTbody(cfg);
              }
            }
          });
        }, 200);
      });
      window._wfSwitchTabHooks._paginationRegistered = true;
    }

    console.log('✅ table-pagination-patch.js — watching', PATCH_TABLES.length, 'tables');
  });

  // ── GLOBAL EXPOSE (manual re-patch করতে পারবেন) ──────────
  window.wfRepatchTable = function (tbodyId) {
    var cfg = PATCH_TABLES.find(function (c) { return c.tbodyId === tbodyId; });
    if (cfg) patchTbody(cfg);
  };

})();


// ============================================================
// ANALYTICS MODAL PAGINATION PATCH
// Account Analytics Modal — Income & Expense tables এ
// pagination এবং Date প্রথম column এ দেখানো
// ============================================================

(function () {
    'use strict';

    var ANA_PAGE_SIZE = 10;

    function formatDisplayDate(raw) {
        if (!raw) return '—';
        var s = String(raw).trim().slice(0, 10);
        var norm = '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            norm = s;
        } else {
            var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (m) norm = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
        }
        if (!norm) return s;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var parts = norm.split('-');
        var yr = parts[0], mo = parseInt(parts[1], 10) - 1, dy = parseInt(parts[2], 10);
        if (isNaN(mo) || mo < 0 || mo > 11) return s;
        return dy + ' ' + months[mo] + ' ' + yr;
    }

    function _pgBtnStyle(active) {
        if (active) return 'background:#1565c0;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:0.75rem;cursor:default;font-weight:bold;';
        return 'background:rgba(255,255,255,0.06);color:#ccc;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:3px 9px;font-size:0.75rem;cursor:pointer;';
    }

    function buildPaginationBar(currentPage, totalPages, onPageClick) {
        if (totalPages <= 1) return '';
        var html = '<div style="display:flex;gap:4px;align-items:center;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;">';

        // Page buttons with data-page attribute (event listener attached later)
        if (currentPage > 1) {
            html += '<button data-pg="1" style="' + _pgBtnStyle(false) + '">&laquo;</button>';
            html += '<button data-pg="' + (currentPage - 1) + '" style="' + _pgBtnStyle(false) + '">&lsaquo;</button>';
        }
        var start = Math.max(1, currentPage - 3);
        var end = Math.min(totalPages, currentPage + 3);
        if (end - start < 6) { start = Math.max(1, end - 6); end = Math.min(totalPages, start + 6); }
        for (var p = start; p <= end; p++) {
            html += '<button data-pg="' + p + '" style="' + _pgBtnStyle(p === currentPage) + '">' + p + '</button>';
        }
        if (currentPage < totalPages) {
            html += '<button data-pg="' + (currentPage + 1) + '" style="' + _pgBtnStyle(false) + '">&rsaquo;</button>';
            html += '<button data-pg="' + totalPages + '" style="' + _pgBtnStyle(false) + '">&raquo;</button>';
        }
        html += '</div>';
        return html;
    }

    // ✅ FIX: Attach pagination click handlers via event delegation (not inline onclick)
    function attachPaginationClicks(barId, onPageClick) {
        var bar = document.getElementById(barId);
        if (!bar) return;
        bar.querySelectorAll('button[data-pg]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var pg = parseInt(this.getAttribute('data-pg'));
                if (!isNaN(pg)) onPageClick(pg);
            });
        });
    }

    var _incPage = 1;
    var _expPage = 1;
    var _lastIncArr = [];
    var _lastExpArr = [];

    // ── DATE প্রথম column — row builder ────────────────────────
    function renderTablePage(rows, clr, bClr, currentPage) {
        if (!rows || !rows.length) return '<tr><td colspan="5" class="text-center text-muted py-5" style="border:none;">কোনো রেকর্ড পাওয়া যায়নি</td></tr>';
        var sorted = rows.slice().sort(function (a, b) {
            return String(b.date || b.timestamp || '').localeCompare(String(a.date || a.timestamp || ''));
        });
        var totalPages = Math.ceil(sorted.length / ANA_PAGE_SIZE);
        var safePage = Math.max(1, Math.min(currentPage, totalPages));
        var pageRows = sorted.slice((safePage - 1) * ANA_PAGE_SIZE, safePage * ANA_PAGE_SIZE);
        return pageRows.map(function (f) {
            var amt = window._anaParseAmt ? window._anaParseAmt(f.amount) : (parseFloat(f.amount) || 0);
            var fmtAmt = window._anaFmt ? window._anaFmt(amt) : ('৳' + amt.toLocaleString());
            var fmtDate = formatDisplayDate(f.date || f.timestamp);
            var desc = f.description || '—';
            var person = f.person || '—';
            var category = f.category || f.type || '—';
            // DATE সবার আগে (1st column)
            return '<tr style="border-bottom:1px solid ' + bClr + ';">' +
                '<td style="color:#4fc3f7;font-size:0.73rem;white-space:nowrap;font-weight:600;">' + fmtDate + '</td>' +
                '<td style="font-size:0.78rem;">' + category + '</td>' +
                '<td style="font-size:0.78rem;" title="' + person + '">' + person + '</td>' +
                '<td class="text-end fw-bold" style="color:' + clr + ';font-size:0.78rem;white-space:nowrap;">' + fmtAmt + '</td>' +
                '<td style="color:#aaa;font-size:0.72rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + desc + '">' + desc + '</td>' +
                '</tr>';
        }).join('');
    }

    // ── thead ও ঠিক করো (Date first) ──────────────────────────
    function fixTableHeaders() {
        // Income table header
        var incThead = document.querySelector('#accountAnalyticsModal table:first-of-type thead tr');
        var expThead = document.querySelector('#accountAnalyticsModal table:last-of-type thead tr');

        var newThead = '<th style="color:#aaa;font-weight:500;width:13%;">Date</th>' +
            '<th style="color:#aaa;font-weight:500;width:14%;">Category</th>' +
            '<th style="color:#aaa;font-weight:500;width:14%;">Person</th>' +
            '<th class="text-end" style="color:#aaa;font-weight:500;width:12%;">Amount</th>' +
            '<th style="color:#aaa;font-weight:500;">Description</th>';

        // income thead
        var iThead = document.querySelector('#ana_incomeRows');
        if (iThead) {
            var iTable = iThead.closest('table');
            if (iTable) {
                var iHead = iTable.querySelector('thead tr');
                if (iHead && !iHead._wfFixed) { iHead.innerHTML = newThead; iHead._wfFixed = true; }
            }
        }
        // expense thead
        var eThead = document.querySelector('#ana_expenseRows');
        if (eThead) {
            var eTable = eThead.closest('table');
            if (eTable) {
                var eHead = eTable.querySelector('thead tr');
                if (eHead && !eHead._wfFixed) { eHead.innerHTML = newThead; eHead._wfFixed = true; }
            }
        }
    }

    function injectPaginationBar(tbodyId, barId, rows, currentPage, onPageFn) {
        var totalPages = Math.ceil(rows.length / ANA_PAGE_SIZE);
        var bar = document.getElementById(barId);
        if (!bar) {
            var tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            var wrap = tbody.closest('.table-responsive') || tbody.closest('table') || tbody.parentElement;
            if (wrap && wrap.parentNode) {
                bar = document.createElement('div');
                bar.id = barId;
                wrap.parentNode.insertBefore(bar, wrap.nextSibling);
            }
        }
        if (!bar) return;
        var from = rows.length ? ((currentPage - 1) * ANA_PAGE_SIZE) + 1 : 0;
        var to = Math.min(currentPage * ANA_PAGE_SIZE, rows.length);
        var countHtml = rows.length > 0
            ? '<div style="font-size:0.73rem;color:#888;text-align:right;margin-top:4px;">দেখাচ্ছে: ' + from + '–' + to + ' (মোট ' + rows.length + ' টি)</div>'
            : '';
        bar.innerHTML = buildPaginationBar(currentPage, totalPages, onPageFn) + countHtml;
        // ✅ FIX: Attach click handlers after innerHTML is set
        attachPaginationClicks(barId, onPageFn);
    }

    function rebuildWithPagination(incP, expP) {
        try {
            fixTableHeaders();
            var gd = window.globalData || {};
            var mode = window._anaMode || 'all';
            var monthVal = ((document.getElementById('ana_monthFilter') || {}).value) || '';
            var df = ((document.getElementById('ana_dateFrom') || {}).value) || '';
            var dt = ((document.getElementById('ana_dateTo') || {}).value) || '';
            var normDateFn = window._anaNormDate || function(v){ return String(v||'').slice(0,10); };

            var filtered = (gd.finance || []).filter(function(f) {
                if (!f || f._deleted || !f.id) return false;
                var d = normDateFn(f.date || f.timestamp);
                if (!d) return false;
                if (mode === 'month') return !monthVal || d.indexOf(monthVal) === 0;
                if (mode === 'range') { if (df && d < df) return false; if (dt && d > dt) return false; }
                return true;
            });

            function isIncome(f) {
                var t = String(f.type||'').toLowerCase(), c = String(f.category||'').toLowerCase();
                return t==='income'||t==='loan received'||c==='income'||c==='loan received'
                    ||t.includes('income')||c.includes('income')||t.includes('fee')||c.includes('fee')
                    ||t.includes('received')||c.includes('received')||t.includes('installment')||c.includes('installment')
                    ||t.includes('registration')||c.includes('registration')||t.includes('refund')||c.includes('refund')
                    ||t.includes('advance')||c.includes('advance');
            }
            function isExpense(f) {
                var t = String(f.type||'').toLowerCase(), c = String(f.category||'').toLowerCase();
                return t==='expense'||t==='loan given'||c==='expense'||c==='loan given'
                    ||t.includes('expense')||c.includes('expense')||t.includes('salary')||c.includes('salary')
                    ||t.includes('rent')||c.includes('rent')||t.includes('utilities')||c.includes('utilities')
                    ||t.includes('loan given')||c.includes('loan given')||t.includes('payment')||c.includes('payment')
                    ||t.includes('cost')||c.includes('cost');
            }

            _lastIncArr = filtered.filter(isIncome);
            _lastExpArr = filtered.filter(isExpense);

            var iBody = document.getElementById('ana_incomeRows');
            if (iBody) iBody.innerHTML = renderTablePage(_lastIncArr, '#00e676', '#1b5e2040', incP);
            injectPaginationBar('ana_incomeRows', 'ana_income_pg_bar', _lastIncArr, incP, function(pg) {
                _incPage = pg; rebuildWithPagination(_incPage, _expPage);
            });

            var eBody = document.getElementById('ana_expenseRows');
            if (eBody) eBody.innerHTML = renderTablePage(_lastExpArr, '#ff5252', '#7f000040', expP);
            injectPaginationBar('ana_expenseRows', 'ana_expense_pg_bar', _lastExpArr, expP, function(pg) {
                _expPage = pg; rebuildWithPagination(_incPage, _expPage);
            });

        } catch(err) { console.error('[AnalyticsPagination] rebuild error:', err); }
    }

    // ✅ FIX: Expose to window so inline onclick handlers can call it
    window.rebuildWithPagination = rebuildWithPagination;

    function waitAndPatch() {
        if (typeof window._anaRefreshTables !== 'function') { setTimeout(waitAndPatch, 200); return; }
        var _orig = window._anaRefreshTables;
        window._anaRefreshTables = function() {
            _orig.apply(this, arguments);
            setTimeout(function() { rebuildWithPagination(_incPage, _expPage); }, 20);
        };
        var origSetMode = window._anaSetMode;
        if (origSetMode && !origSetMode._pgPatched) {
            window._anaSetMode = function(m) { _incPage = 1; _expPage = 1; origSetMode.apply(this, arguments); };
            window._anaSetMode._pgPatched = true;
        }
        console.log('✅ [AnalyticsPagination] patched — Date is 1st column');
    }

    document.addEventListener('show.bs.modal', function(e) {
        if (e.target && e.target.id === 'accountAnalyticsModal') { _incPage = 1; _expPage = 1; }
    });

    waitAndPatch();
})();
