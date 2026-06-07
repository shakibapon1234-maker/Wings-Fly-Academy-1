// tests/salary.test.js — Wings Fly Aviation Academy
// ─────────────────────────────────────────────────────────
// salary.js ব্রাউজার-global (IIFE) তাই সরাসরি import নেই।
// প্রতিটি pure function এখানে হুবহু mirror করা হয়েছে।
// মূল ফাইলে কোনো পরিবর্তন করা হয়নি।
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Mirror: utils.js → safeNum ──────────────────────────
// Source: js/core/utils.js line ~270
function safeNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Mirror: salary.js → calcNet ─────────────────────────
// Source: js/modules/salary.js line ~73
// NET = baseSalary + bonus - deduction
function calcNet(r) {
  return safeNum(r.baseSalary) + safeNum(r.bonus) - safeNum(r.deduction);
}

// ── Mirror: salary.js → monthLabel ──────────────────────
// Source: js/modules/salary.js line ~58
function monthLabel(ym) {
  if (!ym) return '—';
  const parts = ym.split('-');
  const y = parts[0]; const m = parts[1];
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return (months[parseInt(m, 10) - 1] || '?') + ' ' + y;
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('Salary.calcNet — Net Salary Calculation', () => {
  it('baseSalary + bonus - deduction সঠিকভাবে calculate করে', () => {
    const r = { baseSalary: 20000, bonus: 2000, deduction: 1000 };
    expect(calcNet(r)).toBe(21000);
  });

  it('bonus শূন্য হলেও কাজ করে', () => {
    const r = { baseSalary: 15000, bonus: 0, deduction: 500 };
    expect(calcNet(r)).toBe(14500);
  });

  it('deduction শূন্য হলেও কাজ করে', () => {
    const r = { baseSalary: 18000, bonus: 1000, deduction: 0 };
    expect(calcNet(r)).toBe(19000);
  });

  it('সব শূন্য হলে net = 0', () => {
    const r = { baseSalary: 0, bonus: 0, deduction: 0 };
    expect(calcNet(r)).toBe(0);
  });

  it('string amount handle করে (DB থেকে string আসতে পারে)', () => {
    const r = { baseSalary: '20000', bonus: '2000', deduction: '500' };
    expect(calcNet(r)).toBe(21500);
  });

  it('undefined field হলে 0 ধরে (crash করে না)', () => {
    const r = { baseSalary: 10000 };
    expect(calcNet(r)).toBe(10000);
  });

  it('deduction > baseSalary+bonus হলে negative হতে পারে (edge case)', () => {
    const r = { baseSalary: 5000, bonus: 0, deduction: 6000 };
    expect(calcNet(r)).toBe(-1000);
  });

  it('decimal amount সঠিকভাবে handle করে', () => {
    const r = { baseSalary: 15000.50, bonus: 500.25, deduction: 200.75 };
    expect(calcNet(r)).toBeCloseTo(15300, 1);
  });
});

// ─────────────────────────────────────────────────────────

describe('Salary.monthLabel — Month Display', () => {
  it('2026-01 → "January 2026"', () => {
    expect(monthLabel('2026-01')).toBe('January 2026');
  });

  it('2026-06 → "June 2026"', () => {
    expect(monthLabel('2026-06')).toBe('June 2026');
  });

  it('2026-12 → "December 2026"', () => {
    expect(monthLabel('2026-12')).toBe('December 2026');
  });

  it('null দিলে "—" রিটার্ন করে', () => {
    expect(monthLabel(null)).toBe('—');
  });

  it('empty string দিলে "—" রিটার্ন করে', () => {
    expect(monthLabel('')).toBe('—');
  });
});
