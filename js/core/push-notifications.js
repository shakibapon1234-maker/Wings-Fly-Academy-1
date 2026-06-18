// ============================================================
// Push Notifications Module — Web Push (VAPID) + Capacitor FCM
// Wings Fly Aviation Academy
// ============================================================
// STATUS: Web Push backend wired up — `send-push` Supabase Edge Function
// (supabase/functions/send-push) delivers notifications using the VAPID
// private key (server secret, see VAPID_KEYS.md). Subscriptions are stored
// in the `push_subscriptions` table (supabase/push_subscriptions_setup.sql).
// Capacitor/FCM path (Android native) still requires a server component for
// FCM token delivery — see saveFCMTokenToDatabase().
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
    const VAPID_PUBLIC_KEY = 'BNtOuAHb4Bd_FmxeFxrOw_Lst6ZYMKDcJDOYP-KSKbOYA2Q9kw6I9jGkUeS0CapJ0Xy_9WMRu0ciXgvXBcDaRlM'; // VAPID public key — rotated 2026-06-18 (previous key leaked)
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
      await saveWebPushSubscription(subscription);
    } catch (e) {
      console.warn('[Push] Web Push subscribe failed:', e.message);
    }
  }

  // ── Save Web Push subscription to Supabase (push_subscriptions table) ──
  async function saveWebPushSubscription(subscription) {
    try {
      const sbClient = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.client) || window.supabaseClient;
      if (!sbClient) {
        if (window.__WFA_DEV__) console.info('[Push] Supabase client unavailable — subscription not saved (will retry next init).');
        return;
      }

      const json = subscription.toJSON();
      const userRole = localStorage.getItem('wfa_user_role') || null;

      const { error } = await sbClient
        .from('push_subscriptions')
        .upsert({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_role: userRole,
          user_agent: navigator.userAgent,
          last_seen: new Date().toISOString()
        }, { onConflict: 'endpoint' });

      if (error) {
        if (window.__WFA_DEV__) console.warn('[Push] Failed to save subscription:', error.message);
        return;
      }
      if (window.__WFA_DEV__) console.log('[Push] Web Push subscription saved to Supabase.');
    } catch (e) {
      if (window.__WFA_DEV__) console.warn('[Push] Error saving subscription:', e.message);
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
  // Calls the `send-push` Supabase Edge Function, which uses the VAPID
  // private key (server secret) to deliver a real Web Push notification
  // to all subscribers in push_subscriptions.
  async function sendTestNotification(title, body) {
    const sbClient = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.client) || window.supabaseClient;
    if (!sbClient) {
      if (typeof Utils !== 'undefined') {
        Utils.toast('⚠️ Supabase client unavailable — test push পাঠানো যাচ্ছে না।', 'warning', 6000);
      }
      return;
    }

    try {
      const { data, error } = await sbClient.functions.invoke('send-push', {
        body: {
          title: title || 'টেস্ট নোটিফিকেশন',
          body: body || 'এটি একটি টেস্ট পুশ নোটিফিকেশন — Wings Fly Academy',
          url: '/'
        }
      });

      if (error) throw error;

      if (typeof Utils !== 'undefined') {
        const sentCount = data?.sent ?? 0;
        if (sentCount > 0) {
          Utils.toast(`✅ ${sentCount} টি ডিভাইসে নোটিফিকেশন পাঠানো হয়েছে।`, 'success');
        } else {
          Utils.toast('⚠️ কোনো সাবস্ক্রাইবার পাওয়া যায়নি। প্রথমে এই ব্রাউজারে নোটিফিকেশন অনুমতি দিন।', 'warning', 6000);
        }
      }
    } catch (e) {
      console.warn('[Push] sendTestNotification failed:', e.message);
      if (typeof Utils !== 'undefined') {
        Utils.toast('⚠️ Push পাঠাতে ব্যর্থ: ' + e.message, 'error', 6000);
      }
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
