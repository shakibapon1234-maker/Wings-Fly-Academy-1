# VAPID Keys — Wings Fly Academy
Generated: 2026-06-13

> ⚠️ **IMPORTANT**: Keep the private key SECRET. Never commit it to a public repo.

## Public Key (frontend — already set in push-notifications.js)
```
BO_Oq5KZrZSghWf1rG-i1Bb5GnFBsMDmUkZNWREiWJyh9X9g8wOsMPMc6PimQq4XsMEtaxC-Qeu_9rwFWyDtAs0
```

## Private Key (backend only — Supabase Edge Function / server)
```
1bSKMT7N1mmufpu1Zx_zgpfMUNMYr_PxUjkL7vvPf8o
```

## Backend Setup (Supabase Edge Function)
```js
import webpush from 'npm:web-push';

webpush.setVapidDetails(
  'mailto:your@email.com',
  'BO_Oq5KZrZSghWf1rG-i1Bb5GnFBsMDmUkZNWREiWJyh9X9g8wOsMPMc6PimQq4XsMEtaxC-Qeu_9rwFWyDtAs0',
  '1bSKMT7N1mmufpu1Zx_zgpfMUNMYr_PxUjkL7vvPf8o'
);
```

## Files Updated
- `js/core/push-notifications.js` — line 107
- `www/js/core/push-notifications.js` — line 107
- `android/app/src/main/assets/public/js/core/push-notifications.js` — line 107
