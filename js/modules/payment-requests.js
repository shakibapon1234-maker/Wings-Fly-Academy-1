/* ============================================================
   PAYMENT REQUESTS MODULE — Wings Fly Aviation Academy
   Feature 2 | Manual Payment System (bKash/Nagad/Bank)
   ------------------------------------------------------------
   Admin reviews student-submitted bKash/Nagad/Bank payment
   requests and Approves (auto-marks fee paid) or Rejects them.

   NOTE: Payment Gateway settings (bKash/Nagad/Bank numbers +
   on/off toggle) are configured from a button on THIS page,
   intentionally kept OUT of settings.js (already very large).
   ============================================================ */

const PaymentRequestsModule = (() => {
  'use strict';

  let statusFilter = 'pending'; // 'all' | 'pending' | 'approved' | 'rejected'
  let searchQuery   = '';

  function init() { render(); }

  function _reviewerName() {
    try {
      return (window.SessionStore && SessionStore.getUserName()) || localStorage.getItem('wfa_user_name') || 'Admin';
    } catch { return 'Admin'; }
  }

  function onSearch(val) {
    searchQuery = (val || '').toLowerCase().trim();
    render();
  }

  function setFilter(status) {
    statusFilter = status;
    render();
  }

  // ── Event delegation ──
  function _initDelegation(container) {
    if (container._payReqDelegated) return;
    container._payReqDelegated = true;

    container.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) { setFilter(filterBtn.dataset.filter); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'pr-approve') approveRequest(id);
      else if (action === 'pr-reject') openRejectModal(id);
      else if (action === 'pr-view-shot') window.open(btn.dataset.url, '_blank');
      else if (action === 'pr-settings') openSettingsModal();
    });

    container.addEventListener('input', (e) => {
      if (e.target.id === 'pr-search') onSearch(e.target.value);
    });
  }

  function render() {
    const container = document.getElementById('payment-requests-content');
    if (!container) return;

    const all = (typeof PaymentEngine !== 'undefined') ? PaymentEngine.getAllRequests() : [];

    const pendingCount  = all.filter(r => (r.status || 'pending') === 'pending').length;
    const approvedCount = all.filter(r => r.status === 'approved').length;
    const rejectedCount = all.filter(r => r.status === 'rejected').length;
    const totalApprovedAmount = all
      .filter(r => r.status === 'approved')
      .reduce((s, r) => s + Utils.safeNum(r.amount), 0);

    let rows = statusFilter === 'all' ? all : all.filter(r => (r.status || 'pending') === statusFilter);
    if (searchQuery) {
      rows = rows.filter(r =>
        (r.student_name || '').toLowerCase().includes(searchQuery) ||
        (r.student_id || '').toLowerCase().includes(searchQuery) ||
        (r.transaction_id || '').toLowerCase().includes(searchQuery) ||
        (r.sender_number || '').toLowerCase().includes(searchQuery)
      );
    }

    const tabs = [
      { id: 'pending',  label: 'Pending',  count: pendingCount,  color: '#ffb703' },
      { id: 'approved', label: 'Approved', count: approvedCount, color: '#00ff88' },
      { id: 'rejected', label: 'Rejected', count: rejectedCount, color: '#ff4757' },
      { id: 'all',      label: 'All',      count: all.length,    color: '#00d4ff' },
    ];

    let html = `
      <!-- Top Bar -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:18px; flex-wrap:wrap; gap:16px;">
        <div>
          <input id="pr-search" type="text" class="form-control"
            placeholder="Search by student name, ID, TxID, or sender number…"
            value="${Utils.escAttr(searchQuery)}"
            style="min-width:300px; max-width:420px; font-family:inherit;" />
        </div>
        <button type="button" class="btn btn-secondary" data-action="pr-settings"
          style="border-radius:20px; padding:8px 18px; font-weight:700; display:flex; align-items:center; gap:8px;">
          <i class="fa fa-gear"></i> bKash / Nagad / Bank সেটিংস
        </button>
      </div>

      <!-- Stats -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
        <div style="box-shadow:none; border:1px solid rgba(255,170,0,0.2); padding:16px; background:rgba(255,170,0,0.05); border-radius:12px;">
          <div style="color:#ffb703; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">PENDING REVIEW</div>
          <div style="color:#fff; font-size:1.6rem; font-weight:800;">${pendingCount}</div>
        </div>
        <div style="box-shadow:none; border:1px solid rgba(0,255,136,0.2); padding:16px; background:rgba(0,255,136,0.05); border-radius:12px;">
          <div style="color:#00ff88; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">APPROVED</div>
          <div style="color:#00ff88; font-size:1.6rem; font-weight:800;">${approvedCount} <span style="font-size:0.85rem; opacity:0.8;">(৳${Utils.formatMoneyPlain(totalApprovedAmount)})</span></div>
        </div>
        <div style="box-shadow:none; border:1px solid rgba(255,71,87,0.2); padding:16px; background:rgba(255,71,87,0.05); border-radius:12px;">
          <div style="color:#ff4757; font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px;">REJECTED</div>
          <div style="color:#ff4757; font-size:1.6rem; font-weight:800;">${rejectedCount}</div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        ${tabs.map(t => `
          <button type="button" data-filter="${t.id}"
            style="border:1px solid ${statusFilter === t.id ? t.color : 'rgba(255,255,255,0.12)'};
                   background:${statusFilter === t.id ? t.color + '22' : 'transparent'};
                   color:${statusFilter === t.id ? t.color : 'var(--text-muted)'};
                   border-radius:20px; padding:7px 16px; font-size:0.85rem; font-weight:700; cursor:pointer;">
            ${t.label} <span style="opacity:0.75">(${t.count})</span>
          </button>
        `).join('')}
      </div>
    `;

    if (!rows.length) {
      html += `<div style="text-align:center; padding:60px 20px; background:var(--bg-secondary); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
                <i class="fa fa-money-bill-transfer" style="font-size:3.5rem; margin-bottom:16px; opacity:0.3; display:block; color:var(--brand-primary);"></i>
                <div style="font-size:1.1rem; font-weight:700; color:#fff; margin-bottom:6px;">কোনো পেমেন্ট রিকোয়েস্ট নেই</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Student Portal থেকে bKash/Nagad/Bank পেমেন্ট জমা দিলে এখানে দেখা যাবে।</div>
               </div>`;
    } else {
      html += `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Transaction ID</th>
                <th>Sender No.</th>
                <th>Screenshot</th>
                <th>Status</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => _rowHTML(r)).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = html;
    _initDelegation(container);
  }

  function _rowHTML(r) {
    const status = r.status || 'pending';
    let badge;
    if (status === 'approved') badge = '<span class="badge badge-success"><i class="fa fa-check"></i> Approved</span>';
    else if (status === 'rejected') badge = '<span class="badge badge-error"><i class="fa fa-xmark"></i> Rejected</span>';
    else badge = '<span class="badge badge-warning"><i class="fa fa-hourglass-half"></i> Pending</span>';

    const actions = status === 'pending'
      ? `
        <button class="btn btn-secondary btn-sm" data-action="pr-approve" data-id="${Utils.escAttr(r.id)}"
          style="border-radius:20px; padding:4px 12px; background:linear-gradient(90deg,#00c853,#00e676); color:#04210f; border:none; font-weight:700;">
          <i class="fa fa-check"></i> Approve
        </button>
        <button class="btn btn-secondary btn-sm" data-action="pr-reject" data-id="${Utils.escAttr(r.id)}"
          style="border-radius:20px; padding:4px 12px;">
          <i class="fa fa-xmark" style="color:#ff4757;"></i> Reject
        </button>`
      : `<span style="font-size:0.78rem; color:var(--text-muted);">${r.reviewed_by ? 'by ' + Utils.esc(r.reviewed_by) : ''}${r.note ? '<br>📝 ' + Utils.esc(r.note) : ''}</span>`;

    return `
      <tr>
        <td style="white-space:nowrap; color:var(--text-muted); font-size:0.85rem;">${Utils.formatDateDMY ? Utils.formatDateDMY(r.submitted_at) : (r.submitted_at || '').slice(0, 10)}</td>
        <td>
          <div style="font-weight:700; color:#fff;">${Utils.esc(r.student_name || '—')}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">ID: ${Utils.esc(r.student_id || '—')}</div>
        </td>
        <td style="font-weight:700; color:#00d4ff;">৳${Utils.formatMoneyPlain(Utils.safeNum(r.amount))}</td>
        <td><span style="background:rgba(124,58,237,0.2); color:#a78bfa; border-radius:20px; padding:2px 10px; font-size:0.78rem; font-weight:700;">${Utils.esc(r.method || '—')}</span></td>
        <td style="font-family:monospace; font-size:0.85rem;">${Utils.esc(r.transaction_id || '—')}</td>
        <td style="font-size:0.85rem;">${Utils.esc(r.sender_number || '—')}</td>
        <td>${r.screenshot_url
          ? `<button class="btn btn-sm btn-outline" data-action="pr-view-shot" data-url="${Utils.escAttr(r.screenshot_url)}" style="border-radius:8px;"><i class="fa fa-image"></i> দেখুন</button>`
          : '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>'}
        </td>
        <td>${badge}</td>
        <td style="text-align:right; white-space:nowrap;">${actions}</td>
      </tr>
    `;
  }

  /* ── Approve / Reject ── */

  async function approveRequest(id) {
    try {
      const ok = await Utils.confirm('এই পেমেন্ট Approve করলে স্টুডেন্টের ফি স্বয়ংক্রিয়ভাবে Paid হিসেবে আপডেট হবে। নিশ্চিত?', 'Approve Payment');
      if (!ok) return;
      PaymentEngine.approve(id, _reviewerName());
      Utils.toast('✅ পেমেন্ট Approve করা হয়েছে — ফি আপডেট হয়েছে।', 'success');
      render();
      if (typeof App !== 'undefined' && App.updateNotifCount) App.updateNotifCount();
    } catch (e) {
      console.error('[PaymentRequests] approve error:', e);
      Utils.toast('❌ ' + (e.message || e), 'error');
    }
  }

  function openRejectModal(id) {
    Utils.openModal('<i class="fa fa-xmark" style="color:#ff4757;"></i> পেমেন্ট Reject করুন', `
      <div class="form-group">
        <label class="form-label">Reject করার কারণ (Student দেখতে পারবে না, শুধু internal note)</label>
        <textarea id="pr-reject-note" class="form-control" rows="3" placeholder="যেমন: Transaction ID matched হচ্ছে না"></textarea>
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
        <button type="button" class="btn btn-secondary" data-action="pr-reject-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="pr-reject-confirm" data-id="${Utils.escAttr(id)}"
          style="background:linear-gradient(90deg,#ff4757,#ff6b81); border:none;">Reject করুন</button>
      </div>
    `);
    setTimeout(() => {
      const body = document.getElementById('modal-body');
      if (!body) return;
      const cancelBtn  = body.querySelector('[data-action="pr-reject-cancel"]');
      const confirmBtn = body.querySelector('[data-action="pr-reject-confirm"]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => Utils.closeModal(), { once: true });
      if (confirmBtn) confirmBtn.addEventListener('click', () => _confirmReject(id), { once: true });
    }, 30);
  }

  function _confirmReject(id) {
    try {
      const note = (document.getElementById('pr-reject-note')?.value || '').trim();
      PaymentEngine.reject(id, _reviewerName(), note);
      Utils.closeModal();
      Utils.toast('পেমেন্ট Reject করা হয়েছে।', 'info');
      render();
    } catch (e) {
      console.error('[PaymentRequests] reject error:', e);
      Utils.toast('❌ ' + (e.message || e), 'error');
    }
  }

  /* ── bKash / Nagad / Bank Settings Modal ── */

  function openSettingsModal() {
    const cfg = (typeof PaymentEngine !== 'undefined') ? PaymentEngine.getPaymentSettings() : {};
    Utils.openModal('<i class="fa fa-gear" style="color:#00d4ff;"></i> Payment Gateway সেটিংস', `
      <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:16px;">
        এই নম্বরগুলো Student Portal-এ "পেমেন্ট করুন" ফর্মে দেখানো হবে। Account balance ঠিকভাবে আপডেট হওয়ার জন্য,
        নিচের নম্বরের সাথে মিলিয়ে Accounts ট্যাবে একই নামের Mobile/Bank account তৈরি করুন (যেমন: "bKash", "Nagad").
      </p>
      <div class="form-group">
        <label class="form-label"><i class="fa fa-mobile-screen"></i> bKash নম্বর</label>
        <input id="pr-cfg-bkash" type="text" class="form-control" placeholder="01XXXXXXXXX" value="${Utils.escAttr(cfg.bkash_number || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fa fa-mobile-screen"></i> Nagad নম্বর</label>
        <input id="pr-cfg-nagad" type="text" class="form-control" placeholder="01XXXXXXXXX" value="${Utils.escAttr(cfg.nagad_number || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fa fa-building-columns"></i> Bank নাম</label>
        <input id="pr-cfg-bankname" type="text" class="form-control" placeholder="Bank name" value="${Utils.escAttr(cfg.bank_name || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Account নাম</label>
        <input id="pr-cfg-bankaccname" type="text" class="form-control" value="${Utils.escAttr(cfg.bank_account_name || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Account নম্বর</label>
        <input id="pr-cfg-bankaccno" type="text" class="form-control" value="${Utils.escAttr(cfg.bank_account_number || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Branch</label>
        <input id="pr-cfg-bankbranch" type="text" class="form-control" value="${Utils.escAttr(cfg.bank_branch || '')}" />
      </div>
      <div class="form-group" style="display:flex; align-items:center; gap:10px;">
        <input id="pr-cfg-enabled" type="checkbox" ${cfg.payment_enabled !== false ? 'checked' : ''} style="width:18px; height:18px;" />
        <label class="form-label" style="margin:0;">Student Portal-এ Online Payment চালু রাখুন</label>
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:18px;">
        <button type="button" class="btn btn-secondary" data-action="pr-cfg-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="pr-cfg-save">সেভ করুন</button>
      </div>
    `);
    setTimeout(() => {
      const body = document.getElementById('modal-body');
      if (!body) return;
      const cancelBtn = body.querySelector('[data-action="pr-cfg-cancel"]');
      const saveBtn   = body.querySelector('[data-action="pr-cfg-save"]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => Utils.closeModal(), { once: true });
      if (saveBtn) saveBtn.addEventListener('click', _saveSettings, { once: true });
    }, 30);
  }

  function _saveSettings() {
    try {
      const config = {
        bkash_number:        (document.getElementById('pr-cfg-bkash')?.value || '').trim(),
        nagad_number:        (document.getElementById('pr-cfg-nagad')?.value || '').trim(),
        bank_name:           (document.getElementById('pr-cfg-bankname')?.value || '').trim(),
        bank_account_name:   (document.getElementById('pr-cfg-bankaccname')?.value || '').trim(),
        bank_account_number: (document.getElementById('pr-cfg-bankaccno')?.value || '').trim(),
        bank_branch:         (document.getElementById('pr-cfg-bankbranch')?.value || '').trim(),
        payment_enabled:     !!document.getElementById('pr-cfg-enabled')?.checked,
      };
      PaymentEngine.savePaymentSettings(config);
      Utils.closeModal();
      Utils.toast('✅ Payment সেটিংস সেভ হয়েছে।', 'success');
    } catch (e) {
      console.error('[PaymentRequests] save settings error:', e);
      Utils.toast('❌ সেভ ব্যর্থ: ' + (e.message || e), 'error');
    }
  }

  return { init, render, onSearch, setFilter, approveRequest, openRejectModal, openSettingsModal };
})();

window.PaymentRequestsModule = PaymentRequestsModule;
