// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};

  // ✅ Inline fallback — if supabase-secrets.js is 404 (GitHub Pages)
  // and no stored creds exist, use default project credentials.
  const _fallbackUrl = 'https://fznhiqzrslldybhmgopk.supabase.co';
  const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

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
