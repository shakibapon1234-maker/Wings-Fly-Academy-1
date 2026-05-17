// ============================================================
// Wings Fly Aviation Academy â€” Supabase Sync Engine + CRUD
// Phase 11: IndexedDB Storage (No 5MB limit)
// ============================================================
//
// â”€â”€ STORAGE MIGRATION: localStorage â†’ IndexedDB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// à¦†à¦—à§‡:  wfa_students, wfa_finance_ledger à¦‡à¦¤à§à¦¯à¦¾à¦¦à¦¿ â†’ localStorage (5MB limit)
// à¦à¦–à¦¨:  à¦‰à¦ªà¦°à§‡à¦° à¦¸à¦¬ table data â†’ IndexedDB (500MB+ limit)
//
// à¦›à§‹à¦Ÿ meta-data (device_id, retry_queue, deletedItems, activity_log,
// recent_changes, recycle_bin, wfa_auto_snapshots) à¦à¦–à¦¨à§‹ localStorage-à¦
// à¦¥à¦¾à¦•à§‡ â€” à¦à¦—à§à¦²à§‹ à¦•à¦–à¦¨à§‹ à¦¬à¦¡à¦¼ à¦¹à¦¯à¦¼ à¦¨à¦¾à¥¤
//
// à¦¬à¦¾à¦•à¦¿ à¦¸à¦¬ code à¦¹à§à¦¬à¦¹à§ à¦à¦•à¦‡ â€” à¦¶à§à¦§à§ getAll/setAll à¦à¦° storage backend à¦¬à¦¦à¦²à§‡à¦›à§‡à¥¤
// ============================================================

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// WFA_IDB â€” IndexedDB Wrapper (Async â†’ Sync-like bridge)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// IndexedDB naturally async, à¦•à¦¿à¦¨à§à¦¤à§ SupabaseSync à¦à¦° getAll/setAll
// synchronousà¥¤ à¦¤à¦¾à¦‡ à¦†à¦®à¦°à¦¾ à¦à¦•à¦Ÿà¦¿ in-memory cache à¦°à¦¾à¦–à¦¬:
//   - App load à¦¹à¦²à§‡ IndexedDB à¦¥à§‡à¦•à§‡ à¦¸à¦¬ data memory-à¦¤à§‡ load à¦¹à¦¬à§‡
//   - getAll() â†’ memory à¦¥à§‡à¦•à§‡ à¦¤à¦¾à§Žà¦•à§à¦·à¦£à¦¿à¦• return à¦•à¦°à¦¬à§‡ (synchronous)
//   - setAll() â†’ memory à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à¦¬à§‡ + async IndexedDB-à¦¤à§‡ write à¦•à¦°à¦¬à§‡
//
// à¦à¦¤à§‡ à¦•à¦°à§‡ à¦ªà§à¦°à§‹ SupabaseSync API synchronous-à¦‡ à¦¥à¦¾à¦•à¦¬à§‡à¥¤
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WFA_IDB = (() => {
  const DB_NAME    = 'WingsAcademyDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'tables';

  let _db = null;
  let _cache = {};           // in-memory cache: { tableName: [...rows] }
  let _ready = false;
  let _readyCallbacks = [];

  // IndexedDB open à¦•à¦°à§‹
  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'tableName' });
        }
      };

      req.onsuccess  = (e) => resolve(e.target.result);
      req.onerror    = (e) => reject(e.target.error);
      req.onblocked  = ()  => console.warn('[IDB] DB upgrade blocked â€” close other tabs');
    });
  }

  // IndexedDB à¦¥à§‡à¦•à§‡ à¦¸à¦¬ table data à¦à¦•à¦¬à¦¾à¦°à§‡ load à¦•à¦°à§‡ memory-à¦¤à§‡ à¦°à¦¾à¦–à§‹
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

  // Initialize â€” app load-à¦ à¦à¦•à¦¬à¦¾à¦° call à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡
  async function init() {
    try {
      _db = await _openDB();
      await _loadAllIntoCache(_db);

      // â”€â”€ localStorage à¦¥à§‡à¦•à§‡ à¦ªà§à¦°à¦¨à§‹ data migrate à¦•à¦°à§‹ (à¦à¦•à¦¬à¦¾à¦°à¦‡) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      await _migrateFromLocalStorage();

      _ready = true;
      _readyCallbacks.forEach(cb => cb());
      _readyCallbacks = [];
      console.info('[IDB] IndexedDB ready. Tables cached:', Object.keys(_cache).join(', ') || '(empty)');
    } catch (e) {
      console.error('[IDB] Init failed â€” falling back to localStorage:', e);
      typeof Utils !== 'undefined' && Utils.toast && Utils.toast('Database Storage Init Failed - using temporary cache (incognito mode?).', 'error', 10000);
      // Fallback: _ready = true à¦•à¦°à§‹ à¦¯à¦¾à¦¤à§‡ app à¦šà¦²à¦¤à§‡ à¦ªà¦¾à¦°à§‡
      _ready = true;
      _readyCallbacks.forEach(cb => cb());
      _readyCallbacks = [];
    }
  }

  // localStorage-à¦ à¦¯à¦¦à¦¿ à¦ªà§à¦°à¦¨à§‹ wfa_ table data à¦¥à¦¾à¦•à§‡, IndexedDB-à¦¤à§‡ à¦¨à¦¿à¦¯à¦¼à§‡ à¦¯à¦¾à¦“
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
  // onReady callback â€” init à¦¶à§‡à¦· à¦¹à¦²à§‡ call à¦•à¦°à¦¬à§‡
  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }

  // â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // Storage usage â€” cache-à¦à¦° JSON size à¦…à¦¨à§à¦®à¦¾à¦¨ à¦•à¦°à§‹
  function getUsageKB() {
    let total = 0;
    for (const [key, rows] of Object.entries(_cache)) {
      try {
        total += JSON.stringify(rows).length * 2;
        total += key.length * 2;
      } catch { /* ignore */ }
    }
    return Math.round(total / 1024);
  }

  function getTableSizeKB(tableName) {
    try {
      const rows = _cache[tableName] || [];
      return Math.round(JSON.stringify(rows).length * 2 / 1024);
    } catch { return 0; }
  }

  return { init, onReady, getTable, setTable, flushWrites, getUsageKB, getTableSizeKB };
})();

window.WFA_IDB = WFA_IDB;

// â”€â”€ App à¦¶à§à¦°à§ à¦¹à¦²à§‡ IndexedDB init à¦•à¦°à§‹ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WFA_IDB.init();
// Best-effort durability: flush pending writes when app goes to background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && WFA_IDB && typeof WFA_IDB.flushWrites === 'function') {
    WFA_IDB.flushWrites().catch(() => {});
  }
});


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SupabaseSync â€” CRUD API used by all modules
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TABLE_COLUMNS Definition
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABLE_COLUMNS = {
  // ✅ Fix: expense_month, income_categories, expense_categories, courses, employee_roles যোগ করা হয়েছে
  // Note: admin_pattern & admin_face_descriptor stored in localStorage, not Supabase (sync only these columns)
  settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username','keep_records','recycle_bin_sync','exam_questions','exam_settings'],
  salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','role','phone'],
  students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','guardian_phone','note','installment_plan'],
  finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
  accounts:      ['id','name','type','balance','description','note'],
  loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
  exams:         ['id','reg_id','student_id','student_name','batch','session','subject','exam_date','exam_fee','fee_paid','grade','marks','status','note'],
  attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
  staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note'],
  visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','created_at'],
  notices:       ['id','title','text','type','created_at','updated_at','expires_at','is_pinned'],
  advance_payments: ['id','person','amount','method','date','note','returns','created_at','updated_at'],
  investments:      ['id','source','amount','method','date','note','returns','created_at','updated_at'],
  keep_records:     ['id','title','content','color','tags','pinned','date','created','modified','created_at','updated_at'],
  custom_themes:    ['id','name','colors','variables','created_at','updated_at'],
  sub_accounts:     ['id','username','password','name','role','permissions','created_at','updated_at'],
};

const SupabaseSync = (() => {

  // â”€â”€ IDB-backed table storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getAll(table) {
    return WFA_IDB.getTable(table);
  }

  function getById(table, id) {
    return getAll(table).find(r => r.id === id) || null;
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
    record._device = _deviceId();
    const rows = getAll(table);
    rows.unshift(record);
    setAll(table, rows);
    _logRecentChange(table, 'insert', record);
    if (!options.bypassLog) {
      _logActivity('add', table, _humanReadableLog('add', table, record));
    }
    _pushRecord(table, record);
    return record;
  }

  function update(table, id, partial) {
    const rows = getAll(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) {
      const merged = { ...rows[idx], ...partial, updated_at: new Date().toISOString(), _device: _deviceId() };
      // Logic #1 fix: edit করার সময় date field পরিবর্তন হলে created_at-ও সেই অনুযায়ী update হবে।
      // এতে sort order সর্বদা import/input date অনুযায়ী থাকবে।
      const dateField = _TABLE_DATE_FIELD[table];
      if (dateField && dateField !== 'created_at' && merged[dateField]) {
        merged.created_at = new Date(merged[dateField]).toISOString();
      }
      rows[idx] = merged;
      setAll(table, rows);
      _logRecentChange(table, 'update', rows[idx]);
      _logActivity('edit', table, _humanReadableLog('edit', table, rows[idx]));
      _pushRecord(table, rows[idx]);
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
      if (!options.bypassLog) {
        _logActivity('delete', table, _humanReadableLog('delete', table, victim));
      }
    }
    _deleteFromCloud(table, id);
    _trackDeletion(table, id);
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

      const person = record.person_name || record.description || record.note || '—';
      const category = record.category || record.type || table;
      let snapshot = {};
      try { snapshot = _getMonitorSnapshot(); } catch (snapErr) {
        console.warn('[DataMonitor] Snapshot capture failed:', snapErr?.message || snapErr);
      }
      const entry = {
        date: new Date().toLocaleString(),
        action,                    // 'insert' | 'update' | 'delete'
        type: record.type,         // Income / Expense / Transfer In / Transfer Out
        category: String(category).slice(0, 100),
        person: String(person).slice(0, 100),
        amount: Number(record.amount || 0),
        method: record.method || '',
        table,
        item: _recycleDisplayName(table, record),
        snapshot,
      };
      const arr = (() => { try { return JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]'); } catch { return []; } })();
      arr.unshift(entry);
      if (arr.length > 15) arr.length = 15; // Last 15 entries

      // Try to save — handle localStorage quota errors gracefully
      try {
        localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
      } catch (quotaErr) {
        // Quota exceeded — trim older entries and try again
        console.warn('[DataMonitor] localStorage quota hit, trimming old entries...', quotaErr?.message);
        while (arr.length > 1) {
          arr.pop();
          try {
            localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
            break; // success
          } catch { /* keep trimming */ }
        }
      }
    } catch (err) {
      console.error('[DataMonitor] _logRecentChange failed:', err?.message || err);
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
      // ✅ Bug Fix 3: Investment In/Out যোগ করা হয়েছে snapshot calculation-এ
      // Income = Income + Loan Receiving + Investment In
      // Expense = Expense + Loan Giving + Investment Out
      const INCOME_TYPES  = ['income', 'transfer in',  'loan receiving', 'investment in'];
      const EXPENSE_TYPES = ['expense','transfer out', 'loan giving',    'investment out'];
      const totalIncome  = finance.filter(f => INCOME_TYPES.includes(String(f.type).toLowerCase())).reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalExpense = finance.filter(f => EXPENSE_TYPES.includes(String(f.type).toLowerCase())).reduce((s, r) => s + Number(r.amount || 0), 0);

      // Account balances — normalize same as DashboardModule to avoid duplicates
      const seen = new Set();
      const cleanAccounts = accounts.filter(a => {
        const name = String(a.name || '').trim();
        if (a.type === 'Cash' && name !== 'Cash') return false;
        if (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') {
          // ✅ Bug #9 Fix: শুধু সত্যিকারের empty/numeric placeholder drop করুন।
          if (!name || /^\d+$/.test(name)) return false;
        }
        const key = `${a.type}||${name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
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
      const batchExpense = expStart
        ? finance.filter(f => {
            if (!EXPENSE_TYPES.includes(String(f.type).toLowerCase())) return false;
            const fd = normDate(f.date);
            return fd && fd >= expStart && fd <= today;
          }).reduce((s, f) => s + Number(f.amount || 0), 0)
        : totalExpense;

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

  async function _pushActivityToCloud(entry) {
    if (_activityTableMissing) return;
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
        console.warn('[ActivityLog] Cloud push failed:', error.message);
      }
    } catch (e) {
      console.warn('[ActivityLog] Push error:', e?.message || e);
    }
  }

  // সব device-এর activity log Supabase থেকে pull করে localStorage-এ merge করে
  async function _pullActivityFromCloud() {
    if (_activityTableMissing) return;
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
      console.warn('[ActivityLog] Pull error:', e?.message || e);
    }
  }

  // Debounce: settings edit logs collapse within 5 sec to avoid duplicate entries
  const _DEDUP_WINDOW_MS = 5000;
  const _DEDUP_TYPES = new Set(['settings', 'category']);

  function _logActivity(action, type, description, status = 'success') {
    try {
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
        user:       localStorage.getItem('wfa_user_name') || 'Admin',
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

  const RECYCLE_BIN_KEY = 'wfa_recycle_bin';
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

  function _humanReadableLog(action, table, r) {
    const label    = _tableDisplayName(table);
    const itemName = _recycleDisplayName(table, r);
    switch (action) {
      case 'add':     return label + '-এ নতুন এন্ট্রি যোগ করা হয়েছে — ' + itemName;
      case 'edit':    return label + '-এ তথ্য আপডেট করা হয়েছে — ' + itemName;
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

  async function restoreRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin)) return false;
    const item = bin[index];
    if (!item?.table || !item?.data?.id) return false;

    const table = item.table;
    const record = {
      ...item.data,
      updated_at: new Date().toISOString(),
      _device: _deviceId(),
    };

    const rows = getAll(table);
    const idx = rows.findIndex((r) => r.id === record.id);
    if (idx >= 0) rows[idx] = record;
    else rows.unshift(record);
    setAll(table, rows);

    untrackDeletion(table, record.id);
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
            // ✅ Restore: Income → 'in' সবসময় safe (ব্যালেন্স বাড়ে)
            // Expense → 'out' নেগেটিভ হলে ব্যালেন্স skip করো (ডেটা ফিরে আসবে, কিন্তু অ্যাকাউন্ট negative হবে না)
            if (isIncome)  updateAccountBalance(method, amount, 'in');
            if (isExpense) {
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

          // Find linked finance entry by matching fields (same as delete logic)
          const financeEntries = getAll('finance_ledger').filter(f =>
            f._isLoan === true &&
            (f.person_name === (r.person_name || r.person)) &&
            f.type === r.type &&
            f.amount == r.amount &&
            f.date === r.date
          );
          const linkedFinanceId = financeEntries.length > 0 ? financeEntries[0].id : null;
          
          if (linkedFinanceId) {
            // Already exists in finance ledger, nothing to do
          } else {
            // Check recycle bin for the linked finance entry
            const allBin = getAll('recycle_bin');
            const linkedInBin = allBin.find(b => 
              b?.table === 'finance_ledger' &&
              b?.data?._isLoan === true &&
              (b.data.person_name === r.person_name || b.data.person_name === r.person) &&
              b.data.type === r.type &&
              b.data.amount == r.amount &&
              b.data.date === r.date
            );
            
            if (linkedInBin) {
              // Restore the linked finance entry
              const linkedRecord = {
                ...linkedInBin.data,
                updated_at: new Date().toISOString(),
                _device: _deviceId(),
              };
              const finRows = getAll('finance_ledger');
              const fIdx = finRows.findIndex(f => f.id === linkedRecord.id);
              if (fIdx >= 0) finRows[fIdx] = linkedRecord;
              else finRows.unshift(linkedRecord);
              setAll('finance_ledger', finRows);
              untrackDeletion('finance_ledger', linkedRecord.id);
              await _pushRecord('finance_ledger', linkedRecord);
              
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

    // Remove from recycle bin array
    const updatedBin = getAll('recycle_bin').filter((_, i) => i !== index);
    setAll('recycle_bin', updatedBin);
    _syncRecycleBinToSettings();
    _logActivity('restore', table, _humanReadableLog('restore', table, record));

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

    return true;
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
    };
    return map[table] || table;
  }

  function _humanReadableLog(action, table, r) {
    const label    = _tableDisplayName(table);
    const itemName = _recycleDisplayName(table, r);
    switch (action) {
      case 'add':     return label + '-এ নতুন এন্ট্রি যোগ করা হয়েছে — ' + itemName;
      case 'edit':    return label + '-এ তথ্য আপডেট করা হয়েছে — ' + itemName;
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

  async function restoreRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin)) return false;
    const item = bin[index];
    if (!item?.table || !item?.data?.id) return false;

    const table = item.table;
    const record = {
      ...item.data,
      updated_at: new Date().toISOString(),
      _device: _deviceId(),
    };

    const rows = getAll(table);
    const idx = rows.findIndex((r) => r.id === record.id);
    if (idx >= 0) rows[idx] = record;
    else rows.unshift(record);
    setAll(table, rows);

    untrackDeletion(table, record.id);
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
            // ✅ একটাই রুল: কোনো account কখনো negative হবে না
            if (isIncome)  updateAccountBalance(method, amount, 'in');
            if (isExpense) {
              const _curBal2 = (function() {
                const accs = getAll('accounts');
                if (method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
                const a = accs.find(x => x.name === method); return a ? parseFloat(a.balance) || 0 : 0;
              })();
              if (_curBal2 - amount >= 0) {
                updateAccountBalance(method, amount, 'out');
              } else {
                console.warn(`[Restore] Skipped balance deduction for "${method}": ৳${_curBal2} < ৳${amount}`);
                if (typeof Utils !== 'undefined' && Utils.toast) {
                  Utils.toast(`⚠️ Expense restore: "${method}"-এ যথেষ্ট ব্যালেন্স নেই। Record ফিরে এসেছে, balance manually ঠিক করুন।`, 'warning', 7000);
                }
              }
            }

            if (isIncome && r.category === 'Student Fee' && r.ref_id) {
              const students = getAll('students');
              const sIdx = students.findIndex(s => s.id === r.ref_id);
              if (sIdx !== -1) {
                // RECALCULATE from ALL finance entries for this student to ensure accuracy
                const allFinance = getAll('finance_ledger');
                const studentPayments = allFinance.filter(f => 
                  f.ref_id === r.ref_id && 
                  f.category === 'Student Fee' &&
                  !f._isLoan
                );
                const totalPaid = studentPayments.reduce((s, f) => s + Utils.safeNum(f.amount), 0);
                const totalFee = parseFloat(students[sIdx].total_fee) || 0;
                students[sIdx] = { 
                  ...students[sIdx], 
                  paid: totalPaid, 
                  due: Math.max(0, totalFee - totalPaid), 
                  updated_at: new Date().toISOString() 
                };
                setAll('students', students);
                await _pushRecord('students', students[sIdx]);
              }
            }
          }
         } else if (table === 'loans') {
          const wasGiven = r.type === 'Loan Giving' || r.direction === 'given';
          const _loanDir2 = wasGiven ? 'out' : 'in';
          if (_loanDir2 === 'in') {
            updateAccountBalance(method, amount, 'in');
          } else {
            const _loanBal2 = (function() {
              const accs = getAll('accounts');
              if (method === 'Cash') { const a = accs.find(x => x.type === 'Cash'); return a ? parseFloat(a.balance) || 0 : 0; }
              const a = accs.find(x => x.name === method); return a ? parseFloat(a.balance) || 0 : 0;
            })();
            if (_loanBal2 - amount >= 0) {
              updateAccountBalance(method, amount, 'out');
            } else {
              console.warn(`[Restore-Loan] Balance insufficient for "${method}": ৳${_loanBal2} < ৳${amount}`);
              if (typeof Utils !== 'undefined' && Utils.toast) {
                Utils.toast(`⚠️ Loan restore: "${method}"-এ balance যথেষ্ট নেই। Record ফিরে এসেছে, balance manually ঠিক করুন।`, 'warning', 7000);
              }
            }
          }

          // Find linked finance entry by matching fields (same as delete logic)
          const financeEntries = getAll('finance_ledger').filter(f =>
            f._isLoan === true &&
            (f.person_name === (r.person_name || r.person)) &&
            f.type === r.type &&
            f.amount == r.amount &&
            f.date === r.date
          );
          const linkedFinanceId = financeEntries.length > 0 ? financeEntries[0].id : null;
          
          if (linkedFinanceId) {
            // Already exists in finance ledger, nothing to do
          } else {
            // Check recycle bin for the linked finance entry
            const allBin = getAll('recycle_bin');
            const linkedInBin = allBin.find(b => 
              b?.table === 'finance_ledger' &&
              b?.data?._isLoan === true &&
              (b.data.person_name === r.person_name || b.data.person_name === r.person) &&
              b.data.type === r.type &&
              b.data.amount == r.amount &&
              b.data.date === r.date
            );
            
            if (linkedInBin) {
              // Restore the linked finance entry
              const linkedRecord = {
                ...linkedInBin.data,
                updated_at: new Date().toISOString(),
                _device: _deviceId(),
              };
              const finRows = getAll('finance_ledger');
              const fIdx = finRows.findIndex(f => f.id === linkedRecord.id);
              if (fIdx >= 0) finRows[fIdx] = linkedRecord;
              else finRows.unshift(linkedRecord);
              setAll('finance_ledger', finRows);
              untrackDeletion('finance_ledger', linkedRecord.id);
              await _pushRecord('finance_ledger', linkedRecord);
              
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

    if (table === 'students') {
      try {
        const currentBin = getAll('recycle_bin');
        const linkedFinance = currentBin
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b?.table === 'finance_ledger' && b?.data?.ref_id === record.id && b?.data?.category === 'Student Fee')
          .reverse();

        for (const { b, i } of linkedFinance) {
          const fr = { ...b.data, updated_at: new Date().toISOString(), _device: _deviceId() };
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
               updateAccountBalance(fr.method, parseFloat(fr.amount), 'in');
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
      } catch (e) {
        console.warn('[Restore] Student linked finance restore failed:', e);
      }
    }

    const freshBinFinal = getAll('recycle_bin');
    const finalIdx = freshBinFinal.findIndex(x => x?.data?.id === record.id && x?.table === table);
    if (finalIdx !== -1) freshBinFinal.splice(finalIdx, 1);
    setAll('recycle_bin', freshBinFinal);
    _syncRecycleBinToSettings();

    _logRecentChange(table, 'insert', record);
    _logActivity('add', table, _humanReadableLog('restore', table, record));
    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore', table } }));
    return true;
  }

  function permanentDeleteRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin) || index < 0 || index >= bin.length) return;
    const item = bin[index];
    if (!item) return;

    if (item?.table && item?.data?.id) {
      untrackDeletion(item.table, item.data.id);
      _logActivity('delete', item.table, `Permanently deleted ${item.name} from recycle bin`);
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
    settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username','keep_records','recycle_bin_sync','exam_questions','exam_settings'],
    salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','role','phone'],
    students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','guardian_phone','note'],
    finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
    accounts:      ['id','name','type','balance','description','note'],
    loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
    exams:         ['id','reg_id','student_id','student_name','batch','session','subject', 'exam_date','exam_fee','fee_paid','grade','marks','status','note'],
    attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
    staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note'],
    visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','created_at'],
    notices:       ['id','title','text','type','created_at','updated_at','expires_at','is_pinned'],
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

  async function _pushRecord(table, record) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      let clean = _sanitizeRecord(record, table);
      if (_badCols && _badCols[table]) {
        clean = { ...clean };
        _badCols[table].forEach(c => delete clean[c]);
      }
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
      SyncEngine.setStatus('synced');
    } catch (e) {
      console.warn('[Sync] Push record failed:', e);
      SyncEngine.setStatus('error');
      _queueRetry(table, record);
    }
  }

  async function _deleteFromCloud(table, id) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('[Sync] Delete from cloud failed â€” queued for retry:', e);
      _queueRetry(table, { id, _deleteOnly: true });
    }
  }

  function _queueRetry(table, record) {
    try {
      // ✅ FIX: Use IndexedDB (persistent) instead of localStorage (5MB limit)
      // Queue records separately for better reliability
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.setAll === 'function') {
        const queue = SupabaseSync.getAll('retry_queue') || [];
        queue.push({ 
          table, 
          record, 
          at: Date.now(),
          attempts: 0,
          lastError: null
        });
        // Keep only last 100 retry items to avoid bloating IDB
        if (queue.length > 100) {
          queue.splice(0, queue.length - 100);
        }
        SupabaseSync.setAll('retry_queue', queue);
        console.log(`[Sync] Queued ${table} record for retry. Queue size: ${queue.length}`);
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
        console.warn('[Sync] Queued to localStorage (IDB unavailable)');
      }
    } catch (e) { 
      console.warn('[Sync] Failed to queue retry:', e);
    }
  }

  async function processRetryQueue() {
    try {
      // ✅ FIX: Read from IndexedDB (persistent) first, fallback to localStorage
      let queue = [];
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.getAll === 'function') {
        queue = SupabaseSync.getAll('retry_queue') || [];
      }
      // Fallback to localStorage if IDB empty
      if (!queue || queue.length === 0) {
        queue = (() => { 
          try { 
            return JSON.parse(localStorage.getItem('wfa_retry_queue')) || []; 
          } catch { 
            return []; 
          } 
        })();
      }
      
      if (!queue.length) return;
      
      const { client } = window.SUPABASE_CONFIG;
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
            const clean = _sanitizeRecord(item.record, item.table);
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
      } else {
        localStorage.setItem('wfa_retry_queue', JSON.stringify(remaining));
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
    try {
      const normalizedAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
      if (normalizedAmount <= 0) return false;
      const accounts = getAll('accounts');
      let accountIdx = -1;

      if (methodName === 'Cash') {
        accountIdx = accounts.findIndex(a => a.type === 'Cash');
      } else {
        accountIdx = accounts.findIndex(a =>
          (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') && a.name === methodName
        );
      }

      if (accountIdx === -1) {
        if (methodName === 'Cash') {
          // ✅ Fix: prevent creating Cash account with negative starting balance
          if (direction !== 'in' && !force) {
            console.warn(`[Sync] ❌ Cannot create Cash account with negative balance (direction: ${direction}, amount: ${normalizedAmount})`);
            if (typeof Utils !== 'undefined' && Utils.toast) {
              Utils.toast('⚠️ No Cash account exists — please add one in Accounts first.', 'error', 5000);
            }
            return false;
          }
          const newAcc = {
            id: generateId(),
            type: 'Cash',
            name: 'Cash',
            balance: direction === 'in' ? normalizedAmount : (force ? -normalizedAmount : 0),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          accounts.push(newAcc);
          setAll('accounts', accounts);
          await _pushRecord('accounts', newAcc);
          return true;
        }
        return;
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

  return {
    getAll, getById, setAll, insert, update, remove, generateId,
    getDeletedIds, clearDeletedIds, untrackDeletion, processRetryQueue, _deviceId,
    restoreRecycleBinItem, permanentDeleteRecycleBinItem, emptyRecycleBin,
    updateAccountBalance,
    TABLE_COLUMNS,
    _addToRecycleBinPublic: _addToRecycleBin,
    _syncRecycleBinToSettings,
    logActivity: _logActivity,  // ✅ লজিক ৫: modules থেকে specific log লিখতে পারবে
    pullActivityLog: _pullActivityFromCloud, // ✅ সব device-এর activity log sync করে
  };
})();
window.SupabaseSync = SupabaseSync;


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SyncEngine â€” Pull / Push / Real-time / Multi-user
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SyncEngine = (() => {
  const { client, TABLES } = window.SUPABASE_CONFIG;
  let syncInterval = null;
  let realtimeChannels = [];
  let _lastSyncTime = 0;
  let _lastPullTimestamp = null;
  const missingTables = new Set();

  // â”€â”€ Storage Size Guard (IndexedDB-aware) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // IndexedDB à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾à¦¯à¦¼ 5MB limit à¦†à¦° à¦¨à§‡à¦‡à¥¤
  // Warning/Critical threshold à¦…à¦¨à§‡à¦• à¦¬à¦¾à¦¡à¦¼à¦¿à¦¯à¦¼à§‡ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤
  const STORAGE_WARN_KB  = 204800;  // 200 MB — IndexedDB can hold 500MB+
  const STORAGE_CRIT_KB  = 409600;  // 400 MB — only warn when truly high

  function _getStorageUsageKB() {
    return WFA_IDB.getUsageKB();
  }

  function _getTableSizeKB(tableKey) {
    return WFA_IDB.getTableSizeKB(tableKey);
  }

  // IndexedDB-à¦¤à§‡ à¦¸à¦¾à¦§à¦¾à¦°à¦£à¦¤ trim à¦¦à¦°à¦•à¦¾à¦° à¦¹à¦¬à§‡ à¦¨à¦¾ â€” API compatibility-à¦à¦° à¦œà¦¨à§à¦¯ à¦°à¦¾à¦–à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡
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
        Utils.toast(`ðŸ“¦ Local data ${Math.round(usageKB/1024)} MB â€” à¦ªà§à¦°à¦¨à§‹ data archive à¦•à¦°à§à¦¨à¥¤`, 'warn');
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
    const silent = opts.silent !== false ? true : false;
    const forceFull = opts.full === true;
    setStatus('syncing');

    _checkAndManageStorage();

    const isFullPull = forceFull || !_lastPullTimestamp;
    const filterTs   = _lastPullTimestamp;
    const pullStartedAt = new Date().toISOString();

    try {
      let hasChanges = false;

      for (const key of Object.values(TABLES)) {
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
          hasChanges ? `${mode} complete â€” à¦¨à¦¤à§à¦¨ data à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦—à§‡à¦›à§‡ âœ…` : `${mode} complete â€” à¦¸à¦¬ up to date âœ…`,
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
        if (latestCloudTime > 0 && localTime < latestCloudTime - 300_000) {
          // Cloud এ ৫ মিনিটের বেশি আগের record এর চেয়েও পুরনো local row — skip (stale data)
          return;
        }
        merged.set(row.id, row);
      } else {
        const localTime = new Date(row.updated_at || 0).getTime();
        const cloudTime = new Date(existing.updated_at || 0).getTime();
        const diff = Math.abs(localTime - cloudTime);

        if (diff < 10_000 && row._device && existing._device && row._device !== existing._device) {
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
      } catch(e) {}

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
            const protected_fields = ['keep_records', 'recycle_bin', 'activity_log', 'snapshots', 'expense_start_date', 'expense_end_date', 'running_batch', 'monthly_target'];
            const merged = { ...cloudRow };
            for (const f of protected_fields) {
              if (localRow[f] && !merged[f]) merged[f] = localRow[f];
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
                } catch(e) {}
              }
            }
            localMap.set(cloudRow.id, merged);
          } else {
            localMap.set(cloudRow.id, cloudRow);
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
      const { client } = window.SUPABASE_CONFIG;

      // ── Safety check: fresh device এ blindly push করবে না ──
      // _lastPullTimestamp না থাকলে মানে এই device এ full pull হয়নি।
      // সেক্ষেত্রে local data stale হতে পারে, push skip করো।
      if (!_lastPullTimestamp && !opts.forcePush) {
        console.warn('[Sync] Push skipped — no pull timestamp (fresh device). Pull first.');
        setStatus('synced');
        return;
      }

      for (const key of Object.values(TABLES)) {
        if (missingTables.has(key)) continue;
        const rows = SupabaseSync.getAll(key);
        if (!rows.length) continue;
        const cleanRows = rows.map(r => _sanitizeRecord(r, key));
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
    if (!client?.channel) return;
    stopRealtime();

    for (const key of Object.values(TABLES)) {
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
    realtimeChannels.forEach(ch => {
      try { client.removeChannel(ch); } catch { /* ignore */ }
    });
    realtimeChannels = [];
  }

  function _handleRealtimeEvent(table, payload) {
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
          rows[idx] = newRow;
        } else {
          rows.unshift(newRow);
        }
        SupabaseSync.setAll(table, rows);
      } else if (eventType === 'DELETE') {
        if (!oldRow?.id) return;
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
        if (Date.now() - _lastSyncTime > 60_000) {
          pull({ silent: true }).catch(e => {
            console.error('[Sync] Silent pull interval error (with realtime):', e);
          });
        }
      }
    }, 30_000);

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
      console.log('[Sync] Back online');
      setStatus('syncing');
      syncAll({ silent: true }).then(() => { startRealtime(); SupabaseSync.pullActivityLog && SupabaseSync.pullActivityLog(); });
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Gone offline');
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
          : 'â€”',
      };
    }
    return stats;
  }

  function getLocal(table)       { return SupabaseSync.getAll(table); }
  function setLocal(table, rows) { SupabaseSync.setAll(table, rows); }

  setupNetworkListeners();

  return {
    pull, push, syncAll, fullPull,
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
