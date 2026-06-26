/* ============================================================
   AcadeFlow — Result Sheet / Marksheet (School Mode)
   ============================================================ */

const ResultSheet = (() => {
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

  function render() {
    if (!_year) _year = _yearDefault();
    const el = document.getElementById('result-sheet-content');
    if (!el) return;

    if (!window.InstitutionMode || !InstitutionMode.isSchoolLike()) {
      el.innerHTML = `<div class="empty-state" style="text-align:center;padding:60px;color:var(--text-muted)">
        <p>School/College mode-এ Result Sheet চালু হবে।</p>
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
          <select id="rs-class" class="form-control" onchange="ResultSheet.onFilterChange()">
            <option value="">— Select —</option>
            ${classes.map(c => `<option value="${Utils.escAttr(c.class_name)}" ${_class === c.class_name ? 'selected' : ''}>${Utils.esc(c.class_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>${Utils.esc(sectionLabel)}</label>
          <select id="rs-section" class="form-control" onchange="ResultSheet.onFilterChange()">
            <option value="">— All —</option>
            ${(Array.isArray(sections) ? sections : []).map(s => `<option value="${Utils.escAttr(s)}" ${_section === s ? 'selected' : ''}>${Utils.esc(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Exam</label>
          <select id="rs-exam" class="form-control" onchange="ResultSheet.onFilterChange()">
            ${SchoolEngine.EXAM_TYPES.map(e => `<option ${_exam === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Year</label>
          <input id="rs-year" class="form-control" value="${Utils.escAttr(_year)}" onchange="ResultSheet.onFilterChange()" />
        </div>
        <button class="btn btn-secondary" onclick="ResultSheet.printClassSheet()"><i class="fa fa-print"></i> Print Class</button>
        <button class="btn btn-primary" onclick="ResultSheet.exportPDF()"><i class="fa fa-file-pdf"></i> PDF</button>
      </div>
      <div id="rs-results-wrap">${_class ? _renderResults() : '<p style="color:var(--text-muted)">Class select করুন।</p>'}</div>
    `;
  }

  function onFilterChange() {
    _class = Utils.formVal('rs-class');
    _section = Utils.formVal('rs-section');
    _exam = Utils.formVal('rs-exam') || 'Annual';
    _year = Utils.formVal('rs-year') || _year;
    render();
  }

  function _renderResults() {
    const results = SchoolEngine.buildClassResults(_class, _section, _exam, _year);
    if (!results.length) {
      return `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted)">
        <p>এই filter-এ কোনো result নেই। Subject & Marks-এ marks entry করুন।</p>
      </div>`;
    }

    return `
      <div class="table-responsive">
        <table class="data-table" id="rs-class-table">
          <thead>
            <tr>
              <th>Pos</th><th>Roll</th><th>Name</th><th>Total</th><th>%</th><th>GPA</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => `<tr>
              <td><strong>${r.position}</strong></td>
              <td>${Utils.esc(r.roll_no || '—')}</td>
              <td>${Utils.esc(r.student_name)}</td>
              <td>${r.totalObtained}/${r.totalFull}</td>
              <td>${r.percentage}%</td>
              <td>${r.gpa}</td>
              <td><span class="badge ${r.status === 'Pass' ? 'present' : 'absent'}">${r.status}</span></td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="ResultSheet.printIndividual('${Utils.escAttr(r.student_id)}')">
                  <i class="fa fa-print"></i> Marksheet
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _marksheetHTML(result) {
    const cfg = (SupabaseSync.getAll(DB.settings)[0] || {});
    const academy = Utils.esc(cfg.academy_name || 'AcadeFlow School');
    const subRows = result.subjects.map(s =>
      `<tr><td>${Utils.esc(s.subject_name)}</td><td style="text-align:center">${s.marks_obtained}</td><td style="text-align:center">${s.full_marks}</td><td style="text-align:center">${s.grade}</td><td style="text-align:center">${s.gpa}</td></tr>`
    ).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Marksheet</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{text-align:center;margin:0 0 4px;font-size:1.4rem}
        .meta{text-align:center;margin-bottom:16px;font-size:0.9rem}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #ccc;padding:8px;font-size:0.88rem}
        th{background:#f0f0f0}
        .summary{margin-top:16px;display:flex;gap:24px;justify-content:center;font-weight:700}
      </style></head><body>
      <h1>${academy}</h1>
      <div class="meta">Marksheet — ${Utils.esc(result.exam_type)} ${Utils.esc(result.academic_year)}</div>
      <div><strong>Name:</strong> ${Utils.esc(result.student_name)} &nbsp;|&nbsp;
        <strong>Class:</strong> ${Utils.esc(result.class_name)} &nbsp;|&nbsp;
        <strong>Section:</strong> ${Utils.esc(result.section)} &nbsp;|&nbsp;
        <strong>Roll:</strong> ${Utils.esc(result.roll_no || '—')}</div>
      <table><thead><tr><th>Subject</th><th>Obtained</th><th>Full</th><th>Grade</th><th>GPA</th></tr></thead><tbody>${subRows}</tbody></table>
      <div class="summary">
        <span>Total: ${result.totalObtained}/${result.totalFull}</span>
        <span>Percentage: ${result.percentage}%</span>
        <span>GPA: ${result.gpa}</span>
        <span>Result: ${result.status}</span>
      </div>
    </body></html>`;
  }

  function printIndividual(studentId) {
    const result = SchoolEngine.buildStudentResult(studentId, _exam, _year);
    if (!result) { Utils.toast('No marks found', 'warning'); return; }
    const w = window.open('', '_blank');
    w.document.write(_marksheetHTML(result));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function printClassSheet() {
    if (!_class) return;
    const table = document.getElementById('rs-class-table');
    if (!table) { Utils.toast('No results to print', 'warning'); return; }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Class Result</title>
      <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#eee}</style></head>
      <body><h2>Class Result — ${_class} ${_section} (${_exam} ${_year})</h2>${table.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  function exportPDF() {
    const run = () => {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        Utils.toast('PDF library loading failed', 'danger');
        return;
      }
      const results = SchoolEngine.buildClassResults(_class, _section, _exam, _year);
      if (!results.length) { Utils.toast('No data for PDF', 'warning'); return; }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const cfg = (SupabaseSync.getAll(DB.settings)[0] || {});
      pdf.setFontSize(14);
      pdf.text(cfg.academy_name || 'AcadeFlow School', 105, 15, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Class Result: ${_class} ${_section || ''} — ${_exam} ${_year}`, 105, 22, { align: 'center' });
      let y = 32;
      pdf.setFontSize(9);
      results.forEach((r) => {
        if (y > 280) { pdf.addPage(); y = 20; }
        pdf.text(`${r.position}. Roll ${r.roll_no || '—'} | ${r.student_name} | ${r.totalObtained}/${r.totalFull} | GPA ${r.gpa} | ${r.status}`, 14, y);
        y += 6;
      });
      pdf.save(`result_${_class}_${_year}.pdf`);
    };
    if (window.LazyLibs) window.LazyLibs.load('jspdf').then(run).catch(run);
    else run();
  }

  return { render, onFilterChange, printIndividual, printClassSheet, exportPDF };
})();

window.ResultSheet = ResultSheet;
