// ====================================
// WINGS FLY AVIATION ACADEMY
// NOTIFICATIONS — updateNotifications, renderNotificationList, handleNotificationClick
// Extracted from app.js (Phase 5)
// ====================================

function updateNotifications() {
  const today = new Date().toISOString().split('T')[0];
  const notifications = [];

  // 1. Check for overdue payment reminders
  globalData.students.forEach(s => {
    if (s.reminderDate && parseFloat(s.due) > 0) {
      const isOverdue = s.reminderDate < today;
      const isToday = s.reminderDate === today;

      if (isOverdue) {
        notifications.push({
          type: 'danger',
          icon: '⚠️',
          title: 'Overdue Payment',
          message: `${s.name} owes ৳${formatNumber(s.due)} - was due on ${s.reminderDate}`,
          action: () => openStudentProfile(s.rowIndex),
          time: s.reminderDate
        });
      } else if (isToday) {
        notifications.push({
          type: 'warning',
          icon: '📋',
          title: 'Payment Due Today',
          message: `${s.name} - ৳${formatNumber(s.due)} due today!`,
          action: () => openStudentProfile(s.rowIndex),
          time: 'Today'
        });
      }
    }
  });

  // 2. Check for students with high dues (> 10000)
  globalData.students.filter(s => parseFloat(s.due) > 10000 && !s.reminderDate).slice(0, 3).forEach(s => {
    notifications.push({
      type: 'info',
      icon: '💰',
      title: 'High Outstanding Due',
      message: `${s.name} has ৳${formatNumber(s.due)} outstanding`,
      action: () => openStudentProfile(s.rowIndex),
      time: 'High Priority'
    });
  });

  // 3. Check for resigned employees this month
  const thisMonth = today.substring(0, 7);
  (globalData.employees || []).filter(e => e.resignDate && e.resignDate.startsWith(thisMonth)).forEach(e => {
    notifications.push({
      type: 'secondary',
      icon: '👤',
      title: 'Employee Resigned',
      message: `${e.name} resigned on ${e.resignDate}`,
      action: () => switchTab('employees'),
      time: e.resignDate
    });
  });

  renderNotificationList(notifications);
}

function renderNotificationList(notifications) {
  const container = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');

  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-check-circle fs-3 d-block mb-2 text-success"></i>
        <span class="small">All caught up! No new notifications</span>
      </div>
    `;
    if (badge) badge.style.display = 'none';
    return;
  }

  // Update badge
  if (badge) {
    badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
    badge.style.display = 'inline-block';
  }

  // Render list
  container.innerHTML = notifications.map((n, i) => `
    <div class="notification-item p-3 border-bottom d-flex align-items-start gap-3 hover-bg-light" 
         style="cursor: pointer; transition: background 0.2s;" 
         onmouseover="this.style.background='#f8f9fa'" 
         onmouseout="this.style.background='transparent'"
         onclick="handleNotificationClick(${i})">
      <div class="notification-icon fs-4">${n.icon}</div>
      <div class="flex-grow-1">
        <div class="fw-bold small text-${n.type === 'danger' ? 'danger' : n.type === 'warning' ? 'warning' : 'dark'}">${n.title}</div>
        <div class="small text-muted">${n.message}</div>
        <div class="small text-muted opacity-75 mt-1"><i class="bi bi-clock me-1"></i>${n.time}</div>
      </div>
    </div>
  `).join('');

  // Store for click handling
  window._notificationActions = notifications.map(n => n.action);
}

function handleNotificationClick(index) {
  if (window._notificationActions && window._notificationActions[index]) {
    window._notificationActions[index]();
  }
}

function clearAllNotifications() {
  const container = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');

  if (container) {
    container.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-check-circle fs-3 d-block mb-2 text-success"></i>
        <span class="small">All caught up! No new notifications</span>
      </div>
    `;
  }
  if (badge) badge.style.display = 'none';
  showSuccessToast('Notifications cleared!');
}

window.updateNotifications = updateNotifications;
window.clearAllNotifications = clearAllNotifications;
window.handleNotificationClick = handleNotificationClick;

// Auto-update notifications when dashboard loads
const originalLoadDashboard = window.loadDashboard || loadDashboard;
window.loadDashboard = function () {
  if (typeof originalLoadDashboard === 'function') originalLoadDashboard();
  setTimeout(updateNotifications, 500);
};

// ===================================
// BANK ACCOUNT MANAGEMENT
// ===================================


// accounts-management — extracted to sections/accounts-management.js





// NEW: Data-only reset - keeps all settings
// DATA RESET: শুধুমাত্র Students, Employees, Finance ডাটা মুছবে

window.updateNotifications = updateNotifications;
window.renderNotificationList = renderNotificationList;
window.handleNotificationClick = handleNotificationClick;
window.clearAllNotifications = clearAllNotifications;
