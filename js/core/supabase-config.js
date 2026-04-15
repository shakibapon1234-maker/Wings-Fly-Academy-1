// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// ============================================================

const SUPABASE_URL = 'https://fznhiqzrslldybhmgopk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

// Supabase client (global window.supabase is loaded from CDN)
// Guard: slow connection বা CDN block হলে window.supabase undefined হতে পারে
if (!window.supabase) {
  console.error('[Config] Supabase CDN not loaded! Check internet connection. App will run in offline/local-only mode.');
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
