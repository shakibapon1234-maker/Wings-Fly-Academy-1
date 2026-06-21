// Committed stub — central AcadeFlow License Server config.
// ⚠️ এটি একটি SEPARATE Supabase project — client-দের নিজস্ব
// Supabase project-এর সাথে এটি মেলানো উচিত নয়।
// (দেখুন supabase/license_server_setup.sql)
//
// Local override: license-server-config.example.js কপি করে
// license-server-config.js নামে সেভ করুন (gitignored),
// তারপর real URL + anonKey দিন।
// এই stub-এর ঠিক পরে index.html-এ সেই ফাইলের script tag রাখুন।
//
// Real config না থাকলে window.WFA_LICENSE_SERVER empty থাকে এবং
// LicenseEngine migration-window fallback-এ কাজ করে।
window.WFA_LICENSE_SERVER = window.WFA_LICENSE_SERVER || {};
