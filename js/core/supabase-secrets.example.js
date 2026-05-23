// Optional local override (gitignored): copy to js/core/supabase-secrets.js
// Production uses supabase-secrets.stub.js + Settings → Cloud API + inline fallback.
//
// Anon key may appear in client code — that is normal. This project uses RLS ON on all tables.
window.WFA_SUPABASE_SECRETS = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
};
