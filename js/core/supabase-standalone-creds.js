// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
(function () {
  const s = window.WFA_SUPABASE_SECRETS || {};
  window.WFA_STANDALONE_SUPABASE = {
    url: s.url || '',
    key: s.anonKey || s.anon_key || '',
  };
})();
