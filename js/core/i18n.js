// ============================================================
// Wings Fly Aviation Academy — i18n / Error Message Localization
// Bug #25 Fix: Consistent Bengali/English error messages throughout app
// ============================================================

const WFA_i18n = (() => {
  'use strict';

  // Current language — reads from app setting
  function getLang() {
    try { return localStorage.getItem('wfa_language') || 'bn'; } catch { return 'bn'; }
  }

  // ── Message Dictionary ────────────────────────────────────
  const messages = {
    // ── General ──
    'error.unknown':          { en: 'An unknown error occurred.',             bn: 'একটি অজানা ত্রুটি হয়েছে।' },
    'error.network':          { en: 'Network error. Please check your connection.', bn: 'নেটওয়ার্ক সমস্যা। সংযোগ পরীক্ষা করুন।' },
    'error.permission':       { en: 'Access denied.',                          bn: 'অনুমতি নেই।' },
    'error.notFound':         { en: 'Record not found.',                       bn: 'তথ্য পাওয়া যায়নি।' },
    'error.saveFailed':       { en: 'Failed to save. Please try again.',       bn: 'সেভ করতে ব্যর্থ। আবার চেষ্টা করুন।' },
    'error.deleteFailed':     { en: 'Failed to delete.',                       bn: 'মুছে ফেলতে ব্যর্থ।' },
    'error.loadFailed':       { en: 'Failed to load data.',                    bn: 'ডেটা লোড করতে ব্যর্থ।' },
    'error.syncFailed':       { en: 'Cloud sync failed.',                      bn: 'ক্লাউড সিঙ্ক ব্যর্থ হয়েছে।' },
    'error.storageFull':      { en: 'Storage quota exceeded.',                 bn: 'স্টোরেজ ভর্তি হয়ে গেছে।' },
    'error.offline':          { en: 'You are offline.',                        bn: 'ইন্টারনেট সংযোগ নেই।' },
    'error.timeout':          { en: 'Request timed out.',                      bn: 'সময়সীমা পার হয়ে গেছে।' },
    'error.invalidInput':     { en: 'Invalid input. Please check your data.',  bn: 'ভুল তথ্য। আবার পরীক্ষা করুন।' },
    'error.required':         { en: 'This field is required.',                 bn: 'এই তথ্যটি আবশ্যক।' },
    'error.duplicateId':      { en: 'This ID already exists.',                 bn: 'এই আইডি আগে থেকেই আছে।' },

    // ── Auth ──
    'auth.loginFailed':       { en: 'Invalid username or password.',           bn: 'ভুল ব্যবহারকারী নাম বা পাসওয়ার্ড।' },
    'auth.sessionExpired':    { en: 'Session expired. Please login again.',    bn: 'সেশন শেষ হয়ে গেছে। আবার লগইন করুন।' },
    'auth.locked':            { en: 'Account locked. Try again later.',        bn: 'অ্যাকাউন্ট লক হয়েছে। পরে চেষ্টা করুন।' },
    'auth.noPermission':      { en: 'You do not have permission to do this.',  bn: 'এই কাজ করার অনুমতি নেই।' },

    // ── Students ──
    'student.added':          { en: 'Student added successfully.',             bn: 'ছাত্র/ছাত্রী সফলভাবে যোগ করা হয়েছে।' },
    'student.updated':        { en: 'Student updated.',                        bn: 'ছাত্র/ছাত্রীর তথ্য আপডেট হয়েছে।' },
    'student.deleted':        { en: 'Student deleted.',                        bn: 'ছাত্র/ছাত্রী মুছে ফেলা হয়েছে।' },
    'student.notFound':       { en: 'Student not found.',                      bn: 'ছাত্র/ছাত্রী খুঁজে পাওয়া যায়নি।' },
    'student.feeRequired':    { en: 'Total fee is required.',                  bn: 'মোট ফি অবশ্যই দিতে হবে।' },

    // ── Finance ──
    'finance.added':          { en: 'Transaction added.',                      bn: 'লেনদেন যোগ করা হয়েছে।' },
    'finance.deleted':        { en: 'Transaction deleted.',                    bn: 'লেনদেন মুছে ফেলা হয়েছে।' },
    'finance.insufficientBal':{ en: 'Insufficient account balance.',           bn: 'অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই।' },
    'finance.invalidAmount':  { en: 'Amount must be greater than 0.',          bn: 'পরিমাণ ০ এর বেশি হতে হবে।' },

    // ── Sync ──
    'sync.started':           { en: 'Sync started...',                         bn: 'সিঙ্ক শুরু হচ্ছে...' },
    'sync.done':              { en: 'Sync complete!',                          bn: 'সিঙ্ক সম্পন্ন!' },
    'sync.failed':            { en: 'Sync failed. Will retry.',                bn: 'সিঙ্ক ব্যর্থ। পুনরায় চেষ্টা হবে।' },
    'sync.noConnection':      { en: 'No cloud connection.',                    bn: 'ক্লাউড সংযোগ নেই।' },
    'sync.private':           { en: 'Private mode — data won\'t be saved.',    bn: 'প্রাইভেট মোড — ডেটা সংরক্ষিত হবে না।' },

    // ── UI ──
    'ui.noData':              { en: 'No data available.',                      bn: 'কোনো তথ্য নেই।' },
    'ui.loading':             { en: 'Loading...',                              bn: 'লোড হচ্ছে...' },
    'ui.saving':              { en: 'Saving...',                               bn: 'সেভ হচ্ছে...' },
    'ui.confirm':             { en: 'Are you sure?',                           bn: 'আপনি কি নিশ্চিত?' },
    'ui.cancel':              { en: 'Cancel',                                  bn: 'বাতিল' },
    'ui.save':                { en: 'Save',                                    bn: 'সেভ' },
    'ui.delete':              { en: 'Delete',                                  bn: 'মুছুন' },
    'ui.edit':                { en: 'Edit',                                    bn: 'সম্পাদনা' },
    'ui.close':               { en: 'Close',                                   bn: 'বন্ধ' },
    'ui.exportSuccess':       { en: 'Export successful.',                      bn: 'এক্সপোর্ট সফল হয়েছে।' },
    'ui.importSuccess':       { en: 'Import successful.',                      bn: 'ইমপোর্ট সফল হয়েছে।' },
    'ui.copied':              { en: 'Copied to clipboard!',                    bn: 'ক্লিপবোর্ডে কপি হয়েছে!' },
    'ui.printReady':          { en: 'Print ready.',                            bn: 'প্রিন্টের জন্য প্রস্তুত।' },
  };

  // ── Translate a key ───────────────────────────────────────
  function t(key, lang) {
    const l = lang || getLang();
    const entry = messages[key];
    if (!entry) return key; // Return key as-is if not found
    return entry[l] || entry['en'] || key;
  }

  // ── Translate with variable substitution ──────────────────
  // Example: t('student.added', null, { name: 'Rahim' }) with msg containing {name}
  function tFormat(key, vars, lang) {
    let msg = t(key, lang);
    if (vars && typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return msg;
  }

  // ── Toast helper with i18n ────────────────────────────────
  function toastKey(key, type = 'info', duration = 3000, lang) {
    const msg = t(key, lang);
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast(msg, type, duration);
    }
    return msg;
  }

  // ── Add custom message ────────────────────────────────────
  function addMessage(key, en, bn) {
    messages[key] = { en, bn };
  }

  return { t, tFormat, toastKey, getLang, addMessage, messages };
})();

window.WFA_i18n = WFA_i18n;
// Alias for convenience
window.__ = WFA_i18n.t;
