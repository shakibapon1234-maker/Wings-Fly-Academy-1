/* ============================================================
   Wings Fly Academy — Student Portal Dashboard UI Engine
   ============================================================ */

const StudentDashboard = (() => {
  'use strict';

  let _student = null;
  let _supabase = null;

  // ── Initialize Dashboard ──
  async function init() {
    _student = window.StudentAuth.getSession();
    if (!_student) {
      // Redirect to login view if no session
      document.getElementById('login-view').style.display = 'block';
      document.getElementById('dashboard-view').style.display = 'none';
      return;
    }

    // Show dashboard layout
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    // Render basic layout header info
    document.getElementById('student-name-display').textContent = _student.student_name || 'Student';
    document.getElementById('student-meta-display').innerHTML = `
      <span><i class="fa fa-id-card"></i> ID: ${_student.student_no || '—'}</span>
      <span><i class="fa fa-layer-group"></i> ব্যাচ: ${_student.batch || '—'}</span>
      <span><i class="fa fa-graduation-cap"></i> কোর্স: ${_student.course || '—'}</span>
    `;

    // Connect to Supabase
    const creds = window.WFA_STANDALONE_SUPABASE;
    if (creds && creds.url && creds.key && window.supabase) {
      _supabase = window.supabase.createClient(creds.url, creds.key);
    }

    if (!_supabase) {
      _showToast('সার্ভারের সাথে সংযোগ স্থাপন সম্ভব হয়নি!', 'error');
      return;
    }

    // Load initial tab (Attendance)
    await loadTab('attendance');
  }

  // ── Load Tab Data & Render ──
  async function loadTab(tabId) {
    // UI active class toggle
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.toggle('active', section.id === `section-${tabId}`);
    });

    const container = document.getElementById(`container-${tabId}`);
    container.innerHTML = `
      <div style="text-align:center; padding: 40px;">
        <div class="loading-spinner"></div>
        <p style="margin-top:12px; color:var(--text-secondary)">ডাটা লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
      </div>
    `;

    try {
      if (tabId === 'attendance') {
        await _renderAttendance(container);
      } else if (tabId === 'results') {
        await _renderResults(container);
      } else if (tabId === 'fees') {
        await _renderFees(container);
      }
    } catch (err) {
      console.error('[Dashboard] Load tab error:', err);
      container.innerHTML = `
        <div class="error-msg">
          <i class="fa fa-exclamation-triangle"></i>
          <span>ডাটা লোড করতে সমস্যা হয়েছে! আবার চেষ্টা করুন। (${err.message || err})</span>
        </div>
      `;
    }
  }

  // ── Render Attendance Tab ──
  async function _renderAttendance(container) {
    const { data: records, error } = await _supabase
      .from('attendance')
      .select('*')
      .or(`person_id.eq.${_student.student_id},entityId.eq.${_student.student_id},entityId.eq.${_student.student_no}`)
      .order('date', { ascending: false });

    if (error) throw error;

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="no-data-msg">
          <i class="fa fa-calendar-times"></i>
          কোনো উপস্থিতির রেকর্ড পাওয়া যায়নি।
        </div>
      `;
      return;
    }

    // Calculate statistics
    let present = 0, absent = 0, late = 0, leave = 0;
    records.forEach(r => {
      const status = String(r.status).toLowerCase();
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else if (status === 'leave') leave++;
    });

    const totalDays = records.length;
    const rate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;

    let html = `
      <!-- Stats Cards -->
      <div class="grid-cards animate-fade-in">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fa fa-percent"></i></div>
          <div class="stat-details">
            <h3>উপস্থিতির হার</h3>
            <div class="value">${rate}%</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa fa-check-circle"></i></div>
          <div class="stat-details">
            <h3>মোট উপস্থিত</h3>
            <div class="value">${present} দিন</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="fa fa-times-circle"></i></div>
          <div class="stat-details">
            <h3>মোট অনুপস্থিত</h3>
            <div class="value">${absent} দিন</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="fa fa-clock"></i></div>
          <div class="stat-details">
            <h3>মোট লেট/ছুটি</h3>
            <div class="value">${late + leave} দিন</div>
          </div>
        </div>
      </div>

      <!-- History Table -->
      <div class="table-card animate-fade-in">
        <div class="table-header-title">
          <i class="fa fa-history"></i> উপস্থিতির ইতিহাস
        </div>
        <div style="overflow-x: auto;">
          <table class="attendance-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>স্ট্যাটাস</th>
                <th>মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
    `;

    records.forEach(r => {
      const statusClass = String(r.status).toLowerCase();
      let statusText = r.status;
      if (statusClass === 'present') statusText = 'উপস্থিত (Present)';
      else if (statusClass === 'absent') statusText = 'অনুপস্থিত (Absent)';
      else if (statusClass === 'late') statusText = 'বিলম্ব (Late)';
      else if (statusClass === 'leave') statusText = 'ছুটি (Leave)';

      html += `
        <tr>
          <td><strong>${_formatDate(r.date)}</strong></td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td style="color:var(--text-secondary)">${_escapeHtml(r.note || '—')}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // ── Render Results (Exams) Tab ──
  async function _renderResults(container) {
    const { data: records, error } = await _supabase
      .from('exams')
      .select('*')
      .eq('student_id', _student.student_no)
      .order('exam_date', { ascending: false });

    if (error) throw error;

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="no-data-msg">
          <i class="fa fa-graduation-cap"></i>
          কোনো পরীক্ষার ফলাফল পাওয়া যায়নি।
        </div>
      `;
      return;
    }

    let html = `<div class="exam-grid animate-fade-in">`;

    records.forEach(e => {
      const marks = parseFloat(e.marks) || 0;
      const progressWidth = Math.min(marks, 100);
      
      html += `
        <div class="exam-card">
          <div class="exam-card-header">
            <div>
              <div class="exam-subject">${_escapeHtml(e.subject || 'পরীক্ষার বিষয়')}</div>
              <div class="exam-date"><i class="fa fa-calendar-alt"></i> ${_formatDate(e.exam_date)}</div>
            </div>
            <div class="exam-grade">${_escapeHtml(e.grade || '—')}</div>
          </div>
          
          <div class="exam-score-wrapper">
            <div class="exam-score">${marks}<span>%</span></div>
            <span class="badge ${String(e.status).toLowerCase() === 'passed' || String(e.status).toLowerCase() === 'pass' ? 'present' : 'absent'}">
              ${_escapeHtml(e.status || '—')}
            </span>
          </div>
          
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressWidth}%"></div>
          </div>
          
          <div class="exam-note">
            <i class="fa fa-comment-alt"></i> <span>${_escapeHtml(e.note || 'মন্তব্য নেই')}</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Render Fees Tab ──
  async function _renderFees(container) {
    // 1. Fetch student master fee stats
    const { data: studentRecords, error: sErr } = await _supabase
      .from('students')
      .select('total_fee, paid, due')
      .eq('id', _student.student_id);

    if (sErr) throw sErr;
    
    const feeInfo = studentRecords?.[0] || { total_fee: 0, paid: 0, due: 0 };
    const totalFee = parseFloat(feeInfo.total_fee) || 0;
    const paidAmount = parseFloat(feeInfo.paid) || 0;
    const dueAmount = parseFloat(feeInfo.due) || 0;

    // 2. Fetch payment transactions
    const { data: transactions, error: tErr } = await _supabase
      .from('finance_ledger')
      .select('*')
      .eq('ref_id', _student.student_id)
      .eq('category', 'Student Fee')
      .order('date', { ascending: false });

    if (tErr) throw tErr;

    let html = `
      <!-- Stats Cards -->
      <div class="grid-cards animate-fade-in">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fa fa-money-bill-wave"></i></div>
          <div class="stat-details">
            <h3>মোট কোর্স ফি</h3>
            <div class="value">৳${totalFee}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa fa-check-double"></i></div>
          <div class="stat-details">
            <h3>মোট পরিশোধিত</h3>
            <div class="value">৳${paidAmount}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="fa fa-hand-holding-usd"></i></div>
          <div class="stat-details">
            <h3>মোট বকেয়া</h3>
            <div class="value" style="color:var(--danger)">৳${dueAmount}</div>
          </div>
        </div>
      </div>
    `;

    // 3. Transactions list
    html += `
      <div class="table-card animate-fade-in">
        <div class="table-header-title">
          <i class="fa fa-file-invoice-dollar"></i> পেমেন্টের বিবরণী
        </div>
    `;

    if (!transactions || transactions.length === 0) {
      html += `
        <div class="no-data-msg" style="border:none; padding: 24px 0;">
          পরিশোধের কোনো বিবরণী পাওয়া যায়নি।
        </div>
      `;
    } else {
      html += `
        <div style="overflow-x: auto;">
          <table class="attendance-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>পেমেন্ট মেথড</th>
                <th>রিসিভ অ্যাকাউন্ট</th>
                <th>পরিমাণ</th>
                <th>বিবরণ/মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
      `;

      transactions.forEach(t => {
        html += `
          <tr>
            <td><strong>${_formatDate(t.date)}</strong></td>
            <td><span class="badge present">${_escapeHtml(t.method || 'Cash')}</span></td>
            <td style="color:var(--text-secondary)">${_escapeHtml(t.reference || '—')}</td>
            <td style="font-weight: 700; color:var(--success)">৳${parseFloat(t.amount) || 0}</td>
            <td style="color:var(--text-secondary)">${_escapeHtml(t.description || '—')}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Helper: Format Date ──
  function _formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // ── Helper: Escape HTML ──
  function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Helper: Show Toast ──
  function _showToast(msg, type = 'info') {
    if (typeof Utils !== 'undefined' && typeof Utils.toast === 'function') {
      Utils.toast(msg, type);
    } else {
      alert(msg);
    }
  }

  return { init, loadTab };
})();

window.StudentDashboard = StudentDashboard;
