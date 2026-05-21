// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// Credentials: js/core/supabase-secrets.js (gitignored) or Settings → Cloud API
// ============================================================

function _resolveSupabaseCreds() {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored = window.__WFA_SUPABASE_CREDS || {};
  let url = stored.url || secrets.url || '';
  if (url && url.includes('fznhiqzrs1ldybhmgopk')) {
    url = url.replace('fznhiqzrs1ldybhmgopk', 'fznhiqzrslldybhmgopk');
  }
  const anonKey = stored.anonKey || secrets.anonKey || secrets.anon_key || '';
  return { url, anonKey };
}

let { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = _resolveSupabaseCreds();

// Re-read from SecureStorage after login (Settings-saved credentials)
async function _hydrateSupabaseCredsFromStorage() {
  if (typeof SecureStorage === 'undefined') return;
  try {
    let url = await SecureStorage.getItem('wfa_supabase_url');
    const key = await SecureStorage.getItem('wfa_supabase_anon_key');
    if (url && url.includes('fznhiqzrs1ldybhmgopk')) {
      console.warn('[Config] Auto-correcting Supabase URL typo in SecureStorage (1 -> l)');
      url = url.replace('fznhiqzrs1ldybhmgopk', 'fznhiqzrslldybhmgopk');
      await SecureStorage.setItem('wfa_supabase_url', url);
    }
    if (url && key) {
      window.__WFA_SUPABASE_CREDS = { url, anonKey: key };
      window.SUPABASE_URL = url;
      window.SUPABASE_ANON_KEY = key;
      _reinitSupabaseClient();
    }
  } catch (e) {
    console.warn('[Config] Could not load Supabase credentials from SecureStorage:', e.message);
  }
}

function _reinitSupabaseClient() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  
  // ✅ Prevent Multiple GoTrueClient instances warning
  if (window.supabaseClient && window.__WFA_SUPABASE_CREDS && window.supabaseClient.supabaseUrl === SUPABASE_URL) {
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
// যদি না হয়, supabase.min.js defer/async load শেষ হলে retry করো।
(function _initOrRetrySupabaseClient() {
  if (window.supabase) {
    _reinitSupabaseClient();
  } else {
    // supabase lib এখনো ready নয় — script load হলে retry করো
    const waitForLib = setInterval(function() {
      if (window.supabase) {
        clearInterval(waitForLib);
        _reinitSupabaseClient();
        // const update করা যাবে না, তাই window থেকে নাও
        window.supabaseClient = window.supabaseClient || null;
      }
    }, 50);
    // 10 সেকেন্ড পরে give up
    setTimeout(function() { clearInterval(waitForLib); }, 10000);
  }
})();
const supabaseClient = window.supabaseClient || null;

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

// Static reminder only — app cannot read Supabase RLS status from the browser.
// Skip when Supabase Auth session is active (Settings → Cloud API sign-in).
window.addEventListener('load', () => {
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
  client: supabaseClient,
  TABLES: DB,
  saveCloudCredentials: async (url, anonKey) => {
    if (typeof SecureStorage === 'undefined') throw new Error('SecureStorage unavailable');
    let cleanUrl = url.trim();
    if (cleanUrl.includes('fznhiqzrs1ldybhmgopk')) {
      cleanUrl = cleanUrl.replace('fznhiqzrs1ldybhmgopk', 'fznhiqzrslldybhmgopk');
    }
    await SecureStorage.setItem('wfa_supabase_url', cleanUrl);
    await SecureStorage.setItem('wfa_supabase_anon_key', anonKey.trim());
    window.__WFA_SUPABASE_CREDS = { url: cleanUrl, anonKey: anonKey.trim() };
    window.SUPABASE_URL = cleanUrl;
    window.SUPABASE_ANON_KEY = anonKey.trim();
    _reinitSupabaseClient();
    window.SUPABASE_CONFIG.client = window.supabaseClient;
    // ✅ FIX: Reset sync anchor so next pull is FULL (not incremental from stale timestamp)
    if (window.SyncEngine && typeof window.SyncEngine.resetSyncAnchor === 'function') {
      window.SyncEngine.resetSyncAnchor();
    }
    return window.supabaseClient;
  },
};
window.DB = DB;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
