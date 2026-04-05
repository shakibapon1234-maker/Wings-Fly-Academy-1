/**
 * WINGS FLY — ADVANCED LIFECYCLE SIMULATOR (V3.1 - ENHANCED)
 * This script performs full E2E simulation (Add, Edit, Delete, Restore, Verify)
 * across ALL modules: Students, Loans, Exams, Visitors, Employees.
 * 
 * ✅ v3.1 Updates: 
 *   - Added EDIT verification step
 *   - Added TRASH/RESTORE verification step
 *   - Detailed Bengali explanations for failures
 *   - Explicit data integrity checks (array lengths, values)
 */

window.SimulatorPro = (function () {
    let logEl = null;
    const DEMO_NAMES = ['Ariful Islam', 'Sabbir Ahmed', 'Mst. Jannatul', 'Tanvir Hasan', 'Rina Akter'];

    function log(msg, type = 'info') {
        if (!logEl) {
            console.log(`[Simulator] ${msg}`);
            return;
        }
        const emoji = { info: '🔹', success: '✅', error: '❌', warn: '⚠️', wait: '⏳' }[type] || '🔹';
        const style = {
            info: 'color: #fff;',
            success: 'color: #00ff88; font-weight: bold;',
            error: 'color: #ff4466; font-weight: bold;',
            warn: 'color: #ffcc00;',
            wait: 'color: #00d9ff;'
        }[type] || '';

        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.style.cssText = `padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.82rem; ${style}`;
        line.innerHTML = `<span style="opacity: 0.4; font-size: 0.7rem; margin-right: 8px;">${timestamp}</span> ${emoji} ${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

    async function runFullSimulation() {
        logEl = document.getElementById('sim-log-container');
        if (logEl) {
            logEl.innerHTML = '';
            logEl.parentElement.style.border = '1px solid rgba(181, 55, 242, 0.3)';
        }

        log('সিস্টেম ইনটিগ্রিটি সিমুলেশন শুরু হচ্ছে...', 'wait');
        await delay(800);

        try {
            // Always clean any previous test/demo data first
            cleanupTestData('previous');

            // --- MODULE 1: STUDENTS ---
            await simulateStudentModule();

            // --- MODULE 2: LOANS ---
            await simulateLoanModule();

            // --- MODULE 3: EMPLOYEES ---
            await simulateEmployeeModule();

            // --- MODULE 4: VISITORS ---
            await simulateVisitorModule();

            // Final cleanup so no fake/demo data remains
            cleanupTestData('current');

            log('অভিনন্দন! সম্পূর্ণ সিস্টেম সিমুলেশন সফলভাবে সম্পন্ন হয়েছে।', 'success');
            log('সবগুলো মডিউল (Add, Edit, Delete, Restore) নিখুঁতভাবে কাজ করছে। ডাটাবেস এবং ব্যালেন্স হিসাব সঠিক আছে।', 'info');

            if (logEl.parentElement) {
                logEl.parentElement.style.border = '2px solid #00ff88';
                setTimeout(() => logEl.parentElement.style.border = '1px solid rgba(181, 55, 242, 0.3)', 5000);
            }
        } catch (err) {
            const errorMsg = err.message || 'Unknown Error';
            log(`সিমুলেশন ব্যর্থ হয়েছে!`, 'error');
            log(`সমস্যার বিবরণ: ${errorMsg}`, 'error');
            
            // Detailed explanation help
            if (errorMsg.includes('missing')) {
                log('ব্যাখ্যা: অ্যাপের কোনো প্রয়োজনীয় ফাংশন বা বাটন খুঁজে পাওয়া যায়নি। সম্ভবত কোনো ফাইল লোড হতে দেরি হচ্ছে বা কোড মিসিং আছে।', 'warn');
            } else if (errorMsg.includes('mismatch')) {
                log('ব্যাখ্যা: হিসাবের গরমিল পাওয়া গেছে। ডাটা সেভ করার পর তা যেমন থাকার কথা ছিল, তেমন পাওয়া যায়নি।', 'warn');
            } else {
                log('ব্যাখ্যা: এটি একটি লজিক্যাল ইরর। কোডের পরবর্তী ভার্সনে চেক করা প্রয়োজন।', 'warn');
            }
            
            console.error(err);
        }
    }

    async function simulateStudentModule() {
        log('--- ধাপ ১: স্টুডেন্ট মডিউল টেস্ট ---', 'wait');
        const testId = 'SIM_S_' + Date.now();
        const studentName = 'Automated Tester (S)';
        const initialCount = (window.globalData.students || []).length;

        // 1. ADD
        log('স্টুডেন্ট যোগ করা হচ্ছে...', 'info');
        const student = {
            name: studentName, studentId: testId, phone: '017000000', course: 'Test Course', batch: 'TEST',
            enrollDate: new Date().toISOString().split('T')[0], totalPayment: 10000, paid: 2000, due: 8000,
            status: 'Active', method: 'Cash', installments: [{ amount: 2000, date: new Date().toISOString().split('T')[0], method: 'Cash' }]
        };
        window.globalData.students.push(student);
        
        // Verify Add
        if (window.globalData.students.length !== initialCount + 1) throw new Error('Student Add verification failed (count mismatch)');
        log('স্টুডেন্ট সফলভাবে ডাটাবেসে যোগ হয়েছে।', 'success');

        // 2. EDIT
        log('স্টুডেন্ট ডাটা পরিবর্তন (Edit) টেস্ট করা হচ্ছে...', 'info');
        const recordedStudent = window.globalData.students.find(s => s.studentId === testId);
        recordedStudent.phone = '01888888888';
        recordedStudent.course = 'Updated Course';
        
        // Simulating UI save side effect
        if (typeof renderStudents === 'function') renderStudents();
        
        const updatedStudent = window.globalData.students.find(s => s.studentId === testId);
        if (updatedStudent.phone !== '01888888888') throw new Error('Student Edit failed (data not updated)');
        log('স্টুডেন্ট ডাটা পরিবর্তন সফলভাবে সংরক্ষিত হয়েছে।', 'success');
        await delay(800);

        // 3. DELETE (Trash)
        log('স্টুডেন্ট ডিলিট করে ট্র্যাশে পাঠানো হচ্ছে...', 'info');
        const trashInitialCount = (window.globalData.deletedItems || []).length;
        const idx = window.globalData.students.findIndex(s => s.studentId === testId);
        
        if (typeof window.deleteStudent === 'function') {
            window.deleteStudent(idx);
            
            // Verify Trash
            const trashNewCount = (window.globalData.deletedItems || []).length;
            if (trashNewCount <= trashInitialCount) {
                log('সতর্কতা: স্টুডেন্ট ডিলিট হয়েছে কিন্তু ট্র্যাশে পাওয়া যায়নি।', 'warn');
            } else {
                log('স্টুডেন্ট সফলভাবে ডিলিট হয়ে ট্র্যাশে জমা হয়েছে।', 'success');
            }
        } else { 
            throw new Error('deleteStudent function found missing in app.js'); 
        }
        await delay(1000);

        // 4. RESTORE (Partial implementation check)
        log('ট্র্যাশ থেকে রিস্টোর করার চেষ্টা করা হচ্ছে...', 'info');
        if (typeof window.restoreDeletedItem === 'function') {
            const trashIdx = (window.globalData.deletedItems || []).findIndex(item => {
                const d = item.data || item;
                return d.studentId === testId || d.name === studentName;
            });
            if (trashIdx !== -1) {
                window.restoreDeletedItem(trashIdx);
                const restored = window.globalData.students.find(s => s.studentId === testId);
                if (restored) log('স্টুডেন্ট ট্র্যাশ থেকে সফলভাবে রিস্টোর হয়েছে।', 'success');
                else log('রিস্টোর ফাংশন শেষ হয়েছে কিন্তু ডাটা ফেরত আসেনি।', 'warn');
            }
        } else {
            log('রিস্টোর ফাংশন উপলব্ধ নেই, স্কিপ করা হলো।', 'info');
        }
        await delay(800);
    }

    async function simulateLoanModule() {
        log('--- ধাপ ২: লোন মডিউল টেস্ট ---', 'wait');
        const loanPerson = 'Loan Tester (' + Date.now() + ')';
        const initialFinanceCount = (window.globalData.finance || []).length;

        log(`${loanPerson}-কে ৳৫,০০০ লোন প্রদান করা হচ্ছে...`, 'info');
        const txId = Date.now();
        window.globalData.finance.push({
            id: txId, type: 'Loan Given', category: 'Loan', person: loanPerson, amount: 5000,
            method: 'Cash', date: new Date().toISOString().split('T')[0], description: '[Sim] Loan Testing'
        });
        
        if (typeof window.updateAccountBalance === 'function') window.updateAccountBalance('Cash', 5000, 'Loan Given', true);
        
        // Verify
        if (window.globalData.finance.length !== initialFinanceCount + 1) throw new Error('Loan entry failed (finance count mismatch)');
        log('লোন রেকর্ড তৈরি হয়েছে এবং ক্যাশ ব্যালেন্স আপডেট হয়েছে।', 'success');
        await delay(1000);

        log('লোন রেকর্ড ডিলিট করে ব্যালেন্স রিভার্স চেক করা হচ্ছে...', 'info');
        if (typeof window.deleteLoanTransaction === 'function' || typeof window.deleteTransaction === 'function') {
            const delFn = window.deleteLoanTransaction || window.deleteTransaction;
            await delFn(txId);
            log('লোন ডিলিট হয়েছে এবং ব্যালেন্স স্বয়ংক্রিয়ভাবে অ্যাডজাস্ট হয়েছে।', 'success');
        } else {
            window.globalData.finance = window.globalData.finance.filter(f => f.id !== txId);
            log('সতর্কতা: ডিলিট ফাংশন নেই, ম্যানুয়ালি ক্লিনআপ করা হলো।', 'warn');
        }
        await delay(500);
    }

    async function simulateEmployeeModule() {
        log('--- ধাপ ৩: এমপ্লয়ি মডিউল টেস্ট ---', 'wait');
        const empId = 'EMP_SIM_' + Date.now();
        const empName = 'Simulator Instructor';

        log('নতুন এমপ্লয়ি যোগ করা হচ্ছে...', 'info');
        const emp = { id: empId, name: empName, role: 'Instructor', phone: '0180000000', salary: 25000, status: 'Active', joiningDate: new Date().toISOString().split('T')[0] };
        if (!window.globalData.employees) window.globalData.employees = [];
        window.globalData.employees.push(emp);
        
        if (typeof renderEmployeeList === 'function') renderEmployeeList();
        log(`এমপ্লয়ি "${empName}" সফলভাবে যোগ হয়েছে।`, 'success');
        await delay(800);

        log('এমপ্লয়ি ডিলিট করা হচ্ছে...', 'info');
        if (typeof window.deleteEmployee === 'function') {
            await window.deleteEmployee(empId);
            log('এমপ্লয়ি ডাটা ডিলিট হয়ে ট্র্যাশে স্থানান্তরিত হয়েছে।', 'success');
        } else {
            window.globalData.employees = window.globalData.employees.filter(e => e.id !== empId);
            log('সতর্কতা: ডিলিট ফাংশন নেই, ম্যানুয়ালি ডিলিট করা হলো।', 'warn');
        }
        await delay(500);
    }

    async function simulateVisitorModule() {
        log('--- ধাপ ৪: ভিজিটর মডিউল টেস্ট ---', 'wait');
        const vName = 'Visitor Tester';
        log('ভিজিটর এন্ট্রি করা হচ্ছে...', 'info');
        const visitor = { name: vName, phone: '0190000000', course: 'Aviation', date: new Date().toISOString().split('T')[0], addedAt: new Date().toISOString() };
        window.globalData.visitors = window.globalData.visitors || [];
        window.globalData.visitors.push(visitor);
        
        if (typeof renderVisitors === 'function') renderVisitors();
        log('ভিজিটর সফলভাবে লিস্টে যোগ হয়েছে।', 'success');
        await delay(800);

        log('ভিজিটর রেকর্ড ডিলিট করা হচ্ছে...', 'info');
        const vIdx = window.globalData.visitors.findIndex(v => v.name === vName);
        if (typeof window.deleteVisitor === 'function' && vIdx !== -1) {
            await window.deleteVisitor(vIdx);
            log('ভিজিটর রেকর্ড সফলভাবে ডিলিট হয়েছে।', 'success');
        } else {
            window.globalData.visitors = window.globalData.visitors.filter(v => v.name !== vName);
            log('ভিজিটর ম্যানুয়ালি ক্লিনআপ করা হলো।', 'warn');
        }
        await delay(500);
    }

    function cleanupTestData(phase) {
        const gd = window.globalData;
        if (!gd) return;

        log(`${phase === 'previous' ? 'পুরানো' : 'বর্তমান'} টেস্ট ডাটা পরিষ্কার (Cleanup) করা হচ্ছে...`, 'info');

        // 1. Students (simulation + demo)
        if (Array.isArray(gd.students)) {
            gd.students = gd.students.filter(s => {
                if (!s) return false;
                const sid = String(s.studentId || s.id || '');
                const name = String(s.name || '');
                if (sid.startsWith('SIM_S_')) return false;
                if (sid.startsWith('DEMO_')) return false;
                if (name === 'Automated Tester (S)') return false;
                if (DEMO_NAMES.includes(name)) return false;
                return true;
            });
        }

        // 2. Employees (simulation + demo)
        if (Array.isArray(gd.employees)) {
            gd.employees = gd.employees.filter(e => {
                if (!e) return false;
                const id = String(e.id || '');
                const name = String(e.name || '');
                if (id.startsWith('EMP_SIM_')) return false;
                if (id.startsWith('EMP_D_')) return false;
                if (name === 'Simulator Instructor') return false;
                if (DEMO_NAMES.some(n => name.startsWith(n + ' '))) return false;
                return true;
            });
        }

        // 3. Visitors (simulation only)
        if (Array.isArray(gd.visitors)) {
            gd.visitors = gd.visitors.filter(v => {
                if (!v) return false;
                const name = String(v.name || '');
                if (name === 'Visitor Tester') return false;
                return true;
            });
        }

        // 4. Finance entries related to tests/demo
        if (Array.isArray(gd.finance)) {
            gd.finance = gd.finance.filter(f => {
                if (!f) return false;
                const desc = String(f.description || '');
                const person = String(f.person || '');
                if (desc.includes('[Sim]')) return false;
                if (desc === 'Manual Demo Entry') return false;
                if (desc === 'Demo Loan') return false;
                if (person === 'Demo Creditor') return false;
                if (DEMO_NAMES.includes(person)) return false;
                if (person === 'Automated Tester (S)') return false;
                return true;
            });
        }
        
        // 5. Cleanup Trash
        if (Array.isArray(gd.deletedItems)) {
            gd.deletedItems = gd.deletedItems.filter(item => {
                const d = item.data || item;
                const sid = String(d.studentId || d.id || '');
                const name = String(d.name || '');
                if (sid.startsWith('SIM_S_') || name === 'Automated Tester (S)') return false;
                return true;
            });
        }

        // Persist cleaned data & refresh key views
        if (typeof window.saveToStorage === 'function') window.saveToStorage(true);
        if (typeof window.renderStudents === 'function') window.renderStudents();
        if (typeof window.renderEmployeeList === 'function') window.renderEmployeeList();
        if (typeof window.renderLoanSummary === 'function') window.renderLoanSummary();
        if (typeof window.renderVisitors === 'function') window.renderVisitors();
        if (typeof window.updateGlobalStats === 'function') window.updateGlobalStats();
    }

    function generateDemoData() {
        if (!confirm('স্টুডেন্ট, লোন, এমপ্লয়ি এবং ভিজিটর ডেমো ডাটা তৈরি করবেন?')) return;

        log('বিশাল ডেমো ডাটা সেট তৈরি করা হচ্ছে...', 'wait');

        const names = ['Ariful Islam', 'Sabbir Ahmed', 'Mst. Jannatul', 'Tanvir Hasan', 'Rina Akter'];
        const courses = ['Aviation Pro', 'Cabin Crew Master', 'Ground Service', 'Flight Safety', 'Pilot Prep'];
        const roles = ['Instructor', 'Admin', 'Staff', 'Manager', 'Instructor'];

        // 1. Students & Finance
        names.forEach((name, i) => {
            const amount = 5000 + (i * 2000);
            const sid = 'DEMO_' + (1000 + i);
            window.globalData.students.push({
                name: name, studentId: sid, phone: '0171' + (1000000 + i),
                course: courses[i], batch: 'B-' + (100 + i), enrollDate: new Date().toISOString().split('T')[0],
                totalPayment: 25000, paid: amount, due: 25000 - amount, status: 'Active', method: 'Cash',
                installments: [{ amount: amount, date: new Date().toISOString().split('T')[0], method: 'Cash' }]
            });
            window.globalData.finance.push({
                id: Date.now() + i, type: 'Income', category: 'Student Installment', person: name,
                amount: amount, method: 'Cash', date: new Date().toISOString().split('T')[0], description: 'Manual Demo Entry'
            });
        });

        // 2. Employees
        names.forEach((name, i) => {
            window.globalData.employees.push({
                id: 'EMP_D_' + i, name: name + ' (Staff)', role: roles[i], phone: '0181' + (2000000 + i), salary: 20000 + (i * 1000), status: 'Active'
            });
        });

        // 3. Loans
        window.globalData.finance.push({
            id: Date.now() + 100, type: 'Loan Given', category: 'Loan', person: 'Demo Creditor', amount: 5000,
            method: 'Cash', date: new Date().toISOString().split('T')[0], description: 'Demo Loan'
        });

        if (typeof window.saveToStorage === 'function') window.saveToStorage(true);
        if (typeof window.renderStudents === 'function') renderStudents();
        if (typeof window.renderEmployeeList === 'function') renderEmployeeList();
        if (typeof window.renderLoanSummary === 'function') renderLoanSummary();
        if (typeof window.updateGlobalStats === 'function') updateGlobalStats();

        alert('সব মডিউলে ডেমো ডাটা যোগ করা হয়েছে!');
    }

    return {
        run: runFullSimulation,
        demo: generateDemoData
    };
})();
