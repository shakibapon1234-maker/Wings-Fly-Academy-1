# 🛫 Wings Fly Aviation Academy — নতুন Project Master Plan
**সর্বশেষ আপডেট:** April 2026  
**পুরোনো (চলমান):** https://shakibapon1234-maker.github.io/wings-fly-academy/  
**নতুন (নির্মাণাধীন):** https://shakibmustafa550-ai.github.io/Wings-Fly-Academy/  
**নতুন GitHub:** https://github.com/shakibmustafa550-ai/Wings-Fly-Academy  
**Backend:** Supabase (নতুন account, আলাদা email) — Firebase নেই, থাকবেও না।

---

## 📌 এই Document-এর উদ্দেশ্য
প্রতিটি AI session-এ এই file upload করলে AI সাথে সাথে বুঝতে পারবে:
- প্রজেক্টের লক্ষ্য কী
- কতটুকু কাজ হয়েছে
- পরবর্তী কাজ কী
- কোনো প্রশ্ন না করেই কাজ শুরু করতে পারবে

---

## 🎯 লক্ষ্য
পুরোনো app-এর **সব feature** নতুনে আনা, কিন্তু code structure হবে:
- ✅ Clean ও সাজানো (folder structure)
- ✅ কোনো patch/fix file থাকবে না
- ✅ কোনো backup/archive folder থাকবে না repo-তে
- ✅ Supabase sync (multi-user, real-time)
- ✅ সব কিছু একটা `index.html`-এ চলবে (SPA)

---

## 🗂️ নতুন Project-এর চূড়ান্ত File Structure

```
Wings-Fly-Academy/
│
├── index.html                  ← একমাত্র HTML, সব section এখানে
├── manifest.json               ← PWA manifest
├── service-worker.js           ← PWA offline support
├── favicon.ico
├── PROJECT-SCANNER.md          ← এই file (progress tracker)
│
├── assets/
│   ├── logo.jpg.jpeg
│   ├── academy-logo-b.png
│   ├── wings_logo_premium.png
│   ├── certificate-bg.jpg
│   └── signature.png
│
├── css/
│   ├── main.css                ← সব global style
│   ├── attendance.css          ← attendance-specific
│   └── print.css               ← print layout
│
├── js/
│   ├── core/
│   │   ├── supabase-config.js  ← Supabase URL + Key
│   │   ├── supabase-sync.js    ← Sync engine (clean version)
│   │   ├── app.js              ← Main app logic, tab switching
│   │   └── utils.js            ← Helper functions
│   │
│   ├── modules/
│   │   ├── students.js         ← Student CRUD
│   │   ├── finance.js          ← Ledger, income/expense
│   │   ├── accounts.js         ← Cash/Bank/Mobile balance
│   │   ├── loans.js            ← Loan management
│   │   ├── exam.js             ← Exam registration & results
│   │   ├── attendance.js       ← Attendance
│   │   ├── salary.js           ← Salary Hub
│   │   ├── hr-staff.js         ← Employee management
│   │   ├── visitors.js         ← Visitor tracking
│   │   ├── id-cards.js         ← ID card generator
│   │   ├── certificates.js     ← Certificate generator
│   │   └── notice-board.js     ← বাংলা নোটিস বোর্ড
│   │
│   └── ui/
│       ├── dashboard.js        ← Dashboard stats & charts
│       ├── login.js            ← Login/logout
│       └── settings.js         ← Settings tab
│
└── sections/                   ← (HTML partial files, index.html-এ include হয়)
    ├── login.html
    ├── dashboard.html
    ├── students.html
    ├── finance.html
    ├── accounts.html
    ├── loans.html
    ├── exam.html
    ├── attendance.html
    ├── salary.html
    ├── hr-staff.html
    ├── visitors.html
    ├── id-cards.html
    ├── certificates.html
    ├── notice-board.html
    └── settings.html
```

---

## ✅ কাজের Progress Tracker

### 🔵 Phase 1 — Foundation
| কাজ | Status |
|-----|--------|
| নতুন GitHub repo তৈরি | ✅ Done |
| নতুন Supabase account | ✅ Done |
| Basic file structure শুরু | ✅ Done (3 commits) |
| `index.html` clean version | ⏳ বাকি |
| `css/main.css` | ⏳ বাকি |
| `js/core/supabase-config.js` | ⏳ বাকি |
| `js/core/supabase-sync.js` | ⏳ বাকি |
| `js/core/app.js` (tab switching) | ⏳ বাকি |
| `js/core/utils.js` | ⏳ বাকি |

### 🔵 Phase 2 — Login & Dashboard
| কাজ | Status |
|-----|--------|
| Login page (UI + logic) | ⏳ বাকি |
| Dashboard stats cards | ⏳ বাকি |
| Dashboard charts | ⏳ বাকি |
| Cloud sync indicator | ⏳ বাকি |
| Notification bell | ⏳ বাকি |

### 🔵 Phase 3 — Student Module
| কাজ | Status |
|-----|--------|
| Student Add form | ⏳ বাকি |
| Student list table | ⏳ বাকি |
| Student Edit/Delete | ⏳ বাকি |
| Student search & filter | ⏳ বাকি |
| Batch filter | ⏳ বাকি |
| Print & Excel export | ⏳ বাকি |
| Student reminder | ⏳ বাকি |

### 🔵 Phase 4 — Finance Module
| কাজ | Status |
|-----|--------|
| Add Transaction form | ⏳ বাকি |
| Finance Ledger table | ⏳ বাকি |
| Income/Expense filter | ⏳ বাকি |
| Date range filter | ⏳ বাকি |
| Print & Excel export | ⏳ বাকি |
| Email/Mail feature | ⏳ বাকি |

### 🔵 Phase 5 — Accounts Module
| কাজ | Status |
|-----|--------|
| Cash balance | ⏳ বাকি |
| Bank balance | ⏳ বাকি |
| Mobile banking balance | ⏳ বাকি |
| Transfer between accounts | ⏳ বাকি |
| Account ledger | ⏳ বাকি |

### 🔵 Phase 6 — Loans Module
| কাজ | Status |
|-----|--------|
| Loan giving/receiving | ⏳ বাকি |
| Person-wise loan summary | ⏳ বাকি |
| Loan ledger | ⏳ বাকি |

### 🔵 Phase 7 — Exam Module
| কাজ | Status |
|-----|--------|
| Exam registration | ⏳ বাকি |
| Exam result entry | ⏳ বাকি |
| Grade management | ⏳ বাকি |
| Batch/Session filter | ⏳ বাকি |
| Print report | ⏳ বাকি |

### 🔵 Phase 8 — HR, Salary, Attendance
| কাজ | Status |
|-----|--------|
| Employee Add/Edit/Delete | ⏳ বাকি |
| Role management | ⏳ বাকি |
| Attendance system | ⏳ বাকি |
| Salary Hub (monthly) | ⏳ বাকি |
| Salary history | ⏳ বাকি |

### 🔵 Phase 9 — Visitors, ID, Certificates, Notice
| কাজ | Status |
|-----|--------|
| Visitor management | ⏳ বাকি |
| ID Card generator | ⏳ বাকি |
| Certificate generator | ⏳ বাকি |
| নোটিস বোর্ড (বাংলা) | ⏳ বাকি |
| নোটিস timer/expiry | ⏳ বাকি |

### 🔵 Phase 10 — Sync & Migration
| কাজ | Status |
|-----|--------|
| Supabase real-time sync | ⏳ বাকি |
| Multi-user support | ⏳ বাকি |
| Data export from old Supabase | ⏳ বাকি |
| Data import to new Supabase | ⏳ বাকি |
| Final testing | ⏳ বাকি |
| **Go Live 🚀** | ⏳ বাকি |

---

## 🔑 গুরুত্বপূর্ণ নিয়মাবলী (AI-এর জন্য)

1. **Firebase শব্দ কোথাও লেখা যাবে না** — শুধু Supabase
2. **সব JS module আলাদা file-এ** — একটা বড় file-এ সব নয়
3. **কোনো patch/fix/quick-fix file বানানো যাবে না** — সরাসরি মূল file ঠিক করতে হবে
4. **কোনো backup folder repo-তে রাখা যাবে না**
5. **প্রতিটি কাজ শেষে এই file-এর Progress Tracker আপডেট করতে হবে**
6. **User কে technical প্রশ্ন করা যাবে না** — নিজে সিদ্ধান্ত নিতে হবে
7. **পুরোনো app-এর সব feature নতুনে থাকতে হবে** — কিছু বাদ দেওয়া যাবে না

---

## 📊 পুরোনো App-এর সব Feature List (reference)

### Dashboard
- Total students count, Collection, Expense, Net Profit/Loss
- Account Balance (Cash+Bank+Mobile)
- All-time lifetime overview
- Revenue chart (monthly)
- Course Enrollments chart
- Recent Admissions table
- Batch Financial Analysis
- Loan Summary
- Last Five Work Complete (Ledger)
- Student Reminder
- Target Progress
- Batch Summary (Total/Paid/Due/Students)
- Running Batch Overview
- Notice Board (বাংলা)
- Cloud Sync (Ready/Synced status)
- Quick Add buttons (Student, Transaction, Exam, Visitor)

### Students
- Add/Edit/Delete student
- Student ID auto-generate
- Course, Batch, Session info
- Total fee, Paid, Due tracking
- Date filter, Batch filter, Course filter
- Print & Excel export
- Reminder system

### Finance Ledger
- Income, Expense, Loan Giving, Loan Receiving, Transfer In, Transfer Out
- Method: Cash, Bank, Mobile Banking
- Category filter
- Date range filter
- Print, Excel, Email export
- Running balance

### Accounts
- Cash, Bank, Mobile Banking separate balance
- Transfer between accounts
- Per-account ledger

### Loans
- Person-wise loan tracking
- Loan given vs received
- Outstanding balance per person

### Exam
- Registration with Reg ID, Student ID
- Batch, Session, Subject
- Exam fee payment tracking
- Grade entry
- Date range filter
- Print report, Excel export

### Attendance
- Daily attendance per student/staff
- Batch-wise attendance
- Monthly report

### HR/Staff
- Add/Edit/Delete employee
- Role: Instructor, Admin, Staff
- Phone, Email, Salary, Joining Date, Resign Date
- Status: Active/Inactive

### Salary Hub
- Monthly salary processing
- Per-staff payment record
- Payment history
- Budget vs Paid vs Due

### Visitors
- Visitor name, phone
- Interested course
- Remarks
- Date tracking

### ID Cards
- Student/Staff ID card generator
- Print-ready format

### Certificates
- Aviation certificate generator
- Student info auto-fill
- Print-ready

### নোটিস বোর্ড
- বাংলায় নোটিস লেখা
- ৪ ধরন: সতর্কতা (হলুদ), তথ্য (নীল), জরুরি (লাল), সফলতা (সবুজ)
- Timer/Expiry: ৩০ মিনিট থেকে ১ সপ্তাহ পর্যন্ত
- Custom time সেট করার সুবিধা

### Settings
- Academy info update
- Admin password change
- Theme/Dark mode

### Cloud Sync (Supabase)
- Auto sync every 30 seconds
- Manual: Sync Now, Pull, Push
- Multi-user real-time sync
- Cloud vs Local monitor
- Data monitor

---

## 🚀 পরবর্তী Session-এ AI কী করবে

এই file upload করলে AI সাথে সাথে বুঝবে:
1. Progress Tracker দেখবে — কোনটা ✅ Done, কোনটা ⏳ বাকি
2. প্রথম ⏳ item থেকে কাজ শুরু করবে
3. কাজ শেষে Progress Tracker update করবে
4. User-কে বলবে কোন file repo-তে upload করতে হবে

**পরবর্তী কাজ (Phase 1 শেষ করা):**
- `index.html` তৈরি করা
- `css/main.css` তৈরি করা  
- `js/core/supabase-config.js` তৈরি করা
- `js/core/app.js` তৈরি করা
