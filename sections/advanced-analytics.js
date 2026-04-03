/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * ADVANCED ANALYTICS MODULE (V32-Dev)
 * ============================================================
 */

(function () {
    'use strict';

    let _trendChart = null;
    let _batchChart = null;
    let _paymentChart = null;

    async function initAnalytics() {
        console.log('[Analytics] 📊 Initializing charts...');

        // Destroy existing
        if (_trendChart) _trendChart.destroy();
        if (_batchChart) _batchChart.destroy();
        if (_paymentChart) _paymentChart.destroy();

        const gd = window.globalData || {};
        const finance = gd.finance || [];
        const students = gd.students || [];

        // 1. Trend Chart (Last 6 Months)
        const months = [];
        const incomeData = [];
        const expenseData = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            months.push(mKey);

            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            const mFinance = finance.filter(f => {
                const fDate = new Date(f.date);
                return fDate >= mStart && fDate <= mEnd;
            });

            const inc = mFinance.filter(f => f.type === 'Income').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
            const exp = mFinance.filter(f => f.type === 'Expense').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

            incomeData.push(inc);
            expenseData.push(exp);
        }

        const ctxTrend = document.getElementById('analyticsTrendChart')?.getContext('2d');
        if (ctxTrend) {
            _trendChart = new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        { label: 'Income', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                        { label: 'Expense', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
            });
        }

        // 2. Batch Growth
        const batchMap = {};
        students.forEach(s => {
            const b = s.batch || 'Other';
            batchMap[b] = (batchMap[b] || 0) + 1;
        });
        const batchLabels = Object.keys(batchMap);
        const batchData = Object.values(batchMap);

        const ctxBatch = document.getElementById('analyticsBatchGrowthChart')?.getContext('2d');
        if (ctxBatch) {
            _batchChart = new Chart(ctxBatch, {
                type: 'bar',
                data: {
                    labels: batchLabels,
                    datasets: [{ label: 'Students', data: batchData, backgroundColor: '#6366f1' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // 3. Payment Methods
        const methodMap = {};
        finance.filter(f => f.type === 'Income').forEach(f => {
            const m = f.method || 'Other';
            methodMap[m] = (methodMap[m] || 0) + (parseFloat(f.amount) || 0);
        });
        const methodLabels = Object.keys(methodMap);
        const methodData = Object.values(methodMap);

        const ctxPay = document.getElementById('analyticsPaymentDistributionChart')?.getContext('2d');
        if (ctxPay) {
            _paymentChart = new Chart(ctxPay, {
                type: 'doughnut',
                data: {
                    labels: methodLabels,
                    datasets: [{ data: methodData, backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    window.refreshAnalytics = initAnalytics;
    window.initAdvancedAnalytics = initAnalytics;

})();
