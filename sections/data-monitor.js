// ════════════════════════════════════════════════════════════════
// DATA MONITOR - Real-time Cloud & Local Data Tracker
// Tracks changes and shows detailed data comparison
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const DataMonitor = {
    panel: null,
    isOpen: false,
    updateInterval: null,
    history: [],

    init: function() {
      this.createPanel();
      this.injectButton();
      console.log('%c📊 Data Monitor Ready', 'color: #ffc107; font-weight: bold;');
    },

    createPanel: function() {
      const panel = document.createElement('div');
      panel.id = 'dataMonitorPanel';
      panel.innerHTML = `
        <div class="dm-header">
          <h5>📊 Data Monitor</h5>
          <div class="dm-header-btns">
            <label class="dm-auto">
              <input type="checkbox" id="dmAutoRefresh" onchange="window.dataMonitor.toggleAuto()">
              Auto-refresh
            </label>
            <button class="dm-close" onclick="window.dataMonitor.close()">×</button>
          </div>
        </div>
        <div class="dm-content">
          <div class="dm-summary" id="dmSummary">
            <div class="dm-loading">Initializing...</div>
          </div>
          <div class="dm-tabs">
            <button class="dm-tab active" onclick="window.dataMonitor.showTab('students')">Students</button>
            <button class="dm-tab" onclick="window.dataMonitor.showTab('finance')">Finance</button>
            <button class="dm-tab" onclick="window.dataMonitor.showTab('accounts')">Accounts</button>
            <button class="dm-tab" onclick="window.dataMonitor.showTab('employees')">Employees</button>
          </div>
          <div class="dm-tab-content" id="dmTabContent"></div>
          <div class="dm-log" id="dmLog">
            <div class="dm-log-header">📝 Activity Log</div>
            <div class="dm-log-content" id="dmLogContent"></div>
          </div>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        #dataMonitorPanel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 450px;
          height: 80vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%);
          border: 1px solid #ffc107;
          border-radius: 12px;
          z-index: 999999;
          display: none;
          box-shadow: 0 8px 32px rgba(255, 193, 7, 0.2);
          font-family: 'Segoe UI', monospace;
          font-size: 12px;
        }
        #dataMonitorPanel.open { display: block; }
        .dm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          background: linear-gradient(90deg, #1a1a2e, #2d2d44);
          border-bottom: 1px solid #ffc107;
          border-radius: 12px 12px 0 0;
        }
        .dm-header h5 { margin: 0; color: #ffc107; font-size: 14px; }
        .dm-header-btns { display: flex; align-items: center; gap: 10px; }
        .dm-auto { color: #aaa; font-size: 11px; display: flex; align-items: center; gap: 5px; }
        .dm-auto input { accent-color: #ffc107; }
        .dm-close {
          background: none;
          border: none;
          color: #ff6b6b;
          font-size: 22px;
          cursor: pointer;
        }
        .dm-content {
          padding: 15px;
          height: calc(100% - 50px);
          overflow-y: auto;
        }
        .dm-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 15px;
        }
        .dm-sum-box {
          padding: 10px 5px;
          border-radius: 8px;
          text-align: center;
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
        }
        .dm-sum-label { color: #888; font-size: 9px; text-transform: uppercase; }
        .dm-sum-value { font-size: 16px; font-weight: bold; color: #ffc107; }
        .dm-tabs {
          display: flex;
          gap: 5px;
          margin-bottom: 10px;
          border-bottom: 1px solid #333;
          padding-bottom: 10px;
        }
        .dm-tab {
          flex: 1;
          padding: 8px;
          background: transparent;
          border: 1px solid #444;
          color: #aaa;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
        }
        .dm-tab.active {
          background: #ffc107;
          color: #1a1a2e;
          border-color: #ffc107;
        }
        .dm-tab-content {
          max-height: 250px;
          overflow-y: auto;
          margin-bottom: 15px;
        }
        .dm-row {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          border-bottom: 1px solid #333;
          font-size: 11px;
        }
        .dm-row:hover { background: rgba(255, 193, 7, 0.1); }
        .dm-row-local { color: #4fc3f7; }
        .dm-row-cloud { color: #81c784; }
        .dm-row-match { color: #00c853; }
        .dm-row-mismatch { color: #ff6b6b; }
        .dm-log {
          border-top: 1px solid #ffc107;
          padding-top: 10px;
        }
        .dm-log-header { color: #ffc107; font-size: 11px; margin-bottom: 8px; }
        .dm-log-content {
          max-height: 100px;
          overflow-y: auto;
          font-size: 10px;
          color: #888;
        }
        .dm-log-entry { padding: 3px 0; border-bottom: 1px solid #222; }
        .dm-loading { text-align: center; color: #ffc107; padding: 20px; }
        #dmToggleBtn {
          position: fixed;
          top: 20px;
          right: 80px;
          width: 45px;
          height: 45px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ffc107, #ff9800);
          border: none;
          color: #1a1a2e;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);
          z-index: 999998;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(panel);
      this.panel = panel;
    },

    injectButton: function() {
      if (document.getElementById('dmToggleBtn')) return;
      const btn = document.createElement('button');
      btn.id = 'dmToggleBtn';
      btn.innerHTML = '📊';
      btn.title = 'Data Monitor';
      btn.onclick = () => this.toggle();
      document.body.appendChild(btn);
    },

    toggle: function() {
      this.isOpen = !this.isOpen;
      this.panel.classList.toggle('open', this.isOpen);
      if (this.isOpen) {
        this.refresh();
        this.log('Monitor opened');
      }
    },

    close: function() {
      this.isOpen = false;
      this.panel.classList.remove('open');
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    },

    toggleAuto: function() {
      const checkbox = document.getElementById('dmAutoRefresh');
      if (checkbox.checked) {
        this.updateInterval = setInterval(() => this.refresh(), 5000);
        this.log('Auto-refresh enabled (5s)');
      } else {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        this.log('Auto-refresh disabled');
      }
    },

    refresh: async function() {
      const summaryEl = document.getElementById('dmSummary');
      const contentEl = document.getElementById('dmTabContent');
      
      summaryEl.innerHTML = '<div class="dm-loading">Loading...</div>';
      contentEl.innerHTML = '';

      const localData = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
      const cloudData = await this.fetchCloudData();

      const ls = localData;
      const cs = cloudData;

      const stuL = (ls.students || []).length;
      const stuC = (cs.students || []).length;
      const finL = (ls.finance || []).length;
      const finC = (cs.finance || []).length;
      const empL = (ls.employees || []).length;
      const empC = (cs.employees || []).length;

      summaryEl.innerHTML = `
        <div class="dm-sum-box">
          <div class="dm-sum-label">Students</div>
          <div class="dm-sum-value">${stuL}</div>
        </div>
        <div class="dm-sum-box">
          <div class="dm-sum-label">Finance</div>
          <div class="dm-sum-value">${finL}</div>
        </div>
        <div class="dm-sum-box">
          <div class="dm-sum-label">Employees</div>
          <div class="dm-sum-value">${empL}</div>
        </div>
        <div class="dm-sum-box">
          <div class="dm-sum-label">Cash</div>
          <div class="dm-sum-value">৳${(ls.cashBalance || 0).toLocaleString()}</div>
        </div>
      `;

      this.currentTab = this.currentTab || 'students';
      this.showTab(this.currentTab);
    },

    showTab: function(tab) {
      this.currentTab = tab;
      document.querySelectorAll('.dm-tab').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      
      const localData = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
      const contentEl = document.getElementById('dmTabContent');
      
      let html = '';
      
      if (tab === 'students') {
        const students = localData.students || [];
        html = students.slice(0, 10).map(s => `
          <div class="dm-row">
            <span class="dm-row-local">${s.studentId || s.name || 'N/A'}</span>
            <span>${s.name || ''}</span>
            <span>৳${s.paid || 0}/৳${s.totalPayment || 0}</span>
          </div>
        `).join('');
        if (students.length > 10) html += `<div class="dm-row" style="color:#888">... +${students.length - 10} more</div>`;
      }
      else if (tab === 'finance') {
        const finance = localData.finance || [];
        html = finance.slice(0, 10).map(f => `
          <div class="dm-row">
            <span>${f.date || ''}</span>
            <span class="${f.type === 'Income' ? 'dm-row-match' : 'dm-row-mismatch'}">${f.type}</span>
            <span>৳${f.amount || 0}</span>
          </div>
        `).join('');
        if (finance.length > 10) html += `<div class="dm-row" style="color:#888">... +${finance.length - 10} more</div>`;
      }
      else if (tab === 'accounts') {
        const banks = localData.bankAccounts || [];
        const mobile = localData.mobileBanking || [];
        html = banks.map(b => `
          <div class="dm-row">
            <span>${b.name || ''}</span>
            <span class="dm-row-match">৳${b.balance || 0}</span>
          </div>
        `).join('');
        html += mobile.map(m => `
          <div class="dm-row">
            <span>${m.name || ''} (Mobile)</span>
            <span class="dm-row-match">৳${m.balance || 0}</span>
          </div>
        `).join('');
      }
      else if (tab === 'employees') {
        const employees = localData.employees || [];
        html = employees.slice(0, 10).map(e => `
          <div class="dm-row">
            <span>${e.name || ''}</span>
            <span>${e.role || ''}</span>
            <span>৳${e.salary || 0}</span>
          </div>
        `).join('');
      }
      
      contentEl.innerHTML = html || '<div class="dm-row" style="color:#888">No data</div>';
    },

    fetchCloudData: function() {
      return new Promise(function(resolve) {
        const CFG = window.SUPABASE_CONFIG;
        if (!CFG) { resolve({}); return; }

        fetch(CFG.getRestURL('academy_data') + '?id=eq.' + CFG.ACADEMY_ID, {
          headers: CFG.getHeaders()
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && data.length > 0) resolve(data[0]);
          else resolve({});
        })
        .catch(function() { resolve({}); });
      });
    },

    log: function(msg) {
      const time = new Date().toLocaleTimeString();
      this.history.unshift(`[${time}] ${msg}`);
      if (this.history.length > 20) this.history.pop();
      
      const logEl = document.getElementById('dmLogContent');
      if (logEl) {
        logEl.innerHTML = this.history.map(h => `<div class="dm-log-entry">${h}</div>`).join('');
      }
    }
  };

  window.dataMonitor = DataMonitor;
  DataMonitor.init();
})();