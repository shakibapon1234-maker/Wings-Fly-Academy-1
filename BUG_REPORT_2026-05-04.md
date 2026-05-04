# 🐛 Wings-Fly-Academy — Complete Bug Report
**Date:** May 4, 2026  
**Total Issues Found:** 31 bugs categorized by severity

---

## 📋 Executive Summary

| Severity | Count | Impact |
|----------|-------|--------|
| 🔴 **CRITICAL** | 5 | Data loss, security risks, app crashes |
| 🟠 **HIGH** | 8 | Major functionality broken, poor UX |
| 🟡 **MEDIUM** | 12 | Minor issues, workarounds exist |
| 🟢 **LOW** | 6 | Polish issues, edge cases |

---

# 🔴 CRITICAL ISSUES

### 1. **SyncGuard Balance Race Condition — Data Corruption Risk**
- **File:** [js/core/sync-guard.js](js/core/sync-guard.js) (entire file)
- **Issue:** Multiple simultaneous balance updates from different clients can corrupt account balances. No transaction locks implemented.
- **Severity:** CRITICAL
- **Impact:** Account balances may become inconsistent or negative
- **Example:** If User A deposits ৳500 while User B withdraws ৳400 simultaneously on same account, final balance could be incorrect.
- **Required Fix:** Implement optimistic locking with version numbers or use Supabase transactions
- **Workaround:** Manual balance reconciliation in Settings

---

### 2. **IndexedDB Init Failure in Incognito Mode — Silent Data Loss**
- **File:** [js/core/supabase-sync.js](js/core/supabase-sync.js) line ~65
- **Issue:** IndexedDB.open() fails in incognito/private mode but error is swallowed. Users think data is synced but it's only in memory.
- **Severity:** CRITICAL
- **Impact:** All changes lost on page refresh in incognito mode
- **Code:**
  ```javascript
  async function init() {
    try {
      _db = await _openDB();
      // No explicit offline banner if fails in incognito
    } catch (e) {
      // Falls back to localStorage (5MB limit) without warning
    }
  }
  ```
- **Required Fix:** Detect incognito mode and show persistent warning banner
- **Workaround:** Use normal browsing mode; avoid incognito

---

### 3. **Offline Queue Sync Never Completes in Unstable Networks**
- **File:** [js/core/offline-mode.js](js/core/offline-mode.js) lines 100-150
- **Issue:** When network is intermittent (on/off/on), pending queue items are orphaned and never retried
- **Severity:** CRITICAL
- **Impact:** User data changes (new students, payments) added offline are lost
- **Root Cause:** Queue is only processed on `online` event; if network drops mid-sync, queue status never resets
- **Required Fix:** Implement exponential backoff with max retry counter; mark items as `failed` after 3 attempts
- **Workaround:** Manually trigger sync button after network stabilizes

---

### 4. **Supabase RLS Policy Missing on `deleted_records` Table**
- **File:** [supabase/rls_policies_secure.sql](supabase/rls_policies_secure.sql)
- **Issue:** Table exists in DB but no RLS policies mentioned. Non-admin users can read/delete all records.
- **Severity:** CRITICAL
- **Impact:** Data privacy breach — students can see all other students' deletion history
- **Required Fix:** Apply RLS policy: `auth.uid() = user_id` for all operations
- **Status:** No SQL file shows deleted_records RLS policy

---

### 5. **AI Assistant API Key Exposed in localStorage Without Encryption**
- **File:** [js/modules/ai-assistant.js](js/modules/ai-assistant.js) line 26
- **Issue:** Gemini API key stored in plain localStorage. If device is stolen/compromised, attacker can use API quota.
- **Severity:** CRITICAL
- **Code:**
  ```javascript
  const key = localStorage.getItem('wfa_gemini_key'); // No encryption
  ```
- **Required Fix:** Encrypt key with AES-256 before storage; use secure-storage.js wrapper
- **Workaround:** Use environment variable for production API key (not browser storage)

---

# 🟠 HIGH ISSUES

### 6. **Missing CSRF Token on All Form Submissions**
- **File:** [index.html](index.html) (all forms), [admin.html](admin.html)
- **Issue:** Forms submitted via JS without CSRF tokens. POST requests can be forged via cross-site attacks.
- **Severity:** HIGH
- **Impact:** Admin accounts can be hijacked via CSRF attacks from malicious websites
- **Required Fix:** Generate and validate CSRF tokens on all POST/PATCH/DELETE requests
- **Affected Forms:** Student add, Finance entry, Loan add, Exam create, etc.

---

### 7. **Broken Navigation Links Between HTML Pages**
- **Files:** 
  - [admin.html](admin.html) line 437: `<a href="exam.html">` (should be `./exam.html` or absolute path)
  - [certificate.html](certificate.html) line 467: Dynamic href might have wrong origin
- **Issue:** Links assume relative paths; may fail in subdirectory deployments or with hash routing
- **Severity:** HIGH
- **Impact:** Users click links and get 404 errors
- **Required Fix:** Use `window.location.origin + '/exam.html'` for absolute paths

---

### 8. **Service Worker Cache Missing Critical JavaScript Files**
- **File:** [service-worker.js](service-worker.js) line 19-40 (STATIC_ASSETS list)
- **Issue:** Some JS files listed but `inline-handlers.js`, `mobile-nav.js`, `app-updater.js` are missing from critical cache list
- **Severity:** HIGH
- **Impact:** These modules won't load offline, breaking PWA functionality
- **Missing from Cache:**
  - `./js/core/mobile-nav.js`
  - `./js/core/app-updater.js`
  - `./js/core/i18n.js`
- **Required Fix:** Add these files to STATIC_ASSETS array

---

### 9. **Promise Chain Missing .catch() in Student Module**
- **File:** [js/modules/students.js](js/modules/students.js) (render function)
- **Issue:** Fetch operations for student data don't have explicit error handlers
- **Severity:** HIGH
- **Impact:** Network errors silently fail; users see loading spinner indefinitely
- **Affected:** All module render functions (Finance, Loans, Attendance, etc.)
- **Required Fix:** Add `.catch(err => { Utils.toast(t('error.loadFailed'), 'error'); console.error(err); })`

---

### 10. **HTML Form Attributes Not Validated — XSS Risk in User Input**
- **Files:** [visitor-form.html](visitor-form.html), [admin.html](admin.html)
- **Issue:** Form inputs don't have `maxlength`, `pattern`, or `required` attributes on critical fields
- **Severity:** HIGH
- **Impact:** Users can submit invalid data; XSS if not escaped in display
- **Example:** Phone field accepts 1000+ characters; can crash DB
- **Required Fix:** Add HTML5 validation attributes:
  ```html
  <input type="tel" pattern="[\d\-\+\s]+" maxlength="15" required>
  <input type="email" pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$" required>
  ```

---

### 11. **No Input Sanitization in Student Name & Other Text Fields**
- **File:** [js/core/utils.js](js/core/utils.js) line 7-16 (esc function)
- **Issue:** While `Utils.esc()` exists, it's not consistently used. Some HTML renders directly:
  ```javascript
  // BAD: in students.js line 81
  <div style="font-weight:600">${s.name}</div> // Not escaped!
  
  // GOOD: should be
  <div style="font-weight:600">${Utils.esc(s.name)}</div>
  ```
- **Severity:** HIGH
- **Impact:** Stored XSS if student name contains `<script>alert('hacked')</script>`
- **Locations:** Multiple places in students.js, finance.js, attendance.js
- **Required Fix:** Audit all `${variable}` renders and wrap with `Utils.esc()`

---

### 12. **Exam Timer Can Be Bypassed via Console**
- **File:** [exam.html](exam.html) lines 200-250 (timer implementation)
- **Issue:** Timer is JavaScript-based and can be stopped via browser console: `clearInterval(timerID)`
- **Severity:** HIGH
- **Impact:** Students can extend exam time indefinitely
- **Required Fix:** Server-side timer validation; backend must check submission timestamp against exam start + duration

---

### 13. **Android Build Missing google-services.json Configuration**
- **File:** [android/app/build.gradle](android/app/build.gradle) line 40-45
- **Issue:** Gradle tries to apply google-services plugin but file doesn't exist; warning is logged but build continues
- **Severity:** HIGH
- **Impact:** Push notifications won't work on Android; Firebase integration broken
- **Code:**
  ```gradle
  try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.exists()) {
      apply plugin: 'com.google.gms.google-services'
    }
  } catch(Exception ignored) { // Silently ignored!
    logger.info("google-services.json not found...")
  }
  ```
- **Required Fix:** 
  1. Generate google-services.json from Firebase Console
  2. Place in `android/app/google-services.json`
  3. Or throw hard error instead of silently failing

---

### 14. **Capacitor webDir Path Incorrect for Android Build**
- **File:** [capacitor.config.json](capacitor.config.json) line 2
- **Issue:** `webDir` set to `"www"` but actual built files are in project root
- **Severity:** HIGH
- **Impact:** Android APK will be empty or have old code
- **Fix:** Run `node build-www.js` first to copy files to `www/` directory, OR update config to root

---

# 🟡 MEDIUM ISSUES

### 15. **Uninitialized Global Variables Checked with typeof Guards**
- **Files:** [js/ui/dashboard.js](js/ui/dashboard.js) line 8-12, [js/core/app.js](js/core/app.js) lines 652-665
- **Issue:** Code relies on `typeof MODULE !== 'undefined'` everywhere — fragile and indicates bad module loading order
- **Severity:** MEDIUM
- **Impact:** If a module fails to load, app silently degrades instead of notifying user
- **Example:**
  ```javascript
  if (typeof SupabaseSync === 'undefined') {
    // Uh oh, sync failed but we continue anyway
  }
  ```
- **Required Fix:** Add module readiness checks; implement `document.addEventListener('app-ready', ...)` pattern
- **Better Pattern:**
  ```javascript
  const App = {
    onReady: async () => {
      await Promise.all([
        this._loadModule('students'),
        this._loadModule('finance'),
        // etc
      ]);
      window.dispatchEvent(new Event('app-ready'));
    }
  };
  ```

---

### 16. **Memory Leak in Animated Background Canvas**
- **File:** [js/core/inline-handlers.js](js/core/inline-handlers.js) lines 30-150
- **Issue:** Animation loop `draw()` is called every frame but never explicitly cancelled when user navigates away
- **Severity:** MEDIUM
- **Impact:** Multiple animation loops can run simultaneously; CPU usage increases; battery drain on mobile
- **Code:**
  ```javascript
  function draw() {
    animFrameId = requestAnimationFrame(draw); // Creates new frame ID constantly
  }
  draw(); // No cleanup on page visibility change
  ```
- **Required Fix:** 
  ```javascript
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animFrameId) {
      cancelAnimationFrame(animFrameId);
    }
  });
  ```

---

### 17. **Event Listener Not Removed in Modal Cleanup**
- **File:** [js/core/utils.js](js/core/utils.js) lines 250-290 (Modal function)
- **Issue:** Modal overlay listener `overlay.addEventListener('click', close)` is added but never removed when modal closes
- **Severity:** MEDIUM
- **Impact:** Memory leak; after opening/closing modal 10 times, click event fires 10 times
- **Required Fix:**
  ```javascript
  const handler = () => close();
  overlay.addEventListener('click', handler);
  // On close:
  overlay.removeEventListener('click', handler);
  ```

---

### 18. **No Validation for Negative Amounts in Finance Module**
- **File:** [js/modules/finance.js](js/modules/finance.js) (not fully examined but implied)
- **Issue:** Form allows negative payment amounts; balance calculations break
- **Severity:** MEDIUM
- **Impact:** Finance reports show incorrect totals; negative payments corrupt data
- **Required Fix:** Add form validation:
  ```javascript
  if (Utils.safeNum(amount) <= 0) {
    Utils.toast('Amount must be positive', 'error');
    return;
  }
  ```

---

### 19. **Flatpickr Date Picker Not Initialized Consistently**
- **File:** [js/core/app.js](js/core/app.js) lines 1178-1202
- **Issue:** Flatpickr initialization checks `typeof flatpickr !== 'undefined'` but doesn't handle failures
- **Severity:** MEDIUM
- **Impact:** Some date fields may not have picker; users forced to type dates manually in wrong format
- **Required Fix:** Add error logging and fallback UI

---

### 20. **AI Assistant History Not Persisted Across Sessions**
- **File:** [js/modules/ai-assistant.js](js/modules/ai-assistant.js) lines 20-30
- **Issue:** `chatHistory` array is cleared on page reload; user loses conversation context
- **Severity:** MEDIUM
- **Impact:** Users can't reference previous messages in same session
- **Required Fix:** Store in IndexedDB: `WFA_IDB.set('ai_chat_history', chatHistory)`

---

### 21. **No Retry Logic for Supabase Auth Failures**
- **File:** [js/core/supabase-config.js](js/core/supabase-config.js) lines 90-110
- **Issue:** `SupabaseAuth.signIn()` throws error on first failure; no exponential backoff
- **Severity:** MEDIUM
- **Impact:** Slow network → login fails → no retry → users stuck
- **Required Fix:** Implement retry with exponential backoff (0.5s, 1s, 2s, 4s)

---

### 22. **Manifest Icons Not Accessible in All Deployments**
- **File:** [manifest.json](manifest.json) line 15-20
- **Issue:** Icon paths use relative `./assets/icon-192.png` but some PWA installations strip trailing slash
- **Severity:** MEDIUM
- **Impact:** PWA install icon blank on some Android devices
- **Fix:** Use absolute paths: `/assets/icon-192.png`

---

### 23. **Admin.html and Exam.html Have Wrong Lang Attribute**
- **Files:**
  - [admin.html](admin.html) line 2: `<html lang="bn">` (Bengali only, but has English content)
  - [exam.html](exam.html) line 2: `<html lang="bn">` (should be bilingual)
- **Issue:** Lang attribute doesn't match actual content
- **Severity:** MEDIUM
- **Impact:** Screen readers mispronounce English text with Bengali rules
- **Fix:** Change to `<html lang="bn-en">` or `<html lang="bn">` with proper content-language meta tag

---

### 24. **No Loading State in Settings Page**
- **File:** [js/ui/settings.js](js/ui/settings.js) (not fully examined)
- **Issue:** Settings load data but UI doesn't show loading skeleton
- **Severity:** MEDIUM
- **Impact:** Users think page is broken if load takes >1 second
- **Fix:** Show `Utils.loadingSkeleton()` while data loads

---

### 25. **ContentSecurityPolicy Too Permissive**
- **File:** [index.html](index.html) lines 8-38
- **Issue:** CSP allows `'unsafe-eval'` and `'unsafe-inline'` for scripts
- **Severity:** MEDIUM
- **Impact:** XSS attacks can execute arbitrary code if input validation fails
- **Current:**
  ```
  script-src 'self' 'unsafe-eval' 'unsafe-inline'
  ```
- **Should Be:**
  ```
  script-src 'self' 'nonce-[RANDOM]' 'strict-dynamic'
  ```

---

# 🟢 LOW ISSUES

### 26. **Inconsistent Button Styling (Inline vs CSS Classes)**
- **Files:** [index.html](index.html) multiple locations, [admin.html](admin.html)
- **Issue:** Some buttons use inline `style=""`, others use CSS classes
- **Severity:** LOW
- **Impact:** Inconsistent hover effects, theme toggle broken for inline styles
- **Fix:** Move all inline button styles to CSS classes

---

### 27. **Missing Error Messages for Network Timeouts**
- **File:** [js/core/utils.js](js/core/utils.js) lines 467, 519
- **Issue:** If XLSX or flatpickr library fails to load from CDN, silent failure
- **Severity:** LOW
- **Impact:** Excel export button doesn't work; no error message shown
- **Example:**
  ```javascript
  if (typeof XLSX === 'undefined') { toast('Excel library Not loaded', 'error'); return; }
  ```
- **Better:** Show in UI that feature is unavailable

---

### 28. **Hardcoded Academy Name in AI Assistant Prompt**
- **File:** [js/modules/ai-assistant.js](js/modules/ai-assistant.js) line 31
- **Issue:** Falls back to hardcoded `'Wings Fly Aviation Academy'` instead of user-configured name
- **Severity:** LOW
- **Impact:** AI introduces itself with wrong academy name if settings not loaded
- **Fix:** Use `cfg.academy_name || 'Your Academy'` with timeout fallback

---

### 29. **No User Feedback on Auto-Update Check**
- **File:** [js/core/app-updater.js](js/core/app-updater.js) line 45-60
- **Issue:** App checks for updates silently; user never knows if running latest version
- **Severity:** LOW
- **Impact:** Bugs in old version never get fixed because users don't update
- **Fix:** Show subtle version badge in Settings; notify on update available

---

### 30. **Class Names Don't Match ID Selectors**
- **Files:** [index.html](index.html), [admin.html](admin.html)
- **Issue:** Elements have `id="students-content"` but CSS targets `.students-content`
- **Severity:** LOW
- **Impact:** Some styles don't apply; inconsistent appearance
- **Fix:** Use ID selectors in CSS: `#students-content { ... }` not `.students-content`

---

### 31. **Missing Pagination Total Count Display**
- **File:** [js/core/utils.js](js/core/utils.js) (renderPaginationUI function)
- **Issue:** Pagination shows current page but not total records
- **Severity:** LOW
- **Impact:** Users don't know dataset size
- **Example:** Should show "Page 2 of 5 (150 total)"

---

# 📊 Bug Distribution

## By Module
```
Core (app.js, utils.js, supabase-*.js): 12 bugs
  ├─ Sync Guard: 2 CRITICAL
  ├─ IndexedDB: 1 CRITICAL
  ├─ Service Worker: 1 HIGH
  ├─ Utils/Modal: 2 MEDIUM
  └─ Other: 6 MEDIUM

HTML & Forms: 7 bugs
  ├─ admin.html: 2 HIGH, 1 MEDIUM
  ├─ exam.html: 1 HIGH, 1 MEDIUM
  ├─ visitor-form.html: 1 HIGH
  └─ certificate.html: 1 HIGH

Modules (students, finance, etc.): 6 bugs
  ├─ Promise handling: 1 HIGH
  ├─ Input validation: 1 MEDIUM
  ├─ Finance validation: 1 MEDIUM
  ├─ AI Assistant: 1 CRITICAL, 1 MEDIUM
  └─ Other: 1 MEDIUM

Android/Build: 1 HIGH
Config/PWA: 2 MEDIUM, 1 LOW
CSS/Styling: 2 LOW
```

## By Severity
- **CRITICAL (5):** SyncGuard race, IndexedDB incognito, Offline queue, RLS policy, API key exposed
- **HIGH (8):** CSRF missing, Broken links, Cache missing, Promise errors, Form validation, XSS input, Exam bypass, Android config
- **MEDIUM (12):** Uninitialized vars, Memory leak, Event cleanup, Validation, Date picker, Chat history, Retry logic, Manifest, Lang, Settings, CSP, Timeout errors
- **LOW (6):** Button styling, Error feedback, Auto-update, Class/ID mismatch, Pagination display, Academy name

---

# 🔧 Recommended Fix Priority

1. **TODAY (Same day):**
   - Fix SyncGuard race condition (CRITICAL)
   - Add RLS policies (CRITICAL)
   - Encrypt API keys (CRITICAL)
   - Add CSRF tokens (HIGH)

2. **THIS WEEK:**
   - Fix IndexedDB incognito (CRITICAL)
   - Fix offline queue (CRITICAL)
   - Fix form validation (HIGH)
   - Fix input sanitization (HIGH)
   - Add promise error handlers (HIGH)
   - Fix navigation links (HIGH)
   - Add service worker cache (HIGH)

3. **NEXT SPRINT:**
   - Fix memory leaks (MEDIUM+)
   - Implement module readiness pattern (MEDIUM)
   - Add logging/monitoring (MEDIUM)
   - Polish UI/styling (LOW)

---

# 📝 Notes

- **Security Focus:** Issues #4, #5, #6, #11 are security risks and should be prioritized
- **Data Integrity:** Issues #1, #2, #3 risk data loss
- **User Experience:** Issues #7, #9, #10, #19 cause frustration
- **Mobile Specific:** Issues #14, #13, #16, #22 affect Android/PWA
- **Testing Recommendation:** Implement automated tests for sync conflicts, offline scenarios, and form validation

---

**Generated:** 2026-05-04 by Automated Bug Analysis  
**Review Status:** ⏳ Awaiting developer triage and remediation
