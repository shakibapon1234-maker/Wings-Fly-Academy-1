/* ============================================================
   HR STAFF MODULE — Wings Fly Aviation Academy
   Phase 8 | Employee Add / Edit / Delete / Role Management
   ============================================================ */

const HRStaff = (() => {

  let editingId = null;
  let currentPage = 1;
  let pageSize = 20;

  /* ─── Roles ─── */
  function getRoles() {
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') return ['Admin', 'Instructor', 'Staff'];
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    return cfg.employee_roles ? (Utils.safeJSON(cfg.employee_roles) || ['Admin', 'Instructor', 'Staff']) : ['Admin', 'Instructor', 'Staff'];
  }

  function init() {
    render();
  }

  function getStaff() {
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') return [];
    return Utils.sortBy(SupabaseSync.getAll(DB.staff), 'joiningDate', 'desc');
  }

  /* ─── Generate Staff ID ─── */
  function generateStaffId() {
    const staffList = getStaff();
    const max = staffList.reduce((m, s) => {
      const n = parseInt((s.staffId || '').replace(/\D/g, '')) || 0;
      return Math.max(m, n);
    }, 0);
    return 'STF-' + String(max + 1).padStart(3, '0');
  }

  /* ─── Render Main Content ─── */
  function render() {
    const container = document.getElementById('hr-staff-content');
    if (!container) return;

    const staffList = getStaff();
    const activeCount  = staffList.filter(s => s.status === 'Active').length;
    const inactiveCount = staffList.filter(s => s.status === 'Inactive').length;
    const totalSalary  = staffList.filter(s => s.status === 'Active')
                              .reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);

    container.innerHTML = `
      <!-- Stats -->
      <div class="grid-4" style="margin-bottom:20px;">
        <div class="stat-card glow-cyan">
          <div class="stat-header">TOTAL STAFF</div>
          <div class="stat-value">${staffList.length}</div>
          <div class="stat-icon-wrapper"><i class="fa fa-users"></i></div>
        </div>
        <div class="stat-card glow-green">
          <div class="stat-header">ACTIVE</div>
          <div class="stat-value">${activeCount}</div>
          <div class="stat-icon-wrapper"><i class="fa fa-circle-check"></i></div>
        </div>
        <div class="stat-card glow-red">
          <div class="stat-header">INACTIVE</div>
          <div class="stat-value">${inactiveCount}</div>
          <div class="stat-icon-wrapper"><i class="fa fa-circle-xmark"></i></div>
        </div>
        <div class="stat-card glow-gold">
          <div class="stat-header">MONTHLY SALARY BUDGET</div>
          <div class="stat-value">৳${Utils.formatMoneyPlain(totalSalary)}</div>
          <div class="stat-icon-wrapper"><i class="fa fa-sack-dollar"></i></div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="filter-bar" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <input type="text" id="staff-search" placeholder="🔍 Name / Phone / Search ID..." oninput="HRStaff.applyFilter()" style="padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; min-width:200px;" />
        <select id="staff-role-filter" onchange="HRStaff.applyFilter()" style="padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff;">
          <option value="">All Roles</option>
          ${getRoles().map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <select id="staff-status-filter" onchange="HRStaff.applyFilter()" style="padding:8px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff;">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button class="btn btn-primary" onclick="HRStaff.openAddModal()" style="margin-left:auto;">
          <i class="fa fa-user-plus"></i> Add Staff
        </button>
        <button class="btn-secondary" onclick="HRStaff.exportExcel()">
          <i class="fa fa-file-excel"></i> Excel
        </button>
        <button class="btn-secondary" onclick="HRStaff.printList()">
          <i class="fa fa-print"></i> Print
        </button>
      </div>

      <div class="table-wrapper" id="staff-table-wrapper">
        ${(() => {
          const pageData = Utils.paginate(staffList, currentPage, pageSize);
          return renderTable(pageData.items, (currentPage - 1) * pageSize) + 
                 ((pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'HRStaff') : '');
        })()}
      </div>
    `;
  }

  function applyFilter() {
    const q = (document.getElementById('staff-search')?.value || '').toLowerCase();
    const r = document.getElementById('staff-role-filter')?.value || '';
    const st = document.getElementById('staff-status-filter')?.value || '';
    const all = getStaff();
    const filtered = all.filter(s => {
      const matchQ = (s.name||'').toLowerCase().includes(q) || (s.phone||'').includes(q) || (s.staffId||'').toLowerCase().includes(q);
      const matchR = r ? s.role === r : true;
      const matchSt = st ? s.status === st : true;
      return matchQ && matchR && matchSt;
    });
    currentPage = 1;
    const wrp = document.getElementById('staff-table-wrapper');
    if (wrp) {
      const pageData = Utils.paginate(filtered, currentPage, pageSize);
      wrp.innerHTML = renderTable(pageData.items, (currentPage - 1) * pageSize) + 
                      ((pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'HRStaff') : '');
    }
  }

  function changePage(p) { currentPage = p; applyFilter(); }
  function changePageSize(s) { pageSize = parseInt(s); currentPage = 1; applyFilter(); }

  function renderTable(data, startIndex = 0) {
    if (!data.length) return `
      <div class="empty-state">
        <i class="fa fa-users" style="font-size:3rem;opacity:.3"></i>
        <p>কোনো স্টাফ পাওয়া যায়নি। প্রথমে স্টাফ যোগ করুন।</p>
      </div>`;

    return `
      <table class="data-table" id="staff-print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Staff ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Salary</th>
            <th>Join</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((s, i) => `
            <tr>
              <td style="color:var(--text-muted);font-size:0.8rem">${startIndex + i + 1}</td>
              <td><code>${s.staffId || '—'}</code></td>
              <td><strong>${Utils.esc(s.name)}</strong></td>
              <td><span class="badge badge-blue">${s.role}</span></td>
              <td>${Utils.esc(s.phone || "—")}</td>
              <td>${s.email || '—'}</td>
              <td>৳${Utils.formatMoneyPlain(s.salary || 0)}</td>
              <td>${s.joiningDate ? Utils.formatDate(s.joiningDate) : '—'}</td>
              <td>
                <span class="badge ${s.status === 'Active' ? 'badge-green' : 'badge-red'}">
                  ${s.status === 'Active' ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td class="action-btns">
                <button class="btn-icon btn-edit" onclick="HRStaff.openEditModal('${s.id}')" title="Edit">
                  <i class="fa fa-pen"></i>
                </button>
                <button class="btn-icon btn-toggle" onclick="HRStaff.toggleStatus('${s.id}')" title="Status Change">
                  <i class="fa fa-toggle-${s.status === 'Active' ? 'on' : 'off'}"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="HRStaff.deleteStaff('${s.id}')" title="Delete">
                  <i class="fa fa-trash"></i>
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }



  /* ─── Modal: Add ─── */
  function openAddModal() {
    editingId = null;
    const newId = generateStaffId();
    Utils.openModal('<i class="fa fa-id-badge" style="color:var(--brand-primary)"></i> Add New Employee', formHTML(null, newId));
  }

  /* ─── Modal: Edit ─── */
  function openEditModal(id) {
    editingId = id;
    const s = SupabaseSync.getById(DB.staff, id);
    if (!s) return;
    Utils.openModal('<i class="fa fa-pen" style="color:var(--brand-primary)"></i> Edit Employee', formHTML(s, s.staffId));
  }

  function formHTML(s, staffId) {
    const roles = getRoles();

    // date value → split into DD, MM, YYYY for custom picker
    function parseDateParts(dateStr) {
      if (!dateStr) return { dd: '', mm: '', yyyy: '' };
      const d = new Date(dateStr);
      if (isNaN(d)) return { dd: '', mm: '', yyyy: '' };
      return {
        dd:   String(d.getDate()).padStart(2,'0'),
        mm:   String(d.getMonth()+1).padStart(2,'0'),
        yyyy: String(d.getFullYear())
      };
    }
    // combine DD MM YYYY → YYYY-MM-DD for storage
    function dateSelectHTML(prefix, label, dateStr, required='') {
      const {dd,mm,yyyy} = parseDateParts(dateStr);
      const months = [
        ['01','January'],['02','February'],['03','March'],['04','April'],
        ['05','May'],['06','June'],['07','July'],['08','August'],
        ['09','September'],['10','October'],['11','November'],['12','December']
      ];
      const currentYear = new Date().getFullYear();
      const years = Array.from({length:10}, (_,i) => currentYear - 5 + i);
      return `
        <div class="form-group">
          <label>${label}${required ? ' <span class="req">*</span>' : ''}</label>
          <div style="display:flex; gap:6px;">
            <select id="${prefix}-dd" class="form-control" style="flex:0 0 70px;" onchange="HRStaff._syncDate('${prefix}')">
              <option value="">DD</option>
              ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
            </select>
            <select id="${prefix}-mm" class="form-control" style="flex:1;" onchange="HRStaff._syncDate('${prefix}')">
              <option value="">Month</option>
              ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
            </select>
            <select id="${prefix}-yyyy" class="form-control" style="flex:0 0 90px;" onchange="HRStaff._syncDate('${prefix}')">
              <option value="">Year</option>
              ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <input type="hidden" id="${prefix}" value="${dateStr||''}" />
        </div>`;
    }

    return `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px;">PERSONAL INFORMATION</div>
        <div class="form-row">
          <div class="form-group">
            <label>FULL NAME <span class="req">*</span></label>
            <input type="text" id="sf-name" class="form-control" placeholder="e.g. John Doe" value="${s?.name || ''}" />
          </div>
          <div class="form-group">
            <label>ROLE / DESIGNATION <span class="req">*</span></label>
            <select id="sf-role" class="form-control">
              ${roles.map(r => `<option value="${r}" ${s?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>DEPARTMENT</label>
            <input type="text" id="sf-department" class="form-control" placeholder="e.g. Flight Operations, Admin..." value="${s?.department || ''}" />
          </div>
          <div class="form-group">
            <label>PHONE NUMBER</label>
            <input type="tel" id="sf-phone" class="form-control" placeholder="e.g. +88017..." value="${s?.phone || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>EMAIL ADDRESS</label>
            <input type="email" id="sf-email" class="form-control" placeholder="e.g. john@example.com" value="${s?.email || ''}" />
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px;">EMPLOYMENT DETAILS</div>
        <div class="form-row">
          ${dateSelectHTML('sf-joining', 'JOINING DATE', s?.joiningDate || Utils.today())}
          ${dateSelectHTML('sf-resign', 'RESIGN DATE', s?.resignDate || '')}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>MONTHLY SALARY (৳) <span class="req">*</span></label>
            <input type="number" id="sf-salary" class="form-control" placeholder="0.00" value="${s?.salary || ''}" min="1" />
          </div>
        </div>
      </div>

      <div class="form-row" style="display:none;">
        <input type="text" id="sf-id" value="${staffId}" />
        <select id="sf-status">
            <option value="Active"   ${(s?.status || 'Active') === 'Active'   ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${s?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
        </select>
        <textarea id="sf-note" placeholder="Optional Notes...">${s?.note || ''}</textarea>
      </div>

      <div class="form-actions" style="justify-content: flex-end; margin-top: 10px;">
        <button class="btn-secondary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.1); border: none;" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-primary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; border:none; color:#fff;" onclick="HRStaff.saveStaff()">SAVE EMPLOYEE</button>
      </div>`;
  }

  /* ─── Date Sync Helper: DD/MM/YYYY selects → hidden input ─── */
  function _syncDate(prefix) {
    const dd   = document.getElementById(prefix + '-dd')?.value   || '';
    const mm   = document.getElementById(prefix + '-mm')?.value   || '';
    const yyyy = document.getElementById(prefix + '-yyyy')?.value || '';
    const hidden = document.getElementById(prefix);
    if (hidden) hidden.value = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
  }

  /* ─── Save ─── */
  function saveStaff() {
    const name = document.getElementById('sf-name')?.value.trim();
    if (!name) { Utils.toast('Full Name is required!', 'error'); return; }

    const salaryVal = document.getElementById('sf-salary')?.value;
    if (!salaryVal || parseFloat(salaryVal) <= 0) { Utils.toast('Monthly Salary is required!', 'error'); return; }

    const rawStaffId = document.getElementById('sf-id')?.value || '';
    const entry = {
      staffId:     (rawStaffId && rawStaffId !== 'undefined') ? rawStaffId : generateStaffId(),
      name,
      role:        document.getElementById('sf-role')?.value || 'Staff',
      department:  document.getElementById('sf-department')?.value.trim() || '',
      phone:       document.getElementById('sf-phone')?.value.trim() || '',
      email:       document.getElementById('sf-email')?.value.trim() || '',
      salary:      parseFloat(document.getElementById('sf-salary')?.value) || 0,
      joiningDate: document.getElementById('sf-joining')?.value || '',
      resignDate:  document.getElementById('sf-resign')?.value || '',
      status:      document.getElementById('sf-status')?.value || 'Active',
      note:        document.getElementById('sf-note')?.value.trim() || ''
    };

    if (editingId) {
      SupabaseSync.update(DB.staff, editingId, entry);
      Utils.toast('Staff Info Updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.staff, entry);
      Utils.toast('New Staff Added ✓', 'success');
    }

    // HR staff save/update এর পরে salary sync করো
    if (typeof Salary !== 'undefined') Salary.syncFromHR(entry.staffId);

    Utils.closeModal();
    render();
    editingId = null;
  }

  /* ─── Toggle Status ─── */
  function toggleStatus(id) {
    const s = SupabaseSync.getById(DB.staff, id);
    if (!s) return;
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active';
    SupabaseSync.update(DB.staff, id, { status: newStatus });
    render();
    Utils.toast(`Status changed to: ${newStatus}`, 'info');
  }

  /* ─── Delete ─── */
  async function deleteStaff(id) {
    const ok = await Utils.confirm('Delete this staff member?', 'Delete Staff');
    if (!ok) return;
    SupabaseSync.remove(DB.staff, id);
    render();
    Utils.toast('Staff has been deleted', 'warning');
  }

  /* ─── Export Excel ─── */
  function exportExcel() {
    const staffList = getStaff();
    if (!staffList.length) { Utils.toast('No data available', 'error'); return; }
    const rows = staffList.map(s => ({
      'Staff ID': s.staffId, 'Name': s.name, 'Role': s.role,
      'Phone': s.phone, 'Email': s.email, 'Salary': s.salary,
      'Join': s.joiningDate, 'Status': s.status
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    XLSX.writeFile(wb, 'hr-staff.xlsx');
  }

  /* ─── Print ─── */
  function printList() {
    window.print();
  }

  /* ─── Public API ─── */
  return { init, render, applyFilter, changePage, changePageSize,
           openAddModal, openEditModal,
           saveStaff, toggleStatus, deleteStaff,
           exportExcel, printList,
           _syncDate,
           getAll: () => getStaff() };

})();
window.HRStaff = HRStaff;
