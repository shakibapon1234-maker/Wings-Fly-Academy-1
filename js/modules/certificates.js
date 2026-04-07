// ============================================================
// certificates.js — Aviation Certificate Generator Module
// Wings Fly Aviation Academy
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

  // ── Build Certificate HTML ────────────────────────────────
  function buildCertHTML(data) {
    const academyName = AppSettings.get('academyName') || 'Wings Fly Aviation Academy';
    const academyAddress = AppSettings.get('academyAddress') || '';
    const issueDate = data.issueDate || Utils.today();
    const grade = data.grade || '';
    const gradeInfo = GRADES[grade] || { label: '', color: '#333' };
    const certNumber = data.certNumber || `CERT-${Date.now()}`;

    return `
<div class="certificate-wrapper">
  <div class="certificate-page">
    <div class="cert-border-outer">
      <div class="cert-border-inner">

        <div class="cert-header">
          <img src="assets/logo.jpg.jpeg" class="cert-logo-left" alt="Logo" onerror="this.style.display='none'">
          <div class="cert-title-block">
            <div class="cert-govt-text">Government Approved</div>
            <div class="cert-academy-name">${academyName}</div>
            <div class="cert-academy-address">${academyAddress}</div>
          </div>
          <img src="assets/academy-logo-b.png" class="cert-logo-right" alt="Logo" onerror="this.style.display='none'">
        </div>

        <div class="cert-divider"></div>

        <div class="cert-certificate-of">CERTIFICATE OF COMPLETION</div>
        <div class="cert-presented-to">This is to certify that</div>

        <div class="cert-student-name">${data.studentName || '___________________'}</div>

        <div class="cert-body-text">
          Son/Daughter of <strong>${data.fatherName || '___________________'}</strong>,
          having successfully completed the
        </div>

        <div class="cert-course-name">${data.courseName || '___________________'}</div>

        <div class="cert-body-text">
          training program conducted by <strong>${academyName}</strong>.<br>
          Batch: <strong>${data.batch || '—'}</strong> &nbsp;|&nbsp;
          Session: <strong>${data.session || '—'}</strong> &nbsp;|&nbsp;
          Duration: <strong>${data.duration || '—'}</strong>
        </div>

        ${grade ? `
        <div class="cert-grade-block">
          <span class="cert-grade-label">Grade Achieved:</span>
          <span class="cert-grade-value" style="color:${gradeInfo.color}">${grade}</span>
          <span class="cert-grade-desc">(${gradeInfo.label})</span>
        </div>` : ''}

        ${data.marks ? `
        <div class="cert-marks">
          Total Marks: <strong>${data.marks}</strong> / <strong>${data.totalMarks || 100}</strong>
        </div>` : ''}

        <div class="cert-congrats">
          We congratulate ${data.studentName?.split(' ')[0] || 'the candidate'} for this achievement and wish them
          a successful career in the aviation industry.
        </div>

        <div class="cert-footer">
          <div class="cert-sig-block">
            <img src="assets/signature.png" class="cert-sig-img" alt="Sig" onerror="this.style.display='none'">
            <div class="cert-sig-line"></div>
            <div class="cert-sig-name">Chief Instructor</div>
            <div class="cert-sig-title">${academyName}</div>
          </div>

          <div class="cert-seal-area">
            <div class="cert-seal">OFFICIAL<br>SEAL</div>
          </div>

          <div class="cert-sig-block">
            <div class="cert-sig-line"></div>
            <div class="cert-sig-name">Academy Director</div>
            <div class="cert-sig-title">${academyName}</div>
          </div>
        </div>

        <div class="cert-meta">
          <span>Certificate No: <strong>${certNumber}</strong></span>
          <span>Issue Date: <strong>${issueDate}</strong></span>
          <span>Student ID: <strong>${data.studentId || '—'}</strong></span>
        </div>

      </div>
    </div>
  </div>
</div>`;
  }

  // ── Render Preview ────────────────────────────────────────
  function renderPreview(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildCertHTML(data);
  }

  // ── Auto-fill from Student ────────────────────────────────
  function fillFromStudent(studentId) {
    const student = StudentsModule.getById(studentId);
    if (!student) return null;

    // Try to get exam result
    let grade = '', marks = '', totalMarks = '';
    if (typeof ExamModule !== 'undefined') {
      const results = ExamModule.getAll().filter(e => e.studentId === studentId);
      if (results.length > 0) {
        const latest = results[results.length - 1];
        grade = latest.grade || '';
        marks = latest.marks || '';
        totalMarks = latest.totalMarks || '';
      }
    }

    return {
      studentId: student.studentId || student.id,
      studentName: student.name,
      fatherName: student.fatherName || student.guardianName || '',
      courseName: student.course,
      batch: student.batch,
      session: student.session,
      grade, marks, totalMarks,
      certNumber: `WFA-${new Date().getFullYear()}-${(student.studentId || student.id).slice(-4)}`,
      issueDate: Utils.today(),
    };
  }

  // ── Print ─────────────────────────────────────────────────
  function print(data) {
    const html = buildCertHTML(data);
    const win = window.open('', '_blank');
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Certificate — ${data.studentName || ''}</title>
  <link rel="stylesheet" href="css/main.css">
  <link rel="stylesheet" href="css/print.css">
  <style>
    body { margin: 0; background: #d0c8b0; display:flex; justify-content:center; align-items:center; min-height:100vh; }
    @media print {
      body { background: white; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>${html}<script>window.onload=()=>window.print();<\/script></body>
</html>`);
    win.document.close();
  }

  return { buildCertHTML, renderPreview, fillFromStudent, print, GRADES };
})();
