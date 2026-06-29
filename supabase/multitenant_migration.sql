-- ============================================================
-- AcadeFlow — Multi-Tenant Migration
-- Run this in YOUR (Wings Fly Academy) Supabase SQL Editor
-- This adds academy_id to all tables for client isolation
-- ============================================================

-- STEP 1: Add academy_id column to all tables
-- Default 'WFA_OWNER' tags all existing WFA data automatically

ALTER TABLE public.settings        ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.salary          ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.students        ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.finance_ledger  ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.accounts        ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.loans           ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.exams           ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.attendance      ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.staff           ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.visitors        ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.notices         ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.advance_payments ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.investments     ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.keep_records    ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.custom_themes   ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.sub_accounts    ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';
ALTER TABLE public.activity_log    ADD COLUMN IF NOT EXISTS academy_id text NOT NULL DEFAULT 'WFA_OWNER';

-- certificate_tokens and push_subscriptions are device-level, no academy_id needed

-- STEP 2: Create indexes for fast filtering by academy_id
CREATE INDEX IF NOT EXISTS idx_settings_academy        ON public.settings(academy_id);
CREATE INDEX IF NOT EXISTS idx_salary_academy          ON public.salary(academy_id);
CREATE INDEX IF NOT EXISTS idx_students_academy        ON public.students(academy_id);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_academy  ON public.finance_ledger(academy_id);
CREATE INDEX IF NOT EXISTS idx_accounts_academy        ON public.accounts(academy_id);
CREATE INDEX IF NOT EXISTS idx_loans_academy           ON public.loans(academy_id);
CREATE INDEX IF NOT EXISTS idx_exams_academy           ON public.exams(academy_id);
CREATE INDEX IF NOT EXISTS idx_attendance_academy      ON public.attendance(academy_id);
CREATE INDEX IF NOT EXISTS idx_staff_academy           ON public.staff(academy_id);
CREATE INDEX IF NOT EXISTS idx_visitors_academy        ON public.visitors(academy_id);
CREATE INDEX IF NOT EXISTS idx_notices_academy         ON public.notices(academy_id);
CREATE INDEX IF NOT EXISTS idx_advance_academy         ON public.advance_payments(academy_id);
CREATE INDEX IF NOT EXISTS idx_investments_academy     ON public.investments(academy_id);
CREATE INDEX IF NOT EXISTS idx_keep_records_academy    ON public.keep_records(academy_id);
CREATE INDEX IF NOT EXISTS idx_custom_themes_academy   ON public.custom_themes(academy_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_academy    ON public.sub_accounts(academy_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_academy    ON public.activity_log(academy_id);

-- STEP 3: Fix sub_accounts unique constraint
-- Previously username was globally unique; now unique per academy
ALTER TABLE public.sub_accounts DROP CONSTRAINT IF EXISTS sub_accounts_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_accounts_username_academy
  ON public.sub_accounts(academy_id, username);

-- STEP 4: Verify - check row counts per academy
SELECT academy_id, COUNT(*) as rows FROM public.students GROUP BY academy_id;
SELECT academy_id, COUNT(*) as rows FROM public.settings GROUP BY academy_id;
SELECT academy_id, COUNT(*) as rows FROM public.finance_ledger GROUP BY academy_id;

-- ============================================================
-- Done! All existing data is now tagged as 'WFA_OWNER'
-- New clients will get their own academy_id from their License Key
-- ============================================================
