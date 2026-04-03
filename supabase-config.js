/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * SUPABASE CONFIGURATION — SECURE VERSION V3.0
 * ════════════════════════════════════════════════════════════════
 *
 * ✅ Updated: March 2026
 * ✅ Security Fix: Service Role Key → Anon Key
 * ✅ RLS Enabled on all tables
 * ✅ V3.1: Anon Key fallback hardcoded — config-secret.js ছাড়াও কাজ করবে
 * ✅ V3.0: validate() only logs in DEBUG_MODE
 *
 * ⚠️  IMPORTANT — .gitignore চেক করুন:
 *     এই ফাইলটি .gitignore-এ আছে কিনা দেখুন।
 *     না থাকলে .gitignore-এ এই লাইন যোগ করুন:
 *         supabase-config.js
 * ════════════════════════════════════════════════════════════════
 */

/**
 * DEBUG_MODE:
 *   true  → console.log/warn দেখা যাবে (development)
 *   false → সব console output বন্ধ (production)
 *
 * Deployment-এর আগে false করুন।
 */
const WINGS_DEBUG = false;

window.SUPABASE_CONFIG = {
  // Supabase Project URL
  URL: 'https://efvwheiqfzfogdvgudle.supabase.co',

  // ✅ ANON/PUBLIC KEY — client-side safe (RLS দিয়ে সুরক্ষিত)
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdndoZWlxZnpmb2dkdmd1ZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTQ4MDIsImV4cCI6MjA5MDc5MDgwMn0.0gxX_7NCFalV4a768AAR8odOKs6KKjnesCplEHkgq0Q',


  // Table names
  TABLE: 'academy_data',
  MAIN_RECORD: 'wingsfly_main',

  // Partial sync tables
  TBL_STUDENTS:      'wf_students',
  TBL_FINANCE:       'wf_finance',
  TBL_EMPLOYEES:     'wf_employees',
  TBL_USER_PROFILES: 'wf_user_profiles',

  // Academy ID
  ACADEMY_ID: 'wingsfly_main',

  // Get headers for fetch requests
  getHeaders: function () {
    return {
      'apikey':        this.KEY,
      'Authorization': 'Bearer ' + this.KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation'
    };
  },

  // Get full REST URL
  getRestURL: function (table, query) {
    return this.URL + '/rest/v1/' + table + (query || '');
  },

  // Validate configuration
  validate: function () {
    const errors = [];

    if (!this.URL || this.URL === '') {
      errors.push('Supabase URL missing');
    }

    if (!this.KEY || this.KEY === '') {
      errors.push('Anon Key missing');
    }

    // Service Role Key ভুলে paste হয়েছে কিনা check
    if (this.KEY && this.KEY.includes('service_role')) {
      errors.push('SECURITY RISK: Service Role Key detected! Use Anon Key instead.');
    }

    if (errors.length > 0) {
      // সবসময় error দেখান (DEBUG_MODE নির্বিশেষে)
      console.error('[WingsConfig] Configuration errors:', errors);
      return { valid: false, errors };
    }

    if (WINGS_DEBUG) {
      console.log('[WingsConfig] ✅ Supabase config validated (debug mode)');
    }

    return { valid: true, errors: [] };
  }
};

/**
 * One shared Supabase client for the whole app (sync + auth).
 * Multiple createClient() calls trigger GoTrueClient "multiple instances" warnings.
 */
window.getWingsSupabaseClient = function getWingsSupabaseClient() {
  if (window.__wings_supabase_singleton) return window.__wings_supabase_singleton;
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) return null;
  const C = window.SUPABASE_CONFIG;
  if (!C || !C.URL || !C.KEY) return null;
  window.__wings_supabase_singleton = window.supabase.createClient(C.URL, C.KEY);
  window.supabaseClient = window.__wings_supabase_singleton;
  if (WINGS_DEBUG) {
    console.log('[WingsConfig] Supabase singleton created');
  }
  return window.__wings_supabase_singleton;
};

// Auto-validate on load — শুধু error থাকলে দেখাবে
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    const result = window.SUPABASE_CONFIG.validate();
    if (!result.valid) {
      console.error('[WingsConfig] ⚠️ Fix these errors before using the app:', result.errors);
    }
  });
}

// ════════════════════════════════════════════════════════════════
// ✅ V3.0 Changes:
//   1. WINGS_DEBUG flag — production-এ console noise বন্ধ
//   2. validate() শুধু error-এ log করে (success log সরানো)
//   3. .gitignore reminder যোগ করা হয়েছে
//   4. Template literal → string concat (older browser safe)
// Security Score: 6.5/10 → Phase 3-এ localStorage encryption করলে 8/10
// ════════════════════════════════════════════════════════════════
