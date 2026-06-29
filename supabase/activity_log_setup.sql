-- ════════════════════════════════════════════════════════════════
-- Wings Fly Academy — Activity Log Table Setup
-- Supabase SQL Editor-এ এটা run করুন
-- ════════════════════════════════════════════════════════════════

-- activity_log table create
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          TEXT PRIMARY KEY,
  action      TEXT,
  type        TEXT,
  description TEXT,
  status      TEXT DEFAULT 'success',
  "user"      TEXT,
  device_id   TEXT,
  time        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS enable
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: anon key দিয়ে read/write করতে পারবে
DROP POLICY IF EXISTS wfa_activity_log_all ON public.activity_log;
CREATE POLICY wfa_activity_log_all ON public.activity_log
  FOR ALL USING (true) WITH CHECK (true);

-- sub_accounts table (যদি না থাকে)
CREATE TABLE IF NOT EXISTS public.sub_accounts (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE,
  password    TEXT,
  name        TEXT,
  role        TEXT,
  permissions JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sub_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_sub_accounts_all ON public.sub_accounts;
CREATE POLICY wfa_sub_accounts_all ON public.sub_accounts
  FOR ALL USING (true) WITH CHECK (true);
