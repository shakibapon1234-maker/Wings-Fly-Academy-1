/**
 * ════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * PHASE 3: DATA PROTECTION MODULE
 * ════════════════════════════════════════════════════════════
 *
 * 🛡️ Data Validator — save করার আগে data validation
 * 📋 Audit Logger   — সব CRUD action log করা
 * 🔐 Data Encryption — sensitive field encrypt (optional)
 *
 * Version: 1.0
 * Date: March 2026
 * ════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // Prevent double-load
  if (window._dataProtectionLoaded) {
    console.log('[DataProtection] Already loaded, skipping...');
    return;
  }
  window._dataProtectionLoaded = true;

  // ══════════════════════════════════════════════════════════
  // 1. DATA VALIDATOR — save করার আগে data validate করো
  // ══════════════════════════════════════════════════════════

  const DataValidator = {

    // ── Student Validation ──
    validateStudent: function (student) {
      const errors = [];
      const warnings = [];

      if (!student) { errors.push('Student object নেই'); return { valid: false, errors, warnings }; }

      // Required fields
      if (!student.name || student.name.trim().length < 2) errors.push('নাম দিতে হবে (min 2 chars)');
      if (!student.phone || !/^01[3-9]\d{8}$/.test(student.phone.replace(/[\s-]/g, ''))) warnings.push('ফোন নম্বর সঠিক নয়');
      if (!student.course || student.course.trim().length < 2) errors.push('কোর্স সিলেক্ট করুন');
      if (!student.batch) warnings.push('ব্যাচ নম্বর দিন');

      // Numeric fields
      const totalPayment = parseFloat(student.totalPayment) || 0;
      const paid = parseFloat(student.paid) || 0;
      const due = parseFloat(student.due) || 0;

      if (totalPayment <= 0) errors.push('Total payment 0 হতে পারে না');
      if (paid < 0) errors.push('Paid নেগেটিভ হতে পারে না');
      if (due < 0) warnings.push('Due নেগেটিভ দেখাচ্ছে');
      if (paid > totalPayment * 1.5) warnings.push('Paid amount অস্বাভাবিক বেশি');

      // Date check
      if (student.enrollDate) {
        const d = new Date(student.enrollDate);
        if (isNaN(d.getTime())) warnings.push('Enroll date সঠিক নয়');
        else if (d > new Date()) warnings.push('Enroll date ভবিষ্যতে');
      }

      // XSS check
      const xssFields = ['name', 'course', 'remarks', 'fatherName', 'motherName'];
      xssFields.forEach(function (field) {
        if (student[field] && /<script|javascript:|on\w+=/i.test(student[field])) {
          errors.push(field + ' এ সন্দেহজনক content আছে (XSS)');
          student[field] = DataValidator.sanitize(student[field]);
        }
      });

      // Duplicate ID check
      if (student.studentId && window.globalData && Array.isArray(window.globalData.students)) {
        var dup = window.globalData.students.find(function (s) {
          return s.studentId === student.studentId && s !== student;
        });
        if (dup) errors.push('এই Student ID (' + student.studentId + ') ইতিমধ্যে আছে');
      }

      return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        sanitized: student
      };
    },

    // ── Finance Validation ──
    validateFinance: function (entry) {
      const errors = [];
      const warnings = [];

      if (!entry) { errors.push('Finance entry নেই'); return { valid: false, errors, warnings }; }

      if (!entry.type) errors.push('Transaction type সিলেক্ট করুন');
      if (!entry.amount || parseFloat(entry.amount) <= 0) errors.push('Amount 0 এর বেশি হতে হবে');
      if (!entry.method) errors.push('Payment method সিলেক্ট করুন');
      if (!entry.date) warnings.push('Date দিন');

      var amt = parseFloat(entry.amount) || 0;
      if (amt > 1000000) warnings.push('Amount অস্বাভাবিক বেশি (৳' + amt.toLocaleString() + ')');

      // Date validation
      if (entry.date) {
        var d = new Date(entry.date);
        if (isNaN(d.getTime())) errors.push('Date সঠিক নয়');
        var oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (d < oneYearAgo) warnings.push('Date 1 বছর আগে');
      }

      // XSS on text fields
      ['description', 'person', 'category'].forEach(function (field) {
        if (entry[field] && /<script|javascript:|on\w+=/i.test(entry[field])) {
          errors.push(field + ' এ সন্দেহজনক content');
          entry[field] = DataValidator.sanitize(entry[field]);
        }
      });

      return { valid: errors.length === 0, errors: errors, warnings: warnings };
    },

    // ── Employee Validation ──
    validateEmployee: function (emp) {
      const errors = [];
      const warnings = [];

      if (!emp) { errors.push('Employee data নেই'); return { valid: false, errors, warnings }; }

      if (!emp.name || emp.name.trim().length < 2) errors.push('Employee নাম দিন');
      if (!emp.role) warnings.push('Role assign করুন');
      if (!emp.phone) warnings.push('ফোন নম্বর দিন');
      if (!emp.salary || parseFloat(emp.salary) <= 0) warnings.push('Salary দিন');
      if (emp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email)) warnings.push('Email সঠিক নয়');

      return { valid: errors.length === 0, errors: errors, warnings: warnings };
    },

    // ── XSS Sanitizer ──
    sanitize: function (str) {
      if (!str || typeof str !== 'string') return str;
      return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // ── Bulk Data Integrity Check ──
    checkIntegrity: function () {
      var gd = window.globalData;
      if (!gd) return { ok: false, issues: ['globalData নেই'] };

      var issues = [];
      var fixed = 0;

      // Students integrity
      (gd.students || []).forEach(function (s, i) {
        if (!s.name) issues.push('Student #' + i + ': নাম নেই');
        if (!s.studentId) issues.push('Student #' + i + ' (' + (s.name || '?') + '): studentId নেই');

        // Fix due calculation
        var correctDue = Math.max(0, (parseFloat(s.totalPayment) || 0) - (parseFloat(s.paid) || 0));
        if (Math.abs(correctDue - (parseFloat(s.due) || 0)) > 1) {
          s.due = correctDue;
          fixed++;
        }
      });

      // Finance integrity
      (gd.finance || []).forEach(function (f, i) {
        if (!f.id) { f.id = Date.now() + i; fixed++; issues.push('Finance #' + i + ': id generate করা হয়েছে'); }
        if (!f.type) issues.push('Finance #' + i + ': type নেই');
        if (!f.amount) issues.push('Finance #' + i + ': amount নেই');
      });

      return {
        ok: issues.length === 0,
        issues: issues,
        fixed: fixed,
        summary: {
          students: (gd.students || []).length,
          finance: (gd.finance || []).length,
          employees: (gd.employees || []).length
        }
      };
    }
  };

  // Expose globally
  window.DataValidator = DataValidator;

  // ══════════════════════════════════════════════════════════
  // 2. AUDIT LOGGER — সব action log করো
  // ══════════════════════════════════════════════════════════

  const AUDIT_MAX_ENTRIES = 2000;
  const AUDIT_STORAGE_KEY = 'wf_audit_logs';

  const AuditLogger = {

    _logs: null,

    // Load logs from localStorage
    _load: function () {
      if (this._logs !== null) return;
      try {
        var raw = localStorage.getItem(AUDIT_STORAGE_KEY);
        this._logs = raw ? JSON.parse(raw) : [];
      } catch (e) {
        this._logs = [];
      }
    },

    // Save logs to localStorage
    _save: function () {
      try {
        // Trim to max entries
        if (this._logs.length > AUDIT_MAX_ENTRIES) {
          this._logs = this._logs.slice(0, AUDIT_MAX_ENTRIES);
        }
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this._logs));
      } catch (e) {
        console.error('[AuditLogger] Save failed:', e);
      }
    },

    /**
     * Log an action
     * @param {string} action - CREATE, UPDATE, DELETE, RESTORE, LOGIN, LOGOUT, EXPORT, IMPORT, SYNC, SETTINGS
     * @param {string} entity - student, finance, employee, system, auth
     * @param {string} detail - what happened
     * @param {object} [meta] - extra data (old/new values, IDs)
     */
    log: function (action, entity, detail, meta) {
      this._load();

      var entry = {
        id: 'AUD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        action: (action || 'OTHER').toUpperCase(),
        entity: (entity || 'unknown').toLowerCase(),
        detail: detail || '',
        user: sessionStorage.getItem('username') || localStorage.getItem('wf_user') || 'Admin',
        role: sessionStorage.getItem('userRole') || 'admin',
        timestamp: new Date().toISOString(),
        ip: null, // client-side, no IP available
        userAgent: navigator.userAgent.substring(0, 100),
        meta: meta || null
      };

      this._logs.unshift(entry);
      this._save();

      // Console log for debugging
      console.log('[Audit]', entry.action, entry.entity, entry.detail,
        'by', entry.user, 'at', new Date(entry.timestamp).toLocaleTimeString());

      return entry;
    },

    // Shortcut methods
    logCreate: function (entity, detail, meta) { return this.log('CREATE', entity, detail, meta); },
    logUpdate: function (entity, detail, meta) { return this.log('UPDATE', entity, detail, meta); },
    logDelete: function (entity, detail, meta) { return this.log('DELETE', entity, detail, meta); },
    logLogin: function (username, success) {
      return this.log('LOGIN', 'auth', (success ? '✅' : '❌') + ' Login: ' + username, { success: success });
    },
    logLogout: function (username) { return this.log('LOGOUT', 'auth', 'Logout: ' + username); },
    logExport: function (format) { return this.log('EXPORT', 'system', 'Data exported: ' + format); },
    logImport: function (detail) { return this.log('IMPORT', 'system', 'Data imported: ' + detail); },
    logSync: function (direction, result) {
      return this.log('SYNC', 'system', direction + ': ' + (result ? 'Success' : 'Failed'));
    },

    // Get all logs
    getAll: function () {
      this._load();
      return this._logs.slice();
    },

    // Get logs filtered
    getFiltered: function (options) {
      this._load();
      var logs = this._logs;

      if (options.action) logs = logs.filter(function (l) { return l.action === options.action.toUpperCase(); });
      if (options.entity) logs = logs.filter(function (l) { return l.entity === options.entity.toLowerCase(); });
      if (options.user) logs = logs.filter(function (l) { return l.user === options.user; });
      if (options.from) {
        var fromDate = new Date(options.from);
        logs = logs.filter(function (l) { return new Date(l.timestamp) >= fromDate; });
      }
      if (options.to) {
        var toDate = new Date(options.to);
        logs = logs.filter(function (l) { return new Date(l.timestamp) <= toDate; });
      }
      if (options.limit) logs = logs.slice(0, options.limit);

      return logs;
    },

    // Get statistics
    getStats: function () {
      this._load();
      var stats = { total: this._logs.length, byAction: {}, byEntity: {}, byUser: {} };

      this._logs.forEach(function (l) {
        stats.byAction[l.action] = (stats.byAction[l.action] || 0) + 1;
        stats.byEntity[l.entity] = (stats.byEntity[l.entity] || 0) + 1;
        stats.byUser[l.user] = (stats.byUser[l.user] || 0) + 1;
      });

      return stats;
    },

    // Clear old logs (keep last N days)
    clearOlderThan: function (days) {
      this._load();
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days || 30));
      var before = this._logs.length;
      this._logs = this._logs.filter(function (l) { return new Date(l.timestamp) >= cutoff; });
      this._save();
      var removed = before - this._logs.length;
      console.log('[AuditLogger] Cleared', removed, 'entries older than', days, 'days');
      return removed;
    },

    // Export as CSV
    exportCSV: function () {
      this._load();
      var header = 'ID,Action,Entity,Detail,User,Role,Timestamp\n';
      var rows = this._logs.map(function (l) {
        return [l.id, l.action, l.entity, '"' + (l.detail || '').replace(/"/g, '""') + '"',
          l.user, l.role, l.timestamp].join(',');
      }).join('\n');

      var blob = new Blob([header + rows], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'WingsFly_AuditLog_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  // Expose globally
  window.AuditLogger = AuditLogger;

  // ══════════════════════════════════════════════════════════
  // 3. DATA ENCRYPTION — Sensitive field encrypt (Optional)
  // ══════════════════════════════════════════════════════════

  const DataEncryption = {

    _key: null,

    // Generate/Load encryption key
    _getKey: async function () {
      if (this._key) return this._key;

      try {
        // Try to load from localStorage
        var stored = localStorage.getItem('wf_enc_key');
        if (stored) {
          var raw = Uint8Array.from(atob(stored), function (c) { return c.charCodeAt(0); });
          this._key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
          return this._key;
        }

        // Generate new key
        this._key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

        // Export and save
        var exported = await crypto.subtle.exportKey('raw', this._key);
        var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
        localStorage.setItem('wf_enc_key', b64);

        console.log('[Encryption] New key generated');
        return this._key;
      } catch (e) {
        console.error('[Encryption] Key error:', e);
        return null;
      }
    },

    // Encrypt a string
    encrypt: async function (plaintext) {
      try {
        var key = await this._getKey();
        if (!key) return plaintext;

        var iv = crypto.getRandomValues(new Uint8Array(12));
        var encoded = new TextEncoder().encode(plaintext);
        var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);

        // Combine IV + ciphertext = base64
        var combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return 'ENC:' + btoa(String.fromCharCode.apply(null, combined));
      } catch (e) {
        console.error('[Encryption] Encrypt failed:', e);
        return plaintext;
      }
    },

    // Decrypt a string
    decrypt: async function (ciphertext) {
      try {
        if (!ciphertext || !ciphertext.startsWith('ENC:')) return ciphertext;

        var key = await this._getKey();
        if (!key) return ciphertext;

        var data = Uint8Array.from(atob(ciphertext.substring(4)), function (c) { return c.charCodeAt(0); });
        var iv = data.slice(0, 12);
        var encrypted = data.slice(12);

        var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, encrypted);
        return new TextDecoder().decode(decrypted);
      } catch (e) {
        console.error('[Encryption] Decrypt failed:', e);
        return ciphertext;
      }
    },

    // Check if a value is encrypted
    isEncrypted: function (value) {
      return typeof value === 'string' && value.startsWith('ENC:');
    },

    // Encrypt sensitive fields of a student
    encryptStudent: async function (student) {
      if (!student) return student;
      var copy = Object.assign({}, student);

      // Sensitive fields to encrypt
      if (copy.phone && !this.isEncrypted(copy.phone)) copy.phone = await this.encrypt(copy.phone);
      if (copy.fatherName && !this.isEncrypted(copy.fatherName)) copy.fatherName = await this.encrypt(copy.fatherName);
      if (copy.motherName && !this.isEncrypted(copy.motherName)) copy.motherName = await this.encrypt(copy.motherName);

      return copy;
    },

    // Decrypt sensitive fields of a student
    decryptStudent: async function (student) {
      if (!student) return student;
      var copy = Object.assign({}, student);

      if (this.isEncrypted(copy.phone)) copy.phone = await this.decrypt(copy.phone);
      if (this.isEncrypted(copy.fatherName)) copy.fatherName = await this.decrypt(copy.fatherName);
      if (this.isEncrypted(copy.motherName)) copy.motherName = await this.decrypt(copy.motherName);

      return copy;
    }
  };

  // Expose globally
  window.DataEncryption = DataEncryption;

  // ══════════════════════════════════════════════════════════
  // 4. AUTO-PATCH: Existing functions-এ validation + audit যোগ করো
  // ══════════════════════════════════════════════════════════

  function _patchSaveStudent() {
    var orig = window.saveStudent;
    if (typeof orig !== 'function' || orig._dataProtectionPatched) return;

    window.saveStudent = function () {
      // Get student data from form
      var nameEl = document.getElementById('studentName');
      var phoneEl = document.getElementById('studentPhone');

      if (nameEl && phoneEl) {
        var testStudent = {
          name: nameEl.value,
          phone: phoneEl.value,
          course: (document.getElementById('studentCourse') || {}).value || '',
          totalPayment: parseFloat((document.getElementById('studentFee') || {}).value) || 0,
        };

        var result = DataValidator.validateStudent(testStudent);

        // Show warnings
        if (result.warnings.length > 0) {
          console.warn('[DataProtection] Student warnings:', result.warnings);
        }

        // Block if errors
        if (!result.valid) {
          if (typeof window.showErrorToast === 'function') {
            window.showErrorToast('⚠️ ' + result.errors.join(', '));
          } else {
            alert('Validation Error:\n' + result.errors.join('\n'));
          }
          console.error('[DataProtection] Student validation failed:', result.errors);
          return;
        }
      }

      // Audit log
      var isEdit = document.getElementById('editStudentIndex')?.value;
      AuditLogger.log(
        isEdit ? 'UPDATE' : 'CREATE',
        'student',
        (isEdit ? 'Updated' : 'Created') + ' student: ' + (nameEl?.value || 'Unknown')
      );

      // Call original
      return orig.apply(this, arguments);
    };
    window.saveStudent._dataProtectionPatched = true;
    console.log('[DataProtection] ✅ saveStudent patched with validation + audit');
  }

  function _patchDeleteStudent() {
    var orig = window.deleteStudent;
    if (typeof orig !== 'function' || orig._dataProtectionAuditPatched) return;

    var patchFn = function () {
      AuditLogger.logDelete('student', 'Student delete initiated');
      return orig.apply(this, arguments);
    };

    // Preserve existing patches
    patchFn._isRecyclePatched = orig._isRecyclePatched;
    patchFn._dataProtectionAuditPatched = true;
    window.deleteStudent = patchFn;
    console.log('[DataProtection] ✅ deleteStudent audit patched');
  }

  function _patchFinanceDelete() {
    var orig = window.deleteTransaction;
    if (typeof orig !== 'function' || orig._dataProtectionAuditPatched) return;

    var patchFn = function (id) {
      var gd = window.globalData;
      var entry = gd && gd.finance ? gd.finance.find(function (f) { return String(f.id) === String(id); }) : null;
      if (entry) {
        AuditLogger.logDelete('finance', 'Deleted: ' + (entry.category || entry.type) + ' ৳' + entry.amount, { id: id });
      }
      return orig.apply(this, arguments);
    };
    patchFn._dataProtectionAuditPatched = true;
    window.deleteTransaction = patchFn;
    console.log('[DataProtection] ✅ deleteTransaction audit patched');
  }

  function _patchLogin() {
    var orig = window.handleLogin;
    if (typeof orig !== 'function' || orig._dataProtectionAuditPatched) return;

    window.handleLogin = function () {
      var usernameEl = document.getElementById('username') || document.getElementById('loginUsername');
      var username = usernameEl ? usernameEl.value : 'unknown';

      // Log login attempt
      AuditLogger.log('LOGIN_ATTEMPT', 'auth', 'Login attempt: ' + username);

      var result = orig.apply(this, arguments);

      // If result is a promise, log after resolve
      if (result && typeof result.then === 'function') {
        result.then(function () {
          AuditLogger.logLogin(username, true);
        }).catch(function () {
          AuditLogger.logLogin(username, false);
        });
      }

      return result;
    };
    window.handleLogin._dataProtectionAuditPatched = true;
    console.log('[DataProtection] ✅ handleLogin audit patched');
  }

  function _patchLogout() {
    var orig = window.logout;
    if (typeof orig !== 'function' || orig._dataProtectionAuditPatched) return;

    window.logout = function () {
      var user = sessionStorage.getItem('username') || 'Admin';
      AuditLogger.logLogout(user);
      return orig.apply(this, arguments);
    };
    window.logout._dataProtectionAuditPatched = true;
    console.log('[DataProtection] ✅ logout audit patched');
  }

  function _patchExportImport() {
    var origExport = window.exportData;
    if (typeof origExport === 'function' && !origExport._dataProtectionAuditPatched) {
      window.exportData = function () {
        AuditLogger.logExport('JSON backup');
        return origExport.apply(this, arguments);
      };
      window.exportData._dataProtectionAuditPatched = true;
      console.log('[DataProtection] ✅ exportData audit patched');
    }

    var origImport = window.importData;
    if (typeof origImport === 'function' && !origImport._dataProtectionAuditPatched) {
      window.importData = function () {
        AuditLogger.logImport('JSON backup');
        return origImport.apply(this, arguments);
      };
      window.importData._dataProtectionAuditPatched = true;
      console.log('[DataProtection] ✅ importData audit patched');
    }
  }

  // ══════════════════════════════════════════════════════════
  // 5. INITIALIZE — Apply all patches
  // ══════════════════════════════════════════════════════════

  function _initDataProtection() {
    _patchSaveStudent();
    _patchDeleteStudent();
    _patchFinanceDelete();
    _patchLogin();
    _patchLogout();
    _patchExportImport();

    // Run initial integrity check
    var integrity = DataValidator.checkIntegrity();
    if (integrity.ok) {
      console.log('[DataProtection] ✅ Data integrity OK', integrity.summary);
    } else {
      console.warn('[DataProtection] ⚠️ Integrity issues:', integrity.issues.length);
      if (integrity.fixed > 0) {
        console.log('[DataProtection] 🔧 Auto-fixed:', integrity.fixed, 'issues');
      }
    }

    // Auto-clean old audit logs (30 days)
    AuditLogger.clearOlderThan(30);

    // Log startup
    AuditLogger.log('STARTUP', 'system', 'App started — Data Protection v1.0 active');

    console.log('[DataProtection] 🛡️ Phase 3: Data Protection active');
    console.log('[DataProtection] ✅ DataValidator ready');
    console.log('[DataProtection] ✅ AuditLogger ready (' + AuditLogger.getAll().length + ' logs)');
    console.log('[DataProtection] ✅ DataEncryption ready (optional)');
  }

  // Apply patches after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_initDataProtection, 1500); });
  } else {
    setTimeout(_initDataProtection, 1500);
  }

})();
