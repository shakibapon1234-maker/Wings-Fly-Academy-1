# AcadeFlow — School Mode Implementation Plan
**Version:** 1.0 | **তৈরি:** June 2026  
**Status:** 🟡 Planning Complete — Implementation Ready

---

## 🎯 লক্ষ্য

একই codebase-এ **Institution Type Switcher** যোগ করা, যাতে:
- **Coaching Mode** → বর্তমান WFA হুবহু আগের মতো চলে
- **School Mode** → Class/Section/Roll/Subject/Marks সহ নতুন features চালু হয়

> **মূলনীতি:** Existing কোনো ফাইল ভাঙা হবে না। সব নতুন feature আলাদা নতুন ফাইলে লেখা হবে এবং `lazy-modules.js`-এ register করে settings-এ connect করা হবে।

---

## 📁 নতুন ফাইল যা তৈরি হবে

```
js/
├── core/
│   ├── institution-mode.js          ← [NEW] Mode engine (Coaching/School/College)
│   └── settings-institution.js      ← [NEW] Settings panel (settings.js-এ inject হবে)
├── modules/
│   ├── school-classes.js            ← [NEW] Class & Section management
│   ├── subject-marks.js             ← [NEW] Subject-wise marks entry
│   └── result-sheet.js              ← [NEW] Marksheet / Result generation
```

**বিদ্যমান ফাইলে পরিবর্তন:**

| ফাইল | পরিবর্তনের ধরন | কী হবে |
|------|---------------|--------|
| `js/core/lazy-modules.js` | ছোট addition | ৩টি নতুন module register |
| `js/ui/settings.js` | ছোট addition | `panelInstitution()` call যোগ + `buildAllPanels()` |
| `js/modules/students.js` | conditional field | School mode-এ Class/Section/Roll দেখাবে |

---

## 🗂️ Phase-by-Phase কাজের তালিকা

---

### ✅ PHASE 0 — Foundation (আগে এটা, বাকি সব এর উপর নির্ভর করে)

**ফাইল:** `js/core/institution-mode.js` *(নতুন)*

এই ফাইলটা পুরো system-এর "brain"। এটা localStorage-এ institution type save করে এবং যেকোনো module এখান থেকে জানতে পারবে — এখন coaching mode নাকি school mode।

```
window.InstitutionMode = {
  get()          → 'coaching' | 'school' | 'college'
  set(type)      → save to localStorage + fire event
  isSchool()     → true/false
  isCoaching()   → true/false
  getLabel(key)  → 'Course' বা 'Class', 'Batch' বা 'Section' (terminology map)
}
```

**Default:** `'coaching'` — পুরনো সব client-এ কিছু বদলাবে না।

**lazy-modules.js-এ যোগ হবে:**
```js
'institution-mode': { src: 'js/core/institution-mode.js' },
```

**Status:** ⬜ না হলে বাকি কিছু কাজ করবে না

---

### ✅ PHASE 1 — Settings Panel (Institution Switcher UI)

**ফাইল:** `js/core/settings-institution.js` *(নতুন)*  
**Pattern:** `settings-branding.js` এর মতো — inject করে settings-এ

এই panel settings-এ একটা নতুন tab হিসেবে দেখাবে।

**UI-তে থাকবে:**
- Institution Type selector: `🏫 Coaching Centre | 🏛️ School | 🎓 College`
- Terminology preview: "আপনার app-এ 'Course' এর বদলে 'Class' দেখাবে"
- Save বাটন → toast + page soft-reload

**settings.js-এ যোগ হবে (২ লাইন):**
```js
// buildAllPanels() এর শেষে:
${panelInstitution()}

// tabs array-তে:
{ id: 'institution', icon: 'fa-building', label: 'Institution Type' },
```

**panelInstitution() ফাংশন:**
```js
function panelInstitution() {
  return `<div class="settings-panel" data-panel="institution">
    <div id="settings-institution-panel">লোডিং...</div>
  </div>`;
}
// openModal() এ inject call যোগ হবে — SettingsBranding.inject() এর পাশে
```

**lazy-modules.js-এ যোগ হবে:**
```js
'settings-institution': { src: 'js/core/settings-institution.js' },
```

**Status:** ⬜ Phase 0 শেষ হলে

---

### ✅ PHASE 2 — Student Form Adaptation

**ফাইল:** `js/modules/students.js` *(conditional field যোগ)*

School mode চালু হলে student add/edit form-এ নতুন fields দেখাবে।

**Coaching Mode (বর্তমান):**
```
Student ID | Admission Date | Name | Phone | Email
Father's Name | Course* | Batch* | Session | Fee...
```

**School Mode (নতুন — conditional):**
```
Student ID | Admission Date | Name | Phone | Email
Father's Name | Mother's Name | Guardian Phone*
Class* (৬ষ্ঠ-দ্বাদশ) | Section* (A/B/C/D) | Roll No* | Shift (Morning/Day)
Academic Year* | Fee...
```

**Implementation:** students.js-এ একটাই জায়গায় পরিবর্তন:
```js
// _buildFormHTML() ফাংশনে:
const isSchool = window.InstitutionMode && InstitutionMode.isSchool();
// তারপর conditional HTML block
```

**Status:** ⬜ Phase 0 শেষ হলে

---

### ✅ PHASE 3 — Class & Section Management

**ফাইল:** `js/modules/school-classes.js` *(নতুন)*  
**Visible:** শুধু School/College mode-এ nav-এ দেখাবে

এই module দিয়ে admin manage করবেন:
- কোন কোন Class আছে (৬ষ্ঠ, ৭ম... অথবা custom)
- প্রতিটা Class-এর Sections (A, B, C)
- Shift (Morning / Day / Evening)
- Class Teacher assign

**Data:** LocalStorage + Supabase sync (বাকি modules-এর মতোই)

**lazy-modules.js-এ যোগ হবে:**
```js
'school-classes': { src: 'js/modules/school-classes.js' },
```

**index.html nav-এ যোগ হবে (conditional):**
```html
<!-- School Mode Only -->
<button class="nav-item school-only" data-section="school-classes">
  <i class="fa fa-layer-group nav-icon"></i><span>Class & Section</span>
</button>
```

**Status:** ⬜ Phase 2 শেষ হলে

---

### ✅ PHASE 4 — Subject & Marks Entry

**ফাইল:** `js/modules/subject-marks.js` *(নতুন)*  
**Visible:** শুধু School/College mode-এ

**কী থাকবে:**
- Subject setup per Class (বাংলা, ইংরেজি, গণিত, বিজ্ঞান...)
- Exam type: Half-Yearly / Annual / Test
- Per-student per-subject marks entry (grid view)
- Auto-calculate: Total, Percentage, Grade (A+/A/A-/B/C/D/F)
- বাংলাদেশ SSC/HSC grading scale সাপোর্ট

**GPA Calculation Rule (Bangladesh standard):**
```
80-100  → A+ (5.00)
70-79   → A  (4.00)
60-69   → A- (3.50)
50-59   → B  (3.00)
40-49   → C  (2.00)
33-39   → D  (1.00)
0-32    → F  (0.00)
```

**lazy-modules.js-এ যোগ হবে:**
```js
'subject-marks': { src: 'js/modules/subject-marks.js' },
```

**Status:** ⬜ Phase 3 শেষ হলে

---

### ✅ PHASE 5 — Result Sheet / Marksheet

**ফাইল:** `js/modules/result-sheet.js` *(নতুন)*  
**Visible:** শুধু School/College mode-এ

**কী থাকবে:**
- Individual marksheet print (একজন student)
- Class-wise result sheet (পুরো class এর result এক পাতায়)
- Pass/Fail indicator
- Position/Merit list
- PDF export (existing jsPDF library use করবে)
- Print-friendly layout

**lazy-modules.js-এ যোগ হবে:**
```js
'result-sheet': { src: 'js/modules/result-sheet.js' },
```

**Status:** ⬜ Phase 4 শেষ হলে

---

### ✅ PHASE 6 — Student Portal Update (School Data)

**ফাইল:** `student-portal.html` + portal JS *(update)*

School mode-এ student portal-এ নতুন tab দেখাবে:
- **Results Tab** → নিজের marksheet দেখতে পাবে
- **Routine Tab** → ইতিমধ্যে আছে (RoutineBuilder থেকে)
- **Fee Tab** → ইতিমধ্যে আছে

**Status:** ⬜ Phase 4-5 শেষ হলে

---

## 🔄 Terminology Map (Institution Mode)

| Key | Coaching Mode | School Mode | College Mode |
|-----|--------------|-------------|--------------|
| `course_label` | Course | Class | Department |
| `batch_label` | Batch | Section | Batch/Section |
| `student_id_prefix` | STU | SCH | COL |
| `session_label` | Session | Academic Year | Academic Year |
| `fee_label` | Course Fee | Tuition Fee | Semester Fee |
| `nav_classes` | — | Class & Section | Department |
| `nav_marks` | — | Subject & Marks | Subject & Marks |
| `nav_result` | — | Result Sheet | Result Sheet |

---

## 📋 Implementation Order (Summary)

```
Phase 0: institution-mode.js তৈরি              ← Foundation
    ↓
Phase 1: settings-institution.js + UI          ← Admin control
    ↓
Phase 2: students.js conditional fields        ← Data model
    ↓
Phase 3: school-classes.js                     ← Class management
    ↓
Phase 4: subject-marks.js                      ← Core school feature
    ↓
Phase 5: result-sheet.js                       ← Output
    ↓
Phase 6: student-portal update                 ← Student-facing
```

---

## ⚠️ গুরুত্বপূর্ণ নিয়ম (প্রতিটা Phase-এ মানতে হবে)

1. **Coaching mode অপরিবর্তিত থাকবে** — Default `'coaching'`, তাই পুরনো সব client-এ কিছু বদলাবে না
2. **Additive only** — Existing function-এর ভেতরে ঢোকা হবে না, শুধু নতুন জিনিস যোগ
3. **Lazy loading** — প্রতিটা নতুন module `lazy-modules.js`-এ register করতে হবে
4. **School-only UI** — নতুন nav items শুধু `InstitutionMode.isSchool()` হলে render হবে
5. **settings.js ছোঁয়া কমাবো** — শুধু `buildAllPanels()` এ একটা call এবং tabs array-তে একটা entry

---

## 📊 Progress Tracker

| Phase | কাজ | Status | নোট |
|-------|-----|--------|-----|
| Phase 0 | `institution-mode.js` তৈরি | ⬜ Pending | |
| Phase 1 | `settings-institution.js` + Settings tab | ⬜ Pending | |
| Phase 2 | `students.js` conditional fields | ⬜ Pending | |
| Phase 3 | `school-classes.js` | ⬜ Pending | |
| Phase 4 | `subject-marks.js` | ⬜ Pending | |
| Phase 5 | `result-sheet.js` | ⬜ Pending | |
| Phase 6 | Student Portal update | ⬜ Pending | |

**Legend:** ⬜ Pending | 🔄 In Progress | ✅ Complete | ❌ Blocked
