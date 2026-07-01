// ============================================================
// AcadeFlow — Institution Mode Engine
// Coaching / School / College terminology & feature gating
// Default: coaching (existing clients unchanged)
// Persists to settings.institution_type (cloud) + localStorage cache
// ============================================================

if (window.InstitutionMode && typeof window.InstitutionMode.get === 'function') {
  // Already loaded via index.html — skip re-execution (lazy-modules dep load)
} else {

window.InstitutionMode = (() => {
  const STORAGE_KEY = 'wfa_institution_type';
  const VALID = ['coaching', 'school', 'college'];
  const DEFAULT = 'coaching';

  const LABELS = {
    coaching: {
      course_label: 'Course',
      batch_label: 'Batch',
      student_id_prefix: 'WFA',
      session_label: 'Session',
      fee_label: 'Course Fee',
      nav_classes: '—',
      nav_marks: '—',
      nav_result: '—',
    },
    school: {
      course_label: 'Class',
      batch_label: 'Section',
      student_id_prefix: 'WFA',
      session_label: 'Academic Year',
      fee_label: 'Tuition Fee',
      nav_classes: 'Class & Section',
      nav_marks: 'Subject & Marks',
      nav_result: 'Result Sheet',
    },
    college: {
      course_label: 'Department',
      batch_label: 'Batch/Section',
      student_id_prefix: 'WFA',
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

  let _memoryType = null;

  function _normalize(type) {
    const t = String(type || '').toLowerCase().trim();
    return VALID.includes(t) ? t : DEFAULT;
  }

  function _readSettingsRow() {
    try {
      if (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined') {
        const rows = SupabaseSync.getAll(DB.settings) || [];
        return rows.find(r => r.institution_type) || rows[0] || null;
      }
    } catch { /* ignore */ }
    return null;
  }

  function _fromSettings() {
    const row = _readSettingsRow();
    const raw = row?.institution_type;
    return raw ? _normalize(raw) : null;
  }

  function _fromDeploySecrets() {
    const secrets = window.WFA_SUPABASE_SECRETS;
    if (secrets?.institutionType) return _normalize(secrets.institutionType);
    return null;
  }

  function _cacheLocal(type) {
    try { localStorage.setItem(STORAGE_KEY, type); } catch { /* ignore */ }
  }

  function _persistToSettings(type) {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return false;
    try {
      const list = SupabaseSync.getAll(DB.settings) || [];
      const row = list[0] || { id: 'main' };
      const next = { ...row, institution_type: type };
      if (row.id && list.length) {
        SupabaseSync.update(DB.settings, row.id, next, { bypassLog: true });
      } else {
        next.id = next.id || (SupabaseSync.generateId ? SupabaseSync.generateId() : 'main');
        SupabaseSync.insert(DB.settings, next, { bypassLog: true });
      }
      return true;
    } catch (e) {
      console.warn('[InstitutionMode] settings persist failed', e);
      return false;
    }
  }

  function get() {
    if (_memoryType) return _memoryType;
    const fromSecrets = _fromDeploySecrets();
    if (fromSecrets) {
      _memoryType = fromSecrets;
      _cacheLocal(fromSecrets);
      return fromSecrets;
    }
    const fromSettings = _fromSettings();
    if (fromSettings) {
      _memoryType = fromSettings;
      _cacheLocal(fromSettings);
      return fromSettings;
    }
    try {
      return _normalize(localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT;
    }
  }

  function hydrateFromSettings(_options = {}) {
    const prev = _memoryType ?? get();
    _memoryType = null;
    const settingsType = _fromSettings();
    const deployType = _fromDeploySecrets();
    let resolved;

    if (deployType) {
      resolved = deployType;
      _persistToSettings(deployType);
    } else if (settingsType) {
      resolved = settingsType;
    } else {
      try {
        resolved = _normalize(localStorage.getItem(STORAGE_KEY));
      } catch {
        resolved = DEFAULT;
      }
    }

    _memoryType = resolved;
    _cacheLocal(resolved);

    if (prev !== resolved) {
      window.dispatchEvent(new CustomEvent('wfa:institution-mode-changed', {
        detail: { type: resolved, previous: prev },
      }));
    }
    applySchoolNav();
    return resolved;
  }

  function set(type, options = {}) {
    const next = _normalize(type);
    const prev = get();
    _memoryType = next;
    _cacheLocal(next);
    if (options.persist !== false) _persistToSettings(next);
    if (prev !== next) {
      window.dispatchEvent(new CustomEvent('wfa:institution-mode-changed', {
        detail: { type: next, previous: prev },
      }));
    }
    applySchoolNav();
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
  window.addEventListener('wfa:synced', () => {
    hydrateFromSettings();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => hydrateFromSettings(), 0);
    });
  } else {
    setTimeout(() => hydrateFromSettings(), 0);
  }

  return {
    get,
    set,
    hydrateFromSettings,
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

}
