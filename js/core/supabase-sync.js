// ============================================================
// Wings Fly Aviation Academy — Supabase Sync Engine + CRUD
// Phase 11: IndexedDB Storage (No 5MB limit)
// ============================================================
//
// —— STORAGE MIGRATION: localStorage → IndexedDB ——
//
// Before: wfa_students, wfa_finance_ledger etc. → localStorage (5MB limit)
// Now:   all table data → IndexedDB (500MB+ limit)
//
// Small meta-data (device_id, retry_queue, deletedItems, activity_log,
// recent_changes, recycle_bin, wfa_auto_snapshots) stays in localStorage
// — these do not grow large.
//
// All modules still use getAll/setAll — only the storage backend changed.
// ============================================================

// ─────────────────────────────────────────────────────────────
// WFA_IDB — IndexedDB Wrapper (Async → Sync-like bridge)
// ─────────────────────────────────────────────────────────────
//
// IndexedDB is async, but SupabaseSync getAll/setAll are synchronous.
// We keep an in-memory cache:
//   - On app load, all IDB data is loaded into memory
//   - getAll() → returns from memory (synchronous)
//   - setAll() → updates memory + async write to IndexedDB
//
// This keeps the SupabaseSync API synchronous for callers.
// ─────────────────────────────────────────────────────────────

const WFA_IDB = (() => {
  const DB_NAME    = 'WingsAcademyDB';
  const DB_VERSION = 3;
  const STORE_NAME = 'tables';

  let _db = null;
  let _cache = {};           // in-memory cache: { tableName: [...rows] }
  let _ready = false;
  let _readyCallbacks = [];

  // Open IndexedDB
  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // If the store already exists, delete it first to ensure the correct keyPath is applied
        if (db.objectStoreNames.contains(STORE_NAME)) {
          try {
            db.deleteObjectStore(STORE_NAME);
            if (window.__WFA_DEV__) {
              console.info('[IDB] Re-creating store to ensure correct keyPath: tableName');
            }
          } catch (err) {
            console.error('[IDB] Failed to delete store:', err);
          }
        }
        db.createObjectStore(STORE_NAME, { keyPath: 'tableName' });
      };

      req.onsuccess  = (e) => resolve(e.target.result);
      req.onerror    = (e) => reject(e.target.error);
      req.onblocked  = ()  => console.warn('[IDB] DB upgrade blocked — close other tabs');
    });
  }

  // Load all table data from IndexedDB into memory cache
  async function _loadAllIntoCache(db) {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = (e) => {
        const entries = e.target.result || [];
        entries.forEach(entry => {
          _cache[entry.tableName] = entry.rows || [];
        });
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // IndexedDB write queue — serialize writes and expose completion for safety-critical paths
  let _writeQueue = Promise.resolve();
  let _pendingWriteCount = 0;
  function _writeToIDB(tableName, rows) {
    if (!_db) return Promise.resolve();
    _pendingWriteCount++;
    _writeQueue = _writeQueue.then(() => new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ tableName, rows });
        tx.oncomplete = () => {
          _pendingWriteCount = Math.max(0, _pendingWriteCount - 1);
          resolve();
        };
        tx.onerror = (e) => {
          _pendingWriteCount = Math.max(0, _pendingWriteCount - 1);
          console.error('[IDB] Write failed for', tableName, e.target.error);
          reject(e.target.error);
        };
        tx.onabort = (e) => {
          _pendingWriteCount = Math.max(0, _pendingWriteCount - 1);
          console.error('[IDB] Write aborted for', tableName, e.target.error);
          reject(e.target.error || new Error('IDB transaction aborted'));
        };
      } catch (err) {
        _pendingWriteCount = Math.max(0, _pendingWriteCount - 1);
        console.error('[IDB] Write setup failed for', tableName, err);
        reject(err);
      }
    })).catch((err) => {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(
          `Database save failed for "${tableName}" — data kept in memory. Free disk space or reload. (${err?.message || 'IDB error'})`,
          'error',
          10000
        );
      }
    });
    return _writeQueue;
  }

  // Initialize — call once on app load
  async function init() {
    try {
      _db = await _openDB();
      await _loadAllIntoCache(_db);

      // One-time migration from localStorage
      await _migrateFromLocalStorage();

      // ── One-time cleanup of stale phantom finance entries ──────────────
      // Remove "Opening Balance" and "Balance Adjustment" entries that were
      // created by the old broken _upsertOpeningEntry() system in accounts.js.
      // This flag ensures cleanup runs only once per device.
      const CLEANUP_FLAG = 'wfa_stale_cleanup_v1';
      if (!localStorage.getItem(CLEANUP_FLAG)) {
        try {
          const finance = _cache['finance_ledger'] || [];
          const staleIds = finance
            .filter(f => f.category === 'Opening Balance' || f.category === 'Balance Adjustment')
            .map(f => f.id);
          if (staleIds.length > 0) {
            staleIds.forEach(id => {
              _cache['finance_ledger'] = (_cache['finance_ledger'] || []).filter(f => f.id !== id);
            });
            _writeToIDB('finance_ledger', _cache['finance_ledger']);
            console.info(`[IDB] One-time cleanup: removed ${staleIds.length} stale phantom finance_ledger entries (Opening Balance / Balance Adjustment)`);
          }
          localStorage.setItem(CLEANUP_FLAG, '1');
        } catch (cleanupErr) {
          console.warn('[IDB] Stale cleanup failed (non-critical):', cleanupErr);
        }
      }
      // ──────────────────────────────────────────────────────────────────

      _ready = true;
      _readyCallbacks.forEach(cb => cb());
      _readyCallbacks = [];
      console.info('[IDB] IndexedDB ready. Tables cached:', Object.keys(_cache).join(', ') || '(empty)');
    } catch (e) {
      console.error('[IDB] Init failed — falling back to localStorage:', e);
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('Database Storage Init Failed - using temporary cache (incognito mode?).', 'error', 10000);
      // Fallback: mark ready so the app can still run
      _ready = true;
      _readyCallbacks.forEach(cb => cb());
      _readyCallbacks = [];
    }
  }

  // Migrate legacy wfa_* keys from localStorage into IndexedDB
  async function _migrateFromLocalStorage() {
    const TABLE_KEYS = [
      'students', 'finance_ledger', 'accounts', 'loans', 'exams',
      'staff', 'salary', 'attendance', 'visitors', 'notices', 'settings',
      'sub_accounts'
    ];

    const migrationFlag = 'wfa_idb_migrated_v1';
    
    // Explicit migration for recycle bin
    if (!_cache['recycle_bin'] || _cache['recycle_bin'].length === 0) {
       const rb = localStorage.getItem('wfa_recycle_bin');
       if (rb) {
          try {
            const rbData = JSON.parse(rb);
            _cache['recycle_bin'] = rbData;
            _writeToIDB('recycle_bin', rbData);
          } catch(e) { console.warn('[IDB] recycle_bin parse failed:', e); }
       }
    }
    // Explicit migration for deleted tracker
    if (!_cache['deleted_items'] || _cache['deleted_items'].length === 0) {
       const di = localStorage.getItem('wfa_deletedItems');
       if (di) {
          try {
            const diData = JSON.parse(di);
            _cache['deleted_items'] = [diData];
            _writeToIDB('deleted_items', [diData]);
          } catch(e) { console.warn('[IDB] deletedItems parse failed:', e); }
       }
    }
    // Sync retry queue: localStorage → IndexedDB (single source of truth)
    if (!_cache['retry_queue'] || _cache['retry_queue'].length === 0) {
      const rq = localStorage.getItem('wfa_retry_queue');
      if (rq) {
        try {
          const rqData = JSON.parse(rq);
          if (Array.isArray(rqData) && rqData.length) {
            _cache['retry_queue'] = rqData;
            _writeToIDB('retry_queue', rqData);
            localStorage.removeItem('wfa_retry_queue');
          }
        } catch (e) { console.warn('[IDB] retry_queue parse failed:', e); }
      }
    } else {
      localStorage.removeItem('wfa_retry_queue');
    }

    if (localStorage.getItem(migrationFlag) === 'done') return;

    let migrated = 0;
    const migrationErrors = [];
    for (const key of TABLE_KEYS) {
      const lsKey = `wfa_${key}`;
      const raw   = localStorage.getItem(lsKey);
      if (!raw) continue;

      try {
        const rows = JSON.parse(raw);
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const existing = _cache[key] || [];
        // ✅ BUG #8 FIX: শুধু IDB খালি থাকলে migrate করো।
        // আগে existing.length < rows.length ছিল — এতে IDB-তে সমান row থাকলে
        // localStorage-এর নতুন/আলাদা data skip হয়ে যেত।
        if (existing.length === 0) {
          _cache[key] = rows;
          _writeToIDB(key, rows);
          migrated++;

          // Migration verification: read-back from cache and verify row count
          const verified = _cache[key];
          if (!verified || verified.length !== rows.length) {
            migrationErrors.push(key);
            console.error(`[IDB] Migration verification FAILED for "${key}": expected ${rows.length} rows, got ${verified?.length ?? 0}`);
            _cache[key] = rows;
            _writeToIDB(key, rows);
          } else {
            console.info(`[IDB] Migrated+verified "${key}" from localStorage (${rows.length} rows)`);
          }
        }

        if (!migrationErrors.includes(key)) {
          localStorage.removeItem(lsKey);
        }
      } catch (e) {
        console.warn(`[IDB] Migration failed for "${key}":`, e);
        migrationErrors.push(key);
      }
    }

    if (migrationErrors.length === 0) {
      localStorage.setItem(migrationFlag, 'done');
    } else {
      console.warn(`[IDB] Migration incomplete: ${migrationErrors.join(', ')}. Will retry next load.`);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`Data migration incomplete for: ${migrationErrors.join(', ')}. Will retry.`, 'warning', 8000);
      }
    }
    if (migrated > 0) {
      console.info(`[IDB] Migration: ${migrated} table(s) moved to IndexedDB`);
    }
  }
  // onReady callback — run after init completes
  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }

  // —— Public API ——

  // Synchronous read from memory cache
  function getTable(tableName) {
    return _cache[tableName] || [];
  }

  // Synchronous write to cache + async write to IDB
  function setTable(tableName, rows) {
    _cache[tableName] = rows;
    _writeToIDB(tableName, rows);
  }

  function flushWrites() {
    return _writeQueue;
  }

  // Storage usage — approximate JSON size in cache
  function getUsageKB() {
    let total = 0;
    for (const [key, rows] of Object.entries(_cache)) {
      try {
        total += JSON.stringify(rows).length;
        total += key.length;
      } catch { /* ignore */ }
    }
    return Math.round(total / 1024);
  }

  function getTableSizeKB(tableName) {
    try {
      const rows = _cache[tableName] || [];
      return Math.round(JSON.stringify(rows).length / 1024);
    } catch { return 0; }
  }

  function clearAllTables() {
    _cache = {};
    const TABLE_KEYS = [
      'students', 'finance_ledger', 'accounts', 'loans', 'exams',
      'staff', 'salary', 'attendance', 'visitors', 'notices', 'settings',
      'sub_accounts', 'recycle_bin', 'deleted_items', 'retry_queue', 'recent_changes', 'activity_log'
    ];
    TABLE_KEYS.forEach(key => {
      _cache[key] = [];
      _writeToIDB(key, []);
    });
    console.info('[IDB] Cleared all local tables.');
  }

  return { init, onReady, getTable, setTable, flushWrites, getUsageKB, getTableSizeKB, clearAllTables };
})();

window.WFA_IDB = WFA_IDB;

// Initialize IndexedDB on app start
WFA_IDB.init();
// Best-effort durability: flush pending writes when app goes to background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && WFA_IDB && typeof WFA_IDB.flushWrites === 'function') {
    WFA_IDB.flushWrites().catch(() => {});
  }
});


// ============================================================
// SupabaseSync — CRUD API used by all modules
// TABLE_COLUMNS Definition
// ============================================================
const TABLE_COLUMNS = {
  // ✅ Fix: expense_month, income_categories, expense_categories, courses, employee_roles যোগ করা হয়েছে
  // Note: admin_pattern & admin_face_descriptor stored in localStorage, not Supabase (sync only these columns)
  settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username','keep_records','recycle_bin_sync','exam_questions','exam_settings','institution_type','payment_gateway_config','sms_config'],
  salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','paid','method','role','phone','name'],
  students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','mother_name','guardian_phone','roll_no','shift','note','installment_plan'],
  finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
  accounts:      ['id','name','type','balance','description','note'],
  loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
  exams:         ['id','reg_id','student_id','student_name','batch','session','subject','exam_date','exam_fee','fee_paid','grade','marks','status','note'],
  attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
  staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note','staffId','staff_id'],
  visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','created_at'],
  notices:       ['id','title','text','type','created_at','updated_at','expires_at','is_pinned'],
  advance_payments: ['id','person','amount','method','date','note','returns','created_at','updated_at'],
  investments:      ['id','source','amount','method','date','note','returns','created_at','updated_at'],
  keep_records:     ['id','title','content','color','tags','pinned','date','created','modified','created_at','updated_at'],
  custom_themes:    ['id','name','colors','variables','created_at','updated_at'],
  sub_accounts:     ['id','username','password','name','role','permissions','created_at','updated_at'],
  student_portal_access: ['id','student_id','student_name','phone','pin_hash','is_active','created_at'],
  payment_requests: ['id','student_id','student_name','batch_id','amount','method','transaction_id','sender_number','screenshot_url','status','submitted_at','reviewed_at','reviewed_by','note'],
  class_routines: ['id','batch_id','day','start_time','end_time','subject','teacher_id','room','is_active','created_at'],
  school_classes: ['id','class_name','sections','shift','class_teacher','is_active','created_at','updated_at'],
  school_subjects: ['id','class_name','subject_name','full_marks','pass_marks','is_active','created_at','updated_at'],
  school_marks: ['id','student_id','student_no','student_name','class_name','section','roll_no','academic_year','exam_type','subject_id','subject_name','marks_obtained','full_marks','grade','gpa','pass','created_at','updated_at'],
  sms_logs: ['id','recipient','message','type','status','provider_response','sent_at'],
};

const SupabaseSync = (() => {

  let _syncInProgress = false;

  // —— IDB-backed table storage ——
  function getAll(table) {
    return WFA_IDB.getTable(table);
  }

  function getById(table, id) {
    const rows = getAll(table);
    if (!Array.isArray(rows)) {
      console.warn('[Sync] getById: table', table, 'returned non-array:', rows);
      return null;
    }
    const found = rows.find(r => r.id === id);
    if (!found) return null;
    if (table === _salaryTableKey()) {
      _ensureSalaryLocalFields(found);
    }
    return found;
  }

  function _storageUsageKB() {
    let lsTotal = 0;
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          lsTotal += (localStorage[key].length + key.length) * 2;
        }
      }
    } catch { /* ignore */ }
    return WFA_IDB.getUsageKB() + Math.round(lsTotal / 1024);
  }

  function _freeUpStorage() {
    try {
      const logKey = 'wfa_activity_log';
      const log = (() => { try { return JSON.parse(localStorage.getItem(logKey) || '[]'); } catch { return []; } })();
      if (log.length > 50) localStorage.setItem(logKey, JSON.stringify(log.slice(0, 50)));
      const rcKey = 'wfa_recent_changes';
      const rc = (() => { try { return JSON.parse(localStorage.getItem(rcKey) || '[]'); } catch { return []; } })();
      if (rc.length > 15) localStorage.setItem(rcKey, JSON.stringify(rc.slice(0, 15)));
      console.warn('[Storage] Auto-purged old logs. Usage:', _storageUsageKB(), 'KB');
      return true;
    } catch { return false; }
  }

  function setAll(table, rows) {
    try {
      // ✅ Suspicious Direct Balance Change Detection System
      if (table === 'accounts' && !window._realtimeEventInProgress && !_syncInProgress && Array.isArray(rows)) {
        try {
          const oldAccounts = WFA_IDB.getTable('accounts') || [];
          rows.forEach(newAcc => {
            if (!newAcc || !newAcc.id) return;
            const oldAcc = oldAccounts.find(o => o.id === newAcc.id);
            if (oldAcc) {
              const oldBal = parseFloat(oldAcc.balance) || 0;
              const newBal = parseFloat(newAcc.balance) || 0;
              if (oldBal !== newBal) {
                // Balance changed! Check if it was authorized/legitimate
                if (!window._legitimateBalanceChangeInProgress) {
                  console.warn(`[DataMonitor] ⚠️ Suspicious Direct Balance Change: Account "${newAcc.name || 'Account'}" balance changed from ৳${oldBal} to ৳${newBal} without a transaction!`);
                  
                  // Log alert to localStorage wfa_balance_alerts
                  const alertEntry = {
                    date: new Date().toLocaleString(),
                    timestamp: Date.now(),
                    accountName: newAcc.name || newAcc.type || 'Account',
                    oldBalance: oldBal,
                    newBalance: newBal,
                    difference: Math.round((newBal - oldBal) * 100) / 100,
                    type: 'suspicious_balance_change'
                  };
                  
                  const alerts = (() => { try { return JSON.parse(localStorage.getItem('wfa_balance_alerts') || '[]'); } catch { return []; } })();
                  alerts.unshift(alertEntry);
                  if (alerts.length > 50) alerts.length = 50;
                  localStorage.setItem('wfa_balance_alerts', JSON.stringify(alerts));

                  if (typeof Utils !== 'undefined' && Utils.toast) {
                    Utils.toast(`⚠️ Suspicious balance change: Account "${newAcc.name}" balance changed from ৳${oldBal.toLocaleString()} to ৳${newBal.toLocaleString()} without a transaction!`, 'error', 10000);
                  }
                  window.dispatchEvent(new CustomEvent('wfa:suspicious_balance', { detail: alertEntry }));
                }
              }
            }
          });
        } catch (alertErr) {
          console.warn('[DataMonitor] Balance change audit check failed:', alertErr);
        }
      }

      WFA_IDB.setTable(table, rows);
    } catch (e) {
      console.error('[Storage] setAll failed for table:', table, e);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`âŒ Data save failed for "${table}": ${e.message}`, 'error');
      }
    }
  }

  // ── Per-table primary date field map ────────────────────────
  // Logic #1: যে date দিয়ে record insert করা হচ্ছে, সেটাই created_at হবে।
  // এতে করে পুরনো তারিখ দিয়ে import করলে সব ফাংশনে সেই তারিখ দেখাবে।
  const _TABLE_DATE_FIELD = {
    students:      'admission_date',
    finance_ledger:'date',
    loans:         'date',
    exams:         'exam_date',
    salary:        'paidDate',
    attendance:    'date',
    staff:         'joiningDate',
    visitors:      'visit_date',
    notices:       'created_at',
  };

  function insert(table, record, options = {}) {
    if (!record.id) record.id = generateId();
    // Logic #1 fix: record-এর নিজের date field থাকলে সেটাই created_at হবে,
    // override হবে না — এতে import date অনুযায়ী সব জায়গায় ডেটা সাজবে।
    if (!record.created_at) {
      const dateField = _TABLE_DATE_FIELD[table];
      const dateValue = dateField && record[dateField];
      record.created_at = dateValue
        ? new Date(dateValue).toISOString()
        : new Date().toISOString();
    }
    record.updated_at = new Date().toISOString();
    // ✅ _inserted_at: Real insertion timestamp — immutable, never touched by update().
    // Used by dashboard "Last 5 Transactions" & "Recent Admissions" to sort by
    // actual entry time (activity-log style), not by the user-selected date field.
    if (!record._inserted_at) {
      record._inserted_at = new Date().toISOString();
    }
    record._device = _deviceId();
    if (table === _salaryTableKey()) _ensureSalaryLocalFields(record);
    const rows = getAll(table);
    rows.unshift(record);
    setAll(table, rows);
    _logRecentChange(table, 'insert', record);
    if (!options.bypassLog && !_isDiagnosticRecord(table, record)) {
      _logActivity('add', table, _humanReadableLog('add', table, record));
    }
    // ✅ Diagnostic records: skip cloud push to prevent realtime/pull overwrite race
    if (!options.bypassLog || !_isDiagnosticRecord(table, record)) {
      _pushRecord(table, record);
    }
    return record;
  }

  function update(table, id, partial, options = {}) {
    const rows = getAll(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) {
      const oldRow = rows[idx];
      const merged = { ...oldRow, ...partial, updated_at: new Date().toISOString(), _device: _deviceId() };
      // Logic #1 fix: edit করার সময় date field পরিবর্তন হলে created_at-ও সেই অনুযায়ী update হবে।
      // এতে sort order সর্বদা import/input date অনুযায়ী থাকবে।
      const dateField = _TABLE_DATE_FIELD[table];
      if (dateField && dateField !== 'created_at' && merged[dateField]) {
        merged.created_at = new Date(merged[dateField]).toISOString();
      }
      rows[idx] = merged;
      if (table === _salaryTableKey()) _ensureSalaryLocalFields(rows[idx]);
      setAll(table, rows);
      _logRecentChange(table, 'update', rows[idx]);
      if (!options.bypassLog && !_isDiagnosticRecord(table, merged)) {
        _logActivity('edit', table, _humanReadableLog('edit', table, merged, { old: oldRow, partial }));
      }
      // ✅ Diagnostic records: skip cloud push to prevent realtime/pull overwrite race
      if (!options.bypassLog || !_isDiagnosticRecord(table, rows[idx])) {
        _pushRecord(table, rows[idx]);
      }
    }
  }

  function remove(table, id, options = {}) {
    const before = getAll(table);
    const victim = before.find(r => r.id === id);
    const rows = before.filter(r => r.id !== id);
    setAll(table, rows);
    if (victim) {
      _addToRecycleBin(table, victim);
      _logRecentChange(table, 'delete', victim);
      if (!options.bypassLog && !_isDiagnosticRecord(table, victim)) {
        _logActivity('delete', table, _humanReadableLog('delete', table, victim));
      }
    }
    // ✅ Diagnostic records: skip cloud delete to prevent sync interference
    if (!victim || !_isDiagnosticRecord(table, victim)) {
      _deleteFromCloud(table, id);
      _trackDeletion(table, id);
    }
  }

  // ✅ Security fix #3: use crypto.getRandomValues() instead of Math.random()
  function generateId() {
    const ts  = Date.now().toString(36).toUpperCase();
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return ts + buf[0].toString(36).toUpperCase() + buf[1].toString(36).toUpperCase();
  }

  function _logRecentChange(table, action, record) {
    try {
      if (!record || typeof record !== 'object') return;

      // ✅ Bug Fix 1: investment in/out যোগ করা হয়েছে allowedTypes-এ
      // Monitor-e finance_ledger Income/Expense/Transfer/Investment transactions dekhabe.
      // Students, accounts, settings, salary etc. changes monitor-e ashbe na.
      if (table !== DB.finance) return;
      const financeType = String(record.type || '').toLowerCase();
      const allowedTypes = ['income', 'expense', 'transfer in', 'transfer out', 'loan giving', 'loan receiving', 'investment in', 'investment out'];
      if (!allowedTypes.includes(financeType)) return;

      // ✅ Fix: Skip phantom categories — these were never real money movements.
      // Opening Balance entries were created by the old broken _upsertOpeningEntry() system.
      // Balance Adjustment entries were created by the old broken Auto Fix.
      // Both systems are now permanently removed. Snapshots should only reflect real transactions.
      const phantomCategories = ['Opening Balance', 'Balance Adjustment'];
      if (phantomCategories.includes(record.category)) return;

      const person = record.person_name || record.description || record.note || '—';
      const category = record.category || record.type || table;
      // ✅ Deferred Snapshot: snapshot নেওয়া হবে updateAccountBalance() complete হওয়ার পরে।
      // এটা pure screenshot — accounts.balance সরাসরি পড়ে, কোনো calculation নেই।
      // _pendingSnapshot: true মানে balance update এখনো pending আছে।
      const _mid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const entry = {
        _mid,
        date: new Date().toLocaleString(),
        action,
        type: record.type,
        category: String(category).slice(0, 100),
        person: String(person).slice(0, 100),
        amount: Number(record.amount || 0),
        method: record.method || '',
        table,
        item: _recycleDisplayName(table, record),
        recordId: record.id,
        recordAt: record.created_at || record.updated_at || record.date || null,
        snapshot: {},
        _pendingSnapshot: true,
      };
      const arr = (() => { try { return JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]'); } catch { return []; } })();
      arr.unshift(entry);
      if (arr.length > 15) arr.length = 15;

      // Try to save — handle localStorage quota errors gracefully
      try {
        localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
      } catch (quotaErr) {
        console.warn('[DataMonitor] localStorage quota hit, trimming old entries...', quotaErr?.message);
        while (arr.length > 1) {
          arr.pop();
          try {
            localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
            break;
          } catch { /* keep trimming */ }
        }
      }

      // Fallback: loan types বা balance-neutral entries-এর জন্য যেখানে
      // updateAccountBalance() call নাও হতে পারে — 2s পরে finalize করো
      // ✅ Fix: was 500ms, raced with async balance update → false mismatch alerts.
      // isFallback=true tells _finalizeMonitorSnapshot to skip mismatch comparison.
      setTimeout(() => _finalizeMonitorSnapshot(_mid, true), 2000);
    } catch (err) {
      console.error('[DataMonitor] _logRecentChange failed:', err?.message || err);
    }
  }

  const _MONITOR_INCOME_TYPES  = ['income', 'transfer in', 'loan receiving', 'investment in'];
  const _MONITOR_EXPENSE_TYPES = ['expense', 'transfer out', 'loan giving', 'investment out'];

  function _financeRecordSortKey(f) {
    const t = new Date(f.created_at || f.updated_at || f.date || 0).getTime();
    return { t: Number.isFinite(t) ? t : 0, id: String(f.id || '') };
  }

  function _compareFinanceRecords(a, b) {
    const ka = _financeRecordSortKey(a);
    const kb = _financeRecordSortKey(b);
    if (ka.t !== kb.t) return ka.t - kb.t;
    return ka.id.localeCompare(kb.id);
  }

  function _balanceDirForFinance(record) {
    const t = String(record.type || '').toLowerCase();
    if (_MONITOR_INCOME_TYPES.includes(t)) return 'in';
    if (_MONITOR_EXPENSE_TYPES.includes(t)) return 'out';
    return null;
  }

  function _normalizeMonitorAccounts(accounts) {
    const seen = new Set();
    return accounts.filter(a => {
      const name = String(a.name || '').trim();
      if (a.type === 'Cash' && name !== 'Cash') return false;
      if (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') {
        if (!name || /^\d+$/.test(name)) return false;
      }
      const key = `${a.type}||${name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function _accountMethodName(a) {
    return a.type === 'Cash' ? 'Cash' : (a.name || 'Cash');
  }

  /** Account balances at a point in time (undo ledger entries after cutoffIndex). */
  function _accountBalancesAtCutoff(sorted, cutoffIndex, baseAccounts) {
    const balances = new Map();
    baseAccounts.forEach(a => balances.set(_accountMethodName(a), Number(a.balance || 0)));
    for (let i = sorted.length - 1; i > cutoffIndex; i--) {
      const f = sorted[i];
      // ✅ Fix: Skip phantom entries when reconstructing historical balances
      if (f.category === 'Opening Balance' || f.category === 'Balance Adjustment') continue;
      const amount = Number(f.amount || 0);
      if (amount <= 0) continue;
      const dir = _balanceDirForFinance(f);
      if (!dir) continue;
      const method = f.method || 'Cash';
      const cur = balances.get(method) ?? 0;
      balances.set(method, dir === 'in' ? cur - amount : cur + amount);
    }
    return balances;
  }

  /**
   * Dashboard-style snapshot as of one finance transaction (inclusive).
   * @param {object} record — finance_ledger row
   * @param {string} action — insert | update | delete | restore
   */
  function _buildMonitorSnapshotAtRecord(record, action = 'insert') {
    try {
      if (!record) return _getMonitorSnapshot();

      const students    = getAll(DB.students);
      const allFinance  = getAll(DB.finance);
      const baseAccounts = _normalizeMonitorAccounts(getAll(DB.accounts));
      const cfg = (() => { try { return (getAll(DB.settings) || [])[0] || {}; } catch { return {}; } })();

      const sorted = [...allFinance];
      if (action === 'delete' && record.id) sorted.push(record);
      sorted.sort(_compareFinanceRecords);

      let cutoffIndex = sorted.findIndex(f => f.id && record.id && f.id === record.id);
      if (cutoffIndex < 0) {
        const cut = _financeRecordSortKey(record);
        cutoffIndex = -1;
        for (let i = 0; i < sorted.length; i++) {
          const k = _financeRecordSortKey(sorted[i]);
          if (k.t < cut.t || (k.t === cut.t && k.id <= cut.id)) cutoffIndex = i;
        }
      }

      const upTo = sorted.slice(0, Math.max(0, cutoffIndex) + 1);
      // ✅ Fix: Exclude phantom categories from income/expense snapshot calculations.
      // Opening Balance and Balance Adjustment entries were never real money movements.
      const _isPhantom = f => f.category === 'Opening Balance' || f.category === 'Balance Adjustment';

      // ✅ Fix: Income/Expense reporting matches finance tab summary cards:
      // Only true 'Income' and 'Expense' types count — not Investment, Transfer, or Loan.
      // These other types affect account balance (handled by _accountBalancesAtCutoff),
      // but are not P&L income or expense (same as finance.js lines 54-55).
      const snapIncome  = upTo.filter(f => String(f.type).toLowerCase() === 'income' && !_isPhantom(f))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const snapExpense = upTo.filter(f => String(f.type).toLowerCase() === 'expense' && !_isPhantom(f))
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      const balanceMap = _accountBalancesAtCutoff(sorted, cutoffIndex, baseAccounts);
      const accountList = baseAccounts.map(a => {
        const method = _accountMethodName(a);
        return {
          name: a.name || a.account_name || 'Account',
          balance: Math.round((balanceMap.get(method) ?? Number(a.balance || 0)) * 100) / 100,
          type: a.type || '',
        };
      });
      const totalBalance = accountList.reduce((s, a) => s + a.balance, 0);

      const cutoffMs = _financeRecordSortKey(record).t;
      const studentsAtTime = cutoffMs
        ? students.filter(s => {
            const c = new Date(s.created_at || s.admission_date || 0).getTime();
            return !Number.isFinite(c) || c <= cutoffMs;
          })
        : students;

      const runningBatch = cfg.running_batch || '';
      const normBatch = v => String(v || '').trim().replace(/^batch\s*/i, '').toLowerCase();
      const batchStudents = runningBatch
        ? studentsAtTime.filter(s => normBatch(s.batch) === normBatch(runningBatch) && s.status !== 'Inactive')
        : [];
      const batchCollection = batchStudents.reduce((s, st) => s + Number(st.paid || 0), 0);
      const normDate = d => {
        if (!d) return '';
        const str = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const p = str.split('/');
        if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        const dt = new Date(str);
        return isNaN(dt) ? '' : dt.toISOString().split('T')[0];
      };
      const expStart = normDate(cfg.expense_start_date);
      const cutoffDate = cutoffMs ? new Date(cutoffMs).toISOString().split('T')[0] : '';
      const batchExpense = expStart && cutoffDate
        ? upTo.filter(f => {
            if (!_MONITOR_EXPENSE_TYPES.includes(String(f.type).toLowerCase())) return false;
            const fd = normDate(f.date);
            if (!fd || fd < expStart || fd > cutoffDate) return false;

            // ✅ Exclude other batch expenses
            if (runningBatch) {
              const desc = String(f.description || '').toLowerCase();
              const note = String(f.note || '').toLowerCase();
              const cat  = String(f.category || '').toLowerCase();
              const text = `${desc} ${note} ${cat}`;
              const m = text.match(/(?:batch|b\s*[-_]?)\s*(\d+)/i);
              if (m) {
                const bNum = m[1];
                if (String(bNum) !== String(runningBatch)) return false;
              }
            }
            return true;
          }).reduce((s, f) => s + Number(f.amount || 0), 0)
        : upTo.filter(f => {
            if (!_MONITOR_EXPENSE_TYPES.includes(String(f.type).toLowerCase())) return false;

            // ✅ Exclude other batch expenses
            if (runningBatch) {
              const desc = String(f.description || '').toLowerCase();
              const note = String(f.note || '').toLowerCase();
              const cat  = String(f.category || '').toLowerCase();
              const text = `${desc} ${note} ${cat}`;
              const m = text.match(/(?:batch|b\s*[-_]?)\s*(\d+)/i);
              if (m) {
                const bNum = m[1];
                if (String(bNum) !== String(runningBatch)) return false;
              }
            }
            return true;
          }).reduce((s, f) => s + Number(f.amount || 0), 0);

      return {
        students: {
          totalStudents: studentsAtTime.length,
          totalFee:  studentsAtTime.reduce((s, r) => s + Number(r.total_fee || 0), 0),
          totalPaid: studentsAtTime.reduce((s, r) => s + Number(r.paid || 0), 0),
          totalDue:  studentsAtTime.reduce((s, r) => s + Number(r.due  || 0), 0),
        },
        accounts: {
          count: baseAccounts.length,
          totalBalance: Math.round(totalBalance * 100) / 100,
          list: accountList,
        },
        finance: { totalIncome: snapIncome, totalExpense: snapExpense },
        batch: {
          name: runningBatch,
          students: batchStudents.length,
          collection: batchCollection,
          expense: batchExpense,
          net: batchCollection - batchExpense,
        },
        recordedAt: record.created_at || record.updated_at || record.date || new Date().toISOString(),
        atRecordId: record.id || null,
        atAction: action,
      };
    } catch (e) {
      console.warn('[DataMonitor] buildMonitorSnapshotAtRecord failed:', e?.message || e);
      return _getMonitorSnapshot();
    }
  }

  function _getMonitorSnapshot() {
    try {
      const students = getAll(DB.students);
      const finance  = getAll(DB.finance);
      const accounts = getAll(DB.accounts);

      // All-time stats
      const totalStudents = students.length;
      const totalFee  = students.reduce((s, r) => s + Number(r.total_fee || 0), 0);
      const totalPaid = students.reduce((s, r) => s + Number(r.paid || 0), 0);
      const totalDue  = students.reduce((s, r) => s + Number(r.due  || 0), 0);
      // ✅ Fix: Income/Expense reporting matches finance tab summary cards:
      // Only true 'Income' and 'Expense' types count — not Investment, Transfer, or Loan.
      // These other types affect account balance but are not P&L income or expense.
      const _isPhantomEntry = f => f.category === 'Opening Balance' || f.category === 'Balance Adjustment';
      const totalIncome  = finance.filter(f => String(f.type).toLowerCase() === 'income'  && !_isPhantomEntry(f)).reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalExpense = finance.filter(f => String(f.type).toLowerCase() === 'expense' && !_isPhantomEntry(f)).reduce((s, r) => s + Number(r.amount || 0), 0);

      // Account balances — read DIRECTLY from accounts.balance (same as dashboard)
      // No recalculation. Whatever is stored is what's shown.
      const cleanAccounts = _normalizeMonitorAccounts(accounts);
      const accountBalance = cleanAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);
      const accountList = cleanAccounts.map(a => ({ name: a.name || a.account_name || 'Account', balance: Number(a.balance || 0), type: a.type || '' }));

      // Running Batch stats — read from settings so snapshot is accurate
      const cfg = (() => { try { return (getAll(DB.settings) || [])[0] || {}; } catch { return {}; } })();
      const runningBatch = cfg.running_batch || '';
      const normBatch = v => String(v || '').trim().replace(/^batch\s*/i, '').toLowerCase();
      const batchStudents = runningBatch
        ? students.filter(s => normBatch(s.batch) === normBatch(runningBatch) && s.status !== 'Inactive')
        : [];
      const batchCollection = batchStudents.reduce((s, st) => s + Number(st.paid || 0), 0);
      const normDate = d => {
        if (!d) return '';
        const str = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const p = str.split('/');
        if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        const dt = new Date(str);
        return isNaN(dt) ? '' : dt.toISOString().split('T')[0];
      };
      const expStart = normDate(cfg.expense_start_date);
      const today = new Date().toISOString().split('T')[0];
      // batchExpense also uses only 'expense' type for P&L consistency
      const batchExpense = expStart
        ? finance.filter(f => {
            if (String(f.type).toLowerCase() !== 'expense') return false;
            const fd = normDate(f.date);
            if (!fd || fd < expStart || fd > today) return false;

            // ✅ Exclude other batch expenses
            if (runningBatch) {
              const desc = String(f.description || '').toLowerCase();
              const note = String(f.note || '').toLowerCase();
              const cat  = String(f.category || '').toLowerCase();
              const text = `${desc} ${note} ${cat}`;
              const m = text.match(/(?:batch|b\s*[-_]?)\s*(\d+)/i);
              if (m) {
                const bNum = m[1];
                if (String(bNum) !== String(runningBatch)) return false;
              }
            }
            return true;
          }).reduce((s, f) => s + Number(f.amount || 0), 0)
        : finance.filter(f => {
            if (String(f.type).toLowerCase() !== 'expense') return false;
            
            // ✅ Exclude other batch expenses
            if (runningBatch) {
              const desc = String(f.description || '').toLowerCase();
              const note = String(f.note || '').toLowerCase();
              const cat  = String(f.category || '').toLowerCase();
              const text = `${desc} ${note} ${cat}`;
              const m = text.match(/(?:batch|b\s*[-_]?)\s*(\d+)/i);
              if (m) {
                const bNum = m[1];
                if (String(bNum) !== String(runningBatch)) return false;
              }
            }
            return true;
          }).reduce((s, f) => s + Number(f.amount || 0), 0);

      return {
        students: { totalStudents, totalFee, totalPaid, totalDue },
        accounts: { count: cleanAccounts.length, totalBalance: accountBalance, list: accountList },
        finance:  { totalIncome, totalExpense },
        batch: {
          name:       runningBatch,
          students:   batchStudents.length,
          collection: batchCollection,
          expense:    batchExpense,
          net:        batchCollection - batchExpense,
        },
        recordedAt: new Date().toISOString(),
      };
    } catch {
      return { students: {}, accounts: {}, finance: {}, batch: {}, recordedAt: new Date().toISOString() };
    }
  }
    function _getActivityLogs() {
    try { return JSON.parse(localStorage.getItem('wfa_activity_log') || '[]'); }
    catch { return []; }
  }

  // ══════════════════════════════════════════════════════════════
  // Activity Log — Supabase Cloud Sync (All Devices)
  // ══════════════════════════════════════════════════════════════
  // প্রতিটি activity log entry Supabase 'activity_log' table-এ push হবে।
  // এতে সব device-এ একই activity log দেখা যাবে।
  // Required SQL (run once in Supabase SQL Editor):
  //   CREATE TABLE IF NOT EXISTS activity_log (
  //     id TEXT PRIMARY KEY, action TEXT, type TEXT, description TEXT,
  //     status TEXT DEFAULT 'success', "user" TEXT, device_id TEXT,
  //     time TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  //   );
  //   ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
  //   CREATE POLICY "allow_all" ON activity_log FOR ALL USING (true) WITH CHECK (true);
  // ══════════════════════════════════════════════════════════════

  const _ACTIVITY_TABLE = 'activity_log';
  let _activityTableMissing = false; // once confirmed missing, stop retrying
  let _activityCooldownUntil = 0;   // cooldown to avoid spamming console on network disconnects

  async function _pushActivityToCloud(entry) {
    if (_activityTableMissing) return;
    if (!navigator.onLine) return; // silently skip if offline
    if (Date.now() < _activityCooldownUntil) return; // skip during cooldown

    try {
      const { client } = window.SUPABASE_CONFIG;
      if (!client) return;
      const clean = {
        id:          entry.id,
        action:      entry.action,
        type:        entry.type,
        description: String(entry.description || '').slice(0, 500),
        status:      entry.status || 'success',
        user:        entry.user || 'Admin',
        device_id:   entry.device_id || _deviceId(),
        time:        entry.time,
        created_at:  entry.created_at,
      };
      const { error } = await client.from(_ACTIVITY_TABLE).upsert([clean], { onConflict: 'id' });
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          _activityTableMissing = true;
          console.warn('[ActivityLog] activity_log table not found. Please create it in Supabase.');
          return;
        }
        
        // Network/fetch errors or connection closed
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('connection')) {
          _activityCooldownUntil = Date.now() + 60000;
          console.warn('[ActivityLog] Cloud push failed (network error, will retry in 60s):', error.message);
          return;
        }

        console.warn('[ActivityLog] Cloud push failed:', error.message);
      }
    } catch (e) {
      if (e?.message?.includes('fetch') || e?.message?.includes('network') || e?.message?.includes('connection')) {
        _activityCooldownUntil = Date.now() + 60000;
        console.warn('[ActivityLog] Push error (network error, will retry in 60s):', e?.message || e);
      } else {
        console.warn('[ActivityLog] Push error:', e?.message || e);
      }
    }
  }

  // সব device-এর activity log Supabase থেকে pull করে localStorage-এ merge করে
  async function _pullActivityFromCloud() {
    if (_activityTableMissing) return;
    if (!navigator.onLine) return; // silently skip if offline
    if (Date.now() < _activityCooldownUntil) return; // skip during cooldown

    try {
      const { client } = window.SUPABASE_CONFIG;
      if (!client) return;
      const { data, error } = await client
        .from(_ACTIVITY_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          _activityTableMissing = true;
          return;
        }

        // Network/fetch errors or connection closed
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('connection')) {
          _activityCooldownUntil = Date.now() + 60000;
          console.warn('[ActivityLog] Pull failed (network error, will retry in 60s):', error.message);
          return;
        }

        console.warn('[ActivityLog] Pull failed:', error.message);
        return;
      }
      if (!data || !data.length) return;

      // Local + Cloud merge — union by id, newest first
      const local = _getActivityLogs();
      const mergedMap = new Map(local.map(l => [l.id, l]));
      data.forEach(row => {
        if (!mergedMap.has(row.id)) mergedMap.set(row.id, row);
      });
      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 500);
      localStorage.setItem('wfa_activity_log', JSON.stringify(merged));
    } catch (e) {
      if (e?.message?.includes('fetch') || e?.message?.includes('network') || e?.message?.includes('connection')) {
        _activityCooldownUntil = Date.now() + 60000;
        console.warn('[ActivityLog] Pull error (network error, will retry in 60s):', e?.message || e);
      } else {
        console.warn('[ActivityLog] Pull error:', e?.message || e);
      }
    }
  }

  // Debounce: settings edit logs collapse within 5 sec to avoid duplicate entries
  const _DEDUP_WINDOW_MS = 5000;
  const _DEDUP_TYPES = new Set(['settings', 'category']);

  const _LOG_SKIP_KEYS = new Set(['id', 'created_at', 'updated_at', '_device', '_inserted_at', 'admin_password', 'security_answer']);

  const _TABLE_FIELD_LABELS = {
    finance_ledger: {
      type: 'ধরন', category: 'ক্যাটাগরি', amount: 'পরিমাণ', method: 'পেমেন্ট মাধ্যম',
      date: 'তারিখ', description: 'বিবরণ', note: 'নোট', person_name: 'ব্যক্তি',
    },
    students: {
      name: 'নাম', student_id: 'রেজি. নং', phone: 'ফোন', course: 'কোর্স', batch: 'ব্যাচ',
      total_fee: 'মোট ফি', paid: 'পরিশোধ', due: 'বকেয়া', status: 'স্ট্যাটাস',
    },
    loans: {
      person_name: 'ব্যক্তি', type: 'ধরন', amount: 'পরিমাণ', method: 'মাধ্যম',
      date: 'তারিখ', status: 'স্ট্যাটাস', note: 'নোট',
    },
    salary: {
      staffName: 'স্টাফ', staff_name: 'স্টাফ', month: 'মাস', baseSalary: 'মূল বেতন',
      bonus: 'বোনাস', deduction: 'কাটা', paidAmount: 'পরিশোধ', method: 'মাধ্যম', paid: 'স্ট্যাটাস',
    },
    exams: {
      student_name: 'ছাত্র/ছাত্রী', subject: 'বিষয়', exam_date: 'পরীক্ষার তারিখ',
      grade: 'গ্রেড', marks: 'নম্বর', status: 'স্ট্যাটাস', exam_fee: 'ফি',
    },
    accounts: { name: 'একাউন্ট', balance: 'ব্যালেন্স', type: 'ধরন' },
    attendance: { entityName: 'নাম', date: 'তারিখ', status: 'উপস্থিতি' },
    visitors: { name: 'নাম', phone: 'ফোন', purpose: 'উদ্দেশ্য', status: 'স্ট্যাটাস' },
    staff: { name: 'নাম', role: 'ভূমিকা', phone: 'ফোন', status: 'স্ট্যাটাস' },
    notices: { title: 'শিরোনাম', text: 'বিষয়বস্তু', type: 'ধরন' },
  };

  const _SETTINGS_FIELD_LABELS = {
    academy_name:       'একাডেমির নাম',
    academy_address:    'ঠিকানা',
    academy_phone:      'ফোন',
    academy_email:      'ইমেইল',
    monthly_target:     'মাসিক লক্ষ্য',
    running_batch:      'চলমান ব্যাচ',
    expense_start_date: 'ব্যয় শুরুর তারিখ',
    expense_end_date:   'ব্যয় শেষ তারিখ',
    expense_month:      'ব্যয় মাস',
    theme:              'থিম',
    primary_color:      'প্রাইমারি রঙ',
    currency:           'মুদ্রা',
    timezone:           'টাইমজোন',
    logo_url:           'লোগো',
    income_categories:  'আয়ের ক্যাটাগরি',
    expense_categories: 'ব্যয়ের ক্যাটাগরি',
    courses:            'কোর্স তালিকা',
    employee_roles:     'কর্মচারীর ভূমিকা',
    admin_username:     'অ্যাডমিন ইউজারনেম',
    exam_questions:     'পরীক্ষার প্রশ্ন',
    exam_settings:      'পরীক্ষা সেটিংস',
  };

  function _isDiagnosticRecord(table, r) {
    if (!r || typeof r !== 'object') return false;
    const studentsTable = (typeof DB !== 'undefined' && DB.students) ? DB.students : 'students';
    const financeTable  = (typeof DB !== 'undefined' && DB.finance) ? DB.finance : 'finance_ledger';
    const salaryTable   = (typeof DB !== 'undefined' && DB.salary) ? DB.salary : 'salary';
    if (table === studentsTable) {
      const sid  = String(r.student_id || '');
      const name = String(r.name || '');
      // ✅ BUG FIX: also recognise DIAG-INST- prefix (Student Installment test)
      if (sid.startsWith('DIAG-TEST-') || sid.startsWith('DIAG-INST-') ||
          name.includes('System Test Student') || name.includes('Diagnostic Installment Student') ||
          r.batch === 'Batch-DIAG' || r.course === 'Diagnostics Course') return true;
    }
    if (table === salaryTable) {
      const sid = String(r.staffId || r.staff_id || '');
      const name = String(r.staffName || r.staff_name || '');
      if (sid === 'DIAG-SAL-STAFF' || name.includes('Diagnostic Test Staff') ||
          r.note === 'Auto-generated diagnostic salary') return true;
    }
    const examsTable = (typeof DB !== 'undefined' && DB.exams) ? DB.exams : 'exams';
    if (table === examsTable) {
      if (String(r.student_id || '').startsWith('DIAG-EXAM-') ||
          String(r.student_name || '').includes('Diagnostic Exam Student') ||
          r.note === 'Auto-generated diagnostic exam') return true;
    }
    const loansTable = (typeof DB !== 'undefined' && DB.loans) ? DB.loans : 'loans';
    if (table === loansTable) {
      if (String(r.person_name || '').includes('Diagnostic Loan Person') ||
          r.note === 'Auto-generated diagnostic loan' ||
          r.note === 'Auto-generated diagnostic loan [UPDATED]') return true;
    }
    if (table === financeTable) {
      if (r.note === 'Auto-generated diagnostic payment') return true;
      if (r.note === 'Auto-generated diagnostic salary payment') return true;
      if (r.note === 'Auto-generated diagnostic exam payment') return true;
      if (r.note === 'Auto-generated diagnostic loan finance') return true;
      const ref = String(r.ref_id || '');
      if (ref && ref.length > 10) {
        const st = getAll(studentsTable).find(s => s.id === ref);
        if (st && _isDiagnosticRecord(studentsTable, st)) return true;
        const sal = getAll(salaryTable).find(s => s.id === ref);
        if (sal && _isDiagnosticRecord(salaryTable, sal)) return true;
        const ex = getAll(examsTable).find(e => e.id === ref);
        if (ex && _isDiagnosticRecord(examsTable, ex)) return true;
        const ln = getAll(loansTable).find(l => l.id === ref);
        if (ln && _isDiagnosticRecord(loansTable, ln)) return true;
      }
    }
    return false;
  }

  let _activityLogSuppressDepth = 0;

  function _beginActivityLogSuppress() {
    _activityLogSuppressDepth++;
    return () => {
      if (_activityLogSuppressDepth > 0) _activityLogSuppressDepth--;
    };
  }

  async function _runWithoutActivityLog(fn) {
    const end = _beginActivityLogSuppress();
    try {
      return await fn();
    } finally {
      end();
    }
  }

  function _isDiagnosticActivity(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const desc = String(entry.description || '');
    if (/DIAG-TEST-/i.test(desc)) return true;
    if (/DIAG-INST-/i.test(desc)) return true;
    if (/DIAG-EXAM-/i.test(desc)) return true;
    if (/DIAG-SAL-/i.test(desc)) return true;
    if (/System Test Student/i.test(desc)) return true;
    if (/Diagnostic Installment Student/i.test(desc)) return true;
    if (/Diagnostic Exam Student/i.test(desc)) return true;
    if (/Diagnostic Loan Person/i.test(desc)) return true;
    if (/Auto-generated diagnostic/i.test(desc)) return true;
    if (/Diagnostic Test Staff/i.test(desc)) return true;
    if (/Batch-DIAG|Diagnostics Course/i.test(desc)) return true;
    return false;
  }

  // পুরনো/স্বয়ংক্রিয় জেনেরিক সেটিংস লগ — বিস্তারিত ছাড়া, UI-তে দেখানো হবে না
  function _isVagueSettingsActivity(entry) {
    if (!entry || entry.type !== 'settings') return false;
    const desc = String(entry.description || '').trim();
    if (/একাডেমি সেটিংস আপডেট\s*—/i.test(desc)) return false;
    if (/সেটিংস আপডেট\s*—/i.test(desc)) return false;
    const vague = [
      /^সেটিংস-এ তথ্য আপডেট করা হয়েছে\s*—\s*একাডেমি সেটিংস$/i,
      /^সেটিংস-এ নতুন এন্ট্রি যোগ করা হয়েছে\s*—\s*একাডেমি সেটিংস$/i,
      /^Updated academy info$/i,
    ];
    return vague.some((re) => re.test(desc));
  }

  function _shouldHideActivity(entry) {
    return _isDiagnosticActivity(entry) || _isVagueSettingsActivity(entry);
  }

  function _fmtLogVal(v) {
    if (v == null || v === '') return '(খালি)';
    if (typeof v === 'number') return String(v);
    const s = String(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  }

  function _describeFieldChanges(table, oldRow, partial) {
    if (!partial || typeof partial !== 'object') return '';
    const parts = [];
    for (const key of Object.keys(partial)) {
      if (_LOG_SKIP_KEYS.has(key)) continue;
      const oldVal = oldRow ? oldRow[key] : undefined;
      const newVal = partial[key];
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
      const settingsTable = (typeof DB !== 'undefined' && DB.settings) ? DB.settings : 'settings';
      const tableLabels = _TABLE_FIELD_LABELS[table] || {};
      const label = (table === 'settings' || table === settingsTable)
        ? (_SETTINGS_FIELD_LABELS[key] || key)
        : (tableLabels[key] || key);
      parts.push(`${label}: "${_fmtLogVal(oldVal)}" → "${_fmtLogVal(newVal)}"`);
    }
    return parts.join('; ');
  }

  function _logActivity(action, type, description, status = 'success') {
    try {
      if (_activityLogSuppressDepth > 0) return;
      if (_shouldHideActivity({ type, description })) return;

      const now = new Date();
      const nowMs = now.getTime();

      // ── Deduplicate: suppress rapid-fire same action+type for settings/category ──
      if (_DEDUP_TYPES.has(type) && action === 'edit') {
        const existing = _getActivityLogs();
        const last = existing[0];
        if (last && last.action === action && last.type === type) {
          const lastMs = new Date(last.created_at || 0).getTime();
          if (nowMs - lastMs < _DEDUP_WINDOW_MS) {
            return; // Skip — same settings save within 5 seconds
          }
        }
      }

      const entry = {
        id:         generateId(),
        action,
        type,
        description,
        status,
        user:       (window.SessionStore && SessionStore.getUserName()) || localStorage.getItem('wfa_user_name') || 'Admin',
        device_id:  _deviceId(),
        time:       now.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        created_at: now.toISOString(),
      };
      const logs = _getActivityLogs();
      logs.unshift(entry);
      if (logs.length > 500) logs.length = 500;
      localStorage.setItem('wfa_activity_log', JSON.stringify(logs));
      // Async push to Supabase — fire and forget
      _pushActivityToCloud(entry);
    } catch { /* ignore */ }
  }

  function _deviceId() {
    let id = localStorage.getItem('wfa_device_id');
    if (!id) {
      id = 'DEV_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem('wfa_device_id', id);
    }
    return id;
  }

  function _trackDeletion(table, id) {
    // ✅ Bug #14 Fix: write to IDB (deleted_items) so reads in getDeletedIds/
    //    clearDeletedIds/untrackDeletion stay consistent (they all read from IDB).
    try {
      let deleted = ((getAll('deleted_items') || [])[0] || {});
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      if (!deleted[table]) deleted[table] = [];
      if (!deleted[table].includes(id)) deleted[table].push(id);
      setAll('deleted_items', [deleted]);
    } catch { /* ignore */ }
  }

  function getDeletedIds(table) {
    try {
      const deleted = ((getAll('deleted_items') || [])[0] || {});
      if (Array.isArray(deleted) || typeof deleted !== 'object') return [];
      const arr = deleted[table];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function clearDeletedIds(table) {
    try {
      let deleted = ((getAll('deleted_items') || [])[0] || {});
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      delete deleted[table];
      setAll('deleted_items', [deleted]);
    } catch { /* ignore */ }
  }

  function untrackDeletion(table, id) {
    try {
      let deleted = ((getAll('deleted_items') || [])[0] || {});
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      if (!Array.isArray(deleted[table])) return;
      deleted[table] = deleted[table].filter((x) => x !== id);
      if (deleted[table].length === 0) delete deleted[table];
      setAll('deleted_items', [deleted]);
    } catch { /* ignore */ }
  }

  const RECYCLE_MAX = 500;

  function _recycleTypeLabel(table) {
    const map = {
      students: 'student',
      finance_ledger: 'transaction',
      accounts: 'account',
      loans: 'loan',
      exams: 'exam',
      staff: 'staff',
      salary: 'salary',
      attendance: 'attendance',
      visitors: 'visitor',
      notices: 'notice',
      settings: 'settings',
      keep_records: 'note',
      advance_payments: 'advance',
      investments: 'investment',
      settings_category: 'category',
      settings_subaccount: 'sub-account',
    };
    return map[table] || 'record';
  }

    function _recycleDisplayName(table, r) {
    if (!r || typeof r !== 'object') return '—';
    switch (table) {
      case 'students':
        return r.name ? (r.name + (r.student_id ? ' (' + r.student_id + ')' : '')) : (r.student_id || '—');
      case 'finance_ledger':
        return (r.type && r.amount != null)
          ? ((r.category || r.type) + ' — ৳' + Number(r.amount).toLocaleString() + (r.method ? ' (' + r.method + ')' : ''))
          : (r.description || '—');
      case 'loans':
        return r.person_name ? (r.person_name + ' — ৳' + Number(r.amount || 0).toLocaleString() + ' (' + (r.type || 'Loan') + ')') : '—';
      case 'accounts':
        return r.name ? (r.name + ' (ব্যালেন্স: ৳' + Number(r.balance || 0).toLocaleString() + ')') : '—';
      case 'staff':
        return r.name ? (r.name + (r.role ? ' — ' + r.role : '')) : '—';
      case 'salary':
        return (r.staff_name || r.staffName)
          ? ((r.staff_name || r.staffName) + ' — ৳' + Number(r.net_salary || r.amount || 0).toLocaleString() + ' (' + (r.month || '') + ')')
          : '—';
      case 'exams':
        return r.student_name
          ? (r.student_name + (r.subject ? ' — ' + r.subject : '') + (r.marks != null ? ' (' + r.marks + '%)' : ''))
          : (r.reg_id || '—');
      case 'attendance':
        return (r.entityName || r.person_name) ? ((r.entityName || r.person_name) + ' — ' + (r.date || '') + ' (' + (r.status || '') + ')') : '—';
      case 'visitors':
        return r.name ? (r.name + (r.phone ? ' (' + r.phone + ')' : '') + (r.purpose ? ' — ' + r.purpose : '')) : '—';
      case 'notices':
        return r.title ? ('"' + r.title + '"') : '—';
      case 'settings':
        return 'একাডেমি সেটিংস';
      case 'advance_payments':
        return r.person ? (r.person + ' — ৳' + Number(r.amount || 0).toLocaleString() + (r.date ? ' (' + r.date + ')' : '')) : '—';
      case 'investments':
        return r.source ? (r.source + ' — ৳' + Number(r.amount || 0).toLocaleString() + (r.date ? ' (' + r.date + ')' : '')) : '—';
      case 'settings_category':
        return r.item ? (r.item + (r.key ? ' (' + r.key + ')' : '')) : '—';
      case 'settings_subaccount':
        return r.username ? ('@' + r.username + (r.role ? ' — ' + r.role : '')) : '—';
      case 'keep_records':
        return r.title ? ('"' + r.title + '"' + (r.date ? ' (' + r.date + ')' : '')) : '—';
      default:
        return r.name || r.title || r.description || r.person_name || '—';
    }
  }

  function _tableDisplayName(table) {
    const map = {
      students:       'ছাত্র/ছাত্রী তালিকা',
      finance_ledger: 'আয়-ব্যয় লেজার',
      accounts:       'একাউন্ট রেজিস্টার',
      loans:          'লোন রেজিস্টার',
      exams:          'পরীক্ষা তালিকা',
      staff:          'স্টাফ তালিকা',
      salary:         'বেতন রেজিস্টার',
      attendance:     'উপস্থিতি',
      visitors:       'ভিজিটর লগ',
      notices:        'নোটিশ বোর্ড',
      settings:       'সেটিংস',
      keep_records:   'Keep Record নোট',
      advance_payments: 'অগ্রিম পেমেন্ট',
      investments:    'বিনিয়োগ রেজিস্টার',
    };
    return map[table] || table;
  }

  function _humanReadableLog(action, table, r, ctx = {}) {
    const label    = _tableDisplayName(table);
    const itemName = _recycleDisplayName(table, r);
    switch (action) {
      case 'add': {
        if (table === 'finance_ledger' || table === (typeof DB !== 'undefined' && DB.finance)) {
          const who = r.person_name || r.description || '';
          return `আয়-ব্যয় লেজারে যোগ: ${r.category || r.type || '—'} — ${r.type || ''} ৳${Number(r.amount || 0).toLocaleString()}${r.method ? ' (' + r.method + ')' : ''}${who ? ' — ' + who : ''}${r.date ? ' — তারিখ: ' + r.date : ''}`;
        }
        return label + '-এ নতুন এন্ট্রি যোগ করা হয়েছে — ' + itemName;
      }
      case 'edit': {
        const changes = _describeFieldChanges(table, ctx.old, ctx.partial);
        if (changes) {
          if (table === 'settings' || table === (typeof DB !== 'undefined' && DB.settings)) {
            return 'সেটিংস আপডেট — ' + changes;
          }
          return label + '-এ আপডেট — ' + itemName + ' (' + changes + ')';
        }
        return label + '-এ তথ্য আপডেট করা হয়েছে — ' + itemName;
      }
      case 'delete':  return label + ' থেকে মুছে ফেলা হয়েছে — ' + itemName;
      case 'restore': return 'রিসাইকেল বিন থেকে পুনরুদ্ধার করা হয়েছে — ' + itemName + ' (' + label + ')';
      default:        return label + ': ' + itemName;
    }
  }

  function _addToRecycleBin(table, record) {
    try {
      const bin = getAll('recycle_bin');
      if (!Array.isArray(bin)) return;
      bin.unshift({
        table,
        // ✅ Fix #4: structuredClone is safer than JSON.parse(JSON.stringify()) for deep cloning
        data: (typeof structuredClone === 'function') ? structuredClone(record) : JSON.parse(JSON.stringify(record)),
        deletedAt: new Date().toISOString(),
        type: _recycleTypeLabel(table),
        name: _recycleDisplayName(table, record),
        tableLabel: _tableDisplayName(table),
      });
      if (bin.length > RECYCLE_MAX) bin.length = RECYCLE_MAX;
      setAll('recycle_bin', bin);
      _syncRecycleBinToSettings();
    } catch (e) {
      console.warn('[Recycle] add failed:', e);
    }
  }

  function _syncRecycleBinToSettings() {
    if (typeof window.SettingsModule !== 'undefined' && typeof window.SettingsModule.syncRecycleBin === 'function') {
      try {
        window.SettingsModule.syncRecycleBin();
      } catch (e) {
        console.warn('[Sync] recycle bin sync failed:', e);
      }
    }
  }

  function _salaryMonthLabelForMatch(ym) {
    if (!ym) return '';
    const parts = ym.split('-');
    const months = ['January','February','March','April','May','June',
      'July','August','September','October','November','December'];
    return (months[parseInt(parts[1], 10) - 1] || '?') + ' ' + parts[0];
  }

  function _matchesSalaryFinance(f, salaryRecord) {
    if (!f || f.category !== 'Salary' || f.type !== 'Expense') return false;
    if (!salaryRecord) return false;
    if (salaryRecord.id && f.ref_id === salaryRecord.id) return true;
    const staff = salaryRecord.staff_name || salaryRecord.staffName || '';
    const month = salaryRecord.month || '';
    if (!staff || !month) return false;
    if ((f.person_name || '') !== staff) return false;
    const desc = f.description || '';
    return desc.indexOf(staff) !== -1 && desc.indexOf(_salaryMonthLabelForMatch(month)) !== -1;
  }

  function _matchesExamFinance(f, exam) {
    if (!f || f.category !== 'Exam Fee' || f.type !== 'Income') return false;
    if (!exam) return false;
    if (exam.id && f.ref_id === exam.id) return true;
    const fee = parseFloat(exam.exam_fee) || 0;
    if (fee <= 0) return false;
    if (Math.abs((parseFloat(f.amount) || 0) - fee) > 0.01) return false;
    const name = exam.student_name || '';
    return !name || (f.description || '').indexOf(name) !== -1;
  }

  function _matchesLoanFinance(f, loan) {
    if (!f || f.category !== 'Loan') return false;
    if (!loan) return false;
    if (loan.id && f.ref_id === loan.id) return true;
    const person = loan.person_name || loan.person || '';
    return (f.person_name === person) &&
      f.type === loan.type &&
      Math.abs((parseFloat(f.amount) || 0) - (parseFloat(loan.amount) || 0)) < 0.01 &&
      f.date === loan.date;
  }

  async function restoreRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin)) {
      console.warn('[Restore] Recycle bin not found or not array');
      return false;
    }
    const item = bin[index];
    if (!item?.table || !item?.data?.id) {
      console.warn('[Restore] Invalid recycle bin item at index', index, ':', item);
      return false;
    }

    const table = item.table;
    const recordId = item.data.id;
    _restoredIds[`${table}:${recordId}`] = Date.now();

    const record = {
      ...item.data,
      updated_at: new Date().toISOString(),
      _device: _deviceId(),
    };

    // Restore to main table first (this is critical)
    let rows = getAll(table);
    
    if (!Array.isArray(rows)) {
      console.error('[Restore] Table', table, 'returned non-array:', rows);
      return false;
    }
    
    // Make a fresh copy to avoid reference issues
    rows = [...rows];
    
    const idx = rows.findIndex((r) => r.id === recordId);
    
    if (idx >= 0) {
      rows[idx] = record;
    } else {
      rows.unshift(record);
    }
    
    setAll(table, rows);

    // Verify the restore locally before pushing to Supabase
    const verifyRows = getAll(table);
    
    const verifyIdx = verifyRows?.findIndex((r) => r?.id === recordId);
    
    if (verifyIdx === -1 || verifyIdx === undefined) {
      console.error('[Restore] FAILED verification - record not in table after restore');
      return false;
    }

    untrackDeletion(table, recordId);
    await _pushRecord(table, record);

    try {
      const r = record;
      const amount = parseFloat(r.amount) || 0;
      const method = r.method || '';

      if (method && amount > 0) {
        if (table === 'finance_ledger') {
          if (!r._isLoan) {
            const isIncome  = r.type === 'Income'  || r.type === 'Transfer In';
            const isExpense = r.type === 'Expense' || r.type === 'Transfer Out';
            // ✅ Restore: Income → 'in' Web-Safe (balance বাড়ে)
            // Expense → 'out' নেগেটিভ হলে ব্যালেন্স skip করো (ডাটা ফিরে আসবে, কিন্তু অ্যাকাউন্ট negative হবে না)
            // ✅ Diagnostic notes — সব ধরনের diagnostic record-এ balance touch করা হবে না
            const _isDiagNote = r.note === 'Auto-generated diagnostic payment'
              || r.note === 'Auto-generated diagnostic exam payment'
              || r.note === 'Auto-generated diagnostic salary payment'
              || r.note === 'Auto-generated diagnostic loan finance';
            if (isIncome && !_isDiagNote)  updateAccountBalance(method, amount, 'in');
            if (isExpense && !_isDiagNote) {
              const _curBal = (function() {
                const accs = getAll('accounts');
                if (method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
                const a = accs.find(x => x.name === method); return a ? parseFloat(a.balance) || 0 : 0;
              })();
              if (_curBal - amount >= 0) {
                updateAccountBalance(method, amount, 'out');
              } else {
                // ✅ ডেটা restore হলো, কিন্তু balance deduct হলো না (নেগেটিভ হয়ে যেত)
                console.warn(`[Restore] Skipped balance deduction for "${method}": balance ৳${_curBal} < amount ৳${amount}`);
                if (typeof Utils !== 'undefined' && Utils.toast) {
                  Utils.toast(`⚠️ Expense restore: "${method}"-এ যথেষ্ট ব্যালেন্স নেই (প্রয়োজন ৳${amount.toLocaleString()}, আছে ৳${_curBal.toLocaleString()})। Record ফিরে এসেছে কিন্তু balance ঠিক করতে হবে।`, 'warning', 7000);
                }
              }
            }

            if (isIncome && r.category === 'Student Fee' && r.ref_id) {
              const students = getAll('students');
              const sIdx = students.findIndex(s => s.id === r.ref_id);
              if (sIdx !== -1) {
                // All finance entries for this student (AFTER restore — entry already back in ledger)
                const allFinance = getAll('finance_ledger');
                const studentPayments = allFinance.filter(f =>
                  f.ref_id === r.ref_id &&
                  f.category === 'Student Fee' &&
                  !f._isLoan
                );
                const ledgerSumAfterRestore = studentPayments.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

                // Ledger sum BEFORE this restore = after - restored amount
                const ledgerSumBeforeRestore = ledgerSumAfterRestore - amount;

                // Preserve any unrecorded initial (s.paid may exceed ledger for legacy/migrated students)
                const currentPaid = parseFloat(students[sIdx].paid) || 0;
                const unrecordedInitial = Math.max(0, currentPaid - ledgerSumBeforeRestore);

                const newTotalPaid = ledgerSumAfterRestore + unrecordedInitial;
                const totalFee = parseFloat(students[sIdx].total_fee) || 0;
                students[sIdx] = {
                  ...students[sIdx],
                  paid: newTotalPaid,
                  due: Math.max(0, totalFee - newTotalPaid),
                  updated_at: new Date().toISOString()
                };
                setAll('students', students);
                await _pushRecord('students', students[sIdx]);
              }
            }
          }
         } else if (table === 'loans') {
          // ✅ Diagnostic loan restore-এ balance update করা হবে না
          if (r.note === 'Auto-generated diagnostic loan' || r.note === 'Auto-generated diagnostic loan [UPDATED]') {
            // skip — diagnostic test data, balance touch করবো না
          } else {
          const wasGiven = r.type === 'Loan Giving' || r.direction === 'given';
          // Loan Giving restore: ব্যালেন্স কমে ('out') — negative হলে warn, skip
          // Loan Receiving restore: ব্যালেন্স বাড়ে ('in') — সবসময় safe
          const _loanDir = wasGiven ? 'out' : 'in';
          if (_loanDir === 'in') {
            updateAccountBalance(method, amount, 'in');
          } else {
            const _loanBal = (function() {
              const accs = getAll('accounts');
              if (method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
              const a = accs.find(x => x.name === method); return a ? parseFloat(a.balance) || 0 : 0;
            })();
            if (_loanBal - amount >= 0) {
              updateAccountBalance(method, amount, 'out');
            } else {
              console.warn(`[Restore-Loan] Balance insufficient for "${method}": ৳${_loanBal} < ৳${amount}`);
              if (typeof Utils !== 'undefined' && Utils.toast) {
                Utils.toast(`⚠️ Loan restore: "${method}"-এ balance যথেষ্ট নেই। Record ফিরে এসেছে, balance manually ঠিক করুন।`, 'warning', 7000);
              }
            }
          }
          } // end diagnostic loan check

          const financeEntries = getAll('finance_ledger').filter(f => _matchesLoanFinance(f, r));
          const linkedFinanceId = financeEntries.length > 0 ? financeEntries[0].id : null;

          if (linkedFinanceId) {
            // Already exists in finance ledger, nothing to do
          } else {
            const allBin = getAll('recycle_bin');
            const linkedInBin = allBin.find(b =>
              b?.table === 'finance_ledger' && _matchesLoanFinance(b.data, r)
            );
            
            if (linkedInBin) {
              // Restore the linked finance entry
              const linkedRecord = {
                ...linkedInBin.data,
                updated_at: new Date().toISOString(),
                _device: _deviceId(),
              };
              _restoredIds[`finance_ledger:${linkedRecord.id}`] = Date.now();
              const finRows = getAll('finance_ledger');
              const fIdx = finRows.findIndex(f => f.id === linkedRecord.id);
              if (fIdx >= 0) finRows[fIdx] = linkedRecord;
              else finRows.unshift(linkedRecord);
              setAll('finance_ledger', finRows);
              untrackDeletion('finance_ledger', linkedRecord.id);
              await _pushRecord('finance_ledger', linkedRecord);
              // ✅ Diagnostic loan finance restore-এ balance update করা হবে না
              // (note চেক — linkedRecord.note === 'Auto-generated diagnostic loan finance')
              
              // Remove from recycle bin
              const freshBin = getAll('recycle_bin');
              const realIdx = freshBin.findIndex(x => x?.data?.id === linkedRecord.id);
              if (realIdx !== -1) freshBin.splice(realIdx, 1);
              setAll('recycle_bin', freshBin);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Restore] Balance update failed:', e);
    }

    // Removed index-based filtering here because it causes index shift issues when linked records are spliced out.
    // The main record is safely removed by ID and table in the Final cleanup block at the end of this function.
    if (!_isDiagnosticRecord(table, record)) {
      _logActivity('restore', table, _humanReadableLog('restore', table, record));
    }

    // ✅ Bug Fix 2 & 4: Restore হলে finance_ledger এবং loans — দুটো table-এর জন্যই
    // monitor-এ log করা হচ্ছে। finance_ledger এর জন্য allowedTypes চেক হবে,
    // loans এর জন্য linked finance entry থাকলে সেটা monitor-এ উঠবে।
    // Restore event সরাসরি একটা synthetic finance entry তৈরি করে monitor-এ দেখাই।
    try {
      if (table === 'finance_ledger') {
        // Finance entry restore — সরাসরি _logRecentChange call করো
        _logRecentChange(table, 'restore', record);
      } else if (table === 'loans') {
        // ✅ Bug Fix 4: Loans restore — linked finance entry খোঁজো এবং monitor-এ দেখাও
        // Loan নিজে finance table নয়, তাই synthetic entry তৈরি করি
        const loanType = String(record.type || '').toLowerCase();
        const syntheticType = (loanType === 'loan giving' || loanType === 'given') ? 'Loan Giving' : 'Loan Receiving';
        const syntheticEntry = {
          type: syntheticType,
          category: 'Loan Restore',
          person_name: record.person_name || record.person || '—',
          amount: record.amount || 0,
          method: record.method || '',
        };
        _logRecentChange('finance_ledger', 'restore', syntheticEntry);
      }
    } catch (e) {
      console.warn('[DataMonitor] restore log failed:', e);
    }

    // ✅ Students restore: linked finance entries (installments) রিসাইকেল বিন থেকে restore করো
    if (table === 'students') {
      try {
        const currentBin = getAll('recycle_bin');
        const linkedFinance = currentBin
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b?.table === 'finance_ledger' && b?.data?.ref_id === record.id && b?.data?.category === 'Student Fee')
          .reverse();

        for (const { b } of linkedFinance) {
          const fr = { ...b.data, updated_at: new Date().toISOString(), _device: _deviceId() };
          _restoredIds[`finance_ledger:${fr.id}`] = Date.now();
          const finRows = getAll('finance_ledger');
          const fIdx = finRows.findIndex(r => r.id === fr.id);
          if (fIdx >= 0) finRows[fIdx] = fr;
          else finRows.unshift(fr);
          setAll('finance_ledger', finRows);
          untrackDeletion('finance_ledger', fr.id);
          await _pushRecord('finance_ledger', fr);
          if (fr.method && parseFloat(fr.amount) > 0) {
            const _frDir = fr.type === 'Income' || fr.type === 'Transfer In' ? 'in' : 'out';
            if (_frDir === 'in') {
              if (fr.note !== 'Auto-generated diagnostic payment') {
                updateAccountBalance(fr.method, parseFloat(fr.amount), 'in');
              }
            } else {
              const _frBal = (function() {
                const accs = getAll('accounts');
                if (fr.method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
                const a = accs.find(x => x.name === fr.method); return a ? parseFloat(a.balance) || 0 : 0;
              })();
              if (_frBal - parseFloat(fr.amount) >= 0) {
                updateAccountBalance(fr.method, parseFloat(fr.amount), 'out');
              } else {
                console.warn(`[Restore-StudentFin] Balance insufficient for "${fr.method}": ৳${_frBal} < ৳${fr.amount}`);
                if (typeof Utils !== 'undefined' && Utils.toast) {
                  Utils.toast(`⚠️ Student finance restore: "${fr.method}"-এ balance যথেষ্ট নেই। Record ফিরে এসেছে।`, 'warning', 7000);
                }
              }
            }
          }
          const freshBin = getAll('recycle_bin');
          const realIdx = freshBin.findIndex(x => x?.data?.id === fr.id);
          if (realIdx !== -1) freshBin.splice(realIdx, 1);
          setAll('recycle_bin', freshBin);
        }

        // ✅ S-1 Fix: After all installments restored, recalculate student paid/due from ledger
        // (covers both bin-restored and already-existing finance entries)
        try {
          const students = getAll('students');
          const sIdx = students.findIndex(s => s.id === record.id);
          if (sIdx !== -1) {
            const allFinance = getAll('finance_ledger');
            const studentPayments = allFinance.filter(f =>
              f.ref_id === record.id &&
              f.category === 'Student Fee' &&
              !f._isLoan
            );
            const ledgerSum = studentPayments.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
            const totalFee = parseFloat(students[sIdx].total_fee) || 0;
            // Preserve any unrecorded initial paid amount (legacy/migrated students)
            const prevPaid = parseFloat(record.paid) || 0;
            const unrecordedInitial = Math.max(0, prevPaid - ledgerSum);
            const newTotalPaid = ledgerSum + unrecordedInitial;
            students[sIdx] = {
              ...students[sIdx],
              paid: newTotalPaid,
              due: Math.max(0, totalFee - newTotalPaid),
              updated_at: new Date().toISOString(),
            };
            setAll('students', students);
            await _pushRecord('students', students[sIdx]);
          }
        } catch (e) {
          console.warn('[Restore] Student paid/due recalculate failed:', e);
        }
      } catch (e) {
        console.warn('[Restore] Student linked finance restore failed:', e);
      }
    }

    // Salary restore: linked Salary finance entries রিসাইকেল বিন থেকে ফিরিয়ে আনো + balance
    if (table === 'salary') {
      try {
        const currentBin = getAll('recycle_bin');
        const linkedFinance = currentBin
          .filter((b) => b?.table === 'finance_ledger' && _matchesSalaryFinance(b.data, record))
          .reverse();

        for (const b of linkedFinance) {
          const fr = { ...b.data, updated_at: new Date().toISOString(), _device: _deviceId() };
          _restoredIds[`finance_ledger:${fr.id}`] = Date.now();
          const finRows = getAll('finance_ledger');
          const fIdx = finRows.findIndex((r) => r.id === fr.id);
          if (fIdx >= 0) finRows[fIdx] = fr;
          else finRows.unshift(fr);
          setAll('finance_ledger', finRows);
          untrackDeletion('finance_ledger', fr.id);
          await _pushRecord('finance_ledger', fr);
          if (fr.method && parseFloat(fr.amount) > 0) {
            // ✅ Diagnostic salary payment restore-এ balance update করা হবে না
            if (fr.note === 'Auto-generated diagnostic salary payment') {
              // skip — diagnostic test data, balance touch করবো না
            } else {
              const _frBal = (function() {
                const accs = getAll('accounts');
                if (fr.method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
                const a = accs.find(x => x.name === fr.method); return a ? parseFloat(a.balance) || 0 : 0;
              })();
              if (_frBal - parseFloat(fr.amount) >= 0) {
                updateAccountBalance(fr.method, parseFloat(fr.amount), 'out');
              } else if (typeof Utils !== 'undefined' && Utils.toast) {
                Utils.toast(`⚠️ Salary finance restore: "${fr.method}"-এ balance যথেষ্ট নেই। Record ফিরে এসেছে।`, 'warning', 7000);
              }
            }
          }
          const freshBin = getAll('recycle_bin');
          const realIdx = freshBin.findIndex((x) => x?.data?.id === fr.id);
          if (realIdx !== -1) freshBin.splice(realIdx, 1);
          setAll('recycle_bin', freshBin);
        }
        if (linkedFinance.length > 0 && typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast('Salary record + linked finance entries restored ✓', 'success');
        }
      } catch (e) {
        console.warn('[Restore] Salary linked finance restore failed:', e);
      }
    }

    // Exam restore: linked Exam Fee income + balance
    if (table === 'exams') {
      try {
        const currentBin = getAll('recycle_bin');
        const linkedFinance = currentBin
          .filter((b) => b?.table === 'finance_ledger' && _matchesExamFinance(b.data, record))
          .reverse();

        for (const b of linkedFinance) {
          const fr = { ...b.data, updated_at: new Date().toISOString(), _device: _deviceId() };
          _restoredIds[`finance_ledger:${fr.id}`] = Date.now();
          const finRows = getAll('finance_ledger');
          const fIdx = finRows.findIndex((row) => row.id === fr.id);
          if (fIdx >= 0) finRows[fIdx] = fr;
          else finRows.unshift(fr);
          setAll('finance_ledger', finRows);
          untrackDeletion('finance_ledger', fr.id);
          await _pushRecord('finance_ledger', fr);
          if (fr.method && parseFloat(fr.amount) > 0) {
            // ✅ Diagnostic exam fee restore-এ balance update করা হবে না
            if (fr.note !== 'Auto-generated diagnostic exam payment') {
              updateAccountBalance(fr.method, parseFloat(fr.amount), 'in');
            }
          }
          const freshBin = getAll('recycle_bin');
          const realIdx = freshBin.findIndex((x) => x?.data?.id === fr.id);
          if (realIdx !== -1) freshBin.splice(realIdx, 1);
          setAll('recycle_bin', freshBin);
        }
      } catch (e) {
        console.warn('[Restore] Exam linked finance restore failed:', e);
      }
    }

    // Final cleanup: remove from recycle bin by id+table (handles index shift edge cases)
    const freshBinFinal = getAll('recycle_bin');
    const finalIdx = freshBinFinal.findIndex(x => x?.data?.id === record.id && x?.table === table);
    console.log(`[Restore] Final cleanup: looking for recycle bin item with id="${record.id}", table="${table}", found at index:`, finalIdx);
    if (finalIdx !== -1) {
      freshBinFinal.splice(finalIdx, 1);
      console.log(`[Restore] Removed from recycle bin`);
    }
    setAll('recycle_bin', freshBinFinal);
    _syncRecycleBinToSettings();
    
    console.log(`[Restore] ✓ Restore complete for table="${table}", recordId="${record.id}"`);

    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore', table } }));
    return true;
  }

  // ✅ Note: _tableDisplayName, _humanReadableLog, _addToRecycleBin, _syncRecycleBinToSettings
  // are defined above (single source of truth) — no duplicate definitions here.

  function permanentDeleteRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin) || index < 0 || index >= bin.length) return;
    const item = bin[index];
    if (!item) return;

    if (item?.table && item?.data?.id) {
      untrackDeletion(item.table, item.data.id);
      if (!_isDiagnosticRecord(item.table, item.data)) {
        _logActivity('delete', item.table, `রিসাইকেল বিন থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে — ${item.name || _recycleDisplayName(item.table, item.data)}`);
      }
    }

    // ✅ BUG #7 FIX: Fresh read করে ID দিয়ে findIndex — index mismatch থেকে রক্ষা
    // আগে সরাসরি bin.splice(index, 1) ছিল — timing mismatch হলে ভুল item delete হত
    const freshBin = getAll('recycle_bin');
    let realIdx = -1;
    if (item?.data?.id) {
      realIdx = freshBin.findIndex(x => x?.data?.id === item.data.id);
    }
    if (realIdx === -1) realIdx = index; // ID না থাকলে fallback

    if (realIdx >= 0 && realIdx < freshBin.length) {
      freshBin.splice(realIdx, 1);
      setAll('recycle_bin', freshBin);
    }
    _syncRecycleBinToSettings();
  }

  function emptyRecycleBin() {
    const bin = getAll('recycle_bin');
    if (Array.isArray(bin)) {
      bin.forEach((item) => {
        if (item?.table && item?.data?.id) untrackDeletion(item.table, item.data.id);
      });
    }
    // ✅ Use IDB (setAll) instead of legacy localStorage
    setAll('recycle_bin', []);
    _syncRecycleBinToSettings();
    _logActivity('delete', 'system', 'Emptied recycle bin');
  }

  const _AUTO_COLS = new Set(['created_at', 'updated_at']);

  const _TABLE_COLS = {
    // ✅ keep_records + recycle_bin_sync added for cross-device sync via settings table
    // Note: admin_pattern & admin_face_descriptor stored in localStorage, not Supabase
    settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username','keep_records','recycle_bin_sync','exam_questions','exam_settings','institution_type','payment_gateway_config','sms_config'],
    salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','paid','method','role','phone','name'],
    students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','mother_name','guardian_phone','roll_no','shift','note'],
    finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
    accounts:      ['id','name','type','balance','description','note'],
    loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
    exams:         ['id','reg_id','student_id','student_name','batch','session','subject', 'exam_date','exam_fee','fee_paid','grade','marks','status','note'],
    attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
    staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note','staffId','staff_id'],
    visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','created_at'],
    notices:       ['id','title','text','type','created_at','updated_at','expires_at','is_pinned'],
    student_portal_access: ['id','student_id','student_name','phone','pin_hash','is_active','created_at'],
    payment_requests: ['id','student_id','student_name','batch_id','amount','method','transaction_id','sender_number','screenshot_url','status','submitted_at','reviewed_at','reviewed_by','note'],
    class_routines: ['id','batch_id','day','start_time','end_time','subject','teacher_id','room','is_active','created_at'],
    school_classes: ['id','class_name','sections','shift','class_teacher','is_active','created_at','updated_at'],
    school_subjects: ['id','class_name','subject_name','full_marks','pass_marks','is_active','created_at','updated_at'],
    school_marks: ['id','student_id','student_no','student_name','class_name','section','roll_no','academic_year','exam_type','subject_id','subject_name','marks_obtained','full_marks','grade','gpa','pass','created_at','updated_at'],
    sms_logs: ['id','recipient','message','type','status','provider_response','sent_at'],
  };

  function _sanitizeRecord(record, tableKey) {
    if (!record || typeof record !== 'object') return record;
    const allowedCols = _TABLE_COLS[tableKey]
      || (typeof SyncEngine !== 'undefined' && SyncEngine.TABLE_COLUMNS && SyncEngine.TABLE_COLUMNS[tableKey])
      || null;
    // ✅ Bug #30 Fix: HTML-escape user strings to block XSS. Structured/binary cols are exempt.
    // ✅ admin_face_descriptor is a JSON float array — must NOT be HTML-escaped
    const _SAFE_COLS = new Set(['admin_password','security_answer','exam_questions','exam_settings','income_categories','expense_categories','courses','employee_roles','keep_records','recycle_bin_sync','admin_face_descriptor']);
    function _esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    const o = {};
    for (const [k, v] of Object.entries(record)) {
      if (v === undefined) continue;
      if (k.startsWith('_')) continue;
      if (_AUTO_COLS.has(k)) continue;
      if (allowedCols && !allowedCols.includes(k)) continue;
      o[k] = (typeof v === 'string' && !_SAFE_COLS.has(k)) ? _esc(v) : v;
    }
    return o;
  }

  const _badCols = {};

  // ✅ Per-table push cooldown — stops flooding console/retry-queue when Supabase
  // repeatedly rejects a table (e.g. 500 from missing columns or oversized payload).
  // After a failure the table is silently skipped for 60 seconds.
  const _pushCooldown = {};
  const PUSH_COOLDOWN_MS = 60000; // 60 seconds

  // Cache to track recently restored record IDs to ignore delayed postgres_changes DELETE events
  const _restoredIds = {};

  // ✅ Large fields that must NOT be sent to Supabase directly via the settings row
  // (they're either too big or managed in separate IDB tables).
  // recycle_bin_sync and keep_records can be hundreds of KB when serialised,
  // causing HTTP 500 / CORS errors on Supabase's PostgREST endpoint.
  const _SETTINGS_STRIP_COLS = new Set([
    'recycle_bin_sync', 'keep_records', 'activity_log', 'snapshots',
    'admin_face_descriptor'
  ]);

  /** Supabase salary table uses basic/total/paid(date) — not base_salary/paidAmount booleans */
  function _normalizeSalaryForCloud(r) {
    if (!r || typeof r !== 'object') return r;
    const base = parseFloat(r.baseSalary ?? r.base_salary ?? r.basic ?? 0) || 0;
    const bonus = parseFloat(r.bonus ?? 0) || 0;
    const deduction = parseFloat(r.deduction ?? 0) || 0;
    const total = parseFloat(r.net_salary ?? r.amount ?? r.total ?? (base + bonus - deduction)) || 0;
    const paidAmt = parseFloat(r.paidAmount ?? r.paid_amount ?? 0) || 0;
    const isFullyPaid = r.paid === true || (total > 0 && paidAmt >= total);
    const isPartial = paidAmt > 0 && !isFullyPaid;

    const o = {
      id: r.id,
      staff_id: r.staffId || r.staff_id || '',
      staff_name: r.staffName || r.staff_name || '',
      month: r.month || null,
      year: r.year != null ? parseInt(r.year, 10) : null,
      basic: base,
      bonus,
      deduction,
      total,
      paid_amount: paidAmt,
      paid: isFullyPaid,
      method: r.method || null,
      date: r.paidDate || r.paid_date || r.date || null,
      status: r.status || (isFullyPaid ? 'Paid' : isPartial ? 'Partial' : 'Pending'),
      note: r.note || null,
    };
    if (r.updated_at) o.updated_at = r.updated_at;
    if (r.created_at) o.created_at = r.created_at;
    return o;
  }

  function _ensureSalaryLocalFields(r) {
    if (!r || typeof r !== 'object') return r;
    const base = parseFloat(r.baseSalary ?? r.base_salary ?? r.basic ?? 0) || 0;
    const bonus = parseFloat(r.bonus ?? 0) || 0;
    const deduction = parseFloat(r.deduction ?? 0) || 0;
    const total = parseFloat(r.net_salary ?? r.amount ?? r.total ?? (base + bonus - deduction)) || 0;
    let paidAmount = parseFloat(r.paidAmount ?? r.paid_amount ?? 0) || 0;
    if (!paidAmount && r.paid === true && total > 0) paidAmount = total;
    r.baseSalary = base;
    r.base_salary = base;
    r.basic = base;
    r.amount = total;
    r.net_salary = total;
    r.total = total;
    r.paidAmount = paidAmount;
    r.paid_amount = paidAmount;
    if (r.paid === undefined) {
      r.paid = total > 0 && paidAmount >= total;
    }
    return r;
  }

  function _normalizeSalaryFromCloud(r) {
    if (!r || typeof r !== 'object') return r;
    const base = parseFloat(r.basic ?? r.baseSalary ?? r.base_salary ?? 0) || 0;
    const total = parseFloat(r.total ?? r.net_salary ?? r.amount ?? 0) || 0;
    let paidAmount = parseFloat(r.paidAmount ?? r.paid_amount ?? 0) || 0;
    if (!paidAmount && r.paid === true && total > 0) paidAmount = total;
    const isPaid = r.paid === true || String(r.status || '').toLowerCase() === 'paid' ||
      (total > 0 && paidAmount >= total);
    const paidDate = r.paidDate || r.paid_date || r.date || '';
    return _ensureSalaryLocalFields({
      ...r,
      staffId: r.staffId || r.staff_id || '',
      staff_id: r.staffId || r.staff_id || '',
      staffName: r.staffName || r.staff_name || '',
      staff_name: r.staffName || r.staff_name || '',
      baseSalary: base,
      base_salary: base,
      basic: base,
      amount: total,
      net_salary: total,
      total,
      paidAmount,
      paid_amount: paidAmount,
      paid: isPaid,
      paidDate,
      paid_date: paidDate,
      date: paidDate,
    });
  }

  /** Supabase fee_paid is numeric — app uses boolean */
  function _normalizeExamForCloud(r) {
    if (!r || typeof r !== 'object') return r;
    const fee = parseFloat(r.exam_fee) || 0;
    let feePaid = r.fee_paid;
    if (feePaid === true) feePaid = fee > 0 ? fee : 1;
    else if (feePaid === false || feePaid == null) feePaid = 0;
    else if (typeof feePaid === 'boolean') feePaid = feePaid ? (fee || 1) : 0;
    else feePaid = parseFloat(feePaid) || 0;

    const o = {
      id: r.id,
      reg_id: r.reg_id || null,
      student_id: r.student_id || null,
      student_name: r.student_name || null,
      batch: r.batch || null,
      session: r.session || null,
      subject: r.subject || null,
      exam_date: r.exam_date || null,
      exam_fee: fee,
      fee_paid: feePaid,
      grade: r.grade || null,
      marks: r.marks != null && r.marks !== '' ? parseFloat(r.marks) : null,
      status: r.status || null,
      note: r.note || null,
    };
    if (r.updated_at) o.updated_at = r.updated_at;
    if (r.created_at) o.created_at = r.created_at;
    return o;
  }

  function _normalizeExamFromCloud(r) {
    if (!r || typeof r !== 'object') return r;
    const _fee = parseFloat(r.exam_fee) || 0; // eslint: intentionally unused (kept for clarity)
    const fp = parseFloat(r.fee_paid);
    const feePaidBool = r.fee_paid === true || (!isNaN(fp) && fp > 0);
    return { ...r, fee_paid: feePaidBool };
  }

  function _salaryTableKey() {
    return (typeof DB !== 'undefined' && DB.salary) ? DB.salary : 'salary';
  }

  function _examsTableKey() {
    return (typeof DB !== 'undefined' && DB.exams) ? DB.exams : 'exams';
  }

  function _prepareRecordForCloud(table, record) {
    if (!record || typeof record !== 'object') return record;

    if (table === _salaryTableKey()) {
      let clean = _normalizeSalaryForCloud(record);
      if (_badCols && _badCols[table]) {
        clean = { ...clean };
        _badCols[table].forEach((c) => delete clean[c]);
      }
      return clean;
    }
    if (table === _examsTableKey()) {
      let clean = _normalizeExamForCloud(record);
      if (_badCols && _badCols[table]) {
        clean = { ...clean };
        _badCols[table].forEach((c) => delete clean[c]);
      }
      return clean;
    }

    let clean = _sanitizeRecord(record, table);
    if (table === 'settings') {
      clean = { ...clean };
      _SETTINGS_STRIP_COLS.forEach(col => delete clean[col]);
      
      const arrayFields = ['income_categories', 'expense_categories', 'courses', 'employee_roles'];
      arrayFields.forEach(field => {
        if (clean[field] !== undefined && (Array.isArray(clean[field]) || typeof clean[field] === 'object')) {
          clean[field] = JSON.stringify(clean[field]);
        }
      });

      const dateFields = ['expense_start_date', 'expense_end_date'];
      dateFields.forEach(field => {
        if (clean[field] === '') clean[field] = null;
      });

      if (clean['monthly_target'] === '') {
        clean['monthly_target'] = null;
      } else if (clean['monthly_target'] !== undefined && clean['monthly_target'] !== null) {
        const parsed = parseFloat(clean['monthly_target']);
        clean['monthly_target'] = isNaN(parsed) ? null : parsed;
      }
    }
    if (_badCols && _badCols[table]) {
      clean = { ...clean };
      _badCols[table].forEach(c => delete clean[c]);
    }
    return clean;
  }

  async function _pushRecord(table, record) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      if (!client) {
        // If Supabase is configured but client is temporarily unavailable, queue for retry
        const hasCreds = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) ||
                         (window.WFA_SUPABASE_SECRETS && window.WFA_SUPABASE_SECRETS.url);
        if (hasCreds) {
          _queueRetry(table, record);
        }
        return;
      }
      // ✅ Cooldown check — skip table if it failed recently to stop console flooding
      const now = Date.now();
      if (_pushCooldown[table] && now - _pushCooldown[table] < PUSH_COOLDOWN_MS) {
        return; // silently skip — still within cooldown window
      }

      let clean = _prepareRecordForCloud(table, record);

      const { error } = await client.from(table).upsert([clean], { onConflict: 'id' });
      if (error) {
        const msg = (error.message || '') + (error.details || '');
        const m = msg.match(/column[^"]*"([^"]+)"/i) || msg.match(/named\s+"([^"]+)"/i);
        if (m && m[1]) {
          const badCol = m[1];
          if (!_badCols[table]) _badCols[table] = new Set();
          _badCols[table].add(badCol);
          delete clean[badCol];
          console.warn(`[Sync] _pushRecord: auto-skip "${badCol}" in "${table}", retrying...`);
          const { error: retryErr } = await client.from(table).upsert([clean], { onConflict: 'id' });
          if (!retryErr) { SyncEngine.setStatus('synced'); return; }
        }
        throw error;
      }
      // Success — clear cooldown for this table
      delete _pushCooldown[table];
      SyncEngine.setStatus('synced');
    } catch (e) {
      // ✅ Record cooldown timestamp so we don't spam console/queue for 60 s
      _pushCooldown[table] = Date.now();
      // Only log once per cooldown window to avoid console flood
      if (!_pushCooldown[`${table}_logged`]) {
        console.warn(`[Sync] Push record failed for "${table}" (will retry in 60s):`, e?.message || e);
        _pushCooldown[`${table}_logged`] = true;
        setTimeout(() => { delete _pushCooldown[`${table}_logged`]; }, PUSH_COOLDOWN_MS);
      }
      SyncEngine.setStatus('error');
      _queueRetry(table, record);
    }
  }

  async function _deleteFromCloud(table, id) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      if (!client) {
        // If Supabase is configured but client is temporarily unavailable, queue for retry
        const hasCreds = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) ||
                         (window.WFA_SUPABASE_SECRETS && window.WFA_SUPABASE_SECRETS.url);
        if (hasCreds) {
          _queueRetry(table, { id, _deleteOnly: true });
        }
        return;
      }
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('[Sync] Delete from cloud failed — queued for retry:', e);
      _queueRetry(table, { id, _deleteOnly: true });
    }
  }

  function _queueRetry(table, record) {
    try {
      // ✅ FIX: Use IndexedDB (persistent) instead of localStorage (5MB limit)
      // Queue records separately for better reliability
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.setAll === 'function') {
        const queue = SupabaseSync.getAll('retry_queue') || [];

        // ✅ Dedup: For single-row tables (settings) or same record ID,
        // replace the existing queued entry instead of appending a duplicate.
        const existIdx = queue.findIndex(q =>
          q.table === table && (
            table === 'settings' ||
            (q.record && record && q.record.id && q.record.id === record.id)
          )
        );
        const entry = { table, record, at: Date.now(), attempts: 0, lastError: null };
        if (existIdx >= 0) {
          queue[existIdx] = entry; // replace, don't append
        } else {
          queue.push(entry);
        }

        // Keep only last 100 retry items to avoid bloating IDB
        if (queue.length > 100) {
          queue.splice(0, queue.length - 100);
        }
        SupabaseSync.setAll('retry_queue', queue);
      } else {
        // Fallback to localStorage only if IDB unavailable
        const queue = (() => { 
          try { 
            return JSON.parse(localStorage.getItem('wfa_retry_queue')) || []; 
          } catch { 
            return []; 
          } 
        })();
        queue.push({ table, record, at: Date.now() });
        (typeof Utils !== 'undefined' && Utils.safeStorageSet)
          ? Utils.safeStorageSet('wfa_retry_queue', JSON.stringify(queue))
          : localStorage.setItem('wfa_retry_queue', JSON.stringify(queue));
      }
    } catch (e) { 
      console.warn('[Sync] Failed to queue retry:', e);
    }
  }

  async function processRetryQueue() {
    try {
      let queue = [];
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.getAll === 'function') {
        queue = SupabaseSync.getAll('retry_queue') || [];
      }
      
      if (!queue.length) return;
      
      const { client } = window.SUPABASE_CONFIG;
      if (!client) return; // Supabase not ready — retry later
      const remaining = [];
      let successCount = 0;
      let droppedCount = 0;
      
      for (const item of queue) {
        try {
          // Track retry attempts
          item.attempts = (item.attempts || 0) + 1;
          
          if (item.record && item.record._deleteOnly === true) {
            const { error } = await client.from(item.table).delete().eq('id', item.record.id);
            if (error) throw error;
            successCount++;
          } else {
            const clean = _prepareRecordForCloud(item.table, item.record);
            const { error } = await client.from(item.table).upsert([clean], { onConflict: 'id' });
            if (error) throw error;
            successCount++;
          }
        } catch (e) { 
          // Keep failed items for next retry (max 5 attempts)
          if ((item.attempts || 0) < 5) {
            item.lastError = e.message;
            remaining.push(item);
          } else {
            droppedCount++;
            console.warn(`[Sync] Retry limit exceeded for ${item.table}:`, e);
          }
        }
      }
      
      // Save remaining back to IDB
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.setAll === 'function') {
        SupabaseSync.setAll('retry_queue', remaining);
      }
      
      if (successCount > 0) {
        console.log(`[Sync] Retry queue processed: ${successCount} succeeded, ${remaining.length} remaining`);
      }
      if (droppedCount > 0 && typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`⚠️ ${droppedCount} sync item(s) failed permanently after max retries.`, 'warning', 6000);
      }
    } catch (e) { 
      console.warn('[Sync] processRetryQueue failed:', e);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('❌ Sync retry queue processing failed. Check connection and try Sync now.', 'error', 5000);
      }
    }
  }

  // ── DataMonitor: Deferred Snapshot Finalizer ────────────────────────────────
  // প্রতিটি transaction-এর balance update শেষে এই function-টি call হয়।
  // Pure screenshot: accounts.balance সরাসরি পড়া — কোনো calculation নেই।
  // Automatic mismatch alert: আগের snapshot-এর balance vs নতুন balance compare করে।
  // @param {boolean} isFallback — true = setTimeout fallback call, skip mismatch alert
  function _finalizeMonitorSnapshot(mid, isFallback) {
    try {
      const arr = (() => {
        try { return JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]'); } catch { return []; }
      })();
      if (!arr.length) return;

      // mid দিলে specific entry, না দিলে সবচেয়ে নতুন pending entry
      const idx = (mid !== undefined)
        ? arr.findIndex(e => e._mid === mid && e._pendingSnapshot)
        : arr.findIndex(e => e._pendingSnapshot);
      if (idx < 0) return; // ইতিমধ্যে finalize হয়ে গেছে

      // ✅ Pure screenshot: accounts.balance সরাসরি পড়া
      const newSnapshot = _getMonitorSnapshot();

      // ── Automatic Mismatch Alert ────────────────────────────────────────────
      // আগের entry-র snapshot total vs এই transaction-এর পরের total compare করো।
      // Transfer In/Out বাদ — pair-এ কাজ করে, net change = 0।
      const prev = arr[idx + 1]; // ঠিক আগের entry (পুরনো)
      if (prev && prev.snapshot && prev.snapshot.accounts && newSnapshot.accounts) {
        const prevTotal   = Number(prev.snapshot.accounts.totalBalance || 0);
        const newTotal    = Number(newSnapshot.accounts.totalBalance || 0);
        const actualDelta = newTotal - prevTotal;

        const entry      = arr[idx];
        const entryType  = String(entry.type || '').toLowerCase();
        const _incTypes  = ['income', 'loan receiving', 'investment in'];
        const _outTypes  = ['expense', 'loan giving', 'investment out'];
        const _skipTypes = ['transfer in', 'transfer out']; // pair হয়ে কাজ করে

        if (!_skipTypes.includes(entryType)) {
          let expectedDelta = 0;
          if (_incTypes.includes(entryType))  expectedDelta =  Number(entry.amount || 0);
          if (_outTypes.includes(entryType))  expectedDelta = -Number(entry.amount || 0);

          const mismatch = Math.abs(actualDelta - expectedDelta);
          // ৳1-এর বেশি পার্থক্য = mismatch (floating point tolerance)
          // ✅ Fix: isFallback=true মানে setTimeout fallback থেকে call — balance update
          // শেষ না-ও হতে পারে, তাই mismatch alert দেওয়া হবে না (false positive এড়াতে)
          if (!isFallback && mismatch > 1 && (prevTotal > 0 || newTotal > 0)) {
            try {
              typeof SyncGuard !== 'undefined' && SyncGuard && SyncGuard.report &&
                SyncGuard.report('balance_mismatch', {
                  transaction:    `${entry.type} ৳${Number(entry.amount || 0).toLocaleString()} (${entry.method || '?'})`,
                  prevBalance:    prevTotal,
                  newBalance:     newTotal,
                  expectedChange: expectedDelta,
                  actualChange:   actualDelta,
                  discrepancy:    Math.round(mismatch),
                });
            } catch { /* SyncGuard not ready yet */ }
          }
        }
      }

      arr[idx].snapshot = newSnapshot;
      delete arr[idx]._pendingSnapshot;
      delete arr[idx]._mid; // internal field — UI-তে দরকার নেই

      try { localStorage.setItem('wfa_recent_changes', JSON.stringify(arr)); } catch { /* ignore */ }
    } catch (e) {
      console.warn('[DataMonitor] _finalizeMonitorSnapshot failed:', e?.message || e);
    }
  }

  const _balanceLocks = {};

  // ✅ Req 7: force=true bypasses negative check (for deletion reversals only)
  function updateAccountBalance(methodName, amount, direction, force = false) {
    if (!methodName || !amount || amount <= 0) return;
    const lockKey = methodName;
    if (!_balanceLocks[lockKey]) _balanceLocks[lockKey] = Promise.resolve();
    _balanceLocks[lockKey] = _balanceLocks[lockKey].then(() => {
      return _updateBalanceCore(methodName, amount, direction, force);
    }).catch(e => {
      console.warn('[Sync] updateAccountBalance lock failed:', e);
      SyncGuard && SyncGuard.report('balance_lock_error', { methodName, amount, direction, error: e?.message });
    });
    return _balanceLocks[lockKey];
  }

  async function _updateBalanceCore(methodName, amount, direction, force = false) {
    window._legitimateBalanceChangeInProgress = true;
    try {
      return await _updateBalanceCoreInternal(methodName, amount, direction, force);
    } finally {
      window._legitimateBalanceChangeInProgress = false;
    }
  }

  async function _updateBalanceCoreInternal(methodName, amount, direction, force = false) {
    try {
      const normalizedAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
      if (normalizedAmount <= 0) return false;
      const accounts = getAll('accounts');
      let accountIdx = -1;

      if (methodName === 'Cash') {
        // ✅ Safety: duplicate থাকলেও সবচেয়ে পুরনো (original) Cash account নাও।
        // findIndex() প্রথম element নেয় যা phantom duplicate হতে পারে।
        const cashAccounts = accounts
          .map((a, i) => ({ ...a, _idx: i }))
          .filter(a => a.type === 'Cash' && String(a.name || '').trim() === 'Cash');
        if (cashAccounts.length > 0) {
          // সবচেয়ে পুরনো created_at = আসল account
          cashAccounts.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
          accountIdx = cashAccounts[0]._idx;
        }
      } else {
        accountIdx = accounts.findIndex(a =>
          (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') && a.name === methodName
        );
      }

      if (accountIdx === -1) {
        if (methodName === 'Cash') {
          // ✅ Cash account না থাকলে auto-create করা যাবে না — duplicate তৈরি হয়।
          // AUDIT_IGNORE Section 7: Cash account শুধু Setup Wizard-এ তৈরি হয়।
          // ইউজারকে Accounts ট্যাবে গিয়ে নিজে Cash account দেখতে/যোগ করতে হবে।
          console.warn(`[Sync] ❌ Cash account not found — cannot auto-create (AUDIT_IGNORE policy). Add it manually in Accounts.`);
          if (typeof Utils !== 'undefined' && Utils.toast) {
            Utils.toast('⚠️ Cash account পাওয়া যাচ্ছে না। Accounts ট্যাবে গিয়ে Cash account যোগ করুন।', 'error', 5000);
          }
          return false;
        }
        console.warn(`[Sync] ❌ Account "${methodName}" not found — add it in Accounts first.`);
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(`⚠️ "${methodName}" account নেই — Accounts ট্যাবে আগে যোগ করুন।`, 'error', 5000);
        }
        return false;
      }

      const currentBal = parseFloat(accounts[accountIdx].balance) || 0;
      const newBalRaw = direction === 'in' ? currentBal + normalizedAmount : currentBal - normalizedAmount;
      const newBal = Math.round(newBalRaw * 100) / 100;

      if (newBal < 0 && !force) {
        SyncGuard && SyncGuard.report('negative_balance', {
          account: methodName,
          before: currentBal,
          change: direction === 'in' ? +normalizedAmount : -normalizedAmount,
          after: newBal,
        });
        // ✅ Issue #3: Block update AND show user-facing toast — not just console.warn
        console.warn(`[Sync] ❌ Balance blocked for "${methodName}": ৳${currentBal} - ৳${normalizedAmount} = ৳${newBal}`);
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(`⚠️ Insufficient balance in "${methodName}" (Available: ৳${currentBal.toLocaleString()}, Needed: ৳${normalizedAmount.toLocaleString()})`, 'error', 5000);
        }
        return false;
      }

      accounts[accountIdx] = {
        ...accounts[accountIdx],
        balance: newBal,
        updated_at: new Date().toISOString(),
      };
      setAll('accounts', accounts);
      // ✅ Fix: await _pushRecord so any cloud push errors are caught below,
      // not swallowed as unhandled Promise rejections that trigger balance_update_error.
      await _pushRecord('accounts', accounts[accountIdx]);
      // ✅ Deferred snapshot: balance update সম্পন্ন — এখন DataMonitor snapshot নাও
      // এটা pure screenshot: accounts.balance-এর current state সরাসরি save হবে
      _finalizeMonitorSnapshot();
      return true;
    } catch (e) {
      console.warn('[Sync] _updateBalanceCore failed:', e);
      // ✅ Fix: Only report balance_update_error for genuine local logic failures.
      // Cloud push errors are handled inside _pushRecord (queued for retry) and
      // should NOT surface as balance_update_error — the local balance was already saved.
      if (!(e && (e.code || e.status || e.message?.includes('fetch')))) {
        SyncGuard && SyncGuard.report('balance_update_error', { methodName, amount, direction, error: e?.message });
      }
    }
  }

  /**
   * ✅ DETECT-ONLY — কোনো row create/delete/merge করে না।
   * AUDIT_IGNORE Section 7 অনুযায়ী: duplicate Cash account সনাক্ত করে
   * console.error + toast + custom event fire করে। ইউজার নিজে ভুল row delete করবেন।
   */
  function ensureDefaultCashAccount() {
    const accounts = getAll('accounts');
    const cashAccounts = accounts.filter(a => a.type === 'Cash' && String(a.name || '').trim() === 'Cash');
    if (cashAccounts.length > 1) {
      console.error('[Sync] ⚠️ Duplicate Cash accounts detected:', cashAccounts.length, 'rows found.');
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('⚠️ একাধিক Cash account পাওয়া গেছে। Accounts ট্যাব থেকে ভুল row-টি delete করুন।', 'error', 7000);
      }
      document.dispatchEvent(new CustomEvent('wfa:duplicate_cash_accounts', {
        detail: { count: cashAccounts.length, accounts: cashAccounts.map(a => ({ id: a.id, balance: a.balance })) }
      }));
    }
    // ⛔ কখনো insert করে না — এটা create করার জায়গা নয়
    return false;
  }

  /**
   * Student.paid আছে কিন্তু Finance Ledger-এ entry নেই — backfill করো + account balance আপডেট।
   * Dashboard-এ collection দেখায় কিন্তু Finance/Accounts ০ থাকলে এই repair লাগে।
   */
  function repairMissingStudentFinance(options = {}) {
    const silent = !!options.silent;
    const defaultMethod = options.method || 'Cash';

    const financeKey = (typeof DB !== 'undefined' && DB.finance) ? DB.finance : 'finance_ledger';
    const studentsKey = (typeof DB !== 'undefined' && DB.students) ? DB.students : 'students';
    const allStudents = getAll(studentsKey);
    const allFinance  = getAll(financeKey);
    let fixedCount = 0;
    let totalAmount = 0;
    const auditLog = [];

    // 1. Clean up any existing repaired/auto-healed entries first (local & Supabase cloud queue)
    const repairedEntries = allFinance.filter(f => {
      const isRepaired = f.description && (f.description.includes('(Repaired)') || f.description.includes('(Auto-healed)'));
      const isAutoRepairedNote = f.note && f.note.includes('Auto-repaired');
      const isRepairId = f.id && f.id.startsWith('REPAIR-');
      return isRepaired || isAutoRepairedNote || isRepairId;
    });
    
    repairedEntries.forEach(f => {
      remove(financeKey, f.id, { bypassLog: true });
    });

    // Refresh finance cache to use clean entries for calculations
    const cleanFinance = getAll(financeKey);
    const cleanStr = str => String(str || '').toLowerCase().trim();

    // 2. Build a unique mapping of ledger entries to students to prevent double-matching
    const matchedMap = new Map(); // entryId -> student
    cleanFinance.forEach(f => {
      const cat = cleanStr(f.category);
      if (!['student fee', 'student installment', 'student payment'].includes(cat)) return;

      let bestStudent = null;

      // Priority 1: Match by ref_id (exact match)
      if (f.ref_id) {
        bestStudent = allStudents.find(s => s.id === f.ref_id || s.student_id === f.ref_id);
      }

      // Priority 2: Match by student ID found in description
      if (!bestStudent && f.description) {
        const m = f.description.match(/(WF(?:A)?-\d+)/i);
        if (m) {
          const idStr = m[1].toUpperCase();
          bestStudent = allStudents.find(s => (s.id || '').toUpperCase() === idStr || (s.student_id || '').toUpperCase() === idStr);
        }
      }

      // Priority 3: Match by name in description (only if unique or matches ID)
      if (!bestStudent && f.description) {
        const desc = cleanStr(f.description);
        const matches = allStudents.filter(s => {
          const sName = cleanStr(s.name);
          return sName && desc.includes(sName);
        });
        if (matches.length === 1) {
          bestStudent = matches[0];
        } else if (matches.length > 1) {
          bestStudent = matches.find(s => desc.includes(cleanStr(s.student_id || '')));
          if (!bestStudent) bestStudent = matches[0]; // fallback
        }
      }

      if (bestStudent) {
        matchedMap.set(f.id, bestStudent);
      }
    });

    // 3. Sum ledger amounts per student
    const ledgerSums = {};
    allStudents.forEach(s => { ledgerSums[s.id] = 0; });
    matchedMap.forEach((student, entryId) => {
      const f = cleanFinance.find(x => x.id === entryId);
      if (f) {
        ledgerSums[student.id] = (ledgerSums[student.id] || 0) + (parseFloat(f.amount) || 0);
      }
    });

    // 4. Find and backfill missing entries using deterministic IDs (REPAIR-student_id)
    allStudents.forEach(s => {
      if (!s || !s.id) return;
      const sPaid = parseFloat(s.paid) || 0;
      if (sPaid <= 0) return;

      const ledgerSum = ledgerSums[s.id] || 0;
      const unrecorded = Math.max(0, sPaid - ledgerSum);
      if (unrecorded <= 0) return;

      const repairId = `REPAIR-${s.id}`;

      insert(financeKey, {
        id:          repairId,
        type:        'Income',
        category:    'Student Fee',
        description: `${s.name || 'Student'} (${s.student_id || s.id}) — Admission Payment (Repaired)`,
        amount:      unrecorded,
        method:      defaultMethod,
        date:        (s.admission_date || '').split('T')[0] || new Date().toISOString().split('T')[0],
        note:        'Auto-repaired: paid amount was saved without finance ledger entry',
        ref_id:      s.id,
      }, { bypassLog: true });

      fixedCount++;
      totalAmount += unrecorded;
      auditLog.push(`${s.name} (${s.student_id || s.id}): +৳${unrecorded}`);
    });

    if (fixedCount > 0) {
      _logActivity('system', financeKey,
        `Finance repair: ${fixedCount} missing student fee entr${fixedCount === 1 ? 'y' : 'ies'} backfilled (৳${totalAmount.toLocaleString('en-IN')})`);
      if (!silent && typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`🔧 Finance repaired: ${fixedCount} student(s), ৳${totalAmount.toLocaleString('en-IN')} added to ledger`, 'success');
      }
      console.info('[Sync] Finance repair:\n' + auditLog.join('\n'));
    } else if (!silent && typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('✅ Finance ledger is complete — no missing entries', 'success');
    }

    return { fixedCount, totalAmount, auditLog };
  }

  function _runStartupFinanceRepair() {
    try {
      ensureDefaultCashAccount();
      if (!localStorage.getItem('wfa_finance_backfill_v1')) {
        repairMissingStudentFinance({ silent: true });
        localStorage.setItem('wfa_finance_backfill_v1', '1');
      }
    } catch (e) {
      console.warn('[Sync] Startup finance repair failed (non-critical):', e);
    }
  }

  if (typeof WFA_IDB !== 'undefined' && WFA_IDB.onReady) {
    WFA_IDB.onReady(_runStartupFinanceRepair);
  }

  return {
    getAll, getById, setAll, insert, update, remove, generateId, _deleteFromCloud,
    getDeletedIds, clearDeletedIds, untrackDeletion, processRetryQueue, _deviceId,
    restoreRecycleBinItem, permanentDeleteRecycleBinItem, emptyRecycleBin,
    updateAccountBalance,
    ensureDefaultCashAccount,
    repairMissingStudentFinance,
    buildMonitorSnapshotAtRecord: _buildMonitorSnapshotAtRecord,
    getMonitorSnapshot: _getMonitorSnapshot,  // ✅ Public: reads accounts.balance directly (real snapshot)
    TABLE_COLUMNS,
    _addToRecycleBinPublic: _addToRecycleBin,
    _syncRecycleBinToSettings,
    logActivity: _logActivity,  // ✅ লজিক ৫: modules থেকে specific log লিখতে পারবে
    beginActivityLogSuppress: _beginActivityLogSuppress,
    runWithoutActivityLog: _runWithoutActivityLog,
    isDiagnosticRecord: _isDiagnosticRecord,
    isDiagnosticActivity: _isDiagnosticActivity,
    filterActivityLogs: (logs) => (Array.isArray(logs) ? logs.filter(l => !_shouldHideActivity(l)) : []),
    isVagueSettingsActivity: _isVagueSettingsActivity,
    pullActivityLog: _pullActivityFromCloud, // ✅ সব device-এর activity log sync করে
    _restoredIds,
    _prepareRecordForCloud,
    normalizeSalaryForCloud: _normalizeSalaryForCloud,
    normalizeSalaryFromCloud: _normalizeSalaryFromCloud,
    normalizeExamForCloud: _normalizeExamForCloud,
    normalizeExamFromCloud: _normalizeExamFromCloud,
    salaryTableKey: _salaryTableKey,
    examsTableKey: _examsTableKey,
  };
})();
window.SupabaseSync = SupabaseSync;


// ============================================================
// SyncEngine — Pull / Push / Real-time / Multi-user
// ============================================================
const SyncEngine = (() => {
  // ✅ BUG FIX: Do NOT destructure `client` at init time — it may be null during async hydration.
  // Always read window.SUPABASE_CONFIG.client fresh on each operation.
  const { TABLES } = window.SUPABASE_CONFIG;
  function _client() { return window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.client; }
  /** Unique Supabase table names (DB aliases like certificates → students deduped). */
  function _cloudTableKeys() {
    return [...new Set(Object.values(TABLES || {}))];
  }
  let syncInterval = null;
  let realtimeChannels = [];
  let _lastSyncTime = 0;
  let _lastPullTimestamp = null;
  let _syncInProgress = false;
  const missingTables = new Set();

  // —— Storage Size Guard (IndexedDB-aware) ——
  // IndexedDB removes the old 5MB localStorage cap.
  // Warning/critical thresholds are set much higher for IDB.
  const STORAGE_WARN_KB  = 204800;  // 200 MB — IndexedDB can hold 500MB+
  const STORAGE_CRIT_KB  = 409600;  // 400 MB — only warn when truly high

  function _getStorageUsageKB() {
    return WFA_IDB.getUsageKB();
  }

  function _getTableSizeKB(tableKey) {
    return WFA_IDB.getTableSizeKB(tableKey);
  }

  // Trim helper kept for API compatibility (rarely needed with IndexedDB)
  function _trimLargeTableForStorage(tableKey, keepCount) {
    try {
      const rows = SupabaseSync.getAll(tableKey);
      if (rows.length <= keepCount) return 0;
      const trimmed = rows.slice(0, keepCount);
      SupabaseSync.setAll(tableKey, trimmed);
      const freed = rows.length - keepCount;
      console.warn(`[Storage] Trimmed ${freed} old rows from "${tableKey}" (kept ${keepCount})`);
      return freed;
    } catch { return 0; }
  }

  function _checkAndManageStorage() {
    const usageKB = _getStorageUsageKB();
    if (usageKB >= STORAGE_CRIT_KB) {
      console.warn(`[Storage] IndexedDB usage high: ${usageKB} KB`);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`Local data ${Math.round(usageKB/1024)} MB — consider archiving old records.`, 'warn');
      }
    } else if (usageKB >= STORAGE_WARN_KB) {
      console.warn(`[Storage] IndexedDB warning: ${usageKB} KB used`);
    }
  }

  let _opQueue = Promise.resolve();
  function queueSyncOp(fn) {
    const run = _opQueue.then(() => fn());
    _opQueue = run.catch((e) => { console.error('[Sync] Queued op failed:', e); });
    return run;
  }

  function setStatus(state) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
      synced:   { icon: '☁️', text: 'Synced',    cls: 'synced'  },
      syncing:  { icon: '🔄', text: 'Syncing...',  cls: 'syncing' },
      offline:  { icon: '📴', text: 'Offline',   cls: 'offline' },
      error:    { icon: '⚠️', text: 'Error',     cls: 'error'   },
      realtime: { icon: '🟢', text: 'Real-time', cls: 'synced'  },
    };
    const s = map[state] || map.offline;
    el.className = `sync-badge ${s.cls}`;
    el.innerHTML = `${s.icon} ${s.text}`;
  }

  async function _pullCore(opts = {}) {
    _syncInProgress = true;
    try {
      return await _pullCoreInternal(opts);
    } finally {
      _syncInProgress = false;
    }
  }

  async function _pullCoreInternal(opts = {}) {
    const silent = opts.silent !== false ? true : false;
    const forceFull = opts.full === true;
    setStatus('syncing');

    _checkAndManageStorage();

    const isFullPull = forceFull || !_lastPullTimestamp;
    const filterTs   = _lastPullTimestamp;
    const pullStartedAt = new Date().toISOString();

    try {
      // ✅ BUG FIX: Read client fresh — it may have been set async after init.
      const client = _client();
      if (!client) {
        console.warn('[Sync] Pull skipped — Supabase client not ready (offline or unconfigured).');
        setStatus('offline');
        return;
      }

      let hasChanges = false;

      for (const key of _cloudTableKeys()) {
        if (missingTables.has(key)) continue;

        let query = client.from(key).select('*');

        if (!isFullPull && filterTs) {
          query = query.gt('updated_at', filterTs);
          query = query.order('updated_at', { ascending: false }).limit(200);
        } else {
          query = query.order('updated_at', { ascending: false });
        }

        const { data: cloudRows, error } = await query;

        if (error) {
          if (
            error.code === '42P01' ||
            error.status === 404 ||
            error.message?.includes('does not exist') ||
            error.message?.includes('relation') ||
            error.message?.includes('could not find')
          ) {
            console.warn(`[Sync] Table "${key}" does not exist or is unavailable, skipping`);
            missingTables.add(key);
            continue;
          }
          if (String(error.code) === '400' || error.code === 'PGRST301' || error.status === 400) {
            console.warn(`[Sync] Pull skipped for "${key}" (HTTP 400):`, error.message);
            continue;
          }
          // ✅ Fix: Catch HTTP 500 from missing columns (e.g. exam_settings, exam_questions)
          //         These are schema mismatches — skip the table rather than crash the whole pull.
          if (
            error.status === 500 ||
            String(error.code) === '500' ||
            error.code === 'PGRST204' ||
            error.message?.includes('column') ||
            error.message?.includes('schema')
          ) {
            console.warn(`[Sync] Pull skipped for "${key}" (schema/column mismatch — add missing columns in Supabase):`, error.message);
            continue;
          }
          // Unknown error — log but don't crash the whole pull
          console.warn(`[Sync] Pull error for "${key}" (skipping):`, error.message || error);
          continue;
        }

        const localRows  = SupabaseSync.getAll(key);
        const deletedIds = SupabaseSync.getDeletedIds(key);

        let merged;
        if (isFullPull) {
          merged = mergeRows(localRows, cloudRows || [], deletedIds);
        } else {
          merged = mergeIncremental(localRows, cloudRows || [], deletedIds);
        }

        // BUG-05 Fix: finance_ledger pull — _isLoan flag Supabase-এ নেই (cloud-only field নয়)
        // কিন্তু Finance UI এই flag দিয়ে loan entries লুকায়।
        // Cloud pull-এ এই flag হারিয়ে গেলে loan entries Finance tab-এ দেখা যায়।
        // Fix: pull-এর পর category==='Loan' ও type loan rows-এ _isLoan:true restore করো।
        if (key === 'finance_ledger' && merged.length > 0) {
          merged = merged.map(function(f) {
            if (!f._isLoan && f.category === 'Loan' &&
                (f.type === 'Loan Giving' || f.type === 'Loan Receiving')) {
              return Object.assign({}, f, { _isLoan: true });
            }
            return f;
          });
        }

        const salKey = (typeof DB !== 'undefined' && DB.salary) ? DB.salary : 'salary';
        const exKey  = (typeof DB !== 'undefined' && DB.exams) ? DB.exams : 'exams';
        if (key === salKey && merged.length > 0 && typeof SupabaseSync.normalizeSalaryFromCloud === 'function') {
          merged = merged.map(SupabaseSync.normalizeSalaryFromCloud);
        }
        if (key === exKey && merged.length > 0 && typeof SupabaseSync.normalizeExamFromCloud === 'function') {
          merged = merged.map(SupabaseSync.normalizeExamFromCloud);
        }

        // SECURITY: settings table — admin_password কখনো cloud এর plaintext দিয়ে overwrite হবে না
        if (key === 'settings' && merged.length > 0 && localRows.length > 0) {
          const _isHashed = (s) => /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');
          const localPw = localRows[0].admin_password;
          const mergedPw = merged[0].admin_password;
          // যদি local-এ hashed password থাকে কিন্তু merged-এ plaintext বা empty এসেছে
          if (localPw && _isHashed(localPw) && (!mergedPw || !_isHashed(mergedPw))) {
            merged[0].admin_password = localPw;
          }
          // security_question ও security_answer preserve করো
          if (localRows[0].security_question && !merged[0].security_question) {
            merged[0].security_question = localRows[0].security_question;
          }
          if (localRows[0].security_answer && !merged[0].security_answer) {
            merged[0].security_answer = localRows[0].security_answer;
          }

          // ✅ FIX: keep_records, recycle_bin, activity_log, snapshots — এগুলো large JSON fields।
          // Supabase pull/realtime payload-এ এরা missing বা truncated আসতে পারে।
          // Cloud-এ এই field না থাকলে local version সবসময় preserve করো।
          // এটা না করলে প্রতি ৩০ সেকেন্ডের auto-pull-এ নোটগুলো ভ্যানিশ হয়।
          const largeFields = ['keep_records', 'recycle_bin', 'activity_log', 'snapshots', 'expense_start_date', 'expense_end_date', 'running_batch', 'monthly_target'];
          for (const field of largeFields) {
            if (localRows[0][field] && !merged[0][field]) {
              merged[0][field] = localRows[0][field];
            }
          }
          // Ensure settings table only has 1 record
          if (merged.length > 1) {
            merged.sort((a, b) => {
              const aName = a.academy_name ? 1 : 0;
              const bName = b.academy_name ? 1 : 0;
              if (aName !== bName) return bName - aName;
              return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            });
            const keeper = merged[0];
            // Proactively delete any duplicate settings rows from the cloud
            for (let i = 1; i < merged.length; i++) {
              const dupRow = merged[i];
              SupabaseSync._deleteFromCloud(key, dupRow.id);
            }
            merged = [keeper];
          }
        }

        const oldJson = JSON.stringify(localRows);
        const newJson = JSON.stringify(merged);
        if (oldJson !== newJson) {
          SupabaseSync.setAll(key, merged);
          hasChanges = true;
          if (!isFullPull) {
            console.log(`[Sync] Incremental pull: ${cloudRows?.length || 0} changed rows for "${key}"`);
          }
        }
      }

      _lastSyncTime     = Date.now();
      _lastPullTimestamp = pullStartedAt;

      setStatus(realtimeChannels.length > 0 ? 'realtime' : 'synced');

      if (!silent && typeof Utils !== 'undefined') {
        const mode = isFullPull ? 'Full sync' : 'Incremental sync';
        Utils.toast(
          hasChanges ? `${mode} complete — new data pulled` : `${mode} complete — all up to date`,
          'success'
        );
      }

      if (hasChanges) {
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'pull' } }));
      }

      await SupabaseSync.processRetryQueue();

    } catch (e) {
      console.error('[Sync] Pull failed:', e);
      setStatus('error');
      if (!silent && typeof Utils !== 'undefined') Utils.toast('Pull from cloud failed âŒ', 'error');
    }
  }

  function pull(opts) {
    return queueSyncOp(() => _pullCore(opts));
  }

  function fullPull(opts = {}) {
    return queueSyncOp(() => _pullCore({ ...opts, full: true }));
  }

  function mergeRows(localRows, cloudRows, deletedIds) {
    const merged = new Map();
    const conflicts = [];

    // Cloud এর সবচেয়ে নতুন updated_at বের করো
    let latestCloudTime = 0;
    cloudRows.forEach(row => {
      const t = new Date(row.updated_at || 0).getTime();
      if (t > latestCloudTime) latestCloudTime = t;
    });

    cloudRows.forEach(row => {
      if (!deletedIds.includes(row.id)) {
        merged.set(row.id, row);
      }
    });

    localRows.forEach(row => {
      if (deletedIds.includes(row.id)) return;
      const existing = merged.get(row.id);
      if (!existing) {
        // Local এ আছে কিন্তু cloud এ নেই — শুধু রাখো যদি
        // এটা cloud এর latest record এর চেয়ে নতুন হয় (অর্থাৎ সত্যিই নতুন entry)
        const localTime = new Date(row.updated_at || 0).getTime();
        if (latestCloudTime > 0 && localTime < latestCloudTime - 300000) {
          // Cloud এ ৫ মিনিটের বেশি আগের record এর চেয়েও পুরনো local row — skip (stale data)
          // BUG-S4 fix: warn instead of silently dropping, so data loss is traceable
          if (window.__WFA_DEV__) console.warn('[SyncMerge] Dropping stale local-only record (id=%s, table implied by caller, localTime=%s, latestCloudTime=%s). If this is unexpected, check offline sync.', row.id, new Date(localTime).toISOString(), new Date(latestCloudTime).toISOString());
          return;
        }
        merged.set(row.id, row);
      } else {
        const localTime = new Date(row.updated_at || 0).getTime();
        const cloudTime = new Date(existing.updated_at || 0).getTime();
        const diff = Math.abs(localTime - cloudTime);

        if (diff < 10000 && row._device && existing._device && row._device !== existing._device) {
          // ✅ Field-level merge: combine non-conflicting changes from both devices
          const resolvedRecord = _fieldLevelMerge(existing, row, localTime, cloudTime);
          merged.set(row.id, resolvedRecord);
          conflicts.push({
            id: row.id, localTime, cloudTime,
            localDevice: row._device, cloudDevice: existing._device,
            resolution: 'field_merge'
          });
        } else if (localTime > cloudTime) {
          merged.set(row.id, row);
        } else {
          // ✅ FIX: Cloud wins — salary partial payment paidAmount preserve করো
          // Cloud-এ paid_amount column না থাকলে local-এর paidAmount হারিয়ে যায়
          const localPaid = parseFloat(row.paidAmount ?? row.paid_amount ?? 0) || 0;
          const cloudPaid = parseFloat(existing.paidAmount ?? existing.paid_amount ?? 0) || 0;
          if (localPaid > 0 && cloudPaid === 0 && existing.paidAmount === undefined && existing.paid_amount === undefined) {
            existing.paidAmount = localPaid;
            existing.paid_amount = localPaid;
            // paid status ও সংশোধন করো
            const total = parseFloat(existing.total ?? existing.net_salary ?? existing.amount ?? 0) || 0;
            if (total > 0 && localPaid > 0 && !existing.paid) {
              existing.status = localPaid >= total ? 'Paid' : 'Partial';
            }
            merged.set(row.id, existing);
          }
        }
      }
    });

    if (conflicts.length > 0 && typeof SyncGuard !== 'undefined') {
      conflicts.forEach(c => SyncGuard.report('merge_conflict', c));
    }

    return Array.from(merged.values());
  }

  /**
   * Field-level merge: when two devices edit the same record concurrently,
   * merge non-conflicting field changes. For conflicting fields, prefer
   * the version with the newer timestamp.
   */
  function _fieldLevelMerge(cloudRow, localRow, localTime, cloudTime) {
    const result = { ...cloudRow };
    const skipFields = new Set(['id', 'created_at', 'updated_at', '_device']);

    for (const key of Object.keys(localRow)) {
      if (skipFields.has(key)) continue;
      const localVal = localRow[key];
      const cloudVal = cloudRow[key];

      // If both sides have the same value, no conflict
      if (JSON.stringify(localVal) === JSON.stringify(cloudVal)) continue;

      // If cloud has no value but local does, take local
      if ((cloudVal === undefined || cloudVal === null || cloudVal === '') &&
          localVal !== undefined && localVal !== null && localVal !== '') {
        result[key] = localVal;
        continue;
      }

      // If local has no value but cloud does, keep cloud (already in result)
      if ((localVal === undefined || localVal === null || localVal === '') &&
          cloudVal !== undefined && cloudVal !== null && cloudVal !== '') {
        continue;
      }

      // Both have different non-empty values
      // If the field is a JSON array (e.g. categories, courses), merge them
      let arrayMerged = false;
      try {
        const localArr = JSON.parse(localVal);
        const cloudArr = JSON.parse(cloudVal);
        if (Array.isArray(localArr) && Array.isArray(cloudArr)) {
          result[key] = JSON.stringify(Array.from(new Set([...localArr, ...cloudArr])));
          arrayMerged = true;
        }
      } catch { /* Not a JSON array — skip array merge for this field */ }

      if (arrayMerged) continue;

      // Otherwise prefer newer timestamp
      if (localTime >= cloudTime) {
        result[key] = localVal;
      }
      // else cloudVal already in result
    }

    // Set metadata to reflect the merge
    result.updated_at = new Date(Math.max(localTime, cloudTime)).toISOString();
    result._device = localTime >= cloudTime ? localRow._device : cloudRow._device;

    return result;
  }

  function mergeIncremental(localRows, changedCloudRows, deletedIds) {
    if (!changedCloudRows.length && !deletedIds.length) return localRows;

    const localMap = new Map(localRows.map(r => [r.id, r]));

    // ✅ FIX: Use Set for O(1) lookup instead of array includes() which is O(n)
    const deletedIdSet = new Set(deletedIds || []);
    
    deletedIdSet.forEach(id => localMap.delete(id));

    for (const cloudRow of changedCloudRows) {
      // ✅ CRITICAL FIX: If record is deleted, don't apply cloud updates
      if (deletedIdSet.has(cloudRow.id)) {
        // Record is deleted - ensure it stays deleted
        localMap.delete(cloudRow.id);
        console.warn(`[Sync] Record ${cloudRow.id} is marked deleted - rejecting cloud update`);
        continue;
      }

      const localRow = localMap.get(cloudRow.id);
      if (!localRow) {
        localMap.set(cloudRow.id, cloudRow);
      } else {
        const localTime = new Date(localRow.updated_at || 0).getTime();
        const cloudTime = new Date(cloudRow.updated_at || 0).getTime();
        if (cloudTime >= localTime) {
          // ✅ FIX: settings table-এ keep_records/recycle_bin/activity_log/snapshots
          // cloud থেকে missing আসলে local version রাখো — এই fields cloud-এ truncate হতে পারে
          if (localRow.keep_records !== undefined || localRow.recycle_bin !== undefined || localRow.courses !== undefined) {
            const protected_fields = ['keep_records', 'recycle_bin', 'activity_log', 'snapshots'];
            // ✅ FIX: User-configured display settings — always keep local value.
            // Cloud sync must NOT overwrite these because user changes them locally.
            // Previously: only kept local if cloud field was empty (bug: cloud stale value won).
            const always_local_fields = ['expense_start_date', 'expense_end_date', 'running_batch', 'monthly_target'];
            const merged = { ...cloudRow };
            for (const f of protected_fields) {
              if (localRow[f] && !merged[f]) merged[f] = localRow[f];
            }
            for (const f of always_local_fields) {
              if (localRow[f] !== undefined && localRow[f] !== null) merged[f] = localRow[f];
            }
            // Smart Array Merge for Settings race conditions
            const array_fields = ['income_categories', 'expense_categories', 'courses', 'employee_roles'];
            for (const f of array_fields) {
              if (localRow[f] && merged[f]) {
                try {
                  const localArr = JSON.parse(localRow[f]);
                  const cloudArr = JSON.parse(merged[f]);
                  if (Array.isArray(localArr) && Array.isArray(cloudArr)) {
                    merged[f] = JSON.stringify(Array.from(new Set([...localArr, ...cloudArr])));
                  }
                } catch { /* Not a JSON array — skip smart merge for this field */ }
              }
            }
            localMap.set(cloudRow.id, merged);
          } else {
            // ✅ FIX: Salary partial payment — cloud-এ paid_amount column না থাকলে
            // incremental merge-এ local paidAmount হারিয়ে যেত
            const _localPaid = parseFloat(localRow.paidAmount ?? localRow.paid_amount ?? 0) || 0;
            const _cloudPaid = parseFloat(cloudRow.paidAmount ?? cloudRow.paid_amount ?? 0) || 0;
            if (_localPaid > 0 && _cloudPaid === 0 && cloudRow.paidAmount === undefined && cloudRow.paid_amount === undefined) {
              const salMerged = { ...cloudRow, paidAmount: _localPaid, paid_amount: _localPaid };
              localMap.set(cloudRow.id, salMerged);
            } else {
              localMap.set(cloudRow.id, cloudRow);
            }
          }
        }
      }
    }

    return Array.from(localMap.values());
  }

  async function push(opts = {}) {
    const silent = opts.silent !== false ? true : false;
    setStatus('syncing');
    try {
      // ✅ BUG FIX: Read client fresh on each push call.
      const client = _client();
      if (!client) {
        console.warn('[Sync] Push skipped — Supabase client not ready (offline or unconfigured).');
        setStatus('offline');
        return;
      }

      // ── Safety check: fresh device এ blindly push করবে না ──
      // _lastPullTimestamp না থাকলে মানে এই device এ full pull হয়নি।
      // সেক্ষেত্রে local data stale হতে পারে, push skip করো।
      if (!_lastPullTimestamp && !opts.forcePush) {
        console.warn('[Sync] Push skipped — no pull timestamp (fresh device). Pull first.');
        setStatus('synced');
        return;
      }

      for (const key of _cloudTableKeys()) {
        if (missingTables.has(key)) continue;
        const rows = SupabaseSync.getAll(key);
        if (!rows.length) continue;
        const cleanRows = rows.map(r => SupabaseSync._prepareRecordForCloud(key, r));
        const { error } = await client.from(key).upsert(cleanRows, { onConflict: 'id' });
        if (error) console.error(`[Sync] Push failed for "${key}":`, error);
      }
      setStatus('synced');
      if (!silent && typeof Utils !== 'undefined') Utils.toast('Push complete ✅', 'success');
    } catch (e) {
      console.error('[Sync] Push failed:', e);
      setStatus('error');
    }
  }

  async function syncAll(opts = {}) {
    await pull(opts);
    await push(opts);
  }

  function startRealtime() {
    // ✅ BUG FIX: Read client fresh.
    const client = _client();
    if (!client?.channel) return;
    stopRealtime();

    for (const key of _cloudTableKeys()) {
      try {
        const channel = client
          .channel(`realtime:${key}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: key }, (payload) => {
            _handleRealtimeEvent(key, payload);
          })
          .subscribe();
        realtimeChannels.push(channel);
      } catch (e) {
        console.warn(`[Realtime] Subscribe failed for "${key}":`, e);
      }
    }
  }

  function stopRealtime() {
    // ✅ BUG FIX: Read client fresh — avoid using stale null reference from closure.
    const client = _client();
    realtimeChannels.forEach(ch => {
      try { if (client) client.removeChannel(ch); } catch { /* ignore */ }
    });
    realtimeChannels = [];
  }

  function _handleRealtimeEvent(table, payload) {
    window._realtimeEventInProgress = true;
    try {
      return _handleRealtimeEventInternal(table, payload);
    } finally {
      window._realtimeEventInProgress = false;
    }
  }

  function _handleRealtimeEventInternal(table, payload) {
    try {
      const { eventType, new: newRow, old: oldRow } = payload;
      const rows = SupabaseSync.getAll(table);

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!newRow?.id) return;
        const idx = rows.findIndex(r => r.id === newRow.id);

        // ✅ FIX: Supabase realtime payload-এ large JSON columns (keep_records, recycle_bin ইত্যাদি)
        // truncate বা omit হতে পারে। settings table-এর ক্ষেত্রে local-এর এই fields গুলো
        // preserve করো — না হলে নোট সহ অন্য data মুছে যায়।
        if (table === 'settings' && idx >= 0) {
          const localRow = rows[idx];
          const preserveFields = ['keep_records', 'recycle_bin', 'activity_log', 'snapshots', 'expense_start_date', 'expense_end_date', 'running_batch', 'monthly_target'];
          const merged = { ...newRow };
          for (const field of preserveFields) {
            if (!merged[field] && localRow[field]) {
              merged[field] = localRow[field];
            }
          }
          rows[idx] = merged;
        } else if (idx >= 0) {
          let merged = { ...rows[idx], ...newRow };
          const salKey = (typeof DB !== 'undefined' && DB.salary) ? DB.salary : 'salary';
          const exKey = (typeof DB !== 'undefined' && DB.exams) ? DB.exams : 'exams';
          // ✅ FIX: Salary partial payment — cloud-এ paid_amount column না থাকলে
          // real-time merge-এ local paidAmount হারিয়ে যেত। Local value preserve করো।
          if (table === salKey) {
            const localRow = rows[idx];
            const localPaid = parseFloat(localRow.paidAmount ?? localRow.paid_amount ?? 0) || 0;
            const cloudPaid = parseFloat(newRow.paidAmount ?? newRow.paid_amount ?? 0) || 0;
            // Cloud-এ paidAmount/paid_amount না থাকলে local-এর value রাখো
            if (localPaid > 0 && cloudPaid === 0 && newRow.paidAmount === undefined && newRow.paid_amount === undefined) {
              merged.paidAmount = localPaid;
              merged.paid_amount = localPaid;
            }
          }
          if (table === salKey && typeof SupabaseSync.normalizeSalaryFromCloud === 'function') {
            merged = SupabaseSync.normalizeSalaryFromCloud(merged);
          } else if (table === exKey && typeof SupabaseSync.normalizeExamFromCloud === 'function') {
            merged = SupabaseSync.normalizeExamFromCloud(merged);
          }
          rows[idx] = merged;
        } else {
          // ✅ BUG FIX: Do NOT re-insert a record that was deleted locally.
          // Supabase realtime may deliver a delayed INSERT event (from the initial
          // _pushRecord) AFTER we have already deleted the record locally.
          // Without this guard the record reappears in the active table, causing
          // count mismatches (e.g. Student Installment diagnostic test failure).
          const deletedIds = SupabaseSync.getDeletedIds(table);
          if (deletedIds.includes(newRow.id)) {
            console.info(`[Realtime] Ignoring INSERT for locally-deleted record: ${table}:${newRow.id}`);
            return;
          }
          let row = newRow;
          const salKey = (typeof DB !== 'undefined' && DB.salary) ? DB.salary : 'salary';
          const exKey = (typeof DB !== 'undefined' && DB.exams) ? DB.exams : 'exams';
          if (table === salKey && typeof SupabaseSync.normalizeSalaryFromCloud === 'function') {
            row = SupabaseSync.normalizeSalaryFromCloud(row);
          } else if (table === exKey && typeof SupabaseSync.normalizeExamFromCloud === 'function') {
            row = SupabaseSync.normalizeExamFromCloud(row);
          }
          rows.unshift(row);
        }
        // Ensure settings table has exactly 1 record after realtime changes
        if (table === 'settings' && rows.length > 1) {
          rows.sort((a, b) => {
            const aName = a.academy_name ? 1 : 0;
            const bName = b.academy_name ? 1 : 0;
            if (aName !== bName) return bName - aName;
            return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
          });
          for (let i = 1; i < rows.length; i++) {
            SupabaseSync._deleteFromCloud(table, rows[i].id);
          }
          rows.splice(1); // Keep only first row in rows
        }
        SupabaseSync.setAll(table, rows);
      } else if (eventType === 'DELETE') {
        if (!oldRow?.id) return;
        
        // Prevent race condition: if the ID was recently restored/re-created locally,
        // ignore the incoming DELETE event from the prior deletion.
        const restoredKey = `${table}:${oldRow.id}`;
        const restoredTime = SupabaseSync._restoredIds?.[restoredKey];
        if (restoredTime && (Date.now() - restoredTime < 10000)) {
          console.info(`[Realtime] Ignoring DELETE event for recently restored/re-created item: ${restoredKey}`);
          return;
        }

        SupabaseSync.setAll(table, rows.filter(r => r.id !== oldRow.id));
      }

      setStatus('realtime');
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'realtime', table, eventType } }));
    } catch (e) {
      console.warn('[Realtime] Handle event failed:', e);
    }
  }

  function startAutoSync() {
    stopAutoSync();
    syncInterval = setInterval(() => {
      if (realtimeChannels.length === 0) {
        pull({ silent: true }).catch(e => {
          console.error('[Sync] Silent pull interval error:', e);
        });
      } else {
        if (Date.now() - _lastSyncTime > 60000) {
          pull({ silent: true }).catch(e => {
            console.error('[Sync] Silent pull interval error (with realtime):', e);
          });
        }
      }
    }, 30000);

    // ✅ Fix: Add error handler to initial pull
    pull({ silent: true }).then(() => {
      startRealtime();
      // ✅ App চালু হলে সব device-এর activity log pull করো
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.pullActivityLog === 'function') {
        SupabaseSync.pullActivityLog();
      }
    }).catch(e => {
      console.error('[Sync] Initial pull failed:', e);
      // Still start realtime even if initial pull fails
      startRealtime();
    });
  }

  function stopAutoSync() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    stopRealtime();
  }

  function setupNetworkListeners() {
    window.addEventListener('online', () => {
      setStatus('syncing');
      syncAll({ silent: true }).then(() => { startRealtime(); SupabaseSync.pullActivityLog && SupabaseSync.pullActivityLog(); }).catch(e => {
        if (window.__WFA_DEV__) console.error('[Sync] Online sync failed:', e);
      });
    });

    window.addEventListener('offline', () => {
      setStatus('offline');
      stopRealtime();
    });
  }

  function getDataMonitor() {
    const stats = {};
    for (const [key, tableName] of Object.entries(TABLES)) {
      const rows = SupabaseSync.getAll(tableName);
      stats[key] = {
        table: tableName,
        localCount: rows.length,
        lastUpdated: rows.length > 0
          ? rows.reduce((max, r) => {
              const t = r.updated_at || r.created_at || '';
              return t > max ? t : max;
            }, '')
          : '—',
      };
    }
    return stats;
  }

  function getLocal(table)       { return SupabaseSync.getAll(table); }
  function setLocal(table, rows) { SupabaseSync.setAll(table, rows); }

  // ── Sync Anchor Reset ─────────────────────────────────────────
  // New browser / changed credentials → _lastPullTimestamp must be
  // cleared so the next pull is a FULL pull, not incremental.
  function resetSyncAnchor() {
    _lastPullTimestamp = null;
    _lastSyncTime = 0;
    console.info('[Sync] Sync anchor reset. Next pull will be a full pull.');
  }

  setupNetworkListeners();

  // ── Auth State Change Listener ────────────────────────────────
  // When user signs in (or session hydrates), reset anchor and do full pull
  // so pre-existing cloud data is fetched regardless of page-load timing.
  if (typeof SupabaseAuth !== 'undefined' && SupabaseAuth.onAuthStateChange) {
    try {
      SupabaseAuth.onAuthStateChange(function(event, session) {
        console.log('[Sync] Auth state change event:', event);
        if (event === 'SIGNED_IN' && session) {
          resetSyncAnchor();
          fullPull({ silent: true }).catch(function(e) {
            console.warn('[Sync] Full pull after SIGNED_IN failed:', e);
          });
        }
      });
    } catch (e) {
      console.warn('[Sync] Could not register auth state listener:', e);
    }
  }

  return {
    pull, push, syncAll, fullPull, resetSyncAnchor,
    startAutoSync, stopAutoSync,
    startRealtime, stopRealtime,
    getLocal, setLocal,
    setStatus, getDataMonitor,
    TABLE_COLUMNS: SupabaseSync.TABLE_COLUMNS,
    getStorageUsageKB: _getStorageUsageKB,
    getTableSizeKB: _getTableSizeKB,
    checkAndManageStorage: _checkAndManageStorage,
    trimTableForStorage: _trimLargeTableForStorage,
  };
})();
window.SyncEngine = SyncEngine;
