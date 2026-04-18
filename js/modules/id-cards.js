// ============================================================
// id-cards.js — ID Card Generator Module
// Wings Fly Aviation Academy (Legacy Design Restoration)
// ============================================================

const IDCardsModule = (() => {

  // ── Build Card HTML (Legacy Inline-Style Design) ──────────
  function buildCardHTML(person, type = 'student') {
    const settings = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = settings.academy_name || 'Wings Fly Aviation Academy';
    const logoUrl = 'assets/wings_logo_linear.png';
    const logoRoundUrl = 'assets/wings_logo_premium.png';
    const sigShakib = 'assets/shakib_sign.png';
    const sigChairman = 'assets/chairman_sign.jpeg';

    const isStudent = type === 'student';
    const idNumber = person.studentId || person.employeeId || person.id || 'N/A';
    // ✅ Fix #7: use first letter of first name + first letter of last name
    const nameParts  = (person.name || '').trim().split(/\s+/).filter(Boolean);
    const initials   = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts.length === 1
        ? nameParts[0][0].toUpperCase()
        : 'S';

    // Date calculations
    const enrollDate = new Date(person.admissionDate || person.enrollDate || Date.now());
    const expiryDate = new Date(enrollDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Photo HTML
    const photoHTML = (person.photo && person.photo.length > 10)
      ? `<img src="${person.photo}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0d2240;color:#c9a227;font-size:42px;font-weight:bold;">${initials}</div>`;

    return `<div id="idCardRender" style="
      width:220px;height:340px;
      background:linear-gradient(170deg,#0a1628 0%,#0d2240 50%,#061020 100%);
      border:2px solid #c9a227;
      border-radius:16px;
      position:relative;
      overflow:hidden;
      font-family:'Segoe UI',sans-serif;
      box-shadow:0 0 30px rgba(201,162,39,0.35);
      display:flex;flex-direction:column;
      align-items:center;
    ">
      <!-- Top gold bar -->
      <div style="width:100%;height:5px;background:linear-gradient(to right,#c9a227,#f0e080,#c9a227);flex-shrink:0;"></div>

      <!-- Header: Logo -->
      <div style="width:100%;padding:8px 10px 4px;text-align:center;border-bottom:1px solid rgba(201,162,39,0.25);flex-shrink:0;">
        <img src="${logoUrl}" style="height:24px;object-fit:contain;" onerror="this.style.display='none'">
        <div style="color:#aaa;font-size:6.5px;letter-spacing:0.8px;margin-top:2px;">AVIATION & CAREER DEVELOPMENT ACADEMY</div>
      </div>

      <!-- Photo -->
      <div style="margin:12px auto 8px;width:100px;height:110px;border:2.5px solid #c9a227;border-radius:10px;overflow:hidden;box-shadow:0 0 15px rgba(201,162,39,0.4);flex-shrink:0;">
        ${photoHTML}
      </div>

      <!-- Name -->
      <div style="text-align:center;padding:0 10px;flex-shrink:0;">
        <div style="color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;line-height:1.2;">${Utils.esc(person.name || "N/A")}</div>
      </div>

      <!-- Role badge -->
      <div style="margin:6px auto;background:linear-gradient(90deg,#c9a227,#f0e080,#c9a227);border-radius:20px;padding:3px 18px;flex-shrink:0;">
        <div style="color:#0a1628;font-size:8px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">${isStudent ? 'STUDENT' : 'STAFF'}</div>
      </div>

      <!-- Divider -->
      <div style="width:85%;height:1px;background:linear-gradient(to right,transparent,#c9a227,transparent);margin:4px auto;flex-shrink:0;"></div>

      <!-- Info grid -->
      <div style="width:90%;padding:4px 0;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div style="color:#c9a227;font-size:7px;font-weight:bold;text-transform:uppercase;width:80px;">ID Number</div>
          <div style="color:#fff;font-size:7.5px;font-weight:600;flex:1;text-align:right;">${Utils.esc(idNumber)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div style="color:#c9a227;font-size:7px;font-weight:bold;text-transform:uppercase;width:80px;">Blood Group</div>
          <div style="color:#ff6b6b;font-size:7.5px;font-weight:600;flex:1;text-align:right;">${Utils.esc(person.bloodGroup || 'N/A')}</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div style="color:#c9a227;font-size:7px;font-weight:bold;text-transform:uppercase;width:80px;">Joining Date</div>
          <div style="color:#fff;font-size:7.5px;flex:1;text-align:right;">${fmtDate(enrollDate)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div style="color:#c9a227;font-size:7px;font-weight:bold;text-transform:uppercase;width:80px;">Course</div>
          <div style="color:#aaa;font-size:7px;flex:1;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;">${Utils.esc(person.course || 'N/A')}</div>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <div style="color:#c9a227;font-size:7px;font-weight:bold;text-transform:uppercase;width:80px;">Valid Till</div>
          <div style="color:#aaa;font-size:7px;flex:1;text-align:right;">${fmtDate(expiryDate)}</div>
        </div>
      </div>

      <!-- Divider -->
      <div style="width:85%;height:1px;background:linear-gradient(to right,transparent,#c9a227,transparent);margin:4px auto;flex-shrink:0;"></div>

      <!-- Footer -->
      <div style="width:100%;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;margin-top:auto;flex-shrink:0;">
        <div style="text-align:center;">
          <img src="${sigShakib}" style="height:20px;object-fit:contain;filter:invert(1);mix-blend-mode:screen;" onerror="this.style.display='none'">
          <div style="color:#c9a227;font-size:5px;margin-top:1px;">Authorized Sign</div>
        </div>
        <div style="color:#666;font-size:6px;text-align:center;">STP-DHA-002261</div>
        <div style="color:#c9a227;font-size:6px;font-weight:bold;">Batch ${person.batch || 'N/A'}</div>
      </div>

      <!-- Bottom gold bar -->
      <div style="width:100%;height:5px;background:linear-gradient(to right,#c9a227,#f0e080,#c9a227);flex-shrink:0;"></div>
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
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a1628;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    @media print{body{background:#0a1628!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A6 landscape;margin:5mm;}}</style>
    </head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
    win.document.close();
  }

  // ── Bulk Print ────────────────────────────────────────────
  function printBulk(persons, type) {
    const cards = persons.map(p => buildCardHTML(p, type)).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>ID Cards — Bulk Print</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;padding:20px;background:#0a1628;display:flex;flex-wrap:wrap;gap:20px;justify-content:center;}
    @media print{body{background:#0a1628!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:5mm;}}</style>
    </head><body>${cards}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
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
          <div style="background:var(--card-bg); border-radius:12px; padding:16px; border:1px solid var(--border); transition:all 0.3s;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg, var(--accent), var(--accent-hover)); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:1.1rem;">
                ${(s.name || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600; color:var(--text);">${Utils.esc(s.name || "Unknown")}</div>
                <div style="font-size:0.82rem; color:var(--text-muted);">${s.studentId || s.id} · ${s.course || '—'} · ${s.batch || '—'}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" style="flex:1; background:var(--accent); color:#fff; border:none; padding:6px 0; border-radius:6px; cursor:pointer;"
                onclick="IDCardsModule.previewStudent('${s.id}')">
                <i class="fa fa-eye"></i> Preview
              </button>
              <button class="btn btn-sm" style="flex:1; background:transparent; color:var(--accent); border:1px solid var(--accent); padding:6px 0; border-radius:6px; cursor:pointer;"
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
      (s.studentId || '').toLowerCase().includes(q) ||
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
  }

  function printAllStudents() {
    const students = SupabaseSync.getAll(DB.students) || [];
    if (students.length === 0) return Utils.toast('No students to print.', 'error');
    printBulk(students, 'student');
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
