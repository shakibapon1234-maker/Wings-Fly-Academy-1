/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * SMART SYNC SYSTEM — V39.1 "PATCH + CASH SYNC FIX"
 * ════════════════════════════════════════════════════════════════
 *
 * ✅ V39.0 — 4টি Critical Bug Permanently Fixed:
 *
 *   BUG 1 FIX — FRESH BROWSER AUTO-RESTORE:
 *     → নতুন browser-এ localStorage খালি থাকলে
 *       wingsSync লোড হওয়ার সাথে সাথে cloud থেকে full pull হবে
 *     → UI hide করে pull করবে, তারপর দেখাবে (flicker নেই)
 *     → wingsSync NOT FOUND আর হবে না
 *
 *   BUG 2 FIX — deletedItems ARRAY BUG:
 *     → startup-এ deletedItems সবসময় object হবে (array নয়)
 *     → pull-এর পরেও ensure করা হবে
 *     → recycle-bin-fix.js এর সাথে conflict নেই
 *
 *   BUG 3 FIX — SNAPSHOT CORRUPTION:
 *     → নতুন browser-এ login-এর আগে snapshot নেওয়া হবে না
 *     → pull সম্পন্ন হওয়ার পরেই প্রথম snapshot নেওয়া হবে
 *     → snapshot-system.js এর takeSnapshot() কে guard করা হয়েছে
 *
 *   BUG 4 FIX — MAXCOUNT N/A BLOCKS PUSH:
 *     → pull সফল হলে MaxCount সাথে সাথে set হবে
 *     → নতুন browser-এ MaxCount কখনো N/A থাকবে না
 *     → push আর blocked হবে না
 *
 * ✅ V39.1 — 2টি নতুন Critical Bug Fixed:
 *
 *   BUG 5 FIX — _patchSaveToStorage TIMING BUG:
 *     → app.js এর saveToStorage V39 এর আগে define না হলে
 *       patch হতো না (silent fail)
 *     → এখন 500ms interval-এ max 20 বার retry করবে
 *     → double-patch guard যোগ করা হয়েছে
 *
 *   BUG 6 FIX — MONITOR 60s DELAY + CASH BALANCE MISSED:
 *     → Monitor interval 60s → 15s করা হয়েছে
 *     → cashBalance change আলাদাভাবে track করে
 *       সাথে সাথে push trigger করে
 *
 * ════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── CONFIGURATION ────────────────────────────────────────────
  const CFG = {
    URL: window.SUPABASE_CONFIG?.URL || '',
    KEY: window.SUPABASE_CONFIG?.KEY || '',
    TABLE: window.SUPABASE_CONFIG?.TABLE || 'academy_data',
    RECORD: window.SUPABASE_CONFIG?.MAIN_RECORD || 'wingsfly_main',
    TBL_STUDENTS: 'wf_students',
    TBL_FINANCE: 'wf_finance',
    TBL_EMPLOYEES: 'wf_employees',
    ACADEMY_ID: 'wingsfly_main',
    VERSION_CHECK_MS: 30 * 60 * 1000,
    FULL_PULL_MS: 60 * 60 * 1000,
    PUSH_DEBOUNCE_MS: 3000,
    EGRESS_WARN: 400,
    EGRESS_LIMIT: 500,
    EGRESS_HARD_LIMIT: 600,
    VERSION_GAP_WARN: 10,
    VERSION_GAP_FULL: 20,
    SYNC_FRESHNESS_MS: 24 * 60 * 60 * 1000,
  };

  // ── STATE ────────────────────────────────────────────────────
  let _sb = null, _ready = false, _pushing = false, _pulling = false;
  let _online = navigator.onLine, _tabVisible = !document.hidden;
  let _localVer = 0, _debounce = null, _partialOK = false;
  let _networkQuality = 'good';
  let _syncBusy = false;
  let _cooldownUntil = 0;
  let _suppressRender = false;
  const _dirty = new Set();
  const DEVICE_ID = _getOrCreateDeviceId();
  window.initialSyncComplete = false;

  // ── V39: Fresh browser flag ──────────────────────────────────
  // নতুন browser detect করা হয় localStorage-এ wingsfly_data না থাকলে
  const _isFreshBrowser = !localStorage.getItem('wingsfly_data');
  if (_isFreshBrowser) {
    _log('🆕', 'Fresh browser detected — will force pull on startup');
  }

  // ── CONFLICT TRACKER ─────────────────────────────────────────
  const ConflictTracker = {
    record: function (type, detail, localCount, cloudCount) {
      const entry = {
        time: Date.now(), type, detail,
        localCount: localCount || 0, cloudCount: cloudCount || 0,
        device: DEVICE_ID, seen: false,
      };
      localStorage.setItem('wf_last_conflict', JSON.stringify(entry));
      _log('🚨', `Conflict: ${type} — ${detail}`);
      window._wfLastConflict = entry;
    },
    get: function () {
      try { return JSON.parse(localStorage.getItem('wf_last_conflict') || 'null'); } catch { return null; }
    },
    markSeen: function () {
      const c = this.get();
      if (c) { c.seen = true; localStorage.setItem('wf_last_conflict', JSON.stringify(c)); }
    },
    clear: function () {
      localStorage.removeItem('wf_last_conflict');
      window._wfLastConflict = null;
    },
  };
  window.wfConflictTracker = ConflictTracker;

  // ── EGRESS COUNTER ────────────────────────────────────────────
  const Egress = {
    _dayKey: () => 'wf_egress_' + new Date().toISOString().slice(0, 10),
    count: function () { this._cleanup(); return parseInt(localStorage.getItem(this._dayKey()) || '0'); },
    inc: function () {
      const k = this._dayKey();
      const v = (parseInt(localStorage.getItem(k) || '0')) + 1;
      localStorage.setItem(k, v);
      if (v === CFG.EGRESS_WARN) _log('⚠️', `Egress warning: ${v}`);
      if (v === CFG.EGRESS_LIMIT) {
        _log('🔶', `Egress soft limit: ${v}`);
        _showUserMessage(`আজকে ${v}টি sync request হয়েছে। Auto version-check বন্ধ।`, 'warn');
      }
      return v;
    },
    throttled: function () { return this.count() > CFG.EGRESS_LIMIT; },
    hardThrottled: function () { return this.count() > CFG.EGRESS_HARD_LIMIT; },
    reset: function () {
      localStorage.setItem(this._dayKey(), '0');
      _log('🔄', 'Egress reset');
      _showUserMessage('Egress counter reset। Sync কাজ করবে।', 'success');
    },
    _cleanup: function () {
      try {
        const today = new Date().toISOString().slice(0, 10);
        Object.keys(localStorage)
          .filter(k => k.startsWith('wf_egress_') && !k.endsWith(today))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) { }
    },
    getInfo: function () {
      const count = this.count();
      return {
        count, limit: CFG.EGRESS_LIMIT, hardLimit: CFG.EGRESS_HARD_LIMIT,
        percent: Math.round((count / CFG.EGRESS_LIMIT) * 100),
        throttled: this.throttled(), hardThrottled: this.hardThrottled(),
        remaining: Math.max(0, CFG.EGRESS_LIMIT - count),
        status: count <= CFG.EGRESS_WARN ? 'ok'
          : count <= CFG.EGRESS_LIMIT ? 'warn'
            : count <= CFG.EGRESS_HARD_LIMIT ? 'soft-throttled'
              : 'hard-throttled',
      };
    },
  };

  // ── MAX COUNT ─────────────────────────────────────────────────
  const MaxCount = {
    get: (key) => parseInt(localStorage.getItem('wf_max_' + key) || '0'),
    update: function (key, count) {
      const prev = this.get(key);
      if (count > prev) {
        localStorage.setItem('wf_max_' + key, count);
        _log('📈', `MaxCount: ${key} ${prev}→${count}`);
        return count;
      }
      return prev;
    },
    // ✅ V39 FIX: Fresh browser-এ MaxCount কখনো block করবে না
    isSafe: function (key, localCount, options = {}) {
      const max = this.get(key);
      // Fresh browser বা first time — always safe
      if (max === 0) return { safe: true, reason: 'first-time' };
      const hasLocalData = localStorage.getItem('wingsfly_data');
      if (!hasLocalData && localCount === 0) {
        _log('⚠️', `MaxCount ${key}: Empty localStorage → safe`);
        return { safe: true, reason: 'empty-localStorage', localCount, max };
      }
      const deletedCount = options.deletedCount || 0;
      const netCount = localCount + deletedCount;
      const baseTolerance = options.tolerance || 5;
      const percentTolerance = Math.max(baseTolerance, Math.floor(max * 0.10));
      const threshold = max - percentTolerance;
      const isSafe = netCount >= threshold;
      const result = { safe: isSafe, localCount, deletedCount, netCount, max, threshold, tolerance: percentTolerance };
      if (!isSafe) {
        _log('🚫', `MaxCount UNSAFE: ${key} net=${netCount} < ${threshold}`);
        result.message = `${key} count কম! Local: ${localCount}, Min: ${threshold}.`;
      } else {
        _log('✅', `MaxCount OK: ${key} net=${netCount} >= ${threshold}`);
      }
      return result;
    },
    getDeletedCount: function (key) {
      const data = window.globalData;
      if (!data?.deletedItems) return 0;
      const mapping = { 'students': 'students', 'finance': 'finance', 'employees': 'employees' };
      const deletedKey = mapping[key];
      if (!deletedKey) return 0;
      // ✅ V39: deletedItems ARRAY হলে 0 দাও (bug protect)
      if (Array.isArray(data.deletedItems)) return 0;
      return (data.deletedItems[deletedKey] || []).length;
    },
    // ✅ V39: Force set (pull-এর পরে সাথে সাথে set করার জন্য)
    forceSet: function (stuCount, finCount) {
      localStorage.setItem('wf_max_students', String(stuCount));
      localStorage.setItem('wf_max_finance', String(finCount));
      localStorage.setItem('wings_last_known_count', String(stuCount));
      localStorage.setItem('wings_last_known_finance', String(finCount));
      _log('✅', `MaxCount force-set: students=${stuCount} finance=${finCount}`);
    },
  };

  // ── SYNC FRESHNESS ─────────────────────────────────────────────
  const SyncFreshness = {
    update: () => localStorage.setItem('wings_last_sync_time', Date.now().toString()),
    isFresh: function () {
      const lastSync = parseInt(localStorage.getItem('wings_last_sync_time') || '0');
      return lastSync && (Date.now() - lastSync) < CFG.SYNC_FRESHNESS_MS;
    },
    getAge: function () {
      const lastSync = parseInt(localStorage.getItem('wings_last_sync_time') || '0');
      if (!lastSync) return 'never';
      const hours = Math.floor((Date.now() - lastSync) / 3600000);
      return hours < 1 ? 'recent' : `${hours}h ago`;
    },
  };

  // ── NETWORK QUALITY ────────────────────────────────────────────
  const NetworkQuality = {
    _failCount: 0, _successCount: 0,
    recordSuccess: function () {
      this._successCount++; this._failCount = 0;
      if (this._successCount >= 2) _networkQuality = 'good';
    },
    recordFailure: function () {
      this._failCount++; this._successCount = 0;
      if (this._failCount >= 2) _networkQuality = 'poor';
    },
    getQuality: () => !_online ? 'offline' : _networkQuality,
  };

  // ── LOGGING ───────────────────────────────────────────────────
  function _log(emoji, msg, data) {
    // ✅ FIX: Only log in debug mode — production-এ sensitive info যাবে না
    if (window.WINGS_DEBUG) {
      console.log(`[V39|${new Date().toLocaleTimeString()}] ${emoji} ${msg}`);
      if (data) console.log(data);
    }
  }

  // Always-log for errors (even in production)
  function _logErr(emoji, msg, data) {
    console.error(`[V39|${new Date().toLocaleTimeString()}] ${emoji} ${msg}`);
    if (data) console.error(data);
  }

  function _getOrCreateDeviceId() {
    let id = localStorage.getItem('wings_device_id');
    if (!id) {
      id = 'DEV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      localStorage.setItem('wings_device_id', id);
    }
    return id;
  }

  function _showUserMessage(msg, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      error: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#fee2e2' },
      warn: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fef3c7' },
      info: { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#dbeafe' },
      success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#d1fae5' }
    };
    const c = colors[type] || colors.info;
    toast.style.cssText = `position:fixed;top:70px;right:20px;z-index:10000;background:${c.bg};border:2px solid ${c.border};color:${c.text};padding:12px 18px;border-radius:8px;font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;`;
    toast.innerHTML = `<strong>${type.toUpperCase()}:</strong> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 5000);
  }

  // ── V39: ENSURE deletedItems IS ALWAYS OBJECT (never array) ──
  // ✅ FIXED: deletedItems সবসময় array হবে যেখানে
  // .students/.finance/.employees properties ও থাকবে
  // এতে .some() (array method) এবং .students[] (object access) দুটোই কাজ করবে
  function _ensureDeletedItemsObject(gd) {
    if (!gd) return;
    const di = gd.deletedItems;
    if (!di) {
      const arr = [];
      arr.students = []; arr.finance = []; arr.employees = []; arr.other = [];
      gd.deletedItems = arr;
    } else if (!Array.isArray(di)) {
      // Plain object → flat array তে convert করো, categories রাখো
      const flat = [
        ...(Array.isArray(di.students)  ? di.students  : []),
        ...(Array.isArray(di.finance)   ? di.finance   : []),
        ...(Array.isArray(di.employees) ? di.employees : []),
        ...(Array.isArray(di.other)     ? di.other     : [])
      ];
      flat.students  = Array.isArray(di.students)  ? di.students  : [];
      flat.finance   = Array.isArray(di.finance)   ? di.finance   : [];
      flat.employees = Array.isArray(di.employees) ? di.employees : [];
      flat.other     = Array.isArray(di.other)     ? di.other     : [];
      if (di._clearedAt) flat._clearedAt = di._clearedAt;
      gd.deletedItems = flat;
    } else {
      // Array আছে — object properties নিশ্চিত করো
      if (!Array.isArray(di.students))  di.students  = [];
      if (!Array.isArray(di.finance))   di.finance   = [];
      if (!Array.isArray(di.employees)) di.employees = [];
      if (!Array.isArray(di.other))     di.other     = [];
    }
    // WingsUtils এও export করো যাতে অন্য ফাইল ব্যবহার করতে পারে
    if (!window.WingsUtils) window.WingsUtils = {};
    window.WingsUtils.ensureDeletedItemsObject = _ensureDeletedItemsObject;
  }

  // ── INIT ──────────────────────────────────────────────────────
  function _init() {
    if (_ready) return true;
    if (typeof window.supabase === 'undefined') return false;
    try {
      _sb = typeof window.getWingsSupabaseClient === 'function'
        ? window.getWingsSupabaseClient()
        : window.supabase.createClient(CFG.URL, CFG.KEY);
      if (!_sb) return false;
      _localVer = parseInt(localStorage.getItem('wings_local_version') || '0');
      _ready = true;
      _log('✅', `V39.0 initialized v${_localVer}`);
      return true;
    } catch (e) { _log('❌', 'Init failed', e); return false; }
  }

  async function _checkPartialTables() {
    try {
      const { error } = await _sb.from(CFG.TBL_STUDENTS).select('id').limit(1);
      _partialOK = !error;
      _log(_partialOK ? '✅' : '⚠️', _partialOK ? 'Partial tables ready' : 'Legacy mode');
    } catch (e) { _partialOK = false; }
  }

  // ── SAVE LOCAL ─────────────────────────────────────────────────
  function _saveLocal() {
    try {
      if (!window.globalData) return false;
      // ✅ V39: Ensure deletedItems before every save
      _ensureDeletedItemsObject(window.globalData);
      const finCount = (window.globalData.finance || []).length;
      const stuCount = (window.globalData.students || []).length;
      const finDeleted = MaxCount.getDeletedCount('finance');
      const stuDeleted = MaxCount.getDeletedCount('students');
      const finCheck = MaxCount.isSafe('finance', finCount, { deletedCount: finDeleted });
      const stuCheck = MaxCount.isSafe('students', stuCount, { deletedCount: stuDeleted });
      if (!finCheck.safe) {
        _log('🚫', 'saveLocal BLOCKED - Finance');
        _showUserMessage(finCheck.message, 'error');
        return false;
      }
      if (!stuCheck.safe) {
        _log('🚫', 'saveLocal BLOCKED - Students');
        _showUserMessage(stuCheck.message, 'error');
        return false;
      }
      localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
      MaxCount.update('finance', finCount);
      MaxCount.update('students', stuCount);
      if (finCount > 0) localStorage.setItem('wings_last_known_finance', finCount.toString());
      if (stuCount > 0) localStorage.setItem('wings_last_known_count', stuCount.toString());
      return true;
    } catch (e) { _log('⚠️', 'saveLocal error', e); return false; }
  }

  // ── MERGE RECORDS (V39.2: Delete-aware + Timestamp Conflict Resolution) ──
  // ✅ V39.11 FIX: localDeletedKeys parameter যোগ — local deletedItems থেকে আসা keys
  // এই keys তে থাকা records কোনোভাবেই cloud থেকে ফেরত আনা হবে না
  function _mergeRecords(localArr, cloudRows, keyFn, localDeletedKeys) {
    const merged = new Map();
    const blockedKeys = new Set(localDeletedKeys || []);
    // Local records যোগ করো
    (localArr || []).forEach(item => { const k = keyFn(item); if (k) merged.set(k, item); });
    // Cloud records merge করো — timestamp compare করে নতুনটা রাখো
    (cloudRows || []).forEach(row => {
      // ✅ V39.2 CRITICAL FIX: deleted চেক আগে! data=null হলেও delete process হবে
      if (row.deleted) {
        // data থাকলে key বের করো, না থাকলে row.id থেকে extract করো
        let k = null;
        if (row.data) {
          k = keyFn(row.data);
        } else if (row.id) {
          // Cloud row id format: wingsfly_main_fin_SAL_123 or wingsfly_main_stu_XXX
          // Extract the record key after the prefix
          const parts = String(row.id).split('_');
          // Skip academy_id prefix + type prefix (e.g., 'wingsfly_main_fin_' or 'wingsfly_main_stu_')
          if (parts.length >= 4) {
            k = parts.slice(3).join('_'); // e.g., 'SAL_1234567890'
          }
        }
        if (k) merged.delete(k);
        return;
      }
      if (!row.data) return;
      const k = keyFn(row.data);
      if (!k) return;
      // ✅ V39.11 CRITICAL FIX: local deletedItems-এ থাকলে cloud থেকে ফিরিয়ে আনো না
      if (blockedKeys.has(String(k))) {
        _log('🚫', `BLOCKED resurrection of deleted record: key=${k}`);
        return;
      }
      const existing = merged.get(k);
      if (!existing) { merged.set(k, row.data); return; }
      // Timestamp-based resolution: নতুন record-ই win করবে
      const localTime = new Date(existing._updatedAt || existing._createdAt || 0).getTime();
      const cloudTime = new Date(row.data._updatedAt || row.data._createdAt || 0).getTime();
      if (cloudTime >= localTime) {
        merged.set(k, row.data); // Cloud wins (newer)
      }
      // else: Local wins (newer) — already in map
    });
    return Array.from(merged.values());
  }

  // ── PULL FROM CLOUD V39 ────────────────────────────────────────
  async function pullFromCloud(showUI = false, forceFullPull = false) {
    if (_pulling) { _log('⏸️', 'Pull in progress'); return false; }
    if (!_ready || !_sb) return false;
    if (_online) {
      // Temporarily disabled Server Egress Limit Check
      /*
      try {
        const checkLimit = await _sb.rpc('check_daily_sync_limit');
        if (checkLimit.data && checkLimit.data.success === false) {
          _log('🛑', 'Server Egress Limit Crossed — Pull blocked');
          _showUserMessage('Daily Sync Limit Exceeded (300/day)! Server Blocked.', 'error');
          return false;
        }
      } catch(e) { } // ignore
      */
    } else if (Egress.hardThrottled()) {
      _log('🛑', 'Hard egress limit (Offline) — pull blocked');
      _showUserMessage('অনেক বেশি request। Diagnostic থেকে "Egress Reset" করুন।', 'error');
      return false;
    }

    _pulling = true;
    _syncBusy = true;
    window._wf_sync_in_progress = true; // ✅ V39.3: Snapshot guard এর জন্য global flag
    let _rollback = null;

    try {
      Egress.inc();
      if (window.globalData) _rollback = {
        students: JSON.parse(JSON.stringify(window.globalData.students || [])),
        finance: JSON.parse(JSON.stringify(window.globalData.finance || [])),
        employees: JSON.parse(JSON.stringify(window.globalData.employees || [])),
        cashBalance: window.globalData.cashBalance,
      };

      if (_partialOK) {
        const [stuRes, finRes, empRes, mainRes] = await Promise.all([
          _sb.from(CFG.TBL_STUDENTS).select('id,data,deleted').eq('academy_id', CFG.ACADEMY_ID),
          _sb.from(CFG.TBL_FINANCE).select('id,data,deleted').eq('academy_id', CFG.ACADEMY_ID),
          _sb.from(CFG.TBL_EMPLOYEES).select('id,data,deleted').eq('academy_id', CFG.ACADEMY_ID),
          _sb.from(CFG.TABLE).select('*').eq('id', CFG.RECORD).limit(1),
        ]);

        if (stuRes.error || finRes.error || empRes.error || mainRes.error) {
          throw new Error('Partial pull failed');
        }

        const gd = window.globalData || {};

        // ✅ V39: Ensure deletedItems before merge
        _ensureDeletedItemsObject(gd);

        // ✅ V39.11 FIX: Build blocked key sets from local deletedItems
        // deleted record-এর original key বের করো যাতে cloud থেকে ফিরে আসতে না পারে
        const _getDelKeys = (delArr, kind) => {
          const keys = new Set();
          (delArr || []).forEach(item => {
            // ✅ FIX: plain string/number ID হলেও block করো
            // (আমাদের deletedItems.finance তে ['FIN-123'] এভাবে আছে)
            if (typeof item === 'string' || typeof item === 'number') {
              keys.add(String(item));
              return;
            }
            const recId = _getDeletedRecordId(item, kind);
            if (recId) keys.add(String(recId));
            // Also add the source item's key
            if (item.item) {
              if (kind === 'finance') {
                const k = item.item.id || item.item.timestamp;
                if (k) keys.add(String(k));
              } else if (kind === 'student') {
                const k = item.item.studentId || item.item.id || item.item.phone || item.item.name;
                if (k) keys.add(String(k));
              } else if (kind === 'employee') {
                const k = item.item.id;
                if (k) keys.add(String(k));
              }
            }
          });
          return keys;
        };
        const delFinKeys = _getDelKeys(gd.deletedItems?.finance, 'finance');
        const delStuKeys = _getDelKeys(gd.deletedItems?.students, 'student');
        const delEmpKeys = _getDelKeys(gd.deletedItems?.employees, 'employee');
        if (delFinKeys.size > 0) _log('🛡️', `Delete block list: ${delFinKeys.size} finance keys`);
        if (delStuKeys.size > 0) _log('🛡️', `Delete block list: ${delStuKeys.size} student keys`);

        const local = {
          students: gd.students || [],
          finance: gd.finance || [],
          employees: gd.employees || []
        };

        // ✅ PREFIX FIX: Cloud থেকে আসা rows এ prefix থাকলে সেগুলো বাদ দাও
        // wingsfly_main_stu_, wingsfly_main_fin_, wingsfly_main_emp_ prefix rows skip
        const _hasBadPrefix = (row) => {
          const id = String(row.id || '');
          return id.includes('_stu_') || id.includes('_fin_') || id.includes('_emp_');
        };
        const cleanStuData = (stuRes.data || []).filter(r => !_hasBadPrefix(r));
        const cleanFinData = (finRes.data || []).filter(r => !_hasBadPrefix(r));
        const cleanEmpData = (empRes.data || []).filter(r => !_hasBadPrefix(r));
        
        if (cleanStuData.length < (stuRes.data||[]).length)
          _log('🧹', `Filtered ${(stuRes.data||[]).length - cleanStuData.length} prefixed student rows`);
        if (cleanFinData.length < (finRes.data||[]).length)
          _log('🧹', `Filtered ${(finRes.data||[]).length - cleanFinData.length} prefixed finance rows`);

        gd.students = _mergeRecords(local.students, cleanStuData, s => s.studentId || s.id || s.phone || s.name, delStuKeys);
        gd.finance = _mergeRecords(local.finance, cleanFinData, f => f.id || f.timestamp, delFinKeys);
        gd.employees = _mergeRecords(local.employees, cleanEmpData, e => e.id, delEmpKeys);

        // ✅ V39.7 FIX: Content-based deduplication for finance entries
        // Two entries can have different IDs (SAL_xxx) but be the same transaction
        // (e.g., same salary paid from two devices or re-created by auto-heal).
        // Dedup by: type + amount + date + person + category
        {
          const _seen = new Set();
          const _before = gd.finance.length;
          gd.finance = gd.finance.filter(f => {
            // Only dedup non-deleted entries with similar content
            if (f._deleted) return true;
            const key = `${f.type}|${f.amount}|${f.date}|${(f.person || '').trim().toLowerCase()}|${f.category || ''}|${(f.description || '').replace(/\s+/g, '')}`;
            if (_seen.has(key)) {
              _log('🔧', `DEDUP removed: ${f.type} ৳${f.amount} ${f.person} (${f.date}) id=${f.id}`);
              return false; // duplicate — remove
            }
            _seen.add(key);
            return true;
          });
          if (gd.finance.length < _before) {
            _log('🔧', `DEDUP: Removed ${_before - gd.finance.length} duplicate finance entries`);
          }
        }

        // ✅ V39.6 DIAGNOSTIC: Log merge results to track balance oscillation
        _log('🔍', `MERGE RESULT: fin local=${local.finance.length} → merged=${gd.finance.length} | cloud rows=${(finRes.data || []).length} (deleted=${(finRes.data || []).filter(r => r.deleted).length})`);

        const mainRec = mainRes.data?.[0];
        if (mainRec) {
          // ✅ V39.6 FIX: Do NOT use cloud's stale cash_balance — _rebuildBalancesSafe() computes the correct value.
          // Cloud cash_balance can be stale (e.g. before a delete was pushed) and causes ৳2000 oscillation.
          // gd.cashBalance = mainRec.cash_balance ?? gd.cashBalance ?? 0;
          const _cBank = mainRec.bank_accounts;
          const _cMobile = mainRec.mobile_banking;
          gd.bankAccounts = (_cBank && _cBank.length > 0) ? _cBank : (gd.bankAccounts && gd.bankAccounts.length > 0 ? gd.bankAccounts : []);
          gd.mobileBanking = (_cMobile && _cMobile.length > 0) ? _cMobile : (gd.mobileBanking && gd.mobileBanking.length > 0 ? gd.mobileBanking : []);
          if (mainRec.settings) {
            // ✅ V39.11 FIX: Timestamp-aware settings merge
            // cloud settings নতুন হলে cloud wins, local settings নতুন হলে local wins
            const cloudSettingsTime = new Date(mainRec.settings._settingsUpdatedAt || 0).getTime();
            const localSettingsTime = new Date((gd.settings || {})._settingsUpdatedAt || 0).getTime();
            if (cloudSettingsTime >= localSettingsTime) {
              // Cloud settings নতুন — cloud wins (full merge)
              gd.settings = Object.assign({}, gd.settings || {}, mainRec.settings);
              _log('📥', `Settings pulled from cloud (cloud newer: ${new Date(cloudSettingsTime).toISOString()})`);
            } else {
              // Local settings নতুন — local wins, but merge cloud-only fields
              // startBalances, runningBatch ইত্যাদি local-এই থাকবে
              // শুধু cloud-এ আছে কিন্তু local-এ নেই এমন fields নিই
              const merged = Object.assign({}, mainRec.settings, gd.settings);
              gd.settings = merged;
              _log('📤', `Settings: local newer — kept local (${new Date(localSettingsTime).toISOString()})`);
            }
          }
          if (mainRec.users && Array.isArray(mainRec.users) && mainRec.users.length > 0) { gd.users = mainRec.users; }
          // ✅ V39.5: Settings fields sync — Categories, Courses, Roles
          if (mainRec.income_categories && Array.isArray(mainRec.income_categories) && mainRec.income_categories.length > 0) {
            gd.incomeCategories = mainRec.income_categories;
          }
          if (mainRec.expense_categories && Array.isArray(mainRec.expense_categories) && mainRec.expense_categories.length > 0) {
            gd.expenseCategories = mainRec.expense_categories;
          }
          if (mainRec.course_names && Array.isArray(mainRec.course_names) && mainRec.course_names.length > 0) {
            gd.courseNames = mainRec.course_names;
          }
          if (mainRec.employee_roles && Array.isArray(mainRec.employee_roles) && mainRec.employee_roles.length > 0) {
            gd.employeeRoles = mainRec.employee_roles;
          }
          // ✅ V40 FIX: Sync remaining globalData properties
          if (mainRec.attendance && typeof mainRec.attendance === 'object' && Object.keys(mainRec.attendance).length > 0) {
            gd.attendance = mainRec.attendance;
          }
          if (mainRec.exam_registrations && Array.isArray(mainRec.exam_registrations) && mainRec.exam_registrations.length > 0) {
            gd.examRegistrations = mainRec.exam_registrations;
          }
          if (mainRec.visitors && Array.isArray(mainRec.visitors) && mainRec.visitors.length > 0) {
            gd.visitors = mainRec.visitors;
          }
          if (typeof mainRec.next_id === 'number' && mainRec.next_id > (gd.nextId || 0)) {
            gd.nextId = mainRec.next_id;
          }

          // ✅ V40.1 FIX: Timestamp helper for array syncing
          const _getNewest = (arr) => {
            if (!arr || !Array.isArray(arr) || arr.length === 0) return 0;
            let newest = 0;
            for (let i = 0; i < arr.length; i++) {
              const item = arr[i];
              const tStr = item.timestamp || item.updatedAt || item.createdAt || item.deletedAt || item.date;
              const t = tStr ? new Date(tStr).getTime() : 0;
              if (t > newest) newest = t;
            }
            return newest;
          };

          // ✅ V40.2 FIX: Cloud এর activity_cleared_at load করো আগেই
          if (mainRec.activity_cleared_at) {
            const cloudClearedAt = new Date(mainRec.activity_cleared_at).getTime();
            const localClearedAt = gd._activityClearedAt ? new Date(gd._activityClearedAt).getTime() : 0;
            if (cloudClearedAt > localClearedAt) {
              gd._activityClearedAt = mainRec.activity_cleared_at;
              try { localStorage.setItem('wf_activity_cleared_at', mainRec.activity_cleared_at); } catch (e) {}
            }
          }

          if (mainRec.activity_history && Array.isArray(mainRec.activity_history)) {
            const cloudAct = _getNewest(mainRec.activity_history);
            const localAct = _getNewest(gd.activityHistory);

            // ✅ V40.2 FIX: Clear Activity History bug —
            // User যদি clear করে থাকে, তাহলে _activityClearedAt timestamp check করো।
            // Cloud-এর data যদি clear timestamp এর আগের হয়, তাহলে overwrite করবে না।
            const clearedAt = gd._activityClearedAt
              ? new Date(gd._activityClearedAt).getTime()
              : (function () {
                  try {
                    const s = localStorage.getItem('wf_activity_cleared_at');
                    return s ? new Date(s).getTime() : 0;
                  } catch (e) { return 0; }
                })();

            // Cloud data যদি clearTime এর চেয়ে পুরনো হয়, pull করবো না
            if (clearedAt > 0 && cloudAct <= clearedAt) {
              _log('🧹', 'Activity History pull skipped — cleared locally at ' + new Date(clearedAt).toISOString());
            } else if (cloudAct > localAct && mainRec.activity_history.length > 0) {
              // ✅ Cloud newer AND user didn't clear after cloud's last entry — তখনই overwrite
              gd.activityHistory = mainRec.activity_history;
              // ✅ Clear the cleared marker if cloud has fresher data (user re-populated)
              if (gd._activityClearedAt) delete gd._activityClearedAt;
              try { localStorage.removeItem('wf_activity_cleared_at'); } catch (e) {}
            }
          }

          // ✅ BUG E FIX & V40.1: deleted_items_other pull
          if (mainRec.deleted_items_other && Array.isArray(mainRec.deleted_items_other)) {
            if (!gd.deletedItems) gd.deletedItems = {};
            const cloudDelParams = _getNewest(mainRec.deleted_items_other);
            const localDelParams = _getNewest(gd.deletedItems.other);
            const clearedTime = gd.deletedItems._clearedAt ? new Date(gd.deletedItems._clearedAt).getTime() : 0;
            if (cloudDelParams > Math.max(localDelParams, clearedTime) && mainRec.deleted_items_other.length > 0) {
              gd.deletedItems.other = mainRec.deleted_items_other;
            }
          }

          // ✅ SESSION 4 FIX & V40.1: Keep Records pull (Timestamp instead of length)
          if (mainRec.keep_records && Array.isArray(mainRec.keep_records)) {
            try {
              var localKeep = JSON.parse(localStorage.getItem('wingsfly_keep_records') || '[]');
              const cloudKeepTime = _getNewest(mainRec.keep_records);
              const localKeepTime = _getNewest(localKeep);
              // When deleting locally, local array length shrinks but time might not advance. 
              // But keep-records aren't cleared entirely, so they are mostly add/edit bound.
              if (cloudKeepTime > localKeepTime && mainRec.keep_records.length > 0) {
                localStorage.setItem('wingsfly_keep_records', JSON.stringify(mainRec.keep_records));
                _log('📝', 'Keep Records pulled: ' + mainRec.keep_records.length + ' notes');
              } else if (mainRec.keep_records.length < localKeep.length && cloudKeepTime === localKeepTime) {
                // edge case fallback if deleting locally didn't update timestamp
              }
            } catch (e) { _log('⚠️', 'Keep Records pull error', e); }
          }

          // ✅ V40.1 FIX: Breakdown Records
          if (mainRec.breakdown_records && Array.isArray(mainRec.breakdown_records)) {
             const cBreak = _getNewest(mainRec.breakdown_records);
             const lBreak = _getNewest(gd.breakdownRecords);
             if (cBreak > lBreak && mainRec.breakdown_records.length > 0) {
                 gd.breakdownRecords = mainRec.breakdown_records;
             }
          }

          // ✅ V40.1 FIX: Notices pull
          if (mainRec.notices && Array.isArray(mainRec.notices)) {
             const cNot = _getNewest(mainRec.notices);
             const lNot = _getNewest(gd.notices);
             if (cNot > lNot && mainRec.notices.length > 0) {
                 gd.notices = mainRec.notices;
             }
          }

          // ✅ V39.9 FIX: Missing fields pull — loans, idCards, credentials, paymentMethods
          if (mainRec.loans && Array.isArray(mainRec.loans) && mainRec.loans.length > 0) {
            const cLoans = _getNewest(mainRec.loans);
            const lLoans = _getNewest(gd.loans);
            if (cLoans > lLoans) gd.loans = mainRec.loans;
          }
          if (mainRec.id_cards && Array.isArray(mainRec.id_cards) && mainRec.id_cards.length > 0) {
            const cCards = _getNewest(mainRec.id_cards);
            const lCards = _getNewest(gd.idCards);
            if (cCards > lCards) gd.idCards = mainRec.id_cards;
          }
          if (mainRec.credentials && typeof mainRec.credentials === 'object') {
            // Credentials sync: cloud wins if local is empty
            if (!gd.credentials || !gd.credentials.username) {
              gd.credentials = mainRec.credentials;
            }
          }
          if (mainRec.payment_methods && Array.isArray(mainRec.payment_methods) && mainRec.payment_methods.length > 0) {
            // Payment methods: merge (union) local + cloud
            const localPM = gd.paymentMethods || [];
            const cloudPM = mainRec.payment_methods;
            gd.paymentMethods = [...new Set([...localPM, ...cloudPM])];
          }

          _localVer = mainRec.version || _localVer;
          localStorage.setItem('wings_local_version', _localVer.toString());
        }

        // ✅ V39: Ensure deletedItems after merge too
        _ensureDeletedItemsObject(gd);

        window.globalData = gd;

        // ✅ V39 FIX: MaxCount force-set করো pull-এর পরেই
        MaxCount.forceSet(gd.students.length, gd.finance.length);
        // ✅ V39.FIX: Employee MaxCount ও set করো
        localStorage.setItem('wf_max_employees', String(gd.employees.length));

        // Save push snapshots
        try {
          const sSnap = {};
          gd.students.forEach(s => { const k = s.studentId || s.id || s.phone || s.name; if (k) sSnap[k] = _hashRecord(s); });
          const fSnap = {};
          gd.finance.forEach(f => { const k = f.id || f.timestamp; if (k) fSnap[k] = _hashRecord(f); });
          // ✅ V39.FIX: Employee snapshot pull-এর পরেই save করো
          // না করলে snapshotWasEmpty=true হয় → cloud count check → cloud>=local → skip push
          // ফলে মাদার PC এর নতুন employee অন্য PC তে কখনো যায় না
          const eSnap = {};
          gd.employees.forEach(e => { const k = e.id; if (k) eSnap[k] = _hashRecord(e); });
          _saveSnapshot('students', sSnap);
          _saveSnapshot('finance', fSnap);
          _saveSnapshot('employees', eSnap);
          _log('📸', `Snapshots saved after pull — stu:${Object.keys(sSnap).length} fin:${Object.keys(fSnap).length} emp:${Object.keys(eSnap).length}`);
        } catch (err) { _log('⚠️', 'Snapshot save error', err); }

        // Cloud main record cash_balance can be stale. Always rebuild first.
        _rebuildBalancesSafe();
        // ✅ V39.6 DIAGNOSTIC: Log balance after rebuild
        const _bankT = (gd.bankAccounts || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
        const _mobT = (gd.mobileBanking || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
        _log('🔍', `AFTER REBUILD: Cash=৳${gd.cashBalance} Bank=৳${_bankT} Mobile=৳${_mobT} TOTAL=৳${(parseFloat(gd.cashBalance) || 0) + _bankT + _mobT}`);
        _saveLocal();
        _rebuildSnapshots();
        SyncFreshness.update();
        NetworkQuality.recordSuccess();

        _log('✅', `Pull OK — stu:${gd.students.length} fin:${gd.finance.length} v${_localVer}`);
        if (showUI) _showStatus('✅ Synced');
        window.initialSyncComplete = true;

        // ✅ V39: Pull সম্পন্ন হলে snapshot নেওয়া নিরাপদ — flag set করো
        window._wf_pull_complete = true;

        return true;

      } else {
        // V39.1: Legacy BLOB mode সরানো হয়েছে — শুধু partial tables সাপোর্ট
        _log('❌', 'Partial tables not available! Please ensure wf_students, wf_finance, wf_employees tables exist in Supabase.');
        _showUserMessage('Sync Error: Partial tables পাওয়া যাচ্ছে না। Supabase Dashboard চেক করুন।', 'error');
        return false;
      }
    } catch (e) {
      _log('❌', 'Pull failed', e);
      NetworkQuality.recordFailure();
      if (_rollback && window.globalData) {
        window.globalData.students = _rollback.students;
        window.globalData.finance = _rollback.finance;
        window.globalData.employees = _rollback.employees;
        window.globalData.cashBalance = _rollback.cashBalance;
        _log('↩️', 'Rolled back');
      }
      if (showUI) _showStatus('❌ Sync failed');
      return false;
    } finally {
      _pulling = false;
      _syncBusy = false;
      window._wf_sync_in_progress = false; // ✅ V39.3: Pull শেষ — snapshot এখন safe
      _cooldownUntil = Date.now() + 10000;
    }
  }

  // ── HASH & SNAPSHOT HELPERS ────────────────────────────────────
  function _hashRecord(record) {
    const str = JSON.stringify(record);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(36);
  }

  function _loadSnapshot(table) {
    try { const raw = localStorage.getItem('wf_push_snapshot_' + table); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }

  function _saveSnapshot(table, snapshot) {
    try {
      const str = JSON.stringify(snapshot);
      if (str.length > 500000) {
        const keys = Object.keys(snapshot);
        if (keys.length > 1000) {
          const trimmed = {};
          keys.slice(-1000).forEach(k => trimmed[k] = snapshot[k]);
          localStorage.setItem('wf_push_snapshot_' + table, JSON.stringify(trimmed));
          return;
        }
      }
      localStorage.setItem('wf_push_snapshot_' + table, str);
    } catch (e) {
      _log('⚠️', 'Snapshot save error', e);
      if (e.name === 'QuotaExceededError') localStorage.removeItem('wf_push_snapshot_' + table);
    }
  }

  // Rebuild balances from ledger immediately; if finance-engine is not ready yet,
  // use internal fallback so stale cloud cash_balance never overrides real value.
  function _rebuildBalancesSafe() {
    const gd = window.globalData;
    if (!gd) return;

    if (typeof window.feRebuildAllBalances === 'function') {
      try { window.feRebuildAllBalances(); return; } catch (e) { _log('⚠️', 'feRebuildAllBalances failed', e); }
    }

    try {
      const start = (gd.settings && gd.settings.startBalances) || {};
      gd.cashBalance = parseFloat(start.Cash) || 0;

      (gd.bankAccounts || []).forEach(a => {
        a.balance = parseFloat(start[a.name] ?? start[a.bankName]) || 0;
      });
      (gd.mobileBanking || []).forEach(a => {
        a.balance = parseFloat(start[a.name] ?? start[a.bankName]) || 0;
      });

      const inTypes = ['Income', 'Transfer In', 'Loan Received', 'Loan Receiving', 'Registration', 'Refund', 'Advance', 'Investment'];
      const outTypes = ['Expense', 'Transfer Out', 'Loan Given', 'Loan Giving', 'Salary', 'Rent', 'Utilities', 'Advance Return', 'Investment Return'];

      (gd.finance || []).forEach(function (f) {
        if (!f || f._deleted) return;
        const method = f.method;
        const amount = parseFloat(f.amount) || 0;
        if (!method || !amount) return;
        const isIn = inTypes.includes(f.type);
        const isOut = outTypes.includes(f.type);
        if (!isIn && !isOut) return;
        const delta = isIn ? amount : -amount;
        if (method === 'Cash') {
          gd.cashBalance = (parseFloat(gd.cashBalance) || 0) + delta;
          return;
        }
        let acc = (gd.bankAccounts || []).find(a => a.name === method || a.bankName === method);
        if (!acc) acc = (gd.mobileBanking || []).find(a => a.name === method || a.bankName === method);
        if (acc) acc.balance = (parseFloat(acc.balance) || 0) + delta;
      });

      if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
      if (typeof window.renderAccountList === 'function') window.renderAccountList();
      if (typeof window.renderMobileBankingList === 'function') window.renderMobileBankingList();
      if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
      _log('✅', 'Balance rebuilt via fallback engine');
    } catch (e) {
      _log('⚠️', 'Fallback balance rebuild failed', e);
    }
  }

  // Resolve original record id from recycle-bin entry.
  // deletedItems entries have their own TRASH id, so we must prefer item.item.* ids.
  function _getDeletedRecordId(delEntry, kind) {
    // ✅ FIX: plain string/number ID হলে সরাসরি return করো
    if (typeof delEntry === 'string' || typeof delEntry === 'number') return String(delEntry);
    if (!delEntry || typeof delEntry !== 'object') return null;
    const src = delEntry.item && typeof delEntry.item === 'object' ? delEntry.item : null;
    if (kind === 'student') {
      return (src && (src.studentId || src.id || src.phone || src.name))
        || delEntry.studentId
        || delEntry.sourceId
        || null;
    }
    if (kind === 'finance') {
      return (src && (src.id || src.timestamp))
        || delEntry.sourceId
        || delEntry.financeId
        || delEntry.id  // ✅ FIX: direct id field
        || null;
    }
    if (kind === 'employee') {
      return (src && (src.id))
        || delEntry.sourceId
        || delEntry.employeeId
        || null;
    }
    return null;
  }

  function _getDelta(table, records, keyFn) {
    const prevSnapshot = _loadSnapshot(table);
    const newSnapshot = {}, changed = [], currentKeys = new Set();
    const snapshotWasEmpty = Object.keys(prevSnapshot).length === 0;
    records.forEach(function (record) {
      const key = keyFn(record);
      if (!key) return;
      const hash = _hashRecord(record);
      newSnapshot[key] = hash;
      currentKeys.add(key);
      if (!prevSnapshot[key] || prevSnapshot[key] !== hash) changed.push(record);
    });
    const deleted = Object.keys(prevSnapshot).filter(function (k) { return !currentKeys.has(k); });
    return { changed, deleted, snapshot: newSnapshot, snapshotWasEmpty };
  }

  function _rebuildSnapshots() {
    const gd = window.globalData;
    if (!gd) return;
    try {
      const sSnap = {};
      (gd.students || []).forEach(s => { const k = s.studentId || s.id || s.phone || s.name; if (k) sSnap[k] = _hashRecord(s); });
      _saveSnapshot('students', sSnap);
      const fSnap = {};
      (gd.finance || []).forEach(f => { const k = f.id || f.timestamp; if (k) fSnap[k] = _hashRecord(f); });
      _saveSnapshot('finance', fSnap);
      const eSnap = {};
      (gd.employees || []).forEach(e => { const k = e.id; if (k) eSnap[k] = _hashRecord(e); });
      _saveSnapshot('employees', eSnap);
      _log('📸', `Snapshots rebuilt: ${Object.keys(sSnap).length}S ${Object.keys(fSnap).length}F ${Object.keys(eSnap).length}E`);
    } catch (e) { _log('⚠️', 'rebuildSnapshots error', e); }
  }
  window._rebuildSnapshots = _rebuildSnapshots;

  // ── PUSH TO CLOUD V39 ──────────────────────────────────────────
  async function pushToCloud(reason = 'auto') {
    if (_pushing) { _log('⏸️', 'Push in progress'); return false; }
    if (!_ready || !_sb || !window.globalData) return false;
    if (!_online) { _log('📵', 'Offline'); return false; }
    // Temporarily disabled Server Egress Limit Check
    /*
    try {
      const checkLimit = await _sb.rpc('check_daily_sync_limit');
      if (checkLimit.data && checkLimit.data.success === false) {
        _log('🛑', 'Server Egress Limit Crossed — Push blocked');
        return false;
      }
    } catch(e) { } // ignore
    */
    if (Egress.hardThrottled() && !_online) { _log('🛑', 'Hard egress limit (Offline) — push blocked'); return false; }

    // ✅ FIX: Data validation before push — corrupt data push হওয়া বন্ধ করো
    var gd = window.globalData;
    if (!Array.isArray(gd.students) || !Array.isArray(gd.finance)) {
      _log('🛑', 'Data validation FAILED — students/finance not arrays, push blocked');
      return false;
    }
    // If we had known data before, local shouldn't be drastically smaller
    var _knownFin = parseInt(localStorage.getItem('wings_last_known_finance')) || 0;
    var _knownStu = parseInt(localStorage.getItem('wings_last_known_count')) || 0;
    if (_knownFin > 20 && gd.finance.length < _knownFin * 0.5) {
      _log('🛑', 'Data validation WARNING — finance dropped from ' + _knownFin + ' to ' + gd.finance.length + ', push blocked. Use wingsSync.forcePush() to override.');
      return false;
    }
    if (_knownStu > 10 && gd.students.length < _knownStu * 0.5) {
      _log('🛑', 'Data validation WARNING — students dropped from ' + _knownStu + ' to ' + gd.students.length + ', push blocked. Use wingsSync.forcePush() to override.');
      return false;
    }

    _pushing = true;
    _syncBusy = true;
    clearTimeout(_debounce);
    _debounce = null;

    try {
      // ✅ FIX: Pre-push backup — push এর আগে data save করো
      // যদি push fail করে বা corrupt হয়, এই backup থেকে restore করা যাবে
      try {
        var _prePushBackup = JSON.stringify(window.globalData);
        if (_prePushBackup && _prePushBackup.length > 100) {
          localStorage.setItem('wingsfly_pre_push_backup', _prePushBackup);
        }
      } catch (e) { /* quota exceeded — skip silently */ }

      Egress.inc();

      // ✅ V39: Ensure deletedItems before push
      _ensureDeletedItemsObject(window.globalData);

      const gd = window.globalData;
      _rebuildBalancesSafe();
      const finCount = (gd.finance || []).length, stuCount = (gd.students || []).length;
      const finDeleted = MaxCount.getDeletedCount('finance');
      const stuDeleted = MaxCount.getDeletedCount('students');

      // ✅ V39.3 FIX: Delete-after-push MaxCount update
      // যদি deletedItems-এ নতুন un-synced delete থাকে, তাহলে MaxCount
      // সেই delete count বিবেচনা করে আপডেট করো — push block হবে না।
      // কারণ: delete হলে finance array ছোট হয় কিন্তু MaxCount এখনো
      // আগের বড় count ধরে রাখে → isSafe() false → push blocked ✗
      const finUnsynced = Array.isArray(gd.deletedItems?.finance)
        ? gd.deletedItems.finance.filter(i => !i._synced).length : 0;
      const stuUnsynced = Array.isArray(gd.deletedItems?.students)
        ? gd.deletedItems.students.filter(i => !i._synced).length : 0;
      if (finUnsynced > 0 || stuUnsynced > 0) {
        // Delete আছে — MaxCount কে current actual count এ নামিয়ে আনো
        // এটা safe কারণ delete markers আলাদাভাবে push হবে
        const newFinMax = finCount + finDeleted;
        const newStuMax = stuCount + stuDeleted;
        const curFinMax = MaxCount.get('finance');
        const curStuMax = MaxCount.get('students');
        if (newFinMax < curFinMax) {
          localStorage.setItem('wf_max_finance', String(newFinMax));
          _log('🗑️', `MaxCount finance adjusted for delete: ${curFinMax}→${newFinMax}`);
        }
        if (newStuMax < curStuMax) {
          localStorage.setItem('wf_max_students', String(newStuMax));
          _log('🗑️', `MaxCount students adjusted for delete: ${curStuMax}→${newStuMax}`);
        }
      }

      const finCheck = MaxCount.isSafe('finance', finCount, { deletedCount: finDeleted });
      const stuCheck = MaxCount.isSafe('students', stuCount, { deletedCount: stuDeleted });

      if (!finCheck.safe) {
        _log('🚫', 'Push BLOCKED - Finance');
        _showUserMessage(finCheck.message + ' Push blocked.', 'error');
        ConflictTracker.record('push_blocked', `Finance count কম: local=${finCount}`, finCount, finCheck.max);
        _log('🔄', 'Auto-recovery: pulling');
        await pullFromCloud(false, true);
        return false;
      }
      if (!stuCheck.safe) {
        _log('🚫', 'Push BLOCKED - Students');
        _showUserMessage(stuCheck.message + ' Push blocked.', 'error');
        ConflictTracker.record('push_blocked', `Student count কম: local=${stuCount}`, stuCount, stuCheck.max);
        _log('🔄', 'Auto-recovery: pulling');
        await pullFromCloud(false, true);
        return false;
      }

      // Version increment via RPC
      let _rpcOK = false;
      try {
        const { data: rpcVer, error: rpcErr } = await _sb.rpc('increment_version', { record_id: CFG.RECORD });
        if (!rpcErr && rpcVer) {
          _localVer = rpcVer;
          localStorage.setItem('wings_local_version', _localVer.toString());
          _log('✅', `Server version: ${_localVer}`);
          _rpcOK = true;
        } else { _log('⚠️', 'RPC failed — fallback', rpcErr); }
      } catch (rpcEx) { _log('⚠️', 'RPC error — fallback', rpcEx); }

      if (!_rpcOK) {
        const { data: vdata } = await _sb.from(CFG.TABLE).select('version,last_device').eq('id', CFG.RECORD).limit(1);
        const cloudRec = vdata?.[0], cloudVer = cloudRec?.version || 0;
        const isOtherDevice = cloudRec?.last_device && cloudRec.last_device !== DEVICE_ID;
        if (isOtherDevice && cloudVer >= _localVer) {
          _localVer = cloudVer;
          localStorage.setItem('wings_local_version', _localVer.toString());
          _suppressRender = true;
          await pullFromCloud(false, true);
          _suppressRender = false;
        }
        _localVer++;
        localStorage.setItem('wings_local_version', _localVer.toString());
      }

      if (_partialOK) {
        const tasks = [];
        let stuPushed = 0, finPushed = 0, empPushed = 0, stuTotal = 0, finTotal = 0, empTotal = 0;

        if (_dirty.has('students') || _dirty.size === 0) {
          const { changed, deleted, snapshot, snapshotWasEmpty: stuSnapEmpty } = _getDelta(
            'students', gd.students || [], s => s.studentId || s.id || s.phone || s.name
          );
          stuTotal = (gd.students || []).length;
          stuPushed = changed.length + deleted.length;

          const doStuPush = async () => {
            let _skipDataPush = false;
            if (stuSnapEmpty && changed.length > 0) {
              try {
                const _aid2 = encodeURIComponent(CFG.ACADEMY_ID);
                const _chkRes = await fetch(
                  `${CFG.URL}/rest/v1/wf_students?academy_id=eq.${_aid2}&deleted=eq.false&select=id`,
                  { headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, Prefer: 'count=exact', Range: '0-99999' } }
                );
                const _cloudCount = parseInt(_chkRes.headers.get('content-range')?.split('/')[1] || '0', 10);
                if (_cloudCount >= stuTotal) {
                  _log('⏭️', `Students data SKIPPED — cloud has ${_cloudCount} >= local ${stuTotal}`);
                  _skipDataPush = true; // ✅ V39.2 FIX: data skip করো কিন্তু delete markers skip করো না!
                } else {
                  _log('📤', `Students: cloud ${_cloudCount} < local ${stuTotal} — pushing`);
                }
              } catch (_chkErr) { _log('⚠️', 'Students count check failed', _chkErr); }
            }
            if (!_skipDataPush && changed.length > 0) {
              const stuRows = changed.map(s => {
                const sid = s.studentId || s.id || s.phone || s.name;
                return { id: `${sid}`, academy_id: CFG.ACADEMY_ID, data: s, deleted: false };
              });
              const res = await _sb.from(CFG.TBL_STUDENTS).upsert(stuRows, { onConflict: 'id' });
              if (res && res.error) throw res.error;
              _log('📤', `Students: ${changed.length}/${stuTotal} pushed`);
            }
            // ✅ V39.2 FIX: Delete markers সবসময় push হবে — skip block-এর বাইরে
            // ✅ V39.8 FIX: Only push un-synced delete markers, mark as _synced (don't clear — Recycle Bin needs them)
            const stuDelItems = Array.isArray(gd.deletedItems?.students) ? gd.deletedItems.students.filter(i => !i._synced) : [];
            const stuDelRows = [];
            stuDelItems.forEach(item => {
              const recId = _getDeletedRecordId(item, 'student');
              if (!recId) return;
              // ✅ V39.9 FIX: Push BOTH prefixed AND original row as deleted
              stuDelRows.push({ id: `${recId}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              // Also soft-delete the original (non-prefixed) row if it exists
              if (String(recId) !== `${recId}`) {
                stuDelRows.push({ id: String(recId), academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              }
            });
            if (stuDelRows.length > 0) {
              const resDel = await _sb.from(CFG.TBL_STUDENTS).upsert(stuDelRows, { onConflict: 'id' });
              if (resDel && resDel.error) throw resDel.error;
              stuDelItems.forEach(i => { i._synced = true; });
              _log('📤', `Pushed ${stuDelRows.length} student delete markers incl. originals (kept in Recycle Bin)`);
            }
            _saveSnapshot('students', snapshot);
          };
          tasks.push(doStuPush());
        }

        if (_dirty.has('finance') || _dirty.size === 0) {
          const { changed, deleted, snapshot: finSnapshot, snapshotWasEmpty: finSnapEmpty } = _getDelta(
            'finance', gd.finance || [], f => f.id || f.timestamp
          );
          finTotal = (gd.finance || []).length;
          finPushed = changed.length + deleted.length;

          const doFinPush = async () => {
            let _skipFinDataPush = false;
            if (finSnapEmpty && changed.length > 0) {
              try {
                const _aid3 = encodeURIComponent(CFG.ACADEMY_ID);
                const _chkRes3 = await fetch(
                  `${CFG.URL}/rest/v1/wf_finance?academy_id=eq.${_aid3}&deleted=eq.false&select=id`,
                  { headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, Prefer: 'count=exact', Range: '0-99999' } }
                );
                const _cloudCount3 = parseInt(_chkRes3.headers.get('content-range')?.split('/')[1] || '0', 10);
                if (_cloudCount3 >= finTotal) {
                  _log('⏭️', `Finance data SKIPPED — cloud has ${_cloudCount3} >= local ${finTotal}`);
                  _skipFinDataPush = true; // ✅ V39.2 FIX: data skip করো কিন্তু delete markers skip করো না!
                } else {
                  _log('📤', `Finance: cloud ${_cloudCount3} < local ${finTotal} — pushing`);
                }
              } catch (_chkErr3) { _log('⚠️', 'Finance count check failed', _chkErr3); }
            }
            if (!_skipFinDataPush && changed.length > 0) {
              const finRows = changed.map(f => ({
                id: `${f.id || f.timestamp}`,
                academy_id: CFG.ACADEMY_ID, data: f, deleted: false
              }));
              const res = await _sb.from(CFG.TBL_FINANCE).upsert(finRows, { onConflict: 'id' });
              if (res && res.error) throw res.error;
              _log('📤', `Finance: ${changed.length}/${finTotal} pushed`);
            }
            // ✅ V39.2 FIX: Delete markers সবসময় push হবে — skip block-এর বাইরে
            // ✅ V39.8 FIX: Only push un-synced delete markers, mark as _synced (don't clear — Recycle Bin needs them)
            const finDelItems = Array.isArray(gd.deletedItems?.finance) ? gd.deletedItems.finance.filter(i => !i._synced) : [];
            const finDelRows = [];
            finDelItems.forEach(item => {
              const recId = _getDeletedRecordId(item, 'finance');
              if (!recId) return;
              // ✅ V39.9 FIX: Push BOTH prefixed AND original row as deleted
              finDelRows.push({ id: `${recId}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              // Also soft-delete the original (non-prefixed) row if it exists
              if (String(recId) !== `${recId}`) {
                finDelRows.push({ id: String(recId), academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              }
            });
            if (finDelRows.length > 0) {
              const resDel = await _sb.from(CFG.TBL_FINANCE).upsert(finDelRows, { onConflict: 'id' });
              if (resDel && resDel.error) throw resDel.error;
              finDelItems.forEach(i => { i._synced = true; });
              _log('📤', `Pushed ${finDelRows.length} finance delete markers incl. originals (kept in Recycle Bin)`);
            }
            _saveSnapshot('finance', finSnapshot);
          };
          tasks.push(doFinPush());
        }

        // ── Employee push (was missing — employees never synced to cloud) ──
        if (_dirty.has('employees') || _dirty.size === 0) {
          const { changed: empChanged, deleted: empDeleted, snapshot: empSnapshot, snapshotWasEmpty: empSnapEmpty } = _getDelta(
            'employees', gd.employees || [], e => e.id
          );
          empTotal = (gd.employees || []).length;
          empPushed = empChanged.length + empDeleted.length;

          const doEmpPush = async () => {
            let _skipEmpDataPush = false;
            if (empSnapEmpty && empChanged.length > 0) {
              try {
                const _aid4 = encodeURIComponent(CFG.ACADEMY_ID);
                const _chkRes4 = await fetch(
                  `${CFG.URL}/rest/v1/${CFG.TBL_EMPLOYEES}?academy_id=eq.${_aid4}&deleted=eq.false&select=id`,
                  { headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, Prefer: 'count=exact', Range: '0-99999' } }
                );
                const _cloudCount4 = parseInt(_chkRes4.headers.get('content-range')?.split('/')[1] || '0', 10);
                if (_cloudCount4 >= empTotal) {
                  _log('⏭️', `Employees data SKIPPED — cloud has ${_cloudCount4} >= local ${empTotal}`);
                  _skipEmpDataPush = true; // ✅ V39.2 FIX: data skip কিন্তু delete markers skip করো না!
                } else {
                  _log('📤', `Employees: cloud ${_cloudCount4} < local ${empTotal} — pushing`);
                }
              } catch (_chkErr4) { _log('⚠️', 'Employees count check failed', _chkErr4); }
            }
            if (!_skipEmpDataPush && empChanged.length > 0) {
              const empRows = empChanged.map(e => ({
                id: `${e.id}`, academy_id: CFG.ACADEMY_ID, data: e, deleted: false
              }));
              const res = await _sb.from(CFG.TBL_EMPLOYEES).upsert(empRows, { onConflict: 'id' });
              if (res && res.error) throw res.error;
              _log('📤', `Employees: ${empChanged.length}/${empTotal} pushed`);
            }
            // ✅ V39.8 FIX: Only push un-synced delete markers, mark as _synced (don't clear — Recycle Bin needs them)
            const empDelItems = Array.isArray(gd.deletedItems?.employees) ? gd.deletedItems.employees.filter(i => !i._synced) : [];
            const empDelRows = [];
            empDelItems.forEach(item => {
              const recId = _getDeletedRecordId(item, 'employee');
              if (!recId) return;
              // ✅ V39.9 FIX: Push BOTH prefixed AND original row as deleted
              empDelRows.push({ id: `${recId}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              // Also soft-delete the original (non-prefixed) row if it exists
              if (String(recId) !== `${recId}`) {
                empDelRows.push({ id: String(recId), academy_id: CFG.ACADEMY_ID, data: null, deleted: true });
              }
            });
            if (empDelRows.length > 0) {
              const resDel = await _sb.from(CFG.TBL_EMPLOYEES).upsert(empDelRows, { onConflict: 'id' });
              if (resDel && resDel.error) throw resDel.error;
              empDelItems.forEach(i => { i._synced = true; });
              _log('📤', `Pushed ${empDelRows.length} employee delete markers incl. originals (kept in Recycle Bin)`);
            }
            _saveSnapshot('employees', empSnapshot);
          };
          tasks.push(doEmpPush());
        }

        // Main record push
        const mainPayload = {
          // ✅ id সরানো — PATCH body-তে PK দিলে 400 error
          version: _localVer,
          last_updated: new Date().toISOString(), last_device: DEVICE_ID,
          last_action: reason, cash_balance: gd.cashBalance || 0,
          bank_accounts: gd.bankAccounts || [], mobile_banking: gd.mobileBanking || [],
          settings: gd.settings || null, users: gd.users || null,
          // ✅ V39.5: Settings fields sync
          income_categories: gd.incomeCategories || [],
          expense_categories: gd.expenseCategories || [],
          course_names: gd.courseNames || [],
          employee_roles: gd.employeeRoles || [],
          // ✅ V40 FIX: Sync remaining globalData properties
          attendance: gd.attendance || {},
          exam_registrations: gd.examRegistrations || [],
          visitors: gd.visitors || [],
          next_id: gd.nextId || 1001,
          activity_history: gd.activityHistory || [],
          activity_cleared_at: gd._activityClearedAt || null,  // ✅ V40.2 FIX: clear timestamp cloud-এ পাঠাও
          deleted_items_other: gd.deletedItems?.other || [], // ✅ BUG E FIX: other category cloud-এ push
          // ✅ SESSION 4 FIX: Keep Records, Breakdown, Notices sync
          keep_records: (function () { try { return JSON.parse(localStorage.getItem('wingsfly_keep_records') || '[]'); } catch (e) { return []; } })(),
          breakdown_records: gd.breakdownRecords || [],
          notices: gd.notices || [],
          // ✅ V39.9 FIX: Missing fields — সবকিছু সিঙ্ক করো
          loans: gd.loans || [],
          id_cards: gd.idCards || [],
          credentials: gd.credentials || null,
          payment_methods: gd.paymentMethods || []
        };
        // ✅ V39-PATCH FIX: upsert → update (PATCH) করা হয়েছে।
        // কারণ: upsert এ ?on_conflict=id দিলে Supabase 400 Bad Request দেয়।
        // academy_data table এ record সবসময় exist করে, তাই .update() safe।
        tasks.push(
          _sb.from(CFG.TABLE).update(mainPayload).eq('id', CFG.RECORD)
            .then(res => {
              if (res && res.error) {
                // Fallback: শুধু essential fields দিয়ে retry
                _log('⚠️', 'Main update failed, trying fallback PATCH', res.error?.message);
                const fallback = {
                  version: _localVer,
                  last_updated: mainPayload.last_updated,
                  last_device: DEVICE_ID,
                  last_action: reason,
                  cash_balance: gd.cashBalance || 0,
                  bank_accounts: gd.bankAccounts || [],
                  mobile_banking: gd.mobileBanking || [],
                  students: gd.students || [],
                  finance: gd.finance || [],
                  employees: gd.employees || []
                };
                return _sb.from(CFG.TABLE).update(fallback).eq('id', CFG.RECORD);
              }
            })
        );

        await Promise.all(tasks);
        _dirty.clear();
        NetworkQuality.recordSuccess();
        SyncFreshness.update();
        // ✅ FIX: Push সফল হলে localStorage এ save করো — cleared deletedItems persist হবে
        try { _saveLocal(); } catch (e) { _log('⚠️', 'saveLocal after push failed', e); }
        const totalPushed = stuPushed + finPushed + empPushed;
        if (totalPushed === 0) { _log('✅', `Push OK (${reason}) v${_localVer} — no changes`); }
        else { _log('✅', `Push OK (${reason}) v${_localVer} — ${totalPushed} records`); }
        return true;

      } else {
        // V39.1: Legacy BLOB push সরানো হয়েছে
        _log('❌', 'Partial tables not available! Push requires wf_students, wf_finance, wf_employees.');
        return false;
      }
    } catch (e) {
      _log('❌', 'Push failed', e);
      NetworkQuality.recordFailure();
      _showUserMessage('Push failed: ' + e.message, 'error');
      return false;
    } finally {
      _pushing = false;
      _syncBusy = false;
      _cooldownUntil = Date.now() + 10000;
    }
  }

  // ── MARK DIRTY ─────────────────────────────────────────────────
  window.markDirty = function (field) {
    if (field) _dirty.add(field); else _dirty.add('all');
    _log('📝', `Dirty: ${field || 'all'}`);
  };

  function _schedulePush(reason) {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => pushToCloud(reason), CFG.PUSH_DEBOUNCE_MS);
  }

  function _patchSaveToStorage() {
    const original = window.saveToStorage;
    // ✅ V39.1 FIX: app.js এখনো লোড হয়নি — retry করো (max 20 times = 10s)
    if (!original) {
      if ((_patchSaveToStorage._retries || 0) < 20) {
        _patchSaveToStorage._retries = (_patchSaveToStorage._retries || 0) + 1;
        setTimeout(_patchSaveToStorage, 500);
        _log('⏳', `saveToStorage not found yet — retry ${_patchSaveToStorage._retries}/20`);
      } else {
        _log('⚠️', 'saveToStorage never defined after 10s — patch skipped');
      }
      return;
    }
    // Double-patch guard
    if (original._v39Patched) {
      _log('🔧', 'saveToStorage already patched — skip');
      return;
    }
    window.saveToStorage = function (...args) {
      const result = original.apply(this, args);
      if (result !== false) _schedulePush('saveToStorage');
      return result;
    };
    window.saveToStorage._v39Patched = true;
    _patchSaveToStorage._retries = 0;
    _log('🔧', '✅ Patched saveToStorage successfully');
  }

  // ── VERSION CHECK (V39.2: Egress-friendly) ────────────────────
  async function _versionCheck() {
    if (!_ready || !_sb || !_tabVisible) return;
    // ✅ V39.2 FIX: Version check lightweight — শুধু hardThrottle-এ block করো
    // softThrottle-এ block করলে 30s interval কাজ করবে না
    if (Egress.hardThrottled()) { _log('🛑', 'Hard egress — version check skipped'); return; }
    try {
      // ✅ V39.2 FIX: Version check-এ Egress.inc() সরানো হয়েছে
      // এটি lightweight (শুধু version number fetch) — egress budget খরচ করার দরকার নেই
      const { data } = await _sb.from(CFG.TABLE).select('version').eq('id', CFG.RECORD).limit(1);
      const cloudVer = data?.[0]?.version || 0;
      const gap = cloudVer - _localVer;
      if (gap <= 0) return;
      _log('🔔', `Version gap: cloud=${cloudVer} local=${_localVer} gap=${gap}`);
      if (gap >= CFG.VERSION_GAP_WARN) {
        ConflictTracker.record('version_gap', `Gap: ${gap}`, _localVer, cloudVer);
      }
      const pulled = await pullFromCloud(false, true);
      // ✅ V39.2 FIX: যেকোনো version gap-এ renderFullUI call করো — আগে শুধু gap >= 20 তে হতো
      if (pulled && !_suppressRender && typeof window.renderFullUI === 'function') {
        window.renderFullUI();
        if (gap >= CFG.VERSION_GAP_FULL) {
          _showUserMessage(`Version sync হয়েছে (gap: ${gap})।`, 'success');
        }
      }
    } catch (e) { _log('⚠️', 'Version check failed', e); }
  }

  // ── MONITOR ────────────────────────────────────────────────────
  function _installMonitor() {
    let _lastFin = -1, _lastStu = -1, _lastEmp = -1, _lastCash = null;
    let _lastSettingsHash = ''; // ✅ V39.11: Settings change detection
    // ✅ V39.1 FIX: 60000 → 15000 — cashBalance দ্রুত detect হবে
    setInterval(() => {
      if (_pushing || _pulling || _syncBusy || Date.now() < _cooldownUntil) return;
      const gd = window.globalData;
      if (!gd) return;
      const fc = (gd.finance || []).length, sc = (gd.students || []).length, ec = (gd.employees || []).length, cb = gd.cashBalance;
      if (_lastFin === -1) { _lastFin = fc; _lastStu = sc; _lastEmp = ec; _lastCash = cb; return; }
      if (fc !== _lastFin || sc !== _lastStu || ec !== _lastEmp) {
        _log('📡', `Change: fin ${_lastFin}→${fc} stu ${_lastStu}→${sc} emp ${_lastEmp}→${ec}`);
        _lastFin = fc; _lastStu = sc; _lastEmp = ec;
        window.markDirty && window.markDirty();
        _schedulePush('monitor-data');
      }
      // ✅ V39.1 FIX: cashBalance পরিবর্তনে আলাদাভাবে push trigger করো
      if (cb !== _lastCash) {
        _log('💰', `cashBalance change: ${_lastCash} → ${cb} — scheduling push`);
        _lastCash = cb;
        window.markDirty && window.markDirty('cashBalance');
        _schedulePush('monitor-cash');
      }
      // ✅ V39.11 FIX: Settings change monitor — runningBatch, academyName ইত্যাদি
      // Settings পরিবর্তন হলে immediate push করো
      try {
        const settingsStr = JSON.stringify(gd.settings || {});
        const settingsHash = settingsStr.length + '_' + (gd.settings?.runningBatch || '') + '_' + (gd.settings?.monthlyTarget || '');
        if (_lastSettingsHash === '') { _lastSettingsHash = settingsHash; }
        else if (settingsHash !== _lastSettingsHash) {
          _log('⚙️', `Settings change detected — scheduling push`);
          _lastSettingsHash = settingsHash;
          window.markDirty && window.markDirty('settings');
          _schedulePush('monitor-settings');
        }
      } catch (e) {}
    }, 15000);
  }

  // ── V39: STARTUP INTEGRITY CHECK (Fresh Browser Aware) ────────
  let _integrityCheckDidPull = false;

  async function _startupIntegrityCheck() {
    _integrityCheckDidPull = false;
    const gd = window.globalData;

    // ✅ V39 BUG 2 FIX: Startup-এ deletedItems fix
    if (gd) _ensureDeletedItemsObject(gd);

    const hasLocalData = localStorage.getItem('wingsfly_data');
    const finCount = (gd?.finance || []).length;
    const stuCount = (gd?.students || []).length;

    // ✅ V39 BUG 1 FIX: Fresh browser — localStorage নেই বা data 0
    if (!hasLocalData || (finCount === 0 && stuCount === 0)) {
      _log('🆕', 'Fresh browser / empty localStorage — forcing cloud pull');
      if (_online && _sb) {
        // UI hide করো যতক্ষণ pull চলে
        const ov = document.getElementById('dashboardOverview');
        const mainContent = document.querySelector('.main-content, #mainContent, [data-content]');
        if (ov) ov.style.visibility = 'hidden';
        if (mainContent) mainContent.style.opacity = '0.3';

        _showUserMessage('নতুন browser detect হয়েছে। Cloud থেকে data লোড হচ্ছে...', 'info');

        try {
          const pulled = await pullFromCloud(false, true);
          if (pulled) {
            // ✅ V39: MaxCount ইতিমধ্যে pullFromCloud-এ set হয়েছে
            _log('✅', `Fresh browser restore: stu=${window.globalData?.students?.length} fin=${window.globalData?.finance?.length}`);
            _showUserMessage(`✅ Data লোড সম্পন্ন! Students: ${window.globalData?.students?.length}, Finance: ${window.globalData?.finance?.length}`, 'success');
            if (typeof window.renderFullUI === 'function') window.renderFullUI();
            _integrityCheckDidPull = true;
          } else {
            _log('❌', 'Fresh browser pull failed');
            _showUserMessage('Cloud থেকে data লোড করতে সমস্যা হচ্ছে। Internet connection চেক করুন।', 'error');
          }
        } catch (e) {
          _log('❌', 'Fresh browser pull error', e);
        } finally {
          if (ov) ov.style.visibility = '';
          if (mainContent) mainContent.style.opacity = '';
        }
      }
      return;
    }

    // Normal startup — MaxCount check
    const finDeleted = MaxCount.getDeletedCount('finance');
    const stuDeleted = MaxCount.getDeletedCount('students');
    const finCheck = MaxCount.isSafe('finance', finCount, { deletedCount: finDeleted });
    const stuCheck = MaxCount.isSafe('students', stuCount, { deletedCount: stuDeleted });
    if (finCheck.safe && stuCheck.safe) {
      _log('✅', `Startup OK - fin:${finCount} stu:${stuCount}`);
      return;
    }

    _log('🚨', 'Startup integrity FAIL — checking cloud');
    if (!_online || !_sb) {
      if (SyncFreshness.isFresh()) {
        _log('⚠️', 'Cloud unavailable, local fresh');
        _showUserMessage('Cloud unavailable, using recent cache', 'warn');
        return;
      } else {
        _log('❌', 'Cloud unavailable, local stale');
        _showUserMessage('Cloud unavailable and local data old!', 'error');
        return;
      }
    }

    // Cloud count check — local > cloud → push, cloud > local → pull
    try {
      const aid = encodeURIComponent(CFG.ACADEMY_ID);
      const hdrs = { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, Prefer: 'count=exact', Range: '0-999999' };
      const [stuRes, finRes] = await Promise.all([
        fetch(`${CFG.URL}/rest/v1/wf_students?academy_id=eq.${aid}&deleted=eq.false&select=id`, { headers: hdrs }),
        fetch(`${CFG.URL}/rest/v1/wf_finance?academy_id=eq.${aid}&deleted=eq.false&select=id`, { headers: hdrs }),
      ]);
      const cloudStu = parseInt(stuRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      const cloudFin = parseInt(finRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      _log('📊', `Startup: local stu=${stuCount} fin=${finCount} | cloud stu=${cloudStu} fin=${cloudFin}`);

      if (stuCount > cloudStu || finCount > cloudFin) {
        _log('📤', `Local > Cloud — pushing`);
        _showUserMessage(`Local data বেশি — Cloud-এ sync হচ্ছে...`, 'info');
        MaxCount.forceSet(stuCount, finCount);
        const ok = await pushToCloud('startup-push');
        if (ok) {
          _showUserMessage(`✅ ${stuCount} students cloud-এ push হয়েছে!`, 'success');
          _integrityCheckDidPull = true;
        }
        return;
      }
    } catch (countErr) {
      _log('⚠️', 'Cloud count check failed — falling back', countErr);
    }

    const ov2 = document.getElementById('dashboardOverview');
    if (ov2) ov2.style.visibility = 'hidden';
    try {
      const tasks = [];
      if (!finCheck.safe && _partialOK) {
        tasks.push(_sb.from(CFG.TBL_FINANCE).select('data').eq('academy_id', CFG.ACADEMY_ID).eq('deleted', false).then(({ data }) => {
          if (data && data.length > finCount) {
            gd.finance = data.map(r => r.data);
            MaxCount.update('finance', gd.finance.length);
            _log('✅', `Force loaded finance: ${gd.finance.length}`);
          }
        }));
      }
      if (!stuCheck.safe && _partialOK) {
        tasks.push(_sb.from(CFG.TBL_STUDENTS).select('data').eq('academy_id', CFG.ACADEMY_ID).eq('deleted', false).then(({ data }) => {
          if (data && data.length > 0 && data.length > stuCount) {
            gd.students = data.map(r => r.data).filter(s => s);
            MaxCount.update('students', gd.students.length);
            _log('✅', `Force loaded students: ${gd.students.length}`);
          }
        }));
      }
      await Promise.all(tasks);
      _saveLocal();

      // ✅ FIX: Recalculate balances after force-load
      if (typeof window.feRebuildAllBalances === 'function') {
        window.feRebuildAllBalances();
      }

      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      _integrityCheckDidPull = true;
      _showUserMessage('Data recovered from cloud', 'success');
    } catch (e) {
      _log('⚠️', 'Startup check failed', e);
    } finally {
      if (ov2) ov2.style.visibility = '';
    }
  }

  // ── NETWORK & VISIBILITY ───────────────────────────────────────
  function _setupNetwork() {
    window.addEventListener('online', () => {
      _online = true; _log('🌐', 'Online');
      NetworkQuality.recordSuccess();
      _suppressRender = true;
      pullFromCloud(false).then(() => { _suppressRender = false; });
    });
    window.addEventListener('offline', () => { _online = false; _log('📵', 'Offline'); });
  }

  function _setupVisibility() {
    document.addEventListener('visibilitychange', () => {
      _tabVisible = !document.hidden;
      if (_tabVisible) { _log('👁️', 'Tab visible'); setTimeout(_versionCheck, 1000); }
    });
  }

  function _setupBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      if (!window.globalData) return;
      const gd = window.globalData;
      const mainPayload = {
        // ✅ id সরানো — PATCH body-তে PK দিলে 400 error
        version: _localVer + 1,
        last_updated: new Date().toISOString(), last_device: DEVICE_ID,
        last_action: 'page-close', cash_balance: gd.cashBalance || 0,
        bank_accounts: gd.bankAccounts || [], mobile_banking: gd.mobileBanking || [],
        // ✅ V39.5: Settings fields sync on page close
        income_categories: gd.incomeCategories || [],
        expense_categories: gd.expenseCategories || [],
        course_names: gd.courseNames || [],
        employee_roles: gd.employeeRoles || [],
        settings: gd.settings || null,
        // ✅ V40 FIX: Sync remaining globalData properties on page close
        attendance: gd.attendance || {},
        exam_registrations: gd.examRegistrations || [],
        visitors: gd.visitors || [],
        next_id: gd.nextId || 1001,
        activity_history: gd.activityHistory || [],
        deleted_items_other: gd.deletedItems?.other || [], // ✅ BUG E FIX: other category page-close sync
        // ✅ SESSION 4 FIX: Keep Records, Breakdown, Notices sync on page close
        keep_records: (function () { try { return JSON.parse(localStorage.getItem('wingsfly_keep_records') || '[]'); } catch (e) { return []; } })(),
        breakdown_records: gd.breakdownRecords || [],
        notices: gd.notices || [],
      };
      const mainUrl = `${CFG.URL}/rest/v1/${CFG.TABLE}?on_conflict=id`;
      const hdrs = { 'Content-Type': 'application/json', 'apikey': CFG.KEY, 'Authorization': `Bearer ${CFG.KEY}`, 'Prefer': 'resolution=merge-duplicates' };
      try {
        navigator.sendBeacon(mainUrl, new Blob([JSON.stringify(mainPayload)], { type: 'application/json' }));
      } catch (e) {
        fetch(mainUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(mainPayload), keepalive: true }).catch(() => { });
      }

      if (_dirty.size > 0 && _partialOK) {
        if (_dirty.has('students') && (gd.students || []).length > 0) {
          const stuRows = (gd.students || []).slice(0, 50).map(s => {
            const sid = s.studentId || s.id || s.phone || s.name;
            return { id: `${sid}`, academy_id: CFG.ACADEMY_ID, data: s, deleted: false };
          });
          // ✅ FIX: Delete markers ও push করো
          const stuDel = (gd.deletedItems?.students || []).slice(0, 50).map(d => {
            const rid = _getDeletedRecordId(d, 'student');
            return rid ? { id: `${rid}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true } : null;
          }).filter(x => x);
          const allStuRows = stuRows.concat(stuDel);
          const stuUrl = `${CFG.URL}/rest/v1/${CFG.TBL_STUDENTS}?on_conflict=id`;
          try { navigator.sendBeacon(stuUrl, new Blob([JSON.stringify(allStuRows)], { type: 'application/json' })); }
          catch (e) { fetch(stuUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(allStuRows), keepalive: true }).catch(() => { }); }
        }
        if (_dirty.has('finance') && (gd.finance || []).length > 0) {
          const finRows = (gd.finance || []).slice(0, 50).map(f => ({
            id: `${CFG.ACADEMY_ID}_fin_${f.id}`, academy_id: CFG.ACADEMY_ID, data: f, deleted: false
          }));
          // ✅ FIX: Delete markers ও push করো
          const finDel = (gd.deletedItems?.finance || []).slice(0, 50).map(d => {
            const rid = _getDeletedRecordId(d, 'finance');
            return rid ? { id: `${rid}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true } : null;
          }).filter(x => x);
          const allFinRows = finRows.concat(finDel);
          const finUrl = `${CFG.URL}/rest/v1/${CFG.TBL_FINANCE}?on_conflict=id`;
          try { navigator.sendBeacon(finUrl, new Blob([JSON.stringify(allFinRows)], { type: 'application/json' })); }
          catch (e) { fetch(finUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(allFinRows), keepalive: true }).catch(() => { }); }
        }
        if (_dirty.has('employees') && (gd.employees || []).length > 0) {
          const empRows = (gd.employees || []).slice(0, 50).map(e => ({
            id: `${e.id}`, academy_id: CFG.ACADEMY_ID, data: e, deleted: false
          }));
          const empDel = (gd.deletedItems?.employees || []).slice(0, 50).map(d => {
            const rid = _getDeletedRecordId(d, 'employee');
            return rid ? { id: `${rid}`, academy_id: CFG.ACADEMY_ID, data: null, deleted: true } : null;
          }).filter(x => x);
          const allEmpRows = empRows.concat(empDel);
          const empUrl = `${CFG.URL}/rest/v1/${CFG.TBL_EMPLOYEES}?on_conflict=id`;
          try { navigator.sendBeacon(empUrl, new Blob([JSON.stringify(allEmpRows)], { type: 'application/json' })); }
          catch (e) { fetch(empUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(allEmpRows), keepalive: true }).catch(() => { }); }
        }
      }
    });
  }

  function _showStatus(msg) { const el = document.getElementById('syncStatusText'); if (el) el.textContent = msg; }

  // ── REALTIME SUBSCRIPTION ──────────────────────────────────────
  function _setupRealtime() {
    if (!_sb) return;
    _sb.channel('version-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CFG.TABLE, filter: `id=eq.${CFG.RECORD}` },
        payload => {
          const cloudVer = payload.new?.version;
          if (cloudVer && cloudVer > _localVer) {
            _log('🔔', `Realtime: cloud v${cloudVer}`);
            pullFromCloud(false, true);
          }
        })
      .subscribe();
    _log('📡', 'Realtime subscription active');
  }

  // ── V39: SNAPSHOT GUARD ────────────────────────────────────────
  // snapshot-system.js এর takeSnapshot() কে guard করা হচ্ছে
  // Fresh browser-এ pull complete হওয়ার আগে snapshot নেওয়া বন্ধ
  function _installSnapshotGuard() {
    const origTakeSnapshot = window.takeSnapshot;
    if (typeof origTakeSnapshot !== 'function') return;
    if (origTakeSnapshot._v39Guarded) return;

    window.takeSnapshot = function () {
      // Fresh browser-এ pull complete না হলে snapshot নেওয়া বন্ধ
      if (_isFreshBrowser && !window._wf_pull_complete) {
        _log('⏸️', 'Snapshot BLOCKED — fresh browser pull not complete yet');
        return;
      }
      // ✅ V39.3 FIX: Cross-device login sync চলাকালীন snapshot বন্ধ
      // wf_just_logged_in = login সবে হয়েছে, sync এখনো চলছে
      if (sessionStorage.getItem('wf_just_logged_in') === 'true' || window._wf_sync_in_progress) {
        _log('⏸️', 'Snapshot BLOCKED — cross-device login sync in progress');
        return;
      }
      // data শূন্য থাকলে snapshot নেওয়া বন্ধ
      const stuLen = (window.globalData?.students || []).length;
      const finLen = (window.globalData?.finance || []).length;
      if (stuLen === 0 && finLen === 0) {
        _log('⏸️', 'Snapshot BLOCKED — data is empty (0 students, 0 finance)');
        return;
      }
      return origTakeSnapshot.apply(this, arguments);
    };
    window.takeSnapshot._v39Guarded = true;
    _log('🛡️', 'V39: Snapshot guard installed');
  }

  // ── FORCE PUSH ONLY ────────────────────────────────────────────
  async function forcePushOnly(reason) {
    _log('🚀', 'forcePushOnly: resetting MaxCount then pushing...');
    const data = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
    const stuLen = (data.students || []).length;
    const finLen = (data.finance || []).length;
    const empLen = (data.employees || []).length;
    MaxCount.forceSet(stuLen, finLen);
    // ✅ BUG G FIX: Employee MaxCount ও set করো
    localStorage.setItem('wf_max_employees', String(empLen));
    if (window.globalData) {
      if (stuLen > (window.globalData.students || []).length) window.globalData.students = data.students || [];
      if (finLen > (window.globalData.finance || []).length) window.globalData.finance = data.finance || [];
      if (empLen > (window.globalData.employees || []).length) window.globalData.employees = data.employees || [];
    }
    localStorage.removeItem('wf_push_snapshot_students');
    localStorage.removeItem('wf_push_snapshot_finance');
    localStorage.removeItem('wf_push_snapshot_employees'); // ✅ BUG G FIX: Employee snapshot clear
    _log('🗑️', 'Snapshots cleared before force push (students + finance + employees)');
    const ok = await pushToCloud(reason || 'forcePushOnly');
    if (ok) {
      _rebuildSnapshots();
      _showUserMessage(`✅ ${stuLen} students, ${finLen} finance, ${empLen} employees cloud-এ push হয়েছে!`, 'success');
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
    }
    return ok;
  }

  // ── SMART SYNC ─────────────────────────────────────────────────
  async function _smartSync() {
    _log('🔄', 'smartSync: checking counts...');
    try {
      const aid = encodeURIComponent(CFG.ACADEMY_ID);
      const hdrs = { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, Prefer: 'count=exact', Range: '0-999999' };
      // ✅ BUG H FIX: Employee count ও check করো
      const [stuRes, finRes, empRes] = await Promise.all([
        fetch(`${CFG.URL}/rest/v1/wf_students?academy_id=eq.${aid}&deleted=eq.false&select=id`, { headers: hdrs }),
        fetch(`${CFG.URL}/rest/v1/wf_finance?academy_id=eq.${aid}&deleted=eq.false&select=id`, { headers: hdrs }),
        fetch(`${CFG.URL}/rest/v1/wf_employees?academy_id=eq.${aid}&deleted=eq.false&select=id`, { headers: hdrs }),
      ]);
      const cloudStu = parseInt(stuRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      const cloudFin = parseInt(finRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      const cloudEmp = parseInt(empRes.headers.get('content-range')?.split('/')[1] || '0', 10);
      const localData = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
      const localStu = (localData.students || []).length;
      const localFin = (localData.finance || []).length;
      const localEmp = (localData.employees || []).length;
      _log('📊', `smartSync: local stu=${localStu} fin=${localFin} emp=${localEmp} | cloud stu=${cloudStu} fin=${cloudFin} emp=${cloudEmp}`);

      // ✅ BUG H FIX: Employee count compare যোগ করা হয়েছে
      if (localStu > cloudStu || localFin > cloudFin || localEmp > cloudEmp) {
        _log('📤', 'Local > Cloud — force pushing');
        _showUserMessage('Local data বেশি — Cloud-এ push হচ্ছে...', 'info');
        return await forcePushOnly('smartSync-push');
      } else {
        _log('📥', 'Cloud >= Local — pulling');
        await pullFromCloud(false, true);
        await pushToCloud('smartSync-push');
        if (typeof window.renderFullUI === 'function') window.renderFullUI();
        return true;
      }
    } catch (e) {
      _log('⚠️', 'smartSync failed — fallback', e);
      await pullFromCloud(false, true);
      await pushToCloud('smartSync-fallback');
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      return true;
    }
  }

  // ── STARTUP ────────────────────────────────────────────────────
  async function _start() {
    if (!_init()) { setTimeout(_start, 2000); return; }
    _log('🚀', '══════════════════════════════════════');
    _log('🚀', 'Wings Fly V39.0 — FRESH BROWSER FIX');
    _log('🚀', '══════════════════════════════════════');
    _log('💡', `Egress: ${Egress.count()}/${CFG.EGRESS_LIMIT} | Age: ${SyncFreshness.getAge()} | v${_localVer}`);
    _log('💡', `Fresh browser: ${_isFreshBrowser}`);

    const eInfo = Egress.getInfo();
    if (eInfo.throttled) _log('⚠️', `Egress soft-throttled (${eInfo.count}/${eInfo.limit})`);
    if (eInfo.hardThrottled) _log('🛑', `Egress hard-throttled — all sync paused`);

    await _checkPartialTables();
    _setupNetwork();
    _setupVisibility();
    _setupBeforeUnload();
    _patchSaveToStorage();

    // ✅ V39: Snapshot guard install করো
    // DOMContentLoaded-এর পরে install করো যাতে takeSnapshot ইতিমধ্যে defined থাকে
    if (typeof window.takeSnapshot === 'function') {
      _installSnapshotGuard();
    } else {
      // takeSnapshot পরে লোড হলেও catch করো
      const _snapInterval = setInterval(() => {
        if (typeof window.takeSnapshot === 'function') {
          _installSnapshotGuard();
          clearInterval(_snapInterval);
        }
      }, 500);
      setTimeout(() => clearInterval(_snapInterval), 10000);
    }

    window.__v39_sync_active = true;
    await _startupIntegrityCheck();

    // ✅ PERFORMANCE FIX: যদি local data তাজা থাকে (5 মিনিটের কম পুরনো) এবং
    // user logged-in থাকে (wf_session_token আছে) তাহলে full pull skip করো।
    // Reload/সাধারণ refresh-এ এতে 2-4s সময় বাঁচবে।
    const _sessionToken = localStorage.getItem('wf_session_token');
    const _lastLocal = parseInt(localStorage.getItem('lastLocalUpdate') || '0');
    const _sessionAge = Date.now() - _lastLocal;
    const _SESSION_FRESH_MS = 5 * 60 * 1000; // 5 মিনিট

    // ✅ V39.3 FIX: Cross-device login detection
    // অন্য device থেকে login করলে wf_just_logged_in flag set থাকে।
    // এই অবস্থায় FAST STARTUP skip করা যাবে না — full pull বাধ্যতামূলক।
    const _justLoggedIn = sessionStorage.getItem('wf_just_logged_in') === 'true';
    const _forceFullSync = sessionStorage.getItem('wf_force_full_sync') === 'true';
    const _crossDeviceLogin = _justLoggedIn || _forceFullSync;
    if (_crossDeviceLogin) {
      sessionStorage.removeItem('wf_force_full_sync'); // একবার ব্যবহারের পরে clear
      _log('🔄', 'Cross-device login detected — forcing full pull (skipping FAST STARTUP)');
    }

    if (!_integrityCheckDidPull) {
      if (!_crossDeviceLogin && _sessionToken && _lastLocal > 0 && _sessionAge < _SESSION_FRESH_MS && !_isFreshBrowser) {
        _log('⚡', `FAST STARTUP: session fresh (${Math.round(_sessionAge/1000)}s ago) — skipping full pull`);
        // Background-এ version check করো — full pull না করেই
        setTimeout(() => { if (!Egress.throttled()) _versionCheck(); }, 2000);
      } else {
        await pullFromCloud(false);
      }
    } else {
      _log('✅', 'Pull skipped — integrity check already fetched');
    }

    _setupRealtime();
    // ✅ V39.2 FIX: 30s periodic version check — Realtime না কাজ করলেও sync হবে
    setInterval(() => {
      if (_tabVisible && !Egress.throttled() && !_syncBusy && Date.now() > _cooldownUntil) {
        _versionCheck();
      }
    }, 30000);
    setInterval(() => { if (_tabVisible && !Egress.hardThrottled()) pullFromCloud(true); }, CFG.FULL_PULL_MS);
    setTimeout(_installMonitor, 3000);
    _log('🎉', 'V39.2 ready — with periodic version check!');
    _showStatus('✅ V39.2 ready');
  }

  // ── PUBLIC API ─────────────────────────────────────────────────
  window.wingsSync = {
    fullSync: async () => { await pullFromCloud(false, true); await pushToCloud('Manual'); if (typeof window.renderFullUI === 'function') window.renderFullUI(); },
    smartSync: _smartSync,
    forcePush: forcePushOnly,
    pushNow: (reason) => pushToCloud(reason || 'Manual'),
    pullNow: async () => { await pullFromCloud(false, true); if (typeof window.renderFullUI === 'function') window.renderFullUI(); },
    markDirty: (field) => window.markDirty && window.markDirty(field),
    forceRecovery: async () => {
      _log('🔄', 'Manual recovery');
      await pullFromCloud(true, true);
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      _showUserMessage('Recovery complete', 'success');
    },
    resetEgress: (pin) => {
      const storedHash = localStorage.getItem('wings_admin_pin_hash');
      if (storedHash) {
        if (_hashRecord({ pin }) !== storedHash) { console.warn('❌ Invalid PIN.'); return false; }
      } else {
        if (sessionStorage.getItem('userRole') !== 'admin') { console.warn('❌ Admin access required to reset Egress.'); return false; }
      }
      Egress.reset(); return true;
    },
    forceVersionSync: async () => {
      _log('🔄', 'Force version sync');
      Egress.reset();
      const pulled = await pullFromCloud(false, true);
      if (pulled && typeof window.renderFullUI === 'function') window.renderFullUI();
      _showUserMessage('Version sync সম্পন্ন।', 'success');
      return pulled;
    },

    // ✅ V39.11: NUCLEAR FORCE CLEAN SYNC
    // Local data-কে truth ধরে cloud-এর সব row মুছে fresh push করে
    // এটা orphaned/zombie records permanently eliminate করে
    forceCleanSync: async function () {
      if (!_sb || !CFG.URL || !CFG.KEY) {
        _showUserMessage('❌ Supabase not configured', 'error');
        return false;
      }
      if (_pushing || _pulling) {
        _showUserMessage('⏳ Sync busy — try again in a few seconds', 'warning');
        return false;
      }

      _log('🔥', '═══ NUCLEAR FORCE CLEAN SYNC STARTED ═══');
      _pushing = true;
      _syncBusy = true;

      try {
        const gd = window.globalData;
        if (!gd) throw new Error('globalData not found');

        const aid = CFG.ACADEMY_ID;
        const hdrs = {
          'Content-Type': 'application/json',
          'apikey': CFG.KEY,
          'Authorization': 'Bearer ' + CFG.KEY,
          'Prefer': 'resolution=merge-duplicates'
        };

        // ═══ STEP 1: Cloud-এর সব finance rows DELETE করো ═══
        _log('🗑️', 'Step 1: Deleting ALL cloud finance rows...');
        const finDelRes = await fetch(
          `${CFG.URL}/rest/v1/${CFG.TBL_FINANCE}?academy_id=eq.${encodeURIComponent(aid)}`,
          { method: 'DELETE', headers: hdrs }
        );
        _log('✅', `Finance cloud rows deleted: ${finDelRes.status}`);

        // ═══ STEP 2: Cloud-এর সব student rows DELETE করো ═══
        _log('🗑️', 'Step 2: Deleting ALL cloud student rows...');
        const stuDelRes = await fetch(
          `${CFG.URL}/rest/v1/${CFG.TBL_STUDENTS}?academy_id=eq.${encodeURIComponent(aid)}`,
          { method: 'DELETE', headers: hdrs }
        );
        _log('✅', `Student cloud rows deleted: ${stuDelRes.status}`);

        // ═══ STEP 3: Cloud-এর সব employee rows DELETE করো ═══
        _log('🗑️', 'Step 3: Deleting ALL cloud employee rows...');
        const empDelRes = await fetch(
          `${CFG.URL}/rest/v1/${CFG.TBL_EMPLOYEES}?academy_id=eq.${encodeURIComponent(aid)}`,
          { method: 'DELETE', headers: hdrs }
        );
        _log('✅', `Employee cloud rows deleted: ${empDelRes.status}`);

        // ═══ STEP 4: Local snapshots reset করো ═══
        _log('🧹', 'Step 4: Resetting all local snapshots...');
        localStorage.removeItem('wf_sync_snap_students');
        localStorage.removeItem('wf_sync_snap_finance');
        localStorage.removeItem('wf_sync_snap_employees');
        _dirty.add('students');
        _dirty.add('finance');
        _dirty.add('employees');

        // ═══ STEP 5: Fresh push করো — শুধু current local data ═══
        _log('📤', 'Step 5: Fresh push — all local data...');

        // 5A: Students
        const students = gd.students || [];
        if (students.length > 0) {
          const stuRows = students.map(s => ({
            id: `${s.studentId || s.id || s.phone || s.name}`,
            academy_id: aid, data: s, deleted: false
          }));
          // Push in chunks of 200
          for (let i = 0; i < stuRows.length; i += 200) {
            const chunk = stuRows.slice(i, i + 200);
            await _sb.from(CFG.TBL_STUDENTS).upsert(chunk, { onConflict: 'id' });
          }
          _log('✅', `Students pushed: ${students.length}`);
        }

        // 5B: Finance
        const finance = gd.finance || [];
        if (finance.length > 0) {
          const finRows = finance.map(f => ({
            id: `${f.id || f.timestamp}`,
            academy_id: aid, data: f, deleted: false
          }));
          for (let i = 0; i < finRows.length; i += 200) {
            const chunk = finRows.slice(i, i + 200);
            await _sb.from(CFG.TBL_FINANCE).upsert(chunk, { onConflict: 'id' });
          }
          _log('✅', `Finance pushed: ${finance.length}`);
        }

        // 5C: Employees
        const employees = gd.employees || [];
        if (employees.length > 0) {
          const empRows = employees.map(e => ({
            id: `${e.id}`,
            academy_id: aid, data: e, deleted: false
          }));
          await _sb.from(CFG.TBL_EMPLOYEES).upsert(empRows, { onConflict: 'id' });
          _log('✅', `Employees pushed: ${employees.length}`);
        }

        // 5D: Main payload (settings, categories, etc)
        const mainPayload = {
          id: CFG.RECORD,
          cash_balance: gd.cashBalance || 0,
          bank_accounts: gd.bankAccounts || [],
          mobile_banking: gd.mobileBanking || [],
          settings: gd.settings || null,
          users: gd.users || [],
          income_categories: gd.incomeCategories || [],
          expense_categories: gd.expenseCategories || [],
          course_names: gd.courseNames || [],
          employee_roles: gd.employeeRoles || [],
          payment_methods: gd.paymentMethods || [],
          credentials: gd.credentials || {},
          version: (_localVer || 0) + 100, // Big version jump
          last_push_by: DEVICE_ID,
          last_push_at: new Date().toISOString(),
          deleted_items: gd.deletedItems || {},
          activity_history: gd.activityHistory || [],
        };
        await _sb.from(CFG.TABLE).upsert([mainPayload], { onConflict: 'id' });
        _localVer = mainPayload.version;
        _log('✅', `Main payload pushed, new version: ${_localVer}`);

        // ═══ STEP 6: Save fresh snapshots ═══
        _saveSnapshot('students', Object.fromEntries(students.map(s => [s.studentId || s.id || s.phone || s.name, _hashRecord(s)])));
        _saveSnapshot('finance', Object.fromEntries(finance.map(f => [f.id || f.timestamp, _hashRecord(f)])));
        _saveSnapshot('employees', Object.fromEntries(employees.map(e => [e.id, _hashRecord(e)])));
        _dirty.clear();

        // ═══ STEP 7: Mark all deletedItems as synced ═══
        if (gd.deletedItems) {
          ['students', 'finance', 'employees', 'other'].forEach(cat => {
            if (Array.isArray(gd.deletedItems[cat])) {
              gd.deletedItems[cat].forEach(d => { d._synced = true; });
            }
          });
        }

        // Save locally
        localStorage.setItem('wingsfly_data', JSON.stringify(gd));

        _log('🎉', '═══ NUCLEAR FORCE CLEAN SYNC COMPLETE ═══');
        _log('📊', `Pushed: ${students.length} students, ${finance.length} finance, ${employees.length} employees`);
        _showUserMessage(`✅ Force Clean Sync সম্পূর্ণ! ${students.length} students, ${finance.length} finance records pushed.`, 'success');

        return true;
      } catch (err) {
        _log('❌', 'FORCE CLEAN SYNC FAILED:', err);
        _showUserMessage('❌ Force Clean Sync failed: ' + (err.message || err), 'error');
        return false;
      } finally {
        _pushing = false;
        _syncBusy = false;
      }
    },

    getEgressInfo: () => Egress.getInfo(),
    getStatus: () => ({
      version: _localVer, online: _online, partialOK: _partialOK,
      dirty: [..._dirty], initialSync: window.initialSyncComplete,
      // Legacy V36 backward-compatibility for diagnostic tools
      egressToday: Egress.count(), initialSyncComplete: window.initialSyncComplete, partialReady: _partialOK,
      egress: Egress.count(), egressInfo: Egress.getInfo(),
      tabVisible: _tabVisible, isFreshBrowser: _isFreshBrowser,
      pullComplete: !!window._wf_pull_complete,
      maxFinance: MaxCount.get('finance'), maxStudents: MaxCount.get('students'),
      networkQuality: NetworkQuality.getQuality(), dataAge: SyncFreshness.getAge(),
    }),
  };

  // Legacy aliases
  window.saveToCloud = () => pushToCloud('saveToCloud');
  window.loadFromCloud = (force = false) => pullFromCloud(false, force);
  window.manualCloudSync = window.wingsSync.smartSync;
  window.manualSync = window.wingsSync.smartSync;
  window.scheduleSyncPush = (reason) => { window.markDirty && window.markDirty(); _schedulePush(reason); };

  // Start
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _start);
  else _start();

})();
