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
      } else if (tabId === 'routine') {
        await _renderRoutine(container);
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

    // 4. Online Payment (bKash/Nagad/Bank) — submit + history
    html += `
      <div class="table-card animate-fade-in" style="margin-top:18px;">
        <div class="table-header-title" style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <span><i class="fa fa-mobile-screen-button"></i> bKash / Nagad / Bank পেমেন্ট</span>
          <button type="button" class="btn-primary" style="width:auto; padding:9px 18px; font-size:0.85rem;"
            onclick="window.StudentDashboard.openSubmitPaymentModal()">
            <i class="fa fa-plus"></i> <span>নতুন পেমেন্ট জমা দিন</span>
          </button>
        </div>
        <div id="pay-req-history" style="padding:14px 0 0;">
          <div style="text-align:center; padding:20px; color:var(--text-secondary);">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    _renderPaymentRequestHistory();
  }

  // ── Render Payment Request History (bKash/Nagad/Bank submissions) ──
  async function _renderPaymentRequestHistory() {
    const histEl = document.getElementById('pay-req-history');
    if (!histEl || !window.PaymentEngine) return;
    try {
      const requests = await window.PaymentEngine.getMyRequests(_student.student_id);
      if (!requests || requests.length === 0) {
        histEl.innerHTML = `<div class="no-data-msg" style="border:none; padding:16px 0;">এখনো কোনো অনলাইন পেমেন্ট রিকোয়েস্ট জমা দেওয়া হয়নি।</div>`;
        return;
      }
      let h = `
        <div style="overflow-x:auto;">
          <table class="attendance-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>মেথড</th>
                <th>Transaction ID</th>
                <th>পরিমাণ</th>
                <th>স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
      `;
      requests.forEach(r => {
        const status = r.status || 'pending';
        let badgeClass = 'pending', badgeText = '⏳ পেন্ডিং';
        if (status === 'approved') { badgeClass = 'paid'; badgeText = '✅ Approved'; }
        else if (status === 'rejected') { badgeClass = 'due'; badgeText = '❌ Rejected' + (r.note ? ` (${_escapeHtml(r.note)})` : ''); }
        h += `
          <tr>
            <td><strong>${_formatDate(r.submitted_at)}</strong></td>
            <td><span class="badge present">${_escapeHtml(r.method || '—')}</span></td>
            <td style="font-family:monospace;">${_escapeHtml(r.transaction_id || '—')}</td>
            <td style="font-weight:700; color:var(--success)">৳${parseFloat(r.amount) || 0}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      });
      h += `</tbody></table></div>`;
      histEl.innerHTML = h;
    } catch (err) {
      console.error('[Dashboard] Payment history load error:', err);
      histEl.innerHTML = `<div class="error-msg"><i class="fa fa-exclamation-triangle"></i><span>পেমেন্ট হিস্টোরি লোড করতে সমস্যা হয়েছে।</span></div>`;
    }
  }

  // ── Submit Payment Modal (bKash/Nagad/Bank) ──
  async function openSubmitPaymentModal() {
    if (!window.PaymentEngine) { _showToast('Payment system লোড হয়নি, পেজ রিফ্রেশ করুন।', 'error'); return; }

    let cfg;
    try { cfg = (await window.PaymentEngine.getPublicPaymentSettings()) || {}; } catch { cfg = {}; }

    if (cfg.payment_enabled === false) {
      _showToast('এই মুহূর্তে Online Payment বন্ধ আছে। অনুগ্রহ করে অফিসে যোগাযোগ করুন।', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'wfa-modal-overlay';
    overlay.id = 'pay-submit-overlay';

    const numberLines = [];
    if (cfg.bkash_number) numberLines.push(`<div><i class="fa fa-mobile-screen"></i> bKash: <strong>${_escapeHtml(cfg.bkash_number)}</strong></div>`);
    if (cfg.nagad_number) numberLines.push(`<div><i class="fa fa-mobile-screen"></i> Nagad: <strong>${_escapeHtml(cfg.nagad_number)}</strong></div>`);
    if (cfg.bank_name) numberLines.push(`<div><i class="fa fa-building-columns"></i> ${_escapeHtml(cfg.bank_name)} — ${_escapeHtml(cfg.bank_account_name || '')} (${_escapeHtml(cfg.bank_account_number || '')}${cfg.bank_branch ? ', ' + _escapeHtml(cfg.bank_branch) : ''})</div>`);

    overlay.innerHTML = `
      <div class="wfa-modal-box">
        <div class="wfa-modal-header">
          <h3><i class="fa fa-mobile-screen-button"></i> পেমেন্ট জমা দিন</h3>
          <button type="button" class="wfa-modal-close" id="pay-submit-close">✕</button>
        </div>
        <div class="wfa-modal-body">
          ${numberLines.length ? `<div class="wfa-pay-numbers">${numberLines.join('')}</div>` : ''}
          <div id="pay-submit-error" class="error-msg" style="display:none;"></div>

          <div class="form-group">
            <label class="form-label">পেমেন্ট মেথড</label>
            <select id="pay-submit-method" class="form-input">
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Bank">Bank</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">পরিমাণ (৳)</label>
            <input id="pay-submit-amount" type="number" min="1" class="form-input" placeholder="যেমন: 2000" />
          </div>
          <div class="form-group">
            <label class="form-label">Transaction ID</label>
            <input id="pay-submit-txid" type="text" class="form-input" placeholder="বিকাশ/নগদ থেকে পাওয়া Transaction ID" />
          </div>
          <div class="form-group">
            <label class="form-label">যে নম্বর থেকে পাঠানো হয়েছে</label>
            <input id="pay-submit-sender" type="tel" class="form-input" placeholder="01XXXXXXXXX" />
          </div>
          <div class="form-group">
            <label class="form-label">স্ক্রিনশট (ঐচ্ছিক)</label>
            <input id="pay-submit-shot" type="file" accept="image/*" class="form-input" style="padding:8px;" />
          </div>
          <div class="form-group">
            <label class="form-label">মন্তব্য (ঐচ্ছিক)</label>
            <textarea id="pay-submit-note" class="form-input" rows="2"></textarea>
          </div>

          <button id="pay-submit-btn" class="btn-primary" type="button">
            <span>জমা দিন</span> <i class="fa fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('pay-submit-close').addEventListener('click', close);
    document.getElementById('pay-submit-btn').addEventListener('click', () => _submitPayment(close));
  }

  async function _submitPayment(closeFn) {
    const errEl   = document.getElementById('pay-submit-error');
    const btn     = document.getElementById('pay-submit-btn');
    const method  = document.getElementById('pay-submit-method').value;
    const amount  = document.getElementById('pay-submit-amount').value;
    const txid    = document.getElementById('pay-submit-txid').value.trim();
    const sender  = document.getElementById('pay-submit-sender').value.trim();
    const note    = document.getElementById('pay-submit-note').value.trim();
    const shotFile = document.getElementById('pay-submit-shot').files[0] || null;

    function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'flex'; }
    errEl.style.display = 'none';

    if (!amount || parseFloat(amount) <= 0) { showErr('সঠিক পরিমাণ লিখুন।'); return; }
    if (!txid) { showErr('Transaction ID আবশ্যক।'); return; }

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> <span>জমা হচ্ছে...</span>';

    try {
      await window.PaymentEngine.submitRequest({
        student_id:   _student.student_id,
        student_name: _student.student_name,
        batch_id:     _student.batch,
        amount:       amount,
        method:       method,
        transaction_id: txid,
        sender_number:  sender,
        note:           note,
        screenshotFile: shotFile,
      });
      _showToast('✅ পেমেন্ট রিকোয়েস্ট জমা হয়েছে। এডমিন যাচাই করার পর Approve হবে।', 'success');
      closeFn();
      _renderPaymentRequestHistory();
    } catch (err) {
      console.error('[Dashboard] submitPayment error:', err);
      showErr(err.message || 'জমা দিতে ব্যর্থ হয়েছে।');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
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

  // ── Render Routine Tab ──────────────────────────────────────
  async function _renderRoutine(container) {
    const batchId = _student.batch || '';
    if (!batchId) {
      container.innerHTML = `<div class="no-data-msg"><i class="fa fa-calendar-xmark"></i> ব্যাচ তথ্য পাওয়া যায়নি।</div>`;
      return;
    }

    let routines;
    // Use RoutineEngine standalone fetch if available, otherwise direct Supabase query
    if (typeof RoutineEngine !== 'undefined' && RoutineEngine.fetchForStudent) {
      routines = await RoutineEngine.fetchForStudent(batchId);
    } else {
      const { data, error } = await _supabase
        .from('class_routines')
        .select('*')
        .eq('batch_id', batchId)
        .eq('is_active', true);
      if (error) throw error;
      routines = data || [];
    }

    if (!routines.length) {
      container.innerHTML = `<div class="no-data-msg"><i class="fa fa-calendar-xmark"></i> এই ব্যাচের কোনো রুটিন এখনো তৈরি হয়নি।</div>`;
      return;
    }

    const DAYS = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
    const DAY_BN = { Sat:'শনি', Sun:'রবি', Mon:'সোম', Tue:'মঙ্গল', Wed:'বুধ', Thu:'বৃহস্পতি', Fri:'শুক্র' };

    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });
    routines.forEach(r => { if (byDay[r.day]) byDay[r.day].push(r); });
    DAYS.forEach(d => { byDay[d].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')); });
    const activeDays = DAYS.filter(d => byDay[d].length > 0);

    function fmt(t) {
      if (!t) return '—';
      const [h,m] = String(t).split(':').map(Number);
      if (isNaN(h)) return t;
      const suf = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${String(m||0).padStart(2,'0')} ${suf}`;
    }

    function esc(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <h3 style="margin:0 0 4px;font-size:1rem;color:var(--text-primary,#fff);">
          <i class="fa fa-calendar-week" style="color:var(--brand-primary,#00d9ff);margin-right:6px;"></i>
          সাপ্তাহিক ক্লাস রুটিন
        </h3>
        <p style="margin:0;font-size:0.82rem;color:var(--text-secondary,#aaa);">ব্যাচ: ${esc(batchId)}</p>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:320px;">
          <thead>
            <tr>
              ${activeDays.map(d => `
                <th style="background:var(--brand-primary,#00d9ff);color:#000;padding:8px 6px;text-align:center;font-size:0.8rem;border:1px solid rgba(255,255,255,0.1);">
                  ${esc(d)}<br><small style="font-weight:400;opacity:0.8;">${esc(DAY_BN[d])}</small>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr style="vertical-align:top;">
              ${activeDays.map(d => `
                <td style="padding:5px;border:1px solid rgba(255,255,255,0.08);min-width:110px;">
                  ${byDay[d].map(r => `
                    <div style="background:rgba(0,217,255,0.07);border:1px solid rgba(0,217,255,0.2);border-radius:7px;padding:6px 8px;margin-bottom:5px;">
                      <div style="font-size:0.72rem;color:var(--brand-primary,#00d9ff);font-weight:600;">${esc(fmt(r.start_time))}–${esc(fmt(r.end_time))}</div>
                      <div style="font-weight:600;font-size:0.82rem;margin:2px 0;">${esc(r.subject||'—')}</div>
                      ${r.room ? `<div style="font-size:0.72rem;color:var(--text-secondary,#aaa);"><i class="fa fa-door-open"></i> ${esc(r.room)}</div>` : ''}
                    </div>`).join('')}
                </td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  return { init, loadTab, openSubmitPaymentModal };
})();

window.StudentDashboard = StudentDashboard;
