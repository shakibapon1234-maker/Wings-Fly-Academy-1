/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/exam.js
   Exam Module — Registration, Results, Grades
════════════════════════════════════════════════ */

const Exam = (() => {

  let searchQuery = '';
  let filterBatch = '';
  let filterStatus = '';
  let editingId = null;
  let currentPage = 1;
  let pageSize = 20;

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function render() {
    const container = document.getElementById('exam-content');
    if (!container) return;
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') {
      console.warn('[Exam] Core dependencies not loaded'); return;
    }

    const exams    = Utils.sortBy(SupabaseSync.getAll(DB.exams), 'exam_date', 'desc');
    const filtered = applyFilters(exams);
    const batches  = [...new Set(exams.map(e => e.batch).filter(Boolean))].sort();

    const totalReg  = filtered.length;
    const passed    = filtered.filter(e => e.status === 'Passed').length;
    const failed    = filtered.filter(e => e.status === 'Failed').length;
    const totalFee  = filtered.reduce((s, e) => s + Utils.safeNum(e.exam_fee), 0);

    container.innerHTML = `
      <!-- Summary -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        ${sCard('fa-clipboard-list','blue','Registered', totalReg)}
        ${sCard('fa-check-circle','green','Passed', passed)}
        ${sCard('fa-times-circle','red','Failed', failed)}
        ${sCard('fa-money-bill','amber','Exam Fee', Utils.takaEn(totalFee))}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="exam-search" class="form-control" placeholder="Name / Reg ID Search…" value="${searchQuery}" oninput="Exam.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Exam.onFilter('batch',this.value)">
          <option value="">All Batches</option>
          ${batches.map(b => `<option value="${b}" ${filterBatch===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Exam.onFilter('status',this.value)">
          <option value="">All Status</option>
          <option value="Registered" ${filterStatus==='Registered'?'selected':''}>Registered</option>
          <option value="Appeared"   ${filterStatus==='Appeared'?'selected':''}>Present</option>
          <option value="Passed"     ${filterStatus==='Passed'?'selected':''}>Passed</option>
          <option value="Failed"     ${filterStatus==='Failed'?'selected':''}>Failed</option>
        </select>
        <button class="btn-secondary btn-sm" onclick="Exam.resetFilters()"><i class="fa fa-rotate-left"></i> Reset</button>
        <button class="btn-success btn-sm"   onclick="Exam.exportExcel()"><i class="fa fa-file-excel"></i> Excel</button>
        <button class="btn-secondary btn-sm" onclick="Utils.printArea('exam-print-area')"><i class="fa fa-print"></i> Print</button>
      </div>

      <!-- Table -->
      <div id="exam-print-area">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Reg ID</th>
                <th>Student</th>
                <th>Batch</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Fee</th>
                <th>Grade</th>
                <th>Status</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const pageData = Utils.paginate(filtered, currentPage, pageSize);
                return renderRows(pageData.items, (currentPage - 1) * pageSize);
              })()}
            </tbody>
          </table>
        </div>
        ${(() => {
          const pageData = Utils.paginate(filtered, currentPage, pageSize);
          return (pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'Exam') : '';
        })()}
      </div>
    `;
  }

  function renderRows(rows, startIndex = 0) {
    if (!rows.length) return Utils.noDataRow(10, 'No exam registrations found');
    return rows.map((e, i) => `<tr>
      <td style="color:var(--text-muted);font-size:0.8rem">${startIndex + i + 1}</td>
      <td>${Utils.badge(e.reg_id || '—', 'primary')}</td>
      <td>
        <div style="font-weight:600">${Utils.esc(e.student_name || '—')}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${Utils.esc(e.student_id || '')}</div>
      </td>
      <td>${Utils.esc(e.batch || '—')}</td>
      <td>${Utils.esc(e.subject || '—')}</td>
      <td style="font-size:0.82rem">${Utils.formatDate(e.exam_date)}</td>
      <td style="font-family:var(--font-ui)">${Utils.takaEn(e.exam_fee)}</td>
      <td><strong>${e.grade || '—'}</strong></td>
      <td>${Utils.statusBadge(e.status || 'Registered')}</td>
      <td class="no-print">
        <div class="table-actions">
          <button class="btn-outline btn-xs" onclick="Exam.openGradeModal('${e.id}')" title="Grade"><i class="fa fa-star"></i></button>
          <button class="btn-outline btn-xs" onclick="Exam.openEditModal('${e.id}')" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="btn-danger btn-xs"  onclick="Exam.deleteEntry('${e.id}')" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function sCard(icon, color, label, value) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}"><i class="fa ${icon}"></i></div>
      <div class="stat-info"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>
    </div>`;
  }

  /* ══════════════════════════════════════════
     FILTERS
  ══════════════════════════════════════════ */
  function applyFilters(rows) {
    let r = rows;
    if (searchQuery)  r = Utils.searchFilter(r, searchQuery, ['student_name','student_id','reg_id','subject']);
    if (filterBatch)  r = r.filter(e => e.batch === filterBatch);
    if (filterStatus) r = r.filter(e => e.status === filterStatus);
    return r;
  }

  const debouncedRender = Utils.debounce(() => render(), 250);
  function onSearch(val) { searchQuery = val; currentPage = 1; debouncedRender(); }
  function onFilter(key, val) {
    if (key === 'batch')  filterBatch = val;
    if (key === 'status') filterStatus = val;
    currentPage = 1;
    render();
  }
  function resetFilters() { searchQuery = filterBatch = filterStatus = ''; currentPage = 1; render(); }
  function changePage(p) { currentPage = p; render(); }
  function changePageSize(s) { pageSize = parseInt(s); currentPage = 1; render(); }

  /* ══════════════════════════════════════════
     REGISTRATION MODAL
  ══════════════════════════════════════════ */
  function openRegModal() {
    editingId = null;
    const exams = SupabaseSync.getAll(DB.exams);
    const newRegId = generateRegId(exams);
    const students = SupabaseSync.getAll(DB.students);

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];

    Utils.openModal('<i class="fa fa-clipboard-list"></i> Exam Registration', `
      <div class="form-row">
        <div class="form-group">
          <label>Reg ID <span class="req">*</span></label>
          <input id="ef-reg-id" class="form-control" value="${newRegId}" />
        </div>
        <div class="form-group">
          <label>Exam Date <span class="req">*</span></label>
          <input id="ef-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Student <span class="req">*</span></label>
          <select id="ef-student" class="form-control" onchange="Exam.onStudentSelect()">
            <option value="">-- Select Student --</option>
            ${students.map(s => `<option value="${s.id}" data-name="${Utils.esc(s.name)}" data-sid="${Utils.esc(s.student_id)}" data-batch="${Utils.esc(s.batch)}" data-session="${Utils.esc(s.session)}">${Utils.esc(s.name)} (${Utils.esc(s.student_id || '')})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Student ID</label>
          <input id="ef-student-id" class="form-control" readonly style="background:var(--bg-base)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Batch</label>
          <input id="ef-batch" class="form-control" placeholder="Batch" />
        </div>
        <div class="form-group">
          <label>Session</label>
          <input id="ef-session" class="form-control" placeholder="Session" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Subject / Course <span class="req">*</span></label>
          <input id="ef-subject" class="form-control" list="exam-subject-list" placeholder="Subject / Course Name" />
          <datalist id="exam-subject-list">
            ${courses.map(c => `<option value="${c}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label>Exam Fee (৳)</label>
          <input id="ef-fee" type="number" class="form-control" placeholder="0" value="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="grid-column: span 2">
          <label>Payment Method (if paying fee) <span class="req">*</span></label>
          <select id="ef-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'ef-bal-display')">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML()}
          </select>
          <div id="ef-bal-display" style="display:none;"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="ef-note" class="form-control" rows="2" placeholder="Optional"></textarea>
      </div>
      <div id="ef-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Exam.saveEntry()"><i class="fa fa-floppy-disk"></i> Register</button>
      </div>
    `);
  }

  function onStudentSelect() {
    const sel = document.getElementById('ef-student');
    if (!sel) return;
    const opt = sel.selectedOptions[0];
    if (opt) {
      Utils.formSet('ef-student-id', opt.dataset.sid || '');
      Utils.formSet('ef-batch', opt.dataset.batch || '');
      Utils.formSet('ef-session', opt.dataset.session || '');
    }
  }

  /* ══════════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════════ */
  function openEditModal(id) {
    const e = SupabaseSync.getById(DB.exams, id);
    if (!e) return;
    editingId = id;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];

    Utils.openModal('<i class="fa fa-pen"></i> Edit Exam', `
      <div class="form-row">
        <div class="form-group">
          <label>Reg ID</label>
          <input id="ef-reg-id" class="form-control" value="${e.reg_id||''}" readonly style="background:var(--bg-base)" />
        </div>
        <div class="form-group">
          <label>Exam Date</label>
          <input id="ef-date" type="date" class="form-control" value="${(e.exam_date||'').split('T')[0]}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Student Name</label>
          <input id="ef-student-name" class="form-control" value="${e.student_name||''}" />
        </div>
        <div class="form-group">
          <label>Student ID</label>
          <input id="ef-student-id" class="form-control" value="${e.student_id||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Batch</label>
          <input id="ef-batch" class="form-control" value="${e.batch||''}" />
        </div>
        <div class="form-group">
          <label>Session</label>
          <input id="ef-session" class="form-control" value="${e.session||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Subject / Course</label>
          <input id="ef-subject" class="form-control" list="edit-exam-subject-list" value="${e.subject||''}" />
          <datalist id="edit-exam-subject-list">
            ${courses.map(c => `<option value="${c}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label>Exam Fee (৳)</label>
          <input id="ef-fee" type="number" class="form-control" value="${e.exam_fee||0}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="grid-column: span 2">
          <label>Payment Method (if paying fee) <span class="req">*</span></label>
          <select id="ef-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'ef-bal-display')">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML()}
          </select>
          <div id="ef-bal-display" style="display:none;"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Grade</label>
          <select id="ef-grade" class="form-control">
            <option value="">—</option>
            ${['A+','A','A-','B+','B','B-','C+','C','D','F'].map(g => `<option value="${g}" ${e.grade===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Number</label>
          <input id="ef-marks" type="number" class="form-control" value="${e.marks||''}" placeholder="0-100" min="0" max="100" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="ef-status" class="form-control">
            <option value="Registered" ${e.status==='Registered'?'selected':''}>Registered</option>
            <option value="Appeared"   ${e.status==='Appeared'?'selected':''}>Present</option>
            <option value="Passed"     ${e.status==='Passed'?'selected':''}>Passed</option>
            <option value="Failed"     ${e.status==='Failed'?'selected':''}>Failed</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="ef-note" class="form-control" rows="2">${e.note||''}</textarea>
      </div>
      <div id="ef-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Exam.saveEntry()"><i class="fa fa-floppy-disk"></i> Update</button>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     GRADE MODAL (Quick)
  ══════════════════════════════════════════ */
  function openGradeModal(id) {
    const e = SupabaseSync.getById(DB.exams, id);
    if (!e) return;

    Utils.openModal('<i class="fa fa-star"></i> Assign Grade', `
      <div style="background:var(--bg-base);padding:12px;border-radius:var(--radius-sm);margin-bottom:16px">
        <div style="font-weight:700">${e.student_name||'—'} (${e.student_id||''})</div>
        <div style="font-size:.85rem;color:var(--text-secondary)">${e.subject||''} • ${e.batch||''}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Grade <span class="req">*</span></label>
          <select id="gf-grade" class="form-control">
            <option value="">—</option>
            ${['A+','A','A-','B+','B','B-','C+','C','D','F'].map(g => `<option value="${g}" ${e.grade===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Number (0-100)</label>
          <input id="gf-marks" type="number" class="form-control" value="${e.marks||''}" min="0" max="100" />
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="gf-status" class="form-control">
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-success" onclick="Exam.saveGrade('${id}')"><i class="fa fa-check"></i> Save Grade</button>
      </div>
    `, 'modal-sm');
  }

  function saveGrade(id) {
    const grade  = Utils.formVal('gf-grade');
    const marks  = Utils.safeNum(Utils.formVal('gf-marks'));
    const status = Utils.formVal('gf-status');
    if (!grade) { Utils.toast('Please select a grade', 'error'); return; }
    SupabaseSync.update(DB.exams, id, { grade, marks, status });
    Utils.toast('Grade Saved ✓', 'success');
    Utils.closeModal();
    render();
  }

  /* ══════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════ */
  function saveEntry() {
    const errEl = document.getElementById('ef-error');
    const regId = Utils.formVal('ef-reg-id');
    const date  = Utils.formVal('ef-date');
    const subject = Utils.formVal('ef-subject');

    if (!regId) { errEl.textContent = 'Reg ID Required'; errEl.classList.remove('hidden'); return; }
    if (!subject) { errEl.textContent = 'Subject Required'; errEl.classList.remove('hidden'); return; }
    
    // ✅ Fix #12: validate marks do not exceed 100
    const marksVal = Utils.safeNum(Utils.formVal('ef-marks'));
    if (Utils.formVal('ef-marks') !== '' && marksVal > 100) {
      errEl.textContent = 'Marks cannot exceed 100'; errEl.classList.remove('hidden'); return;
    }

    if (Utils.safeNum(Utils.formVal('ef-fee')) > 0 && !Utils.formVal('ef-method')) {
      errEl.textContent = 'Payment Method is required when Exam Fee is entered';
      errEl.classList.remove('hidden'); return;
    }

    let studentName, studentId;
    if (editingId) {
      studentName = Utils.formVal('ef-student-name');
      studentId   = Utils.formVal('ef-student-id');
    } else {
      const sel = document.getElementById('ef-student');
      const opt = sel?.selectedOptions[0];
      studentName = opt?.dataset?.name || '';
      studentId   = opt?.dataset?.sid || '';
      if (!studentName) { errEl.textContent = 'Please select a student'; errEl.classList.remove('hidden'); return; }
    }

    const record = {
      reg_id:       regId,
      student_id:   studentId,
      student_name: studentName,
      batch:        Utils.formVal('ef-batch'),
      session:      Utils.formVal('ef-session'),
      subject:      subject,
      exam_date:    date || Utils.today(),
      exam_fee:     Utils.safeNum(Utils.formVal('ef-fee')),
      fee_paid:     Utils.safeNum(Utils.formVal('ef-fee')) > 0,
      grade:        Utils.formVal('ef-grade') || '',
      marks:        Utils.safeNum(Utils.formVal('ef-marks')) || null,
      status:       Utils.formVal('ef-status') || 'Registered',
      note:         Utils.formVal('ef-note'),
    };

    if (editingId) {
      SupabaseSync.update(DB.exams, editingId, record);
      Utils.toast('Exam info updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.exams, record);
      Utils.toast('Exam Registration Completed ✓', 'success');

      // Finance entry for exam fee
      if (record.exam_fee > 0) {
        const method = Utils.formVal('ef-method');
        if (!method) {
          Utils.toast('Please select payment method for the fee', 'error');
        } else {
          SupabaseSync.insert(DB.finance, {
            type: 'Income', category: 'Exam Fee',
            description: `${studentName} (${studentId}) — Exam Fee (${subject})`,
            amount: record.exam_fee, method: method, date: record.exam_date,
          });
          SupabaseSync.updateAccountBalance(method, record.exam_fee, 'in');
        }
      }
    }

    Utils.closeModal();
    render();
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteEntry(id) {
    const ok = await Utils.confirm('Delete this exam registration?', 'Delete Exam');
    if (!ok) return;

    // ✅ Bug #1 fix: reverse account balance + remove finance entry if fee was paid
    const entry = SupabaseSync.getById(DB.exams, id);
    if (entry && entry.fee_paid && Utils.safeNum(entry.exam_fee) > 0) {
      const allFinance = SupabaseSync.getAll(DB.finance);
      const finEntry = allFinance.find(f =>
        f.category === 'Exam Fee' &&
        f.type     === 'Income'   &&
        Utils.safeNum(f.amount) === Utils.safeNum(entry.exam_fee) &&
        (f.description || '').includes(entry.student_name || '')
      );
      if (finEntry && finEntry.method) {
        SupabaseSync.updateAccountBalance(finEntry.method, Utils.safeNum(finEntry.amount), 'out', true); // deletion reversal: force=true
        SupabaseSync.remove(DB.finance, finEntry.id);
      }
    }

    SupabaseSync.remove(DB.exams, id);
    Utils.toast('Exam registration deleted', 'info');
    render();
  }


  /* ══════════════════════════════════════════
     EXPORT
  ══════════════════════════════════════════ */
  function exportExcel() {
    const all = SupabaseSync.getAll(DB.exams);
    const filtered = applyFilters(all);
    const rows = filtered.map(e => ({
      'Reg ID':    e.reg_id||'',
      'Student ID': e.student_id||'',
      'Name':       e.student_name||'',
      'Batch':     e.batch||'',
      'Session':     e.session||'',
      'Subject':     e.subject||'',
      'Date':    e.exam_date||'',
      'Fee':        e.exam_fee||0,
      'Grade':     e.grade||'',
      'Number':     e.marks||'',
      'Status': e.status||'',
    }));
    Utils.exportExcel(rows, 'exams', 'Exams');
  }

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  function generateRegId(exams) {
    const prefix = 'EX-';
    let num = 1001;
    if (exams.length) {
      const numbers = exams.map(e => parseInt((e.reg_id || '').replace(/\D/g, '')) || 0);
      num = Math.max(...numbers, 1000) + 1;
    }
    return prefix + num;
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openRegModal, openEditModal, openGradeModal,
    onStudentSelect, saveEntry, saveGrade, deleteEntry, exportExcel,
  };

})();
window.ExamModule = Exam;
