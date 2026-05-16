// ============================================================
// Wings Fly Aviation Academy — Global Loading State Manager
// ✅ Bug #24 Fix: Standardized Loading State Manager
// Extracted from inline script in index.html for CSP compliance
// ============================================================

(function() {
  // WFA Loading State — centralized show/hide spinner
  window.WFA_Loading = {
    show: function(msg) {
      var el = document.getElementById('wfa-global-spinner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'wfa-global-spinner';
        el.innerHTML = '<div class="wfa-spinner-inner"><div class="wfa-spinner-ring"></div><p class="wfa-spinner-msg"></p></div>';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(5,8,20,0.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);transition:opacity .2s';
        document.body.appendChild(el);
      }
      var msgEl = el.querySelector('.wfa-spinner-msg');
      if (msgEl) msgEl.textContent = msg || (typeof WFA_i18n !== 'undefined' ? WFA_i18n.t('ui.loading') : 'Loading...');
      el.style.opacity = '1';
      el.style.display = 'flex';
      document.dispatchEvent(new CustomEvent('wfa:loading', { detail: { active: true, msg: msg } }));
    },
    hide: function() {
      var el = document.getElementById('wfa-global-spinner');
      if (!el) return;
      el.style.opacity = '0';
      setTimeout(function() { if (el) el.style.display = 'none'; }, 200);
      document.dispatchEvent(new CustomEvent('wfa:loading', { detail: { active: false } }));
    }
  };
  // Inject spinner CSS
  var s = document.createElement('style');
  s.textContent = '.wfa-spinner-ring{width:48px;height:48px;border:4px solid rgba(0,217,255,0.15);border-top-color:#00d9ff;border-radius:50%;animation:wfa-spin .8s linear infinite;margin:0 auto 12px}.wfa-spinner-msg{color:#b0c4d8;font-size:.9rem;text-align:center;font-family:inherit}@keyframes wfa-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
})();
