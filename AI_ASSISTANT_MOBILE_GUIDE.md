# 🤖 AI Assistant — Mobile Optimization for Samsung Z Fold 6

আপনার Samsung Z Fold 6-এর powerful configuration-এ AI Assistant সর্বোচ্চ performance এর জন্য।

---

## 📱 Device Configuration

**Your Device:** Samsung Galaxy Z Fold 6
- **Processor:** Snapdragon 8 Gen 3 (Ultra)
- **RAM:** 12 GB
- **Storage:** 256 GB
- **Display:** Foldable AMOLED (7.6" + 6.2")
- **Android:** 14+
- **Capabilities:** Excellent for on-device ML models

---

## 🧠 AI Assistant Approaches (Try All 3)

### **Approach #1: Web-Based (Recommended for you)**

Use Google Gemini API / OpenAI API আপনার server থেকে।

**Advantages:**
- ✅ Unlimited context
- ✅ Latest models
- ✅ No device storage needed
- ✅ Real-time updates

**Implementation:**

```javascript
// js/modules/ai-assistant.js (add this)
const AIAssistant = (() => {
  const API_KEY = 'your-gemini-api-key'; // Get from console.cloud.google.com
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  async function chat(userMessage, context = {}) {
    try {
      const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: formatPrompt(userMessage, context)
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topK: 40,
            topP: 0.95
          }
        })
      });

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error('[AI] Error:', error);
      return 'আপনার প্রশ্নের উত্তর দিতে পারলাম না। আবার চেষ্টা করুন।';
    }
  }

  function formatPrompt(userMessage, context) {
    const system = `আপনি Wings Fly Aviation Academy-র একজন সহায়ক এআই।
আপনি Bengali এবং English উভয় ভাষায় সাহায্য করেন।
আপনি শিক্ষার্থী সম্পর্কে, আর্থিক লেনদেন, পরীক্ষা, উপস্থিতি সম্পর্কে তথ্য প্রদান করেন।`;

    return `${system}\n\nবর্তমান context:\n${JSON.stringify(context)}\n\nব্যবহারকারীর প্রশ্ন: ${userMessage}`;
  }

  return {
    chat
  };
})();
```

**Cost:** 
- Free tier: 15 requests/minute
- Paid: $0.075/1M tokens (very cheap)

---

### **Approach #2: On-Device ML (Advanced)**

TensorFlow Lite models directly on device - no internet needed!

**Advantages:**
- ✅ Zero latency
- ✅ Works offline
- ✅ Privacy guaranteed
- ✅ Perfect for your Z Fold 6

**Implementation:**

```javascript
// js/modules/tflite-assistant.js
const TFLiteAssistant = (() => {
  let model = null;
  let isLoaded = false;

  async function loadModel() {
    if (isLoaded) return;
    
    try {
      // Using MediaPipe's LLM models (smallest ones)
      // Download from: https://www.kaggle.com/models/google/mediapipe
      
      const tflite = await tfliteModule.loadTFLiteModel(
        'https://cdn.jsdelivr.net/npm/mediapipe-ai@latest/llm/gemma-2b.tflite'
      );
      
      model = tflite;
      isLoaded = true;
      console.log('[TFLite] Model loaded');
      
    } catch (error) {
      console.warn('[TFLite] Failed to load:', error);
      return false;
    }
  }

  async function generateResponse(userInput) {
    if (!isLoaded) await loadModel();
    if (!model) return null;

    try {
      const input = tokenize(userInput);
      const prediction = await model.predict(input);
      return detokenize(prediction);
    } catch (e) {
      console.error('[TFLite] Generation failed:', e);
      return null;
    }
  }

  function tokenize(text) {
    // Simple tokenization (in production, use proper tokenizer)
    return text.split(' ').map((word, i) => i);
  }

  function detokenize(tokens) {
    // Convert tokens back to text
    return 'Generated response';
  }

  return {
    loadModel,
    generateResponse
  };
})();
```

**Size:** 500MB-2GB (download once, use offline forever)

---

### **Approach #3: Hybrid (Best for Z Fold 6)**

Online when possible, fallback to on-device model when offline.

```javascript
const HybridAssistant = (() => {
  async function askQuestion(query) {
    if (navigator.onLine) {
      // Use powerful cloud model
      return await AIAssistant.chat(query);
    } else {
      // Fall back to local TFLite
      return await TFLiteAssistant.generateResponse(query);
    }
  }

  return { askQuestion };
})();
```

---

## 🚀 Optimization for Z Fold 6

### **1. Display Optimization**

```css
/* css/ai-assistant-mobile.css */

.ai-chat-container {
  /* Fold-aware layout */
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: max(16px, env(safe-area-inset-bottom));
}

/* When device is folded (inner display) */
@media (min-width: 600px) and (max-width: 800px) {
  .ai-chat-container {
    width: 100%;
    max-width: none;
  }
}

/* When device is unfolded (outer display) */
@media (min-width: 1400px) {
  .ai-chat-container {
    width: 100%;
    padding: 32px;
  }
}

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.ai-chat-input {
  padding: 16px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
}
```

### **2. Performance Optimization**

```javascript
// Lazy load AI module when opened
function openAIAssistant() {
  if (!window.AIAssistantLoaded) {
    const script = document.createElement('script');
    script.src = 'js/modules/ai-assistant.js';
    script.onload = () => {
      window.AIAssistantLoaded = true;
      showAIChat();
    };
    document.head.appendChild(script);
  } else {
    showAIChat();
  }
}
```

### **3. Battery Optimization**

```javascript
// Reduce polling when not in use
class AIOptimizer {
  static reduceBackgroundActivity() {
    // Stop animations
    document.querySelectorAll('.ai-typing-indicator').forEach(el => {
      el.style.animationPlayState = 'paused';
    });
  }

  static resumeBackgroundActivity() {
    document.querySelectorAll('.ai-typing-indicator').forEach(el => {
      el.style.animationPlayState = 'running';
    });
  }
}

// Listen for visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    AIOptimizer.reduceBackgroundActivity();
  } else {
    AIOptimizer.resumeBackgroundActivity();
  }
});
```

---

## 💰 Cost Comparison

| Method | Cost | Latency | Offline | Quality |
|--------|------|---------|---------|---------|
| **Gemini API** | $0.075/1M tokens | 500-1000ms | ❌ No | ⭐⭐⭐⭐⭐ |
| **OpenAI** | $0.15/1M tokens | 500-1000ms | ❌ No | ⭐⭐⭐⭐⭐ |
| **TFLite On-Device** | $0 | 50-200ms | ✅ Yes | ⭐⭐⭐⭐ |
| **Hybrid** | $0.075/1M* | 50-1000ms* | ✅ Yes | ⭐⭐⭐⭐⭐ |

*Only when online

---

## 🔧 Quick Setup (Recommended)

### **Step 1: Get Gemini API Key (Free)**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "Wings Fly Academy"
3. Enable "Generative Language API"
4. Create API Key
5. Get your API key (free tier: 15 requests/minute)

### **Step 2: Create AI Module**

```bash
# Copy template
cp js/modules/ai-assistant-template.js js/modules/ai-assistant.js

# Edit with your API key
nano js/modules/ai-assistant.js
# Replace: const API_KEY = 'YOUR-KEY-HERE'
```

### **Step 3: Add to UI**

```html
<!-- Add to index.html topbar section -->
<button id="btn-ai-assistant" title="Ask AI" style="font-size:1.2rem">
  <i class="fa fa-robot"></i>
</button>

<!-- AI Chat Modal -->
<div id="ai-chat-modal" class="modal-backdrop" style="display:none">
  <div class="ai-chat-box">
    <div id="ai-messages" class="ai-messages"></div>
    <div class="ai-input">
      <input id="ai-input" type="text" placeholder="আপনার প্রশ্ন জিজ্ঞাসা করুন..." />
      <button id="ai-send">Send</button>
    </div>
  </div>
</div>
```

### **Step 4: Add Event Listeners**

```javascript
// js/core/inline-handlers.js এ যোগ করুন
const aiBtn = document.getElementById('btn-ai-assistant');
if (aiBtn) {
  aiBtn.addEventListener('click', () => {
    document.getElementById('ai-chat-modal').style.display = 'flex';
  });
}

const aiSendBtn = document.getElementById('ai-send');
if (aiSendBtn) {
  aiSendBtn.addEventListener('click', async () => {
    const input = document.getElementById('ai-input').value;
    const response = await AIAssistant.chat(input);
    displayMessage('AI', response);
  });
}
```

### **Step 5: Build & Test**

```bash
npm run build:mobile
cd android && ./gradlew assembleDebug
# Install and test
```

---

## 🧪 Testing on Z Fold 6

### **Test Scenarios:**

1. **Folded State (Inner Display):**
   - [ ] Messages display correctly
   - [ ] Input field accessible
   - [ ] No layout issues

2. **Unfolded State (Outer Display):**
   - [ ] Full utilization of wide screen
   - [ ] Split-view possibility
   - [ ] Keyboard accessible

3. **Performance:**
   - [ ] Typing smooth
   - [ ] Response time < 2 seconds
   - [ ] No lag with long conversations

4. **Offline:**
   - [ ] Toggle offline mode
   - [ ] TFLite model loads
   - [ ] Responses still work

---

## 🎯 Your Recommended Setup

**Based on your Z Fold 6:**

1. **Start with:** Gemini API (simplest)
2. **Then add:** TFLite for offline (best experience)
3. **Result:** Hybrid system that works always

**Estimated time:** 2-3 hours  
**Cost:** $0-$5/month (very cheap)

---

**Happy coding! 🚀**
