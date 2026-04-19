/**
 * Wings Fly Academy — AI Voice Assistant Module (v2.0)
 * Supports: Navigation + Intelligent Report Commands
 *
 * REPORT COMMANDS:
 *  - "today's report" / "give me report of today"
 *  - "total salary of [month]" / "salary report april"
 *  - "student report" / "how many students"
 *  - "finance summary" / "income today"
 *  - "total due" / "pending due"
 *  - "account balance"
 *  - "attendance today" / "who is present today"
 *  - "help" / "what can you do"
 */

const VoiceAssistant = (() => {
  let isListening = false;
  let recognition  = null;
  let synth        = window.speechSynthesis;
  let voiceInstance = null;
  let btn = null;

  /* ── INIT ─────────────────────────────────────── */
  function init() {
    btn = document.createElement('button');
    btn.id = 'ai-voice-btn';
    btn.title = 'Voice Assistant (Click to speak)';
    btn.innerHTML = '<i class="fa fa-microphone"></i>';
    btn.style.cssText = `
      position:fixed; bottom:20px; right:20px; width:55px; height:55px;
      border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-accent));
      color:#fff; border:none; font-size:1.4rem;
      box-shadow:0 0 20px rgba(181,55,242,0.4); cursor:pointer;
      z-index:9998; transition:transform 0.2s,box-shadow 0.2s; display:none;
    `;
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout  = () => btn.style.transform = 'scale(1)';
    btn.onclick = toggleListening;
    document.body.appendChild(btn);

    checkVisibility();
    window.addEventListener('wfa:navigate', checkVisibility);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous    = false;
      recognition.lang          = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListening = true;
        btn.style.boxShadow = '0 0 30px rgba(0,255,136,0.8)';
        btn.style.animation = 'pulseCardGlow 1s infinite alternate';
        btn.innerHTML = '<i class="fa fa-microphone-lines"></i>';
        if (typeof Utils !== 'undefined') Utils.toast('Listening… Speak now.', 'info');
      };
      recognition.onresult = (e) => {
        const cmd = e.results[0][0].transcript.toLowerCase().trim();
        console.log('[Voice] Command:', cmd);
        processCommand(cmd);
      };
      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && typeof Utils !== 'undefined')
          Utils.toast('Mic error: ' + e.error, 'error');
        stopUI();
      };
      recognition.onend = stopUI;
    } else {
      console.warn('[Voice] Speech Recognition not supported.');
      if (btn) btn.style.display = 'none';
    }

    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = setVoice;

    window.addEventListener('wfa:navigate', (e) => {
      if (e.detail?.section === 'dashboard') setTimeout(greetUser, 1500);
    });
  }

  function checkVisibility() {
    if (!btn) return;
    const loggedIn = localStorage.getItem('wfa_logged_in') === 'true';
    btn.style.display    = loggedIn ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  }

  function setVoice() {
    const voices = synth.getVoices();
    voiceInstance = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'))
                 || voices.find(v => v.lang === 'en-US')
                 || voices[0] || null;
  }

  function speak(text) {
    if (!text || synth.speaking) { synth.cancel(); }
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (!voiceInstance) setVoice();
      u.voice = voiceInstance;
      u.pitch = 1; u.rate = 1;
      synth.speak(u);
    } catch(e) { console.warn('[Voice] speak error:', e); }
  }

  function greetUser() {
    if (localStorage.getItem('wfa_logged_in') === 'true')
      speak('Welcome back, Admin. System is online and ready.');
  }

  function toggleListening() {
    if (!recognition) return;
    if (isListening) { recognition.stop(); stopUI(); }
    else { try { recognition.start(); } catch(e) { console.warn(e); } }
  }

  function stopUI() {
    isListening = false;
    const b = document.getElementById('ai-voice-btn');
    if (b) {
      b.style.animation  = 'none';
      b.style.boxShadow  = '0 0 20px rgba(181,55,242,0.4)';
      b.innerHTML        = '<i class="fa fa-microphone"></i>';
    }
  }

  /* ── HELPERS ──────────────────────────────────── */
  function safeNum(v) { return parseFloat(v) || 0; }
  function taka(n)    { return '৳' + Math.round(n).toLocaleString('en-IN'); }
  function today()    { return new Date().toISOString().split('T')[0]; }

  function getMonthIndex(cmd) {
    const months = ['january','february','march','april','may','june',
                    'july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++)
      if (cmd.includes(months[i])) return { idx: i, name: months[i].charAt(0).toUpperCase()+months[i].slice(1) };
    return null;
  }

  /* ── REPORT MODAL ─────────────────────────────── */
  function showReport(title, icon, rows, footer, voiceText) {
    speak(voiceText);

    const rowsHTML = rows.map(([label, val, color]) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
        <span style="color:rgba(255,255,255,0.7);font-size:0.88rem">${label}</span>
        <span style="font-weight:700;font-size:0.95rem;color:${color||'var(--text-primary)'}">${val}</span>
      </div>`
    ).join('');

    const html = `
      <div style="min-width:320px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid var(--brand-primary)">
          <i class="fa ${icon}" style="color:var(--brand-primary);font-size:1.4rem"></i>
          <div style="font-size:1rem;font-weight:800;letter-spacing:0.5px">${title}</div>
        </div>
        <div>${rowsHTML}</div>
        ${footer ? `<div style="margin-top:14px;padding:10px 14px;background:rgba(0,212,255,0.07);border-radius:8px;font-size:0.8rem;color:rgba(255,255,255,0.5)">${footer}</div>` : ''}
      </div>`;

    if (typeof Utils !== 'undefined' && Utils.openModal)
      Utils.openModal(`<i class="fa ${icon}"></i> ${title}`, html, 'modal-sm');
  }

  /* ── REPORT GENERATORS ────────────────────────── */

  function reportToday() {
    const todayStr = today();
    const finance  = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.finance) : [];
    const students = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.students) : [];
    const salary   = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.salary||'salary') : [];
    const exams    = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.exams) : [];

    const todayFin    = finance.filter(f => (f.date||'').startsWith(todayStr));
    const todayIncome = todayFin.filter(f => f.type==='Income').reduce((s,f) => s+safeNum(f.amount), 0);
    const todayExp    = todayFin.filter(f => f.type==='Expense').reduce((s,f) => s+safeNum(f.amount), 0);
    const todayStudents = students.filter(s => (s.admission_date||'').startsWith(todayStr)).length;
    const todayExams  = exams.filter(e => (e.exam_date||'').startsWith(todayStr)).length;
    const net         = todayIncome - todayExp;
    const txCount     = todayFin.length;

    const d = new Date();
    const dateLabel = d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    showReport(
      "Today's Report",
      'fa-calendar-day',
      [
        ["📅 Date",               dateLabel,              '#00e5ff'],
        ["💰 Income",              taka(todayIncome),      '#00ff88'],
        ["💸 Expense",             taka(todayExp),         '#ff4757'],
        ["📊 Net (Today)",         (net>=0?'+':'')+taka(net), net>=0?'#f7b731':'#ff4757'],
        ["🧾 Transactions",        txCount + ' records',   '#a0c4ff'],
        ["🎓 New Students",        todayStudents,          '#00e5ff'],
        ["📝 Exams Scheduled",     todayExams,             '#c084fc'],
      ],
      `Report generated on ${dateLabel}`,
      `Today's summary: Income ${taka(todayIncome)}, Expense ${taka(todayExp)}, Net ${taka(net)}.`
    );
  }

  function reportSalary(cmd) {
    const monthInfo = getMonthIndex(cmd);
    const allSalary = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.salary||'salary') : [];
    const finance   = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.finance) : [];
    const hrStaff   = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.hrStaff||'hr_staff') : [];

    let targetRecords, label;
    if (monthInfo) {
      const mm = String(monthInfo.idx + 1).padStart(2, '0');
      const year = new Date().getFullYear();
      targetRecords = allSalary.filter(s => {
        const d = s.payment_date || s.month || s.date || '';
        return d.includes(`${year}-${mm}`) || d.toLowerCase().includes(monthInfo.name.toLowerCase());
      });
      // Also check finance for salary category
      const finSalary = finance.filter(f => {
        const d = f.date || '';
        return f.category === 'Salary' && (d.includes(`${year}-${mm}`));
      });
      if (!targetRecords.length) targetRecords = finSalary;
      label = monthInfo.name + ' ' + year;
    } else {
      // current month
      const now = new Date();
      const mm  = String(now.getMonth()+1).padStart(2,'0');
      const year = now.getFullYear();
      targetRecords = allSalary.filter(s => {
        const d = s.payment_date || s.month || s.date || '';
        return d.includes(`${year}-${mm}`);
      });
      const finSalary = finance.filter(f => {
        const d = f.date || '';
        return f.category === 'Salary' && d.includes(`${year}-${mm}`);
      });
      if (!targetRecords.length) targetRecords = finSalary;
      label = now.toLocaleString('default', { month:'long' }) + ' ' + year;
    }

    const total = targetRecords.reduce((s, r) => s + safeNum(r.amount || r.salary_amount || r.net_salary), 0);
    const count = targetRecords.length;

    // Per-person breakdown (top 5)
    const perPerson = {};
    targetRecords.forEach(r => {
      const name = r.staff_name || r.person_name || r.description || 'Staff';
      perPerson[name] = (perPerson[name]||0) + safeNum(r.amount || r.salary_amount || r.net_salary);
    });

    const rows = [
      ["📅 Period",           label,               '#00e5ff'],
      ["👥 Staff Paid",        count + ' records',  '#ffaa00'],
      ["💰 Total Salary",      taka(total),         '#00ff88'],
    ];
    Object.entries(perPerson).slice(0,5).forEach(([name, amt]) => {
      rows.push([`  👤 ${name}`, taka(amt), 'rgba(255,255,255,0.8)']);
    });
    if (Object.keys(perPerson).length > 5) {
      rows.push([`  …and ${Object.keys(perPerson).length - 5} more`, '', '#888']);
    }

    showReport(
      `Salary Report — ${label}`,
      'fa-money-check-dollar',
      rows,
      count === 0 ? '⚠️ No salary records found for this period.' : null,
      count > 0
        ? `Total salary for ${label} is ${taka(total)}, paid to ${count} staff records.`
        : `No salary records found for ${label}.`
    );
  }

  function reportStudents() {
    const students = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.students) : [];
    const active   = students.filter(s => (s.status||'Active') === 'Active');
    const inactive = students.filter(s => s.status === 'Inactive');
    const totalFee = students.reduce((s,r) => s + safeNum(r.total_fee), 0);
    const totalPaid= students.reduce((s,r) => s + safeNum(r.paid), 0);
    const totalDue = students.reduce((s,r) => s + safeNum(r.due), 0);

    // Batch breakdown
    const batches = {};
    students.forEach(s => { if (s.batch) batches[s.batch] = (batches[s.batch]||0)+1; });
    const topBatches = Object.entries(batches).sort((a,b)=>b[1]-a[1]).slice(0,3);

    const rows = [
      ["🎓 Total Students",    students.length,     '#00e5ff'],
      ["✅ Active",             active.length,       '#00ff88'],
      ["❌ Inactive",           inactive.length,     '#ff4757'],
      ["💵 Total Fee",          taka(totalFee),      '#ffaa00'],
      ["✅ Collected",          taka(totalPaid),     '#00ff88'],
      ["⏳ Total Due",          taka(totalDue),      '#ff4757'],
    ];
    topBatches.forEach(([batch, count]) =>
      rows.push([`  📚 ${batch}`, count + ' students', 'rgba(255,255,255,0.7)'])
    );

    showReport(
      'Student Report',
      'fa-user-graduate',
      rows,
      null,
      `Total ${students.length} students. Active: ${active.length}. Total due is ${taka(totalDue)}.`
    );
  }

  function reportFinance() {
    const finance = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.finance) : [];
    const now = new Date();
    const mm  = String(now.getMonth()+1).padStart(2,'0');
    const yy  = now.getFullYear();
    const thisMonth = finance.filter(f => (f.date||'').startsWith(`${yy}-${mm}`));

    const income  = thisMonth.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense = thisMonth.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const net     = income - expense;

    const allIncome  = finance.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const allExpense = finance.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const monthLabel = now.toLocaleString('default',{month:'long'}) + ' ' + yy;

    showReport(
      'Finance Summary',
      'fa-chart-line',
      [
        [`📅 ${monthLabel} Income`,   taka(income),           '#00ff88'],
        [`📅 ${monthLabel} Expense`,  taka(expense),          '#ff4757'],
        [`📊 ${monthLabel} Net`,      (net>=0?'+':'')+taka(net), net>=0?'#f7b731':'#ff4757'],
        ['─────────────────', '',      'transparent'],
        ['💰 All-Time Income',          taka(allIncome),        '#00ff88'],
        ['💸 All-Time Expense',         taka(allExpense),       '#ff4757'],
        ['📈 All-Time Net',             taka(allIncome-allExpense), (allIncome-allExpense)>=0?'#00e5ff':'#ff4757'],
      ],
      null,
      `This month income is ${taka(income)} and expense is ${taka(expense)}. Net is ${taka(net)}.`
    );
  }

  function reportDue() {
    const students = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.students) : [];
    const withDue  = students.filter(s => safeNum(s.due) > 0).sort((a,b)=>safeNum(b.due)-safeNum(a.due));
    const totalDue = withDue.reduce((s,r)=>s+safeNum(r.due),0);

    const rows = [
      ["⏳ Students with Due", withDue.length,  '#ffaa00'],
      ["💸 Total Outstanding", taka(totalDue),  '#ff4757'],
    ];
    withDue.slice(0,5).forEach(s =>
      rows.push([`  👤 ${s.name}`, taka(s.due), '#ff6b35'])
    );
    if (withDue.length > 5) rows.push([`  …and ${withDue.length-5} more`, '', '#888']);

    showReport(
      'Pending Due Report',
      'fa-circle-exclamation',
      rows,
      null,
      `${withDue.length} students have pending dues totaling ${taka(totalDue)}.`
    );
  }

  function reportBalance() {
    const accounts = (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB.accounts) : [];
    const rows = accounts.map(a => [
      `🏦 ${a.name||a.account_name||'Account'}`,
      taka(safeNum(a.balance)),
      '#c084fc'
    ]);
    const total = accounts.reduce((s,a)=>s+safeNum(a.balance),0);
    rows.push(['─────────────────', '',          'transparent']);
    rows.push(['💰 Total Balance',   taka(total), '#00e5ff']);

    showReport(
      'Account Balances',
      'fa-building-columns',
      rows.length > 1 ? rows : [['No accounts found','','#888']],
      null,
      `Total account balance is ${taka(total)}.`
    );
  }

  function reportHelp() {
    showReport(
      'Voice Commands Help',
      'fa-circle-question',
      [
        ['🗓️ "today\'s report"',        'Daily summary',          '#00e5ff'],
        ['💰 "salary report april"',    'Monthly salary total',   '#00ff88'],
        ['🎓 "student report"',         'Student overview',       '#ffaa00'],
        ['📊 "finance summary"',        'Income & expense',       '#c084fc'],
        ['⏳ "pending due"',            'Who owes money',         '#ff4757'],
        ['🏦 "account balance"',        'All account balances',   '#f7b731'],
        ['🚪 "logout"',                 'Sign out',               '#ff6b35'],
        ['📂 "open students"',          'Navigate to any tab',    '#a0c4ff'],
      ],
      '💡 Tip: Click the mic button and speak clearly in English.',
      'Here are the commands I support. Say today\'s report, salary report, student report, or ask for help anytime.'
    );
  }

  /* ── MAIN COMMAND PROCESSOR ───────────────────── */
  function processCommand(cmd) {
    let handled = false;

    // ── REPORT COMMANDS ────────────────────────────
    if (!handled && (cmd.includes('today') && (cmd.includes('report') || cmd.includes('summary'))) ||
        cmd === 'today' || cmd.includes('daily report')) {
      reportToday(); handled = true;
    }

    if (!handled && (cmd.includes('salary') || cmd.includes('payroll'))) {
      reportSalary(cmd); handled = true;
    }

    if (!handled && (cmd.includes('student report') || cmd.includes('how many student') ||
        cmd.includes('total student'))) {
      reportStudents(); handled = true;
    }

    if (!handled && (cmd.includes('finance summary') || cmd.includes('income summary') ||
        cmd.includes('expense summary') || cmd.includes('income today') || cmd.includes('total income'))) {
      reportFinance(); handled = true;
    }

    if (!handled && (cmd.includes('pending due') || cmd.includes('total due') ||
        cmd.includes('who owes') || cmd.includes('outstanding'))) {
      reportDue(); handled = true;
    }

    if (!handled && (cmd.includes('account balance') || cmd.includes('total balance') ||
        cmd.includes('bank balance'))) {
      reportBalance(); handled = true;
    }

    if (!handled && (cmd.includes('help') || cmd.includes('what can you') ||
        cmd.includes('commands') || cmd.includes('what do you do'))) {
      reportHelp(); handled = true;
    }

    // ── NAVIGATION COMMANDS ────────────────────────
    if (!handled) {
      const navigations = [
        { trigger:['dashboard','home'],           tab:'dashboard',    label:'Opening Dashboard' },
        { trigger:['student','students'],          tab:'students',     label:'Opening Students' },
        { trigger:['finance','payment','ledger'],  tab:'finance',      label:'Opening Finance Ledger' },
        { trigger:['account','accounts'],          tab:'accounts',     label:'Opening Accounts' },
        { trigger:['loan','loans'],                tab:'loans',        label:'Opening Loans' },
        { trigger:['visitor','visitors'],          tab:'visitors',     label:'Opening Visitors' },
        { trigger:['hr','staff','employee'],       tab:'hr-staff',     label:'Opening HR and Staff' },
        { trigger:['exam','exams','result'],       tab:'exam',         label:'Opening Exams' },
        { trigger:['salary'],                      tab:'salary',       label:'Opening Salary Hub' },
        { trigger:['attendance','present'],        tab:'attendance',   label:'Opening Attendance' },
        { trigger:['id card','id-card'],           tab:'id-cards',     label:'Opening ID Cards' },
        { trigger:['certificate'],                 tab:'certificates', label:'Opening Certificates' },
        { trigger:['notice','board'],              tab:'notice-board', label:'Opening Notice Board' },
        { trigger:['setting','settings','theme'],  tab:'settings',     label:'Opening Settings' },
      ];
      for (let nav of navigations) {
        if (nav.trigger.some(t => cmd.includes(t))) {
          if (typeof App !== 'undefined') App.navigateTo(nav.tab);
          if (typeof Utils !== 'undefined') Utils.toast(nav.label, 'success');
          speak(nav.label);
          handled = true;
          break;
        }
      }
    }

    // ── LOGOUT ─────────────────────────────────────
    if (!handled && (cmd.includes('logout') || cmd.includes('log out') || cmd.includes('sign out'))) {
      speak('Logging out. Goodbye.');
      setTimeout(() => {
        const lb = document.getElementById('btn-logout');
        if (lb) lb.click();
        else if (typeof App !== 'undefined') App.logout();
      }, 1500);
      handled = true;
    }

    if (!handled) {
      if (typeof Utils !== 'undefined') Utils.toast(`Not recognized: "${cmd}" — say "help" for commands`, 'warn');
      speak("I didn't catch that. Say help to see available commands.");
    }
  }

  return { init, speak };
})();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => VoiceAssistant.init(), 1500);
});

window.VoiceAssistant = VoiceAssistant;
