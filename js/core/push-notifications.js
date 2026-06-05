// ============================================================
// Push Notifications Module — Firebase Cloud Messaging (FCM)
// Wings Fly Aviation Academy
// ============================================================

const PushNotificationModule = (() => {
  let fcmToken = null;
  let isInitialized = false;

  // ── Initialize push notifications ──
  async function init() {
    if (isInitialized) return;
    
    try {
      // Try Capacitor Push Notifications first (Android/iOS)
      if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.PushNotifications) {
        console.log('[Push] Initializing Capacitor Push Notifications...');
        await initCapacitorPush();
        isInitialized = true;
        return;
      }
    } catch (e) {
      console.warn('[Push] Capacitor not available:', e.message);
    }

    // Fallback: Web Push API
    try {
      if ('serviceWorker' in navigator && 'Notification' in window) {
        if (window.__WFA_DEV__) console.log('[Push] Initializing Web Push API...');
        await initWebPush();
        isInitialized = true;
        return;
      }
    } catch (e) {
      console.warn('[Push] Web Push not available:', e.message);
    }

    if (window.__WFA_DEV__) console.info('[Push] No push service (browser — use Android app for notifications)');
  }

  // ── Capacitor Push (Android/iOS) ──
  async function initCapacitorPush() {
    const { PushNotifications } = Capacitor.Plugins;

    // Request permissions
    const permResult = await PushNotifications.requestPermissions();
    console.log('[Push] Permissions:', permResult);

    if (permResult.receive !== 'granted') {
      console.warn('[Push] Notification permission not granted');
      if (typeof Utils !== 'undefined') {
        Utils.toast('নোটিফিকেশন অনুমতি দেওয়ার জন্য সেটিংস চেক করুন', 'info');
      }
      return;
    }

    // Register for push notifications
    await PushNotifications.register();

    // Get registration token
    PushNotifications.addListener('registration', async (token) => {
      fcmToken = token.value;
      console.log('[Push] FCM Token:', fcmToken);
      
      // Save token to Supabase (if authenticated)
      try {
        await saveFCMTokenToDatabase(fcmToken);
      } catch (e) {
        console.warn('[Push] Failed to save FCM token:', e.message);
      }
    });

    // Handle registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
      if (typeof Utils !== 'undefined') {
        Utils.toast('নোটিফিকেশন সেটআপ ব্যর্থ হয়েছে', 'error');
      }
    });

    // Handle received notification
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received:', notification);
      showNotificationUI(notification);
    });

    // Handle notification action (when tapped)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped:', action);
      handleNotificationAction(action.notification);
    });
  }

  // ── Web Push API (Fallback) ──
  async function initWebPush() {
    // ✅ Bug #7 Fix: VAPID key config placeholder.
    // To enable Web Push on browsers:
    //   1. Generate VAPID keys: npx web-push generate-vapid-keys
    //   2. Replace the empty string below with your Base64 public key.
    //   3. Configure the private key on your backend/Supabase Edge Function.
    const VAPID_PUBLIC_KEY = ''; // ← paste your VAPID public key here
    // ✅ Bug #7 Fix: Empty VAPID key guard — push subscription will silently skip
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[PushNotifications] VAPID_PUBLIC_KEY is empty — web push disabled. Set a valid VAPID key to enable push notifications.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        if (window.__WFA_DEV__) console.log('[Push] Already subscribed:', existing.endpoint);
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      if (window.__WFA_DEV__) console.log('[Push] Web Push subscription:', subscription);
      // TODO: send subscription to your backend to store for push delivery
    } catch (e) {
      console.warn('[Push] Web Push subscribe failed:', e.message);
    }
  }

  // ── Helper: convert VAPID base64 key to Uint8Array ──
  function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }


  // ── Save FCM token to Supabase ──
  async function saveFCMTokenToDatabase(token) {
    try {
      const _creds  = window.WFA_SUPABASE_SECRETS || {};
      const supaUrl = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ? SUPABASE_URL : (_creds.url || '');
      const supaKey = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) ? SUPABASE_ANON_KEY : (_creds.anonKey || _creds.anon_key || '');
      const userId  = localStorage.getItem('wfa_user_id') || 'anonymous';
      const response = await fetch(`${supaUrl}/rest/v1/fcm_tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supaKey,
          'Authorization': 'Bearer ' + (localStorage.getItem('wfa_session_token') || supaKey)
        },
        body: JSON.stringify({
          user_id: userId,
          fcm_token: token,
          device_model: navigator.userAgent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok && (response.status === 401 || response.status === 404)) {
        if (window.__WFA_DEV__) {
          console.info('[Push] fcm_tokens table unavailable or RLS blocked — token not saved.');
        }
        return;
      }
      if (!response.ok && window.__WFA_DEV__) {
        console.warn('[Push] Failed to save token to database:', response.status);
      }
    } catch (e) {
      if (window.__WFA_DEV__) console.warn('[Push] Error saving token:', e.message);
    }
  }

  // ── Show notification in UI (if app is in foreground) ──
  function showNotificationUI(notification) {
    const notifId = 'push-notif-ui-' + Date.now();
    
    const container = document.createElement('div');
    container.id = notifId;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 99999;
      max-width: 350px;
      animation: slideInDown 0.3s ease-out;
    `;

    const title = notification.title || 'নোটিফিকেশন';
    const body = notification.body || '';

    container.innerHTML = `
      <style>
        @keyframes slideInDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .notif-title { font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
        .notif-body { font-size: 0.9rem; opacity: 0.95; }
        .notif-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.2rem;
          opacity: 0.7;
        }
      </style>
      <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
      <div class="notif-title">${title}</div>
      <div class="notif-body">${body}</div>
    `;

    document.body.appendChild(container);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.getElementById(notifId)) {
        container.remove();
      }
    }, 5000);
  }

  // ── Handle notification tap action ──
  function handleNotificationAction(notification) {
    const action = notification.actionId || notification.data?.action;
    
    switch (action) {
      case 'attendance':
        if (typeof App !== 'undefined') App.navigateTo('attendance');
        break;
      case 'finance':
        if (typeof App !== 'undefined') App.navigateTo('finance');
        break;
      case 'exam':
        if (typeof App !== 'undefined') App.navigateTo('exam');
        break;
      default:
        if (typeof App !== 'undefined') App.showApp(true);
    }
  }

  // ── Get current FCM token ──
  function getToken() {
    return fcmToken;
  }

  // ── Manual notification send (for testing) ──
  // ✅ S-1 Fix: Placeholder endpoint 'your-api.example.com' removed — was never functional.
  // To enable: replace with your real backend/Supabase Edge Function endpoint that
  // accepts { token, title, body } and sends FCM via server-side private key.
  async function sendTestNotification() {
    // No real backend endpoint configured yet — show clear guidance instead of failing silently
    const hasToken = !!fcmToken;
    if (typeof Utils !== 'undefined') {
      if (!hasToken) {
        Utils.toast('⚠️ Push notification endpoint এখনো configure হয়নি । Supabase Edge Function যোগ করুন অথবা FCM ব্যবহার করুন।', 'warning', 6000);
      } else {
        Utils.toast('⚠️ Backend endpoint configure করা নেই — push send করা যাচ্ছে না। js/core/push-notifications.js-এ sendTestNotification() দেখুন।', 'warning', 6000);
      }
    }
    // TODO: Replace this stub with a real backend call:
    // const response = await fetch('https://YOUR-ACTUAL-BACKEND.com/send-notification', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ token: fcmToken, title: 'Test', body: 'Test notification' })
    // });
    console.warn('[Push] sendTestNotification(): No backend endpoint configured. Set a real URL to enable push sending.');
  }

  // ── Auto-initialize on app start ──
  function autoInit() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init,
    getToken,
    sendTestNotification,
    showNotificationUI,
    handleNotificationAction,
    autoInit
  };
})();

// Auto-initialize
PushNotificationModule.autoInit();

// Export
if (typeof window !== 'undefined') {
  window.PushNotificationModule = PushNotificationModule;
}
