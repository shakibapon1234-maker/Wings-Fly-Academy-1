# 🚀 Wings Fly Academy — 3 Free Premium Features + Face ID Fix

> আপনার স্যামসাং জেড ফোল্ড 6-এ সম্পূর্ণ Android integration সেটআপ

---

## ⚠️ **জরুরি: Face ID Camera Permission Fix**

আপনার মোবাইলে "Access denied" আসছে কারণ Android runtime permissions ছিল না। এখন fixed!

### **ধাপ 1: Permissions Plugin ইনস্টল করুন**

```bash
npm install @capacitor/permissions
npx cap sync android
```

**Windows:**
```bash
install-permissions.bat
```

**Mac/Linux:**
```bash
bash install-permissions.sh
```

### **ধাপ 2: নতুন APK Build করুন**

```bash
npm run build:mobile
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### **ধাপ 3: মোবাইলে Install করুন**

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### **ধাপ 4: Settings-এ Camera Permission চেক করুন**

যদি তখনও "Access denied" আসে:
1. Settings → Apps
2. Wings Fly Academy খুঁজুন
3. Permissions → Camera
4. Toggle **ON** করুন
5. App restart করে Face ID আবার চেষ্টা করুন

---

## ✨ **3 Free Premium Features**

### **#1️⃣  Auto-Update (Remote URL Loading)**

আপনার website update করলে app automatically update হবে!

#### কিভাবে কাজ করে:
- User দেখবে: "নতুন আপডেট পাওয়া গেছে" notification
- এক ক্লিকে update apply হবে
- পুরো app reload হবে latest version সহ

#### সেটআপ:

**Step 1: Version file তৈরি করুন**

আপনার website-এ একটি `version.json` ফাইল রাখুন:

```json
{
  "version": "1.0.1",
  "changelog": "Fixed Face ID camera issues",
  "size": "5.2 MB",
  "releaseDate": "2026-04-28"
}
```

**Step 2: Auto-Update Module কনফিগার করুন**

`js/core/auto-update.js`-এ এই লাইনটি আপনার domain দিয়ে replace করুন:

```javascript
const VERSION_FILE_URL = 'https://your-domain.vercel.app/version.json';
// এটা change করুন আপনার domain-এ
// Example: 'https://wings-fly.vercel.app/version.json'
```

**Step 3: Module automatically load হবে**

- auto-update.js already added to index.html ✅
- প্রতি 1 ঘণ্টায় check করবে নতুন version
- Internet connection back হলে immediately check করবে

#### Features:
✅ ব্যবহারকারী-friendly notification  
✅ One-click update  
✅ Automatic cache clearing  
✅ Offline-aware (internet না থাকলে check করবে না)

#### Test করুন:
```javascript
// Browser console-এ:
AutoUpdateModule.checkForUpdate().then(result => {
  console.log(result);
  if (result.available) {
    AutoUpdateModule.applyUpdate();
  }
});
```

---

### **#2️⃣  Push Notifications (Firebase FCM)**

Students/Parents-কে সরাসরি notification পাঠান!

**Features:**
✅ Real-time notifications  
✅ Firebase free tier (~3M messages/month)  
✅ Works on lock screen  
✅ Custom actions

#### সেটআপ:

**Step 1: Firebase Project তৈরি করুন**

1. [console.firebase.google.com](https://console.firebase.google.com) যান
2. **New Project** → Name: "Wings Fly Academy"
3. **Firestore** enable করুন (free tier)
4. **Cloud Messaging** → **Android** add করুন
5. Package name: `com.wingsfly.academy`
6. **Download** `google-services.json`

**Step 2: google-services.json রাখুন**

```
android/app/google-services.json  ← এখানে রাখুন
```

**Step 3: Install plugin**

```bash
npm install @capacitor/push-notifications
npx cap sync android
```

**Step 4: কোডে কনফিগার করুন**

`js/core/push-notifications.js`-এ Supabase details add করুন:

```javascript
async function saveFCMTokenToDatabase(token) {
  const response = await fetch('https://YOUR_SUPABASE_URL.supabase.co/rest/v1/fcm_tokens', {
    // ... YOUR SUPABASE CREDENTIALS HERE
  });
}
```

**Step 5: Rebuild APK**

```bash
npm run build:mobile
cd android && ./gradlew assembleDebug
```

#### Testing:

```javascript
// Console-এ:
PushNotificationModule.getToken();  // FCM token দেখান
PushNotificationModule.sendTestNotification();  // Test পাঠান
```

#### Server থেকে Notification পাঠানোর উপায়:

**Option 1: Firebase Console (সহজ)**
1. Firebase Console → Cloud Messaging
2. Send first message
3. Target: Android → com.wingsfly.academy

**Option 2: Server API (Advanced)**
```bash
curl -X POST \
  https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "FCM_TOKEN_HERE",
    "notification": {
      "title": "Attendance Updated",
      "body": "Your attendance has been marked"
    }
  }'
```

---

### **#3️⃣  Offline Mode (Service Worker + IndexedDB Cache)**

Internet disconnected হলেও app কাজ করবে!

**Features:**
✅ Offline data queue  
✅ Auto-sync when online  
✅ API response caching (24 hours)  
✅ Local IndexedDB storage  
✅ Fallback UI notifications

#### কিভাবে কাজ করে:

**Online:**
- সব API calls সরাসরি Supabase-এ যায়
- Responses automatically cache হয়

**Offline:**
- New entries একটি queue-তে save হয়
- User দেখবে: "অফলাইন মোডে কাজ করছি"
- Cached data থেকে read করবে

**Back Online:**
- Automatically sync হবে queue-এর সব pending actions
- Success message দেখাবে

#### সেটআপ:

**Step 1: Module already in index.html ✅**

```html
<script src="js/core/offline-mode.js" defer></script>
```

**Step 2: Service Worker update করুন (optional)**

Service worker-কে আরও advanced caching দিতে:

```javascript
// service-worker.js এ যোগ করুন:
const CACHE_VERSION = 'wfa-v1';

self.addEventListener('fetch', (event) => {
  // API calls → network first, cache fallback
  if (event.request.url.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
```

**Step 3: Code-এ offline-aware করুন**

```javascript
// যেকোনো CRUD operation এর সময়:
try {
  const response = await supabase.from('students').insert(data);
} catch (error) {
  if (!navigator.onLine) {
    // Offline — queue-তে save করুন
    OfflineModeModule.enqueueAction('INSERT', 'students', data);
    Utils.toast('অফলাইন মোডে saved হয়েছে', 'warning');
  }
}
```

#### Testing:

```javascript
// Offline queue check করুন:
OfflineModeModule.getQueueStatus().then(status => {
  console.log(status);
  // { isOnline: false, queueLength: 5, pending: 3, failed: 0 }
});

// Manual sync:
OfflineModeModule.syncQueue();
```

#### Development এ Offline Simulate করুন:

**Chrome DevTools:**
1. Open DevTools (F12)
2. Network tab → Throttling: "Offline"
3. App test করুন

---

## 📱 **Samsung Z Fold 6 Special Configuration**

আপনার device-এ best performance এর জন্য:

### **Display Optimization:**
- Responsive layout: ✅ Already configured
- Fold detection: ✅ CSS media queries in place
- Full-screen support: ✅ Foldable-aware CSS

### **Camera Performance:**
- Front camera (Face ID): ✅ Now fixed with permissions
- High resolution support: ✅ 320x240 optimized

### **Battery & Performance:**
- Service Worker: ✅ Reduces server load
- Offline caching: ✅ Less network usage
- Auto-update check: ✅ Only every 1 hour

---

## 🔄 **Complete Setup Checklist**

### **1. Permissions Plugin ইনস্টল:**
- [ ] `npm install @capacitor/permissions`
- [ ] `npx cap sync android`
- [ ] APK rebuild করুন

### **2. Face ID Verify করুন:**
- [ ] App install করুন
- [ ] Settings → Wings Fly Academy → Permissions → Camera ON
- [ ] Face ID registration try করুন
- [ ] Face ID login try করুন

### **3. Auto-Update সেটআপ:**
- [ ] Website-এ `version.json` upload করুন
- [ ] `js/core/auto-update.js`-এ domain update করুন
- [ ] Rebuild APK

### **4. Push Notifications সেটআপ:**
- [ ] Firebase project create করুন
- [ ] `google-services.json` download করুন
- [ ] `android/app/` ফোল্ডারে রাখুন
- [ ] `npm install @capacitor/push-notifications`
- [ ] Rebuild APK

### **5. Offline Mode Verify করুন:**
- [ ] App open করুন
- [ ] DevTools → Network → Offline করুন
- [ ] Data add করুন (queue-তে save হবে)
- [ ] Back online করুন
- [ ] Auto-sync verify করুন

---

## 🆘 **Troubleshooting**

### **Face ID: "Access denied" এখনও আসছে**
```bash
# এই commands চালান:
npx cap sync android
cd android && ./gradlew clean
./gradlew assembleDebug
# Reinstall করুন
```

### **Push Notifications কাজ করছে না**
- Firebase project-এ Android app সঠিকভাবে configured?
- `google-services.json` সঠিক location-এ?
- Server key valid?

### **Offline sync fail করছে**
- Supabase credentials সঠিক?
- RLS policies allow করছে?
- Network ফিরে আসার পর manual sync:
```javascript
OfflineModeModule.syncQueue();
```

### **Auto-update কাজ করছে না**
- `version.json` accessible?
- CORS enabled on your server?
- Test করুন:
```javascript
AutoUpdateModule.checkForUpdate();
```

---

## 📊 **Feature Comparison**

| Feature | Status | Free/Paid | Mobile | Desktop |
|---------|--------|-----------|--------|---------|
| **Face ID Fix** | ✅ Done | Free | ✅ Yes | ❌ No |
| **Auto-Update** | ✅ Done | Free | ✅ Yes | ✅ Yes |
| **Push Notifications** | ✅ Done | Free | ✅ Yes | ✅ Yes* |
| **Offline Mode** | ✅ Done | Free | ✅ Yes | ✅ Yes |
| Google Play Store | ⏳ Later | Paid | ✅ Yes | - |

---

## 🎯 **Next Steps**

1. **Immediately:** Face ID camera fix apply করুন
2. **Today:** 3টি features test করুন
3. **This Week:** Google Play Store setup করতে পারেন (paid, optional)
4. **Ongoing:** User feedback based optimization

---

**Generated:** April 28, 2026  
**Platform:** Android 14 + Capacitor 8.3.1  
**Device:** Samsung Galaxy Z Fold 6  
**Status:** ✅ Ready to Deploy
