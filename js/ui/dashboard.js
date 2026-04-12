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

  function normalizeAccounts(accounts) {
    const seen = new Set();
    const normalized = [];
    accounts.forEach(a => {
      const name = String(a.name || '').trim();
      if (a.type === 'Cash' && name !== 'Cash') return;
      if (a.type === 'Bank_Detail' || a.type === 'Mobile_Detail') {
        const invalid = !name || /^\d+$/.test(name) || /^Bank \d+$/.test(name) || /^Mobile Banking \d+$/.test(name);
        if (invalid) return;
      }
      const key = `${a.type}||${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(a);
    });
    return normalized;
  }

  function getPrimaryCashAccount(accounts) {
    const cashAccounts = accounts.filter(a => a.type === 'Cash' && a.name === 'Cash');
    if (cashAccounts.length === 0) return { id: '', type: 'Cash', balance: 0 };
    return cashAccounts.reduce((best, a) => {
      return Math.abs(Utils.safeNum(a.balance)) < Math.abs(Utils.safeNum(best.balance)) ? a : best;
    });
  }

  function getStats() {
    const students  = SupabaseSync.getAll(DB.students);
    const finance   = SupabaseSync.getAll(DB.finance);
    const accounts  = normalizeAccounts(SupabaseSync.getAll(DB.accounts));
    const loans     = SupabaseSync.getAll(DB.loans);
    const notices   = SupabaseSync.getAll(DB.notices);
    const settings  = getSettings();
    const cfg       = SupabaseSync.getAll(DB.settings)[0] || {};

    const totalStudents = students.length;

    // All-Time: "All Collection" = sum of all finance Income records
    const totalIncome  = finance.filter(f => f.type === 'Income').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    // All-Time: "Total Expense" = sum of all finance expenses
    const totalExpense = finance.filter(f => f.type === 'Expense').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    const netProfit    = totalIncome - totalExpense;

    // ── Running Batch filtered stats ──────────────────────────
    const rStudents      = settings.runningBatch
      ? students.filter(s => s.batch === settings.runningBatch)
      : students;
    const rTotalStudents = rStudents.length;

    // Student Collection for running batch = sum of paid from batch students
    const rTotalIncome = settings.runningBatch
      ? rStudents.reduce((s, st) => s + Utils.safeNum(st.paid), 0)
      : totalIncome;

    // Expense for running batch = filtered by expense_start_date → today
    const expStart = cfg.expense_start_date || '';
    const today    = new Date().toISOString().split('T')[0]; // always use today as end
    const rTotalExpense = expStart
      ? finance.filter(f => {
          if (f.type !== 'Expense') return false;
          if (!f.date) return false;
          if (f.date < expStart) return false;
          if (f.date > today) return false;
          return true;
        }).reduce((s, f) => s + Utils.safeNum(f.amount), 0)
      : totalExpense;
    const rNetProfit = rTotalIncome - rTotalExpense;

    // ── Account Balance = just sum of valid accounts.balance ────────
    // Ignore generic or broken duplicate account entries from import.
    const cleanAccounts = normalizeAccounts(accounts);
    let cashBal = 0, bankBal = 0, mobileBal = 0;
    cleanAccounts.forEach(a => {
      if (a.type === 'Cash')          cashBal   += Utils.safeNum(a.balance);
      else if (a.type === 'Bank_Detail')   bankBal   += Utils.safeNum(a.balance);
      else if (a.type === 'Mobile_Detail') mobileBal += Utils.safeNum(a.balance);
    });
    const balances     = { Cash: cashBal, Bank: bankBal, 'Mobile Banking': mobileBal };
    const totalBalance = cashBal + bankBal + mobileBal;

    const totalDue = students.reduce((s, st) => s + Math.max(0, Utils.safeNum(st.total_fee) - Utils.safeNum(st.paid)), 0);
    const loanOut  = loans.filter(l => l.direction === 'given').reduce((s, l) => s + Utils.safeNum(l.amount), 0);
    const loanIn   = loans.filter(l => l.direction === 'received').reduce((s, l) => s + Utils.safeNum(l.amount), 0);

    // Advance payments (pending/outstanding)
    const advancesRaw = (() => { try { return JSON.parse(localStorage.getItem('wfa_advance_payments') || '[]'); } catch(e) { return []; } })();
    const advances = advancesRaw.map(a => {
      const returned = (a.returns || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      return { ...a, _remaining: (parseFloat(a.amount) || 0) - returned };
    }).filter(a => a._remaining > 0); // only pending ones

    return {
      totalStudents, totalIncome, totalExpense, netProfit, totalBalance, totalDue, loanOut, loanIn,
      rTotalStudents, rTotalIncome, rTotalExpense, rNetProfit,
      students, finance, balances, notices, loans, settings, advances
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
      <div class="card animated-border-box">
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
            students, finance, balances, notices, loans, settings, advances } = getStats();

    const { runningBatch, expenseMonth } = settings;
    const monthly = getMonthlyRevenue(finance);

    container.innerHTML = `
      <!-- Running Batch Overview -->
      <div class="dash-section-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span><i class="fa fa-rocket"></i> RUNNING BATCH OVERVIEW${runningBatch ? ` <span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">(${runningBatch})</span>` : ''}</span>
        ${advances.length > 0 ? `
        <div onclick="App.navigateTo('settings')" style="cursor:pointer; display:flex; align-items:center; gap:8px; background:linear-gradient(90deg,rgba(255,170,0,0.12),rgba(255,71,87,0.1)); border:1px solid rgba(255,170,0,0.35); border-radius:30px; padding:6px 14px; box-shadow:0 0 12px rgba(255,170,0,0.15); transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 0 20px rgba(255,170,0,0.35)'" onmouseout="this.style.boxShadow='0 0 12px rgba(255,170,0,0.15)'">
          <i class="fa fa-money-bill-transfer" style="color:#ffaa00; font-size:0.85rem;"></i>
          <span style="font-size:0.75rem; font-weight:700; color:#ffaa00; letter-spacing:0.5px;">PENDING ADVANCES:</span>
          <span style="font-size:0.85rem; font-weight:800; color:#fff; font-family:var(--font-ui);">৳${advances.reduce((s,a)=>s+a._remaining,0).toLocaleString('en-IN')}</span>
          <span style="font-size:0.72rem; color:rgba(255,255,255,0.55);">${advances.length} person${advances.length>1?'s':''}</span>
        </div>` : ''}
      </div>

      <div class="stat-grid grid-5">
        <!-- Total Students -->
        <div class="stat-card animated-glow glow-cyan" onclick="App.navigateTo('students')" style="cursor:pointer">
          <div class="stat-header">TOTAL STUDENTS</div>
          <div class="stat-icon-wrapper"><i class="fa fa-users"></i></div>
          <div class="stat-value counter-val" data-target="${rTotalStudents}">0</div>
          <div class="stat-subtext">${runningBatch ? `${runningBatch} Enrollment` : 'Active Enrollment'}</div>
          <div class="stat-badge" style="background:rgba(0,229,255,.12);color:#00e5ff;border-color:rgba(0,229,255,.35);box-shadow:0 0 8px rgba(0,229,255,0.2)">↑ +12%</div>
        </div>

        <!-- Student Collection -->
        <div class="stat-card animated-glow glow-green" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-header">STUDENT COLLECTION</div>
          <div class="stat-icon-wrapper"><i class="fa fa-wallet"></i></div>
          <div class="stat-value counter-val" data-target="${Utils.takaEn(rTotalIncome)}">0</div>
          <div class="stat-subtext">Course Fees Only</div>
          <div class="stat-badge" style="background:rgba(0,255,136,.12);color:#00ff88;border-color:rgba(0,255,136,.35);box-shadow:0 0 8px rgba(0,255,136,0.2)">↑ +8%</div>
        </div>

        <!-- Total Expense -->
        <div class="stat-card animated-glow glow-orange" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-header">TOTAL EXPENSE</div>
          <div class="stat-icon-wrapper"><i class="fa fa-arrow-trend-down"></i></div>
          <div class="stat-value counter-val" data-target="${Utils.takaEn(rTotalExpense)}">0</div>
          <div class="stat-subtext">${expenseMonth ? `Cost for ${expenseMonth}` : 'Operating Costs'}</div>
          <div class="stat-badge" style="background:rgba(255,107,53,.12);color:#ff6b35;border-color:rgba(255,107,53,.35);box-shadow:0 0 8px rgba(255,107,53,0.2)">↓ -3%</div>
        </div>

        <!-- Net Profit/Loss -->
        <div class="stat-card animated-glow glow-purple">
          <div class="stat-header">NET PROFIT/LOSS</div>
          <div class="stat-icon-wrapper"><i class="fa fa-calculator"></i></div>
          <div class="stat-value counter-val" style="color:${rNetProfit>=0?'var(--success)':'#ff4757'}; text-shadow:0 0 10px ${rNetProfit>=0?'rgba(0,255,136,0.3)':'rgba(255,71,87,0.3)'};" data-target="${Utils.takaEn(Math.abs(rNetProfit))}">0</div>
          <div class="stat-subtext" style="color:${rNetProfit>=0?'#00ff88':'#ff4757'}; font-weight:700; font-size:0.8rem; letter-spacing:0.5px;">${rNetProfit >= 0 ? '▲ Net Profit' : '▼ Net Loss'}</div>
          <div class="stat-badge" style="background:rgba(${rNetProfit>=0?'0,255,136':'255,71,87'},.12);color:${rNetProfit>=0?'#00ff88':'#ff4757'};border-color:rgba(${rNetProfit>=0?'0,255,136':'255,71,87'},.35);box-shadow:0 0 8px rgba(${rNetProfit>=0?'0,255,136':'255,71,87'},0.2)">✦ ${rNetProfit >= 0 ? 'Healthy' : 'Loss'}</div>
        </div>

        <!-- Account Balance -->
        <div class="stat-card animated-glow glow-cyan" onclick="App.navigateTo('accounts')" style="cursor:pointer; --glow-color:#00bcd4;">
          <div class="stat-header">ACCOUNT BALANCE</div>
          <div class="stat-icon-wrapper"><i class="fa fa-building-columns"></i></div>
          <div class="stat-value counter-val" data-target="${Utils.takaEn(totalBalance)}">0</div>
          <div class="stat-subtext">Cash + Bank + Mobile</div>
          <div class="stat-badge" style="background:rgba(0,212,255,.12);color:#00d4ff;border-color:rgba(0,212,255,.35);box-shadow:0 0 8px rgba(0,212,255,0.2)">⊕ Assets</div>
        </div>
      </div>

      <!-- Target Progress -->
      ${renderTargetProgress(settings, rTotalIncome)}

      <!-- All-Time Lifetime Overview -->
      <div class="dash-section-title" style="margin-top:40px;">
        <i class="fa fa-chart-bar"></i> ALL-TIME LIFETIME OVERVIEW
      </div>

      <div class="stat-grid grid-5">
        <div class="stat-card lifetime-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:#fff; font-size:0.85rem; font-weight:700; letter-spacing:0.05em;">ALL STUDENTS</div>
          <div class="stat-value" style="font-size:1.6rem; font-weight:800; text-shadow:0 0 10px rgba(255,255,255,0.3);">${totalStudents}</div>
          <div class="stat-subtext" style="color:var(--brand-primary)">Total Enrolled</div>
        </div>

        <div class="stat-card lifetime-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:#fff; font-size:0.85rem; font-weight:700; letter-spacing:0.05em;">ALL COLLECTION</div>
          <div class="stat-value" style="font-size:1.6rem; color:var(--success); font-weight:800; text-shadow:0 0 10px rgba(0,255,136,0.3);">${Utils.takaEn(totalIncome)}</div>
          <div class="stat-subtext" style="color:var(--brand-primary)">Student Fees</div>
        </div>

        <div class="stat-card lifetime-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:#fff; font-size:0.85rem; font-weight:700; letter-spacing:0.05em;">TOTAL EXPENSE</div>
          <div class="stat-value" style="font-size:1.6rem; color:var(--error); font-weight:800; text-shadow:0 0 10px rgba(255,71,87,0.3);">${Utils.takaEn(totalExpense)}</div>
          <div class="stat-subtext" style="color:var(--brand-primary)">All Time Costs</div>
        </div>

        <div class="stat-card lifetime-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:#fff; font-size:0.85rem; font-weight:700; letter-spacing:0.05em;">NET PROFIT/LOSS</div>
          <div class="stat-value" style="font-size:1.6rem; font-weight:800; color:${netProfit>=0?'var(--success)':'#ff4757'}; text-shadow:0 0 10px ${netProfit>=0?'rgba(0,255,136,0.3)':'rgba(255,71,87,0.3)'}">${Utils.takaEn(Math.abs(netProfit))}</div>
          <div class="stat-subtext" style="color:${netProfit>=0?'#00ff88':'#ff4757'}; font-weight:700; font-size:0.78rem; letter-spacing:0.5px;">${netProfit>=0?'▲ Net Profit':'▼ Net Loss'}</div>
        </div>

        <div class="stat-card lifetime-card" style="box-shadow:none; border:1px solid rgba(255,255,255,0.05); padding:16px;">
          <div class="stat-header" style="color:#fff; font-size:0.85rem; font-weight:700; letter-spacing:0.05em;">ACCOUNT BALANCE</div>
          <div class="stat-value" style="font-size:1.6rem; color:var(--info); font-weight:800; text-shadow:0 0 10px rgba(0,212,255,0.3);">${Utils.takaEn(totalBalance)}</div>
          <div class="stat-subtext" style="color:var(--brand-primary)">Cash + Bank + Mobile</div>
        </div>
      </div>

      <!-- Charts & Notices -->
      <div class="dash-grid mb-24" style="margin-top:32px;">
        <div class="card stat-card animated-border-box" style="grid-column: 1 / -1; padding:24px; z-index:1;">
          <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:1.4rem; font-weight:800; color:var(--brand-primary); text-shadow:0 0 10px rgba(0,212,255,0.3);">Analytics Overview</div>
            <button class="btn btn-outline btn-sm"><i class="fa fa-calendar"></i> Date - ${new Date().toLocaleString('default', {month:'short', day:'numeric'})}</button>
          </div>
          <div class="moving-gradient-line"></div>
          
          <div class="dash-grid" style="grid-template-columns: 2fr 1fr; gap:32px; align-items:center;">
            <!-- Revenue Chart -->
            <div>
              <div style="font-weight:700; color:#fff; margin-bottom:16px;">Revenue 2024 (in Thousands)</div>
              <div style="height:320px; width:100%;">
                <canvas id="revenueChart"></canvas>
              </div>
            </div>
            
            <!-- Course Enrollments Doughnut -->
            <div style="border-left:1px solid rgba(255,255,255,0.1); padding-left:24px; height:100%;">
              <div style="font-weight:700; color:#fff; margin-bottom:16px;">Course Enrollments</div>
              <div style="position:relative; width:260px; height:260px; margin: 0 auto; display:flex; justify-content:center; align-items:center;">
                <div class="doughnut-glow-ring"></div>
                <canvas id="courseChart" style="position:relative; z-index:2; width:100%; height:100%;"></canvas>
                <div style="position:absolute; top:42%; left:50%; transform:translate(-50%, -50%); text-align:center; pointer-events:none; z-index:3;">
                  <div class="counter-val" data-target="${rTotalStudents}" style="font-size:2.8rem; font-weight:800; color:#00d4ff; text-shadow:0 0 15px rgba(0,212,255,0.5); line-height:1;">0</div>
                  <div style="font-size:0.75rem; font-weight:700; letter-spacing:0.1em; color:var(--text-secondary); margin-top:4px;">STUDENTS</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card animated-border-box" style="grid-column: 1 / -1;">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>📢 Notice Board</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('notice-board')">View All</button>
          </div>
          ${renderNotices(notices)}
        </div>
      </div>

      <!-- Loan Summary & Student Reminders -->
      <div class="dash-grid mb-24">
        ${renderLoanSummary(loanOut, loanIn)}
        <div class="card animated-border-box">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>🔔 Student Reminders (Due)</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">View All</button>
          </div>
          ${renderReminders(students)}
        </div>
      </div>

      <!-- Batch Summary & Recent Admissions -->
      <div class="dash-grid mb-24">
        <div class="card animated-border-box">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>📊 Batch Financial Summary</span>
          </div>
          ${renderBatchSummary(students)}
        </div>
        <div class="card animated-border-box">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>🆕 Recent Admissions</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">View All</button>
          </div>
          ${renderRecentAdmissions(students)}
        </div>
      </div>

      <!-- Last 5 Transactions -->
      <div class="card animated-border-box mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>💸 Last 5 Transactions</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('finance')">View All</button>
        </div>
        ${renderLastFive(finance)}
      </div>
    `;

    setTimeout(() => {
      animateCounters();
      initCharts(monthly, students);
    }, 50);
  }

  function animateCounters() {
    const counters = document.querySelectorAll('.counter-val');
    counters.forEach(counter => {
      const targetStr = counter.getAttribute('data-target');
      if (!targetStr) return;
      
      const isCurrency = targetStr.includes('৳');
      const targetClean = targetStr.replace(/[^\d.-]/g, '');
      const targetVal = parseFloat(targetClean);
      if (isNaN(targetVal)) {
        counter.textContent = targetStr;
        return;
      }

      let startVal = 0;
      const duration = 1200;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        const currentVal = startVal + (targetVal - startVal) * ease;

        if (isCurrency) {
          counter.textContent = Utils.takaEn(Math.floor(currentVal));
        } else {
          counter.textContent = Math.floor(currentVal);
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = targetStr;
        }
      }
      requestAnimationFrame(update);
    });
  }

  function initCharts(monthly, students) {
    if (!window.Chart) return;

    // Revenue Chart
    const revCanvas = document.getElementById('revenueChart');
    if (revCanvas) {
      if (window.dashRevChart) window.dashRevChart.destroy();
      
      const mKeys = Object.keys(monthly).sort();
      const labels = mKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, parseInt(m)-1, 1).toLocaleString('default', {month:'short'});
      });
      const incomeData = mKeys.map(k => monthly[k].income / 1000);
      const expenseData = mKeys.map(k => monthly[k].expense / 1000);

      const style = getComputedStyle(document.body);
      const colorIncome = style.getPropertyValue('--brand-primary').trim() || '#00d4ff';
      const colorExpense = style.getPropertyValue('--error').trim() || '#ff4757';
      const colorDoughnut = [
        style.getPropertyValue('--brand-primary').trim() || '#00d4ff',
        style.getPropertyValue('--brand-accent').trim() || '#ffeb3b',
        style.getPropertyValue('--brand-gold').trim() || '#F9A825',
        style.getPropertyValue('--brand-neon').trim() || '#00ff88',
        style.getPropertyValue('--error').trim() || '#ff4757'
      ];

      window.dashRevChart = new Chart(revCanvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Income', data: incomeData, backgroundColor: colorIncome, borderRadius: 4, barPercentage: 0.6 },
            { label: 'Expense', data: expenseData, backgroundColor: colorExpense, borderRadius: 4, barPercentage: 0.6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#fff', usePointStyle: true, boxWidth: 8 } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Course Chart
    const courseCanvas = document.getElementById('courseChart');
    if (courseCanvas) {
      if (window.dashCourseChart) window.dashCourseChart.destroy();

      const courseMap = {};
      students.forEach(s => {
        const c = s.course || 'Unknown';
        courseMap[c] = (courseMap[c] || 0) + 1;
      });
      const cLabels = Object.keys(courseMap);
      const cData = Object.values(courseMap);

      const style = getComputedStyle(document.body);
      const colorDoughnut = [
        '#00ff88', /* Neon Green */
        '#ffeb3b', /* Bright Yellow */
        '#ff007f', /* Neon Pink */
        '#00d4ff', /* Cyan */
        '#b537f2'  /* Purple */
      ];

      window.dashCourseChart = new Chart(courseCanvas, {
        type: 'doughnut',
        data: {
          labels: cLabels,
          datasets: [{
            data: cData,
            backgroundColor: colorDoughnut,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#fff', font: { size: 11 }, usePointStyle: true } }
          }
        }
      });
    }
  }

  return { render };
})();

// Dashboard styles
(function injectDashStyles() {
  if (document.getElementById('dash-styles')) return;
  const s = document.createElement('style');
  s.id = 'dash-styles';
  s.textContent = `
    .dash-section-title { font-size:0.72rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--brand-primary); margin-bottom:16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(0,212,255,0.1); padding-bottom:6px; }
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
    .notice-item { padding:12px 14px; border-radius:10px; border-left:3px solid; margin-bottom:8px; background:rgba(17,24,39,0.6); }
    .notice-info    { border-color:rgba(0,212,255,0.5);  background:rgba(0,212,255,0.04); }
    .notice-warning { border-color:rgba(255,107,53,0.5); background:rgba(255,107,53,0.04); }
    .notice-urgent  { border-color:rgba(255,71,87,0.5);  background:rgba(255,71,87,0.04); }
    .notice-success { border-color:rgba(0,255,136,0.5);  background:rgba(0,255,136,0.04); }
    .reminder-item { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
    .reminder-item:last-child { border-bottom:none; }
    .mb-12 { margin-bottom:12px; }
  `;
  document.head.appendChild(s);
})();

window.DashboardModule = DashboardModule;
