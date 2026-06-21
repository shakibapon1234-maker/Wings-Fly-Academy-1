// AcadeFlow License Server credentials — LOCAL ONLY (gitignored; do NOT commit or ship in zip)
// ─────────────────────────────────────────────────────────────────────────────
// USAGE:
//   1. নতুন Supabase project তৈরি করুন: "acadeflow-license-server"
//   2. এই ফাইলটি কপি করুন: license-server-config.example.js → license-server-config.js
//   3. নিচের URL ও anonKey আপনার dedicated license-server project-এর credentials দিয়ে পূরণ করুন
//   4. index.html-এ license-server-config.stub.js-এর ঠিক পরে এই ফাইলের script tag যোগ করুন:
//      <script src="js/core/license-server-config.js" defer></script>
//
// ⚠️ এটি client-দের নিজস্ব Supabase project নয় — সম্পূর্ণ আলাদা project।
// ─────────────────────────────────────────────────────────────────────────────
window.WFA_LICENSE_SERVER = {
  url:     'https://YOUR_LICENSE_SERVER_PROJECT.supabase.co',
  anonKey: 'YOUR_LICENSE_SERVER_ANON_KEY',
};
