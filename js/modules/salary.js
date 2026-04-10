/* ============================================================
   SALARY HUB MODULE — Wings Fly Aviation Academy
   Phase 8 | Monthly Salary Processing & History
   ============================================================ */

const Salary = (() => {

  /* ─── State ─── */
  let records = [];  // { id, staffId, staffName, role, month, baseSalary, bonus, deduction, paid, paidDate, method, note }

  /* ─── Init ─── */
  function init() {
    load();
    renderContent();
  }

  /* ─── Storage ─── */
  function load() {
    try { records = JSON.parse(localStorage.getItem('wf_salary') || '[]'); }
    catch { records = []; }
  }

  function save() {
    localStorage.setItem('wf_salary', JSON.stringify(records));
    if (typeof SupabaseSync !== 'undefined') SupabaseSync.push('salary', records);
  }

  /* ─── Current Month ─── */
  function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }

  /* ─── Render ─── */
  function renderContent() {
    const container = document.getElementById('salary-content');
    if (!container) return;

    const cm = currentMonth();
    const thisMonth = records.filter(r => r.month === cm);
    const totalBudget  = thisMonth.reduce((s, r) => s + (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0), 0);
    const totalPaid    = thisMonth.filter(r => r.paid).reduce((s, r) => s + (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0), 0);
    const totalDue     = totalBudget - totalPaid;
    const paidCount    = thisMonth.filter(r => r.paid).length;

    container.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-blue-glow)"><i class="fa fa-calendar"></i></div>
          <div class="stat-info">
            <div class="stat-value">${monthLabel(cm)}</div>
            <div class="stat-label">Current Month</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-gold-glow)"><i class="fa fa-sack-dollar"></i></div>
          <div class="stat-info">
            <div class="stat-value">৳${Utils.formatMoneyPlain(totalBudget)}</div>
            <div class="stat-label">Total Budget</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-green-glow)"><i class="fa fa-circle-check"></i></div>
          <div class="stat-info">
            <div class="stat-value">৳${Utils.formatMoneyPlain(totalPaid)}</div>
            <div class="stat-label">Paid (${paidCount} staff)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--accent-red-glow)"><i class="fa fa-clock"></i></div>
          <div class="stat-info">
            <div class="stat-value">৳${Utils.formatMoneyPlain(totalDue)}</div>
            <div class="stat-label">Due</div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>Select Month</label>
          <input type="month" id="salary-month-picker" value="${cm}" onchange="Salary.renderContent()" />
        </div>
        <button class="btn-primary" onclick="Salary.generateMonthlySheet()">
          <i class="fa fa-magic"></i> Generate Monthly Sheet
        </button>
        <button class="btn-secondary" onclick="Salary.openAddModal()">
          <i class="fa fa-plus"></i> Manual Entry
        </button>
        <button class="btn-secondary" onclick="Salary.exportExcel()">
          <i class="fa fa-file-excel"></i> Excel
        </button>
        <button class="btn-secondary" onclick="Salary.printSheet()">
          <i class="fa fa-print"></i> Print
        </button>
      </div>

      <!-- Table -->
      <div class="table-wrapper" id="salary-table-wrapper">
        ${renderTable()}
      </div>

      <!-- History Summary -->
      <div style="margin-top:2rem;">
        <h3 style="color:var(--text-secondary);margin-bottom:1rem;">
          <i class="fa fa-history"></i> Salary History (Last 6 Months)
        </h3>
        ${renderHistory()}
      </div>
    `;
  }

  function getSelectedMonth() {
    return document.getElementById('salary-month-picker')?.value || currentMonth();
  }

  function renderTable() {
    const month = getSelectedMonth();
    const data  = records.filter(r => r.month === month);

    if (!data.length) return `
      <div class="empty-state">
        <i class="fa fa-file-invoice-dollar" style="font-size:3rem;opacity:.3"></i>
        <p>No salary records found for ${monthLabel(month)}.</p>
        <button class="btn-primary" onclick="Salary.generateMonthlySheet()" style="margin-top:1rem;">
          <i class="fa fa-magic"></i> Auto Generate Sheet
        </button>
      </div>`;

    return `
      <table class="data-table" id="salary-print-table">
        <thead>
          <tr>
            <th>Staff ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Basic Salary</th>
            <th>Bonus</th>
            <th>Deduction</th>
            <th>Net Salary</th>
            <th>Method</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => {
            const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
            return `
            <tr>
              <td><code>${r.staffId || '—'}</code></td>
              <td><strong>${r.staffName}</strong></td>
              <td><span class="badge badge-blue">${r.role || '—'}</span></td>
              <td>৳${Utils.formatMoneyPlain(r.baseSalary || 0)}</td>
              <td class="text-green">+৳${Utils.formatMoneyPlain(r.bonus || 0)}</td>
              <td class="text-red">-৳${Utils.formatMoneyPlain(r.deduction || 0)}</td>
              <td><strong>৳${Utils.formatMoneyPlain(net)}</strong></td>
              <td>${r.method || '—'}</td>
              <td>
                <span class="badge ${r.paid ? 'badge-green' : 'badge-yellow'}">
                  ${r.paid ? '✓ Paid' : '⏳ Due'}
                </span>
              </td>
              <td class="action-btns">
                ${!r.paid ? `
                  <button class="btn-icon btn-edit" onclick="Salary.markPaid('${r.id}')" title="Pay">
                    <i class="fa fa-check"></i>
                  </button>` : ''}
                <button class="btn-icon btn-edit" onclick="Salary.openEditModal('${r.id}')" title="Edit">
                  <i class="fa fa-pen"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="Salary.deleteRecord('${r.id}')" title="Delete">
                  <i class="fa fa-trash"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;background:var(--bg-tertiary)">
            <td colspan="3">Total</td>
            <td>৳${Utils.formatMoneyPlain(data.reduce((s,r) => s+(r.baseSalary||0),0))}</td>
            <td class="text-green">+৳${Utils.formatMoneyPlain(data.reduce((s,r) => s+(r.bonus||0),0))}</td>
            <td class="text-red">-৳${Utils.formatMoneyPlain(data.reduce((s,r) => s+(r.deduction||0),0))}</td>
            <td>৳${Utils.formatMoneyPlain(data.reduce((s,r) => s+(r.baseSalary||0)+(r.bonus||0)-(r.deduction||0),0))}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>`;
  }

  function renderHistory() {
    // Group by month, last 6 months
    const monthMap = {};
    records.forEach(r => {
      if (!monthMap[r.month]) monthMap[r.month] = { total: 0, paid: 0 };
      const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
      monthMap[r.month].total += net;
      if (r.paid) monthMap[r.month].paid += net;
    });
    const sorted = Object.keys(monthMap).sort().reverse().slice(0, 6);
    if (!sorted.length) return `<p style="color:var(--text-muted)">No history found.</p>`;

    return `
      <table class="data-table">
        <thead><tr><th>Month</th><th>Total Budget</th><th>Paid</th><th>Due</th></tr></thead>
        <tbody>
          ${sorted.map(m => `
            <tr>
              <td>${monthLabel(m)}</td>
              <td>৳${Utils.formatMoneyPlain(monthMap[m].total)}</td>
              <td class="text-green">৳${Utils.formatMoneyPlain(monthMap[m].paid)}</td>
              <td class="text-red">৳${Utils.formatMoneyPlain(monthMap[m].total - monthMap[m].paid)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* ─── Generate Monthly Sheet from HR data ─── */
  function generateMonthlySheet() {
    const month = getSelectedMonth();
    const existing = records.filter(r => r.month === month).map(r => r.staffId);

    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll() : [];
    const activeStaff = allStaff.filter(s => s.status === 'Active' && !existing.includes(s.staffId));

    if (!activeStaff.length) {
      Utils.toast(existing.length ? 'All staff sheets already created ✓' : 'No active staff found', 'info');
      return;
    }

    activeStaff.forEach(s => {
      records.push({
        id:         Utils.generateId(),
        staffId:    s.staffId,
        staffName:  s.name,
        role:       s.role,
        month,
        baseSalary: s.salary || 0,
        bonus:      0,
        deduction:  0,
        paid:       false,
        paidDate:   '',
        method:     'Cash',
        note:       '',
        createdAt:  new Date().toISOString(),
      });
    });

    save();
    renderContent();
    Utils.toast(`${activeStaff.length} staff salary sheets created ✓`, 'success');
  }

  /* ─── Mark Paid ─── */
  function markPaid(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;
    r.paid     = true;
    r.paidDate = new Date().toISOString().split('T')[0];
    save();
    renderContent();
    Utils.toast(`${r.staffName}-Salary has been paid ✓`, 'success');

    // Log to Finance ledger if available
    if (typeof Finance !== 'undefined') {
      const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
      Finance.addExternalTransaction({
        type: 'Expense', category: 'Salary',
        amount: net, method: r.method || 'Cash',
        description: `Salary: ${r.staffName} (${monthLabel(r.month)})`,
        date: r.paidDate,
      });
    }
  }

  /* ─── Modal: Add ─── */
  function openAddModal(prefillStaffId) {
    Utils.openModal('Salary Entry', formHTML(null, prefillStaffId));
  }

  /* ─── Modal: Edit ─── */
  function openEditModal(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;
    Utils.openModal('Edit Salary', formHTML(r));
  }

  function formHTML(r, prefillStaffId) {
    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll() : [];
    return `
      <div class="form-grid">
        <div class="form-group">
          <label>Select Staff <span class="required">*</span></label>
          <select id="sal-staff" onchange="Salary.onStaffSelect(this.value)">
            <option value="">-- Select Staff --</option>
            ${allStaff.map(s => `
              <option value="${s.staffId}" ${(r?.staffId || prefillStaffId) === s.staffId ? 'selected' : ''}
                data-name="${s.name}" data-role="${s.role}" data-salary="${s.salary || 0}">
                ${s.staffId} — ${s.name}
              </option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Month <span class="required">*</span></label>
          <input type="month" id="sal-month" value="${r?.month || getSelectedMonth()}" />
        </div>
        <div class="form-group">
          <label>Basic Salary (৳)</label>
          <input type="number" id="sal-base" min="0" value="${r?.baseSalary || ''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Bonus (৳)</label>
          <input type="number" id="sal-bonus" min="0" value="${r?.bonus || 0}" />
        </div>
        <div class="form-group">
          <label>Deduction (৳)</label>
          <input type="number" id="sal-deduction" min="0" value="${r?.deduction || 0}" />
        </div>
        <div class="form-group">
          <label>Method</label>
          <select id="sal-method">
            ${['Cash','Bank','Mobile Banking'].map(m =>
              `<option value="${m}" ${r?.method === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Pay Status</label>
          <select id="sal-paid">
            <option value="0" ${!r?.paid ? 'selected' : ''}>Due</option>
            <option value="1" ${r?.paid  ? 'selected' : ''}>Paid</option>
          </select>
        </div>
        <div class="form-group">
          <label>Payment Date</label>
          <input type="date" id="sal-paiddate" value="${r?.paidDate || ''}" />
        </div>
        <div class="form-group full-width">
          <label>Notes</label>
          <textarea id="sal-note" rows="2">${r?.note || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Salary.saveRecord('${r?.id || ''}')">
          <i class="fa fa-save"></i> Save
        </button>
      </div>`;
  }

  function onStaffSelect(staffId) {
    const sel = document.getElementById('sal-staff');
    const opt = sel?.options[sel.selectedIndex];
    if (opt) {
      document.getElementById('sal-base').value = opt.dataset.salary || '';
    }
  }

  function saveRecord(editId) {
    const staffSel  = document.getElementById('sal-staff');
    const staffId   = staffSel?.value;
    const staffOpt  = staffSel?.options[staffSel.selectedIndex];
    if (!staffId) { Utils.toast('Please select a staff member', 'error'); return; }

    const entry = {
      id:          editId || Utils.generateId(),
      staffId,
      staffName:   staffOpt?.dataset.name || '',
      role:        staffOpt?.dataset.role || '',
      month:       document.getElementById('sal-month')?.value || currentMonth(),
      baseSalary:  parseFloat(document.getElementById('sal-base')?.value) || 0,
      bonus:       parseFloat(document.getElementById('sal-bonus')?.value) || 0,
      deduction:   parseFloat(document.getElementById('sal-deduction')?.value) || 0,
      method:      document.getElementById('sal-method')?.value || 'Cash',
      paid:        document.getElementById('sal-paid')?.value === '1',
      paidDate:    document.getElementById('sal-paiddate')?.value || '',
      note:        document.getElementById('sal-note')?.value.trim() || '',
      updatedAt:   new Date().toISOString(),
    };

    if (editId) {
      const idx = records.findIndex(r => r.id === editId);
      if (idx !== -1) { entry.createdAt = records[idx].createdAt; records[idx] = entry; }
    } else {
      entry.createdAt = new Date().toISOString();
      records.push(entry);
    }

    save();
    Utils.closeModal();
    Utils.toast(editId ? 'Salary record updated ✓' : 'Salary record added ✓', 'success');
    renderContent();
  }

  function deleteRecord(id) {
    Utils.confirm('Delete this salary record??', () => {
      records = records.filter(r => r.id !== id);
      save();
      renderContent();
      Utils.toast('Record deleted', 'warning');
    });
  }

  /* ─── Export ─── */
  function exportExcel() {
    const month = getSelectedMonth();
    const data  = records.filter(r => r.month === month);
    if (!data.length) { Utils.toast('No data available', 'error'); return; }
    const rows = data.map(r => ({
      'Staff ID': r.staffId, 'Name': r.staffName, 'Role': r.role,
      'Month': r.month, 'Basic Salary': r.baseSalary, 'Bonus': r.bonus,
      'Deduction': r.deduction,
      'Net': (r.baseSalary||0)+(r.bonus||0)-(r.deduction||0),
      'Status': r.paid ? 'Paid' : 'Due',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary');
    XLSX.writeFile(wb, `salary-${month}.xlsx`);
  }

  function printSheet() { window.print(); }

  /* ─── Dashboard summary ─── */
  function getSummary() {
    const cm = currentMonth();
    const thisMonth = records.filter(r => r.month === cm);
    return {
      totalBudget: thisMonth.reduce((s,r) => s+(r.baseSalary||0)+(r.bonus||0)-(r.deduction||0), 0),
      totalPaid:   thisMonth.filter(r=>r.paid).reduce((s,r) => s+(r.baseSalary||0)+(r.bonus||0)-(r.deduction||0),0),
      count:       thisMonth.length,
    };
  }

  return { init, load, renderContent, openAddModal, openEditModal,
           saveRecord, markPaid, deleteRecord, generateMonthlySheet,
           applyFilter: renderContent, exportExcel, printSheet,
           onStaffSelect, getSummary };

})();
