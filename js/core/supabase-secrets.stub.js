// Committed stub — avoids 404/MIME errors when gitignored supabase-secrets.js is absent.
// Override locally: copy supabase-secrets.example.js → supabase-secrets.js (gitignored)
// and add a second script tag after this file, OR use Settings → Cloud API.
window.WFA_SUPABASE_SECRETS = window.WFA_SUPABASE_SECRETS || {};
