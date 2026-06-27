// ============================================================
// Wings Fly Academy — License Manager v2
// © AcadeFlow — All rights reserved
// ============================================================
//
// এই ফাইলে License Server v2-এর সব admin logic আছে।
// settings.js বড় হয়ে যাওয়ার কারণে এখানে আলাদা করা হয়েছে।
//
// Client Manager panel-এর generate / revoke / refresh functions
// এখানে define হয়, window-এ expose হয়, এবং settings.js-এ
// _wfaGenerateLicKey() / _wfaToggleRevokeKey() / _wfaRefreshLicenseStatuses()
// হিসেবে call হয়।
//
// DEPENDS ON:  window.LicenseEngine  (js/core/license.js)
//              window.Utils          (js/core/utils.js)
//              window.SettingsModule (js/ui/settings.js)
// ============================================================

(function () {
  'use strict';

  // ── Admin secret storage key (saved in localStorage by admin, used per-call)
  const _ADMIN_SECRET_KEY = 'wfa_license_admin_secret';

  // ── Load / save admin secret from localStorage (session-only memory)
  function _getAdminSecret() {
    try {
      // First check the dedicated input if the panel is open
      const inputEl = document.getElementById('cm-admin-secret');
      if (inputEl && inputEl.value.trim()) {
        // Auto-save whenever a value is in the field
        localStorage.setItem(_ADMIN_SECRET_KEY, inputEl.value.trim());
        return inputEl.value.trim();
      }
      return localStorage.getItem(_ADMIN_SECRET_KEY) || '';
    } catch { return ''; }
  }

  // ── Restore admin secret to the input (called when panel renders)
  function _restoreAdminSecret() {
    try {
      const saved = localStorage.getItem(_ADMIN_SECRET_KEY) || '';
      const inputEl = document.getElementById('cm-admin-secret');
      if (inputEl && saved && !inputEl.value) inputEl.value = saved;
    } catch { /* ignore */ }
  }

  // ── Save admin secret from the input field
  window._wfaSaveAdminSecret = function () {
    const inputEl = document.getElementById('cm-admin-secret');
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (!val) { Utils.toast('⚠️ Secret খালি রাখা যাবে না।', 'warning'); return; }
    localStorage.setItem(_ADMIN_SECRET_KEY, val);
    Utils.toast('✅ License Server Admin Secret সেভ হয়েছে!', 'success');
  };

  // ── Generate License Key (v2 — async, calls generate-license Edge Function)
  window._wfaGenerateLicKey = async function () {
    if (typeof LicenseEngine === 'undefined') {
      Utils.toast('License engine not loaded', 'error'); return;
    }
    const adminSecret = _getAdminSecret();
    if (!adminSecret) {
      Utils.toast('⚠️ আগে License Server Admin Secret সেভ করুন।', 'warning'); return;
    }

    const code   = (document.getElementById('cm-gen-code')?.value?.trim()?.toUpperCase()) || 'C001';
    const months = parseInt(document.getElementById('cm-gen-months')?.value || '1');
    const btn    = document.querySelector('[onclick="_wfaGenerateLicKey()"]');

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating...'; }

    try {
      const result = await LicenseEngine.generate(code, months, adminSecret);
      const keyEl  = document.getElementById('cm-gen-result');
      if (keyEl) { keyEl.value = result.key; keyEl.style.display = 'block'; }
      navigator.clipboard.writeText(result.key).catch(() => {});
      Utils.toast('✅ Key generated & copied! Expires: ' + result.expires, 'success');
      // Auto-fill the license key field if empty
      const lkEl = document.getElementById('cm-lickey');
      if (lkEl && !lkEl.value) lkEl.value = result.key;
      // Show the assign-to-client dropdown
      if (typeof window._wfaPopulateAssignDropdown === 'function') {
        window._wfaPopulateAssignDropdown(result.key);
      }
    } catch (err) {
      console.error('[LicenseManager] generate failed:', err);
      if (err.message === 'license_server_not_configured') {
        Utils.toast('❌ License Server configured নেই। license-server-config.js চেক করুন।', 'error', 6000);
      } else if (err.message === 'unauthorized' || err.message?.includes('401')) {
        Utils.toast('❌ Admin Secret ভুল। Supabase-এ set করা ADMIN_GEN_SECRET দিন।', 'error', 6000);
      } else {
        Utils.toast('❌ Key generate ব্যর্থ: ' + (err.message || 'Unknown error'), 'error', 5000);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate New License Key'; }
    }
  };

  // ── Revoke / Reactivate a license key (v2 NEW — wasn't possible with old local system)
  window._wfaToggleRevokeKey = async function (idx) {
    if (typeof LicenseEngine === 'undefined') {
      Utils.toast('License engine not loaded', 'error'); return;
    }
    const adminSecret = _getAdminSecret();
    if (!adminSecret) {
      Utils.toast('⚠️ আগে License Server Admin Secret সেভ করুন।', 'warning'); return;
    }

    const _CLIENTS_KEY = 'wfa_acadeflow_clients';
    let list;
    try { list = JSON.parse(localStorage.getItem(_CLIENTS_KEY) || '[]'); } catch { list = []; }

    const c = list[idx];
    if (!c || !c.licenseKey) { Utils.toast('এই client-এর কোনো license key নেই।', 'warning'); return; }

    // Check current revoked status from cache (async validate)
    let isRevoked = false;
    try {
      const status = await LicenseEngine.validate(c.licenseKey);
      isRevoked = (status.reason === 'revoked');
    } catch { /* assume not revoked */ }

    const actionLabel = isRevoked ? 'Reactivate' : 'Revoke';
    if (!confirm(`${c.academy || 'এই client'}-এর license key ${actionLabel} করবেন?`)) return;

    try {
      const result = await LicenseEngine.revoke(c.licenseKey, isRevoked, adminSecret);
      Utils.toast(
        `✅ License key ${result.status === 'active' ? 'reactivated' : 'revoked'}!`,
        result.status === 'active' ? 'success' : 'warning'
      );
      // Refresh the panel
      if (typeof SettingsModule !== 'undefined' && SettingsModule.refreshModal) {
        SettingsModule.refreshModal();
      }
    } catch (err) {
      console.error('[LicenseManager] revoke failed:', err);
      Utils.toast('❌ Revoke ব্যর্থ: ' + (err.message || 'Unknown error'), 'error', 5000);
    }
  };

  // ── Batch-refresh license status badges (async — calls server for each client with a key)
  window._wfaRefreshLicenseStatuses = async function () {
    if (typeof LicenseEngine === 'undefined') return;

    const _CLIENTS_KEY = 'wfa_acadeflow_clients';
    let list;
    try { list = JSON.parse(localStorage.getItem(_CLIENTS_KEY) || '[]'); } catch { return; }

    const keyed = list.filter(c => c.licenseKey);
    if (!keyed.length) return;

    let processed  = 0;

    for (const c of keyed) {
      try {
        const status = await LicenseEngine.validate(c.licenseKey);
        // Update the status badge in the DOM without full re-render
        _updateStatusBadge(c.licenseKey, status);
      } catch { /* skip */ }
      processed++;
    }

    if (processed > 0) {
      Utils.toast(`✅ ${processed} client-এর license status refresh হয়েছে।`, 'success');
    }
  };

  // ── DOM helper: update the status badge for a given key in the rendered table
  function _updateStatusBadge(licenseKey, status) {
    // Find all td elements containing the key snippet and update the sibling status td
    const allRows = document.querySelectorAll('#cm-clients-table tbody tr');
    allRows.forEach(row => {
      const keyTd = row.querySelector('[data-lickey]');
      if (!keyTd) return;
      const key = keyTd.getAttribute('data-lickey');
      if (!key || key.slice(0, 18) !== licenseKey.slice(0, 18)) return;
      const statusTd = row.querySelector('[data-status-badge]');
      if (statusTd) statusTd.innerHTML = _buildStatusBadge(status);
    });
  }

  // ── Build a status badge HTML string from a validate() result
  function _buildStatusBadge(ls) {
    if (!ls) return `<span style="background:rgba(120,120,120,0.15);color:#aaa;padding:2px 9px;border-radius:20px;font-size:0.72rem">Unknown</span>`;
    if (ls.reason === 'revoked') return `<span style="background:rgba(255,71,87,0.2);color:#ff4757;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">🚫 Revoked</span>`;
    if (ls.expired) return `<span style="background:rgba(255,71,87,0.15);color:#ff4757;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">Expired</span>`;
    if (ls.inGrace) return `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">Grace (${ls.graceDaysLeft}d)</span>`;
    if (ls.daysLeft <= 7) return `<span style="background:rgba(245,166,35,0.15);color:#f5a623;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">${ls.daysLeft}d left</span>`;
    return `<span style="background:rgba(0,255,136,0.12);color:#00ff88;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700">Active (${ls.daysLeft}d)</span>`;
  }

  // ── Called by settings.js after the Client Manager panel is rendered in the DOM
  window._wfaLicenseManagerOnPanelReady = function () {
    // Restore saved admin secret into the input
    _restoreAdminSecret();
    // Kick off async batch status refresh (non-blocking)
    setTimeout(() => window._wfaRefreshLicenseStatuses(), 400);
  };

  console.log('[LicenseManager v2] loaded ✓');

})();
