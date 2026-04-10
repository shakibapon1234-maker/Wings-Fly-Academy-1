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
      <div id="noticeBoardBanner" class="notice-container" style="display:none; position:fixed; top:60px; left:0; right:0; z-index:9000; padding:12px; margin:10px 20px; border-radius:12px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-align:center;">
        <span class="notice-icon" style="margin-right:10px; font-size:1.2rem;"></span>
        <span id="noticeBannerText" style="flex-grow:1; margin-right:15px; display:inline-block; font-size:1rem;"></span>
        <span id="noticeBannerCountdown" style="background:rgba(0,0,0,0.2); padding:4px 10px; border-radius:30px; font-size:0.85rem; font-family:monospace;"></span>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
  }

  // Find the single active notice from DB
  function refreshActiveNotice() {
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
      showBanner(activeNotice);
    }
  }

  // ── BANNER LOGIC ────────────────────────────────────────

  function showBanner(notice) {
    const banner = document.getElementById('noticeBoardBanner');
    const textEl = document.getElementById('noticeBannerText');
    const iconEl = banner.querySelector('.notice-icon');
    
    if (!banner || !textEl) return;

    textEl.innerHTML = (notice.text || notice.title || '').replace(/\n/g, '<br/>');
    
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

    // Refresh context
    refreshActiveNotice();

    const isRunning = activeNotice && new Date(activeNotice.expiresAt).getTime() > Date.now();

    container.innerHTML = `
      <div class="card" style="max-width:800px; margin:0 auto; padding:30px;">
        <h3 class="mb-4 text-center text-primary" style="font-weight:700;"><i class="fa fa-bullhorn"></i> Global Notice Board</h3>
        
        ${isRunning ? 
          `<div class="text-center mb-4 p-4 rounded-3" style="border:1px solid #4ade80; background:rgba(34, 197, 94, 0.1);">
             <h4 class="text-success"><i class="fa fa-check-circle"></i> A Notice is currently Active</h4>
             <p class="mt-2 text-white">"${activeNotice.text || activeNotice.title}"</p>
             <p class="text-muted small">Expires at: ${new Date(activeNotice.expiresAt).toLocaleString()}</p>
             <button class="btn btn-danger mt-3" onclick="NoticeBoardModule.deleteActive()"><i class="fa fa-trash"></i> Disable Notice</button>
           </div>`
          : 
          `<div class="text-center mb-4 p-4 rounded-3" style="border:1px solid #64748b; background:rgba(100, 116, 139, 0.1);">
             <h5 class="text-muted"><i class="fa fa-info-circle"></i> No notice is currently active.</h5>
           </div>`
        }

        <div style="${isRunning ? 'opacity:0.5; pointer-events:none;' : ''}">
          <div class="form-group mb-3">
            <label>Notice Content</label>
            <textarea id="noticeTextInput" class="form-control" rows="3" placeholder="Type your notice here..." oninput="document.getElementById('noticeCharCount').innerText = this.value.length"></textarea>
            <div class="text-end text-muted small mt-1"><span id="noticeCharCount">0</span> characters</div>
          </div>

          <div class="row">
            <div class="col-md-6 form-group mb-3">
              <label>Notice Type (Color)</label>
              <select id="noticeTypeSelect" class="form-control" onchange="NoticeBoardModule.previewNotice()">
                <option value="warning">Warning (Orange)</option>
                <option value="info">Information (Blue)</option>
                <option value="danger">Urgent (Red)</option>
                <option value="success">Success (Green)</option>
              </select>
            </div>
            <div class="col-md-6 form-group mb-3">
              <label>Duration</label>
              <select id="noticeDurationSelect" class="form-control" onchange="NoticeBoardModule.toggleCustom()">
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="360">6 Hours</option>
                <option value="720" selected>12 Hours</option>
                <option value="1440">1 Day</option>
                <option value="4320">3 Days</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
          </div>

          <div id="customDurationRow" class="row mb-3" style="display:none; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
            <div class="col-4">
              <label class="small">Days</label>
              <input type="number" id="customDays" class="form-control" min="0" value="0">
            </div>
            <div class="col-4">
              <label class="small">Hours</label>
              <input type="number" id="customHours" class="form-control" min="0" value="0">
            </div>
            <div class="col-4">
              <label class="small">Minutes</label>
              <input type="number" id="customMinutes" class="form-control" min="0" value="0">
            </div>
          </div>

          <div class="form-actions mt-4" style="justify-content:center; gap:15px;">
            <button class="btn btn-secondary" onclick="NoticeBoardModule.previewNotice()"><i class="fa fa-eye"></i> Preview Banner</button>
            <button class="btn btn-primary" onclick="NoticeBoardModule.publish()"><i class="fa fa-paper-plane"></i> Publish Global Notice</button>
          </div>

          <!-- Preview Area -->
          <div id="noticePreviewArea" class="mt-4" style="display:none; padding:15px; border:1px dashed #64748b; border-radius:8px;">
            <h6 class="text-muted text-center mb-3">Banner Preview</h6>
            <div id="noticePreviewBanner" style="padding:12px; border-radius:12px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-align:center;">
              <span id="noticePreviewIcon" style="margin-right:10px; font-size:1.2rem;"></span>
              <span id="noticePreviewText" style="flex-grow:1; display:inline-block; font-size:1rem;"></span>
            </div>
          </div>

        </div>
      </div>
    `;
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

    const payload = {
      id: Utils.uid('NOT'),
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
    
    // Refresh
    render();
  }

  function deleteActive() {
    if (!confirm('Are you sure you want to disable the active notice?')) return;
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

  return { init, render, toggleCustom, previewNotice, publish, deleteActive, openAddModal };
})();

// Hook into App init sequence
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(NoticeBoardModule.init, 1000);
});
