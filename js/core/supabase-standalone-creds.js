// Shared Supabase URL/key for standalone HTML pages (certificate, exam, visitor-form, migrate).
// Audit note: inline fallbacks below are intentional; RLS is ON — anon key is public by Supabase design.
//
// ✅ FIX (client-contamination bug): previously this fell back to the ADMIN's
// production URL/key whenever hostname was localhost/127.0.0.1/file: — meaning
// any local test of a client copy silently hit the admin's live database.
// Now the admin fallback is ONLY used on the literal main-admin deployment path.
// Client deployments get their own real URL/key baked directly into this file
// by new-client.ps1 (see STEP 5 there) — they never depend on this fallback.
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};

  const isMainAdminDeployment = window.location.pathname.includes('/Wings-Fly-Academy-1/');

  const _fallbackUrl = isMainAdminDeployment ? 'https://fznhiqzrslldybhmgopk.supabase.co' : null;
  const _fallbackKey = isMainAdminDeployment ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw' : null;

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
