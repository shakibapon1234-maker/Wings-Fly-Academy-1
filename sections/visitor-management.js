// sections/visitor-management.js
// Wings Fly Aviation Academy

// VISITOR MANAGEMENT — FULL MODULE
// ===================================

// ── Submit (Add / Edit) ──
async function handleVisitorSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const data = {};
  fd.forEach((v, k) => data[k] = v);

  const name = (data.visitorName || '').trim();
  const phone = (data.visitorPhone || '').trim();
  const visitDate = (data.visitDate || '').trim();

  if (!name) { showErrorToast('❌ Visitor name is required.'); return; }
  if (!phone) { showErrorToast('❌ Phone number is required.'); return; }
  if (!visitDate) { showErrorToast('❌ Visit date is required.'); return; }

  const editIndex = data.visitorRowIndex !== '' && data.visitorRowIndex !== undefined
    ? parseInt(data.visitorRowIndex) : -1;

  const visitor = {
    name: name,
    phone: phone,
    course: data.interestedCourse || '',
    date: visitDate,
    remarks: (data.visitorRemarks || '').trim(),
    addedAt: new Date().toISOString()
  };

  if (!window.globalData.visitors) window.globalData.visitors = [];

  if (editIndex >= 0 && window.globalData.visitors[editIndex]) {
    visitor.addedAt = window.globalData.visitors[editIndex].addedAt;
    window.globalData.visitors[editIndex] = visitor;
    showSuccessToast('✅ Visitor updated successfully!');
    if (typeof logActivity === 'function') {
      logActivity('visitor', 'EDIT', 'Updated visitor: ' + visitor.name);
    }
  } else {
    window.globalData.visitors.push(visitor);
    showSuccessToast('✅ Visitor added successfully!');
    if (typeof logActivity === 'function') {
      logActivity('visitor', 'ADD', 'Added new visitor: ' + visitor.name + ' - interested in ' + (visitor.course || 'none'));
    }
  }

  await saveToStorage();
  if(window.markDirty) window.markDirty('visitors');
  if(typeof window.scheduleSyncPush==='function') window.scheduleSyncPush('Visitor saved');

  // Close modal
  const modalEl = document.getElementById('visitorModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  // Reset form
  form.reset();
  document.getElementById('visitorRowIndex').value = '';
  const title = document.getElementById('visitorModalTitle');
  if (title) title.innerHTML = `<span class="me-2 header-icon-circle bg-primary-light">👤</span>Visitor Information`;

  renderVisitors();
}

// ── Render table ──
function renderVisitors() {
  const tbody = document.getElementById('visitorTableBody');
  const noMsg = document.getElementById('noVisitorsMessage');
  if (!tbody) return;

  const q = (document.getElementById('visitorSearchInput')?.value || '').toLowerCase().trim();
  const start = document.getElementById('visitorStartDate')?.value || '';
  const end = document.getElementById('visitorEndDate')?.value || '';

  let list = (window.globalData.visitors || []).slice();

  // Filter
  if (q) {
    list = list.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q) ||
      (v.course || '').toLowerCase().includes(q)
    );
  }
  if (start) list = list.filter(v => v.date >= start);
  if (end) list = list.filter(v => v.date <= end);

  // ✅ FIX: Date অনুযায়ী sort করো — latest visit date সবার উপরে
  list = list.slice().sort(function(a, b) {
    var da = String(a.date || '').slice(0, 10);
    var db = String(b.date || '').slice(0, 10);
    if (db > da) return 1;
    if (db < da) return -1;
    // Same date হলে addedAt দিয়ে sort
    return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <i class="bi bi-person-x fs-2 d-block mb-2 opacity-50"></i>
          <span class="text-muted">${q || start || end ? 'No visitors match your filter.' : 'No visitors yet. Click "Add New Visitor" to start.'}</span>
        </td>
      </tr>`;
    if (noMsg) noMsg.classList.add('d-none');
    return;
  }

  // ✅ FIX: Find real index using addedAt+name — indexOf fails after reverse/filter
  const allVisitors = window.globalData.visitors || [];

  tbody.innerHTML = list.map(v => {
    const realIndex = allVisitors.findIndex(x =>
      x.addedAt === v.addedAt && x.name === v.name && x.phone === v.phone
    );

    return `
      <tr>
        <td style="padding:0.75rem 1rem; font-weight:600;">${v.date || '—'}</td>
        <td style="padding:0.75rem 1rem; font-weight:700;">${v.name}</td>
        <td style="padding:0.75rem 1rem;">
          <a href="tel:${v.phone}" style="color:inherit; text-decoration:none;">
            <i class="bi bi-telephone-fill me-1 text-success"></i>${v.phone}
          </a>
        </td>
        <td style="padding:0.75rem 1rem;">
          ${v.course
        ? `<span class="badge rounded-pill px-3" style="background:rgba(0,217,255,0.15); color:#00d9ff; border:1px solid rgba(0,217,255,0.3);">${v.course}</span>`
        : `<span class="text-muted small">—</span>`}
        </td>
        <td style="padding:0.75rem 1rem; font-size:0.88rem; color:rgba(255,255,255,0.6);">${v.remarks || '—'}</td>
        <td style="padding:0.75rem 1rem; text-align:right;">
          <button class="btn btn-sm btn-outline-primary rounded-pill me-1 px-3" onclick="editVisitor(${realIndex})">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteVisitor(${realIndex})">
            <i class="bi bi-trash-fill"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  if (noMsg) noMsg.classList.add('d-none');
}

// ── Search (called from filter inputs) ──
function searchVisitors() {
  renderVisitors();
}

// ── Clear filters ──
function clearVisitorFilters() {
  const s = document.getElementById('visitorSearchInput');
  const d1 = document.getElementById('visitorStartDate');
  const d2 = document.getElementById('visitorEndDate');
  if (s) s.value = '';
  if (d1) d1.value = '';
  if (d2) d2.value = '';
  renderVisitors();
}

// ── Edit ──
function editVisitor(index) {
  const visitors = window.globalData.visitors || [];
  const v = visitors[index];
  if (!v) { console.warn('[editVisitor] index not found:', index); return; }

  // ✅ FIX: visitorModal lazy-load হয় — আগে modal load করো, তারপর form fill করো
  function _fillAndOpen() {
    const form = document.getElementById('visitorForm');
    if (!form) {
      console.error('[editVisitor] visitorForm not found in DOM');
      return;
    }

    // Safe field fill
    const setVal = (name, val) => {
      const el = form.elements[name];
      if (el) el.value = val || '';
    };

    setVal('visitorName', v.name);
    setVal('visitorPhone', v.phone);
    setVal('visitDate', v.date);
    setVal('visitorRemarks', v.remarks);

    // Course select
    const courseSelect = document.getElementById('visitorCourseSelect');
    if (courseSelect) {
      // Wait for options to be populated
      setTimeout(() => {
        if (v.course) courseSelect.value = v.course;
      }, 150);
    }

    const rowIdx = document.getElementById('visitorRowIndex');
    if (rowIdx) rowIdx.value = index;

    const title = document.getElementById('visitorModalTitle');
    if (title) title.innerHTML = `<span class="me-2 header-icon-circle bg-warning-subtle">✏️</span>Edit Visitor`;

    // ✅ FIX: Use getOrCreate to avoid duplicate modal instances
    const modalEl = document.getElementById('visitorModal');
    if (!modalEl) { console.error('[editVisitor] visitorModal element not found'); return; }
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  // ✅ FIX: Check if modal is already in DOM — if not, load it first
  const modalEl = document.getElementById('visitorModal');
  if (!modalEl && typeof window.openVisitorModal === 'function') {
    // Load modal via section-loader, then fill form
    const origOpen = window.openVisitorModal;
    // Temporarily override to fill form after load
    window.openVisitorModal();
    // Poll until modal appears in DOM
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      if (document.getElementById('visitorModal')) {
        clearInterval(poll);
        setTimeout(_fillAndOpen, 200);
      } else if (tries > 30) {
        clearInterval(poll);
        console.error('[editVisitor] Modal did not load after 3s');
      }
    }, 100);
  } else {
    // Modal already in DOM
    _fillAndOpen();
  }
}

// ── Delete ──
async function deleteVisitor(index) {
  const visitors = window.globalData.visitors || [];
  const vToDelete = visitors[index];
  if (!vToDelete) return;

  if (!confirm(`Delete visitor "${vToDelete.name}"?`)) return;

  // 0. Move to Trash
  if (typeof moveToTrash === 'function') moveToTrash('visitor', vToDelete);

  // 1. Log Activity
  if (typeof logActivity === 'function') {
    logActivity('visitor', 'DELETE', 'Visitor deleted: ' + (vToDelete.name || 'Unknown'), vToDelete);
  }

  // 2. Remove from array
  visitors.splice(index, 1);

  // 3. Save locally first
  if (typeof saveToStorage === 'function') {
    saveToStorage(true);
  } else {
    localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
  }
  if(window.markDirty) window.markDirty('visitors');

  // 4. Trigger Sync
  if (typeof window.scheduleSyncPush === 'function') {
    window.scheduleSyncPush('Visitor delete');
  }

  showSuccessToast('🗑️ Visitor deleted & moved to trash.');
  renderVisitors();
}

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
    if (typeof window.scheduleSyncPush === 'function') {
      window.scheduleSyncPush('Employee delete: ' + (empToDelete.name || 'Unknown'));
    }

    // 5. Refresh UI
    renderEmployeeList();
  }
}

// ── Auto-set today's date when modal opens ──
document.addEventListener('DOMContentLoaded', () => {
  const visitorModal = document.getElementById('visitorModal');
  if (visitorModal) {
    visitorModal.addEventListener('show.bs.modal', () => {
      const dateInput = document.getElementById('visitorDateInput');
      const indexInput = document.getElementById('visitorRowIndex');
      // Only set today if adding new (not editing)
      if (dateInput && (!indexInput || indexInput.value === '')) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    });
  }
});

// Global expose
window.handleVisitorSubmit = handleVisitorSubmit;
window.renderVisitors = renderVisitors;
window.searchVisitors = searchVisitors;
window.clearVisitorFilters = clearVisitorFilters;
window.editVisitor = editVisitor;
window.deleteVisitor = deleteVisitor;
window.deleteEmployee = deleteEmployee;
