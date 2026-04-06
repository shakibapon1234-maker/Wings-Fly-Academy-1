// ============================================================
// Wings Fly Aviation Academy — Students Module (Phase 3)
// ============================================================

const StudentsModule = (() => {

  const TABLE = 'students';
  let allStudents = [];
  let currentPage = 1;
  const PAGE_SIZE = 15;
  let editingId = null;

  function load() {
    allStudents = SyncEngine.getLocal(TABLE);
  }

  function generateStudentId() {
    const existing = allStudents.map(s => s.student_id || '').filter(id => id.startsWith('WFA-'));
    const nums = existing.map(id => parseInt(id.replace('WFA-', '')) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1001;
    return `WFA-${next}`;
  }

  function getFiltered() {
    const term   = document.getElementById('stu-search')?.value.trim().toLowerCase() || '';
    const batch  = document.getElementById('stu-filter-batch')?.value || '';
    const course = document.getElementById('stu-filter-course')?.value || '';
    const status = document.getElementById('stu-filter-status')?.value || '';

    return allStudents.filter(s => {
      const matchTerm   = !term   || (s.name||'').toLowerCase().includes(term) || (s.student_id||'').toLowerCase().includes(term) || (s.phone||'').includes(term);
      const matchBatch  = !batch  || s.batch  === batch;
      const matchCourse = !course || s.course === course;
      const matchStatus = !status
        || (status === 'due'  && ((+s.total_fee||0)-(+s.paid_fee||0)) > 0)
        || (status === 'paid' && ((+s.total_fee||0)-(+s.paid_fee||0)) <= 0);
      return matchTerm && matchBatch && matchCourse && matchStatus;
    });
  }

  function getUniques(field) {
    return [...new Set(allStudents.map(s => s[field]).filter(Boolean))].sort();
  }

  function buildFilterOptions(id, field) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">সব</option>' +
      getUniques(field).map(v => `<option value="${v}" ${v===cur?'selected':''}>${v}</option>`).join('');
  }

  function renderTable() {
    const filtered = getFiltered();
    const { items, total, pages } = Utils.paginate(filtered, currentPage, PAGE_SIZE);
    const tbody = document.getElementById('stu-tbody');
    const info  = document.getElementById('stu-info');
    const pager = document.getElementById('stu-pager');
    if (!tbody) return;

    tbody.innerHTML = !items.length
      ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">কোনো ছাত্র পাওয়া যায়নি</td></tr>'
      : items.map(s => {
          const due = (+s.total_fee||0)-(+s.paid_fee||0);
          return `<tr>
            <td><span class="badge badge-info">${s.student_id||'—'}</span></td>
            <td><div class="font-bold font-bn">${s.name||'—'}</div><small class="text-muted">${s.phone||''}</small></td>
            <td>${s.course||'—'}</td>
            <td>${s.batch||'—'}</td>
            <td>${s.session||'—'}</td>
            <td class="text-right">${Utils.formatMoney(s.total_fee||0)}</td>
            <td class="text-right text-success">${Utils.formatMoney(s.paid_fee||0)}</td>
            <td class="text-right"><span class="badge ${due>0?'badge-error':'badge-success'}">${Utils.formatMoney(due)}</span></td>
            <td><div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="StudentsModule.openEdit('${s.id}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="StudentsModule.deleteStudent('${s.id}')">🗑️</button>
            </div></td>
          </tr>`;
        }).join('');

    if (info) info.textContent = `মোট ${total} জন`;

    if (pager) {
      let html = '';
      if (pages > 1) {
        html += `<button class="btn btn-ghost btn-sm" ${currentPage===1?'disabled':''} onclick="StudentsModule.goPage(${currentPage-1})">‹</button>`;
        for (let p=1; p<=pages; p++) {
          if (p===1||p===pages||Math.abs(p-currentPage)<=1)
            html += `<button class="btn btn-sm ${p===currentPage?'btn-primary':'btn-ghost'}" onclick="StudentsModule.goPage(${p})">${p}</button>`;
          else if (Math.abs(p-currentPage)===2)
            html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
        }
        html += `<button class="btn btn-ghost btn-sm" ${currentPage===pages?'disabled':''} onclick="StudentsModule.goPage(${currentPage+1})">›</button>`;
      }
      pager.innerHTML = html;
    }
  }

  function openAdd() {
    editingId = null;
    document.getElementById('stu-modal-title').textContent = '➕ নতুন ছাত্র যোগ করুন';
    document.getElementById('stu-form').reset();
    document.getElementById('stu-id-field').value  = generateStudentId();
    document.getElementById('stu-join-date').value = Utils.todayISO();
    Utils.openModal('stu-modal');
  }

  function openEdit(id) {
    const s = allStudents.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    document.getElementById('stu-modal-title').textContent = '✏️ ছাত্রের তথ্য সম্পাদনা';
    const f = (fid,val) => { const el=document.getElementById(fid); if(el) el.value=val||''; };
    f('stu-id-field',s.student_id); f('stu-name',s.name);    f('stu-phone',s.phone);
    f('stu-email',s.email);         f('stu-address',s.address); f('stu-course',s.course);
    f('stu-batch',s.batch);         f('stu-session',s.session); f('stu-total-fee',s.total_fee);
    f('stu-paid-fee',s.paid_fee);   f('stu-join-date',s.join_date); f('stu-notes',s.notes);
    // trigger due preview
    document.getElementById('stu-total-fee')?.dispatchEvent(new Event('input'));
    Utils.openModal('stu-modal');
  }

  async function saveStudent() {
    const g = id => document.getElementById(id)?.value.trim()||'';
    const name = g('stu-name');
    if (!name) { Utils.toast('নাম দিতে হবে', 'error'); return; }

    const record = {
      id:         editingId || SyncEngine.generateId('STU'),
      student_id: g('stu-id-field') || generateStudentId(),
      name, phone: g('stu-phone'), email: g('stu-email'), address: g('stu-address'),
      course: g('stu-course'), batch: g('stu-batch'), session: g('stu-session'),
      total_fee: parseFloat(g('stu-total-fee'))||0,
      paid_fee:  parseFloat(g('stu-paid-fee'))||0,
      join_date: g('stu-join-date')||Utils.todayISO(),
      notes: g('stu-notes'),
      created_at: editingId ? (allStudents.find(x=>x.id===editingId)?.created_at||Utils.nowISO()) : Utils.nowISO(),
      updated_at: Utils.nowISO(),
    };

    const btn = document.getElementById('stu-save-btn');
    if (btn) { btn.disabled=true; btn.textContent='⏳ সংরক্ষণ হচ্ছে…'; }

    await SyncEngine.saveRecord(TABLE, record);
    load();
    buildFilterOptions('stu-filter-batch','batch');
    buildFilterOptions('stu-filter-course','course');
    const sum = document.getElementById('stu-summary');
    if (sum) sum.innerHTML = getSummaryBadges();
    renderTable();
    Utils.closeModal('stu-modal');
    Utils.toast(editingId?'✅ তথ্য আপডেট হয়েছে':'✅ ছাত্র যোগ হয়েছে','success');
    if (btn) { btn.disabled=false; btn.textContent='💾 সংরক্ষণ করুন'; }
  }

  async function deleteStudent(id) {
    const s = allStudents.find(x=>x.id===id);
    if (!Utils.confirm(`"${s?.name}" কে মুছে ফেলবেন?`)) return;
    await SyncEngine.deleteRecord(TABLE, id);
    load(); renderTable();
    Utils.toast('🗑️ ছাত্র মুছে ফেলা হয়েছে','success');
  }

  function goPage(p) { currentPage=p; renderTable(); }
  function onSearch() { currentPage=1; renderTable(); }

  function printList() {
    const filtered = getFiltered();
    const rows = filtered.map(s => {
      const due = (+s.total_fee||0)-(+s.paid_fee||0);
      return `<tr><td>${s.student_id||'—'}</td><td>${s.name||'—'}</td><td>${s.phone||'—'}</td>
        <td>${s.course||'—'}</td><td>${s.batch||'—'}</td>
        <td style="text-align:right">${Utils.formatMoney(s.total_fee||0)}</td>
        <td style="text-align:right">${Utils.formatMoney(s.paid_fee||0)}</td>
        <td style="text-align:right;color:${due>0?'#C62828':'#2E7D32'}">${Utils.formatMoney(due)}</td></tr>`;
    }).join('');
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Student List</title>
      <style>body{font-family:sans-serif;padding:20px;font-size:13px}
      h2{color:#0D1B3E}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:7px 10px}th{background:#EEF2F7;font-size:11px;text-transform:uppercase}
      tr:nth-child(even){background:#F9FAFB}@media print{button{display:none}}</style>
      </head><body>
      <h2>Wings Fly Aviation Academy — Student List</h2>
      <p>মোট ${filtered.length} জন | ${Utils.formatDateEN(Utils.todayISO())}</p>
      <table><thead><tr><th>ID</th><th>নাম</th><th>ফোন</th><th>কোর্স</th><th>ব্যাচ</th>
      <th>মোট ফি</th><th>পরিশোধ</th><th>বকেয়া</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.print();<\/script></body></html>`);
    win.document.close();
  }

  function exportExcel() {
    const rows = getFiltered().map(s => ({
      'Student ID':s.student_id||'','নাম':s.name||'','ফোন':s.phone||'',
      'ইমেইল':s.email||'','কোর্স':s.course||'','ব্যাচ':s.batch||'',
      'সেশন':s.session||'','মোট ফি':s.total_fee||0,'পরিশোধ':s.paid_fee||0,
      'বকেয়া':(+s.total_fee||0)-(+s.paid_fee||0),'ভর্তির তারিখ':s.join_date||'','নোট':s.notes||'',
    }));
    Utils.downloadCSV(`students_${Utils.todayISO()}.csv`, rows);
  }

  function getSummaryBadges() {
    const total   = allStudents.length;
    const withDue = allStudents.filter(s=>((+s.total_fee||0)-(+s.paid_fee||0))>0).length;
    const paid    = allStudents.reduce((s,x)=>s+(+x.paid_fee||0),0);
    const due     = allStudents.reduce((s,x)=>s+((+x.total_fee||0)-(+x.paid_fee||0)),0);
    return `<span class="badge badge-info">👥 মোট: ${total}</span>
      <span class="badge badge-success">✅ পরিষ্কার: ${total-withDue}</span>
      <span class="badge badge-error">⚠️ বকেয়া: ${withDue}</span>
      <span class="badge badge-warning">💰 মোট বকেয়া: ${Utils.formatMoney(due)}</span>
      <span class="badge badge-muted">💵 কালেকশন: ${Utils.formatMoney(paid)}</span>`;
  }

  function ensureModal() {
    if (document.getElementById('stu-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'stu-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:680px">
        <div class="modal-header">
          <span class="modal-title" id="stu-modal-title">নতুন ছাত্র</span>
          <button class="modal-close" onclick="Utils.closeModal('stu-modal')">✕</button>
        </div>
        <div id="stu-form">
          <div class="form-grid">
            <div class="form-group"><label>Student ID</label>
              <input id="stu-id-field" placeholder="WFA-1001" /></div>
            <div class="form-group"><label>পূর্ণ নাম ✱</label>
              <input id="stu-name" placeholder="ছাত্রের নাম" class="font-bn" /></div>
            <div class="form-group"><label>ফোন</label>
              <input id="stu-phone" placeholder="01XXXXXXXXX" type="tel" /></div>
            <div class="form-group"><label>ইমেইল</label>
              <input id="stu-email" placeholder="email@example.com" type="email" /></div>
            <div class="form-group"><label>কোর্স</label>
              <input id="stu-course" placeholder="CPL, PPL, ATPL…" list="stu-course-list" />
              <datalist id="stu-course-list"><option value="CPL"><option value="PPL"><option value="ATPL"><option value="Ground School"><option value="Simulator"></datalist></div>
            <div class="form-group"><label>ব্যাচ</label>
              <input id="stu-batch" placeholder="Batch-12" /></div>
            <div class="form-group"><label>সেশন</label>
              <input id="stu-session" placeholder="Jan-2025" /></div>
            <div class="form-group"><label>ভর্তির তারিখ</label>
              <input id="stu-join-date" type="date" /></div>
            <div class="form-group"><label>মোট ফি (৳)</label>
              <input id="stu-total-fee" type="number" placeholder="0" min="0" /></div>
            <div class="form-group"><label>পরিশোধিত ফি (৳)</label>
              <input id="stu-paid-fee" type="number" placeholder="0" min="0" /></div>
          </div>
          <div class="form-group mt-16"><label>ঠিকানা</label>
            <input id="stu-address" placeholder="সম্পূর্ণ ঠিকানা" class="font-bn" /></div>
          <div class="form-group mt-16"><label>নোট</label>
            <textarea id="stu-notes" rows="2" placeholder="যেকোনো মন্তব্য…" class="font-bn"></textarea></div>
          <div id="stu-due-preview" style="margin-top:12px;padding:10px 14px;border-radius:var(--radius-sm);background:var(--bg-base);font-size:.875rem">
            বকেয়া: <strong id="stu-due-val" style="color:var(--text-primary)">৳০</strong>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
            <button class="btn btn-ghost" onclick="Utils.closeModal('stu-modal')">বাতিল</button>
            <button id="stu-save-btn" class="btn btn-primary" onclick="StudentsModule.saveStudent()">💾 সংরক্ষণ করুন</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    ['stu-total-fee','stu-paid-fee'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const total = parseFloat(document.getElementById('stu-total-fee')?.value)||0;
        const paid  = parseFloat(document.getElementById('stu-paid-fee')?.value)||0;
        const due   = total - paid;
        const el    = document.getElementById('stu-due-val');
        if (el) { el.textContent=Utils.formatMoney(due); el.style.color=due>0?'var(--error)':'var(--success)'; }
      });
    });
  }

  function render() {
    load();
    const sec = document.getElementById('section-students');
    if (!sec) return;
    sec.innerHTML = `
      <div class="page-header">
        <h2 class="font-bn">👩‍🎓 Students</h2>
        <div class="toolbar">
          <button class="btn btn-primary" onclick="StudentsModule.openAdd()">➕ নতুন ছাত্র</button>
          <button class="btn btn-outline btn-sm" onclick="StudentsModule.printList()">🖨️ Print</button>
          <button class="btn btn-outline btn-sm" onclick="StudentsModule.exportExcel()">📊 Excel</button>
        </div>
      </div>
      <div class="card mb-16">
        <div class="form-row">
          <div class="form-group flex-1">
            <input id="stu-search" placeholder="🔍 নাম, ID বা ফোন দিয়ে খুঁজুন…" oninput="StudentsModule.onSearch()" style="max-width:100%" />
          </div>
          <div class="form-group">
            <select id="stu-filter-batch" onchange="StudentsModule.onSearch()"><option value="">সব ব্যাচ</option></select>
          </div>
          <div class="form-group">
            <select id="stu-filter-course" onchange="StudentsModule.onSearch()"><option value="">সব কোর্স</option></select>
          </div>
          <div class="form-group">
            <select id="stu-filter-status" onchange="StudentsModule.onSearch()">
              <option value="">সব</option><option value="due">বকেয়া আছে</option><option value="paid">পরিষ্কার</option>
            </select>
          </div>
        </div>
      </div>
      <div id="stu-summary" class="mb-16" style="display:flex;gap:8px;flex-wrap:wrap">${getSummaryBadges()}</div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span id="stu-info" class="text-muted" style="font-size:.85rem"></span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>আইডি</th><th>নাম / ফোন</th><th>কোর্স</th><th>ব্যাচ</th><th>সেশন</th>
              <th class="text-right">মোট ফি</th><th class="text-right">পরিশোধ</th>
              <th class="text-right">বকেয়া</th><th>Action</th>
            </tr></thead>
            <tbody id="stu-tbody"></tbody>
          </table>
        </div>
        <div id="stu-pager" style="display:flex;gap:4px;margin-top:12px;flex-wrap:wrap"></div>
      </div>`;
    buildFilterOptions('stu-filter-batch','batch');
    buildFilterOptions('stu-filter-course','course');
    renderTable();
    ensureModal();
  }

  window.addEventListener('wfa:navigate', e => { if(e.detail.section==='students') render(); });
  window.addEventListener('wfa:synced', () => {
    const sec = document.getElementById('section-students');
    if (sec && sec.style.display!=='none') { load(); renderTable(); buildFilterOptions('stu-filter-batch','batch'); buildFilterOptions('stu-filter-course','course'); }
  });

  return { render, openAdd, openEdit, saveStudent, deleteStudent, onSearch, goPage, printList, exportExcel };
})();

window.StudentsModule = StudentsModule;
