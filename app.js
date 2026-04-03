// ===================================

// ===================================
// STUDENT MANAGEMENT
// Moved to: sections/student-management.js
// ===================================

// WINGS FLY AVIATION ACADEMY
// CORE APPLICATION LOGIC
// ===================================

const APP_VERSION = "5.0-SYNC-PRO"; // Redefined safely here
console.log(`🚀 Wings Fly Aviation - System Version: ${APP_VERSION}`);

// Initialize Global Data immediately to prevent ReferenceErrors
if (typeof window.globalData === 'undefined') {
  window.globalData = JSON.parse(localStorage.getItem('wingsfly_data')) || {
    students: [],
    employees: [],
    finance: [],
    settings: {},
    incomeCategories: ['Direct Income', 'Other Income'],
    expenseCategories: ['Rent', 'Salaries', 'Utilities'],
    paymentMethods: ['Cash'],
    cashBalance: 0,
    bankAccounts: [],
    mobileBanking: [],
    courseNames: [],
    attendance: {},
    nextId: 1001,
    users: [],
    examRegistrations: [],
    visitors: [],
    employeeRoles: [],
    deletedItems: { students: [], finance: [], employees: [] },
    activityHistory: []
  };
}

// Legacy global alias for older scripts that use `globalData` directly
// (finance-crud, student-management, etc.)
if (typeof globalData === 'undefined') {
  // Non-strict mode: this creates a writable global variable
  globalData = window.globalData;
}

// সবসময় নিশ্চিত করো
// ✅ FIX: ensure deletedItems is array with category properties
if (typeof window.WingsUtils?.ensureDeletedItemsObject === 'function') {
  window.WingsUtils.ensureDeletedItemsObject(window.globalData);
} else {
  const _di = window.globalData.deletedItems;
  if (!_di || (!Array.isArray(_di) && typeof _di !== 'object')) {
    const arr = []; arr.students=[]; arr.finance=[]; arr.employees=[]; arr.other=[];
    window.globalData.deletedItems = arr;
  } else if (!Array.isArray(_di)) {
    const flat = [...(_di.students||[]),...(_di.finance||[]),...(_di.employees||[]),...(_di.other||[])];
    flat.students=_di.students||[]; flat.finance=_di.finance||[]; flat.employees=_di.employees||[]; flat.other=_di.other||[];
    window.globalData.deletedItems = flat;
  } else {
    if(!Array.isArray(_di.students)) _di.students=[];
    if(!Array.isArray(_di.finance)) _di.finance=[];
    if(!Array.isArray(_di.employees)) _di.employees=[];
    if(!Array.isArray(_di.other)) _di.other=[];
  }
}
if (!window.globalData.activityHistory) window.globalData.activityHistory = [];

// Global Chart instances to prevent initialization errors
window.financeChartInstance = null;
window.studentStatusChart = null;
window.paymentMethodChart = null;

console.log('📦 Global Data Initialized.');

// ===================================
// ACTIVITY HISTORY & TRASH SYSTEM
// ===================================

// Log an activity to history

// activity-log — extracted to sections/activity-log.js

// Utility to format numbers with commas (Bangladeshi/Indian system)
function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}
window.formatNumber = formatNumber;

// ===================================
// STUDENT PHOTO STORAGE (IndexedDB - LOCAL ONLY)
// ===================================

const PHOTO_DB_NAME = 'WingsFlyPhotosDB';
const PHOTO_STORE_NAME = 'student_photos';

// Initialize IndexedDB

// photo-manager — extracted to sections/photo-manager.js

// SYNC: Update bank account, mobile banking, or cash balance based on transaction
// Uses finance-engine.js canonical type lists (FE_ACCOUNT_IN / FE_ACCOUNT_OUT)
function updateAccountBalance(method, amount, type, isAddition = true) {
  if (!window.globalData) return;

  // Delegate to finance-engine if available (canonical rules)
  if (typeof window.feApplyEntryToAccount === 'function') {
    const sign = isAddition ? 1 : -1;
    window.feApplyEntryToAccount({ method, amount, type }, sign);
    return;
  }

  // ── Fallback (finance-engine.js not yet loaded) ──
  // Canonical lists — must match finance-engine.js
  const moneyInTypes = ['Income', 'Transfer In', 'Loan Receiving', 'Loan Received', 'Registration', 'Refund', 'Advance', 'Investment'];
  const moneyOutTypes = ['Expense', 'Transfer Out', 'Loan Giving', 'Loan Given', 'Salary', 'Rent', 'Utilities', 'Advance Return', 'Investment Return'];

  const amt = parseFloat(amount) || 0;
  const multiplier = isAddition ? 1 : -1;

  if (method === 'Cash') {
    if (typeof globalData.cashBalance === 'undefined') globalData.cashBalance = 0;
    if (moneyInTypes.includes(type)) globalData.cashBalance += amt * multiplier;
    else if (moneyOutTypes.includes(type)) globalData.cashBalance -= amt * multiplier;
    if (typeof renderCashBalance === 'function') renderCashBalance();
    return;
  }

  let account = (window.globalData.bankAccounts || []).find(acc => acc.name === method);
  if (!account) account = (window.globalData.mobileBanking || []).find(acc => acc.name === method);
  if (!account) return;

  if (moneyInTypes.includes(type)) account.balance = (parseFloat(account.balance) || 0) + (amt * multiplier);
  else if (moneyOutTypes.includes(type)) account.balance = (parseFloat(account.balance) || 0) - (amt * multiplier);

  if (typeof renderAccountList === 'function') renderAccountList();
  if (typeof renderMobileBankingList === 'function') renderMobileBankingList();
}
window.updateAccountBalance = updateAccountBalance;


// Toast Notification System
function showSuccessToast(message) {
  const toast = document.createElement('div');
  toast.className = 'custom-toast success-toast shadow';
  toast.innerHTML = `<span>✅</span> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'custom-toast error-toast shadow';
  toast.innerHTML = `<span>❌</span> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
window.showSuccessToast = showSuccessToast;
window.showErrorToast = showErrorToast;

// FACTORY RESET: সম্পূর্ণ রিসেট - একদম শূন্য থেকে শুরু
// কোনো ডাটা, সেটিংস, একাউন্ট কিছুই থাকবে না
function handleResetAllData() {
  console.log("Wings Fly: Factory Reset triggered");

  if (!confirm('⚠️ চূড়ান্ত সতর্কতা: এটি সম্পূর্ণ সিস্টেম রিসেট করবে!\n\n- সকল ছাত্র-ছাত্রী\n- সকল লেনদেন\n- সকল ব্যাংক একাউন্ট\n- সকল সেটিংস\n- সকল ক্যাটাগরি\n- সকল কোর্স\n\nসবকিছ মুছে যাবে। নিশ্চিত?')) return;
  if (!confirm('⚠️ চূড়ান্ত নিশ্চিতকরণ: সবকিছু একদম শূন্য হয়ে যাবে। এই কাজ পূর্বাবস্থায় ফেরানো যাবে না। এগিয়ে যাবেন?')) return;

  try {
    // সম্পূর্ণ রিসেট - কোনো default ডাটা নেই
    globalData = {
      students: [],
      employees: [],
      finance: [],
      settings: {
        startBalances: {},
        academyName: 'Wings Fly Aviation Academy'
      },
      incomeCategories: [],      // খালি - কোনো default নেই
      expenseCategories: [],     // খালি - কোনো default নেই
      paymentMethods: [],        // খালি - কোনো default নেই
      cashBalance: 0,
      bankAccounts: [],          // খালি - কোনো default একাউন্ট নেই
      mobileBanking: [],         // খালি - কোনো default একাউন্ট নেই
      courseNames: [],           // খালি - কোনো default কোর্স নেই
      attendance: {},
      nextId: 1001,
      users: [],
      examRegistrations: [],
      visitors: [],
      employeeRoles: [],         // খালি - কোনো default role নেই
      credentials: { username: 'admin', password: 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c' }  // default — change via Settings
    };

    // Update window reference
    window.globalData = globalData;

    // localStorage এ সংরক্ষণ — skipCloudSync=true, তারপর explicit 'factory-reset' reason দিয়ে push
    saveToStorage(true);
    // ✅ V33 FIX: 'factory-reset' keyword দিয়ে push — data loss protection bypass হবে
    setTimeout(() => {
      if (typeof window.wingsSync?.pushNow === 'function') window.wingsSync.pushNow('factory-reset');
      else if (typeof window.saveToCloud === 'function') window.saveToCloud();
    }, 800);
    console.log("✅ Factory reset complete - all data cleared");

    alert('✅ সফল: সম্পূর্ণ সিস্টেম রিসেট হয়েছে।\n\nসবকিছু একদম নতুন অবস্থায় ফিরে গেছে।');
    window.location.reload();
  } catch (err) {
    alert('ত্রুটি: ' + err.message);
    console.error(err);
  }
}


// Global exposure
window.handleResetAllData = handleResetAllData;
if (typeof checkPersonBalance === 'function') window.checkPersonBalance = checkPersonBalance;
// handleSettingsSubmit exposed in sections/accounts-ui.js
// ===================================
// CHART JS ANALYTICS
// ===================================

let financeChartInstance = null;
let courseChartInstance = null;


// charts — extracted to sections/charts.js

// ===================================

async function saveToStorage(skipCloudSync = false) {
  try {
    // Arrays নিশ্চিত করো
    // ✅ FIX: deletedItems array + category properties দুটোই support
    (function() {
      const di = window.globalData.deletedItems;
      if (!di) {
        const arr=[]; arr.students=[]; arr.finance=[]; arr.employees=[]; arr.other=[];
        window.globalData.deletedItems = arr;
      } else if (!Array.isArray(di)) {
        const flat=[...(di.students||[]),...(di.finance||[]),...(di.employees||[]),...(di.other||[])];
        flat.students=di.students||[]; flat.finance=di.finance||[]; flat.employees=di.employees||[]; flat.other=di.other||[];
        window.globalData.deletedItems = flat;
      } else {
        if(!Array.isArray(di.students)) di.students=[];
        if(!Array.isArray(di.finance)) di.finance=[];
        if(!Array.isArray(di.employees)) di.employees=[];
        if(!Array.isArray(di.other)) di.other=[];
      }
    })();
    if (!window.globalData.activityHistory) window.globalData.activityHistory = [];

    // ✅ V34.9 FIX (PATCHED v2): Finance integrity check
    // Student delete করলে finance কমা স্বাভাবিক — সেটা block করা উচিত নয়।
    // শুধু unexpected/sudden drop block করো।
    const _saveFinCount = (window.globalData.finance || []).length;
    const _saveKnownFin = parseInt(localStorage.getItem('wings_last_known_finance')) || 0;
    // ✅ FIX: _intentionalDelete flag থাকলে block skip করো
    // ✅ FIX: threshold ২ → ১০ বাড়ানো (student delete এ ৫-১০ টা finance entry কমতে পারে)
    const _isIntentionalDelete = window._intentionalFinanceDelete === true;
    if (!_isIntentionalDelete && _saveKnownFin > 10 && _saveFinCount < _saveKnownFin - 10) {
      console.warn('🚫 saveToStorage BLOCKED — finance=' + _saveFinCount + ' < known=' + _saveKnownFin + ' (data loss prevention)');
      return false;
    }
    // ✅ FIX: সফল save এর আগে counter আপডেট করো — পরের save এ block হবে না
    localStorage.setItem('wings_last_known_finance', String(_saveFinCount));
    window._intentionalFinanceDelete = false; // flag reset

    // Backup রাখো যাতে cloud pull এ হারিয়ে না যায়
    localStorage.setItem('wingsfly_deleted_backup', JSON.stringify(window.globalData.deletedItems));
    localStorage.setItem('wingsfly_activity_backup', JSON.stringify(window.globalData.activityHistory));
    if (window.globalData.users && window.globalData.users.length > 0) {
      localStorage.setItem('wingsfly_users_backup', JSON.stringify(window.globalData.users));
    }

    const currentTime = Date.now().toString();
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    localStorage.setItem('lastLocalUpdate', currentTime);

    console.log('💾 Data saved locally.');

    // Trigger cloud push if available and not skipped
    if (!skipCloudSync && typeof window.saveToCloud === 'function') {
      console.log('☁️ Syncing to Cloud...');
      await window.saveToCloud();
    }
    return true;
  } catch (error) {
    console.error('❌ Storage Error:', error);
    return false;
  }
}

// renderFullUI defined once at the end in ensureCriticalExports — see below

// Toggle Auto-Sync
function toggleAutoSync(enabled) {
  if (enabled) {
    if (typeof window.startAutoSync === 'function') {
      window.startAutoSync(30); // 30 seconds interval
      showSuccessToast('✅ Auto-sync enabled (every 30s)');
    }
  } else {
    if (typeof window.stopAutoSync === 'function') {
      window.stopAutoSync();
      showSuccessToast('⏸️ Auto-sync disabled');
    }
  }
}

window.loadFromStorage = loadFromStorage; // ✅ FIX: was missing
window.toggleAutoSync = toggleAutoSync;


function loadFromStorage() {
  try {
    const savedData = localStorage.getItem('wingsfly_data');
    if (savedData) {
      window.globalData = JSON.parse(savedData);
      // Ensure local reference is valid
      if (typeof globalData !== 'undefined') globalData = window.globalData;

      if (!window.globalData.employees) window.globalData.employees = [];
      // ✅ FIX: deletedItems কে flat array + object properties দুটোই সাপোর্ট করো
      // student-management.js চায় .some() (array), recycle-bin চায় .students/.finance (object)
      (function normDeletedItems() {
        const di = window.globalData.deletedItems;
        if (!di) {
          // নেই — নতুন বানাও
          const arr = [];
          arr.students = []; arr.finance = []; arr.employees = []; arr.other = [];
          window.globalData.deletedItems = arr;
        } else if (!Array.isArray(di)) {
          // Object আছে — flat array তে convert করো, properties রাখো
          const flat = [
            ...(di.students  || []),
            ...(di.finance   || []),
            ...(di.employees || []),
            ...(di.other     || [])
          ];
          flat.students  = di.students  || [];
          flat.finance   = di.finance   || [];
          flat.employees = di.employees || [];
          flat.other     = di.other     || [];
          window.globalData.deletedItems = flat;
        } else {
          // Array আছে — object properties নিশ্চিত করো
          if (!di.students)  di.students  = [];
          if (!di.finance)   di.finance   = [];
          if (!di.employees) di.employees = [];
          if (!di.other)     di.other     = [];
        }
      })();
      if (!window.globalData.activityHistory) window.globalData.activityHistory = [];
      ensureStudentIds();

      if (!window.globalData.employees) window.globalData.employees = [];
      // ✅ FIX: removed duplicate ensureStudentIds() call

      // Ensure users array always exists with default admin
      if (!window.globalData.users || !Array.isArray(window.globalData.users) || window.globalData.users.length === 0) {
        window.globalData.users = [
          { username: 'admin', password: '0a041b9462caa4a31bac3567e0b6e6fd9100787db2ab433d96f6d178cabfce90', role: 'admin', name: 'Admin' }
        ];
        saveToStorage();
      }

      // ⚡ FORCE CLEANUP: Clean payment methods immediately
      const bankAccountNames = (window.globalData.bankAccounts || []).map(acc => acc.name);
      const mobileAccountNames = (window.globalData.mobileBanking || []).map(acc => acc.name); // ✅ FIX: was missing
      const coreMethods = ['Cash'];
      window.globalData.paymentMethods = [...new Set([...coreMethods, ...bankAccountNames, ...mobileAccountNames])];
      console.log('🧹 Force cleaned payment methods:', window.globalData.paymentMethods);

      console.log("💾 Local data loaded:", window.globalData.students.length, "students found.");
    } else {
      console.log("💾 No local data found. Initializing defaults.");
      window.globalData = {
        students: [],
        employees: [],
        finance: [],
        incomeCategories: ['Tuition Fees', 'Loan Received', 'Other'],
        expenseCategories: ['Salary', 'Rent', 'Utilities', 'Loan Given', 'Other'],
        paymentMethods: ['Cash'],
        cashBalance: 0,
        bankAccounts: [
          { sl: 1, name: 'CITY BANK', branch: 'BONOSREE', bankName: 'CITY BANK', accountNo: '1493888742001', balance: 0 },
          { sl: 2, name: 'Ferdous Ahmed Islami Bank', branch: 'NIKUNJA', bankName: 'ISLAMI BANK BANGLADESH LTD', accountNo: '20504100200546109', balance: 0 },
          { sl: 3, name: 'BRAC BANK LTD BANASREE', branch: 'BANASREE', bankName: 'BRAC BANK LTD BANASREE', accountNo: '2052189750001', balance: 0 },
          { sl: 4, name: 'ISLAMI BANK BANGLADESH LTD', branch: 'NIKUNJA', bankName: 'ISLAMI BANK BANGLADESH LTD', accountNo: '20504100100094207', balance: 0 },
          { sl: 5, name: 'DUTCH-BANGLA BANK LIMITED', branch: 'RAMPURA', bankName: 'DUTCH-BANGLA BANK LIMITED', accountNo: '1781100023959', balance: 0 },
          { sl: 6, name: 'EASTERN BANK LIMITED', branch: 'BANASREE', bankName: 'EASTERN BANK LIMITED', accountNo: '1091070200510', balance: 0 }
        ],
        courseNames: ['Caregiver', 'Student Visa', 'Other'],
        settings: { academyName: 'Wings Fly Aviation Academy' },
        users: [{ username: 'admin', password: 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c', role: 'admin', name: 'Super Admin' }]
      };
      if (typeof globalData !== 'undefined') globalData = window.globalData;
    }

    // BACKWARD COMPATIBILITY: Ensure users array exists
    if (!globalData.users) {
      globalData.users = [
        {
          username: (globalData.credentials && globalData.credentials.username) || 'admin',
          password: (globalData.credentials && globalData.credentials.password) || 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c',
          role: 'admin',
          name: 'Admin'
        }
      ];
    }

    // Data Migration for new version (Run always after load)
    let migrationNeeded = false;
    if (typeof globalData.nextId !== 'number' || !Number.isFinite(globalData.nextId) || globalData.nextId <= 0) {
      let maxId = 1000;
      (globalData.finance || []).forEach(f => {
        const n = Number(f.id);
        if (Number.isFinite(n) && n > maxId) maxId = n;
      });
      globalData.nextId = maxId + 1;
      migrationNeeded = true;
    }
    if (!globalData.incomeCategories) {
      globalData.incomeCategories = [...(globalData.categories || ['Tuition Fees', 'Other'])];
      migrationNeeded = true;
    }
    if (!globalData.expenseCategories) {
      globalData.expenseCategories = [...(globalData.categories || ['Salary', 'Rent', 'Other'])];
      migrationNeeded = true;
    }

    // Payment Method Migration: Ensure defaults exist if missing
    // This fixes the issue where only custom methods (Brac, Islami) were showing
    const defaultMethods = ['Cash'];
    if (!globalData.paymentMethods) {
      globalData.paymentMethods = [...defaultMethods];
      migrationNeeded = true;
    } else {
      // Merge defaults if they are completely missing (heuristic for lost defaults)
      const missingDefaults = defaultMethods.filter(m => !globalData.paymentMethods.includes(m));
      if (missingDefaults.length > 0) {
        // Prepend defaults to keep them at the top
        globalData.paymentMethods = [...defaultMethods, ...globalData.paymentMethods.filter(m => !defaultMethods.includes(m))];
        migrationNeeded = true;
      }
    }

    // Course Name Migration
    if (!globalData.courseNames) {
      globalData.courseNames = ['Caregiver', 'Student Visa', 'Visa (Tourist, Medical Business)', 'Air Ticketing (Basic)', 'Air Ticketing (Advance)', 'Travel Agency Business Managment', 'Language (Japanese, Korean)', 'Other'];
      migrationNeeded = true;
    }

    // Role Migration
    if (!globalData.employeeRoles) {
      globalData.employeeRoles = ['Instructor', 'Admin', 'Staff', 'Manager'];
      migrationNeeded = true;
    }

    if (!globalData.bankAccounts) {
      globalData.bankAccounts = [
        { sl: 1, name: 'CITY BANK', branch: 'BONOSREE', bankName: 'CITY BANK', accountNo: '1493888742001', balance: 0 },
        { sl: 2, name: 'Ferdous Ahmed Islami Bank', branch: 'NIKUNJA', bankName: 'ISLAMI BANK BANGLADESH LTD', accountNo: '20504100200546109', balance: 0 },
        { sl: 3, name: 'BRAC BANK LTD BANASREE', branch: 'BANASREE', bankName: 'BRAC BANK LTD BANASREE', accountNo: '2052189750001', balance: 0 },
        { sl: 4, name: 'ISLAMI BANK BANGLADESH LTD', branch: 'NIKUNJA', bankName: 'ISLAMI BANK BANGLADESH LTD', accountNo: '20504100100094207', balance: 0 },
        { sl: 5, name: 'DUTCH-BANGLA BANK LIMITED', branch: 'RAMPURA', bankName: 'DUTCH-BANGLA BANK LIMITED', accountNo: '1781100023959', balance: 0 },
        { sl: 6, name: 'EASTERN BANK LIMITED', branch: 'BANASREE', bankName: 'EASTERN BANK LIMITED', accountNo: '1091070200510', balance: 0 }
      ];
      migrationNeeded = true;
    }

    if (migrationNeeded) saveToStorage(true);

    // Ensure Monthly Target exists
    if (!globalData.settings.monthlyTarget) {
      globalData.settings.monthlyTarget = 200000;
      migrationNeeded = true;
    }

    // AUTO-RECALCULATE CASH BALANCE from transactions on load
    if (typeof recalculateCashBalanceFromTransactions === 'function') {
      recalculateCashBalanceFromTransactions();
    }

    // Ensure credentials exist
    if (!globalData.credentials) {
      globalData.credentials = { username: 'admin', password: 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c' };
      migrationNeeded = true;
    }

    // Migrate Exam Registrations if found in legacy storage
    if (!globalData.examRegistrations || globalData.examRegistrations.length === 0) {
      const legacyExams = localStorage.getItem('examRegistrations');
      if (legacyExams) {
        try {
          const parsed = JSON.parse(legacyExams);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalData.examRegistrations = parsed;
            migrationNeeded = true;
          }
        } catch (e) { }
      }
    }

    // Migrate Visitors if found in legacy storage
    if (!globalData.visitors || globalData.visitors.length === 0) {
      const legacyVisitors = localStorage.getItem('visitors');
      if (legacyVisitors) {
        try {
          const parsed = JSON.parse(legacyVisitors);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalData.visitors = parsed;
            migrationNeeded = true;
          }
        } catch (e) { }
      }
    }

    if (migrationNeeded) {
      saveToStorage(true);
      if (typeof populateDropdowns === 'function') populateDropdowns();
    }

    // CLEANUP: Remove duplicate payment methods after loading
    cleanupPaymentMethods();

    // ✅ CRITICAL FIX: Populate batch filter after loading data
    if (typeof populateBatchFilter === 'function') {
      setTimeout(() => {
        populateBatchFilter();
        console.log('✅ Batch filter populated after data load');
      }, 200);
    }
  } catch (error) {
    console.error('Error loading from storage:', error);
  }
}

// Cleanup duplicate payment methods
function cleanupPaymentMethods() {
  if (!globalData.bankAccounts) {
    globalData.bankAccounts = [];
  }

  const bankAccountNames = globalData.bankAccounts.map(acc => acc.name);
  const mobileAccountNames = (globalData.mobileBanking || []).map(acc => acc.name); // ✅ FIX: was missing
  const coreMethods = ['Cash'];

  // FORCE CLEAN: Only keep core methods and current bank + mobile account names
  const cleanMethods = [...new Set([...coreMethods, ...bankAccountNames, ...mobileAccountNames])];

  // Always update to clean list
  const oldCount = (globalData.paymentMethods || []).length;
  globalData.paymentMethods = cleanMethods;

  if (oldCount !== cleanMethods.length) {
    console.log('🧹 Payment Methods Cleaned:');
    console.log('  📊 Bank Accounts:', bankAccountNames.length);
    console.log('  💳 Before:', oldCount, 'methods');
    console.log('  💳 After:', cleanMethods.length, 'methods');
    console.log('  🗑️ Removed:', (oldCount - cleanMethods.length), 'duplicate(s)');
    saveToStorage(true);
  }

  // Force populate dropdowns with clean data
  if (typeof populateDropdowns === 'function') {
    populateDropdowns();
  }
}

// Manual reset function - can be called from browser console
window.resetPaymentMethods = function () {
  console.log('🔄 Manually resetting payment methods...');
  const bankAccountNames = (globalData.bankAccounts || []).map(acc => acc.name);
  const mobileAccountNames = (globalData.mobileBanking || []).map(acc => acc.name); // ✅ FIX: was missing
  const coreMethods = ['Cash'];
  const oldCount = (globalData.paymentMethods || []).length;
  globalData.paymentMethods = [...new Set([...coreMethods, ...bankAccountNames, ...mobileAccountNames])];
  saveToStorage(true);
  populateDropdowns();
  console.log('✅ Payment methods reset!');
  console.log('  📊 Bank Accounts:', bankAccountNames.length);
  console.log('  💳 Old:', oldCount, 'methods');
  console.log('  💳 New:', globalData.paymentMethods.length, 'methods');
  console.log('  🗑️ Removed:', (oldCount - globalData.paymentMethods.length), 'duplicates');
  alert(`✅ Payment Methods Reset!\n\n` +
    `Bank Accounts: ${bankAccountNames.length}\n` +
    `Payment Methods: ${globalData.paymentMethods.length}\n` +
    `Duplicates Removed: ${oldCount - globalData.paymentMethods.length}`);
};

// ===================================
// LOGIN & AUTHENTICATION
// ===================================

// SHA-256 Password Hashing (Browser Native — no library needed)

// auth — extracted to sections/auth.js


// dashboard-stats.js — extracted to sections/dashboard-stats.js

// ===================================


// data-export — extracted to sections/data-export.js

function renderRecentAdmissions(filterStr = '') {
  const tbody = document.getElementById('recentAdmissionsBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Get last 8 students enrolled
  let students = [...globalData.students].sort((a, b) => (b.enrollDate || '').localeCompare(a.enrollDate || '')).slice(0, 8);

  if (filterStr) {
    const q = filterStr.toLowerCase();
    students = students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.course && s.course.toLowerCase().includes(q)) ||
      (s.batch && s.batch.toLowerCase().includes(q))
    );
  }

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No recent admissions found</td></tr>';
    return;
  }

  students.forEach(s => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openStudentProfile(s.rowIndex);
    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 32px; height: 32px; font-size: 0.75rem;">
            ${(s.name || 'S').charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="fw-bold" style="color:#ffd54f;">${s.name}</div>
            <div class="small text-muted">${s.studentId || 'No ID'}</div>
          </div>
        </div>
      </td>
      <td class="small fw-semibold">${s.course || '-'}</td>
      <td class="small text-muted">${s.enrollDate || '-'}</td>
      <td class="small"><span class="badge bg-light text-dark border">${s.batch || '-'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function addEmployeeRole() {
  const inp = document.getElementById('newEmployeeRoleInput');
  const val = inp.value.trim();
  if (val) {
    if (!globalData.employeeRoles) globalData.employeeRoles = [];
    globalData.employeeRoles.push(val);
    inp.value = '';
    saveToStorage();
    if (typeof renderSettingsLists === 'function') renderSettingsLists(); // ✅ FIX: was renderSettings() — function doesn't exist
    if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
    showSuccessToast('Role added');
  }
}

function deleteEmployeeRole(index) {
  if (confirm('Delete this role?')) {
    globalData.employeeRoles.splice(index, 1);
    saveToStorage();
    if (typeof renderSettingsLists === 'function') renderSettingsLists(); // ✅ FIX: was renderSettings()
    if (typeof window.refreshAllDropdowns === 'function') window.refreshAllDropdowns();
  }
}

function filterRecentAdmissions(query) {
  renderRecentAdmissions(query);
}

window.filterRecentAdmissions = filterRecentAdmissions;
window.renderRecentAdmissions = renderRecentAdmissions;

// ===================================
// ===================================
// EMPLOYEE MANAGEMENT
// Moved to: sections/employee-management.js
// ===================================

// ===================================
// NOTIFICATION CENTER
// ===================================


// notifications — extracted to sections/notifications.js

// Settings, Categories, Accounts সব থাকবে
function handleDataReset() {
  console.log("Wings Fly: Data Reset triggered");

  if (!confirm('⚠️ সতর্কতা: এটি সকল ছাত্র-ছাত্রী, কর্মচারী এবং লেনদেনের তথ্য মুছে দেবে।\n\nআপনার সেটিংস (ক্যাটাগরি, কোর্স, ব্যাংক একাউন্ট) সংরক্ষিত থাকবে।\n\nঅবশ্যই এগিয়ে যেতে চান?')) return;
  if (!confirm('⚠️ চূড়ান্ত সতর্কতা: সকল ডাটা মুছে যাবে। এগিয়ে যাবেন?')) return;

  try {
    // বর্তমান সেটিংস সংরক্ষণ
    const preservedSettings = {
      settings: window.globalData.settings || { startBalances: {}, academyName: 'Wings Fly Aviation Academy' },
      incomeCategories: window.globalData.incomeCategories || [],
      expenseCategories: window.globalData.expenseCategories || [],
      paymentMethods: window.globalData.paymentMethods || [],
      bankAccounts: window.globalData.bankAccounts || [],
      mobileBanking: window.globalData.mobileBanking || [],
      courseNames: window.globalData.courseNames || [],
      employeeRoles: window.globalData.employeeRoles || [],
      credentials: window.globalData.credentials || { username: 'admin', password: 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c' },
      users: window.globalData.users || []
    };

    // শুধুমাত্র ডাটা রিসেট, সেটিংস রাখা
    window.globalData = {
      ...preservedSettings,
      students: [],
      employees: [],
      finance: [],
      cashBalance: 0,
      attendance: {},
      nextId: 1001,
      examRegistrations: [],
      visitors: []
    };

    // সকল একাউন্টের ব্যালেন্স ০ করা কিন্তু একাউন্ট রাখা
    if (window.globalData.bankAccounts && Array.isArray(window.globalData.bankAccounts)) {
      window.globalData.bankAccounts.forEach(acc => acc.balance = 0);
    }
    if (window.globalData.mobileBanking && Array.isArray(window.globalData.mobileBanking)) {
      window.globalData.mobileBanking.forEach(acc => acc.balance = 0);
    }

    // Update globalData reference
    globalData = window.globalData;

    saveToStorage(true);
    // ✅ V33 FIX: 'factory-reset' keyword দিয়ে push — data loss protection সঠিকভাবে কাজ করবে
    setTimeout(() => {
      if (typeof window.wingsSync?.pushNow === 'function') window.wingsSync.pushNow('factory-reset-settings-preserved');
      else if (typeof window.saveToCloud === 'function') window.saveToCloud();
    }, 800);
    console.log("✅ Data reset complete, settings preserved");
    alert('✅ সফল: সকল ছাত্র-ছাত্রী এবং আর্থিক তথ্য মুছে ফেলা হয়েছে।\n\nআপনার সেটিংস সংরক্ষিত আছে।');
    window.location.reload();
  } catch (err) {
    alert('ত্রুটি: ' + err.message);
    console.error(err);
  }
}


// Expose to global
window.handleDataReset = handleDataReset;

// RECALCULATE CASH BALANCE FROM TRANSACTIONS
// Uses finance-engine.js canonical type lists
function recalculateCashBalanceFromTransactions() {
  // If finance-engine is loaded, use full rebuild (handles all accounts)
  if (typeof window.feRebuildAllBalances === 'function') {
    window.feRebuildAllBalances();
    return parseFloat(globalData.cashBalance) || 0;
  }

  // ── Fallback ──
  let calculatedCashBalance = 0;

  // Start from opening balance
  if (globalData.settings && globalData.settings.startBalances && globalData.settings.startBalances['Cash']) {
    calculatedCashBalance = parseFloat(globalData.settings.startBalances['Cash']) || 0;
  }

  // Canonical lists — must match finance-engine.js
  const ACCOUNT_IN = ['Income', 'Loan Received', 'Loan Receiving', 'Transfer In', 'Registration', 'Refund', 'Advance', 'Investment'];
  const ACCOUNT_OUT = ['Expense', 'Loan Given', 'Loan Giving', 'Transfer Out', 'Salary', 'Rent', 'Utilities', 'Advance Return', 'Investment Return'];

  const cashTransactions = (globalData.finance || []).filter(f => f.method === 'Cash' && !f._deleted);

  cashTransactions.forEach(trans => {
    const amount = parseFloat(trans.amount) || 0;
    if (ACCOUNT_IN.includes(trans.type)) calculatedCashBalance += amount;
    else if (ACCOUNT_OUT.includes(trans.type)) calculatedCashBalance -= amount;
  });

  globalData.cashBalance = calculatedCashBalance;

  saveToStorage(true); // ✅ V33 FIX: skipCloudSync=true — V33 debounce এ route হবে
  if (typeof renderCashBalance === 'function') renderCashBalance();

  console.log('💰 Cash balance recalculated:', calculatedCashBalance);
  return calculatedCashBalance;
}

// Expose to global
window.recalculateCashBalanceFromTransactions = recalculateCashBalanceFromTransactions;

// Expose togglePersonField globally (safe guard)
if (typeof togglePersonField === 'function') {
  window.togglePersonField = togglePersonField;
}

// account-search — extracted to sections/account-search.js



// ===================================
// CRITICAL GLOBAL EXPOSURES
// Required by sections and sync system
// ===================================
window.renderLedger = renderLedger;
// ✅ FIX: finance-engine.js এর canonical updateGlobalStats preserve করো
// শুধু তখনই set করো যদি finance-engine এখনো define না করে থাকে
if (typeof window.updateGlobalStats !== 'function') {
  window.updateGlobalStats = updateGlobalStats;
} else {
  // finance-engine এর wrapped version ব্যবহার করো — overwrite করো না
  console.log('✅ app.js: updateGlobalStats already set by finance-engine, keeping it');
}
window.checkDailyBackup = checkDailyBackup;
// window.updateStudentCount → sections/student-management.js
// window.filterData → sections/student-management.js
// handleEmployeeSubmit → exposed in sections/employee-management.js

// ✅ FIX: renderFullUI defined once only — in ensureCriticalExports below
// Auto-populate dropdown when data loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(populateDropdowns, 300);           // PERFORMANCE FIX: 1000ms → 300ms
    setTimeout(attachMethodBalanceListeners, 400); // PERFORMANCE FIX: 1200ms → 400ms
  });
} else {
  setTimeout(populateDropdowns, 300);             // PERFORMANCE FIX: 1000ms → 300ms
  setTimeout(attachMethodBalanceListeners, 400);  // PERFORMANCE FIX: 1200ms → 400ms
}

// ===================================
// PAYMENT METHOD BALANCE DISPLAY
// ===================================

function getMethodBalance(methodName) {
  if (!methodName) return null;
  if (methodName === 'Cash') {
    return { balance: parseFloat(globalData.cashBalance) || 0, type: 'cash' };
  }
  const bank = (globalData.bankAccounts || []).find(a => a.name === methodName);
  if (bank) return { balance: parseFloat(bank.balance) || 0, type: 'bank', extra: bank.bankName };
  const mobile = (globalData.mobileBanking || []).find(a => a.name === methodName);
  if (mobile) return { balance: parseFloat(mobile.balance) || 0, type: 'mobile' };
  return null;
}

function showMethodBalance(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const badgeId = `${selectId}_balanceBadge`;
  let badge = document.getElementById(badgeId);

  const val = sel.value;
  const info = getMethodBalance(val);

  if (!info) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.id = badgeId;
    badge.style.cssText = `
      margin-top: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    `;
    sel.parentNode.appendChild(badge);
  }

  const colorMap = { cash: '#00ff88', bank: '#00d9ff', mobile: '#ff2d95' };
  const bgMap = { cash: 'rgba(0,255,136,0.12)', bank: 'rgba(0,217,255,0.12)', mobile: 'rgba(255,45,149,0.12)' };
  const iconMap = { cash: '💵', bank: '🏦', mobile: '📱' };
  const borderMap = { cash: 'rgba(0,255,136,0.35)', bank: 'rgba(0,217,255,0.35)', mobile: 'rgba(255,45,149,0.35)' };

  const c = info.type;
  badge.style.background = bgMap[c];
  badge.style.border = `1px solid ${borderMap[c]}`;
  badge.style.color = colorMap[c];
  badge.innerHTML = `
    <span>${iconMap[c]}</span>
    <span>Available Balance:</span>
    <span style="font-size:0.95rem; letter-spacing:0.3px;">৳${formatNumber(info.balance)}</span>
  `;
}

function attachMethodBalanceListeners() {
  const targets = [
    'studentMethodSelect',
    'financeMethodSelect',
    'editTransMethodSelect',
    'examPaymentMethodSelect',
    'accTransferFrom',
    'accTransferTo',
    'salMethod',
    'salEditMethod'
  ];
  targets.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      // Remove duplicate listeners by replacing with clone
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      newEl.addEventListener('change', () => showMethodBalance(id));
      // Show immediately if there is a value
      setTimeout(() => { if (newEl.value) showMethodBalance(id); }, 50);
    }
  });
}

window.showMethodBalance = showMethodBalance;
window.attachMethodBalanceListeners = attachMethodBalanceListeners;


// ===================================
// KEEP RECORD — Personal Notes System
// ===================================


// keep-records — extracted to sections/keep-records.js

// ===================================
// GLOBAL DATE "TO" AUTO-FILLER
// ===================================
(function() {
  // Automatically fill "To Date" inputs with today's date if they are empty
  function enforceToDateDefaults() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    
    for (let i = 0; i < dateInputs.length; i++) {
      const inp = dateInputs[i];
      const id = (inp.id || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      const labelValue = (inp.previousElementSibling?.innerText || '').trim().toLowerCase();
      
      // Check if it's a "To" date field (End date, To date, etc.)
      const isToDate = id.includes('to') || id.includes('end') || 
                       name.includes('to') || name.includes('end') ||
                       labelValue === 'to' || labelValue.includes('to date');
      
      if (isToDate && !inp.value) {
        inp.value = today;
      }
    }
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceToDateDefaults);
  } else {
    enforceToDateDefaults();
  }

  // PERFORMANCE FIX: setInterval(500) removed — was scanning DOM every 0.5s wasting CPU.
  // MutationObserver replaces it — only fires when new elements are actually added.
  if (typeof MutationObserver !== 'undefined') {
    const _dateObserver = new MutationObserver(function(mutations) {
      let hasNewInput = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) { hasNewInput = true; break; }
        }
        if (hasNewInput) break;
      }
      if (hasNewInput) enforceToDateDefaults();
    });
    _dateObserver.observe(document.body, { childList: true, subtree: true });
  }
})();

// ===================================
(function ensureCriticalExports() {
  if (typeof handleStudentSubmit === 'function') { window.saveStudent = handleStudentSubmit; window.handleStudentSubmit = handleStudentSubmit; }
  if (typeof render === 'function') { window.renderStudents = render; window.render = render; }
  if (typeof exportData === 'function') window.exportData = exportData;
  if (typeof importData === 'function') window.importData = importData;
  if (typeof handleImportFile === 'function') window.handleImportFile = handleImportFile;
  if (typeof renderLedger === 'function') window.renderLedger = renderLedger;
  if (typeof filterData === 'function') window.filterData = filterData;
  if (typeof openAccountModal === 'function') window.openAccountModal = openAccountModal;
  if (typeof renderAccountList === 'function') window.renderAccountList = renderAccountList;
  if (typeof renderDashboard === 'function') window.renderDashboard = renderDashboard;
  // ✅ FIX: finance-engine এর wrapped version overwrite করো না
  if (typeof updateGlobalStats === 'function' && typeof window.FE_STAT_INCOME === 'undefined') {
    window.updateGlobalStats = updateGlobalStats;
  }
  if (typeof recalculateCashBalanceFromTransactions === 'function') window.recalculateCashBalanceFromTransactions = recalculateCashBalanceFromTransactions;
  if (typeof renderKeepRecordNotes === 'function') window.renderKeepRecordNotes = renderKeepRecordNotes;

  window.renderFullUI = function () {
    // ✅ V34.9 FIX (PATCHED v2): finance incomplete থাকলে UI refresh skip
    // _intentionalDelete flag থাকলে skip করবে না (student delete এর পর UI refresh দরকার)
    const _rfFinCount = (window.globalData?.finance || []).length;
    const _rfKnownFin = parseInt(localStorage.getItem('wings_last_known_finance')) || 0;
    const _rfIntentional = window._intentionalFinanceDelete === true;
    if (!_rfIntentional && _rfKnownFin > 10 && _rfFinCount < _rfKnownFin - 10) {
      console.warn('⏸️ renderFullUI SKIPPED — finance=' + _rfFinCount + ' < known=' + _rfKnownFin + ' (waiting for reload)');
      return;
    }
    console.log('🔄 Global UI Refresh');
    try {
      if (typeof updateGlobalStats === 'function') updateGlobalStats();
      if (typeof render === 'function') render(window.globalData.students || []);
      if (typeof renderLedger === 'function') renderLedger(window.globalData.finance || []);
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderCashBalance === 'function') renderCashBalance();
      if (typeof renderRecentAdmissions === 'function') renderRecentAdmissions();
      if (typeof updateGrandTotal === 'function') updateGrandTotal();
      if (typeof populateDropdowns === 'function') populateDropdowns();
      if (typeof populateBatchFilter === 'function') populateBatchFilter();
      if (typeof initNoticeBoard === 'function') initNoticeBoard();
    } catch (e) { console.warn('renderFullUI partial error:', e); }
  };
  // ✅ SYNC ALIAS SAFETY NET
  // supabase-sync script load হওয়ার পরে window.wingsSync define হয়।
  // auto-test CRITICAL list-এ saveToCloud/loadFromCloud/manualCloudSync আছে।
  // এই poller wingsSync ready হওয়ার সাথে সাথে aliases গ্যারান্টি করে।
  (function _syncAliasPoller(attempt) {
    // ইতোমধ্যে সব আছে — কিছু করার নেই
    if (typeof window.saveToCloud === 'function' &&
        typeof window.loadFromCloud === 'function' &&
        typeof window.manualCloudSync === 'function') return;

    if (window.wingsSync) {
      // wingsSync ready — সঠিক aliases তৈরি করো
      if (typeof window.saveToCloud !== 'function')
        window.saveToCloud = () => window.wingsSync.pushNow('saveToCloud');
      if (typeof window.loadFromCloud !== 'function')
        window.loadFromCloud = (force) => window.wingsSync.pullNow();
      if (typeof window.manualCloudSync !== 'function')
        window.manualCloudSync = () => window.wingsSync.smartSync ? window.wingsSync.smartSync() : window.wingsSync.fullSync();
      console.log('✅ Sync aliases ready (attempt ' + attempt + ')');
    } else if (attempt < 30) {
      // প্রতি 2s পর retry — মোট 60s
      setTimeout(() => _syncAliasPoller(attempt + 1), 2000);
    } else {
      // 60s পরেও wingsSync নেই — sync script load হয়নি বা crash করেছে
      // Fallback stubs দাও যাতে app সম্পূর্ণ ভেঙে না পড়ে
      console.error('❌ wingsSync 60s পরেও ready হয়নি — sync script check করুন');
      if (typeof window.saveToCloud !== 'function')
        window.saveToCloud = () => console.error('saveToCloud: sync script not loaded');
      if (typeof window.loadFromCloud !== 'function')
        window.loadFromCloud = () => console.error('loadFromCloud: sync script not loaded');
      if (typeof window.manualCloudSync !== 'function')
        window.manualCloudSync = () => console.error('manualCloudSync: sync script not loaded');
    }
  })(0);

  console.log('✅ Safety net applied — Wings Fly Academy');
})();
