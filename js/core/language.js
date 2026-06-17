// ============================================================
// Wings Fly Aviation Academy — Language Management & Localization
// ============================================================

const WfaLanguage = (() => {
  'use strict';

  let translationRegex = null;

  function getLang() {
    try {
      return localStorage.getItem('wfa_language') || 'default';
    } catch {
      return 'default';
    }
  }

  function initRegex() {
    if (translationRegex) return;
    if (typeof window.WFA_TRANSLATIONS_EN === 'undefined') return;
    
    const keys = Object.keys(window.WFA_TRANSLATIONS_EN);
    const escapedKeys = keys.map(k => k.replace(new RegExp('[-/\\\\^$*+?.()|[\\]{}]', 'g'), '\\$&'));
    translationRegex = new RegExp(escapedKeys.join('|'), 'g');
  }

  function translateText(text) {
    if (!text || typeof text !== 'string') return text;
    if (!/[\u0980-\u09FF]/.test(text)) return text;
    if (typeof window.WFA_TRANSLATIONS_EN === 'undefined') return text;

    const trimmed = text.trim();
    // 1. Try exact match lookup (fastest)
    if (window.WFA_TRANSLATIONS_EN[trimmed]) {
      return window.WFA_TRANSLATIONS_EN[trimmed];
    }

    // 2. Substring matching using alternation regex
    initRegex();
    if (!translationRegex) return text;
    
    return text.replace(translationRegex, (matched) => {
      return window.WFA_TRANSLATIONS_EN[matched] || matched;
    });
  }

  function translateNode(node) {
    if (!node) return;

    // 1. Text node
    if (node.nodeType === Node.TEXT_NODE) {
      const orig = node.nodeValue;
      if (orig && /[\u0980-\u09FF]/.test(orig)) {
        const translated = translateText(orig);
        if (translated !== orig) {
          node.nodeValue = translated;
        }
      }
      return;
    }

    // 2. Element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      // Skip script, style, and iframe tags
      if (tag === 'script' || tag === 'style' || tag === 'iframe') return;

      // Translate inputs / textareas
      if (tag === 'input' || tag === 'textarea') {
        const type = node.getAttribute('type');
        if (type === 'button' || type === 'submit') {
          const val = node.value;
          if (val && /[\u0980-\u09FF]/.test(val)) {
            node.value = translateText(val);
          }
        }
        const placeholder = node.getAttribute('placeholder');
        if (placeholder && /[\u0980-\u09FF]/.test(placeholder)) {
          node.setAttribute('placeholder', translateText(placeholder));
        }
      }

      // Translate attributes
      const title = node.getAttribute('title');
      if (title && /[\u0980-\u09FF]/.test(title)) {
        node.setAttribute('title', translateText(title));
      }
      const alt = node.getAttribute('alt');
      if (alt && /[\u0980-\u09FF]/.test(alt)) {
        node.setAttribute('alt', translateText(alt));
      }

      // Recursively translate child nodes
      let child = node.firstChild;
      while (child) {
        translateNode(child);
        child = child.nextSibling;
      }
    }
  }

  let observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      // Temporarily disconnect to avoid loops
      observer.disconnect();

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const addedNode of mutation.addedNodes) {
            translateNode(addedNode);
          }
        } else if (mutation.type === 'characterData') {
          const node = mutation.target;
          const orig = node.nodeValue;
          if (orig && /[\u0980-\u09FF]/.test(orig)) {
            const translated = translateText(orig);
            if (translated !== orig) {
              node.nodeValue = translated;
            }
          }
        }
      }

      // Reconnect
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function init() {
    const lang = getLang();
    if (lang === 'en') {
      // Apply translation to existing elements on DOM load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          translateNode(document.body);
          startObserver();
        });
      } else {
        translateNode(document.body);
        startObserver();
      }
    }
  }

  return {
    getLang,
    translateText,
    translateDOM: translateNode,
    init
  };
})();

// Auto-initialize on import
WfaLanguage.init();

// Export to window
window.WfaLanguage = WfaLanguage;
