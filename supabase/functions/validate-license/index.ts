// ============================================================
// AcadeFlow License Server — validate-license Edge Function
// ============================================================
// PUBLIC endpoint (no auth required) — any WFA/AcadeFlow client
// instance calls this to check whether a license key is
// currently valid. The secret (DB row + this server-side logic)
// never ships to the browser, unlike the old client-side scheme.
//
// REQUEST BODY (JSON):
//   { "key": "WFA-XXXX-XXXX-YYYYMM-CS", "product": "wfa" }
//   product is optional, defaults to "wfa".
//
// RESPONSE shape matches the OLD client-side LicenseEngine.validate()
// return value 1:1, so license.js only needs to swap "compute
// locally" for "fetch this endpoint":
//   { ok, valid, expired, inGrace, daysLeft, graceDaysLeft,
//     customerCode, expires, key, reason }
//
// SECRETS REQUIRED (set via `supabase secrets set ...`):
//   SUPABASE_URL               (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-provided by Supabase)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GRACE_DAYS        = 7;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid_body' }, 400);
  }

  const rawKey  = (payload?.key || '').toString().trim().toUpperCase().replace(/\s/g, '');
  const product = (payload?.product || 'wfa').toString().trim().toLowerCase();

  if (!rawKey) return json({ ok: false, reason: 'no_key' });

  // Basic format sanity check: WFA-RAND-CODE-YEARMONTH-CS = 5 dash-separated parts
  const parts = rawKey.split('-');
  if (parts.length !== 5 || parts[0] !== 'WFA') {
    return json({ ok: false, reason: 'invalid_format', key: rawKey });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[validate-license] Missing SUPABASE_URL / SERVICE_ROLE_KEY secrets');
    return json({ ok: false, reason: 'server_misconfigured' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: lic, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', rawKey)
    .eq('product', product)
    .maybeSingle();

  if (error) {
    console.error('[validate-license] DB error:', error.message);
    return json({ ok: false, reason: 'server_error' }, 500);
  }

  if (!lic) {
    // Unknown key — never issued, wrong product, or typo.
    return json({ ok: false, reason: 'tampered', key: rawKey });
  }

  if (lic.status === 'revoked') {
    return json({
      ok:           false,
      valid:        false,
      expired:      true,
      inGrace:      false,
      daysLeft:     0,
      graceDaysLeft: 0,
      customerCode: lic.customer_code,
      expires:      lic.expires_at,
      key:          rawKey,
      reason:       'revoked',
    });
  }

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate  = new Date(`${lic.expires_at}T23:59:59`);
  const graceEnd = new Date(expDate.getTime() + GRACE_DAYS * 86400000);

  const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
  const inGrace  = today > expDate && today <= graceEnd;
  const expired  = today > graceEnd;

  return json({
    ok:           !expired,
    valid:        daysLeft > 0,
    inGrace,
    expired,
    daysLeft:     Math.max(daysLeft, 0),
    graceDaysLeft: inGrace ? Math.ceil((graceEnd.getTime() - today.getTime()) / 86400000) : 0,
    customerCode: lic.customer_code,
    expires:      lic.expires_at,
    key:          rawKey,
  });
});
