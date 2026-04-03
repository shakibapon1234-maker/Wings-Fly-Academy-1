// ====================================
// WINGS FLY AVIATION ACADEMY
// ACCOUNTS MANAGEMENT — Bank, Mobile Banking, Cash, Transfers
// Extracted from app.js (Phase 4)
// ====================================

// ✅ FIX: Inject missing modal HTML into DOM (accountModal, mobileModal, transferModal)
(function injectAccountModals() {
  if (document.getElementById('accountModal')) return; // Already exists

  const modalHTML = `
    <!-- ===== CASH MODAL ===== -->
    <div class="modal fade" id="cashModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="background:#0d1b2a; color:#e0f0ff; border-radius:16px;">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold" style="color:#f093fb;">
              <span class="me-2">💵</span>Update Cash Balance
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-3">
            <form id="cashForm" onsubmit="handleCashSubmit(event)">
              <div class="mb-4">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Cash Balance (৳)</label>
                <input type="number" name="cashBalance" class="form-control form-control-lg"
                  style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;font-size:1.4rem;font-weight:700;"
                  placeholder="0" value="0" min="0" step="0.01">
                <small style="color:rgba(240,147,251,0.6);">Physical cash on hand এর পরিমাণ লিখুন</small>
              </div>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn fw-bold px-4"
                  style="background:linear-gradient(135deg,#f093fb,#f5576c);border:none;color:#fff;">
                  💾 Update Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== BANK ACCOUNT MODAL ===== -->
    <div class="modal fade" id="accountModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="background:#0d1b2a; color:#e0f0ff; border-radius:16px;">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold" style="color:#00d9ff;"><span class="me-2 header-icon-circle bg-primary-light">🏦</span>Add New Bank Account</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-3">
            <form id="accountForm" onsubmit="handleAccountSubmit(event)">
              <input type="hidden" name="accountIndex" value="-1">
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Account Name</label>
                <input type="text" name="name" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. CITY BANK" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Branch</label>
                <input type="text" name="branch" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. Bonosree">
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Bank Name / Tag</label>
                <input type="text" name="bankName" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. WINGS FLY" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Account Number</label>
                <input type="text" name="accountNo" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. 1493888742001" required>
              </div>
              <div class="mb-4">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Opening Balance (৳)</label>
                <input type="number" name="balance" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="0" value="0" min="0" step="0.01">
              </div>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary fw-bold px-4">💾 Save Account</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== MOBILE BANKING MODAL ===== -->
    <div class="modal fade" id="mobileModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="background:#0d1b2a; color:#e0f0ff; border-radius:16px;">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold" style="color:#00ff99;"><span class="me-2 header-icon-circle bg-success-light">📱</span>Add Mobile Banking</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-3">
            <form id="mobileForm" onsubmit="handleMobileSubmit(event)">
              <input type="hidden" name="mobileIndex" value="-1">
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Account Name</label>
                <input type="text" name="name" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. bKash, Nagad, Rocket" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Account Number</label>
                <input type="text" name="accountNo" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. 01712345678">
              </div>
              <div class="mb-4">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Opening Balance (৳)</label>
                <input type="number" name="balance" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="0" value="0" min="0" step="0.01">
              </div>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-success fw-bold px-4">💾 Save Account</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== TRANSFER MODAL ===== -->
    <div class="modal fade" id="transferModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="background:#0d1b2a; color:#e0f0ff; border-radius:16px;">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold" style="color:#f0c040;">🔄 Transfer Balance</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-3">
            <form id="transferForm" onsubmit="handleTransferSubmit(event)">
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">From Account</label>
                <select name="fromAccount" id="accTransferFrom" class="form-select" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" required>
                  <option value="">-- Select Source --</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">To Account</label>
                <select name="toAccount" id="accTransferTo" class="form-select" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" required>
                  <option value="">-- Select Destination --</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Amount (৳)</label>
                <input type="number" name="amount" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="0" min="1" step="0.01" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Date</label>
                <input type="date" name="date" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" required>
              </div>
              <div class="mb-4">
                <label class="form-label fw-semibold" style="color:#a0c4ff;">Notes (optional)</label>
                <input type="text" name="notes" class="form-control" style="background:#162032;color:#e0f0ff;border-color:#1e3a5f;" placeholder="e.g. Internal Transfer">
              </div>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn fw-bold px-4" style="background:#f0c040;color:#000;">🔄 Transfer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject into body
  const wrapper = document.createElement('div');
  wrapper.innerHTML = modalHTML;
  document.body.appendChild(wrapper);
  console.log('✅ Account modals injected into DOM');
})();

function renderAccountList() {
  const container = document.getElementById('accountTableBody');
  const noAccountsMsg = document.getElementById('noAccountsMessage');
  const searchInput = document.getElementById('accountSearchInput');
  const totalBalanceEl = document.getElementById('totalAccountBalance');

  if (!container) return;

  // Update unified search dropdown whenever account list renders
  if (typeof populateAccountDropdown === 'function') {
    populateAccountDropdown();
  }

  const query = (searchInput?.value || '').toLowerCase();
  const accounts = (globalData.bankAccounts || []).filter(acc =>
    acc.name.toLowerCase().includes(query) ||
    acc.bankName.toLowerCase().includes(query) ||
    acc.accountNo.toLowerCase().includes(query) ||
    (acc.branch && acc.branch.toLowerCase().includes(query))
  );

  if (accounts.length === 0) {
    container.innerHTML = '';
    noAccountsMsg.classList.remove('d-none');
    totalBalanceEl.innerText = '৳0';
    return;
  }

  noAccountsMsg.classList.add('d-none');
  let html = '';
  let totalBalance = 0;

  accounts.forEach((acc, index) => {
    const bal = parseFloat(acc.balance) || 0;
    totalBalance += bal;
    html += `
      <tr>
        <td style="padding: 1rem;">${acc.sl || index + 1}</td>
        <td style="padding: 1rem;">
          <div class="fw-bold text-av-main">${acc.name}</div>
        </td>
        <td style="padding: 1rem;">${acc.branch || '-'}</td>
        <td style="padding: 1rem;">
          <span class="badge bg-light text-dark border">${acc.bankName}</span>
        </td>
        <td style="padding: 1rem;"><code>${acc.accountNo}</code></td>
        <td style="padding: 1rem; text-align: right;" class="fw-bold text-success font-monospace">৳${formatNumber(bal)}</td>
        <td style="padding: 1rem; text-align: end;">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary border-0 rounded-circle" onclick="openAccountModal(${globalData.bankAccounts.indexOf(acc)})">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-outline-danger border-0 rounded-circle" onclick="deleteAccount(${globalData.bankAccounts.indexOf(acc)})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  totalBalanceEl.innerText = '৳' + formatNumber(totalBalance);
}

function openAccountModal(index = -1) {
  const form = document.getElementById('accountForm');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('accountModal'));

  form.reset();
  form.accountIndex.value = index;

  if (index >= 0) {
    const acc = globalData.bankAccounts[index];
    form.name.value = acc.name;
    form.branch.value = acc.branch || '';
    form.bankName.value = acc.bankName;
    form.accountNo.value = acc.accountNo;
    form.balance.value = acc.balance;
    document.querySelector('#accountModal .modal-title').innerHTML = '<span class="me-2 header-icon-circle bg-primary-light">🏦</span>Edit Bank Account';
  } else {
    document.querySelector('#accountModal .modal-title').innerHTML = '<span class="me-2 header-icon-circle bg-primary-light">🏦</span>Add New Bank Account';
  }

  modal.show();
}

async function handleAccountSubmit(e) {
  console.log('handleAccountSubmit called'); // DEBUG
  e.preventDefault();
  const form = e.target;
  const index = parseInt(form.accountIndex.value);

  console.log('Form data:', { // DEBUG
    name: form.name.value,
    branch: form.branch.value,
    bankName: form.bankName.value,
    accountNo: form.accountNo.value,
    balance: form.balance.value,
    index: index
  });

  // CRITICAL: Ensure bankAccounts array exists
  if (!globalData.bankAccounts) {
    globalData.bankAccounts = [];
  }

  const accountData = {
    name: form.name.value.trim(),
    branch: form.branch.value,
    bankName: form.bankName.value,
    accountNo: form.accountNo.value,
    balance: parseFloat(form.balance.value) || 0,
    sl: index >= 0 ? globalData.bankAccounts[index].sl : globalData.bankAccounts.length + 1
  };

  try {
    if (index >= 0) {
      const oldName = globalData.bankAccounts[index].name;
      globalData.bankAccounts[index] = accountData;
      // No need to update paymentMethods - handled dynamically in populateDropdowns
      showSuccessToast('✅ Bank account updated successfully!');
    } else {
      console.log('Adding new account...'); // DEBUG
      globalData.bankAccounts.push(accountData);
      // No need to add to paymentMethods - handled dynamically in populateDropdowns
      console.log('Account added, showing toast...'); // DEBUG
      showSuccessToast('✅ New bank account added successfully!');
    }

    console.log('Closing modal...'); // DEBUG
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
    if (modalInstance) modalInstance.hide();

    console.log('Saving to storage...'); // DEBUG
    await saveToStorage();
    console.log('Rendering account list...'); // DEBUG
    renderAccountList();
    if (typeof populateDropdowns === 'function') populateDropdowns();
    console.log('Done!'); // DEBUG
  } catch (error) {
    console.error('Error in handleAccountSubmit:', error);
    showErrorToast('Failed to save account: ' + error.message);
  }
}

async function deleteAccount(index) {
  if (!confirm('Are you sure you want to delete this bank account?')) return;

  const accName = globalData.bankAccounts[index].name;
  globalData.bankAccounts.splice(index, 1);

  // No need to remove from paymentMethods - handled dynamically in populateDropdowns

  // Re-index SL
  globalData.bankAccounts.forEach((acc, i) => acc.sl = i + 1);

  await saveToStorage();
  renderAccountList();
  if (typeof populateDropdowns === 'function') populateDropdowns();
  showSuccessToast('🗑️ Account deleted successfully');
}

function openTransferModal() {
  const modal = new bootstrap.Modal(document.getElementById('transferModal'));
  const form = document.getElementById('transferForm');
  form.reset();
  form.date.value = new Date().toISOString().split('T')[0];
  modal.show();
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fromAcc = form.fromAccount.value;
  const toAcc = form.toAccount.value;
  const amount = parseFloat(form.amount.value);
  const date = form.date.value;
  const notes = form.notes.value || 'Internal Transfer';

  if (!fromAcc || !toAcc || fromAcc === toAcc) {
    alert('Please select two different accounts.');
    return;
  }
  if (amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  // Helper function to find account (Cash, Bank, or Mobile)
  function findAccount(accountName) {
    if (accountName === 'Cash') {
      return { type: 'cash', account: null };
    }

    let account = globalData.bankAccounts.find(a => a.name === accountName);
    if (account) {
      return { type: 'bank', account: account };
    }

    account = globalData.mobileBanking.find(a => a.name === accountName);
    if (account) {
      return { type: 'mobile', account: account };
    }

    return null;
  }

  // Find source and destination accounts
  const sourceResult = findAccount(fromAcc);
  const destResult = findAccount(toAcc);

  if (!sourceResult) {
    alert('Source account not found: ' + fromAcc);
    return;
  }

  if (!destResult) {
    alert('Destination account not found: ' + toAcc);
    return;
  }

  // Check if source has enough balance
  let sourceBalance = 0;
  if (sourceResult.type === 'cash') {
    sourceBalance = parseFloat(globalData.cashBalance) || 0;
  } else {
    sourceBalance = parseFloat(sourceResult.account.balance) || 0;
  }

  if (sourceBalance < amount) {
    alert(`Insufficient balance in ${fromAcc}. Available: ৳${sourceBalance}`);
    return;
  }

  // Do not mutate balances here.
  // Canonical balance changes are applied once via finance-engine (feApplyEntryToAccount).

  // Record in Ledger (Two entries for clarity)
  const transferOut = {
    date: date,
    category: 'Transfer',
    type: 'Transfer Out',
    method: fromAcc,
    amount: amount,
    person: toAcc,
    notes: notes,
    rowIndex: globalData.finance.length + 1
  };
  globalData.finance.push(transferOut);
  // ✅ FIX: Apply to account balance using canonical function
  if (typeof window.feApplyEntryToAccount === 'function') {
    window.feApplyEntryToAccount(transferOut, +1);
  }

  const transferIn = {
    date: date,
    category: 'Transfer',
    type: 'Transfer In',
    method: toAcc,
    amount: amount,
    person: fromAcc,
    notes: notes,
    rowIndex: globalData.finance.length + 1
  };
  globalData.finance.push(transferIn);
  // ✅ FIX: Apply to account balance using canonical function
  if (typeof window.feApplyEntryToAccount === 'function') {
    window.feApplyEntryToAccount(transferIn, +1);
  }

  bootstrap.Modal.getInstance(document.getElementById('transferModal')).hide();
  await saveToStorage();

  // Update all displays
  renderAccountList();
  if (typeof renderCashBalance === 'function') renderCashBalance();
  if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
  if (typeof updateGrandTotal === 'function') updateGrandTotal();
  updateGlobalStats();

  showSuccessToast('✅ Balance transferred successfully!');
}

// Global Exposure
window.renderAccountList = renderAccountList;
window.openAccountModal = openAccountModal;
window.handleAccountSubmit = handleAccountSubmit;
window.deleteAccount = deleteAccount;
window.openTransferModal = openTransferModal;
window.handleTransferSubmit = handleTransferSubmit;


// === NEW ACTIONS MODAL LOGIC ===

// ========================================
// MOBILE BANKING MANAGEMENT
// ========================================

function renderMobileBankingList() {
  const container = document.getElementById('mobileTableBody');
  const noAccountsMsg = document.getElementById('noMobileMessage');
  const searchInput = document.getElementById('mobileSearchInput');
  const totalBalanceEl = document.getElementById('totalMobileBalance');
  const combinedTotalEl = document.getElementById('combinedTotalBalance');

  if (!container) return;

  // Initialize mobile banking if not exists
  if (!globalData.mobileBanking) globalData.mobileBanking = [];

  // Update unified search dropdown whenever mobile accounts render
  if (typeof populateAccountDropdown === 'function') {
    populateAccountDropdown();
  }

  const query = (searchInput?.value || '').toLowerCase();
  const accounts = (globalData.mobileBanking || []).filter(acc =>
    acc.name.toLowerCase().includes(query) ||
    (acc.accountNo && acc.accountNo.toLowerCase().includes(query))
  );

  if (accounts.length === 0) {
    container.innerHTML = '';
    if (noAccountsMsg) noAccountsMsg.classList.remove('d-none');
    if (totalBalanceEl) totalBalanceEl.innerText = '৳0';
    updateCombinedTotal();
    return;
  }

  if (noAccountsMsg) noAccountsMsg.classList.add('d-none');
  let html = '';
  let totalBalance = 0;

  accounts.forEach((acc, index) => {
    const bal = parseFloat(acc.balance) || 0;
    totalBalance += bal;
    html += `
      <tr>
        <td style="padding: 1rem;">${acc.sl || index + 1}</td>
        <td style="padding: 1rem;">
          <div class="fw-bold text-av-main">${acc.name}</div>
        </td>
        <td style="padding: 1rem;"><code>${acc.accountNo || '-'}</code></td>
        <td style="padding: 1rem; text-align: right;" class="fw-bold text-success font-monospace">৳${formatNumber(bal)}</td>
        <td style="padding: 1rem; text-align: end;">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary border-0 rounded-circle" onclick="openMobileModal(${globalData.mobileBanking.indexOf(acc)})">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-outline-danger border-0 rounded-circle" onclick="deleteMobileAccount(${globalData.mobileBanking.indexOf(acc)})">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  if (totalBalanceEl) totalBalanceEl.innerText = '৳' + formatNumber(totalBalance);
  updateCombinedTotal();
}

function updateCombinedTotal() {
  const bankTotal = (globalData.bankAccounts || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
  const mobileTotal = (globalData.mobileBanking || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
  const combined = bankTotal + mobileTotal;

  const combinedEl = document.getElementById('combinedTotalBalance');
  if (combinedEl) {
    combinedEl.innerText = '৳' + formatNumber(combined);
  }
}

function openMobileModal(index = -1) {
  const form = document.getElementById('mobileForm');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mobileModal'));

  if (!globalData.mobileBanking) globalData.mobileBanking = [];

  form.reset();
  form.mobileIndex.value = index;

  if (index >= 0) {
    const acc = globalData.mobileBanking[index];
    form.name.value = acc.name;
    form.accountNo.value = acc.accountNo || '';
    form.balance.value = acc.balance;
    document.querySelector('#mobileModal .modal-title').innerHTML = '<span class="me-2 header-icon-circle bg-success-light">📱</span>Edit Mobile Banking';
  } else {
    document.querySelector('#mobileModal .modal-title').innerHTML = '<span class="me-2 header-icon-circle bg-success-light">📱</span>Add Mobile Banking';
  }

  modal.show();
}

async function handleMobileSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const index = parseInt(form.mobileIndex.value);

  if (!globalData.mobileBanking) globalData.mobileBanking = [];

  const accountData = {
    sl: index >= 0 ? globalData.mobileBanking[index].sl : globalData.mobileBanking.length + 1,
    name: form.name.value.trim(),
    accountNo: form.accountNo.value.trim(),
    balance: parseFloat(form.balance.value) || 0
  };

  try {
    if (index >= 0) {
      globalData.mobileBanking[index] = accountData;
      showSuccessToast('✅ Mobile banking updated successfully!');
    } else {
      globalData.mobileBanking.push(accountData);
      showSuccessToast('✅ Mobile banking added successfully!');
    }

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('mobileModal'));
    if (modalInstance) modalInstance.hide();

    await saveToStorage();
    renderMobileBankingList();
    if (typeof renderAccountList === 'function') renderAccountList();
    if (typeof populateDropdowns === 'function') populateDropdowns();
  } catch (error) {
    console.error('Error in handleMobileSubmit:', error);
    showErrorToast('Failed to save mobile account: ' + error.message);
  }
}

async function deleteMobileAccount(index) {
  if (!confirm('Are you sure you want to delete this mobile banking account?')) return;

  const accName = globalData.mobileBanking[index].name;
  globalData.mobileBanking.splice(index, 1);

  await saveToStorage();
  renderMobileBankingList();
  if (typeof renderAccountList === 'function') renderAccountList();
  if (typeof populateDropdowns === 'function') populateDropdowns();
  updateGlobalStats();
  showSuccessToast('🗑️ Mobile account deleted successfully!');
}

// Update renderAccountList to also update combined total
const originalRenderAccountList = renderAccountList;
renderAccountList = function () {
  originalRenderAccountList();
  updateCombinedTotal();
};

// Global Exposure
window.renderMobileBankingList = renderMobileBankingList;
window.openMobileModal = openMobileModal;
window.handleMobileSubmit = handleMobileSubmit;
window.deleteMobileAccount = deleteMobileAccount;
window.updateCombinedTotal = updateCombinedTotal;

/* =========================================================
   CASH MANAGEMENT FUNCTIONS
   ========================================================= */

function renderCashBalance() {
  const cashBalanceEl = document.getElementById('cashBalance');
  if (!cashBalanceEl) return;

  // Initialize cash balance if not exists
  if (typeof globalData.cashBalance === 'undefined') {
    globalData.cashBalance = 0;
  }

  const balance = parseFloat(globalData.cashBalance) || 0;
  cashBalanceEl.innerText = '৳' + formatNumber(balance);
  updateGrandTotal();
}

function openCashModal() {
  const form = document.getElementById('cashForm');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('cashModal'));

  if (typeof globalData.cashBalance === 'undefined') {
    globalData.cashBalance = 0;
  }

  form.reset();
  form.cashBalance.value = globalData.cashBalance || 0;

  modal.show();
}

async function handleCashSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const newBalance = parseFloat(form.cashBalance.value) || 0;
  globalData.cashBalance = newBalance;

  try {
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('cashModal'));
    if (modalInstance) modalInstance.hide();

    await saveToStorage();
    renderCashBalance();
    if (typeof populateDropdowns === 'function') populateDropdowns();

    showSuccessToast('✅ Cash balance updated successfully!');
  } catch (error) {
    console.error('Error in handleCashSubmit:', error);
    showErrorToast('Failed to update cash balance: ' + error.message);
  }
}

function updateGrandTotal() {
  const cashTotal = parseFloat(globalData.cashBalance) || 0;
  const bankTotal = (globalData.bankAccounts || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
  const mobileTotal = (globalData.mobileBanking || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
  const grandTotal = cashTotal + bankTotal + mobileTotal;

  // Update Total Balance Card in Bank Details section (this is now the only grand total display)
  const totalBalanceCash = document.getElementById('totalBalanceCash');
  const totalBalanceBank = document.getElementById('totalBalanceBank');
  const totalBalanceMobile = document.getElementById('totalBalanceMobile');
  const totalBalanceGrand = document.getElementById('totalBalanceGrand');

  if (totalBalanceCash) totalBalanceCash.innerText = '৳' + formatNumber(cashTotal);
  if (totalBalanceBank) totalBalanceBank.innerText = '৳' + formatNumber(bankTotal);
  if (totalBalanceMobile) totalBalanceMobile.innerText = '৳' + formatNumber(mobileTotal);
  if (totalBalanceGrand) totalBalanceGrand.innerText = '৳' + formatNumber(grandTotal);
}

// Update existing functions to also update grand total
const originalRenderAccountListForGrand = renderAccountList;
renderAccountList = function () {
  originalRenderAccountListForGrand();
  updateGrandTotal();
};

const originalRenderMobileBankingListForGrand = renderMobileBankingList;
renderMobileBankingList = function () {
  originalRenderMobileBankingListForGrand();
  updateGrandTotal();
};

// Global Exposure
window.renderCashBalance = renderCashBalance;
window.openCashModal = openCashModal;
window.handleCashSubmit = handleCashSubmit;
window.updateGrandTotal = updateGrandTotal;

/* =========================================================
   WINGS FLY – BANK ACCOUNT ↔ PAYMENT METHOD SYNC SYSTEM
   SAFE DROP-IN MODULE (NO REPLACE REQUIRED)
   ========================================================= */

/* 1️⃣ Payment Method = ONLY Bank Accounts */
function syncPaymentMethodsWithAccounts() {
  if (!window.globalData) return;

  if (!Array.isArray(globalData.bankAccounts)) {
    globalData.bankAccounts = [];
  }

  // ✅ FIX: Keep core methods + bank accounts + mobile banking
  // Old code was: globalData.paymentMethods = bankAccounts.map(acc => acc.name)
  // This was DELETING Cash, Nagad, Bkash etc. — critical bug!
  const coreMethods = ['Cash'];
  const bankNames = globalData.bankAccounts.map(acc => acc.name);
  const mobileNames = (globalData.mobileBanking || []).map(acc => acc.name);
  globalData.paymentMethods = [...new Set([...coreMethods, ...bankNames, ...mobileNames])];

  saveToStorage(true);

  if (typeof populateDropdowns === 'function') {
    populateDropdowns();
  }

  console.log('✅ Payment methods synced:', globalData.paymentMethods);
}
window.syncPaymentMethodsWithAccounts = syncPaymentMethodsWithAccounts;


/* 2️⃣ Calculate Total Bank Balance (Dashboard Fix) */
function calculateTotalBankBalance() {
  if (!globalData.bankAccounts) return 0;

  return globalData.bankAccounts.reduce((total, acc) => {
    return total + (parseFloat(acc.balance) || 0);
  }, 0);
}
window.calculateTotalBankBalance = calculateTotalBankBalance;


/* 3️⃣ Dashboard Auto Balance Update */
function updateDashboardBankBalance() {
  const el =
    document.getElementById('totalBalance') ||
    document.getElementById('dashboardTotalBalance') ||
    document.getElementById('bankTotal');

  if (!el) return;

  el.innerText = '৳' + formatNumber(calculateTotalBankBalance());
}
window.updateDashboardBankBalance = updateDashboardBankBalance;


/* 4️⃣ SMART ACCOUNTING LOGIC
      Income → Balance +
      Expense → Balance -
*/
function applyFinanceToBankAccount(entry) {
  if (!entry || !entry.method) return;

  const account = globalData.bankAccounts.find(
    acc => acc.name === entry.method
  );
  if (!account) return;

  const amount = parseFloat(entry.amount) || 0;

  if (entry.type === 'Income' || entry.type === 'Loan Received' || entry.type === 'Loan Receiving') {
    account.balance = (parseFloat(account.balance) || 0) + amount;
  }

  if (
    entry.type === 'Expense' ||
    entry.type === 'Loan Given' || entry.type === 'Loan Giving' ||
    entry.type === 'Salary' ||
    entry.type === 'Rent' ||
    entry.type === 'Utilities'
  ) {
    account.balance = (parseFloat(account.balance) || 0) - amount;
  }

  saveToStorage(true);
  updateDashboardBankBalance();
}


/* 5️⃣ Hook into Finance Save (AUTO APPLY) */
// ✅ v8 FIX: hookFinanceSave নিষ্ক্রিয় করা হয়েছে।
// কারণ: finance-engine.js এর feApplyEntryToAccount() এবং feRebuildAllBalances()
// এখন সব balance update করে। hookFinanceSave চালু থাকলে প্রতিটি
// finance.push() এ balance দুইবার apply হতো — একবার এই hook এ,
// আরেকবার finance-engine এ। এটাই double-entry সমস্যার মূল কারণ ছিল।
// applyFinanceToBankAccount() ফাংশনটি রাখা হয়েছে (অন্য জায়গায় call হতে পারে),
// কিন্তু finance.push() override আর করা হচ্ছে না।
(function hookFinanceSave() {
  console.log('ℹ️ hookFinanceSave: disabled — finance-engine.js handles all balance updates (v8)');
})();


/* 6️⃣ Auto Sync on App Load */
document.addEventListener('DOMContentLoaded', () => {
  syncPaymentMethodsWithAccounts();
  updateDashboardBankBalance();
});
/* =========================================================
   FINAL BANK ACCOUNT RECONCILIATION SYSTEM
   ========================================================= */

/* 🔁 Rebuild ALL account balances from finance data */
function rebuildBankBalancesFromFinance() {
  // finance-engine.js loaded থাকলে সেটাই সব করবে (canonical, consistent)
  if (typeof window.feRebuildAllBalances === 'function') {
    window.feRebuildAllBalances();
    if (typeof saveToStorage === 'function') saveToStorage(true);
    if (typeof updateDashboardBankBalance === 'function') updateDashboardBankBalance();
    console.log('🔄 rebuildBankBalancesFromFinance → delegated to feRebuildAllBalances');
    return;
  }

  // ── Fallback (finance-engine.js not yet loaded) ──
  const gd = window.globalData || {};
  if (!gd.finance) return;

  const startBalances = (gd.settings && gd.settings.startBalances) || {};

  // Reset to startBalances
  (gd.bankAccounts || []).forEach(acc => {
    acc.balance = parseFloat(startBalances[acc.name]) || 0;
  });
  (gd.mobileBanking || []).forEach(acc => {
    acc.balance = parseFloat(startBalances[acc.name]) || 0;
  });

  // Canonical lists — must match finance-engine.js
  const MONEY_IN  = ['Income', 'Loan Received', 'Loan Receiving', 'Transfer In', 'Registration', 'Refund'];
  const MONEY_OUT = ['Expense', 'Loan Given', 'Loan Giving', 'Salary', 'Rent', 'Utilities', 'Transfer Out'];

  (gd.finance || []).forEach(entry => {
    if (entry._deleted || !entry.method || !entry.amount) return;
    let account = (gd.bankAccounts || []).find(acc => acc.name === entry.method);
    if (!account) account = (gd.mobileBanking || []).find(acc => acc.name === entry.method);
    if (!account) return;
    const amount = parseFloat(entry.amount) || 0;
    if (MONEY_IN.includes(entry.type))       account.balance += amount;
    else if (MONEY_OUT.includes(entry.type)) account.balance -= amount;
  });

  if (typeof recalculateCashBalanceFromTransactions === 'function') {
    recalculateCashBalanceFromTransactions();
  }

  if (typeof saveToStorage === 'function') saveToStorage(true);
  if (typeof updateDashboardBankBalance === 'function') updateDashboardBankBalance();
  console.log('🔄 All account balances (Bank & Mobile) rebuilt from finance');
}

/* 🔃 Auto rebuild on app load */
document.addEventListener('DOMContentLoaded', () => {
  rebuildBankBalancesFromFinance();

  // ✅ FIX: Auto-render AccMgmt lists on load so data shows after refresh
  setTimeout(() => {
    if (typeof renderAccMgmtList === 'function') {
      renderAccMgmtList('Advance');
      renderAccMgmtList('Investment');
    }
  }, 800);

  // ===================================
  // AUTO-POPULATE DROPDOWNS ON MODAL OPEN
  // ===================================

  console.log('🎯 Setting up dropdown auto-population...');

  // Helper function to populate transfer dropdowns
  function populateTransferDropdownsNow() {
    const fromSelect = document.getElementById('accTransferFrom');
    const toSelect = document.getElementById('accTransferTo');

    if (!fromSelect || !toSelect) return;

    fromSelect.innerHTML = '<option value="">Select Source Account</option>';
    toSelect.innerHTML = '<option value="">Select Destination Account</option>';

    const addToBoth = (value, label) => {
      [fromSelect, toSelect].forEach(select => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
      });
    };

    const cashBal = parseFloat(globalData.cashBalance) || 0;
    addToBoth('Cash', `💵 Cash  —  ৳${formatNumber(cashBal)}`);
    (globalData.bankAccounts || []).forEach(b => {
      const bal = parseFloat(b.balance) || 0;
      addToBoth(b.name, `🏦 ${b.name} (${b.bankName})  —  ৳${formatNumber(bal)}`);
    });
    (globalData.mobileBanking || []).forEach(m => {
      const bal = parseFloat(m.balance) || 0;
      addToBoth(m.name, `📱 ${m.name}  —  ৳${formatNumber(bal)}`);
    });
  }

  // Helper function to populate payment method dropdowns (now centralized in ledger-render.js)
  function populatePaymentDropdownsNow() {
    if (typeof window.populateDropdowns === 'function') {
      window.populateDropdowns();
    }
  }

  // Expose globally
  window.populateTransferDropdownsNow = populateTransferDropdownsNow;
  window.populatePaymentDropdownsNow = populatePaymentDropdownsNow;

  // Transfer Modal
  const transferModal = document.getElementById('transferModal');
  if (transferModal) {
    transferModal.addEventListener('show.bs.modal', populateTransferDropdownsNow);
    transferModal.addEventListener('shown.bs.modal', () => {
      // Attach balance badge to From/To selects
      ['accTransferFrom', 'accTransferTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          // Remove old badge
          const old = document.getElementById(`${id}_balanceBadge`);
          if (old) old.remove();
          el.addEventListener('change', () => showMethodBalance(id));
        }
      });
    });
    console.log('✅ Transfer modal listener added');
  }

  // Student Modal
  const studentModal = document.getElementById('studentModal');
  if (studentModal) {
    studentModal.addEventListener('show.bs.modal', populatePaymentDropdownsNow);
    studentModal.addEventListener('shown.bs.modal', () => {
      attachMethodBalanceListeners();
    });
    console.log('✅ Student modal listener added');
  }

  // Finance Modal
  const financeModal = document.getElementById('financeModal');
  if (financeModal) {
    financeModal.addEventListener('show.bs.modal', populatePaymentDropdownsNow);
    financeModal.addEventListener('shown.bs.modal', () => {
      attachMethodBalanceListeners();
    });
    console.log('✅ Finance modal listener added');
  }

  // Ledger Filter - populate when Finance tab is shown
  function populateLedgerFilter() {
    const filterSelect = document.getElementById('ledgerMethodFilter');
    if (!filterSelect) return;

    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Methods</option>';

    const addOpt = (value, label) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      filterSelect.appendChild(opt);
    };

    addOpt('Cash', '💵 Cash');
    (globalData.bankAccounts || []).forEach(b => addOpt(b.name, `🏦 ${b.name}`));
    (globalData.mobileBanking || []).forEach(m => addOpt(m.name, `📱 ${m.name}`));

    if (currentVal) filterSelect.value = currentVal;
  }

  // Populate ledger filter when page loads
  populateLedgerFilter();

  // Re-populate when switching to Finance tab
  const financeLink = document.querySelector('[onclick*="switchTab"][onclick*="ledger"]');
  if (financeLink) {
    financeLink.addEventListener('click', () => {
      setTimeout(populateLedgerFilter, 100);
    });
  }

  window.populateLedgerFilter = populateLedgerFilter;

  console.log('✅ Dropdown auto-population ready!');
});

window.applyFinanceToBankAccount = applyFinanceToBankAccount;
window.rebuildBankBalancesFromFinance = rebuildBankBalancesFromFinance;

// ===============================================
// ADVANCE & INVESTMENT MANAGEMENT LOGIC
// ===============================================

function openAccMgmtAddModal(type) {
  const isAdvance = type === 'Advance';
  const title = isAdvance ? '💸 Add Advance Payment' : '📈 Add Investment';
  const personLabel = isAdvance ? 'Paid To (Employee/Vendor)' : 'Investor Name';
  const typeVal = isAdvance ? 'Advance' : 'Investment';

  let methodOptions = '<option value="Cash">💵 Cash</option>';
  (globalData.bankAccounts || []).forEach(b => { methodOptions += `<option value="${b.name}">🏦 ${b.name}</option>`; });
  (globalData.mobileBanking || []).forEach(m => { methodOptions += `<option value="${m.name}">📱 ${m.name}</option>`; });

  // ✅ FIX: Settings modal hide করো তারপর Swal দেখাও
  const settingsModalEl = document.getElementById('settingsModal');
  const settingsModalInstance = settingsModalEl ? bootstrap.Modal.getInstance(settingsModalEl) : null;
  if (settingsModalInstance) settingsModalInstance.hide();

  Swal.fire({
    title: `<div class="fw-bold" style="color:var(--primary);">${title}</div>`,
    background: '#0d1b2a',
    color: '#e0f0ff',
    customClass: {
        popup: 'border border-primary rounded-4 shadow-lg',
        confirmButton: 'btn btn-primary px-4 fw-bold mx-2',
        cancelButton: 'btn btn-outline-secondary px-4 fw-bold mx-2'
    },
    buttonsStyling: false,
    html: `
      <div class="text-start mt-2">
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">${personLabel}</label>
          <input id="swal-person" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" placeholder="Name">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Amount (৳)</label>
          <input id="swal-amount" type="number" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" placeholder="0">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Method</label>
          <select id="swal-method" class="form-select" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;">
            ${methodOptions}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Date</label>
          <input id="swal-date" type="date" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Description (Optional)</label>
          <input id="swal-desc" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" placeholder="Any details">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
    didOpen: () => {
      // ✅ FIX: Bootstrap modal focus trap bypass
      document.querySelectorAll('.modal.show').forEach(m => {
        m.removeAttribute('aria-hidden');
        m.removeAttribute('inert');
      });
      setTimeout(() => { const inp = document.getElementById('swal-person'); if (inp) inp.focus(); }, 100);
    },
    preConfirm: () => {
      const person = document.getElementById('swal-person').value.trim();
      const amount = parseFloat(document.getElementById('swal-amount').value);
      const method = document.getElementById('swal-method').value;
      const date = document.getElementById('swal-date').value;
      const desc = document.getElementById('swal-desc').value.trim();

      if (!person) return Swal.showValidationMessage('Validation Error: Name is required');
      if (!amount || amount <= 0) return Swal.showValidationMessage('Validation Error: Amount is required');
      if (!date) return Swal.showValidationMessage('Validation Error: Date is required');

      return { person, amount, method, date, desc, type: typeVal };
    }
  }).then(result => {
    // ✅ FIX: Swal বন্ধ হলে settings modal আবার খুলো
    setTimeout(() => {
      if (typeof window.openSettings === 'function') window.openSettings();
    }, 200);

    if (result.isConfirmed) {
      if (!globalData.finance) globalData.finance = [];
      const data = result.value;
      const entry = {
        id: 'txn_' + Date.now(),
        type: data.type,
        category: data.type,
        method: data.method,
        date: data.date,
        person: data.person,
        amount: data.amount,
        description: data.desc,
        createdBy: window.currentUser || 'Admin',
        createdAt: new Date().toISOString()
      };
      
      globalData.finance.push(entry);
      
      if (typeof window.feApplyEntryToAccount === 'function') {
        window.feApplyEntryToAccount(entry, 1);
      }
      
      if (typeof showSuccessToast === 'function') showSuccessToast('Successfully Saved!');
      if (typeof window.saveToStorage === 'function') {
         window.saveToStorage();
      }
      renderAccMgmtList(type);
      if (typeof renderLedger === 'function') renderLedger();
    }
  });
}

function openAccMgmtReturnModal(type, targetPersonName) {
  const isAdvance = type === 'Advance';
  const title = isAdvance ? '💸 Return Advance Payment' : '📈 Return Investment';
  const personLabel = isAdvance ? 'Returned By (Employee/Vendor)' : 'Returned To (Investor Name)';
  const typeVal = isAdvance ? 'Advance Return' : 'Investment Return';

  let methodOptions = '<option value="Cash">💵 Cash</option>';
  (globalData.bankAccounts || []).forEach(b => { methodOptions += `<option value="${b.name}">🏦 ${b.name}</option>`; });
  (globalData.mobileBanking || []).forEach(m => { methodOptions += `<option value="${m.name}">📱 ${m.name}</option>`; });

  // ✅ FIX: Settings modal hide করো তারপর Swal দেখাও
  const settingsModalEl2 = document.getElementById('settingsModal');
  const settingsModalInstance2 = settingsModalEl2 ? bootstrap.Modal.getInstance(settingsModalEl2) : null;
  if (settingsModalInstance2) settingsModalInstance2.hide();

  Swal.fire({
    title: `<div class="fw-bold" style="color:var(--primary);">${title}</div>`,
    background: '#0d1b2a',
    color: '#e0f0ff',
    customClass: {
        popup: 'border border-warning rounded-4 shadow-lg',
        confirmButton: 'btn btn-warning px-4 fw-bold mx-2 text-dark',
        cancelButton: 'btn btn-outline-secondary px-4 fw-bold mx-2'
    },
    buttonsStyling: false,
    html: `
      <div class="text-start mt-2">
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">${personLabel}</label>
          <input id="swal-person" class="form-control" style="background:#162032;color:#a0c4ff;border:1px solid #1e3a5f;" value="${targetPersonName}" readonly>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Amount (৳)</label>
          <input id="swal-amount" type="number" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" placeholder="0">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Method</label>
          <select id="swal-method" class="form-select" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;">
            ${methodOptions}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Date</label>
          <input id="swal-date" type="date" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold" style="color:#a0c4ff;">Description (Optional)</label>
          <input id="swal-desc" class="form-control" style="background:#162032;color:#e0f0ff;border:1px solid #1e3a5f;" placeholder="Return details">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Save Return',
    cancelButtonText: 'Cancel',
    didOpen: () => {
      // ✅ FIX: Bootstrap modal focus trap bypass
      document.querySelectorAll('.modal.show').forEach(m => {
        m.removeAttribute('aria-hidden');
        m.removeAttribute('inert');
      });
      setTimeout(() => { const inp = document.getElementById('swal-amount'); if (inp) inp.focus(); }, 100);
    },
    preConfirm: () => {
      const person = document.getElementById('swal-person').value.trim();
      const amount = parseFloat(document.getElementById('swal-amount').value);
      const method = document.getElementById('swal-method').value;
      const date = document.getElementById('swal-date').value;
      const desc = document.getElementById('swal-desc').value.trim();

      if (!amount || amount <= 0) return Swal.showValidationMessage('Validation Error: Amount is required');
      if (!date) return Swal.showValidationMessage('Validation Error: Date is required');

      return { person, amount, method, date, desc, type: typeVal };
    }
  }).then(result => {
    if (result.isConfirmed) {
      if (!globalData.finance) globalData.finance = [];
      const data = result.value;
      const entry = {
        id: 'txn_' + Date.now(),
        type: data.type,
        category: data.type,
        method: data.method,
        date: data.date,
        person: data.person,
        amount: data.amount,
        description: data.desc,
        createdBy: window.currentUser || 'Admin',
        createdAt: new Date().toISOString()
      };
      
      globalData.finance.push(entry);
      
      if (typeof window.feApplyEntryToAccount === 'function') {
        window.feApplyEntryToAccount(entry, 1);
      }
      
      if (typeof showSuccessToast === 'function') showSuccessToast('Return Successfully Saved!');
      if (typeof window.saveToStorage === 'function') {
         window.saveToStorage();
      }
      renderAccMgmtList(type);
      // ── Salary Hub-এও refresh করো (advance column update) ──
      if (typeof window.loadSalaryHub === 'function') window.loadSalaryHub();
      if (typeof renderLedger === 'function') renderLedger();
    }
    // ✅ FIX: Swal বন্ধ হলে settings modal আবার খুলো
    setTimeout(() => {
      if (typeof window.openSettings === 'function') window.openSettings();
    }, 200);
  });
}

function renderAccMgmtList(type) {
  var isAdvance  = type === 'Advance';
  var returnType = isAdvance ? 'Advance Return' : 'Investment Return';
  var listId     = isAdvance ? 'accMgmtAdvanceList' : 'accMgmtInvestList';
  var listEl     = document.getElementById(listId);
  if (!listEl) return;

  // ── Group by person ──
  var records = {};
  (globalData.finance || []).forEach(function(f) {
    if (f._deleted || !f.person) return;
    var isMain   = f.type === type || (f.type !== returnType && f.category === type);
    var isReturn = f.type === returnType;
    if (!isMain && !isReturn) return;
    if (!records[f.person]) records[f.person] = { given: 0, returned: 0, txns: [] };
    if (isMain)   records[f.person].given    += parseFloat(f.amount) || 0;
    if (isReturn) records[f.person].returned += parseFloat(f.amount) || 0;
    records[f.person].txns.push(f);
  });

  // ── Sort persons: unsettled first, then by latest txn date ──
  var sortedPersons = Object.keys(records).sort(function(a, b) {
    var netA = records[a].given - records[a].returned;
    var netB = records[b].given - records[b].returned;
    if ((netA > 0) !== (netB > 0)) return netB > 0 ? 1 : -1;
    var latestA = Math.max.apply(null, records[a].txns.map(function(t){ return new Date(t.date||0); }));
    var latestB = Math.max.apply(null, records[b].txns.map(function(t){ return new Date(t.date||0); }));
    return latestB - latestA;
  });

  // ── Render as cards (no table rows — replaced with div cards) ──
  // We use a wrapper div instead of table rows for better design
  var cardTypeColor = isAdvance ? '#00d4aa' : '#a78bfa';
  var cardTypeBorder = isAdvance ? 'rgba(0,212,170,0.25)' : 'rgba(167,139,250,0.25)';

  var cardsHtml = '';

  sortedPersons.forEach(function(personName) {
    var r         = records[personName];
    var net       = Math.max(0, r.given - r.returned);
    var isSettled = net <= 0;
    var safeId    = personName.replace(/[^a-zA-Z0-9]/g, '_');
    var ledgerId  = 'ledger_' + safeId + '_' + type;

    // Sort txns newest first
    r.txns.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });

    // Latest txn date
    var latestDate = r.txns[0] && r.txns[0].date
      ? (typeof window.formatPrintDate === 'function' ? window.formatPrintDate(new Date(r.txns[0].date)) : new Date(r.txns[0].date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}))
      : '—';

    // Build ledger rows HTML
    var ledgerRows = r.txns.map(function(f) {
      var isRet    = f.type === returnType;
      var amtColor = isRet ? '#00e676' : '#ff5370';
      var dateStr  = f.date
        ? (typeof window.formatPrintDate === 'function' ? window.formatPrintDate(new Date(f.date)) : new Date(f.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}))
        : '—';
      var typePill = isRet
        ? '<span style="background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.3);color:#00e676;font-size:0.7rem;padding:2px 8px;border-radius:20px;">↩ Return</span>'
        : '<span style="background:rgba(255,83,112,0.15);border:1px solid rgba(255,83,112,0.3);color:#ff5370;font-size:0.7rem;padding:2px 8px;border-radius:20px;">💸 Given</span>';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:7px 10px;color:rgba(255,255,255,0.5);font-size:0.8rem;white-space:nowrap;">${dateStr}</td>
        <td style="padding:7px 10px;">${typePill}</td>
        <td style="padding:7px 10px;">
          <span style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.25);color:#a0b4ff;font-size:0.72rem;padding:2px 7px;border-radius:20px;">${f.method||'—'}</span>
        </td>
        <td style="padding:7px 10px;font-weight:700;color:${amtColor};font-family:monospace;font-size:0.88rem;">${isRet?'+':'−'}৳${formatNumber(f.amount)}</td>
        <td style="padding:7px 10px;color:rgba(255,255,255,0.35);font-size:0.78rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(f.description||'').replace(/"/g,'')}">${f.description||'—'}</td>
        <td style="padding:7px 10px;text-align:right;">
          <button onclick="deleteAccMgmtTxn('${f.id}','${type}')" title="Delete"
            style="background:rgba(255,83,112,0.1);border:none;color:#ff5370;width:26px;height:26px;border-radius:50%;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;">
            <i class="bi bi-trash" style="font-size:0.72rem;"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    cardsHtml += `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${cardTypeBorder};
                border-radius:12px;margin-bottom:10px;overflow:hidden;">

      <!-- ── Person Header Row ── -->
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:12px 16px;flex-wrap:wrap;gap:8px;
                  background:linear-gradient(90deg,rgba(0,0,0,0.2),transparent);">

        <!-- Left: avatar + name + date -->
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;
                      justify-content:center;font-size:1rem;flex-shrink:0;
                      background:rgba(0,180,255,0.12);border:1px solid rgba(0,180,255,0.25);">👤</div>
          <div>
            <div style="font-weight:700;color:#e8f4ff;font-size:0.95rem;">${personName}</div>
            <div style="font-size:0.72rem;color:rgba(255,255,255,0.35);margin-top:1px;">
              Last: ${latestDate} &nbsp;·&nbsp; ${r.txns.length} transaction${r.txns.length>1?'s':''}
            </div>
          </div>
        </div>

        <!-- Right: status + buttons -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${isSettled
            ? `<span style="background:rgba(0,230,118,0.12);border:1px solid rgba(0,230,118,0.3);
                            color:#00e676;font-size:0.78rem;padding:4px 12px;border-radius:20px;font-weight:600;">
                ✅ Settled
               </span>`
            : `<div style="text-align:right;">
                <div style="font-weight:800;color:#ffd200;font-size:1.05rem;font-family:monospace;">৳${formatNumber(net)}</div>
                <div style="font-size:0.68rem;color:rgba(255,200,0,0.55);">বকেয়া</div>
               </div>`
          }

          <!-- Ledger Button -->
          <button onclick="toggleAccMgmtLedger('${ledgerId}')"
            style="background:rgba(0,180,255,0.12);border:1px solid rgba(0,180,255,0.3);
                   color:#00d4ff;font-size:0.78rem;padding:6px 14px;border-radius:20px;
                   cursor:pointer;font-weight:600;transition:all .2s;"
            onmouseover="this.style.background='rgba(0,180,255,0.25)'"
            onmouseout="this.style.background='rgba(0,180,255,0.12)'">
            <i class="bi bi-journal-text me-1"></i>Ledger
          </button>

          <!-- Adjust Button (only if not settled) -->
          ${!isSettled ? `
          <button onclick="openAccMgmtReturnModal('${type}','${personName}')"
            style="background:linear-gradient(135deg,#f0a500,#ffd200);border:none;
                   color:#1a1000;font-size:0.78rem;padding:6px 14px;border-radius:20px;
                   cursor:pointer;font-weight:700;transition:all .2s;"
            onmouseover="this.style.opacity='0.85'"
            onmouseout="this.style.opacity='1'">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Adjust
          </button>` : ''}
        </div>
      </div>

      <!-- ── Given / Returned summary bar ── -->
      <div style="display:flex;gap:16px;padding:6px 16px 10px;border-top:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:0.78rem;color:rgba(255,83,112,0.8);">
          <i class="bi bi-arrow-up-right me-1"></i>Given: <strong>৳${formatNumber(r.given)}</strong>
        </span>
        ${r.returned > 0 ? `<span style="font-size:0.78rem;color:rgba(0,230,118,0.8);">
          <i class="bi bi-arrow-down-left me-1"></i>Returned: <strong>৳${formatNumber(r.returned)}</strong>
        </span>` : ''}
      </div>

      <!-- ── Ledger Table (hidden by default) ── -->
      <div id="${ledgerId}" style="display:none;border-top:1px solid rgba(255,255,255,0.07);">
        <div style="padding:8px 16px 4px;font-size:0.75rem;color:${cardTypeColor};font-weight:600;
                    background:rgba(0,0,0,0.2);letter-spacing:0.05em;">
          📒 LEDGER — ${personName}
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
            <thead>
              <tr style="background:rgba(0,0,0,0.25);">
                <th style="padding:6px 10px;color:rgba(255,255,255,0.35);font-weight:600;font-size:0.72rem;text-transform:uppercase;">Date</th>
                <th style="padding:6px 10px;color:rgba(255,255,255,0.35);font-weight:600;font-size:0.72rem;text-transform:uppercase;">Type</th>
                <th style="padding:6px 10px;color:rgba(255,255,255,0.35);font-weight:600;font-size:0.72rem;text-transform:uppercase;">Method</th>
                <th style="padding:6px 10px;color:rgba(255,255,255,0.35);font-weight:600;font-size:0.72rem;text-transform:uppercase;">Amount</th>
                <th style="padding:6px 10px;color:rgba(255,255,255,0.35);font-weight:600;font-size:0.72rem;text-transform:uppercase;">Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        </div>
      </div>

    </div>`;
  });

  if (!cardsHtml) {
    cardsHtml = `
      <div style="text-align:center;padding:3rem 1rem;">
        <div style="color:rgba(255,255,255,0.15);font-size:2.5rem;margin-bottom:0.5rem;">📭</div>
        <div style="color:rgba(255,255,255,0.3);font-size:0.9rem;">No ${type} records found.</div>
      </div>`;
  }

  // ── listEl is now a div (settings-modal.html updated) — render directly ──
  listEl.innerHTML = cardsHtml;
}

// Toggle ledger visibility
window.toggleAccMgmtLedger = function(ledgerId) {
  var el = document.getElementById(ledgerId);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

function deleteAccMgmtTxn(txnId, currentTabType) {
  if (!confirm('Are you sure you want to delete this transaction? This will affect account balances.')) return;
  
  const idx = globalData.finance.findIndex(f => f.id === txnId);
  if (idx !== -1) {
    const txn = globalData.finance[idx];
    
    if (typeof window.feApplyEntryToAccount === 'function') {
      window.feApplyEntryToAccount(txn, -1);
    }
    
    globalData.finance[idx]._deleted = true;
    if (typeof showSuccessToast === 'function') showSuccessToast('Transaction Deleted');
    if (typeof window.saveToStorage === 'function') {
         window.saveToStorage();
    }
    renderAccMgmtList(currentTabType);
    if (typeof renderLedger === 'function') renderLedger();
  }
}

function printAccountsMgmt() {
  const content = document.getElementById('accMgmtTabContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Accounts Management Report</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; background: white; color: black !important; }
            .badge { border: 1px solid #ccc; background: transparent !important; color: black !important;}
            .table-dark { background-color: #f8f9fa !important; color: black !important; }
            .table-primary { background-color: #e9ecef !important; }
            .text-info, .text-warning, .text-success, .text-danger { color: black !important; }
            .btn { display: none; }
            @media print {
              .btn { display: none !important; }
            }
        </style>
      </head>
      <body>
        <h3 class="text-center mb-4">WINGS FLY AVIATION ACADEMY</h3>
        <h4 class="mb-4">Accounts Management Report</h4>
        ${content}
        <script>window.print(); setTimeout(()=>window.close(), 500);</script>
      </body>
    </html>
  `);
  win.document.close();
}

/* =========================================================
   AI ACCOUNTS ASSISTANT FEATURE (GPT-STYLE)
   ========================================================= */
function openAIAccountsAssistant() {
  const gd = window.globalData || {};
  if (!gd.finance) gd.finance = [];

  // Core Metrics
  const cash = parseFloat(gd.cashBalance) || 0;
  const bank = (gd.bankAccounts || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const mobile = (gd.mobileBanking || []).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const totalBalance = cash + bank + mobile;

  // Advance Math
  const advTotal = gd.finance.filter(f => !f._deleted && f.type === 'Advance').reduce((s,f) => s + (parseFloat(f.amount) || 0), 0);
  const advReturnTotal = gd.finance.filter(f => !f._deleted && f.type === 'Advance Return').reduce((s,f) => s + (parseFloat(f.amount) || 0), 0);
  const netAdvance = advTotal - advReturnTotal;

  // Investment Math
  const invTotal = gd.finance.filter(f => !f._deleted && f.type === 'Investment').reduce((s,f) => s + (parseFloat(f.amount) || 0), 0);
  const invReturnTotal = gd.finance.filter(f => !f._deleted && f.type === 'Investment Return').reduce((s,f) => s + (parseFloat(f.amount) || 0), 0);
  const netInvestment = invTotal - invReturnTotal;

  // Profit/Loss via Engine
  const stats = (typeof window.feCalcStats === 'function') ? window.feCalcStats(gd.finance) : { income:0, expense:0, profit:0 };

  // Generate dynamic text
  const netAdvanceStatus = netAdvance > 0 
        ? `<span class="text-warning fw-bold">⚠️ ৳${netAdvance.toLocaleString()}</span> Advance বকেয়া আছে। এটি রিকভার করার দিকে জোর দিন।` 
        : `<span class="text-success fw-bold">✅ কোনো Advance বকেয়া নেই!</span>`;
  
  const netInvestmentStatus = netInvestment > 0 
        ? `বর্তমানে <span class="text-info fw-bold">৳${netInvestment.toLocaleString()}</span> Investment রিটার্নের অপেক্ষায় আছে।` 
        : `<span class="text-muted">কোনো Investment চলমান নেই।</span>`;
        
  const balanceNote = totalBalance < 10000 
        ? `<div class="text-danger mt-2" style="font-size:0.85rem;"><i class="bi bi-exclamation-triangle"></i> <b>Warning:</b> আপনার Cash & Bank Balance অনেক কম (মাত্র ৳${totalBalance.toLocaleString()})। লিকুইড ক্যাশ বাড়াতে হবে।</div>`
        : `<div class="text-success mt-2" style="font-size:0.85rem;"><i class="bi bi-check-circle"></i> <b>Status:</b> Liquid Balance সন্তোষজনক (৳${totalBalance.toLocaleString()})।</div>`;

  const profitNote = stats.profit >= 0 
        ? `প্রতিষ্ঠানটি এখন <b>৳${stats.profit.toLocaleString()}</b> লাভে রয়েছে 🚀`
        : `প্রতিষ্ঠানটি <b>৳${Math.abs(stats.profit).toLocaleString()}</b> লোকসানে রয়েছে! খরচ কমানোর দিকে ফোকাস দিন 📉`;

  const htmlContent = `
    <div style="text-align:left; font-family:'Inter',sans-serif; background:#0d1b2a; padding:15px; border-radius:12px; border:1px solid rgba(255,0,204,0.3); color:#e0f0ff;">
        
        <!-- Header -->
        <div class="d-flex align-items-center mb-3 pb-3 border-bottom border-secondary">
            <div style="background:linear-gradient(135deg, #ff00cc, #333399); width:45px; height:45px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(255,0,204,0.3);">
                <i class="bi bi-robot" style="font-size:1.4rem; color:white;"></i>
            </div>
            <div class="ms-3">
                <div class="fw-bold" style="font-size:1.05rem; color:#f093fb;">Antigravity AI Assistant</div>
                <div style="font-size:0.75rem; color:#a0c4ff;">Financial Intelligence Report</div>
            </div>
        </div>
        
        <p style="font-size:0.9rem; line-height:1.5;">হ্যালো! আমি আপনার Accounts Management এবং Ledger স্ক্যান করেছি। নিচে আমার রিপোর্ট ও এনালাইসিস দেওয়া হলো:</p>
        
        <!-- Box 1: Core Performance -->
        <div style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; margin-bottom:12px; border-left:3px solid #00d9ff;">
            <div class="fw-bold text-info mb-1" style="font-size:0.85rem;"><i class="bi bi-bar-chart-fill"></i> বিজনেস পারফরম্যান্স</div>
            <div style="font-size:0.9rem;">${profitNote}</div>
            ${balanceNote}
        </div>

        <!-- Box 2: Advance -->
        <div style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; margin-bottom:12px; border-left:3px solid #f0ad4e;">
            <div class="fw-bold text-warning mb-1" style="font-size:0.85rem;"><i class="bi bi-credit-card-2-front"></i> Advance Payment রিকভারি</div>
            <div style="font-size:0.9rem;">${netAdvanceStatus}</div>
            <div style="font-size:0.75rem; margin-top:6px; color:#aaa; display:flex; gap:10px;">
                <span>দেওয়া হয়েছে: <b>৳${advTotal.toLocaleString()}</b></span>|
                <span>ফেরত এসেছে: <b>৳${advReturnTotal.toLocaleString()}</b></span>
            </div>
        </div>

        <!-- Box 3: Investment -->
        <div style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; margin-bottom:12px; border-left:3px solid #a78bfa;">
            <div class="fw-bold mb-1" style="color:#a78bfa; font-size:0.85rem;"><i class="bi bi-graph-up-arrow"></i> Investment স্ট্যাটাস</div>
            <div style="font-size:0.9rem;">${netInvestmentStatus}</div>
            <div style="font-size:0.75rem; margin-top:6px; color:#aaa; display:flex; gap:10px;">
                <span>ইনভেস্টমেন্ট: <b>৳${invTotal.toLocaleString()}</b></span>|
                <span>রিটার্ন: <b>৳${invReturnTotal.toLocaleString()}</b></span>
            </div>
        </div>

        <!-- Box 4: AI Insights & Error Checking -->
        <div style="background:rgba(255,100,100,0.05); padding:10px 15px; border-radius:8px; border-left:3px solid #ff4466;">
            <div class="fw-bold mb-1" style="color:#ff4466; font-size:0.85rem;"><i class="bi bi-shield-exclamation"></i> AI Security & Error Check</div>
            <div id="aiErrorChecks" style="font-size:0.85rem; color:#e0f0ff;">
                <!-- Error messages will be injected here via logic -->
            </div>
        </div>

        <div class="mt-4 text-center" style="font-size:0.75rem; color:#7aa0c4;">
            <i class="bi bi-stars"></i> <i>AI Report generated using SMART V8 Sync Engine</i>
        </div>
    </div>
  `;

  // --- Run AI Error Logic Before Rendering --- 
  let errorMsgs = [];
  
  // Rule 1: Is Liquid Cash lower than amount we owe in Advances?
  if (netAdvance > totalBalance && netAdvance > 0) {
      errorMsgs.push(`<div class="mb-2"><i class="bi bi-x-circle text-danger"></i> <b>ঝুঁকি:</b> আপনার লিকুইড ব্যালেন্স (৳${totalBalance.toLocaleString()}) বকেয়া Advance-এর (৳${netAdvance.toLocaleString()}) চেয়ে কম! ক্যাশ ফ্লো নিয়ে সতর্ক হোন।</div>`);
  }

  // Rule 2: Orphaned Mobile Banking / Bank Accounts without balance
  let zeroAccounts = 0;
  (gd.bankAccounts || []).forEach(a => { if (parseFloat(a.balance) === 0) zeroAccounts++; });
  (gd.mobileBanking || []).forEach(a => { if (parseFloat(a.balance) === 0) zeroAccounts++; });
  if (zeroAccounts > 0) {
      const fixBtn = `<button onclick="window.autoFixZeroAccounts()" class="btn btn-sm ms-2 px-2 py-1" style="background:linear-gradient(135deg,#ff00cc,#333399);border:none;color:#fff;font-size:0.75rem;border-radius:6px;font-weight:600;box-shadow:0 2px 5px rgba(255,0,204,0.3);"><i class="bi bi-magic me-1"></i> Auto Fix</button>`;
      errorMsgs.push(`<div class="mb-2"><i class="bi bi-info-circle text-warning"></i> <b>পরামর্শ:</b> আপনার <b>${zeroAccounts}</b> টি অ্যাকাউন্টে ৳0 ব্যালেন্স রয়েছে। অব্যবহৃত অ্যাকাউন্টগুলো ডিলিট করে ড্রপডাউন ক্লিন রাখতে পারেন।${fixBtn}</div>`);
  }

  // Rule 3: Missing categories in Advance/Investment
  const badAdvance = gd.finance.filter(f => !f._deleted && f.type === 'Advance' && !f.person);
  if (badAdvance.length > 0) {
      errorMsgs.push(`<div class="mb-2"><i class="bi bi-exclamation-triangle text-danger"></i> <b>ভুল ডেটা:</b> ${badAdvance.length} টি Advance-এ কোনো ব্যক্তির নাম (Person) লেখা নেই। অবিলম্বে নাম যুক্ত করুন।</div>`);
  }

  // If no errors
  if (errorMsgs.length === 0) {
      errorMsgs.push(`<div class="text-success"><i class="bi bi-check2-all"></i> সিস্টেম চেক করেছে: কোনো বড় ধরনের সমস্যা বা ভুল এন্ট্রি পাওয়া যায়নি। ডেটা হেলথ একদম ঠিক আছে!</div>`);
  }

  // Replace placeholder
  const finalHtmlContent = htmlContent.replace('<!-- Error messages will be injected here via logic -->', errorMsgs.join(''));

  Swal.fire({
      html: finalHtmlContent,
      background: 'transparent', // Custom container background makes default transparent useful
      backdrop: 'rgba(0,10,20,0.85)',
      width: '600px',
      showConfirmButton: true,
      confirmButtonText: '<i class="bi bi-check2-circle"></i> বুঝলাম',
      confirmButtonColor: 'linear-gradient(135deg, #0d1b2a, #1e3a5f)',
      customClass: {
          popup: 'p-0 bg-transparent', // Removes default padding and color
      }
  }).then(() => {
     // Apply manual gradient to the confirm button after render if needed
     const btn = Swal.getConfirmButton();
     if(btn) {
         btn.style.background = 'transparent';
         btn.style.border = '1px solid #1e3a5f';
         btn.style.color = '#a0c4ff';
     }
  });
}

// Global Auto-Fix function for Zero-balance accounts
window.autoFixZeroAccounts = function() {
    const gd = window.globalData || {};
    let count = 0;
    
    if (gd.bankAccounts) {
        const initial = gd.bankAccounts.length;
        gd.bankAccounts = gd.bankAccounts.filter(a => parseFloat(a.balance) !== 0);
        count += (initial - gd.bankAccounts.length);
    }
    
    if (gd.mobileBanking) {
        const initial = gd.mobileBanking.length;
        gd.mobileBanking = gd.mobileBanking.filter(a => parseFloat(a.balance) !== 0);
        count += (initial - gd.mobileBanking.length);
    }
    
    if (count > 0) {
        if (typeof saveToStorage === 'function') saveToStorage();
        if (typeof populateTransferDropdownsNow === 'function') populateTransferDropdownsNow();
        if (typeof populatePaymentDropdownsNow === 'function') populatePaymentDropdownsNow();
        if (typeof populateLedgerFilter === 'function') populateLedgerFilter();
        
        // Re-calculate the layout
        if (typeof renderAccounts === 'function') renderAccounts();
        
        Swal.fire({
            title: '<div class="fw-bold" style="color:#00e676;">✅ Auto Solved!</div>',
            html: `<div style="color:#e0f0ff;font-size:0.95rem;">${count} টি শূন্য-ব্যালেন্স (৳0) অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে!</div>`,
            background: '#0d1b2a',
            color: '#e0f0ff',
            iconColor: '#00e676',
            icon: 'success',
            customClass: { popup: 'border border-success rounded-4' },
            confirmButtonText: 'Great!',
            confirmButtonColor: '#00e676'
        }).then(() => {
            // Re-open Assistant to refresh view
            openAIAccountsAssistant();
        });
    }
}

// Attach to window so it's accessible globally
window.openAccMgmtAddModal = openAccMgmtAddModal;
window.openAccMgmtReturnModal = openAccMgmtReturnModal;
window.renderAccMgmtList = renderAccMgmtList;
window.deleteAccMgmtTxn = deleteAccMgmtTxn;
window.printAccountsMgmt = printAccountsMgmt;
window.openAIAccountsAssistant = openAIAccountsAssistant;
