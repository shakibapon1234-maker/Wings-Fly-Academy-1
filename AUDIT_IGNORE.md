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

*আপডেট: 2026-05-23 — Salary cloud `paid` boolean, SyncEngine pull fix, AUDIT_IGNORE প্রথম সংস্করণ.*
