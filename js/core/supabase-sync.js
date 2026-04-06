// ============================================================
// Wings Fly Aviation Academy — Supabase Sync Engine
// ============================================================

const SyncEngine = (() => {
  const { client, TABLES } = window.SUPABASE_CONFIG;
  let syncInterval = null;
  let isSyncing = false;

  // ── Status indicator ──────────────────────────────────────
  function setStatus(state) {
    // state: 'synced' | 'syncing' | 'offline' | 'error'
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
      synced:  { icon: '☁️', text: 'Synced',   cls: 'synced'  },
      syncing: { icon: '🔄', text: 'Syncing…', cls: 'syncing' },
      offline: { icon: '📴', text: 'Offline',  cls: 'offline' },
      error:   { icon: '⚠️', text: 'Error',    cls: 'error'   },
    };
    const s = map[state] || map.offline;
    el.className = `sync-badge ${s.cls}`;
    el.innerHTML = `${s.icon} ${s.text}`;
  }

  // ── Generic fetch all rows ────────────────────────────────
  async function fetchAll(table) {
    const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ── Generic upsert ────────────────────────────────────────
  async function upsert(table, rows) {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // ── Generic delete ────────────────────────────────────────
  async function remove(table, id) {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw error;
  }

  // ── Pull: Cloud → LocalStorage ────────────────────────────
  async function pull() {
    setStatus('syncing');
    try {
      for (const key of Object.values(TABLES)) {
        const rows = await fetchAll(key);
        localStorage.setItem(`wfa_${key}`, JSON.stringify(rows));
      }
      setStatus('synced');
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'pull' } }));
    } catch (e) {
      console.error('[Sync] Pull failed:', e);
      setStatus('error');
    }
  }

  // ── Push: LocalStorage → Cloud ────────────────────────────
  async function push() {
    setStatus('syncing');
    try {
      for (const key of Object.values(TABLES)) {
        const raw = localStorage.getItem(`wfa_${key}`);
        if (!raw) continue;
        const rows = JSON.parse(raw);
        if (rows.length > 0) await upsert(key, rows);
      }
      setStatus('synced');
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'push' } }));
    } catch (e) {
      console.error('[Sync] Push failed:', e);
      setStatus('error');
    }
  }

  // ── Auto sync every 30 seconds ────────────────────────────
  function startAutoSync() {
    stopAutoSync();
    syncInterval = setInterval(pull, 30_000);
    pull(); // immediate first pull
  }

  function stopAutoSync() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  }

  // ── Real-time subscription (optional per table) ───────────
  function subscribeTable(table, callback) {
    client
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback(payload);
        pull(); // re-pull full table on any change
      })
      .subscribe();
  }

  // ── LocalStorage helpers ──────────────────────────────────
  function getLocal(table) {
    try { return JSON.parse(localStorage.getItem(`wfa_${table}`)) || []; }
    catch { return []; }
  }

  function setLocal(table, rows) {
    localStorage.setItem(`wfa_${table}`, JSON.stringify(rows));
  }

  // ── Save one record (local + cloud) ──────────────────────
  async function saveRecord(table, record) {
    const rows = getLocal(table);
    const idx = rows.findIndex(r => r.id === record.id);
    if (idx >= 0) rows[idx] = record; else rows.unshift(record);
    setLocal(table, rows);
    try { await upsert(table, [record]); setStatus('synced'); }
    catch { setStatus('error'); }
  }

  // ── Delete one record (local + cloud) ────────────────────
  async function deleteRecord(table, id) {
    let rows = getLocal(table).filter(r => r.id !== id);
    setLocal(table, rows);
    try { await remove(table, id); setStatus('synced'); }
    catch { setStatus('error'); }
  }

  // ── Generate unique ID ────────────────────────────────────
  function generateId(prefix = '') {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  return { pull, push, startAutoSync, stopAutoSync, subscribeTable, getLocal, setLocal, saveRecord, deleteRecord, generateId, setStatus, fetchAll };
})();

window.SyncEngine = SyncEngine;
