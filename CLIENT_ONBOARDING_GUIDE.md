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

## ✅ STEP 4 — Client App Deploy করুন

### GitHub-এ নতুন Repository তৈরি:
1. https://github.com এ লগইন করুন (আপনার account)
2. "New Repository" → Name: `client-[academy-short-name]`
   উদাহরণ: `client-greenleaf`, `client-skybird`
3. Public → "Create repository"

### Code Push করুন (PowerShell):
```powershell
# Wings-Fly-Academy-1 folder-এ এই command চালান
git clone https://github.com/YOUR_USERNAME/client-greenleaf.git temp_client
Copy-Item -Recurse E:\DESKTOP\Wings-Fly-Academy-1\www\* temp_client\
cd temp_client

# Client-এর Supabase credentials সেট করুন
# supabase-secrets.js ফাইলটি edit করুন:
# const WFA_SUPABASE_SECRETS = { url: 'CLIENT_URL', anonKey: 'CLIENT_KEY' };

git add .
git commit -m "Initial client deployment"
git push origin main
```

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
