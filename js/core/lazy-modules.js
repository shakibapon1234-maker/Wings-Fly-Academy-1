// ============================================================
// Wings Fly — Lazy app module loader (PageSpeed / mobile FCP)
// Heavy UI + feature scripts load after login or on first use.
// ============================================================

const LazyModules = (() => {
  const _pending = {};
  const _done = {};

  const MODULES = {
    'integrity-guard':     { src: 'js/core/integrity-guard.js' },
    'system-diagnostics':  { src: 'js/core/system-diagnostics.js' },
    'settings-diagnostics':{ src: 'js/core/settings-diagnostics.js' },
    'backup-restore':      { src: 'js/core/backup-restore.js' },
    'auto-update':         { src: 'js/core/auto-update.js' },
    'push-notifications':  { src: 'js/core/push-notifications.js' },
    'offline-mode':        { src: 'js/core/offline-mode.js' },
    'admin-panel':         { src: 'js/core/admin-panel.js' },
    dashboard:             { src: 'js/ui/dashboard.js' },
    settings:              { src: 'js/ui/settings.js' },
    'settings-branding':   { src: 'js/core/settings-branding.js' },
    students:              { src: 'js/modules/students.js' },
    finance:               { src: 'js/modules/finance.js' },
    accounts:              { src: 'js/modules/accounts.js' },
    loans:                 { src: 'js/modules/loans.js' },
    exam:                  { src: 'js/modules/exam.js' },
    attendance:            { src: 'js/modules/attendance.js' },
    'hr-staff':            { src: 'js/modules/hr-staff.js' },
    salary:                { src: 'js/modules/salary.js' },
    visitors:              { src: 'js/modules/visitors.js' },
    'id-cards':            { src: 'js/modules/id-cards.js' },
    certificates:          { src: 'js/modules/certificates.js' },
    'notice-board':        { src: 'js/modules/notice-board.js' },
    'command-palette':     { src: 'js/modules/command-palette.js' },
    'pattern-lock':        { src: 'js/modules/pattern-lock.js' },
    'face-id':             { src: 'js/modules/face-id.js' },
    'ai-assistant':        { src: 'js/modules/ai-assistant.js' },
    'payment-engine':      { src: 'js/core/payment-engine.js' },
    'payment-requests':    { src: 'js/modules/payment-requests.js', deps: ['payment-engine'] },
  };

  const SECTION_TO_MODULE = {
    dashboard: 'dashboard',
    students: 'students',
    finance: 'finance',
    accounts: 'accounts',
    loans: 'loans',
    exam: 'exam',
    attendance: 'attendance',
    salary: 'salary',
    'hr-staff': 'hr-staff',
    visitors: 'visitors',
    'id-cards': 'id-cards',
    certificates: 'certificates',
    'notice-board': 'notice-board',
    settings: 'settings',
    'payment-requests': 'payment-requests',
  };

  const POST_LOGIN_IDLE = [
    'integrity-guard', 'system-diagnostics', 'settings-diagnostics', 'backup-restore',
    'auto-update', 'push-notifications', 'offline-mode', 'admin-panel',
    'settings-branding', 'command-palette', 'notice-board', 'ai-assistant', 'pattern-lock', 'face-id',
  ];

  const PREFETCH_MODULES = ['students', 'finance', 'settings'];

  function _resolve(path) {
    const rel = String(path || '').replace(/^\.\//, '').replace(/^\//, '');
    if (/^https?:\/\//i.test(rel)) return rel;
    const origin = window.location.origin === 'null' ? 'file://' : window.location.origin;
    const basePath = (window.location.pathname || '/').replace(/\/[^/]*$/, '/');
    return new URL(rel, origin + basePath).href;
  }

  function loadScript(src) {
    const key = _resolve(src);
    if (_done[key]) return Promise.resolve();
    if (_pending[key]) return _pending[key];

    _pending[key] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = key;
      script.defer = true;
      script.onload = () => {
        _done[key] = true;
        resolve();
      };
      script.onerror = () => {
        delete _pending[key];
        reject(new Error(`Failed to load ${src}`));
      };
      document.body.appendChild(script);
    });
    return _pending[key];
  }

  function ensure(name) {
    const def = MODULES[name];
    if (!def) return Promise.reject(new Error(`Unknown module: ${name}`));
    const depsPromise = (def.deps && def.deps.length)
      ? def.deps.reduce((p, depName) => p.then(() => ensure(depName)), Promise.resolve())
      : Promise.resolve();
    return depsPromise.then(() => loadScript(def.src));
  }

  function ensureSection(section) {
    const name = SECTION_TO_MODULE[section];
    return name ? ensure(name) : Promise.resolve();
  }

  function prefetchAfterLogin() {
    const run = () => {
      ensure('dashboard').catch(() => {});
      PREFETCH_MODULES.forEach((name) => ensure(name).catch(() => {}));
      POST_LOGIN_IDLE.forEach((name) => ensure(name).catch(() => {}));
      if (window.LazyLibs) window.LazyLibs.prefetchAfterLogin();
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 6000 });
    } else {
      setTimeout(run, 1200);
    }
  }

  function prefetchLoginExtras() {
    return Promise.all(['face-id', 'pattern-lock'].map((name) => ensure(name).catch(() => {})));
  }

  return { ensure, ensureSection, loadScript, prefetchAfterLogin, prefetchLoginExtras };
})();

window.LazyModules = LazyModules;
