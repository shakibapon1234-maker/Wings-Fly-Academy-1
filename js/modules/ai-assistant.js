/**
 * Wings Fly Aviation Academy — Academy Assistant
 * Primary: local data (students, finance) — no API, no quota, works offline
 * Optional: Gemini for general chat only (Settings → disable local-only)
 */

const AIAssistant = (() => {
  // ── Config ──
  // Multiple models: if one hits quota, try the next (separate limits per model on free tier)
  const GEMINI_MODELS = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest'
  ];
  const FETCH_TIMEOUT_MS = 15000;
  const LOCAL_ONLY_KEY = 'wfa_ai_local_only'; // default: local-only (no Gemini)

  function _isLocalOnlyMode() {
    return localStorage.getItem(LOCAL_ONLY_KEY) !== 'false';
  }

  function _num(v) {
    return typeof Utils !== 'undefined' ? Utils.safeNum(v) : (Number(v) || 0);
  }

  function _fmt(n) {
    return (typeof Utils !== 'undefined' && Utils.taka) ? Utils.taka(n) : `৳${n}`;
  }

  function _localHelpMessage() {
    return `📋 Academy Assistant (API লাগে না) — এগুলো জিজ্ঞেস করুন:
• "মোট ছাত্র কত?" / "সারাংশ"
• "বকেয়া কত?" / "আদায় কত?"
• "আজকের লেনদেন" / "সাম্প্রতিক লেনদেন"
• ছাত্রের নাম, ID (WF-...) বা ফোন নম্বর
• "Batch ২০" বা course নাম`;
  }
  // Bug #16 Fix: History constants for proper memory management
  // Reduced from 20→8 pairs to save tokens (each pair costs ~500-1000 tokens)
  const MAX_HISTORY_PAIRS = 8;  // 8 user+model pairs = 16 messages max
  const TRIM_TO_PAIRS     = 5;  // When limit hit, trim to last 5 pairs

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

  function _geminiUrl(model) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  /** Answer academy questions from local DB — permanent, no API. */
  function _getAcademySnapshot() {
    if (typeof SupabaseSync === 'undefined' || typeof DB === 'undefined') return null;
    const students = SupabaseSync.getAll(DB.students) || [];
    const finance  = SupabaseSync.getAll(DB.finance) || [];
    const today    = (typeof Utils !== 'undefined' && Utils.today) ? Utils.today() : new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const totalFee  = students.reduce((s, r) => s + _num(r.total_fee), 0);
    const totalPaid = students.reduce((s, r) => s + _num(r.paid), 0);
    const totalDue  = students.reduce((s, r) => s + _num(r.due), 0);
    const active    = students.filter(s => (s.status || 'Active') === 'Active').length;
    const inactive  = students.length - active;
    const todayFin  = finance.filter(f => (f.date || '').slice(0, 10) === today);
    const monthFin  = finance.filter(f => (f.date || '').slice(0, 10) >= monthStart);
    const todayIn   = todayFin.filter(f => f.type === 'income').reduce((s, f) => s + _num(f.amount), 0);
    const todayOut  = todayFin.filter(f => f.type === 'expense').reduce((s, f) => s + _num(f.amount), 0);
    const monthIn   = monthFin.filter(f => f.type === 'income').reduce((s, f) => s + _num(f.amount), 0);
    const monthOut  = monthFin.filter(f => f.type === 'expense').reduce((s, f) => s + _num(f.amount), 0);
    const dueStudents = students.filter(s => _num(s.due) > 0);
    const recentFin = [...finance].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
    const batches = [...new Set(students.map(s => String(s.batch || '').trim()).filter(Boolean))];
    return {
      students, finance, totalFee, totalPaid, totalDue, active, inactive,
      count: students.length, todayIn, todayOut, monthIn, monthOut,
      dueStudents, today, recentFin, batches, todayFin
    };
  }

  function _findStudents(snap, query) {
    const q = (query || '').toLowerCase().trim();
    const digits = q.replace(/\D/g, '');
    let hits = [];

    // WF- ID
    const idHit = snap.students.filter(s => (s.student_id || '').toLowerCase().includes(q));
    if (idHit.length) return idHit;

    // Phone
    if (digits.length >= 4) {
      hits = snap.students.filter(s => (s.phone || '').replace(/\D/g, '').includes(digits));
      if (hits.length) return hits;
    }

    // Full/partial name in query
    hits = snap.students.filter(s => {
      const name = (s.name || '').toLowerCase();
      return name.length > 2 && q.includes(name);
    });
    if (hits.length) return hits;

    // Query words match name tokens (e.g. "karim er due")
    const words = q.split(/[\s,?.!]+/).filter(w => w.length > 2 && !/^(কত|কো|তথ্য|due|info|student|ছাত্র|batch|course|আজ|today|মোট|total|এর|the|a)$/i.test(w));
    if (words.length) {
      hits = snap.students.filter(s => {
        const name = (s.name || '').toLowerCase();
        return words.some(w => name.includes(w));
      });
      if (hits.length) return hits;
    }
    return [];
  }

  function _studentBlock(s) {
    return `👤 ${s.name}\n• ID: ${s.student_id || '—'} | ফোন: ${s.phone || '—'}\n• ${s.course || '—'} | Batch: ${s.batch || '—'}\n• ফি: ${_fmt(s.total_fee)} | আদায়: ${_fmt(s.paid)} | বকেয়া: ${_fmt(s.due)}\n• Status: ${s.status || 'Active'}`;
  }

  function _tryLocalAnswer(message) {
    const snap = _getAcademySnapshot();
    if (!snap) return null;
    const q = (message || '').toLowerCase().trim();
    if (!q) return null;

    // Help / greeting
    if (/^(hi|hello|hey|help|সাহায্য|হেল্প|কী জান|কি জান|কী বল|menu)$/i.test(q)) {
      return _localHelpMessage();
    }

    // Full summary
    if (/(সারাংশ|summary|dashboard|overview|রিপোর্ট|report)/i.test(q) ||
        (/(মোট|total|academy|একাডেমি)/i.test(q) && /(তথ্য|info|status|স্ট্যাট)/i.test(q))) {
      return `📊 Academy সারাংশ:\n• মোট ছাত্র: ${snap.count} (Active ${snap.active}, Inactive ${snap.inactive})\n• মোট ফি: ${_fmt(snap.totalFee)}\n• আদায়: ${_fmt(snap.totalPaid)}\n• বকেয়া: ${_fmt(snap.totalDue)} (${snap.dueStudents.length} জন)\n• আজ (${snap.today}): আয় ${_fmt(snap.todayIn)} | ব্যয় ${_fmt(snap.todayOut)}\n• এই মাস: আয় ${_fmt(snap.monthIn)} | ব্যয় ${_fmt(snap.monthOut)}`;
    }

    // Student count
    if (/(ছাত্র|student|স্টুডেন্ট)/i.test(q) && /(কত|সংখ্য|total|কয়জন|how many|মোট)/i.test(q)) {
      return `📊 মোট ছাত্র: ${snap.count}\n• Active: ${snap.active}\n• Inactive: ${snap.inactive}\n• মোট ফি: ${_fmt(snap.totalFee)} | আদায়: ${_fmt(snap.totalPaid)} | বকেয়া: ${_fmt(snap.totalDue)}`;
    }

    // Paid / collection
    if (/(আদায়|paid|collection|পেমেন্ট|payment|জমা)/i.test(q) && !/(বকেয়া|due|বাকি)/i.test(q)) {
      const todayPay = snap.todayFin.filter(f => f.type === 'income');
      return `💵 আদায়:\n• মোট আদায় (সব ছাত্র): ${_fmt(snap.totalPaid)}\n• আজ (${snap.today}) আয়: ${_fmt(snap.todayIn)} (${todayPay.length}টি লেনদেন)\n• এই মাসে আয়: ${_fmt(snap.monthIn)}`;
    }

    // Due
    if (/(বকেয়া|due|বাকি)/i.test(q)) {
      const top = [...snap.dueStudents].sort((a, b) => _num(b.due) - _num(a.due)).slice(0, 8);
      let lines = `💰 মোট বকেয়া: ${_fmt(snap.totalDue)} (${snap.dueStudents.length} জন)\n`;
      if (top.length) lines += 'শীর্ষ:\n' + top.map(s => `• ${s.name}: ${_fmt(s.due)}`).join('\n');
      return lines;
    }

    // Today's finance
    if (/(আজ|today)/i.test(q) && /(income|আয়|expense|ব্যয়|লেনদেন|finance|টাকা|transaction)/i.test(q)) {
      const items = (snap.finance || []).filter(f => (f.date || '').slice(0, 10) === snap.today)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
      let lines = `📅 আজ (${snap.today}):\n• আয়: ${_fmt(snap.todayIn)} | ব্যয়: ${_fmt(snap.todayOut)} | নিট: ${_fmt(snap.todayIn - snap.todayOut)}`;
      if (items.length) {
        lines += '\n\nলেনদেন:\n' + items.map(f => `• ${f.type === 'income' ? '+' : '-'}${_fmt(f.amount)} — ${f.description || f.category || '—'}`).join('\n');
      }
      return lines;
    }

    // Recent transactions
    if (/(সাম্প্রতিক|recent|latest|last).*(লেনদেন|transaction|finance)/i.test(q) ||
        /^(লেনদেন|transaction|finance)$/i.test(q)) {
      if (!snap.recentFin.length) return '📭 কোনো লেনদেন পাওয়া যায়নি।';
      return '📒 সাম্প্রতিক লেনদেন:\n' + snap.recentFin.map(f =>
        `• ${(f.date || '').slice(0, 10)} ${f.type === 'income' ? '+' : '-'}${_fmt(f.amount)} — ${f.description || f.category || '—'}`
      ).join('\n');
    }

    // Month finance
    if (/(এই মাস|this month|monthly|মাস)/i.test(q) && /(আয়|income|ব্যয়|expense|লেনদেন|finance)/i.test(q)) {
      return `📆 এই মাস:\n• আয়: ${_fmt(snap.monthIn)}\n• ব্যয়: ${_fmt(snap.monthOut)}\n• নিট: ${_fmt(snap.monthIn - snap.monthOut)}`;
    }

    // Batch query
    const batchM = q.match(/batch\s*[#:]?\s*(\S+)|ব্যাচ\s*(\S+)/i);
    if (batchM) {
      const bVal = (batchM[1] || batchM[2] || '').replace(/[^\w\d-]/g, '');
      const inBatch = snap.students.filter(s => String(s.batch || '').trim().toLowerCase() === bVal.toLowerCase());
      if (inBatch.length) {
        const bDue = inBatch.reduce((s, r) => s + _num(r.due), 0);
        return `🎓 Batch ${bVal}: ${inBatch.length} জন\n• বকেয়া: ${_fmt(bDue)}\n` +
          inBatch.slice(0, 10).map(s => `• ${s.name} — ${_fmt(s.due)} due`).join('\n');
      }
    }

    // Active students
    if (/(active|সক্রিয়)/i.test(q) && /(ছাত্র|student)/i.test(q)) {
      return `✅ Active: ${snap.active} জন | Inactive: ${snap.inactive} জন | মোট: ${snap.count}`;
    }

    // Student lookup (name / id / phone)
    const students = _findStudents(snap, q);
    if (students.length === 1) return _studentBlock(students[0]);
    if (students.length > 1) {
      return `🔍 ${students.length} জন মিলেছে:\n` + students.slice(0, 10).map(s =>
        `• ${s.name} (${s.student_id}) — বকেয়া ${_fmt(s.due)}`
      ).join('\n');
    }

    return null;
  }

  function _pushLocalReply(userMessage, reply) {
    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    _saveChatHistory();
    if (chatHistory.length > MAX_HISTORY_PAIRS * 2) {
      chatHistory = chatHistory.slice(-TRIM_TO_PAIRS * 2);
    }
  }

  // ── Retrieve API Key (with fallback chain) ──
  // ✅ SECURITY: Never hardcode API keys in source code!
  // Keys are stored in localStorage/SecureStorage by the user via Settings.
  // To add multiple keys for rotation, save them as:
  //   localStorage.setItem('wfa_gemini_key_2', 'YOUR_KEY_2');
  //   localStorage.setItem('wfa_gemini_key_3', 'YOUR_KEY_3');

  async function _readGeminiKey(slotKey) {
    if (typeof SecureStorage !== 'undefined') {
      try {
        const fromSecure = await SecureStorage.getItem(slotKey);
        if (fromSecure && !fromSecure.startsWith('wfa_enc::')) return fromSecure.trim();
      } catch (e) {
        console.warn('[AIAssistant] SecureStorage read failed:', slotKey, e.message);
      }
    }
    try {
      const raw = localStorage.getItem(slotKey);
      if (!raw) return null;
      if (raw.startsWith('••••')) return null;
      if (typeof SecureStorage !== 'undefined' && raw.startsWith(SecureStorage.ENC_PREFIX)) {
        const dec = await SecureStorage.decrypt(raw);
        return dec ? dec.trim() : null;
      }
      return raw.trim();
    } catch { return null; }
  }

  async function _getApiKeys() {
    const keysToTry = [];
    const slots = ['wfa_gemini_key', 'wfa_gemini_key_2', 'wfa_gemini_key_3', 'wfa_gemini_key_4', 'wfa_gemini_key_5'];
    for (const slot of slots) {
      const key = await _readGeminiKey(slot);
      if (key && key.length > 10 && !keysToTry.includes(key)) keysToTry.push(key);
    }
    return keysToTry;
  }

  function _quotaHelpMessage(lastMsg = '') {
    return `⏳ Gemini API দৈনিক/মিনিট লিমিট শেষ (নতুন Key-ও একই Google অ্যাকাউন্টে একই লিমিট শেয়ার করে)।
• কয়েক মিনিট পরে আবার চেষ্টা করুন, অথবা ভিন্ন Google অ্যাকাউন্টে নতুন Key বানান
• Settings → AI Assistant-এ Backup Key (২–৫) যোগ করতে পারেন
• Voice/AI বারবার চালালে দ্রুত লিমিট শেষ হয়
${lastMsg ? `\n(${lastMsg})` : ''}`;
  }

  // Detect if an error means quota/rate-limit (skip key) vs. temporary (retry)
  function _isQuotaError(msg = '') {
    return msg.includes('429') ||
           msg.includes('quota') ||
           msg.includes('RESOURCE_EXHAUSTED') ||
           msg.includes('Too Many Requests') ||
           msg.includes('rate limit');
  }

  // ── API Call ──
  async function _callGemini(key, model, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${_geminiUrl(model)}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body)
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errMsg = response.statusText;
        try { const err = await response.json(); errMsg = err.error?.message || errMsg; } catch { /* ignore */ }
        const err = new Error(errMsg);
        err.isQuota = _isQuotaError(errMsg) || response.status === 429;
        err.status = response.status;
        throw err;
      }
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /** Verify saved key — shows real Google error (quota vs invalid vs disabled). */
  async function testApiKey() {
    const keys = await _getApiKeys();
    if (!keys.length) {
      return { ok: false, message: '⚠️ কোনো API Key সেভ নেই।' };
    }
    const body = {
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      generationConfig: { maxOutputTokens: 8 }
    };
    let lastErr = '';
    for (let ki = 0; ki < keys.length; ki++) {
      for (const model of GEMINI_MODELS) {
        try {
          const text = await _callGemini(keys[ki], model, body);
          if (text) {
            return { ok: true, message: `✅ Key ${ki + 1} কাজ করছে (${model})`, model, keyIndex: ki + 1 };
          }
        } catch (e) {
          lastErr = e.message || String(e);
          if (e.isQuota || _isQuotaError(lastErr)) {
            return { ok: false, quota: true, message: `⏳ Key ${ki + 1} — লিমিট শেষ (${model}): ${lastErr}`, model };
          }
          if (e.status === 400 || e.status === 403) {
            return { ok: false, message: `❌ Key ${ki + 1} invalid/disabled: ${lastErr}`, model };
          }
        }
      }
    }
    return { ok: false, message: `❌ Key কাজ করছে না: ${lastErr || 'Unknown'}` };
  }

  async function chat(userMessage) {
    const local = _tryLocalAnswer(userMessage);
    if (local) {
      _pushLocalReply(userMessage, local);
      return local;
    }

    // Default: local-only — no Gemini, no API key needed
    if (_isLocalOnlyMode()) {
      const help = _localHelpMessage();
      _pushLocalReply(userMessage, help);
      return help;
    }

    const keys = await _getApiKeys();
    if (!keys || keys.length === 0) {
      return _localHelpMessage() + '\n\n(Gemini চ্যাট বন্ধ — Settings-এ Local Only mode চালু আছে বা Key নেই)';
    }

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    const body = {
      system_instruction: { parts: [{ text: _getSystemPrompt() }] },
      contents: chatHistory,
      generationConfig: { temperature: 0.7, maxOutputTokens: 512, topK: 40, topP: 0.95 }
    };

    let lastError = null;
    let reply = null;

    for (let i = 0; i < keys.length && !reply; i++) {
      const key = keys[i];
      for (const model of GEMINI_MODELS) {
        try {
          reply = await _callGemini(key, model, body);
          if (reply) break;
        } catch (e) {
          lastError = e;
          if (e.isQuota || _isQuotaError(e.message)) {
            console.warn(`[AIAssistant] Key ${i + 1} / ${model} quota — trying next...`);
            continue;
          }
          console.error(`[AIAssistant] Key ${i + 1} / ${model}:`, e.message);
        }
      }
    }

    if (reply) {
      chatHistory.push({ role: 'model', parts: [{ text: reply }] });
      _saveChatHistory(); 

      if (chatHistory.length > MAX_HISTORY_PAIRS * 2) {
        const keepCount = TRIM_TO_PAIRS * 2;
        chatHistory = chatHistory.slice(chatHistory.length - keepCount);
      }
      return reply;
    } else {
      chatHistory.pop();
      const retryLocal = _tryLocalAnswer(userMessage);
      if (retryLocal) {
        _pushLocalReply(userMessage, retryLocal);
        return retryLocal + '\n\n(ℹ️ Gemini API unavailable — Academy ডাটা থেকে উত্তর)';
      }
      if (lastError?.name === 'AbortError') return '⏳ সময় শেষ। ইন্টারনেট ধীর থাকতে পারে। আবার চেষ্টা করুন।';
      if (!navigator.onLine) return '📴 Internet নেই। Academy প্রশ্ন (ছাত্র/বকেয়া) API ছাড়াই চেষ্টা করুন।';
      if (lastError?.isQuota || _isQuotaError(lastError?.message || '')) {
        return _quotaHelpMessage(lastError?.message);
      }
      return `❌ API ত্রুটি: ${lastError?.message || 'Unknown Error'}. Settings → AI Assistant → "Test Key" চাপুন।`;
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
              <div style="font-weight:800;color:#00d4ff;font-size:0.95rem;">Academy Assistant</div>
              <div style="font-size:0.7rem;color:#00ff88;">● Local — API লাগে না</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="AIAssistant.clearChat()" title="Clear" style="background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.75rem;">🗑️</button>
            <button onclick="AIAssistant.closeChat()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
          </div>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages">
          <div class="ai-msg ai-msg-bot">
            <span>👋 Academy Assistant — আপনার ডাটা থেকে সরাসরি উত্তর (API লাগে না)।<br><small style="opacity:0.6">মোট ছাত্র, বকেয়া, আদায়, আজকের লেনদেন, নাম/ID দিয়ে খুঁজুন — "help" লিখলে তালিকা দেখাবে।</small></span>
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

  function promptApiKey(slotNumber = 1) {
    const slotKey = slotNumber === 1 ? 'wfa_gemini_key' : `wfa_gemini_key_${slotNumber}`;
    const slotLabel = slotNumber === 1 ? 'Primary' : `Backup ${slotNumber - 1}`;
    const key = prompt(
      `Google Gemini API Key দিন (${slotLabel}):\n` +
      `পান: https://aistudio.google.com/app/apikey\n\n` +
      `⚠️ একাধিক key থাকলে limit শেষ হলে auto-switch হবে।`
    );
    if (key?.trim()) {
      const trimmed = key.trim();
      if (typeof SecureStorage !== 'undefined') {
        SecureStorage.setItem(slotKey, trimmed).catch(() => {});
      } else {
        localStorage.setItem(slotKey, trimmed);
      }
      document.getElementById('ai-key-warning')?.style.setProperty('display', 'none');
      if (typeof Utils !== 'undefined') {
        Utils.toast(`✅ API Key (${slotLabel}) saved! আরো key যোগ করতে পারেন (slot 2-5)।`, 'success');
      }
    }
  }

  // Add a 2nd/3rd backup key for auto-rotation
  function addBackupKey() {
    // Find next empty slot
    let nextSlot = 2;
    for (let i = 2; i <= 5; i++) {
      if (!localStorage.getItem(`wfa_gemini_key_${i}`)) { nextSlot = i; break; }
    }
    promptApiKey(nextSlot);
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
      btn.innerHTML = '<i class="fa fa-robot"></i> AI';
      btn.style.cssText = `
        background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,212,255,0.15));
        border: 1px solid rgba(168,85,247,0.3);
        border-radius: 8px; padding: 6px 12px;
        color: #00ff88; font-size: 0.9rem; font-weight: 700; cursor: pointer;
        display: flex; gap: 6px; align-items: center;
        box-shadow: 0 0 10px rgba(0,255,136,0.15);
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
      if (_isLocalOnlyMode()) return;
      const existingKeys = await _getApiKeys();
      if (existingKeys && existingKeys.length > 0) {
        document.getElementById('ai-key-warning')?.style.setProperty('display', 'none');
      }
    }, 2000);
    console.log('[AIAssistant] Init complete ✓');
  }

  function setLocalOnlyMode(enabled) {
    localStorage.setItem(LOCAL_ONLY_KEY, enabled ? 'true' : 'false');
  }

  return { init, openChat, closeChat, clearChat, sendMessage, promptApiKey, addBackupKey, chat, testApiKey, setLocalOnlyMode, isLocalOnlyMode: _isLocalOnlyMode };
})();

// Auto-init
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AIAssistant.init());
else AIAssistant.init();
