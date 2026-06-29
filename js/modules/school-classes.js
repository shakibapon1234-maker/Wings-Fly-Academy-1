/* ============================================================
   AcadeFlow — Class & Section Management (School Mode)
   ============================================================ */

const SchoolClasses = (() => {
  'use strict';

  function render() {
    const el = document.getElementById('school-classes-content');
    if (!el) return;

    if (!window.InstitutionMode || !InstitutionMode.isSchoolLike()) {
      el.innerHTML = `<div class="empty-state" style="text-align:center;padding:60px;color:var(--text-muted)">
        <i class="fa fa-school" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:12px"></i>
        <p>School/College mode-এ এই ফিচার চালু হবে। Settings → Institution Type থেকে School বেছে নিন।</p>
      </div>`;
      return;
    }

    const classes = SchoolEngine.getClasses();
    const classLabel = InstitutionMode.getLabel('course_label');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-primary" onclick="SchoolClasses.openAddModal()">
          <i class="fa fa-plus"></i> ${Utils.esc(classLabel)} যোগ করুন
        </button>
        <span style="color:var(--text-muted);font-size:0.85rem;margin-left:auto">${classes.length} ${Utils.esc(classLabel)}</span>
      </div>
      ${classes.length ? _renderTable(classes, classLabel) : _empty(classLabel)}
    `;
  }

  function _empty(classLabel) {
    return `<div class="empty-state" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa fa-layer-group" style="font-size:2.5rem;opacity:0.3;display:block;margin-bottom:10px"></i>
      <p>কোনো ${Utils.esc(classLabel)} এখনো যোগ করা হয়নি।</p>
    </div>`;
  }

  function _renderTable(classes, classLabel) {
    const sectionLabel = InstitutionMode.getLabel('batch_label');
    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>${Utils.esc(classLabel)}</th>
              <th>${Utils.esc(sectionLabel)}</th>
              <th>Shift</th>
              <th>Class Teacher</th>
              <th style="width:140px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${classes.map(c => {
              const secs = Array.isArray(c.sections) ? c.sections.join(', ') : String(c.sections || '');
              const eid = Utils.escAttr(c.id);
              return `<tr>
                <td><strong>${Utils.esc(c.class_name)}</strong></td>
                <td>${Utils.esc(secs)}</td>
                <td>${Utils.esc(c.shift || '—')}</td>
                <td>${Utils.esc(c.class_teacher || '—')}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="SchoolClasses.openEditModal('${eid}')"><i class="fa fa-pen"></i></button>
                  <button class="btn btn-sm btn-danger" onclick="SchoolClasses.remove('${eid}')"><i class="fa fa-trash"></i></button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function openAddModal() {
    _openFormModal(null);
  }

  function openEditModal(id) {
    const row = SupabaseSync.getById(SchoolEngine.TABLES.classes, id);
    if (!row) return;
    _openFormModal(row);
  }

  function _openFormModal(row) {
    const classLabel = InstitutionMode.getLabel('course_label');
    const sectionLabel = InstitutionMode.getLabel('batch_label');
    const isEdit = !!row;
    const sections = row && Array.isArray(row.sections) ? row.sections.join(', ') : (row?.sections || '');
    const classOptions = SchoolEngine.DEFAULT_CLASSES.map(c =>
      `<option value="${Utils.escAttr(c)}" ${row?.class_name === c ? 'selected' : ''}>${Utils.esc(c)}</option>`
    ).join('');

    Utils.openModal(`<i class="fa fa-layer-group"></i> ${isEdit ? 'Edit' : 'Add'} ${classLabel}`, `
      <div class="form-group">
        <label>${Utils.esc(classLabel)} <span class="req">*</span></label>
        <select id="sc-class-name" class="form-control">
          <option value="">— Select —</option>
          ${classOptions}
        </select>
        <input id="sc-class-custom" class="form-control" style="margin-top:8px" placeholder="অথবা custom ${Utils.esc(classLabel)} লিখুন" value="${Utils.escAttr(row && !SchoolEngine.DEFAULT_CLASSES.includes(row.class_name) ? row.class_name : '')}" />
      </div>
      <div class="form-group">
        <label>${Utils.esc(sectionLabel)} (comma separated) <span class="req">*</span></label>
        <input id="sc-sections" class="form-control" placeholder="A, B, C" value="${Utils.escAttr(sections)}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Shift</label>
          <select id="sc-shift" class="form-control">
            ${['Morning', 'Day', 'Evening'].map(s => `<option ${row?.shift === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Class Teacher</label>
          <input id="sc-teacher" class="form-control" value="${Utils.escAttr(row?.class_teacher || '')}" placeholder="Teacher name" />
        </div>
      </div>
      <div id="sc-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="SchoolClasses.save('${Utils.escAttr(row?.id || '')}')"><i class="fa fa-floppy-disk"></i> Save</button>
      </div>
    `);
  }

  function save(editId) {
    const err = document.getElementById('sc-error');
    const className = Utils.formVal('sc-class-custom') || Utils.formVal('sc-class-name');
    const sections = Utils.formVal('sc-sections');
    if (!className) { err.textContent = 'Class name required'; err.classList.remove('hidden'); return; }
    if (!sections) { err.textContent = 'Section required'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');

    const record = SchoolEngine.saveClass({
      id: editId || undefined,
      class_name: className,
      sections,
      shift: Utils.formVal('sc-shift'),
      class_teacher: Utils.formVal('sc-teacher'),
    });
    SchoolEngine.seedSubjectsForClass(record.class_name);
    Utils.closeModal();
    Utils.toast('✅ Saved successfully', 'success');
    render();
  }

  function remove(id) {
    if (!confirm('Delete this class record?')) return;
    SchoolEngine.removeClass(id);
    Utils.toast('Deleted', 'warning');
    render();
  }

  return { render, openAddModal, openEditModal, save, remove };
})();

window.SchoolClasses = SchoolClasses;
