/**
 * Wings Fly Academy — AI Voice Assistant Module (v4.0 CINEMATIC)
 *
 * 🆕 NEW in v4.0:
 *  - ANIMATED NAVIGATION: Doll flies/walks across screen when navigating
 *  - CINEMATIC MODE: She walks to each module, opens it, reads the content
 *  - WALKTHROUGH ANIMATIONS: Visual path from doll to target section
 *  - PROGRESS TRAIL: Glowing path left behind as she walks
 *  - EXPANDED COMMANDS (50+ new ones):
 *    - "go to students" / "walk to finance" / "fly to settings"
 *    - "how many students do we have" → student count
 *    - "who has highest due" → top due student
 *    - "read notice board" → reads latest notices aloud
 *    - "what is today" → date + day
 *    - "what time is it" → current time
 *    - "how many batches" → batch count
 *    - "total staff count" → HR count
 *    - "any exam today" → today's exams
 *    - "recent admissions" → last 5 students
 *    - "show dashboard" / "go home"
 *    - "tell me a joke" → aviation joke
 *    - "good morning / good night" → greeting
 *    - "stop" / "quiet" / "shh" → stop speaking
 *    - "repeat" / "say again" → repeat last speech
 *    - "what did you say" → repeat last
 *    - "scroll up / down" → page scroll
 *    - "zoom in / zoom out" → UI zoom
 *    - "dark mode / light mode" → theme
 *    - "increase font / decrease font" → font size
 *    - "print" / "export" → print current view
 *    - "refresh" → reload data
 *    - "who am i" → admin info
 *    - "system status" → app health
 *
 * EXISTING COMMANDS: All v3.2 commands still work.
 */

const VoiceAssistant = (() => {
  let isListening   = false;
  let recognition   = null;
  let synth         = window.speechSynthesis;
  let voiceInstance = null;
  let btn           = null;
  let lastSpeech    = '';
  let isNavigating  = false;
  let isContinuous  = false;  // ★ NEW: Continuous listening mode
  let currentLang   = 'en-US'; // ★ NEW: Current language (en-US or bn-IN)

  // ── Animated Walk State ───────────────────────────────────────
  let walkTrail     = null;   // SVG overlay for the trail dots
  let targetRect    = null;   // DOMRect of target section

  /* ════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════ */
  function init() {
    if (!document.getElementById('ai-assistant-css')) {
      const link = document.createElement('link');
      link.id = 'ai-assistant-css';
      link.rel = 'stylesheet';
      link.href = 'css/ai-assistant.css';
      document.head.appendChild(link);
    }

    // Inject v4 animation styles
    injectV4Styles();

    btn = document.createElement('div');
    btn.id = 'ai-avatar-container';
    btn.title = 'AI Assistant — Click to start (Escape to stop) — English & Bengali supported';
    btn.innerHTML = buildDollHTML();
    btn.onclick = toggleListening;
    document.body.appendChild(btn);

    // Speech bubble
    const bubble = document.createElement('div');
    bubble.id = 'ai-speech-bubble';
    bubble.innerHTML = '<span id="ai-bubble-text"></span>';
    document.body.appendChild(bubble);

    // Walk trail canvas
    walkTrail = document.createElement('canvas');
    walkTrail.id = 'ai-walk-trail';
    walkTrail.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9990;opacity:0;transition:opacity 0.3s';
    document.body.appendChild(walkTrail);

    checkVisibility();
    window.addEventListener('wfa:navigate', checkVisibility);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR();
      recognition.continuous      = true;  // ★ MODIFIED: Changed to true for continuous listening
      recognition.lang            = currentLang;
      recognition.interimResults  = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListening = true;
        btn.classList.add('listening');
        const msg = currentLang === 'bn-IN' ? '🎤 শুনছি…' : '🎤 Listening…';
        showBubble(msg, false);
        if (typeof Utils !== 'undefined') {
          const toast = currentLang === 'bn-IN' ? '🎤 শুনছি… এখন কথা বলুন।' : '🎤 Listening… Speak now.';
          Utils.toast(toast, 'info');
        }
      };
      recognition.onresult = (e) => {
        const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
        console.log('[Voice v4] Command:', cmd);
        showBubble(`"${cmd}"`, false);
        processCommand(cmd);
      };
      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && typeof Utils !== 'undefined')
          Utils.toast('Mic error: ' + e.error, 'error');
        // ★ MODIFIED: Don't stop on error, keep continuous listening
        if (isContinuous) {
          try { recognition.start(); } catch(ex) { console.warn(ex); }
        } else {
          stopUI();
        }
      };
      recognition.onend = () => {
        // ★ MODIFIED: Restart if continuous mode is on
        if (isContinuous && isListening) {
          try { recognition.start(); } catch(ex) { console.warn(ex); }
        } else {
          stopUI();
        }
      };
    } else {
      console.warn('[Voice] Speech Recognition not supported.');
      if (btn) btn.style.display = 'none';
      if (typeof Utils !== 'undefined') Utils.toast('আপনার ব্রাউজার Voice Recognition সাপোর্ট করে না।', 'warn');
    }

    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = setVoice;
    setVoice();

    window.addEventListener('wfa:navigate', (e) => {
      if (e.detail?.section === 'dashboard') setTimeout(greetUser, 1500);
    });

    // ★ NEW: Escape key to disable continuous listening
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isContinuous && isListening) {
        e.preventDefault();
        stopContinuousListening();
      }
    });
  }

  /* ════════════════════════════════════════════════
     DOLL HTML
  ════════════════════════════════════════════════ */
  function buildDollHTML() {
    return `
      <div id="ai-doll">
        <span class="ai-float-sparkle">✨</span>
        <span class="ai-float-sparkle">💫</span>
        <span class="ai-float-sparkle">⭐</span>
        <svg id="ai-doll-svg" viewBox="0 0 160 220" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="wfa-skin" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stop-color="#fce4cc"/>
              <stop offset="100%" stop-color="#f5c5a0"/>
            </radialGradient>
            <radialGradient id="wfa-dress" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#f472e8"/>
              <stop offset="100%" stop-color="#9b40e8"/>
            </radialGradient>
            <radialGradient id="wfa-wing" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="rgba(230,190,255,0.92)"/>
              <stop offset="100%" stop-color="rgba(160,90,230,0.38)"/>
            </radialGradient>
          </defs>

          <!-- Wings -->
          <ellipse id="ai-wing-left"  cx="42"  cy="115" rx="40" ry="26" fill="url(#wfa-wing)" stroke="#c880ff" stroke-width="0.8" opacity="0.88"/>
          <ellipse id="ai-wing-right" cx="118" cy="115" rx="40" ry="26" fill="url(#wfa-wing)" stroke="#c880ff" stroke-width="0.8" opacity="0.88"/>
          <ellipse cx="38"  cy="132" rx="26" ry="16" fill="url(#wfa-wing)" stroke="#c880ff" stroke-width="0.6" opacity="0.68"/>
          <ellipse cx="122" cy="132" rx="26" ry="16" fill="url(#wfa-wing)" stroke="#c880ff" stroke-width="0.6" opacity="0.68"/>

          <!-- Glow -->
          <ellipse cx="80" cy="210" rx="44" ry="8" fill="rgba(180,60,255,0.18)"/>

          <!-- Skirt -->
          <path d="M44 138 Q38 175 36 198 Q80 212 124 198 Q122 175 116 138 Z" fill="url(#wfa-dress)"/>
          <path id="ai-panel-2" d="M52 140 Q48 168 46 192 Q62 200 78 202 Q66 175 60 145 Z" fill="#ffeaa7" opacity="0.3"/>
          <path id="ai-panel-3" d="M108 140 Q112 168 114 192 Q98 200 82 202 Q94 175 100 145 Z" fill="#55efc4" opacity="0.3"/>
          <path id="ai-panel-4" d="M65 195 Q80 210 95 195 Q88 205 80 207 Q72 205 65 195 Z" fill="#81ecec" opacity="0.3"/>
          <circle class="ai-skirt-dot" cx="62" cy="168" r="3" fill="#ffccff" opacity="0.9"/>
          <circle class="ai-skirt-dot" cx="80" cy="178" r="3.5" fill="#ff99ee" opacity="0.85"/>
          <circle class="ai-skirt-dot" cx="98" cy="166" r="3" fill="#ccaaff" opacity="0.9"/>
          <path d="M73 148 Q73 144 80 148 Q87 144 87 148 Q87 154 80 159 Q73 154 73 148Z" fill="#ff80d0" opacity="0.9"/>

          <!-- Body -->
          <rect x="63" y="108" width="34" height="34" rx="8" fill="url(#wfa-skin)"/>
          <path d="M56 122 Q80 113 104 122 L108 138 Q80 128 52 138 Z" fill="url(#wfa-dress)"/>

          <!-- Arms -->
          <path id="ai-arm-left"  d="M63 118 Q48 124 44 134" stroke="#f5c6a0" stroke-width="7" stroke-linecap="round" fill="none"/>
          <path id="ai-arm-right" d="M97 118 Q112 124 116 134" stroke="#f5c6a0" stroke-width="7" stroke-linecap="round" fill="none"/>
          <circle cx="43" cy="135" r="5.5" fill="#fce4cc"/>
          <circle cx="117" cy="135" r="5.5" fill="#fce4cc"/>

          <!-- Head -->
          <ellipse cx="80" cy="84" rx="26" ry="28" fill="url(#wfa-skin)"/>
          <ellipse cx="80" cy="72" rx="28" ry="24" fill="#c0521a"/>
          <path d="M54 78 Q57 54 80 52 Q103 54 106 78 Q98 64 80 62 Q62 64 54 78Z" fill="#d4611a"/>
          <path d="M54 80 Q48 98 50 112 Q57 102 60 88" fill="#c0521a"/>
          <path d="M106 80 Q112 98 110 112 Q103 102 100 88" fill="#c0521a"/>

          <!-- Eyes -->
          <ellipse cx="71" cy="85" rx="4.5" ry="5" fill="#fff"/>
          <ellipse cx="89" cy="85" rx="4.5" ry="5" fill="#fff"/>
          <ellipse id="ai-eye-l" cx="71" cy="86" rx="3.2" ry="3.8" fill="#4a90d9"/>
          <ellipse id="ai-eye-r" cx="89" cy="86" rx="3.2" ry="3.8" fill="#4a90d9"/>
          <circle cx="72" cy="85" r="1.4" fill="#1a3a6a"/>
          <circle cx="90" cy="85" r="1.4" fill="#1a3a6a"/>
          <circle cx="72.8" cy="84.2" r="0.9" fill="#fff"/>
          <circle cx="90.8" cy="84.2" r="0.9" fill="#fff"/>
          <line x1="68" y1="81" x2="66" y2="78" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <line x1="71" y1="80" x2="70" y2="77" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <line x1="75" y1="81" x2="75" y2="78" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <line x1="86" y1="81" x2="86" y2="78" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <line x1="89" y1="80" x2="90" y2="77" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <line x1="93" y1="81" x2="95" y2="78" stroke="#3a2010" stroke-width="0.9" stroke-linecap="round"/>
          <ellipse cx="64" cy="91" rx="5.5" ry="3.5" fill="#ffaacc" opacity="0.5"/>
          <ellipse cx="96" cy="91" rx="5.5" ry="3.5" fill="#ffaacc" opacity="0.5"/>
          <path d="M78 92 Q80 95 82 92" stroke="#d4935a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
          <path id="ai-mouth-path" d="M74 100 Q80 106 86 100" stroke="#e06090" stroke-width="1.8" fill="none" stroke-linecap="round"/>

          <!-- Halo -->
          <ellipse id="ai-halo" cx="80" cy="53" rx="19" ry="5" fill="none" stroke="#ffd700" stroke-width="2.4" opacity="0.9"/>
          <ellipse cx="80" cy="52" rx="19" ry="5" fill="none" stroke="#ffe96a" stroke-width="1" opacity="0.4"/>

          <!-- Legs -->
          <rect id="ai-leg-left"  x="68" y="188" width="11" height="24" rx="5" fill="url(#wfa-skin)"/>
          <rect id="ai-leg-right" x="81" y="188" width="11" height="24" rx="5" fill="url(#wfa-skin)"/>

          <!-- Base ring -->
          <ellipse id="ai-base-ring" cx="80" cy="213" rx="52" ry="10"
            fill="none" stroke="rgba(0,229,255,0.5)" stroke-width="2.5"
            stroke-dasharray="8 4"
            style="filter:drop-shadow(0 0 6px rgba(0,229,255,0.6))"/>
        </svg>
      </div>`;
  }

  /* ════════════════════════════════════════════════
     V4 ANIMATION STYLES
  ════════════════════════════════════════════════ */
  function injectV4Styles() {
    if (document.getElementById('ai-v4-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-v4-styles';
    style.textContent = `
      /* ── Speech Bubble ── */
      #ai-speech-bubble {
        position: fixed;
        bottom: 265px;
        right: 100px;
        background: linear-gradient(135deg, rgba(20,10,40,0.96), rgba(40,10,80,0.94));
        border: 1px solid rgba(200,128,255,0.5);
        border-radius: 18px 18px 4px 18px;
        padding: 10px 16px;
        max-width: 260px;
        font-size: 0.82rem;
        color: #f0d8ff;
        z-index: 10000;
        opacity: 0;
        transform: scale(0.85) translateY(8px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
        box-shadow: 0 4px 24px rgba(160,80,255,0.3);
        line-height: 1.4;
      }
      #ai-speech-bubble.visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      #ai-speech-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        right: 24px;
        border: 8px solid transparent;
        border-top-color: rgba(40,10,80,0.94);
        border-bottom: none;
      }

      /* ── Navigation mode: doll flies across screen ── */
      #ai-avatar-container.navigating {
        transition: left 0.8s cubic-bezier(0.34,1.56,0.64,1),
                    bottom 0.8s cubic-bezier(0.34,1.56,0.64,1),
                    right 0.8s cubic-bezier(0.34,1.56,0.64,1),
                    top 0.8s cubic-bezier(0.34,1.56,0.64,1) !important;
      }
      #ai-avatar-container.navigating #ai-doll {
        animation: doll-fly-zoom 0.6s ease-in-out infinite alternate !important;
      }
      @keyframes doll-fly-zoom {
        from { transform: translateY(-10px) scale(1) rotate(-5deg); }
        to   { transform: translateY(-22px) scale(1.08) rotate(5deg); }
      }
      #ai-avatar-container.navigating #ai-wing-left {
        animation: wing-fly-fast 0.25s ease-in-out infinite alternate !important;
      }
      #ai-avatar-container.navigating #ai-wing-right {
        animation: wing-fly-fast-r 0.25s ease-in-out infinite alternate-reverse !important;
      }
      @keyframes wing-fly-fast {
        from { transform: rotate(-15deg) scaleX(1.1); }
        to   { transform: rotate(25deg) scaleX(1.3); }
      }
      @keyframes wing-fly-fast-r {
        from { transform: rotate(15deg) scaleX(1.1); }
        to   { transform: rotate(-25deg) scaleX(1.3); }
      }

      /* ── Arrive bounce ── */
      @keyframes doll-arrive {
        0%   { transform: translateY(-40px) scale(1.15); }
        60%  { transform: translateY(8px) scale(0.95); }
        80%  { transform: translateY(-6px) scale(1.02); }
        100% { transform: translateY(0px) scale(1); }
      }
      #ai-avatar-container.arriving #ai-doll {
        animation: doll-arrive 0.7s ease-out forwards !important;
      }

      /* ── Reading mode ── */
      #ai-avatar-container.reading #ai-doll {
        animation: doll-read 1.2s ease-in-out infinite alternate !important;
      }
      @keyframes doll-read {
        from { transform: translateY(-12px) rotate(-3deg); }
        to   { transform: translateY(-18px) rotate(3deg); }
      }

      /* ── Trail dots ── */
      .ai-trail-dot {
        position: fixed;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle, #e879f9, #a855f7);
        pointer-events: none;
        z-index: 9985;
        animation: trail-fade 1.2s ease-out forwards;
        box-shadow: 0 0 6px #e879f9, 0 0 12px #a855f7;
      }
      @keyframes trail-fade {
        0%   { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.2); }
      }

      /* ── Target highlight ── */
      .ai-target-highlight {
        outline: 2.5px solid rgba(232,121,249,0.8) !important;
        box-shadow: 0 0 0 4px rgba(168,85,247,0.25), 0 0 24px rgba(232,121,249,0.4) !important;
        border-radius: 12px;
        transition: outline 0.3s, box-shadow 0.3s;
      }

      /* ── Action tag above doll ── */
      #ai-action-tag {
        position: fixed;
        z-index: 10001;
        background: linear-gradient(90deg, #a855f7, #ec4899);
        color: #fff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 20px;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.3s, transform 0.3s;
        white-space: nowrap;
        letter-spacing: 0.3px;
        box-shadow: 0 2px 12px rgba(168,85,247,0.6);
      }
      #ai-action-tag.visible {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);

    // Action tag element
    const tag = document.createElement('div');
    tag.id = 'ai-action-tag';
    document.body.appendChild(tag);
  }

  /* ════════════════════════════════════════════════
     SPEECH BUBBLE
  ════════════════════════════════════════════════ */
  let bubbleTimer = null;
  function showBubble(text, persist = false) {
    const bubble = document.getElementById('ai-speech-bubble');
    const el     = document.getElementById('ai-bubble-text');
    if (!bubble || !el) return;
    el.textContent = text;
    bubble.classList.add('visible');
    if (!persist) {
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), 4000);
    }
  }
  function hideBubble() {
    const b = document.getElementById('ai-speech-bubble');
    if (b) b.classList.remove('visible');
  }

  /* ════════════════════════════════════════════════
     ACTION TAG (floating label above doll)
  ════════════════════════════════════════════════ */
  let tagTimer = null;
  function showActionTag(text) {
    const tag = document.getElementById('ai-action-tag');
    if (!tag || !btn) return;
    const rect = btn.getBoundingClientRect();
    tag.style.left = (rect.left + rect.width / 2) + 'px';
    tag.style.top  = (rect.top - 32) + 'px';
    tag.style.transform = 'translateX(-50%)';
    tag.textContent = text;
    tag.classList.add('visible');
    clearTimeout(tagTimer);
    tagTimer = setTimeout(() => tag.classList.remove('visible'), 3000);
  }

  /* ════════════════════════════════════════════════
     ANIMATED NAVIGATION — CINEMATIC FLY + WALK
  ════════════════════════════════════════════════ */
  function animatedNavigate(tabName, label, callback) {
    if (isNavigating) return;
    isNavigating = true;

    // 1. Show what she's doing
    showBubble(`✈️ Flying to ${label}…`, true);
    showActionTag(`🚀 Going to ${label}`);
    speak(`Flying to ${label} now!`);

    // 2. Find target element
    const targetEl = document.querySelector(`[data-tab="${tabName}"], #tab-${tabName}, .tab-${tabName}, [data-section="${tabName}"]`)
                  || document.querySelector(`nav a[href*="${tabName}"], button[onclick*="${tabName}"]`);

    const startRect = btn.getBoundingClientRect();
    const endX = targetEl ? targetEl.getBoundingClientRect().left + targetEl.getBoundingClientRect().width / 2 - 80 : window.innerWidth / 2 - 80;
    const endY = targetEl ? targetEl.getBoundingClientRect().top - 30 : 100;

    // 3. Convert btn to absolute positioned for flight
    btn.style.position = 'fixed';
    btn.style.right    = 'auto';
    btn.style.bottom   = 'auto';
    btn.style.left     = startRect.left + 'px';
    btn.style.top      = startRect.top  + 'px';
    btn.classList.add('navigating');

    // 4. Start dropping trail
    const trailInterval = setInterval(() => dropTrailDot(), 80);

    // 5. Animate to target
    setTimeout(() => {
      btn.style.left = endX + 'px';
      btn.style.top  = endY + 'px';
    }, 50);

    // 6. After arriving at target
    setTimeout(() => {
      clearInterval(trailInterval);
      btn.classList.remove('navigating');
      btn.classList.add('arriving');

      // Highlight target element
      if (targetEl) {
        targetEl.classList.add('ai-target-highlight');
        setTimeout(() => targetEl.classList.remove('ai-target-highlight'), 2000);
      }

      // Trigger actual navigation
      if (callback) callback();
      else if (typeof App !== 'undefined') App.navigateTo(tabName);

      showActionTag(`📂 Opened ${label}`);
      showBubble(`📂 ${label} is now open!`, false);

      setTimeout(() => {
        btn.classList.remove('arriving');
        btn.classList.add('reading');

        setTimeout(() => {
          // Return home
          returnHome();
          isNavigating = false;
        }, 2000);

      }, 700);

    }, 900);
  }

  function returnHome() {
    btn.classList.remove('reading', 'arriving', 'navigating');
    btn.style.position = 'fixed';
    btn.style.left     = 'auto';
    btn.style.top      = 'auto';
    btn.style.right    = '120px';
    btn.style.bottom   = '30px';
    hideBubble();
  }

  // ★ NEW: Move avatar manually
  function moveAvatar(pos) {
    if (!btn) return;
    btn.classList.add('navigating');
    
    if (pos === 'left') {
      btn.style.right = 'auto';
      btn.style.left  = '30px';
    } else if (pos === 'right') {
      btn.style.left  = 'auto';
      btn.style.right = '120px';
    } else if (pos === 'up' || pos === 'top') {
      btn.style.bottom = 'auto';
      btn.style.top    = '30px';
    } else if (pos === 'down' || pos === 'bottom') {
      btn.style.top    = 'auto';
      btn.style.bottom = '30px';
    }
    
    setTimeout(() => btn.classList.remove('navigating'), 900);
    const msg = currentLang === 'bn-IN' ? 'জ্বী স্যার, সরিয়ে দিলাম!' : 'Sure sir, moving now!';
    speak(msg);
  }

  /* ════════════════════════════════════════════════
     TRAIL DOTS
  ════════════════════════════════════════════════ */
  function dropTrailDot() {
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dot  = document.createElement('div');
    dot.className = 'ai-trail-dot';
    dot.style.left = (rect.left + rect.width / 2 - 4 + (Math.random() - 0.5) * 16) + 'px';
    dot.style.top  = (rect.top  + rect.height - 20 + (Math.random() - 0.5) * 10) + 'px';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 1200);
  }

  /* ════════════════════════════════════════════════
     CORE UTILITIES (same as v3.2)
  ════════════════════════════════════════════════ */
  function checkVisibility() {
    if (!btn) return;
    const ok = localStorage.getItem('wfa_logged_in') === 'true';
    btn.style.display        = ok ? 'flex' : 'none';
    btn.style.alignItems     = 'center';
    btn.style.justifyContent = 'center';
  }

  function setVoice() {
    const voices = synth.getVoices();
    voiceInstance = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'))
                 || voices.find(v => v.lang === 'en-US')
                 || voices[0] || null;
  }

  function speak(text) {
    if (!text) return;
    lastSpeech = text;
    synth.cancel();
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (!voiceInstance) setVoice();
      u.voice = voiceInstance;
      u.pitch = 1.15;
      u.rate  = 1.0;
      u.onstart = () => btn && btn.classList.add('talking');
      u.onend   = () => btn && btn.classList.remove('talking');
      synth.speak(u);
      showBubble(text);
    } catch(e) { console.warn('[Voice] speak error:', e); }
  }

  function greetUser() {
    if (localStorage.getItem('wfa_logged_in') === 'true') {
      if (sessionStorage.getItem('wfa_greeted') === 'true') return;
      sessionStorage.setItem('wfa_greeted', 'true');

      let userName = localStorage.getItem('wfa_user_name') || 'Shakib';
      if (userName.toLowerCase() === 'admin') userName = 'Shakib';
      const displayName = userName + ' Sir';
      
      const msg = `Welcome back, ${displayName}, How are you? If you need anything, just call me. I am here to assist you.`;
      speak(msg);
      
      // ★ NEW: After greeting, go offline automatically
      setTimeout(() => {
        if (isContinuous && isListening) {
          stopContinuousListening();
        }
      }, msg.length * 50); // Wait for greeting to finish
    }
  }

  function toggleListening() {
    if (!recognition) return;
    // ★ MODIFIED: One click enables continuous listening
    if (isListening && isContinuous) {
      // Already in continuous mode, don't toggle off - only Escape will stop
      showBubble(currentLang === 'bn-IN' ? '🎤 চলছে... (Escape এ থামান)' : '🎤 Running... (Press Escape to stop)', false);
    } else if (!isListening) {
      // Start continuous listening
      startContinuousListening();
    }
  }

  // ★ NEW: Start continuous listening mode
  function startContinuousListening() {
    if (!recognition) return;
    isContinuous = true;
    try { 
      recognition.start(); 
      isListening = true;
      btn.classList.add('listening');
      const msg = currentLang === 'bn-IN' 
        ? '🎤 চলছে... Escape এ থামান'
        : '🎤 Continuous mode ON... Press Escape to stop';
      showBubble(msg, true);
      if (typeof Utils !== 'undefined') Utils.toast(msg, 'info');
    } catch(e) { console.warn(e); }
  }

  // ★ NEW: Stop continuous listening mode (triggered by Escape key)
  function stopContinuousListening() {
    if (!recognition) return;
    isContinuous = false;
    recognition.stop();
    stopUI();
    const msg = currentLang === 'bn-IN' ? '🛑 থামিয়ে দিয়েছি' : '🛑 Stopped';
    showBubble(msg, false);
    if (typeof Utils !== 'undefined') Utils.toast(msg, 'success');
  }

  function stopUI() {
    isListening = false;
    if (btn) btn.classList.remove('listening');
  }

  /* ── Number helpers ── */
  const WORD_NUMS = {
    'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,
    'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,
    'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,
    'twenty':20,'twenty one':21,'twenty two':22,'twenty three':23,'twenty four':24,
    'twenty five':25,'twenty six':26,'twenty seven':27,'twenty eight':28,
    'twenty nine':29,'thirty':30,'thirty one':31
  };
  
  // ★ NEW: Bengali number words to digits
  const BENGALI_NUMS = {
    'শূন্য':0, 'এক':1, 'দুই':2, 'তিন':3, 'চার':4, 'পাঁচ':5, 'ছয়':6, 'সাত':7, 'আট':8, 'নয়':9,
    'দশ':10, 'এগার':11, 'বার':12, 'তের':13, 'চৌদ্দ':14, 'পনের':15, 'ষোল':16, 'সতের':17,
    'আঠার':18, 'উনিশ':19, 'বিশ':20, 'একুশ':21, 'বাইশ':22, 'তেইশ':23, 'চব্বিশ':24,
    'পঁচিশ':25, 'ছাব্বিশ':26, 'সাতাশ':27, 'আটাশ':28, 'উনত্রিশ':29, 'ত্রিশ':30, 'একত্রিশ':31
  };
  
  function normalizeNumbers(text) {
    let result = text;
    // Convert Bengali number words to digits
    for (const [word, num] of Object.entries(BENGALI_NUMS)) {
      result = result.replace(new RegExp('\\b' + word + '\\b', 'gi'), num.toString());
    }
    // Convert English number words to digits
    const sorted = Object.keys(WORD_NUMS).sort((a,b)=>b.split(' ').length-a.split(' ').length);
    for (const w of sorted) result = result.replace(new RegExp('\\b'+w+'\\b','gi'), WORD_NUMS[w]);
    return result;
  }

  // ★ ENHANCED: Extract batch with better number parsing
  function extractBatch(cmd) {
    const n = normalizeNumbers(cmd);
    
    // Pattern 1: "batch 19", "batch-19", "batch#19"
    let m = n.match(/batch[\s\-#]*(\d+)/i); 
    if (m) return m[1];
    
    // Pattern 2: "19 batch", "number 19 batch"
    m = n.match(/(?:number|num|#)?\s*(\d+)\s+batch/i); 
    if (m) return m[1];
    
    // Pattern 3: "in batch 19", "from batch 19"
    m = n.match(/(?:in|from|of)\s+batch[\s\-#]*(\d+)/i); 
    if (m) return m[1];
    
    return null;
  }
  
  function extractLastDays(cmd) {
    const n = normalizeNumbers(cmd);
    let m = n.match(/last\s+(\d+)\s+day/i); if (m) return parseInt(m[1]);
    m = n.match(/(\d+)\s+day/i); if (m) return parseInt(m[1]); // Catch expressions like "3 day report" that translate easily
    if (cmd.includes('last week'))  return 7;
    if (cmd.includes('last month')) return 30;
    if (cmd.includes('last year'))  return 365;
    return null;
  }
  function safeNum(v) { return parseFloat(v) || 0; }
  function taka(n)    { return '৳' + Math.round(n).toLocaleString('en-IN'); }
  function today()    { return new Date().toISOString().split('T')[0]; }
  // ★ ENHANCED: Month index with Bengali month names
  function getMonthIndex(cmd) {
    const englishMonths = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const bengaliMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','অগাস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর',
                          'জানু','ফেব','মার্','এপ্রি','মে','জুন','জুলা','অগ','সেপ','অক্টো','নভে','ডিসে'];
    
    // Check English months
    for (let i=0; i<englishMonths.length; i++) {
      if(cmd.includes(englishMonths[i])) {
        const name = englishMonths[i].charAt(0).toUpperCase() + englishMonths[i].slice(1);
        return {idx:i, name: name};
      }
    }
    
    // Check Bengali months
    for (let i=0; i<bengaliMonths.length; i++) {
      if(cmd.includes(bengaliMonths[i])) {
        const name = bengaliMonths[i];
        return {idx: i % 12, name: name};
      }
    }
    
    return null;
  }
  function daysAgoDate(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }
  function isThisMonth(cmd) { return /\b(this month|current month|monthly|এই মাস|এই মাসে)\b/.test(cmd); }
  function isThisYear(cmd)  { return /\b(this year|current year|yearly|year summary|annual|এই বছর|এই বছরে)\b/.test(cmd); }
  function isDetailedRequest(cmd) { return /\b(detail|details|detailed|breakdown|full detail|show all|all transaction|complete report|full report)\b/.test(cmd); }
  function isExpenseKeyword(cmd)  { return /\b(expense|expenses|spend|spending|cost|expenditure|outgoing)\b/.test(cmd); }
  function isIncomeKeyword(cmd)   { return /\b(income|earn|revenue|collection|received|incoming)\b/.test(cmd); }
  
  /* ════════════════════════════════════════════════
     ★ NEW: BENGALI COMMAND TRANSLATION
  ════════════════════════════════════════════════ */
  
  // ★ NEW: Detect if a string contains Bengali characters
  function isBengaliText(text) {
    const bengaliRegex = /[\u0980-\u09FF]/; // Bengali Unicode range
    return bengaliRegex.test(text);
  }

  const bengaliTranslations = {
    // ── Navigation Commands ──
    'ড্যাশবোর্ড': 'dashboard',
    'হোম': 'home',
    'ছাত্র': 'students',
    'শিক্ষার্থী': 'students',
    'আর্থিক': 'finance',
    'অর্থ': 'finance',
    'টাকা': 'finance',
    'অ্যাকাউন্ট': 'accounts',
    'ব্যাংক': 'accounts',
    'ঋণ': 'loans',
    'দর্শক': 'visitors',
    'অতিথি': 'visitors',
    'এইচআর': 'hr',
    'কর্মী': 'staff',
    'কর্মচারী': 'staff',
    'পরীক্ষা': 'exam',
    'ফলাফল': 'exam',
    'বেতন': 'salary',
    'পেমেন্ট': 'salary',
    'উপস্থিতি': 'attendance',
    'হাজিরা': 'attendance',
    'আইডি': 'id-card',
    'পরিচয়': 'id-card',
    'সার্টিফিকেট': 'certificates',
    'সনদ': 'certificates',
    'ঘোষণা': 'notice',
    'নোটিশ': 'notice',
    'সেটিংস': 'settings',
    'সাজসজ্জা': 'settings',
    'থিম': 'settings',
    
    // ── Common Commands ──
    'সাহায্য': 'help',
    'কমান্ড': 'help',
    'কি': 'what',
    'করতে': 'do',
    'করো': 'do',
    'শুনো': 'hello',
    'শোনো': 'hello',
    'হাই': 'hi',
    'হ্যালো': 'hello',
    'সুপ্রভাত': 'good morning',
    'সকাল': 'morning',
    'সন্ধ্যা': 'evening',
    'শুভ': 'good',
    'রাত': 'night',
    'বন্ধ': 'stop',
    'চুপ': 'quiet',
    'থামো': 'stop',
    'থামুন': 'stop',
    'আবার': 'repeat',
    'বল': 'say',
    'বলো': 'say',
    'সময়': 'time',
    'এখন': 'now',
    'কত': 'how many',
    'তারিখ': 'date',
    'দিন': 'day',
    'মজা': 'joke',
    'হাসি': 'laugh',
    'জোক': 'joke',
    'অনলাইন': 'online',
    'অফলাইন': 'offline',
    'সিস্টেম': 'system',
    'স্ট্যাটাস': 'status',
    
    // ── Reports & Data ──
    'মোট': 'total',
    'সংখ্যা': 'count',
    'সাম্প্রতিক': 'recent',
    'নতুন': 'new',
    'বকেয়া': 'due',
    'বাকি': 'outstanding',
    'সর্বোচ্চ': 'highest',
    'সর্বনিম্ন': 'lowest',
    'বেশি': 'most',
    'ব্যাচ': 'batch',
    'নম্বর': 'number',
    'প্রতিবেদন': 'report',
    'রিপোর্ট': 'report',
    'সারাংশ': 'summary',
    'বিস্তারিত': 'detailed',
    'খরচ': 'expense',
    'আয়': 'income',
    'রাজস্ব': 'revenue',
    'সংগ্রহ': 'collection',
    'পেমেন্ট': 'payment',
    'প্রাপ্ত': 'received',
    'মাসিক': 'monthly',
    'বার্ষিক': 'yearly',
    'আজকের': 'today',
    'এই': 'this',
    'মাসের': 'month',
    'বছরের': 'year',
    'সপ্তাহ': 'week',
    'গত': 'last',
    'পরবর্তী': 'next',
    'ফি': 'fee',
    'টিউশন': 'tuition',
    'ছাড়': 'discount',
    'ফেরত': 'refund',
    'দিনের': 'day',
    'দিন': 'day',
    'দাও': 'give',
    'দেন': 'give',
    'কাজের': 'work',
    'কাজ': 'work',
    'নাম্বার': 'number',
    'নাম্বারের': 'number',
    'ব্যাচের': 'batch',
    'বাম': 'left',
    'ডান': 'right',
    'উপরে': 'up',
    'নিচে': 'down',
    'পাশ': 'side',
    'একপাশে': 'side',
    'সাইড': 'side',
    'উধাও': 'disappear',
    'সরো': 'move',
    'সরুন': 'move',
    'বন্ধ': 'close',
    'গান': 'sing',
    'গাও': 'sing',
    'কাজ': 'task',
    'আজকের': 'today'
  };

  // ★ NEW: Translate Bengali command to English
  function translateBengaliCommand(cmd) {
    // Check if the command contains Bengali characters
    if (!isBengaliText(cmd)) {
      return cmd; // No Bengali, return as is
    }
    
    // Update language if Bengali detected
    if (currentLang !== 'bn-IN') {
      currentLang = 'bn-IN';
      if (recognition) recognition.lang = currentLang;
    }
    
    // Split command into words and translate each word
    let words = cmd.split(/\s+/);
    let translated = words.map(word => {
      // Try exact match first
      if (bengaliTranslations[word]) {
        return bengaliTranslations[word];
      }
      
      // Try partial match
      for (const [bengali, english] of Object.entries(bengaliTranslations)) {
        if (word.includes(bengali)) {
          return word.replace(bengali, english);
        }
      }
      
      return word; // No translation found, keep original
    }).join(' ');
    
    return translated;
  }

  function dbAll(key) {
    try { return (typeof SupabaseSync!=='undefined') ? SupabaseSync.getAll((typeof DB!=='undefined'?DB[key]:null)||key) : []; }
    catch(e) { return []; }
  }

  /* ════════════════════════════════════════════════
     REPORT RENDERERS (same as v3.2)
  ════════════════════════════════════════════════ */
  function showReport(title, icon, rows, footer, voiceText) {
    speak(voiceText);
    btn.classList.add('reading');
    setTimeout(() => btn.classList.remove('reading'), (voiceText.length / 12) * 1000 + 2000);

    const rowsHTML = rows.map(([label,val,color]) =>
      val==='---'
        ? `<div style="border-bottom:1px solid rgba(255,255,255,0.08);margin:4px 0"></div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:rgba(255,255,255,0.65);font-size:0.87rem">${label}</span>
            <span style="font-weight:700;font-size:0.93rem;color:${color||'var(--text-primary)'}">${val}</span>
          </div>`
    ).join('');

    const html = `<div style="min-width:320px;max-width:420px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--brand-primary)">
        <i class="fa ${icon}" style="color:var(--brand-primary);font-size:1.3rem"></i>
        <div style="font-size:1rem;font-weight:800;letter-spacing:0.4px">${title}</div>
      </div>
      <div>${rowsHTML}</div>
      ${footer?`<div style="margin-top:12px;padding:9px 13px;background:rgba(0,212,255,0.06);border-radius:8px;font-size:0.79rem;color:rgba(255,255,255,0.45)">${footer}</div>`:''}
    </div>`;
    if (typeof Utils!=='undefined'&&Utils.openModal) Utils.openModal(`<i class="fa ${icon}"></i> ${title}`, html, 'modal-sm');
  }

  function showDetailedReport(title, icon, summaryRows, tableRows, tableHeaders, footer, voiceText) {
    speak(voiceText);
    btn.classList.add('reading');
    setTimeout(() => btn.classList.remove('reading'), (voiceText.length/12)*1000+2000);

    const summaryHTML = summaryRows.map(([label,val,color]) =>
      val==='---' ? `<div style="border-bottom:1px solid rgba(255,255,255,0.1);margin:6px 0"></div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:rgba(255,255,255,0.65);font-size:0.85rem">${label}</span>
            <span style="font-weight:700;font-size:0.9rem;color:${color||'var(--text-primary)'}">${val}</span>
          </div>`
    ).join('');

    const thHTML = tableHeaders.map(h=>`<th style="padding:8px 10px;text-align:left;font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap">${h}</th>`).join('');
    const trHTML = tableRows.map((row,i)=>`<tr style="background:${i%2===0?'rgba(255,255,255,0.02)':'transparent'}">
      ${row.map((cell,ci)=>`<td style="padding:7px 10px;font-size:0.8rem;color:${ci===row.length-1?'#ffaa00':'rgba(255,255,255,0.75)'};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap">${cell}</td>`).join('')}
    </tr>`).join('');

    const html = `<div style="min-width:520px;max-width:700px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid var(--brand-primary)">
        <i class="fa ${icon}" style="color:var(--brand-primary);font-size:1.3rem"></i>
        <div style="font-size:1rem;font-weight:800;letter-spacing:0.4px">${title}</div>
      </div>
      <div style="margin-bottom:16px">${summaryHTML}</div>
      ${tableRows.length>0?`
      <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-bottom:6px;letter-spacing:0.6px;text-transform:uppercase">Transaction Details (${tableRows.length} records)</div>
      <div style="max-height:340px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
        <table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;background:rgba(20,20,40,0.98);z-index:1"><tr>${thHTML}</tr></thead>
          <tbody>${trHTML}</tbody>
        </table>
      </div>`:`<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:0.85rem">No records found</div>`}
      ${footer?`<div style="margin-top:12px;padding:9px 13px;background:rgba(0,212,255,0.06);border-radius:8px;font-size:0.79rem;color:rgba(255,255,255,0.45)">${footer}</div>`:''}
    </div>`;
    if (typeof Utils!=='undefined'&&Utils.openModal) Utils.openModal(`<i class="fa ${icon}"></i> ${title}`, html, 'modal-lg');
  }

  /* ════════════════════════════════════════════════
     ★ NEW v4.0 REPORT FUNCTIONS ★
  ════════════════════════════════════════════════ */

  // 📅 Tell time / date
  function reportDateTime(type) {
    const now = new Date();
    if (type === 'time') {
      const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      speak(`The current time is ${t}.`);
      showBubble(`🕐 ${t}`);
    } else {
      const d = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      speak(`Today is ${d}.`);
      showBubble(`📅 ${d}`);
    }
  }

  // 🎓 How many students
  function reportStudentCount() {
    const students = dbAll('students');
    const active   = students.filter(s => (s.status||'Active')==='Active').length;
    speak(`You have ${students.length} total students. ${active} are currently active.`);
    showReport('Student Count', 'fa-users', [
      ['Total Students', students.length, '#00e5ff'],
      ['Active', active, '#00ff88'],
      ['Inactive', students.length - active, '#ff4757'],
    ], null, `${students.length} total students, ${active} active.`);
  }

  // 👤 Who has highest due
  function reportHighestDue() {
    const students = dbAll('students');
    const withDue  = students.filter(s=>safeNum(s.due)>0).sort((a,b)=>safeNum(b.due)-safeNum(a.due));
    if (!withDue.length) { speak('No pending dues. All students are clear!'); return; }
    const top = withDue[0];
    speak(`${top.name} has the highest due of ${taka(safeNum(top.due))}.`);
    showReport('Highest Due Students', 'fa-exclamation-circle',
      withDue.slice(0,8).map((s,i) => [`${i+1}. ${s.name}`, taka(safeNum(s.due)), '#ff6b35']),
      `${withDue.length} students have pending dues`, `Top due: ${top.name} owes ${taka(safeNum(top.due))}.`
    );
  }

  // 📋 Read notice board
  function readNoticeBoard() {
    const notices = dbAll('notices');
    if (!notices.length) { speak('The notice board is currently empty.'); return; }
    const latest = notices.sort((a,b)=>((b.date||b.created_at||'').localeCompare(a.date||a.created_at||''))).slice(0,3);
    const text = latest.map((n,i)=>`Notice ${i+1}: ${n.title||n.subject||'Untitled'}`).join('. ');
    speak(`There are ${notices.length} notices. Latest: ${text}`);
    showReport('Notice Board', 'fa-bell',
      latest.map(n=>[n.title||n.subject||'Untitled', n.date ? new Date(n.date).toLocaleDateString('en-GB') : '—', '#c084fc']),
      `Showing latest ${latest.length} of ${notices.length} notices`, `Latest notice: ${latest[0]?.title||'Untitled'}.`
    );
  }

  // 👨‍💼 Staff count
  function reportStaffCount() {
    const staff  = dbAll('hr-staff');
    const active = staff.filter(s=>(s.status||'Active')==='Active').length;
    speak(`You have ${staff.length} staff members. ${active} are active.`);
    showReport('Staff Overview', 'fa-id-badge', [
      ['Total Staff', staff.length, '#00e5ff'],
      ['Active', active, '#00ff88'],
    ], null, `${staff.length} staff members.`);
  }

  // 📝 Any exam today
  function reportTodayExams() {
    const todayStr = today();
    const exams = dbAll('exams').filter(e=>(e.exam_date||e.date||'').startsWith(todayStr));
    if (!exams.length) { speak('No exams are scheduled for today.'); return; }
    const names = exams.map(e=>e.title||e.name||e.subject||'Exam').join(', ');
    speak(`There are ${exams.length} exam${exams.length>1?'s':''} today: ${names}.`);
    showReport("Today's Exams", 'fa-pen-to-square',
      exams.map(e=>[e.title||e.name||'Exam', e.batch||'—', '#ffaa00']),
      null, `${exams.length} exams today.`
    );
  }

  // 🆕 Recent admissions
  function reportRecentAdmissions() {
    const students = dbAll('students');
    const recent = students.sort((a,b)=>(b.admission_date||b.created_at||'').localeCompare(a.admission_date||a.created_at||'')).slice(0,5);
    if (!recent.length) { speak('No students found.'); return; }
    speak(`The latest admission is ${recent[0].name}${recent[0].batch?' from batch '+recent[0].batch:''}.`);
    showReport('Recent Admissions', 'fa-user-plus',
      recent.map((s,i)=>[`${i+1}. ${s.name}`, s.batch||'—', '#00ff88']),
      'Latest 5 admissions', `Latest student: ${recent[0].name}.`
    );
  }

  // 🔢 How many batches
  function reportBatchCount() {
    const students = dbAll('students');
    const batches  = [...new Set(students.map(s=>s.batch).filter(Boolean))];
    speak(`There are ${batches.length} batches: ${batches.slice(0,5).join(', ')}${batches.length>5?', and more':''}.`);
    showReport('Batch Overview', 'fa-layer-group',
      batches.map(b=>{
        const count = students.filter(s=>s.batch===b).length;
        return [b, count+' students', '#00e5ff'];
      }),
      `${batches.length} total batches`, `${batches.length} batches found.`
    );
  }

  // 🔧 System status
  function reportSystemStatus() {
    const connected = typeof SupabaseSync !== 'undefined';
    const dbSize = connected ? Object.keys(typeof DB !== 'undefined' ? DB : {}).length : 0;
    speak(`System is ${connected ? 'online and connected to the database' : 'running in offline mode'}.`);
    showReport('System Status', 'fa-server', [
      ['Status',     connected ? '✅ Online' : '⚠️ Offline',  connected?'#00ff88':'#ff4757'],
      ['Database',   connected ? 'Connected' : 'Disconnected', connected?'#00ff88':'#ff4757'],
      ['App Version','Wings Fly v4.0',                         '#00e5ff'],
      ['Browser',    navigator.userAgent.split(' ').pop(),     'rgba(255,255,255,0.5)'],
      ['Time',       new Date().toLocaleTimeString(),           '#c084fc'],
    ], null, `System is ${connected?'online':'offline'}.`);
  }

  // 😄 Tell a joke
  function tellJoke() {
    const jokes = [
      'Why do pilots make great musicians? Because they always hit the right notes at altitude!',
      'What do you call a sad airplane? A plain plane.',
      'Why did the student pilot bring a ladder? To reach new heights!',
      'What did the runway say to the airplane? Stop running and take off already!',
      'Why do wings never get lost? Because they always know which way to turn!',
      'How do you know if there is a pilot at your party? They will tell you!',
      'What do you call a pilot who has just been dumped? A cloud-digger!',
      'Why did the airplane get sent to its room? Bad altitude!',
      'What happens when a plane gets sick? It gets terminal!',
      'Where does an airplane go for a vacation? To a boarding house!',
      'What did the pilot say to the tower? I have a landing date!',
      'Why don\'t airplanes ever get lonely? Because they are always in a hangar!',
      'How does a pilot maintain their figure? They do lots of landing gear!',
      'What is a pilot\'s favorite type of music? A-flat!',
      'Why was the belt arrested? For holding up a pair of pants near the runway!'
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    speak(joke);
    showBubble(`😄 ${joke}`);
  }

  // 🎵 Sing a song (Rhythmic recitation)
  function singSong() {
    const lyrics = [
      "Up in the sky so high and blue, Wings Fly Academy is where dreams come true! From takeoff run to landing gear, our future pilots have no fear!",
      "Oh, fly with me, past clouds above, the aviation world is one we love. With stick and rudder, we find our way, learning to fly every single day!",
      "Check the weather, check the fuel, Wings Fly Academy is really cool! High in the air, we feel so free, the masters of the sky we'll be!"
    ];
    const song = lyrics[Math.floor(Math.random() * lyrics.length)];
    
    // Change pitch/rate for "singing" effect
    synth.cancel();
    const u = new SpeechSynthesisUtterance(song);
    if (!voiceInstance) setVoice();
    u.voice = voiceInstance;
    u.pitch = 1.35;
    u.rate  = 0.95;
    u.onstart = () => btn && btn.classList.add('talking');
    u.onend   = () => btn && btn.classList.remove('talking');
    synth.speak(u);
    showBubble(`🎵 ${song}`, true);
    setTimeout(() => hideBubble(), 5000);
  }

  // 📢 Scroll commands
  function scrollPage(dir) {
    const amt = dir === 'up' ? -300 : 300;
    window.scrollBy({ top: amt, behavior: 'smooth' });
    speak(dir === 'up' ? 'Scrolling up.' : 'Scrolling down.');
  }

  // 🖨️ Print
  function printPage() {
    speak('Opening print dialog.');
    setTimeout(() => window.print(), 800);
  }

  // 🔄 Refresh
  function refreshData() {
    speak('Refreshing data now.');
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.sync) {
      SupabaseSync.sync().then(() => speak('Data refreshed successfully.'));
    } else {
      setTimeout(() => location.reload(), 1000);
    }
  }

  // 📊 Robust Today's Task Summary
  function reportTodayTaskSummary() {
    const todayStr = today();
    const todayISO = new Date().toISOString().split('T')[0];
    
    // 1. New Students
    const allStudents = dbAll('students');
    const newStudents = allStudents.filter(s => 
      (s.admission_date === todayStr) || (s.created_at && s.created_at.startsWith(todayISO))
    );
    
    // 2. Finance Activities
    const allFinance = dbAll('finance');
    const todayFin = allFinance.filter(f => 
       (f.date === todayStr) || (f.created_at && f.created_at.startsWith(todayISO))
    );
    const income = todayFin.filter(f => f.type === 'Income' || (f.type||'').toLowerCase().includes('in')).reduce((s,f) => s + safeNum(f.amount), 0);
    const expense = todayFin.filter(f => f.type === 'Expense' || (f.type||'').toLowerCase().includes('out')).reduce((s,f) => s + safeNum(f.amount), 0);
    const transfers = todayFin.filter(f => (f.type || '').toLowerCase().includes('transfer')).length;
    
    // 3. Edits/Deletes from Activity Log
    let activityLogs = [];
    try { activityLogs = JSON.parse(localStorage.getItem('wfa_activity_log') || '[]'); } catch(e) {}
    const todayLogs = activityLogs.filter(l => l.created_at && l.created_at.startsWith(todayISO));
    const edits = todayLogs.filter(l => l.action === 'edit' || l.action === 'update').length;
    const deletes = todayLogs.filter(l => l.action === 'delete' || l.action === 'remove').length;

    const title = "Today's Task Summary";
    const rows = [
      ['🎓 New Students', `${newStudents.length} added`, '#00ff88'],
      ['💰 Today Income', taka(income), '#00ff88'],
      ['💸 Today Expense', taka(expense), '#ff4757'],
      ['🔄 Transfers', `${transfers} items`, '#a0c4ff'],
      ['--------','---',''],
      ['📝 Data Edits', `${edits} actions`, '#f1c40f'],
      ['🗑️ Records Deleted', `${deletes} removed`, '#ff4757']
    ];
    
    const voiceText = currentLang === 'bn-IN' 
      ? `আজকের কাজের তালিকা: নতুন স্টুডেন্ট যোগ হয়েছে ${newStudents.length} জন, মোট আয় হয়েছে ${taka(income)} এবং ব্যয় ${taka(expense)}। মোট সংশোধন হয়েছে ${edits}টি।`
      : `Today's summary: ${newStudents.length} students added. Income ${taka(income)}. Expense ${taka(expense)}. You performed ${edits} edits today.`;
      
    showReport(title, 'fa-list-check', rows, `Live data scan for ${todayStr}`, voiceText);
  }

  /* ════════════════════════════════════════════════
     ALL EXISTING v3.2 REPORTS (unchanged)
  ════════════════════════════════════════════════ */
  function reportDetailed(type, filterFn, periodLabel) {
    const finance  = dbAll('finance');
    const typeStr  = type==='expense'?'Expense':'Income';
    const allOfType= finance.filter(f=>f.type===typeStr);
    const records  = filterFn ? allOfType.filter(filterFn) : allOfType;
    const total    = records.reduce((s,f)=>s+safeNum(f.amount),0);
    const count    = records.length;
    const byCat={};
    records.forEach(f=>{const cat=f.category||f.description||'Other'; byCat[cat]=(byCat[cat]||0)+safeNum(f.amount);});
    const catEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    const isExp=type==='expense';
    const color=isExp?'#ff4757':'#00ff88';
    const icon=isExp?'fa-arrow-trend-down':'fa-arrow-trend-up';
    const summaryRows=[
      [`📅 Period`,periodLabel||'All Time','#00e5ff'],
      [`🧾 Total Transactions`,`${count} records`,'#a0c4ff'],
      [isExp?'💸 Total Expense':'💰 Total Income',taka(total),color],
      ['--------','---',''],
      ...catEntries.slice(0,8).map(([cat,amt])=>[`  🏷️ ${cat}`,taka(amt),isExp?'#ff6b35':'#00c853']),
      ...(catEntries.length>8?[[`  …${catEntries.length-8} more categories`,'','#888']]:[]),
    ];
    const sorted=[...records].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const tableHeaders=['#','Date','Category','Description','Method','Amount'];
    const tableRows=sorted.map((f,i)=>{
      const dateStr=f.date?new Date(f.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
      return[`${i+1}`,dateStr,f.category||'—',(f.description||f.note||'—').substring(0,30),f.payment_method||f.method||'—',taka(safeNum(f.amount))];
    });
    const footerNote=catEntries.length>0?`Top category: ${catEntries[0][0]} (${taka(catEntries[0][1])})`:null;
    const voiceText=`${periodLabel||'All time'} ${typeStr.toLowerCase()} report: ${count} transactions totaling ${taka(total)}. Top category is ${catEntries[0]?.[0]||'none'}.`;
    showDetailedReport(`${periodLabel?periodLabel+' — ':''}Detailed ${typeStr} Report`,icon,summaryRows,tableRows,tableHeaders,footerNote,voiceText);
  }

  function reportTopExpenses() {
    const finance=dbAll('finance');
    const expenses=finance.filter(f=>f.type==='Expense').sort((a,b)=>safeNum(b.amount)-safeNum(a.amount)).slice(0,10);
    const total=finance.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const tableHeaders=['Rank','Date','Category','Description','Amount'];
    const tableRows=expenses.map((f,i)=>{
      const dateStr=f.date?new Date(f.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
      return[`#${i+1}`,dateStr,f.category||'—',(f.description||f.note||'—').substring(0,35),taka(safeNum(f.amount))];
    });
    const summaryRows=[['💸 All-Time Total Expense',taka(total),'#ff4757'],['🏆 Highest Single Expense',expenses[0]?taka(safeNum(expenses[0].amount)):'—','#ff6b35'],['🧾 Showing Top',`${expenses.length} expenses`,'#a0c4ff']];
    showDetailedReport('Top 10 Highest Expenses','fa-ranking-star',summaryRows,tableRows,tableHeaders,'Sorted by amount — highest first',`Top expense is ${taka(safeNum(expenses[0]?.amount||0))} for ${expenses[0]?.category||'unknown'}.`);
  }

  function reportMonthlySummary() {
    const finance=dbAll('finance');
    const now=new Date(); const year=now.getFullYear();
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tableHeaders=['Month','Income','Expense','Net'];
    const tableRows=[]; let totalInc=0,totalExp=0;
    months.forEach((mon,idx)=>{
      const mm=String(idx+1).padStart(2,'0'); const prefix=`${year}-${mm}`;
      const mData=finance.filter(f=>(f.date||'').startsWith(prefix));
      const inc=mData.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
      const exp=mData.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
      const net=inc-exp; totalInc+=inc; totalExp+=exp;
      if(inc>0||exp>0) tableRows.push([`${mon} ${year}`,taka(inc),taka(exp),(net>=0?'+':'')+taka(Math.abs(net))]);
    });
    const net=totalInc-totalExp;
    const summaryRows=[[`💰 ${year} Total Income`,taka(totalInc),'#00ff88'],[`💸 ${year} Total Expense`,taka(totalExp),'#ff4757'],[`📈 ${year} Net`,(net>=0?'+':'')+taka(Math.abs(net)),net>=0?'#00e5ff':'#ff4757'],[`📅 Active Months`,`${tableRows.length} months`,'#a0c4ff']];
    showDetailedReport(`${year} — Monthly Breakdown`,'fa-calendar-range',summaryRows,tableRows,tableHeaders,`Full year ${year} month-by-month`,`${year} total income ${taka(totalInc)}, expense ${taka(totalExp)}, net ${taka(net)}.`);
  }

  function reportCashFlow() {
    const finance=dbAll('finance'); const now=new Date();
    const year=now.getFullYear(); const mm=String(now.getMonth()+1).padStart(2,'0');
    const monthLbl=now.toLocaleString('default',{month:'long'});
    const calc=(arr)=>({inc:arr.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0),exp:arr.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0)});
    const m=calc(finance.filter(f=>(f.date||'').startsWith(`${year}-${mm}`))),y=calc(finance.filter(f=>(f.date||'').startsWith(`${year}`))),a=calc(finance);
    const mNet=m.inc-m.exp,yNet=y.inc-y.exp,aNet=a.inc-a.exp;
    showReport('Cash Flow Report','fa-water',[
      [`📅 ${monthLbl} Income`,taka(m.inc),'#00ff88'],[`📅 ${monthLbl} Expense`,taka(m.exp),'#ff4757'],[`📊 ${monthLbl} Net`,(mNet>=0?'+':'')+taka(Math.abs(mNet)),mNet>=0?'#f7b731':'#ff4757'],
      ['--------','---',''],
      [`🗓️ ${year} Income`,taka(y.inc),'#00ff88'],[`🗓️ ${year} Expense`,taka(y.exp),'#ff4757'],[`📈 ${year} Net`,(yNet>=0?'+':'')+taka(Math.abs(yNet)),yNet>=0?'#00e5ff':'#ff4757'],
      ['--------','---',''],
      ['💰 All-Time Income',taka(a.inc),'#00ff88'],['💸 All-Time Expense',taka(a.exp),'#ff4757'],['📈 All-Time Net',(aNet>=0?'+':'')+taka(Math.abs(aNet)),aNet>=0?'#00e5ff':'#ff4757'],
    ],`Income/Expense ratio this month: ${m.exp>0?(m.inc/m.exp*100).toFixed(0):'∞'}%`,`Cash flow: this month net ${taka(mNet)}, this year net ${taka(yNet)}.`);
  }

  function reportCategoryBreakdown(type) {
    const finance=dbAll('finance'); const isAll=!type;
    const filtered=isAll?finance:finance.filter(f=>f.type===(type==='expense'?'Expense':'Income'));
    const byCat={};
    filtered.forEach(f=>{const cat=f.category||'Other'; if(!byCat[cat]) byCat[cat]={income:0,expense:0,count:0}; if(f.type==='Income') byCat[cat].income+=safeNum(f.amount); if(f.type==='Expense') byCat[cat].expense+=safeNum(f.amount); byCat[cat].count++;});
    const entries=Object.entries(byCat).sort((a,b)=>(b[1].income+b[1].expense)-(a[1].income+a[1].expense));
    const tableHeaders=isAll?['Category','Income','Expense','Net','Records']:['Category',type==='expense'?'Expense':'Income','Records'];
    const tableRows=entries.map(([cat,d])=>isAll?[cat,taka(d.income),taka(d.expense),(d.income-d.expense>=0?'+':'')+taka(Math.abs(d.income-d.expense)),`${d.count}`]:[cat,taka(type==='expense'?d.expense:d.income),`${d.count}`]);
    const totalInc=filtered.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const totalExp=filtered.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const typeLabel=isAll?'All Finance':type==='expense'?'Expense':'Income';
    showDetailedReport(`${typeLabel} — Category Breakdown`,'fa-tags',[['📂 Total Categories',`${entries.length}`,'#00e5ff'],['💰 Total Income',taka(totalInc),'#00ff88'],['💸 Total Expense',taka(totalExp),'#ff4757']],tableRows,tableHeaders,`${entries.length} categories found`,`${typeLabel} has ${entries.length} categories. Top: ${entries[0]?.[0]||'none'}.`);
  }

  function reportMonthFinance(year,month,monthName,type) {
    const finance=dbAll('finance'); const mm=String(month).padStart(2,'0'); const prefix=`${year}-${mm}`;
    const period=finance.filter(f=>(f.date||'').startsWith(prefix));
    const income=period.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense=period.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const net=income-expense; const label=`${monthName} ${year}`;
    let rows,voiceText,title;
    if(type==='expense'){
      const items=period.filter(f=>f.type==='Expense').sort((a,b)=>safeNum(b.amount)-safeNum(a.amount)).slice(0,6).map(f=>[`  📌 ${f.category||f.description||'Expense'}`,taka(safeNum(f.amount)),'#ff6b35']);
      rows=[[`📅 ${label} Total Expense`,taka(expense),'#ff4757'],['--------','---',''],...items];
      title=`${label} — Expense Report`; voiceText=`${label} total expense is ${taka(expense)}.`;
    } else if(type==='income'){
      const items=period.filter(f=>f.type==='Income').sort((a,b)=>safeNum(b.amount)-safeNum(a.amount)).slice(0,6).map(f=>[`  📌 ${f.category||f.description||'Income'}`,taka(safeNum(f.amount)),'#00c853']);
      rows=[[`📅 ${label} Total Income`,taka(income),'#00ff88'],['--------','---',''],...items];
      title=`${label} — Income Report`; voiceText=`${label} total income is ${taka(income)}.`;
    } else {
      rows=[[`📅 ${label} Income`,taka(income),'#00ff88'],[`📅 ${label} Expense`,taka(expense),'#ff4757'],[`📊 ${label} Net`,(net>=0?'+':'')+taka(Math.abs(net)),net>=0?'#f7b731':'#ff4757']];
      title=`${label} — Finance Report`; voiceText=`${label}: income ${taka(income)}, expense ${taka(expense)}, net ${taka(net)}.`;
    }
    showReport(title,'fa-chart-line',rows,null,voiceText);
  }

  function reportYearFinance(year,type) {
    const finance=dbAll('finance'); const period=finance.filter(f=>(f.date||'').startsWith(`${year}`));
    const income=period.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense=period.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const net=income-expense;
    let rows,title,voiceText;
    if(type==='expense'){rows=[[`📅 ${year} Total Expense`,taka(expense),'#ff4757'],[`📊 ${year} Net`,(net>=0?'+':'')+taka(Math.abs(net)),net>=0?'#f7b731':'#ff4757']];title=`${year} — Annual Expense`;voiceText=`${year} total annual expense is ${taka(expense)}.`;}
    else if(type==='income'){rows=[[`📅 ${year} Total Income`,taka(income),'#00ff88'],[`📊 ${year} Net`,(net>=0?'+':'')+taka(Math.abs(net)),net>=0?'#f7b731':'#ff4757']];title=`${year} — Annual Income`;voiceText=`${year} total annual income is ${taka(income)}.`;}
    else{rows=[[`💰 ${year} Income`,taka(income),'#00ff88'],[`💸 ${year} Expense`,taka(expense),'#ff4757'],[`📈 ${year} Net`,(net>=0?'+':'')+taka(Math.abs(net)),net>=0?'#00e5ff':'#ff4757']];title=`${year} — Annual Summary`;voiceText=`${year} annual income ${taka(income)}, expense ${taka(expense)}, net ${taka(net)}.`;}
    showReport(title,'fa-calendar-days',rows,null,voiceText);
  }

  function reportBatch(batchId) {
    const students=dbAll('students');
    const batchStudents=students.filter(s=>{const b=(s.batch||'').toLowerCase().replace(/batch[\s\-#]*/i,'').trim();const query=batchId.toLowerCase().replace(/batch[\s\-#]*/i,'').trim();return b===query||(s.batch||'').toLowerCase().includes(batchId.toLowerCase());});
    if(!batchStudents.length){speak(`No students found for batch ${batchId}.`);return;}
    const totalFee=batchStudents.reduce((s,r)=>s+safeNum(r.total_fee),0),totalPaid=batchStudents.reduce((s,r)=>s+safeNum(r.paid),0),totalDue=batchStudents.reduce((s,r)=>s+safeNum(r.due),0);
    const active=batchStudents.filter(s=>(s.status||'Active')==='Active').length;
    const withDue=batchStudents.filter(s=>safeNum(s.due)>0);
    const dueRows=withDue.sort((a,b)=>safeNum(b.due)-safeNum(a.due)).slice(0,5).map(s=>[`  👤 ${s.name}`,taka(s.due),'#ff6b35']);
    showReport(`${batchStudents[0]?.batch||'Batch-'+batchId} — Full Report`,'fa-layer-group',[['👥 Total Students',batchStudents.length,'#00e5ff'],['✅ Active',active,'#00ff88'],['💵 Total Fee',taka(totalFee),'#ffaa00'],['✅ Collected',taka(totalPaid),'#00ff88'],['⏳ Total Due',taka(totalDue),'#ff4757'],['👤 Students w/ Due',withDue.length,'#ff4757'],['--------','---',''],...dueRows],withDue.length>5?`…and ${withDue.length-5} more students have dues`:null,`Batch ${batchId}: ${batchStudents.length} students, collected ${taka(totalPaid)}, due ${taka(totalDue)}.`);
  }

  function reportLastDays(days,type) {
    const finance=dbAll('finance'),fromDate=daysAgoDate(days),toDate=today();
    const period=finance.filter(f=>{const d=(f.date||'').split('T')[0];return d>=fromDate&&d<=toDate;});
    let filtered=type==='income'?period.filter(f=>f.type==='Income'):type==='expense'?period.filter(f=>f.type==='Expense'):period;
    const total=filtered.reduce((s,f)=>s+safeNum(f.amount),0);
    const income=period.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const expense=period.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const typeLabel=type==='income'?'Income':type==='expense'?'Expense':'All';
    const byDay={};
    filtered.forEach(f=>{const d=(f.date||'').split('T')[0];byDay[d]=(byDay[d]||0)+safeNum(f.amount);});
    const dayRows=Object.entries(byDay).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7).map(([d,amt])=>{const label=new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'});return[`  📅 ${label}`,taka(amt),type==='expense'?'#ff6b35':'#00ff88'];});
    const byCat={};
    filtered.forEach(f=>{byCat[f.category||'Other']=(byCat[f.category||'Other']||0)+safeNum(f.amount);});
    const catRows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cat,amt])=>[`  🏷️ ${cat}`,taka(amt),'#a0c4ff']);
    const periodStr=`Last ${days} days (${new Date(fromDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${new Date(toDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})})`;
    showReport(`Last ${days} Days — ${typeLabel} Report`,type==='expense'?'fa-arrow-trend-down':type==='income'?'fa-arrow-trend-up':'fa-chart-bar',[['📆 Period',periodStr,'#00e5ff'],['🧾 Transactions',filtered.length+' records','#a0c4ff'],type!=='income'?['💸 Total Expense',taka(expense),'#ff4757']:null,type!=='expense'?['💰 Total Income',taka(income),'#00ff88']:null,['💵 Period Total',taka(total),type==='expense'?'#ff4757':'#00ff88'],['--------','---',''],...dayRows,['--------','---',''],...catRows].filter(Boolean),`Showing ${typeLabel.toLowerCase()} breakdown.`,`Last ${days} days ${typeLabel.toLowerCase()} total is ${taka(total)}.`);
  }

  function reportToday() {
    const todayStr=today(),finance=dbAll('finance'),students=dbAll('students'),exams=dbAll('exams');
    const todayFin=finance.filter(f=>(f.date||'').startsWith(todayStr));
    const todayIncome=todayFin.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const todayExp=todayFin.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const net=todayIncome-todayExp;
    const dateLabel=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    showReport("Today's Report",'fa-calendar-day',[['📅 Date',dateLabel,'#00e5ff'],['💰 Income',taka(todayIncome),'#00ff88'],['💸 Expense',taka(todayExp),'#ff4757'],['📊 Net',(net>=0?'+':'')+taka(net),net>=0?'#f7b731':'#ff4757'],['🧾 Transactions',todayFin.length+' records','#a0c4ff'],['🎓 New Students',students.filter(s=>(s.admission_date||'').startsWith(todayStr)).length,'#00e5ff'],['📝 Exams',exams.filter(e=>(e.exam_date||'').startsWith(todayStr)).length,'#c084fc']],`Generated: ${dateLabel}`,`Today: Income ${taka(todayIncome)}, Expense ${taka(todayExp)}, Net ${taka(net)}.`);
  }

  function reportSalary(cmd) {
    const monthInfo=getMonthIndex(cmd),allSalary=dbAll('salary'),finance=dbAll('finance');
    let targetRecords,label;
    const year=new Date().getFullYear();
    if(monthInfo){const mm=String(monthInfo.idx+1).padStart(2,'0');targetRecords=allSalary.filter(s=>{const d=s.payment_date||s.month||s.date||'';return d.includes(`${year}-${mm}`)||d.toLowerCase().includes(monthInfo.name.toLowerCase());});if(!targetRecords.length) targetRecords=finance.filter(f=>f.category==='Salary'&&(f.date||'').includes(`${year}-${mm}`));label=monthInfo.name+' '+year;}
    else{const now=new Date(),mm=String(now.getMonth()+1).padStart(2,'0');targetRecords=allSalary.filter(s=>{const d=s.payment_date||s.month||s.date||'';return d.includes(`${year}-${mm}`);});if(!targetRecords.length) targetRecords=finance.filter(f=>f.category==='Salary'&&(f.date||'').includes(`${year}-${mm}`));label=now.toLocaleString('default',{month:'long'})+' '+year;}
    const total=targetRecords.reduce((s,r)=>s+safeNum(r.amount||r.salary_amount||r.net_salary),0);
    const perPerson={};
    targetRecords.forEach(r=>{const name=r.staff_name||r.person_name||r.description||'Staff';perPerson[name]=(perPerson[name]||0)+safeNum(r.amount||r.salary_amount||r.net_salary);});
    const personRows=Object.entries(perPerson).slice(0,5).map(([name,amt])=>[`  👤 ${name}`,taka(amt),'rgba(255,255,255,0.8)']);
    showReport(`Salary Report — ${label}`,'fa-money-check-dollar',[['📅 Period',label,'#00e5ff'],['👥 Records',targetRecords.length+' entries','#ffaa00'],['💰 Total Salary',taka(total),'#00ff88'],['--------','---',''],...personRows],targetRecords.length===0?'⚠️ No salary records found':null,targetRecords.length>0?`Total salary for ${label} is ${taka(total)}.`:`No salary records for ${label}.`);
  }

  function reportStudents() {
    const students=dbAll('students'),active=students.filter(s=>(s.status||'Active')==='Active');
    const totalFee=students.reduce((s,r)=>s+safeNum(r.total_fee),0),totalPaid=students.reduce((s,r)=>s+safeNum(r.paid),0),totalDue=students.reduce((s,r)=>s+safeNum(r.due),0);
    const batches={};
    students.forEach(s=>{if(s.batch){batches[s.batch]=(batches[s.batch]||0)+1;}});
    const topBatches=Object.entries(batches).sort((a,b)=>b[1]-a[1]).slice(0,4);
    showReport('Student Report','fa-user-graduate',[['🎓 Total Students',students.length,'#00e5ff'],['✅ Active',active.length,'#00ff88'],['❌ Inactive',students.length-active.length,'#ff4757'],['💵 Total Fee',taka(totalFee),'#ffaa00'],['✅ Collected',taka(totalPaid),'#00ff88'],['⏳ Total Due',taka(totalDue),'#ff4757'],['--------','---',''],...topBatches.map(([b,c])=>[`  📚 Batch ${b}`,c+' students','rgba(255,255,255,0.7)'])],null,`${students.length} students, ${active.length} active, due ${taka(totalDue)}.`);
  }

  function reportFinance() {
    const finance=dbAll('finance'),now=new Date(),mm=String(now.getMonth()+1).padStart(2,'0'),yy=now.getFullYear();
    const month=finance.filter(f=>(f.date||'').startsWith(`${yy}-${mm}`));
    const mIncome=month.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const mExp=month.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const allInc=finance.filter(f=>f.type==='Income').reduce((s,f)=>s+safeNum(f.amount),0);
    const allExp=finance.filter(f=>f.type==='Expense').reduce((s,f)=>s+safeNum(f.amount),0);
    const mLabel=now.toLocaleString('default',{month:'long'})+' '+yy,mNet=mIncome-mExp;
    showReport('Finance Summary','fa-chart-line',[[`📅 ${mLabel} Income`,taka(mIncome),'#00ff88'],[`📅 ${mLabel} Expense`,taka(mExp),'#ff4757'],[`📊 ${mLabel} Net`,(mNet>=0?'+':'')+taka(mNet),mNet>=0?'#f7b731':'#ff4757'],['--------','---',''],['💰 All-Time Income',taka(allInc),'#00ff88'],['💸 All-Time Expense',taka(allExp),'#ff4757'],['📈 All-Time Net',taka(allInc-allExp),(allInc-allExp)>=0?'#00e5ff':'#ff4757']],null,`This month income ${taka(mIncome)}, expense ${taka(mExp)}, net ${taka(mNet)}.`);
  }

  function reportDue(batchFilter) {
    const students=dbAll('students');
    let pool=students,batchLabel='';
    if(batchFilter){pool=students.filter(s=>{const b=(s.batch||'').toLowerCase().replace(/batch[\s\-#]*/i,'').trim();const q=batchFilter.toLowerCase().replace(/batch[\s\-#]*/i,'').trim();return b===q||(s.batch||'').toLowerCase().includes(batchFilter.toLowerCase());});batchLabel=pool[0]?.batch?`— Batch ${pool[0].batch}`:`— Batch ${batchFilter}`;}
    const withDue=pool.filter(s=>safeNum(s.due)>0).sort((a,b)=>safeNum(b.due)-safeNum(a.due));
    const totalDue=withDue.reduce((s,r)=>s+safeNum(r.due),0);
    const dueRows=withDue.slice(0,6).map(s=>[`  👤 ${s.name}`,taka(s.due),'#ff6b35']);
    showReport(`Pending Due ${batchLabel}`,'fa-circle-exclamation',[['👥 Students w/ Due',withDue.length,'#ffaa00'],['💸 Total Due',taka(totalDue),'#ff4757'],['--------','---',''],...dueRows,...(withDue.length>6?[[`  …${withDue.length-6} more`,'','#888']]:[])],null,`${withDue.length} students ${batchLabel} have due totaling ${taka(totalDue)}.`);
  }

  function reportBalance() {
    const accounts=dbAll('accounts');
    const rows=accounts.map(a=>[`🏦 ${a.name||a.account_name||'Account'}`,taka(safeNum(a.balance)),'#c084fc']);
    const total=accounts.reduce((s,a)=>s+safeNum(a.balance),0);
    rows.push(['--------','---',''],['💰 Total',taka(total),'#00e5ff']);
    showReport('Account Balances','fa-building-columns',rows.length>2?rows:[['No accounts found','','#888']],null,`Total account balance is ${taka(total)}.`);
  }

  function reportHelp() {
    const helpText = `
🎙️ CONTINUOUS LISTENING MODE (v4.1):
• Click once to START - Assistant keeps listening
• Press ESCAPE to STOP listening
• Supports both ENGLISH & BENGALI commands

📝 Say these commands:
`;
    
    speak('I now support English and Bengali commands. Click to start continuous listening, press Escape to stop. ' +
          'Try saying: open settings, how many students, what time is it, or tell me a joke.');
    
    showReport('Voice Commands — v4.1 (Bilingual)','fa-circle-question',[
      ['🎙️ MODE ──────────────────','─────────',          '#00e5ff'],
      ['Click avatar',               'Start listening',    '#00ff88'],
      ['Press ESCAPE',               'Stop listening',     '#ff4757'],
      ['Supports English',           'Yes ✓',              '#00e5ff'],
      ['Supports Bengali',           'Yes ✓ (নতুন)',      '#00ff88'],
      ['── NAVIGATION ──────────────','─────────',         '#555'],
      ['"open settings"',            'Fly to Settings',    '#c084fc'],
      ['"go to students"',           'Fly to Students',    '#00e5ff'],
      ['"fly to finance"',           'Fly to Finance',     '#00ff88'],
      ['"walk to attendance"',       'Go to Attendance',   '#ffaa00'],
      ['ড্যাশবোর্ড খোল',             'সেটিংস এ যাও',      '#c084fc'],
      ['── DATE & TIME ────────────','─────────',          '#555'],
      ['"what time is it"',          'Current time',       '#00e5ff'],
      ['"what is today"',            'Current date',       '#00e5ff'],
      ['এখন কি সময়',                 'বর্তমান সময়',      '#00e5ff'],
      ['── STUDENT INFO ───────────','─────────',          '#555'],
      ['"how many students"',        'Student count',      '#00ff88'],
      ['"who has highest due"',      'Top due student',    '#ff4757'],
      ['"recent admissions"',        'Last 5 students',    '#00ff88'],
      ['মোট ছাত্র কত',                'শিক্ষার্থী সংখ্যা',   '#00ff88'],
      ['── UTILITY ────────────────','─────────',          '#555'],
      ['"tell me a joke"',           'Aviation joke 😄',   '#00ff88'],
      ['"system status"',            'App health',         '#c084fc'],
      ['"stop" or "थামो"',            'Stop speaking',      '#ff4757'],
      ['"repeat"',                   'Repeat last',        '#c084fc'],
    ],'💡 Use English OR Bengali! Try saying: "সেটিংস খোল" or "how many students"','Both languages work! Try voice commands now.');
  }

  /* ════════════════════════════════════════════════
     MAIN COMMAND PROCESSOR (v4.0)
  ════════════════════════════════════════════════ */
  function processCommand(raw) {
    // ★ NEW: Translate Bengali commands to English
    let translatedCmd = translateBengaliCommand(raw.toLowerCase());
    const cmd = normalizeNumbers(translatedCmd);
    let handled   = false;
    const detailed = isDetailedRequest(cmd);

    // ── STOP ─────────────────────────────────────────────────────
    if (/\b(stop|quiet|shh|silence|shut up|be quiet|থামো|চুপ থাক)\b/.test(cmd)) {
      synth.cancel(); hideBubble(); speak(currentLang === 'bn-IN' ? 'ঠিক আছে, চুপ থাকছি।' : 'Okay, I\'ll be quiet.'); return;
    }

    // ── YOU CAN GO NOW (Disable/Dismiss Assistant) ─────────────────
    if (/\b(you can go|go now|dismiss|disable|turn off|shut down|disappear|vanish|যাও|যেতে পারো|বন্ধ করো|চলে যাও|উধাও|হারিয়ে যাও)\b/.test(cmd)) {
      stopContinuousListening();
      const msg = currentLang === 'bn-IN' 
        ? 'ঠিক আছে স্যার, আমি চলে যাচ্ছি। প্রয়োজন হলে আবার ডাকবেন। বাই!'
        : 'Okay sir, I am going offline now. Call me if you need anything. Bye!';
      speak(msg);
      showBubble(currentLang === 'bn-IN' ? '👋 চলে গেলাম!' : '👋 Going offline!', false);
      return;
    }

    // ── MOVE AVATAR ───────────────────────────────────────────────
    if (/\b(move|go|সরো|যাও|বসো)\b/.test(cmd) && /\b(left|right|up|down|top|bottom|বাম|ডান|উপরে|নিচে)\b/.test(cmd)) {
      if (cmd.includes('left') || cmd.includes('বাম')) { moveAvatar('left'); return; }
      if (cmd.includes('right') || cmd.includes('ডান')) { moveAvatar('right'); return; }
      if (cmd.includes('up') || cmd.includes('top') || cmd.includes('উপরে')) { moveAvatar('up'); return; }
      if (cmd.includes('down') || cmd.includes('bottom') || cmd.includes('নিচে')) { moveAvatar('down'); return; }
    }

    // ── REPEAT ───────────────────────────────────────────────────
    if (/\b(repeat|say again|what did you say)\b/.test(cmd)) {
      if (lastSpeech) { speak(lastSpeech); } else { speak('Nothing to repeat.'); } return;
    }

    // ── DATE / TIME ───────────────────────────────────────────────
    if (/\b(what time|current time|time is it|tell me the time)\b/.test(cmd)) { reportDateTime('time'); return; }
    if (/\b(what.*today|today.*date|what day|current date|date today)\b/.test(cmd)) { reportDateTime('date'); return; }

    // ── GREETINGS ─────────────────────────────────────────────────
    if (/\b(good morning|good afternoon|good evening|good night|hello|hi there|hey)\b/.test(cmd)) {
      const hour = new Date().getHours();
      const resp = hour<12?'Good morning, Admin! Ready to help.'
        :hour<17?'Good afternoon! How can I assist?'
        :'Good evening, Admin! What do you need?';
      speak(resp); return;
    }

    // ── ENTERTAINMENT / JOKES / SONG ──────────────────────────────
    if (/\b(joke|funny|laugh|humor|make me laugh)\b/.test(cmd)) { tellJoke(); return; }
    if (/\b(sing|song|গান)\b/.test(cmd)) { singSong(); return; }

    // ── MODAL / WINDOW CONTROL ─────────────────────────────────────
    if (/\b(close|shut|বন্ধ)\b/.test(cmd) && /\b(window|modal|box|dialog|উইন্ডো|বক্স)\b/.test(cmd)) {
      if (typeof Utils !== 'undefined' && Utils.closeModal) {
        Utils.closeModal();
        speak(currentLang === 'bn-IN' ? 'উইন্ডো বন্ধ করে দিয়েছি।' : 'Closing the window for you.');
        return;
      }
    }
  
    // ── ACTIVITY / TASK SUMMARY ────────────────────────────────────
    if (/\b(task|activity|work|কাজ)\b/.test(cmd) && /\b(today|total|summary|আজকের)\b/.test(cmd)) {
      reportTodayTaskSummary();
      return;
    }

    // ★ NEW: ADVANCED BATCH QUERIES ─────────────────────────────────
    // Examples: "উনিশ ব্যাচে টোটাল স্টুডেন্ট কত?", "Batch 19 student count", "19 batch এ কত ছাত্র"
    if (/\b(batch|ব্যাচ)\b/.test(cmd) && /\b(student|ছাত্র|শিক্ষার্থী|count|সংখ্যা|কত)\b/.test(cmd)) {
      const batchId = extractBatch(cmd);
      if (batchId) {
        const students = dbAll('students');
        const batchStudents = students.filter(s => {
          const b = (s.batch || '').toLowerCase().replace(/batch[\s\-#]*/i, '').trim();
          return b.includes(batchId) || (s.batch || '').toLowerCase().includes('batch ' + batchId) || (s.batch || '').toLowerCase().includes('batch-' + batchId) || (s.batch || '').includes(batchId);
        });
        if (batchStudents.length > 0) {
          const msg = currentLang === 'bn-IN' 
            ? `${batchId} নম্বর ব্যাচে মোট ${batchStudents.length} জন ছাত্র আছে।`
            : `Batch ${batchId} has ${batchStudents.length} students in total.`;
          speak(msg);
          showBubble(`Batch ${batchId}: ${batchStudents.length} students`, false);
          return;
        }
      }
    }

    // ★ NEW: MONTH-SPECIFIC FINANCE QUERIES ─────────────────────────
    // Examples: "এপ্রিল মাসে খরচ কত?", "May expense", "জুন মাসের আয় কত"
    if (/\b(month|মাস)\b/.test(cmd) && (/\b(expense|খরচ|খরচ|spend)\b/.test(cmd) || /\b(income|আয়|revenue)\b/.test(cmd))) {
      const monthMatch = getMonthIndex(cmd);
      if (monthMatch) {
        const now = new Date();
        const year = now.getFullYear();
        const mm = String(monthMatch.idx + 1).padStart(2, '0');
        const finance = dbAll('finance');
        const monthData = finance.filter(f => (f.date || '').startsWith(`${year}-${mm}`));
        
        if (/\b(expense|খরচ|spend)\b/.test(cmd)) {
          const expenseTotal = monthData.filter(f => f.type === 'Expense').reduce((s, f) => s + safeNum(f.amount), 0);
          const msg = currentLang === 'bn-IN'
            ? `${monthMatch.name} মাসে মোট খরচ ${taka(expenseTotal)}`
            : `Total expense in ${monthMatch.name}: ${taka(expenseTotal)}`;
          speak(msg);
          showBubble(msg, false);
          return;
        } else if (/\b(income|আয়|revenue)\b/.test(cmd)) {
          const incomeTotal = monthData.filter(f => f.type === 'Income').reduce((s, f) => s + safeNum(f.amount), 0);
          const msg = currentLang === 'bn-IN'
            ? `${monthMatch.name} মাসে মোট আয় ${taka(incomeTotal)}`
            : `Total income in ${monthMatch.name}: ${taka(incomeTotal)}`;
          speak(msg);
          showBubble(msg, false);
          return;
        }
      }
    }

    // ★ NEW: BATCH + MONTH COMBINED QUERY ───────────────────────────
    // Examples: "জুন ব্যাচে পেমেন্ট কত?", "Batch 15 collection", "19 ব্যাচের মোট ফি"
    if (/\b(batch|ব্যাচ)\b/.test(cmd) && /\b(payment|পেমেন্ট|fee|ফি|collection|সংগ্রহ|due|বাকি)\b/.test(cmd)) {
      const batchId = extractBatch(cmd);
      if (batchId) {
        const students = dbAll('students');
        const batchStudents = students.filter(s => {
          const b = (s.batch || '').toLowerCase().replace(/batch[\s\-#]*/i, '').trim();
          return b.includes(batchId) || (s.batch || '').toLowerCase().includes('batch ' + batchId) || (s.batch || '').includes(batchId);
        });
        
        if (batchStudents.length > 0) {
          const totalFee = batchStudents.reduce((s, r) => s + safeNum(r.total_fee), 0);
          const totalPaid = batchStudents.reduce((s, r) => s + safeNum(r.paid), 0);
          const totalDue = batchStudents.reduce((s, r) => s + safeNum(r.due), 0);
          
          if (/\b(payment|পেমেন্ট|collection|সংগ্রহ)\b/.test(cmd)) {
            const msg = currentLang === 'bn-IN'
              ? `${batchId} নম্বর ব্যাচে মোট ${taka(totalPaid)} টাকা সংগ্রহ করা হয়েছে।`
              : `Batch ${batchId}: Total collection is ${taka(totalPaid)}`;
            speak(msg);
            showBubble(msg, false);
            return;
          } else if (/\b(due|বাকি|outstanding)\b/.test(cmd)) {
            const msg = currentLang === 'bn-IN'
              ? `${batchId} নম্বর ব্যাচে মোট ${taka(totalDue)} টাকা বাকি আছে।`
              : `Batch ${batchId}: Total due is ${taka(totalDue)}`;
            speak(msg);
            showBubble(msg, false);
            return;
          } else if (/\b(fee|ফি|total fee)\b/.test(cmd)) {
            const msg = currentLang === 'bn-IN'
              ? `${batchId} নম্বর ব্যাচে মোট ফি ${taka(totalFee)}।`
              : `Batch ${batchId}: Total fee is ${taka(totalFee)}`;
            speak(msg);
            showBubble(msg, false);
            return;
          }
        }
      }
    }

    // ── WHO AM I / SYSTEM ─────────────────────────────────────────
    if (/\b(who am i|who are you|about you|your name|system status|app status|health)\b/.test(cmd)) {
      if (cmd.includes('who am i') || cmd.includes('admin')) { speak('You are the administrator of Wings Fly Aviation Academy.'); return; }
      if (cmd.includes('who are you')) { speak('I am your Wings Fly AI assistant, here to help you manage everything hands-free!'); return; }
      reportSystemStatus(); return;
    }

    // ── SCROLL ────────────────────────────────────────────────────
    if (/\b(scroll up|go up|page up)\b/.test(cmd)) { scrollPage('up'); return; }
    if (/\b(scroll down|go down|page down)\b/.test(cmd)) { scrollPage('down'); return; }

    // ── PRINT ─────────────────────────────────────────────────────
    if (/\b(print|print page|print this)\b/.test(cmd)) { printPage(); return; }

    // ── REFRESH ───────────────────────────────────────────────────
    if (/\b(refresh|reload|sync|update data)\b/.test(cmd)) { refreshData(); return; }

    // ── NEW STUDENT COMMANDS ───────────────────────────────────────
    if (/\b(how many student|student count|total student|number of student)\b/.test(cmd)) {
      reportStudentCount(); return;
    }
    if (/\b(highest due|who.*due|top due|most due|biggest due)\b/.test(cmd)) {
      reportHighestDue(); return;
    }
    if (/\b(recent admission|new student|latest student|last.*student)\b/.test(cmd)) {
      reportRecentAdmissions(); return;
    }
    if (/\b(how many batch|batch count|all batch|list batch)\b/.test(cmd)) {
      reportBatchCount(); return;
    }

    // ── NOTICE BOARD ──────────────────────────────────────────────
    if (/\b(notice board|read notice|latest notice|any notice)\b/.test(cmd)) {
      readNoticeBoard(); return;
    }

    // ── STAFF ─────────────────────────────────────────────────────
    if (/\b(staff count|how many staff|total staff|number of staff|employee count)\b/.test(cmd)) {
      reportStaffCount(); return;
    }

    // ── EXAMS ─────────────────────────────────────────────────────
    if (/\b(exam today|any exam|today.*exam|exam.*today)\b/.test(cmd)) {
      reportTodayExams(); return;
    }

    // ── v3.2 DETAILED REPORTS ─────────────────────────────────────
    if (!handled && detailed && isExpenseKeyword(cmd) && !extractBatch(cmd)) {
      const namedMonth=getMonthIndex(cmd),now=new Date();
      if(namedMonth){const mm=String(namedMonth.idx+1).padStart(2,'0');reportDetailed('expense',f=>(f.date||'').startsWith(`${now.getFullYear()}-${mm}`),`${namedMonth.name} ${now.getFullYear()}`);}
      else if(isThisMonth(cmd)){const mm=String(now.getMonth()+1).padStart(2,'0');const label=now.toLocaleString('default',{month:'long'})+' '+now.getFullYear();reportDetailed('expense',f=>(f.date||'').startsWith(`${now.getFullYear()}-${mm}`),label);}
      else if(isThisYear(cmd)){reportDetailed('expense',f=>(f.date||'').startsWith(`${now.getFullYear()}`),`Year ${now.getFullYear()}`);}
      else{reportDetailed('expense',null,'All Time');}
      handled=true;
    }
    if (!handled && detailed && isIncomeKeyword(cmd) && !extractBatch(cmd)) {
      const namedMonth=getMonthIndex(cmd),now=new Date();
      if(namedMonth){const mm=String(namedMonth.idx+1).padStart(2,'0');reportDetailed('income',f=>(f.date||'').startsWith(`${now.getFullYear()}-${mm}`),`${namedMonth.name} ${now.getFullYear()}`);}
      else if(isThisMonth(cmd)){const mm=String(now.getMonth()+1).padStart(2,'0');const label=now.toLocaleString('default',{month:'long'})+' '+now.getFullYear();reportDetailed('income',f=>(f.date||'').startsWith(`${now.getFullYear()}-${mm}`),label);}
      else if(isThisYear(cmd)){reportDetailed('income',f=>(f.date||'').startsWith(`${now.getFullYear()}`),`Year ${now.getFullYear()}`);}
      else{reportDetailed('income',null,'All Time');}
      handled=true;
    }
    if(!handled&&(cmd.includes('top expense')||cmd.includes('highest expense')||cmd.includes('biggest expense'))){reportTopExpenses();handled=true;}
    if(!handled&&(cmd.includes('monthly summary')||cmd.includes('month by month')||cmd.includes('monthly breakdown'))){reportMonthlySummary();handled=true;}
    if(!handled&&(cmd.includes('cash flow')||cmd.includes('cashflow')||cmd.includes('income vs expense'))){reportCashFlow();handled=true;}
    if(!handled&&(cmd.includes('category report')||cmd.includes('category breakdown')||cmd.includes('categories'))){if(isExpenseKeyword(cmd))reportCategoryBreakdown('expense');else if(isIncomeKeyword(cmd))reportCategoryBreakdown('income');else reportCategoryBreakdown(null);handled=true;}

    const batchId=extractBatch(cmd);
    if(!handled&&batchId&&(cmd.includes('report')||cmd.includes('full')||cmd.includes('income')||cmd.includes('expense')||cmd.includes('paid')||cmd.includes('student'))){reportBatch(batchId);handled=true;}
    if(!handled&&batchId&&(cmd.includes('due')||cmd.includes('outstanding')||cmd.includes('pending'))){reportDue(batchId);handled=true;}

    const lastDays=extractLastDays(cmd);
    if(!handled&&lastDays){if(isExpenseKeyword(cmd)){reportLastDays(lastDays,'expense');handled=true;}else if(isIncomeKeyword(cmd)){reportLastDays(lastDays,'income');handled=true;}else{reportLastDays(lastDays,'all');handled=true;}}

    if(!handled&&isThisMonth(cmd)){const now=new Date();const mn=now.toLocaleString('default',{month:'long'});if(isExpenseKeyword(cmd)){reportMonthFinance(now.getFullYear(),now.getMonth()+1,mn,'expense');handled=true;}else if(isIncomeKeyword(cmd)){reportMonthFinance(now.getFullYear(),now.getMonth()+1,mn,'income');handled=true;}else{reportMonthFinance(now.getFullYear(),now.getMonth()+1,mn,'all');handled=true;}}
    if(!handled&&isThisYear(cmd)){const year=new Date().getFullYear();if(isExpenseKeyword(cmd)){reportYearFinance(year,'expense');handled=true;}else if(isIncomeKeyword(cmd)){reportYearFinance(year,'income');handled=true;}else{reportYearFinance(year,'all');handled=true;}}

    if(!handled){const namedMonth=getMonthIndex(cmd);if(namedMonth&&(isExpenseKeyword(cmd)||isIncomeKeyword(cmd)||cmd.includes('report')||cmd.includes('summary'))){const year=new Date().getFullYear();if(isExpenseKeyword(cmd)){reportMonthFinance(year,namedMonth.idx+1,namedMonth.name,'expense');handled=true;}else if(isIncomeKeyword(cmd)){reportMonthFinance(year,namedMonth.idx+1,namedMonth.name,'income');handled=true;}else{reportMonthFinance(year,namedMonth.idx+1,namedMonth.name,'all');handled=true;}}}

    if(!handled&&((cmd.includes('today')&&(cmd.includes('report')||cmd.includes('summary')))||cmd==='today'||cmd.includes('daily report'))){reportToday();handled=true;}
    if(!handled&&(cmd.includes('salary')||cmd.includes('payroll'))){reportSalary(cmd);handled=true;}
    if(!handled&&(cmd.includes('student report')||cmd.includes('total student'))){reportStudents();handled=true;}
    if(!handled&&(cmd.includes('finance summary')||cmd.includes('finance report')||cmd.includes('total income')||cmd.includes('total expense'))){reportFinance();handled=true;}
    if(!handled&&(cmd.includes('pending due')||cmd.includes('total due')||cmd.includes('outstanding'))){reportDue(null);handled=true;}
    if(!handled&&(cmd.includes('account balance')||cmd.includes('bank balance')||cmd.includes('total balance'))){reportBalance();handled=true;}
    if(!handled&&(cmd.includes('help')||cmd.includes('what can you')||cmd.includes('commands')||cmd.includes('command list'))){reportHelp();handled=true;}

    // ── ★ ANIMATED NAVIGATION v4.0 ★ ─────────────────────────────
    if (!handled) {
      const navTriggers = ['open','go to','fly to','walk to','navigate to','take me to','show me','switch to','jump to'];
      const hasNavTrigger = navTriggers.some(t => cmd.includes(t));
      const justNamed = !hasNavTrigger; // also allow bare "students", "settings" etc.

      const navigations = [
        { t:['dashboard','home','main screen','go home','show dashboard'], tab:'dashboard',    l:'Dashboard' },
        { t:['student','students'],                 tab:'students',     l:'Students' },
        { t:['finance','payment','ledger','money'],  tab:'finance',      l:'Finance' },
        { t:['account','accounts','bank'],           tab:'accounts',     l:'Accounts' },
        { t:['loan','loans'],                        tab:'loans',        l:'Loans' },
        { t:['visitor','visitors','guest'],          tab:'visitors',     l:'Visitors' },
        { t:['hr','staff','employee','human resource'],tab:'hr-staff',   l:'HR & Staff' },
        { t:['exam','exams','result','test'],         tab:'exam',        l:'Exams' },
        { t:['salary','payroll'],                    tab:'salary',       l:'Salary' },
        { t:['attendance','present','absent'],        tab:'attendance',   l:'Attendance' },
        { t:['id card','id-card','identity card'],    tab:'id-cards',    l:'ID Cards' },
        { t:['certificate','certificates'],           tab:'certificates', l:'Certificates' },
        { t:['notice','board','announcement'],        tab:'notice-board', l:'Notice Board' },
        { t:['setting','settings','theme','preference'],tab:'settings',  l:'Settings' },
      ];

      for (let nav of navigations) {
        if (nav.t.some(k => cmd.includes(k))) {
          // Use animated navigation
          animatedNavigate(nav.tab, nav.l, () => {
            if (typeof App !== 'undefined') App.navigateTo(nav.tab);
            if (typeof Utils !== 'undefined') Utils.toast(`📂 Opening ${nav.l}`, 'success');
          });
          handled = true;
          break;
        }
      }
    }

    // ── LOGOUT ───────────────────────────────────────────────────
    if(!handled&&(cmd.includes('logout')||cmd.includes('log out')||cmd.includes('sign out'))){
      speak('Logging out. Goodbye, Admin! See you soon!');
      setTimeout(()=>{const lb=document.getElementById('btn-logout');if(lb)lb.click();else if(typeof App!=='undefined')App.logout();},1800);
      handled=true;
    }

    // ── UNRECOGNIZED ─────────────────────────────────────────────
    if(!handled){
      if(typeof Utils!=='undefined') Utils.toast(`Not recognized: "${raw}" — say "help"`, 'warn');
      const msg = currentLang === 'bn-IN' ? 'সরি স্যার, আই ডোন্ট আন্ডারস্ট্যান্ড।' : 'Sorry Sir, I don\'t understand.';
      speak(msg);
      showBubble(msg, false);
    }
  }

  return { init, speak };
})();

document.addEventListener('DOMContentLoaded', () => setTimeout(() => VoiceAssistant.init(), 1500));
window.VoiceAssistant = VoiceAssistant;
