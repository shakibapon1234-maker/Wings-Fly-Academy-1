/**
 * Wings Fly Academy — AI Voice Assistant Module
 * Fixed bugs:
 * - Greeting check now uses correct key: localStorage 'wfa_logged_in'
 * - Logout command uses correct button ID: 'btn-logout'
 * - Mic button hidden until user is logged in
 */

const VoiceAssistant = (() => {
  let isListening = false;
  let recognition = null;
  let synth = window.speechSynthesis;
  let voiceInstance = null;
  let btn = null;

  function init() {
    // 1. Create floating mic button — hidden by default
    btn = document.createElement('button');
    btn.id = 'ai-voice-btn';
    btn.title = 'Voice Assistant (Click to speak)';
    btn.innerHTML = '<i class="fa fa-microphone"></i>';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 55px;
      height: 55px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
      color: #fff;
      border: none;
      font-size: 1.4rem;
      box-shadow: 0 0 20px rgba(181, 55, 242, 0.4);
      cursor: pointer;
      z-index: 9998;
      transition: transform 0.2s, box-shadow 0.2s;
      display: none;
    `;

    btn.onmouseover = () => { btn.style.transform = 'scale(1.1)'; };
    btn.onmouseout  = () => { btn.style.transform = 'scale(1)'; };
    btn.onclick = toggleListening;
    document.body.appendChild(btn);

    // 2. Show mic btn only when logged in
    checkVisibility();
    window.addEventListener('wfa:navigate', checkVisibility);

    // 3. Setup recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListening = true;
        btn.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.8)';
        btn.style.animation = 'pulseCardGlow 1s infinite alternate';
        btn.innerHTML = '<i class="fa fa-microphone-lines"></i>';
        if (typeof Utils !== 'undefined') Utils.toast('Listening… Speak now.', 'info');
      };

      recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        console.log('[Voice] Command:', command);
        processCommand(command);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && typeof Utils !== 'undefined') {
          Utils.toast('Mic error: ' + event.error, 'error');
        }
        stopUI();
      };

      recognition.onend = stopUI;
    } else {
      console.warn('[Voice] Speech Recognition API not supported.');
      if (btn) btn.style.display = 'none';
    }

    // 4. Load voice
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = setVoice;
    }

    // 5. Greeting on login
    window.addEventListener('wfa:navigate', (e) => {
      if (e.detail?.section === 'dashboard') {
        setTimeout(greetUser, 1500);
      }
    });
  }

  function checkVisibility() {
    if (!btn) return;
    const loggedIn = localStorage.getItem('wfa_logged_in') === 'true';
    btn.style.display = loggedIn ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  }

  function setVoice() {
    const voices = synth.getVoices();
    voiceInstance = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices[0] || null;
  }

  function speak(text) {
    if (!text || synth.speaking) return;
    try {
      const utterThis = new SpeechSynthesisUtterance(text);
      if (!voiceInstance) setVoice();
      utterThis.voice = voiceInstance;
      utterThis.pitch = 1;
      utterThis.rate = 1;
      synth.speak(utterThis);
    } catch (e) {
      console.warn('[Voice] speak error:', e);
    }
  }

  function greetUser() {
    // FIX: use correct key — localStorage wfa_logged_in
    const isLoggedIn = localStorage.getItem('wfa_logged_in') === 'true';
    if (isLoggedIn) {
      speak('Welcome back, Admin. System is online and ready.');
    }
  }

  function toggleListening() {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      stopUI();
    } else {
      try {
        recognition.start();
      } catch (e) {
        console.warn('[Voice] recognition start error:', e);
      }
    }
  }

  function stopUI() {
    isListening = false;
    const b = document.getElementById('ai-voice-btn');
    if (b) {
      b.style.animation = 'none';
      b.style.boxShadow = '0 0 20px rgba(181, 55, 242, 0.4)';
      b.innerHTML = '<i class="fa fa-microphone"></i>';
    }
  }

  function processCommand(cmd) {
    let handled = false;

    const navigations = [
      { trigger: ['dashboard', 'home'],             tab: 'dashboard',    speak: 'Opening Dashboard' },
      { trigger: ['student', 'students'],            tab: 'students',     speak: 'Opening Students' },
      { trigger: ['finance', 'payment', 'ledger'],   tab: 'finance',      speak: 'Opening Finance Ledger' },
      { trigger: ['account', 'accounts'],            tab: 'accounts',     speak: 'Opening Accounts' },
      { trigger: ['loan', 'loans'],                  tab: 'loans',        speak: 'Opening Loans' },
      { trigger: ['visitor', 'visitors'],            tab: 'visitors',     speak: 'Opening Visitors' },
      { trigger: ['hr', 'staff', 'employee'],        tab: 'hr-staff',     speak: 'Opening HR and Staff' },
      { trigger: ['exam', 'exams', 'result'],        tab: 'exam',         speak: 'Opening Exams' },
      { trigger: ['salary'],                         tab: 'salary',       speak: 'Opening Salary Hub' },
      { trigger: ['attendance', 'present'],          tab: 'attendance',   speak: 'Opening Attendance' },
      { trigger: ['id card', 'id-card'],             tab: 'id-cards',     speak: 'Opening ID Cards' },
      { trigger: ['certificate'],                    tab: 'certificates', speak: 'Opening Certificates' },
      { trigger: ['notice', 'board'],                tab: 'notice-board', speak: 'Opening Notice Board' },
      { trigger: ['setting', 'settings', 'theme'],   tab: 'settings',     speak: 'Opening Settings' },
    ];

    for (let nav of navigations) {
      if (nav.trigger.some(t => cmd.includes(t))) {
        if (typeof App !== 'undefined') App.navigateTo(nav.tab);
        if (typeof Utils !== 'undefined') Utils.toast(nav.speak, 'success');
        speak(nav.speak);
        handled = true;
        break;
      }
    }

    if (!handled) {
      if (cmd.includes('logout') || cmd.includes('log out') || cmd.includes('sign out')) {
        speak('Logging out. Goodbye.');
        setTimeout(() => {
          // FIX: correct button ID is 'btn-logout'
          const logoutBtn = document.getElementById('btn-logout');
          if (logoutBtn) logoutBtn.click();
          else if (typeof App !== 'undefined') App.logout();
        }, 1500);
        handled = true;
      }
    }

    if (!handled) {
      if (typeof Utils !== 'undefined') Utils.toast(`Command not recognized: "${cmd}"`, 'warn');
      speak("I didn't quite catch that. Please try again.");
    }
  }

  return { init, speak };
})();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => VoiceAssistant.init(), 1500);
});

// Bug #2 fix: export to window so other modules can access VoiceAssistant
window.VoiceAssistant = VoiceAssistant;
