// ============================================================
// WINGS FLY AVIATION ACADEMY
// garbled-text-fix.js — হিজিবিজি লেখা প্রতিরোধ
// ============================================================
// সমস্যা: কোনো section lazy-load হওয়ার সময় যদি JS function
// না পাওয়া যায়, তাহলে raw code বা placeholder text দেখায়।
// এই fix: সব section container গুলো প্রথমে hidden রাখে,
// content fully render হলে দেখায়।
// ============================================================

(function () {
  'use strict';

  // ── 1. Settings section এবং analytics container গুলো
  //       render complete হওয়ার আগে flash দেখাবে না ────────
  var PROTECTED_IDS = [
    'settingsSection',
    'accountAnalyticsContainer',
    'accountAnalyticsModal',
    'analyticsContainer',
    '__modalPlaceholderSettings',
    '__modalPlaceholderOther'
  ];

  // যদি কোনো element এর textContent এ raw JS code এর মতো
  // কিছু থাকে সেটা clear করো
  var GARBLED_PATTERNS = [
    /window\._show[A-Za-z]+Impl\s*=/,
    /Implementation Wrapper/,
    /var raw = localStorage\.getItem/,
    /\.forEach\(function\(f\)\s*\{/,
    /console\.log\('\[Analytics\]/,
    /window\.globalData\s*=\s*Object\.assign/
  ];

  function clearGarbledText(el) {
    if (!el) return;
    var text = el.textContent || '';
    var isGarbled = GARBLED_PATTERNS.some(function (p) { return p.test(text); });
    if (isGarbled) {
      // শুধু text node গুলো check করো, child elements রাখো
      el.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          var t = node.textContent || '';
          if (GARBLED_PATTERNS.some(function (p) { return p.test(t); })) {
            node.textContent = '';
          }
        }
      });
    }
  }

  // ── 2. MutationObserver দিয়ে garbled text detect করো ───────
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          var text = node.textContent || '';
          var isGarbled = GARBLED_PATTERNS.some(function (p) { return p.test(text); });
          if (isGarbled && node.parentElement) {
            // parent hide করো এবং soon দেখাও
            var parent = node.parentElement;
            var orig = parent.style.visibility;
            parent.style.visibility = 'hidden';
            setTimeout(function () {
              node.textContent = '';
              parent.style.visibility = orig || '';
            }, 50);
          }
        }
      });
    });
  });

  // DOM ready হলে observe শুরু করো
  function startObserver() {
    var targets = PROTECTED_IDS.map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);

    // fallback: dashboardSection এর মধ্যে settings area
    var dashSection = document.getElementById('dashboardSection');
    if (dashSection) targets.push(dashSection);

    targets.forEach(function (el) {
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // ── 3. switchSettingsTab wrap করো — sub-tab switch এও
  //       scroll top এ যাবে ─────────────────────────────────
  var _origSwitchSettingsTab = null;

  function patchSwitchSettingsTab() {
    if (typeof window.switchSettingsTab !== 'function') return;
    if (window.switchSettingsTab._scrollPatched) return;

    _origSwitchSettingsTab = window.switchSettingsTab;
    window.switchSettingsTab = function (tabName) {
      // settings এর sub-tab switch এও scroll to top
      try {
        var mainContent = document.getElementById('mainContent')
          || document.querySelector('.main-content')
          || document.querySelector('.content-area')
          || document.querySelector('main');
        if (mainContent) mainContent.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });

        // ✅ FIX: Settings modal content area scroll to top
        var settingsContent = document.querySelector('#settingsModal .flex-grow-1.overflow-auto');
        if (settingsContent) settingsContent.scrollTop = 0;
      } catch (e) { /* ignore */ }

      return _origSwitchSettingsTab.apply(this, arguments);
    };
    window.switchSettingsTab._scrollPatched = true;
    console.log('✅ garbled-text-fix: switchSettingsTab patched (scroll to top)');
  }

  // switchSettingsTab load হওয়ার পর patch করো
  setTimeout(patchSwitchSettingsTab, 800);
  setTimeout(patchSwitchSettingsTab, 2000); // retry

  // ── 4. Tab switch এ settings section এর garbled text clean ─
  // ✅ FIX: monkey-patch বাদ — এখন event-based hook ব্যবহার করো
  // switchTab কে আর wrap না করে, tab switch event listen করো
  function onTabSwitch(tabName) {
    if (tabName === 'settings' || tabName === 'accounts') {
      setTimeout(function () {
        PROTECTED_IDS.forEach(function (id) {
          clearGarbledText(document.getElementById(id));
        });
      }, 200);
    }
  }

  // ✅ Register as a hook instead of monkey-patching
  function registerGarbledHook() {
    if (!window._wfSwitchTabHooks) window._wfSwitchTabHooks = [];
    // Don't register twice
    if (window._wfSwitchTabHooks._garbledRegistered) return;
    window._wfSwitchTabHooks.push(onTabSwitch);
    window._wfSwitchTabHooks._garbledRegistered = true;
    console.log('✅ garbled-text-fix: switchTab hook registered (garbled cleanup)');
  }

  setTimeout(registerGarbledHook, 1500);
  setTimeout(registerGarbledHook, 3000); // retry

  console.log('✅ garbled-text-fix.js loaded');

})();
