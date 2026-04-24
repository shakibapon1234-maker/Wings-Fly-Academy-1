// ============================================================
// id-cards.js — ID Card Generator Module
// Wings Fly Aviation Academy (Legacy Design Restoration)
// ============================================================

const IDCardsModule = (() => {

  // ── Build Card HTML (Original Absolute-Position Layout) ──────────
  function buildCardHTML(person, type = 'student') {
    const isStudent  = type === 'student';
    const idNumber   = person.studentId || person.employeeId || person.id || 'N/A';
    const nameStr    = (person.name || 'N/A').toUpperCase();

    const enrollDate = new Date(person.admissionDate || person.enrollDate || Date.now());
    const expiryDate = new Date(enrollDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const fmtDate = (d) => d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // Photo
    const _rawPhoto   = person.photo || '';
    const _safePhoto  = /^(https?:\/\/|data:image\/)/i.test(_rawPhoto) ? _rawPhoto : '';
    const photoHTML = _safePhoto
      ? `<img src="${_safePhoto}" class="id-photo" onerror="this.style.display='none'">`
      : `<div class="id-photo" style="display:flex;align-items:center;justify-content:center;background:#eee;color:#999;font-size:12px;">No Photo</div>`;

    return `<div class="id-card-v2-container">
      <img src="assets/logo.jpg" style="position:absolute; top:8px; right:8px; width:45px; height:45px; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.3); z-index:5;" onerror="this.style.display='none'">
      ${photoHTML}
      <div class="id-name">${Utils.esc(nameStr)}</div>
      
      <div class="id-info">
        <div><span>ID NO</span> <span>${Utils.esc(idNumber)}</span></div>
        <div><span>COURSE</span> <span style="font-size:8px;max-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Utils.esc(person.course || 'N/A')}">${Utils.esc((person.course || 'N/A').substring(0, 15))}</span></div>
        <div><span>BATCH</span> <span>${Utils.esc(person.batch || 'N/A')}</span></div>
        <div><span>BLOOD G.</span> <span>${Utils.esc(person.bloodGroup || 'N/A')}</span></div>
        <div><span>JOINED</span> <span>${fmtDate(enrollDate)}</span></div>
      </div>
      
      <!-- QR code placeholder (Optional, if they had a QR in the blank image we might not need this, but good to have) -->
      ${isStudent ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(idNumber)}" class="id-qr">` : ''}
    </div>`;
  }


  // ── Render Preview ────────────────────────────────────────
  function renderPreview(containerId, person, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildCardHTML(person, type);
  }

  // ── Print Single Card ─────────────────────────────────────
  function printCard(person, type) {
    const html = buildCardHTML(person, type);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card - ${Utils.esc(person.name)}</title>
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A6 portrait;margin:0;}}</style>
    </head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
    win.document.close();
  }

  // ── Bulk Print ────────────────────────────────────────────
  function printBulk(persons, type) {
    const cards = persons.map(p => buildCardHTML(p, type)).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>ID Cards — Bulk Print</title>
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;padding:20px;background:#eee;display:flex;flex-wrap:wrap;gap:20px;justify-content:center;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4;margin:10mm;}}</style>
    </head><body>${cards}<script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
    win.document.close();
  }

  // ── Render full section UI ─────────────────────────────────
  function render() {
    const container = document.getElementById('id-cards-content');
    if (!container) return;

    const students = SupabaseSync.getAll(DB.students) || [];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="text" id="idcard-search" placeholder="🔍 Search student..." 
            style="padding:8px 14px; border-radius:8px; border:1px solid var(--border); background:var(--card-bg); color:var(--text); min-width:220px;"
            oninput="IDCardsModule.render()">
        </div>
        <button class="btn btn-primary" onclick="IDCardsModule.printAllStudents()">
          <i class="fa fa-print"></i> Print All ID Cards
        </button>
      </div>

      <div id="idcard-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
        ${students.length === 0 ? '<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">No students found. Add students first.</div>' : ''}
        ${filterStudents(students).map(s => `
          <div style="background:linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.08));
            border-radius:14px; padding:14px;
            border:1px solid rgba(6,182,212,0.2);
            transition:all 0.3s; position:relative; overflow:hidden;">
            <!-- Accent top bar -->
            <div style="position:absolute;top:0;left:0;right:0;height:3px;
              background:linear-gradient(to right,#06b6d4,#8b5cf6,#ec4899);"></div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; margin-top:4px;">
              <div style="width:44px; height:44px; border-radius:50%;
                background:linear-gradient(135deg,#06b6d4,#8b5cf6);
                display:flex; align-items:center; justify-content:center;
                color:#fff; font-weight:800; font-size:1.1rem;
                box-shadow:0 0 12px rgba(6,182,212,0.3);">
                ${(s.name || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-weight:700; color:#fff; font-size:0.92rem;">${Utils.esc(s.name || 'Unknown')}</div>
                <div style="font-size:0.78rem; color:rgba(6,182,212,0.7); margin-top:2px;">${s.student_id || s.id} &middot; ${s.course || '—'} &middot; Batch ${s.batch || '—'}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button style="flex:1; background:linear-gradient(135deg,#06b6d4,#0891b2);
                color:#fff; border:none; padding:7px 0; border-radius:8px; cursor:pointer;
                font-weight:700; font-size:0.82rem;
                box-shadow:0 0 10px rgba(6,182,212,0.25);transition:all 0.2s;"
                onclick="IDCardsModule.previewStudent('${s.id}')">
                <i class="fa fa-id-card"></i> Preview
              </button>
              <button style="flex:1; background:transparent;
                color:#a855f7; border:1px solid rgba(139,92,246,0.5);
                padding:7px 0; border-radius:8px; cursor:pointer;
                font-weight:700; font-size:0.82rem; transition:all 0.2s;"
                onclick="IDCardsModule.printStudent('${s.id}')">
                <i class="fa fa-print"></i> Print
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="idcard-preview-modal" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.7); align-items:center; justify-content:center;">
        <div style="background:var(--card-bg); border-radius:16px; padding:24px; max-width:480px; width:95%; position:relative;">
          <button onclick="document.getElementById('idcard-preview-modal').style.display='none'" 
            style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--text); font-size:1.4rem; cursor:pointer;">✕</button>
          <div id="idcard-preview-area" style="display:flex; justify-content:center; padding:20px 0;"></div>
        </div>
      </div>
    `;
  }

  function filterStudents(students) {
    const q = (document.getElementById('idcard-search')?.value || '').toLowerCase();
    if (!q) return students;
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q) ||
      (s.batch || '').toLowerCase().includes(q)
    );
  }

  function previewStudent(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) return;
    const modal = document.getElementById('idcard-preview-modal');
    const area = document.getElementById('idcard-preview-area');
    if (modal && area) {
      area.innerHTML = buildCardHTML(s, 'student');
      modal.style.display = 'flex';
    }
  }

  function printStudent(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) return;
    printCard(s, 'student');
    // Activity log
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('print', 'id-cards', `ID Card printed: ${s.name} (${s.student_id || s.id})`);
    }
  }

  function printAllStudents() {
    const students = SupabaseSync.getAll(DB.students) || [];
    if (students.length === 0) return Utils.toast('No students to print.', 'error');
    printBulk(students, 'student');
    // Activity log
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('print', 'id-cards', `Bulk ID card print: ${students.length} cards`);
    }
  }

  // ✅ Global-safe preview — works from ANY page via Utils.openModal()
  // Called from Students MANAGE action → VIEW ID CARD button
  function previewCard(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    // Try own modal first (if on ID Cards page)
    const ownModal = document.getElementById('idcard-preview-modal');
    const ownArea  = document.getElementById('idcard-preview-area');
    if (ownModal && ownArea) {
      ownArea.innerHTML = buildCardHTML(s, 'student');
      ownModal.style.display = 'flex';
      return;
    }

    // Fallback: use global Utils modal (works from Students page)
    const cardHTML = buildCardHTML(s, 'student');
    Utils.openModal(
      `<i class="fa fa-id-badge" style="color:#00d9ff"></i> ID Card &mdash; ${Utils.esc(s.name)}`,
      `<div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:8px 0;">
        <div>${cardHTML}</div>
        <button class="btn btn-primary" onclick="IDCardsModule.printStudent('${id}')" style="border-radius:24px; padding:10px 28px; font-weight:700;">
          <i class="fa fa-print"></i> Print ID Card
        </button>
      </div>`,
      'modal-sm'
    );
  }

  return { buildCardHTML, renderPreview, printCard, printBulk, render, previewStudent, previewCard, printStudent, printAllStudents };
})();
window.IDCardsModule = IDCardsModule;
