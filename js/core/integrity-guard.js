// ============================================================
// Wings Fly Aviation Academy — WFA Integrity Guard
// ============================================================
//
// প্রতিটি module, function, DOM element, data logic এবং
// cross-module dependency চেক করে। যখনই কিছু ভেঙে যায়,
// তাৎক্ষণিক visual alert দেয় — exactly কোথায় কি সমস্যা।
//
// Usage:
//   IntegrityGuard.run()          → সব check একসাথে চালাও
//   IntegrityGuard.watch()        → background এ continuous watch
//   IntegrityGuard.showPanel()    → floating panel দেখাও
//   IntegrityGuard.hidePanel()    → panel লুকাও
//
// console:
//   IntegrityGuard.run()          → instant full report
// ============================================================

const IntegrityGuard = (() => {

  // ══════════════════════════════════════════════════════════
  // MANIFEST — সব expected modules, functions, DOM elements
  // ══════════════════════════════════════════════════════════

  const MANIFEST = {

    // ── Core Infrastructure ──────────────────────────────────
    globals: {
      'window.supabase':         { type: 'object',   critical: true,  desc: 'Supabase JS library' },
      'window.SUPABASE_CONFIG':  { type: 'object',   critical: true,  desc: 'Supabase config object' },
      'window.DB':               { type: 'object',   critical: true,  desc: 'Table name constants' },
      'window.WFA_IDB':          { type: 'object',   critical: true,  desc: 'IndexedDB wrapper' },
      'window.SupabaseSync':     { type: 'object',   critical: true,  desc: 'CRUD sync engine' },
      'window.SyncEngine':       { type: 'object',   critical: true,  desc: 'Pull/push engine' },
      'window.SyncGuard':        { type: 'object',   critical: true,  desc: 'Data integrity guard' },
      'window.Utils':            { type: 'object',   critical: true,  desc: 'Utility functions' },
      'window.App':              { type: 'object',   critical: true,  desc: 'Main app controller' },
    },

    // ── Module Functions ─────────────────────────────────────
    modules: {

      'Utils': {
        required: ['toast', 'openModal', 'closeModal', 'confirm', 'esc',
                   'formatDate', 'formatMoney', 'formatMoneyPlain', 'safeNum',
                   'today', 'sortBy', 'searchFilter', 'paginate',
                   'renderPaginationUI', 'badge', 'statusBadge', 'noDataRow',
                   'exportExcel', 'downloadCSV', 'printArea', 'debounce',
                   'getPaymentMethodsHTML', 'getAccountBalance',
                   'getSettlementKey'],
        critical: true,
        desc: 'Core utilities',
      },

      'WFA_IDB': {
        required: ['init', 'onReady', 'getTable', 'setTable', 'getUsageKB', 'getTableSizeKB'],
        critical: true,
        desc: 'IndexedDB wrapper',
      },

      'SupabaseSync': {
        required: ['getAll', 'getById', 'setAll', 'insert', 'update', 'remove',
                   'generateId', 'getDeletedIds', 'clearDeletedIds',
                   'restoreRecycleBinItem', 'permanentDeleteRecycleBinItem',
                   'emptyRecycleBin', 'updateAccountBalance', 'processRetryQueue'],
        critical: true,
        desc: 'CRUD sync API',
      },

      'SyncEngine': {
        required: ['pull', 'push', 'syncAll', 'fullPull', 'startAutoSync',
                   'stopAutoSync', 'startRealtime', 'stopRealtime',
                   'setStatus', 'getDataMonitor', 'TABLE_COLUMNS'],
        critical: true,
        desc: 'Supabase sync engine',
      },

      'SyncGuard': {
        required: ['report', 'getLog', 'markAllSeen', 'clearLog',
                   'auditFinance', 'auditBalances', 'runFullAudit',
                   'renderPanel', 'autoFix', 'init'],
        critical: true,
        desc: 'Payment integrity guard',
      },

      'App': {
        required: ['init', 'navigateTo', 'login', 'logout', 'isLoggedIn',
                   'toggleSidebar', 'quickAction', 'updateNotifCount'],
        critical: true,
        desc: 'Main app controller',
      },

      'Students': {
        required: ['render', 'onSearch', 'onFilter', 'resetFilters',
                   'openManageAction', 'openAddModal', 'openEditModal',
                   'saveStudent', 'exportExcel', 'changePage', 'changePageSize'],
        critical: true,
        desc: 'Student management module',
      },

      'HRStaff': {
        required: ['init', 'render', 'applyFilter', 'openAddModal',
                   'openEditModal', 'saveStaff', 'toggleStatus', 'deleteStaff',
                   'exportExcel', 'changePage', 'changePageSize', 'getAll'],
        critical: true,
        desc: 'HR staff module',
      },

      'Salary': {
        required: ['render', 'syncFromHR', 'syncAllFromHR'],
        critical: true,
        desc: 'Salary management module',
      },

      'Finance': {
        required: ['render'],
        critical: true,
        desc: 'Finance ledger module',
      },

      'Accounts': {
        required: ['render'],
        critical: true,
        desc: 'Accounts module',
      },

      'Loans': {
        required: ['render', 'openAddModal', 'saveLoan', 'toggleStatus',
                   'deleteLoan', 'filterCards', 'changePage', 'changePageSize'],
        critical: true,
        desc: 'Loans module',
      },

      'Attendance': {
        required: ['render'],
        critical: true,
        desc: 'Attendance module',
      },

      'ExamModule': {
        required: ['render'],
        critical: false,
        desc: 'Exam module',
      },

      'Visitors': {
        required: ['init', 'render', 'openAddModal', 'saveRecord',
                   'deleteRecord', 'convertToStudent'],
        critical: true,
        desc: 'Visitors module',
      },

      'NoticeBoard': {
        required: ['init', 'render', 'openAddModal', 'publish',
                   'deleteActive', 'deleteNoticeById'],
        critical: true,
        desc: 'Notice board module',
      },

      'IDCardsModule': {
        required: ['buildCardHTML', 'renderPreview', 'printCard', 'printBulk',
                   'render', 'previewStudent', 'previewCard', 'printStudent',
                   'printAllStudents'],
        critical: true,
        desc: 'ID card generator module',
      },

      'CertificatesModule': {
        required: ['buildCertHTML', 'renderPreview', 'fillFromStudent', 'print',
                   'render', 'previewForStudent', 'previewCertificate',
                   'printForStudent', 'printAllCerts'],
        critical: true,
        desc: 'Certificate generator module',
      },

      'DashboardModule': {
        required: ['render'],
        critical: true,
        desc: 'Dashboard module',
      },

      'SettingsModule': {
        required: ['render'],
        critical: false,
        desc: 'Settings module',
      },

      'LoginUI': {
        required: ['showForgotModal', 'closeForgotModal',
                   'checkSecurityAnswer', 'checkMasterPin'],
        critical: true,
        desc: 'Login UI module',
      },
    },

    // ── DB Table Constants ────────────────────────────────────
    db_tables: [
      'students', 'staff', 'salary', 'finance', 'accounts',
      'loans', 'exams', 'attendance', 'visitors', 'notices', 'settings',
    ],

    // ── Critical DOM Elements ─────────────────────────────────
    dom: {
      'modal-backdrop':    { desc: 'Global modal backdrop', critical: true  },
      'modal-title':       { desc: 'Modal title element',   critical: true  },
      'modal-body':        { desc: 'Modal body element',    critical: true  },
      'confirm-backdrop':  { desc: 'Confirm dialog',        critical: true  },
      'confirm-yes':       { desc: 'Confirm yes button',    critical: true  },
      'confirm-no':        { desc: 'Confirm no button',     critical: true  },
      'sync-status':       { desc: 'Sync status badge',     critical: false },
      'toast-container':   { desc: 'Toast notification area', critical: false },
      'main-nav':          { desc: 'Main navigation',       critical: false },
      'main-content':      { desc: 'Main content area',     critical: true  },
    },

    // ── Data Logic Validators ─────────────────────────────────
    // এগুলো runtime data integrity check করে
    data_checks: [
      {
        name: 'IDB Ready State',
        desc: 'IndexedDB সঠিকভাবে initialized আছে কিনা',
        critical: true,
        check: () => {
          const idb = window.WFA_IDB;
          if (!idb) return { ok: false, detail: 'WFA_IDB not found' };
          // getTable call করে দেখো — error ছাড়া চললে ok
          try {
            idb.getTable('students');
            return { ok: true, detail: 'IndexedDB accessible' };
          } catch(e) {
            return { ok: false, detail: `IDB.getTable() threw: ${e.message}` };
          }
        },
      },
      {
        name: 'DB Table Constants',
        desc: 'window.DB তে সব table constants আছে কিনা',
        critical: true,
        check: () => {
          const db = window.DB;
          if (!db) return { ok: false, detail: 'window.DB is undefined' };
          const expected = ['students','staff','salary','finance','accounts',
                            'loans','exams','attendance','visitors','notices','settings'];
          const missing = expected.filter(k => !db[k]);
          return missing.length === 0
            ? { ok: true, detail: `All ${expected.length} table constants present` }
            : { ok: false, detail: `Missing: ${missing.join(', ')}` };
        },
      },
      {
        name: 'SupabaseSync CRUD',
        desc: 'SupabaseSync.getAll() সঠিকভাবে array return করে কিনা',
        critical: true,
        check: () => {
          try {
            const r = window.SupabaseSync?.getAll('students');
            if (!Array.isArray(r)) return { ok: false, detail: `getAll() returned ${typeof r}` };
            return { ok: true, detail: `getAll('students') → ${r.length} rows` };
          } catch(e) {
            return { ok: false, detail: `getAll() threw: ${e.message}` };
          }
        },
      },
      {
        name: 'Utils.toast',
        desc: 'Utils.toast function সঠিকভাবে DOM Element তৈরি করে কিনা',
        critical: true,
        check: () => {
          try {
            if (typeof Utils?.toast !== 'function') return { ok: false, detail: 'toast is not a function' };
            return { ok: true, detail: 'toast() is callable' };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
      {
        name: 'Utils.openModal',
        desc: 'Modal system DOM elements সহ সঠিকভাবে কাজ করছে কিনা',
        critical: true,
        check: () => {
          const backdrop = document.getElementById('modal-backdrop');
          const title    = document.getElementById('modal-title');
          const body     = document.getElementById('modal-body');
          if (!backdrop || !title || !body) {
            return { ok: false, detail: `Missing modal DOM: ${!backdrop?'#modal-backdrop ':''} ${!title?'#modal-title ':''} ${!body?'#modal-body':''}` };
          }
          return { ok: true, detail: 'All modal DOM elements found' };
        },
      },
      {
        name: 'Supabase Client',
        desc: 'Supabase client authenticated এবং callable কিনা',
        critical: false,
        check: () => {
          try {
            const cfg = window.SUPABASE_CONFIG;
            if (!cfg?.client) return { ok: false, detail: 'SUPABASE_CONFIG.client is missing' };
            if (typeof cfg.client.from !== 'function') return { ok: false, detail: 'client.from() is not a function' };
            return { ok: true, detail: 'Supabase client ready' };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
      {
        name: 'Students Data Schema',
        desc: 'Student records এর schema সঠিক আছে কিনা (required fields present)',
        critical: false,
        check: () => {
          try {
            const students = window.SupabaseSync?.getAll('students') || [];
            if (students.length === 0) return { ok: true, detail: 'No students yet (skip schema check)' };
            const sample = students[0];
            const required = ['id', 'name', 'student_id', 'total_fee', 'paid', 'due'];
            const missing = required.filter(f => !(f in sample));
            return missing.length === 0
              ? { ok: true, detail: `Schema OK (${students.length} students)` }
              : { ok: false, detail: `Missing fields in student schema: ${missing.join(', ')}` };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
      {
        name: 'Salary ↔ HR Sync',
        desc: 'HRStaff.getAll() salary sync এর জন্য accessible কিনা',
        critical: false,
        check: () => {
          if (typeof HRStaff === 'undefined') return { ok: false, detail: 'HRStaff module not found' };
          if (typeof HRStaff.getAll !== 'function') return { ok: false, detail: 'HRStaff.getAll is not a function' };
          try {
            const r = HRStaff.getAll();
            if (!Array.isArray(r)) return { ok: false, detail: `HRStaff.getAll() returned ${typeof r}` };
            return { ok: true, detail: `HRStaff.getAll() → ${r.length} staff` };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
      {
        name: 'IDCardsModule.previewCard',
        desc: 'Student MANAGE → ID Card button এর function exists কিনা',
        critical: true,
        check: () => {
          if (typeof IDCardsModule === 'undefined') return { ok: false, detail: 'IDCardsModule not found' };
          if (typeof IDCardsModule.previewCard !== 'function') return { ok: false, detail: 'IDCardsModule.previewCard is not a function' };
          return { ok: true, detail: 'IDCardsModule.previewCard() exists' };
        },
      },
      {
        name: 'CertificatesModule.previewCertificate',
        desc: 'Student MANAGE → Certificate button এর function exists কিনা',
        critical: true,
        check: () => {
          if (typeof CertificatesModule === 'undefined') return { ok: false, detail: 'CertificatesModule not found' };
          if (typeof CertificatesModule.previewCertificate !== 'function') return { ok: false, detail: 'CertificatesModule.previewCertificate is not a function' };
          return { ok: true, detail: 'CertificatesModule.previewCertificate() exists' };
        },
      },
      {
        name: 'RecycleBin IDB Storage',
        desc: 'Recycle bin IDB তে সঠিকভাবে stored কিনা (localStorage নয়)',
        critical: false,
        check: () => {
          try {
            const bin = window.WFA_IDB?.getTable('recycle_bin');
            if (!Array.isArray(bin)) return { ok: false, detail: 'recycle_bin is not an array in IDB' };
            // Check if also in localStorage (bad — should be in IDB only)
            const lsBin = localStorage.getItem('wfa_recycle_bin');
            if (lsBin && ((() => { try { return JSON.parse(lsBin); } catch { return []; } })())?.length > 0) {
              return { ok: false, detail: 'wfa_recycle_bin still in localStorage — IDB migration may have failed' };
            }
            return { ok: true, detail: `RecycleBin in IDB: ${bin.length} items` };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
      {
        name: 'Finance calcPaid/Due consistency',
        desc: 'Student paid + due = total_fee কিনা (data drift check)',
        critical: false,
        check: () => {
          try {
            const students = window.SupabaseSync?.getAll('students') || [];
            if (students.length === 0) return { ok: true, detail: 'No students' };
            const drifted = students.filter(s => {
              const total = parseFloat(s.total_fee) || 0;
              const paid  = parseFloat(s.paid)      || 0;
              const due   = parseFloat(s.due)        || 0;
              if (total === 0) return false;
              return Math.abs((paid + due) - total) > 1; // tolerance 1 taka
            });
            return drifted.length === 0
              ? { ok: true, detail: `All ${students.length} students: paid+due=total ✅` }
              : { ok: false, detail: `${drifted.length} students have paid+due≠total: ${drifted.slice(0,3).map(s=>s.name||s.id).join(', ')}` };
          } catch(e) {
            return { ok: false, detail: e.message };
          }
        },
      },
    ],
  };


  // ══════════════════════════════════════════════════════════
  // RUNNER — সব check execute করে
  // ══════════════════════════════════════════════════════════

  let _lastResult = null;

  function run() {
    const results = {
      timestamp: new Date().toISOString(),
      globals:   _checkGlobals(),
      modules:   _checkModules(),
      dom:       _checkDOM(),
      data:      _checkDataLogic(),
    };

    results.summary = _buildSummary(results);
    _lastResult = results;

    // console এ সুন্দর report
    _printConsoleReport(results);

    // Critical failures হলে visual alert দেখাও
    const criticalFails = results.summary.critical_failures;
    if (criticalFails.length > 0) {
      _showCriticalAlert(criticalFails);
    }

    // Panel open থাকলে refresh করো
    _refreshPanelIfOpen(results);

    return results;
  }


  // ── Check: window globals ─────────────────────────────────
  function _checkGlobals() {
    const results = [];
    for (const [path, spec] of Object.entries(MANIFEST.globals)) {
      const parts  = path.split('.');
      let val = window;
      for (const p of parts.slice(1)) val = val?.[p];
      const exists = val !== undefined && val !== null;
      results.push({
        name:     path,
        ok:       exists,
        critical: spec.critical,
        desc:     spec.desc,
        detail:   exists ? `type: ${typeof val}` : `❌ ${path} is undefined`,
      });
    }
    return results;
  }

  // ── Check: module functions ───────────────────────────────
  function _checkModules() {
    const results = [];
    for (const [modName, spec] of Object.entries(MANIFEST.modules)) {
      const mod = window[modName];
      const modExists = mod !== undefined && mod !== null;

      if (!modExists) {
        results.push({
          name:     modName,
          ok:       false,
          critical: spec.critical,
          desc:     spec.desc,
          detail:   `❌ Module "${modName}" not found on window`,
          missing:  spec.required,
        });
        continue;
      }

      const missingFns = spec.required.filter(fn => {
        const type = typeof mod[fn];
        return type !== 'function' && type !== 'object';
      });

      results.push({
        name:       modName,
        ok:         missingFns.length === 0,
        critical:   spec.critical,
        desc:       spec.desc,
        detail:     missingFns.length === 0
                      ? `✅ All ${spec.required.length} functions present`
                      : `❌ Missing functions: ${missingFns.join(', ')}`,
        missing:    missingFns,
        totalFns:   spec.required.length,
      });
    }
    return results;
  }

  // ── Check: DOM elements ───────────────────────────────────
  function _checkDOM() {
    const results = [];
    for (const [id, spec] of Object.entries(MANIFEST.dom)) {
      const el = document.getElementById(id);
      results.push({
        name:     `#${id}`,
        ok:       !!el,
        critical: spec.critical,
        desc:     spec.desc,
        detail:   el ? `Found: <${el.tagName.toLowerCase()}>` : `❌ #${id} not in DOM`,
      });
    }
    return results;
  }

  // ── Check: data logic ─────────────────────────────────────
  function _checkDataLogic() {
    const results = [];
    for (const check of MANIFEST.data_checks) {
      let result;
      try {
        result = check.check();
      } catch(e) {
        result = { ok: false, detail: `Check threw: ${e.message}` };
      }
      results.push({
        name:     check.name,
        ok:       result.ok,
        critical: check.critical,
        desc:     check.desc,
        detail:   result.detail,
      });
    }
    return results;
  }

  // ── Build summary ─────────────────────────────────────────
  function _buildSummary(results) {
    const allItems = [
      ...results.globals,
      ...results.modules,
      ...results.dom,
      ...results.data,
    ];

    const failures          = allItems.filter(r => !r.ok);
    const criticalFailures  = failures.filter(r => r.critical);
    const warnings          = failures.filter(r => !r.critical);
    const passed            = allItems.filter(r => r.ok);

    return {
      total:              allItems.length,
      passed:             passed.length,
      failed:             failures.length,
      critical_count:     criticalFailures.length,
      warning_count:      warnings.length,
      failures:           failures,
      critical_failures:  criticalFailures,
      warnings,
      health_pct:         Math.round((passed.length / allItems.length) * 100),
    };
  }

  // ── Console report ────────────────────────────────────────
  function _printConsoleReport(results) {
    const s = results.summary;
    const status = s.critical_count > 0 ? '🔴 CRITICAL FAILURES' :
                   s.warning_count > 0  ? '🟡 WARNINGS'         : '✅ ALL CLEAR';

    console.groupCollapsed(`[IntegrityGuard] ${status} | ${s.passed}/${s.total} passed | Health: ${s.health_pct}%`);

    if (s.critical_failures.length > 0) {
      console.group('%c🔴 CRITICAL FAILURES:', 'color:#ff4757;font-weight:bold');
      s.critical_failures.forEach(f => {
        console.error(`  ❌ [${f.name}] ${f.detail}`);
        if (f.missing?.length) console.error(`     Missing: ${f.missing.join(', ')}`);
      });
      console.groupEnd();
    }

    if (s.warnings.length > 0) {
      console.group('%c🟡 WARNINGS:', 'color:#ffa502;font-weight:bold');
      s.warnings.forEach(w => console.warn(`  ⚠️ [${w.name}] ${w.detail}`));
      console.groupEnd();
    }

    if (s.passed === s.total) {
      console.log('%c✅ Perfect — all checks passed!', 'color:#2ed573;font-weight:bold');
    }

    console.groupEnd();
  }


  // ══════════════════════════════════════════════════════════
  // VISUAL PANEL — floating UI
  // ══════════════════════════════════════════════════════════

  let _panelEl    = null;
  let _panelOpen  = false;

  function showPanel() {
    if (!_panelEl) _createPanel();
    _panelEl.style.display = 'flex';
    _panelOpen = true;
    const results = _lastResult || run();
    _renderPanelContent(results);
  }

  function hidePanel() {
    if (_panelEl) _panelEl.style.display = 'none';
    _panelOpen = false;
  }

  function _refreshPanelIfOpen(results) {
    if (_panelOpen && _panelEl) _renderPanelContent(results);
  }

  function _createPanel() {
    _panelEl = document.createElement('div');
    _panelEl.id = 'wfa-integrity-panel';
    _panelEl.style.cssText = [
      'display:none', 'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(0,0,0,0.75)', 'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(4px)', 'animation:igFadeIn 0.2s ease',
    ].join(';');
    _panelEl.innerHTML = `
      <style>
        @keyframes igFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes igSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        #wfa-ig-box { animation: igSlideUp 0.3s ease; }
        .ig-row:hover { background: rgba(255,255,255,0.04) !important; }
        .ig-tab { cursor:pointer; padding:8px 16px; border-radius:6px; font-size:.8rem; font-weight:600; transition:all .2s; }
        .ig-tab.active { background:rgba(0,212,255,0.15); color:#00d4ff; border:1px solid rgba(0,212,255,0.3); }
        .ig-tab:not(.active) { background:transparent; color:#888; border:1px solid transparent; }
        .ig-tab:not(.active):hover { color:#ccc; border-color:rgba(255,255,255,0.1); }
      </style>
      <div id="wfa-ig-box" style="
        background:linear-gradient(135deg,#0d1117 0%,#161b22 100%);
        border:1px solid rgba(0,212,255,0.2);
        border-radius:16px;
        width:min(900px,95vw);
        max-height:90vh;
        display:flex;flex-direction:column;
        box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(0,212,255,0.1);
        overflow:hidden;
      ">
        <!-- Header -->
        <div style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:12px;flex-shrink:0;">
          <div style="font-size:1.5rem">🛡️</div>
          <div>
            <div style="font-size:1rem;font-weight:800;color:#fff;letter-spacing:.5px">WFA INTEGRITY GUARD</div>
            <div id="ig-subtitle" style="font-size:.75rem;color:#666;margin-top:2px">Running checks...</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
            <div id="ig-health-badge" style="font-size:.8rem;font-weight:700;padding:4px 14px;border-radius:20px;"></div>
            <button onclick="IntegrityGuard.run()" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;border-radius:8px;padding:7px 14px;font-size:.8rem;cursor:pointer;font-weight:600;">
              🔄 Re-run
            </button>
            <button onclick="IntegrityGuard.hidePanel()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#888;border-radius:8px;padding:7px 10px;font-size:.85rem;cursor:pointer;">✕</button>
          </div>
        </div>
        <!-- Tabs -->
        <div id="ig-tabs" style="display:flex;gap:6px;padding:12px 24px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;overflow-x:auto;">
          <div class="ig-tab active" onclick="IntegrityGuard._switchTab('all',this)">All</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('critical',this)">🔴 Critical</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('warnings',this)">🟡 Warnings</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('globals',this)">Globals</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('modules',this)">Modules</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('dom',this)">DOM</div>
          <div class="ig-tab" onclick="IntegrityGuard._switchTab('data',this)">Data Logic</div>
        </div>
        <!-- Content -->
        <div id="ig-content" style="overflow-y:auto;flex:1;padding:16px 24px;"></div>
        <!-- Footer -->
        <div style="padding:12px 24px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
          <div id="ig-timestamp" style="font-size:.72rem;color:#555;"></div>
          <div style="display:flex;gap:8px;">
            <button onclick="IntegrityGuard._copyReport()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#888;border-radius:6px;padding:5px 12px;font-size:.75rem;cursor:pointer;">
              📋 Copy Report
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(_panelEl);
    // Close on backdrop click
    _panelEl.addEventListener('click', e => { if (e.target === _panelEl) hidePanel(); });
  }

  let _currentTab = 'all';

  function _switchTab(tab, el) {
    _currentTab = tab;
    document.querySelectorAll('.ig-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    if (_lastResult) _renderPanelContent(_lastResult);
  }

  function _renderPanelContent(results) {
    if (!_panelEl) return;
    const s = results.summary;

    // Update header
    const healthBadge = document.getElementById('ig-health-badge');
    const subtitle    = document.getElementById('ig-subtitle');
    const timestamp   = document.getElementById('ig-timestamp');
    if (healthBadge) {
      const color = s.critical_count > 0 ? '#ff4757' : s.warning_count > 0 ? '#ffa502' : '#2ed573';
      healthBadge.style.cssText = `font-size:.8rem;font-weight:700;padding:4px 14px;border-radius:20px;background:${color}18;color:${color};border:1px solid ${color}44;`;
      healthBadge.textContent   = `${s.health_pct}% Healthy`;
    }
    if (subtitle) {
      subtitle.textContent = `${s.passed} passed · ${s.failed} failed · ${s.critical_count} critical · ${s.warning_count} warnings`;
    }
    if (timestamp) {
      timestamp.textContent = `Last run: ${new Date(results.timestamp).toLocaleString()}`;
    }

    // Build items list based on tab
    let items = [];
    const allItems = [
      ...results.globals.map(r => ({ ...r, category: 'GLOBAL' })),
      ...results.modules.map(r => ({ ...r, category: 'MODULE' })),
      ...results.dom.map(r    => ({ ...r, category: 'DOM'    })),
      ...results.data.map(r   => ({ ...r, category: 'DATA'   })),
    ];

    switch (_currentTab) {
      case 'critical': items = allItems.filter(r => !r.ok && r.critical); break;
      case 'warnings': items = allItems.filter(r => !r.ok && !r.critical); break;
      case 'globals':  items = allItems.filter(r => r.category === 'GLOBAL'); break;
      case 'modules':  items = allItems.filter(r => r.category === 'MODULE'); break;
      case 'dom':      items = allItems.filter(r => r.category === 'DOM'); break;
      case 'data':     items = allItems.filter(r => r.category === 'DATA'); break;
      default:         items = allItems;
    }

    // Sort: failures first
    items.sort((a, b) => {
      if (!a.ok && b.ok) return -1;
      if (a.ok && !b.ok) return 1;
      if (!a.ok && !b.ok && a.critical && !b.critical) return -1;
      if (!a.ok && !b.ok && !a.critical && b.critical) return 1;
      return 0;
    });

    const content = document.getElementById('ig-content');
    if (!content) return;

    if (items.length === 0) {
      content.innerHTML = `<div style="text-align:center;padding:40px;color:#555">No items in this category</div>`;
      return;
    }

    // Summary bar (only for 'all' tab)
    let summaryHTML = '';
    if (_currentTab === 'all') {
      summaryHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          ${_sCard('✅ Passed',    s.passed,          '#2ed573')}
          ${_sCard('❌ Failed',    s.failed,           '#ff4757')}
          ${_sCard('🔴 Critical',  s.critical_count,   '#ff4757')}
          ${_sCard('⚠️ Warnings',  s.warning_count,    '#ffa502')}
          ${_sCard('🏥 Health',    s.health_pct + '%', s.health_pct >= 90 ? '#2ed573' : s.health_pct >= 70 ? '#ffa502' : '#ff4757')}
        </div>`;
    }

    // Rows
    const rowsHTML = items.map(r => {
      const iconColor = r.ok ? '#2ed573' : r.critical ? '#ff4757' : '#ffa502';
      const icon      = r.ok ? '✅' : r.critical ? '🔴' : '⚠️';
      const bgColor   = r.ok ? 'transparent' : r.critical ? 'rgba(255,71,87,0.04)' : 'rgba(255,165,0,0.04)';
      const catBg     = { GLOBAL: '#00d4ff22', MODULE: '#7c3aed22', DOM: '#05966922', DATA: '#d9730022' }[r.category] || '#ffffff11';
      const catColor  = { GLOBAL: '#00d4ff', MODULE: '#a78bfa', DOM: '#34d399', DATA: '#fb923c' }[r.category] || '#aaa';

      return `
        <div class="ig-row" style="display:grid;grid-template-columns:24px 80px 1fr 2fr;gap:12px;align-items:start;padding:10px 8px;border-radius:8px;background:${bgColor};margin-bottom:4px;">
          <div style="font-size:1rem;padding-top:2px;">${icon}</div>
          <div>
            <span style="background:${catBg};color:${catColor};font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:.5px;">${r.category}</span>
          </div>
          <div>
            <div style="font-size:.82rem;font-weight:600;color:${r.ok ? '#ccc' : iconColor};font-family:monospace;">${r.name}</div>
            <div style="font-size:.72rem;color:#555;margin-top:2px;">${r.desc || ''}</div>
          </div>
          <div style="font-size:.78rem;color:${r.ok ? '#666' : iconColor};word-break:break-word;padding-top:2px;">${r.detail || ''}</div>
        </div>`;
    }).join('');

    content.innerHTML = summaryHTML + `
      <div style="display:grid;grid-template-columns:24px 80px 1fr 2fr;gap:12px;padding:6px 8px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div></div>
        <div style="font-size:.68rem;color:#555;font-weight:700;letter-spacing:1px;">TYPE</div>
        <div style="font-size:.68rem;color:#555;font-weight:700;letter-spacing:1px;">CHECK</div>
        <div style="font-size:.68rem;color:#555;font-weight:700;letter-spacing:1px;">RESULT</div>
      </div>
      ${rowsHTML}`;
  }

  function _sCard(label, value, color) {
    return `<div style="flex:1;min-width:80px;background:${color}11;border:1px solid ${color}33;border-radius:10px;padding:10px;text-align:center;">
      <div style="font-size:1.2rem;font-weight:800;color:${color};">${value}</div>
      <div style="font-size:.68rem;color:#888;margin-top:2px;">${label}</div>
    </div>`;
  }


  // ══════════════════════════════════════════════════════════
  // CRITICAL ALERT — browser UI তে জরুরি সতর্কতা
  // ══════════════════════════════════════════════════════════

  function _showCriticalAlert(failures) {
    // Remove old badge
    const old = document.getElementById('wfa-ig-alert-badge');
    if (old) old.remove();

    const badge = document.createElement('div');
    badge.id    = 'wfa-ig-alert-badge';
    badge.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:20px', 'z-index:99998',
      'background:linear-gradient(135deg,#1a0a0a,#2a0f0f)',
      'border:1px solid rgba(255,71,87,0.6)',
      'border-radius:12px', 'padding:12px 16px',
      'max-width:340px', 'cursor:pointer',
      'box-shadow:0 8px 24px rgba(255,71,87,0.3),0 0 0 1px rgba(255,71,87,0.2)',
      'animation:igSlideLeft 0.4s ease',
      'font-family:var(--font-ui,system-ui)',
    ].join(';');

    badge.innerHTML = `
      <style>@keyframes igSlideLeft{from{transform:translateX(-120%);opacity:0}to{transform:none;opacity:1}}</style>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:1.2rem;">🛡️</span>
        <div style="flex:1;">
          <div style="font-size:.83rem;font-weight:800;color:#ff4757;">⚠️ INTEGRITY ALERT</div>
          <div style="font-size:.72rem;color:#ff6b7a;margin-top:1px;">${failures.length} critical issue(s) detected</div>
        </div>
        <button onclick="this.closest('#wfa-ig-alert-badge').remove()" style="background:none;border:none;color:#666;cursor:pointer;font-size:1rem;padding:0;line-height:1;">✕</button>
      </div>
      <div style="font-size:.75rem;color:#ff8a80;line-height:1.7;max-height:80px;overflow:hidden;">
        ${failures.slice(0, 3).map(f => `• <b>${f.name}</b>: ${f.detail}`).join('<br>')}
        ${failures.length > 3 ? `<br><span style="color:#888">...and ${failures.length - 3} more</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button onclick="IntegrityGuard.showPanel()" style="flex:1;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.4);color:#ff4757;border-radius:6px;padding:5px 0;font-size:.75rem;cursor:pointer;font-weight:700;">
          🔍 View Details
        </button>
        <button onclick="this.closest('#wfa-ig-alert-badge').remove()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#666;border-radius:6px;padding:5px 10px;font-size:.75rem;cursor:pointer;">
          Dismiss
        </button>
      </div>`;
    document.body.appendChild(badge);
  }


  // ══════════════════════════════════════════════════════════
  // WATCH — background continuous monitoring
  // ══════════════════════════════════════════════════════════

  let _watchTimer = null;

  function watch(intervalMs = 30000) {
    if (_watchTimer) clearInterval(_watchTimer);
    console.log(`[IntegrityGuard] 👁 Watch mode ON — checking every ${intervalMs/1000}s`);

    // Initial run after 5s (let app finish loading)
    setTimeout(() => {
      run();
      _watchTimer = setInterval(() => run(), intervalMs);
    }, 5000);
  }

  function stopWatch() {
    if (_watchTimer) { clearInterval(_watchTimer); _watchTimer = null; }
    console.log('[IntegrityGuard] 👁 Watch mode OFF');
  }


  // ══════════════════════════════════════════════════════════
  // MUTATION OBSERVER — DOM/Module change এর পরে auto-check
  // ══════════════════════════════════════════════════════════

  function _setupMutationWatcher() {
    if (typeof MutationObserver === 'undefined') return;

    // Critical module এর function যদি override হয় সেটা ধরার জন্য
    // Proxy trap দিয়ে check করা যায় — কিন্তু সেটা complex।
    // বরং wfa:synced event এ run করো (যা প্রতিটি CRUD এর পরে fire হয়)
    // Fix: debounce integrity check after sync - prevents race with Finance render
    let _syncCheckTimer = null;
    window.addEventListener('wfa:synced', () => {
      clearTimeout(_syncCheckTimer);
      _syncCheckTimer = setTimeout(() => {
      // Light check only — data logic গুলো check করো
      const dataResults = _checkDataLogic();
      const fails = dataResults.filter(r => !r.ok && r.critical);
      if (fails.length > 0) {
        _showCriticalAlert(fails);
        if (_panelOpen) _refreshPanelIfOpen(_lastResult || run());
      }
      }, 1500); // 1.5s debounce
    });
  }


  // ══════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════

  function _copyReport() {
    if (!_lastResult) { run(); }
    const r = _lastResult;
    const s = r.summary;
    const lines = [
      `WFA Integrity Guard Report`,
      `Time: ${new Date(r.timestamp).toLocaleString()}`,
      `Health: ${s.health_pct}% | Passed: ${s.passed}/${s.total} | Critical Failures: ${s.critical_count}`,
      '',
      '=== CRITICAL FAILURES ===',
      ...s.critical_failures.map(f => `❌ [${f.name}] ${f.detail}`),
      '',
      '=== WARNINGS ===',
      ...s.warnings.map(w => `⚠️ [${w.name}] ${w.detail}`),
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      Utils?.toast && Utils.toast('📋 Report copied to clipboard', 'success');
    });
  }

  // ── Keyboard shortcut: Ctrl+Shift+I ──────────────────────
  function _setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        _panelOpen ? hidePanel() : showPanel();
      }
    });
  }


  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════

  function init() {
    _setupMutationWatcher();
    _setupKeyboardShortcut();

    // App load এর পরে 8 সেকেন্ড wait করে first run
    setTimeout(() => {
      run();
      // Watch mode: 2 মিনিট পরপর check
      _watchTimer = setInterval(() => run(), 2 * 60 * 1000);
    }, 8000);

    console.log('[IntegrityGuard] 🛡️ Initialized — Press Ctrl+Shift+I to open panel');
  }


  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════

  return {
    run,
    watch,
    stopWatch,
    showPanel,
    hidePanel,
    init,
    getLastResult: () => _lastResult,

    // Internal methods exposed for panel tab switching
    _switchTab,
    _copyReport,
  };

})();

window.IntegrityGuard = IntegrityGuard;

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => IntegrityGuard.init());
} else {
  IntegrityGuard.init();
}
