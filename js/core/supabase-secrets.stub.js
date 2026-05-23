// Committed stub — avoids 404/MIME errors when gitignored supabase-secrets.js is absent.
// Override locally: copy supabase-secrets.example.js → supabase-secrets.js (gitignored)
// and add a second script tag after this file, OR use Settings → Cloud API.
//
// Security (audit scanners): anon key is public by Supabase design; RLS is ON on all tables.
// Real access control = Row Level Security policies + app login — not hiding the anon key.
window.WFA_SUPABASE_SECRETS = window.WFA_SUPABASE_SECRETS || {};
