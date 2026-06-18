// ============================================================
// Wings Fly — Lazy third-party library loader (PageSpeed / FCP)
// Heavy scripts are not parsed until login or first use.
// ============================================================

const LazyLibs = (() => {
  const _pending = {};
  const _done = {};

  function _resolve(path) {
    const rel = String(path || '').replace(/^\.\//, '').replace(/^\//, '');
    if (/^https?:\/\//i.test(rel)) return rel;
    const basePath = (window.location.pathname || '/').replace(/\/[^/]*$/, '/');
    return new URL(rel, window.location.origin + basePath).href;
  }

  function _loadScript(local, cdn, isReady) {
    if (isReady && isReady()) return Promise.resolve();
    const key = local;
    if (_done[key]) return Promise.resolve();
    if (_pending[key]) return _pending[key];

    _pending[key] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let triedCdn = false;
      script.src = _resolve(local);
      script.onload = () => {
        _done[key] = true;
        resolve();
      };
      script.onerror = () => {
        if (cdn && !triedCdn) {
          triedCdn = true;
          script.src = cdn;
          return;
        }
        delete _pending[key];
        reject(new Error(`Failed to load ${local}`));
      };
      document.head.appendChild(script);
    });
    return _pending[key];
  }

  function _loadStylesheet(local, cdn, media) {
    const key = 'css:' + local + (media ? ':' + media : '');
    if (_done[key]) return Promise.resolve();
    if (_pending[key]) return _pending[key];

    _pending[key] = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      if (media) link.media = media;
      let triedCdn = false;
      link.href = _resolve(local);
      link.onload = () => {
        _done[key] = true;
        resolve();
      };
      link.onerror = () => {
        if (cdn && !triedCdn) {
          triedCdn = true;
          link.href = cdn;
          return;
        }
        delete _pending[key];
        reject(new Error(`Failed to load ${local}`));
      };
      document.head.appendChild(link);
    });
    return _pending[key];
  }

  const DEFS = {
    supabase: {
      ready: () => !!window.supabase,
      load: () => _loadScript(
        'js/lib/supabase.min.js',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
        () => !!window.supabase
      ),
    },
    chart: {
      ready: () => !!window.Chart,
      load: () => _loadScript(
        'js/lib/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
        () => !!window.Chart
      ),
    },
    xlsx: {
      ready: () => typeof XLSX !== 'undefined',
      load: () => _loadScript(
        'js/lib/xlsx.full.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
        () => typeof XLSX !== 'undefined'
      ),
    },
    qrcode: {
      ready: () => typeof QRCode !== 'undefined',
      load: () => _loadScript(
        'js/lib/qrcode.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
        () => typeof QRCode !== 'undefined'
      ),
    },
    flatpickr: {
      ready: () => typeof flatpickr !== 'undefined',
      load: () => _loadScript(
        'js/lib/flatpickr.min.js',
        'https://cdn.jsdelivr.net/npm/flatpickr',
        () => typeof flatpickr !== 'undefined'
      ).then(() => _loadStylesheet(
        'css/lib/flatpickr-dark.css',
        'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css'
      ).catch(() => {})),
    },
    html2canvas: {
      ready: () => typeof html2canvas !== 'undefined',
      load: () => _loadScript(
        'js/lib/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        () => typeof html2canvas !== 'undefined'
      ),
    },
    jspdf: {
      ready: () => !!(window.jspdf && window.jspdf.jsPDF),
      load: () => _loadScript(
        'js/lib/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        () => !!(window.jspdf && window.jspdf.jsPDF)
      ),
    },
  };

  function load(name) {
    const def = DEFS[name];
    if (!def) return Promise.reject(new Error(`Unknown library: ${name}`));
    if (def.ready && def.ready()) return Promise.resolve();
    return def.load();
  }

  function loadPdfKit() {
    return load('html2canvas').then(() => load('jspdf'));
  }

  function prefetchAfterLogin() {
    const run = () => {
      loadAppStyles().catch(() => {});
      ['chart', 'flatpickr', 'xlsx'].forEach((name) => {
        load(name).catch(() => {});
      });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 8000 });
    } else {
      setTimeout(run, 1500);
    }
  }

  const APP_STYLES = [
    { href: 'css/lib/font-awesome.min.css', cdn: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css' },
    { href: 'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap' },
    { href: 'css/main.css' },
    { href: 'css/attendance.css' },
    { href: 'css/exam.css' },
    { href: 'css/cert-v2.css' },
    { href: 'css/ai-assistant.css' },
    { href: 'css/mobile.css' },
    { href: 'css/lib/flatpickr-dark.css', cdn: 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css' },
    { href: 'css/print.css', media: 'print' },
  ];

  let _stylesPromise = null;

  function loadAppStyles() {
    if (_stylesPromise) return _stylesPromise;
    _stylesPromise = APP_STYLES.reduce(
      (chain, item) => chain.then(() => _loadStylesheet(item.href, item.cdn, item.media)),
      Promise.resolve()
    ).catch((err) => {
      _stylesPromise = null;
      throw err;
    });
    return _stylesPromise;
  }

  function prefetchAppStyles() {
    const run = () => loadAppStyles().catch(() => {});
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 2000);
    }
  }

  return { load, loadPdfKit, loadAppStyles, prefetchAppStyles, prefetchAfterLogin, ready: (name) => !!(DEFS[name] && DEFS[name].ready && DEFS[name].ready()) };
})();

window.LazyLibs = LazyLibs;
