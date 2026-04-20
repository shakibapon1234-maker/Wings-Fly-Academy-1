/**
 * Wings Fly Academy — AI Voice Assistant Module (v3.2)
 *
 * COMMANDS:
 *  - "give me batch 19 full report"              → batch-specific report
 *  - "batch nineteen due"                        → due for a specific batch
 *  - "last 10 days expense"                      → recent expense report
 *  - "last 7 days income"                        → recent income report
 *  - "last week expense"                         → last 7 days expense
 *  - "expense report this month"                 → current month expenses
 *  - "income report this month"                  → current month income
 *  - "give me expense reports of this month"     → current month expenses
 *  - "april expense" / "march income"            → named-month report
 *  - "this year expense" / "year summary"        → full year report
 *  - "this year income"                          → full year income
 *  - "today's report"                            → daily summary
 *  - "salary report april"                       → monthly salary
 *  - "student report"                            → student overview
 *  - "finance summary"                           → income & expense
 *  - "pending due" / "total due"                 → all-batch due
 *  - "account balance"                           → account balances
 *  - "help"                                      → command list
 *  - "open [tab]"                                → navigation
 *  ──── NEW DETAILED REPORT COMMANDS (v3.2) ────
 *  - "give me total expense report in details"   → full detailed expense ✦ NEW
 *  - "detailed expense report"                   → category + all transactions ✦ NEW
 *  - "give me total income report in details"    → full detailed income ✦ NEW
 *  - "detailed income report"                    → category + all transactions ✦ NEW
 *  - "expense breakdown"                         → category-wise expense ✦ NEW
 *  - "income breakdown"                          → category-wise income ✦ NEW
 *  - "show all expenses"                         → all expense list ✦ NEW
 *  - "show all income"                           → all income list ✦ NEW
 *  - "top expenses"                              → top 10 biggest expenses ✦ NEW
 *  - "monthly summary"                           → month-by-month breakdown ✦ NEW
 *  - "cash flow"                                 → income vs expense ✦ NEW
 *  - "category report"                           → category-wise finance ✦ NEW
 */

const VoiceAssistant = (() => {
  let isListening   = false;
  let recognition   = null;
  let synth         = window.speechSynthesis;
  let voiceInstance = null;
  let btn           = null;

  /* ════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════ */
  function init() {
    // Inject Styles
    if (!document.getElementById('ai-assistant-css')) {
      const link = document.createElement('link');
      link.id = 'ai-assistant-css';
      link.rel = 'stylesheet';
      link.href = 'css/ai-assistant.css';
      document.head.appendChild(link);
    }

    // Create Avatar Container
    btn = document.createElement('div');
    btn.id = 'ai-avatar-container';
    btn.title = 'AI Assistant (Click to speak)';
    btn.innerHTML = `
      <div id="ai-doll">
        <div class="ai-halo"></div>
        
        <div class="ai-wings-container">
          <div class="ai-wing left"></div>
          <div class="ai-wing right"></div>
        </div>

        <div class="ai-head-container">
          <div class="ai-hair-back"></div>
          <div class="ai-head">
            <div class="ai-hair-front"></div>
            <div class="ai-eyes">
              <div class="ai-eye"></div>
              <div class="ai-eye"></div>
            </div>
            <div class="ai-mouth"></div>
          </div>
        </div>

        <div class="ai-torso">
          <div class="ai-arms">
            <div class="ai-arm left"></div>
            <div class="ai-arm right"></div>
          </div>
        </div>

        <div class="ai-skirt">
          <div class="ai-skirt-panel panel-1"></div>
          <div class="ai-skirt-panel panel-2"></div>
          <div class="ai-skirt-panel panel-3"></div>
          <div class="ai-skirt-panel panel-4"></div>
          <div class="ai-skirt-hearts">
            <div class="ai-heart"></div>
            <div class="ai-heart"></div>
            <div class="ai-heart"></div>
          </div>
        </div>

        <div class="ai-legs">
          <div class="ai-leg left"></div>
          <div class="ai-leg right"></div>
        </div>

        <div class="ai-base-ring"></div>
      </div>
    `;
    btn.onclick = toggleListening;
    document.body.appendChild(btn);

    checkVisibility();
    window.addEventListener('wfa:navigate', checkVisibility);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR();
      recognition.continuous      = false;
      recognition.lang            = 'en-US';
      recognition.interimResults  = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListening = true;
        btn.classList.add('listening');
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
    btn.style.display       = ok ? 'flex' : 'none';
    btn.style.alignItems    = 'center';
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
      u.pitch = 1.1; // Slightly higher pitch for "doll" effect
      u.rate = 1;
      
      u.onstart = () => btn.classList.add('talking');
      u.onend   = () => btn.classList.remove('talking');
      
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
    if (btn) {
      btn.classList.remove('listening');
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

  function normalizeNumbers(text) {
    let result = text;
    const sorted = Object.keys(WORD_NUMS).sort((a,b) => b.split(' ').length - a.split(' ').length);
    for (const w of sorted) result = result.replace(new RegExp('\\b'+w+'\\b','gi'), WORD_NUMS[w]);
    return result;
  }

  function extractBatch(cmd) {
    const normalized = normalizeNumbers(cmd);
    let m = normalized.match(/batch[\s\-#]*(\w+)/i);
    if (m) return m[1];
    m = normalized.match(/(\w+)\s+batch/i);
    if (m) return m[1];
    return null;
  }

  function extractLastDays(cmd) {
    const normalized = normalizeNumbers(cmd);
    let m = normalized.match(/last\s+(\d+)\s+day/i);
    if (m) return parseInt(m[1]);
    if (cmd.includes('last week'))  return 7;
    if (cmd.includes('last month')) return 30;
    if (cmd.includes('last year'))  return 365;
    return null;
  }

  function safeNum(v) { return parseFloat(v) || 0; }
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

  function isThisMonth(cmd) {
    return /\b(this month|current month|this month'?s|month report|monthly)\b/.test(cmd);
  }

  function isThisYear(cmd) {
    return /\b(this year|current year|this year'?s|year report|yearly|year summary|annual)\b/.test(cmd);
  }

  // ── NEW v3.2: Detect "detailed / in details / full details / breakdown / show all" ──
  function isDetailedRequest(cmd) {
    return /\b(detail|details|detailed|in detail|breakdown|full detail|show all|all transaction|itemize|itemised|itemized|complete report|full report)\b/.test(cmd);
  }

  function isExpenseKeyword(cmd) {
    return /\b(expense|expenses|spend|spending|cost|costs|expenditure|paid out|outgoing)\b/.test(cmd);
  }

  function isIncomeKeyword(cmd) {
    return /\b(income|incomes|earn|earning|revenue|collection|collected|received|incoming)\b/.test(cmd);
  }

  function dbAll(key) {
    try { return (typeof SupabaseSync !== 'undefined') ? SupabaseSync.getAll(DB[key]||key) : []; }
    catch(e) { return []; }
  }

  /* ════════════════════════════════════════════════
     REPORT MODAL RENDERER — Standard (small rows)
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
     REPORT MODAL RENDERER — Detailed (scrollable, wide)
  ════════════════════════════════════════════════ */
  function showDetailedReport(title, icon, summaryRows, tableRows, tableHeaders, footer, voiceText) {
    speak(voiceText);

    const summaryHTML = summaryRows.map(([label, val, color]) =>
      val === '---'
        ? `<div style="border-bottom:1px solid rgba(255,255,255,0.1);margin:6px 0"></div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:rgba(255,255,255,0.65);font-size:0.85rem">${label}</span>
            <span style="font-weight:700;font-size:0.9rem;color:${color||'var(--text-primary)'}">${val}</span>
          </div>`
    ).join('');

    const thHTML = tableHeaders.map(h =>
      `<th style="padding:8px 10px;text-align:left;font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap">${h}</th>`
    ).join('');

    const trHTML = tableRows.map((row, i) =>
      `<tr style="background:${i%2===0?'rgba(255,255,255,0.02)':'transparent'}">
        ${row.map((cell, ci) =>
          `<td style="padding:7px 10px;font-size:0.8rem;color:${ci===row.length-1?'#ffaa00':'rgba(255,255,255,0.75)'};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${cell}</td>`
        ).join('')}
      </tr>`
    ).join('');

    const html = `
      <div style="min-width:520px;max-width:700px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid var(--brand-primary)">
          <i class="fa ${icon}" style="color:var(--brand-primary);font-size:1.3rem"></i>
          <div style="font-size:1rem;font-weight:800;letter-spacing:0.4px">${title}</div>
        </div>

        <!-- Summary Cards -->
        <div style="margin-bottom:16px">${summaryHTML}</div>

        <!-- Transaction Table -->
        ${tableRows.length > 0 ? `
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-bottom:6px;letter-spacing:0.6px;text-transform:uppercase">Transaction Details (${tableRows.length} records)</div>
        <div style="max-height:340px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
          <table style="width:100%;border-collapse:collapse">
            <thead style="position:sticky;top:0;background:rgba(20,20,40,0.98);z-index:1">
              <tr>${thHTML}</tr>
            </thead>
            <tbody>${trHTML}</tbody>
          </table>
        </div>` : '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:0.85rem">No transactions found</div>'}

        ${footer ? `<div style="margin-top:12px;padding:9px 13px;background:rgba(0,212,255,0.06);border-radius:8px;font-size:0.79rem;color:rgba(255,255,255,0.45)">${footer}</div>` : ''}
      </div>`;

    if (typeof Utils !== 'undefined' && Utils.openModal)
      Utils.openModal(`<i class="fa ${icon}"></i> ${title}`, html, 'modal-lg');
  }

  /* ════════════════════════════════════════════════
     NEW v3.2: DETAILED EXPENSE / INCOME REPORT
     Triggered by: "give me total expense report in details",
                   "detailed expense report", "expense breakdown", etc.
  ════════════════════════════════════════════════ */
  function reportDetailed(type, filterFn, periodLabel) {
    const finance  = dbAll('finance');
    const typeStr  = type === 'expense' ? 'Expense' : 'Income';
    const allOfType = finance.filter(f => f.type === typeStr);
    const records  = filterFn ? allOfType.filter(filterFn) : allOfType;
    const total    = records.reduce((s, f) => s + safeNum(f.amount), 0);
    const count    = records.length;

    // Category breakdown
    const byCat = {};
    records.forEach(f => {
      const cat = f.category || f.description || 'Other';
      byCat[cat] = (byCat[cat] || 0) + safeNum(f.amount);
    });
    const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    // Summary rows
    const isExp = type === 'expense';
    const color  = isExp ? '#ff4757' : '#00ff88';
    const icon   = isExp ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';

    const summaryRows = [
      [`📅 Period`,              periodLabel || 'All Time',          '#00e5ff'],
      [`🧾 Total Transactions`,  `${count} records`,                 '#a0c4ff'],
      [isExp ? '💸 Total Expense' : '💰 Total Income', taka(total), color],
      ['--------', '---', ''],
      ...catEntries.slice(0, 8).map(([cat, amt]) => [
        `  🏷️ ${cat}`,
        taka(amt),
        isExp ? '#ff6b35' : '#00c853'
      ]),
      ...(catEntries.length > 8
        ? [[`  …${catEntries.length - 8} more categories`, '', '#888']]
        : []),
    ];

    // Transaction table rows — sorted by date descending
    const sorted = [...records].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );

    const tableHeaders = ['#', 'Date', 'Category', 'Description', 'Method', 'Amount'];
    const tableRows = sorted.map((f, i) => {
      const dateStr = f.date ? new Date(f.date).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      }) : '—';
      return [
        `${i + 1}`,
        dateStr,
        f.category || '—',
        (f.description || f.note || '—').substring(0, 30),
        f.payment_method || f.method || '—',
        taka(safeNum(f.amount))
      ];
    });

    const footerNote = catEntries.length > 0
      ? `Top category: ${catEntries[0][0]} (${taka(catEntries[0][1])})`
      : null;

    const voiceText = `${periodLabel || 'All time'} ${typeStr.toLowerCase()} report: ${count} transactions totaling ${taka(total)}. Top category is ${catEntries[0]?.[0] || 'none'}.`;

    showDetailedReport(
      `${periodLabel ? periodLabel + ' — ' : ''}Detailed ${typeStr} Report`,
      icon,
      summaryRows,
      tableRows,
      tableHeaders,
      footerNote,
      voiceText
    );
  }

  /* ════════════════════════════════════════════════
     NEW v3.2: TOP EXPENSES
  ════════════════════════════════════════════════ */
  function reportTopExpenses() {
    const finance  = dbAll('finance');
    const expenses = finance
      .filter(f => f.type === 'Expense')
      .sort((a, b) => safeNum(b.amount) - safeNum(a.amount))
      .slice(0, 10);

    const total = finance.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);

    const tableHeaders = ['Rank', 'Date', 'Category', 'Description', 'Amount'];
    const tableRows = expenses.map((f, i) => {
      const dateStr = f.date ? new Date(f.date).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      }) : '—';
      return [
        `#${i + 1}`,
        dateStr,
        f.category || '—',
        (f.description || f.note || '—').substring(0, 35),
        taka(safeNum(f.amount))
      ];
    });

    const summaryRows = [
      ['💸 All-Time Total Expense', taka(total), '#ff4757'],
      ['🏆 Highest Single Expense', expenses[0] ? taka(safeNum(expenses[0].amount)) : '—', '#ff6b35'],
      ['🧾 Showing Top', `${expenses.length} expenses`, '#a0c4ff'],
    ];

    showDetailedReport(
      'Top 10 Highest Expenses',
      'fa-ranking-star',
      summaryRows,
      tableRows,
      tableHeaders,
      'Sorted by amount — highest first',
      `Top expense is ${taka(safeNum(expenses[0]?.amount || 0))} for ${expenses[0]?.category || 'unknown'}.`
    );
  }

  /* ════════════════════════════════════════════════
     NEW v3.2: MONTHLY SUMMARY (month-by-month breakdown)
  ════════════════════════════════════════════════ */
  function reportMonthlySummary() {
    const finance = dbAll('finance');
    const now     = new Date();
    const year    = now.getFullYear();

    const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tableHeaders = ['Month', 'Income', 'Expense', 'Net'];
    const tableRows = [];

    let totalInc = 0, totalExp = 0;
    months.forEach((mon, idx) => {
      const mm     = String(idx + 1).padStart(2, '0');
      const prefix = `${year}-${mm}`;
      const mData  = finance.filter(f => (f.date || '').startsWith(prefix));
      const inc    = mData.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
      const exp    = mData.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);
      const net    = inc - exp;
      totalInc += inc;
      totalExp += exp;
      if (inc > 0 || exp > 0) {
        tableRows.push([
          `${mon} ${year}`,
          taka(inc),
          taka(exp),
          (net >= 0 ? '+' : '') + taka(Math.abs(net))
        ]);
      }
    });

    const net = totalInc - totalExp;
    const summaryRows = [
      [`💰 ${year} Total Income`,  taka(totalInc),                        '#00ff88'],
      [`💸 ${year} Total Expense`, taka(totalExp),                        '#ff4757'],
      [`📈 ${year} Net`,           (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#00e5ff' : '#ff4757'],
      [`📅 Active Months`,         `${tableRows.length} months`,           '#a0c4ff'],
    ];

    showDetailedReport(
      `${year} — Monthly Breakdown`,
      'fa-calendar-range',
      summaryRows,
      tableRows,
      tableHeaders,
      `Full year ${year} month-by-month income vs expense`,
      `${year} total income ${taka(totalInc)}, expense ${taka(totalExp)}, net ${taka(net)}.`
    );
  }

  /* ════════════════════════════════════════════════
     NEW v3.2: CASH FLOW (income vs expense comparison)
  ════════════════════════════════════════════════ */
  function reportCashFlow() {
    const finance  = dbAll('finance');
    const now      = new Date();
    const year     = now.getFullYear();
    const mm       = String(now.getMonth() + 1).padStart(2, '0');
    const monthLbl = now.toLocaleString('default', { month: 'long' });

    const thisMonth = finance.filter(f => (f.date || '').startsWith(`${year}-${mm}`));
    const thisYear  = finance.filter(f => (f.date || '').startsWith(`${year}`));
    const allTime   = finance;

    const calc = (arr) => ({
      inc: arr.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0),
      exp: arr.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0),
    });

    const m = calc(thisMonth);
    const y = calc(thisYear);
    const a = calc(allTime);

    const mNet = m.inc - m.exp;
    const yNet = y.inc - y.exp;
    const aNet = a.inc - a.exp;

    showReport(
      'Cash Flow Report',
      'fa-water',
      [
        [`📅 ${monthLbl} Income`,    taka(m.inc),                           '#00ff88'],
        [`📅 ${monthLbl} Expense`,   taka(m.exp),                           '#ff4757'],
        [`📊 ${monthLbl} Net`,       (mNet >= 0 ? '+' : '') + taka(Math.abs(mNet)), mNet >= 0 ? '#f7b731' : '#ff4757'],
        ['--------', '---', ''],
        [`🗓️ ${year} Income`,        taka(y.inc),                           '#00ff88'],
        [`🗓️ ${year} Expense`,       taka(y.exp),                           '#ff4757'],
        [`📈 ${year} Net`,           (yNet >= 0 ? '+' : '') + taka(Math.abs(yNet)), yNet >= 0 ? '#00e5ff' : '#ff4757'],
        ['--------', '---', ''],
        ['💰 All-Time Income',       taka(a.inc),                           '#00ff88'],
        ['💸 All-Time Expense',      taka(a.exp),                           '#ff4757'],
        ['📈 All-Time Net',          (aNet >= 0 ? '+' : '') + taka(Math.abs(aNet)), aNet >= 0 ? '#00e5ff' : '#ff4757'],
      ],
      `Income/Expense ratio this month: ${m.exp > 0 ? (m.inc / m.exp * 100).toFixed(0) : '∞'}%`,
      `Cash flow: this month net ${taka(mNet)}, this year net ${taka(yNet)}.`
    );
  }

  /* ════════════════════════════════════════════════
     NEW v3.2: CATEGORY REPORT
  ════════════════════════════════════════════════ */
  function reportCategoryBreakdown(type) {
    const finance  = dbAll('finance');
    const isAll    = !type;
    const filtered = isAll ? finance : finance.filter(f => f.type === (type === 'expense' ? 'Expense' : 'Income'));

    const byCat = {};
    filtered.forEach(f => {
      const cat = f.category || 'Other';
      if (!byCat[cat]) byCat[cat] = { income: 0, expense: 0, count: 0 };
      if (f.type === 'Income')  byCat[cat].income  += safeNum(f.amount);
      if (f.type === 'Expense') byCat[cat].expense += safeNum(f.amount);
      byCat[cat].count++;
    });

    const entries = Object.entries(byCat).sort((a, b) =>
      (b[1].income + b[1].expense) - (a[1].income + a[1].expense)
    );

    const tableHeaders = isAll
      ? ['Category', 'Income', 'Expense', 'Net', 'Records']
      : ['Category', type === 'expense' ? 'Expense' : 'Income', 'Records'];

    const tableRows = entries.map(([cat, d]) => {
      if (isAll) {
        const net = d.income - d.expense;
        return [cat, taka(d.income), taka(d.expense), (net >= 0 ? '+' : '') + taka(Math.abs(net)), `${d.count}`];
      }
      return [cat, taka(type === 'expense' ? d.expense : d.income), `${d.count}`];
    });

    const totalInc = filtered.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
    const totalExp = filtered.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);

    const summaryRows = [
      ['📂 Total Categories',    `${entries.length}`,  '#00e5ff'],
      ['💰 Total Income',         taka(totalInc),       '#00ff88'],
      ['💸 Total Expense',        taka(totalExp),       '#ff4757'],
    ];

    const typeLabel = isAll ? 'All Finance' : type === 'expense' ? 'Expense' : 'Income';
    showDetailedReport(
      `${typeLabel} — Category Breakdown`,
      'fa-tags',
      summaryRows,
      tableRows,
      tableHeaders,
      `${entries.length} categories found`,
      `${typeLabel} has ${entries.length} categories. Top category: ${entries[0]?.[0] || 'none'}.`
    );
  }

  /* ════════════════════════════════════════════════
     EXISTING REPORTS (unchanged from v3.1)
  ════════════════════════════════════════════════ */
  function reportMonthFinance(year, month, monthName, type) {
    const finance = dbAll('finance');
    const mm      = String(month).padStart(2, '0');
    const prefix  = `${year}-${mm}`;
    const period  = finance.filter(f => (f.date || '').startsWith(prefix));
    const income  = period.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
    const expense = period.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);
    const net     = income - expense;
    const label   = `${monthName} ${year}`;

    // If it's a detailed request, use new detailed renderer
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
        [`📅 ${label} Income`,  taka(income),  '#00ff88'],
        [`📅 ${label} Expense`, taka(expense), '#ff4757'],
        [`📊 ${label} Net`,     (net >= 0 ? '+' : '') + taka(Math.abs(net)), net >= 0 ? '#f7b731' : '#ff4757'],
      ];
      title = `${label} — Finance Report`;
      voiceText = `${label}: income ${taka(income)}, expense ${taka(expense)}, net ${taka(net)}.`;
    }
    showReport(title, 'fa-chart-line', rows, null, voiceText);
  }

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

  function reportBatch(batchId) {
    const students = dbAll('students');
    const batchStudents = students.filter(s => {
      const b     = (s.batch||'').toLowerCase().replace(/batch[\s\-#]*/i,'').trim();
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

    const dueRows = withDue.sort((a,b)=>safeNum(b.due)-safeNum(a.due)).slice(0,5)
      .map(s=>([`  👤 ${s.name}`, taka(s.due), '#ff6b35']));

    showReport(
      `${batchLabel} — Full Report`,
      'fa-layer-group',
      [
        ['👥 Total Students',  batchStudents.length,  '#00e5ff'],
        ['✅ Active',           active,                '#00ff88'],
        ['💵 Total Fee',        taka(totalFee),        '#ffaa00'],
        ['✅ Collected',         taka(totalPaid),        '#00ff88'],
        ['⏳ Total Due',         taka(totalDue),         '#ff4757'],
        ['👤 Students w/ Due',  withDue.length,         '#ff4757'],
        ['--------','---',''],
        ...dueRows,
      ],
      withDue.length > 5 ? `…and ${withDue.length-5} more students have dues` : null,
      `Batch ${batchLabel} report: ${batchStudents.length} students, collected ${taka(totalPaid)}, outstanding due ${taka(totalDue)}.`
    );
  }

  function reportLastDays(days, type) {
    const finance  = dbAll('finance');
    const fromDate = daysAgoDate(days);
    const toDate   = today();
    const period   = finance.filter(f => {
      const d = (f.date||'').split('T')[0];
      return d >= fromDate && d <= toDate;
    });

    const typeLabel = type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'All';
    let filtered;
    if (type === 'income')       filtered = period.filter(f => f.type === 'Income');
    else if (type === 'expense') filtered = period.filter(f => f.type === 'Expense');
    else                         filtered = period;

    const total   = filtered.reduce((s,f)=>s+safeNum(f.amount),0);
    const income  = period.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense = period.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);

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

    const byCat = {};
    filtered.forEach(f => { byCat[f.category||'Other'] = (byCat[f.category||'Other']||0)+safeNum(f.amount); });
    const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([cat,amt])=>[`  🏷️ ${cat}`, taka(amt), '#a0c4ff']);

    const periodStr = `Last ${days} days (${new Date(fromDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(toDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})})`;

    showReport(
      `Last ${days} Days — ${typeLabel} Report`,
      type==='expense' ? 'fa-arrow-trend-down' : type==='income' ? 'fa-arrow-trend-up' : 'fa-chart-bar',
      [
        ['📆 Period',       periodStr,        '#00e5ff'],
        ['🧾 Transactions', filtered.length + ' records', '#a0c4ff'],
        type !== 'income'  ? ['💸 Total Expense', taka(expense), '#ff4757'] : null,
        type !== 'expense' ? ['💰 Total Income',  taka(income),  '#00ff88'] : null,
        ['💵 Period Total', taka(total),      type==='expense'?'#ff4757':'#00ff88'],
        ['--------','---',''],
        ...dayRows,
        ['--------','---',''],
        ...catRows,
      ].filter(Boolean),
      `Showing ${typeLabel.toLowerCase()} breakdown by day and category.`,
      `Last ${days} days ${typeLabel.toLowerCase()} total is ${taka(total)}.`
    );
  }

  function reportToday() {
    const todayStr     = today();
    const finance      = dbAll('finance');
    const students     = dbAll('students');
    const exams        = dbAll('exams');
    const todayFin     = finance.filter(f=>(f.date||'').startsWith(todayStr));
    const todayIncome  = todayFin.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const todayExp     = todayFin.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const todayStudents= students.filter(s=>(s.admission_date||'').startsWith(todayStr)).length;
    const todayExams   = exams.filter(e=>(e.exam_date||'').startsWith(todayStr)).length;
    const net          = todayIncome - todayExp;
    const dateLabel    = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    showReport(
      "Today's Report",
      'fa-calendar-day',
      [
        ['📅 Date',         dateLabel,                    '#00e5ff'],
        ['💰 Income',        taka(todayIncome),            '#00ff88'],
        ['💸 Expense',       taka(todayExp),               '#ff4757'],
        ['📊 Net',           (net>=0?'+':'')+taka(net),    net>=0?'#f7b731':'#ff4757'],
        ['🧾 Transactions',  todayFin.length + ' records', '#a0c4ff'],
        ['🎓 New Students',  todayStudents,                '#00e5ff'],
        ['📝 Exams',         todayExams,                   '#c084fc'],
      ],
      `Generated: ${dateLabel}`,
      `Today: Income ${taka(todayIncome)}, Expense ${taka(todayExp)}, Net ${taka(net)}.`
    );
  }

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
      if (!targetRecords.length)
        targetRecords = finance.filter(f => f.category==='Salary' && (f.date||'').includes(`${year}-${mm}`));
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
    const perPerson = {};
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
        ['📅 Period',       label,                          '#00e5ff'],
        ['👥 Records',      targetRecords.length+' entries','#ffaa00'],
        ['💰 Total Salary', taka(total),                    '#00ff88'],
        ['--------','---',''],
        ...personRows,
      ],
      targetRecords.length===0 ? '⚠️ No salary records found for this period.' : null,
      targetRecords.length>0
        ? `Total salary for ${label} is ${taka(total)}, ${targetRecords.length} records.`
        : `No salary records found for ${label}.`
    );
  }

  function reportStudents() {
    const students  = dbAll('students');
    const active    = students.filter(s=>(s.status||'Active')==='Active');
    const totalFee  = students.reduce((s,r)=>s+safeNum(r.total_fee),0);
    const totalPaid = students.reduce((s,r)=>s+safeNum(r.paid),0);
    const totalDue  = students.reduce((s,r)=>s+safeNum(r.due),0);
    const batches   = {};
    students.forEach(s=>{if(s.batch){batches[s.batch]=(batches[s.batch]||0)+1;}});
    const topBatches = Object.entries(batches).sort((a,b)=>b[1]-a[1]).slice(0,4);
    showReport(
      'Student Report',
      'fa-user-graduate',
      [
        ['🎓 Total Students', students.length,               '#00e5ff'],
        ['✅ Active',          active.length,                 '#00ff88'],
        ['❌ Inactive',        students.length-active.length, '#ff4757'],
        ['💵 Total Fee',       taka(totalFee),                '#ffaa00'],
        ['✅ Collected',        taka(totalPaid),               '#00ff88'],
        ['⏳ Total Due',        taka(totalDue),                '#ff4757'],
        ['--------','---',''],
        ...topBatches.map(([b,c])=>[`  📚 Batch ${b}`, c+' students','rgba(255,255,255,0.7)']),
      ],
      null,
      `${students.length} total students, ${active.length} active, total due ${taka(totalDue)}.`
    );
  }

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
        ['📈 All-Time Net',      taka(allInc-allExp),         (allInc-allExp)>=0?'#00e5ff':'#ff4757'],
      ],
      null,
      `This month income ${taka(mIncome)}, expense ${taka(mExp)}, net ${taka(mNet)}.`
    );
  }

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
        ['👥 Students w/ Due', withDue.length,  '#ffaa00'],
        ['💸 Total Due',       taka(totalDue),  '#ff4757'],
        ['--------','---',''],
        ...dueRows,
        ...(withDue.length>6 ? [[`  …${withDue.length-6} more`, '','#888']] : []),
      ],
      null,
      `${withDue.length} students ${batchLabel} have pending due totaling ${taka(totalDue)}.`
    );
  }

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

  function reportHelp() {
    showReport(
      'Voice Commands Help',
      'fa-circle-question',
      [
        ['📅 "today\'s report"',               'Daily summary',            '#00e5ff'],
        ['📚 "batch 19 full report"',          'Per-batch report',         '#00ff88'],
        ['⏳ "batch 19 due"',                  'Due for a batch',          '#ff4757'],
        ['📉 "last 10 days expense"',          'Recent expense',           '#ff4757'],
        ['📈 "last 7 days income"',            'Recent income',            '#00ff88'],
        ['🗓️ "expense report this month"',     'Month expense',            '#ff4757'],
        ['📆 "april expense"',                 'Named month expense',      '#ffaa00'],
        ['🗒️ "this year expense"',             'Annual expense total',     '#ff4757'],
        ['-- NEW COMMANDS --',                 '─────────────',            '#555'],
        ['🔍 "detailed expense report"',       'Full expense details',     '#ff6b35'],
        ['🔍 "detailed income report"',        'Full income details',      '#00c853'],
        ['🏷️ "expense breakdown"',             'Category-wise expense',    '#ffaa00'],
        ['🏷️ "income breakdown"',              'Category-wise income',     '#ffaa00'],
        ['🏆 "top expenses"',                  'Top 10 biggest expenses',  '#ff4757'],
        ['📅 "monthly summary"',               'Month-by-month chart',     '#00e5ff'],
        ['💧 "cash flow"',                     'Income vs expense',        '#c084fc'],
        ['📂 "category report"',               'All categories breakdown', '#a0c4ff'],
        ['💰 "salary report april"',           'Monthly salary',           '#ffaa00'],
        ['🎓 "student report"',                'Student overview',         '#00e5ff'],
        ['📊 "finance summary"',               'Income & expense',         '#c084fc'],
        ['💸 "pending due"',                   'All pending dues',         '#ff4757'],
        ['🏦 "account balance"',               'Account totals',           '#f7b731'],
        ['🚪 "logout"',                        'Sign out',                 '#ff6b35'],
        ['📂 "open students" etc.',            'Navigate to tab',          '#a0c4ff'],
      ],
      '💡 Tip: Say "detailed" or "in details" with any expense/income command for full breakdown',
      'Here are all available voice commands. Say detailed expense report for a full breakdown.'
    );
  }

  /* ════════════════════════════════════════════════
     MAIN COMMAND PROCESSOR (v3.2)
  ════════════════════════════════════════════════ */
  function processCommand(raw) {
    const cmd     = normalizeNumbers(raw);
    let handled   = false;
    const detailed = isDetailedRequest(cmd);

    // ── 0. DETAILED EXPENSE / INCOME REPORT (NEW v3.2) ──────────────
    // Catches: "give me total expense report in details",
    //          "detailed expense report", "expense breakdown",
    //          "show all expenses", "total expense in details", etc.
    if (!handled && detailed && isExpenseKeyword(cmd) && !extractBatch(cmd)) {
      // Check if there's a month filter
      const namedMonth = getMonthIndex(cmd);
      const now = new Date();
      if (namedMonth) {
        const mm     = String(namedMonth.idx + 1).padStart(2, '0');
        const prefix = `${now.getFullYear()}-${mm}`;
        reportDetailed('expense', f => (f.date || '').startsWith(prefix), `${namedMonth.name} ${now.getFullYear()}`);
      } else if (isThisMonth(cmd)) {
        const mm     = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${now.getFullYear()}-${mm}`;
        const label  = now.toLocaleString('default', { month: 'long' }) + ' ' + now.getFullYear();
        reportDetailed('expense', f => (f.date || '').startsWith(prefix), label);
      } else if (isThisYear(cmd)) {
        reportDetailed('expense', f => (f.date || '').startsWith(`${now.getFullYear()}`), `Year ${now.getFullYear()}`);
      } else {
        reportDetailed('expense', null, 'All Time');
      }
      handled = true;
    }

    if (!handled && detailed && isIncomeKeyword(cmd) && !extractBatch(cmd)) {
      const namedMonth = getMonthIndex(cmd);
      const now = new Date();
      if (namedMonth) {
        const mm     = String(namedMonth.idx + 1).padStart(2, '0');
        const prefix = `${now.getFullYear()}-${mm}`;
        reportDetailed('income', f => (f.date || '').startsWith(prefix), `${namedMonth.name} ${now.getFullYear()}`);
      } else if (isThisMonth(cmd)) {
        const mm     = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${now.getFullYear()}-${mm}`;
        const label  = now.toLocaleString('default', { month: 'long' }) + ' ' + now.getFullYear();
        reportDetailed('income', f => (f.date || '').startsWith(prefix), label);
      } else if (isThisYear(cmd)) {
        reportDetailed('income', f => (f.date || '').startsWith(`${now.getFullYear()}`), `Year ${now.getFullYear()}`);
      } else {
        reportDetailed('income', null, 'All Time');
      }
      handled = true;
    }

    // ── 0b. TOP EXPENSES (NEW v3.2) ─────────────────────────────────
    if (!handled && (cmd.includes('top expense') || cmd.includes('highest expense') ||
        cmd.includes('biggest expense') || cmd.includes('largest expense'))) {
      reportTopExpenses(); handled = true;
    }

    // ── 0c. MONTHLY SUMMARY (NEW v3.2) ──────────────────────────────
    if (!handled && (cmd.includes('monthly summary') || cmd.includes('month by month') ||
        cmd.includes('month-by-month') || cmd.includes('monthly breakdown') ||
        cmd.includes('each month') || cmd.includes('per month'))) {
      reportMonthlySummary(); handled = true;
    }

    // ── 0d. CASH FLOW (NEW v3.2) ────────────────────────────────────
    if (!handled && (cmd.includes('cash flow') || cmd.includes('cashflow') ||
        cmd.includes('income vs expense') || cmd.includes('income versus expense'))) {
      reportCashFlow(); handled = true;
    }

    // ── 0e. CATEGORY REPORT (NEW v3.2) ──────────────────────────────
    if (!handled && (cmd.includes('category report') || cmd.includes('category breakdown') ||
        cmd.includes('by category') || cmd.includes('categories'))) {
      if (isExpenseKeyword(cmd))      reportCategoryBreakdown('expense');
      else if (isIncomeKeyword(cmd))  reportCategoryBreakdown('income');
      else                            reportCategoryBreakdown(null);
      handled = true;
    }

    // ── 1. BATCH REPORT ─────────────────────────────────────────────
    const batchId = extractBatch(cmd);
    if (!handled && batchId && (cmd.includes('report') || cmd.includes('full') ||
        cmd.includes('income') || cmd.includes('expense') || cmd.includes('paid') ||
        cmd.includes('collection') || cmd.includes('student'))) {
      reportBatch(batchId); handled = true;
    }

    // ── 2. BATCH DUE ────────────────────────────────────────────────
    if (!handled && batchId && (cmd.includes('due') || cmd.includes('outstanding') || cmd.includes('pending'))) {
      reportDue(batchId); handled = true;
    }

    // ── 3. LAST N DAYS ───────────────────────────────────────────────
    const lastDays = extractLastDays(cmd);
    if (!handled && lastDays) {
      if (isExpenseKeyword(cmd))     { reportLastDays(lastDays, 'expense'); handled = true; }
      else if (isIncomeKeyword(cmd)) { reportLastDays(lastDays, 'income');  handled = true; }
      else                           { reportLastDays(lastDays, 'all');     handled = true; }
    }

    // ── 3b. THIS MONTH ───────────────────────────────────────────────
    if (!handled && isThisMonth(cmd)) {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long' });
      if (isExpenseKeyword(cmd))     { reportMonthFinance(now.getFullYear(), now.getMonth()+1, monthName, 'expense'); handled = true; }
      else if (isIncomeKeyword(cmd)) { reportMonthFinance(now.getFullYear(), now.getMonth()+1, monthName, 'income'); handled = true; }
      else                           { reportMonthFinance(now.getFullYear(), now.getMonth()+1, monthName, 'all');    handled = true; }
    }

    // ── 3c. THIS YEAR ────────────────────────────────────────────────
    if (!handled && isThisYear(cmd)) {
      const year = new Date().getFullYear();
      if (isExpenseKeyword(cmd))     { reportYearFinance(year, 'expense'); handled = true; }
      else if (isIncomeKeyword(cmd)) { reportYearFinance(year, 'income');  handled = true; }
      else                           { reportYearFinance(year, 'all');     handled = true; }
    }

    // ── 3d. NAMED MONTH ──────────────────────────────────────────────
    if (!handled) {
      const namedMonth = getMonthIndex(cmd);
      if (namedMonth && (isExpenseKeyword(cmd) || isIncomeKeyword(cmd) ||
          cmd.includes('report') || cmd.includes('summary') || cmd.includes('collection'))) {
        const year = new Date().getFullYear();
        if (isExpenseKeyword(cmd))     { reportMonthFinance(year, namedMonth.idx+1, namedMonth.name, 'expense'); handled = true; }
        else if (isIncomeKeyword(cmd)) { reportMonthFinance(year, namedMonth.idx+1, namedMonth.name, 'income'); handled = true; }
        else                           { reportMonthFinance(year, namedMonth.idx+1, namedMonth.name, 'all');    handled = true; }
      }
    }

    // ── 4. TODAY'S REPORT ────────────────────────────────────────────
    if (!handled && ((cmd.includes('today') && (cmd.includes('report')||cmd.includes('summary'))) ||
        cmd === 'today' || cmd.includes('daily report'))) {
      reportToday(); handled = true;
    }

    // ── 5. SALARY ────────────────────────────────────────────────────
    if (!handled && (cmd.includes('salary') || cmd.includes('payroll'))) {
      reportSalary(cmd); handled = true;
    }

    // ── 6. STUDENT REPORT ────────────────────────────────────────────
    if (!handled && (cmd.includes('student report') || cmd.includes('how many student') || cmd.includes('total student'))) {
      reportStudents(); handled = true;
    }

    // ── 7. FINANCE SUMMARY ───────────────────────────────────────────
    if (!handled && (cmd.includes('finance summary') || cmd.includes('income summary') ||
        cmd.includes('finance report') || cmd.includes('total income') || cmd.includes('total expense'))) {
      reportFinance(); handled = true;
    }

    // ── 8. PENDING DUE ───────────────────────────────────────────────
    if (!handled && (cmd.includes('pending due') || cmd.includes('total due') ||
        cmd.includes('who owes') || cmd.includes('outstanding'))) {
      reportDue(null); handled = true;
    }

    // ── 9. ACCOUNT BALANCE ───────────────────────────────────────────
    if (!handled && (cmd.includes('account balance') || cmd.includes('bank balance') || cmd.includes('total balance'))) {
      reportBalance(); handled = true;
    }

    // ── 10. HELP ─────────────────────────────────────────────────────
    if (!handled && (cmd.includes('help') || cmd.includes('what can you') || cmd.includes('commands'))) {
      reportHelp(); handled = true;
    }

    // ── 11. NAVIGATION ───────────────────────────────────────────────
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

    // ── 12. LOGOUT ───────────────────────────────────────────────────
    if (!handled && (cmd.includes('logout') || cmd.includes('log out') || cmd.includes('sign out'))) {
      speak('Logging out. Goodbye.');
      setTimeout(() => {
        const lb = document.getElementById('btn-logout');
        if (lb) lb.click();
        else if (typeof App !== 'undefined') App.logout();
      }, 1500);
      handled = true;
    }

    // ── 13. UNRECOGNIZED ─────────────────────────────────────────────
    if (!handled) {
      if (typeof Utils !== 'undefined')
        Utils.toast(`Not recognized: "${raw}" — say "help" for commands`, 'warn');
      speak("I didn't catch that. Try saying: detailed expense report, top expenses, monthly summary, or help.");
    }
  }

  return { init, speak };
})();

document.addEventListener('DOMContentLoaded', () => setTimeout(() => VoiceAssistant.init(), 1500));
window.VoiceAssistant = VoiceAssistant;
