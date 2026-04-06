// ============================================================
// Wings Fly Aviation Academy — Main App (Tab Switching & Init)
// ============================================================

const App = (() => {

  // ── All Sections / Tabs ───────────────────────────────────
  const SECTIONS = [
    'login', 'dashboard', 'students', 'finance', 'accounts',
    'loans', 'exam', 'attendance', 'salary', 'hr-staff',
    'visitors', 'id-cards', 'certificates', 'notice-board', 'settings'
  ];

  let currentSection = 'dashboard';

  // ── Auth State ────────────────────────────────────────────
  function isLoggedIn() {
    return localStorage.getItem('wfa_logged_in') === 'true';
  }

  function login(password) {
    const settings = SyncEngine.getLocal('settings')[0] || {};
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

  // ── Section Rendering ─────────────────────────────────────
  function showLogin() {
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }

  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';
    navigateTo('dashboard');
    SyncEngine.startAutoSync();
  }

  function navigateTo(section) {
    if (!SECTIONS.includes(section)) return;
    currentSection = section;

    // hide all sections
    SECTIONS.forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.style.display = 'none';
    });

    // show target section
    const target = document.getElementById(`section-${section}`);
    if (target) {
      target.style.display = 'block';
      target.classList.add('section-enter');
      setTimeout(() => target.classList.remove('section-enter'), 400);
    }

    // update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // update page title
    const titles = {
      dashboard: '📊 Dashboard',
      students: '👩‍🎓 Students',
      finance: '💰 Finance Ledger',
      accounts: '🏦 Accounts',
      loans: '💳 Loans',
      exam: '📝 Exam',
      attendance: '📋 Attendance',
      salary: '💵 Salary Hub',
      'hr-staff': '👥 HR & Staff',
      visitors: '🚶 Visitors',
      'id-cards': '🪪 ID Cards',
      certificates: '🏆 Certificates',
      'notice-board': '📢 Notice Board',
      settings: '⚙️ Settings',
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[section] || section;

    // trigger module refresh
    window.dispatchEvent(new CustomEvent('wfa:navigate', { detail: { section } }));
  }

  // ── Sidebar toggle (mobile) ───────────────────────────────
  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  // ── Event Bindings ────────────────────────────────────────
  function bindEvents() {
    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.section);
        // close sidebar on mobile
        if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Hamburger (mobile)
    const hamburger = document.getElementById('btn-hamburger');
    if (hamburger) hamburger.addEventListener('click', toggleSidebar);

    // Sync buttons
    const syncNow = document.getElementById('btn-sync-now');
    if (syncNow) syncNow.addEventListener('click', () => SyncEngine.pull());

    const syncPush = document.getElementById('btn-sync-push');
    if (syncPush) syncPush.addEventListener('click', () => SyncEngine.push());

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pw = document.getElementById('login-password')?.value;
        const ok = login(pw);
        if (!ok) Utils.toast('পাসওয়ার্ড ভুল হয়েছে!', 'error');
      });
    }

    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.style.display = 'none';
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    bindEvents();
    if (isLoggedIn()) {
      showApp();
    } else {
      showLogin();
    }
  }

  return { init, navigateTo, login, logout, isLoggedIn, toggleSidebar };
})();

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
