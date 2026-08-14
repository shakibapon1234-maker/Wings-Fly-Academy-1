-- ============================================================
-- Migration: monitor_ledger → total_after কলাম যোগ
-- তারিখ: 2026-08-14
-- উদ্দেশ্য: প্রতিটি transaction-এর পর সব account-এর মোট
--           balance Data Monitor-এ দেখানো।
-- ============================================================

-- নতুন কলাম যোগ (যদি আগে না থাকে)
ALTER TABLE monitor_ledger
  ADD COLUMN IF NOT EXISTS total_after numeric DEFAULT NULL;

-- কমেন্ট
COMMENT ON COLUMN monitor_ledger.total_after IS
  'Sum of all account balances immediately after this balance change. NULL for old entries (pre-migration).';
