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

  /* ══════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════ */
  function render() {
    const container = document.getElementById('students-content');
    if (!container) return;

    const all      = SupabaseSync.getAll(DB.students);
    const batches  = [...new Set(all.map(s => s.batch).filter(Boolean))].sort();
    const courses  = [...new Set(all.map(s => s.course).filter(Boolean))].sort();
    const filtered = applyFilters(all);

    /* Summary row */
    const totalFee  = filtered.reduce((s,r) => s + Utils.safeNum(r.total_fee), 0);
    const totalPaid = filtered.reduce((s,r) => s + Utils.safeNum(r.paid), 0);
    const totalDue  = filtered.reduce((s,r) => s + Utils.safeNum(r.due), 0);

    container.innerHTML = `
      <!-- Summary Cards -->
      <div class="dashboard-grid" style="margin-bottom:16px">
        ${sCard('fa-users','blue','Total Student', filtered.length)}
        ${sCard('fa-money-bill-wave','amber','Total Fee', Utils.takaEn(totalFee))}
        ${sCard('fa-circle-check','green','Paid', Utils.takaEn(totalPaid))}
        ${sCard('fa-circle-xmark','red','Due', Utils.takaEn(totalDue))}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="stu-search" class="form-control" placeholder="Name / ID / Phone Search…" value="${searchQuery}" oninput="Students.onSearch(this.value)" />
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
              ${renderRows(filtered)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderRows(rows) {
    if (!rows.length) return Utils.noDataRow(12, 'No Student not found');
    return rows.map((s, i) => `
      <tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${i+1}</td>
        <td><span class="badge badge-primary">${s.student_id||'—'}</span></td>
        <td>
          <div style="font-weight:600">${s.name}</div>
          ${s.email ? `<div style="font-size:0.75rem;color:var(--text-muted)">${s.email}</div>` : ''}
        </td>
        <td>${s.phone||'—'}</td>
        <td>${s.course||'—'}</td>
        <td>${s.batch||'—'}</td>
        <td>${s.session||'—'}</td>
        <td style="font-family:var(--font-en)">${Utils.takaEn(s.total_fee)}</td>
        <td class="ledger-income">${Utils.takaEn(s.paid)}</td>
        <td class="${Utils.safeNum(s.due)>0?'ledger-expense':''}">${Utils.takaEn(s.due)}</td>
        <td>${Utils.statusBadge(s.status||'Active')}</td>
        <td class="no-print">
          <div class="table-actions">
            <button class="btn-outline btn-xs" onclick="Students.openPayModal('${s.id}')" title="Payment">
              <i class="fa fa-money-bill"></i>
            </button>
            <button class="btn-outline btn-xs" onclick="Students.openEditModal('${s.id}')" title="Edit">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn-danger btn-xs" onclick="Students.deleteStudent('${s.id}')" title="Delete">
              <i class="fa fa-trash"></i>
            </button>
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
    if (searchQuery)  r = Utils.searchFilter(r, searchQuery, ['name','student_id','phone','email']);
    if (filterBatch)  r = r.filter(s => s.batch  === filterBatch);
    if (filterCourse) r = r.filter(s => s.course === filterCourse);
    if (filterStatus) r = r.filter(s => (s.status||'Active') === filterStatus);
    return r;
  }

  const debouncedRender = Utils.debounce(() => render(), 250);

  function onSearch(val) {
    searchQuery = val;
    debouncedRender();
  }

  function onFilter(type, val) {
    if (type === 'batch')  filterBatch  = val;
    if (type === 'course') filterCourse = val;
    if (type === 'status') filterStatus = val;
    render();
  }

  function resetFilters() {
    searchQuery = filterBatch = filterCourse = filterStatus = '';
    render();
  }

  /* ══════════════════════════════════════════
     ADD MODAL
  ══════════════════════════════════════════ */
  function openAddModal() {
    editingId = null;
    const all = SupabaseSync.getAll(DB.students);
    const newId = Utils.generateStudentId(all.map(s => s.student_id));
    const today = Utils.today();

    Utils.openModal('<i class="fa fa-user-graduate"></i> Add Student', `
      <div class="form-row">
        <div class="form-group">
          <label>Student ID <span class="req">*</span></label>
          <input id="sf-sid" class="form-control" value="${newId}" />
        </div>
        <div class="form-group">
          <label>Admission Date</label>
          <input id="sf-date" type="date" class="form-control" value="${today}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="sf-name" class="form-control" placeholder="Student Name" />
        </div>
        <div class="form-group">
          <label>Phone Number <span class="req">*</span></label>
          <input id="sf-phone" class="form-control" placeholder="01XXXXXXXXX" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input id="sf-email" type="email" class="form-control" placeholder="email@example.com" />
        </div>
        <div class="form-group">
          <label>Father Name</label>
          <input id="sf-father" class="form-control" placeholder="Father Name" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Course <span class="req">*</span></label>
          <input id="sf-course" class="form-control" list="course-list" placeholder="Course Name" />
          <datalist id="course-list">
            <option value="PPL (Private Pilot License)">
            <option value="CPL (Commercial Pilot License)">
            <option value="ATPL (Airline Transport Pilot)">
            <option value="Aviation English">
            <option value="Air Traffic Control">
            <option value="Aircraft Maintenance">
          </datalist>
        </div>
        <div class="form-group">
          <label>Batch <span class="req">*</span></label>
          <input id="sf-batch" class="form-control" placeholder="e.g.: Batch-12" />
        </div>
        <div class="form-group">
          <label>Session</label>
          <input id="sf-session" class="form-control" placeholder="e.g.: 2024-25" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Total Fee (৳) <span class="req">*</span></label>
          <input id="sf-total-fee" type="number" class="form-control" placeholder="0" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>Paid (৳)</label>
          <input id="sf-paid" type="number" class="form-control" placeholder="0" value="0" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>Due (৳)</label>
          <input id="sf-due" type="number" class="form-control" placeholder="0" readonly style="background:var(--bg-surface)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Address</label>
          <input id="sf-address" class="form-control" placeholder="Present Address" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="sf-status" class="form-control">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="sf-note" class="form-control" rows="2" placeholder="Any special remarks…"></textarea>
      </div>
      <div id="sf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Students.saveStudent()"><i class="fa fa-floppy-disk"></i> Save</button>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     EDIT MODAL
  ══════════════════════════════════════════ */
  function openEditModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;
    editingId = id;

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
          <input id="sf-name" class="form-control" value="${s.name||''}" />
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input id="sf-phone" class="form-control" value="${s.phone||''}" />
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
          <input id="sf-course" class="form-control" value="${s.course||''}" />
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
      <div class="form-row">
        <div class="form-group">
          <label>Address</label>
          <input id="sf-address" class="form-control" value="${s.address||''}" />
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
     PAYMENT MODAL
  ══════════════════════════════════════════ */
  function openPayModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;

    Utils.openModal('<i class="fa fa-money-bill"></i> Add Payment', `
      <div style="background:var(--bg-input);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${s.name}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary)">${s.course||''} · ${s.batch||''}</div>
        <div style="display:flex;gap:20px;margin-top:8px;font-size:0.88rem">
          <span>Total: <strong>${Utils.takaEn(s.total_fee)}</strong></span>
          <span style="color:var(--success-light)">Pay: <strong>${Utils.takaEn(s.paid)}</strong></span>
          <span style="color:var(--danger-light)">Due: <strong>${Utils.takaEn(s.due)}</strong></span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Payment Amount (৳) <span class="req">*</span></label>
          <input id="pay-amount" type="number" class="form-control" placeholder="0" max="${s.due}" />
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <select id="pay-method" class="form-control">
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Transfer</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input id="pay-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input id="pay-note" class="form-control" placeholder="Optional" />
        </div>
      </div>
      <div id="pay-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-success" onclick="Students.savePayment('${id}')"><i class="fa fa-check"></i> Add Payment</button>
      </div>
    `, 'modal-sm');
  }

  /* ══════════════════════════════════════════
     SAVE / UPDATE STUDENT
  ══════════════════════════════════════════ */
  function calcDue() {
    const total = Utils.safeNum(Utils.formVal('sf-total-fee'));
    const paid  = Utils.safeNum(Utils.formVal('sf-paid'));
    Utils.formSet('sf-due', Math.max(0, total - paid));
  }

  function saveStudent() {
    const name = Utils.formVal('sf-name');
    const sid  = Utils.formVal('sf-sid');
    const errEl = document.getElementById('sf-error');

    if (!name) { errEl.textContent='Name is required'; errEl.classList.remove('hidden'); return; }
    if (!sid && !editingId)  { errEl.textContent='Student ID Required'; errEl.classList.remove('hidden'); return; }

    const total = Utils.safeNum(Utils.formVal('sf-total-fee'));
    const paid  = Utils.safeNum(Utils.formVal('sf-paid'));
    const due   = Math.max(0, total - paid);

    const record = {
      student_id:    Utils.formVal('sf-sid'),
      name:          name,
      phone:         Utils.formVal('sf-phone'),
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
      Utils.toast('Student info updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.students, record);
      Utils.toast('New student added ✓', 'success');
    }

    Utils.closeModal();
    render();
    App.updateNotifCount();
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
      method:      Utils.formVal('pay-method') || 'Cash',
      date:        Utils.formVal('pay-date') || Utils.today(),
      note:        Utils.formVal('pay-note'),
      ref_id:      studentId,
    });

    Utils.toast('Payment added ✓', 'success');
    Utils.closeModal();
    render();
    App.updateNotifCount();
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteStudent(id) {
    const s  = SupabaseSync.getById(DB.students, id);
    const ok = await Utils.confirm(`"${s?.name}" to delete?`, 'Delete Student');
    if (!ok) return;
    SupabaseSync.remove(DB.students, id);
    Utils.toast('Student deleted', 'info');
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
      'Phone':           s.phone||'',
      'Email':         s.email||'',
      'Course':          s.course||'',
      'Batch':          s.batch||'',
      'Session':          s.session||'',
      'Total Fee':        s.total_fee||0,
      'Paid':      s.paid||0,
      'Due':           s.due||0,
      'Status':      s.status||'Active',
      'Admission Date':  s.admission_date||'',
    }));
    Utils.exportExcel(rows, 'students', 'Student');
  }

  return {
    render, onSearch, onFilter, resetFilters,
    openAddModal, openEditModal, openPayModal,
    calcDue, saveStudent, savePayment,
    deleteStudent, exportExcel,
  };

})();
