// Committed stub — central AcadeFlow License Server config.
// ⚠️ এটি একটি SEPARATE Supabase project — client-দের নিজস্ব
// Supabase project-এর সাথে এটি মেলানো উচিত নয়।
// (দেখুন supabase/license_server_setup.sql)
//
// Local override: license-server-config.example.js কপি করে
// license-server-config.js নামে সেভ করুন (gitignored),
// তারপর real URL + anonKey দিন।
//
// Real config না থাকলে window.WFA_LICENSE_SERVER empty থাকে এবং
// LicenseEngine migration-window fallback-এ কাজ করে।
window.WFA_LICENSE_SERVER = window.WFA_LICENSE_SERVER || {};

// Dynamically load real License Server config in local/dev environment only
// to avoid 404 console errors in production deployment (where it is stripped).
(() => {
  const h = window.location.hostname;
  const isDev = !h || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.') || window.location.protocol === 'file:';
  if (isDev) {
    const script = document.createElement('script');
    script.src = 'js/core/license-server-config.js';
    script.defer = true;
    document.head.appendChild(script);
  }
})();
