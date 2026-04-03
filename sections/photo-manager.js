// ====================================
// WINGS FLY AVIATION ACADEMY
// PHOTO MANAGER — IndexedDB Photo Storage, Upload, Delete
// Extracted from app.js (Phase 6)
// ====================================

function initPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        db.createObjectStore(PHOTO_STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

let selectedStudentPhotoFile = null;

function handleStudentPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    selectedStudentPhotoFile = null;
    return;
  }
  if (!file.type.startsWith('image/')) {
    showErrorToast('❌ Invalid image format');
    return;
  }
  selectedStudentPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('photoPreview').src = e.target.result;
    document.getElementById('photoPreviewContainer').style.display = 'block';
    document.getElementById('photoUploadInput').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removeStudentPhoto() {
  selectedStudentPhotoFile = null;
  document.getElementById('studentPhotoInput').value = '';
  document.getElementById('photoPreviewContainer').style.display = 'none';
  document.getElementById('photoUploadInput').style.display = 'block';
  document.getElementById('studentPhotoURL').value = '';
}

async function uploadStudentPhoto(studentId, file) {
  // ✅ FIX: base64 return করো (key নয়) — যাতে img src সরাসরি কাজ করে
  // এতে: cloud sync এ photo যাবে, multi-device এ দেখা যাবে, ERR_FILE_NOT_FOUND বন্ধ
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalBase64 = e.target.result;

      // ✅ Photo resize: max 400px, quality 0.75 → ~30-50KB
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.75);

        // IndexedDB তেও backup রাখো (backward compatibility)
        const photoKey = `photo_${studentId}`;
        initPhotoDB().then(db => {
          const tx = db.transaction([PHOTO_STORE_NAME], 'readwrite');
          tx.objectStore(PHOTO_STORE_NAME).put(resizedBase64, photoKey);
        }).catch(() => { });

        console.log(`✅ Photo processed: ${Math.round(resizedBase64.length / 1024)}KB`);
        resolve(resizedBase64); // ✅ base64 return করো, key নয়
      };
      img.onerror = () => resolve(originalBase64); // resize fail হলে original
      img.src = originalBase64;
    };
    reader.onerror = () => reject('File read error');
    reader.readAsDataURL(file);
  });
}

async function deleteStudentPhoto(photoKey) {
  if (!photoKey) return;
  const db = await initPhotoDB();
  const transaction = db.transaction([PHOTO_STORE_NAME], 'readwrite');
  transaction.objectStore(PHOTO_STORE_NAME).delete(photoKey);
}

function getStudentPhotoSrc(photoKey, imgElementId = null) {
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%2300d9ff" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="80" fill="%23ffffff"%3E👤%3C/text%3E%3C/svg%3E';

  if (!photoKey) return placeholder;

  // ✅ NEW FORMAT: base64 সরাসরি থাকলে সেটাই return করো
  if (photoKey.startsWith('data:image')) {
    if (imgElementId) {
      const img = document.getElementById(imgElementId);
      if (img) { img.src = photoKey; img.style.objectFit = 'cover'; }
    }
    return photoKey;
  }

  // ✅ OLD KEY FORMAT (photo_WF-xxxxx): IndexedDB থেকে load + auto-migrate
  initPhotoDB().then(db => {
    const transaction = db.transaction([PHOTO_STORE_NAME], 'readonly');
    const request = transaction.objectStore(PHOTO_STORE_NAME).get(photoKey);
    request.onsuccess = () => {
      if (request.result) {
        if (imgElementId) {
          const img = document.getElementById(imgElementId);
          if (img) { img.src = request.result; img.style.objectFit = 'cover'; }
        }
        // ✅ MIGRATE: student.photo কে base64 এ update করো (একবারই হবে)
        const students = window.globalData && window.globalData.students;
        if (students) {
          const s = students.find(st => st.photo === photoKey);
          if (s) {
            s.photo = request.result;
            localStorage.setItem('wingsfly_data', JSON.stringify(window.globalData));
            if (typeof window.scheduleSyncPush === 'function') {
              window.scheduleSyncPush('Photo key→base64 migration');
            }
            console.log('✅ Photo migrated to base64:', photoKey);
          }
        }
      }
    };
  }).catch(err => console.warn('Photo load error:', err));

  return placeholder;
}
// Make functions globally available
window.uploadStudentPhoto = uploadStudentPhoto;
window.deleteStudentPhoto = deleteStudentPhoto;
window.getStudentPhotoSrc = getStudentPhotoSrc;
window.handleStudentPhotoSelect = handleStudentPhotoSelect;
window.removeStudentPhoto = removeStudentPhoto;
window.uploadStudentPhoto = uploadStudentPhoto;
window.deleteStudentPhoto = deleteStudentPhoto;


