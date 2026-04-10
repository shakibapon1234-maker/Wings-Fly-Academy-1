/* ============================================================
   ATTENDANCE MODULE — Wings Fly Aviation Academy
   Modal-based "ATTENDANCE CENTRE" matching legacy design
   5 Tabs: Mark Attendance, Monthly Report, Yearly Report,
           Course-wise, Blank Sheet
   ============================================================ */

const Attendance = (() => {

  /* ─── State ─── */
  let records = [];
  let activeTab = 'mark';

  /* ─── Init / Load ─── */
  function init() {
    load();
  }

  function load() {
    try { records = JSON.parse(localStorage.getItem('wf_attendance') || '[]'); }
    catch { records = []; }
  }

  function save() {
    localStorage.setItem('wf_attendance', JSON.stringify(records));
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined' && DB.attendance) {
      SupabaseSync.push?.('attendance', records);
    }
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  /* ─── Get Students (safe) ─── */
  function getStudents() {
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined' && DB.students) {
      return SupabaseSync.getAll(DB.students) || [];
    }
    return [];
  }

  function getBatches() {
    const students = getStudents();
    return [...new Set(students.map(s => s.batch).filter(Boolean))].sort();
  }

  function getCourses() {
    const students = getStudents();
    return [...new Set(students.map(s => s.course).filter(Boolean))].sort();
  }

  /* ═══════════════════════════════════════════
     RENDER — called by app.js navigateTo
     Opens the modal instead of inline content
  ═══════════════════════════════════════════ */
  function render() {
    openModal();
  }

  /* ═══════════════════════════════════════════
     MODAL INFRASTRUCTURE
  ═══════════════════════════════════════════ */
  function openModal() {
    load();
    let overlay = document.getElementById('attendance-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'attendance-modal-overlay';
      overlay.className = 'att-modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.classList.add('open');
    renderModal();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('attendance-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Navigate back to dashboard
    if (typeof App !== 'undefined') App.navigateTo('dashboard');
  }

  function renderModal() {
    const overlay = document.getElementById('attendance-modal-overlay');
    if (!overlay) return;

    const tabs = [
      { id: 'mark',     icon: 'fa-calendar-check', label: 'MARK ATTENDANCE' },
      { id: 'monthly',  icon: 'fa-calendar-days',  label: 'MONTHLY REPORT' },
      { id: 'yearly',   icon: 'fa-chart-bar',      label: 'YEARLY REPORT' },
      { id: 'course',   icon: 'fa-graduation-cap', label: 'COURSE-WISE' },
      { id: 'blank',    icon: 'fa-file-alt',       label: 'BLANK SHEET' },
    ];

    overlay.innerHTML = `
      <div class="att-modal-container">
        <!-- Header -->
        <div class="att-modal-header">
          <div class="att-header-left">
            <div class="att-header-icon">
              <i class="fa fa-calendar-check"></i>
            </div>
            <div>
              <div class="att-header-title">ATTENDANCE CENTRE</div>
              <div class="att-header-sub">Wings Fly Aviation Academy</div>
            </div>
          </div>
          <button class="att-modal-close" onclick="Attendance.closeModal()">
            <i class="fa fa-times"></i>
          </button>
        </div>

        <!-- Tab Bar -->
        <div class="att-tab-bar">
          ${tabs.map(t => `
            <button class="att-tab-btn ${activeTab === t.id ? 'active' : ''}"
              onclick="Attendance.switchTab('${t.id}')">
              <i class="fa ${t.icon}"></i> ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Tab Content -->
        <div class="att-tab-content" id="att-tab-content">
          ${renderTabContent()}
        </div>

        <!-- Footer Buttons -->
        <div class="att-modal-footer">
          <button class="export-btn export-btn-excel" onclick="Attendance.exportCSV()">
            <i class="fa fa-download"></i> CSV EXPORT
          </button>
          <button class="export-btn export-btn-print" onclick="window.print()">
            <i class="fa fa-print"></i> PRINT
          </button>
          <button class="att-save-btn" onclick="Attendance.saveAllAttendance()">
            <i class="fa fa-check"></i> SAVE ATTENDANCE
          </button>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════
     TAB SWITCHING
  ═══════════════════════════════════════════ */
  function switchTab(tab) {
    activeTab = tab;
    // Update tab buttons
    document.querySelectorAll('.att-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.replace(/\s+/g, '').includes(
        tab === 'mark' ? 'MARKATTENDANCE' :
        tab === 'monthly' ? 'MONTHLYREPORT' :
        tab === 'yearly' ? 'YEARLYREPORT' :
        tab === 'course' ? 'COURSE-WISE' : 'BLANKSHEET'
      ));
    });
    // Re-render just tab buttons and content
    renderModal();
  }

  /* ═══════════════════════════════════════════
     TAB CONTENT RENDERER
  ═══════════════════════════════════════════ */
  function renderTabContent() {
    switch (activeTab) {
      case 'mark':    return renderMarkTab();
      case 'monthly': return renderMonthlyTab();
      case 'yearly':  return renderYearlyTab();
      case 'course':  return renderCourseTab();
      case 'blank':   return renderBlankTab();
      default:        return renderMarkTab();
    }
  }

  /* ─── MARK ATTENDANCE TAB ─── */
  function renderMarkTab() {
    const batches = getBatches();
    const todayDate = today();
    const selectedBatch = document.getElementById('att-batch-sel')?.value || '';
    const selectedDate = document.getElementById('att-date-sel')?.value || todayDate;

    // Get students for selected batch
    let students = getStudents();
    if (selectedBatch) students = students.filter(s => s.batch === selectedBatch);

    const countBadge = students.length;

    return `
      <!-- Filter Bar -->
      <div class="att-filter-section">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-layer-group"></i> BATCH</label>
          <select id="att-batch-sel" class="att-filter-select" onchange="Attendance.refreshSheet()">
            <option value="">Select Batch...</option>
            ${batches.map(b => `<option value="${b}" ${selectedBatch === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar"></i> DATE</label>
          <input type="date" id="att-date-sel" class="att-filter-input" value="${selectedDate}"
            onchange="Attendance.refreshSheet()" />
        </div>
        <div class="att-count-badge">
          <span class="count-num">${countBadge}</span> STUDENTS
        </div>
      </div>

      <!-- Student List / Empty State -->
      <div class="att-sheet-area" id="att-sheet-area">
        ${!selectedBatch ? `
          <div class="att-empty-state">
            <i class="fa fa-users" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
            <div class="att-empty-text bn">Batch & Date বেছে নিলেই Student List দেখাবে</div>
          </div>
        ` : students.length === 0 ? `
          <div class="att-empty-state">
            <i class="fa fa-inbox" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
            <div class="att-empty-text">No students found in this batch</div>
          </div>
        ` : `
          <table class="att-sheet-table" id="att-sheet-table">
            <thead>
              <tr>
                <th style="width:40px">#</th>
                <th>STUDENT ID</th>
                <th>NAME</th>
                <th>PHONE</th>
                <th style="width:280px">ATTENDANCE</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((s, i) => {
                const existingRec = records.find(r =>
                  r.date === selectedDate &&
                  r.entityId === (s.student_id || s.id) &&
                  r.type === 'student'
                );
                const status = existingRec?.status || '';
                const eid = s.student_id || s.id;
                return `
                <tr data-entity-id="${eid}" data-name="${s.name}" data-batch="${s.batch || ''}">
                  <td style="text-align:center;color:var(--text-muted)">${i + 1}</td>
                  <td><span class="badge badge-primary">${eid}</span></td>
                  <td><strong>${s.name}</strong></td>
                  <td style="color:var(--text-secondary)">${s.phone || '—'}</td>
                  <td>
                    <div class="att-status-group">
                      ${['Present', 'Absent', 'Late', 'Leave'].map(st => `
                        <button class="att-status-btn att-st-${st.toLowerCase()} ${status === st ? 'active' : ''}"
                          onclick="Attendance.setStatus(this,'${st}')">
                          ${st === 'Present' ? '✓' : st === 'Absent' ? '✗' : st === 'Late' ? '⏰' : '📋'}
                          ${st}
                        </button>
                      `).join('')}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /* ─── MONTHLY REPORT TAB ─── */
  function renderMonthlyTab() {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return `
      <div class="att-filter-section">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar"></i> MONTH</label>
          <input type="month" id="att-month-sel" class="att-filter-input" value="${curMonth}" />
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-layer-group"></i> BATCH</label>
          <select id="att-month-batch" class="att-filter-select">
            <option value="">All Batches</option>
            ${getBatches().map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <button class="att-action-btn" onclick="Attendance.loadMonthlyReport()">
          <i class="fa fa-search"></i> VIEW REPORT
        </button>
      </div>
      <div id="att-monthly-result" class="att-sheet-area">
        <div class="att-empty-state">
          <i class="fa fa-chart-bar" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
          <div class="att-empty-text bn">Month সিলেক্ট করে View Report চাপুন</div>
        </div>
      </div>
    `;
  }

  /* ─── YEARLY REPORT TAB ─── */
  function renderYearlyTab() {
    const curYear = new Date().getFullYear();

    return `
      <div class="att-filter-section">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar"></i> YEAR</label>
          <select id="att-year-sel" class="att-filter-select">
            ${[curYear, curYear - 1, curYear - 2].map(y =>
              `<option value="${y}">${y}</option>`
            ).join('')}
          </select>
        </div>
        <button class="att-action-btn" onclick="Attendance.loadYearlyReport()">
          <i class="fa fa-search"></i> VIEW REPORT
        </button>
      </div>
      <div id="att-yearly-result" class="att-sheet-area">
        <div class="att-empty-state">
          <i class="fa fa-chart-line" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
          <div class="att-empty-text bn">Year সিলেক্ট করে View Report চাপুন</div>
        </div>
      </div>
    `;
  }

  /* ─── COURSE-WISE TAB ─── */
  function renderCourseTab() {
    return `
      <div class="att-filter-section">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-graduation-cap"></i> COURSE</label>
          <select id="att-course-sel" class="att-filter-select">
            <option value="">Select Course...</option>
            ${getCourses().map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar"></i> DATE RANGE</label>
          <div style="display:flex;gap:8px">
            <input type="date" id="att-course-from" class="att-filter-input" value="${today()}" />
            <input type="date" id="att-course-to" class="att-filter-input" value="${today()}" />
          </div>
        </div>
        <button class="att-action-btn" onclick="Attendance.loadCourseReport()">
          <i class="fa fa-search"></i> VIEW
        </button>
      </div>
      <div id="att-course-result" class="att-sheet-area">
        <div class="att-empty-state">
          <i class="fa fa-graduation-cap" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
          <div class="att-empty-text bn">Course সিলেক্ট করে View চাপুন</div>
        </div>
      </div>
    `;
  }

  /* ─── BLANK SHEET TAB ─── */
  function renderBlankTab() {
    return `
      <div class="att-filter-section">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-layer-group"></i> BATCH</label>
          <select id="att-blank-batch" class="att-filter-select">
            <option value="">Select Batch...</option>
            ${getBatches().map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <button class="att-action-btn" onclick="Attendance.generateBlankSheet()">
          <i class="fa fa-file-alt"></i> GENERATE
        </button>
        <button class="export-btn export-btn-print" onclick="Attendance.printBlankSheet()">
          <i class="fa fa-print"></i> PRINT SHEET
        </button>
      </div>
      <div id="att-blank-result" class="att-sheet-area">
        <div class="att-empty-state">
          <i class="fa fa-file-alt" style="font-size:3rem;opacity:0.3;margin-bottom:16px"></i>
          <div class="att-empty-text bn">Batch সিলেক্ট করে Generate চাপুন</div>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════ */

  function refreshSheet() {
    const content = document.getElementById('att-tab-content');
    if (content) content.innerHTML = renderTabContent();
  }

  function setStatus(btn, status) {
    const row = btn.closest('tr');
    row.querySelectorAll('.att-status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function saveAllAttendance() {
    const rows = document.querySelectorAll('#att-sheet-table tbody tr');
    if (!rows.length) {
      if (typeof Utils !== 'undefined') Utils.toast('No students to save', 'warn');
      return;
    }

    const date = document.getElementById('att-date-sel')?.value || today();
    let count = 0;

    rows.forEach(row => {
      const entityId = row.dataset.entityId;
      if (!entityId) return;
      const activeBtn = row.querySelector('.att-status-btn.active');
      if (!activeBtn) return;

      const status = ['Present', 'Absent', 'Late', 'Leave'].find(s =>
        activeBtn.classList.contains('att-st-' + s.toLowerCase())
      ) || 'Present';
      const entityName = row.dataset.name || '';
      const batch = row.dataset.batch || '';

      // Remove existing record for same date+entity
      records = records.filter(r => !(r.date === date && r.entityId === entityId && r.type === 'student'));
      records.push({
        id: typeof Utils !== 'undefined' ? Utils.generateId() : Date.now().toString(),
        date, type: 'student', entityId, entityName, batch, status,
        createdAt: new Date().toISOString(),
      });
      count++;
    });

    save();
    if (typeof Utils !== 'undefined') Utils.toast(`${count} জন এর Attendance Save হয়েছে ✓`, 'success');
  }

  /* ─── Monthly Report ─── */
  function loadMonthlyReport() {
    const month = document.getElementById('att-month-sel')?.value;
    const batch = document.getElementById('att-month-batch')?.value || '';
    const wrapper = document.getElementById('att-monthly-result');
    if (!wrapper || !month) return;

    let filtered = records.filter(r => r.date && r.date.startsWith(month) && r.type === 'student');
    if (batch) filtered = filtered.filter(r => r.batch === batch);

    if (!filtered.length) {
      wrapper.innerHTML = `<div class="att-empty-state"><div class="att-empty-text">No records found for this month</div></div>`;
      return;
    }

    // Group by entity
    const entityMap = {};
    filtered.forEach(r => {
      if (!entityMap[r.entityId]) entityMap[r.entityId] = { name: r.entityName, Present: 0, Absent: 0, Late: 0, Leave: 0 };
      if (entityMap[r.entityId][r.status] !== undefined) entityMap[r.entityId][r.status]++;
    });

    wrapper.innerHTML = `
      <table class="att-sheet-table">
        <thead><tr>
          <th>#</th><th>NAME</th>
          <th style="color:#00ff88">PRESENT</th>
          <th style="color:#ff4757">ABSENT</th>
          <th style="color:#ffd700">LATE</th>
          <th style="color:#00d4ff">LEAVE</th>
          <th>TOTAL</th><th>%</th>
        </tr></thead>
        <tbody>${Object.entries(entityMap).map(([id, e], i) => {
          const total = e.Present + e.Absent + e.Late + e.Leave;
          const pct = total ? Math.round(((e.Present + e.Late) / total) * 100) : 0;
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${e.name}</strong></td>
            <td style="color:#00ff88;font-weight:700">${e.Present}</td>
            <td style="color:#ff4757;font-weight:700">${e.Absent}</td>
            <td style="color:#ffd700;font-weight:700">${e.Late}</td>
            <td style="color:#00d4ff;font-weight:700">${e.Leave}</td>
            <td>${total}</td>
            <td>
              <div class="progress-bar-gradient" style="display:inline-flex;width:60px;margin:0">
                <div class="bar" style="width:${pct}%"></div>
              </div>
              <span style="font-size:0.75rem;font-weight:700;margin-left:6px">${pct}%</span>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  }

  /* ─── Yearly Report ─── */
  function loadYearlyReport() {
    const year = document.getElementById('att-year-sel')?.value;
    const wrapper = document.getElementById('att-yearly-result');
    if (!wrapper || !year) return;

    const filtered = records.filter(r => r.date && r.date.startsWith(year) && r.type === 'student');
    if (!filtered.length) {
      wrapper.innerHTML = `<div class="att-empty-state"><div class="att-empty-text">No records found for ${year}</div></div>`;
      return;
    }

    // Group by month
    const months = {};
    filtered.forEach(r => {
      const m = r.date.substring(0, 7);
      if (!months[m]) months[m] = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
      if (months[m][r.status] !== undefined) months[m][r.status]++;
    });

    wrapper.innerHTML = `
      <table class="att-sheet-table">
        <thead><tr>
          <th>MONTH</th>
          <th style="color:#00ff88">PRESENT</th>
          <th style="color:#ff4757">ABSENT</th>
          <th style="color:#ffd700">LATE</th>
          <th style="color:#00d4ff">LEAVE</th>
          <th>TOTAL</th>
        </tr></thead>
        <tbody>${Object.entries(months).sort().map(([m, d]) => {
          const total = d.Present + d.Absent + d.Late + d.Leave;
          return `<tr>
            <td><strong>${m}</strong></td>
            <td style="color:#00ff88;font-weight:700">${d.Present}</td>
            <td style="color:#ff4757;font-weight:700">${d.Absent}</td>
            <td style="color:#ffd700;font-weight:700">${d.Late}</td>
            <td style="color:#00d4ff;font-weight:700">${d.Leave}</td>
            <td>${total}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  }

  /* ─── Course Report ─── */
  function loadCourseReport() {
    const course = document.getElementById('att-course-sel')?.value;
    const from = document.getElementById('att-course-from')?.value;
    const to = document.getElementById('att-course-to')?.value;
    const wrapper = document.getElementById('att-course-result');
    if (!wrapper || !course) {
      if (typeof Utils !== 'undefined') Utils.toast('Select a course', 'warn');
      return;
    }

    // Get students by course
    const courseStudents = getStudents().filter(s => s.course === course);
    const courseIds = courseStudents.map(s => s.student_id || s.id);

    let filtered = records.filter(r =>
      r.type === 'student' && courseIds.includes(r.entityId)
    );
    if (from) filtered = filtered.filter(r => r.date >= from);
    if (to)   filtered = filtered.filter(r => r.date <= to);

    if (!filtered.length) {
      wrapper.innerHTML = `<div class="att-empty-state"><div class="att-empty-text">No records found</div></div>`;
      return;
    }

    const entityMap = {};
    filtered.forEach(r => {
      if (!entityMap[r.entityId]) entityMap[r.entityId] = { name: r.entityName, Present: 0, Absent: 0, Late: 0, Leave: 0 };
      if (entityMap[r.entityId][r.status] !== undefined) entityMap[r.entityId][r.status]++;
    });

    wrapper.innerHTML = `
      <table class="att-sheet-table">
        <thead><tr><th>#</th><th>NAME</th><th style="color:#00ff88">P</th><th style="color:#ff4757">A</th><th style="color:#ffd700">L</th><th>TOTAL</th><th>%</th></tr></thead>
        <tbody>${Object.entries(entityMap).map(([id, e], i) => {
          const total = e.Present + e.Absent + e.Late + e.Leave;
          const pct = total ? Math.round(((e.Present + e.Late) / total) * 100) : 0;
          return `<tr>
            <td>${i+1}</td><td><strong>${e.name}</strong></td>
            <td style="color:#00ff88;font-weight:700">${e.Present}</td>
            <td style="color:#ff4757;font-weight:700">${e.Absent}</td>
            <td style="color:#ffd700;font-weight:700">${e.Late}</td>
            <td>${total}</td><td style="font-weight:700">${pct}%</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  }

  /* ─── Blank Sheet ─── */
  function generateBlankSheet() {
    const batch = document.getElementById('att-blank-batch')?.value;
    const wrapper = document.getElementById('att-blank-result');
    if (!wrapper || !batch) {
      if (typeof Utils !== 'undefined') Utils.toast('Select a batch', 'warn');
      return;
    }

    const students = getStudents().filter(s => s.batch === batch);
    if (!students.length) {
      wrapper.innerHTML = `<div class="att-empty-state"><div class="att-empty-text">No students in batch ${batch}</div></div>`;
      return;
    }

    // Generate 31 day columns
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    wrapper.innerHTML = `
      <div style="overflow-x:auto" id="att-blank-print-area">
        <table class="att-sheet-table" style="font-size:0.7rem">
          <thead><tr>
            <th style="width:30px">#</th>
            <th style="min-width:100px">NAME</th>
            ${days.map(d => `<th style="width:26px;text-align:center">${d}</th>`).join('')}
          </tr></thead>
          <tbody>${students.map((s, i) => `
            <tr>
              <td style="text-align:center">${i + 1}</td>
              <td><strong>${s.name}</strong></td>
              ${days.map(() => `<td style="border:1px solid rgba(0,212,255,0.1)"></td>`).join('')}
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
  }

  function printBlankSheet() {
    const area = document.getElementById('att-blank-print-area');
    if (!area) { generateBlankSheet(); return; }
    // Open print dialog
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Blank Attendance Sheet</title>
      <style>body{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 5px;text-align:left}th{background:#f5f5f5}</style>
    </head><body>${area.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  }

  /* ─── CSV Export ─── */
  function exportCSV() {
    if (!records.length) {
      if (typeof Utils !== 'undefined') Utils.toast('No attendance data', 'warn');
      return;
    }
    const rows = records.map(r => ({
      Date: r.date, ID: r.entityId, Name: r.entityName,
      Batch: r.batch || '', Status: r.status,
    }));
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-export.xlsx`);
    }
  }

  /* ─── Monthly stats for dashboard ─── */
  function getMonthSummary() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = records.filter(r => r.date && r.date.startsWith(ym));
    const present = thisMonth.filter(r => r.status === 'Present').length;
    const total = thisMonth.length;
    return { present, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }

  return {
    init, load, render, openModal, closeModal,
    switchTab, refreshSheet, setStatus,
    saveAllAttendance, loadMonthlyReport, loadYearlyReport,
    loadCourseReport, generateBlankSheet, printBlankSheet,
    exportCSV, getMonthSummary,
  };

})();
