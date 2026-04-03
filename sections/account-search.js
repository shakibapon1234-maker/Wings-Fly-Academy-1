// ====================================
// WINGS FLY AVIATION ACADEMY
// ACCOUNT SEARCH — Unified Account Search, PDF/Excel Export, Print Reports
// Extracted from app.js (Phase 4)
// ====================================


// ===================================
// UNIFIED ACCOUNT SEARCH SYSTEM
// ===================================

// Global variable to store current search results (MUST be at top)
var currentSearchResults = {
  accountType: '',
  accountData: null,
  transactions: []
};

/**
 * Populate account dropdown options (flat list - no groups)
 */
function populateAccountDropdown() {
  const dropdown = document.getElementById('unifiedAccountSelect');
  if (!dropdown) return;

  let optionsHTML = '<option value="">-- Select an Account --</option>';
  optionsHTML += '<option value="all|all">🏛️ All Accounts</option>';

  // Add Cash
  optionsHTML += '<option value="cash|Cash">💵 Cash</option>';

  // Add all Bank Accounts
  (globalData.bankAccounts || []).forEach(acc => {
    optionsHTML += `<option value="bank|${acc.name}">🏦 ${acc.name}</option>`;
  });

  // Add all Mobile Banking accounts
  (globalData.mobileBanking || []).forEach(acc => {
    optionsHTML += `<option value="mobile|${acc.name}">📱 ${acc.name}</option>`;
  });

  dropdown.innerHTML = optionsHTML;
}

/**
 * Perform unified search with dropdown selection
 */

function showAllAccountsSearch(dateFrom, dateTo) {
  const fmt = window.formatNumber || (n => Number(n).toLocaleString('en-IN'));
  const allTx = (globalData.finance || []).filter(f => {
    const matchFrom = !dateFrom || (f.date && f.date >= dateFrom);
    const matchTo = !dateTo || (f.date && f.date <= dateTo);
    return matchFrom && matchTo;
  }).slice().reverse();

  const cashBal = parseFloat(globalData.cashBalance) || 0;
  const bankBal = (globalData.bankAccounts || []).reduce((a, b) => a + (parseFloat(b.balance) || 0), 0);
  const mobileBal = (globalData.mobileBanking || []).reduce((a, b) => a + (parseFloat(b.balance) || 0), 0);
  const totalBal = cashBal + bankBal + mobileBal;

  document.getElementById('unifiedSearchResults').classList.remove('d-none');
  document.getElementById('noSearchResults').classList.add('d-none');
  document.getElementById('searchTransactionHistory').classList.remove('d-none');

  document.getElementById('searchAccountDetails').innerHTML = `
    <div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.25);border-radius:14px;padding:20px;">
      <div style="font-size:1.1rem;font-weight:700;color:#00d9ff;margin-bottom:12px;">🏛️ ALL ACCOUNTS SUMMARY</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:10px;padding:12px 20px;text-align:center;">
          <div style="font-size:0.75rem;color:rgba(0,255,136,0.7);text-transform:uppercase;">Cash</div>
          <div style="font-size:1.2rem;font-weight:700;color:#00ff88;">৳${fmt(cashBal)}</div>
        </div>
        <div style="background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.3);border-radius:10px;padding:12px 20px;text-align:center;">
          <div style="font-size:0.75rem;color:rgba(0,217,255,0.7);text-transform:uppercase;">Bank</div>
          <div style="font-size:1.2rem;font-weight:700;color:#00d9ff;">৳${fmt(bankBal)}</div>
        </div>
        <div style="background:rgba(181,55,242,0.1);border:1px solid rgba(181,55,242,0.3);border-radius:10px;padding:12px 20px;text-align:center;">
          <div style="font-size:0.75rem;color:rgba(181,55,242,0.7);text-transform:uppercase;">Mobile</div>
          <div style="font-size:1.2rem;font-weight:700;color:#b537f2;">৳${fmt(mobileBal)}</div>
        </div>
        <div style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:12px 20px;text-align:center;">
          <div style="font-size:0.75rem;color:rgba(255,215,0,0.7);text-transform:uppercase;">Total</div>
          <div style="font-size:1.3rem;font-weight:800;color:#FFD700;">৳${fmt(totalBal)}</div>
        </div>
      </div>
    </div>`;

  let rows = '';
  allTx.forEach(f => {
    const amt = parseFloat(f.amount) || 0;
    const isIncome = ['Income', 'Loan Received', 'Loan Receiving', 'Transfer In'].includes(f.type);
    rows += `<tr>
      <td style="padding:8px;font-size:0.82rem;">${f.date || '-'}</td>
      <td style="padding:8px;"><span style="background:${isIncome ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,92,0.15)'};color:${isIncome ? '#00ff88' : '#ff3b5c'};padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">${f.type || '-'}</span></td>
      <td style="padding:8px;font-weight:600;color:#00d9ff;">${f.method || 'Cash'}</td>
      <td style="padding:8px;">${f.category || '-'}</td>
      <td style="padding:8px;color:rgba(255,255,255,0.6);">${f.person ? '👤 ' + f.person + '<br>' : ''}${f.description || f.note || '-'}</td>
      <td style="padding:8px;text-align:right;font-weight:700;color:${isIncome ? '#00ff88' : '#ff3b5c'};">৳${fmt(amt)}</td>
      <td style="padding:8px;text-align:right;">
        <button class="btn btn-sm text-danger p-0" onclick="window._handleDeleteTx('${f.id}')" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`;
  });

  document.getElementById('searchTransactionHistory').innerHTML = allTx.length === 0
    ? '<div class="text-center py-4 text-muted">No transactions found.</div>'
    : `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid rgba(0,217,255,0.2);">
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;">Date</th>
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;">Type</th>
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;">Account</th>
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;">Category</th>
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;">Details</th>
          <th style="padding:10px;color:rgba(0,217,255,0.7);font-size:0.72rem;text-transform:uppercase;text-align:right;">Amount</th>
          <th style="padding:10px;width:30px;"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
}
window.showAllAccountsSearch = showAllAccountsSearch;

function performUnifiedSearch() {
  console.log('🔍 performUnifiedSearch called');

  const selectValue = document.getElementById('unifiedAccountSelect').value;
  const dateFrom = document.getElementById('unifiedDateFrom').value;
  const dateTo = document.getElementById('unifiedDateTo').value;

  console.log('Search values:', { selectValue, dateFrom, dateTo });

  if (!selectValue) { alert('⚠️ Please select an account first!'); return; }
  const [accountType, accountName] = selectValue.split('|');
  if (accountType === 'all') {
    currentSearchResults = { accountType: 'all', accountData: null, transactions: [] };
    showAllAccountsSearch(dateFrom, dateTo);
    return;
  }

  let accountData = null;

  // Get account data based on type
  if (accountType === 'cash') {
    accountData = {
      name: 'CASH',
      balance: globalData.cashBalance || 0,
      type: 'Cash'
    };
  } else if (accountType === 'bank') {
    accountData = (globalData.bankAccounts || []).find(acc => acc.name === accountName);
  } else if (accountType === 'mobile') {
    accountData = (globalData.mobileBanking || []).find(acc => acc.name === accountName);
  }

  console.log('Account data:', accountData);

  // If no account found
  if (!accountData) {
    console.log('❌ Account not found');
    document.getElementById('unifiedSearchResults').classList.remove('d-none');
    document.getElementById('searchAccountDetails').innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Account not found
      </div>
    `;
    document.getElementById('searchTransactionHistory').classList.add('d-none');
    document.getElementById('noSearchResults').classList.remove('d-none');
    return;
  }

  // Store current search results globally
  currentSearchResults = {
    accountType: accountType,
    accountData: accountData,
    transactions: []
  };

  console.log('✅ Showing results');

  // Show results section
  document.getElementById('unifiedSearchResults').classList.remove('d-none');
  document.getElementById('noSearchResults').classList.add('d-none');
  document.getElementById('searchTransactionHistory').classList.remove('d-none');

  // Display account details
  displayAccountDetails(accountType, accountData);

  // Get and display transaction history
  const transactions = getAccountTransactions(accountType, accountData, dateFrom, dateTo);
  currentSearchResults.transactions = transactions;
  displayTransactionHistory(transactions, accountData);

  // Show success message
  if (typeof showSuccessToast === 'function') {
    showSuccessToast(`🔍 Showing results for ${accountData.name}`);
  }

  console.log('✅ Search complete:', transactions.length, 'transactions found');
}

/**
 * Display account details
 */
function displayAccountDetails(accountType, accountData) {
  let detailsHTML = '';

  if (accountType === 'cash') {
    document.getElementById('searchResultTitle').textContent = '💵 CASH';
    detailsHTML = `
      <div class="row">
        <div class="col-md-12">
          <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <div class="card-body text-white">
              <h4 class="fw-bold">💵 CASH</h4>
              <h2 class="fw-bold">৳${formatNumber(accountData.balance)}</h2>
              <p class="mb-0 opacity-75">Physical cash on hand</p>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (accountType === 'bank') {
    document.getElementById('searchResultTitle').textContent = `🏦 ${accountData.name}`;
    detailsHTML = `
      <div class="row">
        <div class="col-md-6">
          <div class="card bg-primary text-white">
            <div class="card-body">
              <h5 class="fw-bold">🏦 ${accountData.name}</h5>
              <p class="mb-1"><strong>Bank:</strong> ${accountData.bankName || 'N/A'}</p>
              <p class="mb-1"><strong>Branch:</strong> ${accountData.branch || 'N/A'}</p>
              <p class="mb-1"><strong>Account No:</strong> ${accountData.accountNo || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card bg-success text-white">
            <div class="card-body">
              <h6 class="opacity-75">Current Balance</h6>
              <h2 class="fw-bold">৳${formatNumber(accountData.balance || 0)}</h2>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (accountType === 'mobile') {
    document.getElementById('searchResultTitle').textContent = `📱 ${accountData.name}`;
    detailsHTML = `
      <div class="row">
        <div class="col-md-6">
          <div class="card bg-success text-white">
            <div class="card-body">
              <h5 class="fw-bold">📱 ${accountData.name}</h5>
              <p class="mb-1"><strong>Account No:</strong> ${accountData.accountNo || 'N/A'}</p>
              <p class="mb-0"><strong>Type:</strong> Mobile Banking</p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card bg-info text-white">
            <div class="card-body">
              <h6 class="opacity-75">Current Balance</h6>
              <h2 class="fw-bold">৳${formatNumber(accountData.balance || 0)}</h2>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById('searchAccountDetails').innerHTML = detailsHTML;
}

/**
 * Get transactions for an account
 * FIXED: Now checks both 'method' and 'paymentMethod' fields
 */
function getAccountTransactions(accountType, accountData, dateFrom, dateTo) {
  let transactions = [];
  const accountName = accountType === 'cash' ? 'Cash' : accountData.name;

  // Filter finance records by payment method
  transactions = (globalData.finance || []).filter(record => {
    // Check if payment method matches
    // FIX: Check both 'method' and 'paymentMethod' fields for compatibility
    const paymentMethod = record.paymentMethod || record.method;
    const matchesAccount = paymentMethod === accountName;

    if (!matchesAccount) return false;

    // Apply date filter if provided
    if (dateFrom || dateTo) {
      const recordDate = record.date;
      if (dateFrom && recordDate < dateFrom) return false;
      if (dateTo && recordDate > dateTo) return false;
    }

    return true;
  });

  // Sort by date (newest first)
  transactions.sort((a, b) => {
    const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
    const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
    return dateB - dateA;
  });

  return transactions;
}

/**
 * Display transaction history
 */
function displayTransactionHistory(transactions, accountData) {
  const tbody = document.getElementById('searchTransactionBody');

  if (transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No transactions found</td></tr>';
    document.getElementById('searchTotalAmount').textContent = '৳0';
    return;
  }

  let html = '';
  let runningBalance = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  // Calculate running balance from oldest to newest
  const reversedTransactions = [...transactions].reverse();

  reversedTransactions.forEach(record => {
    const amount = parseFloat(record.amount) || 0;

    // Check if this is an incoming transaction (positive to account balance)
    const isPositive = record.type === 'Income' ||
      record.type === 'Loan Received' || record.type === 'Loan Receiving' ||
      record.type === 'Transfer In';
    const isNegative = record.type === 'Expense' ||
      record.type === 'Loan Given' || record.type === 'Loan Giving' ||
      record.type === 'Transfer Out';

    if (isPositive) {
      runningBalance += amount;
      // Only count actual income (not loans) in totalIncome stat
      if (record.type === 'Income') totalIncome += amount;
    } else if (isNegative) {
      runningBalance -= amount;
      // Only count actual expenses (not loans) in totalExpense stat
      if (record.type === 'Expense') totalExpense += amount;
    }
  });

  // Now display from newest to oldest
  transactions.forEach(record => {
    const amount = parseFloat(record.amount) || 0;

    // Positive to account balance (includes loans - they move money)
    const isIncome = record.type === 'Income' ||
      record.type === 'Loan Received' || record.type === 'Loan Receiving' ||
      record.type === 'Transfer In';

    const amountClass = isIncome ? 'text-success' : 'text-danger';
    const amountSign = isIncome ? '+' : '-';

    html += `
      <tr>
        <td>${record.date || ''}</td>
        <td>
          <span class="badge ${isIncome ? 'bg-success' : 'bg-danger'}">
            ${record.type || 'N/A'}
          </span>
        </td>
        <td>${record.category || 'N/A'}</td>
        <td>
          <small>${record.details || 'N/A'}</small>
          ${record.receivedFrom ? `<br><small class="text-muted">From: ${record.receivedFrom}</small>` : ''}
          ${record.paidTo ? `<br><small class="text-muted">To: ${record.paidTo}</small>` : ''}
        </td>
        <td class="text-end ${amountClass} fw-bold">
          ${amountSign}৳${formatNumber(amount)}
        </td>
        <td class="text-end">
          ৳${formatNumber(runningBalance)}
        </td>
        <td class="text-center">
          <button class="btn btn-sm text-danger p-0" onclick="window._handleDeleteTx('${record.id}')" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;

    // Update running balance for next row
    const isPositiveForBalance = record.type === 'Income' ||
      record.type === 'Loan Received' ||
      record.type === 'Transfer In';

    if (isPositiveForBalance) {
      runningBalance -= amount;
    } else {
      runningBalance += amount;
    }
  });

  tbody.innerHTML = html;

  // Update summary
  const netAmount = totalIncome - totalExpense;
  const summaryClass = netAmount >= 0 ? 'text-success' : 'text-danger';
  document.getElementById('searchTotalAmount').innerHTML = `
    <span class="${summaryClass}">৳${formatNumber(Math.abs(netAmount))}</span>
    <br>
    <small class="text-success">+৳${formatNumber(totalIncome)}</small> /
    <small class="text-danger">-৳${formatNumber(totalExpense)}</small>
  `;
}

/**
 * Clear unified search
 */
function clearUnifiedSearch() {
  document.getElementById('unifiedAccountSelect').value = '';
  document.getElementById('unifiedDateFrom').value = '';
  document.getElementById('unifiedDateTo').value = '';
  document.getElementById('unifiedSearchResults').classList.add('d-none');
  currentSearchResults = {
    accountType: '',
    accountData: null,
    transactions: []
  };
}

// ===================================
// EXPORT FUNCTIONS (PDF, Excel, Print)
// ===================================

/**
 * Export account report to PDF
 */
function exportAccountToPDF() {
  if (!currentSearchResults.accountData) {
    alert('No account selected!');
    return;
  }

  const { accountType, accountData, transactions } = currentSearchResults;
  const dateFrom = document.getElementById('unifiedDateFrom').value;
  const dateTo = document.getElementById('unifiedDateTo').value;

  // Create PDF content
  let pdfContent = `
Account Report
===============

Account: ${accountData.name}
${accountType === 'bank' ? `Bank: ${accountData.bankName}\nBranch: ${accountData.branch}\nAccount No: ${accountData.accountNo}` : ''}
${accountType === 'mobile' ? `Account No: ${accountData.accountNo}` : ''}
Current Balance: ৳${formatNumber(accountData.balance || 0)}

${dateFrom || dateTo ? `Date Range: ${dateFrom || 'Beginning'} to ${dateTo || 'Today'}\n` : ''}

Transaction History
==================

`;

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(record => {
    const amount = parseFloat(record.amount) || 0;
    if (record.type === 'Income') totalIncome += amount;
    else totalExpense += amount;

    pdfContent += `
Date: ${record.date}
Type: ${record.type}
Category: ${record.category}
Amount: ${record.type === 'Income' ? '+' : '-'}৳${formatNumber(amount)}
Details: ${record.details || 'N/A'}
${record.receivedFrom ? `From: ${record.receivedFrom}` : ''}
${record.paidTo ? `To: ${record.paidTo}` : ''}
-------------------
`;
  });

  pdfContent += `
Summary
=======
Total Income: ৳${formatNumber(totalIncome)}
Total Expense: ৳${formatNumber(totalExpense)}
Net: ৳${formatNumber(totalIncome - totalExpense)}
`;

  // Download as text file (you can integrate jsPDF library for actual PDF)
  const blob = new Blob([pdfContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${accountData.name}_Report_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showSuccessToast('📄 Report downloaded!');
}

/**
 * Export account report to Excel
 */
function exportAccountToExcel() {
  if (!currentSearchResults.accountData) {
    alert('No account selected!');
    return;
  }

  const { accountData, transactions } = currentSearchResults;

  // Create CSV content
  let csvContent = 'Date,Type,Category,Details,Amount,From/To\n';

  transactions.forEach(record => {
    const amount = parseFloat(record.amount) || 0;
    const sign = record.type === 'Income' ? '+' : '-';
    const person = record.receivedFrom || record.paidTo || '';

    csvContent += `${record.date},"${record.type}","${record.category}","${record.details || ''}","${sign}${amount}","${person}"\n`;
  });

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${accountData.name}_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showSuccessToast('📊 Excel file downloaded!');
}

/**
 * Print account report
 */

function printAllAccountsReport() {
  const dateFrom = document.getElementById('unifiedDateFrom').value;
  const dateTo = document.getElementById('unifiedDateTo').value;
  const fmt = window.formatNumber || (n => Number(n).toLocaleString('en-IN'));
  const cashBal = parseFloat(globalData.cashBalance) || 0;
  const bankBal = (globalData.bankAccounts || []).reduce((a, b) => a + (parseFloat(b.balance) || 0), 0);
  const mobileBal = (globalData.mobileBanking || []).reduce((a, b) => a + (parseFloat(b.balance) || 0), 0);
  const allTx = (globalData.finance || []).filter(f => {
    return (!dateFrom || f.date >= dateFrom) && (!dateTo || f.date <= dateTo);
  }).slice().reverse();
  let rows = '', totalIn = 0, totalOut = 0;
  allTx.forEach(f => {
    const amt = parseFloat(f.amount) || 0;
    const isIn = ['Income', 'Loan Received', 'Transfer In'].includes(f.type);
    if (isIn) totalIn += amt; else totalOut += amt;
    rows += `<tr><td>${f.date || '-'}</td><td>${f.type || '-'}</td><td>${f.method || 'Cash'}</td><td>${f.category || '-'}</td><td>${f.description || '-'}</td><td style="text-align:right;color:${isIn ? 'green' : 'red'}">${isIn ? '+' : '-'}৳${fmt(amt)}</td></tr>`;
  });
  const pw = window.open('', '_blank');
  pw.document.write(`<!DOCTYPE html><html><head><title>All Accounts</title>
  <style>body{font-family:Arial;padding:20px}h2{border-bottom:2px solid #333;padding-bottom:8px}.cards{display:flex;gap:12px;margin:12px 0;flex-wrap:wrap}.card{border:1px solid #ccc;border-radius:8px;padding:10px 16px;text-align:center}.label{font-size:0.7rem;color:#666;text-transform:uppercase}.val{font-size:1.1rem;font-weight:700}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;font-size:0.82rem}th{background:#333;color:#fff}.totals{margin-top:12px;background:#f5f5f5;padding:10px;border-radius:6px}@media print{button{display:none}}</style>
  </head><body>
  <h2>🏛️ All Accounts Report</h2>
  <div>Date: ${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString())}${dateFrom || dateTo ? ' | ' + (dateFrom || 'Start') + ' → ' + (dateTo || 'Today') : ''}</div>
  <div class="cards">
    <div class="card"><div class="label">Cash</div><div class="val">৳${fmt(cashBal)}</div></div>
    <div class="card"><div class="label">Bank</div><div class="val">৳${fmt(bankBal)}</div></div>
    <div class="card"><div class="label">Mobile</div><div class="val">৳${fmt(mobileBal)}</div></div>
    <div class="card" style="background:#fffde7"><div class="label">Total</div><div class="val">৳${fmt(cashBal + bankBal + mobileBal)}</div></div>
  </div>
  <table><thead><tr><th>Date</th><th>Type</th><th>Account</th><th>Category</th><th>Details</th><th>Amount</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center">No transactions</td></tr>'}</tbody></table>
  <div class="totals">Income: <b style="color:green">৳${fmt(totalIn)}</b> | Expense: <b style="color:red">৳${fmt(totalOut)}</b> | Net: <b>৳${fmt(totalIn - totalOut)}</b></div>
  <br><button onclick="window.print()" style="padding:10px 24px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Print</button>
  </body></html>`);
  pw.document.close();
}
window.printAllAccountsReport = printAllAccountsReport;

function printAccountReport() {
  if (currentSearchResults.accountType === 'all') { printAllAccountsReport(); return; }
  if (!currentSearchResults.accountData) { alert('No account selected!'); return; }

  const { accountType, accountData, transactions } = currentSearchResults;
  const dateFrom = document.getElementById('unifiedDateFrom').value;
  const dateTo = document.getElementById('unifiedDateTo').value;

  // Create print window
  const printWindow = window.open('', '_blank');

  let printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${accountData.name} - Account Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #667eea; color: white; }
        .income { color: green; font-weight: bold; }
        .expense { color: red; font-weight: bold; }
        .summary { background: #e3f2fd; padding: 15px; margin-top: 20px; border-radius: 8px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${accountData.name} - Transaction Report</h1>
      
      <div class="info">
        <strong>Account:</strong> ${accountData.name}<br>
        ${accountType === 'bank' ? `<strong>Bank:</strong> ${accountData.bankName}<br><strong>Branch:</strong> ${accountData.branch}<br><strong>Account No:</strong> ${accountData.accountNo}<br>` : ''}
        ${accountType === 'mobile' ? `<strong>Account No:</strong> ${accountData.accountNo}<br>` : ''}
        <strong>Current Balance:</strong> ৳${formatNumber(accountData.balance || 0)}<br>
        ${dateFrom || dateTo ? `<strong>Date Range:</strong> ${dateFrom || 'Beginning'} to ${dateTo || 'Today'}<br>` : ''}
        <strong>Report Date:</strong> ${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString())}
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Details</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(record => {
    const amount = parseFloat(record.amount) || 0;
    const isIncome = record.type === 'Income';
    if (isIncome) totalIncome += amount;
    else totalExpense += amount;

    printContent += `
      <tr>
        <td>${record.date}</td>
        <td>${record.type}</td>
        <td>${record.category}</td>
        <td>${record.details || 'N/A'}${record.receivedFrom ? '<br>From: ' + record.receivedFrom : ''}${record.paidTo ? '<br>To: ' + record.paidTo : ''}</td>
        <td class="${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}৳${formatNumber(amount)}</td>
      </tr>
    `;
  });

  printContent += `
        </tbody>
      </table>

      <div class="summary">
        <strong>Summary:</strong><br>
        Total Income: <span class="income">৳${formatNumber(totalIncome)}</span><br>
        Total Expense: <span class="expense">৳${formatNumber(totalExpense)}</span><br>
        <strong>Net Amount: ৳${formatNumber(totalIncome - totalExpense)}</strong>
      </div>

      <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
}

// Expose functions globally for Sync System
window.performUnifiedSearch = performUnifiedSearch;
window.clearUnifiedSearch = clearUnifiedSearch;
window.populateAccountDropdown = populateAccountDropdown;
window.exportAccountToPDF = exportAccountToPDF;
window.exportAccountToExcel = exportAccountToExcel;
window.printAccountReport = printAccountReport;
