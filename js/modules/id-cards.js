// ============================================================
// id-cards.js — ID Card Generator Module
// Wings Fly Aviation Academy
// ============================================================

const IDCardsModule = (() => {

  // ── Build Card HTML ───────────────────────────────────────
  function buildCardHTML(person, type = 'student') {
    const academyName = AppSettings.get('academyName') || 'Wings Fly Aviation Academy';
    const academyAddress = AppSettings.get('academyAddress') || '';
    const academyPhone = AppSettings.get('academyPhone') || '';
    const logoUrl = 'assets/wings_logo_premium.png';
    const sigUrl = 'assets/signature.png';

    const isStudent = type === 'student';
    const role = isStudent ? (person.course || 'Student') : (person.role || 'Staff');
    const idNumber = person.studentId || person.employeeId || person.id;
    const joinDate = isStudent ? person.admissionDate : person.joiningDate;

    return `
<div class="id-card" data-id="${person.id}">
  <div class="id-card-front">
    <div class="id-card-header">
      <img src="${logoUrl}" class="id-logo" alt="Logo" onerror="this.style.display='none'">
      <div class="id-academy-info">
        <div class="id-academy-name">${academyName}</div>
        <div class="id-academy-sub">${academyAddress}</div>
      </div>
    </div>
    <div class="id-type-badge ${isStudent ? 'student' : 'staff'}">${isStudent ? 'STUDENT ID' : 'STAFF ID'}</div>
    <div class="id-body">
      <div class="id-photo-area">
        <div class="id-photo-placeholder">
          <span class="id-photo-initial">${(person.name || '?')[0].toUpperCase()}</span>
        </div>
      </div>
      <div class="id-details">
        <div class="id-name">${person.name}</div>
        <div class="id-row"><span class="id-label">ID:</span><span class="id-val">${idNumber}</span></div>
        <div class="id-row"><span class="id-label">${isStudent ? 'Course' : 'Role'}:</span><span class="id-val">${role}</span></div>
        ${isStudent ? `<div class="id-row"><span class="id-label">Batch:</span><span class="id-val">${person.batch || '—'}</span></div>` : ''}
        <div class="id-row"><span class="id-label">${isStudent ? 'Session' : 'Department'}:</span><span class="id-val">${isStudent ? (person.session || '—') : (person.department || '—')}</span></div>
        <div class="id-row"><span class="id-label">Phone:</span><span class="id-val">${person.phone || '—'}</span></div>
        ${joinDate ? `<div class="id-row"><span class="id-label">Joined:</span><span class="id-val">${joinDate}</span></div>` : ''}
        ${isStudent && person.validUntil ? `<div class="id-row id-valid"><span class="id-label">Valid Until:</span><span class="id-val">${person.validUntil}</span></div>` : ''}
      </div>
    </div>
    <div class="id-footer">
      <div class="id-sig-area">
        <img src="${sigUrl}" class="id-signature" alt="Signature" onerror="this.style.display='none'">
        <div class="id-sig-label">Authorized Signature</div>
      </div>
      <div class="id-contact">
        <div>${academyPhone}</div>
      </div>
    </div>
  </div>
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
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>ID Card — ${person.name}</title>
  <link rel="stylesheet" href="css/main.css">
  <style>
    body { margin: 0; padding: 20px; background: #f0f0f0; display:flex; justify-content:center; align-items:center; min-height:100vh; }
    @media print {
      body { background: white; padding: 0; }
      @page { size: 85.6mm 54mm; margin: 0; }
    }
  </style>
</head>
<body>${html}<script>window.onload=()=>window.print();<\/script></body>
</html>`);
    win.document.close();
  }

  // ── Bulk Print ────────────────────────────────────────────
  function printBulk(persons, type) {
    const cards = persons.map(p => buildCardHTML(p, type)).join('');
    const win = window.open('', '_blank');
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>ID Cards — Bulk Print</title>
  <link rel="stylesheet" href="css/main.css">
  <style>
    body { margin: 0; padding: 20px; background: #f0f0f0; }
    .id-card { margin: 10px; display:inline-block; }
    @media print {
      body { background: white; padding: 0; }
      .id-card { page-break-inside: avoid; margin: 5mm; }
    }
  </style>
</head>
<body>${cards}<script>window.onload=()=>window.print();<\/script></body>
</html>`);
    win.document.close();
  }

  return { buildCardHTML, renderPreview, printCard, printBulk };
})();
