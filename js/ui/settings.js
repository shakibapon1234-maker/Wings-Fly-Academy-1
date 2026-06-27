// ============================================================
// Wings Fly Aviation Academy — Settings Module (Full Parity)
// 11 Tabs matching legacy app design
// ============================================================

const SettingsModule = (() => {

  let activeTab = 'general';
  let isOpen = false;
  let _syncListener = null; // wfa:synced listener reference — closeModal-এ remove করার জন্য
  let _suppressSyncRebuild = false; // ✅ FIX: keep record save করার পরেই wfa:synced fire হয়, তখন modal rebuild রোখার জন্য
  let _syncRefreshTimer = null;    // ✅ FIX: debounced partial refresh — full modal rebuild UI hang করত

  // CSP-সেইফ: index.html script-src-attr ছাড়া inline onclick ব্লক হয় — delegation দিয়ে tab/close চালু
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
    _bindSettingsOverlayEvents(overlay);
    _persistHealedConfigDates();

    setTimeout(() => {
      if (typeof Utils !== 'undefined' && Utils.sanitizeDateInputElement) {
        overlay.querySelectorAll('input[type="date"], #bp-start, #bp-end').forEach(Utils.sanitizeDateInputElement);
      }
      _initSettingsDatePickers();
      // ✅ FIX: Inject branding logo panel on modal open (avoids stuck "লোডিং..." state)
      if (window.SettingsBranding) {
        window.SettingsBranding.inject();
      } else if (window.LazyModules) {
        window.LazyModules.ensure('settings-branding').then(() => {
          window.SettingsBranding && window.SettingsBranding.inject();
        });
      }
      if (window.SettingsInstitution) {
        window.SettingsInstitution.inject();
      } else if (window.LazyModules) {
        window.LazyModules.ensure('settings-institution').then(() => {
          window.SettingsInstitution && window.SettingsInstitution.inject();
        });
      }
    }, 10);
    
    document.body.style.overflow = 'hidden';
    // ── Real-time Activity Log refresh ────────────────────────────
    // Settings panel খোলা থাকলে যেকোনো কাজ করলে activity log ও
    // অন্যান্য tabs real-time-এ আপডেট হবে
    if (_syncListener) {
      window.removeEventListener('wfa:synced', _syncListener);
    }
    _syncListener = () => {
      const panel = document.getElementById('settings-overlay');
      if (!panel) return;

      // keeprecord: নোট save/delete-এ _refreshKeepRecordGrid() সরাসরি call হয়
      if (activeTab === 'keeprecord') return;
      if (_suppressSyncRebuild) return;

      // ✅ FIX: প্রতিটি realtime event-এ পুরো modal rebuild → main thread block → tab/close কাজ করে না
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
    // sync listener সরিয়ে দাও — modal বন্ধ হলে আর দরকার নেই
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

  // ─── RENDER (inline fallback for section) ─────────────────────
  function render() {
    openModal();
  }

  // ─── BUILD MODAL HTML ─────────────────────────────────────────
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
          <button type="button" class="settings-close-btn" aria-label="Close settings">✕</button>
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

  // ─── SIDEBAR TABS ─────────────────────────────────────────────
  function buildSidebarTabs() {
    const isAdm = (typeof App !== 'undefined' && App.isAdmin && App.isAdmin()) ||
                  (localStorage.getItem('wfa_user_role') === 'admin');

    const tabs = [
      { id: 'general',        icon: 'fa-sliders',             label: 'General Settings' },
      { id: 'institution',    icon: 'fa-building',            label: 'Institution Type' },
      { id: 'theme',          icon: 'fa-palette',             label: 'Theme / Appearance' },
      { id: 'categories',     icon: 'fa-tags',                label: 'Categories & Courses' },
      { id: 'data',           icon: 'fa-database',            label: 'Data Management' },
      { id: 'security',       icon: 'fa-lock',                label: 'Security & Access' },
      // ✅ Fix: Client Manager is admin-only content (panelClientManager renders
      // empty for non-admins) — hide the tab itself instead of leaving a dead entry.
      { id: 'client-manager', icon: 'fa-id-card',             label: 'Client Manager', adminOnly: true, superAdminOnly: true },
      { id: 'activity',       icon: 'fa-list-check',          label: 'Activity Log' },
      { id: 'recycle',        icon: 'fa-trash-can',           label: 'Recycle Bin' },
      { id: 'sync',           icon: 'fa-magnifying-glass',    label: 'Sync Diagnostic' },
      { id: 'keeprecord',     icon: 'fa-flag',                label: 'Keep Record' },
      { id: 'batchprofit',    icon: 'fa-chart-column',        label: 'Batch Profit Report' },
      { id: 'accounts-mgmt',  icon: 'fa-briefcase',           label: 'Accounts Management' },
      { id: 'monitor',        icon: 'fa-chart-line',          label: 'Monitor' },
      { id: 'syncguard',      icon: 'fa-shield-halved',       label: 'Sync Guard' },
      { id: 'ai-assistant',   icon: 'fa-robot',               label: 'AI Assistant' },
      { id: 'student-portal', icon: 'fa-graduation-cap',      label: 'Student Portal' },
      { id: 'sms-settings',   icon: 'fa-comment-sms',         label: 'SMS Notifications' },
    ];
    const isClientDeployment = window.WFA_SUPABASE_SECRETS && window.WFA_SUPABASE_SECRETS.customerCode;
    return tabs
      .filter(t => !t.adminOnly || isAdm)
      .filter(t => !t.superAdminOnly || !isClientDeployment)
      .map(t => `
      <button type="button" class="settings-tab ${activeTab === t.id ? 'active' : ''}"
              data-tab="${t.id}">
        <i class="fa ${t.icon}"></i> ${t.label}
      </button>
    `).join('');
  }

  // ─── ALL PANELS ───────────────────────────────────────────────
  function buildAllPanels() {
    return `
      ${panelGeneral()}
      ${panelInstitution()}
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
      ${panelStudentPortal()}
      ${panelSMSSettings()}
    `;
  }

  // ─── TAB SWITCH ───────────────────────────────────────────────
  function switchTab(tab) {
    activeTab = tab;
    const overlay = document.getElementById('settings-overlay');
    const scope = overlay || document;
    // Update sidebar (scope to settings modal — অন্য .settings-tab থাকলে clash এড়ায়)
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
    // Student Portal tab — render student list
    if (tab === 'student-portal') {
      setTimeout(() => _spRenderStudentList(), 80);
    }
    // SMS Settings tab — refresh log
    if (tab === 'sms-settings') {
      setTimeout(() => window._smsRefreshLog && window._smsRefreshLog(), 80);
    }
    if (tab === 'institution') {
      setTimeout(() => {
        if (window.SettingsInstitution) {
          window.SettingsInstitution.inject();
        } else if (window.LazyModules) {
          window.LazyModules.ensure('settings-institution').then(() => {
            window.SettingsInstitution && window.SettingsInstitution.inject();
          });
        }
      }, 50);
    }
    // ✅ Req 4: re-init date pickers whenever a tab is switched
    setTimeout(_initSettingsDatePickers, 20);
  }

  // ✅ FIX: sync-এ শুধু active tab-এর ডেটা আপডেট — পুরো modal rebuild নয়
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

  // ════════════════════════════════════════════════════════════════
  // TAB: THEME / APPEARANCE
  // ════════════════════════════════════════════════════════════════
  const THEMES = [
    {
      id: 'neon-space',
      name: 'Default Theme (Neon)',
      desc: 'Deep navy + Cyan + Purple — Default app cyberpunk theme',
      emoji: '🚀',
      colors: ['#0a0e27', '#00d9ff', '#b537f2', '#00ff88'],
      bg: 'linear-gradient(135deg, #0a0e27 0%, #0f0a28 100%)',
    },
    {
      id: 'aurora',
      name: 'Deep Ocean Aurora',
      desc: 'Deep navy + flowing aurora teal & electric blue',
      emoji: '🌊',
      colors: ['#050d1e', '#00e5ff', '#00b4d8', '#48cae4'],
      bg: 'linear-gradient(135deg, #050d1e 0%, #0a192f 50%, #072a4a 100%)',
    },
    {
      id: 'nebula',
      name: 'Nebula Purple Haze',
      desc: 'Dark cosmic black + swirling galaxy purple & magenta',
      emoji: '🌌',
      colors: ['#0d0010', '#c77dff', '#e040fb', '#7b2d8b'],
      bg: 'linear-gradient(135deg, #0d0010 0%, #1a0030 50%, #0d0020 100%)',
    },
    {
      id: 'neon-grid',
      name: 'Neon City Grid',
      desc: 'Midnight black + electric green + hot pink cyberpunk',
      emoji: '⚡',
      colors: ['#080808', '#39ff14', '#ff006e', '#00f5d4'],
      bg: 'linear-gradient(135deg, #080808 0%, #0d1117 100%)',
    },
    {
      id: 'molten',
      name: 'Molten Gold & Obsidian',
      desc: 'Volcanic black + glowing gold veins — Luxury premium',
      emoji: '🔥',
      colors: ['#0a0800', '#ffd700', '#ff6b00', '#ff9900'],
      bg: 'linear-gradient(135deg, #0a0800 0%, #1a1000 50%, #0d0900 100%)',
    },
    {
      id: 'emerald',
      name: 'Quantum Emerald',
      desc: 'Forest black + bioluminescent emerald circuit glow',
      emoji: '💚',
      colors: ['#030d06', '#00ff88', '#00e676', '#69f0ae'],
      bg: 'linear-gradient(135deg, #030d06 0%, #071a0a 50%, #030d06 100%)',
    },
    {
      id: 'aurora-wave',
      name: 'Aurora Wave',
      desc: 'Northern lights — animated color waves on dark starry sky',
      emoji: '🌌',
      colors: ['#050510', '#00f0ff', '#0077b6', '#00e5cc'],
      bg: 'linear-gradient(135deg, #050510 0%, #07091a 50%, #0a1030 100%)',
    },
  ];

  const SIDEBAR_STYLES = [
    {
      id: 'glass',
      name: 'Frosted Glass',
      icon: '🧊',
      desc: 'Master style — Semi-transparent blur, background glows through',
      preview: 'background:rgba(10,14,39,0.42);border-right:1px solid rgba(255,255,255,0.13)',
      master: true,
    },
    {
      id: 'aurora-glow',
      name: 'Aurora Wave Match',
      icon: '🌌',
      desc: 'Matches exactly the cyan Dashboard theme background gradient',
      preview: 'background:linear-gradient(135deg, #050510, #0077b6); border-right:1px solid #00f0ff',
    },
    {
      id: 'crystal',
      name: 'Ultra Crystal (Aurora)',
      icon: '✨',
      desc: 'Maximum transparency — Best for Aurora & Background images',
      preview: 'background:rgba(0,0,10,0.15); border-right:1px solid rgba(255,255,255,0.1)',
    },
    {
      id: 'tinted',
      name: 'Tinted Glow',
      icon: '🌊',
      desc: 'Theme-color tinted glass — subtle accent wash',
      preview: 'background:rgba(0,25,50,0.6);border-right:1px solid rgba(0,217,255,0.3)',
    },
    {
      id: 'carbon',
      name: 'Carbon Dark',
      icon: '⬛',
      desc: 'Pure matte black — maximum contrast, ultra bold',
      preview: 'background:#050507;border-right:1px solid rgba(255,255,255,0.06)',
    },
    {
      id: 'neonstrip',
      name: 'Neon Strip',
      icon: '📌',
      desc: 'Dark glass + glowing top neon strip accent',
      preview: 'background:rgba(8,10,25,0.88);border-top:2px solid rgba(0,217,255,0.8)',
    },
    {
      id: 'velvet',
      name: 'Velvet Deep',
      icon: '🟣',
      desc: 'Rich deep purple-navy matte — premium luxury feel',
      preview: 'background:linear-gradient(180deg,rgba(14,8,35,0.98) 0%,rgba(8,5,22,0.98) 100%)',
    },
  ];

  function panelTheme() {
    const currentTheme   = localStorage.getItem('wfa_theme') || 'neon-space';
    const currentSidebar = localStorage.getItem(`wfa_sidebar_${currentTheme}`) || 'glass';

    return `
    <div class="settings-panel ${activeTab === 'theme' ? 'active' : ''}" data-panel="theme">

      <!-- ── Background Theme ── -->
      <div class="settings-card-title" style="color:var(--brand-primary);font-size:1.05rem;margin-bottom:6px">
        <i class="fa fa-image"></i> BACKGROUND THEME
      </div>
      <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
        Click করুন — সাথে সাথে apply হবে। প্রতিটি থিমে আলাদা সাইডবার সেটিং সেভ থাকবে।
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

      <!-- ── Sidebar / Menu Bar Style ── -->
      <div class="settings-card-title" style="color:var(--brand-accent);font-size:1.05rem;margin-bottom:6px">
        <i class="fa fa-sidebar"></i> SIDEBAR / MENU BAR STYLE
      </div>
      <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
        এই থিমের জন্য সাইডবার ডিজাইন বেছে নিন। প্রতিটি থিমে আলাদা সেটিং সেভ হবে।
        <span style="color:var(--brand-primary);font-weight:600">
          (বর্তমান থিম: <i class="fa fa-circle" style="font-size:.6rem"></i> ${_getAllThemes().find(t=>t.id===currentTheme)?.emoji} ${_getAllThemes().find(t=>t.id===currentTheme)?.name})
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
              ${currentSidebar === s.id ? `<div style="position:absolute;top:6px;right:6px;background:var(--brand-primary);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:.55rem">✓</div>` : ''}
            </div>
            <div class="sidebar-style-info">
              <div class="sidebar-style-name">${s.icon} ${s.name} ${s.master ? '<span style="font-size:.6rem;background:rgba(0,217,255,0.2);color:#00d9ff;padding:1px 6px;border-radius:10px;margin-left:4px">MASTER</span>' : ''}</div>
              <div class="sidebar-style-desc">${s.desc}</div>
              <button class="customize-btn" onclick="event.stopPropagation();SettingsModule.openColorCustomizer('${s.id}')"
                style="margin-top:6px;padding:3px 10px;font-size:.68rem;border:1px solid rgba(0,217,255,0.3);background:rgba(0,217,255,0.08);color:#00d9ff;border-radius:6px;cursor:pointer;transition:.2s">
                ⚙️ Customize Colors
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- ── Color Customizer Panel ── -->
      <div id="color-customizer-panel" style="display:none;margin-top:24px">
        ${buildColorCustomizerHTML(currentTheme, currentSidebar)}
      </div>

      <!-- ── Dashboard Card Colors ── -->
      <div style="margin-top:28px">
        <div class="settings-card-title" style="color:var(--brand-gold);font-size:1.05rem;margin-bottom:6px">
          <i class="fa fa-layer-group"></i> DASHBOARD CARD & ANALYTICS COLORS
        </div>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
          Dashboard cards এবং Analytics section এর background color customize করুন।
          <span style="color:var(--brand-primary);font-weight:600">প্রতিটি থিমে আলাদা সেভ হবে।</span>
        </p>
        ${buildCardColorsHTML(currentTheme)}
      </div>

      <!-- ── Custom Theme Builder ── -->
      <div style="margin-top:28px;padding-top:28px;border-top:1px solid rgba(255,255,255,0.08)">
        <div class="settings-card-title" style="color:var(--brand-primary);font-size:1.05rem;margin-bottom:6px">
          <i class="fa fa-paint-roller"></i> CUSTOM THEME BUILDER
        </div>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:16px">
          নিজের পছন্দমতো কালার দিয়ে থিম তৈরি করুন। সর্বোচ্চ ৫টি থিম সেভ রাখতে পারবেন।
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
          ⚙️ Sidebar Custom Colors — <span style="color:rgba(255,255,255,0.5);font-weight:400;font-size:.8rem">changes apply live</span>
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
          <button onclick="SettingsModule.saveCustomSidebarColors()" class="btn btn-primary btn-sm">💾 Save Colors</button>
          <button onclick="SettingsModule.resetCustomSidebarColors()" class="btn btn-outline btn-sm" style="color:var(--error);border-color:var(--error)">↺ Reset</button>
        </div>
      </div>`;
  }

  const CARD_PRESETS = [
    { id: 'navy',   name: '🌑 Deep Navy',  cardBg: 'rgba(8,12,40,0.88)', border: 'rgba(0,217,255,0.15)', inner: 'rgba(6,9,28,0.96)', anaBg: 'rgba(5,8,26,0.92)' },
    { id: 'obsidian',name: '🌌 Obsidian',   cardBg: 'rgba(8,10,14,0.92)', border: 'rgba(0,243,255,0.15)', inner: 'rgba(5,6,8,0.96)', anaBg: 'rgba(6,8,10,0.95)' },
    { id: 'maroon', name: '🔥 Cyber Maroon',cardBg: 'rgba(24,5,10,0.88)', border: 'rgba(255,0,85,0.2)', inner: 'rgba(16,4,8,0.96)', anaBg: 'rgba(18,4,8,0.92)' },
    { id: 'purple', name: '💜 Royal Void', cardBg: 'rgba(16,8,32,0.90)', border: 'rgba(181,55,242,0.2)', inner: 'rgba(10,5,20,0.96)', anaBg: 'rgba(14,6,26,0.92)' },
    { id: 'emerald',name: '🌿 Deep Jade',  cardBg: 'rgba(4,16,10,0.88)', border: 'rgba(0,255,136,0.15)', inner: 'rgba(2,10,6,0.96)', anaBg: 'rgba(3,12,8,0.92)' },
    { id: 'glass',  name: '🧊 Aurora Glass', cardBg: 'rgba(5,10,25,0.30)', border: 'rgba(0,240,255,0.25)', inner: 'rgba(4,6,18,0.45)', anaBg: 'rgba(2,4,12,0.35)' }
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
        👆 কার্ডের ব্যাকগ্রাউন্ড কালার সিলেক্ট করুন (এটি সাথে সাথে সেভ হয়ে যাবে)।
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
    Utils.toast(`✨ Theme: ${theme.name}`, 'success');
  }

  function applySidebarStyle(styleId) {
    const themeId = localStorage.getItem('wfa_theme') || 'neon-space';
    localStorage.setItem(`wfa_sidebar_${themeId}`, styleId);
    _applySidebarClass(styleId);
    // Refresh only the sidebar style section
    refreshModal();
    switchTab('theme');
    const style = SIDEBAR_STYLES.find(s => s.id === styleId);
    Utils.toast(`🎨 Sidebar: ${style?.name || styleId}`, 'info');
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

  // ── Color Customizer Logic ──

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

  // ── Inject globally custom style block ──
  
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







  // ════════════════════════════════════════════════════════════════
  // TAB 1: GENERAL SETTINGS
  // ════════════════════════════════════════════════════════════════

  function panelInstitution() {
    return `
    <div class="settings-panel ${activeTab === 'institution' ? 'active' : ''}" data-panel="institution">
      <div id="settings-institution-panel">
        <span style="color:#7a8baa;font-size:0.82rem"><i class="fa fa-rotate fa-spin"></i> লোডিং...</span>
      </div>
    </div>`;
  }

  function panelGeneral() {
    const cfg = getConfig();
    const students = SupabaseSync.getAll(DB.students);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();
    // ✅ FIX: Use local timezone date (not UTC) — Bangladesh is UTC+6
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    // ✅ FIX: Don't default to today — empty means "show all expenses"
    // ✅ SANITIZE: if the stored value is not a valid date (e.g. "admin"), clear it
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
        <div class="form-group mb-12">
          <label class="settings-label">ACADEMY LOGO</label>
          <small class="settings-sublabel">Sidebar, Login পেজ ও PDF রিপোর্টে দেখাবে। সর্বোচ্চ 500KB।</small>
          <div id="settings-branding-logo-panel" style="margin-top:10px">
            <span style="color:#7a8baa;font-size:0.82rem"><i class="fa fa-rotate fa-spin"></i> লোডিং...</span>
          </div>
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
          <small class="settings-sublabel">শুধু Start Date সেট করুন। End Date সবসময় আজকের তারিখ পর্যন্ত অটো-আপডেট হবে।</small>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">From (শুরু)</label>
              <input id="set-expense-start" type="date" class="form-control" value="${expStart}" />
            </div>
            <div class="form-group" style="flex:1;min-width:160px">
              <label style="font-size:.78rem;color:var(--text-muted)">To (আজ পর্যন্ত) <span class="auto-badge">AUTO</span></label>
              <div class="form-control" style="color:var(--success);display:flex;align-items:center;gap:6px;cursor:default;opacity:.75">
                <i class="fa fa-calendar-check" style="font-size:.8rem"></i>
                ${Utils.formatDateDMY(expEnd)}
              </div>
            </div>
          </div>
          <div style="margin-top:8px;padding:10px 14px;background:var(--bg-base);border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
            <i class="fa fa-info-circle" style="color:var(--brand-primary)"></i>
            Start Date সেট করলে সেই তারিখ থেকে আজ পর্যন্ত expense দেখাবে। Start Date খালি রাখলে সব expense দেখাবে।
          </div>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-language"></i> Language Settings (ভাষা সেটিংস)</div>
        <div class="form-group mb-12">
          <label class="settings-label">APP LANGUAGE</label>
          <small class="settings-sublabel">Select the primary language for the application interface (অ্যাপের ভাষা নির্ধারণ করুন)।</small>
          <select id="set-language" class="form-control" style="max-width:500px">
            <option value="default" ${cfg.language === 'default' || !cfg.language ? 'selected' : ''}>Default (বাই ডিফল্ট)</option>
            <option value="en" ${cfg.language === 'en' ? 'selected' : ''}>English (ইংলিশ)</option>
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

  // ════════════════════════════════════════════════════════════════
  // TAB 2: CATEGORIES & COURSES
  // ════════════════════════════════════════════════════════════════

  // ── Silent auto-detect: merges student course names into cfg without UI interruption ──
  function _silentAutoDetect() {
    try {
      const cfg      = getConfig();
      const existing = Utils.parseJsonArray(cfg.courses, []);
      if (typeof cfg.courses === 'string' && cfg.courses.trim() && !cfg.courses.trim().startsWith('[')) {
        cfg.courses = JSON.stringify(existing);
        saveConfig(cfg);
      }
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

  // ── Listen for Supabase pull events → re-run auto-detect silently ──
  (function _initSettingsSyncListener() {
    window.addEventListener('wfa:synced', (e) => {
      if (e.detail?.direction === 'pull' || e.detail?.direction === 'realtime') {
        _silentAutoDetect();
        // Settings modal খোলা থাকলে merge skip — saveConfig/rebuild loop ও UI hang এড়ায়
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
                <button class="cat-rename" title="Rename" onclick="SettingsModule.startRenameCategory('${key}','${item.replace(/'/g, "\\'")}')">✏️</button>
                <button class="cat-delete" title="Delete" onclick="SettingsModule.removeCategory('${key}','${item.replace(/'/g, "\\'")}')">✕</button>
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
            title="Existing students থেকে সব course নাম এনে list-এ যোগ করুন">
            🔍 Auto-detect
          </button>
        </div>
        <div class="category-add-row">
          <input id="cat-add-${key}" class="form-control" placeholder="Add new course..." />
          <button class="category-add-btn ${colorClass}" onclick="SettingsModule.addCategory('${key}')">+ ADD</button>
        </div>
        <div class="category-list" id="cat-list-${key}">
          ${items.length === 0 ? `<div style="color:var(--text-muted);font-size:0.82rem;padding:10px 4px;">কোনো course নেই। "+ ADD" বা "🔍 Auto-detect" ব্যবহার করুন।</div>` : ''}
          ${items.map(item => `
            <div class="category-item" id="cat-item-${key}-${item.replace(/[^a-z0-9]/gi,'_')}">
              <span class="cat-item-label">${item}</span>
              <div class="cat-item-actions">
                <button class="cat-rename" title="Rename" onclick="SettingsModule.startRenameCategory('${key}','${item.replace(/'/g, "\\'")}')">✏️</button>
                <button class="cat-delete" title="Delete" onclick="SettingsModule.removeCategory('${key}','${item.replace(/'/g, "\\'")}')">✕</button>
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

    // সব students থেকে unique course নাম বের করো
    const allStudents  = SupabaseSync.getAll(DB.students) || [];
    const fromStudents = [...new Set(allStudents.map(s => s.course).filter(Boolean))];

    // যেগুলো already list-এ নেই সেগুলোই যোগ হবে
    const toAdd = fromStudents.filter(c => !existing.includes(c));

    if (toAdd.length === 0) {
      Utils.toast('সব course ইতিমধ্যে list-এ আছে!', 'info');
      return;
    }

    const merged = [...existing, ...toAdd];
    cfg.courses = JSON.stringify(merged);
    saveConfig(cfg);
    logActivity('edit', 'settings', `Auto-detected ${toAdd.length} course(s): ${toAdd.join(', ')}`);
    Utils.toast(`✅ ${toAdd.length}টি course যোগ হয়েছে: ${toAdd.join(', ')}`, 'success');
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
    logActivity('add', 'category', `ক্যাটাগরি যোগ: "${newItem}" — ${key}`);
  }

  function removeCategory(key, item) {
    // ✅ Req 2: Push to recycle_bin (restorable) instead of Keep Record
    const recycleBin = (typeof SupabaseSync !== 'undefined') ? (SupabaseSync.getAll('recycle_bin') || []) : [];
    recycleBin.unshift({
      id:        SupabaseSync.generateId(),
      table:     'settings_category',
      tableLabel: `Settings → ${key}`,
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
    Utils.toast(`"${item}" deleted → Recycle Bin-এ আছে। Restore করতে Recycle Bin দেখুন। 🗑️`, 'info');
    logActivity('delete', 'category', `ক্যাটাগরি মুছে ফেলা: "${item}" — ${key}`);
  }

  // ════════════════════════════════════════════════════════════════
  // RENAME CATEGORY — inline edit with student/staff auto-update
  // ════════════════════════════════════════════════════════════════
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
      <button class="cat-rename-save" title="Save" onclick="SettingsModule.confirmRenameCategory('${key}','${oldName.replace(/'/g, "\\'")}')">✔</button>
      <button class="cat-rename-cancel" title="Cancel" onclick="SettingsModule.cancelRenameCategory()">✕</button>
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
    // Read from global tracker — reliable across all browsers/click events
    const newName = (window._wfaRename && window._wfaRename.val
      ? window._wfaRename.val
      : (document.querySelector('.cat-rename-input') || {}).value || ''
    ).trim();

    window._wfaRename = null;

    if (!newName) {
      Utils.toast('নাম খালি রাখা যাবে না!', 'error');
      refreshModal();
      return;
    }
    if (newName === oldName) {
      refreshModal();
      return;
    }

    // ── 1. Settings list আপডেট করো ──────────────────────────────
    const cfg   = getConfig();
    const items = cfg[key] ? (Utils.safeJSON(cfg[key]) || []) : [];
    if (items.includes(newName)) {
      Utils.toast(`"${newName}" ইতিমধ্যে আছে!`, 'error');
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

    // ── 2. যদি course rename হয় → সব Students আপডেট করো ────────
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

    // ── 3. যদি employee_roles rename হয় → সব Staff আপডেট করো ──
    if (key === 'employee_roles') {
      const allStaff = SupabaseSync.getAll(DB.staff) || [];
      allStaff.forEach(st => {
        if (st.role === oldName) {
          SupabaseSync.update(DB.staff, st.id, { ...st, role: newName });
          updatedCount++;
        }
      });
    }

    // ── 4. Activity log ────────────────────────────────────────────
    logActivity('edit', 'category', `ক্যাটাগরি নাম পরিবর্তন: "${oldName}" → "${newName}" (${key})${updatedCount > 0 ? ` — ${updatedCount}টি রেকর্ড আপডেট` : ''}`);

    // ── 5. Toast & refresh ───────────────────────────────────────
    const msg = updatedCount > 0
      ? `✅ "${oldName}" → "${newName}" — ${updatedCount}টি রেকর্ড আপডেট হয়েছে!`
      : `✅ "${oldName}" → "${newName}" renamed!`;
    Utils.toast(msg, 'success');
    refreshModal();
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 3: DATA MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  function panelData() {
    return `
    <div class="settings-panel ${activeTab === 'data' ? 'active' : ''}" data-panel="data">
      <!-- ── Storage Usage Indicator (Enhanced) ───────────────────── -->
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
            const limitKB = 512000; // IndexedDB — ~500 MB
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
                '<span style="color:' + color + ';font-size:.78rem">' + status + ' — ' + pct + '% of ~500 MB</span>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.06);border-radius:8px;height:12px;overflow:hidden;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08)">' +
                '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',' + color + '88);border-radius:8px;transition:width .4s ease"></div>' +
              '</div>' +
              (pct >= 70 ? '<div style="background:rgba(255,165,0,0.09);border:1px solid rgba(255,165,0,0.25);border-radius:6px;padding:8px 12px;font-size:.80rem;color:#ffa502;margin-bottom:10px"><i class="fa fa-triangle-exclamation"></i> ' +
                (pct >= 90 ? '<strong>Critical!</strong> Storage ' + pct + '% পূর্ণ। পুরনো data Supabase-এ safe আছে।' :
                             'Storage ' + pct + '% পূর্ণ। শীঘ্রই পুরনো data archive করুন।') +
              '</div>' : '') +
              '<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;letter-spacing:.5px">TABLE BREAKDOWN</div>' +
              (tableRows || '<div style="color:var(--text-muted);font-size:.78rem">Data এখনো যোগ হয়নি।</div>');
          } catch(e) {
            var el = document.getElementById('storage-usage-content');
            if (el) el.textContent = 'Storage info দেখা যাচ্ছে না।';
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
              b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-down&quot;></i> FULL SYNC (সব data)';
              r.style.display='block';
              if(res && res.ok){ r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88'; r.innerHTML='✅ Full Sync সফল! সব ডেটা Cloud থেকে নামানো হয়েছে।'; Utils.toast('Full Sync সফল ✅','success'); }
              else { r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);color:#ffa502'; r.innerHTML='⚠️ Sync আংশিক সম্পন্ন। Supabase credentials চেক করুন।'; Utils.toast('Sync — কিছু সমস্যা হয়েছে','warn'); }
            }).catch(err=>{ b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-down&quot;></i> FULL SYNC (সব data)'; r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.3);color:#ff4757'; r.textContent='❌ Sync ব্যর্থ: '+(err.message||''); Utils.toast('Sync ব্যর্থ','error'); });
          ">
            <i class="fa fa-cloud-arrow-down"></i> FULL SYNC (সব data)
          </button>
          <button id="btn-push-cloud-dm" class="settings-btn-lg btn-sync-cloud" style="flex:1;background:rgba(0,255,136,0.08);border-color:rgba(0,255,136,0.3);color:#00ff88" onclick="
            const b=document.getElementById('btn-push-cloud-dm');
            const r=document.getElementById('dm-sync-result');
            b.disabled=true; b.innerHTML='<i class=&quot;fa fa-spinner fa-spin&quot;></i> Pushing...';
            r.style.display='none';
            SyncEngine.push({ silent:true, forcePush:true }).then(res=>{
              b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-up&quot;></i> PUSH → CLOUD';
              const sc=res?.successCount||0; const errs=res?.errors||[];
              if(res && res.ok){ r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88'; r.innerHTML='✅ Push সফল! '+sc+' টেবিল Supabase-এ আপলোড হয়েছে।'; Utils.toast('Push সফল ✅ '+sc+' টেবিল আপলোড','success'); }
              else { r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);color:#ffa502'; r.innerHTML='⚠️ আংশিক Push: '+sc+' সফল, '+errs.length+' সমস্যা। Security & Access-এ credentials চেক করুন।'; Utils.toast('Push — কিছু সমস্যা','warn'); }
            }).catch(err=>{ b.disabled=false; b.innerHTML='<i class=&quot;fa fa-cloud-arrow-up&quot;></i> PUSH → CLOUD'; r.style.cssText='display:block;padding:10px 14px;border-radius:8px;font-size:.85rem;font-weight:600;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.3);color:#ff4757'; r.textContent='❌ Push ব্যর্থ: '+(err.message||''); Utils.toast('Push ব্যর্থ','error'); });
          ">
            <i class="fa fa-cloud-arrow-up"></i> PUSH → CLOUD
          </button>
        </div>
        <small style="display:block;text-align:center;margin-top:6px;color:var(--text-muted);font-size:.78rem">
          Full Sync = Supabase থেকে সব data নামায় | Auto incremental sync চলে প্রতি ৩০ সে.
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
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.importFromJSONWithDate()">📅 Import with Date</button>
        </div>
      </div>
      <div class="settings-card glow-cyan" style="margin-top:12px">
        <div class="settings-card-title"><i class="fa fa-wrench"></i> Finance Ledger Repair</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          Student যোগ করার সময় <strong style="color:#00ff88">Paid</strong> amount save হয়েছে কিন্তু
          Finance Ledger / Account Balance <strong style="color:#ff4757">০</strong> দেখাচ্ছে?<br/>
          এই বাটন missing finance entries তৈরি করবে এবং Cash account balance আপডেট করবে।
        </p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm"
                  style="background:linear-gradient(90deg,#00ff88,#00d9ff);border:none;padding:10px 20px;font-weight:800;"
                  onclick="if(typeof Students!=='undefined')Students.repairMissingFinanceEntries();else if(typeof SupabaseSync!=='undefined'&&SupabaseSync.repairMissingStudentFinance)SupabaseSync.repairMissingStudentFinance();else Utils.toast('Students module not loaded','error')">
            <i class="fa fa-wrench"></i> Repair Missing Finance Entries
          </button>
        </div>
      </div>
      <div class="settings-card glow-cyan" style="margin-top:12px">
        <div class="settings-card-title"><i class="fa fa-scale-balanced"></i> Fee Reconciliation</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          যদি কোনো Student-এর <strong style="color:#00ff88">Paid</strong> বা <strong style="color:#ff4757">Due</strong>
          amount Finance Ledger-এর সাথে মিলছে না — এই বাটনটি সব ঠিক করে দেবে।<br/>
          <span style="font-size:.78rem;color:var(--text-muted);">⚠️ শুধু mismatch fix করে — কোনো payment delete বা add করে না।</span>
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

  // ════════════════════════════════════════════════════════════════
  // TAB 4: SECURITY & ACCESS
  // ════════════════════════════════════════════════════════════════
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
        <button class="btn btn-accent" onclick="SettingsModule.changePassword()">🔑 Change Password</button>
      </div>

      <!-- Supabase Project API (URL + anon key) -->
      <div class="settings-card" style="margin-top:16px; border: 1px solid rgba(0,212,255,0.15)">
        <div style="font-weight:700; font-size:1.05rem; color:#fff; margin-bottom:12px">☁️ Cloud API (Project URL &amp; Anon Key)</div>
        <div style="font-size:0.8rem; color:#aaa; margin-bottom:12px; line-height:1.5">
          Stored encrypted on this device. Use Supabase Dashboard → Settings → API, or copy from <code style="background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:4px">supabase-secrets.example.js</code>.
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
        <button class="btn btn-accent" onclick="SettingsModule.saveCloudApiCredentials()">💾 Save API Credentials</button>
      </div>

      <!-- Supabase Cloud Auth -->
      <div class="settings-card" style="margin-top:16px; border: 1px solid rgba(0,212,255,0.2)">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="document.getElementById('supabase-auth-body').classList.toggle('hidden'); const i=this.querySelector('i.fa-caret-down,i.fa-caret-up'); if(i.classList.contains('fa-caret-down')){i.classList.replace('fa-caret-down','fa-caret-up')}else{i.classList.replace('fa-caret-up','fa-caret-down')}">
          <div style="display:flex; gap:12px; align-items:center">
            <div style="width:40px; height:40px; border-radius:8px; background:rgba(0,212,255,0.08); display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:1px solid rgba(0,212,255,0.2)">
              <i class="fa fa-cloud-arrow-up" style="color:#00d4ff"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:#fff">🔐 Supabase Cloud Login</div>
              <div style="font-size:0.8rem; color:#00d4ff">Secure sync-এর জন্য Supabase account credentials</div>
            </div>
          </div>
          <i class="fa fa-caret-down" style="color:#00d4ff"></i>
        </div>
        <div id="supabase-auth-body" class="hidden" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px">
          <div style="background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:.82rem; color:#aaa; line-height:1.6">
            <strong style="color:#00d4ff">সেটআপ গাইড:</strong><br>
            ১. Supabase Dashboard → Authentication → Users → Add user করুন<br>
            ২. সেই email ও password এখানে সংরক্ষণ করুন<br>
            ৩. <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px">supabase/rls_policies_secure.sql</code> SQL Editor-এ run করুন<br>
            ৪. পরবর্তী login থেকে RLS-secure sync চালু হবে ✅
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
              ${cfg.supabase_email ? '✅ Configured: ' + cfg.supabase_email : '⚠️ Not configured — running in open-access mode'}
            </span>
            <button class="btn btn-accent" onclick="SettingsModule.saveSupabaseAuth()">💾 Save & Connect</button>
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
                  <div style="font-size:0.8rem; color:var(--brand-primary)">পাসওয়ার্ড ভুলে গেলে এই প্রশ্ন দিয়ে reset করতে পারবেন</div>
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
                  💾 Save Security Settings
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
                  <div style="font-size:0.8rem; color:#00ff88">ক্যামেরা ব্যবহার করে দ্রুত লগইন করুন</div>
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
                  <div style="font-size:0.8rem; color:#00d4ff">ডট মিলিয়ে সিক্রেট প্যাটার্ন তৈরি করুন</div>
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
                  <div style="font-size:0.8rem; color:var(--brand-cyan)">সীমিত এক্সেস সম্পন্ন সাব আইডি তৈরি করুন</div>
               </div>
            </div>
            <i class="fa fa-caret-up" style="color:var(--brand-cyan)"></i>
         </div>

         <div id="sub-account-body" style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px">
            
            <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; text-align:center; color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; min-height:50px">
               ${subs.length === 0 ? 'কোনো সাব আইডি নেই' : buildSubAccountsList(subs)}
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
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-students" checked class="custom-chk"> <span>🎓 Students</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-attendance" class="custom-chk"> <span>📋 Attendance</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-finance" class="custom-chk"> <span>💰 Finance/Ledger</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-accounts" class="custom-chk"> <span>📊 Accounts</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-loans" class="custom-chk"> <span>💳 Loans</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-exams" class="custom-chk"> <span>📝 Exams</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-hr" class="custom-chk"> <span>👥 HR / Staff</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-salary" class="custom-chk"> <span>💵 Salary Hub</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-visitors" class="custom-chk"> <span>👤 Visitors</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-idcards" class="custom-chk"> <span>🪪 ID Cards</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-certificates" class="custom-chk"> <span>🏆 Certificates</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-noticeboard" class="custom-chk"> <span>📢 Notice Board</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-settings" class="custom-chk"> <span>⚙️ Settings</span></label>
            </div>

         </div>
      </div>
      
      <style> .hidden { display: none !important; } </style>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 5: ACTIVITY LOG
  // ════════════════════════════════════════════════════════════════
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
            onclick="if(typeof SupabaseSync!=='undefined'&&SupabaseSync.pullActivityLog){this.innerHTML='<i class=&quot;fa fa-rotate fa-spin&quot;></i> Syncing…';const me=this;SupabaseSync.pullActivityLog().then(()=>{SettingsModule.refreshActivityPanel();me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';Utils.toast('Activity log synced ✅','success');}).catch(()=>{me.innerHTML='<i class=&quot;fa fa-rotate&quot;></i> SYNC';})}">
            <i class="fa fa-rotate"></i> SYNC
          </button>
          <button class="settings-top-action" onclick="SettingsModule.clearActivityLog()">
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
          <i class="fa fa-wifi"></i> সব device sync
        </span>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07)">
        <i class="fa fa-filter" style="color:var(--brand-primary);font-size:.82rem"></i>
        <select id="alog-filter-action" class="form-control" style="width:130px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="SettingsModule.filterActivityLog()">
          <option value="all">সব Action</option>
          <option value="add">➕ ADD</option>
          <option value="edit">✏️ EDIT</option>
          <option value="delete">🗑 DELETE</option>
          <option value="restore">↩ RESTORE</option>
          <option value="system">⚙ SYSTEM</option>
          <option value="export">📤 EXPORT</option>
        </select>
        <select id="alog-filter-type" class="form-control" style="width:160px;font-size:.78rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:7px;padding:6px 10px" onchange="SettingsModule.filterActivityLog()">
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
        </select>
        <div style="flex:1;min-width:160px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:4px 10px">
          <i class="fa fa-search" style="color:rgba(255,255,255,0.35);font-size:.78rem"></i>
          <input type="text" id="alog-search" placeholder="সার্চ করুন…" style="background:none;border:none;outline:none;color:#fff;font-size:.82rem;width:100%;font-family:var(--font-ui)" oninput="SettingsModule.filterActivityLog()" />
        </div>
        <button onclick="SettingsModule.clearActivityFilters()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:7px;padding:6px 12px;cursor:pointer;font-size:.78rem">✕ ক্লিয়ার</button>
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
            ${_buildActivityRows(logs)}
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
                  <td><i class="fa ${d.type === 'student' ? 'fa-user-graduate' : d.type === 'transaction' ? 'fa-money-bill' : d.type === 'staff' ? 'fa-user-tie' : d.type === 'visitor' ? 'fa-walking' : d.type === 'notice' ? 'fa-bullhorn' : d.type === 'account' ? 'fa-building-columns' : d.type === 'loan' ? 'fa-hand-holding-dollar' : d.type === 'exam' ? 'fa-file-lines' : d.type === 'category' ? 'fa-tags' : d.type === 'subaccount' ? 'fa-user-shield' : d.type === 'salary' ? 'fa-money-bill-wave' : d.type === 'নোট' ? 'fa-bookmark' : 'fa-file'}"></i></td>
                  <td style="font-size:.78rem;color:var(--text-muted)">${d.tableLabel || d.table || '—'}</td>
                  <td><span class="badge badge-muted">${d.type || 'item'}</span></td>
                  <td style="font-size:.85rem">${d.name || d.data?.description || d.data?.id || '—'}</td>
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
          <div class="diag-stat-box blue"><div class="label">Last run</div><div class="value" id="heal-last">—</div></div>
          <div class="diag-stat-box red"><div class="label">Last fix</div><div class="value" id="heal-lastfix">—</div></div>
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
          <button id="btn-sync-pull" type="button" class="btn btn-primary btn-sm" onclick="SettingsModule.runCloudPullDiag()">⬇ Sync (retry + pull)</button>
          <button id="btn-push-cloud" type="button" class="btn btn-accent btn-sm" onclick="SettingsModule.runCloudPushDiag()">⬆ Push to Cloud</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.startRealtime(); Utils.toast('Real-time চালু ✅','success')">🟢 Real-time On</button>
          <button class="btn btn-outline btn-sm" onclick="SyncEngine.stopRealtime(); Utils.toast('Real-time বন্ধ','info')">🔴 Real-time Off</button>
        </div>
        <div style="background:var(--bg-base);padding:10px 14px;border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);border:1px solid var(--border)">
          <strong>Device ID:</strong> <code>${typeof SupabaseSync !== 'undefined' ? SupabaseSync._deviceId() : '—'}</code>
        </div>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-wrench"></i> FINANCE LEDGER REPAIR</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          Student-এ Paid amount আছে কিন্তু Finance Ledger / Account Balance ০? Missing entries backfill করুন।
        </p>
        <button class="btn btn-primary btn-sm"
                style="background:linear-gradient(90deg,#00ff88,#00d9ff);border:none;padding:10px 20px;font-weight:800;"
                onclick="if(typeof Students!=='undefined')Students.repairMissingFinanceEntries();else if(typeof SupabaseSync!=='undefined'&&SupabaseSync.repairMissingStudentFinance)SupabaseSync.repairMissingStudentFinance();else Utils.toast('Students module not loaded','error')">
          <i class="fa fa-wrench"></i> Repair Missing Finance Entries
        </button>
      </div>

      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-scale-balanced"></i> FEE RECONCILIATION</div>
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
          যদি কোনো Student-এর <strong style="color:#00ff88">Paid</strong> বা <strong style="color:#ff4757">Due</strong> amount 
          Finance Ledger-এর সাথে মিলছে না, এই বাটনটি সব ঠিক করে দেবে।<br/>
          <span style="font-size:.78rem;color:var(--text-muted);">⚠️ এটি শুধু mismatch fix করে — কোনো payment delete বা add করে না।</span>
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

  // ════════════════════════════════════════════════════════════════
  // TAB 8: KEEP RECORD
  // ════════════════════════════════════════════════════════════════
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
            <div style="font-size:.78rem;color:var(--text-muted)">ব্যক্তিগত নোট ও রেকর্ড — তারিখ অনুযায়ী সেভ থাকে</div>
          </div>
          <button class="btn btn-sm" onclick="SettingsModule.addNote()"
            style="background:linear-gradient(135deg,#b537f2,#7c3aed);color:#fff;border:none;padding:9px 18px;border-radius:25px;font-weight:700;font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 0 16px rgba(181,55,242,0.4)">
            <i class="fa fa-plus"></i> + নতুন নোট
          </button>
        </div>

        <!-- Filter Bar -->
        <div style="padding:14px 22px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(0,0,0,0.15)">
          <!-- Date Range Filter -->
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:.75rem;color:rgba(255,255,255,0.4);white-space:nowrap">📅 থেকে</span>
            <input type="date" id="kr-date-from" class="form-control" style="width:145px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()" />
            <span style="font-size:.75rem;color:rgba(255,255,255,0.4);white-space:nowrap">পর্যন্ত</span>
            <input type="date" id="kr-date-to" class="form-control" style="width:145px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()" />
          </div>
          <select id="kr-tag-filter" class="form-control" style="width:140px;font-size:.82rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:8px;padding:7px 10px" onchange="SettingsModule.filterNotes()">
            <option value="">সব ট্যাগ</option>
            ${tags.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <div style="flex:1;min-width:150px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 10px">
            <i class="fa fa-search" style="color:rgba(255,255,255,0.35);font-size:.82rem"></i>
            <input type="text" id="kr-search" placeholder="সার্চ করুন..." style="background:none;border:none;outline:none;color:#fff;font-size:.85rem;width:100%;font-family:var(--font-ui)" oninput="SettingsModule.filterNotes()" />
          </div>
          <button onclick="SettingsModule.clearNoteFilters()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.55);border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.8rem">✕ ক্লিয়ার</button>
        </div>
        <!-- Notes Grid -->
        <div id="kr-notes-grid" style="padding:18px 22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;max-height:520px;overflow-y:auto">
          ${notes.length === 0
            ? `<div style="grid-column:1/-1;text-align:center;padding:60px 20px">
                <i class="fa fa-flag" style="font-size:2.5rem;color:#b537f2;opacity:.4;display:block;margin-bottom:14px"></i>
                <div style="color:var(--text-muted);font-size:.9rem;margin-bottom:8px">কোনো নোট পাওয়া যায়নি</div>
                <div style="color:#00ff88;font-size:.82rem">নতুন নোট যোগ করতে উপরের বাটনে ক্লিক করুন</div>
              </div>`
            : notes.map((n, i) => {
                const c = n.color || 'blue';
                const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
                return `
                <div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                  ${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700" title="Pinned">📌</div>' : ''}
                  <button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">✏️</button>
                  <button onclick="SettingsModule.deleteNote(${i})" title="Delete → Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">✕</button>
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

        ${notes.length > 0 ? `<div style="padding:10px 22px 14px;border-top:1px solid rgba(255,255,255,0.05);text-align:right;font-size:.75rem;color:var(--text-muted)">${notes.length} টি নোট সংরক্ষিত</div>` : ''}
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
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><i class="fa fa-search" style="font-size:1.8rem;opacity:.3;display:block;margin-bottom:10px"></i>কোনো নোট পাওয়া যায়নি</div>`;
      return;
    }
    const allNotes = getKeepRecords();
    grid.innerHTML = notes.map(n => {
      const i = allNotes.findIndex(x => x.date === n.date && x.title === n.title);
      const c = n.color || 'blue';
      const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
      return `
        <div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          ${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700">📌</div>' : ''}
          <button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">✏️</button>
          <button onclick="SettingsModule.deleteNote(${i})" title="Delete → Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">✕</button>
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

  // ════════════════════════════════════════════════════════════════
  // TAB 9: BATCH PROFIT  // ════════════════════════════════════════════════════════════════
  // TAB 9: BATCH PROFIT REPORT
  // ════════════════════════════════════════════════════════════════
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
              <span style="padding:10px 14px;font-size:1rem;color:var(--brand-primary);font-weight:700;border-right:1px solid rgba(255,255,255,0.1);">৳</span>
              <input type="number" id="bp-prev" class="form-control" value="0" placeholder="0.00"
                style="border:none;background:transparent;border-radius:0;flex:1;" />
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">পূর্বের কোনো ডিউ বা জমানো লাভ থাকলে লিখুন</div>
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

    // ── Students filtered by batch ──
    const batchStudents = selectedBatch
      ? students.filter(s => s.batch === selectedBatch)
      : students;

    // Get student IDs for finance lookup
    const _studentIds = new Set(batchStudents.map(s => s.id || s.student_id));

    // ── Income: from student fees (finance entries for these students) ──
    // Also count direct paid from student records
    const totalStudentFee  = batchStudents.reduce((s, st) => s + (parseFloat(st.total_fee) || 0), 0);
    const totalCollected   = batchStudents.reduce((s, st) => s + (parseFloat(st.paid) || 0), 0);
    const totalDue         = batchStudents.reduce((s, st) => s + (parseFloat(st.due) || 0), 0);

    // ── Expenses: by date range (batch-tagged or general) ──
    const expenseEntries = finance.filter(f => {
      if (f.type !== 'Expense') return false;
      if (f.category === 'Balance Adjustment') return false; // excluded from batch reports
      const inRange = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      if (!inRange) return false;
      if (!selectedBatch) return true;

      // Extract batch from f.batch, description, note, or category
      let fBatch = f.batch;
      if (!fBatch) {
        const desc = String(f.description || '').toLowerCase();
        const note = String(f.note || '').toLowerCase();
        const cat  = String(f.category || '').toLowerCase();
        const text = `${desc} ${note} ${cat}`;
        const m = text.match(/(?:batch|b\s*[-_]?)\s*(\d+)/i);
        if (m) fBatch = m[1];
      }

      // Include general untagged expenses OR expenses matching this batch
      return !fBatch || String(fBatch) === String(selectedBatch);
    });

    const totalExpense = expenseEntries.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    // ── Income = ALL collected fees from batch students (NO date filter) ──
    // Date range applies to EXPENSES only, not income.
    // Students in a batch enroll at different times, so all-time collected is the correct income figure.
    const grossIncome = totalCollected;  // from batchStudents.reduce paid
    const netProfit   = grossIncome - totalExpense + prevBalance;
    const isProfit    = netProfit >= 0;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const academyName = cfg.academy_name || 'Wings Fly Aviation Academy';
    const reportDate  = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // ── Expense breakdown by category ──
    const expCats = {};
    expenseEntries.forEach(f => {
      const cat = f.category || 'General';
      if (!expCats[cat]) expCats[cat] = 0;
      expCats[cat] += parseFloat(f.amount) || 0;
    });

    // ── Store data for export ──
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
          <i class="fa fa-print"></i> প্রিন্ট রিপোর্ট
        </button>
        <button onclick="SettingsModule.exportBatchReportExcel()"
          style="padding:9px 20px;background:linear-gradient(90deg,#1a7a1a,#4caf50);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;">
          <i class="fa fa-file-excel"></i> Excel Export
        </button>
        <span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);align-self:center;">
          রিপোর্ট তৈরি: ${reportDate} &nbsp;|&nbsp; ${selectedBatch || 'সকল Batch'}
          ${startDate ? ` &nbsp;|&nbsp; ${Utils.formatDateEN(startDate)} → ${Utils.formatDateEN(endDate)}` : ''}
        </span>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
        ${bpCard('fa-users', '#00d9ff', 'মোট ছাত্র', batchStudents.length, '')}
        ${bpCard('fa-money-bill-wave', '#ffd700', 'মোট কোর্স ফি', '৳' + totalStudentFee.toLocaleString('en-IN'), '')}
        ${bpCard('fa-circle-check', '#00ff88', 'সংগৃহীত ফি', '৳' + totalCollected.toLocaleString('en-IN'), 'green')}
        ${bpCard('fa-circle-xmark', '#ff4757', 'বাকি ডিউ', '৳' + totalDue.toLocaleString('en-IN'), 'red')}
        ${bpCard('fa-receipt', '#ff9a00', 'মোট খরচ', '৳' + totalExpense.toLocaleString('en-IN'), 'orange')}
        ${bpCard(isProfit ? 'fa-trending-up' : 'fa-trending-down', isProfit ? '#00ff88' : '#ff4757',
          isProfit ? 'নিট মুনাফা' : 'নিট ক্ষতি',
          '৳' + Math.abs(netProfit).toLocaleString('en-IN'),
          isProfit ? 'green' : 'red')}
      </div>

      <!-- P&L Summary Box -->
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;margin-bottom:20px;">
        <div style="font-weight:800;color:var(--brand-primary);font-size:0.9rem;letter-spacing:1px;margin-bottom:14px;border-left:4px solid var(--brand-primary);padding-left:10px;">
          📊 লাভ-ক্ষতি হিসাব সারাংশ (P&amp;L Statement)
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Income Side -->
          <div>
            <div style="font-weight:700;color:#00ff88;margin-bottom:10px;font-size:0.85rem;border-bottom:1px solid rgba(0,255,136,0.2);padding-bottom:6px;">
              ✦ আয় (Income)
            </div>
            ${plRow('ব্যাচের মোট সংগৃহীত ফি (সম্পূর্ণ)', totalCollected, '#00ff88')}
            ${prevBalance !== 0 ? plRow('পূর্ববর্তী ব্যালেন্স', prevBalance, prevBalance >= 0 ? '#00ff88' : '#ff4757') : ''}
            <div style="border-top:1.5px solid rgba(0,255,136,0.3);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;">
              <span style="color:#fff;">মোট আয়</span>
              <span style="color:#00ff88;">৳${grossIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <!-- Expense Side -->
          <div>
            <div style="font-weight:700;color:#ff4757;margin-bottom:10px;font-size:0.85rem;border-bottom:1px solid rgba(255,71,87,0.2);padding-bottom:6px;">
              ✦ ব্যয় (Expense)
            </div>
            ${Object.entries(expCats).map(([cat, amt]) => plRow(cat, amt, '#ff9a00')).join('')}
            ${Object.keys(expCats).length === 0 ? `<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0;">এই তারিখ সীমায় কোনো ব্যয় নেই</div>` : ''}
            <div style="border-top:1.5px solid rgba(255,71,87,0.3);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;">
              <span style="color:#fff;">মোট ব্যয়</span>
              <span style="color:#ff4757;">৳${totalExpense.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- Net Result -->
        <div style="margin-top:16px;padding:14px 20px;background:${isProfit ? 'rgba(0,255,136,0.1)' : 'rgba(255,71,87,0.1)'};border:2px solid ${isProfit ? 'rgba(0,255,136,0.4)' : 'rgba(255,71,87,0.4)'};border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:1.05rem;font-weight:800;color:#fff;">${isProfit ? '✅ নিট মুনাফা (Net Profit)' : '❌ নিট ক্ষতি (Net Loss)'}</span>
          <span style="font-size:1.4rem;font-weight:900;color:${isProfit ? '#00ff88' : '#ff4757'};">
            ${isProfit ? '+' : '-'}৳${Math.abs(netProfit).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <!-- Student-wise Table -->
      <div style="margin-bottom:20px;">
        <div style="font-weight:800;color:var(--brand-primary);font-size:0.85rem;letter-spacing:1px;margin-bottom:10px;border-left:4px solid var(--brand-primary);padding-left:10px;">
          👨‍🎓 ছাত্র ভিত্তিক বিবরণ
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ছাত্রের নাম</th>
                <th>Student ID</th>
                <th>Batch</th>
                <th>কোর্স</th>
                <th>মোট ফি</th>
                <th>পরিশোধিত</th>
                <th>বাকি</th>
                <th>অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              ${batchStudents.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:16px;">কোনো ছাত্র পাওয়া যায়নি</td></tr>' :
                batchStudents.map((s, i) => {
                  const fee  = parseFloat(s.total_fee) || 0;
                  const paid = parseFloat(s.paid) || 0;
                  const due  = parseFloat(s.due) || Math.max(0, fee - paid);
                  const pct  = fee > 0 ? Math.round((paid / fee) * 100) : 0;
                  return `<tr>
                    <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
                    <td><strong>${Utils.esc(s.name) || '—'}</strong></td>
                    <td><span class="badge badge-primary">${Utils.esc(s.student_id) || '—'}</span></td>
                    <td>${Utils.esc(s.batch) || '—'}</td>
                    <td style="font-size:0.82rem;color:var(--text-secondary);">${Utils.esc(s.course) || '—'}</td>
                    <td style="font-weight:700;color:var(--brand-primary);">৳${fee.toLocaleString('en-IN')}</td>
                    <td style="font-weight:700;color:#00ff88;">৳${paid.toLocaleString('en-IN')}</td>
                    <td style="font-weight:700;color:${due > 0 ? '#ff4757' : 'var(--text-muted)'};">৳${due.toLocaleString('en-IN')}</td>
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
                <td colspan="5" style="text-align:right;padding:10px;color:var(--brand-primary);letter-spacing:0.5px;">মোট সারাংশ:</td>
                <td style="color:#ffd700;padding:10px;">৳${totalStudentFee.toLocaleString('en-IN')}</td>
                <td style="color:#00ff88;padding:10px;">৳${totalCollected.toLocaleString('en-IN')}</td>
                <td style="color:#ff4757;padding:10px;">৳${totalDue.toLocaleString('en-IN')}</td>
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
          💸 খরচের বিস্তারিত (${startDate ? Utils.formatDateEN(startDate) : '—'} থেকে ${endDate ? Utils.formatDateEN(endDate) : '—'})
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>তারিখ</th><th>বিবরণ</th><th>ক্যাটাগরি</th><th>পদ্ধতি</th><th style="text-align:right;">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              ${expenseEntries.sort((a,b) => a.date > b.date ? 1 : -1).map((f, i) => {
                const personStr = (f.person_name || f.person) ? `<strong style="color:var(--brand-primary)">[${Utils.esc(f.person_name || f.person)}]</strong> ` : '';
                return `
                <tr>
                  <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
                  <td style="white-space:nowrap;">${Utils.formatDateEN(f.date) || '—'}</td>
                  <td>${personStr}${Utils.esc(f.description) || '—'}</td>
                  <td><span class="badge badge-secondary">${Utils.esc(f.category) || 'General'}</span></td>
                  <td>${Utils.esc(f.method) || '—'}</td>
                  <td style="text-align:right;font-weight:700;color:#ff9a00;">৳${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
                </tr>
              `}).join('')}
            </tbody>
            <tfoot>
              <tr style="background:rgba(0,0,0,0.4);font-weight:800;">
                <td colspan="5" style="text-align:right;padding:10px;color:#ff9a00;">মোট খরচ:</td>
                <td style="text-align:right;color:#ff4757;padding:10px;">৳${totalExpense.toLocaleString('en-IN')}</td>
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
        <span style="font-weight:700;color:${color};font-size:0.83rem;">৳${(parseFloat(amount)||0).toLocaleString('en-IN')}</span>
      </div>`;
  }

  function printBatchReport() {
    const d = window._bpReportData;
    if (!d) { if (typeof Utils !== 'undefined') Utils.toast('আগে রিপোর্ট Generate করুন', 'warn'); return; }

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
      : `<div style="width:56px;height:56px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#fff;">✈</div>`;

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
<title>Batch Profit Report — ${batch}</title>
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
    ${startDate ? `<div>Expense Period: ${Utils.formatDateEN(startDate)} → ${Utils.formatDateEN(endDate)}</div>` : ''}
    ${prevBalance !== 0 ? `<div>পূর্ব ব্যালেন্স: ৳${prevBalance.toLocaleString('en-IN')}</div>` : ''}
    <div>Report Date: ${reportDate}</div>
  </div>
</div>

<!-- Title Bar -->
<div class="title-bar">
  <h2>✦ লাভ-ক্ষতি হিসাব — ${batch} ✦</h2>
  <span style="font-size:8px;">${batchStudents.length} জন ছাত্র</span>
</div>

<!-- KPI Row -->
<div class="kpi-row">
  <div class="kpi-box kpi-blue"><div class="k-label">মোট ছাত্র</div><div class="k-value">${batchStudents.length}</div></div>
  <div class="kpi-box kpi-yellow"><div class="k-label">মোট কোর্স ফি</div><div class="k-value">৳${totalStudentFee.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box kpi-income"><div class="k-label">সংগৃহীত ফি</div><div class="k-value">৳${totalCollected.toLocaleString('en-IN')}</div></div>
</div>
<div class="kpi-row">
  <div class="kpi-box kpi-expense"><div class="k-label">বকেয়া ডিউ</div><div class="k-value">৳${totalDue.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box kpi-orange"><div class="k-label">মোট খরচ</div><div class="k-value">৳${totalExpense.toLocaleString('en-IN')}</div></div>
  <div class="kpi-box ${isProfit ? 'kpi-profit' : 'kpi-loss'}"><div class="k-label">${isProfit ? 'নিট মুনাফা' : 'নিট ক্ষতি'}</div><div class="k-value">${isProfit ? '+' : '-'}৳${Math.abs(netProfit).toLocaleString('en-IN')}</div></div>
</div>

<!-- P&L Statement -->
<div class="pl-section">
  <div class="pl-title">📊 লাভ-ক্ষতি হিসাব (P&amp;L Statement)</div>
  <div class="pl-grid">
    <div>
      <div class="pl-col-title" style="color:#15803d;">আয় (Income)</div>
      <div class="pl-row"><span>ছাত্র ফি সংগ্রহ</span><span style="color:#15803d;font-weight:700;">৳${totalCollected.toLocaleString('en-IN')}</span></div>
      ${otherIncome > 0 ? `<div class="pl-row"><span>অন্যান্য আয়</span><span style="color:#15803d;font-weight:700;">৳${otherIncome.toLocaleString('en-IN')}</span></div>` : ''}
      ${prevBalance !== 0 ? `<div class="pl-row"><span>পূর্ব ব্যালেন্স</span><span style="font-weight:700;color:${prevBalance >= 0 ? '#15803d' : '#b91c1c'};">৳${prevBalance.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="pl-total"><span>মোট আয়</span><span style="color:#15803d;">৳${grossIncome.toLocaleString('en-IN')}</span></div>
    </div>
    <div>
      <div class="pl-col-title" style="color:#b91c1c;">ব্যয় (Expense)</div>
      ${Object.entries(expCats).map(([cat, amt]) =>
        `<div class="pl-row"><span>${cat}</span><span style="color:#c2410c;font-weight:700;">৳${amt.toLocaleString('en-IN')}</span></div>`
      ).join('')}
      ${Object.keys(expCats).length === 0 ? '<div class="pl-row" style="color:#aaa;">কোনো ব্যয় নেই</div>' : ''}
      <div class="pl-total"><span>মোট ব্যয়</span><span style="color:#b91c1c;">৳${totalExpense.toLocaleString('en-IN')}</span></div>
    </div>
  </div>
  <div class="pl-net ${isProfit ? 'pl-net-profit' : 'pl-net-loss'}">
    <span class="label">${isProfit ? '✅ নিট মুনাফা (Net Profit)' : '❌ নিট ক্ষতি (Net Loss)'}</span>
    <span class="amount" style="color:${isProfit ? '#15803d' : '#b91c1c'};">${isProfit ? '+' : '-'}৳${Math.abs(netProfit).toLocaleString('en-IN')}</span>
  </div>
</div>

<!-- Student Table -->
<div class="section-title">👨‍🎓 ছাত্র ভিত্তিক বিবরণ</div>
<table>
  <thead><tr>
    <th style="width:24px;text-align:center">#</th>
    <th>নাম</th>
    <th>Student ID</th>
    <th>Batch</th>
    <th>কোর্স</th>
    <th style="text-align:right">মোট ফি</th>
    <th style="text-align:right">পরিশোধিত</th>
    <th style="text-align:right">বাকি</th>
  </tr></thead>
  <tbody>
    ${batchStudents.map((s, i) => {
      const fee  = parseFloat(s.total_fee) || 0;
      const paid = parseFloat(s.paid) || 0;
      const due  = parseFloat(s.due) || Math.max(0, fee - paid);
      return `<tr>
        <td style="text-align:center;color:#777;">${i + 1}</td>
        <td style="font-weight:700;">${Utils.esc(s.name) || '—'}</td>
        <td><span class="badge badge-blue">${Utils.esc(s.student_id) || '—'}</span></td>
        <td>${Utils.esc(s.batch) || '—'}</td>
        <td style="color:#555;">${Utils.esc(s.course) || '—'}</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8;">৳${fee.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:#15803d;">৳${paid.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:${due > 0 ? '#b91c1c' : '#555'};">৳${due.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('')}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right;color:#1a3a6b;">মোট:</td>
      <td style="text-align:right;color:#1d4ed8;">৳${totalStudentFee.toLocaleString('en-IN')}</td>
      <td style="text-align:right;color:#15803d;">৳${totalCollected.toLocaleString('en-IN')}</td>
      <td style="text-align:right;color:#b91c1c;">৳${totalDue.toLocaleString('en-IN')}</td>
    </tr>
  </tfoot>
</table>

${expenseEntries.length > 0 ? `
<!-- Expense Table -->
<div class="section-title">💸 খরচের বিস্তারিত</div>
<table>
  <thead><tr>
    <th style="width:24px;text-align:center">#</th>
    <th>তারিখ</th>
    <th>বিবরণ</th>
    <th>ক্যাটাগরি</th>
    <th>পদ্ধতি</th>
    <th style="text-align:right">পরিমাণ</th>
  </tr></thead>
  <tbody>
    ${expenseEntries.sort((a,b)=>a.date>b.date?1:-1).map((f, i) => {
      const personStr = (f.person_name || f.person) ? `<strong>[${f.person_name || f.person}]</strong> ` : '';
      return `
      <tr>
        <td style="text-align:center;color:#777;">${i + 1}</td>
        <td style="white-space:nowrap;">${Utils.formatDateEN(f.date) || '—'}</td>
        <td>${personStr}${f.description || '—'}</td>
        <td>${f.category || 'General'}</td>
        <td>${f.method || '—'}</td>
        <td style="text-align:right;font-weight:700;color:#c2410c;">৳${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
      </tr>
    `}).join('')}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right;color:#b91c1c;">মোট খরচ:</td>
      <td style="text-align:right;color:#b91c1c;">৳${totalExpense.toLocaleString('en-IN')}</td>
    </tr>
  </tfoot>
</table>` : ''}

<!-- Footer -->
<div class="footer">
  <div style="font-size:8px;color:#888;">${Utils.esc(academyName)}<br/>এটি একটি অফিসিয়াল আর্থিক রিপোর্ট।</div>
  <div style="display:flex;gap:40px;">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">হিসাবরক্ষক</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">অধ্যক্ষ / কর্তৃপক্ষ</div></div>
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
    if (!d) { if (typeof Utils !== 'undefined') Utils.toast('আগে রিপোর্ট Generate করুন', 'warn'); return; }

    const { batch, batchStudents, expenseEntries, totalStudentFee, totalCollected, totalDue, totalExpense, netProfit } = d;

    // Sheet 1: Student Summary
    const studentRows = batchStudents.map((s, i) => ({
      '#': i + 1,
      'নাম': s.name || '',
      'Student ID': s.student_id || '',
      'Batch': s.batch || '',
      'কোর্স': s.course || '',
      'মোট ফি': parseFloat(s.total_fee) || 0,
      'পরিশোধিত': parseFloat(s.paid) || 0,
      'বাকি': parseFloat(s.due) || Math.max(0, (parseFloat(s.total_fee)||0) - (parseFloat(s.paid)||0)),
      'ভর্তির তারিখ': s.admission_date || '',
      'অবস্থা': s.status || 'Active',
    }));

    // Totals row
    studentRows.push({
      '#': '', 'নাম': '— মোট —', 'Student ID': '', 'Batch': '', 'কোর্স': '',
      'মোট ফি': totalStudentFee, 'পরিশোধিত': totalCollected, 'বাকি': totalDue,
      'ভর্তির তারিখ': '', 'অবস্থা': ''
    });

    // Sheet 2: Expenses
    const expenseRows = expenseEntries.map((f, i) => ({
      '#': i + 1,
      'তারিখ': Utils.formatDateEN(f.date) || '',
      'বিবরণ': (f.person_name || f.person ? `[${f.person_name || f.person}] ` : '') + (f.description || ''),
      'ক্যাটাগরি': f.category || 'General',
      'পদ্ধতি': f.method || '',
      'পরিমাণ (৳)': parseFloat(f.amount) || 0,
    }));
    expenseRows.push({ '#': '', 'তারিখ': '— মোট খরচ —', 'বিবরণ': '', 'ক্যাটাগরি': '', 'পদ্ধতি': '', 'পরিমাণ (৳)': totalExpense });

    // Sheet 3: P&L Summary
    const summaryRows = [
      { 'বিবরণ': 'মোট ছাত্র', 'পরিমাণ (৳)': batchStudents.length },
      { 'বিবরণ': 'মোট কোর্স ফি', 'পরিমাণ (৳)': totalStudentFee },
      { 'বিবরণ': 'সংগৃহীত ফি (Income)', 'পরিমাণ (৳)': totalCollected },
      { 'বিবরণ': 'বকেয়া ডিউ', 'পরিমাণ (৳)': totalDue },
      { 'বিবরণ': 'মোট খরচ (Expense)', 'পরিমাণ (৳)': totalExpense },
      { 'বিবরণ': 'পূর্ব ব্যালেন্স', 'পরিমাণ (৳)': d.prevBalance },
      { 'বিবরণ': netProfit >= 0 ? 'নিট মুনাফা' : 'নিট ক্ষতি', 'পরিমাণ (৳)': netProfit },
    ];

    const run = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'ছাত্র বিবরণ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'খরচের বিবরণ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'P&L সারাংশ');
      XLSX.writeFile(wb, `batch-profit-${batch}-${new Date().toISOString().split('T')[0]}.xlsx`);
      if (typeof Utils !== 'undefined') Utils.toast('Excel Export সম্পন্ন ✓', 'success');
    };
    if (typeof XLSX !== 'undefined') { run(); return; }
    if (window.LazyLibs) {
      window.LazyLibs.load('xlsx').then(run).catch(() => {
        if (typeof Utils !== 'undefined') Utils.toast('XLSX library লোড হয়নি', 'error');
      });
      return;
    }
    if (typeof Utils !== 'undefined') Utils.toast('XLSX library লোড হয়নি', 'error');
  }

  // ════════════════════════════════════════════════════════════════
  // TAB 10: ACCOUNTS MANAGEMENT
  // ════════════════════════════════════════════════════════════════
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
            <div style="color:#00ff88;font-size:1.3rem;font-weight:800">৳${totalAdvanced.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Returned</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">৳${totalReturned.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Outstanding</div>
            <div style="color:#ff4757;font-size:1.3rem;font-weight:800">৳${totalOutstanding.toLocaleString()}</div>
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
                      <td style="padding:10px 8px;font-weight:700">${Utils.esc(a.person) || '—'}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">৳${(parseFloat(a.amount)||0).toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00d4ff">৳${a._totalReturned.toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:${isFullyReturned?'#00ff88':'#ff4757'};font-weight:700">৳${a._remaining.toLocaleString()}</td>
                      <td style="padding:10px 8px;font-size:.82rem"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:2px 8px;border-radius:20px;font-size:.75rem">${Utils.esc(a.method) || '—'}</span></td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-secondary)">${a.date || '—'}</td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-muted)">${Utils.esc(a.note) || '—'}</td>
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
            <div style="color:#a855f7;font-size:1.3rem;font-weight:800">৳${totalInvested.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Returned</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">৳${totalReturnedAmt.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Active Investment</div>
            <div style="color:#ffd700;font-size:1.3rem;font-weight:800">৳${totalOutstanding.toLocaleString()}</div>
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
                      <td style="padding:10px 8px;font-weight:700">${inv.source || '—'}</td>
                      <td style="padding:10px 8px;text-align:right;color:#a855f7;font-weight:700">৳${(parseFloat(inv.amount)||0).toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00d4ff">৳${inv._totalReturned.toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:${isFullyReturned?'#00ff88':'#ffd700'};font-weight:700">৳${inv._remaining.toLocaleString()}</td>
                      <td style="padding:10px 8px;font-size:.82rem"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:2px 8px;border-radius:20px;font-size:.75rem">${inv.method || '—'}</span></td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-secondary)">${inv.date || '—'}</td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-muted)">${inv.note || '—'}</td>
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

  // ════════════════════════════════════════════════════════════════
  // BALANCE ADJUSTMENT — render, add, save, delete
  // ════════════════════════════════════════════════════════════════

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
            <td>${f.date || '—'}</td>
            <td>${f.method || '—'}</td>
            <td><span class="badge ${f.type === 'Income' ? 'badge-success' : 'badge-error'}">${f.type === 'Income' ? '+ Add' : '− Subtract'}</span></td>
            <td class="text-right" style="color:${f.type === 'Income' ? '#00ff88' : '#ff4757'}">৳${parseFloat(f.amount || 0).toLocaleString()}</td>
            <td>${f.note || f.description || '—'}</td>
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
          <strong style="color:#ffd700">⚠ These entries are excluded from Batch Profit Reports and Dashboard statistics.</strong>
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1;min-width:130px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Added</div>
            <div style="color:#00ff88;font-size:1.3rem;font-weight:800">৳${totalAdded.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Subtracted</div>
            <div style="color:#ff4757;font-size:1.3rem;font-weight:800">৳${totalSubtract.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:130px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:10px;padding:12px;text-align:center">
            <div style="color:#aaa;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Net Effect</div>
            <div style="color:#00d4ff;font-size:1.3rem;font-weight:800">৳${(totalAdded - totalSubtract).toLocaleString()}</div>
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
            <option value="Expense">− Subtract from Balance</option>
          </select>
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Date
          <input type="date" id="adj-date" class="settings-input" value="${today}" style="width:100%;margin-top:6px">
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Account / Method
          <select id="adj-method" class="settings-input" style="width:100%;margin-top:6px">${methodOptions}</select>
        </label>
        <label style="font-size:.85rem;color:var(--text-secondary)">Amount (৳)
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
        const force = confirm(`⚠ Account "${adjMethod}" balance is ৳${currentBal.toLocaleString()}, which is less than ৳${adjAmount.toLocaleString()}.\n\nForce subtract anyway?`);
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
        const force = confirm(`⚠ Reversing this adjustment will subtract ৳${amt.toLocaleString()} from "${entry.method}", which currently only has ৳${currentBal.toLocaleString()}.\n\nForce delete anyway?`);
        if (!force) return;
      }
    }

    if (!confirm(`Delete this balance adjustment?\n${entry.type === 'Income' ? '+' : '-'} ৳${parseFloat(entry.amount).toLocaleString()} on ${entry.date} (${entry.method})\n\nThis will reverse the balance change.`)) return;

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

  // ════════════════════════════════════════════════════════════════
  // TAB 11: MONITOR
  // ════════════════════════════════════════════════════════════════
  function panelMonitor() {
    // wfa_recent_changes — শুধু finance transactions (supabase-sync.js)
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
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Last 15 financial transactions। একটি row-এ click করলে সেই সময়ের account balance snapshot দেখাবে।</p>

        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>DATE</th><th>ACTION</th><th>TYPE</th><th>CATEGORY</th><th>PERSON / DETAIL</th><th class="text-right">AMOUNT</th></tr></thead>
            <tbody>
              ${transactions.length === 0 ?
                `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">No transactions yet — Income বা Expense add করলে এখানে দেখাবে।</td></tr>` :
                transactions.map((c, i) => {
                  const actionLabel = c.action === 'update' ? '✏️ Edit' : c.action === 'delete' ? '🗑️ Delete' : c.action === 'restore' ? '↩️ Restore' : '➕ New';
                  const actionColor = c.action === 'update' ? '#00d9ff' : c.action === 'delete' ? '#ff4757' : c.action === 'restore' ? '#ffd700' : '#00ff88';
                  const actionBg    = c.action === 'update' ? 'rgba(0,217,255,0.10)' : c.action === 'delete' ? 'rgba(255,71,87,0.10)' : c.action === 'restore' ? 'rgba(255,215,0,0.10)' : 'rgba(0,255,136,0.10)';
                  // ✅ Rebuilt vs Real snapshot indicator
                  const snapshotBadge = c.rebuilt
                    ? '<span style="font-size:.62rem;color:#ffd700;opacity:.7;margin-left:4px" title="Rebuild থেকে তৈরি — আসল snapshot নয়">🔄</span>'
                    : '<span style="font-size:.62rem;color:#00ff88;opacity:.5;margin-left:4px" title="Real-time snapshot ✓">📸</span>';
                  return `
                  <tr class="monitor-recent-row" style="cursor:pointer" onclick="SettingsModule.showMonitorSnapshot(${i})" title="Click to see account snapshot at this transaction">
                    <td>${i + 1}${snapshotBadge}</td>
                    <td style="font-size:.82rem">${c.date || '—'}</td>
                    <td><span style="font-size:.72rem;font-weight:700;color:${actionColor};background:${actionBg};border:1px solid ${actionColor}44;padding:2px 8px;border-radius:20px;white-space:nowrap">${actionLabel}</span></td>
                    <td><span class="badge ${txBadge(c.type)}">${c.type || '—'}</span></td>
                    <td style="font-size:.82rem">${c.category || '—'}</td>
                    <td style="font-size:.82rem">${c.person || '—'}</td>
                    <td class="text-right" style="font-family:var(--font-ui);font-size:.85rem;color:${String(c.type||'').toLowerCase()==='expense'?'var(--error)':'var(--success)'}">${c.amount ? Utils.takaEn(c.amount) : '—'}</td>
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
  // ════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ════════════════════════════════════════════════════════════════

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
    // ✅ DUPLICATE FIX: সবসময় admin_password আছে এমন row আপডেট করো — এটাই keeper row।
    // allSettings[0] নয়, কারণ sync এর কারণে row order ভিন্ন হতে পারে।
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
    // ── Branding panel inject (settings-branding.js — আলাদা ফাইল) ──────────
    setTimeout(() => {
      if (window.SettingsBranding) window.SettingsBranding.inject();
      else if (window.LazyModules) {
        window.LazyModules.ensure('settings-branding').then(() => {
          window.SettingsBranding && window.SettingsBranding.inject();
        });
      }
      if (window.SettingsInstitution) window.SettingsInstitution.inject();
      else if (window.LazyModules) {
        window.LazyModules.ensure('settings-institution').then(() => {
          window.SettingsInstitution && window.SettingsInstitution.inject();
        });
      }
    }, 50);
  }

  // ✅ Req 4: init Flatpickr DD/MM/YYYY on all non-disabled date inputs in the settings overlay
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

  // ─── SyncGuard Panel ──────────────────────────────────────────
  function panelSyncGuard() {
    return `
    <div class="settings-panel ${activeTab === 'syncguard' ? 'active' : ''}" data-panel="syncguard">
      <div class="settings-card glow-red">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-shield-halved"></i> SYNC GUARD — Payment &amp; Data Integrity</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="SyncGuard.runFullAudit();setTimeout(()=>SyncGuard.renderPanel('syncguard-panel'),200)">
            <i class="fa fa-rotate"></i> Re-Audit
          </button>
          <button type="button" class="btn btn-outline btn-sm" style="color:#a78bfa;border-color:rgba(167,139,250,0.4);background:rgba(167,139,250,0.06)" onclick="typeof WfaSettingsDiagnostics!=='undefined'&&WfaSettingsDiagnostics.run()" title="Full read-only system scan">
            <i class="fa fa-stethoscope"></i> Run Diagnostics
          </button>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">
          Finance ledger, Loan, Transfer এবং Account Balance স্বয়ংক্রিয়ভাবে পরীক্ষা করে।
          Sync conflict বা balance mismatch হলে সাথে সাথে alert পাঠায় এবং এখানে log করে।
        </p>
        <div id="syncguard-panel">
          <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading audit...</div>
        </div>
      </div>
    </div>
    `;
  }


  // ─── Activity Log ─────────────────────────────────────────────
  function getActivityLogs() {
    const raw = Utils.safeJSON(localStorage.getItem('wfa_activity_log'), []);
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.filterActivityLogs) {
      return SupabaseSync.filterActivityLogs(raw);
    }
    return raw.filter(l => {
      const d = String(l.description || '');
      if (/DIAG-TEST-|DIAG-INST-|DIAG-EXAM-|DIAG-SAL-|System Test Student|Auto-generated diagnostic|Diagnostic Test Staff|Diagnostic Installment Student|Diagnostic Exam Student|Diagnostic Loan Person|Batch-DIAG|Diagnostics Course/i.test(d)) return false;
      if (l.type === 'settings' && /^সেটিংস-এ (তথ্য আপডেট|নতুন এন্ট্রি)/i.test(d) && /একাডেমি সেটিংস$/i.test(d)) return false;
      return true;
    });
  }

  // ✅ Fix: settings.js logActivity এখন SupabaseSync.logActivity ব্যবহার করে
  // এতে সব device-এ activity log Supabase-এ sync হবে
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
    const ok = await Utils.confirm('সব Activity Log মুছে দেবেন? এটি undo করা যাবে না।', 'Clear Activity Log');
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

    Utils.toast('Activity log cleared ✅', 'success');
    refreshModal();
  }

  // Activity log panel-এর tbody ও stats live refresh (modal reload ছাড়াই)
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
    if (tot) tot.textContent = `মোট: ${fresh.length}`;
    if (add) add.textContent = `+ যোগ ${addC}`;
    if (edi) edi.textContent = `✏ এডিট ${editC}`;
    if (del) del.textContent = `🗑 ডিলিট ${delC}`;
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

  // ── Activity type metadata ──────────────────────────────────────────────
  const _ACT_TYPE_META = {
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
    system:         { icon:'fa-gear',                  label:'সিস্টেম',         color:'#666666' },
    note:           { icon:'fa-bookmark',              label:'নোট',             color:'#b537f2' },
    school_classes:    { icon:'fa-school',             label:'ক্লাস ব্যবস্থাপনা', color:'#00d9ff' },
    subject_marks:     { icon:'fa-pencil',             label:'বিষয় ও মার্ক',   color:'#ffd700' },
    result_sheet:      { icon:'fa-ranking-star',       label:'রেজাল্ট শিট',    color:'#00ff88' },
    payment_requests:  { icon:'fa-mobile-screen',      label:'পেমেন্ট রিকোয়েস্ট', color:'#ff6b35' },
    routine:           { icon:'fa-calendar-days',      label:'ক্লাস রুটিন',    color:'#b537f2' },
    sms:               { icon:'fa-comment-sms',        label:'SMS',             color:'#00d9ff' },
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
      return `<tr><td colspan="7" class="no-data"><i class="fa fa-inbox"></i> কোনো activity নেই</td></tr>`;

    // ── Apply filters ────────────────────────────────────────────
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

    // ── Deduplication: merge related side-effect entries (within 4 sec) ──
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
      // Special: settings — collapse consecutive same-type within window
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

    // ── Render ───────────────────────────────────────────────────
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
          const dlabel = dt >= today ? '📅 আজ'
                       : dt >= yest  ? '📅 গতকাল'
                       : '📅 ' + dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
          rows.push(`<tr><td colspan="7" style="padding:5px 14px;background:rgba(255,255,255,0.025);font-size:.70rem;font-weight:700;color:rgba(255,255,255,0.30);letter-spacing:.8px;border-top:1px solid rgba(255,255,255,0.06)">${dlabel}</td></tr>`);
        }
      }

      const tm  = _ACT_TYPE_META[l.type]   || { icon:'fa-circle-dot', label: l.type||'—', color:'#aaa' };
      const am  = _ACT_ACTION_META[l.action]|| { badge:(l.action||'?').toUpperCase(), color:'#aaa', bg:'rgba(255,255,255,0.06)', icon:'fa-circle' };
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
        const uniq = [...new Set(absorbed.map(a => (_ACT_TYPE_META[a.type]||{label:a.type}).label))];
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

  // ─── Recycle Bin ───────────────────────────────────────────────────────
  // ✅ Bug Fix: SupabaseSync.remove() writes to IndexedDB ('recycle_bin' table)
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

    // ✅ Req 2: handle settings-specific types locally (categories & sub-accounts)
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
      Utils.toast(`Category "${item.data?.item}" restored ✓`, 'success');
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
      Utils.toast(`Sub-account @${item.data?.username} restored ✓`, 'success');
      refreshModal();
      return;
    }

    // ✅ keep_records: restore note back to localStorage
    if (item && item.table === 'keep_records') {
      const noteData = item.data;
      if (noteData) {
        const notes = getKeepRecords();
        
        // ✅ IMPROVED: Use unique ID instead of title + date (more reliable)
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

    // ✅ advance_payments restore
    if (item && item.table === 'advance_payments') {
      const data = item.data;
      if (data) {
        const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
        const exists = advances.some(a => a.id && a.id === data.id);
        if (!exists) advances.unshift(data);
        // ✅ Bug Fix: IDB-এ write করো, localStorage নয় (SupabaseSync IDB থেকে পড়ে)
        SupabaseSync.setAll(DB.advance_payments || 'advance_payments', advances);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin);
      _saveRecycleBinToSettings();
      logActivity('restore', 'settings', `Restored advance payment: ${data?.person || 'Unknown'}`);
      Utils.toast('Advance payment restored ✓', 'success');
      refreshModal();
      return;
    }

    // ✅ investments restore
    if (item && item.table === 'investments') {
      const data = item.data;
      if (data) {
        const investments = SupabaseSync.getAll(DB.investments || 'investments');
        const exists = investments.some(i => i.id && i.id === data.id);
        if (!exists) investments.unshift(data);
        // ✅ Bug Fix: IDB-এ write করো, localStorage নয় (SupabaseSync IDB থেকে পড়ে)
        SupabaseSync.setAll(DB.investments || 'investments', investments);
      }
      bin.splice(index, 1);
      if (typeof SupabaseSync !== 'undefined') SupabaseSync.setAll('recycle_bin', bin);
      _saveRecycleBinToSettings();
      logActivity('restore', 'settings', `Restored investment: ${data?.source || 'Unknown'}`);
      Utils.toast('Investment restored ✓', 'success');
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

  // ─── Keep Record (Notes) — localStorage-এ আলাদাভাবে সংরক্ষণ ────────────
  // ✅ REDESIGN: keep_records আর settings table-এ রাখা হবে না।
  // কারণ: settings table-এ রাখলে —
  //   1. SupabaseSync.update('settings') → activity log-এ "সেটিংস আপডেট" দেখায় (ভুল)
  //   2. প্রতি ৩০ সেকেন্ডে auto-pull settings overwrite → নোট ভ্যানিশ
  //   3. realtime event-এ settings row overwrite → keep_records হারায়
  // সমাধান: localStorage-এ 'wfa_keep_records_v2' key-এ সরাসরি save।

  function getKeepRecords() {
    return typeof SupabaseSync !== 'undefined' ? SupabaseSync.getAll(DB.keep_records || 'keep_records') : [];
  }

  function _saveKeepRecords(notes) {
    if (typeof SupabaseSync === 'undefined' || !SupabaseSync.setAll) return;
    const table = DB.keep_records || 'keep_records';
    SupabaseSync.setAll(table, Array.isArray(notes) ? notes : []);
  }

  // ✅ Migration: পুরনো data localStorage থেকে Supabase-এ সিঙ্ক করো
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

  // ✅ IMPROVED: Merge remote keep_records from cfg into local view after a Supabase pull
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
      
      // ✅ FIX: Actually save the merged notes back to config!
      if (final.length !== local.length) {
        _saveKeepRecords(final); // ✅ Save merged notes back
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

  // ─── Recycle Bin Sync — saves last 50 items to settings table ───
  // ✅ This piggybacks on the settings Supabase sync for cross-device visibility
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

  // ✅ Merge remote recycle bin from settings into local IDB after a Supabase pull
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
    openSettingsInternalModal('📝 নতুন নোট যোগ করুন', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">টাইটেল <span style="color:#ff4757">*</span></label>
          <input id="note-title" class="form-control" placeholder="নোটের টাইটেল..." style="width:100%;box-sizing:border-box" />
        </div>
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">রঙ বেছে নিন</label>
          <select id="note-color" class="form-control" style="width:100%;box-sizing:border-box">
            <option value="blue">🔵 নীল</option>
            <option value="green">🟢 সবুজ</option>
            <option value="purple">🟣 বেগুনি</option>
            <option value="yellow">🟡 হলুদ</option>
            <option value="red">🔴 লাল</option>
            <option value="orange">🟠 কমলা</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">বিস্তারিত / কনটেন্ট</label>
        <textarea id="note-content" class="form-control" rows="4" placeholder="নোট লিখুন..." style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">ট্যাগ (comma দিয়ে আলাদা করুন)</label>
        <input id="note-tags" class="form-control" placeholder="যেমন: গুরুত্বপূর্ণ, ফাইন্যান্স, স্টাফ" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <input type="checkbox" id="note-pin" style="width:16px;height:16px;cursor:pointer" />
        <label for="note-pin" style="font-size:.85rem;color:rgba(255,255,255,0.7);cursor:pointer">📌 উপরে পিন করুন</label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:9px 18px;border-radius:8px;cursor:pointer;font-size:.85rem">বাতিল</button>
        <button onclick="SettingsModule.saveNote()" style="background:linear-gradient(135deg,#b537f2,#7c3aed);border:none;color:#fff;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700"><i class="fa fa-check" style="margin-right:6px"></i>সেভ করুন</button>
      </div>
    `);
  }

  function saveNote() {
    const title   = document.getElementById('note-title')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    const color   = document.getElementById('note-color')?.value || 'blue';
    const tagsRaw = document.getElementById('note-tags')?.value || '';
    const pinned  = document.getElementById('note-pin')?.checked || false;
    if (!title && !content) { Utils.toast('কিছু লিখুন', 'error'); return; }
    const tags = tagsRaw.split(',').map(t=>t.trim()).filter(Boolean);
    const _notes = getKeepRecords();
    // ✅ FIX: Add unique ID and timestamp for proper sync
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
    Utils.toast('নোট সেভ হয়েছে ✓', 'success');
    logActivity('add', 'note', `Added note: ${title}`);
    _refreshKeepRecordGrid(); // ✅ FIX: Refresh only notes grid, not entire modal
  }

  // ✅ NEW: Lightweight grid refresh for Keep Record (prevents flickering)
  function _refreshKeepRecordGrid() {
    if (activeTab !== 'keeprecord') return; // Only if Keep Record tab is active
    const grid = document.getElementById('kr-notes-grid');
    if (!grid) return;
    
    const notes = getKeepRecords();
    const colorMap = { red:'#ff4757', green:'#00ff88', blue:'#00d9ff', yellow:'#ffd700', purple:'#b537f2', orange:'#ff6b35' };
    const bgMap    = { red:'rgba(255,71,87,0.10)', green:'rgba(0,255,136,0.08)', blue:'rgba(0,217,255,0.08)', yellow:'rgba(255,215,0,0.08)', purple:'rgba(181,55,242,0.10)', orange:'rgba(255,107,53,0.10)' };
    const borderMap = { red:'rgba(255,71,87,0.30)', green:'rgba(0,255,136,0.25)', blue:'rgba(0,217,255,0.25)', yellow:'rgba(255,215,0,0.25)', purple:'rgba(181,55,242,0.30)', orange:'rgba(255,107,53,0.25)' };
    
    if (notes.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><i class="fa fa-flag" style="font-size:2.5rem;color:#b537f2;opacity:.4;display:block;margin-bottom:14px"></i><div style="color:var(--text-muted);font-size:.9rem;margin-bottom:8px">কোনো নোট পাওয়া যায়নি</div><div style="color:#00ff88;font-size:.82rem">নতুন নোট যোগ করতে উপরের বাটনে ক্লিক করুন</div></div>`;
      return;
    }
    
    grid.innerHTML = notes.map((n, i) => {
      const c = n.color || 'blue';
      const pinned = n.pinned ? 'border-left:3px solid #ffd700;' : '';
      return `<div style="background:${bgMap[c]||bgMap.blue};border:1px solid ${borderMap[c]||borderMap.blue};${pinned}border-radius:14px;padding:16px;position:relative;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">${n.pinned ? '<div style="position:absolute;top:10px;right:68px;font-size:.75rem;color:#ffd700" title="Pinned">📌</div>' : ''}<button onclick="SettingsModule.editNote(${i})" title="Edit" style="position:absolute;top:10px;right:38px;background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);color:#00d9ff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center">✏️</button><button onclick="SettingsModule.deleteNote(${i})" title="Delete → Recycle Bin" style="position:absolute;top:10px;right:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);color:#ff6b7a;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center">✕</button><div style="font-weight:700;color:${colorMap[c]||colorMap.blue};font-size:.92rem;margin-bottom:8px;padding-right:28px;line-height:1.3">${Utils.esc(n.title||'Untitled')}</div>${n.content ? `<div style="font-size:.82rem;color:rgba(255,255,255,0.72);line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${Utils.esc(n.content)}</div>` : ''}<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px"><div style="display:flex;gap:5px;flex-wrap:wrap">${(n.tags||[]).map(t=>`<span style="font-size:.68rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:10px;padding:2px 8px">${Utils.esc(t)}</span>`).join('')}</div><span style="font-size:.7rem;color:rgba(255,255,255,0.3)">${n.date||''}</span></div></div>`;
    }).join('');
  }

  function deleteNote(index) {
    const notes = getKeepRecords();
    const victim = notes[index];
    if (!victim) return;
    
    // ✅ IMPROVED: Add unique ID if missing (for older notes)
    if (!victim.id) {
      victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }
    
    // ✅ Fix: Send note to Recycle Bin before removing
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('keep_records', victim);
    } else {
      // Fallback: write directly to localStorage recycle bin
      try {
        const bin = Utils.safeJSON(localStorage.getItem('wfa_recycle_bin'), []);
        bin.unshift({
          id: victim.id, // ✅ NEW: unique ID for proper restore
          table: 'keep_records',
          data: (typeof structuredClone === 'function') ? structuredClone(victim) : JSON.parse(JSON.stringify(victim)),
          deletedAt: new Date().toISOString(),
          type: 'নোট',
          name: victim.title || 'Untitled Note',
          tableLabel: 'Keep Record',
        });
        if (bin.length > 200) bin.length = 200;
        if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.setAll === 'function') {
          SupabaseSync.setAll('recycle_bin', bin);
        }
      } catch(e) { console.warn('[Recycle] note delete failed:', e); }
    }
    SupabaseSync.remove(DB.keep_records || 'keep_records', victim.id); // ✅ sync recycle bin after note delete
    Utils.toast('নোট রিসাইকেল বিনে গেছে 🗑️', 'info');
    logActivity('delete', 'note', `Deleted note: ${victim.title || 'Untitled'}`);
    _refreshKeepRecordGrid(); // ✅ FIX: Refresh only notes grid, not entire modal
  }

  function editNote(index) {
    const notes = getKeepRecords();
    const n = notes[index];
    if (!n) return;
    openSettingsInternalModal('✏️ নোট এডিট করুন', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">টাইটেল <span style="color:#ff4757">*</span></label>
          <input id="note-title" class="form-control" placeholder="নোটের টাইটেল..." value="${Utils.esc(n.title||'')}" style="width:100%;box-sizing:border-box" />
        </div>
        <div>
          <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">রঙ বেছে নিন</label>
          <select id="note-color" class="form-control" style="width:100%;box-sizing:border-box">
            <option value="blue" ${n.color==='blue'?'selected':''}>🔵 নীল</option>
            <option value="green" ${n.color==='green'?'selected':''}>🟢 সবুজ</option>
            <option value="purple" ${n.color==='purple'?'selected':''}>🟣 বেগুনি</option>
            <option value="yellow" ${n.color==='yellow'?'selected':''}>🟡 হলুদ</option>
            <option value="red" ${n.color==='red'?'selected':''}>🔴 লাল</option>
            <option value="orange" ${n.color==='orange'?'selected':''}>🟠 কমলা</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">বিস্তারিত / কনটেন্ট</label>
        <textarea id="note-content" class="form-control" rows="4" placeholder="নোট লিখুন..." style="width:100%;box-sizing:border-box;resize:vertical">${Utils.esc(n.content||'')}</textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:.8rem;color:var(--text-secondary);display:block;margin-bottom:5px">ট্যাগ (comma দিয়ে আলাদা করুন)</label>
        <input id="note-tags" class="form-control" placeholder="যেমন: গুরুত্বপূর্ণ, ফাইন্যান্স, স্টাফ" value="${Utils.esc((n.tags||[]).join(', '))}" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <input type="checkbox" id="note-pin" ${n.pinned?'checked':''} style="width:16px;height:16px;cursor:pointer" />
        <label for="note-pin" style="font-size:.85rem;color:rgba(255,255,255,0.7);cursor:pointer">📌 উপরে পিন করুন</label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:9px 18px;border-radius:8px;cursor:pointer;font-size:.85rem">বাতিল</button>
        <button onclick="SettingsModule.saveEditedNote(${index})" style="background:linear-gradient(135deg,#00d9ff,#0099bb);border:none;color:#fff;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700"><i class="fa fa-save" style="margin-right:6px"></i>আপডেট করুন</button>
      </div>
    `);
  }

  function saveEditedNote(index) {
    const title   = document.getElementById('note-title')?.value?.trim();
    const content = document.getElementById('note-content')?.value?.trim();
    const color   = document.getElementById('note-color')?.value || 'blue';
    const tagsRaw = document.getElementById('note-tags')?.value || '';
    const pinned  = document.getElementById('note-pin')?.checked || false;
    if (!title && !content) { Utils.toast('কিছু লিখুন', 'error'); return; }
    const tags  = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const notes = getKeepRecords();
    if (!notes[index]) { Utils.toast('নোট পাওয়া যায়নি', 'error'); return; }
    
    // ✅ IMPROVED: Preserve ID and timestamps for proper sync
    const oldNote = notes[index];
    notes[index] = { 
      ...oldNote,
      title: title||'Untitled', 
      content: content||'', 
      color, tags, pinned, 
      modified: new Date().toISOString() // ✅ timestamp for sync resolution
    };
    
    SupabaseSync.update(DB.keep_records || 'keep_records', oldNote.id, notes[index]);
    closeSettingsInternalModal();
    Utils.toast('নোট আপডেট হয়েছে ✓', 'success');
    logActivity('edit', 'note', `Edited note: ${title}`);
    _refreshKeepRecordGrid(); // ✅ FIX: Refresh only notes grid, not entire modal
  }

  // ─── Settings-এর ভেতরে নিজস্ব modal (z-index সমস্যা সমাধান) ───
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
          <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
        </div>
        ${bodyHTML}
      </div>`;
    wrap.addEventListener('click', e => { if (e.target === wrap) closeSettingsInternalModal(); });
    document.body.appendChild(wrap);
    // ✅ লজিক ৪ FIX: inner modal-এর সব date inputs-এ Flatpickr (DD/MM/YYYY) apply করো
    // adv-date, ret-adv-date, inv-date, ret-inv-date সহ যেকোনো ভবিষ্যৎ date input
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

  // ─── Advance Payments & Investments ───────────────────────────
  function addAdvancePayment() {
    openSettingsInternalModal('💰 Add Advance Payment', `
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
          <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Amount (৳) <span style="color:#ff4757">*</span></label>
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
          <option value="">— Select Method —</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>

      <div style="margin-bottom:22px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(0,255,136,0.7);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Note</label>
        <div style="position:relative">
          <i class="fa fa-note-sticky" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(0,255,136,0.3);font-size:.82rem;pointer-events:none"></i>
          <input id="adv-note" class="form-control" placeholder="Optional note…" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(0,255,136,0.20);background:rgba(0,255,136,0.04)" />
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
      if (available < amount) { Utils.toast(`Insufficient funds in ${method}. Available: ৳${available.toLocaleString()}`, 'error'); return; }
    }
    const newAdv = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), person, amount, method, date, note, returns: [] };
    SupabaseSync.insert(DB.advance_payments || 'advance_payments', newAdv);
    const _finEntry = SupabaseSync.insert(DB.finance, {
      type: 'Expense', method, category: 'Advance Payment',
      description: `Advance to ${person}`, amount, date, note,
      _advId: newAdv.id  // link করার জন্য
    });
    // ✅ FIX: Account balance কমাও (Advance দেওয়া = টাকা বের হয়)
    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'out');
    }
    closeSettingsInternalModal();
    Utils.toast('Advance payment saved ✓', 'success');
    refreshModal();
  }

  function deleteAdvance(idx) {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    if (!advances[idx]) return;
    const victim = advances[idx];
    if (!window.confirm(`"${victim.person}"-এর advance payment ডিলিট করবেন? Recycle Bin-এ যাবে।`)) return;

    // Recycle Bin-এ পাঠাও
    if (!victim.id) victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('advance_payments', victim);
    }

    // ✅ FIX: Finance linked entry reverse করো
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
    // ✅ FIX: Account balance ফেরত দাও (Expense ছিল → 'in' করো)
    if (victim.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      const reverseAmt = totalFinLinked > 0 ? totalFinLinked : parseFloat(victim.amount) || 0;
      if (reverseAmt > 0) SupabaseSync.updateAccountBalance(victim.method, reverseAmt, 'in');
    }

    SupabaseSync.remove(DB.advance_payments || 'advance_payments', victim.id);
    logActivity('delete', 'settings', `Advance payment deleted: ${victim.person} ৳${Number(victim.amount||0).toLocaleString()} (Finance reversed)`);
    Utils.toast(`"${victim.person}"-এর advance — Recycle Bin-এ গেছে ✓`, 'warning');
    refreshModal();
  }

  function openReturnAdvanceModal(idx) {
    const advances = SupabaseSync.getAll(DB.advance_payments || 'advance_payments');
    const a = advances[idx];
    if (!a) return;
    const returns = a.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const remaining = (parseFloat(a.amount) || 0) - totalReturned;
    openSettingsInternalModal(`↩️ Return Advance — ${Utils.esc(a.person)}`, `
      <div style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Original Amount</span><span style="color:#00ff88;font-weight:700">৳${(parseFloat(a.amount)||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Already Returned</span><span style="color:#00d4ff;font-weight:700">৳${totalReturned.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#aaa;font-size:.83rem">Remaining</span><span style="color:#ff4757;font-weight:800;font-size:1.1rem">৳${remaining.toLocaleString()}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Return Amount (৳) <span style="color:#ff4757">*</span></label>
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
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining ৳${remaining.toLocaleString()}`, 'error'); return; }
    if (!advances[idx].returns) advances[idx].returns = [];
    advances[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    SupabaseSync.update(DB.advance_payments || 'advance_payments', advances[idx].id, advances[idx]);
    SupabaseSync.insert(DB.finance, {
      type: 'Income', method: retMethod, category: 'Advance Return',
      description: `Advance return from ${a.person}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of ৳${retAmount.toLocaleString()} recorded ✓`, 'success');
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
        <td style="padding:10px 8px;text-align:right;color:#ff4757;font-weight:700">−৳${(parseFloat(a.amount)||0).toLocaleString()}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(a.method)}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(a.note)||'—'}</td>
      </tr>`,
      ...returns.map((r, ri) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.date}</td>
          <td style="padding:10px 8px"><span style="background:rgba(0,255,136,0.15);color:#00ff88;padding:2px 8px;border-radius:20px;font-size:.75rem">Return #${ri+1}</span></td>
          <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">+৳${(parseFloat(r.amount)||0).toLocaleString()}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.method)||'—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.note)||'—'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`📋 Advance Ledger — ${Utils.esc(a.person)}`, `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:100px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Advanced</div><div style="color:#ff4757;font-weight:800">৳${(parseFloat(a.amount)||0).toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Returned</div><div style="color:#00d4ff;font-weight:800">৳${totalReturned.toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Remaining</div><div style="color:${remaining<=0?'#00ff88':'#ffd700'};font-weight:800">৳${remaining.toLocaleString()}</div></div>
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
    openSettingsInternalModal('📈 Add Investment', `
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
          <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Amount (৳) <span style="color:#ff4757">*</span></label>
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
          <option value="">— Select Account —</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>

      <div style="margin-bottom:22px">
        <label style="font-size:.70rem;font-weight:800;color:rgba(168,85,247,0.80);letter-spacing:1.2px;margin-bottom:8px;display:block;text-transform:uppercase">Note</label>
        <div style="position:relative">
          <i class="fa fa-note-sticky" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:rgba(168,85,247,0.35);font-size:.82rem;pointer-events:none"></i>
          <input id="inv-note" class="form-control" placeholder="Optional note…" style="width:100%;box-sizing:border-box;padding-left:36px;border-color:rgba(168,85,247,0.22);background:rgba(168,85,247,0.05)" />
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
      _invId: newInv.id  // link করার জন্য
    });
    // ✅ FIX: Account balance বাড়াও (Investment পাওয়া = টাকা আসে)
    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'in');
    }
    closeSettingsInternalModal();
    Utils.toast('Investment saved ✓', 'success');
    refreshModal();
  }

  function deleteInvestment(idx) {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    if (!investments[idx]) return;
    const victim = investments[idx];
    if (!window.confirm(`"${victim.source}"-এর investment ডিলিট করবেন? Recycle Bin-এ যাবে।`)) return;

    // Recycle Bin-এ পাঠাও
    if (!victim.id) victim.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync._addToRecycleBinPublic === 'function') {
      SupabaseSync._addToRecycleBinPublic('investments', victim);
    }

    // ✅ FIX: Finance linked entry reverse করো
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
    // ✅ FIX: Account balance ফেরত দাও (Investment In ছিল → 'out' করো)
    if (victim.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      const reverseAmt = totalFinLinked > 0 ? totalFinLinked : parseFloat(victim.amount) || 0;
      if (reverseAmt > 0) SupabaseSync.updateAccountBalance(victim.method, reverseAmt, 'out');
    }

    SupabaseSync.remove(DB.investments || 'investments', victim.id);
    logActivity('delete', 'settings', `Investment deleted: ${victim.source} ৳${Number(victim.amount||0).toLocaleString()} (Finance reversed)`);
    Utils.toast(`"${victim.source}"-এর investment — Recycle Bin-এ গেছে ✓`, 'warning');
    refreshModal();
  }

  function openReturnInvestmentModal(idx) {
    const investments = SupabaseSync.getAll(DB.investments || 'investments');
    const inv = investments[idx];
    if (!inv) return;
    const returns = inv.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(inv.amount)||0) - totalReturned;
    openSettingsInternalModal(`↩️ Return Investment — ${inv.source}`, `
      <div style="background:rgba(138,43,226,0.08);border:1px solid rgba(138,43,226,0.25);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Total Invested</span><span style="color:#a855f7;font-weight:700">৳${(parseFloat(inv.amount)||0).toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#aaa;font-size:.83rem">Already Returned</span><span style="color:#00d4ff;font-weight:700">৳${totalReturned.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#aaa;font-size:.83rem">Remaining to Return</span><span style="color:#ffd700;font-weight:800;font-size:1.1rem">৳${remaining.toLocaleString()}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.83rem;color:var(--text-secondary);margin-bottom:6px;display:block">Return Amount (৳) <span style="color:#ff4757">*</span></label>
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
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining ৳${remaining.toLocaleString()}`, 'error'); return; }
    if (!investments[idx].returns) investments[idx].returns = [];
    investments[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    SupabaseSync.update(DB.investments || 'investments', investments[idx].id, investments[idx]);
    SupabaseSync.insert(DB.finance, {
      type: 'Investment Out', method: retMethod, category: 'Investment Return',
      description: `Investment return to ${inv.source}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of ৳${retAmount.toLocaleString()} recorded ✓`, 'success');
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
        <td style="padding:10px 8px;text-align:right;color:#a855f7;font-weight:700">+৳${(parseFloat(inv.amount)||0).toLocaleString()}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${inv.method}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${inv.note||'—'}</td>
      </tr>`,
      ...returns.map((r, ri) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.date}</td>
          <td style="padding:10px 8px"><span style="background:rgba(255,71,87,0.15);color:#ff4757;padding:2px 8px;border-radius:20px;font-size:.75rem">Return #${ri+1}</span></td>
          <td style="padding:10px 8px;text-align:right;color:#ff4757;font-weight:700">−৳${(parseFloat(r.amount)||0).toLocaleString()}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.method)||'—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${Utils.esc(r.note)||'—'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`📋 Investment Ledger — ${Utils.esc(inv.source)}`, `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:100px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Invested</div><div style="color:#a855f7;font-weight:800">৳${(parseFloat(inv.amount)||0).toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Returned</div><div style="color:#00d4ff;font-weight:800">৳${totalReturned.toLocaleString()}</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:10px;text-align:center"><div style="color:#aaa;font-size:.72rem;text-transform:uppercase">Outstanding</div><div style="color:${remaining<=0?'#00ff88':'#ffd700'};font-weight:800">৳${remaining.toLocaleString()}</div></div>
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
            <td>${esc(a.name || a.type || '—')}</td>
            <td>${esc(a.type || '—')}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums">৳${(parseFloat(a.balance) || 0).toLocaleString()}</td>
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
      <p style="margin-top:10px;font-weight:700;text-align:right">Combined: ৳${total.toLocaleString()}</p>
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

    // ✅ Bug Fix: আগে snapshot না থাকলে _buildMonitorSnapshotAtRecord দিয়ে recalculate
    // করতো — যেটা backwards calculation করে সবসময় "সঠিক" দেখাতো।
    // এখন শুধু stored snapshot ব্যবহার হবে। না থাকলে warning দেখাবে।
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
      : (item.date || '—');

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

    // Running Batch row — from snapshot (no live re-calc)
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

    // ✅ Warning banner: rebuilt entry বা snapshot না থাকলে alert দেখাবে
    const snapshotWarningBanner = (isRebuilt || !hasRealSnapshot) ? `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(255,215,0,0.10);border:1px solid rgba(255,215,0,0.35);border-radius:10px;display:flex;align-items:flex-start;gap:10px">
        <i class="fa fa-triangle-exclamation" style="color:#ffd700;margin-top:2px;flex-shrink:0"></i>
        <div style="font-size:.80rem;color:#ffd700;line-height:1.6">
          <strong>⚠ এটি আসল time-stamped স্ক্রিনশট নয়।</strong><br>
          ${isRebuilt
            ? 'এই entry <strong>Rebuild</strong> বাটন দিয়ে তৈরি — snapshot সেই transaction-এর সময়ের নয়, বরং Rebuild করার সময়ের বর্তমান balance দেখাচ্ছে।'
            : 'এই entry-র কোনো stored snapshot নেই। Balance data অনুপলব্ধ।'
          }<br>
          <span style="opacity:.75;font-size:.74rem">নতুন transaction add করলে real-time snapshot স্বয়ংক্রিয়ভাবে সেভ হবে।</span>
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
        প্রতিটি row-এর Grand Total ও account balance সেই transaction পর্যন্ত (সময় অনুযায়ী) হিসাব করা। পুরনো entry-এর জন্য একবার <strong>Rebuild Data</strong> চাপুন।
      </div>
      `
    , '720px');
  }
  // ─── Rebuild Monitor Data ───────────────────────────────────────
  // Finance ledger থেকে শেষ ১৫টি ট্রান্সেকশন নিয়ে Data Monitor-এ populate করে।
  // যদি wfa_recent_changes খালি হয়ে যায় বা হারিয়ে যায়, এই function দিয়ে rebuild করা যায়।
  function rebuildMonitorData() {
    try {
      const allFinance = SupabaseSync.getAll(DB.finance);
      const allowedTypes = [
        'income', 'expense', 'transfer in', 'transfer out',
        'loan giving', 'loan receiving', 'investment in', 'investment out',
      ];

      const filtered = allFinance
        .filter(f => allowedTypes.includes(String(f.type || '').toLowerCase()))
        // ✅ Fix: Exclude phantom categories from rebuild
        .filter(f => f.category !== 'Opening Balance' && f.category !== 'Balance Adjustment')
        .sort((a, b) => {
          const da = new Date(a.created_at || a.updated_at || a.date || 0).getTime();
          const db = new Date(b.created_at || b.updated_at || b.date || 0).getTime();
          return db - da;
        })
        .slice(0, 15);

      if (filtered.length === 0) {
        Utils.toast('কোনো ট্রান্সেকশন পাওয়া যায়নি — আগে Income বা Expense add করুন', 'warn');
        return;
      }

      // ✅ Bug Fix: Rebuild-এ _buildMonitorSnapshotAtRecord ব্যবহার করা হতো যেটা
      // বর্তমান ব্যালেন্স থেকে backwards recalculate করতো — ফলে ডেটা ভুল থাকলেও
      // snapshot "সঠিক" দেখাতো (কারণ গাণিতিকভাবে derive করা)।
      // এখন _getMonitorSnapshot() ব্যবহার করা হচ্ছে যেটা accounts.balance সরাসরি পড়ে
      // (আসল স্ক্রিনশট)। Rebuild-কৃত entry-তে rebuilt:true ফ্ল্যাগ থাকবে।
      // NOTE: Rebuilt snapshot = বর্তমান state, historical point-in-time নয়।
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
          person: String(record.person_name || record.description || record.note || '—').slice(0, 100),
          amount: Number(record.amount || 0),
          method: record.method || '',
          table: DB.finance,
          recordId: record.id,
          recordAt: record.created_at || record.updated_at || record.date || null,
          item: `${record.category || record.type} — ৳${Number(record.amount || 0).toLocaleString()}`,
          snapshot: currentSnapshot,
          rebuilt: true,  // ✅ Mark as rebuilt — real-time snapshot ছিল না
        };
      });

      localStorage.setItem('wfa_recent_changes', JSON.stringify(entries));
      Utils.toast(`✅ ${entries.length}টি ট্রান্সেকশন Data Monitor-এ restore হয়েছে (snapshot = বর্তমান state)`, 'success');
      refreshModal();
    } catch (err) {
      console.error('[RebuildMonitor] Failed:', err);
      Utils.toast('Rebuild ব্যর্থ হয়েছে — console চেক করুন', 'error');
    }
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
    // Note: Background system functions do NOT log to activity — by design
  }

  async function runSyncCheck() {
    const output = document.getElementById('sync-check-output');
    if (!output) return;
    output.innerHTML = '<span style="color:var(--text-muted)">Checking local IDs and cloud row counts…</span>';

    let issues = 0;
    let report = '';
    const client = typeof window.SUPABASE_CONFIG !== 'undefined' ? window.SUPABASE_CONFIG.client : null;

    for (const table of Object.values(DB)) {
      const rows = SupabaseSync.getAll(table);
      const noId = rows.filter(r => !r || !r.id).length;
      if (noId > 0) {
        issues += noId;
        report += `⚠️ ${table}: ${noId} record(s) without ID<br>`;
      }

      if (!client) continue;

      try {
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
        if (error) {
          if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
            issues++;
            report += `⚠️ ${table}: cloud table missing or not accessible<br>`;
            continue;
          }
          issues++;
          report += `⚠️ ${table}: cloud error — ${error.message || 'unknown'}<br>`;
          continue;
        }
        const localCount = rows.length;
        const cloudCount = count ?? 0;
        if (cloudCount !== localCount) {
          issues++;
          report += `⚠️ ${table}: local <strong>${localCount}</strong> rows vs cloud <strong>${cloudCount}</strong><br>`;
        }
      } catch (e) {
        issues++;
        report += `⚠️ ${table}: ${e.message || 'cloud check failed'}<br>`;
      }
    }

    const cloudNote = !client
      ? '<br><span style="color:var(--text-muted)">Cloud row counts skipped (no Supabase client).</span>'
      : '';

    if (issues === 0) {
      output.innerHTML = `<span style="color:var(--success)">✅ All checks passed — IDs valid${client ? ' and row counts match cloud' : ''}.</span>${cloudNote}`;
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
      return '<br><small style="color:var(--text-muted)">Supabase server unavailable — Dashboard-এ project paused/active চেক করুন, কিছুক্ষণ পর আবার চেষ্টা করুন।</small>';
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
        b.innerHTML = '⬇ Sync (retry + pull)';
        if (res && res.ok) {
          _showSyncDiagResult('ok', '✅ Sync সফল! ডেটা Cloud থেকে নামানো হয়েছে।', 'Sync সফল ✅', 'success');
        } else {
          _showSyncDiagResult('warn', '⚠️ Sync সম্পন্ন কিন্তু কিছু সমস্যা হয়েছে। Supabase credentials চেক করুন।', 'Sync — কিছু সমস্যা হয়েছে', 'warn');
        }
      })
      .catch(err => {
        b.disabled = false;
        b.innerHTML = '⬇ Sync (retry + pull)';
        const msg = (typeof Utils !== 'undefined' && Utils.esc) ? Utils.esc(err?.message || 'Unknown error') : (err?.message || 'Unknown error');
        _showSyncDiagResult('err', '❌ Sync ব্যর্থ: ' + msg + _supabaseErrHint(err?.message), 'Sync ব্যর্থ', 'error');
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
        b.innerHTML = '⬆ Push to Cloud';
        const sc = res?.successCount || 0;
        const errs = res?.errors || [];
        if (res && res.ok) {
          _showSyncDiagResult('ok', `✅ Push সফল! সব ডেটা Cloud-এ আপলোড হয়েছে। (${sc} টেবিল)`, `Push সফল ✅ ${sc} টেবিল`, 'success');
        } else {
          _showSyncDiagResult(
            'warn',
            `⚠️ আংশিক Push: ${sc} টেবিল সফল, ${errs.length} টেবিলে সমস্যা।<br><small style="color:var(--text-muted)">F12 Console-এ বিস্তারিত দেখুন</small>`,
            'Push — কিছু সমস্যা হয়েছে',
            'warn'
          );
        }
      })
      .catch(err => {
        b.disabled = false;
        b.innerHTML = '⬆ Push to Cloud';
        const msg = (typeof Utils !== 'undefined' && Utils.esc) ? Utils.esc(err?.message || 'Unknown error') : (err?.message || 'Unknown error');
        _showSyncDiagResult(
          'err',
          '❌ Push ব্যর্থ: ' + msg + _supabaseErrHint(err?.message) + '<br><small style="color:var(--text-muted)">Security &amp; Access-এ URL ও Anon Key যাচাই করুন।</small>',
          'Push ব্যর্থ',
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
    const prev = { ...cfg };
    cfg.id = cfg.id || SupabaseSync.generateId();
    cfg.academy_name = document.getElementById('set-academy-name')?.value || cfg.academy_name;
    cfg.monthly_target = parseFloat(document.getElementById('set-monthly-target')?.value) || cfg.monthly_target;
    const rawBatch = document.getElementById('set-running-batch')?.value;
    cfg.running_batch = rawBatch !== undefined && rawBatch !== null ? String(rawBatch) : (cfg.running_batch != null ? String(cfg.running_batch) : '');

    // ── Expense Start Date — Flatpickr-safe read ──────────────────
    // Flatpickr altInput=true: original input is hidden (YYYY-MM-DD value),
    // altInput is visible (DD/MM/YYYY). getElementById returns original hidden input.
    // We also check Flatpickr instance and altInput as fallback.
    const expEl = document.getElementById('set-expense-start');
    let startVal = '';
    if (expEl) {
      if (expEl._flatpickr) {
        // Flatpickr manages this input — use the selectedDates array for reliability
        const fp = expEl._flatpickr;
        startVal = fp.selectedDates.length > 0
          ? fp.formatDate(fp.selectedDates[0], 'Y-m-d')
          : (expEl.value || '');
      } else {
        // Native date input — always returns YYYY-MM-DD
        startVal = expEl.value || '';
        // Fallback: if empty, try next sibling altInput (if Flatpickr added it)
        const altInput = expEl.nextElementSibling;
        if (!startVal && altInput && altInput.classList.contains('flatpickr-input')) {
          const altVal = altInput.value || '';
          // Convert DD/MM/YYYY → YYYY-MM-DD
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
    if (cfg.academy_name && typeof LicenseEngine !== 'undefined' && LicenseEngine.setAcademyName) {
      LicenseEngine.setAcademyName(cfg.academy_name);
    }
    if (typeof App !== 'undefined' && App.applyAcademyMetadata) {
      App.applyAcademyMetadata();
    }
    const changes = [];
    if (String(prev.academy_name || '') !== String(cfg.academy_name || '')) {
      changes.push(`একাডেমির নাম: "${prev.academy_name || '(খালি)'}" → "${cfg.academy_name || '(খালি)'}"`);
    }
    if (Number(prev.monthly_target || 0) !== Number(cfg.monthly_target || 0)) {
      changes.push(`মাসিক লক্ষ্য: ৳${Number(prev.monthly_target || 0).toLocaleString()} → ৳${Number(cfg.monthly_target || 0).toLocaleString()}`);
    }
    if (String(prev.running_batch || '') !== String(cfg.running_batch || '')) {
      changes.push(`চলমান ব্যাচ: "${prev.running_batch || '(খালি)'}" → "${cfg.running_batch || '(খালি)'}"`);
    }
    if (String(prev.expense_start_date || '') !== String(cfg.expense_start_date || '')) {
      changes.push(`ব্যয় শুরুর তারিখ: "${prev.expense_start_date || '(খালি)'}" → "${cfg.expense_start_date || '(খালি)'}"`);
    }
    if (prevLang !== newLang) {
      changes.push(`ভাষা: "${prevLang === 'en' ? 'English' : 'Default'}" → "${newLang === 'en' ? 'English' : 'Default'}"`);
    }
    logActivity('edit', 'settings', changes.length
      ? 'একাডেমি সেটিংস আপডেট — ' + changes.join('; ')
      : 'একাডেমি সেটিংস সংরক্ষণ (কোনো মান পরিবর্তন হয়নি)');
    Utils.toast('Academy info saved ✅', 'success');

    // Trigger reload if language changed so new language assets are cleanly loaded
    if (prevLang !== newLang) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }


  // ── Password ──────────────────────────────────────────────────
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

    // Store SHA-256 hash — never plaintext
    cfg.admin_password = await _hashPw(newPw);
    saveConfig(cfg);

    // Save সফল হয়েছে কিনা verify করো
    const verified = getConfig();
    if (verified.admin_password !== cfg.admin_password) {
      Utils.toast('⚠️ Password save failed — please try again!', 'error');
      return;
    }

    // Input fields পরিষ্কার করো
    const oldEl = document.getElementById('set-old-pw');
    const newEl = document.getElementById('set-new-pw');
    const cfmEl = document.getElementById('set-confirm-pw');
    if (oldEl) oldEl.value = '';
    if (newEl) newEl.value = '';
    if (cfmEl) cfmEl.value = '';

    logActivity('edit', 'security', 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন করা হয়েছে');
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

    // ✅ Fix: use openSettingsInternalModal so it appears ON TOP of the Settings modal
    openSettingsInternalModal(`📋 ${tableName} (${rows.length} records)`, `
      <div class="table-wrapper" style="max-height:480px;overflow:auto">
        <table style="width:100%;min-width:600px"><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-top:8px">
        ${rows.length > 20 ? `Showing first 20 (Total ${rows.length})` : `Total ${rows.length} records`}
      </p>
    `, '860px');
  }

  // ── Export All Data ───────────────────────────────────────────
  function exportAllData() {
    const allData = {};
    for (const [_key, tableName] of Object.entries(DB)) {
      let rows = SupabaseSync.getAll(tableName);
      // Security: admin_password, security_answer — backup থেকে বাদ দাও
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
    Utils.toast('All data exported ✅ (password fields excluded for security)', 'success');
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

      for (const [_key, tableName] of Object.entries(DB)) {
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
        } catch { errors++; }
      }

      if (statusEl) statusEl.innerHTML = `✅ Migration complete! ${imported} new records imported. ${errors > 0 ? `⚠️ ${errors} tables skipped.` : ''}`;
      Utils.toast(`Migration complete! ${imported} records imported`, 'success');
      logActivity('add', 'migration', `Imported ${imported} records`);
      window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));
    } catch (e) {
      if (statusEl) statusEl.textContent = `❌ Migration Failed: ${e.message}`;
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

        if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '🔄 Backup বিশ্লেষণ করা হচ্ছে...'; }

        // Detect legacy format
        const isLegacy = Object.prototype.hasOwnProperty.call(data, 'employees') ||
                         Object.prototype.hasOwnProperty.call(data, 'cashBalance') ||
                         Object.prototype.hasOwnProperty.call(data, 'incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          Utils.toast('পুরনো ব্যাকআপ ফরম্যাট পাওয়া গেছে — রূপান্তর করা হচ্ছে...', 'info');
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
              tableDetails.push(`${targetTable}: ${newRows.length}টি`);
            }
          }
        }

        // ── Show result ────────────────────────────────────────────
        if (imported === 0) {
          if (statusEl) statusEl.innerHTML = '⚠️ কোনো নতুন রেকর্ড পাওয়া যায়নি। ব্যাকআপ ফাইলটি সঠিক কিনা দেখুন অথবা ডেটা ইতিমধ্যে ইম্পোর্ট হয়ে আছে।';
          Utils.toast('কোনো নতুন রেকর্ড ইম্পোর্ট হয়নি', 'warn');
          return;
        }

        const detailsStr = tableDetails.length > 0 ? `<br><small style="color:var(--text-muted)">${tableDetails.join(' | ')}</small>` : '';
        if (statusEl) statusEl.innerHTML = `✅ সফলভাবে <strong>${imported}টি রেকর্ড</strong> ${tableCount}টি টেবিলে ইম্পোর্ট হয়েছে!${detailsStr}<br><br>`;
        Utils.toast(`✅ ${imported}টি রেকর্ড ইম্পোর্ট হয়েছে!`, 'success');

        // ── Push to cloud (Supabase) if connected ──────────────────
        if (statusEl) statusEl.innerHTML += '🔄 Cloud-এ আপলোড হচ্ছে...';
        try {
          const pushResult = await SyncEngine.push({ silent: true, forcePush: true });
          if (pushResult?.ok) {
            if (statusEl) statusEl.innerHTML += ' ✅ Cloud sync সফল!';
          } else {
            if (statusEl) statusEl.innerHTML += ' ⚠️ Cloud sync হয়নি (Supabase কানেক্ট না থাকলে এটা স্বাভাবিক — লোকালি সেভ হয়েছে)।';
          }
        } catch {
          if (statusEl) statusEl.innerHTML += ' ⚠️ Cloud sync হয়নি — লোকাল স্টোরে ডেটা আছে।';
        }

        // ── Add reload button so user sees fresh data immediately ──
        if (statusEl) {
          statusEl.innerHTML += `
            <br><br>
            <div style="background:rgba(0,255,136,0.07);border:1px solid rgba(0,255,136,0.2);border-radius:10px;padding:14px;margin-top:8px">
              <div style="font-weight:700;color:#00ff88;margin-bottom:8px">🎉 ইম্পোর্ট সম্পন্ন!</div>
              <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">
                ড্যাশবোর্ডে সব ডেটা দেখতে পেজটি রিলোড করুন।
              </div>
              <button onclick="location.reload()"
                style="background:linear-gradient(135deg,#00ff88,#00d9ff);color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:.95rem;cursor:pointer">
                🔄 এখনই রিলোড করুন
              </button>
            </div>`;
        }

        logActivity('add', 'import', `Imported ${imported} records from JSON backup (${tableCount} tables)`);
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));

      } catch (err) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `❌ ত্রুটি: ${err.message}`; }
        Utils.toast('JSON পড়তে ব্যর্থ: ' + err.message, 'error');
        console.error('[importFromJSON]', err);
      }
    };
    input.click();
  }

  // ✅ REQ 1: Import from JSON with custom date
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

        if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = '🔄 Backup বিশ্লেষণ করা হচ্ছে...'; }

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
          statusEl.innerHTML += `<br/>✅ আমদানি সম্পন্ন! ${imported} রেকর্ড যুক্ত করা হয়েছে।<br/>
              <div style="font-size:.82rem;color:var(--text-muted);margin-top:8px">
                ড্যাশবোর্ডে সব ডেটা দেখতে পেজটি রিলোড করুন।
              </div>
              <button onclick="location.reload()"
                style="background:linear-gradient(135deg,#00ff88,#00d9ff);color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:.95rem;cursor:pointer;margin-top:8px">
                🔄 এখনই রিলোড করুন
              </button>`;
        }

        logActivity('add', 'import', `Imported ${imported} records from JSON with date: ${customDate}`);
        window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { direction: 'migration' } }));

      } catch (err) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `❌ ত্রুটি: ${err.message}`; }
        Utils.toast('JSON পড়তে ব্যর্থ: ' + err.message, 'error');
        console.error('[importFromJSONWithDate]', err);
      }
    };
    input.click();
  }

  // ── Legacy Data Transformer ───────────────────────────────────
  // ✅ REQ 1: Support custom import date
  async function importLegacyData(data, statusEl, customDate) {
    let total = 0;
    
    // ✅ REQ 1: If custom date provided, convert to ISO format
    const importDateISO = customDate && customDate.length === 10 ? customDate : null;

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
      if (statusEl) statusEl.innerHTML = '🔄 Importing staff...';
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
      if (statusEl) statusEl.innerHTML = '🔄 Importing finance...';
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

    if (statusEl) statusEl.innerHTML = '🔄 Importing accounts...';
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
      if (statusEl) statusEl.innerHTML = '🔄 Importing visitors...';
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
      if (statusEl) statusEl.innerHTML = '🔄 Importing notices...';
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
      if (statusEl) statusEl.innerHTML = '🔄 Importing settings...';
      const cfg = Array.isArray(data.settings) ? data.settings[0] : data.settings;
      if (cfg) {
        const existing = SupabaseSync.getAll(DB.settings);
        if (!existing.length) {
          // SECURITY: admin_password কখনো backup থেকে import করা হবে না
          // Backup-এ plaintext পাসওয়ার্ড থাকলেও এখানে সেট হবে না
          SupabaseSync.insert(DB.settings, {
            academy_name: cfg.academyName || cfg.academy_name || 'Wings Fly Aviation Academy',
            address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
            // admin_password intentionally excluded — set via Settings → Change Password
          }, { bypassLog: true });
          total += 1;
        } else {
          // Existing settings থাকলে শুধু non-sensitive fields আপডেট করো
          const existingCfg = { ...existing[0] };
          existingCfg.academy_name = cfg.academyName || cfg.academy_name || existingCfg.academy_name;
          // admin_password কখনো backup থেকে overwrite হবে না
          delete existingCfg.admin_password;
          const currentPw = existing[0].admin_password;
          if (currentPw) existingCfg.admin_password = currentPw;
          SupabaseSync.update(DB.settings, existingCfg.id, existingCfg, { bypassLog: true });
        }
      }
    }

    if (data.examRegistrations && data.examRegistrations.length) {
      if (statusEl) statusEl.innerHTML = '🔄 Importing exams...';
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

  // ── Modern Data Importer (with custom date support) ───────────
  // ✅ FIX: This function was called on line 5080 but was never defined.
  //         Extracted from importFromJSON() modern-format logic + custom date support.
  async function importModernData(data, statusEl, customDate, tableCount) {
    let imported = 0;
    tableCount = tableCount || 0;
    const tableDetails = [];

    // ✅ If custom date provided, use it for date fields
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

      if (statusEl) statusEl.innerHTML = `🔄 Importing ${targetTable}...`;

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
        tableDetails.push(`${targetTable}: ${newRows.length}টি`);
      }
    }

    if (statusEl && tableDetails.length > 0) {
      const detailsStr = `<br><small style="color:var(--text-muted)">${tableDetails.join(' | ')}</small>`;
      statusEl.innerHTML = `✅ সফলভাবে <strong>${imported}টি রেকর্ড</strong> ${tableCount}টি টেবিলে ইম্পোর্ট হয়েছে!${detailsStr}`;
    }

    return imported;
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
    localStorage.removeItem('wfa_recycle_bin');
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

  // ── Clear Cloud Data ──────────────────────────────────────────
  async function clearCloudData() {
    const ok = await Utils.confirm('⚠️ All cloud data will be permanently deleted!', '☁️ Delete Cloud Data');
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

  // ── Auto Snapshots ──────────────────────────────────────────────
  // ✅ Fix: Snapshots now stored in IndexedDB (via WFA_IDB) instead of localStorage.
  //         localStorage has a 5MB hard limit — snapshots containing all data easily exceed it.
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

  // ✅ Fix: Save snapshots to IndexedDB — no quota limit
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
            console.warn('[Snapshot] Storage quota exceeded — cannot save even 1 snapshot. Skipping.');
            return false;
          }
          snapshots.pop();
          console.warn(`[Snapshot] Quota hit — trimmed to ${snapshots.length} snapshot(s).`);
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

    // ✅ Fix: Cap at 3 to save storage space
    if (snapshots.length > 3) snapshots.length = 3;

    const saved = _saveSnapshotsQuotaSafe(snapshots);
    if (manual) {
      if (saved) {
        if (typeof Utils !== 'undefined') Utils.toast('📸 Snapshot Saved!', 'success');
      } else {
        if (typeof Utils !== 'undefined') Utils.toast('⚠️ Snapshot skipped — storage full. Try exporting a manual backup instead.', 'warn');
      }
      refreshModal();
    }
  }

  // ── Daily Auto Backup Download ────────────────────────────────
  function tryDailyAutoDownload() {
    try {
      const today   = new Date().toISOString().split('T')[0];
      const lastDay = localStorage.getItem('wfa_last_auto_download') || '';
      if (lastDay === today) return; // আজকে already হয়েছে

      if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') return;
      const students = SupabaseSync.getAll(DB.students || 'students');
      if (!students || students.length === 0) return; // data ready না

      // exportAllData এর মতো করে data নাও
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
        Utils.toast('📥 Daily auto backup downloaded: wfa_backup_' + today + '.json', 'success', 6000);
      }
      console.info('[AutoBackup] ✅ Daily backup downloaded for', today);
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

    if(typeof Utils !== 'undefined') Utils.toast('✅ Snapshot Restored Successfully', 'success');
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
             <span style="color:var(--brand-primary);font-weight:600;font-size:0.95rem">প্রতি ১ ঘণ্টায় auto snapshot</span>
             <span class="badge" style="background:rgba(0,217,255,0.15);color:var(--brand-primary);border-radius:20px;padding:3px 12px;font-size:0.75rem;border:1px solid rgba(0,217,255,0.3)">LAST 3 রাখা হয় · IndexedDB</span>
           </div>
           <div style="display:flex; gap: 8px;">
             <button class="btn btn-outline" style="border-color:var(--error);color:var(--error);font-size:0.85rem;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;" onclick="SettingsModule.clearAllSnapshots()">
                <i class="fa fa-trash"></i> Clear All
             </button>
             <button class="btn btn-outline" style="border-color:var(--brand-cyan);color:var(--brand-primary);font-size:0.85rem;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;box-shadow:0 0 10px rgba(0,217,255,0.2)" onclick="SettingsModule.saveSnapshot(true)">
                <i class="fa fa-camera-retro"></i> এখনই নিন
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

  // ── Recovery & Sub-accounts ───────────────────────────────────
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
     if(typeof Utils !== 'undefined') Utils.toast('Security Settings Saved ✅', 'success');
     refreshModal();
  }

  // ── Supabase Auth credentials save ────────────────────────────
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
      Utils.toast('Cloud API credentials saved (encrypted) ✅', 'success');
      // ✅ FIX: Reset sync anchor & trigger full pull so data loads immediately
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
    // Note: password stored locally only — never pushed to Supabase settings table
    // (settings.js sanitizeRecord already strips it via _TABLE_COLS allowlist)
    cfg.supabase_password = pass;
    saveConfig(cfg);

    // Immediately try signing in so session is live
    if (window.SupabaseAuth) {
      SupabaseAuth.signIn(email, pass)
        .then(() => {
          logActivity('edit', 'security', 'Supabase Auth credentials saved & signed in');
          Utils.toast('Cloud credentials saved ✅ Supabase sign-in successful', 'success');
          // ✅ FIX: Reset sync anchor & trigger full pull so data loads immediately
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
      Utils.toast('Cloud credentials saved ✅', 'success');
    }
  }

  function getSubAccounts() {
     if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        return SupabaseSync.getAll(DB.sub_accounts || 'sub_accounts') || [];
     }
     return Utils.safeJSON(localStorage.getItem('wfa_sub_accounts'), []);
  }

  /* ── SHA-256 password hashing (Web Crypto API) ───────────────────────
     Passwords কখনো plaintext সংরক্ষণ করা হবে না।
     hashPassword(pw) → Promise<string> hex digest
  ──────────────────────────────────────────────────────────────────── */
  async function hashPassword(pw) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {
      // Fallback: simple obfuscation যদি Web Crypto না থাকে
      console.warn('Web Crypto unavailable, using fallback');
      let hash = 0;
      for (let i = 0; i < pw.length; i++) { hash = ((hash << 5) - hash) + pw.charCodeAt(i); hash |= 0; }
      return 'fb_' + Math.abs(hash).toString(16);
    }
  }

  /* Existing sub-accounts migrate করো (plaintext → hashed)
     App load হওয়ার পরে একবার চলবে, তারপর আর দরকার নেই।
  */
  async function migratePasswordsToHash() {
    const subs = getSubAccounts();
    let changed = false;
    for (let s of subs) {
      // যদি hash না হয়ে থাকে (64-char hex নয়)
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
  // Migration একবার চালাও
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
        if(typeof Utils !== 'undefined') Utils.toast('Password কমপক্ষে ৬ অক্ষরের হতে হবে', 'error');
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

     // ── Password SHA-256 hash করে সংরক্ষণ ───────────────────────────
     const hashedPw = await hashPassword(pw);

     const newSub = {
        id: (typeof SupabaseSync !== 'undefined') ? SupabaseSync.generateId() : Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        username: un,
        password: hashedPw,   // SHA-256 hashed — plaintext কখনো store হয় না
        permissions: permissions
     };

     if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        SupabaseSync.insert(DB.sub_accounts || 'sub_accounts', newSub);
     } else {
        subs.push(newSub);
        localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
     }
     
     logActivity('add', 'security', `Added sub-account @${un}`);
     if(typeof Utils !== 'undefined') Utils.toast('Sub-account created ✅', 'success');
     refreshModal();
  }

  function deleteSubAccount(idx) {
    const subs = getSubAccounts();
    const target = subs[idx];
    if (target) {
      // ✅ Req 2: push to recycle bin (IDB-backed) before deleting so it can be restored
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
      if (typeof Utils !== 'undefined') Utils.toast('Sub-account deleted → Recycle Bin-এ আছে', 'warning');
      refreshModal();
    }
  }

  // ── Custom Theme Logic ──
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

  // ── Color presets for the theme builder ──
  const _THEME_PRESETS = [
    { label: '🌊 Ocean', bg: '#030d1a', primary: '#00c8ff', secondary: '#0066ff', neon: '#00ffdd' },
    { label: '🌸 Cherry', bg: '#120008', primary: '#ff3ca0', secondary: '#ff7043', neon: '#ff9ff3' },
    { label: '🌿 Forest', bg: '#050f05', primary: '#00e676', secondary: '#69f0ae', neon: '#b9f6ca' },
    { label: '🔥 Lava',  bg: '#1a0500', primary: '#ff5722', secondary: '#ff1744', neon: '#ffab40' },
    { label: '👾 Cyber', bg: '#050512', primary: '#b537f2', secondary: '#00d9ff', neon: '#ff00ff' },
    { label: '🌙 Dusk',  bg: '#0d0015', primary: '#e040fb', secondary: '#7c4dff', neon: '#ea80fc' },
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
          <span class="modal-title bn">🎨 Custom Theme Builder</span>
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
              <label style="font-size:.78rem;color:var(--text-muted);font-weight:600;letter-spacing:.04em">⚡ QUICK PRESETS</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${presetsHTML}</div>
            </div>

            <!-- Color Pickers -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">🌑 Background</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-bg1" value="${defBg}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-bg1-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defBg.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">✨ Primary Accent</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-primary" value="${defPr}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-primary-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defPr.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">🎆 Secondary Accent</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                  <input type="color" id="ct-secondary" value="${defSc}"
                    oninput="SettingsModule._updateThemePreview()"
                    style="width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:2px;background:transparent">
                  <span id="ct-secondary-hex" style="font-size:.72rem;color:rgba(255,255,255,.5);font-family:monospace">${defSc.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <label style="font-size:.75rem;color:var(--text-muted)">💡 Neon Glow</label>
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
                💾 ${editTheme ? 'Update Theme' : 'Save Theme'}
              </button>
              <button class="btn" style="flex:0 0 auto;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.15)"
                onclick="document.getElementById('theme-builder-modal').remove()">
                Cancel
              </button>
            </div>
          </div>

          <!-- RIGHT: Live Preview -->
          <div>
            <label style="font-size:.78rem;color:var(--text-muted);font-weight:600;letter-spacing:.04em">👁️ LIVE PREVIEW</label>
            <div id="ct-preview" style="margin-top:6px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12);height:240px;display:flex;font-size:.75rem;transition:all .2s;background:linear-gradient(135deg,${defBg} 0%,#000 100%)">
              <!-- Mini Sidebar -->
              <div class="pv-sidebar" style="width:90px;padding:10px 0;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,${defBg} 0%,${defBg} 100%);border-right:1.5px solid ${defPr}44">
                <div style="text-align:center;padding:6px;font-size:1rem;margin-bottom:4px">🦅</div>
                <div class="pv-nav-active" style="padding:5px 8px;border-radius:0 6px 6px 0;font-weight:600;color:${defPr};background:${defPr}22;border-left:3px solid ${defPr}">📊 Dash</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">📚 Course</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">👥 Students</div>
                <div style="padding:5px 8px;color:rgba(255,255,255,.4)">💰 Finance</div>
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
                    <div class="pv-accent" style="font-weight:700;font-size:.9rem;color:${defSc}">৳ 18k</div>
                  </div>
                </div>
                <div style="background:rgba(255,255,255,.05);border-radius:6px;padding:8px;border:1px solid rgba(255,255,255,.07);flex:1">
                  <div style="color:rgba(255,255,255,.35);font-size:.68rem;margin-bottom:4px">Recent Activity</div>
                  <div style="height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden"><div style="height:100%;width:70%;background:linear-gradient(90deg,${defPr},${defSc})"></div></div>
                </div>
                <button class="pv-btn" style="border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;font-size:.72rem;background:linear-gradient(135deg,${defPr},${defSc})">+ Add Student</button>
              </div>
            </div>
            <div style="text-align:center;font-size:.7rem;color:rgba(255,255,255,.3);margin-top:6px">রং পরিবর্তন করলে সাথে সাথে preview আপডেট হবে</div>
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
        if (typeof Utils !== 'undefined') Utils.toast('✅ Theme updated!', 'success');
        refreshModal();
        switchTab('theme');
        return;
      }
    }

    // Create mode
    if (custom.length >= 5) {
      if (typeof Utils !== 'undefined') Utils.toast('সর্বোচ্চ ৫টি custom theme সেভ করা যাবে।', 'error');
      return;
    }

    const tId = 'custom_' + Date.now();
    custom.push({
      id: tId,
      name,
      desc: 'Custom user-defined theme.',
      emoji: '🎨',
      colors: [bg1, p, s, n],
      bg: 'linear-gradient(135deg, ' + bg1 + ' 0%, #000 100%)',
      isCustom: true
    });
    localStorage.setItem('wfa_custom_themes', JSON.stringify(custom));
    document.getElementById('theme-builder-modal').remove();
    if (typeof Utils !== 'undefined') Utils.toast('🎨 Theme saved! Theme panel থেকে select করুন।', 'success');
    refreshModal();
    switchTab('theme');
  }

  function deleteCustomTheme(tId) {
    let custom = Utils.safeJSON(localStorage.getItem('wfa_custom_themes'), []);
    const themeName = custom.find(t => t.id === tId)?.name || tId;
    custom = custom.filter(t => t.id !== tId);
    localStorage.setItem('wfa_custom_themes', JSON.stringify(custom));

    // ✅ Put deleted theme info in Keep Record
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
    _saveKeepRecords(notes); // ✅ synced to Supabase
    if (localStorage.getItem('wfa_theme') === tId) {
      applyTheme('neon-space');
    } else {
      if(typeof Utils !== 'undefined') Utils.toast('Custom Theme deleted', 'info');
      refreshModal();
      switchTab('theme');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: AI ASSISTANT
  // ════════════════════════════════════════════════════════════════
  function panelAIAssistant() {
    const rawKey = localStorage.getItem('wfa_gemini_key') || '';
    const isEncrypted = rawKey.startsWith('wfa_enc::');
    const displayKey = isEncrypted ? '•••••••• (Encrypted)' : (rawKey ? '•••••••• (Legacy)' : '');
    // ✅ Bug #5 Fix: Auto-migrate plaintext key → SecureStorage (one-time)
    if (rawKey && !isEncrypted && typeof SecureStorage !== 'undefined' && SecureStorage.setItem) {
      SecureStorage.setItem('wfa_gemini_key', rawKey).then(() => {
        console.info('[Security] Migrated plaintext Gemini key to SecureStorage.');
      }).catch(() => {});
    }
    // ✅ Security Fix: Auto-migrate plaintext backup keys → SecureStorage (one-time, same as slot 1)
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
          <strong>🔄 স্বয়ংক্রিয় Hybrid:</strong> ছাত্র/বকেয়া/লেনদেন = সবসময় লোকাল ডাটা।
          API Key সেট করলে অন্য প্রশ্ন Gemini-তে যাবে। <strong>লিমিট শেষ হলে অটো লোকাল</strong> — আবার Key কাজ করলে Gemini ফিরে আসবে।
        </div>
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer;font-size:0.9rem;">
          <input type="checkbox" id="ai-local-only" ${localOnly ? 'checked' : ''} onchange="SettingsModule.toggleAILocalOnly(this.checked)" />
          <span><strong>শুধু Local</strong> — Gemini একদম বন্ধ (চাইলে টিক দিন)</span>
        </label>
        <details open style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">Gemini API Key</summary>
        <div class="form-group" style="margin-bottom:16px;">
          <label>Primary Gemini API Key</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="password" id="ai-api-key-input" class="form-control" placeholder="AIzaSy..." value="${displayKey}" style="flex:1;min-width:200px" />
            <button class="btn btn-primary" onclick="SettingsModule.saveAIApiKey()">💾 Save</button>
            <button class="btn btn-secondary" onclick="SettingsModule.testAIApiKey()">🔍 Test Key</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label>Backup Keys (limit শেষ হলে auto-switch)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <input type="password" id="ai-api-key-2" class="form-control" placeholder="Backup 2 ${hasBackup2 ? '✓' : ''}" style="flex:1;min-width:160px" />
            <input type="password" id="ai-api-key-3" class="form-control" placeholder="Backup 3 ${hasBackup3 ? '✓' : ''}" style="flex:1;min-width:160px" />
            <button class="btn btn-secondary" onclick="SettingsModule.saveAIBackupKeys()">💾 Save Backup</button>
          </div>
        </div>
        </details>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">
          <strong>জিজ্ঞেস করুন:</strong> "সারাংশ", "মোট ছাত্র", "বকেয়া", "আদায়", "আজকের লেনদেন", "[নাম]"
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
      Utils.toast(checked ? 'শুধু Local মোড — Gemini বন্ধ' : 'Hybrid মোড — Key থাকলে Gemini, লিমিটে Local', 'success');
    }
    refreshModal();
  }

  async function saveAIApiKey() {
    const el = document.getElementById('ai-api-key-input');
    if (!el) return;
    let key = el.value.trim();
    
    if (key.startsWith('••••••••')) {
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
      if(typeof Utils !== 'undefined') Utils.toast('SecureStorage unavailable — cannot save API key safely.', 'error');
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
    
    if(typeof Utils !== 'undefined') Utils.toast('✅ API Key saved — Hybrid mode: Gemini + auto local fallback', 'success');
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
      Utils.toast(saved ? `✅ ${saved} backup key saved` : 'Backup key খালি — AIzaSy... বসান', saved ? 'success' : 'warning');
    }
    refreshModal();
  }

  async function testAIApiKey() {
    if (typeof AIAssistant === 'undefined' || typeof AIAssistant.testApiKey !== 'function') {
      if (typeof Utils !== 'undefined') Utils.toast('AI Assistant module লোড হয়নি', 'error');
      return;
    }
    if (typeof Utils !== 'undefined') Utils.toast('Key যাচাই হচ্ছে...', 'info', 2000);
    const result = await AIAssistant.testApiKey();
    if (typeof Utils !== 'undefined') {
      Utils.toast(result.message, result.ok ? 'success' : (result.quota ? 'warning' : 'error'), 10000);
    }
  }


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CLIENT MANAGER PANEL â€” Admin only
  // All client info + License Key generator
  // ================================================================
  function panelClientManager() {
    const isClientDeployment = window.WFA_SUPABASE_SECRETS && window.WFA_SUPABASE_SECRETS.customerCode;
    if (isClientDeployment) return `<div class="settings-panel" data-panel="client-manager"></div>`;

    const isAdm = (typeof App !== 'undefined' && App.isAdmin && App.isAdmin()) ||
                  (localStorage.getItem('wfa_user_role') === 'admin');
    if (!isAdm) return `<div class="settings-panel" data-panel="client-manager"></div>`;

    const _CLIENTS_KEY = 'wfa_acadeflow_clients';
    const _DELETED_CODES_KEY = 'wfa_acadeflow_clients_deleted';
    function _getDeletedCodes() {
      try { return JSON.parse(localStorage.getItem(_DELETED_CODES_KEY) || '[]'); } catch { return []; }
    }
    function _addDeletedCode(code) {
      const arr = _getDeletedCodes();
      if (!arr.includes(code)) { arr.push(code); localStorage.setItem(_DELETED_CODES_KEY, JSON.stringify(arr)); }
    }
    function _clearDeletedCodes() {
      localStorage.removeItem(_DELETED_CODES_KEY);
    }
    // Restore all auto-deployed clients (clears the deleted blacklist and re-merges metadata)
    window._wfaRestoreAutoDeployedClients = function() {
      _clearDeletedCodes();
      const fresh = _loadClients();
      const tableEl = document.getElementById('cm-clients-table');
      if (tableEl) tableEl.innerHTML = _buildTable(fresh);
      else if (typeof SettingsModule !== 'undefined' && SettingsModule.refreshModal) SettingsModule.refreshModal();
      Utils.toast('✅ Auto-deployed clients পুনরুদ্ধার হয়েছে! (' + fresh.length + ' client)', 'success');
    };

    function _loadClients() {
      let local = [];
      try { local = JSON.parse(localStorage.getItem(_CLIENTS_KEY) || '[]'); } catch { local = []; }

      const deletedCodes = _getDeletedCodes();
      const autoDeployed = window.WFA_AUTO_DEPLOYED_CLIENTS || [];
      let changed = false;
      autoDeployed.forEach(ac => {
        // ── Skip entries the admin has explicitly deleted ─────────────
        if (deletedCodes.includes(ac.customerCode)) return;

        const idx = local.findIndex(lc => lc.customerCode === ac.customerCode);
        if (idx === -1) {
          // ── New client: add it ──────────────────────────────────────
          local.push({
            id: ac.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            customerCode: ac.customerCode,
            academy: ac.academy,
            owner: ac.owner || '',
            phone: ac.phone || '',
            email: ac.email || '',
            package: ac.package || 'Basic',
            institutionType: ac.institutionType || 'coaching',
            licenseKey: ac.licenseKey || '',
            supabaseUrl: ac.supabaseUrl || '',
            supabaseKey: ac.supabaseKey || '',
            notes: ac.notes || 'Auto-deployed via script',
            createdAt: ac.createdAt || new Date().toISOString()
          });
          changed = true;
        } else {
          // ── Existing client — sync fields from latest metadata ───────
          const lc = local[idx];
          if (lc.academy     !== ac.academy)     { lc.academy     = ac.academy;     changed = true; }
          if (lc.package     !== ac.package)     { lc.package     = ac.package;     changed = true; }
          if (ac.institutionType && lc.institutionType !== ac.institutionType) { lc.institutionType = ac.institutionType; changed = true; }
          if (lc.supabaseUrl !== ac.supabaseUrl) { lc.supabaseUrl = ac.supabaseUrl; changed = true; }
          if (lc.supabaseKey !== ac.supabaseKey) { lc.supabaseKey = ac.supabaseKey; changed = true; }
          // licenseKey is managed in-app, do NOT overwrite from metadata
        }
      });
      if (changed) {
        try { localStorage.setItem(_CLIENTS_KEY, JSON.stringify(local)); } catch { /* ignore */ }
      }
      return local;
    }

    function _saveClients(arr) {
      try { localStorage.setItem(_CLIENTS_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
    }

    const clients = _loadClients();

    // v2: status badge shows "Loading..." initially; license-manager.js batch-validates async
    function _statusBadge(client) {
      if (!client.licenseKey) return `<span style="background:rgba(120,120,120,0.15);color:#aaa;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">No Key</span>`;
      return `<span data-status-badge style="background:rgba(120,120,120,0.15);color:#aaa;padding:2px 9px;border-radius:20px;font-size:0.72rem">Loading…</span>`;
    }

    function _instTypeLabel(t) {
      const m = { coaching: '🏫 Coaching', school: '🏛️ School', college: '🎓 College' };
      const v = String(t || 'coaching').toLowerCase();
      return m[v] || m.coaching;
    }

    function _buildTable(list) {
      if (!list.length) return `<div style="text-align:center;color:#7a8baa;padding:32px;font-size:0.9rem">No clients yet. Add one below.</div>`;
      return `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead><tr style="border-bottom:1px solid rgba(0,217,255,0.15)">
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">#</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Code</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Academy</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Owner</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Phone</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Package</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Type</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">License Key</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:left">Status</th>
            <th style="padding:8px 6px;color:#00d9ff;text-align:right">Action</th>
          </tr></thead>
          <tbody>
            ${list.map((c, i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04)" onmouseenter="this.style.background='rgba(0,217,255,0.04)'" onmouseleave="this.style.background='none'">
                <td style="padding:9px 6px;color:#7a8baa">${i+1}</td>
                <td style="padding:9px 6px;color:#00d9ff;font-family:monospace;font-weight:700">${Utils.esc(c.customerCode||'-')}</td>
                <td style="padding:9px 6px;color:#fff;font-weight:600">${Utils.esc(c.academy||'-')}</td>
                <td style="padding:9px 6px;color:#ccc">${Utils.esc(c.owner||'-')}</td>
                <td style="padding:9px 6px;color:#ccc">${Utils.esc(c.phone||'-')}</td>
                <td style="padding:9px 6px">
                  <span style="background:rgba(123,47,247,0.15);color:#b57ff7;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700">${Utils.esc(c.package||'Basic')}</span>
                </td>
                <td style="padding:9px 6px;color:#ccc;font-size:0.78rem">${Utils.esc(_instTypeLabel(c.institutionType))}</td>
                <td data-lickey="${Utils.escAttr(c.licenseKey || '')}" style="padding:9px 6px;font-family:monospace;font-size:0.78rem;color:#00d9ff">
                  ${c.licenseKey
                    ? `<span title="${Utils.escAttr(c.licenseKey)}">${c.licenseKey.slice(0,18)}...</span>
                       <button onclick="navigator.clipboard.writeText('${Utils.escAttr(c.licenseKey)}');Utils.toast('Key copied!','success')" style="background:none;border:none;color:#7a8baa;cursor:pointer;margin-left:4px;font-size:0.75rem">Copy</button>`
                    : '<span style="color:#7a8baa">-</span>'}
                </td>
                <td style="padding:9px 6px">${_statusBadge(c)}</td>
                <td style="padding:9px 6px;text-align:right">
                  <button onclick="_wfaClientEdit(${i})" style="background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.2);color:#00d9ff;padding:3px 9px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-right:4px">Edit</button>
                  ${c.licenseKey ? `<button onclick="_wfaToggleRevokeKey && _wfaToggleRevokeKey(${i})" title="Revoke / Reactivate license" style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.25);color:#f5a623;padding:3px 9px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-right:4px">🔑</button>` : ''}
                  <button onclick="_wfaClientDelete(${i})" style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);color:#ff4757;padding:3px 9px;border-radius:6px;cursor:pointer;font-size:0.78rem">Del</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
    }

    function _summary(list) {
      const total = list.length;
      // ✅ Fix: LicenseEngine.validate() is async (v2). Render placeholders immediately,
      // then update counts asynchronously after batch validation completes.
      setTimeout(async () => {
        if (typeof LicenseEngine === 'undefined') return;
        let active = 0, expired = 0;
        for (const c of list) {
          if (!c.licenseKey) continue;
          try {
            const s = await LicenseEngine.validate(c.licenseKey);
            if (s.ok || s.inGrace) active++;
            else if (s.expired) expired++;
          } catch { /* skip */ }
        }
        const aEl = document.getElementById('cm-summary-active');
        const eEl = document.getElementById('cm-summary-expired');
        if (aEl) aEl.textContent = active;
        if (eEl) eEl.textContent = expired;
      }, 0);
      return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:100px;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:1.6rem;font-weight:800;color:#00d9ff">${total}</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">Total Clients</div></div>
        <div style="flex:1;min-width:100px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:14px;text-align:center">
          <div id="cm-summary-active" style="font-size:1.6rem;font-weight:800;color:#00ff88">…</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">Active</div></div>
        <div style="flex:1;min-width:100px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);border-radius:12px;padding:14px;text-align:center">
          <div id="cm-summary-expired" style="font-size:1.6rem;font-weight:800;color:#ff4757">…</div>
          <div style="font-size:0.75rem;color:#7a8baa;margin-top:2px">Expired</div></div>
      </div>`;
    }

    window._wfaClientSave = function() {
      const id = document.getElementById('cm-edit-id')?.value;
      const rawCode = (document.getElementById('cm-customer-code')?.value?.trim()?.toUpperCase()) || '';
      const obj = {
        id:           id || Date.now().toString(36),
        customerCode: rawCode,
        academy:      document.getElementById('cm-academy')?.value?.trim()  || '',
        owner:        document.getElementById('cm-owner')?.value?.trim()    || '',
        phone:        document.getElementById('cm-phone')?.value?.trim()    || '',
        email:        document.getElementById('cm-email')?.value?.trim()    || '',
        package:      document.getElementById('cm-package')?.value          || 'Basic',
        institutionType: document.getElementById('cm-institution-type')?.value || 'coaching',
        licenseKey:   (document.getElementById('cm-lickey')?.value?.trim()?.toUpperCase()) || '',
        supabaseUrl:  document.getElementById('cm-supurl')?.value?.trim()   || '',
        supabaseKey:  document.getElementById('cm-supkey')?.value?.trim()   || '',
        notes:        document.getElementById('cm-notes')?.value?.trim()    || '',
      };
      if (!id) obj.createdAt = new Date().toISOString();
      let list = _loadClients();
      const idx = list.findIndex(c => c.id === obj.id);
      if (idx >= 0) Object.assign(list[idx], obj); else list.push(obj);
      _saveClients(list);
      Utils.toast('Client saved!', 'success');
      SettingsModule.refreshModal();
    };

    window._wfaClientEdit = function(idx) {
      const list = _loadClients();
      const c = list[idx]; if (!c) return;
      const map = {
        'cm-edit-id':       c.id,
        'cm-customer-code': c.customerCode,
        'cm-academy':       c.academy,
        'cm-owner':         c.owner,
        'cm-phone':         c.phone,
        'cm-email':         c.email,
        'cm-package':       c.package,
        'cm-institution-type': c.institutionType || 'coaching',
        'cm-lickey':        c.licenseKey,
        'cm-supurl':        c.supabaseUrl,
        'cm-supkey':        c.supabaseKey,
        'cm-notes':         c.notes,
      };
      Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val || ''; });
      // Auto-fill the generator code from this client's customerCode
      const genCode = document.getElementById('cm-gen-code');
      if (genCode) genCode.value = c.customerCode || '';
      document.getElementById('cm-form-title').textContent = 'Edit: ' + (c.academy || 'Client');
      document.getElementById('cm-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window._wfaClientDelete = function(idx) {
      if (!confirm('Delete this client permanently?')) return;
      const list = _loadClients();
      const deleted = list.splice(idx, 1)[0];
      // ── If it came from auto-deploy metadata, blacklist its code ────
      if (deleted?.customerCode) _addDeletedCode(deleted.customerCode);
      _saveClients(list);
      Utils.toast('Client deleted.', 'warning');
      // Refresh only the table (no full modal flicker)
      const tableEl = document.getElementById('cm-clients-table');
      if (tableEl) tableEl.innerHTML = _buildTable(_loadClients());
      else SettingsModule.refreshModal();
    };

    // Assign a generated key to a selected client
    window._wfaAssignKeyToClient = function() {
      const sel  = document.getElementById('cm-assign-client-select');
      const key  = document.getElementById('cm-gen-result')?.value?.trim();
      if (!sel || !sel.value || !key) { Utils.toast('Client নির্বাচন করুন এবং আগে key generate করুন', 'warning'); return; }
      const list = _loadClients();
      const idx  = list.findIndex(c => c.id === sel.value);
      if (idx < 0) { Utils.toast('Client পাওয়া যায়নি', 'error'); return; }
      list[idx].licenseKey = key;
      _saveClients(list);
      Utils.toast(`✅ Key assigned to "${list[idx].academy || list[idx].customerCode}"`, 'success');
      // Also fill the form fields for quick editing
      const licEl = document.getElementById('cm-lickey');
      if (licEl) licEl.value = key;
      SettingsModule.refreshModal();
    };

    // Populate assign-dropdown helper (called after key generation)
    window._wfaPopulateAssignDropdown = function(generatedKey) {
      const row = document.getElementById('cm-assign-key-row');
      const sel = document.getElementById('cm-assign-client-select');
      if (!sel || !row) return;
      const list = _loadClients();
      // Extract customer code from key e.g. WFA-RAND-CODE-YYYYMM-CS
      const parts = generatedKey ? generatedKey.split('-') : [];
      const codeInKey = parts.length >= 3 ? parts[2] : '';
      sel.innerHTML = '<option value="">-- Client নির্বাচন করুন --</option>' +
        list.map(c => {
          const match = codeInKey && c.customerCode === codeInKey;
          return `<option value="${c.id}" ${match ? 'selected' : ''}>${c.customerCode ? '['+c.customerCode+'] ' : ''}${c.academy || c.owner || c.id}</option>`;
        }).join('');
      row.style.display = list.length ? 'block' : 'none';
    };

    // v2: _wfaGenerateLicKey is now async and lives in js/core/license-manager.js
    // This stub ensures backward compatibility if license-manager.js loads after settings.js
    if (typeof window._wfaGenerateLicKey === 'undefined') {
      window._wfaGenerateLicKey = function() {
        Utils.toast('⏳ License Manager লোড হচ্ছে, একটু অপেক্ষা করুন…', 'warning');
      };
    }

    // Trigger async panel-ready hook after DOM renders
    setTimeout(() => { if (typeof window._wfaLicenseManagerOnPanelReady === 'function') window._wfaLicenseManagerOnPanelReady(); }, 200);

    return `
    <div class="settings-panel ${activeTab === 'client-manager' ? 'active' : ''}" data-panel="client-manager">
      <div class="settings-card-title" style="color:var(--brand-primary)">
        <i class="fa fa-id-card"></i> CLIENT MANAGER
        <span style="font-size:0.72rem;font-weight:500;color:#7a8baa;margin-left:8px">Admin Only &mdash; All client info &amp; Licenses</span>
      </div>

      ${_summary(clients)}

      <div class="settings-card" style="margin-bottom:20px">
        <div style="font-weight:700;color:#fff;font-size:0.95rem;margin-bottom:14px">All Clients
          <button onclick="(function(){ const fresh=_loadClients(); document.getElementById('cm-clients-table').innerHTML=_buildTable(fresh); if(typeof _wfaRefreshLicenseStatuses==='function') _wfaRefreshLicenseStatuses(); })()" title="Refresh client list &amp; license statuses" style="margin-left:10px;background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.2);color:#00d9ff;padding:2px 10px;border-radius:6px;cursor:pointer;font-size:0.75rem">🔄 Refresh</button>
        </div>
        <div id="cm-clients-table">${_buildTable(clients)}</div>
      </div>

      <div class="settings-card" style="margin-bottom:20px;border:1px solid rgba(123,47,247,0.3)">
        <div style="font-size:0.8rem;font-weight:700;color:#b57ff7;letter-spacing:1px;margin-bottom:14px;text-transform:uppercase">
          <i class="fa fa-shield-halved"></i> License Server Admin Secret
        </div>
        <p style="font-size:0.78rem;color:#7a8baa;margin-bottom:10px;line-height:1.5">
          Generate/Revoke করার জন্য এই field-এ আপনার <code style="color:#b57ff7">ADMIN_GEN_SECRET</code> দিন
          (Supabase Edge Function-এ set করা secret)। এটি শুধু এই ডিভাইসে localStorage-এ সেভ হয়।
        </p>
        <div style="display:flex;gap:10px">
          <input id="cm-admin-secret" type="text" autocomplete="off" class="form-control" placeholder="ADMIN_GEN_SECRET" style="flex:1;font-family:monospace; -webkit-text-security: disc; text-security: disc;" />
          <button onclick="_wfaSaveAdminSecret && _wfaSaveAdminSecret()" style="background:rgba(123,47,247,0.2);border:1px solid rgba(123,47,247,0.4);color:#b57ff7;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;white-space:nowrap">💾 Save</button>
        </div>
      </div>

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
          Generate New License Key
        </button>
        <input id="cm-gen-result" type="text" readonly
          style="display:none;width:100%;padding:10px 14px;border-radius:8px;background:rgba(123,47,247,0.1);border:1px solid rgba(123,47,247,0.4);color:#b57ff7;font-family:monospace;font-size:0.9rem;text-align:center;cursor:pointer;box-sizing:border-box"
          onclick="navigator.clipboard.writeText(this.value);Utils.toast('Copied!','success')" />
        <div id="cm-assign-key-row" style="display:none;margin-top:8px;padding:10px 12px;background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.2);border-radius:8px">
          <p style="font-size:0.78rem;color:#7a8baa;margin:0 0 8px 0">এই key কোন client-এ assign করবেন?</p>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="cm-assign-client-select" class="form-control" style="flex:1;font-size:0.82rem">
              <option value="">-- Client নির্বাচন করুন --</option>
            </select>
            <button onclick="_wfaAssignKeyToClient()" style="background:linear-gradient(135deg,#00d9ff,#7b2ff7);border:none;color:#fff;padding:9px 16px;border-radius:8px;font-weight:700;cursor:pointer;white-space:nowrap;font-size:0.82rem">✅ Assign</button>
          </div>
        </div>
      </div>

      <div class="settings-card" id="cm-form-section" style="border:1px solid rgba(0,217,255,0.2)">
        <div style="font-size:0.8rem;font-weight:700;color:#00d9ff;letter-spacing:1px;margin-bottom:14px;text-transform:uppercase">
          <i class="fa fa-plus"></i> <span id="cm-form-title">Add New Client</span>
        </div>
        <input type="hidden" id="cm-edit-id" value="" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Customer Code (4 chars) *</label>
            <input id="cm-customer-code" type="text" maxlength="4" class="form-control" placeholder="e.g. GL01"
              style="text-transform:uppercase;font-family:monospace;font-weight:700;color:#00d9ff"
              oninput="this.value=this.value.toUpperCase();const g=document.getElementById('cm-gen-code');if(g)g.value=this.value;" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Academy Name *</label>
            <input id="cm-academy" type="text" class="form-control" placeholder="Green Leaf Academy" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Owner Name</label>
            <input id="cm-owner" type="text" class="form-control" placeholder="Rahim Sir" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Phone Number</label>
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
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Institution Type *</label>
            <select id="cm-institution-type" class="form-control">
              <option value="coaching">🏫 Coaching Centre</option>
              <option value="school">🏛️ School</option>
              <option value="college">🎓 College</option>
            </select>
          </div>
          <div style="grid-column:1/-1">
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">License Key</label>
            <input id="cm-lickey" type="text" class="form-control" placeholder="WFA-XXXX-XXXX-XXXXXX-XXXX" style="font-family:monospace;font-size:0.78rem" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Client Supabase URL</label>
            <input id="cm-supurl" type="text" class="form-control" placeholder="https://xxxx.supabase.co" />
          </div>
          <div>
            <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Client Supabase Anon Key</label>
            <input id="cm-supkey" type="text" class="form-control" placeholder="eyJhbGci..." style="font-size:0.75rem;font-family:monospace" />
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:0.78rem;color:#7a8baa;display:block;margin-bottom:4px">Notes / Customization Requests</label>
          <textarea id="cm-notes" class="form-control" rows="3" placeholder="Customization requests, payment history, etc..." style="resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="_wfaClientSave()" style="flex:1;background:linear-gradient(135deg,rgba(0,217,255,0.8),rgba(123,47,247,0.8));border:none;color:#fff;padding:11px;border-radius:8px;font-weight:700;cursor:pointer">
            Save Client
          </button>
          <button onclick="document.getElementById('cm-edit-id').value='';['cm-customer-code','cm-academy','cm-owner','cm-phone','cm-email','cm-lickey','cm-supurl','cm-supkey','cm-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('cm-package').value='Basic';document.getElementById('cm-institution-type').value='coaching';document.getElementById('cm-form-title').textContent='Add New Client';"
            style="padding:11px 18px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;border-radius:8px;cursor:pointer;font-weight:600">
            Clear
          </button>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: STUDENT PORTAL MANAGEMENT
  // ════════════════════════════════════════════════════════════════

  function panelStudentPortal() {
    return `
    <div class="settings-panel" data-panel="student-portal">
      <div class="settings-card">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <i class="fa fa-graduation-cap" style="color:#f59e0b"></i> Student Portal Management
        </h3>
        <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:20px">
          নিচের তালিকা থেকে যেকোনো student-কে Portal Access দিন এবং তাদের 4-digit PIN set করুন।
        </p>

        <div id="sp-search-bar" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="text" id="sp-search-input"
            placeholder="নাম, ID বা ফোন দিয়ে খুঁজুন..."
            oninput="SettingsModule.spFilterStudents(this.value)"
            style="flex:1;min-width:180px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;padding:10px 14px;color:#fff;font-size:0.9rem;outline:none" />
          <button id="sp-filter-all" onclick="SettingsModule.spSetFilter('all')"
            style="padding:10px 14px;background:rgba(245,158,11,0.8);border:none;
                   border-radius:8px;color:#0b0f19;cursor:pointer;font-size:0.82rem;font-weight:700">
            <i class="fa fa-users"></i> সবাই
          </button>
          <button id="sp-filter-access" onclick="SettingsModule.spSetFilter('access')"
            style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;color:#10b981;cursor:pointer;font-size:0.82rem;font-weight:700">
            <i class="fa fa-check-circle"></i> Access প্রাপ্ত
          </button>
          <button onclick="SettingsModule.spSetFilter('all')"
            style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                   border-radius:8px;color:#aaa;cursor:pointer;font-size:0.85rem">
            <i class="fa fa-rotate"></i> রিফ্রেশ
          </button>
        </div>

        <div id="sp-student-list">
          <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)">
            <i class="fa fa-spinner fa-spin" style="font-size:1.8rem;margin-bottom:12px;display:block"></i>
            লোড হচ্ছে...
          </div>
        </div>
      </div>

      <!-- PIN Set Modal (inline, hidden by default) -->
      <div id="sp-pin-modal" style="display:none;position:fixed;inset:0;z-index:9999;
           background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
           display:none;align-items:center;justify-content:center">
        <div style="background:#111827;border:1px solid rgba(255,255,255,0.1);
                    border-radius:20px;padding:32px;width:100%;max-width:420px;position:relative">
          <button onclick="SettingsModule.spClosePinModal()"
            style="position:absolute;top:14px;right:14px;background:rgba(239,68,68,0.15);
                   border:1px solid rgba(239,68,68,0.25);color:#ef4444;border-radius:8px;
                   width:32px;height:32px;cursor:pointer;font-size:1rem">✕</button>

          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:4px;color:#f9fafb">
            <i class="fa fa-key" style="color:#f59e0b"></i> Portal Access সেটআপ
          </h3>
          <p id="sp-modal-student-name" style="font-size:0.85rem;color:#9ca3af;margin-bottom:20px"></p>

          <input type="hidden" id="sp-modal-student-id" />
          <input type="hidden" id="sp-modal-student-phone" />
          <input type="hidden" id="sp-modal-student-name-val" />

          <div style="margin-bottom:16px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:#9ca3af;margin-bottom:8px">
              <i class="fa fa-phone"></i> মোবাইল নম্বর (Login-এ ব্যবহার হবে)
            </label>
            <input type="tel" id="sp-modal-phone-input"
              placeholder="01XXXXXXXXX"
              style="width:100%;background:rgba(17,24,39,0.6);border:1px solid rgba(255,255,255,0.1);
                     border-radius:10px;padding:12px 14px;color:#fff;font-size:1rem;outline:none" />
          </div>

          <div style="margin-bottom:20px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:#9ca3af;margin-bottom:8px">
              <i class="fa fa-lock"></i> 4-ডিজিট PIN (Student-এর পছন্দের)
            </label>
            <input type="password" id="sp-modal-pin-input"
              placeholder="••••" maxlength="4" inputmode="numeric"
              style="width:100%;background:rgba(17,24,39,0.6);border:1px solid rgba(255,255,255,0.1);
                     border-radius:10px;padding:12px 14px;color:#fff;font-size:1.4rem;
                     letter-spacing:8px;text-align:center;outline:none" />
            <p style="font-size:0.78rem;color:#6b7280;margin-top:6px">
              ⚠️ PIN টি SHA-256 hash করে database-এ save হবে — আমরা কখনো plain PIN দেখি না।
            </p>
          </div>

          <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;color:#9ca3af">
              <input type="checkbox" id="sp-modal-active" checked
                style="width:16px;height:16px;accent-color:#f59e0b;cursor:pointer" />
              Portal সচল রাখুন (Active)
            </label>
          </div>

          <div id="sp-modal-error" style="display:none;background:rgba(239,68,68,0.1);
               border:1px solid rgba(239,68,68,0.2);color:#fca5a5;
               border-radius:10px;padding:10px 14px;font-size:0.85rem;margin-bottom:14px"></div>

          <button id="sp-modal-save-btn" onclick="SettingsModule.spSavePortalAccess()"
            style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);
                   border:none;border-radius:12px;padding:13px;font-size:1rem;
                   font-weight:700;color:#0b0f19;cursor:pointer;display:flex;
                   align-items:center;justify-content:center;gap:8px">
            <i class="fa fa-check"></i> Portal Access সেভ করুন
          </button>
        </div>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: SMS NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════

  function panelSMSSettings() {
    // Delegates to the injected helper (defined outside IIFE to avoid size bloat)
    return (typeof window._panelSMSSettings_html === 'function')
      ? window._panelSMSSettings_html()
      : `<div data-panel="sms-settings" class="settings-panel" style="display:none;">
           <p style="padding:20px;color:var(--text-muted);">SMS Engine লোড হয়নি। পৃষ্ঠা Refresh করুন।</p>
         </div>`;
  }

  // ── Student Portal: Render Student List ──
  let _spAllStudents = [];

  function _spRenderStudentList() {
    const container = document.getElementById('sp-student-list');
    if (!container) return;

    // Load from local SupabaseSync store
    let students = [];
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        students = SupabaseSync.getAll('students') || [];
      }
    } catch { students = []; }

    _spAllStudents = students;
    _spRenderList(students);
  }

  function _spRenderList(students) {
    const container = document.getElementById('sp-student-list');
    if (!container) return;

    if (!students || students.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.35)">
          <i class="fa fa-user-slash" style="font-size:2rem;display:block;margin-bottom:10px"></i>
          কোনো student পাওয়া যায়নি। প্রথমে Student যোগ করুন।
        </div>`;
      return;
    }

    // Check which students already have portal access
    let accessMap = {};
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        accessList.forEach(a => { accessMap[a.student_id] = a; });
      }
    } catch { /* ignore */ }

    const rows = students.map(s => {
      const access = accessMap[s.id];
      const hasAccess = !!access;
      const isActive = access ? access.is_active : false;
      const statusBadge = hasAccess
        ? (isActive
            ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-check-circle"></i> সচল</span>`
            : `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-times-circle"></i> বন্ধ</span>`)
        : `<span style="background:rgba(107,114,128,0.15);color:#6b7280;border-radius:9999px;padding:3px 10px;font-size:0.78rem;font-weight:700"><i class="fa fa-minus-circle"></i> নেই</span>`;

      const phone = s.phone || s.contact || '';
      const escapedName = Utils.esc ? Utils.esc(s.name || '—') : (s.name || '—');
      const escapedId   = Utils.esc ? Utils.esc(s.id || '') : (s.id || '');
      const escapedPhone= Utils.esc ? Utils.esc(phone) : phone;

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);
                    gap:12px;flex-wrap:wrap;transition:background 0.2s"
             onmouseover="this.style.background='rgba(255,255,255,0.03)'"
             onmouseout="this.style.background='transparent'">
          <div style="flex:1;min-width:160px">
            <div style="font-weight:600;color:#f9fafb;font-size:0.95rem">${escapedName}</div>
            <div style="font-size:0.8rem;color:#6b7280;margin-top:2px">
              <span style="margin-right:12px"><i class="fa fa-id-badge"></i> ${escapedId}</span>
              <span><i class="fa fa-phone"></i> ${escapedPhone || 'নম্বর নেই'}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${statusBadge}
            <button
              onclick="SettingsModule.spOpenPinModal('${escapedId}', '${escapedName}', '${escapedPhone}')"
              style="background:linear-gradient(135deg,rgba(245,158,11,0.8),rgba(217,119,6,0.8));
                     border:none;border-radius:8px;padding:8px 14px;
                     color:#0b0f19;font-size:0.82rem;font-weight:700;cursor:pointer;
                     display:flex;align-items:center;gap:6px;white-space:nowrap">
              <i class="fa fa-key"></i> ${hasAccess ? 'আপডেট করুন' : 'Access দিন'}
            </button>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
                  border-radius:14px;overflow:hidden">
        <div style="padding:12px 16px;background:rgba(255,255,255,0.03);
                    border-bottom:1px solid rgba(255,255,255,0.07);
                    font-size:0.8rem;color:#6b7280;display:flex;gap:20px">
          <span><i class="fa fa-users"></i> মোট ${students.length} জন student</span>
          <span><i class="fa fa-check"></i> ${Object.keys(accessMap).length} জনের access সচল</span>
        </div>
        ${rows}
      </div>`;
  }

  function spFilterStudents(query) {
    const searchInput = document.getElementById('sp-search-input');
    if (searchInput && query !== undefined) searchInput.value = query;
    if (!query || query.trim() === '') {
      _spRenderStudentList();
      return;
    }
    const q = query.toLowerCase();
    const filtered = _spAllStudents.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
    _spRenderList(filtered);
  }

  function spSetFilter(mode) {
    // Update button styles
    const btnAll    = document.getElementById('sp-filter-all');
    const btnAccess = document.getElementById('sp-filter-access');
    if (btnAll)    btnAll.style.background    = mode === 'all'    ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.06)';
    if (btnAll)    btnAll.style.color         = mode === 'all'    ? '#0b0f19' : '#aaa';
    if (btnAccess) btnAccess.style.background = mode === 'access' ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.06)';
    if (btnAccess) btnAccess.style.color      = mode === 'access' ? '#fff' : '#10b981';

    const searchInput = document.getElementById('sp-search-input');
    if (searchInput) searchInput.value = '';

    if (mode === 'access') {
      // Show only students who have portal access
      let accessMap = {};
      try {
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
          const accessList = SupabaseSync.getAll('student_portal_access') || [];
          accessList.forEach(a => { accessMap[a.student_id] = a; });
        }
      } catch { /* ignore */ }
      const accessStudents = _spAllStudents.filter(s => !!accessMap[s.id]);
      _spRenderList(accessStudents);
    } else {
      _spRenderStudentList();
    }
  }

  function spOpenPinModal(studentId, studentName, phone) {
    const modal = document.getElementById('sp-pin-modal');
    if (!modal) return;

    document.getElementById('sp-modal-student-id').value = studentId;
    document.getElementById('sp-modal-student-name-val').value = studentName;
    document.getElementById('sp-modal-phone-input').value = phone || '';
    document.getElementById('sp-modal-student-name').textContent =
      `Student: ${studentName} (ID: ${studentId})`;
    document.getElementById('sp-modal-pin-input').value = '';
    document.getElementById('sp-modal-active').checked = true;
    document.getElementById('sp-modal-error').style.display = 'none';

    // Check existing access for this student
    try {
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.getAll) {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        const existing = accessList.find(a => a.student_id === studentId);
        if (existing) {
          document.getElementById('sp-modal-phone-input').value = existing.phone || phone || '';
          document.getElementById('sp-modal-active').checked = existing.is_active !== false;
        }
      }
    } catch { /* ignore */ }

    modal.style.display = 'flex';
  }

  function spClosePinModal() {
    const modal = document.getElementById('sp-pin-modal');
    if (modal) modal.style.display = 'none';
  }

  async function spSavePortalAccess() {
    const errEl = document.getElementById('sp-modal-error');
    const saveBtn = document.getElementById('sp-modal-save-btn');
    errEl.style.display = 'none';

    const studentId   = document.getElementById('sp-modal-student-id').value.trim();
    const studentName = document.getElementById('sp-modal-student-name-val').value.trim();
    const phone       = document.getElementById('sp-modal-phone-input').value.replace(/[\s-]/g, '');
    const pin         = document.getElementById('sp-modal-pin-input').value.trim();
    const isActive    = document.getElementById('sp-modal-active').checked;

    // Validation
    if (!phone || phone.length < 10) {
      errEl.textContent = '⚠️ বৈধ মোবাইল নম্বর দিন (কমপক্ষে ১০ ডিজিট)।';
      errEl.style.display = 'block';
      return;
    }
    if (!pin) {
      errEl.textContent = '⚠️ 4-ডিজিট PIN লিখুন।';
      errEl.style.display = 'block';
      return;
    }
    if (pin.length !== 4 || isNaN(pin)) {
      errEl.textContent = '⚠️ PIN অবশ্যই ঠিক 4টি সংখ্যা হতে হবে।';
      errEl.style.display = 'block';
      return;
    }

    // Loading state
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> সেভ হচ্ছে...';

    try {
      // Hash the PIN using StudentAuth if available, otherwise fallback
      let pinHash;
      if (window.StudentAuth && window.StudentAuth.hashPin) {
        pinHash = await window.StudentAuth.hashPin(pin);
      } else {
        // Fallback SHA-256
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
        pinHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      }

      // Upsert locally via SupabaseSync (which automatically pushes to Supabase in the background)
      if (typeof SupabaseSync !== 'undefined') {
        const accessList = SupabaseSync.getAll('student_portal_access') || [];
        const existing = accessList.find(a => a.student_id === studentId);

        const record = {
          student_id:   studentId,
          student_name: studentName,
          phone:        phone,
          pin_hash:     pinHash,
          is_active:    isActive,
        };

        if (existing && existing.id) {
          SupabaseSync.update('student_portal_access', existing.id, record);
        } else {
          record.id = SupabaseSync.generateId();
          record.created_at = new Date().toISOString();
          SupabaseSync.insert('student_portal_access', record);
        }
      } else {
        throw new Error('SupabaseSync module is not loaded.');
      }

      spClosePinModal();
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`✅ ${studentName}-এর portal access সেভ হয়েছে!`, 'success');
      }
      // Refresh list
      setTimeout(() => _spRenderStudentList(), 300);

    } catch (err) {
      console.error('[StudentPortal] Save error:', err);
      errEl.textContent = '❌ সেভ ব্যর্থ: ' + (err.message || err);
      errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHTML;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════
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
    // Student Portal
    spFilterStudents, spSetFilter, spOpenPinModal, spClosePinModal, spSavePortalAccess,
  };
})();

// ── S2 Fix: Restore saved theme + sidebar + colors BEFORE exporting the module ──
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
    { id: 'navy',   name: '🌑 Deep Navy',  cardBg: 'rgba(8,12,40,0.88)', border: 'rgba(0,217,255,0.15)', inner: 'rgba(6,9,28,0.96)', anaBg: 'rgba(5,8,26,0.92)' },
    { id: 'obsidian',name: '🌌 Obsidian',   cardBg: 'rgba(8,10,14,0.92)', border: 'rgba(0,243,255,0.15)', inner: 'rgba(5,6,8,0.96)', anaBg: 'rgba(6,8,10,0.95)' },
    { id: 'maroon', name: '🔥 Cyber Maroon',cardBg: 'rgba(24,5,10,0.88)', border: 'rgba(255,0,85,0.2)', inner: 'rgba(16,4,8,0.96)', anaBg: 'rgba(18,4,8,0.92)' },
    { id: 'purple', name: '💜 Royal Void', cardBg: 'rgba(16,8,32,0.90)', border: 'rgba(181,55,242,0.2)', inner: 'rgba(10,5,20,0.96)', anaBg: 'rgba(14,6,26,0.92)' },
    { id: 'emerald',name: '🌿 Deep Jade',  cardBg: 'rgba(4,16,10,0.88)', border: 'rgba(0,255,136,0.15)', inner: 'rgba(2,10,6,0.96)', anaBg: 'rgba(3,12,8,0.92)' }
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

// ✅ S-2 Fix: Export after theme CSS injections are complete (regression fix — export was accidentally removed)
window.SettingsModule = SettingsModule;

/* ============================================================
   Feature 4 — SMS Settings Panel (injected into SettingsModule)
   ============================================================ */
(function _injectSMSPanel() {
  // panel HTML builder
  window._panelSMSSettings_html = function() {
    const cfg = (typeof SMSEngine !== 'undefined') ? SMSEngine.getConfig() : {};
    const chk = (val) => val ? 'checked' : '';
    return `
      <div data-panel="sms-settings" class="settings-panel" style="display:none;">
        <div class="card" style="margin-bottom:18px;">
          <div class="card-header" style="display:flex;align-items:center;gap:10px;">
            <i class="fa fa-comment-sms" style="color:var(--brand-primary);font-size:1.2rem;"></i>
            <h3 class="card-title" style="margin:0;">SMS Notification সেটিংস</h3>
          </div>
          <div class="card-body" style="padding:18px;">

            <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:0.83rem;">
              <strong><i class="fa fa-triangle-exclamation" style="color:#f59e0b;"></i> Green Web BD API</strong><br>
              <a href="https://greenweb.com.bd" target="_blank" style="color:var(--brand-primary);">greenweb.com.bd</a>-এ account খুলুন → API Token নিন → এখানে বসান।
              প্রতি SMS ≈ ৳০.৩০–০.৫০।
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
              <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label">API Key (Green Web BD Token) <span style="color:red">*</span></label>
                <input id="sms-api-key" class="form-control" type="password" placeholder="আপনার API Token" value="${Utils.escAttr(cfg.api_key||'')}">
              </div>
              <div class="form-group">
                <label class="form-label">Sender ID</label>
                <input id="sms-sender-id" class="form-control" placeholder="WFA" value="${Utils.escAttr(cfg.sender_id||'WFA')}">
              </div>
              <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:22px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
                  <input type="checkbox" id="sms-enabled" ${chk(cfg.sms_enabled)} style="width:18px;height:18px;accent-color:var(--brand-primary);">
                  SMS চালু করুন (Global)
                </label>
              </div>
            </div>

            <fieldset style="border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:8px;padding:14px;margin-bottom:16px;">
              <legend style="padding:0 8px;font-size:0.85rem;color:var(--text-secondary);">কোন কোন ক্ষেত্রে SMS যাবে</legend>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${[
                  ['sms-fee-due', 'fee_due_sms', 'fa-money-bill', 'ফি বকেয়া থাকলে'],
                  ['sms-absent', 'absent_sms', 'fa-user-xmark', 'Absent হলে'],
                  ['sms-result', 'result_sms', 'fa-file-signature', 'ফলাফল দেওয়া হলে'],
                  ['sms-payment', 'payment_sms', 'fa-mobile-screen', 'Payment Approve/Reject হলে'],
                ].map(([id, key, icon, label]) => `
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;">
                    <input type="checkbox" id="${id}" ${chk(cfg[key])} style="width:16px;height:16px;accent-color:var(--brand-primary);">
                    <i class="fa ${icon}" style="color:var(--brand-primary);width:16px;text-align:center;"></i>
                    ${label}
                  </label>`).join('')}
              </div>
            </fieldset>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
              <button class="btn btn-primary" onclick="_smsSaveConfig()">
                <i class="fa fa-save"></i> সেটিংস সেভ করুন
              </button>
              <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:200px;">
                <input id="sms-test-phone" class="form-control" placeholder="01XXXXXXXXX" style="flex:1;">
                <button class="btn btn-secondary" onclick="_smsSendTest()">
                  <i class="fa fa-paper-plane"></i> টেস্ট SMS
                </button>
              </div>
            </div>

            <hr style="border-color:var(--border-color,rgba(255,255,255,0.1));margin:16px 0;">
            <h4 style="margin:0 0 10px;font-size:0.9rem;color:var(--text-secondary);">
              <i class="fa fa-clock-rotate-left"></i> SMS Log (সর্বশেষ ৫০টি)
            </h4>
            <div id="sms-log-container">
              <div style="text-align:center;padding:20px;color:var(--text-muted);">
                <i class="fa fa-spinner fa-spin"></i> লোড হচ্ছে...
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  };

  // Save config
  function _smsSaveConfig() {
    if (typeof SMSEngine === 'undefined') { alert('SMS Engine লোড হয়নি।'); return; }
    const cfg = {
      api_key:     (document.getElementById('sms-api-key')?.value || '').trim(),
      sender_id:   (document.getElementById('sms-sender-id')?.value || 'WFA').trim(),
      sms_enabled: document.getElementById('sms-enabled')?.checked || false,
      fee_due_sms: document.getElementById('sms-fee-due')?.checked || false,
      absent_sms:  document.getElementById('sms-absent')?.checked  || false,
      result_sms:  document.getElementById('sms-result')?.checked  || false,
      payment_sms: document.getElementById('sms-payment')?.checked || false,
    };
    SMSEngine.saveConfig(cfg);
  }
  window._smsSaveConfig = _smsSaveConfig;

  // Test SMS
  async function _smsSendTest() {
    if (typeof SMSEngine === 'undefined') { alert('SMS Engine লোড হয়নি।'); return; }
    const phone = (document.getElementById('sms-test-phone')?.value || '').trim();
    if (!phone) { Utils.toast('ফোন নম্বর দিন।', 'error'); return; }
    Utils.toast('টেস্ট SMS পাঠানো হচ্ছে...', 'info');
    const result = await SMSEngine.sendTest(phone);
    if (result.ok) {
      Utils.toast('টেস্ট SMS সফলভাবে পাঠানো হয়েছে!', 'success');
    } else {
      Utils.toast('SMS পাঠাতে সমস্যা: ' + (result.reason || 'unknown'), 'error');
    }
    _smsRefreshLog();
  }
  window._smsSendTest = _smsSendTest;

  // Refresh log table
  function _smsRefreshLog() {
    const container = document.getElementById('sms-log-container');
    if (!container) return;
    if (typeof SMSEngine === 'undefined') {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">SMS Engine লোড হয়নি।</p>';
      return;
    }
    const logs = SMSEngine.getLogs().slice(0, 50);
    if (!logs.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">কোনো SMS লগ নেই।</p>';
      return;
    }
    const statusColor = { sent: '#10b981', failed: '#ef4444', skipped: '#f59e0b', pending: '#6b7280' };
    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;font-size:0.8rem;">
          <thead><tr>
            <th>সময়</th><th>প্রাপক</th><th>ধরন</th><th>বার্তা</th><th style="text-align:center;">স্ট্যাটাস</th>
          </tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td style="white-space:nowrap;">${Utils.esc(l.sent_at ? new Date(l.sent_at).toLocaleString('bn-BD') : '—')}</td>
                <td>${Utils.esc(l.recipient||'—')}</td>
                <td><span class="badge badge-blue" style="font-size:0.72rem;">${Utils.esc(l.type||'—')}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escAttr(l.message||'')}">${Utils.esc((l.message||'').slice(0,60))}…</td>
                <td style="text-align:center;">
                  <span style="font-size:0.75rem;font-weight:700;color:${statusColor[l.status]||'#aaa'};">${Utils.esc(l.status||'—')}</span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  window._smsRefreshLog = _smsRefreshLog;
})();
