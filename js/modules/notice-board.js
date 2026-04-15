/* ════════════════════════════════════════════════
   Wings Fly Aviation Academy
   js/modules/notice-board.js  — Redesigned
════════════════════════════════════════════════ */

const NoticeBoardModule = (() => {

  let countdownInterval = null;
  let activeNotice = null;
  let _inlineIv = null; // ✅ module-level tracker to prevent memory leaks

  // ── INIT ────────────────────────────────────────────────
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
        <button onclick="NoticeBoardModule.dismissBanner()" title="Close notice" style="flex-shrink:0; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.3); color:#fff; width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:0.85rem; line-height:1; display:inline-flex; align-items:center; justify-content:center;" onmouseover="this.style.background='rgba(0,0,0,0.5)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'">✕</button>
      </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
  }

  function refreshActiveNotice() {
    if (typeof DB === 'undefined' || typeof SupabaseSync === 'undefined' || !DB.notices) return;
    const all = SupabaseSync.getAll(DB.notices) || [];
    all.sort((a,b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
    activeNotice = null;
    hideBanner();
    for (let n of all) {
      if (typeof n.expiresAt === 'number' || typeof n.expiresAt === 'string') {
        if (new Date(n.expiresAt).getTime() > Date.now()) {
          activeNotice = n; break;
        }
      }
    }
    if (activeNotice) {
      try {
        const dismissed = sessionStorage.getItem('noticeDismissed');
        if (dismissed && dismissed === String(activeNotice.id || '1')) return;
      } catch(e) {}
      showBanner(activeNotice);
    }
  }

  // ── BANNER ──────────────────────────────────────────────
  function showBanner(notice) {
    const banner = document.getElementById('noticeBoardBanner');
    const textEl = document.getElementById('noticeBannerText');
    const iconEl = banner?.querySelector('.notice-icon');
    if (!banner || !textEl) return;
    textEl.innerHTML = Utils.esc(notice.text || notice.title || '').replace(/\n/g, '<br/>');
    const styles = {
      danger:  { bg: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: '#fca5a5', icon: '🚨' },
      info:    { bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: '#93c5fd', icon: 'ℹ️' },
      success: { bg: 'linear-gradient(135deg,#22c55e,#15803d)', border: '#86efac', icon: '✅' },
      warning: { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', border: '#fcd34d', icon: '⚠️' },
    };
    const s = styles[notice.type] || styles.warning;
    banner.style.background = s.bg;
    banner.style.color = '#fff';
    banner.style.border = `2px solid ${s.border}`;
    if (iconEl) iconEl.textContent = s.icon;
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    startCountdown(notice.expiresAt);
  }

  function hideBanner() {
    const b = document.getElementById('noticeBoardBanner');
    if (b) b.style.display = 'none';
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  function startCountdown(expiresAtStr) {
    if (countdownInterval) clearInterval(countdownInterval);
    const exp = new Date(expiresAtStr).getTime();
    updateTick(exp);
    countdownInterval = setInterval(() => updateTick(exp), 1000);
  }

  function updateTick(exp) {
    const rem = exp - Date.now();
    const cdEl = document.getElementById('noticeBannerCountdown');
    if (rem <= 0) { clearInterval(countdownInterval); hideBanner(); activeNotice = null; render(); return; }
    const d = Math.floor(rem/86400000), h = Math.floor((rem%86400000)/3600000);
    const m = Math.floor((rem%3600000)/60000), s = Math.floor((rem%60000)/1000);
    let str = '';
    if (d > 0) str += `${d}d `;
    if (h > 0 || d > 0) str += `${h}h `;
    str += `${m}m ${s}s remaining`;
    if (cdEl) cdEl.textContent = str;
  }

  // ── TYPE CONFIG ─────────────────────────────────────────
  const TYPE_CFG = {
    warning: { icon:'⚠️', label:'Warning',     color:'#f59e0b', glow:'rgba(245,158,11,0.25)',  bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.35)' },
    info:    { icon:'ℹ️', label:'Information', color:'#3b82f6', glow:'rgba(59,130,246,0.25)',  bg:'rgba(59,130,246,0.12)',  border:'rgba(59,130,246,0.35)' },
    danger:  { icon:'🚨', label:'Urgent',      color:'#ef4444', glow:'rgba(239,68,68,0.25)',   bg:'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.35)'  },
    success: { icon:'✅', label:'Success',     color:'#22c55e', glow:'rgba(34,197,94,0.25)',   bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.35)'  },
  };

  // ── RENDER ──────────────────────────────────────────────
  function render() {
    const container = document.getElementById('notice-board-content');
    if (!container) return;
    refreshActiveNotice();

    const allNotices = (window.DB && DB.notices)
      ? (SupabaseSync.getAll(DB.notices) || []).sort((a,b) => new Date(b.createdAt||b.date||0) - new Date(a.createdAt||a.date||0))
      : [];
    const isRunning = activeNotice && new Date(activeNotice.expiresAt).getTime() > Date.now();
    const activeCfg = isRunning ? (TYPE_CFG[activeNotice.type] || TYPE_CFG.warning) : null;

    container.innerHTML = `
      <div style="max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:20px; padding-bottom:32px;">

        <!-- ══ PAGE HEADER ══ -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; background:linear-gradient(135deg,#00d9ff22,#b537f222); border:1.5px solid rgba(0,217,255,0.3); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
              📢
            </div>
            <div>
              <div style="font-size:1.25rem; font-weight:900; color:#fff; letter-spacing:0.3px;">নোটিশ বোর্ড</div>
              <div style="font-size:0.75rem; color:rgba(255,255,255,0.4);">সকল ব্যবহারকারীর জন্য বৈশ্বিক বিজ্ঞপ্তি</div>
            </div>
          </div>
        </div>

        <!-- ══ ACTIVE STATUS CARD ══ -->
        <div style="
          background: ${isRunning
            ? `linear-gradient(135deg, ${activeCfg.bg}, rgba(0,0,0,0.3))`
            : 'linear-gradient(135deg, rgba(15,20,45,0.9), rgba(10,15,35,0.9))'};
          border: 1.5px solid ${isRunning ? activeCfg.border : 'rgba(255,255,255,0.08)'};
          border-radius: 16px;
          padding: 22px 24px;
          box-shadow: ${isRunning ? `0 0 30px ${activeCfg.glow}` : 'none'};
          position: relative; overflow: hidden;">
          ${isRunning ? `<div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:${activeCfg.glow};border-radius:50%;filter:blur(20px);pointer-events:none;"></div>` : ''}
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; position:relative;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:48px; height:48px; border-radius:50%; background:${isRunning ? activeCfg.bg : 'rgba(255,255,255,0.06)'}; border:2px solid ${isRunning ? activeCfg.border : 'rgba(255,255,255,0.1)'}; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                ${isRunning ? activeCfg.icon : '⚫'}
              </div>
              <div>
                <div style="font-size:0.92rem; font-weight:800; color:${isRunning ? activeCfg.color : 'rgba(255,255,255,0.3)'}; margin-bottom:4px;">
                  ${isRunning ? '● নোটিশ এখন সক্রিয়' : 'কোনো নোটিশ চালু নেই'}
                </div>
                ${isRunning ? `
                  <div style="font-size:0.82rem; color:rgba(255,255,255,0.65); max-width:400px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    "${Utils.esc(activeNotice.text||activeNotice.title||'')}"
                  </div>
                  <div style="font-size:0.75rem; color:rgba(255,255,255,0.35); margin-top:4px;">
                    <span id="nb-countdown-inline" style="font-family:monospace; color:${activeCfg.color}; font-weight:700;"></span>
                  </div>
                ` : '<div style="font-size:0.78rem; color:rgba(255,255,255,0.25);">নীচ থেকে নতুন নোটিশ প্রকাশ করুন</div>'}
              </div>
            </div>
            ${isRunning ? `
              <button onclick="NoticeBoardModule.deleteActive()"
                style="background:rgba(239,68,68,0.15); border:1.5px solid rgba(239,68,68,0.4); color:#f87171;
                       padding:9px 18px; border-radius:10px; cursor:pointer; font-size:0.82rem; font-weight:700;
                       display:flex; align-items:center; gap:7px; transition:all 0.2s;"
                onmouseover="this.style.background='rgba(239,68,68,0.3)'"
                onmouseout="this.style.background='rgba(239,68,68,0.15)'">
                <i class="fa fa-ban"></i> নোটিশ বন্ধ করুন
              </button>` : ''}
          </div>
        </div>

        <!-- ══ PUBLISH FORM CARD ══ -->
        <div style="background:linear-gradient(135deg,rgba(15,20,50,0.95),rgba(10,15,40,0.95)); border:1.5px solid rgba(0,217,255,0.15); border-radius:16px; padding:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4);">

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.07);">
            <div style="width:32px; height:32px; background:linear-gradient(135deg,#00d9ff,#b537f2); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
              <i class="fa fa-paper-plane" style="color:#fff;"></i>
            </div>
            <div style="font-size:0.95rem; font-weight:800; color:#fff;">নতুন নোটিশ প্রকাশ করুন</div>
          </div>

          <!-- Textarea -->
          <div style="margin-bottom:16px;">
            <label style="font-size:0.75rem; font-weight:700; color:rgba(255,255,255,0.45); letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:8px;">নোটিশের টেক্সট</label>
            <textarea id="noticeTextInput" rows="4" placeholder="এখানে নোটিশ লিখুন..."
              oninput="document.getElementById('noticeCharCount').innerText = this.value.length"
              style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; padding:12px 14px; font-size:0.92rem; resize:vertical; outline:none; font-family:inherit; transition:border-color 0.2s;"
              onfocus="this.style.borderColor='rgba(0,217,255,0.4)'"
              onblur="this.style.borderColor='rgba(255,255,255,0.1)'"></textarea>
            <div style="text-align:right; font-size:0.72rem; color:rgba(255,255,255,0.25); margin-top:4px;"><span id="noticeCharCount">0</span> characters</div>
          </div>

          <!-- Type + Duration row -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:rgba(255,255,255,0.45); letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:8px;">নোটিশের ধরন</label>
              <select id="noticeTypeSelect" onchange="NoticeBoardModule.previewNotice()"
                style="width:100%; background:rgba(0,0,0,0.3); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; padding:10px 14px; font-size:0.88rem; cursor:pointer; outline:none;">
                <option value="warning">⚠️ Warning (Orange)</option>
                <option value="info">ℹ️ Information (Blue)</option>
                <option value="danger">🚨 Urgent (Red)</option>
                <option value="success">✅ Success (Green)</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:rgba(255,255,255,0.45); letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:8px;">মেয়াদ</label>
              <select id="noticeDurationSelect" onchange="NoticeBoardModule.toggleCustom()"
                style="width:100%; background:rgba(0,0,0,0.3); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; padding:10px 14px; font-size:0.88rem; cursor:pointer; outline:none;">
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

          <!-- Custom duration -->
          <div id="customDurationRow" style="display:none; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px; margin-bottom:16px;">
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.4); margin-bottom:10px; font-weight:600;">কাস্টম মেয়াদ নির্ধারণ করুন</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:0.72rem; color:rgba(255,255,255,0.35); display:block; margin-bottom:5px;">দিন</label>
                <input type="number" id="customDays" min="0" value="0"
                  style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:8px 12px; font-size:0.9rem; outline:none;">
              </div>
              <div>
                <label style="font-size:0.72rem; color:rgba(255,255,255,0.35); display:block; margin-bottom:5px;">ঘন্টা</label>
                <input type="number" id="customHours" min="0" value="0"
                  style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:8px 12px; font-size:0.9rem; outline:none;">
              </div>
              <div>
                <label style="font-size:0.72rem; color:rgba(255,255,255,0.35); display:block; margin-bottom:5px;">মিনিট</label>
                <input type="number" id="customMinutes" min="0" value="0"
                  style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:8px 12px; font-size:0.9rem; outline:none;">
              </div>
            </div>
          </div>

          <!-- Preview area -->
          <div id="noticePreviewArea" style="display:none; margin-bottom:16px; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
            <div style="background:rgba(0,0,0,0.3); padding:8px 14px; font-size:0.72rem; color:rgba(255,255,255,0.35); letter-spacing:0.8px; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.07);">প্রিভিউ</div>
            <div id="noticePreviewBanner" style="padding:14px 18px; font-weight:700; display:flex; align-items:center; gap:10px;">
              <span id="noticePreviewIcon" style="font-size:1.1rem;"></span>
              <span id="noticePreviewText" style="font-size:0.9rem; flex:1;"></span>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button onclick="NoticeBoardModule.previewNotice()"
              style="background:rgba(255,255,255,0.07); border:1.5px solid rgba(255,255,255,0.15); color:#fff;
                     padding:10px 20px; border-radius:10px; cursor:pointer; font-size:0.85rem; font-weight:700;
                     display:flex; align-items:center; gap:8px; transition:all 0.2s;"
              onmouseover="this.style.background='rgba(255,255,255,0.12)'"
              onmouseout="this.style.background='rgba(255,255,255,0.07)'">
              <i class="fa fa-eye"></i> প্রিভিউ
            </button>
            <button onclick="NoticeBoardModule.publish()"
              style="background:linear-gradient(135deg,#00a8f0,#1a5cff); border:none; color:#fff;
                     padding:10px 24px; border-radius:10px; cursor:pointer; font-size:0.88rem; font-weight:800;
                     display:flex; align-items:center; gap:8px; box-shadow:0 4px 16px rgba(0,168,240,0.35); transition:all 0.2s;"
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 20px rgba(0,168,240,0.5)'"
              onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 16px rgba(0,168,240,0.35)'">
              <i class="fa fa-paper-plane"></i> প্রকাশ করুন
            </button>
          </div>
        </div>

        <!-- ══ NOTICES LIST ══ -->
        ${allNotices.length > 0 ? `
        <div style="background:linear-gradient(135deg,rgba(15,20,50,0.95),rgba(10,15,40,0.95)); border:1.5px solid rgba(255,255,255,0.08); border-radius:16px; padding:22px; box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.07);">
            <div style="width:32px; height:32px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.88rem; color:rgba(255,255,255,0.5);">
              <i class="fa fa-list"></i>
            </div>
            <div style="font-size:0.9rem; font-weight:700; color:rgba(255,255,255,0.6);">
              সব নোটিশ
              <span style="background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:20px; margin-left:6px;">${allNotices.length} টি</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${allNotices.map(n => {
              const expired = new Date(n.expiresAt).getTime() < Date.now();
              const cfg = TYPE_CFG[n.type||'warning'] || TYPE_CFG.warning;
              return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;
                          background:rgba(255,255,255,0.04); border:1px solid ${expired ? 'rgba(255,255,255,0.07)' : cfg.border};
                          border-left:3px solid ${expired ? 'rgba(255,255,255,0.15)' : cfg.color};
                          border-radius:10px; padding:14px 16px; flex-wrap:wrap;
                          ${!expired ? `box-shadow:0 2px 12px ${cfg.glow};` : ''}">
                <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                  <span style="font-size:1.1rem; flex-shrink:0;">${cfg.icon}</span>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:0.87rem; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">
                      ${Utils.esc(n.text||n.title||'')}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:5px; flex-wrap:wrap;">
                      <span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:20px; background:${expired ? 'rgba(255,255,255,0.07)' : cfg.bg}; color:${expired ? 'rgba(255,255,255,0.3)' : cfg.color}; border:1px solid ${expired ? 'rgba(255,255,255,0.1)' : cfg.border};">
                        ${expired ? 'মেয়াদ শেষ' : '● সক্রিয়'}
                      </span>
                      <span style="font-size:0.72rem; color:rgba(255,255,255,0.3);">
                        মেয়াদ: ${new Date(n.expiresAt).toLocaleString('bn-BD')}
                      </span>
                    </div>
                  </div>
                </div>
                <button onclick="NoticeBoardModule.deleteNoticeById('${n.id}')"
                  style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171;
                         padding:7px 14px; border-radius:8px; cursor:pointer; font-size:0.78rem; font-weight:700;
                         flex-shrink:0; display:flex; align-items:center; gap:6px; transition:all 0.2s;"
                  onmouseover="this.style.background='rgba(239,68,68,0.25)'"
                  onmouseout="this.style.background='rgba(239,68,68,0.1)'">
                  <i class="fa fa-trash"></i> মুছুন
                </button>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      </div>
    `;

    // Inline countdown — clear previous interval first to prevent memory leak
    if (_inlineIv) { clearInterval(_inlineIv); _inlineIv = null; }
    if (isRunning && activeNotice) {
      const _tick = () => {
        const el = document.getElementById('nb-countdown-inline');
        if (!el) { clearInterval(_inlineIv); _inlineIv = null; return; }
        const rem = new Date(activeNotice.expiresAt).getTime() - Date.now();
        if (rem <= 0) { el.textContent = 'মেয়াদ শেষ'; clearInterval(_inlineIv); _inlineIv = null; return; }
        const h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000), s = Math.floor((rem%60000)/1000);
        el.textContent = `${h>0?h+'h ':''} ${m}m ${s}s বাকি`;
      };
      _tick();
      _inlineIv = setInterval(_tick, 1000);
    }
  }

  // ── UI ACTIONS ──────────────────────────────────────────
  function toggleCustom() {
    const sel = document.getElementById('noticeDurationSelect');
    const row = document.getElementById('customDurationRow');
    if (sel && row) row.style.display = sel.value === 'custom' ? 'flex' : 'none';
  }

  function previewNotice() {
    const text = document.getElementById('noticeTextInput')?.value.trim();
    if (!text) return Utils.toast('প্রিভিউ করতে নোটিশ লিখুন', 'error');
    const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
    const cfg = TYPE_CFG[type] || TYPE_CFG.warning;
    const area   = document.getElementById('noticePreviewArea');
    const banner = document.getElementById('noticePreviewBanner');
    const textEl = document.getElementById('noticePreviewText');
    const iconEl = document.getElementById('noticePreviewIcon');
    if (!area) return;
    iconEl.textContent = cfg.icon;
    textEl.textContent = text;
    banner.style.background = cfg.bg;
    banner.style.border = `1px solid ${cfg.border}`;
    iconEl.style.color = cfg.color;
    textEl.style.color = '#fff';
    area.style.display = 'block';
  }

  async function publish() {
    const text = document.getElementById('noticeTextInput')?.value.trim();
    if (!text) return Utils.toast('নোটিশের টেক্সট আবশ্যক!', 'error');
    const type = document.getElementById('noticeTypeSelect')?.value || 'warning';
    const durSel = document.getElementById('noticeDurationSelect');
    let durationMinutes = 720;
    if (durSel?.value === 'custom') {
      const d = parseInt(document.getElementById('customDays')?.value) || 0;
      const h = parseInt(document.getElementById('customHours')?.value) || 0;
      const m = parseInt(document.getElementById('customMinutes')?.value) || 0;
      durationMinutes = (d * 1440) + (h * 60) + m;
      if (durationMinutes < 1) return Utils.toast('মেয়াদ কমপক্ষে ১ মিনিট হতে হবে', 'error');
    } else {
      durationMinutes = parseInt(durSel?.value) || 720;
    }
    if (activeNotice && new Date(activeNotice.expiresAt).getTime() > Date.now()) {
      const ok = await Utils.confirm('একটি নোটিশ ইতিমধ্যে চলছে। Replace করবেন?', 'Replace Notice');
      if (!ok) return;
    }
    const payload = {
      id: 'NOT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text, title: text, content: text, type,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    };
    if (activeNotice?.id) SupabaseSync.remove(DB.notices, activeNotice.id);
    SupabaseSync.insert(DB.notices, payload);
    Utils.toast('নোটিশ সফলভাবে প্রকাশিত হয়েছে!', 'success');
    activeNotice = payload;
    showBanner(payload);
    render();
  }

  async function deleteNoticeById(id) {
    if (!id) return;
    const ok = await Utils.confirm('এই নোটিশটি স্থায়ীভাবে মুছে ফেলবেন?', 'মুছে ফেলুন');
    if (!ok) return;
    SupabaseSync.remove(DB.notices, id);
    if (activeNotice && activeNotice.id === id) { activeNotice = null; hideBanner(); }
    Utils.toast('নোটিশ মুছে গেছে', 'success');
    render();
  }

  async function deleteActive() {
    const ok = await Utils.confirm('সক্রিয় নোটিশ বন্ধ করবেন?', 'নোটিশ বন্ধ');
    if (!ok) return;
    if (activeNotice?.id) SupabaseSync.remove(DB.notices, activeNotice.id);
    activeNotice = null;
    hideBanner();
    Utils.toast('নোটিশ বন্ধ করা হয়েছে', 'success');
    render();
  }

  function openAddModal() { document.getElementById('noticeTextInput')?.focus(); }

  function dismissBanner() {
    hideBanner();
    try { localStorage.setItem('noticeDismissed', activeNotice ? (activeNotice.id || '1') : '1'); } catch(e) {}
  }

  return { init, render, toggleCustom, previewNotice, publish, deleteActive, deleteNoticeById, openAddModal, dismissBanner };
})();
window.NoticeBoard = NoticeBoardModule;

document.addEventListener('DOMContentLoaded', () => { setTimeout(NoticeBoardModule.init, 1000); });
