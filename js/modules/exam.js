/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy — js/modules/exam.js
   ✅ LOGIC #1: Import date preserved as-is
   ✅ LOGIC #2: Delete → Recycle Bin (restorable)
   ✅ LOGIC #3: Every action synced via SupabaseSync
   ✅ LOGIC #4: DD/MM/YYYY date display everywhere
   ✅ LOGIC #5: Table sorted latest date first (desc)
   ✅ LOGIC #6: Every action logged in activity log
   ✅ LOGIC #7: Account never goes negative
════════════════════════════════════════════════ */

const Exam = (() => {

  let searchQuery = '';
  let filterBatch = '';
  let filterGrade = '';
  let editingId   = null;
  let currentPage = 1;
  let pageSize    = 20;

  /* ══ RENDER ══ */
  function render() {
    const container = document.getElementById('exam-content');
    if (!container) return;
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') {
      console.warn('[Exam] Core dependencies not loaded'); return;
    }

    // ✅ LOGIC #5: Latest exam_date first
    const exams    = Utils.sortBy(SupabaseSync.getAll(DB.exams), 'exam_date', 'desc');
    const filtered = applyFilters(exams);
    const batches  = [...new Set(exams.map(e => e.batch).filter(Boolean))].sort();

    const totalReg = filtered.length;
    const passed   = filtered.filter(e => e.status === 'Passed').length;
    const failed   = filtered.filter(e => e.status === 'Failed').length;
    const totalFee = filtered.reduce((s, e) => s + Utils.safeNum(e.exam_fee), 0);

    container.innerHTML = `
      <div class="exam-links-section" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:0.8rem;color:#00d4ff;font-weight:700;margin-bottom:4px;text-transform:uppercase;"><i class="fa fa-chalkboard-user"></i> Teacher / Examiner Link</div>
            <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px;">Set up Questions</div>
            <div class="blur-link-container" style="position:relative;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:6px;cursor:pointer;overflow:hidden;" onclick="this.classList.toggle('revealed')">
              <span class="blur-text" style="filter:blur(4px);transition:filter 0.3s;font-family:monospace;font-size:0.9rem;word-break:break-all;">https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/admin.html</span>
              <div class="blur-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);font-weight:700;font-size:0.8rem;transition:opacity 0.3s;color:#fff;">Click to Reveal</div>
            </div>
          </div>
          <button class="btn-primary" onclick="Utils.toast('Copied!','success');navigator.clipboard.writeText('https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/admin.html')" style="white-space:nowrap;border-radius:20px;font-weight:700;"><i class="fa fa-copy"></i> Copy</button>
        </div>
        <div style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(0,255,136,0.2);border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:0.8rem;color:#00ff88;font-weight:700;margin-bottom:4px;text-transform:uppercase;"><i class="fa fa-user-graduate"></i> Student Exam Link</div>
            <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px;">Submit Answers</div>
            <div class="blur-link-container" style="position:relative;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:6px;cursor:pointer;overflow:hidden;" onclick="this.classList.toggle('revealed')">
              <span class="blur-text" style="filter:blur(4px);transition:filter 0.3s;font-family:monospace;font-size:0.9rem;word-break:break-all;">https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/exam.html</span>
              <div class="blur-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);font-weight:700;font-size:0.8rem;transition:opacity 0.3s;color:#fff;">Click to Reveal</div>
            </div>
          </div>
          <button class="btn-primary" onclick="Utils.toast('Copied!','success');navigator.clipboard.writeText('https://shakibapon1234-maker.github.io/Wings-Fly-Academy-1/exam.html')" style="background:linear-gradient(135deg,#00ff88,#00b862);white-space:nowrap;border-radius:20px;border:none;color:#111;font-weight:700;"><i class="fa fa-copy"></i> Copy</button>
        </div>
      </div>
      <style>
        .blur-link-container.revealed .blur-text { filter: blur(0); }
        .blur-link-container.revealed .blur-overlay { opacity: 0; pointer-events: none; }
      </style>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
        <div style="box-shadow:none;border:1px solid rgba(0,212,255,0.2);padding:16px;background:rgba(0,212,255,0.05);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div style="color:#00d4ff;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">TOTAL REGISTERED</div><div style="color:#fff;font-size:1.6rem;font-weight:800;">${totalReg}</div></div>
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,212,255,0.1);display:flex;align-items:center;justify-content:center;color:#00d4ff;font-size:1.2rem;"><i class="fa fa-clipboard-list"></i></div>
          </div>
        </div>
        <div style="box-shadow:none;border:1px solid rgba(0,255,136,0.2);padding:16px;background:rgba(0,255,136,0.05);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div style="color:#00ff88;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">EXAM PASSED</div><div style="color:#00ff88;font-size:1.6rem;font-weight:800;">${passed}</div></div>
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,255,136,0.1);display:flex;align-items:center;justify-content:center;color:#00ff88;font-size:1.2rem;"><i class="fa fa-check-circle"></i></div>
          </div>
        </div>
        <div style="box-shadow:none;border:1px solid rgba(255,71,87,0.2);padding:16px;background:rgba(255,71,87,0.05);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div style="color:#ff4757;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">EXAM FAILED</div><div style="color:#ff4757;font-size:1.6rem;font-weight:800;">${failed}</div></div>
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,71,87,0.1);display:flex;align-items:center;justify-content:center;color:#ff4757;font-size:1.2rem;"><i class="fa fa-times-circle"></i></div>
          </div>
        </div>
        <div style="box-shadow:none;border:1px solid rgba(255,170,0,0.2);padding:16px;background:rgba(255,170,0,0.05);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div style="color:#ffaa00;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">TOTAL EXAM FEE</div><div style="color:#ffaa00;font-size:1.5rem;font-weight:800;">${Utils.takaEn(totalFee)}</div></div>
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,170,0,0.1);display:flex;align-items:center;justify-content:center;color:#ffaa00;font-size:1.2rem;"><i class="fa fa-money-bill"></i></div>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="exam-search" class="form-control" placeholder="Name / Reg ID Search..." value="${searchQuery}" oninput="Exam.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Exam.onFilter('batch',this.value)">
          <option value="">All Batches</option>
          ${batches.map(b => `<option value="${b}" ${filterBatch===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Exam.onFilter('grade',this.value)">
          <option value="">All Grades</option>
          ${['A+','A','A-','B+','B','C','F'].map(g => `<option value="${g}" ${filterGrade===g?'selected':''}>${g}</option>`).join('')}
        </select>
        <button class="btn-secondary btn-sm" onclick="Exam.resetFilters()"><i class="fa fa-rotate-left"></i> Reset</button>
        <button class="btn-success btn-sm" onclick="Exam.exportExcel()"><i class="fa fa-file-excel"></i> Excel</button>
        <button class="btn-secondary btn-sm" onclick="Utils.printArea('exam-print-area')"><i class="fa fa-print"></i> Print</button>
      </div>

      <div id="exam-print-area">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Reg ID</th><th>Student</th><th>Batch</th>
                <th>Subject</th><th>Date</th><th>Fee</th><th>Grade</th>
                <th>Number</th><th class="no-print">Action</th>
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
      <td style="font-size:0.82rem">${Utils.formatDateDMY(e.exam_date)}</td>
      <td style="font-family:var(--font-ui)">${Utils.takaEn(e.exam_fee)}</td>
      <td><strong>${e.grade || '—'}</strong></td>
      <td style="font-weight:600;color:${e.marks != null ? (e.marks >= 60 ? '#00ff88' : '#ff4757') : 'var(--text-muted)'}">
        ${e.marks != null ? e.marks + '%' : '—'}
      </td>
      <td class="no-print">
        <div class="table-actions">
          <button class="btn-outline btn-xs" onclick="Exam.openGradeModal('${e.id}')" title="Grade"><i class="fa fa-star"></i></button>
          <button class="btn-outline btn-xs" onclick="Exam.openEditModal('${e.id}')" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="btn-danger btn-xs" onclick="Exam.deleteEntry('${e.id}')" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  /* ══ FILTERS ══ */
  function applyFilters(rows) {
    let r = rows;
    if (searchQuery) r = Utils.searchFilter(r, searchQuery, ['student_name','student_id','reg_id','subject']);
    if (filterBatch) r = r.filter(e => e.batch === filterBatch);
    if (filterGrade) r = r.filter(e => (e.grade || '') === filterGrade);
    return r;
  }

  const debouncedRender = Utils.debounce(() => render(), 250);
  function onSearch(val) { searchQuery = val; currentPage = 1; debouncedRender(); }
  function onFilter(key, val) {
    if (key === 'batch') filterBatch = val;
    if (key === 'grade') filterGrade = val;
    currentPage = 1;
    render();
  }
  function resetFilters() { searchQuery = filterBatch = filterGrade = ''; currentPage = 1; render(); }
  function changePage(p) { currentPage = p; render(); }
  function changePageSize(s) { pageSize = parseInt(s); currentPage = 1; render(); }

  /* ══ DATE HELPER ✅ LOGIC #4 ══ */
  function _toInputDate(dateStr) {
    if (!dateStr) return Utils.today();
    return String(dateStr).split('T')[0];
  }

  function _dateField(id, value, label, required = false) {
    const val = _toInputDate(value);
    return `
      <div class="form-group">
        <label>${label}${required ? ' <span class="req">*</span>' : ''}</label>
        <input id="${id}" type="date" class="form-control" value="${val}"
          onchange="document.getElementById('${id}-disp').textContent=Utils.formatDateDMY(this.value)" />
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">
          <i class="fa fa-calendar-day"></i>
          দিন/মাস/বছর — <strong id="${id}-disp">${Utils.formatDateDMY(val)}</strong>
        </div>
      </div>`;
  }

  /* ══ REGISTRATION MODAL ══ */
  function openRegModal() {
    editingId = null;
    const exams    = SupabaseSync.getAll(DB.exams);
    const newRegId = generateRegId(exams);
    const students = SupabaseSync.getAll(DB.students);
    const cfg      = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses  = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing','Air Ticket & Visa processing Both'])
                                 : ['Air Ticketing','Air Ticket & Visa processing Both'];

    Utils.openModal('<i class="fa fa-clipboard-list"></i> Exam Registration', `
      <div class="form-row">
        <div class="form-group">
          <label>Reg ID <span class="req">*</span></label>
          <input id="ef-reg-id" class="form-control" value="${newRegId}" />
        </div>
        ${_dateField('ef-date', Utils.today(), 'Exam Date', true)}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Student <span class="req">*</span></label>
          <select id="ef-student" class="form-control" onchange="Exam.onStudentSelect()">
            <option value="">-- Select Student --</option>
            ${students.map(s => `<option value="${s.id}"
              data-name="${Utils.esc(s.name)}" data-sid="${Utils.esc(s.student_id)}"
              data-batch="${Utils.esc(s.batch)}" data-session="${Utils.esc(s.session)}">
              ${Utils.esc(s.name)} (${Utils.esc(s.student_id || '')})</option>`).join('')}
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
          <input id="ef-fee" type="number" class="form-control" placeholder="0" value="0" min="0"
            oninput="Exam._onFeeInput()" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="grid-column:span 2">
          <label>Payment Method</label>
          <select id="ef-method" class="form-control" onchange="Utils.onPaymentMethodChange(this,'ef-bal-display');Exam._onFeeInput()">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML()}
          </select>
          <div id="ef-bal-display" style="display:none;"></div>
          <div id="ef-bal-warn" style="display:none;color:#ff4757;font-size:0.8rem;margin-top:4px;font-weight:600;"></div>
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

  /* ✅ LOGIC #7: Real-time balance warning */
  function _onFeeInput() {
    const fee    = Utils.safeNum(document.getElementById('ef-fee')?.value);
    const method = document.getElementById('ef-method')?.value;
    const warnEl = document.getElementById('ef-bal-warn');
    if (!warnEl) return;
    if (!fee || !method) { warnEl.style.display = 'none'; return; }
    const bal = Utils.getAccountBalance(method);
    if (fee > bal) {
      warnEl.innerHTML = `<i class="fa fa-triangle-exclamation"></i> Insufficient! Available: ৳${bal.toLocaleString()}, Entered: ৳${fee.toLocaleString()}`;
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }

  function onStudentSelect() {
    const sel = document.getElementById('ef-student');
    if (!sel) return;
    const opt = sel.selectedOptions[0];
    if (opt) {
      Utils.formSet('ef-student-id', opt.dataset.sid     || '');
      Utils.formSet('ef-batch',      opt.dataset.batch   || '');
      Utils.formSet('ef-session',    opt.dataset.session || '');
    }
  }

  /* ══ EDIT MODAL ══ */
  function openEditModal(id) {
    const e = SupabaseSync.getById(DB.exams, id);
    if (!e) return;
    editingId = id;
    const cfg     = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing','Air Ticket & Visa processing Both'])
                                : ['Air Ticketing','Air Ticket & Visa processing Both'];

    Utils.openModal('<i class="fa fa-pen"></i> Edit Exam', `
      <div class="form-row">
        <div class="form-group">
          <label>Reg ID</label>
          <input id="ef-reg-id" class="form-control" value="${e.reg_id||''}" readonly style="background:var(--bg-base)" />
        </div>
        ${_dateField('ef-date', e.exam_date, 'Exam Date')}
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
          <input id="ef-fee" type="number" class="form-control" value="${e.exam_fee||0}" min="0" />
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
          <label>Number (0-100)</label>
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

  /* ══ GRADE MODAL ══ */
  function openGradeModal(id) {
    const e = SupabaseSync.getById(DB.exams, id);
    if (!e) return;
    Utils.openModal('<i class="fa fa-star"></i> Assign Grade', `
      <div style="background:var(--bg-base);padding:12px;border-radius:var(--radius-sm);margin-bottom:16px">
        <div style="font-weight:700">${e.student_name||'—'} (${e.student_id||''})</div>
        <div style="font-size:.85rem;color:var(--text-secondary);margin-top:4px;">
          📚 <strong>${e.subject||'No Subject'}</strong> • ${e.batch||'No Batch'}
        </div>
        ${e.marks != null ? `<div style="margin-top:6px;font-size:.8rem;color:var(--accent);">অনলাইন এক্সামের নম্বর: <strong>${e.marks}%</strong></div>` : ''}
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
          <option value="Passed" ${e.status==='Passed'?'selected':''}>Passed</option>
          <option value="Failed" ${e.status==='Failed'?'selected':''}>Failed</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-success" onclick="Exam.saveGrade('${id}')"><i class="fa fa-check"></i> Save Grade</button>
      </div>
    `, 'modal-sm');
  }

  function saveGrade(id) {
    const e      = SupabaseSync.getById(DB.exams, id);
    const grade  = Utils.formVal('gf-grade');
    const marks  = Utils.safeNum(Utils.formVal('gf-marks'));
    const status = Utils.formVal('gf-status');
    if (!grade) { Utils.toast('Please select a grade', 'error'); return; }
    // ✅ LOGIC #3: Sync
    SupabaseSync.update(DB.exams, id, { grade, marks, status });
    // ✅ LOGIC #6: Activity log
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('edit', 'exams',
        `Grade assigned: ${e?.student_name||'Unknown'} (${e?.student_id||''}) — ${e?.subject||''} → Grade: ${grade}, Number: ${marks}%, Status: ${status}`
      );
    }
    Utils.toast('Grade Saved ✓', 'success');
    Utils.closeModal();
    render();
  }

  /* ══ SAVE ══ */
  function saveEntry() {
    const errEl   = document.getElementById('ef-error');
    const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
    const regId   = Utils.formVal('ef-reg-id');
    const subject = Utils.formVal('ef-subject');
    // ✅ LOGIC #1 & #4: Use exactly the date entered (YYYY-MM-DD), no override
    const examDate = Utils.formVal('ef-date') || Utils.today();

    if (!regId)   { showErr('Reg ID Required'); return; }
    if (!subject) { showErr('Subject Required'); return; }

    const marksRaw = Utils.formVal('ef-marks');
    const marksVal = Utils.safeNum(marksRaw);
    if (marksRaw !== '' && marksRaw !== null && marksVal > 100) { showErr('Number cannot exceed 100'); return; }

    const fee    = Utils.safeNum(Utils.formVal('ef-fee'));
    const method = Utils.formVal('ef-method');

    // ✅ LOGIC #7: Block if balance insufficient
    if (!editingId && fee > 0) {
      if (!method) { showErr('Payment Method is required when Exam Fee is entered'); return; }
      const bal = Utils.getAccountBalance(method);
      if (fee > bal) {
        showErr(`Insufficient balance! "${method}" এ আছে ৳${bal.toLocaleString()}, কিন্তু ফি ৳${fee.toLocaleString()}`);
        return;
      }
    }

    let studentName, studentId;
    if (editingId) {
      studentName = Utils.formVal('ef-student-name');
      studentId   = Utils.formVal('ef-student-id');
    } else {
      const sel = document.getElementById('ef-student');
      const opt = sel?.selectedOptions[0];
      studentName = opt?.dataset?.name || '';
      studentId   = opt?.dataset?.sid  || '';
      if (!studentName) { showErr('Please select a student'); return; }
      // Duplicate subject check
      if (studentId && subject) {
        const dup = SupabaseSync.getAll(DB.exams).find(e =>
          e.student_id === studentId &&
          (e.subject || '').trim().toLowerCase() === subject.trim().toLowerCase()
        );
        if (dup) {
          showErr(`এই স্টুডেন্ট ইতিমধ্যে "${subject}" সাবজেক্টে রেজিস্ট্রেশন করেছে (${dup.status || 'Registered'})`);
          return;
        }
      }
    }

    // ✅ LOGIC #1: exam_date stored exactly as entered (import date preserved)
    const record = {
      reg_id:       regId,
      student_id:   studentId,
      student_name: studentName,
      batch:        Utils.formVal('ef-batch'),
      session:      Utils.formVal('ef-session'),
      subject,
      exam_date:    examDate,
      exam_fee:     fee,
      fee_paid:     fee > 0,
      grade:        Utils.formVal('ef-grade') || '',
      marks:        marksRaw !== '' && marksRaw !== null ? marksVal : null,
      status:       Utils.formVal('ef-status') || 'Registered',
      note:         Utils.formVal('ef-note'),
    };

    if (editingId) {
      // ✅ LOGIC #3
      SupabaseSync.update(DB.exams, editingId, record);
      // ✅ LOGIC #6
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'exams',
          `Exam updated: ${subject} — ${studentName} (${studentId}) তারিখ: ${Utils.formatDateDMY(examDate)}`
        );
      }
      Utils.toast('Exam info updated ✓', 'success');
    } else {
      // ✅ LOGIC #3
      SupabaseSync.insert(DB.exams, record);
      // ✅ LOGIC #6
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'exams',
          `Exam registered: ${subject} — ${studentName} (${studentId}) তারিখ: ${Utils.formatDateDMY(examDate)}`
        );
      }
      Utils.toast('Exam Registration Completed ✓', 'success');

      // Finance entry for exam fee
      if (fee > 0 && method) {
        // ✅ LOGIC #1: Finance date = exam_date exactly
        SupabaseSync.insert(DB.finance, {
          type:        'Income',
          category:    'Exam Fee',
          description: `${studentName} (${studentId}) — Exam Fee (${subject})`,
          amount:      fee,
          method,
          date:        examDate,
        });
        SupabaseSync.updateAccountBalance(method, fee, 'in');
        // ✅ LOGIC #6
        if (typeof SupabaseSync.logActivity === 'function') {
          SupabaseSync.logActivity('payment', 'exams',
            `Exam Fee: ${studentName} (${studentId}) — ${subject} ৳${Utils.formatMoneyPlain(fee)} via ${method} — তারিখ: ${Utils.formatDateDMY(examDate)}`
          );
        }
      }
    }

    Utils.closeModal();
    render();
  }

  /* ══ DELETE → RECYCLE BIN ✅ LOGIC #2 ══ */
  async function deleteEntry(id) {
    const entry = SupabaseSync.getById(DB.exams, id);
    const ok = await Utils.confirm(
      `"${entry?.student_name || 'এই স্টুডেন্ট'}" এর "${entry?.subject || 'exam'}" রেজিস্ট্রেশন রিসাইকেল বিনে যাবে এবং পরে পুনরুদ্ধার করা যাবে।`,
      'Delete Exam'
    );
    if (!ok) return;

    // Reverse finance if fee was paid
    if (entry && entry.fee_paid && Utils.safeNum(entry.exam_fee) > 0) {
      const fin = SupabaseSync.getAll(DB.finance).find(f =>
        f.category === 'Exam Fee' && f.type === 'Income' &&
        Utils.safeNum(f.amount) === Utils.safeNum(entry.exam_fee) &&
        (f.description || '').includes(entry.student_name || '')
      );
      if (fin && fin.method) {
        SupabaseSync.updateAccountBalance(fin.method, Utils.safeNum(fin.amount), 'out', true);
        SupabaseSync.remove(DB.finance, fin.id);
      }
    }

    // ✅ LOGIC #2: remove() auto-sends to recycle bin
    SupabaseSync.remove(DB.exams, id);

    // ✅ LOGIC #6: Log
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('delete', 'exams',
        `Exam → Recycle Bin: ${entry?.student_name||'Unknown'} — ${entry?.subject||'Unknown'} (${Utils.formatDateDMY(entry?.exam_date)})`
      );
    }
    Utils.toast('রিসাইকেল বিনে পাঠানো হয়েছে। পুনরুদ্ধারের জন্য Recycle Bin দেখুন।', 'info');
    render();
  }

  /* ══ EXPORT ✅ LOGIC #4: DD/MM/YYYY in Excel ══ */
  function exportExcel() {
    const filtered = applyFilters(SupabaseSync.getAll(DB.exams));
    const rows = filtered.map(e => ({
      'Reg ID':      e.reg_id       || '',
      'Student ID':  e.student_id   || '',
      'Name':        e.student_name || '',
      'Batch':       e.batch        || '',
      'Session':     e.session      || '',
      'Subject':     e.subject      || '',
      'Date':        Utils.formatDateDMY(e.exam_date),
      'Fee':         e.exam_fee     || 0,
      'Grade':       e.grade        || '',
      'Number (%)':  e.marks != null ? e.marks : '',
      'Status':      e.status       || '',
    }));
    // ✅ LOGIC #6
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('export', 'exams', `Exam Excel exported — ${rows.length} records`);
    }
    Utils.exportExcel(rows, 'exams', 'Exams');
  }

  /* ══ HELPERS ══ */
  function generateRegId(exams) {
    const prefix = 'EX-';
    let num = 1001;
    if (exams.length) {
      const nums = exams.map(e => parseInt((e.reg_id || '').replace(/\D/g, '')) || 0);
      num = Math.max(...nums, 1000) + 1;
    }
    return prefix + num;
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openRegModal, openEditModal, openGradeModal,
    onStudentSelect, saveEntry, saveGrade, deleteEntry, exportExcel,
    _onFeeInput,
  };

})();
window.ExamModule = Exam;
window.Exam = Exam;
