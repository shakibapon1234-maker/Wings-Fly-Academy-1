// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// ============================================================
// ⚠️ এখানে আপনার নতুন Supabase account-এর URL ও Key দিন

const SUPABASE_URL = 'https://cwwyhtarnkozukekebvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3d3lodGFybmtvenVrZWtlYnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTE5NzUsImV4cCI6MjA4OTQyNzk3NX0.XCJe9A5_ymXQQqK5KVQHJqswUXCuopUi_NYv7T-WWn8';

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
