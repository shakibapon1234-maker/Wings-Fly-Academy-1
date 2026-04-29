// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// ============================================================

const SUPABASE_URL = 'https://fznhiqzrslldybhmgopk.supabase.co';
// ⚠️  SECURITY NOTE – Supabase ANON key:
//   This key is intentionally public (it is a scoped, read-only JWT, NOT a secret).
//   Supabase is designed for browser apps — the anon key is ALWAYS visible in source.
//   Real data security is enforced via Row Level Security (RLS) policies in the
//   Supabase dashboard: https://supabase.com/docs/guides/auth/row-level-security
//   ACTION REQUIRED: Ensure RLS is enabled on every table in your Supabase project.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

// Supabase client (global window.supabase is loaded from CDN)
// Guard: slow connection বা CDN block হলে window.supabase undefined হতে পারে
// ✅ Bug #4 Fix: Show user-visible offline warning when Supabase CDN fails
if (!window.supabase) {
  console.error('[Config] Supabase CDN not loaded! Check internet connection. App will run in offline/local-only mode.');
  // Show banner after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'supabase-offline-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:linear-gradient(90deg,#ff6b35,#ff4757)',
      'color:#fff', 'font-size:0.82rem', 'font-weight:700',
      'padding:8px 16px', 'text-align:center',
      'box-shadow:0 2px 12px rgba(255,71,87,0.4)',
      'letter-spacing:0.3px'
    ].join(';');
    banner.innerHTML = '⚠️ Cloud connection unavailable — running in <strong>Offline Mode</strong>. Your data is safe locally. Reload when internet is back.';
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'margin-left:16px;background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-weight:700';
    closeBtn.onclick = () => banner.remove();
    banner.appendChild(closeBtn);
    document.body.prepend(banner);
  });
}

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      }
    })
  : null; // offline mode fallback

window.supabaseClient = supabaseClient;

// ============================================================
// Table Names (DB constants used by all modules)
// ============================================================
const DB = {
  students:    'students',
  finance:     'finance_ledger',
  accounts:    'accounts',
  loans:       'loans',
  exams:       'exams',
  attendance:  'attendance',
  staff:       'staff',
  salary:      'salary',
  visitors:    'visitors',
  notices:     'notices',
  settings:    'settings',
};

// ============================================================
// Supabase Auth Helpers
// ============================================================
const SupabaseAuth = {
  async signIn(email, password) {
    if (!supabaseClient) throw new Error('Supabase client not available (offline mode)');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.warn('[Auth] Sign out error:', error);
  },

  async getSession() {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
  },

  async getUser() {
    if (!supabaseClient) return null;
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },

  isAuthenticated() {
    // Check if there's a valid session in storage
    const key = Object.keys(localStorage).find(k => k.includes('supabase.auth.token') || k.includes('sb-'));
    return !!key;
  },

  // Session change listener (e.g., token expiry)
  onAuthStateChange(callback) {
    if (!supabaseClient) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabaseClient.auth.onAuthStateChange(callback);
  },
};

window.SupabaseAuth = SupabaseAuth;

// ============================================================
// Export
// ============================================================
window.SUPABASE_CONFIG = {
  client: supabaseClient,
  TABLES: DB,
};
window.DB = DB;
