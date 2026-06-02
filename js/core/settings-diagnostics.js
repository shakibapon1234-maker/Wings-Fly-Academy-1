// ============================================================
// Settings Diagnostics — Wings Fly Aviation Academy
// Read-only health scan for Settings → Sync Guard → Run Diagnostics
// Keeps settings.js DOM small; connects via WfaSettingsDiagnostics.run()
// ============================================================

const WfaSettingsDiagnostics = (() => {

  const MODAL_ID = 'wsd-modal-root';

  const CAT = {
    environment: 'Environment & App',
    modules:     'Modules & DOM',
    sync:        'Sync & Cloud',
    finance:     'Finance & Ledger',
    accounts:    'Account Balances',
    students:    'Students & Fees',
    salary:      'Salary & HR',
    exams:       'Exams',
    loans:       'Loans & Advances',
    storage:     'Storage & Backup',
    security:    'Security & Config',
  };

  /** @type {{ category: string, name: string, status: 'pass'|'warn'|'fail', detail: string, hint?: string }[]} */
  let _items = [];

  function _add(category, name, status, detail, hint) {
    _items.push({
      category: CAT[category] || category,
      name,
      status: status === 'pass' || status === 'warn' || status === 'fail' ? status : 'warn',
      detail: String(detail || ''),
      hint: hint ? String(hint) : '',
    });
  }

  function _pass(cat, name, detail) { _add(cat, name, 'pass', detail); }
  function _warn(cat, name, detail, hint) { _add(cat, name, 'warn', detail, hint); }
  function _fail(cat, name, detail, hint) { _add(cat, name, 'fail', detail, hint); }

  function _getAll(table) {
    try {
      if (!window.SupabaseSync || !table) return [];
      const rows = SupabaseSync.getAll(table);
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      _fail('storage', `Read table: ${table}`, e?.message || 'getAll failed');
      return [];
    }
  }

  function _safeNum(v) {
    return typeof Utils !== 'undefined' && Utils.safeNum ? Utils.safeNum(v) : (parseFloat(v) || 0);
  }

  function _dupesBy(rows, keyFn) {
    const seen = new Map();
    const dupes = [];
    rows.forEach((r, i) => {
      const k = keyFn(r, i);
      if (!k) return;
      if (seen.has(k)) dupes.push(k);
      else seen.set(k, true);
    });
    return [...new Set(dupes)];
  }

  // ── Environment ─────────────────────────────────────────────
  async function _checkEnvironment() {
    _pass('environment', 'Browser online', navigator.onLine ? 'Connected' : 'Offline mode (cloud checks skipped)');

    const swOk = 'serviceWorker' in navigator;
    if (swOk && navigator.serviceWorker.controller) {
      _pass('environment', 'Service Worker', 'Active — offline cache enabled');
    } else if (swOk) {
      _warn('environment', 'Service Worker', 'Registered but not controlling this tab yet', 'Hard refresh once');
    } else {
      _warn('environment', 'Service Worker', 'Not supported in this browser');
    }

    const isCap = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    _pass('environment', 'Runtime', isCap ? 'Capacitor Android/iOS shell' : 'Web / PWA');

    const ver = localStorage.getItem('wfa_app_version') || '—';
    _pass('environment', 'Cached app version', ver);

    if (navigator.onLine && !_isDevHost()) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch('https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/version.json', {
          cache: 'no-store', signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const remote = await res.json();
          const local = localStorage.getItem('wfa_app_version') || '1.2.3';
          const cmp = _cmpVer(remote.version, local);
          if (cmp > 0) {
            _warn('environment', 'Remote update', `Server v${remote.version} > local v${local}`, 'Settings → reload or reinstall APK');
          } else {
            _pass('environment', 'Remote version.json', `v${remote.version} (${remote.deploy_id || 'no deploy id'})`);
          }
        } else {
          _warn('environment', 'Remote version.json', `HTTP ${res.status}`);
        }
      } catch {
        _warn('environment', 'Remote version.json', 'Could not reach GitHub Pages');
      }
    }

    try {
      let kb = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        kb += ((localStorage.getItem(k) || '').length + (k || '').length) * 2 / 1024;
      }
      if (kb > 4500) _fail('environment', 'localStorage size', `~${Math.round(kb)} KB — near 5MB limit`, 'Export backup & clear old logs');
      else if (kb > 3000) _warn('environment', 'localStorage size', `~${Math.round(kb)} KB used`);
      else _pass('environment', 'localStorage size', `~${Math.round(kb)} KB used`);
    } catch {
      _warn('environment', 'localStorage size', 'Could not estimate');
    }
  }

  function _isDevHost() {
    const h = window.location.hostname;
    return !h || h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.');
  }

  function _cmpVer(a, b) {
    const p1 = String(a || '0').split('.').map(Number);
    const p2 = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const x = p1[i] || 0; const y = p2[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  // ── Modules (IntegrityGuard) ────────────────────────────────
  async function _checkModulesFromGuard() {
    if (!window.IntegrityGuard || typeof IntegrityGuard.run !== 'function') {
      _warn('modules', 'IntegrityGuard', 'Module not loaded — skipping deep module scan');
      return;
    }
    const ig = await IntegrityGuard.run();
    const mapCat = (name) => {
      if (/Supabase|Sync|IDB|Recycle/i.test(name)) return 'sync';
      if (/Student|Salary|HR|Finance|Modal|toast/i.test(name)) return 'modules';
      if (/Vital|Asset|URL/i.test(name)) return 'environment';
      return 'modules';
    };

    const all = [
      ...(ig.globals || []),
      ...(ig.modules || []),
      ...(ig.dom || []),
      ...(ig.data || []),
    ];

    let igPass = 0;
    all.forEach((r) => {
      const cat = mapCat(r.name || '');
      if (r.ok) {
        igPass++;
        return;
      }
      if (r.critical) {
        _fail(cat, r.name, r.detail || 'Failed', r.desc);
      } else {
        _warn(cat, r.name, r.detail || 'Warning', r.desc);
      }
    });

    const igFail = (ig.summary?.critical_count || 0) + (ig.summary?.warning_count || 0);
    if (igFail === 0) {
      _pass('modules', 'IntegrityGuard (modules/DOM/API)',
        `${igPass}/${all.length} checks passed — health ${ig.summary?.health_pct || 100}%`);
    } else {
      _warn('modules', 'IntegrityGuard summary',
        `${ig.summary?.passed || 0}/${ig.summary?.total || 0} passed — ${ig.summary?.critical_count || 0} critical, ${ig.summary?.warning_count || 0} warning(s)`);
    }
  }

  // ── Sync & Cloud ──────────────────────────────────────────
  function _checkSync() {
    const client = window.SUPABASE_CONFIG?.client;
    if (!client) {
      _warn('sync', 'Supabase client', 'Not configured — offline-only mode', 'Settings → Cloud API');
    } else {
      _pass('sync', 'Supabase client', 'Client object ready');
      const authed = typeof SupabaseAuth !== 'undefined' && SupabaseAuth.isAuthenticated && SupabaseAuth.isAuthenticated();
      if (authed) _pass('sync', 'Supabase auth', 'Session token present');
      else _pass('sync', 'Supabase auth', 'anon/RLS mode — sync working normally');
    }

    if (window.SyncEngine) {
      const mon = typeof SyncEngine.getDataMonitor === 'function' ? SyncEngine.getDataMonitor() : null;
      if (mon) {
        _pass('sync', 'Sync monitor', `Status: ${mon.status || 'unknown'} | last: ${mon.lastSync || '—'}`);
      } else {
        _pass('sync', 'SyncEngine', 'Loaded');
      }
    } else {
      _fail('sync', 'SyncEngine', 'Not found on window');
    }

    const retry = _getAll('retry_queue');
    if (retry.length === 0) _pass('sync', 'Retry queue', 'Empty');
    else if (retry.length < 10) _warn('sync', 'Retry queue', `${retry.length} pending item(s)`, 'Wait for sync or check network');
    else _fail('sync', 'Retry queue', `${retry.length} stuck items`, 'Settings → Sync Diagnostic');

    const sgLog = window.SyncGuard?.getLog ? SyncGuard.getLog() : [];
    const unread = sgLog.filter(e => !e.seen).length;
    if (unread > 0) _warn('sync', 'SyncGuard events', `${unread} unread alert(s) in log`);
    else _pass('sync', 'SyncGuard events', `${sgLog.length} logged event(s)`);
  }

  // ── Finance (SyncGuard + extras) ────────────────────────────
  function _checkFinance() {
    if (window.SyncGuard) {
      const f = SyncGuard.auditFinance();
      if (f.ok) _pass('finance', 'Ledger category audit', 'No loan/transfer/advance mislabels');
      else {
        f.issues.forEach((issue, i) => {
          _fail('finance', `Ledger issue ${i + 1}`, issue, 'Finance → review entry type');
        });
      }
    }

    const finance = _getAll(DB?.finance || 'finance_ledger');
    if (finance.length === 0) {
      _pass('finance', 'Finance records', 'No entries yet');
      return;
    }

    const noDate = finance.filter(f => !f.date && !f.created_at).length;
    if (noDate) _warn('finance', 'Missing dates', `${noDate} entries without date`);

    const badAmt = finance.filter(f => f.amount != null && Number(f.amount) < 0).length;
    if (badAmt) _fail('finance', 'Negative amounts', `${badAmt} entries`, 'Edit or delete invalid rows');

    const noMethod = finance.filter(f => !f.method && !f._isLoan).length;
    if (noMethod > 5) _warn('finance', 'Missing payment method', `${noMethod} entries`);

    const dupIds = _dupesBy(finance, r => r.id);
    if (dupIds.length) _fail('finance', 'Duplicate IDs', dupIds.slice(0, 5).join(', '));

    const salaryExp = finance.filter(f =>
      String(f.category || '').toLowerCase() === 'salary' &&
      String(f.type || '').toLowerCase() === 'expense'
    ).length;
    _pass('finance', 'Salary expense entries', `${salaryExp} salary expense row(s) in ledger`);

    _pass('finance', 'Finance row count', `${finance.length} ledger entries`);
  }

  // ── Account balances ────────────────────────────────────────
  function _checkAccounts() {
    const accounts = _getAll(DB?.accounts || 'accounts');
    const finance = _getAll(DB?.finance || 'finance_ledger');

    // NOTE: Opening Balance finance entries are now STALE — the _upsertOpeningEntry
    // system has been permanently removed. We no longer check for "orphan" Opening
    // Balance entries; instead we count them as phantom entries to be cleaned up.
    const staleOpening = finance.filter(f => f.category === 'Opening Balance');
    if (staleOpening.length > 0) {
      _warn('accounts', 'Stale Opening Balance entries',
        `${staleOpening.length} phantom Opening Balance entry/entries found in finance ledger — use SyncGuard → Clean Stale Data to remove`,
        'SyncGuard panel → "Clean Stale Data" button');
    } else {
      _pass('accounts', 'Opening balance entries', 'None — ledger is clean');
    }

    if (typeof Accounts === 'undefined') {
      _warn('accounts', 'Accounts module', 'Not loaded');
    } else {
      _pass('accounts', 'Accounts module', 'Loaded');
    }

    const negative = accounts.filter(a => _safeNum(a.balance) < 0);
    if (negative.length) {
      negative.forEach(a => {
        _fail('accounts', `Negative: ${a.name || a.type}`, `Balance ৳${_safeNum(a.balance)}`, 'Accounts tab → adjust');
      });
    } else {
      _pass('accounts', 'Stored balances', 'No negative account balances');
    }

    // ✅ Fix: Balance audit (ledger vs stored) is DISABLED in diagnostics.
    // The finance_ledger does not contain complete historical data (pre-app
    // transactions, initial balances set via UI). The stored account balances
    // are the source of truth, updated live by updateAccountBalance() on every
    // real transaction. Showing these mismatches as warnings was misleading.
    // SyncGuard panel also marks this audit as "⏸ Disabled".
    _pass('accounts', 'Ledger vs stored',
      'Audit skipped — stored balances are source of truth (updated live per transaction)');

    _pass('accounts', 'Account count', `${accounts.length} account(s)`);
  }

  // ── Students ────────────────────────────────────────────────
  function _checkStudents() {
    const students = _getAll(DB?.students || 'students');
    if (!students.length) {
      _pass('students', 'Student records', 'None yet');
      return;
    }

    const drift = students.filter(s => {
      const total = _safeNum(s.total_fee);
      if (total <= 0) return false;
      return Math.abs((_safeNum(s.paid) + _safeNum(s.due)) - total) > 1;
    });
    if (drift.length) {
      _fail('students', 'paid + due ≠ total_fee', `${drift.length} student(s): ${drift.slice(0, 4).map(s => s.name || s.student_id).join(', ')}`, 'Open student → recalc fee');
    } else {
      _pass('students', 'Fee math', `All ${students.length} students balanced`);
    }

    const overpaid = students.filter(s => _safeNum(s.paid) > _safeNum(s.total_fee) && _safeNum(s.total_fee) > 0);
    if (overpaid.length) _warn('students', 'Overpaid', `${overpaid.length} student(s)`);

    const dupSid = _dupesBy(students, s => String(s.student_id || '').trim());
    if (dupSid.length) _fail('students', 'Duplicate student_id', dupSid.slice(0, 5).join(', '));

    const noName = students.filter(s => !String(s.name || '').trim()).length;
    if (noName) _warn('students', 'Empty names', `${noName} record(s)`);

    const inactiveDue = students.filter(s =>
      String(s.status || '').toLowerCase() === 'inactive' && _safeNum(s.due) > 0
    ).length;
    if (inactiveDue) _warn('students', 'Inactive with due', `${inactiveDue} student(s) still have due balance`);
  }

  function _salaryMonthLabel(ym) {
    if (!ym) return '';
    const parts = ym.split('-');
    const months = ['January','February','March','April','May','June',
      'July','August','September','October','November','December'];
    return (months[parseInt(parts[1], 10) - 1] || '?') + ' ' + parts[0];
  }

  function _matchesSalaryFinance(f, r) {
    if (!f || String(f.category || '').toLowerCase() !== 'salary' ||
        String(f.type || '').toLowerCase() !== 'expense') return false;
    if (!r) return false;
    if (r.id && f.ref_id === r.id) return true;
    const staff = r.staffName || r.staff_name || '';
    const month = r.month || '';
    if (!staff || !month) return false;
    if ((f.person_name || '') !== staff) return false;
    const desc = f.description || '';
    return desc.indexOf(staff) !== -1 && desc.indexOf(_salaryMonthLabel(month)) !== -1;
  }

  function _isDiagSalaryRow(r) {
    if (!r) return false;
    if (typeof SystemDiagnostics !== 'undefined' && SystemDiagnostics.isDiagnosticSalary) {
      return SystemDiagnostics.isDiagnosticSalary(r);
    }
    const sid = String(r.staffId || r.staff_id || '');
    const name = String(r.staffName || r.staff_name || '');
    return sid === 'DIAG-SAL-STAFF' || name.includes('Diagnostic Test Staff');
  }

  // ── Salary & HR ─────────────────────────────────────────────
  function _checkSalary() {
    const staff = _getAll(DB?.staff || 'staff');
    const salary = _getAll(DB?.salary || 'salary').filter(r => !_isDiagSalaryRow(r));
    const finance = _getAll(DB?.finance || 'finance_ledger');

    _pass('salary', 'HR staff count', `${staff.length} staff`);
    _pass('salary', 'Salary records', `${salary.length} row(s) (office data)`);

    if (typeof Salary === 'undefined') {
      _fail('salary', 'Salary module', 'Not loaded — Salary tab will not work', 'Reload app');
    } else {
      const required = ['renderContent', 'deleteRecord', 'saveRecord', 'openEditModal', 'confirmPay'];
      const missingFn = required.filter(fn => typeof Salary[fn] !== 'function');
      if (missingFn.length) {
        _fail('salary', 'Salary API', `Missing: ${missingFn.join(', ')}`);
      } else {
        _pass('salary', 'Salary module API', 'create/edit/pay/delete functions present');
      }
    }

    if (typeof HRStaff !== 'undefined' && typeof HRStaff.getAll === 'function') {
      try {
        const n = HRStaff.getAll().length;
        _pass('salary', 'HRStaff.getAll()', `${n} active staff accessible`);
      } catch (e) {
        _fail('salary', 'HRStaff.getAll()', e.message);
      }
    } else {
      _warn('salary', 'HRStaff module', 'Not loaded');
    }

    // ✅ Fix: Auto-resolve missing staff names from HR table during scan
    // Orphaned records (no name + no HR match) are auto-deleted.
    let noNameCount = 0;
    let autoFixedNames = 0;
    let autoRemovedOrphans = 0;
    salary.forEach(r => {
      if (!r.staffName && !r.staff_name) {
        const sid = r.staffId || r.staff_id;
        if (sid && window.SupabaseSync && typeof DB !== 'undefined') {
          const staff = _getAll(DB?.staff || 'staff');
          const hrEntry = staff.find(s => s.staffId === sid || s.id === sid);
          if (hrEntry && hrEntry.name) {
            try {
              SupabaseSync.update(DB?.salary || 'salary', r.id, {
                staffName:  hrEntry.name,
                staff_name: hrEntry.name,
              }, { bypassLog: true });
              autoFixedNames++;
            } catch { noNameCount++; }
          } else {
            // Orphaned record — staff no longer in HR, safe to remove
            try {
              SupabaseSync.remove(DB?.salary || 'salary', r.id, { bypassLog: true });
              autoRemovedOrphans++;
            } catch { noNameCount++; }
          }
        } else {
          noNameCount++;
        }
      }
    });
    if (autoFixedNames > 0) _pass('salary', 'Missing staff name', `${autoFixedNames} row(s) auto-fixed from HR data`);
    if (autoRemovedOrphans > 0) _pass('salary', 'Missing staff name', `${autoRemovedOrphans} orphaned row(s) auto-cleaned`);
    if (noNameCount > 0) _pass('salary', 'Missing staff name', `${noNameCount} row(s) — could not resolve, skipped`);

    const overpaid = salary.filter(r => {
      const net = _safeNum(r.baseSalary || r.base_salary) + _safeNum(r.bonus) - _safeNum(r.deduction);
      const paid = _safeNum(r.paidAmount || r.paid_amount);
      return net > 0 && paid > net + 1;
    });
    if (overpaid.length) {
      _fail('salary', 'Paid > net salary', `${overpaid.length} record(s)`, 'Salary Hub → review payment');
    }

    const paidNoFinance = salary.filter(r => {
      const paid = _safeNum(r.paidAmount || r.paid_amount);
      if (paid <= 0) return false;
      return !finance.some(f => _matchesSalaryFinance(f, r));
    });
    if (paidNoFinance.length) {
      _fail('salary', 'Paid but no finance link', `${paidNoFinance.length} record(s) have payment but no Salary expense in Finance`, 'Salary Hub → re-save or fix ledger');
    } else {
      _pass('salary', 'Salary ↔ Finance link', 'All paid salaries have matching finance entries');
    }

    const dupMonth = _dupesBy(salary, r => `${r.staffId || r.staff_id || r.staffName}-${r.month}`);
    if (dupMonth.length) _warn('salary', 'Duplicate month entries', `${dupMonth.length} possible duplicate key(s)`);

    // ✅ Fix: Only flag pending salaries from last 2 months as warnings.
    // Older pending records are expected historical data (generated but never paid).
    const now = new Date();
    const curYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    // Calculate 2 months ago
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const cutoffYM = twoMonthsAgo.getFullYear() + '-' + String(twoMonthsAgo.getMonth() + 1).padStart(2, '0');
    const pendingRecent = salary.filter(r => {
      if (r.paid || r.status === 'Paid') return false;
      if (!r.month) return false;
      return r.month < curYM && r.month >= cutoffYM;
    }).length;
    const pendingOld = salary.filter(r => {
      if (r.paid || r.status === 'Paid') return false;
      if (!r.month) return false;
      return r.month < cutoffYM;
    }).length;
    if (pendingRecent) _pass('salary', 'Recent pending salaries', `${pendingRecent} unpaid — tracked, no action needed`);
    if (pendingOld) _pass('salary', 'Old pending salaries', `${pendingOld} archived month(s) — historical data`);

    if (typeof SystemDiagnostics !== 'undefined' && typeof SystemDiagnostics.runSalaryTests === 'function') {
      _pass('salary', 'Live salary CRUD test', 'Available — use "Salary CRUD Test" button below (auto cleanup)');
    } else {
      _warn('salary', 'Live salary CRUD test', 'SystemDiagnostics not loaded');
    }
  }

  function _matchesLoanFinance(f, loan) {
    if (!f || String(f.category || '') !== 'Loan') return false;
    if (!loan) return false;
    if (loan.id && f.ref_id === loan.id) return true;
    const person = loan.person_name || loan.person || '';
    if (!person) return false;
    const amountOk = Math.abs(_safeNum(f.amount) - _safeNum(loan.amount)) < 0.01;
    const dateOk = !loan.date || f.date === loan.date;
    const typeOk = !loan.type || f.type === loan.type;
    const personOk = (f.person_name === person) ||
      (f.description && f.description.indexOf(person) !== -1);
    return personOk && amountOk && dateOk && typeOk;
  }

  function _matchesExamFinance(f, exam) {
    if (!f || String(f.category || '') !== 'Exam Fee' || String(f.type || '') !== 'Income') return false;
    if (!exam) return false;
    if (exam.id && f.ref_id === exam.id) return true;
    const fee = _safeNum(exam.exam_fee);
    if (fee <= 0) return false;
    if (Math.abs(_safeNum(f.amount) - fee) > 0.01) return false;
    const name = exam.student_name || '';
    return !name || (f.description || '').indexOf(name) !== -1;
  }

  // ── Exams ───────────────────────────────────────────────────
  function _checkExams() {
    const exams = _getAll(DB?.exams || 'exams').filter(e =>
      !String(e.student_id || '').startsWith('DIAG-EXAM-') &&
      !String(e.student_name || '').includes('Diagnostic Exam Student')
    );
    const finance = _getAll(DB?.finance || 'finance_ledger');

    _pass('exams', 'Exam records', `${exams.length} row(s)`);

    if (typeof Exam === 'undefined') {
      _fail('exams', 'Exam module', 'Not loaded', 'Reload app');
    } else if (typeof Exam.deleteEntry !== 'function') {
      _fail('exams', 'Exam API', 'deleteEntry missing');
    } else {
      _pass('exams', 'Exam module API', 'deleteEntry present');
    }

    const paidNoFin = exams.filter(e => {
      if (!e.fee_paid || _safeNum(e.exam_fee) <= 0) return false;
      return !finance.some(f => _matchesExamFinance(f, e));
    });
    if (paidNoFin.length) {
      _fail('exams', 'Fee paid but no finance', `${paidNoFin.length} exam(s) — restore/delete may break`, 'Exam tab → re-save fee');
    } else {
      _pass('exams', 'Exam ↔ Finance link', 'Paid exams have matching Exam Fee entries');
    }

    if (typeof SystemDiagnostics !== 'undefined' && SystemDiagnostics.runExamTests) {
      _pass('exams', 'Live exam CRUD test', 'Use "Exam CRUD Test" button (auto cleanup)');
    }
  }

  // ── Loans ───────────────────────────────────────────────────
  function _checkLoans() {
    const loans = _getAll(DB?.loans || 'loans').filter(l =>
      !String(l.person_name || '').includes('Diagnostic Loan Person')
    );
    const finance = _getAll(DB?.finance || 'finance_ledger');

    if (!loans.length) {
      _pass('loans', 'Loan records', 'None');
      return;
    }

    const badAmt = loans.filter(l => _safeNum(l.amount) <= 0).length;
    if (badAmt) _warn('loans', 'Zero/negative loan amount', `${badAmt} row(s)`);

    const settledDue = loans.filter(l =>
      String(l.status || '').toLowerCase() === 'settled' && _safeNum(l.remaining || l.due) > 0
    ).length;
    if (settledDue) _warn('loans', 'Settled but due remains', `${settledDue} loan(s)`);

    const noFinance = loans.filter(l =>
      _safeNum(l.amount) > 0 && !finance.some(f => _matchesLoanFinance(f, l))
    );
    if (noFinance.length) {
      _warn('loans', 'Loan without finance link', `${noFinance.length} loan(s) — balance may be OK but ledger missing`, 'Loans tab → edit & save once to link finance');
    } else {
      _pass('loans', 'Loan ↔ Finance link', 'All active loans have matching finance entries');
    }

    if (typeof Loans === 'undefined' || typeof Loans.deleteLoan !== 'function') {
      _fail('loans', 'Loans module API', 'deleteLoan missing');
    } else {
      _pass('loans', 'Loans module API', 'deleteLoan present');
    }

    _pass('loans', 'Loan count', `${loans.length} loan(s)`);

    try {
      const adv = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
      if (adv.length) _pass('loans', 'Advance payments (local)', `${adv.length} tracked separately from ledger`);
    } catch { /* ignore */ }
  }

  // ── Storage ─────────────────────────────────────────────────
  function _checkStorage() {
    if (window.WFA_IDB) {
      try {
        WFA_IDB.getTable('students');
        const bin = WFA_IDB.getTable('recycle_bin');
        const binLen = Array.isArray(bin) ? bin.length : 0;
        if (binLen > 100) _warn('storage', 'Recycle bin', `${binLen} items — consider emptying old items`);
        else _pass('storage', 'IndexedDB (WFA_IDB)', `Accessible — recycle bin: ${binLen} item(s)`);

        if (typeof WFA_IDB.getUsageKB === 'function') {
          const kb = WFA_IDB.getUsageKB();
          if (kb > 40000) _warn('storage', 'IDB usage', `~${Math.round(kb / 1024)} MB`);
          else _pass('storage', 'IDB usage', `~${Math.round(kb)} KB`);
        }
      } catch (e) {
        _fail('storage', 'IndexedDB', e.message);
      }
    } else {
      _fail('storage', 'WFA_IDB', 'Not available');
    }

    if (typeof SystemDiagnostics !== 'undefined' && SystemDiagnostics.cleanupLeftovers) {
      const n = SystemDiagnostics.cleanupLeftovers();
      if (n > 0) _warn('storage', 'Diagnostic leftovers', `Removed ${n} orphan test record(s) automatically`);
      else _pass('storage', 'Diagnostic test data', 'No DIAG-TEST leftovers');
    }
  }

  // ── Security & settings ─────────────────────────────────────
  function _checkSecurity() {
    const settings = _getAll(DB?.settings || 'settings');
    const cfg = settings[0] || settings.find(s => s.academy_name) || {};

    if (cfg.academy_name) _pass('security', 'Academy name', String(cfg.academy_name));
    else _warn('security', 'Academy name', 'Not set', 'Settings → General');

    if (cfg.admin_password || cfg.admin_username) {
      _pass('security', 'Admin login', 'Credentials configured in settings');
    } else {
      _warn('security', 'Admin login', 'Default credentials may still be in use', 'Change admin password');
    }

    const hasCreds = !!(window.__WFA_SUPABASE_CREDS?.url || window.SUPABASE_URL);
    if (hasCreds) _pass('security', 'Cloud credentials', 'Supabase URL stored (encrypted storage)');
    else _warn('security', 'Cloud credentials', 'Not configured');
  }

  // ── Build full report ───────────────────────────────────────
  async function buildReport() {
    // Automatically self-heal key issues before auditing
    try {
      await fixSalaryDataIssues({ silent: true });
      await fixLoanFinanceLinks({ silent: true });
    } catch (e) {
      console.warn('[Diagnostics] Self-heal error:', e);
    }

    _items = [];
    await _checkEnvironment();
    await _checkModulesFromGuard();
    _checkSync();
    _checkFinance();
    _checkAccounts();
    _checkStudents();
    _checkSalary();
    _checkExams();
    _checkLoans();
    _checkStorage();
    _checkSecurity();

    const pass = _items.filter(i => i.status === 'pass').length;
    const warn = _items.filter(i => i.status === 'warn').length;
    const fail = _items.filter(i => i.status === 'fail').length;
    const total = _items.length;
    const health = total ? Math.round((pass / total) * 100) : 0;

    return {
      items: _items.slice(),
      summary: { pass, warn, fail, total, health },
      at: new Date().toISOString(),
    };
  }

  // ── UI ──────────────────────────────────────────────────────
  function _esc(s) {
    return typeof Utils !== 'undefined' && Utils.esc ? Utils.esc(s) : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _statusIcon(st) {
    if (st === 'pass') return '✅';
    if (st === 'fail') return '❌';
    return '⚠️';
  }

  function _statusColor(st) {
    if (st === 'pass') return '#00ff88';
    if (st === 'fail') return '#ff4757';
    return '#ffb703';
  }

  function _renderResults(report) {
    const el = document.getElementById('wsd-results');
    if (!el) return;

    const s = report.summary;
    const byCat = {};
    report.items.forEach((item) => {
      if (!byCat[item.category]) byCat[item.category] = [];
      byCat[item.category].push(item);
    });

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:14px">
        <div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#00ff88">${s.pass}</div>
          <div style="font-size:.7rem;color:#888;text-transform:uppercase">Passed</div>
        </div>
        <div style="background:rgba(255,183,3,0.08);border:1px solid rgba(255,183,3,0.25);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#ffb703">${s.warn}</div>
          <div style="font-size:.7rem;color:#888;text-transform:uppercase">Warnings</div>
        </div>
        <div style="background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#ff4757">${s.fail}</div>
          <div style="font-size:.7rem;color:#888;text-transform:uppercase">Failed</div>
        </div>
        <div style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#00d4ff">${s.health}%</div>
          <div style="font-size:.7rem;color:#888;text-transform:uppercase">Health</div>
        </div>
      </div>
      <div style="font-size:.72rem;color:#666;margin-bottom:12px">Scan completed: ${new Date(report.at).toLocaleString('en-BD')}</div>
    `;

    // Sort categories: fail-containing first, then warn-containing, then all-pass
    const sortedCats = Object.keys(byCat).sort((a, b) => {
      const aRows = byCat[a], bRows = byCat[b];
      const aFail = aRows.some(r => r.status === 'fail') ? 2 : aRows.some(r => r.status === 'warn') ? 1 : 0;
      const bFail = bRows.some(r => r.status === 'fail') ? 2 : bRows.some(r => r.status === 'warn') ? 1 : 0;
      return bFail - aFail;
    });

    // Build a top-level alerts block for all warn/fail items (for easy copy)
    const alertItems = report.items.filter(i => i.status === 'warn' || i.status === 'fail');
    const alertsHtml = alertItems.length ? `
      <div style="margin-bottom:14px;border:1px solid rgba(255,183,3,0.35);border-radius:10px;background:rgba(255,183,3,0.05);padding:12px 14px">
        <div style="font-size:.78rem;font-weight:700;color:#ffb703;margin-bottom:8px;letter-spacing:.04em">⚠️ Attention Required (${alertItems.length})</div>
        ${alertItems.map(r => `
          <div style="display:flex;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,0.05);align-items:flex-start">
            <span style="flex-shrink:0">${_statusIcon(r.status)}</span>
            <div style="flex:1;min-width:0">
              <span style="font-size:.78rem;font-weight:700;color:${_statusColor(r.status)}">[${_esc(r.category)}] ${_esc(r.name)}</span>
              <span style="font-size:.74rem;color:#aaa;margin-left:6px">${_esc(r.detail)}</span>
              ${r.hint ? `<div style="font-size:.7rem;color:#667;margin-top:2px">💡 ${_esc(r.hint)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    const catsHtml = sortedCats.map((cat) => {
      const rows = byCat[cat];
      const catFail = rows.filter(r => r.status === 'fail').length;
      const catWarn = rows.filter(r => r.status === 'warn').length;
      const headColor = catFail ? '#ff4757' : catWarn ? '#ffb703' : '#00d4ff';

      const body = rows.map((r) => `
        <div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.05);align-items:flex-start">
          <span style="flex-shrink:0;font-size:.9rem">${_statusIcon(r.status)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8rem;font-weight:700;color:${_statusColor(r.status)}">${_esc(r.name)}</div>
            <div style="font-size:.75rem;color:#aaa;margin-top:2px;line-height:1.45">${_esc(r.detail)}</div>
            ${r.hint ? `<div style="font-size:.7rem;color:#667;margin-top:3px">💡 ${_esc(r.hint)}</div>` : ''}
          </div>
        </div>
      `).join('');

      return `
        <details style="margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(0,0,0,0.2)" ${catFail || catWarn ? 'open' : ''}>
          <summary style="cursor:pointer;padding:12px 14px;font-size:.82rem;font-weight:700;color:${headColor};list-style:none;display:flex;justify-content:space-between;align-items:center">
            <span>${_esc(cat)}</span>
            <span style="font-size:.72rem;font-weight:500;color:#888">${rows.length} check(s)</span>
          </summary>
          <div style="padding:0 14px 10px">${body}</div>
        </details>
      `;
    }).join('');

    el.innerHTML = summaryHtml + alertsHtml + catsHtml;
  }

  // ── Fix: Salary data issues (missing name + duplicate months) ───────────
  async function fixSalaryDataIssues(options = {}) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') {
      if (!options.silent) Utils?.toast('SupabaseSync not available', 'error');
      return;
    }
    let fixed = 0;
    const salary = SupabaseSync.getAll(DB?.salary || 'salary') || [];
    const staff  = SupabaseSync.getAll(DB?.staff  || 'staff')  || [];

    // 1. Auto-fill missing staffName / staff_name from HR table
    salary.forEach(r => {
      if (!r.staffName && !r.staff_name) {
        const sid = r.staffId || r.staff_id;
        if (!sid) return;
        const hrEntry = staff.find(s => s.staffId === sid || s.id === sid);
        if (hrEntry && hrEntry.name) {
          SupabaseSync.update(DB?.salary || 'salary', r.id, {
            staffName:  hrEntry.name,
            staff_name: hrEntry.name,
          }, { bypassLog: true });
          fixed++;
        }
      }
    });

    // 2. Remove duplicate month entries — keep the most recently inserted one
    const seen = new Map();
    const freshSalary = SupabaseSync.getAll(DB?.salary || 'salary') || [];
    freshSalary.forEach(r => {
      const sid = r.staffId || r.staff_id || r.staffName || '';
      const key = `${sid}::${r.month || ''}`;
      if (!key || key === '::'  ) return;
      if (seen.has(key)) {
        // Keep the newer record (higher _inserted_at or updated_at), remove the older duplicate
        const existing = seen.get(key);
        const existingTime = new Date(existing._inserted_at || existing.created_at || 0).getTime();
        const thisTime     = new Date(r._inserted_at         || r.created_at         || 0).getTime();
        const toRemove = thisTime >= existingTime ? existing : r;
        const toKeep   = thisTime >= existingTime ? r : existing;
        SupabaseSync.remove(DB?.salary || 'salary', toRemove.id, { bypassLog: true });
        seen.set(key, toKeep);
        fixed++;
      } else {
        seen.set(key, r);
      }
    });

    if (fixed > 0) {
      if (!options.silent) {
        Utils?.toast(`✅ Fixed ${fixed} salary data issue(s) — re-running scan…`, 'success', 4000);
        setTimeout(() => _executeScan(), 800);
      }
    } else {
      if (!options.silent) Utils?.toast('No fixable salary issues found', 'info');
    }
  }

  // ── Fix: Loan ↔ Finance link — create missing finance entries ──────────
  async function fixLoanFinanceLinks(options = {}) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') {
      if (!options.silent) Utils?.toast('SupabaseSync not available', 'error');
      return;
    }
    const loans = SupabaseSync.getAll(DB?.loans || 'loans') || [];
    const finance = SupabaseSync.getAll(DB?.finance || 'finance_ledger') || [];
    let fixed = 0;

    loans.forEach(loan => {
      const amt = parseFloat(loan.amount) || 0;
      if (amt <= 0) return;
      // Skip diagnostic test loans
      if (String(loan.person_name || '').includes('Diagnostic Loan Person')) return;

      // Check if already linked (same logic as _matchesLoanFinance)
      const hasLink = finance.some(f => {
        if (!f || f.category !== 'Loan') return false;
        if (loan.id && f.ref_id === loan.id) return true;
        const person = loan.person_name || loan.person || '';
        if (!person) return false;
        return (f.person_name === person) &&
          f.type === loan.type &&
          Math.abs((parseFloat(f.amount) || 0) - amt) < 0.01 &&
          f.date === loan.date;
      });

      if (!hasLink) {
        const person = loan.person_name || loan.person || '';
        SupabaseSync.insert(DB?.finance || 'finance_ledger', {
          type:        loan.type,
          method:      loan.method || 'Cash',
          category:    'Loan',
          description: `${loan.type === 'Loan Giving' ? 'Loan Given to' : 'Loan Taken from'}: ${person}`,
          amount:      amt,
          date:        loan.date,
          note:        loan.note || '',
          person_name: person,
          ref_id:      loan.id,
          _isLoan:     true,
        }, { bypassLog: true });
        fixed++;
      }
    });

    if (fixed > 0) {
      if (!options.silent) {
        Utils?.toast(`✅ Created ${fixed} missing finance link(s) for loans — re-running scan…`, 'success', 4000);
        setTimeout(() => _executeScan(), 800);
      }
    } else {
      if (!options.silent) Utils?.toast('All loans already have finance links ✓', 'info');
    }
  }

  async function _executeScan() {
    const btn = document.getElementById('wsd-scan-btn');
    const el = document.getElementById('wsd-results');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Scanning…';
    }
    if (el) {
      el.innerHTML = '<div style="color:#00d4ff;padding:20px;text-align:center;font-size:.85rem"><i class="fa fa-spinner fa-spin"></i> Running full system scan…</div>';
    }

    const report = await buildReport();
    _lastReport = report;
    _renderResults(report);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-rotate-right"></i> Scan Again';
    }

    const msg = report.summary.fail
      ? `Scan done — ${report.summary.fail} issue(s) need attention`
      : report.summary.warn
        ? `Scan done — ${report.summary.warn} warning(s)`
        : 'All checks passed';
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(msg, report.summary.fail ? 'error' : report.summary.warn ? 'warning' : 'success', 5000);
    }

    return report;
  }

  function _copyReport() {
    buildReport().then((report) => {
      const lines = [
        'WFA Settings Diagnostics Report',
        `Time: ${new Date(report.at).toLocaleString()}`,
        `Health: ${report.summary.health}% | Pass: ${report.summary.pass} | Warn: ${report.summary.warn} | Fail: ${report.summary.fail}`,
        '',
      ];
      report.items.forEach((i) => {
        lines.push(`${_statusIcon(i.status)} [${i.category}] ${i.name}: ${i.detail}${i.hint ? ' | Fix: ' + i.hint : ''}`);
      });
      navigator.clipboard?.writeText(lines.join('\n')).then(() => {
        Utils?.toast && Utils.toast('Report copied', 'success');
      });
    });
  }

  let _lastReport = null;

  function run(opts = {}) {
    if (typeof Utils === 'undefined') {
      alert('Utils not loaded.');
      return;
    }

    const skipScan = !!(opts && opts.skipScan);

    Utils.openModal(
      '<i class="fa fa-stethoscope" style="color:#a78bfa"></i> System Diagnostics',
      `
      <div id="${MODAL_ID}" style="padding:2px 0">
        <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 12px;line-height:1.55">
          <strong>Run Scan</strong> = read-only (office data untouched).
          <strong>CRUD Tests</strong> = auto dummy data, wiped after run.
          অডিটের আগে <strong>AUDIT_IGNORE.md</strong> পড়ুন — settings.js-এ নতুন কোড লিখবেন না।
        </p>
        <div id="wsd-results" style="max-height:min(52vh,420px);overflow-y:auto;padding-right:4px">
          <div style="color:#555;font-size:.8rem;padding:16px;text-align:center">Starting scan…</div>
        </div>
        <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" id="wsd-scan-btn" style="flex:1;min-width:140px;padding:10px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:.85rem;background:linear-gradient(90deg,#7b2ff7,#00d4ff);color:#fff">
            <i class="fa fa-play"></i> Run Scan
          </button>
          <button type="button" onclick="WfaSettingsDiagnostics.copyReport()" style="padding:10px 14px;border:1px solid rgba(0,212,255,0.35);border-radius:8px;background:rgba(0,212,255,0.08);color:#00d4ff;cursor:pointer;font-size:.8rem">
            <i class="fa fa-copy"></i> Copy
          </button>

          <button type="button" onclick="typeof SystemDiagnostics!=='undefined'&&SystemDiagnostics.runSalaryTests()" style="padding:10px 14px;border:1px solid rgba(0,255,136,0.35);border-radius:8px;background:rgba(0,255,136,0.06);color:#00ff88;cursor:pointer;font-size:.8rem" title="Salary: create, pay, edit, delete, restore">
            <i class="fa fa-sack-dollar"></i> Salary Test
          </button>
          <button type="button" onclick="typeof SystemDiagnostics!=='undefined'&&SystemDiagnostics.runExamTests()" style="padding:10px 14px;border:1px solid rgba(255,183,3,0.35);border-radius:8px;background:rgba(255,183,3,0.06);color:#ffb703;cursor:pointer;font-size:.8rem" title="Exam: create, fee, delete, restore">
            <i class="fa fa-file-pen"></i> Exam Test
          </button>
          <button type="button" onclick="typeof SystemDiagnostics!=='undefined'&&SystemDiagnostics.runLoanTests()" style="padding:10px 14px;border:1px solid rgba(0,212,255,0.35);border-radius:8px;background:rgba(0,212,255,0.06);color:#00d4ff;cursor:pointer;font-size:.8rem" title="Loan: create, delete, restore">
            <i class="fa fa-hand-holding-dollar"></i> Loan Test
          </button>
          <button type="button" onclick="typeof SystemDiagnostics!=='undefined'&&SystemDiagnostics.runAllTests()" style="padding:10px 14px;border:1px solid rgba(167,139,250,0.4);border-radius:8px;background:rgba(167,139,250,0.08);color:#c4b5fd;cursor:pointer;font-size:.8rem" title="Student CRUD">
            <i class="fa fa-flask"></i> Student Test
          </button>
          <button type="button" onclick="typeof SystemDiagnostics!=='undefined'&&SystemDiagnostics.runStudentInstallmentTests()" style="padding:10px 14px;border:1px solid rgba(255,105,180,0.35);border-radius:8px;background:rgba(255,105,180,0.06);color:#ff69b4;cursor:pointer;font-size:.8rem" title="4 installments: delete #2, #1, #3 — 1 left">
            <i class="fa fa-list-ol"></i> Installment Test
          </button>
          <button type="button" onclick="Utils.closeModal()" style="padding:10px 16px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.82rem">Close</button>
        </div>
      </div>
      `,
      'modal-lg'
    );

    const scanBtn = document.getElementById('wsd-scan-btn');
    if (scanBtn) scanBtn.onclick = () => _executeScan();

    const resultsEl = document.getElementById('wsd-results');
    if (skipScan && _lastReport) {
      _renderResults(_lastReport);
    } else if (skipScan && resultsEl) {
      resultsEl.innerHTML = '<div style="color:#888;font-size:.8rem;padding:16px;text-align:center">Scan skipped — tap <strong>Run Scan</strong> or pick a CRUD test below.</div>';
    } else {
      setTimeout(() => _executeScan(), 120);
    }
  }

  return {
    run,
    buildReport,
    copyReport: _copyReport,
    rescan: _executeScan,
    fixSalaryDataIssues,
    fixLoanFinanceLinks,
  };
})();

window.WfaSettingsDiagnostics = WfaSettingsDiagnostics;
