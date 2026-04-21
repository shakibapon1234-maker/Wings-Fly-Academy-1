/* ============================================================
   VISITORS MODULE — Wings Fly Aviation Academy
   Phase 11 | Visitor Tracking (Nebula & Aurora UI)
   ============================================================ */

const VisitorsModule = (() => {

  let editingId = null;
  let searchQuery = '';

  function init() {
    render();
  }

  function getRecords() {
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined') return [];
    return Utils.sortBy(SupabaseSync.getAll(DB.visitors), 'visit_date', 'desc');
  }

  // Reference source options
  const REFERENCE_OPTIONS = [
    'YouTube',
    'Facebook',
    'Instagram',
    'Online Platform',
    'Friend/Relative',
    'Student Referral',
    'Banner/Poster',
    'Walk-in',
    'Other'
  ];

  function onSearch(val) {
    searchQuery = (val || '').toLowerCase().trim();
    render();
  }

  // ── Event Delegation: table + search input ─────────────────────────
  // Container-এ event delegation attach করা হয় — re-render এর পরোও কাজ করে
  function _initDelegation(container) {
    if (container._visitorsDelegated) return;
    container._visitorsDelegated = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      if (action === 'vis-convert') convertToStudent(id);
      else if (action === 'vis-edit')   openEditModal(id);
      else if (action === 'vis-delete') deleteRecord(id);
    });

    container.addEventListener('input', (e) => {
      if (e.target.id === 'visitor-search') onSearch(e.target.value);
    });
  }

  // ── Modal Event Delegation ────────────────────────────────────
  // Modal বড় করার পরেই modal-body-তে event bind করা হয়
  function _bindModalEvents() {
    const body = document.getElementById('modal-body');
    if (!body) return;
    const saveBtn   = body.querySelector('[data-action="vis-save"]');
    const cancelBtn = body.querySelector('[data-action="vis-cancel"]');
    if (saveBtn)   saveBtn.addEventListener('click', saveRecord);
    if (cancelBtn) cancelBtn.addEventListener('click', () => Utils.closeModal());
  }

  function render() {
    const container = document.getElementById('visitors-content');
    if (!container) return; // Silent return if not rendered

    const allVisitors = getRecords();
    const visitors = searchQuery
      ? allVisitors.filter(v =>
          (v.name || '').toLowerCase().includes(searchQuery) ||
          (v.phone || '').toLowerCase().includes(searchQuery) ||
          (v.purpose || '').toLowerCase().includes(searchQuery) ||
          (v.interested_course || '').toLowerCase().includes(searchQuery) ||
          (v.address || '').toLowerCase().includes(searchQuery) ||
          (v.reference || '').toLowerCase().includes(searchQuery)
        )
      : allVisitors;

    // Stats
    const total = visitors.length;
    const enrolled = visitors.filter(v => v.status === 'Enrolled').length;
    const interested = visitors.filter(v => v.status === 'Interested').length;
    const followup = visitors.filter(v => v.status === 'Follow-up').length;

    let html = `
      <!-- Top Bar: Search & QR Code -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:18px; flex-wrap:wrap; gap:16px;">
        <div>
          <input
            id="visitor-search"
            type="text"
            class="form-control"
            placeholder="Search by name, phone, or course…"
            value="${Utils.escAttr(searchQuery)}"
            style="min-width:300px; max-width:400px; font-family:inherit;"
          />
        </div>
        <div style="display:flex; align-items:center; gap:12px; background:rgba(0,212,255,0.05); border:1px solid rgba(0,212,255,0.2); padding:8px 16px; border-radius:12px;">
          <img src="assets/Visitor.png" alt="Visitor QR" style="width:60px; height:60px; border-radius:6px; background:#fff; padding:2px; cursor:pointer;" onclick="window.open(this.src,'_blank')" title="Click to enlarge" onerror="this.style.display='none'">
          <div>
            <div style="font-size:0.85rem; font-weight:700; color:#00d4ff; text-transform:uppercase;">Visitor Scan QR</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Visitors can scan this code to register quickly.</div>
          </div>
        </div>
      </div>
      <!-- Stats Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
        <div style="box-shadow:none; border:1px solid rgba(0,212,255,0.2); padding:16px; background:rgba(0,212,255,0.05); border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="color:#00d4ff; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">TOTAL VISITORS</div>
              <div style="color:#fff; font-size:1.6rem; font-weight:800; text-shadow:0 0 10px rgba(0,212,255,0.4);">${total}</div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:rgba(0,212,255,0.1); display:flex; align-items:center; justify-content:center; color:#00d4ff; font-size:1.2rem;"><i class="fa fa-users"></i></div>
          </div>
        </div>
        <div style="box-shadow:none; border:1px solid rgba(0,255,136,0.2); padding:16px; background:rgba(0,255,136,0.05); border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="color:#00ff88; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">ENROLLED (CONVERTED)</div>
              <div style="color:#00ff88; font-size:1.6rem; font-weight:800; text-shadow:0 0 10px rgba(0,255,136,0.4);">${enrolled}</div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:rgba(0,255,136,0.1); display:flex; align-items:center; justify-content:center; color:#00ff88; font-size:1.2rem;"><i class="fa fa-user-graduate"></i></div>
          </div>
        </div>
        <div style="box-shadow:none; border:1px solid rgba(255,170,0,0.2); padding:16px; background:rgba(255,170,0,0.05); border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="color:#ffb703; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">INTERESTED</div>
              <div style="color:#ffb703; font-size:1.6rem; font-weight:800; text-shadow:0 0 10px rgba(255,170,0,0.4);">${interested}</div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:rgba(255,170,0,0.1); display:flex; align-items:center; justify-content:center; color:#ffb703; font-size:1.2rem;"><i class="fa fa-star"></i></div>
          </div>
        </div>
        <div style="box-shadow:none; border:1px solid rgba(255,71,87,0.2); padding:16px; background:rgba(255,71,87,0.05); border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="color:#ff4757; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">FOLLOW-UP</div>
              <div style="color:#ff4757; font-size:1.6rem; font-weight:800; text-shadow:0 0 10px rgba(255,71,87,0.4);">${followup}</div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:rgba(255,71,87,0.1); display:flex; align-items:center; justify-content:center; color:#ff4757; font-size:1.2rem;"><i class="fa fa-phone"></i></div>
          </div>
        </div>
      </div>
    `;

    if (!visitors.length) {
      const emptyMsg = searchQuery
        ? `<div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No results for "${Utils.esc(searchQuery)}"</div>
           <div style="color:var(--text-muted); font-size:0.9rem;">Try a different name, phone, or course.</div>`
        : `<div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No Visitors Yet</div>
           <div style="color:var(--text-muted); font-size:0.9rem;">Start adding visitors using the "ADD NEW" button on the top right.</div>`;
      html += `<div style="text-align:center; padding:60px 20px; background:var(--bg-secondary); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
                <i class="fa fa-person-walking-arrow-right" style="font-size:3.5rem; margin-bottom:16px; opacity:0.3; display:block; color:var(--brand-primary);"></i>
                ${emptyMsg}
               </div>`;
    } else {
      // Table
      html += `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name & Contact</th>
                <th>Address</th>
                <th>Reference</th>
                <th>Course Interested</th>
                <th>Status</th>
                <th>Follow-up</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${visitors.map(v => {
                let statusBadge = '';
                if(v.status === 'Enrolled') statusBadge = '<span class="badge badge-success"><i class="fa fa-check"></i> Enrolled</span>';
                else if(v.status === 'Interested') statusBadge = '<span class="badge badge-warning"><i class="fa fa-star"></i> Interested</span>';
                else if(v.status === 'Follow-up') statusBadge = '<span class="badge badge-error"><i class="fa fa-phone"></i> Follow-up</span>';
                else statusBadge = '<span class="badge badge-secondary">Not Interested</span>';

                return `
                <tr>
                  <td style="white-space:nowrap; color:var(--text-muted); font-size:0.85rem;"><i class="fa fa-calendar-day" style="margin-right:4px;"></i>${Utils.formatDateEN(v.visit_date || v.visitDate)}</td>
                  <td>
                    <div style="font-weight:700; color:#fff; font-size:1rem;">${Utils.esc(v.name)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa fa-phone" style="font-size:0.7rem; margin-right:4px;"></i>${Utils.esc(v.phone)}</div>
                  </td>
                  <td style="font-size:0.85rem; color:var(--text-muted);">${Utils.esc(v.address || '-')}</td>
                  <td>
                    ${v.reference ? `<span style="background:rgba(124,58,237,0.2); color:#a78bfa; border-radius:20px; padding:2px 10px; font-size:0.78rem; font-weight:700;"><i class="fa fa-share-nodes" style="margin-right:4px;"></i>${Utils.esc(v.reference)}</span>` : '<span style="color:var(--text-muted)">-</span>'}
                  </td>
                  <td style="font-weight:600; color:#00d4ff;">${Utils.esc(v.interested_course || '-')}</td>
                  <td>${statusBadge}</td>
                  <td><span style="font-size:0.8rem; color:${v.follow_up_date ? '#ffb703' : 'var(--text-muted)'}">${v.follow_up_date ? '<i class="fa fa-clock"></i> ' + Utils.formatDateEN(v.follow_up_date) : '-'}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn-secondary btn-sm" data-action="vis-convert" data-id="${v.id}" style="border-radius:20px; padding:4px 12px; background:linear-gradient(90deg, #b224ef, #7579ff); color:#fff; border:none;" title="Convert to Student"><i class="fa fa-user-graduate"></i> Convert</button>
                    <button class="btn btn-secondary btn-sm" data-action="vis-edit"    data-id="${v.id}" style="border-radius:20px; padding:4px 12px;"><i class="fa fa-pen"></i> Edit</button>
                    <button class="btn btn-secondary btn-sm" data-action="vis-delete"  data-id="${v.id}" style="border-radius:20px; padding:4px 10px;" title="Delete"><i class="fa fa-trash" style="color:#ff4757;"></i></button>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = html;
    _initDelegation(container); // ✅ Issue #2: event delegation (CSP-safe)
  }

  /* ─── Modals ─── */
  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-person" style="color:#00d4ff;"></i> ADD VISITOR', formHTML(null));
    setTimeout(_bindModalEvents, 30); // ✅ Issue #2: bind modal buttons after render
  }

  function openEditModal(id) {
    editingId = id;
    const r = SupabaseSync.getById(DB.visitors, id);
    if (!r) return;
    Utils.openModal('<i class="fa fa-pen" style="color:#00d4ff;"></i> EDIT VISITOR', formHTML(r));
    setTimeout(_bindModalEvents, 30); // ✅ Issue #2: bind modal buttons after render
  }

  function formHTML(r) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Visitor Name <span class="req">*</span></label>
          <input type="text" id="vis-name" class="form-control" placeholder="e.g. Shakib" value="${Utils.escAttr(r?.name || '')}" />
        </div>
        <div class="form-group">
          <label>Phone Number <span class="req">*</span></label>
          <input type="text" id="vis-phone" class="form-control" placeholder="017..." value="${Utils.escAttr(r?.phone || '')}" />
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Address</label>
          <input type="text" id="vis-address" class="form-control" placeholder="e.g. Mirpur, Dhaka" value="${Utils.escAttr(r?.address || '')}" />
        </div>
        <div class="form-group">
          <label>Reference <span style="font-size:0.75rem; color:var(--text-muted);">(কিভাবে জানলেন?)</span></label>
          <select id="vis-reference" class="form-control">
            <option value="">-- Select Reference --</option>
            ${REFERENCE_OPTIONS.map(ref => `
              <option value="${ref}" ${r?.reference === ref ? 'selected' : ''}>${ref}</option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Course Interested</label>
          <input type="text" id="vis-course" class="form-control" placeholder="e.g. Ticketing" value="${Utils.escAttr(r?.interested_course || '')}" />
        </div>
        <div class="form-group">
          <label>Status <span class="req">*</span></label>
          <select id="vis-status" class="form-control">
            ${['Interested', 'Enrolled', 'Follow-up', 'Not Interested'].map(s => `
              <option value="${s}" ${r?.status === s ? 'selected' : ''}>${s}</option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Visit Date</label>
          <input type="date" id="vis-vdate" class="form-control" value="${r?.visit_date || Utils.today()}" />
        </div>
        <div class="form-group">
          <label>Follow-up Date</label>
          <input type="date" id="vis-fdate" class="form-control" value="${r?.follow_up_date || ''}" />
        </div>
      </div>

      <div class="form-group full-width">
        <label>Remarks / Notes</label>
        <textarea id="vis-remarks" class="form-control" rows="2" placeholder="Any discussion points...">${Utils.escAttr(r?.remarks || '')}</textarea>
      </div>

      <div class="form-actions" style="justify-content: flex-end; margin-top: 10px;">
        <button class="btn-secondary" data-action="vis-cancel" style="border-radius:24px; padding: 10px 24px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.1); border: none;">CANCEL</button>
        <button class="btn-primary"   data-action="vis-save"   style="border-radius:24px; padding: 10px 24px; font-weight: 700; border:none; color:#fff; background: linear-gradient(135deg, #00d4ff, #7c3aed);">SAVE VISITOR</button>
      </div>
    `;
  }

  function saveRecord() {
    const name = document.getElementById('vis-name')?.value.trim();
    const phone = document.getElementById('vis-phone')?.value.trim();
    
    if (!name || !phone) {
      Utils.toast('Name and phone are required.', 'error');
      return;
    }

    const data = {
      name,
      phone,
      address: document.getElementById('vis-address')?.value.trim() || '',
      reference: document.getElementById('vis-reference')?.value || '',
      interested_course: document.getElementById('vis-course')?.value.trim() || '',
      status: document.getElementById('vis-status')?.value || 'Interested',
      visit_date: document.getElementById('vis-vdate')?.value || Utils.today(),
      follow_up_date: document.getElementById('vis-fdate')?.value || '',
      remarks: document.getElementById('vis-remarks')?.value.trim() || '',
      created_at: new Date().toISOString()
    };

    if (editingId) {
      SupabaseSync.update(DB.visitors, editingId, data);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('edit', 'visitors', 
          `Updated visitor: ${name} (${phone}) - Status: ${data.status}`
        );
      }
      Utils.toast('Visitor updated successfully', 'success');
    } else {
      SupabaseSync.insert(DB.visitors, data);
      if (typeof SupabaseSync.logActivity === 'function') {
        SupabaseSync.logActivity('add', 'visitors', 
          `Added visitor: ${name} (${phone}) - Interested in: ${data.interested_course}`
        );
      }
      Utils.toast('Visitor added successfully', 'success');
    }

    Utils.closeModal();
    render();
  }

  async function deleteRecord(id) {
    const ok = await Utils.confirm('Are you sure you want to delete this visitor?', 'Delete Visitor');
    if (!ok) return;
    const visitorData = SupabaseSync.getById(DB.visitors, id);
    SupabaseSync.remove(DB.visitors, id);
    if (typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('delete', 'visitors', 
        `Deleted visitor: ${visitorData?.name || 'Unknown'} (${visitorData?.phone || 'N/A'})`
      );
    }
    render();
    Utils.toast('Visitor deleted', 'warning');
  }

  function convertToStudent(id) {
    const v = SupabaseSync.getById(DB.visitors, id);
    if (!v) return;
    if (typeof App !== 'undefined' && App.navigateTo) App.navigateTo('students');
    setTimeout(() => {
      if (typeof Students !== 'undefined' && Students.openAddModal) {
        Students.openAddModal();
        setTimeout(() => {
          const n = document.getElementById('sf-name');
          const p = document.getElementById('sf-phone');
          const c = document.getElementById('sf-course');
          if (n) n.value = v.name || '';
          if (p) p.value = v.phone || '';
          if (c) c.value = v.interested_course || '';
          Utils.toast('Visitor data pre-filled into Student form', 'success');
        }, 100);
      }
    }, 200);
  }

  return { init, render, onSearch, openAddModal, openEditModal, saveRecord, deleteRecord, convertToStudent };

})();
window.VisitorsModule = VisitorsModule;
window.Visitors       = VisitorsModule; // ✅ Integrity Guard expects window.Visitors
