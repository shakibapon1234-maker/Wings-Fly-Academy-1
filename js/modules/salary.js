/* ============================================================
   SALARY HUB MODULE — Wings Fly Aviation Academy
   Phase 10 | Complete Fix — All bugs resolved
   ============================================================
   FIX LIST:
   1.  HR sync → name + baseSalary auto-fill (partial paid-ও sync হয়)
   2.  Partial payment সম্পূর্ণ support — paidAmount accumulate হয়
   3.  Card: Pending / Partial / Paid তিনটি আলাদা status badge
   4.  Progress bar — partial payment এর সঠিক % দেখায়
   5.  Card-এ NET/PAID/DUE সব সময় সঠিক ভ্যালু দেখায়
   6.  Stats bar totalPaid: paid + partial উভয়ই count হয়
   7.  Finance Expense + updateAccountBalance (balance সত্যিই কমে)
   8.  Delete → RecycleBin (staffName সহ সঠিক label)
   9.  Restore → Finance entry + balance পুনরুদ্ধার হয়
   10. Sort: যেই date দিয়ে input সেই date অনুযায়ী, সর্বশেষ সবার উপরে
   11. Bonus দিলে baseSalary কম মনে করে না (bonus আলাদা যোগ)
   12. saveRecord timing bug fix (existing paidAmount আগে পড়া)
   13. History ledger-এ partial paid/due সঠিক
   ============================================================ */

const Salary = (() => {

  let editingId = null;

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */

  function getRecords() {
    const all = SupabaseSync.getAll(DB.salary);
    return all.sort((a, b) => {
      const aDate = a.paidDate || '';
      const bDate = b.paidDate || '';
      if (aDate && bDate) return bDate.localeCompare(aDate);
      if (aDate) return -1;
      if (bDate) return 1;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  function currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(ym) {
    if (!ym) return '—';
    const parts = ym.split('-');
    const y = parts[0]; const m = parts[1];
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return (months[parseInt(m) - 1] || '?') + ' ' + y;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return String(d.getDate()).padStart(2,'0') + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           d.getFullYear();
  }

  function getSelectedMonth() {
    return (document.getElementById('salary-month-picker') || {}).value || currentMonth();
  }

  function calcNet(r) {
    return Utils.safeNum(r.baseSalary) + Utils.safeNum(r.bonus) - Utils.safeNum(r.deduction);
  }

  /* ══════════════════════════════════════════
     HR SYNC
     paid=false মানে pending বা partial — উভয়ই sync করো
  ══════════════════════════════════════════ */
  function syncFromHR(staffId) {
    if (typeof HRStaff === 'undefined') return;
    const staffMember = HRStaff.getAll().find(function(s){ return s.staffId === staffId; });
    if (!staffMember) return;
    SupabaseSync.getAll(DB.salary).forEach(function(r) {
      const matchById   = r.staffId   && r.staffId   === staffMember.staffId;
      const matchByName = !r.staffId  && r.staffName && r.staffName === staffMember.name;
      if ((matchById || matchByName) && !r.paid) {
        SupabaseSync.update(DB.salary, r.id, {
          staffId:    staffMember.staffId,
          staffName:  staffMember.name,
          role:       staffMember.role  || '',
          phone:      staffMember.phone || '',
          baseSalary: Utils.safeNum(staffMember.salary),
        });
      }
    });
  }

  function syncAllFromHR() {
    if (typeof HRStaff === 'undefined') return;
    HRStaff.getAll().forEach(function(s){ syncFromHR(s.staffId); });
    renderContent();
  }

  /* ══════════════════════════════════════════
     FINANCE LOG — Finance Expense + account balance কমানো
  ══════════════════════════════════════════ */
  function _logToFinance(record, payAmount, payDate, method) {
    if (!payAmount || payAmount <= 0) return;
    var entry = {
      type:        'Expense',
      category:    'Salary',
      method:      method || 'Cash',
      description: 'Salary: ' + record.staffName + ' (' + monthLabel(record.month) + ')',
      amount:      payAmount,
      date:        payDate || new Date().toISOString().split('T')[0],
      note:        record.note || '',
      person_name: record.staffName,
    };
    if (typeof Finance !== 'undefined' && typeof Finance.addExternalTransaction === 'function') {
      Finance.addExternalTransaction(entry);
    } else {
      SupabaseSync.insert(DB.finance, entry);
      if (typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(method, payAmount, 'out');
      }
    }
  }

  /* ══════════════════════════════════════════
     DATE DROPDOWN BUILDER
  ══════════════════════════════════════════ */
  function _buildDateDropdowns(prefix, dd, mm, yyyy) {
    var months = [
      ['01','January'],['02','February'],['03','March'],['04','April'],
      ['05','May'],['06','June'],['07','July'],['08','August'],
      ['09','September'],['10','October'],['11','November'],['12','December']
    ];
    var currentYear = new Date().getFullYear();
    var years = [];
    for (var i = 0; i < 6; i++) years.push(currentYear - 2 + i);

    var dayOpts = '';
    for (var d = 1; d <= 31; d++) {
      var v = String(d).padStart(2,'0');
      dayOpts += '<option value="' + v + '"' + (dd === v ? ' selected' : '') + '>' + v + '</option>';
    }
    var mmOpts  = months.map(function(mn){ return '<option value="' + mn[0] + '"' + (mm === mn[0] ? ' selected' : '') + '>' + mn[1] + '</option>'; }).join('');
    var yrOpts  = years.map(function(y){ return '<option value="' + y + '"' + (yyyy === String(y) ? ' selected' : '') + '>' + y + '</option>'; }).join('');

    return '<div style="display:flex; gap:6px;">' +
      '<select id="' + prefix + '-dd" class="form-control" style="flex:0 0 70px;" onchange="Salary._syncPayDate(\'' + prefix + '\')">' + dayOpts + '</select>' +
      '<select id="' + prefix + '-mm" class="form-control" style="flex:1;" onchange="Salary._syncPayDate(\'' + prefix + '\')">' + mmOpts + '</select>' +
      '<select id="' + prefix + '-yyyy" class="form-control" style="flex:0 0 90px;" onchange="Salary._syncPayDate(\'' + prefix + '\')">' + yrOpts + '</select>' +
      '</div>' +
      '<input type="hidden" id="' + prefix + '" value="' + yyyy + '-' + mm + '-' + dd + '" />';
  }

  function _syncPayDate(prefix) {
    var dd   = (document.getElementById(prefix + '-dd')   || {}).value || '';
    var mm   = (document.getElementById(prefix + '-mm')   || {}).value || '';
    var yyyy = (document.getElementById(prefix + '-yyyy') || {}).value || '';
    var hidden = document.getElementById(prefix);
    if (hidden) hidden.value = (yyyy && mm && dd) ? yyyy + '-' + mm + '-' + dd : '';
  }

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function renderContent() {
    var container = document.getElementById('salary-content');
    if (!container) return;

    var cm        = getSelectedMonth();
    var records   = getRecords();
    var thisMonth = records.filter(function(r){ return r.month === cm; });

    var totalBudget = 0, totalPaid = 0;
    thisMonth.forEach(function(r) {
      totalBudget += calcNet(r);
      totalPaid   += Utils.safeNum(r.paidAmount);
    });
    var totalDue = Math.max(0, totalBudget - totalPaid);

    var cardsHTML = '';
    if (thisMonth.length === 0) {
      cardsHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:rgba(0,0,0,0.2); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">' +
        '<i class="fa fa-folder-open" style="font-size:3.5rem; margin-bottom:16px; opacity:.3; display:block; color:var(--brand-primary);"></i>' +
        '<div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No Salary Records for ' + monthLabel(cm) + '</div>' +
        '<div style="color:var(--text-muted); margin-bottom:24px; font-size:.9rem;">HR থেকে সকল active staff-এর জন্য salary sheet তৈরি করুন।</div>' +
        '<button class="btn btn-primary" onclick="Salary.generateMonthlySheet()" style="padding:12px 28px; font-size:1rem; font-weight:700; border-radius:30px; background:linear-gradient(135deg,#00d4ff,#7c3aed); border:none;">' +
        '<i class="fa fa-magic"></i> AUTO-GENERATE FOR ' + monthLabel(cm).toUpperCase() +
        '</button></div>';
    } else {
      cardsHTML = thisMonth.map(function(r) {
        var net         = calcNet(r);
        var paid_amt    = Utils.safeNum(r.paidAmount);
        var due_amt     = Math.max(0, net - paid_amt);
        var progressPct = net > 0 ? Math.min(100, Math.round((paid_amt / net) * 100)) : (r.paid ? 100 : 0);

        var statusLabel = r.paid ? 'Paid' : paid_amt > 0 ? 'Partial' : 'Pending';
        var statusColor = r.paid ? '#00ff88' : paid_amt > 0 ? '#00d4ff' : '#ffb703';
        var statusBg    = r.paid ? 'rgba(0,255,136,0.12)' : paid_amt > 0 ? 'rgba(0,212,255,0.12)' : 'rgba(255,170,0,0.12)';
        var statusIcon  = r.paid ? 'fa-check' : paid_amt > 0 ? 'fa-circle-half-stroke' : 'fa-hourglass-half';
        var barColor    = r.paid ? '#00ff88' : paid_amt > 0 ? '#00d4ff' : 'rgba(255,255,255,0.1)';
        var payBtnLabel = (paid_amt > 0 && !r.paid) ? 'Pay Rest' : 'Pay';
        var dateLabel   = r.paidDate
          ? 'Last Paid: <strong style="color:' + statusColor + ';">' + formatDate(r.paidDate) + '</strong>'
          : 'Month: ' + monthLabel(r.month);

        var payBtn = !r.paid
          ? '<button class="btn btn-primary" style="border-radius:20px; padding:4px 12px; font-size:.82rem;" onclick="Salary.openPayModal(\'' + r.id + '\')">' +
            '<i class="fa fa-sack-dollar"></i> ' + payBtnLabel + '</button>'
          : '';
        var bonusDedRow = (r.bonus || r.deduction)
          ? '<div style="font-size:.72rem; color:var(--text-muted); display:flex; gap:12px;">' +
            (r.bonus    ? '<span style="color:#00d4ff;"><i class="fa fa-plus"></i> Bonus: ৳' + Utils.formatMoneyPlain(r.bonus) + '</span>' : '') +
            (r.deduction ? '<span style="color:#ff4757;"><i class="fa fa-minus"></i> Deduction: ৳' + Utils.formatMoneyPlain(r.deduction) + '</span>' : '') +
            '</div>' : '';

        return '<div class="salary-card" style="background:linear-gradient(135deg,rgba(10,14,35,0.97),rgba(18,10,45,0.97)); border:1px solid rgba(0,212,255,0.18); border-radius:14px; padding:20px; position:relative; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.5);">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
              '<div style="width:40px; height:40px; border-radius:50%; background:rgba(0,212,255,0.15); border:1px solid rgba(0,212,255,0.2); display:flex; align-items:center; justify-content:center;"><i class="fa fa-user" style="color:#00d4ff;"></i></div>' +
              '<div>' +
                '<div style="font-weight:700; color:#fff; font-size:1.05rem;">' + Utils.esc(r.staffName || '—') + '</div>' +
                '<div style="font-size:.78rem; color:var(--text-muted);">' + Utils.esc(r.role || 'Staff') + (r.phone ? ' <i class="fa fa-phone" style="margin:0 4px; opacity:.6;"></i>' + Utils.esc(r.phone) : '') + '</div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">' +
              '<span style="font-size:.72rem; padding:3px 10px; border-radius:12px; background:' + statusBg + '; color:' + statusColor + '; font-weight:700;"><i class="fa ' + statusIcon + '"></i> ' + statusLabel + '</span>' +
              payBtn +
              '<button class="btn btn-secondary" style="border-radius:20px; padding:4px 10px;" onclick="Salary.openEditModal(\'' + r.id + '\')"><i class="fa fa-pen"></i></button>' +
              '<button class="btn btn-secondary" style="border-radius:20px; padding:4px 10px;" onclick="Salary.deleteRecord(\'' + r.id + '\')" title="Delete"><i class="fa fa-trash" style="color:#ff4757;"></i></button>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:16px;">' +
            '<div style="text-align:center; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); padding:10px 6px; border-radius:8px;"><div style="font-size:.62rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">NET SALARY</div><div style="font-weight:700; color:#fff; font-size:.95rem;">৳' + Utils.formatMoneyPlain(net) + '</div></div>' +
            '<div style="text-align:center; background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.12); padding:10px 6px; border-radius:8px;"><div style="font-size:.62rem; color:#00ff88; text-transform:uppercase; margin-bottom:4px;">PAID</div><div style="font-weight:700; color:#00ff88; font-size:.95rem;">৳' + Utils.formatMoneyPlain(paid_amt) + '</div></div>' +
            '<div style="text-align:center; background:' + (due_amt > 0 ? 'rgba(255,170,0,0.12)' : 'rgba(255,255,255,0.06)') + '; border:1px solid ' + (due_amt > 0 ? 'rgba(255,170,0,0.18)' : 'rgba(255,255,255,0.07)') + '; padding:10px 6px; border-radius:8px;"><div style="font-size:.62rem; color:' + (due_amt > 0 ? '#ffb703' : 'var(--text-muted)') + '; text-transform:uppercase; margin-bottom:4px;">DUE</div><div style="font-weight:700; color:' + (due_amt > 0 ? '#ffb703' : '#fff') + '; font-size:.95rem;">৳' + Utils.formatMoneyPlain(due_amt) + '</div></div>' +
          '</div>' +
          '<div style="font-size:.75rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:6px;">' +
            '<span><i class="fa fa-wallet" style="margin-right:4px; opacity:.6;"></i>' + (r.method || '—') + '</span>' +
            '<span><i class="fa fa-calendar" style="margin-right:4px; opacity:.6;"></i>' + dateLabel + '</span>' +
          '</div>' +
          bonusDedRow +
          '<div style="margin-top:12px;">' +
            '<div style="display:flex; justify-content:space-between; font-size:.7rem; color:var(--text-muted); margin-bottom:4px;">' +
              '<span>Payment Progress</span>' +
              '<span style="font-weight:700; color:' + statusColor + ';">' + progressPct + '%</span>' +
            '</div>' +
            '<div style="height:4px; width:100%; background:rgba(255,255,255,0.07); border-radius:2px;">' +
              '<div style="height:100%; border-radius:2px; background:' + barColor + '; width:' + progressPct + '%; transition:width .4s;"></div>' +
            '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    container.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">' +
        '<h2 style="margin:0; font-size:1.5rem; display:flex; align-items:center; gap:8px;"><i class="fa fa-sack-dollar" style="color:var(--brand-primary);"></i> Salary Management Hub</h2>' +
        '<div style="display:flex; gap:12px; flex-wrap:wrap;">' +
          '<button class="btn btn-secondary" onclick="Salary.generateMonthlySheet()"><i class="fa fa-magic" style="color:#ffb703;"></i> AUTO-GENERATE SHEET</button>' +
          '<button class="btn btn-primary" onclick="Salary.openAddModal()" style="border-radius:24px; padding:8px 20px; font-weight:700; background:linear-gradient(135deg,#00d4ff,#7c3aed); border:none;"><i class="fa fa-plus-circle"></i> RECORD PAYMENT</button>' +
          '<button class="btn btn-secondary" onclick="Salary.openHistoryModal()"><i class="fa fa-list"></i> FULL LEDGER</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px; margin-bottom:32px;">' +
        '<div style="border:1px solid rgba(0,212,255,0.25); border-radius:12px; padding:16px; background:rgba(0,5,20,0.7);">' +
          '<div style="font-size:.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTH / YEAR</div>' +
          '<input type="month" id="salary-month-picker" value="' + cm + '" onchange="Salary.renderContent()" style="background:transparent; border:none; color:#fff; font-size:1.1rem; width:100%; outline:none;" />' +
        '</div>' +
        '<div style="border:1px solid rgba(0,212,255,0.25); border-radius:12px; padding:16px; background:rgba(0,5,20,0.7);">' +
          '<div style="font-size:.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTHLY BUDGET</div>' +
          '<div style="font-size:1.6rem; font-weight:800; color:#00d4ff;">৳' + Utils.formatMoneyPlain(totalBudget) + '</div>' +
        '</div>' +
        '<div style="border:1px solid rgba(0,255,136,0.25); border-radius:12px; padding:16px; background:rgba(0,5,20,0.7);">' +
          '<div style="font-size:.75rem; color:#00ff88; text-transform:uppercase; font-weight:700; margin-bottom:8px;">PAID AMOUNT</div>' +
          '<div style="font-size:1.6rem; font-weight:800; color:#00ff88;">৳' + Utils.formatMoneyPlain(totalPaid) + '</div>' +
        '</div>' +
        '<div style="border:1px solid rgba(255,71,87,0.25); border-radius:12px; padding:16px; background:rgba(0,5,20,0.7);">' +
          '<div style="font-size:.75rem; color:#ff4757; text-transform:uppercase; font-weight:700; margin-bottom:8px;">DUE AMOUNT</div>' +
          '<div style="font-size:1.6rem; font-weight:800; color:#ff4757;">৳' + Utils.formatMoneyPlain(totalDue) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px,1fr)); gap:20px; margin-bottom:32px;">' + cardsHTML + '</div>' +
      '<div style="text-align:center; margin-top:20px;">' +
        '<button class="btn btn-secondary" style="border:none; color:#00d4ff; font-weight:700; background:transparent;" onclick="Salary.openHistoryModal()">' +
          '<i class="fa fa-list"></i> VIEW ALL PREVIOUS MONTHS HISTORY (FULL LEDGER)' +
        '</button>' +
      '</div>';
  }

  /* ══════════════════════════════════════════
     GENERATE MONTHLY SHEET
  ══════════════════════════════════════════ */
  function generateMonthlySheet() {
    var month       = getSelectedMonth();
    var records     = getRecords();
    var existingIds = records.filter(function(r){ return r.month === month; }).map(function(r){ return r.staffId; });
    var allStaff    = (typeof HRStaff !== 'undefined') ? HRStaff.getAll() : [];
    var activeStaff = allStaff.filter(function(s){ return s.status === 'Active' && existingIds.indexOf(s.staffId) === -1; });

    if (!activeStaff.length) {
      Utils.toast(existingIds.length ? 'All active staff sheets already created ✓' : 'No active staff found in HR', 'info');
      return;
    }
    activeStaff.forEach(function(s) {
      SupabaseSync.insert(DB.salary, {
        staffId: s.staffId, staffName: s.name, role: s.role || '', phone: s.phone || '',
        month: month, baseSalary: Utils.safeNum(s.salary),
        bonus: 0, deduction: 0, paidAmount: 0,
        paid: false, paidDate: '', method: 'Cash', note: '',
      });
    });
    renderContent();
    Utils.toast(activeStaff.length + ' salary sheets created ✓', 'success');
  }

  /* ══════════════════════════════════════════
     PAY MODAL
  ══════════════════════════════════════════ */
  function openPayModal(id) {
    var r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;

    var net       = calcNet(r);
    var prevPaid  = Utils.safeNum(r.paidAmount);
    var remaining = Math.max(0, net - prevPaid);

    var today     = new Date();
    var todayDD   = String(today.getDate()).padStart(2,'0');
    var todayMM   = String(today.getMonth()+1).padStart(2,'0');
    var todayYYYY = String(today.getFullYear());

    var prevPaidInfo = prevPaid > 0
      ? '<div style="font-size:.72rem; color:#ffb703; margin-top:2px;">আগে দেওয়া: ৳' + Utils.formatMoneyPlain(prevPaid) + ' &nbsp;|&nbsp; বাকি: ৳' + Utils.formatMoneyPlain(remaining) + '</div>'
      : '';

    var html =
      '<div style="margin-bottom:20px;">' +
        '<div style="background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:10px; padding:16px; margin-bottom:20px;">' +
          '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div style="width:44px; height:44px; border-radius:50%; background:rgba(0,212,255,0.15); display:flex; align-items:center; justify-content:center;"><i class="fa fa-user" style="color:#00d4ff; font-size:1.2rem;"></i></div>' +
            '<div><div style="font-weight:800; color:#fff; font-size:1.1rem;">' + Utils.esc(r.staffName) + '</div>' +
            '<div style="font-size:.8rem; color:#00d4ff;">' + Utils.esc(r.role || 'Staff') + ' &nbsp;|&nbsp; ' + monthLabel(r.month) + '</div></div>' +
            '<div style="margin-left:auto; text-align:right;">' +
              '<div style="font-size:.7rem; color:var(--text-muted);">Net Salary</div>' +
              '<div style="font-size:1.3rem; font-weight:800; color:#00ff88;">৳' + Utils.formatMoneyPlain(net) + '</div>' +
              prevPaidInfo +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Payment Amount (৳) <span class="req">*</span></label>' +
            '<input type="number" id="pay-amount" class="form-control" min="1" value="' + remaining + '" placeholder="Enter amount to pay" />' +
            '<div style="font-size:.72rem; color:var(--text-muted); margin-top:4px;">Partial বা full যেকোনো amount দিতে পারেন</div>' +
          '</div>' +
          '<div class="form-group"><label>Payment Date <span class="req">*</span></label>' + _buildDateDropdowns('pay-date', todayDD, todayMM, todayYYYY) + '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Payment Method <span class="req">*</span></label>' +
            '<select id="pay-method" class="form-control" onchange="Utils.onPaymentMethodChange && Utils.onPaymentMethodChange(this,\'pay-bal-display\')">' + Utils.getPaymentMethodsHTML(r.method) + '</select>' +
            '<div id="pay-bal-display" style="display:none;"></div></div>' +
          '<div class="form-group"><label>Note</label><input type="text" id="pay-note" class="form-control" placeholder="Optional remarks" value="' + (r.note || '') + '" /></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-actions" style="justify-content:flex-end; margin-top:10px;">' +
        '<button class="btn-secondary" style="border-radius:24px; padding:10px 24px; font-weight:700; color:#fff; background:rgba(255,255,255,0.1); border:none;" onclick="Utils.closeModal()">CANCEL</button>' +
        '<button class="btn-primary" style="border-radius:24px; padding:10px 24px; font-weight:700; border:none; color:#fff; background:linear-gradient(135deg,#00d4ff,#7c3aed);" onclick="Salary.confirmPay(\'' + id + '\')">' +
          '<i class="fa fa-sack-dollar"></i> CONFIRM PAYMENT</button>' +
      '</div>';

    Utils.openModal('<i class="fa fa-sack-dollar" style="color:#00d4ff;"></i> Pay Salary — ' + r.staffName, html);
  }

  function confirmPay(id) {
    var r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;

    var payAmount = Utils.safeNum((document.getElementById('pay-amount') || {}).value);
    var payDate   = (document.getElementById('pay-date') || {}).value;
    var method    = (document.getElementById('pay-method') || {}).value;
    var note      = ((document.getElementById('pay-note') || {}).value || '').trim();

    if (!payAmount || payAmount <= 0) { Utils.toast('Valid payment amount দিন', 'error'); return; }
    if (!method)   { Utils.toast('Payment method select করুন', 'error'); return; }
    if (!payDate)  { Utils.toast('Payment date দিন', 'error'); return; }

    var available = Utils.getAccountBalance ? Utils.getAccountBalance(method) : Infinity;
    if (payAmount > available) {
      Utils.toast(method + '-এ যথেষ্ট balance নেই। Available: ৳' + Utils.formatMoneyPlain(available), 'error');
      return;
    }

    var net        = calcNet(r);
    var prevPaid   = Utils.safeNum(r.paidAmount);
    var totalPaid  = prevPaid + payAmount;
    var isFullyPaid = totalPaid >= net;

    SupabaseSync.update(DB.salary, id, {
      paid:       isFullyPaid,
      paidAmount: totalPaid,
      paidDate:   payDate,
      method:     method,
      note:       note || r.note || '',
    });

    _logToFinance(r, payAmount, payDate, method);

    Utils.closeModal();
    renderContent();
    var statusMsg = isFullyPaid
      ? 'পুরো salary paid ✓'
      : 'partial ৳' + Utils.formatMoneyPlain(payAmount) + ' paid — বাকি ৳' + Utils.formatMoneyPlain(net - totalPaid);
    Utils.toast(r.staffName + ': ' + statusMsg, isFullyPaid ? 'success' : 'info');
  }

  function markPaid(id) { openPayModal(id); }

  /* ══════════════════════════════════════════
     ADD / EDIT MODALS
  ══════════════════════════════════════════ */
  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-sack-dollar" style="color:#00d4ff;"></i> RECORD SALARY PAYMENT', formHTML(null));
  }

  function openEditModal(id) {
    editingId = id;
    var r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;
    Utils.openModal('<i class="fa fa-pen" style="color:#00d4ff;"></i> EDIT SALARY RECORD', formHTML(r));
  }

  function formHTML(r) {
    var allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll().filter(function(s){ return s.status === 'Active'; }) : [];
    var net = r ? calcNet(r) : 0;

    var pd      = (r && r.paidDate) ? r.paidDate : Utils.today();
    var pd_d    = new Date(pd);
    var pd_dd   = String(pd_d.getDate()).padStart(2,'0');
    var pd_mm   = String(pd_d.getMonth()+1).padStart(2,'0');
    var pd_yyyy = String(pd_d.getFullYear());

    var staffOpts = '<option value="">-- HR থেকে Staff বেছে নিন --</option>' +
      allStaff.map(function(s) {
        return '<option value="' + s.staffId + '"' + (r && r.staffId === s.staffId ? ' selected' : '') +
          ' data-name="' + Utils.esc(s.name) + '"' +
          ' data-role="' + (s.role || '') + '"' +
          ' data-phone="' + (s.phone || '') + '"' +
          ' data-salary="' + Utils.safeNum(s.salary) + '">' +
          s.staffId + ' — ' + s.name + ' (৳' + Utils.formatMoneyPlain(s.salary) + ')' +
          '</option>';
      }).join('');

    return '<div style="margin-bottom:20px;">' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Select Staff <span class="req">*</span></label>' +
            '<select id="sal-staff" class="form-control" onchange="Salary.onStaffSelect()">' + staffOpts + '</select>' +
            '<div id="sal-staff-info" style="display:' + (r && r.staffId ? 'block' : 'none') + '; margin-top:8px; background:rgba(0,212,255,0.07); border:1px solid rgba(0,212,255,0.2); border-radius:8px; padding:10px; font-size:.8rem; color:#00d4ff;">' +
              '<i class="fa fa-circle-check" style="margin-right:6px;"></i><strong id="sal-info-name">' + (r ? (r.staffName || '') : '') + '</strong> — Basic Salary: <strong id="sal-info-salary">৳' + Utils.formatMoneyPlain(r ? (r.baseSalary || 0) : 0) + '</strong>' +
            '</div>' +
          '</div>' +
          '<div class="form-group"><label>Month <span class="req">*</span></label>' +
            '<input type="month" id="sal-month" class="form-control" value="' + (r ? (r.month || getSelectedMonth()) : getSelectedMonth()) + '" /></div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:20px;">' +
        '<div style="font-size:.74rem; color:var(--text-muted); font-weight:700; letter-spacing:1px; margin-bottom:12px;">FINANCIAL DETAILS</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Basic Salary (৳) <span style="font-size:.7rem; color:#00d4ff;">[HR থেকে auto-fill]</span></label>' +
            '<input type="number" id="sal-base" class="form-control" min="0" value="' + (r ? (r.baseSalary || '') : '') + '" placeholder="0" oninput="Salary.updateNetDisplay()" /></div>' +
          '<div class="form-group"><label>Bonus (৳) <span style="font-size:.7rem; color:#00d4ff;">[baseSalary-এর বাইরে]</span></label>' +
            '<input type="number" id="sal-bonus" class="form-control" min="0" value="' + (r ? (r.bonus || 0) : 0) + '" oninput="Salary.updateNetDisplay()" /></div>' +
          '<div class="form-group"><label>Deduction (৳)</label>' +
            '<input type="number" id="sal-deduction" class="form-control" min="0" value="' + (r ? (r.deduction || 0) : 0) + '" oninput="Salary.updateNetDisplay()" /></div>' +
        '</div>' +
        '<div id="sal-net-display" style="text-align:right; font-size:.85rem; color:#00ff88; font-weight:700; margin-top:4px;">Net Salary: ৳' + Utils.formatMoneyPlain(net) + '</div>' +
      '</div>' +
      '<div style="margin-bottom:20px;">' +
        '<div style="font-size:.74rem; color:var(--text-muted); font-weight:700; letter-spacing:1px; margin-bottom:12px;">PAYMENT INFO</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Payment Amount (৳)</label>' +
            '<input type="number" id="sal-pay-amount" class="form-control" min="0" value="' + (r && r.paidAmount !== undefined ? r.paidAmount : '') + '" placeholder="Actual amount paid so far" />' +
            '<div style="font-size:.7rem; color:var(--text-muted); margin-top:3px;">Net salary-এর থেকে আলাদা হতে পারে (partial / advance)</div></div>' +
          '<div class="form-group"><label>Payment Date</label>' + _buildDateDropdowns('sal-paiddate', pd_dd, pd_mm, pd_yyyy) + '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Payment Method <span class="req">*</span></label>' +
            '<select id="sal-method" class="form-control" onchange="Utils.onPaymentMethodChange && Utils.onPaymentMethodChange(this,\'sal-bal-display\')">' +
              '<option value="">Select Method…</option>' + Utils.getPaymentMethodsHTML(r ? r.method : null) +
            '</select><div id="sal-bal-display" style="display:none;"></div></div>' +
          '<div class="form-group"><label>Pay Status</label>' +
            '<select id="sal-paid" class="form-control">' +
              '<option value="0"' + (r && !r.paid ? ' selected' : '') + '>Due / Pending</option>' +
              '<option value="1"' + (r && r.paid ? ' selected' : '') + '>Paid (Full)</option>' +
            '</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group full-width"><label>Notes</label>' +
        '<textarea id="sal-note" class="form-control" rows="2" placeholder="Any remarks…">' + (r ? (r.note || '') : '') + '</textarea></div>' +
      '<div class="form-actions" style="justify-content:flex-end; margin-top:10px;">' +
        '<button class="btn-secondary" style="border-radius:24px; padding:10px 24px; font-weight:700; color:#fff; background:rgba(255,255,255,0.1); border:none;" onclick="Utils.closeModal()">CANCEL</button>' +
        '<button class="btn-primary" style="border-radius:24px; padding:10px 24px; font-weight:700; border:none; color:#fff; background:linear-gradient(135deg,#00d4ff,#7c3aed);" onclick="Salary.saveRecord()"><i class="fa fa-floppy-disk"></i> SAVE RECORD</button>' +
      '</div>';
  }

  function updateNetDisplay() {
    var base = Utils.safeNum((document.getElementById('sal-base')      || {}).value);
    var bon  = Utils.safeNum((document.getElementById('sal-bonus')     || {}).value);
    var ded  = Utils.safeNum((document.getElementById('sal-deduction') || {}).value);
    var net  = base + bon - ded;
    var el   = document.getElementById('sal-net-display');
    if (el) el.innerHTML = 'Net Salary: ৳' + Utils.formatMoneyPlain(net);
    var payEl = document.getElementById('sal-pay-amount');
    if (payEl && !payEl.dataset.touched) payEl.value = net > 0 ? net : '';
  }

  function onStaffSelect() {
    var sel = document.getElementById('sal-staff');
    var opt = sel && sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      var ib = document.getElementById('sal-staff-info');
      if (ib) ib.style.display = 'none';
      return;
    }
    var salary = Utils.safeNum(opt.dataset.salary);
    var baseEl = document.getElementById('sal-base');
    if (baseEl) { baseEl.value = salary; baseEl.dispatchEvent(new Event('input')); }
    var infoBox = document.getElementById('sal-staff-info');
    if (infoBox) {
      document.getElementById('sal-info-name').textContent   = opt.dataset.name || '';
      document.getElementById('sal-info-salary').textContent = '৳' + Utils.formatMoneyPlain(salary);
      infoBox.style.display = 'block';
    }
    updateNetDisplay();
  }

  /* ══════════════════════════════════════════
     SAVE RECORD
     - Timing bug fix: existingRecord update এর আগে পড়া হয়
     - Bonus → baseSalary কম মনে করে না
     - Finance diff = এই বারের নতুন amount মাত্র
  ══════════════════════════════════════════ */
  function saveRecord() {
    var staffSel = document.getElementById('sal-staff');
    var staffId  = staffSel && staffSel.value;
    var staffOpt = staffSel && staffSel.options[staffSel.selectedIndex];
    var method   = (document.getElementById('sal-method') || {}).value;

    if (!staffId) { Utils.toast('Staff select করুন', 'error'); return; }
    if (!method)  { Utils.toast('Payment Method select করুন', 'error'); return; }

    var base      = Utils.safeNum((document.getElementById('sal-base')      || {}).value);
    var bonus     = Utils.safeNum((document.getElementById('sal-bonus')     || {}).value);
    var deduction = Utils.safeNum((document.getElementById('sal-deduction') || {}).value);
    var net       = base + bonus - deduction;
    var payAmount = Utils.safeNum((document.getElementById('sal-pay-amount') || {}).value);
    var isPaid    = (document.getElementById('sal-paid') || {}).value === '1';
    var payDate   = (document.getElementById('sal-paiddate') || {}).value || Utils.today();

    if (isPaid && payAmount > 0) {
      var available = Utils.getAccountBalance ? Utils.getAccountBalance(method) : Infinity;
      if (payAmount > available) {
        Utils.toast(method + '-এ যথেষ্ট balance নেই। Available: ৳' + Utils.formatMoneyPlain(available), 'error');
        return;
      }
    }

    /* timing bug fix: update এর আগে existing পড়ো */
    var existingRecord = editingId ? SupabaseSync.getById(DB.salary, editingId) : null;
    var prevPaidAmt    = Utils.safeNum(existingRecord && existingRecord.paidAmount);

    var autoFullyPaid = (payAmount >= net && net > 0);

    var entry = {
      staffId:    staffId,
      staffName:  (staffOpt && staffOpt.dataset.name)  || (existingRecord && existingRecord.staffName) || '',
      role:       (staffOpt && staffOpt.dataset.role)  || (existingRecord && existingRecord.role)       || '',
      phone:      (staffOpt && staffOpt.dataset.phone) || (existingRecord && existingRecord.phone)      || '',
      month:      (document.getElementById('sal-month') || {}).value || getSelectedMonth(),
      baseSalary: base,
      bonus:      bonus,
      deduction:  deduction,
      paidAmount: payAmount,
      method:     method,
      paid:       isPaid || autoFullyPaid,
      paidDate:   (isPaid || payAmount > 0) ? payDate : '',
      note:       ((document.getElementById('sal-note') || {}).value || '').trim(),
    };

    var isNew = !editingId;
    if (editingId) {
      SupabaseSync.update(DB.salary, editingId, entry);
      Utils.toast('Salary record updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.salary, entry);
      Utils.toast('Salary record saved ✓', 'success');
    }

    var diff = isNew ? payAmount : Math.max(0, payAmount - prevPaidAmt);
    if (diff > 0) _logToFinance(entry, diff, payDate, method);

    Utils.closeModal();
    renderContent();
    editingId = null;
  }

  /* ══════════════════════════════════════════
     DELETE → RECYCLE BIN
     supabase-sync.js _recycleDisplayName() 'r.name' দেখে।
     salary record-এ 'name' field নেই — তাই সেট করে দিই।
  ══════════════════════════════════════════ */
  async function deleteRecord(id) {
    var r = SupabaseSync.getById(DB.salary, id);
    var ok = await Utils.confirm(
      (r ? r.staffName : 'এই') + '-এর salary record মুছে দেবেন? RecycleBin-এ যাবে।',
      'Delete Salary Record'
    );
    if (!ok) return;

    if (r && !r.name && r.staffName) {
      SupabaseSync.update(DB.salary, id, { name: r.staffName });
    }

    SupabaseSync.remove(DB.salary, id);
    renderContent();
    Utils.toast((r ? r.staffName : 'Record') + ' — RecycleBin-এ গেছে', 'warning');
  }

  /* ══════════════════════════════════════════
     FULL HISTORY MODAL
  ══════════════════════════════════════════ */
  function openHistoryModal() {
    var records = getRecords();

    var rows = '';
    if (records.length) {
      rows = records.map(function(r) {
        var net       = calcNet(r);
        var paid_amt  = Utils.safeNum(r.paidAmount);
        var due_amt   = Math.max(0, net - paid_amt);
        var statusLabel = r.paid ? 'Paid' : paid_amt > 0 ? 'Partial' : 'Due';
        var statusCls   = r.paid ? 'badge-success' : paid_amt > 0 ? 'badge-info' : 'badge-warning';
        var statusIcon  = r.paid ? 'fa-check' : paid_amt > 0 ? 'fa-circle-half-stroke' : 'fa-hourglass-half';
        var actionBtn   = !r.paid
          ? '<button class="btn btn-primary" style="padding:4px 10px; font-size:.78rem; border-radius:20px;" onclick="Salary.openPayModal(\'' + r.id + '\'); Utils.closeModal()"><i class="fa fa-sack-dollar"></i> ' + (paid_amt > 0 ? 'Pay Rest' : 'Pay') + '</button>'
          : '<span style="font-size:.75rem; color:var(--text-muted);"><i class="fa fa-check-circle" style="color:#00ff88;"></i> Done</span>';
        return '<tr>' +
          '<td style="font-weight:700; color:' + (r.paid ? '#00ff88' : paid_amt > 0 ? '#00d4ff' : '#ffb703') + ';">' + (r.paidDate ? formatDate(r.paidDate) : '—') + '</td>' +
          '<td style="color:#00d4ff; font-weight:700;">' + monthLabel(r.month) + '</td>' +
          '<td><div style="font-weight:700; color:#fff;">' + Utils.esc(r.staffName || '—') + '</div><div style="font-size:.73rem; color:var(--text-muted);">' + Utils.esc(r.role || 'Staff') + '</div></td>' +
          '<td>৳' + Utils.formatMoneyPlain(r.baseSalary || 0) + '</td>' +
          '<td style="color:#00d4ff;">' + (r.bonus ? '৳' + Utils.formatMoneyPlain(r.bonus) : '—') + '</td>' +
          '<td style="color:#ff4757;">' + (r.deduction ? '৳' + Utils.formatMoneyPlain(r.deduction) : '—') + '</td>' +
          '<td style="font-weight:700;">৳' + Utils.formatMoneyPlain(net) + '</td>' +
          '<td style="font-weight:700; color:#00ff88;">৳' + Utils.formatMoneyPlain(paid_amt) + '</td>' +
          '<td style="font-weight:700; color:' + (due_amt > 0 ? '#ffb703' : 'var(--text-muted)') + ';">' + (due_amt > 0 ? '৳' + Utils.formatMoneyPlain(due_amt) : '—') + '</td>' +
          '<td><span class="badge ' + statusCls + '" style="font-size:.72rem;"><i class="fa ' + statusIcon + '"></i> ' + statusLabel + '</span></td>' +
          '<td style="font-size:.8rem;">' + (r.method || '—') + '</td>' +
          '<td>' + actionBtn + '</td>' +
          '</tr>';
      }).join('');
    } else {
      rows = '<tr><td colspan="12" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa fa-folder-open" style="font-size:2rem; display:block; opacity:.3; margin-bottom:8px;"></i>No salary history found</td></tr>';
    }

    var html =
      '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
        '<th>Payment Date</th><th>Month</th><th>Staff Name</th>' +
        '<th>Basic</th><th>Bonus</th><th>Deduction</th><th>Net</th>' +
        '<th>Paid</th><th>Due</th><th>Status</th><th>Method</th><th>Action</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="form-actions" style="justify-content:flex-end; margin-top:16px;">' +
        '<button class="btn-secondary" onclick="Salary.exportExcel(); Utils.closeModal()"><i class="fa fa-file-excel"></i> Export Excel</button>' +
        '<button class="btn-primary" onclick="Utils.closeModal()">CLOSE</button>' +
      '</div>';

    Utils.openModal('<i class="fa fa-list"></i> Full Global Salary Ledger', html, 'modal-lg');
  }

  /* ══════════════════════════════════════════
     EXPORT EXCEL
  ══════════════════════════════════════════ */
  function exportExcel() {
    var records = getRecords();
    if (!records.length) { Utils.toast('No data to export', 'error'); return; }
    var rows = records.map(function(r) {
      var net      = calcNet(r);
      var paid_amt = Utils.safeNum(r.paidAmount);
      return {
        'Payment Date': r.paidDate ? formatDate(r.paidDate) : '—',
        'Month':        monthLabel(r.month),
        'Staff ID':     r.staffId    || '',
        'Name':         r.staffName  || '',
        'Role':         r.role       || '',
        'Basic Salary': r.baseSalary || 0,
        'Bonus':        r.bonus      || 0,
        'Deduction':    r.deduction  || 0,
        'Net Salary':   net,
        'Paid Amount':  paid_amt,
        'Due Amount':   Math.max(0, net - paid_amt),
        'Method':       r.method     || '',
        'Status':       r.paid ? 'Paid' : paid_amt > 0 ? 'Partial' : 'Due',
        'Note':         r.note       || '',
      };
    });
    Utils.exportExcel(rows, 'Salary_All', 'Salary Ledger');
  }

  /* ══════════════════════════════════════════
     DASHBOARD SUMMARY
  ══════════════════════════════════════════ */
  function getSummary() {
    var cm = currentMonth();
    var thisMonth = getRecords().filter(function(r){ return r.month === cm; });
    return {
      totalBudget:  thisMonth.reduce(function(s,r){ return s + calcNet(r); }, 0),
      totalPaid:    thisMonth.reduce(function(s,r){ return s + Utils.safeNum(r.paidAmount); }, 0),
      count:        thisMonth.length,
      pendingCount: thisMonth.filter(function(r){ return !r.paid; }).length,
    };
  }

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */
  return {
    init: renderContent, render: renderContent, renderContent: renderContent,
    openAddModal: openAddModal, openEditModal: openEditModal,
    openPayModal: openPayModal, confirmPay: confirmPay,
    openHistoryModal: openHistoryModal,
    saveRecord: saveRecord, markPaid: markPaid, deleteRecord: deleteRecord,
    generateMonthlySheet: generateMonthlySheet, exportExcel: exportExcel,
    onStaffSelect: onStaffSelect, updateNetDisplay: updateNetDisplay,
    syncFromHR: syncFromHR, syncAllFromHR: syncAllFromHR,
    _syncPayDate: _syncPayDate, getSummary: getSummary,
  };

})();
window.Salary = Salary;
