# WFA Feature Development Master Plan
**Project:** Wings Fly Academy (WFA)  
**Created:** June 2026  
**Status:** Ready to Execute

---

## Branch & Supabase Strategy

### GitHub Branch Rules
```
main (production — কখনো সরাসরি কাজ করবেন না)
  ├── feature/student-portal
  ├── feature/payment-system
  ├── feature/routine-builder
  └── feature/sms-notification
```

### Supabase Project Rules
| Branch | Supabase Project | কাজ |
|--------|-----------------|------|
| `main` | `wfa-production` | Real office data |
| যেকোনো feature branch | `wfa-testing` (নতুন খুলুন) | Test data, কাজ শেষে delete |

### Feature Branch-এ কাজ শুরুর আগে চেকলিস্ট
- [x] GitHub-এ নতুন branch তৈরি করুন
- [x] নতুন Supabase project খুলুন (wfa-testing)
- [x] `www/js/core/supabase-config.js` এ testing URL/Key বসান
- [x] `android/app/src/main/assets/public/js/core/supabase-config.js` একই কাজ (standalone-creds-এ করা হয়েছে)
- [x] ZIP backup নিন (কাজ শুরুর আগে)

### Main-এ Merge করার আগে চেকলিস্ট
- [ ] `supabase-config.js` এ production URL/Key ফিরিয়ে দিন (দুই জায়গায়)
- [ ] পুরো feature নিজে test করুন
- [ ] GitHub Desktop-এ feature branch থেকে main-এ merge করুন
- [ ] Supabase testing project delete করুন
- [ ] Production-এ deploy করুন

---

## Feature 1 — Student/Parent Portal [STATUS: ✅ MERGED TO MAIN]
**Branch:** `feature/student-portal`  
**নির্ভরতা:** কোনো existing feature-এর উপর নির্ভর করে না  
**ঝুঁকি:** কম (সম্পূর্ণ নতুন ফাইল, existing কিছু নষ্ট হবে না)

### কী হবে
Student নিজে phone number + 4-digit PIN দিয়ে login করবে।  
 his attendance, result, fee status দেখবে।  
Admin আলাদাভাবে কিছু share করতে হবে না।

### নতুন ফাইল (তৈরি করতে হবে)
```
student-portal.html [Done]
www/js/core/student-auth.js [Done]
www/js/ui/student-dashboard.js [Done]
www/css/student-portal.css [Done]
```

### Supabase-এ নতুন Table
```sql
CREATE TABLE student_portal_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL,
  student_name text,
  phone text NOT NULL,
  pin_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Existing Code-এ যা Touch হবে
| ফাইল | কী যোগ হবে | ঝুঁকি |
|------|-----------|-------|
| `www/js/ui/settings.js` | Student Portal settings hook | খুব কম |
| `www/js/core/supabase-sync.js` | student_portal_access table-এ read/write permission | খুব কম |

### কাজের ধাপ
- [x] 1. Supabase-এ table তৈরির SQL দেব
- [x] 2. `student-portal.html` বানাব (login page + dashboard)
- [x] 3. Phone + PIN login system
- [x] 4. Dashboard-এ ৩টা tab: Attendance | Result | Fee Status
- [x] 5. Admin panel settings-এ "Portal Access দাও" বাটন (`settings.js`-এ "Student Portal" tab যোগ হয়েছে)
- [x] 6. Admin-এ student list থেকে PIN set করার option (PIN modal + Supabase upsert সম্পন্ন)
- [x] 7. Testing ✓ → Merge → GitHub Push ✅ (main branch প্রস্তুত)

---

## Feature 2 — Manual Payment System (bKash/Nagad)
**Branch:** `feature/payment-system`  
**নির্ভরতা:** Feature 1 (Student Portal) আগে merge হতে হবে  
**ঝুঁকি:** কম (নতুন table, existing fee logic-এ সতর্কভাবে যোগ হবে)

### কী হবে
```
Student → bKash/Nagad করে → Transaction ID + Screenshot submit করে
Admin → verify করে → Approve/Reject দেয়
Approve → Fee record automatically Paid mark হয়
```

### নতুন ফাইল (তৈরি করতে হবে)
```
www/js/ui/payment-requests.js
www/js/core/payment-engine.js
```

### Supabase-এ নতুন Table
```sql
CREATE TABLE payment_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id text NOT NULL,
  student_name text,
  batch_id text,
  amount numeric NOT NULL,
  method text NOT NULL, -- 'bKash' | 'Nagad' | 'Bank'
  transaction_id text NOT NULL,
  sender_number text,
  screenshot_url text,
  status text DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  note text
);
```

### Existing Code-এ যা Touch হবে
| ফাইল | কী যোগ হবে | ঝুঁকি |
|------|-----------|-------|
| `www/js/ui/settings.js` | "Payment Requests" নতুন menu item | খুব কম |
| `student-portal.html` | "Payment করুন" বাটন ও form | খুব কম |
| Existing fee logic | Approve হলে fee record auto-update | মাঝারি — সতর্কভাবে |

### Settings-এ যোগ হবে (Admin Configure করবেন)
- bKash নম্বর
- Nagad নম্বর  
- Bank account info
- Payment on/off toggle

### কাজের ধাপ
1. Supabase table তৈরির SQL দেব
2. Student Portal-এ payment submission form
3. Admin panel-এ Payment Requests section (pending list)
4. Approve button → existing fee record auto-mark as paid
5. Reject button → note সহ rejection
6. Settings-এ bKash/Nagad number configure option
7. Payment history (student ও admin উভয় দিকে)
8. Testing করুন → Merge

---

## Feature 3 — Class Routine Builder
**Branch:** `feature/routine-builder`  
**নির্ভরতা:** Feature 1 merge হলে ভালো (Portal-এ দেখাবে), তবে আলাদাও করা যাবে  
**ঝুঁকি:** কম (existing batch/teacher data শুধু read করবে)

### কী হবে
Batch ও teacher অনুযায়ী weekly class routine তৈরি হবে।  
Same teacher-কে একই সময়ে দুই জায়গায় দেওয়া যাবে না (conflict check)।  
Student Portal-এ routine দেখা যাবে।  
Print / PDF export করা যাবে।

### নতুন ফাইল (তৈরি করতে হবে)
```
www/js/ui/routine-builder.js
www/js/core/routine-engine.js
```

### Supabase-এ নতুন Table
```sql
CREATE TABLE class_routines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id text NOT NULL,
  day text NOT NULL, -- 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
  start_time text NOT NULL, -- '09:00'
  end_time text NOT NULL,   -- '10:30'
  subject text,
  teacher_id text,
  room text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Existing Code-এ যা Touch হবে
| ফাইল | কী যোগ হবে | ঝুঁকি |
|------|-----------|-------|
| `www/js/ui/settings.js` | "Routine" নতুন menu item | খুব কম |
| `student-portal.html` | Routine tab যোগ | খুব কম |
| Existing batch/teacher/course data | শুধু read করবে | কোনো ঝুঁকি নেই |

### কাজের ধাপ
1. Supabase table তৈরির SQL দেব
2. Admin-এ weekly grid routine builder (Sat–Fri, time slot)
3. Teacher conflict detection ও warning
4. Batch-wise routine আলাদা view
5. Print / PDF export
6. Student Portal-এ routine দেখানো
7. Testing করুন → Merge

---

## Feature 4 — SMS Notification
**Branch:** `feature/sms-notification`  
**নির্ভরতা:** সবার শেষে করুন (সব feature-এর trigger এখানে যোগ হবে)  
**ঝুঁকি:** মাঝারি (existing fee/result/attendance code-এ trigger যোগ হবে)

### কী হবে
Fee due হলে → SMS যাবে  
Result publish হলে → SMS যাবে  
Absent হলে → SMS যাবে  
Payment approve/reject হলে → SMS যাবে

### SMS Provider
**Green Web BD** (greenwebbd.com) — বাংলাদেশী, সস্তা, সহজ API  
Cost: প্রতি SMS ০.৩০–০.৫০ টাকা  
Account খুলতে: NID + trade license (বা personal account)

### নতুন ফাইল (তৈরি করতে হবে)
```
www/js/core/sms-engine.js
```

### Supabase-এ নতুন Table
```sql
CREATE TABLE sms_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient text NOT NULL,
  message text NOT NULL,
  type text, -- 'fee_due' | 'result' | 'absent' | 'payment'
  status text, -- 'sent' | 'failed'
  provider_response text,
  sent_at timestamptz DEFAULT now()
);
```

### Existing Code-এ যা Touch হবে
| ফাইল | কী যোগ হবে | ঝুঁকি |
|------|-----------|-------|
| `www/js/ui/settings.js` | SMS Settings section (API key, sender ID, toggles) | কম |
| Fee section | Due reminder SMS trigger | মাঝারি |
| Exam/Result section | Result publish SMS trigger | মাঝারি |
| Attendance section | Absent SMS trigger | মাঝারি |
| Payment engine | Approve/Reject SMS trigger | কম |

### Settings-এ যোগ হবে (Admin Configure করবেন)
- SMS API Key (Green Web BD থেকে নেবেন)
- Sender ID
- Fee due SMS on/off
- Result SMS on/off
- Absent SMS on/off
- Payment SMS on/off

### কাজের ধাপ
1. Green Web BD-তে account খুলুন, API key নিন
2. `sms-engine.js` তৈরি (send + log function)
3. Settings-এ SMS configuration panel
4. Fee due → monthly auto SMS
5. Result publish → auto SMS
6. Absent → auto SMS
7. Payment approve/reject → auto SMS
8. SMS log history admin panel-এ
9. Testing করুন → Merge

---

## সঠিক কাজের Order

```
STEP 1 → feature/student-portal    (সবার আগে, বাকিগুলো এর উপর নির্ভর করে)
STEP 2 → feature/payment-system    (Portal merge হওয়ার পরে)
STEP 3 → feature/routine-builder   (Payment merge হওয়ার পরে)
STEP 4 → feature/sms-notification  (সবার শেষে — সব trigger এখানে)
```

---

## প্রতিটা Session-এ আমাকে যা দেবেন

```
1. Current main branch-এর ZIP (সর্বশেষ)
2. বলুন কোন Feature-এর কোন Step করতে চান
3. আমি শুধু সেই ধাপের কাজ করে নতুন ZIP দেব
```

**একটা session-এ একটাই feature করুন।**  
Testing শেষে merge করুন, তারপর পরের feature।

---

*Plan version: 1.0 | WFA Development Team*
