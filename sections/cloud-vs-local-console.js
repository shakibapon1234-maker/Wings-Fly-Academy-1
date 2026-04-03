// ════════════════════════════════════════════════════════════════
// CLOUD VS LOCAL CONSOLE - Debug Tool
// Shows side-by-side comparison of Cloud vs Local data
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const CloudVsLocal = {
    panel: null,
    isOpen: false,

    init: function() {
      this.createPanel();
      this.injectButton();
      console.log('%c☁️ CloudVsLocal Console Ready', 'color: #00c853; font-weight: bold;');
    },

    createPanel: function() {
      const panel = document.createElement('div');
      panel.id = 'cloudVsLocalPanel';
      panel.innerHTML = `
        <div class="cvsl-header">
          <h5>☁️ Cloud vs Local Monitor</h5>
          <button class="cvsl-close" onclick="window.cloudVsLocal.close()">×</button>
        </div>
        <div class="cvsl-content">
          <div class="cvsl-stats" id="cvslStats">
            <div class="cvsl-loading">Loading data...</div>
          </div>
          <div class="cvsl-actions">
            <button class="cvsl-btn" onclick="window.cloudVsLocal.refresh()">🔄 Refresh</button>
            <button class="cvsl-btn" onclick="window.cloudVsLocal.syncToCloud()">📤 Push to Cloud</button>
            <button class="cvsl-btn" onclick="window.cloudVsLocal.syncFromCloud()">📥 Pull from Cloud</button>
          </div>
          <div class="cvsl-details" id="cvslDetails"></div>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        #cloudVsLocalPanel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 500px;
          max-height: 70vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid #00d4ff;
          border-radius: 12px 12px 0 0;
          z-index: 999999;
          display: none;
          box-shadow: 0 -4px 20px rgba(0, 212, 255, 0.3);
          font-family: monospace;
          font-size: 12px;
        }
        #cloudVsLocalPanel.open { display: block; }
        .cvsl-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background: linear-gradient(90deg, #0f3460, #16213e);
          border-bottom: 1px solid #00d4ff;
          border-radius: 12px 12px 0 0;
        }
        .cvsl-header h5 { margin: 0; color: #00d4ff; font-size: 14px; }
        .cvsl-close {
          background: none;
          border: none;
          color: #ff6b6b;
          font-size: 20px;
          cursor: pointer;
        }
        .cvsl-content { padding: 15px; max-height: calc(70vh - 60px); overflow-y: auto; }
        .cvsl-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
        }
        .cvsl-stat-box {
          padding: 10px;
          border-radius: 8px;
          text-align: center;
        }
        .cvsl-stat-box.match { background: rgba(0, 200, 83, 0.2); border: 1px solid #00c853; }
        .cvsl-stat-box.mismatch { background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; }
        .cvsl-stat-box.cloud { background: rgba(0, 212, 255, 0.2); border: 1px solid #00d4ff; }
        .cvsl-stat-box.local { background: rgba(255, 193, 7, 0.2); border: 1px solid #ffc107; }
        .cvsl-stat-label { color: #aaa; font-size: 10px; }
        .cvsl-stat-value { font-size: 18px; font-weight: bold; color: #fff; }
        .cvsl-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
        }
        .cvsl-btn {
          flex: 1;
          padding: 8px;
          background: #0f3460;
          border: 1px solid #00d4ff;
          color: #00d4ff;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
        }
        .cvsl-btn:hover { background: #00d4ff; color: #1a1a2e; }
        .cvsl-details { color: #ccc; }
        .cvsl-detail-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #333;
        }
        .cvsl-match { color: #00c853; }
        .cvsl-mismatch { color: #ff6b6b; }
        .cvsl-loading { text-align: center; color: #00d4ff; padding: 20px; }
        #cvslToggleBtn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00d4ff, #0099ff);
          border: none;
          color: #1a1a2e;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 212, 255, 0.5);
          z-index: 999998;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(panel);
      this.panel = panel;
    },

    injectButton: function() {
      if (document.getElementById('cvslToggleBtn')) return;
      const btn = document.createElement('button');
      btn.id = 'cvslToggleBtn';
      btn.innerHTML = '☁️';
      btn.title = 'Cloud vs Local Monitor';
      btn.onclick = () => this.toggle();
      document.body.appendChild(btn);
    },

    toggle: function() {
      this.isOpen = !this.isOpen;
      this.panel.classList.toggle('open', this.isOpen);
      if (this.isOpen) this.refresh();
    },

    close: function() {
      this.isOpen = false;
      this.panel.classList.remove('open');
    },

    refresh: async function() {
      const statsEl = document.getElementById('cvslStats');
      const detailsEl = document.getElementById('cvslDetails');
      
      statsEl.innerHTML = '<div class="cvsl-loading">Loading...</div>';
      detailsEl.innerHTML = '';

      const localData = JSON.parse(localStorage.getItem('wingsfly_data') || '{}');
      const cloudData = await this.fetchCloudData();

      const localStudents = (localData.students || []).length;
      const cloudStudents = (cloudData.students || []).length;
      const localFinance = (localData.finance || []).length;
      const cloudFinance = (cloudData.finance || []).length;
      const localEmployees = (localData.employees || []).length;
      const cloudEmployees = (cloudData.employees || []).length;

      statsEl.innerHTML = `
        <div class="cvsl-stat-box local">
          <div class="cvsl-stat-label">LOCAL STUDENTS</div>
          <div class="cvsl-stat-value">${localStudents}</div>
        </div>
        <div class="cvsl-stat-box cloud">
          <div class="cvsl-stat-label">CLOUD STUDENTS</div>
          <div class="cvsl-stat-value">${cloudStudents}</div>
        </div>
        <div class="cvsl-stat-box local">
          <div class="cvsl-stat-label">LOCAL FINANCE</div>
          <div class="cvsl-stat-value">${localFinance}</div>
        </div>
        <div class="cvsl-stat-box cloud">
          <div class="cvsl-stat-label">CLOUD FINANCE</div>
          <div class="cvsl-stat-value">${cloudFinance}</div>
        </div>
        <div class="cvsl-stat-box local">
          <div class="cvsl-stat-label">LOCAL EMPLOYEES</div>
          <div class="cvsl-stat-value">${localEmployees}</div>
        </div>
        <div class="cvsl-stat-box cloud">
          <div class="cvsl-stat-label">CLOUD EMPLOYEES</div>
          <div class="cvsl-stat-value">${cloudEmployees}</div>
        </div>
      `;

      let details = '';
      const comparisons = [
        ['Students', localStudents, cloudStudents],
        ['Finance', localFinance, cloudFinance],
        ['Employees', localEmployees, cloudEmployees]
      ];

      comparisons.forEach(([name, local, cloud]) => {
        const match = local === cloud;
        details += `
          <div class="cvsl-detail-row">
            <span>${name}:</span>
            <span class="${match ? 'cvsl-match' : 'cvsl-mismatch'}">
              Local ${local} vs Cloud ${cloud} ${match ? '✅' : '⚠️'}
            </span>
          </div>
        `;
      });

      // Add balances
      const localCash = localData.cashBalance || 0;
      const cloudCash = cloudData.cash_balance || 0;
      details += `
        <div class="cvsl-detail-row">
          <span>Cash Balance:</span>
          <span class="${localCash === cloudCash ? 'cvsl-match' : 'cvsl-mismatch'}">
            Local ৳${localCash.toLocaleString()} vs Cloud ৳${cloudCash.toLocaleString()} ${localCash === cloudCash ? '✅' : '⚠️'}
          </span>
        </div>
      `;

      detailsEl.innerHTML = details;
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

    syncToCloud: function() {
      if (typeof window.saveToCloud === 'function') {
        window.saveToCloud('manual-push');
        this.refresh();
        alert('📤 Pushing to cloud...');
      } else {
        alert('Cloud sync not available');
      }
    },

    syncFromCloud: function() {
      if (typeof window.loadFromCloud === 'function') {
        window.loadFromCloud(true);
        this.refresh();
        alert('📥 Pulling from cloud...');
      } else {
        alert('Cloud sync not available');
      }
    }
  };

  window.cloudVsLocal = CloudVsLocal;
  CloudVsLocal.init();
})();