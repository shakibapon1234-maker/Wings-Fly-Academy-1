// ============================================================
// visitors.js — Visitor Tracking Module
// Wings Fly Aviation Academy
// ============================================================

const VisitorsModule = (() => {
  let visitors = [];

  // ── Load ──────────────────────────────────────────────────
  function load() {
    visitors = Utils.storage('wfa_visitors') || [];
  }

  function save() {
    Utils.storage('wfa_visitors', visitors);
    SyncEngine.markDirty('visitors');
  }

  // ── CRUD ──────────────────────────────────────────────────
  function add(data) {
    const record = {
      id: Utils.uid('VIS'),
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || '',
      interestedCourse: data.interestedCourse?.trim() || '',
      purposeOfVisit: data.purposeOfVisit?.trim() || '',
      remarks: data.remarks?.trim() || '',
      referredBy: data.referredBy?.trim() || '',
      status: data.status || 'Interested',   // Interested | Enrolled | Not Interested | Follow-up
      followUpDate: data.followUpDate || '',
      visitDate: data.visitDate || Utils.today(),
      createdAt: new Date().toISOString(),
    };
    visitors.unshift(record);
    save();
    return record;
  }

  function update(id, data) {
    const idx = visitors.findIndex(v => v.id === id);
    if (idx === -1) return false;
    visitors[idx] = { ...visitors[idx], ...data, updatedAt: new Date().toISOString() };
    save();
    return visitors[idx];
  }

  function remove(id) {
    visitors = visitors.filter(v => v.id !== id);
    save();
  }

  function getAll() { return visitors; }

  function getById(id) { return visitors.find(v => v.id === id); }

  // ── Filters ───────────────────────────────────────────────
  function filter({ search = '', status = '', course = '', dateFrom = '', dateTo = '' } = {}) {
    return visitors.filter(v => {
      if (search) {
        const q = search.toLowerCase();
        if (!v.name.toLowerCase().includes(q) && !v.phone.includes(q)) return false;
      }
      if (status && v.status !== status) return false;
      if (course && !v.interestedCourse.toLowerCase().includes(course.toLowerCase())) return false;
      if (dateFrom && v.visitDate < dateFrom) return false;
      if (dateTo && v.visitDate > dateTo) return false;
      return true;
    });
  }

  // ── Stats ─────────────────────────────────────────────────
  function stats() {
    const total = visitors.length;
    const byStatus = { Interested: 0, Enrolled: 0, 'Not Interested': 0, 'Follow-up': 0 };
    visitors.forEach(v => { if (byStatus[v.status] !== undefined) byStatus[v.status]++; });
    const today = visitors.filter(v => v.visitDate === Utils.today()).length;
    return { total, byStatus, today };
  }

  // ── Export ────────────────────────────────────────────────
  function exportExcel(rows) {
    const data = (rows || visitors).map(v => ({
      'Visitor ID': v.id,
      'Name': v.name,
      'Phone': v.phone,
      'Email': v.email,
      'Interested Course': v.interestedCourse,
      'Purpose': v.purposeOfVisit,
      'Status': v.status,
      'Visit Date': v.visitDate,
      'Follow-up Date': v.followUpDate,
      'Remarks': v.remarks,
    }));
    Utils.exportExcel(data, 'Visitors');
  }

  return { load, add, update, remove, getAll, getById, filter, stats, exportExcel };
})();
