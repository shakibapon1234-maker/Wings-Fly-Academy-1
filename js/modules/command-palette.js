// ============================================================
// Wings Fly Aviation Academy — Global Command Palette (Spotlight)
// ============================================================

const CommandPalette = (() => {
  let modal = null;
  let input = null;
  let resultsContainer = null;
  let isVisible = false;
  let selectedIndex = 0;
  let currentResults = [];

  const COMMANDS = [
    { type: 'navigation', title: 'Go to Dashboard', icon: 'fa-home', action: () => App.navigateTo('dashboard') },
    { type: 'navigation', title: 'Open Settings', icon: 'fa-gear', action: () => App.navigateTo('settings') },
    { type: 'navigation', title: 'View Students', icon: 'fa-user-graduate', action: () => App.navigateTo('students') },
    { type: 'navigation', title: 'Finance Ledger', icon: 'fa-book-open', action: () => App.navigateTo('finance') },
    { type: 'action', title: 'Add New Student', icon: 'fa-plus', action: () => App.quickAction('student') },
    { type: 'action', title: 'Add Transaction', icon: 'fa-money-bill', action: () => App.quickAction('transaction') },
    { type: 'auth', title: 'Log Out', icon: 'fa-sign-out-alt', action: () => App.logout() },
    { type: 'theme', title: 'Toggle Theme', icon: 'fa-moon', action: () => document.getElementById('btn-theme-toggle')?.click() },
  ];

  function init() {
    modal = document.createElement('div');
    modal.className = 'command-palette-backdrop';
    modal.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0, 10, 30, 0.6);
      backdrop-filter: blur(8px);
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      width: 100%;
      max-width: 600px;
      background: rgba(5, 12, 28, 0.95);
      border: 1px solid rgba(0, 217, 255, 0.3);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.15);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `
      display: flex;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    `;
    inputWrapper.innerHTML = '<i class="fa fa-magnifying-glass" style="color:#00d4ff;font-size:1.2rem;margin-right:16px"></i>';

    input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search commands or data (e.g. students, settings)...';
    input.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 1.1rem;
      font-family: 'Inter', sans-serif;
    `;
    inputWrapper.appendChild(input);
    box.appendChild(inputWrapper);

    resultsContainer = document.createElement('div');
    resultsContainer.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      padding: 8px 0;
    `;
    box.appendChild(resultsContainer);

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 8px 24px;
      background: rgba(0,0,0,0.2);
      border-top: 1px solid rgba(255,255,255,0.05);
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      gap: 16px;
    `;
    footer.innerHTML = `
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Ctrl</kbd> + <kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">K</kbd> or <kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Space</kbd> to open</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">↑↓</kbd> to navigate</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Enter</kbd> to select</span>
      <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px">Esc</kbd> to close</span>
    `;
    box.appendChild(footer);

    modal.appendChild(box);
    document.body.appendChild(modal);

    document.addEventListener('keydown', handleGlobalKeydown, { capture: true });
    input.addEventListener('input', () => { selectedIndex = 0; renderResults(); });
    input.addEventListener('keydown', handleInputKeydown);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  function handleGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'Space')) {
      e.preventDefault();
      if (localStorage.getItem('wfa_logged_in') === 'true') {
        toggle();
      }
    }
  }

  function handleInputKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex < currentResults.length - 1) {
        selectedIndex++;
        updateSelection();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        executeCommand(currentResults[selectedIndex]);
      } else if (input.value.trim() !== '') {
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
          globalSearch.value = input.value;
          globalSearch.dispatchEvent(new Event('input'));
        }
        close();
      }
    }
  }

  function executeCommand(item) {
    if (item.action) {
      item.action();
    } else if (item.student_id) {
       App.navigateTo('students');
       setTimeout(() => {
          const sInput = document.getElementById('stu-search');
          if (sInput) { sInput.value = item.student_id; sInput.dispatchEvent(new Event('input')); }
       }, 300);
    }
    close();
  }

  function toggle() {
    if (isVisible) close();
    else open();
  }

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

    const matchedCommands = COMMANDS.filter(c => 
      c.title.toLowerCase().includes(query) || 
      c.type.toLowerCase().includes(query)
    );
    currentResults.push(...matchedCommands);

    if (query.length > 2 && typeof SupabaseSync !== 'undefined') {
       const students = SupabaseSync.getAll('wfa_students') || [];
       const matchedStudents = students.filter(s => 
         (s.name || '').toLowerCase().includes(query) || 
         (s.phone || '').includes(query) ||
         (s.student_id || '').toLowerCase().includes(query)
       ).slice(0, 5);

       matchedStudents.forEach(s => {
          currentResults.push({
             type: 'student',
             title: `${s.name} (${s.student_id})`,
             subtitle: `Phone: ${s.phone}`,
             icon: 'fa-user',
             student_id: s.student_id
          });
       });
    }

    if (currentResults.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted)">No commands or students found for "${Utils.esc(query)}"</div>`;
      return;
    }

    resultsContainer.innerHTML = currentResults.map((res, idx) => `
      <div class="cp-item ${idx === selectedIndex ? 'selected' : ''}" data-idx="${idx}" style="
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        cursor: pointer;
        background: ${idx === selectedIndex ? 'rgba(0, 217, 255, 0.1)' : 'transparent'};
        border-left: 3px solid ${idx === selectedIndex ? '#00d4ff' : 'transparent'};
      ">
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:${idx === selectedIndex ? '#00d4ff' : 'rgba(255,255,255,0.7)'}">
          <i class="fa ${res.icon}"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:0.95rem; font-weight:${idx === selectedIndex ? '600' : '400'}; color:${idx === selectedIndex ? '#fff' : 'rgba(255,255,255,0.8)'}">${res.title}</div>
          ${res.subtitle ? `<div style="font-size:0.75rem; color:var(--text-muted)">${res.subtitle}</div>` : ''}
        </div>
        <div style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.05); color:var(--text-muted); text-transform:uppercase">${res.type}</div>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.cp-item').forEach(el => {
       el.addEventListener('mouseover', () => {
          selectedIndex = parseInt(el.getAttribute('data-idx'));
          updateSelection();
       });
       el.addEventListener('click', () => {
          executeCommand(currentResults[selectedIndex]);
       });
    });
  }

  function updateSelection() {
    const items = resultsContainer.querySelectorAll('.cp-item');
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.style.background = 'rgba(0, 217, 255, 0.1)';
        item.style.borderLeftColor = '#00d4ff';
        item.querySelector('div').style.color = '#00d4ff';
        item.querySelector('div > i').parentElement.nextElementSibling.querySelector('div').style.fontWeight = '600';
        item.querySelector('div > i').parentElement.nextElementSibling.querySelector('div').style.color = '#fff';
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.style.background = 'transparent';
        item.style.borderLeftColor = 'transparent';
        item.querySelector('div').style.color = 'rgba(255,255,255,0.7)';
        item.querySelector('div > i').parentElement.nextElementSibling.querySelector('div').style.fontWeight = '400';
        item.querySelector('div > i').parentElement.nextElementSibling.querySelector('div').style.color = 'rgba(255,255,255,0.8)';
      }
    });
  }

  return { init, open, close };
})();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => CommandPalette.init(), 1000);
});
