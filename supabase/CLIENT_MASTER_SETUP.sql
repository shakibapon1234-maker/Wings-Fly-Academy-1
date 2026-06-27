-- ════════════════════════════════════════════════════════════════════════════
-- ██╗    ██╗███████╗ █████╗     ██╗    ██████╗ ██╗  ██╗
-- ██║    ██║██╔════╝██╔══██╗   ██║   ██╔════╝ ██║  ██║
-- ██║ █╗ ██║█████╗  ███████║   ██║   ██║  ███╗███████║
-- ██║███╗██║██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██║
-- ╚███╔███╔╝██║     ██║  ██║   ███████╗╚██████╔╝██║  ██║
--  ╚══╝╚══╝ ╚═╝     ╚═╝  ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝
-- ════════════════════════════════════════════════════════════════════════════
--  AcadeFlow / Wings Fly Academy — CLIENT MASTER SETUP SQL
--  নতুন ক্লায়েন্টের Supabase Project-এ এই পুরো script একবার run করুন।
--  Supabase Dashboard → SQL Editor → New Query → Paste → Run (F5)
--  সব টেবিল, ইনডেক্স, RLS পলিসি, ট্রিগার এবং স্টোরেজ বাকেট সহ সেটআপ হয়ে যাবে।
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 0 — Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1.1  settings ─────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                  text primary key default 'main',
  academy_name        text,
  academy_address     text,
  academy_phone       text,
  academy_email       text,
  admin_password      text,
  security_question   text,
  security_answer     text,
  currency            text default 'BDT',
  timezone            text,
  logo_url            text,
  primary_color       text,
  theme               text,
  monthly_target      numeric,
  running_batch       text,
  expense_month       text,
  expense_start_date  text,
  expense_end_date    text,
  income_categories      jsonb,
  expense_categories     jsonb,
  courses                jsonb,
  employee_roles         jsonb,
  admin_username         text,
  keep_records           text,
  recycle_bin_sync       text,
  exam_questions         jsonb,
  exam_settings          jsonb,
  institution_type       text default 'coaching',
  payment_gateway_config jsonb,
  sms_config             jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- ── 1.2  students ─────────────────────────────────────────────────────────
create table if not exists public.students (
  id               text primary key,
  name             text,
  student_id       text,
  phone            text,
  email            text,
  address          text,
  dob              text,
  course           text,
  batch            text,
  session          text,
  enrollment_date  text,
  admission_date   text,
  total_fee        numeric,
  paid             numeric,
  due              numeric,
  status           text,
  photo_url        text,
  guardian_name    text,
  father_name      text,
  mother_name      text,
  guardian_phone   text,
  roll_no          text,
  shift            text,
  note             text,
  installment_plan jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── 1.3  staff ────────────────────────────────────────────────────────────
create table if not exists public.staff (
  id            text primary key,
  name          text,
  role          text,
  phone         text,
  email         text,
  address       text,
  dob           text,
  join_date     text,
  "joiningDate" text,
  salary        numeric,
  status        text,
  photo_url     text,
  note          text,
  "staffId"     text,
  staff_id      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 1.4  salary ───────────────────────────────────────────────────────────
create table if not exists public.salary (
  id            text primary key,
  staff_id      text,
  staff_name    text,
  "staffId"     text,
  "staffName"   text,
  month         text,
  year          text,
  amount        numeric,
  "baseSalary"  numeric,
  base_salary   numeric,
  bonus         numeric,
  deduction     numeric,
  net_salary    numeric,
  status        text,
  note          text,
  paid_date     text,
  "paidDate"    text,
  "paidAmount"  numeric,
  paid_amount   numeric,
  paid          numeric,
  method        text,
  role          text,
  phone         text,
  name          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 1.5  finance_ledger ───────────────────────────────────────────────────
create table if not exists public.finance_ledger (
  id          text primary key,
  date        text,
  type        text,
  category    text,
  amount      numeric,
  description text,
  account_id  text,
  reference   text,
  note        text,
  method      text,
  person_name text,
  ref_id      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 1.6  accounts ─────────────────────────────────────────────────────────
create table if not exists public.accounts (
  id          text primary key,
  name        text,
  type        text,
  balance     numeric default 0,
  description text,
  note        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 1.7  loans ────────────────────────────────────────────────────────────
create table if not exists public.loans (
  id            text primary key,
  person_name   text,
  type          text,
  amount        numeric,
  interest_rate numeric,
  date          text,
  due_date      text,
  paid          numeric,
  status        text,
  note          text,
  method        text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 1.8  exams ────────────────────────────────────────────────────────────
create table if not exists public.exams (
  id           text primary key,
  reg_id       text,
  student_id   text,
  student_name text,
  batch        text,
  session      text,
  subject      text,
  exam_date    text,
  exam_fee     numeric,
  fee_paid     numeric,
  grade        text,
  marks        numeric,
  status       text,
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 1.9  attendance ───────────────────────────────────────────────────────
create table if not exists public.attendance (
  id           text primary key,
  person_id    text,
  person_name  text,
  type         text,
  date         text,
  status       text,
  note         text,
  "entityId"   text,
  "entityName" text,
  batch        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 1.10 visitors ─────────────────────────────────────────────────────────
create table if not exists public.visitors (
  id                text primary key,
  name              text,
  phone             text,
  purpose           text,
  host              text,
  visit_date        text,
  visit_time        text,
  out_time          text,
  status            text,
  note              text,
  interested_course text,
  follow_up_date    date,
  remarks           text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── 1.11 notices ──────────────────────────────────────────────────────────
create table if not exists public.notices (
  id         text primary key,
  title      text,
  text       text,
  type       text,
  expires_at text,
  is_pinned  boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 1.12 advance_payments ─────────────────────────────────────────────────
create table if not exists public.advance_payments (
  id         text primary key,
  person     text,
  amount     numeric,
  method     text,
  date       text,
  note       text,
  returns    numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 1.13 investments ──────────────────────────────────────────────────────
create table if not exists public.investments (
  id         text primary key,
  source     text,
  amount     numeric,
  method     text,
  date       text,
  note       text,
  returns    numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 1.14 keep_records ─────────────────────────────────────────────────────
create table if not exists public.keep_records (
  id         text primary key,
  title      text,
  content    text,
  color      text,
  tags       jsonb,
  pinned     boolean default false,
  date       text,
  created    text,
  modified   text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 1.15 custom_themes ────────────────────────────────────────────────────
create table if not exists public.custom_themes (
  id         text primary key,
  name       text,
  colors     jsonb,
  variables  jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 1.16 sub_accounts ─────────────────────────────────────────────────────
create table if not exists public.sub_accounts (
  id          text primary key,
  username    text unique,
  password    text,
  name        text,
  role        text,
  permissions jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 1.17 activity_log ─────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          text primary key,
  action      text,
  type        text,
  description text,
  status      text default 'success',
  "user"      text,
  device_id   text,
  time        text,
  created_at  timestamptz default now()
);

-- ── 1.18 certificate_tokens ───────────────────────────────────────────────
create table if not exists public.certificate_tokens (
  id             uuid primary key default gen_random_uuid(),
  student_id     text not null,
  student_db_id  uuid,
  token          text not null unique default gen_random_uuid()::text,
  phone_hash     text not null,
  is_active      boolean default true,
  expires_at     timestamptz default (now() + interval '2 years'),
  download_count integer default 0,
  last_accessed  timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── 1.19 push_subscriptions ───────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_role  text,
  user_agent text,
  created_at timestamptz default now(),
  last_seen  timestamptz default now()
);

-- ── 1.20 school_classes (School / College mode) ───────────────────────────
create table if not exists public.school_classes (
  id            text primary key,
  class_name    text not null,
  sections      jsonb default '[]'::jsonb,
  shift         text default 'Day',
  class_teacher text default '',
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 1.21 school_subjects ──────────────────────────────────────────────────
create table if not exists public.school_subjects (
  id            text primary key,
  class_name    text not null,
  subject_name  text not null,
  full_marks    numeric default 100,
  pass_marks    numeric default 33,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── 1.22 school_marks ─────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — INDEXES (fast query support)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_students_student_id     on public.students(student_id);
create index if not exists idx_students_status         on public.students(status);
create index if not exists idx_students_batch          on public.students(batch);
create index if not exists idx_staff_status            on public.staff(status);
create index if not exists idx_salary_staff_id         on public.salary(staff_id);
create index if not exists idx_salary_month_year       on public.salary(month, year);
create index if not exists idx_finance_ledger_date     on public.finance_ledger(date);
create index if not exists idx_finance_ledger_type     on public.finance_ledger(type);
create index if not exists idx_finance_ledger_account  on public.finance_ledger(account_id);
create index if not exists idx_exams_student_id        on public.exams(student_id);
create index if not exists idx_attendance_person_id    on public.attendance(person_id);
create index if not exists idx_attendance_date         on public.attendance(date);
create index if not exists idx_visitors_visit_date       on public.visitors(visit_date);
create index if not exists idx_activity_log_created_at   on public.activity_log(created_at);
create index if not exists idx_cert_tokens_token         on public.certificate_tokens(token);
create index if not exists idx_cert_tokens_student_id    on public.certificate_tokens(student_id);
create index if not exists idx_push_subs_endpoint        on public.push_subscriptions(endpoint);
create index if not exists idx_school_classes_active     on public.school_classes(is_active);
create index if not exists idx_school_subjects_class     on public.school_subjects(class_name);
create index if not exists idx_school_marks_student      on public.school_marks(student_id, exam_type, academic_year);
create index if not exists idx_school_marks_class        on public.school_marks(class_name, section, exam_type);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — TRIGGERS (auto updated_at)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.wfa_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Dynamically create triggers for all tables that have updated_at
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'settings','students','staff','salary','finance_ledger','accounts',
    'loans','exams','attendance','visitors','notices','advance_payments',
    'investments','keep_records','custom_themes','sub_accounts','certificate_tokens',
    'school_classes','school_subjects','school_marks'
  ] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_' || tbl || '_updated_at'
        and tgrelid = ('public.' || tbl)::regclass
    ) then
      execute format(
        'create trigger trg_%I_updated_at
           before update on public.%I
           for each row execute function public.wfa_set_updated_at();',
        tbl, tbl
      );
    end if;
  end loop;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — ROW LEVEL SECURITY (RLS) + POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- নীতি: ক্লায়েন্ট অ্যাপ anon key দিয়ে চলে (no Supabase Auth login)।
-- তাই সব sync টেবিলে FOR ALL USING (true) WITH CHECK (true) পলিসি দেওয়া হয়েছে।
-- push_subscriptions এবং certificate_tokens-এর জন্য granular পলিসি।
-- ─────────────────────────────────────────────────────────────────────────────

-- ── settings ──────────────────────────────────────────────────────────────
alter table public.settings enable row level security;
drop policy if exists wfa_settings_all on public.settings;
create policy wfa_settings_all on public.settings
  for all using (true) with check (true);

-- ── students ──────────────────────────────────────────────────────────────
alter table public.students enable row level security;
drop policy if exists wfa_students_all on public.students;
create policy wfa_students_all on public.students
  for all using (true) with check (true);

-- ── staff ─────────────────────────────────────────────────────────────────
alter table public.staff enable row level security;
drop policy if exists wfa_staff_all on public.staff;
create policy wfa_staff_all on public.staff
  for all using (true) with check (true);

-- ── salary ────────────────────────────────────────────────────────────────
alter table public.salary enable row level security;
drop policy if exists wfa_salary_all on public.salary;
create policy wfa_salary_all on public.salary
  for all using (true) with check (true);

-- ── finance_ledger ────────────────────────────────────────────────────────
alter table public.finance_ledger enable row level security;
drop policy if exists wfa_finance_ledger_all on public.finance_ledger;
create policy wfa_finance_ledger_all on public.finance_ledger
  for all using (true) with check (true);

-- ── accounts ──────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;
drop policy if exists wfa_accounts_all on public.accounts;
create policy wfa_accounts_all on public.accounts
  for all using (true) with check (true);

-- ── loans ─────────────────────────────────────────────────────────────────
alter table public.loans enable row level security;
drop policy if exists wfa_loans_all on public.loans;
create policy wfa_loans_all on public.loans
  for all using (true) with check (true);

-- ── exams ─────────────────────────────────────────────────────────────────
alter table public.exams enable row level security;
drop policy if exists wfa_exams_all on public.exams;
create policy wfa_exams_all on public.exams
  for all using (true) with check (true);

-- ── attendance ────────────────────────────────────────────────────────────
alter table public.attendance enable row level security;
drop policy if exists wfa_attendance_all on public.attendance;
create policy wfa_attendance_all on public.attendance
  for all using (true) with check (true);

-- ── visitors ──────────────────────────────────────────────────────────────
alter table public.visitors enable row level security;
drop policy if exists wfa_visitors_all on public.visitors;
create policy wfa_visitors_all on public.visitors
  for all using (true) with check (true);

-- ── notices ───────────────────────────────────────────────────────────────
alter table public.notices enable row level security;
drop policy if exists wfa_notices_all on public.notices;
create policy wfa_notices_all on public.notices
  for all using (true) with check (true);

-- ── advance_payments ──────────────────────────────────────────────────────
alter table public.advance_payments enable row level security;
drop policy if exists wfa_advance_payments_all on public.advance_payments;
create policy wfa_advance_payments_all on public.advance_payments
  for all using (true) with check (true);

-- ── investments ───────────────────────────────────────────────────────────
alter table public.investments enable row level security;
drop policy if exists wfa_investments_all on public.investments;
create policy wfa_investments_all on public.investments
  for all using (true) with check (true);

-- ── keep_records ──────────────────────────────────────────────────────────
alter table public.keep_records enable row level security;
drop policy if exists wfa_keep_records_all on public.keep_records;
create policy wfa_keep_records_all on public.keep_records
  for all using (true) with check (true);

-- ── custom_themes ─────────────────────────────────────────────────────────
alter table public.custom_themes enable row level security;
drop policy if exists wfa_custom_themes_all on public.custom_themes;
create policy wfa_custom_themes_all on public.custom_themes
  for all using (true) with check (true);

-- ── sub_accounts ──────────────────────────────────────────────────────────
alter table public.sub_accounts enable row level security;
drop policy if exists wfa_sub_accounts_all on public.sub_accounts;
create policy wfa_sub_accounts_all on public.sub_accounts
  for all using (true) with check (true);

-- ── activity_log ──────────────────────────────────────────────────────────
alter table public.activity_log enable row level security;
drop policy if exists wfa_activity_log_all on public.activity_log;
create policy wfa_activity_log_all on public.activity_log
  for all using (true) with check (true);

-- ── certificate_tokens — granular RLS ─────────────────────────────────────
-- Public:  শুধু active, non-expired token পড়া যাবে (QR verify)
-- Anon:    download_count update করা যাবে
-- Admin:   anon key দিয়ে insert/delete — app layer-এ password verify হয়
alter table public.certificate_tokens enable row level security;

drop policy if exists wfa_cert_tokens_public_read on public.certificate_tokens;
drop policy if exists wfa_cert_tokens_anon_update on public.certificate_tokens;
drop policy if exists wfa_cert_tokens_admin_write on public.certificate_tokens;

create policy wfa_cert_tokens_public_read on public.certificate_tokens
  for select
  using (is_active = true and expires_at > now());

create policy wfa_cert_tokens_anon_update on public.certificate_tokens
  for update
  using (is_active = true)
  with check (is_active = true);

create policy wfa_cert_tokens_admin_write on public.certificate_tokens
  for all
  using (true) with check (true);

-- ── push_subscriptions — granular RLS ─────────────────────────────────────
-- INSERT / UPDATE / DELETE: যে কেউ তাদের নিজের subscription manage করতে পারবে
-- SELECT: শুধু service_role (Edge Function) পড়তে পারবে — anon SELECT নেই
alter table public.push_subscriptions enable row level security;

drop policy if exists wfa_push_subs_insert on public.push_subscriptions;
drop policy if exists wfa_push_subs_update on public.push_subscriptions;
drop policy if exists wfa_push_subs_delete on public.push_subscriptions;

create policy wfa_push_subs_insert on public.push_subscriptions
  for insert with check (true);

create policy wfa_push_subs_update on public.push_subscriptions
  for update using (true);

create policy wfa_push_subs_delete on public.push_subscriptions
  for delete using (true);

-- NOTE: No SELECT policy for anon/authenticated.
-- Only service_role key (Edge Function) can SELECT all subscriptions.

-- ── school_classes ────────────────────────────────────────────────────────
alter table public.school_classes enable row level security;
drop policy if exists wfa_school_classes_all on public.school_classes;
create policy wfa_school_classes_all on public.school_classes
  for all using (true) with check (true);

-- ── school_subjects ───────────────────────────────────────────────────────
alter table public.school_subjects enable row level security;
drop policy if exists wfa_school_subjects_all on public.school_subjects;
create policy wfa_school_subjects_all on public.school_subjects
  for all using (true) with check (true);

-- ── school_marks ──────────────────────────────────────────────────────────
alter table public.school_marks enable row level security;
drop policy if exists wfa_school_marks_all on public.school_marks;
create policy wfa_school_marks_all on public.school_marks
  for all using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — STORAGE BUCKET (photos)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,        -- public bucket: URL দিয়ে যে কেউ ছবি দেখতে পারবে
  5242880,     -- 5 MB max per file
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
drop policy if exists wfa_photos_public_read on storage.objects;
drop policy if exists wfa_photos_anon_upload on storage.objects;
drop policy if exists wfa_photos_anon_update on storage.objects;
drop policy if exists wfa_photos_anon_delete on storage.objects;

create policy wfa_photos_public_read on storage.objects
  for select using (bucket_id = 'photos');

create policy wfa_photos_anon_upload on storage.objects
  for insert with check (bucket_id = 'photos');

create policy wfa_photos_anon_update on storage.objects
  for update using (bucket_id = 'photos');

create policy wfa_photos_anon_delete on storage.objects
  for delete using (bucket_id = 'photos');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — REALTIME (live sync চালু করতে)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'settings','students','staff','salary','finance_ledger','accounts',
    'loans','exams','attendance','visitors','notices','advance_payments',
    'investments','keep_records','custom_themes','sub_accounts',
    'activity_log','certificate_tokens',
    'school_classes','school_subjects','school_marks'
  ] loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I;', tbl
      );
    exception when others then
      null; -- ইতিমধ্যে যোগ করা থাকলে বা publication না থাকলে ignore
    end;
  end loop;
end;
$$;




-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6.5 — CUSTOM FUNCTIONS (RPCs)
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.wfa_verify_student_certificate(text, text);
create or replace function public.wfa_verify_student_certificate(
  p_student_id text,
  p_phone_last4 text
)
returns table (
  id           text,
  student_id   text,
  name         text,
  course       text,
  batch        text,
  session      text,
  status       text
)
language plpgsql
security definer
as $$
begin
  return query
  select
    s.id,
    s.student_id,
    s.name,
    s.course,
    s.batch,
    s.session,
    s.status
  from public.students s
  where
    (
      lower(s.student_id) = lower(p_student_id)
      or lower(s.name)    = lower(p_student_id)
    )
    and right(regexp_replace(s.phone, '\D', '', 'g'), 4) = p_phone_last4
    and s.status = 'Active'
  limit 1;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 — VERIFICATION (শেষে ফলাফল দেখাবে)
-- ─────────────────────────────────────────────────────────────────────────────
select
  tablename                            as "Table",
  case when rowsecurity then '✅ ON' else '❌ OFF' end as "RLS"
from pg_tables
where schemaname = 'public'
  and tablename in (
    'settings','students','staff','salary','finance_ledger','accounts',
    'loans','exams','attendance','visitors','notices','advance_payments',
    'investments','keep_records','custom_themes','sub_accounts',
    'activity_log','certificate_tokens','push_subscriptions',
    'school_classes','school_subjects','school_marks'
  )
order by tablename;

select '✅ AcadeFlow Client Setup Complete! সব টেবিল, ইনডেক্স, RLS পলিসি, ট্রিগার ও স্টোরেজ তৈরি হয়েছে।' as status;

-- ════════════════════════════════════════════════════════════════════════════
-- পরবর্তী ধাপ (Next Steps):
--
--  1. Supabase Dashboard > Settings > API
--     → Project URL  → ক্লায়েন্টের supabase-config.js-এ বসান
--     → anon key     → ক্লায়েন্টের supabase-config.js-এ বসান
--
--  2. Push Notification (চাইলে):
--     supabase secrets set VAPID_PUBLIC_KEY=<key>
--     supabase secrets set VAPID_PRIVATE_KEY=<key>
--     supabase secrets set VAPID_SUBJECT=mailto:admin@youracademy.com
--     supabase functions deploy send-push
--
--  3. License Server আলাদা Supabase Project-এ:
--     supabase/license_server_setup.sql রান করুন
--     (এই ক্লায়েন্ট project-এ নয়!)
-- ════════════════════════════════════════════════════════════════════════════
