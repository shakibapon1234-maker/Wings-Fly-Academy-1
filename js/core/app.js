// ============================================================
// Wings Fly Aviation Academy — Main App (Tab Switching & Init)
// ============================================================

// Production: silence verbose logs unless debug mode is enabled
(function() {
  const isDev = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
  let debugLogs = isDev;
  try {
    debugLogs = debugLogs
      || localStorage.getItem('wfa_debug_logs') === '1'
      || new URLSearchParams(location.search).has('wfa_debug');
  } catch { /* private mode / blocked storage */ }
  if (!debugLogs) {
    const _noop = () => {};
    console.log   = _noop;
    console.debug = _noop;
    console.info  = _noop;
  }
  window.__WFA_DEV__ = isDev || debugLogs;
})();

// ✅ Fix #3: Merged CJK-translation + stabilization into ONE IIFE with shared listeners.
// Previously 2 IIFEs each registered window.addEventListener('error') and
// window.addEventListener('unhandledrejection') — totalling 4 listeners and
// causing double-toast for every error. Now only 1 error + 1 unhandledrejection listener.
(function() {
  // Extended dictionary: 40+ Chinese browser/Supabase error strings → Bengali
  const chineseTobengali = {
    // Storage
    '已取消': 'বাতিল করা হয়েছে', '存储': 'স্টোরেজ', '配额': 'কোটা',
    '超出': 'অতিক্রম করেছে', '容量超限': 'স্টোরেজ সীমা পার হয়েছে', '内存不足': 'মেমোরি সীমিত',
    // Network
    '网络': 'নেটওয়ার্ক', '连接': 'সংযোগ', '连接失败': 'সংযোগ বিচ্ছিন্ন',
    '请求失败': 'অনুরোধ বিফল', '超时': 'টাইমআউট', '新建连接': 'নতুন সংযোগ',
    // General errors
    '失败': 'ব্যর্থ', '错误': 'ত্রুটি', '警告': 'সতর্কতা', '异常': 'অসঙ্গতি', '未知错误': 'অজানা ত্রুটি',
    // Data
    '数据': 'ডেটা', '同步': 'সিঙ্ক', '加载': 'লোডিং', '保存': 'সেভ',
    '删除': 'মুছে ফেলা', '更新': 'আপডেট', '查询': 'অনুসন্ধান', '排列': 'সাজানো', '过滤': 'ফিল্টার',
    // Auth
    '未授权': 'অনুমতি নেই', '登录': 'লগইন', '登出': 'লগআউট',
    '密码': 'পাসওয়ার্ড', '用户': 'ব্যবহারকারী', '权限': 'অনুমতি',
    // UI
    '打开': 'খুলুন', '关闭': 'বন্ধ করুন', '取消': 'বাতিল',
    '确认': 'নিশ্চিত', '提交': 'জমা দিন', '重试': 'আবার চেষ্টা',
  };

  const isCJK = (text) => /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\u30A0-\u30FF\u3040-\u309F]/.test(text);

  const translateChinese = (text) => {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    for (const [cn, bn] of Object.entries(chineseTobengali)) {
      result = result.replace(new RegExp(cn, 'g'), bn);
    }
    if (isCJK(result)) {
      result = result.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\u30A0-\u30FF\u3040-\u309F]+/g, '[non-latin]');
    }
    return result;
  };
  window._translateChinese = translateChinese;

  // ── Stabilization: rate-limited error toast ────────────────
  let lastUiErrorAt = 0;
  function _notify(errLike) {
    const now = Date.now();
    if (now - lastUiErrorAt < 3000) return;
    lastUiErrorAt = now;
    const msg = (errLike && errLike.message) ? errLike.message : String(errLike || 'Unknown error');
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(`Unexpected error: ${msg}`, 'error', 5000);
    }
  }

  // ── Single 'error' listener ────────────────────────────────
  window.addEventListener('error', (event) => {
    const msgStr = event?.message || '';
    // CJK translation
    if (isCJK(msgStr)) {
      const translated = translateChinese(msgStr);
      if (window.__WFA_DEV__) console.warn('[Translation] CJK error → Bengali:', translated);
    }
    // Stabilization toast
    const err = event?.error || event?.message;
    if (err) _notify(err);
  });

  // ── Single 'unhandledrejection' listener ───────────────────
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const reasonStr = String(reason?.message || reason || '');
    // CJK translation
    if (isCJK(reasonStr)) {
      const translated = translateChinese(reasonStr);
      if (window.__WFA_DEV__) console.warn('[Translation] CJK rejection → Bengali:', translated);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(translated, 'warning', 5000);
      }
      return; // Already toasted as CJK — skip generic stabilization toast
    }
    // Stabilization toast for non-CJK rejections
    _notify(reason || 'Unhandled promise rejection');
  });
})();

const App = (() => {

  const SECTIONS = [
    'dashboard', 'students', 'finance', 'accounts', 'loans',
    'exam', 'attendance', 'salary', 'hr-staff',
    'visitors', 'id-cards', 'certificates', 'notice-board', 'payment-requests',
    'routine-builder', 'school-classes', 'subject-marks', 'result-sheet', 'settings'
  ];

  // ── SHA-256 password hashing (settings.js এর মতো একই logic) ──────────
  async function _hashPw(pw) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {
      // ✅ Bug #8 Fix: Stronger HTTP-only fallback — FNV-1a 32-bit with 3 rounds + salt
      // (crypto.subtle unavailable on HTTP — production uses SHA-256 above)
      const salt = 'wfa_2026_';
      const salted = salt + pw + pw.length.toString(16);
      let h = 0x811c9dc5; // FNV offset basis
      for (let round = 0; round < 3; round++) {
        const input = round === 0 ? salted : salted + (h >>> 0).toString(16);
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 0x01000193); // FNV prime
        }
      }
      const h1 = (h >>> 0).toString(16).padStart(8, '0');
      const h2 = ((h >>> 0) ^ 0x9e3779b9 >>> 0).toString(16).padStart(8, '0');
      return 'fb_' + h1 + h2;
    }
  }

  const _isHashedPw = (s) => /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');

  /** Upgrade legacy plaintext admin_password to hash without comparing plaintext at login. */
  async function _ensureHashedAdminPassword(settings) {
    const pw = settings?.admin_password;
    if (!pw || _isHashedPw(pw)) return pw;
    const upgradedHash = await _hashPw(pw);
    settings.admin_password = upgradedHash;
    if (settings.id) {
      SupabaseSync.update(DB.settings, settings.id, settings, { bypassLog: true });
    } else {
      settings.id = SupabaseSync.generateId();
      SupabaseSync.insert(DB.settings, settings, { bypassLog: true });
    }
    return upgradedHash;
  }

  const TITLES = {
    dashboard:      'Welcome back, Admin!',
    students:       '👩‍🎓 Students',
    finance:        '💰 Finance Ledger',
    accounts:       '🏦 Accounts',
    loans:          '💳 Loans',
    exam:           '📝 Exams',
    attendance:     '📋 Attendance',
    salary:         '💵 Salary Hub',
    'hr-staff':     '👥 HR / Staff',
    visitors:       '🚶 Visitors',
    'id-cards':     '🪪 ID Cards',
    certificates:   '🏆 Certificates',
    'notice-board': '📢 Notice Board',
    'payment-requests': '💳 Payment Requests',
    'routine-builder':  '📅 Class Routine',
    'school-classes':   '🏫 Class & Section',
    'subject-marks':    '📝 Subject & Marks',
    'result-sheet':     '📊 Result Sheet',
    settings:       '⚙️ Settings',
  };

  let currentSection = 'dashboard';

  // ── Auth ───────────────────────────────────────────────────
  const MAX_LOGIN_ATTEMPTS  = 5;
  const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  function isLoggedIn() {
    if (window.SessionStore) return SessionStore.isLoggedIn();
    return localStorage.getItem('wfa_logged_in') === 'true';
  }

  function getSubAccounts() {
    try {
      if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        const idbRows = SupabaseSync.getAll(DB.sub_accounts || 'sub_accounts');
        if (idbRows && idbRows.length > 0) return idbRows;
      }
    } catch { /* fall through */ }
    try {
      const legacy = JSON.parse(localStorage.getItem('wfa_sub_accounts') || '[]');
      if (legacy.length > 0 && typeof SupabaseSync !== 'undefined') {
        SupabaseSync.setAll('sub_accounts', legacy);
        localStorage.removeItem('wfa_sub_accounts');
        return legacy;
      }
    } catch { /* ignore */ }
    return [];
  }

  function isAdmin() {
    if (window.SessionStore) return SessionStore.isAdmin();
    return localStorage.getItem('wfa_user_role') === 'admin';
  }

  function getUserPermissions() {
    if (window.SessionStore) return SessionStore.getPermissions();
    try {
      return JSON.parse(localStorage.getItem('wfa_user_permissions') || '[]');
    } catch {
      return [];
    }
  }

  function hasPermission(section) {
    if (isAdmin()) return true;

    const permissions = getUserPermissions();
    if (permissions.includes('*')) return true;

    // ✅ Fix: সব ট্যাব এখানে map করা — map-এ না থাকলে sub-account সেটা দেখতে পেত (ফাঁকফোকর)
    const map = {
      students:       'Students',
      finance:        'Finance/Ledger',
      accounts:       'Accounts',
      loans:          'Loans',
      exam:           'Exams',
      'hr-staff':     'HR / Staff',
      salary:         'Salary Hub',
      visitors:       'Visitors',
      attendance:     'Attendance',
      'id-cards':     'ID Cards',
      certificates:   'Certificates',
      'notice-board': 'Notice Board',
      'payment-requests': 'Payment Requests',
      'routine-builder':  'Class Routine',
      'school-classes':   'Students',
      'subject-marks':    'Students',
      'result-sheet':     'Students',
      settings:       'Settings',
      // dashboard সবসময় দেখা যাবে
      // settings শুধু admin দেখবে (navigateTo()-এ আলাদা block আছে)
    };

    // dashboard সব sub-account দেখতে পাবে
    if (section === 'dashboard') return true;

    const required = map[section];
    // map-এ আছে কিন্তু permission নেই → deny
    if (required !== undefined) return permissions.includes(required);

    // map-এ নেই (unknown section) → deny by default (secure)
    return false;
  }

  async function login(username, password) {
    // ✅ Bug #5: Rate limiting — block after 5 failed attempts for 10 minutes
    // ✅ Fix C-01: Also check sessionStorage so localStorage.clear() in DevTools can't bypass
    const attemptKey   = 'wfa_login_attempts';
    const lockoutKey   = 'wfa_login_lockout_until';
    const now          = Date.now();
    const lockoutLS  = parseInt(localStorage.getItem(lockoutKey) || '0');
    const lockoutSS  = parseInt(sessionStorage.getItem(lockoutKey) || '0');
    const lockoutUntil = Math.max(lockoutLS, lockoutSS); // both must expire

    if (lockoutUntil && now < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - now) / 60000);
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = `Too many failed attempts. Try again in ${remaining} minute(s).`;
        errEl.classList.remove('hidden');
      }
      return false;
    }

    // ✅ Fix #1: auto-cleanup duplicate settings rows before reading
    // Prevents login failure when admin_password is in row[1] instead of row[0]
    const rawList = SupabaseSync.getAll(DB.settings);
    if (rawList.length > 1) cleanupDuplicateSettings();
    const settingsList = SupabaseSync.getAll(DB.settings);
    // Prefer the row that has admin_password set (guards against partial duplicates)
    const settings = settingsList.find(s => s.admin_password) || settingsList[0] || {};
    const normalizedUsername = String(username || '').trim();


    // ── Admin login ──────────────────────────────────────────
    if (normalizedUsername === 'admin' || normalizedUsername === '') {
      let adminOk;
      let hashedStoredPw = await _ensureHashedAdminPassword(settings);

      if (!hashedStoredPw) {
        // ✅ Security Fix v2: Before allowing first-time setup bypass, ALWAYS try to
        // fetch settings directly from Supabase. This prevents the race condition in
        // incognito/new browsers where IDB is empty but the account already exists.
        if (window.supabaseClient) {
          try {
            const { data: remoteSettings, error: remoteErr } = await window.supabaseClient
              .from('settings')
              .select('admin_password,id')
              .limit(1)
              .maybeSingle();

            if (!remoteErr && remoteSettings && remoteSettings.admin_password) {
              // Found password in Supabase — use it for verification
              const remotePw = remoteSettings.admin_password;
              const remoteHashed = _isHashedPw(remotePw) ? remotePw : await _hashPw(remotePw);
              const inputHash = await _hashPw(password);
              adminOk = inputHash === remoteHashed;

              if (adminOk) {
                // Cache into local settings for this session
                settings.admin_password = remoteHashed;
                settings.id = remoteSettings.id || settings.id;
              } else {
                // Wrong password — block immediately, do NOT fall through to first-time setup
                const errEl = document.getElementById('login-error');
                if (errEl) {
                  errEl.textContent = 'Incorrect password.';
                  errEl.classList.remove('hidden');
                  errEl.style.display = 'block';
                }
                return false;
              }
            } else if (!remoteErr && !remoteSettings) {
              // No settings row at all in Supabase — genuine first-time setup is OK
              adminOk = !!password;
              if (adminOk) {
                const newHash = await _hashPw(password);
                settings.admin_password = newHash;
                if (settings.id) {
                  SupabaseSync.update(DB.settings, settings.id, settings, { bypassLog: true });
                } else {
                  settings.id = SupabaseSync.generateId();
                  SupabaseSync.insert(DB.settings, settings, { bypassLog: true });
                }
              }
            } else {
              // Supabase error or offline — block login, do NOT allow bypass
              const retryKey = '_loginRetryCount';
              window[retryKey] = (window[retryKey] || 0) + 1;
              const waitSec = Math.min(5 * window[retryKey], 30);
              const errEl = document.getElementById('login-error');
              if (errEl) {
                errEl.innerHTML = `⏳ Cloud sync চলছে… ${waitSec} সেকেন্ড পর আবার চেষ্টা করুন। <br><small style="color:#aaa">(Attempt ${window[retryKey]})</small>`;
                errEl.style.display = 'block';
              }
              return 'pending';
            }
          } catch (fetchErr) {
            console.warn('[Login] Supabase settings fetch failed:', fetchErr.message);
            // Network error — block login safely
            const errEl = document.getElementById('login-error');
            if (errEl) {
              errEl.innerHTML = `⏳ ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ চেক করে আবার চেষ্টা করুন।`;
              errEl.style.display = 'block';
            }
            return 'pending';
          }
        } else {
          // No Supabase client available at all — only allow if literally zero data anywhere
          const hasAnyData =
            (SupabaseSync.getAll(DB.students   ).length > 0) ||
            (SupabaseSync.getAll(DB.finance    ).length > 0) ||
            (SupabaseSync.getAll(DB.sub_accounts || 'sub_accounts').length > 0);

          if (hasAnyData) {
            const retryKey = '_loginRetryCount';
            window[retryKey] = (window[retryKey] || 0) + 1;
            const waitSec = Math.min(5 * window[retryKey], 30);
            const errEl = document.getElementById('login-error');
            if (errEl) {
              errEl.innerHTML = `⏳ Cloud settings loading… Please wait ${waitSec}s and try again. <br><small style="color:#aaa">(Attempt ${window[retryKey]})</small>`;
              errEl.style.display = 'block';
            }
            return 'pending';
          }

          // Genuine first-time setup (no Supabase, no local data)
          adminOk = !!password;
          if (adminOk) {
            const newHash = await _hashPw(password);
            settings.admin_password = newHash;
            if (settings.id) {
              SupabaseSync.update(DB.settings, settings.id, settings, { bypassLog: true });
            } else {
              settings.id = SupabaseSync.generateId();
              SupabaseSync.insert(DB.settings, settings, { bypassLog: true });
            }
          }
        }
      } else {
        const inputHash = await _hashPw(password);
        adminOk = inputHash === hashedStoredPw;
      }

      if (adminOk) {
        // ✅ Bug #5 + Fix C-01: Reset attempt counter in both storages
        localStorage.removeItem(attemptKey);
        localStorage.removeItem('wfa_login_lockout_until');
        sessionStorage.removeItem('wfa_login_lockout_until');
        if (window.SessionStore) SessionStore.setAdminSession();
        else {
          localStorage.setItem('wfa_logged_in', 'true');
          localStorage.setItem('wfa_login_time', String(Date.now()));
          localStorage.setItem('wfa_user_role', 'admin');
          localStorage.setItem('wfa_user_name', 'admin');
          localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
        }
        showApp(true);
        return true;
      }
      
      // Prevent login fall-through to sub-accounts if username is 'admin' but password is wrong
      return false;
    }

    if (!normalizedUsername) return false;

    // ── Sub-account login: hashed password compare ────────────────────
    const inputHash = await _hashPw(password);

    // ✅ Fix: নতুন browser বা incognito-তে IDB খালি থাকে, তাই Supabase থেকেও fetch করো
    let subAccounts = getSubAccounts();

    // যদি local-এ কোনো sub account না থাকে এবং Supabase client আছে,
    // তাহলে Supabase থেকে directly fetch করো
    if (subAccounts.length === 0 && window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('sub_accounts')
          .select('id,username,password,permissions')
          .eq('username', normalizedUsername)
          .limit(1);
        if (!error && data && data.length > 0) {
          subAccounts = data;
          // Local cache-এও save করো যাতে পরে কাজে লাগে
          try {
            if (typeof SupabaseSync !== 'undefined') {
              const existing = SupabaseSync.getAll(DB.sub_accounts || 'sub_accounts') || [];
              const merged = [...existing];
              data.forEach(row => {
                if (!merged.find(r => r.id === row.id)) merged.push(row);
              });
              SupabaseSync.setAll(DB.sub_accounts || 'sub_accounts', merged);
            }
          } catch { /* ignore cache error */ }
        }
      } catch { /* offline বা Supabase unavailable — local-only তেই চলো */ }
    }

    const sub = subAccounts.find((s) => {
      if (s.username !== normalizedUsername) return false;
      const isHashed = /^[0-9a-f]{64}$/.test(s.password) || s.password?.startsWith('fb_');
      return isHashed ? s.password === inputHash : s.password === password;
    });

    if (sub) {
      // ✅ Bug #5 + Fix C-01: Reset attempt counter in both storages
      localStorage.removeItem(attemptKey);
      localStorage.removeItem('wfa_login_lockout_until');
      sessionStorage.removeItem('wfa_login_lockout_until');
      if (window.SessionStore) {
        SessionStore.setSubSession(sub.username, sub.permissions || []);
      } else {
        localStorage.setItem('wfa_logged_in', 'true');
        localStorage.setItem('wfa_login_time', String(Date.now()));
        localStorage.setItem('wfa_user_role', 'subaccount');
        localStorage.setItem('wfa_user_name', sub.username);
        localStorage.setItem('wfa_user_permissions', JSON.stringify(sub.permissions || []));
      }
      showApp(true);
      return true;
    }

    return false;
  }

  // ── Emergency Password Reset (console only) ────────────────────────
  // Usage: App.resetAdminPassword('newPassword')
  // ✅ Security fix #2: now requires security question answer to prevent DevTools abuse
  async function resetAdminPassword(newPassword) {
    // 🆕 BUG #6 FIX: Rate limiting to prevent brute force
    const resetAttemptKey = 'wfa_reset_attempts';
    const resetTimeoutKey = 'wfa_reset_timeout_until';
    
    const now = Date.now();
    // ✅ SECURITY FIX: Check BOTH localStorage AND sessionStorage so DevTools localStorage.clear()
    // cannot bypass the lockout. Both must expire before the user can try again.
    const timeoutLS = parseInt(localStorage.getItem(resetTimeoutKey) || '0');
    const timeoutSS = parseInt(sessionStorage.getItem(resetTimeoutKey) || '0');
    const timeoutUntil = Math.max(timeoutLS, timeoutSS);
    
    if (now < timeoutUntil) {
      const waitSeconds = Math.ceil((timeoutUntil - now) / 1000);
      const msg = `❌ Too many failed attempts. Wait ${waitSeconds} seconds before trying again.`;
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(msg, 'error', 5000);
      }
      console.error('[Auth]', msg);
      return false;
    }

    if (!newPassword || newPassword.length < 8) {
      console.error('[Auth] Password must be at least 8 characters');
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('❌ Password must be at least 8 characters.', 'error', 4000);
      }
      return false;
    }
    // Require security answer verification before allowing password reset
    const settingsList = SupabaseSync.getAll(DB.settings);
    const settings = settingsList[0] || {};
    const question = settings.security_question || 'Security Question';
    const correctAnswer = (settings.security_answer || '').toLowerCase().trim();

    if (!correctAnswer) {
      console.error('[Auth] ❌ No security answer configured — password reset blocked for safety. Configure a security question in Settings first.');
      return false;
    }
    
    // 🆕 BUG #6 FIX: Use safer modal instead of prompt
    const givenAnswer = await _showSecurityModal(question);
    
    if (!givenAnswer || givenAnswer.toLowerCase().trim() !== correctAnswer) {
      // 🆕 BUG #6 FIX: Track failed attempts
      const attempts = parseInt(localStorage.getItem(resetAttemptKey) || '0') + 1;
      localStorage.setItem(resetAttemptKey, attempts.toString());
      
      if (attempts >= 3) {
        // Lock out for 15 minutes — stored in BOTH storages to prevent DevTools bypass
        const lockoutTime = 15 * 60 * 1000;
        const lockoutExpiry = (Date.now() + lockoutTime).toString();
        localStorage.setItem(resetTimeoutKey, lockoutExpiry);
        sessionStorage.setItem(resetTimeoutKey, lockoutExpiry);
        console.error('[Auth] ❌ Too many failed attempts (3). Locked for 15 minutes.');
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast('❌ Too many failed attempts. Account locked for 15 minutes.', 'error', 5000);
        }
        return false;
      }
      
      console.error(`[Auth] ❌ Incorrect security answer. Attempt ${attempts} of 3`);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`❌ Incorrect answer. Attempt ${attempts} of 3`, 'error', 3000);
      }
      return false;
    }

    // ✅ SECURITY FIX: Clear attempts from both storages on success
    localStorage.removeItem(resetAttemptKey);
    localStorage.removeItem(resetTimeoutKey);
    sessionStorage.removeItem(resetTimeoutKey);

    // Cleanup duplicates first, then reset
    cleanupDuplicateSettings();
    const freshList = SupabaseSync.getAll(DB.settings);
    const fresh = freshList[0] || {};
    const newHash = await _hashPw(newPassword);
    fresh.admin_password = newHash;
    if (fresh.id) {
      SupabaseSync.update(DB.settings, fresh.id, fresh, { bypassLog: true });
    } else {
      fresh.id = SupabaseSync.generateId();
      SupabaseSync.insert(DB.settings, fresh, { bypassLog: true });
    }
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('✅ Password reset successful! Please login again.', 'success', 3000);
    }
    return true;
  }

  // 🔒 BUG #3 FIX: Secure modal — resolve kept in closure, NOT on window
  function _showSecurityModal(question) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'security-modal-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;';

      const modal = document.createElement('div');
      modal.style.cssText = 'background:#1a1a2e;border:1px solid #00d4ff;border-radius:12px;padding:24px;max-width:400px;color:#fff;text-align:center;box-shadow:0 0 20px rgba(0,212,255,0.3);';
      modal.innerHTML = `
        <h3 style="color:#00d4ff;margin:0 0 16px 0;font-size:1.2em;">🔒 Security Verification</h3>
        <p style="margin:0 0 12px 0;font-size:0.95em;">${Utils.esc ? Utils.esc(question) : question}</p>
        <input type="text" id="security-answer-input" placeholder="Your answer"
          style="width:100%;padding:10px;margin:12px 0;border:1px solid #00d4ff;border-radius:6px;background:#0f0f1e;color:#fff;font-size:0.95em;box-sizing:border-box;" />
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button id="security-cancel-btn"
            style="padding:10px 16px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Cancel</button>
          <button id="security-verify-btn"
            style="padding:10px 16px;background:#00d4ff;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Verify</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // ✅ resolve stays in closure — console cannot call window._securityResolve anymore
      function _close() {
        const el = document.getElementById('security-modal-overlay');
        if (el) el.remove();
      }

      document.getElementById('security-cancel-btn').addEventListener('click', () => {
        _close(); resolve('');
      });

      document.getElementById('security-verify-btn').addEventListener('click', () => {
        const ans = (document.getElementById('security-answer-input')?.value || '');
        _close(); resolve(ans);
      });

      document.getElementById('security-answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('security-verify-btn').click();
      });

      // Focus the input
      setTimeout(() => document.getElementById('security-answer-input')?.focus(), 100);
    });
  }


  // ── Duplicate Settings Cleanup ─────────────────────────────────────
  // যদি database-এ একাধিক settings row থাকে, প্রথমটি রেখে বাকিগুলো মুছে দাও
  // Usage (console): App.cleanupDuplicateSettings()
  function cleanupDuplicateSettings() {
    try {
      const allSettings = SupabaseSync.getAll(DB.settings);
      if (allSettings.length <= 1) return 0;

      // ✅ Fix: admin_password আছে এমন row-কে keeper হিসেবে prefer করো
      // এতে login failure হবে না যদি password অন্য row-এ থাকে
      const keeper = allSettings.find(s => s.admin_password) || allSettings[0];

      let removed = 0;
      for (let i = 0; i < allSettings.length; i++) {
        const row = allSettings[i];
        if (row.id === keeper.id) continue; // keeper skip করো

        // অন্য কোনো row-এ extra fields থাকলে keeper-এ merge করো
        let needsUpdate = false;
        const mergeFields = ['security_question','security_answer','academy_name',
                             'running_batch','expense_month','monthly_target',
                             'admin_username','theme']; // Note: admin_pattern & admin_face_descriptor stored in localStorage
        for (const field of mergeFields) {
          if (row[field] && !keeper[field]) {
            keeper[field] = row[field];
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          SupabaseSync.update(DB.settings, keeper.id, keeper, { bypassLog: true });
        }

        // ✅ সঠিক function: remove (delete নয়) — bypassLog: true কারণ এটি system cleanup, activity log দরকার নেই
        SupabaseSync.remove(DB.settings, row.id, { bypassLog: true });
        removed++;
      }
      if (removed > 0) {
        console.log(`%c[Auth] Removed ${removed} duplicate settings row(s). Keeper row: ${keeper.id}. Login will now use the correct password.`, 'color: #00d4ff; font-weight: bold');
      }
      return removed;
    } catch (e) {
      console.error('[Auth] cleanupDuplicateSettings error:', e);
      return 0;
    }
  }


  function logout() {
    if (window.SessionStore) SessionStore.clearSession();
    else {
      localStorage.removeItem('wfa_logged_in');
      localStorage.removeItem('wfa_login_time');
      localStorage.removeItem('wfa_user_role');
      localStorage.removeItem('wfa_user_name');
      localStorage.removeItem('wfa_user_permissions');
    }
    sessionStorage.removeItem('wfa_greeted'); // clear greeting state so next login triggers it
    showLogin();
    // ✅ Fix: guard against early logout before SyncEngine is initialized
    if (typeof SyncEngine !== 'undefined' && typeof SyncEngine.stopAutoSync === 'function') {
      SyncEngine.stopAutoSync();
    }
  }

  // ── Show/Hide ─────────────────────────────────────────────
  function showLogin() {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    if (loginEl) loginEl.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';

    // ✅ Fix: Logout করার পরে username/password fields এবং error clear করো
    // Browser autocomplete থেকে পুরানো credentials দেখা যাওয়া বন্ধ করতে
    const uField = document.getElementById('login-username');
    const pField = document.getElementById('login-password');
    const errEl  = document.getElementById('login-error');
    if (uField) { uField.value = ''; }
    if (pField) { pField.value = ''; }
    if (errEl)  { errEl.textContent = ''; errEl.classList.add('hidden'); }
    
    // Face ID button visibility
    const faceBtn = document.getElementById('face-id-login-btn');
    if (faceBtn) {
      let hasFace = !!localStorage.getItem('wfa_admin_face_descriptor');
      if (!hasFace && typeof FaceIDModule !== 'undefined' && typeof FaceIDModule.isFaceIdRegistered === 'function') {
        hasFace = FaceIDModule.isFaceIdRegistered();
      }
      faceBtn.style.display = hasFace ? 'flex' : 'none';
    }

    // Pattern Lock button visibility
    const patBtn = document.getElementById('pattern-lock-login-btn');
    if (patBtn) {
      let hasPat = !!localStorage.getItem('wfa_admin_pattern');
      if (!hasPat && typeof PatternLockModule !== 'undefined' && typeof PatternLockModule.isPatternRegistered === 'function') {
        hasPat = PatternLockModule.isPatternRegistered();
      }
      patBtn.style.display = hasPat ? 'flex' : 'none';
    }

    if (window.LazyModules) {
      const prefetchLoginModules = () => {
        window.LazyModules.prefetchLoginExtras().then(() => {
          const faceBtn2 = document.getElementById('face-id-login-btn');
          if (faceBtn2 && faceBtn2.style.display === 'none' && localStorage.getItem('wfa_admin_face_descriptor')) {
            faceBtn2.style.display = 'flex';
          }
          const patBtn2 = document.getElementById('pattern-lock-login-btn');
          if (patBtn2 && patBtn2.style.display === 'none' && localStorage.getItem('wfa_admin_pattern')) {
            patBtn2.style.display = 'flex';
          }
        }).catch(() => {});
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(prefetchLoginModules, { timeout: 10000 });
      } else {
        setTimeout(prefetchLoginModules, 2500);
      }
    }

    if (window.LazyLibs && typeof window.LazyLibs.prefetchAppStyles === 'function') {
      window.LazyLibs.prefetchAppStyles();
    }
  }

  async function showApp(fromLogin = false) {
    // ── License Key Check ─────────────────────────────────────────
    // Admin সবসময় bypass — isAdmin() দিয়ে check (SessionStore + localStorage দুটোই support)
    // ✅ v2: checkOnStart() is async — server-validated (see js/core/license.js)
    if (typeof LicenseEngine !== 'undefined' && !isAdmin()) {
      const _allowed = await LicenseEngine.checkOnStart();
      if (!_allowed) return;
    }
    // ──────────────────────────────────────────────────────────────


    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    const revealApp = () => {
      if (loginEl) loginEl.style.display = 'none';
      if (appEl) appEl.style.display = 'flex';
      document.body.classList.add('app-loaded');
      if (window.InstitutionMode?.hydrateFromSettings) InstitutionMode.hydrateFromSettings();
      if (window.InstitutionMode && InstitutionMode.applySchoolNav) InstitutionMode.applySchoolNav();
      const lastSection = sessionStorage.getItem('wfa_last_section');
      const target = (fromLogin || !lastSection) ? 'dashboard' : lastSection;
      navigateTo(target);
      SyncEngine.startAutoSync();
    };

    const afterReveal = () => {
      if (!document.getElementById('voice-assistant-script')) {
        const loadVoice = () => {
          const script = document.createElement('script');
          script.id = 'voice-assistant-script';
          script.src = 'js/modules/voice-assistant.js';
          script.defer = true;
          document.body.appendChild(script);
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(loadVoice, { timeout: 5000 });
        } else {
          setTimeout(loadVoice, 3000);
        }
      }
      if (window.LazyModules) window.LazyModules.prefetchAfterLogin();
      else if (window.LazyLibs) window.LazyLibs.prefetchAfterLogin();
    };

    const loadStyles = (window.LazyLibs && window.LazyLibs.loadAppStyles)
      ? window.LazyLibs.loadAppStyles()
      : Promise.resolve();

    loadStyles.then(revealApp).catch(revealApp).finally(afterReveal);

    // ✅ Sub ID nav hide: permission নেই এমন ট্যাব hide করো
    // revealApp-এর পরে DOM ready হলে চালাও
    setTimeout(_applyNavPermissions, 200);
  }

  // ── Sub ID Nav Permissions ────────────────────────────────
  function _applyNavPermissions() {
    // Admin সব দেখে
    if (isAdmin()) {
      document.querySelectorAll('.nav-item, .more-item, .bottom-nav-item').forEach(el => {
        el.style.removeProperty('display');
      });
      return;
    }
    // Sub ID — permission-ছাড়া items hide করো
    document.querySelectorAll('.nav-item[data-section], .more-item[data-section], .bottom-nav-item[data-section]').forEach(el => {
      const section = el.dataset.section;
      if (!section || section === 'dashboard') return;
      if (hasPermission(section)) {
        el.style.removeProperty('display');
      } else {
        el.style.display = 'none';
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────
  function navigateTo(section) {
    if (!SECTIONS.includes(section)) return;

    // Settings opens as a modal overlay instead of navigating
    if (section === 'settings') {
      if (!hasPermission('settings')) {
        if (typeof Utils !== 'undefined') Utils.toast('⛔ Settings অ্যাক্সেসের অনুমতি নেই', 'error');
        return;
      }
      const openSettings = () => {
        if (typeof SettingsModule !== 'undefined') SettingsModule.openModal();
      };
      if (window.LazyModules) window.LazyModules.ensure('settings').then(openSettings);
      else openSettings();
      return;
    }

    // Attendance opens as a modal overlay — permission চেক আগে
    if (section === 'attendance') {
      if (!hasPermission('attendance')) {
        if (typeof Utils !== 'undefined') Utils.toast('⛔ Attendance অ্যাক্সেসের অনুমতি নেই', 'error');
        return;
      }
      currentSection = section;
      sessionStorage.setItem('wfa_last_section', section);
      setTimeout(() => {
        const openAttendance = () => {
          if (typeof Attendance !== 'undefined') Attendance.openModal();
        };
        if (window.LazyModules) window.LazyModules.ensure('attendance').then(openAttendance);
        else openAttendance();
      }, 80);
      return;
    }

    if (!hasPermission(section)) {
      if (typeof Utils !== 'undefined') Utils.toast('Access denied: permission required', 'error');
      return;
    }

    currentSection = section;

    // Save to sessionStorage so refresh restores last tab
    sessionStorage.setItem('wfa_last_section', section);

    // Hide all sections
    SECTIONS.forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.style.display = 'none';
    });

    // Show target
    const target = document.getElementById(`section-${section}`);
    if (target) {
      target.style.display = 'block';
      target.classList.add('section-enter');
      setTimeout(() => target.classList.remove('section-enter'), 400);
      // Reset scroll to top when switching tabs
      target.scrollTop = 0;
    }
    // Also reset main content scroll
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = TITLES[section] || section;

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }

    // Trigger module render (lazy-load script bundle on first visit)
    const doRender = () => renderModule(section);
    if (window.LazyModules) {
      window.LazyModules.ensureSection(section).then(doRender).catch(doRender);
    } else {
      doRender();
    }
    window.dispatchEvent(new CustomEvent('wfa:navigate', { detail: { section } }));
  }

  // ── Module Rendering ──────────────────────────────────────
  function renderModule(section) {
    // ✅ Phase 3: Show skeleton loading state for data-heavy modules
    const heavyModules = {
      'students':  'students-content',
      'finance':   'finance-content',
      'loans':     'loans-content',
      'hr-staff':  'hr-staff-content',
      'visitors':  'visitors-content',
      'salary':    'salary-content',
      'payment-requests': 'payment-requests-content',
      'routine-builder':  'routine-builder-content',
      'school-classes':   'school-classes-content',
      'subject-marks':    'subject-marks-content',
      'result-sheet':     'result-sheet-content',
    };
    const containerId = heavyModules[section];
    if (containerId) {
      const container = document.getElementById(containerId);
      if (container && !container.innerHTML.trim()) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fa fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Loading...</p></div>';
      }
    }

    try {
      switch (section) {
        case 'dashboard':     if (typeof DashboardModule !== 'undefined')    DashboardModule.render(); break;
        case 'students': {
          if (typeof Students !== 'undefined') {
            const _renderStudents = () => { Students.render(); };
            if (typeof WFA_IDB !== 'undefined' && WFA_IDB.onReady) {
              WFA_IDB.onReady(_renderStudents);
            } else {
              _renderStudents();
            }
          }
          break;
        }
        case 'finance':       if (typeof Finance !== 'undefined')            Finance.render(); break;
        case 'accounts':      if (typeof Accounts !== 'undefined')           Accounts.render(); break;
        case 'loans':         if (typeof Loans !== 'undefined')              Loans.render(); break;
        case 'exam':          if (typeof Exam !== 'undefined')               Exam.render(); break;
        case 'attendance':    /* ✅ Dead Code Fix: attendance উপরের navigateTo() block-এ modal হিসেবে open হয়
                                 এবং return করে। তাই এখানে কখনো পৌঁছায় না। renderModule() skip করে। */
                              break;
        case 'salary':        if (typeof Salary !== 'undefined')             Salary.render(); break;
        case 'hr-staff':      if (typeof HRStaff !== 'undefined')            HRStaff.render(); break;
        case 'visitors':      if (typeof VisitorsModule !== 'undefined')     VisitorsModule.render(); break;
        case 'id-cards':      if (typeof IDCardsModule !== 'undefined')      IDCardsModule.render(); break;
        case 'certificates':  if (typeof CertificatesModule !== 'undefined') CertificatesModule.render(); break;
        case 'notice-board':  if (typeof NoticeBoardModule !== 'undefined')  NoticeBoardModule.render(); break;
        case 'payment-requests': if (typeof PaymentRequestsModule !== 'undefined') PaymentRequestsModule.render(); break;
        case 'routine-builder':  if (typeof RoutineBuilder !== 'undefined')        RoutineBuilder.init(); break;
        case 'school-classes':   if (typeof SchoolClasses !== 'undefined')       SchoolClasses.render(); break;
        case 'subject-marks':    if (typeof SubjectMarks !== 'undefined')        SubjectMarks.render(); break;
        case 'result-sheet':     if (typeof ResultSheet !== 'undefined')         ResultSheet.render(); break;
        case 'settings':      if (typeof SettingsModule !== 'undefined')     SettingsModule.render(); break;
      }
      // ✅ Req 4: After every module renders, initialize DD/MM/YYYY flatpickr
      // on ALL filter-bar date inputs (not inside modals).
      // 150ms delay lets module rAF/innerHTML painting settle first.
      setTimeout(() => {
        if (typeof Utils !== 'undefined' && typeof Utils.initFilterDatePickers === 'function') {
          const sectionEl = document.getElementById(`section-${section}`);
          Utils.initFilterDatePickers(sectionEl || document.body);
        }
      }, 150);
    } catch (e) {
      console.error(`[App] Error rendering ${section}:`, e);
      const container = document.getElementById(`${section}-content`);
      if (container) {
        container.innerHTML = `<div style="padding:40px;text-align:center;color:#ff4757">
          <i class="fa fa-circle-exclamation" style="font-size:2rem;margin-bottom:10px;display:block"></i>
          <strong>Module load error</strong><br>
          <small style="color:#888">${e.message}</small>
          <br><button onclick="App.navigateTo('dashboard')" style="margin-top:16px;padding:8px 20px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;border-radius:8px;cursor:pointer">
            ← Dashboard-এ ফিরুন
          </button>
        </div>`;
      }
    }
  }

  // ── Quick Actions ─────────────────────────────────────────
  function quickAction(type) {
    // Close quick-add menu first
    const menu = document.getElementById('quick-add-menu');
    if (menu) menu.style.display = 'none';

    // Helper: wait until a container has real content rendered, then open modal
    function waitAndOpen(section, containerId, openFn, maxWait = 3000) {
      navigateTo(section);
      const start = Date.now();
      let done = false; // ✅ Fix: openFn একবারের বেশি fire হবে না
      function check() {
        if (done) return;
        const el = document.getElementById(containerId);
        // ✅ Fix: skeleton loader-এ table/.filter-bar থাকে না — real render হলেই open হবে
        const isReady = el && (
          el.querySelector('table') ||
          el.querySelector('.filter-bar') ||
          el.querySelector('.stat-card') ||
          el.querySelector('.card')
        );
        if (isReady) {
          done = true;
          openFn();
        } else if (Date.now() - start < maxWait) {
          setTimeout(check, 100);
        } else {
          done = true; // ✅ Fix: timeout fallback-ও একবারই চলবে
          openFn();
        }
      }
      setTimeout(check, 200); // ✅ Fix: Finance.render() এর rAF শুরু হওয়ার পর check
    }

    switch (type) {
      case 'student': {
        // ✅ Mobile fix: Open modal directly without navigating to heavy students tab
        const openStudentModal = () => {
          if (typeof Students !== 'undefined') Students.openAddModal();
        };
        if (window.LazyModules) window.LazyModules.ensure('students').then(openStudentModal);
        else openStudentModal();
        break;
      }
      case 'transaction':
        // ✅ Fix #2: navigate to Finance first, then open modal after render
        waitAndOpen('finance', 'finance-content', () => {
          if (typeof Finance !== 'undefined') Finance.openAddModal();
        });
        break;
      case 'loan':
        waitAndOpen('loans', 'loans-content', () => {
          if (typeof Loans !== 'undefined') Loans.openAddModal();
        });
        break;
      case 'exam':
        waitAndOpen('exam', 'exam-content', () => {
          if (typeof Exam !== 'undefined') Exam.openRegModal();
        });
        break;
      case 'visitor':
        waitAndOpen('visitors', 'visitors-content', () => {
          if (typeof VisitorsModule !== 'undefined') VisitorsModule.openAddModal();
        });
        break;
    }
  }

  // ── Notification Count ────────────────────────────────────
  function updateNotifCount() {
    try {
      const students = SupabaseSync.getAll(DB.students);
      const dueCount = students.filter(s => (Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid)) > 0).length;
      const countEl = document.getElementById('notif-count');
      if (countEl) {
        countEl.textContent = dueCount;
        countEl.style.display = dueCount > 0 ? 'inline-flex' : 'none';
      }
    } catch { /* ignore */ }
  }

  // ── Sidebar Toggle ────────────────────────────────────────
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
    // ✅ Fix #5: show/hide overlay for mobile sidebar dismiss
    // Uses the HTML overlay element styled by mobile.css
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      const isOpen = sidebar && sidebar.classList.contains('open');
      if (isOpen) {
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
      // Clicking overlay closes sidebar
      if (!overlay._clickBound) {
        overlay._clickBound = true;
        overlay.addEventListener('click', () => {
          sidebar && sidebar.classList.remove('open');
          overlay.classList.remove('active');
        });
      }
    }
  }

  // ── Event Bindings ────────────────────────────────────────
  function bindEvents() {
    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.section);
      });
    });

    // Hamburger
    const hamburger = document.getElementById('btn-hamburger');
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);

    // Global Search — searches ALL sections simultaneously and shows grouped dropdown
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      // ── Create search results dropdown overlay ──────────────
      let _srDropdown = document.getElementById('global-search-dropdown');
      if (!_srDropdown) {
        _srDropdown = document.createElement('div');
        _srDropdown.id = 'global-search-dropdown';
        _srDropdown.style.cssText = [
          'display:none', 'position:absolute', 'top:calc(100% + 6px)', 'left:0', 'right:0',
          'background:var(--bg-secondary,#1a1a2e)', 'border:1px solid rgba(0,212,255,0.25)',
          'border-radius:14px', 'max-height:420px', 'overflow-y:auto', 'z-index:9999',
          'box-shadow:0 12px 40px rgba(0,0,0,0.5)', 'backdrop-filter:blur(16px)'
        ].join(';');
        // Parent must be position:relative for dropdown to anchor
        const wrap = searchInput.closest('.search-wrapper, .header-search, [class*=search]') || searchInput.parentElement;
        wrap.style.position = 'relative';
        wrap.appendChild(_srDropdown);
      }

      function _closeSearchDropdown() {
        _srDropdown.style.display = 'none';
      }

      function _navigateToResult(section, rawValue) {
        const sectionSearchId = {
          students:  'stu-search',
          'hr-staff': 'staff-search',
          visitors:  'visitor-search',
          finance:   'fin-search',
        }[section];
        navigateTo(section);
        setTimeout(() => {
          const sInput = document.getElementById(sectionSearchId);
          if (sInput) { sInput.value = rawValue; sInput.dispatchEvent(new Event('input')); }
        }, 600);
        _closeSearchDropdown();
        searchInput.value = '';
      }

      function _buildResultItem(icon, color, title, sub, section, rawValue) {
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;gap:12px;align-items:center;transition:background 0.15s';
        div.innerHTML = `<i class="fa ${icon}" style="color:${color};width:16px;flex-shrink:0"></i>
          <div><div style="font-weight:600;color:#fff;font-size:0.9rem">${Utils.esc(title)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted,#888)">${Utils.esc(sub)}</div></div>`;
        div.addEventListener('mouseenter', () => div.style.background = 'rgba(255,255,255,0.06)');
        div.addEventListener('mouseleave', () => div.style.background = '');
        div.addEventListener('click', () => _navigateToResult(section, rawValue));
        return div;
      }

      function _buildGroupHeader(emoji, label, count, color) {
        const hdr = document.createElement('div');
        hdr.style.cssText = `padding:7px 16px;font-size:0.68rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:1.2px;background:${color}0d`;
        hdr.textContent = `${emoji} ${label} (${count})`;
        return hdr;
      }

      searchInput.addEventListener('input', Utils.debounce((e) => {
        const raw = e.target.value;
        const q   = raw.trim().toLowerCase();
        if (!q) { _closeSearchDropdown(); return; }

        // ── Search all sections ─────────────────────────────
        const matchedStudents = (SupabaseSync.getAll(DB.students) || []).filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.student_id || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q)
        );
        const matchedStaff = (SupabaseSync.getAll(DB.staff) || []).filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.designation || '').toLowerCase().includes(q)
        );
        const matchedVisitors = (SupabaseSync.getAll(DB.visitors) || []).filter(v =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.phone || '').toLowerCase().includes(q) ||
          (v.purpose || '').toLowerCase().includes(q)
        );
        const matchedFinance = (SupabaseSync.getAll(DB.finance) || []).filter(f =>
          (f.description || '').toLowerCase().includes(q) ||
          (f.category || '').toLowerCase().includes(q)
        );

        const total = matchedStudents.length + matchedStaff.length + matchedVisitors.length + matchedFinance.length;

        _srDropdown.innerHTML = '';

        if (total === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:20px;text-align:center;color:var(--text-muted,#888);font-size:0.9rem';
          empty.innerHTML = `<i class="fa fa-magnifying-glass" style="font-size:1.6rem;display:block;margin-bottom:8px;opacity:0.3"></i>"${Utils.esc(raw)}" — কোথাও পাওয়া যায়নি`;
          _srDropdown.appendChild(empty);
          _srDropdown.style.display = 'block';
          return;
        }

        // ── Students ────────────────────────────────────────
        if (matchedStudents.length > 0) {
          _srDropdown.appendChild(_buildGroupHeader('👩‍🎓', 'Students', matchedStudents.length, '#00d4ff'));
          matchedStudents.slice(0, 5).forEach(s => {
            _srDropdown.appendChild(_buildResultItem(
              'fa-user', '#00d4ff',
              s.name, `${s.student_id || ''} • ${s.phone || ''}`,
              'students', raw
            ));
          });
          if (matchedStudents.length > 5) {
            const more = document.createElement('div');
            more.style.cssText = 'padding:7px 16px;font-size:0.78rem;color:var(--text-muted,#888);cursor:pointer';
            more.textContent = `+ ${matchedStudents.length - 5} more — click to see all`;
            more.addEventListener('click', () => _navigateToResult('students', raw));
            _srDropdown.appendChild(more);
          }
        }

        // ── Staff ───────────────────────────────────────────
        if (matchedStaff.length > 0) {
          _srDropdown.appendChild(_buildGroupHeader('👥', 'Staff', matchedStaff.length, '#00ff88'));
          matchedStaff.slice(0, 3).forEach(s => {
            _srDropdown.appendChild(_buildResultItem(
              'fa-id-badge', '#00ff88',
              s.name, `${s.designation || ''} • ${s.phone || ''}`,
              'hr-staff', raw
            ));
          });
        }

        // ── Visitors ────────────────────────────────────────
        if (matchedVisitors.length > 0) {
          _srDropdown.appendChild(_buildGroupHeader('🚶', 'Visitors', matchedVisitors.length, '#ffb703'));
          matchedVisitors.slice(0, 3).forEach(v => {
            _srDropdown.appendChild(_buildResultItem(
              'fa-person-walking', '#ffb703',
              v.name, `${v.purpose || ''} • ${v.phone || ''}`,
              'visitors', raw
            ));
          });
        }

        // ── Finance ─────────────────────────────────────────
        if (matchedFinance.length > 0) {
          _srDropdown.appendChild(_buildGroupHeader('💰', 'Finance', matchedFinance.length, '#ff6b6b'));
          matchedFinance.slice(0, 3).forEach(f => {
            _srDropdown.appendChild(_buildResultItem(
              'fa-coins', '#ff6b6b',
              f.description || f.category || 'Transaction',
              `${f.category || ''} • ${f.amount ? '৳' + f.amount : ''}`,
              'finance', raw
            ));
          });
        }

        _srDropdown.style.display = 'block';
      }, 300));

      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !_srDropdown.contains(e.target)) {
          _closeSearchDropdown();
        }
      });

      // Close on Escape key
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { _closeSearchDropdown(); searchInput.value = ''; }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Sync buttons
    const syncBtn = document.getElementById('btn-sync-now');
    if (syncBtn) syncBtn.addEventListener('click', () => SyncEngine.syncAll({ silent: false }));

    const pushBtn = document.getElementById('btn-sync-push');
    if (pushBtn) pushBtn.addEventListener('click', () => SyncEngine.push());

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const un = document.getElementById('login-username')?.value;
        const pw = document.getElementById('login-password')?.value;
        const errEl = document.getElementById('login-error');
        const btnEl = loginForm.querySelector('button[type="submit"]');
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Logging in...'; }
        const ok = await login(un, pw);
        if (btnEl) {
          btnEl.disabled = false;
          // ✅ Restore full HTML structure to preserve shimmer animation
          btnEl.innerHTML = '<span class="login-btn-text"><i class="fa fa-sign-in-alt"></i>&nbsp; LOGIN</span><div class="login-btn-shimmer"></div>';
        }
        if (ok === 'pending') return;
        if (!ok) {
          // ✅ Bug #5 + Fix C-01: Track failed attempts and lockout after 5
          // Mirror to sessionStorage — localStorage.clear() won't bypass in same tab
          const attempts = parseInt(localStorage.getItem('wfa_login_attempts') || '0') + 1;
          localStorage.setItem('wfa_login_attempts', String(attempts));
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const lockoutUntil = String(Date.now() + LOCKOUT_DURATION_MS);
            localStorage.setItem('wfa_login_lockout_until', lockoutUntil);
            sessionStorage.setItem('wfa_login_lockout_until', lockoutUntil); // C-01 fix
            localStorage.removeItem('wfa_login_attempts');
          }
          if (errEl) {
            const left = MAX_LOGIN_ATTEMPTS - attempts;
            errEl.textContent = left > 0
              ? `Username or password incorrect! (${left} attempt${left === 1 ? '' : 's'} left)`
              : 'Too many failed attempts. Try again in 10 minutes.';
            errEl.classList.remove('hidden');
          }
          Utils.toast('Login failed: invalid credentials', 'error');
        }
      });
    }

    // Quick Add toggle — ✅ Fix #6: guard against duplicate listeners on each navigate
    const quickAddBtn  = document.getElementById('btn-quick-add');
    const quickAddMenu = document.getElementById('quick-add-menu');
    if (quickAddBtn && quickAddMenu && !quickAddBtn._qaListenerAttached) {
      quickAddBtn._qaListenerAttached = true;
      quickAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAddMenu.style.display = quickAddMenu.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!quickAddBtn.contains(e.target) && !quickAddMenu.contains(e.target)) {
          quickAddMenu.style.display = 'none';
        }
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        // Cycle: light → dark → neon-space → light
        const themeOrder = ['light', 'dark', 'neon-space'];
        const idx = themeOrder.indexOf(current);
        const next = themeOrder[(idx + 1) % themeOrder.length];
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('wfa_theme', next);
        themeBtn.textContent = next === 'dark' ? '☀️' : next === 'neon-space' ? '✨' : '🌙';
      });
    }

    // Close modal on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
      }
    });

    // On sync, refresh current module (debounced — avoids counter flicker every 30s)
    // ✅ Fix: Certificate/ID-card preview (এবং অন্য যেকোনো custom in-page modal) সিঙ্কের
    // সময় পুনরায় render() হওয়ায় সাথে সাথে বন্ধ হয়ে যাচ্ছিল, কারণ সেগুলো `.modal-backdrop`
    // ক্লাস ব্যবহার করে না — তাই আগের guard এগুলো ধরতে পারতো না। এখন display:flex
    // অবস্থায় থাকা যেকোনো "*-preview-modal" কেও open হিসেবে গণ্য করা হচ্ছে।
    let _syncRenderTimer = null;
    // ✅ FIX: modal-open অবস্থা event-fire মুহূর্তে ধরা হচ্ছিল, কিন্তু আসল render হচ্ছিল
    // 400ms পরে (debounce)। এই মাঝের 400ms উইন্ডোতে ইউজার যদি certificate/ID-card প্রিভিউ
    // ওপেন করে, সেই stale (পুরনো) snapshot অনুযায়ী renderModule() চলে যেত এবং মাত্র খোলা
    // মডালটা সাথে সাথে বন্ধ হয়ে যেত — বিশেষত নতুন ক্লায়েন্টে, যেখানে initial sync/realtime
    // events ঘন ঘন আসতে থাকে। এখন state চেক করা হচ্ছে actual render-এর মুহূর্তে (setTimeout-এর
    // ভিতরে), event আসার মুহূর্তে নয়।
    window.addEventListener('wfa:synced', () => {
      clearTimeout(_syncRenderTimer);
      _syncRenderTimer = setTimeout(() => {
        _applyAcademyMetadata();
        const modalOpen = document.querySelector('.modal-backdrop.open');
        const settingsOpen = document.getElementById('settings-overlay');
        const previewModalOpen = Array.from(document.querySelectorAll('[id$="-preview-modal"]'))
          .some(el => getComputedStyle(el).display !== 'none');
        if (!modalOpen && !settingsOpen && !previewModalOpen) {
          renderModule(currentSection);
        }
        updateNotifCount();
        try { if (typeof NoticeBoardModule !== 'undefined') NoticeBoardModule.updateNoticeDot(); } catch { /* ignore */ }
      }, 400);
    });

    // Auto Logout (Session Timeout)
    let idleTimer;
    function resetIdleTimer() {
      clearTimeout(idleTimer);
      if (isLoggedIn()) {
        idleTimer = setTimeout(() => {
          logout();
          Utils.toast('Session expired due to inactivity', 'warning', 5000);
        }, 2 * 60 * 60 * 1000); // 2 hours
      }
    }
    document.addEventListener('click', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    document.addEventListener('mousemove', Utils.debounce(resetIdleTimer, 1000));
    document.addEventListener('touchstart', resetIdleTimer);
    document.addEventListener('touchmove', Utils.debounce(resetIdleTimer, 1000)); // ✅ Fix #4: mobile idle timer
  }

  function _applyAcademyMetadata() {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return;
    const settings = SupabaseSync.getAll(DB.settings)[0] || {};
    const licenseName = (typeof LicenseEngine !== 'undefined' && LicenseEngine.getAcademyName)
      ? LicenseEngine.getAcademyName()
      : '';
    const secretsName = window.WFA_SUPABASE_SECRETS?.academyName || '';
    const defaultName = 'Wings Fly Aviation Academy';
    const licenseIsDefault = !licenseName || licenseName === 'Wings Fly Academy' || licenseName === defaultName;
    const name = settings.academy_name
      || secretsName
      || (!licenseIsDefault ? licenseName : '')
      || defaultName;
    const logo = settings.logo_url || 'assets/logo.jpg';

    // 1. Tab title
    document.title = name;

    // 2. Sidebar logo and text
    const sidebarLogoImg = document.querySelector('#sidebar .sidebar-logo img');
    if (sidebarLogoImg) sidebarLogoImg.src = logo;

    const sidebarLogoTitle = document.querySelector('#sidebar .logo-title');
    const sidebarAcademyName = document.querySelector('#sidebar .academy-name');
    if (sidebarLogoTitle && sidebarAcademyName) {
      const parts = name.split(/\s+/);
      if (parts.length > 2) {
        sidebarLogoTitle.textContent = parts.slice(0, 2).join(' ');
        sidebarAcademyName.textContent = parts.slice(2).join(' ');
      } else if (parts.length === 2) {
        sidebarLogoTitle.textContent = parts[0];
        sidebarAcademyName.textContent = parts[1];
      } else {
        sidebarLogoTitle.textContent = name;
        sidebarAcademyName.textContent = '';
      }
    }

    // 3. Login logo and text
    const loginLogoImg = document.querySelector('.login-logo-ring img');
    if (loginLogoImg) loginLogoImg.src = logo;

    const loginLogoSource = document.querySelector('.login-logo-ring source');
    if (loginLogoSource) loginLogoSource.srcset = logo;

    const loginTitle = document.querySelector('.login-title');
    if (loginTitle) {
      const parts = name.split(/\s+/);
      if (parts.length > 1) {
        const first = parts.slice(0, -1).join(' ');
        const last = parts[parts.length - 1];
        loginTitle.innerHTML = `${Utils.esc(first)} <span class="login-title-accent">${Utils.esc(last)}</span>`;
      } else {
        loginTitle.innerHTML = Utils.esc(name);
      }
    }

    const loginSubtitle = document.querySelector('.login-subtitle');
    if (loginSubtitle) {
      loginSubtitle.textContent = name + ' Management System';
    }

    const loginFooter = document.querySelector('.login-footer');
    if (loginFooter) {
      loginFooter.innerHTML = `${Utils.esc(name)} &copy; ${new Date().getFullYear()}`;
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Apply saved theme immediately (doesn't need IDB)
    const savedTheme = localStorage.getItem('wfa_theme') || 'neon-space';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : savedTheme === 'neon-space' ? '✨' : '🌙';

    _applyAcademyMetadata();
    bindEvents();

    // ── Wait for IndexedDB to be ready before login check ──
    // WFA_IDB.init() is async — if we call isLoggedIn/showApp before IDB
    // cache is loaded, SupabaseSync.getAll() returns [] and password
    // checks fail silently. onReady() guarantees the in-memory cache
    // is populated before any auth logic runs.
    if (typeof WFA_IDB !== 'undefined' && WFA_IDB.onReady) {
    WFA_IDB.onReady(async () => {
      // ডুপ্লিকেট settings row আত্মীয়ভাবে পরিষ্কার করো (login এর আগেই)
      cleanupDuplicateSettings();
      _applyAcademyMetadata();
      // ডায়াগনস্টিক টেস্টের ডামি/লেফটওভার রেকর্ডগুলো অটোমেটিক ক্লিনআপ করো
      if (typeof SystemDiagnostics !== 'undefined' && typeof SystemDiagnostics.cleanupLeftovers === 'function') {
        SystemDiagnostics.cleanupLeftovers();
      }
      if (isLoggedIn()) {
        // ✅ Fix: refresh-এ sub-account session admin-এ promote হওয়া বন্ধ করো
        const storedRole = window.SessionStore ? SessionStore.getRole() : localStorage.getItem('wfa_user_role');
        const storedUser = window.SessionStore ? SessionStore.getUserName() : localStorage.getItem('wfa_user_name');
        if (!storedRole) {
          if (storedUser && storedUser !== 'admin') {
            const perms = window.SessionStore ? SessionStore.getPermissions() : JSON.parse(localStorage.getItem('wfa_user_permissions') || '[]');
            if (window.SessionStore) {
              SessionStore.setSubSession(storedUser, perms);
            } else {
              localStorage.setItem('wfa_user_role', 'subaccount');
              localStorage.setItem('wfa_user_permissions', JSON.stringify(perms));
            }
          } else if (window.SessionStore) {
            SessionStore.setSession({ role: 'admin', permissions: ['*'] });
          } else {
            localStorage.setItem('wfa_user_role', 'admin');
            localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
          }
        }
        showApp(false);
      } else {
        // ✅ First-Time Setup Wizard check for new client deployments
        // Show wizard if: SetupWizard is loaded AND no admin password exists anywhere
        if (typeof SetupWizard !== 'undefined' && SetupWizard.isFirstTimeSetup) {
          try {
            const needsSetup = await SetupWizard.isFirstTimeSetup();
            if (needsSetup) {
              SetupWizard.show(() => showLogin());
              return;
            }
          } catch (e) {
            console.warn('[App] Setup wizard check failed, falling back to login:', e.message);
          }
        }
        showLogin();
      }
      updateNotifCount();
    });
    } else {
      // WFA_IDB not available — run auth check directly (offline/fallback mode)
      cleanupDuplicateSettings();
      _applyAcademyMetadata();
      if (typeof SystemDiagnostics !== 'undefined' && typeof SystemDiagnostics.cleanupLeftovers === 'function') {
        SystemDiagnostics.cleanupLeftovers();
      }
      if (isLoggedIn()) { showApp(false); } else { showLogin(); }
      updateNotifCount();
    }
  }


  return { init, navigateTo, login, logout, isLoggedIn, isAdmin, showApp, toggleSidebar, quickAction, updateNotifCount, resetAdminPassword, cleanupDuplicateSettings, applyAcademyMetadata: _applyAcademyMetadata };
})();

// ✅ Critical stabilization: wait for core globals to avoid startup race conditions.
(function bootstrapApp() {
  if (!document.getElementById('app-wrapper')) return;
  let started = false;
  function hasCoreGlobals() {
    return (
      typeof window.Utils !== 'undefined' &&
      typeof window.SupabaseSync !== 'undefined' &&
      typeof window.SyncEngine !== 'undefined' &&
      typeof window.DB !== 'undefined' &&
      typeof window.WFA_IDB !== 'undefined' &&
      typeof window.App !== 'undefined'
    );
  }
  function startWhenReady() {
    if (started) return;
    if (hasCoreGlobals()) {
      started = true;
      window.App.init();
      return;
    }
    setTimeout(startWhenReady, 50);
  }
  document.addEventListener('DOMContentLoaded', startWhenReady);
})();
window.App = App;

// ── Auto Snapshot + Daily Backup Scheduler ───────────────────────────
// App load এর ৩০ সেকেন্ড পরে প্রথমবার চলবে, তারপর প্রতি ঘণ্টায়
(function startAutoBackupScheduler() {
  const INTERVAL_MS = 60 * 60 * 1000; // ১ ঘণ্টা

  function runScheduledTasks() {
    try {
      if (typeof SettingsModule !== 'undefined') {
        // Auto snapshot (SettingsModule নিজেই ১ ঘণ্টার throttle check করে)
        SettingsModule.saveSnapshot(false);
        // Daily backup download (আজকে already হলে skip করবে)
        SettingsModule.tryDailyAutoDownload();
      }
    } catch(e) {
      console.warn('[Scheduler] Task error:', e);
    }
  }

  function initScheduler() {
    if (typeof WFA_IDB !== 'undefined' && WFA_IDB.onReady) {
      WFA_IDB.onReady(() => {
        setTimeout(runScheduledTasks, 30 * 1000);
        setInterval(runScheduledTasks, INTERVAL_MS);
        console.info('[Scheduler] Auto snapshot + daily backup scheduler started');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScheduler);
  } else {
    initScheduler();
  }
})();

// ── Date Input locale fix: force DD/MM/YYYY everywhere ──────────────
(function enforceDateLocale() {
  function fixDateInputs() {
    document.querySelectorAll('input[type="date"], input.date-picker').forEach(el => {
      if (!el.hasAttribute('data-locale-fixed') && !el.closest('.flatpickr-calendar')) {
        const rawVal = String(el.value || '').trim();
        const isIso = /^\d{4}-\d{2}-\d{2}$/.test(rawVal);
        const isDmy = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawVal);
        if (rawVal && !isIso && !isDmy) {
          // Guard against accidental non-date preload values (e.g. "admin")
          // which cause Flatpickr "Invalid date provided" console errors.
          el.value = '';
        }
        el.setAttribute('lang', 'en-GB');
        el.setAttribute('data-locale-fixed', '1');
        // ✅ REQUIREMENT #4: Force DD/MM/YYYY display while keeping YYYY-MM-DD storage
        if (!el._flatpickr && typeof Utils !== 'undefined' && Utils.initFlatpickrOnElement) {
          Utils.initFlatpickrOnElement(el, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            locale: { firstDayOfWeek: 1 },
            mode: 'single',
            parseDate: (datestr) => {
              if (!datestr) return null;
              const str = String(datestr).trim();
              const dmy = str.split('/');
              if (dmy.length === 3) {
                const [day, month, year] = dmy.map(p => parseInt(p, 10));
                const d = new Date(year, month - 1, day);
                return isNaN(d.getTime()) ? null : d;
              }
              if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                const d = new Date(str);
                return isNaN(d.getTime()) ? null : d;
              }
              return null;
            },
          });
        }
      }
    });
  }
  // Initial fix
  document.addEventListener('DOMContentLoaded', fixDateInputs);
  // After modals open (MutationObserver)
  // ✅ MOBILE PERF FIX: Debounce the observer — it was firing on every DOM change
  // and running querySelectorAll + flatpickr init, causing cascading freezes.
  let _dateFixTimer = null;
  const debouncedFix = function() {
    clearTimeout(_dateFixTimer);
    _dateFixTimer = setTimeout(fixDateInputs, 500);
  };
  // Only observe inside modals, not the entire body (massive perf improvement)
  const modalObserver = new MutationObserver(debouncedFix);
  const modalEl = document.getElementById('modal-backdrop');
  if (modalEl) {
    modalObserver.observe(modalEl, { childList: true, subtree: true });
  }
  // Also fix when confirm dialog opens
  const confirmEl = document.getElementById('confirm-backdrop');
  if (confirmEl) {
    modalObserver.observe(confirmEl, { childList: true, subtree: true });
  }
})();



