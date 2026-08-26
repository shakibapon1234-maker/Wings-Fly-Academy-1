// tests/students.test.js — Wings Fly Aviation Academy
// ─────────────────────────────────────────────────────────
// students.js ব্রাউজার-global (IIFE) তাই সরাসরি import নেই।
// প্রতিটি pure function এখানে হুবহু mirror করা হয়েছে।
// মূল ফাইলে কোনো পরিবর্তন করা হয়নি।
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Mirror: utils.js → safeNum ──────────────────────────
function safeNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Mirror: utils.js → decodeHtmlEntities ───────────────
// Source: js/core/utils.js line ~22
function decodeHtmlEntities(str, maxPasses = 30) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  if (!/&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/i.test(s)) return s;

  while (/&(?:amp|#0*38|#x0*26);/gi.test(s)) {
    const next = s.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    if (next === s) break;
    s = next;
  }

  for (let i = 0; i < maxPasses; i++) {
    const prev = s;
    s = prev
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&apos;/gi, "'");
    while (/&(?:amp|#0*38|#x0*26);/gi.test(s)) {
      const next = s.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
      if (next === s) break;
      s = next;
    }
    if (s === prev) break;
  }
  return s;
}

// ── Mirror: students.js → _normCourse ───────────────────
// Source: js/modules/students.js
function _normCourse(val) {
  if (!val) return '';
  let clean = decodeHtmlEntities(String(val).trim());
  clean = clean.replace(/&;+/g, '&').replace(/\s*&+\s*$/, '').trim();
  return clean;
}

// ── Mirror: students.js → _normCourseList ───────────────
// Source: js/modules/students.js line ~96
// Course list থেকে duplicate এবং empty সরায়
function _normCourseList(list) {
  return [...new Set((list || []).map(c => _normCourse(c)).filter(Boolean))];
}

// ── Mirror: students.js → due calculation logic ─────────
// Source: js/modules/students.js line ~933 (calcDue pure part)
function calcStudentDue(totalFee, paid) {
  const total = safeNum(totalFee);
  const p     = safeNum(paid);
  if (total > 0 && p > total) return 0; // overpayment allowed = 0 due
  return Math.max(0, total - p);
}

// ── Mirror: students.js → fee status logic ──────────────
// Student-এর payment status নির্ধারণ করে
function getFeeStatus(totalFee, paid) {
  const due = calcStudentDue(totalFee, paid);
  if (due <= 0) return 'paid';
  if (safeNum(paid) > 0) return 'partial';
  return 'unpaid';
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('Students._normCourse — Course Name Normalization', () => {

  it('plain string অপরিবর্তিত থাকে', () => {
    expect(_normCourse('CPL')).toBe('CPL');
  });

  it('HTML entity decode করে (&amp; → &)', () => {
    expect(_normCourse('Air &amp; Space')).toBe('Air & Space');
  });

  it('double-encoded entity decode করে', () => {
    expect(_normCourse('Air &amp;amp; Space')).toBe('Air & Space');
  });

  it('whitespace trim করে', () => {
    expect(_normCourse('  CPL  ')).toBe('CPL');
  });

  it('null দিলে empty string রিটার্ন করে', () => {
    expect(_normCourse(null)).toBe('');
  });

  it('undefined দিলে empty string রিটার্ন করে', () => {
    expect(_normCourse(undefined)).toBe('');
  });

  it('number দিলে string-এ convert করে', () => {
    expect(_normCourse(101)).toBe('101');
  });
});

// ─────────────────────────────────────────────────────────

describe('Students._normCourseList — Course List Deduplication', () => {

  it('duplicate সরায়', () => {
    const result = _normCourseList(['CPL', 'CPL', 'PPL']);
    expect(result).toHaveLength(2);
    expect(result).toContain('CPL');
    expect(result).toContain('PPL');
  });

  it('HTML entity decode করে duplicate merge করে', () => {
    // 'Air &amp; Space' এবং 'Air & Space' একই হওয়া উচিত
    const result = _normCourseList(['Air &amp; Space', 'Air & Space', 'CPL']);
    expect(result).toHaveLength(2);
  });

  it('বহুবার &amp;amp;amp; এনকোড হওয়া কোর্স নাম সঠিক নামে পরিণত করে ও মার্জ করে', () => {
    const corrupted = [
      'Air Ticket &amp;amp;amp;amp;amp;amp; Visa',
      'Air Ticket &amp; Visa',
      'Air Ticket & Visa',
      'Student Visa Processing'
    ];
    const result = _normCourseList(corrupted);
    expect(result).toHaveLength(2);
    expect(result).toContain('Air Ticket & Visa');
    expect(result).toContain('Student Visa Processing');
  });

  it('empty string বাদ দেয়', () => {
    const result = _normCourseList(['CPL', '', '  ', 'PPL']);
    // empty string বাদ যাবে, trimmed whitespace-ও বাদ যাবে
    expect(result.every(c => c.length > 0)).toBe(true);
  });

  it('null list দিলে empty array রিটার্ন করে', () => {
    expect(_normCourseList(null)).toEqual([]);
  });

  it('empty list দিলে empty array রিটার্ন করে', () => {
    expect(_normCourseList([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────

describe('Students.calcStudentDue — Due Amount Calculation', () => {

  it('সঠিকভাবে due বের করে', () => {
    expect(calcStudentDue(10000, 4000)).toBe(6000);
  });

  it('পুরো পেমেন্ট হলে due = 0', () => {
    expect(calcStudentDue(5000, 5000)).toBe(0);
  });

  it('string amount handle করে (DB থেকে string আসতে পারে)', () => {
    expect(calcStudentDue('8000', '2000')).toBe(6000);
  });

  it('overpayment হলে due = 0 (negative নয়)', () => {
    expect(calcStudentDue(5000, 6000)).toBe(0);
  });

  it('paid শূন্য হলে due = totalFee', () => {
    expect(calcStudentDue(12000, 0)).toBe(12000);
  });

  it('totalFee শূন্য হলে due = 0', () => {
    expect(calcStudentDue(0, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────

describe('Students.getFeeStatus — Fee Payment Status', () => {

  it('পুরো পেমেন্ট হলে "paid"', () => {
    expect(getFeeStatus(10000, 10000)).toBe('paid');
  });

  it('আংশিক পেমেন্ট হলে "partial"', () => {
    expect(getFeeStatus(10000, 5000)).toBe('partial');
  });

  it('কোনো পেমেন্ট না হলে "unpaid"', () => {
    expect(getFeeStatus(10000, 0)).toBe('unpaid');
  });

  it('overpayment হলে "paid" (due = 0)', () => {
    expect(getFeeStatus(5000, 6000)).toBe('paid');
  });
});
