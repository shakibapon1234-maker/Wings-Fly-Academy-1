# Wings Fly Aviation Academy — Audit Guide

**For humans and AI auditors:** Read this file **before** reporting issues.  
Many daily “errors” are **documented, intentional design** — not bugs.

---

## অডিট করার নিয়ম (বাংলা)

1. **এই ফাইল প্রথমে পড়ুন** — তারপর শুধু **নতুন** বা **Critical** সমস্যা লিস্ট করুন।
2. **Ignore list**-এর আইটেম আবার রিপোর্ট করবেন না (নিচে দেখুন)।
3. আউটপুট **৩ বাকেটে** দিন:
   - **Critical** — সিঙ্ক ভাঙে, ডেটা লিক, XSS, auth bypass
   - **Should fix** — এক পেজে script missing, সত্যিকারের race/logic bug
   - **Ignored (documented)** — এই ফাইলে লেখা ইচ্ছাকৃত প্যাটার্ন
4. লক্ষ্য: Critical + Should fix **মিলিয়ে ৫টার নিচে** (যদি কোডে নতুন regression না থাকে)।

### অডিট প্রম্পট (কপি-পেস্ট)

```
Read AUDIT.md first. Audit Wings Fly Academy PWA.
Do NOT re-report items in the Ignore list.
Output only: Critical | Should fix | Ignored (with AUDIT.md section ref).
Max 10 items total unless you found new Critical issues.
```

---

## Audit rules (English)

1. Read this file first; do not re-flag documented patterns.
2. Supabase **anon key + project URL in client code are required** for offline PWA sync — not a secret leak if **RLS is ON**.
3. After code changes, bump `DEPLOY_ID` in `service-worker.js` (cache bust).
4. Prefer in-app checks: `IntegrityGuard.run()`, Settings → Diagnostics.

---

## Architecture (what auditors must understand)

| Piece | Role |
|--------|------|
| **PWA + Service Worker** | Offline static assets; `DEPLOY_ID` busts stale cache |
| **IndexedDB + `SupabaseSync`** | Local source of truth; cloud sync when online |
| **`supabase-config.js`** | Client init; inline URL/key **fallback** when gitignored secrets missing (e.g. GitHub Pages) |
| **RLS (Supabase)** | Real security boundary — not hiding the anon key |
| **App login** | Admin password / pattern lock — separate from Supabase anon key |
| **Standalone pages** | `exam.html`, `admin.html`, `certificate.html`, `visitor-form.html` — subset of scripts |

---

## Ignore list — do NOT report as vulnerabilities

| Finding | Why it is OK | Reference |
|---------|----------------|-----------|
| Hardcoded **Supabase URL** or **anon key** in `supabase-config.js`, `supabase-standalone-creds.js`, fallbacks | Public anon key by Supabase design; sync needs credentials when `supabase-secrets.js` is absent; **RLS ON** on all tables | `js/core/supabase-config.js` header comment |
| `supabase-secrets.js` in `.gitignore` but exists locally | Local override; production uses stub + Settings → Cloud API | `.gitignore`, `supabase-secrets.stub.js` |
| `supabase-secrets.js` committed in an old zip | Best-practice warning only if already in git history — use stub in repo | `supabase-secrets.example.js` |
| CSP `unsafe-inline` / `script-src-attr` on `index.html` | Legacy module HTML injection + inline handlers; tracked separately | `index.html` CSP meta |
| `js/core/types.js` not loaded anywhere | JSDoc / IDE types only — **never** load in browser or SW | `types.js` file header |
| `voice-assistant.js` not in SW precache | **Lazy-loaded after login** to avoid OOM on low-memory devices | `app.js`, `service-worker.js` comment |
| `face-api` models not in SW precache | ~12MB — would break SW install on slow networks; lazy cache on first use | `service-worker.js` comment |
| `const AIAssistant` without `window` in closure | Exposed as `window.AIAssistant` at end of `ai-assistant.js` | `ai-assistant.js` |
| Different script lists per HTML page | Standalone pages load minimal stack by design | `exam.html`, `admin.html` |
| `Utils.esc` missing on numeric stats (counts) | Numbers from `.length` / filters — not user HTML | `visitors.js` stats row |

---

## Intentional security model

```
Browser holds: anon key + URL  →  Supabase client
                                      ↓
                            RLS policies (Dashboard)
                                      ↓
              Only allowed rows for authenticated / public RPCs
```

- **Service role key** must **never** appear in this repo.
- **Gemini / AI API keys** belong in Settings / SecureStorage — never hardcoded (see `ai-assistant.js`).

Verify RLS: Supabase Dashboard → each table → **RLS enabled** + policies from `supabase/rls_policies_secure.sql`.

---

## What TO audit (real issues)

### Critical
- Missing scripts on a page that **uses** that API (`SecureStorage`, `session-store`, `Utils`, etc.)
- `window.supabaseClient` never set while sync runs (race / wrong `const` snapshot)
- XSS: user/DB strings in `innerHTML` without `Utils.esc` / `escAttr`
- Finance balance drift (paid + due ≠ total) — use Sync Guard
- RLS off or wide-open policies on production project

### Should fix
- `DEPLOY_ID` not bumped after deploy (users keep old SW cache)
- SW precache list out of sync with files that **must** be offline on first load
- `integrity-guard.js` vital URLs missing a deployed page (e.g. `visitor-form.html`)
- `certificates.js` using frozen `supabaseClient` instead of `window.supabaseClient`

### In-app tools (run instead of full code scan)
```js
IntegrityGuard.run()           // modules, DOM, vital URLs
// Settings → Sync Guard → Run Diagnostics
```

---

## File / page checklist

| Page | Must load (minimum) |
|------|---------------------|
| `index.html` | Full app stack (see bottom of file) |
| `exam.html` | `secure-storage.js`, `session-store.js`, `supabase-config.js`, `supabase-sync.js`, `utils.js` |
| `admin.html` | `secure-storage.js`, `session-store.js`, `i18n.js`, `loading-state.js`, admin-panel |
| `visitor-form.html` | Standalone creds + Supabase client (own inline init) |

---

## Deploy checklist (after code changes)

1. Update `DEPLOY_ID` in `service-worker.js` (e.g. `YYYYMMDD-short-description`).
2. Deploy all static files together (avoid half-old CDN/GitHub Pages cache).
3. Hard refresh once (Ctrl+Shift+R) or clear site data.
4. Smoke test: login → pull sync → add one student → push → second device/browser pull.
5. Optional: `IntegrityGuard.run()` — expect 0 critical module failures.

---

## Service Worker notes

- **Precached:** core app, most modules, standalone HTML shells.
- **Not precached (by design):** `voice-assistant.js`, face-api weights (~12MB).
- **Never add:** `js/core/types.js`, `supabase-secrets.js` (gitignored secrets).

---

## Changelog (audit-related fixes)

| Date | Change |
|------|--------|
| 2026-07-10 | **Repair Cloud-Sync Guard:** `Repair Missing Finance Entries` এখন বাধ্যতামূলকভাবে cloud full-pull শেষ হওয়ার পরে চলে। নতুন device/browser-এ খালি local cache থেকে cutoff missing ধরে repair চালিয়ে pre-cutoff migration data বা balance নষ্ট করার ঝুঁকি বন্ধ করা হয়েছে। Pull ব্যর্থ/অসম্পূর্ণ হলে repair block হয়ে actionable error দেখায়। Affected: `js/core/supabase-sync.js`, `js/ui/settings.js`; SW `DEPLOY_ID` → `20260710-repair-cloud-sync-guard`. |
| 2026-07-07 | **Balance Sync → Ledger-Derived (LWW data-loss fix):** `accounts.balance` আর timestamp LWW নয় — sync-এর পর `finance_ledger`+`loans` থেকে re-derive (AUDIT_IGNORE Section 20)। merge-এ local authoritative, post-pull `recalculateAccountBalancesFromLedger()`; manual/initial balance edit এখন ledger entry; recalc 'Balance Adjustment' count করে। দৈনিক transaction loss / scrambled balance সমাধান। Affected: `js/core/supabase-sync.js`, `js/modules/accounts.js` |
| 2026-07-07 | **Cutoff Date Fixes:** (1) **Sync Timing Mismatch Fix:** localStorage সিঙ্ক হওয়ার আগে Repair চাপলে কাটঅফ বাইপাস বাগ সমাধান করা হয়েছে (অন-ডিমান্ড ডেটাবেজ থেকে রেজলভ করা হয়)। (2) **Snapshot Double-Counting Fix:** কাটঅফ বাউন্ডারি দিনে এন্ট্রি থাকলে তা বেসলাইন স্ন্যাপশটে ডাবল-বিয়োগ হওয়া ঠেকাতে বেসলাইন অ্যাডজাস্টমেন্ট যোগ করা হয়েছে। Affected files: `js/core/supabase-sync.js`, `js/core/sync-guard.js`, `js/ui/settings.js` |
| 2026-07-01 | **Balance Corruption Root Cause Fix (v3 — Final):** তিনটি AI অডিটে প্রমাণিত মূল কারণগুলো fix করা হয়েছে। **(1) Auto-startup repair disabled:** `_runStartupFinanceRepair()` এ `repairMissingStudentFinance()` call সম্পূর্ণ বন্ধ — শুধু localStorage flag set হয়। **(2) Backup import-এ auto-recalculate removed:** `backup-restore.js`-এ `recalculateAccountBalancesFromLedger()` auto-call সরানো হয়েছে। **(3) Broken "Clean Duplicate" card removed:** settings.js-এ ভাঙা card সরিয়ে নতুন "Balance Cutoff Date" card দেওয়া হয়েছে। **(4) SyntaxError Fix:** inline onclick-এ template literal ও arrow function-এর কারণে `SyntaxError` ছিল — `SettingsModule.cleanDuplicateRepairEntries` হিসেবে module scope-এ সরানো হয়েছে। **Root cause confirmed:** 103টা duplicate `(Repaired)` entry finance_ledger-এ জমেছিল (৳8,10,497 phantom amount). Affected files: `js/core/supabase-sync.js`, `js/core/backup-restore.js`, `js/ui/settings.js` |
| 2026-07-01 | **Balance Cutoff Date Feature:** Migration data-র কারণে বারবার balance corruption হওয়ার সমস্যা সমাধানে cutoff date feature যোগ হয়েছে। `wfa_repair_cutoff_date` localStorage key-এ একটা date (YYYY-MM-DD) set করলে `repairMissingStudentFinance()` সেই date-এর আগে ভর্তি হওয়া সব student skip করবে — তাদের পুরনো migration data আর কখনো touch হবে না। Settings → Data Management → "Balance Cutoff Date" card থেকে "আজকের Date Set করুন" বাটনে ক্লিক করলে আজকের date baseline হিসেবে lock হবে। Cutoff ছাড়াও চালানো যাবে। `setRepairCutoffToday()` ও `clearRepairCutoff()` functions `SettingsModule`-এ যোগ হয়েছে। Affected files: `js/core/supabase-sync.js`, `js/ui/settings.js` |
| 2026-07-01 | **Recycle Bin Restore Fix:** `supabase-sync.js` L1616-এ Investment In/Out type check missing ছিল — recycle bin থেকে Investment entry restore করলে balance আপডেট হতো না। Fix করা হয়েছে। Affected file: `js/core/supabase-sync.js` |
| 2026-06-26 | **Feature 4 — SMS Notification System (v5.1.0):** New `js/core/sms-engine.js` (Green Web BD API, async send, IDB+cloud logging to `sms_logs`); SMS triggers added to `students.js` (fee due after payment), `attendance.js` (absent after saveAllAttendance), `exam.js` (result after grade save), `payment-engine.js` (approve + reject); SMS Settings panel + tab injected into `js/ui/settings.js` (API key, sender ID, per-event toggles, test SMS, log viewer); Student Portal Routine tab: `student-portal.html` + `student-dashboard.js` (`_renderRoutine`), `routine-engine.js` added as script tag; `supabase-sync.js` `class_routines` + `sms_logs` + `settings.sms_config` columns added (both TABLE_COLUMNS blocks); `lazy-modules.js` `sms-engine` registered in MODULES + POST_LOGIN_IDLE, `routine-engine`/`routine-builder` registered; `index.html` + `app.js` updated for `routine-builder` section; SW `DEPLOY_ID` → `20260626-feature4-sms-notifications` |
| 2026-06-14 | **Security + restore fixes:** `notice-board.js` TYPE_CFG lookup hardened with `Object.prototype.hasOwnProperty.call()` (prototype pollution prevention); `visitor-form.html` `session-store.js` added; `supabase-sync.js` student restore recalculates `paid`/`due` from full ledger after installment restore; `vercel.json` `Content-Security-Policy` HTTP header added; `AUDIT.md` changelog table structure fixed |
| 2026-06-08 | **XSS + security fixes (v4.9.9):** `salary.js` `r.method` wrapped with `Utils.esc()` in both salary cards (line ~322) and history table (line ~843); `dashboard.js` `runningBatch` and `expenseMonth` wrapped with `Utils.esc()` in 3 innerHTML interpolation points; `certificate.html` missing `i18n.js` and `loading-state.js` added; `vercel.json` HTTP security headers added (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`); `manifest.json` screenshot `form_factor` changed from `narrow` to `wide` (square 512×512 is not valid narrow); bumped SW `DEPLOY_ID` to `20260608-xss-security-fixes` |
| 2026-06-06 | **Security audit fixes (v4.9.8):** Cleared live credentials from `supabase-secrets.js` (was shipped in zip); Gemini backup key slots 2 & 3 now auto-migrate to SecureStorage on first load (same as slot 1); `notice-board.js` `n.type` field from DB now whitelist-sanitized via `Object.prototype.hasOwnProperty` before TYPE_CFG lookup; `exam.html` missing `i18n.js` + `loading-state.js` added; `certificates.js` `generateQRToken` uses `SUPABASE_CONFIG.client` getter (avoids frozen-ref race); `app.js` `logout()` guards `SyncEngine.stopAutoSync()` with `typeof` check; `salary.js` `data-salary` wrapped with explicit `String()` cast; bumped SW `DEPLOY_ID` to `20260606-security-audit-fixes` |
| 2026-06-03 | `_checkStudents()`: filter out DIAG-TEST-*/DIAG-INST-* records before duplicate student_id check (ran before `cleanupLeftovers()`); added actionable hint to "Inactive with due" warning; bumped SW `DEPLOY_ID` to `20260603-bugfix-12-verified` (cache bust → v4.9.5); `admin.html` + `certificate.html` audit fixes (C-2, C-3); `manifest.json` screenshot form_factor fix (S-2); `version.json` date sync (W-3) |
| 2026-05-23 | `exam.html` + secure-storage/session-store; `SUPABASE_CONFIG.client` getter; SW `DEPLOY_ID` bump; voice-assistant removed from precache; integrity manifest + visitor-form URL; admin i18n/loading-state; visitors XSS hardening |
| 2026-05-23 | XSS: certificates, command-palette, activity log; exam results REST upsert to `exams`; removed debug telemetry in `students.js`; loans/id-cards escaping |
| 2026-05-23 | XSS/escaping: dashboard, admin results, students/accounts/loans/hr-staff onclick `escAttr`; finance/loans/hr forms; Gemini keys SecureStorage-only; certificate.html local libs + SW precache |

---

## সংক্ষিপ্ত উত্তর: “অডিট কখন শেষ?”

- **সব warning শূন্য** — প্রায় কখনো না (স্ক্যানার প্যাটার্ন-ভিত্তিক)।
- **প্রকৃত অগ্রগতি** — একই Ignore আইটেম বারবার না আসা + সিঙ্ক/লগইন স্থির থাকা।  
  এই `AUDIT.md` + উপরের প্রম্পট ব্যবহার করলে দৈনিক রিপোর্ট **৫–১০টার নিচে** নামানো যায়।

---

*Maintainer: update “Changelog” when you fix audit-related regressions.*
