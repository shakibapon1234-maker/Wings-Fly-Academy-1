// sections/employee-management.js
// Wings Fly Aviation Academy

// EMPLOYEE MANAGEMENT
// ===================================

// Global declaration for safety
window.employeeModalInstance = null;

function openEmployeeModal() {
  console.log('Open Employee Modal Clicked');
  const form = document.getElementById('employeeForm');
  if (form) form.reset();

  const idField = document.getElementById('employeeId');
  if (idField) idField.value = '';

  const modalEl = document.getElementById('employeeModal');
  if (!modalEl) {
    console.error('Employee modal element not found!');
    return;
  }

  // ✅ FIX: Reset title for Add mode (Edit mode changes it)
  const titleEl = modalEl.querySelector('.modal-title');
  if (titleEl) titleEl.innerHTML = '<span class="me-2 header-icon-circle bg-primary-light">👔</span>Add New Employee';

  // Dynamic Role Population
  const roleSelect = form.querySelector('select[name="role"]');
  if (roleSelect) {
    const roles = globalData.employeeRoles || ['Instructor', 'Admin', 'Staff', 'Manager'];
    roleSelect.innerHTML = roles.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  try {
    if (!window.employeeModalInstance) {
      window.employeeModalInstance = new bootstrap.Modal(modalEl);
    }
    window.employeeModalInstance.show();
  } catch (err) {
    console.error(err);
    alert('Failed to show modal: ' + err.message);
  }
}

async function handleEmployeeSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const employeeData = Object.fromEntries(formData.entries());

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

  try {
    const newEmployee = {
      id: employeeData.employeeId || 'EMP-' + Date.now(),
      name: employeeData.name,
      role: employeeData.role,
      email: employeeData.email,
      phone: employeeData.phone,
      joiningDate: employeeData.joiningDate,
      resignDate: employeeData.resignDate || null,
      salary: parseFloat(employeeData.salary) || 0,
      status: employeeData.resignDate ? 'Resigned' : 'Active',
      lastUpdated: new Date().toISOString()
    };

    if (employeeData.employeeId) {
      const index = globalData.employees.findIndex(em => em.id === employeeData.employeeId);
      if (index !== -1) {
        globalData.employees[index] = { ...globalData.employees[index], ...newEmployee };
        showSuccessToast('Employee updated successfully!');
        if (typeof logActivity === 'function') {
          logActivity('employee', 'EDIT', 'Updated employee: ' + newEmployee.name + ' (' + newEmployee.role + ')');
        }
      }
    } else {
      if (!globalData.employees) globalData.employees = [];
      globalData.employees.push(newEmployee);
      showSuccessToast('Employee added successfully!');
      if (typeof logActivity === 'function') {
        logActivity('employee', 'ADD', 'Added new employee: ' + newEmployee.name + ' (' + newEmployee.role + ')');
      }
    }

    // CRITICAL: Update timestamp BEFORE saving to prevent race conditions
    const currentTime = new Date().toISOString();
    localStorage.setItem('lastLocalUpdate', currentTime);

    // Save to local storage
    localStorage.setItem('wingsfly_data', JSON.stringify(globalData));

    // Close modal immediately
    const employeeModalEl = document.getElementById('employeeModal');
    if (employeeModalEl) {
      const modal = bootstrap.Modal.getInstance(employeeModalEl) || new bootstrap.Modal(employeeModalEl);
      modal.hide();
    }

    // Refresh UI immediately
    renderEmployeeList();

    // Attempt cloud sync in background
    if (typeof window.markDirty === 'function') {
      window.markDirty('employees');
    }
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Employee save');
    } else if (typeof window.saveToCloud === 'function') {
      window.saveToCloud().catch(err => {
        console.error('Background cloud sync failed:', err);
      });
    }

  } catch (err) {
    console.error('Error during employee save process:', err);
    alert("Error saving employee: " + err.message);
  } finally {
    // Ensure button is reset
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function renderEmployeeList() {
  const tbody = document.getElementById('employeeTableBody');
  const searchInput = document.getElementById('employeeSearchInput');
  const roleFilter = document.getElementById('employeeRoleFilter');
  const noDataMsg = document.getElementById('noEmployeesMessage');

  if (!tbody || !searchInput) return;

  // Dynamically populate role filter dropdown
  if (roleFilter) {
    const currentFilterVal = roleFilter.value;
    const roles = globalData.employeeRoles || ['Instructor', 'Admin', 'Staff', 'Manager'];
    roleFilter.innerHTML = '<option value="">All Roles</option>' + roles.map(r => `<option value="${r}">${r}</option>`).join('');
    if (currentFilterVal && roles.includes(currentFilterVal)) {
      roleFilter.value = currentFilterVal;
    }
  }

  const search = searchInput.value.toLowerCase();
  const role = roleFilter ? roleFilter.value : '';

  tbody.innerHTML = '';

  const filtered = (globalData.employees || []).filter(e => {
    const matchSearch = (e.name && e.name.toLowerCase().includes(search)) ||
      (e.phone && e.phone.includes(search)) ||
      (e.email && e.email.toLowerCase().includes(search));
    const matchRole = !role || e.role === role;
    return matchSearch && matchRole;
  }).sort(function(a, b) {
    // ✅ FIX: Date অনুযায়ী sort — latest joining date সবার উপরে
    var da = String(a.joiningDate || a.lastUpdated || '').slice(0, 10);
    var db = String(b.joiningDate || b.lastUpdated || '').slice(0, 10);
    if (db > da) return 1;
    if (db < da) return -1;
    return String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || ''));
  });

  if (filtered.length === 0) {
    noDataMsg.classList.remove('d-none');
    return;
  }
  noDataMsg.classList.add('d-none');

  filtered.forEach(e => {
    const tr = document.createElement('tr');

    let docLinks = '';
    // Helper to check if URL is valid (full https URL)
    const isValidUrl = (url) => url && (url.startsWith('https://') || url.startsWith('http://'));

    if (e.docs) {
      if (isValidUrl(e.docs.cv)) docLinks += `<a href="${e.docs.cv}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-light border me-1 text-primary" title="View CV"><i class="bi bi-file-earmark-person"></i></a>`;
      if (isValidUrl(e.docs.nid)) docLinks += `<a href="${e.docs.nid}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-light border me-1 text-primary" title="View NID"><i class="bi bi-card-heading"></i></a>`;
      if (isValidUrl(e.docs.cert)) docLinks += `<a href="${e.docs.cert}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-light border me-1 text-primary" title="View Certificate"><i class="bi bi-award"></i></a>`;
      if (isValidUrl(e.docs.other)) docLinks += `<a href="${e.docs.other}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-light border me-1 text-primary" title="Other Doc"><i class="bi bi-file-earmark"></i></a>`;
    }

    const statusBadge = (e.status === 'Resigned')
      ? '<span class="badge bg-danger text-white border-0">Resigned</span>'
      : '<span class="badge bg-success-light text-success border-0">Active</span>';

    tr.innerHTML = `
        <td>
            <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width:36px;height:36px;background:linear-gradient(135deg,#00d9ff,#7c3aed);color:#fff;font-size:0.9rem;flex-shrink:0;">
                    ${e.name.charAt(0).toUpperCase()}
                </div>
                <div class="fw-bold text-white">${e.name}</div>
            </div>
        </td>
        <td><span class="badge bg-light text-dark border">${e.role}</span></td>
        <td>
            <div class="small text-white">${e.phone}</div>
            <div class="small text-muted">${e.email || '-'}</div>
        </td>
        <td class="fw-bold text-white">৳${formatNumber(e.salary)}</td>
        <td class="small text-muted">${e.joiningDate || '-'}</td>
        <td class="small ${e.resignDate ? 'text-danger fw-bold' : 'text-muted'}">${e.resignDate || '-'}</td>
        <td>${statusBadge}</td>
        <td class="text-end">
            <div class="d-flex justify-content-end align-items-center">
                ${docLinks}
                <button class="btn btn-sm btn-outline-primary border-0 ms-2" onclick="openEditEmployeeModal('${e.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0 ms-1" onclick="deleteEmployee('${e.id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditEmployeeModal(id) {
  const employee = (globalData.employees || []).find(e => String(e.id) === String(id));
  if (!employee) { console.warn('[openEditEmployeeModal] employee not found:', id); return; }

  // ✅ V2 FIX: Fill form and show modal — called after modal is guaranteed in DOM
  function _fillAndShow() {
    const modalEl = document.getElementById('employeeModal');
    const form = document.getElementById('employeeForm');
    if (!modalEl || !form) {
      console.error('[openEditEmployeeModal] modal or form not found in DOM');
      return;
    }

    form.reset();

    if (form.employeeId) form.employeeId.value = employee.id;
    if (form.name) form.name.value = employee.name || '';
    if (form.email) form.email.value = employee.email || '';
    if (form.phone) form.phone.value = employee.phone || '';
    if (form.joiningDate) form.joiningDate.value = employee.joiningDate || '';
    if (form.resignDate) form.resignDate.value = employee.resignDate || '';
    if (form.salary) form.salary.value = employee.salary || '';

    // Populate role dropdown and set value
    const roleSelect = form.querySelector('select[name="role"]');
    if (roleSelect) {
      const roles = globalData.employeeRoles && globalData.employeeRoles.length
        ? globalData.employeeRoles
        : ['Instructor', 'Admin', 'Staff', 'Manager'];
      roleSelect.innerHTML = roles.map(r =>
        `<option value="${r}" ${r === employee.role ? 'selected' : ''}>${r}</option>`
      ).join('');
      // Ensure value is set even if not in list
      if (!roles.includes(employee.role)) {
        const opt = document.createElement('option');
        opt.value = employee.role;
        opt.text = employee.role;
        opt.selected = true;
        roleSelect.insertBefore(opt, roleSelect.firstChild);
      }
    }

    // ✅ Update modal title for Edit mode
    const titleEl = modalEl.querySelector('.modal-title');
    if (titleEl) titleEl.innerHTML = '<span class="me-2 header-icon-circle bg-primary-light">✏️</span>Edit Employee';

    // ✅ V2 FIX: Use getOrCreateInstance to avoid duplicate modal errors
    try {
      window.employeeModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
      window.employeeModalInstance.show();
    } catch (err) { console.error('[openEditEmployeeModal] show error:', err); }
  }

  // ✅ V2 FIX: Check if modal is already in DOM
  const modalEl = document.getElementById('employeeModal');
  if (modalEl) {
    // Modal is already in DOM — fill and show directly (no loading needed)
    _fillAndShow();
  } else {
    // Modal NOT in DOM — load modals.html via section-loader
    console.log('[openEditEmployeeModal] Modal not in DOM, loading via section-loader...');
    if (window.sectionLoader && typeof window.sectionLoader.loadAndOpen === 'function') {
      // ✅ V2 FIX: Use section-loader's loadAndOpen directly
      // onLoaded callback fires BEFORE section-loader's 100ms _showModal timeout
      // So we fill the form first — when modal finally shows, it already has data
      window.sectionLoader.loadAndOpen('__modalPlaceholderOther', 'sections/modals.html', 'employeeModal', function() {
        _fillAndShow();
      });
    } else {
      // ✅ Ultimate fallback — use Bootstrap events for proper transition timing
      if (typeof window.openEmployeeModal === 'function') {
        window.openEmployeeModal();
      }
      var tries = 0;
      var poll = setInterval(function() {
        tries++;
        var el = document.getElementById('employeeModal');
        if (el) {
          clearInterval(poll);
          // Wait for Bootstrap show transition to complete, then hide and re-show with data
          el.addEventListener('shown.bs.modal', function _onceShown() {
            el.removeEventListener('shown.bs.modal', _onceShown);
            var inst = bootstrap.Modal.getInstance(el);
            if (inst) inst.hide();
            el.addEventListener('hidden.bs.modal', function _onceHidden() {
              el.removeEventListener('hidden.bs.modal', _onceHidden);
              _fillAndShow();
            }, { once: true });
          }, { once: true });
        } else if (tries > 30) {
          clearInterval(poll);
          console.error('[openEditEmployeeModal] Modal did not load after 3s');
        }
      }, 100);
    }
  }
}

window.openEditEmployeeModal = openEditEmployeeModal;

// ── Delete ──

async function deleteEmployee(id) {
  // Log before delete
  const empToDelete = (window.globalData.employees || []).find(e => e.id == id);
  if (!empToDelete) return;

  if (confirm('Are you sure you want to remove this employee?')) {
    // 0. Move to Trash
    if (typeof moveToTrash === 'function') moveToTrash('employee', empToDelete);

    // 1. Log Activity
    if (typeof logActivity === 'function') {
      logActivity('employee', 'DELETE',
        'Employee deleted: ' + (empToDelete.name || 'Unknown') + ' | Role: ' + (empToDelete.role || '-'), empToDelete);
    }

    // 2. Remove from globalData
    globalData.employees = globalData.employees.filter(e => String(e.id) !== String(id));

    // 3. Save locally first (Skip cloud push to handle manually)
    if (typeof saveToStorage === 'function') {
      saveToStorage(true);
    } else {
      localStorage.setItem('wingsfly_data', JSON.stringify(globalData));
    }

    // 4. Force cloud sync
    if (typeof window.markDirty === 'function') {
      window.markDirty('employees');
    }
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Employee delete: ' + (empToDelete.name || 'Unknown'));
    }

    // 5. Refresh UI
    renderEmployeeList();
    showSuccessToast('Employee removed & moved to trash.');
  }
}

// Expose functions
window.openEmployeeModal = openEmployeeModal;
window.handleEmployeeSubmit = handleEmployeeSubmit;
window.saveEmployee = handleEmployeeSubmit;  // ✅ alias — auto-test expects saveEmployee
window.renderEmployeeList = renderEmployeeList;
window.deleteEmployee = deleteEmployee;


// ✅ AUTO-TEST ALIAS
window.renderEmployees = window.renderEmployeeList;
