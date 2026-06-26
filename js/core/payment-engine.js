/* ============================================================
   Wings Fly Academy — Manual Payment System (bKash/Nagad/Bank)
   Feature 2 | payment-engine.js
   ------------------------------------------------------------
   Shared engine used by BOTH:
     1. Student Portal (student-portal.html → student-dashboard.js)
        — submits a payment_requests row directly via the
          standalone Supabase client (no local IDB on that page).
     2. Admin App (index.html → js/modules/payment-requests.js)
        — reads/approves/rejects via SupabaseSync (local IDB +
          cloud push), exactly like Students.savePayment().

   Settings (bKash/Nagad/Bank numbers + on/off toggle) are stored
   on the existing `settings` table under a single JSON column:
   `payment_gateway_config`. The admin UI for this lives inside
   the Payment Requests page itself — NOT inside settings.js.
   ============================================================ */

const PaymentEngine = (() => {
  'use strict';

  const TABLE = 'payment_requests';

  // ── Standalone Supabase client (used on student-portal.html,
  //    where SupabaseSync/IDB are not loaded) ──
  function _getStandaloneClient() {
    const creds = window.WFA_STANDALONE_SUPABASE;
    if (!creds || !creds.url || !creds.key) {
      console.error('[PaymentEngine] Supabase configuration not found.');
      return null;
    }
    if (!window.supabase) {
      console.error('[PaymentEngine] Supabase library not loaded.');
      return null;
    }
    return window.supabase.createClient(creds.url, creds.key);
  }

  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ══════════════════════════════════════════
     STUDENT SIDE — submit + own history
     (direct Supabase client — used from student-portal.html)
  ══════════════════════════════════════════ */

  // Optional screenshot upload. Best-effort — if the storage bucket
  // doesn't exist yet, we log a warning and continue WITHOUT a screenshot
  // rather than blocking the payment submission.
  async function _uploadScreenshot(sb, studentNo, file) {
    if (!file) return null;
    try {
      const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
      const path = `${studentNo || 'unknown'}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('payment-screenshots').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) {
        console.warn('[PaymentEngine] Screenshot upload failed (continuing without it):', upErr.message);
        return null;
      }
      const { data } = sb.storage.from('payment-screenshots').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (e) {
      console.warn('[PaymentEngine] Screenshot upload error (continuing without it):', e.message || e);
      return null;
    }
  }

  /**
   * Student submits a new manual payment request.
   * @param {Object} info { student_id, student_name, batch_id, amount, method, transaction_id, sender_number, note, screenshotFile }
   */
  async function submitRequest(info) {
    const sb = _getStandaloneClient();
    if (!sb) throw new Error('সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না।');

    const amount = parseFloat(info.amount);
    if (!amount || amount <= 0) throw new Error('সঠিক পরিমাণ লিখুন।');
    if (!info.method) throw new Error('পেমেন্ট মেথড নির্বাচন করুন।');
    if (!info.transaction_id || !String(info.transaction_id).trim()) {
      throw new Error('Transaction ID আবশ্যক।');
    }

    let screenshot_url = null;
    if (info.screenshotFile) {
      screenshot_url = await _uploadScreenshot(sb, info.student_id, info.screenshotFile);
    }

    const record = {
      student_id:     String(info.student_id),
      student_name:   info.student_name || '',
      batch_id:       info.batch_id || '',
      amount:         amount,
      method:         info.method,
      transaction_id: String(info.transaction_id).trim(),
      sender_number:  info.sender_number || '',
      screenshot_url: screenshot_url,
      status:         'pending',
      note:           info.note || '',
    };

    const { data, error } = await sb.from(TABLE).insert([record]).select().maybeSingle();
    if (error) {
      console.error('[PaymentEngine] submitRequest error:', error);
      throw new Error('পেমেন্ট রিকোয়েস্ট জমা দিতে ব্যর্থ: ' + (error.message || error));
    }
    return data || record;
  }

  /** Student's own payment request history (newest first). */
  async function getMyRequests(studentId) {
    const sb = _getStandaloneClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from(TABLE)
      .select('*')
      .eq('student_id', String(studentId))
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('[PaymentEngine] getMyRequests error:', error);
      return [];
    }
    return data || [];
  }

  /** Public read of payment gateway settings — used by student portal. */
  async function getPublicPaymentSettings() {
    const sb = _getStandaloneClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('settings')
      .select('payment_gateway_config')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[PaymentEngine] getPublicPaymentSettings error:', error.message || error);
      return null;
    }
    return (data && data.payment_gateway_config) || null;
  }

  /* ══════════════════════════════════════════
     ADMIN SIDE — list / approve / reject
     (uses SupabaseSync — local IDB + cloud push,
      same pattern as Students.savePayment())
  ══════════════════════════════════════════ */

  function getAllRequests() {
    if (typeof SupabaseSync === 'undefined') return [];
    const rows = SupabaseSync.getAll(TABLE) || [];
    return rows.slice().sort((a, b) => {
      const ta = new Date(a.submitted_at || a.created_at || 0).getTime();
      const tb = new Date(b.submitted_at || b.created_at || 0).getTime();
      return tb - ta;
    });
  }

  function getRequestsByStatus(status) {
    return getAllRequests().filter(r => (r.status || 'pending') === status);
  }

  /**
   * Approve a payment request:
   *  1. Mark payment_requests row approved.
   *  2. Mirror Students.savePayment(): bump student.paid/due,
   *     insert a finance_ledger "Student Fee" entry, update account balance.
   *  3. Log activity.
   */
  function approve(requestId, reviewerName) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') {
      throw new Error('Sync engine not loaded.');
    }
    const req = SupabaseSync.getById(TABLE, requestId);
    if (!req) throw new Error('Payment request not found.');
    if (req.status === 'approved') throw new Error('এই রিকোয়েস্ট আগেই Approve করা হয়েছে।');

    const amount = Utils.safeNum(req.amount);
    if (amount <= 0) throw new Error('Invalid amount on this request.');

    const student = SupabaseSync.getById(DB.students, req.student_id);

    if (student) {
      const newPaid = Utils.safeNum(student.paid) + amount;
      const newDue  = Math.max(0, Utils.safeNum(student.total_fee) - newPaid);
      SupabaseSync.update(DB.students, student.id, { paid: newPaid, due: newDue }, { bypassLog: true });

      SupabaseSync.insert(DB.finance, {
        type:        'Income',
        category:    'Student Fee',
        description: (student.name || req.student_name || 'Student') + ' (' + (student.student_id || req.student_id) + ') — bKash/Nagad/Bank Payment (Online)',
        amount:      amount,
        method:      req.method,
        date:        Utils.today(),
        note:        'Online payment request — TxID: ' + (req.transaction_id || '—'),
        ref_id:      student.id,
      }, { bypassLog: true });

      if (typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(req.method, amount, 'in');
      }
    } else {
      console.warn('[PaymentEngine] approve(): matching student not found for student_id =', req.student_id, '— fee record not auto-updated.');
    }

    SupabaseSync.update(TABLE, requestId, {
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerName || 'Admin',
    }, { bypassLog: true });

    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('payment', TABLE,
        'পেমেন্ট Approve: ' + (student?.name || req.student_name || req.student_id) + ' — ৳' + Utils.formatMoneyPlain(amount) + ' (' + req.method + ')');
    }
    // ── Feature 4: SMS — payment approved ──
    if (typeof SMSEngine !== 'undefined') SMSEngine.sendPaymentApproved(req);

    return true;
  }

  /** Reject a payment request with an optional reason. */
  function reject(requestId, reviewerName, note) {
    if (typeof SupabaseSync === 'undefined') throw new Error('Sync engine not loaded.');
    const req = SupabaseSync.getById(TABLE, requestId);
    if (!req) throw new Error('Payment request not found.');

    SupabaseSync.update(TABLE, requestId, {
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerName || 'Admin',
      note:        note || req.note || '',
    }, { bypassLog: true });

    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('delete', TABLE,
        'পেমেন্ট Reject: ' + (req.student_name || req.student_id) + ' — ৳' + Utils.formatMoneyPlain(Utils.safeNum(req.amount)) + (note ? ' — কারণ: ' + note : ''));
    }
    // ── Feature 4: SMS — payment rejected ──
    if (typeof SMSEngine !== 'undefined') SMSEngine.sendPaymentRejected(req, note);
    return true;
  }

  /* ── Admin: bKash/Nagad/Bank settings (stored on `settings` table) ── */

  function getSettingsRow() {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return null;
    const rows = SupabaseSync.getAll(DB.settings) || [];
    return rows[0] || null;
  }

  function getPaymentSettings() {
    const row = getSettingsRow();
    return (row && row.payment_gateway_config) || {
      bkash_number: '', nagad_number: '',
      bank_name: '', bank_account_name: '', bank_account_number: '', bank_branch: '',
      payment_enabled: true,
    };
  }

  function savePaymentSettings(config) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') {
      throw new Error('Sync engine not loaded.');
    }
    const row = getSettingsRow();
    if (row && row.id) {
      SupabaseSync.update(DB.settings, row.id, { payment_gateway_config: config }, { bypassLog: true });
    } else {
      SupabaseSync.insert(DB.settings, { payment_gateway_config: config }, { bypassLog: true });
    }
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('edit', 'settings', 'পেমেন্ট গেটওয়ে সেটিংস আপডেট করা হয়েছে (bKash/Nagad/Bank)');
    }
    return true;
  }

  return {
    // student side
    submitRequest, getMyRequests, getPublicPaymentSettings,
    // admin side
    getAllRequests, getRequestsByStatus, approve, reject,
    getPaymentSettings, savePaymentSettings,
    esc: _esc,
  };
})();

window.PaymentEngine = PaymentEngine;
