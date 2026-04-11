// ============================================================
// Wings Fly Aviation Academy — Main App (Tab Switching & Init)
// ============================================================

const App = (() => {

  const SECTIONS = [
    'dashboard', 'students', 'finance', 'accounts', 'loans',
    'exam', 'attendance', 'salary', 'hr-staff',
    'visitors', 'id-cards', 'certificates', 'notice-board', 'settings'
  ];

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

  function login(password) {
    const settings = SupabaseSync.getAll(DB.settings)[0] || {};
    const correct = settings.admin_password || 'admin123';
    if (password === correct) {
      localStorage.setItem('wfa_logged_in', 'true');
      showApp();
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem('wfa_logged_in');
    showLogin();
    SyncEngine.stopAutoSync();
  }

  // ── Show/Hide ─────────────────────────────────────────────
  function showLogin() {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    if (loginEl) loginEl.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';
  }

  function showApp() {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-wrapper');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
    navigateTo('dashboard');
    SyncEngine.startAutoSync();
  }

  // ── Navigation ────────────────────────────────────────────
  function navigateTo(section) {
    if (!SECTIONS.includes(section)) return;

    // Settings opens as a modal overlay instead of navigating
    if (section === 'settings') {
      if (typeof SettingsModule !== 'undefined') SettingsModule.openModal();
      return;
    }

    // Attendance opens as a modal overlay
    if (section === 'attendance') {
      if (typeof Attendance !== 'undefined') Attendance.openModal();
      return;
    }

    currentSection = section;

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
    }

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
    try {
      switch (section) {
        case 'dashboard':     if (typeof DashboardModule !== 'undefined')    DashboardModule.render(); break;
        case 'students':      if (typeof Students !== 'undefined')           Students.render(); break;
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
      console.warn(`[App] Error rendering ${section}:`, e);
    }
  }

  // ── Quick Actions ─────────────────────────────────────────
  function quickAction(type) {
    switch (type) {
      case 'student':     navigateTo('students');  setTimeout(() => { if (typeof Students !== 'undefined') Students.openAddModal(); }, 200); break;
      case 'transaction': navigateTo('finance');   setTimeout(() => { if (typeof Finance !== 'undefined') Finance.openAddModal(); }, 200); break;
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
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pw = document.getElementById('login-password')?.value;
        const errEl = document.getElementById('login-error');
        const ok = login(pw);
        if (!ok) {
          if (errEl) {
            errEl.textContent = 'Password Has been wrong!';
            errEl.classList.remove('hidden');
          }
          Utils.toast('Password Has been wrong!', 'error');
        }
      });
    }

    // Quick Add toggle
    const quickAddBtn = document.getElementById('btn-quick-add');
    const quickAddMenu = document.getElementById('quick-add-menu');
    if (quickAddBtn && quickAddMenu) {
      quickAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAddMenu.style.display = quickAddMenu.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => { quickAddMenu.style.display = 'none'; });
    }

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('wfa_theme', next);
        themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
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
    });
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Apply saved theme
    const savedTheme = localStorage.getItem('wfa_theme') || 'aurora-wave';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    bindEvents();

    if (isLoggedIn()) {
      showApp();
    } else {
      showLogin();
    }

    updateNotifCount();
  }

  return { init, navigateTo, login, logout, isLoggedIn, toggleSidebar, quickAction, updateNotifCount };
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
