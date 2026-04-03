/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * SYNC & PAYMENT GUARD — v1.0
 * ============================================================
 *
 * এই module sync system এবং payment methods এর উপর নজর রাখে।
 * যদি কিছু ভুল হয় → admin কে সাথে সাথে alert দেয়।
 *
 * CHECKS:
 *  Sync Guard:
 *   1. moveToTrash / restoreDeletedItem / logActivity override ঠিক আছে কিনা
 *   2. globalData.deletedItems structure ঠিক আছে কিনা (object, array না)
 *   3. Supabase connection আছে কিনা
 *   4. Push/Pull lock stuck আছে কিনা
 *   5. Data integrity before push
 *
 *  Payment Methods Guard:
 *   6. Finance entries যে accounts রেফার করে সেগুলো আছে কিনা
 *   7. Account balance consistency
 *   8. Loan entries income/expense এ count হচ্ছে কিনা
 *
 * Public API:
 *   syncGuard.run()       → manual check চালাও
 *   syncGuard.status()    → last check result দেখো
 *   syncGuard.silence()   → alert বন্ধ করো
 * ============================================================
 */

(function () {
  'use strict';

  if (window._syncGuardLoaded) return;
  window._syncGuardLoaded = true;

  // ── SOUND ALERT — guard RED হলে "tuk tuk" শব্দ ─────────
  var _lastAlertTime = 0;
  function _playAlert() {
    var now = Date.now();
    if (now - _lastAlertTime < 10000) return; // ১০ সেকেন্ডে একবারই
    _lastAlertTime = now;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 200].forEach(function(delay) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = 800;
        gain.gain.value = 0.15;
        osc.start(ctx.currentTime + delay / 1000);
        osc.stop(ctx.currentTime + delay / 1000 + 0.08);
      });
    } catch(e) { /* audio not supported */ }
  }

  var _silenced = false;
  var _lastStatus = null;
  var _lastDetails = [];
  var _panelEl = null;

  // ── EXPECTED VALUES ───────────────────────────────────────

  var EXPECTED_SYNC_FUNCTIONS = [
    'moveToTrash',
    'restoreDeletedItem',
    'logActivity',
    'permanentDelete',
    'saveToStorage',
    'scheduleSyncPush',
    'markDirty',
    'feApplyEntryToAccount',
    'feCalcStats'
    // ✅ FIX: feSoftDeleteEntry / feRestoreEntry সবসময় লোড নাও হতে পারে
    // এগুলো optional — issue না দিয়ে warning দেওয়া হবে নিচে
  ];

  // moveToTrash এবং restoreDeletedItem কোন file থেকে আসা উচিত
  var TRASH_SOURCE_FILE = 'recycle-bin-fix.js';

  function _classifyMessage(msg, severity) {
    var m = String(msg || '');
    var out = {
      severity: severity || 'warn',
      code: 'SG_UNKNOWN',
      message: m,
      source: 'unknown',
      fix: 'Run syncGuard.run() and check console.'
    };

    if (m.indexOf('Sync function missing:') === 0) {
      out.code = 'SG_MISSING_FUNCTION';
      out.source = 'index.html script load order / sections/*.js';
      out.fix = 'Ensure all required scripts load and function names are unchanged.';
    } else if (m.indexOf('gd.deletedItems is an ARRAY') !== -1 || m.indexOf('gd.deletedItems') !== -1) {
      out.code = 'SG_DELETED_ITEMS_SHAPE';
      out.source = TRASH_SOURCE_FILE + ' / supabase-sync-SMART-V39.js';
      out.fix = 'Keep deletedItems as object: {students,finance,employees,other}.';
    } else if (m.indexOf('Supabase client is null') !== -1 || m.indexOf('getWingsSupabaseClient') !== -1) {
      out.code = 'SG_SUPABASE_CLIENT';
      out.source = 'supabase-config.js / supabase-sync-SMART-V39.js';
      out.fix = 'Check SUPABASE_CONFIG URL/KEY and client init.';
    } else if (m.indexOf('Egress hard-throttled') !== -1) {
      out.code = 'SG_EGRESS_LIMIT';
      out.source = 'supabase-sync-SMART-V39.js';
      out.fix = 'Run wingsSync.resetEgress(pin) or wait for daily reset.';
    } else if (m.indexOf('finance entries missing type or amount') !== -1) {
      out.code = 'SG_BAD_FINANCE_ENTRY';
      out.source = 'finance-crud.js / migration data';
      out.fix = 'Fix or remove invalid finance rows without type/amount.';
    } else if (m.indexOf('non-existent accounts') !== -1) {
      out.code = 'SG_ORPHAN_METHOD';
      out.source = 'accounts-management.js / finance records';
      out.fix = 'Create missing account/method or update finance.method values.';
    } else if (m.indexOf('negative balance') !== -1) {
      out.code = 'SG_NEGATIVE_BALANCE';
      out.source = 'finance-engine.js / account operations';
      out.fix = 'Review recent delete/restore/transfer entries and rebuild balances.';
    } else if (m.indexOf('Loan entries are being counted') !== -1) {
      out.code = 'SG_LOAN_IN_STATS';
      out.source = 'finance-engine.js';
      out.fix = 'Verify feIsStatIncome/feIsStatExpense type lists.';
    } else if (m.indexOf('Advance/Investment entries are being counted') !== -1) {
      out.code = 'SG_ADV_IN_STATS';
      out.source = 'finance-engine.js';
      out.fix = 'Keep Advance/Investment outside income/expense stat lists.';
    } else if (m.indexOf('Grand total balance is NaN') !== -1) {
      out.code = 'SG_BALANCE_NAN';
      out.source = 'accounts-management.js / finance-engine.js';
      out.fix = 'Find account with invalid numeric balance.';
    } else if (m.indexOf('Sync appears busy/stuck') !== -1) {
      out.code = 'SG_SYNC_BUSY';
      out.source = 'supabase-sync-SMART-V39.js';
      out.fix = 'Try wingsSync.pullNow() and re-check status.';
    } else if (m.indexOf('Service role key detected') !== -1 || m.indexOf('API key is EMPTY') !== -1) {
      out.code = 'SG_KEY_CONFIG';
      out.source = 'supabase-config.js';
      out.fix = 'Use anon key in client. Never use service_role in browser.';
    }
    return out;
  }

  function _buildDetails(issues, warnings) {
    _lastDetails = [];
    (issues || []).forEach(function (i) { _lastDetails.push(_classifyMessage(i, 'issue')); });
    (warnings || []).forEach(function (w) { _lastDetails.push(_classifyMessage(w, 'warning')); });
  }

  function _checkSyncApi(issues, warnings) {
    if (!window.wingsSync || typeof window.wingsSync !== 'object') {
      // ✅ FIX: issue → warning, কারণ wingsSync late-load হয়
      warnings.push('wingsSync API এখনো লোড হয়নি — cloud sync চেক করতে পারছি না');
      return;
    }
    ['pushNow', 'pullNow', 'smartSync', 'getStatus'].forEach(function (fn) {
      if (typeof window.wingsSync[fn] !== 'function') {
        // ✅ FIX: missing wingsSync function → warning (not issue)
        warnings.push('wingsSync.' + fn + '() পাওয়া যায়নি');
      }
    });
    try {
      var st = typeof window.wingsSync.getStatus === 'function' ? window.wingsSync.getStatus() : null;
      if (st && typeof st.version === 'undefined') warnings.push('wingsSync.getStatus().version missing');
      if (st && typeof st.egress === 'undefined' && typeof st.egressToday === 'undefined') warnings.push('wingsSync.getStatus().egress missing');
    } catch (e) {
      warnings.push('wingsSync.getStatus() threw an error');
    }
  }

  function _countInvalidDeleteMarkers(gd, bucket) {
    if (!gd || !gd.deletedItems || !Array.isArray(gd.deletedItems[bucket])) return 0;
    var invalid = 0;
    gd.deletedItems[bucket].forEach(function (d) {
      var source = d && d.item ? d.item : null;
      if (bucket === 'students') {
        var sid = (source && (source.studentId || source.id || source.phone || source.name)) || d.sourceId || d.studentId;
        if (!sid) invalid++;
      } else if (bucket === 'finance') {
        var fid = (source && (source.id || source.timestamp)) || d.sourceId || d.financeId;
        if (!fid) invalid++;
      }
    });
    return invalid;
  }

  function _ensurePanel() {
    if (_panelEl) return _panelEl;
    var el = document.createElement('div');
    el.id = 'syncGuardPanel';
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;width:420px;max-width:calc(100vw - 28px);max-height:55vh;overflow:auto;background:rgba(6,10,24,0.97);border:1px solid rgba(0,217,255,0.35);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.45);padding:10px;display:none;color:#d7ebff;font-size:12px;';
    document.body.appendChild(el);
    _panelEl = el;
    return el;
  }

  function _renderPanel() {
    var el = _ensurePanel();
    var s = _lastStatus;
    if (!s) {
      el.innerHTML = '<div style="color:#9cb3c9;">No Sync Guard report yet.</div>';
      return;
    }
    var rows = _lastDetails.map(function (d, i) {
      var c = d.severity === 'issue' ? '#ff5d6c' : '#ffb74d';
      return '<div style="margin:0 0 8px 0;padding:8px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:rgba(255,255,255,0.03);">'
        + '<div style="color:' + c + ';font-weight:700;">' + (i + 1) + '. [' + d.code + '] ' + d.severity.toUpperCase() + '</div>'
        + '<div style="margin-top:4px;color:#e2f1ff;">' + d.message + '</div>'
        + '<div style="margin-top:4px;color:#8fb4d8;">Source: ' + d.source + '</div>'
        + '<div style="margin-top:2px;color:#a6cbbf;">Fix: ' + d.fix + '</div>'
        + '</div>';
    }).join('');
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;">'
      + '<div style="font-weight:700;color:#00d9ff;">Sync Guard Diagnostics</div>'
      + '<button type="button" onclick="window.syncGuard.hidePanel()" style="border:1px solid rgba(255,255,255,0.35);background:transparent;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;">Close</button>'
      + '</div>'
      + '<div style="margin-bottom:8px;color:#9fc4e6;">Last check: ' + s.checkedAt + ' | issues=' + s.issues.length + ' warnings=' + s.warnings.length + '</div>'
      + (rows || '<div style="color:#87d39a;font-weight:600;">No issues/warnings.</div>');
  }

  // ── MAIN CHECK ────────────────────────────────────────────

  function runGuard(silent) {
    var gd = window.globalData;
    var issues = [];
    var warnings = [];

    // ══════════════════════════════════════════════════════
    // SYNC GUARD CHECKS
    // ══════════════════════════════════════════════════════

    // ── CHECK 1: Critical sync functions exist ─────────────
    EXPECTED_SYNC_FUNCTIONS.forEach(function (fn) {
      if (typeof window[fn] !== 'function') {
        issues.push('Sync function missing: ' + fn);
      }
    });

    // ✅ Optional functions — warning only (not issue)
    ['feSoftDeleteEntry', 'feRestoreEntry'].forEach(function(fn) {
      if (typeof window[fn] !== 'function') {
        warnings.push('Optional function not loaded: ' + fn + ' (soft-delete feature unavailable)');
      }
    });

    // ── CHECK 1b: wings_last_known_finance drift ───────────
    // Student delete করার পর এই counter stale হলে saveToStorage block হয়
    if (gd && Array.isArray(gd.finance)) {
      var actualFinCount = gd.finance.length;
      var knownFinCount = parseInt(localStorage.getItem('wings_last_known_finance')) || 0;
      // counter এর চেয়ে actual ১০+ কম হলে drift warning
      if (knownFinCount > 10 && actualFinCount < knownFinCount - 10) {
        warnings.push('wings_last_known_finance counter stale: known=' + knownFinCount + ' actual=' + actualFinCount + ' — student delete এর পর saveToStorage block হতে পারে। Console এ চালান: localStorage.setItem("wings_last_known_finance", String(globalData.finance.length))');
      }
    }

    // ── CHECK 2: deletedItems structure ────────────────────
    if (gd) {
      if (Array.isArray(gd.deletedItems)) {
        issues.push('gd.deletedItems is an ARRAY — should be {students:[], finance:[], employees:[], other:[]}. Data loss risk!');
      } else if (gd.deletedItems && typeof gd.deletedItems === 'object') {
        var requiredCats = ['students', 'finance', 'employees', 'other'];
        requiredCats.forEach(function (cat) {
          if (!Array.isArray(gd.deletedItems[cat])) {
            warnings.push('gd.deletedItems.' + cat + ' is not an array — fixing...');
            gd.deletedItems[cat] = [];
          }
        });
      } else {
        warnings.push('gd.deletedItems is missing or null');
      }
    }

    // ── CHECK 3: Supabase connection ───────────────────────
    if (typeof window.getWingsSupabaseClient === 'function') {
      var client = window.getWingsSupabaseClient();
      if (!client) {
        warnings.push('Supabase client is null — cloud sync will not work');
      }
    } else {
      warnings.push('getWingsSupabaseClient function not found');
    }

    // Check config key
    if (window.SUPABASE_CONFIG) {
      var key = window.SUPABASE_CONFIG.KEY || '';
      if (!key || key.trim() === '') {
        issues.push('Supabase API key is EMPTY — all cloud operations will fail silently');
      }
      if (key.includes('service_role')) {
        issues.push('SECURITY RISK: Service role key detected in client-side code! Use anon key only.');
      }
    }

    // ── CHECK 4: Push/Pull lock status + wingsSync API ─────
    _checkSyncApi(issues, warnings);

    if (typeof window.wingsSync === 'function' || (window.wingsSync && typeof window.wingsSync === 'object')) {
      // Check if sync status shows stuck
      try {
        var syncStatus = window.wingsSync.getStatus ? window.wingsSync.getStatus() : null;
        if (syncStatus && syncStatus.busy) {
          warnings.push('Sync appears busy/stuck — may need manual reset');
        }
        // V39: Check egress throttle
        if (syncStatus && (syncStatus.egressToday ?? syncStatus.egress) >= 500) {
          issues.push('Egress hard-throttled (' + (syncStatus.egressToday ?? syncStatus.egress) + ' requests) — Cloud sync বন্ধ');
        }
      } catch (e) { /* ignore */ }
    }

    // ── CHECK 5: Data integrity ────────────────────────────
    if (gd) {
      // globalData should have these arrays
      var requiredArrays = ['students', 'finance', 'employees'];
      requiredArrays.forEach(function (key) {
        if (gd[key] && !Array.isArray(gd[key])) {
          issues.push('gd.' + key + ' is not an array — data corruption risk!');
        }
      });

      // Finance entries should have required fields
      if (Array.isArray(gd.finance)) {
        var badEntries = 0;
        gd.finance.forEach(function (f) {
          if (!f._deleted && (!f.type || (!f.amount && f.amount !== 0))) {
            badEntries++;
          }
        });
        if (badEntries > 0) {
          warnings.push(badEntries + ' finance entries missing type or amount');
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // PAYMENT METHODS GUARD CHECKS
    // ══════════════════════════════════════════════════════

    if (gd) {
      // ── CHECK 6: Finance entries reference valid accounts ──
      // ✅ FIX: paymentMethods array থেকেও valid names নাও
      // কারণ: পুরনো entries তে 'Bkash', 'Nagad' ইত্যাদি থাকতে পারে
      // যেগুলো mobileBanking array তে নেই কিন্তু paymentMethods এ আছে।
      // এগুলো orphan নয় — legacy valid methods।
      var accountNames = new Set();
      accountNames.add('Cash');
      (gd.bankAccounts || []).forEach(function (a) { if (a.name) accountNames.add(a.name); });
      (gd.mobileBanking || []).forEach(function (a) { if (a.name) accountNames.add(a.name); });
      // paymentMethods array (legacy support)
      (gd.paymentMethods || []).forEach(function (m) { if (m) accountNames.add(m); });
      // Common known methods যেগুলো সবসময় valid
      ['Bkash', 'Nagad', 'Bank Transfer', 'bKash', 'Rocket', 'Cash'].forEach(function(m) {
        accountNames.add(m);
      });

      var orphanMethods = {};
      (gd.finance || []).forEach(function (f) {
        if (f._deleted) return;
        if (f.method && !accountNames.has(f.method)) {
          orphanMethods[f.method] = (orphanMethods[f.method] || 0) + 1;
        }
      });
      var orphanKeys = Object.keys(orphanMethods);
      if (orphanKeys.length > 0) {
        warnings.push('Finance entries reference non-existent accounts: ' + orphanKeys.map(function (m) {
          return '"' + m + '" (' + orphanMethods[m] + ' entries)';
        }).join(', '));
      }

      // ── CHECK 7: Account balance sanity ─────────────────
      var totalBal = (parseFloat(gd.cashBalance) || 0);
      (gd.bankAccounts || []).forEach(function (a) { totalBal += (parseFloat(a.balance) || 0); });
      (gd.mobileBanking || []).forEach(function (a) { totalBal += (parseFloat(a.balance) || 0); });

      if (isNaN(totalBal)) {
        issues.push('Grand total balance is NaN — some account has invalid balance');
      }

      // Check for negative balances (warning, not error — could be intentional)
      if (parseFloat(gd.cashBalance) < 0) {
        warnings.push('Cash balance is negative: ৳' + gd.cashBalance);
      }
      (gd.bankAccounts || []).forEach(function (a) {
        if (parseFloat(a.balance) < 0) {
          warnings.push('Bank account "' + a.name + '" has negative balance: ৳' + a.balance);
        }
      });

      // ── CHECK 8: Loan entries not in income/expense ─────
      if (typeof window.feIsStatIncome === 'function' && typeof window.feIsStatExpense === 'function') {
        var loanInStats = false;
        (gd.finance || []).forEach(function (f) {
          if (f._deleted) return;
          var loanTypes = ['Loan Given', 'Loan Giving', 'Loan Received', 'Loan Receiving'];
          if (loanTypes.includes(f.type)) {
            if (window.feIsStatIncome(f.type) || window.feIsStatExpense(f.type)) {
              loanInStats = true;
            }
          }
        });
        if (loanInStats) {
          issues.push('Loan entries are being counted as Income/Expense — finance-engine.js may be corrupted');
        }
      }

      // ── CHECK 9: Advance/Investment not in income/expense stats ──
      if (typeof window.feIsStatIncome === 'function') {
        var advInStats = false;
        (gd.finance || []).forEach(function (f) {
          if (f._deleted) return;
          if (f.type === 'Advance' || f.type === 'Advance Return' ||
              f.type === 'Investment' || f.type === 'Investment Return') {
            if (window.feIsStatIncome(f.type) || (typeof window.feIsStatExpense === 'function' && window.feIsStatExpense(f.type))) {
              advInStats = true;
            }
          }
        });
        if (advInStats) {
          issues.push('Advance/Investment entries are being counted as Income/Expense — should be account movements only');
        }
      }

      var badStuDel = _countInvalidDeleteMarkers(gd, 'students');
      if (badStuDel > 0) {
        warnings.push('deletedItems.students has ' + badStuDel + ' invalid delete marker(s) without source id');
      }
      var badFinDel = _countInvalidDeleteMarkers(gd, 'finance');
      if (badFinDel > 0) {
        warnings.push('deletedItems.finance has ' + badFinDel + ' invalid delete marker(s) without source id');
      }
    }

    // ══════════════════════════════════════════════════════
    // RESULT
    // ══════════════════════════════════════════════════════
    var ok = issues.length === 0;
    _lastStatus = {
      ok: ok,
      issues: issues,
      warnings: warnings,
      checkedAt: new Date().toISOString(),
      details: []
    };
    _buildDetails(issues, warnings);
    _lastStatus.details = _lastDetails.slice();

    _updateDot(ok, issues.length + warnings.length);

    // ✅ FIX: Sound alert when guard turns RED (data mismatch)
    if (!ok && !_silenced) {
      _playAlert();
    }

    if (!silent) {
      if (ok && warnings.length === 0) {
        console.log('%c✅ [SyncGuard] সব ঠিক আছে — Sync & Payment integrity OK', 'color:#00c853;font-weight:bold;');
      } else if (ok && warnings.length > 0) {
        console.group('%c⚠️ [SyncGuard] ' + warnings.length + ' টি সতর্কতা', 'color:#ff9800;font-weight:bold;');
        warnings.forEach(function (w) { console.warn('[SyncGuard]', w); });
        _showToast('warn', '⚠️ Sync Guard: ' + warnings.length + ' টি warning — <span style="text-decoration:underline;cursor:pointer;font-weight:bold;color:#ffeb3b;" onclick="window.syncGuard.openPanel()">এখানে ক্লিক করে দেখুন</span>');
      } else {
        console.group('%c🚨 [SyncGuard] ' + issues.length + ' টি সমস্যা পাওয়া গেছে!', 'color:#f44336;font-weight:bold;');
        issues.forEach(function (msg) { console.error('[SyncGuard]', msg); });
        if (warnings.length > 0) warnings.forEach(function (w) { console.warn('[SyncGuard]', w); });
        console.groupEnd();
        if (!_silenced) {
          _showToast('error', '🚨 Sync Guard: ' + issues.length + ' টি সমস্যা! <span style="text-decoration:underline;cursor:pointer;font-weight:bold;color:#ffeb3b;" onclick="window.syncGuard.openPanel()">এখানে ক্লিক করে দেখুন</span>');
        }
      }
    }

    return _lastStatus;
  }

  // ── UI DOT ────────────────────────────────────────────────

  function _injectDot() {
    if (document.getElementById('syncGuardDot')) return;

    var dot = document.createElement('div');
    dot.id = 'syncGuardDot';
    dot.title = '⏳ Sync checking...';
    dot.textContent = '⚡';
    dot.style.cssText = [
      'width:22px',
      'height:22px',
      'border-radius:50%',
      'background:rgba(80,80,80,0.9)',
      'cursor:pointer',
      'transition:background 0.4s',
      'font-size:12px',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 0 6px rgba(0,0,0,0.4)',
      'flex-shrink:0',
      'margin-left:6px'
    ].join(';');

    dot.addEventListener('click', function () {
      var s = _lastStatus;
      if (!s) { runGuard(); return; }
      _renderPanel();
      _panelEl.style.display = 'block';
    });

    // Insert after "Welcome back, Admin!" h4 in the top bar (before finance guard)
    var welcomeH4 = null;
    document.querySelectorAll('.top-bar h4, header h4').forEach(function(el) {
      if (el.textContent.indexOf('Welcome') !== -1) welcomeH4 = el;
    });
    if (welcomeH4) {
      // If finance guard dot already exists, insert before it
      var financeDot = document.getElementById('financeGuardDot');
      if (financeDot) {
        financeDot.insertAdjacentElement('beforebegin', dot);
      } else {
        welcomeH4.insertAdjacentElement('afterend', dot);
      }
    } else {
      document.body.appendChild(dot);
    }
  }

  function _updateDot(ok, problemCount) {
    var dot = document.getElementById('syncGuardDot');
    if (!dot) return;

    if (ok && problemCount === 0) {
      dot.style.background = '#00c853';
      dot.title = '✅ Sync & Payment Healthy';
    } else if (ok && problemCount > 0) {
      dot.style.background = '#ff9800';
      dot.title = '⚠️ ' + problemCount + ' warning(s) — click for details';
    } else {
      dot.style.background = '#f44336';
      dot.title = '🚨 ' + problemCount + ' issue(s) — click for details';
    }
  }

  function _showToast(level, msg) {
    if (level === 'error' && typeof window.showErrorToast === 'function') {
      window.showErrorToast(msg);
    } else if (typeof window.showSuccessToast === 'function') {
      window.showSuccessToast(msg);
    }
  }

  // ── AUTO-FIX: deletedItems structure ──────────────────────
  function _autoFix() {
    var gd = window.globalData;
    if (!gd) return;

    // Fix deletedItems structure
    if (!gd.deletedItems || Array.isArray(gd.deletedItems)) {
      console.warn('[SyncGuard] Auto-fix: deletedItems structure corrected');
      gd.deletedItems = { students: [], finance: [], employees: [], other: [] };
    }
    ['students', 'finance', 'employees', 'other'].forEach(function (cat) {
      if (!Array.isArray(gd.deletedItems[cat])) {
        gd.deletedItems[cat] = [];
      }
    });
  }

  // ── HOOKS: Re-check after key operations ──────────────────

  function _hookAfter(fnName, delay) {
    delay = delay || 2000;
    var orig = window[fnName];
    if (typeof orig !== 'function') return;
    // ✅ FIX: double-wrap protection — finance-guard ও একই function hook করে।
    // _sgHooked flag দিয়ে check করো — আগে থেকে sync-guard wrap করা থাকলে আর করবো না।
    if (orig._sgHooked) return;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      setTimeout(function () { runGuard(true); }, delay);
      return result;
    };
    wrapped._sgHooked = true;
    // finance-guard এর _fgHooked preserve করো
    if (orig._fgHooked) wrapped._fgHooked = true;
    window[fnName] = wrapped;
  }

  function _installHooks() {
    _hookAfter('moveToTrash', 2000);
    _hookAfter('restoreDeletedItem', 2000);
    _hookAfter('permanentDelete', 2000);
    _hookAfter('deleteTransaction', 2000);
    _hookAfter('deleteStudent', 2000);
    _hookAfter('deleteLoanTransaction', 2000);
    _hookAfter('deleteSalaryPayment', 2000);
    _hookAfter('handleSalarySubmit', 2000);
    console.log('[SyncGuard] ✅ Hooks installed');
  }

  // ── PUBLIC API ────────────────────────────────────────────

  window.syncGuard = {
    run: function () { return runGuard(false); },
    check: function () { return runGuard(true); },
    status: function () { return _lastStatus; },
    details: function () { return _lastDetails.slice(); },
    explain: function () {
      return (_lastDetails || []).map(function (d, i) {
        return (i + 1) + '. [' + d.code + '] ' + d.message + ' | Source: ' + d.source + ' | Fix: ' + d.fix;
      }).join('\n');
    },
    openPanel: function () {
      if (!_lastStatus) runGuard(true);
      _renderPanel();
      _panelEl.style.display = 'block';
      return _lastDetails.slice();
    },
    hidePanel: function () {
      if (_panelEl) _panelEl.style.display = 'none';
    },
    silence: function () { _silenced = true; console.log('[SyncGuard] Alerts silenced'); },
    unmute: function () { _silenced = false; console.log('[SyncGuard] Alerts active'); },
    fix: function () { _autoFix(); runGuard(false); }
  };
  window.openSyncGuardPanel = function () {
    if (window.syncGuard && typeof window.syncGuard.openPanel === 'function') {
      return window.syncGuard.openPanel();
    }
    return null;
  };

  // ── STARTUP ───────────────────────────────────────────────

  function _startup() {
    _injectDot();
    _autoFix();

    if (window.globalData) {
      _installHooks();
      runGuard(false);
    } else {
      var attempts = 0;
      var interval = setInterval(function () {
        attempts++;
        if (window.globalData) {
          clearInterval(interval);
          _installHooks();
          runGuard(false);
        } else if (attempts >= 20) {
          clearInterval(interval);
          console.warn('[SyncGuard] globalData লোড হয়নি — guard চালু হয়নি');
        }
      }, 500);
    }
  }

  // Dot early inject — দেরি না করে সাথে সাথে inject করো
  if (document.body) {
    _injectDot();
  } else {
    document.addEventListener('DOMContentLoaded', function () { _injectDot(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_startup, 2000); });
  } else {
    setTimeout(_startup, 2000);
  }

  console.log('✅ sync-guard.js v1.1 loaded (with diagnostics panel)');

})();
