// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// ============================================================
// ⚠️ এখানে আপনার নতুন Supabase account-এর URL ও Key দিন

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// Supabase client initialize
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Table Names
// ============================================================
const TABLES = {
  STUDENTS:    'students',
  FINANCE:     'finance_ledger',
  ACCOUNTS:    'accounts',
  LOANS:       'loans',
  EXAMS:       'exams',
  ATTENDANCE:  'attendance',
  STAFF:       'staff',
  SALARY:      'salary',
  VISITORS:    'visitors',
  NOTICES:     'notices',
  SETTINGS:    'settings',
};

// ============================================================
// Export
// ============================================================
window.SUPABASE_CONFIG = {
  client: supabaseClient,
  TABLES,
};
