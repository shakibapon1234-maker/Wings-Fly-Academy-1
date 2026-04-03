/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY — SALARY HUB v4.0
 * ============================================================
 * ✅ Card-based layout — প্রতিটি employee একটি card
 * ✅ Inline payment history — expandable, latest first
 * ✅ Edit & Delete on every salary record
 * ✅ Pay (Due / Advance / Bonus) — clean modal
 * ✅ Finance Guard compatible
 * ✅ Activity log on all operations
 * ============================================================
 */

(function () {

  // Helper function to extract Salary Billing Month from description
  // e.g. "Due for 2026-03 [Salary] (2026-03)" -> returns "2026-03"
  function _getSalMonth(f) {
    const m = (f.description || '').match(/\((\d{4}-\d{2})\)\s*$/);
    if (m) return m[1];
    return (f.date || '').substring(0, 7);
  }

  // ─────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────
  function initSalaryHub() {
    const monthInput = document.getElementById('salaryMonthFilter');
    if (monthInput && !monthInput.value) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    renderSalaryCards();
  }

  // ─────────────────────────────────────────────────────────
  // MAIN RENDER — employee cards
  // ─────────────────────────────────────────────────────────
  function renderSalaryCards() {
    const gd = window.globalData || {};
    const month = document.getElementById('salaryMonthFilter')?.value || '';
    const search = (document.getElementById('salarySearch')?.value || '').toLowerCase();
    const wrap = document.getElementById('salaryCardsWrap');
    if (!wrap) return;

    const employees = (gd.employees || [])
      .filter(e => !search || (e.name || '').toLowerCase().includes(search));

    if (employees.length === 0) {
      wrap.innerHTML = `<div class="text-center py-5" style="color:#6e8caa;">
        <div style="font-size:3rem;">👤</div>
        <p class="mt-2">কোনো Active Staff নেই।</p>
      </div>`;
      _updateSummary(0, 0, 0);
      return;
    }

    // ✅ FIX: Recycle Bin-এ থাকা finance ID গুলো বের করো
    var _rbFinIds = new Set();
    try {
      var _rbFin = (gd.deletedItems && !Array.isArray(gd.deletedItems) && gd.deletedItems.finance) || [];
      _rbFin.forEach(function(e) {
        var src = e.item || {};
        var id = src.id || src.timestamp;
        if (id) _rbFinIds.add(String(id));
      });
    } catch(_e) {}

    // Finance records for this month
    const finMonth = (gd.finance || []).filter(f =>
      !f._deleted &&
      !_rbFinIds.has(String(f.id || f.timestamp || '')) &&
      _getSalMonth(f) === month &&
      (f.type === 'Expense' || f.type === 'Advance' || f.type === 'Advance Return') &&
      (f.category === 'Salaries' || f.category === 'Advance' || f.category === 'Advance Return' || f.category === 'Bonus')
    );

    let totalBudget = 0, totalPaid = 0, totalDue = 0;
    let html = '';

    employees.forEach(emp => {
      const base = parseFloat(emp.salary) || 0;
      const empRec = finMonth.filter(f => f.person === emp.name || f.employeeId === (emp.id || emp.empId));

      const salPaid = empRec.filter(f => f.type === 'Expense' && f.category === 'Salaries'
        && !(f.description || '').includes('[Bonus]'))
        .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const bonusPaid = empRec.filter(f => (f.description || '').includes('[Bonus]'))
        .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const advPaid = empRec.filter(f => f.type === 'Advance')
        .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const paid = salPaid;
      const due = Math.max(0, base - paid);

      totalBudget += base;
      totalPaid += paid;
      totalDue += due;

      // Selected month history for this employee (sorted latest first)
      const monthHist = empRec.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const statusBadge = due === 0 && paid > 0
        ? `<span style="background:rgba(0,200,100,0.15);color:#00e676;border:1px solid rgba(0,200,100,0.3);padding:3px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;">✅ Paid</span>`
        : paid > 0
          ? `<span style="background:rgba(0,200,255,0.15);color:#00d9ff;border:1px solid rgba(0,200,255,0.3);padding:3px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;">⚡ Partial</span>`
          : `<span style="background:rgba(255,170,0,0.15);color:#ffaa00;border:1px solid rgba(255,170,0,0.3);padding:3px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;">⏳ Pending</span>`;

      const pct = base > 0 ? Math.min(100, Math.round((paid / base) * 100)) : 0;
      const progressColor = pct === 100 ? '#00e676' : pct > 0 ? '#00d9ff' : '#333';

      const empKey = (emp.id || emp.name).replace(/\W/g, '_');

      // History rows for selected month
      const histRows = monthHist.map(f => {
        const isAdv = f.type === 'Advance';
        const isReturn = f.type === 'Advance Return';
        const isBonus = (f.description || '').includes('[Bonus]');
        const label = isAdv ? 'Advance' : isReturn ? 'Return' : isBonus ? 'Bonus' : 'Salary';
        const colors = {
          Advance: 'background:rgba(0,150,255,0.15);color:#7ab8ff;border:1px solid rgba(0,150,255,0.35);',
          Return: 'background:rgba(0,230,118,0.12);color:#69f0ae;border:1px solid rgba(0,230,118,0.3);',
          Bonus: 'background:rgba(255,200,0,0.15);color:#ffd200;border:1px solid rgba(255,200,0,0.35);',
          Salary: 'background:rgba(0,200,100,0.12);color:#00e676;border:1px solid rgba(0,200,100,0.3);'
        };
        const dateStr = f.date
          ? new Date(f.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';

        return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:8px 12px;font-size:0.82rem;color:#94a3c4;white-space:nowrap;">${dateStr}</td>
          <td style="padding:8px 12px;font-size:0.82rem;font-weight:600;color:#e0f0ff;">${f.person || emp.name}</td>
          <td style="padding:8px 12px;">
            <span style="padding:2px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;${colors[label]}">${label}</span>
          </td>
          <td style="padding:8px 12px;font-weight:700;color:#e0f0ff;">৳${(parseFloat(f.amount) || 0).toLocaleString()}</td>
          <td style="padding:8px 12px;font-size:0.82rem;color:#94a3c4;">${f.method || '—'}</td>
          <td style="padding:8px 12px;font-size:0.78rem;color:rgba(255,255,255,0.45);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${(f.description || '').replace(/"/g, '&quot;')}">${f.description || '—'}</td>
          <td style="padding:8px 12px;text-align:right;white-space:nowrap;">
            <button onclick="editSalaryRecord('${f.id}')"
              style="background:rgba(0,217,255,0.12);color:#00d9ff;border:1px solid rgba(0,217,255,0.3);padding:3px 10px;border-radius:8px;font-size:0.75rem;cursor:pointer;margin-right:4px;">
              ✏️ Edit
            </button>
            <button onclick="deleteSalaryRecord('${f.id}')"
              style="background:rgba(255,59,92,0.12);color:#ff3b5c;border:1px solid rgba(255,59,92,0.3);padding:3px 10px;border-radius:8px;font-size:0.75rem;cursor:pointer;">
              🗑️ Del
            </button>
          </td>
        </tr>`;
      }).join('');

      const isResigned = emp.resigned || emp.status === 'Resigned' || emp.resignDate;
      const resignedBadge = isResigned ? `<span class="badge bg-danger ms-2" style="font-size:0.7rem;">Resigned</span>` : '';

      html += `
      <div class="salary-card" style="background:rgba(13,27,42,0.8);border:1px solid rgba(0,217,255,0.12);border-radius:16px;padding:20px;margin-bottom:16px;transition:border-color 0.2s;">

        <!-- Card Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#1a3a5c,#0d2035);display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:2px solid rgba(0,217,255,0.2);">
              👤
            </div>
            <div>
              <div style="font-size:1rem;font-weight:700;color:#e0f0ff;">${emp.name} ${resignedBadge}</div>
              <div style="font-size:0.78rem;color:#6e8caa;">${emp.role || emp.designation || 'Staff'}
                ${emp.phone ? `<span style="margin-left:8px;color:#4a6080;">📞 ${emp.phone}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            ${statusBadge}
            <button onclick="openSalaryModal('${emp.id || emp.name}')"
              style="background:linear-gradient(135deg,#0066cc,#0044aa);color:#fff;border:none;padding:7px 18px;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;">
              💰 Pay
            </button>
          </div>
        </div>

        <!-- Salary Info Row -->
        <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
          <div style="background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.12);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
            <div style="font-size:0.68rem;color:#6e8caa;text-transform:uppercase;letter-spacing:0.5px;">Base Salary</div>
            <div style="font-size:1rem;font-weight:700;color:#e0f0ff;margin-top:2px;">৳${base.toLocaleString()}</div>
          </div>
          <div style="background:rgba(0,200,100,0.06);border:1px solid rgba(0,200,100,0.15);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
            <div style="font-size:0.68rem;color:#6e8caa;text-transform:uppercase;letter-spacing:0.5px;">Paid (${month || 'this month'})</div>
            <div style="font-size:1rem;font-weight:700;color:#00e676;margin-top:2px;">৳${paid.toLocaleString()}</div>
          </div>
          <div style="background:rgba(255,170,0,0.06);border:1px solid rgba(255,170,0,0.15);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
            <div style="font-size:0.68rem;color:#6e8caa;text-transform:uppercase;letter-spacing:0.5px;">Due</div>
            <div style="font-size:1rem;font-weight:700;color:${due > 0 ? '#ffaa00' : '#00e676'};margin-top:2px;">৳${due.toLocaleString()}</div>
          </div>
          ${bonusPaid > 0 ? `<div style="background:rgba(255,200,0,0.06);border:1px solid rgba(255,200,0,0.15);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
            <div style="font-size:0.68rem;color:#6e8caa;text-transform:uppercase;letter-spacing:0.5px;">Bonus</div>
            <div style="font-size:1rem;font-weight:700;color:#ffd200;margin-top:2px;">৳${bonusPaid.toLocaleString()}</div>
          </div>` : ''}
          ${advPaid > 0 ? `<div style="background:rgba(0,150,255,0.06);border:1px solid rgba(0,150,255,0.15);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
            <div style="font-size:0.68rem;color:#6e8caa;text-transform:uppercase;letter-spacing:0.5px;">Advance (this month)</div>
            <div style="font-size:1rem;font-weight:700;color:#7ab8ff;margin-top:2px;">৳${advPaid.toLocaleString()}</div>
          </div>` : ''}
        </div>

        <!-- Progress Bar -->
        <div style="margin-top:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:0.72rem;color:#6e8caa;">Payment Progress</span>
            <span style="font-size:0.72rem;color:${progressColor};font-weight:600;">${pct}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${progressColor};border-radius:6px;transition:width 0.5s;"></div>
          </div>
        </div>

        <!-- History Toggle -->
        ${monthHist.length > 0 ? `
        <div style="margin-top:14px;">
          <button onclick="_toggleSalHist('${empKey}')"
            style="background:transparent;border:1px solid rgba(0,217,255,0.2);color:#6e8caa;padding:5px 14px;border-radius:8px;font-size:0.78rem;cursor:pointer;width:100%;text-align:left;">
            📋 Month's Payment History (${monthHist.length} records) <span id="arrow_${empKey}" style="float:right;">▼</span>
          </button>
          <div id="hist_${empKey}" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;border:1px solid rgba(0,217,255,0.12);">
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <thead>
                  <tr style="background:rgba(0,0,0,0.35);">
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Date</th>
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Name</th>
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Type</th>
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Amount</th>
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Method</th>
                    <th style="padding:8px 12px;color:#4a6080;font-size:0.7rem;text-transform:uppercase;font-weight:600;text-align:left;">Note</th>
                    <th style="padding:8px 12px;text-align:right;"></th>
                  </tr>
                </thead>
                <tbody>${histRows}</tbody>
              </table>
            </div>
            
          </div>
        </div>` : `<div style="margin-top:12px;font-size:0.78rem;color:rgba(255,255,255,0.2);text-align:center;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">কোনো payment history নেই (For this month)</div>`}
      
        <!-- Action: All-Time History Button -->
        <div style="margin-top:10px; text-align:center;">
             <button class="btn btn-sm text-info" style="font-size:0.75rem;text-decoration:underline;" onclick="showAllTimeSalaryHistory('${emp.id || emp.name}')">📜 View All Previous Months History (Full Ledger)</button>
        </div>

      </div>`;
    });

    wrap.innerHTML = html;
    _updateSummary(totalBudget, totalPaid, totalDue);
  }

  // ─────────────────────────────────────────────────────────
  // SUMMARY ROW UPDATE
  // ─────────────────────────────────────────────────────────
  function _updateSummary(budget, paid, due) {
    const fmt = n => '৳' + (parseFloat(n) || 0).toLocaleString();
    const _s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _s('salaryTotalBudget', fmt(budget));
    _s('salaryPaidTotal', fmt(paid));
    _s('salaryDueTotal', fmt(due));
  }

  // ─────────────────────────────────────────────────────────
  // TOGGLE HISTORY
  // ─────────────────────────────────────────────────────────
  window._toggleSalHist = function (key) {
    const el = document.getElementById('hist_' + key);
    const arrow = document.getElementById('arrow_' + key);
    if (!el) return;
    const open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (arrow) arrow.textContent = open ? '▼' : '▲';
  };

  // ─────────────────────────────────────────────────────────
  // OPEN PAY MODAL
  // ─────────────────────────────────────────────────────────
  function openSalaryModal(empId) {
    const modalEl = document.getElementById('salaryModal');
    if (!modalEl) { alert('Salary Modal not found!'); return; }

    const gd = window.globalData || {};
    const all = gd.employees || [];

    const selectEl = document.getElementById('salModalEmpSelect');
    if (selectEl) {
      selectEl.innerHTML = '<option value="">-- Employee Select --</option>';
      all.forEach(e => {
        const isResigned = e.resigned || e.status === 'Resigned' || e.resignDate;
        const opt = document.createElement('option');
        opt.value = e.id || e.empId || e.name;
        opt.textContent = e.name + (isResigned ? ' (Resigned)' : '');
        selectEl.appendChild(opt);
      });
    }

    _resetSalaryForm();
    // ✅ FIX: Date ডিফল্ট হিসেবে আজকের না, বরং সিলেক্টেড মাসের শেষ দিন সেট হবে।
    // যেমন: মাস ফিল্টার "2026-03" হলে → ডেট "2026-03-31" হবে।
    // ইউজার পরে চাইলে ম্যানুয়ালি বদলাতে পারবে।
    var _salMonth = document.getElementById('salaryMonthFilter')?.value || '';
    if (_salMonth && /^\d{4}-\d{2}$/.test(_salMonth)) {
      var _parts = _salMonth.split('-');
      var _lastDay = new Date(parseInt(_parts[0]), parseInt(_parts[1]), 0).getDate();
      document.getElementById('salDate').value = _salMonth + '-' + String(_lastDay).padStart(2, '0');
    } else {
      document.getElementById('salDate').value = new Date().toISOString().split('T')[0];
    }

    // Reset Due UI
    const dueEl = document.getElementById('salDueAmountBadge');
    if (dueEl) dueEl.textContent = `৳ —`;

    const advEl = document.getElementById('salExistingAdvance');
    if (advEl) advEl.classList.add('d-none');

    const roleEl = document.getElementById('salModalEmpRole');
    if (roleEl) roleEl.style.display = 'none';

    document.getElementById('salEmpId').value = '';
    document.getElementById('salEmpName').value = '';

    if (typeof window.setSalType === 'function') window.setSalType('Due');

    if (empId && selectEl) {
      selectEl.value = empId;
      window.handleSalModalEmpChange();
    }

    if (typeof window.attachMethodBalanceListeners === 'function') {
      window.attachMethodBalanceListeners();
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  window.handleSalModalEmpChange = function () {
    const selectEl = document.getElementById('salModalEmpSelect');
    if (!selectEl) return;
    const empId = selectEl.value;

    const gd = window.globalData || {};
    const all = gd.employees || [];
    const emp = all.find(e => e.id === empId || e.empId === empId || e.employeeId === empId || e.name === empId);

    const roleEl = document.getElementById('salModalEmpRole');
    const dueEl = document.getElementById('salDueAmountBadge');
    const advEl = document.getElementById('salExistingAdvance');
    const amtEl = document.getElementById('salAmount');
    const descEl = document.getElementById('salDescription');

    if (!emp) {
      document.getElementById('salEmpId').value = '';
      document.getElementById('salEmpName').value = '';
      if (roleEl) roleEl.style.display = 'none';
      if (dueEl) dueEl.textContent = `৳ —`;
      if (advEl) advEl.classList.add('d-none');
      if (amtEl) amtEl.value = '';
      return;
    }

    document.getElementById('salEmpId').value = emp.id || emp.empId || emp.name;
    document.getElementById('salEmpName').value = emp.name;

    if (roleEl) {
      roleEl.textContent = emp.role || emp.designation || 'Staff';
      roleEl.style.display = 'inline-block';
    }

    const month = document.getElementById('salaryMonthFilter')?.value || '';

    // ✅ FIX: Recycle Bin-এ থাকা finance ID বাদ দাও
    var _modalRbIds = new Set();
    try {
      var _modalRbFin = (gd.deletedItems && !Array.isArray(gd.deletedItems) && gd.deletedItems.finance) || [];
      _modalRbFin.forEach(function(e) { var id = (e.item||{}).id||(e.item||{}).timestamp; if(id) _modalRbIds.add(String(id)); });
    } catch(_e) {}

    const paidSoFar = (gd.finance || [])
      .filter(f => !f._deleted && !_modalRbIds.has(String(f.id||f.timestamp||'')) && f.type === 'Expense' && f.category === 'Salaries'
        && !(f.description || '').includes('[Bonus]')
        && _getSalMonth(f) === month
        && (f.person === emp.name || f.employeeId === (emp.id || emp.empId)))
      .reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

    const base = parseFloat(emp.salary) || 0;
    const due = Math.max(0, base - paidSoFar);

    if (dueEl) dueEl.textContent = `৳${due.toLocaleString()}`;

    const advNet = (gd.finance || [])
      .filter(f => !f._deleted && !_modalRbIds.has(String(f.id||f.timestamp||'')) && (f.type === 'Advance' || f.type === 'Advance Return')
        && (f.person === emp.name || f.employeeId === (emp.id || emp.empId)))
      .reduce((s, f) => s + (parseFloat(f.amount) || 0) * (f.type === 'Advance' ? 1 : -1), 0);

    if (advEl) {
      if (advNet > 0) {
        advEl.textContent = `⚠️ বিদ্যমান Advance বকেয়া: ৳${advNet.toLocaleString()}`;
        advEl.classList.remove('d-none');
      } else {
        advEl.classList.add('d-none');
      }
    }

    const type = document.getElementById('salTypeHidden')?.value || 'Due';
    if (type === 'Due' && amtEl) {
      amtEl.value = due > 0 ? due : '';
    }
    if (descEl) descEl.value = `${type} for ${month}`;
  };

  // ─────────────────────────────────────────────────────────
  // RESET FORM
  // ─────────────────────────────────────────────────────────
  function _resetSalaryForm() {
    const form = document.getElementById('salaryForm');
    if (form) form.reset();

    const methodSel = document.getElementById('salMethod');
    if (methodSel) {
      methodSel.innerHTML = '<option value="">-- Select Method --</option>';
      const gd = window.globalData || {};
      const core = ['Cash'];
      const bankNames = (gd.bankAccounts || []).map(b => b.name);
      const mobileNames = (gd.mobileBanking || []).map(m => m.name);
      const allMethods = [...new Set([...core, ...bankNames, ...mobileNames])];

      allMethods.forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        if (m === 'Cash') o.textContent = '💵 Cash';
        else if (bankNames.includes(m)) o.textContent = `🏦 ${m}`;
        else o.textContent = `📱 ${m}`;
        methodSel.appendChild(o);
      });
      methodSel.value = 'Cash';
    }
  }

  // ─────────────────────────────────────────────────────────
  // SUBMIT PAY
  // ─────────────────────────────────────────────────────────
  async function handleSalarySubmit(e) {
    if (e) e.preventDefault();
    const gd = window.globalData || {};
    const empId = document.getElementById('salEmpId').value;
    const empName = document.getElementById('salEmpName').value;
    const amount = parseFloat(document.getElementById('salAmount').value) || 0;
    const type = document.getElementById('salTypeHidden')?.value || 'Due';
    const method = document.getElementById('salMethod').value;
    const date = document.getElementById('salDate').value || new Date().toISOString().split('T')[0];
    const month = document.getElementById('salaryMonthFilter')?.value || '';
    const desc = document.getElementById('salDescription').value || `${type} for ${month}`;

    if (!empName || amount <= 0 || !method) { alert('সব required ফিল্ড পূরণ করুন।'); return; }
    if (!confirm(`${empName} — ${type}: ৳${amount.toLocaleString()} পেমেন্ট করবেন?`)) return;

    if (!gd.finance) gd.finance = [];

    const isAdv = type === 'Advance';
    const isBonus = type === 'Bonus';
    // ✅ V39.10 FIX: timestamp = selected date (Ledger sort এর জন্য)
    // _createdAt/_updatedAt = REAL current time (Sync conflict resolution এর জন্য)
    // আগে: _updatedAt = selected date ছিল → পুরনো date দিলে cloud win করতো → edit হারিয়ে যেত
    const _dateTs = new Date(date + 'T12:00:00').toISOString();
    const _realNow = new Date().toISOString(); // ← ACTUAL time for sync
    const txn = {
      id: 'SAL_' + Date.now(),
      date,
      timestamp: _dateTs,        // ✅ Finance Ledger date-sort এর জন্য
      _createdAt: _realNow,      // ✅ Sync conflict resolution — REAL time
      _updatedAt: _realNow,      // ✅ Sync conflict resolution — REAL time
      type: isAdv ? 'Advance' : 'Expense',
      category: isAdv ? 'Advance' : 'Salaries',
      method,
      amount,
      person: empName,
      employeeId: empId,
      description: `${desc}${isBonus ? ' [Bonus]' : isAdv ? ' [Advance]' : ' [Salary]'} (${month})`,
      source: 'salary',
      createdBy: window.currentUser || 'Admin',
      _entryAddedAt: _realNow // ✅ Real time — audit
    };

    gd.finance.push(txn);

    if (typeof window.feApplyEntryToAccount === 'function') window.feApplyEntryToAccount(txn, +1);
    if (typeof window.logActivity === 'function') {
      window.logActivity('finance', 'ADD',
        `Salary ${type}: ৳${amount.toLocaleString()} → ${empName} | ${method} | ${date}`);
    }
    if (window.markDirty) window.markDirty('finance');
    if (window.markDirty) window.markDirty('activity');
    if (window.saveToStorage) await window.saveToStorage();
    if (window.scheduleSyncPush) window.scheduleSyncPush('Salary Payment');

    bootstrap.Modal.getInstance(document.getElementById('salaryModal'))?.hide();
    renderSalaryCards();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
    if (typeof window.showSuccessToast === 'function') {
      window.showSuccessToast(`✅ ${empName} — ${type} ৳${amount.toLocaleString()} রেকর্ড হয়েছে!`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // EDIT SALARY RECORD
  // ─────────────────────────────────────────────────────────
  window.editSalaryRecord = function (txId) {
    const gd = window.globalData || {};
    const txn = (gd.finance || []).find(f => String(f.id) === String(txId));
    if (!txn) { alert('Record not found!'); return; }

    const modalEl = document.getElementById('salaryEditModal');
    if (!modalEl) { alert('Edit modal not found!'); return; }

    document.getElementById('salEditTxId').value = txn.id;
    document.getElementById('salEditAmount').value = txn.amount;
    document.getElementById('salEditDate').value = txn.date || '';
    document.getElementById('salEditDesc').value = txn.description || '';

    // Method select
    const methodSel = document.getElementById('salEditMethod');
    if (methodSel) {
      methodSel.innerHTML = '<option value="">-- Select Method --</option>';
      const core = ['Cash'];
      const bankNames = (gd.bankAccounts || []).map(b => b.name);
      const mobileNames = (gd.mobileBanking || []).map(m => m.name);
      const allMethods = [...new Set([...core, ...bankNames, ...mobileNames])];

      allMethods.forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        if (m === 'Cash') o.textContent = '💵 Cash';
        else if (bankNames.includes(m)) o.textContent = `🏦 ${m}`;
        else o.textContent = `📱 ${m}`;
        methodSel.appendChild(o);
      });
      methodSel.value = txn.method || 'Cash';
    }

    // Info header
    const infoEl = document.getElementById('salEditInfo');
    if (infoEl) {
      const isAdv = txn.type === 'Advance';
      const isBonus = (txn.description || '').includes('[Bonus]');
      const label = isAdv ? 'Advance' : isBonus ? 'Bonus' : 'Salary';
      infoEl.textContent = `${txn.person} — ${label}`;
    }

    if (typeof window.attachMethodBalanceListeners === 'function') {
      window.attachMethodBalanceListeners();
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  };

  // ─────────────────────────────────────────────────────────
  // SUBMIT EDIT
  // ─────────────────────────────────────────────────────────
  window.handleSalaryEditSubmit = async function (e) {
    if (e) e.preventDefault();
    const gd = window.globalData || {};
    const txId = document.getElementById('salEditTxId').value;
    const amount = parseFloat(document.getElementById('salEditAmount').value) || 0;
    const date = document.getElementById('salEditDate').value;
    const method = document.getElementById('salEditMethod').value;
    const desc = document.getElementById('salEditDesc').value;

    const idx = (gd.finance || []).findIndex(f => String(f.id) === String(txId));
    if (idx === -1) { alert('Record not found!'); return; }
    if (amount <= 0) { alert('Amount must be greater than 0!'); return; }

    const old = { ...gd.finance[idx] };

    // Reverse old balance, apply new
    if (typeof window.feApplyEntryToAccount === 'function') {
      window.feApplyEntryToAccount(old, -1);
    }
    // ✅ V39.10 CRITICAL FIX: edit করলে timestamp = selected date (sort এর জন্য)
    // কিন্তু _updatedAt = ACTUAL CURRENT TIME (sync conflict resolution এর জন্য)
    // আগে: _updatedAt = selected date ছিল → March 15 দিলে cloud-এর April version win করতো → edit revert!
    const _editDateTs = new Date(date + 'T12:00:00').toISOString();
    const _editRealNow = new Date().toISOString(); // ← ACTUAL edit time
    gd.finance[idx] = {
      ...gd.finance[idx],
      amount, date, method, description: desc,
      timestamp: _editDateTs,    // ✅ date পরিবর্তন → sort position পরিবর্তন
      _updatedAt: _editRealNow,  // ✅ FIXED: REAL edit time — sync always wins
    };
    if (typeof window.feApplyEntryToAccount === 'function') {
      window.feApplyEntryToAccount(gd.finance[idx], +1);
    }

    if (typeof window.logActivity === 'function') {
      window.logActivity('finance', 'EDIT',
        `Salary record edited: ${old.person} | ৳${old.amount} → ৳${amount} | ${old.date} → ${date}`);
    }
    if (window.markDirty) window.markDirty('finance');
    if (window.saveToStorage) await window.saveToStorage();
    if (window.scheduleSyncPush) window.scheduleSyncPush('Salary Edit');
    // ✅ V39.10: Immediate push — debounce delay-এ pull এসে overwrite করতো
    if (typeof window.pushToCloud === 'function') window.pushToCloud('Salary Edit IMMEDIATE');

    bootstrap.Modal.getInstance(document.getElementById('salaryEditModal'))?.hide();
    renderSalaryCards();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
    if (typeof window.showSuccessToast === 'function') window.showSuccessToast('✅ Record updated!');
  };

  // ─────────────────────────────────────────────────────────
  // DELETE SALARY RECORD
  // ─────────────────────────────────────────────────────────
  window.deleteSalaryRecord = function (txId) {
    const gd = window.globalData || {};
    const txn = (gd.finance || []).find(f => String(f.id) === String(txId));
    if (!txn) { alert('Record not found!'); return; }

    if (!confirm(`Delete করবেন?\n${txn.person} — ৳${txn.amount} (${txn.date})`)) return;

    // Recycle bin
    if (typeof window.moveToTrash === 'function') window.moveToTrash('finance', { ...txn });

    // V39 Sync Pattern: Soft delete only!
    if (typeof window.feSoftDeleteEntry === 'function') {
      window.feSoftDeleteEntry(txn.id);
    } else {
      // Reverse balance
      if (typeof window.feApplyEntryToAccount === 'function') window.feApplyEntryToAccount(txn, -1);
      txn._deleted = true;
      txn._deletedAt = new Date().toISOString();
    }

    if (typeof window.logActivity === 'function') {
      window.logActivity('finance', 'DELETE',
        `Salary record deleted: ${txn.person} — ৳${txn.amount} (${txn.date})`);
    }
    if (window.markDirty) window.markDirty('finance');
    if (window.saveToStorage) window.saveToStorage();
    if (window.scheduleSyncPush) window.scheduleSyncPush('Salary Delete');

    renderSalaryCards();
    if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
    if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Salary record deleted (Recycle Bin এ আছে)');
  };

  // ─────────────────────────────────────────────────────────
  // setSalType — Pay modal type selector
  // ─────────────────────────────────────────────────────────
  window.setSalType = function (type) {
    var typeHidden = document.getElementById('salTypeHidden');
    if (typeHidden) typeHidden.value = type;

    // Button visual styles
    var styles = {
      Due: { bg: 'linear-gradient(135deg,#00d4aa,#00a88a)', color: '#fff', shadow: '0 3px 12px rgba(0,212,170,0.4)', border: 'none' },
      Advance: { bg: 'linear-gradient(135deg,#0096ff,#0055cc)', color: '#fff', shadow: '0 3px 12px rgba(0,150,255,0.4)', border: 'none' },
      Bonus: { bg: 'linear-gradient(135deg,#ffd200,#ff9f43)', color: '#1a1000', shadow: '0 3px 12px rgba(255,200,0,0.4)', border: 'none' }
    };
    var inactive = { bg: 'rgba(255,255,255,0.07)', color: '#a0c4ff', shadow: 'none', border: '1px solid rgba(255,255,255,0.12)' };

    ['Due', 'Advance', 'Bonus'].forEach(function (t) {
      var btn = document.getElementById('btnType' + t);
      if (!btn) return;
      var s = (t === type) ? styles[t] : inactive;
      btn.style.background = s.bg;
      btn.style.color = s.color;
      btn.style.boxShadow = s.shadow;
      btn.style.border = s.border;
    });

    // Show/hide info panels
    var panels = { Due: 'salDuePanel', Advance: 'salAdvancePanel', Bonus: 'salBonusPanel' };
    Object.keys(panels).forEach(function (t) {
      var el = document.getElementById(panels[t]);
      if (!el) return;
      if (t === type) el.classList.remove('d-none');
      else el.classList.add('d-none');
    });

    // Modal UI auto-fill amount
    const amtEl = document.getElementById('salAmount');
    if (amtEl && type !== 'Due') amtEl.value = '';

    // Auto description
    const month = document.getElementById('salaryMonthFilter')?.value || '';
    const desc = document.getElementById('salDescription');
    if (desc && month) desc.value = type + ' for ' + month;
  };

  // ─────────────────────────────────────────────────────────
  // ADVANCE QUICK VIEW (Helper)
  // ─────────────────────────────────────────────────────────
  window.renderAdvanceQuick = function (containerId) {
    const container = document.getElementById(containerId) || document.createElement('div');
    const gd = window.globalData || {};
    if (!gd.employees) { container.innerHTML = '<p>No employees</p>'; return; }
    const empAdvances = {};
    (gd.employees || []).forEach(emp => {
      if (emp.resigned || emp.status === 'Resigned') return;
      const key = emp.name;
      empAdvances[key] = { emp, total: 0, returned: 0 };
    });
    (gd.finance || []).forEach(f => {
      if (f._deleted) return;
      // ✅ FIX: Recycle Bin-এ থাকা items বাদ দাও
      var _advPanRbFin = (gd.deletedItems && !Array.isArray(gd.deletedItems) && gd.deletedItems.finance) || [];
      var _advPanRbId = String(f.id || f.timestamp || '');
      if (_advPanRbFin.some(function(e){ return String((e.item||{}).id||(e.item||{}).timestamp||'') === _advPanRbId; })) return;
      const key = f.person;
      if (!key || !empAdvances[key]) return;
      const amt = parseFloat(f.amount) || 0;
      if (f.type === 'Advance') empAdvances[key].total += amt;
      else if (f.type === 'Advance Return') empAdvances[key].returned += amt;
    });
    let html = '<div style="padding:12px;font-size:0.85rem;">';
    let hasAdvances = false;
    Object.keys(empAdvances).forEach(key => {
      const net = empAdvances[key].total - empAdvances[key].returned;
      if (net > 0) {
        hasAdvances = true;
        html += `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><strong>${key}</strong>: <span style="color:#00fff5;">৳${net.toLocaleString()}</span></div>`;
      }
    });
    if (!hasAdvances) html += '<p style="color:#6e8caa;">No active advances</p>';
    html += '</div>';
    container.innerHTML = html;
  };

  // ─────────────────────────────────────────────────────────
  // showAllTimeSalaryHistory — Full Ledger view
  // ─────────────────────────────────────────────────────────
  window.showAllTimeSalaryHistory = function (empId) {
    const gd = window.globalData || {};
    const emp = (gd.employees || []).find(e => String(e.id) === String(empId) || e.name === empId);
    if (!emp) return;

    // ✅ FIX: Recycle Bin-এ থাকা finance ID গুলো বের করো
    // cloud pull-এর পরে _deleted flag হারিয়ে যায়, তাই শুধু flag যথেষ্ট না
    var _binFinIds = new Set();
    try {
      var _binFin = (gd.deletedItems && !Array.isArray(gd.deletedItems) && gd.deletedItems.finance) || [];
      _binFin.forEach(function(e) {
        var src = e.item || {};
        var id = src.id || src.timestamp;
        if (id) _binFinIds.add(String(id));
      });
    } catch(_e) {}

    const allHist = (gd.finance || [])
      .filter(f => !f._deleted &&
        !_binFinIds.has(String(f.id || f.timestamp || '')) &&
        (f.person === emp.name || f.employeeId === (emp.id || emp.empId)) &&
        (f.type === 'Expense' || f.type === 'Advance' || f.type === 'Advance Return') &&
        (f.category === 'Salaries' || f.category === 'Advance' || f.category === 'Advance Return' || f.category === 'Bonus'))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    let modalEl = document.getElementById('allTimeSalaryModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'allTimeSalaryModal';
      modalEl.className = 'modal fade';
      modalEl.innerHTML = `
              <div class="modal-dialog modal-lg modal-dialog-centered">
                  <div class="modal-content custom-modal border-0 shadow-lg">
                      <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg, rgba(0,217,255,0.1), rgba(0,102,255,0.05)); border-radius:12px 12px 0 0;">
                          <h5 class="modal-title fw-bold text-white d-flex align-items-center mb-2">
                              <span class="me-2" style="font-size:1.5rem;">📜</span> All-Time Payment Ledger
                          </h5>
                          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                      </div>
                      <div class="modal-body p-4">
                          <div class="d-flex align-items-center gap-3 mb-4 p-3 rounded-4" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
                              <div class="rounded-circle d-flex flex-shrink-0 align-items-center justify-content-center text-white" style="width:40px;height:40px;background:linear-gradient(135deg,#7b2ff7,#00d9ff);">
                                  <span id="atshIcon">E</span>
                              </div>
                              <div>
                                  <h5 class="fw-bold mb-0 text-white" id="atshName"></h5>
                                  <div class="small text-muted" id="atshSubtitle">All transactions chronologically</div>
                              </div>
                              <div class="ms-auto">
                                  <span class="badge" style="background:rgba(0,217,255,0.15); color:#00d9ff; border:1px solid rgba(0,217,255,0.3); font-size:0.8rem; padding:6px 12px;" id="atshCount">0 records</span>
                              </div>
                          </div>
                          <div class="table-responsive rounded-3" style="max-height:450px; overflow-y:auto; border:1px solid rgba(255,255,255,0.1);">
                              <table class="table table-dark table-hover mb-0" style="font-size:0.85rem; --bs-table-bg:transparent;">
                                  <thead style="position:sticky; top:0; background:rgba(10,20,35,0.95); z-index:1; border-bottom:2px solid rgba(0,217,255,0.2);">
                                      <tr>
                                          <th style="color:#6e8caa; padding:12px;">Date</th>
                                          <th style="color:#6e8caa; padding:12px;">Type</th>
                                          <th style="color:#6e8caa; padding:12px;">Amount</th>
                                          <th style="color:#6e8caa; padding:12px;">Method</th>
                                          <th style="color:#6e8caa; padding:12px;">Note</th>
                                          <th style="color:#6e8caa; padding:12px; text-align:right;">Action</th>
                                      </tr>
                                  </thead>
                                  <tbody id="atshBody" style="background:rgba(255,255,255,0.02);"></tbody>
                              </table>
                          </div>
                      </div>
                      <div class="modal-footer border-0 pt-0">
                          <button type="button" class="btn btn-secondary rounded-pill px-4 fw-bold" data-bs-dismiss="modal">Close Ledger</button>
                      </div>
                  </div>
              </div>`;
      document.body.appendChild(modalEl);
    }

    document.getElementById('atshIcon').textContent = (emp.name || 'E').charAt(0).toUpperCase();
    document.getElementById('atshName').textContent = emp.name;
    document.getElementById('atshCount').textContent = allHist.length + ' records';
    // Store empId for refresh after delete/edit
    modalEl.dataset.currentEmpId = empId;

    const body = document.getElementById('atshBody');
    body.innerHTML = allHist.map(f => {
      const isAdv = f.type === 'Advance';
      const isReturn = f.type === 'Advance Return';
      const isBonus = (f.description || '').includes('[Bonus]');
      const label = isAdv ? 'Advance' : isReturn ? 'Return' : isBonus ? 'Bonus' : 'Salary';
      const colors = {
        Advance: 'background:rgba(0,150,255,0.15);color:#7ab8ff;border:1px solid rgba(0,150,255,0.35);',
        Return: 'background:rgba(0,230,118,0.12);color:#69f0ae;border:1px solid rgba(0,230,118,0.3);',
        Bonus: 'background:rgba(255,200,0,0.15);color:#ffd200;border:1px solid rgba(255,200,0,0.35);',
        Salary: 'background:rgba(0,200,100,0.12);color:#00e676;border:1px solid rgba(0,200,100,0.3);'
      };
      const dateStr = f.date ? new Date(f.date + 'T00:00:00').toLocaleDateString('en-GB') : '—';

      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:10px 12px; color:#cbd5e1;">${dateStr}</td>
              <td style="padding:10px 12px;"><span style="padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:700; ${colors[label]}">${label}</span></td>
              <td style="padding:10px 12px; font-weight:700; color:#e0f0ff;">৳${(parseFloat(f.amount) || 0).toLocaleString()}</td>
              <td style="padding:10px 12px; color:#94a3c4; font-size:0.8rem;">${f.method || '—'}</td>
              <td style="padding:10px 12px; color:rgba(255,255,255,0.5); font-size:0.8rem; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(f.description || '').replace(/"/g, '&quot;')}">${f.description || '—'}</td>
              <td style="padding:10px 12px; text-align:right; white-space:nowrap;">
                <button onclick="editSalaryRecord('${f.id}')" style="background:rgba(0,217,255,0.12);color:#00d9ff;border:1px solid rgba(0,217,255,0.3);padding:3px 10px;border-radius:8px;font-size:0.72rem;cursor:pointer;margin-right:4px;">✏️ Edit</button>
                <button onclick="deleteSalaryRecordFromLedger('${f.id}')" style="background:rgba(255,59,92,0.12);color:#ff3b5c;border:1px solid rgba(255,59,92,0.3);padding:3px 10px;border-radius:8px;font-size:0.72rem;cursor:pointer;">🗑️ Del</button>
              </td>
          </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px; color:#6e8caa;">No records found.</td></tr>';

    try {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
      modalInstance.show();
    } catch (e) { console.error('Bootstrap modal error:', e); }
  };

  // ─────────────────────────────────────────────────────────
  // EXPOSE GLOBALS
  // ─────────────────────────────────────────────────────────
  window.initSalaryHub = initSalaryHub;
  window.loadSalaryHub = renderSalaryCards;
  window.openSalaryModal = openSalaryModal;
  window._openSalaryModalImpl = openSalaryModal;
  window.handleSalarySubmit = handleSalarySubmit;
  window.toggleSalHistory = _toggleSalHist;

  // Aliases — auto-test, finance-guard, sync-guard expect *Payment names (same impl as *Record)
  window.editSalaryPayment = window.editSalaryRecord;
  window.deleteSalaryPayment = window.deleteSalaryRecord;

  // ─────────────────────────────────────────────────────────
  // DELETE FROM ALL-TIME LEDGER — deletes + refreshes modal
  // ─────────────────────────────────────────────────────────
  window.deleteSalaryRecordFromLedger = function (txId) {
    // Call the existing delete logic
    window.deleteSalaryRecord(txId);
    // Refresh the All-Time Ledger modal if it's open
    const modalEl = document.getElementById('allTimeSalaryModal');
    if (modalEl && modalEl.dataset.currentEmpId) {
      window.showAllTimeSalaryHistory(modalEl.dataset.currentEmpId);
    }
  };

  console.log('✅ salary-management.js v4.2 (Full Ledger delete support) loaded');

})();
