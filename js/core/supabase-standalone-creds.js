// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
// Audit note: inline fallbacks below are intentional; RLS is ON — anon key is public by Supabase design.
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};

  // ✅ Inline fallback — if supabase-secrets.js is 404 (GitHub Pages)
  // and no stored creds exist, use default project credentials.
  const _fallbackUrl = 'https://fcjjofmiulantohuxkno.supabase.co';
  const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjampvZm1pdWxhbnRvaHV4a25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNjk5NjAsImV4cCI6MjA5Nzk0NTk2MH0.bWoWyv0Yf2t4IXaF3LYa34z8hzfNgsTv2ugbNMPlTqY';

  let url = stored.url || secrets.url || _fallbackUrl;
  if (url && url.includes('fznhiqzrs1ldybhmgopk')) {
    url = url.replace('fznhiqzrs1ldybhmgopk', 'fznhiqzrslldybhmgopk');
  }
  const key = stored.anonKey || secrets.anonKey || secrets.anon_key || _fallbackKey;

  window.WFA_STANDALONE_SUPABASE = {
    url: url,
    key: key,
  };
})();
