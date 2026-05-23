// ============================================================
// system-diagnostics.js — Automated Integrity & Flow Tester
// Wings Fly Aviation Academy
// ============================================================

const SystemDiagnostics = (() => {

  const DUMMY_STUDENT_ID = 'DIAG-TEST-' + Date.now();

  function _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  // ── Open the diagnostics modal and wait for user to press START ──
  function runAllTests() {
    if (typeof Utils === 'undefined') { alert('Utils module not loaded.'); return; }
    Utils.openModal('<i class="fa fa-stethoscope" style="color:#a78bfa"></i> System Diagnostics', `
      <div style="padding:4px 0;">
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px;line-height:1.6;">
          This tool will <strong style="color:#ffaa00">automatically create, modify and delete</strong> a dummy test record
          to verify your system's CRUD and financial integrity logic end-to-end.
        </div>
        <div id="diag-output"
          style="background:#080c14;border:1px solid rgba(0,212,255,0.2);border-radius:10px;
                 height:260px;overflow-y:auto;padding:14px;
                 box-shadow:inset 0 4px 20px rgba(0,0,0,0.6);">
          <div style="color:#444;font-style:italic;font-size:0.8rem;">Press "▶ Run Tests" to begin…</div>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;">
          <button id="diag-run-btn" onclick="SystemDiagnostics._execute()"
            style="flex:1;padding:11px;border:none;border-radius:8px;cursor:pointer;font-weight:800;font-size:0.9rem;
                   background:linear-gradient(90deg,#7b2ff7,#00d4ff);color:#fff;letter-spacing:0.5px;">
            <i class="fa fa-play"></i> Run Tests
          </button>
          <button onclick="Utils.closeModal()"
            style="padding:11px 20px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;
                   background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.88rem;">
            Close
          </button>
        </div>
      </div>
    `, 'modal-md');
  }

  // ── Main test runner ─────────────────────────────────────────
  async function _execute() {
    const btn = document.getElementById('diag-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…'; }

    document.getElementById('diag-output').innerHTML = '';
    _log('System Diagnostics Started', 'header');
    _log('-------------------------------------------', 'info');

    // Verify DB is available
    if (!window.DB || !window.DB.students) {
      _log('ERROR: DB constants not loaded (window.DB missing)', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const DB = window.DB;  // Local reference for clarity
    let studentUuid = null;
    let financeUuid = null;
    let allPassed   = true;

    try {
      // ── PHASE 1: CREATE ──────────────────────────────────────
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

      // ── PHASE 2: READ ────────────────────────────────────────
      await _wait(500);
      _log('PHASE 2 — Student READ', 'header');

      const fetched = SupabaseSync.getById(DB.students, studentUuid);
      if (!fetched) throw new Error('READ failed — student not found after creation.');
      if (fetched.total_fee !== 10000) throw new Error(`READ mismatch — expected total_fee=10000, got ${fetched.total_fee}.`);
      _log('Student read back successfully. Fee verified.', 'success');

      // ── PHASE 3: FINANCE ENTRY ───────────────────────────────
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

      // Update student balances as the app would
      SupabaseSync.update(DB.students, studentUuid, { paid: 3000, due: 7000 }, { bypassLog: true });
      const afterPay = SupabaseSync.getById(DB.students, studentUuid);
      if (afterPay.paid !== 3000 || afterPay.due !== 7000) {
        throw new Error(`Balance MISMATCH after payment. paid=${afterPay.paid}, due=${afterPay.due}`);
      }
      _log('Finance record added. paid=3000, due=7000. ✔ Correct!', 'success');

      // ── PHASE 4: EDIT / UPDATE ──────────────────────────────
      await _wait(500);
      _log('PHASE 4 — Student UPDATE', 'header');

      SupabaseSync.update(DB.students, studentUuid, { name: 'System Test Student [UPDATED]', status: 'Inactive' }, { bypassLog: true });
      const afterEdit = SupabaseSync.getById(DB.students, studentUuid);
      if (afterEdit.name !== 'System Test Student [UPDATED]') throw new Error('UPDATE failed — name not changed.');
      if (afterEdit.status !== 'Inactive') throw new Error('UPDATE failed — status not changed.');
      _log('Student updated. Name & Status changed correctly.', 'success');

      // ── PHASE 5: FINANCE ROLLBACK (DELETE PAYMENT) ──────────
      await _wait(500);
      _log('PHASE 5 — Finance Rollback (DELETE payment)', 'header');

      SupabaseSync.remove(DB.finance, financeUuid, { bypassLog: true });
      financeUuid = null; // consumed

      // Reverse balance as app rollback logic does
      SupabaseSync.update(DB.students, studentUuid, { paid: 0, due: 10000 }, { bypassLog: true });
      const afterRollback = SupabaseSync.getById(DB.students, studentUuid);
      if (afterRollback.paid !== 0 || afterRollback.due !== 10000) {
        throw new Error(`Rollback MISMATCH. paid=${afterRollback.paid}, due=${afterRollback.due}`);
      }
      _log('Rollback verified. paid=0, due=10000. ✔ Correct!', 'success');

      // ── PHASE 6: STUDENT DELETE (To Recycle Bin) ──────────────
      await _wait(500);
      _log('PHASE 6 — Student DELETE (To Recycle Bin)', 'header');

      SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });

      const afterDelete = SupabaseSync.getById(DB.students, studentUuid);
      if (afterDelete) throw new Error('DELETE failed — student still in active database.');
      
      let bin = SupabaseSync.getAll('recycle_bin');
      let binIndex = bin.findIndex(b => b.table === DB.students && b.data.id === studentUuid);
      if (binIndex === -1) throw new Error('DELETE failed — student not found in Recycle Bin.');
      _log('Student deleted and moved to Recycle Bin.', 'success');

      // ── PHASE 7: RESTORE FROM RECYCLE BIN ────────────────────
      await _wait(500);
      _log('PHASE 7 — Student RESTORE', 'header');

      console.log('[DIAG] About to restore binIndex:', binIndex, 'for studentUuid:', studentUuid);
      const restoreResult = await SupabaseSync.restoreRecycleBinItem(binIndex);
      console.log('[DIAG] Restore result:', restoreResult);

      const afterRestore = SupabaseSync.getById(DB.students, studentUuid);
      console.log('[DIAG] After restore, getById result:', afterRestore);
      if (!afterRestore) throw new Error('RESTORE failed — student not returned to active database.');
      _log('Student successfully restored from Recycle Bin!', 'success');

      // ── PHASE 8: PERMANENT CLEANUP ───────────────────────────
      await _wait(500);
      _log('PHASE 8 — Permanent Cleanup', 'header');

      // 1. Find and delete active finance records linked to the test student
      const activeFinance = SupabaseSync.getAll(DB.finance) || [];
      const diagnosticPayments = activeFinance.filter(f => f.ref_id === studentUuid || f.note === 'Auto-generated diagnostic payment');
      for (const p of diagnosticPayments) {
        SupabaseSync.remove(DB.finance, p.id, { bypassLog: true });
      }
      _log(`Moved ${diagnosticPayments.length} active diagnostic payment(s) to Recycle Bin.`, 'info');

      // 2. Delete student to move to recycle bin
      const targetStudentUuid = studentUuid;
      SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });
      studentUuid = null; // consumed

      // 3. Purge all diagnostic items permanently from the recycle bin
      const purgeBinItems = () => {
        const bin = SupabaseSync.getAll('recycle_bin') || [];
        const idx = bin.findIndex(b => 
          (b.table === DB.students && (b.data.student_id === DUMMY_STUDENT_ID || b.data.name?.includes('System Test Student'))) ||
          (b.table === DB.finance && (b.data.ref_id === targetStudentUuid || b.data.note === 'Auto-generated diagnostic payment'))
        );
        if (idx !== -1) {
          SupabaseSync.permanentDeleteRecycleBinItem(idx);
          purgeBinItems(); // Recursive purge until none are left
        }
      };
      purgeBinItems();
      _log('Dummy records permanently wiped from system & Recycle Bin.', 'success');

    } catch (err) {
      allPassed = false;
      _log('', 'info');
      _log(`TEST FAILED: ${err.message}`, 'error');
      _log('Running emergency cleanup...', 'warn');

      // Cleanup on failure
      try {
        // Delete active payments
        if (studentUuid) {
          const activeFinance = SupabaseSync.getAll(DB.finance) || [];
          const diagnosticPayments = activeFinance.filter(f => f.ref_id === studentUuid || f.note === 'Auto-generated diagnostic payment');
          for (const p of diagnosticPayments) {
            SupabaseSync.remove(DB.finance, p.id, { bypassLog: true });
          }
          SupabaseSync.remove(DB.students, studentUuid, { bypassLog: true });
        } else if (financeUuid) {
          SupabaseSync.remove(DB.finance, financeUuid, { bypassLog: true });
        }
        
        // Purge recycle bin of all test items
        const purgeBinItems = () => {
          const bin = SupabaseSync.getAll('recycle_bin') || [];
          const idx = bin.findIndex(b => 
            (b.table === DB.students && (b.data.student_id === DUMMY_STUDENT_ID || b.data.name?.includes('System Test Student'))) ||
            (b.table === DB.finance && b.data.note === 'Auto-generated diagnostic payment')
          );
          if (idx !== -1) {
            SupabaseSync.permanentDeleteRecycleBinItem(idx);
            purgeBinItems();
          }
        };
        purgeBinItems();
        _log('Emergency cleanup complete.', 'warn');
      } catch (ce) {
        _log('Cleanup error: ' + ce.message, 'error');
      }
    }

    await _wait(400);
    _log('-------------------------------------------', 'info');
    if (allPassed) {
      _log('ALL 8 PHASES PASSED — System integrity & Restore is solid!', 'success');
    } else {
      _log('Some tests FAILED — review errors above.', 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = allPassed
        ? '<i class="fa fa-rotate-right"></i> Run Again'
        : '<i class="fa fa-rotate-right"></i> Retry';
    }
  }

  function cleanupLeftovers() {
    try {
      if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return 0;

      const studentsTable = DB.students;
      const financeTable = DB.finance;
      if (!studentsTable || !financeTable) return 0;

      // 1. Find all diagnostic students in active database
      const activeStudents = SupabaseSync.getAll(studentsTable) || [];
      const leftoverStudents = activeStudents.filter(s => 
        (s.student_id && String(s.student_id).startsWith('DIAG-TEST-')) ||
        (s.name && String(s.name).includes('System Test Student')) ||
        (s.batch === 'Batch-DIAG') ||
        (s.course === 'Diagnostics Course')
      );

      const leftoverStudentUuids = leftoverStudents.map(s => s.id).filter(Boolean);

      // 2. Find all diagnostic finance entries in active database
      const activeFinance = SupabaseSync.getAll(financeTable) || [];
      const leftoverFinance = activeFinance.filter(f => 
        f.note === 'Auto-generated diagnostic payment' ||
        (f.ref_id && String(f.ref_id).startsWith('DIAG-TEST-')) ||
        leftoverStudentUuids.includes(f.ref_id)
      );

      let removedCount = 0;

      // Delete active leftover finance records directly
      for (const p of leftoverFinance) {
        SupabaseSync.remove(financeTable, p.id, { bypassLog: true });
        removedCount++;
      }

      // Delete active leftover student records directly
      for (const s of leftoverStudents) {
        SupabaseSync.remove(studentsTable, s.id, { bypassLog: true });
        removedCount++;
      }

      // 3. Purge all diagnostic items (active/recycled) from the Recycle Bin
      const purgeBinItems = () => {
        const bin = SupabaseSync.getAll('recycle_bin') || [];
        const idx = bin.findIndex(b => {
          if (b.table === studentsTable) {
            const data = b.data || {};
            return (data.student_id && String(data.student_id).startsWith('DIAG-TEST-')) ||
                   (data.name && String(data.name).includes('System Test Student')) ||
                   (data.batch === 'Batch-DIAG') ||
                   (data.course === 'Diagnostics Course') ||
                   leftoverStudentUuids.includes(data.id);
          }
          if (b.table === financeTable) {
            const data = b.data || {};
            return data.note === 'Auto-generated diagnostic payment' ||
                   (data.ref_id && String(data.ref_id).startsWith('DIAG-TEST-')) ||
                   leftoverStudentUuids.includes(data.ref_id);
          }
          return false;
        });

        if (idx !== -1) {
          SupabaseSync.permanentDeleteRecycleBinItem(idx);
          removedCount++;
          purgeBinItems(); // Recursive purge
        }
      };
      purgeBinItems();

      if (removedCount > 0) {
        console.log(`%c[Diagnostics] Cleaned up ${removedCount} orphaned diagnostic records from active DB/Recycle Bin.`, 'color: #a78bfa; font-weight: bold');
      }
      return removedCount;
    } catch (e) {
      console.error('[Diagnostics] Failed during auto-cleanup of leftovers:', e);
      return 0;
    }
  }

  return { runAllTests, _execute, cleanupLeftovers };
})();
window.SystemDiagnostics = SystemDiagnostics;
