// tests/loans.test.js — Wings Fly Aviation Academy
// ─────────────────────────────────────────────────────────
// loans.js ব্রাউজার-global (IIFE) তাই সরাসরি import নেই।
// প্রতিটি pure function এখানে হুবহু mirror করা হয়েছে।
// মূল ফাইলে কোনো পরিবর্তন করা হয়নি।
// ─────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Mirror: utils.js → safeNum ──────────────────────────
function safeNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Mirror: loans.js → _matchesLoanFinance ──────────────
// Source: js/modules/loans.js line ~9
// Finance ledger entry এবং loan record match করে কিনা
function _matchesLoanFinance(f, loan) {
  if (!f || f.category !== 'Loan') return false;
  if (!loan) return false;
  if (loan.id && f.ref_id === loan.id) return true;
  const person = loan.person_name || loan.person || '';
  return (f.person_name === person) &&
    f.type === loan.type &&
    Math.abs(safeNum(f.amount) - safeNum(loan.amount)) < 0.01 &&
    f.date === loan.date;
}

// ── Mirror: loans.js → person-wise summary logic ────────
// Source: js/modules/loans.js line ~44
function calcPersonSummary(loans) {
  const personMap = {};
  loans.forEach(l => {
    const p = l.person_name || l.person || 'UnknownNo';
    if (!personMap[p]) personMap[p] = { given: 0, received: 0 };
    if (l.type === 'Loan Giving' || l.direction === 'given')
      personMap[p].given += safeNum(l.amount);
    if (l.type === 'Loan Receiving' || l.direction === 'received')
      personMap[p].received += safeNum(l.amount);
  });

  const totalGiven    = loans.filter(l => l.type === 'Loan Giving'    || l.direction === 'given')
                             .reduce((s, l) => s + safeNum(l.amount), 0);
  const totalReceived = loans.filter(l => l.type === 'Loan Receiving' || l.direction === 'received')
                             .reduce((s, l) => s + safeNum(l.amount), 0);
  const netOwed = totalGiven - totalReceived; // positive = অন্যরা আমাদের কাছে ঋণী

  return { personMap, totalGiven, totalReceived, netOwed };
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('Loans._matchesLoanFinance — Finance Entry Matching', () => {

  it('ref_id দিয়ে exact match কাজ করে', () => {
    const finance = { category: 'Loan', ref_id: 'loan-abc-123', person_name: 'Karim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    const loan    = { id: 'loan-abc-123', person_name: 'Karim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(true);
  });

  it('ref_id না থাকলে person+type+amount+date দিয়ে match করে', () => {
    const finance = { category: 'Loan', person_name: 'Rahim', type: 'Loan Receiving', amount: 10000, date: '2026-02-01' };
    const loan    = { person_name: 'Rahim', type: 'Loan Receiving', amount: 10000, date: '2026-02-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(true);
  });

  it('category "Loan" না হলে false রিটার্ন করে', () => {
    const finance = { category: 'Income', ref_id: 'loan-abc', person_name: 'Karim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    const loan    = { id: 'loan-abc', person_name: 'Karim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(false);
  });

  it('person_name আলাদা হলে false রিটার্ন করে', () => {
    const finance = { category: 'Loan', person_name: 'Rahim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    const loan    = { person_name: 'Karim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(false);
  });

  it('amount 0.01 এর কম পার্থক্যে match করে (floating point tolerance)', () => {
    const finance = { category: 'Loan', person_name: 'Sumon', type: 'Loan Giving', amount: 5000.005, date: '2026-01-01' };
    const loan    = { person_name: 'Sumon', type: 'Loan Giving', amount: 5000.009, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(true);
  });

  it('amount পার্থক্য 0.01 বা বেশি হলে false', () => {
    const finance = { category: 'Loan', person_name: 'Sumon', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    const loan    = { person_name: 'Sumon', type: 'Loan Giving', amount: 5001, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(false);
  });

  it('date আলাদা হলে false রিটার্ন করে', () => {
    const finance = { category: 'Loan', person_name: 'Rahim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    const loan    = { person_name: 'Rahim', type: 'Loan Giving', amount: 5000, date: '2026-01-02' };
    expect(_matchesLoanFinance(finance, loan)).toBe(false);
  });

  it('f = null দিলে false (crash করে না)', () => {
    const loan = { id: 'loan-1', person_name: 'Rahim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    expect(_matchesLoanFinance(null, loan)).toBe(false);
  });

  it('loan = null দিলে false (crash করে না)', () => {
    const finance = { category: 'Loan', ref_id: 'loan-1', person_name: 'Rahim', type: 'Loan Giving', amount: 5000, date: '2026-01-01' };
    expect(_matchesLoanFinance(finance, null)).toBe(false);
  });

  it('person field (legacy) দিয়েও match কাজ করে', () => {
    const finance = { category: 'Loan', person_name: 'Karim', type: 'Loan Giving', amount: 3000, date: '2026-03-01' };
    const loan    = { person: 'Karim', type: 'Loan Giving', amount: 3000, date: '2026-03-01' };
    expect(_matchesLoanFinance(finance, loan)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────

describe('Loans.calcPersonSummary — Person-wise Loan Summary', () => {

  it('Loan Giving সঠিকভাবে given-এ যোগ হয়', () => {
    const loans = [
      { person_name: 'Rahim', type: 'Loan Giving', amount: 5000 },
      { person_name: 'Rahim', type: 'Loan Giving', amount: 3000 },
    ];
    const { personMap } = calcPersonSummary(loans);
    expect(personMap['Rahim'].given).toBe(8000);
  });

  it('Loan Receiving সঠিকভাবে received-এ যোগ হয়', () => {
    const loans = [
      { person_name: 'Karim', type: 'Loan Receiving', amount: 10000 },
    ];
    const { personMap } = calcPersonSummary(loans);
    expect(personMap['Karim'].received).toBe(10000);
  });

  it('totalGiven সঠিক', () => {
    const loans = [
      { person_name: 'A', type: 'Loan Giving', amount: 5000 },
      { person_name: 'B', type: 'Loan Giving', amount: 3000 },
      { person_name: 'C', type: 'Loan Receiving', amount: 2000 },
    ];
    const { totalGiven } = calcPersonSummary(loans);
    expect(totalGiven).toBe(8000);
  });

  it('totalReceived সঠিক', () => {
    const loans = [
      { person_name: 'A', type: 'Loan Giving', amount: 5000 },
      { person_name: 'B', type: 'Loan Receiving', amount: 2000 },
      { person_name: 'C', type: 'Loan Receiving', amount: 1000 },
    ];
    const { totalReceived } = calcPersonSummary(loans);
    expect(totalReceived).toBe(3000);
  });

  it('netOwed = totalGiven - totalReceived', () => {
    const loans = [
      { person_name: 'A', type: 'Loan Giving',    amount: 10000 },
      { person_name: 'B', type: 'Loan Receiving', amount: 4000  },
    ];
    const { netOwed } = calcPersonSummary(loans);
    expect(netOwed).toBe(6000);
  });

  it('empty array দিলে সব 0 (crash করে না)', () => {
    const { totalGiven, totalReceived, netOwed } = calcPersonSummary([]);
    expect(totalGiven).toBe(0);
    expect(totalReceived).toBe(0);
    expect(netOwed).toBe(0);
  });

  it('direction:"given" legacy field সঠিকভাবে গণনায় আসে', () => {
    const loans = [
      { person_name: 'Sumon', direction: 'given', amount: 7000 },
    ];
    const { totalGiven } = calcPersonSummary(loans);
    expect(totalGiven).toBe(7000);
  });
});
