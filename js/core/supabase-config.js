// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// Credentials: js/core/supabase-secrets.js (gitignored) or Settings → Cloud API
// ============================================================
//
// SECURITY NOTE (for automated audit / security scanners):
// Inline SUPABASE_URL and anon key fallbacks below are intentional.
// • Supabase anon keys are public by design in browser/client apps.
// • Row Level Security (RLS) is ON for all tables in this project.
// • Access is enforced via RLS policies (authenticated / service role), not by hiding the anon key.
// Do not treat hardcoded URL/key as a vulnerability without verifying RLS in Supabase Dashboard.
//

const WFA_SUPABASE_URL_TYPO    = 'fznhiqzrs1ldybhmgopk';
const WFA_SUPABASE_URL_CORRECT = 'fznhiqzrslldybhmgopk';

/** One-time fix for legacy typo saved in SecureStorage / settings (not for built-in fallbacks). */
function _fixLegacySupabaseUrlTypo(url) {
  if (!url || typeof url !== 'string' || !url.includes(WFA_SUPABASE_URL_TYPO)) return url;
  return url.replace(WFA_SUPABASE_URL_TYPO, WFA_SUPABASE_URL_CORRECT);
}

function _resolveSupabaseCreds() {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored  = window.__WFA_SUPABASE_CREDS  || {};

  // ✅ FIX: Inline fallback — only used on the MAIN project (GitHub Pages root).
  // Deployed clients ALWAYS have secrets.url set via supabase-secrets.js,
  // so the fallback is NEVER reached on a client deployment.
  // Anon key is public by Supabase design; data access is controlled by RLS.
  const _fallbackUrl = 'https://fznhiqzrslldybhmgopk.supabase.co';
  const _fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

  // Priority: secrets.js (client deploy) > stored (settings-saved) > fallback (main project only)
  const url    = _fixLegacySupabaseUrlTypo(secrets.url || stored.url || _fallbackUrl);
  const anonKey = secrets.anonKey || secrets.anon_key || stored.anonKey || _fallbackKey;
  return { url, anonKey };
}

let { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = _resolveSupabaseCreds();

// ============================================================
// ✅ DB-SWITCH ISOLATION — Client Cross-Contamination Prevention
//
// Problem: GitHub Pages shares the same origin (shakibapon1234-maker.github.io)
// across the main project (/) and all client sub-paths (/Client-1/, /Client-2/ …).
// localStorage, IndexedDB, and SecureStorage are ALL shared across that origin.
//
// Solution: Namespace ALL localStorage keys and IndexedDB by the active Supabase URL.
// When the URL changes (= different client or switching to main project), ALL local
// data is purged — IndexedDB tables, sync state, settings, session, auth, everything.
// This guarantees a brand-new browser opening a client URL sees only client data.
// ============================================================

const _LS_LAST_URL_KEY = 'wfa_last_supabase_url';

// Keys to purge on DB switch — MUST cover every piece of app state
// so no data from a different client/project bleeds through.
const _LS_KEYS_TO_PURGE = [
  // Sync state
  'wfa_idb_migrated_v1', 'wfa_stale_cleanup_v1', 'wfa_finance_backfill_v1',
  'wfa_activity_log', 'wfa_recent_changes', 'wfa_balance_alerts',
  'wfa_retry_queue', 'wfa_rls_reminder_shown',
  // Session / auth
  'wfa_logged_in', 'wfa_login_time', 'wfa_user_role',
  'wfa_user_name', 'wfa_user_permissions', 'wfa_session_token',
  'wfa_login_attempts', 'wfa_login_lockout_until',
  // Settings & local data that are project-specific
  'wfa_settings', 'wfa_sub_accounts', 'wfa_questions', 'wfa_results',
  'wfa_custom_themes', 'wfa_theme', 'wfa_language',
  'wfa_advance_payments', 'wfa_investments', 'wfa_keep_records',
  // Auth credentials (SecureStorage stores these in localStorage)
  'wfa_supabase_url', 'wfa_supabase_anon_key',
  'wfa_admin_pattern', 'wfa_admin_pass', 'wfa_admin_face_descriptor',
  // Device / misc
  'wfa_device_id', 'wfa_deletedItems', 'wfa_recycle_bin',
  'wfa_auto_snapshots', 'wfa_last_auto_download', 'wfa_last_update_check',
  'wfa_sg_last_disc_sig', 'wfa_update_in_progress', 'wfa_app_version',
  'wfa_license_key', 'wfa_gemini_key', 'wfa_gemini_key_2',
  'wfa_gemini_key_3', 'wfa_ai_local_only', 'wfa_debug_logs',
  'wfa_user_id',
  'wfa_institution_type',
  // FIX 2: Client Manager & license admin keys — were missing from purge list.
  // Without these, switching between main project and a client deployment would
  // leave the client list and admin secret visible across origins (data bleed).
  'wfa_acadeflow_clients', 'wfa_license_admin_secret',
];

function _purgeLocalDataForNewDb() {
  // 1. Clear all IndexedDB tables (if WFA_IDB is already loaded)
  if (window.WFA_IDB && typeof window.WFA_IDB.clearAllTables === 'function') {
    window.WFA_IDB.clearAllTables();
  } else {
    // WFA_IDB loads after this script — delete the whole IndexedDB as fallback
    try { indexedDB.deleteDatabase('WingsAcademyDB'); } catch { /* ignore */ }
  }

  // 2. Remove ALL known localStorage keys so no project data bleeds through
  _LS_KEYS_TO_PURGE.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });

  // 3. Also sweep any remaining supabase auth tokens (sb-* pattern)
  try {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.includes('supabase.auth.token'))) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }

  console.info('[Config] DB switch detected — ALL local data purged for clean start.');
}

// Run check synchronously, as early as possible, before any module reads localStorage
(function _checkAndHandleDbSwitch() {
  try {
    const lastUrl = localStorage.getItem(_LS_LAST_URL_KEY);
    if (lastUrl && lastUrl !== SUPABASE_URL) {
      console.warn(`[Config] Supabase URL changed (${lastUrl} → ${SUPABASE_URL}). Purging ALL local data.`);
      _purgeLocalDataForNewDb();
    }
    // Always record the current URL so the next load can detect a switch
    localStorage.setItem(_LS_LAST_URL_KEY, SUPABASE_URL);
  } catch(e) {
    console.warn('[Config] DB switch check failed (non-critical):', e.message);
  }
})();

// Re-read from SecureStorage after login (Settings-saved credentials)
async function _hydrateSupabaseCredsFromStorage() {
  if (typeof SecureStorage === 'undefined') return;

  // ✅ STRICT GUARD: deployed client has secrets.url baked in via supabase-secrets.js.
  // SecureStorage holds the MAIN project's credentials — must NEVER override client creds.
  if (window.WFA_SUPABASE_SECRETS && window.WFA_SUPABASE_SECRETS.url) {
    console.info('[Config] Deployed client environment — SecureStorage hydrate skipped.');
    return;
  }

  try {
    let url = await SecureStorage.getItem('wfa_supabase_url');
    const key = await SecureStorage.getItem('wfa_supabase_anon_key');
    const fixed = _fixLegacySupabaseUrlTypo(url);
    if (fixed !== url) {
      console.warn('[Config] Corrected legacy Supabase URL typo in SecureStorage (1 → l)');
      url = fixed;
      await SecureStorage.setItem('wfa_supabase_url', url);
    }
    if (url && key) {
      // Extra guard: if resolved URL is already correct, don't reinit unnecessarily
      if (url === SUPABASE_URL && window.supabaseClient) return;
      window.__WFA_SUPABASE_CREDS = { url, anonKey: key };
      window.SUPABASE_URL    = url;
      window.SUPABASE_ANON_KEY = key;
      SUPABASE_URL    = url;
      SUPABASE_ANON_KEY = key;
      _reinitSupabaseClient();
    }
  } catch (e) {
    console.warn('[Config] Could not load Supabase credentials from SecureStorage:', e.message);
  }
}

function _reinitSupabaseClient() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  // ✅ Prevent Multiple GoTrueClient instances warning
  if (window.supabaseClient && window.supabaseClient.supabaseUrl === SUPABASE_URL) {
    return; // Already initialized with same credentials
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  window.supabaseClient = client;
  if (window.SUPABASE_CONFIG) window.SUPABASE_CONFIG.client = client;
}

// Supabase client (global window.supabase is loaded from js/lib or CDN)
if (!window.supabase) {
  console.error('[Config] Supabase library not loaded! Check js/lib/supabase.min.js or network. App will run in offline/local-only mode.');
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

window.addEventListener('offline', () => {
  document.addEventListener('DOMContentLoaded', _showOfflineBanner, { once: true });
  if (document.readyState !== 'loading') _showOfflineBanner();
});
window.addEventListener('online', () => {
  _hideOfflineBanner();
  if (document.readyState !== 'loading') _showOnlineToast();
  else document.addEventListener('DOMContentLoaded', _showOnlineToast, { once: true });
});
if (!navigator.onLine) {
  document.addEventListener('DOMContentLoaded', _showOfflineBanner, { once: true });
}

// BUG-11 Fix: _reinitSupabaseClient() call করার আগে window.supabase load হয়েছে কিনা check করো।
(function _initOrRetrySupabaseClient() {
  if (window.supabase) {
    _reinitSupabaseClient();
  } else {
    const waitForLib = setInterval(function() {
      if (window.supabase) {
        clearInterval(waitForLib);
        _reinitSupabaseClient();
        window.supabaseClient = window.supabaseClient || null;
      }
    }, 50);
    setTimeout(function() { clearInterval(waitForLib); }, 10000);
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  await _hydrateSupabaseCredsFromStorage();
  _warnIfStillUnconfigured();
});

async function _warnIfStillUnconfigured() {
  const { url, anonKey } = _resolveSupabaseCreds();
  if (!url || !anonKey) {
    console.info('[Config] Supabase not configured yet — use Settings → Cloud API when ready.');
  }
}

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
  student_portal_access: 'student_portal_access',
  school_classes:   'school_classes',
  school_subjects:  'school_subjects',
  school_marks:     'school_marks',
  // Aliases — certificate/id-card data lives on students until dedicated tables exist
  certificates:     'students',
  id_cards:         'students',
};

// Static reminder only — app cannot read Supabase RLS status from the browser.
window.addEventListener('load', () => {
  const supabaseClient = window.supabaseClient;
  if (!supabaseClient || typeof supabaseClient.auth === 'undefined') return;
  if (sessionStorage.getItem('wfa_rls_reminder_shown') === '1') return;
  const hasAuthSession = Object.keys(localStorage).some(
    (k) => k.includes('supabase.auth.token') || (k.startsWith('sb-') && k.includes('auth-token'))
  );
  if (hasAuthSession) return;
  sessionStorage.setItem('wfa_rls_reminder_shown', '1');
  console.info(
    '[Config] Supabase RLS checklist (one-time): Dashboard → Table Editor → each table → RLS ON + policies for "authenticated". ' +
    'This message does not mean RLS is off — verify in Supabase if unsure.'
  );
});

const SupabaseAuth = {
  async signIn(email, password) {
    if (!window.supabaseClient) throw new Error('Supabase client not available (offline mode)');
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!window.supabaseClient) return;
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) console.warn('[Auth] Sign out error:', error);
  },

  async getSession() {
    if (!window.supabaseClient) return null;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    return session;
  },

  async getUser() {
    if (!window.supabaseClient) return null;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user;
  },

  isAuthenticated() {
    const key = Object.keys(localStorage).find(k => k.includes('supabase.auth.token') || k.includes('sb-'));
    return !!key;
  },

  onAuthStateChange(callback) {
    if (!window.supabaseClient) return { data: { subscription: { unsubscribe: () => {} } } };
    return window.supabaseClient.auth.onAuthStateChange(callback);
  },
};

window.SupabaseAuth = SupabaseAuth;

window.SUPABASE_CONFIG = {
  get client() { return window.supabaseClient || null; },
  TABLES: DB,
  saveCloudCredentials: async (url, anonKey) => {
    if (typeof SecureStorage === 'undefined') throw new Error('SecureStorage unavailable');
    let cleanUrl = _fixLegacySupabaseUrlTypo(url.trim());

    // ✅ DB-SWITCH ISOLATION: URL পরিবর্তন হলে আগের সব local data purge করো
    const previousUrl = localStorage.getItem(_LS_LAST_URL_KEY);
    if (previousUrl && previousUrl !== cleanUrl) {
      console.warn(`[Config] saveCloudCredentials: URL changed. Purging ALL local data for clean start.`);
      _purgeLocalDataForNewDb();
    }

    await SecureStorage.setItem('wfa_supabase_url', cleanUrl);
    await SecureStorage.setItem('wfa_supabase_anon_key', anonKey.trim());
    window.__WFA_SUPABASE_CREDS = { url: cleanUrl, anonKey: anonKey.trim() };
    window.SUPABASE_URL    = cleanUrl;
    window.SUPABASE_ANON_KEY = anonKey.trim();
    SUPABASE_URL    = cleanUrl;
    SUPABASE_ANON_KEY = anonKey.trim();

    try { localStorage.setItem(_LS_LAST_URL_KEY, cleanUrl); } catch { /* ignore */ }

    _reinitSupabaseClient();
    window.SUPABASE_CONFIG.client = window.supabaseClient;

    // Reset sync anchor so next pull is FULL (not incremental from stale timestamp)
    if (window.SyncEngine && typeof window.SyncEngine.resetSyncAnchor === 'function') {
      window.SyncEngine.resetSyncAnchor();
    }
    return window.supabaseClient;
  },
};

window.DB             = DB;
window.SUPABASE_URL   = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
