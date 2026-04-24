// ============================================================
// certificates.js — Certificate Generator Module
// Wings Fly Aviation Academy (Legacy Design Restoration)
// ✅ Updated: QR Code Download System Added
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
    const settings = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const sigShakib = 'assets/shakib_sign.png';
    const sigChairman = 'assets/ferdous_sign.png';
    const issueDate = data.issueDate || (typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'));
    const certNumber = data.certNumber || 'WFA-' + new Date().getFullYear();
    const studentId = typeof Utils !== 'undefined' ? Utils.esc(data.studentId) : (data.studentId || 'N/A');
    const courseName = (data.courseName || 'N/A').toUpperCase();
    const studentName = (data.studentName || 'N/A').toUpperCase();
    const batch = typeof Utils !== 'undefined' ? Utils.esc(data.batch) : (data.batch || 'N/A');

    return `
    <div class="cert-v2-container">
      <div class="cert-title">CERTIFICATE</div>
      <div class="cert-subtitle" style="text-transform:capitalize;font-size:28px;top:35.5%;color:#333;">Of Appreciation</div>
      <div class="cert-presented-to" style="top:40.5%;font-size:21px;letter-spacing:0.5px;">This certificate is proudly presented for honorable achievment to</div>
      <div class="cert-student-name">${studentName}</div>
      <div class="cert-details" style="display:flex;justify-content:center;gap:30px;align-items:center;">
        <span>BATCH - ${batch}</span>
        <span>STUDENT ID : ${studentId}</span>
      </div>
      <div class="cert-course-text">CERTIFICATION ON TRAINING ABOUT THE "${courseName}".</div>
      <img src="assets/wings_logo_linear.png" style="position:absolute;top:6%;left:6%;height:50px;" onerror="this.src='assets/logo.jpg';this.style.height='60px';">
      <div style="position:absolute;top:15%;left:6%;font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#1a1a1a;letter-spacing:0.5px;">
        Certificate No: ${certNumber}
      </div>
      <div class="cert-signature" style="bottom:3%;left:10%;right:auto;text-align:center;">
        <img src="${sigShakib}" style="height:50px;margin-bottom:5px;filter:invert(1);mix-blend-mode:screen;opacity:0.9;" onerror="this.style.display='none'">
        <div class="cert-signature-name" style="font-family:Arial,sans-serif;font-size:14px;border-top:2px solid #c9a227;padding-top:5px;color:#ffffff;">
          <span style="font-weight:800;">Shakib Ibna Mustafa</span><br>
          <span style="font-size:12px;color:#f1f1f1;">Course Coordinator</span>
        </div>
        <div style="margin-top:15px;height:16px;color:transparent;">-</div>
      </div>
      <div class="cert-signature" style="bottom:3%;right:10%;left:auto;text-align:center;">
        <img src="${sigChairman}" style="height:50px;margin-bottom:5px;opacity:0.9;mix-blend-mode:multiply;" onerror="this.style.display='none'">
        <div class="cert-signature-name" style="font-family:Arial,sans-serif;font-size:14px;border-top:2px solid #c9a227;padding-top:5px;color:#1a1a1a;">
          <span style="font-weight:800;">CHAIRMAN</span><br>
          <span style="font-size:12px;color:#333;font-weight:600;">FERDOUS AHMED</span>
        </div>
        <div style="margin-top:15px;height:16px;color:transparent;">-</div>
      </div>
      <div class="cert-website" style="position:absolute;bottom:5%;left:0;width:100%;text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:1px;">
        wingsflyaviationacademy.com
      </div>
    </div>`;
  }

  function renderPreview(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildCertHTML(data);
  }

  function fillFromStudent(studentId) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return null;
    const student = SupabaseSync.getById(DB.students, studentId);
    if (!student) return null;
    let grade = '', marks = '', totalMarks = '';
    if (typeof SupabaseSync !== 'undefined') {
      const results = SupabaseSync.getAll(DB.exams).filter(e => e.student_id === student.student_id);
      if (results.length > 0) {
        const latest = results[results.length - 1];
        grade = latest.grade || ''; marks = latest.marks || ''; totalMarks = latest.totalMarks || '';
      }
    }
    return {
      studentId: student.student_id || student.id,
      studentName: student.name,
      fatherName: student.father_name || student.fatherName || '',
      courseName: student.course,
      batch: student.batch,
      session: student.session,
      grade, marks, totalMarks,
      photo: student.photo || '',
      certNumber: `WFA-${new Date().getFullYear()}-${(student.student_id || student.id || '0000').toString().slice(-4)}`,
      issueDate: typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'),
    };
  }

  function print(data) {
    const html = buildCertHTML(data);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificate - ${data.studentName || ''}</title>
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:0;}}</style>
    </head><body><div style="zoom:0.85;">${html}</div><script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
    win.document.close();
  }

  // ══════════════════════════════════════════════════════════
  // QR CODE SYSTEM
  // ══════════════════════════════════════════════════════════

  async function generateQRToken(studentDbId) {
    if (!supabaseClient) { Utils.toast('Supabase connection নেই।', 'error'); return null; }
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === studentDbId);
    if (!s) { Utils.toast('Student পাওয়া যায়নি।', 'error'); return null; }

    const phone = (s.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 4) {
      Utils.toast(`${s.name}-এর phone নম্বর নেই।`, 'error'); return null;
    }

    // Check existing token
    const { data: existing } = await supabaseClient
      .from('certificate_tokens').select('token').eq('student_id', s.student_id || s.id).eq('is_active', true).maybeSingle();
    if (existing) return existing.token;

    // Create new token
    const { data, error } = await supabaseClient
      .from('certificate_tokens')
      .insert({ student_id: s.student_id || s.id, student_db_id: s.id, phone_hash: phone.slice(-4) })
      .select('token').single();

    if (error) { Utils.toast('QR তৈরি করতে সমস্যা: ' + error.message, 'error'); return null; }
    return data.token;
  }

  async function showQRModal(studentDbId) {
    const students = SupabaseSync.getAll(DB.students);
    const s = students.find(st => st.id === studentDbId);
    if (!s) return;

    Utils.openModal(
      `<i class="fa fa-qrcode" style="color:#f59e0b"></i> QR Code — ${Utils.esc(s.name)}`,
      `<div id="qr-modal-body" style="text-align:center;padding:30px;">
        <i class="fa fa-spinner fa-spin" style="font-size:2rem;color:#f59e0b;"></i>
        <p style="margin-top:12px;color:var(--text-muted);">QR তৈরি হচ্ছে...</p>
      </div>`, 'modal-md'
    );

    const token = await generateQRToken(studentDbId);
    if (!token) return;

    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const certUrl = `${baseUrl}certificate.html?token=${token}`;

    const body = document.getElementById('qr-modal-body');
    if (!body) return;

    body.innerHTML = `
      <div style="padding:10px 0;">
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px;">
          <strong>${Utils.esc(s.name)}</strong>-কে এই QR দিন। স্ক্যান করলে নিজেই সার্টিফিকেট ডাউনলোড করতে পারবে।
        </p>
        <div id="qr-render-target" style="display:flex;justify-content:center;margin-bottom:16px;"></div>
        <div style="background:var(--sidebar-bg);border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:0.72rem;word-break:break-all;color:var(--text-muted);text-align:left;">
          <strong>URL:</strong> ${certUrl}
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="CertificatesModule.downloadQR('${Utils.esc(s.name)}')" style="border-radius:24px;padding:8px 18px;">
            <i class="fa fa-download"></i> QR ডাউনলোড
          </button>
          <button class="btn btn-sm" onclick="CertificatesModule.printQRCard('${Utils.esc(s.name)}','${Utils.esc(s.student_id||s.id)}','${Utils.esc(s.course||'')}','${token}')" style="border-radius:24px;padding:8px 18px;background:var(--sidebar-bg);border:1px solid var(--border);color:var(--text);">
            <i class="fa fa-print"></i> Card Print
          </button>
          <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${certUrl}').then(()=>Utils.toast('Link copied!','success'))" style="border-radius:24px;padding:8px 18px;background:var(--sidebar-bg);border:1px solid var(--border);color:var(--text);">
            <i class="fa fa-link"></i> Link Copy
          </button>
        </div>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:10px;">
          <i class="fa fa-shield-halved" style="color:#22c55e;"></i> Phone নম্বর দিয়ে verify হবে — অন্য কেউ access পাবে না
        </p>
      </div>`;

    if (typeof QRCode !== 'undefined') {
      new QRCode(document.getElementById('qr-render-target'), {
        text: certUrl, width: 200, height: 200,
        colorDark: '#1a1a2e', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H,
      });
    } else {
      document.getElementById('qr-render-target').innerHTML =
        `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(certUrl)}" width="200" height="200" style="border-radius:8px;" id="qr-img-fallback">`;
    }
  }

  function downloadQR(studentName) {
    const canvas = document.querySelector('#qr-render-target canvas');
    const img = document.querySelector('#qr-render-target img, #qr-img-fallback');
    if (canvas) {
      const a = document.createElement('a');
      a.download = `QR_${studentName.replace(/\s+/g,'_')}.png`;
      a.href = canvas.toDataURL('image/png'); a.click();
    } else if (img) {
      const a = document.createElement('a');
      a.download = `QR_${studentName.replace(/\s+/g,'_')}.png`;
      a.href = img.src; a.target = '_blank'; a.click();
    } else {
      Utils.toast('QR image পাওয়া যায়নি।', 'error');
    }
  }

  function printQRCard(name, studentId, course, token) {
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const certUrl = `${baseUrl}certificate.html?token=${token}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(certUrl)}`;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR Card - ${name}</title>
    <style>body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif;}
    .card{width:320px;border:2px solid #1a3a6b;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.15);}
    .hd{background:linear-gradient(135deg,#1a3a6b,#2563eb);color:#fff;padding:16px;text-align:center;}
    .bd{padding:20px;text-align:center;background:#fff;}
    @media print{body{background:#fff!important;}@page{size:85mm 120mm;margin:0;}}</style>
    </head><body><div class="card">
    <div class="hd"><div style="font-size:11px;font-weight:700;letter-spacing:0.5px;">WINGS FLY AVIATION ACADEMY</div>
    <div style="font-size:10px;opacity:0.8;margin-top:4px;">Certificate Download QR</div></div>
    <div class="bd"><img src="${qrUrl}" width="160" height="160" style="border-radius:8px;border:3px solid #e2e8f0;">
    <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin:10px 0 3px;">${name}</div>
    <div style="font-size:11px;color:#64748b;">${studentId} · ${course}</div>
    <div style="font-size:10px;color:#94a3b8;margin-top:8px;font-style:italic;">📱 QR স্ক্যান করুন → Phone দিন → Download</div>
    </div></div>
    <script>window.onload=function(){setTimeout(function(){window.print();},800);}<\/script></body></html>`);
    win.document.close();
  }

  async function generateAllQRCards() {
    const students = SupabaseSync.getAll(DB.students) || [];
    if (students.length === 0) return Utils.toast('কোনো স্টুডেন্ট নেই।', 'error');
    Utils.toast(`${students.length}জন স্টুডেন্টের QR তৈরি হচ্ছে...`, 'info');
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const cards = [];
    for (const s of students) {
      const phone = (s.phone || '').replace(/\D/g, '');
      if (!phone || phone.length < 4) continue;
      const token = await generateQRToken(s.id);
      if (!token) continue;
      const certUrl = `${baseUrl}certificate.html?token=${token}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(certUrl)}`;
      cards.push({ name: s.name, studentId: s.student_id || s.id, course: s.course || '', qrUrl, certUrl });
    }
    if (cards.length === 0) return Utils.toast('Phone নম্বর আছে এমন কোনো স্টুডেন্ট পাওয়া যায়নি।', 'error');
    const cardHTML = cards.map(c => `
      <div style="width:190px;border:2px solid #1a3a6b;border-radius:10px;overflow:hidden;display:inline-block;margin:6px;vertical-align:top;">
        <div style="background:linear-gradient(135deg,#1a3a6b,#2563eb);color:#fff;padding:8px;text-align:center;font-family:Arial;font-size:8px;font-weight:700;">WINGS FLY AVIATION ACADEMY</div>
        <div style="padding:10px;text-align:center;background:#fff;font-family:Arial;">
          <img src="${c.qrUrl}" width="130" height="130" style="border-radius:6px;border:2px solid #e2e8f0;">
          <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin:6px 0 2px;">${c.name}</div>
          <div style="font-size:9px;color:#64748b;">${c.studentId} · ${c.course}</div>
          <div style="font-size:8px;color:#94a3b8;margin-top:5px;">📱 Scan → Phone দিন → Download</div>
        </div>
      </div>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All QR Cards</title>
    <style>body{margin:16px;background:#fff;}@media print{body{margin:0;}@page{margin:8mm;}}</style>
    </head><body>
    <h2 style="font-family:Arial;color:#1a3a6b;text-align:center;margin-bottom:16px;">Wings Fly Aviation Academy — Certificate QR Cards</h2>
    <div style="text-align:center;">${cardHTML}</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},1800);}<\/script></body></html>`);
    win.document.close();
  }

  // ── Main Render ───────────────────────────────────────────
  function render() {
    const container = document.getElementById('certificates-content');
    if (!container) return;
    const students = SupabaseSync.getAll(DB.students) || [];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <input type="text" id="cert-search" placeholder="🔍 Search student..."
          style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);min-width:220px;"
          oninput="CertificatesModule.render()">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="CertificatesModule.generateAllQRCards()" style="background:linear-gradient(135deg,#1a3a6b,#2563eb);">
            <i class="fa fa-qrcode"></i> সব QR Print
          </button>
          <button class="btn btn-primary" onclick="CertificatesModule.printAllCerts()">
            <i class="fa fa-print"></i> Print All
          </button>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <i class="fa fa-qrcode" style="font-size:1.5rem;color:#2563eb;"></i>
        <div style="flex:1;">
          <div style="font-weight:600;color:#1e40af;font-size:0.9rem;">📲 QR Certificate Download সিস্টেম চালু</div>
          <div style="font-size:0.8rem;color:#3b82f6;">QR বাটনে ক্লিক → QR কোড পাবেন → স্টুডেন্টকে দিন → তারা scan করে নিজেই certificate download করবে</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;background:#fff;padding:4px 4px 4px 12px;border-radius:24px;border:1px solid #bfdbfe;">
          <div class="blur-link-container" style="position:relative;cursor:pointer;overflow:hidden;min-width:180px;" onclick="this.classList.toggle('revealed')">
            <span class="blur-text" style="filter:blur(4px);transition:filter 0.3s;font-family:monospace;font-size:0.85rem;color:#1e3a8a;">${window.location.origin + window.location.pathname.replace(/[^/]*$/, '')}certificate.html</span>
            <div class="blur-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);font-weight:600;font-size:0.75rem;transition:opacity 0.3s;color:#1e40af;">Click to Reveal Link</div>
          </div>
          <button class="btn-primary btn-sm" onclick="Utils.toast('Link Copied!','success');navigator.clipboard.writeText('${window.location.origin + window.location.pathname.replace(/[^/]*$/, '')}certificate.html')" style="border-radius:20px;white-space:nowrap;padding:4px 12px;"><i class="fa fa-copy"></i> Copy portal link</button>
        </div>
        <style>
          .blur-link-container.revealed .blur-text { filter: blur(0); }
          .blur-link-container.revealed .blur-overlay { opacity: 0; pointer-events: none; }
        </style>
      </div>

      <div id="cert-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${students.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">No students found. Add students first.</div>' : ''}
        ${filterStudents(students).map(s => `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:1.1rem;">
                ${(s.name || '?')[0].toUpperCase()}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${Utils.esc(s.name || 'Unknown')}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);">${s.student_id || s.id} · ${s.course || '—'} · ${s.batch || '—'}</div>
                ${s.phone
                  ? `<div style="font-size:0.75rem;color:var(--text-muted);"><i class="fa fa-phone" style="color:#22c55e;"></i> ${Utils.esc(s.phone)}</div>`
                  : `<div style="font-size:0.75rem;color:#ef4444;"><i class="fa fa-triangle-exclamation"></i> Phone নেই</div>`}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" style="flex:1;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:6px 0;border-radius:6px;cursor:pointer;"
                onclick="CertificatesModule.previewForStudent('${s.id}')">
                <i class="fa fa-eye"></i> Preview
              </button>
              <button class="btn btn-sm" style="flex:1;background:transparent;color:#f59e0b;border:1px solid #f59e0b;padding:6px 0;border-radius:6px;cursor:pointer;"
                onclick="CertificatesModule.printForStudent('${s.id}')">
                <i class="fa fa-print"></i> Print
              </button>
              <button class="btn btn-sm" style="flex:1;background:linear-gradient(135deg,#1a3a6b,#2563eb);color:#fff;border:none;padding:6px 0;border-radius:6px;cursor:pointer;${!s.phone?'opacity:0.5;cursor:not-allowed;':''}"
                onclick="${s.phone ? `CertificatesModule.showQRModal('${s.id}')` : `Utils.toast('আগে phone নম্বর যোগ করুন।','error')`}">
                <i class="fa fa-qrcode"></i> QR
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="cert-preview-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;">
        <div style="background:var(--card-bg);border-radius:16px;padding:24px;max-width:900px;width:95%;position:relative;max-height:90vh;overflow:auto;">
          <button onclick="document.getElementById('cert-preview-modal').style.display='none'"
            style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--text);font-size:1.4rem;cursor:pointer;">✕</button>
          <div id="cert-preview-area" style="display:flex;justify-content:center;padding:20px 0;"></div>
        </div>
      </div>`;
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
      studentId: s.student_id || s.id, studentName: s.name,
      fatherName: s.fatherName || s.guardianName || '',
      courseName: s.course, batch: s.batch, session: s.session,
      duration: s.duration || '', grade: s.grade || '',
      marks: s.marks || '', totalMarks: s.totalMarks || 100, photo: s.photo || '',
      certNumber: `WFA-${new Date().getFullYear()}-${(s.student_id || s.id || '0000').toString().slice(-4)}`,
      issueDate: typeof Utils !== 'undefined' ? Utils.today() : new Date().toLocaleDateString('en-GB'),
    };
  }

  function previewForStudent(id) {
    const s = SupabaseSync.getAll(DB.students).find(st => st.id === id);
    if (!s) return;
    const modal = document.getElementById('cert-preview-modal');
    const area = document.getElementById('cert-preview-area');
    if (modal && area) {
      area.innerHTML = `<div style="zoom:0.65;display:flex;justify-content:center;width:100%;">${buildCertHTML(buildDataFromStudent(s))}</div>`;
      modal.style.display = 'flex';
    }
  }

  function printForStudent(id) {
    const s = SupabaseSync.getAll(DB.students).find(st => st.id === id);
    if (!s) return;
    print(buildDataFromStudent(s));
    // Activity log
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('print', 'certificates', `Certificate printed: ${s.name} (${s.student_id || s.id})`);
    }
  }

  function printAllCerts() {
    const students = SupabaseSync.getAll(DB.students) || [];
    if (students.length === 0) return Utils.toast('No students to print.', 'error');
    const allHTML = students.map(s => buildCertHTML(buildDataFromStudent(s))).join('<div style="page-break-after:always;"></div>');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificates — Bulk Print</title>
    <link rel="stylesheet" href="css/cert-v2.css" />
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;background:#fff;}
    @media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4 landscape;margin:0;}}</style>
    </head><body>${allHTML}<script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
    win.document.close();
    // Activity log
    if (typeof SupabaseSync !== 'undefined' && typeof SupabaseSync.logActivity === 'function') {
      SupabaseSync.logActivity('print', 'certificates', `Bulk certificate print: ${students.length} certificates`);
    }
  }

  function previewCertificate(id) {
    const s = SupabaseSync.getAll(DB.students).find(st => st.id === id);
    if (!s) { Utils.toast('Student not found', 'error'); return; }
    const ownModal = document.getElementById('cert-preview-modal');
    const ownArea = document.getElementById('cert-preview-area');
    if (ownModal && ownArea) {
      ownArea.innerHTML = buildCertHTML(buildDataFromStudent(s));
      ownModal.style.display = 'flex';
      return;
    }
    Utils.openModal(
      `<i class="fa fa-award" style="color:#f59e0b"></i> Certificate &mdash; ${Utils.esc(s.name)}`,
      `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0;">
        <div style="overflow-x:auto;width:100%;">${buildCertHTML(buildDataFromStudent(s))}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="CertificatesModule.printForStudent('${id}')" style="border-radius:24px;padding:10px 28px;font-weight:700;">
            <i class="fa fa-print"></i> Print
          </button>
          <button class="btn" onclick="CertificatesModule.showQRModal('${id}')" style="border-radius:24px;padding:10px 28px;font-weight:700;background:linear-gradient(135deg,#1a3a6b,#2563eb);color:#fff;border:none;">
            <i class="fa fa-qrcode"></i> QR Generate
          </button>
        </div>
      </div>`, 'modal-xl'
    );
  }

  return {
    buildCertHTML, renderPreview, fillFromStudent, print, GRADES,
    render, previewForStudent, previewCertificate, printForStudent, printAllCerts,
    showQRModal, generateQRToken, downloadQR, printQRCard, generateAllQRCards,
  };
})();
window.CertificatesModule = CertificatesModule;
