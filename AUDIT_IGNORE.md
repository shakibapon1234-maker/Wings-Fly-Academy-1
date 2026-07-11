# WFA Audit Ignore List — পড়ুন প্রতিটি অডিট/ফিক্সের আগে

এই ফাইল **অডিট, রিভিউ, বা নতুন ফিচার যোগ করার আগে** পড়তে হবে।  
লক্ষ্য: অফিসে চলমান অ্যাপ ভাঙা না, `settings.js` অপ্রয়োজনীয়ভাবে বড় না হওয়া।

---

## 🔴🔴🔴 সর্বোচ্চ সতর্কতা — এটি না মানলে ডেটা হারাবে 🔴🔴🔴

> **Supabase Dashboard বা REST API দিয়ে সরাসরি `accounts` টেবিলের `balance` কলাম কখনো edit করবেন না।**

### কেন এটা এত গুরুতর?

অ্যাপের `accounts.balance` এখন **ledger-derived** — প্রতিটি sync-এর পর `finance_ledger` + `loans` থেকে re-calculate করা হয় (AUDIT_IGNORE **Section 20**)। তাই `balance` column-এ সরাসরি যা লিখবেন তা next sync-এ ledger re-derive দিয়ে overwrite হয়ে যাবে।

Supabase Dashboard-এ `balance` edit করলে:
1. cloud-এর `balance` manually বদলে যায় (কিন্তু ledger-এ নতুন transaction এন্ট্রি যোগ হয় না)
2. পরের sync-এ local IDB-তে ledger re-derive চলে
3. ledger-এ আপনার manual edit না থাকায় সঠিক balance ফিরে আসে, আপনার edit হারায়

### ✅ balance পরিবর্তনের একমাত্র সঠিক পথ

| কাজ | সঠিক পদ্ধতি |
|-----|------------|
| Balance ঠিক করতে হবে | অ্যাপ → Settings → Data Management → **Repair Finance Ledger** |
| Manual adjustment | অ্যাপ → Accounts → **Balance Adjustment** |
| Transaction যোগ | অ্যাপ → Finance → **Add Income/Expense** |
| কোড থেকে | `SupabaseSync.updateAccountBalance(method, amount, 'in'\|'out')` |

### ❌ যা কখনো করবেন না

```
Supabase Dashboard → Table Editor → accounts → balance সরাসরি edit ❌
REST API: PATCH /accounts?id=xxx  body: { balance: 12345 }          ❌
SQL: UPDATE accounts SET balance = 12345 WHERE id = 'xxx'           ❌
```

> **ঘটনার ইতিহাস:** এই ভুলটা আগে একাধিকবার করা হয়েছে (Section 8, Section 13, Section 15, Section 16)।  
> প্রতিবারই ব্যালেন্স হারিয়ে গেছে এবং পুনরুদ্ধার করতে অনেক কষ্ট হয়েছে।  
> **AI agent-ও এই ভুল করতে পারে — সরাসরি DB edit-এর আগে সবসময় এই নিয়ম মনে রাখুন।**

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

> ⚠️ **আপডেট (2026-07-07, Section 20):** উপরের "LOCAL জিতবে" rule শুধু merge-এর সময় প্রযোজ্য। আসল balance sync-এর পর `finance_ledger` + `loans` থেকে **re-derive** করা হয় (timestamp LWW নয়) — তাই concurrent multi-device/offline transaction-ও হারায় না। পুরনো "timestamp-based LWW" approach (Section 15 / Section 17-এর বাগ ১) daily data loss করত, তাই Section 20-এ সম্পূর্ণ বদলে ফেলা হয়েছে।

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

*আপডেট: 2026-07-03 (4) — Section 12: Activity Log smart bulk + real-time refresh; advance/investment recycle restore fix।*

---

## 12. Activity Log — রিয়েল-টাইম ও Bulk Summary (2026-07-03)

### Dashboard Balance vs Net Profit (গুরুত্বপূর্ণ পার্থক্য)

| Dashboard card | Source | Repair-এ touch? |
|----------------|--------|-----------------|
| **Total Balance** (Cash+Bank+Mobile) | `accounts.balance` sum | ✅ Repair recalculate |
| **Net Profit** | `students.paid` + other income − expense (P&L) | ❌ by design |

**Total Balance** এবং Accounts tab **একই `accounts.balance`** — দুটো আলাদা source নয়।  
**Net Profit** আলাদা হিসাব — loan/investment/transfer P&L-এ ঢোকে না।

### Activity Log rules

1. **Real-time:** প্রতিটি `_logActivity()` → `wfa:activity-log` event → Settings Activity tab instant refresh (cloud pull ছাড়া)।
2. **Bulk suppress (source):**
   - `Salary.generateMonthlySheet()` — `bypassLog` + এক লাইন summary
   - Batch portal access — `runWithoutActivityLog` + এক লাইন summary
3. **Bulk collapse (UI):** 30s window-এ 2+ `salary` add বা `student_portal_access` add/edit → এক row summary।
4. **Recycle restore:** `advance_payments` / `investments` restore → linked finance + `updateAccountBalance()` (2026-07-03 fix)।

*আপডেট: 2026-07-03 (3) — Cutoff baseline snapshot...*
*আপডেট: 2026-07-03 (2) — Section 11: Return balance fix, Repair button unify, loan cutoff fix।*
*আপডেট: 2026-07-03 — Section 11: Payment System সম্পূর্ণ লজিক + Finance Ledger Repair যাচাই রেফারেন্স।*

---

## 13. 2026-07-03 Major Fix — Supabase Credentials Fallback Bug + Balance Repair (চূড়ান্ত সমাধান)

**ঘটনা (2026-07-03 PM):** Live site (`shakibapon1234-maker.github.io/Wings-Fly-Academy-1/`) dashboard দেখাচ্ছিল ভুল balance ৳548,530 (আসল ছিল ৳37k+)। Root cause: `js/core/supabase-secrets.js` file 404 ছিল, তাই app ক্লায়েন্ট project-এর database-এ connect হচ্ছিল instead of main project।

### 13.1 — Silent Fallback Guard (Deployment Safety)

**সমস্যা:** `supabase-config.js` line 35-এ hardcoded fallback logic থাকায, credentials missing হলে চুপচাপ main project database-এ কানেক্ট করে দিত — কোনো visible error/warning ছাড়াই। এর ফলে:
- Users শুধু balance mismatch দেখে বুঝতো না কেন হচ্ছে
- Data contamination হওয়ার জন্য perfect storm (fallback + purge + sync wrong DB)

**চূড়ান্ত ফিক্স (3 files):**

1. **`supabase-config.js`:**
   - `_checkAndBlockUnconfiguredClient()` নতুন function — deployment type detect করে (client path আছে কিনা) + `secrets.url` missing check
   - যদি client deployment + no credentials → `window._WFA_DEPLOYMENT_ERROR` set করে
   - Log করে CRITICAL error message + fix instructions
   
2. **`_checkAndHandleDbSwitch()`:**
   - Guard check: যদি `_WFA_DEPLOYMENT_ERROR` থাকে → purge/fallback skip করে return
   - Silent fallback এখন blocked

3. **`_showDeploymentErrorBanner()`:**
   - Page-এ red error banner দেখায়
   - ইউজার immediately জানে credentials missing এবং কী করতে হবে

4. **`supabase-sync.js` (`push()` এবং `_pullCoreInternal()`):**
   - Guard check: deployment error থাকলে sync করে না
   - Prevent corrupted data push

**প্রভাবিত ফাইল:**
- `js/core/supabase-config.js` — guard + banner functions
- `js/core/supabase-sync.js` — push/pull guard

### 13.2 — Main Project Credentials Deploy & Corrected Credentials

**প্রথম ভুল:** শুরুতে client project (`kjbupdptfelohljzrfyg.supabase.co`) credentials দিয়ে `supabase-secrets.js` তৈরি করেছিলাম — কারণ miscommunication, user বলেছিল main আর client আলাদা। ফলে:
- Login fail হয়েছিল (auth main project-এ, কানেক্ট client project-এ)
- Dashboard data client-এর হিসেবে আসছিল

**দ্বিতীয় fix:** সঠিক **main project credentials** দিয়ে `supabase-secrets.js` restore করেছি:
```javascript
url: 'https://fznhiqzrslldybhmgopk.supabase.co'
anonKey: 'eyJh...' (main project anon key)
```

**Deployment issue:** gitignore rule ছিল `supabase-secrets.js`, তাই GitHub Pages deploy করছিল না (404 থাকছিল)।
- `.gitignore` আপডেট করেছি: client deployments-এ এই ফাইল deploy হওয়া উচিত
- GitHub Pages rebuild trigger করেছি → file 200 OK আসতে শুরু করেছে

**প্রভাবিত ফাইল:**
- `js/core/supabase-secrets.js` — restore করা হয়েছে main project credentials দিয়ে
- `.gitignore` — client deployment exception যোগ করা হয়েছে

### 13.3 — Academy Name Fix: "Nasrin Academy" → "Wings Fly Aviation Academy"

**সমস্যা:** Browser tab title দেখাচ্ছিল "Nasrin Academy" instead of "Wings Fly Aviation Academy"। User সঠিকভাবে指摘 করেছেন এটা mistake।

**Root cause:** `js/core/clients-metadata.js` line 29 — main project (`kjbupdptfelohljzrfyg.supabase.co`) entry এ hardcoded "Nasrin Academy" ছিল (সম্ভবত মাল্টি-ক্লায়েন্ট deployment testing-এর সময় থেকে)।

**Fix:**
- `clients-metadata.js` entry update: "Nasrin Academy" → "Wings Fly Aviation Academy"
- `customerCode`: "N001" → "WFA001"
- সাথে `www/js/core/clients-metadata.js` (deploy folder)-ও update করেছি

**প্রভাবিত ফাইল:**
- `js/core/clients-metadata.js`
- `www/js/core/clients-metadata.js`

### 13.4 — Balance Restore: Cutoff Date + Finance Ledger Repair

**সমস্যা (Sequence):**
1. Main project credentials 404 → fallback → wrong DB connection
2. DB switch detected → local data purge (normal for correct DB restore)
3. Client database-থেকে sync শুরু → সব client transactions ধরা পড়া
4. Balance দেখাচ্ছিল client-এর সব balance, not main project-এর

**সঠিক balance:** ৳37k+ (user backup file-এ, cutoff date-এ)  
**ভুল balance:** ৳548,530 (client DB-এর সব data সহ)

**Fix (Settings → Data Management):**
- User imported backup file
- Settings-এ "Repair Finance Ledger" button run করেছেন
- System নিয়েছে:
  - **Step 1:** Missing student finance entries backfill (REPAIR-{studentID} deterministic)
  - **Step 2:** Account balance = cutoff baseline + post-cutoff transactions
  - Baseline snapshot প্রথম repair-এ save হয় (wfa_repair_cutoff_baselines)

**ফলাফল:** Balance এখন ৳37,631 — ৳37k+ baseline + post-cutoff transactions (correct!)

**প্রভাবিত ফাইল (existing code, শুধু validate করেছি):**
- `js/core/supabase-sync.js` — `repairMissingStudentFinance()`, `recalculateAccountBalancesFromLedger()`, cutoff rules
- `js/ui/settings.js` — Repair UI buttons

### 13.5 — Summary & Lesson

| Issue | Root cause | Fix | Files |
|-------|-----------|-----|-------|
| Silent fallback to wrong DB | `supabase-secrets.js` 404 + fallback code | Guard block + error banner | supabase-config.js, supabase-sync.js |
| Balance mismatch | Wrong DB connection | Restore main credentials, rebuild GitHub Pages | supabase-secrets.js, .gitignore |
| Tab title wrong | Outdated clients-metadata | Fix academy name | clients-metadata.js |
| Balance still wrong after login | Cutoff date mechanism forgotten | Run Finance Ledger Repair | settings.js (UI only) |

**প্রতিরোধমূলক ব্যবস্থা (ভবিষ্যতের জন্য):**
1. Deployment error guard এখন live — যদি credentials missing হয় → immediate visible error
2. `.gitignore` exception — client project এখন credentials deploy করতে পারবে
3. Cutoff date + baseline snapshot — balance restore সম্পূর্ণ automated এবং verifiable

*আপডেট: 2026-07-03 (5) — Section 13: Major incident fix summary (silent fallback guard, credentials restore, academy name fix, balance repair)।*

### 13.6 — Balance Adjustment Desync Bug Fix (2026-07-03 PM)

**সমস্যা:**  Settings → Accounts → Balance Adjustment-এ দুটো function-এ transaction sequencing bug ছিল:

**`saveBalanceAdjustment()` bug:**
- Insert ledger entry → Update account balance
- Problem: যদি balance update fail হয় → ledger entry orphaned (balance/ledger mismatch)

**`deleteBalanceAdjustment()` bug:**
- Update balance first (reverse) → Delete ledger entry
- Problem: যদি delete fail হয় → balance reversed কিন্তু ledger still exists (mismatch)

**চূড়ান্ত ফিক্স:**
- **Ledger = source of truth** — সবসময় ledger operation আগে করো
- **Error handling + rollback:**
  - `saveBalanceAdjustment()`: Insert ledger first, then update balance. If balance fails → warning toast + "Run Repair"
  - `deleteBalanceAdjustment()`: Delete ledger first, then reverse balance. If balance fails → warning toast + "Run Repair"

**নতুন behavior:**
- যদি কোনো operation fail হয় → explicit warning (not silent failure)
- User সরাসরি জানবে Finance Ledger Repair run করতে হবে
- Audit trail preserved (ledger entry kept even if balance update fails)

**প্রভাবিত ফাইল:**
- `js/ui/settings.js` (lines 3007-3029, 3044-3061)
- `www/js/ui/settings.js` (deployed version)

---

## 14. Client DB Contamination — WFA- Students + Academy Name + Client Manager (2026-07-04)

**পটভূমি:** একটি আগের Claude AI session ভুলে client project (`kjbupdptfelohljzrfyg.supabase.co`) credentials main project-এ set করেছিল এবং পরে ঠিক করে দিয়েছিল। কিন্তু সেই সময় client database-এর কিছু data main project local IDB-তে sync হয়ে গিয়েছিল — যা পরেও থেকে যাচ্ছিল এবং নতুন sync-এ বারবার ফিরে আসছিল।

### 14.1 — সমস্যার তালিকা

| সমস্যা | কারণ | লক্ষণ |
|--------|------|--------|
| Dashboard-এ ভুল account balance | Client accounts data local IDB-তে আছে | ৳1,03,030 দেখাচ্ছে (আসল ৳37,631) |
| Students-এ WFA-100X, WFA-190XX দেখাচ্ছে | Client students (WFA prefix) main project IDB-তে | Student list-এ client-এর students |
| Tab title "Nasrin Academy" | Settings.academy_name cloud pull-এ override হচ্ছে | Chrome tab-এ ভুল নাম |
| Client Manager delete → ফিরে আসছে | `clients-metadata.js`-এ hardcoded S001/A001 entry | Delete করলেও ফিরে আসে |

### 14.2 — চূড়ান্ত ফিক্স (2026-07-04)

#### Fix 1: Client Manager — `js/core/clients-metadata.js`

S001 (shakib academy) এবং A001 (Safa Academy) entry সরানো হয়েছে।  
শুধু WFA001 (Wings Fly Aviation Academy client deployment) রাখা হয়েছে।  
**কারণ:** এই দুটো test client ছিল এবং hardcoded metadata-তে থাকায় delete করলেও ফিরে আসত।

#### Fix 2: Sync Pull Guard — `js/core/supabase-sync.js` (`_pullCoreInternal()`)

**Guard — academy_name:** Pull-এ settings.academy_name যদি `['Nasrin Academy', 'shakib academy', 'Safa Academy']`-এর একটি হয় এবং pathname main project root হয়, তাহলে:
  - local-এ valid name থাকলে সেটা রাখো
  - না থাকলে `'Wings Fly Aviation Academy'` বসাও
  - cloud-এর invalid value কখনো persist হবে না

#### Fix 3: Realtime Guard — `js/core/supabase-sync.js` (`_handleRealtimeEventInternal()`)

Realtime settings UPDATE event-এ invalid academy_name block করা হয়েছে।

#### Fix 4: Startup Cleanup — `js/core/app.js` (`cleanupDuplicateSettings()`)

`cleanupDuplicateSettings()` function-এ নতুন guard:
- Local IDB-তে settings.academy_name invalid হলে সাথে সাথে `'Wings Fly Aviation Academy'`-এ reset
- Duplicate settings merge-এ academy_name শুধু valid name-ই copy করে

### 14.3 — Balance (৳37,631) পুনরুদ্ধার

Account balance IDB-তে ভুল — এটা code-এ auto-fix করা নিরাপদ নয় (কারণ তখন থেকে নতুন transactions হয়েছে)।  
**সঠিক পথ:** Settings → Data Management → Cutoff Date set করুন → তারপর **Repair Finance Ledger** চালান।  
Backup-এর ৳37,631 = Cash ৳12,720 + Brac Bank ৳20,000 + Bikash ৳4,911।

### 14.4 — নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

1. **`clients-metadata.js`-এ শুধু confirmed client entries রাখুন।** Test/temp clients এখানে রাখবেন না — hardcoded থাকায় delete করলেও ফিরে আসে।
2. **Main project-এ কখনো client DB URL/key set করবেন না।**
3. **Academy name শুধু Settings → General Settings থেকে বদলান** — DB-তে সরাসরি নয়।
4. **⚠️ WFA-prefix student_id** = Wings Fly Academy-রই পুরানো student ID format। এগুলো client students নয়। কখনো filter বা purge করবেন না।

---

## 14.5 — Repair-এ Student কমে যাওয়া + Cutoff Date হারানো (2026-07-04 সন্ধ্যা)

### পটভূমি — ভুল assumption এবং revert

Section 14-এর initial fix-এ একটি মারাত্মক ভুল হয়েছিল:

**ভুল assumption:** WFA- prefix student_id মানেই client project-এর student।  
**বাস্তবতা:** WFA-19022, WFA-19027, WFA-1781442698865 ইত্যাদি Wings Fly Aviation Academy-রই পুরানো ID format। Batch 20-এর ১৯ জন student-এর মধ্যে ১২ জনেরই WFA- prefix।

**ফলাফল:** startup purge code এবং sync filter চালানোর পর Batch 20-এ ১৯ → ৯ জন student দেখাচ্ছিল।

### ভুল changes যা revert করা হয়েছে

| ফাইল | যা সরানো হয়েছে |
|---|---|
| `js/core/app.js` | WFA- student purge IIFE (startup-এ সব WFA- student মুছে দিচ্ছিল) |
| `js/core/supabase-sync.js` | Pull-এ WFA- student filter guard |
| `js/core/supabase-sync.js` | Realtime INSERT-এ WFA- student block guard |

> **ভবিষ্যতের জন্য:** WFA- prefix student নিয়ে কোনো filter/purge/block code লেখা সম্পূর্ণ নিষিদ্ধ। এগুলো আসল students।

### Repair-এ student কমার কারণ

`repairAndRecalculate()` চালানোর আগে Cutoff Date set না থাকলে সব পুরানো students-সহ repair চলে। এটা students মুছে না, কিন্তু ভুল ছিল যে WFA- purge code চালু ছিল।

**Rule:** Repair চালানোর আগে সবসময় Cutoff Date set করতে হবে।

### 14.5.1 — Cutoff Date হারানোর Fix

**সমস্যা:** `wfa_repair_cutoff_date` শুধু `localStorage`-এ থাকত। Backup import / browser cache clear / নতুন device-এ গেলে মুছে যায়।

**Fix:** Cutoff date এখন দুই জায়গায় সংরক্ষিত হয়:
1. `localStorage` — fast read (আগের মতো)
2. `settings` DB-র `exam_settings` JSON field-এ — `{ "repair_cutoff_date": "YYYY-MM-DD" }` nested করে

**Restore logic:** Settings Data Management tab খুললেই — localStorage-এ cutoff না থাকলে `exam_settings` DB থেকে auto-restore হয়।

**প্রভাবিত ফাইল:**
- `js/ui/settings.js`:
  - `_getCutoffFromDB()` — DB থেকে cutoff read
  - `_saveCutoffToDB(dateStr)` — DB-তে cutoff write/delete  
  - `setRepairCutoffToday()` — localStorage + DB উভয়ে save
  - `clearRepairCutoff()` — localStorage + DB উভয় থেকে remove
  - Cutoff display render — DB-aware IIFE দিয়ে auto-restore

### 14.5.2 — Cutoff Date Sync Timing Mismatch Fix (2026-07-07)

**সমস্যা:** `repairMissingStudentFinance()`, `recalculateAccountBalancesFromLedger()`, এবং `auditBalances()` সরাসরি `localStorage` থেকে কাটঅফ ডেট পড়ত। কিন্তু অ্যাপ সদ্য অন হলে, ক্যাশ ক্লিয়ার হলে বা অ্যান্ড্রয়েডে `localStorage` প্রপারলি লোড হওয়ার আগে Repair বাটনে চাপ দিলে কাটঅফ তারিখ খালি (`''`) ধরা হতো, যার ফলে ওল্ড এবং মাইগ্রেশন ডেটা ক্ষতিগ্রস্ত হতো।

**Fix:** `SupabaseSync.getRepairCutoffDate()` ফাংশন তৈরি করা হয়েছে যা অন-ডিমান্ড ডেটাবেজ থেকে কাটঅফ তারিখ নির্ধারণ করে `localStorage`-এ রাইট করে এবং সিঙ্ক নিশ্চিত করে। কাটঅফ ডেট রিড করার সব জায়গায় সরাসরি এই মেথড কল করা হয়েছে।

**প্রভাবিত ফাইল:**
- `js/core/supabase-sync.js`
- `js/core/sync-guard.js`
- `js/ui/settings.js`

### 14.5.3 — Cutoff Date Snapshot Double-Counting Fix (2026-07-07)

**সমস্যা:** কাটঅফ তারিখ সেট করার দিনই (আজকের দিন) যদি কোনো লেনদেন (যেমন: ৪০০০ টাকার internet bill expense) আগেই রেকর্ড করা হয়ে থাকে এবং পরবর্তীতে "আজকের Date Set করুন" ক্লিক করা হয়, তবে ওই দিনের কারেন্ট ব্যালেন্স সরাসরি বেসলাইন হিসেবে স্ন্যাপশট হয়ে যায়। কিন্তু ওই এন্ট্রিটির তারিখ কাটঅফের সমান হওয়ায় তা recalculate করার সময় পুনরায় বিয়োগ করা হচ্ছিল (ডাবল কাউন্টিং)।

**Fix:** `snapshotCutoffBaselines()` মেথড মডিফাই করা হয়েছে। এটি সরাসরি র ব্যালেন্স সংরক্ষণ না করে, বর্তমান ব্যালেন্স থেকে কাটঅফ ডেটের বা তার পরবর্তী পোস্ট-কাটঅফ নেট হিসাবটুকু বাদ দিয়ে প্রকৃত স্ট্যাটিক বেসলাইন (cut-off-এর ঠিক আগের মুহূর্তের ব্যালেন্স) নির্ণয় করে সংরক্ষণ করে। এতে বাউন্ডারি ডেটের লেনদেন ডাবল-কাউন্ট হওয়া সম্পূর্ণ বন্ধ হলো।

**প্রভাবিত ফাইল:**
- `js/core/supabase-sync.js`

### प्रभावित ফাইল — 2026-07-04 (Section 14, চূড়ান্ত)
- `js/core/clients-metadata.js` — S001/A001 বাদ, শুধু WFA001
- `js/core/supabase-sync.js` — pull + realtime: শুধু academy_name guard (WFA-student guards সরানো)
- `js/core/app.js` — startup: academy_name auto-fix in cleanupDuplicateSettings
- `js/ui/settings.js` — cutoff date dual-storage (localStorage + settings DB)

*আপডেট: 2026-07-04 — Section 14.5: WFA-student purge revert + Cutoff date persistence fix।*

---

## 15. Sync Overwrite Root Cause Fix — ৩টি বাগ (2026-07-05)

**পটভূমি:** User রিপোর্ট করেন যে backup restore করার পরও বারবার balance ভুল হয়ে যাচ্ছে। কারণ অনুসন্ধানে পাওয়া গেল `accounts.balance` local-authoritative protection শুধু `mergeRows()` (full pull)-এ ছিল, কিন্তু প্রতি ৩০ সেকেন্ডের **incremental pull** এবং **realtime event**-এ ছিল না।

### বাগ ১ — `mergeIncremental()` এ balance protection ছিল না

**ফাইল:** `js/core/supabase-sync.js` → `mergeIncremental()`

- `mergeRows()` (full pull) এ line ~3344-এ `accounts.balance` local-authoritative guard আছে।
- কিন্তু `mergeIncremental()` এ নেই — প্রতি ৩০s auto-pull incremental path ব্যবহার করে।
- **ফলাফল:** প্রতি ৩০ সেকেন্ডে cloud-এর balance local-কে overwrite করছিল।
- **Fix:** `mergeIncremental()`-এ `tableKey` parameter যোগ এবং `accounts` table-এর ক্ষেত্রে `effectiveCloudRow = { ...cloudRow, balance: localRow.balance }` করা হয়েছে।

### বাগ ২ — `_handleRealtimeEventInternal()` এ balance protection ছিল না

**ফাইল:** `js/core/supabase-sync.js` → `_handleRealtimeEventInternal()`

- Realtime UPDATE event এলে `merged = { ...rows[idx], ...newRow }` — এতে cloud-এর balance local-কে overwrite করত।
- **Fix:** `accounts` table হলে `merged = Object.assign({}, rows[idx], newRow, { balance: rows[idx].balance })` — balance সবসময় local থেকে নেওয়া হয়।

### বাগ ৩ — `mergeRows()` এ "stale local data drop" — offline data হারানো

**ফাইল:** `js/core/supabase-sync.js` → `mergeRows()`

- Full pull-এ local-only records যদি cloud-এর latest record থেকে ৫+ মিনিট পুরনো হয়, চুপচাপ drop করা হতো।
- **সমস্যা:** Offline-এ কাজ করা data, push pending থাকা data — এগুলো "stale" ধরে মুছে দেওয়া হতো।
- **Fix:** stale drop rule সম্পূর্ণ সরানো হয়েছে। Local-only records সবসময় রাখা হবে — cloud-এ না থাকলে মানে pending push queue-এ আছে।

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

1. `accounts.balance` protection তিনটি জায়গায় থাকতে **হবে**: `mergeRows()`, `mergeIncremental()`, এবং `_handleRealtimeEventInternal()`। যেকোনো একটাতে না থাকলে balance overwrite হবে।
2. Local-only records কখনো timestamp-based "stale" rule দিয়ে drop করা যাবে না।
3. `mergeIncremental()` call করার সময় `tableKey` (table name) pass করতে হবে।

> ⚠️ **আপডেট (2026-07-07, Section 20):** উপরের "balance protection" এখন মানে — merge-এর সময় **local balance keep** করা (cloud absolute overwrite নয়) + sync-এর পর **ledger re-derive** (`recalculateAccountBalancesFromLedger`)। আর শুধু "local always wins" নয়, আর না "timestamp LWW" — দুটোই transaction হারাত। বিস্তারিত Section 20।

### প্রভাবিত ফাইল — 2026-07-05
- `js/core/supabase-sync.js` — `mergeIncremental()` (tableKey + balance guard), `_handleRealtimeEventInternal()` (balance guard), `mergeRows()` (stale drop removed)
- `www/js/core/supabase-sync.js` — `node build-www.js` দিয়ে sync করা হয়েছে

*আপডেট: 2026-07-05 — Section 15: 3 sync overwrite root cause fixes।*

---

## 16. Push Silent Failure — ডেটা হারানোর আসল কারণ (2026-07-05)

**পটভূমি:** User জানান বিকেলে কাজ করার পর রাত পর্যন্ত data ঠিক থাকে, কিন্তু পরে হারিয়ে যায়। Section 15-এর 30s sync fix এই scenario explain করে না। গভীর বিশ্লেষণে আরও ২টি মারাত্মক bug পাওয়া গেল।

### Real Scenario — কেন "অনেকক্ষণ পরে" data হারায়

```
1. User data enter করেন → local IDB-তে save হয় ✅
2. _pushRecord() call হয় → কোনো কারণে error হয় (schema mismatch, timeout ইত্যাদি)
3. _pushCooldown[table] = now সেট হয় → পরের ৬০ সেকেন্ড ওই table skip
4. ওই ৬০ সেকেন্ডে আরও data enter হয় → push হয় না, retry_queue-তেও যায় না (bug!)
5. User local IDB থেকে দেখছেন → সব ঠিক মনে হচ্ছে ✅ (কিন্তু cloud-এ নেই)
6. Browser বন্ধ / রাতে session শেষ / পরদিন reload
7. Full pull → cloud-এ এই data নেই → local থেকেও হারিয়ে যায় ❌
```

### বাগ ৪ — `_pushRecord()` Cooldown: Silent Skip → Data Lost

**ফাইল:** `js/core/supabase-sync.js` → `_pushRecord()` line ~2273

**আগের code:**
```javascript
if (_pushCooldown[table] && now - _pushCooldown[table] < PUSH_COOLDOWN_MS) {
    return; // silently skip — still within cooldown window
}
```

**সমস্যা:** Cooldown চলাকালীন আসা নতুন record-গুলো `return` করে দেওয়া হচ্ছিল — cloud-এ যাচ্ছিল না, `retry_queue`-তেও যাচ্ছিল না। ডেটা শুধু local IDB-তে আছে, কিন্তু কেউ জানছে না।

**Fix:** Cooldown-এ থাকলে push skip করো কিন্তু `_queueRetry()` call করো:
```javascript
if (_pushCooldown[table] && now - _pushCooldown[table] < PUSH_COOLDOWN_MS) {
    _queueRetry(table, record); // queue করো, skip নয়
    return;
}
```

### বাগ ৫ — `push()` Bulk: Error হলে Data চিরতরে হারায়

**ফাইল:** `js/core/supabase-sync.js` → `push()` function line ~3645

**আগের code:**
```javascript
const { error } = await client.from(key).upsert(cleanRows, { onConflict: 'id' });
if (error) console.error(`[Sync] Push failed for "${key}":`, error);
```

**সমস্যা:** Bulk push-এ error হলে শুধু console-এ error log হতো — data retry queue-তে যাচ্ছিল না। পরের pull-এ cloud-থেকে overwrite হলে ওই data চিরতরে হারাত।

**Fix:**
```javascript
if (error) {
    console.error(`[Sync] Bulk push failed for "${key}" — queuing ${rows.length} records for retry:`, error);
    rows.forEach(r => _queueRetry(key, r));
}
```

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

1. **`_pushRecord()` Cooldown-এ থাকলেও** — data `_queueRetry()`-তে দিতে হবে, `return` করলেই হবে না।
2. **`push()` bulk error** — `console.error` যথেষ্ট নয়; প্রতিটি failed row `_queueRetry()`-এ যেতে হবে।
3. **User-visible sync status** — push fail হলে Status indicator অবশ্যই 'error' দেখাবে, 'synced' নয়।

### ডেটা হারানোর Complete Timeline (এখন fixed)

| ধাপ | আগে | এখন |
|-----|-----|-----|
| Push error হয় | Cooldown শুরু | Cooldown শুরু + record queued ✅ |
| Cooldown-এ নতুন data | চুপচাপ হারিয়ে যায় | retry_queue-এ জমে ✅ |
| Browser reload (Full pull) | Local-only data drop হয় | Local-only data সবসময় রাখা হয় ✅ |
| Retry queue process | Max 5 attempts | Max 5 attempts + user toast ✅ |

### প্রভাবিত ফাইল — 2026-07-05 (Section 16)
- `js/core/supabase-sync.js` — `_pushRecord()` cooldown fix, `push()` bulk error queuing
- `www/js/core/supabase-sync.js` — `node build-www.js` দিয়ে sync করা হয়েছে

*আপডেট: 2026-07-05 (2) — Section 16: Push silent failure root cause + fix (cooldown queue + bulk retry)।*

---

## 17. Balance Update না হওয়ার দুটো বাগ — ফিক্স (2026-07-07)

**User রিপোর্ট:** Student payment পরিবর্তন করলে Account Balance অটোমেটিক আপডেট হচ্ছে না। একই সমস্যা আগে কখনো হয়নি — সাম্প্রতিক কোনো fix-এ regression তৈরি হয়েছে।

---

### বাগ ১ — `mergeIncremental()` এ balance guard unreachable ছিল (Critical Regression)

**ফাইল:** `js/core/supabase-sync.js` → `mergeIncremental()`

**Root Cause:**

```javascript
// আগের (ভুল) কোড:
if (cloudTime >= localTime) {          // ← outer gate: cloud is newer-or-equal
  if (_lTime > _cTime) {               // ← inner check: UNREACHABLE!
    effectiveCloudRow = { ...cloudRow, balance: localRow.balance }; // never runs
  }
}
```

`if (cloudTime >= localTime)` ব্লকে ঢোকার মানেই cloud নতুন বা সমান। তাই ভেতরে `_lTime > _cTime` (local নতুন) কখনো `true` হওয়া সম্ভব নয় — এটা logical impossibility।

**ফলাফল:** প্রতি ৩০ সেকেন্ডের incremental pull-এ cloud-এর `balance` সর্বদা local-কে overwrite করত। `updateAccountBalance()` দিয়ে সঠিকভাবে save হওয়া balance পরের 30s sync-এ cloud-এর পুরনো value দিয়ে মুছে যাচ্ছিল।

**Fix (2026-07-07):** Balance resolution logic `if (cloudTime >= localTime)` গেটের **বাইরে** নিয়ে আসা হয়েছে — unconditionally compute করে তারপর গেটে apply:

```javascript
// নতুন (সঠিক) কোড:
let effectiveCloudRow = cloudRow;
if (tableKey === 'accounts' && localRow.balance !== undefined) {
  if (localTime > cloudTime) {   // ← local নতুন = pending push আছে
    effectiveCloudRow = Object.assign({}, cloudRow, { balance: localRow.balance });
  }
  // else: cloud নতুন = cloud balance নাও (multi-device sync) ✅
}
if (cloudTime >= localTime) {    // ← এখন effectiveCloudRow সঠিক balance বহন করছে
  ...
}
```

> **গুরুত্বপূর্ণ নিয়ম (ভবিষ্যতের জন্য):**
> `mergeIncremental()`-এ accounts.balance guard সর্বদা outer timestamp gate-এর **আগে** থাকতে হবে।
> AUDIT_IGNORE Section 15-এর নিয়ম এখনো valid: mergeRows(), mergeIncremental(), realtime handler — তিনটিতেই guard থাকতে হবে।

---

### বাগ ২ — `saveEditedInitialPayment()` এ `updateAccountBalance()` ছিল না

**ফাইল:** `js/modules/students.js` → `saveEditedInitialPayment()`

**Root Cause:** Student-এর initial (admission-এর সময়ের, method-বিহীন) payment edit করলে `students.paid` ও `students.due` আপডেট হচ্ছিল, কিন্তু `updateAccountBalance()` কল না থাকায় `accounts.balance` পরিবর্তন হচ্ছিল না।

**Fix (2026-07-07):**

```javascript
// পুরনো amount reverse (out), নতুন amount apply (in) — Cash account ব্যবহার করে
const oldInitial = Math.max(0, student.paid - ledgerSum);
if (oldInitial > 0) SupabaseSync.updateAccountBalance('Cash', oldInitial, 'out', true);
if (newInitial > 0) SupabaseSync.updateAccountBalance('Cash', newInitial, 'in');
```

> **নোট:** Initial payment-এ payment method থাকে না (admission-এ Cash ধরে নেওয়া হয়)।
> যদি initial payment Cash-এ নেওয়া না হয়ে থাকে এবং account balance mismatch দেখা যায়,
> Settings → Data Management → **Repair Finance Ledger** চালান।

---

### প্রভাবিত ফাইল — 2026-07-07 (Section 17)

- `js/core/supabase-sync.js` — `mergeIncremental()`: balance guard outer gate-এর আগে নিয়ে আসা হয়েছে
- `js/modules/students.js` — `saveEditedInitialPayment()`: `updateAccountBalance()` call যোগ করা হয়েছে
- `www/js/core/supabase-sync.js` — `node build-www.js` দিয়ে sync করা হয়েছে
- `www/js/modules/students.js` — `node build-www.js` দিয়ে sync করা হয়েছে

*আপডেট: 2026-07-07 — Section 17: Balance update regression fix — mergeIncremental unreachable guard + saveEditedInitialPayment missing balance call।*

> ⚠️ **SUPERSEDED (2026-07-07, Section 20):** বাগ ১-এর fix যে timestamp-based resolution (`if (localTime > cloudTime) local নয়তো cloud`) রাখে, সেটা STILL transaction হারাত যখন দুই device-এ একসাথে uncommitted transaction থাকত। তাই Section 20-এ ওই approach সম্পূর্ণ সরিয়ে ledger-derived balance চালু করা হয়েছে। Section 17-এর বাগ ২ (saveEditedInitialPayment balance call) আলাদাভাবে valid ও বহাল আছে।


---

## 18. `_syncInProgress` Variable Shadowing — মিথ্যা "Suspicious Balance Change" Alert (2026-07-07 — পূর্ণাঙ্গ অ্যাকাউন্ট সিস্টেম অডিট)

**পটভূমি:** পুরো account/sync system-এর end-to-end অডিটে (mergeRows, mergeIncremental, realtime handler, push, updateAccountBalance, ensureDefaultCashAccount সব একসাথে চেক করার সময়) এই বাগ ধরা পড়ে।

**ফাইল:** `js/core/supabase-sync.js`

### Root Cause

`SupabaseSync` এবং `SyncEngine` — দুটো **আলাদা IIFE/closure**। দুটোতেই নিজস্ব `let _syncInProgress = false;` ঘোষণা করা ছিল:

- `SupabaseSync.setAll()`-এ "Suspicious Direct Balance Change Detection" গার্ড এই condition চেক করত: `!_syncInProgress` (SupabaseSync-এর নিজের কপি)।
- `SyncEngine._pullCore()` প্রতি pull-এর শুরুতে `_syncInProgress = true` আর শেষে `false` সেট করত — কিন্তু এটা **SyncEngine-এর নিজের আলাদা কপি**, `SupabaseSync`-এর কপিকে ছোঁয়ই না।

**ফলাফল:** `SupabaseSync`-এর `_syncInProgress` চিরকাল `false` থেকে যেত (কখনো `true` হতো না)। তাই প্রতিটা sync pull-এ — এমনকি সম্পূর্ণ বৈধ multi-device sync-এও (অন্য ডিভাইসে transaction হয়ে cloud balance এই ডিভাইসে sync হয়ে এলে) — Data Monitor-এর "Suspicious Direct Balance Change" detector ভুলভাবে ফায়ার করত:
- Console warning
- `wfa_balance_alerts`-এ মিথ্যা entry
- User-facing error toast (10 সেকেন্ড)
- `wfa:suspicious_balance` event

এটা প্রকৃত balance corruption করত না (ডেটা ঠিকই সেভ হতো), কিন্তু প্রতিটা normal multi-device sync-কে সন্দেহজনক ঘটনা হিসেবে দেখাত — বিশ্বাসযোগ্যতা নষ্ট করে ও বিভ্রান্তি তৈরি করে।

### Fix (2026-07-07)

`_syncInProgress`-এর বদলে window-scoped shared flag `window._syncPullInProgress` ব্যবহার করা হয়েছে (যেমন `_realtimeEventInProgress` এবং `_legitimateBalanceChangeInProgress` আগে থেকেই window-scoped ছিল):

- `SyncEngine._pullCore()` → `window._syncPullInProgress = true/false`
- `SupabaseSync.setAll()` guard → `!window._syncPullInProgress`
- `SyncEngine`-এর dead/অকার্যকর local `_syncInProgress` variable সম্পূর্ণ সরানো হয়েছে

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

**Cross-module state flag (এক module সেট করে, আরেক module চেক করে) কখনো `let`/module-local ভ্যারিয়েবল দিয়ে করা যাবে না — সবসময় `window.*` ব্যবহার করতে হবে।** `SupabaseSync` এবং `SyncEngine` একই ফাইলে থাকলেও তারা আলাদা IIFE — নাম এক হলেও ভ্যারিয়েবল shadow হয়ে যায় এবং silently কোনো effect ফেলে না (কোনো error/exception হয় না, তাই ধরা কঠিন)।

### প্রভাবিত ফাইল — 2026-07-07 (Section 18)
- `js/core/supabase-sync.js` — `SupabaseSync.setAll()` guard + `SyncEngine._pullCore()`: `window._syncPullInProgress` shared flag
- `www/js/core/supabase-sync.js` — `node build-www.js` দিয়ে sync করা হয়েছে
- **বাকি কাজ:** `android/app/src/main/assets/public/js/core/supabase-sync.js` — `npx cap sync android` চালিয়ে sync করা দরকার (Android build করার আগে)

*আপডেট: 2026-07-07 (2) — Section 18: `_syncInProgress` cross-closure variable shadowing fix — মিথ্যা "Suspicious Balance Change" alert বন্ধ হলো।*

---

## 19. পূর্ণাঙ্গ অ্যাকাউন্ট/সিঙ্ক সিস্টেম অডিট — ৩টি বাগ ফিক্স (2026-07-07, ৩য়)

**পটভূমি:** ইউজার-অনুরোধে পুরো account/sync system (mergeRows, mergeIncremental, realtime handler, push, updateAccountBalance, dedup logic সহ) একসাথে পূর্ণাঙ্গ অডিট করা হয়। root ও `www/` কনফার্ম identical পাওয়া গেছে; নিচের ৩টি সমস্যা কোডে পাওয়া গেছে।

### 19.1 — Duplicate account সিলেকশন লজিক তিন ফাইলে তিন রকম ছিল

**সমস্যা:** duplicate Cash/Bank/Mobile account row থেকে গেলে (legacy phantom data — Section 8 দেখুন), তিনটা জায়গা তিন রকম row বেছে নিত:
- `supabase-sync.js → _updateBalanceCoreInternal()` → oldest `created_at` (transaction target)
- `accounts.js → getPrimaryCashAccount()` → largest balance (Accounts ট্যাব display)
- `dashboard.js → normalizeAccounts()` → array-এ প্রথম যেটা পাওয়া যায় (arbitrary order)

ফলে Dashboard, Accounts ট্যাব, আর আসল transaction — তিনটা তিন account-এর balance দেখাতে/ব্যবহার করতে পারত। ঠিক Section 7-এর ৳৩৮,০৩০ বনাম ৳৮,৫১৯ সমস্যার মতোই আবার ঘটার ঝুঁকি ছিল।

**Fix:** তিনটা জায়গাতেই একই নিয়ম — **oldest `created_at` জেতে** (`_updateBalanceCoreInternal()`-এর নিয়মের সাথে মিলিয়ে)।

**প্রভাবিত ফাইল:** `js/modules/accounts.js` (`getPrimaryCashAccount()`, `normalizeAccounts()`), `js/ui/dashboard.js` (`normalizeAccounts()`)

### 19.2 — Cutoff baseline শুধু localStorage-এ ছিল, DB-তে persist হতো না

**সমস্যা:** Section 14.5.1-এ cutoff *date* settings DB-তেও persist করা শুরু হয়েছিল, কিন্তু `wfa_repair_cutoff_baselines` (আসল anchor balance) শুধু localStorage-এ থেকে যেত। Cache clear/নতুন device হলে date DB থেকে ফিরে আসত, কিন্তু baseline হারিয়ে যেত এবং `_resolveCutoffBaselines()` তখন **বর্তমান (সম্ভবত তখনও ভুল) balance** থেকে নতুন baseline derive করে নিত — repair-এর মূল সুরক্ষা নষ্ট হয়ে যেত।

**Fix:** baseline এখন settings-এর `exam_settings` JSON field-এ cutoff date-এর মতোই dual-persist হয় (`_getBaselinesFromDB()`, `_saveBaselinesToDB()`)। `_resolveCutoffBaselines()` এখন localStorage → settings DB → derive — এই ক্রমে চেক করে। `clearRepairCutoff()`-ও এখন DB baseline মুছে দেয় (নতুন `SupabaseSync.clearCutoffBaselines()`)।

**প্রভাবিত ফাইল:** `js/core/supabase-sync.js` (`_resolveCutoffBaselines()`, `snapshotCutoffBaselines()`, নতুন `_getBaselinesFromDB()`/`_saveBaselinesToDB()`/`clearCutoffBaselines()`), `js/ui/settings.js` (`clearRepairCutoff()`)

### 19.3 — Backup import-এর duplicate-Cash guard dead code ছিল

**সমস্যা:** `backup-restore.js` legacy import-এ `existingCash` চেক করত `tableData.accounts` — কিন্তু সেটা এই ব্লকের নিচেই অ্যাসাইন হতো, তাই চেকটা সবসময় খালি array-এর বিরুদ্ধে চলত (কোনো effect ছিল না)। এখনকার কোডে ক্ষতি হয়নি (এই path-এ একবারই Cash entry যোগ হতে পারে) কিন্তু ভবিষ্যতে আরেকটা Cash-adding সোর্স যোগ হলে duplicate ঠেকাতো না।

**Fix:** সঠিক variable (`accountEntries`, এই pass-এ এখন পর্যন্ত তৈরি হওয়া entries) ব্যবহার করা হয়েছে।

**প্রভাবিত ফাইল:** `js/core/backup-restore.js`

### যাচাই
- `node build-www.js` চালিয়ে root ↔ `www/` sync কনফার্ম করা হয়েছে (byte-identical)।
- সব 5টা edited ফাইল syntax-checked (`node --check`)।
- পুরো Vitest suite (102 tests, 6 files) — সব পাস।

### বাকি কাজ
- `android/app/src/main/assets/public/` — এখনো পুরনো কপি; পরের Android build-এর আগে `npx cap sync android` চালাতে হবে।

*আপডেট: 2026-07-07 (৩) — Section 19: পূর্ণাঙ্গ অডিটে পাওয়া ৩টি বাগ ফিক্স — duplicate account selection unify, cutoff baseline DB persistence, backup-restore dead-code guard fix।*

---

## 20. Balance Sync — Ledger-Derived (LWW data-loss সমাধান) — 2026-07-07

**পটভূমি:** Section 8 / Section 15 / Section 17-এর balance resolution ছিল **timestamp-based last-writer-wins (LWW)** — `accounts.balance` কলামটা একটা derived/computed মান হওয়া সত্ত্বেও `updated_at` দিয়ে LWW করা হতো। এতে concurrent multi-device বা offline transaction-এ হারানো device-এর transaction silent ভাবে overwrite হয়ে যেত (এটাই Section 8-এর মূল দুর্ঘটনার — ৳73,030 → ৳36,530 — একই ক্লাস)। "ডেটা এলোমেলো হয়ে যাওয়া" আচরণটা এটা থেকেই আসছিল। একাধিক device (PC + মোবাইল) ব্যবহারে রোজ ঘটত।

**সঠিক মডেল:** `finance_ledger` + `loans` হলো **append-only, conflict-safe** transaction log (unique id, additive merge)। `accounts.balance` কে absolute column LWW না করে, sync-এর পর ওই ledger থেকে **re-derive** করলে দুই device-এর transaction-ই union-এ count হয় → কোনো transaction হারায় না।

### ফিক্স (৪ জায়গায়)

**১. Merge-এ local authoritative (cloud absolute overwrite বন্ধ)**
`js/core/supabase-sync.js` — `mergeRows()` (full pull), `mergeIncremental()` (30s pull), `_handleRealtimeEventInternal()` (realtime): `accounts` row-এর ক্ষেত্রে merge-এর সময় **সবসময় local balance রাখে** (new account শুধু cloud-এ থাকলে cloud থেকে নেয়)। আর `if (localTime > cloudTime)` LWW চেক নেই।

**২. Sync-এর পর ledger re-derive (cross-device propagation)**
`_pullCoreInternal()` শেষে — যদি `accounts` / `finance_ledger` / `loans` টেবিল pull-এ বদলায় — তাহলে silent ভাবে `recalculateAccountBalancesFromLedger({ silent: true })` চালায়। এটা balance কে merged ledger থেকে replay করে, তাই অন্য device-এর transaction-ও local-এ দেখা যায় (LWW-এর মতো হারায় না)। Realtime-এ finance/loans বদলালে পরের 30s pull-এ reconcile হয়।

**৩. `recalculateAccountBalancesFromLedger()` এখন 'Balance Adjustment' count করে**
`phantomCategories` থেকে `'Balance Adjustment'` সরানো হয়েছে (Opening Balance exclude থাকছে, baseline-এর আওতায়)। ফলে manual correction recalc-এর পরেও থাকে।

**৪. Manual / initial balance edit এখন ledger-এ record হয়**
`js/modules/accounts.js` → `saveBalance()`:
- Existing account edit → `Balance Adjustment` ledger entry (delta = new − old) insert করে।
- New account initial balance → `Balance Adjustment` (initial) entry insert করে।
ফলে recalc (যেটা balance reset করে ledger থেকে) manual correction-ও preserve করে — double-count নয়, কারণ recalc **reset** করে (incremental নয়)।

### নতুন আচরণ (সংক্ষেপে)
| পরিস্থিতি | আগে (LWW) | এখন (ledger-derived) |
|-----------|-----------|----------------------|
| Device A offline txn, Device B push → A pull | A-এর txn হারাত | A-এর txn + B-এর txn দুটোই থাকে ✅ |
| Push/pull race একই account-এ | হারানো side-এর txn মুছে যেত | ledger union → কোনোটাই হারায় না ✅ |
| Manual balance edit | recalc-এ হারাতে পারত | ledger entry থাকায় থাকে ✅ |

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)
1. `accounts.balance` কে আর কখনো LWW বা "local always wins" দিয়ে sync করবেন না — sync-এর পর সবসময় ledger থেকে `recalculateAccountBalancesFromLedger()` চালান।
2. নতুন transaction path যোগ করলে তা `finance_ledger` (বা `loans`)-এ entry দিতে হবে, নাহলে recalc-এ balance-এ ওঠবে না।
3. Manual/initial balance set করলে `Balance Adjustment` ledger entry দিতে হবে (accounts.js `saveBalance()` pattern)।
4. `_pullCoreInternal()`-এর শেষের reconcile call সরাবেন না — এটাই multi-device safety-এর মূল।

### প্রভাবিত ফাইল — 2026-07-07 (Section 20)
- `js/core/supabase-sync.js` — `mergeRows()`, `mergeIncremental()`, `_handleRealtimeEventInternal()` (local authoritative), `_pullCoreInternal()` (post-pull reconcile), `recalculateAccountBalancesFromLedger()` ('Balance Adjustment' included)
- `js/modules/accounts.js` — `saveBalance()`: manual/initial balance → ledger entry
- `www/js/core/supabase-sync.js`, `www/js/modules/accounts.js` — `node build-www.js` দিয়ে sync করা হয়েছে (DEPLOY_ID bumped)
- **বাকি কাজ:** `android/app/src/main/assets/public/` — `npx cap sync android` চালিয়ে sync করা দরকার (Android build-এর আগে)

*আপডেট: 2026-07-07 (৪) — Section 20: Balance sync কে LWW থেকে ledger-derived-এ বদল — daily data loss / scrambled balance সমাধান।*

---

## 21. Post-Pull Ledger Reconcile Missing + Balance Adjustment Skip Bug (2026-07-09)

**পটভূমি:** User রিপোর্ট করেন Bikash account থেকে ৳1,500 "Cartiz for printer" Expense Finance Ledger-এ সঠিকভাবে রেকর্ড হলেও Bikash-এর account balance ৳2,911 (cutoff baseline) থেকে ৳1,411-এ কমেনি। Repair চালিয়ে ঠিক হলেও মূল কারণ খোঁজার নির্দেশ দেওয়া হয়।

### Root Cause — দুটো Bug

#### Bug ১: `_pullCoreInternal()` শেষে post-pull ledger reconcile ছিল না

**Section 20 (2026-07-07)-তে বলা হয়েছিল:**
> `_pullCoreInternal()` শেষে — যদি `accounts` / `finance_ledger` / `loans` টেবিল pull-এ বদলায় — তাহলে silent ভাবে `recalculateAccountBalancesFromLedger({ silent: true })` চালায়।

**কিন্তু কোডে এটা implement হয়নি।** তাই:

```
১. User expense add → updateAccountBalance → local Bikash ৳1,411 ✅
   → _pushRecord() → cloud push: Bikash ৳1,411, updated_at = T_cloud

২. পরের Full Pull বা Incremental Pull:
   → cloud Bikash timestamp (T_cloud) > local timestamp (T_local_expense)
     কারণ: clock skew / async timing / Supabase server time
   → "Cloud নতুন" → cloud balance জেতে
   → কিন্তু cloud-এ যদি পুরনো ৳2,911 থাকে (push delay/fail) → ৳2,911 ফিরে আসে ❌

৩. Finance Ledger-এ expense entry আছে, কিন্তু account balance ভুল
   → Repair চালিয়েই শুধু ঠিক করা যাচ্ছিল
```

**কেন Repair-এ ঠিক হচ্ছিল কিন্তু পরের sync-এ আবার ভুল হতে পারত:**
`recalculateAccountBalancesFromLedger()` চালিয়ে balance ৳1,411-এ আনা হয় এবং cloud-এ push হয়। কিন্তু পরের full pull-এ cloud timestamp comparison-এ cloud জিতলে আবার পুরনো মান ফিরে আসতে পারত — কারণ post-pull reconcile ছিল না।

#### Bug ২: `recalculateAccountBalancesFromLedger()` এ `'Balance Adjustment'` skip হচ্ছিল

**ফাইল:** `js/core/supabase-sync.js` → `recalculateAccountBalancesFromLedger()`

Section 20 বলেছে: `'Balance Adjustment'` entries এখন count হবে (phantomCategories থেকে সরানো হয়েছে)।  
কিন্তু কোডে (line 2956) এখনো ছিল:
```javascript
const phantomCategories = new Set(['Opening Balance', 'Balance Adjustment']); // ← ভুল
```
ফলে manual balance adjustment করলে Repair-এ সেটা হারিয়ে যাচ্ছিল।

### চূড়ান্ত Fix (2026-07-09)

#### Fix ১: Post-pull ledger reconcile যোগ করা

**ফাইল:** `js/core/supabase-sync.js` → `_pullCoreInternal()`

```javascript
// hasChanges হলে কোন tables বদলেছে track করো:
if (!document._wfa_pull_changed_tables) document._wfa_pull_changed_tables = new Set();
document._wfa_pull_changed_tables.add(key);

// Pull শেষে — hasChanges block-এ:
if (typeof SupabaseSync.recalculateAccountBalancesFromLedger === 'function') {
  const _needsRecalc = changedTables.has('accounts') ||
                       changedTables.has('finance_ledger') ||
                       changedTables.has('loans');
  if (_needsRecalc || isFullPull) {
    SupabaseSync.recalculateAccountBalancesFromLedger({ silent: true });
  }
}
```

**কেন এটা কাজ করে:**
- Finance ledger append-only ও conflict-safe — `id` দিয়ে deduplicate হয়
- Pull-এ দুই device-এর সব ledger entries merge হয়
- তারপর ledger থেকে balance re-derive করলে দুটো device-এর transaction-ই union হয়
- Cloud balance-এর timestamp কে "জেতার" সুযোগ থাকে না — ledger-ই source of truth

#### Fix ২: `'Balance Adjustment'` phantomCategories থেকে সরানো

```javascript
// আগে (ভুল):
const phantomCategories = new Set(['Opening Balance', 'Balance Adjustment']);

// এখন (সঠিক — Section 20):
const phantomCategories = new Set(['Opening Balance']);
// 'Balance Adjustment' এখন count হয় — accounts.js saveBalance() ledger entry হিসেবে রাখে
```

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

1. **Post-pull reconcile সরাবেন না।** `_pullCoreInternal()` শেষের `recalculateAccountBalancesFromLedger({ silent: true })` call-টি — এটাই multi-device safety + timestamp-skew protection-এর মূল। এটা remove করলে balance আবার timestamp LWW-তে পড়ে।
2. **`recalculateAccountBalancesFromLedger()` এ নতুন category skip করতে চাইলে** phantom বা diag category হলে `diagNotes` set-এ `note` দিয়ে ফিল্টার করুন — `phantomCategories` (category field) শুধু `'Opening Balance'` রাখুন।
3. **Timestamp-based balance resolution (Local/Cloud wins LWW)** আর কখনো accounts.balance-এর final source of truth হবে না। LWW শুধু merge-এর intermediate step — final truth সবসময় ledger-derived।

### Verification

- `node --check js/core/supabase-sync.js` → ✅ syntax OK
- `node build-www.js` → ✅ www/ sync করা হয়েছে
- `npx vitest run` → ✅ 102/102 tests passed

### প্রভাবিত ফাইল — 2026-07-09 (Section 21)
- `js/core/supabase-sync.js` — `_pullCoreInternal()`: table change tracking + post-pull silent recalculate; `recalculateAccountBalancesFromLedger()`: 'Balance Adjustment' un-skip
- `www/js/core/supabase-sync.js` — `node build-www.js` দিয়ে sync করা হয়েছে

*আপডেট: 2026-07-09 — Section 21: Post-pull ledger reconcile missing + Balance Adjustment phantom skip bug — দুটো fix, 102 tests pass।*

---

## 21B. Balance Inflate Bug — ৳22,712 → ৳24,212 (2026-07-09, Section 21-এর সাথে একই দিনের সম্পর্কিত ফলো-আপ)

**User রিপোর্ট:** Total balance ৳22,712 থেকে হঠাৎ ৳24,212 হয়ে গেছে (পার্থক্য ৳1,500)।

### Root Cause — Section 20-এর incomplete implementation

Section 20-এ সিদ্ধান্ত হয়েছিল:
1. `saveBalance()` → `Balance Adjustment` ledger entry তৈরি করবে (manual correction preserve-এর জন্য)
2. `recalculateAccountBalancesFromLedger()` → `Balance Adjustment` entries **count করবে** (phantomCategories থেকে বাদ)

কিন্তু **কোডে অসামঞ্জস্য ছিল:**
- `saveBalance()` ✅ entry তৈরি করছিল (Section 20 অনুযায়ী সঠিক)
- `recalculateAccountBalancesFromLedger()` ❌ `phantomCategories = new Set(['Opening Balance', 'Balance Adjustment'])` — এখনো skip করছিল
- Startup cleanup ❌ `Balance Adjustment` entries মুছে দিচ্ছিল
- Pull filter ❌ cloud থেকে `Balance Adjustment` entries block করছিল

### চূড়ান্ত Fix (2026-07-09) — তিনটি জায়গায়

1. `recalculateAccountBalancesFromLedger()` — `phantomCategories` এখন শুধু `Set(['Opening Balance'])`।
2. Startup IDB cleanup — শুধু `'Opening Balance'` মুছবে (cleanup flag `wfa_stale_cleanup_v1`-এ ফিরে আসা হয়েছে, `v2` সরানো হয়েছে)।
3. Pull filter (`_pullCoreInternal()`) — শুধু `'Opening Balance'` filter করে, `'Balance Adjustment'` pass করে।

### গুরুত্বপূর্ণ নিয়ম (ভবিষ্যতের জন্য)

1. **`Balance Adjustment` entries কখনো cleanup/filter/skip করবেন না** — এগুলো Section 20-এর legitimate ledger records।
2. **`Opening Balance` শুধুই phantom** — পুরনো broken `_upsertOpeningEntry()` system তৈরি করত; এগুলো সরানো যাবে।
3. **`phantomCategories`-এ `'Balance Adjustment'` রাখবেন না** — `recalculateAccountBalancesFromLedger()`, snapshot, বা যেকোনো skip logic-এ।

### প্রভাবিত ফাইল — 2026-07-09 (Section 21B)
- `js/core/supabase-sync.js`: `recalculateAccountBalancesFromLedger()` phantomCategories fix, startup cleanup fix, pull filter fix — **যাচাই করা হয়েছে, বর্তমান কোডে প্রয়োগ করা আছে।**

*আপডেট: 2026-07-09 — Section 21B: Balance inflate bug ৳22,712→৳24,212 — Section 20 incomplete implementation fix। (দ্রষ্টব্য: এই সেকশনটি আগে একটি resolve না হওয়া git merge conflict-এর কারণে ফাইলে ডুপ্লিকেট "Section 21" হিসেবে ছিল — 2026-07-10-এ পরিষ্কার করে 21B হিসেবে renumber করা হলো।)*

---

## 22. Backup Import-এর পর Balance ভুল হওয়া — Cutoff Restore Missing (2026-07-10)

**পটভূমি:** User backup import করলে ১ সেকেন্ড সঠিক balance (৳22,712) দেখায়, তারপরেই ৳8,97,300-এ বদলে যায়।

### Root Cause

**Backup import flow:**
1. `tableData` থেকে সব table (accounts, finance_ledger, settings ইত্যাদি) IDB-তে restore হয়।
2. `settings[0].exam_settings` JSON-এ `repair_cutoff_date: "2026-07-05"` ও `repair_cutoff_baselines: {...}` সংরক্ষিত ছিল। এগুলো DB-তে সঠিকভাবে restore হয়।
3. **কিন্তু `localStorage`-এ** `wfa_repair_cutoff_date` ও `wfa_repair_cutoff_baselines` **write হয়নি**।
4. `location.reload()` চালু হয় → page reload।
5. Reload-এর পর first full pull-এ `_pullCoreInternal()` → `recalculateAccountBalancesFromLedger({ silent: true })` চালায়।
6. `recalculateAccountBalancesFromLedger()` `localStorage.getItem('wfa_repair_cutoff_date')` পড়ে — **কিন্তু সেটা ফাঁকা** (restore হয়নি)।
7. ফলে cutoff ছাড়াই পুরো historical ledger (batch 17-20 এর সব ৳911,600 income + ৳716,959 expense) merge হয় → Cash net = ৳1,94,641 (ভুল)।
8. Bank/Mobile-ও ভুল হয় → মোট ৳8,97,300 দেখায়।

### Fix — `js/core/backup-restore.js`

Import শেষে, `location.reload()` call-এর আগে, restored settings থেকে cutoff date ও baselines `localStorage`-এ write করা হলো:

```javascript
// Restore cutoff date ও baselines — নাহলে post-reload recalc ভুল হবে
const restoredSettings = SupabaseSync.getAll('settings');
if (restoredSettings && restoredSettings.length) {
  let examCfg = JSON.parse(restoredSettings[0].exam_settings || '{}');
  if (examCfg.repair_cutoff_date) {
    localStorage.setItem('wfa_repair_cutoff_date', examCfg.repair_cutoff_date);
  }
  if (examCfg.repair_cutoff_baselines) {
    localStorage.setItem('wfa_repair_cutoff_baselines', JSON.stringify(examCfg.repair_cutoff_baselines));
  }
}
```

### নিয়ম (ভবিষ্যতের জন্য — বাধ্যতামূলক)

1. **Backup import-এর পরে সবসময়** settings DB থেকে cutoff ও baselines `localStorage`-এ sync করুন।
2. **`recalculateAccountBalancesFromLedger()` cutoff ছাড়া চললে** পুরো historical ledger count হয় — ব্যালেন্স অনেক বড় দেখায়।
3. **Section 21-এর post-pull reconcile** এখন সঠিকভাবে কাজ করবে কারণ reload-এর পর localStorage-এ cutoff থাকবে।

### প্রভাবিত ফাইল — 2026-07-10 (Section 22)
- `js/core/backup-restore.js` — `importBackup()`: post-restore cutoff/baseline localStorage sync
- `www/js/core/backup-restore.js` — `node build-www.js` দিয়ে sync করা হয়েছে

*আপডেট: 2026-07-10 — Section 22: Backup import-এর পর balance ৳8,97,300 হওয়ার bug fix — cutoff date ও baselines localStorage-এ restore করা হলো।*

---

## 23. Voice Assistant — Native APK-এ কোনো Command শোনেনি (Result Discarded) + Doc/Build Housekeeping (2026-07-10)

**User রিপোর্ট:** মোবাইলে ইনস্টল করা APK-তে AI Assistant কাজ করে না — মাইক্রোফোন permission দেওয়া থাকলেও কোনো voice command শুনতে পায় না/react করে না।

### Root Cause — `partialResults: false` হলে ফলাফল `start()`-এর resolve value-তে আসে, event-এ নয়

`js/modules/voice-assistant.js`-এ native (Capacitor `@capacitor-community/speech-recognition`) path-এ:
```js
await CapSpeech.start({ ..., partialResults: false, popup: false }); // result বাতিল করা হচ্ছিল
```
আর ফলাফল ধরার জন্য একমাত্র হ্যান্ডলার ছিল:
```js
CapSpeech.addListener('partialResults', (data) => { ... processCommand(cmd) ... });
```
কিন্তু প্লাগইনের নিজের definition অনুযায়ী `'partialResults'` ইভেন্ট **শুধু `partialResults: true` হলেই** emit হয়। `partialResults: false` দেওয়া থাকায় `start()` নিজেই `{ matches }` নিয়ে resolve করে — event কখনো fire-ই হতো না। ফলে:
- মাইক পারমিশন ঠিকই ছিল (তাই "🎤 শুনছি…" দেখাতো, শোনাও শুরু হতো)।
- কিন্তু recognized text কখনো `processCommand()`-এ পৌঁছাতো না — তাই কোনো command execute হতো না, কোনো response-ও আসতো না।

### Fix
`CapSpeech.start()`-এর resolve value সরাসরি capture করে একটা shared `_handleNativeResult()`-এ পাঠানো হয়েছে (এটাই `processCommand`, bubble show, ও continuous-mode restart লজিক চালায়)। `partialResults: true`-এর জন্য listener-ও রাখা হয়েছে (future-proof), কিন্তু মূল path এখন resolve value থেকেই চলে।

**প্রভাবিত ফাইল:** `js/modules/voice-assistant.js` (native `recognition.start`/`_handleNativeResult`), `www/`, `android/app/src/main/assets/public/` — `node build-www.js && npx cap sync android` দিয়ে sync করা হয়েছে।

### সাথে পাওয়া ২টি housekeeping ইস্যু (bug নয়, কিন্তু গুরুত্বপূর্ণ)

**১. `AUDIT_IGNORE.md`-এ resolve না হওয়া git merge conflict ছিল।** পুরোনো `git stash`/pull conflict থেকে `<<<<<<< Updated upstream` / `=======` / `>>>>>>> Stashed changes` marker রয়ে গিয়েছিল, ফলে ডুপ্লিকেট "Section 21" (দুটো ভিন্ন bug — Post-Pull Reconcile ও Balance Inflate — একই নম্বরে) তৈরি হয়েছিল। কোড-লেভেলে দুটো fix-ই আগে থেকে প্রয়োগ করা ছিল (যাচাই করা হয়েছে) — শুধু ডকুমেন্টেশন এলোমেলো ছিল। এখন দ্বিতীয়টিকে **Section 21B** হিসেবে renumber করে conflict marker সরানো হয়েছে; কোনো তথ্য হারায়নি।

**২. `version.json` পুরনো (2026-07-07) থেকে যাওয়ায় `build-www.js`/`npx cap sync` চালালে `service-worker.js`-এর হাতে-বসানো নতুন `DEPLOY_ID` (`20260710-monitor-real-snapshots`) আবার পুরনো মানে auto-sync হয়ে যাচ্ছিল** (`build-www.js` DEPLOY_ID-কে `version.json`-এর `deploy_id` থেকে derive করে)। এর মানে জুলাই ৯-১০ তারিখের সব fix (activity log realtime retry, Data Monitor recorded-balance column, backup-restore cutoff fix, post-pull reconcile)-এর জন্য PWA cache বাস্ট হতো না — আগে থেকে ইনস্টল করা ইউজাররা পুরনো cached কোডই পেতে থাকতেন। `version.json`-কে `5.1.3` / `20260710-monitor-voice-fix`-এ আপডেট করে পুনরায় build চালানো হয়েছে; এখন root/www/android তিনটাই byte-identical এবং `DEPLOY_ID` সঠিক।

### নিয়ম (ভবিষ্যতের জন্য)
1. `service-worker.js`-এর `DEPLOY_ID` হাতে বসালে **সাথে সাথে `version.json`-এর `deploy_id`-ও আপডেট করুন** — নাহলে পরের `build-www.js` রান সেটা রিসেট করে দেবে।
2. Native mobile feature (speech recognition, camera ইত্যাদি) যোগ/এডিট করার সময় প্লাগইনের `.d.ts`/definitions ফাইল চেক করে **কোন event কখন fire হয়** নিশ্চিত হয়ে নিন — assumption-এর ওপর ভিত্তি করে listener বসাবেন না।
3. `git stash`/merge-এর পর সবসময় `grep -rn "^<<<<<<< \|^>>>>>>> "` দিয়ে conflict marker চেক করুন, বিশেষত `AUDIT_IGNORE.md`-এর মতো knowledge-base ফাইলে।

### Verification
- `node --check` — সব edited ফাইল pass (পুরো `js/` ট্রি স্ক্যান করা হয়েছে, কোনো syntax error নেই)।
- root ↔ `www/` ↔ `android/app/src/main/assets/public/` — এখন byte-identical (credential ফাইল বাদে)।
- Vitest এই sandbox-এ চালানো যায়নি (`@rollup/rollup-linux-x64-gnu` native module missing — পরিবেশগত সমস্যা, কোড ইস্যু নয়); dev machine-এ `npx vitest run` দিয়ে confirm করে নেবেন।

### প্রভাবিত ফাইল — 2026-07-10 (Section 23)
- `js/modules/voice-assistant.js` — native result handling fix
- `AUDIT_IGNORE.md` — merge conflict resolved, Section 21B যোগ
- `version.json` — 5.1.3 / `20260710-monitor-voice-fix`
- `www/`, `android/app/src/main/assets/public/` — পুরোপুরি resync

*আপডেট: 2026-07-10 — Section 23: Native APK-তে voice command না শোনার মূল কারণ (partialResults result discarded) ফিক্স, AUDIT_IGNORE.md merge-conflict cleanup, version.json/build resync।*

---

## 24. Voice Assistant — Section 23-এর ফিক্সের পরও "Running..." অবস্থায় আটকে থাকা (2026-07-10, rebuild করে reinstall করার পরেও রিপোর্ট হয়েছে)

**পটভূমি:** Section 23-এ `partialResults:false` হলে ফলাফল আসে কোথায় সেই বাগ ফিক্স করা হয়েছিল। User নতুন APK build করে reinstall করার পরও assistant "🎤 Running... (Press Escape to stop)" দেখাতে থাকে কিন্তু কোনো command-এ react করে না।

### Root Cause — Native plugin-এর `onError` প্রতিটা transient error-এ recognizer বন্ধ করে দেয়, কিন্তু continuous mode-এ restart করা হতো না

`node_modules/@capacitor-community/speech-recognition`-এর Android source (`SpeechRecognitionListener.onError()`) দেখায় যে **যেকোনো error হলেই** (`ERROR_NO_MATCH` "No match", `ERROR_SPEECH_TIMEOUT` "No speech input", `ERROR_AUDIO`, `ERROR_NETWORK` ইত্যাদি — এগুলো বাস্তব ব্যবহারে খুবই সাধারণ, একটু থামলেই হয়) — `call.reject(errorMssg)` চালায়, আর Android-এর native `SpeechRecognizer` নিজেই recognition বন্ধ করে দেয় (auto-restart করে না)।

`js/modules/voice-assistant.js`-এর native `recognition.start()`-এর `catch` ব্লক আগে ছিল:
```js
} catch(e) {
  console.warn('[Voice Native] Start Error', e);
  if (!isContinuous) stopUI();   // ← continuous mode-এ কিছুই করা হতো না!
}
```
মানে continuous mode-এ (যেটা normal ব্যবহারের ডিফল্ট) **যেকোনো transient error UI-কে "Running…" অবস্থায় রেখেই recognition permanently থামিয়ে দিত** — Escape চাপা বা app reload ছাড়া আর কখনো শুনতো না, অথচ দেখতে "চলছে" মনে হতো।

### Fix
`catch` ব্লককে দুই ভাগে ভাগ করা হলো:
- **Permanent error** ("Missing permission" / "not available") → hard-stop, UI-তে স্পষ্ট error toast দেখায়, doll minimize হয়।
- **Transient error** (no match/timeout/audio/network/busy) → `isContinuous && isActive` হলে 800ms পর স্বয়ংক্রিয়ভাবে `recognition.start()` আবার চালায় (ঠিক browser `SpeechRecognition.onerror`-এর harmless-error handling-এর মতোই)।

**প্রভাবিত ফাইল:** `js/modules/voice-assistant.js` — `www/`, `android/app/src/main/assets/public/`-এও `node build-www.js && npx cap sync android` দিয়ে sync করা হয়েছে।

### নিয়ম (ভবিষ্যতের জন্য)
native plugin call-এর `catch`/`onerror` handler লেখার সময় সবসময় ভাবুন: **continuous/loop mode-এ error এলে কী হবে?** — শুধু "না-continuous হলে থামাও" যথেষ্ট না; transient error-এ restart করার path-ও থাকতে হবে, নাহলে UI "চলছে" দেখাবে কিন্তু আসলে কিছুই শুনবে না। এটা silent-failure-এর একটা সাধারণ প্যাটার্ন — ভবিষ্যতে অন্য native listener (camera, push ইত্যাদি) লেখার সময়ও এই চেক করুন।

*আপডেট: 2026-07-10 — Section 24: Native voice recognition continuous-mode error-এ silently থেমে যাওয়ার বাগ ফিক্স (Section 23-এর ফলো-আপ, real-device rebuild-এর পরও রিপোর্ট হয়েছিল)।*

---

## 25. Voice Assistant — Android-এ থামানোর কোনো উপায় ছিল না (শুধু Escape, যা মোবাইলে নেই) — 2026-07-10

**User রিপোর্ট:** "Android-এ AI Assistant কীভাবে বন্ধ করব? Escape বাটন তো নেই, কিন্তু লেখা আছে Escape চাপো।"

### Root Cause

`js/modules/voice-assistant.js`-এ continuous listening বন্ধ করার **একমাত্র** পথ ছিল একটা physical keyboard `keydown` listener:
```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ...) dismissAssistant();
});
```
আর ডল-এ (avatar) ট্যাপ করলে (`toggleListening()`) already-listening অবস্থায় শুধু একটা বার্তা দেখাতো — "Press Escape to stop" — কিন্তু আসলে **কিছুই বন্ধ করতো না**। Android/touch device-এ কোনো physical Escape key নেই, তাই মোবাইল ইউজারদের জন্য assistant বন্ধ করার literally কোনো উপায়ই ছিল না (App reload/kill ছাড়া)।

### Fix
`toggleListening()`-কে সত্যিকারের toggle বানানো হলো — assistant চলা অবস্থায় ডল-এ আবার ট্যাপ করলে এখন `dismissAssistant()` কল হয় এবং বন্ধ হয়ে যায়। সব on-screen/spoken hint ("Press Escape to stop") পাল্টে "Tap the doll to stop" / "ডল-এ ট্যাপ করুন" করা হয়েছে (title tooltip, listening bubble, voice-help speech, help table)। Desktop-এ Escape key-ও আগের মতোই কাজ করবে (bonus shortcut হিসেবে রাখা হয়েছে, সরানো হয়নি)।

**প্রভাবিত ফাইল:** `js/modules/voice-assistant.js` — `www/`, `android/app/src/main/assets/public/`-এও sync করা হয়েছে।

*আপডেট: 2026-07-10 — Section 25: Android-এ voice assistant বন্ধ করার কোনো touch-friendly উপায় ছিল না — ডল-এ ট্যাপ করে টগল করার fix।*

---

## 26. License Server Admin Secret (ADMIN_GEN_SECRET) Overwrite issue — 2026-07-11

**সমস্যা:**
১. **Auto-save Overwrite:** `license-manager.js`-এর `_getAdminSecret()` ফাংশনটি ইনপুট এলিমেন্ট (`cm-admin-secret`) DOM-এ উপস্থিত থাকলেই তার ভ্যালু রিড করে অটো-সেভ করত। কিন্তু সেটিংস ড্যাশবোর্ড রিফ্রেশ বা মডাল ওপেন হওয়ার সময় যদি ইনপুট ফিল্ডটি খালি থাকত (উইন্ডো লোড বা রেন্ডারিং বিলম্বের কারণে) অথবা ব্রাউজার যদি ভুল কোনো ইউজারনেম/পাসওয়ার্ড অটোফিল করত, তখন সেই ভুল বা খালি মানটি আসল সেভ করা সিক্রেট কী-কে ওভাররাইট করে মুছে দিত।
২. **ব্রাউজার অটোফিল:** ইনপুট ফিল্ডটি `type="text"` হওয়ায় ব্রাউজার অনেক সময় এটিকে ইউজারনেম ফিল্ড ভেবে পাসওয়ার্ড বা ভুল ডাটা দিয়ে ফিল করে রাখত।
৩. **আলাদা ফোল্ডারের ফাইল অসঙ্গতি:** ডাউনলোড করা ফাইলগুলো তিনটি ফোল্ডারে অসঙ্গতিপূর্ণভাবে রিপ্লেস করায় বিল্ড স্ক্রিপ্টটি পুরোনো কোড দিয়ে নতুন কোড ওভাররাইট করে দিচ্ছিল।

### সমাধান
১. **অটো-সেভ বন্ধ ও ডিরেক্ট রিড:** `_getAdminSecret()` এখন সরাসরি `localStorage` থেকে মান পড়ে। ইউজারের সেভ করা কী ডোম-স্টেট (DOM state) বা অটোফিল এর কারণে আর কখনোই পরিবর্তিত হবে না।
২. **রিস্টোর হার্ডেনিং (Restore Hardening):** `_restoreAdminSecret()` এ ভ্যালু চেক করার কন্ডিশন সহজ করা হয়েছে, প্যানেল লোড হলে এটি অলওয়েজ সেভ করা কী-টি ইনপুট ফিল্ডে পপুলেট করবে।
৩. **ইনপুট ফিল্ড সিকিউর করা:** settings.js-এ ইনপুট টাইপ `text` থেকে `password` এবং `autocomplete="new-password"` করা হয়েছে, যা ব্রাউজারের অটোফিল প্রতিরোধ করে।
৪. **ফাইল সিঙ্ক:** ডাউনলোডকৃত `institution-mode.js` এবং `settings-institution.js` তিনটি টার্গেট ডিরেক্টরিতেই (`js/core/`, `www/js/core/`, এবং `android/...`) সিঙ্ক করা হয়েছে এবং `npm run build:mobile` চালিয়ে নিশ্চিত করা হয়েছে।

**প্রভাবিত ফাইল:** `js/core/license-manager.js`, `js/ui/settings.js`, `js/core/institution-mode.js`, `js/core/settings-institution.js`

*আপডেট: 2026-07-11 — Section 26: License Server Admin Secret ওভাররাইট ও ফোল্ডার সিঙ্ক সমস্যার সমাধান।*
