/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * SECTION LOADER — Modal Lazy Load System (V2-Robust)
 * File: sections/section-loader.js
 * ============================================================
 */

(function () {
  'use strict';

  const _loaded = new Set();
  const _loading = new Map(); // Track ongoing fetches

  async function loadAndOpen(placeholderId, htmlFile, modalId, onLoaded) {
    console.log('[SectionLoader] 📥 Attempting to load/open:', modalId, 'from', htmlFile);

    // If already loaded, just show it
    if (_loaded.has(modalId)) {
      console.log('[SectionLoader] 🟢 Already loaded, showing modal:', modalId);
      _showModal(modalId);
      if (typeof onLoaded === 'function') onLoaded();
      return;
    }

    // If already loading this file, wait for it
    if (_loading.has(htmlFile)) {
      console.log('[SectionLoader] ⏳ Already loading, waiting:', htmlFile);
      await _loading.get(htmlFile);
      _showModal(modalId);
      if (typeof onLoaded === 'function') onLoaded();
      return;
    }

    const loadPromise = (async () => {
      try {
        console.log('[SectionLoader] 📡 Fetching HTML:', htmlFile);
        // FIX: file:// protocol avoids query params that can block local fetches in some browsers
        const isFileProtocol = window.location.protocol === 'file:';
        const url = isFileProtocol ? htmlFile : htmlFile + '?v=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rawHtml = await res.text();

        const el = document.getElementById(placeholderId);
        if (!el) {
          console.error('[SectionLoader] ❌ Placeholder NOT FOUND in DOM:', placeholderId);
          alert('Error: Placeholder "' + placeholderId + '" missing! Check index.html');
          return;
        }

        // ✅ V2: Extract raw script contents BEFORE innerHTML parsing
        // innerHTML corrupts Unicode chars and special sequences inside <script> blocks
        const rawScripts = _extractRawScripts(rawHtml);

        // Strip <script> blocks from HTML before injecting into DOM
        // This prevents double-execution and avoids DOM textContent corruption
        const htmlWithoutScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

        // We append if it's the "__modalPlaceholderOther" to allow multiple modals to coexist
        if (placeholderId === '__modalPlaceholderOther') {
          const container = document.createElement('div');
          container.innerHTML = htmlWithoutScripts;
          el.appendChild(container);
        } else {
          el.innerHTML = htmlWithoutScripts;
        }

        // Execute scripts from RAW text (not from DOM)
        _execRawScripts(rawScripts);

        console.log('[SectionLoader] ✅ Injection complete for:', modalId);
        _loaded.add(modalId);

        if (typeof onLoaded === 'function') {
          try { onLoaded(); } catch (e) { console.error('[SectionLoader] onLoaded error:', e); }
        }

        // Small delay to ensure DOM is ready
        setTimeout(() => {
          console.log('[SectionLoader] 🚀 Showing modal now:', modalId);
          _showModal(modalId);
        }, 100);

      } catch (err) {
        console.error('[SectionLoader] ❌ Failed to load:', htmlFile, err);
        if (typeof window.showErrorToast === 'function') {
          window.showErrorToast('❌ Modal লোড ব্যর্থ: ' + err.message);
        } else {
          alert('Modal লোড ব্যর্থ: ' + err.message);
        }
      } finally {
        _loading.delete(htmlFile);
      }
    })();

    _loading.set(htmlFile, loadPromise);
    await loadPromise;
  }

  /**
   * ✅ V2-RAW: Extract inline script contents from raw HTML text using regex.
   * This bypasses innerHTML parsing entirely, preventing character corruption
   * of Unicode chars (Bengali ৳, −), template literals, and </script> strings.
   */
  function _extractRawScripts(rawHtml) {
    const scripts = [];
    // Match <script>...</script> blocks (no src attribute = inline)
    // Using a stateful approach to correctly handle </script> inside strings
    const regex = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
    let match;
    while ((match = regex.exec(rawHtml)) !== null) {
      const tag = match[0];
      // Skip external scripts (those with src="...")
      if (/\bsrc\s*=\s*["']/i.test(tag.substring(0, tag.indexOf('>')))) {
        continue;
      }
      // Extract content between <script...> and </script>
      const openEnd = tag.indexOf('>') + 1;
      const closeStart = tag.lastIndexOf('</script>');
      if (openEnd > 0 && closeStart > openEnd) {
        const code = tag.substring(openEnd, closeStart);
        if (code.trim()) {
          scripts.push(code);
        }
      }
    }
    return scripts;
  }

  /**
   * ✅ V2-RAW: Execute script contents extracted from raw HTML.
   * Uses Blob URL as primary method (isolates from DOM parser),
   * with document.head injection as fallback.
   */
  function _execRawScripts(scriptContents) {
    scriptContents.forEach(function (code, index) {
      function runViaHeadInline() {
        try {
          const newScript = document.createElement('script');
          newScript.textContent = code;
          document.head.appendChild(newScript);
          document.head.removeChild(newScript);
          console.log('[SectionLoader] ✅ Script #' + (index + 1) + ' executed via head injection');
        } catch (e2) {
          console.error('[SectionLoader] ❌ Script #' + (index + 1) + ' all methods failed:', e2);
        }
      }

      // Method 1: Blob URL (primary — best Unicode isolation). CSP must include script-src ... blob:
      // If the blob load fails (e.g. strict CSP), onerror runs Method 2 — do not mark "done" before load.
      try {
        const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const s = document.createElement('script');
        s.src = blobUrl;
        s.async = false; // preserve execution order
        s.onload = function () {
          URL.revokeObjectURL(blobUrl);
          console.log('[SectionLoader] ✅ Script #' + (index + 1) + ' executed via Blob URL');
        };
        s.onerror = function (e) {
          URL.revokeObjectURL(blobUrl);
          console.warn('[SectionLoader] ⚠️ Script #' + (index + 1) + ' blob blocked/failed, using inline fallback:', e);
          runViaHeadInline();
        };
        document.head.appendChild(s);
      } catch (e1) {
        console.warn('[SectionLoader] ⚠️ Blob URL setup failed for Script #' + (index + 1) + ':', e1.message);
        runViaHeadInline();
      }
    });
  }

  function _showModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) {
      console.warn('[SectionLoader] ⚠️ Modal element NOT FOUND in DOM after injection:', modalId);
      return;
    }
    try {
      if (typeof bootstrap === 'undefined') {
        console.error('[SectionLoader] ❌ Bootstrap is NOT LOADED!');
        alert('Fatal Error: Bootstrap is missing!');
        return;
      }
      const modal = bootstrap.Modal.getOrCreateInstance(el);
      modal.show();
    } catch (e) {
      console.error('[SectionLoader] ❌ Error showing modal:', e);
    }
  }

  // --- Patching Functions ---

  function _patchAll() {
    console.log('[SectionLoader] 🔄 Patching global functions...');

    // 0. Account Analytics & Details (Fixed Lazy Loading)
    window.showAccountAnalytics = function () {
      console.log('[UI] showAccountAnalytics called');

      function _runAnalytics() {
        // globalData fresh করো
        try {
          var raw = localStorage.getItem('wingsfly_data');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed) window.globalData = Object.assign(window.globalData || {}, parsed);
          }
        } catch(e) {}

        if (typeof window._showAccountAnalyticsImpl === 'function') {
          window._showAccountAnalyticsImpl();
          return;
        }

        // functions নেই — settings-modal.html থেকে শুধু script অংশটা inject করো
        console.log('[UI] Analytics functions missing, injecting from settings-modal...');
        // _loaded থেকে settingsModal সরিয়ে force re-load করো
        if (window.SectionLoader && typeof window.SectionLoader.clearCache === 'function') {
          window.SectionLoader.clearCache('settingsModal');
        } else {
          // Direct: _loaded Set clear করো
          _loaded.delete('settingsModal');
        }
        loadAndOpen('__modalPlaceholderSettings', 'sections/settings-modal.html', 'settingsModal', function () {
          setTimeout(function() {
            if (typeof window._showAccountAnalyticsImpl === 'function') {
              window._showAccountAnalyticsImpl();
            } else {
              console.error('[UI] _showAccountAnalyticsImpl still missing after reload');
              var modal = document.getElementById('accountAnalyticsModal');
              if (modal && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).show();
            }
          }, 200);
        });
      }

      // Modal DOM-এ আছে কিনা দেখো
      var modal = document.getElementById('accountAnalyticsModal');
      if (modal) {
        _runAnalytics();
      } else {
        // Modal নেই — settings-modal.html load হয়নি
        _loaded.delete('settingsModal');
        loadAndOpen('__modalPlaceholderSettings', 'sections/settings-modal.html', 'settingsModal', function () {
          setTimeout(_runAnalytics, 200);
        });
      }
    };

    window.showAccountDetails = function () {
      console.log('[UI] showAccountDetails wrapper called');
      // Hide settings if open (critical for UX)
      const settingsEl = document.getElementById('settingsModal');
      if (settingsEl && window.bootstrap) {
          const m = bootstrap.Modal.getInstance(settingsEl);
          if (m) {
              console.log('[UI] Hiding settingsModal');
              m.hide();
          }
      }
      // Ensure modals.html is loaded for Account Details
      loadAndOpen('__modalPlaceholderOther', 'sections/modals.html', 'accountDetailsModal', function () {
        if (typeof window.renderAccountDetails === 'function') {
          window.renderAccountDetails();
        }
      });
    };

    // 1. Settings
    window.openSettings = window.openSettingsModal = function () {
      loadAndOpen(
        '__modalPlaceholderSettings',
        'sections/settings-modal.html',
        'settingsModal',
        function () {
          function _tryScLoad(attempt) {
            if (typeof window.scLoad === 'function') {
              window.scLoad();
              // Re-init tabs
              if (typeof window.switchSettingsTab === 'function') {
                const activeBtn = document.querySelector('#settingsModal .nav-link.active') || document.querySelector('#settingsModal .nav-link');
                if (activeBtn) {
                  const match = (activeBtn.getAttribute('onclick') || '').match(/'([^']+)'/);
                  if (match) window.switchSettingsTab(match[1], activeBtn);
                }
              }
            } else if (attempt < 10) {
              setTimeout(function () { _tryScLoad(attempt + 1); }, 50);
            } else {
              console.warn('[SectionLoader] scLoad not found after retries');
            }
          }
          setTimeout(function () { _tryScLoad(0); }, 100);

          // ✅ FIX: Settings বন্ধ হলে Dashboard-এ যাও (একবারই attach করো)
          var settingsEl = document.getElementById('settingsModal');
          if (settingsEl && !settingsEl._wfDashboardRedirect) {
            settingsEl._wfDashboardRedirect = true;
            settingsEl.addEventListener('hidden.bs.modal', function () {
              if (typeof window.switchTab === 'function') {
                window.switchTab('dashboard');
              }
            });
          }
        }
      );
    };

    // 1b. Salary Modal
    var _salaryModalLoading = false;
    window.openSalaryModal = function (empId) {
      var modalId = 'salaryModal';
      // Already loaded — use impl directly
      if (document.getElementById(modalId) && window._openSalaryModalImpl) {
          window._openSalaryModalImpl(empId);
          return;
      }
      // Prevent double-load
      if (_salaryModalLoading) return;
      _salaryModalLoading = true;
      loadAndOpen('__modalPlaceholderOther', 'sections/salary-modal.html', modalId, function () {
          _salaryModalLoading = false;
          if (window._openSalaryModalImpl) {
              window._openSalaryModalImpl(empId);
          }
      });
    };

    // 2. Add Transaction / Finance
    window.openAddTransaction = window.openFinanceModal = function (type) {
      loadAndOpen('__modalPlaceholderOther', 'sections/modals.html', 'financeModal', function () {
        // ✅ FIX: Populate dropdowns (centralized in ledger-render.js)
        if (typeof window.populateDropdowns === 'function') {
          setTimeout(window.populateDropdowns, 100);
        }
        if (typeof window.updateFinanceCategoryOptions === 'function') {
          if (type) {
            const typeSelect = document.querySelector('#financeModal select[name="type"]');
            if (typeSelect) {
              typeSelect.value = type.charAt(0).toUpperCase() + type.slice(1);
              window.updateFinanceCategoryOptions();
            }
          } else {
            window.updateFinanceCategoryOptions();
          }
        }
        // ✅ Re-attach listener for subsequent opens
        const fm = document.getElementById('financeModal');
        if (fm && typeof window.populateDropdowns === 'function') {
          fm.addEventListener('show.bs.modal', window.populateDropdowns);
        }
      });
    };

    // 3. Add Student — modal is inline in index.html, no fetch needed
    window.openStudentModal = function () {
      var modal = document.getElementById('studentModal');
      if (!modal) { console.error('[SectionLoader] studentModal not found in DOM'); return; }
      // Reset form for new student
      var form = document.getElementById('studentForm');
      if (form) form.reset();
      var rowIdx = document.getElementById('studentRowIndex');
      if (rowIdx) rowIdx.value = '';
      var title = document.getElementById('studentModalLabel');
      if (title) title.textContent = '👨‍🎓 Add New Student';
      if (typeof window.populateDropdowns === 'function') setTimeout(window.populateDropdowns, 50);
      if (typeof window.removeStudentPhoto === 'function') window.removeStudentPhoto();
      
      // ✅ FIX: Reset Payment Method selection & remove old balance badge
      var methodSel = document.getElementById('studentMethodSelect');
      if (methodSel) {
          methodSel.value = "";
          var oldBadge = document.getElementById('studentMethodSelect_balanceBadge');
          if (oldBadge) oldBadge.remove();
          if (typeof window.showMethodBalance === 'function') window.showMethodBalance('studentMethodSelect');
      }

      // Set today's date
      var enrollDate = document.getElementById('studentEnrollDate');
      if (enrollDate && !enrollDate.value) enrollDate.value = new Date().toISOString().split('T')[0];
      bootstrap.Modal.getOrCreateInstance(modal).show();
    };

    // 3b. Edit Student
    window.openEditStudentModal = function (index) {
      var modal = document.getElementById('studentModal');
      if (!modal) { console.error('[SectionLoader] studentModal not found in DOM'); return; }
      var students = window.globalData && window.globalData.students;
      if (!students || !students[index]) return;
      var s = students[index];
      var form = document.getElementById('studentForm');
      if (!form) return;

      form.reset();

      // ── Step 1: Course dropdown populate করো ──
      var courseSelect = document.getElementById('studentCourseSelect');
      if (courseSelect) {
        var courses = (window.globalData && window.globalData.courseNames) || [];
        courses.forEach(function (c) {
          if (![].slice.call(courseSelect.options).some(function (o) { return o.value === c; })) {
            var opt = document.createElement('option');
            opt.value = c; opt.text = c;
            courseSelect.appendChild(opt);
          }
        });
      }

      // ── Step 2: Payment Method dropdown populate করো তারপর saved value set করো ──
      var methodSelect = document.getElementById('studentMethodSelect');
      var savedMethod = s.method || s.paymentMethod || '';
      // Fallback: if previous bug overwrote it with empty or "Select Method..."
      if (!savedMethod || savedMethod.trim() === '' || typeof savedMethod === 'string' && savedMethod.toLowerCase().includes('select method')) {
        savedMethod = '';
        if (s.installments && s.installments.length > 0) {
          savedMethod = s.installments[0].method;
        } else if (window.globalData && window.globalData.finance) {
          var pmts = window.globalData.finance.filter(function (f) {
            return (f.person === s.name || f.studentId === s.studentId) &&
              f.type === 'Income' &&
              (f.category === 'Student Fee' || f.category === 'Admission Fee');
          });
          if (pmts.length > 0) {
            savedMethod = pmts[0].method;
          }
        }
        if (!savedMethod || typeof savedMethod === 'string' && savedMethod.toLowerCase().includes('select method')) {
          savedMethod = 'Cash'; // ultimate fallback
        }
      }
      if (methodSelect) {
        var methods = (window.globalData && window.globalData.paymentMethods) || ['Cash'];
        methods.forEach(function (m) {
          if (![].slice.call(methodSelect.options).some(function (o) { return o.value === m; })) {
            var opt = document.createElement('option');
            opt.value = m; opt.text = m;
            methodSelect.appendChild(opt);
          }
        });
        // saved method যদি list-এ না থাকে, add করো
        if (savedMethod && ![].slice.call(methodSelect.options).some(function (o) { return o.value === savedMethod; })) {
          var opt = document.createElement('option');
          opt.value = savedMethod; opt.text = savedMethod;
          methodSelect.appendChild(opt);
        }
        methodSelect.value = savedMethod;
        // case-insensitive fallback
        if (methodSelect.value !== savedMethod && savedMethod) {
          for (var mi = 0; mi < methodSelect.options.length; mi++) {
            if (methodSelect.options[mi].value.toLowerCase() === savedMethod.toLowerCase()) {
              methodSelect.selectedIndex = mi; break;
            }
          }
        }
      }

      // ── Step 3: বাকি সব field set করো ──
      var set = function (id, val) { var el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
      var rowIdx = document.getElementById('studentRowIndex');
      if (rowIdx) rowIdx.value = index;
      var title = document.getElementById('studentModalLabel');
      if (title) title.textContent = '✏️ Edit — ' + (s.name || '');
      set('studentName', s.name); set('studentPhone', s.phone);
      set('studentFatherName', s.fatherName); set('studentMotherName', s.motherName);
      set('studentCourseSelect', s.course); set('studentBatchInput', s.batch);
      set('studentEnrollDate', s.enrollDate); set('studentBloodGroup', s.bloodGroup);
      set('inpTotal', s.totalPayment); set('inpPaid', s.paid); set('inpDue', s.due);
      set('studentReminderDate', s.reminderDate); set('studentRemarks', s.remarks);
      var photoInput = document.getElementById('photoURLInput');
      if (photoInput) photoInput.value = s.photo || '';
      if (s.photo) {
        var preview = document.getElementById('studentPhotoPreview');
        var removeBtn = document.getElementById('removePhotoBtn');
        if (preview) { preview.src = s.photo; preview.style.display = 'block'; }
        if (removeBtn) removeBtn.style.display = 'inline-block';
      }

      // ⚠️ NOTE: populateDropdowns setTimeout বাদ — এটা set করা method value reset করে দেয়!

      bootstrap.Modal.getOrCreateInstance(modal).show();
    };

    // 4. Employee
    window.openEmployeeModal = function (id) {
      loadAndOpen('__modalPlaceholderOther', 'sections/modals.html', 'employeeModal', function () {
        // ✅ FIX: Reset form for Add mode (previously called undefined initEmployeeModal)
        var form = document.getElementById('employeeForm');
        if (form) form.reset();
        var idField = document.getElementById('employeeId');
        if (idField) idField.value = '';
        // Reset title to Add mode
        var mel = document.getElementById('employeeModal');
        if (mel) {
          var titleEl = mel.querySelector('.modal-title');
          if (titleEl) titleEl.innerHTML = '<span class="me-2 header-icon-circle bg-primary-light">👔</span>Add New Employee';
        }
        // Populate roles dropdown
        if (form) {
          var roleSelect = form.querySelector('select[name="role"]');
          if (roleSelect && window.globalData) {
            var roles = (window.globalData.employeeRoles && window.globalData.employeeRoles.length)
              ? window.globalData.employeeRoles
              : ['Instructor', 'Admin', 'Staff', 'Manager'];
            roleSelect.innerHTML = roles.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('');
          }
        }
      });
    };

    // 5. Attendance — handled by attendance-pro.js (AttendanceHub)
    // openAttendanceModal is defined in attendance-pro.js, do not override here

    // 7. Visitor
    window.openVisitorModal = function () {
      loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', 'visitorModal', function () {
        if (typeof window.populateDropdowns === 'function') {
          setTimeout(window.populateDropdowns, 100);
        }
        // ✅ Re-attach listener
        const vm = document.getElementById('visitorModal');
        if (vm && typeof window.populateDropdowns === 'function') {
          vm.addEventListener('show.bs.modal', window.populateDropdowns);
        }
      });
    };

    // 6. Exam Registration
    window.openExamRegistration = function () {
      const modalId = 'examRegistrationModal';
      if (document.getElementById(modalId)) {
          if (window.populateExamModal) {
              window.populateExamModal();
              bootstrap.Modal.getOrCreateInstance(document.getElementById(modalId)).show();
              return;
          }
      }
      loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', modalId, function () {
        // ✅ Populate everything related to exams
        if (typeof window.populateDropdowns === 'function') {
          setTimeout(window.populateDropdowns, 100);
        }
        if (typeof window.populateExamModal === 'function') {
          window.populateExamModal();
        }
        // ✅ Re-attach listener for subsequent opens
        const em = document.getElementById(modalId);
        if (em && typeof window.populateDropdowns === 'function') {
          em.removeEventListener('show.bs.modal', window.populateDropdowns);
          em.addEventListener('show.bs.modal', window.populateDropdowns);
        }
        if (em && typeof window.populateExamModal === 'function') {
          em.removeEventListener('show.bs.modal', window.populateExamModal);
          em.addEventListener('show.bs.modal', window.populateExamModal);
        }
      });
    };

    // 6b. Edit Exam Registration
    window.editExamRegistration = function (examId) {
        var modalId = 'examRegistrationModal';
        if (document.getElementById(modalId)) {
            if (window._editExamRegistrationImpl) {
                window._editExamRegistrationImpl(examId);
                return;
            }
        }
        loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', modalId, function () {
            if (window._editExamRegistrationImpl) {
                window._editExamRegistrationImpl(examId);
            }
        });
    };

    // 6c. Add/Update Exam Result
    window.openAddResultModal = function (examId) {
        var modalId = 'addResultModal';
        if (document.getElementById(modalId)) {
            if (window._openAddResultModalImpl) {
                window._openAddResultModalImpl(examId);
                return;
            }
        }
        loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', modalId, function () {
            if (window._openAddResultModalImpl) {
                window._openAddResultModalImpl(examId);
            }
        });
    };

    // 7. Notice Board — Modal is inline in index.html, no fetch needed
    window.openNoticeModal = function () {
        var modalEl = document.getElementById('noticeBoardModal');
        if (!modalEl) { console.warn('[SectionLoader] noticeBoardModal not found in DOM'); return; }
        // Populate active notice status
        var notice = typeof window.getActiveNotice === 'function' ? window.getActiveNotice() : null;
        var statusCard = document.getElementById('currentNoticeStatus');
        var noActiveMsg = document.getElementById('noActiveNoticeMsg');
        if (notice) {
            if (statusCard) statusCard.style.display = 'block';
            if (noActiveMsg) noActiveMsg.style.display = 'none';
            var textEl = document.getElementById('currentNoticeText');
            var expEl = document.getElementById('currentNoticeExpire');
            if (textEl) textEl.textContent = notice.text;
            if (expEl) {
                var rem = notice.expiresAt - Date.now();
                var d = Math.floor(rem / 86400000);
                var h = Math.floor((rem % 86400000) / 3600000);
                var m = Math.floor((rem % 3600000) / 60000);
                var label = d > 0 ? (d + ' \u09a6\u09bf\u09a8 ' + h + ' \u0998\u09a3\u09cd\u099f\u09be \u09ac\u09be\u0995\u09bf') :
                            h > 0 ? (h + ' \u0998\u09a3\u09cd\u099f\u09be ' + m + ' \u09ae\u09bf\u09a8\u09bf\u099f \u09ac\u09be\u0995\u09bf') :
                            (m + ' \u09ae\u09bf\u09a8\u09bf\u099f \u09ac\u09be\u0995\u09bf');
                expEl.textContent = '\u23f3 \u09ae\u09c7\u09af\u09bc\u09be\u09a6: ' + label;
            }
        } else {
            if (statusCard) statusCard.style.display = 'none';
            if (noActiveMsg) noActiveMsg.style.display = 'block';
        }
        // Reset form
        var ti = document.getElementById('noticeTextInput');
        if (ti) { ti.value = ''; ti.oninput = function() { var c = document.getElementById('noticeCharCount'); if(c) c.textContent = this.value.length; }; }
        var cc = document.getElementById('noticeCharCount'); if (cc) cc.textContent = '0';
        var pv = document.getElementById('noticePreviewArea'); if (pv) pv.style.display = 'none';
        // Show modal via Bootstrap
        try {
            var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        } catch(e) {
            modalEl.style.display = 'block';
            modalEl.classList.add('show');
        }
    };
  }

  function init() {
    console.log('[SectionLoader] 🏁 Initializing System...');
    _patchAll();

    // Load static sections into placeholders immediately
    _loadStaticSections();

    // Preload
    setTimeout(() => {
      fetch('sections/settings-modal.html?v=' + Date.now()).catch(() => { });
    }, 5000);

    console.log('[SectionLoader] 🚀 System successfully initialized');
  }

  // In-memory HTML cache
  const _htmlCache = new Map();

  async function _fetchWithCache(file) {
      if (_htmlCache.has(file)) return _htmlCache.get(file);
      const res = await fetch(file + '?v=20260314');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      _htmlCache.set(file, html);
      return html;
  }

  async function _loadStaticSections() {
      const sections = [
          { pid: '__studentModalsPlaceholder', file: 'sections/modals-student.html' },
          { pid: '__accountsPlaceholder',      file: 'sections/accounts-section.html' },
          { pid: '__certificatesPlaceholder',  file: 'sections/certificates.html' },
          { pid: '__idcardsPlaceholder',       file: 'sections/idcards.html' },
      ];

      await Promise.all(sections.map(async (s) => {
          try {
              const el = document.getElementById(s.pid);
              if (!el) return;
              const rawHtml = await _fetchWithCache(s.file);
              const rawScripts = _extractRawScripts(rawHtml);
              const htmlWithoutScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
              el.innerHTML = htmlWithoutScripts;
              _execRawScripts(rawScripts);
              console.log('[SectionLoader] 💠 Loaded static section:', s.file);
          } catch (e) {
              console.warn('[SectionLoader] Failed to load static section:', s.file, e);
          }
      }));

      // ✅ FIX: After all static sections are loaded, refresh active tab if needed
      // This prevents "blank screen" on refresh for Accounts, Certificates etc.
      const activeTab = localStorage.getItem('wingsfly_active_tab');
      const staticTabs = ['accounts', 'certificates', 'idcards'];
      if (activeTab && staticTabs.includes(activeTab)) {
          console.log('[SectionLoader] 🔄 Refreshing active tab after static load:', activeTab);
          if (typeof window.switchTab === 'function') {
              window.switchTab(activeTab, false);
          }
      }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Backup patch (attendance-pro.js handles openAttendanceModal, do not re-patch)
  setTimeout(function () {
    var savedAttModal = window.openAttendanceModal;
    _patchAll();
    if (savedAttModal) window.openAttendanceModal = savedAttModal;
  }, 2000);

  window.sectionLoader = {
    loadAndOpen: loadAndOpen,
    isLoaded: id => _loaded.has(id),
    clearCache: id => { if(id) _loaded.delete(id); else _loaded.clear(); }
  };

  // Public alias for analytics fix
  window.SectionLoader = window.sectionLoader;

})();
