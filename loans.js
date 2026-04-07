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
      const p = l.person||'অজানা';
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
          <div class="stat-info"><div class="stat-label">মোট দেওয়া লোন</div><div class="stat-value">${Utils.takaEn(totalGiven)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa fa-arrow-down-left-from-circle"></i></div>
          <div class="stat-info"><div class="stat-label">মোট নেওয়া লোন</div><div class="stat-value">${Utils.takaEn(totalReceived)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${netOwed>=0?'amber':'red'}"><i class="fa fa-scale-balanced"></i></div>
          <div class="stat-info">
            <div class="stat-label">${netOwed>=0?'অন্যরা আমাদের দেবে':'আমরা দেব'}</div>
            <div class="stat-value">${Utils.takaEn(Math.abs(netOwed))}</div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="align-items:start">

        <!-- Person-wise Summary -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px"><i class="fa fa-users" style="color:var(--primary-light)"></i> ব্যক্তি ভিত্তিক সারসংক্ষেপ</div>
          ${Object.keys(personMap).length ? `<div class="table-wrapper"><table>
            <thead><tr><th>ব্যক্তি</th><th>দিয়েছি</th><th>নিয়েছি</th><th>নিট</th></tr></thead>
            <tbody>
              ${Object.entries(personMap).map(([person, {given, received}])=>{
                const net = given - received;
                return `<tr>
                  <td style="font-weight:600">${person}</td>
                  <td class="ledger-expense">${Utils.takaEn(given)}</td>
                  <td class="ledger-income">${Utils.takaEn(received)}</td>
                  <td class="${net>0?'ledger-expense':'ledger-income'}" style="font-weight:700">
                    ${net>0?'দেবে ':'দেব '}${Utils.takaEn(Math.abs(net))}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>` : `<div class="no-data"><i class="fa fa-inbox"></i>কোনো লোন নেই</div>`}
        </div>

        <!-- Loan Ledger -->
        <div class="card">
          <div class="card-title" style="margin-bottom:14px"><i class="fa fa-list" style="color:var(--accent)"></i> লোন লেজার</div>
          ${loans.length ? `<div class="table-wrapper"><table>
            <thead><tr><th>তারিখ</th><th>ব্যক্তি</th><th>দিক</th><th>পরিমাণ</th><th>অবস্থা</th><th class="no-print">কাজ</th></tr></thead>
            <tbody>
              ${loans.map(l=>`<tr>
                <td style="font-size:0.82rem">${Utils.formatDate(l.date)}</td>
                <td style="font-weight:600">${l.person||'—'}</td>
                <td>${l.direction==='given'
                  ? Utils.badge('দিয়েছি','danger')
                  : Utils.badge('নিয়েছি','success')}</td>
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
          </table></div>` : `<div class="no-data"><i class="fa fa-inbox"></i>কোনো লোন নেই</div>`}
        </div>
      </div>
    `;
  }

  function openAddModal() {
    editingId = null;
    Utils.openModal('<i class="fa fa-hand-holding-dollar"></i> নতুন লোন', formHTML());
  }

  function openEditModal(id) {
    const l = SupabaseSync.getById(DB.loans, id);
    if (!l) return;
    editingId = id;
    Utils.openModal('<i class="fa fa-pen"></i> লোন সম্পাদনা', formHTML(l));
  }

  function formHTML(d={}) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>লোনের দিক <span class="req">*</span></label>
          <select id="lf-direction" class="form-control">
            <option value="given"    ${d.direction==='given'   ?'selected':''}>আমি দিয়েছি</option>
            <option value="received" ${d.direction==='received'?'selected':''}>আমি নিয়েছি</option>
          </select>
        </div>
        <div class="form-group">
          <label>ব্যক্তির নাম <span class="req">*</span></label>
          <input id="lf-person" class="form-control" value="${d.person||''}" placeholder="ব্যক্তির নাম / প্রতিষ্ঠান" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পরিমাণ (৳) <span class="req">*</span></label>
          <input id="lf-amount" type="number" class="form-control" value="${d.amount||''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label>তারিখ</label>
          <input id="lf-date" type="date" class="form-control" value="${(d.date||Utils.today()).split('T')[0]}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>পেমেন্ট পদ্ধতি</label>
          <select id="lf-method" class="form-control">
            <option value="Cash"           ${(d.method||'Cash')==='Cash'?'selected':''}>নগদ</option>
            <option value="Bank"           ${d.method==='Bank'?'selected':''}>ব্যাংক</option>
            <option value="Mobile Banking" ${d.method==='Mobile Banking'?'selected':''}>মোবাইল ব্যাংকিং</option>
          </select>
        </div>
        <div class="form-group">
          <label>অবস্থা</label>
          <select id="lf-status" class="form-control">
            <option value="Outstanding" ${(d.status||'Outstanding')==='Outstanding'?'selected':''}>বকেয়া</option>
            <option value="Paid"        ${d.status==='Paid'?'selected':''}>পরিশোধিত</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>নোট</label>
        <textarea id="lf-note" class="form-control" rows="2">${d.note||''}</textarea>
      </div>
      <div id="lf-error" class="form-error hidden"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="Utils.closeModal()">বাতিল</button>
        <button class="btn-primary" onclick="Loans.saveLoan()"><i class="fa fa-floppy-disk"></i> সংরক্ষণ</button>
      </div>
    `;
  }

  function saveLoan() {
    const person = Utils.formVal('lf-person');
    const amount = Utils.safeNum(Utils.formVal('lf-amount'));
    const errEl  = document.getElementById('lf-error');

    if (!person) { errEl.textContent='ব্যক্তির নাম আবশ্যক'; errEl.classList.remove('hidden'); return; }
    if (!amount||amount<=0) { errEl.textContent='পরিমাণ আবশ্যক'; errEl.classList.remove('hidden'); return; }

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
        description:`লোন — ${person}`, amount, date:record.date, note:record.note,
      });
    }

    if (editingId) {
      SupabaseSync.update(DB.loans, editingId, record);
      Utils.toast('লোন আপডেট হয়েছে ✓','success');
    } else {
      SupabaseSync.insert(DB.loans, record);
      Utils.toast('লোন যোগ হয়েছে ✓','success');
    }
    Utils.closeModal();
    render();
  }

  function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus==='Paid'?'Outstanding':'Paid';
    SupabaseSync.update(DB.loans, id, { status:newStatus });
    Utils.toast(`অবস্থা পরিবর্তিত: ${newStatus==='Paid'?'পরিশোধিত':'বকেয়া'}`,'info');
    render();
  }

  async function deleteLoan(id) {
    const ok = await Utils.confirm('এই লোন রেকর্ড মুছে ফেলবেন?','লোন মুছুন');
    if (!ok) return;
    SupabaseSync.remove(DB.loans, id);
    Utils.toast('মুছে ফেলা হয়েছে','info');
    render();
  }

  return { render, openAddModal, openEditModal, saveLoan, toggleStatus, deleteLoan };

})();
