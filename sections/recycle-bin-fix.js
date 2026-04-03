/**
 * ═══════════════════════════════════════════════════════════════
 * WINGS FLY — RECYCLE BIN FIX + ACTIVITY LOG FIX
 * File: sections/recycle-bin-fix.js
 * 
 * এই ফাইল নিশ্চিত করে:
 * 1. যেকোনো DELETE → প্রথমে Recycle Bin-এ যাবে
 * 2. Activity Log-এ সব action log হবে
 * 3. Restore করলে সঠিক section-এ ফিরে আসবে
 * 4. Keep Record delete/restore সঠিকভাবে কাজ করবে
 * 5. Breakdown-এ delete → recycle bin → restore flow
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // Prevent multiple executions
  if (window._wingsRecycleFixLoaded) {
    console.log('[RecycleFix] Already loaded, skipping...');
    return;
  }
  window._wingsRecycleFixLoaded = true;

  // ── Helper: Safe save ──
  function _save() {
    var gd = window.globalData;
    if (!gd) return;
    try {
      localStorage.setItem('wingsfly_data', JSON.stringify(gd));
      localStorage.setItem('wingsfly_deleted_backup', JSON.stringify(gd.deletedItems || {}));
      localStorage.setItem('wingsfly_activity_backup', JSON.stringify(gd.activityHistory || []));
      // ✅ V34.9 FIX: saveToStorage() call সরানো হয়েছে — infinite loop বন্ধ
      // saveToStorage() → localStorage.setItem('wingsfly_data') → _save() → loop!
    } catch (e) { console.error('[RecycleFix] save error:', e); }
  }

  // ── Helper: Generate unique ID ──
  function _uid(prefix) {
    return (prefix || 'ITEM') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // ── Helper: Current user ──
  function _user() {
    return sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin';
  }

  // ═══════════════════════════════════════════════
  // 1. CORE: moveToTrash (সব delete এর gateway)
  // ═══════════════════════════════════════════════
  // ── Helper: Ensure deletedItems is proper object (NOT array) ──
  function _ensureDeletedItems(gd) {
    if (window.WingsUtils && window.WingsUtils.ensureDeletedItemsObject) {
      return window.WingsUtils.ensureDeletedItemsObject(gd);
    }
    return gd.deletedItems;
  }

  window.moveToTrash = function (type, item) {
    var gd = window.globalData;
    if (!gd) return;
    _ensureDeletedItems(gd);

    // ✅ FIX: Duplicate trash prevention (if original function also calls moveToTrash)
    if (item._trash_moved) {
      console.log('[RecycleFix] Skip — already moved to trash:', item.id);
      return;
    }
    item._trash_moved = true; // Mark the object as trashed to prevent duplicate entries

    // Ensure item has an ID
    if (!item.id && !item._id) {
      item._trash_tmp_id = _uid('TMP');
    }

    var entry = {
      id: _uid('TRASH'),
      type: type,                              // 'Student','Finance','Employee','Visitor','KeepRecord','Breakdown'
      item: JSON.parse(JSON.stringify(item)),  // deep copy
      deletedAt: new Date().toISOString(),
      deletedBy: _user()
    };

    // Push to correct category (sync system needs object with students/finance/employees)
    var t = (type || '').toLowerCase();
    if (t === 'student') {
      gd.deletedItems.students.unshift(entry);
      if (gd.deletedItems.students.length > 300) gd.deletedItems.students = gd.deletedItems.students.slice(0, 300);
    } else if (t === 'finance' || t === 'salary_payment') {
      gd.deletedItems.finance.unshift(entry);
      if (gd.deletedItems.finance.length > 300) gd.deletedItems.finance = gd.deletedItems.finance.slice(0, 300);
    } else if (t === 'employee') {
      gd.deletedItems.employees.unshift(entry);
      if (gd.deletedItems.employees.length > 300) gd.deletedItems.employees = gd.deletedItems.employees.slice(0, 300);
    } else {
      if (!Array.isArray(gd.deletedItems.other)) gd.deletedItems.other = [];
      gd.deletedItems.other.unshift(entry);
      if (gd.deletedItems.other.length > 300) gd.deletedItems.other = gd.deletedItems.other.slice(0, 300);
    }

    // ✅ FIX: Sync cooldown trigger — যেকোনো ডিলিটের পর sync pull block হবে
    try {
      var _delCount = parseInt(localStorage.getItem('wings_total_deleted') || '0') + 1;
      localStorage.setItem('wings_total_deleted', _delCount.toString());
    } catch (e) { }

    _save();

    // ✅ FIX: Cloud sync trigger — আগে শুধু _save() হতো, sync trigger হত না
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Move to Trash: ' + type);
    }

    // Log to activity
    var name = item.name || item.studentName || item.title || item.description || item.id || 'Item';
    window.logActivity(type, 'DELETE', type + ' deleted: ' + name, item);

    console.log('[RecycleFix] ✓ Moved to Recycle Bin:', type, name);
    return entry.id;
  };

  // ═══════════════════════════════════════════════
  // 2. CORE: logActivity (সব action log করবে)
  // ═══════════════════════════════════════════════
  window.logActivity = function (type, action, description, data) {
    var gd = window.globalData;
    if (!gd) return;
    
    // Ignore auto-heal, system and autotest logs
    if (type === 'heal' || type === 'system' || type === 'autotest') return;

    if (!Array.isArray(gd.activityHistory)) gd.activityHistory = [];

    var entry = {
      id: _uid('ACT'),
      action: (action || 'OTHER').toUpperCase(),
      type: (type || 'general').toLowerCase(),
      description: description || '',
      user: _user(), // sub-account username capture
      timestamp: new Date().toISOString(),
      data: data ? (function () {
        try { return JSON.parse(JSON.stringify(data)); } catch (e) { return {}; }
      })() : {}
    };

    gd.activityHistory.unshift(entry);

    // Max 1000 logs
    if (gd.activityHistory.length > 1000) gd.activityHistory = gd.activityHistory.slice(0, 1000);

    _save();
    console.log('[Activity History]', entry.action, entry.type, entry.description, 'by', entry.user);
  };

  // ═══════════════════════════════════════════════
  // 3. CORE: restoreDeletedItem
  // ═══════════════════════════════════════════════
  window.restoreDeletedItem = function (id) {
    var gd = window.globalData;
    if (!gd) return;
    _ensureDeletedItems(gd);

    // Search across all categories
    var allItems = [].concat(
      gd.deletedItems.students || [],
      gd.deletedItems.finance || [],
      gd.deletedItems.employees || [],
      gd.deletedItems.other || []
    );
    var d = allItems.find(function (x) { return x.id === id; });
    if (!d) { console.warn('[RecycleFix] restoreDeletedItem: id not found', id); return; }

    var t = (d.type || '').toLowerCase();
    var item = d.item;
    delete item._trash_tmp_id;
    delete item._trash_moved; // ✅ FIX: clear flag so item can be re-deleted after restore

    // ═══════════════════════════════════════════════════
    // SPECIAL CASE: installment restore
    // ═══════════════════════════════════════════════════
    if (t === 'installment') {
      var studentName = item.studentName;
      var amount = parseFloat(item.amount) || 0;
      var method = item.method || 'Cash';
      var instDate = item.date || '';
      var batch = item.batch || '';

      var student = (gd.students || []).find(function (s) {
        return (s.name || '').trim().toLowerCase() === studentName.trim().toLowerCase();
      });

      if (!student) {
        if (typeof window.showErrorToast === 'function') window.showErrorToast('⚠️ Student "' + studentName + '" not found! Restore failed.');
        return;
      }

      // Add to student installments
      if (!Array.isArray(student.installments)) student.installments = [];
      student.installments.push({ amount: amount, date: instDate, method: method });

      // Update student paid/due
      student.paid = Math.round(((parseFloat(student.paid) || 0) + amount) * 100) / 100;
      student.due = Math.max(0, Math.round(((parseFloat(student.totalPayment) || 0) - student.paid) * 100) / 100);

      // Add to finance ledger
      if (!Array.isArray(gd.finance)) gd.finance = [];
      var dupExists = gd.finance.some(function (f) {
        return f.person === studentName && parseFloat(f.amount) === amount && f.date === instDate && (f.category === 'Student Installment' || f.category === 'Student Fee');
      });

      if (!dupExists) {
        gd.finance.push({
          id: Date.now(),
          type: 'Income',
          method: method,
          date: instDate || new Date().toISOString().split('T')[0],
          category: 'Student Installment',
          person: studentName,
          amount: amount,
          description: 'Installment payment for student: ' + studentName + ' | Batch: ' + batch,
          timestamp: new Date().toISOString()
        });
        if (typeof window.updateAccountBalance === 'function') {
          window.updateAccountBalance(method, amount, 'Income', true);
        }
      }

    } else if (t === 'student') {
      // ═══════════════════════════════════════════════════
      // SPECIAL CASE: Student Restore (Payments ও restore হবে)
      // ═══════════════════════════════════════════════════
      if (!Array.isArray(gd.students)) gd.students = [];

      // Check if student already exists
      var alreadyExists = gd.students.some(function (s) {
        return (s.id && s.id === item.id) || (s.studentId && s.studentId === item.studentId) || (s.name === item.name && s.phone === item.phone);
      });

      if (!alreadyExists) {
        gd.students.push(item);

        // ✅ Restore Payments (Finance Ledger + Account Balance)
        if (typeof window.getStudentInstallments === 'function') {
          var installments = window.getStudentInstallments(item);
          if (!Array.isArray(gd.finance)) gd.finance = [];

          installments.forEach(function (inst) {
            var amount = parseFloat(inst.amount) || 0;
            var method = inst.method || 'Cash';
            var date = inst.date || item.enrollDate || new Date().toISOString().split('T')[0];

            // Duplicate guard in finance ledger
            var financeExists = gd.finance.some(function (f) {
              return f.person === item.name && parseFloat(f.amount) === amount && f.date === date && (f.category === 'Student Installment' || f.category === 'Student Fee');
            });

            if (!financeExists) {
              gd.finance.push({
                id: Date.now() + Math.random(),
                type: 'Income',
                method: method,
                date: date,
                category: 'Student Installment',
                person: item.name,
                amount: amount,
                description: 'Restored installment for student: ' + item.name + ' | Batch: ' + (item.batch || ''),
                timestamp: new Date().toISOString()
              });

              // Un-reverse the payment (add back to account)
              if (typeof window.updateAccountBalance === 'function') {
                window.updateAccountBalance(method, amount, 'Income', true);
              }
            }
          });
        }

        if (typeof window.showSuccessToast === 'function') {
          window.showSuccessToast('✅ Student "' + item.name + '" ও পেমেন্ট হিস্ট্রি রিস্টোর করা হয়েছে');
        }
      }

    } else if (t === 'exam' || t === 'examregistration') {
      // ═══════════════════════════════════════════════════
      // SPECIAL CASE: Exam Registration Restore (Finance entry ও restore হবে)
      // ═══════════════════════════════════════════════════
      if (!Array.isArray(gd.examRegistrations)) gd.examRegistrations = [];

      var examExists = gd.examRegistrations.some(function (r) {
        return r.regId === item.regId;
      });

      if (!examExists) {
        gd.examRegistrations.push(item);

        // ✅ Restore Exam Fee to Finance Ledger
        if (item.examFee && item.paymentMethod) {
          if (!Array.isArray(gd.finance)) gd.finance = [];
          var feeExists = gd.finance.some(function (f) {
            return (f.note || f.description || '').includes('Reg: ' + item.regId);
          });

          if (!feeExists) {
            gd.finance.push({
              id: 'FIN-' + Date.now(),
              date: item.registrationDate || new Date().toISOString().split('T')[0],
              type: 'Income',
              category: 'Exam Fee',
              amount: parseFloat(item.examFee) || 0,
              method: item.paymentMethod,
              note: 'Exam Fee — ' + (item.studentName || '') + ' | ' + (item.subjectName || '') + ' | Reg: ' + item.regId,
              addedAt: new Date().toISOString()
            });

            // Account balance update
            if (typeof window.updateAccountBalance === 'function') {
              window.updateAccountBalance(item.paymentMethod, parseFloat(item.examFee) || 0, 'Income', true);
            }
          }
        }

        if (typeof window.showSuccessToast === 'function') {
          window.showSuccessToast('✅ Exam Registration "' + (item.studentName || item.regId) + '" ও Exam Fee রিস্টোর করা হয়েছে');
        }
      }

    } else if (t === 'keeprecord' || t === 'keep_record' || t === 'keep record') {
      try {
        var KEEP_KEY = 'wingsfly_keep_records';
        var existing = JSON.parse(localStorage.getItem(KEEP_KEY) || '[]');
        if (!existing.find(function(r) { return r.id === item.id; })) {
          existing.unshift(item);
          localStorage.setItem(KEEP_KEY, JSON.stringify(existing));
        }
        if (typeof window.showSuccessToast === 'function') {
          window.showSuccessToast('✅ ' + (item.title || 'Note') + ' রিস্টোর করা হয়েছে');
        }
      } catch (e) { console.warn('Keep record restore error:', e); }

    } else {
      // ───── GENERIC RESTORE ─────────────────
      var targetKey = {
        'student': 'students',
        'finance': 'finance',
        'employee': 'employees',
        'visitor': 'visitors',
        'notice': 'notices',
        'examregistration': 'examRegistrations',
        'exam': 'examRegistrations',
        'bankaccount': 'bankAccounts',
        'mobileaccount': 'mobileBanking',
        'breakdown': 'breakdownRecords',
        'loan': 'loans',
        'idcard': 'idCards',
        'salary_payment': 'finance'
      }[t];

      if (targetKey) {
        if (!Array.isArray(gd[targetKey])) gd[targetKey] = [];
        var alreadyExists = gd[targetKey].some(function (x) {
          return (x.id !== undefined && x.id === item.id) || (x._id !== undefined && x._id === item._id) || (x.rowIndex !== undefined && x.rowIndex === item.rowIndex);
        });

        if (!alreadyExists) {
          gd[targetKey].push(item);

          // Finance restore: account balance + linked student payment restore
          if (t === 'finance') {
            var amt = parseFloat(item.amount) || 0;
            if (typeof window.updateAccountBalance === 'function') {
              window.updateAccountBalance(item.method, amt, item.type, true);
            }

            // If this finance entry is a student payment, also restore student.paid/due + installments
            var isStudentPayment = (
              item.type === 'Income' &&
              (item.category === 'Student Fee' || item.category === 'Student Installment')
            );
            if (isStudentPayment && item.person && Array.isArray(gd.students)) {
              var sName = item.person.trim();
              var stu = gd.students.find(function (s) { return (s.name || '').trim() === sName; });
              if (stu) {
                var payDate = item.date || new Date().toISOString().split('T')[0];
                if (!Array.isArray(stu.installments)) stu.installments = [];

                // Duplicate guard
                var dupInst = stu.installments.some(function (inst) {
                  return (parseFloat(inst.amount) || 0) === amt && (inst.date || '') === payDate;
                });
                if (!dupInst) {
                  stu.installments.push({
                    amount: amt,
                    date: payDate,
                    method: item.method || 'Cash'
                  });
                }

                stu.paid = (parseFloat(stu.paid) || 0) + amt;
                stu.due = Math.max(0, (parseFloat(stu.totalPayment) || 0) - stu.paid);
              }
            }
          }
        }
      }
    }

    // Remove from Recycle Bin (search all categories)
    ['students','finance','employees','other'].forEach(function(cat) {
      if (Array.isArray(gd.deletedItems[cat])) {
        gd.deletedItems[cat] = gd.deletedItems[cat].filter(function(x) { return x.id !== id; });
      }
    });
    _save();

    // Log Activity
    var name = item.name || item.studentName || item.title || item.description || 'Item';
    window.logActivity(t, 'RESTORE', t + ' restored: ' + name, item);

    // Dynamic UI Refresh
    setTimeout(function () {
      if (typeof window.renderFullUI === 'function') window.renderFullUI();
      else if (typeof window.renderDashboard === 'function') window.renderDashboard();

      // Secondary refreshes
      if (typeof window.render === 'function') window.render(gd.students || []);
      if (typeof window.renderLedger === 'function') window.renderLedger(gd.finance || []);
      if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
      if (typeof window.renderAccountList === 'function') window.renderAccountList();
      if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
      if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
      if (typeof window.renderRecycleBin === 'function') window.renderRecycleBin();
    }, 100);

    if (typeof showSuccessToast === 'function') showSuccessToast('✅ ' + name + ' restored successfully!');

    // Sync to cloud
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Restore ' + t + ': ' + name);
    }
  };

  // ═══════════════════════════════════════════════
  // 4. CORE: permanentDelete
  // ═══════════════════════════════════════════════
  window.permanentDelete = function (id) {
    var gd = window.globalData;
    if (!gd) return;
    _ensureDeletedItems(gd);

    var allItems = [].concat(
      gd.deletedItems.students || [],
      gd.deletedItems.finance || [],
      gd.deletedItems.employees || [],
      gd.deletedItems.other || []
    );
    var d = allItems.find(function (x) { return x.id === id; });
    var name = d ? (d.item.name || d.item.studentName || d.item.title || d.item.description || 'Item') : 'Item';

    // Remove from all categories
    ['students','finance','employees','other'].forEach(function(cat) {
      if (Array.isArray(gd.deletedItems[cat])) {
        gd.deletedItems[cat] = gd.deletedItems[cat].filter(function(x) { return x.id !== id; });
      }
    });
    _save();

    // ✅ FIX: Cloud sync trigger
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Permanent Delete: ' + name);
    }

    if (d) window.logActivity(d.type, 'DELETE', d.type + ' permanently deleted: ' + name, {});

    if (typeof window.renderRecycleBin === 'function') setTimeout(window.renderRecycleBin, 100);
    if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ ' + name + ' চিরতরে মুছে ফেলা হয়েছে!');
    console.log('[RecycleFix] ✓ Permanently deleted:', name);
  };

  // ═══════════════════════════════════════════════
  // 5. PATCH: Keep Record Delete
  // keep-records.js এর deleteNote ঠিক করা
  // ═══════════════════════════════════════════════
  var _patchKeepRecord = function () {
    // Wrap existing deleteNote if it doesn't use moveToTrash
    var orig = window.deleteNote;
    if (typeof orig === 'function' && !orig._isRecyclePatched) {
      var patchFn = function (noteId) {
        var gd = window.globalData;
        if (!gd || !Array.isArray(gd.keepRecords)) { if (typeof orig === 'function') return orig(noteId); return; }

        var note = gd.keepRecords.find(function (n) { return n.id === noteId || n._id === noteId; });
        if (note) {
          if (!confirm('এই Note টি Recycle Bin-এ পাঠাবেন?')) return;
          // Move to trash FIRST
          window.moveToTrash('KeepRecord', note);
          // Remove from keepRecords
          gd.keepRecords = gd.keepRecords.filter(function (n) { return n.id !== noteId && n._id !== noteId; });
          _save();
          if (typeof window.renderKeepRecordNotes === 'function') window.renderKeepRecordNotes();
          if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Note Recycle Bin-এ গেছে');
        } else {
          if (typeof orig === 'function') orig(noteId);
        }
      };
      patchFn._isRecyclePatched = true;
      window.deleteNote = patchFn;
      console.log('[RecycleFix] ✓ deleteNote patched');
    } else if (typeof orig !== 'function') {
      // Define from scratch if missing
      window.deleteNote = function (noteId) {
        var gd = window.globalData;
        if (!gd || !Array.isArray(gd.keepRecords)) return;
        var note = gd.keepRecords.find(function (n) { return n.id === noteId || n._id === noteId; });
        if (!note) return;
        if (!confirm('এই Note টি Recycle Bin-এ পাঠাবেন?')) return;
        window.moveToTrash('KeepRecord', note);
        gd.keepRecords = gd.keepRecords.filter(function (n) { return n.id !== noteId && n._id !== noteId; });
        _save();
        if (typeof window.renderKeepRecordNotes === 'function') window.renderKeepRecordNotes();
        if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Note Recycle Bin-এ গেছে');
      };
      console.log('[RecycleFix] ✓ deleteNote created');
    }
  };

  // ═══════════════════════════════════════════════
  // 6. PATCH: Student Delete
  // ═══════════════════════════════════════════════
  var _patchStudentDelete = function () {
    var orig = window.deleteStudent;
    if (typeof orig !== 'function' || orig._isRecyclePatched) return;
    var patchFn = function (id) {
      var gd = window.globalData;
      if (!gd || !Array.isArray(gd.students)) { if (typeof orig === 'function') return orig(id); return; }

      // rowIndex, id, _id — যেকোনো একটা দিয়ে খোঁজো
      var student = gd.students.find(function (s) {
        return String(s.rowIndex) === String(id)
          || String(s.id) === String(id)
          || String(s._id) === String(id)
          || String(s.studentId) === String(id);
      });

      if (!student) {
        // patch 에 পেলাম না — original চালাও
        if (typeof orig === 'function') return orig(id);
        return;
      }

      if (!confirm('"' + student.name + '" কে Recycle Bin-এ পাঠাবেন?')) return;

      // CRITICAL: Reverse all account balances from this student's payments
      if (typeof window.getStudentInstallments === 'function') {
        const allPayments = window.getStudentInstallments(student);
        if (allPayments.length > 0) {
          allPayments.forEach(function (inst) {
            const amount = parseFloat(inst.amount) || 0;
            const method = inst.method || 'Cash';
            if (typeof window.updateAccountBalance === 'function') {
              // Reverse the payment: deduct from account since it was income
              window.updateAccountBalance(method, amount, 'Income', false);
            }
          });
        }
      }

      // Delete related finance transactions
      if (gd.finance && Array.isArray(gd.finance)) {
        gd.finance = gd.finance.filter(function (f) {
          return !(f.person === student.name || (f.description && f.description.includes(student.name)));
        });
      }

      window.moveToTrash('Student', student);

      // rowIndex, id, _id সব দিয়ে filter করো
      gd.students = gd.students.filter(function (s) {
        return String(s.rowIndex) !== String(id)
          && String(s.id) !== String(id)
          && String(s._id) !== String(id)
          && String(s.studentId) !== String(id);
      });

      _save();

      if (typeof window.render === 'function') window.render(gd.students);
      if (typeof window.renderStudents === 'function') window.renderStudents();
      if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
      if (typeof window.renderAccountList === 'function') window.renderAccountList();
      if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
      if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ ' + student.name + ' Recycle Bin-এ গেছে (পেমেন্ট রিভার্স করা হয়েছে)');
      console.log('[RecycleFix] ✓ Student moved to trash:', student.name);
    };
    patchFn._isRecyclePatched = true;
    window.deleteStudent = patchFn;
    console.log('[RecycleFix] ✓ deleteStudent patched (rowIndex-aware & balance-correcting)');
  };

  // ═══════════════════════════════════════════════
  // 7. PATCH: Finance Delete
  // ═══════════════════════════════════════════════
  var _patchFinanceDelete = function () {
    var origDeleteTransaction = window.deleteTransaction;
    var origDeleteFinance = window.deleteFinance;

    var patchFn = function (id) {
      var gd = window.globalData;
      if (!gd || !Array.isArray(gd.finance)) {
        // fallback to original logic
        if (typeof origDeleteTransaction === 'function') return origDeleteTransaction(id);
        return;
      }

      var entry = gd.finance.find(function (f) {
        return String(f.id) === String(id) || String(f._id) === String(id);
      });

      if (!entry) {
        if (typeof origDeleteTransaction === 'function') return origDeleteTransaction(id);
        return;
      }

      if (!confirm('Transaction টি Recycle Bin-এ পাঠাবেন?')) return;

      // 1) First, move a copy to Recycle Bin (for restore)
      if (typeof window.moveToTrash === 'function') {
        window.moveToTrash('Finance', entry);
      }

      // 2) Then delegate the actual delete logic to original deleteTransaction
      //    This will handle: student.paid/due, installments, account balance, finance array, sync, UI.
      if (typeof origDeleteTransaction === 'function') {
        return origDeleteTransaction(id);
      }

      // Fallback: যদি কোনো কারণে origDeleteTransaction নাই থাকে, তখন কমপক্ষে
      // finance array থেকে সরিয়ে দাও এবং account balance reverse করো
      if (typeof window.updateAccountBalance === 'function') {
        window.updateAccountBalance(entry.method, parseFloat(entry.amount) || 0, entry.type, false);
      }
      gd.finance = gd.finance.filter(function (f) {
        return String(f.id) !== String(id) && String(f._id) !== String(id);
      });
      _save();
      if (typeof window.renderLedger === 'function') window.renderLedger(gd.finance || []);
      if (typeof window.renderAccountList === 'function') window.renderAccountList();
      if (typeof window.renderCashBalance === 'function') window.renderCashBalance();
      if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Transaction Recycle Bin-এ গেছে');
      console.log('[RecycleFix] ✓ Finance entry hard-deleted (fallback path):', entry.category, entry.amount);
    };

    window.deleteTransaction = patchFn;
    window.deleteFinance = patchFn;
    console.log('[RecycleFix] ✓ deleteTransaction/deleteFinance patched (trash-aware)');
  };

  // ═══════════════════════════════════════════════
  // 8. PATCH: Employee Delete
  // ═══════════════════════════════════════════════
  var _patchEmployeeDelete = function () {
    var orig = window.deleteEmployee;
    if (typeof orig !== 'function' || orig._isRecyclePatched) return;
    var patchFn = function (idOrIndex) {
      var gd = window.globalData;
      if (!gd || !Array.isArray(gd.employees)) return orig(idOrIndex);
      var emp;
      if (typeof idOrIndex === 'number' && idOrIndex < 1000) {
        emp = gd.employees[idOrIndex];
      } else {
        var sid = String(idOrIndex);
        emp = gd.employees.find(function (e) { return String(e.id) === sid || String(e._id) === sid; });
      }
      if (emp) {
        if (!confirm('এই Employee-কে Recycle Bin-এ পাঠাবেন?\n' + emp.name)) return;
        window.moveToTrash('Employee', emp);
      }
      return orig(idOrIndex);
    };
    patchFn._isRecyclePatched = true;
    window.deleteEmployee = patchFn;
  };

  // ═══════════════════════════════════════════════
  // 8.5 PATCH: Installment Delete
  // ═══════════════════════════════════════════════
  var _patchInstallmentDelete = function () {
    // Note: finance-crud.js already has moveToTrash inside deleteInstallment,
    // so we just provide the definition to satisfy the init() call.
    if (window.deleteInstallment && !window.deleteInstallment._isRecyclePatched) {
      // Logic is already correct in source, just marking it as patched
      window.deleteInstallment._isRecyclePatched = true;
      console.log('[RecycleFix] ✓ deleteInstallment confirmed (source-patched)');
    }
  };

  // ═══════════════════════════════════════════════
  // 9. PATCH: Visitor Delete
  // ═══════════════════════════════════════════════
  var _patchVisitorDelete = function () {
    var orig = window.deleteVisitor;
    if (typeof orig !== 'function' || orig._isRecyclePatched) return;
    var patchFn = function (idOrIndex) {
      var gd = window.globalData;
      if (!gd || !Array.isArray(gd.visitors)) return orig(idOrIndex);
      var v;
      if (typeof idOrIndex === 'number' && idOrIndex < 1000) {
        v = gd.visitors[idOrIndex];
      } else {
        var sid = String(idOrIndex);
        v = gd.visitors.find(function (x) { return String(x.id) === sid || String(x._id) === sid; });
      }
      if (v) {
        if (!confirm('এই Visitor টি Recycle Bin-এ পাঠাবেন?')) return;
        window.moveToTrash('Visitor', v);
      }
      return orig(idOrIndex);
    };
    patchFn._isRecyclePatched = true;
    window.deleteVisitor = patchFn;
  };

  // ═══════════════════════════════════════════════
  // 9b. PATCH: Exam Registration Delete
  // ═══════════════════════════════════════════════
  var _patchExamDelete = function () {
    var orig = window.deleteExamRegistration;
    window.deleteExamRegistration = function (id) {
      var gd = window.globalData;
      if (!gd || !Array.isArray(gd.examRegistrations)) {
        if (typeof orig === 'function') return orig(id);
        return;
      }
      var exam = gd.examRegistrations.find(function (e) {
        return String(e.id) === String(id) || String(e._id) === String(id) || String(e.regId) === String(id);
      });
      if (!exam) { if (typeof orig === 'function') return orig(id); return; }
      if (!confirm('Exam Registration টি Recycle Bin-এ পাঠাবেন?')) return;

      // Linked Finance entry ও Recycle Bin-এ পাঠাও
      if (exam.fee && Array.isArray(gd.finance)) {
        var examStudent = exam.studentName || exam.name || '';
        var examRegId = exam.regId || '';
        var examFee = parseFloat(exam.fee) || 0;
        var linkedFin = gd.finance.find(function (f) {
          return f.category === 'Exam Fee'
            && parseFloat(f.amount) === examFee
            && (f.person === examStudent || (f.description || '').includes(examRegId));
        });
        if (linkedFin) {
          if (typeof window.updateAccountBalance === 'function') {
            window.updateAccountBalance(linkedFin.method || 'Cash', examFee, 'Income', false);
          }
          window.moveToTrash('finance', linkedFin);
          gd.finance = gd.finance.filter(function (f) { return f.id !== linkedFin.id; });
        }
      }

      window.moveToTrash('ExamRegistration', exam);
      gd.examRegistrations = gd.examRegistrations.filter(function (e) {
        return String(e.id) !== String(id) && String(e._id) !== String(id) && String(e.regId) !== String(id);
      });
      _save();
      if (typeof window.renderExamRegistrations === 'function') window.renderExamRegistrations();
      if (typeof window.renderLedger === 'function') window.renderLedger(gd.finance || []);
      if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Exam Registration Recycle Bin-এ গেছে');
    };
    console.log('[RecycleFix] ✓ deleteExamRegistration patched');
  };

  // ═══════════════════════════════════════════════
  // 9c. PATCH: Notice Delete
  // ═══════════════════════════════════════════════
  var _patchNoticeDelete = function () {
    // notice-board.js এর deleteNotice() → activeNotice/banner clear করে
    // recycle-bin-fix এর deleteNotice → notices[] array items Recycle Bin এ পাঠায়
    // দুটো আলাদা — conflict এড়াতে আলাদা function নাম ব্যবহার করো

    var origDeleteNotice = window.deleteNotice;

    // deleteNoticeItem = notices[] থেকে Recycle Bin এ পাঠানো
    window.deleteNoticeItem = function (id) {
      var gd = window.globalData;
      var noticeArr = gd && (gd.notices || gd.noticeBoard);
      if (!gd || !Array.isArray(noticeArr)) {
        if (typeof origDeleteNotice === 'function') return origDeleteNotice(id);
        return;
      }
      var notice = noticeArr.find(function (n) { return String(n.id) === String(id) || String(n._id) === String(id); });
      if (!notice) { if (typeof origDeleteNotice === 'function') return origDeleteNotice(id); return; }
      if (!confirm('Notice টি Recycle Bin-এ পাঠাবেন?')) return;
      window.moveToTrash('Notice', notice);
      if (gd.notices) {
        gd.notices = gd.notices.filter(function (n) { return String(n.id) !== String(id) && String(n._id) !== String(id); });
      }
      if (gd.noticeBoard) {
        gd.noticeBoard = gd.noticeBoard.filter(function (n) { return String(n.id) !== String(id) && String(n._id) !== String(id); });
      }
      _save();
      if (typeof window.renderNoticeBoard === 'function') window.renderNoticeBoard();
      if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Notice Recycle Bin-এ গেছে');
    };

    // deleteNotice এর original (notice-board banner) কে preserve করো
    // শুধু যদি orig না থাকে তাহলে alias দাও
    if (typeof origDeleteNotice !== 'function') {
      window.deleteNotice = window.deleteNoticeItem;
    }
    // নাহলে origDeleteNotice (notice-board.js এর) ই থাকবে

    console.log('[RecycleFix] ✓ deleteNoticeItem created (notices[] → Recycle Bin, no conflict with notice-board.js)');
  };

  // ═══════════════════════════════════════════════
  // 10. Breakdown Records Support
  // (Keep Record-এর ভেতর breakdown হলে)
  // ═══════════════════════════════════════════════
  window.deleteBreakdownRecord = function (id) {
    var gd = window.globalData;
    if (!gd) return;
    if (!Array.isArray(gd.breakdownRecords)) gd.breakdownRecords = [];
    var rec = gd.breakdownRecords.find(function (r) { return String(r.id) === String(id); });
    if (!rec) return;
    if (!confirm('এই Record টি Recycle Bin-এ পাঠাবেন?')) return;
    window.moveToTrash('Breakdown', rec);
    gd.breakdownRecords = gd.breakdownRecords.filter(function (r) { return String(r.id) !== String(id); });
    _save();
    if (typeof window.renderBreakdownRecords === 'function') window.renderBreakdownRecords();
    if (typeof window.showSuccessToast === 'function') window.showSuccessToast('🗑️ Record Recycle Bin-এ গেছে');
  };

  // ═══════════════════════════════════════════════
  // 11. Recycle Bin Renderer (enhanced)
  // ═══════════════════════════════════════════════
  function renderRecycleBin() {
    var wrap = document.getElementById('recycleBinContainer');
    if (!wrap) return;

    var gd = window.globalData;
    if (!gd) { wrap.innerHTML = '<p style="color:#888;text-align:center;">Data লোড হয়নি।</p>'; return; }
    _ensureDeletedItems(gd);

    // Flatten all categories into single array for display
    var deleted = [].concat(
      gd.deletedItems.students || [],
      gd.deletedItems.finance || [],
      gd.deletedItems.employees || [],
      gd.deletedItems.other || []
    );
    // Sort by deletedAt desc
    deleted.sort(function(a, b) { return new Date(b.deletedAt) - new Date(a.deletedAt); });
    var fType = (document.getElementById('binFilterType') ? document.getElementById('binFilterType').value : 'all');
    var fSearch = (document.getElementById('binSearchInput') ? document.getElementById('binSearchInput').value.trim().toLowerCase() : '');

    var filtered = deleted.filter(function (d) {
      if (fType !== 'all' && (d.type || '').toLowerCase() !== fType.toLowerCase()) return false;
      if (fSearch) {
        var name = _binName(d).toLowerCase();
        var typeStr = (d.type || '').toLowerCase();
        if (!name.includes(fSearch) && !typeStr.includes(fSearch)) return false;
      }
      return true;
    });

    var icons = { student: '🎓', finance: '💰', employee: '👤', visitor: '👋', keeprecord: '📝', breakdown: '📊', notice: '📌', examregistration: '📋', exam: '📋' };

    var rows = '';
    if (filtered.length === 0) {
      rows = '<tr><td colspan="5"><div style="text-align:center;padding:40px;color:#604040;"><div style="font-size:2.5rem;margin-bottom:8px;">🗑️</div><p>Recycle Bin খালি।</p></div></td></tr>';
    } else {
      rows = filtered.map(function (d) {
        var dt = new Date(d.deletedAt);
        var dateStr = isNaN(dt) ? '—' : (typeof window.formatPrintDate === 'function' ? window.formatPrintDate(dt) : dt.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' }));
        var timeStr = isNaN(dt) ? '' : dt.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
        var tl = (d.type || '').toLowerCase();
        var icon = icons[tl] || '📄';
        var name = _binName(d);
        var safeId = d.id.replace(/'/g, "\\'");
        return '<tr>'
          + '<td style="font-size:1.1rem;text-align:center;">' + icon + '</td>'
          + '<td><span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:0.68rem;font-weight:700;background:rgba(255,100,100,0.12);color:#ff9090;border:1px solid rgba(255,100,100,0.25);text-transform:uppercase;">' + (d.type || '?') + '</span></td>'
          + '<td style="max-width:220px;"><div style="color:#fff;font-weight:500;">' + name + '</div>'
          + '<div style="font-size:0.71rem;color:#806060;">By: ' + (d.deletedBy || 'Admin') + '</div></td>'
          + '<td style="white-space:nowrap;font-size:0.75rem;color:#906060;">' + dateStr + '<br>' + timeStr + '</td>'
          + '<td><div style="display:flex;gap:5px;">'
          + '<button type="button" style="background:rgba(0,200,100,0.15);color:#00cc77;border:1px solid rgba(0,200,100,0.3);border-radius:6px;padding:3px 10px;font-size:0.72rem;cursor:pointer;white-space:nowrap;" onclick="event.stopPropagation();window.restoreDeletedItem(\'' + safeId + '\');setTimeout(window.renderRecycleBin||function(){},200);">↩️ Restore</button>'
          + '<button type="button" style="background:rgba(255,50,50,0.12);color:#ff5555;border:1px solid rgba(255,50,50,0.25);border-radius:6px;padding:3px 8px;font-size:0.72rem;cursor:pointer;" onclick="event.stopPropagation();window.permanentDelete(\'' + safeId + '\')">❌</button>'
          + '</div></td>'
          + '</tr>';
      }).join('');
    }

    // Stats
    var statTypes = ['student', 'finance', 'employee', 'visitor', 'keeprecord', 'breakdown'];
    var statHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<div style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.18);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#c08080;">মোট: <strong style="color:#ff8080;">' + filtered.length + '</strong></div>';

    statTypes.forEach(function (st) {
      var cnt = filtered.filter(function (d) { return (d.type || '').toLowerCase() === st; }).length;
      if (cnt > 0) {
        var ic = icons[st] || '📄';
        statHTML += '<div style="background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.18);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#c08080;">' + ic + ' <strong style="color:#ff8080;">' + cnt + '</strong></div>';
      }
    });
    statHTML += '</div>';

    // Search box
    var searchId = 'binSearchInput';
    var searchHTML = '';
    if (!document.getElementById(searchId)) {
      searchHTML = '<div style="margin-bottom:10px;"><input id="' + searchId + '" type="text" placeholder="🔍 Search deleted items..." style="background:rgba(10,5,5,0.9);border:1.5px solid rgba(255,80,80,0.3);color:#e8d0d0;border-radius:8px;padding:5px 10px;font-size:0.8rem;min-width:200px;outline:none;" oninput="window.renderRecycleBin&&window.renderRecycleBin()"></div>';
    }

    wrap.innerHTML = statHTML + searchHTML
      + '<div style="overflow-x:auto;border-radius:12px;border:1.5px solid rgba(255,68,68,0.2);background:rgba(10,5,5,0.5);">'
      + '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:500px;">'
      + '<thead><tr>'
      + '<th style="background:rgba(255,68,68,0.1);color:#ff8080;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(255,68,68,0.2);width:36px;">Icon</th>'
      + '<th style="background:rgba(255,68,68,0.1);color:#ff8080;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(255,68,68,0.2);">Type</th>'
      + '<th style="background:rgba(255,68,68,0.1);color:#ff8080;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(255,68,68,0.2);">Item</th>'
      + '<th style="background:rgba(255,68,68,0.1);color:#ff8080;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(255,68,68,0.2);">Deleted At</th>'
      + '<th style="background:rgba(255,68,68,0.1);color:#ff8080;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(255,68,68,0.2);">Actions</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  function _binName(d) {
    var t = (d.type || '').toLowerCase();
    if (!d.item) return '?';
    if (t === 'student') return d.item.name || d.item.studentName || 'Unknown Student';
    if (t === 'finance') return (d.item.description || d.item.category || 'Transaction') + ' — ৳' + (d.item.amount || 0);
    if (t === 'employee') return d.item.name || 'Unknown Employee';
    if (t === 'visitor') return d.item.name || d.item.visitorName || 'Unknown Visitor';
    if (t === 'keeprecord' || t === 'keep_record') return d.item.title || d.item.content || 'Note';
    if (t === 'breakdown') return d.item.title || d.item.name || 'Record';
    return d.item.title || d.item.name || d.item.description || JSON.stringify(d.item).substring(0, 50);
  }

  window.renderRecycleBin = renderRecycleBin;

  // ═══════════════════════════════════════════════
  // 12. Activity Log Renderer (enhanced)
  // ═══════════════════════════════════════════════
  function renderActivityLog() {
    var wrap = document.getElementById('activityLogContainer');
    if (!wrap) return;

    var gd = window.globalData;
    if (!gd) { wrap.innerHTML = '<p style="color:#888;text-align:center;">Data লোড হয়নি।</p>'; return; }
    if (!Array.isArray(gd.activityHistory)) {
      try {
        var bk = localStorage.getItem('wingsfly_activity_backup');
        gd.activityHistory = bk ? JSON.parse(bk) : [];
      } catch (e) { gd.activityHistory = []; }
    }

    var history = gd.activityHistory.slice();

    // Filters
    var fAction = (document.getElementById('logFilterType') ? document.getElementById('logFilterType').value : 'all');
    var fSearch = (document.getElementById('logSearch') ? document.getElementById('logSearch').value.trim().toLowerCase() : '');
    var fDateFrom = document.getElementById('logDateFrom') ? document.getElementById('logDateFrom').value : '';
    var fDateTo = document.getElementById('logDateTo') ? document.getElementById('logDateTo').value : '';

    var filtered = history.filter(function (h) {
      // ✅ V39.5: Hide auto-heal, system, autotest spam from Activity Log
      var typ = (h.type || '').toLowerCase();
      if (typ === 'heal' || typ === 'system' || typ === 'autotest') return false;
      if (fAction !== 'all' && h.action !== fAction) return false;
      if (fSearch && !((h.description || '') + (h.action || '') + (h.type || '')).toLowerCase().includes(fSearch)) return false;
      if (fDateFrom && new Date(h.timestamp) < new Date(fDateFrom)) return false;
      if (fDateTo && new Date(h.timestamp) > new Date(fDateTo + 'T23:59:59')) return false;
      return true;
    });

    var total = filtered.length;
    var addCnt = filtered.filter(function (h) { return h.action === 'ADD'; }).length;
    var editCnt = filtered.filter(function (h) { return h.action === 'EDIT'; }).length;
    var delCnt = filtered.filter(function (h) { return h.action === 'DELETE'; }).length;
    var resCnt = filtered.filter(function (h) { return h.action === 'RESTORE'; }).length;

    var badgeColors = {
      ADD: { bg: 'rgba(0,255,136,0.12)', color: '#00ff88', border: 'rgba(0,255,136,0.3)' },
      EDIT: { bg: 'rgba(0,217,255,0.12)', color: '#00d9ff', border: 'rgba(0,217,255,0.3)' },
      DELETE: { bg: 'rgba(255,60,80,0.12)', color: '#ff4455', border: 'rgba(255,60,80,0.3)' },
      LOGIN: { bg: 'rgba(181,55,242,0.15)', color: '#c060f0', border: 'rgba(181,55,242,0.3)' },
      LOGOUT: { bg: 'rgba(255,170,0,0.12)', color: '#ffaa00', border: 'rgba(255,170,0,0.3)' },
      PAYMENT: { bg: 'rgba(0,200,100,0.12)', color: '#00cc66', border: 'rgba(0,200,100,0.3)' },
      SETTINGS: { bg: 'rgba(100,120,255,0.12)', color: '#8090ff', border: 'rgba(100,120,255,0.3)' },
      RESTORE: { bg: 'rgba(0,255,200,0.12)', color: '#00ffc8', border: 'rgba(0,255,200,0.3)' },
      OTHER: { bg: 'rgba(120,120,120,0.12)', color: '#909090', border: 'rgba(120,120,120,0.3)' },
    };

    function badgeStyle(action) {
      var c = badgeColors[action] || badgeColors.OTHER;
      return 'display:inline-block;padding:2px 8px;border-radius:20px;font-size:0.68rem;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:' + c.bg + ';color:' + c.color + ';border:1px solid ' + c.border + ';';
    }

    var typeIcons = { student: '🎓', finance: '💰', employee: '👤', settings: '⚙️', login: '🔐', logout: '🔓', keeprecord: '📝', breakdown: '📊', visitor: '👋' };

    var rows = '';
    if (filtered.length === 0) {
      rows = '<tr><td colspan="5"><div style="text-align:center;padding:40px;color:#5080a0;"><div style="font-size:2.5rem;margin-bottom:8px;">📋</div><p>কোনো Activity পাওয়া যায়নি।</p></div></td></tr>';
    } else {
      rows = filtered.slice(0, 200).map(function (h) {
        var d = new Date(h.timestamp);
        var dateStr = isNaN(d) ? '—' : (typeof window.formatPrintDate === 'function' ? window.formatPrintDate(d) : d.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' }));
        var timeStr = isNaN(d) ? '' : d.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
        var tl = (h.type || '').toLowerCase();
        var icon = typeIcons[tl] || '📝';
        var validActions = ['ADD', 'EDIT', 'DELETE', 'LOGIN', 'LOGOUT', 'PAYMENT', 'SETTINGS', 'RESTORE'];
        var action = validActions.includes(h.action) ? h.action : 'OTHER';
        return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">'
          + '<td style="font-size:1.1rem;text-align:center;padding:9px 12px;">' + icon + '</td>'
          + '<td style="padding:9px 12px;"><span style="' + badgeStyle(action) + '">' + action + '</span></td>'
          + '<td style="padding:9px 12px;"><span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:5px;font-size:0.7rem;font-weight:600;background:rgba(255,255,255,0.05);color:#90aec8;border:1px solid rgba(255,255,255,0.1);">' + (h.type || '?') + '</span></td>'
          + '<td style="padding:9px 12px;color:#d0e8ff;"><div style="color:#ffffff;font-weight:500;">' + (h.description || '—') + '</div>'
          + '<div style="color:#6090b8;font-size:0.72rem;margin-top:2px;">👤 ' + (h.user || 'Admin') + '</div></td>'
          + '<td style="padding:9px 12px;white-space:nowrap;font-size:0.78rem;color:#5080a0;">' + dateStr + '<br>' + timeStr + '</td>'
          + '</tr>';
      }).join('');
    }

    wrap.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#90cce8;">মোট: <strong style="color:#00d9ff;">' + total + '</strong></div>'
      + '<div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#90cce8;">➕ <strong style="color:#00ff88;">' + addCnt + '</strong></div>'
      + '<div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#90cce8;">✏️ <strong style="color:#00d9ff;">' + editCnt + '</strong></div>'
      + '<div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#90cce8;">🗑️ <strong style="color:#ff4455;">' + delCnt + '</strong></div>'
      + '<div style="background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.2);border-radius:20px;padding:3px 12px;font-size:0.75rem;color:#90cce8;">♻️ <strong style="color:#00ffc8;">' + resCnt + '</strong></div>'
      + '</div>'
      + '<div style="overflow-x:auto;border-radius:12px;border:1.5px solid rgba(0,217,255,0.18);background:rgba(5,10,30,0.6);">'
      + '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:560px;">'
      + '<thead><tr>'
      + '<th style="background:rgba(0,217,255,0.1);color:#00d9ff;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(0,217,255,0.25);width:36px;">Icon</th>'
      + '<th style="background:rgba(0,217,255,0.1);color:#00d9ff;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(0,217,255,0.25);">Action</th>'
      + '<th style="background:rgba(0,217,255,0.1);color:#00d9ff;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(0,217,255,0.25);">Type</th>'
      + '<th style="background:rgba(0,217,255,0.1);color:#00d9ff;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(0,217,255,0.25);">Description</th>'
      + '<th style="background:rgba(0,217,255,0.1);color:#00d9ff;font-weight:600;padding:10px 12px;border-bottom:2px solid rgba(0,217,255,0.25);">Time</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  window.renderActivityLog = renderActivityLog;

  // ═══════════════════════════════════════════════
  // 13. Tab Switch Intercept (auto-render)
  // ═══════════════════════════════════════════════
  function _initTabIntercept() {
    var orig = window.switchSettingsTab;
    window.switchSettingsTab = function (tabId, btn) {
      if (typeof orig === 'function') orig(tabId, btn);
      if (tabId === 'tab-activitylog') setTimeout(renderActivityLog, 60);
      if (tabId === 'tab-recyclebin') setTimeout(renderRecycleBin, 60);
    };

    // Modal show এ render
    var modal = document.getElementById('settingsModal');
    if (modal) {
      modal.addEventListener('shown.bs.modal', function () {
        var active = modal.querySelector('.settings-tab-pane[style*="block"]');
        if (!active) return;
        if (active.id === 'tab-activitylog') renderActivityLog();
        if (active.id === 'tab-recyclebin') renderRecycleBin();
      });
    }

    // binFilterType dropdown bind
    var binFilter = document.getElementById('binFilterType');
    if (binFilter && !binFilter._wfRbBound) {
      binFilter._wfRbBound = true;
      binFilter.addEventListener('change', renderRecycleBin);
    }
  }

  // ═══════════════════════════════════════════════
  // 14. INIT — সব patch চালু করো
  // ═══════════════════════════════════════════════
  function init() {
    // Core function ensure
    var gd = window.globalData;
    if (gd) {
      _ensureDeletedItems(gd);
      if (!Array.isArray(gd.activityHistory)) gd.activityHistory = [];
      if (!Array.isArray(gd.keepRecords)) gd.keepRecords = [];
      if (!Array.isArray(gd.breakdownRecords)) gd.breakdownRecords = [];
    }

    _patchKeepRecord();
    _patchStudentDelete();
    _patchFinanceDelete();
    _patchInstallmentDelete(); // added
    _patchEmployeeDelete();
    _patchVisitorDelete();
    _patchExamDelete();
    _patchNoticeDelete();
    _initTabIntercept();

    // examRegistrations array ensure
    if (gd) {
      if (!Array.isArray(gd.examRegistrations)) gd.examRegistrations = [];
      if (!Array.isArray(gd.notices)) gd.notices = [];
    }

    console.log('[RecycleFix] ✅ All patches applied — Student/Finance/Employee/Visitor/Exam/Notice/KeepRecord/Breakdown → Recycle Bin ready');

    // ── Warning Modal "DELETE?" button intercept ────────────────────────
    // finance-helpers এর Warning Details modal এর DELETE? বাটন
    // সরাসরি delete না করে Recycle Bin এ পাঠাবে
    _patchWarningDeleteButtons();

  }


  // ═══════════════════════════════════════════════
  // 15. PATCH: Warning Modal "DELETE?" → Recycle Bin
  // ═══════════════════════════════════════════════



  // ═══════════════════════════════════════════════
  // 15. PATCH: Warning Modal "DELETE?" → Recycle Bin
  // ═══════════════════════════════════════════════
  function _patchWarningDeleteButtons() {
    // DOM event delegation — warningDetailsModal এর যেকোনো DELETE? button intercept
    document.addEventListener('click', function (e) {
      var btn = e.target.closest
        ? e.target.closest('[data-warning-delete],[data-orphan-delete],[onclick*="orphanDelete"],[onclick*="deleteOrphan"],[onclick*="warningDelete"]')
        : null;

      // Warning modal এর DELETE? button detect করো (text দিয়ে)
      if (!btn) {
        var el = e.target;
        if (el && el.tagName === 'BUTTON'
          && (el.textContent || '').trim().toLowerCase().includes('delete')
          && el.closest && el.closest('#warningDetailsModal,#warningModal,[id*="warning"]')) {
          btn = el;
        }
      }

      if (!btn) return;

      // Finance id খোঁজো — data-id বা data-finance-id
      var finId = btn.getAttribute('data-id')
        || btn.getAttribute('data-finance-id')
        || btn.getAttribute('data-fid');

      if (!finId) return; // id না পেলে original চলুক

      // আমাদের patchFn দিয়ে Recycle Bin এ পাঠাও
      e.preventDefault();
      e.stopPropagation();

      if (typeof window.deleteTransaction === 'function') {
        window.deleteTransaction(finId);
      }
    }, true); // capture phase — অন্য handler এর আগে

    console.log('[RecycleFix] ✓ Warning modal DELETE? button intercepted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 2.5s পরে আবার apply (other scripts override করলে)
  setTimeout(function () {
    _patchKeepRecord();
    _patchStudentDelete();
    _patchFinanceDelete();
    _patchInstallmentDelete(); // added
    _patchEmployeeDelete();
    _patchVisitorDelete();
    _patchExamDelete();
    _patchNoticeDelete();
    window.renderActivityLog = renderActivityLog;
    window.renderRecycleBin = renderRecycleBin;

    // Re-bind binFilterType
    var bf = document.getElementById('binFilterType');
    if (bf && !bf._wfRbBound) {
      bf._wfRbBound = true;
      bf.addEventListener('change', renderRecycleBin);
    }
    console.log('[RecycleFix] ✅ 2.5s re-patch done');
  }, 2500);

})();
