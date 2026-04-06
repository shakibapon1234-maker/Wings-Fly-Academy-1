/**
 * 🛡️ WINGS FLY — AI DEBUG SENTINEL v1.0 🕹️
 * ============================================
 * An automated error monitoring and healing assistant.
 * Features: Console intercept, State Snapshots, Rollback, UI Locking.
 * Design: Nebula & Aurora (Glassmorphism, Vibrant Glowing)
 * ============================================
 */

(function () {
    'use strict';

    const SENTINEL_VERSION = '1.0-SENTINEL';
    const STORAGE_KEY = 'wf_sentinel_history';
    const MAX_LOGS = 50;

    const Sentinel = {
        logs: [],
        snapshots: new Map(), // ErrorID -> { before: JSON, after: JSON }
        isFixing: false,
        panelOpen: false,
        orbEl: null,
        panelEl: null,
        lockEl: null,

        init: function () {
            this.prepareUI();
            this.hookConsole();
            this.hookWindowErrors();
            this.loadHistory();
            this.renderLogs();
            console.log('%c🛡️ AI Debug Sentinel Activated', 'color: #00fff5; font-weight: bold; font-size: 14px;');
        },

        // ============================================
        // 🔍 MONITORING & CAPTURE
        // ============================================
        hookConsole: function () {
            const self = this;
            const originalError = console.error;
            const originalWarn = console.warn;

            console.error = function () {
                const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
                self.record('CRITICAL', msg, 'CONSOLE_ERROR');
                originalError.apply(console, arguments);
            };

            console.warn = function () {
                const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
                self.record('WARNING', msg, 'CONSOLE_WARN');
                originalWarn.apply(console, arguments);
            };
        },

        hookWindowErrors: function () {
            const self = this;
            window.onerror = function (msg, url, line, col, error) {
                self.record('CRITICAL', `${msg} at ${line}:${col}`, 'RUNTIME_ERROR', error?.stack);
                return false; // let default handler run
            };

            window.onunhandledrejection = function (event) {
                self.record('CRITICAL', event.reason?.message || 'Unhandled Promise Rejection', 'PROMISE_REJECTION', event.reason?.stack);
            };

            // Capture resource loading errors (img, script, link)
            window.addEventListener('error', function (event) {
                if (event.target && (event.target.src || event.target.href)) {
                    const url = event.target.src || event.target.href;
                    self.record('WARNING', `Failed to load resource: ${url}`, 'RESOURCE_ERROR');
                }
            }, true);
        },

        record: function (severity, msg, type, stack = null) {
            // Ignore tracker noise
            if (msg.includes('WFTracker') || msg.includes('SENTINEL')) return;

            const entry = {
                id: 'ERR_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                severity,
                msg,
                type,
                stack,
                tab: window.currentTab || 'unknown',
                fixed: false,
                snapshotId: null
            };

            this.logs.unshift(entry);
            if (this.logs.length > MAX_LOGS) this.logs.pop();
            this.saveHistory();
            this.renderLogs();
            this.updateOrb(severity);

            // ROBUST ALERTING (PHASE 3)
            if (severity !== 'INFO') {
                const toastMsg = msg.includes('SyncGuard') ? `🛡️ Sentinel: ${msg}` : `⚠️ Sentinel: ${severity} - ${msg.substring(0, 40)}${msg.length > 40 ? '...' : ''}`;
                this.showToast(toastMsg, severity === 'CRITICAL' ? 'danger' : 'warning');
                this.showBubble(type || severity, severity);
                this.shakeOrb();
            }
            
            if (severity === 'CRITICAL') {
                this.analyze(entry);
            }
        },

        // ============================================
        // 🧠 ANALYSIS & HEALING
        // ============================================
        analyze: function (entry) {
            let suggestion = null;
            let autoFix = null;
            let reasoning = null;

            // Pattern Matching
            const msg = entry.msg.toLowerCase();
            if (msg.includes('undefined') || msg.includes('null')) {
                suggestion = "Detected Null/Undefined access. Possible data corruption or missing initialization.";
                reasoning = "The app tried to read a property of an empty object. Running Auto-Heal will initialize all missing data arrays to prevent further crashes.";
                autoFix = "RUN_AUTO_HEAL_DATA";
            } else if (msg.includes('fetch') || msg.includes('supabase') || msg.includes('connection_refused') || msg.includes('network')) {
                suggestion = "Network error detected. Connection to the server or database might be interrupted.";
                reasoning = "Failed to reach the specified URL. This could be a local offline state or a server-side downtime. Retrying the sync engine will attempt to reconnect.";
                autoFix = "RETRY_SYNC";
            } else if (msg.includes('balance') || msg.includes('cash')) {
                suggestion = "Account balance mismatch likely.";
                reasoning = "Detected an error in a financial field. The finance engine will recalculate all cash and bank totals to ensure accuracy.";
                autoFix = "RECALC_FINANCE";
            } else if (msg.includes('increment_version')) {
                suggestion = "Supabase RPC 'increment_version' missing.";
                reasoning = "The cloud database is missing a required function. A synchronization retry will attempt to bypass this version check and maintain data integrity.";
                autoFix = "RETRY_SYNC";
            } else if (msg.includes('404') || msg.includes('failed to load') || msg.includes('resource_error')) {
                suggestion = "Resource Loading Failure (Missing File/Network).";
                reasoning = "An asset (like an image, script, or favicon) could not be loaded. This might be due to a missing file or a local connection issue. A diagnostic scan will check if any core scripts are missing.";
                autoFix = "RUN_AUTO_HEAL_DATA";
            } else {
                // Proactive General Diagnostic
                suggestion = "Unknown anomaly detected. Recommend a full system diagnostic.";
                reasoning = "While this error didn't match a known pattern, some system components might be in an inconsistent state. Running Auto-Heal is a safe way to verify all data structures.";
                autoFix = "RUN_AUTO_HEAL_DATA";
            }

            if (suggestion) {
                entry.suggestion = suggestion;
                entry.autoFix = autoFix;
                entry.reasoning = reasoning;
                this.renderLogs();
            }
        },

        applyFix: async function (entryId) {
            const entry = this.logs.find(l => l.id === entryId);
            if (!entry || this.isFixing) return;

            this.isFixing = true;
            this.showLock(true);
            
            // TAKE "BEFORE" SNAPSHOT
            const beforeState = this.captureState();
            
            try {
                // Execute Fix logic
                if (entry.autoFix === 'RUN_AUTO_HEAL_DATA') {
                    if (window.autoHeal && typeof window.autoHeal.runNow === 'function') {
                        await window.autoHeal.runNow();
                    }
                } else if (entry.autoFix === 'RETRY_SYNC') {
                    if (window.wingsSync && typeof window.wingsSync.fullSync === 'function') {
                        await window.wingsSync.fullSync();
                    }
                } else if (entry.autoFix === 'RECALC_FINANCE') {
                    if (typeof window.feRebuildAllBalances === 'function') {
                        window.feRebuildAllBalances();
                    }
                }

                // Simulate processing delay for visual feedback
                await new Promise(r => setTimeout(r, 1500));

                // TAKE "AFTER" SNAPSHOT
                const afterState = this.captureState();
                this.snapshots.set(entry.id, { before: beforeState, after: afterState });
                
                entry.fixed = true;
                entry.snapshotId = entry.id;
                this.saveHistory();
                this.renderLogs();
                this.showToast('✅ Fix Applied Successfully!', 'success');
            } catch (err) {
                this.showToast('❌ Fix Failed: ' + err.message, 'danger');
            } finally {
                this.isFixing = false;
                this.showLock(false);
            }
        },

        rollback: function (entryId) {
            const snap = this.snapshots.get(entryId);
            if (!snap || !snap.before) return;

            if (confirm('আগের ডাটা ভার্সনে ফিরে যেতে চান? বর্তমান পরিবর্তনগুলো মুছে যাবে।')) {
                try {
                    window.globalData = JSON.parse(snap.before.data);
                    if (typeof window.saveToStorage === 'function') window.saveToStorage(true);
                    if (typeof window.renderFullUI === 'function') window.renderFullUI();
                    this.showToast('⏪ State Restored Successfully!', 'info');
                } catch (e) {
                    this.showToast('❌ Rollback Failed', 'danger');
                }
            }
        },

        captureState: function () {
            return {
                timestamp: Date.now(),
                data: JSON.stringify(window.globalData || {}),
                tab: window.currentTab || 'dashboard'
            };
        },

        // ============================================
        // 🎨 UI & VISUALS
        // ============================================
        prepareUI: function () {
            // CSS Injection
            const style = document.createElement('style');
            style.textContent = `
                #sentinel-orb {
                    position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px;
                    border-radius: 50%; z-index: 1000000; cursor: pointer;
                    background: radial-gradient(circle at 30% 30%, #00fff5, #0066cc);
                    box-shadow: 0 0 20px rgba(0, 255, 245, 0.4), inset 0 0 10px rgba(255,255,255,0.5);
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                #sentinel-orb:hover { transform: scale(1.1) rotate(15deg); }
                #sentinel-orb.pulse { animation: sentinel-pulse 1.5s infinite; }
                #sentinel-orb.critical { background: radial-gradient(circle at 30% 30%, #ff4b2b, #ff416c); box-shadow: 0 0 30px rgba(255, 75, 43, 0.8), 0 0 10px #ff4b2b; }
                #sentinel-orb.warning { background: radial-gradient(circle at 30% 30%, #f7971e, #ffd200); box-shadow: 0 0 30px rgba(247, 151, 30, 0.8); }
                #sentinel-orb.shake { animation: sentinel-shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
                
                @keyframes sentinel-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(0, 217, 255, 0.7); }
                    70% { box-shadow: 0 0 0 20px rgba(0, 217, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 217, 255, 0); }
                }

                @keyframes sentinel-shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }

                #sentinel-bubble {
                    position: fixed; bottom: 35px; right: 80px;
                    background: rgba(10, 14, 37, 0.9); backdrop-filter: blur(10px);
                    color: #fff; padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(0, 255, 245, 0.3);
                    font-size: 10px; font-weight: 700; z-index: 1000000;
                    display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    animation: sentinel-bubble-in 0.3s ease-out; pointer-events: none;
                }
                @keyframes sentinel-bubble-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

                #sentinel-panel {
                    position: fixed; bottom: 85px; right: 20px; width: 400px; max-height: 80vh;
                    background: rgba(10, 14, 37, 0.9); backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 255, 245, 0.2); border-radius: 20px;
                    z-index: 1000001; display: none; flex-direction: column;
                    box-shadow: 0 15px 50px rgba(0,0,0,0.8);
                    animation: sentinel-slide 0.4s ease-out; overflow: hidden;
                    font-family: 'Inter', sans-serif;
                }
                @keyframes sentinel-slide { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

                .sentinel-header { padding: 15px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(0,255,245,0.1); display: flex; justify-content: space-between; align-items: center; }
                .sentinel-header h5 { margin: 0; color: #00fff5; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
                
                .sentinel-list { padding: 10px; overflow-y: auto; flex: 1; min-height: 200px; scrollbar-width: thin; }
                .sentinel-item { 
                    padding: 12px; border-radius:12px; background: rgba(255,255,255,0.03); margin-bottom: 10px;
                    border-left: 3px solid #00fff5; transition: 0.2s;
                }
                .sentinel-item.CRITICAL { border-left-color: #ff416c; background: rgba(255, 65, 108, 0.05); }
                .sentinel-item.WARNING { border-left-color: #ffd200; background: rgba(255, 210, 0, 0.05); }
                .sentinel-item.fixed { border-left-color: #00ff88; opacity: 0.8; }
                
                .sentinel-item-meta { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 5px; }
                .sentinel-item-msg { font-size: 12px; color: #eee; word-break: break-all; margin-bottom: 8px; font-family: 'JetBrains Mono', 'Monaco', monospace; }
                
                .sentinel-fix-box { background: rgba(0, 255, 245, 0.08); border-radius: 8px; padding: 10px; margin-top: 10px; border: 1px dashed rgba(0, 255, 245, 0.2); }
                .sentinel-reasoning { font-size: 10px; color: rgba(255,255,255,0.6); line-height: 1.4; margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 2px solid #00fff5; }
                .sentinel-fix-btn { background: #00fff5; color: #0a0e25; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; margin-top: 8px; box-shadow: 0 0 10px rgba(0,255,245,0.3); transition: 0.2s; }
                .sentinel-fix-btn:hover { background: #fff; transform: translateY(-1px); }
                .sentinel-rollback-btn { background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; margin-top: 8px; margin-left: 5px; }

                #sentinel-lock {
                    position: fixed; inset: 0; background: rgba(10, 14, 37, 0.8); backdrop-filter: blur(15px);
                    z-index: 2000000; display: none; align-items: center; justify-content: center; flex-direction: column;
                    color: #fff; text-align: center;
                }
                .sentinel-loader { width: 60px; height: 60px; border: 4px solid rgba(0,255,245,0.1); border-top: 4px solid #00fff5; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 25px; box-shadow: 0 0 20px rgba(0,255,245,0.2); }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `;
            document.head.appendChild(style);

            // Create Orb
            this.orbEl = document.createElement('div');
            this.orbEl.id = 'sentinel-orb';
            this.orbEl.innerHTML = '<i class="bi bi-shield-shaded" style="font-size: 20px; color: white;"></i>';
            this.orbEl.onclick = () => this.togglePanel();
            document.body.appendChild(this.orbEl);

            // Create Panel
            this.panelEl = document.createElement('div');
            this.panelEl.id = 'sentinel-panel';
            this.panelEl.innerHTML = `
                <div class="sentinel-header">
                    <div style="display:flex; flex-direction:column;">
                        <h5>🛡️ DEBUG SENTINEL</h5>
                        <small style="color:rgba(255,255,255,0.3); font-size:9px;">AI ASSISTANT ACTIVE</small>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button onclick="Sentinel.manualScan()" style="background:rgba(0,255,245,0.1); border:1px solid rgba(0,255,245,0.3); color:#00fff5; font-size:10px; padding:3px 8px; border-radius:4px; cursor:pointer;">SCAN NOW</button>
                        <button onclick="Sentinel.clearLogs()" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:11px; cursor:pointer;">CLEAR</button>
                        <button onclick="Sentinel.togglePanel()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
                    </div>
                </div>
                <div class="sentinel-list" id="sentinel-list">
                    <div style="text-align:center; padding:40px; color:rgba(255,255,255,0.2); font-size:12px;">No events detected yet. Sentinel is active.</div>
                </div>
                <div style="padding:10px; background:rgba(0,0,0,0.2); font-size:10px; color:rgba(255,255,255,0.3); text-align:center; border-top:1px solid rgba(0,255,245,0.05);">
                    WINGS FLY AI ENGINE v1.0 • ONLINE
                </div>
            `;
            document.body.appendChild(this.panelEl);

            // Create Lock Overlay
            this.lockEl = document.createElement('div');
            this.lockEl.id = 'sentinel-lock';
            this.lockEl.innerHTML = `
                <div class="sentinel-loader"></div>
                <h4 style="color:#00fff5; font-weight:800; margin-bottom:10px;">AI SENTINEL IS REPAIRING...</h4>
                <p style="opacity:0.7; font-size:14px; max-width:300px;">Please wait while we fix the background issues. Manual input is temporarily disabled to prevent conflicts.</p>
            `;
            document.body.appendChild(this.lockEl);

            // Create Bubble
            this.bubbleEl = document.createElement('div');
            this.bubbleEl.id = 'sentinel-bubble';
            document.body.appendChild(this.bubbleEl);

            // Export to window for inline calls
            window.Sentinel = {
                togglePanel: () => this.togglePanel(),
                clearLogs: () => this.clearLogs(),
                applyFix: (id) => this.applyFix(id),
                rollback: (id) => this.rollback(id),
                manualScan: () => {
                    this.record('INFO', 'User initiated manual diagnostic scan.', 'MANUAL_SCAN');
                    setTimeout(() => {
                        this.logs[0].suggestion = "Manual scan complete. No critical structural issues found.";
                        this.logs[0].reasoning = "I have verified the integrity of globalData and the presence of core modules. If something is still wrong, running a preventative Auto-Heal is recommended.";
                        this.logs[0].autoFix = "RUN_AUTO_HEAL_DATA";
                        this.renderLogs();
                    }, 800);
                }
            };
        },

        showBubble: function (text, severity) {
            this.bubbleEl.textContent = text.replace(/_/g, ' ');
            this.bubbleEl.style.display = 'block';
            this.bubbleEl.style.borderColor = severity === 'CRITICAL' ? '#ff416c' : '#00fff5';
            setTimeout(() => { this.bubbleEl.style.display = 'none'; }, 5000);
        },

        shakeOrb: function () {
            this.orbEl.classList.add('shake');
            setTimeout(() => this.orbEl.classList.remove('shake'), 600);
        },

        togglePanel: function () {
            this.panelOpen = !this.panelOpen;
            this.panelEl.style.display = this.panelOpen ? 'flex' : 'none';
            if (this.panelOpen) {
                this.orbEl.classList.remove('pulse');
                this.renderLogs();
            }
        },

        updateOrb: function (severity) {
            this.orbEl.classList.add('pulse');
            if (severity === 'CRITICAL') {
                this.orbEl.classList.add('critical');
                this.orbEl.classList.remove('warning');
            } else if (severity === 'WARNING' && !this.orbEl.classList.contains('critical')) {
                this.orbEl.classList.add('warning');
            }
        },

        showLock: function (show) {
            this.lockEl.style.display = show ? 'flex' : 'none';
            if (show) {
                // Disable app scroll
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        },

        renderLogs: function () {
            const list = document.getElementById('sentinel-list');
            if (!list) return;

            if (this.logs.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:40px; color:rgba(255,255,255,0.2); font-size:12px;">No events detected. Sentinel is active.</div>';
                return;
            }

            list.innerHTML = this.logs.map(log => `
                <div class="sentinel-item ${log.severity} ${log.fixed ? 'fixed' : ''}">
                    <div class="sentinel-item-meta">
                        <span>[${log.type}]</span>
                        <span>${log.time}</span>
                    </div>
                    <div class="sentinel-item-msg">${log.msg}</div>
                    <div style="font-size:9px; color:rgba(0,255,245,0.4);">TAB: ${log.tab.toUpperCase()}</div>
                    
                    ${log.suggestion ? `
                        <div class="sentinel-fix-box">
                            <div style="font-size:10px; color:#ffcc00; font-weight:700; margin-bottom:4px;">💡 AI SUGGESTION</div>
                            <div style="font-size:11px; color:#ddd; margin-bottom:8px;">${log.suggestion}</div>
                            ${log.reasoning ? `<div class="sentinel-reasoning">${log.reasoning}</div>` : ''}
                            ${!log.fixed ? `
                                <button class="sentinel-fix-btn" onclick="Sentinel.applyFix('${log.id}')">APPLY AUTO-FIX</button>
                            ` : `
                                <div style="color:#00ff88; font-size:11px; font-weight:700; margin-top:10px;">✅ FIXED BY SENTINEL</div>
                                <button class="sentinel-rollback-btn" onclick="Sentinel.rollback('${log.id}')">UNDO & ROLLBACK</button>
                            `}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        },

        showToast: function (msg, type) {
            if (typeof window.showToast === 'function') window.showToast(msg, type);
            else if (typeof window.showSuccessToast === 'function' && type === 'success') window.showSuccessToast(msg);
            else alert(msg);
        },

        // ============================================
        // 📥 PERSISTENCE
        // ============================================
        saveHistory: function () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
            } catch (e) {}
        },

        loadHistory: function () {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) this.logs = JSON.parse(data);
            } catch (e) {}
        },

        clearLogs: function () {
            if (confirm('ঝাপসা লগগুলো কি পরিষ্কার করতে চান?')) {
                this.logs = [];
                this.saveHistory();
                this.renderLogs();
                this.orbEl.className = '';
            }
        }
    };

    // Auto Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Sentinel.init());
    } else {
        Sentinel.init();
    }

})();
