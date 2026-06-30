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

### প্রভাবিত ফাইল (রেফারেন্স)
- `js/core/supabase-sync.js` — `upsertAccountByTypeName()`, `ensureDefaultCashAccount()` (detect-only)
- `js/modules/accounts.js` — `getPrimaryCashAccount()`
- `js/ui/dashboard.js` — `normalizeAccounts()`
- `js/ui/setup-wizard.js` — Cash account bootstrap (এখন শুধু `ensureDefaultCashAccount()` কল করে, সরাসরি insert করে না)
- `js/ui/settings.js` — JSON migration importer (এখন `upsertAccountByTypeName()` দিয়ে accounts import করে)

---

*আপডেট: 2026-06-29 — Account (Cash/Bank/Mobile) ডুপ্লিকেট প্রতিরোধ নিয়ম যোগ (Section 7)।*
*আপডেট: 2026-05-23 — Salary cloud `paid` boolean, SyncEngine pull fix, AUDIT_IGNORE প্রথম সংস্করণ.*
