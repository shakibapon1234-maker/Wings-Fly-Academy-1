/* ============================================================
   HR STAFF MODULE — Wings Fly Aviation Academy
   Phase 8 | Employee Add / Edit / Delete / Role Management
   ============================================================ */

const HRStaff = (() => {

  let editingId = null;

  /* ─── Roles ─── */
  const ROLES = ['Instructor', 'Admin', 'Staff', 'Accountant', 'Receptionist', 'Driver', 'Guard'];

  function init() {
    renderContent();
  }

  function getStaff() {
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
  function renderContent() {
    const container = document.getElementById('hr-staff-content');
    if (!container) return;

    const staffList = getStaff();
    const activeCount  = staffList.filter(s => s.status === 'Active').length;
    const inactiveCount = staffList.filter(s => s.status === 'Inactive').length;
    const totalSalary  = staffList.filter(s => s.status === 'Active')
                              .reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);

    container.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-blue-glow)"><i class="fa fa-users"></i></div>
          <div class="stat-info">
            <div class="stat-value">${staffList.length}</div>
            <div class="stat-label">Total Staff</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-green-glow)"><i class="fa fa-circle-check"></i></div>
          <div class="stat-info">
            <div class="stat-value">${activeCount}</div>
            <div class="stat-label">Active</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-red-glow)"><i class="fa fa-circle-xmark"></i></div>
          <div class="stat-info">
            <div class="stat-value">${inactiveCount}</div>
            <div class="stat-label">Inactive</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-gold-glow)"><i class="fa fa-sack-dollar"></i></div>
          <div class="stat-info">
            <div class="stat-value">৳${Utils.formatMoneyPlain(totalSalary)}</div>
            <div class="stat-label">Monthly Salary Budget</div>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="filter-bar">
        <input type="text" id="staff-search" placeholder="🔍 Name / Phone / Search ID..." oninput="HRStaff.applyFilter()" />
        <select id="staff-role-filter" onchange="HRStaff.applyFilter()">
          <option value="">All Roles</option>
          ${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <select id="staff-status-filter" onchange="HRStaff.applyFilter()">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button class="btn-secondary" onclick="HRStaff.exportExcel()">
          <i class="fa fa-file-excel"></i> Excel
        </button>
        <button class="btn-secondary" onclick="HRStaff.printList()">
          <i class="fa fa-print"></i> Print
        </button>
      </div>

      <div class="table-wrapper" id="staff-table-wrapper">
        ${renderTable(staffList)}
      </div>
    `;
  }

  function renderTable(data) {
    if (!data.length) return `
      <div class="empty-state">
        <i class="fa fa-users" style="font-size:3rem;opacity:.3"></i>
        <p>No Staff not found। First Staff Add।</p>
      </div>`;

    return `
      <table class="data-table" id="staff-print-table">
        <thead>
          <tr>
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
          ${data.map(s => `
            <tr>
              <td><code>${s.staffId || '—'}</code></td>
              <td><strong>${s.name}</strong></td>
              <td><span class="badge badge-blue">${s.role}</span></td>
              <td>${s.phone || '—'}</td>
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

  function applyFilter() {
    const q      = (document.getElementById('staff-search')?.value || '').toLowerCase();
    const role   = document.getElementById('staff-role-filter')?.value || '';
    const status = document.getElementById('staff-status-filter')?.value || '';

    const staffList = getStaff();
    const filtered = staffList.filter(s => {
      const matchQ = !q || s.name.toLowerCase().includes(q) ||
                     (s.phone || '').includes(q) || (s.staffId || '').toLowerCase().includes(q);
      const matchRole   = !role   || s.role === role;
      const matchStatus = !status || s.status === status;
      return matchQ && matchRole && matchStatus;
    });

    const wrapper = document.getElementById('staff-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderTable(filtered);
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
              ${ROLES.map(r => `<option value="${r}" ${s?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>EMAIL ADDRESS</label>
            <input type="email" id="sf-email" class="form-control" placeholder="e.g. john@example.com" value="${s?.email || ''}" />
          </div>
          <div class="form-group">
            <label>PHONE NUMBER</label>
            <input type="tel" id="sf-phone" class="form-control" placeholder="e.g. +88017..." value="${s?.phone || ''}" />
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px;">EMPLOYMENT DETAILS</div>
        <div class="form-row">
          <div class="form-group">
            <label>JOINING DATE</label>
            <input type="date" id="sf-joining" class="form-control" value="${s?.joiningDate || ''}" />
          </div>
          <div class="form-group">
            <label>RESIGN DATE</label>
            <input type="date" id="sf-resign" class="form-control" value="${s?.resignDate || ''}" />
          </div>
          <div class="form-group">
            <label>MONTHLY SALARY (৳)</label>
            <input type="number" id="sf-salary" class="form-control" placeholder="0.00" value="${s?.salary || ''}" />
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

  /* ─── Save ─── */
  function saveStaff() {
    const name = document.getElementById('sf-name')?.value.trim();
    if (!name) { Utils.toast('Full Name is required!', 'error'); return; }

    const entry = {
      staffId:     document.getElementById('sf-id')?.value || generateStaffId(),
      name,
      role:        document.getElementById('sf-role')?.value || 'Staff',
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

    Utils.closeModal();
    renderContent();
    editingId = null;
  }

  /* ─── Toggle Status ─── */
  function toggleStatus(id) {
    const s = SupabaseSync.getById(DB.staff, id);
    if (!s) return;
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active';
    SupabaseSync.update(DB.staff, id, { status: newStatus });
    renderContent();
    Utils.toast(`Status changed to: ${newStatus}`, 'info');
  }

  /* ─── Delete ─── */
  async function deleteStaff(id) {
    const ok = await Utils.confirm('Delete this staff member?', 'Delete Staff');
    if (!ok) return;
    SupabaseSync.remove(DB.staff, id);
    renderContent();
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
  return { init, renderContent, openAddModal, openEditModal,
           saveStaff, toggleStatus, deleteStaff, applyFilter,
           exportExcel, printList,
           getAll: () => getStaff() };

})();
