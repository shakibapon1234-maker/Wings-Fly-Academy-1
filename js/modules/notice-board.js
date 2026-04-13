/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/notice-board.js
   Legacy Notice Board Migration
════════════════════════════════════════════════ */

const NoticeBoardModule = (() => {

  let countdownInterval = null;
  let activeNotice = null;

  // ── INIT ────────────────────────────────────────────────
  // Called by App on load or route change to initialize the global banner
  function init() {
    injectBannerContainer();
    refreshActiveNotice();
  }

  function injectBannerContainer() {
    if (document.getElementById('noticeBoardBanner')) return;
    
    const bannerHTML = `
      <div id="noticeBoardBanner" class="notice-container" style="display:none; position:fixed; top:60px; left:0; right:0; z-index:9000; padding:12px 16px; margin:10px 20px; border-radius:12px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-align:center; align-items:center;">
        <span class="notice-icon" style="margin-right:10px; font-size:1.2rem; flex-shrink:0;"></span>
        <span id="noticeBannerText" style="flex-grow:1; margin-right:15px; display:inline-block; font-size:1rem;"></span>
        <span id="noticeBannerCountdown" style="background:rgba(0,0,0,0.2); padding:4px 10px; border-radius:30px; font-size:0.85rem; font-family:monospace; flex-shrink:0; margin-right:10px;"></span>
        <button onclick="NoticeBoardModule.dismissBanner()" title="Close notice" style="flex-shrink:0; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.3); color:#fff; width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:0.85rem; line-height:1; display:inline-flex; align-items:center; justify-content:center; transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.5)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'">✕</button>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
  }

  // Find the single active notice from DB
  function refreshActiveNotice() {
    if (!window.DB || !DB.notices) return; // DB not ready yet
    const all = SupabaseSync.getAll(DB.notices) || [];
    
    // Sort by descending created at
    all.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    activeNotice = null;
    hideBanner();

    for (let n of all) {
      if (typeof n.expiresAt === 'number' || typeof n.expiresAt === 'string') {
        const exp = new Date(n.expiresAt).getTime();
        if (exp > Date.now()) {
           activeNotice = n;
           break;
        }
      }
    }

    if (activeNotice) {
      // Don't re-show if user dismissed in this session
      try {
        const dismissed = sessionStorage.getItem('noticeDismissed');
        if (dismissed && dismissed === String(activeNotice.id || '1')) return;
      } catch(e) {}
      showBanner(activeNotice);
    }
  }

  // ── BANNER LOGIC ────────────────────────────────────────

  function showBanner(notice) {
    const banner = document.getElementById('noticeBoardBanner');
    const textEl = document.getElementById('noticeBannerText');
    const iconEl = banner.querySelector('.notice-icon');
    
    if (!banner || !textEl) return;

    const _nt = Utils.esc(notice.text || notice.title || '');
    textEl.innerHTML = _nt.replace(/\n/g, '<br/>');
    
    // Style based on type
    const type = notice.type || 'warning';
    if (type === 'danger') {
      banner.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #fca5a5';
      iconEl.textContent = '🚨';
    } else if (type === 'info') {
      banner.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #93c5fd';
      iconEl.textContent = 'ℹ️';
    } else if (type === 'success') {
      banner.style.background = 'linear-gradient(135deg, #22c55e, #15803d)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #86efac';
      iconEl.textContent = '✅';
    } else {
      // Default warning
      banner.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #fcd34d';
      iconEl.textContent = '⚠️';
    }

    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';

    startCountdown(notice.expiresAt);
  }

  function hideBanner() {
    const banner = document.getElementById('noticeBoardBanner');
    if (banner) banner.style.display = 'none';
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function startCountdown(expiresAtStr) {
    if (countdownInterval) clearInterval(countdownInterval);
    const expiresAt = new Date(expiresAtStr).getTime();
    
    updateTick(expiresAt);
    countdownInterval = setInterval(() => updateTick(expiresAt), 1000);
  }

  function updateTick(expiresAt) {
    const remaining = expiresAt - Date.now();
    const cdEl = document.getElementById('noticeBannerCountdown');
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      hideBanner();
      // Only delete locally if expired; actual DB purge happens manually or cron
      activeNotice = null;
      render(); // refresh module if open
      return;
    }

    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);

    let str = '';
    if (d > 0) str += `${d}d `;
    if (h > 0 || d > 0) str += `${h}h `;
    str += `${m}m ${s}s remaining`;
    
    if(cdEl) cdEl.textContent = str;
  }

  // ── UI MODULE RENDERING ─────────────────────────────────

  function render() {
    const container = document.getElementById('notice-board-content');
    if (!container) return;
    refreshActiveNotice();

    const allNotices = (window.DB && DB.notices) ? (SupabaseSync.getAll(DB.notices) || []).sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)) : [];
    const isRunning = activeNotice && new Date(activeNotice.expiresAt).getTime() > Date.now();
    const typeColors = { warning:'#f59e0b', info:'#3b82f6', danger:'#ef4444', success:'#22c55e' };
    const typeIcons  = { warning:'⚠️', info:'ℹ️', danger:'🚨', success:'✅' };

    container.innerHTML = `
      <div style="max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:18px">

        <!-- Window Header with Close Button -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 2px">
          <div style="font-size:1.05rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:9px">
            <i class="fa fa-bullhorn" style="color:#00d9ff"></i> নোটিশ বোর্ড
          </div>
          <button onclick="App.navigateTo('dashboard')" title="নোটিশ বোর্ড বন্ধ করুন"
            style="background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.22);
                   color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;
                   font-size:1rem;display:inline-flex;align-items:center;justify-content:center;
                   transition:background 0.2s,border-color 0.2s"
            onmouseover="this.style.background='rgba(239,68,68,0.3)';this.style.borderColor='rgba(239,68,68,0.6)'"
            onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='rgba(255,255,255,0.22)'">
            <i class="fa fa-xmark"></i>
          </button>
        </div>

        <!-- Active Notice Status -->
        <div style="background:${isRunning ? 'rgba(0,60,20,0.55)' : 'rgba(10,15,35,0.75)'};border:1.5px solid ${isRunning ? 'rgba(74,222,128,0.4)' : 'rgba(100,116,139,0.35)'};border-radius:14px;padding:18px 22px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:1.3rem">${isRunning ? '🟢' : '⚫'}</span>
              <div>
                <div style="font-size:.88rem;font-weight:700;color:${isRunning ? '#4ade80' : 'rgba(255,255,255,0.4)'}">
                  ${isRunning ? 'নোটিশ এখন চালু আছে' : 'কোনো নোটিশ চালু নেই'}
                </div>
                ${isRunning ? `<div style="font-size:.78rem;color:rgba(255,255,255,0.5);margin-top:3px">"${Utils.esc(activeNotice.text||activeNotice.title||'')}" — <span id="nb-countdown-inline"></span></div>` : ''}
              </div>
            </div>
            ${isRunning ? `<button onclick="NoticeBoardModule.deleteActive()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:600"><i class="fa fa-ban" style="margin-right:6px"></i>নোটিশ বন্ধ করুন</button>` : ''}
          </div>
        </div>

        <!-- Publish New Notice -->
        <div style="background:rgba(10,15,40,0.80);border:1px solid rgba(0,217,255,0.18);border-radius:14px;padding:20px 22px">
          <div style="font-size:.9rem;font-weight:700;color:#00d9ff;margin-bottom:14px"><i class="fa fa-paper-plane" style="margin-right:7px"></i>নতুন নোটিশ প্রকাশ করুন</div>
          <div style="margin-bottom:12px">
            <label style="font-size:.78rem;color:rgba(255,255,255,0.5);margin-bottom:5px;display:block">নোটিশের টেক্সট</label>
            <textarea id="noticeTextInput" class="form-control" rows="3" placeholder="নোটিশ লিখুন..." oninput="document.getElementById('noticeCharCount').innerText = this.value.length" style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
            <div style="text-align:right;font-size:.72rem;color:rgba(255,255,255,0.3);margin-top:3px"><span id="noticeCharCount">0</span> characters</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div>
              <label style="font-size:.78rem;color:rgba(255,255,255,0.5);margin-bottom:5px;display:block">নোটিশের ধরন</label>
              <select id="noticeTypeSelect" class="form-control" onchange="NoticeBoardModule.previewNotice()">
                <option value="warning">⚠️ Warning (Orange)</option>
                <option value="info">ℹ️ Information (Blue)</option>
                <option value="danger">🚨 Urgent (Red)</option>
                <option value="success">✅ Success (Green)</option>
              </select>
            </div>
            <div>
              <label style="font-size:.78rem;color:rgba(255,255,255,0.5);margin-bottom:5px;display:block">মেয়াদ</label>
              <select id="noticeDurationSelect" class="form-control" onchange="NoticeBoardModule.toggleCustom()">
                <option value="30">30 মিনিট</option>
                <option value="60">১ ঘন্টা</option>
                <option value="360">৬ ঘন্টা</option>
                <option value="720" selected>১২ ঘন্টা</option>
                <option value="1440">১ দিন</option>
                <option value="4320">৩ দিন</option>
                <option value="custom">কাস্টম...</option>
              </select>
            </div>
          </div>
          <div id="customDurationRow" style="display:none;background:rgba(0,0,0,0.2);padding:12px;border-radius:8px;margin-bottom:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <div><label style="font-size:.75rem;color:rgba(255,255,255,0.4)">দিন</label><input type="number" id="customDays" class="form-control" min="0" value="0"></div>
              <div><label style="font-size:.75rem;color:rgba(255,255,255,0.4)">ঘন্টা</label><input type="number" id="customHours" class="form-control" min="0" value="0"></div>
              <div><label style="font-size:.75rem;color:rgba(255,255,255,0.4)">মিনিট</label><input type="number" id="customMinutes" class="form-control" min="0" value="0"></div>
            </div>
          </div>
          <div id="noticePreviewArea" style="display:none;margin-bottom:12px;padding:12px;border:1px dashed rgba(255,255,255,0.15);border-radius:8px">
            <div style="font-size:.72rem;color:rgba(255,255,255,0.35);margin-bottom:8px;text-align:center">প্রিভিউ</div>
            <div id="noticePreviewBanner" style="padding:10px 16px;border-radius:10px;font-weight:bold;text-align:center">
              <span id="noticePreviewIcon" style="margin-right:8px;font-size:1rem"></span>
              <span id="noticePreviewText" style="font-size:.9rem"></span>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button onclick="NoticeBoardModule.previewNotice()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:.85rem"><i class="fa fa-eye" style="margin-right:6px"></i>প্রিভিউ</button>
            <button onclick="NoticeBoardModule.publish()" style="background:linear-gradient(135deg,#00a8f0,#1a5cff);border:none;color:#fff;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700"><i class="fa fa-paper-plane" style="margin-right:6px"></i>প্রকাশ করুন</button>
          </div>
        </div>

        <!-- All Notices List -->
        ${allNotices.length > 0 ? `
        <div style="background:rgba(10,15,40,0.80);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:18px 22px">
          <div style="font-size:.88rem;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:14px"><i class="fa fa-list" style="margin-right:7px"></i>সব নোটিশ (${allNotices.length} টি)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${allNotices.map(n => {
              const expired = new Date(n.expiresAt).getTime() < Date.now();
              const tc = typeColors[n.type||'warning'] || '#f59e0b';
              const ti = typeIcons[n.type||'warning'] || '⚠️';
              return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 14px;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                  <span style="font-size:1rem;flex-shrink:0">${ti}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:.85rem;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.esc(n.text||n.title||'')}</div>
                    <div style="font-size:.72rem;color:rgba(255,255,255,0.35);margin-top:3px">
                      ${expired ? '<span style="color:#f87171">মেয়াদ শেষ</span>' : '<span style="color:#4ade80">চালু</span>'} —
                      মেয়াদ: ${new Date(n.expiresAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button onclick="NoticeBoardModule.deleteNoticeById('${n.id}')" title="Delete permanently"
                  style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#f87171;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:600;flex-shrink:0">
                  <i class="fa fa-trash" style="margin-right:4px"></i>মুছুন
                </button>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      </div>
    `;

    // Start inline countdown for active notice
    if (isRunning && activeNotice) {
      const _tick = () => {
        const el = document.getElementById('nb-countdown-inline');
        if (!el) return;
        const rem = new Date(activeNotice.expiresAt).getTime() - Date.now();
        if (rem <= 0) { el.textContent = 'মেয়াদ শেষ'; return; }
        const h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000), s = Math.floor((rem%60000)/1000);
        el.textContent = `${h>0?h+'h ':''} ${m}m ${s}s বাকি`;
      };
      _tick();
      const _iv = setInterval(() => { if (!document.getElementById('nb-countdown-inline')) { clearInterval(_iv); return; } _tick(); }, 1000);
    }
  }

  // ── UI ACTIONS ──────────────────────────────────────────

  function toggleCustom() {
    const sel = document.getElementById('noticeDurationSelect');
    const row = document.getElementById('customDurationRow');
    if(sel && row) row.style.display = sel.value === 'custom' ? 'flex' : 'none';
  }

  function previewNotice() {
    const text = document.getElementById('noticeTextInput')?.value.trim();
    if (!text) return Utils.toast('Please write a notice to preview.', 'error');
    
    const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
    const banner = document.getElementById('noticePreviewBanner');
    const textEl = document.getElementById('noticePreviewText');
    const iconEl = document.getElementById('noticePreviewIcon');
    const area = document.getElementById('noticePreviewArea');

    textEl.textContent = text;
    
    if (type === 'danger') {
      banner.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #fca5a5';
      iconEl.textContent = '🚨';
    } else if (type === 'info') {
      banner.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #93c5fd';
      iconEl.textContent = 'ℹ️';
    } else if (type === 'success') {
      banner.style.background = 'linear-gradient(135deg, #22c55e, #15803d)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #86efac';
      iconEl.textContent = '✅';
    } else {
      banner.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      banner.style.color = '#fff';
      banner.style.border = '2px solid #fcd34d';
      iconEl.textContent = '⚠️';
    }

    area.style.display = 'block';
  }

  async function publish() {
    const text = document.getElementById('noticeTextInput')?.value.trim();
    if (!text) return Utils.toast('Notice text is required!', 'error');

    const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
    const durSel = document.getElementById('noticeDurationSelect');
    
    let durationMinutes = 720;
    if (durSel?.value === 'custom') {
      const d = parseInt(document.getElementById('customDays')?.value) || 0;
      const h = parseInt(document.getElementById('customHours')?.value) || 0;
      const m = parseInt(document.getElementById('customMinutes')?.value) || 0;
      durationMinutes = (d * 1440) + (h * 60) + m;
      if (durationMinutes < 1) return Utils.toast('Duration must be at least 1 minute.', 'error');
    } else {
      durationMinutes = parseInt(durSel?.value) || 720;
    }

    // Active notice থাকলে replace করার আগে confirm
    if (activeNotice && new Date(activeNotice.expiresAt).getTime() > Date.now()) {
      const ok = await Utils.confirm('একটি Notice ইতিমধ্যে চলছে। Replace করবেন?', 'Replace Notice');
      if (!ok) return;
    }

    const payload = {
      id: 'NOT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text: text,
      title: text, // legacy fallback support
      type: type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    };

    // Purge old notice in SupabaseSync DB to prevent clutter
    if (activeNotice && activeNotice.id) {
      SupabaseSync.remove(DB.notices, activeNotice.id);
    }
    
    SupabaseSync.insert(DB.notices, payload);
    Utils.toast('Global Notice Published successfully!', 'success');
    
    // Banner সাথে সাথে দেখাও
    activeNotice = payload;
    showBanner(payload);

    // Refresh UI
    render();
  }

  function deleteNoticeById(id) {
    if (!id) return;
    if (!window.confirm('এই নোটিশটি স্থায়ীভাবে মুছে ফেলবেন?')) return;
    SupabaseSync.remove(DB.notices, id);
    if (activeNotice && activeNotice.id === id) {
      activeNotice = null;
      hideBanner();
    }
    Utils.toast('নোটিশ মুছে গেছে', 'success');
    render();
  }

  async function deleteActive() {
    const ok = await Utils.confirm('Are you sure you want to disable the active notice?', 'Disable Notice');
    if (!ok) return;
    if (activeNotice && activeNotice.id) {
       SupabaseSync.remove(DB.notices, activeNotice.id);
    }
    activeNotice = null;
    hideBanner();
    Utils.toast('Notice Disabled.', 'success');
    render();
  }

  // Open legacy compatibility
  function openAddModal() {
     // No longer use modal, this section acts as the primary interface now.
     document.getElementById('noticeTextInput')?.focus();
  }

  // ── DISMISS BANNER (close without disabling the notice) ────────────────
  function dismissBanner() {
    hideBanner();
    // Store dismiss in sessionStorage so it doesn't re-show until page reload
    try { sessionStorage.setItem('noticeDismissed', activeNotice ? (activeNotice.id || '1') : '1'); } catch(e) {}
  }

  // Override refreshActiveNotice to respect dismissed state
  const _origRefresh = refreshActiveNotice;

  return { init, render, toggleCustom, previewNotice, publish, deleteActive, deleteNoticeById, openAddModal, dismissBanner };
})();

// Hook into App init sequence
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(NoticeBoardModule.init, 1000);
});
