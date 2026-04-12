// ============================================================
// Wings Fly Aviation Academy — Settings Module (Full Parity)
// 11 Tabs matching legacy app design
// ============================================================

const SettingsModule = (() => {

  let activeTab = 'general';
  let isOpen = false;
  let _syncListener = null; // wfa:synced listener reference — closeModal-এ remove করার জন্য

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

    // ── Real-time Activity Log refresh ────────────────────────────
    // Settings panel খোলা থাকলে যেকোনো কাজ করলে activity log ও
    // অন্যান্য tabs real-time-এ আপডেট হবে
    if (_syncListener) {
      window.removeEventListener('wfa:synced', _syncListener);
    }
    _syncListener = () => {
      const panel = document.getElementById('settings-overlay');
      if (!panel) return;
      // শুধু active tab re-render করো — পুরো modal rebuild করলে scroll/focus হারায়
      const savedTab = activeTab;
      panel.innerHTML = buildModalHTML();
      activeTab = savedTab;
      switchTab(savedTab);
    };
    window.addEventListener('wfa:synced', _syncListener);
  }

  function closeModal() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
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
      { id: 'theme',         icon: 'fa-palette',             label: '🎨 Theme / Appearance' },
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
      { id: 'syncguard',     icon: 'fa-shield-halved',       label: 'Sync Guard' },
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
      ${panelTheme()}
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
      ${panelSyncGuard()}
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
    // Auto-render SyncGuard panel when tab is activated
    if (tab === 'syncguard' && typeof SyncGuard !== 'undefined') {
      setTimeout(() => SyncGuard.renderPanel('syncguard-panel'), 50);
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
        ${THEMES.map(t => `
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
          (বর্তমান থিম: <i class="fa fa-circle" style="font-size:.6rem"></i> ${THEMES.find(t=>t.id===currentTheme)?.emoji} ${THEMES.find(t=>t.id===currentTheme)?.name})
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

    </div>`;
  }

  function buildColorCustomizerHTML(themeId, styleId) {
    const key = `wfa_sidebar_custom_${themeId}_${styleId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
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
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;
    // Remove all theme classes
    THEMES.forEach(t => document.body.classList.remove(`theme-${t.id}`));
    document.body.classList.add(`theme-${themeId}`);
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
        const s = JSON.parse(sideSavedJSON);
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

  function panelGeneral() {
    const cfg = getConfig();
    const students = SupabaseSync.getAll(DB.students);
    const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();
    const today = new Date().toISOString().split('T')[0];
    const expStart = cfg.expense_start_date || today;
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
      <!-- ── Storage Usage Indicator ──────────────────────────────── -->
      <div class="settings-card" style="border-color:rgba(0,212,255,0.25);margin-bottom:14px" id="storage-usage-card">
        <div class="settings-card-title"><i class="fa fa-hard-drive"></i> Local Storage Usage</div>
        <div id="storage-usage-content" style="font-size:.88rem;color:var(--text-secondary)">
          <i class="fa fa-spinner fa-spin"></i> Calculating...
        </div>
      </div>
      <script>
        (function() {
          try {
            let totalBytes = 0;
            const breakdown = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              const val = localStorage.getItem(key) || '';
              const bytes = (key.length + val.length) * 2; // UTF-16
              totalBytes += bytes;
              if (key.startsWith('wfa_')) breakdown.push({ key: key.replace('wfa_',''), bytes });
            }
            breakdown.sort((a,b) => b.bytes - a.bytes);
            const usedKB  = (totalBytes / 1024).toFixed(1);
            const limitKB = 5120; // 5MB estimate
            const pct     = Math.min(100, Math.round(totalBytes / (limitKB * 1024) * 100));
            const color   = pct >= 85 ? '#ff4757' : pct >= 60 ? '#ffa502' : '#00ff88';
            const topItems = breakdown.slice(0, 5).map(b =>
              '<div style="display:flex;justify-content:space-between;margin-top:4px">' +
              '<span style="color:var(--text-muted)">' + b.key + '</span>' +
              '<span style="font-family:monospace">' + (b.bytes/1024).toFixed(1) + ' KB</span></div>'
            ).join('');
            document.getElementById('storage-usage-content').innerHTML =
              '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                '<span>Used: <strong style="color:' + color + '">' + usedKB + ' KB</strong></span>' +
                '<span style="color:var(--text-muted)">~5 MB limit (' + pct + '%)</span>' +
              '</div>' +
              '<div style="background:rgba(255,255,255,0.05);border-radius:6px;height:10px;overflow:hidden;margin-bottom:10px">' +
                '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:6px;transition:width .4s"></div>' +
              '</div>' +
              (pct >= 85 ? '<div style="color:#ff4757;font-size:.82rem;margin-bottom:8px"><i class="fa fa-triangle-exclamation"></i> Storage প্রায় পূর্ণ! নিচে থেকে পুরনো data মুছুন।</div>' : '') +
              '<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">Top usage by table:</div>' +
              topItems;
          } catch(e) {
            document.getElementById('storage-usage-content').textContent = 'Storage info দেখা যাচ্ছে না।';
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
          <button class="settings-btn-lg btn-export" style="border-color:var(--text-muted);color:var(--text-muted)" onclick="SettingsModule.importFromJSON()">
            <i class="fa fa-cloud-arrow-up"></i> IMPORT DATA
          </button>
        </div>
        <button class="settings-btn-lg btn-sync-cloud" onclick="SyncEngine.syncAll({ forcePush: true }).then(()=>Utils.toast('Cloud sync complete','success'))">
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem; background:rgba(0,0,0,0.1); padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.05)">
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-students" checked class="custom-chk"> <span>🏆 Students</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-finance" class="custom-chk"> <span>💰 Finance/Ledger</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-accounts" class="custom-chk"> <span>📊 Accounts</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-loans" class="custom-chk"> <span>💳 Loans</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-exams" class="custom-chk"> <span>📝 Exams</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-hr" class="custom-chk"> <span>👥 HR / Staff</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-salary" class="custom-chk"> <span>💵 Salary Hub</span></label>
               <label style="display:flex; align-items:center; gap:8px; cursor:pointer"><input type="checkbox" id="perm-visitors" class="custom-chk"> <span>👤 Visitors</span></label>
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
                  <td><i class="fa ${d.type === 'student' ? 'fa-user-graduate' : d.type === 'transaction' ? 'fa-money-bill' : d.type === 'staff' ? 'fa-user-tie' : d.type === 'visitor' ? 'fa-walking' : d.type === 'notice' ? 'fa-bullhorn' : d.type === 'account' ? 'fa-building-columns' : d.type === 'loan' ? 'fa-hand-holding-dollar' : d.type === 'exam' ? 'fa-file-lines' : 'fa-file'}"></i></td>
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
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-primary btn-sm" onclick="SyncEngine.syncAll({ silent: false })">⬇ Sync (retry + pull)</button>
          <button class="btn btn-accent btn-sm" onclick="SyncEngine.push({ silent: false })">⬆ Push to Cloud</button>
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
    const finance  = SupabaseSync.getAll(DB.finance);
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
            <input type="date" id="bp-start" class="form-control" value="${monthAgo}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="settings-label">EXPENSE END DATE</label>
            <input type="date" id="bp-end" class="form-control" value="${today}" />
          </div>
        </div>

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
    const start   = document.getElementById('bp-start')?.value || '';
    const end     = document.getElementById('bp-end')?.value || '';
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
    const studentIds = new Set(batchStudents.map(s => s.id || s.student_id));

    // ── Income: from student fees (finance entries for these students) ──
    const incomeEntries = finance.filter(f => {
      if (f.type !== 'Income' || f.category !== 'Student Fee') return false;
      // Match by ref_id (student DB id) or ref_id = student_id
      const matchById = studentIds.has(f.ref_id);
      const matchByStuId = batchStudents.some(s => s.student_id === f.ref_id);
      const inRange = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      return (matchById || matchByStuId) && inRange;
    });

    // Also count direct paid from student records
    const totalStudentFee  = batchStudents.reduce((s, st) => s + (parseFloat(st.total_fee) || 0), 0);
    const totalCollected   = batchStudents.reduce((s, st) => s + (parseFloat(st.paid) || 0), 0);
    const totalDue         = batchStudents.reduce((s, st) => s + (parseFloat(st.due) || 0), 0);

    // ── Expenses: by date range (batch-tagged or general) ──
    const expenseEntries = finance.filter(f => {
      if (f.type !== 'Expense') return false;
      const inRange = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      if (!inRange) return false;
      if (!selectedBatch) return true;
      // Include expenses tagged to this batch OR untagged general expenses
      return !f.batch || f.batch === selectedBatch;
    });

    const totalExpense = expenseEntries.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    // ── Other Income (non-student) in date range ──
    const otherIncomeEntries = finance.filter(f => {
      if (f.type !== 'Income' || f.category === 'Student Fee') return false;
      const inRange = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      return inRange;
    });
    const otherIncome = otherIncomeEntries.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    const grossIncome = totalCollected + otherIncome;
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
      batchStudents, expenseEntries, otherIncomeEntries,
      totalStudentFee, totalCollected, totalDue, totalExpense, otherIncome, grossIncome, netProfit,
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
          ${startDate ? ` &nbsp;|&nbsp; ${startDate} → ${endDate}` : ''}
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
            ${plRow('ছাত্রদের ফি সংগ্রহ', totalCollected, '#00ff88')}
            ${otherIncome > 0 ? plRow('অন্যান্য আয়', otherIncome, '#00ff88') : ''}
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
                    <td><strong>${s.name || '—'}</strong></td>
                    <td><span class="badge badge-primary">${s.student_id || '—'}</span></td>
                    <td>${s.batch || '—'}</td>
                    <td style="font-size:0.82rem;color:var(--text-secondary);">${s.course || '—'}</td>
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
          💸 খরচের বিস্তারিত (${startDate || '—'} থেকে ${endDate || '—'})
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>তারিখ</th><th>বিবরণ</th><th>ক্যাটাগরি</th><th>পদ্ধতি</th><th style="text-align:right;">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              ${expenseEntries.sort((a,b) => a.date > b.date ? 1 : -1).map((f, i) => `
                <tr>
                  <td style="text-align:center;color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
                  <td>${f.date || '—'}</td>
                  <td>${f.description || '—'}</td>
                  <td><span class="badge badge-secondary">${f.category || 'General'}</span></td>
                  <td>${f.method || '—'}</td>
                  <td style="text-align:right;font-weight:700;color:#ff9a00;">৳${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
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
    <h1>${academyName}</h1>
    <div class="sub">BATCH WISE PROFIT &amp; LOSS REPORT</div>
  </div>
  <div class="header-meta">
    <div class="big">Batch: ${batch}</div>
    ${startDate ? `<div>Expense Period: ${startDate} → ${endDate}</div>` : ''}
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
        <td style="font-weight:700;">${s.name || '—'}</td>
        <td><span class="badge badge-blue">${s.student_id || '—'}</span></td>
        <td>${s.batch || '—'}</td>
        <td style="color:#555;">${s.course || '—'}</td>
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
    ${expenseEntries.sort((a,b)=>a.date>b.date?1:-1).map((f, i) => `
      <tr>
        <td style="text-align:center;color:#777;">${i + 1}</td>
        <td>${f.date || '—'}</td>
        <td>${f.description || '—'}</td>
        <td>${f.category || 'General'}</td>
        <td>${f.method || '—'}</td>
        <td style="text-align:right;font-weight:700;color:#c2410c;">৳${(parseFloat(f.amount)||0).toLocaleString('en-IN')}</td>
      </tr>
    `).join('')}
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
  <div style="font-size:8px;color:#888;">${academyName}<br/>এটি একটি অফিসিয়াল আর্থিক রিপোর্ট।</div>
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
      'তারিখ': f.date || '',
      'বিবরণ': f.description || '',
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

    if (typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'ছাত্র বিবরণ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'খরচের বিবরণ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'P&L সারাংশ');
      XLSX.writeFile(wb, `batch-profit-${batch}-${new Date().toISOString().split('T')[0]}.xlsx`);
      if (typeof Utils !== 'undefined') Utils.toast('Excel Export সম্পন্ন ✓', 'success');
    } else {
      if (typeof Utils !== 'undefined') Utils.toast('XLSX library লোড হয়নি', 'error');
    }
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
                      <td style="padding:10px 8px;font-weight:700">${a.person || '—'}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">৳${(parseFloat(a.amount)||0).toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:#00d4ff">৳${a._totalReturned.toLocaleString()}</td>
                      <td style="padding:10px 8px;text-align:right;color:${isFullyReturned?'#00ff88':'#ff4757'};font-weight:700">৳${a._remaining.toLocaleString()}</td>
                      <td style="padding:10px 8px;font-size:.82rem"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:2px 8px;border-radius:20px;font-size:.75rem">${a.method || '—'}</span></td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-secondary)">${a.date || '—'}</td>
                      <td style="padding:10px 8px;font-size:.82rem;color:var(--text-muted)">${a.note || '—'}</td>
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
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
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
      btn.classList.toggle('active', (tab === 'advance' && i === 0) || (tab === 'investment' && i === 1));
    });
    const container = document.getElementById('accounts-mgmt-subtab-content');
    if (!container) return;
    if (tab === 'advance') {
      container.innerHTML = buildAdvancePaymentSection();
    } else {
      container.innerHTML = buildInvestmentSection();
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
          <div class="settings-card-title" style="margin-bottom:0"><i class="fa fa-chart-line"></i> DATA MONITOR</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--brand-primary);font-size:1rem;font-weight:700">Total records (all tables): ${totalRecords}</span>
            <button type="button" class="btn btn-outline btn-sm" onclick="SettingsModule.refreshMonitor()"><i class="fa fa-rotate"></i> Refresh</button>
          </div>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Last 10 local saves, updates, or deletes. Click a row to view that transaction's saved dashboard snapshot.</p>

        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>DATE</th><th>TYPE</th><th>CATEGORY</th><th>PERSON</th></tr></thead>
            <tbody>
              ${recentChanges.length === 0 ?
                `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No recent changes yet — add or edit data to populate this list.</td></tr>` :
                recentChanges.slice(0, 10).map((c, i) => {
                  const badgeCls = c.type === 'Delete' ? 'badge-error' : c.type === 'Update' ? 'badge-warning' : 'badge-success';
                  return `
                  <tr class="monitor-recent-row" style="cursor:pointer" onclick="SettingsModule.showMonitorSnapshot(${i})" title="Click for saved snapshot at this transaction">
                    <td>${i + 1}</td>
                    <td style="font-size:.82rem">${c.date || '—'}</td>
                    <td><span class="badge ${badgeCls}">${c.type || '—'}</span></td>
                    <td style="font-size:.82rem">${c.category || '—'}</td>
                    <td style="font-size:.82rem">${c.person || '—'}</td>
                  </tr>
                  <tr><td colspan="5" style="padding:0"><div class="monitor-bar" style="width:${Math.max(20, 100 - i * 8)}%"></div></td></tr>`;
                }).join('')
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

  // ─── Recycle Bin (wfa_recycle_bin — separate from sync tombstones wfa_deletedItems) ───
  function getDeletedItems() {
    try {
      const raw = JSON.parse(localStorage.getItem('wfa_recycle_bin') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function restoreItem(index) {
    SupabaseSync.restoreRecycleBinItem(index).then((ok) => {
      if (ok) {
        Utils.toast('Item restored and synced', 'success');
        refreshModal();
        if (typeof App !== 'undefined' && App.updateNotifCount) App.updateNotifCount();
      } else {
        Utils.toast('Could not restore item', 'error');
      }
    });
  }

  function permanentDelete(index) {
    SupabaseSync.permanentDeleteRecycleBinItem(index);
    Utils.toast('Removed from recycle bin', 'info');
    refreshModal();
  }

  function emptyRecycleBin() {
    SupabaseSync.emptyRecycleBin();
    Utils.toast('Recycle bin emptied', 'info');
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

  // ─── Settings-এর ভেতরে নিজস্ব modal (z-index সমস্যা সমাধান) ───
  function openSettingsInternalModal(title, bodyHTML) {
    const old = document.getElementById('settings-inner-modal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'settings-inner-modal';
    wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:999999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);';
    wrap.innerHTML = `
      <div style="background:var(--bg-surface,#0e1628);border:1px solid rgba(0,212,255,0.25);border-radius:14px;padding:28px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.7);position:relative;animation:fadeUp .2s ease;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div style="font-size:1rem;font-weight:800;color:#fff">${title}</div>
          <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        ${bodyHTML}
      </div>`;
    wrap.addEventListener('click', e => { if (e.target === wrap) closeSettingsInternalModal(); });
    document.body.appendChild(wrap);
  }

  function closeSettingsInternalModal() {
    const el = document.getElementById('settings-inner-modal');
    if (el) el.remove();
  }

  // ─── Advance Payments & Investments ───────────────────────────
  function addAdvancePayment() {
    openSettingsInternalModal('💰 Add Advance Payment', `
      <div style="margin-bottom:12px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Person Name <span style="color:#ff4757">*</span></label>
        <input id="adv-person" class="form-control" placeholder="e.g. Shakib" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Amount (৳) <span style="color:#ff4757">*</span></label>
          <input id="adv-amount" type="number" class="form-control" placeholder="0" />
        </div>
        <div>
          <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Date <span style="color:#ff4757">*</span></label>
          <input id="adv-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Payment Method <span style="color:#ff4757">*</span></label>
        <select id="adv-method" class="form-control" style="width:100%">
          <option value="">Select Method</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Note</label>
        <input id="adv-note" class="form-control" placeholder="Optional" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 18px;border-radius:8px;cursor:pointer">Cancel</button>
        <button onclick="SettingsModule.saveAdvancePayment()" style="background:linear-gradient(135deg,#00ff88,#00cc6e);color:#000;font-weight:800;padding:8px 22px;border-radius:8px;cursor:pointer;border:none"><i class="fa fa-check"></i> Save</button>
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
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    advances.push({ person, amount, method, date, note, returns: [] });
    localStorage.setItem('wfa_advance_payments', JSON.stringify(advances));
    SupabaseSync.insert(DB.finance, {
      type: 'Expense', method, category: 'Advance Payment',
      description: `Advance to ${person}`, amount, date, note
    });
    closeSettingsInternalModal();
    Utils.toast('Advance payment saved ✓', 'success');
    refreshModal();
  }

  function deleteAdvance(idx) {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    if (!advances[idx]) return;
    if (!confirm(`Delete advance for "${advances[idx].person}"?`)) return;
    advances.splice(idx, 1);
    localStorage.setItem('wfa_advance_payments', JSON.stringify(advances));
    Utils.toast('Deleted', 'info');
    refreshModal();
  }

  function openReturnAdvanceModal(idx) {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    const a = advances[idx];
    if (!a) return;
    const returns = a.returns || [];
    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const remaining = (parseFloat(a.amount) || 0) - totalReturned;
    openSettingsInternalModal(`↩️ Return Advance — ${a.person}`, `
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
    const advances  = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
    const a = advances[idx];
    if (!a) return;
    const totalReturned = (a.returns||[]).reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(a.amount)||0) - totalReturned;
    if (!retAmount || retAmount <= 0) { Utils.toast('Return amount required', 'error'); return; }
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining ৳${remaining.toLocaleString()}`, 'error'); return; }
    if (!advances[idx].returns) advances[idx].returns = [];
    advances[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    localStorage.setItem('wfa_advance_payments', JSON.stringify(advances));
    SupabaseSync.insert(DB.finance, {
      type: 'Income', method: retMethod, category: 'Advance Return',
      description: `Advance return from ${a.person}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of ৳${retAmount.toLocaleString()} recorded ✓`, 'success');
    refreshModal();
  }

  function viewAdvanceLedger(idx) {
    const advances = JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]');
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
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${a.method}</td>
        <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${a.note||'—'}</td>
      </tr>`,
      ...returns.map((r, ri) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.date}</td>
          <td style="padding:10px 8px"><span style="background:rgba(0,255,136,0.15);color:#00ff88;padding:2px 8px;border-radius:20px;font-size:.75rem">Return #${ri+1}</span></td>
          <td style="padding:10px 8px;text-align:right;color:#00ff88;font-weight:700">+৳${(parseFloat(r.amount)||0).toLocaleString()}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.method||'—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.note||'—'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`📋 Advance Ledger — ${a.person}`, `
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
      <div style="margin-bottom:12px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Investor / Source <span style="color:#ff4757">*</span></label>
        <input id="inv-source" class="form-control" placeholder="e.g. Rahim, Company XYZ" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Amount (৳) <span style="color:#ff4757">*</span></label>
          <input id="inv-amount" type="number" class="form-control" placeholder="0" />
        </div>
        <div>
          <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Date <span style="color:#ff4757">*</span></label>
          <input id="inv-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Deposit To (Account) <span style="color:#ff4757">*</span></label>
        <select id="inv-method" class="form-control" style="width:100%">
          <option value="">Select Account</option>
          ${Utils.getPaymentMethodsHTML ? Utils.getPaymentMethodsHTML() : '<option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Mobile Banking">Mobile Banking</option>'}
        </select>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:.85rem;color:var(--text-secondary);margin-bottom:6px;display:block">Note</label>
        <input id="inv-note" class="form-control" placeholder="Optional" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="SettingsModule.closeSettingsInternalModal()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#aaa;padding:8px 18px;border-radius:8px;cursor:pointer">Cancel</button>
        <button onclick="SettingsModule.saveInvestment()" style="background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:800;padding:8px 22px;border-radius:8px;cursor:pointer;border:none"><i class="fa fa-check"></i> Save</button>
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
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
    investments.push({ source, amount, method, date, note, returns: [] });
    localStorage.setItem('wfa_investments', JSON.stringify(investments));
    SupabaseSync.insert(DB.finance, {
      type: 'Income', method, category: 'Investment Receiving',
      description: `Investment from ${source}`, amount, date, note
    });
    closeSettingsInternalModal();
    Utils.toast('Investment saved ✓', 'success');
    refreshModal();
  }

  function deleteInvestment(idx) {
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
    if (!investments[idx]) return;
    if (!confirm(`Delete investment from "${investments[idx].source}"?`)) return;
    investments.splice(idx, 1);
    localStorage.setItem('wfa_investments', JSON.stringify(investments));
    Utils.toast('Deleted', 'info');
    refreshModal();
  }

  function openReturnInvestmentModal(idx) {
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
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
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
    const inv = investments[idx];
    if (!inv) return;
    const totalReturned = (inv.returns||[]).reduce((s, r) => s + (parseFloat(r.amount)||0), 0);
    const remaining = (parseFloat(inv.amount)||0) - totalReturned;
    if (!retAmount || retAmount <= 0) { Utils.toast('Return amount required', 'error'); return; }
    if (retAmount > remaining) { Utils.toast(`Cannot exceed remaining ৳${remaining.toLocaleString()}`, 'error'); return; }
    if (!investments[idx].returns) investments[idx].returns = [];
    investments[idx].returns.push({ amount: retAmount, date: retDate, method: retMethod, note: retNote });
    localStorage.setItem('wfa_investments', JSON.stringify(investments));
    SupabaseSync.insert(DB.finance, {
      type: 'Expense', method: retMethod, category: 'Investment Return',
      description: `Investment return to ${inv.source}`, amount: retAmount, date: retDate, note: retNote
    });
    closeSettingsInternalModal();
    Utils.toast(`Return of ৳${retAmount.toLocaleString()} recorded ✓`, 'success');
    refreshModal();
  }

  function viewInvestmentLedger(idx) {
    const investments = JSON.parse(localStorage.getItem('wfa_investments') || '[]');
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
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.method||'—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted);font-size:.82rem">${r.note||'—'}</td>
        </tr>`)
    ].join('');
    openSettingsInternalModal(`📋 Investment Ledger — ${inv.source}`, `
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

  function showMonitorSnapshot(index) {
    const recentChanges = JSON.parse(localStorage.getItem('wfa_recent_changes') || '[]');
    const item = recentChanges[index];
    if (!item) return showLiveAccountSnapshot();

    const snapshot = item.snapshot || {};
    const students = snapshot.students || {};
    const accounts = snapshot.accounts || {};
    const finance = snapshot.finance || {};
    const rows = `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:12px;margin-bottom:16px">
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Students</div>
          <div style="font-size:1.4rem;font-weight:700">${students.totalStudents || 0}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Total Fee</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(students.totalFee || 0)}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Paid</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(students.totalPaid || 0)}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Due</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(students.totalDue || 0)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:12px;margin-bottom:16px">
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Accounts</div>
          <div style="font-size:1.4rem;font-weight:700">${accounts.count || 0}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Account Balance</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(accounts.totalBalance || 0)}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Income</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(finance.totalIncome || 0)}</div>
        </div>
        <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Expense</div>
          <div style="font-size:1.4rem;font-weight:700">${Utils.takaEn(finance.totalExpense || 0)}</div>
        </div>
      </div>
    `;

    Utils.openModal(`Snapshot for ${item.type || 'Transaction'} — ${item.category || 'Unknown'}`, `
      <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:8px">Saved at ${item.date || '—'} — ${item.person || 'N/A'} / ${item.item || 'Record'}</p>
      ${rows}
      <div style="font-size:.85rem;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.08);padding-top:12px">
        This snapshot shows the dashboard-like totals saved when the transaction was logged locally.
      </div>
    `, 'modal-lg');
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

        // Track which tables received new data
        const touchedTables = new Set();

        const isLegacy = data.hasOwnProperty('employees') ||
                         data.hasOwnProperty('cashBalance') ||
                         data.hasOwnProperty('incomeCategories') ||
                         (data.students && data.students[0] && data.students[0].studentId);

        if (isLegacy) {
          Utils.toast('Legacy backup detected — converting...', 'info');
          imported = await importLegacyData(data, statusEl);
          // Legacy importer can touch many tables
          Object.values(DB).forEach(t => {
            if (SupabaseSync.getAll(t).length > 0) touchedTables.add(t);
          });
        } else {
          const tableAliases = {
            finance: DB.finance,
            financeLedger: DB.finance,
            ledger: DB.finance,
            staff: DB.staff,
            employees: DB.staff,
          };
          for (const [tableName, rows] of Object.entries(data)) {
            if (tableName === 'meta' || tableName === 'version' || tableName === 'exportedAt') continue;
            if (!Array.isArray(rows) || !rows.length) continue;
            const targetTable = tableAliases[tableName] || tableName;
            const existing = SupabaseSync.getAll(targetTable);
            const existingIds = new Set(existing.map(r => r.id));
            const newRows = rows.filter(r => r && r.id && !existingIds.has(r.id));
            if (newRows.length > 0) {
              SupabaseSync.setAll(targetTable, [...newRows, ...existing]);
              imported += newRows.length;
              touchedTables.add(targetTable);
            }
          }
        }

        if (statusEl) statusEl.innerHTML = `✅ Import complete! ${imported} records imported locally.`;
        Utils.toast(`Import complete! ${imported} records imported`, 'success');

        if (imported > 0) {
          if (statusEl) statusEl.innerHTML += '<br>🔄 Pushing to cloud table-by-table...';

          // Push table by table with individual status
          const pushResult = await SyncEngine.push({ silent: true });

          if (pushResult?.ok) {
            if (statusEl) statusEl.innerHTML += '<br>✅ All data synced to cloud successfully!';
            Utils.toast('Backup uploaded to Supabase ✅', 'success');
          } else {
            // Show partial success info
            const sc = pushResult?.successCount || 0;
            const errs = pushResult?.errors || [];
            let statusHTML = '';

            if (sc > 0) {
              statusHTML += `<br>✅ <span style="color:var(--success)">${sc} table(s) synced successfully</span>`;
            }

            if (errs.length > 0) {
              statusHTML += `<br>⚠️ <span style="color:var(--warning)">${errs.length} table(s) had issues:</span>`;
              errs.forEach(err => {
                const tbl = err.table || '?';
                const msg = String(err.error || '').replace(/</g, '&lt;');
                // Check if it's a "column does not exist" error and extract column name
                const colMatch = msg.match(/column\s+"([^"]+)"/i);
                const hint = colMatch
                  ? `<br><small style="color:var(--text-muted)">💡 Fix: In Supabase SQL Editor, run: <code>ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS "${colMatch[1]}" text;</code></small>`
                  : '';
                statusHTML += `<br><span style="color:var(--error);font-size:0.8rem">• ${tbl}: ${msg}</span>${hint}`;
              });
              statusHTML += `<br><br><button class="btn btn-outline" style="font-size:0.8rem;padding:6px 14px" onclick="SyncEngine.push().then(r => { if(r.ok) Utils.toast('Push successful!','success'); else Utils.toast('Still failing — check console (F12)','error'); })">🔄 Retry Push</button>`;
            }

            if (statusEl) statusEl.innerHTML += statusHTML;
            Utils.toast(
              sc > 0
                ? `Import done — ${sc} table(s) synced, ${errs.length} need attention`
                : 'Import saved locally — cloud push failed (see status below)',
              'warn'
            );
          }
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
        person_name: f.person_name || f.person || '',
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
        const nm = b.name || b.bankName || 'Bank';
        accountEntries.push({
          id: SupabaseSync.generateId(),
          type: 'Bank_Detail',
          name: nm,
          balance: b.balance || b.amount || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    }
    if (data.mobileBanking) {
      const bal = typeof data.mobileBanking === 'object' ? (data.mobileBanking.balance || data.mobileBanking.amount || 0) : data.mobileBanking;
      const mbName = (typeof data.mobileBanking === 'object' && data.mobileBanking.name) ? data.mobileBanking.name : 'Mobile Banking';
      accountEntries.push({ id: SupabaseSync.generateId(), type: 'Mobile_Detail', name: mbName, balance: bal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
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
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch {}
      }
    } catch {}

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
        try { await client.from(tableName).delete().neq('id', '__never_match__'); } catch {}
      }
      Utils.toast('Cloud data deleted', 'info');
    } catch (e) {
      Utils.toast('Failed: ' + e.message, 'error');
    }
  }

  // ── Auto Snapshots ──────────────────────────────────────────────
  function getSnapshots() {
    return JSON.parse(localStorage.getItem('wfa_auto_snapshots') || '[]');
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
        data[DB[key]] = SupabaseSync.getAll(DB[key]);
      });
    }

    snapshots.unshift({
      id: 'snap_' + Date.now(),
      timestamp: now.toISOString(),
      displayDate: typeof Utils !== 'undefined' ? Utils.formatDateEN(now.toISOString()) + ', ' + now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : now.toLocaleString(),
      manual: manual,
      data: data
    });

    if (snapshots.length > 7) snapshots.length = 7; 

    localStorage.setItem('wfa_auto_snapshots', JSON.stringify(snapshots));
    if (manual) {
      if (typeof Utils !== 'undefined') Utils.toast('📸 Manual Snapshot Saved', 'success');
      refreshModal();
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
    localStorage.setItem('wfa_auto_snapshots', JSON.stringify(snapshots));
    if(typeof Utils !== 'undefined') Utils.toast('Snapshot deleted', 'info');
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
             <span class="badge" style="background:rgba(0,217,255,0.15);color:var(--brand-primary);border-radius:20px;padding:3px 12px;font-size:0.75rem;border:1px solid rgba(0,217,255,0.3)">LAST 7 রাখা হয়</span>
           </div>
           <button class="btn btn-outline" style="border-color:var(--brand-cyan);color:var(--brand-primary);font-size:0.85rem;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px;box-shadow:0 0 10px rgba(0,217,255,0.2)" onclick="SettingsModule.saveSnapshot(true)">
              <i class="fa fa-camera-retro"></i> এখনই নিন
           </button>
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

  function getSubAccounts() {
     return JSON.parse(localStorage.getItem('wfa_sub_accounts') || '[]');
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
    } catch (e) {
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
      localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
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
                  <td style="padding:8px 0; color:var(--brand-cyan)">@${s.username}</td>
                  <td style="padding:8px 0; color:var(--text-muted); max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${s.permissions.join(', ')}">
                    ${s.permissions.length ? s.permissions.join(', ') : '<span style="color:var(--error)">No Access</span>'}
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

     const permissions = [];
     const permsMap = {
        'perm-students': 'Students',
        'perm-finance': 'Finance/Ledger',
        'perm-accounts': 'Accounts',
        'perm-loans': 'Loans',
        'perm-exams': 'Exams',
        'perm-hr': 'HR / Staff',
        'perm-salary': 'Salary Hub',
        'perm-visitors': 'Visitors'
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

     subs.push({
        username: un,
        password: hashedPw,   // SHA-256 hashed — plaintext কখনো store হয় না
        permissions: permissions
     });
     localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
     
     logActivity('add', 'security', `Added sub-account @${un}`);
     if(typeof Utils !== 'undefined') Utils.toast('Sub-account created ✅', 'success');
     refreshModal();
  }

  function deleteSubAccount(idx) {
     const subs = getSubAccounts();
     const target = subs[idx];
     if(target) {
        subs.splice(idx, 1);
        localStorage.setItem('wfa_sub_accounts', JSON.stringify(subs));
        logActivity('delete', 'security', `Deleted sub-account @${target.username}`);
        if(typeof Utils !== 'undefined') Utils.toast('Sub-account deleted', 'info');
        refreshModal();
     }
  }

  // ════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════
  return {
    render, openModal, closeModal, switchTab, getSnapshots, saveSnapshot, restoreSnapshot, downloadSnapshot, deleteSnapshot,
    saveAllChanges, saveAcademyInfo, changePassword, setTheme,
    saveRecoverySettings, addSubAccount, deleteSubAccount,
    applyTheme,
    applySidebarStyle,
    openColorCustomizer, liveCustomSidebar, saveCustomSidebarColors, resetCustomSidebarColors,
    applyCardPreset,
    viewTableData, showLiveAccountSnapshot, showMonitorSnapshot, exportAllData,
    startMigration, importFromJSON,
    clearLocalData, clearCloudData, factoryReset,
    addCategory, removeCategory,
    clearActivityLog, logActivity,
    restoreItem, permanentDelete, emptyRecycleBin,
    addNote, saveNote, deleteNote,
    renderBatchReport,
    printBatchReport,
    exportBatchReportExcel,
    showAccountsSubTab,
    addAdvancePayment, saveAdvancePayment, deleteAdvance,
    openReturnAdvanceModal, saveReturnAdvance, viewAdvanceLedger,
    addInvestment, saveInvestment, deleteInvestment,
    openReturnInvestmentModal, saveReturnInvestment, viewInvestmentLedger,
    openSettingsInternalModal, closeSettingsInternalModal,
    runAutoHeal, runSyncCheck, runAutoFix,
    refreshMonitor: () => { refreshModal(); Utils.toast('Refreshed', 'info'); },
  };
})();

window.SettingsModule = SettingsModule;

// ── Restore saved theme + sidebar + colors on page load ──────────────
(function restoreThemeOnLoad() {
  const savedTheme = localStorage.getItem('wfa_theme') || 'neon-space';
  const allThemeIds = ['neon-space','aurora','nebula','neon-grid','molten','emerald','aurora-wave'];
  allThemeIds.forEach(id => document.body.classList.remove(`theme-${id}`));
  document.body.classList.add(`theme-${savedTheme}`);
  
  const savedSidebar = localStorage.getItem(`wfa_sidebar_${savedTheme}`) || 'glass';
  const allSidebarStyles = ['glass','crystal','aurora-glow','tinted','carbon','neonstrip','velvet'];
  
  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      allSidebarStyles.forEach(s => sidebar.classList.remove(`sidebar-${s}`));
      sidebar.classList.add(`sidebar-${savedSidebar}`);
    }
  });

  // Inject colors immediately
  const sideSavedJSON = localStorage.getItem(`wfa_sidebar_custom_${savedTheme}_${savedSidebar}`);
  if(sideSavedJSON) {
      const s = JSON.parse(sideSavedJSON);
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


