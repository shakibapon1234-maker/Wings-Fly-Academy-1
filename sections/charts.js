// ====================================
// WINGS FLY AVIATION ACADEMY
// CHARTS — Finance Chart, Student Status Chart, Payment Method Chart
// Extracted from app.js (Phase 6)
// ====================================

function updateCharts() {
  const financeCtx = document.getElementById('financeChart')?.getContext('2d');
  const courseCtx = document.getElementById('courseChart')?.getContext('2d');

  if (!financeCtx || !courseCtx) return;

  // 1. Prepare Financial Data (Last 6 Months)
  // Group by Month: { "Jan": 50000, "Feb": 60000 }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const incomeData = new Array(12).fill(0);
  const expenseData = new Array(12).fill(0);
  const currentYear = new Date().getFullYear();

  globalData.finance.forEach(f => {
    const d = new Date(f.date);
    if (d.getFullYear() === currentYear) {
      const mIndex = d.getMonth();
      const amt = parseFloat(f.amount) || 0;

      if (f.type === 'Income') {
        incomeData[mIndex] += amt;
      } else if (f.type === 'Expense') {
        expenseData[mIndex] += amt;
      }
    }
  });

  // Filter based on selection (Year vs Month) - kept simple for now (Year View)
  // Destroy old charts
  if (financeChartInstance) financeChartInstance.destroy();
  if (courseChartInstance) courseChartInstance.destroy();

  // RENDER FINANCE CHART (Bar)
  // Create gradient fills for bar chart
  const incomeGradient = financeCtx.createLinearGradient(0, 0, 0, 320);
  incomeGradient.addColorStop(0, 'rgba(0, 200, 255, 0.95)');
  incomeGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.85)');
  incomeGradient.addColorStop(1, 'rgba(123, 47, 247, 0.7)');

  const expenseGradient = financeCtx.createLinearGradient(0, 0, 0, 320);
  expenseGradient.addColorStop(0, 'rgba(255, 80, 80, 0.9)');
  expenseGradient.addColorStop(0.5, 'rgba(200, 40, 80, 0.7)');
  expenseGradient.addColorStop(1, 'rgba(100, 0, 50, 0.5)');

  financeChartInstance = new Chart(financeCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: incomeGradient,
          borderRadius: 10,
          barThickness: 22,
          borderWidth: 0,
          borderSkipped: false,
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: expenseGradient,
          borderRadius: 10,
          barThickness: 22,
          borderWidth: 0,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { weight: 'bold', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#111827',
          padding: 12,
          boxPadding: 8,
          titleFont: { size: 14, weight: 'bold' },
          callbacks: {
            label: function (context) {
              return ' ' + context.dataset.label + ': ৳' + formatNumber(context.raw);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { borderDash: [5, 5], color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
          ticks: { color: '#94a3b8', font: { weight: 'bold' } }
        },
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: '#94a3b8', font: { weight: 'bold' } }
        }
      }
    }
  });

  // 2. Prepare Course Data
  const courseCounts = {};
  globalData.students.forEach(s => {
    const c = s.course || 'Unknown';
    courseCounts[c] = (courseCounts[c] || 0) + 1;
  });

  const courseLabels = Object.keys(courseCounts);
  const courseValues = Object.values(courseCounts);

  // Find top course
  let topCourse = 'N/A';
  let maxVal = 0;
  Object.entries(courseCounts).forEach(([k, v]) => {
    if (v > maxVal) { maxVal = v; topCourse = k; }
  });

  const topCourseLabelEl = document.getElementById('topCourseLabel');
  const topCourseCountEl = document.getElementById('topCourseCount');

  if (topCourseLabelEl) topCourseLabelEl.innerText = topCourse;
  if (topCourseCountEl) topCourseCountEl.innerText = maxVal;

  // Premium Cyber Pie Colors
  const pieColors = ['#00f2ff', '#ffd700', '#0088ff', '#ff0055', '#7000ff', '#00ff9d'];

  // RENDER COURSE CHART (Doughnut)
  courseChartInstance = new Chart(courseCtx, {
    type: 'doughnut',
    data: {
      labels: courseLabels,
      datasets: [{
        data: courseValues,
        backgroundColor: pieColors,
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '80%',
      plugins: {
        legend: { display: false },
      }
    }
  });

  // ✅ FIX: Center-এ total student count দেখাও
  const totalStudents = globalData.students ? globalData.students.length : 0;
  const centerEl = document.getElementById('dashTotalStudentsCenter');
  if (centerEl) centerEl.textContent = totalStudents;

  // ✅ Legend render করো
  const legendEl = document.getElementById('courseChartLegend');
  if (legendEl && courseLabels.length > 0) {
    legendEl.innerHTML = courseLabels.map((label, i) =>
      `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 8px 3px 0;font-size:0.75rem;color:#94a3b8;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pieColors[i % pieColors.length]};"></span>
        ${label} (${courseValues[i]})
      </span>`
    ).join('');
  }
}
// NOTE: downloadLedgerExcel, mailLedgerReport etc. are defined in student-management.js
// NOTE: exportData, importData, handleImportFile are defined in data-export.js
// Do NOT re-assign them here as they load after charts.js

let currentStudentForProfile = null;

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function () {
  // ✅ FIX: loadFromStorage শুধু একবার দরকার — data load করার জন্য
  if (typeof loadFromStorage === 'function') loadFromStorage();

  // ✅ FIX: showDashboard() এখানে কল করা যাবে না!
  // কারণ auth.js IIFE ইতিমধ্যে refresh-এ সঠিক tab restore করে।
  // আগে এখানে showDashboard() ছিল যা refresh-এও dashboard-এ নিয়ে যেত (jumping bug)।
  // নতুন login-এ handleLogin() → showDashboard() কল করে — সেটাই যথেষ্ট।

  // Populate dropdowns initially
  if (typeof populateDropdowns === 'function') populateDropdowns();

  // Auto-populate batch filter
  setTimeout(function () {
    if (typeof populateBatchFilter === 'function') populateBatchFilter();
  }, 500);

  // Render cash balance and grand total on page load
  if (typeof renderCashBalance === 'function') renderCashBalance();
  if (typeof updateGrandTotal === 'function') updateGrandTotal();

  // Set Monthly Target default range
  var now = new Date();
  var firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  var targetStart = document.getElementById('targetStartDate');
  var targetEnd = document.getElementById('targetEndDate');
  if (targetStart) targetStart.value = firstDay;
  if (targetEnd) targetEnd.value = lastDay;
});

window.updateCharts = updateCharts;
