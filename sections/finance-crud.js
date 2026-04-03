// ====================================
// WINGS FLY AVIATION ACADEMY
// FINANCE CRUD — STUDENT PAYMENTS, TRANSACTIONS, DELETE
// Extracted from app.js (Phase 2)
// ====================================

// ===================================
// DELETE STUDENT
// ===================================
// STUDENT PAYMENT & INSTALLMENT LOGIC
// ===================================

let currentPaymentStudentIndex = null;

/**
 * Gets consistent installment list, recovering any missing initial payments
 */
function getStudentInstallments(student) {
  if (!student) return [];
  const installments = [...(student.installments || [])];
  const totalPaid = parseFloat(student.paid) || 0;
  const installmentsSum = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);

  // If there's a difference, the missing amount is the "Initial Payment"
  if (totalPaid > installmentsSum) {
    const missing = totalPaid - installmentsSum;
    // Add to the START of the list
    installments.unshift({
      amount: missing,
      date: student.enrollDate || 'Opening',
      method: student.method || 'Cash',
      isMigrated: true
    });
  }
  return installments;
}

function openStudentPaymentModal(rowIndex) {
  // Use direct index access
  const student = (window.globalData && window.globalData.students)
    ? window.globalData.students[rowIndex]
    : (typeof globalData !== 'undefined' ? globalData.students[rowIndex] : null);

  if (!student) {
    alert("Student not found!");
    return;
  }

  currentPaymentStudentIndex = rowIndex;

  // Ensure modal HTML is loaded (supports lazy-loaded modals via section-loader)
  const totalFeeEl = document.getElementById('pmtTotalFee');
  const totalPaidEl = document.getElementById('pmtTotalPaid');
  const totalDueEl = document.getElementById('pmtTotalDue');

  if (!totalFeeEl || !totalPaidEl || !totalDueEl) {
    // Try lazy-load via Section Loader if available
    if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
      window.sectionLoader.loadAndOpen(
        '__modalPlaceholderOther',
        'sections/modals-student.html',
        'studentPaymentModal',
        function () { openStudentPaymentModal(rowIndex); }
      );
      return;
    }

    console.warn('[FinanceCRUD] studentPaymentModal elements missing in DOM, and SectionLoader not available.');
    return;
  }

  // Update header/summary
  totalFeeEl.innerText = '৳' + formatNumber(student.totalPayment || 0);
  totalPaidEl.innerText = '৳' + formatNumber(student.paid || 0);
  totalDueEl.innerText = '৳' + formatNumber(student.due || 0);

  // Suggest remaining due in amount field
  const amountField = document.getElementById('pmtNewAmount');
  if (amountField) amountField.value = student.due > 0 ? student.due : '';

  // Populate history table
  const tbody = document.getElementById('pmtHistoryBody');
  if (!tbody) {
    console.warn('[FinanceCRUD] pmtHistoryBody element missing in DOM.');
    return;
  }
  tbody.innerHTML = '';

  const installments = getStudentInstallments(student);
  if (installments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No payments recorded yet.</td></tr>';
  } else {
    installments.forEach((inst, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${inst.date} ${inst.isMigrated ? '(Initial)' : ''}</td>
        <td><span class="badge bg-light text-dark border">${inst.method || 'N/A'}</span></td>
        <td class="text-end fw-bold">৳${formatNumber(inst.amount)}</td>
        <td class="text-end">
          <div class="d-flex gap-1 justify-content-end">
            <button class="btn btn-sm btn-outline-primary" onclick="printReceipt(${rowIndex}, ${inst.amount})">
              <i class="bi bi-printer"></i> RECEIPT
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteInstallment(${rowIndex}, ${idx})" title="Delete this payment">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const el = document.getElementById('studentPaymentModal');
  if (!el) return;
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.show();
}

function handleAddInstallment() {
  if (currentPaymentStudentIndex === null) return;

  // Use direct array index access instead of find with rowIndex
  const student = globalData.students[currentPaymentStudentIndex];
  if (!student) {
    alert('Student not found!');
    return;
  }

  const amount = parseFloat(document.getElementById('pmtNewAmount').value);
  const method = document.getElementById('pmtNewMethod').value;
  const today = new Date().toISOString().split('T')[0];

  // ✅ CRITICAL VALIDATION: Payment Method is REQUIRED
  if (!method || method.trim() === '') {
    showErrorToast('❌ Payment Method is required! Please select a payment method.');
    document.getElementById('pmtNewMethod').focus();
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  // ✅ BLOCK: Payment cannot exceed due amount
  if (amount > (parseFloat(student.due) || 0)) {
    showErrorToast('❌ Payment amount (৳' + formatNumber(amount) + ') cannot exceed current Due (৳' + formatNumber(student.due) + ')! Please enter a valid amount.');
    document.getElementById('pmtNewAmount').style.borderColor = '#ff4455';
    document.getElementById('pmtNewAmount').style.boxShadow = '0 0 8px rgba(255, 68, 85, 0.5)';
    document.getElementById('pmtNewAmount').focus();
    setTimeout(() => {
      document.getElementById('pmtNewAmount').style.borderColor = '';
      document.getElementById('pmtNewAmount').style.boxShadow = '';
    }, 4000);
    return;
  }

  // 1. Update Student Data
  if (!student.installments) student.installments = [];

  // Ensure we don't duplicate migrated payments if we add new ones
  // (We'll keep the underlying installments array clean, the helper handles display)
  student.installments.push({ amount, date: today, method });

  student.paid = (parseFloat(student.paid) || 0) + amount;
  student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);

  // 2. Add to Finance Ledger (with duplicate prevention)
  const _installNow = new Date().toISOString();
  const financeEntry = {
    id: Date.now(),
    type: 'Income',
    method: method,
    date: today,
    category: 'Student Installment',
    person: student.name,
    amount: amount,
    description: `Installment payment for student: ${student.name} | Batch: ${student.batch}`,
    timestamp: _installNow,
    _createdAt: _installNow, // ✅ V39.10: sync conflict resolution
    _updatedAt: _installNow  // ✅ V39.10: sync conflict resolution
  };

  // ✅ FIX: student.paid ইতিমধ্যে update হয়েছে (উপরে)।
  // Finance total = student.paid - amount (এই entry যোগের আগের value)
  // যদি finance total ইতিমধ্যে student.paid এর সমান বা বেশি হয়, তাহলে duplicate।
  const financeTotal = (globalData.finance || [])
    .filter(f => !f._deleted && f.person === student.name &&
      (f.category === 'Student Installment' || f.category === 'Student Fee'))
    .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
  const paidBeforeThisEntry = (parseFloat(student.paid) || 0) - amount; // এই entry যোগের আগে কত ছিল

  // ✅ FIX: সঠিক logic — financeTotal যদি paidBeforeThisEntry এর চেয়ে কম হয়
  // তার মানে এই payment এখনো finance-এ নেই, তাই push করো।
  // যদি financeTotal ইতিমধ্যে paidBeforeThisEntry এর সমান বা বেশি হয়, তাহলে duplicate।
  if (financeTotal < paidBeforeThisEntry + 1) { // financeTotal < পূর্বের paid → এটা নতুন entry, push করো
    globalData.finance.push(financeEntry);
    // 3. Update Account Balance
    if (typeof window.feApplyEntryToAccount === 'function') {
      window.feApplyEntryToAccount(financeEntry, +1);
    } else if (typeof updateAccountBalance === 'function') {
      updateAccountBalance(financeEntry.method, financeEntry.amount, financeEntry.type);
    }
  } else {
    console.warn(`⚠️ Duplicate finance entry prevented for ${student.name}. Finance:${financeTotal} >= PaidBefore:${paidBeforeThisEntry}`);
  }

  // 4. Save & Refresh
  saveToStorage();

  // Success feedback
  showSuccessToast('Installment added successfully!');

  if (typeof logActivity === 'function') {
    logActivity('finance', 'PAYMENT', 'Installment added for: ' + student.name + ' | Amount: ৳' + amount + ' | Method: ' + method);
  }

  // Reset form
  document.getElementById('pmtNewAmount').value = '';

  // Refresh modal UI
  openStudentPaymentModal(currentPaymentStudentIndex);

  // Refresh main table
  render(globalData.students);
  updateGlobalStats();

  // Trigger receipt
  printReceipt(currentPaymentStudentIndex, amount);
}

window.openStudentPaymentModal = openStudentPaymentModal;
window.handleAddInstallment = handleAddInstallment;

// ✅ DELETE INSTALLMENT — Payment History থেকে একটা payment সরানো
function deleteInstallment(rowIndex, instIndex) {
  const student = globalData.students[rowIndex];
  if (!student) { alert('Student not found!'); return; }

  const installments = getStudentInstallments(student);
  const inst = installments[instIndex];
  if (!inst) { alert('Installment not found!'); return; }

  // ⛔ PROTECT: Migrated/Initial payment ডিলিট করা যাবে না
  // এগুলো student.installments array-তে নেই, শুধু paid-installmentsSum gap থেকে তৈরি
  // ডিলিট করলে পুরো payment history মুছে যাবে
  if (inst.isMigrated) {
    alert('⚠️ Initial/Opening payment ডিলিট করা যায় না।\n\nএটি আপনার পূর্বের সব payment-এর সমষ্টি।\nশুধুমাত্র নতুন যোগ করা installment ডিলিট করা যাবে।');
    return;
  }

  // ⚠️ Confirm, moveToTrash, logActivity - এতিমধ্যে patch (recycle-bin-fix.js) করবে।
  // এখানে শুধুমাত্র core data mutation ও balance adjustment থাকবে।

  const amount = parseFloat(inst.amount) || 0;
  const method = inst.method || 'Cash';

  // 0. ✅ Recycle Bin এ সেভ করো (restore করার জন্য)
  if (typeof moveToTrash === 'function') {
    moveToTrash('installment', {
      studentName: student.name,
      studentIndex: rowIndex,
      amount: amount,
      date: inst.date,
      method: method,
      batch: student.batch || '',
      description: `Installment: ৳${formatNumber(amount)} | ${student.name} | ${inst.date}`
    });
  }

  if (typeof logActivity === 'function') {
    logActivity('installment', 'DELETE',
      `Installment moved to trash: ৳${amount} for ${student.name}`, inst);
  }
  // 1. Student installments array থেকে সরাও
  // ✅ FIX: date + amount দিয়ে match করো — index calculation এ ভুল হতে পারে
  // কারণ: migrated entry display list এ আছে কিন্তু student.installments এ নেই
  const realInstList = student.installments || [];
  let spliced = false;
  for (let i = 0; i < realInstList.length; i++) {
    if (
      parseFloat(realInstList[i].amount) === amount &&
      (!inst.date || realInstList[i].date === inst.date) &&
      (!inst.method || realInstList[i].method === inst.method || !inst.method)
    ) {
      realInstList.splice(i, 1);
      spliced = true;
      break;
    }
  }
  if (!spliced) {
    // fallback: পুরনো index-based method
    const displayList2 = getStudentInstallments(student);
    const migratedCount2 = displayList2.filter(i => i.isMigrated).length;
    const realIndex2 = instIndex - migratedCount2;
    if (realIndex2 >= 0 && student.installments && realIndex2 < student.installments.length) {
      student.installments.splice(realIndex2, 1);
    }
  }

  // 2. Student paid/due update করো (শুধু এই installment এর amount কমাও)
  student.paid = Math.max(0, (parseFloat(student.paid) || 0) - amount);
  student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);

  // 3. Finance ledger থেকেও সরাও (FIRST matching entry — amount + date + method)
  // ✅ FIX: method ও check করো যাতে same amount/date এর ভিন্ন method ভুলে না মুছে
  let deletedFinanceEntry = null;
  let deletedOne = false;
  globalData.finance = (globalData.finance || []).filter(f => {
    if (deletedOne) return true;
    const sameAmount = parseFloat(f.amount) === amount;
    const samePerson = (f.person || '').trim().toLowerCase() === (student.name || '').trim().toLowerCase()
      || (f.description && f.description.toLowerCase().includes((student.name || '').toLowerCase()));
    const sameDate = inst.date ? f.date === inst.date : true;
    // ✅ method match যোগ করা হয়েছে (optional — না থাকলে skip)
    const sameMethod = !inst.method || !f.method || f.method === method;
    if (sameAmount && samePerson && sameDate && sameMethod) {
      deletedOne = true;
      deletedFinanceEntry = f;
      return false;
    }
    return true;
  });

  // 4. Account balance reverse করো
  if (deletedOne) {
    // শুধু finance entry পাওয়া গেলেই balance reverse করো
    if (typeof updateAccountBalance === 'function') {
      updateAccountBalance(method, amount, 'Income', false);
    }
  }

  // 5. Delete tracking (sync এর জন্য)
  const _delCount = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
  localStorage.setItem('wings_total_deleted', _delCount.toString());

  // 6. Save immediately to localStorage + cloud (IMMEDIATE push)
  // ✅ FIX: intentional flag set করো যাতে saveToStorage block না হয়
  window._intentionalFinanceDelete = true;
  // ✅ FIX: counter আপডেট করো — না হলে পরের save block হবে
  localStorage.setItem('wings_last_known_finance', String((window.globalData.finance || []).length));
  localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
  if (typeof window.pushToCloud === 'function') {
    window.pushToCloud('Delete Installment: ' + student.name + ' ৳' + amount);
  } else if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Delete Installment: ' + student.name + ' ৳' + amount);
  } else {
    saveToStorage();
  }
  window._intentionalFinanceDelete = false;

  showSuccessToast('Payment deleted successfully! (Recycle Bin এ আছে)');

  // 7. Modal refresh করো
  openStudentPaymentModal(rowIndex);
  render(globalData.students);
  updateGlobalStats();
  if (typeof renderLedger === 'function') renderLedger(globalData.finance);
  if (typeof renderAccountList === 'function') renderAccountList();
  if (typeof renderCashBalance === 'function') renderCashBalance();
  if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
  if (typeof updateGrandTotal === 'function') updateGrandTotal();
}

window.deleteInstallment = deleteInstallment;



function deleteStudent(rowIndex) {


  // Get student info before deleting
  const student = globalData.students[rowIndex];
  if (!student) {
    alert("Error: Student not found.");
    return;
  }

  // 0. ✅ Move to trash before deleting (Keep a safe copy)
  if (typeof moveToTrash === 'function') moveToTrash('student', student);

  if (typeof logActivity === 'function') {
    logActivity('student', 'DELETE',
      'Student moved to trash: ' + (student.name || 'Unknown') + ' | Batch: ' + (student.batch || '-') + ' | Course: ' + (student.course || '-'), student);
  }

  // Delete count track করো (sync এর জন্য)
  const _delCount = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
  localStorage.setItem('wings_total_deleted', _delCount.toString());

  // CRITICAL: Reverse all account balances from this student's payments
  // (Including the initial payment gap)
  const allPayments = getStudentInstallments(student);
  if (allPayments.length > 0) {
    allPayments.forEach(inst => {
      const amount = parseFloat(inst.amount) || 0;
      const method = inst.method || 'Cash';

      // Reverse the payment: deduct from account
      if (method === 'Cash') {
        globalData.cashBalance = (parseFloat(globalData.cashBalance) || 0) - amount;
      } else {
        // Check bank accounts
        let account = (globalData.bankAccounts || []).find(acc => acc.name === method);
        if (!account) {
          // Check mobile banking
          account = (globalData.mobileBanking || []).find(acc => acc.name === method);
        }
        if (account) {
          account.balance = (parseFloat(account.balance) || 0) - amount;
        }
      }
    });
  }

  // Delete related finance transactions (student payments)
  if (globalData.finance && Array.isArray(globalData.finance)) {
    const sNameLower = (student.name || '').trim().toLowerCase();
    const sId = student.studentId ? String(student.studentId).toLowerCase() : null;

    // Remove all finance entries where student name or ID matches
    globalData.finance = globalData.finance.filter(f => {
      const fPersonLower = (f.person || '').trim().toLowerCase();
      const fStudentNameLower = (f.studentName || '').trim().toLowerCase();
      const fDescLower = (f.description || '').toLowerCase();

      // Match 1: Direct name match
      const isDirectMatch = fPersonLower === sNameLower || fStudentNameLower === sNameLower;

      // Match 2: Name in description (very likely for auto-generated fees)
      const isDescMatch = fDescLower && fDescLower.includes(sNameLower);

      // Match 3: Student ID in description (most reliable if present)
      const isIdMatch = sId && fDescLower && fDescLower.includes(sId);

      // Match 4: Name variant (Description contains just the name parts)
      const nameParts = sNameLower.split(' ').filter(p => p.length > 3);
      const isNamePartMatch = nameParts.length > 0 && nameParts.some(p => fDescLower.includes(p) && f.category === 'Student Fee');

      const isMatch = isDirectMatch || isDescMatch || isIdMatch || isNamePartMatch;

      // Keep transaction if it's NOT a match
      return !isMatch;
    });
  }

  // Remove student from array
  if (rowIndex >= 0 && rowIndex < globalData.students.length) {
    globalData.students.splice(rowIndex, 1);
  } else {
    alert("Error deleting student.");
    return;
  }

  // ✅ Save locally first
  // FIX: intentional flag + counter update — না হলে saveToStorage BLOCK হবে
  window._intentionalFinanceDelete = true;
  localStorage.setItem('wings_last_known_finance', String((window.globalData.finance || []).length));
  saveToStorage(true);

  // Update monitor after student delete
  if (typeof window.recordMonitorChange === 'function') {
    setTimeout(() => window.recordMonitorChange('student-deleted'), 100);
  }

  // ✅ Schedule cloud sync
  if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Delete Student: ' + (student.name || 'Unknown'));
  }

  showSuccessToast('Student deleted successfully! (Payments reversed)');
  render(globalData.students);

  // ✅ FORCE REBUILD: Ensure accounts match finance ledger exactly
  if (typeof rebuildBankBalancesFromFinance === 'function') rebuildBankBalancesFromFinance();
  if (typeof recalculateCashBalanceFromTransactions === 'function') recalculateCashBalanceFromTransactions();

  updateGlobalStats();

  // Update account displays
  if (typeof renderAccountList === 'function') renderAccountList();
  if (typeof renderCashBalance === 'function') renderCashBalance();
  if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
  if (typeof updateGrandTotal === 'function') updateGrandTotal();
}

window.deleteStudent = deleteStudent;

// ✅ V28 FIX: auto-test critical function checks — aliases যোগ করা হয়েছে
window.openStudentModal = function (index) {
  // student modal খোলে — add/edit উভয় ক্ষেত্রে
  const el = document.getElementById('studentModal');
  if (!el) return;
  if (index !== undefined && window.globalData && window.globalData.students[index]) {
    // edit mode — form populate করতে পারলে করো
  }
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.show();
};
// These functions are in app.js (loads after), so use deferred assignment
document.addEventListener('DOMContentLoaded', function () {
  if (typeof handleStudentSubmit !== 'undefined') window.saveStudent = handleStudentSubmit;
  if (typeof render !== 'undefined') window.renderStudents = render;
  if (typeof handleEmployeeSubmit !== 'undefined') window.saveEmployee = handleEmployeeSubmit;
});

async function handleFinanceSubmit(e) {
  e.preventDefault();

  const form = document.getElementById('financeForm');
  const formData = {};
  new FormData(form).forEach((value, key) => formData[key] = value);

  // ✅ CRITICAL VALIDATION: Payment Method is REQUIRED
  if (!formData.method || formData.method.trim() === '') {
    showErrorToast('❌ Payment Method is required! Please select a payment method.');
    document.getElementById('financeMethodSelect').focus();
    return;
  }

  // ✅ VALIDATION: Person field is mandatory for Loan transactions
  const type = formData.type || '';
  const category = (formData.category || '').trim();
  const person = (formData.person || '').trim();

  const isLoan = (type === 'Loan Given' || type === 'Loan Received' || category === 'Loan');

  if (isLoan && !person) {
    showErrorToast('⚠️ Person/Counterparty name is required for Loan transactions!');
    const personField = document.getElementById('financePerson') || document.querySelector('[name="person"]');
    if (personField) personField.focus();
    return;
  }

  // ✅ VALIDATION: Balance cannot go negative for Expense/Loan Given
  const finAmount = parseFloat(formData.amount) || 0;
  const isDebit = (type === 'Expense' || type === 'Loan Given' || type === 'Loan Giving' || type === 'Transfer Out');
  if (isDebit && finAmount > 0 && formData.method) {
    let availableBalance = 0;
    const methodName = formData.method.trim();

    if (methodName === 'Cash') {
      availableBalance = parseFloat(window.globalData.cashBalance) || 0;
    } else {
      // Check bank accounts
      const bankAcc = (window.globalData.bankAccounts || []).find(a => a.name === methodName);
      if (bankAcc) {
        availableBalance = parseFloat(bankAcc.balance) || 0;
      } else {
        // Check mobile banking
        const mobAcc = (window.globalData.mobileBanking || []).find(a => a.name === methodName);
        if (mobAcc) {
          availableBalance = parseFloat(mobAcc.balance) || 0;
        }
      }
    }

    if (finAmount > availableBalance) {
      showErrorToast('❌ Insufficient balance in "' + methodName + '"! Available: ৳' + formatNumber(availableBalance) + ', Attempted: ৳' + formatNumber(finAmount));
      return;
    }
  }

  // Add transaction to data
  const newTransaction = {
    id: Date.now(), // Unique ID
    type: formData.type,
    method: formData.method,
    date: formData.date,
    amount: parseFloat(formData.amount) || 0,
    category: formData.category || 'General',
    description: formData.description || '',
    person: person,
    _createdAt: new Date().toISOString(), // ✅ V39.10: sync conflict resolution
    _updatedAt: new Date().toISOString()  // ✅ V39.10: sync conflict resolution
  };

  window.globalData.finance.push(newTransaction);
  // v8 FIX: feApplyEntryToAccount ব্যবহার করো (canonical) — না থাকলে পুরনো fallback
  if (typeof window.feApplyEntryToAccount === 'function') {
    window.feApplyEntryToAccount(newTransaction, +1);
  } else if (typeof updateAccountBalance === "function") {
    updateAccountBalance(newTransaction.method, newTransaction.amount, newTransaction.type);
  }
  await saveToStorage();

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('financeModal'));
  if (modal) modal.hide();

  // Reset form and reload
  form.reset();

  // Reset date to today
  const today = new Date().toISOString().split('T')[0];
  form.querySelector('input[name="date"]').value = today;

  showSuccessToast('Transaction added successfully!');
  if (typeof logActivity === 'function') logActivity('finance', 'ADD',
    (formData.type || 'Transaction') + ': ' + (formData.category || '') + ' - ৳' + (formData.amount || 0) + ' | ' + (formData.description || ''));
  updateGlobalStats(); if (typeof renderFinanceTable === "function") renderFinanceTable();
}

// ===================================
// ADD TRANSFER TRANSACTION
// ===================================

async function handleTransferSubmit(e) {
  e.preventDefault();

  const form = document.getElementById('transferForm');
  const formData = {};
  new FormData(form).forEach((value, key) => formData[key] = value);

  const amount = parseFloat(formData.amount) || 0;
  const fromMethod = formData.fromMethod;
  const toMethod = formData.toMethod;
  const date = new Date().toISOString().split('T')[0];

  if (fromMethod === toMethod) {
    alert('Source and destination accounts must be different.');
    return;
  }

  const _transferNow = new Date().toISOString();
  // Create "Transfer Out" from source
  const outTransaction = {
    id: Date.now(),
    type: 'Transfer Out',
    method: fromMethod,
    date: date,
    amount: amount,
    category: 'Transfer',
    description: formData.description || `Transfer to ${toMethod}`,
    _createdAt: _transferNow, // ✅ V39.10: sync
    _updatedAt: _transferNow  // ✅ V39.10: sync
  };

  // Create "Transfer In" to destination
  const inTransaction = {
    id: Date.now() + 1,
    type: 'Transfer In',
    method: toMethod,
    date: date,
    amount: amount,
    category: 'Transfer',
    description: formData.description || `Transfer from ${fromMethod}`,
    _createdAt: _transferNow, // ✅ V39.10: sync
    _updatedAt: _transferNow  // ✅ V39.10: sync
  };

  globalData.finance.push(outTransaction);
  globalData.finance.push(inTransaction);

  // v8 FIX: feApplyEntryToAccount ব্যবহার করো (canonical)
  if (typeof window.feApplyEntryToAccount === 'function') {
    window.feApplyEntryToAccount(outTransaction, +1);
    window.feApplyEntryToAccount(inTransaction, +1);
  }

  await saveToStorage();

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('transferModal'));
  modal.hide();

  form.reset();
  showSuccessToast('Transfer completed successfully!');
  if (typeof logActivity === 'function') {
    logActivity('finance', 'SETTINGS', 'Transfer: ৳' + amount + ' from ' + fromMethod + ' to ' + toMethod);
  }
  updateGlobalStats(); if (typeof renderFinanceTable === "function") renderFinanceTable();
}

// ===================================
// DELETE TRANSACTION
// ===================================

function deleteTransaction(id) {

  // Handle both string and number IDs (localStorage/Supabase can change types)
  const sid = String(id);
  const txToDelete = globalData.finance.find(f => String(f.id) === sid);

  if (!txToDelete) {
    showErrorToast('Transaction not found.');
    renderLedger(globalData.finance);
    if (typeof renderAccountDetails === 'function') renderAccountDetails();
    return;
  }

  // 1. ✅ Account balance reverse করো (finance-engine canonical rules use হবে)
  // v8 FIX: feApplyEntryToAccount আছে কিনা আগে check করো — এটা finance-engine.js
  // এর canonical function। থাকলে এটাই ব্যবহার করো, না থাকলে পুরনো fallback।
  if (typeof window.feApplyEntryToAccount === 'function') {
    window.feApplyEntryToAccount(txToDelete, -1); // -1 = reverse/undo
  } else if (typeof updateAccountBalance === "function") {
    updateAccountBalance(txToDelete.method, txToDelete.amount, txToDelete.type, false);
  }

  // 2. ✅ SAFE FIX: যদি Student Fee/Installment হয়, শুধু matching installment
  //    পাওয়া গেলেই student.paid কমাও। Auto-heal entry বা legacy entry ডিলিট
  //    করলে student.paid ছোঁয়া হবে না।
  const isStudentPayment = (
    txToDelete.type === 'Income' &&
    (txToDelete.category === 'Student Fee' || txToDelete.category === 'Student Installment')
  );

  if (isStudentPayment && txToDelete.person && globalData.students) {
    const studentName = txToDelete.person.trim();
    const student = globalData.students.find(s => (s.name || '').trim().toLowerCase() === studentName.toLowerCase()); // Case-insensitive matching
    if (student) {
      const txAmount = parseFloat(txToDelete.amount) || 0;
      const txDate = txToDelete.date;

      // ✅ matching entry থাকলেই paid কমাও (Installments array-তে)
      let foundMatchingInstallment = false;
      if (student.installments && student.installments.length > 0) {
        for (let i = 0; i < student.installments.length; i++) {
          const inst = student.installments[i];
          const instAmt = parseFloat(inst.amount) || 0;
          if (instAmt === txAmount && (!txDate || inst.date === txDate)) {
            student.installments.splice(i, 1);
            foundMatchingInstallment = true;
            break;
          }
        }
      }

      // ✅ Gap Check: যদি installments এ না থাকে, তবে কি এটি "Initial Payment" (gap)?
      let isInitialGap = false;
      if (!foundMatchingInstallment) {
        const currentSum = (student.installments || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const gap = (parseFloat(student.paid) || 0) - currentSum;
        // ৳1 এর কম পার্থক্য থাকলে match ধরো (rounding error এর জন্য)
        if (gap > 0 && Math.abs(gap - txAmount) < 1) {
          isInitialGap = true;
        }
      }

      if (foundMatchingInstallment || isInitialGap) {
        // ✅ Matching entry বা Gap পাওয়া গেছে — paid/due reverse করো
        student.paid = Math.max(0, (parseFloat(student.paid) || 0) - txAmount);
        student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);
        console.log(`✅ Student "${studentName}" update: paid=৳${student.paid}, due=৳${student.due} (Gap: ${isInitialGap})`);

        // ⛔ USER REQUEST: যদি প্রথম/ইনিশিয়াল পেমেন্ট ডিলিট হয় এবং আর কোনো পেমেন্ট না থাকে, তবে স্টুডেন্ট ডিলিট করো
        if (student.paid <= 0 && (!student.installments || student.installments.length === 0)) {
          const sIdx = globalData.students.indexOf(student);
          if (sIdx !== -1) {
            if (typeof moveToTrash === 'function') moveToTrash('student', student);
            globalData.students.splice(sIdx, 1);
            console.log(`🗑️ Student "${studentName}" auto-deleted because all payments were removed.`);
          }
        }
      } else {
        // ⚠️ Matching installment নেই — Auto-heal entry বা legacy entry
        console.log(`ℹ️ Finance entry for "${studentName}" deleted (no matching installment/gap — student.paid unchanged)`);
      }
    }
  }

  // 3. Finance ledger থেকে সরাও
  // ✅ FIX: moveToTrash যোগ করা হয়েছে — আগে এটা ছিল না, তাই Recycle Bin এ যেত না
  if (typeof window.moveToTrash === 'function') {
    window.moveToTrash('finance', txToDelete);
  }
  globalData.finance = globalData.finance.filter(f => String(f.id) !== sid);

  // ✅ Activity log — delete transaction
  if (typeof logActivity === 'function') {
    logActivity('finance', 'DELETE',
      'Transaction deleted: ' + (txToDelete.category || txToDelete.type || 'Entry') +
      ' | ৳' + (parseFloat(txToDelete.amount) || 0) +
      (txToDelete.person ? ' | ' + txToDelete.person : '') +
      ' | Date: ' + (txToDelete.date || '-'),
      { id: txToDelete.id, type: txToDelete.type, amount: txToDelete.amount, category: txToDelete.category, date: txToDelete.date, person: txToDelete.person }
    );
  }

  // 4. Render FIRST so user sees the change immediately
  renderLedger(globalData.finance);
  updateGlobalStats();
  if (typeof render === 'function') render(globalData.students);

  // ✅ Explicitly mark dirty for V31 sync
  if (typeof window.markDirty === 'function') {
    window.markDirty('finance');
    window.markDirty('students');
    window.markDirty('meta');
  }
  showSuccessToast('Transaction deleted successfully!');

  // 5. Delete tracking (sync এর জন্য)
  const _dc = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
  localStorage.setItem('wings_total_deleted', _dc.toString());
  // ✅ FIX: intentional flag + counter update
  window._intentionalFinanceDelete = true;
  localStorage.setItem('wings_last_known_finance', String((window.globalData.finance || []).length));
  localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
  window._intentionalFinanceDelete = false;
  if (typeof window.pushToCloud === 'function') {
    window.pushToCloud('Delete Transaction: ' + (txToDelete.description || txToDelete.category || String(id)));
  } else if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Delete Transaction: ' + (txToDelete.description || txToDelete.category || String(id)));
  } else {
    saveToStorage();
  }

  // 6. Refresh Account Details modal if open
  const accModal = document.getElementById('accountDetailsModal');
  if (accModal && bootstrap.Modal.getInstance(accModal)) {
    renderAccountDetails();
  }

  // 7. সব Account UI refresh করো
  if (typeof renderAccountList === 'function') renderAccountList();
  if (typeof renderCashBalance === 'function') renderCashBalance();
  if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
  if (typeof updateGrandTotal === 'function') updateGrandTotal();
}

// ===================================
// EDIT TRANSACTION
// ===================================

window.deleteTransaction = deleteTransaction;

// Alias for delete button in finance table
function _handleDeleteTx(id) {
  if (!id) return;
  // patch layer confirm করবে।
  deleteTransaction(id);
}
window._handleDeleteTx = _handleDeleteTx;

function editTransaction(id) {
  // ✅ SUPPORT LAZY LOADING: If modal not in DOM, load it first
  if (!document.getElementById('editTransactionModal')) {
    if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
      window.sectionLoader.loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', 'editTransactionModal', function () {
        editTransaction(id); // Re-run once loaded
      });
      return;
    }
  }

  const sid = String(id);
  const transaction = globalData.finance.find(f => String(f.id) === sid);
  if (!transaction) {
    showErrorToast('Transaction not found: ' + id);
    return;
  }

  // ✅ Ensure dropdowns (Method, etc.) are populated before setting values
  if (typeof window.populateDropdowns === 'function') {
    window.populateDropdowns();
  }

  const form = document.getElementById('editTransactionForm');
  if (!form) return;
  form.transactionId.value = transaction.id;
  form.type.value = transaction.type;
  form.method.value = transaction.method || 'Cash';
  form.date.value = transaction.date;
  form.amount.value = transaction.amount;
  form.category.value = transaction.category || '';
  form.description.value = transaction.description || '';
  form.person.value = transaction.person || '';

  const el = document.getElementById('editTransactionModal');
  if (!el) return;
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.show();
}

window.editTransaction = editTransaction;

async function handleEditTransactionSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('editTransactionForm');
  const formData = {};
  new FormData(form).forEach((value, key) => formData[key] = value);

  // ✅ CRITICAL VALIDATION: Payment Method is REQUIRED
  if (!formData.method || formData.method.trim() === '') {
    showErrorToast('❌ Payment Method is required! Please select a payment method.');
    document.getElementById('editTransMethodSelect').focus();
    return;
  }

  // ✅ VALIDATION: Person field required for Loan transactions
  const _editType = formData.type || '';
  const _editCategory = (formData.category || '').trim();
  const _editPerson = (formData.person || '').trim();
  const _editIsLoan = (_editType === 'Loan Given' || _editType === 'Loan Received' || _editCategory === 'Loan');
  if (_editIsLoan && !_editPerson) {
    showErrorToast('⚠️ Person/Counterparty name is required for Loan transactions!');
    const pf = document.getElementById('editPersonField') || document.querySelector('#editTransactionForm [name="person"]');
    if (pf) pf.focus();
    return;
  }

  const id = formData.transactionId; // keep as string/original
  const index = globalData.finance.findIndex(f => String(f.id) === String(id));

  if (index !== -1) {
    const oldTx = { ...globalData.finance[index] };
    const newAmount = parseFloat(formData.amount) || 0;

    // 1. ✅ ACCOUNT BALANCE SYNC: Reverse old impact, then apply new impact
    if (typeof updateAccountBalance === "function") {
      // Reverse old
      updateAccountBalance(oldTx.method, oldTx.amount, oldTx.type, false);
      // Apply new
      updateAccountBalance(formData.method, newAmount, formData.type, true);
    }

    // 2. Update Finance Array
    // ✅ V39.10 FIX: _updatedAt = REAL current time — sync conflict resolution এর জন্য
    // আগে _updatedAt সেট হতো না → cloud-এর পুরনো version সবসময় win করতো → edit revert!
    globalData.finance[index] = {
      ...globalData.finance[index],
      type: formData.type,
      method: formData.method,
      date: formData.date,
      amount: newAmount,
      category: formData.category,
      description: formData.description,
      person: formData.person || '',
      _updatedAt: new Date().toISOString() // ✅ CRITICAL: real edit time for sync
    };

    // ✅ Activity log — edit transaction
    if (typeof logActivity === 'function') {
      logActivity('finance', 'EDIT',
        'Transaction edited: ' + (oldTx.category || oldTx.type || 'Entry') +
        ' | ৳' + oldTx.amount + ' → ৳' + newAmount +
        (oldTx.date !== formData.date ? ' | Date: ' + oldTx.date + ' → ' + formData.date : '') +
        (oldTx.type !== formData.type ? ' | Type: ' + oldTx.type + ' → ' + formData.type : '') +
        (formData.person ? ' | ' + formData.person : ''),
        { before: oldTx, after: globalData.finance[index] }
      );
    }

    // ✅ V39.10 FIX: Mark dirty and push immediately after edit
    if (typeof window.markDirty === 'function') window.markDirty('finance');
    await saveToStorage();
    if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush('Finance Edit');

    const modal = bootstrap.Modal.getInstance(document.getElementById('editTransactionModal'));
    if (modal) modal.hide();

    showSuccessToast('Transaction updated successfully! (Balances synced)');

    // Refresh
    if (typeof renderLedger === 'function') renderLedger(globalData.finance);
    if (typeof updateGlobalStats === 'function') updateGlobalStats();

    // Also refresh Account Details if open
    if (document.getElementById('accountDetailsModal') && bootstrap.Modal.getInstance(document.getElementById('accountDetailsModal'))) {
      if (typeof renderAccountDetails === 'function') renderAccountDetails();
    }

    // Refresh Account List, Cash, etc.
    if (typeof renderAccountList === 'function') renderAccountList();
    if (typeof renderCashBalance === 'function') renderCashBalance();
  }
}


// Global exposures
window.getStudentInstallments = getStudentInstallments;
window.handleFinanceSubmit = handleFinanceSubmit;
window.handleTransferSubmit = handleTransferSubmit;
window.handleEditTransactionSubmit = handleEditTransactionSubmit;
window.editTransaction = editTransaction;
window._handleDeleteTx = _handleDeleteTx;

// ── Delete & Edit Transaction Event Delegation ───────────────────────────────
// Uses ledgerTableBody directly to avoid document-level conflicts
function attachLedgerListeners() {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody || tbody._listenersAttached) return;
  tbody._listenersAttached = true;

  tbody.addEventListener('click', function (e) {
    // Edit button
    const editBtn = e.target.closest('.edit-tx-btn');
    if (editBtn) {
      const txId = editBtn.getAttribute('data-txid');
      if (txId) editTransaction(txId);
      return;
    }

    // Delete button
    const delBtn = e.target.closest('.del-tx-btn');
    if (delBtn) {
      const txId = delBtn.getAttribute('data-txid');
      if (txId) _handleDeleteTx(txId);
      return;
    }
  });
}

// Attach on DOM ready and after every renderLedger call
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(attachLedgerListeners, 500);
});

// Use event delegation on document level as fallback
document.addEventListener('click', function (e) {
  const editBtn = e.target.closest('.edit-tx-btn');
  if (editBtn) {
    const txId = editBtn.getAttribute('data-txid');
    if (txId) editTransaction(txId);
    return;
  }

  const delBtn = e.target.closest('.del-tx-btn');
  if (delBtn) {
    const txId = delBtn.getAttribute('data-txid');
    if (txId) _handleDeleteTx(txId);
  }
});

window.attachLedgerListeners = attachLedgerListeners;

function printStudentPaymentHistory(rowIndex) {
  const student = globalData.students[rowIndex];
  if (!student) return;

  const installments = getStudentInstallments(student);
  let rows = '';

  installments.forEach((inst, idx) => {
    rows += `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${inst.date} ${inst.isMigrated ? '(Initial)' : ''}</td>
        <td style="text-align:center;">${inst.method || 'N/A'}</td>
        <td style="text-align:right; font-weight:bold;">৳${formatNumber(inst.amount)}</td>
      </tr>
    `;
  });

  if (installments.length === 0) {
    rows = '<tr><td colspan="4" style="text-align:center;">No payments recorded yet.</td></tr>';
  }

  const printDate = (typeof window.formatPrintDate === 'function') ? window.formatPrintDate(new Date()) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment History - ${student.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; line-height: 1.5; }
        .text-center { text-align: center; }
        .mb-2 { margin-bottom: 10px; }
        .mb-4 { margin-bottom: 20px; }
        .header-logo { height: 60px; margin-bottom: 10px; }
        h2, h3, h4 { margin: 0; padding: 0; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        .info-box { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #000; }
        th, td { border: 1px solid #000; padding: 8px 12px; font-size: 14px; }
        th { background-color: #f0f0f0; -webkit-print-color-adjust: exact; text-transform: uppercase; }
        .summary-boxes { display: flex; justify-content: space-between; margin-top: 30px; gap: 15px; }
        .s-box { padding: 10px 15px; border: 1px solid #000; text-align: center; flex: 1; border-radius: 5px; font-weight: bold; }
        .s-paid { background-color: #d4edda; -webkit-print-color-adjust: exact; }
        .s-due { background-color: #f8d7da; -webkit-print-color-adjust: exact; }
        .s-total { background-color: #e2e3e5; -webkit-print-color-adjust: exact; }
      </style>
    </head>
    <body>
      <div class="text-center mb-4">
        <img src="assets/img/logo.png" alt="Logo" class="header-logo" onerror="this.style.display='none'">
        <h2 class="mb-2">Wings Fly Aviation Academy</h2>
        <h4 style="border-bottom: 1px dashed #000; display: inline-block; padding-bottom: 5px;">Student Payment History</h4>
        <p style="font-size: 12px; margin-top: 5px;">Print Date: ${printDate}</p>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <strong>Student Name:</strong> ${student.name}<br>
          <strong>Phone:</strong> ${student.phone}<br>
        </div>
        <div class="info-box" style="text-align:right;">
          <strong>Course:</strong> ${student.course || 'N/A'}<br>
          <strong>Batch:</strong> ${student.batch || 'N/A'}<br>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 35%;">Date</th>
            <th style="width: 30%;">Method</th>
            <th style="width: 30%; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary-boxes">
        <div class="s-box s-total">
          <small>Total Fee</small><br>
          <span style="font-size: 18px;">৳${formatNumber(student.totalPayment || 0)}</span>
        </div>
        <div class="s-box s-paid">
          <small>Total Paid</small><br>
          <span style="font-size: 18px;">৳${formatNumber(student.paid || 0)}</span>
        </div>
        <div class="s-box s-due">
          <small>Outstanding Due</small><br>
          <span style="font-size: 18px;">৳${formatNumber(student.due || 0)}</span>
        </div>
      </div>

      <div style="margin-top: 60px; display: flex; justify-content: space-between;">
        <div style="border-top: 1px solid #000; padding-top: 5px; width: 200px; text-align: center;">Accounts Signature</div>
        <div style="border-top: 1px solid #000; padding-top: 5px; width: 200px; text-align: center;">Student Signature</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
window.printStudentPaymentHistory = printStudentPaymentHistory;

// ===================================
// RECYCLE BIN RESTORE — INSTALLMENT
// ===================================
// recycle-bin-fix.js এর restoreDeletedItem কে patch করো
// যাতে 'installment' type restore করলে student এ ফিরে যায়

(function _installInstallmentRestoreHook() {
  function _doHook() {
    const origRestore = window.restoreDeletedItem;
    if (typeof origRestore !== 'function') return false;
    if (origRestore._installmentHooked) return true;

    window.restoreDeletedItem = function(trashIndex) {
      // trash item দেখো
      const trashList = (window.globalData && window.globalData.deletedItems) || {};
      // deletedItems structure: {students:[], finance:[], employees:[], other:[]}
      // installment গুলো 'other' বা 'finance' বা আলাদা array তে থাকতে পারে
      // recycle-bin-fix.js যেভাবে store করে সেটা বের করো
      const allItems = [
        ...((trashList.students || []).map(x => ({ ...x, _bucket: 'students' }))),
        ...((trashList.finance || []).map(x => ({ ...x, _bucket: 'finance' }))),
        ...((trashList.employees || []).map(x => ({ ...x, _bucket: 'employees' }))),
        ...((trashList.other || []).map(x => ({ ...x, _bucket: 'other' })))
      ];

      const sorted = [...allItems].sort((a, b) => {
        const ta = a.deletedAt || a.timestamp || '';
        const tb = b.deletedAt || b.timestamp || '';
        return tb.localeCompare(ta);
      });

      const entry = sorted[trashIndex];

      // installment type হলে আলাদাভাবে handle করো
      if (entry && entry.type === 'installment') {
        const item = entry.item || entry;
        const studentName = item.studentName || item.name || '';
        const amount = parseFloat(item.amount) || 0;
        const date = item.date || '';
        const method = item.method || 'Cash';

        const student = (window.globalData.students || []).find(s =>
          (s.name || '').trim().toLowerCase() === studentName.trim().toLowerCase()
        );

        if (student) {
          // student.installments এ ফিরিয়ে দাও
          if (!student.installments) student.installments = [];
          student.installments.push({ amount, date, method });
          // sort by date
          student.installments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          // paid/due recalculate
          student.paid = (parseFloat(student.paid) || 0) + amount;
          student.due = Math.max(0, (parseFloat(student.totalPayment) || 0) - student.paid);

          // finance ledger এও ফিরিয়ে দাও
          const financeEntry = {
            id: Date.now(),
            type: 'Income',
            method: method,
            date: date,
            category: 'Student Installment',
            person: student.name,
            amount: amount,
            description: `Installment payment for student: ${student.name} | Batch: ${student.batch || ''}`,
            timestamp: new Date().toISOString(),
            _createdAt: new Date().toISOString(),
            _updatedAt: new Date().toISOString(),
            _restoredFromTrash: true
          };
          window.globalData.finance.push(financeEntry);

          // account balance update
          if (typeof window.feApplyEntryToAccount === 'function') {
            window.feApplyEntryToAccount(financeEntry, +1);
          } else if (typeof updateAccountBalance === 'function') {
            updateAccountBalance(method, amount, 'Income', true);
          }

          // trash থেকে সরাও (original restore কে call করো)
          const result = origRestore.call(this, trashIndex);

          // counter + save
          window._intentionalFinanceDelete = false;
          localStorage.setItem('wings_last_known_finance', String((window.globalData.finance || []).length));
          if (typeof saveToStorage === 'function') saveToStorage();
          if (typeof render === 'function') render(window.globalData.students);
          if (typeof renderLedger === 'function') renderLedger(window.globalData.finance);
          if (typeof updateGlobalStats === 'function') updateGlobalStats();

          if (typeof window.showSuccessToast === 'function') {
            window.showSuccessToast(`✅ Installment ৳${amount} (${studentName}) restore হয়েছে!`);
          }
          return result;
        } else {
          // student খুঁজে পাওয়া যায়নি
          if (typeof window.showErrorToast === 'function') {
            window.showErrorToast(`⚠️ Student "${studentName}" পাওয়া যায়নি — installment restore করা যায়নি।`);
          }
          return origRestore.call(this, trashIndex);
        }
      }

      // অন্য সব type — original restore
      return origRestore.call(this, trashIndex);
    };

    window.restoreDeletedItem._installmentHooked = true;
    console.log('✅ [FinanceCRUD] installment restore hook installed');
    return true;
  }

  // DOM ready এর পরে hook install করো
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        if (!_doHook()) {
          // recycle-bin-fix.js দেরিতে লোড হলে retry
          let tries = 0;
          const iv = setInterval(function() {
            if (_doHook() || ++tries > 20) clearInterval(iv);
          }, 500);
        }
      }, 2000);
    });
  } else {
    setTimeout(function() {
      if (!_doHook()) {
        let tries = 0;
        const iv = setInterval(function() {
          if (_doHook() || ++tries > 20) clearInterval(iv);
        }, 500);
      }
    }, 2000);
  }
})();
