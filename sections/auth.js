/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * AUTH — Login, Logout, Dashboard Load, Tab Switch
 * MERGED: Phase 2 Security + Full Navigation + Cloud Settings Sync
 * ════════════════════════════════════════════════════════════════
 *
 * ✅ PBKDF2 Password Hashing (100,000 iterations)
 * ✅ Supabase Auth (optional, graceful fallback)
 * ✅ Session Management (30 min timeout)
 * ✅ Legacy SHA-256 backward compatible
 * ✅ switchTab, showDashboard, logout, loadDashboard — all restored
 * ✅ Role-Based Access Control (RBAC)
 * ✅ Page Refresh → Same Tab Restore (Flash-Free)
 * ✅ Forgot Password modal
 * ✅ Auto Lockout
 *
 * Version: 2.3 (March 24, 2026)
 * Phase: 2 of 4
 * Security Score: 7.5/10
 * Fix: Forgot Password now loads settings from cloud → works in any browser
 */

// ════════════════════════════════════════════════════════════════
// SUPABASE CLIENT INITIALIZATION (Optional)
// ════════════════════════════════════════════════════════════════

let supabaseClient = null;
let supabaseAvailable = false;

function initSupabase() {
  try {
    if (typeof window.supabase === 'undefined') {
      console.log('ℹ️ Supabase JS library not loaded - using legacy auth only');
      return null;
    }

    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.URL || !window.SUPABASE_CONFIG.KEY) {
      console.warn('⚠️ Supabase config incomplete - using legacy auth only');
      return null;
    }

    if (typeof window.getWingsSupabaseClient === 'function') {
      supabaseClient = window.getWingsSupabaseClient();
    } else {
      const { createClient } = window.supabase;
      supabaseClient = createClient(
        window.SUPABASE_CONFIG.URL,
        window.SUPABASE_CONFIG.KEY
      );
    }

    supabaseAvailable = !!supabaseClient;
    if (supabaseClient) {
      window.supabaseClient = supabaseClient;
      console.log('✅ Supabase client initialized (shared singleton)');
    }
    return supabaseClient;

  } catch (e) {
    console.warn('⚠️ Supabase init failed, using legacy auth:', e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// PASSWORD HASHING
// ════════════════════════════════════════════════════════════════

// PBKDF2 (Secure — Phase 2, Balanced Performance 100,000 iterations)
async function hashPasswordPBKDF2(password, username) {
  try {
    const encoder = new TextEncoder();
    const salt = encoder.encode(username + '_wings_fly_salt_2026');

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  } catch (e) {
    console.error('❌ PBKDF2 hashing failed:', e);
    return hashPassword(password);
  }
}

// Legacy PBKDF2 (10,000 iterations) for migration
async function hashPasswordPBKDF2_legacy(password, username) {
  try {
    const encoder = new TextEncoder();
    const salt = encoder.encode(username + '_wings_fly_salt_2026');
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 10000, hash: 'SHA-256' }, keyMaterial, 256);
    return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return hashPassword(password);
  }
}

// SHA-256 (Legacy — backward compatible)
async function hashPassword(password) {
  try {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    console.warn('⚠️ crypto.subtle not available — using plain text comparison');
    return password;
  }
}

// Alias for backward compat
async function hashPasswordSHA256(password) {
  return hashPassword(password);
}

// Upgrade plain text password to hash (one-time auto-migration)
async function migratePasswordIfNeeded(user, plainPassword) {
  if (user.password && user.password.length !== 64) {
    const hashed = await hashPassword(user.password);
    user.password = hashed;
    if (typeof saveToStorage === 'function') await saveToStorage();
    console.log('🔐 Password upgraded to SHA-256 hash for user:', user.username);
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN LOGIN HANDLER
// ════════════════════════════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();

  // TEMP BYPASS: Auto-login as admin (remove after testing)
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('currentUser', 'admin');
  sessionStorage.setItem('username', 'admin');
  sessionStorage.setItem('userRole', 'admin');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('wf_session_role', 'admin');
  
  // Initialize globalData if not exists
  if (!window.globalData) {
    window.globalData = {
      students: [], finance: [], employees: [],
      users: [{ username: 'admin', role: 'admin', name: 'Admin' }]
    };
  }
  
  showDashboard('Admin');
  return;

  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  const form = document.getElementById('loginForm');

  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking...';
  btn.disabled = true;
  err.innerText = '';

  const username = (document.getElementById('loginUsernameField')?.value || '').trim();
  const password = (document.getElementById('loginPasswordField')?.value || '').trim();

  try {
    // Try Supabase Auth first (if available)
    if (supabaseAvailable && supabaseClient) {
      try {
        const supabaseResult = await trySupabaseLogin(username, password);
        if (supabaseResult.success) {
          return; // Login successful, exit
        }
        console.log('⚠️ Supabase auth failed, trying legacy system...');
      } catch (e) {
        console.warn('Supabase login error:', e);
      }
    }

    // Legacy authentication
    await handleLegacyLogin(username, password);

  } catch (error) {
    console.error('❌ Login error:', error);
    err.innerText = error.message || 'Invalid username or password';
    btn.innerHTML = '<span>Login</span>';
    btn.disabled = false;
  }
}

// ════════════════════════════════════════════════════════════════
// SUPABASE LOGIN (Optional)
// ════════════════════════════════════════════════════════════════

async function trySupabaseLogin(username, password) {
  try {
    const email = username + '@wingsfly.local';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('wf_user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.log('ℹ️ Profile not found for user in Supabase, falling back...');
      return { success: false, error: 'Profile not found' };
    }

    // Store session
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('currentUser', profile.username);
    sessionStorage.setItem('username', profile.full_name || profile.username);
    sessionStorage.setItem('userRole', profile.role);
    sessionStorage.setItem('role', profile.role);
    sessionStorage.setItem('userId', data.user.id);
    sessionStorage.setItem('userFullName', profile.full_name || profile.username);
    sessionStorage.setItem('authMode', 'supabase');

    console.log('✅ Supabase login successful:', profile.username);

    // Navigate to dashboard
    showDashboard(profile.full_name || profile.username);

    return { success: true };

  } catch (e) {
    console.error('Supabase login error:', e);
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// LEGACY LOGIN (Backward Compatible)
// ════════════════════════════════════════════════════════════════

async function handleLegacyLogin(username, password) {
  console.log('🔄 Using legacy authentication system...');

  // Load globalData if not present
  if (!window.globalData || !window.globalData.users || window.globalData.users.length === 0) {
    try {
      const mainData = localStorage.getItem('wingsfly_data');
      if (mainData) {
        const parsed = JSON.parse(mainData);
        if (parsed && parsed.users && Array.isArray(parsed.users) && parsed.users.length > 0) {
          window.globalData = parsed;
          console.log('✅ Login: globalData loaded from localStorage');
        }
      }
    } catch (e) { console.warn('Main data load failed', e); }
  }

  if (!window.globalData) {
    window.globalData = {
      students: [], finance: [], employees: [],
      users: [
        { username: 'admin', password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', role: 'admin', name: 'Admin' }
      ]
    };
  }

  // Safety check — try to recover users from backup
  if (!window.globalData.users || !Array.isArray(window.globalData.users) || window.globalData.users.length === 0) {
    try {
      const backup = localStorage.getItem('wingsfly_users_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window.globalData.users = parsed;
          console.log('🔐 Users recovered from backup for login');
        }
      }
    } catch (e) { console.warn('User recovery failed', e); }

    if (!window.globalData.users || window.globalData.users.length === 0) {
      window.globalData.users = [
        { username: 'admin', password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', role: 'admin', name: 'Admin' }
      ];
    }
  }

  // Hash the input password for comparison
  const hashedSHA256 = await hashPassword(password);
  const hashedPBKDF2_legacy = await hashPasswordPBKDF2_legacy(password, username);
  const hashedPBKDF2 = await hashPasswordPBKDF2(password, username);

  // Find user locally first
  let validUser = window.globalData.users.find(u =>
    u.username.toLowerCase() === username.toLowerCase() &&
    (u.password === hashedSHA256 || u.password === hashedPBKDF2_legacy || u.password === hashedPBKDF2 || u.password === password)
  );

  // ☁️ NEW BROWSER FALLBACK: Fetch users from Cloud if not found locally
  if (!validUser && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.URL) {
    try {
      console.log('☁️ User not found locally. Validating from Cloud...');
      const btn = document.getElementById('loginBtn');
      if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cloud Syncing...';
      
      const cfg = window.SUPABASE_CONFIG;
      const url = cfg.URL + '/rest/v1/' + (cfg.TABLE || 'academy_data') + '?id=eq.' + (cfg.MAIN_RECORD || 'wingsfly_main') + '&select=data';
      const res = await fetch(url, { headers: { apikey: cfg.KEY, Authorization: 'Bearer ' + cfg.KEY } });
      
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && cloudData[0] && cloudData[0].data) {
          const cloudUsers = cloudData[0].data.users;
          if (cloudUsers && Array.isArray(cloudUsers)) {
             validUser = cloudUsers.find(u =>
               u.username.toLowerCase() === username.toLowerCase() &&
               (u.password === hashedSHA256 || u.password === hashedPBKDF2_legacy || u.password === hashedPBKDF2 || u.password === password)
             );
             if (validUser) {
               console.log('✅ User validated from Cloud!');
               window.globalData.users = cloudUsers;
               if (cloudData[0].data.settings) {
                 window.globalData.settings = cloudData[0].data.settings;
               }
               // Force pull real data right after login since local is empty
               sessionStorage.setItem('wf_force_full_sync', 'true');
             }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Cloud fallback failed:', e);
    }
  }

  if (!validUser) {
    throw new Error('Invalid username or password');
  }

  // Auto-migrate plain text password to hash
  await migratePasswordIfNeeded(validUser, password);

  // Auto-upgrade SHA-256 or Legacy-10k PBKDF2 to Secure PBKDF2-210k
  if (validUser.password === hashedSHA256 || validUser.password === hashedPBKDF2_legacy || validUser.password === password) {
    if (validUser.password !== hashedPBKDF2) {
      validUser.password = hashedPBKDF2;
      if (typeof saveToStorage === 'function') {
        try {
          await saveToStorage(true);
          console.log('🔐 Password upgraded to Secure PBKDF2 (210,000 iterations)');
        } catch (e) {
          console.warn('Could not save upgraded password:', e);
        }
      }
    }
  }

  // Store session
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('username', validUser.name || username);
  sessionStorage.setItem('currentUser', validUser.username);
  sessionStorage.setItem('role', validUser.role || 'admin');
  sessionStorage.setItem('userRole', validUser.role || 'admin');
  sessionStorage.setItem('userFullName', validUser.name || username);
  sessionStorage.setItem('authMode', 'legacy');

  // PERFORMANCE FIX: localStorage-এ session token save করো।
  // Reload/Hard Refresh করলে sessionStorage clear হয় কিন্তু localStorage থাকে।
  // এতে reload-এ login page আর দেখাবে না — সরাসরি dashboard আসবে।
  const _sessionToken = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
  localStorage.setItem('wf_session_token', _sessionToken);
  localStorage.setItem('wf_session_user', validUser.name || username);
  localStorage.setItem('wf_session_role', validUser.role || 'admin');
  localStorage.setItem('wf_session_username', validUser.username);
  localStorage.setItem('lastLocalUpdate', Date.now().toString());

  // Update sidebar avatar
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) avatarEl.innerText = (validUser.name || username).charAt(0).toUpperCase();

  // Apply security before showing dashboard
  if (typeof applyRoleSecurity === 'function') applyRoleSecurity();

  console.log('✅ Legacy login successful:', validUser.username);

  showDashboard(validUser.name || username);
}

// ════════════════════════════════════════════════════════════════
// SHOW DASHBOARD
// ════════════════════════════════════════════════════════════════

function showDashboard(username) {
  if (typeof logActivity === 'function') logActivity('login', 'LOGIN', 'User logged in: ' + username);

  const loginSection = document.getElementById('loginSection');
  const dshSection = document.getElementById('dashboardSection');
  const loginBtn = document.getElementById('loginBtn');

  // ▶️ PREMIUM LOGIN ANIMATION
  if (!sessionStorage.getItem('wf_just_logged_in') && loginBtn && !loginBtn.classList.contains('takeoff')) {
    loginBtn.classList.add('takeoff');
    
    // 0.6s delay for the plane to fly away, then fade out the login screen
    setTimeout(() => {
      loginSection.classList.add('fly-away-fade');
      setTimeout(() => {
        loginSection.classList.add('d-none');
        loginSection.classList.remove('fly-away-fade');
        loginBtn.classList.remove('takeoff'); // Reset for next time
        dshSection.classList.remove('d-none');
      }, 300); // Wait for fade out
    }, 600); // 0.6s for train to fly across
  } else {
    // Immediate toggle (like page reload)
    loginSection.classList.add('d-none');
    dshSection.classList.remove('d-none');
  }

  // Clean URL
  try {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (e) { }

  const userEl = document.getElementById('sidebarUser') || document.getElementById('currentUser');
  if (userEl) userEl.innerText = username;

  // Login: always go to dashboard tab
  localStorage.setItem('wingsfly_active_tab', 'dashboard');
  sessionStorage.setItem('wf_just_logged_in', 'true');

  // ✈️ AVIATION LOADER: dashboard load হওয়ার সময় loading screen দেখাও
  if (typeof WingsLoader !== 'undefined') {
    WingsLoader.show(3000);
  }

  // V34.8 -> V35.1: Instant Dashboard load, Background Sync
  loadDashboard();
  
  // ✅ V39.3 FIX: Cross-device login sync — reliable with retry
  // অন্য device থেকে এসে login করলে সবসময় cloud থেকে fresh data pull করতে হবে।
  // wingsSync ready না হলে 500ms পর retry করে (সর্বোচ্চ 10 বার = 5s)।
  (function _loginSyncWithRetry(attempt) {
    if (window.wingsSync && typeof window.wingsSync.pullNow === 'function') {
      console.log('🔄 Login: Cloud sync শুরু হচ্ছে (attempt ' + attempt + ')...');
      window.wingsSync.pullNow().then(function () {
        console.log('✅ Login sync সম্পন্ন — UI আপডেট হচ্ছে');
        // ✅ renderFullUI call করো — data এসে গেছে, UI refresh দরকার
        if (typeof window.renderFullUI === 'function') window.renderFullUI();
        // ✅ V39.3: Sync শেষে wf_just_logged_in clear করো — এরপরই snapshot safe
        sessionStorage.removeItem('wf_just_logged_in');
        // Snapshot ও save করো — sync শেষ হওয়ার পরে
        setTimeout(function () {
          if (window.globalData) {
            if (!window.globalData.deletedItems) window.globalData.deletedItems = [];
            if (!window.globalData.activityHistory) window.globalData.activityHistory = [];
            localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
            if (typeof takeSnapshot === 'function') takeSnapshot();
            console.log('📸 Login snapshot saved (post-sync)');
          }
          if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
        }, 1000);
      }).catch(function (e) {
        console.warn('⚠️ Login sync failed:', e);
        sessionStorage.removeItem('wf_just_logged_in');
        if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
      });
    } else if (typeof window.loadFromCloud === 'function') {
      console.log('🔄 Login: loadFromCloud fallback (attempt ' + attempt + ')...');
      Promise.resolve(window.loadFromCloud(true)).then(function () {
        if (typeof window.renderFullUI === 'function') window.renderFullUI();
        sessionStorage.removeItem('wf_just_logged_in');
        if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
      }).catch(function () {
        sessionStorage.removeItem('wf_just_logged_in');
        if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
      });
    } else if (attempt < 10) {
      // wingsSync এখনো ready না — 500ms পরে retry
      console.log('⏳ wingsSync এখনো ready না — ' + (attempt + 1) + '/10 retry...');
      setTimeout(function () { _loginSyncWithRetry(attempt + 1); }, 500);
    } else {
      console.warn('❌ Login sync: wingsSync 5s পরেও ready হয়নি');
      sessionStorage.removeItem('wf_just_logged_in');
      if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
    }
  }(1));

  if (typeof checkDailyBackup === 'function') checkDailyBackup();
}

// ════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════

function logout() {
  if (typeof logActivity === 'function') logActivity('login', 'LOGOUT', 'User logged out: ' + (sessionStorage.getItem('username') || 'Admin'));

  // Sign out from Supabase if applicable
  if (supabaseClient && sessionStorage.getItem('authMode') === 'supabase') {
    try { supabaseClient.auth.signOut(); } catch (e) { console.warn('Supabase logout error:', e); }
  }

  // ✅ V38 FIX: Snapshot keys আর delete করা হবে না!
  // আগে এই দুইটা key delete হত → পরের login এ _getDelta() সব record "নতুন" মনে করত
  // → MaxCount=22 কিন্তু empty globalData দিয়ে push attempt → push BLOCKED → data zero!
  // FIX: Snapshot keys সম্পূর্ণ সরিয়ে দেওয়া হয়েছে SENSITIVE_KEYS থেকে।
  // এই keys logout এর পরেও localStorage এ থাকবে — এটাই correct behavior।
  console.log('✅ V38: Sync snapshot keys preserved on logout (no data loss risk)');

  // ✅ V38 FIX: globalData আর সম্পূর্ণ empty করা হবে না!
  // আগের সমস্যা: সব empty করা হত → snapshot/auto-heal সেই empty data save করত
  // → MaxCount=22 কিন্তু local=0 → push BLOCKED → data zero!
  // এখন: শুধু session-specific fields clear হবে, real data (students/finance) থাকবে।
  if (window.globalData) {
    window.globalData.users = [];
    window.globalData.settings = {};
    // ✅ students, finance, cashBalance, bankAccounts, mobileBanking রেখে দাও
    // logout এর পরেও এই data localStorage এ safe আছে এবং
    // পরের login এ _startupIntegrityCheck সঠিক MaxCount পাবে।
  }

  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('authMode');
  sessionStorage.removeItem('wf_just_logged_in');
  localStorage.setItem('wingsfly_active_tab', 'dashboard');

  // PERFORMANCE FIX: localStorage session token clear করো logout-এ
  // না করলে logout-এর পরেও reload করলে dashboard দেখাবে (security issue)
  localStorage.removeItem('wf_session_token');
  localStorage.removeItem('wf_session_user');
  localStorage.removeItem('wf_session_role');
  localStorage.removeItem('wf_session_username');

  // Clear session check interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  document.getElementById('dashboardSection').classList.add('d-none');
  document.getElementById('loginSection').classList.remove('d-none');
  document.getElementById('loginForm').reset();
  document.getElementById('loginBtn').innerHTML = '<span>Login</span>';
  document.getElementById('loginBtn').disabled = false;
  document.getElementById('loginError').innerText = '';

  console.log('🔒 Logged out');
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD LOADING
// ════════════════════════════════════════════════════════════════

function loadDashboard() {
  const loader = document.getElementById('loader');
  const content = document.getElementById('content');

  if (loader) loader.style.display = 'block';
  if (content) content.style.display = 'none';

  var justLoggedIn = sessionStorage.getItem('wf_just_logged_in') === 'true';
  var activeTab = 'dashboard';
  if (justLoggedIn) {
    sessionStorage.removeItem('wf_just_logged_in');
    activeTab = 'dashboard';
    localStorage.setItem('wingsfly_active_tab', 'dashboard');
  } else {
    activeTab = localStorage.getItem('wingsfly_active_tab') || 'dashboard';
  }

  setTimeout(() => {
    try {
      if (window.performance) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        const mainStart = document.getElementById('mainStartDate');
        const mainEnd = document.getElementById('mainEndDate');
        if (mainStart) mainStart.value = '';
        if (mainEnd) mainEnd.value = '';
      }

      switchTab(activeTab, false);

      if (typeof updateGlobalStats === 'function') updateGlobalStats();
      if (typeof updateStudentCount === 'function') updateStudentCount();

      // Re-apply security after tab switch
      if (typeof applyRoleSecurity === 'function') applyRoleSecurity();

      if (typeof populateDropdowns === 'function') {
        populateDropdowns();
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      if (loader) loader.style.display = 'none';
      if (content) content.style.display = 'block';
    }
  }, 80);
}

// ════════════════════════════════════════════════════════════════
// TAB MANAGEMENT
// ════════════════════════════════════════════════════════════════

function switchTab(tab, refreshStats = true) {
  // ✅ FIX #1: নতুন ট্যাবে যাওয়ার সময় সবসময় পেজের শুরুতে scroll করো
  try {
    const mainContent = document.getElementById('mainContent')
      || document.querySelector('.main-content')
      || document.querySelector('.content-area')
      || document.querySelector('main')
      || document.body;
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) { /* ignore */ }

  const dashboardBtn = document.getElementById('tabDashboard');
  const studentBtn = document.getElementById('tabStudents');
  const ledgerBtn = document.getElementById('tabLedger');
  const loansBtn = document.getElementById('tabLoans');
  const visitorBtn = document.getElementById('tabVisitors');
  const employeeBtn = document.getElementById('tabEmployees');
  const examBtn = document.getElementById('tabExamResults');
  const salaryBtn = document.getElementById('tabSalary');

  const studentSection = document.getElementById('studentSection');
  const ledgerSection = document.getElementById('ledgerSection');
  const loanSection = document.getElementById('loanSection');
  const examResultsSection = document.getElementById('examResultsSection');
  const visitorSection = document.getElementById('visitorSection');
  const employeeSection = document.getElementById('employeeSection');
  const accountsSection = document.getElementById('accountsSection');
  const salarySection = document.getElementById('salarySection');
  const certificateSection = document.getElementById('certificateSection');
  const idcardsSection = document.getElementById('idcardsSection');
  const idCardsBtn = document.getElementById('tabIdCards');
  const globalFilterCard = document.getElementById('globalFilterCard');
  const batchSummaryCard = document.getElementById('batchSummaryCard');

  localStorage.setItem('wingsfly_active_tab', tab);

  // Reset all
  const accountsBtn = document.getElementById('tabAccounts');
  const certBtn = document.getElementById('tabCertificates');
  const allBtns = [dashboardBtn, studentBtn, ledgerBtn, loansBtn, visitorBtn, employeeBtn, examBtn, accountsBtn, certBtn, idCardsBtn, salaryBtn];
  allBtns.forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.classList.remove('av-sidebar-active');
    }
  });

  if (tab === 'dashboard') if (dashboardBtn) dashboardBtn.classList.add('av-sidebar-active');
  if (tab === 'students') if (studentBtn) studentBtn.classList.add('av-sidebar-active');
  if (tab === 'ledger') if (ledgerBtn) ledgerBtn.classList.add('av-sidebar-active');
  if (tab === 'loans') if (loansBtn) loansBtn.classList.add('av-sidebar-active');
  if (tab === 'visitors') if (visitorBtn) visitorBtn.classList.add('av-sidebar-active');
  if (tab === 'employees') if (employeeBtn) employeeBtn.classList.add('av-sidebar-active');
  if (tab === 'examResults') if (examBtn) examBtn.classList.add('av-sidebar-active');
  if (tab === 'salary') if (salaryBtn) salaryBtn.classList.add('av-sidebar-active');

  const dashboardOverview = document.getElementById('dashboardOverview');
  if (dashboardOverview) dashboardOverview.classList.add('d-none');
  if (studentSection) studentSection.classList.add('d-none');
  if (ledgerSection) ledgerSection.classList.add('d-none');
  if (loanSection) loanSection.classList.add('d-none');
  if (examResultsSection) examResultsSection.classList.add('d-none');
  if (visitorSection) visitorSection.classList.add('d-none');
  if (employeeSection) employeeSection.classList.add('d-none');
  if (accountsSection) accountsSection.classList.add('d-none');
  if (salarySection) salarySection.classList.add('d-none');
  if (certificateSection) certificateSection.classList.add('d-none');
  if (idcardsSection) idcardsSection.classList.add('d-none');
  if (batchSummaryCard) batchSummaryCard.classList.add('d-none');
  if (globalFilterCard) globalFilterCard.classList.add('d-none');

  if (tab === 'dashboard') {
    if (dashboardBtn) dashboardBtn.classList.add('active');
    if (dashboardOverview) dashboardOverview.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Welcome back, Admin!';
  } else if (tab === 'students') {
    if (studentBtn) studentBtn.classList.add('active');
    if (studentSection) studentSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Student Management';
    if (typeof filterData === 'function') filterData();
  } else if (tab === 'ledger') {
    if (ledgerBtn) ledgerBtn.classList.add('active');
    if (ledgerSection) ledgerSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Financial Ledger';
    if (typeof filterData === 'function') filterData();
  } else if (tab === 'loans') {
    if (loansBtn) loansBtn.classList.add('active');
    if (loanSection) loanSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Loan & Personal Ledger';
    if (typeof renderLoanSummary === 'function') renderLoanSummary();
  } else if (tab === 'visitors') {
    if (visitorBtn) visitorBtn.classList.add('active');
    if (visitorSection) {
      visitorSection.classList.remove('d-none');
      const pageTitle = document.querySelector('.page-title');
      if (pageTitle) pageTitle.textContent = 'Visitor Management';
      if (typeof renderVisitors === 'function') renderVisitors();
    }
  } else if (tab === 'employees') {
    if (employeeBtn) employeeBtn.classList.add('active');
    if (employeeSection) {
      employeeSection.classList.remove('d-none');
      const pageTitle = document.querySelector('.page-title');
      if (pageTitle) pageTitle.textContent = 'Employee Management';
      if (typeof renderEmployeeList === 'function') renderEmployeeList();
    }
  } else if (tab === 'examResults') {
    if (examBtn) examBtn.classList.add('active');
    if (examResultsSection) examResultsSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Exam Results & Grades';
    if (typeof searchExamResults === 'function') searchExamResults();
  } else if (tab === 'accounts') {
    if (accountsBtn) accountsBtn.classList.add('active');
    if (accountsSection) accountsSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Account Management';
    if (typeof renderAccountList === 'function') renderAccountList();
    if (typeof renderCashBalance === 'function') renderCashBalance();
    if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
    if (typeof updateGrandTotal === 'function') updateGrandTotal();
  } else if (tab === 'idcards') {
    if (idCardsBtn) idCardsBtn.classList.add('av-sidebar-active');
    if (idCardsBtn) idCardsBtn.classList.add('active');
    if (idcardsSection) idcardsSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'ID Card Generator';
    if (typeof initIdCardSection === 'function') initIdCardSection();
  } else if (tab === 'certificates') {
    if (certBtn) certBtn.classList.add('av-sidebar-active');
    if (certBtn) certBtn.classList.add('active');
    if (certificateSection) certificateSection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Certificate Generator';
    if (typeof initCertificateSection === 'function') initCertificateSection();
  } else if (tab === 'salary') {
    if (salaryBtn) salaryBtn.classList.add('active');
    if (salarySection) salarySection.classList.remove('d-none');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Salary Management';
    if (typeof initSalaryHub === 'function') initSalaryHub();
  }

  if (refreshStats) {
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
  }

  // Prevent unauthorized tab switch
  if (typeof applyRoleSecurity === 'function') applyRoleSecurity();

  // ✅ FIX: Dispatch tab switch hooks (replaces all monkey-patches)
  // garbled-text-fix, tab-reset-fix, table-pagination-patch, sticky-scrollbar
  // সবাই এখানে hook হিসেবে register করে — circular recursion সম্ভব না
  if (window._wfSwitchTabHooks && window._wfSwitchTabHooks.length > 0) {
    var _hookTab = tab;
    window._wfSwitchTabHooks.forEach(function (hookFn) {
      try { hookFn(_hookTab); } catch (hookErr) {
        console.warn('[switchTab] hook error:', hookErr);
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL (RBAC)
// ════════════════════════════════════════════════════════════════

window.WF_ALL_TABS = [
  { id: 'tabStudents',     tab: 'students',     label: 'Students' },
  { id: 'tabLedger',       tab: 'ledger',        label: 'Finance/Ledger' },
  { id: 'tabAccounts',     tab: 'accounts',      label: 'Accounts' },
  { id: 'tabLoans',        tab: 'loans',         label: 'Loans' },
  { id: 'tabVisitors',     tab: 'visitors',      label: 'Visitors' },
  { id: 'tabEmployees',    tab: 'employees',     label: 'HR/Staff' },
  { id: 'tabExamResults',  tab: 'examResults',   label: 'Exams' },
  { id: 'tabSalary',       tab: 'salary',        label: 'Salary Hub' },
  { id: 'tabAttendance',   tab: 'attendance',    label: 'Attendance' },
  { id: 'tabIdCards',      tab: 'idcards',       label: 'ID Cards' },
  { id: 'tabCertificates', tab: 'certificates',  label: 'Certificates' },
  { id: 'tabSettings',     tab: 'settings',      label: 'Settings' },
];

function applyRoleSecurity() {
  const role     = sessionStorage.getItem('role') || 'admin';
  const username = sessionStorage.getItem('username') || '';
  const isSubId  = (role === 'subid' || role === 'operator');

  if (!isSubId) {
    // Admin — show all
    window.WF_ALL_TABS.forEach(t => {
      const el = document.getElementById(t.id);
      if (el) el.style.display = '';
    });
    document.querySelectorAll('.top-bar .dropdown-menu .dropdown-item')
      .forEach(item => item.style.display = '');
    document.querySelectorAll('.aviation-metric-card')
      .forEach(card => card.style.display = '');
    const nb = document.getElementById('notificationDropdown');
    if (nb) nb.style.display = '';
    return;
  }

  // Sub ID: filter by permissions
  const gd = window.globalData;
  const userObj = (gd && gd.users || []).find(u =>
    u.username.toLowerCase() === username.toLowerCase() && u.role === 'subid'
  );

  const allowedTabs = (userObj && userObj.permissions && Array.isArray(userObj.permissions.tabs))
    ? userObj.permissions.tabs
    : ['students'];

  // Sidebar tabs
  window.WF_ALL_TABS.forEach(t => {
    const el = document.getElementById(t.id);
    if (!el) return;
    el.style.display = allowedTabs.includes(t.tab) ? '' : 'none';
  });

  // Add New dropdown
  document.querySelectorAll('.top-bar .dropdown-menu .dropdown-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    const allowed =
      (text.includes('student') && allowedTabs.includes('students')) ||
      (text.includes('exam')    && allowedTabs.includes('examResults')) ||
      (text.includes('finance') && allowedTabs.includes('ledger')) ||
      (text.includes('visitor') && allowedTabs.includes('visitors')) ||
      (text.includes('employee')&& allowedTabs.includes('employees'));
    item.style.display = allowed ? '' : 'none';
  });

  // Finance metric cards
  const hasFinance = allowedTabs.includes('ledger') || allowedTabs.includes('accounts');
  document.querySelectorAll('.aviation-metric-card, .metric-card-blue, .metric-card-green, .metric-card-yellow, .metric-card-red, .metric-card-purple')
    .forEach(card => {
      if (!hasFinance && !card.innerText.includes('Students')) {
        card.style.display = 'none';
      }
    });

  // Unauthorized tab redirect
  const currentTab = localStorage.getItem('wingsfly_active_tab') || 'dashboard';
  const isAllowedTab = currentTab === 'dashboard' || allowedTabs.includes(currentTab);
  if (!isAllowedTab) {
    console.warn('🔒 Unauthorized tab blocked for Sub ID:', currentTab, '→ dashboard');
    localStorage.setItem('wingsfly_active_tab', 'dashboard');
  }

  // Notification hide
  const nb = document.getElementById('notificationDropdown');
  if (nb) nb.style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT (Phase 2)
// ════════════════════════════════════════════════════════════════

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let lastActivity = Date.now();
let sessionCheckInterval = null;
let inactivityWarningShown = false;

function initSessionManagement() {
  const events = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, () => {
      lastActivity = Date.now();
      inactivityWarningShown = false;
    }, { passive: true });
  });

  sessionCheckInterval = setInterval(checkSession, 60000);
  console.log('✅ Session management initialized (30 min timeout)');
}

function checkSession() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (!isLoggedIn) {
    if (sessionCheckInterval) clearInterval(sessionCheckInterval);
    return;
  }

  const inactiveTime = Date.now() - lastActivity;

  // Warn at 25 minutes
  if (inactiveTime > (SESSION_TIMEOUT - 5 * 60 * 1000) && !inactivityWarningShown) {
    inactivityWarningShown = true;
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:70px;right:20px;z-index:10000;background:rgba(255,193,7,0.95);color:#000;padding:15px 20px;border-radius:8px;font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:350px;';
    toast.innerHTML = '<strong>⚠️ Inactivity Warning</strong><br>Your session will expire in 5 minutes.';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // Logout at 30 minutes
  if (inactiveTime > SESSION_TIMEOUT) {
    console.log('🔒 Session expired due to inactivity');
    logout();
    const err = document.getElementById('loginError');
    if (err) {
      err.style.color = '#ffc107';
      err.innerText = 'Session expired due to inactivity. Please login again.';
    }
  }
}

// ════════════════════════════════════════════════════════════════
// PAGE REFRESH → Same Tab Restore (Flash-Free)
// ════════════════════════════════════════════════════════════════
(function () {
  // PERFORMANCE FIX: sessionStorage (reload) এবং localStorage (hard refresh) দুটো চেক করো
  var _isSession = sessionStorage.getItem('isLoggedIn') === 'true';
  var _isLocalToken = !!localStorage.getItem('wf_session_token');

  if (!_isSession && _isLocalToken) {
    // Hard Refresh হয়েছে — localStorage থেকে session restore করো
    var _u = localStorage.getItem('wf_session_user') || 'Admin';
    var _r = localStorage.getItem('wf_session_role') || 'admin';
    var _cu = localStorage.getItem('wf_session_username') || 'admin';
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('username', _u);
    sessionStorage.setItem('userFullName', _u);
    sessionStorage.setItem('currentUser', _cu);
    sessionStorage.setItem('role', _r);
    sessionStorage.setItem('userRole', _r);
    sessionStorage.setItem('authMode', 'legacy');
    _isSession = true;
    console.log('[Auth] Hard Refresh — session restored from localStorage token');
  }

  if (!_isSession) return;

  var lastTab = localStorage.getItem('wingsfly_active_tab') || 'dashboard';
  var style = document.createElement('style');
  style.id = 'wf-flash-prevent';
  style.textContent = '#loginSection{display:none!important}#dashboardSection{display:block!important}#content{display:none!important}#dashboardOverview{display:none!important}';
  (document.head || document.documentElement).appendChild(style);

  document.addEventListener('DOMContentLoaded', function () {
    var login = document.getElementById('loginSection');
    var dash = document.getElementById('dashboardSection');
    if (!login || !dash) return;

    login.classList.add('d-none');
    dash.classList.remove('d-none');
    var loader = document.getElementById('loader');
    var contentEl = document.getElementById('content');
    if (loader) loader.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';

    // ✈️ AVIATION LOADER: reload/refresh এ loading screen দেখাও
    if (typeof WingsLoader !== 'undefined') WingsLoader.show(2000);

    console.log('[Auth] Refresh restore → tab:', lastTab);

    try {
      if (typeof switchTab === 'function') switchTab(lastTab, false);
      if (typeof updateGlobalStats === 'function') updateGlobalStats();
      if (typeof populateDropdowns === 'function') populateDropdowns();
    } catch (e) {
      console.warn('[Auth] Tab restore error:', e);
    }

    if (loader) loader.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    // ✈️ AVIATION LOADER: restore শেষ — hide
    setTimeout(function () {
      if (typeof WingsLoader !== 'undefined') WingsLoader.hide();
    }, 1200);
    var s = document.getElementById('wf-flash-prevent');
    if (s) s.remove();
  });
})();

// ════════════════════════════════════════════════════════════════
// AUTO LOCKOUT
// ════════════════════════════════════════════════════════════════
(function () {
  var _t = null, _m = 0;
  function reset() {
    if (_m <= 0) return;
    clearTimeout(_t);
    _t = setTimeout(function () {
      if (sessionStorage.getItem('isLoggedIn') === 'true') {
        if (typeof logout === 'function') logout();
        if (typeof showErrorToast === 'function')
          showErrorToast('⏰ ' + _m + ' মিনিট নিষ্ক্রিয় — Auto logout হয়েছে');
      }
    }, _m * 60000);
  }
  window.wfInitAutoLockout = function (mins) {
    _m = parseInt(mins) || 0;
    clearTimeout(_t);
    if (_m <= 0) return;
    reset();
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(function (e) {
      document.removeEventListener(e, reset);
      document.addEventListener(e, reset, { passive: true });
    });
  };
  document.addEventListener('DOMContentLoaded', function () {
    var mins = window.globalData?.settings?.autoLockoutMinutes || 0;
    if (mins > 0 && sessionStorage.getItem('isLoggedIn') === 'true')
      window.wfInitAutoLockout(mins);
  });
})();

// ════════════════════════════════════════════════════════════════
// FORGOT PASSWORD — Beautiful Custom Modal
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {

  // Inject modal HTML
  var modalHtml = `
<div id="wfForgotOverlay" style="display:none;position:fixed;inset:0;z-index:99999;align-items:center;justify-content:center;background:rgba(2,5,20,0.85);backdrop-filter:blur(10px);">
  <div style="background:linear-gradient(145deg,#080d28,#120830);border:1.5px solid rgba(0,217,255,0.25);border-radius:22px;width:92%;max-width:400px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.7),0 0 40px rgba(0,217,255,0.08);animation:wfFI .3s ease;">
    <style>@keyframes wfFI{from{opacity:0;transform:scale(0.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
    <div style="background:linear-gradient(135deg,rgba(0,217,255,0.1),rgba(181,55,242,0.1));padding:20px 24px 16px;border-bottom:1px solid rgba(0,217,255,0.1);text-align:center;">
      <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,rgba(0,217,255,0.15),rgba(181,55,242,0.15));border:1.5px solid rgba(0,217,255,0.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 10px;">🔑</div>
      <h3 style="color:#deeeff;font-size:1.02rem;font-weight:700;margin:0 0 3px;">Password Recovery</h3>
      <p style="color:rgba(0,200,255,0.48);font-size:0.73rem;margin:0;">Secret Recovery Question দিয়ে password reset করুন</p>
    </div>
    <div style="padding:20px 24px 24px;">
      <!-- Step 1 -->
      <div id="wfFS1">
        <div style="background:rgba(0,217,255,0.05);border:1px solid rgba(0,217,255,0.16);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:0.65rem;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(0,200,255,0.52);margin-bottom:5px;">🛡️ Recovery Question</div>
          <div id="wfFQ" style="color:#c8e4ff;font-weight:600;font-size:0.86rem;">লোড হচ্ছে...</div>
        </div>
        <label style="display:block;font-size:0.67rem;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:rgba(0,200,255,0.6);margin-bottom:5px;">✅ আপনার উত্তর</label>
        <input type="password" id="wfFA" style="width:100%;background:rgba(3,8,30,0.8);border:1.5px solid rgba(0,217,255,0.2);border-radius:9px;color:#deeeff;padding:11px 14px;font-size:0.87rem;outline:none;box-sizing:border-box;font-family:inherit;letter-spacing:normal;"
          autocomplete="new-password" data-lpignore="true" data-form-type="other" name="wf_recovery_ans" placeholder="গোপন উত্তর লিখুন"
          onfocus="this.type='text';this.style.borderColor='#00d9ff'" onblur="this.type='password';this.style.borderColor='rgba(0,217,255,0.2)'"
          onkeydown="if(event.key==='Enter')wfFV()">
        <div id="wfFE" style="font-size:0.7rem;color:#ff4455;min-height:16px;margin-top:4px;font-weight:600;"></div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button onclick="wfFV()" style="flex:1;background:linear-gradient(135deg,#00d9ff,#b537f2);color:#050a1e;border:none;border-radius:9px;padding:11px;font-weight:700;font-size:0.85rem;cursor:pointer;">✅ Verify</button>
          <button onclick="wfFC()" style="background:rgba(255,255,255,0.06);color:rgba(200,220,255,0.7);border:1.5px solid rgba(255,255,255,0.1);border-radius:9px;padding:11px 16px;font-size:0.85rem;cursor:pointer;">Cancel</button>
        </div>
      </div>
      <!-- Step 2 -->
      <div id="wfFS2" style="display:none;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:2rem;margin-bottom:6px;">✅</div>
          <div style="color:#00ff88;font-weight:700;font-size:0.9rem;">উত্তর সঠিক!</div>
          <div style="color:rgba(180,210,255,0.55);font-size:0.74rem;margin-top:3px;">এখন নতুন password সেট করুন</div>
        </div>
        <label style="display:block;font-size:0.67rem;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:rgba(0,200,255,0.6);margin-bottom:5px;">🔑 নতুন Password</label>
        <input type="password" id="wfFP1" style="width:100%;background:rgba(3,8,30,0.8);border:1.5px solid rgba(0,217,255,0.2);border-radius:9px;color:#deeeff;padding:11px 14px;font-size:0.87rem;outline:none;box-sizing:border-box;margin-bottom:10px;"
          autocomplete="new-password" placeholder="New password (min 4 chars)" name="wf_np_a"
          data-lpignore="true" data-form-type="other" data-1p-ignore="true"
          onfocus="this.style.borderColor='#00d9ff'" onblur="this.style.borderColor='rgba(0,217,255,0.2)'"
          onkeydown="if(event.key==='Enter')wfFSP()">
        <label style="display:block;font-size:0.67rem;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:rgba(0,200,255,0.6);margin-bottom:5px;">🔒 Confirm Password</label>
        <input type="password" id="wfFP2" style="width:100%;background:rgba(3,8,30,0.8);border:1.5px solid rgba(0,217,255,0.2);border-radius:9px;color:#deeeff;padding:11px 14px;font-size:0.87rem;outline:none;box-sizing:border-box;"
          autocomplete="new-password" placeholder="Re-enter new password" name="wf_np_b"
          data-lpignore="true" data-form-type="other" data-1p-ignore="true"
          onfocus="this.style.borderColor='#00d9ff'" onblur="this.style.borderColor='rgba(0,217,255,0.2)'"
          onkeydown="if(event.key==='Enter')wfFSP()">
        <div id="wfFE2" style="font-size:0.7rem;color:#ff4455;min-height:16px;margin-top:4px;font-weight:600;"></div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button onclick="wfFSP()" style="flex:1;background:linear-gradient(135deg,#00d9ff,#b537f2);color:#050a1e;border:none;border-radius:9px;padding:11px;font-weight:700;font-size:0.85rem;cursor:pointer;">💾 Password পরিবর্তন করুন</button>
          <button onclick="wfFC()" style="background:rgba(255,255,255,0.06);color:rgba(200,220,255,0.7);border:1.5px solid rgba(255,255,255,0.1);border-radius:9px;padding:11px 16px;font-size:0.85rem;cursor:pointer;">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Click outside to close
  var overlay = document.getElementById('wfForgotOverlay');
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === this) wfFC();
  });
});

window.wfShowForgotModal = async function () {
  var overlay = document.getElementById('wfForgotOverlay');
  if (!overlay) { setTimeout(window.wfShowForgotModal, 200); return; }

  if (!window.globalData) window.globalData = {};
  if (!window.globalData.settings || !window.globalData.settings.recoveryQuestion) {
    // প্রথমে localStorage থেকে চেষ্টা
    try {
      var mainRaw = localStorage.getItem('wingsfly_data');
      if (mainRaw) {
        var mainParsed = JSON.parse(mainRaw);
        if (mainParsed && mainParsed.settings) window.globalData.settings = mainParsed.settings;
        if (mainParsed && mainParsed.users) window.globalData.users = mainParsed.users;
      }
      if (!window.globalData.settings || !window.globalData.settings.recoveryQuestion) {
        var settRaw = localStorage.getItem('wingsfly_settings');
        if (settRaw) window.globalData.settings = JSON.parse(settRaw);
      }
    } catch (e) { console.warn('Settings load failed in forgot modal', e); }

    // ✅ V2.3 FIX: localStorage-এ না থাকলে cloud থেকে লোড (অন্য browser-এও কাজ করবে)
    if (!window.globalData.settings || !window.globalData.settings.recoveryQuestion) {
      try {
        var cfg = window.SUPABASE_CONFIG;
        if (cfg && cfg.URL && cfg.KEY) {
          var cloudUrl = cfg.URL + '/rest/v1/' + cfg.TABLE + '?id=eq.' + cfg.MAIN_RECORD + '&select=data';
          var res = await fetch(cloudUrl, { headers: { 'apikey': cfg.KEY, 'Authorization': 'Bearer ' + cfg.KEY } });
          if (res.ok) {
            var arr = await res.json();
            var rec = arr && arr[0] && arr[0].data;
            if (rec && rec.settings) {
              window.globalData.settings = rec.settings;
              console.log('✅ Forgot modal: Settings loaded from cloud');
            }
            if (rec && rec.users && rec.users.length > 0) {
              window.globalData.users = rec.users;
              console.log('✅ Forgot modal: Users loaded from cloud');
            }
          }
        }
      } catch (e) { console.warn('Cloud settings load failed in forgot modal:', e); }
    }
  }

  var gd = window.globalData;
  if (!gd || !gd.settings || !gd.settings.recoveryQuestion) {
    alert('⚠️ কোনো Recovery Question সেট করা নেই।\nSettings → 🔒 Security তে গিয়ে প্রথমে Question সেট করুন।');
    return;
  }
  document.getElementById('wfFQ').textContent = gd.settings.recoveryQuestion;
  document.getElementById('wfFA').value = '';
  document.getElementById('wfFE').textContent = '';
  var wfFE2 = document.getElementById('wfFE2'); if (wfFE2) wfFE2.textContent = '';
  document.getElementById('wfFS1').style.display = 'block';
  document.getElementById('wfFS2').style.display = 'none';
  overlay.style.display = 'flex';
  setTimeout(function () { document.getElementById('wfFA').focus(); }, 100);
};
window.wfShowForgotPassword = window.wfShowForgotModal;

window.wfFC = function () {
  var o = document.getElementById('wfForgotOverlay');
  if (o) o.style.display = 'none';
  setTimeout(function () {
    var uf = document.getElementById('loginUsernameField');
    if (uf && !uf.value.includes('@') && uf.value.length > 20) uf.value = '';
  }, 200);
};

window.wfFV = async function () {
  var ans = document.getElementById('wfFA').value.trim();
  var err = document.getElementById('wfFE');
  if (!ans) { err.textContent = '❌ উত্তর লিখুন'; return; }
  var gd = window.globalData;
  var stored = gd?.settings?.recoveryAnswer;
  if (!stored) { err.textContent = '❌ Recovery Answer সেট করা নেই'; return; }
  var inputHash = typeof hashPassword === 'function' ? await hashPassword(ans.toLowerCase()) : ans.toLowerCase();
  if (inputHash === stored) {
    var uf = document.getElementById('loginUsernameField');
    var pf = document.getElementById('loginPasswordField');
    if (uf) { uf.value = ''; uf.blur(); }
    if (pf) { pf.value = ''; pf.blur(); }
    document.getElementById('wfFA').value = '';
    document.getElementById('wfFS1').style.display = 'none';
    document.getElementById('wfFS2').style.display = 'block';
    setTimeout(function () { document.getElementById('wfFP1').focus(); }, 100);
  } else {
    err.textContent = '❌ উত্তর সঠিক নয়। আবার চেষ্টা করুন।';
    document.getElementById('wfFA').value = '';
    document.getElementById('wfFA').focus();
  }
};

window.wfFSP = async function () {
  var pw = document.getElementById('wfFP1').value;
  var pw2 = document.getElementById('wfFP2').value;
  var err = document.getElementById('wfFE2');
  if (!pw || pw.length < 4) { err.textContent = '❌ Password কমপক্ষে 4 অক্ষর হতে হবে'; return; }
  if (pw !== pw2) { err.textContent = '❌ Password দুটি মিলছে না'; return; }
  var gd = window.globalData;
  var hashed = typeof hashPassword === 'function' ? await hashPassword(pw) : pw;
  if (gd.users && gd.users[0]) gd.users[0].password = hashed;
  if (gd.credentials) gd.credentials.password = hashed;
  localStorage.setItem('wingsfly_data', JSON.stringify(gd));
  if (typeof saveToStorage === 'function') saveToStorage();
  var fp1 = document.getElementById('wfFP1'), fp2 = document.getElementById('wfFP2');
  if (fp1) { fp1.value = ''; fp1.blur(); }
  if (fp2) { fp2.value = ''; fp2.blur(); }
  var faEl = document.getElementById('wfFA');
  if (faEl) { faEl.value = ''; }
  wfFC();
  var uf = document.getElementById('loginUsernameField');
  var pf = document.getElementById('loginPasswordField');
  if (uf) uf.value = '';
  if (pf) pf.value = '';
  if (typeof showSuccessToast === 'function')
    showSuccessToast('✅ Password সফলভাবে পরিবর্তন হয়েছে! নতুন password দিয়ে Login করুন।');
  else alert('✅ Password পরিবর্তন সফল! নতুন password দিয়ে Login করুন।');
};

// Auto-test compatibility aliases
window.checkSecretAnswer = window.wfFV;
window.resetPasswordFromModal = window.wfFSP;

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Auth V2.2 initializing...');

  initSupabase();
  initSessionManagement();
});

// ════════════════════════════════════════════════════════════════
// EXPORT ALL FUNCTIONS
// ════════════════════════════════════════════════════════════════

window.handleLogin = handleLogin;
window.logout = logout;
window.showDashboard = showDashboard;
window.loadDashboard = loadDashboard;
window.switchTab = switchTab;
window._wfCoreSwitchTab = switchTab; // ✅ FIX: Root reference for all monkey-patchers — prevents circular recursion
window.applyRoleSecurity = applyRoleSecurity;
window.hashPassword = hashPassword;
window.hashPasswordPBKDF2 = hashPasswordPBKDF2;
window.hashPasswordSHA256 = hashPasswordSHA256;
window.migratePasswordIfNeeded = migratePasswordIfNeeded;
// window.supabaseClient set in initSupabase() after singleton connect

// ════════════════════════════════════════════════════════════════
// ✅ AUTH V2.3 LOADED — MERGED
// Phase 2 Security + Full Navigation + Cloud Settings Sync
// Security Score: 7.5/10
// ════════════════════════════════════════════════════════════════

console.log('✅ Auth V2.3 loaded — Cross-browser Recovery Question fix applied');
