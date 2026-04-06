// ============================================================
// Wings Fly Aviation Academy — Dashboard Module
// ============================================================

const DashboardModule = (() => {

  function getStats() {
    const students  = SyncEngine.getLocal('students');
    const finance   = SyncEngine.getLocal('finance_ledger');
    const accounts  = SyncEngine.getLocal('accounts')[0] || { cash: 0, bank: 0, mobile: 0 };
    const loans     = SyncEngine.getLocal('loans');
    const notices   = SyncEngine.getLocal('notices');

    const totalStudents = students.length;
    const totalIncome   = finance.filter(f => f.type === 'income').reduce((s, f) => s + (+f.amount || 0), 0);
    const totalExpense  = finance.filter(f => f.type === 'expense').reduce((s, f) => s + (+f.amount || 0), 0);
    const netProfit     = totalIncome - totalExpense;
    const totalBalance  = (+accounts.cash || 0) + (+accounts.bank || 0) + (+accounts.mobile || 0);
    const totalDue      = students.reduce((s, st) => s + ((+st.total_fee || 0) - (+st.paid_fee || 0)), 0);
    const loanOut       = loans.filter(l => l.direction === 'given').reduce((s, l) => s + (+l.amount || 0), 0);
    const loanIn        = loans.filter(l => l.direction === 'received').reduce((s, l) => s + (+l.amount || 0), 0);

    return { totalStudents, totalIncome, totalExpense, netProfit, totalBalance, totalDue, loanOut, loanIn,
             students, finance, accounts, notices };
  }

  // ── Recent monthly revenue (last 6 months) ────────────────
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
      if (f.type === 'income')  months[key].income  += +f.amount || 0;
      if (f.type === 'expense') months[key].expense += +f.amount || 0;
    });
    return months;
  }

  // ── Last 5 finance transactions ───────────────────────────
  function renderLastFive(finance) {
    const rows = [...finance].sort((a,b) => new Date(b.date||0) - new Date(a.date||0)).slice(0,5);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">কোনো লেনদেন নেই</p>`;
    return `<table><thead><tr>
      <th>তারিখ</th><th>বিবরণ</th><th>ধরন</th><th>পদ্ধতি</th><th class="text-right">পরিমাণ</th>
    </tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td>${Utils.formatDateEN(r.date)}</td>
      <td>${Utils.truncate(r.description||'—',28)}</td>
      <td><span class="badge ${r.type==='income'?'badge-success':'badge-error'}">${r.type==='income'?'আয়':'ব্যয়'}</span></td>
      <td><span class="badge badge-muted">${r.method||'—'}</span></td>
      <td class="text-right font-bold ${r.type==='income'?'text-success':'text-error'}">${Utils.formatMoney(r.amount)}</td>
    </tr>`).join('')}
    </tbody></table>`;
  }

  // ── Recent admissions ─────────────────────────────────────
  function renderRecentAdmissions(students) {
    const rows = [...students].sort((a,b) => new Date(b.join_date||0) - new Date(a.join_date||0)).slice(0,5);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">কোনো ছাত্র নেই</p>`;
    return `<table><thead><tr>
      <th>আইডি</th><th>নাম</th><th>কোর্স</th><th>ব্যাচ</th><th class="text-right">বকেয়া</th>
    </tr></thead><tbody>
    ${rows.map(r => {
      const due = (+r.total_fee||0) - (+r.paid_fee||0);
      return `<tr>
        <td><span class="badge badge-info">${r.student_id||'—'}</span></td>
        <td class="font-bold">${r.name||'—'}</td>
        <td>${r.course||'—'}</td>
        <td>${r.batch||'—'}</td>
        <td class="text-right ${due>0?'text-error':'text-success'}">${Utils.formatMoney(due)}</td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  }

  // ── Active notices ────────────────────────────────────────
  function renderNotices(notices) {
    const now = Date.now();
    const active = notices.filter(n => !n.expires_at || new Date(n.expires_at).getTime() > now);
    if (!active.length) return `<p class="text-muted" style="padding:12px 0">কোনো নোটিস নেই</p>`;
    const typeMap = { warning:'badge-warning', info:'badge-info', urgent:'badge-error', success:'badge-success' };
    return active.slice(0,5).map(n => `
      <div class="notice-item notice-${n.type||'info'}">
        <span class="badge ${typeMap[n.type]||'badge-info'}">${{warning:'⚠️ সতর্কতা',info:'ℹ️ তথ্য',urgent:'🚨 জরুরি',success:'✅ সফলতা'}[n.type]||'তথ্য'}</span>
        <p class="font-bn" style="margin-top:6px;font-size:.9rem">${n.text||''}</p>
        ${n.expires_at ? `<small class="text-muted">মেয়াদ: ${Utils.formatDateEN(n.expires_at)}</small>` : ''}
      </div>`).join('');
  }

  // ── Simple bar chart (pure SVG/CSS, no lib needed) ────────
  function renderBarChart(months) {
    const entries = Object.entries(months);
    const maxVal  = Math.max(...entries.map(([,v]) => Math.max(v.income, v.expense)), 1);
    const w = 100 / entries.length;

    const bars = entries.map(([key, val], i) => {
      const ih = (val.income  / maxVal) * 120;
      const eh = (val.expense / maxVal) * 120;
      const label = key.slice(5); // MM
      return `
        <div class="chart-col" style="width:${w}%">
          <div class="chart-bars">
            <div class="bar bar-income"  style="height:${ih}px" title="আয়: ${Utils.formatMoney(val.income)}"></div>
            <div class="bar bar-expense" style="height:${eh}px" title="ব্যয়: ${Utils.formatMoney(val.expense)}"></div>
          </div>
          <div class="chart-label">${label}</div>
        </div>`;
    }).join('');

    return `
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:var(--success)"></span>আয়</span>
        <span><span class="legend-dot" style="background:var(--error)"></span>ব্যয়</span>
      </div>
      <div class="bar-chart">${bars}</div>`;
  }

  // ── Student due reminder ──────────────────────────────────
  function renderReminders(students) {
    const dues = students.filter(s => ((+s.total_fee||0) - (+s.paid_fee||0)) > 0)
      .sort((a,b) => ((+b.total_fee||0)-(+b.paid_fee||0)) - ((+a.total_fee||0)-(+a.paid_fee||0)))
      .slice(0,5);
    if (!dues.length) return `<p class="text-muted" style="padding:12px 0">সকল বকেয়া পরিষ্কার ✅</p>`;
    return dues.map(s => {
      const due = (+s.total_fee||0) - (+s.paid_fee||0);
      return `<div class="reminder-item">
        <div>
          <div class="font-bold font-bn">${s.name||'—'}</div>
          <small class="text-muted">${s.student_id||''} • ${s.batch||''}</small>
        </div>
        <span class="badge badge-error">${Utils.formatMoney(due)}</span>
      </div>`;
    }).join('');
  }

  // ── Batch summary ─────────────────────────────────────────
  function renderBatchSummary(students) {
    const batches = {};
    students.forEach(s => {
      const b = s.batch || 'Unknown';
      if (!batches[b]) batches[b] = { total: 0, paid: 0, due: 0, count: 0 };
      batches[b].count++;
      batches[b].total += +s.total_fee || 0;
      batches[b].paid  += +s.paid_fee  || 0;
      batches[b].due   += (+s.total_fee||0) - (+s.paid_fee||0);
    });
    const rows = Object.entries(batches);
    if (!rows.length) return `<p class="text-muted" style="padding:16px">কোনো ব্যাচ নেই</p>`;
    return `<table><thead><tr>
      <th>ব্যাচ</th><th class="text-right">ছাত্র</th>
      <th class="text-right">মোট ফি</th><th class="text-right">পরিশোধিত</th><th class="text-right">বকেয়া</th>
    </tr></thead><tbody>
    ${rows.map(([b,v]) => `<tr>
      <td class="font-bold">${b}</td>
      <td class="text-right">${v.count}</td>
      <td class="text-right">${Utils.formatMoney(v.total)}</td>
      <td class="text-right text-success">${Utils.formatMoney(v.paid)}</td>
      <td class="text-right ${v.due>0?'text-error':'text-success'}">${Utils.formatMoney(v.due)}</td>
    </tr>`).join('')}
    </tbody></table>`;
  }

  // ── Quick Add buttons ─────────────────────────────────────
  function renderQuickAdd() {
    return `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="App.navigateTo('students')">➕ Student</button>
        <button class="btn btn-accent btn-sm" onclick="App.navigateTo('finance')">💸 Transaction</button>
        <button class="btn btn-success btn-sm" onclick="App.navigateTo('exam')">📝 Exam</button>
        <button class="btn btn-outline btn-sm" onclick="App.navigateTo('visitors')">🚶 Visitor</button>
      </div>`;
  }

  // ── MAIN RENDER ───────────────────────────────────────────
  function render() {
    const sec = document.getElementById('section-dashboard');
    if (!sec) return;

    const { totalStudents, totalIncome, totalExpense, netProfit,
            totalBalance, totalDue, loanOut, loanIn,
            students, finance, accounts, notices } = getStats();

    const monthly = getMonthlyRevenue(finance);

    sec.innerHTML = `
      <!-- Quick Add -->
      <div class="page-header">
        <h2 class="font-bn">📊 ড্যাশবোর্ড</h2>
        ${renderQuickAdd()}
      </div>

      <!-- Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card" onclick="App.navigateTo('students')" style="cursor:pointer">
          <div class="stat-icon">👩‍🎓</div>
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">মোট ছাত্র</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-icon">💰</div>
          <div class="stat-value" style="color:var(--success)">${Utils.formatMoney(totalIncome)}</div>
          <div class="stat-label">মোট আয়</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('finance')" style="cursor:pointer">
          <div class="stat-icon">📤</div>
          <div class="stat-value" style="color:var(--error)">${Utils.formatMoney(totalExpense)}</div>
          <div class="stat-label">মোট ব্যয়</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">${netProfit >= 0 ? '📈' : '📉'}</div>
          <div class="stat-value" style="color:${netProfit>=0?'var(--success)':'var(--error)'}">${Utils.formatMoney(netProfit)}</div>
          <div class="stat-label">নেট লাভ/ক্ষতি</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('accounts')" style="cursor:pointer">
          <div class="stat-icon">🏦</div>
          <div class="stat-value">${Utils.formatMoney(totalBalance)}</div>
          <div class="stat-label">মোট ব্যালেন্স</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value" style="color:var(--warning)">${Utils.formatMoney(totalDue)}</div>
          <div class="stat-label">মোট বকেয়া</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('loans')" style="cursor:pointer">
          <div class="stat-icon">💳</div>
          <div class="stat-value" style="color:var(--error)">${Utils.formatMoney(loanOut)}</div>
          <div class="stat-label">ঋণ দেওয়া</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('loans')" style="cursor:pointer">
          <div class="stat-icon">📥</div>
          <div class="stat-value" style="color:var(--success)">${Utils.formatMoney(loanIn)}</div>
          <div class="stat-label">ঋণ নেওয়া</div>
        </div>
      </div>

      <!-- Account Balances -->
      <div class="dash-grid2 mb-24">
        <div class="card">
          <div class="card-title">🏦 Account Balance</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="account-pill" style="background:var(--info-bg);color:var(--info)">
              💵 Cash: <strong>${Utils.formatMoney(accounts.cash||0)}</strong>
            </div>
            <div class="account-pill" style="background:var(--success-bg);color:var(--success)">
              🏦 Bank: <strong>${Utils.formatMoney(accounts.bank||0)}</strong>
            </div>
            <div class="account-pill" style="background:var(--warning-bg);color:var(--warning)">
              📱 Mobile: <strong>${Utils.formatMoney(accounts.mobile||0)}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts & Tables Row -->
      <div class="dash-grid mb-24">

        <!-- Revenue Chart -->
        <div class="card">
          <div class="card-title">📈 মাসিক Revenue (শেষ ৬ মাস)</div>
          ${renderBarChart(monthly)}
        </div>

        <!-- Notice Board -->
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between">
            <span>📢 নোটিস বোর্ড</span>
            <button class="btn btn-outline btn-sm" onclick="App.navigateTo('notice-board')">সব দেখুন</button>
          </div>
          ${renderNotices(notices)}
        </div>
      </div>

      <!-- Recent Admissions -->
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>🆕 সাম্প্রতিক ভর্তি</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('students')">সব দেখুন</button>
        </div>
        <div class="table-wrapper">${renderRecentAdmissions(students)}</div>
      </div>

      <!-- Last 5 Transactions -->
      <div class="card mb-24">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>💸 শেষ ৫টি লেনদেন</span>
          <button class="btn btn-outline btn-sm" onclick="App.navigateTo('finance')">সব দেখুন</button>
        </div>
        <div class="table-wrapper">${renderLastFive(finance)}</div>
      </div>

      <!-- Batch Summary + Reminders -->
      <div class="dash-grid mb-24">
        <div class="card">
          <div class="card-title">📦 ব্যাচ সারসংক্ষেপ</div>
          <div class="table-wrapper">${renderBatchSummary(students)}</div>
        </div>
        <div class="card">
          <div class="card-title">🔔 বকেয়া রিমাইন্ডার</div>
          <div id="reminder-list">${renderReminders(students)}</div>
        </div>
      </div>
    `;
  }

  // ── Listen for navigation & sync events ──────────────────
  window.addEventListener('wfa:navigate', (e) => {
    if (e.detail.section === 'dashboard') render();
  });
  window.addEventListener('wfa:synced', () => {
    const sec = document.getElementById('section-dashboard');
    if (sec && sec.style.display !== 'none') render();
  });

  return { render };
})();

// Extra dashboard styles (injected once)
(function injectDashStyles() {
  if (document.getElementById('dash-styles')) return;
  const s = document.createElement('style');
  s.id = 'dash-styles';
  s.textContent = `
    .dash-grid  { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .dash-grid2 { display:grid; grid-template-columns:1fr; gap:20px; }
    @media(max-width:768px){ .dash-grid { grid-template-columns:1fr; } }

    .account-pill {
      padding:10px 18px; border-radius:var(--radius); font-size:.9rem;
      display:inline-flex; gap:6px; align-items:center;
    }

    /* Bar Chart */
    .bar-chart { display:flex; align-items:flex-end; height:160px; gap:4px; padding-top:8px; }
    .chart-col { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .chart-bars { display:flex; align-items:flex-end; gap:2px; }
    .bar { width:18px; border-radius:3px 3px 0 0; transition:height .4s; min-height:2px; }
    .bar-income  { background:var(--success); }
    .bar-expense { background:var(--error); opacity:.7; }
    .chart-label { font-size:.68rem; color:var(--text-muted); }
    .chart-legend { display:flex; gap:16px; margin-bottom:8px; font-size:.8rem; }
    .legend-dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; }

    /* Notices */
    .notice-item { padding:10px 12px; border-radius:var(--radius-sm); border-left:3px solid; margin-bottom:8px; }
    .notice-info    { background:var(--info-bg);    border-color:var(--info); }
    .notice-warning { background:var(--warning-bg); border-color:var(--warning); }
    .notice-urgent  { background:var(--error-bg);   border-color:var(--error); }
    .notice-success { background:var(--success-bg); border-color:var(--success); }

    /* Reminders */
    .reminder-item {
      display:flex; justify-content:space-between; align-items:center;
      padding:10px 0; border-bottom:1px solid var(--border);
    }
    .reminder-item:last-child { border-bottom:none; }
  `;
  document.head.appendChild(s);
})();

window.DashboardModule = DashboardModule;
