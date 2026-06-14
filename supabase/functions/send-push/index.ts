// ============================================================
// Wings Fly Aviation Academy — send-push Edge Function
// ============================================================
// Sends a Web Push notification to one or more subscribers.
//
// SECRETS REQUIRED (set via `supabase secrets set ...`):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        (e.g. mailto:you@example.com)
//   SUPABASE_URL          (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided by Supabase)
//
// REQUEST BODY (JSON):
//   {
//     "title": "Notification title",
//     "body": "Notification body text",
//     "url": "/?section=finance",      // optional, deep link
//     "endpoint": "https://...",        // optional: send to ONE subscriber only
//     "user_role": "admin"              // optional: send to all subs with this role
//   }
// If neither "endpoint" nor "user_role" is given, sends to ALL subscriptions.
//
// AUTH: This function should be called with the caller's Supabase JWT
// (authenticated admin user). It uses the service_role key internally to
// read push_subscriptions (which has no public SELECT policy).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured on server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { title, body, url, endpoint, user_role } = payload;

  if (!title || !body) {
    return new Response(JSON.stringify({ error: 'title and body are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let query = supabase.from('push_subscriptions').select('*');
  if (endpoint) {
    query = query.eq('endpoint', endpoint);
  } else if (user_role) {
    query = query.eq('user_role', user_role);
  }

  const { data: subs, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No matching subscriptions' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const notificationPayload = JSON.stringify({ title, body, url: url || '/' });

  let sent = 0;
  const expired = [];

  await Promise.all(subs.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, notificationPayload);
      sent++;
    } catch (err) {
      // 404/410 = subscription no longer valid — mark for cleanup
      if (err.statusCode === 404 || err.statusCode === 410) {
        expired.push(sub.endpoint);
      }
      console.error('[send-push] failed for', sub.endpoint, err.statusCode, err.message);
    }
  }));

  // Clean up dead subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return new Response(
    JSON.stringify({ sent, total: subs.length, removed: expired.length }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
