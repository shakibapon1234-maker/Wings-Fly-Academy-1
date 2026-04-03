// sections/student-management.js
// Wings Fly Aviation Academy
// STUDENT MANAGEMENT — Extracted from app.js (Phase 3)
// =====================================================

// RENDER STUDENT TABLE
// ===================================

function render(students) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  // Fallback: if caller doesn't pass an array, use globalData.students
  if (!Array.isArray(students)) {
    const gd = (typeof window !== 'undefined' && window.globalData)
      ? window.globalData
      : (typeof globalData !== 'undefined' ? globalData : null);
    students = (gd && Array.isArray(gd.students)) ? gd.students : [];
  }

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5">
          <div class="text-muted">
            <h5>No students found</h5>
            <p>Add your first student to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Calculate true index for each student (BEFORE reverse)
  const displayStudents = students.map((s, displayIndex) => {
    const realIndex = globalData.students.indexOf(s);
    const finalIndex = realIndex >= 0 ? realIndex : globalData.students.findIndex(gs => gs.studentId && gs.studentId === s.studentId);
    // trueIndex is the globalData.students array position
    // rowIndex will be recalculated after reverse
    return { ...s, trueIndex: finalIndex, originalIndex: displayIndex };
  });

  // ✅ FIX: Date অনুযায়ী sort করো — latest enrollment সবার উপরে
  // (simple reverse নয় — enrollment date দিয়ে sort)
  displayStudents.sort(function(a, b) {
    var da = String(a.enrollmentDate || a.joiningDate || a.date || '').slice(0, 10);
    var db = String(b.enrollmentDate || b.joiningDate || b.date || '').slice(0, 10);
    if (db > da) return 1;
    if (db < da) return -1;
    return (b.trueIndex || 0) - (a.trueIndex || 0);
  });

  // Now add correct rowIndex based on actual globalData position
  displayStudents.forEach((s, i) => {
    s.rowIndex = s.trueIndex; // Use trueIndex as rowIndex (points to globalData.students position)
  });

  // ── HELPER: single student row HTML ──────────────────────
  function _renderStudentRow(s) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const isOverdue = s.reminderDate && s.reminderDate < today && (parseFloat(s.due) > 0);
    const isToday = s.reminderDate && s.reminderDate === today && (parseFloat(s.due) > 0);
    const isFuture = s.reminderDate && s.reminderDate > today && (parseFloat(s.due) > 0);

    let reminderBadge = '';
    if (isOverdue) {
      reminderBadge = `<span class="badge bg-danger text-white ms-2 pulse-red" title="OVERDUE: ${s.reminderDate}">🔔 Overdue</span>`;
    } else if (isToday) {
      reminderBadge = `<span class="badge bg-warning text-dark ms-2" title="DUE TODAY: ${s.reminderDate}">🔔 Today</span>`;
    } else if (isFuture) {
      reminderBadge = `<span class="badge bg-info-subtle text-info ms-2" title="Reminder: ${s.reminderDate}">🔔 Upcoming</span>`;
    }

    // === STUDENT PHOTO OR INITIAL ===
    let studentAvatar = '';
    if (s.photo) {
      // ✅ FIX: base64 হলে সরাসরি দেখাও; old key format হলে initial দেখাও (migration হলে auto-fix)
      const isBase64Photo = s.photo.startsWith('data:image');
      if (isBase64Photo) {
        studentAvatar = `
          <img src="${s.photo}" 
               alt="${s.name}" 
               class="rounded-circle" 
               style="width: 38px; height: 38px; object-fit: cover; border: 2px solid #00d9ff;"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="rounded-circle align-items-center justify-content-center fw-bold" 
               style="width: 38px; height: 38px; font-size: 1rem; display: none; background: rgba(0, 217, 255, 0.15); color: #00fff5; border: 1.5px solid rgba(0, 217, 255, 0.5); text-shadow: 0 0 5px rgba(0, 217, 255, 0.5);">
            ${(s.name || 'S').charAt(0).toUpperCase()}
          </div>
        `;
        // Trigger migration in background (old key format এর জন্য)
      } else {
        // Old key format — getStudentPhotoSrc দিয়ে async migrate করো, এখন initial দেখাও
        getStudentPhotoSrc(s.photo); // triggers background migration
        studentAvatar = `
          <div class="rounded-circle align-items-center justify-content-center fw-bold" 
               style="width: 38px; height: 38px; font-size: 1rem; display: flex; background: rgba(0, 217, 255, 0.15); color: #00fff5; border: 1.5px solid rgba(0, 217, 255, 0.5); text-shadow: 0 0 5px rgba(0, 217, 255, 0.5);">
            ${(s.name || 'S').charAt(0).toUpperCase()}
          </div>
        `;
      }
    } else {
      // If no photo, show initial letter
      studentAvatar = `
        <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" 
             style="width: 38px; height: 38px; font-size: 1rem; background: rgba(0, 217, 255, 0.15); color: #00fff5; border: 1.5px solid rgba(0, 217, 255, 0.5); text-shadow: 0 0 5px rgba(0, 217, 255, 0.5);">
          ${(s.name || 'S').charAt(0).toUpperCase()}
        </div>
      `;
    }

    const row = `
      <tr>
        <td class="small text-muted">${s.enrollDate || '-'}</td>
        <td class="small fw-semibold text-secondary">${s.studentId || '-'}</td>
        <td>
          <div class="d-flex align-items-center gap-3">
            ${studentAvatar}
            <div>
              <a href="javascript:void(0)" onclick="openStudentProfile(${s.rowIndex})" class="text-decoration-none text-dark fw-bold hover-primary">
                ${s.name}
              </a>
              <div class="d-flex align-items-center mt-1">
                ${reminderBadge}
              </div>
            </div>
          </div>
        </td>
        <td><span class="badge bg-light text-dark border fw-semibold">${s.course}</span></td>
        <td class="small">${s.batch || 'N/A'}</td>
        <td class="fw-bold">৳${formatNumber(s.totalPayment || 0)}</td>
        <td class="text-success fw-bold">৳${formatNumber(s.paid || 0)}</td>
        <td class="text-danger fw-bold">৳${formatNumber(s.due || 0)}</td>
        <td class="small text-muted">
            ${s.remarks ? `<span class="badge bg-secondary-subtle text-secondary border" title="${s.remarks}">${s.remarks.substring(0, 15)}${s.remarks.length > 15 ? '...' : ''}</span>` : '-'}
        </td>
        <td>
            <button class="btn btn-light btn-sm rounded-pill px-3 border shadow-sm" type="button" onclick="openStudentActionsModal(${s.trueIndex})">
               <i class="bi bi-three-dots-vertical"></i> Manage
            </button>
        </td>
      </tr>
    `;
    tbody.innerHTML += row;
  } // end _renderStudentRow

  // ── PAGINATION ────────────────────────────────────────────
  if (typeof WFPaginator === 'function') {
    // আগের pageSize মনে রাখো — filter/search এ reset হবে না
    const existingPg = window._wfPaginators && window._wfPaginators['students'];
    const pageSize   = existingPg ? existingPg.pageSize : 20;

    const pg = new WFPaginator(displayStudents, pageSize);
    if (!window._wfPaginators) window._wfPaginators = {};
    window._wfPaginators['students'] = pg;

    // pagination bar container — table এর নিচে একবার তৈরি হয়
    let pgContainer = document.getElementById('studentPaginationBar');
    if (!pgContainer) {
      pgContainer = document.createElement('div');
      pgContainer.id = 'studentPaginationBar';
      const tableWrap = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement || tbody.parentElement;
      if (tableWrap) tableWrap.insertAdjacentElement('afterend', pgContainer);
    }

    function _drawPage(page) {
      tbody.innerHTML = '';
      pg.getPage(page).forEach(s => _renderStudentRow(s));

      renderPaginationBar('studentPaginationBar', pg, function (newPage) {
        _drawPage(newPage);
        if (typeof scrollToTableTop === 'function') scrollToTableTop('tableBody');
      }, { pageSizes: [10, 20, 50, 100] });
    }

    _drawPage(1);

  } else {
    // WFPaginator না থাকলে সব একসাথে দেখাও (fallback)
    displayStudents.forEach(s => _renderStudentRow(s));
  }

  // ✅ UPDATE TABLE FOOTER TOTALS (সবসময় full data দিয়ে)
  updateTableFooter(students);

  // ✅ AUTO-POPULATE BATCH FILTER DROPDOWN
  populateBatchFilter();
}

function updateTableFooter(students) {
  // Calculate totals from displayed students
  const totalPayable = students.reduce((sum, s) => sum + (parseFloat(s.totalPayment) || 0), 0);
  const totalPaid = students.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0);
  const totalDue = students.reduce((sum, s) => sum + (parseFloat(s.due) || 0), 0);

  // Update footer display
  document.getElementById('footerTotalPayable').innerText = '৳' + formatNumber(totalPayable);
  document.getElementById('footerTotalPaid').innerText = '৳' + formatNumber(totalPaid);
  document.getElementById('footerTotalDue').innerText = '৳' + formatNumber(totalDue);

  // ✅ FIX: studentCount badge সবসময় update করো
  const countBadge = document.getElementById('studentCount');
  if (countBadge) {
    const n = students.length;
    countBadge.textContent = `${n} STUDENT${n !== 1 ? 'S' : ''}`;
  }
}

// ===================================
// RENDER FINANCIAL LEDGER
// ===================================

function renderLedger(transactions) {
  const tbody = document.getElementById('ledgerTableBody');
  tbody.innerHTML = '';

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No transactions found</td></tr>';
    return;
  }

  // ✅ FIX: Date অনুযায়ী sort করো — latest date সবার উপরে
  // getSortableDate দিয়ে সব format (DD-MM-YYYY, YYYY-MM-DD) সঠিকভাবে sort হবে
  const displayItems = [...transactions].sort(function(a, b) {
    var da = (typeof window.getSortableDate === 'function') ? window.getSortableDate(a.date || a.createdAt || '') : String(a.date || a.createdAt || '').slice(0, 10);
    var db = (typeof window.getSortableDate === 'function') ? window.getSortableDate(b.date || b.createdAt || '') : String(b.date || b.createdAt || '').slice(0, 10);
    if (db > da) return 1;
    if (db < da) return -1;
    // Same date হলে id (timestamp) দিয়ে sort — নতুনটা আগে
    return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
  });

  function _buildLedgerRow(f, idx) {
    if (!f.id) f.id = 'FIN-' + Date.now() + '-' + idx;
    const amt = parseFloat(f.amount) || 0;
    // ✅ FIX: Loan / Transfer — শুধু display হবে, income/expense color নয়
    const STAT_IN  = window.FE_STAT_INCOME  || ['Income', 'Registration', 'Refund'];
    const STAT_OUT = window.FE_STAT_EXPENSE || ['Expense', 'Salary', 'Rent', 'Utilities'];
    const isStatIncome  = STAT_IN.includes(f.type);
    const isStatExpense = STAT_OUT.includes(f.type);
    const isLoan     = (f.type === 'Loan Given' || f.type === 'Loan Received' || f.type === 'Loan Giving' || f.type === 'Loan Receiving');
    const isTransfer = (f.type === 'Transfer In' || f.type === 'Transfer Out');
    // Color: income=green, expense=red, loan/transfer=neutral (info)
    const amtClass = isStatIncome ? 'text-success' : isStatExpense ? 'text-danger' : 'text-info';
    return `
      <tr>
        <td>${(typeof window.displayDate === 'function' ? window.displayDate(f.date) : (f.date || 'N/A'))}</td>
        <td><span class="badge ${f.type.includes('Transfer') ? 'bg-warning' : 'bg-light text-dark border'}">${f.type}</span></td>
        <td class="fw-bold">${f.method || 'Cash'}</td>
        <td>${f.category || 'N/A'}</td>
        <td class="small">
            ${f.person ? `<span class="fw-bold text-primary d-block mb-1">👤 ${f.person}</span>` : ''}
            ${f.description || ''}
        </td>
        <td class="${amtClass} fw-bold">৳${formatNumber(amt)}</td>
        <td class="text-end">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary edit-tx-btn" onclick="editTransaction('${f.id}')" title="Edit record">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-danger del-tx-btn" onclick="event.stopPropagation(); _handleDeleteTx('${f.id}')" title="Delete record">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // ── footer totals (সবসময় full dataset থেকে) ──────────────
  // ✅ FIX: Loan এবং Transfer ledger total এ count হবে না
  // শুধু Income/Expense দিয়ে Net Profit হিসাব হবে
  const STAT_IN  = window.FE_STAT_INCOME  || ['Income', 'Registration', 'Refund'];
  const STAT_OUT = window.FE_STAT_EXPENSE || ['Expense', 'Salary', 'Rent', 'Utilities'];
  function _updateLedgerTotals(items) {
    let total = 0;
    items.forEach(f => {
      const amt = parseFloat(f.amount) || 0;
      if (STAT_IN.includes(f.type))  total += amt;
      if (STAT_OUT.includes(f.type)) total -= amt;
      // Loan Given / Loan Received / Transfer — এগুলো net profit এ count হবে না
    });
    const cls = total >= 0 ? 'text-success' : 'text-danger';
    ['ledgerSummaryTotal', 'ledgerFooterTotal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = '৳' + formatNumber(total);
        el.classList.remove('text-success', 'text-danger');
        el.classList.add(cls);
      }
    });
  }

  // ── PAGINATION ────────────────────────────────────────────
  if (typeof WFPaginator === 'function') {
    const existingPg = window._wfPaginators && window._wfPaginators['ledger'];
    const pageSize   = existingPg ? existingPg.pageSize : 20;

    const pg = new WFPaginator(displayItems, pageSize);
    if (!window._wfPaginators) window._wfPaginators = {};
    window._wfPaginators['ledger'] = pg;

    let pgContainer = document.getElementById('ledgerPaginationBar');
    if (!pgContainer) {
      pgContainer = document.createElement('div');
      pgContainer.id = 'ledgerPaginationBar';
      const tableWrap = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement || tbody.parentElement;
      if (tableWrap) tableWrap.insertAdjacentElement('afterend', pgContainer);
    }

    function _drawLedgerPage(page) {
      tbody.innerHTML = '';
      pg.getPage(page).forEach((f, i) => {
        tbody.innerHTML += _buildLedgerRow(f, i);
      });
      renderPaginationBar('ledgerPaginationBar', pg, function (newPage) {
        _drawLedgerPage(newPage);
        if (typeof scrollToTableTop === 'function') scrollToTableTop('ledgerTableBody');
      }, { pageSizes: [10, 20, 50, 100] });
    }

    _drawLedgerPage(1);

  } else {
    // fallback — সব একসাথে
    let rowsHtml = '';
    displayItems.forEach((f, idx) => { rowsHtml += _buildLedgerRow(f, idx); });
    tbody.innerHTML = rowsHtml;
  }

  // totals সবসময় full data থেকে
  _updateLedgerTotals(displayItems);

  // Dynamically update category filter dropdown
  updateCategoryDropdown();
}


// ===================================
// DYNAMIC DROPDOWNS & SETTINGS MANAGEMENT
// Moved to: sections/ledger-render.js
// ===================================

// ===================================
// PDF EXPORT
// ===================================



function downloadLedgerExcel() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const startDate = document.getElementById('mainStartDate').value;
  const endDate = document.getElementById('mainEndDate').value;
  const type = document.getElementById('ledgerTypeFilter').value;
  const category = document.getElementById('ledgerCategoryFilter').value;
  const method = document.getElementById('ledgerMethodFilter').value;

  const filtered = globalData.finance.filter(f => {
    const matchSearch = !q || (f.category && f.category.toLowerCase().includes(q)) || (f.description && f.description.toLowerCase().includes(q)) || (f.method && f.method.toLowerCase().includes(q)) || (f.type && f.type.toLowerCase().includes(q));
    const matchDate = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
    const matchType = !type || f.type === type;
    const matchCategory = !category || f.category === category;
    const matchMethod = !method || f.method === method;
    return matchSearch && matchDate && matchType && matchCategory && matchMethod;
  });

  if (filtered.length === 0) { alert('No data to export!'); return; }

  let csv = 'Date,Type,Method,Category,Description,Amount\n';
  filtered.forEach(f => {
    csv += `${f.date},${f.type},${f.method},${f.category},"${(f.description || '').replace(/"/g, '""')}",${f.amount}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Ledger_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function mailLedgerReport() {
  const academy = globalData.settings.academyName || 'Wings Fly Aviation Academy';
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const startDate = document.getElementById('mainStartDate').value || 'All Time';
  const endDate = document.getElementById('mainEndDate').value || 'Present';
  const type = document.getElementById('ledgerTypeFilter').value;
  const category = document.getElementById('ledgerCategoryFilter').value;
  const method = document.getElementById('ledgerMethodFilter').value;

  const filtered = globalData.finance.filter(f => {
    const matchSearch = !q || (f.category && f.category.toLowerCase().includes(q)) || (f.description && f.description.toLowerCase().includes(q)) || (f.method && f.method.toLowerCase().includes(q)) || (f.type && f.type.toLowerCase().includes(q));
    const matchDate = (!startDate || startDate === 'All Time' || f.date >= startDate) && (!endDate || endDate === 'Present' || f.date <= endDate);
    const matchType = !type || f.type === type;
    const matchCategory = !category || f.category === category;
    const matchMethod = !method || f.method === method;
    return matchSearch && matchDate && matchType && matchCategory && matchMethod;
  });

  let inc = 0, exp = 0, loanIn = 0, loanOut = 0;
  filtered.forEach(f => {
    const amt = parseFloat(f.amount) || 0;
    if (f.type === 'Income') inc += amt;
    else if (f.type === 'Expense') exp += amt;
    // Loan types: affect account balance, NOT income/expense stats
    else if (f.type === 'Loan Received' || f.type === 'Loan Receiving') loanIn += amt;
    else if (f.type === 'Loan Given' || f.type === 'Loan Giving') loanOut += amt;
  });
  const balance = inc - exp;

  const subject = encodeURIComponent(`${academy} - Financial Ledger Report (${startDate} to ${endDate})`);
  const body = encodeURIComponent(`Hello,\n\nPlease find the financial summary for ${academy}.\n\nPeriod: ${startDate} to ${endDate}\nSearch Filter: ${q || 'None'}\nCategory Filter: ${category || 'All'}\n\n--- SUMMARY ---\nTotal Income: ৳${formatNumber(inc)}\nTotal Expense: ৳${formatNumber(exp)}\nNet Balance: ৳${formatNumber(balance)}\n\nThis is an automated summary of the current ledger view.\n\nRegards,\nAdmin`);

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// ACCOUNT DETAILS REPORTS


function downloadAccountDetailsExcel() {
  const startDate = document.getElementById('detStartDate').value;
  const endDate = document.getElementById('detEndDate').value;
  const typeFilter = document.getElementById('detTypeFilter').value;
  const categoryFilter = document.getElementById('detCategoryFilter').value;

  const filtered = globalData.finance.filter(f => {
    const matchDate = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
    const matchCategory = !categoryFilter || f.category === categoryFilter;
    let matchType = true;
    if (typeFilter) {
      if (typeFilter === 'Income') matchType = f.type === 'Income';
      else if (typeFilter === 'Expense') matchType = f.type === 'Expense';
      else if (typeFilter === 'Transfer') matchType = f.type.includes('Transfer');
    }
    return matchDate && matchCategory && matchType;
  });

  if (filtered.length === 0) { alert('No data to export!'); return; }

  let csv = 'Date,Type,Method,Category,Description,Amount\n';
  filtered.forEach(f => {
    csv += `${f.date},${f.type},${f.method},${f.category},"${(f.description || '').replace(/"/g, '""')}",${f.amount}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Account_Details_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function mailAccountDetailsReport() {
  const academy = globalData.settings.academyName || 'Wings Fly Aviation Academy';
  const startDate = document.getElementById('detStartDate').value || 'All Time';
  const endDate = document.getElementById('detEndDate').value || 'Present';
  const type = document.getElementById('detTypeFilter').value || 'All';
  const category = document.getElementById('detCategoryFilter').value || 'All';

  // Recalculate totals for mail body
  const filtered = globalData.finance.filter(f => {
    const matchDate = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
    const matchCategory = !category || category === 'All' || f.category === category;
    let matchType = true;
    if (type && type !== 'All') {
      if (type === 'Income') matchType = f.type === 'Income';
      else if (type === 'Expense') matchType = f.type === 'Expense';
      else if (type === 'Transfer') matchType = f.type.includes('Transfer');
    }
    return matchDate && matchCategory && matchType;
  });

  let total = 0;
  filtered.forEach(f => {
    const amt = parseFloat(f.amount) || 0;
    const isPositive = (f.type === 'Income' || f.type === 'Loan Received' || f.type === 'Transfer In');
    if (isPositive) total += amt;
    else total -= amt;
  });

  const subject = encodeURIComponent(`${academy} - Account Statement (${startDate} to ${endDate})`);
  const body = encodeURIComponent(`Hello,\n\nPlease find the detailed account statement for ${academy}.\n\nPeriod: ${startDate} to ${endDate}\nType: ${type}\nCategory: ${category}\n\nSUMMARY BALANCE: ৳${formatNumber(total)}\n\nRegards,\nAdmin`);

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}


function updateStudentCount() {
  const count = globalData.students.length;
  document.getElementById('studentCount').innerText = `${count} Student${count !== 1 ? 's' : ''}`;
}

// ===================================
// CALCULATE GLOBAL STATISTICS
// ===================================

// ===================================
// RENDER DASHBOARD (wrapper)
// ===================================

function markReminderDone(studentId) {
  const student = globalData.students.find(s => s.rowIndex == studentId);
  if (student) {
    student.reminderDate = null; // Clear reminder
    saveToStorage();
    checkPaymentReminders(); // Refresh
    showSuccessToast(`Reminder cleared for ${student.name}`);
  }
}

function snoozeReminder(studentId) {
  const student = globalData.students.find(s => s.rowIndex == studentId);
  if (student) {
    const now = new Date();
    // Default to tomorrow
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    const tomorrowStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

    const newDate = prompt(
      `Set next payment reminder for: ${student.name}\n\nEnter the date the client promised to pay (YYYY-MM-DD):`,
      tomorrowStr
    );

    if (newDate === null) return; // Cancelled

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert('Invalid date format. Please use YYYY-MM-DD');
      return;
    }

    student.reminderDate = newDate;
    saveToStorage();
    checkPaymentReminders(); // Refresh
    showSuccessToast(`Reminder rescheduled for ${student.name} to ${newDate}`);
  }
}

function dismissReminders() {
  if (!confirm('This will clear ALL active payment reminders. Continue?')) return;

  globalData.students.forEach(s => {
    if (s.reminderDate) s.reminderDate = null;
  });
  saveToStorage();
  checkPaymentReminders();
  showSuccessToast('All reminders dismissed');
}

function quickSetReminder(rowIndex) {
  const student = globalData.students[rowIndex];
  if (!student) return;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentReminder = student.reminderDate || today;

  const newDate = prompt(
    `Set payment reminder for: ${student.name}\n\nCurrent reminder: ${student.reminderDate || 'None'}\n\nEnter new date (YYYY-MM-DD):`,
    currentReminder
  );

  if (newDate === null) return; // Cancelled

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    alert('Invalid date format. Please use YYYY-MM-DD');
    return;
  }

  student.reminderDate = newDate;
  saveToStorage();
  updateGlobalStats(); // Refresh to show bell icon
  showSuccessToast(`Reminder set for ${student.name} on ${newDate}`);
}

function openAllRemindersModal() {
  const modalEl = document.getElementById('allRemindersModal');
  if (!modalEl) return;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const list = document.getElementById('allRemindersList');

  if (!list) return;

  const today = new Date().toISOString().split('T')[0];
  const reminders = globalData.students
    .filter(s => s.reminderDate && (parseFloat(s.due) > 0))
    .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));

  if (reminders.length === 0) {
    list.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-bell-slash fs-1 d-block mb-3 opacity-25"></i>
        <p class="mb-0 fw-bold">No active payment reminders found.</p>
        <small>Set a reminder from the student list to see it here.</small>
      </div>
    `;
  } else {
    list.innerHTML = `
      <table class="table table-hover align-middle modern-table mb-0">
        <thead class="bg-light">
          <tr>
            <th>Date</th>
            <th>Student Name</th>
            <th>Batch</th>
            <th>Course</th>
            <th class="text-end">Due Amount</th>
            <th class="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          ${reminders.map(s => {
      const isOverdue = s.reminderDate < today;
      const dateClass = isOverdue ? 'text-danger fw-bold' : 'text-primary fw-bold';
      const badge = isOverdue ? '<span class="badge bg-danger-subtle text-danger ms-2">Overdue</span>' : '';

      return `
              <tr>
                <td>
                   <div class="${dateClass}">${s.reminderDate}</div>
                   ${badge}
                </td>
                <td class="fw-bold">${s.name}</td>
                <td><span class="badge bg-light text-dark border">${s.batch || '-'}</span></td>
                <td class="small text-muted">${s.course || '-'}</td>
                <td class="text-end text-danger fw-bold">৳${formatNumber(s.due)}</td>
                <td class="text-end">
                  <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-sm btn-outline-primary fw-bold" 
                      onclick="bootstrap.Modal.getInstance(document.getElementById('allRemindersModal')).hide(); openStudentProfile('${s.rowIndex}')">
                      Profile
                    </button>
                    <button class="btn btn-sm btn-success fw-bold" 
                      onclick="markReminderDone('${s.rowIndex}'); openAllRemindersModal();">
                      ✔ Done
                    </button>
                  </div>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  }

  modal.show();
}

window.openAllRemindersModal = openAllRemindersModal;

// ===================================
// SEARCH & FILTER
// ===================================

function filterData() {
  const q = (document.getElementById('globalFilterSearchInput')?.value || document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const batchSummary = document.getElementById('batchSummaryCard');
  const activeTab = localStorage.getItem('wingsfly_active_tab') || 'students';

  // Unified Global Dates (Read from main or ledger depending on what was changed)
  const mainStart = document.getElementById('mainStartDate');
  const mainEnd = document.getElementById('mainEndDate');
  const ledgerStart = document.getElementById('ledgerStartDate');
  const ledgerEnd = document.getElementById('ledgerEndDate');

  let startDate = mainStart.value;
  let endDate = mainEnd.value;

  // If we are on ledger, prioritize ledger inputs
  if (activeTab === 'ledger' && ledgerStart && ledgerEnd) {
    if (ledgerStart.value) {
      startDate = ledgerStart.value;
      mainStart.value = startDate;
    }
    if (ledgerEnd.value) {
      endDate = ledgerEnd.value;
      mainEnd.value = endDate;
    }
  } else if (ledgerStart && ledgerEnd) {
    ledgerStart.value = startDate;
    ledgerEnd.value = endDate;
  }

  if (activeTab === 'students') {
    const filtered = globalData.students.filter(s => {
      const matchSearch = !q || (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.batch && s.batch.toString() === q) || /* EXACT MATCH for batch number */
        (s.course && s.course.toLowerCase().includes(q)) ||
        (s.phone && q.length > 3 && s.phone.includes(q)) /* Increased threshold for phone */
      );

      // Explicitly ignore financial fields unless user searches specifically (advanced)
      // This prevents "6" from matching "600" in Paid/Due etc.

      const matchDate = (!startDate || s.enrollDate >= startDate) && (!endDate || s.enrollDate <= endDate);

      return matchSearch && matchDate;
    });

    render(filtered);

    // Batch summary logic
    if (q) {
      const uniqueBatches = [...new Set(globalData.students.map(s => s.batch))];
      const matchedBatch = uniqueBatches.find(b => b && b.toString().toLowerCase() === q);
      if (matchedBatch) {
        showBatchSummary(matchedBatch, filtered);
      } else {
        batchSummary.classList.add('d-none');
      }
    } else {
      batchSummary.classList.add('d-none');
    }
  } else {
    // Ledger tab filtering
    const type = document.getElementById('ledgerTypeFilter').value;
    const category = document.getElementById('ledgerCategoryFilter').value;
    const method = document.getElementById('ledgerMethodFilter').value;

    const filteredFinance = globalData.finance.filter(f => {
      const matchSearch = !q || (
        (f.category && f.category.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.method && f.method.toLowerCase().includes(q)) ||
        (f.type && f.type.toLowerCase().includes(q)) ||
        (f.person && f.person.toLowerCase().includes(q))
      );

      const loanOnly = document.getElementById('ledgerLoanOnly')?.checked;

      const matchDate = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      const matchType = !type || f.type === type;
      const matchCategory = !category || f.category === category;
      const matchMethod = !method || f.method === method;
      const matchLoan = !loanOnly || (f.type === 'Loan Given' || f.type === 'Loan Received');

      return matchSearch && matchDate && matchType && matchCategory && matchMethod && matchLoan;
    });
    renderLedger(filteredFinance);
  }
}

// Synchronize Top Navbar search with Global Filter search (and vice versa)
function syncSearchInputs(caller) {
  const topSearch = document.getElementById('searchInput');
  const filterSearch = document.getElementById('globalFilterSearchInput');
  const q = caller.value;

  if (caller.id === 'searchInput' && filterSearch) {
    filterSearch.value = q;
  } else if (caller.id === 'globalFilterSearchInput' && topSearch) {
    topSearch.value = q;
  }
}

function handleGlobalSearch() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const activeTab = localStorage.getItem('wingsfly_active_tab') || 'dashboard';

  if (activeTab === 'dashboard') {
    // Filter the dashboard recent admissions table
    if (typeof renderRecentAdmissions === 'function') {
      renderRecentAdmissions(q);
    }
  } else if (activeTab === 'students' || activeTab === 'ledger') {
    // Use existing filterData which uses 'searchInput'
    filterData();
  } else if (activeTab === 'visitors') {
    // Synchronize with visitor search if possible
    const visitorInp = document.getElementById('visitorSearchInput');
    if (visitorInp) {
      visitorInp.value = q;
      if (typeof searchVisitors === 'function') searchVisitors();
    }
  } else if (activeTab === 'examResults') {
    const examInp = document.getElementById('examResultSearchInput');
    if (examInp) {
      examInp.value = q;
      if (typeof searchExamResults === 'function') searchExamResults();
    }
  } else if (activeTab === 'loans') {
    const loanInp = document.getElementById('loanSearchInput');
    if (loanInp) {
      loanInp.value = q;
      if (typeof filterLoanSummary === 'function') filterLoanSummary();
    }
  }
}

window.calcBatchProfit = function () {
  const batchName = document.getElementById('dashBatchSearch').value.toLowerCase().trim();
  const start = document.getElementById('dashBatchStart').value;
  const end = document.getElementById('dashBatchEnd').value;

  const resultDiv = document.getElementById('batchProfitResult');
  const emptyDiv = document.getElementById('batchAnalysisEmpty');

  if (!batchName) {
    if (resultDiv) resultDiv.style.display = 'none';
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }

  if (resultDiv) resultDiv.style.display = 'flex';
  if (emptyDiv) emptyDiv.style.display = 'none';

  let bIncome = 0;
  let bExpense = 0;

  globalData.finance.forEach(f => {
    const descMatch = f.description && f.description.toLowerCase().includes(batchName);
    const catMatch = f.category && f.category.toLowerCase().includes(batchName);
    const personMatch = f.person && f.person.toLowerCase().includes(batchName);

    if (!(descMatch || catMatch || personMatch)) return;

    const dateMatch = (!start || f.date >= start) && (!end || f.date <= end);
    if (!dateMatch) return;

    const amt = parseFloat(f.amount) || 0;
    if (f.type === 'Income') {
      bIncome += amt;
    } else if (f.type === 'Expense') {
      bExpense += amt;
    }
    // Loan Received/Given affect account balance only, not income/expense
  });

  const bProfit = bIncome - bExpense;

  document.getElementById('batchIncomeVal').innerText = '৳' + formatNumber(bIncome);
  document.getElementById('batchExpenseVal').innerText = '৳' + formatNumber(bExpense);

  const profitValEl = document.getElementById('batchProfitVal');
  const profitBoxEl = document.getElementById('batchProfitBox');
  const profitLabelEl = document.getElementById('batchProfitLabel');

  if (profitValEl) {
    profitValEl.innerText = '৳' + formatNumber(Math.abs(bProfit));
    if (bProfit >= 0) {
      profitValEl.className = "mb-0 text-success fw-bold";
      if (profitLabelEl) {
        profitLabelEl.innerText = "Net Profit";
        profitLabelEl.className = "mb-1 small text-success fw-bold";
      }
      if (profitBoxEl) profitBoxEl.className = "p-3 rounded-3 bg-success-subtle border border-success-subtle";
    } else {
      profitValEl.className = "mb-0 text-danger fw-bold";
      if (profitLabelEl) {
        profitLabelEl.innerText = "Net Loss";
        profitLabelEl.className = "mb-1 small text-danger fw-bold";
      }
      if (profitBoxEl) profitBoxEl.className = "p-3 rounded-3 bg-danger-subtle border border-danger-subtle";
    }
  }
};

function showBatchSummary(batchName, studentList = null) {
  const source = studentList || globalData.students;
  const batchStudents = source.filter(s => s.batch === batchName);

  // ✅ CALCULATE ALL BATCH TOTALS
  const batchTotalPayment = batchStudents.reduce((sum, s) => sum + (parseFloat(s.totalPayment) || 0), 0);
  const batchPaid = batchStudents.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0);
  const batchDue = batchStudents.reduce((sum, s) => sum + (parseFloat(s.due) || 0), 0);

  document.getElementById('summaryBatchName').innerText = batchName;
  document.getElementById('summaryBatchTotalPayment').innerText = '৳' + formatNumber(batchTotalPayment);
  document.getElementById('summaryBatchPaid').innerText = '৳' + formatNumber(batchPaid);
  document.getElementById('summaryBatchDue').innerText = '৳' + formatNumber(batchDue);
  document.getElementById('summaryBatchCount').innerText = batchStudents.length;

  document.getElementById('batchSummaryCard').classList.remove('d-none');
}

// ===================================
// ADD STUDENT
// ===================================

function calcDue() {
  const total = parseFloat(document.getElementById('inpTotal').value) || 0;
  const paid = parseFloat(document.getElementById('inpPaid').value) || 0;
  const paidEl = document.getElementById('inpPaid');
  const dueEl = document.getElementById('inpDue');

  // ✅ VALIDATION: Paid cannot exceed Total Fee
  if (paid > total && total > 0) {
    if (paidEl) {
      paidEl.style.borderColor = '#ff4455';
      paidEl.style.boxShadow = '0 0 8px rgba(255, 68, 85, 0.5)';
    }
    dueEl.value = 0;
    if (typeof showErrorToast === 'function') {
      showErrorToast('⚠️ Paid amount (৳' + paid + ') cannot exceed Total Fee (৳' + total + ')!');
    }
    return;
  } else {
    // Reset styles
    if (paidEl) {
      paidEl.style.borderColor = '';
      paidEl.style.boxShadow = '';
    }
  }

  dueEl.value = Math.max(0, total - paid);
}

// Student form handler
async function handleStudentSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const form = document.getElementById('studentForm');
  if (!form) { console.error('studentForm not found!'); return; }

  // ✅ VALIDATION: Paid cannot exceed Total Fee
  const totalVal = parseFloat(document.getElementById('inpTotal')?.value) || 0;
  const paidVal = parseFloat(document.getElementById('inpPaid')?.value) || 0;
  if (paidVal > totalVal && totalVal > 0) {
    showErrorToast('❌ Paid amount (৳' + paidVal + ') cannot be greater than Total Fee (৳' + totalVal + ')! Please correct it.');
    const paidEl = document.getElementById('inpPaid');
    if (paidEl) {
      paidEl.style.borderColor = '#ff4455';
      paidEl.style.boxShadow = '0 0 8px rgba(255, 68, 85, 0.5)';
      paidEl.focus();
      setTimeout(() => { paidEl.style.borderColor = ''; paidEl.style.boxShadow = ''; }, 4000);
    }
    return;
  }

  // ✅ BATCH & REQUIRED VALIDATION
  const nameInp = document.getElementById('studentName');
  const batchInp = document.getElementById('studentBatchInput');
  const courseSel = document.getElementById('studentCourseSelect');
  const phoneInp = document.getElementById('studentPhone');
  const methodSel = document.getElementById('studentMethodSelect');

  if (!nameInp?.value.trim() || !courseSel?.value || !phoneInp?.value.trim() || !methodSel?.value) {
    showErrorToast('⚠️ Please fill required fields: Name, Phone, Course, and Payment Method');
    // Highlight empty fields
    [nameInp, batchInp, courseSel, phoneInp, methodSel].forEach(el => {
      if (el && (!el.value || !el.value.trim())) {
        el.style.borderColor = '#ff4455';
        setTimeout(() => el.style.borderColor = '', 3000);
      }
    });
    return;
  }

  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => data[key] = value);

  // ✅ CRITICAL VALIDATION: Payment Method — default to Cash if empty
  if (!data.method || data.method.trim() === '') {
    // Try to get value directly from DOM (FormData sometimes misses selects)
    const methodEl = document.getElementById('studentMethodSelect');
    if (methodEl && methodEl.value) {
      data.method = methodEl.value;
    } else {
      data.method = 'Cash'; // Safe default
    }
  }

  // Also fix other fields that FormData might miss
  if (!data.name) {
    const nameEl = document.getElementById('studentName');
    if (nameEl) data.name = nameEl.value;
  }
  if (!data.course) {
    const courseEl = document.getElementById('studentCourseSelect');
    if (courseEl) data.course = courseEl.value;
  }
  if (!data.batch) {
    const batchEl = document.getElementById('studentBatchInput');
    if (batchEl) data.batch = batchEl.value;
  }
  if (!data.payment) {
    const paidEl = document.getElementById('inpPaid');
    if (paidEl) data.payment = paidEl.value;
  }
  if (!data.totalPayment) {
    const totalEl = document.getElementById('inpTotal');
    if (totalEl) data.totalPayment = totalEl.value;
  }
  if (!data.due) {
    const dueEl = document.getElementById('inpDue');
    if (dueEl) data.due = dueEl.value;
  }
  if (data.studentRowIndex === undefined || data.studentRowIndex === null) {
    const riEl = document.getElementById('studentRowIndex');
    if (riEl) data.studentRowIndex = riEl.value;
  }

  try {
    const editIndex = data.studentRowIndex;
    let student;
    let photoURL = data.photoURL || null; // Get existing photo URL from hidden field

    // === PHOTO UPLOAD HANDLING ===
    // If a new photo was selected, upload it first
    if (selectedStudentPhotoFile) {
      try {
        // Generate student ID for photo path
        const tempStudentId = data.studentRowIndex !== undefined && data.studentRowIndex !== ''
          ? window.globalData.students[parseInt(data.studentRowIndex)]?.studentId
          : generateStudentId(data.batch);

        // Photo processing (base64, stored locally + synced via Supabase)
        showSuccessToast('⏳ Processing photo...');
        photoURL = await uploadStudentPhoto(tempStudentId, selectedStudentPhotoFile);

        // If updating student and had old photo, delete it
        if (editIndex !== undefined && editIndex !== '') {
          const oldStudent = window.globalData.students[parseInt(editIndex)];
          if (oldStudent && oldStudent.photo && oldStudent.photo !== photoURL) {
            await deleteStudentPhoto(oldStudent.photo);
          }
        }

        // Clear the selected file
        selectedStudentPhotoFile = null;
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        showErrorToast('⚠️ Photo upload failed, but student will be saved without photo.');
        photoURL = null;
      }
    }

    // Use window.globalData for all student operations
    if (editIndex !== undefined && editIndex !== '') {
      // ====== UPDATE EXISTING STUDENT ======
      const index = parseInt(editIndex);
      student = window.globalData.students[index];
      if (student) {
        student.name = data.name;
        student.phone = data.phone;
        student.fatherName = data.fatherName || '';
        student.motherName = data.motherName || '';
        student.course = data.course;
        student.batch = data.batch;
        student.enrollDate = data.enrollDate;
        student.method = data.method;
        student.totalPayment = parseFloat(data.totalPayment) || 0;
        student.paid = parseFloat(data.payment) || 0;
        student.due = parseFloat(data.due) || 0;
        student.reminderDate = data.reminderDate || null;
        student.remarks = data.remarks || student.remarks || '';
        student.bloodGroup = data.bloodGroup || '';

        // Update photo if new one was uploaded
        if (photoURL) {
          student.photo = photoURL;
        }

        if (typeof logActivity === 'function') {
          logActivity('student', 'EDIT', 'Updated profile for: ' + student.name + ' (ID: ' + (student.studentId || '-') + ')');
        }
        if (!student.installments) student.installments = [];
      }
    } else {
      // ====== ADD NEW STUDENT ======
      student = {
        name: data.name,
        phone: data.phone,
        fatherName: data.fatherName || '',
        motherName: data.motherName || '',
        bloodGroup: data.bloodGroup || '',
        course: data.course,
        batch: data.batch,
        enrollDate: data.enrollDate || new Date().toISOString().split('T')[0],
        method: data.method || 'Cash',
        totalPayment: parseFloat(data.totalPayment) || 0,
        paid: parseFloat(data.payment) || 0,
        due: parseFloat(data.due) || 0,
        reminderDate: data.reminderDate || null,
        studentId: generateStudentId(data.batch),
        remarks: data.remarks || '',
        photo: photoURL, // Store Storage URL
        installments: parseFloat(data.payment) > 0 ? [{
          amount: parseFloat(data.payment),
          date: data.enrollDate || new Date().toISOString().split('T')[0],
          method: data.method || 'Cash'
        }] : []
      };

      window.globalData.students.push(student);

      // Get the actual index of the newly added student
      const newStudentIndex = window.globalData.students.length - 1;

      // AUTOMATICALLY ADD PAYMENT TO INCOME (Only for NEW students)
      if (student.paid > 0) {
        // DUPLICATE GUARD: Check if finance entry already exists for this student
        const alreadyInFinance = (window.globalData.finance || []).some(f =>
          f.person === student.name &&
          f.category === 'Student Fee' &&
          parseFloat(f.amount) === parseFloat(student.paid)
        );

        if (!alreadyInFinance) {
          const financeEntry = {
            type: 'Income',
            method: student.method,
            date: student.enrollDate,
            category: 'Student Fee',
            person: student.name,
            studentId: student.studentId, // Added for reliable tracking/deletion
            amount: student.paid,
            description: `Enrollment fee for student: ${student.name} | ID: ${student.studentId} | Batch: ${student.batch}`,
            timestamp: new Date().toISOString()
          };
          window.globalData.finance.push(financeEntry);
          if (typeof updateAccountBalance === "function") {
            updateAccountBalance(financeEntry.method, financeEntry.amount, financeEntry.type);
          }
        } else {
          console.warn(`⚠️ Duplicate enrollment finance entry prevented for ${student.name}`);
        }
      }

      if (typeof logActivity === 'function') {
        logActivity('student', 'ADD', 'Enrolled new student: ' + student.name + ' | Batch: ' + (student.batch || '-') + ' | Paid: ৳' + (student.paid || 0));
      }

      // Print receipt after a short delay
      setTimeout(() => printReceipt(newStudentIndex, student.paid), 1000);
    }

    // Save to storage
    if (typeof globalData !== 'undefined') globalData = window.globalData;
    const saveSuccess = await saveToStorage();

    // Update monitor immediately after student save - ensure counts are up to date
    if (typeof window.recordMonitorChange === 'function') {
      setTimeout(() => window.recordMonitorChange('student-added'), 100);
    }

    if (saveSuccess === false) {
      showErrorToast("CRITICAL: Failed to save data. Both Local and Cloud storage are full.");
    }

    // Update UI
    render(window.globalData.students);
    updateGlobalStats();
    updateStudentCount();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('studentModal'));
    if (modal) modal.hide();

    // Reset form
    form.reset();

    // Reset photo upload UI
    removeStudentPhoto();

    showSuccessToast(editIndex ? '✅ Student updated successfully!' : '✅ Student enrolled successfully!');

  } catch (error) {
    console.error("Error saving student:", error);
    showErrorToast("❌ An error occurred: " + error.message);
  }
}

// Global exposures for cross-file access
window.handleStudentSubmit = handleStudentSubmit;
window.saveStudent = handleStudentSubmit;
window.render = render;
window.renderStudents = render;


// ===================================
// STUDENT PAYMENT & FINANCE CRUD
// Moved to: sections/finance-crud.js
// ===================================


// ===================================
// ACCOUNT DETAILS, PRINT, SETTINGS
// Moved to: sections/accounts-ui.js
// ===================================

// ===================================

function openStudentProfile(rowIndex) {
  console.log('👤 openStudentProfile called, rowIndex:', rowIndex);

  // Use direct array index instead of find
  const student = globalData.students[rowIndex];

  if (!student) {
    console.error('❌ Student not found at index:', rowIndex);
    console.log('Total students:', globalData.students.length);
    console.log('All students:', globalData.students.map((s, i) => ({ index: i, name: s.name })));
    alert('Student not found!');
    return;
  }

  console.log('✅ Student found:', student.name);

  const modalEl = document.getElementById('studentProfileModal');
  if (!modalEl) {
    console.error('❌ Modal element not found: studentProfileModal');
    alert('Modal not found in HTML!');
    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const content = document.getElementById('studentProfileContent');

  if (!content) {
    console.error('❌ Content element not found: studentProfileContent');
    return;
  }

  console.log('📋 Rendering student profile...');

  // Filter student payments (Search by name in finance descriptions)
  const payments = globalData.finance
    .filter(f => f.description && f.description.toLowerCase().includes(student.name.toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  console.log('💰 Payments found:', payments.length);

  content.innerHTML = `
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card h-100 border-0 shadow-sm glass-card">
          <div class="card-body text-center">
            <div class="mb-3 d-flex justify-content-center">
              <div class="position-relative" style="width: 100px; height: 100px;">
                <img id="profilePhotoImg" src="${getStudentPhotoSrc(student.photo, 'profilePhotoImg')}" 
                    class="rounded-circle shadow-sm border border-primary border-4" 
                    style="width: 100px; height: 100px; object-fit: cover;">
                <div class="bg-primary text-white rounded-circle position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center" 
                     style="width: 30px; height: 30px; border: 3px solid white;">
                  <i class="bi bi-person-fill small"></i>
                </div>
              </div>
            </div>
            <h4 class="fw-bold mb-1">${student.name}</h4>
            <p class="text-muted mb-3">${student.course} • ${student.batch}</p>
            <div class="d-grid gap-2 text-start">
              <div class="p-2 rounded border bg-light">
                <small class="text-muted d-block opacity-75">Phone</small>
                <span class="fw-bold">${student.phone || 'N/A'}</span>
              </div>
              <div class="p-2 rounded border bg-light">
                <small class="text-muted d-block opacity-75">Enrollment Date</small>
                <span class="fw-bold">${student.enrollDate || 'N/A'}</span>
              </div>
              <div class="p-2 rounded border bg-light">
                <small class="text-muted d-block opacity-75">Blood Group</small>
                <span class="fw-bold text-danger">${student.bloodGroup || 'N/A'}</span>
              </div>
              <div class="p-2 rounded border bg-warning-subtle mt-2">
                <small class="text-warning-emphasis fw-bold d-block opacity-75">Teacher's Remarks</small>
                <span class="small italic text-dark">${student.remarks || 'No notes added yet.'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-8">
        <div class="row g-3 mb-4">
          <div class="col-sm-4">
            <div class="p-3 rounded text-center" style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border:2px solid #3b82f6;">
              <small class="fw-bold d-block mb-1" style="color:#93c5fd;letter-spacing:1px;font-size:0.75rem;">TOTAL FEE</small>
              <h4 class="m-0 fw-bold" style="color:#ffffff;">৳${formatNumber(student.totalPayment)}</h4>
            </div>
          </div>
          <div class="col-sm-4">
            <div class="p-3 rounded text-center" style="background:linear-gradient(135deg,#14532d,#16a34a);border:2px solid #22c55e;">
              <small class="fw-bold d-block mb-1" style="color:#bbf7d0;letter-spacing:1px;font-size:0.75rem;">PAID</small>
              <h4 class="m-0 fw-bold" style="color:#ffffff;">৳${formatNumber(student.paid)}</h4>
            </div>
          </div>
          <div class="col-sm-4">
            <div class="p-3 rounded text-center" style="background:linear-gradient(135deg,#7f1d1d,#dc2626);border:2px solid #f87171;">
              <small class="fw-bold d-block mb-1" style="color:#fecaca;letter-spacing:1px;font-size:0.75rem;">DUE</small>
              <h4 class="m-0 fw-bold" style="color:#ffffff;">৳${formatNumber(student.due)}</h4>
            </div>
          </div>
        </div>
        
        <h6 class="fw-bold mb-3 d-flex align-items-center">
          <span class="me-2">💰</span> Payment History
        </h6>
        <div class="table-responsive rounded border mb-4">
          <table class="table table-sm table-hover mb-0">
            <thead class="bg-light">
              <tr>
                <th class="ps-3">Date</th>
                <th>Category</th>
                <th>Method</th>
                <th class="text-end pe-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length > 0 ? payments.map(p => `
                <tr>
                  <td class="ps-3">${p.date}</td>
                  <td>${p.category}</td>
                  <td>${p.method || 'Cash'}</td>
                  <td class="text-end pe-3 fw-bold text-success">৳${formatNumber(p.amount)}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" class="text-center text-muted p-4">No specific payment records found for this student.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Exam History -->
        <h6 class="fw-bold mb-3 d-flex align-items-center">
          <span class="me-2">↑</span> Exam History
        </h6>
        <div class="table-responsive rounded border">
          <table class="table table-sm table-hover mb-0">
            <thead class="bg-light">
              <tr>
                <th class="ps-3">Date</th>
                <th>Subject</th>
                <th>Fee</th>
                <th class="text-end pe-3">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
      const exams = (JSON.parse(localStorage.getItem('examRegistrations')) || [])
        .filter(ex => ex.studentName === student.name)
        .sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));
      return exams.length > 0 ? exams.map(ex => `
                  <tr>
                    <td class="ps-3">${ex.registrationDate}</td>
                    <td>${ex.subjectName}</td>
                    <td>৳${formatNumber(ex.examFee)}</td>
                    <td class="text-end pe-3">
                      ${ex.grade ? `<span class="badge bg-success">${ex.grade}</span>` : ''}
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="text-center text-muted p-4">No exam records found for this student.</td></tr>';
    })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  console.log('🎉 Opening modal...');
  modal.show();
  currentStudentForProfile = student;
  console.log('✅ Student profile opened successfully');
}

// ===================================
// NEW FEATURES: ATTENDANCE, CERTIFICATE, BREAKDOWN
// ===================================

function ensureStudentIds() {
  let modified = false;
  if (!globalData.deletedItems) globalData.deletedItems = [];

  globalData.students.forEach((s, index) => {
    // If ID is missing OR doesn't contain the batch number correctly, regenerate it
    // (This ensures existing students are synced with their batch numbers)
    const batchNum = s.batch ? s.batch.toString().replace(/[^0-9]/g, '') : '00';
    const needsUpdate = !s.studentId || (batchNum && !s.studentId.includes(batchNum));

    if (needsUpdate) {
      let serial = 1;
      let newId = `WF-${batchNum}${serial.toString().padStart(3, '0')}`;

      // ✅ FIX: Ensure generated ID is strictly unique across both active and deleted items
      const isIdExists = (id) => {
        // Check active students assigned before this one
        const inActive = globalData.students.slice(0, index).some(st => st.studentId === id);
        // Check trash bin
        const inDeleted = globalData.deletedItems.some(d => d.item && d.item.studentId === id);
        return inActive || inDeleted;
      };

      while (isIdExists(newId)) {
        serial++;
        newId = `WF-${batchNum}${serial.toString().padStart(3, '0')}`;
      }

      s.studentId = newId;
      modified = true;
    }
  });

  if (modified) {
    saveToStorage();
    // Update monitor after student edit
    if (typeof window.recordMonitorChange === 'function') {
      setTimeout(() => window.recordMonitorChange('student-edited'), 100);
    }
  }
}

function generateStudentId(batchName) {
  const batchNum = batchName ? batchName.toString().replace(/[^0-9]/g, '') : '00';

  // ✅ FIX: deletedItems is an object {students:[], finance:[], employees:[]} — not an array
  if (!globalData.deletedItems || Array.isArray(globalData.deletedItems)) {
    globalData.deletedItems = { students: [], finance: [], employees: [] };
  }
  if (!Array.isArray(globalData.deletedItems.students)) globalData.deletedItems.students = [];

  const deletedStudents = globalData.deletedItems.students;

  // Calculate total historical students for this batch to find a safe starting point
  const activeCount = globalData.students.filter(s => s.batch && s.batch.toString().replace(/[^0-9]/g, '') === batchNum).length;
  const deletedCount = deletedStudents.filter(d => d.item && d.item.batch && d.item.batch.toString().replace(/[^0-9]/g, '') === batchNum).length;

  let serial = activeCount + deletedCount + 1;
  let newId = `WF-${batchNum}${serial.toString().padStart(3, '0')}`;

  // ✅ FIX: Verify it absolutely does not collide with active or deleted students
  const isIdExists = (id) => {
    const inActive = globalData.students.some(s => s.studentId === id);
    const inDeleted = deletedStudents.some(d => d.item && d.item.studentId === id);
    return inActive || inDeleted;
  };

  while (isIdExists(newId)) {
    serial++;
    newId = `WF-${batchNum}${serial.toString().padStart(3, '0')}`;
  }

  return newId;
}


// ============================================
// ATTENDANCE PRO — merged from attendance-pro.js
// ============================================
// ============================================
// WINGS FLY — ATTENDANCE PRO MODULE
// Monthly | Yearly | Course-wise | Mark + Blank Sheet
// ============================================

(function () {
  'use strict';

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── Helper ──────────────────────────────────────────
  function gd() { return window.globalData || {}; }
  function fmt(n) { return window.formatNumber ? window.formatNumber(n) : n; }

  function getBatches() {
    return [...new Set((gd().students || []).map(s => s.batch))].filter(Boolean).sort();
  }
  function getCourses() {
    return [...new Set((gd().students || []).map(s => s.course))].filter(Boolean).sort();
  }
  function getYears() {
    const now = new Date().getFullYear();
    return [now - 2, now - 1, now, now + 1];
  }

  function buildBatchOptions(selId, label = 'All Batches') {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = `<option value="">${label}</option>` +
      getBatches().map(b => `<option value="${b}">${b}</option>`).join('');
  }
  function buildCourseOptions(selId) {
    const el = document.getElementById(selId);
    if (!el) return;
    el.innerHTML = `<option value="">All Courses</option>` +
      getCourses().map(c => `<option value="${c}">${c}</option>`).join('');
  }
  function buildYearOptions(selId, selected) {
    const el = document.getElementById(selId);
    if (!el) return;
    const cur = selected || new Date().getFullYear();
    el.innerHTML = getYears().map(y =>
      `<option value="${y}"${y === cur ? ' selected' : ''}>${y}</option>`).join('');
  }
  function buildMonthOptions(selId, selected) {
    const el = document.getElementById(selId);
    if (!el) return;
    const cur = selected !== undefined ? selected : new Date().getMonth();
    el.innerHTML = MONTH_NAMES.map((m, i) =>
      `<option value="${i}"${i === cur ? ' selected' : ''}>${m}</option>`).join('');
  }

  function rateColor(r) {
    if (r >= 75) return 'var(--att-green)';
    if (r >= 50) return 'var(--att-gold)';
    return 'var(--att-red)';
  }

  // ── Open Hub ────────────────────────────────────────
  function openAttendanceModal() {
    // পুরনো modal remove করো
    const oldEl = document.getElementById('attendanceHubModal');
    if (oldEl) oldEl.remove();
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());

    // নতুন modal তৈরি করো
    buildHubModal();

    // Bootstrap ছাড়াই manually show করো
    const modalEl = document.getElementById('attendanceHubModal');
    modalEl.style.cssText = 'display:block !important; opacity:1 !important; position:fixed; top:0; left:0; width:100%; height:100%; z-index:1055; overflow-y:auto;';
    modalEl.classList.add('show');

    // backdrop তৈরি করো
    const backdrop = document.createElement('div');
    backdrop.id = 'attHubBackdrop';
    backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1054;';
    backdrop.onclick = closeAttHub;
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => switchAttTab('mark'), 50);
  }
  window.openAttendanceModal = openAttendanceModal;

  // ── Hub Modal HTML ──────────────────────────────────
  function buildHubModal() {
    // সবসময় নতুন তৈরি হবে (openAttendanceModal এ পুরনো remove হয়ে যায়)

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'attendanceHubModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
<div class="modal-dialog modal-xl modal-dialog-centered" style="max-width:1000px;">
  <div class="modal-content" style="background:linear-gradient(135deg,#07091c,#0e0a28,#07091c);border:1px solid rgba(0,217,255,0.25);border-radius:20px;overflow:hidden;font-family:'DM Sans',sans-serif;">

    <!-- Header -->
    <div class="modal-header border-0 pb-0 px-4 pt-4" style="background:rgba(0,0,0,0.3);">
      <div class="d-flex align-items-center gap-3">
        <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#00d9ff,#b537f2);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,217,255,0.4);">
          <i class="bi bi-calendar-check-fill text-white fs-5"></i>
        </div>
        <div>
          <h5 class="modal-title fw-bold mb-0" style="font-family:'Rajdhani',sans-serif;font-size:1.3rem;color:#00d9ff;letter-spacing:1px;">ATTENDANCE CENTRE</h5>
          <div class="small" style="color:rgba(255,255,255,0.4);font-size:0.75rem;">Wings Fly Aviation Academy</div>
        </div>
      </div>
      <button type="button" class="btn-close btn-close-white" onclick="closeAttHub()"></button>
    </div>

    <!-- Tab Strip -->
    <div class="att-tab-strip no-print">
      <button class="att-tab-btn active" id="attTab-mark"    onclick="switchAttTab('mark')">
        <i class="bi bi-check2-square"></i>Mark Attendance
      </button>
      <button class="att-tab-btn" id="attTab-monthly"  onclick="switchAttTab('monthly')">
        <i class="bi bi-calendar3"></i>Monthly Report
      </button>
      <button class="att-tab-btn" id="attTab-yearly"   onclick="switchAttTab('yearly')">
        <i class="bi bi-calendar-range"></i>Yearly Report
      </button>
      <button class="att-tab-btn" id="attTab-course"   onclick="switchAttTab('course')">
        <i class="bi bi-mortarboard"></i>Course-wise
      </button>
      <button class="att-tab-btn" id="attTab-blank"    onclick="switchAttTab('blank')">
        <i class="bi bi-file-earmark-ruled"></i>Blank Sheet
      </button>
    </div>

    <!-- Body -->
    <div class="modal-body p-0" style="overflow-y:auto;max-height:65vh;">

      <!-- ══ MARK ATTENDANCE ══════════════════════ -->
      <div class="att-pane active" id="attPane-mark">
        <div class="att-filter-row">
          <div class="att-filter-group">
            <label><i class="bi bi-people-fill"></i>Batch</label>
            <select id="attMarkBatch" onchange="loadAttendanceList()">
              <option value="">Select Batch...</option>
            </select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar-date"></i>Date</label>
            <input type="date" id="attMarkDate" onchange="loadAttendanceList()">
          </div>
          <div class="att-filter-group" style="justify-content:flex-end;">
            <label style="opacity:0;">&nbsp;</label>
            <div style="display:flex;gap:8px;align-items:center;padding-top:4px;">
              <span id="attMarkCountBadge" style="background:rgba(0,217,255,0.12);border:1px solid rgba(0,217,255,0.3);border-radius:8px;padding:6px 14px;font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:rgba(0,217,255,0.8);letter-spacing:1px;text-transform:uppercase;">
                0 Students
              </span>
            </div>
          </div>
        </div>

        <!-- Select-all bar (hidden until loaded) -->
        <div class="att-select-all-bar d-none" id="attMarkSelectAll">
          <span><i class="bi bi-lightning-fill me-1"></i>Quick Mark All</span>
          <button class="att-btn-all-p" onclick="markAllStudents('Present')">✔ All Present</button>
          <button class="att-btn-all-a" onclick="markAllStudents('Absent')">✗ All Absent</button>
        </div>

        <!-- Student list -->
        <div id="attMarkContainer">
          <div class="att-empty">
            <i class="bi bi-people"></i>
            <p>Batch ও Date বেছে নিলেই Student List দেখাবে</p>
          </div>
        </div>
      </div>

      <!-- ══ MONTHLY REPORT ════════════════════════ -->
      <div class="att-pane" id="attPane-monthly">
        <div class="att-filter-row">
          <div class="att-filter-group">
            <label><i class="bi bi-people-fill"></i>Batch</label>
            <select id="attMonBatch" onchange="renderMonthlyReport()"><option value="">Select Batch...</option></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar-event"></i>Year</label>
            <select id="attMonYear" onchange="renderMonthlyReport()"></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar2-month"></i>Month</label>
            <select id="attMonMonth" onchange="renderMonthlyReport()"></select>
          </div>
        </div>

        <!-- Stats row -->
        <div class="att-stats-row d-none" id="attMonStats">
          <div class="att-stat-card cyan"><div class="val" id="attMonWd">—</div><div class="lbl">Working Days</div></div>
          <div class="att-stat-card cyan"><div class="val" id="attMonStu">—</div><div class="lbl">Students</div></div>
          <div class="att-stat-card green"><div class="val" id="attMonTotP">—</div><div class="lbl">Total Present</div></div>
          <div class="att-stat-card red"><div class="val" id="attMonTotA">—</div><div class="lbl">Total Absent</div></div>
          <div class="att-stat-card gold"><div class="val" id="attMonAvg">—</div><div class="lbl">Avg Rate</div></div>
          <div class="att-stat-card purple"><div class="val" id="attMonBest">—</div><div class="lbl">Top Attender</div></div>
        </div>

        <!-- Table -->
        <div id="attMonTableWrap">
          <div class="att-empty"><i class="bi bi-calendar3"></i><p>Batch, Year ও Month বেছে নিন</p></div>
        </div>
      </div>

      <!-- ══ YEARLY REPORT ════════════════════════ -->
      <div class="att-pane" id="attPane-yearly">
        <div class="att-filter-row">
          <div class="att-filter-group">
            <label><i class="bi bi-people-fill"></i>Batch</label>
            <select id="attYrBatch" onchange="renderYearlyReport()"><option value="">Select Batch...</option></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar-event"></i>Year</label>
            <select id="attYrYear" onchange="renderYearlyReport()"></select>
          </div>
        </div>
        <div id="attYrContent">
          <div class="att-empty"><i class="bi bi-calendar-range"></i><p>Batch ও Year বেছে নিন</p></div>
        </div>
      </div>

      <!-- ══ COURSE-WISE ════════════════════════ -->
      <div class="att-pane" id="attPane-course">
        <div class="att-filter-row">
          <div class="att-filter-group">
            <label><i class="bi bi-mortarboard-fill"></i>Course</label>
            <select id="attCwCourse" onchange="renderCourseReport()"><option value="">All Courses</option></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-people-fill"></i>Batch (optional)</label>
            <select id="attCwBatch" onchange="renderCourseReport()"><option value="">All Batches</option></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar-event"></i>Year</label>
            <select id="attCwYear" onchange="renderCourseReport()"></select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-calendar2-month"></i>Month</label>
            <select id="attCwMonth" onchange="renderCourseReport()"></select>
          </div>
        </div>
        <div id="attCwContent">
          <div class="att-empty"><i class="bi bi-mortarboard"></i><p>Course বেছে নিন</p></div>
        </div>
      </div>

      <!-- ══ BLANK SHEET ════════════════════════ -->
      <div class="att-pane" id="attPane-blank">
        <div class="att-filter-row">
          <div class="att-filter-group">
            <label><i class="bi bi-people-fill"></i>Batch</label>
            <select id="attBlankBatch">
              <option value="">Select Batch...</option>
            </select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-grid-3x3-gap"></i>Columns (Days)</label>
            <select id="attBlankCols">
              <option value="15">15 Days</option>
              <option value="20">20 Days</option>
              <option value="26" selected>26 Days</option>
              <option value="31">31 Days (Full Month)</option>
            </select>
          </div>
          <div class="att-filter-group">
            <label><i class="bi bi-file-text"></i>Month / Session Label</label>
            <input type="text" id="attBlankLabel" placeholder="e.g. January 2026">
          </div>
        </div>

        <!-- Options -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:680px;">
          <div class="att-blank-option" onclick="printBlankSheet('portrait')">
            <div class="opt-icon">📄</div>
            <div class="opt-text">
              <div class="title">Portrait Sheet</div>
              <div class="desc">A4 Portrait — ছোট batch (≤15 students)</div>
            </div>
            <i class="bi bi-chevron-right ms-auto" style="color:rgba(0,217,255,0.4);"></i>
          </div>
          <div class="att-blank-option" onclick="printBlankSheet('landscape')">
            <div class="opt-icon">📋</div>
            <div class="opt-text">
              <div class="title">Landscape Sheet</div>
              <div class="desc">A4 Landscape — বেশি columns/students</div>
            </div>
            <i class="bi bi-chevron-right ms-auto" style="color:rgba(0,217,255,0.4);"></i>
          </div>
          <div class="att-blank-option" onclick="printBlankSheet('monthly-grid')">
            <div class="opt-icon">📅</div>
            <div class="opt-text">
              <div class="title">Monthly Grid</div>
              <div class="desc">Calendar-style grid with all 31 days</div>
            </div>
            <i class="bi bi-chevron-right ms-auto" style="color:rgba(0,217,255,0.4);"></i>
          </div>
          <div class="att-blank-option" onclick="printBlankSheet('signature')">
            <div class="opt-icon">✍️</div>
            <div class="opt-text">
              <div class="title">Signature Sheet</div>
              <div class="desc">Name + wide signature column — formal</div>
            </div>
            <i class="bi bi-chevron-right ms-auto" style="color:rgba(0,217,255,0.4);"></i>
          </div>
        </div>
      </div>

    </div><!-- /modal-body -->

    <!-- Footer Actions -->
    <div class="att-action-row no-print">

      <button class="att-btn att-btn-outline" onclick="exportAttCsv()">
        <i class="bi bi-download"></i>CSV Export
      </button>
      <button class="att-btn att-btn-outline" onclick="printCurrentAttView()">
        <i class="bi bi-printer"></i>Print
      </button>
      <button class=\"att-btn att-btn-primary\" onclick=\"attHubSave()\">
        <i class=\"bi bi-check-lg\"></i>Save Attendance
      </button>





















    </div>

  </div>
</div>`;

    document.body.appendChild(modal);

    // Build dropdowns
    buildBatchOptions('attMarkBatch', 'Select Batch...');
    buildBatchOptions('attMonBatch', 'Select Batch...');
    buildBatchOptions('attYrBatch', 'Select Batch...');
    buildBatchOptions('attCwBatch', 'All Batches');
    buildBatchOptions('attBlankBatch', 'Select Batch...');
    buildCourseOptions('attCwCourse');
    buildYearOptions('attMonYear');
    buildYearOptions('attYrYear');
    buildYearOptions('attCwYear');
    buildMonthOptions('attMonMonth');
    buildMonthOptions('attCwMonth');

    const di = document.getElementById('attMarkDate');
    if (di) di.value = new Date().toISOString().split('T')[0];
  }

  // ── Safe close function ──────────────────────────────
  function closeAttHub() {
    const modalEl = document.getElementById('attendanceHubModal');
    if (modalEl) {
      modalEl.style.display = 'none';
      modalEl.classList.remove('show');
    }
    const backdrop = document.getElementById('attHubBackdrop');
    if (backdrop) backdrop.remove();
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }
  window.closeAttHub = closeAttHub;

  // After save: just clear student list, keep modal open, go back to mark tab
  function afterSaveAttendance(batch, date) {
    // Clear student rows so user can mark another batch/date
    const container = document.getElementById('attMarkContainer');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; opacity:0.5;">
          <i class="bi bi-check-circle" style="font-size:2rem; color:#00d4ff;"></i>
          <p style="margin-top:10px;">Attendance saved! Select another batch or date.</p>
        </div>`;
    }
    // Reset batch & date selectors optionally
    const batchEl = document.getElementById('attMarkBatch');
    const dateEl = document.getElementById('attMarkDate');
    // Keep date, clear batch selection indicator
    if (batchEl) batchEl.value = '';
    // Switch to mark tab to stay in place
    if (typeof switchAttTab === 'function') switchAttTab('mark');
  }
  window.afterSaveAttendance = afterSaveAttendance;
  function switchAttTab(tab) {
    document.querySelectorAll('.att-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.att-pane').forEach(p => p.classList.remove('active'));
    const btn = document.getElementById('attTab-' + tab);
    const pane = document.getElementById('attPane-' + tab);
    if (btn) btn.classList.add('active');
    if (pane) pane.classList.add('active');
  }
  window.switchAttTab = switchAttTab;

  // ── MARK ATTENDANCE ─────────────────────────────────
  function loadAttendanceList() {
    const batch = (document.getElementById('attMarkBatch') || document.getElementById('attendanceBatchSelect'))?.value;
    const date = (document.getElementById('attMarkDate') || document.getElementById('attendanceDate'))?.value;

    const container = document.getElementById('attMarkContainer') || document.getElementById('attendanceListContainer');
    const selectAll = document.getElementById('attMarkSelectAll');
    const countBadge = document.getElementById('attMarkCountBadge');

    if (!batch || !date) {
      if (container) container.innerHTML = `<div class="att-empty"><i class="bi bi-people"></i><p>Batch ও Date বেছে নিন</p></div>`;
      if (selectAll) selectAll.classList.add('d-none');
      return;
    }

    const batchStudents = (gd().students || []).filter(s => s.batch === batch);
    const attKey = `${batch}_${date}`;
    const saved = gd().attendance?.[attKey] || {};

    if (countBadge) countBadge.textContent = `${batchStudents.length} Student${batchStudents.length !== 1 ? 's' : ''}`;
    if (selectAll && batchStudents.length > 0) selectAll.classList.remove('d-none');

    if (batchStudents.length === 0) {
      if (container) container.innerHTML = `<div class="att-empty"><i class="bi bi-person-x"></i><p>এই Batch-এ কোনো Student নেই</p></div>`;
      return;
    }

    // New mark UI
    if (container) {
      container.innerHTML = `<div class="att-mark-scroll" id="attMarkScroll">${batchStudents.map(s => {
        const status = saved[s.studentId] || 'Present';
        return `
          <div class="att-mark-student-row">
            <div class="stu-info">
              <div class="name">${s.name}</div>
              <div class="sid">${s.studentId || '—'}</div>
              ${s.course ? `<div class="course-tag" style="font-size:0.7rem;color:#00d9ff;background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.2);border-radius:4px;padding:1px 6px;margin-top:2px;display:inline-block;">${s.course}</div>` : ''}
            </div>
            <div class="att-toggle-group">
              <button class="att-toggle-btn p-btn ${status !== 'Absent' ? 'active-p' : ''}"
                onclick="toggleAtt(this,'Present','${s.studentId}')">P</button>
              <button class="att-toggle-btn a-btn ${status === 'Absent' ? 'active-a' : ''}"
                onclick="toggleAtt(this,'Absent','${s.studentId}')">A</button>
            </div>
          </div>`;
      }).join('')
        }</div>`;
    }
  }
  window.loadAttendanceList = loadAttendanceList;

  function toggleAtt(btn, status, studentId) {
    const group = btn.closest('.att-toggle-group');
    group.querySelectorAll('.att-toggle-btn').forEach(b => {
      b.classList.remove('active-p', 'active-a');
    });
    if (status === 'Present') btn.classList.add('active-p');
    else btn.classList.add('active-a');
    btn.dataset.sid = studentId;
  }
  window.toggleAtt = toggleAtt;

  function markAllStudents(status) {
    document.querySelectorAll('.att-toggle-group').forEach(group => {
      group.querySelectorAll('.att-toggle-btn').forEach(b => {
        b.classList.remove('active-p', 'active-a');
      });
      if (status === 'Present') group.querySelector('.p-btn')?.classList.add('active-p');
      else group.querySelector('.a-btn')?.classList.add('active-a');
    });
  }
  window.markAllStudents = markAllStudents;

  function saveAttendance() {
    const batch = (document.getElementById('attMarkBatch') || document.getElementById('attendanceBatchSelect'))?.value;
    const date = (document.getElementById('attMarkDate') || document.getElementById('attendanceDate'))?.value;
    if (!batch || !date) {
      window.showErrorToast?.('❌ Batch ও Date বেছে নিন');
      return;
    }

    if (!gd().attendance) gd().attendance = {};
    const attKey = `${batch}_${date}`;
    const result = {};

    document.querySelectorAll('.att-mark-student-row').forEach(row => {
      const aBtn = row.querySelector('.a-btn');
      const sid = row.querySelector('.sid')?.textContent?.trim();
      if (!sid || sid === '—') return;
      const stu = (gd().students || []).find(s => (s.studentId || '').toString() === sid || s.name === row.querySelector('.name')?.textContent?.trim());
      if (stu) {
        result[stu.studentId] = aBtn?.classList.contains('active-a') ? 'Absent' : 'Present';
      }
    });

    gd().attendance[attKey] = result;
    window.saveToStorage?.();
    window.showSuccessToast?.(`✅ Attendance saved — ${batch} on ${date}`);
    afterSaveAttendance(batch, date);
  }
  window.saveAttendance = saveAttendance;

  // আলাদা নামে — যাতে কোনো override কাজ না করে
  function attHubSave() {
    const batch = (document.getElementById('attMarkBatch'))?.value;
    const date = (document.getElementById('attMarkDate'))?.value;
    if (!batch || !date) {
      window.showErrorToast?.('❌ Batch ও Date বেছে নিন');
      return;
    }
    if (!gd().attendance) gd().attendance = {};
    const attKey = `${batch}_${date}`;
    const result = {};
    document.querySelectorAll('.att-mark-student-row').forEach(row => {
      const aBtn = row.querySelector('.a-btn');
      const sid = row.querySelector('.sid')?.textContent?.trim();
      if (!sid || sid === '—') return;
      const stu = (gd().students || []).find(s =>
        (s.studentId || '').toString() === sid ||
        s.name === row.querySelector('.name')?.textContent?.trim()
      );
      if (stu) result[stu.studentId] = aBtn?.classList.contains('active-a') ? 'Absent' : 'Present';
    });
    gd().attendance[attKey] = result;
    window.saveToStorage?.();
    window.showSuccessToast?.(`✅ Attendance saved — ${batch} on ${date}`);
    afterSaveAttendance(batch, date);
  }
  window.attHubSave = attHubSave;

  // ── MONTHLY REPORT ──────────────────────────────────
  function renderMonthlyReport() {
    const batch = document.getElementById('attMonBatch')?.value;
    const year = parseInt(document.getElementById('attMonYear')?.value);
    const month = parseInt(document.getElementById('attMonMonth')?.value);
    const wrap = document.getElementById('attMonTableWrap');
    const stats = document.getElementById('attMonStats');

    if (!batch || !wrap) { return; }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const batchStudents = (gd().students || []).filter(s => s.batch === batch);

    if (batchStudents.length === 0) {
      wrap.innerHTML = `<div class="att-empty"><i class="bi bi-person-x"></i><p>এই Batch-এ কোনো Student নেই</p></div>`;
      if (stats) stats.classList.add('d-none');
      return;
    }

    // Working days
    const workingDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (gd().attendance?.[`${batch}_${ds}`]) workingDays.push(d);
    }

    let totalP = 0, totalA = 0, bestName = '—', bestRate = -1;

    const rows = batchStudents.map((s, idx) => {
      let p = 0, a = 0;
      const cells = Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = gd().attendance?.[`${batch}_${ds}`];
        const st = dayData ? dayData[s.studentId] : undefined;
        const isWD = !!dayData;
        const isFri = new Date(year, month, d).getDay() === 5;
        let bg = '', txt = '', cell = '';
        if (st === 'Present') { bg = 'rgba(0,255,136,0.18)'; txt = '#00ff88'; cell = 'P'; p++; }
        else if (st === 'Absent') { bg = 'rgba(255,59,92,0.18)'; txt = '#ff3b5c'; cell = 'A'; a++; }
        else if (isWD) { bg = ''; txt = 'rgba(255,255,255,0.15)'; cell = '—'; }
        else if (isFri) { bg = 'rgba(255,215,0,0.05)'; txt = 'rgba(255,215,0,0.25)'; cell = ''; }
        else { bg = ''; txt = 'rgba(255,255,255,0.06)'; cell = ''; }
        return `<td style="text-align:center;min-width:26px;border:1px solid rgba(255,255,255,0.05);background:${bg};color:${txt};font-weight:700;font-size:0.72rem;padding:3px 1px;">${cell}</td>`;
      }).join('');

      totalP += p; totalA += a;
      const rate = workingDays.length > 0 ? Math.round(p / workingDays.length * 100) : 0;
      if (rate > bestRate) { bestRate = rate; bestName = s.name.split(' ')[0]; }
      const rc = rateColor(rate);
      const rowBg = idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';

      return `<tr style="background:${rowBg};">
        <td style="padding:8px 10px;border:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.35);text-align:center;font-size:0.78rem;">${idx + 1}</td>
        <td style="padding:8px 12px;border:1px solid rgba(255,255,255,0.05);color:#00d9ff;font-size:0.75rem;font-family:monospace;white-space:nowrap;">${s.studentId || '—'}</td>
        <td style="padding:8px 14px;border:1px solid rgba(255,255,255,0.05);font-weight:600;white-space:nowrap;">${s.name}</td>
        <td style="padding:8px 10px;border:1px solid rgba(255,255,255,0.05);color:#ffd700;font-size:0.72rem;white-space:nowrap;">${s.course || '—'}</td>
        ${cells}
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);background:rgba(0,255,136,0.08);font-weight:800;color:#00ff88;padding:4px 8px;">${p}</td>
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);background:rgba(255,59,92,0.08);font-weight:800;color:#ff3b5c;padding:4px 8px;">${a}</td>
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);font-weight:800;color:${rc};padding:4px 10px;font-size:0.85rem;">${rate}%</td>
      </tr>`;
    }).join('');

    // Day headers
    const dayThs = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isWD = !!(gd().attendance?.[`${batch}_${ds}`]);
      const isFri = new Date(year, month, d).getDay() === 5;
      const bg = isWD ? 'rgba(0,217,255,0.18)' : (isFri ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)');
      const txt = isWD ? '#00d9ff' : (isFri ? '#ffd700' : 'rgba(255,255,255,0.3)');
      return `<th style="text-align:center;min-width:26px;font-size:0.68rem;background:${bg};color:${txt};border:1px solid rgba(255,255,255,0.07);padding:5px 2px;">${d}</th>`;
    }).join('');

    wrap.innerHTML = `
    <div class="att-table-wrap" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="font-family:'Rajdhani',sans-serif;">
            <th style="padding:9px 10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;letter-spacing:1px;text-align:center;">#</th>
            <th style="padding:9px 12px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;letter-spacing:1px;white-space:nowrap;">ID</th>
            <th style="padding:9px 14px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;letter-spacing:1px;white-space:nowrap;">Student Name</th>
            <th style="padding:9px 12px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;letter-spacing:1px;white-space:nowrap;">Course</th>
            ${dayThs}
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.08);background:rgba(0,255,136,0.12);color:#00ff88;font-size:0.7rem;padding:5px 8px;">P</th>
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.08);background:rgba(255,59,92,0.12);color:#ff3b5c;font-size:0.7rem;padding:5px 8px;">A</th>
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.08);background:rgba(255,215,0,0.08);color:#ffd700;font-size:0.7rem;padding:5px 8px;">Rate</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    // Update stats
    const avgRate = workingDays.length && batchStudents.length
      ? Math.round(totalP / (workingDays.length * batchStudents.length) * 100) : 0;
    if (stats) {
      stats.classList.remove('d-none');
      document.getElementById('attMonWd').textContent = workingDays.length;
      document.getElementById('attMonStu').textContent = batchStudents.length;
      document.getElementById('attMonTotP').textContent = totalP;
      document.getElementById('attMonTotA').textContent = totalA;
      document.getElementById('attMonAvg').textContent = avgRate + '%';
      document.getElementById('attMonBest').textContent = bestName;
    }
  }
  window.renderMonthlyReport = renderMonthlyReport;

  // ── YEARLY REPORT ───────────────────────────────────
  function renderYearlyReport() {
    const batch = document.getElementById('attYrBatch')?.value;
    const year = parseInt(document.getElementById('attYrYear')?.value);
    const wrap = document.getElementById('attYrContent');
    if (!batch || !wrap) return;

    const batchStudents = (gd().students || []).filter(s => s.batch === batch);
    if (batchStudents.length === 0) {
      wrap.innerHTML = `<div class="att-empty"><i class="bi bi-person-x"></i><p>এই Batch-এ কোনো Student নেই</p></div>`;
      return;
    }

    // Build per-student yearly summary
    const stuData = batchStudents.map(s => {
      let totalP = 0, totalA = 0, totalWD = 0;
      const monthData = MONTH_NAMES.map((mn, mi) => {
        const daysInMonth = new Date(year, mi + 1, 0).getDate();
        let mp = 0, ma = 0, mwd = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${year}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const key = `${batch}_${ds}`;
          const dayData = gd().attendance?.[key];
          if (dayData) {
            mwd++;
            const st = dayData[s.studentId];
            if (st === 'Present') mp++;
            else if (st === 'Absent') ma++;
          }
        }
        totalP += mp; totalA += ma; totalWD += mwd;
        const rate = mwd > 0 ? Math.round(mp / mwd * 100) : null;
        return { mn, mi, mp, ma, mwd, rate };
      });
      const rate = totalWD > 0 ? Math.round(totalP / totalWD * 100) : 0;
      return { s, monthData, totalP, totalA, totalWD, rate };
    });

    // Stats row
    const overallP = stuData.reduce((a, x) => a + x.totalP, 0);
    const overallA = stuData.reduce((a, x) => a + x.totalA, 0);
    const best = stuData.reduce((b, x) => x.rate > (b?.rate || -1) ? x : b, null);

    const statsHtml = `
    <div class="att-stats-row" style="margin-bottom:20px;">
      <div class="att-stat-card cyan"><div class="val">${batchStudents.length}</div><div class="lbl">Students</div></div>
      <div class="att-stat-card green"><div class="val">${overallP}</div><div class="lbl">Total Present</div></div>
      <div class="att-stat-card red"><div class="val">${overallA}</div><div class="lbl">Total Absent</div></div>
      <div class="att-stat-card gold"><div class="val">${best ? best.rate + '%' : '—'}</div><div class="lbl">Best Rate</div></div>
      <div class="att-stat-card purple"><div class="val" style="font-size:0.9rem;">${best ? best.s.name.split(' ')[0] : '—'}</div><div class="lbl">Top Attender</div></div>
    </div>`;

    // Table header months
    const monthThs = MONTH_NAMES.map(m =>
      `<th style="text-align:center;min-width:52px;background:rgba(0,217,255,0.08);color:rgba(0,217,255,0.7);font-size:0.68rem;letter-spacing:1px;border:1px solid rgba(255,255,255,0.06);padding:7px 3px;">${m.slice(0, 3).toUpperCase()}</th>`
    ).join('');

    const tableRows = stuData.map((sd, idx) => {
      const monthCells = sd.monthData.map(md => {
        if (md.mwd === 0) return `<td style="text-align:center;border:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.1);font-size:0.75rem;">—</td>`;
        const rc = rateColor(md.rate);
        return `<td style="text-align:center;border:1px solid rgba(255,255,255,0.05);font-weight:700;font-size:0.75rem;color:${rc};">${md.rate}%</td>`;
      }).join('');
      const overallRc = rateColor(sd.rate);
      return `<tr style="background:${idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'};">
        <td style="padding:8px 12px;border:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.35);text-align:center;">${idx + 1}</td>
        <td style="padding:8px 14px;border:1px solid rgba(255,255,255,0.05);font-weight:600;white-space:nowrap;">${sd.s.name}</td>
        <td style="padding:8px 10px;border:1px solid rgba(255,255,255,0.05);color:#00d9ff;font-family:monospace;font-size:0.75rem;">${sd.s.studentId || '—'}</td>
        <td style="padding:8px 10px;border:1px solid rgba(255,255,255,0.05);color:#ffd700;font-size:0.72rem;white-space:nowrap;">${sd.s.course || '—'}</td>
        ${monthCells}
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);color:#00ff88;font-weight:800;background:rgba(0,255,136,0.08);">${sd.totalP}</td>
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);color:#ff3b5c;font-weight:800;background:rgba(255,59,92,0.08);">${sd.totalA}</td>
        <td style="text-align:center;border:1px solid rgba(255,255,255,0.05);color:${overallRc};font-weight:800;font-size:0.88rem;">${sd.rate}%</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = statsHtml + `
    <div class="att-table-wrap" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <thead>
          <tr style="font-family:'Rajdhani',sans-serif;">
            <th style="padding:9px 10px;border:1px solid rgba(255,255,255,0.07);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;text-align:center;">#</th>
            <th style="padding:9px 14px;border:1px solid rgba(255,255,255,0.07);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;">Name</th>
            <th style="padding:9px 10px;border:1px solid rgba(255,255,255,0.07);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;">ID</th>
            <th style="padding:9px 10px;border:1px solid rgba(255,255,255,0.07);background:rgba(0,217,255,0.1);color:rgba(0,217,255,0.7);font-size:0.7rem;">Course</th>
            ${monthThs}
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.07);background:rgba(0,255,136,0.1);color:#00ff88;font-size:0.7rem;padding:5px 8px;">P</th>
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.07);background:rgba(255,59,92,0.1);color:#ff3b5c;font-size:0.7rem;padding:5px 8px;">A</th>
            <th style="text-align:center;border:1px solid rgba(255,255,255,0.07);background:rgba(255,215,0,0.08);color:#ffd700;font-size:0.7rem;padding:5px 8px;">Rate</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  }
  window.renderYearlyReport = renderYearlyReport;

  // ── COURSE-WISE REPORT ──────────────────────────────
  function renderCourseReport() {
    const course = document.getElementById('attCwCourse')?.value;
    const batch = document.getElementById('attCwBatch')?.value;
    const year = parseInt(document.getElementById('attCwYear')?.value);
    const month = parseInt(document.getElementById('attCwMonth')?.value);
    const wrap = document.getElementById('attCwContent');
    if (!wrap) return;

    let students = gd().students || [];
    if (course) students = students.filter(s => s.course === course);
    if (batch) students = students.filter(s => s.batch === batch);

    if (students.length === 0) {
      wrap.innerHTML = `<div class="att-empty"><i class="bi bi-mortarboard"></i><p>কোনো Student পাওয়া যায়নি</p></div>`;
      return;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Group by batch
    const byBatch = {};
    students.forEach(s => {
      if (!byBatch[s.batch]) byBatch[s.batch] = [];
      byBatch[s.batch].push(s);
    });

    let html = '';
    Object.entries(byBatch).forEach(([b, stuList]) => {
      let totalP = 0, totalA = 0, wd = 0;
      const stuRows = stuList.map(s => {
        let p = 0, a = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayData = gd().attendance?.[`${b}_${ds}`];
          if (dayData) {
            if (d === 1) wd++;
            const st = dayData[s.studentId];
            if (st === 'Present') p++;
            else if (st === 'Absent') a++;
          }
        }
        totalP += p; totalA += a;
        const rate = (p + a) > 0 ? Math.round(p / (p + a) * 100) : 0;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <div style="font-weight:600;font-size:0.88rem;">${s.name}</div>
            <div style="font-size:0.72rem;color:#00d9ff;opacity:0.7;font-family:monospace;">${s.studentId || '—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:14px;font-family:'Rajdhani',sans-serif;">
            <span style="color:#00ff88;font-weight:700;">${p}P</span>
            <span style="color:#ff3b5c;font-weight:700;">${a}A</span>
            <div class="att-rate-bar" style="width:80px;">
              <div class="att-rate-track"><div class="att-rate-fill" style="width:${rate}%;background:${rateColor(rate)};"></div></div>
              <span style="color:${rateColor(rate)};font-weight:700;font-size:0.8rem;min-width:36px;">${rate}%</span>
            </div>
          </div>
        </div>`;
      }).join('');

      html += `
      <div class="att-month-block" style="margin-bottom:16px;">
        <div class="m-header">
          <span>📚 Batch: ${b}</span>
          <div style="display:flex;gap:14px;font-size:0.78rem;">
            <span style="color:#00ff88;">${totalP} Present</span>
            <span style="color:#ff3b5c;">${totalA} Absent</span>
            <span style="color:#ffd700;">${stuList.length} Students</span>
          </div>
        </div>
        <div class="att-table-wrap">${stuRows}</div>
      </div>`;
    });

    wrap.innerHTML = html;
  }
  window.renderCourseReport = renderCourseReport;

  // ── BLANK SHEET PRINT ────────────────────────────────
  function printBlankSheet(style = 'landscape') {
    const batch = document.getElementById('attBlankBatch')?.value;
    if (!batch) { window.showErrorToast?.('❌ Batch বেছে নিন'); return; }

    const cols = parseInt(document.getElementById('attBlankCols')?.value) || 26;
    const label = document.getElementById('attBlankLabel')?.value || '';
    const students = (gd().students || []).filter(s => s.batch === batch);
    if (students.length === 0) { window.showErrorToast?.('❌ এই Batch-এ কোনো Student নেই'); return; }

    students.sort((a, b) => (a.studentId || '').toString().localeCompare((b.studentId || '').toString()));

    const logo1 = window.APP_LOGOS?.premium || 'wings_logo_premium.png';
    const logo2 = window.APP_LOGOS?.linear || 'wings_logo_linear.png';
    const isPortrait = style === 'portrait';
    const isSignature = style === 'signature';
    const isMonthly = style === 'monthly-grid';
    const pw = window.open('', '', 'width=1200,height=900');

    let tableContent = '';

    if (isSignature) {
      // Signature sheet
      const rows = students.map((s, i) => `
        <tr style="height:38px;">
          <td style="border:1px solid #ccc;text-align:center;font-size:12px;color:#555;">${i + 1}</td>
          <td style="border:1px solid #ccc;padding:4px 10px;font-weight:600;">${s.name}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:11px;color:#2c7da0;">${s.studentId || ''}</td>
          <td style="border:1px solid #ccc;padding:4px 8px;font-size:11px;color:#1a4d6e;">${s.course || ''}</td>
          <td style="border:1px solid #ccc;"></td>
        </tr>`).join('');
      tableContent = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#1a4d6e;">
              <th style="border:1px solid #ccc;color:#fff;padding:8px;width:40px;text-align:center;">#</th>
              <th style="border:1px solid #ccc;color:#fff;padding:8px;text-align:left;">Student Name</th>
              <th style="border:1px solid #ccc;color:#fff;padding:8px;text-align:center;width:90px;">ID</th>
              <th style="border:1px solid #ccc;color:#fff;padding:8px;text-align:center;width:140px;">Course</th>
              <th style="border:1px solid #ccc;color:#fff;padding:8px;text-align:center;min-width:180px;">Signature</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else if (isMonthly) {
      // Monthly grid
      const colH = Array.from({ length: 31 }, (_, i) =>
        `<th style="border:1px solid #bcd;background:#e8f4ff;text-align:center;width:22px;font-size:10px;color:#1a4d6e;">${i + 1}</th>`).join('');
      const rows = students.map((s, i) => {
        const cells = Array.from({ length: 31 }, () =>
          `<td style="border:1px solid #dde;height:28px;"></td>`).join('');
        return `<tr><td style="border:1px solid #bcd;text-align:center;font-size:11px;color:#555;">${i + 1}</td>
          <td style="border:1px solid #bcd;padding:3px 8px;font-weight:600;font-size:12px;">${s.name}</td>
          <td style="border:1px solid #bcd;padding:3px 6px;font-size:11px;color:#1a4d6e;">${s.course || ''}</td>
          ${cells}</tr>`;
      }).join('');
      tableContent = `
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr><th style="border:1px solid #bcd;background:#1a4d6e;color:#fff;width:35px;text-align:center;">#</th>
            <th style="border:1px solid #bcd;background:#1a4d6e;color:#fff;text-align:left;padding:6px;min-width:150px;">Name</th>
            <th style="border:1px solid #bcd;background:#1a4d6e;color:#fff;text-align:left;padding:6px;min-width:120px;">Course</th>
            ${colH}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      // Standard landscape/portrait
      const colH = Array.from({ length: cols }, (_, i) =>
        `<th style="border:1px solid #000;width:${isPortrait ? 28 : 36}px;text-align:center;font-size:${isPortrait ? 9 : 11}px;">${i + 1}</th>`).join('');
      const rows = students.map((s, i) => {
        const cells = Array.from({ length: cols }, () =>
          `<td style="border:1px solid #000;height:${isPortrait ? 28 : 32}px;"></td>`).join('');
        return `<tr>
          <td style="border:1px solid #000;text-align:center;font-size:${isPortrait ? 10 : 12}px;">${i + 1}</td>
          <td style="border:1px solid #000;padding:3px 8px;font-weight:600;font-size:${isPortrait ? 11 : 13}px;font-style:italic;color:#1a4d6e;">${s.name}</td>
          <td style="border:1px solid #000;padding:3px 6px;font-size:${isPortrait ? 9 : 11}px;color:#1a4d6e;">${s.course || '—'}</td>
          ${cells}
        </tr>`;
      }).join('');
      tableContent = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="border:1px solid #000;background:#f0f8ff;width:40px;text-align:center;font-size:${isPortrait ? 9 : 11}px;color:#1a4d6e;">SL</th>
              <th style="border:1px solid #000;background:#f0f8ff;text-align:left;padding:5px 8px;font-size:${isPortrait ? 9 : 11}px;color:#1a4d6e;">Student Name</th>
              <th style="border:1px solid #000;background:#f0f8ff;text-align:left;padding:5px 6px;font-size:${isPortrait ? 9 : 11}px;color:#1a4d6e;min-width:${isPortrait ? 80 : 120}px;">Course</th>
              ${colH}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const orient = (isPortrait || isSignature) ? 'portrait' : 'landscape';
    const course = students[0]?.course || 'COURSE';

    pw.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Attendance Sheet — ${batch}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #fff; color: #111; padding: 18px 24px; }
        .header { margin-bottom: 18px; }
        .logo-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .academy-name { font-size: 22px; font-weight: 900; color: #1a4d6e; text-transform: uppercase; letter-spacing: 1px; }
        .sub { font-size: 13px; color: #2c7da0; font-weight: 600; }
        .sheet-title { font-size: 16px; font-weight: 800; color: #003366; text-transform: uppercase; border-bottom: 3px solid #00b4ff; display: inline-block; padding-bottom: 3px; margin: 6px 0; }
        .meta-row { display: flex; gap: 30px; margin: 8px 0 12px; font-size: 12px; }
        .meta-row .item .lbl { color: #aaa; text-transform: uppercase; font-size: 10px; font-weight: 600; }
        .meta-row .item .val { font-weight: 800; color: #1a4d6e; font-size: 13px; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 700px; opacity: 0.04; z-index: -1; pointer-events: none; }
        .footer { margin-top: 14px; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; border-top: 1px solid #eee; padding-top: 8px; }
        .legend { display: flex; gap: 16px; font-size: 11px; color: #555; margin: 8px 0; }
        .legend span { padding: 2px 8px; border-radius: 3px; font-weight: 600; }
        @media print { @page { size: A4 ${orient}; margin: 0.4in 0.4in; } body { padding: 0; } .no-print { display: none; } }
      </style>
    </head><body onload="window.print()">
      <img src="${logo2}" class="watermark">
      <div class="header">
        <div class="logo-row">
          <img src="${logo1}" style="height:65px;">
          <div style="text-align:center;">
            <div class="academy-name">Wings Fly Aviation Academy</div>
            <div class="sub">Attendance Register — ${isSignature ? 'Signature Sheet' : isMonthly ? 'Monthly Calendar' : (isPortrait ? 'Portrait' : 'Landscape') + ' Sheet'}</div>
          </div>
          <img src="${logo2}" style="height:48px;">
        </div>
        <div class="sheet-title">Student Attendance Sheet</div>
        <div class="meta-row">
          <div class="item"><div class="lbl">Batch</div><div class="val">${batch}</div></div>
          <div class="item"><div class="lbl">Course</div><div class="val">${course}</div></div>
          ${label ? `<div class="item"><div class="lbl">Session</div><div class="val">${label}</div></div>` : ''}
          <div class="item"><div class="lbl">Students</div><div class="val">${students.length}</div></div>
          <div class="item"><div class="lbl">Generated</div><div class="val">${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString())}</div></div>
        </div>
        <div class="legend">
          <span style="background:#e6f9f0;color:#006d35;">P = Present</span>
          <span style="background:#ffeef0;color:#c0001a;">A = Absent</span>
          <span style="background:#fff8e1;color:#7a5c00;">L = Late</span>
          <span style="background:#f0f0ff;color:#4000a0;">E = Excused</span>
        </div>
      </div>
      ${tableContent}
      <div class="footer">
        <span>Signature of Instructor: ___________________________</span>
        <span>Wings Fly Aviation Academy — Official Record</span>
        <span>Date: ______________________</span>
      </div>
    </body></html>`);
    pw.document.close();
  }
  window.printBlankSheet = printBlankSheet;
  // backwards compat
  window.printBlankAttendanceSheet = () => {
    const batch = document.getElementById('attendanceBatchSelect')?.value ||
      document.getElementById('attMarkBatch')?.value;
    if (!batch) { window.showErrorToast?.('❌ Batch বেছে নিন'); return; }
    // open hub at blank tab
    openAttendanceModal();
    setTimeout(() => {
      switchAttTab('blank');
      const el = document.getElementById('attBlankBatch');
      if (el) el.value = batch;
    }, 300);
  };

  // ── EXPORT CSV ──────────────────────────────────────
  function exportAttCsv() {
    const activeTab = document.querySelector('.att-tab-btn.active')?.id?.replace('attTab-', '') || 'monthly';
    if (activeTab === 'monthly') window.downloadMonthlyAttendanceCsv?.();
    else window.showSuccessToast?.('📊 Monthly tab-এ গিয়ে CSV export করুন');
  }
  window.exportAttCsv = exportAttCsv;

  // ── PRINT current view ──────────────────────────────
  function printCurrentAttView() {
    // Active pane-এর content নিন
    const activePane = document.querySelector('#attendanceHubModal .att-pane.active');
    if (!activePane) { window.showErrorToast?.('কোনো content নেই'); return; }

    const activeTabName = document.querySelector('.att-tab-btn.active')?.textContent?.trim() || 'Attendance';
    const contentHtml = activePane.innerHTML;

    const pw = window.open('', '_blank', 'width=900,height=700');
    pw.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>Wings Fly — ${activeTabName}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
  <style>
    body { font-family: 'Arial', sans-serif; background: #fff; color: #000; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { color: #1a1a2e; }
    .att-badge-p { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.8rem; }
    .att-badge-a { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.8rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 8px 12px; text-align: left; font-size: 0.8rem; letter-spacing: 0.5px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 0.85rem; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .att-stat-card { display: inline-block; padding: 10px 20px; margin: 5px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
    .att-stat-card .val { font-size: 1.3rem; font-weight: bold; }
    .att-empty { text-align: center; padding: 40px; color: #666; }
    .att-rate-bar, .att-rate-track, .att-rate-fill { display: none; }
    .no-print, button, .att-filter-row { display: none !important; }
    .att-mark-student-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #eee; }
    @media print { @page { size: A4; margin: 0.5in; } body { padding: 0; } }
    /* Header */
    .print-header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1a1a2e; }
    .print-header h2 { margin: 0; color: #1a1a2e; }
    .print-header p { margin: 4px 0 0; color: #555; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="print-header">
    <h2>✈ Wings Fly Aviation Academy</h2>
    <p>${activeTabName} — Printed on ${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString('en-BD'))}</p>
  </div>
  ${contentHtml}
  <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 1000); }<\/script>
</body></html>`);
    pw.document.close();
  }
  window.printCurrentAttView = printCurrentAttView;

  // ── Keep old openAttendanceReportModal alive ─────────
  window.openAttendanceReportModal = function () {
    openAttendanceModal();
    setTimeout(() => switchAttTab('monthly'), 300);
  };

  console.log('✅ Attendance Pro Module loaded — Wings Fly');
})();

window.openStudentProfile = openStudentProfile;

function openStudentActionsModal(index) {
  const items = globalData.students || [];
  if (!items[index]) return;
  const s = items[index];

  // ✅ FIX: actionsModal lazy-loaded modals-student.html এ আছে
  // DOM-এ না থাকলে প্রথমে load করো, তারপর retry
  const body = document.getElementById('actionsModalBody');
  if (!body) {
    console.log('[MANAGE] actionsModal not in DOM — loading modals-student.html...');
    if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
      window.sectionLoader.loadAndOpen(
        '__modalPlaceholderStudents',
        'sections/modals-student.html',
        'studentModal',
        null
      ).then(function () {
        // Load হওয়ার পর retry
        setTimeout(function () { openStudentActionsModal(index); }, 100);
      });
    }
    return;
  }

  body.innerHTML = `
  <div class='text-center mb-3'>
     <h6 class='fw-bold mb-0'>${s.name}</h6>
     <span class='small text-muted'>ID: ${s.studentId || 'N/A'}</span>
  </div>
  <button class='btn btn-warning w-100 fw-bold py-2 mb-2 text-dark' onclick='openStudentPaymentModal(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'>💰 Add Payment</button>
  <button class='btn btn-info w-100 fw-bold py-2 mb-2 text-white' onclick='openIdCardModal(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'><i class="bi bi-person-badge"></i> View ID Card</button>
  <button class='btn btn-warning w-100 fw-bold py-2 mb-2 text-dark' onclick='bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide(); setTimeout(function(){ switchTab("certificates"); setTimeout(function(){ var sel=document.getElementById("certStudentSelect"); if(sel){ sel.value="${index}"; previewCertificate(); } },300); },300)'><i class="bi bi-award-fill"></i> Generate Certificate</button>
  <button class='btn btn-success w-100 fw-bold py-2 mb-2' onclick='openEditStudentModal(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'><i class="bi bi-pencil-square"></i> Edit Profile</button>
  <button class='btn btn-primary w-100 fw-bold py-2 mb-2' onclick='printReceipt(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'><i class="bi bi-printer"></i> Print Receipt</button>
  <button class='btn btn-secondary w-100 fw-bold py-2 mb-2' onclick='quickSetReminder(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'><i class="bi bi-bell"></i> Set Reminder</button>
  <hr class='my-2'>
  <button class='btn btn-danger w-100 fw-bold py-2' onclick='deleteStudent(${index}); bootstrap.Modal.getInstance(document.getElementById("actionsModal")).hide()'><i class="bi bi-trash"></i> Delete</button>
  `;

  const modal = new bootstrap.Modal(document.getElementById('actionsModal'));
  modal.show();
}

// Global Exposure
window.openStudentActionsModal = openStudentActionsModal;

// === ADVANCED SEARCH FUNCTIONS ===
function populateBatchFilter() {
  const select = document.getElementById('batchFilterSelect');
  if (!select) {
    console.warn('⚠️ batchFilterSelect element not found');
    return;
  }

  if (!window.globalData || !window.globalData.students) {
    console.warn('⚠️ globalData.students not available');
    return;
  }

  // ✅ PRESERVE current selection
  const currentBatchVal = select.value;

  // Populate Batch filter
  const batches = [...new Set(globalData.students.map(s => s.batch))].filter(b => b).sort((a, b) => a - b);
  console.log('📊 Populating batch filter with', batches.length, 'batches:', batches);
  select.innerHTML = '<option value="">All Batches</option>';
  batches.forEach(b => {
    select.innerHTML += `<option value="${b}">Batch ${b}</option>`;
  });

  // ✅ RESTORE selection
  if (currentBatchVal && batches.map(String).includes(String(currentBatchVal))) {
    select.value = currentBatchVal;
  }
  
  console.log('✅ Batch filter populated successfully');

  // ✅ FIX: Populate Course filter — Settings এর courseNames + students এ existing courses মিলিয়ে
  const courseSelect = document.getElementById('courseFilterSelect');
  if (courseSelect) {
    const currentCourseVal = courseSelect.value;
    // Settings এ যোগ করা courses (globalData.courseNames)
    const settingsCourses = globalData.courseNames || [];
    // Students এ existing courses (Settings এ না থাকলেও দেখাবে)
    const studentCourses = [...new Set(globalData.students.map(s => s.course))].filter(c => c);
    // দুটো merge করো, unique রাখো, sort করো
    const allCourses = [...new Set([...settingsCourses, ...studentCourses])].sort();
    courseSelect.innerHTML = '<option value="">All Courses</option>';
    allCourses.forEach(c => {
      courseSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
    // পুরোনো selected value ধরে রাখো
    if (currentCourseVal && allCourses.includes(currentCourseVal)) {
      courseSelect.value = currentCourseVal;
    }
    console.log('✅ Course filter populated with', allCourses.length, 'courses (settings + students)');
  }
}

function applyAdvancedSearch() {
  const batch = document.getElementById('batchFilterSelect')?.value;
  const course = document.getElementById('courseFilterSelect')?.value; // ✅ FIX: course filter যোগ
  const startDate = document.getElementById('advSearchStartDate')?.value;
  const endDate = document.getElementById('advSearchEndDate')?.value;

  const filtered = globalData.students.filter(s => {
    const matchBatch = !batch || s.batch?.toString() === batch;
    const matchCourse = !course || s.course === course; // ✅ FIX: course match
    const matchStart = !startDate || s.enrollDate >= startDate;
    const matchEnd = !endDate || s.enrollDate <= endDate;
    return matchBatch && matchCourse && matchStart && matchEnd;
  });

  // Calculate totals
  const totalCollected = filtered.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0);
  const totalDue = filtered.reduce((sum, s) => sum + (parseFloat(s.due) || 0), 0);

  // Update UI
  document.getElementById('advSearchIncome').innerText = '৳' + formatNumber(totalCollected);
  document.getElementById('advSearchCollected').innerText = '৳' + formatNumber(totalCollected);
  document.getElementById('advSearchDue').innerText = '৳' + formatNumber(totalDue);
  document.getElementById('advSearchCount').innerText = filtered.length;

  // Show/hide summary
  const summary = document.getElementById('advSearchSummary');
  if (batch || course || startDate || endDate) { // ✅ FIX: course ও check করো
    summary.classList.remove('d-none');
  } else {
    summary.classList.add('d-none');
  }

  // Render filtered students
  render(filtered);
}

function clearAdvancedSearch() {
  document.getElementById('batchFilterSelect').value = '';
  if (document.getElementById('courseFilterSelect')) {
    document.getElementById('courseFilterSelect').value = ''; // ✅ FIX: course ও reset
  }
  document.getElementById('advSearchStartDate').value = '';
  document.getElementById('advSearchEndDate').value = '';
  document.getElementById('advSearchSummary').classList.add('d-none');
  render(globalData.students);
}


// ========================================
// QUICK SEARCH FUNCTIONALITY
// ========================================

function quickFilterStudents() {
  const searchInput = document.getElementById('quickStudentSearch');
  if (!searchInput) return;

  const query = searchInput.value.toLowerCase().trim();

  // If empty, show all students
  if (query === '') {
    render(globalData.students);
    return;
  }

  // Filter students by name, batch, ID, phone, or course
  const filtered = globalData.students.filter(student => {
    const name = (student.name || '').toLowerCase();
    const batch = (student.batch || '').toString().toLowerCase();
    const studentId = (student.studentId || '').toString().toLowerCase();
    const phone = (student.phone || '').toLowerCase();
    const course = (student.course || '').toLowerCase();

    return name.includes(query) ||
      batch.includes(query) ||
      studentId.includes(query) ||
      phone.includes(query) ||
      course.includes(query);
  });

  // Render filtered results
  render(filtered);

  // Update count badge
  const countBadge = document.getElementById('studentCount');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} STUDENT${filtered.length !== 1 ? 'S' : ''}`;
  }
}

// Make globally available
window.quickFilterStudents = quickFilterStudents;

// =====================================================
// GLOBAL WINDOW EXPOSURES
// =====================================================
window.render = render;
window.renderStudents = render;
window.updateStudentCount = updateStudentCount;
window.filterData = filterData;
window.syncSearchInputs = syncSearchInputs;
window.handleGlobalSearch = handleGlobalSearch;
window.showBatchSummary = showBatchSummary;
window.calcDue = calcDue;
window.handleStudentSubmit = handleStudentSubmit;
window.saveStudent = handleStudentSubmit;
window.markReminderDone = markReminderDone;
window.snoozeReminder = snoozeReminder;
window.quickSetReminder = quickSetReminder;
window.openStudentProfile = openStudentProfile;
window.ensureStudentIds = ensureStudentIds;
window.generateStudentId = generateStudentId;
window.openStudentActionsModal = openStudentActionsModal;
window.populateBatchFilter = populateBatchFilter;
window.applyAdvancedSearch = applyAdvancedSearch;
window.clearAdvancedSearch = clearAdvancedSearch;
window.quickFilterStudents = quickFilterStudents;
window.renderLedger = renderLedger;        // ✅ FIX: was missing - app.js needs this
