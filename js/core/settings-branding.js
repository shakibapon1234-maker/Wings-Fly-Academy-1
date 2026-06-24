// ============================================================
// Wings Fly — Settings Branding Panel (settings-branding.js)
// Academy Logo upload/remove, সব logic এখানে।
// settings.js DOM বড় না করার জন্য আলাদা রাখা হয়েছে।
//
// Depends on:  window.LicenseEngine  (js/core/license.js)
//              window.Utils           (js/ui/settings.js — already loaded when this runs)
// Injected into: #settings-branding-logo-panel  (settings.js panelGeneral-এ placeholder)
// ============================================================

window.SettingsBranding = (() => {

  // ── Internal helpers ─────────────────────────────────────────────────────

  function _engine() {
    return window.LicenseEngine || null;
  }

  function _toast(msg, type = 'info') {
    if (window.Utils && Utils.toast) Utils.toast(msg, type);
    else console.log('[Branding]', msg);
  }

  // ── DOM IDs (সব এখানে centralize) ────────────────────────────────────────
  const ID = {
    fileInput:   'branding-logo-file-input',
    previewImg:  'branding-logo-preview-img',
    placeholder: 'branding-logo-placeholder',
    removeBtn:   'branding-logo-remove-btn',
    dropZone:    'branding-logo-drop-zone',
    sizeHint:    'branding-logo-size-hint',
  };

  // ── Apply logo to both the branding panel + sidebar/login UI ─────────────
  function _applyToUI(dataURL) {
    const preview     = document.getElementById(ID.previewImg);
    const placeholder = document.getElementById(ID.placeholder);
    const removeBtn   = document.getElementById(ID.removeBtn);

    // Branding panel preview
    if (dataURL) {
      if (preview)     { preview.src = dataURL; preview.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn)   removeBtn.style.display = 'inline-flex';
    } else {
      if (preview)     { preview.src = ''; preview.style.display = 'none'; }
      if (placeholder) placeholder.style.display = 'flex';
      if (removeBtn)   removeBtn.style.display = 'none';
    }

    // ── Sidebar logo ────────────────────────────────────────────────────────
    const sidebarImg = document.querySelector('#sidebar .sidebar-logo img');
    if (sidebarImg) sidebarImg.src = dataURL || 'assets/logo.jpg';

    // ── Login page logo ─────────────────────────────────────────────────────
    const loginImg = document.querySelector('.login-logo-ring img');
    if (loginImg) loginImg.src = dataURL || 'assets/logo.jpg';

    // ── admin-panel.js compat (adminHeaderLogo) ─────────────────────────────
    const headerLogo  = document.getElementById('adminHeaderLogo');
    const headerEmoji = document.getElementById('adminHeaderEmoji');
    if (dataURL) {
      if (headerLogo)  { headerLogo.src = dataURL; headerLogo.style.display = 'block'; }
      if (headerEmoji) headerEmoji.style.display = 'none';
    } else {
      if (headerLogo)  { headerLogo.src = ''; headerLogo.style.display = 'none'; }
      if (headerEmoji) headerEmoji.style.display = 'inline';
    }
  }

  // ── Process image file (validation + FileReader) ──────────────────────────
  function _processFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      _toast('❌ শুধু ছবির ফাইল (JPG, PNG, SVG, WEBP) আপলোড করুন।', 'danger');
      return;
    }
    if (file.size > 500 * 1024) {
      _toast('❌ Logo ফাইলের size সর্বোচ্চ 500KB হতে হবে।', 'danger');
      // update hint
      const hint = document.getElementById(ID.sizeHint);
      if (hint) { hint.textContent = `❌ ফাইলটি ${(file.size/1024).toFixed(0)}KB — সীমা 500KB`; hint.style.color = '#ff4757'; }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target.result;
      const eng = _engine();
      if (eng) eng.setAcademyLogo(dataURL);

      // Save to Supabase settings table if available
      if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
        cfg.logo_url = dataURL;
        if (cfg.id) {
          SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
        } else {
          cfg.id = SupabaseSync.generateId();
          SupabaseSync.insert(DB.settings, cfg, { bypassLog: true });
        }
      }

      _applyToUI(dataURL);
      _toast('✅ লোগো সফলভাবে সেভ হয়েছে!', 'success');
      const hint = document.getElementById(ID.sizeHint);
      if (hint) { hint.textContent = `✅ ${file.name} (${(file.size/1024).toFixed(1)}KB)`; hint.style.color = '#2ed573'; }
    };
    reader.readAsDataURL(file);
  }

  // ── Public: handle <input type="file"> change event ──────────────────────
  function handleFileInput(event) {
    _processFile(event.target.files[0]);
  }

  // ── Public: remove logo ───────────────────────────────────────────────────
  function removeLogo() {
    if (!confirm('লোগো মুছে ফেলতে চান?')) return;
    const eng = _engine();
    if (eng) eng.removeAcademyLogo();

    // Clear logo_url in Supabase settings table if available
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
      const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
      cfg.logo_url = '';
      if (cfg.id) {
        SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
      } else {
        cfg.id = SupabaseSync.generateId();
        SupabaseSync.insert(DB.settings, cfg, { bypassLog: true });
      }
    }

    _applyToUI(null);
    _toast('লোগো মুছে ফেলা হয়েছে।', 'warning');
    const fi = document.getElementById(ID.fileInput);
    if (fi) fi.value = '';
    const hint = document.getElementById(ID.sizeHint);
    if (hint) { hint.textContent = 'JPG, PNG, SVG, WEBP — সর্বোচ্চ 500KB'; hint.style.color = '#7a8baa'; }
  }

  // ── Build panel HTML ──────────────────────────────────────────────────────
  function _buildHTML(currentLogoURL) {
    const hasLogo = !!currentLogoURL;
    return `
      <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">

        <!-- Preview box -->
        <div id="${ID.dropZone}"
          style="width:120px;height:120px;border-radius:16px;border:2px dashed rgba(0,217,255,0.3);
                 background:rgba(0,217,255,0.04);display:flex;align-items:center;justify-content:center;
                 flex-shrink:0;overflow:hidden;cursor:pointer;transition:border-color .2s;position:relative"
          onclick="document.getElementById('${ID.fileInput}').click()"
          ondragover="event.preventDefault();this.style.borderColor='#00d9ff'"
          ondragleave="this.style.borderColor='rgba(0,217,255,0.3)'"
          ondrop="event.preventDefault();this.style.borderColor='rgba(0,217,255,0.3)';
                  window.SettingsBranding&&SettingsBranding.handleDrop(event)">

          <img id="${ID.previewImg}"
            src="${hasLogo ? currentLogoURL : ''}"
            style="width:100%;height:100%;object-fit:contain;display:${hasLogo ? 'block' : 'none'}" />

          <div id="${ID.placeholder}"
            style="display:${hasLogo ? 'none' : 'flex'};flex-direction:column;align-items:center;
                   gap:6px;color:#7a8baa;font-size:0.75rem;text-align:center;padding:8px">
            <i class="fa fa-image" style="font-size:2rem;color:rgba(0,217,255,0.3)"></i>
            <span>লোগো যোগ করুন</span>
          </div>
        </div>

        <!-- Controls -->
        <div style="flex:1;min-width:200px">
          <input type="file" id="${ID.fileInput}" accept="image/*" style="display:none"
            onchange="SettingsBranding.handleFileInput(event)" />

          <button onclick="document.getElementById('${ID.fileInput}').click()"
            style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(0,217,255,0.15),rgba(123,47,247,0.15));
                   border:1px solid rgba(0,217,255,0.3);color:#00d9ff;padding:9px 18px;border-radius:10px;
                   cursor:pointer;font-size:0.85rem;font-weight:600;transition:all .2s;margin-bottom:10px"
            onmouseover="this.style.background='linear-gradient(135deg,rgba(0,217,255,0.25),rgba(123,47,247,0.25))'"
            onmouseout="this.style.background='linear-gradient(135deg,rgba(0,217,255,0.15),rgba(123,47,247,0.15))'">
            <i class="fa fa-upload"></i> লোগো আপলোড করুন
          </button>

          <button id="${ID.removeBtn}" onclick="SettingsBranding.removeLogo()"
            style="display:${hasLogo ? 'inline-flex' : 'none'};align-items:center;gap:6px;
                   background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.25);
                   color:#ff4757;padding:9px 14px;border-radius:10px;cursor:pointer;
                   font-size:0.85rem;margin-left:8px;transition:all .2s"
            onmouseover="this.style.background='rgba(255,71,87,0.2)'"
            onmouseout="this.style.background='rgba(255,71,87,0.1)'">
            <i class="fa fa-trash-can"></i> মুছুন
          </button>

          <div id="${ID.sizeHint}"
            style="margin-top:8px;font-size:0.75rem;color:#7a8baa">
            JPG, PNG, SVG, WEBP — সর্বোচ্চ 500KB
          </div>
          <div style="margin-top:6px;font-size:0.75rem;color:#7a8baa;line-height:1.5">
            <i class="fa fa-circle-info" style="color:rgba(0,217,255,0.5)"></i>
            Sidebar, Login পেজ ও PDF রিপোর্টে এই লোগো দেখাবে।<br>
            Drop করেও আপলোড করা যাবে।
          </div>
        </div>
      </div>`;
  }

  // ── Public: handle drag-and-drop ──────────────────────────────────────────
  function handleDrop(event) {
    const file = event.dataTransfer?.files?.[0];
    if (file) _processFile(file);
  }

  // ── Public: inject panel into the placeholder div ─────────────────────────
  function inject() {
    const placeholder = document.getElementById('settings-branding-logo-panel');
    if (!placeholder) return; // panel not open yet — নো প্রবলেম

    let currentLogo = null;
    // Check SupabaseSync settings first
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
      const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
      if (cfg.logo_url) {
        currentLogo = cfg.logo_url;
      }
    }
    // Fallback to localStorage
    if (!currentLogo) {
      const eng = _engine();
      currentLogo = eng ? eng.getAcademyLogo() : null;
    }

    placeholder.innerHTML = _buildHTML(currentLogo);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { inject, handleFileInput, handleDrop, removeLogo };

})();

// Auto-inject যদি placeholder এখনই DOM-এ থাকে
(function() {
  if (document.getElementById('settings-branding-logo-panel')) {
    window.SettingsBranding.inject();
  }
})();
