/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/students.js
   Student Module — CRUD, Search, Filter, Print, Export
════════════════════════════════════════════════ */

const Students = (() => {

  function _feePaymentsForStudent(studentId, s) {
    return SupabaseSync.getAll(DB.finance).filter(f =>
      f.category === 'Student Fee' &&
      (f.ref_id === studentId || (s && s.student_id && f.ref_id === s.student_id))
    );
  }

  function _syncPaidDueAfterLedgerChange(studentId, s, removedPaymentAmount) {
    // ✅ Bug Fix: Always re-read the latest student data from DB.
    // The passed-in `s` may hold a stale `paid` value if another update
    // happened between when `s` was read and when this function runs,
    // causing cascading math errors in sequential delete operations.
    const fresh = SupabaseSync.getById(DB.students, studentId) || s;
    const ledgerCurrent = _feePaymentsForStudent(studentId, fresh)
      .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);
    const ledgerBefore = ledgerCurrent + Utils.safeNum(removedPaymentAmount || 0);
    const unrecordedInitial = Math.max(0, Utils.safeNum(fresh.paid) - ledgerBefore);
    const newPaid = ledgerCurrent + unrecordedInitial;
    const newDue = Math.max(0, Utils.safeNum(fresh.total_fee) - newPaid);
    SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue }, { bypassLog: true });
    return { paid: newPaid, due: newDue };
  }

  /* ── State ── */
  let searchQuery  = '';
  let filterBatch  = '';
  let filterCourse = '';
  let filterStatus = '';
  let editingId    = null;
  let currentPage  = 1;
  let pageSize     = 20;

  // Filter persistence: batch/course/status/page only (search is session-local, not restored)
  function _saveFilterState() {
    sessionStorage.setItem('wfa_students_batch', filterBatch);
    sessionStorage.setItem('wfa_students_course', filterCourse);
    sessionStorage.setItem('wfa_students_status', filterStatus);
    sessionStorage.setItem('wfa_students_page', String(currentPage));
  }

  function _loadFilterState() {
    filterBatch  = sessionStorage.getItem('wfa_students_batch') || '';
    filterCourse = Utils.decodeHtmlEntities(sessionStorage.getItem('wfa_students_course') || '');
    filterStatus = sessionStorage.getItem('wfa_students_status') || '';
    const savedPage = parseInt(sessionStorage.getItem('wfa_students_page') || '1', 10);
    currentPage = Number.isFinite(savedPage) && savedPage > 0 ? savedPage : 1;
    // Legacy: global search / old builds saved search text — drop so list is not blank
    sessionStorage.removeItem('wfa_students_search');
  }

  function _clearFilterState() {
    sessionStorage.removeItem('wfa_students_batch');
    sessionStorage.removeItem('wfa_students_course');
    sessionStorage.removeItem('wfa_students_status');
    sessionStorage.removeItem('wfa_students_page');
  }

  /* ══════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════ */
  function _normCourse(val) {
    return Utils.decodeHtmlEntities(String(val || '').trim());
  }

  function _courseOption(c, selectedVal) {
    const n = _normCourse(c);
    const sel = selectedVal != null && _normCourse(selectedVal) === n;
    return `<option value="${Utils.escAttr(n)}"${sel ? ' selected' : ''}>${Utils.esc(n)}</option>`;
  }

  /** Fix course fields that were saved with repeated &amp; encoding */
  function _repairCorruptedCourseFieldsOnce(all) {
    if (sessionStorage.getItem('wfa_students_course_repair_v1')) return false;
    let fixed = 0;
    for (const s of all) {
      if (!s?.course || !s?.id) continue;
      const clean = _normCourse(s.course);
      if (clean && clean !== s.course) {
        SupabaseSync.update(DB.students, s.id, { ...s, course: clean }, { bypassLog: true });
        fixed++;
      }
    }
    sessionStorage.setItem('wfa_students_course_repair_v1', '1');
    if (fixed > 0) console.info('[Students] Repaired corrupted course on', fixed, 'record(s)');
    return fixed > 0;
  }

  function _repairCorruptedStudentIdsOnce(all) {
    if (sessionStorage.getItem('wfa_student_id_repair_v2')) return false;

    // Direct mappings for Batch 19 adjustments
    const batch19PrefixReplacements = {
      'WFA-19019': 'WF-19019',
      'WFA-19020': 'WF-19020',
      'WFA-19021': 'WF-19021',
      'WFA-19022': 'WF-19022',
      'WFA-19023': 'WF-19023',
      'WFA-19024': 'WF-19024',
      'WFA-19025': 'WF-19025',
      'WFA-19026': 'WF-19026',
    };

    // Batch 20 sequenced replacements (sorted to match the database migration order)
    const batch20Students = all.filter(s => s.batch === '20');
    batch20Students.sort((a, b) => {
      const idA = a.student_id || '';
      const idB = b.student_id || '';
      return idA.localeCompare(idB);
    });

    const studentMappings = {};
    Object.entries(batch19PrefixReplacements).forEach(([k, v]) => {
      studentMappings[k] = v;
    });

    batch20Students.forEach((s, index) => {
      const seq = String(index + 1).padStart(3, '0');
      const newId = `WF-20${seq}`;
      studentMappings[s.student_id] = newId;
    });

    let fixed = 0;
    for (const s of all) {
      if (!s || !s.id || !s.student_id) continue;
      const targetId = studentMappings[s.student_id];
      if (targetId && targetId !== s.student_id) {
        const oldId = s.student_id;
        const newId = targetId;

        // 1. Update students table locally
        SupabaseSync.update(DB.students, s.id, { ...s, student_id: newId }, { bypassLog: true });

        // 2. Update local finance_ledger entries matching legacy id
        if (typeof SupabaseSync !== 'undefined') {
          const ledger = SupabaseSync.getAll('finance_ledger') || [];
          ledger.forEach(f => {
            if (f && f.ref_id === oldId) {
              SupabaseSync.update('finance_ledger', f.id, { ...f, ref_id: newId }, { bypassLog: true });
            }
          });

          // 3. Update local school_marks entries matching legacy id
          const marks = SupabaseSync.getAll('school_marks') || [];
          marks.forEach(m => {
            if (m && m.student_no === oldId) {
              SupabaseSync.update('school_marks', m.id, { ...m, student_no: newId }, { bypassLog: true });
            }
          });
        }

        fixed++;
      }
    }

    sessionStorage.setItem('wfa_student_id_repair_v2', '1');
    if (fixed > 0) {
      console.info('[Students] Repaired legacy student IDs on', fixed, 'records locally.');
    }
    return fixed > 0;
  }

  function _spUpdateStudentIdOnBatchInput() {
    const batchInput = document.getElementById('sf-batch');
    const idInput = document.getElementById('sf-sid');
    if (!batchInput || !idInput) return;

    const all = SupabaseSync.getAll(DB.students) || [];
    
    batchInput.addEventListener('input', () => {
      const val = batchInput.value.trim();
      // Extract digits from the batch name (e.g. "Batch 20" -> "20", "20" -> "20")
      const match = val.match(/\d+/);
      const batchNum = match ? match[0] : '';
      
      if (batchNum) {
        // Filter students in this batch
        const batchStudents = all.filter(s => {
          const sBatchMatch = String(s.batch || '').match(/\d+/);
          return sBatchMatch && sBatchMatch[0] === batchNum;
        });

        let nextSerial = 1;
        if (batchStudents.length > 0) {
          const serials = batchStudents.map(s => {
            const sidMatch = String(s.student_id || '').match(/(\d+)\s*$/);
            if (sidMatch) {
              const fullNumStr = sidMatch[1];
              const serialStr = fullNumStr.slice(-3);
              return parseInt(serialStr, 10) || 0;
            }
            return 0;
          });
          nextSerial = Math.max(...serials, 0) + 1;
        }

        const prefixKey = (window.InstitutionMode && InstitutionMode.getLabel)
          ? InstitutionMode.getLabel('student_id_prefix')
          : 'WF';
        const prefix = String(prefixKey === 'STU' ? 'WF' : prefixKey).toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        const paddedSerial = String(nextSerial).padStart(3, '0');
        idInput.value = `${prefix}-${batchNum}${paddedSerial}`;
      } else {
        const defaultPrefix = (window.InstitutionMode && InstitutionMode.getLabel('student_id_prefix') === 'STU') ? 'WF' : 'STU';
        idInput.value = `${defaultPrefix}-1001`;
      }
    });
  }

  function _normCourseList(list) {
    return [...new Set((list || []).map(c => _normCourse(c)).filter(Boolean))];
  }

  /** If filters hide every row but data exists, clear filters (fixes blank list until Reset). */
  function _sanitizeStaleFilters(all) {
    if (!all.length) return;
    const hasFilter = searchQuery || filterBatch || filterCourse || filterStatus;
    if (!hasFilter) return;
    if (applyFilters(all).length > 0) return;
    searchQuery = filterBatch = filterCourse = filterStatus = '';
    currentPage = 1;
    _clearFilterState();
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('পুরনো ফিল্টার মিলছিল না — পুরো তালিকা দেখানো হচ্ছে', 'info', 3500);
    }
  }

  function render() {
    _loadFilterState();
    const container = document.getElementById('students-content');
    if (!container) return;

    let all      = SupabaseSync.getAll(DB.students);
    if (_repairCorruptedCourseFieldsOnce(all)) all = SupabaseSync.getAll(DB.students);
    if (_repairCorruptedStudentIdsOnce(all)) all = SupabaseSync.getAll(DB.students);
    _sanitizeStaleFilters(all);
    // ✅ FIX: batch/course normalize করা হয়েছে যাতে '20' ও 20 (number) একই option হয়
    const batches  = [...new Set(all.map(s => String(s.batch  || '').trim()).filter(Boolean))].sort();
    const courses  = [...new Set(all.map(s => _normCourse(s.course)).filter(Boolean))].sort();
    // ✅ FIX: সর্বশেষ এড করা ডাটা সবার উপরে — created_at (insert time) দিয়ে primary sort,
    // admission_date দিয়ে secondary sort (একই insert time হলে)
    const sorted = [...all].sort((a, b) => {
      const ca = a.created_at || a.admission_date || '';
      const cb = b.created_at || b.admission_date || '';
      if (cb !== ca) {
        return cb.localeCompare(ca);
      }
      const da = a.admission_date || '';
      const db = b.admission_date || '';
      if (db !== da) {
        return db.localeCompare(da);
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    const filtered = applyFilters(sorted);

    /* Summary row */
    const totalFee  = filtered.reduce((s,r) => s + Utils.safeNum(r.total_fee), 0);
    const totalPaid = filtered.reduce((s,r) => s + Utils.safeNum(r.paid), 0);
    const totalDue  = filtered.reduce((s,r) => s + Utils.safeNum(r.due), 0);

    const courseLabel = _instLabel('course_label', 'Course');
    const batchLabel = _instLabel('batch_label', 'Batch');
    const sessionLabel = _instLabel('session_label', 'Session');

    container.innerHTML = `
      <!-- Summary Cards -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        ${sCard('fa-users','blue','Total Students', filtered.length,'#00e5ff')}
        ${sCard('fa-money-bill-wave','amber','Total Fee', Utils.takaEn(totalFee),'#ffaa00')}
        ${sCard('fa-circle-check','green','Paid', Utils.takaEn(totalPaid),'#00ff88')}
        ${sCard('fa-circle-xmark','red','Due', Utils.takaEn(totalDue),'#ff4757')}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="stu-search" class="form-control" placeholder="Search by Name / ID / Phone / ${Utils.esc(batchLabel)}…" value="${Utils.escAttr(searchQuery)}" oninput="Students.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Students.onFilter('batch',this.value)">
          <option value="">All ${Utils.esc(batchLabel)}s</option>
          ${batches.map(b=>`<option value="${Utils.escAttr(b)}" ${filterBatch===b?'selected':''}>${Utils.esc(b)}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Students.onFilter('course',this.value)">
          <option value="">All ${Utils.esc(courseLabel)}s</option>
          ${courses.map(c => _courseOption(c, filterCourse)).join('')}
        </select>
        <select class="form-control" onchange="Students.onFilter('status',this.value)">
          <option value="">All Status</option>
          <option value="Active"   ${filterStatus==='Active'  ?'selected':''}>Active</option>
          <option value="Inactive" ${filterStatus==='Inactive'?'selected':''}>Inactive</option>
        </select>
        <button class="btn-secondary btn-sm" onclick="Students.resetFilters()"><i class="fa fa-rotate-left"></i> Reset</button>
        <button class="btn-success btn-sm"   onclick="Students.exportExcel()"><i class="fa fa-file-excel"></i> Excel</button>
        <button class="btn-secondary btn-sm" onclick="Utils.printArea('students-print-area')"><i class="fa fa-print"></i> Print</button>
      </div>

      <!-- Table -->
      <div id="students-print-area">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Student ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>${Utils.esc(courseLabel)}</th>
                <th>${Utils.esc(batchLabel)}</th>
                <th>${Utils.esc(sessionLabel)}</th>
                <th>Total Fee</th>
                <th>Pay</th>
                <th>Due</th>
                <th>Status</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody id="students-tbody">
              ${(() => {
                const pageData = Utils.paginate(filtered, currentPage, pageSize);
                return renderRows(pageData.items, (currentPage - 1) * pageSize);
              })()}
            </tbody>
          </table>
        </div>
        ${(() => {
          const pageData = Utils.paginate(filtered, currentPage, pageSize);
          return (pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'Students') : '';
        })()}

        <!-- Totals Footer -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;padding:14px 18px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);border-radius:10px;align-items:center">
          <span style="font-size:0.72rem;font-weight:800;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-right:4px">Σ Summary:</span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-users" style="color:#00e5ff;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">STUDENTS</span>
            <span style="font-size:0.92rem;font-weight:800;color:#00e5ff">${filtered.length}</span>
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-money-bill-wave" style="color:#ffaa00;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">TOTAL FEE</span>
            <span style="font-size:0.92rem;font-weight:800;color:#ffaa00;font-family:var(--font-ui)">${Utils.takaEn(totalFee)}</span>
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-circle-check" style="color:#00ff88;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">PAID</span>
            <span style="font-size:0.92rem;font-weight:800;color:#00ff88;font-family:var(--font-ui)">${Utils.takaEn(totalPaid)}</span>
          </span>
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.2);border-radius:20px;padding:4px 14px">
            <i class="fa fa-circle-xmark" style="color:#ff4757;font-size:0.72rem"></i>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600">DUE</span>
            <span style="font-size:0.92rem;font-weight:800;color:#ff4757;font-family:var(--font-ui)">${Utils.takaEn(totalDue)}</span>
          </span>
          ${(searchQuery||filterBatch||filterCourse||filterStatus)?`<span style="font-size:0.72rem;color:rgba(255,255,255,0.3);margin-left:auto">${filtered.length} of ${all.length} students</span>`:''}
        </div>
      </div>
    `;
  }

  function renderRows(rows, startIndex = 0) {
    if (!rows.length) return Utils.noDataRow(12, 'No students found');
    return rows.map((s, i) => `
      <tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${startIndex + i + 1}</td>
        <td><span class="badge badge-primary">${Utils.esc(s.student_id)||'—'}</span></td>
        <td>
          <div style="font-weight:600">${Utils.esc(s.name)}</div>
          ${s.email ? `<div style="font-size:0.75rem;color:var(--text-muted)">${Utils.esc(s.email)}</div>` : ''}
        </td>
        <td>${Utils.esc(s.phone)||'—'}</td>
        <td>${Utils.displayText(s.course)||'—'}</td>
        <td>${Utils.esc(s.batch)||'—'}</td>
        <td>${Utils.esc(s.session)||'—'}</td>
        <td style="font-family:var(--font-en)">${Utils.takaEn(s.total_fee)}</td>
        <td class="ledger-income">${Utils.takaEn(s.paid)}</td>
        <td class="${Utils.safeNum(s.due)>0?'ledger-expense':''}">${Utils.takaEn(s.due)}</td>
        <td>${Utils.statusBadge(s.status||'Active')}</td>
        <td class="no-print">
          <button class="btn-primary btn-xs" onclick="Students.openManageAction('${Utils.escAttr(s.id)}')" style="background:var(--brand-primary);color:var(--bg-base);font-weight:700;border-radius:20px;padding:4px 14px">
            <i class="fa fa-sliders"></i> MANAGE
          </button>
        </td>
      </tr>`).join('');
  }

  function sCard(icon, color, label, value, valColor) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fa ${icon}"></i></div>
      <div class="stat-info"><div class="stat-label">${label}</div><div class="stat-value" style="color:${valColor||'inherit'};text-shadow:0 0 10px ${valColor?valColor+'55':'transparent'}">${value}</div></div>
    </div>`;
  }

  /* ══════════════════════════════════════════
     FILTERS
  ══════════════════════════════════════════ */
  function applyFilters(rows) {
    let r = rows;
    if (searchQuery)  r = Utils.searchFilter(r, searchQuery, ['name','student_id','phone','email','batch']);
    // ✅ FIX: trim + string comparison — strict equality miss করত যদি batch
    // number হিসেবে store হয় (20 vs '20') বা whitespace থাকে (' 20')
    if (filterBatch)  r = r.filter(s => String(s.batch  || '').trim() === String(filterBatch).trim());
    if (filterCourse) r = r.filter(s => _normCourse(s.course) === _normCourse(filterCourse));
    if (filterStatus) r = r.filter(s => (s.status||'Active') === filterStatus);
    return r;
  }

  const debouncedRender = Utils.debounce(() => render(), 250);

  function onSearch(val) {
    searchQuery = val;
    currentPage = 1;
    _saveFilterState(); // ✅ BUG #3 FIX: Save filter
    debouncedRender();
  }

  function onFilter(type, val) {
    if (type === 'batch')  filterBatch  = val;
    if (type === 'course') filterCourse = val;
    if (type === 'status') filterStatus = val;
    currentPage = 1;
    _saveFilterState(); // ✅ BUG #3 FIX: Save filter
    render();
  }

  function resetFilters() {
    searchQuery = filterBatch = filterCourse = filterStatus = '';
    currentPage = 1;
    _clearFilterState(); // ✅ BUG #3 FIX: Clear saved filters
    render();
  }

  function changePage(p) { currentPage = p; _saveFilterState(); render(); }
  function changePageSize(s) { pageSize = parseInt(s, 10); currentPage = 1; _saveFilterState(); render(); }

  function _isSchoolMode() {
    return !!(window.InstitutionMode && InstitutionMode.isSchoolLike());
  }

  function _instLabel(key, fallback) {
    return (window.InstitutionMode && InstitutionMode.getLabel(key)) || fallback;
  }

  const _SCHOOL_CLASSES = ['৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম', 'একাদশ', 'দ্বাদশ'];
  const _SCHOOL_SECTIONS = ['A', 'B', 'C', 'D', 'E'];
  const _SCHOOL_SHIFTS = ['Morning', 'Day', 'Evening'];

  function _schoolClassOptions(selected) {
    return _SCHOOL_CLASSES.map((c) => {
      const sel = selected && _normCourse(selected) === c ? 'selected' : '';
      return `<option value="${Utils.escAttr(c)}" ${sel}>${Utils.esc(c)}</option>`;
    }).join('');
  }

  function _schoolSectionOptions(selected) {
    const val = String(selected || '').trim().toUpperCase();
    const opts = _SCHOOL_SECTIONS.map((sec) =>
      `<option value="${sec}" ${val === sec ? 'selected' : ''}>${sec}</option>`
    ).join('');
    return `<option value="">-- Section --</option>${opts}`;
  }

  function _schoolShiftOptions(selected) {
    const val = String(selected || '').trim();
    return _SCHOOL_SHIFTS.map((shift) =>
      `<option value="${shift}" ${val === shift ? 'selected' : ''}>${shift}</option>`
    ).join('');
  }

  function _buildAddFamilyFields() {
    if (!_isSchoolMode()) return '';
    return `
          <div class="sf-grid-2" style="margin-top:12px;">
            <div class="sf-field">
              <label class="sf-label">Mother's Name</label>
              <input id="sf-mother" class="sf-input" placeholder="Mother's name" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Guardian Phone <span class="req">*</span></label>
              <input id="sf-guardian-phone" class="sf-input" placeholder="Guardian contact number" maxlength="25" inputmode="tel" />
            </div>
          </div>`;
  }

  function _buildAddCourseBatchSection(courses) {
    if (!_isSchoolMode()) {
      return `
        <!-- SECTION: Course -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-graduation-cap"></i> Course & Batch</div>
          <div class="sf-grid-3">
            <div class="sf-field">
              <label class="sf-label">Course <span class="req">*</span></label>
              <select id="sf-course" class="sf-input sf-select">
                <option value="">-- Select Course --</option>
                ${courses.map(c => _courseOption(c)).join('')}
              </select>
            </div>
            <div class="sf-field">
              <label class="sf-label">Batch <span class="req">*</span></label>
              <input id="sf-batch" class="sf-input" placeholder="e.g.: Batch-12" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Session</label>
              <input id="sf-session" class="sf-input" placeholder="e.g.: 2024-25" />
            </div>
          </div>
        </div>`;
    }

    const classLabel = _instLabel('course_label', 'Class');
    const sectionLabel = _instLabel('batch_label', 'Section');
    const yearLabel = _instLabel('session_label', 'Academic Year');
    return `
        <!-- SECTION: School Class -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-school"></i> ${classLabel} & ${sectionLabel}</div>
          <div class="sf-grid-3" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">${classLabel} <span class="req">*</span></label>
              <select id="sf-course" class="sf-input sf-select">
                <option value="">-- Select ${classLabel} --</option>
                ${_schoolClassOptions()}
              </select>
            </div>
            <div class="sf-field">
              <label class="sf-label">${sectionLabel} <span class="req">*</span></label>
              <select id="sf-batch" class="sf-input sf-select">
                ${_schoolSectionOptions()}
              </select>
            </div>
            <div class="sf-field">
              <label class="sf-label">Roll No <span class="req">*</span></label>
              <input id="sf-roll" class="sf-input" placeholder="e.g. 15" inputmode="numeric" />
            </div>
          </div>
          <div class="sf-grid-2">
            <div class="sf-field">
              <label class="sf-label">Shift</label>
              <select id="sf-shift" class="sf-input sf-select">
                <option value="">-- Shift --</option>
                ${_schoolShiftOptions()}
              </select>
            </div>
            <div class="sf-field">
              <label class="sf-label">${yearLabel} <span class="req">*</span></label>
              <input id="sf-session" class="sf-input" placeholder="e.g. ${Utils.escAttr((window.SchoolEngine && SchoolEngine.getDefaultAcademicYear) ? SchoolEngine.getDefaultAcademicYear() : new Date().getFullYear())}" value="${Utils.escAttr((window.SchoolEngine && SchoolEngine.getDefaultAcademicYear) ? SchoolEngine.getDefaultAcademicYear() : String(new Date().getFullYear()))}" />
            </div>
          </div>
        </div>`;
  }

  function _buildEditFamilyFields(s) {
    if (!_isSchoolMode()) return '';
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Mother's Name</label>
          <input id="sf-mother" class="form-control" value="${Utils.escAttr(s.mother_name || '')}" />
        </div>
        <div class="form-group">
          <label>Guardian Phone <span class="req">*</span></label>
          <input id="sf-guardian-phone" class="form-control" value="${Utils.escAttr(s.guardian_phone || '')}" maxlength="25" inputmode="tel" />
        </div>
      </div>`;
  }

  function _buildEditCourseBatchSection(courses, s) {
    if (!_isSchoolMode()) {
      return `
      <div class="form-row-3">
        <div class="form-group">
          <label>Course</label>
          <select id="sf-course" class="form-control">
            <option value="">-- Select Course --</option>
            ${courses.map(c => _courseOption(c, s.course)).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Batch</label>
          <input id="sf-batch" class="form-control" value="${Utils.escAttr(s.batch||'')}" />
        </div>
        <div class="form-group">
          <label>Session</label>
          <input id="sf-session" class="form-control" value="${Utils.escAttr(s.session||'')}" />
        </div>
      </div>`;
    }

    const classLabel = _instLabel('course_label', 'Class');
    const sectionLabel = _instLabel('batch_label', 'Section');
    const yearLabel = _instLabel('session_label', 'Academic Year');
    return `
      <div class="form-row-3">
        <div class="form-group">
          <label>${classLabel}</label>
          <select id="sf-course" class="form-control">
            <option value="">-- Select ${classLabel} --</option>
            ${_schoolClassOptions(s.course)}
          </select>
        </div>
        <div class="form-group">
          <label>${sectionLabel}</label>
          <select id="sf-batch" class="form-control">
            ${_schoolSectionOptions(s.batch)}
          </select>
        </div>
        <div class="form-group">
          <label>Roll No</label>
          <input id="sf-roll" class="form-control" value="${Utils.escAttr(s.roll_no || '')}" inputmode="numeric" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Shift</label>
          <select id="sf-shift" class="form-control">
            <option value="">-- Shift --</option>
            ${_schoolShiftOptions(s.shift)}
          </select>
        </div>
        <div class="form-group">
          <label>${yearLabel}</label>
          <input id="sf-session" class="form-control" value="${Utils.escAttr(s.session || '')}" placeholder="e.g. 2025" />
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════
     ADD MODAL
  ══════════════════════════════════════════ */
  function openAddModal() {
    editingId = null;
    const all = SupabaseSync.getAll(DB.students);
    const newId = Utils.generateStudentId(all.map(s => s.student_id));
    const today = Utils.today();
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = _normCourseList(cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both']);

    Utils.openModal('<i class="fa fa-user-graduate"></i> Add Student', `
      <style>
        .sf-modal-wrap { display:flex; flex-direction:column; gap:0; }
        .sf-section { margin-bottom:20px; }
        .sf-section-title {
          font-size:0.7rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
          color:var(--brand-primary); margin-bottom:10px; padding-bottom:6px;
          border-bottom:1px solid rgba(0,212,255,0.15);
          display:flex; align-items:center; gap:6px;
        }
        .sf-section-title i { font-size:0.75rem; }
        .sf-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .sf-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
        .sf-field { display:flex; flex-direction:column; gap:5px; }
        .sf-label {
          font-size:0.72rem; font-weight:600; letter-spacing:0.8px; text-transform:uppercase;
          color:var(--text-muted);
        }
        .sf-label .req { color:#ff4d6d; margin-left:2px; }
        .sf-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius:8px;
          color: var(--text-primary);
          font-size:0.88rem;
          padding:10px 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline:none;
          width:100%;
          box-sizing:border-box;
        }
        .sf-input:focus {
          border-color: rgba(0,212,255,0.6);
          box-shadow: 0 0 0 3px rgba(0,212,255,0.1), 0 0 12px rgba(0,212,255,0.15);
        }
        .sf-input::placeholder { color: rgba(255,255,255,0.25); }
        .sf-select {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius:8px;
          color: var(--text-primary);
          font-size:0.88rem;
          padding:10px 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline:none;
          width:100%;
          box-sizing:border-box;
          cursor:pointer;
        }
        .sf-select:focus {
          border-color: rgba(0,212,255,0.6);
          box-shadow: 0 0 0 3px rgba(0,212,255,0.1);
        }
        .sf-readonly {
          background: rgba(0,212,255,0.05) !important;
          border-color: rgba(0,212,255,0.1) !important;
          color: var(--brand-primary) !important;
          font-weight:700;
          cursor:default;
        }
        .sf-amount-wrap { position:relative; }
        .sf-taka {
          position:absolute; left:12px; top:50%; transform:translateY(-50%);
          color:var(--brand-primary); font-weight:700; font-size:0.9rem; pointer-events:none;
        }
        .sf-amount-wrap .sf-input { padding-left:28px; }
        .sf-due-field .sf-input {
          background: rgba(255,77,109,0.08) !important;
          border-color: rgba(255,77,109,0.25) !important;
          color: #ff4d6d !important;
          font-weight:700;
        }
        .sf-save-btn {
          width:100%; padding:13px; border:none; border-radius:10px; cursor:pointer;
          font-size:0.95rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          color:#fff;
          box-shadow: 0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(123,47,247,0.2);
          transition: filter 0.2s, transform 0.1s;
          margin-top:6px;
        }
        .sf-save-btn:hover { filter:brightness(1.15); transform:translateY(-1px); }
        .sf-cancel-btn {
          padding:11px 20px; border:1px solid rgba(255,255,255,0.15); border-radius:10px;
          background:transparent; color:var(--text-muted); font-size:0.88rem; cursor:pointer;
          transition:border-color 0.2s;
        }
        .sf-cancel-btn:hover { border-color:rgba(255,255,255,0.35); color:var(--text-primary); }
        .sf-actions { display:flex; gap:10px; align-items:center; margin-top:4px; }
        .sf-actions .sf-save-btn { flex:1; margin-top:0; }
      </style>

      <div class="sf-modal-wrap">

        <!-- SECTION: Basic Info -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-id-card"></i> Student Information</div>
          <div class="sf-grid-2" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">Student ID <span class="req">*</span></label>
              <input id="sf-sid" class="sf-input sf-readonly" value="${newId}" readonly />
            </div>
            <div class="sf-field">
              <label class="sf-label">Admission Date</label>
              ${Students._dateSelectHTML('sf-date', today, 'sf-input sf-select')}
            </div>
          </div>
          <div class="sf-grid-2" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">Full Name <span class="req">*</span></label>
              <input id="sf-name" class="sf-input" placeholder="Student's full name" maxlength="100" autocomplete="name" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Phone Number <span class="req">*</span></label>
              <input id="sf-phone" class="sf-input" placeholder="e.g. 01XXXXXXXXX or +1 555-123-4567" maxlength="25" inputmode="tel" />
            </div>
          </div>
          <div class="sf-grid-2">
            <div class="sf-field">
              <label class="sf-label">Email</label>
              <input id="sf-email" type="email" class="sf-input" placeholder="email@example.com" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Father's Name</label>
              <input id="sf-father" class="sf-input" placeholder="Father's name" />
            </div>
          </div>
          ${_buildAddFamilyFields()}
        </div>

        ${_buildAddCourseBatchSection(courses)}

        <!-- SECTION: Fee -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-money-bill-wave"></i> Fee & Payment</div>
          <div class="sf-grid-3" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">Total Fee (৳) <span class="req">*</span></label>
              <div class="sf-amount-wrap">
                <span class="sf-taka">৳</span>
                <input id="sf-total-fee" type="number" class="sf-input" placeholder="0" oninput="Students.calcDue()" />
              </div>
            </div>
            <div class="sf-field">
              <label class="sf-label">Paid (৳)</label>
              <div class="sf-amount-wrap">
                <span class="sf-taka">৳</span>
                <input id="sf-paid" type="number" class="sf-input" placeholder="0" value="0" oninput="Students.calcDue()" />
              </div>
            </div>
            <div class="sf-field sf-due-field">
              <label class="sf-label">Due (৳)</label>
              <div class="sf-amount-wrap">
                <span class="sf-taka" style="color:#ff4d6d;">৳</span>
                <input id="sf-due" type="number" class="sf-input" placeholder="0" readonly />
              </div>
            </div>
          </div>
          <div class="sf-field">
            <label class="sf-label">Payment Method <span class="req">*</span></label>
            <select id="sf-method" class="sf-select" onchange="Utils.onPaymentMethodChange(this, 'sf-bal-display')">
              <option value="">Select Payment Method...</option>
              ${Utils.getPaymentMethodsHTML()}
            </select>
            <div id="sf-bal-display" style="display:none;"></div>
          </div>
        </div>

        <!-- SECTION: Other -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-circle-info"></i> Additional Info</div>
          <div class="sf-grid-2" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">Address</label>
              <input id="sf-address" class="sf-input" placeholder="Present address" maxlength="300" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Status</label>
              <select id="sf-status" class="sf-select">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div class="sf-field">
            <label class="sf-label">Notes</label>
            <textarea id="sf-note" class="sf-input" rows="2" placeholder="Any special remarks..." style="resize:vertical; min-height:60px;"></textarea>
          </div>
        </div>

        <div id="sf-error" class="form-error hidden" style="margin-bottom:8px;"></div>
        <div class="sf-actions">
          <button class="sf-cancel-btn" onclick="Utils.closeModal()">Cancel</button>
          <button class="sf-save-btn" onclick="Students.saveStudent()">
            <i class="fa fa-floppy-disk" style="margin-right:7px;"></i> Save Student
          </button>
        </div>
      </div>
    `, 'modal-lg');
    _spUpdateStudentIdOnBatchInput();
  }


  /* ══════════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════════ */
  function openEditModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    editingId = id;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = _normCourseList(cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both']);

    Utils.openModal('<i class="fa fa-pen"></i> Student Edit', `
      <div class="form-row">
        <div class="form-group">
          <label>Student ID</label>
          <input id="sf-sid" class="form-control" value="${Utils.escAttr(s.student_id||'')}" readonly style="background:var(--bg-surface)" />
        </div>
        <div class="form-group">
          <label>Admission Date</label>
          ${Students._dateSelectHTML('sf-date', (s.admission_date||'').split('T')[0], 'form-control')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="sf-name" class="form-control" value="${Utils.escAttr(s.name||'')}" maxlength="100" />
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input id="sf-phone" class="form-control" value="${Utils.escAttr(s.phone||'')}" maxlength="25" inputmode="tel" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input id="sf-email" type="email" class="form-control" value="${Utils.escAttr(s.email||'')}" />
        </div>
        <div class="form-group">
          <label>Father Name</label>
          <input id="sf-father" class="form-control" value="${Utils.escAttr(s.father_name||'')}" />
        </div>
      </div>
      ${_buildEditFamilyFields(s)}
      ${_buildEditCourseBatchSection(courses, s)}
      <div class="form-row-3">
        <div class="form-group">
          <label>Total Fee (৳)</label>
          <input id="sf-total-fee" type="number" class="form-control" value="${s.total_fee||0}" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:5px">Paid (৳) <i class="fa fa-lock" style="font-size:0.7rem;color:#ffaa00;" title="Managed via Installment"></i></label>
          <input id="sf-paid" type="number" class="form-control" value="${s.paid||0}" readonly style="background:var(--bg-surface);cursor:not-allowed;color:#00ff88;font-weight:700;" />
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:5px">Due (৳) <i class="fa fa-lock" style="font-size:0.7rem;color:#ffaa00;"></i></label>
          <input id="sf-due" type="number" class="form-control" value="${s.due||0}" readonly style="background:var(--bg-surface);cursor:not-allowed;color:#ff4757;font-weight:700;" />
        </div>
      </div>
      <div style="background:rgba(255,170,0,0.07);border:1px solid rgba(255,170,0,0.3);border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px;">
        <i class="fa fa-circle-info" style="color:#ffaa00;margin-top:2px;flex-shrink:0;"></i>
        <div style="font-size:0.82rem;color:#ffaa00;line-height:1.5;">
          <strong>Payment amount is auto-calculated</strong> from the finance ledger.
          To add or remove a payment, close this window and use the
          <strong style="color:#00d4ff;"><i class="fa fa-money-bill-wave"></i> Installment</strong> button on the student row.
        </div>
      </div>
      <div class="form-group">
        <label>Payment Method (if paying now) <span class="req">*</span></label>
        <select id="sf-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'sf-bal-display')">
          <option value="">Select Method...</option>
          ${Utils.getPaymentMethodsHTML()}
        </select>
        <div id="sf-bal-display" style="display:none;"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Address</label>
          <input id="sf-address" class="form-control" value="${Utils.escAttr(s.address||'')}" maxlength="300" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="sf-status" class="form-control">
            <option value="Active"   ${(s.status||'Active')==='Active'  ?'selected':''}>Active</option>
            <option value="Inactive" ${s.status==='Inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="sf-note" class="form-control" rows="2">${Utils.esc(s.note||'')}</textarea>
      </div>
      <div id="sf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Students.saveStudent()"><i class="fa fa-floppy-disk"></i> Update</button>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     MANAGE ACTION MENU
  ══════════════════════════════════════════ */
  function openManageAction(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    const eid = Utils.escAttr(id);
    const ename = Utils.escAttr(s.name);

    // CSS for the glowing buttons
    const style = `
      <style>
        .action-btn-glow {
          display: block; width: 100%; margin-bottom: 12px; padding: 12px;
          border-radius: 8px; border: none; font-weight: 800; font-size: 0.9rem;
          text-align: center; cursor: pointer; text-transform: uppercase;
          transition: transform 0.2s, filter 0.2s;
          color: #000; letter-spacing: 0.5px;
        }
        .action-btn-glow:hover { transform: scale(1.02); filter: brightness(1.2); }
        .action-btn-glow i { margin-right: 8px; filter: drop-shadow(0 0 4px rgba(0,0,0,0.5)); }
        
        .btn-yellow  { background: linear-gradient(90deg, #ffdc3a, #ff9e00); box-shadow: 0 0 15px rgba(255, 158, 0, 0.4); }
        .btn-cyan    { background: linear-gradient(90deg, #00f2fe, #4facfe); box-shadow: 0 0 15px rgba(0, 242, 254, 0.4); }
        .btn-orange  { background: linear-gradient(90deg, #f6d365, #fda085); box-shadow: 0 0 15px rgba(253, 160, 133, 0.4); }
        .btn-green   { background: linear-gradient(90deg, #00ff87, #60efff); box-shadow: 0 0 15px rgba(0, 255, 135, 0.4); }
        .btn-purple  { background: linear-gradient(90deg, #b224ef, #7579ff); box-shadow: 0 0 15px rgba(178, 36, 239, 0.4); color: #fff; }
        .btn-grey    { background: linear-gradient(90deg, #8e9eab, #eef2f3); box-shadow: 0 0 15px rgba(142, 158, 171, 0.4); }
        .btn-red     { background: linear-gradient(90deg, #ff0844, #ffb199); box-shadow: 0 0 15px rgba(255, 8, 68, 0.4); color: #fff; }
        .btn-white   { background: #ffffff; color: #000; box-shadow: 0 0 15px rgba(255, 255, 255, 0.4); }
      </style>
    `;

    Utils.openModal('<i class="fa fa-sliders"></i> Select Action', `
      ${style}
      <div style="text-align:center; margin-bottom: 20px;">
        <div style="font-weight:700;font-size:1.1rem;color:var(--brand-primary);">${Utils.esc(s.name)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">ID: ${Utils.esc(s.student_id)}</div>
      </div>
      
      <button class="action-btn-glow btn-yellow" onclick="Utils.closeModal(); setTimeout(()=>Students.openPayModal('${eid}'), 400)">
        <i class="fa fa-plus-circle"></i> ADD INSTALLMENT
      </button>
      
      <button class="action-btn-glow btn-cyan" onclick="IDCardsModule && IDCardsModule.previewCard('${eid}')">
        <i class="fa fa-id-badge"></i> VIEW ID CARD
      </button>
      
      <button class="action-btn-glow btn-orange" onclick="CertificatesModule && CertificatesModule.previewCertificate('${eid}')">
        <i class="fa fa-award"></i> GENERATE CERTIFICATE
      </button>
      
      <button class="action-btn-glow btn-green" onclick="Utils.closeModal(); setTimeout(()=>Students.openEditModal('${eid}'), 400)">
        <i class="fa fa-user-pen"></i> EDIT PROFILE
      </button>

      <button class="action-btn-glow btn-yellow" style="background: linear-gradient(90deg, #b224ef, #7579ff); color: white; box-shadow: 0 0 15px rgba(178, 36, 239, 0.4);" onclick="Utils.closeModal(); setTimeout(()=>Students.openPortalAccessModal('${eid}'), 400)">
        <i class="fa fa-key"></i> PORTAL ACCESS / পিন
      </button>
      
      <button class="action-btn-glow btn-purple" onclick="Students.printReceipt('${eid}')">
        <i class="fa fa-print"></i> PRINT RECEIPT
      </button>
      
      <button class="action-btn-glow btn-grey" onclick="Students.setReminder('${eid}','${ename}')">
        <i class="fa fa-bell"></i> SET REMINDER
      </button>
      
      <button class="action-btn-glow btn-red" onclick="Utils.closeModal(); setTimeout(()=>Students.deleteStudent('${eid}'), 400)">
        <i class="fa fa-trash"></i> DELETE
      </button>
      
      <button class="action-btn-glow btn-white" style="margin-top:24px" onclick="Utils.closeModal()">
        CLOSE MENU
      </button>
    `, 'modal-sm');
  }

  /* ══════════════════════════════════════════
     PORTAL ACCESS MANAGEMENT (FEATURE 1)
  ══════════════════════════════════════════ */
  async function openPortalAccessModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    const eid = Utils.escAttr(id);

    const accessRecords = SupabaseSync.getAll('student_portal_access') || [];
    const access = accessRecords.find(a => a.student_id === id);

    const isActive = access ? !!access.is_active : false;
    const phone = s.phone || '';

    Utils.openModal('<i class="fa fa-key"></i> Student Portal Access', `
      <div style="margin-bottom: 16px; text-align: center;">
        <div style="font-weight:700;font-size:1.15rem;color:var(--brand-primary);">${Utils.esc(s.name)}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">ID: ${Utils.esc(s.student_id)}</div>
      </div>
      
      <div class="form-group mb-12">
        <label class="settings-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="portal-active" ${isActive ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer" />
          <span>PORTAL ACCESS ENABLED (সচল করুন)</span>
        </label>
      </div>

      <div class="form-group mb-12">
        <label class="settings-label">REGISTERED PHONE (মোবাইল নম্বর)</label>
        <input type="text" id="portal-phone" class="form-control" value="${Utils.escAttr(phone)}" disabled style="opacity:0.7;background:rgba(255,255,255,0.05)" />
        <small class="settings-sublabel">স্টুডেন্ট এই মোবাইল নম্বর ব্যবহার করে লগইন করবেন।</small>
      </div>

      <div class="form-group mb-12">
        <label class="settings-label">SET 4-DIGIT PIN (৪-ডিজিটের পিন নম্বর)</label>
        <input type="password" id="portal-pin" class="form-control" placeholder="${access ? '•••• (পিন পরিবর্তন করতে নতুন পিন লিখুন)' : '৪ ডিজিটের পিন নম্বর লিখুন'}" maxlength="4" autocomplete="off" />
        <small class="settings-sublabel">খালি রাখলে আগের পিন অপরিবর্তিত থাকবে। নতুন পিন সেট করতে এখানে ৪টি সংখ্যা লিখুন।</small>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">
        <button class="btn-secondary" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-success" onclick="Students.savePortalAccess('${eid}')">SAVE SETTINGS</button>
      </div>
    `, 'modal-sm');
  }

  async function savePortalAccess(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;

    const isActive = document.getElementById('portal-active').checked;
    const pin = document.getElementById('portal-pin').value.trim();

    const accessRecords = SupabaseSync.getAll('student_portal_access') || [];
    const access = accessRecords.find(a => a.student_id === id);

    let pinHash = access ? access.pin_hash : '';

    if (pin) {
      if (pin.length !== 4 || isNaN(pin)) {
        Utils.toast('পিন নম্বর অবশ্যই ৪ ডিজিটের সংখ্যা হতে হবে! ❌', 'error');
        return;
      }
      pinHash = await _hashPin(pin);
    } else if (!access) {
      Utils.toast('নতুন পোর্টাল সচল করতে পিন নম্বর সেট করা বাধ্যতামূলক! ❌', 'error');
      return;
    }

    const record = {
      student_id: id,
      student_name: s.name,
      phone: s.phone.replace(/[\s-]/g, ''),
      pin_hash: pinHash,
      is_active: isActive
    };

    try {
      if (access) {
        SupabaseSync.update('student_portal_access', access.id, record);
      } else {
        record.id = SupabaseSync.generateId();
        record.created_at = new Date().toISOString();
        SupabaseSync.insert('student_portal_access', record);
      }
      Utils.toast('Portal access configuration saved! ✅', 'success');
      Utils.closeModal();
    } catch (err) {
      console.error('[PortalAccess] Save error:', err);
      Utils.toast('সংরক্ষণ করতে সমস্যা হয়েছে! ❌', 'error');
    }
  }

  async function _hashPin(pin) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      const salt = 'wfa_2026_';
      const salted = salt + pin + pin.length.toString(16);
      let h = 0x811c9dc5;
      for (let round = 0; round < 3; round++) {
        const input = round === 0 ? salted : salted + (h >>> 0).toString(16);
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 0x01000193);
        }
      }
      const h1 = (h >>> 0).toString(16).padStart(8, '0');
      const h2 = ((h >>> 0) ^ 0x9e3779b9 >>> 0).toString(16).padStart(8, '0');
      return h1 + h2;
    }
  }

  /* ══════════════════════════════════════════
     PAYMENT HISTORY & INSTALLMENTS MODAL
  ══════════════════════════════════════════ */
  function openPayModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    const eid = Utils.escAttr(id);

    const allFinance = SupabaseSync.getAll(DB.finance);
    // Match by UUID (new) OR by student_id string (legacy) for backward compatibility
    const history = allFinance
      .filter(f => f.category === 'Student Fee' && (f.ref_id === id || f.ref_id === s.student_id))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalFee  = Utils.safeNum(s.total_fee);
    const totalPaid = Utils.safeNum(s.paid);
    const totalDue  = Utils.safeNum(s.due);
    const paidPct   = totalFee > 0 ? Math.min(100, Math.round((totalPaid / totalFee) * 100)) : 0;
    const barColor  = paidPct >= 100 ? '#00ff88' : paidPct >= 50 ? '#ffaa00' : '#ff4757';

    // Detect any initial paid amount NOT recorded in finance ledger
    // (e.g. student added with a paid amount but without selecting a payment method)
    const sumOfFinanceEntries = history.reduce((acc, f) => acc + Utils.safeNum(f.amount), 0);
    const unrecordedInitial   = Math.max(0, totalPaid - sumOfFinanceEntries);

    // Build rows — prepend a ghost row for the unrecorded initial payment if present
    let rowIndex    = 0;
    let runningTotal = 0;
    let historyTableRows = '';

    if (unrecordedInitial > 0) {
      runningTotal += unrecordedInitial;
      rowIndex++;
      const remAfterInit = Math.max(0, totalFee - runningTotal);
      historyTableRows +=
        '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,170,0,0.04)">' +
          '<td style="padding:10px 12px;color:var(--text-muted);font-size:0.82rem">' + rowIndex + '</td>' +
          '<td style="padding:10px 12px;font-size:0.82rem;color:var(--text-muted)">' + Utils.formatDateDMY(s.admission_date) + '</td>' +
          '<td style="padding:10px 12px"><span class="badge badge-warning" title="Method not recorded at admission">—</span></td>' +
          '<td style="padding:10px 12px;font-weight:700;color:#00ff88">' + Utils.takaEn(unrecordedInitial) + '</td>' +
          '<td style="padding:10px 12px;color:' + (remAfterInit > 0 ? '#ff4757' : '#00ff88') + ';font-weight:600">' + Utils.takaEn(remAfterInit) + '</td>' +
          '<td style="padding:10px 12px;text-align:right;display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
            '<span style="font-size:0.72rem;color:#ffaa00;font-style:italic;margin-right:4px">Initial Payment</span>' +
            '<button class="btn btn-ghost btn-xs" onclick="Students.editInitialPayment(\'' + eid + '\')" title="Edit initial payment amount" style="color:#ffaa00;border-color:rgba(255,170,0,0.4)">' +
              '<i class="fa fa-pen"></i>' +
            '</button>' +
          '</td>' +
        '</tr>';
    }

    if (history.length === 0 && unrecordedInitial === 0) {
      historyTableRows = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;"><i class="fa fa-inbox" style="display:block;font-size:1.8rem;opacity:.3;margin-bottom:8px;"></i>No payment history yet</td></tr>';
    } else {
      historyTableRows += history.map((f) => {
        runningTotal += Utils.safeNum(f.amount);
        rowIndex++;
        const remaining = Math.max(0, totalFee - runningTotal);
        return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:10px 12px;color:var(--text-muted);font-size:0.82rem">${rowIndex}</td>
          <td style="padding:10px 12px">${Utils.formatDateDMY(f.date)}</td>
          <td style="padding:10px 12px"><span class="badge badge-info">${Utils.esc(f.method || 'Cash')}</span></td>
          <td style="padding:10px 12px;font-weight:700;color:#00ff88">${Utils.takaEn(f.amount)}</td>
          <td style="padding:10px 12px;color:${remaining > 0 ? '#ff4757' : '#00ff88'};font-weight:600">${Utils.takaEn(remaining)}</td>
          <td style="padding:10px 12px;text-align:right">
            ${f.note ? `<span style="font-size:0.78rem;color:var(--text-muted);margin-right:8px">${Utils.esc(f.note)}</span>` : ''}
            <button class="btn btn-ghost btn-xs" style="color:#00d4ff;border-color:rgba(0,212,255,0.35);margin-right:4px" onclick="Students.editPayment('${Utils.escAttr(f.id)}','${eid}')" title="Edit this payment"><i class="fa fa-pen"></i></button>
            <button class="btn btn-ghost btn-xs" onclick="Students.deletePayment('${Utils.escAttr(f.id)}','${eid}')" title="Delete this payment"><i class="fa fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    }

    // Build installment form HTML (no nested backticks inside main template)
    let installmentFormHTML;
    if (totalDue > 0) {
      const datePickerHTML = Students._dateSelectHTML('pay-date', Utils.today(), 'form-control');
      const methodsHTML    = Utils.getPaymentMethodsHTML();
      installmentFormHTML =
        '<div style="border:1.5px solid rgba(0,212,255,0.2);border-radius:10px;padding:20px;margin-bottom:22px;background:rgba(0,0,0,0.15)">' +
          '<div style="font-size:0.95rem;font-weight:800;color:var(--brand-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px">' +
            '<i class="fa fa-plus-circle"></i> Add New Installment' +
            '<button onclick="document.getElementById(\'pay-amount\').value=' + totalDue + '" style="margin-left:auto;padding:4px 12px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);color:#00ff88;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer">' +
              'Pay Full Due \u09F3' + Utils.formatMoneyPlain(totalDue) +
            '</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
            '<div>' +
              '<label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">AMOUNT (\u09F3) *</label>' +
              '<input id="pay-amount" type="number" class="form-control" placeholder="0" max="' + totalDue + '" min="1" onkeypress="if(event.key===\'Enter\') Students.savePayment(\'' + eid + '\')" />' +
            '</div>' +
            '<div>' +
              '<label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">PAYMENT METHOD *</label>' +
              '<select id="pay-method" class="form-control" onchange="Utils.onPaymentMethodChange(this,\'pay-bal-display\')">' +
                '<option value="">Select Method...</option>' + methodsHTML +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">DATE</label>' +
              datePickerHTML +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:12px">' +
            '<label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">NOTE (optional)</label>' +
            '<input id="pay-note" class="form-control" placeholder="e.g. 2nd installment, advance payment..." />' +
          '</div>' +
          '<div id="pay-bal-display" style="display:none;margin-bottom:8px"></div>' +
          '<div id="pay-error" class="form-error hidden" style="margin-bottom:8px"></div>' +
          '<button onclick="Students.savePayment(\'' + eid + '\')" style="width:100%;padding:12px;background:linear-gradient(90deg,#00d9ff,#b537f2);border:none;border-radius:8px;font-weight:800;font-size:0.9rem;color:#fff;cursor:pointer;letter-spacing:0.5px">' +
            '<i class="fa fa-plus"></i> SAVE INSTALLMENT' +
          '</button>' +
        '</div>';
    } else {
      installmentFormHTML =
        '<div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:16px;margin-bottom:22px;text-align:center">' +
          '<i class="fa fa-circle-check" style="color:#00ff88;font-size:1.5rem;margin-bottom:6px;display:block"></i>' +
          '<div style="font-weight:700;color:#00ff88">Fully Paid \u2014 No Outstanding Due</div>' +
        '</div>';
    }

    Utils.openModal('<i class="fa fa-plus-circle"></i> Add Installment', `
      <!-- Student Info Bar -->
      <div style="background:rgba(0,180,255,0.08);border:1px solid rgba(0,180,255,0.2);border-radius:10px;padding:14px 20px;margin-bottom:18px;display:flex;align-items:center;gap:16px;">
        <i class="fa fa-user-graduate" style="font-size:1.5rem;color:var(--brand-primary);"></i>
        <div style="flex:1">
          <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary)">${Utils.esc(s.name)}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary)">ID: ${Utils.esc(s.student_id)} &nbsp;|&nbsp; ${Utils.displayText(s.course||'—')} &nbsp;|&nbsp; Batch: ${Utils.esc(s.batch||'—')}</div>
        </div>
        <button onclick="Students.printReceipt('${eid}')" style="padding:8px 16px;background:rgba(255,107,53,0.15);border:1px solid rgba(255,107,53,0.4);color:#ff6b35;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap">
          <i class="fa fa-print"></i> Print
        </button>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:rgba(0,0,0,0.35);border:1.5px solid rgba(0,217,255,0.25);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.7rem;font-weight:800;color:var(--text-secondary);letter-spacing:1.5px;margin-bottom:8px">TOTAL FEE</div>
          <div style="font-size:1.6rem;font-weight:900;color:#00d9ff">${Utils.takaEn(totalFee)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.35);border:1.5px solid rgba(0,255,136,0.25);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.7rem;font-weight:800;color:var(--text-secondary);letter-spacing:1.5px;margin-bottom:8px">PAID (${history.length + (unrecordedInitial > 0 ? 1 : 0)} payments)</div>
          <div style="font-size:1.6rem;font-weight:900;color:#00ff88">${Utils.takaEn(totalPaid)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.35);border:1.5px solid rgba(255,71,87,0.25);border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.7rem;font-weight:800;color:var(--text-secondary);letter-spacing:1.5px;margin-bottom:8px">OUTSTANDING DUE</div>
          <div style="font-size:1.6rem;font-weight:900;color:#ff4757">${Utils.takaEn(totalDue)}</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;font-weight:600">
          <span>Payment Progress</span>
          <span style="color:${barColor}">${paidPct}% Completed</span>
        </div>
        <div style="height:10px;background:rgba(255,255,255,0.08);border-radius:10px;overflow:hidden">
          <div style="height:100%;width:${paidPct}%;background:linear-gradient(90deg,${barColor},${barColor}88);border-radius:10px;transition:width 0.5s ease"></div>
        </div>
      </div>

      <!-- Add Installment Form -->
      ${installmentFormHTML}

      <!-- History Table -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:0.95rem;font-weight:800;color:var(--brand-primary);display:flex;align-items:center;gap:8px">
          <i class="fa fa-list-ol"></i> Installment History
          <span style="background:var(--brand-primary);color:#000;font-size:0.7rem;font-weight:900;padding:2px 8px;border-radius:20px">${history.length + (unrecordedInitial > 0 ? 1 : 0)}</span>
        </div>
        <button onclick="Students.printReceipt('${eid}')" style="padding:6px 14px;background:rgba(255,107,53,0.12);border:1px solid rgba(255,107,53,0.35);color:#ff6b35;border-radius:7px;font-size:0.78rem;font-weight:700;cursor:pointer">
          <i class="fa fa-print"></i> Print All
        </button>
      </div>
      <div style="overflow:hidden;border-radius:10px;border:1px solid rgba(255,255,255,0.08)">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
          <thead style="background:rgba(255,255,255,0.06);border-bottom:2px solid var(--brand-primary)">
            <tr>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:left">#</th>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:left">DATE</th>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:left">METHOD</th>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:left">PAID</th>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:left">REMAINING</th>
              <th style="padding:10px 12px;font-weight:800;letter-spacing:1px;text-align:right">NOTE / ACTION</th>
            </tr>
          </thead>
          <tbody>${historyTableRows}</tbody>
        </table>
        <div style="height:3px;background:linear-gradient(90deg,var(--brand-primary),var(--brand-accent))"></div>
      </div>
    `, 'modal-xl');
  }


  /* ══════════════════════════════════════════
     SAVE / UPDATE STUDENT
  ══════════════════════════════════════════ */
  function calcDue() {
    const total = Utils.safeNum(Utils.formVal('sf-total-fee'));
    const paid  = Utils.safeNum(Utils.formVal('sf-paid'));
    const dueEl = document.getElementById('sf-due');
    const errEl = document.getElementById('sf-error');

    if (total > 0 && paid > total) {
      // Overpayment — show error, set due to 0
      Utils.formSet('sf-due', 0);
      if (dueEl) {
        dueEl.style.borderColor = '#ff4757';
        dueEl.style.boxShadow = '0 0 8px rgba(255,71,87,0.4)';
      }
      if (errEl) {
        errEl.textContent = `⚠️ Paid amount (৳${paid.toLocaleString('en-IN')}) exceeds Total Fee (৳${total.toLocaleString('en-IN')}). Overpayment is not allowed.`;
        errEl.classList.remove('hidden');
      }
    } else {
      Utils.formSet('sf-due', Math.max(0, total - paid));
      if (dueEl) {
        dueEl.style.borderColor = '';
        dueEl.style.boxShadow = '';
      }
      if (errEl && errEl.textContent.includes('Overpayment')) {
        errEl.classList.add('hidden');
      }
    }
  }

  // Duplicate warning state — একবার warn করার পর force করতে পারবে
  let _dupWarningAcknowledged = false;

  function saveStudent() {
    const name  = Utils.formVal('sf-name');
    const sid   = Utils.formVal('sf-sid');
    const phone = Utils.formVal('sf-phone');
    const email = Utils.formVal('sf-email');
    const course = Utils.formVal('sf-course');
    const batch  = Utils.formVal('sf-batch');
    const errEl = document.getElementById('sf-error');

    // ✅ Phase 2: Comprehensive form validation
    if (!name) { errEl.textContent='Name is required'; errEl.classList.remove('hidden'); return; }
    if (name.length < 2) { errEl.textContent='Name must be at least 2 characters'; errEl.classList.remove('hidden'); return; }
    if (!sid && !editingId) { errEl.textContent='Student ID Required'; errEl.classList.remove('hidden'); return; }

    // Phone validation: mandatory, accepts any international format (min 7 digits)
    if (!phone) {
      errEl.textContent = 'Phone number is required.';
      errEl.classList.remove('hidden'); return;
    }
    const _phoneDigits = phone.replace(/[^0-9]/g, '');
    if (_phoneDigits.length < 7) {
      errEl.textContent = 'Phone number must contain at least 7 digits (any country format allowed).';
      errEl.classList.remove('hidden'); return;
    }

    // Email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent='Invalid email format (e.g. name@example.com)';
      errEl.classList.remove('hidden'); return;
    }

    // Course & Batch required (school mode: also on edit)
    const courseLabel = _instLabel('course_label', 'Course');
    const batchLabel = _instLabel('batch_label', 'Batch');
    const yearLabel = _instLabel('session_label', 'Session');
    if (_isSchoolMode() || !editingId) {
      if (!course) { errEl.textContent = `${courseLabel} is required`; errEl.classList.remove('hidden'); return; }
      if (!batch) { errEl.textContent = `${batchLabel} is required`; errEl.classList.remove('hidden'); return; }
    }
    if (_isSchoolMode()) {
      const guardian = Utils.formVal('sf-guardian-phone');
      const roll = Utils.formVal('sf-roll');
      const year = Utils.formVal('sf-session');
      if (!guardian) {
        errEl.textContent = 'Guardian phone is required';
        errEl.classList.remove('hidden'); return;
      }
      if (!roll) {
        errEl.textContent = 'Roll number is required';
        errEl.classList.remove('hidden'); return;
      }
      if (!year) {
        errEl.textContent = `${yearLabel} is required`;
        errEl.classList.remove('hidden'); return;
      }
    }

    errEl.classList.add('hidden');

    // ── Duplicate Check (name + phone) ────────────────────────
    if (!editingId && !_dupWarningAcknowledged) {
      const allStudents = SupabaseSync.getAll(DB.students);
      const nameLower   = name.trim().toLowerCase();
      const phoneClean  = (phone || '').trim().replace(/\D/g, '');

      const duplicate = allStudents.find(s => {
        const sNameMatch  = s.name?.trim().toLowerCase() === nameLower;
        const sPhoneClean = (s.phone || '').trim().replace(/\D/g, '');
        const sPhoneMatch = phoneClean && sPhoneClean && sPhoneClean === phoneClean;
        // ✅ Warning শুধু তখনই — নাম AND ফোন দুটোই মিললে
        return sNameMatch && sPhoneMatch;
      });

      if (duplicate) {
        // Warning দেখাও — user চাইলে তবুও save করতে পারবে
        const dupPhone = Utils.esc(duplicate.phone || 'N/A');
        const dupId    = Utils.esc(duplicate.student_id || '');
        const dupName  = Utils.esc(duplicate.name || '');
        errEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:flex-start; gap:8px;">
              <i class="fa fa-triangle-exclamation" style="color:#f7a800; font-size:1.1rem; margin-top:2px; flex-shrink:0;"></i>
              <div>
                <strong style="color:#f7a800;">Possible Duplicate Entry!</strong><br/>
                <span style="font-size:0.88rem;">Similar student found: <strong>${dupName}</strong> (ID: ${dupId}, Phone: ${dupPhone})</span>
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button"
                style="background:#f7a800; color:#000; border:none; border-radius:6px; padding:6px 14px; font-weight:800; font-size:0.82rem; cursor:pointer;"
                onclick="Students._forceSave()">
                <i class="fa fa-check"></i> Yes, Save Anyway
              </button>
              <button type="button"
                style="background:rgba(255,255,255,0.1); color:var(--text-primary); border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:6px 14px; font-weight:700; font-size:0.82rem; cursor:pointer;"
                onclick="document.getElementById('sf-error').classList.add('hidden'); Students._resetDupWarning();">
                <i class="fa fa-xmark"></i> Cancel
              </button>
            </div>
          </div>`;
        errEl.classList.remove('hidden');
        return; // Save বন্ধ রাখো
      }
    }

    _dupWarningAcknowledged = false; // Reset করো

    const total = Utils.safeNum(Utils.formVal('sf-total-fee'));
    const paid  = Utils.safeNum(Utils.formVal('sf-paid'));

    // ✅ Overpayment Guard: paid > total_fee হলে block করো
    if (total > 0 && paid > total) {
      errEl.textContent = `⚠️ Paid amount (৳${paid.toLocaleString('en-IN')}) exceeds Total Fee (৳${total.toLocaleString('en-IN')}). Overpayment is not allowed!`;
      errEl.classList.remove('hidden');
      return;
    }

    const due   = Math.max(0, total - paid);

    // ✅ Fix: paid > 0 হলে payment method বাধ্যতামূলক — না হলে finance/balance আপডেট হয় না
    if (!editingId && paid > 0) {
      const method = Utils.formVal('sf-method');
      if (!method) {
        errEl.textContent = 'Paid amount আছে — Payment Method নির্বাচন করুন (Cash/Bank/Mobile)।';
        errEl.classList.remove('hidden');
        return;
      }
      if (!Utils.isValidPaymentMethod(method)) {
        errEl.textContent = 'Invalid Payment Method — Accounts ট্যাবে আগে account যোগ করুন।';
        errEl.classList.remove('hidden');
        return;
      }
    }

    const record = {
      student_id:    Utils.formVal('sf-sid'),
      name:          name,
      phone:         phone,
      email:         Utils.formVal('sf-email'),
      father_name:   Utils.formVal('sf-father'),
      course:        _normCourse(Utils.formVal('sf-course')),
      batch:         Utils.formVal('sf-batch'),
      session:       Utils.formVal('sf-session'),
      admission_date:Utils.formVal('sf-date'),
      total_fee:     total,
      paid:          paid,
      due:           due,
      address:       Utils.formVal('sf-address'),
      status:        Utils.formVal('sf-status') || 'Active',
      note:          Utils.formVal('sf-note'),
    };

    if (_isSchoolMode()) {
      record.mother_name = Utils.formVal('sf-mother');
      record.guardian_phone = Utils.formVal('sf-guardian-phone');
      record.roll_no = Utils.formVal('sf-roll');
      record.shift = Utils.formVal('sf-shift');
    }

    if (editingId) {
      // Recalculate paid/due from finance ledger — never trust the locked form fields
      const allFin     = SupabaseSync.getAll(DB.finance);
      const ledgerPaid = allFin
        .filter(f => f.category === 'Student Fee' &&
                     (f.ref_id === editingId || f.ref_id === record.student_id))
        .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);
      // Preserve existing s.paid (which may include unrecorded initial payment)
      // Only update paid upward if ledger shows more (finance is source of truth upward)
      const existingPaid = Utils.safeNum(SupabaseSync.getById(DB.students, editingId)?.paid);
      const effectivePaid = Math.max(existingPaid, ledgerPaid);
      const effectiveDue  = Math.max(0, total - effectivePaid);
      record.paid = effectivePaid;
      record.due  = effectiveDue;

      SupabaseSync.update(DB.students, editingId, record, { bypassLog: true });
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'students',
          `ছাত্র/ছাত্রী আপডেট: ${name} (ID: ${record.student_id})`
        );
      }
      Utils.toast('Student info updated ✓', 'success');
    } else {
      // insert করো এবং UUID সহ returned record রাখো
      const inserted = SupabaseSync.insert(DB.students, record, { bypassLog: true });
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'students',
          `ছাত্র/ছাত্রী যোগ: ${name} (ID: ${record.student_id}) — ব্যাচ: ${record.batch}`
        );
      }
      const studentUUID = inserted.id; // UUID — finance ref_id-এ ব্যবহার হবে

       // Initial payment থাকলে finance-এ log করো (ref_id = UUID)
       if (paid > 0) {
         const method = Utils.formVal('sf-method');
         if (method) {
           if (!Utils.isValidPaymentMethod(method)) {
             Utils.toast('Invalid Payment Method selected', 'error');
             return;
           }
           SupabaseSync.insert(DB.finance, {
            type:        'Income',
            category:    'Student Fee',
            description: `${name} (${record.student_id}) — Initial Admission Payment`,
            amount:      paid,
            method:      method,
            date:        record.admission_date,
            note:        record.note,
            ref_id:      studentUUID, // ✅ UUID — restore logic কাজ করবে
          }, { bypassLog: true });
          if (typeof SupabaseSync.updateAccountBalance === 'function') {
            SupabaseSync.updateAccountBalance(method, paid, 'in');
          }
        }
      }
      Utils.toast('New student added ✓', 'success');
    }

    Utils.closeModal();
    render();
    App.updateNotifCount();
  }

  // Duplicate warning bypass helpers — global expose করা হয়েছে নিচে return-এ
  function _forceSave() {
    _dupWarningAcknowledged = true;
    saveStudent();
  }
  function _resetDupWarning() {
    _dupWarningAcknowledged = false;
  }

  /* ══════════════════════════════════════════
     SAVE PAYMENT
  ══════════════════════════════════════════ */
  function savePayment(studentId) {
    const s      = SupabaseSync.getById(DB.students, studentId);
    const errEl  = document.getElementById('pay-error');

    // Null guard
    if (!s) {
      console.error('[savePayment] Student not found:', studentId);
      Utils.toast('Student not found. Please close and reopen the payment modal.', 'error');
      return;
    }

    const amount = Utils.safeNum(Utils.formVal('pay-amount'));

    function showErr(msg) {
      if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
      else { Utils.toast(msg, 'error'); }
    }

    if (!amount || amount <= 0) { showErr('Payment amount required'); return; }
    if (amount > Utils.safeNum(s.due)) { showErr('Amount ৳' + Utils.formatMoneyPlain(amount) + ' cannot exceed due ৳' + Utils.formatMoneyPlain(s.due)); return; }

    const method = Utils.formVal('pay-method');
    if (!method) { showErr('Please select a Payment Method'); return; }
    if (!Utils.isValidPaymentMethod(method)) { showErr('Invalid or inactive Payment Method selected'); return; }

    if (errEl) errEl.classList.add('hidden');

    const newPaid = Utils.safeNum(s.paid) + amount;
    const newDue  = Math.max(0, Utils.safeNum(s.total_fee) - newPaid);

    SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue }, { bypassLog: true });

    SupabaseSync.insert(DB.finance, {
      type:        'Income',
      category:    'Student Fee',
      description: s.name + ' (' + s.student_id + ') — Course Fee Installment',
      amount:      amount,
      method:      method,
      date:        Utils.formVal('pay-date') || Utils.today(),
      note:        Utils.formVal('pay-note') || '',
      ref_id:      studentId,
    }, { bypassLog: true });

    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'in');
    }
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('payment', 'students',
        'ফি পরিশোধ: ' + s.name + ' (' + s.student_id + ') — ৳' + Utils.formatMoneyPlain(amount) + ' (' + method + ') — বকেয়া: ৳' + Utils.formatMoneyPlain(newDue));
    }

    Utils.toast('Payment saved \u2713 \u09F3' + Utils.formatMoneyPlain(amount), 'success');
    // ── Feature 4: SMS — fee_due reminder if still has balance ──
    if (typeof SMSEngine !== 'undefined') {
      const updatedStudent = SupabaseSync.getById(DB.students, studentId);
      if (updatedStudent) SMSEngine.sendFeeDue(updatedStudent);
    }
    openPayModal(studentId);
    render();
    App.updateNotifCount();
  }

  async function deletePayment(paymentId, studentId) {
    const payment = SupabaseSync.getById(DB.finance, paymentId);
    if (!payment) return;

    try {
      const ok = await Utils.confirm(`Delete payment of ${Utils.takaEn(payment.amount)}?`, 'Delete Payment');
      if (!ok) return;

      const student = SupabaseSync.getById(DB.students, studentId);

      // Account balance reverse করো (Income ছিল → 'out' করো)
      if (payment.method && typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(payment.method, Utils.safeNum(payment.amount), 'out', true);
      }

      SupabaseSync.remove(DB.finance, paymentId, { bypassLog: true });

      if (student) {
        _syncPaidDueAfterLedgerChange(studentId, student, Utils.safeNum(payment.amount));
      }

      // ✅ Bug Fix: Explicit activity log with student name + amount detail
      if (typeof SupabaseSync.logActivity === 'function') {
        const _s = SupabaseSync.getById(DB.students, studentId);
        const _sLabel = _s ? `${Utils.esc(_s.name)} (${Utils.esc(_s.student_id)})` : studentId;
        SupabaseSync.logActivity('delete', 'students',
          `ফি পেমেন্ট মুছে ফেলা: ${_sLabel} — ${Utils.takaEn(payment.amount)} (${payment.method || 'N/A'})`);
      }

      Utils.toast('Payment deleted ✓', 'info');
      Students.openPayModal(studentId);
      // ✅ Bug Fix: refresh student list so due/paid totals update immediately
      render();
      App.updateNotifCount();
    } catch (e) {
      console.error('[deletePayment] Error:', e);
      Utils.toast('Payment delete failed: ' + (e.message || e), 'error');
    }
  }

  /* ══════════════════════════════════════════
     EDIT PAYMENT (finance ledger entry)
  ══════════════════════════════════════════ */
  function editPayment(paymentId, studentId) {
    const payment = SupabaseSync.getById(DB.finance, paymentId);
    if (!payment) { Utils.toast('Payment not found', 'error'); return; }
    const s = SupabaseSync.getById(DB.students, studentId);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    const methodsHTML  = Utils.getPaymentMethodsHTML();
    const dateHTML     = Students._dateSelectHTML('ep-date', payment.date || Utils.today(), 'form-control');
    const maxAllowed   = Utils.safeNum(s.total_fee);

    Utils.openModal('<i class="fa fa-pen"></i> Edit Payment', `
      <div style="margin-bottom:16px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:12px 16px;">
        <div style="font-weight:700;color:#fff">${Utils.esc(s.name)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">ID: ${Utils.esc(s.student_id)} &nbsp;|&nbsp; Total Fee: ${Utils.takaEn(s.total_fee)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">AMOUNT (৳) *</label>
          <input id="ep-amount" type="number" class="form-control" value="${Utils.safeNum(payment.amount)}" min="1" max="${maxAllowed}" />
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">PAYMENT METHOD *</label>
          <select id="ep-method" class="form-control">
            ${methodsHTML}
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">DATE</label>
        ${dateHTML}
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.8px;display:block;margin-bottom:5px">NOTE (optional)</label>
        <input id="ep-note" class="form-control" value="${Utils.escAttr(payment.note || '')}" placeholder="e.g. 2nd installment..." />
      </div>
      <div id="ep-error" class="form-error hidden" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Students.saveEditedPayment('${Utils.escAttr(paymentId)}','${Utils.escAttr(studentId)}')">
          <i class="fa fa-floppy-disk"></i> Save Changes
        </button>
      </div>
    `);

    // Pre-select the method
    setTimeout(() => {
      const sel = document.getElementById('ep-method');
      if (sel && payment.method) sel.value = payment.method;
    }, 30);
  }

  function saveEditedPayment(paymentId, studentId) {
    const s = SupabaseSync.getById(DB.students, studentId);
    const errEl = document.getElementById('ep-error');
    function showErr(msg) { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } }

    if (!s) { showErr('Student not found'); return; }
    const amount = Utils.safeNum(Utils.formVal('ep-amount'));
    if (!amount || amount <= 0) { showErr('Amount must be greater than 0'); return; }

    const method = Utils.formVal('ep-method');
    if (!method) { showErr('Please select a payment method'); return; }
    if (!Utils.isValidPaymentMethod(method)) { showErr('Invalid or inactive payment method'); return; }

    const oldPayment = SupabaseSync.getById(DB.finance, paymentId);
    if (!oldPayment) { showErr('Original payment not found'); return; }

    // Reverse old account balance, apply new
    if (oldPayment.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(oldPayment.method, Utils.safeNum(oldPayment.amount), 'out', true);
    }

    SupabaseSync.update(DB.finance, paymentId, {
      amount : amount,
      method : method,
      date   : Utils.formVal('ep-date') || Utils.today(),
      note   : Utils.formVal('ep-note') || '',
    }, { bypassLog: true });

    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'in');
    }

    const allFin = SupabaseSync.getAll(DB.finance);
    const ledgerSum = allFin
      .filter(f => f.category === 'Student Fee' &&
                   (f.ref_id === studentId || f.ref_id === s.student_id))
      .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);
    const ledgerBeforeEdit = ledgerSum - amount + Utils.safeNum(oldPayment.amount);
    const unrecordedInitial = Math.max(0, Utils.safeNum(s.paid) - ledgerBeforeEdit);
    const effectivePaid = ledgerSum + unrecordedInitial;
    const newDue = Math.max(0, Utils.safeNum(s.total_fee) - effectivePaid);
    SupabaseSync.update(DB.students, studentId, { paid: effectivePaid, due: newDue }, { bypassLog: true });

    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('edit', 'students',
        `ফি পেমেন্ট এডিট: ${s.name} (${s.student_id}) — ${Utils.takaEn(amount)} (${method}) — বকেয়া: ৳${Utils.formatMoneyPlain(newDue)}`);
    }

    Utils.toast('Payment updated ✓', 'success');
    Students.openPayModal(studentId);
  }

  /* ══════════════════════════════════════════
     EDIT INITIAL PAYMENT (unrecorded amount)
  ══════════════════════════════════════════ */
  function editInitialPayment(studentId) {
    const s = SupabaseSync.getById(DB.students, studentId);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    const allFin   = SupabaseSync.getAll(DB.finance);
    const ledgerSum = allFin
      .filter(f => f.category === 'Student Fee' &&
                   (f.ref_id === studentId || f.ref_id === s.student_id))
      .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);
    const currentInitial = Math.max(0, Utils.safeNum(s.paid) - ledgerSum);
    const maxInitial     = Utils.safeNum(s.total_fee) - ledgerSum;

    Utils.openModal('<i class="fa fa-pen" style="color:#ffaa00"></i> Edit Initial Payment', `
      <div style="background:rgba(255,170,0,0.07);border:1px solid rgba(255,170,0,0.3);border-radius:8px;padding:12px 16px;margin-bottom:16px">
        <div style="font-weight:700;color:#fff">${Utils.esc(s.name)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">এটি admission-এর সময় যে টাকা নেওয়া হয়েছিল কিন্তু payment method ছাড়া save হয়েছে।</div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:0.72rem;font-weight:700;color:#ffaa00;letter-spacing:0.8px;display:block;margin-bottom:5px">INITIAL PAYMENT AMOUNT (৳) *</label>
        <input id="eip-amount" type="number" class="form-control" value="${currentInitial}" min="0" max="${maxInitial}"
               style="color:#00ff88;font-weight:700;font-size:1.1rem;" />
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
          Maximum: ${Utils.takaEn(maxInitial)} &nbsp;|&nbsp; Finance ledger total: ${Utils.takaEn(ledgerSum)}
        </div>
      </div>
      <div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--text-muted)">
        <i class="fa fa-circle-info" style="color:#ffaa00"></i>
        0 সেট করলে Initial Payment row টি অদৃশ্য হয়ে যাবে।
      </div>
      <div id="eip-error" class="form-error hidden" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" style="background:linear-gradient(90deg,#ffaa00,#ff6b35);border:none;"
                onclick="Students.saveEditedInitialPayment('${Utils.escAttr(studentId)}','${ledgerSum}')">
          <i class="fa fa-floppy-disk"></i> Save Initial Payment
        </button>
      </div>
    `);
  }

  function saveEditedInitialPayment(studentId, ledgerSum) {
    const s    = SupabaseSync.getById(DB.students, studentId);
    const errEl = document.getElementById('eip-error');
    function showErr(msg) { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } }

    if (!s) { showErr('Student not found'); return; }

    const newInitial = Utils.safeNum(Utils.formVal('eip-amount'));
    if (newInitial < 0) { showErr('Amount cannot be negative'); return; }

    const totalFee = Utils.safeNum(s.total_fee);
    const sum      = Utils.safeNum(ledgerSum);
    if (newInitial + sum > totalFee) {
      showErr(`Total (initial ৳${newInitial.toLocaleString('en-IN')} + ledger ৳${sum.toLocaleString('en-IN')}) exceeds total fee ৳${totalFee.toLocaleString('en-IN')}`);
      return;
    }

    const newPaid = newInitial + sum;
    const newDue  = Math.max(0, totalFee - newPaid);
    SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue }, { bypassLog: true });

    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('edit', 'students',
        `প্রাথমিক ফি সমন্বয়: ${s.name} (${s.student_id}) — ৳${newInitial.toLocaleString('en-IN')} — বকেয়া: ৳${Utils.formatMoneyPlain(newDue)}`);
    }

    Utils.toast('Initial payment updated ✓', 'success');
    Students.openPayModal(studentId);
  }

  /* ══════════════════════════════════════════
     PRINT RECEIPT (Single Payment / Full Summary)
  ══════════════════════════════════════════ */
  function printReceipt(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const academyName  = Utils.esc(cfg.academy_name  || 'Wings Fly Aviation Academy');
    const academyPhone = Utils.esc(cfg.academy_phone || '');
    const academyEmail = Utils.esc(cfg.academy_email || '');
    const academyAddr  = Utils.esc(cfg.academy_address|| '');
    const rawLogo      = String(cfg.logo_url || '').trim();
    const logoUrl      = (/^https?:\/\//i.test(rawLogo) || rawLogo.startsWith('assets/') || rawLogo.startsWith('./'))
      ? Utils.escAttr(rawLogo) : '';

    const allFinance = SupabaseSync.getAll(DB.finance);
    const payments = allFinance
      .filter(f => f.category === 'Student Fee' && (f.ref_id === id || f.ref_id === s.student_id))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest first = #1 is first payment

    const totalFee  = Utils.safeNum(s.total_fee);
    const totalPaid = Utils.safeNum(s.paid);
    const totalDue  = Utils.safeNum(s.due);
    const paidPct   = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;

    const receiptNo = `RCP-${s.student_id}-${Date.now().toString().slice(-5)}`;
    const printDate = Utils.formatDateDMY(Utils.today());

    // Detect unrecorded initial payment (paid at admission, no finance entry created)
    const sumFinance        = payments.reduce((acc, f) => acc + Utils.safeNum(f.amount), 0);
    const unrecordedInit    = Math.max(0, totalPaid - sumFinance);

    let printRowIdx     = 0;
    let runningBalance  = 0;
    let paymentRows     = '';

    // Ghost row for the unrecorded initial payment
    if (unrecordedInit > 0) {
      printRowIdx++;
      runningBalance += unrecordedInit;
      const remInit = Math.max(0, totalFee - runningBalance);
      paymentRows += `
          <tr style="border-bottom:1px solid #e8e8e8; background:#fffbf0;">
            <td style="padding:8px 10px;text-align:center;font-weight:600;color:#555;">${printRowIdx}</td>
            <td style="padding:8px 10px;">${Utils.formatDateDMY(s.admission_date)}</td>
            <td style="padding:8px 10px;text-align:center;">
              <span style="background:#fff8e1;color:#cc7700;padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">Initial</span>
            </td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:#1a7a1a;">৳${unrecordedInit.toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;text-align:right;color:${remInit > 0 ? '#cc3300' : '#1a7a1a'};font-weight:600;">৳${remInit.toLocaleString('en-IN')}</td>
          </tr>`;
    }

    if (payments.length === 0 && unrecordedInit === 0) {
      paymentRows = `<tr><td colspan="5" style="text-align:center;padding:12px;color:#888;">No installment records found</td></tr>`;
    } else {
      paymentRows += payments.map((f, i) => {
          printRowIdx++;
          runningBalance += Utils.safeNum(f.amount);
          const remaining = Math.max(0, totalFee - runningBalance);
          return `
          <tr style="border-bottom:1px solid #e8e8e8; ${i % 2 === 0 ? 'background:#fafafa;' : ''}">
            <td style="padding:8px 10px;text-align:center;font-weight:600;color:#555;">${printRowIdx}</td>
            <td style="padding:8px 10px;">${Utils.formatDateDMY(f.date)}</td>
            <td style="padding:8px 10px;text-align:center;">
              <span style="background:#e8f4f8;color:#0077aa;padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">${Utils.esc(f.method || 'Cash')}</span>
            </td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:#1a7a1a;">৳${Utils.safeNum(f.amount).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;text-align:right;color:${remaining > 0 ? '#cc3300' : '#1a7a1a'};font-weight:600;">
              ৳${remaining.toLocaleString('en-IN')}
            </td>
          </tr>`;
        }).join('');
    }

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:64px;max-width:160px;object-fit:contain;" alt="Logo" />`
      : `<div style="width:64px;height:64px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">✈</div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payment Receipt — ${Utils.esc(s.name)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f2f5; display:flex; justify-content:center; padding:20px; }
  .receipt { width:794px; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.12); }

  /* Header */
  .receipt-header { background:linear-gradient(135deg, #1a3a6b 0%, #0099cc 100%); color:#fff; padding:24px 32px; display:flex; align-items:center; gap:20px; }
  .academy-info h1 { font-size:1.4rem; font-weight:800; letter-spacing:0.5px; }
  .academy-info p  { font-size:0.8rem; opacity:0.85; margin-top:3px; }

  /* Receipt Title Bar */
  .receipt-title-bar { background:#f7a800; color:#1a1a1a; padding:10px 32px; display:flex; justify-content:space-between; align-items:center; }
  .receipt-title-bar h2 { font-size:1.1rem; font-weight:800; letter-spacing:2px; text-transform:uppercase; }
  .receipt-title-bar span { font-size:0.85rem; font-weight:700; }

  /* Student Info */
  .student-section { padding:20px 32px; border-bottom:2px dashed #e0e0e0; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; }
  .info-item { display:flex; flex-direction:column; }
  .info-label { font-size:0.7rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:2px; }
  .info-value { font-size:0.95rem; font-weight:600; color:#1a1a1a; }

  /* Fee Summary */
  .fee-summary { padding:16px 32px; background:#f8fbff; border-bottom:2px dashed #e0e0e0; display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  .fee-box { text-align:center; background:#fff; border-radius:8px; padding:12px; border:1.5px solid #e0e0e0; }
  .fee-box .f-label { font-size:0.7rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px; }
  .fee-box .f-value { font-size:1.2rem; font-weight:800; }
  .fee-box.total  .f-value { color:#1a3a6b; }
  .fee-box.paid   .f-value { color:#1a7a1a; }
  .fee-box.due    .f-value { color:#cc3300; }

  /* Progress Bar */
  .progress-section { padding:12px 32px; border-bottom:2px dashed #e0e0e0; }
  .progress-label { display:flex; justify-content:space-between; font-size:0.8rem; color:#555; margin-bottom:6px; font-weight:600; }
  .progress-bar { height:10px; background:#e8e8e8; border-radius:10px; overflow:hidden; }
  .progress-fill { height:100%; border-radius:10px; background:linear-gradient(90deg, #1a7a1a, #4caf50); transition:width 0.3s; }

  /* Installment Table */
  .table-section { padding:16px 32px; }
  .table-section h3 { font-size:0.85rem; font-weight:800; color:#1a3a6b; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; border-left:4px solid #0099cc; padding-left:10px; }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  thead tr { background:linear-gradient(90deg, #1a3a6b, #0077aa); color:#fff; }
  thead th { padding:10px 10px; font-weight:700; letter-spacing:0.5px; text-align:left; }
  thead th:last-child, thead th:nth-child(4) { text-align:right; }
  thead th:first-child { text-align:center; }

  /* Footer */
  .receipt-footer { padding:16px 32px; border-top:2px dashed #e0e0e0; display:flex; justify-content:space-between; align-items:flex-end; background:#fafafa; }
  .footer-note { font-size:0.75rem; color:#888; max-width:340px; line-height:1.5; }
  .signature-box { text-align:center; }
  .sig-line { width:160px; border-top:1.5px solid #555; margin:0 auto 4px; }
  .sig-label { font-size:0.72rem; color:#555; font-weight:600; }

  .status-paid   { background:#e8f8ee; color:#1a7a1a; padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; border:1.5px solid #a8dbb8; }
  .status-partial{ background:#fff8e8; color:#cc7700; padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; border:1.5px solid #f7c97a; }
  .status-unpaid { background:#fdecea; color:#cc3300; padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:700; border:1.5px solid #f5b8b0; }

  @media print {
    body { background:#fff; padding:0; }
    .receipt { box-shadow:none; border-radius:0; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
<div class="receipt">

  <!-- Header -->
  <div class="receipt-header">
    ${logoHtml}
    <div class="academy-info" style="flex:1;">
      <h1>${academyName}</h1>
      <p>${[academyPhone, academyEmail, academyAddr].filter(Boolean).join(' &nbsp;|&nbsp; ')}</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:0.7rem;opacity:0.8;margin-bottom:3px;">RECEIPT NO.</div>
      <div style="font-size:0.9rem;font-weight:800;letter-spacing:1px;">${receiptNo}</div>
      <div style="font-size:0.75rem;opacity:0.8;margin-top:4px;">Date: ${printDate}</div>
    </div>
  </div>

  <!-- Title Bar -->
  <div class="receipt-title-bar">
    <h2>✦ Fee Payment Receipt ✦</h2>
    <span>${totalDue <= 0
      ? '<span class="status-paid">● FULLY PAID</span>'
      : totalPaid > 0
        ? '<span class="status-partial">◑ PARTIALLY PAID</span>'
        : '<span class="status-unpaid">○ UNPAID</span>'
    }</span>
  </div>

  <!-- Student Info -->
  <div class="student-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Student Name</span>
        <span class="info-value">${Utils.esc(s.name)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Student ID</span>
        <span class="info-value">${Utils.esc(s.student_id || '—')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Course</span>
        <span class="info-value">${Utils.displayText(s.course || '—')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Batch / Session</span>
        <span class="info-value">${Utils.esc([s.batch, s.session].filter(Boolean).join(' / ') || '—')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone</span>
        <span class="info-value">${Utils.esc(s.phone || '—')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Admission Date</span>
        <span class="info-value">${Utils.formatDateDMY(s.admission_date)}</span>
      </div>
      ${s.father_name ? `<div class="info-item"><span class="info-label">Father's Name</span><span class="info-value">${Utils.esc(s.father_name)}</span></div>` : ''}
      ${s.address ? `<div class="info-item"><span class="info-label">Address</span><span class="info-value">${Utils.esc(s.address)}</span></div>` : ''}
    </div>
  </div>

  <!-- Fee Summary Boxes -->
  <div class="fee-summary">
    <div class="fee-box total">
      <div class="f-label">Total Course Fee</div>
      <div class="f-value">৳${totalFee.toLocaleString('en-IN')}</div>
    </div>
    <div class="fee-box paid">
      <div class="f-label">Total Paid</div>
      <div class="f-value">৳${totalPaid.toLocaleString('en-IN')}</div>
    </div>
    <div class="fee-box due">
      <div class="f-label">Outstanding Due</div>
      <div class="f-value">৳${totalDue.toLocaleString('en-IN')}</div>
    </div>
  </div>

  <!-- Progress Bar -->
  <div class="progress-section">
    <div class="progress-label">
      <span>Payment Progress</span>
      <span>${paidPct}% Completed (${payments.length + (unrecordedInit > 0 ? 1 : 0)} installment${(payments.length + (unrecordedInit > 0 ? 1 : 0)) !== 1 ? 's' : ''})</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${paidPct}%"></div>
    </div>
  </div>

  <!-- Installment Table -->
  <div class="table-section">
    <h3>Installment Payment History</h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:40px">#</th>
          <th>Payment Date</th>
          <th style="text-align:center">Method</th>
          <th style="text-align:right">Amount Paid</th>
          <th style="text-align:right">Remaining Due</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
        ${payments.length > 0 ? `
        <tr style="background:#f0f6ff; font-weight:800; border-top:2px solid #1a3a6b;">
          <td colspan="3" style="padding:10px 10px;color:#1a3a6b;text-align:right;">TOTAL PAID:</td>
          <td style="padding:10px 10px;text-align:right;color:#1a7a1a;font-size:1rem;">৳${totalPaid.toLocaleString('en-IN')}</td>
          <td style="padding:10px 10px;text-align:right;color:${totalDue > 0 ? '#cc3300' : '#1a7a1a'};font-size:1rem;">৳${totalDue.toLocaleString('en-IN')}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="receipt-footer">
    <div class="footer-note">
      <strong>Note:</strong> This is a computer-generated receipt.<br/>
      Please retain this for your records. For queries, contact the academy office.
      ${s.note ? `<br/><em>Remark: ${Utils.esc(s.note)}</em>` : ''}
    </div>
    <div class="signature-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signature</div>
      <div style="font-size:0.7rem;color:#aaa;margin-top:2px;">${academyName}</div>
    </div>
  </div>

</div>

<div class="no-print" style="text-align:center;margin-top:20px;">
  <button onclick="window.print()" style="background:linear-gradient(90deg,#1a3a6b,#0099cc);color:#fff;border:none;padding:12px 36px;border-radius:6px;font-size:1rem;font-weight:700;cursor:pointer;margin-right:12px;">
    🖨 Print Receipt
  </button>
  <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:12px 24px;border-radius:6px;font-size:1rem;font-weight:600;cursor:pointer;">
    ✕ Close
  </button>
</div>
</body>
</html>`;

    // ✅ Bug #13 Fix: Replaced document.write() with Blob URL (avoids deprecated API)
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'width=860,height=900');
    if (!win) { URL.revokeObjectURL(blobUrl); Utils.toast('Popup blocked! Please allow popups.', 'error'); return; }
    // Revoke the Blob URL after the window has loaded to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  /* ══════════════════════════════════════════
     PRINT HISTORY (Payment History Table Only)
  ══════════════════════════════════════════ */
  function printHistory(id) {
    // Full receipt covers history too — reuse printReceipt
    printReceipt(id);
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteStudent(id) {
    const s  = SupabaseSync.getById(DB.students, id);
    try {
      const ok = await Utils.confirm(`Delete student "${Utils.esc(s?.name || '')}" and all related payment records?`, 'Delete Student');
      if (!ok) return;

      // এই student-এর সব finance payment খুঁজে account balance reverse করো
      const allFinance = SupabaseSync.getAll(DB.finance);
      // Match by UUID or legacy student_id string
      const studentPayments = allFinance.filter(f => f.category === 'Student Fee' && (f.ref_id === id || f.ref_id === s?.student_id));
      studentPayments.forEach(f => {
        if (f.method && typeof SupabaseSync.updateAccountBalance === 'function') {
          SupabaseSync.updateAccountBalance(f.method, Utils.safeNum(f.amount), 'out', true);
        }
        SupabaseSync.remove(DB.finance, f.id, { bypassLog: true });
      });

      // ✅ FIX: Get student data BEFORE deletion to log correctly
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('delete', 'students',
          `ছাত্র/ছাত্রী মুছে ফেলা: ${s?.name || 'Unknown'} (ID: ${s?.student_id || 'N/A'}) — ${studentPayments.length}টি পেমেন্ট সহ`
        );
      }
      SupabaseSync.remove(DB.students, id, { bypassLog: true });
      Utils.toast(`Student deleted — ${studentPayments.length} payment(s) also moved to RecycleBin`, 'info');
      render();
      App.updateNotifCount();
    } catch (e) {
      console.error('[deleteStudent] Error:', e);
      Utils.toast('Student delete failed: ' + (e.message || e), 'error');
    }
  }

  /* ══════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════ */
  function exportExcel() {
    const all      = SupabaseSync.getAll(DB.students);
    const filtered = applyFilters(all);
    const rows = filtered.map(s => ({
      'Student ID': s.student_id||'',
      'Name':           s.name||'',
      'Father Name':    s.father_name||'',
      'Phone':           s.phone||'',
      'Email':         s.email||'',
      'Address':       s.address||'',
      'Course':          s.course||'',
      'Batch':          s.batch||'',
      'Session':          s.session||'',
      'Total Fee':        s.total_fee||0,
      'Paid':      s.paid||0,
      'Due':           s.due||0,
      'Status':      s.status||'Active',
      'Admission Date':  s.admission_date||'',
      'Notes':           s.note||'',
    }));
    Utils.exportExcel(rows, 'students', 'Student');
  }

  /* ── SET REMINDER — Notice Board-এ auto-entry ──────────────────────
     Student-এর জন্য reminder সেট করলে Notice Board-এ একটি entry তৈরি হয়।
     Admin পরে Notice Board গিয়ে দেখতে পাবেন।
  ─────────────────────────────────────────────────────────────────── */
  function setReminder(id, name) {
    const eid = Utils.escAttr(id);
    const ename = Utils.escAttr(name);
    Utils.openModal('<i class="fa fa-bell"></i> Set Reminder', `
      <div class="form-group">
        <label>Student</label>
        <input class="form-control" value="${Utils.escAttr(name)}" disabled />
      </div>
      <div class="form-group">
        <label>Reminder Note <span class="req">*</span></label>
        <textarea id="reminder-note" class="form-control" rows="3" placeholder="যেমন: ফি বাকি আছে, নথিপত্র জমা দিতে হবে..."></textarea>
      </div>
      <div class="form-group">
        <label>Remind Date</label>
        <input type="date" id="reminder-date" class="form-control" value="${Utils.today()}" />
      </div>
      <div id="reminder-err" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Students._saveReminder('${eid}','${ename}')">
          <i class="fa fa-bell"></i> Save Reminder
        </button>
      </div>
    `);
  }

  function _saveReminder(id, name) {
    const note = (document.getElementById('reminder-note')?.value || '').trim();
    const date = document.getElementById('reminder-date')?.value || Utils.today();
    if (!note) {
      const e = document.getElementById('reminder-err');
      if (e) { e.textContent = 'Reminder note লিখুন'; e.classList.remove('hidden'); }
      return;
    }
    // Notice Board-এ entry তৈরি করো
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
      SupabaseSync.insert(DB.notices, {
        title:   `🔔 Reminder: ${name}`,
        message: note,
        date:    date,
        type:    'reminder',
        student_id: id,
        created_by: (window.SessionStore && SessionStore.getUserName()) || localStorage.getItem('wfa_user_name') || 'admin',
      });
    }
    Utils.closeModal();
    Utils.toast(`Reminder saved for ${name} — Notice Board-এ যোগ হয়েছে ✓`, 'success');
    // Refresh notice-board indicator if it's mounted
    try { if (typeof NoticeBoardModule !== 'undefined') NoticeBoardModule.render(); } catch { /* ignore */ }
  }


  /* ── DD/MM/YYYY Date Select Helper (shared by add/edit/payment forms) ─── */
  function _dateSelectHTML(prefix, dateStr, cls) {
    cls = cls || 'form-control';
    const parts = (dateStr || '').split('-');
    const yyyy  = parts[0] || '';
    const mm    = parts[1] || '';
    const dd    = parts[2] || '';
    const months = [
      ['01','January'],['02','February'],['03','March'],['04','April'],
      ['05','May'],['06','June'],['07','July'],['08','August'],
      ['09','September'],['10','October'],['11','November'],['12','December']
    ];
    const curYear = new Date().getFullYear();
    const years = Array.from({length:8}, (_,i) => curYear - 4 + i);
    return `<div style="display:flex;gap:6px;">
      <select id="${prefix}-dd" class="${cls}" style="flex:0 0 70px;" onchange="Students._syncDate('${prefix}')">
        <option value="">DD</option>
        ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
      </select>
      <select id="${prefix}-mm" class="${cls}" style="flex:1;" onchange="Students._syncDate('${prefix}')">
        <option value="">Month</option>
        ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
      </select>
      <select id="${prefix}-yyyy" class="${cls}" style="flex:0 0 90px;" onchange="Students._syncDate('${prefix}')">
        <option value="">Year</option>
        ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
      </select>
    </div>
    <input type="hidden" id="${prefix}" value="${dateStr || ''}" />`;
  }

  function _syncDate(prefix) {
    const dd   = document.getElementById(prefix + '-dd')?.value   || '';
    const mm   = document.getElementById(prefix + '-mm')?.value   || '';
    const yyyy = document.getElementById(prefix + '-yyyy')?.value || '';
    const h    = document.getElementById(prefix);
    if (h) h.value = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
  }
  /* ══════════════════════════════════════════
     RECONCILE — Finance Ledger vs Student.paid
     Scans every student and fixes mismatches.
  ══════════════════════════════════════════ */
  function reconcileAllStudents() {
    const allStudents = SupabaseSync.getAll(DB.students);
    const allFinance  = SupabaseSync.getAll(DB.finance);
    let fixedCount    = 0;
    let auditLog      = [];

    allStudents.forEach(s => {
      const sid = s.id;
      // Sum all finance entries for this student (by UUID or student_id string)
      const ledgerPaid = allFinance
        .filter(f => f.category === 'Student Fee' &&
                     (f.ref_id === sid || f.ref_id === s.student_id))
        .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);

      const totalFee   = Utils.safeNum(s.total_fee);
      const storedPaid = Utils.safeNum(s.paid);
      const storedDue  = Utils.safeNum(s.due);

      // Only fix if the stored DUE doesn't match total_fee - paid
      // OR if ledger is GREATER than s.paid (ledger is always authoritative upward)
      const ledgerDue = Math.max(0, totalFee - ledgerPaid);

      let needsFix = false;
      let newPaid  = storedPaid;
      let newDue   = storedDue;

      // If ledger sum > s.paid → ledger wins (someone may have deleted a student.paid edit)
      if (ledgerPaid > storedPaid) {
        newPaid  = ledgerPaid;
        newDue   = ledgerDue;
        needsFix = true;
      }
      // If s.paid + s.due ≠ total_fee → recalculate due (keeps manual initial payments)
      if (Math.abs((storedPaid + storedDue) - totalFee) > 1) {
        newDue   = Math.max(0, totalFee - newPaid);
        needsFix = true;
      }

      if (needsFix) {
        SupabaseSync.update(DB.students, sid, { paid: newPaid, due: newDue });
        fixedCount++;
        auditLog.push(`${s.name} (${s.student_id}): paid ${storedPaid}→${newPaid}, due ${storedDue}→${newDue}`);
      }
    });

    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('system', 'students',
        `Fee reconciliation ran — ${fixedCount} student(s) corrected`);
    }

    if (fixedCount === 0) {
      Utils.toast('✅ All student payment records are consistent — no fixes needed!', 'success');
    } else {
      Utils.toast(`🔧 Fixed ${fixedCount} student(s) with payment mismatch. Check Activity Log.`, 'warning');
      console.info('[Reconcile] Fixed students:\n' + auditLog.join('\n'));
    }
    render();
    // Directly refresh dashboard if it's loaded
    if (typeof DashboardModule !== 'undefined' && typeof DashboardModule.render === 'function') {
      DashboardModule.render();
    }
    if (typeof App !== 'undefined' && typeof App.updateNotifCount === 'function') {
      App.updateNotifCount();
    }
    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { source: 'reconcile' } }));
    return { fixedCount, auditLog };
  }

  /** Finance Ledger-এ missing student fee entries backfill — SupabaseSync.repairMissingStudentFinance wrapper */
  function repairMissingFinanceEntries() {
    if (typeof SupabaseSync.repairMissingStudentFinance !== 'function') {
      Utils.toast('Finance repair not available — reload the page', 'error');
      return { fixedCount: 0, totalAmount: 0 };
    }
    const result = SupabaseSync.repairMissingStudentFinance({ silent: false });
    render();
    if (typeof DashboardModule !== 'undefined' && typeof DashboardModule.render === 'function') {
      DashboardModule.render();
    }
    if (typeof Finance !== 'undefined' && typeof Finance.render === 'function') {
      Finance.render();
    }
    if (typeof Accounts !== 'undefined' && typeof Accounts.render === 'function') {
      Accounts.render();
    }
    if (typeof App !== 'undefined' && typeof App.updateNotifCount === 'function') {
      App.updateNotifCount();
    }
    window.dispatchEvent(new CustomEvent('wfa:synced', { detail: { source: 'finance-repair' } }));
    return result;
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openAddModal, openEditModal, openPayModal, openManageAction,
    openPortalAccessModal, savePortalAccess,
    calcDue, saveStudent, savePayment,
    deleteStudent, exportExcel,
    printHistory,
    printReceipt,
    deletePayment,
    setReminder, _saveReminder,
    _forceSave, _resetDupWarning,
    _dateSelectHTML, _syncDate,
    reconcileAllStudents,
    repairMissingFinanceEntries,
    editPayment, saveEditedPayment,
    editInitialPayment, saveEditedInitialPayment,
    _syncPaidDueAfterLedgerChange,
  };

})();
window.Students = Students;
