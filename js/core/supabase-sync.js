// ============================================================
// Wings Fly Aviation Academy — Supabase Sync Engine + CRUD
// Phase 10: Real-time, Multi-user, Conflict Resolution
// ============================================================

// ────────────────────────────────────────────────────────────
// SupabaseSync — CRUD API used by all modules
// ────────────────────────────────────────────────────────────
const SupabaseSync = (() => {

  function getAll(table) {
    try { return JSON.parse(localStorage.getItem(`wfa_${table}`)) || []; }
    catch { return []; }
  }

  function getById(table, id) {
    return getAll(table).find(r => r.id === id) || null;
  }

  function setAll(table, rows) {
    localStorage.setItem(`wfa_${table}`, JSON.stringify(rows));
  }

  function insert(table, record) {
    if (!record.id) record.id = generateId();
    if (!record.created_at) record.created_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    record._device = _deviceId();
    const rows = getAll(table);
    rows.unshift(record);
    setAll(table, rows);
    _logRecentChange(table, 'insert', record);
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
    }
    _deleteFromCloud(table, id);
    // Track deletion for sync (tombstone so row does not reappear on pull)
    _trackDeletion(table, id);
  }

  function generateId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  /** Settings → Monitor: last local saves/updates/deletes (not pull/merge). */
  function _logRecentChange(table, action, record) {
    try {
      if (!record || typeof record !== 'object') return;
      const person = record.name || record.student_id || record.person_name || record.reg_id
        || record.description || record.note || '—';
      const category = record.category || record.type || table;
      const typeLabel = action === 'delete' ? 'Delete' : (action === 'insert' ? 'Save' : 'Update');
      const entry = {
        date: new Date().toLocaleString(),
        type: typeLabel,
        category: String(category).slice(0, 100),
        person: String(person).slice(0, 100),
        table,
      };
      const arr = JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]');
      arr.unshift(entry);
      if (arr.length > 120) arr.length = 120;
      localStorage.setItem('wfa_recent_changes', JSON.stringify(arr));
    } catch { /* ignore */ }
  }

  // Device identifier for multi-user conflict resolution
  function _deviceId() {
    let id = localStorage.getItem('wfa_device_id');
    if (!id) {
      id = 'DEV_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem('wfa_device_id', id);
    }
    return id;
  }

  // Track deletions so they don't reappear on pull
  function _trackDeletion(table, id) {
    try {
      const key = 'wfa_deletedItems';
      let deleted = JSON.parse(localStorage.getItem(key)) || {};
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      if (!deleted[table]) deleted[table] = [];
      if (!deleted[table].includes(id)) deleted[table].push(id);
      localStorage.setItem(key, JSON.stringify(deleted));
    } catch { /* ignore */ }
  }

  function getDeletedIds(table) {
    try {
      const deleted = JSON.parse(localStorage.getItem('wfa_deletedItems')) || {};
      if (Array.isArray(deleted) || typeof deleted !== 'object') return [];
      const arr = deleted[table];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function clearDeletedIds(table) {
    try {
      let deleted = JSON.parse(localStorage.getItem('wfa_deletedItems')) || {};
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      delete deleted[table];
      localStorage.setItem('wfa_deletedItems', JSON.stringify(deleted));
    } catch { /* ignore */ }
  }

  /** Remove one id from sync tombstones (used when restoring from recycle bin). */
  function untrackDeletion(table, id) {
    try {
      let deleted = JSON.parse(localStorage.getItem('wfa_deletedItems')) || {};
      if (Array.isArray(deleted) || typeof deleted !== 'object') deleted = {};
      if (!Array.isArray(deleted[table])) return;
      deleted[table] = deleted[table].filter((x) => x !== id);
      if (deleted[table].length === 0) delete deleted[table];
      localStorage.setItem('wfa_deletedItems', JSON.stringify(deleted));
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
    if (!r || typeof r !== 'object') return '—';
    return (
      r.name ||
      r.student_id ||
      r.description ||
      r.reg_id ||
      r.person_name ||
      r.title ||
      (r.type && r.amount != null ? `${r.type} ৳${r.amount}` : '') ||
      r.id ||
      '—'
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
      const bin = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]');
      if (!Array.isArray(bin)) return;
      bin.unshift({
        table,
        data: JSON.parse(JSON.stringify(record)),
        deletedAt: new Date().toISOString(),
        type: _recycleTypeLabel(table),
        name: _recycleDisplayName(table, record),
        tableLabel: _tableDisplayName(table),
      });
      if (bin.length > RECYCLE_MAX) bin.length = RECYCLE_MAX;
      localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(bin));
    } catch (e) {
      console.warn('[Recycle] add failed:', e);
    }
  }

  /** Restore one item back into local storage + Supabase; removes tombstone and bin entry. */
  async function restoreRecycleBinItem(index) {
    const bin = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]');
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

    bin.splice(index, 1);
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(bin));

    _logRecentChange(table, 'insert', record);
    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'restore', table } }));
    return true;
  }

  function permanentDeleteRecycleBinItem(index) {
    const bin = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]');
    if (!Array.isArray(bin) || index < 0 || index >= bin.length) return;
    const item = bin[index];
    if (item?.table && item?.data?.id) untrackDeletion(item.table, item.data.id);
    bin.splice(index, 1);
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(bin));
  }

  function emptyRecycleBin() {
    const bin = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]');
    if (Array.isArray(bin)) {
      bin.forEach((item) => {
        if (item?.table && item?.data?.id) untrackDeletion(item.table, item.data.id);
      });
    }
    localStorage.setItem(RECYCLE_BIN_KEY, '[]');
  }

  // ── Cloud Operations (fire-and-forget) ─────────────────────
  async function _pushRecord(table, record) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      const { error } = await client.from(table).upsert([record], { onConflict: 'id' });
      if (error) throw error;
      SyncEngine.setStatus('synced');
    } catch (e) {
      console.warn('[Sync] Push record failed:', e);
      SyncEngine.setStatus('error');
      // Queue for retry
      _queueRetry(table, record);
    }
  }

  async function _deleteFromCloud(table, id) {
    try {
      const { client } = window.SUPABASE_CONFIG;
      await client.from(table).delete().eq('id', id);
    } catch (e) { console.warn('[Sync] Delete from cloud failed:', e); }
  }

  // ── Retry Queue for offline operations ─────────────────────
  function _queueRetry(table, record) {
    try {
      const queue = JSON.parse(localStorage.getItem('wfa_retry_queue')) || [];
      queue.push({ table, record, at: Date.now() });
      localStorage.setItem('wfa_retry_queue', JSON.stringify(queue));
    } catch { /* ignore */ }
  }

  async function processRetryQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem('wfa_retry_queue')) || [];
      if (!queue.length) return;
      const { client } = window.SUPABASE_CONFIG;
      const remaining = [];
      for (const item of queue) {
        try {
          const { error } = await client.from(item.table).upsert([item.record], { onConflict: 'id' });
          if (error) throw error;
        } catch { remaining.push(item); }
      }
      localStorage.setItem('wfa_retry_queue', JSON.stringify(remaining));
      if (remaining.length === 0 && queue.length > 0) {
        console.log('[Sync] Retry queue cleared');
      }
    } catch { /* ignore */ }
  }

  return {
    getAll, getById, setAll, insert, update, remove, generateId,
    getDeletedIds, clearDeletedIds, untrackDeletion, processRetryQueue, _deviceId,
    restoreRecycleBinItem, permanentDeleteRecycleBinItem, emptyRecycleBin,
  };
})();
window.SupabaseSync = SupabaseSync;


// ────────────────────────────────────────────────────────────
// SyncEngine — Pull / Push / Real-time / Multi-user
// ────────────────────────────────────────────────────────────
const SyncEngine = (() => {
  const { client, TABLES } = window.SUPABASE_CONFIG;
  let syncInterval = null;
  let realtimeChannels = [];
  let _lastSyncTime = 0;

  // Serialize pull/push/syncAll so merge + batch upsert never interleave
  let _opQueue = Promise.resolve();
  function queueSyncOp(fn) {
    const run = _opQueue.then(() => fn());
    _opQueue = run.catch((e) => { console.error('[Sync] Queued op failed:', e); });
    return run;
  }

  // ── Status Badge ──────────────────────────────────────────
  function setStatus(state) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
      synced:   { icon: '☁️', text: 'Synced',    cls: 'synced'  },
      syncing:  { icon: '🔄', text: 'Syncing…',  cls: 'syncing' },
      offline:  { icon: '📴', text: 'Offline',   cls: 'offline' },
      error:    { icon: '⚠️', text: 'Error',     cls: 'error'   },
      realtime: { icon: '🟢', text: 'Real-time', cls: 'synced'  },
    };
    const s = map[state] || map.offline;
    el.className = `sync-badge ${s.cls}`;
    el.innerHTML = `${s.icon} ${s.text}`;
  }

  // ── Smart Pull with Conflict Resolution (core; run inside queue) ──
  /** @param {{ silent?: boolean }} [opts] — pass `{ silent: false }` from UI for toast feedback */
  async function _pullCore(opts = {}) {
    const silent = opts.silent !== false ? true : false;
    setStatus('syncing');

    try {
      let hasChanges = false;

      for (const key of Object.values(TABLES)) {
        const { data: cloudRows, error } = await client
          .from(key)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist yet — skip silently
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn(`[Sync] Table "${key}" does not exist yet, skipping`);
            continue;
          }
          throw error;
        }

        const localRows = SupabaseSync.getAll(key);
        const deletedIds = SupabaseSync.getDeletedIds(key);

        // Merge: cloud data + local-only data, respecting deletions
        const merged = mergeRows(localRows, cloudRows || [], deletedIds);

        // Check if data actually changed
        const oldJson = JSON.stringify(localRows);
        const newJson = JSON.stringify(merged);
        if (oldJson !== newJson) {
          SupabaseSync.setAll(key, merged);
          hasChanges = true;
        }
      }

      _lastSyncTime = Date.now();
      setStatus(realtimeChannels.length > 0 ? 'realtime' : 'synced');

      if (!silent && typeof Utils !== 'undefined') {
        Utils.toast(
          hasChanges ? 'Pulled updates from cloud' : 'Pull complete — data in sync with cloud',
          'success'
        );
      }

      if (hasChanges) {
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'pull' } }));
      }

      // Process any queued operations
      await SupabaseSync.processRetryQueue();

    } catch (e) {
      console.error('[Sync] Pull failed:', e);
      setStatus('error');
      if (!silent && typeof Utils !== 'undefined') Utils.toast('Pull from cloud failed', 'error');
    }
  }

  function pull(opts) {
    return queueSyncOp(() => _pullCore(opts));
  }

  // ── Merge Algorithm (timestamp-based) ─────────────────────
  function mergeRows(localRows, cloudRows, deletedIds) {
    const merged = new Map();

    // Start with cloud data
    cloudRows.forEach(row => {
      if (!deletedIds.includes(row.id)) {
        merged.set(row.id, row);
      }
    });

    // Merge local data — local wins if newer
    localRows.forEach(row => {
      if (deletedIds.includes(row.id)) return; // skip deleted
      const existing = merged.get(row.id);
      if (!existing) {
        merged.set(row.id, row);
      } else {
        // Compare updated_at timestamps
        const localTime  = new Date(row.updated_at || 0).getTime();
        const cloudTime  = new Date(existing.updated_at || 0).getTime();
        if (localTime > cloudTime) {
          merged.set(row.id, row); // local is newer
        }
        // else: cloud is newer, keep cloud version
      }
    });

    return Array.from(merged.values());
  }

  // ── Push (all local data to cloud) ────────────────────────
  async function _pushCore(options = {}) {
    const silent = options.silent === true;
    setStatus('syncing');

    try {
      for (const key of Object.values(TABLES)) {
        const raw = localStorage.getItem(`wfa_${key}`);
        if (!raw) continue;
        const rows = JSON.parse(raw);
        if (rows.length > 0) {
          // Push in batches of 50 for large datasets
          for (let i = 0; i < rows.length; i += 50) {
            const batch = rows.slice(i, i + 50);
            const { error } = await client.from(key).upsert(batch, { onConflict: 'id' });
            if (error) {
              if (error.code === '42P01') {
                console.warn(`[Sync] Table "${key}" does not exist yet`);
                break;
              }
              throw error;
            }
          }
        }

        // Push deletions
        const deletedIds = SupabaseSync.getDeletedIds(key);
        for (const id of deletedIds) {
          try {
            await client.from(key).delete().eq('id', id);
          } catch { /* ignore individual delete failures */ }
        }
        SupabaseSync.clearDeletedIds(key);
      }

      setStatus(realtimeChannels.length > 0 ? 'realtime' : 'synced');
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'push' } }));
      if (!silent && typeof Utils !== 'undefined') Utils.toast('Push to Cloud completed ✅', 'success');
    } catch (e) {
      console.error('[Sync] Push failed:', e);
      setStatus('error');
      if (!silent && typeof Utils !== 'undefined') Utils.toast('Push failed', 'error');
    }
  }

  function push(options) {
    return queueSyncOp(() => _pushCore(options));
  }

  /** Retry queue + pull; optional forcePush uploads all local rows before pull (full two-way sync). */
  function syncAll(options = {}) {
    return queueSyncOp(async () => {
      await SupabaseSync.processRetryQueue();
      if (options.forcePush) await _pushCore({ silent: true });
      await _pullCore(options);
    });
  }

  // ── Real-time Subscriptions ───────────────────────────────
  function startRealtime() {
    stopRealtime();
    console.log('[Sync] Starting real-time subscriptions...');

    for (const [key, tableName] of Object.entries(TABLES)) {
      try {
        const channel = client
          .channel(`realtime-${tableName}`)
          .on('postgres_changes',
            { event: '*', schema: 'public', table: tableName },
            (payload) => handleRealtimeEvent(tableName, payload)
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`[RT] ✅ ${tableName} subscribed`);
            } else if (status === 'CHANNEL_ERROR') {
              console.warn(`[RT] ❌ ${tableName} subscription failed`);
            }
          });

        realtimeChannels.push(channel);
      } catch (e) {
        console.warn(`[RT] Failed to subscribe to ${tableName}:`, e);
      }
    }

    if (realtimeChannels.length > 0) {
      setStatus('realtime');
    }
  }

  function stopRealtime() {
    realtimeChannels.forEach(ch => {
      try { client.removeChannel(ch); } catch { /* ignore */ }
    });
    realtimeChannels = [];
  }

  function handleRealtimeEvent(table, payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    const localRows = SupabaseSync.getAll(table);
    const deviceId = SupabaseSync._deviceId();

    // Skip if this change came from our own device
    if (newRow?._device === deviceId && eventType !== 'DELETE') return;

    console.log(`[RT] ${table}: ${eventType}`, payload);
    let changed = false;

    switch (eventType) {
      case 'INSERT': {
        if (!localRows.find(r => r.id === newRow.id)) {
          localRows.unshift(newRow);
          changed = true;
        }
        break;
      }
      case 'UPDATE': {
        const idx = localRows.findIndex(r => r.id === newRow.id);
        if (idx >= 0) {
          const localTime = new Date(localRows[idx].updated_at || 0).getTime();
          const cloudTime = new Date(newRow.updated_at || 0).getTime();
          if (cloudTime >= localTime) {
            localRows[idx] = newRow;
            changed = true;
          }
        } else {
          localRows.unshift(newRow);
          changed = true;
        }
        break;
      }
      case 'DELETE': {
        const beforeLen = localRows.length;
        const filtered = localRows.filter(r => r.id !== (oldRow?.id || newRow?.id));
        if (filtered.length !== beforeLen) {
          SupabaseSync.setAll(table, filtered);
          changed = true;
        }
        break;
      }
    }

    if (changed) {
      if (eventType !== 'DELETE') SupabaseSync.setAll(table, localRows);
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'realtime', table, eventType } }));
    }
  }

  // ── Auto Sync (polling as fallback for when realtime fails) ─
  function startAutoSync() {
    stopAutoSync();
    syncInterval = setInterval(() => {
      // Only poll if real-time isn't active
      if (realtimeChannels.length === 0) {
        pull({ silent: true });
      } else {
        // Light heartbeat every 60s to catch any missed events
        if (Date.now() - _lastSyncTime > 60_000) {
          pull({ silent: true });
        }
      }
    }, 30_000);

    // Initial pull
    pull({ silent: true }).then(() => {
      // After initial pull, start real-time
      startRealtime();
    });
  }

  function stopAutoSync() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    stopRealtime();
  }

  // ── Online/Offline Detection ──────────────────────────────
  function setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[Sync] Back online');
      setStatus('syncing');
      syncAll({ silent: true }).then(() => startRealtime());
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Gone offline');
      setStatus('offline');
      stopRealtime();
    });
  }

  // ── Data Monitor (for settings page) ──────────────────────
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

  // ── Backward compatibility ────────────────────────────────
  function getLocal(table)       { return SupabaseSync.getAll(table); }
  function setLocal(table, rows) { SupabaseSync.setAll(table, rows); }

  // Init network listeners on load
  setupNetworkListeners();

  return {
    pull, push, syncAll,
    startAutoSync, stopAutoSync,
    startRealtime, stopRealtime,
    getLocal, setLocal,
    setStatus, getDataMonitor,
  };
})();
window.SyncEngine = SyncEngine;
