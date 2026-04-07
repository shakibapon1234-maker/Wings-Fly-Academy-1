// ============================================================
// Wings Fly Aviation Academy — Supabase Configuration
// ============================================================

const SUPABASE_URL = 'https://fznhiqzrslldybhmgopk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bmhpcXpyc2xsZHliaG1nb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjYzNjcsImV4cCI6MjA5MTE0MjM2N30.p0UJzwfE3XxcUmGUOhIxebXASGL1KTJuKYdfdtYtSBw';

// Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
// Export
// ============================================================
window.SUPABASE_CONFIG = {
  client: supabaseClient,
  TABLES: DB,
};
window.DB = DB;
