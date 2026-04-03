/**
 * ════════════════════════════════════════════════════════════════
 * WINGS FLY AVIATION ACADEMY
 * FINANCE ENGINE FIXES — feSyncStudentPaid() Function
 * ════════════════════════════════════════════════════════════════
 *
 * ✅ Created: March 2026
 * ✅ Purpose: Fix student.paid vs finance entries mismatch
 * ✅ Fixes AI-identified bugs:
 *    1. Substring matching (Ali matching Alice)
 *    2. Double-counting when multiple names in description
 *
 * এই ফাইলটি finance-engine.js বা finance-crud.js এর পরে লোড করুন
 * অথবা সরাসরি সেই ফাইলে merge করুন
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Syncs student.paid from finance entries
 * 
 * Strategy:
 * 1. For each student, sum ALL finance entries where:
 *    - type is income-related (Registration, Income, Refund, etc.)
 *    - person field EXACTLY matches student name (case-insensitive)
 *    - OR description contains student name (with word boundaries)
 * 
 * 2. Fixes from original bugs:
 *    - Use EXACT match on person field first
 *    - Use word-boundary regex for description match (prevents "Ali" matching "Alice")
 *    - Only count description match if EXACTLY ONE student matches (prevents double-counting)
 */
window.feSyncStudentPaid = function feSyncStudentPaid() {
  const gd = window.globalData;
  if (!gd || !gd.students || !gd.finance) {
    console.warn('[feSyncStudentPaid] globalData not ready');
    return;
  }

  // Income-related transaction types
  const incomeTypes = [
    'Income',
    'Registration',
    'Refund',
    'Student Payment',
    'Course Fee',
    'Admission Fee'
  ];

  const students = gd.students.filter(s => !s._deleted);
  const finance = gd.finance.filter(f => !f._deleted && incomeTypes.includes(f.type));

  let syncCount = 0;
  
  students.forEach(student => {
    if (!student || !student.name) return;
    
    const studentName = student.name.trim();
    const studentNameLower = studentName.toLowerCase();
    
    // Calculate total paid for this student
    let totalPaid = 0;
    
    finance.forEach(entry => {
      const amount = parseFloat(entry.amount) || 0;
      const person = (entry.person || '').trim();
      const personLower = person.toLowerCase();
      const description = (entry.description || '').toLowerCase();
      
      // ✅ FIX 1: Exact match on person field (case-insensitive)
      if (personLower === studentNameLower) {
        totalPaid += amount;
        return; // Found exact match, skip other checks
      }
      
      // ✅ FIX 2: Fuzzy match with STRICT word boundary
      // This prevents "Ali" from matching "Alice" or "Alimuzzaman"
      // \b ensures word boundaries on both sides
      const namePattern = new RegExp(`\\b${studentNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      
      // Check if description contains the student name
      if (description && namePattern.test(description)) {
        // ✅ FIX 3: Count matches to prevent double-counting
        // Only credit this amount if EXACTLY ONE student matches this description
        const matchingStudents = students.filter(s => {
          const sNameLower = (s.name || '').toLowerCase();
          const sPattern = new RegExp(`\\b${sNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return sPattern.test(description);
        });
        
        // Only add if this is the ONLY student matching
        if (matchingStudents.length === 1 && matchingStudents[0].id === student.id) {
          totalPaid += amount;
        }
      }
    });
    
    // Update student.paid if changed
    const oldPaid = parseFloat(student.paid) || 0;
    if (Math.abs(oldPaid - totalPaid) > 0.01) {
      student.paid = totalPaid;
      
      // Recalculate due
      const totalPayment = parseFloat(student.totalPayment) || 0;
      student.due = Math.max(0, totalPayment - totalPaid);
      
      syncCount++;
    }
  });

  if (syncCount > 0) {
    console.log(`[feSyncStudentPaid] ✅ Synced ${syncCount} students`);
    
    // Save to storage
    if (typeof window.saveToStorage === 'function') {
      window.saveToStorage();
    }
    
    // Update UI if needed
    if (typeof window.updateGrandTotal === 'function') {
      window.updateGrandTotal();
    }
    if (typeof window.renderStudents === 'function') {
      window.renderStudents();
    }
  } else {
    console.log(`[feSyncStudentPaid] ℹ️ No changes needed`);
  }
  
  return syncCount;
};

console.log('✅ Finance Engine Fixes loaded — feSyncStudentPaid() available');
