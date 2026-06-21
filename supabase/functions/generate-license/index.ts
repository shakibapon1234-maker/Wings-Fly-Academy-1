// ============================================================
// AcadeFlow License Server — generate-license Edge Function
// ============================================================
// ADMIN-ONLY. Caller must send header:
//   x-admin-secret: <ADMIN_GEN_SECRET>
// Requests without a matching secret are rejected with 401.
//
// REQUEST BODY (JSON):
//   { "customerCode": "GL01", "months": 6, "product": "wfa" }
//
// RESPONSE (JSON):
//   { key, expires, customerCode }
//
// SECRETS REQUIRED (set via `supabase secrets set ...`):
//   SUPABASE_URL               (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-provided by Supabase)
//   ADMIN_GEN_SECRET           (you choose this — a long random string)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_GEN_SECRET  = Deno.env.get('ADMIN_GEN_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randHex(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len)
    .toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  if (!ADMIN_GEN_SECRET) {
    console.error('[generate-license] ADMIN_GEN_SECRET not set — refusing all requests');
    return json({ error: 'server_misconfigured' }, 500);
  }
  if (req.headers.get('x-admin-secret') !== ADMIN_GEN_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const customerCode = (payload?.customerCode || 'C001')
    .toString()
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, '0');
  const months  = Math.max(1, parseInt(payload?.months ?? '1', 10) || 1);
  const product = (payload?.product || 'wfa').toString().trim().toLowerCase();

  const now = new Date();
  // ✅ Month-overflow-safe: compute target year/month with pure integer math
  // so e.g. Jan 31 + 1 month correctly lands on Feb, not Mar 3.
  const totalMonths = now.getFullYear() * 12 + now.getMonth() + months;
  const year        = Math.floor(totalMonths / 12);
  const monthIdx    = totalMonths % 12; // 0-11
  const month       = String(monthIdx + 1).padStart(2, '0');
  const lastDay     = new Date(year, monthIdx + 1, 0).getDate();
  const day         = String(lastDay).padStart(2, '0');

  const rand      = randHex(4);
  const cs        = randHex(4); // cosmetic only — DB row is the source of truth
  const key       = `WFA-${rand}-${customerCode}-${year}${month}-${cs}`;
  const expiresAt = `${year}-${month}-${day}`;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[generate-license] Missing SUPABASE_URL / SERVICE_ROLE_KEY secrets');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const supabase   = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error }  = await supabase.from('licenses').insert({
    license_key:   key,
    customer_code: customerCode,
    product,
    expires_at:    expiresAt,
    status:        'active',
  });

  if (error) {
    console.error('[generate-license] insert failed:', error.message);
    return json({ error: error.message }, 500);
  }

  return json({ key, expires: expiresAt, customerCode });
});
