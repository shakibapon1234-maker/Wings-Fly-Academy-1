-- ============================================================
-- Wings Fly Academy — Feature 2: Manual Payment System (bKash/Nagad/Bank)
-- Run this in Supabase → SQL Editor (on the branch's Supabase project,
-- e.g. wfa-testing while developing, then again on wfa-production
-- before/while merging to main).
-- ============================================================

-- 1. payment_requests table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL,
  student_name text,
  batch_id text,
  amount numeric NOT NULL,
  method text NOT NULL, -- 'bKash' | 'Nagad' | 'Bank'
  transaction_id text NOT NULL,
  sender_number text,
  screenshot_url text,
  status text DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_student_id ON public.payment_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);

-- RLS — matches the rest of the app's policy style (anon key full access;
-- tighten later if real auth is added).
ALTER TABLE IF EXISTS public.payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_payment_requests_all ON public.payment_requests;
CREATE POLICY wfa_payment_requests_all ON public.payment_requests FOR ALL USING (true) WITH CHECK (true);

-- 2. settings table — new column to hold bKash/Nagad/Bank config + on/off toggle
-- (Admin-side UI for this lives inside the new "Payment Requests" section,
--  NOT inside Settings, to avoid growing settings.js further.)
ALTER TABLE IF EXISTS public.settings
  ADD COLUMN IF NOT EXISTS payment_gateway_config jsonb;

-- 3. (Optional) Storage bucket for payment screenshots.
-- Create a PUBLIC bucket named "payment-screenshots" via
-- Supabase Dashboard → Storage → New bucket → name: payment-screenshots, Public: ON.
-- If the bucket doesn't exist, screenshot upload is skipped automatically
-- and the payment request is still submitted (transaction ID is the source of truth).
