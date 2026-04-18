// ============================================================
// Wings Fly Aviation Academy — Global Command Palette (Spotlight)
// Fixed bugs:
// - Student search now uses correct DB.students key
// - Ctrl+Space removed (interfered with normal typing)
// - All navigation commands added (was missing many tabs)
// - updateSelection() DOM query made safe (null checks)
// ============================================================

const CommandPalette = (() => {
  let modal = null;
  let input = null;
  let resultsContainer = null;
  let isVisible = false;
  let selectedIndex = 0;
  let currentResults = [];

  // FIX: all navigation commands added, was missing many tabs
  const COMMANDS = [
    { type: 'nav', title: 'Dashboard', icon: 'fa-home',             action: () => App.navigateTo('dashboard') },
    { type: 'nav', title: 'Students', icon: 'fa-user-graduate',     action: () => App.navigateTo('students') },
    { type: 'nav', title: 'Finance Ledger', icon: 'fa-book-open',   action: () => App.navigateTo('finance') },
    { type: 'nav', title: 'Accounts', icon: 'fa-landmark',          action: () => App.navigateTo('accounts') },
    { type: 'nav', title: 'Loans', icon: 'fa-hand-holding-dollar',  action: () => App.navigateTo('loans') },
    { type: 'nav', title: 'Exams', icon: 'fa-clipboard-list',       action: () => App.navigateTo('exam') },
    { type: 'nav', title: 'Attendance', icon: 'fa-calendar-check',  action: () => App.navigateTo('attendance') },
    { type: 'nav', title: 'Salary Hub', icon: 'fa-money-check',     action: () => App.navigateTo('salary') },
    { type: 'nav', title: 'HR / Staff', icon: 'fa-users',           action: () => App.navigateTo('hr-staff') },
    { type: 'nav', title: 'Visitors', icon: 'fa-person',            action: () => App.navigateTo('visitors') },
    { type: 'nav', title: 'ID Cards', icon: 'fa-id-card',           action: () => App.navigateTo('id-cards') },
    { type: 'nav', title: 'Certificates', icon: 'fa-trophy',        action: () => App.navigateTo('certificates') },
    { type: 'nav', title: 'Notice Board', icon: 'fa-bullhorn',      action: () => App.navigateTo('notice-board') },
    { type: 'nav', title: 'Settings', icon: 'fa-gear',              action: () => App.navigateTo('settings') },
    { type: 'action', title: 'Add New Student', icon: 'fa-user-plus',    action: () => App.quickAction('student') },
    { type: 'action', title: 'Add Transaction', icon: 'fa-money-bill',   action: () => App.quickAction('transaction') },
    { type: 'action', title: 'Add Loan', icon: 'fa-circle-plus',         action: () => App.quickAction('loan') },
    { type: 'action', title: 'Add Visitor', icon: 'fa-person-walking',   action: () => App.quickAction('visitor') },
    { type: 'action', title: 'Toggle Theme', icon: 'fa-moon',            action: () => document.getElementById('btn-theme-toggle')?.click() },
    { type: 'auth',   title: 'Log Out', icon: 'fa-sign-out-alt',         action: () => App.logout() },
  ];

  function init() {
    modal = document.createElement('div');
    modal.className = 'command-palette-backdrop';
    modal.style.cssText = `
      display: none; position: fixed; inset: 0; z-index: 999999;
      background: rgba(0, 10, 30, 0.6); backdrop-filter: blur(8px);
      align-items: flex-start; justify-content: center; padding-top: 15vh;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      width: 100%; max-width: 620px;
      background: rgba(5, 12, 28, 0.97);
      border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0, 217, 255, 0.15);
      overflow: hidden; display: flex; flex-direction: column;
    `;

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `display:flex; align-items:center; padding:16px 24px; border-bottom:1px solid rgba(255,255,255,0.06);`;
    inputWrapper.innerHTML = '<i class="fa fa-magnifying-glass" style="color:#00d4ff;font-size:1.2rem;margin-right:16px"></i>';

    input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search commands, students, finance…';
    input.style.cssText = `flex:1; background:transparent; border:none; outline:none; color:#fff; font-size:1.1rem; font-family:'Inter',sans-serif;`;
    inputWrapper.appendChild(input);
    box.appendChild(inputWrapper);

    resultsContainer = document.createElement('div');
    resultsContainer.style.cssText = `max-height: 380px; overflow-y: auto; padding: 6px 0;`;
    box.appendChild(resultsContainer);

    const footer = document.createElement('div');
    footer.style.cssText = `padding:8px 24px; background:rgba(0,0,0,0.25); border-top:1px solid rgba(255,255,255,0.05); font-size:0.73rem; color:var(--text-muted); display:flex; gap:16px; flex-wrap:wrap;`;
    footer.innerHTML = `
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Ctrl</kbd> + <kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">K</kbd> to toggle</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">↑↓</kbd> navigate</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Enter</kbd> select</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Esc</kbd> close</span>
    `;
    box.appendChild(footer);
    modal.appendChild(box);
    document.body.appendChild(modal);

    // FIX: only Ctrl+K (removed Ctrl+Space which interfered with normal typing)
    document.addEventListener('keydown', handleGlobalKeydown, { capture: true });
    input.addEventListener('input', () => { selectedIndex = 0; renderResults(); });
    input.addEventListener('keydown', handleInputKeydown);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  function handleGlobalKeydown(e) {
    // FIX: only Ctrl+K, removed Ctrl+Space
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (localStorage.getItem('wfa_logged_in') === 'true') toggle();
    }
    if (e.key === 'Escape' && isVisible) close();
  }

  function handleInputKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex < currentResults.length - 1) { selectedIndex++; updateSelection(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex > 0) { selectedIndex--; updateSelection(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) executeCommand(currentResults[selectedIndex]);
    }
  }

  function executeCommand(item) {
    if (item.action) {
      item.action();
    } else if (item.student_id) {
      App.navigateTo('students');
      setTimeout(() => {
        const sInput = document.getElementById('stu-search');
        if (sInput) { sInput.value = item.name; sInput.dispatchEvent(new Event('input')); }
      }, 350);
    }
    close();
  }

  function toggle() { if (isVisible) close(); else open(); }

  function open() {
    isVisible = true;
    modal.style.display = 'flex';
    input.value = '';
    selectedIndex = 0;
    renderResults();
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    isVisible = false;
    modal.style.display = 'none';
    input.blur();
  }

  function renderResults() {
    const query = input.value.trim().toLowerCase();
    currentResults = [];

    // filter static commands
    const matched = COMMANDS.filter(c => c.title.toLowerCase().includes(query) || c.type.includes(query));
    currentResults.push(...matched);

    // FIX: use correct DB table key via DB object
    if (query.length > 1 && typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
      const students = SupabaseSync.getAll(DB.students) || [];
      students
        .filter(s =>
          (s.name || '').toLowerCase().includes(query) ||
          (s.phone || '').includes(query) ||
          (s.student_id || '').toLowerCase().includes(query)
        )
        .slice(0, 5)
        .forEach(s => {
          currentResults.push({
            type: 'student',
            title: `${s.name}`,
            subtitle: `ID: ${s.student_id} · Phone: ${s.phone}`,
            icon: 'fa-user',
            student_id: s.student_id,
            name: s.name,
          });
        });
    }

    if (currentResults.length === 0) {
      resultsContainer.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted)">No results for "<strong>${query}</strong>"</div>`;
      return;
    }

    resultsContainer.innerHTML = currentResults.map((res, idx) => {
      const isSelected = idx === selectedIndex;
      return `
        <div class="cp-item" data-idx="${idx}" style="
          padding:11px 20px; display:flex; align-items:center; gap:14px; cursor:pointer;
          background:${isSelected ? 'rgba(0,217,255,0.08)' : 'transparent'};
          border-left:3px solid ${isSelected ? '#00d4ff' : 'transparent'};
        ">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;color:${isSelected ? '#00d4ff' : 'rgba(255,255,255,0.55)'}">
            <i class="fa ${res.icon}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.92rem;font-weight:${isSelected ? '600' : '400'};color:${isSelected ? '#fff' : 'rgba(255,255,255,0.8)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${res.title}</div>
            ${res.subtitle ? `<div style="font-size:0.73rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${res.subtitle}</div>` : ''}
          </div>
          <span style="font-size:0.68rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.05);color:var(--text-muted);text-transform:uppercase;flex-shrink:0">${res.type}</span>
        </div>
      `;
    }).join('');

    resultsContainer.querySelectorAll('.cp-item').forEach(el => {
      el.addEventListener('mouseover', () => {
        selectedIndex = parseInt(el.getAttribute('data-idx'));
        updateSelection();
      });
      el.addEventListener('click', () => executeCommand(currentResults[parseInt(el.getAttribute('data-idx'))]));
    });
  }

  // FIX: safe DOM update — no fragile querySelector chains
  function updateSelection() {
    const items = resultsContainer.querySelectorAll('.cp-item');
    items.forEach((item, idx) => {
      const isSelected = idx === selectedIndex;
      item.style.background = isSelected ? 'rgba(0,217,255,0.08)' : 'transparent';
      item.style.borderLeftColor = isSelected ? '#00d4ff' : 'transparent';

      const iconDiv = item.querySelector('div');
      if (iconDiv) iconDiv.style.color = isSelected ? '#00d4ff' : 'rgba(255,255,255,0.55)';

      const titleDiv = item.querySelector('div + div > div');
      if (titleDiv) {
        titleDiv.style.fontWeight = isSelected ? '600' : '400';
        titleDiv.style.color = isSelected ? '#fff' : 'rgba(255,255,255,0.8)';
      }

      if (isSelected) item.scrollIntoView({ block: 'nearest' });
    });
  }

  return { init, open, close };
})();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => CommandPalette.init(), 1200);
});
