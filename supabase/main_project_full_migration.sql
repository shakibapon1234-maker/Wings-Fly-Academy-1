-- ════════════════════════════════════════════════════════════════════════════
--  Wings Fly Academy — MAIN PROJECT: Full Feature Migration
--  সব নতুন ফিচারের টেবিল + কলাম একসাথে যোগ করুন
--
--  ⚠️  এটি আপনার নিজের (main) Supabase project-এ রান করুন।
--      CLIENT_MASTER_SETUP.sql নয় — এটা আলাদা।
--
--  Supabase Dashboard → SQL Editor → New Query → Paste → Run (F5)
--  এরপর নিচে "STEP 7: Verification" section-এর result দেখুন।
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0: wfa_set_updated_at() helper function
-- (যদি না থাকে তাহলে তৈরি হবে, থাকলে update হবে)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.wfa_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: student_portal_access (Student Portal Login)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.student_portal_access (
  id           text primary key,
  student_id   text not null,
  student_name text,
  phone        text not null,
  pin_hash     text not null,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_spa_phone      on public.student_portal_access(phone);
create index if not exists idx_spa_student_id on public.student_portal_access(student_id);
create index if not exists idx_spa_is_active  on public.student_portal_access(is_active);

alter table public.student_portal_access enable row level security;
drop policy if exists wfa_student_portal_access_all on public.student_portal_access;
create policy wfa_student_portal_access_all on public.student_portal_access
  for all using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: payment_requests (Payment Gateway — bKash/Nagad/Bank)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.payment_requests (
  id             text primary key,
  student_id     text not null,
  student_name   text,
  batch_id       text,
  amount         numeric not null,
  method         text not null,           -- 'bKash' | 'Nagad' | 'Bank'
  transaction_id text not null,
  sender_number  text,
  screenshot_url text,
  status         text default 'pending',  -- 'pending' | 'approved' | 'rejected'
  submitted_at   timestamptz default now(),
  reviewed_at    timestamptz,
  reviewed_by    text,
  note           text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_payment_requests_student_id on public.payment_requests(student_id);
create index if not exists idx_payment_requests_status     on public.payment_requests(status);
create index if not exists idx_payment_requests_submitted  on public.payment_requests(submitted_at desc);

alter table public.payment_requests enable row level security;
drop policy if exists wfa_payment_requests_all on public.payment_requests;
create policy wfa_payment_requests_all on public.payment_requests
  for all using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3: class_routines (Class Scheduling / Routine Builder)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.class_routines (
  id         text primary key,
  batch_id   text not null,
  day        text not null,   -- 'Sat','Sun','Mon','Tue','Wed','Thu','Fri'
  start_time text not null,
  end_time   text not null,
  subject    text,
  teacher_id text,
  room       text,
  is_active  boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_class_routines_batch_day on public.class_routines(batch_id, day);

alter table public.class_routines enable row level security;
drop policy if exists wfa_class_routines_all on public.class_routines;
create policy wfa_class_routines_all on public.class_routines
  for all using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4: sms_logs (SMS Notification Logs)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.sms_logs (
  id                text primary key,
  recipient         text not null,
  message           text not null,
  type              text not null default 'general',
  status            text not null default 'pending',
  provider_response text,
  sent_at           timestamptz default now()
);

create index if not exists idx_sms_logs_sent_at   on public.sms_logs(sent_at desc);
create index if not exists idx_sms_logs_status    on public.sms_logs(status);
create index if not exists idx_sms_logs_recipient on public.sms_logs(recipient);

alter table public.sms_logs enable row level security;
drop policy if exists wfa_sms_logs_all on public.sms_logs;
create policy wfa_sms_logs_all on public.sms_logs
  for all using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 5: school_classes, school_subjects, school_marks (School Mode)
-- ════════════════════════════════════════════════════════════════════════════

-- 5A: school_classes
create table if not exists public.school_classes (
  id           text primary key,
  class_name   text not null,
  sections     text,
  shift        text,
  class_teacher text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.school_classes enable row level security;
drop policy if exists wfa_school_classes_all on public.school_classes;
create policy wfa_school_classes_all on public.school_classes
  for all using (true) with check (true);

-- 5B: school_subjects
create table if not exists public.school_subjects (
  id           text primary key,
  class_name   text not null,
  subject_name text not null,
  full_marks   numeric default 100,
  pass_marks   numeric default 33,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.school_subjects enable row level security;
drop policy if exists wfa_school_subjects_all on public.school_subjects;
create policy wfa_school_subjects_all on public.school_subjects
  for all using (true) with check (true);

-- 5C: school_marks
create table if not exists public.school_marks (
  id             text primary key,
  student_id     text not null,
  student_no     text,
  student_name   text,
  class_name     text,
  section        text,
  roll_no        text,
  academic_year  text,
  exam_type      text default 'Annual',
  subject_id     text,
  subject_name   text,
  marks_obtained numeric default 0,
  full_marks     numeric default 100,
  grade          text,
  gpa            numeric default 0,
  pass           boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_school_marks_student_id on public.school_marks(student_id);
create index if not exists idx_school_marks_class      on public.school_marks(class_name, exam_type);

alter table public.school_marks enable row level security;
drop policy if exists wfa_school_marks_all on public.school_marks;
create policy wfa_school_marks_all on public.school_marks
  for all using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 6: settings table — নতুন কলাম যোগ (যদি না থাকে)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.settings
  add column if not exists institution_type       text default 'coaching',
  add column if not exists payment_gateway_config jsonb default '{}'::jsonb,
  add column if not exists sms_config             jsonb default '{}'::jsonb,
  add column if not exists portal_access_enabled  boolean default true;

-- students table-এ portal_enabled কলাম (যদি না থাকে)
alter table public.students
  add column if not exists portal_enabled boolean default false;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 7: Auto updated_at Triggers
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tables text[] := array[
    'student_portal_access','payment_requests','class_routines',
    'school_classes','school_subjects','school_marks'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_' || t || '_updated_at'
        and tgrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'create trigger trg_%I_updated_at
           before update on public.%I
           for each row execute function public.wfa_set_updated_at();',
        t, t
      );
    end if;
  end loop;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 8: Realtime Subscriptions
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tables text[] := array[
    'student_portal_access','payment_requests','class_routines',
    'sms_logs','school_classes','school_subjects','school_marks'
  ];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when others then
      null;
    end;
  end loop;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 9: Verification — এই result দেখুন, সব টেবিল ✅ হওয়া উচিত
-- ════════════════════════════════════════════════════════════════════════════
select
  tablename as "Table",
  case when rowsecurity then '✅ RLS ON' else '❌ RLS OFF' end as "RLS"
from pg_tables
where schemaname = 'public'
  and tablename in (
    'student_portal_access','payment_requests','class_routines',
    'sms_logs','school_classes','school_subjects','school_marks'
  )
order by tablename;

select '✅ Migration সম্পন্ন! সব ফিচার এখন চালু হবে।' as "Final Status";
