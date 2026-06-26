-- ============================================================
-- Wings Fly Academy — Feature 4: SMS Notification System
-- Supabase SQL Migration
-- Run on wfa-testing first, then wfa-production
-- ============================================================

-- 1. Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient          text NOT NULL,
  message            text NOT NULL,
  type               text NOT NULL DEFAULT 'general',
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','failed','skipped')),
  provider_response  text,
  sent_at            timestamptz DEFAULT now()
);

-- 2. Index for fast date-based log queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at
  ON sms_logs (sent_at DESC);

-- 3. Add sms_config column to settings table (if not already there)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS sms_config jsonb DEFAULT '{}'::jsonb;

-- 4. Enable RLS on sms_logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — same pattern as other WFA tables
DROP POLICY IF EXISTS "Allow anon full access" ON sms_logs;
CREATE POLICY "Allow anon full access"
  ON sms_logs FOR ALL TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow auth full access" ON sms_logs;
CREATE POLICY "Allow auth full access"
  ON sms_logs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 6. (Optional) Auto-cleanup: keep only last 500 SMS logs
-- Uncomment if you want automatic pruning:
-- CREATE OR REPLACE FUNCTION prune_sms_logs()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- BEGIN
--   DELETE FROM sms_logs
--   WHERE id IN (
--     SELECT id FROM sms_logs
--     ORDER BY sent_at DESC
--     OFFSET 500
--   );
--   RETURN NULL;
-- END;
-- $$;
-- DROP TRIGGER IF EXISTS trg_prune_sms_logs ON sms_logs;
-- CREATE TRIGGER trg_prune_sms_logs
--   AFTER INSERT ON sms_logs
--   FOR EACH STATEMENT EXECUTE FUNCTION prune_sms_logs();

-- Done! ✅
-- Verify:
--   SELECT * FROM sms_logs LIMIT 5;
--   SELECT id, sms_config FROM settings LIMIT 1;
