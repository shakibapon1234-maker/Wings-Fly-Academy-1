/* ============================================================
   Wings Fly Academy — SMS Notification Engine
   Feature 4 | sms-engine.js
   ------------------------------------------------------------
   Sends SMS via Green Web BD API (greenwebbd.com).
   Logs each SMS to `sms_logs` table via SupabaseSync (IDB + cloud).

   Settings stored in `settings` table → `sms_config` JSON column.
   Admin configures from Settings → SMS Notifications tab.

   TRIGGERS (called from respective modules):
     • SMSEngine.sendFeeDue(student)          ← students.js savePayment()
     • SMSEngine.sendAbsent(student, date)    ← attendance.js saveAllAttendance()
     • SMSEngine.sendResult(student, result)  ← exam.js saveResult
     • SMSEngine.sendPaymentApproved(req)     ← payment-engine.js approve()
     • SMSEngine.sendPaymentRejected(req)     ← payment-engine.js reject()
   ============================================================ */

const SMSEngine = (() => {
  'use strict';

  const LOG_TABLE = 'sms_logs';

  // ── Read config from settings table ───────────────────────

  function getConfig() {
    try {
      const rows = SupabaseSync.getAll('settings') || [];
      const row  = rows[0] || {};
      const raw  = row.sms_config;
      if (!raw) return _defaultConfig();
      const parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      return { ..._defaultConfig(), ...parsed };
    } catch { return _defaultConfig(); }
  }

  function _defaultConfig() {
    return {
      api_key:          '',
      sender_id:        'WFA',
      sms_enabled:      false,
      fee_due_sms:      true,
      result_sms:       true,
      absent_sms:       true,
      payment_sms:      true,
    };
  }

  function saveConfig(cfg) {
    try {
      const rows = SupabaseSync.getAll('settings') || [];
      const row  = rows[0];
      if (!row) { console.warn('[SMSEngine] No settings row found.'); return; }
      SupabaseSync.update('settings', row.id, { sms_config: JSON.stringify(cfg) }, { bypassLog: true });
      Utils.toast('SMS সেটিংস সেভ হয়েছে।', 'success');
    } catch (e) {
      Utils.toast('সেভ করতে সমস্যা: ' + (e.message || e), 'error');
    }
  }

  // ── Core send function ─────────────────────────────────────

  async function _send(phone, message, type) {
    const cfg = getConfig();

    // Always log attempt
    const logRecord = {
      id:                Utils.uuid(),
      recipient:         String(phone || ''),
      message:           String(message || ''),
      type:              String(type   || 'general'),
      status:            'pending',
      provider_response: '',
      sent_at:           new Date().toISOString(),
    };

    if (!cfg.sms_enabled) {
      logRecord.status           = 'skipped';
      logRecord.provider_response = 'SMS globally disabled';
      _log(logRecord);
      return { ok: false, reason: 'disabled' };
    }

    if (!cfg.api_key) {
      logRecord.status           = 'failed';
      logRecord.provider_response = 'API key not configured';
      _log(logRecord);
      console.warn('[SMSEngine] API key missing.');
      return { ok: false, reason: 'no_api_key' };
    }

    const cleanPhone = _normalizePhone(phone);
    if (!cleanPhone) {
      logRecord.status           = 'failed';
      logRecord.provider_response = 'Invalid phone number';
      _log(logRecord);
      return { ok: false, reason: 'invalid_phone' };
    }

    try {
      // Green Web BD API endpoint
      const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(cfg.api_key)}&to=${encodeURIComponent(cleanPhone)}&message=${encodeURIComponent(message)}&from=${encodeURIComponent(cfg.sender_id || 'WFA')}`;

      const resp = await fetch(url, { method: 'GET' });
      const text = await resp.text();

      const success = resp.ok && (text.includes('ok') || text.includes('1800') || resp.status === 200);
      logRecord.status            = success ? 'sent' : 'failed';
      logRecord.provider_response = text.slice(0, 500);
      _log(logRecord);
      if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity) {
        SupabaseSync.logActivity('system', 'sms',
          `SMS ${success ? 'পাঠানো হয়েছে' : 'পাঠাতে ব্যর্থ'} [${type}]: ${cleanPhone}${success ? '' : ' — ' + text.slice(0, 80)}`);
      }
      return { ok: success, response: text };
    } catch (e) {
      logRecord.status            = 'failed';
      logRecord.provider_response = e.message || String(e);
      _log(logRecord);
      return { ok: false, reason: e.message };
    }
  }

  function _log(record) {
    try {
      SupabaseSync.insert(LOG_TABLE, record, { bypassLog: true });
    } catch (e) {
      console.warn('[SMSEngine] Log error:', e);
    }
  }

  function _normalizePhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('880') && p.length === 13) return p;
    if (p.startsWith('0') && p.length === 11) return '880' + p.slice(1);
    if (p.length === 10) return '880' + p;
    return p.length >= 10 ? p : '';
  }

  // ── Trigger Functions ──────────────────────────────────────

  /**
   * Fee due reminder — call after a payment is saved and student still has due.
   * @param {Object} student — full student record
   */
  function sendFeeDue(student) {
    const cfg = getConfig();
    if (!cfg.fee_due_sms) return;
    const due = Utils.safeNum(student.due);
    if (due <= 0) return;
    const phone = student.phone || student.guardian_phone;
    if (!phone) return;
    const msg = `[Wings Fly Academy] প্রিয় ${student.name}, আপনার বকেয়া ফি ৳${Utils.formatMoneyPlain(due)} পরিশোধ করুন। ধন্যবাদ।`;
    _send(phone, msg, 'fee_due').catch(() => {});
  }

  /**
   * Absent notification — call for each absent student after attendance save.
   * @param {Object} attendanceRow — {entityName, entityId, batch, date}
   * @param {string} guardianPhone
   */
  function sendAbsent(attendanceRow, guardianPhone) {
    const cfg = getConfig();
    if (!cfg.absent_sms) return;
    if (!guardianPhone) return;
    const msg = `[Wings Fly Academy] ${attendanceRow.entityName || 'আপনার সন্তান'} ${attendanceRow.date} তারিখে ক্লাসে অনুপস্থিত ছিলেন।`;
    _send(guardianPhone, msg, 'absent').catch(() => {});
  }

  /**
   * Result notification — call after exam result is saved/updated.
   * @param {Object} student — {name, phone}
   * @param {Object} result  — {subject, grade, marks}
   */
  function sendResult(student, result) {
    const cfg = getConfig();
    if (!cfg.result_sms) return;
    const phone = student.phone || student.guardian_phone;
    if (!phone) return;
    const msg = `[Wings Fly Academy] ${student.name}-এর ফলাফল: ${result.subject || 'পরীক্ষা'} — গ্রেড: ${result.grade || '—'}, নম্বর: ${result.marks || '—'}। Wings Fly Academy।`;
    _send(phone, msg, 'result').catch(() => {});
  }

  /**
   * Payment approved notification.
   * @param {Object} req — payment_requests row
   */
  function sendPaymentApproved(req) {
    const cfg = getConfig();
    if (!cfg.payment_sms) return;
    const phone = req.sender_number || _getStudentPhone(req.student_id);
    if (!phone) return;
    const msg = `[Wings Fly Academy] প্রিয় ${req.student_name || 'Student'}, আপনার ৳${Utils.formatMoneyPlain(Utils.safeNum(req.amount))} পেমেন্ট (${req.method}, TxID: ${req.transaction_id}) অনুমোদিত হয়েছে। ধন্যবাদ।`;
    _send(phone, msg, 'payment_approved').catch(() => {});
  }

  /**
   * Payment rejected notification.
   * @param {Object} req  — payment_requests row
   * @param {string} note — rejection reason
   */
  function sendPaymentRejected(req, note) {
    const cfg = getConfig();
    if (!cfg.payment_sms) return;
    const phone = req.sender_number || _getStudentPhone(req.student_id);
    if (!phone) return;
    const msg = `[Wings Fly Academy] প্রিয় ${req.student_name || 'Student'}, আপনার ৳${Utils.formatMoneyPlain(Utils.safeNum(req.amount))} পেমেন্ট রিকোয়েস্ট প্রত্যাখ্যাত হয়েছে।${note ? ' কারণ: ' + note : ''} পুনরায় যোগাযোগ করুন।`;
    _send(phone, msg, 'payment_rejected').catch(() => {});
  }

  function _getStudentPhone(studentId) {
    try {
      const all = SupabaseSync.getAll('students') || [];
      const s = all.find(r => r.student_id === studentId || r.id === studentId);
      return s ? (s.phone || s.guardian_phone || '') : '';
    } catch { return ''; }
  }

  // ── SMS Log History (for admin view) ──────────────────────

  function getLogs() {
    try {
      return [...(SupabaseSync.getAll(LOG_TABLE) || [])].sort((a, b) =>
        (b.sent_at || '').localeCompare(a.sent_at || '')
      );
    } catch { return []; }
  }

  // ── Test SMS ───────────────────────────────────────────────

  async function sendTest(phone) {
    const result = await _send(phone, '[Wings Fly Academy] এটি একটি টেস্ট SMS। SMS সিস্টেম সক্রিয় আছে।', 'test');
    return result;
  }

  return {
    getConfig,
    saveConfig,
    sendFeeDue,
    sendAbsent,
    sendResult,
    sendPaymentApproved,
    sendPaymentRejected,
    sendTest,
    getLogs,
  };
})();

window.SMSEngine = SMSEngine;
