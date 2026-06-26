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

  function _buildHTML() {
    const IM = window.InstitutionMode;
    const current = IM ? IM.get() : 'coaching';
    const options = (IM ? IM.VALID : ['coaching', 'school', 'college']).map((type) => {
      const meta = IM ? IM.getMeta(type) : { icon: '', label: type, labelBn: type };
      const checked = current === type ? 'checked' : '';
      return `
        <label class="inst-type-option" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid ${checked ? 'var(--brand-primary,#00d2ff)' : 'rgba(255,255,255,0.08)'};border-radius:10px;cursor:pointer;background:${checked ? 'rgba(0,210,255,0.08)' : 'rgba(255,255,255,0.02)'};margin-bottom:10px">
          <input type="radio" name="institution-type" value="${type}" ${checked} style="margin-top:4px" />
          <div>
            <div style="font-weight:600;font-size:0.95rem">${meta.icon} ${meta.label}</div>
            <div style="color:#7a8baa;font-size:0.82rem;margin-top:4px">${meta.labelBn}</div>
          </div>
        </label>`;
    }).join('');

    return `
      <div class="settings-card glow-cyan">
        <div class="settings-card-title"><i class="fa fa-building"></i> Institution Type</div>
        <p style="color:#7a8baa;font-size:0.88rem;margin:0 0 16px">
          আপনার প্রতিষ্ঠানের ধরন বেছে নিন। Coaching mode-এ বর্তমান WFA ফিচার অপরিবর্তিত থাকবে।
          School/College mode-এ Class, Section, Marks ইত্যাদি ফিচার চালু হবে।
        </p>
        <div id="institution-type-options">${options}</div>
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
        const on = input && input.checked;
        label.style.borderColor = on ? 'var(--brand-primary,#00d2ff)' : 'rgba(255,255,255,0.08)';
        label.style.background = on ? 'rgba(0,210,255,0.08)' : 'rgba(255,255,255,0.02)';
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
        _toast(`✅ Institution type saved: ${InstitutionMode.getMeta(next).label}`, 'success');
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
