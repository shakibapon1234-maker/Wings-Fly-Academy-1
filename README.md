# Wings Fly Aviation Academy — Management System

## প্রজেক্ট পরিচিতি
Aviation Academy-র জন্য সম্পূর্ণ ম্যানেজমেন্ট সিস্টেম।

- **Type:** PWA (Progressive Web App) — browser-এ সরাসরি চলে
- **Backend:** Supabase (Cloud Sync + Real-time)
- **Offline:** হ্যাঁ — LocalStorage-এ data রাখে, internet ছাড়াও কাজ করে

---

## অফিসে চালানোর নিয়ম

### ১. সাধারণভাবে চালু করা
```
index.html → যেকোনো browser-এ double-click
```
বা local server (recommended):
```bash
python -m http.server 8080
# তারপর: http://localhost:8080
```

### ২. Default Login
- Username: `admin`
- Password: `admin123` ← প্রথম login-এর পরেই বদলান!

---

## সিকিউরিটি সেটআপ (গুরুত্বপূর্ণ)

### ধাপ ১ — Admin Password পরিবর্তন
1. Login → Settings → Security & Access → Change Password

### ধাপ ২ — Supabase RLS Secure করুন
1. Supabase Dashboard → Authentication → Users → Add user
2. SQL Editor → `supabase/rls_policies_secure.sql` run করুন
3. Settings → Security & Access → Supabase Cloud Login → credentials দিন → Save & Connect

### ধাপ ৩ — Visitors Table Migration (একবার)
Supabase SQL Editor → `supabase/visitors_column_migration.sql` run করুন

---

## Code Update করলে
`service-worker.js` এর BUILD_DATE বদলান:
```js
const BUILD_DATE = '2026-04-15'; // আজকের তারিখ
```

---

## Supabase SQL ফাইল
| ফাইল | কখন |
|---|---|
| `rls_policies_secure.sql` | প্রথমবার setup-এ |
| `visitors_column_migration.sql` | একবার migration |

---

## Backup
Settings → Data Management → Export All Data
(পাসওয়ার্ড backup-এ থাকে না — security কারণে)
