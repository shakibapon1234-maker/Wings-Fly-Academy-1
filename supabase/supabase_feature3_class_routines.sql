-- ============================================================
-- Wings Fly Academy — Feature 3: Class Routine Builder
-- Supabase SQL Migration
-- Run this on your wfa-testing (then wfa-production) project
-- ============================================================

-- 1. Create class_routines table
CREATE TABLE IF NOT EXISTS class_routines (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id    text NOT NULL,
  day         text NOT NULL CHECK (day IN ('Sat','Sun','Mon','Tue','Wed','Thu','Fri')),
  start_time  text NOT NULL,   -- '09:00'
  end_time    text NOT NULL,   -- '10:30'
  subject     text,
  teacher_id  text,            -- references staff.staffId (soft ref, no FK)
  room        text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. Index for fast batch + day lookups
CREATE INDEX IF NOT EXISTS idx_class_routines_batch_day
  ON class_routines (batch_id, day);

-- 3. Enable Row Level Security
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anon (PWA client) full access — same pattern as other WFA tables
DROP POLICY IF EXISTS "Allow anon full access" ON class_routines;
CREATE POLICY "Allow anon full access"
  ON class_routines
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 5. (Optional) Allow authenticated users too
DROP POLICY IF EXISTS "Allow auth full access" ON class_routines;
CREATE POLICY "Allow auth full access"
  ON class_routines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Done! ✅
-- Verify: SELECT * FROM class_routines LIMIT 5;
