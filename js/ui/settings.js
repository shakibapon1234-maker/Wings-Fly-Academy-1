// ============================================================
// Wings Fly Aviation Academy — Settings Module (Full Parity)
// 11 Tabs matching legacy app design
// ============================================================

const SettingsModule = (() => {

  let activeTab = 'general';
  let isOpen = false;

  // ─── MODAL OPEN / CLOSE ───────────────────────────────────────
  function openModal() {
    if (isOpen) return;
    isOpen = true;
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.id = 'settings-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.innerHTML = buildModalHTML();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      isOpen = false;
    }, 200);
  }

  // ─── RENDER (inline fallback for section) ─────────────────────
  function render() {
    openModal();
  }

  // ─── BUILD MODAL HTML ─────────────────────────────────────────
  function buildModalHTML() {
    return `
      <div class="settings-modal">
        <div class="settings-modal-header">
          <h2><i class="fa fa-gear"></i> System Settings</h2>
          <button class="settings-close-btn" onclick="SettingsModule.closeModal()">✕</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-sidebar">
            ${buildSidebarTabs()}
            <button class="settings-save-all" onclick="SettingsModule.saveAllChanges()">
              <i class="fa fa-floppy-disk"></i> SAVE ALL CHANGES
            </button>
          </div>
          <div class="settings-content-area">
            ${buildAllPanels()}
          </div>
        </div>
      </div>
    `;
  }

  // ─── SIDEBAR TABS ─────────────────────────────────────────────
  function buildSidebarTabs() {
    const tabs = [
      { id: 'general',       icon: 'fa-sliders',             label: 'General Settings' },
      { id: 'categories',    icon: 'fa-tags',                label: 'Categories & Courses' },
      { id: 'data',          icon: 'fa-database',            label: 'Data Management' },
      { id: 'security',      icon: 'fa-lock',                label: 'Security & Access' },
      { id: 'activity',      icon: 'fa-list-check',          label: 'Activity Log' },
      { id: 'recycle',       icon: 'fa-trash-can',           label: 'Recycle Bin' },
      { id: 'sync',          icon: 'fa-magnifying-glass',    label: 'Sync Diagnostic' },
      { id: 'keeprecord',    icon: 'fa-flag',                label: 'Keep Record' },
      { id: 'batchprofit',   icon: 'fa-chart-column',        label: 'Batch Profit Report' },
      { id: 'accounts-mgmt', icon: 'fa-briefcase',           label: 'Accounts Management' },
      { id: 'monitor',       icon: 'fa-chart-line',          label: 'Monitor' },
    ];
    return tabs.map(t => `
      <button class="settings-tab ${activeTab === t.id ? 'active' : ''}"
              data-tab="${t.id}"
              onclick="SettingsModule.switchTab('${t.id}')">
        <i class="fa ${t.icon}"></i> ${t.label}
      </button>
    `).join('');
  }

  // ─── ALL PANELS ───────────────────────────────────────────────
  function buildAllPanels() {
    return `
      ${panelGeneral()}
      ${panelCategories()}
      ${panelData()}
      ${panelSecurity()}
      ${panelActivity()}
      ${panelRecycle()}
      ${panelSync()}
      ${panelKeepRecord()}
      ${panelBatchProfit()}
      ${panelAccountsMgmt()}
      ${panelMonitor()}
    `;
  }

  // ─── TAB SWITCH ───────────────────────────────────────────────
  function switchTab(tab) {
    activeTab = tab;
    // Update sidebar
    document.querySelectorAll('.settings-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Update panels
    document.querySelectorAll('.settings-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 1: GENERAL SETTINGS
  // ════════════════════════════════════════════════════════════════
  function panelGeneral() {
    const cfg = getConfig();
    const students = SupabaseSync.getAll(DB.students);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();
    const today = new Date().toISOString().split('T')[0];
    const expStart = cfg.expense_start_date || '';
    const expEnd = cfg.expense_end_date || today;

    return `
    <div class="settings-panel ${activeTab === 'general' ? 'active' : ''}" data-panel="general">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-building"></i> Academy Information</div>
        <div class="form-group mb-12">
          <label class="settings-label">ACADEMY NAME</label>
          <input id="set-academy-name" class="form-control" value="${cfg.academy_name || 'Wings Fly Aviation Academy'}" placeholder="Enter Academy Name" />
        </div>
      </div>

      <div class="settings-card glow-red">
        <div class="settings-card-title"><i class="fa fa-crosshairs"></i> Monthly Target Income (BDT)</div>
        <input id="set-monthly-target" type="number" class="form-control" value="${cfg.monthly_target || ''}" placeholder="e.g. 200000" style="max-width:500px" />
        <small class="settings-sublabel" style="margin-top:6px">This sets the goal for your monthly progress bar.</small>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title" style="color:var(--brand-primary)"><i class="fa fa-chart-bar"></i> Dashboard Display Settings</div>

        <div class="form-group mb-12">
          <label class="settings-label">RUNNING BATCH SELECTION</label>
          <small class="settings-sublabel">Select the batch you want to feature in the "Running Batch Overview" section on your dashboard.</small>
          <select id="set-running-batch" class="form-control" style="max-width:500px">
            <option value="">-- All Batches --</option>
            ${batches.map(b => `<option value="${b}" ${cfg.running_batch === b ? 'selected' : ''}>Batch ${b}</option>`).join('')}
          </select>
        </div>

        <div class="form-group mb-12">
          <label class="settings-label" style="color:var(--error)">EXPENSE DATE RANGE</label>
          <small class="settings-sublabel">শুধু Start Date সেট করুন। End Date সবসময় আজকের তারিখ পর্যন্ত অটো-আপডেট হবে।</small>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">From (শুরু)</label>
              <input id="set-expense-start" type="date" class="form-control" value="${expStart}" />
            </div>
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">To (আজ পর্যন্ত) <span class="auto-badge">AUTO</span></label>
              <input type="date" class="form-control" value="${expEnd}" disabled style="color:var(--success)" />
            </div>
          </div>
          <div style="margin-top:8px;padding:10px 14px;background:var(--bg-base);border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
            <i class="fa fa-info-circle" style="color:var(--brand-primary)"></i>
            Start Date সেট করলে সেই তারিখ থেকে আজ পর্যন্ত expense দেখাবে। Start Date খালি রাখলে সব expense দেখাবে।
          </div>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 2: CATEGORIES & COURSES
  // ════════════════════════════════════════════════════════════════
  function panelCategories() {
    const cfg = getConfig();
    const incomeCats = cfg.income_categories ? JSON.parse(cfg.income_categories) : ['Course Fee', 'Incentive', 'Loan Received', 'Other'];
    const expenseCats = cfg.expense_categories ? JSON.parse(cfg.expense_categories) : ['Rent', 'Salary', 'Loan Given', 'Other'];
    const courses = cfg.courses ? JSON.parse(cfg.courses) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];
    const roles = cfg.employee_roles ? JSON.parse(cfg.employee_roles) : ['Admin', 'Instructor', 'Staff'];

    return `
    <div class="settings-panel ${activeTab === 'categories' ? 'active' : ''}" data-panel="categories">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">

        ${buildCategoryCard('Income Categories', 'income_categories', incomeCats, 'green', 'success')}
        ${buildCategoryCard('Expense Categories', 'expense_categories', expenseCats, 'red', 'error')}
        ${buildCategoryCard('Course / Program Names', 'courses', courses, 'cyan', 'brand-primary')}
        ${buildCategoryCard('Employee Roles / Designations', 'employee_roles', roles, 'purple', 'brand-accent')}

      </div>
    </div>`;
  }

  function buildCategoryCard(title, key, items, colorClass, cssVar) {
    return `
      <div class="settings-card glow-${colorClass === 'cyan' ? 'cyan' : colorClass === 'green' ? 'green' : colorClass === 'red' ? 'red' : 'purple'}">
        <div class="settings-card-title" style="color:var(--${cssVar})">${title.toUpperCase()}</div>
        <div class="category-add-row">
          <input id="cat-add-${key}" class="form-control" placeholder="Add new ${title.toLowerCase().split(' ')[0]}..." />
          <button class="category-add-btn ${colorClass}" onclick="SettingsModule.addCategory('${key}')">+ ADD</button>
        </div>
        <div class="category-list" id="cat-list-${key}">
          ${items.map(item => `
            <div class="category-item">
              <span>${item}</span>
              <button class="cat-delete" onclick="SettingsModule.removeCategory('${key}','${item.replace(/'/g, "\\'")}')">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function addCategory(key) {
    const input = document.getElementById(`cat-add-${key}`);
    if (!input || !input.value.trim()) return;
    const cfg = getConfig();
    const items = cfg[key] ? JSON.parse(cfg[key]) : [];
    const newItem = input.value.trim();
    if (items.includes(newItem)) { Utils.toast('Already exists', 'error'); return; }
    items.push(newItem);
    cfg[key] = JSON.stringify(items);
    saveConfig(cfg);
    input.value = '';
    refreshModal();
    logActivity('add', 'category', `Added "${newItem}" to ${key}`);
  }

  function removeCategory(key, item) {
    const cfg = getConfig();
    const items = cfg[key] ? JSON.parse(cfg[key]) : [];
    const idx = items.indexOf(item);
    if (idx > -1) items.splice(idx, 1);
    cfg[key] = JSON.stringify(items);
    saveConfig(cfg);
    refreshModal();
    logActivity('delete', 'category', `Removed "${item}" from ${key}`);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 3: DATA MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  function panelData() {
    return `
    <div class="settings-panel ${activeTab === 'data' ? 'active' : ''}" data-panel="data">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-floppy-disk"></i> Backup & Restore</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px">Save your data locally or restore from a file.</p>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <button class="settings-btn-lg btn-export" onclick="SettingsModule.exportAllData()">
            <i class="fa fa-floppy-disk"></i> EXPORT DATA
          </button>
          <button class="settings-btn-lg btn-export" style="border-color:var(--text-muted);color:var(--text-muted)" onclick="SettingsModule.importFromJSON()">
            <i class="fa fa-cloud-arrow-up"></i> IMPORT DATA
          </button>
        </div>
        <button class="settings-btn-lg btn-sync-cloud" onclick="SyncEngine.push().then(()=>Utils.toast('Synced!','success'))">
          <i class="fa fa-cloud"></i> SYNC WITH CLOUD NOW
        </button>
        <small style="display:block;text-align:center;margin-top:6px;color:var(--text-muted);font-size:.78rem">Auto-syncs every 30 seconds</small>
      </div>

      <div class="settings-card glow-red">
        <div class="settings-card-title"><i class="fa fa-triangle-exclamation"></i> Danger Zone</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px">This action cannot be undone.</p>
        <button class="btn btn-outline btn-sm" style="border-color:var(--error);color:var(--error);margin-bottom:10px;width:100%;justify-content:center" onclick="SettingsModule.clearLocalData()">
          <i class="fa fa-trash-can"></i> RESET DATA ONLY (KEEP SETTINGS)
        </button>
        <button class="settings-btn-lg btn-factory-reset" onclick="SettingsModule.factoryReset()">
          <i class="fa fa-triangle-exclamation"></i> FACTORY RESET (DELETE EVERYTHING)
        </button>
        <div style="margin-top:12px;font-size:.82rem;color:var(--text-muted)">
          <strong>Data Reset:</strong> Deletes students & transactions, keeps categories & settings.<br>
          <strong>Factory Reset:</strong> Deletes everything including all settings.
        </div>
      </div>

      <div class="settings-card glow-cyan" style="margin-top:12px">
        <div class="settings-card-title"><i class="fa fa-file-import"></i> Data Migration (Old → New)</div>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
          Import data from your old Supabase project or a JSON backup file.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div class="form-group" style="flex:1;min-width:200px">
            <label>Old Supabase URL</label>
            <input id="mig-url" class="form-control" placeholder="https://xxxxx.supabase.co" />
          </div>
          <div class="form-group" style="flex:1;min-width:200px">
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
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 4: SECURITY & ACCESS
  // ════════════════════════════════════════════════════════════════
  function panelSecurity() {
    return `
    <div class="settings-panel ${activeTab === 'security' ? 'active' : ''}" data-panel="security">
      <div class="settings-card glow-gold">
        <div class="settings-card-title"><i class="fa fa-lock"></i> Change Password</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div class="form-group" style="flex:1;min-width:180px">
            <label>Current Password</label>
            <input type="password" id="set-old-pw" class="form-control" placeholder="Current Password" />
          </div>
          <div class="form-group" style="flex:1;min-width:180px">
            <label>New Password</label>
            <input type="password" id="set-new-pw" class="form-control" placeholder="New Password" />
          </div>
          <div class="form-group" style="flex:1;min-width:180px">
            <label>Confirm</label>
            <input type="password" id="set-confirm-pw" class="form-control" placeholder="Retype" />
          </div>
        </div>
        <button class="btn btn-accent" onclick="SettingsModule.changePassword()">🔑 Change Password</button>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-palette"></i> Theme</div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('light')">☀️ Light Mode</button>
          <button class="btn btn-outline" onclick="SettingsModule.setTheme('dark')">🌙 Dark Mode</button>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 5: ACTIVITY LOG
  // ════════════════════════════════════════════════════════════════
  function panelActivity() {
    const logs = getActivityLogs();
    const addCount = logs.filter(l => l.action === 'add').length;
    const editCount = logs.filter(l => l.action === 'edit').length;
    const deleteCount = logs.filter(l => l.action === 'delete').length;

    return `
    <div class="settings-panel ${activeTab === 'activity' ? 'active' : ''}" data-panel="activity">
      <div class="settings-card-title" style="color:var(--brand-primary)">
        <i class="fa fa-list-check"></i> FULL ACTIVITY LOG
        <button class="settings-top-action" onclick="SettingsModule.clearActivityLog()">
          <i class="fa fa-trash-can"></i> CLEAR ALL
        </button>
      </div>

      <div class="activity-stats">
        <span class="activity-stat-badge" style="background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary)">মোট: ${logs.length}</span>
        <span class="activity-stat-badge" style="background:var(--success-bg);color:var(--success)">+ ${addCount}</span>
        <span class="activity-stat-badge" style="background:var(--info-bg);color:var(--info)">✏ ${editCount}</span>
        <span class="activity-stat-badge" style="background:var(--error-bg);color:var(--error)">🗑 ${deleteCount}</span>
      </div>

      <div class="table-wrapper" style="max-height:450px;overflow:auto">
        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Action</th>
              <th>Type</th>
              <th>Description</th>
              <th style="text-align:right">⏱ Time</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `<tr><td colspan="5" class="no-data"><i class="fa fa-inbox"></i> No activity log</td></tr>` :
              logs.slice(0, 100).map(l => `
                <tr>
                  <td><i class="fa ${l.action === 'add' ? 'fa-plus-circle' : l.action === 'edit' ? 'fa-pen' : 'fa-trash'}"
                        style="color:${l.action === 'add' ? 'var(--success)' : l.action === 'edit' ? 'var(--info)' : 'var(--error)'}"></i></td>
                  <td><span class="badge ${l.action === 'add' ? 'badge-success' : l.action === 'edit' ? 'badge-info' : 'badge-error'}" style="text-transform:uppercase">${l.action}</span></td>
                  <td style="font-size:.82rem">${l.type || '—'}</td>
                  <td style="font-size:.82rem;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.description || ''}</td>
                  <td style="text-align:right;font-size:.78rem;color:var(--text-muted)">${l.time || '—'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 6: RECYCLE BIN
  // ════════════════════════════════════════════════════════════════
  function panelRecycle() {
    const deleted = getDeletedItems();
    return `
    <div class="settings-panel ${activeTab === 'recycle' ? 'active' : ''}" data-panel="recycle">
      <div class="settings-card-title" style="color:var(--error)">
        <i class="fa fa-trash-can"></i> RECYCLE BIN
        <button class="settings-top-action" onclick="SettingsModule.emptyRecycleBin()">
          <i class="fa fa-trash-can"></i> EMPTY BIN
        </button>
      </div>
      <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px">Deleted items — Restore or permanently delete.</p>
      <span class="badge badge-muted" style="margin-bottom:12px;display:inline-block">মোট: ${deleted.length}</span>

      <div class="table-wrapper" style="max-height:400px;overflow:auto">
        <table>
          <thead><tr><th>Icon</th><th>Type</th><th>Item</th><th>Deleted At</th><th>Actions</th></tr></thead>
          <tbody>
            ${deleted.length === 0 ?
              `<tr><td colspan="5" class="no-data" style="padding:40px"><i class="fa fa-trash-can" style="font-size:2rem;opacity:.3;display:block;margin-bottom:8px"></i>Recycle Bin খালি।</td></tr>` :
              deleted.map((d, i) => `
                <tr>
                  <td><i class="fa ${d.type === 'student' ? 'fa-user-graduate' : d.type === 'transaction' ? 'fa-money-bill' : 'fa-file'}"></i></td>
                  <td><span class="badge badge-muted">${d.type || 'item'}</span></td>
                  <td style="font-size:.85rem">${d.name || d.description || d.id || '—'}</td>
                  <td style="font-size:.78rem;color:var(--text-muted)">${d.deletedAt ? new Date(d.deletedAt).toLocaleString() : '—'}</td>
                  <td>
                    <button class="btn btn-outline btn-xs" onclick="SettingsModule.restoreItem(${i})" title="Restore"><i class="fa fa-rotate-left"></i></button>
                    <button class="btn btn-danger btn-xs" onclick="SettingsModule.permanentDelete(${i})" title="Delete Forever"><i class="fa fa-xmark"></i></button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 7: SYNC DIAGNOSTIC
  // ════════════════════════════════════════════════════════════════
  function panelSync() {
    return `
    <div class="settings-panel ${activeTab === 'sync' ? 'active' : ''}" data-panel="sync">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-bolt"></i> System Diagnostic Center</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px">Data, Sync ও সব function ঠিকঠাক আছে কিনা এখানে দেখুন</p>
      </div>

      <div class="settings-card glow-green">
        <div class="settings-card-title"><i class="fa fa-heart-pulse" style="color:var(--error)"></i> AUTO-HEAL ENGINE</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:.85rem;color:var(--text-secondary)">Background-এ নিজে নিজে সমস্যা খুঁজে fix করে — প্রতি ৬০ সেকেন্ডে</span>
          <button class="btn btn-success btn-sm" onclick="SettingsModule.runAutoHeal()"><i class="fa fa-bolt"></i> এখনই Run করুন</button>
        </div>
        <div class="diag-stats" id="diag-heal-stats">
          <div class="diag-stat-box green"><div class="label">মোট Check</div><div class="value" id="heal-total">0</div></div>
          <div class="diag-stat-box blue"><div class="label">Auto Fix</div><div class="value" id="heal-fixed">0</div></div>
          <div class="diag-stat-box blue"><div class="label">শেষ Check</div><div class="value" id="heal-last">—</div></div>
          <div class="diag-stat-box red"><div class="label">শেষ Fix</div><div class="value" id="heal-lastfix">—</div></div>
        </div>
        <div style="margin-top:10px">
          <div class="settings-label" style="font-size:.78rem"><i class="fa fa-wrench"></i> HEAL LOG</div>
          <div id="heal-log-output" style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);min-height:40px;border:1px solid var(--border)">
            Engine চালু হলে এখানে log দেখাবে...
          </div>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-database"></i> SYNC & DATA CHECK</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.85rem;color:var(--text-secondary)">Check all data integrity</span>
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.runSyncCheck()"><i class="fa fa-magnifying-glass"></i> পরীক্ষা চালান</button>
        </div>
        <div id="sync-check-output" style="margin-top:10px;font-size:.82rem;color:var(--text-muted)"></div>
      </div>

      <div class="settings-card glow-purple">
        <div class="settings-card-title"><i class="fa fa-cloud"></i> Cloud Sync (Real-time)</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px">
          Supabase real-time sync is active. All changes are automatically synced.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-primary btn-sm" onclick="SyncEngine.pull()">⬇ Pull from Cloud</button>
          <button class="btn btn-accent btn-sm" onclick="SyncEngine.push()">⬆ Push to Cloud</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.startRealtime(); Utils.toast('Real-time On','success')">🟢 Real-time On</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.stopRealtime(); Utils.toast('Real-time Off','info')">🔴 Real-time Off</button>
        </div>
        <div style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
          <strong>Device ID:</strong> <code>${typeof SupabaseSync !== 'undefined' ? SupabaseSync._deviceId() : '—'}</code>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 8: KEEP RECORD
  // ════════════════════════════════════════════════════════════════
  function panelKeepRecord() {
    const notes = getKeepRecords();
    return `
    <div class="settings-panel ${activeTab === 'keeprecord' ? 'active' : ''}" data-panel="keeprecord">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="settings-card-title" style="color:var(--success);margin-bottom:0"><i class="fa fa-flag"></i> KEEP RECORD</div>
        <button class="btn btn-success btn-sm" onclick="SettingsModule.addNote()"><i class="fa fa-plus"></i> ADD NOTE</button>
      </div>

      <div id="notes-container">
        ${notes.length === 0 ?
          `<div class="no-data" style="padding:60px 20px">
            <i class="fa fa-flag" style="font-size:2.5rem;color:var(--error);opacity:.5;display:block;margin-bottom:12px"></i>
            কোনো নোট পাওয়া যায়নি<br>
            <span style="color:var(--success);font-size:.82rem">নতুন নোট যোগ করতে উপরের বাটনে ক্লিক করুন</span>
          </div>` :
          notes.map((n, i) => `
            <div class="note-card">
              <button class="note-delete" onclick="SettingsModule.deleteNote(${i})"><i class="fa fa-xmark"></i></button>
              <div class="note-title">${n.title || 'Untitled'}</div>
              <div class="note-content">${n.content || ''}</div>
              <div class="note-date">${n.date || ''}</div>
            </div>
          `).join('')
        }
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 9: BATCH PROFIT REPORT
  // ════════════════════════════════════════════════════════════════
  function panelBatchProfit() {
    const students = SupabaseSync.getAll(DB.students);
    const finance = SupabaseSync.getAll(DB.finance);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();

    return `
    <div class="settings-panel ${activeTab === 'batchprofit' ? 'active' : ''}" data-panel="batchprofit">
      <div class="settings-card glow-red">
        <div class="settings-card-title"><i class="fa fa-chart-column"></i> BATCH PROFIT REPORT</div>
        <div class="form-group mb-12">
          <label class="settings-label">Select Batch</label>
          <select id="batch-profit-select" class="form-control" style="max-width:300px" onchange="SettingsModule.renderBatchReport()">
            <option value="">-- All Batches --</option>
            ${batches.map(b => `<option value="${b}">Batch ${b}</option>`).join('')}
          </select>
        </div>
        <div id="batch-profit-content">${buildBatchReport(students, finance, '')}</div>
      </div>
    </div>`;
  }

  function renderBatchReport() {
    const batch = document.getElementById('batch-profit-select')?.value || '';
    const students = SupabaseSync.getAll(DB.students);
    const finance = SupabaseSync.getAll(DB.finance);
    const container = document.getElementById('batch-profit-content');
    if (container) container.innerHTML = buildBatchReport(students, finance, batch);
  }

  function buildBatchReport(students, finance, selectedBatch) {
    const filtered = selectedBatch ? students.filter(s => s.batch === selectedBatch) : students;
    const totalIncome = filtered.reduce((s, st) => s + (parseFloat(st.paid) || 0), 0);
    const batchExpense = finance
      .filter(f => f.type === 'Expense' && (!selectedBatch || f.batch === selectedBatch))
      .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const netProfit = totalIncome - batchExpense;

    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">
        <div class="diag-stat-box green"><div class="label">Total Income</div><div class="value">৳${totalIncome.toLocaleString()}</div></div>
        <div class="diag-stat-box red"><div class="label">Total Expense</div><div class="value">৳${batchExpense.toLocaleString()}</div></div>
        <div class="diag-stat-box ${netProfit >= 0 ? 'green' : 'red'}"><div class="label">Net Profit</div><div class="value">৳${netProfit.toLocaleString()}</div></div>
      </div>
      <div style="color:var(--error);font-size:1.1rem;font-weight:800;text-align:right;margin-bottom:12px">Grand Total: ৳${netProfit.toLocaleString()}</div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>#</th><th>Student</th><th>Batch</th><th>Total Fee</th><th>Paid</th><th>Due</th></tr></thead>
          <tbody>
            ${filtered.length === 0 ? '<tr><td colspan="6" class="no-data">No data</td></tr>' :
              filtered.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.name || '—'}</td>
                  <td>${s.batch || '—'}</td>
                  <td style="color:var(--brand-primary)">৳${(parseFloat(s.total_fee) || 0).toLocaleString()}</td>
                  <td style="color:var(--success)">৳${(parseFloat(s.paid) || 0).toLocaleString()}</td>
                  <td style="color:var(--error)">৳${(parseFloat(s.due || (s.total_fee - s.paid)) || 0).toLocaleString()}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 10: ACCOUNTS MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  function panelAccountsMgmt() {
    const accounts = SupabaseSync.getAll(DB.accounts);
    return `
    <div class="settings-panel ${activeTab === 'accounts-mgmt' ? 'active' : ''}" data-panel="accounts-mgmt">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-briefcase"></i> ACCOUNTS MANAGEMENT</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <p style="font-size:.85rem;color:var(--text-secondary)">Manage advance payments, investments, and finance totals.</p>
          <button class="btn btn-outline btn-sm" onclick="SettingsModule.runAutoFix()"><i class="fa fa-wrench"></i> RUN AUTO-FIX (DATA REPAIR)</button>
        </div>
        <div id="autofix-status" style="font-size:.82rem;color:var(--text-muted);margin-bottom:12px">Checking data status...</div>
      </div>

      <div class="settings-sub-tabs">
        <button class="settings-sub-tab active" onclick="SettingsModule.showAccountsSubTab('advance')">Advance Payment</button>
        <button class="settings-sub-tab" onclick="SettingsModule.showAccountsSubTab('investment')">Investment</button>
      </div>

      <div id="accounts-mgmt-subtab-content">
        ${buildAdvancePaymentSection()}
      </div>
    </div>`;
  }

  function buildAdvancePaymentSection() {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    return `
      <div class="settings-card glow-green">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-money-bill-transfer"></i> Advance Payments</div>
          <button class="btn btn-success btn-sm" onclick="SettingsModule.addAdvancePayment()">+ ADD ADVANCE</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Person</th><th>Amount</th><th>Date</th><th>Note</th><th>Action</th></tr></thead>
            <tbody>
              ${advances.length === 0 ? '<tr><td colspan="6" class="no-data">No advance payments</td></tr>' :
                advances.map((a, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${a.person || '—'}</td>
                    <td style="color:var(--success)">৳${(parseFloat(a.amount) || 0).toLocaleString()}</td>
                    <td style="font-size:.82rem">${a.date || '—'}</td>
                    <td style="font-size:.82rem">${a.note || '—'}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="SettingsModule.deleteAdvance(${i})"><i class="fa fa-xmark"></i></button></td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function showAccountsSubTab(tab) {
    document.querySelectorAll('.settings-sub-tab').forEach((btn, i) => {
      btn.classList.toggle('active', (tab === 'advance' && i === 0) || (tab === 'investment' && i === 1));
    });
    const container = document.getElementById('accounts-mgmt-subtab-content');
    if (!container) return;
    if (tab === 'advance') {
      container.innerHTML = buildAdvancePaymentSection();
    } else {
      const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
      container.innerHTML = `
        <div class="settings-card glow-purple">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> Investments</div>
            <button class="btn btn-accent btn-sm" onclick="SettingsModule.addInvestment()">+ ADD INVESTMENT</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Source</th><th>Amount</th><th>Date</th><th>Note</th><th>Action</th></tr></thead>
              <tbody>
                ${investments.length === 0 ? '<tr><td colspan="6" class="no-data">No investments</td></tr>' :
                  investments.map((inv, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td>${inv.source || '—'}</td>
                      <td style="color:var(--brand-accent)">৳${(parseFloat(inv.amount) || 0).toLocaleString()}</td>
                      <td style="font-size:.82rem">${inv.date || '—'}</td>
                      <td style="font-size:.82rem">${inv.note || '—'}</td>
                      <td><button class="btn btn-danger btn-xs" onclick="SettingsModule.deleteInvestment(${i})"><i class="fa fa-xmark"></i></button></td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 11: MONITOR
  // ════════════════════════════════════════════════════════════════
  function panelMonitor() {
    const monitor = typeof SyncEngine !== 'undefined' ? SyncEngine.getDataMonitor() : {};
    const recentChanges = JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]');
    const totalRecords = Object.values(monitor).reduce((s, v) => s + (v.localCount || 0), 0);

    return `
    <div class="settings-panel ${activeTab === 'monitor' ? 'active' : ''}" data-panel="monitor">
      <div class="settings-card glow-purple">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> DATA MONITOR</div>
          <span style="color:var(--brand-primary);font-size:1.1rem;font-weight:800">Grand Total: ৳${totalRecords}</span>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">লাস্ট ১০টা data change/save এখানে দেখাবে। যেকোনো row তে ক্লিক করলে উপরে সেই সময়কার Account Balance Snapshot দেখাবে।</p>

        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>DATE</th><th>TYPE</th><th>CATEGORY</th><th>PERSON</th></tr></thead>
            <tbody>
              ${recentChanges.length === 0 ?
                `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No recent changes</td></tr>` :
                recentChanges.slice(0, 10).map((c, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td style="font-size:.82rem">${c.date || '—'}</td>
                    <td><span class="badge ${c.type === 'System' ? 'badge-info' : 'badge-success'}">${c.type || '—'}</span></td>
                    <td style="font-size:.82rem">${c.category || '—'}</td>
                    <td style="font-size:.82rem">${c.person || '—'}</td>
                  </tr>
                  <tr><td colspan="5" style="padding:0"><div class="monitor-bar" style="width:${Math.max(20, 100 - i * 8)}%"></div></td></tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px">
          <div class="settings-label">DATA TABLE COUNTS</div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Table</th><th class="text-right">Local Records</th><th>Last Updated</th><th>Action</th></tr></thead>
              <tbody>
                ${Object.entries(monitor).map(([key, v]) => `
                  <tr>
                    <td style="font-weight:600">${v.table}</td>
                    <td class="text-right" style="font-family:var(--font-ui)">${v.localCount}</td>
                    <td style="font-size:.78rem;color:var(--text-muted)">${v.lastUpdated !== '—' ? (typeof Utils !== 'undefined' ? Utils.formatDate(v.lastUpdated) : v.lastUpdated) : '—'}</td>
                    <td><button class="btn btn-outline btn-xs" onclick="SettingsModule.viewTableData('${v.table}')" title="View"><i class="fa fa-eye"></i></button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ════════════════════════════════════════════════════════════════

  function getConfig() {
    return SupabaseSync.getAll(DB.settings)[0] || {};
  }

  function saveConfig(cfg) {
    if (cfg.id && SupabaseSync.getById(DB.settings, cfg.id)) {
      SupabaseSync.update(DB.settings, cfg.id, cfg);
    } else {
      cfg.id = cfg.id || SupabaseSync.generateId();
      SupabaseSync.insert(DB.settings, cfg);
    }
  }

  function refreshModal() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    const savedTab = activeTab;
    overlay.innerHTML = buildModalHTML();
    activeTab = savedTab;
    switchTab(savedTab);
  }

  // ─── Activity Log ─────────────────────────────────────────────
  function getActivityLogs() {
    return JSON.parse(localStorage.getItem('wfa_activity_log') || '[]');
  }

  function logActivity(action, type, description) {
    const logs = getActivityLogs();
    logs.unshift({
      action, type, description,
      user: 'Admin',
      time: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    });
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem('wfa_activity_log', JSON.stringify(logs));
  }

  function clearActivityLog() {
    localStorage.setItem('wfa_activity_log', '[]');
    Utils.toast('Activity log cleared', 'info');
    refreshModal();
  }

  // ─── Recycle Bin ──────────────────────────────────────────────
  function getDeletedItems() {
    return JSON.parse(localStorage.getItem('wfa_deletedItems') || '[]');
  }

  function restoreItem(index) {
    const deleted = getDeletedItems();
    const item = deleted[index];
    if (!item) return;
    // Restore back to its table
    if (item.table && item.data) {
      const existing = SupabaseSync.getAll(item.table);
      existing.push(item.data);
      SupabaseSync.setAll(item.table, existing);
    }
    deleted.splice(index, 1);
    localStorage.setItem('wfa_deletedItems', JSON.stringify(deleted));
    Utils.toast('Item restored', 'success');
    logActivity('add', 'restore', `Restored ${item.type || 'item'}: ${item.name || ''}`);
    refreshModal();
  }

  function permanentDelete(index) {
    const deleted = getDeletedItems();
    deleted.splice(index, 1);
    localStorage.setItem('wfa_deletedItems', JSON.stringify(deleted));
    Utils.toast('Permanently deleted', 'info');
    refreshModal();
  }

  function emptyRecycleBin() {
    localStorage.setItem('wfa_deletedItems', '[]');
    Utils.toast('Recycle Bin emptied', 'info');
    refreshModal();
  }

  // ─── Keep Record (Notes) ──────────────────────────────────────
  function getKeepRecords() {
    return JSON.parse(localStorage.getItem('wfa_keep_records') || '[]');
  }

  function addNote() {
    Utils.openModal('📝 Add Note', `
      <div class="form-group mb-12">
        <label>Title</label>
        <input id="note-title" class="form-control" placeholder="Note title..." />
      </div>
      <div class="form-group mb-12">
        <label>Content</label>
        <textarea id="note-content" class="form-control" rows="4" placeholder="Write your note..."></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="SettingsModule.saveNote()"><i class="fa fa-check"></i> Save Note</button>
      </div>
    `);
  }

  function saveNote() {
    const title = document.getElementById('note-title')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    if (!title && !content) { Utils.toast('Write something', 'error'); return; }
    const notes = getKeepRecords();
    notes.unshift({
      title: title || 'Untitled',
      content: content || '',
      date: new Date().toLocaleString(),
    });
    localStorage.setItem('wfa_keep_records', JSON.stringify(notes));
    Utils.closeModal();
    Utils.toast('Note saved', 'success');
    logActivity('add', 'note', `Added note: ${title}`);
    refreshModal();
  }

  function deleteNote(index) {
    const notes = getKeepRecords();
    notes.splice(index, 1);
    localStorage.setItem('wfa_keep_records', JSON.stringify(notes));
    Utils.toast('Note deleted', 'info');
    refreshModal();
  }

  // ─── Advance Payments & Investments ───────────────────────────
  function addAdvancePayment() {
    Utils.openModal('💰 Add Advance Payment', `
      <div class="form-group mb-12"><label>Person Name</label><input id="adv-person" class="form-control" placeholder="Name" /></div>
      <div class="form-group mb-12"><label>Amount</label><input id="adv-amount" type="number" class="form-control" placeholder="Amount" /></div>
      <div class="form-group mb-12"><label>Date</label><input id="adv-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}" /></div>
      <div class="form-group mb-12"><label>Note</label><input id="adv-note" class="form-control" placeholder="Optional note" /></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="SettingsModule.saveAdvancePayment()"><i class="fa fa-check"></i> Save</button>
      </div>
    `);
  }
  function saveAdvancePayment() {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    advances.push({
      person: document.getElementById('adv-person')?.value || '',
      amount: document.getElementById('adv-amount')?.value || 0,
      date: document.getElementById('adv-date')?.value || '',
      note: document.getElementById('adv-note')?.value || '',
    });
    localStorage.setItem('wfa_advance_payments', JSON.stringify(advances));
    Utils.closeModal();
    Utils.toast('Advance payment saved', 'success');
    refreshModal();
  }
  function deleteAdvance(i) {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    advances.splice(i, 1);
    localStorage.setItem('wfa_advance_payments', JSON.stringify(advances));
    refreshModal();
  }

  function addInvestment() {
    Utils.openModal('📈 Add Investment', `
      <div class="form-group mb-12"><label>Source</label><input id="inv-source" class="form-control" placeholder="Source" /></div>
      <div class="form-group mb-12"><label>Amount</label><input id="inv-amount" type="number" class="form-control" placeholder="Amount" /></div>
      <div class="form-group mb-12"><label>Date</label><input id="inv-date" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}" /></div>
      <div class="form-group mb-12"><label>Note</label><input id="inv-note" class="form-control" placeholder="Optional note" /></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-accent" onclick="SettingsModule.saveInvestment()"><i class="fa fa-check"></i> Save</button>
      </div>
    `);
  }
  function saveInvestment() {
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
    investments.push({
      source: document.getElementById('inv-source')?.value || '',
      amount: document.getElementById('inv-amount')?.value || 0,
      date: document.getElementById('inv-date')?.value || '',
      note: document.getElementById('inv-note')?.value || '',
    });
    localStorage.setItem('wfa_investments', JSON.stringify(investments));
    Utils.closeModal();
    Utils.toast('Investment saved', 'success');
    refreshModal();
  }
  function deleteInvestment(i) {
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
    investments.splice(i, 1);
    localStorage.setItem('wfa_investments', JSON.stringify(investments));
    refreshModal();
  }

  // ─── Diagnostic Functions ─────────────────────────────────────
  function runAutoHeal() {
    let checks = 0, fixes = 0;
    const logEl = document.getElementById('heal-log-output');

    // Check each table for orphan/corrupt records
    Object.values(DB).forEach(table => {
      const rows = SupabaseSync.getAll(table);
      checks += rows.length;
      const cleaned = rows.filter(r => r && r.id);
      if (cleaned.length < rows.length) {
        fixes += rows.length - cleaned.length;
        SupabaseSync.setAll(table, cleaned);
      }
    });

    const now = new Date().toLocaleTimeString();
    document.getElementById('heal-total').textContent = checks;
    document.getElementById('heal-fixed').textContent = fixes;
    document.getElementById('heal-last').textContent = now;
    document.getElementById('heal-lastfix').textContent = fixes > 0 ? now : '—';
    if (logEl) logEl.innerHTML = `✅ Checked ${checks} records. Fixed ${fixes} issues. (${now})`;

    Utils.toast(`Auto-Heal: ${checks} checked, ${fixes} fixed`, 'success');
    logActivity('edit', 'system', `Auto-Heal: ${checks} checked, ${fixes} fixed`);
  }

  function runSyncCheck() {
    const output = document.getElementById('sync-check-output');
    if (!output) return;
    let issues = 0;
    let report = '';

    Object.values(DB).forEach(table => {
      const rows = SupabaseSync.getAll(table);
      const noId = rows.filter(r => !r.id).length;
      if (noId > 0) {
        issues += noId;
        report += `⚠️ ${table}: ${noId} records without ID<br>`;
      }
    });

    output.innerHTML = issues === 0 ?
      `<span style="color:var(--success)">✅ All data integrity checks passed!</span>` :
      `<span style="color:var(--error)">${report}</span>`;
    Utils.toast(issues === 0 ? 'All checks passed!' : `${issues} issues found`, issues === 0 ? 'success' : 'error');
  }

  function runAutoFix() {
    const statusEl = document.getElementById('autofix-status');
    let fixes = 0;

    Object.values(DB).forEach(table => {
      const rows = SupabaseSync.getAll(table);
      let changed = false;
      rows.forEach(r => {
        if (!r.id) { r.id = SupabaseSync.generateId(); changed = true; fixes++; }
        if (!r.created_at) { r.created_at = new Date().toISOString(); changed = true; fixes++; }
      });
      if (changed) SupabaseSync.setAll(table, rows);
    });

    if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">✅ Auto-fix complete. ${fixes} fields repaired.</span>`;
    Utils.toast(`Auto-fix: ${fixes} repairs`, 'success');
  }

  // ════════════════════════════════════════════════════════════════
  // LEGACY FUNCTIONS (Preserved)
  // ════════════════════════════════════════════════════════════════

  // ── Save All Changes ──────────────────────────────────────────
  function saveAllChanges() {
    saveAcademyInfo();
    Utils.toast('All settings saved ✅', 'success');
  }

  // ── Academy Info ──────────────────────────────────────────────
  async function saveAcademyInfo() {
    const cfg = getConfig();
    cfg.id = cfg.id || SupabaseSync.generateId();
    cfg.academy_name = document.getElementById('set-academy-name')?.value || cfg.academy_name;
    cfg.monthly_target = parseFloat(document.getElementById('set-monthly-target')?.value) || cfg.monthly_target;
    cfg.running_batch = document.getElementById('set-running-batch')?.value ?? cfg.running_batch;
    cfg.expense_start_date = document.getElementById('set-expense-start')?.value || cfg.expense_start_date;
    cfg.expense_end_date = new Date().toISOString().split('T')[0];
    saveConfig(cfg);
    logActivity('edit', 'settings', 'Updated academy info');
    Utils.toast('Academy info saved ✅', 'success');
  }

  // ── Password ──────────────────────────────────────────────────
  async function changePassword() {
    const cfg = getConfig();
    const oldPw = document.getElementById('set-old-pw')?.value;
    const newPw = document.getElementById('set-new-pw')?.value;
    const confirmPw = document.getElementById('set-confirm-pw')?.value;
    const current = cfg.admin_password || 'admin123';

    if (oldPw !== current) { Utils.toast('Current password incorrect!', 'error'); return; }
    if (!newPw || newPw.length < 4) { Utils.toast('New password must be at least 4 characters', 'error'); return; }
    if (newPw !== confirmPw) { Utils.toast('Passwords do not match!', 'error'); return; }

    cfg.admin_password = newPw;
    cfg.id = cfg.id || SupabaseSync.generateId();
    saveConfig(cfg);
    logActivity('edit', 'security', 'Password changed');
    Utils.toast('Password changed successfully ✅', 'success');
  }

  // ── Theme ─────────────────────────────────────────────────────
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wfa_theme', theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    Utils.toast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode activated`, 'info');
  }

  // ── View Table Data ───────────────────────────────────────────
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

  // ── Export All Data ───────────────────────────────────────────
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
    a.download = `wfa_backup_${typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity('add', 'backup', 'Exported all data');
    Utils.toast('All data exported ✅', 'success');
  }

  // ── Data Migration ────────────────────────────────────────────
  async function startMigration() {
    const oldUrl = document.getElementById('mig-url')?.value;
    const oldKey = document.getElementById('mig-key')?.value;
    const statusEl = document.getElementById('mig-status');

    if (!oldUrl || !oldKey) {
      Utils.toast('URL and Key are required', 'error');
      return;
    }

    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '🔄 Starting migration...'; }

    try {
      const oldClient = supabase.createClient(oldUrl, oldKey);
      let imported = 0;
      let errors = 0;

      for (const [key, tableName] of Object.entries(DB)) {
        if (statusEl) statusEl.innerHTML = `🔄 Fetching data from ${tableName}...`;

        try {
          const { data, error } = await oldClient
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });

          if (error) { errors++; continue; }
          if (data && data.length > 0) {
            const existingRows = SupabaseSync.getAll(tableName);
            const existingIds = new Set(existingRows.map(r => r.id));
            const newRows = data.filter(r => !existingIds.has(r.id));
            if (newRows.length > 0) {
              SupabaseSync.setAll(tableName, [...newRows, ...existingRows]);
              imported += newRows.length;
              const { client } = window.SUPABASE_CONFIG;
              for (let i = 0; i < newRows.length; i += 50) {
                const batch = newRows.slice(i, i + 50);
                await client.from(tableName).upsert(batch, { onConflict: 'id' });
              }
            }
            if (statusEl) statusEl.innerHTML = `✅ ${tableName}: ${data.length} records (${newRows.length} New)`;
          }
        } catch (e) { errors++; }
      }

      if (statusEl) statusEl.innerHTML = `✅ Migration complete! ${imported} new records imported. ${errors > 0 ? `⚠️ ${errors} tables skipped.` : ''}`;
      Utils.toast(`Migration complete! ${imported} records imported`, 'success');
      logActivity('add', 'migration', `Imported ${imported} records`);
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `❌ Migration Failed: ${e.message}`;
      Utils.toast('Migration failed', 'error');
    }
  }

  // ── Import from JSON file ─────────────────────────────────────
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

        const isLegacy = data.hasOwnProperty('employees') ||
                         data.hasOwnProperty('cashBalance') ||
                         data.hasOwnProperty('incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          Utils.toast('Legacy backup detected — converting...', 'info');
          imported = await importLegacyData(data, statusEl);
        } else {
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

        if (imported > 0) {
          if (statusEl) statusEl.innerHTML += '<br>🔄 Pushing to cloud...';
          await SyncEngine.push();
          if (statusEl) statusEl.innerHTML += '<br>✅ Cloud sync complete!';
        }

        logActivity('add', 'import', `Imported ${imported} records from JSON`);
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
        refreshModal();
      } catch (e) {
        Utils.toast('Failed to read JSON: ' + e.message, 'error');
      }
    };
    input.click();
  }

  // ── Legacy Data Transformer ───────────────────────────────────
  async function importLegacyData(data, statusEl) {
    let total = 0;

    if (data.students && data.students.length) {
      const log = (m) => { if (statusEl) statusEl.innerHTML = m; };
      log('🔄 Importing students...');
      const mapped = data.students.map(s => ({
        id: SupabaseSync.generateId(),
        student_id: s.studentId || s.student_id || '',
        name: s.name || '', phone: s.phone || '', course: s.course || '',
        batch: s.batch || '', session: s.session || '',
        total_fee: s.totalPayment || s.total_fee || 0,
        paid: s.paid || 0, due: s.due || (s.totalPayment || 0) - (s.paid || 0),
        method: s.method || 'Cash',
        admission_date: s.enrollDate || s.admission_date || '',
        father_name: s.fatherName || s.father_name || '',
        mother_name: s.motherName || s.mother_name || '',
        blood_group: s.bloodGroup || s.blood_group || '',
        photo: s.photo || '', remarks: s.remarks || '', status: s.status || 'Active',
        created_at: s.createdAt || s.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.students);
      const existingSids = new Set(existing.map(r => r.student_id));
      const newRows = mapped.filter(r => !existingSids.has(r.student_id));
      if (newRows.length) { SupabaseSync.setAll(DB.students, [...newRows, ...existing]); total += newRows.length; }
    }

    if (data.employees && data.employees.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing staff...';
      const mapped = data.employees.map(emp => ({
        id: emp.id || SupabaseSync.generateId(),
        staffId: emp.id || emp.staffId || '', name: emp.name || '', role: emp.role || 'Staff',
        phone: emp.phone || '', email: emp.email || '', salary: emp.salary || 0,
        status: emp.status || 'Active', joiningDate: emp.joiningDate || '', resignDate: emp.resignDate || '',
        created_at: emp.lastUpdated || emp.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.staff);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) { SupabaseSync.setAll(DB.staff, [...newRows, ...existing]); total += newRows.length; }
    }

    if (data.finance && data.finance.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing finance...';
      const mapped = data.finance.map(f => ({
        id: String(f.id || SupabaseSync.generateId()),
        type: f.type || 'Expense', method: f.method || 'Cash', category: f.category || '',
        description: f.description || '', amount: f.amount || 0, date: f.date || '',
        note: f.note || f.person || '',
        created_at: f.createdAt || f.timestamp || new Date().toISOString(),
        updated_at: f.updatedAt || new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.finance);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) { SupabaseSync.setAll(DB.finance, [...newRows, ...existing]); total += newRows.length; }
    }

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

    if (data.visitors && data.visitors.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing visitors...';
      const mapped = data.visitors.map(v => ({
        id: v.id || SupabaseSync.generateId(), name: v.name || '', phone: v.phone || '',
        course: v.interestedCourse || v.course || '', remarks: v.remarks || '',
        date: v.date || v.visitDate || '',
        created_at: v.createdAt || new Date().toISOString(), updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.visitors);
      SupabaseSync.setAll(DB.visitors, [...mapped, ...existing]);
      total += mapped.length;
    }

    if (data.notices && data.notices.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing notices...';
      const existing = SupabaseSync.getAll(DB.notices);
      SupabaseSync.setAll(DB.notices, [...data.notices, ...existing]);
      total += data.notices.length;
    }

    if (data.settings) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing settings...';
      const cfg = Array.isArray(data.settings) ? data.settings[0] : data.settings;
      if (cfg) {
        const existing = SupabaseSync.getAll(DB.settings);
        if (!existing.length) {
          SupabaseSync.insert(DB.settings, {
            academy_name: cfg.academyName || cfg.academy_name || 'Wings Fly Aviation Academy',
            address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
            admin_password: cfg.password || cfg.admin_password || 'admin123',
          });
          total += 1;
        }
      }
    }

    if (data.examRegistrations && data.examRegistrations.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing exams...';
      const mapped = data.examRegistrations.map(e => ({
        id: e.id || SupabaseSync.generateId(),
        reg_id: e.regId || e.reg_id || '', student_id: e.studentId || e.student_id || '',
        student_name: e.studentName || e.student_name || '', batch: e.batch || '',
        subject: e.subject || '', exam_date: e.examDate || e.exam_date || '',
        exam_fee: e.examFee || e.exam_fee || 0, grade: e.grade || '',
        marks: e.marks || null, status: e.status || 'Registered',
        created_at: e.createdAt || new Date().toISOString(), updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.exams);
      SupabaseSync.setAll(DB.exams, [...mapped, ...existing]);
      total += mapped.length;
    }

    return total;
  }

  // ── Clear Local Data ──────────────────────────────────────────
  async function clearLocalData() {
    const ok = await Utils.confirm('Delete all local data? Cloud data will remain. Settings will be kept.', 'Reset Data');
    if (!ok) return;
    SyncEngine.stopRealtime();
    Object.entries(DB).forEach(([key, t]) => {
      if (key !== 'settings') localStorage.removeItem(`wfa_${t}`);
    });
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_retry_queue');
    logActivity('delete', 'system', 'Local data reset (kept settings)');
    Utils.toast('Local data deleted. Page reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  }

  // ── Factory Reset ─────────────────────────────────────────────
  async function factoryReset() {
    const ok = await Utils.confirm('⚠️ FACTORY RESET will delete ALL data including settings! This cannot be undone!', '☢️ Factory Reset');
    if (!ok) return;
    const ok2 = await Utils.confirm('Are you ABSOLUTELY sure? ALL data will be permanently lost!', 'Final Confirmation');
    if (!ok2) return;

    // Delete cloud data
    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch {}
      }
    } catch {}

    // Delete all local data
    Object.values(DB).forEach(t => localStorage.removeItem(`wfa_${t}`));
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_activity_log');
    localStorage.removeItem('wfa_keep_records');
    localStorage.removeItem('wfa_advance_payments');
    localStorage.removeItem('wfa_investments');
    localStorage.removeItem('wfa_recent_changes');
    localStorage.removeItem('wfa_retry_queue');

    Utils.toast('Factory reset complete. Page reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  }

  // ── Clear Cloud Data ──────────────────────────────────────────
  async function clearCloudData() {
    const ok = await Utils.confirm('⚠️ All cloud data will be permanently deleted!', '☁️ Delete Cloud Data');
    if (!ok) return;
    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch {}
      }
      Utils.toast('Cloud data deleted', 'info');
    } catch (e) {
      Utils.toast('Failed: ' + e.message, 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════
  return {
    render, openModal, closeModal, switchTab,
    saveAllChanges, saveAcademyInfo, changePassword, setTheme,
    viewTableData, exportAllData,
    startMigration, importFromJSON,
    clearLocalData, clearCloudData, factoryReset,
    addCategory, removeCategory,
    clearActivityLog, logActivity,
    restoreItem, permanentDelete, emptyRecycleBin,
    addNote, saveNote, deleteNote,
    renderBatchReport,
    showAccountsSubTab,
    addAdvancePayment, saveAdvancePayment, deleteAdvance,
    addInvestment, saveInvestment, deleteInvestment,
    runAutoHeal, runSyncCheck, runAutoFix,
    refreshMonitor: () => { refreshModal(); Utils.toast('Refreshed', 'info'); },
  };
})();

window.SettingsModule = SettingsModule;
