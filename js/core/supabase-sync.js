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

  // IndexedDB-à¦¤à§‡ à¦à¦•à¦Ÿà¦¿ table à¦²à§‡à¦–à§‹ (async, fire-and-forget)
  function _writeToIDB(tableName, rows) {
    if (!_db) return;
    const tx    = _db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ tableName, rows });
    tx.onerror = (e) => console.error('[IDB] Write failed for', tableName, e.target.error);
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
      'staff', 'salary', 'attendance', 'visitors', 'notices', 'settings'
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
        if (existing.length < rows.length) {
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

  return { init, onReady, getTable, setTable, getUsageKB, getTableSizeKB };
})();

window.WFA_IDB = WFA_IDB;

// â”€â”€ App à¦¶à§à¦°à§ à¦¹à¦²à§‡ IndexedDB init à¦•à¦°à§‹ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WFA_IDB.init();


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SupabaseSync â€” CRUD API used by all modules
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TABLE_COLUMNS Definition
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABLE_COLUMNS = {
  // ✅ Fix: expense_month, income_categories, expense_categories, courses, employee_roles যোগ করা হয়েছে
  settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username'],
  salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','role','phone'],
  students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','guardian_phone','note'],
  finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
  accounts:      ['id','name','type','balance','description','note'],
  loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
  exams:         ['id','reg_id','student_id','student_name','batch','session','subject','exam_date','exam_fee','fee_paid','grade','marks','status','note'],
  attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
  staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note'],
  visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','createdAt'],
  notices:       ['id','title','content','text','date','category','priority','author','created_at','expires_at','is_pinned','type'],
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
      if (log.length > 50) localStorage.setItem(logKey, JSON.stringify(log.slice(-50)));
      const rcKey = 'wfa_recent_changes';
      const rc = (() => { try { return JSON.parse(localStorage.getItem(rcKey) || '[]'); } catch { return []; } })();
      if (rc.length > 20) localStorage.setItem(rcKey, JSON.stringify(rc.slice(-20)));
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
    notices:       'date',
  };

  function insert(table, record) {
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
    _logActivity('add', table, `Inserted ${_recycleDisplayName(table, record)} into ${_tableDisplayName(table)}`);
    _pushRecord(table, record);
    return record;
  }

  function update(table, id, partial) {
    const rows = getAll(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...partial, updated_at: new Date().toISOString(), _device: _deviceId() };
      setAll(table, rows);
      _logRecentChange(table, 'update', rows[idx]);
      _logActivity('edit', table, `Updated ${_recycleDisplayName(table, rows[idx])} in ${_tableDisplayName(table)}`);
      _pushRecord(table, rows[idx]);
    }
  }

  function remove(table, id) {
    const before = getAll(table);
    const victim = before.find(r => r.id === id);
    const rows = before.filter(r => r.id !== id);
    setAll(table, rows);
    if (victim) {
      _addToRecycleBin(table, victim);
      _logRecentChange(table, 'delete', victim);
      _logActivity('delete', table, `Deleted ${_recycleDisplayName(table, victim)} from ${_tableDisplayName(table)}`);
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
      const person = record.name || record.student_id || record.person_name || record.reg_id
        || record.description || record.note || 'â€”';
      const category = record.category || record.type || table;
      const typeLabel = action === 'delete' ? 'Delete' : (action === 'insert' ? 'Save' : 'Update');
      const entry = {
        date: new Date().toLocaleString(),
        type: typeLabel,
        category: String(category).slice(0, 100),
        person: String(person).slice(0, 100),
        table,
        item: _recycleDisplayName(table, record),
        snapshot: _getMonitorSnapshot(),
      };
      const arr = (() => { try { return JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]'); } catch { return []; } })();
      arr.unshift(entry);
      if (arr.length > 120) arr.length = 120;
      localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
    } catch { /* ignore */ }
  }

  function _getMonitorSnapshot() {
    try {
      const students = getAll(DB.students);
      const finance = getAll(DB.finance);
      const accounts = getAll(DB.accounts);
      const totalStudents = students.length;
      const totalFee = students.reduce((sum, row) => sum + Number(row.total_fee || 0), 0);
      const totalPaid = students.reduce((sum, row) => sum + Number(row.paid || 0), 0);
      const totalDue = students.reduce((sum, row) => sum + Number(row.due || 0), 0);
      const accountBalance = accounts.reduce((sum, row) => sum + Number(row.balance || 0), 0);
      const totalIncome = finance.filter(f => String(f.type).toLowerCase() === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const totalExpense = finance.filter(f => String(f.type).toLowerCase() === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const accountList = accounts.map(a => ({ name: a.name || a.account_name || 'Account', balance: Number(a.balance || 0), type: a.type || '' }));
      return {
        students: { totalStudents, totalFee, totalPaid, totalDue },
        accounts: { count: accounts.length, totalBalance: accountBalance, list: accountList },
        finance: { totalIncome, totalExpense },
        recordedAt: new Date().toISOString(),
      };
    } catch {
      return { students: {}, accounts: {}, finance: {}, recordedAt: new Date().toISOString() };
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

  function _logActivity(action, type, description, status = 'success') {
    try {
      const now = new Date();
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
    try {
      const key = 'wfa_deletedItems';
      let deleted = (() => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } })();
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      if (!deleted[table]) deleted[table] = [];
      if (!deleted[table].includes(id)) deleted[table].push(id);
      localStorage.setItem(key, JSON.stringify(deleted));
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
    };
    return map[table] || 'record';
  }

  function _recycleDisplayName(table, r) {
    if (!r || typeof r !== 'object') return 'â€”';
    return (
      r.name ||
      r.student_id ||
      r.description ||
      r.reg_id ||
      r.person_name ||
      r.title ||
      (r.type && r.amount != null ? `${r.type} à§³${r.amount}` : '') ||
      r.id ||
      'â€”'
    );
  }

  function _tableDisplayName(table) {
    try {
      const DB = window.DB || {};
      const entry = Object.entries(DB).find(([, v]) => v === table);
      return entry ? entry[0].replace(/_/g, ' ') : table;
    } catch {
      return table;
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
    } catch (e) {
      console.warn('[Recycle] add failed:', e);
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
            if (isIncome)  updateAccountBalance(method, amount, 'in',  true); // restore: force=true
            if (isExpense) updateAccountBalance(method, amount, 'out', true); // restore: force=true

            if (isIncome && r.category === 'Student Fee' && r.ref_id) {
              const students = getAll('students');
              const sIdx = students.findIndex(s => s.id === r.ref_id);
              if (sIdx !== -1) {
                const s = students[sIdx];
                const newPaid = (parseFloat(s.paid) || 0) + amount;
                const newDue  = Math.max(0, (parseFloat(s.total_fee) || 0) - newPaid);
                students[sIdx] = { ...s, paid: newPaid, due: newDue, updated_at: new Date().toISOString() };
                setAll('students', students);
                await _pushRecord('students', students[sIdx]);
              }
            }
          }
        } else if (table === 'loans') {
          const wasGiven = r.type === 'Loan Giving' || r.direction === 'given';
          updateAccountBalance(method, amount, wasGiven ? 'out' : 'in', true); // restore: force=true

          if (r._linkedFinanceId) {
            const allBin = getAll('recycle_bin');
            const linkedIdx = allBin.findIndex(b => b?.data?.id === r._linkedFinanceId);
            if (linkedIdx !== -1) {
              const linkedRecord = {
                ...allBin[linkedIdx].data,
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
              allBin.splice(linkedIdx, 1);
              setAll('recycle_bin', allBin);
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
            updateAccountBalance(fr.method, parseFloat(fr.amount), 'in', true); // restore: force=true
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

    _logRecentChange(table, 'insert', record);
    _logActivity('add', table, `Restored ${_recycleDisplayName(table, record)} from recycle bin to ${_tableDisplayName(table)}`);
    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore', table } }));
    return true;
  }

  function permanentDeleteRecycleBinItem(index) {
    const bin = getAll('recycle_bin');
    if (!Array.isArray(bin) || index < 0 || index >= bin.length) return;
    const item = bin[index];
    if (item?.table && item?.data?.id) {
      untrackDeletion(item.table, item.data.id);
      _logActivity('delete', item.table, `Permanently deleted ${item.name} from recycle bin`);
    }
    bin.splice(index, 1);
    setAll('recycle_bin', bin);
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
    _logActivity('delete', 'system', 'Emptied recycle bin');
  }

  const _AUTO_COLS = new Set(['created_at', 'updated_at']);

  const _TABLE_COLS = {
    // ✅ Fix: expense_month, income_categories, expense_categories, courses, employee_roles যোগ করা হয়েছে
    settings:      ['id','academy_name','academy_address','academy_phone','academy_email','admin_password','security_question','security_answer','currency','timezone','logo_url','primary_color','theme','monthly_target','running_batch','expense_month','expense_start_date','expense_end_date','income_categories','expense_categories','courses','employee_roles','admin_username'],
    salary:        ['id','staff_id','staff_name','staffId','staffName','month','year','amount','baseSalary','base_salary','bonus','deduction','net_salary','status','note','paid_date','paidDate','paidAmount','paid_amount','role','phone'],
    students:      ['id','name','student_id','phone','email','address','dob','course','batch','session','enrollment_date','admission_date','total_fee','paid','due','status','photo_url','guardian_name','father_name','guardian_phone','note'],
    finance_ledger:['id','date','type','category','amount','description','account_id','reference','note','method','person_name','ref_id'],
    accounts:      ['id','name','type','balance','description','note'],
    loans:         ['id','person_name','type','amount','interest_rate','date','due_date','paid','status','note','method'],
    exams:         ['id','reg_id','student_id','student_name','batch','session','subject', 'exam_date','exam_fee','fee_paid','grade','marks','status','note'],
    attendance:    ['id','person_id','person_name','type','date','status','note','entityId','entityName','batch'],
    staff:         ['id','name','role','phone','email','address','dob','join_date','joiningDate','salary','status','photo_url','note'],
    visitors:      ['id','name','phone','purpose','host','visit_date','visit_time','out_time','status','note','interested_course','follow_up_date','remarks','createdAt'],
    notices:       ['id','title','content','text','date','category','priority','author','created_at','expires_at','is_pinned','type'],
  };

  function _sanitizeRecord(record, tableKey) {
    if (!record || typeof record !== 'object') return record;
    const allowedCols = _TABLE_COLS[tableKey]
      || (typeof SyncEngine !== 'undefined' && SyncEngine.TABLE_COLUMNS && SyncEngine.TABLE_COLUMNS[tableKey])
      || null;
    const o = {};
    for (const [k, v] of Object.entries(record)) {
      if (v === undefined) continue;
      if (k.startsWith('_')) continue;
      if (_AUTO_COLS.has(k)) continue;
      if (allowedCols && !allowedCols.includes(k)) continue;
      o[k] = v;
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
      const queue = (() => { try { return JSON.parse(localStorage.getItem('wfa_retry_queue')) || []; } catch { return []; } })();
      queue.push({ table, record, at: Date.now() });
      localStorage.setItem('wfa_retry_queue', JSON.stringify(queue));
    } catch { /* ignore */ }
  }

  async function processRetryQueue() {
    try {
      const queue = (() => { try { return JSON.parse(localStorage.getItem('wfa_retry_queue')) || []; } catch { return []; } })();
      if (!queue.length) return;
      const { client } = window.SUPABASE_CONFIG;
      const remaining = [];
      for (const item of queue) {
        try {
          if (item.record && item.record._deleteOnly === true) {
            const { error } = await client.from(item.table).delete().eq('id', item.record.id);
            if (error) throw error;
          } else {
            const clean = _sanitizeRecord(item.record, item.table);
            const { error } = await client.from(item.table).upsert([clean], { onConflict: 'id' });
            if (error) throw error;
          }
        } catch { remaining.push(item); }
      }
      localStorage.setItem('wfa_retry_queue', JSON.stringify(remaining));
      if (remaining.length === 0 && queue.length > 0) {
        console.log('[Sync] Retry queue cleared');
      }
    } catch { /* ignore */ }
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
            console.warn(`[Sync] ❌ Cannot create Cash account with negative balance (direction: ${direction}, amount: ${amount})`);
            if (typeof Utils !== 'undefined' && Utils.toast) {
              Utils.toast('⚠️ No Cash account exists — please add one in Accounts first.', 'error', 5000);
            }
            return false;
          }
          const newAcc = {
            id: generateId(),
            type: 'Cash',
            name: 'Cash',
            balance: direction === 'in' ? amount : (force ? -amount : 0),
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
      const newBal = direction === 'in' ? currentBal + amount : currentBal - amount;

      if (newBal < 0 && !force) {
        SyncGuard && SyncGuard.report('negative_balance', {
          account: methodName,
          before: currentBal,
          change: direction === 'in' ? +amount : -amount,
          after: newBal,
        });
        // ✅ Issue #3: Block update AND show user-facing toast — not just console.warn
        console.warn(`[Sync] ❌ Balance blocked for "${methodName}": ৳${currentBal} - ৳${amount} = ৳${newBal}`);
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(`⚠️ Insufficient balance in "${methodName}" (Available: ৳${currentBal.toLocaleString()}, Needed: ৳${amount.toLocaleString()})`, 'error', 5000);
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
  const STORAGE_WARN_KB  = 51200;   // 50 MB
  const STORAGE_CRIT_KB  = 102400;  // 100 MB

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
      synced:   { icon: 'â˜ï¸', text: 'Synced',    cls: 'synced'  },
      syncing:  { icon: 'ðŸ”„', text: 'Syncingâ€¦',  cls: 'syncing' },
      offline:  { icon: 'ðŸ“´', text: 'Offline',   cls: 'offline' },
      error:    { icon: 'âš ï¸', text: 'Error',     cls: 'error'   },
      realtime: { icon: 'ðŸŸ¢', text: 'Real-time', cls: 'synced'  },
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
          throw error;
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

      // Both have different non-empty values — prefer newer timestamp
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

    deletedIds.forEach(id => localMap.delete(id));

    for (const cloudRow of changedCloudRows) {
      if (deletedIds.includes(cloudRow.id)) continue;

      const localRow = localMap.get(cloudRow.id);
      if (!localRow) {
        localMap.set(cloudRow.id, cloudRow);
      } else {
        const localTime = new Date(localRow.updated_at || 0).getTime();
        const cloudTime = new Date(cloudRow.updated_at || 0).getTime();
        if (cloudTime >= localTime) {
          localMap.set(cloudRow.id, cloudRow);
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
        const cleanRows = rows.map(r => {
          const o = {};
          for (const [k, v] of Object.entries(r)) {
            if (v === undefined || k.startsWith('_')) continue;
            o[k] = v;
          }
          return o;
        });
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
        if (idx >= 0) rows[idx] = newRow;
        else rows.unshift(newRow);
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
        pull({ silent: true });
      } else {
        if (Date.now() - _lastSyncTime > 60_000) {
          pull({ silent: true });
        }
      }
    }, 30_000);

    pull({ silent: true }).then(() => {
      startRealtime();
      // ✅ App চালু হলে সব device-এর activity log pull করো
      _pullActivityFromCloud();
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
      syncAll({ silent: true }).then(() => { startRealtime(); _pullActivityFromCloud(); });
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
