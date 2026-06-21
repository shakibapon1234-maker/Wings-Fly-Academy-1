// ============================================================
// AcadeFlow License Server — revoke-license Edge Function
// ============================================================
// ADMIN-ONLY. Caller must send header:
//   x-admin-secret: <ADMIN_GEN_SECRET>
//
// This is a NEW capability that did not exist in the old
// local-only license system: a customer's key can now be killed
// remotely the moment they stop paying / break the agreement —
// no waiting for natural expiry.
//
// REQUEST BODY (JSON):
//   { "key": "WFA-XXXX-XXXX-YYYYMM-CS" }                  -- revoke
//   { "key": "WFA-XXXX-XXXX-YYYYMM-CS", "reactivate": true } -- un-revoke
//
// RESPONSE (JSON):
//   { key, status }
//
// SECRETS REQUIRED (set via `supabase secrets set ...`):
//   SUPABASE_URL               (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-provided by Supabase)
//   ADMIN_GEN_SECRET           (same secret as generate-license)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  if (!ADMIN_GEN_SECRET) {
    console.error('[revoke-license] ADMIN_GEN_SECRET not set — refusing all requests');
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

  const key        = (payload?.key || '').toString().trim().toUpperCase();
  const reactivate = !!payload?.reactivate;
  if (!key) return json({ error: 'key_required' }, 400);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[revoke-license] Missing SUPABASE_URL / SERVICE_ROLE_KEY secrets');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const supabase        = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('licenses')
    .update({ status: reactivate ? 'active' : 'revoked' })
    .eq('license_key', key)
    .select()
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data)  return json({ error: 'key_not_found' }, 404);

  return json({ key, status: data.status });
});
