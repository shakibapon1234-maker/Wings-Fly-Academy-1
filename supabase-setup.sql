-- ============================================================
-- Wings Fly Aviation Academy — Supabase Table Setup
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: fznhiqzrslldybhmgopk
-- ============================================================

-- ── STUDENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id          TEXT PRIMARY KEY,
  student_id  TEXT,
  name        TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  course      TEXT,
  batch       TEXT,
  session     TEXT,
  total_fee   NUMERIC DEFAULT 0,
  paid        NUMERIC DEFAULT 0,
  admission_date TEXT,
  status      TEXT DEFAULT 'Active',
  photo_url   TEXT,
  guardian    TEXT,
  guardian_phone TEXT,
  dob         TEXT,
  gender      TEXT,
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── FINANCE LEDGER ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_ledger (
  id          TEXT PRIMARY KEY,
  type        TEXT,
  category    TEXT,
  description TEXT,
  amount      NUMERIC DEFAULT 0,
  method      TEXT DEFAULT 'Cash',
  date        TEXT,
  student_id  TEXT,
  student_name TEXT,
  batch       TEXT,
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── ACCOUNTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  type        TEXT,
  name        TEXT,
  balance     NUMERIC DEFAULT 0,
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── LOANS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id          TEXT PRIMARY KEY,
  person_name TEXT,
  direction   TEXT,
  amount      NUMERIC DEFAULT 0,
  returned    NUMERIC DEFAULT 0,
  date        TEXT,
  due_date    TEXT,
  method      TEXT DEFAULT 'Cash',
  purpose     TEXT,
  status      TEXT DEFAULT 'Outstanding',
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── EXAMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id           TEXT PRIMARY KEY,
  reg_id       TEXT,
  student_id   TEXT,
  student_name TEXT,
  batch        TEXT,
  session      TEXT,
  subject      TEXT,
  exam_date    TEXT,
  exam_fee     NUMERIC DEFAULT 0,
  fee_paid     BOOLEAN DEFAULT false,
  grade        TEXT,
  marks        NUMERIC,
  status       TEXT DEFAULT 'Registered',
  note         TEXT,
  _device      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── ATTENDANCE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  date        TEXT,
  student_id  TEXT,
  student_name TEXT,
  batch       TEXT,
  status      TEXT DEFAULT 'Present',
  note        TEXT,
  type        TEXT DEFAULT 'student',
  staff_id    TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── STAFF ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT,
  name        TEXT,
  role        TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  salary      NUMERIC DEFAULT 0,
  joining_date TEXT,
  resign_date TEXT,
  status      TEXT DEFAULT 'Active',
  photo_url   TEXT,
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── SALARY ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT,
  staff_name  TEXT,
  month       TEXT,
  year        TEXT,
  basic       NUMERIC DEFAULT 0,
  bonus       NUMERIC DEFAULT 0,
  deduction   NUMERIC DEFAULT 0,
  total       NUMERIC DEFAULT 0,
  paid        NUMERIC DEFAULT 0,
  method      TEXT DEFAULT 'Cash',
  date        TEXT,
  status      TEXT DEFAULT 'Pending',
  note        TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── VISITORS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitors (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  phone       TEXT,
  course      TEXT,
  remarks     TEXT,
  date        TEXT,
  status      TEXT DEFAULT 'New',
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── NOTICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id          TEXT PRIMARY KEY,
  text        TEXT,
  type        TEXT DEFAULT 'info',
  expires_at  TEXT,
  _device     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id              TEXT PRIMARY KEY,
  academy_name    TEXT DEFAULT 'Wings Fly Aviation Academy',
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  admin_password  TEXT DEFAULT 'admin123',
  active_batch    TEXT,
  _device         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- ENABLE ROW LEVEL SECURITY (RLS) — Open access for anon key
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'students','finance_ledger','accounts','loans','exams',
    'attendance','staff','salary','visitors','notices','settings'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    
    -- Allow all operations for anon role (single-admin app)
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS "Allow all for anon" ON %I
      FOR ALL USING (true) WITH CHECK (true)
    ', t, t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- ENABLE REALTIME for all tables
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'students','finance_ledger','accounts','loans','exams',
    'attendance','staff','salary','visitors','notices','settings'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already added
    END;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- DONE! All 11 tables created with RLS + Realtime enabled.
-- ════════════════════════════════════════════════════════════
