-- ============================================================
-- WINGS FLY ACADEMY / ACADEFLOW — MASTER DATABASE SETUP
-- Run this in Supabase -> SQL Editor for every new client
-- ============================================================

-- 1. Extensions Setup
create extension if not exists "uuid-ossp";

-- 2. Create Tables

-- 2.1 settings table
create table if not exists public.settings (
  id text primary key default 'main',
  academy_name text,
  academy_address text,
  academy_phone text,
  academy_email text,
  admin_password text,
  security_question text,
  security_answer text,
  currency text default 'BDT',
  timezone text,
  logo_url text,
  primary_color text,
  theme text,
  monthly_target numeric,
  running_batch text,
  expense_month text,
  expense_start_date text,
  expense_end_date text,
  income_categories jsonb,
  expense_categories jsonb,
  courses jsonb,
  employee_roles jsonb,
  admin_username text,
  keep_records text,
  recycle_bin_sync text,
  exam_questions jsonb,
  exam_settings jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.2 salary table
create table if not exists public.salary (
  id text primary key,
  staff_id text,
  staff_name text,
  "staffId" text,
  "staffName" text,
  month text,
  year text,
  amount numeric,
  "baseSalary" numeric,
  base_salary numeric,
  bonus numeric,
  deduction numeric,
  net_salary numeric,
  status text,
  note text,
  paid_date text,
  "paidDate" text,
  "paidAmount" numeric,
  paid_amount numeric,
  paid numeric,
  method text,
  role text,
  phone text,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.3 students table
create table if not exists public.students (
  id text primary key,
  name text,
  student_id text,
  phone text,
  email text,
  address text,
  dob text,
  course text,
  batch text,
  session text,
  enrollment_date text,
  admission_date text,
  total_fee numeric,
  paid numeric,
  due numeric,
  status text,
  photo_url text,
  guardian_name text,
  father_name text,
  guardian_phone text,
  note text,
  installment_plan jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.4 finance_ledger table
create table if not exists public.finance_ledger (
  id text primary key,
  date text,
  type text,
  category text,
  amount numeric,
  description text,
  account_id text,
  reference text,
  note text,
  method text,
  person_name text,
  ref_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.5 accounts table
create table if not exists public.accounts (
  id text primary key,
  name text,
  type text,
  balance numeric default 0,
  description text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.6 loans table
create table if not exists public.loans (
  id text primary key,
  person_name text,
  type text,
  amount numeric,
  interest_rate numeric,
  date text,
  due_date text,
  paid numeric,
  status text,
  note text,
  method text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.7 exams table
create table if not exists public.exams (
  id text primary key,
  reg_id text,
  student_id text,
  student_name text,
  batch text,
  session text,
  subject text,
  exam_date text,
  exam_fee numeric,
  fee_paid numeric,
  grade text,
  marks numeric,
  status text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.8 attendance table
create table if not exists public.attendance (
  id text primary key,
  person_id text,
  person_name text,
  type text,
  date text,
  status text,
  note text,
  "entityId" text,
  "entityName" text,
  batch text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.9 staff table
create table if not exists public.staff (
  id text primary key,
  name text,
  role text,
  phone text,
  email text,
  address text,
  dob text,
  join_date text,
  "joiningDate" text,
  salary numeric,
  status text,
  photo_url text,
  note text,
  "staffId" text,
  staff_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.10 visitors table
create table if not exists public.visitors (
  id text primary key,
  name text,
  phone text,
  purpose text,
  host text,
  visit_date text,
  visit_time text,
  out_time text,
  status text,
  note text,
  interested_course text,
  follow_up_date date,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.11 notices table
create table if not exists public.notices (
  id text primary key,
  title text,
  text text,
  type text,
  expires_at text,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.12 advance_payments table
create table if not exists public.advance_payments (
  id text primary key,
  person text,
  amount numeric,
  method text,
  date text,
  note text,
  returns numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.13 investments table
create table if not exists public.investments (
  id text primary key,
  source text,
  amount numeric,
  method text,
  date text,
  note text,
  returns numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.14 keep_records table
create table if not exists public.keep_records (
  id text primary key,
  title text,
  content text,
  color text,
  tags jsonb,
  pinned boolean default false,
  date text,
  created text,
  modified text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.15 custom_themes table
create table if not exists public.custom_themes (
  id text primary key,
  name text,
  colors jsonb,
  variables jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.16 sub_accounts table
create table if not exists public.sub_accounts (
  id text primary key,
  username text unique,
  password text,
  name text,
  role text,
  permissions jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.17 activity_log table
create table if not exists public.activity_log (
  id text primary key,
  action text,
  type text,
  description text,
  status text default 'success',
  "user" text,
  device_id text,
  time text,
  created_at timestamptz default now()
);

-- 2.18 certificate_tokens table
create table if not exists public.certificate_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  student_db_id uuid,
  token text not null unique default gen_random_uuid()::text,
  phone_hash text not null,
  is_active boolean default true,
  expires_at timestamptz default (now() + interval '2 years'),
  download_count integer default 0,
  last_accessed timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.19 push_subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_role text,
  user_agent text,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);

-- 3. Fast Query Indexes
create index if not exists idx_cert_tokens_token on public.certificate_tokens(token);
create index if not exists idx_cert_tokens_student_id on public.certificate_tokens(student_id);
create index if not exists idx_push_subs_endpoint on public.push_subscriptions(endpoint);

-- 4. Enable Row Level Security (RLS) and Create Public Policies
-- All sync tables require read/write access via the public anon key.

alter table public.settings enable row level security;
drop policy if exists wfa_settings_all on public.settings;
create policy wfa_settings_all on public.settings for all using (true) with check (true);

alter table public.salary enable row level security;
drop policy if exists wfa_salary_all on public.salary;
create policy wfa_salary_all on public.salary for all using (true) with check (true);

alter table public.students enable row level security;
drop policy if exists wfa_students_all on public.students;
create policy wfa_students_all on public.students for all using (true) with check (true);

alter table public.finance_ledger enable row level security;
drop policy if exists wfa_finance_ledger_all on public.finance_ledger;
create policy wfa_finance_ledger_all on public.finance_ledger for all using (true) with check (true);

alter table public.accounts enable row level security;
drop policy if exists wfa_accounts_all on public.accounts;
create policy wfa_accounts_all on public.accounts for all using (true) with check (true);

alter table public.loans enable row level security;
drop policy if exists wfa_loans_all on public.loans;
create policy wfa_loans_all on public.loans for all using (true) with check (true);

alter table public.exams enable row level security;
drop policy if exists wfa_exams_all on public.exams;
create policy wfa_exams_all on public.exams for all using (true) with check (true);

alter table public.attendance enable row level security;
drop policy if exists wfa_attendance_all on public.attendance;
create policy wfa_attendance_all on public.attendance for all using (true) with check (true);

alter table public.staff enable row level security;
drop policy if exists wfa_staff_all on public.staff;
create policy wfa_staff_all on public.staff for all using (true) with check (true);

alter table public.visitors enable row level security;
drop policy if exists wfa_visitors_all on public.visitors;
create policy wfa_visitors_all on public.visitors for all using (true) with check (true);

alter table public.notices enable row level security;
drop policy if exists wfa_notices_all on public.notices;
create policy wfa_notices_all on public.notices for all using (true) with check (true);

alter table public.advance_payments enable row level security;
drop policy if exists wfa_advance_payments_all on public.advance_payments;
create policy wfa_advance_payments_all on public.advance_payments for all using (true) with check (true);

alter table public.investments enable row level security;
drop policy if exists wfa_investments_all on public.investments;
create policy wfa_investments_all on public.investments for all using (true) with check (true);

alter table public.keep_records enable row level security;
drop policy if exists wfa_keep_records_all on public.keep_records;
create policy wfa_keep_records_all on public.keep_records for all using (true) with check (true);

alter table public.custom_themes enable row level security;
drop policy if exists wfa_custom_themes_all on public.custom_themes;
create policy wfa_custom_themes_all on public.custom_themes for all using (true) with check (true);

alter table public.sub_accounts enable row level security;
drop policy if exists wfa_sub_accounts_all on public.sub_accounts;
create policy wfa_sub_accounts_all on public.sub_accounts for all using (true) with check (true);

alter table public.activity_log enable row level security;
drop policy if exists wfa_activity_log_all on public.activity_log;
create policy wfa_activity_log_all on public.activity_log for all using (true) with check (true);

alter table public.certificate_tokens enable row level security;
drop policy if exists wfa_certificate_tokens_all on public.certificate_tokens;
create policy wfa_certificate_tokens_all on public.certificate_tokens for all using (true) with check (true);

alter table public.push_subscriptions enable row level security;
drop policy if exists wfa_push_subscriptions_all on public.push_subscriptions;
create policy wfa_push_subscriptions_all on public.push_subscriptions for all using (true) with check (true);

-- 5. Auto Update Trigger Function (for certificate_tokens)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cert_tokens_updated_at on public.certificate_tokens;
create trigger cert_tokens_updated_at
  before update on public.certificate_tokens
  for each row execute function update_updated_at();
