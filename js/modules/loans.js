/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/loans.js
   Loan Management — Person-wise tracking
════════════════════════════════════════════════ */

const Loans = (() => {

  let editingId = null;

  function render() {
    const container = document.getElementById('loans-content');
    if (!container) return;

    const loans = Utils.sortBy(SupabaseSync.getAll(DB.loans),'date','desc');

    /* Person-wise summary */
    const personMap = {};
    loans.forEach(l => {
      const p = l.person||'UnknownNo';
      if (!personMap[p]) personMap[p] = { given:0, received:0 };
      if (l.direction==='given')    personMap[p].given    += Utils.safeNum(l.amount);
      if (l.direction==='received') personMap[p].received += Utils.safeNum(l.amount);
    });

    const totalGiven    = loans.filter(l=>l.direction==='given').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    const totalReceived = loans.filter(l=>l.direction==='received').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    const netOwed       = totalGiven - totalReceived; /* positive = others owe us */

    container.innerHTML = `
      <!-- Summary -->
      <div class="grid-3" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-icon red"><i class="fa fa-arrow-up-right-from-square"></i></div>
          <div class="stat-info"><div class="stat-label">Total Given Loan</div><div class="stat-value">${Utils.takaEn(totalGiven)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa fa-arrow-down-left-from-circle"></i></div>
          <div class="stat-info"><div class="stat-label">Total Taken Loan</div><div class="stat-value">${Utils.takaEn(totalReceived)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${netOwed>=0?'amber':'red'}"><i class="fa fa-scale-balanced"></i></div>
          <div class="stat-info">
            <div class="stat-label">${netOwed>=0?'Others will give us':'We will give'}</div>
            <div class="stat-value">${Utils.takaEn(Math.abs(netOwed))}</div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="align-items:start">

        <!-- Person-wise Summary -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px"><i class="fa fa-users" style="color:var(--primary-light)"></i> Person based summary</div>
          ${Object.keys(personMap).length ? `<div class="table-wrapper"><table>
            <thead><tr><th>Person</th><th>Given</th><th>Taken</th><th>Net</th></tr></thead>
            <tbody>
              ${Object.entries(personMap).map(([person, {given, received}])=>{
                const net = given - received;
                return `<tr>
                  <td style="font-weight:600">${person}</td>
                  <td class="ledger-expense">${Utils.takaEn(given)}</td>
                  <td class="ledger-income">${Utils.takaEn(received)}</td>
                  <td class="${net>0?'ledger-expense':'ledger-income'}" style="font-weight:700">
                    ${net>0?'Will give ':'Will give '}${Utils.takaEn(Math.abs(net))}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>` : `<div class="no-data"><i class="fa fa-inbox"></i>No Loan not found</div>`}
        </div>

        <!-- Loan Ledger -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px"><i class="fa fa-list" style="color:var(--accent)"></i> Loan Ledger</div>
          ${loans.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Person</th><th>Direction</th><th>Amount</th><th>Status</th><th class="no-print">Action</th></tr></thead>
            <tbody>
              ${loans.map(l=>`<tr>
                <td style="font-size:0.82rem">${Utils.formatDate(l.date)}</td>
                <td style="font-weight:600">${l.person||'—'}</td>
                <td>${l.direction==='given'
                  ? Utils.badge('Given','danger')
                  : Utils.badge('Taken','success')}</td>
                <td style="font-family:var(--font-en);font-weight:600">${Utils.takaEn(l.amount)}</td>
                <td>${Utils.statusBadge(l.status||'Outstanding')}</td>
                <td class="no-print">
                  <div class="table-actions">
                    <button class="btn-outline btn-xs" onclick="Loans.toggleStatus('${l.id}','${l.status||'Outstanding'}')">
                      <i class="fa fa-check"></i>
                    </button>
                    <button class="btn-outline btn-xs" onclick="Loans.openEditModal('${l.id}')"><i class="fa fa-pen"></i></button>
                    <button class="btn-danger btn-xs"  onclick="Loans.deleteLoan('${l.id}')"><i class="fa fa-trash"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="no-data"><i class="fa fa-inbox"></i>No Loan not found</div>`}
        </div>
      </div>
    `;
  }

  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-hand-holding-dollar"></i> New Loan', formHTML());
  }

  function openEditModal(id) {
    const l = SupabaseSync.getById(DB.loans, id);
    if (!l) return;
    editingId = id;
    Utils.openModal('<i class="fa fa-pen"></i> Loan Edit', formHTML(l));
  }

  function formHTML(d={}) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Loan Direction <span class="req">*</span></label>
          <select id="lf-direction" class="form-control">
            <option value="given"    ${d.direction==='given'   ?'selected':''}>I have given</option>
            <option value="received" ${d.direction==='received'?'selected':''}>I have taken</option>
          </select>
        </div>
        <div class="form-group">
          <label>Person's Name <span class="req">*</span></label>
          <input id="lf-person" class="form-control" value="${d.person||''}" placeholder="Person's Name / Organization" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (৳) <span class="req">*</span></label>
          <input id="lf-amount" type="number" class="form-control" value="${d.amount||''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Date</label>
          <input id="lf-date" type="date" class="form-control" value="${(d.date||Utils.today()).split('T')[0]}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Payment Method</label>
          <select id="lf-method" class="form-control">
            <option value="Cash"           ${(d.method||'Cash')==='Cash'?'selected':''}>Cash</option>
            <option value="Bank"           ${d.method==='Bank'?'selected':''}>Bank</option>
            <option value="Mobile Banking" ${d.method==='Mobile Banking'?'selected':''}>Mobile Banking</option>
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="lf-status" class="form-control">
            <option value="Outstanding" ${(d.status||'Outstanding')==='Outstanding'?'selected':''}>Due</option>
            <option value="Paid"        ${d.status==='Paid'?'selected':''}>Paid</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="lf-note" class="form-control" rows="2">${d.note||''}</textarea>
      </div>
      <div id="lf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Loans.saveLoan()"><i class="fa fa-floppy-disk"></i> Save</button>
      </div>
    `;
  }

  function saveLoan() {
    const person = Utils.formVal('lf-person');
    const amount = Utils.safeNum(Utils.formVal('lf-amount'));
    const errEl  = document.getElementById('lf-error');

    if (!person) { errEl.textContent='Person's Name is required'; errEl.classList.remove('hidden'); return; }
    if (!amount||amount<=0) { errEl.textContent='Amount required'; errEl.classList.remove('hidden'); return; }

    const direction = Utils.formVal('lf-direction');
    const record = {
      direction, person, amount,
      date:   Utils.formVal('lf-date')||Utils.today(),
      method: Utils.formVal('lf-method')||'Cash',
      status: Utils.formVal('lf-status')||'Outstanding',
      note:   Utils.formVal('lf-note'),
    };

    /* Finance ledger entry */
    const finType = direction==='given'?'Loan Giving':'Loan Receiving';
    if (!editingId) {
      SupabaseSync.insert(DB.finance, {
        type:finType, method:record.method, category:'Loan',
        description:`Loan — ${person}`, amount, date:record.date, note:record.note,
      });
    }

    if (editingId) {
      SupabaseSync.update(DB.loans, editingId, record);
      Utils.toast('Loan updated ✓','success');
    } else {
      SupabaseSync.insert(DB.loans, record);
      Utils.toast('Loan Added ✓','success');
    }
    Utils.closeModal();
    render();
  }

  function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus==='Paid'?'Outstanding':'Paid';
    SupabaseSync.update(DB.loans, id, { status:newStatus });
    Utils.toast(`Status Changed: ${newStatus==='Paid'?'Paid':'Due'}`,'info');
    render();
  }

  async function deleteLoan(id) {
    const ok = await Utils.confirm('Delete this loan record?','Delete Loan');
    if (!ok) return;
    SupabaseSync.remove(DB.loans, id);
    Utils.toast('has been deleted','info');
    render();
  }

  return { render, openAddModal, openEditModal, saveLoan, toggleStatus, deleteLoan };

})();
