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

  // ── Build Certificate HTML (Original Absolute-Position Layout) ────
  function buildCertHTML(data) {
    const settings = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = settings.academy_name || 'Wings Fly Aviation Academy';
    const sigShakib = 'assets/shakib_sign.png';
    const sigChairman = 'assets/ferdous_sign.png';
    const issueDate = data.issueDate || (typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'));
    
    const certNumber = data.certNumber || 'WFA-' + new Date().getFullYear();
    const studentId = typeof Utils !== 'undefined' ? Utils.esc(data.studentId) : (data.studentId || 'N/A');
    const courseName = (data.courseName || 'N/A').toUpperCase();
    const studentName = (data.studentName || 'N/A').toUpperCase();
    const batch = typeof Utils !== 'undefined' ? Utils.esc(data.batch) : (data.batch || 'N/A');
    
    // Fallback images logic if blank_cert is not yet placed
    // The main background is handled via CSS: background-image: url('../assets/blank_cert.jpeg');

    return `
    <div class="cert-v2-container">
      <div class="cert-title">CERTIFICATE</div>
      <div class="cert-subtitle" style="text-transform: capitalize; font-size: 28px; top: 35.5%; color: #333;">Of Appreciation</div>
      <div class="cert-presented-to" style="top: 40.5%; font-size: 21px; letter-spacing: 0.5px;">This certificate is proudly presented for honorable achievment to</div>
      
      <div class="cert-student-name">${studentName}</div>
      
      <div class="cert-details" style="display:flex; justify-content: center; gap: 30px; align-items:center;">
        <span>BATCH - ${batch}</span> 
        <span>STUDENT ID : ${studentId}</span>
      </div>
      
      <div class="cert-course-text">CERTIFICATION ON TRAINING ABOUT THE "${courseName}".</div>
      
      <img src="assets/wings_logo_linear.png" style="position: absolute; top: 6%; left: 6%; height: 50px;" onerror="this.src='assets/logo.jpg'; this.style.height='60px';">
      
      <div style="position: absolute; top: 15%; left: 6%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px;">
         Certificate No: ${certNumber}
      </div>

      <div class="cert-signature" style="bottom: 3%; left: 10%; right: auto; text-align:center;">
        <img src="${sigShakib}" style="height: 50px; margin-bottom: 5px; filter: invert(1); mix-blend-mode: screen; opacity: 0.9;" onerror="this.style.display='none'">
        <div class="cert-signature-name" style="font-family: Arial, sans-serif; font-size: 14px; border-top: 2px solid #c9a227; padding-top: 5px; color: #ffffff;">
           <span style="font-weight: 800;">Shakib Ibna Mustafa</span><br>
           <span style="font-size: 12px; color: #f1f1f1;">Course Coordinator</span>
        </div>
        <!-- Spacer to structurally align exactly with Chairman block's height -->
        <div style="margin-top: 15px; font-size: 12px; font-family: 'Segoe UI', sans-serif; color: transparent; text-align: center; height: 16px;">
           -
        </div>
      </div>

      <div class="cert-signature" style="bottom: 3%; right: 10%; left: auto; text-align:center;">
        <img src="${sigChairman}" style="height: 50px; margin-bottom: 5px; opacity: 0.9; mix-blend-mode: multiply;" onerror="this.style.display='none'">
        <div class="cert-signature-name" style="font-family: Arial, sans-serif; font-size: 14px; border-top: 2px solid #c9a227; padding-top: 5px; color: #1a1a1a;">
           <span style="font-weight: 800;">CHAIRMAN</span><br>
           <span style="font-size: 12px; color: #333; font-weight: 600;">FERDOUS AHMED</span>
        </div>
        <!-- Align structurally with left block -->
        <div style="margin-top: 15px; font-size: 12px; font-family: 'Segoe UI', sans-serif; color: transparent; text-align: center; height: 16px;">
           -
        </div>
      </div>
      
      <div class="cert-website" style="position: absolute; bottom: 5%; left: 0; width: 100%; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 1px;">
         wingsflyaviationacademy.com
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
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:0;}}</style>
    </head><body><div style="zoom: 0.85;">${html}</div><script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
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
                <div style="font-size:0.82rem; color:var(--text-muted);">${s.student_id || s.id} · ${s.course || '—'} · ${s.batch || '—'}</div>
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
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q) ||
      (s.batch || '').toLowerCase().includes(q)
    );
  }

  function buildDataFromStudent(s) {
    return {
      studentId: s.student_id || s.id,
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
      certNumber: `WFA-${new Date().getFullYear()}-${(s.student_id || s.id || '0000').toString().slice(-4)}`,
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
      // Zoom out specifically for the preview modal so it fits completely on-screen
      area.innerHTML = `<div style="zoom: 0.65; display: flex; justify-content: center; width: 100%;">${buildCertHTML(buildDataFromStudent(s))}</div>`;
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
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;background:#fff;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:0;}}</style>
    </head><body>${allHTML}<script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
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
