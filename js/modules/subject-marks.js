/* ============================================================
   AcadeFlow — Subject & Marks Entry (School Mode)
   ============================================================ */

const SubjectMarks = (() => {
  'use strict';

  let _class = '';
  let _section = '';
  let _exam = 'Annual';
  let _year = '';

  function _yearDefault() {
    return (window.SchoolEngine && SchoolEngine.getDefaultAcademicYear)
      ? SchoolEngine.getDefaultAcademicYear()
      : String(new Date().getFullYear());
  }

  function _fmtNum(val) {
    return (val === null || val === undefined || val === '') ? '—' : val;
  }

  function _fmtGpa(gpa) {
    return Number.isFinite(gpa) ? gpa.toFixed(2) : '—';
  }

  function render() {
    if (!_year) _year = _yearDefault();
    const el = document.getElementById('subject-marks-content');
    if (!el) return;

    if (!window.InstitutionMode || !InstitutionMode.isSchoolLike()) {
      el.innerHTML = `<div class="empty-state" style="text-align:center;padding:60px;color:var(--text-muted)">
        <p>School/College mode-এ Marks Entry চালু হবে।</p>
      </div>`;
      return;
    }

    const classes = SchoolEngine.getClasses();
    const classLabel = InstitutionMode.getLabel('course_label');
    const sectionLabel = InstitutionMode.getLabel('batch_label');
    const sections = _class
      ? (classes.find(c => c.class_name === _class)?.sections || [])
      : [];

    el.innerHTML = `
      <div class="filter-bar" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end">
        <div class="form-group" style="margin:0">
          <label>${Utils.esc(classLabel)}</label>
          <select id="sm-class" class="form-control" onchange="SubjectMarks.onFilterChange()">
            <option value="">— Select —</option>
            ${classes.map(c => `<option value="${Utils.escAttr(c.class_name)}" ${_class === c.class_name ? 'selected' : ''}>${Utils.esc(c.class_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>${Utils.esc(sectionLabel)}</label>
          <select id="sm-section" class="form-control" onchange="SubjectMarks.onFilterChange()">
            <option value="">— All —</option>
            ${(Array.isArray(sections) ? sections : []).map(s => `<option value="${Utils.escAttr(s)}" ${_section === s ? 'selected' : ''}>${Utils.esc(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Exam Type</label>
          <select id="sm-exam" class="form-control" onchange="SubjectMarks.onFilterChange()">
            ${SchoolEngine.EXAM_TYPES.map(e => `<option ${_exam === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>${Utils.esc(InstitutionMode.getLabel('session_label'))}</label>
          <input id="sm-year" class="form-control" value="${Utils.escAttr(_year)}" onchange="SubjectMarks.onFilterChange()" />
        </div>
        <button class="btn btn-secondary" onclick="SubjectMarks.openSubjectModal()"><i class="fa fa-book"></i> Subjects</button>
        <button class="btn btn-primary" onclick="SubjectMarks.saveAll()"><i class="fa fa-floppy-disk"></i> Save Marks</button>
      </div>
      <div id="sm-grid-wrap">${_class ? _renderGrid() : '<p style="color:var(--text-muted)">Class নির্বাচন করুন।</p>'}</div>
    `;
  }

  function onFilterChange() {
    _class = Utils.formVal('sm-class');
    _section = Utils.formVal('sm-section');
    _exam = Utils.formVal('sm-exam') || 'Annual';
    const yearVal = Utils.formVal('sm-year');
    _year = yearVal !== '' ? yearVal : _yearDefault();
    render();
  }

  function _renderGrid() {
    const subjects = SchoolEngine.getSubjects(_class);
    const students = SchoolEngine.getStudentsInClass(_class, _section, _year);
    if (!subjects.length) {
      return `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted)">
        <p>এই class-এ কোনো subject নেই। "Subjects" বাটনে ক্লিক করে যোগ করুন।</p>
      </div>`;
    }
    if (!students.length) {
      return `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted)">
        <p>এই class/section-এ কোনো student পাওয়া যায়নি। Students ট্যাবে student যোগ করুন।</p>
      </div>`;
    }

    const existing = SchoolEngine.getMarks({
      class_name: _class,
      exam_type: _exam,
      academic_year: _year,
    });

    let html = `<div style="overflow-x:auto"><table class="data-table"><thead><tr>
      <th>Roll</th><th>Name</th>
      ${subjects.map(s => `<th>${Utils.esc(s.subject_name)}<br><small>/${s.full_marks}</small></th>`).join('')}
      <th>Total</th><th>%</th><th>GPA</th><th>Grade</th>
    </tr></thead><tbody>`;

    students.forEach(st => {
      const studentMarks = existing.filter(m => m.student_id === st.id);
      const subjectRows = SchoolEngine.buildSubjectResults(_class, st.id, _exam, _year, studentMarks);
      const totalO = subjectRows.reduce((a, r) => a + r.marks_obtained, 0);
      const totalF = subjectRows.reduce((a, r) => a + r.full_marks, 0);
      const pct = totalF ? Math.round((totalO / totalF) * 100) : 0;
      const gpa = SchoolEngine.calcGPA(subjectRows);
      const grade = SchoolEngine.overallLetterGrade(subjectRows);
      html += `<tr><td>${Utils.esc(st.roll_no || '—')}</td><td>${Utils.esc(st.name)}</td>`;
      subjects.forEach(sub => {
        const found = studentMarks.find(m => m.subject_id === sub.id);
        const val = found ? found.marks_obtained : '';
        html += `<td><input type="number" class="form-control sm-mark" style="width:70px;padding:4px 6px"
          data-student-id="${Utils.escAttr(st.id)}" data-student-no="${Utils.escAttr(st.student_id)}"
          data-student-name="${Utils.escAttr(st.name)}" data-roll="${Utils.escAttr(st.roll_no || '')}"
          data-section="${Utils.escAttr(st.batch || '')}"
          data-subject-id="${Utils.escAttr(sub.id)}" data-subject-name="${Utils.escAttr(sub.subject_name)}"
          data-full="${sub.full_marks}" min="0" max="${sub.full_marks}" value="${val}" /></td>`;
      });
      html += `<td>${_fmtNum(totalO)}</td><td>${_fmtNum(pct)}%</td><td>${_fmtGpa(gpa)}</td><td>${grade}</td></tr>`;
    });

    html += '</tbody></table></div>';
    return html;
  }

  function saveAll() {
    if (!_class) { Utils.toast('Class select করুন', 'warning'); return; }
    const inputs = document.querySelectorAll('.sm-mark');
    let saved = 0;
    let cleared = 0;
    inputs.forEach((inp) => {
      const section = inp.dataset.section || '';
      const base = {
        student_id: inp.dataset.studentId,
        student_no: inp.dataset.studentNo,
        student_name: inp.dataset.studentName,
        roll_no: inp.dataset.roll,
        class_name: _class,
        section,
        academic_year: _year,
        exam_type: _exam,
        subject_id: inp.dataset.subjectId,
        subject_name: inp.dataset.subjectName,
        full_marks: inp.dataset.full,
      };
      if (inp.value === '') {
        if (SchoolEngine.deleteMark(base)) cleared++;
        return;
      }
      SchoolEngine.saveMark({ ...base, marks_obtained: inp.value });
      saved++;
    });
    Utils.toast(`✅ ${saved} saved${cleared ? `, ${cleared} cleared` : ''}`, 'success');
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity && saved > 0) {
      SupabaseSync.logActivity('edit', 'subject_marks',
        `মার্ক সেভ: ${_class} — ${_exam} (${_year}) — ${saved}টি এন্ট্রি${cleared ? `, ${cleared}টি ক্লিয়ার` : ''}`);
    }
    render();
  }

  function openSubjectModal() {
    if (!_class) { Utils.toast('আগে class select করুন', 'warning'); return; }
    const subjects = SchoolEngine.getSubjects(_class);
    Utils.openModal(`<i class="fa fa-book"></i> Subjects — ${Utils.esc(_class)}`, `
      <div style="margin-bottom:12px">
        ${subjects.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
          <span>${Utils.esc(s.subject_name)} <small style="color:#888">/${s.full_marks} (pass ${s.pass_marks})</small></span>
          <button class="btn btn-sm btn-danger" onclick="SubjectMarks.removeSubject('${Utils.escAttr(s.id)}')"><i class="fa fa-trash"></i></button>
        </div>`).join('') || '<p style="color:#888">No subjects yet.</p>'}
      </div>
      <div class="form-row">
        <div class="form-group"><label>Subject Name</label><input id="sm-new-subject" class="form-control" placeholder="বাংলা" /></div>
        <div class="form-group"><label>Full Marks</label><input id="sm-new-full" type="number" class="form-control" value="100" /></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="SubjectMarks.addSubject()"><i class="fa fa-plus"></i> Add Subject</button>
      </div>
    `);
  }

  function addSubject() {
    const name = Utils.formVal('sm-new-subject');
    if (!name) return;
    SchoolEngine.saveSubject({ class_name: _class, subject_name: name, full_marks: Utils.formVal('sm-new-full') || 100 });
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity) {
      SupabaseSync.logActivity('add', 'subject_marks', `নতুন বিষয় যোগ: ${name} — ${_class}`);
    }
    Utils.closeModal();
    openSubjectModal();
    render();
  }

  function removeSubject(id) {
    if (!confirm('Remove subject?')) return;
    const subj = SchoolEngine.getSubjects(_class).find(s => s.id === id);
    SchoolEngine.removeSubject(id);
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.logActivity) {
      SupabaseSync.logActivity('delete', 'subject_marks', `বিষয় মুছে ফেলা: ${subj ? subj.subject_name : id} — ${_class}`);
    }
    openSubjectModal();
    render();
  }

  return { render, onFilterChange, saveAll, openSubjectModal, addSubject, removeSubject };
})();

window.SubjectMarks = SubjectMarks;
