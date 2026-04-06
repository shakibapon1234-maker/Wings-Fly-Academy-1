/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/ui/dashboard.js
   Dashboard — stats, charts, tables, notices
════════════════════════════════════════════════ */

const Dashboard = (() => {

  let revenueChart   = null;
  let enrollChart    = null;

  /* ══════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════ */
  function render() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    /* Raw data */
    const students  = SupabaseSync.getAll(DB.students);
    const finance   = SupabaseSync.getAll(DB.finance);
    const accounts  = SupabaseSync.getAll(DB.accounts);
    const loans     = SupabaseSync.getAll(DB.loans);
    const notices   = SupabaseSync.getAll(DB.notices);
    const settings  = SupabaseSync.localGetObj(SupabaseSync.LS.settings);

    /* ── KPIs ── */
    const totalStudents = students.length;
    const totalIncome   = finance.filter(f => f.type === 'Income').reduce((s,f) => s + Utils.safeNum(f.amount), 0);
    const totalExpense  = finance.filter(f => f.type === 'Expense').reduce((s,f) => s + Utils.safeNum(f.amount), 0);
    const netProfit     = totalIncome - totalExpense;

    /* Account balances */
    const accs = getAccountBalances(accounts, finance);

    /* Loan summary */
    const loanGiven    = loans.filter(l => l.direction === 'given').reduce((s,l) => s + Utils.safeNum(l.amount), 0);
    const loanReceived = loans.filter(l => l.direction === 'received').reduce((s,l) => s + Utils.safeNum(l.amount), 0);
    const loanNet      = loanGiven - loanReceived;

    /* Recent admissions */
    const recent = [...students].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0, 5);

    /* Last 5 ledger */
    const lastLedger = [...finance].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0, 5);

    /* Batch summary */
    const batchSummary = getBatchSummary(students);

    /* Target */
    const target       = Utils.safeNum(settings.monthly_target);
    const thisMonth    = Utils.currentMonth();
    const monthIncome  = finance.filter(f => f.type === 'Income' && (f.date||'').startsWith(thisMonth))
                                .reduce((s,f) => s + Utils.safeNum(f.amount), 0);

    /* Active notices */
    const activeNotices = notices.filter(n => !n.expires_at || new Date(n.expires_at) > new Date())
                                 .sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))
                                 .slice(0, 3);

    /* Student reminders (due > 0) */
    const reminders = students.filter(s => Utils.safeNum(s.due) > 0)
                               .sort((a,b) => Utils.safeNum(b.due) - Utils.safeNum(a.due))
                               .slice(0, 5);

    container.innerHTML = `
      <!-- ── KPI STATS ── -->
      <div class="dashboard-grid">
        ${statCard('fa-user-graduate', 'blue',   'মোট শিক্ষার্থী',    totalStudents,          '')}
        ${statCard('fa-arrow-trend-up','green',  'মোট আয়',            Utils.takaEn(totalIncome),   '')}
        ${statCard('fa-arrow-trend-down','red',  'মোট ব্যয়',          Utils.takaEn(totalExpense),  '')}
        ${statCard('fa-scale-balanced', netProfit>=0?'green':'red', 'নিট লাভ/ক্ষতি', Utils.takaEn(netProfit), '')}
      </div>

      <!-- ── ACCOUNT BALANCES ── -->
      <div class="grid-3 mb-2">
        <div class="account-balance-card">
          <div class="icon">💵</div>
          <div class="label">নগদ</div>
          <div class="amount">${Utils.takaEn(accs.cash)}</div>
        </div>
        <div class="account-balance-card">
          <div class="icon">🏦</div>
          <div class="label">ব্যাংক</div>
          <div class="amount">${Utils.takaEn(accs.bank)}</div>
        </div>
        <div class="account-balance-card">
          <div class="icon">📱</div>
          <div class="label">মোবাইল ব্যাংকিং</div>
          <div class="amount">${Utils.takaEn(accs.mobile)}</div>
        </div>
      </div>

      <!-- ── CHARTS ── -->
      <div class="chart-grid mb-2">
        <div class="chart-card">
          <div class="chart-card-title"><i class="fa fa-chart-bar"></i> মাসিক আয় (শেষ ৬ মাস)</div>
          <canvas id="revenue-chart"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card-title"><i class="fa fa-chart-pie"></i> কোর্স ভর্তি বিভাজন</div>
          <canvas id="enroll-chart"></canvas>
        </div>
      </div>

      <!-- ── ROW: Recent Admissions + Loan Summary ── -->
      <div class="grid-2 mb-2">
        <!-- Recent Admissions -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-clock" style="color:var(--primary-light)"></i> সাম্প্রতিক ভর্তি
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>নাম</th><th>কোর্স</th><th>ব্যাচ</th><th>তারিখ</th></tr></thead>
              <tbody>
                ${recent.length ? recent.map(s => `<tr>
                  <td>${Utils.truncate(s.name,20)}</td>
                  <td>${Utils.truncate(s.course||'—',16)}</td>
                  <td>${s.batch||'—'}</td>
                  <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.formatDate(s.created_at)}</td>
                </tr>`).join('') : `<tr><td colspan="4" class="no-data"><i class="fa fa-inbox"></i>কোনো ডেটা নেই</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Loan Summary -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-hand-holding-dollar" style="color:var(--accent)"></i> লোন সারসংক্ষেপ
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="stat-card">
              <div class="stat-icon amber"><i class="fa fa-arrow-up-right-from-square"></i></div>
              <div class="stat-info">
                <div class="stat-label">দেওয়া লোন</div>
                <div class="stat-value">${Utils.takaEn(loanGiven)}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green"><i class="fa fa-arrow-down-left-from-circle"></i></div>
              <div class="stat-info">
                <div class="stat-label">নেওয়া লোন</div>
                <div class="stat-value">${Utils.takaEn(loanReceived)}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon ${loanNet>0?'red':'green'}"><i class="fa fa-scale-balanced"></i></div>
              <div class="stat-info">
                <div class="stat-label">নিট অবস্থান</div>
                <div class="stat-value">${Utils.takaEn(loanNet)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── ROW: Last Ledger + Reminders ── -->
      <div class="grid-2 mb-2">
        <!-- Last 5 Ledger -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-list-check" style="color:var(--primary-light)"></i> শেষ ৫টি লেনদেন
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>বিবরণ</th><th>ধরন</th><th>পরিমাণ</th><th>তারিখ</th></tr></thead>
              <tbody>
                ${lastLedger.length ? lastLedger.map(f => `<tr>
                  <td>${Utils.truncate(f.description||f.category||'—',20)}</td>
                  <td>${Utils.badge(f.type==='Income'?'আয়':f.type==='Expense'?'ব্যয়':'লোন', f.type==='Income'?'success':'danger')}</td>
                  <td class="${f.type==='Income'?'ledger-income':'ledger-expense'}">${Utils.takaEn(f.amount)}</td>
                  <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.formatDate(f.date)}</td>
                </tr>`).join('') : `<tr><td colspan="4" class="no-data"><i class="fa fa-inbox"></i>কোনো ডেটা নেই</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Student Reminders -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-bell" style="color:var(--danger-light)"></i> পেমেন্ট রিমাইন্ডার
          </div>
          ${reminders.length ? `<div style="display:flex;flex-direction:column;gap:8px">
            ${reminders.map(s => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-input);border-radius:var(--radius-sm);border-left:3px solid var(--danger)">
                <div>
                  <div style="font-weight:600;font-size:0.88rem">${Utils.truncate(s.name,22)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${s.batch||''} · ${s.course||''}</div>
                </div>
                <div style="color:var(--danger-light);font-weight:700;font-family:var(--font-en)">${Utils.takaEn(s.due)}</div>
              </div>`).join('')}
          </div>` : `<div class="no-data"><i class="fa fa-check-circle" style="color:var(--success-light)"></i>সব পেমেন্ট পরিশোধিত</div>`}
        </div>
      </div>

      <!-- ── ROW: Batch Summary + Target Progress ── -->
      <div class="grid-2 mb-2">
        <!-- Batch Summary -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-layer-group" style="color:var(--primary-light)"></i> ব্যাচ সারসংক্ষেপ
          </div>
          ${batchSummary.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>ব্যাচ</th><th>শিক্ষার্থী</th><th>মোট ফি</th><th>পরিশোধ</th><th>বাকি</th></tr></thead>
            <tbody>
              ${batchSummary.map(b => `<tr>
                <td><span class="badge badge-primary">${b.batch}</span></td>
                <td>${b.count}</td>
                <td>${Utils.takaEn(b.total)}</td>
                <td class="ledger-income">${Utils.takaEn(b.paid)}</td>
                <td class="${b.due>0?'ledger-expense':'ledger-income'}">${Utils.takaEn(b.due)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="no-data"><i class="fa fa-inbox"></i>কোনো ব্যাচ নেই</div>`}
        </div>

        <!-- Target Progress -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">
            <i class="fa fa-bullseye" style="color:var(--accent)"></i> মাসিক লক্ষ্যমাত্রা — ${Utils.monthName(thisMonth)}
          </div>
          ${target > 0 ? `
            <div style="margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:0.85rem;color:var(--text-secondary)">অর্জিত</span>
                <span style="font-weight:700;color:var(--success-light)">${Utils.takaEn(monthIncome)}</span>
              </div>
              <div class="progress-bar-wrapper">
                <div class="progress-bar-fill" style="width:${Math.min(Utils.pct(monthIncome,target),100)}%"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:6px">
                <span style="font-size:0.78rem;color:var(--text-muted)">লক্ষ্য: ${Utils.takaEn(target)}</span>
                <span style="font-size:0.78rem;font-weight:600;color:var(--accent)">${Utils.pct(monthIncome,target)}%</span>
              </div>
            </div>
            <div style="background:var(--bg-input);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.85rem">
              ${monthIncome >= target
                ? `<span style="color:var(--success-light)"><i class="fa fa-trophy"></i> লক্ষ্য অর্জিত হয়েছে! 🎉</span>`
                : `<span style="color:var(--text-secondary)">আরও <strong style="color:var(--accent)">${Utils.takaEn(target-monthIncome)}</strong> প্রয়োজন</span>`}
            </div>
          ` : `
            <div class="no-data">
              <i class="fa fa-gear"></i>
              <span>Settings থেকে মাসিক লক্ষ্য নির্ধারণ করুন</span>
              <br><button class="btn-outline btn-sm" style="margin-top:10px" onclick="App.switchTab('settings')">সেটিংস খুলুন</button>
            </div>`}
        </div>
      </div>

      <!-- ── NOTICE BOARD (dashboard preview) ── -->
      <div class="card mb-2">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div class="card-title"><i class="fa fa-bullhorn" style="color:var(--warning)"></i> নোটিস বোর্ড</div>
          <button class="btn-outline btn-sm" onclick="App.switchTab('notice-board')"><i class="fa fa-arrow-right"></i> সব দেখুন</button>
        </div>
        <div id="dashboard-notices">
          ${renderNoticesHTML(activeNotices)}
        </div>
      </div>

      <!-- ── QUICK ADD SHORTCUTS ── -->
      <div class="card">
        <div class="card-title" style="margin-bottom:12px"><i class="fa fa-bolt" style="color:var(--accent)"></i> দ্রুত কাজ</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn-primary" onclick="App.quickAction('student')"><i class="fa fa-user-graduate"></i> শিক্ষার্থী যোগ</button>
          <button class="btn-success" onclick="App.quickAction('transaction')"><i class="fa fa-money-bill"></i> লেনদেন যোগ</button>
          <button class="btn-warning" onclick="App.quickAction('exam')"><i class="fa fa-clipboard-list"></i> পরীক্ষা নিবন্ধন</button>
          <button class="btn-secondary" onclick="App.quickAction('visitor')"><i class="fa fa-person"></i> ভিজিটর যোগ</button>
        </div>
      </div>
    `;

    /* Draw charts */
    drawRevenueChart(finance);
    drawEnrollChart(students);
  }

  /* ══════════════════════════════════════════
     NOTICE HTML (also called by timer interval)
  ══════════════════════════════════════════ */
  function renderNoticesHTML(notices) {
    if (!notices || notices.length === 0) {
      return `<div class="no-data"><i class="fa fa-check"></i>কোনো সক্রিয় নোটিস নেই</div>`;
    }
    const typeMap = {
      warning: { label: 'সতর্কতা', icon: 'fa-triangle-exclamation' },
      info:    { label: 'তথ্য',    icon: 'fa-circle-info' },
      danger:  { label: 'জরুরি',   icon: 'fa-circle-exclamation' },
      success: { label: 'সফলতা',   icon: 'fa-circle-check' },
    };
    return notices.map(n => {
      const t = typeMap[n.notice_type] || typeMap.info;
      const timerStr = n.expires_at ? Utils.timeLeft(n.expires_at) : '';
      return `<div class="notice-card ${n.notice_type||'info'}">
        <div class="notice-title"><i class="fa ${t.icon}"></i> ${n.title}</div>
        <div class="notice-body">${n.body||''}</div>
        ${timerStr ? `<div class="notice-meta"><span class="notice-timer"><i class="fa fa-clock"></i> ${timerStr}</span></div>` : ''}
      </div>`;
    }).join('');
  }

  function renderNotices() {
    const el = document.getElementById('dashboard-notices');
    if (!el) return;
    const notices = SupabaseSync.getAll(DB.notices)
      .filter(n => !n.expires_at || new Date(n.expires_at) > new Date())
      .slice(0, 3);
    el.innerHTML = renderNoticesHTML(notices);
  }

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  function statCard(icon, color, label, value, sub) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fa ${icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="card-sub">${sub}</div>` : ''}
      </div>
    </div>`;
  }

  function getAccountBalances(accounts, finance) {
    /* accounts table-এ initial balance থাকে, finance-এ movement */
    const base = { cash: 0, bank: 0, mobile: 0 };

    accounts.forEach(a => {
      if (a.type === 'Cash')          base.cash   += Utils.safeNum(a.balance);
      if (a.type === 'Bank')          base.bank   += Utils.safeNum(a.balance);
      if (a.type === 'Mobile Banking')base.mobile += Utils.safeNum(a.balance);
    });

    /* finance ledger দিয়ে adjust */
    finance.forEach(f => {
      const amt = Utils.safeNum(f.amount);
      const m   = f.method;
      const sign = (f.type === 'Income' || f.type === 'Loan Receiving' || f.type === 'Transfer In') ? 1 : -1;
      if (m === 'Cash')           base.cash   += amt * sign;
      if (m === 'Bank')           base.bank   += amt * sign;
      if (m === 'Mobile Banking') base.mobile += amt * sign;
    });

    return base;
  }

  function getBatchSummary(students) {
    const map = {};
    students.forEach(s => {
      const b = s.batch || 'অজানা';
      if (!map[b]) map[b] = { batch: b, count: 0, total: 0, paid: 0, due: 0 };
      map[b].count++;
      map[b].total += Utils.safeNum(s.total_fee);
      map[b].paid  += Utils.safeNum(s.paid);
      map[b].due   += Utils.safeNum(s.due);
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }

  /* ══════════════════════════════════════════
     CHARTS
  ══════════════════════════════════════════ */
  const CHART_DEFAULTS = {
    color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted')?.trim() || '#8fa3c0',
    grid:  'rgba(30,58,95,0.4)',
  };

  function drawRevenueChart(finance) {
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }

    /* Last 6 months */
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }

    const incomes  = months.map(m => finance.filter(f => f.type==='Income'  && (f.date||'').startsWith(m)).reduce((s,f)=>s+Utils.safeNum(f.amount),0));
    const expenses = months.map(m => finance.filter(f => f.type==='Expense' && (f.date||'').startsWith(m)).reduce((s,f)=>s+Utils.safeNum(f.amount),0));
    const labels   = months.map(m => Utils.monthName(m).split(' ')[0]); // short month name

    revenueChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'আয়', data: incomes,  backgroundColor: 'rgba(46,125,50,0.7)',  borderColor: '#43a047', borderWidth: 1, borderRadius: 4 },
          { label: 'ব্যয়', data: expenses, backgroundColor: 'rgba(229,57,53,0.7)', borderColor: '#ef5350', borderWidth: 1, borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { labels: { color: CHART_DEFAULTS.color, font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: CHART_DEFAULTS.color, font:{size:10} }, grid: { color: CHART_DEFAULTS.grid } },
          y: { ticks: { color: CHART_DEFAULTS.color, font:{size:10}, callback: v=>'৳'+v.toLocaleString() }, grid: { color: CHART_DEFAULTS.grid } },
        }
      }
    });
  }

  function drawEnrollChart(students) {
    const canvas = document.getElementById('enroll-chart');
    if (!canvas) return;
    if (enrollChart) { enrollChart.destroy(); enrollChart = null; }

    const courseMap = {};
    students.forEach(s => {
      const c = s.course || 'অজানা';
      courseMap[c] = (courseMap[c] || 0) + 1;
    });

    const labels = Object.keys(courseMap);
    const data   = Object.values(courseMap);

    if (labels.length === 0) {
      canvas.parentElement.innerHTML += `<div class="no-data"><i class="fa fa-inbox"></i>কোনো শিক্ষার্থী নেই</div>`;
      return;
    }

    const COLORS = ['#1565c0','#2e7d32','#f59e0b','#e53935','#0277bd','#6a1b9a','#00838f','#558b2f'];

    enrollChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: COLORS.slice(0, labels.length),
          borderColor: '#0a1628',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: CHART_DEFAULTS.color, font: { size: 11 }, padding: 10 }
          }
        }
      }
    });
  }

  return { render, renderNotices };

})();
