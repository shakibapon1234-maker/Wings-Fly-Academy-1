/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/core/supabase-config.js
   Supabase connection — এখানে শুধু URL ও Key বসাবেন
════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://cwwyhtarnkozukekebvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3d3lodGFybmtvenVrZWtlYnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTE5NzUsImV4cCI6MjA4OTQyNzk3NX0.XCJe9A5_ymXQQqK5KVQHJqswUXCuopUi_NYv7T-WWn8';

/* Supabase client তৈরি */
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Table Names (একবার এখানে ঠিক করলেই সব জায়গায় ঠিক হবে) ── */
const DB = {
  students:    'students',
  finance:     'finance_ledger',
  accounts:    'accounts',
  loans:       'loans',
  exam:        'exam_registrations',
  attendance:  'attendance',
  staff:       'staff',
  salary:      'salary_records',
  visitors:    'visitors',
  notices:     'notices',
  settings:    'settings',
};

/* ── Academy Settings Key ── */
const SETTINGS_KEY = 'wings_fly_settings';
const ADMIN_KEY    = 'wings_fly_admin';
