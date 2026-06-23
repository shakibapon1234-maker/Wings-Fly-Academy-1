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
// Fallback central License Server credentials (safe to commit as anon keys are public by design)
const _fallbackLicUrl = 'https://fznhiqzrslldybhmgopk.supabase.co';
const _fallbackLicKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

window.WFA_LICENSE_SERVER = window.WFA_LICENSE_SERVER || {
  url: _fallbackLicUrl,
  anonKey: _fallbackLicKey
};

// Dynamically load real License Server config in local/dev environment only (as override)
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
