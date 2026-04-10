// ============================================================
// Wings Fly Aviation Academy — Dashboard Module
// ============================================================

const DashboardModule = (() => {

  function getSettings() {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    return {
      runningBatch:  cfg.running_batch  || '',
      expenseMonth:  cfg.expense_month  || '',
      monthlyTarget: Utils.safeNum(cfg.monthly_target),
    };
  }

  function getStats() {
    const students  = SupabaseSync.getAll(DB.students);
    const finance   = SupabaseSync.getAll(DB.finance);
    const accounts  = SupabaseSync.getAll(DB.accounts);
    const loans     = SupabaseSync.getAll(DB.loans);
    const notices   = SupabaseSync.getAll(DB.notices);
    const settings  = getSettings();

    const totalStudents = students.length;
    const totalIncome   = finance.filter(f => f.type === 'Income').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    const totalExpense  = finance.filter(f => f.type === 'Expense').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    const netProfit     = totalIncome - totalExpense;

    // Running Batch filtered stats
    const rStudents     = settings.runningBatch
      ? students.filter(s => s.batch === settings.runningBatch)
      : students;
    const rTotalStudents = rStudents.length;
    const rStudentIds    = new Set(rStudents.map(s => s.student_id));
    const rTotalIncome   = settings.runningBatch
      ? finance.filter(f => f.type === 'Income' && f.category === 'Student Fee' && rStudentIds.has(f.ref_id)).reduce((s, f) => s + Utils.safeNum(f.amount), 0)
      : totalIncome;

    // Expense Month filtered
    const rTotalExpense = settings.expenseMonth
      ? finance.filter(f => f.type === 'Expense' && f.date && f.date.startsWith(settings.expenseMonth)).reduce((s, f) => s + Utils.safeNum(f.amount), 0)
      : totalExpense;
    const rNetProfit = rTotalIncome - rTotalExpense;

    // Account balances
    const balances = { Cash: 0, Bank: 0, 'Mobile Banking': 0 };
    accounts.forEach(a => { if (balances[a.type] !== undefined) balances[a.type] += Utils.safeNum(a.balance); });
    const totalBalance = Object.values(balances).reduce((s, v) => s + v, 0);

    const totalDue = students.reduce((s, st) => s + Math.max(0, Utils.safeNum(st.total_fee) - Utils.safeNum(st.paid)), 0);
    const loanOut  = loans.filter(l => l.direction === 'given').reduce((s, l) => s + Utils.safeNum(l.amount), 0);
    const loanIn   = loans.filter(l => l.direction === 'received').reduce((s, l) => s + Utils.safeNum(l.amount), 0);

    return {
      totalStudents, totalIncome, totalExpense, netProfit, totalBalance, totalDue, loanOut, loanIn,
      rTotalStudents, rTotalIncome, rTotalExpense, rNetProfit,
      students, finance, balances, notices, loans, settings
    };
  }

  function getMonthlyRevenue(finance) {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key] = { income: 0, expense: 0 };
    }
    finance.forEach(f => {
      if (!f.date) return;
      const key = f.date.slice(0, 7);
      if (!months[key]) return;
      if (f.type === 'Income')  months[key].income  += Utils.safeNum(f.amount);
      if (f.type === 'Expense') months[key].expense += Utils.safeNum(f.amount);
    });
    return months;
  }

  function renderLastFive(finance) {
    const rows = Utils.sortBy(finance, 'date', 'desc').slice(0, 5);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">No transactions found</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>Date</th><th>Description</th><th>Type</th><th>Method</th><th class="text-right">Amount</th>
    </tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td style="font-size:.82rem">${Utils.formatDate(r.date)}</td>
      <td>${Utils.truncate(r.description||'—',28)}</td>
      <td>${r.type==='Income' ? Utils.badge('Income','success') : Utils.badge('Expense','danger')}</td>
      <td>${Utils.methodBadge(r.method||'Cash')}</td>
      <td class="text-right font-bold ${r.type==='Income'?'text-success':'text-error'}" style="font-family:var(--font-ui)">${Utils.takaEn(r.amount)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  }

  function renderRecentAdmissions(students) {
    const rows = Utils.sortBy(students, 'admission_date', 'desc').slice(0, 5);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">No students found</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>ID</th><th>Name</th><th>Course</th><th>Batch</th><th class="text-right">Due</th>
    </tr></thead><tbody>
    ${rows.map(r => {
      const due = Math.max(0, Utils.safeNum(r.total_fee) - Utils.safeNum(r.paid));
      return `<tr>
        <td>${Utils.badge(r.student_id||'—','info')}</td>
        <td class="font-bold">${r.name||'—'}</td>
        <td>${r.course||'—'}</td>
        <td>${r.batch||'—'}</td>
        <td class="text-right ${due>0?'text-error':'text-success'}" style="font-family:var(--font-ui)">${Utils.takaEn(due)}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
  }

  function renderNotices(notices) {
    const now = Date.now();
    const active = notices.filter(n => !n.expires_at || new Date(n.expires_at).getTime() > now);
    if (!active.length) return `<p class="text-muted" style="padding:12px 0">No active notices</p>`;
    const typeMap = { warning:'badge-warning', info:'badge-info', urgent:'badge-error', success:'badge-success' };
    const labelMap = { warning:'⚠️ Warning', info:'ℹ️ Info', urgent:'🚨 Urgent', success:'✅ Success' };
    return active.slice(0,5).map(n => `
      <div class="notice-item notice-${n.type||'info'}">
        <span class="badge ${typeMap[n.type]||'badge-info'}">${labelMap[n.type]||'Info'}</span>
        <p style="margin-top:6px;font-size:.9rem">${n.text||''}</p>
        ${n.expires_at ? `<small class="text-muted">Expires: ${Utils.formatDate(n.expires_at)}</small>` : ''}
      </div>`).join('');
  }

  function renderBarChart(months) {
    const entries = Object.entries(months);
    const maxVal = Math.max(...entries.map(([,v]) => Math.max(v.income, v.expense)), 1);
    const w = 100 / entries.length;
    const bars = entries.map(([key, val]) => {
      const ih = (val.income  / maxVal) * 120;
      const eh = (val.expense / maxVal) * 120;
      const label = key.slice(5);
      return `<div class="chart-col" style="width:${w}%">
        <div class="chart-bars">
          <div class="bar bar-income" style="height:${ih}px" title="Income: ${Utils.takaEn(val.income)}"></div>
          <div class="bar bar-expense" style="height:${eh}px" title="Expense: ${Utils.takaEn(val.expense)}"></div>
        </div>
        <div class="chart-label">${label}</div>
      </div>`;
    }).join('');
    return `<div class="chart-legend"><span><span class="legend-dot" style="background:var(--success)"></span>Income</span>
      <span><span class="legend-dot" style="background:var(--error)"></span>Expense</span></div>
      <div class="bar-chart">${bars}</div>`;
  }

  function renderReminders(students) {
    const dues = students.filter(s => (Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid)) > 0)
      .sort((a,b) => (Utils.safeNum(b.total_fee)-Utils.safeNum(b.paid)) - (Utils.safeNum(a.total_fee)-Utils.safeNum(a.paid)))
      .slice(0,5);
    if (!dues.length) return `<p class="text-muted" style="padding:12px 0">All dues clear ✅</p>`;
    return dues.map(s => {
      const due = Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid);
      return `<div class="reminder-item">
        <div><div class="font-bold">${s.name||'—'}</div><small class="text-muted">${s.student_id||''} • ${s.batch||''}</small></div>
        ${Utils.badge(Utils.takaEn(due),'danger')}
      </div>`;
    }).join('');
  }

  function renderBatchSummary(students) {
    const batches = {};
    students.forEach(s => {
      const b = s.batch || 'Unknown';
      if (!batches[b]) batches[b] = { total: 0, paid: 0, due: 0, count: 0 };
      batches[b].count++;
      batches[b].total += Utils.safeNum(s.total_fee);
      batches[b].paid  += Utils.safeNum(s.paid);
      batches[b].due   += Math.max(0, Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid));
    });
    const rows = Object.entries(batches);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">No batches found</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>Batch</th><th class="text-right">Students</th>
      <th class="text-right">Total Fee</th><th class="text-right">Paid</th><th class="text-right">Due</th>
    </tr></thead><tbody>
    ${rows.map(([b,v]) => `<tr>
      <td class="font-bold">${b}</td><td class="text-right">${v.count}</td>
      <td class="text-right" style="font-family:var(--font-ui)">${Utils.takaEn(v.total)}</td>
      <td class="text-right text-success" style="font-family:var(--font-ui)">${Utils.takaEn(v.paid)}</td>
      <td class="text-right ${v.due>0?'text-error':'text-success'}" style="font-family:var(--font-ui)">${Utils.takaEn(v.due)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  }

  function renderTargetProgress(settings, rTotalIncome) {
    if (!settings.monthlyTarget) return '';
    const pct = Math.min(100, Math.round((rTotalIncome / settings.monthlyTarget) * 100));
    const barColor = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)';
    return `
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>🎯 Target Progress</span>
          <span style="font-size:.8rem;color:var(--text-muted)">Goal: ${Utils.takaEn(settings.monthlyTarget)}</span>
        </div>
        <div style="background:rgba(255,255,255,.05);border-radius:12px;height:24px;overflow:hidden;margin-bottom:8px">
          <div style="width:${pct}%;height:100%;background:${barColor};border-radius:12px;transition:width .6s ease;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;min-width:40px">${pct}%</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-secondary)">
          <span>Collected: ${Utils.takaEn(rTotalIncome)}</span>
          <span>Remaining: ${Utils.takaEn(Math.max(0, settings.monthlyTarget - rTotalIncome))}</span>
        </div>
      </div>`;
  }

  function renderLoanSummary(loanOut, loanIn) {
    const netLoan = loanOut - loanIn;
    return `
      <div class="card">
        <div class="card-title">💳 Loan Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
          <div>
            <div style="font-size:.78rem;color:var(--text-muted)">Given</div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--error);font-family:var(--font-ui)">${Utils.takaEn(loanOut)}</div>
          </div>
          <div>
            <div style="font-size:.78rem;color:var(--text-muted)">Received</div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--success);font-family:var(--font-ui)">${Utils.takaEn(loanIn)}</div>
          </div>
          <div>
            <div style="font-size:.78rem;color:var(--text-muted)">Net Outstanding</div>
            <div style="font-size:1.2rem;font-weight:700;color:var(--info);font-family:var(--font-ui)">${Utils.takaEn(Math.abs(netLoan))}</div>
          </div>
        </div>
      </div>`;
  }

  // ── MAIN RENDER ─────────────────────────────────────────
  function render() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const { totalStudents, totalIncome, totalExpense, netProfit,
            totalBalance, totalDue, loanOut, loanIn,
            rTotalStudents, rTotalIncome, rTotalExpense, rNetProfit,
            students, finance, balances, notices, loans, settings } = getStats();

    const { runningBatch, expenseMonth } = settings;
    const monthly = getMonthlyRevenue(finance);

    container.innerHTML = `
      <!-- Running Batch Overview -->
      <div class="dash-section-title">
        <i class="fa fa-rocket"></i> RUNNING BATCH OVERVIEW
        ${runningBatch ? `<span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">(${runningBatch})</span>` : ''}
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <!-- Total Students -->
        <div class="stat-card glow-cyan" onclick="App.navigateTo('students')" style="cursor:pointer">
          <div class="stat-header">TOTAL STUDENTS</div>
          <div class="stat-icon-wrapper"><i class="fa fa-users"></i></div>
          <div class="stat-value">${rTotalStudents}</div>
          <div class="stat-subtext">${runningBatch ? `${runningBatch} Enrollment` : 'Active Enrollment'}</div>
          <div class="stat-badge" style="background:rgba(0,255,136,.1);color:#00ff88;border-color:rgba(0,255,136,.3)">↑ Active</div>
        </div>

        <!-- Student Collection -->
        <div class="stat-card glow-cyan" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-header">STUDENT COLLECTION</div>
          <div class="stat-icon-wrapper"><i class="fa fa-wallet"></i></div>
          <div class="stat-value">${Utils.takaEn(rTotalIncome)}</div>
          <div class="stat-subtext">Course Fees Only</div>
          <div class="stat-badge" style="background:rgba(0,255,136,.1);color:#00ff88;border-color:rgba(0,255,136,.3)">✓ Collected</div>
        </div>

        <!-- Total Expense -->
        <div class="stat-card glow-orange" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-header">TOTAL EXPENSE</div>
          <div class="stat-icon-wrapper"><i class="fa fa-arrow-trend-down"></i></div>
          <div class="stat-value">${Utils.takaEn(rTotalExpense)}</div>
          <div class="stat-subtext">${expenseMonth ? `Cost for ${expenseMonth}` : 'Operating Costs'}</div>
          <div class="stat-badge" style="background:rgba(255,107,53,.1);color:#ff6b35;border-color:rgba(255,107,53,.3)">↓ Costs</div>
        </div>

        <!-- Net Profit/Loss -->
        <div class="stat-card glow-purple">
          <div class="stat-header">NET PROFIT/LOSS</div>
          <div class="stat-icon-wrapper"><i class="fa fa-calculator"></i></div>
          <div class="stat-value">${Utils.takaEn(rNetProfit)}</div>
          <div class="stat-subtext">${rNetProfit >= 0 ? 'Net Profit' : 'Net Loss'}</div>
          <div class="stat-badge" style="background:rgba(0,255,136,.1);color:#00ff88;border-color:rgba(0,255,136,.3)">✓ ${rNetProfit >= 0 ? 'Healthy' : 'Critical'}</div>
        </div>

        <!-- Account Balance -->
        <div class="stat-card glow-cyan" onclick="App.navigateTo('accounts')" style="cursor:pointer">
          <div class="stat-header">ACCOUNT BALANCE</div>
          <div class="stat-icon-wrapper"><i class="fa fa-building-columns"></i></div>
          <div class="stat-value">${Utils.takaEn(totalBalance)}</div>
          <div class="stat-subtext">Cash + Bank + Mobile</div>
          <div class="stat-badge" style="background:rgba(0,212,255,.1);color:#00d4ff;border-color:rgba(0,212,255,.3)">Safeguard</div>
        </div>
      </div>

      <!-- Target Progress -->
      ${renderTargetProgress(settings, rTotalIncome)}

      <!-- All-Time Lifetime Overview -->
      <div class="dash-section-title" style="margin-top:40px;">
        <i class="fa fa-chart-bar"></i> ALL-TIME LIFETIME OVERVIEW
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:var(--text-secondary); font-size:0.8rem;">All Students</div>
          <div class="stat-value" style="font-size:1.4rem">${totalStudents}</div>
          <div class="stat-subtext" style="margin-bottom:0;">Total Enrolled</div>
        </div>

        <div class="stat-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:var(--text-secondary); font-size:0.8rem;">All Collection</div>
          <div class="stat-value" style="font-size:1.4rem; color:var(--success)">${Utils.takaEn(totalIncome)}</div>
          <div class="stat-subtext" style="margin-bottom:0;">Student Fees</div>
        </div>

        <div class="stat-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:var(--text-secondary); font-size:0.8rem;">Total Expense</div>
          <div class="stat-value" style="font-size:1.4rem; color:var(--error)">${Utils.takaEn(totalExpense)}</div>
          <div class="stat-subtext" style="margin-bottom:0;">All Time Costs</div>
        </div>

        <div class="stat-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:var(--text-secondary); font-size:0.8rem;">Net Profit/Loss</div>
          <div class="stat-value" style="font-size:1.4rem; color:${netProfit>=0?'var(--success)':'var(--error)'}">${Utils.takaEn(netProfit)}</div>
          <div class="stat-subtext" style="margin-bottom:0;">${netProfit>=0?'Net Profit':'Net Loss'}</div>
        </div>

        <div class="stat-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:var(--text-secondary); font-size:0.8rem;">Account Balance</div>
          <div class="stat-value" style="font-size:1.4rem; color:var(--info)">${Utils.takaEn(totalBalance)}</div>
          <div class="stat-subtext" style="margin-bottom:0;">Cash + Bank + Mobile</div>
        </div>
      </div>

      <!-- Charts & Notices -->
      <div class="dash-grid mb-24" style="margin-top:32px;">
        <div class="card">
          <div class="card-title">📈 Analytics Overview</div>
          ${renderBarChart(monthly)}
        </div>
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between">
            <span>📢 Notice Board</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('notice-board')">View All</button>
          </div>
          ${renderNotices(notices)}
        </div>
      </div>

      <!-- Loan Summary & Student Reminders -->
      <div class="dash-grid mb-24">
        ${renderLoanSummary(loanOut, loanIn)}
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>🔔 Student Reminders (Due)</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">View All</button>
          </div>
          ${renderReminders(students)}
        </div>
      </div>

      <!-- Batch Summary & Recent Admissions -->
      <div class="dash-grid mb-24">
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>📊 Batch Financial Summary</span>
          </div>
          ${renderBatchSummary(students)}
        </div>
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>🆕 Recent Admissions</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">View All</button>
          </div>
          ${renderRecentAdmissions(students)}
        </div>
      </div>

      <!-- Last 5 Transactions -->
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>💸 Last 5 Transactions</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('finance')">View All</button>
        </div>
        ${renderLastFive(finance)}
      </div>
    `;
  }

  return { render };
})();

// Dashboard styles
(function injectDashStyles() {
  if (document.getElementById('dash-styles')) return;
  const s = document.createElement('style');
  s.id = 'dash-styles';
  s.textContent = `
    .dash-section-title { font-size:1rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-cyan,var(--brand-primary)); margin-bottom:16px; display:flex; align-items:center; gap:8px; }
    .dash-grid  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media(max-width:768px){ .dash-grid { grid-template-columns:1fr; } }
    .bar-chart { display:flex; align-items:flex-end; height:160px; gap:4px; padding-top:8px; }
    .chart-col { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .chart-bars { display:flex; align-items:flex-end; gap:2px; }
    .bar { width:18px; border-radius:3px 3px 0 0; transition:height .4s; min-height:2px; }
    .bar-income  { background:var(--success); }
    .bar-expense { background:var(--error); opacity:.7; }
    .chart-label { font-size:.68rem; color:var(--text-muted); }
    .chart-legend { display:flex; gap:16px; margin-bottom:8px; font-size:.8rem; }
    .legend-dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; }
    .notice-item { padding:10px 12px; border-radius:var(--radius-sm); border-left:3px solid; margin-bottom:8px; }
    .notice-info    { background:var(--info-bg);    border-color:var(--info); }
    .notice-warning { background:var(--warning-bg); border-color:var(--warning); }
    .notice-urgent  { background:var(--error-bg);   border-color:var(--error); }
    .notice-success { background:var(--success-bg); border-color:var(--success); }
    .reminder-item { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); }
    .reminder-item:last-child { border-bottom:none; }
    .mb-12 { margin-bottom:12px; }
  `;
  document.head.appendChild(s);
})();

window.DashboardModule = DashboardModule;
