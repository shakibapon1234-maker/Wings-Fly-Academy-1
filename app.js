/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/core/app.js
   Main app logic — tab switching, login, init
════════════════════════════════════════════════ */

const App = (() => {

  let currentTab = 'dashboard';
  let isLoggedIn = false;

  /* ══════════════════════════════════════════
     ADMIN CREDENTIALS (localStorage-based)
  ══════════════════════════════════════════ */
  const DEFAULT_ADMIN = { username: 'admin', password: 'wings2024' };

  function getAdmin() {
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_KEY));
      return stored || DEFAULT_ADMIN;
    } catch { return DEFAULT_ADMIN; }
  }

  function saveAdmin(username, password) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ username, password }));
  }

  /* ══════════════════════════════════════════
     LOGIN / LOGOUT
  ══════════════════════════════════════════ */
  function login(username, password) {
    const admin = getAdmin();
    if (username === admin.username && password === admin.password) {
      isLoggedIn = true;
      localStorage.setItem('wfa_session', '1');
      showApp();
      return true;
    }
    return false;
  }

  function logout() {
    isLoggedIn = false;
    localStorage.removeItem('wfa_session');
    showLogin();
  }

  function checkSession() {
    return localStorage.getItem('wfa_session') === '1';
  }

  function showLogin() {
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('app-shell').classList.add('hidden');
  }

  function showApp() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('app-shell').classList.remove('hidden');
    initApp();
  }

  /* ══════════════════════════════════════════
     TAB SWITCHING
  ══════════════════════════════════════════ */
  function switchTab(tabName) {
    /* Hide all sections */
    document.querySelectorAll('.tab-section').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });

    /* Show target */
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }

    /* Nav highlight */
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    currentTab = tabName;

    /* Mobile: close sidebar */
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }

    /* Load tab content */
    loadTab(tabName);
  }

  function loadTab(tabName) {
    switch (tabName) {
      case 'dashboard':   if (window.Dashboard)  Dashboard.render();  break;
      case 'students':    if (window.Students)   Students.render();   break;
      case 'finance':     if (window.Finance)    Finance.render();    break;
      case 'accounts':    if (window.Accounts)   Accounts.render();   break;
      case 'loans':       if (window.Loans)      Loans.render();      break;
      case 'exam':        if (window.Exam)        Exam.render();       break;
      case 'attendance':  if (window.Attendance) Attendance.render(); break;
      case 'hr-staff':    if (window.HRStaff)    HRStaff.render();    break;
      case 'salary':      if (window.Salary)     Salary.render();     break;
      case 'visitors':    if (window.Visitors)   Visitors.render();   break;
      case 'id-cards':    if (window.IDCards)    IDCards.render();    break;
      case 'certificates':if (window.Certificates) Certificates.render(); break;
      case 'notice-board':if (window.NoticeBoard) NoticeBoard.render(); break;
      case 'settings':    if (window.Settings)   Settings.render();   break;
    }
  }

  function refreshCurrentTab() {
    loadTab(currentTab);
  }

  /* ══════════════════════════════════════════
     SIDEBAR TOGGLE
  ══════════════════════════════════════════ */
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main    = document.getElementById('main-content');

    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('sidebar-collapsed');
    }
  }

  /* ══════════════════════════════════════════
     QUICK ADD
  ══════════════════════════════════════════ */
  function quickAction(type) {
    /* Menu বন্ধ করো */
    document.getElementById('quick-add-menu').classList.add('hidden');

    switch (type) {
      case 'student':     switchTab('students');    setTimeout(() => Students.openAddModal(), 200);    break;
      case 'transaction': switchTab('finance');     setTimeout(() => Finance.openAddModal(), 200);     break;
      case 'exam':        switchTab('exam');        setTimeout(() => Exam.openRegModal(), 200);        break;
      case 'visitor':     switchTab('visitors');    setTimeout(() => Visitors.openAddModal(), 200);    break;
    }
  }

  /* ══════════════════════════════════════════
     DATE DISPLAY
  ══════════════════════════════════════════ */
  function updateDateDisplay() {
    const el = document.getElementById('today-date-display');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('bn-BD', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /* ══════════════════════════════════════════
     ADMIN NAME DISPLAY
  ══════════════════════════════════════════ */
  function updateAdminName() {
    const el = document.getElementById('admin-name-display');
    if (!el) return;
    const settings = SupabaseSync.localGetObj(SupabaseSync.LS.settings);
    const admin    = getAdmin();
    el.textContent = settings.admin_name || admin.username || 'Admin';
  }

  /* ══════════════════════════════════════════
     NOTIFICATION BELL
  ══════════════════════════════════════════ */
  function updateNotifCount() {
    /* বাকি payment + expired notices count */
    const students = SupabaseSync.getAll(DB.students);
    const dueCnt   = students.filter(s => Utils.safeNum(s.due) > 0).length;
    const notices  = SupabaseSync.getAll(DB.notices);
    const expiredCnt = notices.filter(n => n.expires_at && new Date(n.expires_at) < new Date()).length;
    const total = dueCnt + expiredCnt;

    const badge = document.getElementById('notif-count');
    if (!badge) return;
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════
     EVENT LISTENERS
  ══════════════════════════════════════════ */
  function bindEvents() {

    /* Login form */
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl    = document.getElementById('login-error');

        if (!login(username, password)) {
          errEl.textContent = 'ভুল ইউজারনেম বা পাসওয়ার্ড';
          errEl.classList.remove('hidden');
          setTimeout(() => errEl.classList.add('hidden'), 3000);
        }
      });
    }

    /* Logout */
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      const ok = await Utils.confirm('আপনি কি লগআউট করতে চান?', 'লগআউট');
      if (ok) logout();
    });

    /* Sidebar toggle */
    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);

    /* Nav items */
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    /* Modal close */
    document.getElementById('modal-close-btn')?.addEventListener('click', Utils.closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) Utils.closeModal();
    });

    /* Quick add toggle */
    const qaBtn  = document.getElementById('quick-add-btn');
    const qaMenu = document.getElementById('quick-add-menu');
    qaBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      qaMenu?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => qaMenu?.classList.add('hidden'));

    /* Sync buttons */
    document.getElementById('btn-sync-now')?.addEventListener('click', () => SupabaseSync.push());
    document.getElementById('btn-pull')?.addEventListener('click',     () => SupabaseSync.pull());
    document.getElementById('btn-push')?.addEventListener('click',     () => SupabaseSync.push());

    /* Notification bell */
    document.getElementById('notif-btn')?.addEventListener('click', () => {
      Utils.toast('শিগগিরই বিস্তারিত নোটিফিকেশন আসছে', 'info');
    });

    /* Keyboard shortcut: Escape closes modal */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.closeModal();
    });
  }

  /* ══════════════════════════════════════════
     INIT APP (after login)
  ══════════════════════════════════════════ */
  function initApp() {
    updateDateDisplay();
    updateAdminName();

    /* First tab */
    switchTab('dashboard');

    /* Supabase sync start */
    SupabaseSync.init();

    /* Notification update every 60s */
    updateNotifCount();
    setInterval(updateNotifCount, 60_000);

    /* Notice timers update every 60s */
    setInterval(() => {
      if (currentTab === 'notice-board' && window.NoticeBoard) NoticeBoard.renderTimers();
      if (currentTab === 'dashboard' && window.Dashboard) Dashboard.renderNotices();
    }, 60_000);
  }

  /* ══════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════ */
  function boot() {
    bindEvents();

    if (checkSession()) {
      isLoggedIn = true;
      showApp();
    } else {
      showLogin();
    }
  }

  /* Run on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Public API */
  return {
    switchTab,
    refreshCurrentTab,
    quickAction,
    saveAdmin,
    getAdmin,
    updateAdminName,
    updateNotifCount,
    getCurrentTab: () => currentTab,
  };

})();
