// ====================================
// WINGS FLY AVIATION ACADEMY  
// LEDGER RENDER — DROPDOWNS, SETTINGS LISTS, CATEGORY MANAGEMENT
// Extracted from app.js (Phase 2)
// ====================================

// ===================================
// DYNAMIC DROPDOWNS & SETTINGS MANAGEMENT
// ===================================

function populateDropdowns() {
  const gd = window.globalData || {};
  const courses = [...new Set(gd.courseNames || [])].sort();

  // 1. Course Dropdowns
  const courseSelects = [
    'studentCourseSelect',
    'visitorCourseSelect',
    'examSubjectSelect',
    'studentCourse', 'editStudentCourse', 'addStudentCourse'
  ];

  courseSelects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const currentVal = el.value;
      el.innerHTML = '';

      if (id === 'visitorCourseSelect') {
        el.innerHTML = '<option value="">Select Interested Course...</option>';
      } else if (id === 'examSubjectSelect') {
        el.innerHTML = '<option value="">Select Course...</option>';
      } else {
        el.innerHTML = '<option value="">Select Course</option>';
      }

      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        el.appendChild(opt);
      });

      if (currentVal) el.value = currentVal;
    }
  });

  // 2. Payment Method Dropdowns (MASTER LIST)
  const methodSelects = [
    'studentMethodSelect',
    'financeMethodSelect',
    'transferFromSelect',
    'transferToSelect',
    'editTransMethodSelect',
    'ledgerMethodFilter',
    'examPaymentMethodSelect',
    'pmtNewMethod',
    'accTransferFrom',
    'accTransferTo',
    'studentPaymentMethod',
    'editPaymentMethod',
    'paymentMethodSelect',
    'addPaymentMethod',
    'studentPayMethod',
    'payMethod',
    'unifiedAccountSelect'
  ];

  methodSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const currentVal = el.value;
    el.innerHTML = '';

    // Add default blank option
    if (id === 'ledgerMethodFilter') {
      el.innerHTML = '<option value="">All Methods</option>';
    } else {
      el.innerHTML = '<option value="">Select Payment Method</option>';
    }

    // A. Cash Option
    const cashBal = parseFloat(gd.cashBalance) || 0;
    const cashOpt = document.createElement('option');
    cashOpt.value = 'Cash';
    cashOpt.textContent = `💵 Cash  —  ৳${formatNumber(cashBal)}`;
    el.appendChild(cashOpt);

    // B. Bank Accounts
    (gd.bankAccounts || []).forEach(account => {
      const bal = parseFloat(account.balance) || 0;
      const opt = document.createElement('option');
      opt.value = account.name;
      opt.textContent = `🏦 ${account.name} (${account.bankName})  —  ৳${formatNumber(bal)}`;
      el.appendChild(opt);
    });

    // C. Mobile Banking
    (gd.mobileBanking || []).forEach(m => {
      const bal = parseFloat(m.balance) || 0;
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = `📱 ${m.name}  —  ৳${formatNumber(bal)}`;
      el.appendChild(opt);
    });

    // D. Extra methods from globalData.paymentMethods (user-defined, not in bank/mobile)
    (gd.paymentMethods || []).forEach(m => {
      if (m === 'Cash') return; // already added above
      const alreadyAdded = Array.from(el.options).some(o => o.value === m);
      if (!alreadyAdded) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        el.appendChild(opt);
      }
    });

    if (currentVal) {
      const exists = Array.from(el.options).some(o => o.value === currentVal);
      if (exists) el.value = currentVal;
    }
  });

  if (typeof renderSettingsLists === 'function') renderSettingsLists();
}

function renderSettingsLists() {
  const gd = window.globalData || {};

  // === ONE-TIME MIGRATION: If Settings arrays are EMPTY but data exists, auto-populate once ===
  let _migrated = false;

  // 1. Income & Expense Categories from existing Finance records
  if ((!gd.incomeCategories || gd.incomeCategories.length === 0) && gd.finance && gd.finance.length > 0) {
    const incSet = new Set(), expSet = new Set();
    gd.finance.forEach(f => {
      if (!f.category) return;
      if (f.type === 'Income' || f.type === 'Loan Received') incSet.add(f.category);
      else expSet.add(f.category);
    });
    if (incSet.size > 0) { gd.incomeCategories = [...incSet].sort(); _migrated = true; }
    if (expSet.size > 0) { gd.expenseCategories = [...expSet].sort(); _migrated = true; }
    console.log('[Settings Migration] Populated categories from finance records');
  }
  if ((!gd.expenseCategories || gd.expenseCategories.length === 0) && gd.finance && gd.finance.length > 0) {
    const expSet2 = new Set();
    gd.finance.forEach(f => { if (f.category && f.type !== 'Income' && f.type !== 'Loan Received') expSet2.add(f.category); });
    if (expSet2.size > 0) { gd.expenseCategories = [...expSet2].sort(); _migrated = true; }
  }

  // 2. Courses from existing Student records
  if ((!gd.courseNames || gd.courseNames.length === 0) && gd.students && gd.students.length > 0) {
    const courseSet = new Set();
    gd.students.forEach(s => { if (s.course) courseSet.add(s.course); });
    if (courseSet.size > 0) { gd.courseNames = [...courseSet].sort(); _migrated = true; }
    console.log('[Settings Migration] Populated courses from student records');
  }

  // 3. Employee Roles from existing Employee records
  if ((!gd.employeeRoles || gd.employeeRoles.length === 0) && gd.employees && gd.employees.length > 0) {
    const roleSet = new Set();
    gd.employees.forEach(e => { if (e.role) roleSet.add(e.role); });
    if (roleSet.size > 0) { gd.employeeRoles = [...roleSet].sort(); _migrated = true; }
    console.log('[Settings Migration] Populated roles from employee records');
  }

  // Save migration result once
  if (_migrated) {
    if (typeof saveToStorage === 'function') saveToStorage();
    else localStorage.setItem('wingsfly_data', JSON.stringify(gd));
    console.log('[Settings Migration] ✅ One-time migration complete — data saved');
  }

  // === Strict Sync: Use ONLY Settings Data (after migration if any) ===
  const incCats = [...new Set(gd.incomeCategories || [])].sort();
  const expCats = [...new Set(gd.expenseCategories || [])].sort();
  const courses = [...new Set(gd.courseNames || [])].sort();
  const roles = [...new Set(gd.employeeRoles || ['Instructor', 'Admin', 'Staff', 'Manager'])].sort();

  // Income List
  const incList = document.getElementById('settingsIncomeCatList');
  if (incList) {
    incList.innerHTML = '';
    incCats.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `${c} <button class="btn btn-sm btn-outline-danger" onclick="deleteIncomeCategory('${c}')">&times;</button>`;
      incList.appendChild(li);
    });
  }

  // Expense List
  const expList = document.getElementById('settingsExpenseCatList');
  if (expList) {
    expList.innerHTML = '';
    expCats.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `${c} <button class="btn btn-sm btn-outline-danger" onclick="deleteExpenseCategory('${c}')">&times;</button>`;
      expList.appendChild(li);
    });
  }

  // Course List
  const courseList = document.getElementById('settingsCourseList');
  if (courseList) {
    courseList.innerHTML = '';
    courses.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `${c} <button class="btn btn-sm btn-outline-danger" onclick="deleteCourseName('${c}')">&times;</button>`;
      courseList.appendChild(li);
    });
  }

  // Employee Roles List
  const rolesList = document.getElementById('settingsEmployeeRoleList');
  if (rolesList) {
    rolesList.innerHTML = '';
    roles.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `${r} <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployeeRole(${i})">&times;</button>`;
      rolesList.appendChild(li);
    });
  }

  // Academy Name & Monthly Target in Settings
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    if (settingsForm.academyName) {
      settingsForm.academyName.value = window.globalData.settings.academyName || '';
    }
    if (settingsForm.monthlyTarget) {
      settingsForm.monthlyTarget.value = window.globalData.settings.monthlyTarget || 200000;
    }
    // Dynamic Starting Balances List
    const balanceContainer = document.getElementById('startingBalancesList');
    if (balanceContainer) {
      balanceContainer.innerHTML = '';

      // Define allMethods before using it
      const allMethods = ['Cash'];
      const bankAccounts = window.globalData.bankAccounts || [];
      const mobileAccounts = window.globalData.mobileBanking || [];

      bankAccounts.forEach(acc => allMethods.push(acc.name));
      mobileAccounts.forEach(acc => allMethods.push(acc.name));

      allMethods.forEach(m => {
        const div = document.createElement('div');
        div.className = 'col-6 mb-2';
        div.innerHTML = `
          <label class="form-label small fw-bold text-muted mb-1">${m} Starting ৳</label>
          <input type="number" name="startBalance_${m}" class="form-control form-control-sm" 
                 value="${window.globalData.settings.startBalances?.[m] || 0}" placeholder="0">
        `;
        balanceContainer.appendChild(div);
      });
      // Populate Security Fields
      if (document.getElementById('settingsUsername')) {
        document.getElementById('settingsUsername').value = (window.globalData.credentials && window.globalData.credentials.username) || 'admin';
      }
      // ✅ Security: never pre-fill password field — user must type new one to change it
      if (document.getElementById('settingsPassword')) {
        document.getElementById('settingsPassword').value = '';
        document.getElementById('settingsPassword').placeholder = 'Type new password to change...';
      }
    }
    // Populate Advanced Tab: Running Batch Toggle
    const runningBatchSelect = document.getElementById('runningBatchSelect');
    if (runningBatchSelect) {
      const currentRB = window.globalData.settings?.runningBatch || '';
      const allBatches = [...new Set((window.globalData.students || []).map(s => s.batch).filter(Boolean))];
      (window.globalData.courseNames || []).forEach(c => { if (!allBatches.includes(c)) allBatches.push(c); });
      allBatches.sort();

      runningBatchSelect.innerHTML = '<option value="">All Batches (No Filter)</option>';
      allBatches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (b === currentRB) opt.selected = true;
        runningBatchSelect.appendChild(opt);
      });
      runningBatchSelect.value = currentRB;
    }
  }
}

// --- Category Management ---

function addIncomeCategory() {
  const input = document.getElementById('newIncomeCatInput');
  const val = input.value.trim();
  if (!val) return;
  if (!window.globalData.incomeCategories) window.globalData.incomeCategories = [];
  if (window.globalData.incomeCategories.includes(val)) { alert('Exists!'); return; }
  window.globalData.incomeCategories.push(val);
  saveToStorage();
  renderSettingsLists();
  updateFinanceCategoryOptions();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
  input.value = '';
}

function deleteIncomeCategory(name) {
  if (!confirm(`Delete Income Category "${name}"?`)) return;
  window.globalData.incomeCategories = window.globalData.incomeCategories.filter(c => c !== name);
  saveToStorage();
  renderSettingsLists();
  updateFinanceCategoryOptions();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
}

function addExpenseCategory() {
  const input = document.getElementById('newExpenseCatInput');
  const val = input.value.trim();
  if (!val) return;
  if (!window.globalData.expenseCategories) window.globalData.expenseCategories = [];
  if (window.globalData.expenseCategories.includes(val)) { alert('Exists!'); return; }
  window.globalData.expenseCategories.push(val);
  saveToStorage();
  renderSettingsLists();
  updateFinanceCategoryOptions();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
  input.value = '';
}

function deleteExpenseCategory(name) {
  if (!confirm(`Delete Expense Category "${name}"?`)) return;
  window.globalData.expenseCategories = window.globalData.expenseCategories.filter(c => c !== name);
  saveToStorage();
  renderSettingsLists();
  updateFinanceCategoryOptions();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
}

function updateFinanceCategoryOptions() {
  const typeSelect = document.querySelector('#financeForm select[name="type"]');
  const catSelect = document.getElementById('financeCategorySelect');
  if (!typeSelect || !catSelect) return;

  const type = typeSelect.value;
  let options = [];

  if (type === 'Income' || type === 'Loan Received') {
    options = window.globalData.incomeCategories || [];
  } else {
    options = window.globalData.expenseCategories || [];
  }

  catSelect.innerHTML = '';
  options.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    catSelect.appendChild(opt);
  });

  // ✅ FIXED: Toggle Person/Counterparty visibility based on TYPE
  const personContainer = document.getElementById('financePersonContainer');
  const personInput = document.getElementById('financePersonInput');

  if (personContainer && personInput) {
    // Show ONLY for Loan Given and Loan Received
    if (type === 'Loan Given' || type === 'Loan Received') {
      personContainer.classList.remove('d-none');
      personInput.required = true;
      console.log('✅ Person field: VISIBLE + REQUIRED (Type:', type + ')');
    } else {
      personContainer.classList.add('d-none');
      personInput.required = false;
      personInput.value = ''; // Clear value when hidden
      console.log('ℹ️ Person field: HIDDEN (Type:', type + ')');
    }
  }
}

// ✅ Remove old togglePersonField function - not needed anymore

// --- Payment Method Management ---
// NOTE: Payment methods are now automatically synced from Bank Accounts
// These functions kept for backward compatibility
function addPaymentMethod() {
  const input = document.getElementById('newMethodInput');
  if (!input) return; // Element doesn't exist in UI anymore
  const val = input.value.trim();
  if (!val) return;

  if (!window.globalData.paymentMethods) {
    window.globalData.paymentMethods = ['Cash'];
  }

  if (window.globalData.paymentMethods.includes(val)) { alert('Exists!'); return; }

  window.globalData.paymentMethods.push(val);
  saveToStorage();
  populateDropdowns();
  input.value = '';
}

function deletePaymentMethod(name) {
  if (!confirm(`Delete payment method "${name}"?`)) return;
  if (!window.globalData.paymentMethods) return;
  window.globalData.paymentMethods = window.globalData.paymentMethods.filter(m => m !== name);
  saveToStorage();
  populateDropdowns();
}

// --- Course Management ---
function addCourseName() {
  const input = document.getElementById('newCourseInput');
  const val = input.value.trim();
  if (!val) return;

  if (!window.globalData.courseNames) {
    window.globalData.courseNames = ['Caregiver', 'Student Visa', 'Visa (Tourist, Medical Business)', 'Air Ticketing (Basic)', 'Air Ticketing (Advance)', 'Travel Agency Business Managment', 'Language (Japanese, Korean)', 'Other'];
  }

  // Check if it already exists (case-insensitive)
  const isDuplicate = window.globalData.courseNames.some(c => c.toLowerCase() === val.toLowerCase());

  if (isDuplicate) {
    if (typeof showErrorToast === 'function') {
      showErrorToast('❌ Course already exists in Settings!');
    } else {
      alert('Course already exists!');
    }
    return;
  }

  // Also warn if it already exists in students but wasn't in settings
  const inStudents = window.globalData.students && window.globalData.students.some(s => s.course && s.course.toLowerCase() === val.toLowerCase());
  if (inStudents) {
    if (typeof showSuccessToast === 'function') {
      showSuccessToast('✅ Course merged with existing student records.');
    }
  }

  window.globalData.courseNames.push(val);
  saveToStorage();
  populateDropdowns();
  if (typeof populateBatchFilter === 'function') populateBatchFilter();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
  input.value = '';
}

function deleteCourseName(name) {
  if (!confirm(`Delete course "${name}"?`)) return;
  window.globalData.courseNames = window.globalData.courseNames.filter(c => c !== name);
  saveToStorage();
  populateDropdowns();
  if (typeof populateBatchFilter === 'function') populateBatchFilter();
  if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
}



// Override updateCategoryDropdown to use globalData
function updateCategoryDropdown() {
  const select = document.getElementById('ledgerCategoryFilter');
  if (!select) return;

  const currentVal = select.value;
  // Use global categories + any legacy categories found in transactions
  const legacyCats = new Set(window.globalData.finance.map(f => f.category));
  const incCats = window.globalData.incomeCategories || [];
  const expCats = window.globalData.expenseCategories || [];
  const allCats = [...new Set([...incCats, ...expCats, ...legacyCats])].sort();

  select.innerHTML = '<option value="">All Categories</option>';
  allCats.forEach(cat => {
    if (!cat) return;
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
  select.value = currentVal;
}


window.populateDropdowns = populateDropdowns;
window.renderSettingsLists = renderSettingsLists;
window.addIncomeCategory = addIncomeCategory;
window.deleteIncomeCategory = deleteIncomeCategory;
window.addExpenseCategory = addExpenseCategory;
window.deleteExpenseCategory = deleteExpenseCategory;
window.updateFinanceCategoryOptions = updateFinanceCategoryOptions;
window.addPaymentMethod = addPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.addCourseName = addCourseName;
window.deleteCourseName = deleteCourseName;
window.updateCategoryDropdown = updateCategoryDropdown;
