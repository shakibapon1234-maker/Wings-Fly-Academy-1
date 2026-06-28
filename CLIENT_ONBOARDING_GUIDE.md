# 📋 AcadeFlow — Client Onboarding Checklist
# প্রতিটি নতুন client-এর জন্য এই checklist অনুসরণ করুন

---

## ✅ STEP 1 — Client-এর Supabase Project তৈরি

1. Client-এর Gmail দিয়ে https://supabase.com এ Sign Up করুন
2. "New Project" → Project Name: `[Client Academy Name]`
3. Database Password: একটি শক্তিশালী পাসওয়ার্ড দিন (নিজে সংরক্ষণ করুন)
4. Region: `Southeast Asia (Singapore)` বেছে নিন
5. "Create new project" চাপুন (৩ মিনিট অপেক্ষা করুন)

## ✅ STEP 2 — Database Tables তৈরি

1. Supabase Dashboard → SQL Editor
2. নিচের ফাইলটি খুলুন এবং সম্পূর্ণ SQL কপি করুন:
   → `supabase/master_setup.sql`
3. SQL Editor-এ paste করুন → "Run" চাপুন
4. ✅ "Success. No rows returned" দেখলে সফল

## ✅ STEP 3 — Supabase Credentials Note করুন

Supabase Dashboard → Settings → API:
- **Project URL**: `https://XXXXXXXX.supabase.co` ← এটা নোট করুন
- **anon / public key**: `eyJhbGci...` ← এটা নোট করুন

## ✅ STEP 4 — Client App Deploy করুন (FIXED: এখন `new-client.ps1` ব্যবহার করুন)

> ⚠️ **পুরনো manual পদ্ধতি (clone → copy → secrets.js এডিট → push) ব্যবহার করবেন না।**
> আগে এই পদ্ধতিতে client folder-এর `.gitignore` ভুলভাবে `supabase-secrets.js`-কে git থেকে বাদ
> দিয়ে দিত, ফলে এই ফাইল কখনো GitHub Pages-এ deploy-ই হতো না — এবং deploy হওয়া client app
> credential না পেয়ে silently মেইন admin project-এর Supabase-এ কানেক্ট হয়ে যেত (এটাই
> "মেইন প্রজেক্টের ডেটা client-এ চলে আসা" বাগের মূল কারণ ছিল)। এখন এটা ফিক্স করা হয়েছে।

```powershell
.\new-client.ps1
```

স্ক্রিপ্ট নিজে থেকেই:
1. Client-এর folder তৈরি করবে এবং `www/*` কপি করবে
2. আপনার দেওয়া Supabase URL/Anon Key দিয়ে `js/core/supabase-secrets.js` লিখবে (এবং `Object.freeze()` করে দেবে যাতে runtime-এ override না হয়)
3. `js/core/supabase-standalone-creds.js`-ও client-এর own credentials দিয়ে overwrite করবে
4. একটা `.gitignore` লিখবে যেখানে **`supabase-secrets.js` বাদ দেওয়া হয় না** — কারণ GitHub Pages static hosting, secret hide করার কোনো server-side উপায় নেই; anon key RLS-এর কারণে public হওয়াই নিরাপদ
5. `git init` → commit → (চাইলে) push করে দেবে

### GitHub Pages চালু করুন:
1. Repository → Settings → Pages
2. Branch: `main` → Save
3. কয়েক মিনিট পর URL পাবেন: `https://YOUR_USERNAME.github.io/client-greenleaf/`

## ✅ STEP 5 — License Key Generate করুন [REQUIRED]

> [!IMPORTANT]
> এই ধাপটি **আবশ্যিক (REQUIRED)**। License Key ছাড়া ক্লায়েন্ট প্রথমবার অ্যাপ ওপেন করতে গেলে অ্যাপটি **LOCK** হয়ে যাবে এবং কোনো ডাটা দেখতে পারবে না। তাই ডেপ্লয় করার আগেই License Key জেনারেট করে ক্লায়েন্টকে পাঠানো নিশ্চিত করুন।

1. আপনার Wings Fly Academy app খুলুন
2. Settings → Client Manager
3. "Add New Client":
   - Academy Name: Green Leaf Academy
   - Owner Name: [মালিকের নাম]
   - Customer Code: `GL01` (4 অক্ষর)
   - Validity: 12 Months
4. "Generate New License Key" → Key copy করুন

## ✅ STEP 6 — Client-কে পাঠান

Client-কে নিচের তথ্য পাঠান:

```
🎓 আপনার AcadeFlow Management System প্রস্তুত!

📱 App URL: https://YOUR_USERNAME.github.io/client-greenleaf/

🔑 License Key: WFA-XXXX-GL01-202612-XX

📌 প্রথমবার খোলার নিয়ম:
1. উপরের URL টি ব্রাউজারে খুলুন
2. License Key দিন এবং Validate করুন
3. আপনার Admin Password সেট করুন
4. ✅ আপনার system প্রস্তুত!

⚠️ এই তথ্য গোপন রাখুন।
```

---

## 📊 Client Records (নিজের জন্য)

| Client | Academy | URL | License Key | Supabase Project | Gmail |
|--------|---------|-----|-------------|-----------------|-------|
| GL01   | Green Leaf | github.io/client-greenleaf | WFA-... | greenleaf-academy | client@gmail.com |

---

## ⚠️ গুরুত্বপূর্ণ নোট

- **Supabase Free**: প্রতি Gmail-এ ২টি project (client-এর Gmail ব্যবহার করুন)
- **GitHub**: আপনার account-এ unlimited public repos (free)
- **License Revoke**: যদি কোনো client payment বন্ধ করে → Client Manager → Revoke
- **Update**: কোনো bug fix করলে client-এর repo-তেও push করুন
