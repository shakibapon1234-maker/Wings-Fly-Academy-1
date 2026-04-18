// ============================================================
// Wings Fly Aviation Academy — Local Backup & Restore
// Phase 4.1: Full JSON export/import with integrity verification
// ============================================================

const BackupRestore = (() => {

  const BACKUP_VERSION = 'wfa_backup_v2';

  // ── Export: Full local database dump ────────────────────────
  function exportBackup() {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `WingsFly_Backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (typeof Utils !== 'undefined') {
        Utils.toast(`✅ Backup exported — ${totalRows} records across ${tables.length} tables`, 'success', 5000);
      }

      return true;
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

          // Validate backup structure
          if (!backup.version || !backup.data || typeof backup.data !== 'object') {
            if (typeof Utils !== 'undefined') Utils.toast('❌ Invalid backup file format', 'error');
            resolve(false);
            return;
          }

          // Verify checksum
          const expectedChecksum = _generateChecksum(backup.data);
          if (backup.checksum && backup.checksum !== expectedChecksum) {
            if (typeof Utils !== 'undefined') {
              Utils.toast('⚠️ Backup checksum mismatch — file may be corrupted', 'warning', 8000);
            }
          }

          // Confirm restore
          const confirmed = await Utils.confirm(
            `Restore backup from ${new Date(backup.exportedAt).toLocaleString()}?\n\n` +
            `This will replace ALL current data with ${backup.totalRows || '?'} records.\n` +
            `This action cannot be undone!`,
            '🔄 Restore Backup'
          );
          if (!confirmed) { resolve(false); return; }

          // Restore each table
          // Logic #1 fix: setAll ব্যবহার করা হচ্ছে (insert নয়),
          // যাতে backup-এর প্রতিটি record-এর original created_at,
          // admission_date, date ইত্যাদি হুবহু preserve হয়।
          // কোনো timestamp override হবে না।
          let restored = 0;
          for (const [table, rows] of Object.entries(backup.data)) {
            if (Array.isArray(rows)) {
              // activity_log এবং recent_changes ছাড়া সব table restore হবে
              // (এগুলো real-time log, backup থেকে overwrite করা উচিত না)
              const skipTables = ['activity_log', 'recent_changes'];
              if (skipTables.includes(table)) continue;
              SupabaseSync.setAll(table, rows);
              restored++;
            }
          }

          if (typeof Utils !== 'undefined') {
            Utils.toast(`✅ Backup restored — ${restored} tables loaded from ${file.name}`, 'success', 5000);
          }

          // Trigger UI refresh
          window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore' } }));

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
