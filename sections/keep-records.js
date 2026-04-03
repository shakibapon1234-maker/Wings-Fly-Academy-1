// ====================================
// WINGS FLY AVIATION ACADEMY
// KEEP RECORDS — Notes, Tags, Filters
// Extracted from app.js (Phase 4)
// ====================================

const KEEP_RECORD_KEY = 'wingsfly_keep_records';

function getKeepRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEEP_RECORD_KEY) || '[]');
  } catch (e) { return []; }
}

function saveKeepRecords(records) {
  localStorage.setItem(KEEP_RECORD_KEY, JSON.stringify(records));
  // ✅ SESSION 4 FIX: Sync push trigger যোগ করো
  if (typeof window.markDirty === 'function') window.markDirty('keep_records');
  if (typeof window.scheduleSyncPush === 'function') window.scheduleSyncPush('Keep Records updated');
}

function openNewNoteModal(editId = null) {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('noteDate').value = today;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteTag').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('editingNoteId').value = '';
  document.getElementById('noteModalTitle').textContent = 'নতুন নোট';

  if (editId) {
    const records = getKeepRecords();
    const note = records.find(r => r.id === editId);
    if (note) {
      document.getElementById('noteDate').value = note.date || today;
      document.getElementById('noteTitle').value = note.title || '';
      document.getElementById('noteTag').value = note.tag || '';
      document.getElementById('noteContent').value = note.content || '';
      document.getElementById('editingNoteId').value = editId;
      document.getElementById('noteModalTitle').textContent = 'নোট সম্পাদনা';
    }
  }

  const modal = new bootstrap.Modal(document.getElementById('newNoteModal'));
  modal.show();
}
window.openNewNoteModal = openNewNoteModal;

function saveNote() {
  const date = document.getElementById('noteDate').value;
  const title = document.getElementById('noteTitle').value.trim();
  const tag = document.getElementById('noteTag').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const editId = document.getElementById('editingNoteId').value;

  if (!title && !content) {
    showErrorToast('❌ শিরোনাম বা নোট দিতে হবে।');
    return;
  }

  const records = getKeepRecords();

  if (editId) {
    // Update existing note
    const idx = records.findIndex(r => r.id === editId);
    if (idx >= 0) {
      records[idx] = { ...records[idx], date, title, tag, content, updatedAt: new Date().toISOString() };
    }
  } else {
    // New note
    records.unshift({
      id: 'note_' + Date.now(),
      date: date || new Date().toISOString().split('T')[0],
      title,
      tag,
      content,
      createdAt: new Date().toISOString()
    });
  }

  saveKeepRecords(records);

  // ── Activity Log ──
  if (!window.globalData) window.globalData = {};
  if (!Array.isArray(window.globalData.activityHistory)) window.globalData.activityHistory = [];
  const actEntry = {
    id: 'ACT_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    action: editId ? 'EDIT' : 'ADD',
    type: 'keeprecord',
    description: (title || content || 'Note') + (editId ? ' updated' : ' added'),
    timestamp: new Date().toISOString(),
    user: sessionStorage.getItem('username') || 'Admin'
  };
  window.globalData.activityHistory.unshift(actEntry);
  if (window.globalData.activityHistory.length > 500) {
    window.globalData.activityHistory = window.globalData.activityHistory.slice(0, 500);
  }
  try {
    localStorage.setItem('wingsfly_activity_backup',
      JSON.stringify(window.globalData.activityHistory));
  } catch (e) { }
  if (typeof saveToStorage === 'function') saveToStorage();

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('newNoteModal'));
  if (modal) modal.hide();

  showSuccessToast('✅ নোট সেভ হয়েছে!');
  renderKeepRecordNotes();

  // Refresh tag dropdown
  updateNoteTagDropdown();
}
window.saveNote = saveNote;

function deleteNote(id) {
  const allRecords = getKeepRecords();
  const noteToDelete = allRecords.find(r => r.id === id);

  if (!noteToDelete) {
    if (typeof showErrorToast === 'function') showErrorToast('❌ নোট পাওয়া যায়নি।');
    return;
  }

  if (!confirm('আপনি কি নিশ্চিত যে এই নোটটি মুছে ফেলতে চান?')) return;

  // ── localStorage থেকে সরাও ──
  const remaining = allRecords.filter(r => r.id !== id);
  saveKeepRecords(remaining);

  // ── Recycle Bin and Activity Log ──
  if (typeof window.moveToTrash === 'function') {
    window.moveToTrash('keeprecord', noteToDelete);
  }
  if (typeof window.logActivity === 'function') {
    window.logActivity('keeprecord', 'DELETE', `🗑️ Note deleted: ${noteToDelete.title || noteToDelete.content || 'Note'}`, noteToDelete);
  }

  // ── globalData save ──
  if (typeof saveToStorage === 'function') saveToStorage();

  if (typeof showSuccessToast === 'function') showSuccessToast('🗑️ নোট Recycle Bin-এ গেছে।');
  renderKeepRecordNotes();
  updateNoteTagDropdown();
}
window.deleteNote = deleteNote;

function clearNoteFilters() {
  const dateEl = document.getElementById('noteFilterDate');
  const tagEl = document.getElementById('noteFilterTag');
  const searchEl = document.getElementById('noteSearchInput');
  if (dateEl) dateEl.value = '';
  if (tagEl) tagEl.value = '';
  if (searchEl) searchEl.value = '';
  renderKeepRecordNotes();
}
window.clearNoteFilters = clearNoteFilters;

function updateNoteTagDropdown() {
  const sel = document.getElementById('noteFilterTag');
  if (!sel) return;
  const records = getKeepRecords();
  const tags = [...new Set(records.map(r => r.tag).filter(Boolean))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">সব ট্যাগ</option>';
  tags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    sel.appendChild(opt);
  });
  if (current && tags.includes(current)) sel.value = current;
}

function renderKeepRecordNotes() {
  const container = document.getElementById('keepRecordNotesList');
  if (!container) return;

  updateNoteTagDropdown();

  let records = getKeepRecords();

  // Apply filters
  const dateFilter = document.getElementById('noteFilterDate')?.value;
  const tagFilter = document.getElementById('noteFilterTag')?.value;
  const searchFilter = document.getElementById('noteSearchInput')?.value.trim().toLowerCase();

  if (dateFilter) records = records.filter(r => r.date === dateFilter);
  if (tagFilter) records = records.filter(r => r.tag === tagFilter);
  if (searchFilter) records = records.filter(r =>
    (r.title || '').toLowerCase().includes(searchFilter) ||
    (r.content || '').toLowerCase().includes(searchFilter) ||
    (r.tag || '').toLowerCase().includes(searchFilter)
  );

  if (records.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5" style="color:#4a6080;">
        <div style="font-size:2.5rem; margin-bottom:12px;">🚩</div>
        <div style="font-size:1rem;">কোনো নোট পাওয়া যায়নি</div>
        <small>নতুন নোট যোগ করতে উপরের বাটনে ক্লিক করুন</small>
      </div>`;
    return;
  }

  // Tag color map
  const tagColors = {
    'গুরুত্বপূর্ণ': '#ff4d6d', 'important': '#ff4d6d',
    'ব্যক্তিগত': '#7c3aed', 'personal': '#7c3aed',
    'কাজ': '#0ea5e9', 'work': '#0ea5e9',
    'ফাইন্যান্স': '#22c55e', 'finance': '#22c55e',
  };
  function tagColor(tag) {
    return tagColors[tag?.toLowerCase()] || '#64748b';
  }

  container.innerHTML = records.map(note => `
    <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(0,217,255,0.12);
      border-radius:12px; padding:16px; margin-bottom:12px; transition:border-color 0.2s;"
      onmouseover="this.style.borderColor='rgba(0,217,255,0.3)'"
      onmouseout="this.style.borderColor='rgba(0,217,255,0.12)'">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          ${note.title ? `<div style="font-size:1rem; font-weight:700; color:#e2f0ff; margin-bottom:4px;">${escapeHtml(note.title)}</div>` : ''}
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span style="color:#7aa0c4; font-size:0.78rem;">📅 ${note.date || 'তারিখ নেই'}</span>
            ${note.tag ? `<span style="background:${tagColor(note.tag)}22; color:${tagColor(note.tag)}; border:1px solid ${tagColor(note.tag)}55; padding:1px 10px; border-radius:20px; font-size:0.72rem; font-weight:700;">${escapeHtml(note.tag)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button onclick="openNewNoteModal('${note.id}')"
            style="background:rgba(0,217,255,0.1); color:#00d9ff; border:1px solid rgba(0,217,255,0.3); border-radius:8px; padding:4px 10px; font-size:0.8rem; cursor:pointer;">
            ✏️ Edit
          </button>
          <button onclick="deleteNote('${note.id}')"
            style="background:rgba(255,59,92,0.1); color:#ff3b5c; border:1px solid rgba(255,59,92,0.3); border-radius:8px; padding:4px 10px; font-size:0.8rem; cursor:pointer;">
            🗑️
          </button>
        </div>
      </div>
      ${note.content ? `<div style="color:#9ab; font-size:0.875rem; line-height:1.6; white-space:pre-wrap;">${escapeHtml(note.content)}</div>` : ''}
    </div>
  `).join('');
}
window.renderKeepRecordNotes = renderKeepRecordNotes;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ===================================
// VISITOR MANAGEMENT
// Moved to: sections/visitor-management.js
// ===================================

// ===================================
// NOTICE BOARD
// Moved to: sections/notice-board.js
// ===================================

// ===================================
// SNAPSHOT SYSTEM
// Moved to: sections/snapshot-system.js
// ===================================


// ===================================
// KEEP RECORD — Snapshot Backup Button
// ===================================
function keepRecord() {
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      label: 'Manual Keep Record - ' + new Date().toLocaleString('bn-BD'),
      data: JSON.parse(JSON.stringify(window.globalData))
    };
    localStorage.setItem('wings_keep_record_latest', JSON.stringify(snapshot));
    if (typeof takeSnapshot === 'function') takeSnapshot();
    if (typeof showSuccessToast === 'function') {
      showSuccessToast('📦 Record kept! সমস্ত ডেটার একটি snapshot সেভ হয়েছে।');
    }
    console.log('📦 Keep Record saved:', snapshot.timestamp);
  } catch (err) {
    console.error('Keep Record error:', err);
    if (typeof showErrorToast === 'function') showErrorToast('❌ Keep Record ব্যর্থ: ' + err.message);
  }
}
window.keepRecord = keepRecord;

// ===================================
// FINAL SAFETY NET — Critical Window Exports

window.getKeepRecords = getKeepRecords;
window.saveKeepRecords = saveKeepRecords;
window.openNewNoteModal = openNewNoteModal;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.clearNoteFilters = clearNoteFilters;
window.updateNoteTagDropdown = updateNoteTagDropdown;
window.renderKeepRecordNotes = renderKeepRecordNotes;
window.keepRecord = keepRecord;

// ✅ AUTO-TEST ALIAS
window.deleteKeepRecord = window.deleteNote;
