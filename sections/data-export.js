// ====================================
// WINGS FLY AVIATION ACADEMY
// DATA EXPORT/IMPORT — Export JSON, Import JSON
// Extracted from app.js (Phase 6)
// ====================================

function exportData() {
  try {
    const dataStr = JSON.stringify(globalData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `WingsFly_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccessToast('Backup exported successfully!');
  } catch (err) {
    alert('Error exporting data: ' + err.message);
  }
}

function importData() {
  const el = document.getElementById('importFileInput') || document.getElementById('importFile');
  if (el) el.click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm('⚠️ WARNING: Importing a backup will OVERWRITE all current data on this computer and the Cloud. Proceed?')) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      let importedData = JSON.parse(e.target.result);

      // Smart Unwrap: handle data exported with different key names
      if (importedData.wingsfly_data) importedData = importedData.wingsfly_data;
      if (importedData.globalData) importedData = importedData.globalData;

      // Validate structure
      if (!importedData.students || !Array.isArray(importedData.students)) {
        throw new Error('Invalid backup file. Could not find students list.');
      }

      // Sanitize: Fill in missing arrays
      importedData.students = importedData.students || [];
      importedData.finance = importedData.finance || [];
      importedData.employees = importedData.employees || [];
      importedData.incomeCategories = importedData.incomeCategories || ['Tuition Fees', 'Loan Received', 'Other'];
      importedData.expenseCategories = importedData.expenseCategories || ['Salary', 'Rent', 'Utilities', 'Loan Given', 'Other'];
      importedData.paymentMethods = importedData.paymentMethods || ['Cash'];
      importedData.settings = importedData.settings || { academyName: 'Wings Fly Aviation Academy' };

      // Update globalData
      window.globalData = importedData;
      if (typeof globalData !== 'undefined') globalData = window.globalData;

      console.log('✅ File parsed successfully:', {
        students: window.globalData.students.length,
        finance: window.globalData.finance.length
      });

      // Update local timestamp
      localStorage.setItem('lastLocalUpdate', new Date().toISOString());

      // Save locally first (skipCloudSync=true — V34 handles push separately)
      try {
        localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
        console.log('💾 Import data saved to localStorage');
      } catch (e) {
        alert('❌ Error saving locally: ' + e.message);
        return;
      }

      // ✅ FIX: Reset MaxCount BEFORE cloud sync so safety checks don't block push
      // Without this, MaxCount sees "students=22 < old_max=17" and blocks the sync
      const _stuLen = window.globalData.students.length;
      const _finLen = window.globalData.finance.length;
      localStorage.setItem('wf_max_students', _stuLen);
      localStorage.setItem('wf_max_finance', _finLen);
      localStorage.setItem('wings_last_known_count', _stuLen);
      localStorage.setItem('wings_last_known_finance', _finLen);
      console.log('✅ MaxCount reset after import — Students:', _stuLen, 'Finance:', _finLen);

      // Force Cloud Sync — mark all fields dirty and push
      let cloudSuccess = false;
      try {
        if (window.markDirty) window.markDirty(); // marks students, finance, employees, meta
        if (window.wingsSync && typeof window.wingsSync.pushNow === 'function') {
          cloudSuccess = await window.wingsSync.pushNow('import-backup-restore');
        } else if (typeof window.saveToCloud === 'function') {
          await window.saveToCloud();
          cloudSuccess = true;
        }
      } catch (e) {
        console.error('❌ Cloud sync error:', e);
        cloudSuccess = false;
      }

      if (cloudSuccess) {
        alert(`✅ SUCCESS: ${window.globalData.students.length} students imported and synced to Cloud!`);
      } else {
        alert(`⚠️ PARTIAL SUCCESS: ${window.globalData.students.length} students imported locally.\n\nCloud sync may still be processing. Please click "SYNC WITH CLOUD NOW" button to force sync.`);
      }

      window.location.reload();
    } catch (err) {
      alert('Error importing data: ' + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
}

window.exportData = exportData;
window.importData = importData;
window.handleImportFile = handleImportFile;


// ===================================
// STUDENT ID CARD GENERATOR
// ===================================

// ===================================
// STUDENT ID CARD GENERATOR
// ===================================


// id-card — extracted to sections/id-card.js


window.exportData = exportData;
window.importData = importData;
window.handleImportFile = handleImportFile;
