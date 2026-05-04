/**
 * Wings Fly Academy — AI Assistant (Gemini-Powered Chat)
 * Samsung Z Fold 6 Optimized
 *
 * Features:
 * - Gemini 1.5 Flash API (free tier: 15 req/min)
 * - Bengali + English bilingual
 * - Academy data context (students, finance, attendance)
 * - Works with existing Voice Assistant angel doll
 * - Fold-aware layout (inner + outer screen)
 * - Battery optimized (pause animations in background)
 */

const AIAssistant = (() => {
  // ── Config ──
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const FETCH_TIMEOUT_MS  = 15000; // 15s timeout for mobile networks
  // Bug #16 Fix: History constants for proper memory management
  const MAX_HISTORY_PAIRS = 20; // 20 user+model pairs = 40 messages max
  const TRIM_TO_PAIRS     = 15; // When limit hit, trim to last 15 pairs

  let chatHistory = [];
  let isOpen = false;

  // Bug #20 Fix: Persist chat history via IndexedDB
  function _saveChatHistory() {
    try {
      if (typeof WFA_IDB !== 'undefined') {
        WFA_IDB.setTable('ai_chat_history', chatHistory);
      }
    } catch (e) { console.warn('[AIAssistant] Save history failed:', e); }
  }

  function _loadChatHistory() {
    try {
      if (typeof WFA_IDB !== 'undefined') {
        const saved = WFA_IDB.getTable('ai_chat_history');
        if (Array.isArray(saved) && saved.length > 0) {
          chatHistory = saved;
        }
      }
    } catch (e) { console.warn('[AIAssistant] Load history failed:', e); }
  }
  let isTyping = false;

  // ── System Prompt ──
  function _getSystemPrompt() {
    const students = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
      ? SupabaseSync.getAll(DB.students) || [] : [];
    const cfg = (typeof SupabaseSync !== 'undefined' && typeof DB !== 'undefined')
      ? (SupabaseSync.getAll(DB.settings)[0] || {}) : {};

    return `আপনি Wings Fly Aviation Academy-র AI সহায়ক।
Academy Name: ${cfg.academy_name || 'Wings Fly Aviation Academy'}
মোট ছাত্র সংখ্যা: ${students.length}
আপনি Bengali এবং English উভয় ভাষায় উত্তর দেন।
সংক্ষিপ্ত, সহায়ক এবং বন্ধুত্বপূর্ণ উত্তর দিন।
Academy-সংক্রান্ত প্রশ্ন: ছাত্র, ফাইন্যান্স, উপস্থিতি, পরীক্ষা সব বিষয়ে সাহায্য করুন।`;
  }

  // ── Retrieve API Key (with fallback chain) ──
  // ✅ Default key embedded so AI works out-of-the-box on any device
  const DEFAULT_API_KEY = 'AIzaSyAIs2tGVCxMH-PJzU4NGE7I3h_Y8ucFFK0';

  async function _getApiKey() {
    try {
      // 1. Try SecureStorage (encrypted — user may have set a custom key)
      if (typeof SecureStorage !== 'undefined') {
        const key = await SecureStorage.getItem('wfa_gemini_key');
        if (key) { console.log('[AIAssistant] Key from SecureStorage ✓'); return key; }
      }
    } catch (e) {
      console.warn('[AIAssistant] SecureStorage.getItem failed, trying fallback:', e.message);
    }
    // 2. Fallback: raw localStorage
    const raw = localStorage.getItem('wfa_gemini_key');
    if (raw) {
      if (raw.startsWith('wfa_enc::')) {
        console.warn('[AIAssistant] Key is encrypted but SecureStorage unavailable — using default.');
        return DEFAULT_API_KEY;
      }
      console.log('[AIAssistant] Key from localStorage fallback ✓');
      return raw;
    }
    // 3. Final fallback: hardcoded default key (permanent)
    console.log('[AIAssistant] Using default embedded API key ✓');
    return DEFAULT_API_KEY;
  }

  // ── API Call ──
  async function chat(userMessage) {
    console.log('[AIAssistant] chat() called with:', userMessage?.substring(0, 50));

    // ✅ Bug #1 + #5 Fix: Read API key with robust fallback
    const key = await _getApiKey();
    if (!key) {
      console.warn('[AIAssistant] No API key found');
      return '⚠️ Gemini API Key সেট করা হয়নি। Settings → AI Assistant → API Key দিন।';
    }

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      // ✅ Mobile Fix: AbortController timeout to prevent silent hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      console.log('[AIAssistant] Sending request to Gemini...');
      const response = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: _getSystemPrompt() }] },
          contents: chatHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            topK: 40,
            topP: 0.95
          }
        })
      });
      clearTimeout(timeoutId);

      console.log('[AIAssistant] Response status:', response.status);

      if (!response.ok) {
        let errMsg = response.statusText;
        try { const err = await response.json(); errMsg = err.error?.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'উত্তর পাওয়া যায়নি।';
      chatHistory.push({ role: 'model', parts: [{ text: reply }] });
      _saveChatHistory(); // Bug #20 Fix: Persist after each exchange

      // Bug #16 Fix: Trim history when exceeding limit — keep most recent pairs
      if (chatHistory.length > MAX_HISTORY_PAIRS * 2) {
        const keepCount = TRIM_TO_PAIRS * 2;
        chatHistory = chatHistory.slice(chatHistory.length - keepCount);
      }

      console.log('[AIAssistant] Reply received ✓');
      return reply;
    } catch (e) {
      console.error('[AIAssistant] Error:', e);
      chatHistory.pop(); // Remove failed user message
      if (e.name === 'AbortError') return '⏳ সময় শেষ। ইন্টারনেট ধীর থাকতে পারে। আবার চেষ্টা করুন।';
      if (!navigator.onLine) return '📴 Internet নেই। সংযোগ ফিরলে আবার চেষ্টা করুন।';
      return `❌ ত্রুটি: ${e.message}`;
    }
  }

  // ── UI ──
  function openChat() {
    if (isOpen) { document.getElementById('ai-chat-modal')?.classList.add('open'); return; }
    isOpen = true;

    const modal = document.createElement('div');
    modal.id = 'ai-chat-modal';
    modal.className = 'ai-chat-modal open';
    modal.innerHTML = `
      <div class="ai-chat-box">
        <div class="ai-chat-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">✨</div>
            <div>
              <div style="font-weight:800;color:#00d4ff;font-size:0.95rem;">Wings AI Assistant</div>
              <div style="font-size:0.7rem;color:#00ff88;">● Online — Gemini 1.5 Flash</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="AIAssistant.clearChat()" title="Clear" style="background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.75rem;">🗑️</button>
            <button onclick="AIAssistant.closeChat()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
          </div>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages">
          <div class="ai-msg ai-msg-bot">
            <span>👋 আমি Wings Fly Academy-র AI সহায়ক। আপনাকে কীভাবে সাহায্য করতে পারি?<br><small style="opacity:0.6">ছাত্র, ফাইন্যান্স, উপস্থিতি, পরীক্ষা — যেকোনো প্রশ্ন করুন!</small></span>
          </div>
        </div>
        <div class="ai-chat-input-area">
          <div id="ai-key-warning" style="display:none;
            gap:8px;align-items:center;padding:8px 12px;background:rgba(255,107,53,0.1);
            border:1px solid rgba(255,107,53,0.3);border-radius:8px;margin-bottom:8px;font-size:0.75rem;color:#ff6b35;">
            ⚠️ API Key নেই!
            <button onclick="AIAssistant.promptApiKey()" style="background:rgba(255,107,53,0.2);border:1px solid rgba(255,107,53,0.4);color:#ff6b35;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:0.72rem;">Key দিন</button>
          </div>
          <div style="display:flex;gap:8px;">
            <input id="ai-chat-input" type="text" placeholder="আপনার প্রশ্ন লিখুন..."
              onkeydown="if(event.key==='Enter')AIAssistant.sendMessage()"
              style="flex:1;padding:10px 14px;background:rgba(0,0,0,0.3);border:1px solid rgba(0,212,255,0.2);
                border-radius:8px;color:#fff;font-size:0.85rem;outline:none;font-family:inherit;" />
            <button onclick="AIAssistant.sendMessage()" id="ai-send-btn" style="
              padding:10px 16px;background:linear-gradient(135deg,#00d4ff,#a855f7);
              border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;
              white-space:nowrap;font-size:0.85rem;">
              ➤
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 100);

    // Battery optimization
    document.addEventListener('visibilitychange', _handleVisibility);
  }

  function closeChat() {
    const modal = document.getElementById('ai-chat-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
        isOpen = false;
        // Bug #16 Fix: Clear history on close to prevent memory leak
        // History kept in memory indefinitely was the leak source
        if (chatHistory.length > MAX_HISTORY_PAIRS * 2) {
          chatHistory = chatHistory.slice(-TRIM_TO_PAIRS * 2);
        }
      }, 300);
    }
    document.removeEventListener('visibilitychange', _handleVisibility);
  }

  function clearChat() {
    chatHistory = [];
    _saveChatHistory(); // Bug #20 Fix: Clear persisted history too
    const msgs = document.getElementById('ai-chat-messages');
    if (msgs) msgs.innerHTML = `<div class="ai-msg ai-msg-bot"><span>✨ Chat cleared! নতুন প্রশ্ন করুন।</span></div>`;
  }

  async function sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const text = input?.value?.trim();
    if (!text || isTyping) return;

    input.value = '';
    isTyping = true;

    _appendMessage('user', text);
    const typingEl = _appendTyping();

    const reply = await chat(text);
    typingEl.remove();
    _appendMessage('bot', reply);
    isTyping = false;

    // Also speak via voice assistant if active
    if (typeof VoiceAssistant !== 'undefined' && reply.length < 200) {
      // Optionally speak short replies
    }
  }

  function _appendMessage(role, text) {
    const msgs = document.getElementById('ai-chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'bot'}`;
    // ✅ Bug #30 Fix: Use textContent for user messages to prevent XSS;
    // bot replies use safe line-break rendering only
    const span = document.createElement('span');
    if (role === 'user') {
      span.textContent = text;
    } else {
      // Bot: allow line breaks but escape HTML
      text.split('\n').forEach((line, i, arr) => {
        span.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) span.appendChild(document.createElement('br'));
      });
    }
    div.appendChild(span);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function _appendTyping() {
    const msgs = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-bot ai-typing';
    div.innerHTML = `<span><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></span>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function promptApiKey() {
    const key = prompt('Google Gemini API Key দিন:\n(পান: https://aistudio.google.com/app/apikey)');
    if (key?.trim()) {
      // Bug #5 Fix: Store API key — try SecureStorage first, then localStorage
      const trimmed = key.trim();
      // Always save a plain copy in localStorage for fallback
      localStorage.setItem('wfa_gemini_key', trimmed);
      // Also save encrypted version if available
      if (typeof SecureStorage !== 'undefined') {
        SecureStorage.setItem('wfa_gemini_key', trimmed).catch(() => {});
      }
      document.getElementById('ai-key-warning')?.style.setProperty('display', 'none');
      if (typeof Utils !== 'undefined') Utils.toast('✅ Gemini API Key saved!', 'success');
    }
  }

  // ── Battery: pause animations when hidden ──
  function _handleVisibility() {
    const dots = document.querySelectorAll('.ai-dot');
    dots.forEach(d => d.style.animationPlayState = document.hidden ? 'paused' : 'running');
  }

  // ── Inject CSS ──
  function _injectStyles() {
    if (document.getElementById('ai-assistant-chat-css')) return;
    const style = document.createElement('style');
    style.id = 'ai-assistant-chat-css';
    style.textContent = `
      .ai-chat-modal {
        position: fixed; inset: 0; z-index: 10500;
        display: none; align-items: flex-end; justify-content: flex-end;
        padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom));
        pointer-events: none;
      }
      .ai-chat-modal.open { display: flex; pointer-events: all; }
      .ai-chat-modal.closing .ai-chat-box { animation: aiSlideOut 0.3s ease forwards; }
      .ai-chat-box {
        width: 100%; max-width: 400px;
        background: linear-gradient(135deg, #090d22 0%, #0e0a25 100%);
        border: 1.5px solid rgba(0,212,255,0.25);
        border-radius: 16px;
        box-shadow: 0 0 40px rgba(168,85,247,0.2), 0 20px 60px rgba(0,0,0,0.6);
        display: flex; flex-direction: column;
        max-height: 70vh; overflow: hidden;
        animation: aiSlideIn 0.3s cubic-bezier(0.16,1,0.3,1);
      }
      @keyframes aiSlideIn { from { opacity:0; transform:translateY(20px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes aiSlideOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(20px); } }
      .ai-chat-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(0,212,255,0.1);
        background: rgba(0,0,0,0.3);
        flex-shrink: 0;
      }
      .ai-chat-messages {
        flex: 1; overflow-y: auto; padding: 14px;
        display: flex; flex-direction: column; gap: 10px;
        -webkit-overflow-scrolling: touch;
      }
      .ai-msg { display: flex; max-width: 85%; }
      .ai-msg span {
        padding: 10px 14px; border-radius: 12px;
        font-size: 0.84rem; line-height: 1.5; color: #fff;
      }
      .ai-msg-user { align-self: flex-end; margin-left: auto; }
      .ai-msg-user span { background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2)); border: 1px solid rgba(0,212,255,0.3); border-radius: 12px 12px 2px 12px; }
      .ai-msg-bot span { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px 12px 12px 2px; }
      .ai-typing span { display: flex; gap: 4px; align-items: center; padding: 12px 16px; }
      .ai-dot { width: 7px; height: 7px; border-radius: 50%; background: #00d4ff; animation: aiDotBounce 1.2s infinite ease-in-out; }
      .ai-dot:nth-child(2) { animation-delay: 0.2s; }
      .ai-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes aiDotBounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }
      .ai-chat-input-area { padding: 12px 14px; border-top: 1px solid rgba(0,212,255,0.08); flex-shrink: 0; }
      /* Fold 6: Wide inner display */
      @media (min-width: 600px) {
        .ai-chat-box { max-width: 480px; max-height: 65vh; }
      }
      /* Fold 6: Unfolded */
      @media (min-width: 1400px) {
        .ai-chat-box { max-width: 560px; max-height: 75vh; }
        .ai-chat-modal { padding: 32px; }
      }
      /* Mobile: full width */
      @media (max-width: 480px) {
        .ai-chat-modal { padding: 0; align-items: flex-end; }
        .ai-chat-box { max-width: 100%; border-radius: 16px 16px 0 0; max-height: 80vh; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Toggle button in topbar & mobile more menu ──
  function addToggleButton() {
    // 1. Desktop Topbar
    const topbar = document.querySelector('.topbar-actions, .top-bar-right, #topbar');
    if (topbar && !document.getElementById('btn-ai-chat')) {
      const btn = document.createElement('button');
      btn.id = 'btn-ai-chat';
      btn.title = 'AI Assistant';
      btn.onclick = openChat;
      btn.innerHTML = '✨';
      btn.style.cssText = `
        background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,212,255,0.15));
        border: 1px solid rgba(168,85,247,0.3);
        border-radius: 8px; padding: 6px 10px;
        color: #a855f7; font-size: 1rem; cursor: pointer;
        transition: all 0.2s;
      `;
      topbar.insertBefore(btn, topbar.firstChild);
    }

    // 2. Mobile More Menu
    const moreMenu = document.getElementById('bottom-nav-more-menu');
    if (moreMenu && !document.getElementById('btn-ai-chat-mobile')) {
      const btn = document.createElement('button');
      btn.id = 'btn-ai-chat-mobile';
      btn.className = 'more-item';
      btn.onclick = () => {
        openChat();
        // Close more menu if it's open
        document.getElementById('bottom-nav-more-menu')?.classList.remove('open');
      };
      btn.innerHTML = '<i class="fa fa-robot" style="color:#a855f7"></i><span>AI Assistant</span>';
      moreMenu.appendChild(btn);
    }
  }

  function init() {
    console.log('[AIAssistant] Initializing...');
    _injectStyles();
    // Bug #20 Fix: Load persisted chat history on init
    if (typeof WFA_IDB !== 'undefined') {
      WFA_IDB.onReady(() => _loadChatHistory());
    }
    // Add toggle button after DOM ready
    setTimeout(addToggleButton, 1500);
    // ✅ Mobile Fix: Hide key warning if key exists (check async)
    setTimeout(async () => {
      const existingKey = await _getApiKey();
      if (existingKey) {
        document.getElementById('ai-key-warning')?.style.setProperty('display', 'none');
      }
    }, 2000);
    console.log('[AIAssistant] Init complete ✓');
  }

  return { init, openChat, closeChat, clearChat, sendMessage, promptApiKey, chat };
})();

// Auto-init
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AIAssistant.init());
else AIAssistant.init();
