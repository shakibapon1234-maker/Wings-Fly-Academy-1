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
        console.log('[Push] Initializing Web Push API...');
        await initWebPush();
        isInitialized = true;
        return;
      }
    } catch (e) {
      console.warn('[Push] Web Push not available:', e.message);
    }

    console.warn('[Push] No push notification service available');
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
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      console.log('[Push] Notification permission:', permission);
    }

    // Register service worker for web push
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('service-worker.js');
        console.log('[Push] Service Worker registered for push');
      } catch (e) {
        console.warn('[Push] Service Worker registration failed:', e);
      }
    }
  }

  // ── Save FCM token to Supabase ──
  async function saveFCMTokenToDatabase(token) {
    try {
      const userId = localStorage.getItem('wfa_user_id') || 'anonymous';
      const response = await fetch('https://your-supabase-url.supabase.co/rest/v1/fcm_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'your-supabase-anon-key',
          'Authorization': 'Bearer ' + (localStorage.getItem('wfa_session_token') || '')
        },
        body: JSON.stringify({
          user_id: userId,
          fcm_token: token,
          device_model: navigator.userAgent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.warn('[Push] Failed to save token to database:', response.status);
      }
    } catch (e) {
      console.error('[Push] Error saving token:', e);
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
  async function sendTestNotification() {
    try {
      const response = await fetch('https://your-api.example.com/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          title: 'Test Notification',
          body: 'This is a test notification from Wings Fly Academy'
        })
      });

      console.log('[Push] Test notification sent');
      if (typeof Utils !== 'undefined') {
        Utils.toast('টেস্ট নোটিফিকেশন পাঠানো হয়েছে', 'success');
      }
    } catch (e) {
      console.error('[Push] Failed to send test:', e);
    }
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
