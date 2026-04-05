/**
 * ================================================================
 * ✈️ WINGS FLY AVIATION ACADEMY — MAIN BRANCH
 * DEPLOY CHANGE TRACKER — v2.0
 * ================================================================
 * কীভাবে কাজ করে:
 *   1. প্রতিটা page load-এ একটা SNAPSHOT নেয় (functions, scripts, DOM)
 *   2. আগের snapshot-এর সাথে তুলনা করে কী কী বদলেছে খুঁজে বের করে
 *   3. কোনো function হারিয়ে গেলে বা নতুন script যোগ/বাদ হলে সাথে সাথে notify করে
 *
 * ব্যবহার:
 *   index.html-এ সব section JS লোড হওয়ার পরে এটা যোগ করুন।
 *   Console-এ: WFTracker.showReport() — ম্যানুয়ালি report দেখুন
 *   Console-এ: WFTracker.reset()     — reset করে fresh start করুন
 * ================================================================
 */

(function () {
  'use strict';

  const TRACKER_VERSION = '2.1-MAIN';
  const STORAGE_KEY     = 'wf_main_deploy_snapshot';
  const HISTORY_KEY     = 'wf_main_deploy_history';
  const MAX_HISTORY     = 15;

  // ================================================================
  // ✅ MAIN BRANCH — সব গুরুত্বপূর্ণ functions-এর তালিকা
  //    নতুন function যোগ হলে এখানে add করুন
  // ================================================================
  const CRITICAL_FUNCTIONS = [
    // --- Auth & Navigation ---
    'handleLogin', 'logout', 'switchTab', 'openSettingsModal',

    // --- Student Management ---
    'openStudentModal', 'openEditStudentModal', 'saveStudent',
    'renderStudents', 'deleteStudent', 'filterStudents',
    'openStudentProfile', 'generateStudentId',

    // --- Finance / Ledger ---
    'openAddTransaction', 'saveFinance', 'renderFinance',
    'filterData', 'downloadLedgerExcel', 'mailLedgerReport',
    'printReport', 'updateFinanceCategoryOptions',

    // --- Accounts ---
    'renderAccountsSummary', 'openCashModal', 'openBankModal',
    'openMobileBankModal', 'openInternalTransferModal',
    'saveAccountTransaction', 'searchAccounts',

    // --- Loans ---
    'searchLoanPerson', 'openNewLoanModal', 'saveLoanTransaction',
    'renderLoanLedger',

    // --- Visitors ---
    'openVisitorModal', 'saveVisitor', 'renderVisitors',
    'deleteVisitor', 'filterVisitors',

    // --- Employees / HR ---
    'openEmployeeModal', 'saveEmployee', 'renderEmployees',
    'deleteEmployee', 'filterEmployees',

    // --- Salary ---
    'openSalaryModal', 'saveSalary', 'renderSalaryTable',
    'openSalaryHub', 'generateSalarySlip',

    // --- Exam ---
    'openExamRegistration', 'saveExamResult', 'filterExamResults',
    'printExamResults', 'exportExamResultsExcel', 'clearExamFilters',

    // --- Attendance ---
    'openAttendanceModal',

    // --- ID Cards & Certificates ---
    'generateIdCard', 'printIdCard', 'generateCertificate',

    // --- Notice Board ---
    'openNoticeModal', 'saveNotice',

    // --- Cloud Sync ---
    'loadFromCloud', 'saveToCloud', 'toggleAutoSync',

    // --- Dashboard ---
    'updateDashboard', 'calcBatchProfit', 'filterRecentAdmissions',

    // --- Utilities ---
    'showToast', 'showErrorToast', 'formatNumber', 'formatCurrency',
    'saveToStorage', 'loadFromStorage', 'syncSearchInputs',
    'handleGlobalSearch',
  ];

  // ================================================================
  // গুরুত্বপূর্ণ DOM elements যেগুলো থাকা দরকার
  // ================================================================
  const CRITICAL_DOM_IDS = [
    // Sections
    'loginSection', 'dashboardSection', 'dashboardOverview',
    'studentSection', 'ledgerSection', 'accountsSection',
    'loanSection', 'visitorSection', 'employeeSection',
    'examResultsSection', 'salarySection',
    // Tables
    'tableBody', 'financeTableBody', 'examResultsTableBody',
    'visitorTableBody', 'employeeTableBody',
    // Modals
    'studentModal', 'financeModal',
    // Key UI
    'searchInput', 'tabDashboard', 'tabStudents', 'tabLedger',
  ];

  // ================================================================
  // গুরুত্বপূর্ণ JS files যেগুলো লোড হওয়া দরকার
  // ================================================================
  const CRITICAL_SCRIPTS = [
    'student-management.js',
    'finance-crud.js',
    'finance-helpers.js',
    'finance-engine.js',
    'ledger-render.js',
    'accounts-management.js',
    'accounts-ui.js',
    'loan-management.js',
    'visitor-management.js',
    'employee-management.js',
    'salary-management.js',
    'dashboard-stats.js',
    'auth.js',
    'app.js',
    'section-loader.js',
    'inline-scripts.js',
  ];

  // ─── Snapshot তৈরি ────────────────────────────────────────────
  function captureSnapshot() {
    return {
      timestamp:       new Date().toISOString(),
      url:             window.location.href,
      title:           document.title,
      scripts:         getLoadedScripts(),
      styles:          getLoadedStyles(),
      functions:       checkFunctions(),
      domIds:          checkDomIds(),
      localStorageKeys: getLocalStorageKeys(),
      globalData:      getGlobalDataSummary(),
    };
  }

  function getLoadedScripts() {
    return Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.src.split('?')[0]);  // version query বাদ দাও
  }

  function getLoadedStyles() {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.href.split('?')[0]);
  }

  function checkFunctions() {
    const result = {};
    CRITICAL_FUNCTIONS.forEach(fn => {
      result[fn] = typeof window[fn] === 'function';
    });
    return result;
  }

  function checkDomIds() {
    const result = {};
    CRITICAL_DOM_IDS.forEach(id => {
      result[id] = !!document.getElementById(id);
    });
    return result;
  }

  function getLocalStorageKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      keys.push({ key, size: val ? val.length : 0 });
    }
    return keys;
  }

  function getGlobalDataSummary() {
    try {
      const gd = window.globalData;
      if (!gd) return { exists: false };
      return {
        exists: true,
        students: (gd.students || []).length,
        finance: (gd.finance || []).length,
        visitors: (gd.visitors || []).length,
        employees: (gd.employees || []).length,
        exams: (gd.exams || []).length,
      };
    } catch (e) {
      return { exists: false, error: e.message };
    }
  }

  // ─── Snapshot তুলনা ───────────────────────────────────────────
  function compareSnapshots(oldSnap, newSnap) {
    const changes = [];

    // 1. Functions হারিয়ে গেছে বা ফিরে এসেছে?
    const oldFns = oldSnap.functions || {};
    const newFns = newSnap.functions || {};

    CRITICAL_FUNCTIONS.forEach(fn => {
      const wasPresent = oldFns[fn] === true;
      const nowPresent = newFns[fn] === true;

      if (wasPresent && !nowPresent) {
        changes.push({
          type: 'function_missing',
          icon: '⚠️',
          severity: 'danger',
          title: `Function নষ্ট: ${fn}()`,
          detail: 'আগে কাজ করত, এখন undefined',
          reason: `এই function-এর সাথে সংযুক্ত button/feature এখন কাজ করবে না। সম্ভবত: (১) যে JS file-এ এটা আছে সেটা লোড হয়নি, (২) function rename হয়েছে, বা (৩) নতুন কোড error করে script থামিয়ে দিয়েছে।`,
        });
      } else if (!wasPresent && nowPresent) {
        changes.push({
          type: 'function_restored',
          icon: '✅',
          severity: 'success',
          title: `Function ফিরে এসেছে: ${fn}()`,
          detail: 'আগে ছিল না, এখন কাজ করছে',
          reason: 'সংশ্লিষ্ট JS file এখন সঠিকভাবে লোড হচ্ছে।',
        });
      }
    });

    // 2. DOM Elements হারিয়ে গেছে?
    const oldDom = oldSnap.domIds || {};
    const newDom = newSnap.domIds || {};

    CRITICAL_DOM_IDS.forEach(id => {
      if (oldDom[id] === true && newDom[id] === false) {
        changes.push({
          type: 'dom_missing',
          icon: '🏗️',
          severity: 'danger',
          title: `DOM Element নষ্ট: #${id}`,
          detail: 'আগে পাওয়া যেত, এখন নেই',
          reason: `index.html-এ এই id="${id}" element সরানো বা rename হয়েছে। এর উপর নির্ভরশীল features কাজ করবে না।`,
        });
      } else if (oldDom[id] === false && newDom[id] === true) {
        changes.push({
          type: 'dom_restored',
          icon: '✅',
          severity: 'success',
          title: `DOM Element ফিরে এসেছে: #${id}`,
          detail: 'আগে ছিল না, এখন পাওয়া গেছে',
          reason: 'element-টি ঠিকমতো DOM-এ append/load হয়েছে।',
        });
      }
    });

    // 3. Critical JS Files বাদ পড়েছে?
    const oldScripts = oldSnap.scripts || [];
    const newScripts = newSnap.scripts || [];

    CRITICAL_SCRIPTS.forEach(scriptName => {
      const wasLoaded = oldScripts.some(s => s.includes(scriptName));
      const nowLoaded = newScripts.some(s => s.includes(scriptName));
      if (wasLoaded && !nowLoaded) {
        changes.push({
          type: 'script_removed',
          icon: '📄',
          severity: 'danger',
          title: `JS File লোড হচ্ছে না: ${scriptName}`,
          detail: 'আগে লোড হত, এখন হচ্ছে না',
          reason: `index.html-এ <script src="...${scriptName}"> tag সরানো হয়েছে বা file delete হয়েছে। এই file-এর সব functions কাজ করবে না।`,
        });
      }
    });

    // নতুন script যোগ হয়েছে?
    newScripts.forEach(src => {
      const name = src.split('/').pop();
      if (!oldScripts.some(s => s.includes(name)) && !src.includes('cdn')) {
        changes.push({
          type: 'script_added',
          icon: '➕',
          severity: 'info',
          title: `নতুন JS যোগ: ${name}`,
          detail: src.split('/').slice(-2).join('/'),
          reason: 'নতুন script লোড হচ্ছে — অন্য scripts-এর সাথে conflict হচ্ছে কিনা দেখুন।',
        });
      }
    });

    // 4. CSS বাদ পড়েছে?
    const oldStyles = oldSnap.styles || [];
    const newStyles = newSnap.styles || [];

    oldStyles.forEach(href => {
      const name = href.split('/').pop();
      if (!newStyles.some(s => s.includes(name)) && !href.includes('cdn')) {
        changes.push({
          type: 'style_removed',
          icon: '🎨',
          severity: 'warning',
          title: `CSS বাদ পড়েছে: ${name}`,
          detail: href.split('/').slice(-2).join('/'),
          reason: 'কিছু UI element ভেঙে যেতে পারে।',
        });
      }
    });

    // 5. LocalStorage data মুছে গেছে?
    const oldKeys = new Set((oldSnap.localStorageKeys || []).map(k => k.key));
    const newKeys = new Set((newSnap.localStorageKeys || []).map(k => k.key));
    const removedKeys = [...oldKeys].filter(k => !newKeys.has(k));

    removedKeys.forEach(key => {
      // wf_egress_ keys are temporary and cleaned up daily — ignore them
      if ((key.startsWith('wingsfly') || key.startsWith('wf_')) && !key.startsWith('wf_egress_')) {
        changes.push({
          type: 'storage_lost',
          icon: '🗄️',
          severity: 'danger',
          title: `Data মুছে গেছে: ${key}`,
          detail: 'LocalStorage-এ আগে ছিল, এখন নেই',
          reason: 'কোনো code localStorage.clear() বা removeItem() call করেছে। Data হারিয়ে যেতে পারে।',
        });
      }
    });

    // 6. globalData হারিয়ে গেছে?
    const oldGD = oldSnap.globalData || {};
    const newGD = newSnap.globalData || {};

    if (oldGD.exists && !newGD.exists) {
      changes.push({
        type: 'global_data_lost',
        icon: '💾',
        severity: 'danger',
        title: 'globalData object নেই!',
        detail: 'আগে পাওয়া যেত, এখন undefined',
        reason: 'app.js বা data initialization script লোড হয়নি। পুরো app কাজ করবে না।',
      });
    }

    // 7. Data count হঠাৎ কমে গেছে?
    if (oldGD.exists && newGD.exists) {
      const dataChecks = [
        { key: 'students', label: 'Students' },
        { key: 'finance', label: 'Finance records' },
        { key: 'visitors', label: 'Visitors' },
      ];
      dataChecks.forEach(({ key, label }) => {
        const oldCount = oldGD[key] || 0;
        const newCount = newGD[key] || 0;
        if (oldCount > 0 && newCount === 0) {
          changes.push({
            type: 'data_lost',
            icon: '📉',
            severity: 'danger',
            title: `${label} data শূন্য হয়ে গেছে!`,
            detail: `আগে ${oldCount} টা ছিল, এখন ০`,
            reason: 'Data load হয়নি বা কোনো code data মুছে দিয়েছে। Cloud থেকে pull করুন।',
          });
        }
      });
    }

    return changes;
  }

  // ─── Notification UI ──────────────────────────────────────────
  function showNotification(changes, oldSnap) {
    if (changes.length === 0) return;

    const existing = document.getElementById('wf-deploy-tracker');
    if (existing) existing.remove();

    const severityCount = { danger: 0, warning: 0, info: 0, success: 0 };
    changes.forEach(c => severityCount[c.severity]++);

    const headerColor =
      severityCount.danger  > 0 ? '#dc3545' :
      severityCount.warning > 0 ? '#fd7e14' :
      severityCount.info    > 0 ? '#0d6efd' : '#198754';

    const timeDiff = oldSnap ? getTimeDiff(oldSnap.timestamp) : '';

    const container = document.createElement('div');
    container.id = 'wf-deploy-tracker';
    container.innerHTML = `
      <style>
        #wf-deploy-tracker {
          position: fixed; top: 16px; right: 16px; z-index: 99999;
          width: 430px; max-height: 87vh;
          background: #10131a;
          border: 1.5px solid ${headerColor};
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          font-family: 'Segoe UI', 'Inter', sans-serif;
          font-size: 13px; overflow: hidden;
          display: flex; flex-direction: column;
          animation: wfSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes wfSlideIn {
          from { transform: translateX(130%) scale(0.9); opacity: 0; }
          to   { transform: translateX(0) scale(1);     opacity: 1; }
        }
        #wf-tracker-header {
          background: linear-gradient(135deg, ${headerColor}cc, ${headerColor});
          color: white; padding: 13px 16px;
          display: flex; justify-content: space-between; align-items: center;
          cursor: pointer; user-select: none; flex-shrink: 0;
        }
        #wf-tracker-header h6 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; }
        #wf-tracker-header small { font-size: 11px; opacity: 0.88; }
        #wf-tracker-close {
          background: rgba(255,255,255,0.2); border: none; color: white;
          font-size: 18px; cursor: pointer; padding: 2px 8px;
          border-radius: 6px; line-height: 1; transition: background 0.2s;
        }
        #wf-tracker-close:hover { background: rgba(255,255,255,0.35); }
        #wf-tracker-body { overflow-y: auto; padding: 10px; flex: 1; scrollbar-width: thin; scrollbar-color: #333 #10131a; }
        .wf-change-item {
          background: #1a1e28; border-radius: 9px;
          padding: 10px 13px; margin-bottom: 7px;
          border-left: 3px solid transparent; transition: background 0.2s;
        }
        .wf-change-item:hover { background: #22273a; }
        .wf-change-item.danger  { border-color: #dc3545; }
        .wf-change-item.warning { border-color: #fd7e14; }
        .wf-change-item.info    { border-color: #0d6efd; }
        .wf-change-item.success { border-color: #198754; }
        .wf-change-title { color: #f1f2f5; font-weight: 600; margin-bottom: 3px; font-size: 13px; }
        .wf-change-detail { color: #8a95a8; font-size: 11px; margin-bottom: 4px; word-break: break-all; }
        .wf-change-reason {
          color: #5d697a; font-size: 11px; font-style: italic;
          border-top: 1px solid #282e3e; padding-top: 5px; margin-top: 4px; line-height: 1.5;
        }
        #wf-tracker-footer {
          padding: 9px 13px; border-top: 1px solid #1e2430;
          display: flex; justify-content: space-between; align-items: center;
          background: #0d0f16; flex-shrink: 0;
        }
        .wf-badge {
          display: inline-block; padding: 2px 8px;
          border-radius: 10px; font-size: 11px; font-weight: 700; margin-right: 4px;
        }
        .wf-badge.danger  { background: rgba(220,53,69,0.2);  color: #ff6b7a; border: 1px solid #dc3545; }
        .wf-badge.warning { background: rgba(253,126,20,0.2); color: #ffb347; border: 1px solid #fd7e14; }
        .wf-badge.info    { background: rgba(13,110,253,0.2); color: #6ea8fe; border: 1px solid #0d6efd; }
        .wf-badge.success { background: rgba(25,135,84,0.2);  color: #75b798; border: 1px solid #198754; }
        .wf-btn {
          border: none; padding: 5px 13px; border-radius: 7px;
          cursor: pointer; font-size: 12px; font-weight: 600;
          transition: all 0.2s;
        }
        .wf-btn-dismiss { background: #252b39; color: #9ba5b4; }
        .wf-btn-dismiss:hover { background: #2e3547; color: #fff; }
        .wf-btn-snapshot { background: rgba(13,110,253,0.15); color: #6ea8fe; margin-right: 6px; }
        .wf-btn-snapshot:hover { background: rgba(13,110,253,0.3); }
        #wf-tracker-collapsed {
          display: none; position: fixed; top: 16px; right: 16px; z-index: 99999;
          background: ${headerColor}; color: white;
          padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700;
          cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          animation: wfSlideIn 0.3s ease; letter-spacing: 0.3px;
        }
        #wf-tracker-collapsed:hover { filter: brightness(1.15); }
      </style>

      <div id="wf-tracker-collapsed" onclick="
        document.querySelector('#wf-deploy-tracker #wf-tracker-main').style.display='flex';
        this.style.display='none';
      ">🔔 ${changes.length}টা পরিবর্তন ধরা পড়েছে</div>

      <div id="wf-tracker-main" style="display:flex; flex-direction:column; max-height:87vh;">
        <div id="wf-tracker-header" onclick="
          document.querySelector('#wf-deploy-tracker #wf-tracker-main').style.display='none';
          document.querySelector('#wf-deploy-tracker #wf-tracker-collapsed').style.display='block';
        ">
          <div>
            <h6>🔍 Wings Fly — Change Tracker</h6>
            <small>${timeDiff ? timeDiff + ' · ' : ''}${changes.length}টা পরিবর্তন সনাক্ত হয়েছে</small>
          </div>
          <button id="wf-tracker-close" onclick="event.stopPropagation(); document.getElementById('wf-deploy-tracker').remove()">×</button>
        </div>

        <div id="wf-tracker-body">
          ${changes.map(c => `
            <div class="wf-change-item ${c.severity}">
              <div class="wf-change-title">${c.icon} ${c.title}</div>
              ${c.detail ? `<div class="wf-change-detail">📎 ${c.detail}</div>` : ''}
              <div class="wf-change-reason">💡 কারণ: ${c.reason}</div>
            </div>
          `).join('')}
        </div>

        <div id="wf-tracker-footer">
          <div>
            ${severityCount.danger  > 0 ? `<span class="wf-badge danger">${severityCount.danger} Critical</span>`  : ''}
            ${severityCount.warning > 0 ? `<span class="wf-badge warning">${severityCount.warning} Warning</span>` : ''}
            ${severityCount.info    > 0 ? `<span class="wf-badge info">${severityCount.info} Info</span>`          : ''}
            ${severityCount.success > 0 ? `<span class="wf-badge success">${severityCount.success} Fixed</span>`   : ''}
          </div>
          <div>
            <button class="wf-btn wf-btn-snapshot" onclick="WFTracker.takeSnapshot(); document.getElementById('wf-deploy-tracker').remove();" title="এখনকার অবস্থাকে 'normal' হিসেবে save করুন">📸 Snapshot নাও</button>
            <button class="wf-btn wf-btn-dismiss" onclick="
              localStorage.setItem('wf_tracker_dismissed_${new Date().toDateString()}', '1');
              document.getElementById('wf-deploy-tracker').remove();
            ">✓ বুঝেছি</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // ৪০ সেকেন্ড পর auto-minimize (বন্ধ না)
    setTimeout(() => {
      const t = document.getElementById('wf-deploy-tracker');
      if (t) {
        const main = t.querySelector('#wf-tracker-main');
        const coll = t.querySelector('#wf-tracker-collapsed');
        if (main && coll && main.style.display !== 'none') {
          main.style.display = 'none';
          coll.style.display = 'block';
        }
      }
    }, 40000);
  }

  // ─── Helper: কতক্ষণ আগে ─────────────────────────────────────
  function getTimeDiff(isoTimestamp) {
    const diff = Date.now() - new Date(isoTimestamp).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (days  > 0)  return `${days} দিন আগে`;
    if (hours > 0)  return `${hours} ঘণ্টা আগে`;
    if (mins  > 0)  return `${mins} মিনিট আগে`;
    return 'এইমাত্র';
  }

  // ─── History ─────────────────────────────────────────────────
  function saveToHistory(snapshot) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      history.unshift({
        timestamp: snapshot.timestamp,
        fnCount: Object.values(snapshot.functions || {}).filter(Boolean).length,
        domCount: Object.values(snapshot.domIds || {}).filter(Boolean).length,
      });
      if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) { /* ignore */ }
  }

  function updateSnapshot(snap) {
    try {
      // Update করার আগে একটু অপেক্ষা করো যাতে সব scripts লোড হয়
      const snapshot = snap || captureSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[WFTracker] Snapshot save error:', e);
    }
  }

  // ─── Main Init ───────────────────────────────────────────────
  function init() {
    // আজকে dismiss করা হয়েছে কিনা চেক করো
    const dismissedToday = localStorage.getItem('wf_tracker_dismissed_' + new Date().toDateString());
    if (dismissedToday) {
      // তবুও snapshot update করো — পরবর্তী session-এর জন্য
      setTimeout(updateSnapshot, 2000);
      return;
    }

    const oldSnapRaw = localStorage.getItem(STORAGE_KEY);
    
    // সব scripts লোড হওয়ার পর snapshot নাও (2.5 সেকেন্ড delay)
    setTimeout(() => {
      const newSnap = captureSnapshot();

      if (oldSnapRaw) {
        try {
          const oldSnap = JSON.parse(oldSnapRaw);

          // একই session হলে skip (refresh করার ক্ষেত্রে এড়াতে)
          const timeSince = Date.now() - new Date(oldSnap.timestamp).getTime();
          if (timeSince < 30000) {
            // ৩০ সেকেন্ডের মধ্যে reload হলে track করব না (dev server restart)
            updateSnapshot(newSnap);
            saveToHistory(newSnap);
            return;
          }

          const changes = compareSnapshots(oldSnap, newSnap);

          if (changes.length > 0) {
            console.log(`%c[WFTracker] 🔔 ${changes.length}টা পরিবর্তন সনাক্ত হয়েছে`, 'color: #fd7e14; font-weight: bold;');
            changes.forEach(c => {
              const style = c.severity === 'danger' ? 'color: #dc3545' :
                            c.severity === 'warning' ? 'color: #fd7e14' :
                            c.severity === 'success' ? 'color: #198754' : 'color: #0d6efd';
              console.log(`%c  ${c.icon} ${c.title}`, style);
            });
            showNotification(changes, oldSnap);
          } else {
            console.log('%c[WFTracker] ✅ কোনো পরিবর্তন নেই — সব functions সঠিকভাবে কাজ করছে', 'color: #198754;');
          }
        } catch (e) {
          console.warn('[WFTracker] Snapshot parse error:', e);
        }
      } else {
        console.log('%c[WFTracker] 🆕 প্রথমবার — snapshot সংরক্ষণ করা হচ্ছে', 'color: #0d6efd;');
      }

      updateSnapshot(newSnap);
      saveToHistory(newSnap);

    }, 2500); // সব JS load হওয়ার জন্য অপেক্ষা
  }

  // ─── Public API ──────────────────────────────────────────────
  window.WFTracker = {
    // এখনকার অবস্থাকে "ভালো" হিসেবে save করো
    takeSnapshot() {
      const snap = captureSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      console.log('%c[WFTracker] ✅ Snapshot সংরক্ষণ হয়েছে', 'color: #198754;');
      console.log(`  Functions loaded: ${Object.values(snap.functions).filter(Boolean).length}/${CRITICAL_FUNCTIONS.length}`);
      console.log(`  DOM IDs found:    ${Object.values(snap.domIds).filter(Boolean).length}/${CRITICAL_DOM_IDS.length}`);
      console.log(`  Scripts loaded:   ${snap.scripts.filter(s => !s.includes('cdn')).length}`);
    },

    // Reset করো
    reset() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(HISTORY_KEY);
      console.log('[WFTracker] 🗑️ Reset সম্পন্ন — পরের load-এ fresh snapshot নেবে');
    },

    // ম্যানুয়ালি report দেখো
    showReport() {
      const oldSnapRaw = localStorage.getItem(STORAGE_KEY);
      if (!oldSnapRaw) {
        console.warn('[WFTracker] কোনো পুরনো snapshot নেই। আগে takeSnapshot() করুন।');
        return;
      }
      const oldSnap = JSON.parse(oldSnapRaw);
      const newSnap = captureSnapshot();
      const changes = compareSnapshots(oldSnap, newSnap);
      if (changes.length === 0) {
        alert('✅ কোনো পরিবর্তন পাওয়া যায়নি — সব functions সঠিকভাবে কাজ করছে!');
      } else {
        showNotification(changes, oldSnap);
      }
    },

    // কোন functions missing তা দেখো
    checkMissing() {
      const snap = captureSnapshot();
      const missing = CRITICAL_FUNCTIONS.filter(fn => !snap.functions[fn]);
      const present = CRITICAL_FUNCTIONS.filter(fn => snap.functions[fn]);
      console.log(`%c[WFTracker] Function Check: ${present.length}/${CRITICAL_FUNCTIONS.length} loaded`, 'color: #0d6efd; font-weight: bold;');
      if (missing.length > 0) {
        console.log(`%c  ❌ Missing (${missing.length}):`, 'color: #dc3545; font-weight: bold;');
        missing.forEach(fn => console.log(`%c     - ${fn}()`, 'color: #dc3545;'));
      } else {
        console.log('%c  ✅ All functions present!', 'color: #198754;');
      }
      return { missing, present };
    },

    // Deploy history দেখো
    getHistory() {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    },
  };

  // Start করো — DOMContentLoaded-এর পর
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('%c[WFTracker] ✈️ Wings Fly Deploy Change Tracker v2.0 loaded', 'color: #00d9ff; font-weight: bold;');
  console.log('%c  Commands: WFTracker.checkMissing() | WFTracker.showReport() | WFTracker.takeSnapshot() | WFTracker.reset()', 'color: #9ba5b4; font-size: 11px;');

})();
