/**
 * ════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * PHASE 4: ADVANCED SECURITY MODULE
 * ════════════════════════════════════════════════════════════
 *
 * 🚦 Rate Limiter    — brute-force attack প্রতিরোধ
 * 🔒 Encrypted Backup — backup file encrypt করে export
 * 🛡️ Security Headers — XSS, CSRF, Clickjacking protection
 * 📊 Security Monitor — real-time threat detection
 *
 * Version: 1.0
 * Date: March 2026
 * ════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  if (window._advancedSecurityLoaded) {
    console.log('[AdvSecurity] Already loaded, skipping...');
    return;
  }
  window._advancedSecurityLoaded = true;

  // ══════════════════════════════════════════════════════════
  // 1. RATE LIMITER — Brute-force attack prevention
  // ══════════════════════════════════════════════════════════

  const RateLimiter = {
    _attempts: {},
    _blocked: {},

    // Configuration
    CONFIG: {
      LOGIN_MAX_ATTEMPTS: 5,     // 5 বার ভুল password
      LOGIN_LOCKOUT_MIN: 15,     // 15 মিনিট lock
      API_MAX_REQUESTS: 100,     // 100 requests per window
      API_WINDOW_MS: 60000,      // 1 মিনিট window
      PROGRESSIVE_LOCKOUT: true, // প্রতিবার lock বাড়বে
    },

    /**
     * Check if action is rate-limited
     * @param {string} key - unique key (e.g., 'login_admin', 'api_sync')
     * @param {number} maxAttempts - max allowed attempts
     * @param {number} windowMs - time window in ms
     * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
     */
    check: function (key, maxAttempts, windowMs) {
      var now = Date.now();

      // Check if blocked
      if (this._blocked[key] && this._blocked[key] > now) {
        var resetIn = Math.ceil((this._blocked[key] - now) / 1000);
        return { allowed: false, remaining: 0, resetIn: resetIn, blocked: true };
      }

      // Clean expired attempts
      if (!this._attempts[key]) this._attempts[key] = [];
      this._attempts[key] = this._attempts[key].filter(function (t) { return t > now - windowMs; });

      var count = this._attempts[key].length;
      var remaining = Math.max(0, maxAttempts - count);

      return { allowed: count < maxAttempts, remaining: remaining, resetIn: 0, blocked: false };
    },

    /**
     * Record an attempt
     */
    record: function (key) {
      if (!this._attempts[key]) this._attempts[key] = [];
      this._attempts[key].push(Date.now());
    },

    /**
     * Block a key for a duration
     */
    block: function (key, durationMs) {
      this._blocked[key] = Date.now() + durationMs;

      // Save to localStorage for persistence
      try {
        var blocks = JSON.parse(localStorage.getItem('wf_rate_blocks') || '{}');
        blocks[key] = this._blocked[key];
        localStorage.setItem('wf_rate_blocks', JSON.stringify(blocks));
      } catch (e) { }

      console.warn('[RateLimiter] 🔒 Blocked:', key, 'for', Math.round(durationMs / 60000), 'min');
    },

    /**
     * Reset rate limit for a key (on successful action)
     */
    reset: function (key) {
      delete this._attempts[key];
      delete this._blocked[key];

      try {
        var blocks = JSON.parse(localStorage.getItem('wf_rate_blocks') || '{}');
        delete blocks[key];
        localStorage.setItem('wf_rate_blocks', JSON.stringify(blocks));
      } catch (e) { }
    },

    /**
     * Check login rate limit
     */
    checkLogin: function (username) {
      var key = 'login_' + (username || 'unknown').toLowerCase();
      return this.check(key, this.CONFIG.LOGIN_MAX_ATTEMPTS, this.CONFIG.LOGIN_LOCKOUT_MIN * 60000);
    },

    /**
     * Record failed login and auto-block if needed
     */
    recordFailedLogin: function (username) {
      var key = 'login_' + (username || 'unknown').toLowerCase();
      this.record(key);

      var status = this.check(key, this.CONFIG.LOGIN_MAX_ATTEMPTS, this.CONFIG.LOGIN_LOCKOUT_MIN * 60000);

      if (!status.allowed) {
        // Progressive lockout: each subsequent block doubles the duration
        var failCount = this._getFailCount(key);
        var lockoutMs = this.CONFIG.LOGIN_LOCKOUT_MIN * 60000 * Math.pow(2, Math.min(failCount, 4));
        this.block(key, lockoutMs);
        this._incrementFailCount(key);

        if (typeof window.AuditLogger !== 'undefined') {
          window.AuditLogger.log('SECURITY', 'auth', '🔒 Account locked: ' + username + ' (' + Math.round(lockoutMs / 60000) + ' min)', {
            reason: 'Too many failed attempts',
            lockoutMinutes: Math.round(lockoutMs / 60000)
          });
        }
      }

      return status;
    },

    /**
     * Record successful login — reset rate limit
     */
    recordSuccessfulLogin: function (username) {
      var key = 'login_' + (username || 'unknown').toLowerCase();
      this.reset(key);
      this._resetFailCount(key);
    },

    _getFailCount: function (key) {
      return parseInt(localStorage.getItem('wf_rate_fails_' + key) || '0');
    },
    _incrementFailCount: function (key) {
      var c = this._getFailCount(key) + 1;
      localStorage.setItem('wf_rate_fails_' + key, c.toString());
    },
    _resetFailCount: function (key) {
      localStorage.removeItem('wf_rate_fails_' + key);
    },

    // Load persisted blocks on startup
    _loadBlocks: function () {
      try {
        var blocks = JSON.parse(localStorage.getItem('wf_rate_blocks') || '{}');
        var now = Date.now();
        for (var key in blocks) {
          if (blocks[key] > now) {
            this._blocked[key] = blocks[key];
          }
        }
      } catch (e) { }
    }
  };

  // Load persisted blocks
  RateLimiter._loadBlocks();
  window.RateLimiter = RateLimiter;

  // ══════════════════════════════════════════════════════════
  // 2. ENCRYPTED BACKUP — Backup file with password protection
  // ══════════════════════════════════════════════════════════

  const SecureBackup = {

    /**
     * Export encrypted backup
     * @param {string} password - password for encryption
     */
    exportEncrypted: async function (password) {
      if (!password || password.length < 6) {
        alert('Password কমপক্ষে ৬ অক্ষর হতে হবে!');
        return;
      }

      try {
        var gd = window.globalData;
        if (!gd) { alert('Data নেই!'); return; }

        // Prepare backup data
        var backup = {
          _encrypted: true,
          _version: '1.0',
          _date: new Date().toISOString(),
          _app: 'Wings Fly Aviation Academy',
          students: gd.students || [],
          finance: gd.finance || [],
          employees: gd.employees || [],
          cashBalance: gd.cashBalance || 0,
          bankAccounts: gd.bankAccounts || [],
          mobileBanking: gd.mobileBanking || [],
          users: gd.users || [],
          settings: gd.settings || {},
          examRegistrations: gd.examRegistrations || [],
          visitors: gd.visitors || [],
          keepRecords: gd.keepRecords || [],
          deletedItems: gd.deletedItems || [],
          activityHistory: gd.activityHistory || [],
        };

        var plaintext = JSON.stringify(backup);

        // Derive key from password using PBKDF2
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);

        var salt = crypto.getRandomValues(new Uint8Array(16));
        var key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt']
        );

        var iv = crypto.getRandomValues(new Uint8Array(12));
        var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plaintext));

        // Package: salt(16) + iv(12) + ciphertext
        var package_ = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        package_.set(salt, 0);
        package_.set(iv, salt.length);
        package_.set(new Uint8Array(encrypted), salt.length + iv.length);

        // Chunked base64 encoding (avoids stack overflow on large data)
        var chunks = [];
        var chunkSize = 8192;
        for (var i = 0; i < package_.length; i += chunkSize) {
          var slice = package_.subarray(i, Math.min(i + chunkSize, package_.length));
          chunks.push(String.fromCharCode.apply(null, slice));
        }
        var b64 = btoa(chunks.join(''));

        var output = JSON.stringify({
          _format: 'WingsFly_Encrypted_Backup',
          _version: '1.0',
          _date: new Date().toISOString(),
          _note: 'This backup is encrypted. Use the same password to restore.',
          data: b64
        }, null, 2);

        // Download
        var blob = new Blob([output], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'WingsFly_SecureBackup_' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(a.href);

        if (typeof window.AuditLogger !== 'undefined') {
          window.AuditLogger.log('EXPORT', 'system', '🔒 Encrypted backup exported');
        }
        if (typeof window.showSuccessToast === 'function') {
          window.showSuccessToast('🔒 Encrypted backup ডাউনলোড হয়েছে!');
        }

        console.log('[SecureBackup] ✅ Encrypted backup exported');
      } catch (e) {
        console.error('[SecureBackup] Export failed:', e);
        alert('Backup export ব্যর্থ: ' + e.message);
      }
    },

    /**
     * Import encrypted backup
     * @param {File} file - backup file
     * @param {string} password - decryption password
     */
    importEncrypted: async function (file, password) {
      if (!file || !password) {
        alert('File এবং password দিন!');
        return null;
      }

      try {
        var text = await file.text();
        var pkg = JSON.parse(text);

        if (pkg._format !== 'WingsFly_Encrypted_Backup') {
          alert('এটি encrypted backup file নয়!');
          return null;
        }

        var raw = Uint8Array.from(atob(pkg.data), function (c) { return c.charCodeAt(0); });
        var salt = raw.slice(0, 16);
        var iv = raw.slice(16, 28);
        var ciphertext = raw.slice(28);

        // Derive key from password
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
        var key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
        var plaintext = new TextDecoder().decode(decrypted);
        var backup = JSON.parse(plaintext);

        if (typeof window.AuditLogger !== 'undefined') {
          window.AuditLogger.log('IMPORT', 'system', '🔓 Encrypted backup restored', { date: pkg._date });
        }

        console.log('[SecureBackup] ✅ Decrypted backup:', backup.students?.length, 'students,', backup.finance?.length, 'finance');
        return backup;
      } catch (e) {
        console.error('[SecureBackup] Import failed:', e);
        if (e.name === 'OperationError') {
          alert('❌ ভুল password! আবার চেষ্টা করুন।');
        } else {
          alert('Import ব্যর্থ: ' + e.message);
        }
        return null;
      }
    }
  };

  window.SecureBackup = SecureBackup;

  // ══════════════════════════════════════════════════════════
  // 3. SECURITY HEADERS & XSS / CSRF PROTECTION
  // ══════════════════════════════════════════════════════════

  const SecurityShield = {

    // Initialize all protections
    init: function () {
      this._setupCSP();
      this._preventClickjacking();
      this._sanitizeInputs();
      this._monitorDOM();
      this._setupCSRFToken();
    },

    // Content Security Policy (meta tag based)
    _setupCSP: function () {
      // Check if CSP already exists
      if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;

      // Note: Meta-based CSP is limited but better than nothing
      // Full CSP should be set via server headers
      console.log('[SecurityShield] ℹ️ CSP should be configured at server level for full protection');
    },

    // Prevent clickjacking
    _preventClickjacking: function () {
      if (window.top !== window.self) {
        // We're in an iframe! Possible clickjacking
        console.warn('[SecurityShield] ⚠️ App loaded in iframe! Possible clickjacking.');

        if (typeof window.AuditLogger !== 'undefined') {
          window.AuditLogger.log('SECURITY', 'system', '⚠️ Clickjacking attempt detected — app in iframe');
        }

        // Try to break out of iframe
        try { window.top.location = window.self.location; } catch (e) {
          // If cross-origin, we can't break out — hide content
          document.body.style.display = 'none';
          console.error('[SecurityShield] 🚨 Cross-origin iframe detected! Content hidden.');
        }
      }
    },

    // Auto-sanitize inputs on submission
    _sanitizeInputs: function () {
      document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;

        var inputs = form.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(function (input) {
          if (input.value && /<script|javascript:|on\w+=/i.test(input.value)) {
            console.warn('[SecurityShield] 🚨 XSS attempt blocked in:', input.name || input.id);
            input.value = input.value
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');

            if (typeof window.AuditLogger !== 'undefined') {
              window.AuditLogger.log('SECURITY', 'system', '🚨 XSS attempt blocked', {
                field: input.name || input.id, value: input.value.substring(0, 50)
              });
            }
          }
        });
      }, true);
    },

    // Monitor DOM for suspicious injections
    _monitorDOM: function () {
      if (!window.MutationObserver) return;

      var _scriptCount = document.querySelectorAll('script').length;

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.tagName === 'SCRIPT' && node.src && !node.src.includes(location.hostname)) {
              console.error('[SecurityShield] 🚨 External script injection detected!', node.src);

              if (typeof window.AuditLogger !== 'undefined') {
                window.AuditLogger.log('SECURITY', 'system', '🚨 Suspicious script injection!', { src: node.src });
              }
            }

            // Check for inline event handlers in dynamically added elements
            if (node.nodeType === 1) {
              var attrs = node.attributes || [];
              for (var i = 0; i < attrs.length; i++) {
                if (/^on/i.test(attrs[i].name) && /<script|javascript:/i.test(attrs[i].value)) {
                  console.warn('[SecurityShield] ⚠️ Suspicious inline handler:', attrs[i].name);
                }
              }
            }
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      console.log('[SecurityShield] ✅ DOM mutation monitor active');
    },

    // CSRF Token generation
    _setupCSRFToken: function () {
      if (window._csrfToken) return;

      var arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      window._csrfToken = Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      sessionStorage.setItem('wf_csrf_token', window._csrfToken);

      console.log('[SecurityShield] ✅ CSRF token generated');
    },

    // Verify CSRF token
    verifyCSRF: function (token) {
      return token === window._csrfToken;
    }
  };

  window.SecurityShield = SecurityShield;

  // ══════════════════════════════════════════════════════════
  // 4. SECURITY MONITOR — Real-time threat detection
  // ══════════════════════════════════════════════════════════

  const SecurityMonitor = {

    _events: [],

    // Log a security event
    logEvent: function (severity, message, data) {
      var event = {
        id: 'SEC_' + Date.now(),
        severity: severity, // 'low', 'medium', 'high', 'critical'
        message: message,
        data: data || null,
        timestamp: new Date().toISOString()
      };

      this._events.unshift(event);
      if (this._events.length > 500) this._events = this._events.slice(0, 500);

      // Save to localStorage
      try {
        localStorage.setItem('wf_security_events', JSON.stringify(this._events.slice(0, 100)));
      } catch (e) { }

      var colors = { low: '#00ff88', medium: '#ffcc00', high: '#ff9933', critical: '#ff4466' };
      console.log('%c[Security] ' + severity.toUpperCase() + ': ' + message,
        'color:' + (colors[severity] || '#888'));

      // Critical events: show user notification
      if (severity === 'critical' || severity === 'high') {
        if (typeof window.showErrorToast === 'function') {
          window.showErrorToast('🚨 Security: ' + message);
        }
      }

      return event;
    },

    // Get security report
    getReport: function () {
      var report = {
        totalEvents: this._events.length,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        recentThreats: [],
        rateLimit: {
          activeBlocks: Object.keys(RateLimiter._blocked).filter(function (k) {
            return RateLimiter._blocked[k] > Date.now();
          })
        }
      };

      this._events.forEach(function (e) {
        report.bySeverity[e.severity] = (report.bySeverity[e.severity] || 0) + 1;
      });

      report.recentThreats = this._events.filter(function (e) {
        return e.severity === 'high' || e.severity === 'critical';
      }).slice(0, 10);

      return report;
    },

    // Security score calculation
    getSecurityScore: function () {
      var score = 100;
      var details = [];

      // Check password hashing
      if (typeof window.hashPasswordPBKDF2 === 'function') {
        details.push({ item: 'PBKDF2 Password Hashing', status: 'pass', points: 0 });
      } else {
        score -= 15;
        details.push({ item: 'PBKDF2 Password Hashing', status: 'fail', points: -15 });
      }

      // Check RLS/Auth
      if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.KEY) {
        var isAnon = window.SUPABASE_CONFIG.KEY.includes('"role":"anon"') ||
          window.SUPABASE_CONFIG.KEY.includes('anon');
        if (isAnon) {
          details.push({ item: 'Anon Key (not service role)', status: 'pass', points: 0 });
        } else {
          score -= 25;
          details.push({ item: 'Service Role Key exposed!', status: 'fail', points: -25 });
        }
      }

      // Check Data Protection
      if (window.DataValidator) {
        details.push({ item: 'Data Validator active', status: 'pass', points: 0 });
      } else {
        score -= 10;
        details.push({ item: 'Data Validator missing', status: 'fail', points: -10 });
      }

      // Check Audit Logger
      if (window.AuditLogger) {
        details.push({ item: 'Audit Logger active', status: 'pass', points: 0 });
      } else {
        score -= 10;
        details.push({ item: 'Audit Logger missing', status: 'fail', points: -10 });
      }

      // Check Rate Limiter
      if (window.RateLimiter) {
        details.push({ item: 'Rate Limiter active', status: 'pass', points: 0 });
      } else {
        score -= 10;
        details.push({ item: 'Rate Limiter missing', status: 'fail', points: -10 });
      }

      // Check Encrypted Backup
      if (window.SecureBackup) {
        details.push({ item: 'Encrypted Backup available', status: 'pass', points: 0 });
      } else {
        score -= 5;
        details.push({ item: 'Encrypted Backup missing', status: 'fail', points: -5 });
      }

      // Check Session Management
      if (sessionStorage.getItem('loginTime') || sessionStorage.getItem('username')) {
        details.push({ item: 'Session Management', status: 'pass', points: 0 });
      }

      // Check CSRF Token
      if (window._csrfToken) {
        details.push({ item: 'CSRF Token', status: 'pass', points: 0 });
      } else {
        score -= 5;
        details.push({ item: 'CSRF Token missing', status: 'fail', points: -5 });
      }

      // Recent security events penalty
      var recentCritical = this._events.filter(function (e) {
        return (e.severity === 'critical' || e.severity === 'high') &&
          (Date.now() - new Date(e.timestamp).getTime()) < 3600000;
      }).length;

      if (recentCritical > 0) {
        score -= recentCritical * 5;
        details.push({ item: 'Recent threats (' + recentCritical + ')', status: 'warn', points: -(recentCritical * 5) });
      }

      return {
        score: Math.max(0, Math.min(100, score)),
        grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
        details: details
      };
    },

    // Load events from localStorage
    _load: function () {
      try {
        var raw = localStorage.getItem('wf_security_events');
        if (raw) this._events = JSON.parse(raw);
      } catch (e) { }
    }
  };

  SecurityMonitor._load();
  window.SecurityMonitor = SecurityMonitor;

  // ══════════════════════════════════════════════════════════
  // 5. PATCH LOGIN WITH RATE LIMITER
  // ══════════════════════════════════════════════════════════

  function _patchLoginRateLimit() {
    var orig = window.handleLogin;
    if (typeof orig !== 'function' || orig._rateLimitPatched) return;

    window.handleLogin = function () {
      var usernameEl = document.getElementById('username') || document.getElementById('loginUsername');
      var username = usernameEl ? usernameEl.value : 'unknown';

      // Check rate limit
      var status = RateLimiter.checkLogin(username);
      if (!status.allowed) {
        var msg = '🔒 Account locked! ' + status.resetIn + ' সেকেন্ড পর আবার চেষ্টা করুন।';
        if (typeof window.showErrorToast === 'function') {
          window.showErrorToast(msg);
        } else {
          alert(msg);
        }

        SecurityMonitor.logEvent('high', 'Login attempted during lockout: ' + username);
        return false;
      }

      // Add post-login hooks via a wrapper
      var result = orig.apply(this, arguments);

      // If the original returns a promise, hook into it
      if (result && typeof result.then === 'function') {
        result.then(function () {
          // Login succeeded
          RateLimiter.recordSuccessfulLogin(username);
          SecurityMonitor.logEvent('low', 'Successful login: ' + username);
        }).catch(function () {
          // Login failed
          var s = RateLimiter.recordFailedLogin(username);
          SecurityMonitor.logEvent('medium', 'Failed login: ' + username + ' (' + s.remaining + ' attempts left)');
        });
      }

      return result;
    };
    window.handleLogin._rateLimitPatched = true;
    console.log('[AdvSecurity] ✅ Login rate limiter patched');
  }

  // ══════════════════════════════════════════════════════════
  // 6. INITIALIZE
  // ══════════════════════════════════════════════════════════

  function _initAdvancedSecurity() {
    // Rate Limiter — already initialized above
    console.log('[AdvSecurity] ✅ RateLimiter ready');

    // Security Shield
    SecurityShield.init();
    console.log('[AdvSecurity] ✅ SecurityShield active (XSS/CSRF/Clickjacking)');

    // Login rate limit patch
    _patchLoginRateLimit();

    // Security score
    var secScore = SecurityMonitor.getSecurityScore();
    console.log('[AdvSecurity] 🛡️ Security Score:', secScore.score + '/100 (Grade: ' + secScore.grade + ')');

    // Log startup
    SecurityMonitor.logEvent('low', 'Advanced security initialized');

    if (typeof window.AuditLogger !== 'undefined') {
      window.AuditLogger.log('STARTUP', 'security', 'Phase 4: Advanced Security active — Score: ' + secScore.score);
    }

    console.log('');
    console.log('[AdvSecurity] ════════════════════════════════════════');
    console.log('[AdvSecurity] 🛡️ Phase 4: ADVANCED SECURITY ACTIVE');
    console.log('[AdvSecurity] ════════════════════════════════════════');
    console.log('[AdvSecurity] 🚦 RateLimiter — brute-force attack prevention');
    console.log('[AdvSecurity] 🔒 SecureBackup — encrypted backup export/import');
    console.log('[AdvSecurity] 🛡️ SecurityShield — XSS/CSRF/Clickjacking protection');
    console.log('[AdvSecurity] 📊 SecurityMonitor — threat detection + scoring');
    console.log('[AdvSecurity] ════════════════════════════════════════');
  }

  // Apply after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_initAdvancedSecurity, 2000); });
  } else {
    setTimeout(_initAdvancedSecurity, 2000);
  }

})();
