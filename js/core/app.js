// ============================================================
// Wings Fly Aviation Academy — Main App (Tab Switching & Init)
// ============================================================

const App = (() => {

  const SECTIONS = [
    'dashboard', 'students', 'finance', 'accounts', 'loans',
    'exam', 'attendance', 'salary', 'hr-staff',
    'visitors', 'id-cards', 'certificates', 'notice-board', 'settings'
  ];

  // ── SHA-256 password hashing (settings.js এর মতো একই logic) ──────────
  async function _hashPw(pw) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) {
      let hash = 0;
      for (let i = 0; i < pw.length; i++) { hash = ((hash << 5) - hash) + pw.charCodeAt(i); hash |= 0; }
      return 'fb_' + Math.abs(hash).toString(16);
    }
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
    settings:       '⚙️ Settings',
  };

  let currentSection = 'dashboard';

  // ── Auth ───────────────────────────────────────────────────
  function isLoggedIn() {
    return localStorage.getItem('wfa_logged_in') === 'true';
  }

  function getSubAccounts() {
    try {
      return JSON.parse(localStorage.getItem('wfa_sub_accounts') || '[]');
    } catch {
      return [];
    }
  }

  function isAdmin() {
    return localStorage.getItem('wfa_user_role') === 'admin';
  }

  function getUserPermissions() {
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

    const map = {
      students: 'Students',
      finance: 'Finance/Ledger',
      accounts: 'Accounts',
      loans: 'Loans',
      exam: 'Exams',
      'hr-staff': 'HR / Staff',
      salary: 'Salary Hub',
      visitors: 'Visitors',
    };

    const required = map[section];
    if (!required) return true; // allow sections without explicit sub-account controls

    return permissions.includes(required);
  }

  async function login(username, password) {
    // ✅ Fix #1: auto-cleanup duplicate settings rows before reading
    // Prevents login failure when admin_password is in row[1] instead of row[0]
    const rawList = SupabaseSync.getAll(DB.settings);
    if (rawList.length > 1) cleanupDuplicateSettings();
    const settingsList = SupabaseSync.getAll(DB.settings);
    // Prefer the row that has admin_password set (guards against partial duplicates)
    const settings = settingsList.find(s => s.admin_password) || settingsList[0] || {};
    const storedPw = settings.admin_password;
    const normalizedUsername = String(username || '').trim();


    // ── Admin login ──────────────────────────────────────────
    if (normalizedUsername === 'admin' || normalizedUsername === '') {
      const _isHashed = (s) => /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');
      let adminOk = false;

      if (!storedPw) {
        // ✅ Fix #1 (enhanced): Only allow first-time setup if there is truly NO data yet.
        // If students/finance records exist, we're on a new browser before sync — refuse login.
        const hasExistingData = (SupabaseSync.getAll(DB.students).length > 0) ||
                                (SupabaseSync.getAll(DB.finance).length  > 0);
        if (hasExistingData) {
          // Track retry attempts — after 3 attempts, allow setup anyway
          const retryKey = '_loginRetryCount';
          window[retryKey] = (window[retryKey] || 0) + 1;
          const errEl = document.getElementById('login-error');

          if (window[retryKey] < 4) {
            // Sync is still loading settings — refuse and guide user
            const waitSec = 5 * window[retryKey];
            if (errEl) {
              errEl.innerHTML = `⏳ Cloud settings loading… Please wait ${waitSec}s and try again. <br><small style="color:#aaa">(Attempt ${window[retryKey]}/3)</small>`;
              errEl.style.display = 'block';
            }
            return;
          } else {
            // After 3 retries, allow forced setup with a warning
            if (errEl) {
              errEl.innerHTML = `⚠️ Settings could not be loaded from cloud. Setting new password.`;
              errEl.style.display = 'block';
            }
            window[retryKey] = 0;
          }
        }
        // Genuine first-time setup — accept any non-empty password and save it
        adminOk = !!password;
        if (adminOk) {
          const newHash = await _hashPw(password);
          settings.admin_password = newHash;
          if (settings.id) {
            SupabaseSync.update(DB.settings, settings.id, settings);
          } else {
            settings.id = SupabaseSync.generateId();
            SupabaseSync.insert(DB.settings, settings);
          }
        }
      } else if (_isHashed(storedPw)) {
        // Stored password is hashed — hash input and compare
        const inputHash = await _hashPw(password);
        adminOk = inputHash === storedPw;
      } else {
        // Legacy plaintext comparison
        adminOk = password === storedPw;
      }

      if (adminOk) {
        localStorage.setItem('wfa_logged_in', 'true');
        localStorage.setItem('wfa_user_role', 'admin');
        localStorage.setItem('wfa_user_name', 'admin');
        localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
        showApp(true);
        return true;
      }
    }

    if (!normalizedUsername) return false;

    // ── Sub-account login: hashed password compare ────────────────────
    const inputHash = await _hashPw(password);
    const sub = getSubAccounts().find((s) => {
      if (s.username !== normalizedUsername) return false;
      const isHashed = /^[0-9a-f]{64}$/.test(s.password) || s.password?.startsWith('fb_');
      return isHashed ? s.password === inputHash : s.password === password;
    });
    if (sub) {
      localStorage.setItem('wfa_logged_in', 'true');
      localStorage.setItem('wfa_user_role', 'subaccount');
      localStorage.setItem('wfa_user_name', sub.username);
      localStorage.setItem('wfa_user_permissions', JSON.stringify(sub.permissions || []));
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
    const timeoutUntil = parseInt(localStorage.getItem(resetTimeoutKey) || '0');
    
    if (now < timeoutUntil) {
      const waitSeconds = Math.ceil((timeoutUntil - now) / 1000);
      const msg = `❌ Too many failed attempts. Wait ${waitSeconds} seconds before trying again.`;
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(msg, 'error', 5000);
      }
      console.error('[Auth]', msg);
      return false;
    }

    if (!newPassword || newPassword.length < 4) {
      console.error('[Auth] Password must be at least 4 characters');
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
        // Lock out for 15 minutes
        const lockoutTime = 15 * 60 * 1000;
        localStorage.setItem(resetTimeoutKey, (Date.now() + lockoutTime).toString());
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

    // 🆕 BUG #6 FIX: Clear attempts on success
    localStorage.removeItem(resetAttemptKey);
    localStorage.removeItem(resetTimeoutKey);

    // Cleanup duplicates first, then reset
    cleanupDuplicateSettings();
    const freshList = SupabaseSync.getAll(DB.settings);
    const fresh = freshList[0] || {};
    const newHash = await _hashPw(newPassword);
    fresh.admin_password = newHash;
    if (fresh.id) {
      SupabaseSync.update(DB.settings, fresh.id, fresh);
    } else {
      fresh.id = SupabaseSync.generateId();
      SupabaseSync.insert(DB.settings, fresh);
    }
    console.log('%c[Auth] ✅ Admin password reset successfully! Login with your new password.', 'color: #00ff88; font-weight: bold');
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('✅ Password reset successful! Please login again.', 'success', 3000);
    }
    return true;
  }

  // 🆕 BUG #6 FIX: Secure modal instead of prompt
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
          style="width:100%;padding:10px;margin:12px 0;border:1px solid #00d4ff;border-radius:6px;background:#0f0f1e;color:#fff;font-size:0.95em;box-sizing:border-box;"
          onkeypress="if(event.key==='Enter') document.getElementById('security-verify-btn').click();" />
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button onclick="document.getElementById('security-modal-overlay').remove(); window._securityResolve('');" 
            style="padding:10px 16px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Cancel</button>
          <button id="security-verify-btn" onclick="const ans = document.getElementById('security-answer-input').value; document.getElementById('security-modal-overlay').remove(); window._securityResolve(ans);" 
            style="padding:10px 16px;background:#00d4ff;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Verify</button>
        </div>
      `;
      
      overlay.appendChild(modal);
      window._securityResolve = resolve;
      document.body.appendChild(overlay);
      
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
                             'admin_username','theme'];
        for (const field of mergeFields) {
          if (row[field] && !keeper[field]) {
            keeper[field] = row[field];
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          SupabaseSync.update(DB.settings, keeper.id, keeper);
        }

        // ✅ সঠিক function: remove (delete নয়)
        SupabaseSync.remove(DB.settings, row.id);
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
    localStorage.removeItem('wfa_logged_in');
    localStorage.removeItem('wfa_user_role');
    localStorage.removeItem('wfa_user_name');
    localStorage.removeItem('wfa_user_permissions');
    sessionStorage.removeItem('wfa_greeted'); // clear greeting state so next login triggers it
    showLogin();
    SyncEngine.stopAutoSync();
  }

  // ── Show/Hide ─────────────────────────────────────────────
  function showLogin() {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    if (loginEl) loginEl.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';
    
    // Face ID button visiblity
    const faceBtn = document.getElementById('face-id-login-btn');
    if (faceBtn) {
       faceBtn.style.display = localStorage.getItem('wfa_admin_face_descriptor') ? 'flex' : 'none';
    }

    // Pattern Lock button visibility
    const patBtn = document.getElementById('pattern-lock-login-btn');
    if (patBtn) {
       patBtn.style.display = localStorage.getItem('wfa_admin_pattern') ? 'flex' : 'none';
    }
  }

  function showApp(fromLogin = false) {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
    // Fresh login → always go to dashboard; refresh → restore last section
    const lastSection = sessionStorage.getItem('wfa_last_section');
    const target = (fromLogin || !lastSection) ? 'dashboard' : lastSection;
    navigateTo(target);
    SyncEngine.startAutoSync();
  }

  // ── Navigation ────────────────────────────────────────────
  function navigateTo(section) {
    if (!SECTIONS.includes(section)) return;

    // Settings opens as a modal overlay instead of navigating
    if (section === 'settings') {
      if (!isAdmin()) {
        if (typeof Utils !== 'undefined') Utils.toast('Access denied: settings are admin only', 'error');
        return;
      }
      if (typeof SettingsModule !== 'undefined') SettingsModule.openModal();
      return;
    }

    // Attendance opens as a modal overlay
    if (section === 'attendance') {
      if (typeof Attendance !== 'undefined') Attendance.openModal();
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

    // Trigger module render
    renderModule(section);
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
    };
    const containerId = heavyModules[section];
    if (containerId && typeof Utils !== 'undefined' && Utils.loadingSkeleton) {
      const container = document.getElementById(containerId);
      if (container && !container.innerHTML.trim()) {
        container.innerHTML = Utils.loadingSkeleton(6);
      }
    }

    try {
      switch (section) {
        case 'dashboard':     if (typeof DashboardModule !== 'undefined')    DashboardModule.render(); break;
        case 'students':      if (typeof Students !== 'undefined')           { Students.resetFilters(); Students.render(); } break;
        case 'finance':       if (typeof Finance !== 'undefined')            Finance.render(); break;
        case 'accounts':      if (typeof Accounts !== 'undefined')           Accounts.render(); break;
        case 'loans':         if (typeof Loans !== 'undefined')              Loans.render(); break;
        case 'exam':          if (typeof Exam !== 'undefined')               Exam.render(); break;
        case 'attendance':    if (typeof Attendance !== 'undefined')         Attendance.render(); break;
        case 'salary':        if (typeof Salary !== 'undefined')             Salary.render(); break;
        case 'hr-staff':      if (typeof HRStaff !== 'undefined')            HRStaff.render(); break;
        case 'visitors':      if (typeof VisitorsModule !== 'undefined')     VisitorsModule.render(); break;
        case 'id-cards':      if (typeof IDCardsModule !== 'undefined')      IDCardsModule.render(); break;
        case 'certificates':  if (typeof CertificatesModule !== 'undefined') CertificatesModule.render(); break;
        case 'notice-board':  if (typeof NoticeBoardModule !== 'undefined')  NoticeBoardModule.render(); break;
        case 'settings':      if (typeof SettingsModule !== 'undefined')     SettingsModule.render(); break;
      }
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
    switch (type) {
      case 'student':     navigateTo('students');  setTimeout(() => { if (typeof Students !== 'undefined') Students.openAddModal(); }, 200); break;
      case 'transaction': navigateTo('finance');   setTimeout(() => { if (typeof Finance !== 'undefined') Finance.openAddModal(); }, 200); break;
      case 'loan':        navigateTo('loans');     setTimeout(() => { if (typeof Loans !== 'undefined') Loans.openAddModal(); }, 200); break;
      case 'exam':        navigateTo('exam');      setTimeout(() => { if (typeof Exam !== 'undefined') Exam.openRegModal(); }, 200); break;
      case 'visitor':     navigateTo('visitors');  setTimeout(() => { if (typeof VisitorsModule !== 'undefined') VisitorsModule.openAddModal(); }, 200); break;
    }
    // Close quick-add menu
    const menu = document.getElementById('quick-add-menu');
    if (menu) menu.style.display = 'none';
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
    } catch (e) { /* ignore */ }
  }

  // ── Sidebar Toggle ────────────────────────────────────────
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
    // ✅ Fix #5: show/hide overlay for mobile sidebar dismiss
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:149;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px)';
      overlay.addEventListener('click', () => {
        sidebar && sidebar.classList.remove('open');
        overlay.style.display = 'none';
      });
      document.body.appendChild(overlay);
    }
    const isOpen = sidebar && sidebar.classList.contains('open');
    overlay.style.display = isOpen ? 'block' : 'none';
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
        if (!ok) {
          if (errEl) {
            errEl.textContent = 'Username or password incorrect!';
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

    // On sync, refresh current module
    window.addEventListener('wfa:synced', () => {
      renderModule(currentSection);
      updateNotifCount();
      // Refresh notice dot after sync (new notice may have arrived from cloud)
      try { if (typeof NoticeBoardModule !== 'undefined') NoticeBoardModule.updateNoticeDot(); } catch { /* ignore */ }
    });

    // Auto Logout (Session Timeout)
    let idleTimer;
    function resetIdleTimer() {
      clearTimeout(idleTimer);
      if (isLoggedIn()) {
        idleTimer = setTimeout(() => {
          logout();
          Utils.toast('Session expired due to inactivity', 'warning', 5000);
        }, 30 * 60 * 1000); // 30 minutes
      }
    }
    document.addEventListener('click', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    document.addEventListener('mousemove', Utils.debounce(resetIdleTimer, 1000));
    document.addEventListener('touchstart', resetIdleTimer);
    document.addEventListener('touchmove', Utils.debounce(resetIdleTimer, 1000)); // ✅ Fix #4: mobile idle timer
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Apply saved theme immediately (doesn't need IDB)
    const savedTheme = localStorage.getItem('wfa_theme') || 'neon-space';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : savedTheme === 'neon-space' ? '✨' : '🌙';

    bindEvents();

    // ── Wait for IndexedDB to be ready before login check ──
    // WFA_IDB.init() is async — if we call isLoggedIn/showApp before IDB
    // cache is loaded, SupabaseSync.getAll() returns [] and password
    // checks fail silently. onReady() guarantees the in-memory cache
    // is populated before any auth logic runs.
    WFA_IDB.onReady(() => {
      // ডুপ্লিকেট settings row আত্মীয়ভাবে পরিষ্কার করো (login এর আগেই)
      cleanupDuplicateSettings();
      if (isLoggedIn()) {
        // ✅ Fix: যদি role না থাকে (refresh/session restore) তাহলে admin default করো
        // কারণ sub-account logout করলে wfa_logged_in cleared হয়, কিন্তু
        // কখনো কখনো role missing থাকে। Single-user app হওয়ায় logged_in=true মানেই admin।
        if (!localStorage.getItem('wfa_user_role')) {
          localStorage.setItem('wfa_user_role', 'admin');
          localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
        }
        showApp(false);
      } else {
        showLogin();
      }
      updateNotifCount();
    });
  }

  return { init, navigateTo, login, logout, isLoggedIn, showApp, toggleSidebar, quickAction, updateNotifCount, resetAdminPassword, cleanupDuplicateSettings };
})();

document.addEventListener('DOMContentLoaded', App.init);
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
    } else {
      setTimeout(() => {
        runScheduledTasks();
        setInterval(runScheduledTasks, INTERVAL_MS);
      }, 30 * 1000);
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
    document.querySelectorAll('input[type="date"], .date-picker, [class*="date"]').forEach(el => {
      if (!el.hasAttribute('data-locale-fixed') && !el.closest('.flatpickr-calendar')) {
        el.setAttribute('lang', 'en-GB');
        el.setAttribute('data-locale-fixed', '1');
        // ✅ REQUIREMENT #4: Force DD/MM/YYYY display while keeping YYYY-MM-DD storage
        if (typeof flatpickr !== 'undefined' && !el._flatpickr) {
          try {
            flatpickr(el, {
              dateFormat: 'Y-m-d',           // ✅ Database storage: YYYY-MM-DD
              altInput: true,                // ✅ Show display format in alt field
              altFormat: 'd/m/Y',            // ✅ DISPLAY: DD/MM/YYYY
              allowInput: true,              // User can type dates
              locale: { firstDayOfWeek: 1 }, // Week starts Monday
              mode: 'single',
              // Parse dates — accept both DD/MM/YYYY and YYYY-MM-DD
              parseDate: (datestr) => {
                if (!datestr) return null;
                const str = String(datestr).trim();
                // Try DD/MM/YYYY format first
                const dmy = str.split('/');
                if (dmy.length === 3) {
                  const [day, month, year] = dmy.map(p => parseInt(p, 10));
                  return new Date(year, month - 1, day);
                }
                // Fallback: try ISO format (YYYY-MM-DD)
                return new Date(str);
              }
            });
          } catch (e) { 
            console.warn('[Date] Flatpickr init error:', e);
          }
        }
      }
    });
  }
  // Initial fix
  document.addEventListener('DOMContentLoaded', fixDateInputs);
  // After modals open (MutationObserver)
  const observer = new MutationObserver(fixDateInputs);
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ── Phase 4.2: Production Console Log Management ────────────────────
// Enable verbose logs: localStorage.setItem('wfa_debug_mode', 'true')
// Disable (default): localStorage.removeItem('wfa_debug_mode')
// ✅ Fix: console.error & console.warn are NEVER suppressed — critical errors must always show.
(function() {
  const isDebug = localStorage.getItem('wfa_debug_mode') === 'true';
  if (!isDebug) {
    const _origLog  = console.log;
    const _origInfo = console.info;
    // Only filter out noisy log/info — errors and warnings are always visible
    console.log = function(...args) {
      if (args[0] && typeof args[0] === 'string' && /^\[(Sync|IDB|Auth|Scheduler)\]/.test(args[0])) {
        _origLog.apply(console, args);
      }
      // styled %c logs (e.g. Auth reset success) — always pass through
      if (args[0] && typeof args[0] === 'string' && args[0].startsWith('%c')) {
        _origLog.apply(console, args);
      }
    };
    console.info = function(...args) {
      if (args[0] && typeof args[0] === 'string' && /^\[(Sync|IDB|Auth|Scheduler)\]/.test(args[0])) {
        _origInfo.apply(console, args);
      }
    };
    // ✅ console.error and console.warn are intentionally NOT overridden.
    // Any module error (students, finance, salary, etc.) must be visible in DevTools.
  }
})();

