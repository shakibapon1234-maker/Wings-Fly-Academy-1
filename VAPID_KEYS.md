# VAPID Keys — Wings Fly Academy

> ⚠️ **SECURITY**: The private key for this project must NEVER be committed
> to git. This file intentionally does NOT contain the private key.
>
> 🔁 **2026-06-13 — Key rotated**: a previous version of this file leaked the
> private key into git history. That key pair is REVOKED. A new pair was
> generated and the public key below is the only part safe to commit.

## Public Key (frontend — already set in push-notifications.js)
```
BMR3mMp_lKvOnYNrr8C2LSIm0-DdDVOQYGgQb39XDrnKH-oqcvBmNr2-A9OZND-TU_J9pJ4EFzNJrJKyvLPHpvI
```

## Private Key (backend only — NEVER commit)
The private key is stored **only** in:
1. `VAPID_PRIVATE_KEY.local.md` (gitignored, on your machine), and
2. Supabase Edge Function secret `VAPID_PRIVATE_KEY`
   (set via `supabase secrets set VAPID_PRIVATE_KEY=...`).

If you ever need to regenerate keys:
```bash
npx web-push generate-vapid-keys
```
Then:
1. Update the public key in all 3 `push-notifications.js` copies (see below).
2. Update the Supabase Edge Function secret `VAPID_PRIVATE_KEY`.
3. Bump `service-worker.js` `DEPLOY_ID` (existing push subscriptions tied to
   the old public key will stop working and users will need to re-subscribe).

## Backend Setup (Supabase Edge Function: `supabase/functions/send-push/index.ts`)
The `send-push` Edge Function reads `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
from environment secrets — no keys are hardcoded in source. See
`supabase/functions/send-push/index.ts` and
`supabase/push_subscriptions_setup.sql`.

## Files Updated (public key only)
- `js/core/push-notifications.js` — line 107
- `www/js/core/push-notifications.js` — line 107
- `android/app/src/main/assets/public/js/core/push-notifications.js` — line 107
