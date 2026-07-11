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
   → `supabase/CLIENT_MASTER_SETUP.sql`
3. SQL Editor-এ paste করুন → "Run" চাপুন
4. ✅ শেষে "AcadeFlow Client Setup Complete!" status message এবং RLS টেবিলের তালিকা দেখলে সফল

## ✅ STEP 3 — Supabase Credentials Note করুন

Supabase Dashboard → Settings → API:
- **Project URL**: `https://XXXXXXXX.supabase.co` ← এটা নোট করুন
- **anon / public key**: `eyJhbGci...` ← এটা নোট করুন

## ✅ STEP 4 — Client App Deploy করুন (`new-client.ps1` দিয়ে automated)

Manual git clone/copy করার দরকার নেই — পুরো প্রসেসটা `new-client.ps1` script দিয়ে automate করা আছে।

### আগে থেকে যা লাগবে:
- আগে একবার `node build-www.js` চালিয়ে `www/` folder up-to-date আছে কিনা নিশ্চিত করুন
- GitHub-এ client-এর জন্য একটা নতুন (empty) repository তৈরি করে রাখুন
  → https://github.com/new → Name: `client-[academy-short-name]` (উদাহরণ: `client-greenleaf`) → Public → Create

### Script চালান (PowerShell):
```powershell
# Wings-Fly-Academy-1 folder-এ
.\new-client.ps1
```
Script ধাপে ধাপে জিজ্ঞেস করবে:
- Customer Code (যেমন `GL01`), Academy Name, GitHub Repo Name, GitHub Username
- Package (Basic/Pro/Custom), Institution Type (Coaching/School/College)
- Client-এর Supabase Project URL ও Anon Key (STEP 3 থেকে নেওয়া)

এরপর script নিজে থেকেই:
1. `www/`-এর কপি নিয়ে `E:\Task\Client ID\<repo-name>` folder তৈরি করে
2. `js/core/supabase-secrets.js`-এ client credentials বসিয়ে দেয় (frozen)
3. মূল প্রজেক্টের `js/core/clients-metadata.js`-এ নতুন client যোগ করে ও push করে (যাতে Client Manager-এ দেখা যায়)
4. Git init/commit করে, চাইলে সাথে সাথে GitHub-এ push-ও করে দেয়

### GitHub Pages চালু করুন:
1. Repository → Settings → Pages
2. Branch: `main` → Save
3. কয়েক মিনিট পর URL পাবেন: `https://YOUR_USERNAME.github.io/client-greenleaf/`

## ✅ STEP 5 — License Key Generate করুন

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
