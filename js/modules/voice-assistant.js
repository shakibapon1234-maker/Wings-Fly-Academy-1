/**
 * Wings Fly Academy — AI Voice Assistant Module (v3.1)
 *
 * COMMANDS:
 *  - "give me batch 19 full report"           → batch-specific report
 *  - "batch nineteen due"                     → due for a specific batch
 *  - "last 10 days expense"                   → recent expense report
 *  - "last 7 days income"                     → recent income report
 *  - "last week expense"                      → last 7 days expense
 *  - "expense report this month"              → current month expenses ✦ NEW
 *  - "income report this month"               → current month income  ✦ NEW
 *  - "give me expense reports of this month"  → current month expenses ✦ NEW
 *  - "april expense" / "march income"         → named-month report    ✦ NEW
 *  - "this year expense" / "year summary"     → full year report      ✦ NEW
 *  - "this year income"                       → full year income      ✦ NEW
 *  - "today's report"                         → daily summary
 *  - "salary report april"                    → monthly salary
 *  - "student report"                         → student overview
 *  - "finance summary"                        → income & expense
 *  - "pending due" / "total due"              → all-batch due
 *  - "account balance"                        → account balances
 *  - "help"                                   → command list
 *  - "open [tab]"                             → navigation
 */

const VoiceAssistant = (() => {
  let isListening  = false;
  let recognition  = null;
  let synth        = window.speechSynthesis;
  let voiceInstance = null;
  let btn = null;

  /* ════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════ */
  function init() {
    btn = document.createElement('button');
    btn.id    = 'ai-voice-btn';
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

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR();
      recognition.continuous     = false;
      recognition.lang           = 'en-US';
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
    const ok = localStorage.getItem('wfa_logged_in') === 'true';
    btn.style.display      = ok ? 'flex' : 'none';
    btn.style.alignItems   = 'center';
    btn.style.justifyContent = 'center';
  }

  function setVoice() {
    const voices = synth.getVoices();
    voiceInstance = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'))
                 || voices.find(v => v.lang === 'en-US')
                 || voices[0] || null;
  }

  function speak(text) {
    if (!text) return;
    synth.cancel();
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
      b.style.animation = 'none';
      b.style.boxShadow = '0 0 20px rgba(181,55,242,0.4)';
      b.innerHTML       = '<i class="fa fa-microphone"></i>';
    }
  }

  /* ════════════════════════════════════════════════
     UTILITY HELPERS
  ════════════════════════════════════════════════ */
  const WORD_NUMS = {
    'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,
    'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,
    'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,
    'twenty':20,'twenty one':21,'twenty two':22,'twenty three':23,'twenty four':24,
    'twenty five':25,'twenty six':26,'twenty seven':27,'twenty eight':28,
    'twenty nine':29,'thirty':30,'thirty one':31
  };

  // Convert spoken words to numbers: "nineteen" → "19"
  function normalizeNumbers(text) {
    let result = text;
    // Multi-word first (e.g. "twenty one"), then single words
    const sorted = Object.keys(WORD_NUMS).sort((a,b) => b.split(' ').length - a.split(' ').length);
    for (const w of sorted) result = result.replace(new RegExp('\\b'+w+'\\b','gi'), WORD_NUMS[w]);
    return result;
  }

  // Extract batch identifier from command — handles "batch 19", "batch-19", "19 batch", "batch nineteen"
  function extractBatch(cmd) {
    const normalized = normalizeNumbers(cmd);
    // "batch 19", "batch-19", "batch19"
    let m = normalized.match(/batch[\s\-#]*(\w+)/i);
    if (m) return m[1];
    // "19 batch"
    m = normalized.match(/(\w+)\s+batch/i);
    if (m) return m[1];
    return null;
  }

  // Extract "last N days" — "last 10 days", "last week" → 7, "last month" → 30
  function extractLastDays(cmd) {
    const normalized = normalizeNumbers(cmd);
    let m = normalized.match(/last\s+(\d+)\s+day/i);
    if (m) return parseInt(m[1]);
    if (cmd.includes('last week'))  return 7;
    if (cmd.includes('last month')) return 30;
    if (cmd.includes('last year'))  return 365;
    return null;
  }

  function safeNum(v) { return parseFloat(v)||0; }
  function taka(n)    { return '৳' + Math.round(n).toLocaleString('en-IN'); }
  function today()    { return new Date().toISOString().split('T')[0]; }

  function getMonthIndex(cmd) {
    const months = ['january','february','march','april','may','june',
                    'july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++)
      if (cmd.includes(months[i]))
        return { idx:i, name:months[i].charAt(0).toUpperCase()+months[i].slice(1) };
    return null;
  }

  function daysAgoDate(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  // Detect "this month" / "current month" / "this month's" patterns
  function isThisMonth(cmd) {
    return /\b(this month|current month|this month'?s|month report|monthly)\b/.test(cmd);
  }

  // Detect "this year" / "current year" / "yearly" patterns
  function isThisYear(cmd) {
    return /\b(this year|current year|this year'?s|year report|yearly|year summary|annual)\b/.test(cmd);
  }

  // Report income/expense for a specific year-month
  function reportMonthFinance(year, month, monthName, type) {
    const finance = dbAll('finance');
    const mm      = String(month).padStart(2, '0');
    const prefix  = `${year}-${mm}`;
    const period  = finance.filter(f => (f.date || '').startsWith(prefix));
    const income  = period.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
    const expense = period.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);
    const net     = income - expense;
    const label   = `${monthName} ${year}`;

    let rows, voiceText, title;
    if (type === 'expense') {
      const items = period.filter(f => f.type === 'Expense')
        .sort((a, b) => safeNum(b.amount) - safeNum(a.amount))
        .slice(0, 6)
        .map(f => [`  📌 ${f.category || f.description || 'Expense'}`, taka(safeNum(f.amount)), '#ff6b35']);
      rows = [
        [`📅 ${label} Total Expense`, taka(expense), '#ff4757'],
        ['--------', '---', ''],
        ...items,
        ...(period.filter(f => f.type === 'Expense').length > 6
          ? [[`  …${period.filter(f => f.type === 'Expense').length - 6} more`, '', '#888']] : []),
      ];
      title = `${label} — Expense Report`;
      voiceText = `${label} total expense is ${taka(expense)}.`;
    } else if (type === 'income') {
      const items = period.filter(f => f.type === 'Income')
        .sort((a, b) => safeNum(b.amount) - safeNum(a.amount))
        .slice(0, 6)
        .map(f => [`  📌 ${f.category || f.description || 'Income'}`, taka(safeNum(f.amount)), '#00c853']);
      rows = [
        [`📅 ${label} Total Income`, taka(income), '#00ff88'],
        ['--------', '---', ''],
        ...items,
        ...(period.filter(f => f.type === 'Income').length > 6
          ? [[`  …${period.filter(f => f.type === 'Income').length - 6} more`, '', '#888']] : []),
      ];
      title = `${label} — Income Report`;
      voiceText = `${label} total income is ${taka(income)}.`;
    } else {
      rows = [
        [`📅 ${label} Income`,  taka(income),                '#00ff88'],
        [`📅 ${label} Expense`, taka(expense),               '#ff4757'],
        [`📊 ${label} Net`,     (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#f7b731' : '#ff4757'],
      ];
      title = `${label} — Finance Report`;
      voiceText = `${label}: income ${taka(income)}, expense ${taka(expense)}, net ${taka(net)}.`;
    }
    showReport(title, 'fa-chart-line', rows, null, voiceText);
  }

  // Report income/expense for a full year
  function reportYearFinance(year, type) {
    const finance = dbAll('finance');
    const period  = finance.filter(f => (f.date || '').startsWith(`${year}`));
    const income  = period.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
    const expense = period.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);
    const net     = income - expense;

    let rows, title, voiceText;
    if (type === 'expense') {
      rows = [
        [`📅 ${year} Total Expense`, taka(expense), '#ff4757'],
        [`📊 ${year} Net`,           (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#f7b731' : '#ff4757'],
      ];
      title = `${year} — Annual Expense`;
      voiceText = `${year} total annual expense is ${taka(expense)}.`;
    } else if (type === 'income') {
      rows = [
        [`📅 ${year} Total Income`, taka(income), '#00ff88'],
        [`📊 ${year} Net`,          (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#f7b731' : '#ff4757'],
      ];
      title = `${year} — Annual Income`;
      voiceText = `${year} total annual income is ${taka(income)}.`;
    } else {
      rows = [
        [`💰 ${year} Income`,  taka(income),  '#00ff88'],
        [`💸 ${year} Expense`, taka(expense), '#ff4757'],
        [`📈 ${year} Net`,     (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#00e5ff' : '#ff4757'],
      ];
      title = `${year} — Annual Summary`;
      voiceText = `${year} annual income ${taka(income)}, expense ${taka(expense)}, net ${taka(net)}.`;
    }
    showReport(title, 'fa-calendar-days', rows, null, voiceText);
  }

  function dbAll(key) {
    try { return (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB[key]||key) : []; }
    catch(e) { return []; }
  }

  /* ════════════════════════════════════════════════
     REPORT MODAL RENDERER
  ════════════════════════════════════════════════ */
  function showReport(title, icon, rows, footer, voiceText) {
    speak(voiceText);
    const rowsHTML = rows.map(([label, val, color]) =>
      val === '---'
        ? `<div style="border-bottom:1px solid rgba(255,255,255,0.08);margin:4px 0"></div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:rgba(255,255,255,0.65);font-size:0.87rem">${label}</span>
            <span style="font-weight:700;font-size:0.93rem;color:${color||'var(--text-primary)'}">${val}</span>
          </div>`
    ).join('');

    const html = `
      <div style="min-width:320px;max-width:420px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--brand-primary)">
          <i class="fa ${icon}" style="color:var(--brand-primary);font-size:1.3rem"></i>
          <div style="font-size:1rem;font-weight:800;letter-spacing:0.4px">${title}</div>
        </div>
        <div>${rowsHTML}</div>
        ${footer ? `<div style="margin-top:12px;padding:9px 13px;background:rgba(0,212,255,0.06);border-radius:8px;font-size:0.79rem;color:rgba(255,255,255,0.45)">${footer}</div>` : ''}
      </div>`;

    if (typeof Utils !== 'undefined' && Utils.openModal)
      Utils.openModal(`<i class="fa ${icon}"></i> ${title}`, html, 'modal-sm');
  }

  /* ════════════════════════════════════════════════
     REPORT: BATCH SPECIFIC
  ════════════════════════════════════════════════ */
  function reportBatch(batchId) {
    const students = dbAll('students');
    // Case-insensitive match for batch — also match "batch-19" == "19"
    const batchStudents = students.filter(s => {
      const b = (s.batch||'').toLowerCase().replace(/batch[\s\-#]*/i,'').trim();
      const query = batchId.toLowerCase().replace(/batch[\s\-#]*/i,'').trim();
      return b === query || (s.batch||'').toLowerCase().includes(batchId.toLowerCase());
    });

    if (!batchStudents.length) {
      speak(`No students found for batch ${batchId}.`);
      if (typeof Utils !== 'undefined') Utils.toast(`No data found for batch ${batchId}`, 'warn');
      return;
    }

    const totalFee   = batchStudents.reduce((s,r)=>s+safeNum(r.total_fee),0);
    const totalPaid  = batchStudents.reduce((s,r)=>s+safeNum(r.paid),0);
    const totalDue   = batchStudents.reduce((s,r)=>s+safeNum(r.due),0);
    const active     = batchStudents.filter(s=>(s.status||'Active')==='Active').length;
    const withDue    = batchStudents.filter(s=>safeNum(s.due)>0);
    const batchLabel = batchStudents[0]?.batch || `Batch-${batchId}`;

    // Per-student due (top 5 highest)
    const dueRows = withDue.sort((a,b)=>safeNum(b.due)-safeNum(a.due)).slice(0,5)
      .map(s=>([`  👤 ${s.name}`, taka(s.due), '#ff6b35']));

    showReport(
      `${batchLabel} — Full Report`,
      'fa-layer-group',
      [
        ['👥 Total Students',   batchStudents.length,  '#00e5ff'],
        ['✅ Active',            active,                '#00ff88'],
        ['💵 Total Fee',         taka(totalFee),        '#ffaa00'],
        ['✅ Collected',          taka(totalPaid),        '#00ff88'],
        ['⏳ Total Due',          taka(totalDue),         '#ff4757'],
        ['👤 Students w/ Due',   withDue.length,         '#ff4757'],
        ['--------','---',''],
        ...dueRows,
      ],
      withDue.length > 5 ? `…and ${withDue.length-5} more students have dues` : null,
      `Batch ${batchLabel} report: ${batchStudents.length} students, collected ${taka(totalPaid)}, outstanding due ${taka(totalDue)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: LAST N DAYS EXPENSE / INCOME
  ════════════════════════════════════════════════ */
  function reportLastDays(days, type) {
    const finance   = dbAll('finance');
    const fromDate  = daysAgoDate(days);
    const toDate    = today();
    const period    = finance.filter(f => {
      const d = (f.date||'').split('T')[0];
      return d >= fromDate && d <= toDate;
    });

    const typeLabel = type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'All';
    let filtered;
    if (type === 'income')      filtered = period.filter(f => f.type === 'Income');
    else if (type === 'expense') filtered = period.filter(f => f.type === 'Expense');
    else                         filtered = period;

    const total   = filtered.reduce((s,f)=>s+safeNum(f.amount),0);
    const income  = period.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense = period.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);

    // Daily breakdown — last N days
    const byDay = {};
    filtered.forEach(f => {
      const d = (f.date||'').split('T')[0];
      byDay[d] = (byDay[d]||0) + safeNum(f.amount);
    });
    const dayRows = Object.entries(byDay)
      .sort((a,b)=>b[0].localeCompare(a[0]))
      .slice(0,7)
      .map(([d,amt]) => {
        const label = new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
        return [`  📅 ${label}`, taka(amt), type==='expense'?'#ff6b35':'#00ff88'];
      });

    // Category breakdown (top 4)
    const byCat = {};
    filtered.forEach(f => { byCat[f.category||'Other'] = (byCat[f.category||'Other']||0)+safeNum(f.amount); });
    const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([cat,amt])=>[`  🏷️ ${cat}`, taka(amt), '#a0c4ff']);

    const periodStr = `Last ${days} days (${new Date(fromDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(toDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})})`;

    showReport(
      `Last ${days} Days — ${typeLabel} Report`,
      type==='expense' ? 'fa-arrow-trend-down' : type==='income' ? 'fa-arrow-trend-up' : 'fa-chart-bar',
      [
        ['📆 Period',                 periodStr,        '#00e5ff'],
        ['🧾 Transactions',           filtered.length + ' records', '#a0c4ff'],
        type !== 'income'  ? ['💸 Total Expense', taka(expense), '#ff4757'] : null,
        type !== 'expense' ? ['💰 Total Income',  taka(income),  '#00ff88'] : null,
        ['💵 Period Total',           taka(total),      type==='expense'?'#ff4757':'#00ff88'],
        ['--------','---',''],
        ...dayRows,
        ['--------','---',''],
        ...catRows,
      ].filter(Boolean),
      `Showing ${typeLabel.toLowerCase()} breakdown by day and category.`,
      `Last ${days} days ${typeLabel.toLowerCase()} total is ${taka(total)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: TODAY'S SUMMARY
  ════════════════════════════════════════════════ */
  function reportToday() {
    const todayStr  = today();
    const finance   = dbAll('finance');
    const students  = dbAll('students');
    const exams     = dbAll('exams');

    const todayFin      = finance.filter(f=>(f.date||'').startsWith(todayStr));
    const todayIncome   = todayFin.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const todayExp      = todayFin.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const todayStudents = students.filter(s=>(s.admission_date||'').startsWith(todayStr)).length;
    const todayExams    = exams.filter(e=>(e.exam_date||'').startsWith(todayStr)).length;
    const net           = todayIncome - todayExp;
    const dateLabel     = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    showReport(
      "Today's Report",
      'fa-calendar-day',
      [
        ['📅 Date',              dateLabel,                      '#00e5ff'],
        ['💰 Income',             taka(todayIncome),              '#00ff88'],
        ['💸 Expense',            taka(todayExp),                 '#ff4757'],
        ['📊 Net',                (net>=0?'+':'')+taka(net),       net>=0?'#f7b731':'#ff4757'],
        ['🧾 Transactions',       todayFin.length + ' records',   '#a0c4ff'],
        ['🎓 New Students',       todayStudents,                  '#00e5ff'],
        ['📝 Exams',              todayExams,                     '#c084fc'],
      ],
      `Generated: ${dateLabel}`,
      `Today: Income ${taka(todayIncome)}, Expense ${taka(todayExp)}, Net ${taka(net)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: SALARY BY MONTH
  ════════════════════════════════════════════════ */
  function reportSalary(cmd) {
    const monthInfo = getMonthIndex(cmd);
    const allSalary = dbAll('salary');
    const finance   = dbAll('finance');

    let targetRecords, label;
    const year = new Date().getFullYear();

    if (monthInfo) {
      const mm = String(monthInfo.idx+1).padStart(2,'0');
      targetRecords = allSalary.filter(s => {
        const d = s.payment_date||s.month||s.date||'';
        return d.includes(`${year}-${mm}`) || d.toLowerCase().includes(monthInfo.name.toLowerCase());
      });
      if (!targetRecords.length) {
        targetRecords = finance.filter(f => f.category==='Salary' && (f.date||'').includes(`${year}-${mm}`));
      }
      label = monthInfo.name + ' ' + year;
    } else {
      const now = new Date();
      const mm  = String(now.getMonth()+1).padStart(2,'0');
      targetRecords = allSalary.filter(s=>{const d=s.payment_date||s.month||s.date||'';return d.includes(`${year}-${mm}`);});
      if (!targetRecords.length)
        targetRecords = finance.filter(f=>f.category==='Salary'&&(f.date||'').includes(`${year}-${mm}`));
      label = now.toLocaleString('default',{month:'long'})+' '+year;
    }

    const total = targetRecords.reduce((s,r)=>s+safeNum(r.amount||r.salary_amount||r.net_salary),0);
    const perPerson={};
    targetRecords.forEach(r=>{
      const name = r.staff_name||r.person_name||r.description||'Staff';
      perPerson[name]=(perPerson[name]||0)+safeNum(r.amount||r.salary_amount||r.net_salary);
    });
    const personRows = Object.entries(perPerson).slice(0,5)
      .map(([name,amt])=>[`  👤 ${name}`, taka(amt), 'rgba(255,255,255,0.8)']);

    showReport(
      `Salary Report — ${label}`,
      'fa-money-check-dollar',
      [
        ['📅 Period',      label,                          '#00e5ff'],
        ['👥 Records',     targetRecords.length+' entries','#ffaa00'],
        ['💰 Total Salary', taka(total),                   '#00ff88'],
        ['--------','---',''],
        ...personRows,
      ],
      targetRecords.length===0 ? '⚠️ No salary records found for this period.' : null,
      targetRecords.length>0
        ? `Total salary for ${label} is ${taka(total)}, ${targetRecords.length} records.`
        : `No salary records found for ${label}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: STUDENTS OVERVIEW
  ════════════════════════════════════════════════ */
  function reportStudents() {
    const students = dbAll('students');
    const active   = students.filter(s=>(s.status||'Active')==='Active');
    const totalFee = students.reduce((s,r)=>s+safeNum(r.total_fee),0);
    const totalPaid= students.reduce((s,r)=>s+safeNum(r.paid),0);
    const totalDue = students.reduce((s,r)=>s+safeNum(r.due),0);
    const batches  = {};
    students.forEach(s=>{if(s.batch){batches[s.batch]=(batches[s.batch]||0)+1;}});
    const topBatches = Object.entries(batches).sort((a,b)=>b[1]-a[1]).slice(0,4);
    showReport(
      'Student Report',
      'fa-user-graduate',
      [
        ['🎓 Total Students', students.length,     '#00e5ff'],
        ['✅ Active',          active.length,        '#00ff88'],
        ['❌ Inactive',        students.length-active.length, '#ff4757'],
        ['💵 Total Fee',       taka(totalFee),       '#ffaa00'],
        ['✅ Collected',        taka(totalPaid),       '#00ff88'],
        ['⏳ Total Due',        taka(totalDue),        '#ff4757'],
        ['--------','---',''],
        ...topBatches.map(([b,c])=>[`  📚 Batch ${b}`, c+' students','rgba(255,255,255,0.7)']),
      ],
      null,
      `${students.length} total students, ${active.length} active, total due ${taka(totalDue)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: FINANCE SUMMARY
  ════════════════════════════════════════════════ */
  function reportFinance() {
    const finance = dbAll('finance');
    const now     = new Date();
    const mm      = String(now.getMonth()+1).padStart(2,'0');
    const yy      = now.getFullYear();
    const month   = finance.filter(f=>(f.date||'').startsWith(`${yy}-${mm}`));
    const mIncome = month.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const mExp    = month.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const allInc  = finance.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const allExp  = finance.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const mLabel  = now.toLocaleString('default',{month:'long'})+' '+yy;
    const mNet    = mIncome - mExp;
    showReport(
      'Finance Summary',
      'fa-chart-line',
      [
        [`📅 ${mLabel} Income`,  taka(mIncome),               '#00ff88'],
        [`📅 ${mLabel} Expense`, taka(mExp),                  '#ff4757'],
        [`📊 ${mLabel} Net`,     (mNet>=0?'+':'')+taka(mNet), mNet>=0?'#f7b731':'#ff4757'],
        ['--------','---',''],
        ['💰 All-Time Income',   taka(allInc),                '#00ff88'],
        ['💸 All-Time Expense',  taka(allExp),                '#ff4757'],
        ['📈 All-Time Net',      taka(allInc-allExp),          (allInc-allExp)>=0?'#00e5ff':'#ff4757'],
      ],
      null,
      `This month income ${taka(mIncome)}, expense ${taka(mExp)}, net ${taka(mNet)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: PENDING DUE (ALL or by BATCH)
  ════════════════════════════════════════════════ */
  function reportDue(batchFilter) {
    const students = dbAll('students');
    let pool = students;
    let batchLabel = '';

    if (batchFilter) {
      pool = students.filter(s => {
        const b = (s.batch||'').toLowerCase().replace(/batch[\s\-#]*/i,'').trim();
        const q = batchFilter.toLowerCase().replace(/batch[\s\-#]*/i,'').trim();
        return b === q || (s.batch||'').toLowerCase().includes(batchFilter.toLowerCase());
      });
      batchLabel = pool[0]?.batch ? `— Batch ${pool[0].batch}` : `— Batch ${batchFilter}`;
    }

    const withDue  = pool.filter(s=>safeNum(s.due)>0).sort((a,b)=>safeNum(b.due)-safeNum(a.due));
    const totalDue = withDue.reduce((s,r)=>s+safeNum(r.due),0);
    const dueRows  = withDue.slice(0,6).map(s=>[`  👤 ${s.name}`, taka(s.due), '#ff6b35']);

    showReport(
      `Pending Due ${batchLabel}`,
      'fa-circle-exclamation',
      [
        ['👥 Students w/ Due', withDue.length,    '#ffaa00'],
        ['💸 Total Due',       taka(totalDue),    '#ff4757'],
        ['--------','---',''],
        ...dueRows,
        ...(withDue.length>6 ? [[`  …${withDue.length-6} more`, '','#888']] : []),
      ],
      null,
      `${withDue.length} students ${batchLabel} have pending due totaling ${taka(totalDue)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: ACCOUNT BALANCE
  ════════════════════════════════════════════════ */
  function reportBalance() {
    const accounts = dbAll('accounts');
    const rows     = accounts.map(a=>[`🏦 ${a.name||a.account_name||'Account'}`, taka(safeNum(a.balance)), '#c084fc']);
    const total    = accounts.reduce((s,a)=>s+safeNum(a.balance),0);
    rows.push(['--------','---','']);
    rows.push(['💰 Total', taka(total), '#00e5ff']);
    showReport(
      'Account Balances',
      'fa-building-columns',
      rows.length>2 ? rows : [['No accounts found','','#888']],
      null,
      `Total account balance is ${taka(total)}.`
    );
  }

  /* ════════════════════════════════════════════════
     REPORT: HELP
  ════════════════════════════════════════════════ */
  function reportHelp() {
    showReport(
      'Voice Commands Help',
      'fa-circle-question',
      [
        ['📅 "today\'s report"',             'Daily summary',           '#00e5ff'],
        ['📚 "batch 19 full report"',        'Per-batch report',        '#00ff88'],
        ['⏳ "batch 19 due"',                'Due for a batch',         '#ff4757'],
        ['📉 "last 10 days expense"',        'Recent expense',          '#ff4757'],
        ['📈 "last 7 days income"',          'Recent income',           '#00ff88'],
        ['🗓️ "expense report this month"',   'Current month expense',   '#ff4757'],
        ['🗓️ "income report this month"',    'Current month income',    '#00ff88'],
        ['📆 "april expense"',               'Named month expense',     '#ffaa00'],
        ['🗒️ "this year expense"',           'Annual expense total',    '#ff4757'],
        ['💰 "salary report april"',         'Monthly salary',          '#ffaa00'],
        ['🎓 "student report"',              'Student overview',        '#00e5ff'],
        ['📊 "finance summary"',             'Income & expense',        '#c084fc'],
        ['💸 "pending due"',                 'All pending dues',        '#ff4757'],
        ['🏦 "account balance"',             'Account totals',          '#f7b731'],
        ['🚪 "logout"',                      'Sign out',                '#ff6b35'],
        ['📂 "open students" etc.',          'Navigate to tab',         '#a0c4ff'],
      ],
      '💡 Tip: Say "this month", "this year", or a month name like "april" with "expense" or "income"',
      'Here are all available voice commands. You can ask for reports, batch data, monthly expenses, and more.'
    );
  }

  /* ════════════════════════════════════════════════
     MAIN COMMAND PROCESSOR
  ════════════════════════════════════════════════ */
  function processCommand(raw) {
    const cmd = normalizeNumbers(raw); // convert "nineteen" → "19" etc.
    let handled = false;

    // ── 1. BATCH REPORT ───────────────────────────
    const batchId = extractBatch(cmd);

    if (!handled && batchId && (cmd.includes('report') || cmd.includes('full') ||
        cmd.includes('income') || cmd.includes('expense') || cmd.includes('paid') ||
        cmd.includes('collection') || cmd.includes('student'))) {
      reportBatch(batchId); handled = true;
    }

    // ── 2. BATCH DUE ──────────────────────────────
    if (!handled && batchId && (cmd.includes('due') || cmd.includes('outstanding') || cmd.includes('pending'))) {
      reportDue(batchId); handled = true;
    }

    // ── 3. LAST N DAYS EXPENSE ────────────────────
    const lastDays = extractLastDays(cmd);
    if (!handled && lastDays) {
      if (cmd.includes('expense') || cmd.includes('spend') || cmd.includes('cost')) {
        reportLastDays(lastDays, 'expense'); handled = true;
      } else if (cmd.includes('income') || cmd.includes('earn') || cmd.includes('collection') || cmd.includes('revenue')) {
        reportLastDays(lastDays, 'income'); handled = true;
      } else {
        reportLastDays(lastDays, 'all'); handled = true; // general last N days
      }
    }

    // ── 3b. THIS MONTH / CURRENT MONTH ───────────
    if (!handled && isThisMonth(cmd)) {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      if (cmd.includes('expense') || cmd.includes('spend') || cmd.includes('cost')) {
        reportMonthFinance(now.getFullYear(), now.getMonth() + 1, monthName, 'expense'); handled = true;
      } else if (cmd.includes('income') || cmd.includes('earn') || cmd.includes('collection') || cmd.includes('revenue')) {
        reportMonthFinance(now.getFullYear(), now.getMonth() + 1, monthName, 'income'); handled = true;
      } else {
        reportMonthFinance(now.getFullYear(), now.getMonth() + 1, monthName, 'all'); handled = true;
      }
    }

    // ── 3c. THIS YEAR / ANNUAL ───────────────────
    if (!handled && isThisYear(cmd)) {
      const year = new Date().getFullYear();
      if (cmd.includes('expense') || cmd.includes('spend') || cmd.includes('cost')) {
        reportYearFinance(year, 'expense'); handled = true;
      } else if (cmd.includes('income') || cmd.includes('earn') || cmd.includes('collection') || cmd.includes('revenue')) {
        reportYearFinance(year, 'income'); handled = true;
      } else {
        reportYearFinance(year, 'all'); handled = true;
      }
    }

    // ── 3d. NAMED MONTH (e.g. "april expense", "march income report") ─
    if (!handled) {
      const namedMonth = getMonthIndex(cmd);
      if (namedMonth && (cmd.includes('expense') || cmd.includes('income') ||
          cmd.includes('report') || cmd.includes('summary') || cmd.includes('collection'))) {
        const now  = new Date();
        const year = now.getFullYear();
        if (cmd.includes('expense') || cmd.includes('spend') || cmd.includes('cost')) {
          reportMonthFinance(year, namedMonth.idx + 1, namedMonth.name, 'expense'); handled = true;
        } else if (cmd.includes('income') || cmd.includes('earn') || cmd.includes('collection') || cmd.includes('revenue')) {
          reportMonthFinance(year, namedMonth.idx + 1, namedMonth.name, 'income'); handled = true;
        } else {
          reportMonthFinance(year, namedMonth.idx + 1, namedMonth.name, 'all'); handled = true;
        }
      }
    }

    // ── 4. TODAY'S REPORT ─────────────────────────
    if (!handled && ((cmd.includes('today') && (cmd.includes('report')||cmd.includes('summary'))) ||
        cmd === 'today' || cmd.includes('daily report'))) {
      reportToday(); handled = true;
    }

    // ── 5. SALARY ─────────────────────────────────
    if (!handled && (cmd.includes('salary') || cmd.includes('payroll'))) {
      reportSalary(cmd); handled = true;
    }

    // ── 6. STUDENT REPORT ─────────────────────────
    if (!handled && (cmd.includes('student report') || cmd.includes('how many student') || cmd.includes('total student'))) {
      reportStudents(); handled = true;
    }

    // ── 7. FINANCE SUMMARY ────────────────────────
    if (!handled && (cmd.includes('finance summary') || cmd.includes('income summary') ||
        cmd.includes('finance report') || cmd.includes('total income') || cmd.includes('total expense'))) {
      reportFinance(); handled = true;
    }

    // ── 8. PENDING DUE (all batches) ─────────────
    if (!handled && (cmd.includes('pending due') || cmd.includes('total due') ||
        cmd.includes('who owes') || cmd.includes('outstanding'))) {
      reportDue(null); handled = true;
    }

    // ── 9. ACCOUNT BALANCE ────────────────────────
    if (!handled && (cmd.includes('account balance') || cmd.includes('bank balance') || cmd.includes('total balance'))) {
      reportBalance(); handled = true;
    }

    // ── 10. HELP ──────────────────────────────────
    if (!handled && (cmd.includes('help') || cmd.includes('what can you') || cmd.includes('commands'))) {
      reportHelp(); handled = true;
    }

    // ── 11. NAVIGATION ────────────────────────────
    if (!handled) {
      const navigations = [
        { t:['dashboard','home'],          tab:'dashboard',    l:'Opening Dashboard' },
        { t:['student','students'],         tab:'students',     l:'Opening Students' },
        { t:['finance','payment','ledger'], tab:'finance',      l:'Opening Finance' },
        { t:['account','accounts'],         tab:'accounts',     l:'Opening Accounts' },
        { t:['loan','loans'],               tab:'loans',        l:'Opening Loans' },
        { t:['visitor','visitors'],         tab:'visitors',     l:'Opening Visitors' },
        { t:['hr','staff','employee'],      tab:'hr-staff',     l:'Opening HR' },
        { t:['exam','exams','result'],      tab:'exam',         l:'Opening Exams' },
        { t:['salary'],                     tab:'salary',       l:'Opening Salary' },
        { t:['attendance','present'],       tab:'attendance',   l:'Opening Attendance' },
        { t:['id card','id-card'],          tab:'id-cards',     l:'Opening ID Cards' },
        { t:['certificate'],               tab:'certificates', l:'Opening Certificates' },
        { t:['notice','board'],             tab:'notice-board', l:'Opening Notice Board' },
        { t:['setting','settings','theme'], tab:'settings',     l:'Opening Settings' },
      ];
      for (let nav of navigations) {
        if (nav.t.some(k => cmd.includes(k))) {
          if (typeof App !== 'undefined') App.navigateTo(nav.tab);
          if (typeof Utils !== 'undefined') Utils.toast(nav.l, 'success');
          speak(nav.l); handled = true; break;
        }
      }
    }

    // ── 12. LOGOUT ────────────────────────────────
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
      if (typeof Utils !== 'undefined') Utils.toast(`Not recognized: "${raw}" — say "help" for commands`, 'warn');
      speak("I didn't catch that. Try saying: today's report, batch 19 report, or last 10 days expense.");
    }
  }

  return { init, speak };
})();

document.addEventListener('DOMContentLoaded', () => setTimeout(() => VoiceAssistant.init(), 1500));
window.VoiceAssistant = VoiceAssistant;
