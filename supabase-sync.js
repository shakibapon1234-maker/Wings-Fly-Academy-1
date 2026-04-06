/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/core/supabase-sync.js
   Sync Engine — Local ↔ Supabase
════════════════════════════════════════════════ */

const SupabaseSync = (() => {

  /* ── Local Storage Keys ── */
  const LS = {
    students:   'wfa_students',
    finance:    'wfa_finance',
    accounts:   'wfa_accounts',
    loans:      'wfa_loans',
    exam:       'wfa_exam',
    attendance: 'wfa_attendance',
    staff:      'wfa_staff',
    salary:     'wfa_salary',
    visitors:   'wfa_visitors',
    notices:    'wfa_notices',
    settings:   'wfa_settings',
    lastSync:   'wfa_last_sync',
  };

  /* ── Table → LocalStorage key map ── */
  const TABLE_MAP = {
    [DB.students]:   LS.students,
    [DB.finance]:    LS.finance,
    [DB.accounts]:   LS.accounts,
    [DB.loans]:      LS.loans,
    [DB.exam]:       LS.exam,
    [DB.attendance]: LS.attendance,
    [DB.staff]:      LS.staff,
    [DB.salary]:     LS.salary,
    [DB.visitors]:   LS.visitors,
    [DB.notices]:    LS.notices,
    [DB.settings]:   LS.settings,
  };

  let autoSyncTimer = null;
  let isOnline = navigator.onLine;
  let isSyncing = false;

  /* ══════════════════════════════════════════
     LOCAL STORAGE HELPERS
  ══════════════════════════════════════════ */
  function localGet(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  }

  function localSet(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  function localGetObj(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch { return {}; }
  }

  function localSetObj(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage write failed:', e);
    }
  }

  /* ══════════════════════════════════════════
     PUBLIC DATA ACCESS
     সব module এই functions দিয়ে data পড়বে/লিখবে
  ══════════════════════════════════════════ */

  /** সব record পড়া */
  function getAll(table) {
    const key = TABLE_MAP[table];
    if (!key) return [];
    if (table === DB.settings) return localGetObj(key);
    return localGet(key);
  }

  /** ID দিয়ে একটা record পড়া */
  function getById(table, id) {
    return getAll(table).find(r => r.id === id) || null;
  }

  /** নতুন record যোগ করা */
  function insert(table, record) {
    const key = TABLE_MAP[table];
    if (!key) return null;
    const rows = localGet(key);
    const now = new Date().toISOString();
    const newRecord = {
      ...record,
      id: record.id || Utils.generateId(),
      created_at: record.created_at || now,
      updated_at: now,
      _dirty: true,  // sync করা দরকার
    };
    rows.push(newRecord);
    localSet(key, rows);
    schedulePush();
    return newRecord;
  }

  /** record আপডেট করা */
  function update(table, id, changes) {
    const key = TABLE_MAP[table];
    if (!key) return null;
    const rows = localGet(key);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = {
      ...rows[idx],
      ...changes,
      id,
      updated_at: new Date().toISOString(),
      _dirty: true,
    };
    localSet(key, rows);
    schedulePush();
    return rows[idx];
  }

  /** record মুছে ফেলা */
  function remove(table, id) {
    const key = TABLE_MAP[table];
    if (!key) return false;
    let rows = localGet(key);
    const exists = rows.some(r => r.id === id);
    if (!exists) return false;
    rows = rows.filter(r => r.id !== id);
    localSet(key, rows);
    /* Cloud থেকেও মুছতে হবে — delete queue */
    const queue = localGet('wfa_delete_queue');
    queue.push({ table, id, deleted_at: new Date().toISOString() });
    localSet('wfa_delete_queue', queue);
    schedulePush();
    return true;
  }

  /** Settings object আপডেট */
  function updateSettings(changes) {
    const current = localGetObj(LS.settings);
    const updated = { ...current, ...changes, updated_at: new Date().toISOString(), _dirty: true };
    localSetObj(LS.settings, updated);
    schedulePush();
    return updated;
  }

  /* ══════════════════════════════════════════
     SYNC STATUS UI
  ══════════════════════════════════════════ */
  function setStatus(state, text) {
    const el = document.getElementById('sync-indicator');
    const txt = document.getElementById('sync-text');
    if (!el) return;
    el.className = 'sync-indicator ' + state;
    if (txt) txt.textContent = text;
  }

  /* ══════════════════════════════════════════
     PUSH — Local → Supabase
  ══════════════════════════════════════════ */
  async function push() {
    if (!isOnline || isSyncing) return;
    isSyncing = true;
    setStatus('syncing', 'Syncing...');

    try {
      for (const [table, lsKey] of Object.entries(TABLE_MAP)) {
        if (table === DB.settings) {
          /* Settings — single row upsert */
          const settings = localGetObj(lsKey);
          if (settings._dirty) {
            const { _dirty, ...clean } = settings;
            if (!clean.id) clean.id = 'academy_settings';
            const { error } = await supabase.from(table).upsert(clean, { onConflict: 'id' });
            if (!error) {
              localSetObj(lsKey, { ...clean, _dirty: false });
            }
          }
          continue;
        }

        /* Array tables — upsert dirty rows */
        const rows = localGet(lsKey);
        const dirty = rows.filter(r => r._dirty);
        if (dirty.length === 0) continue;

        const cleanRows = dirty.map(({ _dirty, ...r }) => r);
        const { error } = await supabase.from(table).upsert(cleanRows, { onConflict: 'id' });
        if (!error) {
          const updated = rows.map(r => r._dirty ? { ...r, _dirty: false } : r);
          localSet(lsKey, updated);
        }
      }

      /* Delete queue */
      const deleteQueue = localGet('wfa_delete_queue');
      const remaining = [];
      for (const item of deleteQueue) {
        const { error } = await supabase.from(item.table).delete().eq('id', item.id);
        if (error) remaining.push(item);
      }
      localSet('wfa_delete_queue', remaining);

      localStorage.setItem(LS.lastSync, new Date().toISOString());
      setStatus('synced', 'Synced');

    } catch (err) {
      console.error('Push error:', err);
      setStatus('error', 'Sync Error');
    } finally {
      isSyncing = false;
    }
  }

  /* ══════════════════════════════════════════
     PULL — Supabase → Local
  ══════════════════════════════════════════ */
  async function pull() {
    if (!isOnline) {
      Utils.toast('ইন্টারনেট সংযোগ নেই', 'warning');
      return;
    }
    setStatus('syncing', 'Pulling...');

    try {
      for (const [table, lsKey] of Object.entries(TABLE_MAP)) {
        if (table === DB.settings) {
          const { data, error } = await supabase.from(table).select('*').eq('id', 'academy_settings').single();
          if (!error && data) localSetObj(lsKey, data);
          continue;
        }

        const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
        if (!error && data) localSet(lsKey, data);
      }

      localStorage.setItem(LS.lastSync, new Date().toISOString());
      setStatus('synced', 'Synced');
      Utils.toast('Cloud থেকে ডেটা আনা হয়েছে ✓', 'success');

      /* UI refresh */
      if (window.App) App.refreshCurrentTab();

    } catch (err) {
      console.error('Pull error:', err);
      setStatus('error', 'Pull Error');
      Utils.toast('Pull ব্যর্থ হয়েছে', 'error');
    }
  }

  /* ══════════════════════════════════════════
     AUTO SYNC — প্রতি ৩০ সেকেন্ডে Push
  ══════════════════════════════════════════ */
  function startAutoSync() {
    stopAutoSync();
    autoSyncTimer = setInterval(() => {
      if (isOnline) push();
    }, 30_000);
  }

  function stopAutoSync() {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
  }

  /* Dirty হলে ৩ সেকেন্ড পর push */
  let pushDebounce = null;
  function schedulePush() {
    if (pushDebounce) clearTimeout(pushDebounce);
    pushDebounce = setTimeout(() => { if (isOnline) push(); }, 3000);
  }

  /* ══════════════════════════════════════════
     REAL-TIME SUBSCRIPTION
  ══════════════════════════════════════════ */
  function subscribeRealtime() {
    /* সব table-এ real-time listen করা */
    for (const table of Object.keys(TABLE_MAP)) {
      if (table === DB.settings) continue;
      supabase.channel(`rt-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          handleRealtimeEvent(table, payload);
        })
        .subscribe();
    }
  }

  function handleRealtimeEvent(table, payload) {
    const lsKey = TABLE_MAP[table];
    if (!lsKey) return;
    let rows = localGet(lsKey);

    if (payload.eventType === 'INSERT') {
      const exists = rows.some(r => r.id === payload.new.id);
      if (!exists) rows.push(payload.new);
    } else if (payload.eventType === 'UPDATE') {
      rows = rows.map(r => r.id === payload.new.id ? { ...payload.new, _dirty: false } : r);
    } else if (payload.eventType === 'DELETE') {
      rows = rows.filter(r => r.id !== payload.old.id);
    }

    localSet(lsKey, rows);
    if (window.App) App.refreshCurrentTab();
    setStatus('synced', 'Synced');
  }

  /* ══════════════════════════════════════════
     ONLINE / OFFLINE
  ══════════════════════════════════════════ */
  window.addEventListener('online', () => {
    isOnline = true;
    push();
    setStatus('synced', 'Online');
    Utils.toast('ইন্টারনেট সংযোগ পুনরায় চালু', 'info');
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    setStatus('error', 'Offline');
    Utils.toast('ইন্টারনেট সংযোগ নেই — Offline mode', 'warning');
  });

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function init() {
    startAutoSync();
    subscribeRealtime();
    /* প্রথম pull */
    setTimeout(() => pull(), 1500);
  }

  /* ══════════════════════════════════════════
     DATA MONITOR — Cloud vs Local
  ══════════════════════════════════════════ */
  async function getDataMonitor() {
    const result = {};
    for (const [table, lsKey] of Object.entries(TABLE_MAP)) {
      if (table === DB.settings) continue;
      const local = localGet(lsKey).length;
      let cloud = 0;
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        cloud = count || 0;
      } catch {}
      result[table] = { local, cloud };
    }
    return result;
  }

  function getLastSync() {
    const ts = localStorage.getItem(LS.lastSync);
    if (!ts) return 'কখনো হয়নি';
    return new Date(ts).toLocaleString('bn-BD');
  }

  /* Public API */
  return {
    init,
    push,
    pull,
    getAll,
    getById,
    insert,
    update,
    remove,
    updateSettings,
    getDataMonitor,
    getLastSync,
    localGet,
    localSet,
    localGetObj,
    localSetObj,
    LS,
  };

})();
