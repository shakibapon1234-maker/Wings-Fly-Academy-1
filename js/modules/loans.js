/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/loans.js
   Loan Management — Person-wise tracking
════════════════════════════════════════════════ */

const Loans = (() => {

  let editingId = null;
  let currentPage = 1;
  let pageSize = 20;

  function render() {
    const container = document.getElementById('loans-content');
    if (!container) return;

    const loans = Utils.sortBy(SupabaseSync.getAll(DB.loans),'date','desc');

    /* Person-wise summary */
    const personMap = {};
    loans.forEach(l => {
      const p = l.person_name || l.person || 'UnknownNo';
      if (!personMap[p]) personMap[p] = { given:0, received:0 };
      if (l.type==='Loan Giving' || l.direction==='given')    personMap[p].given    += Utils.safeNum(l.amount);
      if (l.type==='Loan Receiving' || l.direction==='received') personMap[p].received += Utils.safeNum(l.amount);
    });

    const totalGiven    = loans.filter(l=>l.type==='Loan Giving' || l.direction==='given').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    const totalReceived = loans.filter(l=>l.type==='Loan Receiving' || l.direction==='received').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    const netOwed       = totalGiven - totalReceived; /* positive = others owe us */

    container.innerHTML = `
      <!-- Section Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="search-input-wrapper" style="min-width:220px">
            <i class="fa fa-search"></i>
            <input type="text" id="loan-search" placeholder="Search Person..." oninput="Loans.filterCards()" style="border-color:rgba(0,212,255,0.2)" />
          </div>
        </div>
        <label class="toggle-switch">
          <span>Show Settled</span>
          <input type="checkbox" id="loan-show-settled" onchange="Loans.render()" />
          <span class="slider"></span>
        </label>
      </div>

      <!-- Person-wise Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px" id="loan-cards">
        ${Object.keys(personMap).length ? Object.entries(personMap).map(([person, {given, received}]) => {
          const net = given - received;
          const settled = net === 0;
          if (settled && !document.getElementById('loan-show-settled')?.checked) return '';
          const letter = (person[0] || '?').toUpperCase();
          return `
          <div class="loan-person-card" onclick="Loans.showPersonDetail('${person.replace(/'/g,"\\'")}')" data-person="${person.toLowerCase()}">
            <div class="person-avatar">${letter}</div>
            <div class="person-name">${person}</div>
            <div class="person-owe" style="color:${net>0?'#ff4757':'#00ff88'}">
              ${net > 0 ? 'We Owe: ' : 'They Owe: '}${Utils.takaEn(Math.abs(net))}
            </div>
            <div class="person-breakdown">
              <span>Given: ${Utils.takaEn(given)}</span>
              <span>Recv: ${Utils.takaEn(received)}</span>
            </div>
          </div>`;
        }).join('') : `<div class="no-data" style="grid-column:1/-1"><i class="fa fa-inbox"></i>No loans found</div>`}
      </div>

      <!-- Stats Summary -->
      <div class="grid-3" style="margin-bottom:20px">
        <div class="stat-card glow-orange">
          <div class="stat-header">Total Given Loan</div>
          <div class="stat-value" style="color:#ff6b35">${Utils.takaEn(totalGiven)}</div>
          <div class="stat-icon-wrapper" style="background:rgba(255,107,53,0.1);color:#ff6b35;border:1px solid rgba(255,107,53,0.2)"><i class="fa fa-arrow-up-right-from-square"></i></div>
        </div>
        <div class="stat-card glow-green">
          <div class="stat-header">Total Taken Loan</div>
          <div class="stat-value">${Utils.takaEn(totalReceived)}</div>
          <div class="stat-icon-wrapper" style="background:rgba(0,255,136,0.1);color:#00ff88;border:1px solid rgba(0,255,136,0.2)"><i class="fa fa-arrow-down"></i></div>
        </div>
        <div class="stat-card ${netOwed>=0?'glow-cyan':'glow-orange'}">
          <div class="stat-header">${netOwed>=0?'Others Owe Us':'We Owe Others'}</div>
          <div class="stat-value">${Utils.takaEn(Math.abs(netOwed))}</div>
          <div class="stat-icon-wrapper"><i class="fa fa-scale-balanced"></i></div>
        </div>
      </div>

      <!-- Full Loan Ledger -->
      <div class="card" style="border-color:rgba(0,212,255,0.12)">
        <div class="card-title" style="margin-bottom:14px;color:var(--brand-primary)"><i class="fa fa-list" style="color:var(--brand-primary)"></i> Loan Ledger</div>
        ${loans.length ? (() => {
          const pageData = Utils.paginate(loans, currentPage, pageSize);
          return `<div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Person</th><th>Type</th><th>Amount</th><th>Status</th><th class="no-print">Action</th></tr></thead>
            <tbody>
              ${pageData.items.map(l=>`<tr>
                <td style="font-size:0.82rem">${Utils.formatDate(l.date)}</td>
                <td style="font-weight:600">${l.person_name || l.person || '—'}</td>
                <td>${(l.type==='Loan Giving' || l.direction==='given')
                  ? '<span class="badge-expense">Given</span>'
                  : '<span class="badge-income">Taken</span>'}</td>
                <td style="font-family:var(--font-ui);font-weight:600">${Utils.takaEn(l.amount)}</td>
                <td>${Utils.statusBadge(l.status||'Outstanding')}</td>
                <td class="no-print">
                  <div class="table-actions">
                    <button class="btn-edit" onclick="Loans.toggleStatus('${l.id}','${l.status||'Outstanding'}')">
                      <i class="fa fa-check"></i>
                    </button>
                    <button class="btn-edit" onclick="Loans.openEditModal('${l.id}')"><i class="fa fa-pen"></i></button>
                    <button class="btn-delete" onclick="Loans.deleteLoan('${l.id}')"><i class="fa fa-trash"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${(pageData.pages > 1 || pageSize !== 20) ? Utils.renderPaginationUI(pageData.total, currentPage, pageSize, 'Loans') : ''}`;
        })() : `<div class="no-data"><i class="fa fa-inbox"></i>No loans found</div>`}
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
    const allLoans = SupabaseSync.getAll(DB.loans);

    // ── Person dropdown: type-aware ──────────────────────────────────────
    // Loan Given (আমি দিয়েছি) সিলেক্ট থাকলে → "Loan Receiving" করা নামগুলো দেখাও
    //   (যাদের কাছ থেকে আগে নিয়েছিলাম, এখন ফেরত দিতে পারি)
    // Loan Taken (আমি নিয়েছি) সিলেক্ট থাকলে → "Loan Giving" করা নামগুলো দেখাও
    //   (যাদেরকে আগে দিয়েছিলাম, এখন তারা ফেরত দিতে পারে / নতুন নিতে পারি)
    // কিন্তু edit mode-এ current name সহ সব নাম দেখাও
    // Default: সব নাম দেখাও (dropdown সবসময় সব লোন পার্সনের নাম রাখবে)
    const currentType = d.type || d.direction || 'Loan Giving';
    const givenPersons    = [...new Set(allLoans.filter(l=>l.type==='Loan Giving'   ||l.direction==='given'   ).map(l=>l.person_name||l.person||'').filter(Boolean))].sort();
    const receivedPersons = [...new Set(allLoans.filter(l=>l.type==='Loan Receiving'||l.direction==='received').map(l=>l.person_name||l.person||'').filter(Boolean))].sort();
    const allPersons      = [...new Set(allLoans.map(l=>l.person_name||l.person||'').filter(Boolean))].sort();

    // Editing হলে সব নাম দেখাও, নতুন add-এ type-wise
    const existingPersons = d.id ? allPersons : allPersons; // always all, JS will filter dynamically

    // Date parts
    const dateStr = (d.date || Utils.today()).split('T')[0];
    const dateParts = dateStr.split('-');
    const yyyy = dateParts[0] || String(new Date().getFullYear());
    const mm   = dateParts[1] || String(new Date().getMonth()+1).padStart(2,'0');
    const dd   = dateParts[2] || String(new Date().getDate()).padStart(2,'0');
    const months = [
      ['01','January'],['02','February'],['03','March'],['04','April'],
      ['05','May'],['06','June'],['07','July'],['08','August'],
      ['09','September'],['10','October'],['11','November'],['12','December']
    ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length:8}, (_,i) => currentYear - 3 + i);

    return `
      <div class="form-row">
        <div class="form-group">
          <label>Loan Type <span class="req">*</span></label>
          <select id="lf-direction" class="form-control" onchange="Loans._onTypeChange()">
            <option value="Loan Giving"    ${(l=>l.type==='Loan Giving'||l.direction==='given')(d)?'selected':''}>আমি দিয়েছি (Loan Given)</option>
            <option value="Loan Receiving" ${(l=>l.type==='Loan Receiving'||l.direction==='received')(d)?'selected':''}>আমি নিয়েছি (Loan Taken)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Payment Method <span class="req">*</span></label>
          <select id="lf-method" class="form-control" onchange="Utils.onPaymentMethodChange && Utils.onPaymentMethodChange(this, 'lf-bal-display')">
            <option value="">Select Method</option>
            ${Utils.getPaymentMethodsHTML(d.method)}
          </select>
          <div id="lf-bal-display" style="display:none;"></div>
        </div>
      </div>

      <!-- Person Name: type-aware dropdown + manual input -->
      <div class="form-group">
        <label>Person's Name <span class="req">*</span></label>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="lf-person-select" class="form-control" style="flex:1; min-width:160px;"
            onchange="Loans._onPersonSelect()"
            data-given='${JSON.stringify(givenPersons)}'
            data-received='${JSON.stringify(receivedPersons)}'
            data-all='${JSON.stringify(allPersons)}'>
            <option value="">-- পূর্বের নাম বেছে নিন --</option>
            ${allPersons.map(p => `<option value="${p}" ${(d.person_name===p||d.person===p)?'selected':''}>${p}</option>`).join('')}
          </select>
          <input id="lf-person" class="form-control" style="flex:1; min-width:160px;" value="${d.person_name||d.person||''}" placeholder="অথবা নতুন নাম লিখুন" />
        </div>
        <div id="lf-person-hint" style="font-size:.72rem; color:var(--text-muted); margin-top:4px;">
          <i class="fa fa-info-circle"></i> <span id="lf-hint-text">Dropdown থেকে বেছে নিন অথবা নতুন নাম লিখুন</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Amount (৳) <span class="req">*</span></label>
          <input id="lf-amount" type="number" class="form-control" value="${d.amount||''}" placeholder="0" min="1" />
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <div style="display:flex; gap:6px;">
            <select id="lf-date-dd" class="form-control" style="flex:0 0 70px;" onchange="Loans._syncDate()">
              ${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}"${dd===v?' selected':''}>${v}</option>`;}).join('')}
            </select>
            <select id="lf-date-mm" class="form-control" style="flex:1;" onchange="Loans._syncDate()">
              ${months.map(([v,n])=>`<option value="${v}"${mm===v?' selected':''}>${n}</option>`).join('')}
            </select>
            <select id="lf-date-yyyy" class="form-control" style="flex:0 0 90px;" onchange="Loans._syncDate()">
              ${years.map(y=>`<option value="${y}"${yyyy===String(y)?' selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <input type="hidden" id="lf-date" value="${yyyy}-${mm}-${dd}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="lf-status" class="form-control">
            <option value="Outstanding" ${(d.status||'Outstanding')==='Outstanding'?'selected':''}>Outstanding (Due)</option>
            <option value="Paid"        ${d.status==='Paid'?'selected':''}>Settled / Paid</option>
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
      <script>
        // Form render হওয়ার পরে type-aware dropdown trigger করো
        (function() {
          setTimeout(function() {
            if (typeof Loans !== 'undefined' && Loans._onTypeChange) {
              Loans._onTypeChange();
            }
          }, 50);
        })();
      </script>
    `;
  }

  /* Person dropdown select করলে text input এ নাম বসাও */
  function _onPersonSelect() {
    const sel = document.getElementById('lf-person-select');
    const inp = document.getElementById('lf-person');
    if (sel && inp && sel.value) inp.value = sel.value;
  }

  /* Type change — dropdown কে filter করো */
  function _onTypeChange() {
    const typeEl = document.getElementById('lf-direction');
    const sel    = document.getElementById('lf-person-select');
    const hint   = document.getElementById('lf-hint-text');
    if (!typeEl || !sel) return;

    const type = typeEl.value; // 'Loan Giving' বা 'Loan Receiving'
    let persons = [];
    let hintMsg = '';

    try {
      const givenPersons    = JSON.parse(sel.dataset.given    || '[]');
      const receivedPersons = JSON.parse(sel.dataset.received || '[]');
      const allPersons      = JSON.parse(sel.dataset.all      || '[]');

      if (type === 'Loan Giving') {
        // আমি দিচ্ছি → যাদের কাছ থেকে আগে নিয়েছিলাম তাদের নাম suggest করো + সব নাম রাখো
        // Priority: আগে received persons, তারপর বাকিরা
        const priority = receivedPersons;
        const rest     = allPersons.filter(p => !priority.includes(p));
        persons = [...priority, ...rest];
        hintMsg = receivedPersons.length
          ? `⬆ উপরের ${receivedPersons.length} জন আগে লোন দিয়েছিলেন (ফেরত দেওয়ার সময়)`
          : 'নতুন নাম লিখুন অথবা dropdown থেকে বেছে নিন';
      } else {
        // আমি নিচ্ছি → যাদেরকে আগে দিয়েছিলাম তাদের নাম suggest করো
        const priority = givenPersons;
        const rest     = allPersons.filter(p => !priority.includes(p));
        persons = [...priority, ...rest];
        hintMsg = givenPersons.length
          ? `⬆ উপরের ${givenPersons.length} জনকে আগে লোন দেওয়া হয়েছে`
          : 'নতুন নাম লিখুন অথবা dropdown থেকে বেছে নিন';
      }
    } catch(e) {
      persons = [];
      hintMsg = 'নতুন নাম লিখুন';
    }

    // Dropdown rebuild
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">-- পূর্বের নাম বেছে নিন --</option>`
      + persons.map(p => `<option value="${p}" ${currentVal===p?'selected':''}>${p}</option>`).join('');

    if (hint) hint.textContent = hintMsg;
  }

  /* Date sync */
  function _syncDate() {
    const dd   = document.getElementById('lf-date-dd')?.value   || '';
    const mm   = document.getElementById('lf-date-mm')?.value   || '';
    const yyyy = document.getElementById('lf-date-yyyy')?.value || '';
    const h    = document.getElementById('lf-date');
    if (h) h.value = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
  }

  function saveLoan() {
    const person = (document.getElementById('lf-person')?.value || '').trim();
    const amount = Utils.safeNum(Utils.formVal('lf-amount'));
    const type   = Utils.formVal('lf-direction') || 'Loan Giving';
    const method = Utils.formVal('lf-method') || '';
    const errEl  = document.getElementById('lf-error');
    errEl.classList.add('hidden');

    if (!person) { errEl.textContent='Person Name required'; errEl.classList.remove('hidden'); return; }
    if (!amount) { errEl.textContent='Valid amount required'; errEl.classList.remove('hidden'); return; }
    if (!method) { errEl.textContent='Payment Method required'; errEl.classList.remove('hidden'); return; }

    // Loan দেওয়ার সময় account থেকে টাকা কাটবে — balance check
    if (type === 'Loan Giving') {
      const available = Utils.getAccountBalance ? Utils.getAccountBalance(method) : Infinity;
      if (amount > available) {
        errEl.textContent = `Insufficient funds in ${method}. Only ৳${Utils.formatMoneyPlain(available)} available.`;
        errEl.classList.remove('hidden');
        return;
      }
    }

    const record = {
      type:        type,
      person_name: person,
      amount,
      date:        Utils.formVal('lf-date') || Utils.today(),
      method:      method,
      status:      Utils.formVal('lf-status') || 'Outstanding',
      note:        Utils.formVal('lf-note') || '',
    };

    if (editingId) {
      SupabaseSync.update(DB.loans, editingId, record);
      Utils.toast('Loan updated ✓', 'success');
    } else {
      SupabaseSync.insert(DB.loans, record);

      // ──────────────────────────────────────────────────────
      // Loan দেওয়া = Account থেকে টাকা বের হয় (Expense like)
      // Loan নেওয়া = Account এ টাকা ঢোকে (Income like)
      // Finance ledger এ যাবে NOT — শুধু Account balance track করতে
      // finance এ Loan Giving / Loan Receiving type দিয়ে insert করি
      // যাতে Account balance calculation সঠিক থাকে
      // ──────────────────────────────────────────────────────
      SupabaseSync.insert(DB.finance, {
        type:        type,           // 'Loan Giving' বা 'Loan Receiving'
        method:      method,
        category:    'Loan',
        description: `${type === 'Loan Giving' ? 'Loan Given to' : 'Loan Taken from'}: ${person}`,
        amount,
        date:        record.date,
        note:        record.note,
        person_name: person,
        _isLoan:     true,           // flag — Finance UI এ আলাদাভাবে show করতে
      });

      // ── Account balance আপডেট ──────────────────────────────────────
      // Loan Given (আমি দিলাম) → account থেকে টাকা বের হয় = 'out'
      // Loan Received (আমি নিলাম) → account-এ টাকা আসে = 'in'
      if (type === 'Loan Giving') {
        SupabaseSync.updateAccountBalance(method, amount, 'out');
      } else {
        SupabaseSync.updateAccountBalance(method, amount, 'in');
      }

      Utils.toast('Loan Added ✓', 'success');
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
    const ok = await Utils.confirm('Delete this loan record? RecycleBin-এ যাবে এবং Restore করা যাবে।', 'Delete Loan');
    if (!ok) return;

    const record = SupabaseSync.getById(DB.loans, id);
    if (!record) return;

    // ── Finance এ linked entry খুঁজো ──────────────────────────────────
    // saveLoan() এ finance এ insert করার সময় person_name ও _isLoan flag দেওয়া হয়েছিল
    const financeEntries = SupabaseSync.getAll(DB.finance).filter(f =>
      f._isLoan === true &&
      (f.person_name === (record.person_name || record.person)) &&
      f.type === record.type &&
      f.amount == record.amount &&
      f.date === record.date
    );
    const linkedFinanceId = financeEntries.length > 0 ? financeEntries[0].id : null;

    // ── RecycleBin এ save করো (linked finance id সহ) ─────────────────
    SupabaseSync.insert(DB.recycle || 'recycle', {
      ...record,
      _deletedFrom:       'loans',
      _deletedAt:         Utils.today(),
      _linkedFinanceId:   linkedFinanceId,   // restore করার সময় কাজে লাগবে
    });

    // ── Loan remove ───────────────────────────────────────────────────
    SupabaseSync.remove(DB.loans, id);

    // ── Account balance reverse করো ───────────────────────────────────
    // Loan Given ছিল → টাকা বের হয়েছিল → এখন ফেরত দাও = 'in'
    // Loan Received ছিল → টাকা এসেছিল → এখন ফেরত নাও = 'out'
    if (record.method && record.amount) {
      const wasGiven = record.type === 'Loan Giving' || record.direction === 'given';
      SupabaseSync.updateAccountBalance(
        record.method,
        Utils.safeNum(record.amount),
        wasGiven ? 'in' : 'out'
      );
    }

    // ── Linked Finance entry-ও remove করো ────────────────────────────
    if (linkedFinanceId) {
      SupabaseSync.remove(DB.finance, linkedFinanceId);
    }

    Utils.toast('Loan deleted — RecycleBin-এ আছে, Restore করা যাবে', 'warning');
    render();
  }

  function filterCards() {
    const q = (document.getElementById('loan-search')?.value || '').toLowerCase();
    document.querySelectorAll('.loan-person-card').forEach(card => {
      const person = card.dataset.person || '';
      card.style.display = person.includes(q) ? '' : 'none';
    });
  }

  function showPersonDetail(person) {
    const loans = SupabaseSync.getAll(DB.loans).filter(l => (l.person_name === person || l.person === person));
    const given = loans.filter(l=>l.type==='Loan Giving' || l.direction==='given').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    const recv  = loans.filter(l=>l.type==='Loan Receiving' || l.direction==='received').reduce((s,l)=>s+Utils.safeNum(l.amount),0);
    Utils.openModal(`<i class="fa fa-user"></i> ${person} — Loan History`, `
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div style="flex:1;text-align:center;padding:12px;background:rgba(255,71,87,0.08);border-radius:10px">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Given</div>
          <div style="font-size:1.2rem;font-weight:800;color:#ff4757">${Utils.takaEn(given)}</div>
        </div>
        <div style="flex:1;text-align:center;padding:12px;background:rgba(0,255,136,0.08);border-radius:10px">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Received</div>
          <div style="font-size:1.2rem;font-weight:800;color:#00ff88">${Utils.takaEn(recv)}</div>
        </div>
      </div>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Direction</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${loans.map(l => `<tr>
          <td>${Utils.formatDate(l.date)}</td>
          <td>${(l.type==='Loan Giving' || l.direction==='given')?'<span class="badge-expense">Given</span>':'<span class="badge-income">Taken</span>'}</td>
          <td style="font-weight:600">${Utils.takaEn(l.amount)}</td>
          <td>${Utils.statusBadge(l.status||'Outstanding')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="form-actions"><button class="btn-secondary" onclick="Utils.closeModal()">Close</button></div>
    `);
  }

  function changePage(p) { currentPage = p; render(); }
  function changePageSize(s) { pageSize = parseInt(s); currentPage = 1; render(); }

  /* ── RecycleBin থেকে Restore ──────────────────────────────────────── */
  async function restoreLoan(recycleId) {
    const recycled = SupabaseSync.getById(DB.recycle || 'recycle', recycleId);
    if (!recycled) { Utils.toast('Record not found', 'error'); return; }

    // Loan restore
    const { _deletedFrom, _deletedAt, _linkedFinanceId, id: _rid, ...loanData } = recycled;
    SupabaseSync.insert(DB.loans, loanData);

    // Finance entry restore
    SupabaseSync.insert(DB.finance, {
      type:        loanData.type,
      method:      loanData.method,
      category:    'Loan',
      description: `${loanData.type === 'Loan Giving' ? 'Loan Given to' : 'Loan Taken from'}: ${loanData.person_name || loanData.person}`,
      amount:      loanData.amount,
      date:        loanData.date,
      note:        loanData.note || '',
      person_name: loanData.person_name || loanData.person,
      _isLoan:     true,
    });

    // RecycleBin থেকে সরাও
    SupabaseSync.remove(DB.recycle || 'recycle', recycleId);

    Utils.toast('Loan Restored ✓ — Loans ও Finance উভয়ে ফিরে এসেছে', 'success');
    render();
  }

  return { render, openAddModal, openEditModal, saveLoan, toggleStatus, deleteLoan, restoreLoan, filterCards, showPersonDetail, changePage, changePageSize, _onPersonSelect, _onTypeChange, _syncDate };

})();

