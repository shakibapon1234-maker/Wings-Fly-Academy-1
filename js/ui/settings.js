// ============================================================
// Wings Fly Aviation Academy — Settings Module (Phase 10)
// ============================================================

const SettingsModule = (() => {

  let activeTab = 'general';

  function render() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const monitor = SyncEngine.getDataMonitor();
    const students = SupabaseSync.getAll(DB.students);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();

    container.innerHTML = `
      <div class="settings-modal-layout">
        <!-- LEFT SIDEBAR TABS -->
        <div class="settings-sidebar">
          <button class="settings-tab ${activeTab==='general'?'active':''}" onclick="SettingsModule.switchTab('general')">
            <i class="fa fa-sliders"></i> General Settings
          </button>
          <button class="settings-tab ${activeTab==='data'?'active':''}" onclick="SettingsModule.switchTab('data')">
            <i class="fa fa-database"></i> Data Management
          </button>
          <button class="settings-tab ${activeTab==='security'?'active':''}" onclick="SettingsModule.switchTab('security')">
            <i class="fa fa-lock"></i> Security & Access
          </button>
          <button class="settings-tab ${activeTab==='sync'?'active':''}" onclick="SettingsModule.switchTab('sync')">
            <i class="fa fa-cloud"></i> Sync Diagnostic
          </button>
          <button class="settings-tab ${activeTab==='danger'?'active':''}" onclick="SettingsModule.switchTab('danger')">
            <i class="fa fa-trash-can"></i> Danger Zone
          </button>
        </div>

        <!-- RIGHT CONTENT -->
        <div class="settings-content-area">

          <!-- ══════════ TAB: GENERAL SETTINGS ══════════ -->
          <div class="settings-panel ${activeTab==='general'?'':'hidden'}" id="tab-general">
            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-building" style="color:var(--accent)"></i> Academy Information</div>
              <div class="form-group mb-12">
                <label class="settings-label">ACADEMY NAME</label>
                <input id="set-academy-name" class="form-control" value="${cfg.academy_name||'Wings Fly Aviation Academy'}" placeholder="Enter Academy Name" />
              </div>
              <div class="form-group mb-12">
                <label class="settings-label">Address</label>
                <input id="set-address" class="form-control" value="${cfg.address||''}" placeholder="Academy Address" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="settings-label">Phone</label>
                  <input id="set-phone" class="form-control" value="${cfg.phone||''}" placeholder="Phone Number" />
                </div>
                <div class="form-group">
                  <label class="settings-label">Email</label>
                  <input id="set-email" class="form-control" value="${cfg.email||''}" placeholder="Email Address" />
                </div>
              </div>
            </div>

            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-crosshairs" style="color:var(--error)"></i> Monthly Target Income (BDT)</div>
              <input id="set-monthly-target" type="number" class="form-control" value="${cfg.monthly_target||''}" placeholder="e.g. 200000" style="max-width:400px" />
              <small class="text-muted" style="display:block;margin-top:6px">This sets the goal for your monthly progress bar.</small>
            </div>

            <div class="card mb-24" style="border:1px solid var(--accent);border-left:4px solid var(--accent)">
              <div class="card-title" style="color:var(--accent)"><i class="fa fa-chart-bar"></i> Dashboard Display Settings</div>

              <div class="form-group mb-12">
                <label class="settings-label" style="color:var(--primary-light);text-transform:uppercase;font-weight:700;font-size:.8rem">RUNNING BATCH SELECTION</label>
                <small class="text-muted" style="display:block;margin-bottom:6px">Select the batch you want to feature in the "Running Batch Overview" section on your dashboard.</small>
                <select id="set-running-batch" class="form-control" style="max-width:400px">
                  <option value="">-- All Batches --</option>
                  ${batches.map(b => `<option value="${b}" ${cfg.running_batch===b?'selected':''}>${'Batch ' + b}</option>`).join('')}
                </select>
              </div>

              <div class="form-group mb-12">
                <label class="settings-label">Expense Date / Month</label>
                <small class="text-muted" style="display:block;margin-bottom:6px">Filter the total expense for this specific month on the dashboard.</small>
                <input id="set-expense-month" type="month" class="form-control" value="${cfg.expense_month||''}" style="max-width:400px" />
              </div>
            </div>

            <button class="btn btn-primary" onclick="SettingsModule.saveAcademyInfo()">
              <i class="fa fa-floppy-disk"></i> Save Settings
            </button>
          </div>

          <!-- ══════════ TAB: DATA MANAGEMENT ══════════ -->
          <div class="settings-panel ${activeTab==='data'?'':'hidden'}" id="tab-data">
            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-chart-pie" style="color:var(--accent)"></i> Data Monitor</div>
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
                <button class="btn btn-outline btn-sm" onclick="SettingsModule.refreshMonitor()">🔄 Refresh</button>
                <button class="btn btn-outline btn-sm" onclick="SettingsModule.exportAllData()">📦 Export All (JSON)</button>
              </div>
            </div>

            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-file-import" style="color:var(--primary-light)"></i> Data Migration (Old → New)</div>
              <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
                Import data from your old Supabase project or a JSON backup file.
              </p>
              <div class="form-row">
                <div class="form-group">
                  <label>Old Supabase URL</label>
                  <input id="mig-url" class="form-control" placeholder="https://xxxxx.supabase.co" />
                </div>
                <div class="form-group">
                  <label>Old Anon Key</label>
                  <input id="mig-key" class="form-control" placeholder="eyJh..." />
                </div>
              </div>
              <div id="mig-status" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px;display:none"></div>
              <div style="display:flex;gap:10px">
                <button class="btn btn-primary btn-sm" onclick="SettingsModule.startMigration()">📥 Start Import</button>
                <button class="btn btn-outline btn-sm" onclick="SettingsModule.importFromJSON()">📄 Import from JSON</button>
              </div>
            </div>
          </div>

          <!-- ══════════ TAB: SECURITY & ACCESS ══════════ -->
          <div class="settings-panel ${activeTab==='security'?'':'hidden'}" id="tab-security">
            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-lock" style="color:var(--accent-gold)"></i> Change Password</div>
              <div class="form-row">
                <div class="form-group">
                  <label>Current Password</label>
                  <input type="password" id="set-old-pw" class="form-control" placeholder="Current Password" />
                </div>
                <div class="form-group">
                  <label>New Password</label>
                  <input type="password" id="set-new-pw" class="form-control" placeholder="New Password" />
                </div>
                <div class="form-group">
                  <label>Confirm</label>
                  <input type="password" id="set-confirm-pw" class="form-control" placeholder="Retype" />
                </div>
              </div>
              <div style="margin-top:16px">
                <button class="btn btn-accent" onclick="SettingsModule.changePassword()">🔑 Change Password</button>
              </div>
            </div>

            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-palette" style="color:var(--primary-light)"></i> Theme</div>
              <div style="display:flex;gap:12px;align-items:center">
                <button class="btn btn-outline" onclick="SettingsModule.setTheme('light')">☀️ Light Mode</button>
                <button class="btn btn-outline" onclick="SettingsModule.setTheme('dark')">🌙 Dark Mode</button>
              </div>
            </div>
          </div>

          <!-- ══════════ TAB: SYNC DIAGNOSTIC ══════════ -->
          <div class="settings-panel ${activeTab==='sync'?'':'hidden'}" id="tab-sync">
            <div class="card mb-24">
              <div class="card-title"><i class="fa fa-cloud" style="color:var(--accent)"></i> Cloud Sync (Real-time)</div>
              <p style="font-size:.9rem;color:var(--text-secondary);margin-bottom:12px">
                Supabase real-time sync is active. All changes are automatically synced across connected devices.
              </p>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
                <button class="btn btn-primary btn-sm" onclick="SyncEngine.pull()">⬇ Pull from Cloud</button>
                <button class="btn btn-accent btn-sm" onclick="SyncEngine.push()">⬆ Push to Cloud</button>
                <button class="btn btn-outline btn-sm" onclick="SyncEngine.startRealtime(); Utils.toast('Real-time Turned On','success')">🟢 Real-time On</button>
                <button class="btn btn-outline btn-sm" onclick="SyncEngine.stopRealtime(); SyncEngine.setStatus('synced'); Utils.toast('Real-time Off','info')">🔴 Real-time Off</button>
              </div>
              <div style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted)">
                <strong>Device ID:</strong> <code>${SupabaseSync._deviceId()}</code>
              </div>
            </div>
          </div>

          <!-- ══════════ TAB: DANGER ZONE ══════════ -->
          <div class="settings-panel ${activeTab==='danger'?'':'hidden'}" id="tab-danger">
            <div class="card" style="border-color:var(--error)">
              <div class="card-title" style="color:var(--error)"><i class="fa fa-triangle-exclamation"></i> Danger Zone</div>
              <p style="font-size:.9rem;color:var(--text-secondary);margin-bottom:16px">These actions are irreversible. Proceed with caution.</p>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn btn-danger btn-sm" onclick="SettingsModule.clearLocalData()">🗑️ Delete Local Data</button>
                <button class="btn btn-danger btn-sm" onclick="SettingsModule.clearCloudData()">☁️🗑️ Delete Cloud Data</button>
              </div>
              <small class="text-muted" style="display:block;margin-top:8px">Warning: Deleting cloud data will permanently remove data from all connected devices!</small>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function switchTab(tab) {
    activeTab = tab;
    render();
  }

  // ── Academy Info ──────────────────────────────────────────
  async function saveAcademyInfo() {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || { id: SupabaseSync.generateId() };
    cfg.academy_name = Utils.formVal('set-academy-name');
    cfg.address      = Utils.formVal('set-address');
    cfg.phone        = Utils.formVal('set-phone');
    cfg.email        = Utils.formVal('set-email');
    cfg.monthly_target = Utils.safeNum(Utils.formVal('set-monthly-target'));
    cfg.running_batch = Utils.formVal('set-running-batch');
    cfg.expense_month  = Utils.formVal('set-expense-month');

    if (cfg.id && SupabaseSync.getById(DB.settings, cfg.id)) {
      SupabaseSync.update(DB.settings, cfg.id, cfg);
    } else {
      SupabaseSync.insert(DB.settings, cfg);
    }
    Utils.toast('Academy info saved ✅', 'success');
  }

  // ── Password ──────────────────────────────────────────────
  async function changePassword() {
    const cfg     = SupabaseSync.getAll(DB.settings)[0] || { id: SupabaseSync.generateId() };
    const oldPw   = Utils.formVal('set-old-pw');
    const newPw   = Utils.formVal('set-new-pw');
    const confirmPw = Utils.formVal('set-confirm-pw');
    const current = cfg.admin_password || 'admin123';

    if (oldPw !== current) { Utils.toast('Current password incorrect!', 'error'); return; }
    if (!newPw || newPw.length < 4) { Utils.toast('New password must be at least 4 characters', 'error'); return; }
    if (newPw !== confirmPw) { Utils.toast('Passwords do not match!', 'error'); return; }

    cfg.admin_password = newPw;
    if (cfg.id && SupabaseSync.getById(DB.settings, cfg.id)) {
      SupabaseSync.update(DB.settings, cfg.id, cfg);
    } else {
      SupabaseSync.insert(DB.settings, cfg);
    }
    Utils.toast('Password changed successfully ✅', 'success');
  }

  // ── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wfa_theme', theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    Utils.toast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode activated`, 'info');
  }

  // ── Data Monitor ──────────────────────────────────────────
  function refreshMonitor() {
    render();
    Utils.toast('Data monitor refreshed', 'info');
  }

  function viewTableData(tableName) {
    const rows = SupabaseSync.getAll(tableName);
    if (!rows.length) { Utils.toast('No data available', 'info'); return; }

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
        ${rows.length > 20 ? `Showing first 20 (Total ${rows.length})` : `Total ${rows.length} records`}
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
    Utils.toast('All data exported ✅', 'success');
  }

  // ── Data Migration ────────────────────────────────────────
  async function startMigration() {
    const oldUrl = Utils.formVal('mig-url');
    const oldKey = Utils.formVal('mig-key');
    const statusEl = document.getElementById('mig-status');

    if (!oldUrl || !oldKey) {
      Utils.toast('URL and Key are required', 'error');
      return;
    }

    statusEl.style.display = 'block';
    statusEl.innerHTML = '🔄 Starting migration...';

    try {
      const oldClient = supabase.createClient(oldUrl, oldKey);
      let imported = 0;
      let errors = 0;

      for (const [key, tableName] of Object.entries(DB)) {
        statusEl.innerHTML = `🔄 Fetching data from ${tableName}...`;

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

            statusEl.innerHTML = `✅ ${tableName}: ${data.length} records (${newRows.length} New)`;
          }
        } catch (e) {
          console.warn(`[Migration] Error on ${tableName}:`, e);
          errors++;
        }
      }

      statusEl.innerHTML = `✅ Migration complete! ${imported} new records imported. ${errors > 0 ? `⚠️ ${errors} tables skipped.` : ''}`;
      Utils.toast(`Migration complete! ${imported} records imported`, 'success');

      // Refresh UI
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
      render();

    } catch (e) {
      console.error('[Migration] Failed:', e);
      statusEl.innerHTML = `❌ Migration Failed: ${e.message}`;
      Utils.toast('Migration failed', 'error');
    }
  }

  // ── Import from JSON file (supports legacy backup format) ──
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
        const statusEl = document.getElementById('mig-status');
        if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '🔄 Analyzing backup format...'; }

        // ── Detect if this is a LEGACY backup format ──
        const isLegacy = data.hasOwnProperty('employees') ||
                         data.hasOwnProperty('cashBalance') ||
                         data.hasOwnProperty('incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          Utils.toast('Legacy backup detected — converting...', 'info');
          imported = await importLegacyData(data, statusEl);
        } else {
          // Standard format — direct import by table name
          for (const [tableName, rows] of Object.entries(data)) {
            if (!Array.isArray(rows) || !rows.length) continue;
            const existing = SupabaseSync.getAll(tableName);
            const existingIds = new Set(existing.map(r => r.id));
            const newRows = rows.filter(r => r.id && !existingIds.has(r.id));

            if (newRows.length > 0) {
              SupabaseSync.setAll(tableName, [...newRows, ...existing]);
              imported += newRows.length;
            }
          }
        }

        if (statusEl) statusEl.innerHTML = `✅ Import complete! ${imported} records imported.`;
        Utils.toast(`Import complete! ${imported} records imported`, 'success');

        // Push imported data to cloud
        if (imported > 0) {
          if (statusEl) statusEl.innerHTML += '<br>🔄 Pushing to cloud...';
          await SyncEngine.push();
          if (statusEl) statusEl.innerHTML += '<br>✅ Cloud sync complete!';
        }

        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
        render();

      } catch (e) {
        console.error('[Import] Failed:', e);
        Utils.toast('Failed to read JSON: ' + e.message, 'error');
      }
    };
    input.click();
  }

  // ── Legacy Data Transformer ────────────────────────────────
  async function importLegacyData(data, statusEl) {
    let total = 0;

    // ── 1. STUDENTS ──
    if (data.students && data.students.length) {
      const log = (m) => { if (statusEl) statusEl.innerHTML = m; };
      log('🔄 Importing students...');
      const mapped = data.students.map(s => ({
        id:             SupabaseSync.generateId(),
        student_id:     s.studentId || s.student_id || '',
        name:           s.name || '',
        phone:          s.phone || '',
        course:         s.course || '',
        batch:          s.batch || '',
        session:        s.session || '',
        total_fee:      s.totalPayment || s.total_fee || 0,
        paid:           s.paid || 0,
        due:            s.due || (s.totalPayment || 0) - (s.paid || 0),
        method:         s.method || 'Cash',
        admission_date: s.enrollDate || s.admission_date || '',
        father_name:    s.fatherName || s.father_name || '',
        mother_name:    s.motherName || s.mother_name || '',
        blood_group:    s.bloodGroup || s.blood_group || '',
        photo:          s.photo || '',
        remarks:        s.remarks || '',
        status:         s.status || 'Active',
        created_at:     s.createdAt || s.created_at || new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.students);
      const existingSids = new Set(existing.map(r => r.student_id));
      const newRows = mapped.filter(r => !existingSids.has(r.student_id));
      if (newRows.length) {
        SupabaseSync.setAll(DB.students, [...newRows, ...existing]);
        total += newRows.length;
        log(`✅ Students: ${newRows.length} imported`);
      }
    }

    // ── 2. EMPLOYEES → STAFF ──
    if (data.employees && data.employees.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing staff...';
      const mapped = data.employees.map(emp => ({
        id:           emp.id || SupabaseSync.generateId(),
        staffId:      emp.id || emp.staffId || '',
        name:         emp.name || '',
        role:         emp.role || 'Staff',
        phone:        emp.phone || '',
        email:        emp.email || '',
        salary:       emp.salary || 0,
        status:       emp.status || 'Active',
        joiningDate:  emp.joiningDate || '',
        resignDate:   emp.resignDate || '',
        created_at:   emp.lastUpdated || emp.createdAt || new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.staff);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) {
        SupabaseSync.setAll(DB.staff, [...newRows, ...existing]);
        total += newRows.length;
      }
    }

    // ── 3. FINANCE → FINANCE_LEDGER ──
    if (data.finance && data.finance.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing finance...';
      const mapped = data.finance.map(f => ({
        id:          String(f.id || SupabaseSync.generateId()),
        type:        f.type || 'Expense',
        method:      f.method || 'Cash',
        category:    f.category || '',
        description: f.description || '',
        amount:      f.amount || 0,
        date:        f.date || '',
        note:        f.note || f.person || '',
        created_at:  f.createdAt || f.timestamp || new Date().toISOString(),
        updated_at:  f.updatedAt || new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.finance);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) {
        SupabaseSync.setAll(DB.finance, [...newRows, ...existing]);
        total += newRows.length;
      }
    }

    // ── 4. ACCOUNTS (Cash + Bank + Mobile) ──
    if (statusEl) statusEl.innerHTML = '🔄 Importing accounts...';
    const accountEntries = [];
    if (data.cashBalance) {
      const bal = typeof data.cashBalance === 'object' ? (data.cashBalance.amount || data.cashBalance.balance || 0) : data.cashBalance;
      accountEntries.push({ id: SupabaseSync.generateId(), type: 'Cash', balance: bal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    if (data.bankAccounts && Array.isArray(data.bankAccounts)) {
      data.bankAccounts.forEach(b => {
        accountEntries.push({ id: SupabaseSync.generateId(), type: 'Bank', balance: b.balance || b.amount || 0, name: b.name || b.bankName || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      });
    }
    if (data.mobileBanking) {
      const bal = typeof data.mobileBanking === 'object' ? (data.mobileBanking.balance || data.mobileBanking.amount || 0) : data.mobileBanking;
      accountEntries.push({ id: SupabaseSync.generateId(), type: 'Mobile Banking', balance: bal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    if (accountEntries.length) {
      const existing = SupabaseSync.getAll(DB.accounts);
      SupabaseSync.setAll(DB.accounts, [...accountEntries, ...existing]);
      total += accountEntries.length;
    }

    // ── 5. VISITORS ──
    if (data.visitors && data.visitors.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing visitors...';
      const mapped = data.visitors.map(v => ({
        id:         v.id || SupabaseSync.generateId(),
        name:       v.name || '',
        phone:      v.phone || '',
        course:     v.interestedCourse || v.course || '',
        remarks:    v.remarks || '',
        date:       v.date || v.visitDate || '',
        created_at: v.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.visitors);
      SupabaseSync.setAll(DB.visitors, [...mapped, ...existing]);
      total += mapped.length;
    }

    // ── 6. NOTICES ──
    if (data.notices && data.notices.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing notices...';
      const existing = SupabaseSync.getAll(DB.notices);
      SupabaseSync.setAll(DB.notices, [...data.notices, ...existing]);
      total += data.notices.length;
    }

    // ── 7. SETTINGS ──
    if (data.settings) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing settings...';
      const cfg = Array.isArray(data.settings) ? data.settings[0] : data.settings;
      if (cfg) {
        const existing = SupabaseSync.getAll(DB.settings);
        if (!existing.length) {
          SupabaseSync.insert(DB.settings, {
            academy_name:   cfg.academyName || cfg.academy_name || 'Wings Fly Aviation Academy',
            address:        cfg.address || '',
            phone:          cfg.phone || '',
            email:          cfg.email || '',
            admin_password: cfg.password || cfg.admin_password || 'admin123',
          });
          total += 1;
        }
      }
    }

    // ── 8. EXAM REGISTRATIONS ──
    if (data.examRegistrations && data.examRegistrations.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing exams...';
      const mapped = data.examRegistrations.map(e => ({
        id:           e.id || SupabaseSync.generateId(),
        reg_id:       e.regId || e.reg_id || '',
        student_id:   e.studentId || e.student_id || '',
        student_name: e.studentName || e.student_name || '',
        batch:        e.batch || '',
        subject:      e.subject || '',
        exam_date:    e.examDate || e.exam_date || '',
        exam_fee:     e.examFee || e.exam_fee || 0,
        grade:        e.grade || '',
        marks:        e.marks || null,
        status:       e.status || 'Registered',
        created_at:   e.createdAt || new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.exams);
      SupabaseSync.setAll(DB.exams, [...mapped, ...existing]);
      total += mapped.length;
    }

    return total;
  }

  // ── Clear Local Data ──────────────────────────────────────
  async function clearLocalData() {
    const ok = await Utils.confirm('Delete all local data? Cloud data will remain.', 'Delete Data');
    if (!ok) return;
    // Stop real-time sync so data doesn't get pulled back automatically
    SyncEngine.stopRealtime();
    Object.values(DB).forEach(t => localStorage.removeItem(`wfa_${t}`));
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_retry_queue');
    Utils.toast('Local data deleted. Page reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  }

  // ── Clear Cloud Data ──────────────────────────────────────
  async function clearCloudData() {
    const ok = await Utils.confirm('⚠️ All cloud data will be permanently deleted! Data will be lost on all devices. This cannot be undone!', '☁️ Delete Cloud Data');
    if (!ok) return;
    const ok2 = await Utils.confirm('Confirm again — Are you absolutely sure you want to delete all cloud data?', 'Final Confirmation');
    if (!ok2) return;

    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try {
          await client.from(tableName).delete().neq('id', '__never_match__');
        } catch { /* skip tables that don't exist */ }
      }
      Utils.toast('Cloud data deleted', 'info');
    } catch (e) {
      Utils.toast('Failed to delete cloud data: ' + e.message, 'error');
    }
  }

  return {
    render, switchTab, saveAcademyInfo, changePassword, setTheme,
    refreshMonitor, viewTableData, exportAllData,
    startMigration, importFromJSON,
    clearLocalData, clearCloudData,
  };
})();

window.SettingsModule = SettingsModule;
