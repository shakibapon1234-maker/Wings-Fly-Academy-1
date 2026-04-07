// ============================================================
// Wings Fly Aviation Academy — Settings Module (Phase 10)
// ============================================================

const SettingsModule = (() => {

  function render() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const monitor = SyncEngine.getDataMonitor();

    container.innerHTML = `
      <div class="page-header">
        <h2 class="bn">⚙️ সেটিংস</h2>
      </div>

      <!-- Academy Info -->
      <div class="card mb-24">
        <div class="card-title bn">🏫 একাডেমি তথ্য</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="bn">একাডেমির নাম</label>
            <input id="set-academy-name" value="${cfg.academy_name||'Wings Fly Aviation Academy'}" />
          </div>
          <div class="form-group">
            <label class="bn">ঠিকানা</label>
            <input id="set-address" value="${cfg.address||''}" />
          </div>
          <div class="form-group">
            <label class="bn">ফোন</label>
            <input id="set-phone" value="${cfg.phone||''}" />
          </div>
          <div class="form-group">
            <label class="bn">ইমেইল</label>
            <input id="set-email" value="${cfg.email||''}" />
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" onclick="SettingsModule.saveAcademyInfo()">💾 সংরক্ষণ করুন</button>
        </div>
      </div>

      <!-- Password Change -->
      <div class="card mb-24">
        <div class="card-title bn">🔒 পাসওয়ার্ড পরিবর্তন</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="bn">বর্তমান পাসওয়ার্ড</label>
            <input type="password" id="set-old-pw" placeholder="বর্তমান পাসওয়ার্ড" />
          </div>
          <div class="form-group">
            <label class="bn">নতুন পাসওয়ার্ড</label>
            <input type="password" id="set-new-pw" placeholder="নতুন পাসওয়ার্ড" />
          </div>
          <div class="form-group">
            <label class="bn">নিশ্চিত করুন</label>
            <input type="password" id="set-confirm-pw" placeholder="পুনরায় দিন" />
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-accent" onclick="SettingsModule.changePassword()">🔑 পাসওয়ার্ড পরিবর্তন করুন</button>
        </div>
      </div>

      <!-- Theme -->
      <div class="card mb-24">
        <div class="card-title bn">🎨 থিম</div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('light')">☀️ Light Mode</button>
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('dark')">🌙 Dark Mode</button>
        </div>
      </div>

      <!-- Cloud Sync & Real-time -->
      <div class="card mb-24">
        <div class="card-title">☁️ Cloud Sync (Real-time)</div>
        <p class="bn" style="font-size:.9rem;color:var(--text-secondary);margin-bottom:12px">
          Supabase real-time sync চালু আছে। যেকোনো ডিভাইসে পরিবর্তন করলে অন্য সব ডিভাইসে স্বয়ংক্রিয়ভাবে আপডেট হবে।
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-primary btn-sm" onclick="SyncEngine.pull()">⬇ Cloud থেকে Pull</button>
          <button class="btn btn-accent btn-sm" onclick="SyncEngine.push()">⬆ Cloud-এ Push</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.startRealtime(); Utils.toast('Real-time চালু হয়েছে','success')">🟢 Real-time চালু</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.stopRealtime(); SyncEngine.setStatus('synced'); Utils.toast('Real-time বন্ধ','info')">🔴 Real-time বন্ধ</button>
        </div>
        <div style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted)">
          <strong>Device ID:</strong> <code>${SupabaseSync._deviceId()}</code>
        </div>
      </div>

      <!-- Data Monitor -->
      <div class="card mb-24">
        <div class="card-title">📊 Data Monitor</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th class="text-right">Local Records</th>
                <th>Last Updated</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(monitor).map(([key, v]) => `
                <tr>
                  <td style="font-weight:600">${v.table}</td>
                  <td class="text-right" style="font-family:var(--font-ui)">${v.localCount}</td>
                  <td style="font-size:.8rem;color:var(--text-muted)">${v.lastUpdated !== '—' ? Utils.formatDate(v.lastUpdated) : '—'}</td>
                  <td class="no-print">
                    <button class="btn btn-outline btn-xs" onclick="SettingsModule.viewTableData('${v.table}')" title="View"><i class="fa fa-eye"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-outline btn-sm" onclick="SettingsModule.refreshMonitor()">🔄 রিফ্রেশ</button>
          <button class="btn btn-outline btn-sm" onclick="SettingsModule.exportAllData()">📦 সব Export (JSON)</button>
        </div>
      </div>

      <!-- Data Migration -->
      <div class="card mb-24">
        <div class="card-title bn">🔄 Data Migration (পুরোনো → নতুন)</div>
        <p class="bn" style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
          পুরোনো Supabase প্রজেক্ট থেকে data Import করুন। পুরোনো URL এবং Anon Key দিন, তারপর Import চাপুন।
        </p>
        <div class="form-row">
          <div class="form-group">
            <label>পুরোনো Supabase URL</label>
            <input id="mig-url" class="form-control" placeholder="https://xxxxx.supabase.co" />
          </div>
          <div class="form-group">
            <label>পুরোনো Anon Key</label>
            <input id="mig-key" class="form-control" placeholder="eyJh..." />
          </div>
        </div>
        <div id="mig-status" class="bn" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px;display:none"></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.startMigration()">📥 Import শুরু</button>
          <button class="btn btn-outline btn-sm" onclick="SettingsModule.importFromJSON()">📄 JSON থেকে Import</button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card" style="border-color:var(--error)">
        <div class="card-title" style="color:var(--error)">⚠️ Danger Zone</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" onclick="SettingsModule.clearLocalData()">🗑️ Local Data মুছুন</button>
          <button class="btn btn-danger btn-sm" onclick="SettingsModule.clearCloudData()">☁️🗑️ Cloud Data মুছুন</button>
        </div>
        <small class="text-muted bn" style="display:block;margin-top:8px">সতর্কতা: Cloud Data মুছলে সব ডিভাইসের data হারিয়ে যাবে!</small>
      </div>
    `;
  }

  // ── Academy Info ──────────────────────────────────────────
  async function saveAcademyInfo() {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || { id: SupabaseSync.generateId() };
    cfg.academy_name = Utils.formVal('set-academy-name');
    cfg.address      = Utils.formVal('set-address');
    cfg.phone        = Utils.formVal('set-phone');
    cfg.email        = Utils.formVal('set-email');

    if (cfg.id && SupabaseSync.getById(DB.settings, cfg.id)) {
      SupabaseSync.update(DB.settings, cfg.id, cfg);
    } else {
      SupabaseSync.insert(DB.settings, cfg);
    }
    Utils.toast('একাডেমি তথ্য সংরক্ষিত হয়েছে ✅', 'success');
  }

  // ── Password ──────────────────────────────────────────────
  async function changePassword() {
    const cfg     = SupabaseSync.getAll(DB.settings)[0] || { id: SupabaseSync.generateId() };
    const oldPw   = Utils.formVal('set-old-pw');
    const newPw   = Utils.formVal('set-new-pw');
    const confirmPw = Utils.formVal('set-confirm-pw');
    const current = cfg.admin_password || 'admin123';

    if (oldPw !== current) { Utils.toast('বর্তমান পাসওয়ার্ড ভুল!', 'error'); return; }
    if (!newPw || newPw.length < 4) { Utils.toast('নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return; }
    if (newPw !== confirmPw) { Utils.toast('পাসওয়ার্ড মিলছে না!', 'error'); return; }

    cfg.admin_password = newPw;
    if (cfg.id && SupabaseSync.getById(DB.settings, cfg.id)) {
      SupabaseSync.update(DB.settings, cfg.id, cfg);
    } else {
      SupabaseSync.insert(DB.settings, cfg);
    }
    Utils.toast('পাসওয়ার্ড পরিবর্তন সফল হয়েছে ✅', 'success');
  }

  // ── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wfa_theme', theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    Utils.toast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode চালু হয়েছে`, 'info');
  }

  // ── Data Monitor ──────────────────────────────────────────
  function refreshMonitor() {
    render();
    Utils.toast('Data monitor রিফ্রেশ হয়েছে', 'info');
  }

  function viewTableData(tableName) {
    const rows = SupabaseSync.getAll(tableName);
    if (!rows.length) { Utils.toast('কোনো ডেটা নেই', 'info'); return; }

    const fields = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const sample = rows.slice(0, 20);
    const headerHTML = fields.slice(0, 6).map(f => `<th style="font-size:.75rem">${f}</th>`).join('');
    const bodyHTML = sample.map(r => `<tr>${fields.slice(0, 6).map(f =>
      `<td style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[f] ?? '—'}</td>`
    ).join('')}</tr>`).join('');

    Utils.openModal(`📋 ${tableName} (${rows.length} records)`, `
      <div class="table-wrapper" style="max-height:400px;overflow:auto">
        <table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-top:8px">
        ${rows.length > 20 ? `প্রথম ২০টি দেখানো হচ্ছে (মোট ${rows.length})` : `মোট ${rows.length} records`}
      </p>
    `, 'modal-lg');
  }

  // ── Export All Data ───────────────────────────────────────
  function exportAllData() {
    const allData = {};
    for (const [key, tableName] of Object.entries(DB)) {
      allData[tableName] = SupabaseSync.getAll(tableName);
    }
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wfa_backup_${Utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast('সব ডেটা Export হয়েছে ✅', 'success');
  }

  // ── Data Migration ────────────────────────────────────────
  async function startMigration() {
    const oldUrl = Utils.formVal('mig-url');
    const oldKey = Utils.formVal('mig-key');
    const statusEl = document.getElementById('mig-status');

    if (!oldUrl || !oldKey) {
      Utils.toast('URL এবং Key দিন', 'error');
      return;
    }

    statusEl.style.display = 'block';
    statusEl.innerHTML = '🔄 Migration শুরু হচ্ছে...';

    try {
      const oldClient = supabase.createClient(oldUrl, oldKey);
      let imported = 0;
      let errors = 0;

      for (const [key, tableName] of Object.entries(DB)) {
        statusEl.innerHTML = `🔄 ${tableName} থেকে data আনছি...`;

        try {
          const { data, error } = await oldClient
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.warn(`[Migration] Skip ${tableName}:`, error.message);
            errors++;
            continue;
          }

          if (data && data.length > 0) {
            // Merge with existing local data
            const existingRows = SupabaseSync.getAll(tableName);
            const existingIds = new Set(existingRows.map(r => r.id));
            const newRows = data.filter(r => !existingIds.has(r.id));

            if (newRows.length > 0) {
              const merged = [...newRows, ...existingRows];
              SupabaseSync.setAll(tableName, merged);
              imported += newRows.length;

              // Push to new cloud
              const { client } = window.SUPABASE_CONFIG;
              for (let i = 0; i < newRows.length; i += 50) {
                const batch = newRows.slice(i, i + 50);
                await client.from(tableName).upsert(batch, { onConflict: 'id' });
              }
            }

            statusEl.innerHTML = `✅ ${tableName}: ${data.length} records (${newRows.length} নতুন)`;
          }
        } catch (e) {
          console.warn(`[Migration] Error on ${tableName}:`, e);
          errors++;
        }
      }

      statusEl.innerHTML = `✅ Migration সম্পন্ন! ${imported} নতুন records imported. ${errors > 0 ? `⚠️ ${errors} tables skipped.` : ''}`;
      Utils.toast(`Migration সম্পন্ন! ${imported} records imported`, 'success');

      // Refresh UI
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
      render();

    } catch (e) {
      console.error('[Migration] Failed:', e);
      statusEl.innerHTML = `❌ Migration ব্যর্থ: ${e.message}`;
      Utils.toast('Migration ব্যর্থ হয়েছে', 'error');
    }
  }

  // ── Import from JSON file ─────────────────────────────────
  function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        let imported = 0;

        for (const [tableName, rows] of Object.entries(data)) {
          if (!Array.isArray(rows)) continue;
          const existing = SupabaseSync.getAll(tableName);
          const existingIds = new Set(existing.map(r => r.id));
          const newRows = rows.filter(r => r.id && !existingIds.has(r.id));

          if (newRows.length > 0) {
            SupabaseSync.setAll(tableName, [...newRows, ...existing]);
            imported += newRows.length;
          }
        }

        Utils.toast(`JSON Import সম্পন্ন! ${imported} নতুন records`, 'success');

        // Push imported data to cloud
        await SyncEngine.push();
        render();

      } catch (e) {
        Utils.toast('JSON পড়তে ব্যর্থ: ' + e.message, 'error');
      }
    };
    input.click();
  }

  // ── Clear Local Data ──────────────────────────────────────
  async function clearLocalData() {
    const ok = await Utils.confirm('সত্যিই local data মুছবেন? Cloud-এ data থাকবে।', 'ডেটা মুছুন');
    if (!ok) return;
    Object.values(DB).forEach(t => localStorage.removeItem(`wfa_${t}`));
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_retry_queue');
    Utils.toast('Local data মুছে ফেলা হয়েছে', 'success');
    SyncEngine.pull();
    render();
  }

  // ── Clear Cloud Data ──────────────────────────────────────
  async function clearCloudData() {
    const ok = await Utils.confirm('⚠️ সব Cloud data মুছে যাবে! সব ডিভাইসের data হারাবে। এটা Undo করা যাবে না!', '☁️ Cloud Data মুছুন');
    if (!ok) return;
    const ok2 = await Utils.confirm('দ্বিতীয়বার নিশ্চিত করুন — আপনি কি সত্যিই সব Cloud data মুছতে চান?', 'পুনরায় নিশ্চিত করুন');
    if (!ok2) return;

    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try {
          await client.from(tableName).delete().neq('id', '__never_match__');
        } catch { /* skip tables that don't exist */ }
      }
      Utils.toast('Cloud data মুছে ফেলা হয়েছে', 'info');
    } catch (e) {
      Utils.toast('Cloud data মুছতে ব্যর্থ: ' + e.message, 'error');
    }
  }

  return {
    render, saveAcademyInfo, changePassword, setTheme,
    refreshMonitor, viewTableData, exportAllData,
    startMigration, importFromJSON,
    clearLocalData, clearCloudData,
  };
})();

window.SettingsModule = SettingsModule;
