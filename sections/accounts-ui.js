// ====================================
// WINGS FLY AVIATION ACADEMY
// ACCOUNTS UI — ACCOUNT DETAILS MODAL, PRINT, SETTINGS
// Extracted from app.js (Phase 2)
// ====================================

// ===================================
// ACCOUNT DETAILS VIEW (MODAL)
// ===================================

function showAccountDetails() {
  // Hide settings modal first
  const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
  if (settingsModal) settingsModal.hide();

  // Open account details modal
  const detailsModal = new bootstrap.Modal(document.getElementById('accountDetailsModal'));
  detailsModal.show();

  // Initialize with today's date range (optional, can be empty)
  // document.getElementById('detStartDate').value = new Date().toISOString().split('T')[0];

  renderAccountDetails();
}

function resetDetailFilters() {
  document.getElementById('detStartDate').value = '';
  document.getElementById('detEndDate').value = '';
  document.getElementById('detTypeFilter').value = '';
  document.getElementById('detCategoryFilter').value = '';
  renderAccountDetails();
}

function renderAccountDetails() {
  const tbody = document.getElementById('accountDetailsTableBody');
  tbody.innerHTML = '';

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

  const displayItems = [...filtered].reverse();
  let total = 0;

  if (displayItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No transactions found for these filters</td></tr>';
    document.getElementById('detTotalAmount').innerText = '৳0';
    return;
  }

  displayItems.forEach((f, idx) => {
    // Assign missing IDs on the fly
    if (!f.id) {
      f.id = 'FIN-' + Date.now() + '-' + idx;
    }
    const amt = parseFloat(f.amount) || 0;
    const isPositive = (f.type === 'Income' || f.type === 'Loan Received' || f.type === 'Transfer In');
    const amtClass = isPositive ? 'text-success' : 'text-danger';

    if (isPositive) total += amt;
    else total -= amt;

    const row = `
            <tr>
                <td>${f.date || 'N/A'}</td>
                <td><span class="badge ${f.type.includes('Transfer') ? 'bg-warning' : (isPositive ? 'bg-success-light text-success' : 'bg-danger-light text-danger')} border-0">${f.type}</span></td>
                <td class="small fw-semibold">${f.method || 'Cash'}</td>
                <td>${f.category || 'N/A'}</td>
                <td class="small text-muted">${f.description || ''}</td>
                <td class="${amtClass} fw-bold">৳${formatNumber(amt)}</td>
                <td class="no-print">
                    <button class="btn btn-sm btn-outline-danger border-0 del-tx-btn" data-txid="${f.id}" onclick="event.stopPropagation(); _handleDeleteTx('${f.id}')" title="Delete entry">
                        🗑️ DELETE
                    </button>
                </td>
            </tr>
        `;
    tbody.innerHTML += row;
  });

  // Update total
  const totalEl = document.getElementById('detTotalAmount');
  totalEl.innerText = '৳' + formatNumber(total);
  totalEl.className = total >= 0 ? 'fs-5 text-success' : 'fs-5 text-danger';

  updateDetailCategoryDropdown();
}

function printAccountDetails() {
  const printArea = document.getElementById('printArea');
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

  const displayItems = [...filtered].reverse();
  let totalBalance = 0;

  const tableRows = displayItems.map(f => {
    const amt = parseFloat(f.amount) || 0;
    const isPositive = (f.type === 'Income' || f.type === 'Loan Received' || f.type === 'Transfer In' || (f.type === 'Transfer' && f.transactionType === 'Credit'));
    if (isPositive) totalBalance += amt;
    else totalBalance -= amt;

    return `
      <tr>
        <td style="font-weight: 700;">${f.date || 'N/A'}</td>
        <td style="text-transform: uppercase; font-size: 11px; font-weight: bold;">${f.type}</td>
        <td>${f.method || 'Cash'}</td>
        <td style="font-weight: 600;">${f.category || 'N/A'}</td>
        <td style="color: #64748b; font-size: 11px;">${f.description || ''}</td>
        <td style="text-align: right; color: ${isPositive ? '#10b981' : '#ef4444'}; font-weight: 800;">
          ${isPositive ? '' : '-'}৳${formatNumber(amt)}
        </td>
      </tr>
    `;
  }).join('');

  printArea.innerHTML = `
    <div style="width: 100%; background: white; padding: 30px 40px 20px 40px; font-family: 'Outfit', sans-serif; page-break-after: avoid;">
        ${getPrintHeader('ACCOUNT STATEMENT')}
        
        <div style="display: flex; justify-content: space-between; margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div>
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Filtered Statistics</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #1e293b; font-weight: 700;"> Period: ${startDate || 'All Time'} - ${endDate || 'Now'} </p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;"> Type: ${typeFilter || 'All'} | Category: ${categoryFilter || 'All'} </p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Final Balance</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; color: ${totalBalance >= 0 ? '#10b981' : '#ef4444'}; font-weight: 900;"> ৳${formatNumber(totalBalance)} </p>
            </div>
        </div>

        <table class="report-table" style="margin-top: 20px; page-break-inside: auto;">
            <thead>
                <tr>
                    <th style="width: 15%;">Date</th>
                    <th style="width: 15%;">Type</th>
                    <th style="width: 15%;">Method</th>
                    <th style="width: 20%;">Category</th>
                    <th style="width: 20%;">Description</th>
                    <th style="text-align: right; width: 15%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="5" style="text-align: right; padding: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; font-size: 14px;">Total Settlement:</td>
                    <td style="text-align: right; padding: 15px; font-weight: 900; color: ${totalBalance >= 0 ? '#10b981' : '#ef4444'}; font-size: 18px;">৳${formatNumber(totalBalance)}</td>
                </tr>
            </tfoot>
        </table>

        <div style="margin-top: 25px; background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; page-break-inside: avoid;">
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #92400e; text-transform: uppercase;">Disclaimer</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #b45309; line-height: 1.4;">This is a system-generated financial statement. Any discrepancies should be reported to the finance department immediately.</p>
        </div>
    </div>
  `;

  // Inject dynamic print style for A4 (Report)
  const styleId = 'wf-print-size-override';
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = '@media print { @page { size: A4; margin: 1cm; } }';

  document.body.classList.add('printing-receipt');
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
      if (styleTag) styleTag.textContent = '';
    }, 1000);
  }, 800);
}

function updateDetailCategoryDropdown() {
  const select = document.getElementById('detCategoryFilter');
  const currentVal = select.value;
  const categories = [...new Set(globalData.finance.map(f => f.category).filter(Boolean))].sort();

  select.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// ===================================
// SETTINGS
// ===================================

function handleSettingsSubmit(e) {
  if (typeof logActivity === 'function') logActivity('settings', 'SETTING_CHANGE', 'Settings updated by ' + (sessionStorage.getItem('username') || 'Admin'));
  e.preventDefault();
  const form = document.getElementById('settingsForm');
  const formData = {};
  new FormData(form).forEach((value, key) => formData[key] = value);

  // Dynamic start balances collection
  const startBalances = {};

  // Define allMethods before using it
  const allMethods = ['Cash'];
  const bankAccounts = globalData.bankAccounts || [];
  const mobileAccounts = globalData.mobileBanking || [];

  bankAccounts.forEach(acc => allMethods.push(acc.name));
  mobileAccounts.forEach(acc => allMethods.push(acc.name));

  allMethods.forEach(m => {
    const inputVal = form[`startBalance_${m}`]?.value;
    startBalances[m] = parseFloat(inputVal) || 0;
  });

  // ✅ V39.11 FIX: Object.assign ব্যবহার করো — existing settings preserve হবে
  // আগে পুরো settings object replace হয়ে যেত, বাকি fields হারিয়ে যেত
  globalData.settings = Object.assign({}, globalData.settings || {}, {
    startBalances: startBalances,
    academyName: formData.academyName || 'Wings Fly Aviation Academy',
    monthlyTarget: parseFloat(formData.monthlyTarget) || 200000,
    runningBatch: formData.runningBatch || '',
    _settingsUpdatedAt: new Date().toISOString() // ✅ sync timestamp
  });

  // Update Credentials (with SHA-256 hashing)
  if (formData.adminPassword) {
    const newUsername = formData.adminUsername || 'admin';
    // Hash the new password before saving
    hashPassword(formData.adminPassword).then(hashedPwd => {
      globalData.credentials = {
        username: newUsername,
        password: hashedPwd
      };

      // Also update in users list for login compatibility
      if (globalData.users && Array.isArray(globalData.users)) {
        // Find by old username or 'admin'
        const adminUser = globalData.users.find(u => u.role === 'admin');
        if (adminUser) {
          adminUser.username = newUsername;
          adminUser.password = hashedPwd;
        } else {
          globalData.users.push({
            username: newUsername,
            password: hashedPwd,
            role: 'admin',
            name: 'Super Admin'
          });
        }
      }
      saveToStorage();
      if (typeof scheduleSyncPush === 'function') scheduleSyncPush('Credentials updated');
    });
  } else if (formData.adminUsername) {
    // Username changed but no new password — update username only
    const newUsername = formData.adminUsername;
    if (globalData.credentials) globalData.credentials.username = newUsername;
    const adminUser = globalData.users && globalData.users.find(u => u.role === 'admin');
    if (adminUser) adminUser.username = newUsername;
  }

  saveToStorage();

  // ✅ V39.11 FIX: Settings পরিবর্তনের পরে IMMEDIATE cloud push করো
  // debounced push (3s) wait করলে user অন্য PC তে সময়মত দেখবে না
  if (typeof window.wingsSync === 'object' && typeof window.wingsSync.pushNow === 'function') {
    window.wingsSync.pushNow('settings-update');
  } else if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Settings updated');
  }

  const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
  modal.hide();

  showSuccessToast('Settings updated successfully!');
  updateGlobalStats();
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Redundant local formatNumber removed, uses global one now.


// ===================================
// DEMO DATA RESET (for testing)
// ===================================

function resetDemoData() {
  if (confirm('Reset all data to demo state? This cannot be undone.')) {
    // SECURITY FIX: User explicitly disabled data wiping
    // localStorage.removeItem('wingsfly_data');
    alert('Data Reset functionality has been permanently disabled to prevent data loss.');
  }
}

// Refresh handler
function handleRefresh() {
  saveToStorage(); // Ensure data is saved
  location.reload();
}

function getPrintHeader(title) {
  const academy = (globalData && globalData.settings && globalData.settings.academyName) || 'Wings Fly Aviation Academy';
  const linearLogo = (window.APP_LOGOS && window.APP_LOGOS.linear) ? window.APP_LOGOS.linear : '';

  return `
    <div class="report-header" style="text-align: left; padding: 20px 0; border-bottom: 3px solid #111827;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                ${linearLogo ? `<img src="${linearLogo}" style="height: 50px;">` : `<h2 style="margin:0; color:#111827; font-weight:900;">${academy}</h2>`}
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b; letter-spacing: 1px; font-weight: bold; text-transform: uppercase;">Aviation Career Experts</p>
            </div>
            <div style="text-align: right;">
                <h1 style="margin: 0; font-size: 20px; color: #111827; font-weight: 800; border-bottom: 2px solid #3b82f6; display: inline-block;">${title}</h1>
                <p style="margin: 5px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: bold;">DATE: ${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString('en-GB'))}</p>
            </div>
        </div>
    </div>
  `;
}

function getPrintFooter() {
  return `
    <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px solid #e2e8f0;">
        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 600;">System Generated Official Document | Wings Fly Aviation Academy</p>
        <p style="margin: 5px 0 0 0; font-size: 9px; color: #94a3b8;">www.wingsfly aviation.com</p>
    </div>
  `;
}

window.getPrintHeader = getPrintHeader;
window.getPrintFooter = getPrintFooter;

// Global cleanup for print area
window.addEventListener('afterprint', () => {
  const printArea = document.getElementById('printArea');
  if (printArea) printArea.innerHTML = '';
});

// Safe helper: resolve student by array index using window.globalData/globalData
function _getStudentByRowIndex(rowIndex) {
  const idx = parseInt(rowIndex, 10);
  if (!isFinite(idx) || idx < 0) return null;

  if (window.globalData && Array.isArray(window.globalData.students) && window.globalData.students[idx]) {
    return window.globalData.students[idx];
  }
  if (typeof globalData !== 'undefined' && Array.isArray(globalData.students) && globalData.students[idx]) {
    return globalData.students[idx];
  }
  return null;
}

function printReceipt(rowIndex, currentPaymentAmount = null) {
  const student = _getStudentByRowIndex(rowIndex);
  if (!student) {
    console.warn('[Receipt] Student not found for rowIndex =', rowIndex);
    return;
  }

  const receiptId = 'REC-' + Math.floor(100000 + Math.random() * 900000);
  const premiumLogo = (window.APP_LOGOS && window.APP_LOGOS.premium) ? window.APP_LOGOS.premium : '';
  const printArea = document.getElementById('printArea');

  // Get fixed installments list
  const installments = getStudentInstallments(student);

  // Generate Installment History Rows (Clear Table Format)
  const historyRows = (installments || []).map((inst, idx) => `
    <tr>
      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; color: #1e293b;">${inst.date} ${inst.isMigrated ? '<span style="font-size: 10px; color: #94a3b8;">(Initial)</span>' : ''}</td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;"><span style="font-size: 11px; padding: 2px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc;">${inst.method || 'Cash'}</span></td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #15803d;">৳${formatNumber(inst.amount)}</td>
    </tr>
  `).join('');

  // Determine current receipt text
  const currentPmtMethod = currentPaymentAmount !== null
    ? (installments.find(i => i.amount === currentPaymentAmount)?.method || 'Cash')
    : (student.method || 'Cash');

  printArea.innerHTML = `
    <div class="receipt-layout" style="width: 100%; max-width: 190mm; height: 148mm; background: white; padding: 10mm 15mm; font-family: 'Inter', system-ui, sans-serif; position: relative; box-sizing: border-box; margin: 0 auto; margin-top: 0 !important; page-break-before: avoid !important; break-before: avoid !important; color: #1e293b; line-height: 1.1; display: flex; flex-direction: column;">
        <!-- Premium Watermark Layer -->
        ${premiumLogo ? `<img src="${premiumLogo}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); opacity: 0.04; width: 350px; z-index: 0; pointer-events: none;">` : ''}

        <div style="position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column;">
            <!-- Official Header with Logo -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 3px solid #1e1b4b; padding-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${(window.APP_LOGOS && window.APP_LOGOS.premium) ? `<img src="${window.APP_LOGOS.premium}" style="height: 55px; width: auto;">` : ''}
                    <div>
                        <h1 style="margin: 0; color: #1e1b4b; font-size: 24px; font-weight: 800; text-transform: uppercase; line-height: 1;">Wings Fly</h1>
                        <p style="margin: 2px 0 0 0; color: #4338ca; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Aviation & Career Development Academy</p>
                        <p style="margin: 3px 0 0 0; color: #64748b; font-size: 9px;">Bonosree, Dhaka | +880 1757 208244 | wingsfly.bd@gmail.com</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="background: #1e1b4b; color: white; padding: 5px 12px; font-weight: 800; border-radius: 4px; font-size: 14px; margin-bottom: 5px; display: inline-block;">MONEY RECEIPT</div>
                    <p style="margin: 0; font-size: 11px;"><strong>No:</strong> ${receiptId} | <strong>Date:</strong> ${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString('en-GB'))}</p>
                </div>
            </div>
            
            <!-- Student & Course Details -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="font-size: 11px;">
                   <span style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">Student Candidate details</span>
                   <strong style="font-size: 14px; color: #1e1b4b;">${student.name}</strong><br>
                   ID: <span style="font-weight: 700;">${student.studentId || 'N/A'}</span> | Phone: ${student.phone || 'N/A'}
                </div>
                <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 15px; font-size: 11px;">
                   <span style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">Academy Enrollment</span>
                   <strong style="font-size: 13px;">${student.course || 'N/A'}</strong><br>
                   Batch: ${student.batch || 'N/A'} | Adm. Date: ${student.enrollDate || 'N/A'}
                </div>
            </div>

            <!-- Main Ledger Table -->
            <div style="flex-grow: 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <thead style="background: #f1f5f9;">
                        <tr>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Sl. No & Description of Fees</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: center; width: 80px;">Method</th>
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; width: 110px;">Amount (৳)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">
                                <strong style="color: #1e1b4b; display: block;">Admission & Course Tuition Fees</strong>
                                <span style="font-size: 10px; color: #64748b;">(Full training program for ${student.course || 'selected course'})</span>
                            </td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">-</td>
                            <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 12px;">${formatNumber(student.totalPayment || 0)}</td>
                        </tr>
                        ${(installments || []).slice(-2).map((inst, idx) => `
                        <tr style="color: #475569; font-size: 10px;">
                            <td style="padding: 5px 10px; border: 1px solid #e2e8f0;">└─ Payment received on ${inst.date} ${inst.isMigrated ? '(Adm. Installment)' : ''}</td>
                            <td style="padding: 5px 10px; border: 1px solid #e2e8f0; text-align: center;"><span style="background: #f8fafc; padding: 1px 6px; border-radius: 3px; border: 1px solid #e2e8f0; font-size: 10px;">${inst.method || 'Cash'}</span></td>
                            <td style="padding: 5px 10px; border: 1px solid #e2e8f0; text-align: right; color: #15803d; font-weight: 700;">+ ${formatNumber(inst.amount)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Financial Summary -->
            <div style="display: flex; justify-content: space-between; align-items: stretch; margin: 15px 0; margin-top: auto;">
                <div style="width: 55%; background: #f0f7ff; border-radius: 6px; padding: 10px 15px; border: 1.5px solid #bae6fd;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 10px; font-weight: 800; color: #0369a1; text-transform: uppercase;">${currentPaymentAmount !== null ? 'Received this Payment' : 'Total Collection'}</span>
                        <span style="background: #bae6fd; color: #0369a1; padding: 1px 8px; border-radius: 4px; font-weight: 800; font-size: 10px;">${currentPmtMethod}</span>
                    </div>
                    <div style="font-size: 18px; font-weight: 900; color: #1e293b; margin-top: 4px;">৳${formatNumber(currentPaymentAmount || student.paid || 0)}</div>
                </div>

                <div style="width: 42%; background: #ffffff; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; text-align: right;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Remaining Balance</span>
                    <div style="font-size: 20px; font-weight: 900; color: #c00;">৳${formatNumber(student.due || 0)}</div>
                </div>
            </div>

            <!-- Official Signatures at the Absolute Bottom -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 10px;">
                <div style="width: 32%; text-align: center;">
                    <div style="border-top: 1.5px solid #1e1b4b; padding-top: 5px; font-size: 10px; font-weight: 800; color: #1e1b4b; text-transform: uppercase;">
                        Candidate Signature
                    </div>
                </div>
                
                <div style="text-align: center; flex-grow: 1; padding: 0 10px;">
                     <p style="margin: 0; font-size: 8px; color: #94a3b8; font-style: italic;">
                        Computer generated record. This receipt is valid only with the official academy seal.<br>
                        Admission ID: WF-${student.rowIndex} | Powered by Wings Fly Aviation
                    </p>
                </div>

                <div style="width: 32%; text-align: center;">
                    <div style="height: 35px; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 2px;">
                        ${(window.APP_LOGOS && window.APP_LOGOS.signature) ? `<img src="${window.APP_LOGOS.signature}" style="height: 38px; width: auto; position: absolute; bottom: 0;">` : ''}
                    </div>
                    <div style="border-top: 1.5px solid #1e1b4b; padding-top: 5px; font-size: 10px; font-weight: 800; color: #1e1b4b; text-transform: uppercase;">
                        Authorized Signature
                    </div>
                </div>
            </div>
        </div>
    </div>
  `;

  // Inject dynamic print style for A5 Landscape (Money Receipt)
  const styleId = 'wf-print-size-override';
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = `
    @media print {
      @page { size: A5 landscape; margin: 0; }
      body { margin: 0 !important; padding: 0 !important; min-height: 0 !important; background: white !important; }
      body.printing-receipt > *:not(#printArea) { display: none !important; }
      #printArea { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    }
  `;

  // Add print-specific class to body before printing
  document.body.classList.add('printing-receipt');

  setTimeout(() => {
    window.print();
    // Remove class and style after print dialog closes
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
      if (styleTag) styleTag.textContent = '';
    }, 1000);
  }, 500);
}

function printReport(type) {
  const printArea = document.getElementById('printArea');
  const q = document.getElementById('searchInput').value.toLowerCase().trim();

  let startDate = '';
  let endDate = '';
  let title = '';
  let tableContent = '';

  if (type === 'students') {
    title = 'STUDENT ENROLLMENT LIST';
    startDate = document.getElementById('mainStartDate').value;
    endDate = document.getElementById('mainEndDate').value;

    const students = globalData.students.filter(s => {
      const matchSearch = !q || (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.batch && s.batch.toString().toLowerCase() === q) ||
        (s.batch && s.batch.toString().toLowerCase().includes(q) && q.length > 1) ||
        (s.course && s.course.toLowerCase().includes(q)) ||
        (s.phone && q.length > 3 && s.phone.includes(q))
      );
      const matchDate = (!startDate || s.enrollDate >= startDate) && (!endDate || s.enrollDate <= endDate);
      return matchSearch && matchDate;
    }).sort((a, b) => b.rowIndex - a.rowIndex);

    tableContent = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="text-align: left;">Date</th>
            <th style="text-align: left;">Name</th>
            <th style="text-align: left;">Course</th>
            <th style="text-align: left;">Batch</th>
            <th style="text-align: right;">Total</th>
            <th style="text-align: right;">Paid</th>
            <th style="text-align: right;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td>${s.enrollDate || 'N/A'}</td>
              <td>${s.name || 'N/A'}</td>
              <td>${s.course || 'N/A'}</td>
              <td>${s.batch || 'N/A'}</td>
              <td style="text-align: right;">৳${formatNumber(s.totalPayment || 0)}</td>
              <td style="text-align: right;">৳${formatNumber(s.paid || 0)}</td>
              <td style="text-align: right;">৳${formatNumber(s.due || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (type === 'ledger') {
    title = 'FINANCIAL LEDGER REPORT';
    startDate = document.getElementById('ledgerStartDate').value;
    endDate = document.getElementById('ledgerEndDate').value;
    const lType = document.getElementById('ledgerTypeFilter').value;
    const lCategory = document.getElementById('ledgerCategoryFilter').value;
    const lMethod = document.getElementById('ledgerMethodFilter').value;

    const ledger = globalData.finance.filter(f => {
      const matchSearch = !q || (
        (f.category && f.category.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.method && f.method.toLowerCase().includes(q)) ||
        (f.type && f.type.toLowerCase().includes(q))
      );
      const matchDate = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      const matchType = !lType || f.type === lType;
      const matchCategory = !lCategory || f.category === lCategory;
      const matchMethod = !lMethod || f.method === lMethod;
      return matchSearch && matchDate && matchType && matchCategory && matchMethod;
    }).reverse();

    tableContent = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="text-align: left;">Date</th>
            <th style="text-align: left;">Type</th>
            <th style="text-align: left;">Category</th>
            <th style="text-align: left;">Description</th>
            <th style="text-align: left;">Method</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${ledger.map(f => `
            <tr>
              <td>${f.date || 'N/A'}</td>
              <td>${f.type}</td>
              <td>${f.category}</td>
              <td>${f.description || ''}</td>
              <td>${f.method}</td>
              <td style="text-align: right;">৳${formatNumber(f.amount || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  printArea.innerHTML = `
    <div style="width: 100%; background: white; padding: 20px;">
        ${getPrintHeader(title)}
        ${tableContent}
        ${getPrintFooter()}
    </div>
  `;

  document.body.classList.add('printing-receipt');
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('printing-receipt'), 1000);
  }, 500);
}

window.printReceipt = printReceipt;
window.printReport = printReport;
window.printAccountDetails = printAccountDetails;
window.resetDemoData = resetDemoData;


window.showAccountDetails = showAccountDetails;
window.resetDetailFilters = resetDetailFilters;
window.renderAccountDetails = renderAccountDetails;
window.updateDetailCategoryDropdown = updateDetailCategoryDropdown;
window.handleSettingsSubmit = handleSettingsSubmit;
window.handleRefresh = handleRefresh;
window.getPrintHeader = getPrintHeader;
window.getPrintFooter = getPrintFooter;
window.printReceipt = printReceipt;
window.printReport = printReport;
window.printAccountDetails = printAccountDetails;
window.resetDemoData = resetDemoData;
