// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
// Audit note: inline fallbacks below are intentional; RLS is ON — anon key is public by Supabase design.
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};

  // Ignore placeholder values from example/stub credentials
  const isPlaceholderUrl = secrets.url && (secrets.url.includes('YOUR_PROJECT') || secrets.url === '');
  const isPlaceholderKey = secrets.anonKey && (secrets.anonKey.includes('YOUR_SUPABASE_ANON_KEY') || secrets.anonKey === '');

  const activeSecrets = {
    url: isPlaceholderUrl ? null : secrets.url,
    anonKey: isPlaceholderKey ? null : (secrets.anonKey || secrets.anon_key)
  };

  // ✅ Inline fallback — if supabase-secrets.js is 404 (GitHub Pages)
  // and no stored creds exist, use default project credentials.
  const _fallbackUrl = 'https://fznhiqzrslldybhmgopk.supabase.co';
  const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

  let url = stored.url || activeSecrets.url || _fallbackUrl;
  if (url && url.includes('fznhiqzrs1ldybhmgopk')) {
    url = url.replace('fznhiqzrs1ldybhmgopk', 'fznhiqzrslldybhmgopk');
  }
  const key = stored.anonKey || activeSecrets.anonKey || _fallbackKey;

  window.WFA_STANDALONE_SUPABASE = {
    url: url,
    key: key,
  };
})();
