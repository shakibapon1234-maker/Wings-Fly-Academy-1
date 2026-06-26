/* ============================================================
   Wings Fly Academy — Class Routine Engine
   Feature 3 | routine-engine.js
   ------------------------------------------------------------
   Shared engine used by:
     1. Admin App (index.html → js/modules/routine-builder.js)
        — CRUD for class_routines via SupabaseSync (IDB + cloud).
     2. Student Portal (student-portal.html → student-dashboard.js)
        — Read-only view of own batch routine (direct Supabase).

   Data lives in: `class_routines` Supabase table + local IDB.
   ============================================================ */

const RoutineEngine = (() => {
  'use strict';

  const TABLE = 'class_routines';

  const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const DAY_LABELS = {
    Sat: 'শনিবার',  Sun: 'রবিবার',  Mon: 'সোমবার',
    Tue: 'মঙ্গলবার', Wed: 'বুধবার',  Thu: 'বৃহস্পতিবার',
    Fri: 'শুক্রবার',
  };

  // ── Local IDB helpers (Admin App) ──────────────────────────

  function getAll() {
    return (SupabaseSync.getAll(TABLE) || []).filter(r => r.is_active !== false);
  }

  function getAllIncludingInactive() {
    return SupabaseSync.getAll(TABLE) || [];
  }

  function getByBatch(batchId) {
    if (!batchId) return [];
    return getAll().filter(r => String(r.batch_id || '').trim() === String(batchId).trim());
  }

  // ── Conflict check ─────────────────────────────────────────
  // Returns list of conflicting slots for a proposed entry.
  // Excludes the entry being edited (by id).
  function checkConflict({ teacher_id, day, start_time, end_time, excludeId }) {
    if (!teacher_id || !day || !start_time || !end_time) return [];
    const all = getAll();
    const toMin = t => {
      const [h, m] = String(t || '').split(':').map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    const sNew = toMin(start_time), eNew = toMin(end_time);

    return all.filter(r => {
      if (excludeId && r.id === excludeId) return false;
      if (r.teacher_id !== teacher_id) return false;
      if (r.day !== day) return false;
      const sR = toMin(r.start_time), eR = toMin(r.end_time);
      // Overlap: new starts before existing ends AND new ends after existing starts
      return sNew < eR && eNew > sR;
    });
  }

  // ── CRUD ───────────────────────────────────────────────────

  function save(entry) {
    const record = _buildRecord(entry);
    const isEdit = Boolean(entry.id);
    if (isEdit) {
      record.id = entry.id;
      SupabaseSync.update(TABLE, record.id, record);
    } else {
      record.id = Utils.uuid();
      SupabaseSync.insert(TABLE, record);
    }
    _logActivity(isEdit ? 'update' : 'add', record);
    return record;
  }

  function remove(id) {
    const existing = (SupabaseSync.getAll(TABLE) || []).find(r => r.id === id);
    if (!existing) return;
    // Soft-delete: set is_active = false
    SupabaseSync.update(TABLE, id, { ...existing, is_active: false });
    _logActivity('delete', existing);
  }

  function _buildRecord(entry) {
    return {
      batch_id:   String(entry.batch_id  || '').trim(),
      day:        String(entry.day       || '').trim(),
      start_time: String(entry.start_time|| '').trim(),
      end_time:   String(entry.end_time  || '').trim(),
      subject:    String(entry.subject   || '').trim(),
      teacher_id: String(entry.teacher_id|| '').trim(),
      room:       String(entry.room      || '').trim(),
      is_active:  true,
      created_at: entry.created_at || new Date().toISOString(),
    };
  }

  function _logActivity(action, r) {
    try {
      if (typeof Utils !== 'undefined' && Utils.logActivity) {
        const label = action === 'add'    ? 'রুটিন যোগ'
                    : action === 'update' ? 'রুটিন আপডেট'
                    :                      'রুটিন মুছে ফেলা';
        Utils.logActivity(`${label}: ${r.batch_id} — ${r.day} ${r.start_time}–${r.end_time} (${r.subject || '—'})`);
      }
    } catch { /* non-critical */ }
  }

  // ── Utility helpers ────────────────────────────────────────

  function getBatchList() {
    // Pull distinct batches from students table (read-only)
    const students = (SupabaseSync.getAll('students') || []);
    return [...new Set(students.map(s => String(s.batch || '').trim()).filter(Boolean))].sort();
  }

  function getTeacherList() {
    // Pull staff list (read-only)
    const staff = (SupabaseSync.getAll('staff') || []);
    return staff
      .filter(s => s.status !== 'inactive')
      .map(s => ({ id: s.staffId || s.staff_id || s.id, name: s.name || '' }))
      .filter(s => s.name);
  }

  function getTeacherName(teacherId) {
    if (!teacherId) return '—';
    const all = getTeacherList();
    const found = all.find(t => t.id === teacherId);
    return found ? found.name : teacherId;
  }

  function formatTime(t) {
    if (!t) return '—';
    const [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return t;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
  }

  // ── Standalone Supabase client (Student Portal) ────────────

  async function fetchForStudent(batchId) {
    const creds = window.WFA_STANDALONE_SUPABASE;
    if (!creds || !window.supabase) return [];
    try {
      const sb = window.supabase.createClient(creds.url, creds.key);
      const { data, error } = await sb
        .from(TABLE)
        .select('*')
        .eq('batch_id', batchId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('[RoutineEngine] fetchForStudent error:', e);
      return [];
    }
  }

  return {
    DAYS,
    DAY_LABELS,
    TABLE,
    getAll,
    getAllIncludingInactive,
    getByBatch,
    checkConflict,
    save,
    remove,
    getBatchList,
    getTeacherList,
    getTeacherName,
    formatTime,
    fetchForStudent,
  };
})();

window.RoutineEngine = RoutineEngine;
