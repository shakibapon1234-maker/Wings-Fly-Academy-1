# WFA Audit Ignore List — পড়ুন প্রতিটি অডিট/ফিক্সের আগে

এই ফাইল **অডিট, রিভিউ, বা নতুন ফিচার যোগ করার আগে** পড়তে হবে।  
লক্ষ্য: অফিসে চলমান অ্যাপ ভাঙা না, `settings.js` অপ্রয়োজনীয়ভাবে বড় না হওয়া।

---

## 1. Settings মডিউল (`js/ui/settings.js`)

| নিয়ম | কারণ |
|--------|--------|
| **নতুন ফিচার/লজিক settings.js-এ লিখবেন না** (যতটা সম্ভব) | ফাইল ইতিমধ্যে বিশাল (~6500+ লাইন); DOM + লজিক মিশে রক্ষণাবেক্ষণ কঠিন |
| **নতুন UI/HTML ব্লক settings-এ যোগ করবেন না** | Settings প্যানেলের DOM আর বড় করা যাবে না |
| **বিকল্প ফাইল** | `js/core/settings-diagnostics.js`, `js/core/system-diagnostics.js`, `js/core/sync-guard.js`, `js/core/supabase-sync.js`, মডিউল-নির্দিষ্ট `js/modules/*.js` |
| Settings-এ শুধু **ইতিমধ্যে থাকা** বাটন/ট্যাব থেকে **এক লাইনের onclick** দিয়ে বাইরের মডিউল কল করা চলে | উদাহরণ: `WfaSettingsDiagnostics.run()`, `SystemDiagnostics.runSalaryTests()` |

### Settings-এ যা করা যায় (সীমিত)

- ছোট onclick ওয়্যারিং যা অন্য ফাইলের `window.*` API কল করে
- বিদ্যমান ট্যাবের লেবেল/টেক্সট ঠিক করা (লাইন সংখ্যা বাড়ানো ছাড়া)

### Settings-এ যা করা যাবে না

- নতুন `<div class="settings-card">` বা বড় HTML টেমপ্লেট ব্লক
- নতুন ৫০+ লাইনের ফাংশন সরাসরি settings.js-এ
- Diagnostic / sync / salary / exam / student লজিক settings-এ কপি করা

---

## 2. Supabase / স্কিমা

| টেবিল | ক্লাউড কলাম (প্রায়) | লোকাল অ্যাপ ফিল্ড |
|--------|----------------------|-------------------|
| `salary` | `basic`, `total`, `paid` (**boolean**), `date`, `method` | `baseSalary`, `paidAmount`, `paid` (boolean), `paidDate` |
| `exams` | `fee_paid` (**numeric**) | `fee_paid` (boolean UI) |

ম্যাপিং শুধু `js/core/supabase-sync.js` → `_prepareRecordForCloud` / pull normalize — মডিউলে আলাদা স্কিমা বানাবেন না।

---

## 3. Diagnostic টেস্ট ডেটা

- `SystemDiagnostics` / `WfaSettingsDiagnostics` **ডামি রেকর্ড** তৈরি করে শেষে মুছে দেয়।
- Activity log থেকে `DIAG-`, `Diagnostic Test`, `Auto-generated diagnostic` ফিল্টার হয়।
- অডিটে এই টেস্ট ডেটাকে **production bug** বলে রিপোর্ট করবেন না।

---

## 4. অডিট রিপোর্ট ব্যাখ্যা

| দেখানো | সাধারণত মানে |
|---------|----------------|
| **Run Scan** (read-only) | লোকাল ডেটা + মডিউল চেক; CRUD গ্যারান্টি নয় |
| **Salary / Exam / Loan Test** | লোকাল IndexedDB-এ create/delete/restore; PASSED = ওই ফ্লো ঠিক |
| Console `[Sync] Push failed` | ক্লাউড স্কিমা/কলাম — Scan PASS হলেও হতে পারে; sync ফিক্স আলাদা |
| `Retry queue: N pending` | আগের ব্যর্থ push; স্কিমা ঠিক হলে নিজে থেকে কমে |

---

## 5. Students — Installment (ইনস্টলমেন্ট)

- প্রতিটি installment = `finance_ledger` row, `category: 'Student Fee'`, `ref_id` = student UUID।
- **একটি installment delete** → বাকি rows থেকে `paid`/`due` আবার হিসাব।
- **Student delete** → সব installment finance সহ recycle bin।
- **Student restore** (Settings) → `ref_id` দিয়ে linked finance auto-restore (`supabase-sync.js`)।
- Installment edit: `saveEditedPayment` — ledger sum + unrecorded initial preserve।

নতুন installment লজিক `js/modules/students.js`-এ; settings-এ নয়।

---

## 6. সতর্কতা (সাধারণ)

1. **কম diff** — শুধু যে বাগ/ফিচার, সেটাই।
2. **`settings.js` স্পর্শ করলে** — PR/চ্যাটে কারণ লিখুন; বিকল্প ফাইল প্রথম চেষ্টা।
3. **কমিট/পুশ** ইউজার না বললে করবেন না।
4. **Recycle bin / balance** — delete আগে finance reverse, restore পরে linked finance ফিরিয়ে আনুন (salary/exam/student প্যাটার্ন)।
5. **অফিস ডেটা** — diagnostic দিয়ে test করুন; হাতে fake student/salary অফিসে রাখবেন না।

---

## 7. Account রেকর্ড (Cash/Bank/Mobile) — ডুপ্লিকেট প্রতিরোধ

**ঘটনা (2026-06-29):** Setup wizard-এর একটা আলাদা, network-নির্ভর duplicate-check race condition-এর কারণে দ্বিতীয় একটা "Cash" account row (balance ০) তৈরি হয়ে যায়। Dashboard/Accounts পেজের পুরনো selection logic ("সবচেয়ে বড় balance নাও") ভুল করে এই ০-ব্যালেন্সের ডুপ্লিকেটটাকে রিয়েল অ্যাকাউন্টের ওপর প্রায়োরিটি দিচ্ছিল মাঝে মাঝে, ফলে ৳৩৮,০৩০-এর জায়গায় ৳৮,৫১৯ দেখাচ্ছিল।

### নিয়ম (বাধ্যতামূলক)

1. **কোনো নতুন Cash/Bank/Mobile account row সরাসরি `push`/`insert` করা যাবে না** (JSON import, migration, backup restore, setup wizard — যেকোনো জায়গা থেকে)। সবসময় `SupabaseSync.upsertAccountByTypeName(type, name, balance, extra, options)` ব্যবহার করতে হবে — এটা টাইপ+নাম দিয়ে existing row খোঁজে, পেলে আপডেট করে, না পেলে তবেই একটামাত্র নতুন row তৈরি করে।
2. **Duplicate account row পাওয়া গেলে কখনো auto-delete/auto-merge করা যাবে না।** Balance-এর সাইজ (বড়/ছোট) বা `updated_at`-এর recency — কোনোটাই নির্ভরযোগ্য সিগন্যাল না, কারণ phantom duplicate তৈরি হওয়ার সময়ও তার `updated_at` সাম্প্রতিক হয়ে যায়, এবং ইউজারের ইচ্ছাকৃত manual balance correction-এর কারণে real account-এর balance ছোটও হতে পারে। ফলাফল: একবার auto-heal ইউজারের manual ৳১,০০০ adjustment মুছে দিয়েছিল ভুল row রেখে দিয়ে।
3. **শুধু সনাক্ত করে সতর্ক করুন।** `SupabaseSync.ensureDefaultCashAccount()` ডুপ্লিকেট পেলে শুধু `console.error` + `Utils.toast` + `wfa:duplicate_cash_accounts` event ফায়ার করে — কোনো row ছোঁয় না। ইউজারকে নিজে Accounts ট্যাব থেকে বেছে ভুল row delete করতে হবে।
4. **app.js init-এ `ensureDefaultCashAccount()` প্রতি লোডে চলে** (শুধু detect/warn করার জন্য) — এটা সরিয়ে ফেলবেন না, এটাই নতুন ডুপ্লিকেট ধরা পড়ার একমাত্র জায়গা।

### প্রভাবিত ফাইল (রেফারেন্স) — 2026-06-29
- `js/core/supabase-sync.js` — `upsertAccountByTypeName()`, `ensureDefaultCashAccount()` (detect-only)
- `js/modules/accounts.js` — `getPrimaryCashAccount()`
- `js/ui/dashboard.js` — `normalizeAccounts()`
- `js/ui/setup-wizard.js` — Cash account bootstrap (এখন শুধু `ensureDefaultCashAccount()` কল করে, সরাসরি insert করে না)
- `js/ui/settings.js` — JSON migration importer (এখন `upsertAccountByTypeName()` দিয়ে accounts import করে)

---

### 🔴 Root Cause বিশ্লেষণ (2026-06-30 — চূড়ান্ত সংশোধন)

উপরের নিয়ম লেখার পরেও ডুপ্লিকেট তৈরি হচ্ছিল কারণ কোডে বাস্তবায়ন সম্পূর্ণ ছিল না।

**৫টি জায়গায় Cash account তৈরি হওয়ার পথ ছিল:**

1. **`setup-wizard.js`** — দুটো আলাদা Cash insert একই session-এ:
   - সরাসরি `client.from('accounts').insert()` Cloud REST-এ
   - `ensureDefaultCashAccount()` Local IDB-তে
   - Sync হলে দুটো row-ই Supabase-এ যেত → ডুপ্লিকেট

2. **`supabase-sync.js` → `ensureDefaultCashAccount()`** — উপরের নিয়ম লেখার পরেও এটা এখনো `insert()` করছিল, শুধু detect করছিল না।

3. **`supabase-sync.js` → `repairMissingStudentFinance()`** — এটাও `ensureDefaultCashAccount()` কল করছিল।

4. **`supabase-sync.js` → `_updateBalanceCore()`** — Cash account না পেলে silently নতুন Cash row তৈরি করছিল।

5. **`backup-restore.js` এবং `settings.js` JSON import** — existing Cash থাকলেও blindly নতুন row push করছিল।

**চূড়ান্ত fix (2026-06-30):**
- `ensureDefaultCashAccount()` → সম্পূর্ণ detect-only। কোনো insert নেই কখনো।
- `setup-wizard.js` → একটাই `upsert(ignoreDuplicates: true)`, `ensureDefaultCashAccount()` call নেই।
- `repairMissingStudentFinance()` → `ensureDefaultCashAccount()` call সরানো।
- `_updateBalanceCore()` → Cash auto-create বন্ধ — warn করে return false।
- `backup-restore.js` + `settings.js` → existing Cash থাকলে balance update, নতুন row না।

### প্রভাবিত ফাইল (রেফারেন্স) — 2026-06-30
- `js/core/supabase-sync.js` — `ensureDefaultCashAccount()` (detect-only, কখনো insert করে না), `_updateBalanceCore()` (Cash auto-create বন্ধ)
- `js/modules/accounts.js` — `getPrimaryCashAccount()` (largest balance — তবে duplicate থাকা উচিত নয়)
- `js/ui/dashboard.js` — `normalizeAccounts()` (type+name key দিয়ে dedup)
- `js/ui/setup-wizard.js` — Cash bootstrap: একটাই upsert + ignoreDuplicates:true
- `js/core/backup-restore.js` — existing Cash থাকলে update, নতুন row না
- `js/ui/settings.js` — JSON import: existing Cash থাকলে update, নতুন row না

---

## 8. Sync Pull — `accounts.balance` ওভাররাইট সমস্যা

**ঘটনা (2026-06-30):** ব্যালেন্স ৳৭৩,০৩০ থেকে হঠাৎ ৳৩৬,৫৩০-এ নেমে যায়। কারণ অনুসন্ধানে পাওয়া যায়:

### সমস্যার কারণ — `mergeRows()` conflict resolution

`supabase-sync.js`-এর `mergeRows()` ফাংশনে নিয়ম ছিল:
> "যে record-এর `updated_at` timestamp বেশি নতুন, সে জিতবে।"

**ফলাফল:** REST API দিয়ে Supabase-এ সরাসরি নতুন timestamp-সহ balance পরিবর্তন করলে, পরবর্তী sync pull-এ সেই cloud value LOCAL-কে overwrite করত।

এই session-এ Supabase-এ REST API দিয়ে Cash balance পরিবর্তন করা হয়েছিল (backup থেকে সঠিক মান বের করে)। কিন্তু তখন local IDB-তে আলাদা/বেশি balance ছিল (যা real transactions থেকে আসা):
- **Bikash:** local ৳১৫,৮১০ → cloud-এ ৳৮,৫১৯ ছিল → sync pull-এ ৳৮,৫১৯ হয়ে গেল
- **Brac Bank:** local ৳২০,০০০ → cloud-এ ৳০ ছিল → sync pull-এ ৳০ হয়ে গেল
- **Cash:** local-এ বেশি ছিল → cloud-এর নতুন timestamp জিতে overwrite হলো

### চূড়ান্ত fix (2026-06-30)

**নিয়ম যোগ হলো `_pullCoreInternal()` ফাংশনে:**

```
accounts.balance → সবসময় LOCAL জিতবে (cloud কখনো overwrite করবে না)
নতুন account (শুধু cloud-এ আছে) → cloud-এর balance নেবে
অন্য সব field → আগের মতো (updated_at newer version জিতবে)
```

**কারণ:** `accounts.balance` সর্বদা `updateAccountBalance()` ফাংশনের মাধ্যমে real transactions (salary, student fee, expense) থেকে আপডেট হয়। এই locally-maintained balance কখনো cloud pull থেকে overwrite হওয়া উচিত নয়।

### গুরুত্বপূর্ণ নিয়ম (ভবিষ্যতের জন্য)

1. **Supabase-এ সরাসরি REST API দিয়ে `accounts.balance` পরিবর্তন করবেন না।**  
   কারণ: এই session-এ সেটা করতে হয়েছিল balance restore করতে, কিন্তু এতে local data overwrite হয়ে গিয়েছিল।  
   সঠিক পথ: `SupabaseSync.updateAccountBalance(method, amount, 'in'/'out')` ব্যবহার করুন।

2. **Balance কমে গেলে প্রথমে যা করবেন:**
   - Browser console খুলুন (`F12`)
   - `[DataMonitor] ⚠️ Suspicious Direct Balance Change` বার্তা দেখুন
   - কোন account, কত থেকে কতে গেছে — সেখান থেকে সঠিক মান বের করুন

3. **Data Migration-এর phantom data সম্পর্কে:**  
   পুরনো app থেকে migration করার সময় অনেক duplicate/phantom account তৈরি হয়েছিল (snapshots-এ ১৪-১৭টি Cash account দেখা গেছে, একটিতে ৳৩,৫৩,৪৬৯ phantom balance)। এই phantom records local IDB-তে থাকায় মাঝে মাঝে এলোমেলো balance দেখাচ্ছিল। Section 7-এর fix-এ duplicate creation বন্ধ হয়েছে।

### প্রভাবিত ফাইল — 2026-06-30 (Section 8)
- `js/core/supabase-sync.js` — `_pullCoreInternal()`: accounts.balance local-authoritative protection যোগ হয়েছে
- `js/core/supabase-sync.js` — `_updateBalanceCoreInternal()`: সবচেয়ে পুরনো Cash account select (oldest `created_at`) — duplicate থাকলেও original-এ transaction যাবে

---

*আপডেট: 2026-06-30 (2) — Section 8: sync pull balance overwrite bug + চূড়ান্ত fix + ৳৭৩,০৩০ balance restore।*
*আপডেট: 2026-06-30 — Section 7 root cause analysis (5 sources) + চূড়ান্ত fix বর্ণনা।*
*আপডেট: 2026-06-29 — Account (Cash/Bank/Mobile) ডুপ্লিকেট প্রতিরোধ নিয়ম যোগ (Section 7)।*
*আপডেট: 2026-05-23 — Salary cloud `paid` boolean, SyncEngine pull fix, AUDIT_IGNORE প্রথম সংস্করণ.*



---

## 9. নতুন Client ID (fresh deployment)-এ দুটো নতুন বাগ ধরা পড়ল ও ফিক্স হলো (2026-07-02)

**পটভূমি:** Shakib প্রথমবার একটা client ID (নতুন client deployment, নিজস্ব Supabase project) খুলে টেস্ট করার সময় দুটো সমস্যা পান, যেগুলো main dev project-এ কখনো দেখা যায়নি — কারণ main project-এ setup wizard আর re-run হয় না এবং institution type বহু আগেই সেট করা।

### 9.1 — Institution Type সিলেকশন রিভার্ট হয়ে যাচ্ছিল

**উপসর্গ:** Settings → Institution Type-এ ম্যানুয়ালি একটা টাইপ (যেমন College) সিলেক্ট করার পরও, sync/reload-এর পর সেটা আবার আগের (provisioning-time ডিফল্ট) টাইপে ফিরে যাচ্ছিল।

**Root cause:** `js/core/institution-mode.js`-এ `get()` এবং `hydrateFromSettings()` — দুটোতেই `WFA_SUPABASE_SECRETS.institutionType` (client provisioning-এর সময় `new-client.ps1` যা স্থায়ীভাবে `js/core/supabase-secrets.js`-এ বেক করে) সবসময় `settings.institution_type` (cloud-synced, ইউজারের আসল পছন্দ)-কে হারিয়ে দিত। `hydrateFromSettings()` প্রতিটা `wfa:synced` ইভেন্টে (মানে প্রায় প্রতি reload/reconnect-এ) deploy-secrets দিয়ে settings জোর করে ওভাররাইট করত।

**Fix:** এখন deploy-secrets শুধু **এক-বারের seed** — কেবল তখনই ব্যবহার হয় যখন `settings.institution_type` এখনো একদম খালি (brand-new client, প্রথম hydrate)। একবার settings row-এ কোনো মান বসে গেলে (seed হোক বা ম্যানুয়াল), সেটাই স্থায়ী source of truth; deploy-secrets আর কখনো সেটা ছোঁবে না।

**প্রভাবিত ফাইল:** `js/core/institution-mode.js`, `www/js/core/institution-mode.js` (ফিক্স করা হয়েছে) — `android/app/src/main/assets/public/js/core/institution-mode.js` তে এখনো আগের/আলাদা সংস্করণ আছে, `npm run build:mobile` চালিয়ে sync করা দরকার।

### 9.2 — নতুন Client-এ Cash account balance স্থায়ীভাবে ৳0 দেখাচ্ছিল

**উপসর্গ:** নতুন client-এ setup wizard শেষ করে test student add করে cash payment নেওয়ার পরও Accounts ট্যাব, Dashboard — সব জায়গায় Cash balance ৳0। অথচ Finance Ledger-এ payment entry ঠিকই +৳1,000 income হিসেবে রেকর্ড হয়েছিল, কিন্তু সেই row-এর "Balance" কলামও ৳0 দেখাচ্ছিল।

**Root cause:** `js/ui/setup-wizard.js`-এর Cash account bootstrap (AUDIT_IGNORE Section 7-এ উল্লেখিত "শুধু এখানেই তৈরি হয়" জায়গা) `client.from('accounts').upsert()` দিয়ে সরাসরি **শুধু cloud Supabase-এ** Cash account তৈরি করত — local IndexedDB-তে কিছুই লেখা হতো না। Setup শেষ হওয়ার পর পরই (পরের একটা full sync pull হওয়ার আগেই) কেউ payment নিলে, `_updateBalanceCoreInternal()` (`js/core/supabase-sync.js`) লোকাল `accounts` টেবিলে Cash খুঁজে না পেয়ে (AUDIT_IGNORE Section 7-এর "auto-create করা যাবে না" নিয়ম মেনেই) balance update চুপচাপ skip করত (শুধু `console.warn` + toast, কোনো error throw হতো না) — তাই সহজে চোখ এড়িয়ে যায়।

**Fix:** এখন `SupabaseSync.insert('accounts', {...}, {bypassLog:true})` ব্যবহার হচ্ছে, যেটা local IndexedDB-তে সাথে সাথে লেখে **এবং** cloud-এ push/queue করে — এক কলেই দুটো, sync-pull race নেই। (`upsertAccountByTypeName()` নামের ফাংশন AUDIT_IGNORE Section 7-এ mandate করা থাকলেও কোডে আসলে exist করে না — এই ফিক্সে সরাসরি `SupabaseSync.insert()` ব্যবহার করা হয়েছে, যেটা একই local-first গ্যারান্টি দেয়।)

**প্রভাবিত ফাইল:** `js/ui/setup-wizard.js`, `www/js/ui/setup-wizard.js` (ফিক্স করা হয়েছে) — `android/app/src/main/assets/public/js/ui/setup-wizard.js` এখনো পুরনো সংস্করণ, sync দরকার।

**যাদের এই বাগে ইতিমধ্যে ভুগেছে (আগের client ID গুলোতে):** Cash balance ৳0 দেখাচ্ছে এমন যেকোনো fresh/নতুন client-এ, Accounts ট্যাব থেকে ম্যানুয়ালি একবার সঠিক balance বসিয়ে দিলেই ঠিক হয়ে যাবে (এরপর থেকে normal ভাবে balance আপডেট হবে) — এটা শুধু account **তৈরির মুহূর্তের** bootstrap বাগ, চলমান balance calculation লজিকে সমস্যা নেই।

### 9.3 — root/www/android তিন কপি sync-এ নেই (আলাদা ইস্যু, এখনো ফিক্স করা হয়নি)

অডিটের সময় দেখা গেছে `js/`, `www/js/`, এবং `android/app/src/main/assets/public/js/` — এই তিনটা প্রায়ই out-of-sync থাকে (`android` কপিটা সবচেয়ে পুরনো)। Client deployment (`new-client.ps1`) সবসময় `www/` থেকে কপি করে, তাই এই নির্দিষ্ট দুটো বাগের সাথে android-এর সরাসরি সম্পর্ক নেই। কিন্তু ভবিষ্যতে Android APK build করার আগে `npm run build:mobile` (বা `node build-www.js && npx cap sync`) চালানো must, নাহলে APK-তে পুরনো/আলাদা কোড থাকবে।

### প্রভাবিত ফাইল — 2026-07-02 (Section 9)
- `js/core/institution-mode.js` — Institution type overwrite fix
- `js/ui/setup-wizard.js` — Cash account bootstrap fix

---

## 10. Build এবং Sync নিয়ম (www/ ও Android/ build synchronization)

**ঘটনা (2026-07-02):** নতুন মডিউল (`settings-student-portal.js`) এবং রিফ্যাক্টরিং করার পর `build-www.js` রান না করায় `www/` এবং `android/app/src/main/assets/public/` কপিগুলোতে পুরনো monolithic কোড থেকে গিয়েছিল। 

### নিয়ম (বাধ্যতামূলক)

1. **যেকোনো কোড/ফাইল চেঞ্জ করার পর বিল্ড ও সিঙ্ক করতে হবে:**
   - ব্রাউজার/PWA ডেপ্লয় এবং Android সিঙ্ক নিশ্চিত করতে সবসময় `node build-www.js` অথবা `npm run sync` রান করবেন।
   - Android বিল্ড আপডেট করতে `npx cap sync android` অথবা `npm run build:mobile` রান করবেন।
2. **সার্ভিস ওয়ার্কার ক্যাশ-বাস্টিং (Cache-Busting):**
   - `build-www.js` রান করলে এটি স্বয়ংক্রিয়ভাবে `version.json`-এর `deploy_id` নিয়ে `service-worker.js`-এর `DEPLOY_ID` সিঙ্ক করে দেয়। তাই ম্যানুয়ালি `DEPLOY_ID` এডিট করার প্রয়োজন নেই, শুধু `version.json`-এ আপডেট করলেই হবে।
3. **Credentials বর্জন:**
   - বিল্ড স্ক্রিপ্টটি স্বয়ংক্রিয়ভাবে `supabase-secrets.js` এবং `license-server-config.js` বিল্ড ডিরেক্টরি (`www/`) থেকে রিমুভ করে দেয় যাতে প্রোডাকশন বান্ডেলে ক্রেডেনশিয়াল লিক না হয়।

*আপডেট: 2026-07-02 — Section 10: Build/Sync নিয়ম এবং সার্ভিস ওয়ার্কার সিঙ্ক রুল যুক্ত করা হয়েছে।*

---

## 11. Payment System — সম্পূর্ণ লজিক (AI/অডিট রেফারেন্স)

**আপডেট: 2026-07-03** — পুরো ওয়েব অ্যাপের payment/finance flow এক জায়গায়।  
Finance Ledger Repair যাচাই করার আগে এই section পড়ুন।

### 11.1 — দুই-স্তরের মডেল

| স্তর | টেবিল/ফিল্ড | Source of truth কখন | কী ধরে |
|------|-------------|---------------------|--------|
| **Account Balance** | `accounts.balance` | দৈনন্দিন লেনদেন — live | Cash/Bank/Mobile-এ **এখন কত টাকা আছে** |
| **Finance Ledger** | `finance_ledger` | Audit, history, running balance column | **কোন লেনদেন কখন, কত, কোন account-এ** |

**মূল API:** `SupabaseSync.updateAccountBalance(method, amount, 'in'|'out')` — প্রতিটি real transaction-এ account balance incrementally আপডেট করে।  
Balance কখনো সরাসরি edit করা উচিত নয় (Section 8 দেখুন)।

### 11.2 — Transaction type → কোথায় effect

| Transaction | Module/ফাইল | Finance Ledger | Account Balance | Dashboard P&L (Income/Expense) |
|-------------|-------------|----------------|-----------------|-------------------------------|
| **Student Fee** (add/edit/payment) | `students.js` | ✅ `Income`, category `Student Fee`, `ref_id`=student UUID | ✅ `in` | ✅ Income (via `students.paid`) |
| **Online Payment** (bKash/Nagad approve) | `payment-engine.js` | ✅ Student Fee | ✅ `in` | ✅ |
| **Exam Fee** | `exam.js` | ✅ Income | ✅ `in` | ✅ |
| **Salary** | `salary.js` | ✅ Expense | ✅ `out` | ✅ Expense |
| **Manual Income/Expense** | `finance.js` | ✅ | ✅ | ✅ |
| **Inter-account Transfer** | `accounts.js` | ✅ `Transfer Out` + `Transfer In` (দুই row) | ✅ from `out`, to `in` | ❌ P&L-এ নয় |
| **Loan Giving / Receiving** | `loans.js` | ✅ mirror row (`_isLoan: true`, display-only) | ✅ `loans.js` সরাসরি | ❌ Loan ≠ income/expense |
| **Investment In / Out** | `settings.js` (Investment tab) | ✅ `Investment In` / `Investment Out` | ✅ save/delete-এ; ⚠️ return-এ balance skip (11.5) | ❌ Investment ≠ income/expense |
| **Advance Payment** | `settings.js` (Advance tab) | ✅ `Expense` (give) / `Income` (return) | ✅ give/delete-এ; ⚠️ return-এ balance skip (11.5) | Advance Expense/Income হিসেবে ledger-এ আছে |

**গুরুত্বপূর্ণ:** Loan, Investment, Transfer — **account balance পরিবর্তন করে**, কিন্তু Dashboard-এর **Net Profit / Total Income-Expense**-এ ঢোকে না (by design)।  
Finance page-এর **Total Income / Total Expense / Net** card-ও শুধু `type==='Income'` ও `type==='Expense'` count করে — Investment/Loan/Transfer সেখানেও net-এ নয়।  
Finance page-এর **Balance column** (running balance) `_balanceDir()` দিয়ে Investment/Loan/Transfer সব include করে।

### 11.3 — Loan: double-count প্রতিরোধ

```
loans.js save:
  1. updateAccountBalance()  ← balance-এর আসল effect
  2. finance_ledger insert (_isLoan: true)  ← শুধু display mirror
```

- `recalculateAccountBalancesFromLedger()` finance loop-এ `_isLoan` entries **skip** করে।
- Loan balance effect **`loans` table** থেকে আলাদাভাবে যোগ হয়।
- Cloud pull-এ `_isLoan` strip হলে `supabase-sync.js` pull normalize `category==='Loan'` rows-এ `_isLoan: true` restore করে (BUG-05 fix)।
- `finance.js` filter: default view-এ `_isLoan` entries লুকানো; Loan filter select করলে দেখায়।

### 11.4 — Investment ও Advance: আলাদা master table + finance mirror

| Master table | Finance mirror | Balance on create |
|--------------|----------------|-------------------|
| `investments` | `Investment In` / `Investment Out` | saveInvestment → `in`; delete → reverse `out` |
| `advance_payments` | `Expense` (Advance Payment) / `Income` (Advance Return) | saveAdvance → `out`; delete → reverse `in` |

Investment/Advance **tracking UI** Settings → Accounts sub-tab-এ; Finance module-এ general ledger হিসেবে entries দেখা যায়।

### 11.5 — Advance / Investment Return: live balance (fix 2026-07-03)

`settings.js` → `saveReturnAdvance()` ও `saveReturnInvestment()`:
- Finance ledger row insert ✅
- **`updateAccountBalance()` call** ✅ (fix 2026-07-03)
  - Advance return → `'in'` (টাকা ফিরে আসে)
  - Investment return → `'out'` (investor-কে ফেরত) + insufficient balance pre-check

Create/delete flows আগ থেকেই balance update করত; return flow-ই gap ছিল।

### 11.6 — Finance Ledger Repair (Settings → Data Management)

**দুই ধাপ — শুধু step 1 student-specific; step 2 সব transaction type:**

#### Step 1: `SupabaseSync.repairMissingStudentFinance()`
- **শুধু Student Fee** missing entries backfill (`student.paid` > ledger sum)।
- Deterministic ID: `REPAIR-{studentUUID}` — idempotent।
- আগের REPAIR/Auto-healed entries মুছে fresh check।
- **`updateAccountBalance()` call করে না** — step 2 balance ঠিক করবে।
- **Cutoff:** `localStorage.wfa_repair_cutoff_date` set থাকলে `admission_date < cutoff` students skip।
- Loan / Investment / Advance / Transfer — **এ step touch করে না** (ঠিক আছে)।

#### Step 2: `SupabaseSync.recalculateAccountBalancesFromLedger()`
- Finance ledger + loans table থেকে **account balance nuclear reset**।
- Finance loop-এ count: `Income`, `Expense`, `Transfer In/Out`, `Investment In/Out`।
- Skip: `_isLoan`, `Opening Balance`, `Balance Adjustment`, diagnostic notes।
- Loans: `loans` table থেকে Giving=`out`, Receiving=`in` (finance `_isLoan` mirror skip)।
- **Cutoff (বাধ্যতামূলক):** `wfa_repair_cutoff_date` থাকলে তার **আগের finance entries ও loan rows skip** — migration data touch হয় না (fix 2026-07-03)।
- Balance `Math.max(0, net)` — negative balance clamp (11.7)।

**Settings UI — unified (fix 2026-07-03):**  
উভয় Settings tab-এর Repair বাটন **`SettingsModule.repairAndRecalculate()`** call করে (Step 1 + Step 2)।

**Auto startup repair:** `_runStartupFinanceRepair()` — **disabled** (AUDIT Section 8, v3)। শুধু manual Settings থেকে চালান।

**Backup import:** `backup-restore.js` — auto recalculate **disabled**; import পর manually Repair চালাতে হবে।

### 11.7 — Finance Ledger Repair: সতর্কতা

1. **Cutoff + Baseline (fix 2026-07-03):** `setRepairCutoffToday()` current account balance snapshot করে (`wfa_repair_cutoff_baselines`)। Recalculate: `balance = baseline + post-cutoff ledger net` — migration-এর আগের balance হারায় না। Snapshot না থাকলে প্রথম recalculate-এ derive করে save।
2. **Negative balance:** Recalculate আর `Math.max(0)` clamp করে না — ledger অনুযায়ী negative দেখাতে পারে (warning toast)।
3. **Loan repayments:** `repayment_amount` field production UI-তে নেই — dead code।
4. **P&L vs Balance:** Repair **account balance** ঠিক করে; Dashboard Net Profit / Finance Income-Expense totals **by design** পরিবর্তন হয় না।

### 11.8 — Related modules (quick map)

| ফাইল | দায়িত্ব |
|-------|----------|
| `js/core/supabase-sync.js` | IDB sync, `updateAccountBalance`, repair, recalculate, restore balance rules |
| `js/modules/students.js` | Student fee payments, `repairMissingFinanceEntries()` wrapper |
| `js/modules/finance.js` | Manual ledger CRUD, running balance UI, `_balanceDir` |
| `js/modules/loans.js` | Loan CRUD + balance + `_isLoan` finance mirror |
| `js/modules/accounts.js` | Transfer, account list; `verifyAccountBalance`/`recalculateBalance` **disabled** |
| `js/modules/salary.js`, `exam.js` | Module-specific expense/income |
| `js/core/payment-engine.js` | Student portal online payment approve |
| `js/ui/settings.js` | Advance/Investment UI, `repairAndRecalculate()` wrapper |
| `js/ui/dashboard.js` | P&L — loan guard, student.paid-based income |
| `js/core/sync-guard.js` | Read-only `auditFinance()`, `auditBalances()` |

### 11.9 — Fee Reconciliation vs Finance Ledger Repair

| Tool | কী করে | Source of truth |
|------|--------|-------------------|
| **Fee Reconciliation** (`Students.reconcileAllStudents()`) | `student.paid`/`due` ← finance ledger sum sync | Finance ledger |
| **Finance Ledger Repair step 1** | Missing finance entries ← `student.paid` gap | Student.paid |
| **Finance Ledger Repair step 2** | Account balance ← full ledger recalc | Finance ledger + loans |

Fee Reconciliation payment add/delete করে না — mismatch fix only।

---

*আপডেট: 2026-07-03 (3) — Cutoff baseline snapshot, negative clamp removed, sync-guard audit aligned, Students repair+recalc unified।*
*আপডেট: 2026-07-03 (2) — Section 11: Return balance fix, Repair button unify, loan cutoff fix।*
*আপডেট: 2026-07-03 — Section 11: Payment System সম্পূর্ণ লজিক + Finance Ledger Repair যাচাই রেফারেন্স।*
