-- ============================================================
-- AcadeFlow — School Mode Tables
-- Run once in Supabase SQL Editor (client project)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_classes (
  id            text PRIMARY KEY,
  class_name    text NOT NULL,
  sections      jsonb DEFAULT '[]'::jsonb,
  shift         text DEFAULT 'Day',
  class_teacher text DEFAULT '',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_subjects (
  id            text PRIMARY KEY,
  class_name    text NOT NULL,
  subject_name  text NOT NULL,
  full_marks    numeric DEFAULT 100,
  pass_marks    numeric DEFAULT 33,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_marks (
  id             text PRIMARY KEY,
  student_id     text NOT NULL,
  student_no     text,
  student_name   text,
  class_name     text,
  section        text,
  roll_no        text,
  academic_year  text,
  exam_type      text DEFAULT 'Annual',
  subject_id     text,
  subject_name   text,
  marks_obtained numeric DEFAULT 0,
  full_marks     numeric DEFAULT 100,
  grade          text,
  gpa            numeric DEFAULT 0,
  pass           boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_marks_student ON public.school_marks (student_id, exam_type, academic_year);
CREATE INDEX IF NOT EXISTS idx_school_marks_class ON public.school_marks (class_name, section, exam_type);

-- students table: add school columns if missing
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS roll_no text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS shift text;

-- RLS (match existing WFA pattern — anon + authenticated full access)
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_classes_anon" ON public.school_classes;
CREATE POLICY "school_classes_anon" ON public.school_classes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "school_subjects_anon" ON public.school_subjects;
CREATE POLICY "school_subjects_anon" ON public.school_subjects FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "school_marks_anon" ON public.school_marks;
CREATE POLICY "school_marks_anon" ON public.school_marks FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT '✅ School mode tables ready' AS status;
