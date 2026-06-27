-- ════════════════════════════════════════════════════════════════════════════
--  Wings Fly Academy — MAIN PROJECT MIGRATION
--  student_portal_access টেবিল তৈরি করুন (Main Project Supabase-এ)
--
--  ⚠️  এটি CLIENT_MASTER_SETUP.sql নয়।
--      এটি আপনার নিজের (main) Supabase project-এ রান করুন।
--
--  Supabase Dashboard → SQL Editor → New Query → Paste → Run (F5)
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: student_portal_access টেবিল তৈরি
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Indexes (দ্রুত phone lookup)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_spa_phone      on public.student_portal_access(phone);
create index if not exists idx_spa_student_id on public.student_portal_access(student_id);
create index if not exists idx_spa_is_active  on public.student_portal_access(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Auto updated_at Function + Trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- প্রথমে function তৈরি করা হচ্ছে (যদি না থাকে)
create or replace function public.wfa_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- এরপর trigger যোগ করা হচ্ছে
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_student_portal_access_updated_at'
      and tgrelid = 'public.student_portal_access'::regclass
  ) then
    execute '
      create trigger trg_student_portal_access_updated_at
        before update on public.student_portal_access
        for each row execute function public.wfa_set_updated_at();
    ';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.student_portal_access enable row level security;

drop policy if exists wfa_student_portal_access_all on public.student_portal_access;
create policy wfa_student_portal_access_all on public.student_portal_access
  for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Realtime (live sync)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.student_portal_access;
  exception when others then
    null; -- ইতিমধ্যে যোগ করা থাকলে ignore
  end;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Verification
-- ─────────────────────────────────────────────────────────────────────────────
select
  tablename as "Table",
  case when rowsecurity then '✅ RLS ON' else '❌ RLS OFF' end as "RLS Status"
from pg_tables
where schemaname = 'public'
  and tablename = 'student_portal_access';

select '✅ student_portal_access table ready! এখন Student Portal-এ Access দিন।' as status;
