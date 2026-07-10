// ============================================================
// Wings Fly Academy — Activity Log module
// ✅ Extracted from js/ui/settings.js (2026-07-08) so settings.js
// stays smaller — same pattern already used for license-manager.js.
// Settings.js just calls ActivityLog.panel()/.refresh()/.filter()/
// .clearFilters()/.clear()/.log() and stays a thin wrapper.
//
// Improvements over the old inline version:
//  1) Generic bulk-collapse: ANY 3+ same type+action entries created
//     close together now collapse into one "N-টি ... সম্পন্ন" row —
//     not just salary/portal-access (so future bulk features are
//     covered automatically, no per-feature summary call needed).
//  2) Generic side-effect merge: any finance_ledger/accounts entries
//     created within a few seconds of a "primary" entry (student,
//     loan, salary, exam, attendance...) are folded in as background
//     updates — not limited to a fixed list of exact pairs, so one
//     transaction doesn't show as 3 separate rows.
//  3) Logs are explicitly sorted newest-first before rendering, so
//     the newest activity is always on top even after a cloud merge
//     from another device/sub-agent shuffles local storage order.
//  4) Live updates: while the Activity Log tab is open, the panel
//     both listens for the same-device 'wfa:activity-log' event AND
//     polls the cloud every 15s so activity from other devices /
//     sub-agents shows up without the user needing to reopen the tab.
// ============================================================

const ActivityLog = (() => {

  // ── Type / action metadata (icons, labels, colors) ──────────────────────
  const TYPE_META = {
    students:       { icon:'fa-user-graduate',        label:'ছাত্র তালিকা',    color:'#00d9ff' },
    finance_ledger: { icon:'fa-money-bill-wave',       label:'আয়-ব্যয় লেজার', color:'#00ff88' },
    accounts:       { icon:'fa-building-columns',      label:'একাউন্ট',         color:'#ffd700' },
    loans:          { icon:'fa-hand-holding-dollar',   label:'লোন',             color:'#ff6b35' },
    salary:         { icon:'fa-money-bill-wave',       label:'বেতন',            color:'#b537f2' },
    exams:          { icon:'fa-file-lines',            label:'পরীক্ষা',         color:'#00d9ff' },
    attendance:     { icon:'fa-clipboard-list',        label:'উপস্থিতি',        color:'#00ff88' },
    staff:          { icon:'fa-user-tie',              label:'স্টাফ',           color:'#ffa502' },
    'hr-staff':     { icon:'fa-user-tie',              label:'স্টাফ',           color:'#ffa502' },
    finance:        { icon:'fa-money-bill-wave',       label:'আয়-ব্যয় লেজার', color:'#00ff88' },
    settings:       { icon:'fa-gear',                  label:'সেটিংস',          color:'#aaaaaa' },
    security:       { icon:'fa-shield-halved',         label:'নিরাপত্তা',       color:'#ff4757' },
    category:       { icon:'fa-tags',                  label:'ক্যাটাগরি',       color:'#ffd700' },
    certificates:   { icon:'fa-certificate',           label:'সার্টিফিকেট',    color:'#00ff88' },
    visitors:       { icon:'fa-person-walking',        label:'ভিজিটর',          color:'#aaaaaa' },
    notices:        { icon:'fa-bullhorn',              label:'নোটিশ',           color:'#ffa502' },
    'id-cards':     { icon:'fa-id-card',               label:'আইডি কার্ড',      color:'#00d9ff' },
    student_portal_access: { icon:'fa-key',            label:'Student Portal',  color:'#f59e0b' },
    system:         { icon:'fa-gear',                  label:'সিস্টেম',         color:'#666666' },
    note:           { icon:'fa-bookmark',              label:'নোট',             color:'#b537f2' },
  };
  const ACTION_META = {
    add:      { badge:'ADD',      color:'#00ff88', bg:'rgba(0,255,136,0.12)',   icon:'fa-plus-circle' },
    edit:     { badge:'EDIT',     color:'#00d9ff', bg:'rgba(0,217,255,0.12)',   icon:'fa-pen' },
    delete:   { badge:'DELETE',   color:'#ff4757', bg:'rgba(255,71,87,0.12)',   icon:'fa-trash' },
    restore:  { badge:'RESTORE',  color:'#ffd700', bg:'rgba(255,215,0,0.12)',   icon:'fa-rotate-left' },
    system:   { badge:'SYSTEM',   color:'#aaaaaa', bg:'rgba(255,255,255,0.06)', icon:'fa-gear' },
    export:   { badge:'EXPORT',   color:'#b537f2', bg:'rgba(181,55,242,0.12)', icon:'fa-file-export' },
    transfer: { badge:'TRANSFER', color:'#ffa502', bg:'rgba(255,165,2,0.12)',  icon:'fa-arrow-right-arrow-left' },
    print:    { badge:'PRINT',    color:'#00d9ff', bg:'rgba(0,217,255,0.10)',  icon:'fa-print' },
  };

  // High-confidence explicit pairs: kept for the descriptions that read
  // best when we know exactly what the side-effect was.
  const RELATED_PAIRS = {
    'edit:students':     ['edit:finance_ledger','edit:accounts','add:finance_ledger'],
    'add:students':      ['add:finance_ledger','edit:accounts','add:accounts'],
    'delete:students':   ['delete:finance_ledger','edit:accounts','delete:accounts'],
    'add:loans':         ['add:finance_ledger','edit:accounts'],
    'edit:loans':        ['edit:finance_ledger','edit:accounts'],
    'delete:loans':      ['delete:finance_ledger','edit:accounts'],
    'add:salary':        ['edit:accounts'],
    'edit:salary':       ['add:finance_ledger','edit:accounts','delete:finance_ledger'],
    'delete:salary':     ['edit:accounts','delete:finance_ledger'],
    'add:certificates':  ['edit:finance_ledger','edit:accounts'],
    'add:attendance':    ['edit:students'],
    'edit:settings':     ['edit:settings'],
  };

  // Types that are essentially always "side-effects" of some other
  // primary action, never the interesting row on their own.
  const GENERIC_SIDE_EFFECT_TYPES = new Set(['finance_ledger', 'accounts']);

  const MERGE_MS       = 6000;   // window to fold in side-effect entries
  const BULK_WINDOW_MS = 25000;  // window to collapse repeated same type+action rows

  // ── Storage helpers ──────────────────────────────────────────────────────
  function _rawLogs() {
    return Utils.safeJSON(localStorage.getItem('wfa_activity_log'), []);
  }

  function getLogs() {
    const raw = _rawLogs();
    const filtered = (typeof SupabaseSync !== 'undefined' && SupabaseSync.filterActivityLogs)
      ? SupabaseSync.filterActivityLogs(raw)
      : raw.filter(l => {
          const d = String(l.description || '');
          if (/DIAG-TEST-|DIAG-INST-|DIAG-EXAM-|DIAG-SAL-|System Test Student|Auto-generated diagnostic|Diagnostic Test Staff|Diagnostic Installment Student|Diagnostic Exam Student|Diagnostic Loan Person|Batch-DIAG|Diagnostics Course/i.test(d)) return false;
          if (l.type === 'settings' && /^সেটিংস-এ (তথ্য আপডেট|নতুন এন্ট্রি)/i.test(d) && /একাডেমি সেটিংস$/i.test(d)) return false;
          return true;
        });
    // ✅ Always newest-first, regardless of how localStorage / a cloud
    // merge happened to order things.
    return filtered.slice().sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      // Two writes can share the same millisecond; use the generated id as a
      // stable tie-breaker so a cloud merge never shuffles newest rows.
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  // Backward-compatible name used by a couple of internal call sites.
  const getActivityLogs = getLogs;

  function log(action, type, description) {
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity) {
      SupabaseSync.logActivity(action, type, description);
    } else {
      // Fallback: local-only (SupabaseSync not loaded yet)
      const logs = _rawLogs();
      logs.unshift({
        action, type, description,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        user: 'Admin',
        time: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        created_at: new Date().toISOString(),
      });
      if (logs.length > 500) logs.length = 500;
      localStorage.setItem('wfa_activity_log', JSON.stringify(logs));
    }
  }

  async function clear() {
    const ok = await Utils.confirm('সব Activity Log মুছে দেবেন? এটি undo করা যাবে না।', 'Clear Activity Log');
    if (!ok) return;

    localStorage.setItem('wfa_activity_log', '[]');
    try {
      const { client } = window.SUPABASE_CONFIG;
      if (client) {
        await client.from('activity_log').delete().neq('id', '__never_match__');
      }
    } catch (e) {
      console.warn('[ActivityLog] Cloud clear failed:', e);
    }

    Utils.toast('Activity log cleared ✅', 'success');
    if (window.SettingsModule && typeof window.SettingsModule.refreshModal === 'function') {
      window.SettingsModule.refreshModal();
    }
  }

  // ── Grouping logic ───────────────────────────────────────────────────────

  // Pass 1: collapse long runs of the same type+action into one summary row.
  // Any feature that fires many logActivity() calls in a loop (salary sheet
  // generation, batch portal access, bulk print, etc.) gets folded down
  // automatically — no per-feature special-casing needed.
  function _collapseBulkRuns(items) {
    const SUMMARY_RE = /ব্যাচ.*জন|মাসের বেতন শীট|portal access দেওয়া হয়েছে|salary card|একসাথে access|সব.*তৈরি/i;
    const out = [];
    let i = 0;
    while (i < items.length) {
      const e = items[i];
      if (e.action !== 'add' && e.action !== 'edit' && e.action !== 'delete') {
        out.push(e); i++; continue;
      }
      // Already a hand-written summary line — keep as-is, don't re-group.
      if (SUMMARY_RE.test(String(e.description || ''))) {
        out.push(e); i++; continue;
      }
      const t0 = new Date(e.created_at || 0).getTime();
      const group = [e];
      let j = i + 1;
      while (j < items.length) {
        const nx = items[j];
        if (nx.type !== e.type || nx.action !== e.action) break;
        if (SUMMARY_RE.test(String(nx.description || ''))) break;
        const t1 = new Date(nx.created_at || 0).getTime();
        if (Math.abs(t0 - t1) > BULK_WINDOW_MS) break;
        group.push(nx);
        j++;
      }
      if (group.length >= 3) {
        const tm = TYPE_META[e.type] || { label: e.type || '—' };
        const am = ACTION_META[e.action] || { badge: (e.action || '?').toUpperCase() };
        out.push({
          ...e,
          id: 'bulk_' + (e.id || i),
          description: `${tm.label}: ${group.length}টি একসাথে ${am.badge === 'ADD' ? 'যোগ' : am.badge === 'DELETE' ? 'মুছে ফেলা' : 'আপডেট'} — সম্পন্ন`,
          _bulkCount: group.length,
        });
        i = j;
      } else {
        out.push(e);
        i++;
      }
    }
    return out;
  }

  // Pass 2: fold finance_ledger / accounts entries created right around a
  // primary entry into that row as "background updates", plus any explicit
  // RELATED_PAIRS combos. This is what stops "one transaction → 3 rows".
  function _mergeSideEffects(items) {
    const merged = [];
    const used = new Set();
    const capped = items.slice(0, 300);
    for (let i = 0; i < capped.length; i++) {
      if (used.has(i)) continue;
      const e = capped[i];
      const t0 = new Date(e.created_at || 0).getTime();
      const rel = RELATED_PAIRS[`${e.action}:${e.type}`] || [];

      // Settings edits: collapse consecutive same-type saves within window.
      if (e.type === 'settings' && e.action === 'edit') {
        let j = i + 1;
        while (j < capped.length && j < i + 8) {
          const nx = capped[j];
          const t1 = new Date(nx.created_at || 0).getTime();
          if (nx.type === 'settings' && nx.action === 'edit' && Math.abs(t0 - t1) <= MERGE_MS) used.add(j);
          j++;
        }
      }

      const absorbed = [];
      const isPrimary = !GENERIC_SIDE_EFFECT_TYPES.has(e.type);
      for (let j = i + 1; j < Math.min(capped.length, i + 10); j++) {
        if (used.has(j)) continue;
        const nx = capped[j];
        const t1 = new Date(nx.created_at || 0).getTime();
        if (Math.abs(t0 - t1) > MERGE_MS) continue;
        const explicitMatch = rel.includes(`${nx.action}:${nx.type}`);
        const genericMatch = isPrimary && GENERIC_SIDE_EFFECT_TYPES.has(nx.type);
        if (explicitMatch || genericMatch) {
          absorbed.push(nx);
          used.add(j);
        }
      }
      merged.push({ e, absorbed });
      used.add(i);
    }
    return merged;
  }

  function _buildRows(logs, filterAction, filterType, filterSearch) {
    if (!logs || logs.length === 0)
      return `<tr><td colspan="7" class="no-data"><i class="fa fa-inbox"></i> কোনো activity নেই</td></tr>`;

    let items = logs;
    if (filterAction && filterAction !== 'all') items = items.filter(l => l.action === filterAction);
    if (filterType   && filterType   !== 'all') items = items.filter(l => l.type   === filterType);
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      items = items.filter(l =>
        (l.description||'').toLowerCase().includes(q) ||
        (l.type||'').toLowerCase().includes(q));
    }

    items = _collapseBulkRuns(items);
    const merged = _mergeSideEffects(items);

    let lastDateStr = null;
    const rows = [];
    for (const { e: l, absorbed } of merged) {
      const dt = l.created_at ? new Date(l.created_at) : null;
      if (dt) {
        const today = new Date(); today.setHours(0,0,0,0);
        const yest  = new Date(today); yest.setDate(today.getDate()-1);
        const dStr  = dt.toDateString();
        if (dStr !== lastDateStr) {
          lastDateStr = dStr;
          const dlabel = dt >= today ? '📅 আজ'
                       : dt >= yest  ? '📅 গতকাল'
                       : '📅 ' + dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
          rows.push(`<tr><td colspan="7" style="padding:5px 14px;background:rgba(255,255,255,0.025);font-size:.70rem;font-weight:700;color:rgba(255,255,255,0.30);letter-spacing:.8px;border-top:1px solid rgba(255,255,255,0.06)">${dlabel}</td></tr>`);
        }
      }

      const tm  = TYPE_META[l.type]   || { icon:'fa-circle-dot', label: l.type||'—', color:'#aaa' };
      const am  = ACTION_META[l.action]|| { badge:(l.action||'?').toUpperCase(), color:'#aaa', bg:'rgba(255,255,255,0.06)', icon:'fa-circle' };
      const dev = l.device_id ? String(l.device_id).slice(-6) : '—';
      const ok  = l.status !== 'failed';
      const desc = (l.description || '');
      const rid  = 'al_' + (l.id || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, '');
      const short= desc.length > 90 ? desc.slice(0, 90) + '…' : desc;
      const long = desc.length > 90;
      const descEsc = Utils.esc(desc);
      const shortEsc = Utils.esc(short);
      const ridEsc = Utils.escAttr(rid);

      let absHtml = '';
      if (absorbed.length) {
        const uniq = [...new Set(absorbed.map(a => (TYPE_META[a.type]||{label:a.type}).label))];
        absHtml = `<div style="margin-top:3px;font-size:.68rem;color:rgba(255,255,255,0.28)"><i class="fa fa-link" style="font-size:.6rem"></i> ব্যাকগ্রাউন্ড আপডেট: ${uniq.join(', ')}</div>`;
      }

      rows.push(`<tr style="border-bottom:1px solid rgba(255,255,255,0.035)">
        <td style="padding:9px 10px;width:34px">
          <div style="width:28px;height:28px;border-radius:7px;background:${am.bg};display:flex;align-items:center;justify-content:center;border:1px solid ${am.color}33">
            <i class="fa ${am.icon}" style="color:${am.color};font-size:.75rem"></i>
          </div>
        </td>
        <td style="padding:9px 7px;white-space:nowrap">
          <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:.66rem;font-weight:800;background:${am.bg};color:${am.color};border:1px solid ${am.color}44;letter-spacing:.4px">${am.badge}</span>
        </td>
        <td style="padding:9px 7px;white-space:nowrap">
          <div style="display:flex;align-items:center;gap:5px">
            <i class="fa ${tm.icon}" style="color:${tm.color};font-size:.82rem"></i>
            <span style="font-size:.78rem;color:${tm.color};font-weight:600">${tm.label}</span>
          </div>
        </td>
        <td style="padding:9px 7px;max-width:270px">
          <div id="${ridEsc}_s" style="font-size:.80rem;line-height:1.5;color:rgba(255,255,255,0.82)">${shortEsc}${long?`<span onclick="document.getElementById('${ridEsc}_s').style.display='none';document.getElementById('${ridEsc}_f').style.display='block'" style="color:#00d9ff;cursor:pointer;font-size:.68rem;margin-left:4px">▼ আরও</span>`:''}</div>
          ${long?`<div id="${ridEsc}_f" style="display:none;font-size:.80rem;line-height:1.5;color:rgba(255,255,255,0.82)">${descEsc}<span onclick="document.getElementById('${ridEsc}_f').style.display='none';document.getElementById('${ridEsc}_s').style.display='block'" style="color:#00d9ff;cursor:pointer;font-size:.68rem;margin-left:4px">▲ কম</span></div>`:''}
          ${absHtml}
        </td>
        <td style="padding:9px 7px;white-space:nowrap;font-size:.76rem">
          ${ok?'<span style="color:#00ff88;font-weight:700"><i class="fa fa-check-circle"></i> OK</span>':'<span style="color:#ff4757;font-weight:700"><i class="fa fa-circle-xmark"></i> Failed</span>'}
        </td>
        <td style="padding:9px 7px;font-size:.70rem;color:rgba(255,255,255,0.32);white-space:nowrap"><i class="fa fa-mobile-screen" style="font-size:.65rem"></i> ${dev}</td>
        <td style="padding:9px 12px;text-align:right;font-size:.70rem;color:rgba(255,255,255,0.32);white-space:nowrap">${l.time||(dt?dt.toLocaleString('en-US',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—')}</td>
      </tr>`);
    }
    return rows.join('') || `<tr><td colspan="7" class="no-data">ফিল্টারে কোনো result নেই</td></tr>`;
  }

  // ── Panel HTML (used by SettingsModule.buildAllPanels) ──────────────────
  function panel(isActive) {
    const logs = getLogs();
    const addCount    = logs.filter(l => l.action === 'add').length;
    const editCount   = logs.filter(l => l.action === 'edit').length;
    const deleteCount = logs.filter(l => l.action === 'delete').length;

    return `
    <div class="settings-panel ${isActive ? 'active' : ''}" data-panel="activity">
      <div class="settings-card-title" style="color:var(--brand-primary)">
        <i class="fa fa-list-check"></i> FULL ACTIVITY LOG
        <div style="display:flex;gap:8px;align-items:center">
          <button class="settings-top-action"
            style="background:rgba(0,212,255,0.1);border-color:rgba(0,212,255,0.3);color:#00d4ff"
            onclick="if(typeof SupabaseSync!=='undefined'&&SupabaseSync.pullActivityLog){this.innerHTML='<i class=&quot;fa fa-rotate fa-spin&quot;></i> Syncing…';const me=this;SupabaseSync.pullActivityLog().then(()=>{ActivityLog.refresh();me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';Utils.toast('Activity log synced ✅','success');}).catch(()=>{me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';})}">
            <i class="fa fa-rotate"></i> SYNC
          </button>
          <button class="settings-top-action" onclick="ActivityLog.clear()">
            <i class="fa fa-trash-can"></i> CLEAR ALL
          </button>
        </div>
      </div>

      <div class="activity-stats">
        <span class="activity-stat-badge" id="astat-total" style="background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary)">মোট: ${logs.length}</span>
        <span class="activity-stat-badge" id="astat-add" style="background:rgba(0,255,136,0.10);color:#00ff88;border:1px solid rgba(0,255,136,0.25)">+ যোগ ${addCount}</span>
        <span class="activity-stat-badge" id="astat-edit" style="background:rgba(0,217,255,0.10);color:#00d9ff;border:1px solid rgba(0,217,255,0.25)">✏ এডিট ${editCount}</span>
        <span class="activity-stat-badge" id="astat-del" style="background:rgba(255,71,87,0.10);color:#ff4757;border:1px solid rgba(255,71,87,0.25)">🗑 ডিলিট ${deleteCount}</span>
        <span class="activity-stat-badge" style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);color:#00d4ff;font-size:.74rem">
          <i class="fa fa-wifi"></i> সব device sync (live)
        </span>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07)">
        <i class="fa fa-filter" style="color:var(--brand-primary);font-size:.82rem"></i>
        <select id="alog-filter-action" class="form-control" style="width:130px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="ActivityLog.filter()">
          <option value="all">সব Action</option>
          <option value="add">➕ ADD</option>
          <option value="edit">✏️ EDIT</option>
          <option value="delete">🗑 DELETE</option>
          <option value="restore">↩ RESTORE</option>
          <option value="system">⚙ SYSTEM</option>
          <option value="export">📤 EXPORT</option>
        </select>
        <select id="alog-filter-type" class="form-control" style="width:160px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="ActivityLog.filter()">
          <option value="all">সব Module</option>
          <option value="students">👨‍🎓 ছাত্র তালিকা</option>
          <option value="finance_ledger">💰 আয়-ব্যয় লেজার</option>
          <option value="accounts">🏦 একাউন্ট</option>
          <option value="loans">💳 লোন</option>
          <option value="salary">💵 বেতন</option>
          <option value="exams">📝 পরীক্ষা</option>
          <option value="attendance">📋 উপস্থিতি</option>
          <option value="staff">👤 স্টাফ</option>
          <option value="settings">⚙️ সেটিংস</option>
          <option value="security">🔐 নিরাপত্তা</option>
          <option value="certificates">🎓 সার্টিফিকেট</option>
          <option value="visitors">🚶 ভিজিটর</option>
          <option value="notices">📢 নোটিশ</option>
          <option value="student_portal_access">🔑 Student Portal</option>
        </select>
        <div style="flex:1;min-width:160px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:4px 10px">
          <i class="fa fa-search" style="color:rgba(255,255,255,0.35);font-size:.78rem"></i>
          <input type="text" id="alog-search" placeholder="সার্চ করুন…" style="background:none;border:none;outline:none;color:#fff;font-size:.82rem;width:100%;font-family:var(--font-ui)" oninput="ActivityLog.filter()" />
        </div>
        <button onclick="ActivityLog.clearFilters()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:7px;padding:6px 12px;cursor:pointer;font-size:.78rem">✕ ক্লিয়ার</button>
      </div>

      <div class="table-wrapper" style="max-height:480px;overflow:auto">
        <table>
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Action</th>
              <th>Module</th>
              <th>বিস্তারিত</th>
              <th>Status</th>
              <th>Device</th>
              <th style="text-align:right">⏱ সময়</th>
            </tr>
          </thead>
          <tbody id="alog-tbody">
            ${_buildRows(logs)}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ── Live refresh (in-place tbody + stats update, no modal rebuild) ──────
  function refresh() {
    const fresh  = getLogs();
    const p  = document.querySelector('[data-panel="activity"]');
    if (!p) return;
    const addC   = fresh.filter(l => l.action === 'add').length;
    const editC  = fresh.filter(l => l.action === 'edit').length;
    const delC   = fresh.filter(l => l.action === 'delete').length;
    const tot = document.getElementById('astat-total');
    const add = document.getElementById('astat-add');
    const edi = document.getElementById('astat-edit');
    const del = document.getElementById('astat-del');
    if (tot) tot.textContent = `মোট: ${fresh.length}`;
    if (add) add.textContent = `+ যোগ ${addC}`;
    if (edi) edi.textContent = `✏ এডিট ${editC}`;
    if (del) del.textContent = `🗑 ডিলিট ${delC}`;
    const tbody = document.getElementById('alog-tbody') || p.querySelector('tbody');
    if (!tbody) return;
    const fa = document.getElementById('alog-filter-action')?.value || 'all';
    const ft = document.getElementById('alog-filter-type')?.value   || 'all';
    const fs = (document.getElementById('alog-search')?.value || '').trim();
    tbody.innerHTML = _buildRows(fresh, fa, ft, fs);
  }

  function filter() { refresh(); }

  function clearFilters() {
    const fa = document.getElementById('alog-filter-action'); if (fa) fa.value = 'all';
    const ft = document.getElementById('alog-filter-type');   if (ft) ft.value = 'all';
    const fs = document.getElementById('alog-search');        if (fs) fs.value = '';
    refresh();
  }

  // ── Real-time: pull cloud log + refresh, then poll while the tab is open ──
  let _pollTimer = null;

  function pullAndRefresh() {
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.pullActivityLog) {
      return SupabaseSync.pullActivityLog().then(refresh).catch(refresh);
    }
    refresh();
    return Promise.resolve();
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    _pollTimer = setInterval(() => {
      // Only keep polling while the panel is actually visible.
      if (!document.querySelector('[data-panel="activity"].active')) { stopAutoRefresh(); return; }
      pullAndRefresh();
    }, 15000);
  }

  function stopAutoRefresh() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // Same-device instant refresh (fired synchronously by SupabaseSync.logActivity)
  window.addEventListener('wfa:activity-log', () => {
    if (document.querySelector('[data-panel="activity"].active')) refresh();
  });

  return {
    panel, refresh, filter, clearFilters, clear, log,
    pullAndRefresh, startAutoRefresh, stopAutoRefresh,
    getLogs, getActivityLogs,
  };
})();

if (typeof window !== 'undefined') window.ActivityLog = ActivityLog;
