/* ============================================================
   ROUTINE BUILDER MODULE — Wings Fly Aviation Academy
   Feature 3 | Class Routine Builder
   ------------------------------------------------------------
   Admin creates & manages weekly class routines per batch.
   - Weekly grid view (Sat–Fri × time slots)
   - Teacher conflict detection
   - Batch-wise filtering
   - Print / PDF export
   - Student Portal integration (read-only routine tab)
   ============================================================ */

const RoutineBuilder = (() => {
  'use strict';

  let _activeBatch = '';
  let _viewMode = 'grid'; // 'grid' | 'list'

  // ── Init ───────────────────────────────────────────────────

  function init() {
    _activeBatch = _activeBatch || (RoutineEngine.getBatchList()[0] || '');
    render();
  }

  // ── Render ─────────────────────────────────────────────────

  function render() {
    const container = document.getElementById('routine-builder-content');
    if (!container) return;

    const batches  = RoutineEngine.getBatchList();
    const routines = _activeBatch ? RoutineEngine.getByBatch(_activeBatch) : [];

    container.innerHTML = `
      <div class="rb-toolbar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <label style="font-weight:600;color:var(--text-secondary);font-size:0.87rem;">ব্যাচ:</label>
        <select id="rb-batch-select" class="form-control" style="min-width:160px;max-width:220px;" onchange="RoutineBuilder.onBatchChange(this.value)">
          <option value="">— ব্যাচ নির্বাচন করুন —</option>
          ${batches.map(b => `<option value="${Utils.escAttr(b)}" ${_activeBatch === b ? 'selected' : ''}>${Utils.esc(b)}</option>`).join('')}
        </select>

        <div style="display:flex;gap:6px;margin-left:auto;">
          <button class="btn btn-sm ${_viewMode==='grid'?'btn-primary':'btn-secondary'}" onclick="RoutineBuilder.setView('grid')" title="Grid View">
            <i class="fa fa-table-cells"></i>
          </button>
          <button class="btn btn-sm ${_viewMode==='list'?'btn-primary':'btn-secondary'}" onclick="RoutineBuilder.setView('list')" title="List View">
            <i class="fa fa-list"></i>
          </button>
          <button class="btn btn-sm btn-secondary" style="background:#0ea5e9;color:#fff;border-color:#0ea5e9;" onclick="RoutineBuilder.openImportModal()" title="Import JSON / HTML">
            <i class="fa fa-upload"></i> Import
          </button>
          <button class="btn btn-sm btn-secondary" onclick="RoutineBuilder.printRoutine()" title="Print">
            <i class="fa fa-print"></i> Print
          </button>
          <button class="btn btn-sm btn-primary" onclick="RoutineBuilder.openAddModal()">
            <i class="fa fa-plus"></i> যোগ করুন
          </button>
        </div>
      </div>

      ${!_activeBatch
        ? `<div class="empty-state" style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
             <i class="fa fa-calendar-week" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:12px;"></i>
             <p>রুটিন দেখতে একটি ব্যাচ নির্বাচন করুন।</p>
           </div>`
        : _viewMode === 'grid'
          ? _renderGrid(routines)
          : _renderList(routines)
      }
    `;

    _initDelegation(container);
  }

  // ── Grid View ──────────────────────────────────────────────

  function _renderGrid(routines) {
    const DAYS = RoutineEngine.DAYS;
    const DAY_LABELS = RoutineEngine.DAY_LABELS;

    if (!routines.length) {
      return `<div class="empty-state" style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <i class="fa fa-calendar-xmark" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:12px;"></i>
        <p><strong>${Utils.esc(_activeBatch)}</strong> ব্যাচের কোনো রুটিন নেই।</p>
        <button class="btn btn-primary" onclick="RoutineBuilder.openAddModal()" style="margin-top:12px;">
          <i class="fa fa-plus"></i> প্রথম ক্লাস যোগ করুন
        </button>
      </div>`;
    }

    // Sort by time for each day
    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });
    routines.forEach(r => {
      if (byDay[r.day]) byDay[r.day].push(r);
    });
    DAYS.forEach(d => {
      byDay[d].sort((a, b) => {
        const timeCompare = (a.start_time || '').localeCompare(b.start_time || '');
        if (timeCompare !== 0) return timeCompare;
        return (a.subject || '').localeCompare(b.subject || '');
      });
    });

    const activeDays = DAYS.filter(d => byDay[d].length > 0);

    return `
      <div class="rb-grid-wrapper" style="overflow-x:auto;">
        <div id="rb-print-area">
          <div style="display:none" id="rb-print-header">
            <h2 style="margin:0 0 4px;font-size:1.2rem;">Wings Fly Academy</h2>
            <p style="margin:0;font-size:0.9rem;color:#555;">Class Routine — Batch: ${Utils.esc(_activeBatch)}</p>
            <hr style="margin:8px 0;">
          </div>
          <table class="rb-grid-table" style="width:100%;border-collapse:collapse;min-width:560px;">
            <thead>
              <tr>
                ${activeDays.map(d => `
                  <th style="background:var(--brand-primary);color:#fff;padding:10px 8px;text-align:center;font-size:0.85rem;border:1px solid rgba(255,255,255,0.15);">
                    ${Utils.esc(d)}<br><small style="opacity:0.8;font-weight:400;">${Utils.esc(DAY_LABELS[d])}</small>
                  </th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr style="vertical-align:top;">
                ${activeDays.map(d => `
                  <td style="padding:6px;border:1px solid var(--border-color);min-width:140px;">
                    ${byDay[d].map(r => _slotCard(r)).join('')}
                  </td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _slotCard(r) {
    const teacher = RoutineEngine.getTeacherName(r.teacher_id);
    return `
      <div class="rb-slot-card" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border-color);border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:pointer;"
           onclick="RoutineBuilder.openEditModal('${Utils.escAttr(r.id)}')">
        <div style="font-size:0.78rem;color:var(--brand-primary);font-weight:600;">
          ${Utils.esc(RoutineEngine.formatTime(r.start_time))} – ${Utils.esc(RoutineEngine.formatTime(r.end_time))}
        </div>
        <div style="font-weight:600;font-size:0.88rem;margin:2px 0;">${Utils.esc(r.subject || '—')}</div>
        ${teacher && teacher !== '—' ? `<div style="font-size:0.78rem;color:var(--text-secondary);"><i class="fa fa-user-tie" style="margin-right:4px;"></i>${Utils.esc(teacher)}</div>` : ''}
        ${r.room ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;"><i class="fa fa-door-open" style="margin-right:4px;"></i>${Utils.esc(r.room)}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <button class="btn btn-sm" style="padding:2px 8px;font-size:0.72rem;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;"
                  onclick="event.stopPropagation(); RoutineBuilder.openEditModal('${Utils.escAttr(r.id)}')">
            <i class="fa fa-edit" style="margin-right:3px;"></i> এডিট
          </button>
          <button class="btn btn-sm btn-danger" style="padding:2px 8px;font-size:0.72rem;" data-action="rb-delete" data-id="${Utils.escAttr(r.id)}"
                  onclick="event.stopPropagation()">
            <i class="fa fa-trash"></i> মুছুন
          </button>
        </div>
      </div>
    `;
  }

  // ── List View ──────────────────────────────────────────────

  function _renderList(routines) {
    if (!routines.length) {
      return `<div class="empty-state" style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <p>এই ব্যাচের কোনো রুটিন নেই।</p>
        <button class="btn btn-primary" onclick="RoutineBuilder.openAddModal()" style="margin-top:12px;">
          <i class="fa fa-plus"></i> প্রথম ক্লাস যোগ করুন
        </button>
      </div>`;
    }

    const sorted = [...routines].sort((a, b) => {
      const di = RoutineEngine.DAYS.indexOf(a.day) - RoutineEngine.DAYS.indexOf(b.day);
      if (di !== 0) return di;
      const timeCompare = (a.start_time || '').localeCompare(b.start_time || '');
      if (timeCompare !== 0) return timeCompare;
      return (a.subject || '').localeCompare(b.subject || '');
    });

    return `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th>দিন</th><th>সময়</th><th>বিষয়</th><th>শিক্ষক</th><th>রুম</th><th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(r => `
              <tr>
                <td><span class="badge badge-blue">${Utils.esc(r.day)}</span></td>
                <td style="white-space:nowrap;">${Utils.esc(RoutineEngine.formatTime(r.start_time))} – ${Utils.esc(RoutineEngine.formatTime(r.end_time))}</td>
                <td>${Utils.esc(r.subject || '—')}</td>
                <td>${Utils.esc(RoutineEngine.getTeacherName(r.teacher_id))}</td>
                <td>${Utils.esc(r.room || '—')}</td>
                <td style="text-align:center;white-space:nowrap;">
                  <button class="btn btn-sm btn-secondary" onclick="RoutineBuilder.openEditModal('${Utils.escAttr(r.id)}')">
                    <i class="fa fa-pen"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" data-action="rb-delete" data-id="${Utils.escAttr(r.id)}">
                    <i class="fa fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Event Delegation ───────────────────────────────────────

  function _initDelegation(container) {
    if (container._rbDelegated) return;
    container._rbDelegated = true;
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'rb-delete') {
        e.preventDefault();
        _confirmDelete(btn.dataset.id);
      }
    });
  }

  function _confirmDelete(id) {
    if (!id) return;
    const all = RoutineEngine.getAllIncludingInactive();
    const r = all.find(x => x.id === id);
    const label = r ? `${r.day} ${RoutineEngine.formatTime(r.start_time)} — ${r.subject || ''}` : id;
    Utils.confirm(`"${label}" রুটিন মুছে ফেলবেন?`, () => {
      RoutineEngine.remove(id);
      Utils.toast('রুটিন মুছে ফেলা হয়েছে।', 'success');
      render();
    });
  }

  // ── Add / Edit Modal ───────────────────────────────────────

  function openAddModal() {
    _openFormModal(null);
  }

  function openEditModal(id) {
    const all = RoutineEngine.getAllIncludingInactive();
    const r = all.find(x => x.id === id);
    if (!r) { Utils.toast('রেকর্ড পাওয়া যায়নি।', 'error'); return; }
    _openFormModal(r);
  }

  function _openFormModal(entry) {
    const isEdit = Boolean(entry);
    const batches  = RoutineEngine.getBatchList();
    const teachers = RoutineEngine.getTeacherList();
    const DAYS     = RoutineEngine.DAYS;
    const DAY_LABELS = RoutineEngine.DAY_LABELS;

    const formHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">ব্যাচ <span style="color:red">*</span></label>
          <select id="rb-f-batch" class="form-control">
            <option value="">— নির্বাচন করুন —</option>
            ${batches.map(b => `<option value="${Utils.escAttr(b)}" ${(entry?.batch_id||_activeBatch)===b?'selected':''}>${Utils.esc(b)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">দিন <span style="color:red">*</span></label>
          <select id="rb-f-day" class="form-control">
            <option value="">— নির্বাচন করুন —</option>
            ${DAYS.map(d => `<option value="${d}" ${entry?.day===d?'selected':''}>${d} (${DAY_LABELS[d]})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">বিষয় / Subject</label>
          <input id="rb-f-subject" class="form-control" placeholder="e.g. Theory of Flight" value="${Utils.escAttr(entry?.subject||'')}">
        </div>

        <div class="form-group">
          <label class="form-label">শুরু (Start Time) <span style="color:red">*</span></label>
          <input id="rb-f-start" class="form-control" type="time" value="${Utils.escAttr(entry?.start_time||'')}">
        </div>

        <div class="form-group">
          <label class="form-label">শেষ (End Time) <span style="color:red">*</span></label>
          <input id="rb-f-end" class="form-control" type="time" value="${Utils.escAttr(entry?.end_time||'')}">
        </div>

        <div class="form-group">
          <label class="form-label">শিক্ষক / Teacher</label>
          <select id="rb-f-teacher" class="form-control">
            <option value="">— নির্বাচন করুন —</option>
            ${teachers.map(t => `<option value="${Utils.escAttr(t.id)}" ${entry?.teacher_id===t.id?'selected':''}>${Utils.esc(t.name)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">রুম / Room</label>
          <input id="rb-f-room" class="form-control" placeholder="e.g. Room 101" value="${Utils.escAttr(entry?.room||'')}">
        </div>

      </div>

      <div id="rb-conflict-warning" style="display:none;margin-top:12px;padding:10px 14px;background:rgba(255,160,0,0.15);border:1px solid rgba(255,160,0,0.4);border-radius:8px;color:var(--warning,#f59e0b);font-size:0.85rem;">
        <i class="fa fa-triangle-exclamation"></i> <strong>Teacher Conflict!</strong>
        <div id="rb-conflict-detail" style="margin-top:4px;font-size:0.8rem;"></div>
      </div>

      <div id="rb-f-error" class="form-error" style="display:none;margin-top:8px;color:red;font-size:0.85rem;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn btn-primary" onclick="RoutineBuilder._saveForm('${isEdit ? Utils.escAttr(entry.id) : ''}')">
          <i class="fa fa-save"></i> ${isEdit ? 'আপডেট' : 'সেভ'} করুন
        </button>
      </div>
    `;

    const title = `<i class="fa fa-calendar-week" style="color:var(--brand-primary)"></i> ${isEdit ? 'রুটিন সম্পাদনা' : 'নতুন ক্লাস যোগ'}`;
    Utils.openModal(title, formHTML);

    // Live conflict check on time/teacher/day change
    ['rb-f-teacher', 'rb-f-day', 'rb-f-start', 'rb-f-end'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => _liveConflictCheck(isEdit ? entry.id : null));
    });
  }

  function _liveConflictCheck(excludeId) {
    const teacher_id  = Utils.formVal('rb-f-teacher');
    const day         = Utils.formVal('rb-f-day');
    const start_time  = Utils.formVal('rb-f-start');
    const end_time    = Utils.formVal('rb-f-end');
    const warning     = document.getElementById('rb-conflict-warning');
    const detail      = document.getElementById('rb-conflict-detail');
    if (!warning) return;

    if (!teacher_id || !day || !start_time || !end_time) {
      warning.style.display = 'none';
      return;
    }

    const conflicts = RoutineEngine.checkConflict({ teacher_id, day, start_time, end_time, excludeId });
    if (conflicts.length) {
      warning.style.display = 'block';
      detail.innerHTML = conflicts.map(c =>
        `Batch <strong>${Utils.esc(c.batch_id)}</strong>: ${Utils.esc(RoutineEngine.formatTime(c.start_time))}–${Utils.esc(RoutineEngine.formatTime(c.end_time))} (${Utils.esc(c.subject||'—')})`
      ).join('<br>');
    } else {
      warning.style.display = 'none';
    }
  }

  function _saveForm(editId) {
    const errEl = document.getElementById('rb-f-error');
    const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };

    const batch_id   = Utils.formVal('rb-f-batch');
    const day        = Utils.formVal('rb-f-day');
    const start_time = Utils.formVal('rb-f-start');
    const end_time   = Utils.formVal('rb-f-end');
    const subject    = Utils.formVal('rb-f-subject');
    const teacher_id = Utils.formVal('rb-f-teacher');
    const room       = Utils.formVal('rb-f-room');

    if (!batch_id)   return showErr('ব্যাচ নির্বাচন করুন।');
    if (!day)        return showErr('দিন নির্বাচন করুন।');
    if (!start_time) return showErr('শুরুর সময় দিন।');
    if (!end_time)   return showErr('শেষের সময় দিন।');
    if (start_time >= end_time) return showErr('শেষের সময় শুরুর সময়ের পরে হতে হবে।');

    const entry = { batch_id, day, start_time, end_time, subject, teacher_id, room };
    if (editId) entry.id = editId;

    try {
      RoutineEngine.save(entry);
    } catch (e) {
      return showErr('সেভ করতে সমস্যা হয়েছে: ' + (e.message || e));
    }

    Utils.closeModal();
    Utils.toast(editId ? 'রুটিন আপডেট হয়েছে।' : 'রুটিন যোগ হয়েছে।', 'success');
    _activeBatch = batch_id;
    render();
  }

  // ── Print / PDF ────────────────────────────────────────────

  function printRoutine() {
    const area = document.getElementById('rb-print-area');
    if (!area) return;

    // Show print header temporarily
    const hdr = document.getElementById('rb-print-header');
    if (hdr) hdr.style.display = 'block';

    const printContent = area.innerHTML;
    if (hdr) hdr.style.display = 'none';

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { Utils.toast('Popup blocked! Please allow popups.', 'error'); return; }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Class Routine — ${Utils.esc(_activeBatch)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
          h2 { margin: 0 0 4px; }
          p { margin: 0; color: #555; }
          hr { border: none; border-top: 1px solid #ccc; margin: 8px 0 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1a5fa8; color: #fff; padding: 10px 8px; text-align: center; border: 1px solid #ddd; font-size: 0.85rem; }
          td { padding: 6px; border: 1px solid #ddd; vertical-align: top; min-width: 120px; }
          .rb-slot-card { background: #f0f4ff; border: 1px solid #c5d5f5; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; }
          .rb-slot-card div:first-child { font-size: 0.75rem; color: #1a5fa8; font-weight: 600; }
          button { display: none !important; }
          #rb-print-header { display: block !important; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>window.onload = function(){ window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ── Import / Upload Routine ───────────────────────────────

  function openImportModal() {
    const batches = RoutineEngine.getBatchList();
    const importHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">রুটিন ফাইল আপলোড করুন (.json, .html) <span style="color:red">*</span></label>
          <input type="file" id="rb-import-file" class="form-control" accept=".json,.html" style="padding:6px 12px;" onchange="RoutineBuilder.onImportFileChange(this)">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:600;">টার্গেট ব্যাচ <span style="color:red">*</span></label>
          <select id="rb-import-batch" class="form-control">
            <option value="">— ফাইল থেকে অটো-ডিটেক্ট করুন —</option>
            ${batches.map(b => `<option value="${Utils.escAttr(b)}" ${_activeBatch===b?'selected':''}>${Utils.esc(b)}</option>`).join('')}
          </select>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;">
            ফাইলে যদি ব্যাচ উল্লেখ থাকে তবে সেটি স্বয়ংক্রিয়ভাবে ডিটেক্ট করা হবে।
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:600;">ইম্পোর্ট মোড</label>
          <div style="display:flex;gap:16px;margin-top:6px;">
            <label style="cursor:pointer;font-size:0.87rem;">
              <input type="radio" name="rb-import-mode" value="merge" checked style="margin-right:6px;"> Merge (নতুন ক্লাস যুক্ত করুন)
            </label>
            <label style="cursor:pointer;font-size:0.87rem;">
              <input type="radio" name="rb-import-mode" value="replace" style="margin-right:6px;"> Replace (ব্যাচের বর্তমান রুটিন মুছে দিন)
            </label>
          </div>
        </div>

        <div id="rb-import-preview-box" style="display:none;background:rgba(255,255,255,0.04);border:1px solid var(--border-color);border-radius:8px;padding:12px 14px;">
          <h4 style="margin:0 0 6px;font-size:0.85rem;color:var(--brand-primary);"><i class="fa fa-magnifying-glass-chart"></i> ফাইলের তথ্য:</h4>
          <div style="font-size:0.8rem;line-height:1.5;" id="rb-import-preview-details"></div>
        </div>

        <div id="rb-import-conflict-warning" style="display:none;padding:10px 14px;background:rgba(255,160,0,0.15);border:1px solid rgba(255,160,0,0.4);border-radius:8px;color:var(--warning,#f59e0b);font-size:0.85rem;">
          <i class="fa fa-triangle-exclamation"></i> <strong>শিক্ষক শিডিউল দ্বন্দ্ব (Conflict)!</strong>
          <div id="rb-import-conflict-detail" style="margin-top:4px;font-size:0.8rem;max-height:80px;overflow-y:auto;"></div>
        </div>

        <div id="rb-import-error" class="form-error" style="display:none;color:red;font-size:0.85rem;"></div>

        <div style="font-size:0.82rem;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);padding:10px;border-radius:6px;color:#e0f2fe;">
          <i class="fa fa-circle-question" style="color:#38bdf8;margin-right:4px;"></i> রুটিন PDF বা ইমেজ থেকে কনভার্ট করতে চান? 
          <a href="routine-converter.html" target="_blank" style="color:var(--brand-primary);text-decoration:underline;font-weight:600;">রুটিন কনভার্টার টুল ব্যবহার করুন</a>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn btn-primary" id="rb-import-btn" disabled onclick="RoutineBuilder.executeImport()">
          <i class="fa fa-upload"></i> ইম্পোর্ট করুন
        </button>
      </div>
    `;

    Utils.openModal('<i class="fa fa-upload" style="color:var(--brand-primary)"></i> রুটিন ইম্পোর্ট করুন', importHTML);
    window._importedData = null;
  }

  function onImportFileChange(input) {
    const file = input.files[0];
    const previewBox = document.getElementById('rb-import-preview-box');
    const previewDetails = document.getElementById('rb-import-preview-details');
    const importBtn = document.getElementById('rb-import-btn');
    const errEl = document.getElementById('rb-import-error');

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (previewBox) previewBox.style.display = 'none';
    if (importBtn) importBtn.disabled = true;

    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target.result;
        let list = null;
        let fileType = '';

        if (file.name.endsWith('.html') || file.type === 'text/html') {
          fileType = 'HTML';
          const doc = new DOMParser().parseFromString(content, 'text/html');
          const scriptEl = doc.getElementById('wfa-routine-data');
          if (!scriptEl) {
            throw new Error('এই HTML ফাইলে কোনো ইম্পোর্টযোগ্য রুটিন ডেটা পাওয়া যায়নি। অনুগ্রহ করে রুটিন কনভার্টার থেকে জেনারেট করা HTML ব্যবহার করুন।');
          }
          list = JSON.parse(scriptEl.textContent);
        } else {
          fileType = 'JSON';
          list = JSON.parse(content);
        }

        if (!Array.isArray(list)) {
          throw new Error('রুটিন ডেটা সঠিক নয়। ক্লাস লিস্টের একটি অ্যারে (Array) হতে হবে।');
        }

        if (list.length === 0) {
          throw new Error('ফাইলের ভেতর কোনো ক্লাস পাওয়া যায়নি।');
        }

        const detectedBatch = list[0].batch_id || '';
        const batchSelect = document.getElementById('rb-import-batch');
        if (detectedBatch && batchSelect) {
          let found = false;
          for (let i = 0; i < batchSelect.options.length; i++) {
            if (batchSelect.options[i].value === detectedBatch) {
              batchSelect.selectedIndex = i;
              found = true;
              break;
            }
          }
          if (!found) {
            const opt = document.createElement('option');
            opt.value = detectedBatch;
            opt.textContent = detectedBatch + ' (New)';
            opt.selected = true;
            batchSelect.appendChild(opt);
          }
        }

        window._importedData = list;

        if (previewBox && previewDetails) {
          previewBox.style.display = 'block';
          previewDetails.innerHTML = `
            ফাইল টাইপ: <strong>${fileType}</strong><br>
            মোট ক্লাস সংখ্যা: <strong>${list.length}টি</strong><br>
            ডিটেক্ট করা ব্যাচ: <strong>${Utils.esc(detectedBatch || '—')}</strong>
          `;
        }

        if (importBtn) importBtn.disabled = false;
        _checkImportConflicts(list);
      } catch (err) {
        if (errEl) {
          errEl.textContent = 'ত্রুটি: ' + err.message;
          errEl.style.display = 'block';
        }
      }
    };
    reader.readAsText(file);
  }

  function _checkImportConflicts(list) {
    const warning = document.getElementById('rb-import-conflict-warning');
    const detail = document.getElementById('rb-import-conflict-detail');
    if (!warning || !detail) return;

    warning.style.display = 'none';

    const staffList = RoutineEngine.getTeacherList();
    const conflicts = [];

    list.forEach(slot => {
      let teacher_id = slot.teacher_id || '';
      if (teacher_id) {
        const resolved = staffList.find(s => 
          String(s.name).toLowerCase().trim() === String(teacher_id).toLowerCase().trim() ||
          String(s.id).toLowerCase().trim() === String(teacher_id).toLowerCase().trim()
        );
        if (resolved) teacher_id = resolved.id;
      }

      let day = slot.day;
      const DAY_MAP = {
        'sat': 'Sat', 'saturday': 'Sat', 'শনি': 'Sat', 'শনিবার': 'Sat',
        'sun': 'Sun', 'sunday': 'Sun', 'রবি': 'Sun', 'রবিবার': 'Sun',
        'mon': 'Mon', 'monday': 'Mon', 'সোম': 'Mon', 'সোমবার': 'Mon',
        'tue': 'Tue', 'tuesday': 'Tue', 'মঙ্গল': 'Tue', 'মঙ্গলবার': 'Tue',
        'wed': 'Wed', 'wednesday': 'Wed', 'বুধ': 'Wed', 'বুধবার': 'Wed',
        'thu': 'Thu', 'thursday': 'Thu', 'বৃহস্পতি': 'Thu', 'বৃহস্পতিবার': 'Thu',
        'fri': 'Fri', 'friday': 'Fri', 'শুক্র': 'Fri', 'শুক্রবার': 'Fri'
      };
      if (day && DAY_MAP[String(day).toLowerCase()]) {
        day = DAY_MAP[String(day).toLowerCase()];
      }

      const overlaps = RoutineEngine.checkConflict({
        teacher_id,
        day,
        start_time: slot.start_time,
        end_time: slot.end_time
      });

      if (overlaps.length) {
        overlaps.forEach(c => {
          conflicts.push(`শিক্ষক: <strong>${Utils.esc(RoutineEngine.getTeacherName(teacher_id))}</strong> (${Utils.esc(day)} ${RoutineEngine.formatTime(slot.start_time)}–${RoutineEngine.formatTime(slot.end_time)}) — Batch: ${Utils.esc(c.batch_id)} এর সাথে ওভারল্যাপ করছে।`);
        });
      }
    });

    if (conflicts.length) {
      warning.style.display = 'block';
      detail.innerHTML = conflicts.join('<br>');
    }
  }

  function executeImport() {
    const list = window._importedData;
    const errEl = document.getElementById('rb-import-error');
    if (!list) {
      if (errEl) { errEl.textContent = 'কোনো ডেটা পাওয়া যায়নি।'; errEl.style.display = 'block'; }
      return;
    }

    const batchSelect = document.getElementById('rb-import-batch');
    const batchId = batchSelect ? batchSelect.value : '';
    if (!batchId) {
      if (errEl) { errEl.textContent = 'অনুগ্রহ করে টার্কেট ব্যাচ নির্বাচন করুন।'; errEl.style.display = 'block'; }
      return;
    }

    const importMode = document.querySelector('input[name="rb-import-mode"]:checked').value;

    try {
      if (importMode === 'replace') {
        const existing = RoutineEngine.getByBatch(batchId);
        existing.forEach(r => {
          RoutineEngine.remove(r.id);
        });
      }

      const staffList = RoutineEngine.getTeacherList();
      const DAY_MAP = {
        'sat': 'Sat', 'saturday': 'Sat', 'শনি': 'Sat', 'শনিবার': 'Sat',
        'sun': 'Sun', 'sunday': 'Sun', 'রবি': 'Sun', 'রবিবার': 'Sun',
        'mon': 'Mon', 'monday': 'Mon', 'সোম': 'Mon', 'সোমবার': 'Mon',
        'tue': 'Tue', 'tuesday': 'Tue', 'মঙ্গল': 'Tue', 'মঙ্গলবার': 'Tue',
        'wed': 'Wed', 'wednesday': 'Wed', 'বুধ': 'Wed', 'বুধবার': 'Wed',
        'thu': 'Thu', 'thursday': 'Thu', 'বৃহস্পতি': 'Thu', 'বৃহস্পতিবার': 'Thu',
        'fri': 'Fri', 'friday': 'Fri', 'শুক্র': 'Fri', 'শুক্রবার': 'Fri'
      };

      list.forEach(slot => {
        let teacher_id = slot.teacher_id || '';
        if (teacher_id) {
          const resolved = staffList.find(s => 
            String(s.name).toLowerCase().trim() === String(teacher_id).toLowerCase().trim() ||
            String(s.id).toLowerCase().trim() === String(teacher_id).toLowerCase().trim()
          );
          if (resolved) teacher_id = resolved.id;
        }

        let day = slot.day;
        if (day && DAY_MAP[String(day).toLowerCase()]) {
          day = DAY_MAP[String(day).toLowerCase()];
        }
        if (!RoutineEngine.DAYS.includes(day)) {
          day = 'Sat';
        }

        RoutineEngine.save({
          batch_id: batchId,
          day: day,
          start_time: slot.start_time,
          end_time: slot.end_time,
          subject: slot.subject || 'Routine Class',
          teacher_id: teacher_id,
          room: slot.room || ''
        });
      });

      Utils.closeModal();
      Utils.toast(`${list.length}টি ক্লাস সফলভাবে ইম্পোর্ট করা হয়েছে!`, 'success');
      
      _activeBatch = batchId;
      render();
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'ইম্পোর্ট করতে সমস্যা হয়েছে: ' + (e.message || e);
        errEl.style.display = 'block';
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────

  function onBatchChange(val) {
    _activeBatch = val;
    render();
  }

  function setView(mode) {
    _viewMode = mode;
    render();
  }

  return {
    init,
    render,
    onBatchChange,
    setView,
    openAddModal,
    openEditModal,
    printRoutine,
    _saveForm,
    openImportModal,
    onImportFileChange,
    executeImport,
  };
})();

window.RoutineBuilder = RoutineBuilder;
