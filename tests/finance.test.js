// tests/finance.test.js — Wings Fly Aviation Academy
// ─────────────────────────────────────────────────────────
// ⚠️ গুরুত্বপূর্ণ নোট:
//   finance.js এবং utils.js ব্রাউজার-global হিসেবে লেখা (const Finance = (() => {...})())
//   তাই এখানে সরাসরি import করা সম্ভব নয়।
//   বরং finance.js-এর pure logic গুলো এখানে হুবহু mirror করা হয়েছে।
//   মূল ফাইলে কোনো পরিবর্তন করা হয়নি।
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Mirror: finance.js → _balanceDir ────────────────────
// Source: js/modules/finance.js, line ~19
function _balanceDir(type) {
  if (type === 'Income' || type === 'Transfer In') return 'in';
  if (type === 'Expense' || type === 'Transfer Out' || type === 'Investment Out') return 'out';
  return null; // Loan types — loans.js হ্যান্ডেল করে
}

// ── Mirror: utils.js → safeNum ──────────────────────────
// Source: js/core/utils.js, line ~170
function safeNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Mirror: finance.js → running balance logic ──────────
// Source: js/modules/finance.js, line ~52-58
// DOM বা DB ছাড়াই pure function হিসেবে।
/**
 * @param {Array<{type: string, amount: number|string, date: string}>} transactions
 * @returns {{ rows: Array, totalIncome: number, totalExpense: number, net: number }}
 */
function calcRunningBalance(transactions) {
  // Date অনুযায়ী ascending sort করা (finance.js এর Utils.sortBy মিরর)
  const sorted = [...transactions].sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  let running = 0;
  const rows = sorted.map(f => {
    const amt = safeNum(f.amount);
    // finance.js এর running balance logic হুবহু (line 54-56)
    if (
      f.type === 'Income' ||
      f.type === 'Loan Receiving' ||
      f.type === 'Transfer In' ||
      f.type === 'Investment In'
    ) {
      running += amt;
    } else {
      running -= amt;
    }
    return { ...f, _running: running };
  });

  const totalIncome  = transactions
    .filter(f => f.type === 'Income')
    .reduce((s, f) => s + safeNum(f.amount), 0);

  const totalExpense = transactions
    .filter(f => f.type === 'Expense')
    .reduce((s, f) => s + safeNum(f.amount), 0);

  return {
    rows,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
  };
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('_balanceDir — Transaction type direction', () => {
  it('Income → "in" (balance বাড়ে)', () => {
    expect(_balanceDir('Income')).toBe('in');
  });

  it('Transfer In → "in" (balance বাড়ে)', () => {
    expect(_balanceDir('Transfer In')).toBe('in');
  });

  it('Expense → "out" (balance কমে)', () => {
    expect(_balanceDir('Expense')).toBe('out');
  });

  it('Transfer Out → "out" (balance কমে)', () => {
    expect(_balanceDir('Transfer Out')).toBe('out');
  });

  it('Investment Out → "out" (balance কমে)', () => {
    expect(_balanceDir('Investment Out')).toBe('out');
  });

  it('Loan Giving → null (loans.js হ্যান্ডেল করে)', () => {
    expect(_balanceDir('Loan Giving')).toBeNull();
  });

  it('Loan Receiving → null (loans.js হ্যান্ডেল করে)', () => {
    expect(_balanceDir('Loan Receiving')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────

describe('calcRunningBalance — Running Balance Logic', () => {
  it('শুধু Income থাকলে balance বাড়ে', () => {
    const txns = [
      { type: 'Income', amount: 5000, date: '2026-01-01' },
      { type: 'Income', amount: 3000, date: '2026-01-02' },
    ];
    const result = calcRunningBalance(txns);
    const lastRow = result.rows[result.rows.length - 1];
    expect(lastRow._running).toBe(8000);
  });

  it('Expense থাকলে balance কমে', () => {
    const txns = [
      { type: 'Income',  amount: 10000, date: '2026-01-01' },
      { type: 'Expense', amount: 3000,  date: '2026-01-02' },
    ];
    const result = calcRunningBalance(txns);
    const lastRow = result.rows[result.rows.length - 1];
    expect(lastRow._running).toBe(7000);
  });

  it('Mixed transactions — final running balance সঠিক', () => {
    const txns = [
      { type: 'Income',      amount: 20000, date: '2026-01-01' },
      { type: 'Expense',     amount: 5000,  date: '2026-01-02' },
      { type: 'Transfer In', amount: 2000,  date: '2026-01-03' },
      { type: 'Expense',     amount: 1000,  date: '2026-01-04' },
    ];
    const result = calcRunningBalance(txns);
    const lastRow = result.rows[result.rows.length - 1];
    // 20000 - 5000 + 2000 - 1000 = 16000
    expect(lastRow._running).toBe(16000);
  });

  it('totalIncome সঠিকভাবে ক্যালকুলেট হয়', () => {
    const txns = [
      { type: 'Income',  amount: 5000, date: '2026-01-01' },
      { type: 'Income',  amount: 3000, date: '2026-01-02' },
      { type: 'Expense', amount: 2000, date: '2026-01-03' },
    ];
    const { totalIncome } = calcRunningBalance(txns);
    expect(totalIncome).toBe(8000);
  });

  it('totalExpense সঠিকভাবে ক্যালকুলেট হয়', () => {
    const txns = [
      { type: 'Income',  amount: 10000, date: '2026-01-01' },
      { type: 'Expense', amount: 2000,  date: '2026-01-02' },
      { type: 'Expense', amount: 1500,  date: '2026-01-03' },
    ];
    const { totalExpense } = calcRunningBalance(txns);
    expect(totalExpense).toBe(3500);
  });

  it('net = Income − Expense', () => {
    const txns = [
      { type: 'Income',  amount: 10000, date: '2026-01-01' },
      { type: 'Expense', amount: 4000,  date: '2026-01-02' },
    ];
    const { net } = calcRunningBalance(txns);
    expect(net).toBe(6000);
  });

  it('Empty array দিলে সব 0', () => {
    const result = calcRunningBalance([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.net).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it('amount string হলেও সঠিকভাবে কাজ করে', () => {
    const txns = [
      { type: 'Income',  amount: '5000', date: '2026-01-01' },
      { type: 'Expense', amount: '1500', date: '2026-01-02' },
    ];
    const result = calcRunningBalance(txns);
    const lastRow = result.rows[result.rows.length - 1];
    expect(lastRow._running).toBe(3500);
  });
});
