# 🧪 MANUAL TEST SUITE - INSTALLMENT & RESTORATION
**Created**: May 5, 2026  
**Purpose**: Verify Finance → Accounts Tab, Multiple Installments, and RecycleBin Restoration

---

## 📋 PREREQUISITES

Before starting tests, ensure:
1. ✅ App is loaded and working
2. ✅ At least one student exists in the system
3. ✅ Student has no existing payment history (or use a new test student)
4. ✅ At least one payment method exists (Cash/Bank/Mobile)
5. ✅ Accounts tab shows at least one account with known balance

---

## 🧪 TEST #1: ACCOUNTS TAB WITH INSTALLMENTS

### Objective:
Verify that when you add multiple installments, the Accounts tab balance updates correctly.

### Setup:
- Target Student: **Ahmed (Student ID: WF-001)** ← Use your test student
- Total Fee: **25,000 টাকা**
- Payment Method: **Cash Account**
- Current Cash Balance: **Note this first** (e.g., 50,000)

### Test Steps:

#### Step 1.1: Record Initial State
1. Open **Finance** tab → Note current totals
   - [ ] Total Income: _______
   - [ ] Total Expense: _______
   
2. Open **Accounts** → Click "Cash"
   - [ ] Current Cash Balance: _______

#### Step 1.2: Add First Installment (5,000)
1. Go to **Students** → Select Ahmed
2. Click **Payment History & Installments** button
3. Add installment:
   - Amount: **5000**
   - Method: **Cash**
   - Date: **Today**
   - Note: "1st installment"
4. Click **SAVE INSTALLMENT**
5. Verify toast: "Payment saved ✓ ৳5,000"

#### Step 1.3: Check Accounts Tab Immediately
1. Go to **Accounts** tab
2. Click on **Cash** account
3. Check the balance:
   - [ ] Cash Balance should be: **Initial + 5000**
   - [ ] Example: 50000 + 5000 = **55000** ✅
4. Check history shows the payment
   - [ ] Transaction visible with +5000 ✅

#### Step 1.4: Add Second Installment (5,000)
1. Go back to **Students** → Ahmed
2. Click **Payment History & Installments**
3. Add second installment:
   - Amount: **5000**
   - Method: **Cash**
   - Date: **+1 day**
   - Note: "2nd installment"
4. Click **SAVE INSTALLMENT**

#### Step 1.5: Check Accounts Tab Again
1. Go to **Accounts** → **Cash**
2. Check balance:
   - [ ] Should be: **Initial + 5000 + 5000 = 60000** ✅
3. Check finance ledger shows 2 Income entries

#### Step 1.6: Add Two More Installments (5,000 each)
Repeat steps 1.4-1.5 for 3rd and 4th installments:
- 3rd: 5000 on Day+2
- 4th: 5000 on Day+3

#### Step 1.7: Final Accounts Check
1. Go to **Accounts** → **Cash**
2. Balance should be:
   - [ ] **Initial + 20000 = 70000** ✅
3. Finance tab shows 4 Income entries of 5000 each
4. Student shows: **Paid: 20000, Due: 5000**

### ✅ VERDICT for Test #1:
- [ ] All balances match across Accounts ↔ Finance ↔ Student
- [ ] No discrepancies detected
- [ ] **Status**: PASS ✅ / FAIL ❌

---

## 🧪 TEST #2: DELETE INSTALLMENT & RECALCULATION

### Objective:
Verify that deleting ANY installment correctly recalculates paid/due (not just simple subtraction).

### Setup:
- Use student from Test #1 (Ahmed with 4 installments = 20,000 paid)
- Starting state:
  - [ ] Paid: 20000
  - [ ] Due: 5000
  - [ ] Cash Balance: 70000

### Test Steps:

#### Step 2.1: Delete the 2nd Installment
1. Go to **Students** → Ahmed
2. Click **Payment History & Installments**
3. Find the 2nd installment (Date: +1 day, Amount: 5000)
4. Click the **Delete** button (trash icon)
5. Confirm: "Delete payment of ৳5,000?"
6. Verify toast: "Payment deleted ✓"

#### Step 2.2: Check Student Paid/Due Recalculation
1. Wait for modal to refresh (should auto-reload)
2. Check the summary:
   - **Expected**: 
     - [ ] Paid: **15000** (5+5+5, not 20-5=15)
     - [ ] Due: **10000** (25-15)
     - [ ] Remaining installments: **3** ✅

#### Step 2.3: Check Accounts Balance Reverse
1. Go to **Accounts** → **Cash**
2. Balance should be:
   - [ ] **70000 - 5000 = 65000** ✅

#### Step 2.4: Check Finance Ledger
1. Go to **Finance** tab
2. Filter by **Income** and **Cash**
3. Should see:
   - [ ] 3 entries of 5000 each ✅
   - [ ] 2nd payment is GONE ✅

#### Step 2.5: Delete 1st Installment (Edge Case)
1. Go to **Students** → Ahmed
2. Click **Payment History & Installments**
3. Delete the FIRST installment (chronologically oldest)
4. Check results:
   - [ ] Paid: **10000** (5+5, deleted 1st)
   - [ ] Due: **15000** (25-10)
   - [ ] Remaining: **2** ✅

#### Step 2.6: Delete Last Installment (Edge Case)
1. Delete the LAST (most recent) installment
2. Check results:
   - [ ] Paid: **5000** (only 1 left)
   - [ ] Due: **20000** (25-5)
   - [ ] Remaining: **1** ✅

### ✅ VERDICT for Test #2:
- [ ] Deletion of ANY installment recalculates correctly
- [ ] Subtraction works for #1, #2, #3, #4 positions
- [ ] No rounding errors
- [ ] Account balance reverses correctly
- [ ] **Status**: PASS ✅ / FAIL ❌

---

## 🧪 TEST #3: RECYCLE BIN RESTORATION (FREE)

### Objective:
Verify that deleted payments can be restored from RecycleBin with NO COST.

### Setup:
- Use student from Test #2 (Ahmed with 1 installment = 5000 paid, 20000 due)
- Current state:
  - [ ] Paid: 5000
  - [ ] Due: 20000
  - [ ] Cash Balance: 60000 (65000-5000 from previous delete)

### Test Steps:

#### Step 3.1: Verify Recycle Bin Has Deleted Items
1. Go to **Settings** (⚙️ icon)
2. Find **RECYCLE BIN** tab
3. Should see deleted payments:
   - [ ] 2nd installment: 5000 ✓
   - [ ] 1st installment: 5000 ✓
   - [ ] Last/4th installment: 5000 ✓
   - [ ] Total: 3 items ✅

#### Step 3.2: Restore 2nd Installment (Middle Payment)
1. In Recycle Bin, find 2nd installment
2. Click **Restore** button
3. Toast should show: "Payment restored ✓" (NO COST MESSAGE)
4. Item disappears from Recycle Bin

#### Step 3.3: Check Payment Fully Restored
1. Go to **Students** → Ahmed
2. Click **Payment History & Installments**
3. Should see:
   - [ ] Paid: **10000** (5+5, now 2 payments)
   - [ ] Due: **15000** (25-10)
   - [ ] Installments count: **2** ✅

#### Step 3.4: Check Account Balance Fully Restored
1. Go to **Accounts** → **Cash**
2. Balance should be:
   - [ ] **65000** (60000+5000 restored, NO DEDUCTION) ✅

#### Step 3.5: Check Finance Ledger Shows Restored Payment
1. Go to **Finance** tab
2. Should see the restored income entry back in the ledger ✅

#### Step 3.6: Restore All Remaining Deleted Items
1. Go to Settings → Recycle Bin
2. Restore the 1st installment
   - [ ] Paid: 15000 ✅
   - [ ] Due: 10000 ✅
3. Restore the last/4th installment
   - [ ] Paid: 20000 ✅
   - [ ] Due: 5000 ✅
4. Cash Balance: **70000** ✅

#### Step 3.7: Verify All Restored to Original State
1. Check Ahmed's Payment Modal:
   - [ ] Shows 4 installments in history ✅
   - [ ] All dates, amounts match original ✅
2. Check Accounts:
   - [ ] Cash = 70000 ✅
3. Check Finance:
   - [ ] 4 Income entries, 5000 each ✅
4. Recycle Bin:
   - [ ] Is EMPTY ✅

### ✅ VERDICT for Test #3:
- [ ] Restoration works perfectly
- [ ] Account balance restored WITHOUT any fee/deduction
- [ ] Student paid/due recalculated correctly
- [ ] Finance entries restored
- [ ] NO hidden costs
- [ ] **Status**: PASS ✅ / FAIL ❌

---

## 🧪 TEST #4: RESTORE WITH DIFFERENT ACCOUNTS (Multi-Account Scenario)

### Objective:
Verify restoration works correctly when payments use different account methods.

### Setup:
- Student: New test student (e.g., "Fatima")
- Total Fee: 20000
- Add installments with MIXED methods:
  - Payment 1: 5000 via **Cash**
  - Payment 2: 5000 via **Bank**
  - Payment 3: 5000 via **Mobile**
  - Payment 4: 5000 via **Cash**

### Test Steps:

#### Step 4.1: Record Initial Balances
- [ ] Cash: _______
- [ ] Bank: _______
- [ ] Mobile: _______

#### Step 4.2: Add 4 Mixed Installments
1. Payment 1: 5000 → Cash ✓
2. Payment 2: 5000 → Bank ✓
3. Payment 3: 5000 → Mobile ✓
4. Payment 4: 5000 → Cash ✓

#### Step 4.3: Check Each Account Updated
- [ ] Cash: Initial + 10000 (2 payments)
- [ ] Bank: Initial + 5000
- [ ] Mobile: Initial + 5000

#### Step 4.4: Delete Payment 2 (Bank payment)
1. Delete the Bank payment (5000)
2. Check:
   - [ ] Bank Balance: Restored to initial ✓
   - [ ] Cash/Mobile: Unchanged ✓
   - [ ] Student Paid: 15000 ✓

#### Step 4.5: Restore Payment 2 (From Different Account)
1. Go to Recycle Bin → Restore Bank payment
2. Check:
   - [ ] Bank Balance: Back to Initial + 5000 ✓
   - [ ] NO deduction from other accounts ✓
   - [ ] Student Paid: 20000 ✓

### ✅ VERDICT for Test #4:
- [ ] Multi-account restoration works correctly
- [ ] Each account balance managed independently
- [ ] Restoration is FREE across all accounts
- [ ] **Status**: PASS ✅ / FAIL ❌

---

## 📊 TEST SUMMARY

### All Tests Status:
| Test | Objective | Result |
|------|-----------|--------|
| #1 | Accounts Tab with Installments | PASS 🟢 / FAIL 🔴 |
| #2 | Delete Installment & Recalculation | PASS 🟢 / FAIL 🔴 |
| #3 | RecycleBin Free Restoration | PASS 🟢 / FAIL 🔴 |
| #4 | Multi-Account Restoration | PASS 🟢 / FAIL 🔴 |

### Overall Result:
- [ ] **ALL PASS** ✅ → System ready for production
- [ ] **SOME FAIL** ⚠️ → Issues need fixing
- [ ] **ALL FAIL** ❌ → Critical problems

### Issues Found (if any):
```
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________
```

### Recommendations:
```
1. _____________________________________________
2. _____________________________________________
```

---

## 🎯 FINAL CHECKLIST

Before signing off, verify:
- [ ] All 4 tests completed
- [ ] All balances reconcile
- [ ] No orphaned data
- [ ] RecycleBin cleanup working
- [ ] No performance issues
- [ ] All calculations accurate to 0.01

**Tested By**: ________________  
**Date**: ________________  
**Signature**: ________________  

---

**Note**: Save this document with your test results for audit trail purposes.
