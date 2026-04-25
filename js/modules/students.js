/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/students.js
   Student Module — CRUD, Search, Filter, Print, Export
════════════════════════════════════════════════ */

const Students = (() => {

  /* ── State ── */
  let searchQuery  = '';
  let filterBatch  = '';
  let filterCourse = '';
  let filterStatus = '';
  let editingId    = null;
  let currentPage  = 1;
  let pageSize     = 20;

  // ✅ BUG #3 FIX: Filter state persistence
  function _saveFilterState() {
    sessionStorage.setItem('wfa_students_search', searchQuery);
    sessionStorage.setItem('wfa_students_batch', filterBatch);
    sessionStorage.setItem('wfa_students_course', filterCourse);
    sessionStorage.setItem('wfa_students_status', filterStatus);
    sessionStorage.setItem('wfa_students_page', String(currentPage));
  }

  function _loadFilterState() {
    searchQuery  = sessionStorage.getItem('wfa_students_search') || '';
    filterBatch  = sessionStorage.getItem('wfa_students_batch') || '';
    filterCourse = sessionStorage.getItem('wfa_students_course') || '';
    filterStatus = sessionStorage.getItem('wfa_students_status') || '';
    currentPage  = parseInt(sessionStorage.getItem('wfa_students_page') || '1');
  }

  function _clearFilterState() {
    sessionStorage.removeItem('wfa_students_search');
    sessionStorage.removeItem('wfa_students_batch');
    sessionStorage.removeItem('wfa_students_course');
    sessionStorage.removeItem('wfa_students_status');
    sessionStorage.removeItem('wfa_students_page');
  }

  /* ══════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════ */
  function render() {
    _loadFilterState(); // ✅ BUG #3 FIX: Restore saved filters
    const container = document.getElementById('students-content');
    if (!container) return;

    const all      = SupabaseSync.getAll(DB.students);
    const batches  = [...new Set(all.map(s => s.batch).filter(Boolean))].sort();
    const courses  = [...new Set(all.map(s => s.course).filter(Boolean))].sort();
    // admission_date desc — user-দেওয়া তারিখ অনুযায়ী সর্বশেষ সবার উপরে
    const sorted   = Utils.sortBy(all, 'admission_date', 'desc');
    const filtered = applyFilters(sorted);

    /* Summary row */
    const totalFee  = filtered.reduce((s,r) => s + Utils.safeNum(r.total_fee), 0);
    const totalPaid = filtered.reduce((s,r) => s + Utils.safeNum(r.paid), 0);
    const totalDue  = filtered.reduce((s,r) => s + Utils.safeNum(r.due), 0);

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
          <input id="stu-search" class="form-control" placeholder="Search by Name / ID / Phone / Batch…" value="${searchQuery}" oninput="Students.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Students.onFilter('batch',this.value)">
          <option value="">All Batches</option>
          ${batches.map(b=>`<option value="${b}" ${filterBatch===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Students.onFilter('course',this.value)">
          <option value="">All Courses</option>
          ${courses.map(c=>`<option value="${c}" ${filterCourse===c?'selected':''}>${c}</option>`).join('')}
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
                <th>Course</th>
                <th>Batch</th>
                <th>Session</th>
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
        <td>${Utils.esc(s.course)||'—'}</td>
        <td>${Utils.esc(s.batch)||'—'}</td>
        <td>${Utils.esc(s.session)||'—'}</td>
        <td style="font-family:var(--font-en)">${Utils.takaEn(s.total_fee)}</td>
        <td class="ledger-income">${Utils.takaEn(s.paid)}</td>
        <td class="${Utils.safeNum(s.due)>0?'ledger-expense':''}">${Utils.takaEn(s.due)}</td>
        <td>${Utils.statusBadge(s.status||'Active')}</td>
        <td class="no-print">
          <button class="btn-primary btn-xs" onclick="Students.openManageAction('${s.id}')" style="background:var(--brand-primary);color:var(--bg-base);font-weight:700;border-radius:20px;padding:4px 14px">
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
    if (filterBatch)  r = r.filter(s => s.batch  === filterBatch);
    if (filterCourse) r = r.filter(s => s.course === filterCourse);
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

  function changePage(p) { currentPage = p; render(); }
  function changePageSize(s) { pageSize = parseInt(s, 10); currentPage = 1; render(); }

  /* ══════════════════════════════════════════
     ADD MODAL
  ══════════════════════════════════════════ */
  function openAddModal() {
    editingId = null;
    const all = SupabaseSync.getAll(DB.students);
    const newId = Utils.generateStudentId(all.map(s => s.student_id));
    const today = Utils.today();
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];

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
              <input id="sf-date" type="date" class="sf-input" value="${today}" />
            </div>
          </div>
          <div class="sf-grid-2" style="margin-bottom:12px;">
            <div class="sf-field">
              <label class="sf-label">Full Name <span class="req">*</span></label>
              <input id="sf-name" class="sf-input" placeholder="Student's full name" maxlength="100" autocomplete="name" />
            </div>
            <div class="sf-field">
              <label class="sf-label">Phone Number <span class="req">*</span></label>
              <input id="sf-phone" class="sf-input" placeholder="01XXXXXXXXX" maxlength="20" pattern="[0-9+\-() ]{7,20}" />
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
        </div>

        <!-- SECTION: Course -->
        <div class="sf-section">
          <div class="sf-section-title"><i class="fa fa-graduation-cap"></i> Course & Batch</div>
          <div class="sf-grid-3">
            <div class="sf-field">
              <label class="sf-label">Course <span class="req">*</span></label>
              <select id="sf-course" class="sf-input sf-select">
                <option value="">-- Select Course --</option>
                ${courses.map(c => `<option value="${c}">${c}</option>`).join('')}
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
        </div>

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
  }


  /* ══════════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════════ */
  function openEditModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    editingId = id;

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const courses = cfg.courses ? (Utils.safeJSON(cfg.courses) || ['Air Ticketing', 'Air Ticket & Visa processing Both']) : ['Air Ticketing', 'Air Ticket & Visa processing Both'];

    Utils.openModal('<i class="fa fa-pen"></i> Student Edit', `
      <div class="form-row">
        <div class="form-group">
          <label>Student ID</label>
          <input id="sf-sid" class="form-control" value="${s.student_id||''}" readonly style="background:var(--bg-surface)" />
        </div>
        <div class="form-group">
          <label>Admission Date</label>
          <input id="sf-date" type="date" class="form-control" value="${(s.admission_date||'').split('T')[0]}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="sf-name" class="form-control" value="${s.name||''}" maxlength="100" />
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input id="sf-phone" class="form-control" value="${s.phone||''}" maxlength="20" pattern="[0-9+\-() ]{7,20}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input id="sf-email" type="email" class="form-control" value="${s.email||''}" />
        </div>
        <div class="form-group">
          <label>Father Name</label>
          <input id="sf-father" class="form-control" value="${s.father_name||''}" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Course</label>
          <select id="sf-course" class="form-control">
            <option value="">-- Select Course --</option>
            ${courses.map(c => `<option value="${c}" ${s.course===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Batch</label>
          <input id="sf-batch" class="form-control" value="${s.batch||''}" />
        </div>
        <div class="form-group">
          <label>Session</label>
          <input id="sf-session" class="form-control" value="${s.session||''}" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Total Fee (৳)</label>
          <input id="sf-total-fee" type="number" class="form-control" value="${s.total_fee||0}" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>Paid (৳)</label>
          <input id="sf-paid" type="number" class="form-control" value="${s.paid||0}" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>Due (৳)</label>
          <input id="sf-due" type="number" class="form-control" value="${s.due||0}" readonly style="background:var(--bg-surface)" />
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
          <input id="sf-address" class="form-control" value="${s.address||''}" maxlength="300" />
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
        <textarea id="sf-note" class="form-control" rows="2">${s.note||''}</textarea>
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
        <div style="font-weight:700;font-size:1.1rem;color:var(--brand-primary);">${s.name}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">ID: ${s.student_id}</div>
      </div>
      
      <button class="action-btn-glow btn-yellow" onclick="Utils.closeModal(); setTimeout(()=>Students.openPayModal('${id}'), 300)">
        <i class="fa fa-sack-dollar"></i> PAYMENTS & HISTORY
      </button>
      
      <button class="action-btn-glow btn-cyan" onclick="IDCardsModule && IDCardsModule.previewCard('${id}')">
        <i class="fa fa-id-badge"></i> VIEW ID CARD
      </button>
      
      <button class="action-btn-glow btn-orange" onclick="CertificatesModule && CertificatesModule.previewCertificate('${id}')">
        <i class="fa fa-award"></i> GENERATE CERTIFICATE
      </button>
      
      <button class="action-btn-glow btn-green" onclick="Utils.closeModal(); setTimeout(()=>Students.openEditModal('${id}'), 300)">
        <i class="fa fa-user-pen"></i> EDIT PROFILE
      </button>
      
      <button class="action-btn-glow btn-purple" onclick="Students.printReceipt('${id}')">
        <i class="fa fa-print"></i> PRINT RECEIPT
      </button>
      
      <button class="action-btn-glow btn-grey" onclick="Students.setReminder('${id}','${s.name.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">
        <i class="fa fa-bell"></i> SET REMINDER
      </button>
      
      <button class="action-btn-glow btn-red" onclick="Utils.closeModal(); setTimeout(()=>Students.deleteStudent('${id}'), 300)">
        <i class="fa fa-trash"></i> DELETE
      </button>
      
      <button class="action-btn-glow btn-white" style="margin-top:24px" onclick="Utils.closeModal()">
        CLOSE MENU
      </button>
    `, 'modal-sm');
  }

  /* ══════════════════════════════════════════
     PAYMENT HISTORY & INSTALLMENTS MODAL
  ══════════════════════════════════════════ */
  function openPayModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;

    // Get past payments for this student
    const allFinance = SupabaseSync.getAll(DB.finance);
    const history = allFinance
       .filter(f => f.ref_id === id && f.category === 'Student Fee')
       .sort((a,b) => new Date(b.date) - new Date(a.date)); // Latest first

    let historyTableRows = '';
    if (history.length === 0) {
      historyTableRows = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:12px;">No payment history found</td></tr>';
    } else {
      historyTableRows = history.map((f, index) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05)">
          <td style="padding:10px 8px">${index + 1}</td>
          <td style="padding:10px 8px">${Utils.formatDateDMY(f.date)}</td>
          <td style="padding:10px 8px"><span class="badge badge-info">${f.method||'Cash'}</span></td>
          <td style="padding:10px 8px;font-weight:700;color:var(--success)">${Utils.takaEn(f.amount)}</td>
          <td style="padding:10px 8px;text-align:right"><button class="btn btn-ghost btn-xs" onclick="Students.deletePayment('${f.id}','${id}')">Delete</button></td>
        </tr>
      `).join('');
    }

    Utils.openModal('<i class="fa fa-credit-card"></i> Payment History & Installments', `
      <!-- Student Info Bar -->
      <div style="background:rgba(0,180,255,0.08); border:1px solid rgba(0,180,255,0.2); border-radius:10px; padding:14px 20px; margin-bottom:18px; display:flex; align-items:center; gap:16px;">
        <i class="fa fa-user-graduate" style="font-size:1.5rem; color:var(--brand-primary);"></i>
        <div>
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-primary);">${s.name}</div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">ID: ${s.student_id} &nbsp;|&nbsp; Course: ${s.course||'—'} &nbsp;|&nbsp; Batch: ${s.batch||'—'}</div>
        </div>
      </div>

      <!-- Top Cards -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:22px;">
        <div style="background:rgba(0,0,0,0.35); border:1.5px solid rgba(0,217,255,0.25); border-radius:10px; padding:20px; text-align:center;">
          <div style="font-size:0.72rem; font-weight:800; color:var(--text-secondary); letter-spacing:1.5px; margin-bottom:10px;">TOTAL FEE</div>
          <div style="font-size:1.8rem; font-weight:900; color:#00d9ff">${Utils.takaEn(s.total_fee)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.35); border:1.5px solid rgba(0,255,136,0.25); border-radius:10px; padding:20px; text-align:center;">
          <div style="font-size:0.72rem; font-weight:800; color:var(--text-secondary); letter-spacing:1.5px; margin-bottom:10px;">PAID TO DATE</div>
          <div style="font-size:1.8rem; font-weight:900; color:#00ff88">${Utils.takaEn(s.paid)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.35); border:1.5px solid rgba(255,71,87,0.25); border-radius:10px; padding:20px; text-align:center;">
          <div style="font-size:0.72rem; font-weight:800; color:var(--text-secondary); letter-spacing:1.5px; margin-bottom:10px;">OUTSTANDING DUE</div>
          <div style="font-size:1.8rem; font-weight:900; color:#ff4757">${Utils.takaEn(s.due)}</div>
        </div>
      </div>

      <!-- Add Installment Section -->
      <div style="border: 1.5px solid var(--border-glow); border-radius: 10px; padding: 22px; margin-bottom: 26px; position: relative; background:rgba(0,0,0,0.15);">
        <div style="font-size:1rem; font-weight:800; color:var(--brand-primary); margin-bottom:16px; display:flex; align-items:center; gap:8px;">
          <i class="fa fa-plus-circle"></i> Add New Installment
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:14px; align-items:end;">
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.8px; display:block; margin-bottom:6px;">AMOUNT (৳)</label>
            <input id="pay-amount" type="number" class="form-control" style="width:100%; font-size:1rem; padding:10px 14px;" placeholder="e.g. ${s.due}" max="${s.due}" onkeypress="if(event.key==='Enter') Students.savePayment('${id}')" />
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.8px; display:block; margin-bottom:6px;">PAYMENT METHOD</label>
            <select id="pay-method" class="form-control" style="width:100%; font-size:1rem; padding:10px 14px;" onchange="Utils.onPaymentMethodChange(this, 'pay-bal-display')">
              <option value="">Select Method...</option>
              ${Utils.getPaymentMethodsHTML()}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.8px; display:block; margin-bottom:6px;">DATE</label>
            <input id="pay-date" type="date" class="form-control" style="width:100%; font-size:1rem; padding:10px 14px;" value="${Utils.today()}" />
          </div>
          <div>
            <button class="btn-primary" style="background: linear-gradient(90deg, #00d9ff, #b537f2); border:none; border-radius:8px; font-weight:800; font-size:0.85rem; padding:11px 20px; white-space:nowrap; cursor:pointer;" onclick="Students.savePayment('${id}')">
              <i class="fa fa-plus"></i> ADD & PRINT RECEIPT
            </button>
          </div>
        </div>
        <div id="pay-bal-display" style="display:none; margin-top:10px;"></div>
        <div id="pay-error" class="form-error hidden" style="margin-top:10px"></div>
      </div>

      <!-- History Table Section -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div style="font-size:1rem; font-weight:800; color:var(--brand-primary); display:flex; align-items:center; gap:8px;">
          <i class="fa fa-history"></i> Payment History
          <span style="background:var(--brand-primary); color:#000; font-size:0.72rem; font-weight:900; padding:2px 8px; border-radius:20px;">${history.length} records</span>
        </div>
        <button class="btn-outline btn-xs" style="color:#ff6b35; border-color:#ff6b35; padding:7px 14px;" onclick="Students.printHistory('${id}')"><i class="fa fa-print"></i> PRINT HISTORY</button>
      </div>
      <div style="overflow:hidden; border-radius:10px; border:1px solid rgba(255,255,255,0.1)">
        <table style="width:100%; border-collapse:collapse; font-size:0.92rem; text-align:left;">
          <thead style="background:rgba(255,255,255,0.07); border-bottom:2px solid var(--brand-primary);">
            <tr>
              <th style="padding:12px 14px;font-weight:800;letter-spacing:1px">#</th>
              <th style="padding:12px 14px;font-weight:800;letter-spacing:1px">DATE</th>
              <th style="padding:12px 14px;font-weight:800;letter-spacing:1px">METHOD</th>
              <th style="padding:12px 14px;font-weight:800;letter-spacing:1px">AMOUNT</th>
              <th style="padding:12px 14px;font-weight:800;letter-spacing:1px;text-align:right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${historyTableRows}
          </tbody>
        </table>
        <div style="height:4px; background:linear-gradient(90deg, var(--brand-primary), var(--brand-accent)); width:100%"></div>
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

    // Phone validation: BD format (01X-XXXXXXXX) — 11 digits starting with 01
    if (phone && !/^01[3-9]\d{8}$/.test(phone.replace(/[\s\-()]/g, ''))) {
      errEl.textContent='Invalid phone number. BD format: 01XXXXXXXXX (11 digits)';
      errEl.classList.remove('hidden'); return;
    }

    // Email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent='Invalid email format (e.g. name@example.com)';
      errEl.classList.remove('hidden'); return;
    }

    // Course & Batch required for new students
    if (!editingId) {
      if (!course) { errEl.textContent='Course is required'; errEl.classList.remove('hidden'); return; }
      if (!batch) { errEl.textContent='Batch is required'; errEl.classList.remove('hidden'); return; }
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
        return sNameMatch || sPhoneMatch;
      });

      if (duplicate) {
        // Warning দেখাও — user চাইলে তবুও save করতে পারবে
        const dupPhone = duplicate.phone || 'N/A';
        const dupId    = duplicate.student_id || '';
        errEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:flex-start; gap:8px;">
              <i class="fa fa-triangle-exclamation" style="color:#f7a800; font-size:1.1rem; margin-top:2px; flex-shrink:0;"></i>
              <div>
                <strong style="color:#f7a800;">Possible Duplicate Entry!</strong><br/>
                <span style="font-size:0.88rem;">Similar student found: <strong>${duplicate.name}</strong> (ID: ${dupId}, Phone: ${dupPhone})</span>
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

    const record = {
      student_id:    Utils.formVal('sf-sid'),
      name:          name,
      phone:         phone,
      email:         Utils.formVal('sf-email'),
      father_name:   Utils.formVal('sf-father'),
      course:        Utils.formVal('sf-course'),
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

    if (editingId) {
      SupabaseSync.update(DB.students, editingId, record);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'students', 
          `Updated student: ${name} (ID: ${record.student_id})`
        );
      }
      Utils.toast('Student info updated ✓', 'success');
    } else {
      // insert করো এবং UUID সহ returned record রাখো
      const inserted = SupabaseSync.insert(DB.students, record);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'students', 
          `Added student: ${name} (ID: ${record.student_id}) - Batch: ${record.batch}`
        );
      }
      const studentUUID = inserted.id; // UUID — finance ref_id-এ ব্যবহার হবে

      // Initial payment থাকলে finance-এ log করো (ref_id = UUID)
      if (paid > 0) {
        const method = Utils.formVal('sf-method');
        if (method) {
          SupabaseSync.insert(DB.finance, {
            type:        'Income',
            category:    'Student Fee',
            description: `${name} (${record.student_id}) — Initial Admission Payment`,
            amount:      paid,
            method:      method,
            date:        record.admission_date,
            note:        record.note,
            ref_id:      studentUUID, // ✅ UUID — restore logic কাজ করবে
          });
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
    const amount = Utils.safeNum(Utils.formVal('pay-amount'));
    const errEl  = document.getElementById('pay-error');

    if (!amount || amount <= 0) {
      errEl.textContent = 'Payment amount required';
      errEl.classList.remove('hidden'); return;
    }
    if (amount > Utils.safeNum(s.due)) {
      errEl.textContent = 'Amount cannot exceed due';
      errEl.classList.remove('hidden'); return;
    }

    const method = Utils.formVal('pay-method');
    if (!method) {
      errEl.textContent = 'Please select a Payment Method';
      errEl.classList.remove('hidden'); return;
    }

    const newPaid = Utils.safeNum(s.paid) + amount;
    const newDue  = Math.max(0, Utils.safeNum(s.total_fee) - newPaid);

    /* Student Update */
    SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue });

    /* Finance ledger entry */
    SupabaseSync.insert(DB.finance, {
      type:        'Income',
      category:    'Student Fee',
      description: `${s.name} (${s.student_id}) — Course Fee`,
      amount:      amount,
      method:      method,
      date:        Utils.formVal('pay-date') || Utils.today(),
      note:        Utils.formVal('pay-note'),
      ref_id:      studentId,
    });

    // Account balance-এ যোগ করো (Income → 'in')
    if (typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(method, amount, 'in');
    }

    Utils.toast('Payment added ✓', 'success');
    // ✅ লজিক ৫: Student payment specific log
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('payment', 'students',
        `Payment received: ${s.name} (${s.student_id}) — ৳${Utils.formatMoneyPlain(amount)} via ${method}`);
    }
    Utils.closeModal();
    render();
    App.updateNotifCount();
  }

  async function deletePayment(paymentId, studentId) {
    const payment = SupabaseSync.getById(DB.finance, paymentId);
    if (!payment) return;

    const ok = await Utils.confirm(`Delete payment of ${Utils.takaEn(payment.amount)}?`, 'Delete Payment');
    if (!ok) return;

    const student = SupabaseSync.getById(DB.students, studentId);
    if (student) {
      // ✅ FIX: Recalculate from finance ledger (source of truth).
      // Subtracting from student.paid can drift if data was manually edited
      // or synced incorrectly. This approach is always accurate regardless
      // of which installment (#1, #3, #5...) is deleted.
      const allFin = SupabaseSync.getAll(DB.finance);
      const newPaid = allFin
        .filter(f => f.ref_id === studentId &&
                     f.category === 'Student Fee' &&
                     f.id !== paymentId)
        .reduce((sum, f) => sum + Utils.safeNum(f.amount), 0);
      const newDue = Math.max(0, Utils.safeNum(student.total_fee) - newPaid);
      SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue });
    }

    // Account balance reverse করো (Income ছিল → 'out' করো)
    if (payment.method && typeof SupabaseSync.updateAccountBalance === 'function') {
      SupabaseSync.updateAccountBalance(payment.method, Utils.safeNum(payment.amount), 'out');
    }

    SupabaseSync.remove(DB.finance, paymentId);
    Utils.toast('Payment deleted ✓', 'info');
    Students.openPayModal(studentId);
  }

  /* ══════════════════════════════════════════
     PRINT RECEIPT (Single Payment / Full Summary)
  ══════════════════════════════════════════ */
  function printReceipt(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const academyName  = cfg.academy_name  || 'Wings Fly Aviation Academy';
    const academyPhone = cfg.academy_phone || '';
    const academyEmail = cfg.academy_email || '';
    const academyAddr  = cfg.academy_address|| '';
    const logoUrl      = cfg.logo_url       || '';

    const allFinance = SupabaseSync.getAll(DB.finance);
    const payments   = allFinance
      .filter(f => f.ref_id === id && f.category === 'Student Fee')
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // ✅ লজিক ৪: Latest first

    const totalFee  = Utils.safeNum(s.total_fee);
    const totalPaid = Utils.safeNum(s.paid);
    const totalDue  = Utils.safeNum(s.due);
    const paidPct   = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;

    const receiptNo = `RCP-${s.student_id}-${Date.now().toString().slice(-5)}`;
    const printDate = Utils.formatDateDMY(Utils.today());

    let runningBalance = 0;
    const paymentRows = payments.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:12px;color:#888;">No payment records found</td></tr>`
      : payments.map((f, i) => {
          runningBalance += Utils.safeNum(f.amount);
          const remaining = totalFee - runningBalance;
          return `
          <tr style="border-bottom:1px solid #e8e8e8; ${i % 2 === 0 ? 'background:#fafafa;' : ''}">
            <td style="padding:8px 10px;text-align:center;font-weight:600;color:#555;">${i + 1}</td>
            <td style="padding:8px 10px;">${Utils.formatDateDMY(f.date)}</td>
            <td style="padding:8px 10px;text-align:center;">
              <span style="background:#e8f4f8;color:#0077aa;padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">${f.method || 'Cash'}</span>
            </td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:#1a7a1a;">৳${Utils.safeNum(f.amount).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;text-align:right;color:${remaining > 0 ? '#cc3300' : '#1a7a1a'};font-weight:600;">
              ৳${remaining.toLocaleString('en-IN')}
            </td>
          </tr>`;
        }).join('');

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:64px;max-width:160px;object-fit:contain;" alt="Logo" />`
      : `<div style="width:64px;height:64px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">✈</div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payment Receipt — ${s.name}</title>
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
        <span class="info-value">${s.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Student ID</span>
        <span class="info-value">${s.student_id || '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Course</span>
        <span class="info-value">${s.course || '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Batch / Session</span>
        <span class="info-value">${[s.batch, s.session].filter(Boolean).join(' / ') || '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone</span>
        <span class="info-value">${s.phone || '—'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Admission Date</span>
        <span class="info-value">${Utils.formatDateDMY(s.admission_date)}</span>
      </div>
      ${s.father_name ? `<div class="info-item"><span class="info-label">Father's Name</span><span class="info-value">${s.father_name}</span></div>` : ''}
      ${s.address ? `<div class="info-item"><span class="info-label">Address</span><span class="info-value">${s.address}</span></div>` : ''}
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
      <span>${paidPct}% Completed (${payments.length} installment${payments.length !== 1 ? 's' : ''})</span>
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
      ${s.note ? `<br/><em>Remark: ${s.note}</em>` : ''}
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

    const win = window.open('', '_blank', 'width=860,height=900');
    if (!win) { Utils.toast('Popup blocked! Please allow popups.', 'error'); return; }
    win.document.write(html);
    win.document.close();
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
    const ok = await Utils.confirm(`Delete student "${s?.name}" and all related payment records?`, 'Delete Student');
    if (!ok) return;

    // এই student-এর সব finance payment খুঁজে account balance reverse করো
    const allFinance = SupabaseSync.getAll(DB.finance);
    const studentPayments = allFinance.filter(f => f.ref_id === id && f.category === 'Student Fee');
    studentPayments.forEach(f => {
      if (f.method && typeof SupabaseSync.updateAccountBalance === 'function') {
        SupabaseSync.updateAccountBalance(f.method, Utils.safeNum(f.amount), 'out');
      }
      SupabaseSync.remove(DB.finance, f.id);
    });

    // ✅ FIX: Get student data BEFORE deletion to log correctly
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('delete', 'students', 
        `Deleted student: ${s?.name || 'Unknown'} (ID: ${s?.student_id || 'N/A'})`
      );
    }
    SupabaseSync.remove(DB.students, id);
    Utils.toast(`Student deleted — ${studentPayments.length} payment(s) also moved to RecycleBin`, 'info');
    render();
    App.updateNotifCount();
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
    Utils.openModal('<i class="fa fa-bell"></i> Set Reminder', `
      <div class="form-group">
        <label>Student</label>
        <input class="form-control" value="${name}" disabled />
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
        <button class="btn-primary" onclick="Students._saveReminder('${id}','${name.replace(/'/g,"\\'")}')">
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
        created_by: localStorage.getItem('wfa_user_name') || 'admin',
      });
    }
    Utils.closeModal();
    Utils.toast(`Reminder saved for ${name} — Notice Board-এ যোগ হয়েছে ✓`, 'success');
    // Refresh notice-board indicator if it's mounted
    try { if (typeof NoticeBoardModule !== 'undefined') NoticeBoardModule.render(); } catch { /* ignore */ }
  }

  return {
    render, onSearch, onFilter, resetFilters,
    changePage, changePageSize,
    openAddModal, openEditModal, openPayModal, openManageAction,
    calcDue, saveStudent, savePayment,
    deleteStudent, exportExcel,
    printHistory,
    printReceipt,
    deletePayment,
    setReminder, _saveReminder,
    _forceSave, _resetDupWarning
  };

})();
window.Students = Students;
