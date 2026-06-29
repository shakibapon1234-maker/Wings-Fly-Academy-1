-- ============================================================
-- AcadeFlow License Server — Database Setup
-- ============================================================
-- ⚠️  IMPORTANT: Run this in a SEPARATE, dedicated Supabase
-- project (e.g. "acadeflow-license-server") — NOT in any
-- individual client's (academy's) Supabase project.
--
-- A client owns the admin keys to their own project, so if
-- license data lived there they could mark their own key
-- "active" forever. This project must stay 100% under your
-- control only — no client ever gets credentials to it.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.licenses (
  id            uuid primary key default uuid_generate_v4(),
  license_key   text unique not null,
  customer_code text not null,
  product       text not null default 'wfa',   -- 'wfa' | 'acadeflow' | 'studio-flow' | ...
  issued_at     timestamptz default now(),
  expires_at    date not null,
  status        text not null default 'active', -- 'active' | 'revoked'
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_licenses_key      on public.licenses (license_key);
create index if not exists idx_licenses_customer on public.licenses (customer_code);
create index if not exists idx_licenses_product  on public.licenses (product);

-- ── Row Level Security ──────────────────────────────────────
-- Intentionally NO public policies of any kind. The table is
-- reachable ONLY through the Edge Functions below, which use
-- the service_role key (server-side, never shipped to clients).
-- A bare anon-key client can never SELECT/INSERT/UPDATE here.
alter table public.licenses enable row level security;

-- ── updated_at auto-touch ───────────────────────────────────
create or replace function public.touch_licenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_licenses_touch on public.licenses;
create trigger trg_licenses_touch
before update on public.licenses
for each row execute function public.touch_licenses_updated_at();

-- ============================================================
-- Done. Next steps:
--   1. supabase functions deploy validate-license generate-license revoke-license
--   2. supabase secrets set ADMIN_GEN_SECRET=<a-long-random-string>
--   3. Put this project's URL + anon key into js/core/license-server-config.js
--      (copy from license-server-config.example.js — gitignored, local only)
-- ============================================================
