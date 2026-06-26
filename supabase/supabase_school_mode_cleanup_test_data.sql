-- ============================================================
-- Remove AcadeFlow School Mode TEST data (browser QA run)
-- Safe: only removes records created by automated/manual test
-- ============================================================

DELETE FROM public.school_marks
WHERE student_no = 'SCH-TEST-01'
   OR student_name = 'School Test Student';

DELETE FROM public.students
WHERE student_id = 'SCH-TEST-01'
   OR name = 'School Test Student';

DELETE FROM public.school_subjects
WHERE class_name = '৯ম'
  AND NOT EXISTS (
    SELECT 1 FROM public.school_classes c
    WHERE c.class_name = '৯ম'
      AND COALESCE(c.class_teacher, '') <> 'Test Teacher'
      AND c.is_active IS DISTINCT FROM false
  );

DELETE FROM public.school_classes
WHERE class_teacher = 'Test Teacher';

SELECT '✅ Test data removed' AS status;
