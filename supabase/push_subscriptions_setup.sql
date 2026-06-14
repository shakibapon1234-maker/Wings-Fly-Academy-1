-- ============================================================
-- Wings Fly Aviation Academy
-- Web Push Notifications — push_subscriptions table setup
-- ============================================================
-- Supabase Dashboard > SQL Editor > এই পুরো script paste করে Run করুন
-- ============================================================

-- Step 1: push_subscriptions table তৈরি
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT NOT NULL UNIQUE,   -- pushManager subscription endpoint (unique per device/browser)
  p256dh      TEXT NOT NULL,          -- subscription.keys.p256dh
  auth        TEXT NOT NULL,          -- subscription.keys.auth
  user_role   TEXT,                   -- optional: 'admin', 'staff', etc. (for targeted sends)
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_seen   TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Step 3: RLS — clients may upsert/delete their OWN subscription (by endpoint),
-- but cannot read other rows. The send-push Edge Function uses the
-- service_role key (bypasses RLS) to read all rows when broadcasting.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert their own subscription"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update their own subscription by endpoint"
  ON public.push_subscriptions FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete their own subscription by endpoint"
  ON public.push_subscriptions FOR DELETE
  USING (true);

-- No SELECT policy for anon/authenticated — only service_role (Edge Function)
-- can read subscriptions, so endpoints/keys aren't readable by clients.

-- ============================================================
-- Edge Function secrets needed (set via Supabase CLI, not in SQL):
--   supabase secrets set VAPID_PUBLIC_KEY=...
--   supabase secrets set VAPID_PRIVATE_KEY=...
--   supabase secrets set VAPID_SUBJECT=mailto:your@email.com
-- See VAPID_KEYS.md and VAPID_PRIVATE_KEY.local.md
-- ============================================================
