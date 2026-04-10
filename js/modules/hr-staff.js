/* ============================================================
   HR STAFF MODULE — Wings Fly Aviation Academy
   Phase 8 | Employee Add / Edit / Delete / Role Management
   ============================================================ */

const HRStaff = (() => {

  /* ─── State ─── */
  let staff = [];
  let editingId = null;

  /* ─── Roles ─── */
  const ROLES = ['Instructor', 'Admin', 'Staff', 'Accountant', 'Receptionist', 'Driver', 'Guard'];

  /* ─── Init ─── */
  function init() {
    load();
    renderContent();
  }

  /* ─── Storage ─── */
  function load() {
    try { staff = JSON.parse(localStorage.getItem('wf_hr_staff') || '[]'); }
    catch { staff = []; }
  }

  function save() {
    localStorage.setItem('wf_hr_staff', JSON.stringify(staff));
    if (typeof SupabaseSync !== 'undefined') SupabaseSync.push('hr_staff', staff);
  }

  /* ─── Generate Staff ID ─── */
  function generateStaffId() {
    const max = staff.reduce((m, s) => {
      const n = parseInt((s.staffId || '').replace(/\D/g, '')) || 0;
      return Math.max(m, n);
    }, 0);
    return 'STF-' + String(max + 1).padStart(3, '0');
  }

  /* ─── Render Main Content ─── */
  function renderContent() {
    const container = document.getElementById('hr-staff-content');
    if (!container) return;

    const activeCount  = staff.filter(s => s.status === 'Active').length;
    const inactiveCount = staff.filter(s => s.status === 'Inactive').length;
    const totalSalary  = staff.filter(s => s.status === 'Active')
                              .reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);

    container.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-blue-glow)"><i class="fa fa-users"></i></div>
          <div class="stat-info">
            <div class="stat-value">${staff.length}</div>
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
            <div class="stat-value">৳${Utils.formatNumber(totalSalary)}</div>
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

      <!-- Table -->
      <div class="table-wrapper" id="staff-table-wrapper">
        ${renderTable(staff)}
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
              <td>৳${Utils.formatNumber(s.salary || 0)}</td>
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

  /* ─── Apply Filter ─── */
  function applyFilter() {
    const q      = (document.getElementById('staff-search')?.value || '').toLowerCase();
    const role   = document.getElementById('staff-role-filter')?.value || '';
    const status = document.getElementById('staff-status-filter')?.value || '';

    const filtered = staff.filter(s => {
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
    showModal('Add Staff Add', formHTML(null, newId));
  }

  /* ─── Modal: Edit ─── */
  function openEditModal(id) {
    editingId = id;
    const s = staff.find(x => x.id === id);
    if (!s) return;
    showModal('Staff Info Edit', formHTML(s, s.staffId));
  }

  function showModal(title, body) {
    if (typeof Utils !== 'undefined') {
      Utils.openModal(title, body);
    } else {
      const overlay = document.getElementById('modal-overlay');
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = body;
      overlay?.classList.remove('hidden');
    }
  }

  function formHTML(s, staffId) {
    return `
      <div class="form-grid">
        <div class="form-group">
          <label>Staff ID</label>
          <input type="text" id="sf-id" value="${staffId}" readonly style="opacity:.6" />
        </div>
        <div class="form-group">
          <label>Full Name <span class="required">*</span></label>
          <input type="text" id="sf-name" placeholder="Staff Name" value="${s?.name || ''}" required />
        </div>
        <div class="form-group">
          <label>Role <span class="required">*</span></label>
          <select id="sf-role">
            ${ROLES.map(r => `<option value="${r}" ${s?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="tel" id="sf-phone" placeholder="01XXXXXXXXX" value="${s?.phone || ''}" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="sf-email" placeholder="example@email.com" value="${s?.email || ''}" />
        </div>
        <div class="form-group">
          <label>Monthly Salary (৳)</label>
          <input type="number" id="sf-salary" placeholder="0" min="0" value="${s?.salary || ''}" />
        </div>
        <div class="form-group">
          <label>Join Date</label>
          <input type="date" id="sf-joining" value="${s?.joiningDate || ''}" />
        </div>
        <div class="form-group">
          <label>Resignation Date</label>
          <input type="date" id="sf-resign" value="${s?.resignDate || ''}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="sf-status">
            <option value="Active"   ${(s?.status || 'Active') === 'Active'   ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${s?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>Address / Notes</label>
          <textarea id="sf-note" rows="2" placeholder="Optional Notes...">${s?.note || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="HRStaff.saveStaff()">
          <i class="fa fa-save"></i> Save
        </button>
      </div>`;
  }

  /* ─── Save ─── */
  function saveStaff() {
    const name = document.getElementById('sf-name')?.value.trim();
    if (!name) { Utils.toast('Name is required!', 'error'); return; }

    const entry = {
      id:          editingId || Utils.generateId(),
      staffId:     document.getElementById('sf-id')?.value || generateStaffId(),
      name,
      role:        document.getElementById('sf-role')?.value || 'Staff',
      phone:       document.getElementById('sf-phone')?.value.trim() || '',
      email:       document.getElementById('sf-email')?.value.trim() || '',
      salary:      parseFloat(document.getElementById('sf-salary')?.value) || 0,
      joiningDate: document.getElementById('sf-joining')?.value || '',
      resignDate:  document.getElementById('sf-resign')?.value || '',
      status:      document.getElementById('sf-status')?.value || 'Active',
      note:        document.getElementById('sf-note')?.value.trim() || '',
      updatedAt:   new Date().toISOString(),
    };

    if (editingId) {
      const idx = staff.findIndex(s => s.id === editingId);
      if (idx !== -1) { entry.createdAt = staff[idx].createdAt; staff[idx] = entry; }
    } else {
      entry.createdAt = new Date().toISOString();
      staff.push(entry);
    }

    save();
    Utils.closeModal();
    Utils.toast(editingId ? 'Staff Info Update done/happened ✓' : 'New Staff added ✓', 'success');
    renderContent();
    editingId = null;
  }

  /* ─── Toggle Status ─── */
  function toggleStatus(id) {
    const s = staff.find(x => x.id === id);
    if (!s) return;
    s.status = s.status === 'Active' ? 'Inactive' : 'Active';
    s.updatedAt = new Date().toISOString();
    save();
    renderContent();
    Utils.toast(`Status changed to: ${s.status}`, 'info');
  }

  /* ─── Delete ─── */
  function deleteStaff(id) {
    Utils.confirm('Delete this staff member?', () => {
      staff = staff.filter(s => s.id !== id);
      save();
      renderContent();
      Utils.toast('Staff has been deleted', 'warning');
    });
  }

  /* ─── Export Excel ─── */
  function exportExcel() {
    if (!staff.length) { Utils.toast('No data available', 'error'); return; }
    const rows = staff.map(s => ({
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
  return { init, load, renderContent, openAddModal, openEditModal,
           saveStaff, toggleStatus, deleteStaff, applyFilter,
           exportExcel, printList,
           getAll: () => staff };

})();
