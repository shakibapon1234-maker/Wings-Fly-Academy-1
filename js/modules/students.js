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
        ${sCard('fa-users','blue','মোট শিক্ষার্থী', filtered.length)}
        ${sCard('fa-money-bill-wave','amber','মোট ফি', Utils.takaEn(totalFee))}
        ${sCard('fa-circle-check','green','পরিশোধিত', Utils.takaEn(totalPaid))}
        ${sCard('fa-circle-xmark','red','বাকি', Utils.takaEn(totalDue))}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <i class="fa fa-search"></i>
          <input id="stu-search" class="form-control" placeholder="নাম / ID / ফোন খুঁজুন…" value="${searchQuery}" oninput="Students.onSearch(this.value)" />
        </div>
        <select class="form-control" onchange="Students.onFilter('batch',this.value)">
          <option value="">সব ব্যাচ</option>
          ${batches.map(b=>`<option value="${b}" ${filterBatch===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Students.onFilter('course',this.value)">
          <option value="">সব কোর্স</option>
          ${courses.map(c=>`<option value="${c}" ${filterCourse===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="form-control" onchange="Students.onFilter('status',this.value)">
          <option value="">সব স্ট্যাটাস</option>
          <option value="Active"   ${filterStatus==='Active'  ?'selected':''}>সক্রিয়</option>
          <option value="Inactive" ${filterStatus==='Inactive'?'selected':''}>নিষ্ক্রিয়</option>
        </select>
        <button class="btn-secondary btn-sm" onclick="Students.resetFilters()"><i class="fa fa-rotate-left"></i> রিসেট</button>
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
                <th>শিক্ষার্থী ID</th>
                <th>নাম</th>
                <th>ফোন</th>
                <th>কোর্স</th>
                <th>ব্যাচ</th>
                <th>সেশন</th>
                <th>মোট ফি</th>
                <th>পরিশোধ</th>
                <th>বাকি</th>
                <th>স্ট্যাটাস</th>
                <th class="no-print">কাজ</th>
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
    if (!rows.length) return Utils.noDataRow(12, 'কোনো শিক্ষার্থী পাওয়া যায়নি');
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
            <button class="btn-outline btn-xs" onclick="Students.openPayModal('${s.id}')" title="পেমেন্ট">
              <i class="fa fa-money-bill"></i>
            </button>
            <button class="btn-outline btn-xs" onclick="Students.openEditModal('${s.id}')" title="সম্পাদনা">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn-danger btn-xs" onclick="Students.deleteStudent('${s.id}')" title="মুছুন">
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

    Utils.openModal('<i class="fa fa-user-graduate"></i> নতুন শিক্ষার্থী', `
      <div class="form-row">
        <div class="form-group">
          <label>শিক্ষার্থী ID <span class="req">*</span></label>
          <input id="sf-sid" class="form-control" value="${newId}" />
        </div>
        <div class="form-group">
          <label>ভর্তির তারিখ</label>
          <input id="sf-date" type="date" class="form-control" value="${today}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পূর্ণ নাম <span class="req">*</span></label>
          <input id="sf-name" class="form-control" placeholder="শিক্ষার্থীর নাম" />
        </div>
        <div class="form-group">
          <label>ফোন নম্বর <span class="req">*</span></label>
          <input id="sf-phone" class="form-control" placeholder="01XXXXXXXXX" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ইমেইল</label>
          <input id="sf-email" type="email" class="form-control" placeholder="email@example.com" />
        </div>
        <div class="form-group">
          <label>পিতার নাম</label>
          <input id="sf-father" class="form-control" placeholder="পিতার নাম" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>কোর্স <span class="req">*</span></label>
          <input id="sf-course" class="form-control" list="course-list" placeholder="কোর্সের নাম" />
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
          <label>ব্যাচ <span class="req">*</span></label>
          <input id="sf-batch" class="form-control" placeholder="যেমন: Batch-12" />
        </div>
        <div class="form-group">
          <label>সেশন</label>
          <input id="sf-session" class="form-control" placeholder="যেমন: 2024-25" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>মোট ফি (৳) <span class="req">*</span></label>
          <input id="sf-total-fee" type="number" class="form-control" placeholder="0" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>পরিশোধিত (৳)</label>
          <input id="sf-paid" type="number" class="form-control" placeholder="0" value="0" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>বাকি (৳)</label>
          <input id="sf-due" type="number" class="form-control" placeholder="0" readonly style="background:var(--bg-surface)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ঠিকানা</label>
          <input id="sf-address" class="form-control" placeholder="বর্তমান ঠিকানা" />
        </div>
        <div class="form-group">
          <label>স্ট্যাটাস</label>
          <select id="sf-status" class="form-control">
            <option value="Active">সক্রিয়</option>
            <option value="Inactive">নিষ্ক্রিয়</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>নোট</label>
        <textarea id="sf-note" class="form-control" rows="2" placeholder="যেকোনো বিশেষ তথ্য…"></textarea>
      </div>
      <div id="sf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn-primary" onclick="Students.saveStudent()"><i class="fa fa-floppy-disk"></i> সংরক্ষণ</button>
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

    Utils.openModal('<i class="fa fa-pen"></i> শিক্ষার্থী সম্পাদনা', `
      <div class="form-row">
        <div class="form-group">
          <label>শিক্ষার্থী ID</label>
          <input id="sf-sid" class="form-control" value="${s.student_id||''}" readonly style="background:var(--bg-surface)" />
        </div>
        <div class="form-group">
          <label>ভর্তির তারিখ</label>
          <input id="sf-date" type="date" class="form-control" value="${(s.admission_date||'').split('T')[0]}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পূর্ণ নাম <span class="req">*</span></label>
          <input id="sf-name" class="form-control" value="${s.name||''}" />
        </div>
        <div class="form-group">
          <label>ফোন নম্বর</label>
          <input id="sf-phone" class="form-control" value="${s.phone||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ইমেইল</label>
          <input id="sf-email" type="email" class="form-control" value="${s.email||''}" />
        </div>
        <div class="form-group">
          <label>পিতার নাম</label>
          <input id="sf-father" class="form-control" value="${s.father_name||''}" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>কোর্স</label>
          <input id="sf-course" class="form-control" value="${s.course||''}" />
        </div>
        <div class="form-group">
          <label>ব্যাচ</label>
          <input id="sf-batch" class="form-control" value="${s.batch||''}" />
        </div>
        <div class="form-group">
          <label>সেশন</label>
          <input id="sf-session" class="form-control" value="${s.session||''}" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>মোট ফি (৳)</label>
          <input id="sf-total-fee" type="number" class="form-control" value="${s.total_fee||0}" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>পরিশোধিত (৳)</label>
          <input id="sf-paid" type="number" class="form-control" value="${s.paid||0}" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>বাকি (৳)</label>
          <input id="sf-due" type="number" class="form-control" value="${s.due||0}" readonly style="background:var(--bg-surface)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ঠিকানা</label>
          <input id="sf-address" class="form-control" value="${s.address||''}" />
        </div>
        <div class="form-group">
          <label>স্ট্যাটাস</label>
          <select id="sf-status" class="form-control">
            <option value="Active"   ${(s.status||'Active')==='Active'  ?'selected':''}>সক্রিয়</option>
            <option value="Inactive" ${s.status==='Inactive'?'selected':''}>নিষ্ক্রিয়</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>নোট</label>
        <textarea id="sf-note" class="form-control" rows="2">${s.note||''}</textarea>
      </div>
      <div id="sf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn-primary" onclick="Students.saveStudent()"><i class="fa fa-floppy-disk"></i> আপডেট</button>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     PAYMENT MODAL
  ══════════════════════════════════════════ */
  function openPayModal(id) {
    const s = SupabaseSync.getById(DB.students, id);
    if (!s) return;

    Utils.openModal('<i class="fa fa-money-bill"></i> পেমেন্ট যোগ করুন', `
      <div style="background:var(--bg-input);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${s.name}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary)">${s.course||''} · ${s.batch||''}</div>
        <div style="display:flex;gap:20px;margin-top:8px;font-size:0.88rem">
          <span>মোট: <strong>${Utils.takaEn(s.total_fee)}</strong></span>
          <span style="color:var(--success-light)">পরিশোধ: <strong>${Utils.takaEn(s.paid)}</strong></span>
          <span style="color:var(--danger-light)">বাকি: <strong>${Utils.takaEn(s.due)}</strong></span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পেমেন্ট পরিমাণ (৳) <span class="req">*</span></label>
          <input id="pay-amount" type="number" class="form-control" placeholder="0" max="${s.due}" />
        </div>
        <div class="form-group">
          <label>পেমেন্ট পদ্ধতি</label>
          <select id="pay-method" class="form-control">
            <option value="Cash">নগদ</option>
            <option value="Bank">ব্যাংক</option>
            <option value="Mobile Banking">মোবাইল ব্যাংকিং</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>তারিখ</label>
          <input id="pay-date" type="date" class="form-control" value="${Utils.today()}" />
        </div>
        <div class="form-group">
          <label>নোট</label>
          <input id="pay-note" class="form-control" placeholder="ঐচ্ছিক" />
        </div>
      </div>
      <div id="pay-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn-success" onclick="Students.savePayment('${id}')"><i class="fa fa-check"></i> পেমেন্ট যোগ</button>
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

    if (!name) { errEl.textContent='নাম আবশ্যক'; errEl.classList.remove('hidden'); return; }
    if (!sid && !editingId)  { errEl.textContent='শিক্ষার্থী ID আবশ্যক'; errEl.classList.remove('hidden'); return; }

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
      Utils.toast('শিক্ষার্থীর তথ্য আপডেট হয়েছে ✓', 'success');
    } else {
      SupabaseSync.insert(DB.students, record);
      Utils.toast('নতুন শিক্ষার্থী যোগ হয়েছে ✓', 'success');
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
      errEl.textContent = 'পেমেন্ট পরিমাণ আবশ্যক';
      errEl.classList.remove('hidden'); return;
    }
    if (amount > Utils.safeNum(s.due)) {
      errEl.textContent = 'পরিমাণ বাকির চেয়ে বেশি হতে পারবে না';
      errEl.classList.remove('hidden'); return;
    }

    const newPaid = Utils.safeNum(s.paid) + amount;
    const newDue  = Math.max(0, Utils.safeNum(s.total_fee) - newPaid);

    /* Student আপডেট */
    SupabaseSync.update(DB.students, studentId, { paid: newPaid, due: newDue });

    /* Finance ledger-এ entry */
    SupabaseSync.insert(DB.finance, {
      type:        'Income',
      category:    'Student Fee',
      description: `${s.name} (${s.student_id}) — কোর্স ফি`,
      amount:      amount,
      method:      Utils.formVal('pay-method') || 'Cash',
      date:        Utils.formVal('pay-date') || Utils.today(),
      note:        Utils.formVal('pay-note'),
      ref_id:      studentId,
    });

    Utils.toast('পেমেন্ট যোগ হয়েছে ✓', 'success');
    Utils.closeModal();
    render();
    App.updateNotifCount();
  }

  /* ══════════════════════════════════════════
     DELETE
  ══════════════════════════════════════════ */
  async function deleteStudent(id) {
    const s  = SupabaseSync.getById(DB.students, id);
    const ok = await Utils.confirm(`"${s?.name}" কে মুছে ফেলবেন?`, 'শিক্ষার্থী মুছুন');
    if (!ok) return;
    SupabaseSync.remove(DB.students, id);
    Utils.toast('শিক্ষার্থী মুছে ফেলা হয়েছে', 'info');
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
      'শিক্ষার্থী ID': s.student_id||'',
      'নাম':           s.name||'',
      'ফোন':           s.phone||'',
      'ইমেইল':         s.email||'',
      'কোর্স':          s.course||'',
      'ব্যাচ':          s.batch||'',
      'সেশন':          s.session||'',
      'মোট ফি':        s.total_fee||0,
      'পরিশোধিত':      s.paid||0,
      'বাকি':           s.due||0,
      'স্ট্যাটাস':      s.status||'Active',
      'ভর্তির তারিখ':  s.admission_date||'',
    }));
    Utils.exportExcel(rows, 'students', 'শিক্ষার্থী');
  }

  return {
    render, onSearch, onFilter, resetFilters,
    openAddModal, openEditModal, openPayModal,
    calcDue, saveStudent, savePayment,
    deleteStudent, exportExcel,
  };

})();
