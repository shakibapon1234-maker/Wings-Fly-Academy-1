/**
 * AcadeFlow School Mode — engine unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal globals for school-engine.js
global.Utils = {
  generateId: (() => {
    let n = 1;
    return () => `id-${n++}`;
  })(),
};

const store = {
  school_classes: [],
  school_subjects: [],
  school_marks: [],
  students: [],
};

global.DB = {
  students: 'students',
};

global.SupabaseSync = {
  getAll(table) {
    return store[table] ? [...store[table]] : [];
  },
  getById(table, id) {
    return (store[table] || []).find(r => r.id === id) || null;
  },
  insert(table, record) {
    if (!store[table]) store[table] = [];
    store[table].push(record);
  },
  update(table, id, record) {
    const i = (store[table] || []).findIndex(r => r.id === id);
    if (i >= 0) store[table][i] = record;
  },
  remove(table, id) {
    if (!store[table]) return;
    store[table] = store[table].filter(r => r.id !== id);
  },
};

await import('../js/core/school-engine.js');

describe('SchoolEngine.calcGrade — Bangladesh SSC scale', () => {
  it('80+ → A+ (5.00)', () => {
    expect(SchoolEngine.calcGrade(85, 100).grade).toBe('A+');
    expect(SchoolEngine.calcGrade(85, 100).gpa).toBe(5.0);
  });
  it('33–39 → D (1.00)', () => {
    expect(SchoolEngine.calcGrade(35, 100).grade).toBe('D');
  });
  it('below 33 → F (0.00)', () => {
    expect(SchoolEngine.calcGrade(20, 100).grade).toBe('F');
    expect(SchoolEngine.calcGrade(20, 100).pass).toBe(false);
  });
  it('custom pass_marks threshold overrides default 33%', () => {
    expect(SchoolEngine.calcGrade(45, 100, 50).grade).toBe('F');
    expect(SchoolEngine.calcGrade(45, 100, 50).pass).toBe(false);
    expect(SchoolEngine.calcGrade(55, 100, 50).grade).toBe('B');
    expect(SchoolEngine.calcGrade(55, 100, 50).pass).toBe(true);
  });
  it('any failed subject forces overall GPA to 0', () => {
    const rows = [
      { grade: 'A+', gpa: 5, pass: true, entered: true },
      { grade: 'F', gpa: 0, pass: false, entered: true },
    ];
    expect(SchoolEngine.calcGPA(rows)).toBe(0);
  });
});

describe('SchoolEngine.getDefaultAcademicYear', () => {
  it('returns current calendar year by default', () => {
    expect(SchoolEngine.getDefaultAcademicYear()).toBe(String(new Date().getFullYear()));
  });
});

describe('SchoolEngine.purgeTestData', () => {
  beforeEach(() => {
    store.school_classes = [{ id: 'c1', class_name: '৯ম', sections: ['A'], class_teacher: 'Test Teacher', is_active: true }];
    store.school_subjects = [{ id: 's1', class_name: '৯ম', subject_name: 'গণিত', is_active: true }];
    store.school_marks = [{ id: 'm1', student_no: 'SCH-TEST-01', student_name: 'School Test Student' }];
    store.students = [{ id: 'stu-1', student_id: 'SCH-TEST-01', name: 'School Test Student' }];
  });

  it('removes test student, marks, and test class', () => {
    const r = SchoolEngine.purgeTestData();
    expect(r.ok).toBe(true);
    expect(r.students).toBe(1);
    expect(r.marks).toBe(1);
    expect(r.classes).toBe(1);
    expect(store.students.length).toBe(0);
    expect(store.school_marks.length).toBe(0);
    expect(store.school_classes.length).toBe(0);
  });
});

describe('SchoolEngine marks workflow', () => {
  beforeEach(() => {
    store.school_classes = [];
    store.school_subjects = [];
    store.school_marks = [];
    store.students = [{
      id: 'stu-1',
      student_id: 'SCH001',
      name: 'Test Student',
      course: '৯ম',
      batch: 'A',
      session: '2025',
      roll_no: '12',
      status: 'Active',
    }];
  });

  it('saves class, subjects, marks and builds result', () => {
    SchoolEngine.saveClass({ class_name: '৯ম', sections: ['A', 'B'], shift: 'Day' });
    SchoolEngine.seedSubjectsForClass('৯ম');
    const subs = SchoolEngine.getSubjects('৯ম');
    expect(subs.length).toBeGreaterThan(0);

    subs.forEach((sub) => {
      SchoolEngine.saveMark({
        student_id: 'stu-1',
        student_no: 'SCH001',
        student_name: 'Test Student',
        class_name: '৯ম',
        section: 'A',
        roll_no: '12',
        academic_year: '2025',
        exam_type: 'Annual',
        subject_id: sub.id,
        subject_name: sub.subject_name,
        marks_obtained: 85,
        full_marks: 100,
      });
    });

    const result = SchoolEngine.buildStudentResult('stu-1', 'Annual', '2025');
    expect(result).not.toBeNull();
    expect(result.subjects.length).toBe(subs.length);
    expect(result.gpa).toBe(5.0);
    expect(result.status).toBe('Pass');
  });

  it('partial marks → Incomplete status and GPA 0 when fail subjects included', () => {
    SchoolEngine.saveClass({ class_name: '৯ম', sections: ['A'], shift: 'Day' });
    SchoolEngine.seedSubjectsForClass('৯ম');
    const subs = SchoolEngine.getSubjects('৯ম');
    SchoolEngine.saveMark({
      student_id: 'stu-1',
      student_no: 'SCH001',
      student_name: 'Test Student',
      class_name: '৯ম',
      section: 'A',
      roll_no: '12',
      academic_year: '2025',
      exam_type: 'Annual',
      subject_id: subs[0].id,
      subject_name: subs[0].subject_name,
      marks_obtained: 85,
      full_marks: 100,
    });

    const result = SchoolEngine.buildStudentResult('stu-1', 'Annual', '2025');
    expect(result.status).toBe('Incomplete');
    expect(result.gpa).toBe(0);
  });

  it('class merit list orders by GPA', () => {
    store.students.push({
      id: 'stu-2', student_id: 'SCH002', name: 'Second', course: '৯ম', batch: 'A',
      session: '2025', roll_no: '13', status: 'Active',
    });
    SchoolEngine.saveClass({ class_name: '৯ম', sections: ['A'], shift: 'Day' });
    SchoolEngine.saveSubject({ class_name: '৯ম', subject_name: 'গণিত', full_marks: 100 });

    const sub = SchoolEngine.getSubjects('৯ম')[0];
    ['stu-1', 'stu-2'].forEach((sid, idx) => {
      SchoolEngine.saveMark({
        student_id: sid,
        student_no: sid === 'stu-1' ? 'SCH001' : 'SCH002',
        student_name: idx === 0 ? 'Test Student' : 'Second',
        class_name: '৯ম', section: 'A', academic_year: '2025', exam_type: 'Annual',
        subject_id: sub.id, subject_name: sub.subject_name,
        marks_obtained: idx === 0 ? 90 : 60,
        full_marks: 100,
      });
    });

    const list = SchoolEngine.buildClassResults('৯ম', 'A', 'Annual', '2025');
    expect(list.length).toBe(2);
    expect(list[0].position).toBe(1);
    expect(list[0].gpa).toBeGreaterThan(list[1].gpa);
  });
});
