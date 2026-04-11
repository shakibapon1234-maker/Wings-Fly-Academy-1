/* ============================================================
   SALARY HUB MODULE — Wings Fly Aviation Academy
   Phase 8 | Monthly Salary Processing & History (Redesigned UI)
   ============================================================ */

const Salary = (() => {

  let editingId = null;

  function init() {
    renderContent();
  }

  function getRecords() {
    return Utils.sortBy(SupabaseSync.getAll(DB.salary), 'createdAt', 'desc');
  }

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

    const cm = document.getElementById('salary-month-picker')?.value || currentMonth();
    const records = getRecords();
    const thisMonth = records.filter(r => r.month === cm);
    
    let totalBudget = 0;
    let totalPaid = 0;

    thisMonth.forEach(r => {
      const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
      totalBudget += net;
      if (r.paid) totalPaid += net;
    });

    const totalDue = totalBudget - totalPaid;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
        <h2 style="margin:0; font-size:1.5rem; display:flex; align-items:center; gap:8px;">
          <i class="fa fa-sack-dollar" style="color:var(--brand-primary);"></i> Salary Management Hub
        </h2>
        <div style="display:flex; gap:12px;">
          <button class="btn btn-secondary" onclick="Salary.generateMonthlySheet()" title="Auto-generate empty salary records for all active staff for this month">
            <i class="fa fa-magic" style="color:#ffb703;"></i> AUTO-GENERATE SHEET
          </button>
          <button class="btn btn-primary" onclick="Salary.openAddModal()" style="border-radius:24px; padding:8px 20px; font-weight:700; background:linear-gradient(135deg, #00d4ff, #7c3aed); border:none;">
            <i class="fa fa-plus-circle"></i> RECORD PAYMENT
          </button>
          <button class="btn btn-secondary" onclick="Salary.openHistoryModal()">
            <i class="fa fa-print"></i> PRINT HISTORY
          </button>
        </div>
      </div>

      <!-- Header Stats Bar -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
        <!-- Month/Year -->
        <div style="border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTH / YEAR</div>
          <input type="month" id="salary-month-picker" value="${cm}" onchange="Salary.renderContent()" style="background:transparent; border:none; color:#fff; font-size:1.1rem; width:100%; outline:none;" />
        </div>
        <!-- Budget -->
        <div style="border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#00d4ff; text-transform:uppercase; font-weight:700; margin-bottom:8px;">MONTHLY BUDGET</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00d4ff;">৳${Utils.formatMoneyPlain(totalBudget)}</div>
        </div>
        <!-- Paid Amount -->
        <div style="border:1px solid rgba(0,255,136,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#00ff88; text-transform:uppercase; font-weight:700; margin-bottom:8px;">PAID AMOUNT</div>
          <div style="font-size:1.6rem; font-weight:800; color:#00ff88;">৳${Utils.formatMoneyPlain(totalPaid)}</div>
        </div>
        <!-- Due Amount -->
        <div style="border:1px solid rgba(255,71,87,0.2); border-radius:12px; padding:16px; background:rgba(0,0,0,0.2);">
          <div style="font-size:0.75rem; color:#ff4757; text-transform:uppercase; font-weight:700; margin-bottom:8px;">DUE AMOUNT</div>
          <div style="font-size:1.6rem; font-weight:800; color:#ff4757;">৳${Utils.formatMoneyPlain(totalDue)}</div>
        </div>
      </div>

      <!-- Salary Cards Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:20px; margin-bottom:32px;">
        ${thisMonth.length === 0 ? `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:rgba(0,0,0,0.2); border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
            <i class="fa fa-folder-open" style="font-size:3.5rem; margin-bottom:16px; opacity:0.3; display:block; color:var(--brand-primary);"></i>
            <div style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:8px;">No Salary Records for ${monthLabel(cm)}</div>
            <div style="color:var(--text-muted); margin-bottom:24px; font-size:0.9rem;">Click the button below to auto-generate salary tracking sheets for all active staff.</div>
            <button class="btn btn-primary" onclick="Salary.generateMonthlySheet()" style="padding:12px 28px; font-size:1rem; font-weight:700; border-radius:30px; background:linear-gradient(135deg, #00d4ff, #7c3aed); border:none; box-shadow:0 8px 16px rgba(0,212,255,0.2);">
              <i class="fa fa-magic"></i> AUTO-GENERATE SHEETS FOR ${monthLabel(cm).toUpperCase()}
            </button>
          </div>
        ` : thisMonth.map(r => {
          const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
          const paidAmt = r.paid ? net : 0;
          const dueAmt = r.paid ? 0 : net;
          
          return `
          <div class="salary-card" style="background:var(--bg-secondary); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:20px; position:relative; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:50%; background:rgba(0,212,255,0.1); display:flex; align-items:center; justify-content:center;">
                  <i class="fa fa-user" style="color:#00d4ff;"></i>
                </div>
                <div>
                  <div style="font-weight:700; color:#fff; font-size:1.1rem;">${r.staffName}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${r.role || 'Staff'} ${r.phone ? `<i class="fa fa-phone" style="margin:0 4px; opacity:0.6;"></i> ${r.phone}` : ''}</div>
                </div>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <span style="font-size:0.75rem; padding:4px 10px; border-radius:12px; background:${r.paid ? 'rgba(0,255,136,0.1)' : 'rgba(255,170,0,0.1)'}; color:${r.paid ? '#00ff88' : '#ffb703'}; font-weight:700;">
                  <i class="fa ${r.paid ? 'fa-check' : 'fa-hourglass-half'}"></i> ${r.paid ? 'Paid' : 'Pending'}
                </span>
                ${!r.paid ? `<button class="btn btn-primary" style="border-radius:24px; padding:4px 14px; font-size:0.85rem;" onclick="Salary.markPaid('${r.id}')"><i class="fa fa-sack-dollar"></i> Pay</button>` : `<button class="btn btn-secondary" style="border-radius:24px; padding:4px 10px;" onclick="Salary.openEditModal('${r.id}')"><i class="fa fa-pen"></i></button>`}
                ${r.paid ? '' : `<button class="btn btn-secondary" style="border-radius:24px; padding:4px 10px;" onclick="Salary.deleteRecord('${r.id}')" title="Delete record"><i class="fa fa-trash" style="color:#ff4757;"></i></button>`}
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
              <div style="text-align:center; background:rgba(255,255,255,0.03); padding:10px 6px; border-radius:8px;">
                <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; letter-spacing:0.5px;">BASICS</div>
                <div style="font-weight:700; color:#fff;">৳${Utils.formatMoneyPlain(net)}</div>
              </div>
              <div style="text-align:center; background:rgba(255,255,255,0.03); padding:10px 6px; border-radius:8px;">
                <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; letter-spacing:0.5px;">PAID (${cm})</div>
                <div style="font-weight:700; color:#00ff88;">৳${Utils.formatMoneyPlain(paidAmt)}</div>
              </div>
              <div style="text-align:center; background:${r.paid ? 'rgba(255,255,255,0.03)' : 'rgba(255,170,0,0.1)'}; padding:10px 6px; border-radius:8px;">
                <div style="font-size:0.65rem; color:${r.paid ? 'var(--text-muted)' : '#ffb703'}; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.5px;">DUE</div>
                <div style="font-weight:700; color:${r.paid ? '#fff' : '#ffb703'};">৳${Utils.formatMoneyPlain(dueAmt)}</div>
              </div>
            </div>

            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:6px;">
              <span>Payment Progress</span>
              <span style="font-weight:700; color:${r.paid ? '#00ff88' : 'var(--text-muted)'};">${r.paid ? '100%' : '0%'}</span>
            </div>
            <div style="height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px;">
              <div style="height:100%; border-radius:2px; background:${r.paid ? '#00ff88' : 'rgba(255,255,255,0.1)'}; width:${r.paid ? '100' : '0'}%; transition: width 0.4s ease;"></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>

      <!-- History Link -->
      <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-secondary" style="border:none; color:#00d4ff; font-weight:700; background:transparent;" onclick="Salary.openHistoryModal()">
          <i class="fa fa-list"></i> VIEW ALL PREVIOUS MONTHS HISTORY (FULL LEDGER)
        </button>
      </div>
    `;
  }

  function getSelectedMonth() {
    return document.getElementById('salary-month-picker')?.value || currentMonth();
  }

  /* ─── Generate Monthly Sheet from HR data ─── */
  function generateMonthlySheet() {
    const month = getSelectedMonth();
    const records = getRecords();
    const existingIds = records.filter(r => r.month === month).map(r => r.staffId);

    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll() : [];
    const activeStaff = allStaff.filter(s => s.status === 'Active' && !existingIds.includes(s.staffId));

    if (!activeStaff.length) {
      Utils.toast(existingIds.length ? 'All staff sheets already created ✓' : 'No active staff found', 'info');
      return;
    }

    activeStaff.forEach(s => {
      SupabaseSync.insert(DB.salary, {
        staffId:    s.staffId,
        staffName:  s.name,
        role:       s.role,
        phone:      s.phone,
        month,
        baseSalary: s.salary || 0,
        bonus:      0,
        deduction:  0,
        paid:       false,
        paidDate:   '',
        method:     'Cash',
        note:       ''
      });
    });

    renderContent();
    Utils.toast(`${activeStaff.length} staff salary sheets created ✓`, 'success');
  }

  /* ─── Mark Paid ─── */
  function markPaid(id) {
    const r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;
    
    const method = r.method || 'Cash';
    const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
    const available = Utils.getAccountBalance(method);
    
    if (net > available) {
      Utils.toast(`Error: Insufficient balance in ${method}. Only ৳${Utils.formatMoneyPlain(available)} available. Please edit and change payment method first.`, 'error');
      return;
    }
    
    SupabaseSync.update(DB.salary, id, {
      paid: true,
      paidDate: new Date().toISOString().split('T')[0]
    });
    
    Utils.toast(`${r.staffName}-Salary has been paid ✓`, 'success');
    renderContent();

    // Log to Finance ledger if available
    if (typeof Finance !== 'undefined') {
      const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
      Finance.addExternalTransaction({
        type: 'Expense', category: 'Salary',
        amount: net, method: r.method || 'Cash',
        description: `Salary: ${r.staffName} (${monthLabel(r.month)})`,
        date: new Date().toISOString().split('T')[0],
      });
    }
  }

  /* ─── Modal: Add ─── */
  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-sack-dollar" style="color:#00d4ff;"></i> RECORD PAYMENT', formHTML(null));
  }

  /* ─── Modal: Edit ─── */
  function openEditModal(id) {
    editingId = id;
    const r = SupabaseSync.getById(DB.salary, id);
    if (!r) return;
    Utils.openModal('<i class="fa fa-pen" style="color:#00d4ff;"></i> EDIT RECORD', formHTML(r));
  }

  function formHTML(r) {
    const allStaff = (typeof HRStaff !== 'undefined') ? HRStaff.getAll().filter(s => s.status === 'Active') : [];
    return `
      <div style="margin-bottom: 24px;">
        <div class="form-row">
          <div class="form-group">
            <label>Select Staff <span class="req">*</span></label>
            <select id="sal-staff" class="form-control" onchange="Salary.onStaffSelect()">
              <option value="">-- Employee From HR --</option>
              ${allStaff.map(s => `
                <option value="${s.staffId}" ${r?.staffId === s.staffId ? 'selected' : ''}
                  data-name="${s.name}" data-role="${s.role}" data-phone="${s.phone || ''}" data-salary="${s.salary || 0}">
                  ${s.staffId} — ${s.name}
                </option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Month <span class="req">*</span></label>
            <input type="month" id="sal-month" class="form-control" value="${r?.month || getSelectedMonth()}" />
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px;">FINANCIAL DETAILS</div>
        <div class="form-row">
          <div class="form-group">
            <label>Basic Salary (৳)</label>
            <input type="number" id="sal-base" class="form-control" min="0" value="${r?.baseSalary || ''}" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Bonus (৳)</label>
            <input type="number" id="sal-bonus" class="form-control" min="0" value="${r?.bonus || 0}" />
          </div>
          <div class="form-group">
            <label>Deduction (৳)</label>
            <input type="number" id="sal-deduction" class="form-control" min="0" value="${r?.deduction || 0}" />
          </div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Payment Method <span class="req">*</span></label>
          <select id="sal-method" class="form-control" onchange="Utils.onPaymentMethodChange(this, 'sal-bal-display')">
            <option value="">Select Method...</option>
            ${Utils.getPaymentMethodsHTML(r?.method)}
          </select>
          <div id="sal-bal-display" style="display:none;"></div>
        </div>
        <div class="form-group">
          <label>Pay Status</label>
          <select id="sal-paid" class="form-control">
            <option value="0" ${!r?.paid ? 'selected' : ''}>Due / Pending</option>
            <option value="1" ${r?.paid  ? 'selected' : ''}>Paid</option>
          </select>
        </div>
        <div class="form-group">
          <label>Payment Date</label>
          <input type="date" id="sal-paiddate" class="form-control" value="${r?.paidDate || Utils.today()}" />
        </div>
      </div>

      <div class="form-group full-width">
        <label>Notes</label>
        <textarea id="sal-note" class="form-control" rows="2" placeholder="Any remarks...">${r?.note || ''}</textarea>
      </div>

      <div class="form-actions" style="justify-content: flex-end; margin-top: 10px;">
        <button class="btn-secondary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.1); border: none;" onclick="Utils.closeModal()">CANCEL</button>
        <button class="btn-primary" style="border-radius:24px; padding: 10px 24px; font-weight: 700; border:none; color:#fff; background: linear-gradient(135deg, #00d4ff, #7c3aed);" onclick="Salary.saveRecord()">SAVE PAYMENT</button>
      </div>`;
  }

  function onStaffSelect() {
    const sel = document.getElementById('sal-staff');
    const opt = sel?.options[sel.selectedIndex];
    if (opt && opt.value !== '') {
      document.getElementById('sal-base').value = opt.dataset.salary || '';
    }
  }

  function saveRecord() {
    const staffSel  = document.getElementById('sal-staff');
    const staffId   = staffSel?.value;
    const staffOpt  = staffSel?.options[staffSel.selectedIndex];
    if (!staffId) { Utils.toast('Please select a staff member', 'error'); return; }

    if (!document.getElementById('sal-method')?.value) { Utils.toast('Please select a Payment Method', 'error'); return; }

    const entry = {
      staffId,
      staffName:   staffOpt?.dataset.name || '',
      role:        staffOpt?.dataset.role || '',
      phone:       staffOpt?.dataset.phone || '',
      month:       document.getElementById('sal-month')?.value || currentMonth(),
      baseSalary:  parseFloat(document.getElementById('sal-base')?.value) || 0,
      bonus:       parseFloat(document.getElementById('sal-bonus')?.value) || 0,
      deduction:   parseFloat(document.getElementById('sal-deduction')?.value) || 0,
      method:      document.getElementById('sal-method')?.value || 'Cash',
      paid:        document.getElementById('sal-paid')?.value === '1',
      paidDate:    document.getElementById('sal-paiddate')?.value || '',
      note:        document.getElementById('sal-note')?.value.trim() || ''
    };

    if (entry.paid) {
      const net = entry.baseSalary + entry.bonus - entry.deduction;
      const available = Utils.getAccountBalance(entry.method);
      if (net > available) {
        Utils.toast(`Insufficient funds in ${entry.method}. Only ৳${Utils.formatMoneyPlain(available)} available.`, 'error');
        return;
      }
    }

    if (editingId) {
      SupabaseSync.update(DB.salary, editingId, entry);
      Utils.toast('Salary payment updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.salary, entry);
      Utils.toast('Salary payment recorded ✓', 'success');
    }

    Utils.closeModal();
    renderContent();
    editingId = null;
  }

  async function deleteRecord(id) {
    const ok = await Utils.confirm('Delete this salary record??', 'Delete Record');
    if (!ok) return;
    SupabaseSync.remove(DB.salary, id);
    renderContent();
    Utils.toast('Record deleted', 'warning');
  }

  function openHistoryModal() {
    const records = getRecords();
    
    // Sort all records descending essentially showing latest month first
    const html = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Staff Name</th>
              <th>Basic Salary</th>
              <th>Net Pay</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${records.length ? records.map(r => {
              const net = (r.baseSalary || 0) + (r.bonus || 0) - (r.deduction || 0);
              return `
              <tr>
                <td style="font-weight:700; color:#00d4ff;">${monthLabel(r.month)}</td>
                <td style="font-weight:700;">
                  <div style="color:#fff;">${r.staffName}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${r.role || 'Staff'}</div>
                </td>
                <td>৳${Utils.formatMoneyPlain(r.baseSalary || 0)}</td>
                <td style="font-weight:700;">৳${Utils.formatMoneyPlain(net)}</td>
                <td>
                  <span class="badge ${r.paid ? 'badge-success' : 'badge-warning'}" style="font-size:0.75rem;">
                    <i class="fa ${r.paid ? 'fa-check' : 'fa-hourglass-half'}"></i> ${r.paid ? 'Paid' : 'Due'}
                  </span>
                </td>
                <td>
                  ${!r.paid ? `<button class="btn btn-primary" style="padding:4px 10px; font-size:0.8rem; border-radius:20px;" onclick="Salary.markPaid('${r.id}'); Utils.closeModal()"><i class="fa fa-sack-dollar"></i> Pay</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa fa-check-circle"></i> Paid on ${r.paidDate}</span>`}
                </td>
              </tr>
              `;
            }).join('') : `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa fa-folder-open" style="font-size:2rem;display:block;opacity:0.3;margin-bottom:8px"></i>No history available</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="form-actions" style="justify-content: flex-end; margin-top: 16px;">
        <button class="btn-primary" onclick="Utils.closeModal()">CLOSE</button>
      </div>
    `;
    Utils.openModal('<i class="fa fa-list"></i> Full Global Salary Ledger', html, 'modal-lg');
  }

  /* ─── Export ─── */
  function exportExcel() {
    const month = getSelectedMonth();
    const records = getRecords();
    const data  = records.filter(r => r.month === month);
    if (!data.length) { Utils.toast('No data available', 'error'); return; }
    
    const rows = data.map(r => ({
      'Staff ID': r.staffId, 'Name': r.staffName, 'Role': r.role,
      'Month': r.month, 'Basic Salary': r.baseSalary, 'Bonus': r.bonus,
      'Deduction': r.deduction,
      'Net': (r.baseSalary||0)+(r.bonus||0)-(r.deduction||0),
      'Status': r.paid ? 'Paid' : 'Due',
    }));
    Utils.exportExcel(rows, `Salary_${month}`, 'Salary');
  }

  function printSheet() { window.print(); }

  /* ─── Dashboard summary ─── */
  function getSummary() {
    const cm = currentMonth();
    const records = getRecords();
    const thisMonth = records.filter(r => r.month === cm);
    return {
      totalBudget: thisMonth.reduce((s,r) => s+(r.baseSalary||0)+(r.bonus||0)-(r.deduction||0), 0),
      totalPaid:   thisMonth.filter(r=>r.paid).reduce((s,r) => s+(r.baseSalary||0)+(r.bonus||0)-(r.deduction||0),0),
      count:       thisMonth.length,
    };
  }

  return { init, render: renderContent, renderContent, openAddModal, openEditModal, openHistoryModal,
           saveRecord, markPaid, deleteRecord, generateMonthlySheet,
           exportExcel, printSheet,
           onStaffSelect, getSummary };

})();

