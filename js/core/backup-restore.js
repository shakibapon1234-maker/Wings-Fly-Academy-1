// ============================================================
// Wings Fly Aviation Academy — Local Backup & Restore
// Phase 4.1: Full JSON export/import with integrity verification
// ============================================================

const BackupRestore = (() => {

  const BACKUP_VERSION = 'wfa_backup_v2';

  // ── Export: Full local database dump ────────────────────────
  async function exportBackup() {
    try {
      const tables = ['students', 'finance_ledger', 'accounts', 'loans', 'exams',
                       'staff', 'salary', 'attendance', 'visitors', 'notices', 'settings'];

      const data = {};
      let totalRows = 0;

      tables.forEach(table => {
        const rows = SupabaseSync.getAll(table);
        data[table] = rows;
        totalRows += rows.length;
      });

      // Add recycle bin
      data.recycle_bin = SupabaseSync.getAll('recycle_bin');

      const backup = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        device: localStorage.getItem('wfa_device_id') || 'unknown',
        totalRows,
        tableCount: tables.length,
        data,
        // Integrity checksum: simple row count hash
        checksum: _generateChecksum(data),
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      // ✅ Utils.saveFile handles both the Capacitor native APK (via
      // Filesystem + Share) and the plain browser/PWA fallback.
      const ok = typeof Utils !== 'undefined'
        ? await Utils.saveFile(`WingsFly_Backup_${dateStr}.json`, blob, 'application/json')
        : false;

      if (ok && typeof Utils !== 'undefined') {
        Utils.toast(`✅ Backup exported — ${totalRows} records across ${tables.length} tables`, 'success', 5000);
      }

      return ok;
    } catch (e) {
      console.error('[Backup] Export failed:', e);
      if (typeof Utils !== 'undefined') Utils.toast('❌ Backup export failed: ' + e.message, 'error');
      return false;
    }
  }

  // ── Import: Restore from backup file ───────────────────────
  async function importBackup() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';

      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(false); return; }

        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          let tableData = null;
          let exportedAt = backup.exportedAt || backup.exported_at || backup._exportedAt || new Date().toISOString();
          let totalRows = backup.totalRows || 0;
          let isLegacy = false;

          // Detect legacy format
          if (Object.prototype.hasOwnProperty.call(backup, 'employees') ||
              Object.prototype.hasOwnProperty.call(backup, 'cashBalance') ||
              Object.prototype.hasOwnProperty.call(backup, 'incomeCategories') ||
              (backup.students && backup.students[0] && backup.students[0].studentId)) {
            isLegacy = true;
          }

          if (isLegacy) {
            tableData = {};
            if (backup.students && backup.students.length) {
              tableData.students = backup.students.map(s => ({
                id: s.id || SupabaseSync.generateId(),
                student_id: s.studentId || s.student_id || '',
                name: s.name || '', phone: s.phone || '', course: s.course || '',
                batch: s.batch || '', session: s.session || '',
                total_fee: s.totalPayment || s.total_fee || 0,
                paid: s.paid || 0, due: s.due || (s.totalPayment || 0) - (s.paid || 0),
                method: s.method || 'Cash',
                admission_date: s.enrollDate || s.admission_date || '',
                father_name: s.fatherName || s.father_name || '',
                mother_name: s.motherName || s.mother_name || '',
                blood_group: s.bloodGroup || s.blood_group || '',
                photo: s.photo || '', remarks: s.remarks || '', status: s.status || 'Active',
                created_at: s.createdAt || s.created_at || new Date().toISOString(),
                updated_at: s.updated_at || new Date().toISOString(),
              }));
              totalRows += tableData.students.length;
            }
            if (backup.employees && backup.employees.length) {
              tableData.staff = backup.employees.map(emp => ({
                id: emp.id || SupabaseSync.generateId(),
                staffId: emp.id || emp.staffId || '', name: emp.name || '', role: emp.role || 'Staff',
                phone: emp.phone || '', email: emp.email || '', salary: emp.salary || 0,
                status: emp.status || 'Active', joiningDate: emp.joiningDate || '', resignDate: emp.resignDate || '',
                created_at: emp.lastUpdated || emp.createdAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }));
              totalRows += tableData.staff.length;
            }
            if (backup.finance && backup.finance.length) {
              tableData.finance_ledger = backup.finance.map(f => ({
                id: String(f.id || SupabaseSync.generateId()),
                type: f.type || 'Expense', method: f.method || 'Cash', category: f.category || '',
                description: f.description || '', amount: f.amount || 0, 
                date: f.date || '',
                note: f.note || f.person || '',
                person_name: f.person_name || f.person || '',
                created_at: f.createdAt || f.timestamp || new Date().toISOString(),
                updated_at: f.updatedAt || new Date().toISOString(),
              }));
              totalRows += tableData.finance_ledger.length;
            }
            const accountEntries = [];
            if (backup.cashBalance) {
              const bal = typeof backup.cashBalance === 'object' ? (backup.cashBalance.amount || backup.cashBalance.balance || 0) : backup.cashBalance;
              // ✅ FIX (2026-07-07, audit): আগে `tableData.accounts` চেক করা হতো, কিন্তু
              // সেটা এই ব্লকের নিচে (লাইন ~166-এ) অ্যাসাইন হয় — তাই এই চেক সবসময়
              // খালি array-এর বিরুদ্ধে চলত, effectively dead code। সঠিক variable
              // (এই import pass-এ এখন পর্যন্ত তৈরি হওয়া accountEntries) ব্যবহার করা হলো,
              // যাতে ভবিষ্যতে এই ব্লকের উপরে আরেকটা Cash-adding সোর্স যোগ হলেও
              // duplicate তৈরি না হয়।
              const existingCash = accountEntries.find(a => a.type === 'Cash' && String(a.name || '').trim() === 'Cash');
              if (existingCash) {
                existingCash.balance = bal;
                existingCash.updated_at = new Date().toISOString();
              } else {
                accountEntries.push({ id: SupabaseSync.generateId(), name: 'Cash', type: 'Cash', balance: bal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
              }
            }
            if (backup.bankAccounts && Array.isArray(backup.bankAccounts)) {
              backup.bankAccounts.forEach(b => {
                const nm = b.name || b.bankName || 'Bank';
                accountEntries.push({
                  id: SupabaseSync.generateId(),
                  type: 'Bank_Detail',
                  name: nm,
                  balance: b.balance || b.amount || 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              });
            }
            if (backup.mobileBanking) {
              const bal = typeof backup.mobileBanking === 'object' ? (backup.mobileBanking.balance || backup.mobileBanking.amount || 0) : backup.mobileBanking;
              const mbName = (typeof backup.mobileBanking === 'object' && backup.mobileBanking.name) ? backup.mobileBanking.name : 'Mobile Banking';
              accountEntries.push({ id: SupabaseSync.generateId(), type: 'Mobile_Detail', name: mbName, balance: bal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            }
            if (accountEntries.length) {
              tableData.accounts = accountEntries;
              totalRows += accountEntries.length;
            }
            if (backup.visitors && backup.visitors.length) {
              tableData.visitors = backup.visitors.map(v => ({
                id: v.id || SupabaseSync.generateId(), name: v.name || '', phone: v.phone || '',
                course: v.interestedCourse || v.course || '', remarks: v.remarks || '',
                visit_date: v.date || v.visitDate || '',
                created_at: v.createdAt || new Date().toISOString(), 
                updated_at: new Date().toISOString(),
              }));
              totalRows += tableData.visitors.length;
            }
            if (backup.notices && backup.notices.length) {
              tableData.notices = backup.notices.map(n => ({
                ...n,
                date: n.date || '',
                created_at: n.created_at || new Date().toISOString(),
              }));
              totalRows += tableData.notices.length;
            }
            if (backup.settings) {
              const cfg = Array.isArray(backup.settings) ? backup.settings[0] : backup.settings;
              if (cfg) {
                tableData.settings = [{
                  id: cfg.id || SupabaseSync.generateId(),
                  academy_name: cfg.academyName || cfg.academy_name || 'Wings Fly Aviation Academy',
                  address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
                  created_at: cfg.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }];
                totalRows += 1;
              }
            }
            if (backup.examRegistrations && backup.examRegistrations.length) {
              tableData.exams = backup.examRegistrations.map(e => ({
                id: e.id || SupabaseSync.generateId(),
                reg_id: e.regId || e.reg_id || '', student_id: e.studentId || e.student_id || '',
                student_name: e.studentName || e.student_name || '', batch: e.batch || '',
                subject: e.subject || '', exam_date: e.examDate || e.exam_date || '',
                exam_fee: e.examFee || e.exam_fee || 0, grade: e.grade || '',
                marks: e.marks || null, status: e.status || 'Registered',
                created_at: e.createdAt || new Date().toISOString(), 
                updated_at: new Date().toISOString(),
              }));
              totalRows += tableData.exams.length;
            }
          } else if (backup.version === BACKUP_VERSION && backup.data && typeof backup.data === 'object') {
            tableData = backup.data;
            totalRows = backup.totalRows || 0;

            const expectedChecksum = _generateChecksum(backup.data);
            if (backup.checksum && backup.checksum !== expectedChecksum) {
              if (typeof Utils !== 'undefined') {
                Utils.toast('⚠️ Backup checksum mismatch — file may be corrupted', 'warning', 8000);
              }
            }
          } else {
            tableData = {};
            const SKIP_KEYS = new Set(['meta', 'version', 'exportedAt', '_exportedAt', '_version', '_meta', 'checksum', 'device', 'tableCount', 'totalRows']);
            for (const [key, val] of Object.entries(backup)) {
              if (SKIP_KEYS.has(key) || key.startsWith('_')) continue;
              if (Array.isArray(val)) {
                tableData[key] = val;
                totalRows += val.length;
              }
            }
          }

          if (!tableData || Object.keys(tableData).length === 0) {
            if (typeof Utils !== 'undefined') Utils.toast('❌ Invalid backup file format', 'error');
            resolve(false);
            return;
          }

          // Confirm restore
          const confirmed = await Utils.confirm(
            `Restore backup from ${new Date(exportedAt).toLocaleString()}?\n\n` +
            `This will replace ALL current data with ${totalRows || '?'} records.\n` +
            `This action cannot be undone!`,
            '🔄 Restore Backup'
          );
          if (!confirmed) { resolve(false); return; }

          // Restore each table
          let _restored = 0;
          for (const [table, rows] of Object.entries(tableData)) {
            if (Array.isArray(rows)) {
              const skipTables = ['activity_log', 'recent_changes'];
              if (skipTables.includes(table)) continue;

              // Preserve active admin password
              if (table === 'settings') {
                const existing = SupabaseSync.getAll('settings');
                if (existing && existing.length && rows.length) {
                  const restoredCfg = { ...rows[0] };
                  delete restoredCfg.admin_password;
                  if (existing[0].admin_password) {
                    restoredCfg.admin_password = existing[0].admin_password;
                  }
                  SupabaseSync.setAll('settings', [restoredCfg]);
                  _restored++;
                  continue;
                }
              }

              SupabaseSync.setAll(table, rows);
              _restored++;
            }
          }

          if (typeof Utils !== 'undefined') {
            Utils.toast(`💾 Saving restored data locally...`, 'info', 3000);
          }

          // 1. Flush local IndexedDB writes first to ensure they are fully saved
          if (typeof WFA_IDB !== 'undefined' && WFA_IDB.flushWrites) {
            await WFA_IDB.flushWrites();
          }

          // Trigger UI refresh
          window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore' } }));

          // 2. Push to cloud (Supabase) if connected
          let pushSuccess = false;
          try {
            if (typeof SyncEngine !== 'undefined') {
              if (typeof Utils !== 'undefined') {
                Utils.toast(`☁️ Syncing restored data to cloud...`, 'info', 3000);
              }
              console.info('[Backup] Restored locally, pushing to cloud...');
              await SyncEngine.push({ silent: true, forcePush: true });
              pushSuccess = true;
            }
          } catch(e) {
            console.error('[Backup] Cloud push failed:', e);
          }

          // 3. Flush any subsequent writes (e.g. sync timestamps, status)
          if (typeof WFA_IDB !== 'undefined' && WFA_IDB.flushWrites) {
            await WFA_IDB.flushWrites();
          }

          if (typeof Utils !== 'undefined') {
            if (pushSuccess) {
              Utils.toast(`✅ Backup restored & synced to cloud! Page reloading...`, 'success', 2000);
            } else {
              Utils.toast(`⚠️ Backup restored locally, but cloud sync failed! Page reloading...`, 'warning', 3000);
            }
          }

          // ✅ Backfill flag set করো যাতে startup repair আবার না চলে।
          // ⛔ recalculateAccountBalancesFromLedger() এখানে CALL করা যাবে না —
          //    backup-এ duplicate REPAIR entries থাকলে balance ৫০x বেড়ে যাবে।
          //    AUDIT_IGNORE Section 8: accounts.balance শুধু incremental updateAccountBalance() দিয়ে।
          localStorage.setItem('wfa_finance_backfill_v1', '1');

          // ✅ CRITICAL FIX (Section 22): Backup import-এর পর cutoff date ও baselines
          // localStorage-এ restore করতে হবে। নাহলে reload-এর পর first full pull-এ
          // recalculateAccountBalancesFromLedger() cutoff ছাড়াই চলে এবং পুরো পুরনো ledger
          // থেকে ভুল balance দেখায় (backup-এ correct balance ছিল ১ সেকেন্ড, তারপর হারায়)।
          try {
            const restoredSettings = SupabaseSync.getAll('settings');
            if (restoredSettings && restoredSettings.length) {
              let examCfg = {};
              try { examCfg = JSON.parse(restoredSettings[0].exam_settings || '{}'); } catch { examCfg = {}; }
              // Restore cutoff date to localStorage
              if (examCfg.repair_cutoff_date) {
                localStorage.setItem('wfa_repair_cutoff_date', examCfg.repair_cutoff_date);
                console.info('[Backup] Cutoff date restored to localStorage:', examCfg.repair_cutoff_date);
              } else {
                localStorage.removeItem('wfa_repair_cutoff_date');
              }
              // Restore cutoff baselines to localStorage
              if (examCfg.repair_cutoff_baselines && Object.keys(examCfg.repair_cutoff_baselines).length) {
                localStorage.setItem('wfa_repair_cutoff_baselines', JSON.stringify(examCfg.repair_cutoff_baselines));
                console.info('[Backup] Cutoff baselines restored to localStorage:', examCfg.repair_cutoff_baselines);
              } else {
                localStorage.removeItem('wfa_repair_cutoff_baselines');
              }
            }
          } catch (cutoffErr) {
            console.warn('[Backup] Could not restore cutoff from settings:', cutoffErr);
          }

          setTimeout(() => {
            location.reload();
          }, 1500);

          resolve(true);
        } catch (e) {
          console.error('[Backup] Import failed:', e);
          if (typeof Utils !== 'undefined') Utils.toast('❌ Restore failed: ' + e.message, 'error');
          resolve(false);
        }

        input.remove();
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  // ── Checksum: simple hash of table row counts ──────────────
  function _generateChecksum(data) {
    let hash = 0;
    for (const [table, rows] of Object.entries(data)) {
      const count = Array.isArray(rows) ? rows.length : 0;
      const str = `${table}:${count}`;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
    }
    return 'chk_' + Math.abs(hash).toString(36);
  }

  return { exportBackup, importBackup };
})();

window.BackupRestore = BackupRestore;
