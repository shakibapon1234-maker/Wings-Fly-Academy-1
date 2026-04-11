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
          <button class="btn-primary btn-xs" onclick="Students.openManageAction('${s.id}')" style="background:var(--brand-primary);color:var(--bg-base);font-weight:700;border-radius:20px;padding:4px 14px">
            <i class="fa fa-sliders"></i> MANAGE
          </button>
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
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Total Fee (৳) <span class="req">*</span></label>
          <input id="sf-total-fee" type="number" class="form-control" placeholder="0" oninput="Students.calcDue()" />
        </div>
        <div class="form-group">
          <label>Paid (৳)</label>
          <input id="sf-paid" type="number" class="form-control" placeholder="0" value="0" oninput="Students.calcDue()" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Due (৳)</label>
          <input id="sf-due" type="number" class="form-control" placeholder="0" readonly style="background:var(--bg-surface)" />
        </div>
        <div class="form-group" style="grid-column: span 2">
          <label>Payment Method <span class="req">*</span></label>
          <select id="sf-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'sf-bal-display')">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML()}
          </select>
          <div id="sf-bal-display" style="display:none;"></div>
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
        <i class="fa fa-sack-dollar"></i> ADD PAYMENT
      </button>
      
      <button class="action-btn-glow btn-cyan" onclick="Utils.closeModal(); setTimeout(()=>IdCards && IdCards.previewCard('${id}'), 300)">
        <i class="fa fa-id-badge"></i> VIEW ID CARD
      </button>
      
      <button class="action-btn-glow btn-orange" onclick="Utils.closeModal(); setTimeout(()=>Certificates && Certificates.previewCertificate('${id}'), 300)">
        <i class="fa fa-award"></i> GENERATE CERTIFICATE
      </button>
      
      <button class="action-btn-glow btn-green" onclick="Utils.closeModal(); setTimeout(()=>Students.openEditModal('${id}'), 300)">
        <i class="fa fa-user-pen"></i> EDIT PROFILE
      </button>
      
      <button class="action-btn-glow btn-purple" onclick="Students.printReceipt('${id}')">
        <i class="fa fa-print"></i> PRINT RECEIPT
      </button>
      
      <button class="action-btn-glow btn-grey" onclick="Utils.toast('Reminder set for ${s.name}', 'success')">
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
       .sort((a,b) => new Date(a.date) - new Date(b.date)); // Chronological

    let historyTableRows = '';
    if (history.length === 0) {
      historyTableRows = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:12px;">No payment history found</td></tr>';
    } else {
      historyTableRows = history.map((f, index) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05)">
          <td style="padding:10px 8px">${index + 1}</td>
          <td style="padding:10px 8px">${f.date}</td>
          <td style="padding:10px 8px"><span class="badge badge-info">${f.method||'Cash'}</span></td>
          <td style="padding:10px 8px;font-weight:700;color:var(--success)">${Utils.takaEn(f.amount)}</td>
        </tr>
      `).join('');
    }

    Utils.openModal('<i class="fa fa-credit-card"></i> Payment History & Installments', `
      <!-- Top Cards -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:1px; margin-bottom:8px;">TOTAL FEE</div>
          <div style="font-size:1.4rem; font-weight:800; color:#00d9ff">${Utils.takaEn(s.total_fee)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:1px; margin-bottom:8px;">PAID TO DATE</div>
          <div style="font-size:1.4rem; font-weight:800; color:#00ff88">${Utils.takaEn(s.paid)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:1px; margin-bottom:8px;">OUTSTANDING DUE</div>
          <div style="font-size:1.4rem; font-weight:800; color:#ff4757">${Utils.takaEn(s.due)}</div>
        </div>
      </div>

      <!-- Add Installment Section -->
      <div style="border: 1.5px solid var(--border-glow); border-radius: 8px; padding: 16px; margin-bottom: 24px; position: relative;">
        <div style="font-weight:700; color:var(--brand-primary); margin-bottom:12px;">Add New Installment</div>
        <div style="display:flex; gap:12px; align-items:center;">
          <input id="pay-amount" type="number" class="form-control" style="flex:1" placeholder="Amount (e.g. ${s.due})" max="${s.due}" onkeypress="if(event.key==='Enter') Students.savePayment('${id}')" />
          <select id="pay-method" class="form-control" style="flex:1" onchange="Utils.onPaymentMethodChange(this, 'pay-bal-display')">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML()}
          </select>
          <input id="pay-date" type="date" class="form-control hidden" value="${Utils.today()}" />
          <button class="btn-primary" style="background: linear-gradient(90deg, #00d9ff, #b537f2); border:none; border-radius:6px; font-weight:700;" onclick="Students.savePayment('${id}')">
            + ADD & PRINT RECEIPT
          </button>
        </div>
        <div id="pay-bal-display" style="display:none; margin-top:8px;"></div>
        <div id="pay-error" class="form-error hidden" style="margin-top:8px"></div>
      </div>

      <!-- History Table Section -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 8px;">
        <div style="font-weight:700; color:var(--brand-primary);">Payment History (All Installments)</div>
        <button class="btn-outline btn-xs" style="color:#ff6b35; border-color:#ff6b35" onclick="Students.printHistory('${id}')"><i class="fa fa-print"></i> PRINT HISTORY</button>
      </div>
      <div style="overflow:hidden; border-radius:8px; border:1px solid rgba(255,255,255,0.1)">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem; text-align:left;">
          <thead style="background:rgba(255,255,255,0.05); border-bottom:2px solid var(--brand-primary);">
            <tr>
              <th style="padding:10px 8px;font-weight:800;letter-spacing:1px">#</th>
              <th style="padding:10px 8px;font-weight:800;letter-spacing:1px">DATE</th>
              <th style="padding:10px 8px;font-weight:800;letter-spacing:1px">METHOD</th>
              <th style="padding:10px 8px;font-weight:800;letter-spacing:1px">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${historyTableRows}
          </tbody>
        </table>
        <div style="height:4px; background:linear-gradient(90deg, var(--brand-primary), var(--brand-accent)); width:100%"></div>
      </div>
    `);
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
      
      // If there's an initial payment during admission, log it!
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
            ref_id:      record.student_id,
          });
        }
      }
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
    const method = Utils.formVal('pay-method');
    if (!method) {
      errEl.textContent = 'Please select a Payment Method';
      errEl.classList.remove('hidden'); return;
    }

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
    openAddModal, openEditModal, openPayModal, openManageAction,
    calcDue, saveStudent, savePayment,
    deleteStudent, exportExcel,
    printHistory: (id) => Utils.toast('Feature pending', 'info'),
    printReceipt: (id) => Utils.toast('Feature pending', 'info')
  };

})();
