/**
 * ============================================================
 * WINGS FLY AVIATION ACADEMY
 * ACCOUNT ANALYTICS — PRINT FUNCTION (Extracted)
 * ============================================================
 * Separated from settings-modal.html to avoid parser bloat
 * and CSP issues with large inline scripts
 */

(function() {
    'use strict';

    window._anaPrint = function() {
        try {
            var gd = window.globalData || {};
            var mode = window._anaMode || 'all';
            var allFin = (gd.finance || []).filter(function(f) { return f && !f._deleted && f.id; });
            
            var selM = document.getElementById('ana_monthFilter');
            var monthVal = selM ? selM.value : '';
            var dFr = document.getElementById('ana_dateFrom');
            var dTo = document.getElementById('ana_dateTo');
            var df = dFr ? dFr.value : '';
            var dt = dTo ? dTo.value : '';

            var filtered = allFin.filter(function(f) {
                var d = window._anaNormDate(f.date || f.timestamp);
                if (!d) return false;
                if (mode === 'month') return !monthVal || d.indexOf(monthVal) === 0;
                if (mode === 'range') {
                    if (df && d < df) return false;
                    if (dt && d > dt) return false;
                }
                return true;
            });

            // ✅ FIX: Canonical types ব্যবহার করো — Loan ও Transfer income/expense না
            // finance-engine.js এর FE_STAT_INCOME / FE_STAT_EXPENSE দিয়ে sync থাকে
            var FE_INCOME  = window.FE_STAT_INCOME  || ['Income', 'Registration', 'Refund'];
            var FE_EXPENSE = window.FE_STAT_EXPENSE || ['Expense', 'Salary', 'Rent', 'Utilities'];

            var incArr = filtered.filter(function(f) {
                return FE_INCOME.includes(f.type);
            });
            var expArr = filtered.filter(function(f) {
                return FE_EXPENSE.includes(f.type);
            });

            function groupByCategory(arr) {
                var groups = {};
                arr.forEach(function(f) {
                    var cat = f.category || f.type || 'Other';
                    if (!groups[cat]) groups[cat] = { total: 0, count: 0, items: [] };
                    groups[cat].items.push(f);
                    groups[cat].total += window._anaParseAmt(f.amount);
                    groups[cat].count++;
                });
                return groups;
            }

            var totI = incArr.reduce(function(s, f) { return s + window._anaParseAmt(f.amount); }, 0);
            var totE = expArr.reduce(function(s, f) { return s + window._anaParseAmt(f.amount); }, 0);
            var netP = totI - totE;

            var incGroups = groupByCategory(incArr);
            var expGroups = groupByCategory(expArr);

            var c = window._anaParseAmt(gd.cashBalance);
            var b = (gd.bankAccounts || []).reduce(function(s, a) { return s + window._anaParseAmt(a.balance); }, 0);
            var m = (gd.mobileBanking || []).reduce(function(s, a) { return s + window._anaParseAmt(a.balance); }, 0);
            var total = c + b + m;

            var win = window.open('', '_blank');
            if (!win) { alert('Popup Blocked! Please allow popups to print report.'); return; }

            // Build HTML with CSS
            var cssStyles = 'body{font-family:Arial,sans-serif;padding:20px;background:#fff;color:#000;line-height:1.4;}' +
                'h1{text-align:center;font-size:24px;margin-bottom:5px;color:#1a1a1a;}' +
                'h2{border-bottom:2px solid #0066cc;padding-bottom:8px;font-size:16px;margin-top:20px;color:#0066cc;}' +
                'table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px;}' +
                'th{background:#0066cc;color:#fff;padding:8px;text-align:left;font-weight:700;border:1px solid #004499;}' +
                'td{border:1px solid #ddd;padding:6px 8px;text-align:left;}' +
                'tr:nth-child(even){background:#f9f9f9;}' +
                '.total-row{background:#e6f0ff;font-weight:700;border-top:2px solid #0066cc;}' +
                '.summary-box{border:2px solid #0066cc;padding:12px;margin:10px 0;border-radius:5px;background:#f0f5ff;}' +
                '.summary-box .line{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;}' +
                '.summary-box .line-total{font-size:13px;font-weight:700;color:#0066cc;border-top:1px solid #0066cc;padding-top:6px;margin-top:6px;}' +
                '.amount{text-align:right;font-weight:600;}' +
                '.page-break{page-break-after:always;margin-bottom:30px;padding-bottom:20px;border-bottom:3px dashed #999;}' +
                'p{margin:5px 0;font-size:11px;color:#666;}' +
                '.header-date{text-align:center;color:#666;font-size:11px;margin-bottom:15px;}';

            var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Account Analytics Report</title><style>' + cssStyles + '</style></head><body>';

            html += '<h1>WINGS FLY AVIATION ACADEMY</h1>';
            html += '<h2 style="text-align:center;border:none;padding:0;margin:5px 0;">Account Analytics Report</h2>';
            html += '<p class="header-date">Generated: ' + new Date().toLocaleString() + '</p>';

            // SUMMARY
            html += '<h2>Summary Overview</h2>';
            html += '<div class="summary-box">';
            html += '<div class="line"><span>Total Income:</span><span class="amount">BDT ' + window._anaParseAmt(totI).toLocaleString('en-IN') + '</span></div>';
            html += '<div class="line"><span>Total Expense:</span><span class="amount">BDT ' + window._anaParseAmt(totE).toLocaleString('en-IN') + '</span></div>';
            html += '<div class="line-total"><span>Net Profit:</span><span class="amount" style="color:' + (netP >= 0 ? '#00aa00' : '#ff0000') + '">BDT ' + window._anaParseAmt(netP).toLocaleString('en-IN') + '</span></div>';
            html += '</div>';

            // INCOME BREAKDOWN
            html += '<h2>Income Breakdown (Categories)</h2>';
            html += '<table><thead><tr><th>Category</th><th>Count</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
            Object.keys(incGroups).sort().forEach(function(cat, i) {
                var g = incGroups[cat];
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td>' + cat + '</td><td>' + g.count + '</td><td class="amount">BDT ' + window._anaParseAmt(g.total).toLocaleString('en-IN') + '</td></tr>';
            });
            html += '<tr class="total-row"><td>Sub-Total Income</td><td>' + incArr.length + '</td><td class="amount">BDT ' + window._anaParseAmt(totI).toLocaleString('en-IN') + '</td></tr>';
            html += '</tbody></table>';

            // INCOME DETAILS
            html += '<h2>Income Details (All Transactions)</h2>';
            html += '<table><thead><tr><th>Date</th><th>Category</th><th>Person</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
            var sortedInc = incArr.slice().sort(function(a,b) {
                return String(b.date || b.timestamp || '').localeCompare(String(a.date || a.timestamp || ''));
            });
            sortedInc.forEach(function(f, i) {
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td>' + String(f.date || '').slice(0, 10) + '</td><td>' + (f.category || f.type || '-') + '</td><td>' + (f.person || '-') + '</td><td>' + (f.description || '-') + '</td><td class="amount">BDT ' + window._anaParseAmt(f.amount).toLocaleString('en-IN') + '</td></tr>';
            });
            html += '</tbody></table>';

            html += '<div class="page-break"></div>';

            // EXPENSE BREAKDOWN
            html += '<h2>Expense Breakdown (Categories)</h2>';
            html += '<table><thead><tr><th>Category</th><th>Count</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
            Object.keys(expGroups).sort().forEach(function(cat, i) {
                var g = expGroups[cat];
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td>' + cat + '</td><td>' + g.count + '</td><td class="amount">BDT ' + window._anaParseAmt(g.total).toLocaleString('en-IN') + '</td></tr>';
            });
            html += '<tr class="total-row"><td>Sub-Total Expense</td><td>' + expArr.length + '</td><td class="amount">BDT ' + window._anaParseAmt(totE).toLocaleString('en-IN') + '</td></tr>';
            html += '</tbody></table>';

            // EXPENSE DETAILS
            html += '<h2>Expense Details (All Transactions)</h2>';
            html += '<table><thead><tr><th>Date</th><th>Category</th><th>Person</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
            var sortedExp = expArr.slice().sort(function(a,b) {
                return String(b.date || b.timestamp || '').localeCompare(String(a.date || a.timestamp || ''));
            });
            sortedExp.forEach(function(f, i) {
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td>' + String(f.date || '').slice(0, 10) + '</td><td>' + (f.category || f.type || '-') + '</td><td>' + (f.person || '-') + '</td><td>' + (f.description || '-') + '</td><td class="amount">BDT ' + window._anaParseAmt(f.amount).toLocaleString('en-IN') + '</td></tr>';
            });
            html += '</tbody></table>';

            html += '<div class="page-break"></div>';

            // ACCOUNT BALANCES
            html += '<h2>Account Balances</h2>';
            html += '<table><thead><tr><th>Account Type</th><th>Account Name</th><th style="text-align:right;">Balance</th></tr></thead><tbody>';
            html += '<tr><td colspan="2">Cash on Hand</td><td class="amount">BDT ' + window._anaParseAmt(c).toLocaleString('en-IN') + '</td></tr>';
            (gd.bankAccounts || []).forEach(function(a, i) {
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td colspan="2">Bank: ' + a.name + '</td><td class="amount">BDT ' + window._anaParseAmt(a.balance).toLocaleString('en-IN') + '</td></tr>';
            });
            (gd.mobileBanking || []).forEach(function(a, i) {
                html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + ';"><td colspan="2">Mobile: ' + a.name + '</td><td class="amount">BDT ' + window._anaParseAmt(a.balance).toLocaleString('en-IN') + '</td></tr>';
            });
            html += '<tr class="total-row"><td colspan="2">Total All Accounts</td><td class="amount">BDT ' + window._anaParseAmt(total).toLocaleString('en-IN') + '</td></tr>';
            html += '</tbody></table>';

            // FINAL SUMMARY
            html += '<h2>Final Balance Sheet</h2>';
            html += '<div class="summary-box">';
            html += '<div class="line"><span>Total Income (All Sources):</span><span class="amount">BDT ' + window._anaParseAmt(totI).toLocaleString('en-IN') + '</span></div>';
            html += '<div class="line"><span>Total Expense (All Costs):</span><span class="amount">BDT ' + window._anaParseAmt(totE).toLocaleString('en-IN') + '</span></div>';
            html += '<div class="line"><span>Total Account Balance:</span><span class="amount">BDT ' + window._anaParseAmt(total).toLocaleString('en-IN') + '</span></div>';
            html += '<div class="line-total"><span>Net Operating Profit:</span><span class="amount" style="color:' + (netP >= 0 ? '#00aa00' : '#ff0000') + '">BDT ' + window._anaParseAmt(netP).toLocaleString('en-IN') + '</span></div>';
            html += '</div>';

            html += '<p style="margin-top:30px;text-align:center;color:#999;font-size:10px;">Report Generated: ' + new Date().toLocaleString() + '</p>';
            html += '</body></html>';

            // Write to new window
            win.document.write(html);
            win.document.close();

            // Print after a short delay
            setTimeout(function() { win.print(); }, 500);
        } catch(e) { 
            console.error('Print error:', e); 
            alert('Error generating report: ' + e.message); 
        }
    };

})();
