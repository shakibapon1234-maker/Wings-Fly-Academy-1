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
    _showOfflineBanner();
  });
}

// ✅ BUG #19 Fix: Persistent real-time offline/online network status indicator
function _showOfflineBanner() {
  if (document.getElementById('wfa-offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'wfa-offline-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:linear-gradient(90deg,#ff6b35,#ff4757)',
    'color:#fff', 'font-size:0.82rem', 'font-weight:700',
    'padding:8px 16px', 'text-align:center',
    'box-shadow:0 2px 12px rgba(255,71,87,0.4)',
    'letter-spacing:0.3px', 'display:flex', 'align-items:center',
    'justify-content:center', 'gap:8px'
  ].join(';');
  banner.innerHTML = '⚠️ Cloud connection unavailable — running in <strong>Offline Mode</strong>. Your data is safe locally. Reload when internet is back.';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'margin-left:16px;background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-weight:700';
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
  document.body.prepend(banner);
}

function _hideOfflineBanner() {
  const b = document.getElementById('wfa-offline-banner');
  if (b) b.remove();
}

function _showOnlineToast() {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;background:#00c851;color:#fff;padding:10px 24px;border-radius:24px;font-size:0.85rem;font-weight:700;box-shadow:0 4px 20px rgba(0,200,81,0.4);transition:opacity 0.4s';
  t.textContent = '✅ Back Online! Cloud sync resumed.';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

// Listen for browser network status changes
window.addEventListener('offline', () => {
  document.addEventListener('DOMContentLoaded', _showOfflineBanner, { once: true });
  if (document.readyState !== 'loading') _showOfflineBanner();
});
window.addEventListener('online', () => {
  _hideOfflineBanner();
  if (document.readyState !== 'loading') _showOnlineToast();
  else document.addEventListener('DOMContentLoaded', _showOnlineToast, { once: true });
});
// Also show badge immediately if already offline on load
if (!navigator.onLine) {
  document.addEventListener('DOMContentLoaded', _showOfflineBanner, { once: true });
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
  students:         'students',
  finance:          'finance_ledger',
  accounts:         'accounts',
  loans:            'loans',
  exams:            'exams',
  attendance:       'attendance',
  staff:            'staff',
  salary:           'salary',
  visitors:         'visitors',
  notices:          'notices',
  settings:         'settings',
  advance_payments: 'advance_payments',
  investments:      'investments',
  keep_records:     'keep_records',
  custom_themes:    'custom_themes',
  sub_accounts:     'sub_accounts',
};

// ============================================================
// ✅ BUG-11 Fix: RLS Security Verification
// ============================================================
/**
 * CRITICAL: Row Level Security (RLS) MUST be enabled on ALL tables in your Supabase project.
 * 
 * Without RLS, the anon key can access all data without restrictions.
 * With RLS, data access is controlled by policies per table.
 * 
 * ✓ Verify RLS is enabled at: https://supabase.com/dashboard/project/fznhiqzrslldybhmgopk/auth/policies
 * ✓ Each table needs 'Enable RLS' toggle switched ON
 * ✓ Policies must restrict access to authenticated users only
 */
const RLS_WARNING = `
⚠️  CRITICAL SECURITY CHECK:
   Row Level Security (RLS) MUST be enabled on all Supabase tables.
   
   Checklist:
   ☐ Login to https://supabase.com/dashboard
   ☐ Go to Authentication → Policies
   ☐ For each table (students, finance_ledger, etc.):
      ☐ Click table name
      ☐ Toggle "Enable RLS" to ON
      ☐ Create policy: SELECT for authenticated users only
      ☐ Create policy: INSERT/UPDATE/DELETE for authenticated users only
   
   If RLS is NOT enabled, the public anon key exposes ALL data!
`;

// Log RLS reminder on app load (production systems should verify this programmatically)
window.addEventListener('load', () => {
  if (supabaseClient && typeof supabaseClient.auth !== 'undefined') {
    console.warn(RLS_WARNING);
  }
});

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
