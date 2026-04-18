/**
 * Wings Fly Academy — AI Voice Assistant Module
 * Features:
 * - Floating Voice Assistant button.
 * - Voice navigation & commands.
 * - Initial Greeting System.
 */

const VoiceAssistant = (() => {
  let isListening = false;
  let recognition = null;
  let synth = window.speechSynthesis;
  // Use generic voice if available
  let voiceInstance = null;

  function init() {
    // 1. Create floating mic button
    const btn = document.createElement('button');
    btn.id = 'ai-voice-btn';
    btn.innerHTML = '<i class="fa fa-microphone"></i>';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.width = '60px';
    btn.style.height = '60px';
    btn.style.borderRadius = '50%';
    btn.style.background = 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.fontSize = '1.5rem';
    btn.style.boxShadow = '0 0 20px rgba(181, 55, 242, 0.4)';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '9999';
    btn.style.transition = 'transform 0.2s, box-shadow 0.2s';
    
    btn.onmouseover = () => { btn.style.transform = 'scale(1.1)'; };
    btn.onmouseout = () => { btn.style.transform = 'scale(1)'; };
    
    btn.onclick = toggleListening;
    document.body.appendChild(btn);

    // 2. Setup recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      // Bengali and English recognition
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = function() {
        isListening = true;
        btn.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.8)';
        btn.style.animation = 'pulseCardGlow 1s infinite alternate';
        btn.innerHTML = '<i class="fa fa-microphone-lines"></i>';
        if (typeof Utils !== 'undefined') Utils.toast('Listening... Speak now.', 'info');
      };

      recognition.onresult = function(event) {
        const command = event.results[0][0].transcript.toLowerCase();
        console.log('Voice Command Received: ', command);
        processCommand(command);
      };

      recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech' && typeof Utils !== 'undefined') {
          Utils.toast('Mic error: ' + event.error, 'error');
        }
        stopUI();
      };

      recognition.onend = function() {
        stopUI();
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
      btn.style.display = 'none';
    }

    // Attempt greeting when voices loaded
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = setVoice;
    }
    
    // Slight delay before greeting
    setTimeout(greetUser, 2000);
  }

  function setVoice() {
    const voices = synth.getVoices();
    // Try to find a good English voice
    voiceInstance = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices[0];
  }

  function speak(text) {
    if (synth.speaking) {
       console.error('speechSynthesis.speaking');
       return;
    }
    if (text !== '') {
      const utterThis = new SpeechSynthesisUtterance(text);
      if (!voiceInstance) setVoice();
      utterThis.voice = voiceInstance;
      utterThis.pitch = 1;
      utterThis.rate = 1;
      synth.speak(utterThis);
    }
  }

  function greetUser() {
    // Only greet if user is logged in
    const isLoggedIn = sessionStorage.getItem('wfa_auth') === 'true';
    if(isLoggedIn) {
      speak("Welcome back, Admin. System is online and ready.");
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
      } catch(e) {
        // Handle case where recognition was already started
        console.warn(e);
      }
    }
  }

  function stopUI() {
    isListening = false;
    const btn = document.getElementById('ai-voice-btn');
    if(btn) {
      btn.style.animation = 'none';
      btn.style.boxShadow = '0 0 20px rgba(181, 55, 242, 0.4)';
      btn.innerHTML = '<i class="fa fa-microphone"></i>';
    }
  }

  function processCommand(cmd) {
    let handled = false;
    
    const navigations = [
      { trigger: ['dashboard', 'home'], tab: 'dashboard', speak: 'Opening Dashboard' },
      { trigger: ['student', 'students'], tab: 'students', speak: 'Opening Students' },
      { trigger: ['finance', 'payment', 'collection'], tab: 'finance', speak: 'Opening Finance Ledger' },
      { trigger: ['account'], tab: 'accounts', speak: 'Opening Accounts' },
      { trigger: ['loan'], tab: 'loans', speak: 'Opening Loans' },
      { trigger: ['visitor'], tab: 'visitors', speak: 'Opening Visitors' },
      { trigger: ['hr', 'staff', 'employee'], tab: 'hr-staff', speak: 'Opening HR and Staff' },
      { trigger: ['exam', 'result'], tab: 'exam', speak: 'Opening Exams' },
      { trigger: ['salary'], tab: 'salary', speak: 'Opening Salary Hub' },
      { trigger: ['attendance', 'present'], tab: 'attendance', speak: 'Opening Attendance' },
      { trigger: ['id card', 'id-card'], tab: 'id-cards', speak: 'Opening ID Cards' },
      { trigger: ['certificate'], tab: 'certificates', speak: 'Opening Certificates' },
      { trigger: ['notice', 'board'], tab: 'notice-board', speak: 'Opening Notice Board' },
      { trigger: ['setting', 'settings', 'theme'], tab: 'settings', speak: 'Opening Settings' }
    ];

    for (let nav of navigations) {
      if (nav.trigger.some(t => cmd.includes(t))) {
        // Trigger click on corresponding nav item
        const navBtn = document.querySelector(\`button[data-section="\${nav.tab}"]\`);
        if (navBtn) {
          navBtn.click();
          if (typeof Utils !== 'undefined') Utils.toast(nav.speak, 'success');
          speak(nav.speak);
          handled = true;
          break;
        }
      }
    }

    if (!handled) {
      if (cmd.includes('logout') || cmd.includes('log out') || cmd.includes('sign out')) {
        speak('Logging out. Goodbye.');
        setTimeout(() => {
          document.getElementById('logout-btn')?.click();
        }, 1500);
      } else {
        if (typeof Utils !== 'undefined') Utils.toast("Command not recognized: " + cmd, 'warn');
        speak("I didn't quite catch that.");
      }
    }
  }

  return { init, speak };
})();

// Auto-init on page load if logged in, or attached to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Slight delay to ensure other UI initialized
    setTimeout(() => {
        VoiceAssistant.init();
    }, 1500);
});
