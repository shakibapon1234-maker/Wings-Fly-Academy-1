/* ============================================================
   SALARY HUB MODULE — Wings Fly Aviation Academy
   Phase 9 | Full Rewrite — All bugs fixed
   ============================================================
   FIXES:
   1. Staff select করলে HR থেকে name + baseSalary auto-fill হয়
   2. আলাদা "Payment Amount" field — partial payment সম্ভব
   3. Date format: DD-MM-YYYY (paid_date display তে)
   4. Table sort: paid_date desc (সর্বশেষ payment সবার আগে)
   5. HR-এ salary update হলে salary record auto-sync
   6. markPaid → Finance ledger-এ Expense entry যায়
   7. Delete → RecycleBin, Restore করলে auto-figure ফেরত
   8. Finance addExternalTransaction না থাকলে direct insert fallback
   ============================================================ */

const Salary = (() => {

  let editingId = null;

  /* ─── Helpers ─── */

  function getRecords() {
    // Sort by paidDate desc (সর্বশেষ payment সবার উপরে), unpaid নিচে
    const all = SupabaseSync.getAll(DB.salary);
    return all.sort((a, b) => {
      // paid records: sort by paidDate desc
      // unpaid records: sort by createdAt / id desc (সবার নিচে)
      const aDate = a.paidDate || '';
      const bDate = b.paidDate || '';
      if (aDate && bDate) return bDate.localeCompare(aDate);
      if (aDate) return -1; // a paid, b not → a first
      if (bDate) return 1;  // b paid, a not → b first
      // both unpaid → sort by id desc (newest first)
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[parseInt(m) - 1] || '?'} ${y}`;
  }

  // DD-MM-YYYY format
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  function getSelectedMonth() {
    return document.getElementById('salary-month-picker')?.value || currentMonth();
  }

  /* ─── HR sync: যখন HR record update হয়, salary record update করো ─── */
  function syncFromHR(staffId) {
    if (typeof HRStaff === 'undefined') return;
    const staffMember = HRStaff.getAll().find(s => s.staffId === staffId);
    if (!staffMember) return;

    const salaryRecords = SupabaseSync.getAll(DB.salary);
    salaryRecords.forEach(r => {
      const matchById   = r.staffId && r.staffId === staffMember.staffId;
      const matchByName = !r.staffId && r.staffName && r.staffName === staffMember.name;
      if ((matchById || matchByName) && !r.paid) {
        SupabaseSync.update(DB.salary, r.id, {
          staffId:    staffMember.staffId,
          staffName:  staffMember.name,
          role:       staffMember.role,
          phone:      staffMember.phone || '',
          baseSalary: staffMember.salary || 0,
        });
      }
    });
  }

  /* ─── সকল HR staff এর জন্য একবারে sync ─── */
  function syncAllFromHR() {
    if (typeof HRStaff === 'undefined') return;
    HRStaff.getAll().forEach(s => syncFromHR(s.staffId));
    renderContent();
  }

  /* ─── Finance-এ Expense entry যোগ করো ─── */
  function _logToFinance(record, payAmount, payDate, method) {
    const entry = {
      type:        'Expense',
      category:    'Salary',
      method:      method || 'Cash',
      description: `Salary: ${record.staffName} (${monthLabel(record.month)})`,
      amount:      payAmount,
      date:        payDate || new Date().toISOString().split('T')[0],
      note:        record.note || '',
      person_name: record.staffName,
    };

    // Finance module-এ addExternalTransaction থাকলে সেটা use করো
    if (typeof Finance !== 'undefined' && typeof Finance.addExternalTransaction === 'function') {
      Finance.addExternalTransaction(entry);
    } else {
      // Fallback: সরাসরি insert
      SupabaseSync.insert(DB.finance, entry);
    }
  }

  /* ─── Render ─── */
  function renderContent() {
    const container = document.getElementById('salary-content');
    if (!container) return;

    const cm      = getSelectedMonth();
    const records = getRecords();
    const thisMonth = records.filter(r => r.month === cm);

    let totalBudget = 0, totalPaid = 0;
    thisMonth.forEach(r => {
      totalBudget += Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
      if (r.paid) totalPaid += Utils.safeNum(r.paidAmount) || (Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction));
    });
    const totalDue = totalBudget - totalPaid;

    container.innerHTML = `
      <!-- Top Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
        <h2 style="margin:0; font-size:1.5rem; display:flex; align-items:center; gap:8px;">
          <i class="fa fa-sack-dollar" style="color:var(--brand-primary);"></i> Salary Management Hub
        </h2>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="Salary.generateMonthlySheet()" title="HR থেকে এই মাসের সকল active staff-এর salary sheet তৈরি করো">
            <i class="fa fa-magic" style="color:#ffb703;"></i> AUTO-GENERATE SHEET
          </button>
          <button class="btn btn-primary" onclick="Salary.openAddModal()" style="border-radius:24px; padding:8px 20px; font-weight:700; background:linear-gradient(135deg,#00d4ff,#7c3aed); border:none;">
            <i class="fa fa-plus-circle"></i> RECORD PAYMENT
          </button>
          <button class="btn btn-secondary" onclick="Salary.openHistoryModal()">
            <i class="fa fa-list"></i> FULL LEDGER
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px; margin-bottom:32px;">
        <div style="border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTH / YEAR</div>
          <input type="month" id="salary-month-picker" value="${cm}" onchange="Salary.renderContent()"
            style="background:transparent; border:none; color:#fff; font-size:1.1rem; width:100%; outline:none;" />
        </div>
        <div style="border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTHLY BUDGET</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00d4ff;">৳${Utils.formatMoneyPlain(totalBudget)}</div>
        </div>
        <div style="border:1px solid rgba(0,255,136,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:.75rem; color:#00ff88; text-transform:uppercase; font-weight:700; margin-bottom:8px;">PAID AMOUNT</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00ff88;">৳${Utils.formatMoneyPlain(totalPaid)}</div>
        </div>
        <div style="border:1px solid rgba(255,71,87,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:.75rem; color:#ff4757; text-transform:uppercase; font-weight:700; margin-bottom:8px;">DUE AMOUNT</div>
          <div style="font-size:1.6rem; font-weight:800; color:#ff4757;">৳${Utils.formatMoneyPlain(totalDue)}</div>
        </div>
      </div>

      <!-- Salary Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px,1fr)); gap:20px; margin-bottom:32px;">
        ${thisMonth.length === 0 ? `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:rgba(0,0,0,0.2); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
            <i class="fa fa-folder-open" style="font-size:3.5rem; margin-bottom:16px; opacity:.3; display:block; color:var(--brand-primary);"></i>
            <div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No Salary Records for ${monthLabel(cm)}</div>
            <div style="color:var(--text-muted); margin-bottom:24px; font-size:.9rem;">
              HR থেকে সকল active staff-এর জন্য salary sheet তৈরি করুন।
            </div>
            <button class="btn btn-primary" onclick="Salary.generateMonthlySheet()"
              style="padding:12px 28px; font-size:1rem; font-weight:700; border-radius:30px; background:linear-gradient(135deg,#00d4ff,#7c3aed); border:none;">
              <i class="fa fa-magic"></i> AUTO-GENERATE FOR ${monthLabel(cm).toUpperCase()}
            </button>
          </div>
        ` : thisMonth.map(r => {
          const net      = Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
          const paid_amt = r.paid ? (Utils.safeNum(r.paidAmount) || net) : 0;
          const due_amt  = net - paid_amt;

          return `
          <div class="salary-card" style="background:var(--bg-secondary); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:20px; position:relative; overflow:hidden;">
            <!-- Card Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:50%; background:rgba(0,212,255,0.1); display:flex; align-items:center; justify-content:center;">
                  <i class="fa fa-user" style="color:#00d4ff;"></i>
                </div>
                <div>
                  <div style="font-weight:700; color:#fff; font-size:1.05rem;">${r.staffName || '—'}</div>
                  <div style="font-size:.78rem; color:var(--text-muted);">
                    ${r.role || 'Staff'}
                    ${r.phone ? `<i class="fa fa-phone" style="margin:0 4px; opacity:.6;"></i>${r.phone}` : ''}
                  </div>
                </div>
              </div>
              <!-- Status + Actions -->
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                <span style="font-size:.72rem; padding:3px 10px; border-radius:12px;
                  background:${r.paid ? 'rgba(0,255,136,0.12)' : 'rgba(255,170,0,0.12)'};
                  color:${r.paid ? '#00ff88' : '#ffb703'}; font-weight:700;">
                  <i class="fa ${r.paid ? 'fa-check' : 'fa-hourglass-half'}"></i>
                  ${r.paid ? 'Paid' : 'Pending'}
                </span>
                ${!r.paid
                  ? `<button class="btn btn-primary" style="border-radius:20px; padding:4px 12px; font-size:.82rem;" onclick="Salary.openPayModal('${r.id}')">
                       <i class="fa fa-sack-dollar"></i> Pay
                     </button>`
                  : ''
                }
                <button class="btn btn-secondary" style="border-radius:20px; padding:4px 10px;" onclick="Salary.openEditModal('${r.id}')">
                  <i class="fa fa-pen"></i>
                </button>
                <button class="btn btn-secondary" style="border-radius:20px; padding:4px 10px;" onclick="Salary.deleteRecord('${r.id}')" title="Delete">
                  <i class="fa fa-trash" style="color:#ff4757;"></i>
                </button>
              </div>
            </div>

            <!-- Financials -->
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:16px;">
              <div style="text-align:center; background:rgba(255,255,255,0.04); padding:10px 6px; border-radius:8px;">
                <div style="font-size:.62rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; letter-spacing:.5px;">NET SALARY</div>
                <div style="font-weight:700; color:#fff; font-size:.95rem;">৳${Utils.formatMoneyPlain(net)}</div>
              </div>
              <div style="text-align:center; background:rgba(0,255,136,0.06); padding:10px 6px; border-radius:8px;">
                <div style="font-size:.62rem; color:#00ff88; text-transform:uppercase; margin-bottom:4px; letter-spacing:.5px;">PAID</div>
                <div style="font-weight:700; color:#00ff88; font-size:.95rem;">৳${Utils.formatMoneyPlain(paid_amt)}</div>
              </div>
              <div style="text-align:center; background:${due_amt > 0 ? 'rgba(255,170,0,0.1)' : 'rgba(255,255,255,0.04)'}; padding:10px 6px; border-radius:8px;">
                <div style="font-size:.62rem; color:${due_amt > 0 ? '#ffb703' : 'var(--text-muted)'}; text-transform:uppercase; margin-bottom:4px; letter-spacing:.5px;">DUE</div>
                <div style="font-weight:700; color:${due_amt > 0 ? '#ffb703' : '#fff'}; font-size:.95rem;">৳${Utils.formatMoneyPlain(due_amt)}</div>
              </div>
            </div>

            <!-- Details Row -->
            <div style="font-size:.75rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:6px;">
              <span><i class="fa fa-wallet" style="margin-right:4px; opacity:.6;"></i>${r.method || '—'}</span>
              <span><i class="fa fa-calendar" style="margin-right:4px; opacity:.6;"></i>
                ${r.paid && r.paidDate ? `Paid: <strong style="color:#00ff88;">${formatDate(r.paidDate)}</strong>` : `Month: ${monthLabel(r.month)}`}
              </span>
            </div>
            ${r.bonus || r.deduction ? `
            <div style="font-size:.72rem; color:var(--text-muted); display:flex; gap:12px;">
              ${r.bonus    ? `<span style="color:#00d4ff;"><i class="fa fa-plus"></i> Bonus: ৳${Utils.formatMoneyPlain(r.bonus)}</span>` : ''}
              ${r.deduction ? `<span style="color:#ff4757;"><i class="fa fa-minus"></i> Deduction: ৳${Utils.formatMoneyPlain(r.deduction)}</span>` : ''}
            </div>` : ''}

            <!-- Progress Bar -->
            <div style="margin-top:12px;">
              <div style="display:flex; justify-content:space-between; font-size:.7rem; color:var(--text-muted); margin-bottom:4px;">
                <span>Payment Progress</span>
                <span style="font-weight:700; color:${r.paid ? '#00ff88' : 'var(--text-muted)'};">${r.paid ? '100%' : '0%'}</span>
              </div>
              <div style="height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px;">
                <div style="height:100%; border-radius:2px; background:${r.paid ? '#00ff88' : 'rgba(255,255,255,0.1)'}; width:${r.paid ? '100' : '0'}%; transition:width .4s;"></div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- View Full Ledger -->
      <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-secondary" style="border:none; color:#00d4ff; font-weight:700; background:transparent;" onclick="Salary.openHistoryModal()">
          <i class="fa fa-list"></i> VIEW ALL PREVIOUS MONTHS HISTORY (FULL LEDGER)
        </button>
      </div>
    `;
  }

  /* ─── Generate Monthly Sheet from HR ─── */
  function generateMonthlySheet() {
    const month   = getSelectedMonth();
    const records = getRecords();
    const existingIds = records.filter(r => r.month === month).map(r => r.staffId);

    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll() : [];
    const activeStaff = allStaff.filter(s => s.status === 'Active' && !existingIds.includes(s.staffId));

    if (!activeStaff.length) {
      Utils.toast(existingIds.length ? 'All active staff sheets already created ✓' : 'No active staff found in HR', 'info');
      return;
    }

    activeStaff.forEach(s => {
      SupabaseSync.insert(DB.salary, {
        staffId:    s.staffId,
        staffName:  s.name,
        role:       s.role || '',
        phone:      s.phone || '',
        month,
        baseSalary: Utils.safeNum(s.salary),
        bonus:      0,
        deduction:  0,
        paidAmount: 0,
        paid:       false,
        paidDate:   '',
        method:     'Cash',
        note:       '',
      });
    });

    renderContent();
    Utils.toast(`${activeStaff.length} salary sheets created ✓`, 'success');
  }

  /* ─── PAY MODAL (Quick Payment) ─── */
  function openPayModal(id) {
    const r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;

    const net = Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayDD   = String(today.getDate()).padStart(2,'0');
    const todayMM   = String(today.getMonth()+1).padStart(2,'0');
    const todayYYYY = String(today.getFullYear());

    const months = [
      ['01','January'],['02','February'],['03','March'],['04','April'],
      ['05','May'],['06','June'],['07','July'],['08','August'],
      ['09','September'],['10','October'],['11','November'],['12','December']
    ];
    const currentYear = today.getFullYear();
    const years = Array.from({length:6}, (_,i) => currentYear - 2 + i);

    function dateDropdowns(prefix, dd, mm, yyyy) {
      return `
        <div style="display:flex; gap:6px;">
          <select id="${prefix}-dd" class="form-control" style="flex:0 0 70px;" onchange="Salary._syncPayDate('${prefix}','${todayStr}')">
            ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
          </select>
          <select id="${prefix}-mm" class="form-control" style="flex:1;" onchange="Salary._syncPayDate('${prefix}','${todayStr}')">
            ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
          </select>
          <select id="${prefix}-yyyy" class="form-control" style="flex:0 0 90px;" onchange="Salary._syncPayDate('${prefix}','${todayStr}')">
            ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <input type="hidden" id="${prefix}" value="${yyyy}-${mm}-${dd}" />`;
    }

    const html = `
      <div style="margin-bottom:20px;">
        <!-- Staff Info -->
        <div style="background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:10px; padding:16px; margin-bottom:20px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; border-radius:50%; background:rgba(0,212,255,0.15); display:flex; align-items:center; justify-content:center;">
              <i class="fa fa-user" style="color:#00d4ff; font-size:1.2rem;"></i>
            </div>
            <div>
              <div style="font-weight:800; color:#fff; font-size:1.1rem;">${r.staffName}</div>
              <div style="font-size:.8rem; color:#00d4ff;">${r.role || 'Staff'} &nbsp;|&nbsp; ${monthLabel(r.month)}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
              <div style="font-size:.7rem; color:var(--text-muted);">Net Salary</div>
              <div style="font-size:1.3rem; font-weight:800; color:#00ff88;">৳${Utils.formatMoneyPlain(net)}</div>
              ${Utils.safeNum(r.paidAmount) > 0 && !r.paid ? `<div style="font-size:.72rem; color:#ffb703;">আগে দেওয়া: ৳${Utils.formatMoneyPlain(r.paidAmount)} | বাকি: ৳${Utils.formatMoneyPlain(net - Utils.safeNum(r.paidAmount))}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Amount (৳) <span class="req">*</span></label>
            <input type="number" id="pay-amount" class="form-control" min="1" value="${net - Utils.safeNum(r.paidAmount)}" placeholder="Enter amount to pay" />
            <div style="font-size:.72rem; color:var(--text-muted); margin-top:4px;">এই বারের payment — partial বা full যেকোনো amount দিতে পারেন</div>
          </div>
          <div class="form-group">
            <label>Payment Date <span class="req">*</span></label>
            ${dateDropdowns('pay-date', todayDD, todayMM, todayYYYY)}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Payment Method <span class="req">*</span></label>
            <select id="pay-method" class="form-control" onchange="Utils.onPaymentMethodChange && Utils.onPaymentMethodChange(this,'pay-bal-display')">
              ${Utils.getPaymentMethodsHTML(r.method)}
            </select>
            <div id="pay-bal-display" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label>Note</label>
            <input type="text" id="pay-note" class="form-control" placeholder="Optional remarks" value="${r.note || ''}" />
          </div>
        </div>
      </div>

      <div class="form-actions" style="justify-content:flex-end; margin-top:10px;">
        <button class="btn-secondary" style="border-radius:24px; padding:10px 24px; font-weight:700; color:#fff; background:rgba(255,255,255,0.1); border:none;" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-primary" style="border-radius:24px; padding:10px 24px; font-weight:700; border:none; color:#fff; background:linear-gradient(135deg,#00d4ff,#7c3aed);" onclick="Salary.confirmPay('${id}')">
          <i class="fa fa-sack-dollar"></i> CONFIRM PAYMENT
        </button>
      </div>`;

    Utils.openModal(`<i class="fa fa-sack-dollar" style="color:#00d4ff;"></i> Pay Salary — ${r.staffName}`, html);
  }

  /* ─── Date Sync Helper for Pay Modal ─── */
  function _syncPayDate(prefix) {
    const dd   = document.getElementById(prefix + '-dd')?.value   || '';
    const mm   = document.getElementById(prefix + '-mm')?.value   || '';
    const yyyy = document.getElementById(prefix + '-yyyy')?.value || '';
    const hidden = document.getElementById(prefix);
    if (hidden) hidden.value = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
  }

  function confirmPay(id) {
    const r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;

    const payAmount = Utils.safeNum(document.getElementById('pay-amount')?.value);
    const payDate   = document.getElementById('pay-date')?.value;
    const method    = document.getElementById('pay-method')?.value;
    const note      = document.getElementById('pay-note')?.value.trim();

    if (!payAmount || payAmount <= 0) { Utils.toast('Valid payment amount দিন', 'error'); return; }
    if (!method)    { Utils.toast('Payment method select করুন', 'error'); return; }
    if (!payDate)   { Utils.toast('Payment date দিন', 'error'); return; }

    // Balance check
    const available = Utils.getAccountBalance ? Utils.getAccountBalance(method) : Infinity;
    if (payAmount > available) {
      Utils.toast(`${method}-এ যথেষ্ট balance নেই। Available: ৳${Utils.formatMoneyPlain(available)}`, 'error');
      return;
    }

    // Net salary হিসেব
    const net = Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
    // আগে কত paid ছিল
    const prevPaid = Utils.safeNum(r.paidAmount);
    // নতুন total paid
    const totalPaid = prevPaid + payAmount;
    // পুরো salary দেওয়া হলে paid=true, partial হলে due রাখো
    const isFullyPaid = totalPaid >= net;

    SupabaseSync.update(DB.salary, id, {
      paid:       isFullyPaid,
      paidAmount: totalPaid,
      paidDate:   payDate,
      method,
      note: note || r.note || '',
    });

    // যেকোনো amount > 0 হলে Finance Expense entry যাবে
    _logToFinance(r, payAmount, payDate, method);

    Utils.closeModal();
    renderContent();
    const statusMsg = isFullyPaid ? 'পুরো salary paid ✓' : `partial ৳${Utils.formatMoneyPlain(payAmount)} paid — বাকি ৳${Utils.formatMoneyPlain(net - totalPaid)}`;
    Utils.toast(`${r.staffName}: ${statusMsg}`, isFullyPaid ? 'success' : 'info');
  }

  /* ─── markPaid (card-এর Pay button থেকে — quick pay with today's date) ─── */
  function markPaid(id) {
    // openPayModal use করো — আলাদা amount/date দেওয়ার সুযোগ
    openPayModal(id);
  }

  /* ─── Modal: Add Record (manual) ─── */
  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-sack-dollar" style="color:#00d4ff;"></i> RECORD SALARY PAYMENT', formHTML(null));
  }

  /* ─── Modal: Edit Record ─── */
  function openEditModal(id) {
    editingId = id;
    const r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;
    Utils.openModal('<i class="fa fa-pen" style="color:#00d4ff;"></i> EDIT SALARY RECORD', formHTML(r));
  }

  /* ─── Form HTML ─── */
  function formHTML(r) {
    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll().filter(s => s.status === 'Active') : [];
    const net = r ? Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction) : 0;

    return `
      <!-- Staff + Month -->
      <div style="margin-bottom:20px;">
        <div class="form-row">
          <div class="form-group">
            <label>Select Staff <span class="req">*</span></label>
            <select id="sal-staff" class="form-control" onchange="Salary.onStaffSelect()">
              <option value="">-- HR থেকে Staff বেছে নিন --</option>
              ${allStaff.map(s => `
                <option value="${s.staffId}"
                  ${r?.staffId === s.staffId ? 'selected' : ''}
                  data-name="${Utils.escapeHtml ? Utils.escapeHtml(s.name) : s.name}"
                  data-role="${s.role || ''}"
                  data-phone="${s.phone || ''}"
                  data-salary="${Utils.safeNum(s.salary)}">
                  ${s.staffId} — ${s.name} (৳${Utils.formatMoneyPlain(s.salary)})
                </option>`).join('')}
            </select>
            <!-- Auto-filled info box -->
            <div id="sal-staff-info" style="display:${r?.staffId ? 'block' : 'none'}; margin-top:8px; background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:8px; padding:10px; font-size:.8rem; color:#00d4ff;">
              <i class="fa fa-circle-check" style="margin-right:6px;"></i>
              <strong id="sal-info-name">${r?.staffName || ''}</strong> — Basic Salary:
              <strong id="sal-info-salary">৳${Utils.formatMoneyPlain(r?.baseSalary || 0)}</strong>
            </div>
          </div>
          <div class="form-group">
            <label>Month <span class="req">*</span></label>
            <input type="month" id="sal-month" class="form-control" value="${r?.month || getSelectedMonth()}" />
          </div>
        </div>
      </div>

      <!-- Financial Details -->
      <div style="margin-bottom:20px;">
        <div style="font-size:.74rem; color:var(--text-muted); font-weight:700; letter-spacing:1px; margin-bottom:12px;">FINANCIAL DETAILS</div>
        <div class="form-row">
          <div class="form-group">
            <label>Basic Salary (৳) <span style="font-size:.7rem; color:#00d4ff;">[HR থেকে auto-fill]</span></label>
            <input type="number" id="sal-base" class="form-control" min="0" value="${r?.baseSalary || ''}" placeholder="0" oninput="Salary.updateNetDisplay()" />
          </div>
          <div class="form-group">
            <label>Bonus (৳)</label>
            <input type="number" id="sal-bonus" class="form-control" min="0" value="${r?.bonus || 0}" oninput="Salary.updateNetDisplay()" />
          </div>
          <div class="form-group">
            <label>Deduction (৳)</label>
            <input type="number" id="sal-deduction" class="form-control" min="0" value="${r?.deduction || 0}" oninput="Salary.updateNetDisplay()" />
          </div>
        </div>
        <!-- Net display -->
        <div id="sal-net-display" style="text-align:right; font-size:.85rem; color:#00ff88; font-weight:700; margin-top:4px;">
          Net Salary: ৳${Utils.formatMoneyPlain(net)}
        </div>
      </div>

      <!-- Payment Info -->
      <div style="margin-bottom:20px;">
        <div style="font-size:.74rem; color:var(--text-muted); font-weight:700; letter-spacing:1px; margin-bottom:12px;">PAYMENT INFO</div>
        <div class="form-row">
          <div class="form-group">
            <label>Payment Amount (৳) <span class="req">*</span></label>
            <input type="number" id="sal-pay-amount" class="form-control" min="0"
              value="${r?.paidAmount || (r ? (Utils.safeNum(r.baseSalary)+Utils.safeNum(r.bonus)-Utils.safeNum(r.deduction)) : '')}"
              placeholder="Actual amount to pay" />
            <div style="font-size:.7rem; color:var(--text-muted); margin-top:3px;">Net salary-এর থেকে আলাদা হতে পারে</div>
          </div>
          <div class="form-group">
            <label>Payment Date <span class="req">*</span></label>
            ${(() => {
              const pd = r?.paidDate || Utils.today();
              const d = new Date(pd);
              const dd   = String(d.getDate()).padStart(2,'0');
              const mm   = String(d.getMonth()+1).padStart(2,'0');
              const yyyy = String(d.getFullYear());
              const monthNames = [
                ['01','January'],['02','February'],['03','March'],['04','April'],
                ['05','May'],['06','June'],['07','July'],['08','August'],
                ['09','September'],['10','October'],['11','November'],['12','December']
              ];
              const currentYear = new Date().getFullYear();
              const yearOpts = Array.from({length:6},(_,i)=>currentYear-2+i);
              return `
                <div style="display:flex; gap:6px;">
                  <select id="sal-paiddate-dd" class="form-control" style="flex:0 0 70px;" onchange="Salary._syncPayDate('sal-paiddate','${pd}')">
                    ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
                  </select>
                  <select id="sal-paiddate-mm" class="form-control" style="flex:1;" onchange="Salary._syncPayDate('sal-paiddate','${pd}')">
                    ${monthNames.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
                  </select>
                  <select id="sal-paiddate-yyyy" class="form-control" style="flex:0 0 90px;" onchange="Salary._syncPayDate('sal-paiddate','${pd}')">
                    ${yearOpts.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
                  </select>
                </div>
                <input type="hidden" id="sal-paiddate" value="${yyyy}-${mm}-${dd}" />`;
            })()}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Payment Method <span class="req">*</span></label>
            <select id="sal-method" class="form-control" onchange="Utils.onPaymentMethodChange && Utils.onPaymentMethodChange(this,'sal-bal-display')">
              <option value="">Select Method…</option>
              ${Utils.getPaymentMethodsHTML(r?.method)}
            </select>
            <div id="sal-bal-display" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label>Pay Status</label>
            <select id="sal-paid" class="form-control">
              <option value="0" ${!r?.paid ? 'selected' : ''}>Due / Pending</option>
              <option value="1" ${r?.paid  ? 'selected' : ''}>Paid</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-group full-width">
        <label>Notes</label>
        <textarea id="sal-note" class="form-control" rows="2" placeholder="Any remarks…">${r?.note || ''}</textarea>
      </div>

      <div class="form-actions" style="justify-content:flex-end; margin-top:10px;">
        <button class="btn-secondary" style="border-radius:24px; padding:10px 24px; font-weight:700; color:#fff; background:rgba(255,255,255,0.1); border:none;" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-primary"   style="border-radius:24px; padding:10px 24px; font-weight:700; border:none; color:#fff; background:linear-gradient(135deg,#00d4ff,#7c3aed);" onclick="Salary.saveRecord()">
          <i class="fa fa-floppy-disk"></i> SAVE RECORD
        </button>
      </div>`;
  }

  /* ─── Live net display update ─── */
  function updateNetDisplay() {
    const base = Utils.safeNum(document.getElementById('sal-base')?.value);
    const bon  = Utils.safeNum(document.getElementById('sal-bonus')?.value);
    const ded  = Utils.safeNum(document.getElementById('sal-deduction')?.value);
    const net  = base + bon - ded;
    const el   = document.getElementById('sal-net-display');
    if (el) el.innerHTML = `Net Salary: ৳${Utils.formatMoneyPlain(net)}`;
    // Also update pay amount if user hasn't touched it
    const payEl = document.getElementById('sal-pay-amount');
    if (payEl && (!payEl.dataset.touched)) payEl.value = net || '';
  }

  /* ─── Staff select handler — HR থেকে auto-fill ─── */
  function onStaffSelect() {
    const sel = document.getElementById('sal-staff');
    const opt = sel?.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      document.getElementById('sal-staff-info').style.display = 'none';
      return;
    }
    const salary = Utils.safeNum(opt.dataset.salary);
    // Auto-fill basic salary
    const baseEl = document.getElementById('sal-base');
    if (baseEl) { baseEl.value = salary; baseEl.dispatchEvent(new Event('input')); }
    // Show info box
    const infoBox = document.getElementById('sal-staff-info');
    if (infoBox) {
      document.getElementById('sal-info-name').textContent   = opt.dataset.name || '';
      document.getElementById('sal-info-salary').textContent = `৳${Utils.formatMoneyPlain(salary)}`;
      infoBox.style.display = 'block';
    }
    updateNetDisplay();
  }

  /* ─── Save Record ─── */
  function saveRecord() {
    const staffSel = document.getElementById('sal-staff');
    const staffId  = staffSel?.value;
    const staffOpt = staffSel?.options[staffSel?.selectedIndex];

    if (!staffId) { Utils.toast('Staff select করুন', 'error'); return; }
    if (!document.getElementById('sal-method')?.value) { Utils.toast('Payment Method select করুন', 'error'); return; }

    const base      = Utils.safeNum(document.getElementById('sal-base')?.value);
    const bonus     = Utils.safeNum(document.getElementById('sal-bonus')?.value);
    const deduction = Utils.safeNum(document.getElementById('sal-deduction')?.value);
    const payAmount = Utils.safeNum(document.getElementById('sal-pay-amount')?.value) || (base + bonus - deduction);
    const isPaid    = document.getElementById('sal-paid')?.value === '1';
    const method    = document.getElementById('sal-method')?.value;
    const payDate   = document.getElementById('sal-paiddate')?.value || Utils.today();

    // Balance check for paid
    if (isPaid) {
      const available = Utils.getAccountBalance ? Utils.getAccountBalance(method) : Infinity;
      if (payAmount > available) {
        Utils.toast(`${method}-এ যথেষ্ট balance নেই। Available: ৳${Utils.formatMoneyPlain(available)}`, 'error');
        return;
      }
    }

    const entry = {
      staffId,
      staffName:  staffOpt?.dataset.name  || '',
      role:       staffOpt?.dataset.role  || '',
      phone:      staffOpt?.dataset.phone || '',
      month:      document.getElementById('sal-month')?.value || getSelectedMonth(),
      baseSalary: base,
      bonus,
      deduction,
      paidAmount: payAmount,
      method,
      paid:       isPaid,
      paidDate:   isPaid ? payDate : '',
      note:       document.getElementById('sal-note')?.value.trim() || '',
    };

    const isNew = !editingId;

    if (editingId) {
      SupabaseSync.update(DB.salary, editingId, entry);
      Utils.toast('Salary record updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.salary, entry);
      Utils.toast('Salary record saved ✓', 'success');
    }

    // Finance log — paid হলে বা partial amount দিলেও Finance এ যাবে
    if (payAmount > 0) {
      const existing = editingId ? SupabaseSync.getById(DB.salary, editingId) : null;
      const prevPaidAmt = Utils.safeNum(existing?.paidAmount);
      // নতুন record অথবা amount বেড়েছে — পার্থক্যটাই Finance এ যাবে
      const diff = isNew ? payAmount : (payAmount - prevPaidAmt);
      if (diff > 0) {
        _logToFinance(entry, diff, payDate, method);
      }
    }

    Utils.closeModal();
    renderContent();
    editingId = null;
  }

  /* ─── Delete ─── */
  async function deleteRecord(id) {
    const ok = await Utils.confirm('এই salary record মুছে দেবেন? RecycleBin-এ যাবে।', 'Delete Salary Record');
    if (!ok) return;
    SupabaseSync.remove(DB.salary, id);
    renderContent();
    Utils.toast('Record deleted — RecycleBin-এ আছে', 'warning');
  }

  /* ─── Full History Modal (সর্বশেষ date সবার আগে) ─── */
  function openHistoryModal() {
    const records = getRecords(); // already sorted by paidDate desc

    const html = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Month</th>
              <th>Staff Name</th>
              <th>Basic</th>
              <th>Paid Amount</th>
              <th>Status</th>
              <th>Method</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${records.length ? records.map(r => {
              const net = Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
              const paid_amt = r.paid ? (Utils.safeNum(r.paidAmount) || net) : 0;
              return `
              <tr>
                <td style="font-weight:700; color:${r.paid ? '#00ff88' : '#ffb703'};">
                  ${r.paid && r.paidDate ? formatDate(r.paidDate) : '—'}
                </td>
                <td style="color:#00d4ff; font-weight:700;">${monthLabel(r.month)}</td>
                <td>
                  <div style="font-weight:700; color:#fff;">${r.staffName}</div>
                  <div style="font-size:.73rem; color:var(--text-muted);">${r.role || 'Staff'}</div>
                </td>
                <td>৳${Utils.formatMoneyPlain(r.baseSalary || 0)}</td>
                <td style="font-weight:700; color:#00ff88;">৳${Utils.formatMoneyPlain(paid_amt)}</td>
                <td>
                  <span class="badge ${r.paid ? 'badge-success' : 'badge-warning'}" style="font-size:.72rem;">
                    <i class="fa ${r.paid ? 'fa-check' : 'fa-hourglass-half'}"></i> ${r.paid ? 'Paid' : 'Due'}
                  </span>
                </td>
                <td style="font-size:.8rem;">${r.method || '—'}</td>
                <td>
                  ${!r.paid
                    ? `<button class="btn btn-primary" style="padding:4px 10px; font-size:.78rem; border-radius:20px;"
                         onclick="Salary.openPayModal('${r.id}'); Utils.closeModal()">
                         <i class="fa fa-sack-dollar"></i> Pay
                       </button>`
                    : `<span style="font-size:.75rem; color:var(--text-muted);">
                         <i class="fa fa-check-circle" style="color:#00ff88;"></i> Done
                       </span>`
                  }
                </td>
              </tr>`;
            }).join('') : `
              <tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
                <i class="fa fa-folder-open" style="font-size:2rem; display:block; opacity:.3; margin-bottom:8px;"></i>
                No salary history found
              </td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="form-actions" style="justify-content:flex-end; margin-top:16px;">
        <button class="btn-secondary" onclick="Salary.exportExcel(); Utils.closeModal()"><i class="fa fa-file-excel"></i> Export Excel</button>
        <button class="btn-primary" onclick="Utils.closeModal()">CLOSE</button>
      </div>`;

    Utils.openModal('<i class="fa fa-list"></i> Full Global Salary Ledger', html, 'modal-lg');
  }

  /* ─── Export Excel ─── */
  function exportExcel() {
    const records = getRecords();
    if (!records.length) { Utils.toast('No data to export', 'error'); return; }
    const rows = records.map(r => {
      const net = Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
      return {
        'Payment Date': r.paidDate ? formatDate(r.paidDate) : '—',
        'Month':       monthLabel(r.month),
        'Staff ID':    r.staffId,
        'Name':        r.staffName,
        'Role':        r.role || '',
        'Basic Salary':r.baseSalary || 0,
        'Bonus':       r.bonus || 0,
        'Deduction':   r.deduction || 0,
        'Net Salary':  net,
        'Paid Amount': r.paid ? (Utils.safeNum(r.paidAmount) || net) : 0,
        'Method':      r.method || '',
        'Status':      r.paid ? 'Paid' : 'Due',
        'Note':        r.note || '',
      };
    });
    Utils.exportExcel(rows, `Salary_All`, 'Salary Ledger');
  }

  /* ─── Dashboard summary ─── */
  function getSummary() {
    const cm = currentMonth();
    const records = getRecords();
    const thisMonth = records.filter(r => r.month === cm);
    return {
      totalBudget: thisMonth.reduce((s, r) => s + Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction), 0),
      totalPaid:   thisMonth.filter(r => r.paid).reduce((s, r) => s + (Utils.safeNum(r.paidAmount) || Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction)), 0),
      count:       thisMonth.length,
    };
  }

  /* ─── Finance module-এ addExternalTransaction expose করো ─── */
  // finance.js-এ এই function নেই, তাই salary.js নিজেই direct insert করে
  // কিন্তু যদি future-এ Finance module update হয়, তাহলে এটা কাজ করবে

  return {
    init:              renderContent,
    render:            renderContent,
    renderContent,
    openAddModal,
    openEditModal,
    openPayModal,
    confirmPay,
    openHistoryModal,
    saveRecord,
    markPaid,
    deleteRecord,
    generateMonthlySheet,
    exportExcel,
    onStaffSelect,
    updateNetDisplay,
    syncFromHR,
    syncAllFromHR,
    _syncPayDate,
    getSummary,
  };

})();
