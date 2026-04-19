// ============================================================
// id-cards.js — ID Card Generator Module
// Wings Fly Aviation Academy (Legacy Design Restoration)
// ============================================================

const IDCardsModule = (() => {

  // ── Build Card HTML (Legacy Inline-Style Design) ──────────
  function buildCardHTML(person, type = 'student') {
    const settings = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = settings.academy_name || 'Wings Fly Aviation Academy';
    const logoUrl     = 'assets/wings_logo_linear.png';
    const sigShakib   = 'assets/shakib_sign.png';

    const isStudent  = type === 'student';
    const idNumber   = person.studentId || person.employeeId || person.id || 'N/A';
    const nameParts  = (person.name || '').trim().split(/\s+/).filter(Boolean);
    const initials   = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts.length === 1 ? nameParts[0][0].toUpperCase() : 'S';

    const enrollDate = new Date(person.admissionDate || person.enrollDate || Date.now());
    const expiryDate = new Date(enrollDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const fmtDate = (d) => d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    const photoHTML = (person.photo && person.photo.length > 10)
      ? `<img src="${person.photo}" style="width:100%;height:100%;object-fit:cover;object-position:top;">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
           background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#fff;font-size:38px;font-weight:800;letter-spacing:-1px;">${initials}</div>`;

    const roleColor  = isStudent ? '#06b6d4' : '#a855f7';
    const roleLabel  = isStudent ? 'STUDENT' : 'STAFF';
    const roleIcon   = isStudent ? '🎓' : '👤';

    return `<div id="idCardRender" style="
      width:220px; height:350px;
      background: linear-gradient(160deg, #0f0c29 0%, #1a1040 40%, #0d1f3c 100%);
      border: 2px solid rgba(6,182,212,0.5);
      border-radius: 18px;
      position: relative;
      overflow: hidden;
      font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 0 30px rgba(6,182,212,0.25), 0 0 60px rgba(139,92,246,0.1);
      display: flex; flex-direction: column; align-items: center;
    ">

      <!-- Glowing BG circles -->
      <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;
        background:radial-gradient(circle,rgba(139,92,246,0.25),transparent);pointer-events:none;"></div>
      <div style="position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;border-radius:50%;
        background:radial-gradient(circle,rgba(6,182,212,0.2),transparent);pointer-events:none;"></div>

      <!-- Top bar: cyan→purple gradient -->
      <div style="width:100%;height:6px;background:linear-gradient(to right,#06b6d4,#8b5cf6,#ec4899);flex-shrink:0;"></div>

      <!-- Corner accents -->
      <div style="position:absolute;top:8px;left:8px;width:14px;height:14px;
        border-top:2px solid #06b6d4;border-left:2px solid #06b6d4;border-radius:3px 0 0 0;"></div>
      <div style="position:absolute;top:8px;right:8px;width:14px;height:14px;
        border-top:2px solid #a855f7;border-right:2px solid #a855f7;border-radius:0 3px 0 0;"></div>

      <!-- Header -->
      <div style="width:100%;padding:7px 10px 4px;text-align:center;border-bottom:1px solid rgba(6,182,212,0.2);flex-shrink:0;">
        <img src="${logoUrl}" style="height:22px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(6,182,212,0.6));" onerror="this.style.display='none'">
        <div style="color:rgba(6,182,212,0.7);font-size:5.5px;letter-spacing:1.2px;margin-top:3px;font-weight:600;">AVIATION &amp; CAREER DEVELOPMENT ACADEMY</div>
      </div>

      <!-- Photo -->
      <div style="margin:10px auto 6px;width:88px;height:100px;
        border:2px solid transparent;
        background:linear-gradient(#0f0c29,#0f0c29) padding-box,
                   linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899) border-box;
        border-radius:12px;overflow:hidden;
        box-shadow:0 0 18px rgba(6,182,212,0.35),0 0 8px rgba(139,92,246,0.2);flex-shrink:0;">
        ${photoHTML}
      </div>

      <!-- Name -->
      <div style="text-align:center;padding:0 10px;flex-shrink:0;">
        <div style="color:#ffffff;font-size:12px;font-weight:800;letter-spacing:0.5px;
          text-transform:uppercase;line-height:1.2;
          text-shadow:0 0 8px rgba(6,182,212,0.4);">
          ${Utils.esc(person.name || 'N/A')}
        </div>
      </div>

      <!-- Role badge -->
      <div style="margin:5px auto; background:linear-gradient(90deg,#06b6d4,#8b5cf6);
        border-radius:20px;padding:3px 16px;flex-shrink:0;">
        <div style="color:#fff;font-size:7.5px;font-weight:800;letter-spacing:2.5px;">
          ${roleIcon} ${roleLabel}
        </div>
      </div>

      <!-- Divider -->
      <div style="width:88%;height:1px;background:linear-gradient(to right,transparent,#06b6d4,#8b5cf6,transparent);margin:5px auto;flex-shrink:0;"></div>

      <!-- Info rows -->
      <div style="width:92%;padding:2px 0;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="color:#06b6d4;font-size:6.5px;font-weight:700;text-transform:uppercase;">ID No.</div>
          <div style="color:#e2e8f0;font-size:7px;font-weight:700;letter-spacing:0.3px;">${Utils.esc(idNumber)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="color:#a855f7;font-size:6.5px;font-weight:700;text-transform:uppercase;">Blood</div>
          <div style="color:#f87171;font-size:7px;font-weight:700;">${Utils.esc(person.bloodGroup || 'N/A')}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="color:#06b6d4;font-size:6.5px;font-weight:700;text-transform:uppercase;">Joined</div>
          <div style="color:#e2e8f0;font-size:6.5px;">${fmtDate(enrollDate)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="color:#a855f7;font-size:6.5px;font-weight:700;text-transform:uppercase;">Course</div>
          <div style="color:#e2e8f0;font-size:6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.esc(person.course || 'N/A')}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#06b6d4;font-size:6.5px;font-weight:700;text-transform:uppercase;">Valid Till</div>
          <div style="color:#34d399;font-size:6.5px;font-weight:600;">${fmtDate(expiryDate)}</div>
        </div>
      </div>

      <!-- Divider -->
      <div style="width:88%;height:1px;background:linear-gradient(to right,transparent,#8b5cf6,#06b6d4,transparent);margin:5px auto;flex-shrink:0;"></div>

      <!-- Footer -->
      <div style="width:100%;padding:4px 12px;display:flex;justify-content:space-between;align-items:center;margin-top:auto;flex-shrink:0;">
        <div style="text-align:center;">
          <img src="${sigShakib}" style="height:18px;object-fit:contain;filter:invert(1) drop-shadow(0 0 3px rgba(6,182,212,0.6));mix-blend-mode:screen;" onerror="this.style.display='none'">
          <div style="color:rgba(6,182,212,0.7);font-size:5px;margin-top:1px;">Authorized Sign</div>
        </div>
        <div style="color:rgba(255,255,255,0.3);font-size:5.5px;text-align:center;">STP-DHA-002261</div>
        <div style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);
          border-radius:8px;padding:2px 6px;
          color:#c084fc;font-size:6px;font-weight:700;">BATCH ${person.batch || 'N/A'}</div>
      </div>

      <!-- Bottom bar -->
      <div style="width:100%;height:5px;background:linear-gradient(to right,#ec4899,#8b5cf6,#06b6d4);flex-shrink:0;"></div>

      <!-- Bottom corners -->
      <div style="position:absolute;bottom:8px;left:8px;width:14px;height:14px;
        border-bottom:2px solid #ec4899;border-left:2px solid #ec4899;border-radius:0 0 0 3px;"></div>
      <div style="position:absolute;bottom:8px;right:8px;width:14px;height:14px;
        border-bottom:2px solid #06b6d4;border-right:2px solid #06b6d4;border-radius:0 0 3px 0;"></div>
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
