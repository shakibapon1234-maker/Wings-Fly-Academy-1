-- Run in Supabase → SQL Editor if JSON Import works locally but "Push failed"
-- with messages like: new row violates row-level security / permission denied
--
-- This enables RLS and allows the anon key (used by the web app) to read/write
-- all rows. Use stricter policies if you add real user authentication later.

-- students
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_students_all ON public.students;
CREATE POLICY wfa_students_all ON public.students FOR ALL USING (true) WITH CHECK (true);

-- finance_ledger
ALTER TABLE IF EXISTS public.finance_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_finance_ledger_all ON public.finance_ledger;
CREATE POLICY wfa_finance_ledger_all ON public.finance_ledger FOR ALL USING (true) WITH CHECK (true);

-- accounts
ALTER TABLE IF EXISTS public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_accounts_all ON public.accounts;
CREATE POLICY wfa_accounts_all ON public.accounts FOR ALL USING (true) WITH CHECK (true);

-- loans
ALTER TABLE IF EXISTS public.loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_loans_all ON public.loans;
CREATE POLICY wfa_loans_all ON public.loans FOR ALL USING (true) WITH CHECK (true);

-- exams
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_exams_all ON public.exams;
CREATE POLICY wfa_exams_all ON public.exams FOR ALL USING (true) WITH CHECK (true);

-- attendance
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_attendance_all ON public.attendance;
CREATE POLICY wfa_attendance_all ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- staff
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_staff_all ON public.staff;
CREATE POLICY wfa_staff_all ON public.staff FOR ALL USING (true) WITH CHECK (true);

-- salary
ALTER TABLE IF EXISTS public.salary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_salary_all ON public.salary;
CREATE POLICY wfa_salary_all ON public.salary FOR ALL USING (true) WITH CHECK (true);

-- visitors
ALTER TABLE IF EXISTS public.visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_visitors_all ON public.visitors;
CREATE POLICY wfa_visitors_all ON public.visitors FOR ALL USING (true) WITH CHECK (true);

-- notices
ALTER TABLE IF EXISTS public.notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_notices_all ON public.notices;
CREATE POLICY wfa_notices_all ON public.notices FOR ALL USING (true) WITH CHECK (true);

-- settings
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wfa_settings_all ON public.settings;
CREATE POLICY wfa_settings_all ON public.settings FOR ALL USING (true) WITH CHECK (true);
