# 🛫 Wings Fly Academy - Project Scanner
## 📋 Project Structure Overview

```
wings-fly-clean/
├── index.html                    # Main app (2360 lines) - Entry point
│
├── ── CORE APP FILES
├── app.js                        # Main application logic
├── utils.js                     # Utilities
├── config-secret.js             # Secret config (NOT in git)
├── supabase-config.js           # Supabase configuration
│
├── ── MAIN MODULES
├── supabase-sync-SMART-V39.js   # Cloud sync engine (2131 lines)
├── exam_management.js            # Exam management system
├── finance-engine-fixes.js       # Finance engine patches
│
├── sections/                     # UI Components (45 files)
│
├── 📁 UI SECTIONS:
│   ├── auth.js                   # Login/Authentication
│   ├── student-management.js     # Student CRUD
│   ├── finance-crud.js           # Finance operations
│   ├── employee-management.js    # Employee management
│   ├── accounts-management.js    # Account management
│   ├── salary-management.js      # Salary system
│   ├── loan-management.js        # Loan management
│   ├── notice-board.js           # Notice board
│   ├── visitor-management.js     # Visitor log
│   ├── activity-log.js           # Activity tracking
│   ├── data-protection.js        # Data security
│   ├── advanced-security.js      # Security features
│   ├── sync-guard.js             # Sync integrity checker
│   ├── finance-guard.js          # Finance integrity
│   ├── recycle-bin-fix.js         # Recycle bin system
│   ├── local-encryption-v3.js    # Local encryption
│   ├── date-formatter.js         # Date utilities
│   ├── data-export.js            # Export functions
│   ├── analytics-print.js        # Analytics/Reports
│   ├── advanced-analytics.js     # Advanced analytics
│   ├── batch-profit-report.js    # Batch profit reports
│   ├── table-pagination.js       # Pagination system
│   ├── charts.js                 # Chart rendering
│   ├── notifications.js          # Notifications
│
├── 📁 HTML SECTIONS:
│   ├── dashboard.html            # Dashboard UI
│   ├── students.html             # Student page
│   ├── employees.html           # Employee page
│   ├── accounts.html             # Accounts page
│   ├── accounts-section.html    # Accounts section
│   ├── ledger.html              # Finance ledger
│   ├── loans.html               # Loan page
│   ├── visitors.html            # Visitor page
│   ├── exam.html                # Exam page
│   ├── certificates.html         # Certificates
│   ├── idcards.html             # ID Cards
│   ├── modals.html              # Common modals
│   ├── modals-student.html      # Student modals
│   ├── modals-other.html        # Other modals
│   ├── settings-modal.html      # Settings modal
│   ├── salary-modal.html        # Salary modal
│   ├── notice-board-modal.html  # Notice modal
│   ├── student-modals.html      # Student modals
│
├── 📁 UTILITIES:
│   ├── section-loader.js         # Dynamic section loader
│   ├── aviation-loader.js        # App loader
│   ├── finance-helpers.js        # Finance helpers
│   ├── accounts-ui.js           # Accounts UI
│   ├── account-search.js        # Account search
│   ├── dashboard-stats.js       # Dashboard stats
│   ├── ledger-render.js         # Ledger rendering
│   ├── snapshot-system.js       # Data snapshots
│   ├── photo-manager.js         # Photo management
│   ├── card-certificate.js      # Cards & certificates
│   ├── id-card.js               # ID card generator
│   ├── keep-records.js          # Record keeping
│   ├── inline-scripts.js        # Inline scripts
│
└── 📁 STYLES:
    ├── styles.css               # Main styles
    ├── premium-styles.css       # Premium styles
    ├── table_scroll_fix.css     # Table scroll fix
```

---

## 🔑 KEY FILES & FUNCTIONS

### 🔐 Authentication (auth.js)
| Function | Purpose |
|----------|---------|
| `handleLogin()` | Main login handler |
| `trySupabaseLogin()` | Supabase Auth login |
| `handleLegacyLogin()` | Local storage login |
| `hashPasswordPBKDF2()` | Password hashing |
| `showDashboard()` | Show dashboard after login |
| `logout()` | Logout user |

### ☁️ Cloud Sync (supabase-sync-SMART-V39.js)
| Function | Purpose |
|----------|---------|
| `pushToCloud()` | Push local data to cloud |
| `pullFromCloud()` | Pull data from cloud |
| `saveToCloud()` | Save to cloud (auto) |
| `loadFromCloud()` | Load from cloud (auto) |
| `forcePushOnly()` | Force push local data |
| `_smartSync()` | Smart sync logic |

### 🛡️ Data Integrity
| File | Function | Purpose |
|------|----------|---------|
| `sync-guard.js` | `checkIntegrity()` | Sync & Payment integrity |
| `finance-guard.js` | `checkFinanceIntegrity()` | Finance data integrity |
| `data-protection.js` | `_initDataProtection()` | Data validation & audit |

### 📊 Core Data
| Variable | Location | Description |
|----------|----------|-------------|
| `window.globalData` | app.js | Main data store |
| `globalData.students` | - | Student array |
| `globalData.finance` | - | Finance entries |
| `globalData.employees` | - | Employee array |
| `globalData.cashBalance` | - | Cash balance |
| `globalData.bankAccounts` | - | Bank accounts |
| `globalData.mobileBanking` | - | Mobile banking |

---

## 🎯 FEATURES BREAKDOWN

### ✅ Working Features
1. **Student Management** - Add/Edit/Delete students
2. **Finance System** - Income/Expense tracking
3. **Employee Management** - Staff management
4. **Salary System** - Salary calculation & payment
5. **Cloud Sync** - Sync with Supabase
6. **Data Protection** - Audit logging & validation
7. **Security** - XSS/CSRF protection
8. **Recycle Bin** - Deleted items recovery
9. **Local Encryption** - LocalStorage encryption
10. **Reports** - Analytics & exports

### ⚠️ Known Issues
1. **wf_students/wf_finance tables** - Separate table sync has 400 errors
2. **increment_version RPC** - Not found (404)
3. **Login bypass** - Currently auto-login as admin

---

## 📱 LIVE URL
**GitHub Pages:** https://shakibmustafa550-ai.github.io/Wings-Fly-Academy/

---

## 🗄️ DATABASE (Supabase)

### academy_data (Main Table)
- id: wingsfly_main
- students, finance, employees (JSON)
- cash_balance, bank_accounts, mobile_banking
- version, last_device, last_sync

### Separate Tables (Issues)
- wf_students (ID column needs TEXT type)
- wf_finance 
- wf_employees

---

*Generated: 2026-04-03*