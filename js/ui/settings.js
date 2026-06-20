// ============================================================
// Wings Fly Aviation Academy â€” Settings Module (Full Parity)
// 11 Tabs matching legacy app design
// ============================================================

const SettingsModule = (() => {

  let activeTab = 'general';
  let isOpen = false;
  let _syncListener = null; // wfa:synced listener reference â€” closeModal-à¦ remove à¦•à¦°à¦¾à¦° à¦œà¦¨à§à¦¯
  let _suppressSyncRebuild = false; // âœ… FIX: keep record save à¦•à¦°à¦¾à¦° à¦ªà¦°à§‡à¦‡ wfa:synced fire à¦¹à¦¯à¦¼, à¦¤à¦–à¦¨ modal rebuild à¦°à§‹à¦–à¦¾à¦° à¦œà¦¨à§à¦¯
  let _syncRefreshTimer = null;    // âœ… FIX: debounced partial refresh â€” full modal rebuild UI hang à¦•à¦°à¦¤

  // CSP-à¦¸à§‡à¦‡à¦«: index.html script-src-attr à¦›à¦¾à¦¡à¦¼à¦¾ inline onclick à¦¬à§à¦²à¦• à¦¹à¦¯à¦¼ â€” delegation à¦¦à¦¿à¦¯à¦¼à§‡ tab/close à¦šà¦¾à¦²à§
  function _onSettingsOverlayClick(e) {
    const closeBtn = e.target.closest('.settings-close-btn');
    if (closeBtn) { e.preventDefault(); closeModal(); return; }
    const hamBtn = e.target.closest('.settings-hamburger-btn');
    if (hamBtn) { e.preventDefault(); toggleSettingsSidebar(); return; }
    const tabBtn = e.target.closest('.settings-tab[data-tab]');
    if (tabBtn) { e.preventDefault(); switchTab(tabBtn.dataset.tab); return; }
    const saveAllBtn = e.target.closest('.settings-save-all');
    if (saveAllBtn) { e.preventDefault(); saveAllChanges(); return; }
  }

  function _bindSettingsOverlayEvents(overlay) {
    if (!overlay || overlay.dataset.eventsBound === '1') return;
    overlay.dataset.eventsBound = '1';
    overlay.addEventListener('click', _onSettingsOverlayClick);
  }

  // â”€â”€â”€ MODAL OPEN / CLOSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    _bindSettingsOverlayEvents(overlay);
    _persistHealedConfigDates();

    setTimeout(() => {
      if (typeof Utils !== 'undefined' && Utils.sanitizeDateInputElement) {
        overlay.querySelectorAll('input[type="date"], #bp-start, #bp-end').forEach(Utils.sanitizeDateInputElement);
      }
      _initSettingsDatePickers();
    }, 10);
    
    document.body.style.overflow = 'hidden';
    // â”€â”€ Real-time Activity Log refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Settings panel à¦–à§‹à¦²à¦¾ à¦¥à¦¾à¦•à¦²à§‡ à¦¯à§‡à¦•à§‹à¦¨à§‹ à¦•à¦¾à¦œ à¦•à¦°à¦²à§‡ activity log à¦“
    // à¦…à¦¨à§à¦¯à¦¾à¦¨à§à¦¯ tabs real-time-à¦ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¬à§‡
    if (_syncListener) {
      window.removeEventListener('wfa:synced', _syncListener);
    }
    _syncListener = () => {
      const panel = document.getElementById('settings-overlay');
      if (!panel) return;

      // keeprecord: à¦¨à§‹à¦Ÿ save/delete-à¦ _refreshKeepRecordGrid() à¦¸à¦°à¦¾à¦¸à¦°à¦¿ call à¦¹à¦¯à¦¼
      if (activeTab === 'keeprecord') return;
      if (_suppressSyncRebuild) return;

      // âœ… FIX: à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ realtime event-à¦ à¦ªà§à¦°à§‹ modal rebuild â†’ main thread block â†’ tab/close à¦•à¦¾à¦œ à¦•à¦°à§‡ à¦¨à¦¾
      clearTimeout(_syncRefreshTimer);
      _syncRefreshTimer = setTimeout(_refreshSettingsOnSync, 600);
    };
    window.addEventListener('wfa:synced', _syncListener);
  }


  function closeModal() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    clearTimeout(_syncRefreshTimer);
    overlay.classList.add('closing');
    // sync listener à¦¸à¦°à¦¿à¦¯à¦¼à§‡ à¦¦à¦¾à¦“ â€” modal à¦¬à¦¨à§à¦§ à¦¹à¦²à§‡ à¦†à¦° à¦¦à¦°à¦•à¦¾à¦° à¦¨à§‡à¦‡
    if (_syncListener) {
      window.removeEventListener('wfa:synced', _syncListener);
      _syncListener = null;
    }
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      isOpen = false;
    }, 200);
  }

  // â”€â”€â”€ RENDER (inline fallback for section) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function render() {
    openModal();
  }

  // â”€â”€â”€ BUILD MODAL HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function buildModalHTML() {
    return `
      <div class="settings-modal">
        <div class="settings-modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="settings-hamburger-btn">
              <i class="fa fa-bars"></i>
            </button>
            <h2><i class="fa fa-gear"></i> System Settings</h2>
          </div>
          <button type="button" class="settings-close-btn" aria-label="Close settings">âœ•</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-sidebar" id="settings-sidebar-drawer">
            ${buildSidebarTabs()}
            <button type="button" class="settings-save-all">
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

  function toggleSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar-drawer');
    if (sidebar) sidebar.classList.toggle('mobile-open');
  }

  // â”€â”€â”€ SIDEBAR TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function buildSidebarTabs() {
    const tabs = [
      { id: 'general',        icon: 'fa-sliders',             label: 'General Settings' },
      { id: 'theme',          icon: 'fa-palette',             label: 'ðŸŽ¨ Theme / Appearance' },
      { id: 'categories',     icon: 'fa-tags',                label: 'Categories & Courses' },
      { id: 'data',           icon: 'fa-database',            label: 'Data Management' },
      { id: 'security',       icon: 'fa-lock',                label: 'Security & Access' },
      { id: 'client-manager', icon: 'fa-id-card',             label: 'ðŸ§‘â€ðŸ’¼ Client Manager' },
      { id: 'activity',       icon: 'fa-list-check',          label: 'Activity Log' },
      { id: 'recycle',        icon: 'fa-trash-can',           label: 'Recycle Bin' },
      { id: 'sync',           icon: 'fa-magnifying-glass',    label: 'Sync Diagnostic' },
      { id: 'keeprecord',     icon: 'fa-flag',                label: 'Keep Record' },
      { id: 'batchprofit',    icon: 'fa-chart-column',        label: 'Batch Profit Report' },
      { id: 'accounts-mgmt',  icon: 'fa-briefcase',           label: 'Accounts Management' },
      { id: 'monitor',        icon: 'fa-chart-line',          label: 'Monitor' },
      { id: 'syncguard',      icon: 'fa-shield-halved',       label: 'Sync Guard' },
      { id: 'ai-assistant',   icon: 'fa-robot',               label: 'AI Assistant' },
    ];
    return tabs.map(t => `
      <button type="button" class="settings-tab ${activeTab === t.id ? 'active' : ''}"
              data-tab="${t.id}">
        <i class="fa ${t.icon}"></i> ${t.label}
      </button>
    `).join('');
  }

  // â”€â”€â”€ ALL PANELS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function buildAllPanels() {
    return `
      ${panelGeneral()}
      ${panelTheme()}
      ${panelCategories()}
      ${panelData()}
      ${panelSecurity()}
      ${panelClientManager()}
      ${panelActivity()}
      ${panelRecycle()}
      ${panelSync()}
      ${panelKeepRecord()}
      ${panelBatchProfit()}
      ${panelAccountsMgmt()}
      ${panelMonitor()}
      ${panelSyncGuard()}
      ${panelAIAssistant()}
    `;
  }

  // â”€â”€â”€ TAB SWITCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function switchTab(tab) {
    activeTab = tab;
    const overlay = document.getElementById('settings-overlay');
    const scope = overlay || document;
    // Update sidebar (scope to settings modal â€” à¦…à¦¨à§à¦¯ .settings-tab à¦¥à¦¾à¦•à¦²à§‡ clash à¦à¦¡à¦¼à¦¾à¦¯à¦¼)
    scope.querySelectorAll('.settings-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Update panels
    scope.querySelectorAll('.settings-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
    // Auto-close sidebar on mobile after tab switch
    const sidebar = document.getElementById('settings-sidebar-drawer');
    if (sidebar) sidebar.classList.remove('mobile-open');
    // Auto-render SyncGuard panel when tab is activated
    if (tab === 'syncguard' && typeof SyncGuard !== 'undefined') {
      setTimeout(() => SyncGuard.renderPanel('syncguard-panel'), 50);
    }
    if (tab === 'categories') _silentAutoDetect();
    if (tab === 'activity' && typeof SupabaseSync !== 'undefined' && SupabaseSync.pullActivityLog) {
      SupabaseSync.pullActivityLog()
        .then(() => refreshActivityPanel())
        .catch(() => refreshActivityPanel());
    }
    // âœ… Req 4: re-init date pickers whenever a tab is switched
    setTimeout(_initSettingsDatePickers, 20);
  }

  // âœ… FIX: sync-à¦ à¦¶à§à¦§à§ active tab-à¦à¦° à¦¡à§‡à¦Ÿà¦¾ à¦†à¦ªà¦¡à§‡à¦Ÿ â€” à¦ªà§à¦°à§‹ modal rebuild à¦¨à¦¯à¦¼
  function _refreshSettingsOnSync() {
    if (!document.getElementById('settings-overlay')) return;
    switch (activeTab) {
      case 'activity':
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.pullActivityLog) {
          SupabaseSync.pullActivityLog()
            .then(() => refreshActivityPanel())
            .catch(() => refreshActivityPanel());
        } else {
          refreshActivityPanel();
        }
        break;
      case 'recycle':
      case 'monitor':
      case 'sync':
      case 'syncguard':
        refreshModal();
        break;
      default:
        break;
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB: THEME / APPEARANCE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const THEMES = [
    {
      id: 'neon-space',
      name: 'Default Theme (Neon)',
      desc: 'Deep navy + Cyan + Purple â€” Default app cyberpunk theme',
      emoji: 'ðŸš€',
      colors: ['#0a0e27', '#00d9ff', '#b537f2', '#00ff88'],
      bg: 'linear-gradient(135deg, #0a0e27 0%, #0f0a28 100%)',
    },
    {
      id: 'aurora',
      name: 'Deep Ocean Aurora',
      desc: 'Deep navy + flowing aurora teal & electric blue',
      emoji: 'ðŸŒŠ',
      colors: ['#050d1e', '#00e5ff', '#00b4d8', '#48cae4'],
      bg: 'linear-gradient(135deg, #050d1e 0%, #0a192f 50%, #072a4a 100%)',
    },
    {
      id: 'nebula',
      name: 'Nebula Purple Haze',
      desc: 'Dark cosmic black + swirling galaxy purple & magenta',
      emoji: 'ðŸŒŒ',
      colors: ['#0d0010', '#c77dff', '#e040fb', '#7b2d8b'],
      bg: 'linear-gradient(135deg, #0d0010 0%, #1a0030 50%, #0d0020 100%)',
    },
    {
      id: 'neon-grid',
      name: 'Neon City Grid',
      desc: 'Midnight black + electric green + hot pink cyberpunk',
      emoji: 'âš¡',
      colors: ['#080808', '#39ff14', '#ff006e', '#00f5d4'],
      bg: 'linear-gradient(135deg, #080808 0%, #0d1117 100%)',
    },
    {
      id: 'molten',
      name: 'Molten Gold & Obsidian',
      desc: 'Volcanic black + glowing gold veins â€” Luxury premium',
      emoji: 'ðŸ”¥',
      colors: ['#0a0800', '#ffd700', '#ff6b00', '#ff9900'],
      bg: 'linear-gradient(135deg, #0a0800 0%, #1a1000 50%, #0d0900 100%)',
    },
    {
      id: 'emerald',
      name: 'Quantum Emerald',
      desc: 'Forest black + bioluminescent emerald circuit glow',
      emoji: 'ðŸ’š',
      colors: ['#030d06', '#00ff88', '#00e676', '#69f0ae'],
      bg: 'linear-gradient(135deg, #030d06 0%, #071a0a 50%, #030d06 100%)',
    },
    {
      id: 'aurora-wave',
      name: 'Aurora Wave',
      desc: 'Northern lights â€” animated color waves on dark starry sky',
      emoji: 'ðŸŒŒ',
      colors: ['#050510', '#00f0ff', '#0077b6', '#00e5cc'],
      bg: 'linear-gradient(135deg, #050510 0%, #07091a 50%, #0a1030 100%)',
    },
  ];

  const SIDEBAR_STYLES = [
    {
      id: 'glass',
      name: 'Frosted Glass',
      icon: 'ðŸ§Š',
      desc: 'Master style â€” Semi-transparent blur, background glows through',
      preview: 'background:rgba(10,14,39,0.42);border-right:1px solid rgba(255,255,255,0.13)',
      master: true,
    },
    {
      id: 'aurora-glow',
      name: 'Aurora Wave Match',
      icon: 'ðŸŒŒ',
      desc: 'Matches exactly the cyan Dashboard theme background gradient',
      preview: 'background:linear-gradient(135deg, #050510, #0077b6); border-right:1px solid #00f0ff',
    },
    {
      id: 'crystal',
      name: 'Ultra Crystal (Aurora)',
      icon: 'âœ¨',
      desc: 'Maximum transparency â€” Best for Aurora & Background images',
      preview: 'background:rgba(0,0,10,0.15); border-right:1px solid rgba(255,255,255,0.1)',
    },
    {
      id: 'tinted',
      name: 'Tinted Glow',
      icon: 'ðŸŒŠ',
      desc: 'Theme-color tinted glass â€” subtle accent wash',
      preview: 'background:rgba(0,25,50,0.6);border-right:1px solid rgba(0,217,255,0.3)',
    },
    {
      id: 'carbon',
      name: 'Carbon Dark',
      icon: 'â¬›',
      desc: 'Pure matte black â€” maximum contrast, ultra bold',
      preview: 'background:#050507;border-right:1px solid rgba(255,255,255,0.06)',
    },
    {
      id: 'neonstrip',
      name: 'Neon Strip',
      icon: 'ðŸ“Œ',
      desc: 'Dark glass + glowing top neon strip accent',
      preview: 'background:rgba(8,10,25,0.88);border-top:2px solid rgba(0,217,255,0.8)',
    },
    {
      id: 'velvet',
      name: 'Velvet Deep',
      icon: 'ðŸŸ£',
      desc: 'Rich deep purple-navy matte â€” premium luxury feel',
      preview: 'background:linear-gradient(180deg,rgba(14,8,35,0.98) 0%,rgba(8,5,22,0.98) 100%)',
    },
  ];

  function panelTheme() {
    const currentTheme   = localStorage.getItem('wfa_theme') || 'neon-space';
    const currentSidebar = localStorage.getItem(`wfa_sidebar_${currentTheme}`) || 'glass';

    return `
    <div class="settings-panel ${activeTab === 'theme' ? 'active' : ''}" data-panel="theme">

      <!-- â”€â”€ Background Theme â”€â”€ -->
      <div class="settings-card-title" style="color:var(--brand-primary);font-size:1.05rem;margin-bottom:6px">
        <i class="fa fa-image"></i> BACKGROUND THEME
      </div>
      <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
        Click à¦•à¦°à§à¦¨ â€” à¦¸à¦¾à¦¥à§‡ à¦¸à¦¾à¦¥à§‡ apply à¦¹à¦¬à§‡à¥¤ à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ à¦¥à¦¿à¦®à§‡ à¦†à¦²à¦¾à¦¦à¦¾ à¦¸à¦¾à¦‡à¦¡à¦¬à¦¾à¦° à¦¸à§‡à¦Ÿà¦¿à¦‚ à¦¸à§‡à¦­ à¦¥à¦¾à¦•à¦¬à§‡à¥¤
      </p>

      <div class="theme-grid" style="margin-bottom:30px">
        ${_getAllThemes().map(t => `
          <div class="theme-card ${currentTheme === t.id ? 'theme-active' : ''}"
               onclick="SettingsModule.applyTheme('${t.id}')" title="${t.name}">
            <div class="theme-preview" style="background:${t.bg}">
              <div class="theme-preview-swatch">
                ${t.colors.map(c => `<span style="background:${c}"></span>`).join('')}
              </div>
              <div class="theme-preview-bars">
                <div style="width:60%;height:5px;border-radius:3px;background:${t.colors[1]};margin-bottom:4px;box-shadow:0 0 8px ${t.colors[1]}80"></div>
                <div style="width:40%;height:3px;border-radius:3px;background:${t.colors[2]};margin-bottom:4px;opacity:.8"></div>
                <div style="width:75%;height:3px;border-radius:3px;background:rgba(255,255,255,0.15)"></div>
              </div>
              ${currentTheme === t.id ? `<div class="theme-active-badge"><i class="fa fa-check"></i> Active</div>` : ''}
              ${t.isCustom ? `<div style="position:absolute;bottom:8px;right:8px;display:flex;gap:4px" onclick="event.stopPropagation()"><button class="btn btn-xs" style="background:rgba(0,180,255,0.85);border:none;border-radius:4px;padding:3px 7px" onclick="SettingsModule.openThemeBuilderModal('${t.id}')" title="Edit Theme"><i class="fa fa-pen"></i></button><button class="btn btn-xs" style="background:rgba(255,71,87,0.85);border:none;border-radius:4px;padding:3px 7px" onclick="SettingsModule.deleteCustomTheme('${t.id}')" title="Delete Theme"><i class="fa fa-trash-can"></i></button></div>` : ''}
            </div>
            <div class="theme-info">
              <div class="theme-name">${t.emoji} ${t.name}</div>
              <div class="theme-desc">${t.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- â”€â”€ Sidebar / Menu Bar Style â”€â”€ -->
      <div class="settings-card-title" style="color:var(--brand-accent);font-size:1.05rem;margin-bottom:6px">
        <i class="fa fa-sidebar"></i> SIDEBAR / MENU BAR STYLE
      </div>
      <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
        à¦à¦‡ à¦¥à¦¿à¦®à§‡à¦° à¦œà¦¨à§à¦¯ à¦¸à¦¾à¦‡à¦¡à¦¬à¦¾à¦° à¦¡à¦¿à¦œà¦¾à¦‡à¦¨ à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨à¥¤ à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ à¦¥à¦¿à¦®à§‡ à¦†à¦²à¦¾à¦¦à¦¾ à¦¸à§‡à¦Ÿà¦¿à¦‚ à¦¸à§‡à¦­ à¦¹à¦¬à§‡à¥¤
        <span style="color:var(--brand-primary);font-weight:600">
          (à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¥à¦¿à¦®: <i class="fa fa-circle" style="font-size:.6rem"></i> ${_getAllThemes().find(t=>t.id===currentTheme)?.emoji} ${_getAllThemes().find(t=>t.id===currentTheme)?.name})
        </span>
      </p>

      <div class="sidebar-style-grid">
        ${SIDEBAR_STYLES.map(s => `
          <div class="sidebar-style-card ${currentSidebar === s.id ? 'sidebar-style-active' : ''}"
               onclick="SettingsModule.applySidebarStyle('${s.id}')">
            <div class="sidebar-style-preview" style="${s.preview}">
              <div style="padding:8px 10px;border-left:3px solid ${currentSidebar===s.id ? 'var(--brand-primary)' : 'transparent'};background:${currentSidebar===s.id ? 'rgba(0,217,255,0.15)' : 'transparent'};border-radius:6px;margin:2px 6px;font-size:.6rem;color:${currentSidebar===s.id ? 'var(--brand-neon)' : 'rgba(255,255,255,0.7)'};display:flex;align-items:center;gap:5px">
                <span style="width:6px;height:6px;border-radius:50%;background:${currentSidebar===s.id ? 'var(--brand-primary)' : 'rgba(255,255,255,0.4)'}"></span> Dashboard
              </div>
              <div style="padding:5px 10px;margin:2px 6px;font-size:.55rem;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:5px">
                <span style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.3)"></span> Students
              </div>
              <div style="padding:5px 10px;margin:2px 6px;font-size:.55rem;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:5px">
                <span style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.3)"></span> Finance
              </div>
              <div style="padding:5px 10px;margin:2px 6px;font-size:.55rem;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:5px">
                <span style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.3)"></span> Settings
              </div>
              ${currentSidebar === s.id ? `<div style="position:absolute;top:6px;right:6px;background:var(--brand-primary);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:.55rem">âœ“</div>` : ''}
            </div>
            <div class="sidebar-style-info">
              <div class="sidebar-style-name">${s.icon} ${s.name} ${s.master ? '<span style="font-size:.6rem;background:rgba(0,217,255,0.2);color:#00d9ff;padding:1px 6px;border-radius:10px;margin-left:4px">MASTER</span>' : ''}</div>
              <div class="sidebar-style-desc">${s.desc}</div>
              <button class="customize-btn" onclick="event.stopPropagation();SettingsModule.openColorCustomizer('${s.id}')"
                style="margin-top:6px;padding:3px 10px;font-size:.68rem;border:1px solid rgba(0,217,255,0.3);background:rgba(0,217,255,0.08);color:#00d9ff;border-radius:6px;cursor:pointer;transition:.2s">
                âš™ï¸ Customize Colors
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- â”€â”€ Color Customizer Panel â”€â”€ -->
      <div id="color-customizer-panel" style="display:none;margin-top:24px">
        ${buildColorCustomizerHTML(currentTheme, currentSidebar)}
      </div>

      <!-- â”€â”€ Dashboard Card Colors â”€â”€ -->
      <div style="margin-top:28px">
        <div class="settings-card-title" style="color:var(--brand-gold);font-size:1.05rem;margin-bottom:6px">
          <i class="fa fa-layer-group"></i> DASHBOARD CARD & ANALYTICS COLORS
        </div>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
          Dashboard cards à¦à¦¬à¦‚ Analytics section à¦à¦° background color customize à¦•à¦°à§à¦¨à¥¤
          <span style="color:var(--brand-primary);font-weight:600">à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ à¦¥à¦¿à¦®à§‡ à¦†à¦²à¦¾à¦¦à¦¾ à¦¸à§‡à¦­ à¦¹à¦¬à§‡à¥¤</span>
        </p>
        ${buildCardColorsHTML(currentTheme)}
      </div>

      <!-- â”€â”€ Custom Theme Builder â”€â”€ -->
      <div style="margin-top:28px;padding-top:28px;border-top:1px solid rgba(255,255,255,0.08)">
        <div class="settings-card-title" style="color:var(--brand-primary);font-size:1.05rem;margin-bottom:6px">
          <i class="fa fa-paint-roller"></i> CUSTOM THEME BUILDER
        </div>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
          à¦¨à¦¿à¦œà§‡à¦° à¦ªà¦›à¦¨à§à¦¦à¦®à¦¤à§‹ à¦•à¦¾à¦²à¦¾à¦° à¦¦à¦¿à§Ÿà§‡ à¦¥à¦¿à¦® à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨à¥¤ à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š à§«à¦Ÿà¦¿ à¦¥à¦¿à¦® à¦¸à§‡à¦­ à¦°à¦¾à¦–à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤
        </p>
        <button class="settings-save-btn" onclick="SettingsModule.openThemeBuilderModal()" style="background:linear-gradient(135deg, rgba(0,217,255,0.8), rgba(181,55,242,0.8));color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;">
          <i class="fa fa-plus"></i> CREATE CUSTOM THEME
        </button>
      </div>

    </div>`;
  }


  function buildColorCustomizerHTML(themeId, styleId) {
    const key = `wfa_sidebar_custom_${themeId}_${styleId}`;
    const saved = Utils.safeJSON(localStorage.getItem(key), {});
    return `
      <div style="background:rgba(0,217,255,0.05);border:1px solid rgba(0,217,255,0.15);border-radius:12px;padding:16px" id="color-customizer-inner">
        <div style="font-size:.9rem;font-weight:700;color:var(--brand-primary);margin-bottom:12px">
          âš™ï¸ Sidebar Custom Colors â€” <span style="color:rgba(255,255,255,0.5);font-weight:400;font-size:.8rem">changes apply live</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">BG Opacity</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="range" id="cust-opacity" min="5" max="98" value="${saved.opacity||48}"
                oninput="SettingsModule.liveCustomSidebar()"
                style="flex:1;accent-color:var(--brand-primary)">
              <span id="cust-opacity-val" style="font-size:.75rem;color:#fff;min-width:30px">${saved.opacity||48}%</span>
            </div>
          </div>
          <div>
            <label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">Border Color</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="color" id="cust-border" value="${saved.border||'#00d9ff'}"
                oninput="SettingsModule.liveCustomSidebar()"
                style="width:36px;height:28px;border-radius:6px;border:none;cursor:pointer;padding:2px">
              <span style="font-size:.75rem;color:var(--text-muted)">Border glow</span>
            </div>
          </div>
          <div>
            <label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">Active Item Color</label>
            <input type="color" id="cust-active" value="${saved.active||'#00d9ff'}"
              oninput="SettingsModule.liveCustomSidebar()"
              style="width:36px;height:28px;border-radius:6px;border:none;cursor:pointer;padding:2px">
          </div>
          <div>
            <label style="font-size:.75rem;color:var(--text-muted);display:block;margin-bottom:4px">Blur Amount</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="range" id="cust-blur" min="0" max="40" value="${saved.blur||28}"
                oninput="SettingsModule.liveCustomSidebar()"
                style="flex:1;accent-color:var(--brand-primary)">
              <span id="cust-blur-val" style="font-size:.75rem;color:#fff;min-width:30px">${saved.blur||28}px</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button onclick="SettingsModule.saveCustomSidebarColors()" class="btn btn-primary btn-sm">ðŸ’¾ Save Colors</button>
          <button onclick="SettingsModule.resetCustomSidebarColors()" class="btn btn-outline btn-sm" style="color:var(--error);border-color:var(--error)">â†º Reset</button>
        </div>
      </div>`;
  }

  const CARD_PRESETS = [
    { id: 'navy',   name: 'ðŸŒ‘ Deep Navy',  cardBg: 'rgba(8,12,40,0.88)', border: 'rgba(0,217,255,0.15)', inner: 'rgba(6,9,28,0.96)', anaBg: 'rgba(5,8,26,0.92)' },
    { id: 'obsidian',name: 'ðŸŒŒ Obsidian',   cardBg: 'rgba(8,10,14,0.92)', border: 'rgba(0,243,255,0.15)', inner: 'rgba(5,6,8,0.96)', anaBg: 'rgba(6,8,10,0.95)' },
    { id: 'maroon', name: 'ðŸ”¥ Cyber Maroon',cardBg: 'rgba(24,5,10,0.88)', border: 'rgba(255,0,85,0.2)', inner: 'rgba(16,4,8,0.96)', anaBg: 'rgba(18,4,8,0.92)' },
    { id: 'purple', name: 'ðŸ’œ Royal Void', cardBg: 'rgba(16,8,32,0.90)', border: 'rgba(181,55,242,0.2)', inner: 'rgba(10,5,20,0.96)', anaBg: 'rgba(14,6,26,0.92)' },
    { id: 'emerald',name: 'ðŸŒ¿ Deep Jade',  cardBg: 'rgba(4,16,10,0.88)', border: 'rgba(0,255,136,0.15)', inner: 'rgba(2,10,6,0.96)', anaBg: 'rgba(3,12,8,0.92)' },
    { id: 'glass',  name: 'ðŸ§Š Aurora Glass', cardBg: 'rgba(5,10,25,0.30)', border: 'rgba(0,240,255,0.25)', inner: 'rgba(4,6,18,0.45)', anaBg: 'rgba(2,4,12,0.35)' }
  ];

  function buildCardColorsHTML(themeId) {
    const key = `wfa_card_theme_${themeId}`;
    const savedId = localStorage.getItem(key) || 'navy';
    
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:14px">
        ${CARD_PRESETS.map(p => `
          <div onclick="SettingsModule.applyCardPreset('${p.id}')"
               style="padding:10px; border-radius:8px; cursor:pointer; transition:.2s;
                      background:${p.cardBg}; border:2px solid ${savedId === p.id ? 'var(--brand-primary)' : p.border};
                      box-shadow:${savedId === p.id ? '0 0 12px var(--brand-primary)' : 'none'}">
             <div style="font-size:.75rem; color:#fff; font-weight:600; text-align:center">${p.name}</div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);text-align:center;margin-top:10px">
        ðŸ‘† à¦•à¦¾à¦°à§à¦¡à§‡à¦° à¦¬à§à¦¯à¦¾à¦•à¦—à§à¦°à¦¾à¦‰à¦¨à§à¦¡ à¦•à¦¾à¦²à¦¾à¦° à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦•à¦°à§à¦¨ (à¦à¦Ÿà¦¿ à¦¸à¦¾à¦¥à§‡ à¦¸à¦¾à¦¥à§‡ à¦¸à§‡à¦­ à¦¹à§Ÿà§‡ à¦¯à¦¾à¦¬à§‡)à¥¤
      </div>`;
  }


  function applyTheme(themeId) {
    const allThemes = _getAllThemes();
    const theme = allThemes.find(t => t.id === themeId);
    if (!theme) return;
    // Remove all theme classes
    allThemes.forEach(t => document.body.classList.remove(`theme-${t.id}`));
    document.body.classList.remove('theme-custom');
    
    if (theme.isCustom) {
      document.body.classList.add('theme-custom');
      _injectCustomThemeStyle(theme);
    } else {
      document.body.classList.add(`theme-${themeId}`);
      const s = document.getElementById('custom-theme-style');
      if (s) s.remove();
    }
    localStorage.setItem('wfa_theme', themeId);
    // Restore this theme's sidebar style (default = glass)
    const savedSidebar = localStorage.getItem(`wfa_sidebar_${themeId}`) || 'glass';
    _applySidebarClass(savedSidebar);
    // Refresh panel
    refreshModal();
    switchTab('theme');
    Utils.toast(`âœ¨ Theme: ${theme.name}`, 'success');
  }

  function applySidebarStyle(styleId) {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    localStorage.setItem(`wfa_sidebar_${themeId}`, styleId);
    _applySidebarClass(styleId);
    // Refresh only the sidebar style section
    refreshModal();
    switchTab('theme');
    const style = SIDEBAR_STYLES.find(s => s.id === styleId);
    Utils.toast(`ðŸŽ¨ Sidebar: ${style?.name || styleId}`, 'info');
  }

  function _applySidebarClass(styleId) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    // Remove all known sidebar style classes
    ['glass','crystal','aurora-glow','tinted','carbon','neonstrip','velvet'].forEach(s => sidebar.classList.remove(`sidebar-${s}`));
    // Always apply a class (glass is the master/default)
    sidebar.classList.add(`sidebar-${styleId}`);
    
    // Always update CSS overrides
    _applyColorOverrides();
  }

  // â”€â”€ Color Customizer Logic â”€â”€

  function openColorCustomizer(styleId) {
    const panel = document.getElementById('color-customizer-panel');
    if(panel) {
      if(panel.style.display === 'block') {
         panel.style.display = 'none';
      } else {
         panel.style.display = 'block';
         // Automatically select the sidebar style so we're editing the active one
         applySidebarStyle(styleId); 
      }
    }
  }

  function liveCustomSidebar() {
    const opacity = document.getElementById('cust-opacity').value;
    const border = document.getElementById('cust-border').value;
    const active = document.getElementById('cust-active').value;
    const blur = document.getElementById('cust-blur').value;

    document.getElementById('cust-opacity-val').textContent = opacity + '%';
    document.getElementById('cust-blur-val').textContent = blur + 'px';

    _injectCSSOverrides(opacity, border, active, blur);
  }

  function saveCustomSidebarColors() {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    const styleId = localStorage.getItem(`wfa_sidebar_${themeId}`) || 'glass';
    
    const settings = {
      opacity: document.getElementById('cust-opacity').value,
      border: document.getElementById('cust-border').value,
      active: document.getElementById('cust-active').value,
      blur: document.getElementById('cust-blur').value
    };
    
    localStorage.setItem(`wfa_sidebar_custom_${themeId}_${styleId}`, JSON.stringify(settings));
    Utils.toast('Sidebar colors saved!', 'success');
  }
  
  function resetCustomSidebarColors() {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    const styleId = localStorage.getItem(`wfa_sidebar_${themeId}`) || 'glass';
    localStorage.removeItem(`wfa_sidebar_custom_${themeId}_${styleId}`);
    refreshModal();
    switchTab('theme');
    _applyColorOverrides();
    Utils.toast('Sidebar colors reset', 'info');
  }

  function applyCardPreset(presetId) {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    localStorage.setItem(`wfa_card_theme_${themeId}`, presetId);
    _applyColorOverrides();
    refreshModal();
    switchTab('theme');
    const p = CARD_PRESETS.find(x => x.id === presetId);
    Utils.toast(`Cards set to ${p?.name}`, 'success');
  }

  // â”€â”€ Inject globally custom style block â”€â”€
  
  function _applyColorOverrides() {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    const styleId = localStorage.getItem(`wfa_sidebar_${themeId}`) || 'glass';
    const cardPresetId = localStorage.getItem(`wfa_card_theme_${themeId}`) || 'navy';
    
    // Default fallback
    _injectCSSOverrides();
    _injectCardOverrides(cardPresetId);

    // Re-apply if saved
    const sideSavedJSON = localStorage.getItem(`wfa_sidebar_custom_${themeId}_${styleId}`);
    if(sideSavedJSON) {
        const s = Utils.safeJSON(sideSavedJSON);
        _injectCSSOverrides(s.opacity, s.border, s.active, s.blur);
    }
  }

  function _injectCSSOverrides(opacity, border, active, blur) {
    let styleTag = document.getElementById('custom-sidebar-overrides');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'custom-sidebar-overrides';
      document.head.appendChild(styleTag);
    }
    
    if(!opacity) { styleTag.textContent = ''; return; }
    
    const opVal = opacity / 100;
    
    styleTag.textContent = `
       #sidebar.sidebar-glass { background: rgba(8,12,35,${opVal}) !important; backdrop-filter: blur(${blur}px) !important; border-right-color: ${border} !important; }
       #sidebar.sidebar-crystal { background: rgba(0,5,20,${opVal}) !important; backdrop-filter: blur(${blur}px) !important; border-right-color: ${border} !important; }
       #sidebar.sidebar-aurora-glow { border-right-color: ${border} !important; }
       #sidebar.sidebar-tinted { background: color-mix(in srgb, var(--brand-primary) ${opacity}%, black) !important; backdrop-filter: blur(${blur}px) !important; border-right-color: ${border} !important; }
       #sidebar.sidebar-carbon { border-right-color: ${border} !important; }
       #sidebar.sidebar-neonstrip { background: rgba(7,9,24,${opVal}) !important; backdrop-filter: blur(${blur}px) !important; border-right-color: ${border} !important; }
       #sidebar.sidebar-velvet { border-right-color: ${border} !important; }

       /* Custom active color matching has been disabled to preserve the multi-color navigation theme across all themes */
       #sidebar.sidebar-carbon .nav-item.active { background: color-mix(in srgb, ${active} 12%, transparent) !important;}
       #sidebar.sidebar-neonstrip .sidebar-logo::before { background: ${active} !important; box-shadow: 0 0 20px ${active} !important; }
    `;
  }
  
  function _getDefaultPresetForTheme(themeId) {
    const map = {
      'neon-grid': 'maroon',
      'nebula': 'purple',
      'emerald': 'emerald',
      'molten': 'obsidian',
      'aurora-wave': 'glass'
    };
    return map[themeId] || 'navy';
  }

  function _injectCardOverrides(presetId) {
    let styleTag = document.getElementById('custom-card-overrides');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'custom-card-overrides';
      document.head.appendChild(styleTag);
    }
    
    // Auto-resolve preset if missing
    if (!presetId) {
       const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
       presetId = localStorage.getItem(`wfa_card_theme_${themeId}`) || _getDefaultPresetForTheme(themeId);
    }

    const p = CARD_PRESETS.find(x => x.id === presetId) || CARD_PRESETS[0];

    styleTag.textContent = `
       :root {
         --card-bg: ${p.cardBg} !important;
         --card-border: ${p.border} !important;
         --card-glow-inner: ${p.inner} !important;
         --analytics-bg: ${p.anaBg} !important;
         --bg-surface: ${p.cardBg} !important;
         --bg-surface-solid: ${p.inner} !important;
         --bg-card: ${p.cardBg} !important;
       }
       
       /* Global UI Injection for this Preset */
       .card, .stat-card, .settings-card, .account-balance-card, .loan-person-card, .theme-card, .sidebar-style-card { 
         background-color: var(--card-bg) !important; 
         background-image: linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px) !important;
         background-size: 20px 20px !important;
         border-color: var(--card-border) !important; 
         backdrop-filter: blur(14px) saturate(1.4) !important;
         -webkit-backdrop-filter: blur(14px) saturate(1.4) !important;
       }
       .modal-box, .settings-modal, .att-modal-container { 
         background-color: var(--card-glow-inner) !important; 
         background-image: linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px) !important;
         background-size: 20px 20px !important;
         border-color: var(--card-border) !important; 
         backdrop-filter: blur(20px) saturate(1.2) !important;
         -webkit-backdrop-filter: blur(20px) saturate(1.2) !important;
       }
       .sub-tab-panel, .finance-tabs, .batch-controls, .data-table-container, .table-wrapper {
         background-color: var(--analytics-bg) !important;
         background-image: linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px) !important;
         background-size: 20px 20px !important;
         backdrop-filter: blur(10px) !important;
         -webkit-backdrop-filter: blur(10px) !important;
       }
       .table-wrapper table th { background: rgba(0,0,0,0.6) !important; }
       .notice-item { background: rgba(0,0,0,0.3) !important; }
       .settings-sidebar, .card-title, .settings-modal-header, .modal-header, .table-wrapper th, .table-wrapper td {
         border-color: rgba(255,255,255,0.08) !important;
       }
       input, select, textarea {
         background: rgba(0,0,0,0.3) !important;
         border-color: rgba(255,255,255,0.12) !important;
         color: #fff !important;
       }
    `;
  }







  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 1: GENERAL SETTINGS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  function panelGeneral() {
    const cfg = getConfig();
    const students = SupabaseSync.getAll(DB.students);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();
    // âœ… FIX: Use local timezone date (not UTC) â€” Bangladesh is UTC+6
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    // âœ… FIX: Don't default to today â€” empty means "show all expenses"
    // âœ… SANITIZE: if the stored value is not a valid date (e.g. "admin"), clear it
    const _rawExpStart = cfg.expense_start_date || '';
    const expStart = /^\d{4}-\d{2}-\d{2}$/.test(_rawExpStart.trim()) ? _rawExpStart.trim() : '';
    const _rawExpEnd = cfg.expense_end_date || '';
    const expEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(_rawExpEnd).trim()) ? _rawExpEnd.trim() : today;

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
            ${batches.map(b => `<option value="${b}" ${String(cfg.running_batch) === String(b) ? 'selected' : ''}>Batch ${b}</option>`).join('')}
          </select>
        </div>

        <div class="form-group mb-12">
          <label class="settings-label" style="color:var(--error)">EXPENSE DATE RANGE</label>
          <small class="settings-sublabel">à¦¶à§à¦§à§ Start Date à¦¸à§‡à¦Ÿ à¦•à¦°à§à¦¨à¥¤ End Date à¦¸à¦¬à¦¸à¦®à¦¯à¦¼ à¦†à¦œà¦•à§‡à¦° à¦¤à¦¾à¦°à¦¿à¦– à¦ªà¦°à§à¦¯à¦¨à§à¦¤ à¦…à¦Ÿà§‹-à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¬à§‡à¥¤</small>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">From (à¦¶à§à¦°à§)</label>
              <input id="set-expense-start" type="date" class="form-control" value="${expStart}" />
            </div>
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">To (à¦†à¦œ à¦ªà¦°à§à¦¯à¦¨à§à¦¤) <span class="auto-badge">AUTO</span></label>
              <div class="form-control" style="color:var(--success);display:flex;align-items:center;gap:6px;cursor:default;opacity:.75">
                <i class="fa fa-calendar-check" style="font-size:.8rem"></i>
                ${Utils.formatDateDMY(expEnd)}
              </div>
            </div>
          </div>
          <div style="margin-top:8px;padding:10px 14px;background:var(--bg-base);border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
            <i class="fa fa-info-circle" style="color:var(--brand-primary)"></i>
            Start Date à¦¸à§‡à¦Ÿ à¦•à¦°à¦²à§‡ à¦¸à§‡à¦‡ à¦¤à¦¾à¦°à¦¿à¦– à¦¥à§‡à¦•à§‡ à¦†à¦œ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ expense à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤ Start Date à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à¦²à§‡ à¦¸à¦¬ expense à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤
          </div>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-language"></i> Language Settings (à¦­à¦¾à¦·à¦¾ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸)</div>
        <div class="form-group mb-12">
          <label class="settings-label">APP LANGUAGE</label>
          <small class="settings-sublabel">Select the primary language for the application interface (à¦…à§à¦¯à¦¾à¦ªà§‡à¦° à¦­à¦¾à¦·à¦¾ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦•à¦°à§à¦¨)à¥¤</small>
          <select id="set-language" class="form-control" style="max-width:500px">
            <option value="default" ${cfg.language === 'default' || !cfg.language ? 'selected' : ''}>Default (à¦¬à¦¾à¦‡ à¦¡à¦¿à¦«à¦²à§à¦Ÿ)</option>
            <option value="en" ${cfg.language === 'en' ? 'selected' : ''}>English (à¦‡à¦‚à¦²à¦¿à¦¶)</option>
          </select>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;margin-top:10px;">
        <button class="settings-save-btn" onclick="SettingsModule.saveAllChanges()" style="background:linear-gradient(135deg, rgba(0,217,255,0.8), rgba(181,55,242,0.8));color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:0 6px 15px rgba(0,217,255,0.25);transition:all 0.3s ease">
          <i class="fa fa-floppy-disk"></i> Save General Settings
        </button>
      </div>

      ${buildSnapshotsHTML()}

    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 2: CATEGORIES & COURSES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â”€â”€ Silent auto-detect: merges student course names into cfg without UI interruption â”€â”€
  function _silentAutoDetect() {
    try {
      const cfg      = getConfig();
      const existing = cfg.courses ? (Utils.safeJSON(cfg.courses) || []) : [];
      const students = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll(DB.students) || []) : [];
      const found    = [...new Set(students.map(s => Utils.decodeHtmlEntities(s.course)).filter(Boolean))];
      const toAdd    = found.filter(c => !existing.includes(c));
      if (toAdd.length > 0) {
        cfg.courses = JSON.stringify([...existing, ...toAdd]);
        saveConfig(cfg);
        console.info('[Settings] Silent auto-detect: added courses:', toAdd);
      }
    } catch { /* silent */ }
  }

  // â”€â”€ Listen for Supabase pull events â†’ re-run auto-detect silently â”€â”€
  (function _initSettingsSyncListener() {
    window.addEventListener('wfa:synced', (e) => {
      if (e.detail?.direction === 'pull' || e.detail?.direction === 'realtime') {
        _silentAutoDetect();
        // Settings modal à¦–à§‹à¦²à¦¾ à¦¥à¦¾à¦•à¦²à§‡ merge skip â€” saveConfig/rebuild loop à¦“ UI hang à¦à¦¡à¦¼à¦¾à¦¯à¦¼
        if (document.getElementById('settings-overlay')) return;
        _mergeRemoteKeepRecords();
        _mergeRemoteRecycleBin();
      }
    });
  })();

  function panelCategories() {
    const cfg = getConfig();
    const incomeCats = cfg.income_categories ? (Utils.safeJSON(cfg.income_categories) || ['Course Fee', 'Incentive', 'Loan Received', 'Other']) : ['Course Fee', 'Incentive', 'Loan Received', 'Other'];
    const expenseCats = cfg.expense_categories ? (Utils.safeJSON(cfg.expense_categories) || ['Rent', 'Salary', 'Loan Given', 'Other']) : ['Rent', 'Salary', 'Loan Given', 'Other'];
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];
    const roles = cfg.employee_roles ? (Utils.safeJSON(cfg.employee_roles) || ['Admin', 'Instructor', 'Staff']) : ['Admin', 'Instructor', 'Staff'];

    return `
    <div class="settings-panel ${activeTab === 'categories' ? 'active' : ''}" data-panel="categories">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">

        ${buildCategoryCard('Income Categories', 'income_categories', incomeCats, 'green', 'success')}
        ${buildCategoryCard('Expense Categories', 'expense_categories', expenseCats, 'red', 'error')}
        ${buildCategoryCardWithAutoDetect('Course / Program Names', 'courses', courses, 'cyan', 'brand-primary')}
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
            <div class="category-item" id="cat-item-${key}-${item.replace(/[^a-z0-9]/gi,'_')}">
              <span class="cat-item-label">${item}</span>
              <div class="cat-item-actions">
                <button class="cat-rename" title="Rename" onclick="SettingsModule.startRenameCategory('${key}','${item.replace(/'/g, "\\'")}')">âœï¸</button>
                <button class="cat-delete" title="Delete" onclick="SettingsModule.removeCategory('${key}','${item.replace(/'/g, "\\'")}')">âœ•</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function buildCategoryCardWithAutoDetect(title, key, items, colorClass, cssVar) {
    return `
      <div class="settings-card glow-${colorClass === 'cyan' ? 'cyan' : 'purple'}">
        <div class="settings-card-title" style="color:var(--${cssVar}); display:flex; justify-content:space-between; align-items:center;">
          <span>${title.toUpperCase()}</span>
          <button onclick="SettingsModule.autoDetectCourses()"
            style="font-size:0.7rem;padding:3px 9px;border-radius:6px;border:1px solid rgba(0,212,255,0.4);background:rgba(0,212,255,0.08);color:var(--brand-primary);cursor:pointer;font-weight:700;"
            title="Existing students à¦¥à§‡à¦•à§‡ à¦¸à¦¬ course à¦¨à¦¾à¦® à¦à¦¨à§‡ list-à¦ à¦¯à§‹à¦— à¦•à¦°à§à¦¨">
            ðŸ” Auto-detect
          </button>
        </div>
        <div class="category-add-row">
          <input id="cat-add-${key}" class="form-control" placeholder="Add new course..." />
          <button class="category-add-btn ${colorClass}" onclick="SettingsModule.addCategory('${key}')">+ ADD</button>
        </div>
        <div class="category-list" id="cat-list-${key}">
          ${items.length === 0 ? `<div style="color:var(--text-muted);font-size:0.82rem;padding:10px 4px;">à¦•à§‹à¦¨à§‹ course à¦¨à§‡à¦‡à¥¤ "+ ADD" à¦¬à¦¾ "ðŸ” Auto-detect" à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§à¦¨à¥¤</div>` : ''}
          ${items.map(item => `
            <div class="category-item" id="cat-item-${key}-${item.replace(/[^a-z0-9]/gi,'_')}">
              <span class="cat-item-label">${item}</span>
              <div class="cat-item-actions">
                <button class="cat-rename" title="Rename" onclick="SettingsModule.startRenameCategory('${key}','${item.replace(/'/g, "\\'")}')">âœï¸</button>
                <button class="cat-delete" title="Delete" onclick="SettingsModule.removeCategory('${key}','${item.replace(/'/g, "\\'")}')">âœ•</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function autoDetectCourses() {
    const cfg      = getConfig();
    const existing = cfg.courses ? (Utils.safeJSON(cfg.courses) || []) : [];

    // à¦¸à¦¬ students à¦¥à§‡à¦•à§‡ unique course à¦¨à¦¾à¦® à¦¬à§‡à¦° à¦•à¦°à§‹
    const allStudents  = SupabaseSync.getAll(DB.students) || [];
    const fromStudents = [...new Set(allStudents.map(s => s.course).filter(Boolean))];

    // à¦¯à§‡à¦—à§à¦²à§‹ already list-à¦ à¦¨à§‡à¦‡ à¦¸à§‡à¦—à§à¦²à§‹à¦‡ à¦¯à§‹à¦— à¦¹à¦¬à§‡
    const toAdd = fromStudents.filter(c => !existing.includes(c));

    if (toAdd.length === 0) {
      Utils.toast('à¦¸à¦¬ course à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ list-à¦ à¦†à¦›à§‡!', 'info');
      return;
    }

    const merged = [...existing, ...toAdd];
    cfg.courses = JSON.stringify(merged);
    saveConfig(cfg);
    logActivity('edit', 'settings', `Auto-detected ${toAdd.length} course(s): ${toAdd.join(', ')}`);
    Utils.toast(`âœ… ${toAdd.length}à¦Ÿà¦¿ course à¦¯à§‹à¦— à¦¹à¦¯à¦¼à§‡à¦›à§‡: ${toAdd.join(', ')}`, 'success');
    refreshModal();
  }

  function addCategory(key) {
    const input = document.getElementById(`cat-add-${key}`);
    if (!input || !input.value.trim()) return;
    const cfg = getConfig();
    const items = cfg[key] ? (Utils.safeJSON(cfg[key]) || []) : [];
    const newItem = input.value.trim();
    if (items.includes(newItem)) { Utils.toast('Already exists', 'error'); return; }
    items.push(newItem);
    cfg[key] = JSON.stringify(items);
    saveConfig(cfg);
    input.value = '';
    refreshModal();
    logActivity('add', 'category', `à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿ à¦¯à§‹à¦—: "${newItem}" â€” ${key}`);
  }

  function removeCategory(key, item) {
    // âœ… Req 2: Push to recycle_bin (restorable) instead of Keep Record
    const recycleBin = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll('recycle_bin') || []) : [];
    recycleBin.unshift({
      id:        SupabaseSync.generateId(),
      table:     'settings_category',
      tableLabel: `Settings â†’ ${key}`,
      type:      'category',
      name:      item,
      data:      { key, item },
      deletedAt: new Date().toISOString(),
    });
    if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', recycleBin);
    _saveRecycleBinToSettings();

    const cfg = getConfig();
    const items = cfg[key] ? (Utils.safeJSON(cfg[key]) || []) : [];
    const idx = items.indexOf(item);
    if (idx > -1) items.splice(idx, 1);
    cfg[key] = JSON.stringify(items);
    saveConfig(cfg);
    refreshModal();
    Utils.toast(`"${item}" deleted â†’ Recycle Bin-à¦ à¦†à¦›à§‡à¥¤ Restore à¦•à¦°à¦¤à§‡ Recycle Bin à¦¦à§‡à¦–à§à¦¨à¥¤ ðŸ—‘ï¸`, 'info');
    logActivity('delete', 'category', `à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾: "${item}" â€” ${key}`);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENAME CATEGORY â€” inline edit with student/staff auto-update
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function startRenameCategory(key, oldName) {
    const safeId = oldName.replace(/[^a-z0-9]/gi, '_');
    const row = document.getElementById(`cat-item-${key}-${safeId}`);
    if (!row) return;

    const label = row.querySelector('.cat-item-label');
    const actions = row.querySelector('.cat-item-actions');
    if (!label) return;

    // Store in global so click handler can always access the value
    window._wfaRename = { key, oldName, val: oldName };

    label.innerHTML = `<input
      id="rename-input-${key}-${safeId}"
      class="cat-rename-input form-control"
      value="${oldName.replace(/"/g, '&quot;')}"
      oninput="window._wfaRename && (window._wfaRename.val = this.value)"
      style="flex:1;padding:3px 8px;font-size:0.85rem;border-radius:6px;"
    />`;
    actions.innerHTML = `
      <button class="cat-rename-save" title="Save" onclick="SettingsModule.confirmRenameCategory('${key}','${oldName.replace(/'/g, "\\'")}')">âœ”</button>
      <button class="cat-rename-cancel" title="Cancel" onclick="SettingsModule.cancelRenameCategory()">âœ•</button>
    `;

    const inp = document.getElementById(`rename-input-${key}-${safeId}`);
    if (inp) {
      inp.focus();
      inp.select();
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  SettingsModule.confirmRenameCategory(key, oldName);
        if (e.key === 'Escape') SettingsModule.cancelRenameCategory();
      });
    }
  }

  function cancelRenameCategory() {
    window._wfaRename = null;
    refreshModal();
  }

  function confirmRenameCategory(key, oldName) {
    // Read from global tracker â€” reliable across all browsers/click events
    const newName = (window._wfaRename && window._wfaRename.val
      ? window._wfaRename.val
      : (document.querySelector('.cat-rename-input') || {}).value || ''
    ).trim();

    window._wfaRename = null;

    if (!newName) {
      Utils.toast('à¦¨à¦¾à¦® à¦–à¦¾à¦²à¦¿ à¦°à¦¾à¦–à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾!', 'error');
      refreshModal();
      return;
    }
    if (newName === oldName) {
      refreshModal();
      return;
    }

    // â”€â”€ 1. Settings list à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§‹ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cfg   = getConfig();
    const items = cfg[key] ? (Utils.safeJSON(cfg[key]) || []) : [];
    if (items.includes(newName)) {
      Utils.toast(`"${newName}" à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦†à¦›à§‡!`, 'error');
      refreshModal();
      return;
    }
    const idx = items.indexOf(oldName);
    if (idx > -1) {
      items[idx] = newName;
    } else {
      items.push(newName);
    }
    cfg[key] = JSON.stringify(items);
    saveConfig(cfg);

    // â”€â”€ 2. à¦¯à¦¦à¦¿ course rename à¦¹à¦¯à¦¼ â†’ à¦¸à¦¬ Students à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§‹ â”€â”€â”€â”€â”€â”€â”€â”€
    let updatedCount = 0;
    if (key === 'courses') {
      const allStudents = SupabaseSync.getAll(DB.students) || [];
      allStudents.forEach(s => {
        if (s.course === oldName) {
          SupabaseSync.update(DB.students, s.id, { ...s, course: newName });
          updatedCount++;
        }
      });
    }

    // â”€â”€ 3. à¦¯à¦¦à¦¿ employee_roles rename à¦¹à¦¯à¦¼ â†’ à¦¸à¦¬ Staff à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§‹ â”€â”€
    if (key === 'employee_roles') {
      const allStaff = SupabaseSync.getAll(DB.staff) || [];
      allStaff.forEach(st => {
        if (st.role === oldName) {
          SupabaseSync.update(DB.staff, st.id, { ...st, role: newName });
          updatedCount++;
        }
      });
    }

    // â”€â”€ 4. Activity log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    logActivity('edit', 'category', `à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿ à¦¨à¦¾à¦® à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨: "${oldName}" â†’ "${newName}" (${key})${updatedCount > 0 ? ` â€” ${updatedCount}à¦Ÿà¦¿ à¦°à§‡à¦•à¦°à§à¦¡ à¦†à¦ªà¦¡à§‡à¦Ÿ` : ''}`);

    // â”€â”€ 5. Toast & refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const msg = updatedCount > 0
      ? `âœ… "${oldName}" â†’ "${newName}" â€” ${updatedCount}à¦Ÿà¦¿ à¦°à§‡à¦•à¦°à§à¦¡ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!`
      : `âœ… "${oldName}" â†’ "${newName}" renamed!`;
    Utils.toast(msg, 'success');
    refreshModal();
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 3: DATA MANAGEMENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelData() {
    return `
    <div class="settings-panel ${activeTab === 'data' ? 'active' : ''}" data-panel="data">
      <!-- â”€â”€ Storage Usage Indicator (Enhanced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
      <div class="settings-card" style="border-color:rgba(0,212,255,0.25);margin-bottom:14px" id="storage-usage-card">
        <div class="settings-card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span><i class="fa fa-hard-drive"></i> Local Storage Usage</span>

        </div>
        <div id="storage-usage-content" style="font-size:.88rem;color:var(--text-secondary)">
          <i class="fa fa-spinner fa-spin"></i> Calculating...
        </div>
      </div>
      <script>
        (function() {
          try {
            const usedKB  = typeof SyncEngine !== 'undefined' ? SyncEngine.getStorageUsageKB() : 0;
            const limitKB = 512000; // IndexedDB â€” ~500 MB
            const pct     = Math.min(100, Math.round(usedKB / limitKB * 100));
            const color   = pct >= 90 ? '#ff4757' : pct >= 70 ? '#ffa502' : pct >= 50 ? '#00d9ff' : '#00ff88';
            const status  = pct >= 90 ? 'Critical' : pct >= 70 ? 'Warning' : 'Healthy';
            const tables  = ['students','finance_ledger','accounts','loans','exams','staff','attendance','visitors','notices','salary','activity_log','recent_changes','recycle_bin','retry_queue'];
            const tableRows = tables.map(function(t) {
              var kb = typeof SyncEngine !== 'undefined' ? SyncEngine.getTableSizeKB(t) : 0;
              if (kb < 1) return '';
              var tpct = Math.min(100, Math.round(kb / limitKB * 100));
              var tc   = tpct >= 20 ? '#ffa502' : tpct >= 10 ? '#00d9ff' : 'rgba(255,255,255,0.35)';
              return '<div style="margin-bottom:7px">' +
                '<div style="display:flex;justify-content:space-between;margin-bottom:2px">' +
                  '<span style="color:var(--text-muted);font-size:.78rem">' + t + '</span>' +
                  '<span style="font-family:monospace;font-size:.78rem;color:' + tc + '">' + kb + ' KB</span>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:3px;height:4px;overflow:hidden">' +
                  '<div style="height:100%;width:' + tpct + '%;background:' + tc + ';border-radius:3px"></div>' +
                '</div></div>';
            }).filter(Boolean).join('');
            document.getElementById('storage-usage-content').innerHTML =
              '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
                '<span>Used: <strong style="color:' + color + '">' + usedKB.toLocaleString() + ' KB</strong></span>' +
                '<span style="color:' + color + ';font-size:.78rem">' + status + ' â€” ' + pct + '% of ~500 MB</span>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.06);border-radius:8px;height:12px;overflow:hidden;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08)">' +
                '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',' + color + '88);border-radius:8px;transition:width .4s ease"></div>' +
              '</div>' +
              (pct >= 70 ? '<div style="background:rgba(255,165,0,0.09);border:1px solid rgba(255,165,0,0.25);border-radius:6px;padding:8px 12px;font-size:.80rem;color:#ffa502;margin-bottom:10px"><i class="fa fa-triangle-exclamation"></i> ' +
                (pct >= 90 ? '<strong>Critical!</strong> Storage ' + pct + '% à¦ªà§‚à¦°à§à¦£à¥¤ à¦ªà§à¦°à¦¨à§‹ data Supabase-à¦ safe à¦†à¦›à§‡à¥¤' :
                             'Storage ' + pct + '% à¦ªà§‚à¦°à§à¦£à¥¤ à¦¶à§€à¦˜à§à¦°à¦‡ à¦ªà§à¦°à¦¨à§‹ data archive à¦•à¦°à§à¦¨à¥¤') +
              '</div>' : '') +
              '<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;letter-spacing:.5px">TABLE BREAKDOWN</div>' +
              (tableRows || '<div style="color:var(--text-muted);font-size:.78rem">Data à¦à¦–à¦¨à§‹ à¦¯à§‹à¦— à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤</div>');
          } catch(e) {
            var el = document.getElementById('storage-usage-content');
            if (el) el.textContent = 'Storage info à¦¦à§‡à¦–à¦¾ à¦¯à¦¾à¦šà§à¦›à§‡ à¦¨à¦¾à¥¤';
          }
        })();
      </script>
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-floppy-disk"></i> Backup & Restore</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px">Save your data locally or restore from a file.</p>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <button class="settings-btn-lg btn-export" onclick="SettingsModule.exportAllData()">
            <i class="fa fa-floppy-disk"></i> EXPORT DATA
          </button>
          <button class="settings-btn-lg btn-export" style="border-color:var(--text-muted);color:var(--text-muted)" onclick="BackupRestore.importBackup()">
            <i class="fa fa-cloud-arrow-up"></i> IMPORT DATA
          </button>
        </div>
        <div id="dm-sync-result" style="display:none;margin-bottom:10px;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="btn-full-sync" class="settings-btn-lg btn-sync-cloud" style="flex:1" onclick="
            const b=document.getElementById('btn-full-sync');
            const r=document.getElementById('dm-sync-result');
            b.disabled=true; b.innerHTML='<i class=&quot;fa fa-spinner fa-spin&quot;></i> Syncing...';
            r.style.display='none';
            SyncEngine.syncAll({ forcePush:true, forceFull:true, silent:true }).then(res=>{
              b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-down&quot;></i> FULL SYNC (à¦¸à¦¬ data)';
              r.style.display='block';
              if(res && res.ok){ r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88'; r.innerHTML='âœ… Full Sync à¦¸à¦«à¦²! à¦¸à¦¬ à¦¡à§‡à¦Ÿà¦¾ Cloud à¦¥à§‡à¦•à§‡ à¦¨à¦¾à¦®à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤'; Utils.toast('Full Sync à¦¸à¦«à¦² âœ…','success'); }
              else { r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);color:#ffa502'; r.innerHTML='âš ï¸ Sync à¦†à¦‚à¦¶à¦¿à¦• à¦¸à¦®à§à¦ªà¦¨à§à¦¨à¥¤ Supabase credentials à¦šà§‡à¦• à¦•à¦°à§à¦¨à¥¤'; Utils.toast('Sync â€” à¦•à¦¿à¦›à§ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡','warn'); }
            }).catch(err=>{ b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-down&quot;></i> FULL SYNC (à¦¸à¦¬ data)'; r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.3);color:#ff4757'; r.textContent='âŒ Sync à¦¬à§à¦¯à¦°à§à¦¥: '+(err.message||''); Utils.toast('Sync à¦¬à§à¦¯à¦°à§à¦¥','error'); });
          ">
            <i class="fa fa-cloud-arrow-down"></i> FULL SYNC (à¦¸à¦¬ data)
          </button>
          <button id="btn-push-cloud-dm" class="settings-btn-lg btn-sync-cloud" style="flex:1;background:rgba(0,255,136,0.08);border-color:rgba(0,255,136,0.3);color:#00ff88" onclick="
            const b=document.getElementById('btn-push-cloud-dm');
            const r=document.getElementById('dm-sync-result');
            b.disabled=true; b.innerHTML='<i class=&quot;fa fa-spinner fa-spin&quot;></i> Pushing...';
            r.style.display='none';
            SyncEngine.push({ silent:true, forcePush:true }).then(res=>{
              b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-up&quot;></i> PUSH â†’ CLOUD';
              const sc=res?.successCount||0; const errs=res?.errors||[];
              if(res && res.ok){ r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88'; r.innerHTML='âœ… Push à¦¸à¦«à¦²! '+sc+' à¦Ÿà§‡à¦¬à¦¿à¦² Supabase-à¦ à¦†à¦ªà¦²à§‹à¦¡ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤'; Utils.toast('Push à¦¸à¦«à¦² âœ… '+sc+' à¦Ÿà§‡à¦¬à¦¿à¦² à¦†à¦ªà¦²à§‹à¦¡','success'); }
              else { r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);color:#ffa502'; r.innerHTML='âš ï¸ à¦†à¦‚à¦¶à¦¿à¦• Push: '+sc+' à¦¸à¦«à¦², '+errs.length+' à¦¸à¦®à¦¸à§à¦¯à¦¾à¥¤ Security & Access-à¦ credentials à¦šà§‡à¦• à¦•à¦°à§à¦¨à¥¤'; Utils.toast('Push â€” à¦•à¦¿à¦›à§ à¦¸à¦®à¦¸à§à¦¯à¦¾','warn'); }
            }).catch(err=>{ b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-up&quot;></i> PUSH â†’ CLOUD'; r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.3);color:#ff4757'; r.textContent='âŒ Push à¦¬à§à¦¯à¦°à§à¦¥: '+(err.message||''); Utils.toast('Push à¦¬à§à¦¯à¦°à§à¦¥','error'); });
          ">
            <i class="fa fa-cloud-arrow-up"></i> PUSH â†’ CLOUD
          </button>
        </div>
        <small style="display:block;text-align:center;margin-top:6px;color:var(--text-muted);font-size:.78rem">
          Full Sync = Supabase à¦¥à§‡à¦•à§‡ à¦¸à¦¬ data à¦¨à¦¾à¦®à¦¾à¦¯à¦¼ | Auto incremental sync à¦šà¦²à§‡ à¦ªà§à¦°à¦¤à¦¿ à§©à§¦ à¦¸à§‡.
        </small>
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
        <div class="settings-card-title"><i class="fa fa-file-import"></i> Data Migration (Old â†’ New)</div>
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
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.startMigration()">ðŸ“¥ Start Import</button>
          <button class="btn btn-outline btn-sm" onclick="SettingsModule.importFromJSON()">ðŸ“„ Import from JSON</button>
        </div>
      </div>
      <!-- REQ 1: Date-Based Import Option -->
      <div class="settings-card glow-cyan" style="margin-top:12px">
        <div class="settings-card-title"><i class="fa fa-calendar"></i> Import with Custom Date</div>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
          Optional: Set the date when imported data was created. Leave blank to keep original dates.
        </p>
        <div style="margin-bottom:12px">
          <label style="font-size:.78rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:8px">Import Date</label>
          ${Utils.dateSelectHTML('imp-date', Utils.today(), 'form-control')}
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.importFromJSONWithDate()">ðŸ“… Import with Date</button>
        </div>
      </div>
      <div class="settings-card glow-cyan" style="margin-top:12px">
        <div class="settings-card-title"><i class="fa fa-scale-balanced"></i> Fee Reconciliation</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          à¦¯à¦¦à¦¿ à¦•à§‹à¦¨à§‹ Student-à¦à¦° <strong style="color:#00ff88">Paid</strong> à¦¬à¦¾ <strong style="color:#ff4757">Due</strong>
          amount Finance Ledger-à¦à¦° à¦¸à¦¾à¦¥à§‡ à¦®à¦¿à¦²à¦›à§‡ à¦¨à¦¾ â€” à¦à¦‡ à¦¬à¦¾à¦Ÿà¦¨à¦Ÿà¦¿ à¦¸à¦¬ à¦ à¦¿à¦• à¦•à¦°à§‡ à¦¦à§‡à¦¬à§‡à¥¤<br/>
          <span style="font-size:.78rem;color:var(--text-muted);">âš ï¸ à¦¶à§à¦§à§ mismatch fix à¦•à¦°à§‡ â€” à¦•à§‹à¦¨à§‹ payment delete à¦¬à¦¾ add à¦•à¦°à§‡ à¦¨à¦¾à¥¤</span>
        </p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm"
                  style="background:linear-gradient(90deg,#00d9ff,#b537f2);border:none;padding:10px 20px;font-weight:800;"
                  onclick="if(typeof Students!=='undefined')Students.reconcileAllStudents();else Utils.toast('Students module not loaded','error')">
            <i class="fa fa-scale-balanced"></i> Run Fee Reconciliation
          </button>
          <span style="font-size:.78rem;color:var(--text-muted);">
            <i class="fa fa-circle-info"></i> Finance ledger = source of truth
          </span>
        </div>
      </div>
    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 4: SECURITY & ACCESS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelSecurity() {
    const subs = getSubAccounts();
    const cfg = getConfig();
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
        <button class="btn btn-accent" onclick="SettingsModule.changePassword()">ðŸ”‘ Change Password</button>
      </div>

      <!-- Supabase Project API (URL + anon key) -->
      <div class="settings-card" style="margin-top:16px; border: 1px solid rgba(0,212,255,0.15)">
        <div style="font-weight:700; font-size:1.05rem; color:#fff; margin-bottom:12px">â˜ï¸ Cloud API (Project URL &amp; Anon Key)</div>
        <div style="font-size:0.8rem; color:#aaa; margin-bottom:12px; line-height:1.5">
          Stored encrypted on this device. Use Supabase Dashboard â†’ Settings â†’ API, or copy from <code style="background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:4px">supabase-secrets.example.js</code>.
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div class="form-group" style="flex:1;min-width:220px">
            <label>Project URL</label>
            <input type="url" id="supa-project-url" class="form-control" placeholder="https://xxx.supabase.co" />
          </div>
          <div class="form-group" style="flex:1;min-width:220px">
            <label>Anon Key (public JWT)</label>
            <input type="password" id="supa-anon-key" class="form-control" placeholder="eyJ..." autocomplete="off" />
          </div>
        </div>
        <button class="btn btn-accent" onclick="SettingsModule.saveCloudApiCredentials()">ðŸ’¾ Save API Credentials</button>
      </div>

      <!-- Supabase Cloud Auth -->
      <div class="settings-card" style="margin-top:16px; border: 1px solid rgba(0,212,255,0.2)">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="document.getElementById('supabase-auth-body').classList.toggle('hidden'); const i=this.querySelector('i.fa-caret-down,i.fa-caret-up'); if(i.classList.contains('fa-caret-down')){i.classList.replace('fa-caret-down','fa-caret-up')}else{i.classList.replace('fa-caret-up','fa-caret-down')}">
          <div style="display:flex; gap:12px; align-items:center">
            <div style="width:40px; height:40px; border-radius:8px; background:rgba(0,212,255,0.08); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(0,212,255,0.2)">
              <i class="fa fa-cloud-arrow-up" style="color:#00d4ff"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:#fff">ðŸ” Supabase Cloud Login</div>
              <div style="font-size:0.8rem; color:#00d4ff">Secure sync-à¦à¦° à¦œà¦¨à§à¦¯ Supabase account credentials</div>
            </div>
          </div>
          <i class="fa fa-caret-down" style="color:#00d4ff"></i>
        </div>
        <div id="supabase-auth-body" class="hidden" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px">
          <div style="background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:.82rem; color:#aaa; line-height:1.6">
            <strong style="color:#00d4ff">à¦¸à§‡à¦Ÿà¦†à¦ª à¦—à¦¾à¦‡à¦¡:</strong><br>
            à§§. Supabase Dashboard â†’ Authentication â†’ Users â†’ Add user à¦•à¦°à§à¦¨<br>
            à§¨. à¦¸à§‡à¦‡ email à¦“ password à¦à¦–à¦¾à¦¨à§‡ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à§à¦¨<br>
            à§©. <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px">supabase/rls_policies_secure.sql</code> SQL Editor-à¦ run à¦•à¦°à§à¦¨<br>
            à§ª. à¦ªà¦°à¦¬à¦°à§à¦¤à§€ login à¦¥à§‡à¦•à§‡ RLS-secure sync à¦šà¦¾à¦²à§ à¦¹à¦¬à§‡ âœ…
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div class="form-group" style="flex:1;min-width:200px">
              <label>Supabase Email</label>
              <input type="email" id="supa-email" class="form-control" placeholder="you@example.com" value="${cfg.supabase_email || ''}" />
            </div>
            <div class="form-group" style="flex:1;min-width:200px">
              <label>Supabase Password</label>
              <input type="password" id="supa-pass" class="form-control" placeholder="Supabase user password" />
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; justify-content:space-between">
            <span style="font-size:.78rem; color:${cfg.supabase_email ? '#00ff88' : '#666'}">
              ${cfg.supabase_email ? 'âœ… Configured: ' + cfg.supabase_email : 'âš ï¸ Not configured â€” running in open-access mode'}
            </span>
            <button class="btn btn-accent" onclick="SettingsModule.saveSupabaseAuth()">ðŸ’¾ Save & Connect</button>
          </div>
        </div>
      </div>

      <!-- Secret Recovery Question -->
      <div class="settings-card glow-purple" style="margin-top:16px; border: 1px solid rgba(181, 55, 242, 0.2)">
         <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="document.getElementById('recovery-body').classList.toggle('hidden'); const i=this.querySelector('i.fa-caret-down, i.fa-caret-up'); if(i.classList.contains('fa-caret-down')){i.classList.replace('fa-caret-down','fa-caret-up')}else{i.classList.replace('fa-caret-up','fa-caret-down')}">
            <div style="display:flex; gap:12px; align-items:center">
               <div style="width:40px; height:40px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(255,255,255,0.1)">
                  <i class="fa fa-shield-halved" style="color:#ff3366"></i>
               </div>
               <div>
                  <div style="font-weight:700; font-size:1.05rem; color:#fff">Secret Recovery Question</div>
                  <div style="font-size:0.8rem; color:var(--brand-primary)">à¦ªà¦¾à¦¸à¦“à§Ÿà¦¾à¦°à§à¦¡ à¦­à§à¦²à§‡ à¦—à§‡à¦²à§‡ à¦à¦‡ à¦ªà§à¦°à¦¶à§à¦¨ à¦¦à¦¿à§Ÿà§‡ reset à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨</div>
               </div>
            </div>
            <i class="fa fa-caret-down" style="color:var(--brand-primary)"></i>
         </div>
         
         <div id="recovery-body" class="${cfg.security_question ? 'hidden' : ''}" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px">
            <div class="form-group mb-12">
               <label>Security Question</label>
               <select id="sec-question" class="form-control">
                  <option value="">Select a question...</option>
                  <option value="pet" ${cfg.security_question === 'pet' ? 'selected' : ''}>What is the name of your first pet?</option>
                  <option value="city" ${cfg.security_question === 'city' ? 'selected' : ''}>In what city were you born?</option>
                  <option value="school" ${cfg.security_question === 'school' ? 'selected' : ''}>What is the name of your first school?</option>
                  <option value="childhood" ${cfg.security_question === 'childhood' ? 'selected' : ''}>What was your childhood nickname?</option>
               </select>
            </div>
            <div class="form-group mb-12">
               <label>Answer (Keep it secret)</label>
               <input type="password" id="sec-answer" class="form-control" placeholder="Your answer" value="${cfg.security_answer || ''}" />
            </div>
            <div style="display:flex; justify-content:flex-end">
               <button class="btn" style="background:linear-gradient(135deg, rgba(181,55,242,0.8), rgba(0,217,255,0.8)); color:#fff; border:none; padding:8px 20px; border-radius:8px; box-shadow:0 0 10px rgba(181,55,242,0.3)" onclick="SettingsModule.saveRecoverySettings()">
                  ðŸ’¾ Save Security Settings
               </button>
            </div>
         </div>
      </div>

      <!-- Face ID Setup -->
      <div class="settings-card glow-green" style="margin-top:16px; border: 1px solid rgba(0, 255, 136, 0.2)">
         <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; gap:12px; align-items:center">
               <div style="width:40px; height:40px; border-radius:8px; background:rgba(0,255,136,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(0,255,136,0.2)">
                  <i class="fa fa-face-smile" style="color:#00ff88"></i>
               </div>
               <div>
                  <div style="font-weight:700; font-size:1.05rem; color:#fff">Face ID Login</div>
                  <div style="font-size:0.8rem; color:#00ff88">à¦•à§à¦¯à¦¾à¦®à§‡à¦°à¦¾ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡ à¦¦à§à¦°à§à¦¤ à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨</div>
               </div>
            </div>
            <button class="btn" style="background:linear-gradient(135deg, #00b09b, #96c93d); color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:700;" onclick="if(typeof FaceIDModule !== 'undefined') FaceIDModule.openScannerModal('register'); else Utils.toast('Face ID module not loaded.', 'error')">
               <i class="fa fa-camera"></i> Register Face
            </button>
         </div>
      </div>

      <!-- Pattern Lock Setup -->
      <div class="settings-card glow-cyan" style="margin-top:16px; border: 1px solid rgba(0, 217, 255, 0.2)">
         <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; gap:12px; align-items:center">
               <div style="width:40px; height:40px; border-radius:8px; background:rgba(0,217,255,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(0,217,255,0.2)">
                  <i class="fa fa-lock" style="color:#00d4ff"></i>
               </div>
               <div>
                  <div style="font-weight:700; font-size:1.05rem; color:#fff">Pattern Lock</div>
                  <div style="font-size:0.8rem; color:#00d4ff">à¦¡à¦Ÿ à¦®à¦¿à¦²à¦¿à§Ÿà§‡ à¦¸à¦¿à¦•à§à¦°à§‡à¦Ÿ à¦ªà§à¦¯à¦¾à¦Ÿà¦¾à¦°à§à¦¨ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨</div>
               </div>
            </div>
            <button class="btn" style="background:linear-gradient(135deg, #00d4ff, #0066ff); color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:700;" onclick="if(typeof PatternLockModule !== 'undefined') PatternLockModule.open('register'); else Utils.toast('Pattern Lock module not loaded.', 'error')">
               <i class="fa fa-pen"></i> Set Pattern
            </button>
         </div>
      </div>

      <!-- Staff / Sub-account Access -->
      <div class="settings-card glow-cyan" style="margin-top:16px; border: 1px solid rgba(0, 217, 255, 0.2)">
         <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="document.getElementById('sub-account-body').classList.toggle('hidden'); const i=this.querySelector('i.fa-caret-down, i.fa-caret-up'); if(i.classList.contains('fa-caret-down')){i.classList.replace('fa-caret-down','fa-caret-up')}else{i.classList.replace('fa-caret-up','fa-caret-down')}">
            <div style="display:flex; gap:12px; align-items:center">
               <div style="width:40px; height:40px; border-radius:8px; background:rgba(0,180,216,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(0,180,216,0.2)">
                  <i class="fa fa-users" style="color:var(--brand-primary)"></i>
               </div>
               <div>
                  <div style="font-weight:700; font-size:1.05rem; color:#fff">Staff / Sub-account Access</div>
                  <div style="font-size:0.8rem; color:var(--brand-cyan)">à¦¸à§€à¦®à¦¿à¦¤ à¦à¦•à§à¦¸à§‡à¦¸ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦¸à¦¾à¦¬ à¦†à¦‡à¦¡à¦¿ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§à¦¨</div>
               </div>
            </div>
            <i class="fa fa-caret-up" style="color:var(--brand-cyan)"></i>
         </div>

         <div id="sub-account-body" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px">
            
            <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; text-align:center; color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; min-height:50px">
               ${subs.length === 0 ? 'à¦•à§‹à¦¨à§‹ à¦¸à¦¾à¦¬ à¦†à¦‡à¦¡à¦¿ à¦¨à§‡à¦‡' : buildSubAccountsList(subs)}
            </div>

            <div style="font-size:0.8rem; font-weight:700; color:var(--brand-primary); letter-spacing:1px; margin-bottom:12px; text-transform:uppercase">Create New Sub ID</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:12px; margin-bottom:20px">
               <input type="text" id="sub-username" class="form-control" placeholder="Username" />
               <div style="position:relative">
                 <input type="password" id="sub-pw" class="form-control" placeholder="Password" style="padding-right:35px" />
                 <i class="fa fa-eye" style="position:absolute; right:12px; top:13px; color:var(--text-muted); cursor:pointer" onclick="const p=document.getElementById('sub-pw'); p.type=p.type==='password'?'text':'password'"></i>
               </div>
               <button class="btn" style="background:linear-gradient(135deg, rgba(0,217,255,0.8), rgba(181,55,242,0.8)); color:#fff; border:none; padding:0 20px; border-radius:8px; font-weight:700; box-shadow:0 0 15px rgba(0,217,255,0.4)" onclick="SettingsModule.addSubAccount()">
                  + ADD
               </button>
            </div>

            <div style="font-size:0.75rem; font-weight:700; color:var(--brand-gold); letter-spacing:1px; margin-bottom:12px; display:flex; align-items:center; gap:6px">
               <i class="fa fa-lock"></i> TAB ACCESS PERMISSION
            </div>
            
            <style>
               .custom-chk { accent-color: var(--brand-primary); width: 16px; height: 16px; cursor: pointer; }
            </style>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem; background:rgba(0,0,0,0.1); padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.05)">
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-students" checked class="custom-chk"> <span>ðŸŽ“ Students</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-attendance" class="custom-chk"> <span>ðŸ“‹ Attendance</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-finance" class="custom-chk"> <span>ðŸ’° Finance/Ledger</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-accounts" class="custom-chk"> <span>ðŸ“Š Accounts</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-loans" class="custom-chk"> <span>ðŸ’³ Loans</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-exams" class="custom-chk"> <span>ðŸ“ Exams</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-hr" class="custom-chk"> <span>ðŸ‘¥ HR / Staff</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-salary" class="custom-chk"> <span>ðŸ’µ Salary Hub</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-visitors" class="custom-chk"> <span>ðŸ‘¤ Visitors</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-idcards" class="custom-chk"> <span>ðŸªª ID Cards</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-certificates" class="custom-chk"> <span>ðŸ† Certificates</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-noticeboard" class="custom-chk"> <span>ðŸ“¢ Notice Board</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-settings" class="custom-chk"> <span>âš™ï¸ Settings</span></label>
            </div>

         </div>
      </div>
      
      <style> .hidden { display: none !important; } </style>
    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 5: ACTIVITY LOG
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelActivity() {
    const logs = getActivityLogs();
    const addCount    = logs.filter(l => l.action === 'add').length;
    const editCount   = logs.filter(l => l.action === 'edit').length;
    const deleteCount = logs.filter(l => l.action === 'delete').length;

    return `
    <div class="settings-panel ${activeTab === 'activity' ? 'active' : ''}" data-panel="activity">
      <div class="settings-card-title" style="color:var(--brand-primary)">
        <i class="fa fa-list-check"></i> FULL ACTIVITY LOG
        <div style="display:flex;gap:8px;align-items:center">
          <button class="settings-top-action"
            style="background:rgba(0,212,255,0.1);border-color:rgba(0,212,255,0.3);color:#00d4ff"
            onclick="if(typeof SupabaseSync!=='undefined'&&SupabaseSync.pullActivityLog){this.innerHTML='<i class=&quot;fa fa-rotate fa-spin&quot;></i> Syncingâ€¦';const me=this;SupabaseSync.pullActivityLog().then(()=>{SettingsModule.refreshActivityPanel();me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';Utils.toast('Activity log synced âœ…','success');}).catch(()=>{me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';})}">
            <i class="fa fa-rotate"></i> SYNC
          </button>
          <button class="settings-top-action" onclick="SettingsModule.clearActivityLog()">
            <i class="fa fa-trash-can"></i> CLEAR ALL
          </button>
        </div>
      </div>

      <div class="activity-stats">
        <span class="activity-stat-badge" id="astat-total" style="background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary)">à¦®à§‹à¦Ÿ: ${logs.length}</span>
        <span class="activity-stat-badge" id="astat-add" style="background:rgba(0,255,136,0.10);color:#00ff88;border:1px solid rgba(0,255,136,0.25)">+ à¦¯à§‹à¦— ${addCount}</span>
        <span class="activity-stat-badge" id="astat-edit" style="background:rgba(0,217,255,0.10);color:#00d9ff;border:1px solid rgba(0,217,255,0.25)">âœ à¦à¦¡à¦¿à¦Ÿ ${editCount}</span>
        <span class="activity-stat-badge" id="astat-del" style="background:rgba(255,71,87,0.10);color:#ff4757;border:1px solid rgba(255,71,87,0.25)">ðŸ—‘ à¦¡à¦¿à¦²à¦¿à¦Ÿ ${deleteCount}</span>
        <span class="activity-stat-badge" style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);color:#00d4ff;font-size:.74rem">
          <i class="fa fa-wifi"></i> à¦¸à¦¬ device sync
        </span>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07)">
        <i class="fa fa-filter" style="color:var(--brand-primary);font-size:.82rem"></i>
        <select id="alog-filter-action" class="form-control" style="width:130px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="SettingsModule.filterActivityLog()">
          <option value="all">à¦¸à¦¬ Action</option>
          <option value="add">âž• ADD</option>
          <option value="edit">âœï¸ EDIT</option>
          <option value="delete">ðŸ—‘ DELETE</option>
          <option value="restore">â†© RESTORE</option>
          <option value="system">âš™ SYSTEM</option>
          <option value="export">ðŸ“¤ EXPORT</option>
        </select>
        <select id="alog-filter-type" class="form-control" style="width:160px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="SettingsModule.filterActivityLog()">
          <option value="all">à¦¸à¦¬ Module</option>
          <option value="students">ðŸ‘¨â€ðŸŽ“ à¦›à¦¾à¦¤à§à¦° à¦¤à¦¾à¦²à¦¿à¦•à¦¾</option>
          <option value="finance_ledger">ðŸ’° à¦†à¦¯à¦¼-à¦¬à§à¦¯à¦¯à¦¼ à¦²à§‡à¦œà¦¾à¦°</option>
          <option value="accounts">ðŸ¦ à¦à¦•à¦¾à¦‰à¦¨à§à¦Ÿ</option>
          <option value="loans">ðŸ’³ à¦²à§‹à¦¨</option>
          <option value="salary">ðŸ’µ à¦¬à§‡à¦¤à¦¨</option>
          <option value="exams">ðŸ“ à¦ªà¦°à§€à¦•à§à¦·à¦¾</option>
          <option value="attendance">ðŸ“‹ à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿</option>
          <option value="staff">ðŸ‘¤ à¦¸à§à¦Ÿà¦¾à¦«</option>
          <option value="settings">âš™ï¸ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸</option>
          <option value="security">ðŸ” à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾</option>
          <option value="certificates">ðŸŽ“ à¦¸à¦¾à¦°à§à¦Ÿà¦¿à¦«à¦¿à¦•à§‡à¦Ÿ</option>
          <option value="visitors">ðŸš¶ à¦­à¦¿à¦œà¦¿à¦Ÿà¦°</option>
          <option value="notices">ðŸ“¢ à¦¨à§‹à¦Ÿà¦¿à¦¶</option>
        </select>
        <div style="flex:1;min-width:160px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:4px 10px">
          <i class="fa fa-search" style="color:rgba(255,255,255,0.35);font-size:.78rem"></i>
          <input type="text" id="alog-search" placeholder="à¦¸à¦¾à¦°à§à¦š à¦•à¦°à§à¦¨â€¦" style="background:none;border:none;outline:none;color:#fff;font-size:.82rem;width:100%;font-family:var(--font-ui)" oninput="SettingsModule.filterActivityLog()" />
        </div>
        <button onclick="SettingsModule.clearActivityFilters()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:7px;padding:6px 12px;cursor:pointer;font-size:.78rem">âœ• à¦•à§à¦²à¦¿à¦¯à¦¼à¦¾à¦°</button>
      </div>

      <div class="table-wrapper" style="max-height:480px;overflow:auto">
        <table>
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Action</th>
              <th>Module</th>
              <th>à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤</th>
              <th>Status</th>
              <th>Device</th>
              <th style="text-align:right">â± à¦¸à¦®à¦¯à¦¼</th>
            </tr>
          </thead>
          <tbody id="alog-tbody">
            ${_buildActivityRows(logs)}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 6: RECYCLE BIN
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px">Items you delete in the app are listed here. Restore puts them back locally and syncs to Supabase. Empty bin clears the list and tombstones only for those items (cloud stays deleted until you restore).</p>
      <span class="badge badge-muted" style="margin-bottom:12px;display:inline-block">Total: ${deleted.length}</span>

      <div class="table-wrapper" style="max-height:400px;overflow:auto">
        <table>
          <thead><tr><th>Icon</th><th>Table</th><th>Type</th><th>Item</th><th>Deleted At</th><th>Actions</th></tr></thead>
          <tbody>
            ${deleted.length === 0 ?
              `<tr><td colspan="6" class="no-data" style="padding:40px"><i class="fa fa-trash-can" style="font-size:2rem;opacity:.3;display:block;margin-bottom:8px"></i>Recycle bin is empty.</td></tr>` :
              deleted.map((d, i) => `
                <tr>
                  <td><i class="fa ${d.type === 'student' ? 'fa-user-graduate' : d.type === 'transaction' ? 'fa-money-bill' : d.type === 'staff' ? 'fa-user-tie' : d.type === 'visitor' ? 'fa-walking' : d.type === 'notice' ? 'fa-bullhorn' : d.type === 'account' ? 'fa-building-columns' : d.type === 'loan' ? 'fa-hand-holding-dollar' : d.type === 'exam' ? 'fa-file-lines' : d.type === 'category' ? 'fa-tags' : d.type === 'subaccount' ? 'fa-user-shield' : d.type === 'salary' ? 'fa-money-bill-wave' : d.type === 'à¦¨à§‹à¦Ÿ' ? 'fa-bookmark' : 'fa-file'}"></i></td>
                  <td style="font-size:.78rem;color:var(--text-muted)">${d.tableLabel || d.table || 'â€”'}</td>
                  <td><span class="badge badge-muted">${d.type || 'item'}</span></td>
                  <td style="font-size:.85rem">${d.name || d.data?.description || d.data?.id || 'â€”'}</td>
                  <td style="font-size:.78rem;color:var(--text-muted)">${d.deletedAt ? new Date(d.deletedAt).toLocaleString() : 'â€”'}</td>
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 7: SYNC DIAGNOSTIC
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelSync() {
    return `
    <div class="settings-panel ${activeTab === 'sync' ? 'active' : ''}" data-panel="sync">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-bolt"></i> System Diagnostic Center</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px">Verify data integrity, sync health, and cloud row counts in one place.</p>
      </div>

      <div class="settings-card glow-green">
        <div class="settings-card-title"><i class="fa fa-heart-pulse" style="color:var(--error)"></i> AUTO-HEAL ENGINE</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:.85rem;color:var(--text-secondary)">Scans all tables for corrupt rows (missing <code>id</code>) and removes them. Run manually anytime.</span>
          <button class="btn btn-success btn-sm" onclick="SettingsModule.runAutoHeal()"><i class="fa fa-bolt"></i> Run now</button>
        </div>
        <div class="diag-stats" id="diag-heal-stats">
          <div class="diag-stat-box green"><div class="label">Records scanned</div><div class="value" id="heal-total">0</div></div>
          <div class="diag-stat-box blue"><div class="label">Auto fix</div><div class="value" id="heal-fixed">0</div></div>
          <div class="diag-stat-box blue"><div class="label">Last run</div><div class="value" id="heal-last">â€”</div></div>
          <div class="diag-stat-box red"><div class="label">Last fix</div><div class="value" id="heal-lastfix">â€”</div></div>
        </div>
        <div style="margin-top:10px">
          <div class="settings-label" style="font-size:.78rem"><i class="fa fa-wrench"></i> HEAL LOG</div>
          <div id="heal-log-output" style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);min-height:40px;border:1px solid var(--border)">
            Run Auto-Heal to see the log here.
          </div>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-database"></i> SYNC &amp; DATA CHECK</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.85rem;color:var(--text-secondary)">Validates IDs locally and compares row counts to Supabase (mismatch = pending push/pull or conflict).</span>
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.runSyncCheck()"><i class="fa fa-magnifying-glass"></i> Run check</button>
        </div>
        <div id="sync-check-output" style="margin-top:10px;font-size:.82rem;color:var(--text-muted)"></div>
      </div>

      <div class="settings-card glow-purple">
        <div class="settings-card-title"><i class="fa fa-cloud"></i> Cloud Sync (Real-time)</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px">
          Supabase real-time sync is active. All changes are automatically synced.
        </p>
        <div id="sync-diag-result" style="display:none;margin-bottom:10px;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button id="btn-sync-pull" type="button" class="btn btn-primary btn-sm" onclick="SettingsModule.runCloudPullDiag()">â¬‡ Sync (retry + pull)</button>
          <button id="btn-push-cloud" type="button" class="btn btn-accent btn-sm" onclick="SettingsModule.runCloudPushDiag()">â¬† Push to Cloud</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.startRealtime(); Utils.toast('Real-time à¦šà¦¾à¦²à§ âœ…','success')">ðŸŸ¢ Real-time On</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.stopRealtime(); Utils.toast('Real-time à¦¬à¦¨à§à¦§','info')">ðŸ”´ Real-time Off</button>
        </div>
        <div style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
          <strong>Device ID:</strong> <code>${typeof SupabaseSync !== 'undefined' ? SupabaseSync._deviceId() : 'â€”'}</code>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-scale-balanced"></i> FEE RECONCILIATION</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          à¦¯à¦¦à¦¿ à¦•à§‹à¦¨à§‹ Student-à¦à¦° <strong style="color:#00ff88">Paid</strong> à¦¬à¦¾ <strong style="color:#ff4757">Due</strong> amount 
          Finance Ledger-à¦à¦° à¦¸à¦¾à¦¥à§‡ à¦®à¦¿à¦²à¦›à§‡ à¦¨à¦¾, à¦à¦‡ à¦¬à¦¾à¦Ÿà¦¨à¦Ÿà¦¿ à¦¸à¦¬ à¦ à¦¿à¦• à¦•à¦°à§‡ à¦¦à§‡à¦¬à§‡à¥¤<br/>
          <span style="font-size:.78rem;color:var(--text-muted);">âš ï¸ à¦à¦Ÿà¦¿ à¦¶à§à¦§à§ mismatch fix à¦•à¦°à§‡ â€” à¦•à§‹à¦¨à§‹ payment delete à¦¬à¦¾ add à¦•à¦°à§‡ à¦¨à¦¾à¥¤</span>
        </p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm"
                  style="background:linear-gradient(90deg,#00d9ff,#b537f2);border:none;padding:10px 20px;font-weight:800;"
                  onclick="if(typeof Students!=='undefined')Students.reconcileAllStudents();else Utils.toast('Students module not loaded','error')">
            <i class="fa fa-scale-balanced"></i> Run Fee Reconciliation
          </button>
          <span style="font-size:.78rem;color:var(--text-muted);">
            <i class="fa fa-circle-info"></i> Finance ledger = source of truth
          </span>
        </div>
      </div>
    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 8: KEEP RECORD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelKeepRecord() {
    const notes = getKeepRecords();
    const tags  = [...new Set(notes.flatMap(n => n.tags || []))].filter(Boolean);
    const colorMap = { red:'#ff4757', green:'#00ff88', blue:'#00d9ff', yellow:'#ffd700', purple:'#b537f2', orange:'#ff6b35' };
    const bgMap    = { red:'rgba(255,71,87,0.10)', green:'rgba(0,255,136,0.08)', blue:'rgba(0,217,255,0.08)', yellow:'rgba(255,215,0,0.08)', purple:'rgba(181,55,242,0.10)', orange:'rgba(255,107,53,0.10)' };
    const borderMap = { red:'rgba(255,71,87,0.30)', green:'rgba(0,255,136,0.25)', blue:'rgba(0,217,255,0.25)', yellow:'rgba(255,215,0,0.25)', purple:'rgba(181,55,242,0.30)', orange:'rgba(255,107,53,0.25)' };

    return `
    <div class="settings-panel ${activeTab === 'keeprecord' ? 'active' : ''}" data-panel="keeprecord">
      <div class="settings-card glow-purple" style="padding:0;overflow:hidden">

        <!-- Header -->
        <div style="padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="settings-card-title" style="margin-bottom:3px;color:#b537f2"><i class="fa fa-bookmark"></i> KEEP RECORD</div>
            <div style="font-size:.78rem;color:var(--text-muted)">à¦¬à§à¦¯à¦•à§à¦¤à¦¿à¦—à¦¤ à¦¨à§‹à¦Ÿ à¦“ à¦°à§‡à¦•à¦°à§à¦¡ â€” à¦¤à¦¾à¦°à¦¿à¦– à¦…à¦¨à§à¦¯à¦¾à¦¯à¦¼à§€ à¦¸à§‡à¦­ à¦¥à¦¾à¦•à§‡</div>
          </div>
          <button class="btn btn-sm" onclick="SettingsModule.addNote()"
            style="background:linear-gradient(135deg,#b537f2,#7c3aed);color:#fff;border:none;padding:9px 18px;border-radius:25px;font-weight:700;font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 0 16px rgba(181,55,242,0.4)">
            <i class="fa fa-plus"></i> + à¦¨à¦¤à§à¦¨ à¦¨à§‹à¦Ÿ
          </button>
        </div>

        <!-- Filter Bar -->
        <div style="padding:14px 22px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(0,0,0,0.15)">
          <!-- Date Range Filter -->
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:.75rem;color:rgba(255,255,255,0.4);white-space:nowrap">ðŸ“… à¦¥à§‡à¦•à§‡</span>
            <input type="date" id="kr-date-from" class="form-control" style="width:145px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()" />
            <span style="font-size:.75rem;color:rgba(255,255,255,0.4);white-space:nowrap">à¦ªà¦°à§à¦¯à¦¨à§à¦¤</span>
            <input type="date" id="kr-date-to" class="form-control" style="width:145px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()" />
          </div>
          <select id="kr-tag-filter" class="form-control" style="width:140px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()">
            <option value="">à¦¸à¦¬ à¦Ÿà§à¦¯à¦¾à¦—</option>
            ${tags.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <div style="flex:1;min-width:150px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 10px">
            <i class="fa fa-search" style="color:rgba(255,255,255,0.35);font-size:.82rem"></i>
            <input type="text" id="kr-search" placeholder="à¦¸à¦¾à¦°à§à¦š à¦•à¦°à§à¦¨..." style="background:none;border:none;outline:none;color:#fff;font-size:.85rem;width:100%;font-family:var(--font-ui)" oninput="SettingsModule.filterNotes()" />
          </div>
          <button onclick="SettingsModule.clearNoteFilters()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.55);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.8rem">âœ• à¦•à§à¦²à¦¿à¦¯à¦¼à¦¾à¦°</button>
        </div>
        <!-- Notes Grid -->
        <div id="kr-notes-grid" style="padding:18px 22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;max-height:520px;overflow-y:auto">
          ${notes.length === 0
            ? `<div style="grid-column:1/-1;text-align:center;padding:60px 20px">
                <i class="fa fa-flag" style="font-size:2.5rem;color:#b537f2;opacity:.4;display:block;margin-bottom:14px"></i>
                <div style="color:var(--text-muted);font-size:.9rem;margin-bottom:8px">à¦•à§‹à¦¨à§‹ à¦¨à§‹à¦Ÿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿</div>
                <div style="color:#00ff88;font-size:.82rem">à¦¨à¦¤à§à¦¨ à¦¨à§‹à¦Ÿ à¦¯à§‹à¦— à¦•à¦°à¦¤à§‡ à¦‰à¦ªà¦°à§‡à¦° à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§à¦¨</div>
              </div>`
            : notes.map((n, i) => {
                const c = n.color || 'blue';
                const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
                return `
                <div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                  ${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700" title="Pinned">ðŸ“Œ</div>' : ''}
                  <button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">âœï¸</button>
                  <button onclick="SettingsModule.deleteNote(${i})" title="Delete â†’ Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">âœ•</button>
                  <div style="font-weight:700;color:${colorMap[c]||colorMap.blue};font-size:.92rem;margin-bottom:8px;padding-right:28px;line-height:1.3">${Utils.esc(n.title||'Untitled')}</div>
                  ${n.content ? `<div style="font-size:.82rem;color:rgba(255,255,255,0.72);line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${Utils.esc(n.content)}</div>` : ''}
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">
                    <div style="display:flex;gap:5px;flex-wrap:wrap">
                      ${(n.tags||[]).map(t=>`<span style="font-size:.68rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:10px;padding:2px 8px">${Utils.esc(t)}</span>`).join('')}
                    </div>
                    <span style="font-size:.7rem;color:rgba(255,255,255,0.3)">${n.date||''}</span>
                  </div>
                </div>`;
              }).join('')
          }
        </div>

        ${notes.length > 0 ? `<div style="padding:10px 22px 14px;border-top:1px solid rgba(255,255,255,0.05);text-align:right;font-size:.75rem;color:var(--text-muted)">${notes.length} à¦Ÿà¦¿ à¦¨à§‹à¦Ÿ à¦¸à¦‚à¦°à¦•à§à¦·à¦¿à¦¤</div>` : ''}
      </div>
    </div>`;
  }

  function filterNotes() {
    const dateFrom  = document.getElementById('kr-date-from')?.value || '';
    const dateTo    = document.getElementById('kr-date-to')?.value || '';
    const tagVal    = document.getElementById('kr-tag-filter')?.value || '';
    const searchVal = (document.getElementById('kr-search')?.value || '').toLowerCase();
    const colorMap  = { red:'#ff4757', green:'#00ff88', blue:'#00d9ff', yellow:'#ffd700', purple:'#b537f2', orange:'#ff6b35' };
    const bgMap     = { red:'rgba(255,71,87,0.10)', green:'rgba(0,255,136,0.08)', blue:'rgba(0,217,255,0.08)', yellow:'rgba(255,215,0,0.08)', purple:'rgba(181,55,242,0.10)', orange:'rgba(255,107,53,0.10)' };
    const borderMap = { red:'rgba(255,71,87,0.30)', green:'rgba(0,255,136,0.25)', blue:'rgba(0,217,255,0.25)', yellow:'rgba(255,215,0,0.25)', purple:'rgba(181,55,242,0.30)', orange:'rgba(255,107,53,0.25)' };

    // Parse note date (DD/MM/YYYY) to YYYY-MM-DD for comparison
    function parseNoteDate(d) {
      if (!d) return '';
      const parts = d.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      return d; // fallback if already ISO
    }

    let notes = getKeepRecords();
    if (dateFrom) notes = notes.filter(n => { const nd = parseNoteDate(n.date); return nd && nd >= dateFrom; });
    if (dateTo)   notes = notes.filter(n => { const nd = parseNoteDate(n.date); return nd && nd <= dateTo; });
    if (tagVal)   notes = notes.filter(n => (n.tags||[]).includes(tagVal));
    if (searchVal) notes = notes.filter(n =>
      (n.title||'').toLowerCase().includes(searchVal) ||
      (n.content||'').toLowerCase().includes(searchVal)
    );

    const grid = document.getElementById('kr-notes-grid');
    if (!grid) return;
    if (notes.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><i class="fa fa-search" style="font-size:1.8rem;opacity:.3;display:block;margin-bottom:10px"></i>à¦•à§‹à¦¨à§‹ à¦¨à§‹à¦Ÿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿</div>`;
      return;
    }
    const allNotes = getKeepRecords();
    grid.innerHTML = notes.map(n => {
      const i = allNotes.findIndex(x => x.date === n.date && x.title === n.title);
      const c = n.color || 'blue';
      const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
      return `
        <div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          ${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700">ðŸ“Œ</div>' : ''}
          <button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">âœï¸</button>
          <button onclick="SettingsModule.deleteNote(${i})" title="Delete â†’ Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">âœ•</button>
          <div style="font-weight:700;color:${colorMap[c]||colorMap.blue};font-size:.92rem;margin-bottom:8px;padding-right:28px;line-height:1.3">${Utils.esc(n.title||'Untitled')}</div>
          ${n.content ? `<div style="font-size:.82rem;color:rgba(255,255,255,0.72);line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${Utils.esc(n.content)}</div>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              ${(n.tags||[]).map(t=>`<span style="font-size:.68rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:10px;padding:2px 8px">${Utils.esc(t)}</span>`).join('')}
            </div>
            <span style="font-size:.7rem;color:rgba(255,255,255,0.3)">${n.date||''}</span>
          </div>
        </div>`;
    }).join('');
  }

  function clearNoteFilters() {
    const df = document.getElementById('kr-date-from');  if(df) df.value = '';
    const dt = document.getElementById('kr-date-to');    if(dt) dt.value = '';
    const t  = document.getElementById('kr-tag-filter'); if(t)  t.value  = '';
    const s  = document.getElementById('kr-search');     if(s)  s.value  = '';
    filterNotes();
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 9: BATCH PROFIT  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 9: BATCH PROFIT REPORT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelBatchProfit() {
    const students = SupabaseSync.getAll(DB.students);
    const _finance  = SupabaseSync.getAll(DB.finance);
    const batches  = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();

    // Default date range: last 30 days
    const today    = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    return `
    <div class="settings-panel ${activeTab === 'batchprofit' ? 'active' : ''}" data-panel="batchprofit">
      <div class="settings-card glow-red">
        <div class="settings-card-title" style="font-size:1.1rem;margin-bottom:16px">
          <i class="fa fa-chart-line"></i> Generate Batch Wise Profit &amp; Loss
        </div>

        <!-- Filter Row -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px;">
          <div class="form-group" style="margin:0">
            <label class="settings-label">SELECT BATCH</label>
            <select id="bp-batch" class="form-control">
              <option value="">Choose Batch...</option>
              ${batches.map(b => `<option value="${b}">${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="settings-label">EXPENSE START DATE</label>
            <div style="position:relative;display:flex;align-items:center;">
              <input type="text" id="bp-start" class="form-control" readonly
                placeholder="DD/MM/YYYY" autocomplete="off"
                style="cursor:pointer;padding-right:38px;"
                value="${(function(){var d=new Date(monthAgo);return (d.getDate()+'').padStart(2,'0')+'/'+(d.getMonth()+1+'').padStart(2,'0')+'/'+d.getFullYear();})()}" />
              <i class="fa fa-calendar-days" style="position:absolute;right:12px;color:var(--brand-primary);font-size:0.9rem;pointer-events:none;"></i>
            </div>
            <input type="hidden" id="bp-start-raw" value="${monthAgo}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="settings-label">EXPENSE END DATE</label>
            <div style="position:relative;display:flex;align-items:center;">
              <input type="text" id="bp-end" class="form-control" readonly
                placeholder="DD/MM/YYYY" autocomplete="off"
                style="cursor:pointer;padding-right:38px;"
                value="${(function(){var d=new Date(today);return (d.getDate()+'').padStart(2,'0')+'/'+(d.getMonth()+1+'').padStart(2,'0')+'/'+d.getFullYear();})()}" />
              <i class="fa fa-calendar-days" style="position:absolute;right:12px;color:var(--brand-primary);font-size:0.9rem;pointer-events:none;"></i>
            </div>
            <input type="hidden" id="bp-end-raw" value="${today}" />
          </div>
        </div>
        <!-- flatpickr is initialized via _initSettingsDatePickers() on tab switch -->

        <!-- Previous Balance row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;align-items:flex-end;">
          <div class="form-group" style="margin:0">
            <label class="settings-label">PREVIOUS BALANCE / PROFIT / DUE (MANUAL)</label>
            <div style="display:flex;align-items:center;gap:0;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;overflow:hidden;">
              <span style="padding:10px 14px;font-size:1rem;color:var(--brand-primary);font-weight:700;border-right:1px solid rgba(255,255,255,0.1);">à§³</span>
              <input type="number" id="bp-prev" class="form-control" value="0" placeholder="0.00"
                style="border:none;background:transparent;border-radius:0;flex:1;" />
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">à¦ªà§‚à¦°à§à¦¬à§‡à¦° à¦•à§‹à¦¨à§‹ à¦¡à¦¿à¦‰ à¦¬à¦¾ à¦œà¦®à¦¾à¦¨à§‹ à¦²à¦¾à¦­ à¦¥à¦¾à¦•à¦²à§‡ à¦²à¦¿à¦–à§à¦¨</div>
          </div>
          <div>
            <button onclick="SettingsModule.renderBatchReport()"
              style="width:100%;padding:14px 24px;background:linear-gradient(90deg,#00d9ff,#b537f2);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:filter 0.2s;"
              onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter=''">
              <i class="fa fa-calculator"></i>&nbsp; GENERATE PROFIT REPORT
            </button>
          </div>
        </div>

        <!-- Report Output Area -->
        <div id="bp-report-area">
          <div style="text-align:center;padding:48px 0;color:var(--text-muted);">
            <i class="fa fa-chart-bar" style="font-size:3rem;opacity:0.25;display:block;margin-bottom:12px;"></i>
            Select criteria and click generate to view report
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderBatchReport() {
    const batch   = document.getElementById('bp-batch')?.value || '';
    // Flatpickr hidden raw values (YYYY-MM-DD)
    const start   = document.getElementById('bp-start-raw')?.value ||
                    document.getElementById('bp-start')?.value || '';
    const end     = document.getElementById('bp-end-raw')?.value ||
                    document.getElementById('bp-end')?.value || '';
    const prevBal = parseFloat(document.getElementById('bp-prev')?.value || 0) || 0;

    const students = SupabaseSync.getAll(DB.students);
    const finance  = SupabaseSync.getAll(DB.finance);
    const container = document.getElementById('bp-report-area');
    if (container) container.innerHTML = buildBatchReport(students, finance, batch, start, end, prevBal);
  }

  function buildBatchReport(students, finance, selectedBatch, startDate, endDate, prevBalance) {
    prevBalance = parseFloat(prevBalance) || 0;

    // â”€â”€ Students filtered by batch â”€â”€
    const batchStudents = selectedBatch
      ? students.filter(s => s.batch === selectedBatch)
      : students;

    // Get student IDs for finance lookup
    const _studentIds = new Set(batchStudents.map(s => s.id || s.student_id));

    // â”€â”€ Income: from student fees (finance entries for these students) â”€â”€
    // Also count direct paid from student records
    const totalStudentFee  = batchStudents.reduce((s, st) => s + (parseFloat(st.total_fee) || 0), 0);
    const totalCollected   = batchStudents.reduce((s, st) => s + (parseFloat(st.paid) || 0), 0);
    const totalDue         = batchStudents.reduce((s, st) => s + (parseFloat(st.due) || 0), 0);

    // â”€â”€ Expenses: by date range (batch-tagged or general) â”€â”€
    const expenseEntries = finance.filter(f => {
      if (f.type !== 'Expense') return false;
      if (f.category === 'Balance Adjustment') return false; // excluded from batch reports
      const inRange = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      if (!inRange) return false;
      if (!selectedBatch) return true;
      // Include expenses tagged to this batch OR untagged general expenses
      return !f.batch || f.batch === selectedBatch;
    });

    const totalExpense = expenseEntries.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    // â”€â”€ Income = ALL collected fees from batch students (NO date filter) â”€â”€
    // Date range applies to EXPENSES only, not income.
    // Students in a batch enroll at different times, so all-time collected is the correct income figure.
    const grossIncome = totalCollected;  // from batchStudents.reduce paid
    const netProfit   = grossIncome - totalExpense + prevBalance;
    const isProfit    = netProfit >= 0;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const academyName = cfg.academy_name || 'Wings Fly Aviation Academy';
    const reportDate  = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // â”€â”€ Expense breakdown by category â”€â”€
    const expCats = {};
    expenseEntries.forEach(f => {
      const cat = f.category || 'General';
      if (!expCats[cat]) expCats[cat] = 0;
      expCats[cat] += parseFloat(f.amount) || 0;
    });

    // â”€â”€ Store data for export â”€â”€
    window._bpReportData = {
      batch: selectedBatch || 'All Batches', startDate, endDate, prevBalance,
      batchStudents, expenseEntries,
      totalStudentFee, totalCollected, totalDue, totalExpense,
      grossIncome, netProfit,
      academyName, reportDate
    };

    return `
      <!-- Action Buttons -->
      <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
        <button onclick="SettingsModule.printBatchReport()"
          style="padding:9px 20px;background:linear-gradient(90deg,#1a3a6b,#0099cc);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;">
          <i class="fa fa-print"></i> à¦ªà§à¦°à¦¿à¦¨à§à¦Ÿ à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ
        </button>
        <button onclick="SettingsModule.exportBatchReportExcel()"
          style="padding:9px 20px;background:linear-gradient(90deg,#1a7a1a,#4caf50);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;">
          <i class="fa fa-file-excel"></i> Excel Export
        </button>
        <span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);align-self:center;">
          à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ à¦¤à§ˆà¦°à¦¿: ${reportDate} &nbsp;|&nbsp; ${selectedBatch || 'à¦¸à¦•à¦² Batch'}
          ${startDate ? ` &nbsp;|&nbsp; ${Utils.formatDateEN(startDate)} â†’ ${Utils.formatDateEN(endDate)}` : ''}
        </span>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
        ${bpCard('fa-users', '#00d9ff', 'à¦®à§‹à¦Ÿ à¦›à¦¾à¦¤à§à¦°', batchStudents.length, '')}
        ${bpCard('fa-money-bill-wave', '#ffd700', 'à¦®à§‹à¦Ÿ à¦•à§‹à¦°à§à¦¸ à¦«à¦¿', 'à§³' + totalStudentFee.toLocaleString('en-IN'), '')}
        ${bpCard('fa-circle-check', '#00ff88', 'à¦¸à¦‚à¦—à§ƒà¦¹à§€à¦¤ à¦«à¦¿', 'à§³' + totalCollected.toLocaleString('en-IN'), 'green')}
        ${bpCard('fa-circle-xmark', '#ff4757', 'à¦¬à¦¾à¦•à¦¿ à¦¡à¦¿à¦‰', 'à§³' + totalDue.toLocaleString('en-IN'), 'red')}
        ${bpCard('fa-receipt', '#ff9a00', 'à¦®à§‹à¦Ÿ à¦–à¦°à¦š', 'à§³' + totalExpense.toLocaleString('en-IN'), 'orange')}
        ${bpCard(isProfit ? 'fa-trending-up' : 'fa-trending-down', isProfit ? '#00ff88' : '#ff4757',
          isProfit ? 'à¦¨à¦¿à¦Ÿ à¦®à§à¦¨à¦¾à¦«à¦¾' : 'à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿',
          'à§³' + Math.abs(netProfit).toLocaleString('en-IN'),
          isProfit ? 'green' : 'red')}
      </div>

      <!-- P&L Summary Box -->
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;margin-bottom:20px;">
        <div style="font-weight:800;color:var(--brand-primary);font-size:0.9rem;letter-spacing:1px;margin-bottom:14px;border-left:4px solid var(--brand-primary);padding-left:10px;">
          ðŸ“Š à¦²à¦¾à¦­-à¦•à§à¦·à¦¤à¦¿ à¦¹à¦¿à¦¸à¦¾à¦¬ à¦¸à¦¾à¦°à¦¾à¦‚à¦¶ (P&amp;L Statement)
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Income Side -->
          <div>
            <div style="font-weight:700;color:#00ff88;margin-bottom:10px;font-size:0.85rem;border-bottom:1px solid rgba(0,255,136,0.2);padding-bottom:6px;">
              âœ¦ à¦†à¦¯à¦¼ (Income)
            </div>
            ${plRow('à¦¬à§à¦¯à¦¾à¦šà§‡à¦° à¦®à§‹à¦Ÿ à¦¸à¦‚à¦—à§ƒà¦¹à§€à¦¤ à¦«à¦¿ (à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£)', totalCollected, '#00ff88')}
            ${prevBalance !== 0 ? plRow('à¦ªà§‚à¦°à§à¦¬à¦¬à¦°à§à¦¤à§€ à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸', prevBalance, prevBalance >= 0 ? '#00ff88' : '#ff4757') : ''}
            <div style="border-top:1.5px solid rgba(0,255,136,0.3);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;">
              <span style="color:#fff;">à¦®à§‹à¦Ÿ à¦†à¦¯à¦¼</span>
              <span style="color:#00ff88;">à§³${grossIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <!-- Expense Side -->
          <div>
            <div style="font-weight:700;color:#ff4757;margin-bottom:10px;font-size:0.85rem;border-bottom:1px solid rgba(255,71,87,0.2);padding-bottom:6px;">
              âœ¦ à¦¬à§à¦¯à¦¯à¦¼ (Expense)
            </div>
            ${Object.entries(expCats).map(([cat, amt]) => plRow(cat, amt, '#ff9a00')).join('')}
            ${Object.keys(expCats).length === 0 ? `<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0;">à¦à¦‡ à¦¤à¦¾à¦°à¦¿à¦– à¦¸à§€à¦®à¦¾à¦¯à¦¼ à¦•à§‹à¦¨à§‹ à¦¬à§à¦¯à¦¯à¦¼ à¦¨à§‡à¦‡</div>` : ''}
            <div style="border-top:1.5px solid rgba(255,71,87,0.3);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;">
              <span style="color:#fff;">à¦®à§‹à¦Ÿ à¦¬à§à¦¯à¦¯à¦¼</span>
              <span style="color:#ff4757;">à§³${totalExpense.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- Net Result -->
        <div style="margin-top:16px;padding:14px 20px;background:${isProfit ? 'rgba(0,255,136,0.1)' : 'rgba(255,71,87,0.1)'};border:2px solid ${isProfit ? 'rgba(0,255,136,0.4)' : 'rgba(255,71,87,0.4)'};border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:1.05rem;font-weight:800;color:#fff;">${isProfit ? 'âœ… à¦¨à¦¿à¦Ÿ à¦®à§à¦¨à¦¾à¦«à¦¾ (Net Profit)' : 'âŒ à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿ (Net Loss)'}</span>
          <span style="font-size:1.4rem;font-weight:900;color:${isProfit ? '#00ff88' : '#ff4757'};">
            ${isProfit ? '+' : '-'}à§³${Math.abs(netProfit).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <!-- Student-wise Table -->
      <div style="margin-bottom:20px;">
        <div style="font-weight:800;color:var(--brand-primary);font-size:0.85rem;letter-spacing:1px;margin-bottom:10px;border-left:4px solid var(--brand-primary);padding-left:10px;">
          ðŸ‘¨â€ðŸŽ“ à¦›à¦¾à¦¤à§à¦° à¦­à¦¿à¦¤à§à¦¤à¦¿à¦• à¦¬à¦¿à¦¬à¦°à¦£
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>à¦›à¦¾à¦¤à§à¦°à§‡à¦° à¦¨à¦¾à¦®</th>
                <th>Student ID</th>
                <th>Batch</th>
                <th>à¦•à§‹à¦°à§à¦¸</th>
                <th>à¦®à§‹à¦Ÿ à¦«à¦¿</th>
                <th>à¦ªà¦°à¦¿à¦¶à§‹à¦§à¦¿à¦¤</th>
                <th>à¦¬à¦¾à¦•à¦¿</th>
                <th>à¦…à¦¬à¦¸à§à¦¥à¦¾</th>
              </tr>
            </thead>
            <tbody>
              ${batchStudents.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:16px;">à¦•à§‹à¦¨à§‹ à¦›à¦¾à¦¤à§à¦° à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿</td></tr>' :
                batchStudents.map((s, i) => {
                  const fee  = parseFloat(s.total_fee) || 0;
                  const paid = parseFloat(s.paid) || 0;
                  const due  = parseFloat(s.due) || Math.max(0, fee - paid);
                  const pct  = fee > 0 ? Math.round((paid / fee) * 100) : 0;
                  return `<tr>
                    <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
                    <td><strong>${Utils.esc(s.name) || 'â€”'}</strong></td>
                    <td><span class="badge badge-primary">${Utils.esc(s.student_id) || 'â€”'}</span></td>
                    <td>${Utils.esc(s.batch) || 'â€”'}</td>
                    <td style="font-size:0.82rem;color:var(--text-secondary);">${Utils.esc(s.course) || 'â€”'}</td>
                    <td style="font-weight:700;color:var(--brand-primary);">à§³${fee.toLocaleString('en-IN')}</td>
                    <td style="font-weight:700;color:#00ff88;">à§³${paid.toLocaleString('en-IN')}</td>
                    <td style="font-weight:700;color:${due > 0 ? '#ff4757' : 'var(--text-muted)'};">à§³${due.toLocaleString('en-IN')}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:50px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                          <div style="width:${pct}%;height:100%;background:${pct>=100?'#00ff88':pct>=50?'#ffd700':'#ff4757'};border-radius:3px;"></div>
                        </div>
                        <span style="font-size:0.75rem;font-weight:700;color:${pct>=100?'#00ff88':pct>=50?'#ffd700':'#ff4757'}">${pct}%</span>
                      </div>
                    </td>
                  </tr>`;
                }).join('')
              }
            </tbody>
            ${batchStudents.length > 0 ? `
            <tfoot>
              <tr style="background:rgba(0,0,0,0.4);font-weight:800;">
                <td colspan="5" style="text-align:right;padding:10px;color:var(--brand-primary);letter-spacing:0.5px;">à¦®à§‹à¦Ÿ à¦¸à¦¾à¦°à¦¾à¦‚à¦¶:</td>
                <td style="color:#ffd700;padding:10px;">à§³${totalStudentFee.toLocaleString('en-IN')}</td>
                <td style="color:#00ff88;padding:10px;">à§³${totalCollected.toLocaleString('en-IN')}</td>
                <td style="color:#ff4757;padding:10px;">à§³${totalDue.toLocaleString('en-IN')}</td>
                <td></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>

      <!-- Expense Detail Table -->
      ${expenseEntries.length > 0 ? `
      <div>
        <div style="font-weight:800;color:#ff9a00;font-size:0.85rem;letter-spacing:1px;margin-bottom:10px;border-left:4px solid #ff9a00;padding-left:10px;">
          ðŸ’¸ à¦–à¦°à¦šà§‡à¦° à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤ (${startDate ? Utils.formatDateEN(startDate) : 'â€”'} à¦¥à§‡à¦•à§‡ ${endDate ? Utils.formatDateEN(endDate) : 'â€”'})
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>à¦¤à¦¾à¦°à¦¿à¦–</th><th>à¦¬à¦¿à¦¬à¦°à¦£</th><th>à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿</th><th>à¦ªà¦¦à§à¦§à¦¤à¦¿</th><th style="text-align:right;">à¦ªà¦°à¦¿à¦®à¦¾à¦£</th>
              </tr>
            </thead>
            <tbody>
              ${expenseEntries.sort((a,b) => a.date > b.date ? 1 : -1).map((f, i) => {
                const personStr = (f.person_name || f.person) ? `<strong style="color:var(--brand-primary)">[${Utils.esc(f.person_name || f.person)}]</strong> ` : '';
                return `
                <tr>
                  <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
                  <td style="white-space:nowrap;">${Utils.formatDateEN(f.date) || 'â€”'}</td>
                  <td>${personStr}${Utils.esc(f.description) || 'â€”'}</td>
                  <td><span class="badge badge-secondary">${Utils.esc(f.category) || 'General'}</span></td>
                  <td>${Utils.esc(f.method) || 'â€”'}</td>
                  <td style="text-align:right;font-weight:700;color:#ff9a00;">à§³${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
                </tr>
              `}).join('')}
            </tbody>
            <tfoot>
              <tr style="background:rgba(0,0,0,0.4);font-weight:800;">
                <td colspan="5" style="text-align:right;padding:10px;color:#ff9a00;">à¦®à§‹à¦Ÿ à¦–à¦°à¦š:</td>
                <td style="text-align:right;color:#ff4757;padding:10px;">à§³${totalExpense.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>` : ''}
    `;
  }

  function bpCard(icon, color, label, value, glow) {
    const glowMap = { green: 'rgba(0,255,136,0.15)', red: 'rgba(255,71,87,0.15)', orange: 'rgba(255,154,0,0.15)' };
    const bg = glowMap[glow] || 'rgba(0,0,0,0.25)';
    return `
      <div style="background:${bg};border:1px solid ${color}30;border-radius:10px;padding:14px;text-align:center;">
        <i class="fa ${icon}" style="color:${color};font-size:1.2rem;margin-bottom:8px;display:block;"></i>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">${label}</div>
        <div style="font-size:1.15rem;font-weight:900;color:${color};">${value}</div>
      </div>`;
  }

  function plRow(label, amount, color) {
    return `
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="color:var(--text-secondary);font-size:0.83rem;">${label}</span>
        <span style="font-weight:700;color:${color};font-size:0.83rem;">à§³${(parseFloat(amount)||0).toLocaleString('en-IN')}</span>
      </div>`;
  }

  function printBatchReport() {
    const d = window._bpReportData;
    if (!d) { if (typeof Utils !== 'undefined') Utils.toast('à¦†à¦—à§‡ à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ Generate à¦•à¦°à§à¦¨', 'warn'); return; }

    const { batch, startDate, endDate, prevBalance,
            batchStudents, expenseEntries,
            totalStudentFee, totalCollected, totalDue,
            totalExpense, otherIncome, grossIncome, netProfit,
            academyName, reportDate } = d;

    const isProfit = netProfit >= 0;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const logoUrl = cfg.logo_url || '';
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:56px;object-fit:contain;" />`
      : `<div style="width:56px;height:56px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#fff;">âœˆ</div>`;

    const expCats = {};
    expenseEntries.forEach(f => {
      const cat = f.category || 'General';
      if (!expCats[cat]) expCats[cat] = 0;
      expCats[cat] += parseFloat(f.amount) || 0;
    });

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<title>Batch Profit Report â€” ${batch}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10px; color:#111; background:#fff; }

  .header { display:flex; align-items:center; gap:14px; border-bottom:3px solid #1a3a6b; padding-bottom:10px; margin-bottom:14px; }
  .header-info h1 { font-size:15px; font-weight:900; color:#1a3a6b; letter-spacing:0.5px; }
  .header-info .sub { font-size:8.5px; color:#555; margin-top:2px; }
  .header-meta { text-align:right; font-size:8.5px; color:#555; margin-left:auto; }
  .header-meta .big { font-size:12px; font-weight:800; color:#1a3a6b; }

  .title-bar { background:#1a3a6b; color:#fff; padding:8px 14px; border-radius:5px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
  .title-bar h2 { font-size:11px; font-weight:800; letter-spacing:1px; }

  .kpi-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
  .kpi-box { border-radius:8px; padding:10px; text-align:center; }
  .kpi-box .k-label { font-size:7.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.7px; margin-bottom:4px; }
  .kpi-box .k-value { font-size:14px; font-weight:900; }
  .kpi-income  { background:#f0fdf4; border:1.5px solid #86efac; color:#15803d; }
  .kpi-expense { background:#fef2f2; border:1.5px solid #fca5a5; color:#b91c1c; }
  .kpi-profit  { background:#f0fdf4; border:2px solid #16a34a; color:#15803d; }
  .kpi-loss    { background:#fef2f2; border:2px solid #dc2626; color:#b91c1c; }
  .kpi-blue    { background:#eff6ff; border:1.5px solid #93c5fd; color:#1d4ed8; }
  .kpi-yellow  { background:#fefce8; border:1.5px solid #fde047; color:#854d0e; }
  .kpi-orange  { background:#fff7ed; border:1.5px solid #fdba74; color:#c2410c; }

  .pl-section { border:1.5px solid #e0e0e0; border-radius:8px; padding:12px; margin-bottom:14px; }
  .pl-title { font-size:10px; font-weight:800; color:#1a3a6b; margin-bottom:8px; border-left:3px solid #1a3a6b; padding-left:8px; }
  .pl-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .pl-col-title { font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:5px; border-bottom:1.5px solid #e0e0e0; margin-bottom:6px; }
  .pl-row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #f0f0f0; font-size:9px; }
  .pl-total { display:flex; justify-content:space-between; padding:6px 0 0; font-weight:800; font-size:10px; border-top:2px solid #1a3a6b; margin-top:4px; }
  .pl-net { margin-top:10px; padding:10px 14px; border-radius:7px; display:flex; justify-content:space-between; align-items:center; }
  .pl-net-profit { background:#f0fdf4; border:2px solid #86efac; }
  .pl-net-loss   { background:#fef2f2; border:2px solid #fca5a5; }
  .pl-net .label { font-weight:800; font-size:11px; }
  .pl-net .amount { font-weight:900; font-size:15px; }

  table { width:100%; border-collapse:collapse; font-size:9px; margin-bottom:14px; }
  thead tr { background:#1a3a6b; color:#fff; }
  thead th { padding:6px 5px; font-weight:700; border:1px solid #0d2a55; text-align:left; }
  tbody tr { border-bottom:1px solid #e5e7eb; }
  tbody tr:nth-child(even) { background:#f7f9ff; }
  tbody td { padding:5px; border:1px solid #e5e7eb; }
  tfoot tr { background:#f0f0f0; }
  tfoot td { padding:6px 5px; font-weight:800; border:1px solid #ddd; }

  .section-title { font-size:9.5px; font-weight:800; color:#1a3a6b; border-left:3px solid #0099cc; padding-left:7px; margin-bottom:7px; }
  .footer { margin-top:16px; display:flex; justify-content:space-between; border-top:1px solid #ccc; padding-top:10px; }
  .sig-box { text-align:center; }
  .sig-line { width:130px; border-top:1.5px solid #333; margin:0 auto 3px; }
  .sig-label { font-size:8px; color:#555; font-weight:600; }
  .badge { display:inline-block; padding:1px 6px; border-radius:10px; font-size:7.5px; font-weight:700; }
  .badge-blue { background:#dbeafe; color:#1d4ed8; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  ${logoHtml}
  <div class="header-info">
    <h1>${Utils.esc(academyName)}</h1>
    <div class="sub">BATCH WISE PROFIT &amp; LOSS REPORT</div>
  </div>
  <div class="header-meta">
    <div class="big">Batch: ${batch}</div>
    ${startDate ? `<div>Expense Period: ${Utils.formatDateEN(startDate)} â†’ ${Utils.formatDateEN(endDate)}</div>` : ''}
    ${prevBalance !== 0 ? `<div>à¦ªà§‚à¦°à§à¦¬ à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸: à§³${prevBalance.toLocaleString('en-IN')}</div>` : ''}
    <div>Report Date: ${reportDate}</div>
  </div>
</div>

<!-- Title Bar -->
<div class="title-bar">
  <h2>âœ¦ à¦²à¦¾à¦­-à¦•à§à¦·à¦¤à¦¿ à¦¹à¦¿à¦¸à¦¾à¦¬ â€” ${batch} âœ¦</h2>
  <span style="font-size:8px;">${batchStudents.length} à¦œà¦¨ à¦›à¦¾à¦¤à§à¦°</span>
</div>

<!-- KPI Row -->
<div class="kpi-row">
  <div class="kpi-box kpi-blue"><div class="k-label">à¦®à§‹à¦Ÿ à¦›à¦¾à¦¤à§à¦°</div><div class="k-value">${batchStudents.length}</div></div>
  <div class="kpi-box kpi-yellow"><div class="k-label">à¦®à§‹à¦Ÿ à¦•à§‹à¦°à§à¦¸ à¦«à¦¿</div><div class="k-value">à§³${totalStudentFee.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box kpi-income"><div class="k-label">à¦¸à¦‚à¦—à§ƒà¦¹à§€à¦¤ à¦«à¦¿</div><div class="k-value">à§³${totalCollected.toLocaleString('en-IN')}</div></div>
</div>
<div class="kpi-row">
  <div class="kpi-box kpi-expense"><div class="k-label">à¦¬à¦•à§‡à¦¯à¦¼à¦¾ à¦¡à¦¿à¦‰</div><div class="k-value">à§³${totalDue.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box kpi-orange"><div class="k-label">à¦®à§‹à¦Ÿ à¦–à¦°à¦š</div><div class="k-value">à§³${totalExpense.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box ${isProfit ? 'kpi-profit' : 'kpi-loss'}"><div class="k-label">${isProfit ? 'à¦¨à¦¿à¦Ÿ à¦®à§à¦¨à¦¾à¦«à¦¾' : 'à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿'}</div><div class="k-value">${isProfit ? '+' : '-'}à§³${Math.abs(netProfit).toLocaleString('en-IN')}</div></div>
</div>

<!-- P&L Statement -->
<div class="pl-section">
  <div class="pl-title">ðŸ“Š à¦²à¦¾à¦­-à¦•à§à¦·à¦¤à¦¿ à¦¹à¦¿à¦¸à¦¾à¦¬ (P&amp;L Statement)</div>
  <div class="pl-grid">
    <div>
      <div class="pl-col-title" style="color:#15803d;">à¦†à¦¯à¦¼ (Income)</div>
      <div class="pl-row"><span>à¦›à¦¾à¦¤à§à¦° à¦«à¦¿ à¦¸à¦‚à¦—à§à¦°à¦¹</span><span style="color:#15803d;font-weight:700;">à§³${totalCollected.toLocaleString('en-IN')}</span></div>
      ${otherIncome > 0 ? `<div class="pl-row"><span>à¦…à¦¨à§à¦¯à¦¾à¦¨à§à¦¯ à¦†à¦¯à¦¼</span><span style="color:#15803d;font-weight:700;">à§³${otherIncome.toLocaleString('en-IN')}</span></div>` : ''}
      ${prevBalance !== 0 ? `<div class="pl-row"><span>à¦ªà§‚à¦°à§à¦¬ à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸</span><span style="font-weight:700;color:${prevBalance >= 0 ? '#15803d' : '#b91c1c'};">à§³${prevBalance.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="pl-total"><span>à¦®à§‹à¦Ÿ à¦†à¦¯à¦¼</span><span style="color:#15803d;">à§³${grossIncome.toLocaleString('en-IN')}</span></div>
    </div>
    <div>
      <div class="pl-col-title" style="color:#b91c1c;">à¦¬à§à¦¯à¦¯à¦¼ (Expense)</div>
      ${Object.entries(expCats).map(([cat, amt]) =>
        `<div class="pl-row"><span>${cat}</span><span style="color:#c2410c;font-weight:700;">à§³${amt.toLocaleString('en-IN')}</span></div>`
      ).join('')}
      ${Object.keys(expCats).length === 0 ? '<div class="pl-row" style="color:#aaa;">à¦•à§‹à¦¨à§‹ à¦¬à§à¦¯à¦¯à¦¼ à¦¨à§‡à¦‡</div>' : ''}
      <div class="pl-total"><span>à¦®à§‹à¦Ÿ à¦¬à§à¦¯à¦¯à¦¼</span><span style="color:#b91c1c;">à§³${totalExpense.toLocaleString('en-IN')}</span></div>
    </div>
  </div>
  <div class="pl-net ${isProfit ? 'pl-net-profit' : 'pl-net-loss'}">
    <span class="label">${isProfit ? 'âœ… à¦¨à¦¿à¦Ÿ à¦®à§à¦¨à¦¾à¦«à¦¾ (Net Profit)' : 'âŒ à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿ (Net Loss)'}</span>
    <span class="amount" style="color:${isProfit ? '#15803d' : '#b91c1c'};">${isProfit ? '+' : '-'}à§³${Math.abs(netProfit).toLocaleString('en-IN')}</span>
  </div>
</div>

<!-- Student Table -->
<div class="section-title">ðŸ‘¨â€ðŸŽ“ à¦›à¦¾à¦¤à§à¦° à¦­à¦¿à¦¤à§à¦¤à¦¿à¦• à¦¬à¦¿à¦¬à¦°à¦£</div>
<table>
  <thead><tr>
    <th style="width:24px;text-align:center">#</th>
    <th>à¦¨à¦¾à¦®</th>
    <th>Student ID</th>
    <th>Batch</th>
    <th>à¦•à§‹à¦°à§à¦¸</th>
    <th style="text-align:right">à¦®à§‹à¦Ÿ à¦«à¦¿</th>
    <th style="text-align:right">à¦ªà¦°à¦¿à¦¶à§‹à¦§à¦¿à¦¤</th>
    <th style="text-align:right">à¦¬à¦¾à¦•à¦¿</th>
  </tr></thead>
  <tbody>
    ${batchStudents.map((s, i) => {
      const fee  = parseFloat(s.total_fee) || 0;
      const paid = parseFloat(s.paid) || 0;
      const due  = parseFloat(s.due) || Math.max(0, fee - paid);
      return `<tr>
        <td style="text-align:center;color:#777;">${i + 1}</td>
        <td style="font-weight:700;">${Utils.esc(s.name) || 'â€”'}</td>
        <td><span class="badge badge-blue">${Utils.esc(s.student_id) || 'â€”'}</span></td>
        <td>${Utils.esc(s.batch) || 'â€”'}</td>
        <td style="color:#555;">${Utils.esc(s.course) || 'â€”'}</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8;">à§³${fee.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:#15803d;">à§³${paid.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:${due > 0 ? '#b91c1c' : '#555'};">à§³${due.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('')}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right;color:#1a3a6b;">à¦®à§‹à¦Ÿ:</td>
      <td style="text-align:right;color:#1d4ed8;">à§³${totalStudentFee.toLocaleString('en-IN')}</td>
      <td style="text-align:right;color:#15803d;">à§³${totalCollected.toLocaleString('en-IN')}</td>
      <td style="text-align:right;color:#b91c1c;">à§³${totalDue.toLocaleString('en-IN')}</td>
    </tr>
  </tfoot>
</table>

${expenseEntries.length > 0 ? `
<!-- Expense Table -->
<div class="section-title">ðŸ’¸ à¦–à¦°à¦šà§‡à¦° à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤</div>
<table>
  <thead><tr>
    <th style="width:24px;text-align:center">#</th>
    <th>à¦¤à¦¾à¦°à¦¿à¦–</th>
    <th>à¦¬à¦¿à¦¬à¦°à¦£</th>
    <th>à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿</th>
    <th>à¦ªà¦¦à§à¦§à¦¤à¦¿</th>
    <th style="text-align:right">à¦ªà¦°à¦¿à¦®à¦¾à¦£</th>
  </tr></thead>
  <tbody>
    ${expenseEntries.sort((a,b)=>a.date>b.date?1:-1).map((f, i) => {
      const personStr = (f.person_name || f.person) ? `<strong>[${f.person_name || f.person}]</strong> ` : '';
      return `
      <tr>
        <td style="text-align:center;color:#777;">${i + 1}</td>
        <td style="white-space:nowrap;">${Utils.formatDateEN(f.date) || 'â€”'}</td>
        <td>${personStr}${f.description || 'â€”'}</td>
        <td>${f.category || 'General'}</td>
        <td>${f.method || 'â€”'}</td>
        <td style="text-align:right;font-weight:700;color:#c2410c;">à§³${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
      </tr>
    `}).join('')}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right;color:#b91c1c;">à¦®à§‹à¦Ÿ à¦–à¦°à¦š:</td>
      <td style="text-align:right;color:#b91c1c;">à§³${totalExpense.toLocaleString('en-IN')}</td>
    </tr>
  </tfoot>
</table>` : ''}

<!-- Footer -->
<div class="footer">
  <div style="font-size:8px;color:#888;">${Utils.esc(academyName)}<br/>à¦à¦Ÿà¦¿ à¦à¦•à¦Ÿà¦¿ à¦…à¦«à¦¿à¦¸à¦¿à¦¯à¦¼à¦¾à¦² à¦†à¦°à§à¦¥à¦¿à¦• à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿà¥¤</div>
  <div style="display:flex;gap:40px;">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">à¦¹à¦¿à¦¸à¦¾à¦¬à¦°à¦•à§à¦·à¦•</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">à¦…à¦§à§à¦¯à¦•à§à¦· / à¦•à¦°à§à¦¤à§ƒà¦ªà¦•à§à¦·</div></div>
  </div>
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { if (typeof Utils !== 'undefined') Utils.toast('Popup blocked!', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  function exportBatchReportExcel() {
    const d = window._bpReportData;
    if (!d) { if (typeof Utils !== 'undefined') Utils.toast('à¦†à¦—à§‡ à¦°à¦¿à¦ªà§‹à¦°à§à¦Ÿ Generate à¦•à¦°à§à¦¨', 'warn'); return; }

    const { batch, batchStudents, expenseEntries, totalStudentFee, totalCollected, totalDue, totalExpense, netProfit } = d;

    // Sheet 1: Student Summary
    const studentRows = batchStudents.map((s, i) => ({
      '#': i + 1,
      'à¦¨à¦¾à¦®': s.name || '',
      'Student ID': s.student_id || '',
      'Batch': s.batch || '',
      'à¦•à§‹à¦°à§à¦¸': s.course || '',
      'à¦®à§‹à¦Ÿ à¦«à¦¿': parseFloat(s.total_fee) || 0,
      'à¦ªà¦°à¦¿à¦¶à§‹à¦§à¦¿à¦¤': parseFloat(s.paid) || 0,
      'à¦¬à¦¾à¦•à¦¿': parseFloat(s.due) || Math.max(0, (parseFloat(s.total_fee)||0) - (parseFloat(s.paid)||0)),
      'à¦­à¦°à§à¦¤à¦¿à¦° à¦¤à¦¾à¦°à¦¿à¦–': s.admission_date || '',
      'à¦…à¦¬à¦¸à§à¦¥à¦¾': s.status || 'Active',
    }));

    // Totals row
    studentRows.push({
      '#': '', 'à¦¨à¦¾à¦®': 'â€” à¦®à§‹à¦Ÿ â€”', 'Student ID': '', 'Batch': '', 'à¦•à§‹à¦°à§à¦¸': '',
      'à¦®à§‹à¦Ÿ à¦«à¦¿': totalStudentFee, 'à¦ªà¦°à¦¿à¦¶à§‹à¦§à¦¿à¦¤': totalCollected, 'à¦¬à¦¾à¦•à¦¿': totalDue,
      'à¦­à¦°à§à¦¤à¦¿à¦° à¦¤à¦¾à¦°à¦¿à¦–': '', 'à¦…à¦¬à¦¸à§à¦¥à¦¾': ''
    });

    // Sheet 2: Expenses
    const expenseRows = expenseEntries.map((f, i) => ({
      '#': i + 1,
      'à¦¤à¦¾à¦°à¦¿à¦–': Utils.formatDateEN(f.date) || '',
      'à¦¬à¦¿à¦¬à¦°à¦£': (f.person_name || f.person ? `[${f.person_name || f.person}] ` : '') + (f.description || ''),
      'à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿': f.category || 'General',
      'à¦ªà¦¦à§à¦§à¦¤à¦¿': f.method || '',
      'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': parseFloat(f.amount) || 0,
    }));
    expenseRows.push({ '#': '', 'à¦¤à¦¾à¦°à¦¿à¦–': 'â€” à¦®à§‹à¦Ÿ à¦–à¦°à¦š â€”', 'à¦¬à¦¿à¦¬à¦°à¦£': '', 'à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿': '', 'à¦ªà¦¦à§à¦§à¦¤à¦¿': '', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': totalExpense });

    // Sheet 3: P&L Summary
    const summaryRows = [
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦®à§‹à¦Ÿ à¦›à¦¾à¦¤à§à¦°', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': batchStudents.length },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦®à§‹à¦Ÿ à¦•à§‹à¦°à§à¦¸ à¦«à¦¿', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': totalStudentFee },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦¸à¦‚à¦—à§ƒà¦¹à§€à¦¤ à¦«à¦¿ (Income)', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': totalCollected },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦¬à¦•à§‡à¦¯à¦¼à¦¾ à¦¡à¦¿à¦‰', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': totalDue },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦®à§‹à¦Ÿ à¦–à¦°à¦š (Expense)', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': totalExpense },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': 'à¦ªà§‚à¦°à§à¦¬ à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': d.prevBalance },
      { 'à¦¬à¦¿à¦¬à¦°à¦£': netProfit >= 0 ? 'à¦¨à¦¿à¦Ÿ à¦®à§à¦¨à¦¾à¦«à¦¾' : 'à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿', 'à¦ªà¦°à¦¿à¦®à¦¾à¦£ (à§³)': netProfit },
    ];

    const run = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'à¦›à¦¾à¦¤à§à¦° à¦¬à¦¿à¦¬à¦°à¦£');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'à¦–à¦°à¦šà§‡à¦° à¦¬à¦¿à¦¬à¦°à¦£');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'P&L à¦¸à¦¾à¦°à¦¾à¦‚à¦¶');
      XLSX.writeFile(wb, `batch-profit-${batch}-${new Date().toISOString().split('T')[0]}.xlsx`);
      if (typeof Utils !== 'undefined') Utils.toast('Excel Export à¦¸à¦®à§à¦ªà¦¨à§à¦¨ âœ“', 'success');
    };
    if (typeof XLSX !== 'undefined') { run(); return; }
    if (window.LazyLibs) {
      window.LazyLibs.load('xlsx').then(run).catch(() => {
        if (typeof Utils !== 'undefined') Utils.toast('XLSX library à¦²à§‹à¦¡ à¦¹à¦¯à¦¼à¦¨à¦¿', 'error');
      });
      return;
    }
    if (typeof Utils !== 'undefined') Utils.toast('XLSX library à¦²à§‹à¦¡ à¦¹à¦¯à¦¼à¦¨à¦¿', 'error');
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 10: ACCOUNTS MANAGEMENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelAccountsMgmt() {
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
        <button class="settings-sub-tab" onclick="SettingsModule.showAccountsSubTab('adjustment')">Balance Adjustment</button>
      </div>

      <div id="accounts-mgmt-subtab-content">
        ${buildAdvancePaymentSection()}
      </div>
    </div>`;
  }

  function buildAdvancePaymentSection() {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    const advancesWithCalc = advances.map((a, i) => {
      const returns = a.returns || [];
      const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const remaining = (parseFloat(a.amount) || 0) - totalReturned;
      return { ...a, _idx: i, _totalReturned: totalReturned, _remaining: remaining };
    });
    const totalAdvanced    = advancesWithCalc.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const totalReturned    = advancesWithCalc.reduce((s, a) => s + a._totalReturned, 0);
    const totalOutstanding = totalAdvanced - totalReturned;
    return `
      <div class="settings-card glow-green">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-money-bill-transfer"></i> Advance Payments</div>
          <button class="btn btn-success btn-sm" onclick="SettingsModule.addAdvancePayment()"><i class="fa fa-plus"></i> ADD ADVANCE</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1;min-width:130px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Advanced</div>
            <div style="color:#00ff88;font-size:1.3rem;font-weight:800">à§³${totalAdvanced.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Returned</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">à§³${totalReturned.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Outstanding</div>
            <div style="color:#ff4757;font-size:1.3rem;font-weight:800">à§³${totalOutstanding.toLocaleString()}</div>
          </div>
        </div>
        <div class="table-wrapper" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">#</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Person</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Amount</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Returned</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Remaining</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Method</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Date</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Note</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Status</th>
                <th style="padding:10px 8px;text-align:center;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Action</th>
              </tr>
            </thead>
            <tbody>
              ${advancesWithCalc.length === 0
                ? `<tr><td colspan="10" style="padding:20px;text-align:center;color:var(--text-muted)">No advance payments yet.</td></tr>`
                : advancesWithCalc.map(a => {
                    const pct = a.amount > 0 ? Math.min(100, Math.round((a._totalReturned / a.amount) * 100)) : 0;
                    const isFullyReturned = a._remaining <= 0;
                    const statusColor = isFullyReturned ? '#00ff88' : a._totalReturned > 0 ? '#ffd700' : '#ff4757';
                    const statusText  = isFullyReturned ? 'Cleared' : a._totalReturned > 0 ? 'Partial' : 'Pending';
                    return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                      <td style="padding:10px 8px;color:var(--text-muted)">${a._idx + 1}</td>
                      <td style="padding:10px 8px;font-weight:700">${Utils.esc(a.person) || 'â€”'}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">à§³${(parseFloat(a.amount)||0).toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00d4ff">à§³${a._totalReturned.toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:${isFullyReturned?'#00ff88':'#ff4757'};font-weight:700">à§³${a._remaining.toLocaleString()}</td>
                      <td style="padding:10px 8px;font-size:.82rem"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:2px 8px;border-radius:20px;font-size:.75rem">${Utils.esc(a.method) || 'â€”'}</span></td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-secondary)">${a.date || 'â€”'}</td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-muted)">${Utils.esc(a.note) || 'â€”'}</td>
                      <td style="padding:10px 8px">
                        <span style="background:${statusColor}22;color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700;border:1px solid ${statusColor}44">${statusText}</span>
                        ${!isFullyReturned && pct > 0 ? `<div style="margin-top:4px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px"><div style="width:${pct}%;height:100%;background:#00d4ff;border-radius:2px"></div></div>` : ''}
                      </td>
                      <td style="padding:10px 8px;text-align:center">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                          ${!isFullyReturned ? `<button style="background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);font-size:.72rem;padding:3px 8px;border-radius:6px;cursor:pointer" onclick="SettingsModule.openReturnAdvanceModal(${a._idx})"><i class="fa fa-rotate-left"></i> Return</button>` : ''}
                          <button style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);font-size:.72rem;padding:3px 8px;border-radius:6px;cursor:pointer" onclick="SettingsModule.viewAdvanceLedger(${a._idx})"><i class="fa fa-list"></i> Ledger</button>
                          <button class="btn btn-danger btn-xs" onclick="SettingsModule.deleteAdvance(${a._idx})"><i class="fa fa-xmark"></i></button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildInvestmentSection() {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    const invWithCalc = investments.map((inv, i) => {
      const returns = inv.returns || [];
      const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const remaining = (parseFloat(inv.amount) || 0) - totalReturned;
      return { ...inv, _idx: i, _totalReturned: totalReturned, _remaining: remaining };
    });
    const totalInvested    = invWithCalc.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const totalReturnedAmt = invWithCalc.reduce((s, a) => s + a._totalReturned, 0);
    const totalOutstanding = totalInvested - totalReturnedAmt;
    return `
      <div class="settings-card glow-purple">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> Investments</div>
          <button class="btn btn-accent btn-sm" onclick="SettingsModule.addInvestment()"><i class="fa fa-plus"></i> ADD INVESTMENT</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1;min-width:130px;background:rgba(138,43,226,0.08);border:1px solid rgba(138,43,226,0.3);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Invested</div>
            <div style="color:#a855f7;font-size:1.3rem;font-weight:800">à§³${totalInvested.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Returned</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">à§³${totalReturnedAmt.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Active Investment</div>
            <div style="color:#ffd700;font-size:1.3rem;font-weight:800">à§³${totalOutstanding.toLocaleString()}</div>
          </div>
        </div>
        <div class="table-wrapper" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">#</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Source</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Amount</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Returned</th>
                <th style="padding:10px 8px;text-align:right;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Active</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Account</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Date</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Note</th>
                <th style="padding:10px 8px;text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Status</th>
                <th style="padding:10px 8px;text-align:center;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)">Action</th>
              </tr>
            </thead>
            <tbody>
              ${invWithCalc.length === 0
                ? `<tr><td colspan="10" style="padding:20px;text-align:center;color:var(--text-muted)">No investments yet.</td></tr>`
                : invWithCalc.map(inv => {
                    const pct = inv.amount > 0 ? Math.min(100, Math.round((inv._totalReturned / inv.amount) * 100)) : 0;
                    const isFullyReturned = inv._remaining <= 0;
                    const statusColor = isFullyReturned ? '#00ff88' : inv._totalReturned > 0 ? '#ffd700' : '#a855f7';
                    const statusText  = isFullyReturned ? 'Returned' : inv._totalReturned > 0 ? 'Partial' : 'Active';
                    return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                      <td style="padding:10px 8px;color:var(--text-muted)">${inv._idx + 1}</td>
                      <td style="padding:10px 8px;font-weight:700">${inv.source || 'â€”'}</td>
                      <td style="padding:10px 8px;text-align:right;color:#a855f7;font-weight:700">à§³${(parseFloat(inv.amount)||0).toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00d4ff">à§³${inv._totalReturned.toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:${isFullyReturned?'#00ff88':'#ffd700'};font-weight:700">à§³${inv._remaining.toLocaleString()}</td>
                      <td style="padding:10px 8px;font-size:.82rem"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:2px 8px;border-radius:20px;font-size:.75rem">${inv.method || 'â€”'}</span></td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-secondary)">${inv.date || 'â€”'}</td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-muted)">${inv.note || 'â€”'}</td>
                      <td style="padding:10px 8px">
                        <span style="background:${statusColor}22;color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700;border:1px solid ${statusColor}44">${statusText}</span>
                        ${!isFullyReturned && pct > 0 ? `<div style="margin-top:4px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px"><div style="width:${pct}%;height:100%;background:#a855f7;border-radius:2px"></div></div>` : ''}
                      </td>
                      <td style="padding:10px 8px;text-align:center">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                          ${!isFullyReturned ? `<button style="background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);font-size:.72rem;padding:3px 8px;border-radius:6px;cursor:pointer" onclick="SettingsModule.openReturnInvestmentModal(${inv._idx})"><i class="fa fa-rotate-left"></i> Return</button>` : ''}
                          <button style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);font-size:.72rem;padding:3px 8px;border-radius:6px;cursor:pointer" onclick="SettingsModule.viewInvestmentLedger(${inv._idx})"><i class="fa fa-list"></i> Ledger</button>
                          <button class="btn btn-danger btn-xs" onclick="SettingsModule.deleteInvestment(${inv._idx})"><i class="fa fa-xmark"></i></button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function showAccountsSubTab(tab) {
    document.querySelectorAll('.settings-sub-tab').forEach((btn, i) => {
      btn.classList.toggle('active',
        (tab === 'advance'    && i === 0) ||
        (tab === 'investment' && i === 1) ||
        (tab === 'adjustment' && i === 2)
      );
    });
    const container = document.getElementById('accounts-mgmt-subtab-content');
    if (!container) return;
    if (tab === 'advance') {
      container.innerHTML = buildAdvancePaymentSection();
    } else if (tab === 'adjustment') {
      container.innerHTML = buildBalanceAdjustmentSection();
    } else {
      container.innerHTML = buildInvestmentSection();
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BALANCE ADJUSTMENT â€” render, add, save, delete
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  function buildBalanceAdjustmentSection() {
    const entries = (SupabaseSync.getAll(DB.finance) || [])
      .filter(f => f.category === 'Balance Adjustment')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const totalAdded    = entries.filter(f => f.type === 'Income') .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const totalSubtract = entries.filter(f => f.type === 'Expense').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    const rows = entries.length > 0
      ? entries.map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${f.date || 'â€”'}</td>
            <td>${f.method || 'â€”'}</td>
            <td><span class="badge ${f.type === 'Income' ? 'badge-success' : 'badge-error'}">${f.type === 'Income' ? '+ Add' : 'âˆ’ Subtract'}</span></td>
            <td class="text-right" style="color:${f.type === 'Income' ? '#00ff88' : '#ff4757'}">à§³${parseFloat(f.amount || 0).toLocaleString()}</td>
            <td>${f.note || f.description || 'â€”'}</td>
            <td class="text-center">
              <button class="btn btn-error btn-sm" onclick="SettingsModule.deleteBalanceAdjustment('${f.id}')"><i class="fa fa-trash"></i></button>
            </td>
          </tr>`)
        .join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No balance adjustments found.</td></tr>';

    return `
      <div class="settings-card glow-cyan">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-sliders"></i> Balance Adjustment</div>
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.addBalanceAdjustment()"><i class="fa fa-plus"></i> ADD ADJUSTMENT</button>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">
          Manually align account balances (cash / bank / mobile banking).<br>
          <strong style="color:#ffd700">âš  These entries are excluded from Batch Profit Reports and Dashboard statistics.</strong>
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1;min-width:130px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Added</div>
            <div style="color:#00ff88;font-size:1.3rem;font-weight:800">à§³${totalAdded.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Subtracted</div>
            <div style="color:#ff4757;font-size:1.3rem;font-weight:800">à§³${totalSubtract.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Net Effect</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">à§³${(totalAdded - totalSubtract).toLocaleString()}</div>
          </div>
        </div>
        <div class="table-wrapper" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Account</th><th>Type</th>
                <th class="text-right">Amount</th><th>Note</th><th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function addBalanceAdjustment() {
    const today = new Date().toISOString().split('T')[0];
    const methods = SupabaseSync.getAll(DB.settings)?.[0]?.paymentMethods
      || ['Cash', 'Bank', 'bKash', 'Nagad', 'Rocket'];
    const methodOptions = (Array.isArray(methods) ? methods : ['Cash', 'Bank', 'bKash'])
      .map(m => `<option value="${m}">${m}</option>`).join('');

    openSettingsInternalModal(`
      <div class="settings-card-title" style="margin-bottom:16px"><i class="fa fa-sliders"></i> Add Balance Adjustment</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="font-size:.85rem;color:var(--text-secondary)">Adjustment Type
          <select id="adj-type" class="settings-input" style="width:100%;margin-top:6px">
            <option value="Income">+ Add to Balance</option>
            <option value="Expense">âˆ’ Subtract from Balance</option>
          </select>
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Date
          <input type="date" id="adj-date" class="settings-input" value="${today}" style="width:100%;margin-top:6px">
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Account / Method
          <select id="adj-method" class="settings-input" style="width:100%;margin-top:6px">${methodOptions}</select>
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Amount (à§³)
          <input type="number" id="adj-amount" class="settings-input" min="1" placeholder="e.g. 5000" style="width:100%;margin-top:6px">
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Note (optional)
          <input type="text" id="adj-note" class="settings-input" placeholder="e.g. Auditing correction" style="width:100%;margin-top:6px">
        </label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-outline btn-sm" onclick="SettingsModule.closeSettingsInternalModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="SettingsModule.saveBalanceAdjustment()"><i class="fa fa-save"></i> Save</button>
      </div>
    `);
  }

  async function saveBalanceAdjustment() {
    const adjType  = document.getElementById('adj-type')?.value;
    const adjDate  = document.getElementById('adj-date')?.value;
    const adjMethod= document.getElementById('adj-method')?.value;
    const adjAmount= parseFloat(document.getElementById('adj-amount')?.value);
    const adjNote  = document.getElementById('adj-note')?.value?.trim() || 'Balance Adjustment';

    if (!adjMethod) { Utils.toast('Please select an account.', 'error'); return; }
    if (!adjDate)   { Utils.toast('Please select a date.', 'error'); return; }
    if (!adjAmount || adjAmount <= 0) { Utils.toast('Amount must be greater than 0.', 'error'); return; }

    // Check sufficient balance when subtracting
    if (adjType === 'Expense') {
      const balances = SupabaseSync.getAccountBalances ? SupabaseSync.getAccountBalances() : {};
      const currentBal = parseFloat(balances[adjMethod] || 0);
      if (currentBal < adjAmount) {
        const force = confirm(`âš  Account "${adjMethod}" balance is à§³${currentBal.toLocaleString()}, which is less than à§³${adjAmount.toLocaleString()}.\n\nForce subtract anyway?`);
        if (!force) return;
      }
    }

    const entry = {
      type:        adjType,
      method:      adjMethod,
      category:    'Balance Adjustment',
      description: adjNote,
      amount:      adjAmount,
      date:        adjDate,
      note:        adjNote,
      person:      '',
    };

    try {
      await SupabaseSync.insert(DB.finance, entry);
      await SupabaseSync.updateAccountBalance(adjMethod, adjAmount, adjType === 'Income' ? 'in' : 'out');
      Utils.toast('Balance adjustment saved!', 'success');
      closeSettingsInternalModal();
      showAccountsSubTab('adjustment');
    } catch (err) {
      console.error('saveBalanceAdjustment error:', err);
      Utils.toast('Failed to save adjustment.', 'error');
    }
  }

  async function deleteBalanceAdjustment(id) {
    const all = SupabaseSync.getAll(DB.finance) || [];
    const entry = all.find(f => String(f.id) === String(id));
    if (!entry) { Utils.toast('Entry not found.', 'error'); return; }

    // Check sufficient balance when deleting an Add adjustment (which subtracts from the balance)
    if (entry.type === 'Income') {
      const balances = SupabaseSync.getAccountBalances ? SupabaseSync.getAccountBalances() : {};
      const currentBal = parseFloat(balances[entry.method] || 0);
      const amt = parseFloat(entry.amount);
      if (currentBal < amt) {
        const force = confirm(`âš  Reversing this adjustment will subtract à§³${amt.toLocaleString()} from "${entry.method}", which currently only has à§³${currentBal.toLocaleString()}.\n\nForce delete anyway?`);
        if (!force) return;
      }
    }

    if (!confirm(`Delete this balance adjustment?\n${entry.type === 'Income' ? '+' : '-'} à§³${parseFloat(entry.amount).toLocaleString()} on ${entry.date} (${entry.method})\n\nThis will reverse the balance change.`)) return;

    try {
      // Reverse the balance effect
      const reverseDir = entry.type === 'Income' ? 'out' : 'in';
      await SupabaseSync.updateAccountBalance(entry.method, parseFloat(entry.amount), reverseDir);
      await SupabaseSync.remove(DB.finance, id);
      Utils.toast('Adjustment deleted and balance reversed.', 'success');
      if (typeof logActivity === 'function') logActivity('Deleted balance adjustment', entry);
      showAccountsSubTab('adjustment');
    } catch (err) {
      console.error('deleteBalanceAdjustment error:', err);
      Utils.toast('Failed to delete adjustment.', 'error');
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB 11: MONITOR
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelMonitor() {
    // wfa_recent_changes â€” à¦¶à§à¦§à§ finance transactions (supabase-sync.js)
    const transactions = Utils.safeJSON(localStorage.getItem('wfa_recent_changes'), []);

    // Transaction type badge color
    const txBadge = type => {
      const t = String(type || '').toLowerCase();
      if (t === 'income')           return 'badge-success';
      if (t === 'expense')          return 'badge-error';
      if (t.startsWith('transfer')) return 'badge-warning';
      if (t === 'loan giving')      return 'badge-warning';
      if (t === 'loan receiving')   return 'badge-info';
      return 'badge-info';
    };

    return `
    <div class="settings-panel ${activeTab === 'monitor' ? 'active' : ''}" data-panel="monitor">
      <div class="settings-card glow-purple">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> DATA MONITOR</div>
          <div style="display:flex;align-items:center;gap:10px">
            <button type="button" class="btn btn-outline btn-sm" onclick="SettingsModule.refreshMonitor()"><i class="fa fa-rotate"></i> Refresh</button>
            <button type="button" class="btn btn-outline btn-sm" style="color:#ffd700;border-color:rgba(255,215,0,0.3)" onclick="SettingsModule.rebuildMonitorData()" title="Rebuild from existing finance ledger"><i class="fa fa-database"></i> Rebuild Data</button>
          </div>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Last 15 financial transactionsà¥¤ à¦à¦•à¦Ÿà¦¿ row-à¦ click à¦•à¦°à¦²à§‡ à¦¸à§‡à¦‡ à¦¸à¦®à¦¯à¦¼à§‡à¦° account balance snapshot à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤</p>

        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>DATE</th><th>ACTION</th><th>TYPE</th><th>CATEGORY</th><th>PERSON / DETAIL</th><th class="text-right">AMOUNT</th></tr></thead>
            <tbody>
              ${transactions.length === 0 ?
                `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">No transactions yet â€” Income à¦¬à¦¾ Expense add à¦•à¦°à¦²à§‡ à¦à¦–à¦¾à¦¨à§‡ à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤</td></tr>` :
                transactions.map((c, i) => {
                  const actionLabel = c.action === 'update' ? 'âœï¸ Edit' : c.action === 'delete' ? 'ðŸ—‘ï¸ Delete' : c.action === 'restore' ? 'â†©ï¸ Restore' : 'âž• New';
                  const actionColor = c.action === 'update' ? '#00d9ff' : c.action === 'delete' ? '#ff4757' : c.action === 'restore' ? '#ffd700' : '#00ff88';
                  const actionBg    = c.action === 'update' ? 'rgba(0,217,255,0.10)' : c.action === 'delete' ? 'rgba(255,71,87,0.10)' : c.action === 'restore' ? 'rgba(255,215,0,0.10)' : 'rgba(0,255,136,0.10)';
                  // âœ… Rebuilt vs Real snapshot indicator
                  const snapshotBadge = c.rebuilt
                    ? '<span style="font-size:.62rem;color:#ffd700;opacity:.7;margin-left:4px" title="Rebuild à¦¥à§‡à¦•à§‡ à¦¤à§ˆà¦°à¦¿ â€” à¦†à¦¸à¦² snapshot à¦¨à¦¯à¦¼">ðŸ”„</span>'
                    : '<span style="font-size:.62rem;color:#00ff88;opacity:.5;margin-left:4px" title="Real-time snapshot âœ“">ðŸ“¸</span>';
                  return `
                  <tr class="monitor-recent-row" style="cursor:pointer" onclick="SettingsModule.showMonitorSnapshot(${i})" title="Click to see account snapshot at this transaction">
                    <td>${i + 1}${snapshotBadge}</td>
                    <td style="font-size:.82rem">${c.date || 'â€”'}</td>
                    <td><span style="font-size:.72rem;font-weight:700;color:${actionColor};background:${actionBg};border:1px solid ${actionColor}44;padding:2px 8px;border-radius:20px;white-space:nowrap">${actionLabel}</span></td>
                    <td><span class="badge ${txBadge(c.type)}">${c.type || 'â€”'}</span></td>
                    <td style="font-size:.82rem">${c.category || 'â€”'}</td>
                    <td style="font-size:.82rem">${c.person || 'â€”'}</td>
                    <td class="text-right" style="font-family:var(--font-ui);font-size:.85rem;color:${String(c.type||'').toLowerCase()==='expense'?'var(--error)':'var(--success)'}">${c.amount ? Utils.takaEn(c.amount) : 'â€”'}</td>
                  </tr>
                  <tr><td colspan="7" style="padding:0"><div class="monitor-bar" style="width:${Math.max(15, 100 - i * 9)}%"></div></td></tr>`;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HELPER FUNCTIONS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  function getConfig() {
    return SupabaseSync.getAll(DB.settings)[0] || {};
  }

  /** Fix corrupted date strings in settings (e.g. expense_start_date = "admin"). */
  function _healConfigDateFields(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
    let dirty = false;
    const start = String(cfg.expense_start_date || '').trim();
    if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      delete cfg.expense_start_date;
      dirty = true;
    }
    const end = String(cfg.expense_end_date || '').trim();
    if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      cfg.expense_end_date = today;
      dirty = true;
    }
    return { cfg, dirty };
  }

  function _persistHealedConfigDates() {
    const raw = SupabaseSync.getAll(DB.settings)[0] || {};
    const { cfg, dirty } = _healConfigDateFields({ ...raw });
    if (dirty && cfg.id) saveConfig(cfg);
  }

  function saveConfig(cfg) {
    // âœ… DUPLICATE FIX: à¦¸à¦¬à¦¸à¦®à¦¯à¦¼ admin_password à¦†à¦›à§‡ à¦à¦®à¦¨ row à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§‹ â€” à¦à¦Ÿà¦¾à¦‡ keeper rowà¥¤
    // allSettings[0] à¦¨à¦¯à¦¼, à¦•à¦¾à¦°à¦£ sync à¦à¦° à¦•à¦¾à¦°à¦£à§‡ row order à¦­à¦¿à¦¨à§à¦¨ à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¥¤
    const allSettings = SupabaseSync.getAll(DB.settings);
    if (allSettings.length > 0) {
      const keeper = allSettings.find(s => s.admin_password) || allSettings[0];
      const existingId = keeper.id;
      cfg.id = existingId;
      SupabaseSync.update(DB.settings, existingId, cfg, { bypassLog: true });
    } else {
      cfg.id = cfg.id || SupabaseSync.generateId();
      SupabaseSync.insert(DB.settings, cfg, { bypassLog: true });
    }
  }

  function refreshModal() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    const savedTab = activeTab;
    overlay.innerHTML = buildModalHTML();
    activeTab = savedTab;
    switchTab(savedTab);
    setTimeout(_initSettingsDatePickers, 20);
  }

  // âœ… Req 4: init Flatpickr DD/MM/YYYY on all non-disabled date inputs in the settings overlay
  function _initSettingsDatePickers() {
    if (typeof flatpickr === 'undefined') return;
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;

    const _fp = (el, opts) => (typeof Utils !== 'undefined' && Utils.initFlatpickrOnElement)
      ? Utils.initFlatpickrOnElement(el, opts)
      : null;

    overlay.querySelectorAll('input[type="date"], #bp-start, #bp-end').forEach(el => {
      if (typeof Utils !== 'undefined' && Utils.sanitizeDateInputElement) Utils.sanitizeDateInputElement(el);
    });

    overlay.querySelectorAll('input[type="date"]:not([disabled])').forEach(el => {
      if (!el._flatpickr) {
        _fp(el, {
          dateFormat: 'Y-m-d',
          altInput:   true,
          altFormat:  'd/m/Y',
          allowInput: true,
          locale:     { firstDayOfWeek: 1 },
        });
      }
    });

    // Batch Profit Report calendar pickers (bp-start / bp-end)
    const bpStart = document.getElementById('bp-start');
    const bpEnd   = document.getElementById('bp-end');
    
    // Pre-sanitize both inputs
    if (bpStart) {
      const val = (bpStart.value || '').trim();
      if (val && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val)) {
        console.warn('[Settings] Clearing invalid bp-start value:', val);
        bpStart.value = '';
      }
    }
    if (bpEnd) {
      const val = (bpEnd.value || '').trim();
      if (val && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val)) {
        console.warn('[Settings] Clearing invalid bp-end value:', val);
        bpEnd.value = '';
      }
    }

    const bpCfg = {
      dateFormat:    'd/m/Y',
      disableMobile: true,
      locale:        { firstDayOfWeek: 1 },
      onChange: function(dates, _str, inst) {
        const raw = dates[0] ? dates[0].toISOString().split('T')[0] : '';
        const hid = document.getElementById(inst.element.id + '-raw');
        if (hid) hid.value = raw;
      }
    };
    
    if (bpStart && !bpStart._flatpickr) _fp(bpStart, Object.assign({}, bpCfg));
    if (bpEnd && !bpEnd._flatpickr) _fp(bpEnd, Object.assign({}, bpCfg));
  }

  // â”€â”€â”€ SyncGuard Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function panelSyncGuard() {
    return `
    <div class="settings-panel ${activeTab === 'syncguard' ? 'active' : ''}" data-panel="syncguard">
      <div class="settings-card glow-red">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-shield-halved"></i> SYNC GUARD â€” Payment &amp; Data Integrity</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="SyncGuard.runFullAudit();setTimeout(()=>SyncGuard.renderPanel('syncguard-panel'),200)">
            <i class="fa fa-rotate"></i> Re-Audit
          </button>
          <button type="button" class="btn btn-outline btn-sm" style="color:#a78bfa;border-color:rgba(167,139,250,0.4);background:rgba(167,139,250,0.06)" onclick="typeof WfaSettingsDiagnostics!=='undefined'&&WfaSettingsDiagnostics.run()" title="Full read-only system scan">
            <i class="fa fa-stethoscope"></i> Run Diagnostics
          </button>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">
          Finance ledger, Loan, Transfer à¦à¦¬à¦‚ Account Balance à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼à¦­à¦¾à¦¬à§‡ à¦ªà¦°à§€à¦•à§à¦·à¦¾ à¦•à¦°à§‡à¥¤
          Sync conflict à¦¬à¦¾ balance mismatch à¦¹à¦²à§‡ à¦¸à¦¾à¦¥à§‡ à¦¸à¦¾à¦¥à§‡ alert à¦ªà¦¾à¦ à¦¾à¦¯à¦¼ à¦à¦¬à¦‚ à¦à¦–à¦¾à¦¨à§‡ log à¦•à¦°à§‡à¥¤
        </p>
        <div id="syncguard-panel">
          <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading audit...</div>
        </div>
      </div>
    </div>
    `;
  }


  // â”€â”€â”€ Activity Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getActivityLogs() {
    const raw = Utils.safeJSON(localStorage.getItem('wfa_activity_log'), []);
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.filterActivityLogs) {
      return SupabaseSync.filterActivityLogs(raw);
    }
    return raw.filter(l => {
      const d = String(l.description || '');
      if (/DIAG-TEST-|DIAG-INST-|DIAG-EXAM-|DIAG-SAL-|System Test Student|Auto-generated diagnostic|Diagnostic Test Staff|Diagnostic Installment Student|Diagnostic Exam Student|Diagnostic Loan Person|Batch-DIAG|Diagnostics Course/i.test(d)) return false;
      if (l.type === 'settings' && /^à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸-à¦ (à¦¤à¦¥à§à¦¯ à¦†à¦ªà¦¡à§‡à¦Ÿ|à¦¨à¦¤à§à¦¨ à¦à¦¨à§à¦Ÿà§à¦°à¦¿)/i.test(d) && /à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸$/i.test(d)) return false;
      return true;
    });
  }

  // âœ… Fix: settings.js logActivity à¦à¦–à¦¨ SupabaseSync.logActivity à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡
  // à¦à¦¤à§‡ à¦¸à¦¬ device-à¦ activity log Supabase-à¦ sync à¦¹à¦¬à§‡
  function logActivity(action, type, description) {
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity) {
      SupabaseSync.logActivity(action, type, description);
    } else {
      // Fallback: local only
      const logs = getActivityLogs();
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

  async function clearActivityLog() {
    const ok = await Utils.confirm('à¦¸à¦¬ Activity Log à¦®à§à¦›à§‡ à¦¦à§‡à¦¬à§‡à¦¨? à¦à¦Ÿà¦¿ undo à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤', 'Clear Activity Log');
    if (!ok) return;

    // Clear localStorage
    localStorage.setItem('wfa_activity_log', '[]');

    // Clear cloud activity_log table
    try {
      const { client } = window.SUPABASE_CONFIG;
      if (client) {
        await client.from('activity_log').delete().neq('id', '__never_match__');
      }
    } catch (e) {
      console.warn('[ActivityLog] Cloud clear failed:', e);
    }

    Utils.toast('Activity log cleared âœ…', 'success');
    refreshModal();
  }

  // Activity log panel-à¦à¦° tbody à¦“ stats live refresh (modal reload à¦›à¦¾à¦¡à¦¼à¦¾à¦‡)
  function refreshActivityPanel() {
    const fresh  = getActivityLogs();
    const panel  = document.querySelector('[data-panel="activity"]');
    if (!panel) return;
    const addC   = fresh.filter(l => l.action === 'add').length;
    const editC  = fresh.filter(l => l.action === 'edit').length;
    const delC   = fresh.filter(l => l.action === 'delete').length;
    const tot = document.getElementById('astat-total');
    const add = document.getElementById('astat-add');
    const edi = document.getElementById('astat-edit');
    const del = document.getElementById('astat-del');
    if (tot) tot.textContent = `à¦®à§‹à¦Ÿ: ${fresh.length}`;
    if (add) add.textContent = `+ à¦¯à§‹à¦— ${addC}`;
    if (edi) edi.textContent = `âœ à¦à¦¡à¦¿à¦Ÿ ${editC}`;
    if (del) del.textContent = `ðŸ—‘ à¦¡à¦¿à¦²à¦¿à¦Ÿ ${delC}`;
    const tbody = document.getElementById('alog-tbody') || panel.querySelector('tbody');
    if (!tbody) return;
    const fa = document.getElementById('alog-filter-action')?.value || 'all';
    const ft = document.getElementById('alog-filter-type')?.value   || 'all';
    const fs = (document.getElementById('alog-search')?.value || '').trim();
    tbody.innerHTML = _buildActivityRows(fresh, fa, ft, fs);
  }

  function filterActivityLog() {
    const fresh = getActivityLogs();
    const fa = document.getElementById('alog-filter-action')?.value || 'all';
    const ft = document.getElementById('alog-filter-type')?.value   || 'all';
    const fs = (document.getElementById('alog-search')?.value || '').trim();
    const tbody = document.getElementById('alog-tbody');
    if (tbody) tbody.innerHTML = _buildActivityRows(fresh, fa, ft, fs);
  }

  function clearActivityFilters() {
    const fa = document.getElementById('alog-filter-action'); if (fa) fa.value = 'all';
    const ft = document.getElementById('alog-filter-type');   if (ft) ft.value = 'all';
    const fs = document.getElementById('alog-search');        if (fs) fs.value = '';
    filterActivityLog();
  }

  // â”€â”€ Activity type metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _ACT_TYPE_META = {
    students:       { icon:'fa-user-graduate',        label:'à¦›à¦¾à¦¤à§à¦° à¦¤à¦¾à¦²à¦¿à¦•à¦¾',    color:'#00d9ff' },
    finance_ledger: { icon:'fa-money-bill-wave',       label:'à¦†à¦¯à¦¼-à¦¬à§à¦¯à¦¯à¦¼ à¦²à§‡à¦œà¦¾à¦°', color:'#00ff88' },
    accounts:       { icon:'fa-building-columns',      label:'à¦à¦•à¦¾à¦‰à¦¨à§à¦Ÿ',         color:'#ffd700' },
    loans:          { icon:'fa-hand-holding-dollar',   label:'à¦²à§‹à¦¨',             color:'#ff6b35' },
    salary:         { icon:'fa-money-bill-wave',       label:'à¦¬à§‡à¦¤à¦¨',            color:'#b537f2' },
    exams:          { icon:'fa-file-lines',            label:'à¦ªà¦°à§€à¦•à§à¦·à¦¾',         color:'#00d9ff' },
    attendance:     { icon:'fa-clipboard-list',        label:'à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿',        color:'#00ff88' },
    staff:          { icon:'fa-user-tie',              label:'à¦¸à§à¦Ÿà¦¾à¦«',           color:'#ffa502' },
    'hr-staff':     { icon:'fa-user-tie',              label:'à¦¸à§à¦Ÿà¦¾à¦«',           color:'#ffa502' },
    finance:        { icon:'fa-money-bill-wave',       label:'à¦†à¦¯à¦¼-à¦¬à§à¦¯à¦¯à¦¼ à¦²à§‡à¦œà¦¾à¦°', color:'#00ff88' },
    settings:       { icon:'fa-gear',                  label:'à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸',          color:'#aaaaaa' },
    security:       { icon:'fa-shield-halved',         label:'à¦¨à¦¿à¦°à¦¾à¦ªà¦¤à§à¦¤à¦¾',       color:'#ff4757' },
    category:       { icon:'fa-tags',                  label:'à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿',       color:'#ffd700' },
    certificates:   { icon:'fa-certificate',           label:'à¦¸à¦¾à¦°à§à¦Ÿà¦¿à¦«à¦¿à¦•à§‡à¦Ÿ',    color:'#00ff88' },
    visitors:       { icon:'fa-person-walking',        label:'à¦­à¦¿à¦œà¦¿à¦Ÿà¦°',          color:'#aaaaaa' },
    notices:        { icon:'fa-bullhorn',              label:'à¦¨à§‹à¦Ÿà¦¿à¦¶',           color:'#ffa502' },
    system:         { icon:'fa-gear',                  label:'à¦¸à¦¿à¦¸à§à¦Ÿà§‡à¦®',         color:'#666666' },
    note:           { icon:'fa-bookmark',              label:'à¦¨à§‹à¦Ÿ',             color:'#b537f2' },
  };
  const _ACT_ACTION_META = {
    add:      { badge:'ADD',      color:'#00ff88', bg:'rgba(0,255,136,0.12)',   icon:'fa-plus-circle' },
    edit:     { badge:'EDIT',     color:'#00d9ff', bg:'rgba(0,217,255,0.12)',   icon:'fa-pen' },
    delete:   { badge:'DELETE',   color:'#ff4757', bg:'rgba(255,71,87,0.12)',   icon:'fa-trash' },
    restore:  { badge:'RESTORE',  color:'#ffd700', bg:'rgba(255,215,0,0.12)',   icon:'fa-rotate-left' },
    system:   { badge:'SYSTEM',   color:'#aaaaaa', bg:'rgba(255,255,255,0.06)', icon:'fa-gear' },
    export:   { badge:'EXPORT',   color:'#b537f2', bg:'rgba(181,55,242,0.12)', icon:'fa-file-export' },
    transfer: { badge:'TRANSFER', color:'#ffa502', bg:'rgba(255,165,2,0.12)',  icon:'fa-arrow-right-arrow-left' },
    print:    { badge:'PRINT',    color:'#00d9ff', bg:'rgba(0,217,255,0.10)',  icon:'fa-print' },
  };
  // Related table pairs: when student edited, finance/accounts logs are side-effects
  const _RELATED_PAIRS = {
    'edit:students':   ['edit:finance_ledger','edit:accounts','add:finance_ledger'],
    'add:students':    ['add:finance_ledger','edit:accounts','add:accounts'],
    'delete:students': ['delete:finance_ledger','edit:accounts'],
    'add:loans':       ['add:finance_ledger','edit:accounts'],
    'delete:loans':    ['delete:finance_ledger','edit:accounts'],
    'add:salary':      ['edit:accounts'],
    'delete:salary':   ['edit:accounts'],
    'edit:settings':   ['edit:settings'],
  };

  function _buildActivityRows(logs, filterAction, filterType, filterSearch) {
    if (!logs || logs.length === 0)
      return `<tr><td colspan="7" class="no-data"><i class="fa fa-inbox"></i> à¦•à§‹à¦¨à§‹ activity à¦¨à§‡à¦‡</td></tr>`;

    // â”€â”€ Apply filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let items = (typeof SupabaseSync !== 'undefined' && SupabaseSync.filterActivityLogs)
      ? SupabaseSync.filterActivityLogs(logs)
      : logs.filter(l => {
          const d = String(l.description || '');
          return !/DIAG-TEST-|DIAG-EXAM-|System Test Student|Auto-generated diagnostic|Diagnostic Test Staff|Diagnostic Exam Student|Diagnostic Loan Person|Batch-DIAG|Diagnostics Course/i.test(d);
        });
    if (filterAction && filterAction !== 'all') items = items.filter(l => l.action === filterAction);
    if (filterType   && filterType   !== 'all') items = items.filter(l => l.type   === filterType);
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      items = items.filter(l =>
        (l.description||'').toLowerCase().includes(q) ||
        (l.type||'').toLowerCase().includes(q));
    }

    // â”€â”€ Deduplication: merge related side-effect entries (within 4 sec) â”€â”€
    const MERGE_MS = 4000;
    const merged   = [];
    const used     = new Set();
    const capped   = items.slice(0, 300);
    for (let i = 0; i < capped.length; i++) {
      if (used.has(i)) continue;
      const e   = capped[i];
      const key = `${e.action}:${e.type}`;
      const t0  = new Date(e.created_at || 0).getTime();
      const rel = _RELATED_PAIRS[key] || [];
      // Special: settings â€” collapse consecutive same-type within window
      if (e.type === 'settings' && e.action === 'edit') {
        let j = i + 1;
        while (j < capped.length && j < i + 8) {
          const nx = capped[j];
          const t1 = new Date(nx.created_at || 0).getTime();
          if (nx.type === 'settings' && nx.action === 'edit' && Math.abs(t0 - t1) <= MERGE_MS) {
            used.add(j);
          }
          j++;
        }
      }
      const absorbed = [];
      for (let j = i + 1; j < Math.min(capped.length, i + 10); j++) {
        if (used.has(j)) continue;
        const nx = capped[j];
        const t1 = new Date(nx.created_at || 0).getTime();
        if (Math.abs(t0 - t1) <= MERGE_MS && rel.includes(`${nx.action}:${nx.type}`)) {
          absorbed.push(nx);
          used.add(j);
        }
      }
      merged.push({ e, absorbed });
      used.add(i);
    }

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let lastDateStr = null;
    const rows = [];
    for (const { e: l, absorbed } of merged) {
      // Date separator
      const dt = l.created_at ? new Date(l.created_at) : null;
      if (dt) {
        const today = new Date(); today.setHours(0,0,0,0);
        const yest  = new Date(today); yest.setDate(today.getDate()-1);
        const dStr  = dt.toDateString();
        if (dStr !== lastDateStr) {
          lastDateStr = dStr;
          const dlabel = dt >= today ? 'ðŸ“… à¦†à¦œ'
                       : dt >= yest  ? 'ðŸ“… à¦—à¦¤à¦•à¦¾à¦²'
                       : 'ðŸ“… ' + dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
          rows.push(`<tr><td colspan="7" style="padding:5px 14px;background:rgba(255,255,255,0.025);font-size:.70rem;font-weight:700;color:rgba(255,255,255,0.30);letter-spacing:.8px;border-top:1px solid rgba(255,255,255,0.06)">${dlabel}</td></tr>`);
        }
      }

      const tm  = _ACT_TYPE_META[l.type]   || { icon:'fa-circle-dot', label: l.type||'â€”', color:'#aaa' };
      const am  = _ACT_ACTION_META[l.action]|| { badge:(l.action||'?').toUpperCase(), color:'#aaa', bg:'rgba(255,255,255,0.06)', icon:'fa-circle' };
      const dev = l.device_id ? String(l.device_id).slice(-6) : 'â€”';
      const ok  = l.status !== 'failed';
      const desc = (l.description || '');
      const rid  = 'al_' + (l.id || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, '');
      const short= desc.length > 90 ? desc.slice(0, 90) + 'â€¦' : desc;
      const long = desc.length > 90;
      const descEsc = Utils.esc(desc);
      const shortEsc = Utils.esc(short);
      const ridEsc = Utils.escAttr(rid);

      let absHtml = '';
      if (absorbed.length) {
        const uniq = [...new Set(absorbed.map(a => (_ACT_TYPE_META[a.type]||{label:a.type}).label))];
        absHtml = `<div style="margin-top:3px;font-size:.68rem;color:rgba(255,255,255,0.28)"><i class="fa fa-link" style="font-size:.6rem"></i> à¦¬à§à¦¯à¦¾à¦•à¦—à§à¦°à¦¾à¦‰à¦¨à§à¦¡ à¦†à¦ªà¦¡à§‡à¦Ÿ: ${uniq.join(', ')}</div>`;
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
          <div id="${ridEsc}_s" style="font-size:.80rem;line-height:1.5;color:rgba(255,255,255,0.82)">${shortEsc}${long?`<span onclick="document.getElementById('${ridEsc}_s').style.display='none';document.getElementById('${ridEsc}_f').style.display='block'" style="color:#00d9ff;cursor:pointer;font-size:.68rem;margin-left:4px">â–¼ à¦†à¦°à¦“</span>`:''}</div>
          ${long?`<div id="${ridEsc}_f" style="display:none;font-size:.80rem;line-height:1.5;color:rgba(255,255,255,0.82)">${descEsc}<span onclick="document.getElementById('${ridEsc}_f').style.display='none';document.getElementById('${ridEsc}_s').style.display='block'" style="color:#00d9ff;cursor:pointer;font-size:.68rem;margin-left:4px">â–² à¦•à¦®</span></div>`:''}
          ${absHtml}
        </td>
        <td style="padding:9px 7px;white-space:nowrap;font-size:.76rem">
          ${ok?'<span style="color:#00ff88;font-weight:700"><i class="fa fa-check-circle"></i> OK</span>':'<span style="color:#ff4757;font-weight:700"><i class="fa fa-circle-xmark"></i> Failed</span>'}
        </td>
        <td style="padding:9px 7px;font-size:.70rem;color:rgba(255,255,255,0.32);white-space:nowrap"><i class="fa fa-mobile-screen" style="font-size:.65rem"></i> ${dev}</td>
        <td style="padding:9px 12px;text-align:right;font-size:.70rem;color:rgba(255,255,255,0.32);white-space:nowrap">${l.time||(dt?dt.toLocaleString('en-US',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'â€”')}</td>
      </tr>`);
    }
    return rows.join('') || `<tr><td colspan="7" class="no-data">à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦°à§‡ à¦•à§‹à¦¨à§‹ result à¦¨à§‡à¦‡</td></tr>`;
  }

  // â”€â”€â”€ Recycle Bin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // âœ… Bug Fix: SupabaseSync.remove() writes to IndexedDB ('recycle_bin' table)
  //            but the old code read from localStorage 'wfa_recycle_bin'.
  //            Now we read from IDB first, then fall back to localStorage.
  function getDeletedItems() {
    try {
      // Primary source: IndexedDB (where SupabaseSync._addToRecycleBin writes)
      const idbBin = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll('recycle_bin') : [];
      if (Array.isArray(idbBin) && idbBin.length > 0) return idbBin;
      // Fallback: legacy localStorage (settings-specific deletes: categories, sub-accounts)
      const raw = Utils.safeJSON(localStorage.getItem('wfa_recycle_bin'), []);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function restoreItem(index) {
    // Read from the correct source (IDB-backed)
    const idbBin = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll('recycle_bin') : [];
    const isIDB = Array.isArray(idbBin) && idbBin.length > 0;
    const bin = isIDB ? idbBin : Utils.safeJSON(localStorage.getItem('wfa_recycle_bin'), []);
    const item = bin[index];

    // âœ… Req 2: handle settings-specific types locally (categories & sub-accounts)
    if (item && item.table === 'settings_category') {
      const { key, item: catItem } = item.data || {};
      if (key && catItem) {
        const cfg = getConfig();
        const items = Utils.safeJSON(cfg[key]) || [];
        if (!items.includes(catItem)) items.push(catItem);
        cfg[key] = JSON.stringify(items);
        saveConfig(cfg);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin); // fix: IDB-only
      Utils.toast(`Category "${item.data?.item}" restored âœ“`, 'success');
      refreshModal();
      return;
    }

    if (item && item.table === 'settings_subaccount') {
      const subData = item.data;
      if (subData) {
        SupabaseSync.insert(DB.sub_accounts || 'sub_accounts', subData);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin); // fix: IDB-only
      Utils.toast(`Sub-account @${item.data?.username} restored âœ“`, 'success');
      refreshModal();
      return;
    }

    // âœ… keep_records: restore note back to localStorage
    if (item && item.table === 'keep_records') {
      const noteData = item.data;
      if (noteData) {
        const notes = getKeepRecords();
        
        // âœ… IMPROVED: Use unique ID instead of title + date (more reliable)
        const noteId = noteData.id || `${(noteData.title || '').toLowerCase()}_${noteData.date || ''}`;
        const exists = notes.some(n => {
          const nId = n.id || `${(n.title || '').toLowerCase()}_${n.date || ''}`;
          return nId === noteId;
        });
        
        if (!exists) {
          // Ensure ID is set for future syncs
          if (!noteData.id) {
            noteData.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          }
          if (noteData.pinned) notes.unshift(noteData);
          else notes.push(noteData);
          _saveKeepRecords(notes); // fix: synced to Supabase
        }
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin); // fix: IDB-only
      _saveRecycleBinToSettings(); // fix: sync bin to Supabase
      // recycle bin updated above
      // (bin synced)

      logActivity('restore', 'note', `Restored note: ${item.data?.title || 'Untitled'}`);
      refreshModal();
      return;
    }

    // âœ… advance_payments restore
    if (item && item.table === 'advance_payments') {
      const data = item.data;
      if (data) {
        const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
        const exists = advances.some(a => a.id && a.id === data.id);
        if (!exists) advances.unshift(data);
        // âœ… Bug Fix: IDB-à¦ write à¦•à¦°à§‹, localStorage à¦¨à¦¯à¦¼ (SupabaseSync IDB à¦¥à§‡à¦•à§‡ à¦ªà¦¡à¦¼à§‡)
        SupabaseSync.setAll(DB.advance_payments || 'advance_payments', advances);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin);
      _saveRecycleBinToSettings();
      logActivity('restore', 'settings', `Restored advance payment: ${data?.person || 'Unknown'}`);
      Utils.toast('Advance payment restored âœ“', 'success');
      refreshModal();
      return;
    }

    // âœ… investments restore
    if (item && item.table === 'investments') {
      const data = item.data;
      if (data) {
        const investments = SupabaseSync.getAll(DB.investments || 'investments');
        const exists = investments.some(i => i.id && i.id === data.id);
        if (!exists) investments.unshift(data);
        // âœ… Bug Fix: IDB-à¦ write à¦•à¦°à§‹, localStorage à¦¨à¦¯à¦¼ (SupabaseSync IDB à¦¥à§‡à¦•à§‡ à¦ªà¦¡à¦¼à§‡)
        SupabaseSync.setAll(DB.investments || 'investments', investments);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin);
      _saveRecycleBinToSettings();
      logActivity('restore', 'settings', `Restored investment: ${data?.source || 'Unknown'}`);
      Utils.toast('Investment restored âœ“', 'success');
      refreshModal();
      return;
    }

    // Standard restore via SupabaseSync for all other DB records
    SupabaseSync.restoreRecycleBinItem(index).then((ok) => {
      if (ok) {
        Utils.toast('Item restored and synced', 'success');
        refreshModal();
        if (typeof App !== 'undefined' && App.updateNotifCount) App.updateNotifCount();
        if (item && item.table === 'salary' && typeof Salary !== 'undefined' && Salary.renderContent) {
          try { Salary.renderContent(); } catch { /* ignore */ }
        }
      } else {
        Utils.toast('Could not restore item', 'error');
      }
    });
  }

  function permanentDelete(index) {
    SupabaseSync.permanentDeleteRecycleBinItem(index);
    // Also clean up legacy localStorage bin if present
    _saveRecycleBinToSettings(); // fix: sync bin to Supabase after permanent delete
    // (legacy localStorage wfa_recycle_bin removed - IDB is the source of truth)
    Utils.toast('Removed from recycle bin', 'info');
    refreshModal();
  }

  function emptyRecycleBin() {
    SupabaseSync.emptyRecycleBin();
    Utils.toast('Recycle bin emptied', 'info');
    refreshModal();
  }

  // â”€â”€â”€ Keep Record (Notes) â€” localStorage-à¦ à¦†à¦²à¦¾à¦¦à¦¾à¦­à¦¾à¦¬à§‡ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // âœ… REDESIGN: keep_records à¦†à¦° settings table-à¦ à¦°à¦¾à¦–à¦¾ à¦¹à¦¬à§‡ à¦¨à¦¾à¥¤
  // à¦•à¦¾à¦°à¦£: settings table-à¦ à¦°à¦¾à¦–à¦²à§‡ â€”
  //   1. SupabaseSync.update('settings') â†’ activity log-à¦ "à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸ à¦†à¦ªà¦¡à§‡à¦Ÿ" à¦¦à§‡à¦–à¦¾à¦¯à¦¼ (à¦­à§à¦²)
  //   2. à¦ªà§à¦°à¦¤à¦¿ à§©à§¦ à¦¸à§‡à¦•à§‡à¦¨à§à¦¡à§‡ auto-pull settings overwrite â†’ à¦¨à§‹à¦Ÿ à¦­à§à¦¯à¦¾à¦¨à¦¿à¦¶
  //   3. realtime event-à¦ settings row overwrite â†’ keep_records à¦¹à¦¾à¦°à¦¾à¦¯à¦¼
  // à¦¸à¦®à¦¾à¦§à¦¾à¦¨: localStorage-à¦ 'wfa_keep_records_v2' key-à¦ à¦¸à¦°à¦¾à¦¸à¦°à¦¿ saveà¥¤

  function getKeepRecords() {
    return typeof SupabaseSync !== 'undefined' ? SupabaseSync.getAll(DB.keep_records || 'keep_records') : [];
  }

  function _saveKeepRecords(notes) {
    if (typeof SupabaseSync === 'undefined' || !SupabaseSync.setAll) return;
    const table = DB.keep_records || 'keep_records';
    SupabaseSync.setAll(table, Array.isArray(notes) ? notes : []);
  }

  // âœ… Migration: à¦ªà§à¦°à¦¨à§‹ data localStorage à¦¥à§‡à¦•à§‡ Supabase-à¦ à¦¸à¦¿à¦™à§à¦• à¦•à¦°à§‹
  function _migrateOfflineDataToCloud() {
    try {
      if (typeof SupabaseSync === 'undefined' || !SupabaseSync.insert) return;

      const keysToMigrate = [
        { localKey: 'wfa_keep_records_v2', table: 'keep_records' },
        { localKey: 'wfa_advance_payments', table: 'advance_payments' },
        { localKey: 'wfa_investments', table: 'investments' },
        { localKey: 'wfa_sub_accounts', table: 'sub_accounts' },
        { localKey: 'wfa_custom_themes', table: 'custom_themes' }
      ];

      let migrated = false;
      for (const { localKey, table } of keysToMigrate) {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const items = Utils.safeJSON(raw, []);
          if (Array.isArray(items) && items.length > 0) {
            items.forEach(item => SupabaseSync.insert(table, item, { silent: true }));
            console.info(`[Migration] Migrated ${items.length} items from ${localKey} to ${table}`);
            migrated = true;
          }
          // Remove local key so it doesn't migrate again
          localStorage.removeItem(localKey);
        }
      }
      if (migrated && typeof SupabaseSync.push === 'function') {
        SupabaseSync.push();
      }
    } catch(e) { console.warn('[Migration] Offline data migration failed:', e); }
  }

  // Run migration on load
  setTimeout(_migrateOfflineDataToCloud, 2000);

  // âœ… IMPROVED: Merge remote keep_records from cfg into local view after a Supabase pull
  // This prevents data loss when two devices edit notes simultaneously
  function _mergeRemoteKeepRecords() {
    try {
      const cfg = getConfig();
      if (!cfg.keep_records) return;
      
      const local = getKeepRecords();
      const remote = Utils.safeJSON(cfg.keep_records, []);
      
      if (!Array.isArray(remote) || remote.length === 0) return;
      
      // Merge strategy: preserve local pinned notes + merge by ID
      const localIds = new Set(local.map(n => _getNoteId(n)));
      const _remoteIds = new Set(remote.map(n => _getNoteId(n)));
      
      // 1. Keep local pinned notes (they're most recently edited)
      const pinnedLocal = local.filter(n => n.pinned);
      
      // 2. Add remote notes that don't exist locally
      const toAdd = remote.filter(n => !localIds.has(_getNoteId(n)));
      
      // 3. Merge: local is authoritative, remote adds missing notes
      const merged = [...pinnedLocal]; // start with pinned
      
      for (const note of toAdd) {
        if (note.pinned) merged.unshift(note);
        else merged.push(note);
      }
      
      // 4. Rebuild with local first (authoritative), then new remote notes
      const dedupIds = new Set();
      const final = [];
      for (const n of merged) {
        const id = _getNoteId(n);
        if (!dedupIds.has(id)) {
          dedupIds.add(id);
          final.push(n);
        }
      }
      
      // âœ… FIX: Actually save the merged notes back to config!
      if (final.length !== local.length) {
        _saveKeepRecords(final); // âœ… Save merged notes back
        console.info(`[Settings] Merged ${toAdd.length} remote keep_records, total: ${final.length}`);
      }
    } catch(e) { console.warn('[Settings] _mergeRemoteKeepRecords failed:', e); }
  }
  
  // Helper: generate unique ID for a note (for deduplication)
  function _getNoteId(note) {
    if (note.id) return note.id;
    // Fallback: generate from title + date (deterministic)
    return `${(note.title || '').toLowerCase()}_${note.date || ''}`;
  }

  // â”€â”€â”€ Recycle Bin Sync â€” saves last 50 items to settings table â”€â”€â”€
  // âœ… This piggybacks on the settings Supabase sync for cross-device visibility
  function _saveRecycleBinToSettings() {
    try {
      const bin = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll('recycle_bin') : [];
      if (!Array.isArray(bin)) return;
      const cfg = getConfig();
      cfg.recycle_bin_sync = JSON.stringify(bin.slice(0, 50)); // last 50 items
      saveConfig(cfg);
    } catch(e) { console.warn('[Settings] _saveRecycleBinToSettings failed:', e); }
  }

  function syncRecycleBin() {
    _saveRecycleBinToSettings();
  }

  // âœ… Merge remote recycle bin from settings into local IDB after a Supabase pull
  function _mergeRemoteRecycleBin() {
    try {
      const cfg = getConfig();
      if (!cfg.recycle_bin_sync) return;
      const remote = Utils.safeJSON(cfg.recycle_bin_sync, []);
      if (!Array.isArray(remote) || remote.length === 0) return;
      const localBin = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll('recycle_bin') : [];
      const localIds = new Set(localBin.map(b => b?.data?.id).filter(Boolean));
      const toMerge = remote.filter(r => r?.data?.id && !localIds.has(r.data.id));
      if (toMerge.length > 0) {
        const merged = [...toMerge, ...localBin].slice(0, 500);
        if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', merged);
        console.info(`[Settings] Merged ${toMerge.length} remote recycle bin item(s) into local IDB.`);
      }
    } catch(e) { console.warn('[Settings] _mergeRemoteRecycleBin failed:', e); }
  }

  function addNote() {
    openSettingsInternalModal('ðŸ“ à¦¨à¦¤à§à¦¨ à¦¨à§‹à¦Ÿ à¦¯à§‹à¦— à¦•à¦°à§à¦¨', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦Ÿà¦¾à¦‡à¦Ÿà§‡à¦² <span style="color:#ff4757">*</span></label>
          <input id="note-title" class="form-control" placeholder="à¦¨à§‹à¦Ÿà§‡à¦° à¦Ÿà¦¾à¦‡à¦Ÿà§‡à¦²..." style="width:100%;box-sizing:border-box" />
        </div>
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦°à¦™ à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨</label>
          <select id="note-color" class="form-control" style="width:100%;box-sizing:border-box">
            <option value="blue">ðŸ”µ à¦¨à§€à¦²</option>
            <option value="green">ðŸŸ¢ à¦¸à¦¬à§à¦œ</option>
            <option value="purple">ðŸŸ£ à¦¬à§‡à¦—à§à¦¨à¦¿</option>
            <option value="yellow">ðŸŸ¡ à¦¹à¦²à§à¦¦</option>
            <option value="red">ðŸ”´ à¦²à¦¾à¦²</option>
            <option value="orange">ðŸŸ  à¦•à¦®à¦²à¦¾</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤ / à¦•à¦¨à¦Ÿà§‡à¦¨à§à¦Ÿ</label>
        <textarea id="note-content" class="form-control" rows="4" placeholder="à¦¨à§‹à¦Ÿ à¦²à¦¿à¦–à§à¦¨..." style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦Ÿà§à¦¯à¦¾à¦— (comma à¦¦à¦¿à¦¯à¦¼à§‡ à¦†à¦²à¦¾à¦¦à¦¾ à¦•à¦°à§à¦¨)</label>
        <input id="note-tags" class="form-control" placeholder="à¦¯à§‡à¦®à¦¨: à¦—à§à¦°à§à¦¤à§à¦¬à¦ªà§‚à¦°à§à¦£, à¦«à¦¾à¦‡à¦¨à§à¦¯à¦¾à¦¨à§à¦¸, à¦¸à§à¦Ÿà¦¾à¦«" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <input type="checkbox" id="note-pin" style="width:16px;height:16px;cursor:pointer" />
        <label for="note-pin" style="font-size:.85rem;color:rgba(255,255,255,0.7);cursor:pointer">ðŸ“Œ à¦‰à¦ªà¦°à§‡ à¦ªà¦¿à¦¨ à¦•à¦°à§à¦¨</label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:9px 18px;border-radius:8px;cursor:pointer;font-size:.85rem">à¦¬à¦¾à¦¤à¦¿à¦²</button>
        <button onclick="SettingsModule.saveNote()" style="background:linear-gradient(135deg,#b537f2,#7c3aed);border:none;color:#fff;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700"><i class="fa fa-check" style="margin-right:6px"></i>à¦¸à§‡à¦­ à¦•à¦°à§à¦¨</button>
      </div>
    `);
  }

  function saveNote() {
    const title   = document.getElementById('note-title')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    const color   = document.getElementById('note-color')?.value || 'blue';
    const tagsRaw = document.getElementById('note-tags')?.value || '';
    const pinned  = document.getElementById('note-pin')?.checked || false;
    if (!title && !content) { Utils.toast('à¦•à¦¿à¦›à§ à¦²à¦¿à¦–à§à¦¨', 'error'); return; }
    const tags = tagsRaw.split(',').map(t=>t.trim()).filter(Boolean);
    const _notes = getKeepRecords();
    // âœ… FIX: Add unique ID and timestamp for proper sync
    const entry = { 
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), // unique ID
      title: title||'Untitled', 
      content: content||'', 
      color, tags, pinned, 
      date: new Date().toLocaleDateString('en-GB'),
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };
    SupabaseSync.insert(DB.keep_records || 'keep_records', entry);
    closeSettingsInternalModal();
    Utils.toast('à¦¨à§‹à¦Ÿ à¦¸à§‡à¦­ à¦¹à¦¯à¦¼à§‡à¦›à§‡ âœ“', 'success');
    logActivity('add', 'note', `Added note: ${title}`);
    _refreshKeepRecordGrid(); // âœ… FIX: Refresh only notes grid, not entire modal
  }

  // âœ… NEW: Lightweight grid refresh for Keep Record (prevents flickering)
  function _refreshKeepRecordGrid() {
    if (activeTab !== 'keeprecord') return; // Only if Keep Record tab is active
    const grid = document.getElementById('kr-notes-grid');
    if (!grid) return;
    
    const notes = getKeepRecords();
    const colorMap = { red:'#ff4757', green:'#00ff88', blue:'#00d9ff', yellow:'#ffd700', purple:'#b537f2', orange:'#ff6b35' };
    const bgMap    = { red:'rgba(255,71,87,0.10)', green:'rgba(0,255,136,0.08)', blue:'rgba(0,217,255,0.08)', yellow:'rgba(255,215,0,0.08)', purple:'rgba(181,55,242,0.10)', orange:'rgba(255,107,53,0.10)' };
    const borderMap = { red:'rgba(255,71,87,0.30)', green:'rgba(0,255,136,0.25)', blue:'rgba(0,217,255,0.25)', yellow:'rgba(255,215,0,0.25)', purple:'rgba(181,55,242,0.30)', orange:'rgba(255,107,53,0.25)' };
    
    if (notes.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><i class="fa fa-flag" style="font-size:2.5rem;color:#b537f2;opacity:.4;display:block;margin-bottom:14px"></i><div style="color:var(--text-muted);font-size:.9rem;margin-bottom:8px">à¦•à§‹à¦¨à§‹ à¦¨à§‹à¦Ÿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿</div><div style="color:#00ff88;font-size:.82rem">à¦¨à¦¤à§à¦¨ à¦¨à§‹à¦Ÿ à¦¯à§‹à¦— à¦•à¦°à¦¤à§‡ à¦‰à¦ªà¦°à§‡à¦° à¦¬à¦¾à¦Ÿà¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§à¦¨</div></div>`;
      return;
    }
    
    grid.innerHTML = notes.map((n, i) => {
      const c = n.color || 'blue';
      const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
      return `<div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700" title="Pinned">ðŸ“Œ</div>' : ''}<button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">âœï¸</button><button onclick="SettingsModule.deleteNote(${i})" title="Delete â†’ Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">âœ•</button><div style="font-weight:700;color:${colorMap[c]||colorMap.blue};font-size:.92rem;margin-bottom:8px;padding-right:28px;line-height:1.3">${Utils.esc(n.title||'Untitled')}</div>${n.content ? `<div style="font-size:.82rem;color:rgba(255,255,255,0.72);line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${Utils.esc(n.content)}</div>` : ''}<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px"><div style="display:flex;gap:5px;flex-wrap:wrap">${(n.tags||[]).map(t=>`<span style="font-size:.68rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:10px;padding:2px 8px">${Utils.esc(t)}</span>`).join('')}</div><span style="font-size:.7rem;color:rgba(255,255,255,0.3)">${n.date||''}</span></div></div>`;
    }).join('');
  }

  function deleteNote(index) {
    const notes = getKeepRecords();
    const victim = notes[index];
    if (!victim) return;
    
    // âœ… IMPROVED: Add unique ID if missing (for older notes)
    if (!victim.id) {
      victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }
    
    // âœ… Fix: Send note to Recycle Bin before removing
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('keep_records', victim);
    } else {
      // Fallback: write directly to localStorage recycle bin
      try {
        const bin = Utils.safeJSON(localStorage.getItem('wfa_recycle_bin'), []);
        bin.unshift({
          id: victim.id, // âœ… NEW: unique ID for proper restore
          table: 'keep_records',
          data: (typeof structuredClone === 'function') ? structuredClone(victim) : JSON.parse(JSON.stringify(victim)),
          deletedAt: new Date().toISOString(),
          type: 'à¦¨à§‹à¦Ÿ',
          name: victim.title || 'Untitled Note',
          tableLabel: 'Keep Record',
        });
        if (bin.length > 200) bin.length = 200;
        if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.setAll === 'function') {
          SupabaseSync.setAll('recycle_bin', bin);
        }
      } catch(e) { console.warn('[Recycle] note delete failed:', e); }
    }
    SupabaseSync.remove(DB.keep_records || 'keep_records', victim.id); // âœ… sync recycle bin after note delete
    Utils.toast('à¦¨à§‹à¦Ÿ à¦°à¦¿à¦¸à¦¾à¦‡à¦•à§‡à¦² à¦¬à¦¿à¦¨à§‡ à¦—à§‡à¦›à§‡ ðŸ—‘ï¸', 'info');
    logActivity('delete', 'note', `Deleted note: ${victim.title || 'Untitled'}`);
    _refreshKeepRecordGrid(); // âœ… FIX: Refresh only notes grid, not entire modal
  }

  function editNote(index) {
    const notes = getKeepRecords();
    const n = notes[index];
    if (!n) return;
    openSettingsInternalModal('âœï¸ à¦¨à§‹à¦Ÿ à¦à¦¡à¦¿à¦Ÿ à¦•à¦°à§à¦¨', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦Ÿà¦¾à¦‡à¦Ÿà§‡à¦² <span style="color:#ff4757">*</span></label>
          <input id="note-title" class="form-control" placeholder="à¦¨à§‹à¦Ÿà§‡à¦° à¦Ÿà¦¾à¦‡à¦Ÿà§‡à¦²..." value="${Utils.esc(n.title||'')}" style="width:100%;box-sizing:border-box" />
        </div>
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦°à¦™ à¦¬à§‡à¦›à§‡ à¦¨à¦¿à¦¨</label>
          <select id="note-color" class="form-control" style="width:100%;box-sizing:border-box">
            <option value="blue" ${n.color==='blue'?'selected':''}>ðŸ”µ à¦¨à§€à¦²</option>
            <option value="green" ${n.color==='green'?'selected':''}>ðŸŸ¢ à¦¸à¦¬à§à¦œ</option>
            <option value="purple" ${n.color==='purple'?'selected':''}>ðŸŸ£ à¦¬à§‡à¦—à§à¦¨à¦¿</option>
            <option value="yellow" ${n.color==='yellow'?'selected':''}>ðŸŸ¡ à¦¹à¦²à§à¦¦</option>
            <option value="red" ${n.color==='red'?'selected':''}>ðŸ”´ à¦²à¦¾à¦²</option>
            <option value="orange" ${n.color==='orange'?'selected':''}>ðŸŸ  à¦•à¦®à¦²à¦¾</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤ / à¦•à¦¨à¦Ÿà§‡à¦¨à§à¦Ÿ</label>
        <textarea id="note-content" class="form-control" rows="4" placeholder="à¦¨à§‹à¦Ÿ à¦²à¦¿à¦–à§à¦¨..." style="width:100%;box-sizing:border-box;resize:vertical">${Utils.esc(n.content||'')}</textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">à¦Ÿà§à¦¯à¦¾à¦— (comma à¦¦à¦¿à¦¯à¦¼à§‡ à¦†à¦²à¦¾à¦¦à¦¾ à¦•à¦°à§à¦¨)</label>
        <input id="note-tags" class="form-control" placeholder="à¦¯à§‡à¦®à¦¨: à¦—à§à¦°à§à¦¤à§à¦¬à¦ªà§‚à¦°à§à¦£, à¦«à¦¾à¦‡à¦¨à§à¦¯à¦¾à¦¨à§à¦¸, à¦¸à§à¦Ÿà¦¾à¦«" value="${Utils.esc((n.tags||[]).join(', '))}" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <input type="checkbox" id="note-pin" ${n.pinned?'checked':''} style="width:16px;height:16px;cursor:pointer" />
        <label for="note-pin" style="font-size:.85rem;color:rgba(255,255,255,0.7);cursor:pointer">ðŸ“Œ à¦‰à¦ªà¦°à§‡ à¦ªà¦¿à¦¨ à¦•à¦°à§à¦¨</label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:9px 18px;border-radius:8px;cursor:pointer;font-size:.85rem">à¦¬à¦¾à¦¤à¦¿à¦²</button>
        <button onclick="SettingsModule.saveEditedNote(${index})" style="background:linear-gradient(135deg,#00d9ff,#0099bb);border:none;color:#fff;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700"><i class="fa fa-save" style="margin-right:6px"></i>à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§à¦¨</button>
      </div>
    `);
  }

  function saveEditedNote(index) {
    const title   = document.getElementById('note-title')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    const color   = document.getElementById('note-color')?.value || 'blue';
    const tagsRaw = document.getElementById('note-tags')?.value || '';
    const pinned  = document.getElementById('note-pin')?.checked || false;
    if (!title && !content) { Utils.toast('à¦•à¦¿à¦›à§ à¦²à¦¿à¦–à§à¦¨', 'error'); return; }
    const tags  = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const notes = getKeepRecords();
    if (!notes[index]) { Utils.toast('à¦¨à§‹à¦Ÿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿', 'error'); return; }
    
    // âœ… IMPROVED: Preserve ID and timestamps for proper sync
    const oldNote = notes[index];
    notes[index] = { 
      ...oldNote,
      title: title||'Untitled', 
      content: content||'', 
      color, tags, pinned, 
      modified: new Date().toISOString() // âœ… timestamp for sync resolution
    };
    
    SupabaseSync.update(DB.keep_records || 'keep_records', oldNote.id, notes[index]);
    closeSettingsInternalModal();
    Utils.toast('à¦¨à§‹à¦Ÿ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡ âœ“', 'success');
    logActivity('edit', 'note', `Edited note: ${title}`);
    _refreshKeepRecordGrid(); // âœ… FIX: Refresh only notes grid, not entire modal
  }

  // â”€â”€â”€ Settings-à¦à¦° à¦­à§‡à¦¤à¦°à§‡ à¦¨à¦¿à¦œà¦¸à§à¦¬ modal (z-index à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¸à¦®à¦¾à¦§à¦¾à¦¨) â”€â”€â”€
  function openSettingsInternalModal(title, bodyHTML, maxWidth = '480px') {
    const old = document.getElementById('settings-inner-modal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'settings-inner-modal';
    wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:999999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);padding:20px;box-sizing:border-box;';
    wrap.innerHTML = `
      <div style="background:var(--bg-surface,#0e1628);border:1px solid rgba(0,212,255,0.25);border-radius:14px;padding:28px;width:100%;max-width:${maxWidth};max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.7);position:relative;animation:fadeUp .2s ease;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div style="font-size:1rem;font-weight:800;color:#fff">${title}</div>
          <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">âœ•</button>
        </div>
        ${bodyHTML}
      </div>`;
    wrap.addEventListener('click', e => { if (e.target === wrap) closeSettingsInternalModal(); });
    document.body.appendChild(wrap);
    // âœ… à¦²à¦œà¦¿à¦• à§ª FIX: inner modal-à¦à¦° à¦¸à¦¬ date inputs-à¦ Flatpickr (DD/MM/YYYY) apply à¦•à¦°à§‹
    // adv-date, ret-adv-date, inv-date, ret-inv-date à¦¸à¦¹ à¦¯à§‡à¦•à§‹à¦¨à§‹ à¦­à¦¬à¦¿à¦·à§à¦¯à§Ž date input
    setTimeout(() => {
      wrap.querySelectorAll('input[type="date"]:not([disabled])').forEach(el => {
        if (!el._flatpickr && typeof Utils !== 'undefined' && Utils.initFlatpickrOnElement) {
          Utils.initFlatpickrOnElement(el, {
            dateFormat:  'Y-m-d',
            altInput:    true,
            altFormat:   'd/m/Y',
            allowInput:  true,
            locale:      { firstDayOfWeek: 1 },
          });
        }
      });
    }, 10);
  }

  function closeSettingsInternalModal() {
    const el = document.getElementById('settings-inner-modal');
    if (el) el.remove();
  }

  // â”€â”€â”€ Advance Payments & Investments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function addAdvancePayment() {
    openSettingsInternalModal('ðŸ’° Add Advance Payment', `
      <div style="background:linear-gradient(135deg,rgba(0,255,136,0.06),rgba(0,212,255,0.04));border:1px solid rgba(0,255,136,0.15);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,rgba(0,255,136,0.18),rgba(0,212,255,0.12));display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,255,136,0.25)">
          <i class="fa fa-money-bill-wave" style="color:#00ff88;font-size:1.1rem"></i>
        </div>
        <div>
          <div style="font-size:.78rem;font-weight:800;color:#00ff88;letter-spacing:.8px">NEW ADVANCE</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,0.4);margin-top:2px">Record a salary or operational advance payment</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Person Name <span style="color:#ff4757">*</span></label>
        <div style="position:relative">
          <i class="fa fa-user" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(0,255,136,0.4);font-size:.82rem;pointer-events:none"></i>
          <input id="adv-person" class="form-control" placeholder="e.g. Shakib" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)" />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div>
          <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Amount (à§³) <span style="color:#ff4757">*</span></label>
          <div style="position:relative">
            <i class="fa fa-bangladeshi-taka-sign" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(0,255,136,0.4);font-size:.82rem;pointer-events:none"></i>
            <input id="adv-amount" type="number" class="form-control" placeholder="0" style="padding-left:36px;border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)" />
          </div>
        </div>
        <div>
          <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Date <span style="color:#ff4757">*</span></label>
          <input id="adv-date" type="date" class="form-control" value="${Utils.today()}" style="border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)" />
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Payment Method <span style="color:#ff4757">*</span></label>
        <select id="adv-method" class="form-control" style="width:100%;border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)">
          <option value="">â€” Select Method â€”</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>

      <div style="margin-bottom:22px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Note</label>
        <div style="position:relative">
          <i class="fa fa-note-sticky" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(0,255,136,0.3);font-size:.82rem;pointer-events:none"></i>
          <input id="adv-note" class="form-control" placeholder="Optional noteâ€¦" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)" />
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);padding:10px 20px;border-radius:10px;cursor:pointer;font-size:.85rem;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,0.09)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Cancel</button>
        <button onclick="SettingsModule.saveAdvancePayment()" style="background:linear-gradient(135deg,#00cc6e,#00ff88);color:#000;font-weight:900;padding:10px 24px;border-radius:10px;cursor:pointer;border:none;font-size:.88rem;letter-spacing:.5px;box-shadow:0 4px 18px rgba(0,255,136,0.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(0,255,136,0.50)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 18px rgba(0,255,136,0.35)'"><i class="fa fa-check" style="margin-right:6px"></i>Save Advance</button>
      </div>
    `);
  }

  function saveAdvancePayment() {
    const person = document.getElementById('adv-person')?.value?.trim() || '';
    const amount = parseFloat(document.getElementById('adv-amount')?.value) || 0;
    const method = document.getElementById('adv-method')?.value || '';
    const date   = document.getElementById('adv-date')?.value || Utils.today();
    const note   = document.getElementById('adv-note')?.value || '';
    if (!person) { Utils.toast('Person name required', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('Amount required', 'error'); return; }
    if (!method) { Utils.toast('Payment method required', 'error'); return; }
    if (typeof Utils.getAccountBalance === 'function') {
      const available = Utils.getAccountBalance(method);
      if (available < amount) { Utils.toast(`Insufficient funds in ${method}. Available: à§³${available.toLocaleString()}`, 'error'); return; }
    }
    const newAdv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), person, amount, method, date, note, returns: [] };
    SupabaseSync.insert(DB.advance_payments || 'advance_payments', newAdv);
    const _finEntry = SupabaseSync.insert(DB.finance, {
      type: 'Expense', method, category: 'Advance Payment',
      description: `Advance to ${person}`, amount, date, note,
      _advId: newAdv.id  // link à¦•à¦°à¦¾à¦° à¦œà¦¨à§à¦¯
    });
    // âœ… FIX: Account balance à¦•à¦®à¦¾à¦“ (Advance à¦¦à§‡à¦“à¦¯à¦¼à¦¾ = à¦Ÿà¦¾à¦•à¦¾ à¦¬à§‡à¦° à¦¹à¦¯à¦¼)
    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'out');
    }
    closeSettingsInternalModal();
    Utils.toast('Advance payment saved âœ“', 'success');
    refreshModal();
  }

  function deleteAdvance(idx) {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    if (!advances[idx]) return;
    const victim = advances[idx];
    if (!window.confirm(`"${victim.person}"-à¦à¦° advance payment à¦¡à¦¿à¦²à¦¿à¦Ÿ à¦•à¦°à¦¬à§‡à¦¨? Recycle Bin-à¦ à¦¯à¦¾à¦¬à§‡à¥¤`)) return;

    // Recycle Bin-à¦ à¦ªà¦¾à¦ à¦¾à¦“
    if (!victim.id) victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('advance_payments', victim);
    }

    // âœ… FIX: Finance linked entry reverse à¦•à¦°à§‹
    const finEntries = SupabaseSync.getAll(DB.finance).filter(f =>
      f.category === 'Advance Payment' && f.type === 'Expense' &&
      (f._advId === victim.id ||
       (f.description && f.description.includes(victim.person) &&
        parseFloat(f.amount) === parseFloat(victim.amount)))
    );
    var totalFinLinked = 0;
    finEntries.forEach(f => {
      totalFinLinked += parseFloat(f.amount) || 0;
      SupabaseSync.remove(DB.finance, f.id, { bypassLog: true });
    });
    // âœ… FIX: Account balance à¦«à§‡à¦°à¦¤ à¦¦à¦¾à¦“ (Expense à¦›à¦¿à¦² â†’ 'in' à¦•à¦°à§‹)
    if (victim.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      const reverseAmt = totalFinLinked > 0 ? totalFinLinked : parseFloat(victim.amount) || 0;
      if (reverseAmt > 0) SupabaseSync.updateAccountBalance(victim.method, reverseAmt, 'in');
    }

    SupabaseSync.remove(DB.advance_payments || 'advance_payments', victim.id);
    logActivity('delete', 'settings', `Advance payment deleted: ${victim.person} à§³${Number(victim.amount||0).toLocaleString()} (Finance reversed)`);
    Utils.toast(`"${victim.person}"-à¦à¦° advance â€” Recycle Bin-à¦ à¦—à§‡à¦›à§‡ âœ“`, 'warning');
    refreshModal();
  }

  function openReturnAdvanceModal(idx) {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    const a = advances[idx];
    if (!a) return;
    const returns = a.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const remaining = (parseFloat(a.amount) || 0) - totalReturned;
    openSettingsInternalModal(`â†©ï¸ Return Advance â€” ${Utils.esc(a.person)}`, `
      <div style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Original Amount</span><span style="color:#00ff88;font-weight:700">à§³${(parseFloat(a.amount)||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Already Returned</span><span style="color:#00d4ff;font-weight:700">à§³${totalReturned.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#aaa;font-size:.83rem">Remaining</span><span style="color:#ff4757;font-weight:800;font-size:1.1rem">à§³${remaining.toLocaleString()}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Return Amount (à§³) <span style="color:#ff4757">*</span></label>
          <input id="ret-adv-amount" type="number" class="form-control" placeholder="0" max="${remaining}" />
        </div>
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Date <span style="color:#ff4757">*</span></label>
          <input id="ret-adv-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Received In (Account)</label>
        <select id="ret-adv-method" class="form-control" style="width:100%">
          <option value="${a.method||'Cash'}" selected>${a.method||'Cash'} (Original)</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : ''}
        </select>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Note</label>
        <input id="ret-adv-note" class="form-control" placeholder="Optional" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 18px;border-radius:8px;cursor:pointer">Cancel</button>
        <button onclick="SettingsModule.saveReturnAdvance(${idx})" style="background:linear-gradient(135deg,#00d4ff,#0099bb);color:#000;font-weight:800;padding:8px 22px;border-radius:8px;cursor:pointer;border:none"><i class="fa fa-rotate-left"></i> Confirm Return</button>
      </div>
    `);
  }

  function saveReturnAdvance(idx) {
    const retAmount = parseFloat(document.getElementById('ret-adv-amount')?.value) || 0;
    const retDate   = document.getElementById('ret-adv-date')?.value || Utils.today();
    const retMethod = document.getElementById('ret-adv-method')?.value || 'Cash';
    const retNote   = document.getElementById('ret-adv-note')?.value || '';
    const advances  = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    const a = advances[idx];
    if (!a) return;
    const totalReturned = (a.returns||[]).reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(a.amount)||0) - totalReturned;
    if (!retAmount || retAmount <= 0) { Utils.toast('Return amount required', 'error'); return; }
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining à§³${remaining.toLocaleString()}`, 'error'); return; }
    if (!advances[idx].returns) advances[idx].returns = [];
    advances[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    SupabaseSync.update(DB.advance_payments || 'advance_payments', advances[idx].id, advances[idx]);
    SupabaseSync.insert(DB.finance, {
      type: 'Income', method: retMethod, category: 'Advance Return',
      description: `Advance return from ${a.person}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of à§³${retAmount.toLocaleString()} recorded âœ“`, 'success');
    refreshModal();
  }

  function viewAdvanceLedger(idx) {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    const a = advances[idx];
    if (!a) return;
    const returns = a.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(a.amount)||0) - totalReturned;
    const rows = [
      `<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${a.date}</td>
        <td style="padding:10px 8px"><span style="background:rgba(255,71,87,0.15);color:#ff4757;padding:2px 8px;border-radius:20px;font-size:.75rem">Advance Given</span></td>
        <td style="padding:10px 8px;text-align:right;color:#ff4757;font-weight:700">âˆ’à§³${(parseFloat(a.amount)||0).toLocaleString()}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(a.method)}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(a.note)||'â€”'}</td>
      </tr>`,
      ...returns.map((r, ri) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.date}</td>
          <td style="padding:10px 8px"><span style="background:rgba(0,255,136,0.15);color:#00ff88;padding:2px 8px;border-radius:20px;font-size:.75rem">Return #${ri+1}</span></td>
          <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">+à§³${(parseFloat(r.amount)||0).toLocaleString()}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.method)||'â€”'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.note)||'â€”'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`ðŸ“‹ Advance Ledger â€” ${Utils.esc(a.person)}`, `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:100px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Advanced</div><div style="color:#ff4757;font-weight:800">à§³${(parseFloat(a.amount)||0).toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Returned</div><div style="color:#00d4ff;font-weight:800">à§³${totalReturned.toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Remaining</div><div style="color:${remaining<=0?'#00ff88':'#ffd700'};font-weight:800">à§³${remaining.toLocaleString()}</div></div>
      </div>
      <div style="overflow-x:auto;max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:8px">
        <table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;background:var(--bg-surface,#0e1628)">
            <tr>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Date</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Type</th>
              <th style="padding:8px;text-align:right;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Amount</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Account</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 20px;border-radius:8px;cursor:pointer">Close</button>
      </div>
    `);
  }

  function addInvestment() {
    openSettingsInternalModal('ðŸ“ˆ Add Investment', `
      <div style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(124,58,237,0.05));border:1px solid rgba(168,85,247,0.20);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,rgba(168,85,247,0.22),rgba(124,58,237,0.15));display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(168,85,247,0.30)">
          <i class="fa fa-chart-line" style="color:#c084fc;font-size:1.1rem"></i>
        </div>
        <div>
          <div style="font-size:.78rem;font-weight:800;color:#c084fc;letter-spacing:.8px">NEW INVESTMENT</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,0.4);margin-top:2px">Record incoming capital from investors or partners</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Investor / Source <span style="color:#ff4757">*</span></label>
        <div style="position:relative">
          <i class="fa fa-building" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(168,85,247,0.45);font-size:.82rem;pointer-events:none"></i>
          <input id="inv-source" class="form-control" placeholder="e.g. Rahim, Company XYZ" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)" />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div>
          <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Amount (à§³) <span style="color:#ff4757">*</span></label>
          <div style="position:relative">
            <i class="fa fa-bangladeshi-taka-sign" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(168,85,247,0.45);font-size:.82rem;pointer-events:none"></i>
            <input id="inv-amount" type="number" class="form-control" placeholder="0" style="padding-left:36px;border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)" />
          </div>
        </div>
        <div>
          <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Date <span style="color:#ff4757">*</span></label>
          <input id="inv-date" type="date" class="form-control" value="${Utils.today()}" style="border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)" />
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Deposit To (Account) <span style="color:#ff4757">*</span></label>
        <select id="inv-method" class="form-control" style="width:100%;border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)">
          <option value="">â€” Select Account â€”</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>

      <div style="margin-bottom:22px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Note</label>
        <div style="position:relative">
          <i class="fa fa-note-sticky" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(168,85,247,0.35);font-size:.82rem;pointer-events:none"></i>
          <input id="inv-note" class="form-control" placeholder="Optional noteâ€¦" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)" />
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);padding:10px 20px;border-radius:10px;cursor:pointer;font-size:.85rem;transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,0.09)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Cancel</button>
        <button onclick="SettingsModule.saveInvestment()" style="background:linear-gradient(135deg,#9333ea,#a855f7);color:#fff;font-weight:900;padding:10px 24px;border-radius:10px;cursor:pointer;border:none;font-size:.88rem;letter-spacing:.5px;box-shadow:0 4px 18px rgba(168,85,247,0.40);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(168,85,247,0.55)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 18px rgba(168,85,247,0.40)'"><i class="fa fa-check" style="margin-right:6px"></i>Save Investment</button>
      </div>
    `);
  }

  function saveInvestment() {
    const source = document.getElementById('inv-source')?.value?.trim() || '';
    const amount = parseFloat(document.getElementById('inv-amount')?.value) || 0;
    const method = document.getElementById('inv-method')?.value || '';
    const date   = document.getElementById('inv-date')?.value || Utils.today();
    const note   = document.getElementById('inv-note')?.value || '';
    if (!source) { Utils.toast('Source/Investor name required', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('Amount required', 'error'); return; }
    if (!method) { Utils.toast('Account required', 'error'); return; }
    const newInv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), source, amount, method, date, note, returns: [] };
    SupabaseSync.insert(DB.investments || 'investments', newInv);
    SupabaseSync.insert(DB.finance, {
      type: 'Investment In', method, category: 'Investment Receiving',
      description: `Investment from ${source}`, amount, date, note,
      _invId: newInv.id  // link à¦•à¦°à¦¾à¦° à¦œà¦¨à§à¦¯
    });
    // âœ… FIX: Account balance à¦¬à¦¾à¦¡à¦¼à¦¾à¦“ (Investment à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ = à¦Ÿà¦¾à¦•à¦¾ à¦†à¦¸à§‡)
    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'in');
    }
    closeSettingsInternalModal();
    Utils.toast('Investment saved âœ“', 'success');
    refreshModal();
  }

  function deleteInvestment(idx) {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    if (!investments[idx]) return;
    const victim = investments[idx];
    if (!window.confirm(`"${victim.source}"-à¦à¦° investment à¦¡à¦¿à¦²à¦¿à¦Ÿ à¦•à¦°à¦¬à§‡à¦¨? Recycle Bin-à¦ à¦¯à¦¾à¦¬à§‡à¥¤`)) return;

    // Recycle Bin-à¦ à¦ªà¦¾à¦ à¦¾à¦“
    if (!victim.id) victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('investments', victim);
    }

    // âœ… FIX: Finance linked entry reverse à¦•à¦°à§‹
    const finEntries = SupabaseSync.getAll(DB.finance).filter(f =>
      f.category === 'Investment Receiving' &&
      (f._invId === victim.id ||
       (f.description && f.description.includes(victim.source) &&
        parseFloat(f.amount) === parseFloat(victim.amount)))
    );
    var totalFinLinked = 0;
    finEntries.forEach(f => {
      totalFinLinked += parseFloat(f.amount) || 0;
      SupabaseSync.remove(DB.finance, f.id, { bypassLog: true });
    });
    // âœ… FIX: Account balance à¦«à§‡à¦°à¦¤ à¦¦à¦¾à¦“ (Investment In à¦›à¦¿à¦² â†’ 'out' à¦•à¦°à§‹)
    if (victim.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      const reverseAmt = totalFinLinked > 0 ? totalFinLinked : parseFloat(victim.amount) || 0;
      if (reverseAmt > 0) SupabaseSync.updateAccountBalance(victim.method, reverseAmt, 'out');
    }

    SupabaseSync.remove(DB.investments || 'investments', victim.id);
    logActivity('delete', 'settings', `Investment deleted: ${victim.source} à§³${Number(victim.amount||0).toLocaleString()} (Finance reversed)`);
    Utils.toast(`"${victim.source}"-à¦à¦° investment â€” Recycle Bin-à¦ à¦—à§‡à¦›à§‡ âœ“`, 'warning');
    refreshModal();
  }

  function openReturnInvestmentModal(idx) {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    const inv = investments[idx];
    if (!inv) return;
    const returns = inv.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(inv.amount)||0) - totalReturned;
    openSettingsInternalModal(`â†©ï¸ Return Investment â€” ${inv.source}`, `
      <div style="background:rgba(138,43,226,0.08);border:1px solid rgba(138,43,226,0.25);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Total Invested</span><span style="color:#a855f7;font-weight:700">à§³${(parseFloat(inv.amount)||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Already Returned</span><span style="color:#00d4ff;font-weight:700">à§³${totalReturned.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#aaa;font-size:.83rem">Remaining to Return</span><span style="color:#ffd700;font-weight:800;font-size:1.1rem">à§³${remaining.toLocaleString()}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Return Amount (à§³) <span style="color:#ff4757">*</span></label>
          <input id="ret-inv-amount" type="number" class="form-control" placeholder="0" max="${remaining}" />
        </div>
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Date <span style="color:#ff4757">*</span></label>
          <input id="ret-inv-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Paid From (Account)</label>
        <select id="ret-inv-method" class="form-control" style="width:100%">
          <option value="${inv.method||'Cash'}" selected>${inv.method||'Cash'} (Original)</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : ''}
        </select>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Note</label>
        <input id="ret-inv-note" class="form-control" placeholder="Optional" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 18px;border-radius:8px;cursor:pointer">Cancel</button>
        <button onclick="SettingsModule.saveReturnInvestment(${idx})" style="background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:800;padding:8px 22px;border-radius:8px;cursor:pointer;border:none"><i class="fa fa-rotate-left"></i> Confirm Return</button>
      </div>
    `);
  }

  function saveReturnInvestment(idx) {
    const retAmount = parseFloat(document.getElementById('ret-inv-amount')?.value) || 0;
    const retDate   = document.getElementById('ret-inv-date')?.value || Utils.today();
    const retMethod = document.getElementById('ret-inv-method')?.value || 'Cash';
    const retNote   = document.getElementById('ret-inv-note')?.value || '';
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    const inv = investments[idx];
    if (!inv) return;
    const totalReturned = (inv.returns||[]).reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(inv.amount)||0) - totalReturned;
    if (!retAmount || retAmount <= 0) { Utils.toast('Return amount required', 'error'); return; }
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining à§³${remaining.toLocaleString()}`, 'error'); return; }
    if (!investments[idx].returns) investments[idx].returns = [];
    investments[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    SupabaseSync.update(DB.investments || 'investments', investments[idx].id, investments[idx]);
    SupabaseSync.insert(DB.finance, {
      type: 'Investment Out', method: retMethod, category: 'Investment Return',
      description: `Investment return to ${inv.source}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of à§³${retAmount.toLocaleString()} recorded âœ“`, 'success');
    refreshModal();
  }

  function viewInvestmentLedger(idx) {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    const inv = investments[idx];
    if (!inv) return;
    const returns = inv.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(inv.amount)||0) - totalReturned;
    const rows = [
      `<tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${inv.date}</td>
        <td style="padding:10px 8px"><span style="background:rgba(168,85,247,0.15);color:#a855f7;padding:2px 8px;border-radius:20px;font-size:.75rem">Investment In</span></td>
        <td style="padding:10px 8px;text-align:right;color:#a855f7;font-weight:700">+à§³${(parseFloat(inv.amount)||0).toLocaleString()}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${inv.method}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${inv.note||'â€”'}</td>
      </tr>`,
      ...returns.map((r, ri) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.date}</td>
          <td style="padding:10px 8px"><span style="background:rgba(255,71,87,0.15);color:#ff4757;padding:2px 8px;border-radius:20px;font-size:.75rem">Return #${ri+1}</span></td>
          <td style="padding:10px 8px;text-align:right;color:#ff4757;font-weight:700">âˆ’à§³${(parseFloat(r.amount)||0).toLocaleString()}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.method)||'â€”'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.note)||'â€”'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`ðŸ“‹ Investment Ledger â€” ${Utils.esc(inv.source)}`, `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:100px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Invested</div><div style="color:#a855f7;font-weight:800">à§³${(parseFloat(inv.amount)||0).toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Returned</div><div style="color:#00d4ff;font-weight:800">à§³${totalReturned.toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Outstanding</div><div style="color:${remaining<=0?'#00ff88':'#ffd700'};font-weight:800">à§³${remaining.toLocaleString()}</div></div>
      </div>
      <div style="overflow-x:auto;max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:8px">
        <table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;background:var(--bg-surface,#0e1628)">
            <tr>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Date</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Type</th>
              <th style="padding:8px;text-align:right;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Amount</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Account</th>
              <th style="padding:8px;text-align:left;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08)">Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 20px;border-radius:8px;cursor:pointer">Close</button>
      </div>
    `);
  }

  function showLiveAccountSnapshot() {
    const accounts = SupabaseSync.getAll(DB.accounts) || [];
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const rows = accounts.length
      ? accounts.map((a, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(a.name || a.type || 'â€”')}</td>
            <td>${esc(a.type || 'â€”')}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">à§³${(parseFloat(a.balance) || 0).toLocaleString()}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="no-data">No account rows in local cache</td></tr>';
    const total = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    Utils.openModal('Account balances (current snapshot)', `
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px">Live totals from <code>accounts</code> in local cache. Use Pull from Cloud if these look stale.</p>
      <div class="table-wrapper" style="max-height:360px;overflow:auto">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Type</th><th class="text-right">Balance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="margin-top:10px;font-weight:700;text-align:right">Combined: à§³${total.toLocaleString()}</p>
    `, 'modal-lg');
  }

  function _monitorRecordFromItem(item) {
    if (!item) return null;
    if (item.recordId && typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.getById === 'function') {
      const live = SupabaseSync.getById(DB.finance, item.recordId);
      if (live) return live;
    }
    return {
      id: item.recordId || `monitor-${Date.now()}`,
      type: item.type,
      category: item.category,
      amount: item.amount,
      method: item.method || 'Cash',
      person_name: item.person,
      note: item.person,
      created_at: item.recordAt || item.date || null,
      date: item.recordAt || item.date || null,
    };
  }

  function showMonitorSnapshot(index) {
    const transactions = Utils.safeJSON(localStorage.getItem('wfa_recent_changes'), []);
    const item = transactions[index];
    if (!item) return showLiveAccountSnapshot();

    // âœ… Bug Fix: à¦†à¦—à§‡ snapshot à¦¨à¦¾ à¦¥à¦¾à¦•à¦²à§‡ _buildMonitorSnapshotAtRecord à¦¦à¦¿à¦¯à¦¼à§‡ recalculate
    // à¦•à¦°à¦¤à§‹ â€” à¦¯à§‡à¦Ÿà¦¾ backwards calculation à¦•à¦°à§‡ à¦¸à¦¬à¦¸à¦®à¦¯à¦¼ "à¦¸à¦ à¦¿à¦•" à¦¦à§‡à¦–à¦¾à¦¤à§‹à¥¤
    // à¦à¦–à¦¨ à¦¶à§à¦§à§ stored snapshot à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦¹à¦¬à§‡à¥¤ à¦¨à¦¾ à¦¥à¦¾à¦•à¦²à§‡ warning à¦¦à§‡à¦–à¦¾à¦¬à§‡à¥¤
    let snapshot = item.snapshot || {};
    const isRebuilt = !!item.rebuilt;
    const hasRealSnapshot = !!(item.snapshot && item.snapshot.accounts && item.snapshot.accounts.list);

    const students    = snapshot.students || {};
    const accounts    = snapshot.accounts || {};
    const finance     = snapshot.finance  || {};
    const batchSnap   = snapshot.batch    || {};
    const accountList = accounts.list || [];
    const grandTotal  = accounts.totalBalance || 0;

    const snapshotTime = snapshot.recordedAt
      ? new Date(snapshot.recordedAt).toLocaleString('en-BD', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : (item.date || 'â€”');

    // Transaction type colors
    const typeColorMap = {
      'Income':           { bg:'rgba(0,255,136,0.12)',  border:'rgba(0,255,136,0.30)',  text:'#00ff88' },
      'Expense':          { bg:'rgba(255,71,87,0.12)',  border:'rgba(255,71,87,0.30)',  text:'#ff4757' },
      'Transfer In':      { bg:'rgba(255,170,0,0.12)',  border:'rgba(255,170,0,0.30)',  text:'#ffaa00' },
      'Transfer Out':     { bg:'rgba(255,170,0,0.12)',  border:'rgba(255,170,0,0.30)',  text:'#ffaa00' },
      'Loan Giving':      { bg:'rgba(255,107,53,0.12)', border:'rgba(255,107,53,0.30)', text:'#ff6b35' },
      'Loan Receiving':   { bg:'rgba(0,212,255,0.12)',  border:'rgba(0,212,255,0.30)',  text:'#00d4ff' },
    };
    const tc = typeColorMap[item.type] || { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.2)', text:'#fff' };

    // Account balance cards
    const accountCards = accountList.length > 0
      ? accountList.map(a => {
          const isMobile = ['mobile','bkash','nagad','rocket','bikash'].some(k => (a.name||'').toLowerCase().includes(k) || (a.type||'').toLowerCase().includes(k));
          const isBank   = (a.type||'').toLowerCase().includes('bank');
          const icon     = isMobile ? '\u{1F4F1}' : isBank ? '\u{1F3E6}' : '\u{1F4B5}';
          const hasBalance = a.balance > 0;
          const borderCol  = hasBalance ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.08)';
          const glowCol    = hasBalance ? '0 0 18px rgba(0,212,255,0.12)' : 'none';
          const valColor   = hasBalance ? '#f0c040' : 'rgba(255,255,255,0.35)';
          return `<div style="padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid ${borderCol};border-radius:12px;box-shadow:${glowCol};min-width:0">
            <div style="font-size:.72rem;color:rgba(255,255,255,0.45);margin-bottom:8px;display:flex;align-items:center;gap:6px;font-weight:600">
              <span style="font-size:.85rem">${icon}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc(a.name)}</span>
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:${valColor};font-family:var(--font-ui)">${Utils.takaEn(a.balance)}</div>
          </div>`;
        }).join('')
      : `<div style="color:var(--text-muted);font-size:.85rem;padding:16px;text-align:center;grid-column:1/-1"><i class="fa fa-circle-info" style="margin-right:6px"></i>No account data in this snapshot.</div>`;

    // Net profit (all-time)
    const netProfit  = (finance.totalIncome || 0) - (finance.totalExpense || 0);
    const profitColor = netProfit >= 0 ? '#00ff88' : '#ff4757';

    // Running Batch row â€” from snapshot (no live re-calc)
    const batchName = batchSnap.name || '';
    const batchRow = batchName ? `
      <div style="margin-bottom:14px;padding:12px 16px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.18);border-radius:10px">
        <div style="font-size:.68rem;font-weight:800;letter-spacing:1.5px;color:#00d4ff;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="fa fa-graduation-cap"></i> RUNNING BATCH OVERVIEW
          <span style="background:rgba(0,212,255,0.12);padding:2px 10px;border-radius:20px;font-size:.65rem;color:#00d4ff;border:1px solid rgba(0,212,255,0.25)">${Utils.esc(batchName)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          <div style="text-align:center;padding:12px 14px;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.18);border-radius:10px">
            <div style="font-size:.68rem;color:rgba(0,229,255,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Students</div>
            <div style="font-size:1.1rem;font-weight:900;color:#00e5ff">${batchSnap.students || 0}</div>
          </div>
          <div style="text-align:center;padding:12px 14px;background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.18);border-radius:10px">
            <div style="font-size:.68rem;color:rgba(0,255,136,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Collection</div>
            <div style="font-size:1.1rem;font-weight:900;color:#00ff88">${Utils.takaEn(batchSnap.collection || 0)}</div>
          </div>
          <div style="text-align:center;padding:12px 14px;background:rgba(255,71,87,0.06);border:1px solid rgba(255,71,87,0.18);border-radius:10px">
            <div style="font-size:.68rem;color:rgba(255,71,87,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Expense</div>
            <div style="font-size:1.1rem;font-weight:900;color:#ff6b7a">${Utils.takaEn(batchSnap.expense || 0)}</div>
          </div>
          <div style="text-align:center;padding:12px 14px;background:rgba(${(batchSnap.net||0)>=0?'0,255,136':'255,71,87'},0.06);border:1px solid rgba(${(batchSnap.net||0)>=0?'0,255,136':'255,71,87'},0.18);border-radius:10px">
            <div style="font-size:.68rem;color:${(batchSnap.net||0)>=0?'#00ff88':'#ff4757'};opacity:.7;font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Net P/L</div>
            <div style="font-size:1.1rem;font-weight:900;color:${(batchSnap.net||0)>=0?'#00ff88':'#ff4757'}">${Utils.takaEn(batchSnap.net || 0)}</div>
          </div>
        </div>
      </div>` : '';

    // âœ… Warning banner: rebuilt entry à¦¬à¦¾ snapshot à¦¨à¦¾ à¦¥à¦¾à¦•à¦²à§‡ alert à¦¦à§‡à¦–à¦¾à¦¬à§‡
    const snapshotWarningBanner = (isRebuilt || !hasRealSnapshot) ? `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(255,215,0,0.10);border:1px solid rgba(255,215,0,0.35);border-radius:10px;display:flex;align-items:flex-start;gap:10px">
        <i class="fa fa-triangle-exclamation" style="color:#ffd700;margin-top:2px;flex-shrink:0"></i>
        <div style="font-size:.80rem;color:#ffd700;line-height:1.6">
          <strong>âš  à¦à¦Ÿà¦¿ à¦†à¦¸à¦² time-stamped à¦¸à§à¦•à§à¦°à¦¿à¦¨à¦¶à¦Ÿ à¦¨à¦¯à¦¼à¥¤</strong><br>
          ${isRebuilt
            ? 'à¦à¦‡ entry <strong>Rebuild</strong> à¦¬à¦¾à¦Ÿà¦¨ à¦¦à¦¿à¦¯à¦¼à§‡ à¦¤à§ˆà¦°à¦¿ â€” snapshot à¦¸à§‡à¦‡ transaction-à¦à¦° à¦¸à¦®à¦¯à¦¼à§‡à¦° à¦¨à¦¯à¦¼, à¦¬à¦°à¦‚ Rebuild à¦•à¦°à¦¾à¦° à¦¸à¦®à¦¯à¦¼à§‡à¦° à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ balance à¦¦à§‡à¦–à¦¾à¦šà§à¦›à§‡à¥¤'
            : 'à¦à¦‡ entry-à¦° à¦•à§‹à¦¨à§‹ stored snapshot à¦¨à§‡à¦‡à¥¤ Balance data à¦…à¦¨à§à¦ªà¦²à¦¬à§à¦§à¥¤'
          }<br>
          <span style="opacity:.75;font-size:.74rem">à¦¨à¦¤à§à¦¨ transaction add à¦•à¦°à¦²à§‡ real-time snapshot à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼à¦­à¦¾à¦¬à§‡ à¦¸à§‡à¦­ à¦¹à¦¬à§‡à¥¤</span>
        </div>
      </div>` : '';

    openSettingsInternalModal(
      `<span style="display:inline-flex;align-items:center;gap:8px"><i class="fa fa-camera" style="color:#00d9ff"></i><span>Monitor \u2014 Account Balances</span></span>`,
      `
      ${snapshotWarningBanner}
      <!-- Snapshot header bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px;padding:10px 14px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.18);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:rgba(0,212,255,0.9);font-weight:700">
          <i class="fa fa-camera" style="font-size:.8rem"></i>
          <span>Balance Snapshot \u2014 ${snapshotTime}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="background:${tc.bg};border:1px solid ${tc.border};color:${tc.text};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:800">${item.type || '\u2014'}</span>
          <span style="font-size:.75rem;color:rgba(255,255,255,0.45)">${Utils.esc(item.category || '\u2014')}</span>
          ${item.person ? `<span style="font-size:.75rem;color:rgba(255,255,255,0.35)">\u2022 ${Utils.esc(item.person)}</span>` : ''}
          ${item.amount ? `<span style="font-size:.8rem;font-weight:700;color:${tc.text};font-family:var(--font-ui)">${Utils.takaEn(item.amount)}</span>` : ''}
          ${item.method ? `<span style="font-size:.72rem;color:rgba(255,255,255,0.35)">(${Utils.esc(item.method)})</span>` : ''}
        </div>
      </div>

      <!-- Account balance grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px">
        ${accountCards}
      </div>

      <!-- Grand total -->
      <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:18px">
        <div style="padding:10px 20px;background:rgba(240,192,64,0.08);border:1px solid rgba(240,192,64,0.25);border-radius:10px;font-size:1.05rem;font-weight:900;color:#f0c040;font-family:var(--font-ui)">
          Grand Total: ${Utils.takaEn(grandTotal)}
        </div>
      </div>

      ${batchRow}

      <!-- Cumulative totals up to this transaction -->
      <div style="font-size:.65rem;font-weight:800;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:8px">\u2605 CUMULATIVE UP TO THIS TRANSACTION</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        <div style="padding:12px 14px;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.18);border-radius:10px;text-align:center">
          <div style="font-size:.68rem;color:rgba(0,229,255,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Students</div>
          <div style="font-size:1.4rem;font-weight:900;color:#00e5ff">${students.totalStudents || 0}</div>
        </div>
        <div style="padding:12px 14px;background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.18);border-radius:10px;text-align:center">
          <div style="font-size:.68rem;color:rgba(0,255,136,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Income</div>
          <div style="font-size:1.1rem;font-weight:900;color:#00ff88">${Utils.takaEn(finance.totalIncome || 0)}</div>
        </div>
        <div style="padding:12px 14px;background:rgba(255,71,87,0.06);border:1px solid rgba(255,71,87,0.18);border-radius:10px;text-align:center">
          <div style="font-size:.68rem;color:rgba(255,71,87,0.6);font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Expense</div>
          <div style="font-size:1.1rem;font-weight:900;color:#ff6b7a">${Utils.takaEn(finance.totalExpense || 0)}</div>
        </div>
        <div style="padding:12px 14px;background:rgba(${netProfit>=0?'0,255,136':'255,71,87'},0.06);border:1px solid rgba(${netProfit>=0?'0,255,136':'255,71,87'},0.18);border-radius:10px;text-align:center">
          <div style="font-size:.68rem;color:${profitColor};opacity:.7;font-weight:700;letter-spacing:.8px;margin-bottom:6px;text-transform:uppercase">Net P/L</div>
          <div style="font-size:1.1rem;font-weight:900;color:${profitColor}">${Utils.takaEn(netProfit)}</div>
        </div>
      </div>

      <!-- hint -->
      <div style="font-size:.72rem;color:rgba(255,255,255,0.28);padding:8px 0 2px;border-top:1px solid rgba(255,255,255,0.07);line-height:1.6">
        <i class="fa fa-circle-info" style="margin-right:5px;opacity:.6"></i>
        à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ row-à¦à¦° Grand Total à¦“ account balance à¦¸à§‡à¦‡ transaction à¦ªà¦°à§à¦¯à¦¨à§à¦¤ (à¦¸à¦®à¦¯à¦¼ à¦…à¦¨à§à¦¯à¦¾à¦¯à¦¼à§€) à¦¹à¦¿à¦¸à¦¾à¦¬ à¦•à¦°à¦¾à¥¤ à¦ªà§à¦°à¦¨à§‹ entry-à¦à¦° à¦œà¦¨à§à¦¯ à¦à¦•à¦¬à¦¾à¦° <strong>Rebuild Data</strong> à¦šà¦¾à¦ªà§à¦¨à¥¤
      </div>
      `
    , '720px');
  }
  // â”€â”€â”€ Rebuild Monitor Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Finance ledger à¦¥à§‡à¦•à§‡ à¦¶à§‡à¦· à§§à§«à¦Ÿà¦¿ à¦Ÿà§à¦°à¦¾à¦¨à§à¦¸à§‡à¦•à¦¶à¦¨ à¦¨à¦¿à¦¯à¦¼à§‡ Data Monitor-à¦ populate à¦•à¦°à§‡à¥¤
  // à¦¯à¦¦à¦¿ wfa_recent_changes à¦–à¦¾à¦²à¦¿ à¦¹à¦¯à¦¼à§‡ à¦¯à¦¾à¦¯à¦¼ à¦¬à¦¾ à¦¹à¦¾à¦°à¦¿à¦¯à¦¼à§‡ à¦¯à¦¾à¦¯à¦¼, à¦à¦‡ function à¦¦à¦¿à¦¯à¦¼à§‡ rebuild à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¥¤
  function rebuildMonitorData() {
    try {
      const allFinance = SupabaseSync.getAll(DB.finance);
      const allowedTypes = [
        'income', 'expense', 'transfer in', 'transfer out',
        'loan giving', 'loan receiving', 'investment in', 'investment out',
      ];

      const filtered = allFinance
        .filter(f => allowedTypes.includes(String(f.type || '').toLowerCase()))
        // âœ… Fix: Exclude phantom categories from rebuild
        .filter(f => f.category !== 'Opening Balance' && f.category !== 'Balance Adjustment')
        .sort((a, b) => {
          const da = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
          const db = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
          return db - da;
        })
        .slice(0, 15);

      if (filtered.length === 0) {
        Utils.toast('à¦•à§‹à¦¨à§‹ à¦Ÿà§à¦°à¦¾à¦¨à§à¦¸à§‡à¦•à¦¶à¦¨ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿ â€” à¦†à¦—à§‡ Income à¦¬à¦¾ Expense add à¦•à¦°à§à¦¨', 'warn');
        return;
      }

      // âœ… Bug Fix: Rebuild-à¦ _buildMonitorSnapshotAtRecord à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¹à¦¤à§‹ à¦¯à§‡à¦Ÿà¦¾
      // à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸ à¦¥à§‡à¦•à§‡ backwards recalculate à¦•à¦°à¦¤à§‹ â€” à¦«à¦²à§‡ à¦¡à§‡à¦Ÿà¦¾ à¦­à§à¦² à¦¥à¦¾à¦•à¦²à§‡à¦“
      // snapshot "à¦¸à¦ à¦¿à¦•" à¦¦à§‡à¦–à¦¾à¦¤à§‹ (à¦•à¦¾à¦°à¦£ à¦—à¦¾à¦£à¦¿à¦¤à¦¿à¦•à¦­à¦¾à¦¬à§‡ derive à¦•à¦°à¦¾)à¥¤
      // à¦à¦–à¦¨ _getMonitorSnapshot() à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¹à¦šà§à¦›à§‡ à¦¯à§‡à¦Ÿà¦¾ accounts.balance à¦¸à¦°à¦¾à¦¸à¦°à¦¿ à¦ªà¦¡à¦¼à§‡
      // (à¦†à¦¸à¦² à¦¸à§à¦•à§à¦°à¦¿à¦¨à¦¶à¦Ÿ)à¥¤ Rebuild-à¦•à§ƒà¦¤ entry-à¦¤à§‡ rebuilt:true à¦«à§à¦²à§à¦¯à¦¾à¦— à¦¥à¦¾à¦•à¦¬à§‡à¥¤
      // NOTE: Rebuilt snapshot = à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ state, historical point-in-time à¦¨à¦¯à¦¼à¥¤
      const currentSnapshot = typeof SupabaseSync.getMonitorSnapshot === 'function'
        ? SupabaseSync.getMonitorSnapshot()
        : {};

      const entries = filtered.map(record => {
        const action = 'insert';
        return {
          date: record.created_at ? new Date(record.created_at).toLocaleString() : (record.date || new Date().toLocaleString()),
          action,
          type: record.type,
          category: String(record.category || record.type || '').slice(0, 100),
          person: String(record.person_name || record.description || record.note || 'â€”').slice(0, 100),
          amount: Number(record.amount || 0),
          method: record.method || '',
          table: DB.finance,
          recordId: record.id,
          recordAt: record.created_at || record.updated_at || record.date || null,
          item: `${record.category || record.type} â€” à§³${Number(record.amount || 0).toLocaleString()}`,
          snapshot: currentSnapshot,
          rebuilt: true,  // âœ… Mark as rebuilt â€” real-time snapshot à¦›à¦¿à¦² à¦¨à¦¾
        };
      });

      localStorage.setItem('wfa_recent_changes', JSON.stringify(entries));
      Utils.toast(`âœ… ${entries.length}à¦Ÿà¦¿ à¦Ÿà§à¦°à¦¾à¦¨à§à¦¸à§‡à¦•à¦¶à¦¨ Data Monitor-à¦ restore à¦¹à¦¯à¦¼à§‡à¦›à§‡ (snapshot = à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ state)`, 'success');
      refreshModal();
    } catch (err) {
      console.error('[RebuildMonitor] Failed:', err);
      Utils.toast('Rebuild à¦¬à§à¦¯à¦°à§à¦¥ à¦¹à¦¯à¦¼à§‡à¦›à§‡ â€” console à¦šà§‡à¦• à¦•à¦°à§à¦¨', 'error');
    }
  }

  // â”€â”€â”€ Diagnostic Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    document.getElementById('heal-lastfix').textContent = fixes > 0 ? now : 'â€”';
    if (logEl) logEl.innerHTML = `âœ… Checked ${checks} records. Fixed ${fixes} issues. (${now})`;

    Utils.toast(`Auto-Heal: ${checks} checked, ${fixes} fixed`, 'success');
    // Note: Background system functions do NOT log to activity â€” by design
  }

  async function runSyncCheck() {
    const output = document.getElementById('sync-check-output');
    if (!output) return;
    output.innerHTML = '<span style="color:var(--text-muted)">Checking local IDs and cloud row countsâ€¦</span>';

    let issues = 0;
    let report = '';
    const client = typeof window.SUPABASE_CONFIG !== 'undefined' ? window.SUPABASE_CONFIG.client : null;

    for (const table of Object.values(DB)) {
      const rows = SupabaseSync.getAll(table);
      const noId = rows.filter(r => !r || !r.id).length;
      if (noId > 0) {
        issues += noId;
        report += `âš ï¸ ${table}: ${noId} record(s) without ID<br>`;
      }

      if (!client) continue;

      try {
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
        if (error) {
          if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
            issues++;
            report += `âš ï¸ ${table}: cloud table missing or not accessible<br>`;
            continue;
          }
          issues++;
          report += `âš ï¸ ${table}: cloud error â€” ${error.message || 'unknown'}<br>`;
          continue;
        }
        const localCount = rows.length;
        const cloudCount = count ?? 0;
        if (cloudCount !== localCount) {
          issues++;
          report += `âš ï¸ ${table}: local <strong>${localCount}</strong> rows vs cloud <strong>${cloudCount}</strong><br>`;
        }
      } catch (e) {
        issues++;
        report += `âš ï¸ ${table}: ${e.message || 'cloud check failed'}<br>`;
      }
    }

    const cloudNote = !client
      ? '<br><span style="color:var(--text-muted)">Cloud row counts skipped (no Supabase client).</span>'
      : '';

    if (issues === 0) {
      output.innerHTML = `<span style="color:var(--success)">âœ… All checks passed â€” IDs valid${client ? ' and row counts match cloud' : ''}.</span>${cloudNote}`;
      Utils.toast('All checks passed!', 'success');
    } else {
      output.innerHTML = `<span style="color:var(--error)">${report}</span>${cloudNote}`;
      Utils.toast(`${issues} issue(s) found`, 'error');
    }
  }

  function _showSyncDiagResult(kind, html, toastMsg, toastType) {
    const r = document.getElementById('sync-diag-result');
    if (!r) return;
    const styles = {
      ok: 'display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88',
      warn: 'display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);color:#ffa502',
      err: 'display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.3);color:#ff4757'
    };
    r.style.cssText = styles[kind] || styles.err;
    r.innerHTML = html;
    if (typeof Utils !== 'undefined' && toastMsg) Utils.toast(toastMsg, toastType || 'info');
  }

  function _supabaseErrHint(msg) {
    const m = String(msg || '');
    if (/503|502|504|unavailable|timeout/i.test(m)) {
      return '<br><small style="color:var(--text-muted)">Supabase server unavailable â€” Dashboard-à¦ project paused/active à¦šà§‡à¦• à¦•à¦°à§à¦¨, à¦•à¦¿à¦›à§à¦•à§à¦·à¦£ à¦ªà¦° à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨à¥¤</small>';
    }
    return '';
  }

  function runCloudPullDiag() {
    const b = document.getElementById('btn-sync-pull');
    const r = document.getElementById('sync-diag-result');
    if (!b || typeof SyncEngine === 'undefined') {
      if (typeof Utils !== 'undefined') Utils.toast('SyncEngine not loaded', 'error');
      return;
    }
    b.disabled = true;
    b.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Syncing...';
    if (r) r.style.display = 'none';
    SyncEngine.syncAll({ silent: true })
      .then(res => {
        b.disabled = false;
        b.innerHTML = 'â¬‡ Sync (retry + pull)';
        if (res && res.ok) {
          _showSyncDiagResult('ok', 'âœ… Sync à¦¸à¦«à¦²! à¦¡à§‡à¦Ÿà¦¾ Cloud à¦¥à§‡à¦•à§‡ à¦¨à¦¾à¦®à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤', 'Sync à¦¸à¦«à¦² âœ…', 'success');
        } else {
          _showSyncDiagResult('warn', 'âš ï¸ Sync à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦¿à¦¨à§à¦¤à§ à¦•à¦¿à¦›à§ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ Supabase credentials à¦šà§‡à¦• à¦•à¦°à§à¦¨à¥¤', 'Sync â€” à¦•à¦¿à¦›à§ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡', 'warn');
        }
      })
      .catch(err => {
        b.disabled = false;
        b.innerHTML = 'â¬‡ Sync (retry + pull)';
        const msg = (typeof Utils !== 'undefined' && Utils.esc) ? Utils.esc(err?.message || 'Unknown error') : (err?.message || 'Unknown error');
        _showSyncDiagResult('err', 'âŒ Sync à¦¬à§à¦¯à¦°à§à¦¥: ' + msg + _supabaseErrHint(err?.message), 'Sync à¦¬à§à¦¯à¦°à§à¦¥', 'error');
      });
  }

  function runCloudPushDiag() {
    const b = document.getElementById('btn-push-cloud');
    const r = document.getElementById('sync-diag-result');
    if (!b || typeof SyncEngine === 'undefined') {
      if (typeof Utils !== 'undefined') Utils.toast('SyncEngine not loaded', 'error');
      return;
    }
    b.disabled = true;
    b.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Pushing...';
    if (r) r.style.display = 'none';
    SyncEngine.push({ silent: true, forcePush: true })
      .then(res => {
        b.disabled = false;
        b.innerHTML = 'â¬† Push to Cloud';
        const sc = res?.successCount || 0;
        const errs = res?.errors || [];
        if (res && res.ok) {
          _showSyncDiagResult('ok', `âœ… Push à¦¸à¦«à¦²! à¦¸à¦¬ à¦¡à§‡à¦Ÿà¦¾ Cloud-à¦ à¦†à¦ªà¦²à§‹à¦¡ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ (${sc} à¦Ÿà§‡à¦¬à¦¿à¦²)`, `Push à¦¸à¦«à¦² âœ… ${sc} à¦Ÿà§‡à¦¬à¦¿à¦²`, 'success');
        } else {
          _showSyncDiagResult(
            'warn',
            `âš ï¸ à¦†à¦‚à¦¶à¦¿à¦• Push: ${sc} à¦Ÿà§‡à¦¬à¦¿à¦² à¦¸à¦«à¦², ${errs.length} à¦Ÿà§‡à¦¬à¦¿à¦²à§‡ à¦¸à¦®à¦¸à§à¦¯à¦¾à¥¤<br><small style="color:var(--text-muted)">F12 Console-à¦ à¦¬à¦¿à¦¸à§à¦¤à¦¾à¦°à¦¿à¦¤ à¦¦à§‡à¦–à§à¦¨</small>`,
            'Push â€” à¦•à¦¿à¦›à§ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡',
            'warn'
          );
        }
      })
      .catch(err => {
        b.disabled = false;
        b.innerHTML = 'â¬† Push to Cloud';
        const msg = (typeof Utils !== 'undefined' && Utils.esc) ? Utils.esc(err?.message || 'Unknown error') : (err?.message || 'Unknown error');
        _showSyncDiagResult(
          'err',
          'âŒ Push à¦¬à§à¦¯à¦°à§à¦¥: ' + msg + _supabaseErrHint(err?.message) + '<br><small style="color:var(--text-muted)">Security &amp; Access-à¦ URL à¦“ Anon Key à¦¯à¦¾à¦šà¦¾à¦‡ à¦•à¦°à§à¦¨à¥¤</small>',
          'Push à¦¬à§à¦¯à¦°à§à¦¥',
          'error'
        );
      });
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

    if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">âœ… Auto-fix complete. ${fixes} fields repaired.</span>`;
    Utils.toast(`Auto-fix: ${fixes} repairs`, 'success');
  }


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LEGACY FUNCTIONS (Preserved)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â”€â”€ Save All Changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function saveAllChanges() {
    saveAcademyInfo();
    Utils.toast('All settings saved âœ…', 'success');
  }

  // â”€â”€ Academy Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function saveAcademyInfo() {
    const cfg = getConfig();
    const prev = { ...cfg };
    cfg.id = cfg.id || SupabaseSync.generateId();
    cfg.academy_name = document.getElementById('set-academy-name')?.value || cfg.academy_name;
    cfg.monthly_target = parseFloat(document.getElementById('set-monthly-target')?.value) || cfg.monthly_target;
    const rawBatch = document.getElementById('set-running-batch')?.value;
    cfg.running_batch = rawBatch !== undefined && rawBatch !== null ? String(rawBatch) : (cfg.running_batch != null ? String(cfg.running_batch) : '');

    // â”€â”€ Expense Start Date â€” Flatpickr-safe read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Flatpickr altInput=true: original input is hidden (YYYY-MM-DD value),
    // altInput is visible (DD/MM/YYYY). getElementById returns original hidden input.
    // We also check Flatpickr instance and altInput as fallback.
    const expEl = document.getElementById('set-expense-start');
    let startVal = '';
    if (expEl) {
      if (expEl._flatpickr) {
        // Flatpickr manages this input â€” use the selectedDates array for reliability
        const fp = expEl._flatpickr;
        startVal = fp.selectedDates.length > 0
          ? fp.formatDate(fp.selectedDates[0], 'Y-m-d')
          : (expEl.value || '');
      } else {
        // Native date input â€” always returns YYYY-MM-DD
        startVal = expEl.value || '';
        // Fallback: if empty, try next sibling altInput (if Flatpickr added it)
        const altInput = expEl.nextElementSibling;
        if (!startVal && altInput && altInput.classList.contains('flatpickr-input')) {
          const altVal = altInput.value || '';
          // Convert DD/MM/YYYY â†’ YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(altVal)) {
            const [d, m, y] = altVal.split('/');
            startVal = `${y}-${m}-${d}`;
          } else {
            startVal = altVal;
          }
        }
      }
    }
    // Preserve existing date only if no new value was selected
    // (empty startVal = user cleared the field = show all expenses)
    cfg.expense_start_date = (startVal && /^\d{4}-\d{2}-\d{2}$/.test(startVal)) ? startVal : '';

    const _now = new Date();
    cfg.expense_end_date = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
    _healConfigDateFields(cfg);

    // Read and save language settings
    const prevLang = prev.language || 'default';
    const newLang = document.getElementById('set-language')?.value || 'default';
    cfg.language = newLang;
    localStorage.setItem('wfa_language', newLang);

    saveConfig(cfg);
    const changes = [];
    if (String(prev.academy_name || '') !== String(cfg.academy_name || '')) {
      changes.push(`à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿à¦° à¦¨à¦¾à¦®: "${prev.academy_name || '(à¦–à¦¾à¦²à¦¿)'}" â†’ "${cfg.academy_name || '(à¦–à¦¾à¦²à¦¿)'}"`);
    }
    if (Number(prev.monthly_target || 0) !== Number(cfg.monthly_target || 0)) {
      changes.push(`à¦®à¦¾à¦¸à¦¿à¦• à¦²à¦•à§à¦·à§à¦¯: à§³${Number(prev.monthly_target || 0).toLocaleString()} â†’ à§³${Number(cfg.monthly_target || 0).toLocaleString()}`);
    }
    if (String(prev.running_batch || '') !== String(cfg.running_batch || '')) {
      changes.push(`à¦šà¦²à¦®à¦¾à¦¨ à¦¬à§à¦¯à¦¾à¦š: "${prev.running_batch || '(à¦–à¦¾à¦²à¦¿)'}" â†’ "${cfg.running_batch || '(à¦–à¦¾à¦²à¦¿)'}"`);
    }
    if (String(prev.expense_start_date || '') !== String(cfg.expense_start_date || '')) {
      changes.push(`à¦¬à§à¦¯à¦¯à¦¼ à¦¶à§à¦°à§à¦° à¦¤à¦¾à¦°à¦¿à¦–: "${prev.expense_start_date || '(à¦–à¦¾à¦²à¦¿)'}" â†’ "${cfg.expense_start_date || '(à¦–à¦¾à¦²à¦¿)'}"`);
    }
    if (prevLang !== newLang) {
      changes.push(`à¦­à¦¾à¦·à¦¾: "${prevLang === 'en' ? 'English' : 'Default'}" â†’ "${newLang === 'en' ? 'English' : 'Default'}"`);
    }
    logActivity('edit', 'settings', changes.length
      ? 'à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸ à¦†à¦ªà¦¡à§‡à¦Ÿ â€” ' + changes.join('; ')
      : 'à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿ à¦¸à§‡à¦Ÿà¦¿à¦‚à¦¸ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ (à¦•à§‹à¦¨à§‹ à¦®à¦¾à¦¨ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦¯à¦¼à¦¨à¦¿)');
    Utils.toast('Academy info saved âœ…', 'success');

    // Trigger reload if language changed so new language assets are cleanly loaded
    if (prevLang !== newLang) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }


  // â”€â”€ Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function changePassword() {
    const cfg = getConfig();
    const oldPw = document.getElementById('set-old-pw')?.value;
    const newPw = document.getElementById('set-new-pw')?.value;
    const confirmPw = document.getElementById('set-confirm-pw')?.value;
    const current = cfg.admin_password || '';

    // Compare: support both legacy plaintext and new hashed format
    const _isHashed = (s) => /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');
    const _hashPw = async (pw) => {
      try {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      } catch {
        let h = 0;
        for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
        return 'fb_' + Math.abs(h).toString(16);
      }
    };

    // Verify old password
    let oldOk;
    if (_isHashed(current)) {
      oldOk = (await _hashPw(oldPw)) === current;
    } else {
      oldOk = oldPw === current;
    }

    if (!oldOk) { Utils.toast('Current password incorrect!', 'error'); return; }
    if (!newPw || newPw.length < 8) { Utils.toast('New password must be at least 8 characters', 'error'); return; }
    if (newPw !== confirmPw) { Utils.toast('Passwords do not match!', 'error'); return; }

    // Store SHA-256 hash â€” never plaintext
    cfg.admin_password = await _hashPw(newPw);
    saveConfig(cfg);

    // Save à¦¸à¦«à¦² à¦¹à¦¯à¦¼à§‡à¦›à§‡ à¦•à¦¿à¦¨à¦¾ verify à¦•à¦°à§‹
    const verified = getConfig();
    if (verified.admin_password !== cfg.admin_password) {
      Utils.toast('âš ï¸ Password save failed â€” please try again!', 'error');
      return;
    }

    // Input fields à¦ªà¦°à¦¿à¦·à§à¦•à¦¾à¦° à¦•à¦°à§‹
    const oldEl = document.getElementById('set-old-pw');
    const newEl = document.getElementById('set-new-pw');
    const cfmEl = document.getElementById('set-confirm-pw');
    if (oldEl) oldEl.value = '';
    if (newEl) newEl.value = '';
    if (cfmEl) cfmEl.value = '';

    logActivity('edit', 'security', 'à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨ à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡');
    Utils.toast('Password changed successfully âœ…', 'success');
  }

  // â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wfa_theme', theme);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? 'â˜€ï¸' : 'ðŸŒ™';
    Utils.toast(`${theme === 'dark' ? 'ðŸŒ™ Dark' : 'â˜€ï¸ Light'} mode activated`, 'info');
  }

  // â”€â”€ View Table Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function viewTableData(tableName) {
    const rows = SupabaseSync.getAll(tableName);
    if (!rows.length) { Utils.toast('No data available', 'info'); return; }

    const fields = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const sample = rows.slice(0, 20);
    const headerHTML = fields.slice(0, 6).map(f => `<th style="font-size:.75rem">${f}</th>`).join('');
    const bodyHTML = sample.map(r => `<tr>${fields.slice(0, 6).map(f =>
      `<td style="font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[f] ?? 'â€”'}</td>`
    ).join('')}</tr>`).join('');

    // âœ… Fix: use openSettingsInternalModal so it appears ON TOP of the Settings modal
    openSettingsInternalModal(`ðŸ“‹ ${tableName} (${rows.length} records)`, `
      <div class="table-wrapper" style="max-height:480px;overflow:auto">
        <table style="width:100%;min-width:600px"><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-top:8px">
        ${rows.length > 20 ? `Showing first 20 (Total ${rows.length})` : `Total ${rows.length} records`}
      </p>
    `, '860px');
  }

  // â”€â”€ Export All Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function exportAllData() {
    const allData = {};
    for (const [_key, tableName] of Object.entries(DB)) {
      let rows = SupabaseSync.getAll(tableName);
      // Security: admin_password, security_answer â€” backup à¦¥à§‡à¦•à§‡ à¦¬à¦¾à¦¦ à¦¦à¦¾à¦“
      if (tableName === 'settings') {
        rows = rows.map(r => {
          const safe = { ...r };
          delete safe.admin_password;
          delete safe.security_answer;
          return safe;
        });
      }
      allData[tableName] = rows;
    }
    allData._exportedAt = new Date().toISOString();
    allData._version = '2';
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wfa_backup_${typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity('add', 'backup', 'Exported all data (password fields excluded)');
    Utils.toast('All data exported âœ… (password fields excluded for security)', 'success');
  }

  // â”€â”€ Data Migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function startMigration() {
    const oldUrl = document.getElementById('mig-url')?.value;
    const oldKey = document.getElementById('mig-key')?.value;
    const statusEl = document.getElementById('mig-status');

    if (!oldUrl || !oldKey) {
      Utils.toast('URL and Key are required', 'error');
      return;
    }

    if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = 'ðŸ”„ Starting migration...'; }

    try {
      const oldClient = supabase.createClient(oldUrl, oldKey);
      let imported = 0;
      let errors = 0;

      for (const [_key, tableName] of Object.entries(DB)) {
        if (statusEl) statusEl.innerHTML = `ðŸ”„ Fetching data from ${tableName}...`;

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
            if (statusEl) statusEl.innerHTML = `âœ… ${tableName}: ${data.length} records (${newRows.length} New)`;
          }
        } catch { errors++; }
      }

      if (statusEl) statusEl.innerHTML = `âœ… Migration complete! ${imported} new records imported. ${errors > 0 ? `âš ï¸ ${errors} tables skipped.` : ''}`;
      Utils.toast(`Migration complete! ${imported} records imported`, 'success');
      logActivity('add', 'migration', `Imported ${imported} records`);
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
    } catch (e) {
      if (statusEl) statusEl.textContent = `âŒ Migration Failed: ${e.message}`;
      Utils.toast('Migration failed', 'error');
    }
  }

  // â”€â”€ Import from JSON file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('mig-status');
      try {
        const text = await file.text();
        let data = JSON.parse(text);

        // Unwrap wfa_backup_v2 if nested in data property
        if (data && data.version === 'wfa_backup_v2' && data.data && typeof data.data === 'object') {
          data = data.data;
        }

        let imported = 0;
        let tableCount = 0;
        const tableDetails = [];

        if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = 'ðŸ”„ Backup à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£ à¦•à¦°à¦¾ à¦¹à¦šà§à¦›à§‡...'; }

        // Detect legacy format
        const isLegacy = Object.prototype.hasOwnProperty.call(data, 'employees') ||
                         Object.prototype.hasOwnProperty.call(data, 'cashBalance') ||
                         Object.prototype.hasOwnProperty.call(data, 'incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          Utils.toast('à¦ªà§à¦°à¦¨à§‹ à¦¬à§à¦¯à¦¾à¦•à¦†à¦ª à¦«à¦°à¦®à§à¦¯à¦¾à¦Ÿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦—à§‡à¦›à§‡ â€” à¦°à§‚à¦ªà¦¾à¦¨à§à¦¤à¦° à¦•à¦°à¦¾ à¦¹à¦šà§à¦›à§‡...', 'info');
          imported = await importLegacyData(data, statusEl);
        } else {
          // Meta/non-table keys to skip
          const SKIP_KEYS = new Set(['meta', 'version', 'exportedAt', '_exportedAt', '_version', '_meta']);

          // Table name aliases (export uses DB table names directly)
          const tableAliases = {
            finance: DB.finance,
            financeLedger: DB.finance,
            finance_ledger: DB.finance,
            ledger: DB.finance,
            staff: DB.staff,
            employees: DB.staff,
          };

          for (const [key, rows] of Object.entries(data)) {
            // Skip non-table metadata keys
            if (SKIP_KEYS.has(key) || key.startsWith('_')) continue;
            // Must be a non-empty array
            if (!Array.isArray(rows) || rows.length === 0) continue;

            const targetTable = tableAliases[key] || key;

            // Get existing records in this table
            const existing = SupabaseSync.getAll(targetTable);
            const existingIds = new Set(existing.map(r => r.id));

            // Only import rows that don't already exist (dedup by id)
            const newRows = rows.filter(r => r && r.id && !existingIds.has(r.id));

            if (newRows.length > 0) {
              // Merge: new rows first so they show at top
              SupabaseSync.setAll(targetTable, [...newRows, ...existing]);
              imported += newRows.length;
              tableCount++;
              tableDetails.push(`${targetTable}: ${newRows.length}à¦Ÿà¦¿`);
            }
          }
        }

        // â”€â”€ Show result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (imported === 0) {
          if (statusEl) statusEl.innerHTML = 'âš ï¸ à¦•à§‹à¦¨à§‹ à¦¨à¦¤à§à¦¨ à¦°à§‡à¦•à¦°à§à¦¡ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤ à¦¬à§à¦¯à¦¾à¦•à¦†à¦ª à¦«à¦¾à¦‡à¦²à¦Ÿà¦¿ à¦¸à¦ à¦¿à¦• à¦•à¦¿à¦¨à¦¾ à¦¦à§‡à¦–à§à¦¨ à¦…à¦¥à¦¬à¦¾ à¦¡à§‡à¦Ÿà¦¾ à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¹à¦¯à¦¼à§‡ à¦†à¦›à§‡à¥¤';
          Utils.toast('à¦•à§‹à¦¨à§‹ à¦¨à¦¤à§à¦¨ à¦°à§‡à¦•à¦°à§à¦¡ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¹à¦¯à¦¼à¦¨à¦¿', 'warn');
          return;
        }

        const detailsStr = tableDetails.length > 0 ? `<br><small style="color:var(--text-muted)">${tableDetails.join(' | ')}</small>` : '';
        if (statusEl) statusEl.innerHTML = `âœ… à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ <strong>${imported}à¦Ÿà¦¿ à¦°à§‡à¦•à¦°à§à¦¡</strong> ${tableCount}à¦Ÿà¦¿ à¦Ÿà§‡à¦¬à¦¿à¦²à§‡ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!${detailsStr}<br><br>`;
        Utils.toast(`âœ… ${imported}à¦Ÿà¦¿ à¦°à§‡à¦•à¦°à§à¦¡ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!`, 'success');

        // â”€â”€ Push to cloud (Supabase) if connected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (statusEl) statusEl.innerHTML += 'ðŸ”„ Cloud-à¦ à¦†à¦ªà¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...';
        try {
          const pushResult = await SyncEngine.push({ silent: true, forcePush: true });
          if (pushResult?.ok) {
            if (statusEl) statusEl.innerHTML += ' âœ… Cloud sync à¦¸à¦«à¦²!';
          } else {
            if (statusEl) statusEl.innerHTML += ' âš ï¸ Cloud sync à¦¹à¦¯à¦¼à¦¨à¦¿ (Supabase à¦•à¦¾à¦¨à§‡à¦•à§à¦Ÿ à¦¨à¦¾ à¦¥à¦¾à¦•à¦²à§‡ à¦à¦Ÿà¦¾ à¦¸à§à¦¬à¦¾à¦­à¦¾à¦¬à¦¿à¦• â€” à¦²à§‹à¦•à¦¾à¦²à¦¿ à¦¸à§‡à¦­ à¦¹à¦¯à¦¼à§‡à¦›à§‡)à¥¤';
          }
        } catch {
          if (statusEl) statusEl.innerHTML += ' âš ï¸ Cloud sync à¦¹à¦¯à¦¼à¦¨à¦¿ â€” à¦²à§‹à¦•à¦¾à¦² à¦¸à§à¦Ÿà§‹à¦°à§‡ à¦¡à§‡à¦Ÿà¦¾ à¦†à¦›à§‡à¥¤';
        }

        // â”€â”€ Add reload button so user sees fresh data immediately â”€â”€
        if (statusEl) {
          statusEl.innerHTML += `
            <br><br>
            <div style="background:rgba(0,255,136,0.07);border:1px solid rgba(0,255,136,0.2);border-radius:10px;padding:14px;margin-top:8px">
              <div style="font-weight:700;color:#00ff88;margin-bottom:8px">ðŸŽ‰ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨!</div>
              <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
                à¦¡à§à¦¯à¦¾à¦¶à¦¬à§‹à¦°à§à¦¡à§‡ à¦¸à¦¬ à¦¡à§‡à¦Ÿà¦¾ à¦¦à§‡à¦–à¦¤à§‡ à¦ªà§‡à¦œà¦Ÿà¦¿ à¦°à¦¿à¦²à§‹à¦¡ à¦•à¦°à§à¦¨à¥¤
              </div>
              <button onclick="location.reload()"
                style="background:linear-gradient(135deg,#00ff88,#00d9ff);color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:.95rem;cursor:pointer">
                ðŸ”„ à¦à¦–à¦¨à¦‡ à¦°à¦¿à¦²à§‹à¦¡ à¦•à¦°à§à¦¨
              </button>
            </div>`;
        }

        logActivity('add', 'import', `Imported ${imported} records from JSON backup (${tableCount} tables)`);
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));

      } catch (err) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `âŒ à¦¤à§à¦°à§à¦Ÿà¦¿: ${err.message}`; }
        Utils.toast('JSON à¦ªà¦¡à¦¼à¦¤à§‡ à¦¬à§à¦¯à¦°à§à¦¥: ' + err.message, 'error');
        console.error('[importFromJSON]', err);
      }
    };
    input.click();
  }

  // âœ… REQ 1: Import from JSON with custom date
  function importFromJSONWithDate() {
    const customDateInput = document.getElementById('imp-date');
    const customDate = customDateInput ? customDateInput.value : '';
    
    if (!customDate) {
      Utils.toast('Please select an import date', 'error');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('mig-status');
      try {
        const text = await file.text();
        let data = JSON.parse(text);

        // Unwrap wfa_backup_v2 if nested in data property
        if (data && data.version === 'wfa_backup_v2' && data.data && typeof data.data === 'object') {
          data = data.data;
        }

        let imported = 0;
        let tableCount = 0;

        if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = 'ðŸ”„ Backup à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£ à¦•à¦°à¦¾ à¦¹à¦šà§à¦›à§‡...'; }

        // Detect legacy format
        const isLegacy = Object.prototype.hasOwnProperty.call(data, 'employees') ||
                         Object.prototype.hasOwnProperty.call(data, 'cashBalance') ||
                         Object.prototype.hasOwnProperty.call(data, 'incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          // Pass custom date to legacy import
          imported = await importLegacyData(data, statusEl, customDate);
        } else {
          // For modern format, also pass custom date
          imported = await importModernData(data, statusEl, customDate, tableCount);
        }

        if (statusEl) {
          statusEl.innerHTML += `<br/>âœ… à¦†à¦®à¦¦à¦¾à¦¨à¦¿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨! ${imported} à¦°à§‡à¦•à¦°à§à¦¡ à¦¯à§à¦•à§à¦¤ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤<br/>
              <div style="font-size:.82rem;color:var(--text-muted);margin-top:8px">
                à¦¡à§à¦¯à¦¾à¦¶à¦¬à§‹à¦°à§à¦¡à§‡ à¦¸à¦¬ à¦¡à§‡à¦Ÿà¦¾ à¦¦à§‡à¦–à¦¤à§‡ à¦ªà§‡à¦œà¦Ÿà¦¿ à¦°à¦¿à¦²à§‹à¦¡ à¦•à¦°à§à¦¨à¥¤
              </div>
              <button onclick="location.reload()"
                style="background:linear-gradient(135deg,#00ff88,#00d9ff);color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:.95rem;cursor:pointer;margin-top:8px">
                ðŸ”„ à¦à¦–à¦¨à¦‡ à¦°à¦¿à¦²à§‹à¦¡ à¦•à¦°à§à¦¨
              </button>`;
        }

        logActivity('add', 'import', `Imported ${imported} records from JSON with date: ${customDate}`);
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));

      } catch (err) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `âŒ à¦¤à§à¦°à§à¦Ÿà¦¿: ${err.message}`; }
        Utils.toast('JSON à¦ªà¦¡à¦¼à¦¤à§‡ à¦¬à§à¦¯à¦°à§à¦¥: ' + err.message, 'error');
        console.error('[importFromJSONWithDate]', err);
      }
    };
    input.click();
  }

  // â”€â”€ Legacy Data Transformer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // âœ… REQ 1: Support custom import date
  async function importLegacyData(data, statusEl, customDate) {
    let total = 0;
    
    // âœ… REQ 1: If custom date provided, convert to ISO format
    const importDateISO = customDate && customDate.length === 10 ? customDate : null;

    if (data.students && data.students.length) {
      const log = (m) => { if (statusEl) statusEl.innerHTML = m; };
      log('ðŸ”„ Importing students...');
      const mapped = data.students.map(s => ({
        id: SupabaseSync.generateId(),
        student_id: s.studentId || s.student_id || '',
        name: s.name || '', phone: s.phone || '', course: s.course || '',
        batch: s.batch || '', session: s.session || '',
        total_fee: s.totalPayment || s.total_fee || 0,
        paid: s.paid || 0, due: s.due || (s.totalPayment || 0) - (s.paid || 0),
        method: s.method || 'Cash',
        admission_date: importDateISO || s.enrollDate || s.admission_date || '',
        father_name: s.fatherName || s.father_name || '',
        mother_name: s.motherName || s.mother_name || '',
        blood_group: s.bloodGroup || s.blood_group || '',
        photo: s.photo || '', remarks: s.remarks || '', status: s.status || 'Active',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (s.createdAt || s.created_at || new Date().toISOString()),
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.students);
      const existingSids = new Set(existing.map(r => r.student_id));
      const newRows = mapped.filter(r => !existingSids.has(r.student_id));
      if (newRows.length) { SupabaseSync.setAll(DB.students, [...newRows, ...existing]); total += newRows.length; }
    }

    if (data.employees && data.employees.length) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing staff...';
      const mapped = data.employees.map(emp => ({
        id: emp.id || SupabaseSync.generateId(),
        staffId: emp.id || emp.staffId || '', name: emp.name || '', role: emp.role || 'Staff',
        phone: emp.phone || '', email: emp.email || '', salary: emp.salary || 0,
        status: emp.status || 'Active', joiningDate: emp.joiningDate || '', resignDate: emp.resignDate || '',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (emp.lastUpdated || emp.createdAt || new Date().toISOString()),
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.staff);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) { SupabaseSync.setAll(DB.staff, [...newRows, ...existing]); total += newRows.length; }
    }

    if (data.finance && data.finance.length) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing finance...';
      const mapped = data.finance.map(f => ({
        id: String(f.id || SupabaseSync.generateId()),
        type: f.type || 'Expense', method: f.method || 'Cash', category: f.category || '',
        description: f.description || '', amount: f.amount || 0, 
        date: importDateISO || f.date || '',
        note: f.note || f.person || '',
        person_name: f.person_name || f.person || '',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (f.createdAt || f.timestamp || new Date().toISOString()),
        updated_at: f.updatedAt || new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.finance);
      const existingIds = new Set(existing.map(r => r.id));
      const newRows = mapped.filter(r => !existingIds.has(r.id));
      if (newRows.length) { SupabaseSync.setAll(DB.finance, [...newRows, ...existing]); total += newRows.length; }
    }

    if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing accounts...';
    const accountEntries = [];
    if (data.cashBalance) {
      const bal = typeof data.cashBalance === 'object' ? (data.cashBalance.amount || data.cashBalance.balance || 0) : data.cashBalance;
      accountEntries.push({ id: SupabaseSync.generateId(), type: 'Cash', balance: bal, created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    if (data.bankAccounts && Array.isArray(data.bankAccounts)) {
      data.bankAccounts.forEach(b => {
        const nm = b.name || b.bankName || 'Bank';
        accountEntries.push({
          id: SupabaseSync.generateId(),
          type: 'Bank_Detail',
          name: nm,
          balance: b.balance || b.amount || 0,
          created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    }
    if (data.mobileBanking) {
      const bal = typeof data.mobileBanking === 'object' ? (data.mobileBanking.balance || data.mobileBanking.amount || 0) : data.mobileBanking;
      const mbName = (typeof data.mobileBanking === 'object' && data.mobileBanking.name) ? data.mobileBanking.name : 'Mobile Banking';
      accountEntries.push({ id: SupabaseSync.generateId(), type: 'Mobile_Detail', name: mbName, balance: bal, created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    if (accountEntries.length) {
      const existing = SupabaseSync.getAll(DB.accounts);
      SupabaseSync.setAll(DB.accounts, [...accountEntries, ...existing]);
      total += accountEntries.length;
    }

    if (data.visitors && data.visitors.length) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing visitors...';
      const mapped = data.visitors.map(v => ({
        id: v.id || SupabaseSync.generateId(), name: v.name || '', phone: v.phone || '',
        course: v.interestedCourse || v.course || '', remarks: v.remarks || '',
        visit_date: importDateISO || v.date || v.visitDate || '',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (v.createdAt || new Date().toISOString()), 
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.visitors);
      SupabaseSync.setAll(DB.visitors, [...mapped, ...existing]);
      total += mapped.length;
    }

    if (data.notices && data.notices.length) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing notices...';
      const mapped = data.notices.map(n => ({
        ...n,
        date: importDateISO || n.date || '',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (n.created_at || new Date().toISOString()),
      }));
      const existing = SupabaseSync.getAll(DB.notices);
      SupabaseSync.setAll(DB.notices, [...mapped, ...existing]);
      total += mapped.length;
    }

    if (data.settings) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing settings...';
      const cfg = Array.isArray(data.settings) ? data.settings[0] : data.settings;
      if (cfg) {
        const existing = SupabaseSync.getAll(DB.settings);
        if (!existing.length) {
          // SECURITY: admin_password à¦•à¦–à¦¨à§‹ backup à¦¥à§‡à¦•à§‡ import à¦•à¦°à¦¾ à¦¹à¦¬à§‡ à¦¨à¦¾
          // Backup-à¦ plaintext à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¥à¦¾à¦•à¦²à§‡à¦“ à¦à¦–à¦¾à¦¨à§‡ à¦¸à§‡à¦Ÿ à¦¹à¦¬à§‡ à¦¨à¦¾
          SupabaseSync.insert(DB.settings, {
            academy_name: cfg.academyName || cfg.academy_name || 'Wings Fly Aviation Academy',
            address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
            // admin_password intentionally excluded â€” set via Settings â†’ Change Password
          }, { bypassLog: true });
          total += 1;
        } else {
          // Existing settings à¦¥à¦¾à¦•à¦²à§‡ à¦¶à§à¦§à§ non-sensitive fields à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§‹
          const existingCfg = { ...existing[0] };
          existingCfg.academy_name = cfg.academyName || cfg.academy_name || existingCfg.academy_name;
          // admin_password à¦•à¦–à¦¨à§‹ backup à¦¥à§‡à¦•à§‡ overwrite à¦¹à¦¬à§‡ à¦¨à¦¾
          delete existingCfg.admin_password;
          const currentPw = existing[0].admin_password;
          if (currentPw) existingCfg.admin_password = currentPw;
          SupabaseSync.update(DB.settings, existingCfg.id, existingCfg, { bypassLog: true });
        }
      }
    }

    if (data.examRegistrations && data.examRegistrations.length) {
      if (statusEl) statusEl.innerHTML = 'ðŸ”„ Importing exams...';
      const mapped = data.examRegistrations.map(e => ({
        id: e.id || SupabaseSync.generateId(),
        reg_id: e.regId || e.reg_id || '', student_id: e.studentId || e.student_id || '',
        student_name: e.studentName || e.student_name || '', batch: e.batch || '',
        subject: e.subject || '', exam_date: importDateISO || e.examDate || e.exam_date || '',
        exam_fee: e.examFee || e.exam_fee || 0, grade: e.grade || '',
        marks: e.marks || null, status: e.status || 'Registered',
        created_at: importDateISO ? (importDateISO + 'T00:00:00.000Z') : (e.createdAt || new Date().toISOString()), 
        updated_at: new Date().toISOString(),
      }));
      const existing = SupabaseSync.getAll(DB.exams);
      SupabaseSync.setAll(DB.exams, [...mapped, ...existing]);
      total += mapped.length;
    }

    return total;
  }

  // â”€â”€ Modern Data Importer (with custom date support) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // âœ… FIX: This function was called on line 5080 but was never defined.
  //         Extracted from importFromJSON() modern-format logic + custom date support.
  async function importModernData(data, statusEl, customDate, tableCount) {
    let imported = 0;
    tableCount = tableCount || 0;
    const tableDetails = [];

    // âœ… If custom date provided, use it for date fields
    const importDateISO = customDate && customDate.length === 10 ? customDate : null;

    // Meta/non-table keys to skip
    const SKIP_KEYS = new Set(['meta', 'version', 'exportedAt', '_exportedAt', '_version', '_meta']);

    // Table name aliases (export uses DB table names directly)
    const tableAliases = {
      finance: DB.finance,
      financeLedger: DB.finance,
      finance_ledger: DB.finance,
      ledger: DB.finance,
      staff: DB.staff,
      employees: DB.staff,
    };

    for (const [key, rows] of Object.entries(data)) {
      // Skip non-table metadata keys
      if (SKIP_KEYS.has(key) || key.startsWith('_')) continue;
      // Must be a non-empty array
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const targetTable = tableAliases[key] || key;

      if (statusEl) statusEl.innerHTML = `ðŸ”„ Importing ${targetTable}...`;

      // Get existing records in this table
      const existing = SupabaseSync.getAll(targetTable);
      const existingIds = new Set(existing.map(r => r.id));

      // Apply custom date if provided, then dedup by id
      const processedRows = importDateISO
        ? rows.map(r => ({
            ...r,
            created_at: importDateISO + 'T00:00:00.000Z',
            // Override date fields relevant to each table
            ...(r.date !== undefined           ? { date: importDateISO }       : {}),
            ...(r.admission_date !== undefined  ? { admission_date: importDateISO } : {}),
            ...(r.visit_date !== undefined      ? { visit_date: importDateISO }    : {}),
            ...(r.exam_date !== undefined       ? { exam_date: importDateISO }     : {}),
          }))
        : rows;

      // Only import rows that don't already exist (dedup by id)
      const newRows = processedRows.filter(r => r && r.id && !existingIds.has(r.id));

      if (newRows.length > 0) {
        // Merge: new rows first so they show at top
        SupabaseSync.setAll(targetTable, [...newRows, ...existing]);
        imported += newRows.length;
        tableCount++;
        tableDetails.push(`${targetTable}: ${newRows.length}à¦Ÿà¦¿`);
      }
    }

    if (statusEl && tableDetails.length > 0) {
      const detailsStr = `<br><small style="color:var(--text-muted)">${tableDetails.join(' | ')}</small>`;
      statusEl.innerHTML = `âœ… à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ <strong>${imported}à¦Ÿà¦¿ à¦°à§‡à¦•à¦°à§à¦¡</strong> ${tableCount}à¦Ÿà¦¿ à¦Ÿà§‡à¦¬à¦¿à¦²à§‡ à¦‡à¦®à§à¦ªà§‹à¦°à§à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡!${detailsStr}`;
    }

    return imported;
  }

  // â”€â”€ Clear Local Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function clearLocalData() {
    const ok = await Utils.confirm('Delete all local data? Cloud data will remain. Settings will be kept.', 'Reset Data');
    if (!ok) return;
    SyncEngine.stopRealtime();
    Object.entries(DB).forEach(([key, t]) => {
      if (key !== 'settings') localStorage.removeItem(`wfa_${t}`);
    });
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_recycle_bin');
    localStorage.removeItem('wfa_retry_queue');
    logActivity('delete', 'system', 'Local data reset (kept settings)');
    Utils.toast('Local data deleted. Page reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  }

  // â”€â”€ Factory Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function factoryReset() {
    const ok = await Utils.confirm('âš ï¸ FACTORY RESET will delete ALL data including settings! This cannot be undone!', 'â˜¢ï¸ Factory Reset');
    if (!ok) return;
    const ok2 = await Utils.confirm('Are you ABSOLUTELY sure? ALL data will be permanently lost!', 'Final Confirmation');
    if (!ok2) return;

    // Delete cloud data
    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch (e) { console.warn('[FactoryReset] Table delete failed:', tableName, e?.message); }
      }
    } catch (e) { console.warn('[FactoryReset] Cloud delete skipped (offline or no client):', e?.message); }

    // Delete all local data
    Object.values(DB).forEach(t => localStorage.removeItem(`wfa_${t}`));
    localStorage.removeItem('wfa_deletedItems');
    localStorage.removeItem('wfa_recycle_bin');
    localStorage.removeItem('wfa_activity_log');
    localStorage.removeItem('wfa_keep_records');
    localStorage.removeItem('wfa_advance_payments');
    localStorage.removeItem('wfa_investments');
    localStorage.removeItem('wfa_recent_changes');
    localStorage.removeItem('wfa_retry_queue');

    Utils.toast('Factory reset complete. Page reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  }

  // â”€â”€ Clear Cloud Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function clearCloudData() {
    const ok = await Utils.confirm('âš ï¸ All cloud data will be permanently deleted!', 'â˜ï¸ Delete Cloud Data');
    if (!ok) return;
    try {
      const { client } = window.SUPABASE_CONFIG;
      for (const tableName of Object.values(DB)) {
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch (e) { console.warn('[ClearCloud] Table delete failed:', tableName, e?.message); }
      }
      Utils.toast('Cloud data deleted', 'info');
    } catch (e) {
      Utils.toast('Failed: ' + e.message, 'error');
    }
  }

  // â”€â”€ Auto Snapshots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // âœ… Fix: Snapshots now stored in IndexedDB (via WFA_IDB) instead of localStorage.
  //         localStorage has a 5MB hard limit â€” snapshots containing all data easily exceed it.
  //         IndexedDB supports 500MB+ so quota errors are eliminated.
  const SNAPSHOT_IDB_KEY = 'wfa_snapshots';

  function getSnapshots() {
    try {
      if (typeof WFA_IDB !== 'undefined') {
        return WFA_IDB.getTable(SNAPSHOT_IDB_KEY) || [];
      }
    } catch (e) { console.warn('[Snapshot] IDB read failed, falling back to localStorage:', e?.message); }
    // Fallback: try reading from localStorage for backwards-compat
    return Utils.safeJSON(localStorage.getItem('wfa_auto_snapshots'), []);
  }

  // âœ… Fix: Save snapshots to IndexedDB â€” no quota limit
  function _saveSnapshotsQuotaSafe(snapshots) {
    try {
      if (typeof WFA_IDB !== 'undefined') {
        WFA_IDB.setTable(SNAPSHOT_IDB_KEY, snapshots);
        // Also clear old localStorage snapshots to free space
        try { localStorage.removeItem('wfa_auto_snapshots'); } catch (e) { console.warn('[Snapshot] Could not clear old localStorage snapshot:', e?.message); }
        return true;
      }
    } catch (e) {
      console.error('[Snapshot] IDB write failed:', e);
    }
    // Fallback to localStorage with quota protection
    const MAX_ATTEMPTS = snapshots.length;
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        localStorage.setItem('wfa_auto_snapshots', JSON.stringify(snapshots));
        return true;
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          if (snapshots.length === 0) {
            console.warn('[Snapshot] Storage quota exceeded â€” cannot save even 1 snapshot. Skipping.');
            return false;
          }
          snapshots.pop();
          console.warn(`[Snapshot] Quota hit â€” trimmed to ${snapshots.length} snapshot(s).`);
        } else {
          console.error('[Snapshot] Unexpected storage error:', e);
          return false;
        }
      }
    }
    return false;
  }

  function saveSnapshot(manual = false) {
    const snapshots = getSnapshots();
    const now = new Date();

    if (!manual && snapshots.length > 0) {
      const lastAuto = snapshots.find(s => !s.manual);
      if (lastAuto) {
        const diffMinutes = (now - new Date(lastAuto.timestamp)) / 1000 / 60;
        if (diffMinutes < 60) return;
      }
    }

    const data = {};
    if (typeof DB !== 'undefined' && typeof SupabaseSync !== 'undefined') {
      Object.keys(DB).forEach(key => {
        let rows = SupabaseSync.getAll(DB[key]);
        
        // Security and Bloat Prevention
        if (DB[key] === 'settings') {
          rows = rows.map(r => { 
            const s = {...r}; 
            delete s.admin_password; 
            delete s.security_answer; 
            // PREVENT RECURSIVE BLOAT!
            delete s.snapshots;
            delete s.activity_log;
            delete s.recycle_bin;
            delete s.keep_records;
            return s; 
          });
        }
        
        // Strip heavy base64 data to keep snapshots tiny
        if (DB[key] === 'students' || DB[key] === 'staff' || DB[key] === 'visitors') {
          rows = rows.map(r => {
             const s = {...r};
             delete s.photo;
             delete s.signature;
             delete s.nid_front;
             delete s.nid_back;
             return s;
          });
        }
        
        data[DB[key]] = rows;
      });
    }

    snapshots.unshift({
      id: 'snap_' + Date.now(),
      timestamp: now.toISOString(),
      displayDate: typeof Utils !== 'undefined'
        ? Utils.formatDateEN(now.toISOString()) + ', ' + now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})
        : now.toLocaleString(),
      manual: manual,
      data: data,
    });

    // âœ… Fix: Cap at 3 to save storage space
    if (snapshots.length > 3) snapshots.length = 3;

    const saved = _saveSnapshotsQuotaSafe(snapshots);
    if (manual) {
      if (saved) {
        if (typeof Utils !== 'undefined') Utils.toast('ðŸ“¸ Snapshot Saved!', 'success');
      } else {
        if (typeof Utils !== 'undefined') Utils.toast('âš ï¸ Snapshot skipped â€” storage full. Try exporting a manual backup instead.', 'warn');
      }
      refreshModal();
    }
  }

  // â”€â”€ Daily Auto Backup Download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function tryDailyAutoDownload() {
    try {
      const today   = new Date().toISOString().split('T')[0];
      const lastDay = localStorage.getItem('wfa_last_auto_download') || '';
      if (lastDay === today) return; // à¦†à¦œà¦•à§‡ already à¦¹à¦¯à¦¼à§‡à¦›à§‡

      if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') return;
      const students = SupabaseSync.getAll(DB.students || 'students');
      if (!students || students.length === 0) return; // data ready à¦¨à¦¾

      // exportAllData à¦à¦° à¦®à¦¤à§‹ à¦•à¦°à§‡ data à¦¨à¦¾à¦“
      const allData = {};
      for (const [_key, tableName] of Object.entries(DB)) {
        let rows = SupabaseSync.getAll(tableName);
        if (tableName === 'settings') {
          rows = rows.map(r => { const s = {...r}; delete s.admin_password; delete s.security_answer; return s; });
        }
        allData[tableName] = rows;
      }
      allData._exportedAt = new Date().toISOString();
      allData._version = '2';

      const json = JSON.stringify(allData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `wfa_backup_${today}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);

      localStorage.setItem('wfa_last_auto_download', today);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('ðŸ“¥ Daily auto backup downloaded: wfa_backup_' + today + '.json', 'success', 6000);
      }
      console.info('[AutoBackup] âœ… Daily backup downloaded for', today);
    } catch(e) {
      console.warn('[AutoBackup] Daily download failed:', e);
    }
  }

  function restoreSnapshot(snapId) {
    if(typeof Utils !== 'undefined') {
       Utils.confirm("Are you sure you want to restore this snapshot? All current data will be replaced!").then(ok => {
         if(!ok) return;
         _doRestore(snapId);
       });
    } else {
       if(!window.confirm("Are you sure you want to restore this snapshot? All current data will be replaced!")) return;
       _doRestore(snapId);
    }
  }

  function _doRestore(snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return;

    if (typeof SupabaseSync !== 'undefined') {
      Object.keys(snap.data).forEach(table => {
        SupabaseSync.setAll(table, snap.data[table]);
      });
    }

    if(typeof Utils !== 'undefined') Utils.toast('âœ… Snapshot Restored Successfully', 'success');
    logActivity('edit', 'system', 'Restored database from snapshot: ' + snap.displayDate);
    setTimeout(() => window.location.reload(), 1500);
  }

  function downloadSnapshot(snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snap.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `wfa_snapshot_${snap.id}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
  }

  function deleteSnapshot(snapId) {
    let snapshots = getSnapshots();
    snapshots = snapshots.filter(s => s.id !== snapId);
    _saveSnapshotsQuotaSafe(snapshots);
    if(typeof Utils !== 'undefined') Utils.toast('Snapshot deleted', 'info');
    refreshModal();
  }

  async function clearAllSnapshots() {
    const ok = await Utils.confirm("Are you sure you want to delete ALL auto snapshots?", "Clear All Snapshots");
    if (!ok) return;
    _saveSnapshotsQuotaSafe([]);
    if(typeof Utils !== 'undefined') Utils.toast('All snapshots cleared!', 'success');
    refreshModal();
  }

  function buildSnapshotsHTML() {
    const snaps = getSnapshots();
    return `
      <div class="settings-card glow-cyan" style="margin-top:20px;border-color:var(--brand-primary);background:var(--bg-card)">
        
        <div class="settings-card-title" style="color:var(--brand-primary);font-weight:800;letter-spacing:1px;font-size:1.1rem;margin-bottom:12px;border-bottom:1px solid rgba(0,217,255,0.15);padding-bottom:10px">
          <i class="fa fa-camera-retro"></i> AUTO SNAPSHOTS
        </div>
        
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,150,255,0.05);padding:12px 18px;border-radius:8px;border:1px solid rgba(0,217,255,0.2);margin-bottom:15px">
           <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
             <span style="color:var(--brand-primary);font-weight:600;font-size:0.95rem">à¦ªà§à¦°à¦¤à¦¿ à§§ à¦˜à¦£à§à¦Ÿà¦¾à¦¯à¦¼ auto snapshot</span>
             <span class="badge" style="background:rgba(0,217,255,0.15);color:var(--brand-primary);border-radius:20px;padding:3px 12px;font-size:0.75rem;border:1px solid rgba(0,217,255,0.3)">LAST 3 à¦°à¦¾à¦–à¦¾ à¦¹à¦¯à¦¼ Â· IndexedDB</span>
           </div>
           <div style="display:flex; gap: 8px;">
             <button class="btn btn-outline" style="border-color:var(--error);color:var(--error);font-size:0.85rem;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;" onclick="SettingsModule.clearAllSnapshots()">
                <i class="fa fa-trash"></i> Clear All
             </button>
             <button class="btn btn-outline" style="border-color:var(--brand-cyan);color:var(--brand-primary);font-size:0.85rem;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;box-shadow:0 0 10px rgba(0,217,255,0.2)" onclick="SettingsModule.saveSnapshot(true)">
                <i class="fa fa-camera-retro"></i> à¦à¦–à¦¨à¦‡ à¦¨à¦¿à¦¨
             </button>
           </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${snaps.length === 0 ? `<div style="text-align:center;color:var(--text-muted);font-size:0.9rem;padding:25px;background:rgba(0,0,0,0.2);border-radius:8px">No snapshots available</div>` : ''}
          ${snaps.map((s, idx) => `
             <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface-solid);padding:12px 18px;border-radius:8px;border:1px solid var(--border);transition:all 0.3s ease">
               <div style="color:rgba(255,255,255,0.9);font-size:0.9rem;font-weight:500;display:flex;align-items:center;gap:8px">
                 <span style="color:var(--brand-primary);font-weight:700">#${snaps.length - idx}</span> 
                 <i class="fa fa-camera-retro" style="opacity:0.7;margin:0 4px;"></i> ${s.displayDate} ${s.manual ? '<span style="font-size:0.65rem;background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:10px;color:#fff;margin-left:5px">Manual</span>' : ''}
               </div>
               <div style="display:flex;gap:10px">
                 <button class="btn" style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:var(--success);font-size:0.75rem;padding:5px 12px;border-radius:15px;display:flex;align-items:center;gap:5px" onclick="SettingsModule.restoreSnapshot('${s.id}')">
                   <i class="fa fa-rotate-left"></i> RESTORE
                 </button>
                 <button class="btn" style="background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.3);color:var(--brand-primary);font-size:0.8rem;padding:5px 12px;border-radius:15px;display:flex;align-items:center;justify-content:center" onclick="SettingsModule.downloadSnapshot('${s.id}')">
                   <i class="fa fa-arrow-down"></i>
                 </button>
                 <button class="btn" style="background:rgba(255,0,85,0.1);border:1px solid rgba(255,0,85,0.3);color:var(--error);font-size:0.8rem;padding:5px 12px;border-radius:15px;display:flex;align-items:center;justify-content:center" onclick="SettingsModule.deleteSnapshot('${s.id}')">
                   <i class="fa fa-trash-can"></i>
                 </button>
               </div>
             </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // â”€â”€ Recovery & Sub-accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function saveRecoverySettings() {
     const question = document.getElementById('sec-question')?.value;
     const answer = document.getElementById('sec-answer')?.value?.trim();
     if(!question || !answer) {
        if(typeof Utils !== 'undefined') Utils.toast('Both question and answer are required', 'error');
        return;
     }

     const cfg = getConfig();
     cfg.id = cfg.id || SupabaseSync.generateId();
     cfg.security_question = question;
     cfg.security_answer = answer; // In a real app this should be hashed, but keeping it simple for local
     saveConfig(cfg);
     
     logActivity('edit', 'security', 'Updated Secret Recovery Question');
     if(typeof Utils !== 'undefined') Utils.toast('Security Settings Saved âœ…', 'success');
     refreshModal();
  }

  // â”€â”€ Supabase Auth credentials save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function saveCloudApiCredentials() {
    const url = document.getElementById('supa-project-url')?.value?.trim();
    const key = document.getElementById('supa-anon-key')?.value?.trim();
    if (!url || !url.includes('supabase.co')) {
      Utils.toast('Valid Supabase project URL required', 'error');
      return;
    }
    if (!key || key.length < 20) {
      Utils.toast('Valid anon key required', 'error');
      return;
    }
    try {
      if (!window.SUPABASE_CONFIG?.saveCloudCredentials) {
        throw new Error('Supabase config not ready');
      }
      await window.SUPABASE_CONFIG.saveCloudCredentials(url, key);
      logActivity('edit', 'security', 'Supabase API credentials updated');
      Utils.toast('Cloud API credentials saved (encrypted) âœ…', 'success');
      // âœ… FIX: Reset sync anchor & trigger full pull so data loads immediately
      if (window.SyncEngine) {
        window.SyncEngine.resetSyncAnchor();
        window.SyncEngine.fullPull({ silent: false }).catch(function(e) {
          console.warn('[Settings] Full pull after credential save failed:', e);
        });
      }
    } catch (e) {
      Utils.toast(`Could not save API credentials: ${e.message}`, 'error');
    }
  }

  function saveSupabaseAuth() {
    const email = document.getElementById('supa-email')?.value?.trim();
    const pass  = document.getElementById('supa-pass')?.value;

    if (!email || !email.includes('@')) {
      Utils.toast('Valid email required', 'error'); return;
    }
    if (!pass || pass.length < 6) {
      Utils.toast('Password must be at least 6 characters', 'error'); return;
    }

    const cfg = getConfig();
    cfg.supabase_email    = email;
    // Note: password stored locally only â€” never pushed to Supabase settings table
    // (settings.js sanitizeRecord already strips it via _TABLE_COLS allowlist)
    cfg.supabase_password = pass;
    saveConfig(cfg);

    // Immediately try signing in so session is live
    if (window.SupabaseAuth) {
      SupabaseAuth.signIn(email, pass)
        .then(() => {
          logActivity('edit', 'security', 'Supabase Auth credentials saved & signed in');
          Utils.toast('Cloud credentials saved âœ… Supabase sign-in successful', 'success');
          // âœ… FIX: Reset sync anchor & trigger full pull so data loads immediately
          if (window.SyncEngine) {
            window.SyncEngine.resetSyncAnchor();
            window.SyncEngine.fullPull({ silent: false }).catch(function(e) {
              console.warn('[Settings] Full pull after sign-in failed:', e);
            });
          }
        })
        .catch(err => {
          logActivity('edit', 'security', 'Supabase Auth credentials saved (sign-in failed)');
          Utils.toast(`Credentials saved, but sign-in failed: ${err.message}`, 'warn');
        });
    } else {
      logActivity('edit', 'security', 'Supabase Auth credentials saved');
      Utils.toast('Cloud credentials saved âœ…', 'success');
    }
  }

  function getSubAccounts() {
     if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        return SupabaseSync.getAll(DB.sub_accounts || 'sub_accounts') || [];
     }
     return Utils.safeJSON(localStorage.getItem('wfa_sub_accounts'), []);
  }

  /* â”€â”€ SHA-256 password hashing (Web Crypto API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Passwords à¦•à¦–à¦¨à§‹ plaintext à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à¦¾ à¦¹à¦¬à§‡ à¦¨à¦¾à¥¤
     hashPassword(pw) â†’ Promise<string> hex digest
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async function hashPassword(pw) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {
      // Fallback: simple obfuscation à¦¯à¦¦à¦¿ Web Crypto à¦¨à¦¾ à¦¥à¦¾à¦•à§‡
      console.warn('Web Crypto unavailable, using fallback');
      let hash = 0;
      for (let i = 0; i < pw.length; i++) { hash = ((hash << 5) - hash) + pw.charCodeAt(i); hash |= 0; }
      return 'fb_' + Math.abs(hash).toString(16);
    }
  }

  /* Existing sub-accounts migrate à¦•à¦°à§‹ (plaintext â†’ hashed)
     App load à¦¹à¦“à¦¯à¦¼à¦¾à¦° à¦ªà¦°à§‡ à¦à¦•à¦¬à¦¾à¦° à¦šà¦²à¦¬à§‡, à¦¤à¦¾à¦°à¦ªà¦° à¦†à¦° à¦¦à¦°à¦•à¦¾à¦° à¦¨à§‡à¦‡à¥¤
  */
  async function migratePasswordsToHash() {
    const subs = getSubAccounts();
    let changed = false;
    for (let s of subs) {
      // à¦¯à¦¦à¦¿ hash à¦¨à¦¾ à¦¹à¦¯à¦¼à§‡ à¦¥à¦¾à¦•à§‡ (64-char hex à¦¨à¦¯à¦¼)
      if (s.password && !/^[0-9a-f]{64}$/.test(s.password) && !s.password.startsWith('fb_')) {
        s.password = await hashPassword(s.password);
        changed = true;
      }
    }
    if (changed) {
      subs.forEach(s => SupabaseSync.update(DB.sub_accounts || 'sub_accounts', s.id, s));
      console.info('[Security] Sub-account passwords migrated to SHA-256 hashes.');
    }
  }
  // Migration à¦à¦•à¦¬à¦¾à¦° à¦šà¦¾à¦²à¦¾à¦“
  migratePasswordsToHash();

  function buildSubAccountsList(subs) {
     return `
        <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.85rem">
           <thead>
             <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
               <th style="padding:6px 0; color:#fff">Username</th>
               <th style="padding:6px 0; color:#fff">Tabs Access</th>
               <th style="padding:6px 0; text-align:right">Action</th>
             </tr>
           </thead>
           <tbody>
             ${subs.map((s, idx) => `
               <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <td style="padding:8px 0; color:var(--brand-cyan)">@${Utils.esc(s.username)}</td>
                  <td style="padding:8px 0; color:var(--text-muted); max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${Utils.escAttr(s.permissions.join(', '))}">
                    ${s.permissions.length ? Utils.esc(s.permissions.join(', ')) : '<span style="color:var(--error)">No Access</span>'}
                  </td>
                  <td style="padding:8px 0; text-align:right">
                    <button class="btn btn-xs" style="background:rgba(255,0,85,0.1); border:1px solid rgba(255,0,85,0.3); color:var(--error); padding:2px 8px; border-radius:4px" onclick="SettingsModule.deleteSubAccount(${idx})"><i class="fa fa-trash"></i> DELETE</button>
                  </td>
               </tr>
             `).join('')}
           </tbody>
        </table>
     `;
  }

  async function addSubAccount() {
     const un = document.getElementById('sub-username')?.value?.trim();
     const pw = document.getElementById('sub-pw')?.value;
     
     if(!un || !pw) {
        if(typeof Utils !== 'undefined') Utils.toast('Username and Password required', 'error');
        return;
     }
     if(pw.length < 6) {
        if(typeof Utils !== 'undefined') Utils.toast('Password à¦•à¦®à¦ªà¦•à§à¦·à§‡ à§¬ à¦…à¦•à§à¦·à¦°à§‡à¦° à¦¹à¦¤à§‡ à¦¹à¦¬à§‡', 'error');
        return;
     }

     // Security check: restrict "admin" username for sub-accounts
     if (un.toLowerCase() === 'admin') {
        if(typeof Utils !== 'undefined') Utils.toast('Cannot use "admin" as sub-account username', 'error');
        return;
     }

     const permissions = [];
     const permsMap = {
        'perm-students':     'Students',
        'perm-finance':      'Finance/Ledger',
        'perm-accounts':     'Accounts',
        'perm-loans':        'Loans',
        'perm-exams':        'Exams',
        'perm-hr':           'HR / Staff',
        'perm-salary':       'Salary Hub',
        'perm-visitors':     'Visitors',
        'perm-attendance':   'Attendance',
        'perm-idcards':      'ID Cards',
        'perm-certificates': 'Certificates',
        'perm-noticeboard':  'Notice Board',
        'perm-settings':     'Settings',
     };

     for(const [id, label] of Object.entries(permsMap)) {
        const el = document.getElementById(id);
        if(el && el.checked) {
           permissions.push(label);
        }
     }

     const subs = getSubAccounts();
     if(subs.some(s => s.username === un)) {
        if(typeof Utils !== 'undefined') Utils.toast('Username already exists', 'error');
        return;
     }

     // â”€â”€ Password SHA-256 hash à¦•à¦°à§‡ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     const hashedPw = await hashPassword(pw);

     const newSub = {
        id: (typeof SupabaseSync !== 'undefined') ? SupabaseSync.generateId() : Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        username: un,
        password: hashedPw,   // SHA-256 hashed â€” plaintext à¦•à¦–à¦¨à§‹ store à¦¹à¦¯à¦¼ à¦¨à¦¾
        permissions: permissions
     };

     if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        SupabaseSync.insert(DB.sub_accounts || 'sub_accounts', newSub);
     } else {
        subs.push(newSub);
        localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
     }
     
     logActivity('add', 'security', `Added sub-account @${un}`);
     if(typeof Utils !== 'undefined') Utils.toast('Sub-account created âœ…', 'success');
     refreshModal();
  }

  function deleteSubAccount(idx) {
    const subs = getSubAccounts();
    const target = subs[idx];
    if (target) {
      // âœ… Req 2: push to recycle bin (IDB-backed) before deleting so it can be restored
      if (!target.id) target.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
        SupabaseSync._addToRecycleBinPublic('settings_subaccount', target);
      } else {
        const bin = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll('recycle_bin') || []) : [];
        bin.unshift({ table: 'settings_subaccount', type: 'subaccount', name: `@${target.username}`, data: target, deletedAt: new Date().toISOString() });
        if (bin.length > 500) bin.length = 500;
        if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin);
      }
      _saveRecycleBinToSettings();

      if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
         SupabaseSync.remove(DB.sub_accounts || 'sub_accounts', target.id);
      } else {
         subs.splice(idx, 1);
         localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
      }
      logActivity('delete', 'security', `Deleted sub-account @${target.username}`);
      if (typeof Utils !== 'undefined') Utils.toast('Sub-account deleted â†’ Recycle Bin-à¦ à¦†à¦›à§‡', 'warning');
      refreshModal();
    }
  }

  // â”€â”€ Custom Theme Logic â”€â”€
  function _getAllThemes() {
    const custom = Utils.safeJSON(localStorage.getItem('wfa_custom_themes'), []);
    return [...THEMES, ...custom];
  }

  function _injectCustomThemeStyle(theme) {
    let styleTag = document.getElementById('custom-theme-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'custom-theme-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `
      body.theme-custom {
        --brand-primary: ${theme.colors[1]};
        --brand-accent: ${theme.colors[2]};
        --brand-neon: ${theme.colors[3]};
        --bg-base: ${theme.colors[0]};
        --bg-surface-solid: color-mix(in srgb, ${theme.colors[0]} 80%, black);
        --bg-sidebar: color-mix(in srgb, ${theme.colors[0]} 90%, black);
        --border: color-mix(in srgb, ${theme.colors[1]} 20%, transparent);
        --border-glow: color-mix(in srgb, ${theme.colors[1]} 40%, transparent);
        --border-focus: ${theme.colors[1]};
        --shadow-neon: 0 0 20px color-mix(in srgb, ${theme.colors[1]} 20%, transparent), 0 0 40px color-mix(in srgb, ${theme.colors[2]} 10%, transparent);
        background-color: ${theme.colors[0]};
        background: ${theme.bg};
      }
    `;
  }

  // â”€â”€ Color presets for the theme builder â”€â”€
  const _THEME_PRESETS = [
    { label: 'ðŸŒŠ Ocean', bg: '#030d1a', primary: '#00c8ff', secondary: '#0066ff', neon: '#00ffdd' },
    { label: 'ðŸŒ¸ Cherry', bg: '#120008', primary: '#ff3ca0', secondary: '#ff7043', neon: '#ff9ff3' },
    { label: 'ðŸŒ¿ Forest', bg: '#050f05', primary: '#00e676', secondary: '#69f0ae', neon: '#b9f6ca' },
    { label: 'ðŸ”¥ Lava',  bg: '#1a0500', primary: '#ff5722', secondary: '#ff1744', neon: '#ffab40' },
    { label: 'ðŸ‘¾ Cyber', bg: '#050512', primary: '#b537f2', secondary: '#00d9ff', neon: '#ff00ff' },
    { label: 'ðŸŒ™ Dusk',  bg: '#0d0015', primary: '#e040fb', secondary: '#7c4dff', neon: '#ea80fc' },
  ];

  function _updateThemePreview() {
    const bg = document.getElementById('ct-bg1')?.value || '#050a15';
    const pr = document.getElementById('ct-primary')?.value || '#00d9ff';
    const sc = document.getElementById('ct-secondary')?.value || '#b537f2';
    const nn = document.getElementById('ct-neon')?.value || '#00ff88';
    const pv = document.getElementById('ct-preview');
    if (!pv) return;
    pv.style.background = `linear-gradient(135deg, ${bg} 0%, #000 100%)`;
    pv.querySelector('.pv-sidebar').style.background = `linear-gradient(180deg, color-mix(in srgb,${bg} 80%,black) 0%, ${bg} 100%)`;
    pv.querySelector('.pv-sidebar').style.borderRight = `1.5px solid ${pr}44`;
    pv.querySelector('.pv-nav-active').style.background = `${pr}22`;
    pv.querySelector('.pv-nav-active').style.color = pr;
    pv.querySelector('.pv-nav-active').style.borderLeft = `3px solid ${pr}`;
    pv.querySelector('.pv-btn').style.background = `linear-gradient(135deg,${pr},${sc})`;
    pv.querySelector('.pv-glow').style.boxShadow = `0 0 18px ${nn}55, 0 0 6px ${pr}44`;
    pv.querySelector('.pv-glow').style.borderColor = `${nn}88`;
    pv.querySelector('.pv-accent').style.color = sc;
    // update hex labels
    ['bg1','primary','secondary','neon'].forEach(k => {
      const el = document.getElementById(`ct-${k}-hex`);
      const inp = document.getElementById(`ct-${k === 'bg1' ? 'bg1' : k}`);
      if (el && inp) el.textContent = inp.value.toUpperCase();
    });
  }

  function _applyThemeBuilderPreset(idx) {
    const p = _THEME_PRESETS[idx];
    if (!p) return;
    document.getElementById('ct-bg1').value = p.bg;
    document.getElementById('ct-primary').value = p.primary;
    document.getElementById('ct-secondary').value = p.secondary;
    document.getElementById('ct-neon').value = p.neon;
    _updateThemePreview();
  }

  function openThemeBuilderModal(editId) {
    // If editing, load existing theme data
    let editTheme = null;
    if (editId) {
      const custom = Utils.safeJSON(localStorage.getItem('wfa_custom_themes'), []);
      editTheme = custom.find(t => t.id === editId) || null;
    }

    const defBg   = editTheme?.colors?.[0] || '#050a15';
    const defPr   = editTheme?.colors?.[1] || '#00d9ff';
    const defSc   = editTheme?.colors?.[2] || '#b537f2';
    const defNn   = editTheme?.colors?.[3] || '#00ff88';
    const defName = editTheme?.name || '';

    const m = document.createElement('div');
    m.id = 'theme-builder-modal';
    m.className = 'modal-backdrop open';
    m.style.zIndex = '9999';

    const presetsHTML = _THEME_PRESETS.map((p, i) =>
      `<button onclick="SettingsModule._applyThemeBuilderPreset(${i})"
        title="${p.label}"
        style="background:linear-gradient(135deg,${p.primary},${p.secondary});border:none;border-radius:6px;width:36px;height:36px;cursor:pointer;font-size:1rem;transition:transform .15s"
        onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'"
      >${p.label.split(' ')[0]}</button>`
    ).join('');

    m.innerHTML = `
      <div class="modal-box" style="max-width:600px;width:95vw">
        <div class="modal-header">
          <span class="modal-title bn">ðŸŽ¨ Custom Theme Builder</span>
          <button class="modal-close" onclick="document.getElementById('theme-builder-modal').remove()"><i class="fa fa-xmark"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px 10px 10px">

          <!-- LEFT: Controls -->
          <div style="display:flex;flex-direction:column;gap:12px">

            <!-- Theme Name -->
            <div>
              <label style="font-size:.78rem;color:var(--text-muted);font-weight:600;letter-spacing:.04em">THEME NAME</label>
              <input type="text" id="ct-name" class="form-control" placeholder="My Awesome Theme"
                value="${defName}" style="margin-top:4px">
            </div>

            <!-- Quick Presets -->
            <div>
              <label style="font-size:.78rem;color:var(--text-muted);font-weight:600;letter-spacing:.04em">âš¡ QUICK PRESETS</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${presetsHTML}</div>
            </div>

            <!-- Color Pickers -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">ðŸŒ‘ Background</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-bg1" value="${defBg}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-bg1-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defBg.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">âœ¨ Primary Accent</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-primary" value="${defPr}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-primary-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defPr.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">ðŸŽ† Secondary Accent</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-secondary" value="${defSc}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-secondary-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defSc.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">ðŸ’¡ Neon Glow</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-neon" value="${defNn}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-neon-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defNn.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <!-- Save + Cancel -->
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="btn btn-primary" style="flex:1;font-weight:700"
                onclick="SettingsModule.saveCustomThemeFromBuilder('${editId || ''}')">
                ðŸ’¾ ${editTheme ? 'Update Theme' : 'Save Theme'}
              </button>
              <button class="btn" style="flex:0 0 auto;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.15)"
                onclick="document.getElementById('theme-builder-modal').remove()">
                Cancel
              </button>
            </div>
          </div>

          <!-- RIGHT: Live Preview -->
          <div>
            <label style="font-size:.78rem;color:var(--text-muted);font-weight:600;letter-spacing:.04em">ðŸ‘ï¸ LIVE PREVIEW</label>
            <div id="ct-preview" style="margin-top:6px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12);height:240px;display:flex;font-size:.75rem;transition:all .2s;background:linear-gradient(135deg,${defBg} 0%,#000 100%)">
              <!-- Mini Sidebar -->
              <div class="pv-sidebar" style="width:90px;padding:10px 0;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,${defBg} 0%,${defBg} 100%);border-right:1.5px solid ${defPr}44">
                <div style="text-align:center;padding:6px;font-size:1rem;margin-bottom:4px">ðŸ¦…</div>
                <div class="pv-nav-active" style="padding:5px 8px;border-radius:0 6px 6px 0;font-weight:600;color:${defPr};background:${defPr}22;border-left:3px solid ${defPr}">ðŸ“Š Dash</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">ðŸ“š Course</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">ðŸ‘¥ Students</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">ðŸ’° Finance</div>
              </div>
              <!-- Mini Content -->
              <div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:6px;overflow:hidden">
                <div style="font-weight:700;font-size:.82rem;color:#fff;margin-bottom:2px">Dashboard</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
                  <div class="pv-glow" style="background:rgba(255,255,255,.06);border-radius:6px;padding:6px;border:1px solid ${defNn}88;box-shadow:0 0 18px ${defNn}55">
                    <div style="color:rgba(255,255,255,.4);font-size:.68rem">Students</div>
                    <div style="color:#fff;font-weight:700;font-size:.9rem">124</div>
                  </div>
                  <div style="background:rgba(255,255,255,.06);border-radius:6px;padding:6px;border:1px solid rgba(255,255,255,.08)">
                    <div style="color:rgba(255,255,255,.4);font-size:.68rem">Revenue</div>
                    <div class="pv-accent" style="font-weight:700;font-size:.9rem;color:${defSc}">à§³ 18k</div>
                  </div>
                </div>
                <div style="background:rgba(255,255,255,.05);border-radius:6px;padding:8px;border:1px solid rgba(255,255,255,.07);flex:1">
                  <div style="color:rgba(255,255,255,.35);font-size:.68rem;margin-bottom:4px">Recent Activity</div>
                  <div style="height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden"><div style="height:100%;width:70%;background:linear-gradient(90deg,${defPr},${defSc})"></div></div>
                </div>
                <button class="pv-btn" style="border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;font-size:.72rem;background:linear-gradient(135deg,${defPr},${defSc})">+ Add Student</button>
              </div>
            </div>
            <div style="text-align:center;font-size:.7rem;color:rgba(255,255,255,.3);margin-top:6px">à¦°à¦‚ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à¦²à§‡ à¦¸à¦¾à¦¥à§‡ à¦¸à¦¾à¦¥à§‡ preview à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¬à§‡</div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(m);
  }

  function saveCustomThemeFromBuilder(editId) {
    const name = document.getElementById('ct-name').value.trim() || 'My Theme';
    const bg1 = document.getElementById('ct-bg1').value;
    const p = document.getElementById('ct-primary').value;
    const s = document.getElementById('ct-secondary').value;
    const n = document.getElementById('ct-neon').value;

    let custom = Utils.safeJSON(localStorage.getItem('wfa_custom_themes'), []);

    if (editId) {
      // Edit mode: update existing theme
      const idx = custom.findIndex(t => t.id === editId);
      if (idx !== -1) {
        custom[idx] = {
          ...custom[idx],
          name,
          colors: [bg1, p, s, n],
          bg: 'linear-gradient(135deg, ' + bg1 + ' 0%, #000 100%)',
        };
        localStorage.setItem('wfa_custom_themes', JSON.stringify(custom));
        // If this theme is currently active, re-apply it
        if (localStorage.getItem('wfa_theme') === editId) {
          _injectCustomThemeStyle(custom[idx]);
        }
        document.getElementById('theme-builder-modal').remove();
        if (typeof Utils !== 'undefined') Utils.toast('âœ… Theme updated!', 'success');
        refreshModal();
        switchTab('theme');
        return;
      }
    }

    // Create mode
    if (custom.length >= 5) {
      if (typeof Utils !== 'undefined') Utils.toast('à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š à§«à¦Ÿà¦¿ custom theme à¦¸à§‡à¦­ à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤', 'error');
      return;
    }

    const tId = 'custom_' + Date.now();
    custom.push({
      id: tId,
      name,
      desc: 'Custom user-defined theme.',
      emoji: 'ðŸŽ¨',
      colors: [bg1, p, s, n],
      bg: 'linear-gradient(135deg, ' + bg1 + ' 0%, #000 100%)',
      isCustom: true
    });
    localStorage.setItem('wfa_custom_themes', JSON.stringify(custom));
    document.getElementById('theme-builder-modal').remove();
    if (typeof Utils !== 'undefined') Utils.toast('ðŸŽ¨ Theme saved! Theme panel à¦¥à§‡à¦•à§‡ select à¦•à¦°à§à¦¨à¥¤', 'success');
    refreshModal();
    switchTab('theme');
  }

  function deleteCustomTheme(tId) {
    let custom = Utils.safeJSON(localStorage.getItem('wfa_custom_themes'), []);
    const themeName = custom.find(t => t.id === tId)?.name || tId;
    custom = custom.filter(t => t.id !== tId);
    localStorage.setItem('wfa_custom_themes', JSON.stringify(custom));

    // âœ… Put deleted theme info in Keep Record
    const notes = getKeepRecords();
    const entry = { 
      title: `Deleted Theme: ${themeName}`, 
      content: `Custom Theme "${themeName}" (${tId}) was deleted from settings.`, 
      color: 'red', 
      tags: ['deleted', 'settings', 'theme'], 
      pinned: false, 
      date: new Date().toLocaleDateString('en-GB') 
    };
    notes.unshift(entry);
    _saveKeepRecords(notes); // âœ… synced to Supabase
    if (localStorage.getItem('wfa_theme') === tId) {
      applyTheme('neon-space');
    } else {
      if(typeof Utils !== 'undefined') Utils.toast('Custom Theme deleted', 'info');
      refreshModal();
      switchTab('theme');
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TAB: AI ASSISTANT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelAIAssistant() {
    const rawKey = localStorage.getItem('wfa_gemini_key') || '';
    const isEncrypted = rawKey.startsWith('wfa_enc::');
    const displayKey = isEncrypted ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (Encrypted)' : (rawKey ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (Legacy)' : '');
    // âœ… Bug #5 Fix: Auto-migrate plaintext key â†’ SecureStorage (one-time)
    if (rawKey && !isEncrypted && typeof SecureStorage !== 'undefined' && SecureStorage.setItem) {
      SecureStorage.setItem('wfa_gemini_key', rawKey).then(() => {
        console.info('[Security] Migrated plaintext Gemini key to SecureStorage.');
      }).catch(() => {});
    }
    // âœ… Security Fix: Auto-migrate plaintext backup keys â†’ SecureStorage (one-time, same as slot 1)
    ['wfa_gemini_key_2', 'wfa_gemini_key_3'].forEach(async slot => {
      const raw = localStorage.getItem(slot) || '';
      if (raw && !raw.startsWith('wfa_enc::') && typeof SecureStorage !== 'undefined' && SecureStorage.setItem) {
        try {
          await SecureStorage.setItem(slot, raw);
          localStorage.removeItem(slot);
          console.info('[Security] Migrated plaintext backup Gemini key to SecureStorage:', slot);
        } catch { /* ignore */ }
      }
    });
    // Check presence via localStorage/SecureStorage (sensitive keys are written to localStorage under their names)
    const hasBackup2 = !!(localStorage.getItem('wfa_gemini_key_2') || '').trim();
    const hasBackup3 = !!(localStorage.getItem('wfa_gemini_key_3') || '').trim();
    const localOnly = localStorage.getItem('wfa_ai_local_only') === 'true';
    
    return `
    <div class="settings-panel ${activeTab === 'ai-assistant' ? 'active' : ''}" data-panel="ai-assistant">
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-robot"></i> Academy Assistant (Hybrid)</div>
        <div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);padding:14px;border-radius:8px;margin-bottom:16px;font-size:0.85rem;">
          <strong>ðŸ”„ à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼ Hybrid:</strong> à¦›à¦¾à¦¤à§à¦°/à¦¬à¦•à§‡à¦¯à¦¼à¦¾/à¦²à§‡à¦¨à¦¦à§‡à¦¨ = à¦¸à¦¬à¦¸à¦®à¦¯à¦¼ à¦²à§‹à¦•à¦¾à¦² à¦¡à¦¾à¦Ÿà¦¾à¥¤
          API Key à¦¸à§‡à¦Ÿ à¦•à¦°à¦²à§‡ à¦…à¦¨à§à¦¯ à¦ªà§à¦°à¦¶à§à¦¨ Gemini-à¦¤à§‡ à¦¯à¦¾à¦¬à§‡à¥¤ <strong>à¦²à¦¿à¦®à¦¿à¦Ÿ à¦¶à§‡à¦· à¦¹à¦²à§‡ à¦…à¦Ÿà§‹ à¦²à§‹à¦•à¦¾à¦²</strong> â€” à¦†à¦¬à¦¾à¦° Key à¦•à¦¾à¦œ à¦•à¦°à¦²à§‡ Gemini à¦«à¦¿à¦°à§‡ à¦†à¦¸à¦¬à§‡à¥¤
        </div>
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer;font-size:0.9rem;">
          <input type="checkbox" id="ai-local-only" ${localOnly ? 'checked' : ''} onchange="SettingsModule.toggleAILocalOnly(this.checked)" />
          <span><strong>à¦¶à§à¦§à§ Local</strong> â€” Gemini à¦à¦•à¦¦à¦® à¦¬à¦¨à§à¦§ (à¦šà¦¾à¦‡à¦²à§‡ à¦Ÿà¦¿à¦• à¦¦à¦¿à¦¨)</span>
        </label>
        <details open style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">Gemini API Key</summary>
        <div class="form-group" style="margin-bottom:16px;">
          <label>Primary Gemini API Key</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="password" id="ai-api-key-input" class="form-control" placeholder="AIzaSy..." value="${displayKey}" style="flex:1;min-width:200px" />
            <button class="btn btn-primary" onclick="SettingsModule.saveAIApiKey()">ðŸ’¾ Save</button>
            <button class="btn btn-secondary" onclick="SettingsModule.testAIApiKey()">ðŸ” Test Key</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label>Backup Keys (limit à¦¶à§‡à¦· à¦¹à¦²à§‡ auto-switch)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <input type="password" id="ai-api-key-2" class="form-control" placeholder="Backup 2 ${hasBackup2 ? 'âœ“' : ''}" style="flex:1;min-width:160px" />
            <input type="password" id="ai-api-key-3" class="form-control" placeholder="Backup 3 ${hasBackup3 ? 'âœ“' : ''}" style="flex:1;min-width:160px" />
            <button class="btn btn-secondary" onclick="SettingsModule.saveAIBackupKeys()">ðŸ’¾ Save Backup</button>
          </div>
        </div>
        </details>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">
          <strong>à¦œà¦¿à¦œà§à¦žà§‡à¦¸ à¦•à¦°à§à¦¨:</strong> "à¦¸à¦¾à¦°à¦¾à¦‚à¦¶", "à¦®à§‹à¦Ÿ à¦›à¦¾à¦¤à§à¦°", "à¦¬à¦•à§‡à¦¯à¦¼à¦¾", "à¦†à¦¦à¦¾à¦¯à¦¼", "à¦†à¦œà¦•à§‡à¦° à¦²à§‡à¦¨à¦¦à§‡à¦¨", "[à¦¨à¦¾à¦®]"
        </div>
      </div>
    </div>`;
  }

  function toggleAILocalOnly(checked) {
    if (typeof AIAssistant !== 'undefined' && AIAssistant.setLocalOnlyMode) {
      AIAssistant.setLocalOnlyMode(checked);
    } else {
      localStorage.setItem('wfa_ai_local_only', checked ? 'true' : 'false');
    }
    if (typeof Utils !== 'undefined') {
      Utils.toast(checked ? 'à¦¶à§à¦§à§ Local à¦®à§‹à¦¡ â€” Gemini à¦¬à¦¨à§à¦§' : 'Hybrid à¦®à§‹à¦¡ â€” Key à¦¥à¦¾à¦•à¦²à§‡ Gemini, à¦²à¦¿à¦®à¦¿à¦Ÿà§‡ Local', 'success');
    }
    refreshModal();
  }

  async function saveAIApiKey() {
    const el = document.getElementById('ai-api-key-input');
    if (!el) return;
    let key = el.value.trim();
    
    if (key.startsWith('â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢')) {
      if(typeof Utils !== 'undefined') Utils.toast('No changes made to existing encrypted key.', 'info');
      return;
    }
    
    if (!key) {
      if (typeof SecureStorage !== 'undefined') {
        try { await SecureStorage.removeItem('wfa_gemini_key'); } catch { /* ignore */ }
      }
      try { localStorage.removeItem('wfa_gemini_key'); } catch { /* ignore */ }
      if(typeof Utils !== 'undefined') Utils.toast('API Key removed.', 'info');
      refreshModal();
      return;
    }
    
    if (typeof SecureStorage === 'undefined') {
      if(typeof Utils !== 'undefined') Utils.toast('SecureStorage unavailable â€” cannot save API key safely.', 'error');
      return;
    }
    try {
      await SecureStorage.setItem('wfa_gemini_key', key);
    } catch {
      if(typeof Utils !== 'undefined') Utils.toast('Failed to save API key securely.', 'error');
      return;
    }
    if (typeof AIAssistant !== 'undefined' && AIAssistant.clearQuotaPause) {
      AIAssistant.clearQuotaPause();
    } else {
      sessionStorage.removeItem('wfa_ai_quota_pause_until');
    }
    localStorage.removeItem('wfa_ai_local_only');
    
    if(typeof Utils !== 'undefined') Utils.toast('âœ… API Key saved â€” Hybrid mode: Gemini + auto local fallback', 'success');
    refreshModal();
  }

  async function _saveGeminiSlot(slotKey, key) {
    if (!key || key.length < 10) return false;
    if (typeof SecureStorage === 'undefined') return false;
    try {
      await SecureStorage.setItem(slotKey, key);
      return true;
    } catch { return false; }
  }

  async function saveAIBackupKeys() {
    const k2 = (document.getElementById('ai-api-key-2')?.value || '').trim();
    const k3 = (document.getElementById('ai-api-key-3')?.value || '').trim();
    let saved = 0;
    if (k2 && await _saveGeminiSlot('wfa_gemini_key_2', k2)) saved++;
    if (k3 && await _saveGeminiSlot('wfa_gemini_key_3', k3)) saved++;
    if (typeof Utils !== 'undefined') {
      Utils.toast(saved ? `âœ… ${saved} backup key saved` : 'Backup key à¦–à¦¾à¦²à¦¿ â€” AIzaSy... à¦¬à¦¸à¦¾à¦¨', saved ? 'success' : 'warning');
    }
    refreshModal();
  }

  async function testAIApiKey() {
    if (typeof AIAssistant === 'undefined' || typeof AIAssistant.testApiKey !== 'function') {
      if (typeof Utils !== 'undefined') Utils.toast('AI Assistant module à¦²à§‹à¦¡ à¦¹à¦¯à¦¼à¦¨à¦¿', 'error');
      return;
    }
    if (typeof Utils !== 'undefined') Utils.toast('Key à¦¯à¦¾à¦šà¦¾à¦‡ à¦¹à¦šà§à¦›à§‡...', 'info', 2000);
    const result = await AIAssistant.testApiKey();
    if (typeof Utils !== 'undefined') {
      Utils.toast(result.message, result.ok ? 'success' : (result.quota ? 'warning' : 'error'), 10000);
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CLIENT MANAGER PANEL â€” Admin only
  // à¦¸à¦¬ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à§‡à¦° info + License Key generator
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function panelClientManager() {
    const isAdm = (typeof App !== 'undefined' && App.isAdmin && App.isAdmin()) ||
                  (localStorage.getItem('wfa_user_role') === 'admin');
    if (!isAdm) return `<div class="settings-panel" data-panel="client-manager"></div>`;

    const _CLIENTS_KEY = 'wfa_acadeflow_clients';
    function _loadClients() {
      try { return JSON.parse(localStorage.getItem(_CLIENTS_KEY) || '[]'); } catch { return []; }
    }
    function _saveClients(arr) {
      try { localStorage.setItem(_CLIENTS_KEY, JSON.stringify(arr)); } catch {}
    }

    const clients = _loadClients();

    function _statusBadge(client) {
      if (!client.licenseKey) return `<span style="background:rgba(120,120,120,0.15);color:#aaa;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">â¬œ No Key</span>`;
      const ls = typeof LicenseEngine !== 'undefined' ? LicenseEngine.validate(client.licenseKey) : null;
      if (!ls) return `<span style="background:rgba(120,120,120,0.15);color:#aaa;padding:2px 9px;border-radius:20px;font-size:0.72rem">Unknown</span>`;
      if (ls.expired) return `<span style="background:rgba(255,71,87,0.15);color:#ff4757;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">ðŸ”´ Expired</span>`;
      if (ls.inGrace) return `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">ðŸŸ¡ Grace (${ls.graceDaysLeft}d)</span>`;
      if (ls.daysLeft <= 7) return `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">ðŸŸ  ${ls.daysLeft}d left</span>`;
      return `<span style="background:rgba(0,255,136,0.12);color:#00ff88;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">âœ… Active (${ls.daysLeft}d)</span>`;
    }

    function _buildTable(list) {
      if (!list.length) return `<div style="text-align:center;color:#7a8baa;padding:32px;font-size:0.9rem">à¦•à§‹à¦¨à§‹ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¨à§‡à¦‡à¥¤ à¦¨à¦¿à¦šà§‡ à¦¥à§‡à¦•à§‡ à¦¯à§‹à¦— à¦•à¦°à§à¦¨à¥¤</div>`;
      return `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead><tr style="border-bottom:1px solid rgba(0,217,255,0.15)">
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">#</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">à¦®à¦¾à¦²à¦¿à¦•</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">à¦«à§‹à¦¨</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Package</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">License Key</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Status</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:right">Action</th>
          </tr></thead>
          <tbody>
            ${list.map((c, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04)" onmouseenter="this.style.background='rgba(0,217,255,0.04)'" onmouseleave="this.style.background='none'">
                <td style="padding:9px 6px;color:#7a8baa">${i+1}</td>
                <td style="padding:9px 6px;color:#fff;font-weight:600">${Utils.esc(c.academy||'â€”')}</td>
                <td style="padding:9px 6px;color:#ccc">${Utils.esc(c.owner||'â€”')}</td>
                <td style="padding:9px 6px;color:#ccc">${Utils.esc(c.phone||'â€”')}</td>
                <td style="padding:9px 6px">
                  <span style="background:rgba(123,47,247,0.15);color:#b57ff7;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700">${Utils.esc(c.package||'Basic')}</span>
                </td>
                <td style="padding:9px 6px;font-family:monospace;font-size:0.78rem;color:#00d9ff">
                  ${c.licenseKey
                    ? `<span title="${Utils.escAttr(c.licenseKey)}">${c.licenseKey.slice(0,18)}â€¦</span>
                       <button onclick="navigator.clipboard.writeText('${Utils.escAttr(c.licenseKey)}');Utils.toast('Key copied!','success')" style="background:none;border:none;color:#7a8baa;cursor:pointer;margin-left:4px">ðŸ“‹</button>`
                    : '<span style="color:#7a8baa">â€”</span>'}
                </td>
                <td style="padding:9px 6px">${_statusBadge(c)}</td>
                <td style="padding:9px 6px;text-align:right">
                  <button onclick="_wfaClientEdit(${i})" style="background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.2);color:#00d9ff;padding:3px 9px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-right:4px">âœï¸</button>
                  <button onclick="_wfaClientDelete(${i})" style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);color:#ff4757;padding:3px 9px;border-radius:6px;cursor:pointer;font-size:0.78rem">ðŸ—‘ï¸</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
    }

    function _summary(list) {
      const total   = list.length;
      const active  = list.filter(c => { if (!c.licenseKey || typeof LicenseEngine === 'undefined') return false; const s = LicenseEngine.validate(c.licenseKey); return s.ok || s.inGrace; }).length;
      const expired = list.filter(c => { if (!c.licenseKey || typeof LicenseEngine === 'undefined') return false; return LicenseEngine.validate(c.licenseKey).expired; }).length;
      return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:100px;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800;color:#00d9ff">${total}</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">à¦®à§‹à¦Ÿ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800;color:#00ff88">${active}</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">Active</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800;color:#ff4757">${expired}</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">Expired</div></div>
      </div>`;
    }

    // Global helpers for onclick handlers
    window._wfaClientSave = function() {
      const id = document.getElementById('cm-edit-id')?.value;
      const obj = {
        id:          id || Date.now().toString(36),
        academy:     document.getElementById('cm-academy')?.value?.trim()  || '',
        owner:       document.getElementById('cm-owner')?.value?.trim()    || '',
        phone:       document.getElementById('cm-phone')?.value?.trim()    || '',
        email:       document.getElementById('cm-email')?.value?.trim()    || '',
        package:     document.getElementById('cm-package')?.value          || 'Basic',
        licenseKey:  (document.getElementById('cm-lickey')?.value?.trim()?.toUpperCase()) || '',
        supabaseUrl: document.getElementById('cm-supurl')?.value?.trim()   || '',
        notes:       document.getElementById('cm-notes')?.value?.trim()    || '',
      };
      if (!id) obj.createdAt = new Date().toISOString();
      let list = _loadClients();
      const idx = list.findIndex(c => c.id === obj.id);
      if (idx >= 0) Object.assign(list[idx], obj); else list.push(obj);
      _saveClients(list);
      Utils.toast('à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¸à§‡à¦­ à¦¹à¦¯à¦¼à§‡à¦›à§‡ âœ…', 'success');
      SettingsModule.refreshModal();
    };

    window._wfaClientEdit = function(idx) {
      const list = _loadClients();
      const c = list[idx]; if (!c) return;
      const map = { 'cm-edit-id': c.id, 'cm-academy': c.academy, 'cm-owner': c.owner,
        'cm-phone': c.phone, 'cm-email': c.email, 'cm-package': c.package,
        'cm-lickey': c.licenseKey, 'cm-supurl': c.supabaseUrl, 'cm-notes': c.notes };
      Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
      document.getElementById('cm-form-title').textContent = `âœï¸ Edit: ${c.academy || 'Client'}`;
      document.getElementById('cm-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window._wfaClientDelete = function(idx) {
      if (!confirm('à¦à¦‡ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à¦•à§‡ à¦¸à¦¤à§à¦¯à¦¿à¦‡ à¦¡à¦¿à¦²à¦¿à¦Ÿ à¦•à¦°à¦¬à§‡à¦¨?')) return;
      const list = _loadClients(); list.splice(idx, 1); _saveClients(list);
      Utils.toast('à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¡à¦¿à¦²à¦¿à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡', 'warning');
      SettingsModule.refreshModal();
    };

    window._wfaGenerateLicKey = function() {
      if (typeof LicenseEngine === 'undefined') { Utils.toast('License engine not loaded', 'error'); return; }
      const code   = document.getElementById('cm-gen-code')?.value?.trim().toUpperCase() || 'C001';
      const months = parseInt(document.getElementById('cm-gen-months')?.value || '1');
      const result = LicenseEngine.generate(code, months);
      const keyEl  = document.getElementById('cm-gen-result');
      if (keyEl) { keyEl.value = result.key; keyEl.style.display = 'block'; }
      navigator.clipboard.writeText(result.key).catch(() => {});
      Utils.toast(`Key generated & copied! Expires: ${result.expires}`, 'success');
      const lkEl = document.getElementById('cm-lickey');
      if (lkEl && !lkEl.value) lkEl.value = result.key;
    };

    return `
    <div class="settings-panel ${activeTab === 'client-manager' ? 'active' : ''}" data-panel="client-manager">
      <div class="settings-card-title" style="color:var(--brand-primary)">
        <i class="fa fa-id-card"></i> CLIENT MANAGER
        <span style="font-size:0.72rem;font-weight:500;color:#7a8baa;margin-left:8px">Admin Only â€” à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à¦¦à§‡à¦° à¦¸à¦¬ à¦¤à¦¥à§à¦¯ à¦“ License</span>
      </div>

      ${_summary(clients)}

      <!-- Client Table -->
      <div class="settings-card" style="margin-bottom:20px">
        <div style="font-weight:700;color:#fff;font-size:0.95rem;margin-bottom:14px">ðŸ“‹ à¦¸à¦•à¦² à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°</div>
        ${_buildTable(clients)}
      </div>

      <!-- License Key Generator -->
      <div class="settings-card" style="margin-bottom:20px;border:1px solid rgba(123,47,247,0.3)">
        <div style="font-size:0.8rem;font-weight:700;color:#b57ff7;letter-spacing:1px;margin-bottom:14px;text-transform:uppercase">
          <i class="fa fa-key"></i> License Key Generator
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Customer Code (4 chars)</label>
            <input id="cm-gen-code" type="text" maxlength="4" class="form-control" placeholder="e.g. GL01" style="text-transform:uppercase;font-family:monospace" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Validity (Months)</label>
            <select id="cm-gen-months" class="form-control">
              <option value="1">1 Month</option>
              <option value="3">3 Months</option>
              <option value="6" selected>6 Months</option>
              <option value="12">12 Months</option>
            </select>
          </div>
        </div>
        <button onclick="_wfaGenerateLicKey()" style="background:linear-gradient(135deg,#7b2ff7,#b57ff7);border:none;color:#fff;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer;width:100%;margin-bottom:10px">
          ðŸ”‘ Generate New License Key
        </button>
        <input id="cm-gen-result" type="text" readonly
          style="display:none;width:100%;padding:10px 14px;border-radius:8px;background:rgba(123,47,247,0.1);border:1px solid rgba(123,47,247,0.4);color:#b57ff7;font-family:monospace;font-size:0.9rem;text-align:center;cursor:pointer;box-sizing:border-box"
          onclick="navigator.clipboard.writeText(this.value);Utils.toast('Copied!','success')" />
      </div>

      <!-- Add / Edit Client Form -->
      <div class="settings-card" id="cm-form-section" style="border:1px solid rgba(0,217,255,0.2)">
        <div style="font-size:0.8rem;font-weight:700;color:#00d9ff;letter-spacing:1px;margin-bottom:14px;text-transform:uppercase">
          <i class="fa fa-plus"></i> <span id="cm-form-title">à¦¨à¦¤à§à¦¨ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¯à§‹à¦— à¦•à¦°à§à¦¨</span>
        </div>
        <input type="hidden" id="cm-edit-id" value="" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">à¦à¦•à¦¾à¦¡à§‡à¦®à¦¿à¦° à¦¨à¦¾à¦® *</label>
            <input id="cm-academy" type="text" class="form-control" placeholder="Green Leaf Academy" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">à¦®à¦¾à¦²à¦¿à¦•à§‡à¦° à¦¨à¦¾à¦®</label>
            <input id="cm-owner" type="text" class="form-control" placeholder="à¦°à¦¹à¦¿à¦® à¦¸à¦¾à¦¹à§‡à¦¬" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">à¦«à§‹à¦¨ à¦¨à¦®à§à¦¬à¦°</label>
            <input id="cm-phone" type="tel" class="form-control" placeholder="01700-000000" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Email</label>
            <input id="cm-email" type="email" class="form-control" placeholder="client@email.com" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Package</label>
            <select id="cm-package" class="form-control">
              <option>Basic</option><option>Pro</option><option>Custom</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">License Key</label>
            <input id="cm-lickey" type="text" class="form-control" placeholder="WFA-XXXX-XXXX-XXXXXX-XXXX" style="font-family:monospace;font-size:0.78rem" />
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à§‡à¦° Supabase URL (optional)</label>
          <input id="cm-supurl" type="text" class="form-control" placeholder="https://xxxx.supabase.co" />
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Notes / à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦‡à¦œà§‡à¦¶à¦¨ à¦šà¦¾à¦¹à¦¿à¦¦à¦¾</label>
          <textarea id="cm-notes" class="form-control" rows="3" placeholder="à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦‡à¦œà§‡à¦¶à¦¨ à¦šà¦¾à¦¹à¦¿à¦¦à¦¾, payment history, à¦‡à¦¤à§à¦¯à¦¾à¦¦à¦¿â€¦" style="resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="_wfaClientSave()" style="flex:1;background:linear-gradient(135deg,rgba(0,217,255,0.8),rgba(123,47,247,0.8));border:none;color:#fff;padding:11px;border-radius:8px;font-weight:700;cursor:pointer">
            ðŸ’¾ Save Client
          </button>
          <button onclick="document.getElementById('cm-edit-id').value='';['cm-academy','cm-owner','cm-phone','cm-email','cm-lickey','cm-supurl','cm-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('cm-package').value='Basic';document.getElementById('cm-form-title').textContent='à¦¨à¦¤à§à¦¨ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¯à§‹à¦— à¦•à¦°à§à¦¨';"
            style="padding:11px 18px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;border-radius:8px;cursor:pointer;font-weight:600">
            âœ• Clear
          </button>
        </div>
      </div>
    </div>`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PUBLIC API
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return {
    deleteCustomTheme, openThemeBuilderModal, saveCustomThemeFromBuilder, _getAllThemes,
    _updateThemePreview, _applyThemeBuilderPreset, _THEME_PRESETS,
    render, openModal, closeModal, switchTab, toggleSettingsSidebar, getSnapshots, saveSnapshot, tryDailyAutoDownload, restoreSnapshot, downloadSnapshot, deleteSnapshot, clearAllSnapshots,
    saveAllChanges, saveAcademyInfo, changePassword, setTheme,
    saveRecoverySettings, saveCloudApiCredentials, saveSupabaseAuth, addSubAccount, deleteSubAccount,
    applyTheme,
    applySidebarStyle,
    openColorCustomizer, liveCustomSidebar, saveCustomSidebarColors, resetCustomSidebarColors,
    applyCardPreset,
    viewTableData, showLiveAccountSnapshot, showMonitorSnapshot, exportAllData,
    startMigration, importFromJSON, importFromJSONWithDate,
    clearLocalData, clearCloudData, factoryReset,
    addCategory, removeCategory, startRenameCategory, cancelRenameCategory, confirmRenameCategory, autoDetectCourses,
    clearActivityLog, logActivity, refreshActivityPanel, filterActivityLog, clearActivityFilters,
    restoreItem, permanentDelete, emptyRecycleBin,
    syncRecycleBin,
    addNote, saveNote, deleteNote, editNote, saveEditedNote, filterNotes, clearNoteFilters,
    renderBatchReport,
    printBatchReport,
    exportBatchReportExcel,
    showAccountsSubTab,
    addAdvancePayment, saveAdvancePayment, deleteAdvance,
    openReturnAdvanceModal, saveReturnAdvance, viewAdvanceLedger,
    addInvestment, saveInvestment, deleteInvestment,
    openReturnInvestmentModal, saveReturnInvestment, viewInvestmentLedger,
    addBalanceAdjustment, saveBalanceAdjustment, deleteBalanceAdjustment,
    openSettingsInternalModal, closeSettingsInternalModal,
    runAutoHeal, runSyncCheck, runAutoFix, runCloudPullDiag, runCloudPushDiag,
    rebuildMonitorData,
    refreshMonitor: () => { refreshModal(); Utils.toast('Refreshed', 'info'); },
    saveAIApiKey,
    saveAIBackupKeys,
    testAIApiKey,
    toggleAILocalOnly,
    refreshModal,
  };
})();

// â”€â”€ S2 Fix: Restore saved theme + sidebar + colors BEFORE exporting the module â”€â”€
// CSS injections (document.head.appendChild) must complete before any other page
// code accesses window.SettingsModule, to avoid dark/neon theme conflicts.
(function restoreThemeOnLoad() {
  const savedTheme = localStorage.getItem('wfa_theme') || 'neon-space';
  const allThemeIds = ['neon-space','aurora','nebula','neon-grid','molten','emerald','aurora-wave'];
  allThemeIds.forEach(id => document.body.classList.remove(`theme-${id}`));
  
  if (savedTheme.startsWith('custom_')) {
     const cust = JSON.parse(localStorage.getItem('wfa_custom_themes') || '[]');
     const t = cust.find(x => x.id === savedTheme);
     if(t) {
        document.body.classList.add('theme-custom');
        let styleTag = document.createElement('style');
        styleTag.id = 'custom-theme-style';
        styleTag.textContent = `
          body.theme-custom {
            --brand-primary: ${t.colors[1]};
            --brand-accent: ${t.colors[2]};
            --brand-neon: ${t.colors[3]};
            --bg-base: ${t.colors[0]};
            --bg-surface-solid: color-mix(in srgb, ${t.colors[0]} 80%, black);
            --bg-sidebar: color-mix(in srgb, ${t.colors[0]} 90%, black);
            --border: color-mix(in srgb, ${t.colors[1]} 20%, transparent);
            --border-glow: color-mix(in srgb, ${t.colors[1]} 40%, transparent);
            --border-focus: ${t.colors[1]};
            --shadow-neon: 0 0 20px color-mix(in srgb, ${t.colors[1]} 20%, transparent), 0 0 40px color-mix(in srgb, ${t.colors[2]} 10%, transparent);
            background-color: ${t.colors[0]};
            background: ${t.bg};
          }
        `;
        document.head.appendChild(styleTag);
     } else {
        document.body.classList.add('theme-neon-space');
     }
  } else {
     document.body.classList.add(`theme-${savedTheme}`);
  }

  const savedSidebar = localStorage.getItem(`wfa_sidebar_${savedTheme}`) || 'glass';
  const allSidebarStyles = ['glass','crystal','aurora-glow','tinted','carbon','neonstrip','velvet'];
  
  function _applySavedSidebarStyle() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      allSidebarStyles.forEach(s => sidebar.classList.remove(`sidebar-${s}`));
      sidebar.classList.add(`sidebar-${savedSidebar}`);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applySavedSidebarStyle);
  } else {
    _applySavedSidebarStyle();
  }

  // Inject colors immediately
  const sideSavedJSON = localStorage.getItem(`wfa_sidebar_custom_${savedTheme}_${savedSidebar}`);
  if(sideSavedJSON) {
      const s = Utils.safeJSON(sideSavedJSON);
      const styleTag = document.createElement('style');
      styleTag.id = 'custom-sidebar-overrides';
      styleTag.textContent = `
         #sidebar.sidebar-glass { background: rgba(8,12,35,${s.opacity/100}) !important; backdrop-filter: blur(${s.blur}px) !important; border-right-color: ${s.border} !important; }
         #sidebar.sidebar-crystal { background: rgba(0,5,20,${s.opacity/100}) !important; backdrop-filter: blur(${s.blur}px) !important; border-right-color: ${s.border} !important; }
         #sidebar.sidebar-aurora-glow { border-right-color: ${s.border} !important; }
         #sidebar.sidebar-tinted { background: color-mix(in srgb, var(--brand-primary) ${s.opacity}%, black) !important; backdrop-filter: blur(${s.blur}px) !important; border-right-color: ${s.border} !important; }
         #sidebar.sidebar-carbon { border-right-color: ${s.border} !important; }
         #sidebar.sidebar-neonstrip { background: rgba(7,9,24,${s.opacity/100}) !important; backdrop-filter: blur(${s.blur}px) !important; border-right-color: ${s.border} !important; }
         #sidebar.sidebar-velvet { border-right-color: ${s.border} !important; }
         /* Disabled to keep dynamic multicolored sidebar */
         #sidebar.sidebar-carbon .nav-item.active { background: color-mix(in srgb, ${s.active} 12%, transparent) !important;}
         #sidebar.sidebar-neonstrip .sidebar-logo::before { background: ${s.active} !important; box-shadow: 0 0 20px ${s.active} !important; }
      `;
      document.head.appendChild(styleTag);
  }
  
  const map = { 'neon-grid': 'maroon', 'nebula': 'purple', 'emerald': 'emerald', 'molten': 'obsidian', 'aurora-wave': 'navy' };
  const cardPresetId = localStorage.getItem(`wfa_card_theme_${savedTheme}`) || map[savedTheme] || 'navy';
  const CARD_PRESETS = [
    { id: 'navy',   name: 'ðŸŒ‘ Deep Navy',  cardBg: 'rgba(8,12,40,0.88)', border: 'rgba(0,217,255,0.15)', inner: 'rgba(6,9,28,0.96)', anaBg: 'rgba(5,8,26,0.92)' },
    { id: 'obsidian',name: 'ðŸŒŒ Obsidian',   cardBg: 'rgba(8,10,14,0.92)', border: 'rgba(0,243,255,0.15)', inner: 'rgba(5,6,8,0.96)', anaBg: 'rgba(6,8,10,0.95)' },
    { id: 'maroon', name: 'ðŸ”¥ Cyber Maroon',cardBg: 'rgba(24,5,10,0.88)', border: 'rgba(255,0,85,0.2)', inner: 'rgba(16,4,8,0.96)', anaBg: 'rgba(18,4,8,0.92)' },
    { id: 'purple', name: 'ðŸ’œ Royal Void', cardBg: 'rgba(16,8,32,0.90)', border: 'rgba(181,55,242,0.2)', inner: 'rgba(10,5,20,0.96)', anaBg: 'rgba(14,6,26,0.92)' },
    { id: 'emerald',name: 'ðŸŒ¿ Deep Jade',  cardBg: 'rgba(4,16,10,0.88)', border: 'rgba(0,255,136,0.15)', inner: 'rgba(2,10,6,0.96)', anaBg: 'rgba(3,12,8,0.92)' }
  ];
  const c = CARD_PRESETS.find(x => x.id === cardPresetId) || CARD_PRESETS[0];
  const styleTag = document.createElement('style');
  styleTag.id = 'custom-card-overrides';
  styleTag.textContent = `
     :root {
       --card-bg: ${c.cardBg} !important;
       --card-border: ${c.border} !important;
       --card-glow-inner: ${c.inner} !important;
       --analytics-bg: ${c.anaBg} !important;
       --bg-surface: ${c.cardBg} !important;
       --bg-surface-solid: ${c.inner} !important;
       --bg-card: ${c.cardBg} !important;
     }
     .card, .stat-card, .settings-card, .account-balance-card, .loan-person-card, .theme-card, .sidebar-style-card { 
       background-color: var(--card-bg) !important; 
       background-image: linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px) !important;
       background-size: 20px 20px !important;
       border-color: var(--card-border) !important; 
     }
     .modal-box, .settings-modal, .att-modal-container { 
       background-color: var(--card-glow-inner) !important; 
       background-image: linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px) !important;
       background-size: 20px 20px !important;
       border-color: var(--card-border) !important; 
     }
     .sub-tab-panel, .finance-tabs, .batch-controls, .data-table-container, .table-wrapper { 
       background-color: var(--analytics-bg) !important; 
       background-image: linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px) !important;
       background-size: 20px 20px !important;
     }
     .table-wrapper table th { background: rgba(0,0,0,0.6) !important; }
     .notice-item { background: rgba(0,0,0,0.3) !important; }
     .settings-sidebar, .card-title, .settings-modal-header, .modal-header, .table-wrapper th, .table-wrapper td { border-color: rgba(255,255,255,0.08) !important; }
     input, select, textarea { background: rgba(0,0,0,0.3) !important; border-color: rgba(255,255,255,0.12) !important; color: #fff !important; }
  `;
  document.head.appendChild(styleTag);

})();

// âœ… S-2 Fix: Export after theme CSS injections are complete (regression fix â€” export was accidentally removed)
window.SettingsModule = SettingsModule;

