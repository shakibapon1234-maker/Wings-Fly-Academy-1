/* ============================================================
   Wings Fly Academy — Student Portal Authentication Core
   ============================================================ */

const StudentAuth = (() => {
  'use strict';

  const SESSION_KEY = 'wfa_student_portal_session';

  // ── SHA-256 Hashing with FNV-1a fallback (identical to app.js) ──
  async function _hashPin(pin) {
    try {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback for non-secure HTTP contexts
      const salt = 'wfa_2026_';
      const salted = salt + pin + pin.length.toString(16);
      let h = 0x811c9dc5;
      for (let round = 0; round < 3; round++) {
        const input = round === 0 ? salted : salted + (h >>> 0).toString(16);
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 0x01000193);
        }
      }
      const h1 = (h >>> 0).toString(16).padStart(8, '0');
      const h2 = ((h >>> 0) ^ 0x9e3779b9 >>> 0).toString(16).padStart(8, '0');
      return h1 + h2;
    }
  }

  // ── Initialize Supabase Client ──
  function _getSupabaseClient() {
    const creds = window.WFA_STANDALONE_SUPABASE;
    if (!creds || !creds.url || !creds.key) {
      console.error('[StudentAuth] Supabase configuration not found.');
      return null;
    }
    if (!window.supabase) {
      console.error('[StudentAuth] Supabase library not loaded.');
      return null;
    }
    return window.supabase.createClient(creds.url, creds.key);
  }

  // ── Login Function ──
  async function login(phone, pin) {
    if (!phone || !pin) {
      throw new Error('দয়া করে সচল মোবাইল নম্বর এবং ৪ ডিজিটের পিন নম্বর লিখুন।');
    }
    if (pin.length !== 4 || isNaN(pin)) {
      throw new Error('পিন নম্বর অবশ্যই ৪ ডিজিটের সংখ্যা হতে হবে।');
    }

    const sb = _getSupabaseClient();
    if (!sb) {
      throw new Error('সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না। অনুগ্রহ করে পরে চেষ্টা করুন।');
    }

    // Clean phone input (remove spaces, dash, etc.)
    const cleanPhone = phone.replace(/[\s-]/g, '');

    // Hash the entered pin
    const hashedPin = await _hashPin(pin);

    // Query student_portal_access table
    const { data: accessData, error: accessErr } = await sb
      .from('student_portal_access')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('is_active', true);

    if (accessErr) {
      console.error('[StudentAuth] DB query error:', accessErr);
      throw new Error('তথ্য যাচাইকরণে সমস্যা হচ্ছে। আপনার ডাটাবেজ টেবিল চেক করুন।');
    }

    if (!accessData || accessData.length === 0) {
      throw new Error('এই মোবাইল নম্বরে স্টুডেন্ট পোর্টাল সচল করা হয়নি। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।');
    }

    // Find the record matching the pin
    const matchedRecord = accessData.find(record => record.pin_hash === hashedPin);
    if (!matchedRecord) {
      throw new Error('ভুল পিন নম্বর! আবার চেষ্টা করুন।');
    }

    // PIN matched. Now fetch details from students table
    const { data: studentData, error: studentErr } = await sb
      .from('students')
      .select('*')
      .eq('id', matchedRecord.student_id);

    if (studentErr || !studentData || studentData.length === 0) {
      console.error('[StudentAuth] Fetch student error:', studentErr);
      throw new Error('স্টুডেন্ট ডাটা পাওয়া যায়নি। ডাটাবেজে স্টুডেন্ট রেকর্ডটি সচল আছে কিনা এডমিনকে চেক করতে বলুন।');
    }

    const studentInfo = studentData[0];
    
    // Save session
    const session = {
      student_id: studentInfo.id,
      student_no: studentInfo.student_id, // e.g. S101
      student_name: studentInfo.name,
      phone: studentInfo.phone,
      batch: studentInfo.batch,
      course: studentInfo.course,
      roll_no: studentInfo.roll_no,
      login_time: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  // ── Check session ──
  function getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // ── Logout ──
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }

  return { login, getSession, logout, hashPin: _hashPin };
})();

window.StudentAuth = StudentAuth;
