// ============================================================
// AcadeFlow — Settings Institution Type Panel
// Injected into settings.js via #settings-institution-panel
// Depends on: window.InstitutionMode, window.Utils
// ============================================================

window.SettingsInstitution = (() => {
  const PANEL_ID = 'settings-institution-panel';

  function _toast(msg, type = 'info') {
    if (window.Utils && Utils.toast) Utils.toast(msg, type);
    else console.log('[SettingsInstitution]', msg);
  }

  // পুরনো Android WebView-তে CSS color-mix() সাপোর্ট নাও থাকতে পারে,
  // তাই hex থেকে সরাসরি rgba() বানানো হচ্ছে (সব ব্রাউজারে কাজ করে)।
  function _hexToRgb(hex) {
    const h = String(hex || '#00d2ff').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return '0, 210, 255';
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function _previewRows(type) {
    const IM = window.InstitutionMode;
    if (!IM) return '';
    const coaching = IM.LABELS.coaching;
    const target = IM.LABELS[type] || coaching;
    const keys = [
      ['course_label', 'Course / Class label'],
      ['batch_label', 'Batch / Section label'],
      ['session_label', 'Session / Year label'],
      ['fee_label', 'Fee label'],
      ['student_id_prefix', 'Student ID prefix'],
    ];
    return keys.map(([key, title]) => {
      const from = coaching[key];
      const to = target[key];
      const changed = from !== to;
      return `
        <tr>
          <td style="padding:8px 12px;color:#7a8baa;font-size:0.85rem">${title}</td>
          <td style="padding:8px 12px;color:#8899aa;font-size:0.85rem">${from}</td>
          <td style="padding:8px 12px;font-size:0.85rem;${changed ? 'color:#2ed573;font-weight:600' : 'color:#8899aa'}">
            ${to}${changed ? ' ✓' : ''}
          </td>
        </tr>`;
    }).join('');
  }

  function _styleBlock() {
    if (document.getElementById('institution-type-styles')) return '';
    return `
      <style id="institution-type-styles">
        .inst-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .inst-type-option {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          padding: 18px 12px 14px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          cursor: pointer;
          background: rgba(255,255,255,0.02);
          transition: border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease;
        }
        .inst-type-option:hover {
          transform: translateY(-2px);
          border-color: var(--inst-color, #00d2ff);
          box-shadow: 0 6px 18px -8px var(--inst-color, #00d2ff);
        }
        .inst-type-option input[type="radio"] { display: none; }
        .inst-type-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          background: rgba(var(--inst-rgb, 0,210,255), 0.16);
          border: 1px solid rgba(var(--inst-rgb, 0,210,255), 0.4);
          transition: transform .18s ease;
        }
        .inst-type-option:hover .inst-type-icon { transform: scale(1.08); }
        .inst-type-option.is-selected {
          border-color: var(--inst-color, #00d2ff);
          background: rgba(var(--inst-rgb, 0,210,255), 0.1);
          box-shadow: 0 0 0 1px var(--inst-color, #00d2ff) inset, 0 6px 18px -8px var(--inst-color, #00d2ff);
        }
        .inst-type-option.is-selected .inst-type-icon {
          background: rgba(var(--inst-rgb, 0,210,255), 0.28);
        }
        .inst-type-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.62rem;
          color: transparent;
          transition: all .18s ease;
        }
        .inst-type-option.is-selected .inst-type-check {
          background: var(--inst-color, #00d2ff);
          border-color: var(--inst-color, #00d2ff);
          color: #06121c;
        }
        .inst-type-name { font-weight: 700; font-size: 0.9rem; }
        .inst-type-bn { color: #7a8baa; font-size: 0.78rem; }
      </style>`;
  }

  function _buildHTML() {
    const IM = window.InstitutionMode;
    const current = IM ? IM.get() : 'coaching';
    const options = (IM ? IM.VALID : ['coaching', 'school', 'college']).map((type) => {
      const meta = IM ? IM.getMeta(type) : { icon: '', label: type, labelBn: type, color: '#00d2ff' };
      const checked = current === type;
      const color = meta.color || '#00d2ff';
      const rgb = _hexToRgb(color);
      return `
        <label class="inst-type-option${checked ? ' is-selected' : ''}" style="--inst-color:${color};--inst-rgb:${rgb}">
          <input type="radio" name="institution-type" value="${type}" ${checked ? 'checked' : ''} />
          <span class="inst-type-check">✓</span>
          <span class="inst-type-icon">${meta.icon}</span>
          <span class="inst-type-name">${meta.label}</span>
          <span class="inst-type-bn">${meta.labelBn}</span>
        </label>`;
    }).join('');

    return `
      ${_styleBlock()}
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-building"></i> Institution Type</div>
        <p style="color:#7a8baa;font-size:0.88rem;margin:0 0 16px">
          আপনার প্রতিষ্ঠানের ধরন বেছে নিন। Coaching mode-এ বর্তমান WFA ফিচার অপরিবর্তিত থাকবে।
          School/College mode-এ Class, Section, Marks ইত্যাদি ফিচার চালু হবে।
        </p>
        <div id="institution-type-options" class="inst-type-grid">${options}</div>
      </div>

      <div class="settings-card">
        <div class="settings-card-title"><i class="fa fa-language"></i> Terminology Preview</div>
        <p style="color:#7a8baa;font-size:0.82rem;margin:0 0 10px">
          নির্বাচিত mode অনুযায়ী app-এ এই লেবেলগুলো দেখাবে:
        </p>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
                <th style="padding:8px 12px;text-align:left;font-size:0.78rem;color:#7a8baa">Field</th>
                <th style="padding:8px 12px;text-align:left;font-size:0.78rem;color:#7a8baa">Coaching (default)</th>
                <th style="padding:8px 12px;text-align:left;font-size:0.78rem;color:#7a8baa">Selected mode</th>
              </tr>
            </thead>
            <tbody id="institution-terminology-preview">
              ${_previewRows(current)}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <button type="button" id="institution-type-save-btn" class="btn btn-primary">
          <i class="fa fa-floppy-disk"></i> Save Institution Type
        </button>
        <span id="institution-type-current" style="align-self:center;color:#7a8baa;font-size:0.82rem">
          Current: <strong style="color:var(--brand-primary,#00d2ff)">${current}</strong>
        </span>
      </div>`;
  }

  function _bindEvents() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || panel.dataset.bound === '1') return;
    panel.dataset.bound = '1';

    panel.addEventListener('change', (e) => {
      if (e.target.name !== 'institution-type') return;
      const preview = document.getElementById('institution-terminology-preview');
      if (preview) preview.innerHTML = _previewRows(e.target.value);
      panel.querySelectorAll('.inst-type-option').forEach((label) => {
        const input = label.querySelector('input[name="institution-type"]');
        label.classList.toggle('is-selected', !!(input && input.checked));
      });
    });

    const saveBtn = document.getElementById('institution-type-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const selected = panel.querySelector('input[name="institution-type"]:checked');
        if (!selected || !window.InstitutionMode) {
          _toast('Institution mode engine not loaded.', 'danger');
          return;
        }
        const prev = InstitutionMode.get();
        const next = InstitutionMode.set(selected.value);
        if (prev === next) {
          _toast('Institution type unchanged.', 'info');
          return;
        }
        _toast(`Reloading to apply ${InstitutionMode.getMeta(next).label}…`, 'info');
        setTimeout(() => window.location.reload(), 900);
      });
    }
  }

  function inject() {
    const placeholder = document.getElementById(PANEL_ID);
    if (!placeholder) return;
    placeholder.innerHTML = _buildHTML();
    _bindEvents();
  }

  return { inject };
})();
