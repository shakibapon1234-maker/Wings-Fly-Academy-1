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
    // SupabaseSync থেকে লোড করো — আগের wf_attendance key থেকে migrate করো যদি থাকে
    if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined' && DB.attendance) {
      records = SupabaseSync.getAll(DB.attendance) || [];
      // Legacy migration: পুরনো wf_attendance key থেকে এক বারের জন্য migrate
      const legacy = localStorage.getItem('wf_attendance');
      if (legacy && records.length === 0) {
        try {
          const legacyRecords = JSON.parse(legacy) || [];
          if (legacyRecords.length > 0) {
            legacyRecords.forEach(r => {
              if (!r.id) r.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              SupabaseSync.insert(DB.attendance, r);
            });
            records = SupabaseSync.getAll(DB.attendance) || [];
            localStorage.removeItem('wf_attendance'); // migrate হয়ে গেলে পুরনোটা সরাও
          }
        } catch { /* ignore */ }
      }
    } else {
      try { records = JSON.parse(localStorage.getItem('wf_attendance') || '[]'); }
      catch { records = []; }
    }
  }

  function save() {
    // এখন SupabaseSync দিয়েই সব হবে — আলাদা localStorage নয়
    // records array-টা SupabaseSync-এ আছে, তাই শুধু dispatchEvent করো
    // (individual insert/update ইতিমধ্যে SupabaseSync এ হয়ে গেছে)
    // SupabaseSync-এ insert/update ইতিমধ্যে হয়ে গেছে — আলাদা localStorage write দরকার নেই
    try { /* no-op: legacy localStorage write removed */ } catch { /* ignore */ }
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
          <button class="export-btn export-btn-print" onclick="Attendance.smartPrint()">
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
                <tr data-entity-id="${eid}" data-name="${Utils.esc(s.name)}" data-batch="${s.batch || ''}">
                  <td style="text-align:center;color:var(--text-muted)">${i + 1}</td>
                  <td><span class="badge badge-primary">${eid}</span></td>
                  <td><strong>${Utils.esc(s.name)}</strong></td>
                  <td style="color:var(--text-secondary)">${Utils.esc(s.phone || '—')}</td>
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
      <div class="att-filter-section" style="flex-wrap:wrap;gap:10px;">
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-layer-group"></i> BATCH</label>
          <select id="att-blank-batch" class="att-filter-select">
            <option value="">Select Batch...</option>
            ${getBatches().map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar-days"></i> কত দিনের শিট (কাস্টম)</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="number" id="att-blank-days" class="att-filter-input" value="26" min="1" max="31" style="width:80px;text-align:center;font-weight:700;" />
            <span style="color:var(--text-muted);font-size:0.8rem;">দিন</span>
          </div>
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-calendar"></i> মাস / সেশন লেবেল</label>
          <input type="text" id="att-blank-label" class="att-filter-input" placeholder="e.g. January 2026" />
        </div>
        <div class="att-filter-group">
          <label class="att-filter-label"><i class="fa fa-hashtag"></i> শুরুর তারিখ (ঐচ্ছিক)</label>
          <input type="date" id="att-blank-startdate" class="att-filter-input" value="${today()}" />
        </div>
      </div>

      <!-- 4 Sheet Type Cards -->
      <div class="blank-sheet-cards">
        <div class="sheet-type-card" onclick="Attendance.generateBlankSheet('portrait')">
          <div class="sheet-icon">📄</div>
          <div class="sheet-info">
            <div class="sheet-name">Portrait Sheet</div>
            <div class="sheet-desc bn">A4 Portrait — ছোট batch (≤15 students)</div>
          </div>
          <i class="fa fa-chevron-right sheet-arrow"></i>
        </div>
        <div class="sheet-type-card" onclick="Attendance.generateBlankSheet('landscape')">
          <div class="sheet-icon">📋</div>
          <div class="sheet-info">
            <div class="sheet-name">Landscape Sheet</div>
            <div class="sheet-desc bn">A4 Landscape — বেশি columns/students</div>
          </div>
          <i class="fa fa-chevron-right sheet-arrow"></i>
        </div>
        <div class="sheet-type-card" onclick="Attendance.generateBlankSheet('grid')">
          <div class="sheet-icon">🗓️</div>
          <div class="sheet-info">
            <div class="sheet-name">Monthly Grid</div>
            <div class="sheet-desc">Calendar-style grid with all 31 days</div>
          </div>
          <i class="fa fa-chevron-right sheet-arrow"></i>
        </div>
        <div class="sheet-type-card" onclick="Attendance.generateBlankSheet('signature')">
          <div class="sheet-icon">🖊️</div>
          <div class="sheet-info">
            <div class="sheet-name">Signature Sheet</div>
            <div class="sheet-desc">Name + wide signature column — formal</div>
          </div>
          <i class="fa fa-chevron-right sheet-arrow"></i>
        </div>
      </div>

      <div id="att-blank-result" class="att-sheet-area"></div>
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
      const existingIdx = records.findIndex(r => r.date === date && r.entityId === entityId && r.type === 'student');
      const newRecord = {
        id: existingIdx >= 0 ? records[existingIdx].id : (typeof Utils !== 'undefined' ? Utils.generateId() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
        date, type: 'student', entityId, entityName, batch, status,
        createdAt: existingIdx >= 0 ? (records[existingIdx].createdAt || new Date().toISOString()) : new Date().toISOString(),
        person_id: entityId,
        person_name: entityName,
        note: '',
      };

      if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined' && DB.attendance) {
        if (existingIdx >= 0) {
          // আগের record আপডেট করো
          SupabaseSync.update(DB.attendance, newRecord.id, newRecord);
          records[existingIdx] = newRecord;
        } else {
          // নতুন insert
          SupabaseSync.insert(DB.attendance, newRecord);
          records.push(newRecord);
        }
      } else {
        // Fallback: SupabaseSync নেই
        records = records.filter(r => !(r.date === date && r.entityId === entityId && r.type === 'student'));
        records.push(newRecord);
      }
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
    // সর্বশেষ তারিখের রেকর্ড আগে (latest on top)
    filtered = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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
            <td><strong>${Utils.esc(e.name)}</strong></td>
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
            <td>${i+1}</td><td><strong>${Utils.esc(e.name)}</strong></td>
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
  function generateBlankSheet(sheetType = 'portrait') {
    const batch = document.getElementById('att-blank-batch')?.value;
    const daysCount = Math.min(31, Math.max(1, parseInt(document.getElementById('att-blank-days')?.value || '26', 10)));
    const sessionLabel = document.getElementById('att-blank-label')?.value || '';
    const startDateVal = document.getElementById('att-blank-startdate')?.value || '';
    const wrapper = document.getElementById('att-blank-result');

    if (!wrapper || !batch) {
      if (typeof Utils !== 'undefined') Utils.toast('প্রথমে একটি Batch সিলেক্ট করুন', 'warn');
      return;
    }

    const students = getStudents().filter(s => s.batch === batch);
    if (!students.length) {
      wrapper.innerHTML = `<div class="att-empty-state"><div class="att-empty-text">Batch ${batch}-এ কোনো Student নেই</div></div>`;
      return;
    }

    const cfg = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
      ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = cfg.academy_name || 'Wings Fly Aviation Academy';
    const logoUrl     = cfg.logo_url || '';

    // Build date headers if start date given
    const days = Array.from({ length: daysCount }, (_, i) => {
      if (startDateVal) {
        const d = new Date(startDateVal);
        d.setDate(d.getDate() + i);
        return { num: i + 1, label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) };
      }
      return { num: i + 1, label: String(i + 1) };
    });

    // Store data for print
    wrapper._printData = { batch, daysCount, sessionLabel, startDateVal, sheetType, students, academyName, logoUrl, days };
    wrapper._sheetType = sheetType;

    // Preview in modal
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:36px;object-fit:contain;vertical-align:middle;" />`
      : `<span style="font-size:1.2rem;">✈</span>`;

    const headerHtml = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:10px 14px;background:rgba(0,212,255,0.07);border-radius:8px;border:1px solid rgba(0,212,255,0.15);">
        ${logoHtml}
        <div style="flex:1;">
          <div style="font-weight:800;color:#00d4ff;font-size:0.95rem;">${academyName}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">
            Batch: <strong>${batch}</strong>
            ${sessionLabel ? ` &nbsp;|&nbsp; ${sessionLabel}` : ''}
            &nbsp;|&nbsp; দিন: <strong>${daysCount}</strong>
            &nbsp;|&nbsp; ছাত্র: <strong>${students.length}</strong>
          </div>
        </div>
        <span style="background:#f7a800;color:#000;padding:3px 10px;border-radius:4px;font-size:0.75rem;font-weight:700;">${sheetType.toUpperCase()}</span>
      </div>`;

    let tableHTML = '';

    if (sheetType === 'portrait') {
      const showDays = days.slice(0, Math.min(daysCount, 15));
      tableHTML = `${headerHtml}
        <div style="overflow-x:auto" id="att-blank-preview-area">
          <table class="att-sheet-table" style="font-size:0.75rem">
            <thead><tr>
              <th style="width:30px;text-align:center">#</th>
              <th style="min-width:130px">নাম</th>
              <th style="min-width:80px">কোর্স</th>
              ${showDays.map(d => `<th style="width:30px;text-align:center;padding:4px 2px;">${d.label}</th>`).join('')}
              <th style="width:36px;text-align:center">মোট</th>
            </tr></thead>
            <tbody>${students.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><strong>${Utils.esc(s.name)}</strong></td>
                <td style="font-size:0.7rem;color:var(--text-muted)">${s.course || '—'}</td>
                ${showDays.map(() => `<td style="border:1px solid rgba(0,212,255,0.12);min-height:26px;"></td>`).join('')}
                <td style="border:1px solid rgba(0,212,255,0.12);"></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`;

    } else if (sheetType === 'landscape') {
      tableHTML = `${headerHtml}
        <div style="overflow-x:auto" id="att-blank-preview-area">
          <table class="att-sheet-table" style="font-size:0.68rem">
            <thead><tr>
              <th style="width:26px;text-align:center">#</th>
              <th style="min-width:110px">নাম</th>
              <th style="min-width:70px">কোর্স</th>
              <th style="min-width:50px">ID</th>
              ${days.map(d => `<th style="width:24px;text-align:center;padding:4px 1px;">${d.label}</th>`).join('')}
              <th style="width:32px;text-align:center;">মোট</th>
            </tr></thead>
            <tbody>${students.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><strong>${Utils.esc(s.name)}</strong></td>
                <td style="font-size:0.65rem;color:var(--text-muted)">${s.course || '—'}</td>
                <td style="font-size:0.62rem;color:var(--text-muted)">${s.student_id || ''}</td>
                ${days.map(() => `<td style="border:1px solid rgba(0,212,255,0.1);"></td>`).join('')}
                <td style="border:1px solid rgba(0,212,255,0.12);"></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`;

    } else if (sheetType === 'grid') {
      tableHTML = `${headerHtml}
        <div style="overflow-x:auto" id="att-blank-preview-area">
          <table class="att-sheet-table" style="font-size:0.68rem">
            <thead><tr>
              <th style="width:28px;text-align:center">#</th>
              <th style="min-width:110px">নাম</th>
              <th style="min-width:70px">কোর্স</th>
              ${days.map(d => `<th style="width:24px;text-align:center;padding:3px 1px;font-size:0.62rem">${d.label}</th>`).join('')}
              <th style="width:30px;text-align:center;">P</th>
              <th style="width:30px;text-align:center;">A</th>
            </tr></thead>
            <tbody>${students.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td><strong>${Utils.esc(s.name)}</strong></td>
                <td style="font-size:0.65rem;color:var(--text-muted)">${s.course || '—'}</td>
                ${days.map(() => `<td style="border:1px solid rgba(0,212,255,0.08);"></td>`).join('')}
                <td style="border:1px solid rgba(0,255,136,0.2);"></td>
                <td style="border:1px solid rgba(255,71,87,0.2);"></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`;

    } else if (sheetType === 'signature') {
      tableHTML = `${headerHtml}
        <div style="overflow-x:auto" id="att-blank-preview-area">
          <table class="att-sheet-table" style="font-size:0.82rem">
            <thead><tr>
              <th style="width:40px;text-align:center">#</th>
              <th style="width:100px">Student ID</th>
              <th style="min-width:160px">নাম</th>
              <th style="min-width:100px">কোর্স</th>
              <th style="min-width:180px">স্বাক্ষর</th>
              <th style="min-width:80px">তারিখ</th>
            </tr></thead>
            <tbody>${students.map((s, i) => `
              <tr style="height:42px">
                <td style="text-align:center">${i + 1}</td>
                <td style="font-size:0.78rem;color:var(--text-muted)">${s.student_id || ''}</td>
                <td><strong>${Utils.esc(s.name)}</strong></td>
                <td style="font-size:0.78rem;color:var(--text-secondary)">${s.course || '—'}</td>
                <td style="border-bottom:1px dotted rgba(0,212,255,0.25)"></td>
                <td style="border-bottom:1px dotted rgba(0,212,255,0.25)"></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`;
    }

    // Print button below table
    wrapper.innerHTML = tableHTML + `
      <div style="text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;">
        <button onclick="Attendance.printBlankSheet()" style="background:linear-gradient(90deg,#1a3a6b,#0099cc);color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:0.9rem;font-weight:700;cursor:pointer;">
          <i class="fa fa-print"></i> এই শিট প্রিন্ট করুন
        </button>
      </div>`;
  }

  function printBlankSheet() {
    const wrapper = document.getElementById('att-blank-result');
    if (!wrapper || !wrapper._printData) {
      if (typeof Utils !== 'undefined') Utils.toast('আগে একটি শিট Generate করুন', 'warn');
      return;
    }

    const { batch, daysCount, sessionLabel, sheetType, students, academyName, logoUrl, days } = wrapper._printData;
    const isLandscape = sheetType === 'landscape' || sheetType === 'grid';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:52px;object-fit:contain;" />`
      : `<div style="width:52px;height:52px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#fff;">✈</div>`;

    let tableBody = '';
    let tableHead = '';

    if (sheetType === 'portrait') {
      const showDays = days.slice(0, 15);
      tableHead = `<tr>
        <th style="width:28px;text-align:center;">#</th>
        <th style="min-width:130px;">নাম</th>
        <th style="min-width:90px;">কোর্স</th>
        ${showDays.map(d => `<th style="width:26px;text-align:center;padding:3px 1px;">${d.label}</th>`).join('')}
        <th style="width:32px;text-align:center;">মোট</th>
      </tr>`;
      tableBody = students.map((s, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td style="font-weight:700;">${Utils.esc(s.name)}</td>
          <td style="font-size:9px;color:#555;">${s.course || '—'}</td>
          ${showDays.map(() => `<td></td>`).join('')}
          <td></td>
        </tr>`).join('');

    } else if (sheetType === 'landscape') {
      tableHead = `<tr>
        <th style="width:22px;text-align:center;">#</th>
        <th style="min-width:100px;">নাম</th>
        <th style="min-width:70px;">কোর্স</th>
        <th style="min-width:45px;">ID</th>
        ${days.map(d => `<th style="width:20px;text-align:center;padding:2px 1px;font-size:8px;">${d.label}</th>`).join('')}
        <th style="width:28px;text-align:center;">মোট</th>
      </tr>`;
      tableBody = students.map((s, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td style="font-weight:700;">${Utils.esc(s.name)}</td>
          <td style="font-size:8px;color:#555;">${s.course || '—'}</td>
          <td style="font-size:8px;color:#777;">${s.student_id || ''}</td>
          ${days.map(() => `<td></td>`).join('')}
          <td></td>
        </tr>`).join('');

    } else if (sheetType === 'grid') {
      tableHead = `<tr>
        <th style="width:24px;text-align:center;">#</th>
        <th style="min-width:100px;">নাম</th>
        <th style="min-width:70px;">কোর্স</th>
        ${days.map(d => `<th style="width:20px;text-align:center;padding:2px 1px;font-size:8px;">${d.label}</th>`).join('')}
        <th style="width:26px;text-align:center;">P</th>
        <th style="width:26px;text-align:center;">A</th>
      </tr>`;
      tableBody = students.map((s, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td style="font-weight:700;">${Utils.esc(s.name)}</td>
          <td style="font-size:8px;color:#555;">${s.course || '—'}</td>
          ${days.map(() => `<td></td>`).join('')}
          <td></td><td></td>
        </tr>`).join('');

    } else if (sheetType === 'signature') {
      tableHead = `<tr>
        <th style="width:36px;text-align:center;">#</th>
        <th style="width:90px;">Student ID</th>
        <th style="min-width:160px;">নাম</th>
        <th style="min-width:100px;">কোর্স</th>
        <th style="min-width:160px;">স্বাক্ষর</th>
        <th style="width:72px;">তারিখ</th>
      </tr>`;
      tableBody = students.map((s, i) => `
        <tr style="height:38px;">
          <td style="text-align:center;">${i + 1}</td>
          <td style="font-size:9px;color:#555;">${s.student_id || ''}</td>
          <td style="font-weight:700;">${Utils.esc(s.name)}</td>
          <td style="font-size:9px;color:#444;">${s.course || '—'}</td>
          <td style="border-bottom:1px dotted #bbb;"></td>
          <td style="border-bottom:1px dotted #bbb;"></td>
        </tr>`).join('');
    }

    const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<title>Attendance Sheet — ${batch}</title>
<style>
  @page { size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; margin: 14mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #111; background: #fff; }

  .sheet-header { display:flex; align-items:center; gap:14px; border-bottom:2.5px solid #1a3a6b; padding-bottom:10px; margin-bottom:12px; }
  .header-logo { flex-shrink:0; }
  .header-info { flex:1; }
  .header-info h1 { font-size:14px; font-weight:900; color:#1a3a6b; letter-spacing:0.5px; }
  .header-info .sub { font-size:9px; color:#555; margin-top:3px; }
  .header-meta { text-align:right; font-size:9px; color:#555; }
  .header-meta .meta-label { font-weight:700; color:#1a3a6b; font-size:10px; }

  .sheet-title-bar { background:#1a3a6b; color:#fff; padding:6px 12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-radius:4px; }
  .sheet-title-bar h2 { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; }
  .sheet-info-badges { display:flex; gap:8px; }
  .badge { background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px; font-size:8px; font-weight:700; }

  table { width:100%; border-collapse:collapse; font-size:${isLandscape ? '8.5px' : '9.5px'}; }
  thead tr { background:#1a3a6b; color:#fff; }
  thead th { padding:6px 4px; font-weight:700; letter-spacing:0.3px; border:1px solid #0d2a55; text-align:left; }
  tbody tr { border-bottom:1px solid #e0e0e0; }
  tbody tr:nth-child(even) { background:#f7f9ff; }
  tbody td { padding:5px 4px; border:1px solid #d8d8d8; }
  tbody td:first-child { text-align:center; color:#777; font-size:8px; }

  .sheet-footer { margin-top:20px; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #ccc; padding-top:10px; }
  .sig-box { text-align:center; }
  .sig-line { width:140px; border-top:1.5px solid #333; margin:0 auto 4px; }
  .sig-label { font-size:8px; color:#555; font-weight:600; }
  .footer-note { font-size:8px; color:#888; }

  .legend { display:flex; gap:16px; margin-bottom:10px; font-size:8px; flex-wrap:wrap; }
  .legend-item { display:flex; align-items:center; gap:4px; }
  .legend-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="sheet-header">
    <div class="header-logo">${logoHtml}</div>
    <div class="header-info">
      <h1>${academyName}</h1>
      <div class="sub">ATTENDANCE REGISTER</div>
    </div>
    <div class="header-meta">
      <div class="meta-label">Batch: ${batch}</div>
      ${sessionLabel ? `<div>${sessionLabel}</div>` : ''}
      <div>দিন: ${daysCount} | ছাত্র: ${students.length}</div>
      <div>Print: ${printDate}</div>
    </div>
  </div>

  <!-- Title Bar -->
  <div class="sheet-title-bar">
    <h2>✦ উপস্থিতি রেজিস্টার — ${sheetType === 'signature' ? 'সাইন শিট' : sheetType === 'grid' ? 'গ্রিড শিট' : sheetType === 'landscape' ? 'ল্যান্ডস্কেপ' : 'পোর্ট্রেট'} ✦</h2>
    <div class="sheet-info-badges">
      <span class="badge">📋 ${students.length} Students</span>
      <span class="badge">📅 ${daysCount} Days</span>
    </div>
  </div>

  ${sheetType !== 'signature' ? `<div class="legend">
    <strong style="color:#1a3a6b;">কী-বোর্ড:</strong>
    <span class="legend-item"><span class="legend-dot" style="background:#22c55e;"></span> P = Present</span>
    <span class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span> A = Absent</span>
    <span class="legend-item"><span class="legend-dot" style="background:#f59e0b;"></span> L = Late</span>
    <span class="legend-item"><span class="legend-dot" style="background:#3b82f6;"></span> LV = Leave</span>
  </div>` : ''}

  <!-- Main Table -->
  <table>
    <thead>${tableHead}</thead>
    <tbody>${tableBody}</tbody>
  </table>

  <!-- Footer -->
  <div class="sheet-footer">
    <div class="footer-note">
      এটি একটি অফিসিয়াল উপস্থিতি রেজিস্টার।<br/>
      ${academyName}
    </div>
    <div style="display:flex;gap:40px;">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">শিক্ষক / ইন্সট্রাক্টর</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">অধ্যক্ষ / কর্তৃপক্ষ</div>
      </div>
    </div>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank', `width=${isLandscape ? 1100 : 860},height=960`);
    if (!win) { if (typeof Utils !== 'undefined') Utils.toast('Popup blocked! Allow popups.', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  /* ─── Smart Print (context-aware) ─── */
  function smartPrint() {
    switch (activeTab) {
      case 'mark':    printMarkedSheet(); break;
      case 'monthly': printReport('monthly'); break;
      case 'yearly':  printReport('yearly'); break;
      case 'course':  printReport('course'); break;
      case 'blank':   printBlankSheet(); break;
      default:        printMarkedSheet();
    }
  }

  function printMarkedSheet() {
    const batch = document.getElementById('att-batch-sel')?.value || '';
    const date  = document.getElementById('att-date-sel')?.value || today();
    const rows  = document.querySelectorAll('#att-sheet-table tbody tr');

    if (!batch) { if (typeof Utils !== 'undefined') Utils.toast('Batch সিলেক্ট করুন', 'warn'); return; }
    if (!rows.length) { if (typeof Utils !== 'undefined') Utils.toast('কোনো student নেই', 'warn'); return; }

    const cfg = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
      ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = cfg.academy_name || 'Wings Fly Aviation Academy';
    const logoUrl     = cfg.logo_url || '';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:52px;object-fit:contain;" />`
      : `<div style="width:52px;height:52px;background:linear-gradient(135deg,#1a3a6b,#0099cc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#fff;">✈</div>`;

    const printDate = new Date(date).toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

    // Collect data from DOM
    const students = [];
    rows.forEach((row, i) => {
      const name  = row.querySelector('td:nth-child(3) strong')?.textContent || '';
      const sid   = row.querySelector('td:nth-child(2) span')?.textContent || '';
      const course = (() => {
        const all = getStudents();
        const found = all.find(s => (s.student_id || s.id) === row.dataset.entityId);
        return found?.course || '—';
      })();
      const activeBtn = row.querySelector('.att-status-btn.active');
      let status = '—';
      if (activeBtn) {
        if (activeBtn.classList.contains('att-st-present')) status = 'P';
        else if (activeBtn.classList.contains('att-st-absent')) status = 'A';
        else if (activeBtn.classList.contains('att-st-late'))   status = 'Late';
        else if (activeBtn.classList.contains('att-st-leave'))  status = 'Leave';
      }
      students.push({ num: i + 1, name, sid, course, status });
    });

    const presentCount = students.filter(s => s.status === 'P').length;
    const absentCount  = students.filter(s => s.status === 'A').length;
    const lateCount    = students.filter(s => s.status === 'Late').length;
    const leaveCount   = students.filter(s => s.status === 'Leave').length;
    const markedCount  = students.filter(s => s.status !== '—').length;

    const tableRows = students.map(s => {
      const color = s.status === 'P' ? '#15803d' : s.status === 'A' ? '#b91c1c' : s.status === 'Late' ? '#b45309' : s.status === 'Leave' ? '#1d4ed8' : '#666';
      const bg    = s.status === 'P' ? '#f0fdf4' : s.status === 'A' ? '#fef2f2' : s.status === 'Late' ? '#fffbeb' : '#eff6ff';
      return `<tr style="background:${s.status !== '—' ? bg : '#fff'}">
        <td style="text-align:center;color:#777;">${s.num}</td>
        <td style="font-weight:700;">${Utils.esc(s.name)}</td>
        <td style="font-size:9px;color:#555;">${s.sid}</td>
        <td style="font-size:9px;color:#444;">${s.course}</td>
        <td style="text-align:center;font-weight:800;color:${color};font-size:11px;">${s.status}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8"/>
<title>Attendance — ${batch} — ${date}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10px; color:#111; background:#fff; }

  .header { display:flex; align-items:center; gap:14px; border-bottom:2.5px solid #1a3a6b; padding-bottom:10px; margin-bottom:12px; }
  .header-info h1 { font-size:14px; font-weight:900; color:#1a3a6b; }
  .header-info .sub { font-size:8.5px; color:#555; margin-top:2px; }
  .header-meta { text-align:right; font-size:8.5px; color:#555; margin-left:auto; }
  .header-meta .big { font-size:11px; font-weight:800; color:#1a3a6b; }

  .title-bar { background:#1a3a6b; color:#fff; padding:7px 12px; display:flex; justify-content:space-between; align-items:center; border-radius:4px; margin-bottom:10px; }
  .title-bar h2 { font-size:10px; font-weight:800; letter-spacing:1px; }

  .summary-row { display:flex; gap:10px; margin-bottom:12px; }
  .sum-box { flex:1; text-align:center; border-radius:6px; padding:8px; }
  .sum-box .s-num { font-size:16px; font-weight:900; }
  .sum-box .s-lbl { font-size:7.5px; font-weight:700; margin-top:2px; text-transform:uppercase; letter-spacing:0.5px; }
  .sum-present { background:#f0fdf4; border:1.5px solid #86efac; color:#15803d; }
  .sum-absent  { background:#fef2f2; border:1.5px solid #fca5a5; color:#b91c1c; }
  .sum-late    { background:#fffbeb; border:1.5px solid #fcd34d; color:#b45309; }
  .sum-leave   { background:#eff6ff; border:1.5px solid #93c5fd; color:#1d4ed8; }
  .sum-total   { background:#f8fafc; border:1.5px solid #cbd5e1; color:#1a3a6b; }

  table { width:100%; border-collapse:collapse; font-size:9.5px; }
  thead tr { background:#1a3a6b; color:#fff; }
  thead th { padding:7px 5px; font-weight:700; border:1px solid #0d2a55; text-align:left; }
  tbody tr { border-bottom:1px solid #e5e7eb; }
  tbody td { padding:6px 5px; border:1px solid #e5e7eb; }

  .footer { margin-top:20px; display:flex; justify-content:space-between; border-top:1px solid #ccc; padding-top:10px; }
  .sig-box { text-align:center; }
  .sig-line { width:130px; border-top:1.5px solid #333; margin:0 auto 4px; }
  .sig-label { font-size:8px; color:#555; font-weight:600; }
</style>
</head>
<body>

  <div class="header">
    ${logoHtml}
    <div class="header-info">
      <h1>${academyName}</h1>
      <div class="sub">DAILY ATTENDANCE REGISTER</div>
    </div>
    <div class="header-meta">
      <div class="big">Batch: ${batch}</div>
      <div>${printDate}</div>
      <div>Total Students: ${students.length}</div>
    </div>
  </div>

  <div class="title-bar">
    <h2>✦ উপস্থিতি রেজিস্টার — ${printDate} ✦</h2>
    <span style="font-size:8px;">${markedCount}/${students.length} জন চিহ্নিত</span>
  </div>

  <!-- Summary -->
  <div class="summary-row">
    <div class="sum-box sum-present"><div class="s-num">${presentCount}</div><div class="s-lbl">✓ উপস্থিত</div></div>
    <div class="sum-box sum-absent"><div class="s-num">${absentCount}</div><div class="s-lbl">✗ অনুপস্থিত</div></div>
    <div class="sum-box sum-late"><div class="s-num">${lateCount}</div><div class="s-lbl">⏰ দেরিতে</div></div>
    <div class="sum-box sum-leave"><div class="s-num">${leaveCount}</div><div class="s-lbl">📋 ছুটি</div></div>
    <div class="sum-box sum-total"><div class="s-num">${students.length}</div><div class="s-lbl">মোট ছাত্র</div></div>
  </div>

  <table>
    <thead><tr>
      <th style="width:28px;text-align:center;">#</th>
      <th style="min-width:130px;">নাম</th>
      <th style="width:80px;">Student ID</th>
      <th style="min-width:90px;">কোর্স</th>
      <th style="width:50px;text-align:center;">অবস্থা</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    <div style="font-size:8px;color:#888;">
      Wings Fly Aviation Academy<br/>
      এটি একটি অফিসিয়াল উপস্থিতি নথি।
    </div>
    <div style="display:flex;gap:40px;">
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">শিক্ষক / ইন্সট্রাক্টর</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">অধ্যক্ষ / কর্তৃপক্ষ</div></div>
    </div>
  </div>

</body></html>`;

    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { if (typeof Utils !== 'undefined') Utils.toast('Popup blocked!', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  function printReport(type) {
    const resultId = `att-${type}-result`;
    const el = document.getElementById(resultId);
    if (!el || !el.querySelector('table')) {
      if (typeof Utils !== 'undefined') Utils.toast('আগে Report লোড করুন', 'warn');
      return;
    }
    const cfg = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
      ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};
    const academyName = cfg.academy_name || 'Wings Fly Aviation Academy';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>${type} Report — ${academyName}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10px; padding:0; }
  h1 { font-size:14px; font-weight:900; color:#1a3a6b; margin-bottom:4px; }
  .sub { font-size:9px; color:#555; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; font-size:9.5px; }
  thead tr { background:#1a3a6b; color:#fff; }
  thead th { padding:7px 6px; font-weight:700; border:1px solid #0d2a55; }
  tbody tr { border-bottom:1px solid #e5e7eb; }
  tbody tr:nth-child(even) { background:#f7f9ff; }
  tbody td { padding:6px; border:1px solid #e5e7eb; }
</style>
</head>
<body>
  <h1>${academyName}</h1>
  <div class="sub">${type.charAt(0).toUpperCase() + type.slice(1)} Attendance Report &nbsp;—&nbsp; Printed: ${new Date().toLocaleDateString('en-GB')}</div>
  ${el.innerHTML}
</body></html>`;

    const win = window.open('', '_blank', 'width=860,height=900');
    if (!win) { if (typeof Utils !== 'undefined') Utils.toast('Popup blocked!', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
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
    smartPrint, printMarkedSheet, printReport,
    exportCSV, getMonthSummary,
  };

})();
window.Attendance = Attendance;
