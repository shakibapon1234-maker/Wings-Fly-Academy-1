# 🛫 Wings Fly Aviation Academy — Next Steps Master Plan
**Date:** April 2026  
**Current Status:** New app (Wings-Fly-Academy-1) is structurally complete but needs:
1. Design upgrade (dark premium theme like old app)
2. All UI in English (not Bengali)
3. Supabase data structure (tables, schema)
4. Payment methods setup
5. Sync engine setup

**Old App (reference):** https://shakibapon1234-maker.github.io/wings-fly-academy/  
**New App (work in progress):** https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/  
**New GitHub:** https://github.com/shakibapon1234-maker/Wings-Fly-Academy-1  
**Backend:** Supabase ONLY (no Firebase anywhere)

---

## 📋 WHAT NEEDS TO BE DONE — Full Plan

---

## 🎨 STEP 1 — Design Upgrade (Priority: HIGH)

### Problem:
New app has a plain white/light background that looks unprofessional.  
Old app has a beautiful dark premium theme with glowing cards.

### Solution: Apply Premium Dark Theme

**Color Palette (match old app exactly):**
```css
--bg-primary: #0a0e1a        /* deep dark navy background */
--bg-secondary: #0d1117      /* sidebar background */
--bg-card: #111827            /* card background */
--accent-cyan: #00d4ff        /* cyan glow for headings */
--accent-green: #00ff88       /* green for positive numbers */
--accent-red: #ff4757         /* red for negative/expense */
--accent-purple: #7c3aed      /* purple for some cards */
--accent-orange: #ff6b35      /* orange for expense card */
--text-primary: #ffffff       /* white text */
--text-secondary: #94a3b8     /* gray secondary text */
--border-color: #1e293b       /* subtle borders */
--sidebar-active: #1e40af     /* active menu item */
```

**Card Style (glowing borders):**
```css
.stat-card {
  background: linear-gradient(135deg, #111827, #1e293b);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 12px;
  box-shadow: 0 0 20px rgba(0,212,255,0.05);
}
```

**Files to update:** `css/main.css` — complete rewrite with dark theme

---

## 🌐 STEP 2 — Language: English Only (Priority: HIGH)

### Problem:
New app has almost everything in Bengali (বাংলা).  
Old app uses English for all UI labels.

### What to change:
| Bengali (Current) | English (Required) |
|---|---|
| ড্যাশবোর্ড | Dashboard |
| শিক্ষার্থী | Students |
| আর্থিক লেজার | Finance Ledger |
| একাউন্ট | Accounts |
| লোন | Loans |
| কর্মী | HR / Staff |
| বেতন হাব | Salary Hub |
| ভিজিটর | Visitors |
| আইডি কার্ড | ID Cards |
| সার্টিফিকেট | Certificates |
| নোটিস বোর্ড | Notice Board |
| সেটিংস | Settings |
| নতুন শিক্ষার্থী | Add Student |
| লেনদেন যোগ | Add Transaction |
| পরীক্ষার নিবন্ধন | Exam Registration |
| নতুন কর্মী | Add Employee |
| নতুন ভিজিটর | Add Visitor |
| লোড হচ্ছে... | Loading... |
| লগইন করুন | Login |
| ইউজারনেম | Username |
| পাসওয়ার্ড | Password |

**Exception:** Notice Board content can remain in Bengali (users write notices in Bengali)  
**Exception:** নোটিস বোর্ড menu label → "Notice Board" in English but notice text stays Bengali

**Files to update:** `index.html`, all section HTML files, all JS files with text content

---

## 🗄️ STEP 3 — Supabase Database Structure (Priority: HIGH)

### Supabase Tables Required:

#### Table 1: `students`
```sql
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,        -- e.g. WFA-2026-001
  name TEXT NOT NULL,
  phone TEXT,
  father_name TEXT,
  mother_name TEXT,
  course TEXT,
  batch TEXT,
  enrollment_date DATE,
  blood_group TEXT,
  total_fee NUMERIC DEFAULT 0,
  paid NUMERIC DEFAULT 0,
  due NUMERIC GENERATED ALWAYS AS (total_fee - paid) STORED,
  payment_method TEXT,
  reminder_date DATE,
  remarks TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 2: `transactions` (Finance Ledger)
```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,          -- Income | Expense | Loan Giving | Loan Receiving | Transfer In | Transfer Out
  method TEXT,                 -- Cash | Bank | Mobile Banking
  category TEXT,
  description TEXT,
  amount NUMERIC NOT NULL,
  person_name TEXT,            -- required for Salary and Loan types
  account_id UUID,             -- linked account
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 3: `accounts`
```sql
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,          -- Cash | Bank | Mobile
  name TEXT NOT NULL,          -- e.g. "Dutch Bangla Bank", "bKash"
  account_number TEXT,
  branch TEXT,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 4: `account_transfers`
```sql
CREATE TABLE account_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  from_account_id UUID REFERENCES accounts(id),
  to_account_id UUID REFERENCES accounts(id),
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 5: `loans`
```sql
CREATE TABLE loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  person_name TEXT NOT NULL,
  type TEXT NOT NULL,          -- Loan Giving | Loan Receiving
  amount NUMERIC NOT NULL,
  notes TEXT,
  is_returned BOOLEAN DEFAULT FALSE,
  returned_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 6: `exams`
```sql
CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reg_id TEXT UNIQUE,
  student_id TEXT REFERENCES students(student_id),
  batch TEXT,
  session TEXT,
  subject TEXT,
  exam_fee NUMERIC DEFAULT 0,
  paid NUMERIC DEFAULT 0,
  grade TEXT,
  exam_date DATE,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 7: `employees`
```sql
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,                   -- Instructor | Admin | Staff
  phone TEXT,
  email TEXT,
  base_salary NUMERIC DEFAULT 0,
  joining_date DATE,
  resign_date DATE,
  status TEXT DEFAULT 'Active', -- Active | Inactive
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 8: `salary_payments`
```sql
CREATE TABLE salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  month INTEGER,
  year INTEGER,
  base_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_payable NUMERIC,
  status TEXT DEFAULT 'Unpaid', -- Paid | Unpaid
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 9: `attendance`
```sql
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  person_id UUID,
  person_type TEXT,            -- Student | Staff
  status TEXT,                 -- Present | Absent | Late
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 10: `visitors`
```sql
CREATE TABLE visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  interested_course TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 11: `notices`
```sql
CREATE TABLE notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT,                   -- warning | info | danger | success
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table 12: `settings`
```sql
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert default settings:
INSERT INTO settings (key, value) VALUES
  ('academy_name', 'Wings Fly Aviation Academy'),
  ('admin_username', 'admin'),
  ('admin_password', 'wings2026'),
  ('theme', 'dark');
```

---

## 💳 STEP 4 — Payment Methods Setup (Priority: HIGH)

### Payment Methods in the App:

**When adding a transaction or student payment, these methods are available:**

| Method | Description |
|--------|-------------|
| **Cash** | Physical cash |
| **Bank Transfer** | Bank to bank |
| **bKash** | Mobile banking |
| **Nagad** | Mobile banking |
| **Rocket** | Mobile banking |
| **Cheque** | Bank cheque |
| **Card** | Debit/Credit card |

### How Payments Link to Accounts:
```
Cash payment       → auto updates "Cash" account balance
Bank Transfer      → user selects which bank account
bKash payment      → auto updates bKash mobile account
Nagad payment      → auto updates Nagad mobile account
Rocket payment     → auto updates Rocket mobile account
```

### Student Payment Flow:
1. Student pays course fee
2. Transaction recorded: Type=Income, Category=Course Fee, Method=Cash/Bank/Mobile
3. Student's `paid` field updated
4. `due` auto-calculates (total_fee - paid)
5. Account balance updated

---

## ☁️ STEP 5 — Supabase Sync Engine (Priority: HIGH)

### How Sync Works:

**`js/core/supabase-config.js`:**
```javascript
const SUPABASE_URL = 'YOUR_NEW_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_NEW_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**`js/core/supabase-sync.js` — Key Functions:**

```javascript
// AUTO SYNC every 30 seconds
setInterval(syncAll, 30000);

// SYNC ALL DATA
async function syncAll() {
  await syncStudents();
  await syncTransactions();
  await syncAccounts();
  await syncLoans();
  await syncExams();
  await syncEmployees();
  await syncVisitors();
  await syncNotices();
  updateSyncStatus('Synced', new Date());
}

// REAL-TIME LISTENER (multi-user)
supabase.channel('db-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange)
  .subscribe();

// LOCAL CACHE (fast UI, sync in background)
// Data stored in memory object, not localStorage
const appData = {
  students: [],
  transactions: [],
  accounts: [],
  loans: [],
  exams: [],
  employees: [],
  visitors: [],
  notices: []
};
```

### Sync Status Indicators:
- 🟢 **Synced** — all data up to date
- 🟡 **Syncing...** — sync in progress  
- 🔴 **Offline** — no connection
- ☁️ **Ready** — connected, waiting

---

## 🎯 STEP-BY-STEP EXECUTION ORDER

### Week 1 — Foundation Fix
| Order | Task | File(s) | Status |
|-------|------|---------|--------|
| 1 | Dark theme CSS | `css/main.css` | ✅ DONE |
| 2 | English UI - Sidebar | `index.html` | ✅ DONE |
| 3 | English UI - All sections | all section files | ✅ DONE |
| 4 | Supabase tables create | Supabase dashboard | ⏳ PENDING |
| 5 | supabase-config.js | `js/core/supabase-config.js` | ✅ DONE |

### Week 2 — Core Modules
| Order | Task | File(s) | Status |
|-------|------|---------|--------|
| 6 | Login + auth | `js/ui/login.js` | ✅ DONE |
| 7 | Dashboard stats | `js/ui/dashboard.js` | ✅ DONE |
| 8 | Student CRUD + Supabase | `js/modules/students.js` | ✅ DONE |
| 9 | Finance Ledger + Supabase | `js/modules/finance.js` | ✅ DONE |
| 10 | Accounts + payment methods | `js/modules/accounts.js` | ✅ DONE |

### Week 3 — Remaining Modules
| Order | Task | File(s) | Status |
|-------|------|---------|--------|
| 11 | Loans | `js/modules/loans.js` | ✅ DONE |
| 12 | Exam management | `js/modules/exam.js` | ✅ DONE |
| 13 | HR/Staff | `js/modules/hr-staff.js` | ✅ DONE |
| 14 | Salary Hub | `js/modules/salary.js` | ✅ DONE |
| 15 | Attendance | `js/modules/attendance.js` | ✅ DONE |

### Week 4 — Polish + Go Live
| Order | Task | File(s) | Status |
|-------|------|---------|--------|
| 16 | Visitors | `js/modules/visitors.js` | ✅ DONE |
| 17 | ID Cards + Certificates | `js/modules/id-cards.js` | ✅ DONE |
| 18 | Notice Board | `js/modules/notice-board.js` | ✅ DONE |
| 19 | Supabase sync engine | `js/core/supabase-sync.js` | ✅ DONE |
| 20 | Data migration from old Supabase | export/import | ✅ DONE |
| 21 | Final test + Go Live 🚀 | — | ⏳ PENDING |

---

## 🚀 IMMEDIATE NEXT ACTION FOR AI

**When this file is uploaded in a new session, AI should:**

1. Read "IMMEDIATE NEXT ACTION" section
2. Check which step was last completed
3. Start from the next step without asking questions
4. Produce the complete file code ready to copy-paste into GitHub

**Current Status:** All Week 1, 2, 3, and 4 Core modules have been upgraded with the new UI and translated!
Next step is Order 20: Data Migration from old Supabase. 

**Next task:** We need to export your old database and import it into your new database instance. Let me know when you are ready to proceed with Data Migration!

---

## ⚠️ STRICT RULES FOR AI

1. NO Firebase — Supabase only
2. NO Bengali text in UI — English only (except Notice Board content)
3. NO patch/fix files — fix the source file directly
4. NO backup folders in repo
5. ALWAYS produce complete file code — never partial snippets
6. After completing a step, update the Step Status table above
7. Never ask user technical questions — decide independently
