// ============================================================
// AcadeFlow — Institution Mode Engine
// Coaching / School / College terminology & feature gating
// Default: coaching (existing clients unchanged)
// ============================================================

window.InstitutionMode = (() => {
  const STORAGE_KEY = 'wfa_institution_type';
  const VALID = ['coaching', 'school', 'college'];
  const DEFAULT = 'coaching';

  const LABELS = {
    coaching: {
      course_label: 'Course',
      batch_label: 'Batch',
      student_id_prefix: 'STU',
      session_label: 'Session',
      fee_label: 'Course Fee',
      nav_classes: '—',
      nav_marks: '—',
      nav_result: '—',
    },
    school: {
      course_label: 'Class',
      batch_label: 'Section',
      student_id_prefix: 'SCH',
      session_label: 'Academic Year',
      fee_label: 'Tuition Fee',
      nav_classes: 'Class & Section',
      nav_marks: 'Subject & Marks',
      nav_result: 'Result Sheet',
    },
    college: {
      course_label: 'Department',
      batch_label: 'Batch/Section',
      student_id_prefix: 'COL',
      session_label: 'Academic Year',
      fee_label: 'Semester Fee',
      nav_classes: 'Department',
      nav_marks: 'Subject & Marks',
      nav_result: 'Result Sheet',
    },
  };

  const TYPE_META = {
    coaching: { icon: '🏫', label: 'Coaching Centre', labelBn: 'কোচিং সেন্টার' },
    school:   { icon: '🏛️', label: 'School',          labelBn: 'স্কুল' },
    college:  { icon: '🎓', label: 'College',         labelBn: 'কলেজ' },
  };

  function _normalize(type) {
    const t = String(type || '').toLowerCase().trim();
    return VALID.includes(t) ? t : DEFAULT;
  }

  function get() {
    try {
      return _normalize(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT;
    }
  }

  function set(type) {
    const next = _normalize(type);
    const prev = get();
    if (prev === next) return next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      console.warn('[InstitutionMode] save failed', e);
    }
    window.dispatchEvent(new CustomEvent('wfa:institution-mode-changed', {
      detail: { type: next, previous: prev },
    }));
    return next;
  }

  function isSchool()   { return get() === 'school'; }
  function isCoaching() { return get() === 'coaching'; }
  function isCollege()  { return get() === 'college'; }

  function isSchoolLike() {
    const t = get();
    return t === 'school' || t === 'college';
  }

  function getLabel(key) {
    const map = LABELS[get()] || LABELS[DEFAULT];
    if (map[key] != null) return map[key];
    const fallback = LABELS[DEFAULT][key];
    return fallback != null ? fallback : key;
  }

  function getMeta(type) {
    return TYPE_META[_normalize(type)] || TYPE_META[DEFAULT];
  }

  function applySchoolNav() {
    const show = isSchoolLike();
    document.querySelectorAll('.school-only').forEach((el) => {
      el.style.display = show ? '' : 'none';
      el.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
  }

  window.addEventListener('wfa:institution-mode-changed', applySchoolNav);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySchoolNav);
  } else {
    applySchoolNav();
  }

  return {
    get,
    set,
    isSchool,
    isCoaching,
    isCollege,
    isSchoolLike,
    getLabel,
    getMeta,
    applySchoolNav,
    LABELS,
    TYPE_META,
    VALID,
    DEFAULT,
    STORAGE_KEY,
  };
})();
