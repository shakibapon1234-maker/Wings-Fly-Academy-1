// ============================================================
// certificates.js — Certificate Generator Module
// Wings Fly Aviation Academy (Legacy Design Restoration)
// ============================================================

const CertificatesModule = (() => {

  const GRADES = {
    'A+': { label: 'Outstanding', color: '#1a7a1a' },
    'A':  { label: 'Excellent',   color: '#2a6e2a' },
    'A-': { label: 'Very Good',   color: '#3d7a3d' },
    'B+': { label: 'Good',        color: '#1a4e8a' },
    'B':  { label: 'Above Average', color: '#2a5a9a' },
    'C':  { label: 'Average',     color: '#7a6a1a' },
    'F':  { label: 'Failed',      color: '#8a1a1a' },
  };

  // ── Build Certificate HTML (Legacy Inline-Style Design) ────
  function buildCertHTML(data) {
    const settings = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = settings.academy_name || 'Wings Fly Aviation Academy';
    const logoLinear = 'assets/wings_logo_linear.png';
    const logoPremium = 'assets/wings_logo_premium.png';
    const sigShakib = 'assets/shakib_sign.png';
    const sigChairman = 'assets/chairman_sign.jpeg';
    const issueDate = data.issueDate || (typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'));

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // Session calculation
    let sessionLabel = 'Date';
    let sessionValue = dateStr;
    if (data.sessionStart && data.duration) {
      const startDate = new Date(data.sessionStart);
      const endDate = new Date(data.sessionStart);
      endDate.setMonth(endDate.getMonth() + parseInt(data.duration));
      endDate.setDate(endDate.getDate() - 1);
      const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      sessionLabel = 'Session';
      sessionValue = fmt(startDate) + ' — ' + fmt(endDate);
    } else if (data.session) {
      sessionLabel = 'Session';
      sessionValue = data.session;
    }

    // Photo
    const photoSrc = data.photo || `https://ui-avatars.com/api/?background=f59e0b&color=fff&size=100&name=${encodeURIComponent(data.studentName || 'S')}`;

    return `
    <div id="certContent" style="
      position: relative;
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #0a1628 0%, #0d2240 50%, #0a1628 100%);
      border: 3px solid #c9a227;
      border-radius: 12px;
      padding: 40px 50px;
      color: #fff;
      box-shadow: 0 0 40px rgba(201,162,39,0.3), inset 0 0 80px rgba(0,0,0,0.3);
      text-align: center;
      overflow: hidden;
    ">
      <!-- Corner decorations -->
      <div style="position:absolute;top:10px;left:10px;width:40px;height:40px;border-top:3px solid #c9a227;border-left:3px solid #c9a227;border-radius:4px 0 0 0;"></div>
      <div style="position:absolute;top:10px;right:10px;width:40px;height:40px;border-top:3px solid #c9a227;border-right:3px solid #c9a227;border-radius:0 4px 0 0;"></div>
      <div style="position:absolute;bottom:10px;left:10px;width:40px;height:40px;border-bottom:3px solid #c9a227;border-left:3px solid #c9a227;border-radius:0 0 0 4px;"></div>
      <div style="position:absolute;bottom:10px;right:10px;width:40px;height:40px;border-bottom:3px solid #c9a227;border-right:3px solid #c9a227;border-radius:0 0 4px 0;"></div>

      <!-- Top right logo -->
      <div style="position:absolute;top:16px;right:20px;
        background:rgba(255,255,255,0.07);
        border:1.5px solid rgba(201,162,39,0.5);
        border-radius:10px;
        padding:5px 12px;
        box-shadow:0 0 12px rgba(201,162,39,0.25), inset 0 0 8px rgba(255,255,255,0.03);">
        <img src="${logoLinear}" style="height:38px;object-fit:contain;opacity:0.92;" onerror="this.style.display='none'">
      </div>

      <!-- Academy Name -->
      <div style="margin-bottom:8px;">
        <div style="height:1px;background:linear-gradient(to right, transparent, #c9a227, transparent);margin:6px 0;"></div>
      </div>

      <!-- Certificate Title -->
      <div style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#c9a227;text-transform:uppercase;margin:10px 0 4px 0;text-shadow:0 0 10px rgba(201,162,39,0.5);">Certificate</div>
      <div style="font-size:14px;letter-spacing:6px;color:#aaa;text-transform:uppercase;margin-bottom:16px;">of Completion</div>

      <!-- Round Academy Logo center -->
      <div style="margin:0 auto 12px auto;width:90px;height:90px;border-radius:50%;border:3px solid #c9a227;overflow:hidden;box-shadow:0 0 20px rgba(201,162,39,0.5);">
        <img src="${logoPremium}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">
      </div>

      <!-- This is to certify -->
      <div style="font-size:13px;color:#aaa;margin-bottom:6px;">This is to certify that</div>

      <!-- Student Name -->
      <div style="font-size:26px;font-weight:bold;color:#c9a227;margin:8px 0;padding:6px 0;border-bottom:2px solid rgba(201,162,39,0.4);display:inline-block;text-transform:uppercase;letter-spacing:2px;">${typeof Utils !== 'undefined' ? Utils.esc(data.studentName) : (data.studentName || 'N/A')}</div>

      <!-- Student details -->
      <div style="font-size:12px;color:#aaa;margin:10px 0;line-height:1.8;">
        ID: <span style="color:#fff;font-weight:bold;">${typeof Utils !== 'undefined' ? Utils.esc(data.studentId) : (data.studentId || 'N/A')}</span> &nbsp;|&nbsp;
        Course: <span style="color:#fff;font-weight:bold;">${typeof Utils !== 'undefined' ? Utils.esc(data.courseName) : (data.courseName || 'N/A')}</span> &nbsp;|&nbsp;
        Batch: <span style="color:#fff;font-weight:bold;">${typeof Utils !== 'undefined' ? Utils.esc(data.batch) : (data.batch || 'N/A')}</span>
      </div>

      <!-- Completion text -->
      <div style="font-size:13px;color:#ccc;margin:12px 30px;line-height:1.7;">
        has successfully completed the <span style="color:#c9a227;font-weight:bold;">${typeof Utils !== 'undefined' ? Utils.esc(data.courseName) : (data.courseName || 'training program')}</span> 
        training program conducted by <span style="color:#c9a227;">${typeof Utils !== 'undefined' ? Utils.esc(academyName) : academyName}</span>.
        ${sessionValue ? `<br>${sessionLabel}: <span style="color:#fff;font-weight:bold;">${typeof Utils !== 'undefined' ? Utils.esc(sessionValue) : sessionValue}</span>` : ''}
      </div>

      ${data.grade ? `
      <div style="margin:10px 0;">
        <span style="color:#aaa;font-size:12px;">Grade: </span>
        <span style="color:#c9a227;font-size:18px;font-weight:bold;">${data.grade}</span>
        <span style="color:#aaa;font-size:11px;"> (${(GRADES[data.grade] || {}).label || ''})</span>
      </div>` : ''}

      <!-- Congratulations -->
      <div style="font-size:11px;color:#888;margin:12px 40px;line-height:1.7;font-style:italic;">
        We congratulate ${(data.studentName || 'the candidate').split(' ')[0]} for this achievement and wish continued success in aviation.
      </div>

      <!-- Divider -->
      <div style="height:1px;background:linear-gradient(to right, transparent, #c9a227, transparent);margin:16px 0;"></div>

      <!-- Footer with signatures -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;padding:0 20px;">
        <!-- Left signature - Shakib (Chief Instructor) -->
        <div style="text-align:center;flex:1;">
          <img src="${sigShakib}" style="height:40px;object-fit:contain;filter:invert(1);mix-blend-mode:screen;margin-bottom:4px;" onerror="this.style.display='none'">
          <div style="width:120px;height:1px;background:#c9a227;margin:0 auto 4px;"></div>
          <div style="color:#c9a227;font-size:9px;font-weight:bold;">Shakib Ibna Mustafa</div>
          <div style="color:#666;font-size:7px;">Chief Instructor</div>
        </div>

        <!-- Center seal -->
        <div style="flex:1;text-align:center;">
          <div style="width:70px;height:70px;border:2px solid #c9a227;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;background:rgba(201,162,39,0.08);">
            <div style="color:#c9a227;font-size:8px;font-weight:bold;text-align:center;line-height:1.3;">OFFICIAL<br>SEAL</div>
          </div>
        </div>

        <!-- Right signature - Chairman (Ferdous Ahmed) -->
        <div style="text-align:center;flex:1;">
          <img src="${sigChairman}" style="height:40px;object-fit:contain;filter:invert(1);mix-blend-mode:screen;margin-bottom:4px;" onerror="this.style.display='none'">
          <div style="width:120px;height:1px;background:#c9a227;margin:0 auto 4px;"></div>
          <div style="color:#c9a227;font-size:9px;font-weight:bold;">Ferdous Ahmed</div>
          <div style="color:#666;font-size:7px;">Academy Director / Chairman</div>
        </div>
      </div>

      <!-- Certificate number & date -->
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding:0 20px;font-size:8px;color:#666;">
        <span>Certificate No: ${data.certNumber || 'WFA-' + new Date().getFullYear()}</span>
        <span>${issueDate}</span>
        <span>Student ID: ${data.studentId || 'N/A'}</span>
      </div>
    </div>`;
  }

  // ── Render Preview ────────────────────────────────────────
  function renderPreview(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildCertHTML(data);
  }

  function fillFromStudent(studentId) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return null;
    // ✅ Fix: window.Students (not StudentsModule). getById not exported — use SupabaseSync directly
    const student = SupabaseSync.getById(DB.students, studentId);
    if (!student) return null;

    let grade = '', marks = '', totalMarks = '';
    // ✅ Fix: ExamModule.getAll() doesn't exist — read DB directly; field is student_id (snake_case)
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
      const results = SupabaseSync.getAll(DB.exams).filter(e =>
        e.student_id === student.student_id
      );
      if (results.length > 0) {
        const latest = results[results.length - 1];
        grade      = latest.grade      || '';
        marks      = latest.marks      || '';
        totalMarks = latest.totalMarks || '';
      }
    }

    return {
      studentId:   student.student_id || student.id,
      studentName: student.name,
      fatherName:  student.father_name || student.fatherName || '',
      courseName:  student.course,
      batch:       student.batch,
      session:     student.session,
      grade, marks, totalMarks,
      photo:       student.photo || '',
      certNumber:  `WFA-${new Date().getFullYear()}-${(student.student_id || student.id || '0000').toString().slice(-4)}`,
      issueDate:   typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'),
    };
  }


  // ── Print ─────────────────────────────────────────────────
  function print(data) {
    const html = buildCertHTML(data);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificate - ${data.studentName || ''}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a1628;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
    @media print{body{background:#0a1628!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:10mm;}}</style>
    </head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
    win.document.close();
  }

  // ── Render full section UI ─────────────────────────────────
  function render() {
    const container = document.getElementById('certificates-content');
    if (!container) return;

    const students = SupabaseSync.getAll(DB.students) || [];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="text" id="cert-search" placeholder="🔍 Search student..."
            style="padding:8px 14px; border-radius:8px; border:1px solid var(--border); background:var(--card-bg); color:var(--text); min-width:220px;"
            oninput="CertificatesModule.render()">
        </div>
        <button class="btn btn-primary" onclick="CertificatesModule.printAllCerts()">
          <i class="fa fa-print"></i> Print All Certificates
        </button>
      </div>

      <div id="cert-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
        ${students.length === 0 ? '<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">No students found. Add students first.</div>' : ''}
        ${filterStudents(students).map(s => `
          <div style="background:var(--card-bg); border-radius:12px; padding:16px; border:1px solid var(--border); transition:all 0.3s;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg, #f59e0b, #d97706); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:1.1rem;">
                ${(s.name || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600; color:var(--text);">${Utils.esc(s.name || "Unknown")}</div>
                <div style="font-size:0.82rem; color:var(--text-muted);">${s.studentId || s.id} · ${s.course || '—'} · ${s.batch || '—'}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" style="flex:1; background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border:none; padding:6px 0; border-radius:6px; cursor:pointer;"
                onclick="CertificatesModule.previewForStudent('${s.id}')">
                <i class="fa fa-eye"></i> Preview
              </button>
              <button class="btn btn-sm" style="flex:1; background:transparent; color:#f59e0b; border:1px solid #f59e0b; padding:6px 0; border-radius:6px; cursor:pointer;"
                onclick="CertificatesModule.printForStudent('${s.id}')">
                <i class="fa fa-print"></i> Print
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="cert-preview-modal" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.7); align-items:center; justify-content:center;">
        <div style="background:var(--card-bg); border-radius:16px; padding:24px; max-width:900px; width:95%; position:relative; max-height:90vh; overflow:auto;">
          <button onclick="document.getElementById('cert-preview-modal').style.display='none'"
            style="position:absolute; top:12px; right:12px; background:none; border:none; color:var(--text); font-size:1.4rem; cursor:pointer;">✕</button>
          <div id="cert-preview-area" style="display:flex; justify-content:center; padding:20px 0;"></div>
        </div>
      </div>
    `;
  }

  function filterStudents(students) {
    const q = (document.getElementById('cert-search')?.value || '').toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q) ||
      (s.batch || '').toLowerCase().includes(q)
    );
  }

  function buildDataFromStudent(s) {
    return {
      studentId: s.studentId || s.id,
      studentName: s.name,
      fatherName: s.fatherName || s.guardianName || '',
      courseName: s.course,
      batch: s.batch,
      session: s.session,
      duration: s.duration || '',
      grade: s.grade || '',
      marks: s.marks || '',
      totalMarks: s.totalMarks || 100,
      photo: s.photo || '',
      certNumber: `WFA-${new Date().getFullYear()}-${(s.studentId || s.id || '0000').toString().slice(-4)}`,
      issueDate: typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'),
    };
  }

  function previewForStudent(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) return;
    const modal = document.getElementById('cert-preview-modal');
    const area = document.getElementById('cert-preview-area');
    if (modal && area) {
      area.innerHTML = buildCertHTML(buildDataFromStudent(s));
      modal.style.display = 'flex';
    }
  }

  function printForStudent(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) return;
    print(buildDataFromStudent(s));
  }

  function printAllCerts() {
    const students = SupabaseSync.getAll(DB.students) || [];
    if (students.length === 0) return Utils.toast('No students to print certificates for.', 'error');
    const allHTML = students.map(s => buildCertHTML(buildDataFromStudent(s))).join('<div style="page-break-after:always;"></div>');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificates — Bulk Print</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;padding:20px;background:#0a1628;}
    @media print{body{background:#0a1628!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:10mm;}}</style>
    </head><body>${allHTML}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
    win.document.close();
  }

  // ✅ Global-safe preview — works from ANY page via Utils.openModal()
  // Called from Students MANAGE action → GENERATE CERTIFICATE button
  function previewCertificate(id) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === id);
    if (!s) { Utils.toast('Student not found', 'error'); return; }

    // Try own modal first (if on Certificates page)
    const ownModal = document.getElementById('cert-preview-modal');
    const ownArea  = document.getElementById('cert-preview-area');
    if (ownModal && ownArea) {
      ownArea.innerHTML = buildCertHTML(buildDataFromStudent(s));
      ownModal.style.display = 'flex';
      return;
    }

    // Fallback: use global Utils modal (works from Students page)
    const certHTML = buildCertHTML(buildDataFromStudent(s));
    Utils.openModal(
      `<i class="fa fa-award" style="color:#f59e0b"></i> Certificate &mdash; ${Utils.esc(s.name)}`,
      `<div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:8px 0;">
        <div style="overflow-x:auto; width:100%;">${certHTML}</div>
        <button class="btn btn-primary" onclick="CertificatesModule.printForStudent('${id}')" style="border-radius:24px; padding:10px 28px; font-weight:700;">
          <i class="fa fa-print"></i> Print Certificate
        </button>
      </div>`,
      'modal-xl'
    );
  }

  return { buildCertHTML, renderPreview, fillFromStudent, print, GRADES, render, previewForStudent, previewCertificate, printForStudent, printAllCerts };
})();
window.CertificatesModule = CertificatesModule;
