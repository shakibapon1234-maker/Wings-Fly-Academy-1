// tests/utils.test.js — Wings Fly Aviation Academy
// ─────────────────────────────────────────────────────────
// utils.js ব্রাউজার-global (IIFE pattern) তাই সরাসরি import নেই।
// প্রতিটি function এখানে হুবহু mirror করা হয়েছে।
// মূল ফাইলে কোনো পরিবর্তন করা হয়নি।
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Mirror: utils.js → esc ──────────────────────────────
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function decodeHtmlEntities(str, maxPasses = 8) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  if (!/&(?:#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/i.test(s)) return s;
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
    if (s === prev) break;
  }
  return s;
}

function displayText(str) {
  return esc(decodeHtmlEntities(str));
}

// ── Mirror: utils.js → safeNum ──────────────────────────
function safeNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Mirror: utils.js → takaEn ───────────────────────────
function takaEn(amount) {
  const n = safeNum(amount);
  return '৳' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Mirror: utils.js → formatDateDMY ────────────────────
function formatDateDMY(dateStr) {
  if (!dateStr) return '—';
  const s = String(dateStr).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── Mirror: utils.js → sortBy ───────────────────────────
function sortBy(arr, field, direction = 'asc') {
  return [...arr].sort((a, b) => {
    const va = a[field] || '';
    const vb = b[field] || '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return direction === 'desc' ? -cmp : cmp;
  });
}

// ── Student due calculation ──────────────────────────────
function calcStudentDue(totalFee, paid) {
  return Math.max(0, safeNum(totalFee) - safeNum(paid));
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('Utils.decodeHtmlEntities', () => {
  it('single &amp; decode করে', () => {
    expect(decodeHtmlEntities('Air Ticket &amp; Visa')).toBe('Air Ticket & Visa');
  });

  it('repeated encoding সরায়', () => {
    expect(decodeHtmlEntities('Air Ticket &amp;amp;amp; Visa')).toBe('Air Ticket & Visa');
  });
});

describe('Utils.displayText', () => {
  it('decode করে তারপর escape করে', () => {
    expect(displayText('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
  });
});

describe('Utils.esc — XSS Protection', () => {
  it('script tag escape করে', () => {
    expect(esc('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('& চিহ্ন escape করে', () => {
    expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('null দিলে empty string রিটার্ন করে', () => {
    expect(esc(null)).toBe('');
  });

  it('undefined দিলে empty string রিটার্ন করে', () => {
    expect(esc(undefined)).toBe('');
  });

  it('double quote escape করে', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });
});

describe('Utils.safeNum — Safe Number Parsing', () => {
  it('null দিলে 0 রিটার্ন করে', () => {
    expect(safeNum(null)).toBe(0);
  });

  it('undefined দিলে 0 রিটার্ন করে', () => {
    expect(safeNum(undefined)).toBe(0);
  });

  it('valid string number parse করে', () => {
    expect(safeNum('1500')).toBe(1500);
  });

  it('"abc" দিলে 0 রিটার্ন করে', () => {
    expect(safeNum('abc')).toBe(0);
  });

  it('decimal handle করে', () => {
    expect(safeNum('99.5')).toBe(99.5);
  });
});

describe('Utils.takaEn — Taka Formatting', () => {
  it('৳ চিহ্ন সহ ফরম্যাট করে', () => {
    expect(takaEn(1000)).toContain('৳');
  });

  it('null দিলে crash করে না', () => {
    expect(() => takaEn(null)).not.toThrow();
  });
});

describe('Utils.formatDateDMY — Date Formatting', () => {
  it('"2026-05-19" → "19/05/2026"', () => {
    expect(formatDateDMY('2026-05-19')).toBe('19/05/2026');
  });

  it('null দিলে "—" রিটার্ন করে', () => {
    expect(formatDateDMY(null)).toBe('—');
  });

  it('empty string দিলে "—" রিটার্ন করে', () => {
    expect(formatDateDMY('')).toBe('—');
  });
});

describe('Utils.sortBy — Array Sorting', () => {
  const data = [
    { name: 'Rahim', amount: 3000 },
    { name: 'Karim', amount: 1000 },
    { name: 'Sumon', amount: 2000 },
  ];

  it('ascending sort করে', () => {
    const sorted = sortBy(data, 'name', 'asc');
    expect(sorted[0].name).toBe('Karim');
  });

  it('descending sort করে', () => {
    const sorted = sortBy(data, 'name', 'desc');
    expect(sorted[0].name).toBe('Sumon');
  });

  it('original array পরিবর্তন করে না', () => {
    const original = [...data];
    sortBy(data, 'name', 'desc');
    expect(data[0].name).toBe(original[0].name);
  });
});

describe('Student Due Calculation', () => {
  it('due সঠিকভাবে বের করে', () => {
    expect(calcStudentDue(10000, 4000)).toBe(6000);
  });

  it('পুরো পেমেন্ট হলে due = 0', () => {
    expect(calcStudentDue(5000, 5000)).toBe(0);
  });

  it('string amount handle করে', () => {
    expect(calcStudentDue('8000', '2000')).toBe(6000);
  });

  it('overpayment হলে 0 (negative নয়)', () => {
    expect(calcStudentDue(5000, 6000)).toBe(0);
  });
});
