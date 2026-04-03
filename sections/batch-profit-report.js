/**
 * Batch-wise Profit & Loss Report System
 * Logic for calculating income from students in a specific batch
 * and expenses within a custom date range.
 */

function populateBatchReportDropdowns() {
    const batchSelect = document.getElementById('repBatchSelect');
    if (!batchSelect) return;

    const students = window.globalData.students || [];
    const batches = [...new Set(students.map(s => s.batch).filter(b => b))];

    // Also check courses for batch names if students don't have them yet
    const courses = window.globalData.courses || [];
    courses.forEach(c => {
        if (!batches.includes(c)) batches.push(c);
    });

    // Clear and refill
    batchSelect.innerHTML = '<option value="">Choose Batch...</option>';
    batches.sort().forEach(batch => {
        const opt = document.createElement('option');
        opt.value = batch;
        opt.textContent = batch;
        batchSelect.appendChild(opt);
    });

    // Set default dates to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    document.getElementById('repStartDate').value = firstDay;
    document.getElementById('repEndDate').value = lastDay;
}

// Global variable to store last generated report details for printing
window._lastProfitReport = null;

function generateBatchProfitReport() {
    const batch = document.getElementById('repBatchSelect').value;
    const startDate = document.getElementById('repStartDate').value;
    const endDate = document.getElementById('repEndDate').value;
    const manualAdj = parseFloat(document.getElementById('repPrevManual').value) || 0;

    if (!batch) {
        if (typeof showErrorToast === 'function') showErrorToast('Please select a batch');
        else alert('Please select a batch');
        return;
    }

    if (!startDate || !endDate) {
        if (typeof showErrorToast === 'function') showErrorToast('Please select date range');
        else alert('Please select date range');
        return;
    }

    // 1. Calculate Batch Income (All time collection for students in this batch)
    const students = window.globalData.students || [];
    const batchStudents = students.filter(s => s.batch === batch);
    const totalBatchIncome = batchStudents.reduce((sum, s) => sum + (parseFloat(s.paid) || 0), 0);

    // 2. Calculate Expenses in Date Range
    const finance = window.globalData.finance || [];
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);

    let periodExpense = 0;
    const periodExpenseList = [];

    finance.forEach(f => {
        if (f.type === 'Expense') {
            const fDate = new Date(f.date);
            if (fDate >= startObj && fDate <= endObj) {
                periodExpense += (parseFloat(f.amount) || 0);
                periodExpenseList.push(f);
            }
        }
    });

    // 3. Final Calculation
    const netResult = (totalBatchIncome + manualAdj) - periodExpense;

    // Store for printing
    window._lastProfitReport = {
        batch,
        startDate,
        endDate,
        manualAdj,
        students: batchStudents,
        expenses: periodExpenseList,
        totalIncome: totalBatchIncome,
        totalExpense: periodExpense,
        netResult: netResult,
        generatedAt: new Date().toLocaleString()
    };

    // Update UI
    document.getElementById('batchReportEmpty').classList.add('d-none');
    document.getElementById('batchReportResult').classList.remove('d-none');

    // Cards
    document.getElementById('repResBatchIncome').textContent = '৳' + totalBatchIncome.toLocaleString();
    document.getElementById('repResStudentCount').textContent = batchStudents.length + ' Students Found';

    document.getElementById('repResExpense').textContent = '৳' + periodExpense.toLocaleString();
    document.getElementById('repResExpenseItems').textContent = periodExpenseList.length + ' Expense Entries';

    const profitEl = document.getElementById('repResProfit');
    const profitCard = document.getElementById('repResProfitCard');
    const profitStatus = document.getElementById('repResProfitStatus');

    profitEl.textContent = '৳' + Math.abs(netResult).toLocaleString();

    if (netResult >= 0) {
        profitCard.style.background = 'rgba(0, 255, 136, 0.04)';
        profitCard.style.borderColor = 'rgba(0, 255, 136, 0.2)';
        profitEl.className = 'fw-bold text-success mb-0';
        profitStatus.textContent = 'Net Profit';
    } else {
        profitCard.style.background = 'rgba(255, 68, 102, 0.1)';
        profitCard.style.borderColor = 'rgba(255, 68, 102, 0.3)';
        profitEl.className = 'fw-bold text-danger mb-0';
        profitStatus.textContent = 'Net Loss';
    }

    // Summary Table
    document.getElementById('repSumBatch').textContent = batch;
    document.getElementById('repSumPeriod').textContent = startDate + ' to ' + endDate;
    document.getElementById('repSumIncome').textContent = '৳' + totalBatchIncome.toLocaleString();
    document.getElementById('repSumExpense').textContent = '৳' + periodExpense.toLocaleString();
    document.getElementById('repSumManual').textContent = '৳' + manualAdj.toLocaleString();

    const sumNet = document.getElementById('repSumNet');
    sumNet.textContent = '৳' + netResult.toLocaleString();
    sumNet.className = 'text-end h6 fw-bold fs-5 ' + (netResult >= 0 ? 'text-success' : 'text-danger');

    if (typeof showSuccessToast === 'function') showSuccessToast('Report Generated Successfully!');

    if (typeof logActivity === 'function') {
        logActivity('report', 'GENERATE', `Generated Profit Report for Batch: ${batch}`);
    }
}

function printBatchProfitReport() {
    const reportData = window._lastProfitReport;
    if (!reportData) {
        alert("Please generate a report first.");
        return;
    }

    const academyName = (window.globalData.settings && window.globalData.settings.academyName) || 'Wings Fly Academy';
    const printWindow = window.open('', '_blank');

    // Generate Student List Table rows
    const studentRows = reportData.students.map((s, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${s.name}</td>
            <td>${s.studentID || '---'}</td>
            <td class="text-end">৳${(parseFloat(s.totalPayment) || 0).toLocaleString()}</td>
            <td class="text-end text-success fw-bold">৳${(parseFloat(s.paid) || 0).toLocaleString()}</td>
            <td class="text-end text-danger fw-bold">৳${(parseFloat(s.due) || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    // Generate Expense List Table rows
    const expenseRows = reportData.expenses.map((e, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${e.date}</td>
            <td>${e.category}</td>
            <td>${e.description || '---'}</td>
            <td class="text-end fw-bold text-danger">৳${(parseFloat(e.amount) || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
        <html>
        <head>
            <title>Detailed Batch Report - ${reportData.batch}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print {
                    .page-break { page-break-after: always; }
                    body { padding: 0 !important; }
                }
                body { font-family: 'Inter', sans-serif; background: white; color: black; padding: 40px; }
                .report-header { border-bottom: 3px solid #00d9ff; padding-bottom: 20px; margin-bottom: 30px; }
                .summary-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 12px; padding: 25px; }
                .net-result { font-size: 2rem; font-weight: 800; border-radius: 10px; padding: 15px; margin-top: 20px; text-align: center; }
                .net-profit { background: #e6fffa; color: #047857; border: 1px solid #aaccc5; }
                .net-loss { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
                .section-title { background: #00d9ff; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; margin-top: 40px; margin-bottom: 20px; display: inline-block; }
                table { margin-bottom: 30px; }
                th { background-color: #f1f5f9 !important; font-weight: 800; }
                .footer-stamp { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.8rem; color: #666; }
            </style>
        </head>
        <body>
            <!-- PAGE 1: SUMMARY -->
            <div class="page-break">
                <div class="report-header text-center">
                    <h1 class="fw-bold mb-1">${academyName}</h1>
                    <h3 class="text-muted">Batch Wise Profit & Loss Statement</h3>
                    <p class="mb-0 text-info fw-bold">Generating Date: ${reportData.generatedAt}</p>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-6">
                        <div class="summary-box h-100">
                            <h5 class="fw-bold text-primary mb-3">Report Scope</h5>
                            <p class="mb-1"><strong>Selected Batch:</strong> ${reportData.batch}</p>
                            <p class="mb-1"><strong>Date Range:</strong> ${reportData.startDate} to ${reportData.endDate}</p>
                            <p class="mb-0"><strong>Students in Batch:</strong> ${reportData.students.length}</p>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="summary-box h-100">
                            <h5 class="fw-bold text-success mb-3">Financial Overview</h5>
                            <p class="mb-1">Total Collections: <span class="float-end">৳${reportData.totalIncome.toLocaleString()}</span></p>
                            <p class="mb-1">Operating Expenses: <span class="float-end">৳${reportData.totalExpense.toLocaleString()}</span></p>
                            <p class="mb-0">Manual Adjustment: <span class="float-end">৳${reportData.manualAdj.toLocaleString()}</span></p>
                        </div>
                    </div>
                </div>

                <div class="net-result ${reportData.netResult >= 0 ? 'net-profit' : 'net-loss'}">
                    Final Net Result: ৳${reportData.netResult.toLocaleString()}
                    <div style="font-size: 1rem; opacity: 0.8;">(${reportData.netResult >= 0 ? 'Total Profit' : 'Total Loss'})</div>
                </div>

                <div class="mt-5 pt-4">
                    <p class="text-center text-muted">Please find the detailed lists of students and expenses on the following pages.</p>
                </div>
            </div>

            <!-- PAGE 2: DETAILED LISTS -->
            <div class="page-break">
                <div class="section-title">PAGE 02: Detailed Student Collections</div>
                <table class="table table-bordered align-middle" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th width="50">#</th>
                            <th>Student Name</th>
                            <th>ID Number</th>
                            <th class="text-end">Total Fee</th>
                            <th class="text-end">Paid Amount</th>
                            <th class="text-end">Due</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentRows || '<tr><td colspan="6" class="text-center">No student data found for this batch.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="4" class="text-end">Batch Totals:</th>
                            <th class="text-end text-success">৳${reportData.totalIncome.toLocaleString()}</th>
                            <th class="text-end text-danger">৳${reportData.students.reduce((sum, s) => sum + (parseFloat(s.due) || 0), 0).toLocaleString()}</th>
                        </tr>
                    </tfoot>
                </table>

                <div class="section-title mt-4">Operating Expense Details (Period)</div>
                <table class="table table-bordered align-middle" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th width="50">#</th>
                            <th width="120">Date</th>
                            <th width="150">Category</th>
                            <th>Description</th>
                            <th class="text-end">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenseRows || '<tr><td colspan="5" class="text-center">No expense records found for this period.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="4" class="text-end">Total Operating Expense:</th>
                            <th class="text-end text-danger">৳${reportData.totalExpense.toLocaleString()}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>

                <div class="footer-stamp text-center">
                    <p>This is a computer-generated report for official record purposes.</p>
                    <p>&copy; ${new Date().getFullYear()} ${academyName} Management System</p>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

// Global exposure
window.populateBatchReportDropdowns = populateBatchReportDropdowns;
window.generateBatchProfitReport = generateBatchProfitReport;
window.printBatchProfitReport = printBatchProfitReport;

