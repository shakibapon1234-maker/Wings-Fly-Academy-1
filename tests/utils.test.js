import { describe, it, expect } from 'vitest';

// Mirrors js/core/utils.js esc + safeNum for regression tests
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

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcStudentDue(totalFee, paid) {
  return Math.max(0, safeNum(totalFee) - safeNum(paid));
}

describe('Utils.esc', () => {
  it('escapes HTML/script injection', () => {
    expect(esc('<script>alert(1)</script>')).not.toContain('<script>');
    expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });
});

describe('payment due calculation', () => {
  it('computes outstanding due', () => {
    expect(calcStudentDue(10000, 4000)).toBe(6000);
    expect(calcStudentDue(5000, 5000)).toBe(0);
    expect(calcStudentDue('8000', '2000')).toBe(6000);
  });
});
