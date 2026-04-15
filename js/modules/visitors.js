/* ============================================================
   VISITORS MODULE — Wings Fly Aviation Academy
   Phase 11 | Visitor Tracking (Nebula & Aurora UI)
   ============================================================ */

const VisitorsModule = (() => {

  let editingId = null;

  function init() {
    render();
  }

  function getRecords() {
    return Utils.sortBy(SupabaseSync.getAll(DB.visitors), 'visit_date', 'desc');
  }

  function render() {
    const container = document.getElementById('visitors-content');
    if (!container) return; // Silent return if not rendered

    const visitors = getRecords();

    // Stats
    const total = visitors.length;
    const enrolled = visitors.filter(v => v.status === 'Enrolled').length;
    const interested = visitors.filter(v => v.status === 'Interested').length;
    const followup = visitors.filter(v => v.status === 'Follow-up').length;

    let html = `
      <!-- Stats Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
        <div style="border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">TOTAL VISITORS</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00d4ff;">${total}</div>
        </div>
        <div style="border:1px solid rgba(0,255,136,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#00ff88; text-transform:uppercase; font-weight:700; margin-bottom:8px;">ENROLLED (CONVERTED)</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00ff88;">${enrolled}</div>
        </div>
        <div style="border:1px solid rgba(255,170,0,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#ffb703; text-transform:uppercase; font-weight:700; margin-bottom:8px;">INTERESTED</div>
          <div style="font-size:1.6rem; font-weight:800; color:#ffb703;">${interested}</div>
        </div>
        <div style="border:1px solid rgba(255,71,87,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#ff4757; text-transform:uppercase; font-weight:700; margin-bottom:8px;">FOLLOW-UP</div>
          <div style="font-size:1.6rem; font-weight:800; color:#ff4757;">${followup}</div>
        </div>
      </div>
    `;

    if (!visitors.length) {
      html += `<div style="text-align:center; padding:60px 20px; background:var(--bg-secondary); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
                <i class="fa fa-person-walking-arrow-right" style="font-size:3.5rem; margin-bottom:16px; opacity:0.3; display:block; color:var(--brand-primary);"></i>
                <div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No Visitors Yet</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Start adding visitors using the "ADD NEW" button on the top right.</div>
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
                  <td style="font-weight:600; color:#00d4ff;">${v.interested_course || '-'}</td>
                  <td>${statusBadge}</td>
                  <td><span style="font-size:0.8rem; color:${v.follow_up_date ? '#ffb703' : 'var(--text-muted)'}">${v.follow_up_date ? '<i class="fa fa-clock"></i> ' + Utils.formatDateEN(v.follow_up_date) : '-'}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn-secondary btn-sm" style="border-radius:20px; padding:4px 12px; background:linear-gradient(90deg, #b224ef, #7579ff); color:#fff; border:none;" onclick="VisitorsModule.convertToStudent('${v.id}')" title="Convert to Student"><i class="fa fa-user-graduate"></i> Convert</button>
                    <button class="btn btn-secondary btn-sm" style="border-radius:20px; padding:4px 12px;" onclick="VisitorsModule.openEditModal('${v.id}')"><i class="fa fa-pen"></i> Edit</button>
                    <button class="btn btn-secondary btn-sm" style="border-radius:20px; padding:4px 10px;" onclick="VisitorsModule.deleteRecord('${v.id}')" title="Delete"><i class="fa fa-trash" style="color:#ff4757;"></i></button>
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
  }

  /* ─── Modals ─── */
  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-person" style="color:#00d4ff;"></i> ADD VISITOR', formHTML(null));
  }

  function openEditModal(id) {
    editingId = id;
    const r = SupabaseSync.getById(DB.visitors, id);
    if (!r) return;
    Utils.openModal('<i class="fa fa-pen" style="color:#00d4ff;"></i> EDIT VISITOR', formHTML(r));
  }

  function formHTML(r) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Visitor Name <span class="req">*</span></label>
          <input type="text" id="vis-name" class="form-control" placeholder="e.g. Shakib" value="${r?.name || ''}" />
        </div>
        <div class="form-group">
          <label>Phone Number <span class="req">*</span></label>
          <input type="text" id="vis-phone" class="form-control" placeholder="017..." value="${r?.phone || ''}" />
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Course Interested</label>
          <input type="text" id="vis-course" class="form-control" placeholder="e.g. Ticketing" value="${r?.interested_course || ''}" />
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
        <textarea id="vis-remarks" class="form-control" rows="2" placeholder="Any discussion points...">${r?.remarks || ''}</textarea>
      </div>

      <div class="form-actions" style="justify-content: flex-end; margin-top: 10px;">
        <button class="btn-secondary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.1); border: none;" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-primary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; border:none; color:#fff; background: linear-gradient(135deg, #00d4ff, #7c3aed);" onclick="VisitorsModule.saveRecord()">SAVE VISITOR</button>
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
      interested_course: document.getElementById('vis-course')?.value.trim() || '',
      status: document.getElementById('vis-status')?.value || 'Interested',
      visit_date: document.getElementById('vis-vdate')?.value || Utils.today(),
      follow_up_date: document.getElementById('vis-fdate')?.value || '',
      remarks: document.getElementById('vis-remarks')?.value.trim() || '',
      createdAt: new Date().toISOString()
    };

    if (editingId) {
      SupabaseSync.update(DB.visitors, editingId, data);
      Utils.toast('Visitor updated successfully', 'success');
    } else {
      SupabaseSync.insert(DB.visitors, data);
      Utils.toast('Visitor added successfully', 'success');
    }

    Utils.closeModal();
    render();
  }

  async function deleteRecord(id) {
    const ok = await Utils.confirm('Are you sure you want to delete this visitor?', 'Delete Visitor');
    if (!ok) return;
    SupabaseSync.remove(DB.visitors, id);
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

  return { init, render, openAddModal, openEditModal, saveRecord, deleteRecord, convertToStudent };

})();
window.Visitors = VisitorsModule;
window.VisitorsModule = VisitorsModule;
