/* ============================================================
   ATTENDANCE MODULE — Wings Fly Aviation Academy
   Phase 8 | Daily Attendance for Students & Staff
   ============================================================ */

const Attendance = (() => {

  /* ─── State ─── */
  let records = [];
  // record: { id, date, entityId, entityName, type ('student'|'staff'), batch, status ('Present'|'Absent'|'Late'|'Leave'), note }

  /* ─── Init ─── */
  function init() {
    load();
    renderContent();
  }

  /* ─── Storage ─── */
  function load() {
    try { records = JSON.parse(localStorage.getItem('wf_attendance') || '[]'); }
    catch { records = []; }
  }

  function save() {
    localStorage.setItem('wf_attendance', JSON.stringify(records));
    if (typeof SupabaseSync !== 'undefined') SupabaseSync.push('attendance', records);
  }

  /* ─── Helpers ─── */
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  const STATUS_COLORS = {
    Present: 'badge-green',
    Absent:  'badge-red',
    Late:    'badge-yellow',
    Leave:   'badge-blue',
  };

  /* ─── Render ─── */
  function renderContent() {
    const container = document.getElementById('attendance-content');
    if (!container) return;

    const todayDate  = today();
    const todayRecs  = records.filter(r => r.date === todayDate);
    const presentCnt = todayRecs.filter(r => r.status === 'Present').length;
    const absentCnt  = todayRecs.filter(r => r.status === 'Absent').length;
    const lateCnt    = todayRecs.filter(r => r.status === 'Late').length;
    const leaveCnt   = todayRecs.filter(r => r.status === 'Leave').length;

    container.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-blue-glow)"><i class="fa fa-calendar-day"></i></div>
          <div class="stat-info">
            <div class="stat-value">${Utils.formatDate(todayDate)}</div>
            <div class="stat-label">Today Date</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-green-glow)"><i class="fa fa-circle-check"></i></div>
          <div class="stat-info">
            <div class="stat-value">${presentCnt}</div>
            <div class="stat-label">Present</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-red-glow)"><i class="fa fa-circle-xmark"></i></div>
          <div class="stat-info">
            <div class="stat-value">${absentCnt}</div>
            <div class="stat-label">Absent</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-gold-glow)"><i class="fa fa-clock"></i></div>
          <div class="stat-info">
            <div class="stat-value">${lateCnt + leaveCnt}</div>
            <div class="stat-label">Late / Leave</div>
          </div>
        </div>
      </div>

      <!-- Tabs: Take Attendance / View Records -->
      <div class="tab-switcher" style="margin-bottom:1.5rem;">
        <button id="att-tab-take"   class="tab-switch-btn active" onclick="Attendance.switchView('take')">
          <i class="fa fa-pen-to-square"></i> Attendance take
        </button>
        <button id="att-tab-report" class="tab-switch-btn" onclick="Attendance.switchView('report')">
          <i class="fa fa-chart-bar"></i> Report
        </button>
      </div>

      <!-- Take Attendance Panel -->
      <div id="att-panel-take">
        <div class="filter-bar">
          <div class="filter-group">
            <label>Date</label>
            <input type="date" id="att-date" value="${todayDate}" onchange="Attendance.loadAttendanceSheet()" />
          </div>
          <div class="filter-group">
            <label>Type</label>
            <select id="att-type" onchange="Attendance.loadAttendanceSheet()">
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div class="filter-group" id="att-batch-wrapper">
            <label>Batch</label>
            <select id="att-batch" onchange="Attendance.loadAttendanceSheet()">
              <option value="">All Batches</option>
              ${getBatchOptions()}
            </select>
          </div>
          <button class="btn-primary" onclick="Attendance.saveAllAttendance()">
            <i class="fa fa-save"></i> Save
          </button>
          <button class="btn-secondary" onclick="Attendance.markAllPresent()">
            <i class="fa fa-check-double"></i> Mark All Present
          </button>
        </div>

        <div id="att-sheet-wrapper">
          <!-- loaded dynamically -->
        </div>
      </div>

      <!-- Report Panel (hidden initially) -->
      <div id="att-panel-report" class="hidden">
        <div class="filter-bar">
          <div class="filter-group">
            <label>Start Date</label>
            <input type="date" id="att-from" value="${todayDate}" />
          </div>
          <div class="filter-group">
            <label>End Date</label>
            <input type="date" id="att-to" value="${todayDate}" />
          </div>
          <div class="filter-group">
            <label>Type</label>
            <select id="att-rep-type">
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button class="btn-primary" onclick="Attendance.loadReport()">
            <i class="fa fa-search"></i> View Report
          </button>
          <button class="btn-secondary" onclick="Attendance.exportExcel()">
            <i class="fa fa-file-excel"></i> Excel
          </button>
          <button class="btn-secondary" onclick="window.print()">
            <i class="fa fa-print"></i> Print
          </button>
        </div>
        <div id="att-report-wrapper"></div>
      </div>
    `;

    loadAttendanceSheet();
  }

  function getBatchOptions() {
    if (typeof Students === 'undefined') return '';
    const batches = [...new Set(Students.getAll().map(s => s.batch).filter(Boolean))];
    return batches.map(b => `<option value="${b}">${b}</option>`).join('');
  }

  /* ─── Switch view ─── */
  function switchView(view) {
    document.getElementById('att-panel-take').classList.toggle('hidden', view !== 'take');
    document.getElementById('att-panel-report').classList.toggle('hidden', view !== 'report');
    document.getElementById('att-tab-take').classList.toggle('active', view === 'take');
    document.getElementById('att-tab-report').classList.toggle('active', view === 'report');
    if (view === 'report') loadReport();
  }

  /* ─── Load Attendance Sheet ─── */
  function loadAttendanceSheet() {
    const date    = document.getElementById('att-date')?.value || today();
    const type    = document.getElementById('att-type')?.value || 'student';
    const batch   = document.getElementById('att-batch')?.value || '';

    // Toggle batch selector
    const bw = document.getElementById('att-batch-wrapper');
    if (bw) bw.style.display = type === 'student' ? '' : 'none';

    // Get entities
    let entities = [];
    if (type === 'student' && typeof Students !== 'undefined') {
      entities = Students.getAll().filter(s => !batch || s.batch === batch);
    } else if (type === 'staff' && typeof HRStaff !== 'undefined') {
      entities = HRStaff.getAll().filter(s => s.status === 'Active');
    }

    const wrapper = document.getElementById('att-sheet-wrapper');
    if (!wrapper) return;

    if (!entities.length) {
      wrapper.innerHTML = `<div class="empty-state"><p>No ${type === 'student' ? 'Student' : 'Staff'} not found।</p></div>`;
      return;
    }

    wrapper.innerHTML = `
      <table class="data-table attendance-sheet" id="att-sheet-table">
        <thead>
          <tr>
            <th>#</th>
            <th>ID</th>
            <th>Name</th>
            ${type === 'student' ? '<th>Batch</th>' : '<th>Role</th>'}
            <th>Attendance</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${entities.map((e, i) => {
            const existingRec = records.find(r => r.date === date && r.entityId === (e.studentId || e.staffId) && r.type === type);
            const status = existingRec?.status || 'Present';
            const note   = existingRec?.note || '';
            const eid    = e.studentId || e.staffId;
            return `
              <tr data-entity-id="${eid}">
                <td>${i + 1}</td>
                <td><code>${eid}</code></td>
                <td><strong>${e.name}</strong></td>
                <td>${e.batch || e.role || '—'}</td>
                <td>
                  <div class="att-status-btns">
                    ${['Present','Absent','Late','Leave'].map(s => `
                      <button class="att-btn ${status === s ? 'att-btn-' + s.toLowerCase() + ' active' : ''}"
                        onclick="Attendance.setStatus(this,'${s}')">
                        ${s === 'Present' ? '✓ Present' : s === 'Absent' ? '✗ Absent' : s === 'Late' ? '⏰ Late' : '📋 Leave'}
                      </button>`).join('')}
                  </div>
                </td>
                <td><input type="text" class="att-note-input" value="${note}" placeholder="Notes..." /></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function setStatus(btn, status) {
    const row = btn.closest('tr');
    row.querySelectorAll('.att-btn').forEach(b => b.className = 'att-btn');
    btn.className = `att-btn att-btn-${status.toLowerCase()} active`;
  }

  function markAllPresent() {
    document.querySelectorAll('#att-sheet-table tbody tr').forEach(row => {
      const presentBtn = row.querySelector('.att-btn');
      if (presentBtn) setStatus(presentBtn, 'Present');
    });
  }

  /* ─── Save All ─── */
  function saveAllAttendance() {
    const date  = document.getElementById('att-date')?.value || today();
    const type  = document.getElementById('att-type')?.value || 'student';
    const rows  = document.querySelectorAll('#att-sheet-table tbody tr');

    let count = 0;
    rows.forEach(row => {
      const entityId  = row.dataset.entityId;
      if (!entityId) return;
      const activeBtn = row.querySelector('.att-btn.active');
      const status    = activeBtn ? (['Present','Absent','Late','Leave'].find(s =>
        activeBtn.className.includes(s.toLowerCase())) || 'Present') : 'Present';
      const note      = row.querySelector('.att-note-input')?.value.trim() || '';
      const entityName = row.querySelector('strong')?.textContent || '';
      const batchRole  = row.querySelectorAll('td')[3]?.textContent.trim() || '';

      // Remove existing record for same date+entity
      records = records.filter(r => !(r.date === date && r.entityId === entityId && r.type === type));
      records.push({
        id: Utils.generateId(),
        date, type, entityId, entityName,
        batch: type === 'student' ? batchRole : '',
        role:  type === 'staff'   ? batchRole : '',
        status, note,
        createdAt: new Date().toISOString(),
      });
      count++;
    });

    save();
    Utils.toast(`${count} people Attendance Save done/happened ✓`, 'success');
    renderContent();
  }

  /* ─── Report ─── */
  function loadReport() {
    const from = document.getElementById('att-from')?.value;
    const to   = document.getElementById('att-to')?.value;
    const type = document.getElementById('att-rep-type')?.value || 'student';

    const filtered = records.filter(r => r.type === type && r.date >= from && r.date <= to);
    const wrapper  = document.getElementById('att-report-wrapper');
    if (!wrapper) return;

    if (!filtered.length) {
      wrapper.innerHTML = `<div class="empty-state"><p>No record found in selected time।</p></div>`;
      return;
    }

    // Group by entity
    const entityMap = {};
    filtered.forEach(r => {
      if (!entityMap[r.entityId]) {
        entityMap[r.entityId] = { name: r.entityName, id: r.entityId, Present: 0, Absent: 0, Late: 0, Leave: 0 };
      }
      entityMap[r.entityId][r.status]++;
    });

    wrapper.innerHTML = `
      <table class="data-table" id="att-report-table">
        <thead>
          <tr>
            <th>ID</th><th>Name</th>
            <th class="text-green">Present</th>
            <th class="text-red">Absent</th>
            <th class="text-yellow">Late</th>
            <th>Leave</th>
            <th>Total</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(entityMap).map(e => {
            const total = e.Present + e.Absent + e.Late + e.Leave;
            const pct   = total ? Math.round(((e.Present + e.Late) / total) * 100) : 0;
            return `
              <tr>
                <td><code>${e.id}</code></td>
                <td><strong>${e.name}</strong></td>
                <td class="text-green">${e.Present}</td>
                <td class="text-red">${e.Absent}</td>
                <td class="text-yellow">${e.Late}</td>
                <td>${e.Leave}</td>
                <td>${total}</td>
                <td>
                  <div class="progress-bar-wrap">
                    <div class="progress-bar" style="width:${pct}%;background:${pct >= 75 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)'}"></div>
                    <span>${pct}%</span>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  /* ─── Export Excel ─── */
  function exportExcel() {
    const from = document.getElementById('att-from')?.value || today();
    const to   = document.getElementById('att-to')?.value   || today();
    const type = document.getElementById('att-rep-type')?.value || 'student';

    const data = records.filter(r => r.type === type && r.date >= from && r.date <= to);
    if (!data.length) { Utils.toast('No data available', 'error'); return; }

    const rows = data.map(r => ({
      'Date': r.date, 'ID': r.entityId, 'Name': r.entityName,
      'Type': r.type, 'Batch/Role': r.batch || r.role,
      'Status': r.status, 'Notes': r.note,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${from}-${to}.xlsx`);
  }

  /* ─── Monthly stats for dashboard ─── */
  function getMonthSummary() {
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = records.filter(r => r.date.startsWith(ym));
    const present = thisMonth.filter(r => r.status === 'Present').length;
    const total   = thisMonth.length;
    return { present, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }

  return { init, load, renderContent, loadAttendanceSheet, switchView,
           setStatus, markAllPresent, saveAllAttendance, loadReport,
           exportExcel, getMonthSummary };

})();
