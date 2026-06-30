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


