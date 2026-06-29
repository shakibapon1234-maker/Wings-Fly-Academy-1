/* 
  RLS policies for secure access. 
  Replace 'auth.uid()' logic as needed once Auth is implemented.
*/

ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read students" ON public.students FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert students" ON public.students FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update students" ON public.students FOR UPDATE USING (auth.role() = 'authenticated');

-- Repeat for other tables... 
-- This is a template. For full open sync, use:
-- CREATE POLICY "Enable all for authenticated" ON public.students FOR ALL USING (auth.role() = 'authenticated');
