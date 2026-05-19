// js/core/types.js — Wings Fly Aviation Academy
// ⚠️ এই ফাইলটি ব্রাউজারে লোড করার দরকার নেই।
// এটি শুধু VS Code-এ Auto-complete ও Type-checking এর জন্য।
// কোনো runtime code নেই, তাই অ্যাপের উপর কোনো প্রভাব নেই।

/**
 * একটি Finance Ledger Transaction-এর ডেটা স্ট্রাকচার।
 *
 * @typedef {Object} Transaction
 * @property {string} id              - Unique identifier (UUID)
 * @property {string} date            - ISO date string, e.g. "2026-05-01"
 * @property {'Income'|'Expense'|'Loan Giving'|'Loan Receiving'|'Transfer In'|'Transfer Out'|'Investment Out'|'Investment In'} type - Transaction type
 * @property {number} amount          - Amount in BDT
 * @property {string} method          - Payment method, e.g. "Cash", "bKash"
 * @property {string} [description]   - Optional note or description
 */

/**
 * একটি Student-এর ফি সংক্রান্ত তথ্য।
 *
 * @typedef {Object} Student
 * @property {string} id              - Unique identifier
 * @property {string} name            - Student full name
 * @property {number} total_fee       - Total course fee
 * @property {number} paid            - Amount paid so far
 * @property {number} due             - Remaining due (total_fee - paid)
 */

/**
 * Running Balance ক্যালকুলেশনের ফলাফল।
 *
 * @typedef {Object} RunningBalanceResult
 * @property {Transaction[]} rows     - প্রতিটি transaction (running balance সহ)
 * @property {number} totalIncome     - সব Income-এর যোগফল
 * @property {number} totalExpense    - সব Expense-এর যোগফল
 * @property {number} net             - Income − Expense
 */
