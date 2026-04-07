// ============================================================
// Wings Fly Aviation Academy — Dashboard Module
// ============================================================

const DashboardModule = (() => {

  function getStats() {
    const students  = SupabaseSync.getAll(DB.students);
    const finance   = SupabaseSync.getAll(DB.finance);
    const accounts  = SupabaseSync.getAll(DB.accounts);
    const loans     = SupabaseSync.getAll(DB.loans);
    const notices   = SupabaseSync.getAll(DB.notices);

    const totalStudents = students.length;
    const totalIncome   = finance.filter(f => f.type === 'Income').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    const totalExpense  = finance.filter(f => f.type === 'Expense').reduce((s, f) => s + Utils.safeNum(f.amount), 0);
    const netProfit     = totalIncome - totalExpense;

    // Account balances
    const balances = { Cash: 0, Bank: 0, 'Mobile Banking': 0 };
    accounts.forEach(a => { if (balances[a.type] !== undefined) balances[a.type] += Utils.safeNum(a.balance); });
    const totalBalance = Object.values(balances).reduce((s, v) => s + v, 0);

    const totalDue = students.reduce((s, st) => s + Math.max(0, Utils.safeNum(st.total_fee) - Utils.safeNum(st.paid)), 0);
    const loanOut  = loans.filter(l => l.direction === 'given').reduce((s, l) => s + Utils.safeNum(l.amount), 0);
    const loanIn   = loans.filter(l => l.direction === 'received').reduce((s, l) => s + Utils.safeNum(l.amount), 0);

    return { totalStudents, totalIncome, totalExpense, netProfit, totalBalance, totalDue, loanOut, loanIn,
             students, finance, balances, notices };
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
    if (!rows.length) return `<p class="text-muted bn" style="padding:16px">কোনো লেনদেন নেই</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>তারিখ</th><th>বিবরণ</th><th>ধরন</th><th>পদ্ধতি</th><th class="text-right">পরিমাণ</th>
    </tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td style="font-size:.82rem">${Utils.formatDate(r.date)}</td>
      <td>${Utils.truncate(r.description||'—',28)}</td>
      <td>${r.type==='Income' ? Utils.badge('আয়','success') : Utils.badge('ব্যয়','danger')}</td>
      <td>${Utils.methodBadge(r.method||'Cash')}</td>
      <td class="text-right font-bold ${r.type==='Income'?'text-success':'text-error'}" style="font-family:var(--font-ui)">${Utils.takaEn(r.amount)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  }

  function renderRecentAdmissions(students) {
    const rows = Utils.sortBy(students, 'admission_date', 'desc').slice(0, 5);
    if (!rows.length) return `<p class="text-muted bn" style="padding:16px">কোনো ছাত্র নেই</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>আইডি</th><th>নাম</th><th>কোর্স</th><th>ব্যাচ</th><th class="text-right">বকেয়া</th>
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
    if (!active.length) return `<p class="text-muted bn" style="padding:12px 0">কোনো নোটিস নেই</p>`;
    const typeMap = { warning:'badge-warning', info:'badge-info', urgent:'badge-error', success:'badge-success' };
    const labelMap = { warning:'⚠️ সতর্কতা', info:'ℹ️ তথ্য', urgent:'🚨 জরুরি', success:'✅ সফলতা' };
    return active.slice(0,5).map(n => `
      <div class="notice-item notice-${n.type||'info'}">
        <span class="badge ${typeMap[n.type]||'badge-info'}">${labelMap[n.type]||'তথ্য'}</span>
        <p class="bn" style="margin-top:6px;font-size:.9rem">${n.text||''}</p>
        ${n.expires_at ? `<small class="text-muted">মেয়াদ: ${Utils.formatDate(n.expires_at)}</small>` : ''}
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
          <div class="bar bar-income" style="height:${ih}px" title="আয়: ${Utils.takaEn(val.income)}"></div>
          <div class="bar bar-expense" style="height:${eh}px" title="ব্যয়: ${Utils.takaEn(val.expense)}"></div>
        </div>
        <div class="chart-label">${label}</div>
      </div>`;
    }).join('');
    return `<div class="chart-legend"><span><span class="legend-dot" style="background:var(--success)"></span>আয়</span>
      <span><span class="legend-dot" style="background:var(--error)"></span>ব্যয়</span></div>
      <div class="bar-chart">${bars}</div>`;
  }

  function renderReminders(students) {
    const dues = students.filter(s => (Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid)) > 0)
      .sort((a,b) => (Utils.safeNum(b.total_fee)-Utils.safeNum(b.paid)) - (Utils.safeNum(a.total_fee)-Utils.safeNum(a.paid)))
      .slice(0,5);
    if (!dues.length) return `<p class="text-muted bn" style="padding:12px 0">সকল বকেয়া পরিষ্কার ✅</p>`;
    return dues.map(s => {
      const due = Utils.safeNum(s.total_fee) - Utils.safeNum(s.paid);
      return `<div class="reminder-item">
        <div><div class="font-bold bn">${s.name||'—'}</div><small class="text-muted">${s.student_id||''} • ${s.batch||''}</small></div>
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
    if (!rows.length) return `<p class="text-muted bn" style="padding:16px">কোনো ব্যাচ নেই</p>`;
    return `<div class="table-wrapper"><table><thead><tr>
      <th>ব্যাচ</th><th class="text-right">ছাত্র</th>
      <th class="text-right">মোট ফি</th><th class="text-right">পরিশোধিত</th><th class="text-right">বকেয়া</th>
    </tr></thead><tbody>
    ${rows.map(([b,v]) => `<tr>
      <td class="font-bold">${b}</td><td class="text-right">${v.count}</td>
      <td class="text-right" style="font-family:var(--font-ui)">${Utils.takaEn(v.total)}</td>
      <td class="text-right text-success" style="font-family:var(--font-ui)">${Utils.takaEn(v.paid)}</td>
      <td class="text-right ${v.due>0?'text-error':'text-success'}" style="font-family:var(--font-ui)">${Utils.takaEn(v.due)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
  }

  // ── MAIN RENDER ─────────────────────────────────────────
  function render() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const { totalStudents, totalIncome, totalExpense, netProfit,
            totalBalance, totalDue, loanOut, loanIn,
            students, finance, balances, notices } = getStats();

    const monthly = getMonthlyRevenue(finance);

    container.innerHTML = `
      <!-- Quick Add -->
      <div class="page-header">
        <h2 class="bn">📊 ড্যাশবোর্ড</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="App.quickAction('student')">➕ Student</button>
          <button class="btn btn-accent btn-sm" onclick="App.quickAction('transaction')">💸 Transaction</button>
          <button class="btn btn-success btn-sm" onclick="App.quickAction('exam')">📝 Exam</button>
          <button class="btn btn-outline btn-sm" onclick="App.quickAction('visitor')">🚶 Visitor</button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card" onclick="App.navigateTo('students')" style="cursor:pointer">
          <div class="stat-icon">👩‍🎓</div>
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label bn">মোট ছাত্র</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-icon">💰</div>
          <div class="stat-value" style="color:var(--success)">${Utils.takaEn(totalIncome)}</div>
          <div class="stat-label bn">মোট আয়</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-icon">📤</div>
          <div class="stat-value" style="color:var(--error)">${Utils.takaEn(totalExpense)}</div>
          <div class="stat-label bn">মোট ব্যয়</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">${netProfit >= 0 ? '📈' : '📉'}</div>
          <div class="stat-value" style="color:${netProfit>=0?'var(--success)':'var(--error)'}">${Utils.takaEn(netProfit)}</div>
          <div class="stat-label bn">নেট লাভ/ক্ষতি</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('accounts')" style="cursor:pointer">
          <div class="stat-icon">🏦</div>
          <div class="stat-value">${Utils.takaEn(totalBalance)}</div>
          <div class="stat-label bn">মোট ব্যালেন্স</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value" style="color:var(--warning)">${Utils.takaEn(totalDue)}</div>
          <div class="stat-label bn">মোট বকেয়া</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('loans')" style="cursor:pointer">
          <div class="stat-icon">💳</div>
          <div class="stat-value" style="color:var(--error)">${Utils.takaEn(loanOut)}</div>
          <div class="stat-label bn">ঋণ দেওয়া</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('loans')" style="cursor:pointer">
          <div class="stat-icon">📥</div>
          <div class="stat-value" style="color:var(--success)">${Utils.takaEn(loanIn)}</div>
          <div class="stat-label bn">ঋণ নেওয়া</div>
        </div>
      </div>

      <!-- Account Balances -->
      <div class="card mb-24">
        <div class="card-title bn">🏦 Account Balance</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="padding:10px 18px;border-radius:var(--radius);background:var(--info-bg);color:var(--info);display:inline-flex;gap:6px;align-items:center">
            💵 Cash: <strong>${Utils.takaEn(balances.Cash||0)}</strong>
          </div>
          <div style="padding:10px 18px;border-radius:var(--radius);background:var(--success-bg);color:var(--success);display:inline-flex;gap:6px;align-items:center">
            🏦 Bank: <strong>${Utils.takaEn(balances.Bank||0)}</strong>
          </div>
          <div style="padding:10px 18px;border-radius:var(--radius);background:var(--warning-bg);color:var(--warning);display:inline-flex;gap:6px;align-items:center">
            📱 Mobile: <strong>${Utils.takaEn(balances['Mobile Banking']||0)}</strong>
          </div>
        </div>
      </div>

      <!-- Charts & Notices -->
      <div class="dash-grid mb-24">
        <div class="card">
          <div class="card-title bn">📈 মাসিক Revenue (শেষ ৬ মাস)</div>
          ${renderBarChart(monthly)}
        </div>
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between">
            <span class="bn">📢 নোটিস বোর্ড</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('notice-board')">সব দেখুন</button>
          </div>
          ${renderNotices(notices)}
        </div>
      </div>

      <!-- Recent Admissions -->
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span class="bn">🆕 সাম্প্রতিক ভর্তি</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">সব দেখুন</button>
        </div>
        ${renderRecentAdmissions(students)}
      </div>

      <!-- Last 5 Transactions -->
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span class="bn">💸 শেষ ৫টি লেনদেন</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('finance')">সব দেখুন</button>
        </div>
        ${renderLastFive(finance)}
      </div>

      <!-- Batch Summary + Reminders -->
      <div class="dash-grid mb-24">
        <div class="card">
          <div class="card-title bn">📦 ব্যাচ সারসংক্ষেপ</div>
          ${renderBatchSummary(students)}
        </div>
        <div class="card">
          <div class="card-title bn">🔔 বকেয়া রিমাইন্ডার</div>
          ${renderReminders(students)}
        </div>
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
  `;
  document.head.appendChild(s);
})();

window.DashboardModule = DashboardModule;
