-- ============================================================
-- Wings Fly Aviation Academy
-- Certificate QR Download System — Database Setup
-- ============================================================
-- Supabase Dashboard > SQL Editor > এই পুরো script paste করে Run করুন
-- ============================================================

-- Step 1: certificate_tokens table তৈরি
CREATE TABLE IF NOT EXISTS public.certificate_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    TEXT NOT NULL,          -- students table-এর student_id (যেমন WFA-001)
  student_db_id UUID,                   -- students table-এর internal UUID (optional)
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  phone_hash    TEXT NOT NULL,          -- phone last 4 digits (security layer)
  is_active     BOOLEAN DEFAULT true,
  expires_at    TIMESTAMPTZ DEFAULT (now() + interval '2 years'),
  download_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_cert_tokens_token ON public.certificate_tokens(token);
CREATE INDEX IF NOT EXISTS idx_cert_tokens_student_id ON public.certificate_tokens(student_id);

-- Step 3: Row Level Security চালু করো
ALTER TABLE public.certificate_tokens ENABLE ROW LEVEL SECURITY;

-- Step 4: Public read policy (token দিয়ে যে কেউ basic info দেখতে পারবে)
-- কিন্তু phone_hash ছাড়া full access পাবে না — app layer-এ verify হবে
DROP POLICY IF EXISTS "Public can read active tokens" ON public.certificate_tokens;
CREATE POLICY "Public can read active tokens"
  ON public.certificate_tokens
  FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Step 5: Authenticated users (admin) সব কিছু করতে পারবে
DROP POLICY IF EXISTS "Authenticated full access" ON public.certificate_tokens;
CREATE POLICY "Authenticated full access"
  ON public.certificate_tokens
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Step 6: Anon users download_count update করতে পারবে
DROP POLICY IF EXISTS "Anon can update download count" ON public.certificate_tokens;
CREATE POLICY "Anon can update download count"
  ON public.certificate_tokens
  FOR UPDATE
  USING (is_active = true)
  WITH CHECK (is_active = true);

-- Step 7: Auto update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cert_tokens_updated_at ON public.certificate_tokens;
CREATE TRIGGER cert_tokens_updated_at
  BEFORE UPDATE ON public.certificate_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ✅ Setup complete!
-- এরপর আপনার Wings Fly Admin Panel থেকে QR Generate করুন
-- প্রতিটি QR একটি unique token বহন করবে
SELECT 'Certificate QR System setup complete! ✅' as status;
