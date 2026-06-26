// ============================================================
// AcadeFlow — School Mode Data Engine
// Class/Section, Subjects, Marks — IDB + Supabase sync
// ============================================================

const SchoolEngine = (() => {
  'use strict';

  const TABLES = {
    classes:  'school_classes',
    subjects: 'school_subjects',
    marks:    'school_marks',
  };

  const EXAM_TYPES = ['Half-Yearly', 'Annual', 'Test'];
  const DEFAULT_CLASSES = ['৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম', 'একাদশ', 'দ্বাদশ'];
  const DEFAULT_SUBJECTS = ['বাংলা', 'ইংরেজি', 'গণিত', 'বিজ্ঞান', 'সামাজিক বিজ্ঞান', 'ধর্ম'];

  function _sync() {
    return typeof SupabaseSync !== 'undefined' ? SupabaseSync : null;
  }

  function _all(table) {
    const s = _sync();
    return s ? (s.getAll(table) || []) : [];
  }

  function calcGrade(marks, fullMarks = 100) {
    const pct = fullMarks > 0 ? (Number(marks) / Number(fullMarks)) * 100 : 0;
    if (pct >= 80) return { grade: 'A+', gpa: 5.0, pass: true };
    if (pct >= 70) return { grade: 'A', gpa: 4.0, pass: true };
    if (pct >= 60) return { grade: 'A-', gpa: 3.5, pass: true };
    if (pct >= 50) return { grade: 'B', gpa: 3.0, pass: true };
    if (pct >= 40) return { grade: 'C', gpa: 2.0, pass: true };
    if (pct >= 33) return { grade: 'D', gpa: 1.0, pass: true };
    return { grade: 'F', gpa: 0.0, pass: false };
  }

  function calcGPA(subjectResults) {
    if (!subjectResults || !subjectResults.length) return 0;
    const sum = subjectResults.reduce((a, r) => a + (Number(r.gpa) || 0), 0);
    return Math.round((sum / subjectResults.length) * 100) / 100;
  }

  /** Shared academic year — marks, results, and student session stay in sync. */
  function getDefaultAcademicYear() {
    try {
      const cfg = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
        ? (SupabaseSync.getAll(DB.settings)[0] || {})
        : {};
      const explicit = String(cfg.school_academic_year || cfg.academic_year || '').trim();
      if (/^20\d{2}$/.test(explicit)) return explicit;

      const rb = String(cfg.running_batch || '').trim();
      const rbMatch = rb.match(/(20\d{2})/);
      if (rbMatch) return rbMatch[1];
    } catch (_) { /* ignore */ }

    try {
      const s = _sync();
      if (s && typeof DB !== 'undefined') {
        const sessions = s.getAll(DB.students)
          .map(st => String(st.session || '').trim())
          .filter(v => /^20\d{2}$/.test(v));
        if (sessions.length) {
          const counts = {};
          sessions.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        }
      }
    } catch (_) { /* ignore */ }

    const now = new Date();
    return String(now.getFullYear());
  }

  const TEST_DATA = {
    studentIds: ['SCH-TEST-01'],
    studentNames: ['School Test Student'],
    classTeacher: 'Test Teacher',
  };

  function purgeTestData() {
    const s = _sync();
    if (!s || typeof DB === 'undefined') {
      return { ok: false, error: 'SupabaseSync unavailable' };
    }

    const summary = { students: 0, marks: 0, classes: 0, subjects: 0 };

    s.getAll(DB.students)
      .filter(st =>
        TEST_DATA.studentIds.includes(String(st.student_id || '')) ||
        TEST_DATA.studentNames.includes(String(st.name || ''))
      )
      .forEach(st => {
        s.remove(DB.students, st.id);
        summary.students++;
      });

    _all(TABLES.marks)
      .filter(m =>
        TEST_DATA.studentIds.includes(String(m.student_no || '')) ||
        TEST_DATA.studentNames.includes(String(m.student_name || ''))
      )
      .forEach(m => {
        s.remove(TABLES.marks, m.id);
        summary.marks++;
      });

    const testClasses = _all(TABLES.classes)
      .filter(c => String(c.class_teacher || '') === TEST_DATA.classTeacher);

    testClasses.forEach(c => {
      s.remove(TABLES.classes, c.id);
      summary.classes++;
    });

    const removedClassNames = [...new Set(testClasses.map(c => c.class_name))];
    removedClassNames.forEach((className) => {
      const stillHasClass = getClasses().some(c => c.class_name === className);
      if (!stillHasClass) {
        _all(TABLES.subjects)
          .filter(sub => sub.class_name === className)
          .forEach(sub => {
            s.remove(TABLES.subjects, sub.id);
            summary.subjects++;
          });
      }
    });

    return { ok: true, ...summary };
  }

  // ── Classes ───────────────────────────────────────────────

  function getClasses(activeOnly = true) {
    const rows = _all(TABLES.classes);
    return activeOnly ? rows.filter(r => r.is_active !== false) : rows;
  }

  function saveClass(entry) {
    const s = _sync();
    if (!s) return null;
    const sections = Array.isArray(entry.sections)
      ? entry.sections
      : String(entry.sections || '').split(',').map(x => x.trim()).filter(Boolean);
    const record = {
      class_name:    String(entry.class_name || '').trim(),
      sections:      sections,
      shift:         String(entry.shift || 'Day').trim(),
      class_teacher: String(entry.class_teacher || '').trim(),
      is_active:     entry.is_active !== false,
      created_at:    entry.created_at || new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    };
    if (entry.id) {
      record.id = entry.id;
      s.update(TABLES.classes, record.id, record);
    } else {
      record.id = Utils.generateId();
      s.insert(TABLES.classes, record);
    }
    return record;
  }

  function removeClass(id) {
    const s = _sync();
    const existing = s.getById(TABLES.classes, id);
    if (!existing || !s) return;
    s.update(TABLES.classes, id, { ...existing, is_active: false, updated_at: new Date().toISOString() });
  }

  // ── Subjects ────────────────────────────────────────────────

  function getSubjects(className, activeOnly = true) {
    const cn = String(className || '').trim();
    let rows = _all(TABLES.subjects).filter(r => String(r.class_name || '').trim() === cn);
    if (activeOnly) rows = rows.filter(r => r.is_active !== false);
    return rows.sort((a, b) => String(a.subject_name).localeCompare(String(b.subject_name), 'bn'));
  }

  function saveSubject(entry) {
    const s = _sync();
    if (!s) return null;
    const record = {
      class_name:   String(entry.class_name || '').trim(),
      subject_name: String(entry.subject_name || '').trim(),
      full_marks:   Number(entry.full_marks) || 100,
      pass_marks:   Number(entry.pass_marks) || 33,
      is_active:    entry.is_active !== false,
      created_at:   entry.created_at || new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };
    if (entry.id) {
      record.id = entry.id;
      s.update(TABLES.subjects, record.id, record);
    } else {
      record.id = Utils.generateId();
      s.insert(TABLES.subjects, record);
    }
    return record;
  }

  function removeSubject(id) {
    const s = _sync();
    const existing = s.getById(TABLES.subjects, id);
    if (!existing || !s) return;
    s.update(TABLES.subjects, id, { ...existing, is_active: false, updated_at: new Date().toISOString() });
  }

  function seedSubjectsForClass(className) {
    DEFAULT_SUBJECTS.forEach((name) => {
      const exists = getSubjects(className).some(s => s.subject_name === name);
      if (!exists) saveSubject({ class_name: className, subject_name: name });
    });
  }

  // ── Marks ───────────────────────────────────────────────────

  function getMarks(filter = {}) {
    let rows = _all(TABLES.marks);
    if (filter.class_name) rows = rows.filter(r => String(r.class_name) === String(filter.class_name));
    if (filter.section) rows = rows.filter(r => String(r.section) === String(filter.section));
    if (filter.exam_type) rows = rows.filter(r => String(r.exam_type) === String(filter.exam_type));
    if (filter.academic_year) rows = rows.filter(r => String(r.academic_year) === String(filter.academic_year));
    if (filter.student_id) rows = rows.filter(r => r.student_id === filter.student_id || r.student_no === filter.student_id);
    return rows;
  }

  function saveMark(entry) {
    const s = _sync();
    if (!s) return null;
    const full = Number(entry.full_marks) || 100;
    const obtained = Math.max(0, Math.min(full, Number(entry.marks_obtained) || 0));
    const { grade, gpa, pass } = calcGrade(obtained, full);
    const record = {
      student_id:     String(entry.student_id || '').trim(),
      student_no:     String(entry.student_no || entry.student_id || '').trim(),
      student_name:   String(entry.student_name || '').trim(),
      class_name:     String(entry.class_name || '').trim(),
      section:        String(entry.section || '').trim(),
      roll_no:        String(entry.roll_no || '').trim(),
      academic_year:  String(entry.academic_year || getDefaultAcademicYear()).trim(),
      exam_type:      String(entry.exam_type || 'Annual').trim(),
      subject_id:     String(entry.subject_id || '').trim(),
      subject_name:   String(entry.subject_name || '').trim(),
      marks_obtained: obtained,
      full_marks:     full,
      grade,
      gpa,
      pass,
      updated_at:     new Date().toISOString(),
    };

    const existing = _all(TABLES.marks).find(m =>
      m.student_id === record.student_id &&
      m.subject_id === record.subject_id &&
      m.exam_type === record.exam_type &&
      m.academic_year === record.academic_year
    );

    if (existing) {
      record.id = existing.id;
      record.created_at = existing.created_at;
      s.update(TABLES.marks, record.id, record);
    } else {
      record.id = Utils.generateId();
      record.created_at = new Date().toISOString();
      s.insert(TABLES.marks, record);
    }
    return record;
  }

  function getStudentsInClass(className, section, academicYear) {
    const students = _sync() ? _sync().getAll(DB.students) : [];
    return students.filter((st) => {
      if (String(st.course || '').trim() !== String(className).trim()) return false;
      if (section && String(st.batch || '').trim().toUpperCase() !== String(section).trim().toUpperCase()) return false;
      if (academicYear && String(st.session || '').trim() && String(st.session).trim() !== String(academicYear).trim()) return false;
      return (st.status || 'Active') === 'Active';
    }).sort((a, b) => {
      const ra = parseInt(a.roll_no, 10) || 9999;
      const rb = parseInt(b.roll_no, 10) || 9999;
      return ra - rb || String(a.name).localeCompare(String(b.name), 'bn');
    });
  }

  function buildStudentResult(studentId, examType, academicYear) {
    const marks = getMarks({ student_id: studentId, exam_type: examType, academic_year: academicYear });
    if (!marks.length) return null;
    const subjects = marks.map(m => ({
      subject_name: m.subject_name,
      marks_obtained: m.marks_obtained,
      full_marks: m.full_marks,
      grade: m.grade,
      gpa: m.gpa,
      pass: m.pass,
    }));
    const totalObtained = subjects.reduce((a, s) => a + s.marks_obtained, 0);
    const totalFull = subjects.reduce((a, s) => a + s.full_marks, 0);
    const gpa = calcGPA(subjects);
    const allPass = subjects.every(s => s.pass);
    return {
      student_id: studentId,
      student_name: marks[0].student_name,
      class_name: marks[0].class_name,
      section: marks[0].section,
      roll_no: marks[0].roll_no,
      exam_type: examType,
      academic_year: academicYear,
      subjects,
      totalObtained,
      totalFull,
      percentage: totalFull ? Math.round((totalObtained / totalFull) * 10000) / 100 : 0,
      gpa,
      status: allPass ? 'Pass' : 'Fail',
    };
  }

  function buildClassResults(className, section, examType, academicYear) {
    const students = getStudentsInClass(className, section, academicYear);
    const results = students.map(st => buildStudentResult(st.id, examType, academicYear)).filter(Boolean);
    results.sort((a, b) => b.gpa - a.gpa || b.percentage - a.percentage);
    results.forEach((r, i) => { r.position = i + 1; });
    return results;
  }

  return {
    TABLES,
    EXAM_TYPES,
    DEFAULT_CLASSES,
    DEFAULT_SUBJECTS,
    calcGrade,
    calcGPA,
    getClasses,
    saveClass,
    removeClass,
    getSubjects,
    saveSubject,
    removeSubject,
    seedSubjectsForClass,
    getMarks,
    saveMark,
    getStudentsInClass,
    buildStudentResult,
    buildClassResults,
    getDefaultAcademicYear,
    purgeTestData,
    TEST_DATA,
  };
})();

window.SchoolEngine = SchoolEngine;
