// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
// Audit note: inline fallbacks below are intentional; RLS is ON — anon key is public by Supabase design.
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};

  // ✅ SECURITY FIX: restrict fallback credentials to main admin project path or local dev only.
  const isMainAdminDeployment = 
    window.location.pathname.includes('/Wings-Fly-Academy-1/') || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.protocol === 'file:';

  const _fallbackUrl = isMainAdminDeployment ? 'https://fznhiqzrslldybhmgopk.supabase.co' : null;
  const _fallbackKey = isMainAdminDeployment ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

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
