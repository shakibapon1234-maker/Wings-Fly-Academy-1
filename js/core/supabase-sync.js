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
    _pushRecord(table, record);
    return record;
  }

  function update(table, id, partial) {
    const rows = getAll(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...partial, updated_at: new Date().toISOString(), _device: _deviceId() };
      setAll(table, rows);
      _pushRecord(table, rows[idx]);
    }
  }

  function remove(table, id) {
    const rows = getAll(table).filter(r => r.id !== id);
    setAll(table, rows);
    _deleteFromCloud(table, id);
    // Track deletion for sync
    _trackDeletion(table, id);
  }

  function generateId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
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
      const deleted = JSON.parse(localStorage.getItem(key)) || {};
      if (!deleted[table]) deleted[table] = [];
      if (!deleted[table].includes(id)) deleted[table].push(id);
      localStorage.setItem(key, JSON.stringify(deleted));
    } catch { /* ignore */ }
  }

  function getDeletedIds(table) {
    try {
      const deleted = JSON.parse(localStorage.getItem('wfa_deletedItems')) || {};
      return deleted[table] || [];
    } catch { return []; }
  }

  function clearDeletedIds(table) {
    try {
      const deleted = JSON.parse(localStorage.getItem('wfa_deletedItems')) || {};
      delete deleted[table];
      localStorage.setItem('wfa_deletedItems', JSON.stringify(deleted));
    } catch { /* ignore */ }
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
    getDeletedIds, clearDeletedIds, processRetryQueue, _deviceId,
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
  let _isSyncing = false;

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

  // ── Smart Pull with Conflict Resolution ───────────────────
  async function pull() {
    if (_isSyncing) return;
    _isSyncing = true;
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

      if (hasChanges) {
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'pull' } }));
      }

      // Process any queued operations
      await SupabaseSync.processRetryQueue();

    } catch (e) {
      console.error('[Sync] Pull failed:', e);
      setStatus('error');
    } finally {
      _isSyncing = false;
    }
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
  async function push() {
    if (_isSyncing) return;
    _isSyncing = true;
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
      Utils.toast('Cloud-এ Push সম্পন্ন ✅', 'success');
    } catch (e) {
      console.error('[Sync] Push failed:', e);
      setStatus('error');
      Utils.toast('Push ব্যর্থ হয়েছে', 'error');
    } finally {
      _isSyncing = false;
    }
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
        pull();
      } else {
        // Light heartbeat every 60s to catch any missed events
        if (Date.now() - _lastSyncTime > 60_000) {
          pull();
        }
      }
    }, 30_000);

    // Initial pull
    pull().then(() => {
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
      pull().then(() => startRealtime());
      SupabaseSync.processRetryQueue();
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
    pull, push,
    startAutoSync, stopAutoSync,
    startRealtime, stopRealtime,
    getLocal, setLocal,
    setStatus, getDataMonitor,
  };
})();
window.SyncEngine = SyncEngine;
