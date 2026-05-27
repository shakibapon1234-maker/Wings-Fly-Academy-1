// ============================================================
// system-diagnostics.js — Automated Integrity & Flow Tester
// Wings Fly Aviation Academy
// ============================================================

const SystemDiagnostics = (() => {

  const DUMMY_STUDENT_ID = 'DIAG-TEST-' + Date.now();
  const DIAG_SALARY_STAFF_ID   = 'DIAG-SAL-STAFF';
  const DIAG_SALARY_STAFF_NAME = 'Diagnostic Test Staff [AUTO]';
  const DIAG_SALARY_NOTE       = 'Auto-generated diagnostic salary';
  const DIAG_SALARY_PAY_NOTE   = 'Auto-generated diagnostic salary payment';
  const DIAG_EXAM_STUDENT_ID   = 'DIAG-EXAM-' + Date.now();
  const DIAG_EXAM_NOTE         = 'Auto-generated diagnostic exam';
  const DIAG_EXAM_PAY_NOTE     = 'Auto-generated diagnostic exam payment';
  const DIAG_LOAN_PERSON       = 'Diagnostic Loan Person [AUTO]';
  const DIAG_LOAN_NOTE         = 'Auto-generated diagnostic loan';
  const DIAG_LOAN_FIN_NOTE     = 'Auto-generated diagnostic loan finance';

  function _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function _diagRun(fn) {
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.runWithoutActivityLog === 'function') {
      return SupabaseSync.runWithoutActivityLog(fn);
    }
    return fn();
  }

  function _log(msg, type = 'info') {
    const output = document.getElementById('diag-output');
    if (!output) return;
    const colors = { info: '#00d4ff', success: '#00ff88', error: '#ff4d6d', warn: '#ffaa00', header: '#a78bfa' };
    const icons  = { info: '➡️', success: '✅', error: '❌', warn: '⚠️', header: '🔬' };
    const color  = colors[type] || colors.info;
    const icon   = icons[type]  || icons.info;
    output.innerHTML += `<div style="margin-bottom:6px;color:${color};font-size:0.82rem;font-family:'Courier New',monospace;">${icon} ${msg}</div>`;
    output.scrollTop = output.scrollHeight;
  }

  function _currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
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

  function _readSalaryBase(r) {
    return Utils.safeNum(r && (r.baseSalary ?? r.base_salary ?? r.basic));
  }

  function _isDiagSalaryRecord(r) {
    if (!r) return false;
    const sid = String(r.staffId || r.staff_id || '');
    const name = String(r.staffName || r.staff_name || '');
    return sid === DIAG_SALARY_STAFF_ID || name.includes('Diagnostic Test Staff') ||
      r.note === DIAG_SALARY_NOTE;
  }

  function _salaryDeleteLikeApp(r) {
    if (!r) return;
    const finEntries = (SupabaseSync.getAll(DB.finance) || []).filter(f => _matchesSalaryFinance(f, r));
    finEntries.forEach((f) => {
      const amt = typeof Utils !== 'undefined' ? Utils.safeNum(f.amount) : (parseFloat(f.amount) || 0);
      SupabaseSync.remove(DB.finance, f.id, { bypassLog: true });
      const method = f.method || r.method;
      if (amt > 0 && method && typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(method, amt, 'in', true);
      }
    });
    if (!r.name && r.staffName) {
      SupabaseSync.update(DB.salary, r.id, { name: r.staffName }, { bypassLog: true });
    }
    SupabaseSync.remove(DB.salary, r.id, { bypassLog: true });
  }

  let _crudModalActive = false;

  function _returnToDiagnosticsHub() {
    _crudModalActive = false;
    Utils.closeModal();
    setTimeout(() => {
      if (typeof WfaSettingsDiagnostics !== 'undefined' && typeof WfaSettingsDiagnostics.run === 'function') {
        WfaSettingsDiagnostics.run({ skipScan: true });
      }
    }, 380);
  }

  function closeTestModal() {
    if (_crudModalActive) _returnToDiagnosticsHub();
    else if (typeof Utils !== 'undefined') Utils.closeModal();
  }

  function isCrudTestModalOpen() {
    return _crudModalActive;
  }

  function _openCrudModal(title, subtitle, runHandler) {
    if (typeof Utils === 'undefined') { alert('Utils module not loaded.'); return; }
    _crudModalActive = true;
    Utils.openModal(`<i class="fa fa-stethoscope" style="color:#a78bfa"></i> ${title}`, `
      <div style="padding:4px 0;">
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px;line-height:1.6;">
          ${subtitle}
        </div>
        <div id="diag-output"
          style="background:#080c14;border:1px solid rgba(0,212,255,0.2);border-radius:10px;
                 height:min(320px,50vh);overflow-y:auto;padding:14px;
                 box-shadow:inset 0 4px 20px rgba(0,0,0,0.6);">
          <div style="color:#444;font-style:italic;font-size:0.8rem;">Press "▶ Run Tests" to begin…</div>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="diag-run-btn" data-diag-run="${runHandler}"
            style="flex:1;min-width:160px;padding:11px;border:none;border-radius:8px;cursor:pointer;font-weight:800;font-size:0.9rem;
                   background:linear-gradient(90deg,#7b2ff7,#00d4ff);color:#fff;letter-spacing:0.5px;">
            <i class="fa fa-play"></i> Run Tests
          </button>
          <button type="button" onclick="SystemDiagnostics.closeTestModal()"
            style="padding:11px 20px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;
                   background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.88rem;">
            ← Back to Diagnostics
          </button>
        </div>
      </div>
    `, 'modal-md');
    const btn = document.getElementById('diag-run-btn');
    if (btn) {
      btn.onclick = () => {
        const handler = btn.getAttribute('data-diag-run');
        _diagRun(async () => {
          if (handler === 'salary') await _executeSalary();
          else if (handler === 'exam') await _executeExam();
          else if (handler === 'loan') await _executeLoan();
          else if (handler === 'student-inst') await _executeStudentInstallment();
          else await _execute();
        });
      };
    }
  }

  function runAllTests() {
    _openCrudModal(
      'Student CRUD Test',
      'Automatically creates, edits, deletes &amp; restores a <strong style="color:#ffaa00">dummy student</strong>. ' +
      'Test data is removed at the end — your office records stay untouched.'
    );
  }

  function runSalaryTests() {
    _openCrudModal(
      'Salary CRUD Test',
      'Automatically creates, pays, edits, deletes &amp; restores a <strong style="color:#ffaa00">dummy salary record</strong> ' +
      '(including Finance + Recycle Bin). Test data is wiped after the run.',
      'salary'
    );
  }

  function runExamTests() {
    _openCrudModal(
      'Exam CRUD Test',
      'Creates a dummy exam with fee, edits, deletes to Recycle Bin, restores exam + Exam Fee finance — then wipes test data.',
      'exam'
    );
  }

  function runLoanTests() {
    _openCrudModal(
      'Loan CRUD Test',
      'Creates a dummy loan with finance link, deletes, restores loan + finance — then wipes test data.',
      'loan'
    );
  }

  function _matchesLoanFinance(f, loan) {
    if (!f || f.category !== 'Loan') return false;
    if (!loan) return false;
    if (loan.id && f.ref_id === loan.id) return true;
    const person = loan.person_name || loan.person || '';
    return (f.person_name === person) &&
      f.type === loan.type &&
      Math.abs(Utils.safeNum(f.amount) - Utils.safeNum(loan.amount)) < 0.01 &&
      f.date === loan.date;
  }

  function _matchesExamFinance(f, exam) {
    if (!f || f.category !== 'Exam Fee' || f.type !== 'Income') return false;
    if (!exam) return false;
    if (exam.id && f.ref_id === exam.id) return true;
    const fee = Utils.safeNum(exam.exam_fee);
    if (fee <= 0) return false;
    if (Math.abs(Utils.safeNum(f.amount) - fee) > 0.01) return false;
    const name = exam.student_name || '';
    return !name || (f.description || '').indexOf(name) !== -1;
  }

  function _loanDeleteLikeApp(r) {
    const method = r.method || 'Cash';
    if (Utils.safeNum(r.amount) > 0 && typeof SupabaseSync.updateAccountBalance === 'function') {
      const wasGiven = r.type === 'Loan Giving' || r.direction === 'given';
      SupabaseSync.updateAccountBalance(method, Utils.safeNum(r.amount), wasGiven ? 'in' : 'out', true);
    }
    const linked = SupabaseSync.getAll(DB.finance).find(f => _matchesLoanFinance(f, r));
    if (linked && linked.id) SupabaseSync.remove(DB.finance, linked.id, { bypassLog: true });
    SupabaseSync.remove(DB.loans, r.id, { bypassLog: true });
  }

  function _examReverseFinance(exam) {
    if (!exam || !exam.fee_paid || Utils.safeNum(exam.exam_fee) <= 0) return;
    SupabaseSync.getAll(DB.finance).filter(f => _matchesExamFinance(f, exam)).forEach((fin) => {
      if (fin.method && typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(fin.method, Utils.safeNum(fin.amount), 'out', true);
      }
      SupabaseSync.remove(DB.finance, fin.id, { bypassLog: true });
    });
  }

  // ── Student test runner ─────────────────────────────────────
  async function _execute() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }

    const out = document.getElementById('diag-output');
    if (out) out.innerHTML = '';
    _log('Student CRUD Test Started', 'header');
    _log('-------------------------------------------', 'info');

    if (!window.DB || !window.DB.students) {
      _log('ERROR: DB constants not loaded (window.DB missing)', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    let studentUuid = null;
    let financeUuid = null;
    let allPassed   = true;

    try {
      _log('PHASE 1 — Student CREATE', 'header');
      await _wait(600);

      const dummy = {
        student_id:     DUMMY_STUDENT_ID,
        name:           'System Test Student [AUTO]',
        phone:          '01000000000',
        course:         'Diagnostics Course',
        batch:          'Batch-DIAG',
        total_fee:      10000,
        paid:           0,
        due:            10000,
        status:         'Active',
        admission_date: Utils.today(),
        created_at:     new Date().toISOString(),
      };

      const created = SupabaseSync.insert(DB.students, dummy, { bypassLog: true });
      if (!created || !created.id) throw new Error('CREATE failed — SupabaseSync.insert() returned nothing.');
      studentUuid = created.id;
      _log(`Student created. UUID: ${studentUuid}`, 'success');

      await _wait(500);
      _log('PHASE 2 — Student READ', 'header');

      const fetched = SupabaseSync.getById(DB.students, studentUuid);
      if (!fetched) throw new Error('READ failed — student not found after creation.');
      if (fetched.total_fee !== 10000) throw new Error(`READ mismatch — expected total_fee=10000, got ${fetched.total_fee}.`);
      _log('Student read back successfully. Fee verified.', 'success');

      await _wait(500);
      _log('PHASE 3 — Finance Payment INSERT', 'header');

      const payment = {
        category:   'Student Fee',
        type:       'Income',
        amount:     3000,
        date:       Utils.today(),
        ref_id:     studentUuid,
        method:     'Cash',
        note:       'Auto-generated diagnostic payment',
        created_at: new Date().toISOString(),
      };
      const addedFin = SupabaseSync.insert(DB.finance, payment, { bypassLog: true });
      if (!addedFin || !addedFin.id) throw new Error('FINANCE INSERT failed.');
      financeUuid = addedFin.id;

      SupabaseSync.update(DB.students, studentUuid, { paid: 3000, due: 7000 }, { bypassLog: true });
      const afterPay = SupabaseSync.getById(DB.students, studentUuid);
      if (afterPay.paid !== 3000 || afterPay.due !== 7000) {
        throw new Error(`Balance MISMATCH after payment. paid=${afterPay.paid}, due=${afterPay.due}`);
      }
      _log('Finance record added. paid=3000, due=7000. ✔ Correct!', 'success');

      await _wait(500);
      _log('PHASE 4 — Student UPDATE', 'header');

      SupabaseSync.update(DB.students, studentUuid, { name: 'System Test Student [UPDATED]', status: 'Inactive' }, { bypassLog: true });
      const afterEdit = SupabaseSync.getById(DB.students, studentUuid);
      if (afterEdit.name !== 'System Test Student [UPDATED]') throw new Error('UPDATE failed — name not changed.');
      if (afterEdit.status !== 'Inactive') throw new Error('UPDATE failed — status not changed.');
      _log('Student updated. Name & Status changed correctly.', 'success');

      await _wait(500);
      _log('PHASE 5 — Finance Rollback (DELETE payment)', 'header');

      SupabaseSync.remove(DB.finance, financeUuid, { bypassLog: true });
      financeUuid = null;

      SupabaseSync.update(DB.students, studentUuid, { paid: 0, due: 10000 }, { bypassLog: true });
      const afterRollback = SupabaseSync.getById(DB.students, studentUuid);
      if (afterRollback.paid !== 0 || afterRollback.due !== 10000) {
        throw new Error(`Rollback MISMATCH. paid=${afterRollback.paid}, due=${afterRollback.due}`);
      }
      _log('Rollback verified. paid=0, due=10000. ✔ Correct!', 'success');

      await _wait(500);
      _log('PHASE 6 — Student DELETE (To Recycle Bin)', 'header');

      SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });

      const afterDelete = SupabaseSync.getById(DB.students, studentUuid);
      if (afterDelete) throw new Error('DELETE failed — student still in active database.');

      let bin = SupabaseSync.getAll('recycle_bin');
      let binIndex = bin.findIndex(b => b.table === DB.students && b.data.id === studentUuid);
      if (binIndex === -1) throw new Error('DELETE failed — student not found in Recycle Bin.');
      _log('Student deleted and moved to Recycle Bin.', 'success');

      await _wait(500);
      _log('PHASE 7 — Student RESTORE', 'header');

      const restoreResult = await SupabaseSync.restoreRecycleBinItem(binIndex);
      if (!restoreResult) throw new Error('RESTORE failed — restoreRecycleBinItem returned false.');

      const afterRestore = SupabaseSync.getById(DB.students, studentUuid);
      if (!afterRestore) throw new Error('RESTORE failed — student not returned to active database.');
      _log('Student successfully restored from Recycle Bin!', 'success');

      await _wait(500);
      _log('PHASE 8 — Permanent Cleanup', 'header');

      const activeFinance = SupabaseSync.getAll(DB.finance) || [];
      const diagnosticPayments = activeFinance.filter(f => f.ref_id === studentUuid || f.note === 'Auto-generated diagnostic payment');
      for (const p of diagnosticPayments) {
        SupabaseSync.remove(DB.finance, p.id, { bypassLog: true });
      }
      _log(`Moved ${diagnosticPayments.length} active diagnostic payment(s) to Recycle Bin.`, 'info');

      const targetStudentUuid = studentUuid;
      SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });
      studentUuid = null;

      const purgeBinItems = () => {
        const b = SupabaseSync.getAll('recycle_bin') || [];
        const idx = b.findIndex(x =>
          (x.table === DB.students && (x.data.student_id === DUMMY_STUDENT_ID || x.data.name?.includes('System Test Student'))) ||
          (x.table === DB.finance && (x.data.ref_id === targetStudentUuid || x.data.note === 'Auto-generated diagnostic payment'))
        );
        if (idx !== -1) {
          SupabaseSync.permanentDeleteRecycleBinItem(idx);
          purgeBinItems();
        }
      };
      purgeBinItems();
      _log('Dummy student records permanently wiped.', 'success');

    } catch (err) {
      allPassed = false;
      _log(`TEST FAILED: ${err.message}`, 'error');
      _log('Running emergency cleanup...', 'warn');
      try {
        if (studentUuid) {
          const activeFinance = SupabaseSync.getAll(DB.finance) || [];
          activeFinance.filter(f => f.ref_id === studentUuid || f.note === 'Auto-generated diagnostic payment')
            .forEach(p => SupabaseSync.remove(DB.finance, p.id, { bypassLog: true }));
          SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });
        } else if (financeUuid) {
          SupabaseSync.remove(DB.finance, financeUuid, { bypassLog: true });
        }
        cleanupLeftovers();
        _log('Emergency cleanup complete.', 'warn');
      } catch (ce) {
        _log('Cleanup error: ' + ce.message, 'error');
      }
    }

    await _wait(400);
    _log('-------------------------------------------', 'info');
    if (allPassed) {
      _log('ALL 8 STUDENT PHASES PASSED ✓', 'success');
    } else {
      _log('Student test FAILED — review errors above.', 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = allPassed
        ? '<i class="fa fa-rotate-right"></i> Run Again'
        : '<i class="fa fa-rotate-right"></i> Retry';
    }
  }

  // ── Salary test runner (create → pay → edit → delete → restore → cleanup) ──
  async function _executeSalary() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }

    const out = document.getElementById('diag-output');
    if (out) out.innerHTML = '';
    _log('Salary CRUD Test Started', 'header');
    _log('-------------------------------------------', 'info');

    if (!window.DB || !window.DB.salary) {
      _log('ERROR: DB.salary not loaded', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const month = _currentMonth();
    const monthLbl = _salaryMonthLabel(month);
    let salaryUuid = null;
    let financeUuid = null;
    let allPassed = true;

    try {
      _log('PHASE 1 — Salary CREATE', 'header');
      await _wait(500);

      const base = 5000;
      const created = SupabaseSync.insert(DB.salary, {
        staffId: DIAG_SALARY_STAFF_ID,
        staff_id: DIAG_SALARY_STAFF_ID,
        staffName: DIAG_SALARY_STAFF_NAME,
        staff_name: DIAG_SALARY_STAFF_NAME,
        role: 'Diagnostics',
        month,
        year: parseInt(month.split('-')[0], 10),
        baseSalary: base,
        base_salary: base,
        bonus: 0,
        deduction: 0,
        amount: base,
        net_salary: base,
        paidAmount: 0,
        paid_amount: 0,
        paid: false,
        method: 'Cash',
        note: DIAG_SALARY_NOTE,
      }, { bypassLog: true });

      if (!created || !created.id) throw new Error('Salary CREATE failed.');
      salaryUuid = created.id;
      _log(`Salary record created. ID: ${salaryUuid}`, 'success');

      await _wait(500);
      _log('PHASE 2 — Salary READ', 'header');
      const fetched = SupabaseSync.getById(DB.salary, salaryUuid);
      if (!fetched) throw new Error('READ failed — salary not found.');
      if (_readSalaryBase(fetched) !== base) {
        throw new Error('READ mismatch — baseSalary/basic expected ' + base + ', got ' + _readSalaryBase(fetched));
      }
      _log('Salary read OK.', 'success');

      await _wait(500);
      _log('PHASE 3 — Partial PAYMENT + Finance', 'header');
      const payAmount = 2000;
      const payDate = Utils.today();

      const finEntry = {
        type: 'Expense',
        category: 'Salary',
        method: 'Cash',
        description: 'Salary: ' + DIAG_SALARY_STAFF_NAME + ' (' + monthLbl + ')',
        amount: payAmount,
        date: payDate,
        note: DIAG_SALARY_PAY_NOTE,
        person_name: DIAG_SALARY_STAFF_NAME,
        ref_id: salaryUuid,
      };
      const addedFin = SupabaseSync.insert(DB.finance, finEntry, { bypassLog: true });
      if (!addedFin || !addedFin.id) throw new Error('Finance INSERT failed for salary payment.');
      financeUuid = addedFin.id;
      if (typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance('Cash', payAmount, 'out');
      }

      SupabaseSync.update(DB.salary, salaryUuid, {
        paidAmount: payAmount,
        paid_amount: payAmount,
        paid: false,
        paidDate: payDate,
        paid_date: payDate,
        method: 'Cash',
        amount: base,
        net_salary: base,
      }, { bypassLog: true });

      const afterPay = SupabaseSync.getById(DB.salary, salaryUuid);
      if (Utils.safeNum(afterPay.paidAmount) !== payAmount) {
        throw new Error(`Payment MISMATCH — paidAmount=${afterPay.paidAmount}, expected ${payAmount}`);
      }
      const finCheck = SupabaseSync.getById(DB.finance, financeUuid);
      if (!finCheck || finCheck.ref_id !== salaryUuid) throw new Error('Finance link missing ref_id.');
      _log(`Partial pay ৳${payAmount} + finance expense OK.`, 'success');

      await _wait(500);
      _log('PHASE 4 — Salary EDIT', 'header');
      const newBase = 6000;
      SupabaseSync.update(DB.salary, salaryUuid, {
        baseSalary: newBase,
        base_salary: newBase,
        amount: newBase,
        net_salary: newBase,
        note: DIAG_SALARY_NOTE + ' [UPDATED]',
      }, { bypassLog: true });
      const afterEdit = SupabaseSync.getById(DB.salary, salaryUuid);
      if (_readSalaryBase(afterEdit) !== newBase) throw new Error('EDIT failed — baseSalary not updated.');
      _log('Salary edited (base 5000 → 6000).', 'success');

      await _wait(500);
      _log('PHASE 5 — Salary DELETE → Recycle Bin', 'header');
      const beforeDel = SupabaseSync.getById(DB.salary, salaryUuid);
      _salaryDeleteLikeApp(beforeDel);

      if (SupabaseSync.getById(DB.salary, salaryUuid)) {
        throw new Error('DELETE failed — salary still active.');
      }
      const finStillActive = (SupabaseSync.getAll(DB.finance) || []).some(f => f.id === financeUuid);
      if (finStillActive) throw new Error('DELETE failed — finance expense still active (should be in recycle bin).');

      let bin = SupabaseSync.getAll('recycle_bin') || [];
      const salBinIdx = bin.findIndex(b => b.table === DB.salary && b.data?.id === salaryUuid);
      if (salBinIdx === -1) throw new Error('Salary not found in Recycle Bin.');
      const finInBin = bin.some(b => b.table === DB.finance && b.data?.id === financeUuid);
      if (!finInBin) throw new Error('Linked finance not in Recycle Bin after salary delete.');
      _log('Salary + finance moved to Recycle Bin.', 'success');

      await _wait(500);
      _log('PHASE 6 — Salary RESTORE from Recycle Bin', 'header');
      bin = SupabaseSync.getAll('recycle_bin') || [];
      const restoreIdx = bin.findIndex(b => b.table === DB.salary && b.data?.id === salaryUuid);
      if (restoreIdx === -1) throw new Error('Cannot find salary in bin for restore.');

      const restored = await SupabaseSync.restoreRecycleBinItem(restoreIdx);
      if (!restored) throw new Error('restoreRecycleBinItem returned false.');

      const afterRestore = SupabaseSync.getById(DB.salary, salaryUuid);
      if (!afterRestore) throw new Error('RESTORE failed — salary not back in active DB.');

      const finRestored = (SupabaseSync.getAll(DB.finance) || []).find(f => f.id === financeUuid);
      if (!finRestored) {
        throw new Error('RESTORE failed — linked Salary finance expense did not return (critical bug).');
      }
      if (finRestored.ref_id !== salaryUuid) {
        throw new Error('RESTORE finance ref_id mismatch.');
      }
      _log('Salary + linked finance restored successfully!', 'success');

      await _wait(500);
      _log('PHASE 7 — Permanent Cleanup', 'header');
      const activeSal = SupabaseSync.getById(DB.salary, salaryUuid);
      if (activeSal) _salaryDeleteLikeApp(activeSal);

      const purgeSalaryBin = () => {
        const b = SupabaseSync.getAll('recycle_bin') || [];
        const idx = b.findIndex(x =>
          (x.table === DB.salary && _isDiagSalaryRecord(x.data)) ||
          (x.table === DB.finance && (x.data?.note === DIAG_SALARY_PAY_NOTE || x.data?.ref_id === salaryUuid))
        );
        if (idx !== -1) {
          SupabaseSync.permanentDeleteRecycleBinItem(idx);
          purgeSalaryBin();
        }
      };
      purgeSalaryBin();
      salaryUuid = null;
      financeUuid = null;
      _log('Diagnostic salary data wiped completely.', 'success');

    } catch (err) {
      allPassed = false;
      _log(`TEST FAILED: ${err.message}`, 'error');
      _log('Emergency cleanup…', 'warn');
      try {
        if (salaryUuid) {
          const r = SupabaseSync.getById(DB.salary, salaryUuid);
          if (r) _salaryDeleteLikeApp(r);
        }
        if (financeUuid) {
          const f = SupabaseSync.getById(DB.finance, financeUuid);
          if (f) SupabaseSync.remove(DB.finance, financeUuid, { bypassLog: true });
        }
        cleanupLeftovers();
        _log('Emergency cleanup done.', 'warn');
      } catch (ce) {
        _log('Cleanup error: ' + ce.message, 'error');
      }
    }

    await _wait(400);
    _log('-------------------------------------------', 'info');
    if (allPassed) {
      _log('ALL 7 SALARY PHASES PASSED — Create/Pay/Edit/Delete/Restore OK ✓', 'success');
    } else {
      _log('Salary test FAILED — this is a CRITICAL bug. Report the phase above.', 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = allPassed
        ? '<i class="fa fa-rotate-right"></i> Run Again'
        : '<i class="fa fa-rotate-right"></i> Retry';
    }
  }

  async function _executeExam() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }
    const out = document.getElementById('diag-output');
    if (out) out.innerHTML = '';
    _log('Exam CRUD Test Started', 'header');
    let examId = null;
    let finId = null;
    let allPassed = true;
    const fee = 1500;
    const examDate = Utils.today();

    try {
      await _wait(400);
      _log('PHASE 1 — Exam CREATE + Fee', 'header');
      const created = SupabaseSync.insert(DB.exams, {
        reg_id: 'REG-DIAG',
        student_id: DIAG_EXAM_STUDENT_ID,
        student_name: 'Diagnostic Exam Student [AUTO]',
        subject: 'Diagnostics Subject',
        exam_date: examDate,
        exam_fee: fee,
        fee_paid: true,
        status: 'Registered',
        note: DIAG_EXAM_NOTE,
      }, { bypassLog: true });
      if (!created || !created.id) throw new Error('Exam CREATE failed');
      examId = created.id;

      const fin = SupabaseSync.insert(DB.finance, {
        type: 'Income',
        category: 'Exam Fee',
        description: `Diagnostic Exam Student [AUTO] (${DIAG_EXAM_STUDENT_ID}) — Exam Fee (Diagnostics Subject)`,
        amount: fee,
        method: 'Cash',
        date: examDate,
        ref_id: examId,
        note: DIAG_EXAM_PAY_NOTE,
      }, { bypassLog: true });
      if (!fin || !fin.id) throw new Error('Exam finance INSERT failed');
      finId = fin.id;
      SupabaseSync.updateAccountBalance('Cash', fee, 'in');
      _log('Exam + Exam Fee finance created.', 'success');

      await _wait(400);
      _log('PHASE 2 — Exam EDIT', 'header');
      SupabaseSync.update(DB.exams, examId, { subject: 'Diagnostics Subject [UPDATED]', marks: 88 }, { bypassLog: true });
      const edited = SupabaseSync.getById(DB.exams, examId);
      if (edited.subject !== 'Diagnostics Subject [UPDATED]') throw new Error('Exam EDIT failed');
      _log('Exam updated.', 'success');

      await _wait(400);
      _log('PHASE 3 — DELETE → Recycle Bin', 'header');
      const entry = SupabaseSync.getById(DB.exams, examId);
      _examReverseFinance(entry);
      SupabaseSync.remove(DB.exams, examId, { bypassLog: true });
      if (SupabaseSync.getById(DB.exams, examId)) throw new Error('Exam still active after delete');
      const bin = SupabaseSync.getAll('recycle_bin') || [];
      if (bin.findIndex(b => b.table === DB.exams && b.data?.id === examId) === -1) {
        throw new Error('Exam not in recycle bin');
      }
      if (!bin.some(b => b.table === DB.finance && b.data?.id === finId)) {
        throw new Error('Exam finance not in recycle bin');
      }
      _log('Exam + finance in Recycle Bin.', 'success');

      await _wait(400);
      _log('PHASE 4 — RESTORE', 'header');
      const bin2 = SupabaseSync.getAll('recycle_bin') || [];
      const idx = bin2.findIndex(b => b.table === DB.exams && b.data?.id === examId);
      const ok = await SupabaseSync.restoreRecycleBinItem(idx);
      if (!ok) throw new Error('restoreRecycleBinItem failed');
      if (!SupabaseSync.getById(DB.exams, examId)) throw new Error('Exam not restored');
      if (!SupabaseSync.getById(DB.finance, finId)) {
        throw new Error('CRITICAL: Exam Fee finance not restored with exam');
      }
      _log('Exam + finance restored!', 'success');

      await _wait(400);
      _log('PHASE 5 — Cleanup', 'header');
      const active = SupabaseSync.getById(DB.exams, examId);
      if (active) _examReverseFinance(active);
      if (active) SupabaseSync.remove(DB.exams, examId, { bypassLog: true });
      examId = null;
      finId = null;
      cleanupLeftovers();
      _log('Test data wiped.', 'success');
    } catch (err) {
      allPassed = false;
      _log('FAILED: ' + err.message, 'error');
      try {
        if (examId) {
          const e = SupabaseSync.getById(DB.exams, examId);
          if (e) { _examReverseFinance(e); SupabaseSync.remove(DB.exams, examId, { bypassLog: true }); }
        }
        if (finId && SupabaseSync.getById(DB.finance, finId)) {
          SupabaseSync.remove(DB.finance, finId, { bypassLog: true });
        }
        cleanupLeftovers();
      } catch (e) { /* ignore */ }
    }
    if (allPassed) _log('ALL EXAM PHASES PASSED ✓', 'success');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-rotate-right"></i> Run Again'; }
  }

  async function _executeLoan() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }
    const out = document.getElementById('diag-output');
    if (out) out.innerHTML = '';
    _log('Loan CRUD Test Started', 'header');
    let loanId = null;
    let finId = null;
    let allPassed = true;
    const amount = 1000;
    const loanDate = Utils.today();

    try {
      await _wait(400);
      _log('PHASE 1 — Loan CREATE', 'header');
      const record = {
        type: 'Loan Giving',
        person_name: DIAG_LOAN_PERSON,
        amount,
        date: loanDate,
        method: 'Cash',
        status: 'Outstanding',
        note: DIAG_LOAN_NOTE,
      };
      const created = SupabaseSync.insert(DB.loans, record, { bypassLog: true });
      if (!created || !created.id) throw new Error('Loan CREATE failed');
      loanId = created.id;

      const fin = SupabaseSync.insert(DB.finance, {
        type: 'Loan Giving',
        method: 'Cash',
        category: 'Loan',
        description: 'Loan Given to: ' + DIAG_LOAN_PERSON,
        amount,
        date: loanDate,
        person_name: DIAG_LOAN_PERSON,
        ref_id: loanId,
        note: DIAG_LOAN_FIN_NOTE,
        _isLoan: true,
      }, { bypassLog: true });
      if (!fin || !fin.id) throw new Error('Loan finance INSERT failed');
      finId = fin.id;
      SupabaseSync.updateAccountBalance('Cash', amount, 'out');
      _log('Loan + finance created.', 'success');

      await _wait(400);
      _log('PHASE 2 — Loan EDIT', 'header');
      SupabaseSync.update(DB.loans, loanId, { note: DIAG_LOAN_NOTE + ' [UPDATED]' }, { bypassLog: true });
      _log('Loan updated.', 'success');

      await _wait(400);
      _log('PHASE 3 — DELETE → Recycle Bin', 'header');
      const entry = SupabaseSync.getById(DB.loans, loanId);
      _loanDeleteLikeApp(entry);
      if (SupabaseSync.getById(DB.loans, loanId)) throw new Error('Loan still active');
      const bin = SupabaseSync.getAll('recycle_bin') || [];
      if (!bin.some(b => b.table === DB.loans && b.data?.id === loanId)) throw new Error('Loan not in bin');
      if (!bin.some(b => b.table === DB.finance && b.data?.id === finId)) throw new Error('Finance not in bin');
      _log('Loan + finance in Recycle Bin.', 'success');

      await _wait(400);
      _log('PHASE 4 — RESTORE', 'header');
      const bin2 = SupabaseSync.getAll('recycle_bin') || [];
      const idx = bin2.findIndex(b => b.table === DB.loans && b.data?.id === loanId);
      const ok = await SupabaseSync.restoreRecycleBinItem(idx);
      if (!ok) throw new Error('restore failed');
      if (!SupabaseSync.getById(DB.loans, loanId)) throw new Error('Loan not restored');
      if (!SupabaseSync.getById(DB.finance, finId)) {
        throw new Error('CRITICAL: Loan finance not restored');
      }
      _log('Loan + finance restored!', 'success');

      await _wait(400);
      _log('PHASE 5 — Cleanup', 'header');
      const active = SupabaseSync.getById(DB.loans, loanId);
      if (active) _loanDeleteLikeApp(active);
      loanId = null;
      finId = null;
      cleanupLeftovers();
      _log('Test data wiped.', 'success');
    } catch (err) {
      allPassed = false;
      _log('FAILED: ' + err.message, 'error');
      try {
        if (loanId) {
          const l = SupabaseSync.getById(DB.loans, loanId);
          if (l) _loanDeleteLikeApp(l);
        }
        cleanupLeftovers();
      } catch (e) { /* ignore */ }
    }
    if (allPassed) _log('ALL LOAN PHASES PASSED ✓', 'success');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-rotate-right"></i> Run Again'; }
  }

  function cleanupLeftovers() {
    try {
      if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return 0;

      const studentsTable = DB.students;
      const financeTable = DB.finance;
      const salaryTable = DB.salary;
      const examsTable = DB.exams;
      const loansTable = DB.loans;
      if (!studentsTable || !financeTable) return 0;

      let removedCount = 0;

      const activeStudents = SupabaseSync.getAll(studentsTable) || [];
      const leftoverStudents = activeStudents.filter(s =>
        (s.student_id && String(s.student_id).startsWith('DIAG-TEST-')) ||
        (s.student_id && String(s.student_id).startsWith('DIAG-INST-')) ||
        (s.name && String(s.name).includes('System Test Student')) ||
        (s.name && String(s.name).includes('Diagnostic Installment Student')) ||
        (s.batch === 'Batch-DIAG') ||
        (s.course === 'Diagnostics Course')
      );
      const leftoverStudentUuids = leftoverStudents.map(s => s.id).filter(Boolean);

      const activeSalary = salaryTable ? (SupabaseSync.getAll(salaryTable) || []) : [];
      const leftoverSalary = activeSalary.filter(_isDiagSalaryRecord);
      const leftoverSalaryUuids = leftoverSalary.map(s => s.id).filter(Boolean);

      const activeFinance = SupabaseSync.getAll(financeTable) || [];
      const activeExams = examsTable ? (SupabaseSync.getAll(examsTable) || []) : [];
      const leftoverExams = activeExams.filter(e =>
        String(e.student_id || '').startsWith('DIAG-EXAM-') ||
        String(e.student_name || '').includes('Diagnostic Exam Student')
      );
      const leftoverExamUuids = leftoverExams.map(e => e.id).filter(Boolean);

      const activeLoans = loansTable ? (SupabaseSync.getAll(loansTable) || []) : [];
      const leftoverLoans = activeLoans.filter(l =>
        String(l.person_name || '').includes('Diagnostic Loan Person')
      );
      const leftoverLoanUuids = leftoverLoans.map(l => l.id).filter(Boolean);

      const leftoverFinance = activeFinance.filter(f =>
        f.note === 'Auto-generated diagnostic payment' ||
        f.note === DIAG_SALARY_PAY_NOTE ||
        f.note === DIAG_EXAM_PAY_NOTE ||
        f.note === DIAG_LOAN_FIN_NOTE ||
        (f.ref_id && String(f.ref_id).startsWith('DIAG-TEST-')) ||
        leftoverStudentUuids.includes(f.ref_id) ||
        leftoverSalaryUuids.includes(f.ref_id) ||
        leftoverExamUuids.includes(f.ref_id) ||
        leftoverLoanUuids.includes(f.ref_id)
      );

      for (const p of leftoverFinance) {
        SupabaseSync.remove(financeTable, p.id, { bypassLog: true });
        removedCount++;
      }
      for (const s of leftoverStudents) {
        SupabaseSync.remove(studentsTable, s.id, { bypassLog: true });
        removedCount++;
      }
      for (const s of leftoverSalary) {
        _salaryDeleteLikeApp(s);
        removedCount++;
      }
      for (const e of leftoverExams) {
        _examReverseFinance(e);
        SupabaseSync.remove(examsTable, e.id, { bypassLog: true });
        removedCount++;
      }
      for (const l of leftoverLoans) {
        _loanDeleteLikeApp(l);
        removedCount++;
      }

      const purgeBinItems = () => {
        const bin = SupabaseSync.getAll('recycle_bin') || [];
        const idx = bin.findIndex(b => {
          if (b.table === studentsTable) {
            const data = b.data || {};
            return (data.student_id && String(data.student_id).startsWith('DIAG-TEST-')) ||
              (data.student_id && String(data.student_id).startsWith('DIAG-INST-')) ||
              (data.name && String(data.name).includes('System Test Student')) ||
              (data.name && String(data.name).includes('Diagnostic Installment Student')) ||
              (data.batch === 'Batch-DIAG') ||
              (data.course === 'Diagnostics Course') ||
              leftoverStudentUuids.includes(data.id);
          }
          if (salaryTable && b.table === salaryTable) {
            return _isDiagSalaryRecord(b.data) || leftoverSalaryUuids.includes(b.data?.id);
          }
          if (examsTable && b.table === examsTable) {
            const data = b.data || {};
            return (data.student_id && String(data.student_id).startsWith('DIAG-EXAM-')) ||
              (data.student_name && String(data.student_name).includes('Diagnostic Exam Student')) ||
              leftoverExamUuids.includes(data.id);
          }
          if (loansTable && b.table === loansTable) {
            const data = b.data || {};
            return (data.person_name && String(data.person_name).includes('Diagnostic Loan Person')) ||
              leftoverLoanUuids.includes(data.id);
          }
          if (b.table === financeTable) {
            const data = b.data || {};
            return data.note === 'Auto-generated diagnostic payment' ||
              data.note === DIAG_SALARY_PAY_NOTE ||
              data.note === DIAG_EXAM_PAY_NOTE ||
              data.note === DIAG_LOAN_FIN_NOTE ||
              leftoverStudentUuids.includes(data.ref_id) ||
              leftoverSalaryUuids.includes(data.ref_id) ||
              leftoverExamUuids.includes(data.ref_id) ||
              leftoverLoanUuids.includes(data.ref_id);
          }
          return false;
        });
        if (idx !== -1) {
          SupabaseSync.permanentDeleteRecycleBinItem(idx);
          removedCount++;
          purgeBinItems();
        }
      };
      purgeBinItems();

      if (removedCount > 0) {
        console.log(`%c[Diagnostics] Cleaned up ${removedCount} orphaned diagnostic record(s).`, 'color: #a78bfa; font-weight: bold');
      }
      return removedCount;
    } catch (e) {
      console.error('[Diagnostics] Failed during auto-cleanup of leftovers:', e);
      return 0;
    }
  }

  function runStudentInstallmentTests() {
    _openCrudModal(
      'Student Installment Test',
      'Creates 4 installments, deletes #2 then #1, then #3 — 1 left. Checks paid/due each step. Office students untouched.',
      'student-inst'
    );
  }

  async function _executeStudentInstallment() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }
    const out = document.getElementById('diag-output');
    if (out) out.innerHTML = '';
    _log('Student Installment Test', 'header');
    let studentId = null;
    const payIds = [];
    let allPassed = true;
    const amounts = [2000, 3000, 2500, 1500];
    const totalFee = amounts.reduce((a, b) => a + b, 0);

    function sumFees() {
      return SupabaseSync.getAll(DB.finance)
        .filter(f => f.category === 'Student Fee' && f.ref_id === studentId)
        .reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    }

    try {
      // Pre-test cleanup: wipe any leftover diagnostic data from a previous failed run
      cleanupLeftovers();
      await _wait(400);
      _log('Create test student + 4 installments', 'header');
      const st = SupabaseSync.insert(DB.students, {
        student_id: 'DIAG-INST-' + Date.now(),
        name: 'Diagnostic Installment Student [AUTO]',
        course: 'Diagnostics Course',
        batch: 'Batch-DIAG',
        total_fee: totalFee,
        paid: 0,
        due: totalFee,
        status: 'Active',
        admission_date: Utils.today(),
      }, { bypassLog: true });
      studentId = st.id;
      for (let i = 0; i < amounts.length; i++) {
        const fin = SupabaseSync.insert(DB.finance, {
          type: 'Income',
          category: 'Student Fee',
          amount: amounts[i],
          method: 'Cash',
          date: Utils.today(),
          ref_id: studentId,
          note: 'Auto-generated diagnostic payment',
          description: 'Installment ' + (i + 1),
        }, { bypassLog: true });
        payIds.push(fin.id);
      }
      const newPaid = sumFees();
      SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: totalFee - newPaid }, { bypassLog: true });
      if (newPaid !== totalFee) throw new Error('Expected paid ' + totalFee + ', got ' + newPaid);
      _log('4 installments created. paid=৳' + newPaid, 'success');

      await _wait(400);
      _log('Delete installment #2 (৳3000)', 'header');
      const p2 = SupabaseSync.getById(DB.finance, payIds[1]);
      const s1 = SupabaseSync.getById(DB.students, studentId);
      SupabaseSync.remove(DB.finance, payIds[1], { bypassLog: true });
      if (typeof Students !== 'undefined' && Students._syncPaidDueAfterLedgerChange) {
        Students._syncPaidDueAfterLedgerChange(studentId, s1, Utils.safeNum(p2.amount));
      }
      const after2 = SupabaseSync.getById(DB.students, studentId);
      const expect2 = totalFee - 3000;
      if (Utils.safeNum(after2.paid) !== expect2) {
        throw new Error('After deleting #2: paid should be ' + expect2 + ', got ' + after2.paid);
      }
      if (_feePaymentsForStudentCount(studentId) !== 3) {
        throw new Error('Should have 3 installments left');
      }
      _log('After delete #2: paid/due OK, 3 rows left', 'success');

      await _wait(400);
      _log('Delete installment #1 (first)', 'header');
      const p0 = SupabaseSync.getById(DB.finance, payIds[0]);
      const s2 = SupabaseSync.getById(DB.students, studentId);
      SupabaseSync.remove(DB.finance, payIds[0], { bypassLog: true });
      if (typeof Students !== 'undefined' && Students._syncPaidDueAfterLedgerChange) {
        Students._syncPaidDueAfterLedgerChange(studentId, s2, Utils.safeNum(p0 && p0.amount));
      } else {
        const leftSum = sumFees();
        SupabaseSync.update(DB.students, studentId, { paid: leftSum, due: totalFee - leftSum }, { bypassLog: true });
      }
      const after1 = SupabaseSync.getById(DB.students, studentId);
      const expect1 = sumFees();
      if (Utils.safeNum(after1.paid) !== expect1) {
        throw new Error('After deleting #1: paid should be ' + expect1 + ', got ' + after1.paid);
      }
      _log('After delete #1: remaining installments OK', 'success');

      await _wait(400);
      _log('Delete installment #3 (৳2500) — 1 left', 'header');
      const pInst3 = SupabaseSync.getById(DB.finance, payIds[2]);
      const s3 = SupabaseSync.getById(DB.students, studentId);
      SupabaseSync.remove(DB.finance, payIds[2], { bypassLog: true });
      if (typeof Students !== 'undefined' && Students._syncPaidDueAfterLedgerChange) {
        Students._syncPaidDueAfterLedgerChange(studentId, s3, Utils.safeNum(pInst3 && pInst3.amount));
      } else {
        const leftSum = sumFees();
        SupabaseSync.update(DB.students, studentId, { paid: leftSum, due: totalFee - leftSum }, { bypassLog: true });
      }
      if (_feePaymentsForStudentCount(studentId) !== 1) {
        throw new Error('Should have 1 installment left, have ' + _feePaymentsForStudentCount(studentId));
      }
      const lastLeft = SupabaseSync.getById(DB.finance, payIds[3]);
      if (!lastLeft || lastLeft.ref_id !== studentId) {
        throw new Error('Last installment (৳1500) missing');
      }
      _log('1 installment remains (৳1500) — OK', 'success');

      await _wait(400);
      _log('Cleanup', 'header');
      SupabaseSync.getAll(DB.finance).filter(f => f.ref_id === studentId).forEach(f => {
        SupabaseSync.remove(DB.finance, f.id, { bypassLog: true });
      });
      SupabaseSync.remove(DB.students, studentId, { bypassLog: true });
      studentId = null;
      cleanupLeftovers();
      _log('Test student removed', 'success');
    } catch (err) {
      allPassed = false;
      _log('FAILED: ' + err.message, 'error');
      cleanupLeftovers();
    }
    if (allPassed) _log('INSTALLMENT TEST PASSED ✓', 'success');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-rotate-right"></i> Run Again'; }
  }

  function _feePaymentsForStudentCount(studentId) {
    return SupabaseSync.getAll(DB.finance).filter(f =>
      f.category === 'Student Fee' && f.ref_id === studentId
    ).length;
  }

  return {
    runAllTests,
    runSalaryTests,
    runExamTests,
    runLoanTests,
    runStudentInstallmentTests,
    closeTestModal,
    isCrudTestModalOpen,
    _execute,
    _executeSalary,
    _executeExam,
    _executeLoan,
    _executeStudentInstallment,
    cleanupLeftovers,
    isDiagnosticSalary: _isDiagSalaryRecord,
  };
})();
window.SystemDiagnostics = SystemDiagnostics;
