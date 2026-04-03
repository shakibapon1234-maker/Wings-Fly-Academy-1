// ============================================================
// WINGS FLY AVIATION ACADEMY
// EXAM MANAGEMENT SYSTEM — UNIFIED FIXED VERSION
// ✅ Replaces both: exam_management.js + exam-fix.js
// ✅ Fix: Field name conflict — regId vs id, batch vs studentBatch
// ✅ Fix: Edit & Delete buttons now work correctly
// ✅ Fix: Old data (field: id) + new data (field: regId) both supported
// ============================================================

// ─────────────────────────────────────────────────────────────
// HELPER: Get the correct ID from a registration object
// Supports both old format (.id) and new format (.regId)
// ─────────────────────────────────────────────────────────────
function getExamId(reg) {
    return reg.regId || reg.id || '';
}

// ─────────────────────────────────────────────────────────────
// HELPER: Get the correct batch from a registration object
// Supports both old format (.studentBatch) and new format (.batch)
// ─────────────────────────────────────────────────────────────
function getExamBatch(reg) {
    return reg.batch || reg.studentBatch || '';
}

// ─────────────────────────────────────────────────────────────
// 0. Init — ensure examRegistrations array exists
// ─────────────────────────────────────────────────────────────
if (typeof globalData !== 'undefined' && !globalData.examRegistrations) {
    globalData.examRegistrations = [];
}


// ─────────────────────────────────────────────────────────────
// 1. Auto-populate Student ID + Batch from Student Name
// ─────────────────────────────────────────────────────────────
function autoPopulateStudentDetails() {
    const nameInput = document.getElementById('examStudentNameInput');
    const idInput = document.getElementById('examStudentIdInput');
    const batchInput = document.getElementById('examStudentBatchInput');

    if (!nameInput || !idInput || !batchInput) return;

    const typed = nameInput.value.trim().toLowerCase();
    const students = (window.globalData && window.globalData.students) || [];

    if (!typed) { idInput.value = ''; batchInput.value = ''; return; }

    const match =
        students.find(s => (s.name || '').toLowerCase() === typed) ||
        students.find(s => (s.name || '').toLowerCase().startsWith(typed)) ||
        students.find(s => (s.name || '').toLowerCase().includes(typed));

    if (match) {
        idInput.value = match.studentId || match.id || '';
        batchInput.value = match.batch || match.course || '';
    } else {
        idInput.value = ''; batchInput.value = '';
    }
}
window.autoPopulateStudentDetails = autoPopulateStudentDetails;


// ─────────────────────────────────────────────────────────────
// 2. Populate Exam Modal (datalists, payment methods, date)
// ─────────────────────────────────────────────────────────────
function populateExamModal() {
    // Student datalist
    const studentList = document.getElementById('studentList');
    if (studentList) {
        const students = (window.globalData && window.globalData.students) || [];
        studentList.innerHTML = students
            .map(s => `<option value="${s.name || ''}"></option>`)
            .join('');
    }

    // Subject datalist (from past exam registrations + courseNames)
    const subjectList = document.getElementById('subjectList');
    if (subjectList) {
        const exams = (window.globalData && window.globalData.examRegistrations) || [];
        const courses = (window.globalData && window.globalData.courseNames) || [];
        const fromExams = exams.map(e => e.subjectName).filter(Boolean);
        const subjects = [...new Set([...courses, ...fromExams])];
        subjectList.innerHTML = subjects
            .map(s => `<option value="${s}"></option>`)
            .join('');
    }

    // Payment method <select>
    const methodSel = document.getElementById('examPaymentMethodSelect');
    if (methodSel) {
        const methods = (window.globalData && window.globalData.paymentMethods) || ['Cash', 'Bkash', 'Nagad', 'Bank Transfer'];
        const bankAccounts = (window.globalData && window.globalData.bankAccounts) || [];
        const mobile = (window.globalData && window.globalData.mobileBanking) || [];

        const unique = [...new Set([
            ...methods,
            ...bankAccounts.map(a => a.name),
            ...mobile.map(a => a.name)
        ].filter(Boolean))];

        methodSel.innerHTML =
            `<option value="">Select Payment Method</option>` +
            unique.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    // Default today's date
    const dateInput = document.getElementById('examRegistrationDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Clear student fields if NOT in edit mode
    const form = document.getElementById('examRegistrationForm');
    const idInput = document.getElementById('examStudentIdInput');
    const batInput = document.getElementById('examStudentBatchInput');
    if (form && !form.dataset.editId) {
        if (idInput) idInput.value = '';
        if (batInput) batInput.value = '';
    }
}
window.populateExamModal = populateExamModal;


// ─────────────────────────────────────────────────────────────
// 3. Initialize Exam System (called on page load & modal open)
// ─────────────────────────────────────────────────────────────
function initializeExamSystem() {
    populateExamModal();
    updateRecentExams();
    if (typeof populateDropdowns === 'function') {
        populateDropdowns();
    }
}
window.initializeExamSystem = initializeExamSystem;


// ─────────────────────────────────────────────────────────────
// 4. Open Exam Registration Modal
// ─────────────────────────────────────────────────────────────
function openExamRegistration() {
    const modalEl = document.getElementById('examRegistrationModal');
    if (modalEl) {
        initializeExamSystem();
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    } else {
        console.error('examRegistrationModal not found!');
    }
}
window.openExamRegistration = openExamRegistration;


// ─────────────────────────────────────────────────────────────
// 5. Handle Exam Registration Form Submit (Create & Edit)
// ─────────────────────────────────────────────────────────────
async function handleExamRegistration(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = {};
    fd.forEach((v, k) => data[k] = v);

    // Read values
    const studentName = (data.studentName || '').trim();
    const subjectName = (data.subjectName || '').trim();
    const examFee = parseFloat(data.examFee) || 0;
    const payMethod = (data.paymentMethod || '').trim();
    const regDate = (data.registrationDate || '').trim();
    const studentId = (document.getElementById('examStudentIdInput')?.value || '').trim();
    const studentBatch = (document.getElementById('examStudentBatchInput')?.value || '').trim();

    // Validation
    if (!studentName) { _examToast('❌ Student name is required', 'error'); return; }
    if (!subjectName) { _examToast('❌ Subject name is required', 'error'); return; }
    if (examFee <= 0) { _examToast('❌ Exam fee must be greater than 0', 'error'); return; }
    if (!payMethod) { _examToast('❌ Please select a payment method', 'error'); return; }
    if (!regDate) { _examToast('❌ Registration date is required', 'error'); return; }

    if (!window.globalData.examRegistrations) window.globalData.examRegistrations = [];

    const editId = form.dataset.editId || null;

    if (editId) {
        // ── EDIT MODE ──
        const idx = window.globalData.examRegistrations.findIndex(r => getExamId(r) === editId);
        if (idx < 0) { _examToast('❌ Registration not found', 'error'); return; }

        const existing = window.globalData.examRegistrations[idx];
        // Update fields, preserve regId/id whichever exists
        existing.studentName = studentName;
        existing.studentId = studentId;
        existing.batch = studentBatch;
        existing.studentBatch = studentBatch; // keep both for compatibility
        existing.examSession = (data.examSession || '').trim();
        existing.subjectName = subjectName;
        existing.examFee = examFee;
        existing.paymentMethod = payMethod;
        existing.registrationDate = regDate;
        existing.examComment = (data.examComment || '').trim();
        existing.updatedAt = new Date().toISOString();

        window.globalData.examRegistrations[idx] = existing;
        delete form.dataset.editId;
        _examToast('✅ Exam registration updated!', 'success');

        if (typeof window.logActivity === 'function') {
            window.logActivity('student', 'EDIT', `Exam Reg. Updated: ${studentName} (${subjectName})`);
        }

    } else {
        // ── CREATE MODE ──
        const regId = 'EXAM-' + Date.now().toString().slice(-6);

        const registration = {
            regId,
            id: regId,           // keep both for compatibility
            studentName,
            studentId,
            batch: studentBatch,
            studentBatch: studentBatch,    // keep both for compatibility
            examSession: (data.examSession || '').trim(),
            subjectName,
            examFee,
            paymentMethod: payMethod,
            registrationDate: regDate,
            examComment: (data.examComment || '').trim(),
            grade: '',
            addedAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        window.globalData.examRegistrations.push(registration);

        // Finance ledger entry
        if (!window.globalData.finance) window.globalData.finance = [];
        window.globalData.finance.push({
            id: 'FIN-' + Date.now(),
            type: 'Income',
            method: payMethod,
            date: regDate,
            category: 'Exam Fee',
            person: studentName,
            amount: examFee,
            description: `Exam Fee — ${studentName} | ${subjectName} | Batch: ${studentBatch} | Session: ${data.examSession || ''} | Reg: ${regId}`,
            note: `Exam Fee — ${studentName} | ${subjectName} | Session: ${data.examSession || ''} | Reg: ${regId}`,
            addedAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        });

        // Update account balance
        if (typeof updateAccountBalance === 'function') {
            updateAccountBalance(payMethod, examFee, 'Income', true);
        } else if (window.updateAccountBalance) {
            window.updateAccountBalance(payMethod, examFee, 'Income');
        }

        _examToast(`✅ Exam registered! ID: ${regId}`, 'success');

        if (typeof window.logActivity === 'function') {
            window.logActivity('student', 'ADD', `Exam Registered: ${studentName} (${subjectName} - ৳${examFee})`);
        }

        // Print receipt
        setTimeout(() => printExamReceipt(regId), 600);
    }

    // Save
    if (typeof saveToStorage === 'function') {
        await saveToStorage();
    } else {
        localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    }
    if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush('Exam Registration Saved');

    // Close modal & reset form
    const modalEl = document.getElementById('examRegistrationModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    form.reset();
    const idEl = document.getElementById('examStudentIdInput');
    const batEl = document.getElementById('examStudentBatchInput');
    if (idEl) idEl.value = '';
    if (batEl) batEl.value = '';

    // Refresh views
    if (typeof searchExamResults === 'function') searchExamResults();
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    if (typeof renderDashboard === 'function') renderDashboard();
    updateRecentExams();
}
window.handleExamRegistration = handleExamRegistration;


// ─────────────────────────────────────────────────────────────
// 6. Search & Filter Exam Results
// ─────────────────────────────────────────────────────────────
function searchExamResults() {
    const q = (document.getElementById('examResultSearchInput')?.value || '').toLowerCase().trim();
    const batch = (document.getElementById('examBatchFilter')?.value || '').toLowerCase().trim();
    const session = (document.getElementById('examSessionFilter')?.value || '').toLowerCase().trim();
    const subject = (document.getElementById('examSubjectFilter')?.value || '').toLowerCase().trim();
    const start = document.getElementById('examStartDateFilter')?.value || '';
    const end = document.getElementById('examEndDateFilter')?.value || '';

    let list = (window.globalData && window.globalData.examRegistrations) || [];

    if (q) list = list.filter(r =>
        (r.studentName || '').toLowerCase().includes(q) ||
        (getExamId(r) || '').toLowerCase().includes(q) ||
        (r.studentId || '').toString().toLowerCase().includes(q));

    if (batch) list = list.filter(r => (getExamBatch(r) || '').toLowerCase().includes(batch));
    if (session) list = list.filter(r => (r.examSession || '').toLowerCase().includes(session));
    if (subject) list = list.filter(r => (r.subjectName || '').toLowerCase().includes(subject));
    if (start) list = list.filter(r => (r.registrationDate || '') >= start);
    if (end) list = list.filter(r => (r.registrationDate || '') <= end);

    // Newest first
    list = list.slice().sort((a, b) => new Date(b.addedAt || b.timestamp || 0) - new Date(a.addedAt || a.timestamp || 0));

    renderExamResults(list);
}
window.searchExamResults = searchExamResults;


// ─────────────────────────────────────────────────────────────
// 7. Render Exam Results Table
// ─────────────────────────────────────────────────────────────
function renderExamResults(list) {
    const tbody = document.getElementById('examResultsTableBody');
    const display = document.getElementById('examResultsDisplay');
    const noMsg = document.getElementById('noResultsMessage');
    const countEl = document.getElementById('filteredExamCount');
    const totalEl = document.getElementById('examTotalFeeDisplay');
    const creditEl = document.getElementById('examTotalCredit');
    const netEl = document.getElementById('examNetTotal');

    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" class="text-center py-5">
              <i class="bi bi-journal-x fs-2 d-block mb-2 opacity-50"></i>
              <span class="text-muted">No exam registrations found.</span>
            </td>
          </tr>`;
        if (display) display.classList.remove('d-none');
        if (noMsg) noMsg.classList.add('d-none');
        if (countEl) countEl.textContent = '0';
        if (totalEl) totalEl.textContent = '৳0';
        if (creditEl) creditEl.textContent = '৳0';
        if (netEl) netEl.textContent = '৳0';
        return;
    }

    const fmt = window.formatNumber || (n => Number(n).toLocaleString('en-IN'));

    const getMethodStyle = (method) => {
        const m = (method || '').toLowerCase();
        if (m.includes('cash')) return 'background:rgba(0,255,157,0.15);color:#00c97a;border:1px solid rgba(0,255,157,0.3);';
        if (m.includes('bank')) return 'background:rgba(0,150,255,0.15);color:#0096ff;border:1px solid rgba(0,150,255,0.3);';
        if (m.includes('bkash')) return 'background:rgba(220,0,80,0.15);color:#ff2d6b;border:1px solid rgba(220,0,80,0.3);';
        if (m.includes('nagad') || m.includes('nogod')) return 'background:rgba(255,140,0,0.15);color:#ff8c00;border:1px solid rgba(255,140,0,0.3);';
        return 'background:rgba(150,150,150,0.15);color:#aaa;border:1px solid rgba(150,150,150,0.3);';
    };

    tbody.innerHTML = list.map(r => {
        const examId = getExamId(r);
        const examBatch = getExamBatch(r);
        const fee = parseFloat(r.examFee) || 0;
        const gradeClass = (r.grade === 'A+' || r.grade === 'A') ? 'text-success fw-bold' :
            (r.grade === 'Fail') ? 'text-danger fw-bold' : 'text-primary';

        return `
        <tr>
          <td><span class="badge rounded-pill px-3 py-2" style="background:rgba(0,217,255,0.15);color:#00d9ff;font-size:0.72rem;">${examId || '—'}</span></td>
          <td class="text-muted small">${r.studentId || '—'}</td>
          <td class="fw-bold">${r.studentName || '—'}</td>
          <td><span class="badge bg-secondary rounded-pill px-2">${examBatch || '—'}</span></td>
          <td class="small">${r.examSession || '—'}</td>
          <td class="fw-semibold">${r.subjectName || '—'}</td>
          <td class="fw-bold text-success">৳${fmt(fee)}</td>
          <td><span class="badge rounded-pill px-2" style="${getMethodStyle(r.paymentMethod)}">${r.paymentMethod || '—'}</span></td>
          <td class="${gradeClass}">${r.grade || '—'}</td>
          <td class="small text-muted">${r.registrationDate || '—'}</td>
          <td class="small" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.examComment || ''}">${r.examComment || '—'}</td>
          <td class="no-print text-end">
            <div class="d-flex gap-1 justify-content-end">
              <button class="btn btn-sm btn-outline-warning rounded-pill px-2" title="Add/Update Result" onclick="openAddResultModal('${examId}')">
                <i class="bi bi-trophy-fill"></i>
              </button>
              <button class="btn btn-sm btn-outline-primary rounded-pill px-2" title="Edit" onclick="editExamRegistration('${examId}')">
                <i class="bi bi-pencil-fill"></i>
              </button>
              <button class="btn btn-sm btn-outline-info rounded-pill px-2" title="Print Receipt" onclick="printExamReceipt('${examId}')">
                <i class="bi bi-printer-fill"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-2" title="Delete" onclick="deleteExamRegistration('${examId}')">
                <i class="bi bi-trash-fill"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    const totalFee = list.reduce((sum, r) => sum + (parseFloat(r.examFee) || 0), 0);

    if (display) display.classList.remove('d-none');
    if (noMsg) noMsg.classList.add('d-none');
    if (countEl) countEl.textContent = list.length;
    if (totalEl) totalEl.textContent = `৳${fmt(totalFee)}`;
    if (creditEl) creditEl.textContent = `৳${fmt(totalFee)}`;
    if (netEl) netEl.textContent = `৳${fmt(totalFee)}`;
}
window.renderExamResults = renderExamResults;


// ─────────────────────────────────────────────────────────────
// 8. Clear Filters
// ─────────────────────────────────────────────────────────────
function clearExamFilters() {
    ['examResultSearchInput', 'examBatchFilter', 'examSessionFilter',
        'examSubjectFilter', 'examStartDateFilter', 'examEndDateFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    searchExamResults();
}
window.clearExamFilters = clearExamFilters;


// ─────────────────────────────────────────────────────────────
// 9. Edit Exam Registration — opens modal pre-filled
// ─────────────────────────────────────────────────────────────
function editExamRegistration(examId) {
    const regs = (window.globalData && window.globalData.examRegistrations) || [];
    // ✅ Use getExamId() so BOTH old (.id) and new (.regId) records work
    const reg = regs.find(r => getExamId(r) === examId);

    if (!reg) {
        if (typeof _examToast === 'function') _examToast('❌ Registration not found', 'error');
        else if (window.showErrorToast) window.showErrorToast('❌ Registration not found: ' + examId);
        return;
    }

    const modalEl = document.getElementById('examRegistrationModal');
    const form = document.getElementById('examRegistrationForm');

    // If modal/form missing, we might be in lazy-load limbo
    if (!form || !modalEl) {
        console.warn('[Exam] Form or Modal missing in DOM, calling loader fallback...');
        if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
            window.sectionLoader.loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', 'examRegistrationModal', () => {
                editExamRegistration(examId);
            });
        }
        return;
    }

    // Populate modal first (fills payment methods, datalists etc.)
    populateExamModal();

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('examStudentNameInput', reg.studentName);
    setVal('examStudentIdInput', reg.studentId);
    setVal('examStudentBatchInput', getExamBatch(reg));
    setVal('examRegistrationDate', reg.registrationDate);

    // Form named fields
    if (form.elements['examSession']) form.elements['examSession'].value = reg.examSession || '';
    if (form.elements['subjectName']) form.elements['subjectName'].value = reg.subjectName || '';
    if (form.elements['examFee']) form.elements['examFee'].value = reg.examFee || '';
    if (form.elements['examComment']) form.elements['examComment'].value = reg.examComment || '';

    // Payment method select
    const methodSel = document.getElementById('examPaymentMethodSelect');
    if (methodSel) {
        // Small delay so options are populated before we set the value
        setTimeout(() => { methodSel.value = reg.paymentMethod || ''; }, 100);
    }

    // Mark form as edit mode with the correct ID
    form.dataset.editId = examId;

    // Open modal
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();

    if (typeof _examToast === 'function') _examToast('✏️ Edit mode — changes করে Submit করুন', 'success');
}
window.editExamRegistration = editExamRegistration;
window._editExamRegistrationImpl = editExamRegistration;

// ─────────────────────────────────────────────────────────────
// 10. Delete Exam Registration
// ─────────────────────────────────────────────────────────────
async function deleteExamRegistration(examId) {
    if (!confirm(`🗑️ Delete this exam registration (${examId})?`)) return;

    if (!window.globalData.examRegistrations) return;
    // ✅ Use getExamId() so BOTH old (.id) and new (.regId) records work
    const idx = window.globalData.examRegistrations.findIndex(r => getExamId(r) === examId);
    if (idx < 0) {
        _examToast('❌ Registration not found', 'error');
        return;
    }

    const reg = window.globalData.examRegistrations[idx];

    // Move to Recycle Bin
    if (typeof window.moveToTrash === 'function') {
        window.moveToTrash('exam', reg);
    }

    // Remove linked finance entry & reverse account balance
    if (window.globalData.finance) {
        const before = window.globalData.finance.length;
        window.globalData.finance = window.globalData.finance.filter(f =>
            !(f.note || f.description || '').includes(`Reg: ${examId}`)
        );
        const removed = before - window.globalData.finance.length;
        if (removed > 0 && typeof updateAccountBalance === 'function' && reg.examFee && reg.paymentMethod) {
            updateAccountBalance(reg.paymentMethod, parseFloat(reg.examFee) || 0, 'Income', false);
        }
    }

    // Activity log
    if (typeof window.logActivity === 'function') {
        window.logActivity('student', 'DELETE', `Exam registration deleted: "${reg.studentName || examId}"`, reg);
    }

    window.globalData.examRegistrations.splice(idx, 1);

    if (typeof saveToStorage === 'function') {
        await saveToStorage();
    } else {
        localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    }
    if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush('Exam Registration Deleted');

    _examToast('🗑️ Deleted & moved to Recycle Bin', 'success');
    searchExamResults();
    if (typeof updateGlobalStats === 'function') updateGlobalStats();
    if (typeof renderDashboard === 'function') renderDashboard();
    updateRecentExams();
}
window.deleteExamRegistration = deleteExamRegistration;


// ─────────────────────────────────────────────────────────────
// 11. Add / Update Grade Modal
// ─────────────────────────────────────────────────────────────
function openAddResultModal(examId) {
    const regs = (window.globalData && window.globalData.examRegistrations) || [];
    const reg = regs.find(r => getExamId(r) === examId);
    if (!reg) {
        if (typeof _examToast === 'function') _examToast('❌ Registration not found', 'error');
        return;
    }

    const modalEl = document.getElementById('addResultModal');
    if (!modalEl) {
        if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
            window.sectionLoader.loadAndOpen('__modalPlaceholderOther', 'sections/modals-other.html', 'addResultModal', () => {
                openAddResultModal(examId);
            });
        }
        return;
    }

    const ridInput = document.getElementById('resultRegistrationId');
    const nameEl = document.getElementById('resultStudentName');
    const subjEl = document.getElementById('resultSubjectName');
    if (ridInput) ridInput.value = examId;
    if (nameEl) nameEl.value = reg.studentName || '';
    if (subjEl) subjEl.value = reg.subjectName || '';

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}
window.openAddResultModal = openAddResultModal;
window._openAddResultModalImpl = openAddResultModal;

async function handleAddResult(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const examId = fd.get('registrationId');
    const grade = fd.get('grade');

    if (!examId || !grade) { _examToast('❌ Grade is required', 'error'); return; }

    const regs = (window.globalData && window.globalData.examRegistrations) || [];
    const idx = regs.findIndex(r => getExamId(r) === examId);
    if (idx < 0) { _examToast('❌ Registration not found', 'error'); return; }

    regs[idx].grade = grade;

    if (typeof saveToStorage === 'function') {
        await saveToStorage();
    } else {
        localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
    }
    if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush('Exam Grade Saved');

    _examToast(`✅ Grade "${grade}" saved for ${regs[idx].studentName}`, 'success');

    if (typeof window.logActivity === 'function') {
        window.logActivity('student', 'EDIT', `Exam Grade Added: ${grade} for ${regs[idx].studentName}`);
    }

    const modalEl = document.getElementById('addResultModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    form.reset();
    searchExamResults();
}
window.handleAddResult = handleAddResult;


// ─────────────────────────────────────────────────────────────
// 12. Print Exam Receipt — A5 Half-Page, Professional Design
//     ✅ Fix: "undefined" subject/batch/session
//     ✅ Fix: Only receipt prints — no page 2 background content
//     ✅ Fix: @page size A5 landscape (half-page receipt style)
// ─────────────────────────────────────────────────────────────
function printExamReceipt(examId) {
    const regs = (window.globalData && window.globalData.examRegistrations) || [];
    const reg = regs.find(r => getExamId(r) === examId);
    if (!reg) { alert('Receipt data not found!'); return; }

    const premiumLogo = (window.APP_LOGOS && window.APP_LOGOS.premium) || '';
    const signatureImg = (window.APP_LOGOS && window.APP_LOGOS.signature) || '';
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    const displayId = getExamId(reg);
    const displayBatch = getExamBatch(reg);

    // ✅ Safe fallbacks — "undefined" দেখাবে না
    const safeSubject = reg.subjectName && reg.subjectName !== 'undefined' ? reg.subjectName : '—';
    const safeSession = reg.examSession && reg.examSession !== 'undefined' ? reg.examSession : '—';
    const safeBatch = displayBatch && displayBatch !== 'undefined' ? displayBatch : '—';
    const safeStudentId = reg.studentId && reg.studentId !== 'undefined' ? reg.studentId : '—';
    const safeMethod = reg.paymentMethod && reg.paymentMethod !== 'undefined' ? reg.paymentMethod : 'Cash';
    const safeFee = parseFloat(reg.examFee) || 0;
    const safeDate = reg.registrationDate && reg.registrationDate !== 'undefined' ? reg.registrationDate : new Date().toISOString().split('T')[0];

    // ✅ Inject @page A5 print CSS — isolate receipt, hide everything else
    const oldStyle = document.getElementById('wf-exam-receipt-print-css');
    if (oldStyle) oldStyle.remove();
    const style = document.createElement('style');
    style.id = 'wf-exam-receipt-print-css';
    style.textContent = `
      @media print {
        @page { size: A5 landscape; margin: 0; }
        body > *:not(#printArea) { display: none !important; visibility: hidden !important; }
        #printArea {
          display: block !important;
          visibility: visible !important;
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          background: white !important;
          z-index: 99999 !important;
          padding: 0 !important; margin: 0 !important;
        }
        #printArea * { visibility: visible !important; }
      }
    `;
    document.head.appendChild(style);

    printArea.innerHTML = `
    <div style="
      width:210mm; height:148mm;
      background:white;
      padding:8mm 12mm;
      font-family:'Segoe UI','Inter',Arial,sans-serif;
      position:relative;
      box-sizing:border-box;
      margin:0 auto;
      color:#1e293b;
      display:flex;
      flex-direction:column;
      gap:0;
    ">
      <!-- Watermark -->
      ${premiumLogo ? `<img src="${premiumLogo}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);opacity:0.035;width:280px;z-index:0;pointer-events:none;">` : ''}

      <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;">

        <!-- ══ HEADER ══ -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8px;border-bottom:3px solid #1e1b4b;margin-bottom:10px;">
          <!-- Left: Logo + Academy Name -->
          <div style="display:flex;align-items:center;gap:10px;">
            ${premiumLogo
            ? `<img src="${premiumLogo}" style="height:48px;width:auto;">`
            : `<div style="width:48px;height:48px;background:#1e1b4b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px;">WF</div>`
        }
            <div>
              <div style="font-size:20px;font-weight:900;color:#1e1b4b;text-transform:uppercase;letter-spacing:0.5px;line-height:1.1;">Wings Fly</div>
              <div style="font-size:9px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Aviation & Career Development Academy</div>
              <div style="font-size:8px;color:#94a3b8;margin-top:2px;">Bonosree, Dhaka &nbsp;|&nbsp; +880 1757 208244 &nbsp;|&nbsp; wingsfly.bd@gmail.com</div>
            </div>
          </div>
          <!-- Right: Receipt Badge + Meta -->
          <div style="text-align:right;">
            <div style="display:inline-block;background:#1e1b4b;color:white;padding:5px 14px;border-radius:5px;font-size:13px;font-weight:800;letter-spacing:0.5px;margin-bottom:5px;">
              ✦ EXAM ADMIT RECEIPT
            </div>
            <div style="font-size:10px;color:#475569;">
              <span style="font-weight:700;">Reg No:</span> ${displayId}
            </div>
            <div style="font-size:10px;color:#475569;">
              <span style="font-weight:700;">Date:</span> ${safeDate}
            </div>
          </div>
        </div>

        <!-- ══ CANDIDATE + EXAM INFO BAND ══ -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <!-- Candidate -->
          <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;padding:8px 12px;">
            <div style="font-size:8px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">🎓 Candidate Details</div>
            <div style="font-size:15px;font-weight:800;color:#1e1b4b;line-height:1.2;">${reg.studentName || '—'}</div>
            <div style="font-size:10px;color:#64748b;margin-top:3px;">
              Student ID: <strong style="color:#1e293b;">${safeStudentId}</strong>
            </div>
          </div>
          <!-- Exam Info -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;">
            <div style="font-size:8px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">📋 Exam Information</div>
            <div style="font-size:14px;font-weight:800;color:#1e1b4b;line-height:1.2;">${safeSubject}</div>
            <div style="font-size:10px;color:#64748b;margin-top:3px;">
              Batch: <strong style="color:#1e293b;">${safeBatch}</strong>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              Session: <strong style="color:#1e293b;">${safeSession}</strong>
            </div>
          </div>
        </div>

        <!-- ══ FEE TABLE ══ -->
        <div style="flex-grow:1;margin-bottom:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#1e1b4b;color:white;">
                <th style="padding:7px 10px;text-align:left;border-radius:4px 0 0 0;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:110px;">Payment Method</th>
                <th style="padding:7px 10px;text-align:right;width:120px;border-radius:0 4px 0 0;">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#fafafa;">
                <td style="padding:10px;border:1px solid #e2e8f0;border-top:none;">
                  <div style="font-size:12px;font-weight:700;color:#1e1b4b;">${safeSubject} — Exam Registration Fee</div>
                  <div style="font-size:9px;color:#94a3b8;margin-top:3px;">Official enrollment for the Wings Fly Academy examination program.</div>
                </td>
                <td style="padding:10px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
                  <span style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:3px 10px;font-weight:700;font-size:10px;color:#334155;">${safeMethod}</span>
                </td>
                <td style="padding:10px;border:1px solid #e2e8f0;border-top:none;text-align:right;font-size:18px;font-weight:900;color:#1e1b4b;">
                  ৳${safeFee.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="background:#e8edf8;">
                <td colspan="2" style="padding:7px 10px;border:1px solid #c7d2fe;text-align:right;font-size:11px;font-weight:700;color:#4338ca;">TOTAL AMOUNT PAID</td>
                <td style="padding:7px 10px;border:1px solid #c7d2fe;text-align:right;font-size:14px;font-weight:900;color:#1e1b4b;">৳${safeFee.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
          ${reg.examComment && reg.examComment !== 'undefined' ? `
          <div style="margin-top:6px;padding:6px 10px;border-left:3px solid #4338ca;background:#f5f3ff;border-radius:0 4px 4px 0;font-size:9px;color:#64748b;">
            <strong style="color:#4338ca;">Note:</strong> ${reg.examComment}
          </div>` : ''}
        </div>

        <!-- ══ SIGNATURES ══ -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:6px;border-top:1px dashed #cbd5e1;">
          <!-- Candidate -->
          <div style="width:30%;text-align:center;">
            <div style="height:28px;"></div>
            <div style="border-top:1.5px solid #1e1b4b;padding-top:4px;font-size:8.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Candidate's Signature</div>
          </div>
          <!-- Center notice -->
          <div style="text-align:center;flex-grow:1;padding:0 10px;">
            <div style="font-size:7.5px;color:#94a3b8;font-style:italic;line-height:1.6;">
              This is a computer generated receipt.<br>
              Valid only with official seal &amp; authorized signature.<br>
              <strong style="color:#cbd5e1;">Reg ID: ${displayId}</strong>
            </div>
          </div>
          <!-- Authorized -->
          <div style="width:30%;text-align:center;">
            <div style="height:28px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:0;">
              ${signatureImg ? `<img src="${signatureImg}" style="height:36px;width:auto;">` : ''}
            </div>
            <div style="border-top:1.5px solid #1e1b4b;padding-top:4px;font-size:8.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Authorized Signature</div>
          </div>
        </div>

      </div>
    </div>`;

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            if (printArea) printArea.innerHTML = '';
            const ps = document.getElementById('wf-exam-receipt-print-css');
            if (ps) ps.remove();
        }, 1500);
    }, 400);
}
window.printExamReceipt = printExamReceipt;


// ─────────────────────────────────────────────────────────────
// 13. Print Exam Results Report
// ─────────────────────────────────────────────────────────────
function printExamResults() {
    const nameSearch = (document.getElementById('examResultSearchInput')?.value || '').toLowerCase().trim();
    const batchSearch = (document.getElementById('examBatchFilter')?.value || '').toLowerCase().trim();
    const sessionSearch = (document.getElementById('examSessionFilter')?.value || '').toLowerCase().trim();
    const subjectSearch = (document.getElementById('examSubjectFilter')?.value || '').toLowerCase().trim();
    const startDate = document.getElementById('examStartDateFilter')?.value || '';
    const endDate = document.getElementById('examEndDateFilter')?.value || '';

    let list = (window.globalData && window.globalData.examRegistrations) || [];

    if (nameSearch) list = list.filter(r => (r.studentName || '').toLowerCase().includes(nameSearch) || (getExamId(r) || '').toLowerCase().includes(nameSearch));
    if (batchSearch) list = list.filter(r => (getExamBatch(r) || '').toLowerCase().includes(batchSearch));
    if (sessionSearch) list = list.filter(r => (r.examSession || '').toLowerCase().includes(sessionSearch));
    if (subjectSearch) list = list.filter(r => (r.subjectName || '').toLowerCase().includes(subjectSearch));
    if (startDate) list = list.filter(r => (r.registrationDate || '') >= startDate);
    if (endDate) list = list.filter(r => (r.registrationDate || '') <= endDate);

    if (list.length === 0) { alert('No data to print!'); return; }

    const totalFee = list.reduce((s, r) => s + (parseFloat(r.examFee) || 0), 0);

    let rows = list.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f9fc'}">
            <td>${getExamId(r)}</td>
            <td>${r.studentId || 'N/A'}</td>
            <td style="font-weight:600">${r.studentName}</td>
            <td>${getExamBatch(r) || 'N/A'}</td>
            <td>${r.examSession || 'N/A'}</td>
            <td>${r.subjectName}</td>
            <td style="text-align:right">৳${(r.examFee || 0).toLocaleString()}</td>
            <td>${r.registrationDate}</td>
            <td style="font-weight:700;color:${(r.grade === 'A+' || r.grade === 'A') ? 'green' : '#333'}">${r.grade || 'Pending'}</td>
            <td>${r.examComment || '—'}</td>
        </tr>`).join('');

    const printArea = document.getElementById('printArea');
    if (printArea) {
        printArea.innerHTML = `
        <div style="background:white;padding:20px;">
            ${typeof getPrintHeader === 'function' ? getPrintHeader('EXAM RESULTS REPORT') : '<h2 style="border-bottom:2px solid #1a3a5c;padding-bottom:8px;color:#1a3a5c;">EXAM RESULTS REPORT</h2>'}
            <div style="background:#f0f4f8;padding:10px;border-radius:6px;margin:10px 0;font-size:12px;">
                Total Records: <strong>${list.length}</strong> &nbsp;|&nbsp; Total Fees: <strong>৳${totalFee.toLocaleString()}</strong>
                &nbsp;|&nbsp; Printed: <strong>${(typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleDateString())}</strong>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px;">
                <thead><tr style="background:#1a3a5c;color:#fff;">
                    <th style="padding:8px 6px;">Reg ID</th>
                    <th style="padding:8px 6px;">Student ID</th>
                    <th style="padding:8px 6px;">Name</th>
                    <th style="padding:8px 6px;">Batch</th>
                    <th style="padding:8px 6px;">Session</th>
                    <th style="padding:8px 6px;">Subject</th>
                    <th style="padding:8px 6px;text-align:right;">Fee</th>
                    <th style="padding:8px 6px;">Date</th>
                    <th style="padding:8px 6px;">Grade</th>
                    <th style="padding:8px 6px;">Remarks</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${typeof getPrintFooter === 'function' ? getPrintFooter() : ''}
        </div>`;
        setTimeout(() => window.print(), 500);
    }
}
window.printExamResults = printExamResults;


// ─────────────────────────────────────────────────────────────
// 14. Export Exam Results to CSV / Excel
// ─────────────────────────────────────────────────────────────
function exportExamResultsExcel() {
    let list = (window.globalData && window.globalData.examRegistrations) || [];

    const nameSearch = (document.getElementById('examResultSearchInput')?.value || '').toLowerCase().trim();
    const batchSearch = (document.getElementById('examBatchFilter')?.value || '').toLowerCase().trim();
    const sessionSearch = (document.getElementById('examSessionFilter')?.value || '').toLowerCase().trim();
    const subjectSearch = (document.getElementById('examSubjectFilter')?.value || '').toLowerCase().trim();
    const startDate = document.getElementById('examStartDateFilter')?.value || '';
    const endDate = document.getElementById('examEndDateFilter')?.value || '';

    if (nameSearch) list = list.filter(r => (r.studentName || '').toLowerCase().includes(nameSearch) || (getExamId(r) || '').toLowerCase().includes(nameSearch));
    if (batchSearch) list = list.filter(r => (getExamBatch(r) || '').toLowerCase().includes(batchSearch));
    if (sessionSearch) list = list.filter(r => (r.examSession || '').toLowerCase().includes(sessionSearch));
    if (subjectSearch) list = list.filter(r => (r.subjectName || '').toLowerCase().includes(subjectSearch));
    if (startDate) list = list.filter(r => (r.registrationDate || '') >= startDate);
    if (endDate) list = list.filter(r => (r.registrationDate || '') <= endDate);

    if (list.length === 0) { _examToast('❌ No data to export', 'error'); return; }

    const rows = [
        ['Registration ID', 'Student ID', 'Student Name', 'Batch', 'Session', 'Subject', 'Exam Fee', 'Payment Method', 'Grade', 'Date', 'Comment'],
        ...list.map(r => [
            getExamId(r),
            r.studentId || 'N/A',
            r.studentName,
            getExamBatch(r) || 'N/A',
            r.examSession || 'N/A',
            r.subjectName,
            r.examFee || 0,
            r.paymentMethod || 'N/A',
            r.grade || 'Pending',
            r.registrationDate,
            r.examComment || ''
        ])
    ];

    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = `Exam_Results_${new Date().toISOString().split('T')[0]}.csv`;

    if (typeof downloadCSV === 'function') {
        downloadCSV(csv, filename);
    } else {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    _examToast('📊 Excel (CSV) exported!', 'success');
}
window.exportExamResultsExcel = exportExamResultsExcel;


// ─────────────────────────────────────────────────────────────
// 15. Recent Exams Dashboard Widget
// ─────────────────────────────────────────────────────────────
function updateRecentExams() {
    const container = document.getElementById('recentExamsList');
    if (!container) return;

    const fmt = window.formatNumber || (n => Number(n).toLocaleString('en-IN'));
    const exams = ((window.globalData && window.globalData.examRegistrations) || [])
        .slice()
        .sort((a, b) => new Date(b.addedAt || b.timestamp || 0) - new Date(a.addedAt || a.timestamp || 0))
        .slice(0, 5);

    if (exams.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-3 small">No exam registrations yet.</div>`;
        return;
    }

    container.innerHTML = exams.map(r => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-opacity-25">
            <div>
                <div class="fw-semibold small">${r.studentName}</div>
                <div class="text-muted" style="font-size:0.75rem;">${r.subjectName} • ${r.registrationDate || ''}</div>
            </div>
            <span class="fw-bold text-success small">৳${fmt(r.examFee)}</span>
        </div>`).join('');
}
window.updateRecentExams = updateRecentExams;


// ─────────────────────────────────────────────────────────────
// 16. Switch to Exam Results section
// ─────────────────────────────────────────────────────────────
function switchToExamResults() {
    document.getElementById('studentSection')?.classList.add('d-none');
    document.getElementById('ledgerSection')?.classList.add('d-none');
    document.getElementById('loanSection')?.classList.add('d-none');
    document.getElementById('examResultsSection')?.classList.remove('d-none');

    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'Exam Results';

    const searchInput = document.getElementById('examResultSearchInput');
    if (searchInput) searchInput.value = '';
    searchExamResults();
}
window.switchToExamResults = switchToExamResults;


// ─────────────────────────────────────────────────────────────
// 17. Credentials Safety Check
// ─────────────────────────────────────────────────────────────
(function ensureCredentials() {
    function _fix() {
        if (!window.globalData) return;
        if (!window.globalData.credentials) {
            try {
                const stored = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
                if (stored.credentials) {
                    window.globalData.credentials = stored.credentials;
                } else {
                    window.globalData.credentials = {
                        username: 'admin',
                        password: 'e7d3bfb67567c3d94bcecb2ce65ef146eac83e50dc3f3b89e81bb647a8bada4c'
                    };
                    if (typeof saveToStorage === 'function') saveToStorage();
                    else localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
                }
            } catch (e) { console.warn('credentials ensure error:', e); }
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _fix);
    else _fix();
    setTimeout(_fix, 1500);
})();


// ─────────────────────────────────────────────────────────────
// 18. Toast Helper (internal — uses app's toast if available)
// ─────────────────────────────────────────────────────────────
function _examToast(msg, type) {
    if (typeof showSuccessToast === 'function' && type === 'success') { showSuccessToast(msg); return; }
    if (typeof showErrorToast === 'function' && type === 'error') { showErrorToast(msg); return; }
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    // fallback
    console.log(`[Exam ${type}]`, msg);
    if (type === 'error') alert(msg);
}


// ─────────────────────────────────────────────────────────────
// 19. DOMContentLoaded — attach all event listeners
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initializeExamSystem();

    // Modal open → populate fields
    const examModal = document.getElementById('examRegistrationModal');
    if (examModal) {
        examModal.addEventListener('show.bs.modal', () => populateExamModal());
        examModal.addEventListener('hidden.bs.modal', () => {
            const form = document.getElementById('examRegistrationForm');
            if (form) {
                delete form.dataset.editId;
                form.reset();
                const idEl = document.getElementById('examStudentIdInput');
                const batEl = document.getElementById('examStudentBatchInput');
                if (idEl) idEl.value = '';
                if (batEl) batEl.value = '';
            }
        });
    }

    console.log('✅ Exam Management System Loaded — Wings Fly Aviation');
});


// ─────────────────────────────────────────────────────────────
// 20. Recycle Bin Integration — support for 'exam' type
// ─────────────────────────────────────────────────────────────
(function patchRecycleBinForExam() {
    const _registerPatch = () => {
        const _origLoad = window.loadDeletedItems;
        if (typeof _origLoad !== 'function') return;

        window.loadDeletedItems = function () {
            const deleted = (window.globalData && window.globalData.deletedItems) || [];
            deleted.forEach(d => {
                if (d.type === 'exam' && !d._displayName) {
                    d._icon = '📋';
                    d._displayName = (d.item?.studentName || 'Unknown Student') + ' — ' + (d.item?.subjectName || 'Exam');
                }
            });
            return _origLoad.apply(this, arguments);
        };
        console.log('✅ Exam-RecycleBin patch applied');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _registerPatch);
    else _registerPatch();
    // Re-patch later if needed
    setTimeout(_registerPatch, 1000);
})();
