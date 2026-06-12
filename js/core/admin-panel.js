// ========================
// Wings Fly Academy — Admin Panel JavaScript
// Extracted from admin.html to comply with Content Security Policy (no unsafe-inline)
// ========================

// AUTH — SHA-256 hashing
async function _adminHashPw(pw) {
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch {
    // ✅ Fix #8 (2026-06): FNV-1a 32-bit 3-round + salt — matches app.js fallback
    const salt = 'wfa_2026_';
    const salted = salt + pw + pw.length.toString(16);
    let h = 0x811c9dc5;
    for (let round = 0; round < 3; round++) {
      const input = round === 0 ? salted : salted + (h >>> 0).toString(16);
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
    }
    const h1 = (h >>> 0).toString(16).padStart(8, '0');
    const h2 = ((h >>> 0) ^ 0x9e3779b9 >>> 0).toString(16).padStart(8, '0');
    return 'fb_' + h1 + h2;
  }
}

function _adminIsHashed(s) {
  return /^[0-9a-f]{64}$/.test(s) || (s || '').startsWith('fb_');
}

function _adminEsc(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function doLogin() {
  const val = document.getElementById('adminPass').value;
  if (!val) { document.getElementById('loginError').style.display = 'block'; return; }

  const stored = localStorage.getItem('wfa_admin_pass');
  let match;

  if (!stored) {
    const defaultHash = await _adminHashPw('wfa2024');
    const inputHash   = await _adminHashPw(val);
    match = (inputHash === defaultHash) || (val === 'wfa2024');
    if (match) {
      localStorage.setItem('wfa_admin_pass', await _adminHashPw(val));
    }
  } else if (_adminIsHashed(stored)) {
    const inputHash = await _adminHashPw(val);
    match = (inputHash === stored);
  } else {
    // Legacy plaintext — auto-upgrade to hash
    match = (val === stored);
    if (match) {
      localStorage.setItem('wfa_admin_pass', await _adminHashPw(val));
    }
  }

  if (match) {
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginSection').classList.remove('active');
    document.getElementById('dashSection').classList.add('active');
    document.getElementById('mainHeader').style.display = 'flex';
    loadAll();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}

function logout() {
  document.getElementById('dashSection').classList.remove('active');
  document.getElementById('loginSection').classList.add('active');
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('adminPass').value = '';
}

// TABS
function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach((t, _i) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  const tabs = ['questions','add','results','settings'];
  document.querySelectorAll('.nav-tab')[tabs.indexOf(name)].classList.add('active');
  if (name === 'results') loadResults();
}

// QUESTIONS CRUD
function _migrateExamLocalStorage() {
  try {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    let changed = false;
    const legacyQ = localStorage.getItem('wfa_questions');
    if (legacyQ && !cfg.exam_questions) {
      cfg.exam_questions = legacyQ;
      changed = true;
      localStorage.removeItem('wfa_questions');
    }
    const legacyS = localStorage.getItem('wfa_settings');
    if (legacyS && !cfg.exam_settings) {
      cfg.exam_settings = legacyS;
      changed = true;
      localStorage.removeItem('wfa_settings');
    }
    if (changed) {
      if (cfg.id) SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
      else SupabaseSync.insert(DB.settings, cfg, { bypassLog: true });
    }
  } catch (e) { console.warn('[AdminPanel] exam LS migration:', e?.message); }
}

function getQuestions() {
  try {
    _migrateExamLocalStorage();
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const stored = cfg.exam_questions;
    if (stored) return typeof stored === 'string' ? JSON.parse(stored) : stored;
    return [];
  } catch { return []; }
}

function saveQuestions(qs) {
  try {
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    cfg.exam_questions = JSON.stringify(qs);
    if (cfg.id) {
      SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
    } else {
      SupabaseSync.insert(DB.settings, cfg, { bypassLog: true });
    }
  } catch(e) { console.warn('[AdminPanel] saveQuestions failed:', e?.message); }
}

function renderQuestionList() {
  const qs = getQuestions();
  document.getElementById('qCount').textContent = qs.length;

  const settings = getSettings();
  document.getElementById('qActive').textContent = settings.active !== false ? 'চালু ✓' : 'বন্ধ ✕';
  document.getElementById('qActive').style.color = settings.active !== false ? 'var(--success)' : 'var(--danger)';
  document.getElementById('qActive').style.fontSize = '15px';

  const list = document.getElementById('questionList');
  if (qs.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📭</div><div>কোনো প্রশ্ন নেই। নিচের বাটনে ক্লিক করে যোগ করুন।</div></div>`;
    return;
  }

  list.innerHTML = qs.map((q, i) => `
    <div class="q-item">
      <div class="q-item-top">
        <div class="q-item-text">${i+1}. ${_adminEsc(q.question)} <span style="font-size:12px;color:var(--muted); font-weight:normal;">[মান: ${_adminEsc(q.marks || 1)}]</span></div>
        <div class="q-item-actions">
          <button class="btn btn-outline btn-sm" onclick="editQuestion(${i})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${i})">🗑️</button>
        </div>
      </div>
      <div class="q-options-preview">
        ${q.options.map((o, j) => `<span class="q-opt-pill ${j===q.answer?'correct':''}">${['ক','খ','গ','ঘ'][j]}. ${_adminEsc(o)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function saveQuestion() {
  const qText = document.getElementById('qText').value.trim();
  const qMarks = parseInt(document.getElementById('qMarks').value) || 5;
  const opts = [0,1,2,3].map(i => document.getElementById('opt'+i).value.trim());
  const correctRadio = document.querySelector('input[name="correctAns"]:checked');

  if (!qText) { showAddAlert('❌ প্রশ্ন লিখুন।', 'danger'); return; }
  if (opts.some(o => !o)) { showAddAlert('❌ সব অপশন পূরণ করুন।', 'danger'); return; }
  if (!correctRadio) { showAddAlert('❌ সঠিক উত্তর বেছে নিন।', 'danger'); return; }

  const qs = getQuestions();
  const editingId = document.getElementById('editingId').value;
  const newQ = {
    id: editingId ? parseInt(editingId) : Date.now(),
    question: qText,
    marks: qMarks,
    options: opts,
    answer: parseInt(correctRadio.value)
  };

  if (editingId) {
    const idx = qs.findIndex(q => String(q.id) === String(editingId));
    if (idx !== -1) { qs[idx] = newQ; } else { qs.push(newQ); }
  } else {
    qs.push(newQ);
  }

  saveQuestions(qs);
  clearForm();
  showAddAlert('✅ প্রশ্ন সফলভাবে সংরক্ষণ হয়েছে!', 'success');
  renderQuestionList();
  setTimeout(() => { switchTab('questions'); }, 1200);
}

function editQuestion(idx) {
  const qs = getQuestions();
  let q = qs[idx];
  if (!q.id) { q.id = Date.now() + idx; saveQuestions(qs); }
  document.getElementById('qText').value = q.question;
  document.getElementById('qMarks').value = q.marks || 5;
  [0,1,2,3].forEach(i => document.getElementById('opt'+i).value = q.options[i] || '');
  const radios = document.querySelectorAll('input[name="correctAns"]');
  radios.forEach(r => r.checked = false);
  radios[q.answer].checked = true;
  document.getElementById('editingId').value = q.id;
  document.getElementById('addFormTitle').textContent = '✏️ প্রশ্ন এডিট করুন';
  switchTab('add');
}

function deleteQuestion(idx) {
  if (!confirm('এই প্রশ্নটি মুছে দিতে চান?')) return;
  const qs = getQuestions();
  qs.splice(idx, 1);
  saveQuestions(qs);
  renderQuestionList();
}

function clearForm() {
  document.getElementById('qText').value = '';
  document.getElementById('qMarks').value = '5';
  [0,1,2,3].forEach(i => document.getElementById('opt'+i).value = '');
  document.querySelectorAll('input[name="correctAns"]').forEach(r => r.checked = false);
  document.getElementById('editingId').value = '';
  document.getElementById('addFormTitle').textContent = '➕ নতুন প্রশ্ন যোগ করুন';
  document.getElementById('addAlert').style.display = 'none';
}

function showAddAlert(msg, type) {
  const el = document.getElementById('addAlert');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function clearAllQuestions() {
  if (!confirm('⚠️ সব প্রশ্ন মুছে ফেলতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না।')) return;
  saveQuestions([]);
  renderQuestionList();
}

// RESULTS
function loadResults() {
  const localResults = JSON.parse(localStorage.getItem('wfa_results') || '[]');
  const allExams = SupabaseSync.getAll(DB.exams) || [];
  const nativeResults = allExams.filter(e => e.marks != null).map(e => ({
    name: e.student_name,
    id: e.student_id,
    correct: Math.round((e.marks / 100) * 5),
    total: 5,
    pct: parseInt(e.marks),
    passed: e.status === 'Passed',
    warnings: e.note ? String(e.note).replace('Extracted Warnings: ', '') : 0,
    date: new Date(e.created_at).toLocaleString('bn-BD')
  }));

  const results = [...nativeResults];
  localResults.forEach(lr => {
    if(!results.find(nr => nr.id === lr.id && nr.pct === lr.pct)) {
      results.push(lr);
    }
  });
  if (localResults.length > 0 && nativeResults.length > 0) {
    localStorage.removeItem('wfa_results');
  }

  const tbody = document.getElementById('resultBody');
  const noRes = document.getElementById('noResults');

  if (results.length === 0) {
    tbody.innerHTML = '';
    noRes.style.display = 'block';
    document.getElementById('rs-total').textContent = '0';
    document.getElementById('rs-pass').textContent = '0';
    document.getElementById('rs-fail').textContent = '0';
    document.getElementById('rs-avg').textContent = '0%';
    return;
  }

  noRes.style.display = 'none';
  const passed = results.filter(r => r.passed).length;
  const avg = Math.round(results.reduce((s,r) => s + r.pct, 0) / results.length);

  document.getElementById('rs-total').textContent = results.length;
  document.getElementById('rs-pass').textContent = passed;
  document.getElementById('rs-fail').textContent = results.length - passed;
  document.getElementById('rs-avg').textContent = avg + '%';

  tbody.innerHTML = results.map(r => `
    <tr>
      <td>${_adminEsc(r.name)}</td>
      <td>${_adminEsc(r.id)}</td>
      <td><strong>${r.correct} / 5 </strong> (${r.pct}%)</td>
      <td><span class="pass-badge ${r.passed?'pass':'fail'}">${r.passed?'উত্তীর্ণ':'অনুত্তীর্ণ'}</span></td>
      <td>${r.warnings || 0}</td>
    </tr>
  `).join('');
}

function clearResults() {
  if (!confirm('সব রেজাল্ট মুছে দিতে চান?')) return;
  localStorage.removeItem('wfa_results');
  loadResults();
}

function exportResults() {
  const results = JSON.parse(localStorage.getItem('wfa_results') || '[]');
  if (results.length === 0) { alert('কোনো রেজাল্ট নেই।'); return; }
  const rows = [['নাম','ID','সঠিক','মোট','%','ফলাফল','সতর্কতা','তারিখ']];
  results.forEach(r => rows.push([r.name,r.id,r.correct,r.total,r.pct+'%',r.passed?'উত্তীর্ণ':'অনুত্তীর্ণ',r.warnings||0,r.date]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='wfa_results.csv'; a.click();
}

// SETTINGS
function getSettings() {
  try {
    _migrateExamLocalStorage();
    const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
    const stored = cfg.exam_settings;
    if(stored) return typeof stored === 'string' ? JSON.parse(stored) : stored;
    return { active:true, duration:10, passMark:60, maxWarnings:3, examName:'', examDate:'' };
  } catch { return { active:true, duration:10, passMark:60, maxWarnings:3, examName:'', examDate:'' }; }
}

function saveSettings() {
  const s = getSettings();
  s.duration = parseInt(document.getElementById('durationInput').value) || 10;
  s.passMark = parseInt(document.getElementById('passMarkInput').value) || 60;
  s.maxWarnings = parseInt(document.getElementById('maxWarnInput').value) || 3;
  s.examName = document.getElementById('examNameInput').value;
  s.examDate = document.getElementById('examDateInput').value;
  const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
  cfg.exam_settings = JSON.stringify(s);
  if (cfg.id) SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
}

function loadSettings() {
  const s = getSettings();
  document.getElementById('durationInput').value = s.duration || 10;
  document.getElementById('passMarkInput').value = s.passMark || 60;
  document.getElementById('maxWarnInput').value = s.maxWarnings || 3;
  if(document.getElementById('examNameInput')) document.getElementById('examNameInput').value = s.examName || '';
  if(document.getElementById('examDateInput')) document.getElementById('examDateInput').value = s.examDate || '';
  const toggle = document.getElementById('examActiveToggle');
  if (s.active === false) toggle.classList.remove('on');
  else toggle.classList.add('on');
}

function toggleExamActive() {
  const s = getSettings();
  s.active = s.active === false ? true : false;
  localStorage.setItem('wfa_settings', JSON.stringify(s));
  const cfg = SupabaseSync.getAll(DB.settings)[0] || {};
  cfg.exam_settings = JSON.stringify(s);
  if (cfg.id) SupabaseSync.update(DB.settings, cfg.id, cfg, { bypassLog: true });
  const toggle = document.getElementById('examActiveToggle');
  s.active ? toggle.classList.add('on') : toggle.classList.remove('on');
  renderQuestionList();
}

async function changePassword() {
  const np = document.getElementById('newPass').value;
  const cp = document.getElementById('confirmPass').value;
  const el = document.getElementById('passAlert');
  el.style.display = 'block';
  if (!np) { el.className='alert alert-danger'; el.textContent='❌ পাসওয়ার্ড লিখুন।'; return; }
  if (np !== cp) { el.className='alert alert-danger'; el.textContent='❌ পাসওয়ার্ড মিলছে না।'; return; }
  const hash = await _adminHashPw(np);
  localStorage.setItem('wfa_admin_pass', hash);
  el.className='alert alert-success'; el.textContent='✅ পাসওয়ার্ড পরিবর্তন হয়েছে!';
  document.getElementById('newPass').value = '';
  document.getElementById('confirmPass').value = '';
}

// IMPORT / EXPORT
function exportQuestions() {
  const qs = getQuestions();
  const blob = new Blob([JSON.stringify(qs, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='wfa_questions.json'; a.click();
}

function importQuestions(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid');
      saveQuestions(data);
      renderQuestionList();
      alert('✅ ' + data.length + 'টি প্রশ্ন সফলভাবে আমদানি হয়েছে!');
    } catch {
      alert('❌ ফাইল সঠিক নয়। JSON ফরম্যাট হতে হবে।');
    }
  };
  reader.readAsText(file);
}

// INIT
function loadAll() {
  WFA_IDB.onReady(() => {
    renderQuestionList();
    loadSettings();
  });
}

// ── Expose to global scope (called from HTML onclick attributes) ──
// ESLint reports these as "unused" because it cannot see HTML onclick usage.
window.doLogin            = doLogin;
window.logout             = logout;
window.switchTab          = switchTab;
window.saveQuestion       = saveQuestion;
window.editQuestion       = editQuestion;
window.deleteQuestion     = deleteQuestion;
window.clearAllQuestions  = clearAllQuestions;
window.exportQuestions    = exportQuestions;
window.importQuestions    = importQuestions;
window.clearResults       = clearResults;
window.exportResults      = exportResults;
window.toggleExamActive   = toggleExamActive;
window.saveSettings       = saveSettings;
window.changePassword     = changePassword;
window.loadAll            = loadAll;
