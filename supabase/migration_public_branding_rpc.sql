-- ============================================================
-- Migration: Public Branding RPC (for certificate.html portal)
-- ============================================================
-- এই ফাইলটা প্রতিটা লাইভ Supabase প্রজেক্টে (main WFA + প্রতিটা client)
-- একবার করে রান করতে হবে — Supabase Dashboard → SQL Editor → New query → Run।
--
-- কাজ: certificate.html (স্টুডেন্টদের জন্য পাবলিক QR পোর্টাল) থেকে এখন
-- Academy Logo/Name সরাসরি settings টেবিল থেকে দেখানো যাবে, RLS ভাঙা ছাড়াই।
-- শুধুমাত্র academy_name আর logo_url রিটার্ন করে — অন্য কোনো sensitive data না।
-- ============================================================

drop function if exists public.wfa_get_public_branding();
create or replace function public.wfa_get_public_branding()
returns table (
  academy_name text,
  logo_url     text
)
language plpgsql
security definer
as $$
begin
  return query
  select s.academy_name, s.logo_url
  from public.settings s
  order by (case when s.academy_name is not null then 1 else 0 end) desc,
           s.updated_at desc nulls last
  limit 1;
end;
$$;

select '✅ wfa_get_public_branding() তৈরি হয়েছে — certificate.html এখন dynamic logo দেখাতে পারবে।' as status;
