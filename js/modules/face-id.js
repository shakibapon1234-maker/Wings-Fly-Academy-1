// ============================================================
// Wings Fly Aviation Academy — Face ID Module
// Fixed bugs:
// - Duplicate 'play' event listener on re-open (memory leak)
// - Interval now tracked and cleared properly on modal close
// ============================================================

const FaceIDModule = (() => {
  let isModelsLoaded    = false;
  let isLibraryLoading  = false;
  const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
  const MODEL_URL    = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
  let videoStream       = null;
  let detectionInterval = null;
  let playListenerAttached = false;

  // ✅ Fix: Lazy load face-api library — শুধু প্রথম use এর সময় ~900KB download হবে।
  // Page load এ কোনো impact নেই।
  function _loadLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof faceapi !== 'undefined') { resolve(); return; }
      if (isLibraryLoading) {
        // already loading — poll until ready
        const poll = setInterval(() => {
          if (typeof faceapi !== 'undefined') { clearInterval(poll); resolve(); }
        }, 200);
        return;
      }
      isLibraryLoading = true;
      if (typeof Utils !== 'undefined') Utils.toast('Face ID library loading… (first use only)', 'info', 4000);
      const script = document.createElement('script');
      script.src = FACE_API_CDN;
      script.onload  = () => { isLibraryLoading = false; resolve(); };
      script.onerror = () => { isLibraryLoading = false; reject(new Error('face-api CDN load failed')); };
      document.head.appendChild(script);
    });
  }

  async function loadModels() {
    if (isModelsLoaded) return true;
    // ✅ Lazy: library আগে load করো, তারপর models
    try {
      await _loadLibrary();
    } catch (e) {
      console.error('[FaceID] Library load failed:', e);
      if (typeof Utils !== 'undefined') Utils.toast('Face ID library could not load. Check internet.', 'error');
      return false;
    }
    if (typeof faceapi === 'undefined') {
      console.error('[FaceID] face-api.js library not available after load');
      return false;
    }
    if (typeof Utils !== 'undefined') Utils.toast('Loading Face ID models… (~2MB, first time only)', 'info');
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      isModelsLoaded = true;
      return true;
    } catch (error) {
      console.error('[FaceID] Model load failed:', error);
      if (typeof Utils !== 'undefined') Utils.toast('Face ID models failed to load. Check internet.', 'error');
      return false;
    }
  }

  async function openScannerModal(mode = 'login') {
    const modelsReady = await loadModels();
    if (!modelsReady) return;

    const modalId = 'face-id-modal';
    let m = document.getElementById(modalId);
    if (!m) {
      m = document.createElement('div');
      m.id = modalId;
      m.className = 'modal-backdrop open';
      m.style.zIndex = '99999';
      m.innerHTML = `
        <div class="modal-box" style="max-width:400px;text-align:center">
          <div class="modal-header">
            <span class="modal-title bn">📷 Face ID Scanner</span>
            <button class="btn-close" onclick="FaceIDModule.closeScannerModal()">✕</button>
          </div>
          <div style="padding:20px;position:relative">
            <div id="face-id-status" style="margin-bottom:15px;font-size:0.9rem;color:#00ff88;font-weight:bold;">Initializing camera...</div>
            <div style="position:relative;width:100%;max-width:320px;margin:0 auto;border-radius:15px;overflow:hidden;border:2px solid var(--brand-primary);box-shadow:0 0 20px rgba(0,212,255,0.4)">
              <video id="face-id-video" width="320" height="240" autoplay muted playsinline style="background:#000;display:block"></video>
              <canvas id="face-id-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%"></canvas>
            </div>
            <button class="btn btn-primary" onclick="FaceIDModule.closeScannerModal()" style="margin-top:20px;width:100%">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(m);
      playListenerAttached = false; // reset on fresh create
    } else {
      m.classList.add('open');
      playListenerAttached = false; // allow re-attach after re-open
    }

    // Reset status text
    const statusEl = document.getElementById('face-id-status');
    if (statusEl) { statusEl.innerText = 'Initializing camera...'; statusEl.style.color = '#00ff88'; }

    // Stop any existing stream first
    _stopStream();

    const video = document.getElementById('face-id-video');
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = videoStream;
    } catch (err) {
      if (statusEl) { statusEl.innerText = 'Camera access denied or unavailable.'; statusEl.style.color = '#ff6b7a'; }
      console.error('[FaceID] Camera error:', err);
      return;
    }

    // FIX: only attach 'play' listener once per open
    if (!playListenerAttached) {
      playListenerAttached = true;
      video.addEventListener('play', () => _startDetection(mode, video), { once: true });
    }
  }

  function _startDetection(mode, video) {
    // FIX: clear any existing interval first
    if (detectionInterval) clearInterval(detectionInterval);

    const m = document.getElementById('face-id-modal');
    const canvas = document.getElementById('face-id-canvas');
    const statusEl = document.getElementById('face-id-status');
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    if (statusEl) statusEl.innerText = 'Looking for face… Please hold still.';

    detectionInterval = setInterval(async () => {
      // FIX: stop interval if modal is closed or video stopped
      if (!m || !m.classList.contains('open') || video.paused || video.ended) {
        clearInterval(detectionInterval);
        detectionInterval = null;
        return;
      }

      const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

      if (detection) {
        const resized = faceapi.resizeResults(detection, displaySize);
        faceapi.draw.drawDetections(canvas, resized);

        if (statusEl) { statusEl.innerText = 'Face detected! Processing…'; statusEl.style.color = '#ffaa00'; }

        clearInterval(detectionInterval);
        detectionInterval = null;

        setTimeout(() => handleDetectionResult(mode, detection.descriptor), 800);
      }
    }, 500);
  }

  function handleDetectionResult(mode, descriptor) {
    const statusEl = document.getElementById('face-id-status');
    if (mode === 'register') {
      localStorage.setItem('wfa_admin_face_descriptor', JSON.stringify(Array.from(descriptor)));
      if (statusEl) { statusEl.innerText = 'Face registered successfully!'; statusEl.style.color = '#00ff88'; }
      if (typeof Utils !== 'undefined') Utils.toast('Face ID saved! You can now use it on the login page.', 'success');
      setTimeout(() => closeScannerModal(), 1500);
    }
    else if (mode === 'login') {
      const savedStr = localStorage.getItem('wfa_admin_face_descriptor');
      if (!savedStr) {
        if (statusEl) { statusEl.innerText = 'No Face ID registered!'; statusEl.style.color = '#ff6b7a'; }
        setTimeout(() => closeScannerModal(), 2000);
        return;
      }
      const savedFloat32 = new Float32Array(JSON.parse(savedStr));
      const distance = faceapi.euclideanDistance(descriptor, savedFloat32);
      console.log('[FaceID] Distance:', distance);

      if (distance < 0.55) {
        if (statusEl) { statusEl.innerText = 'Match found! Logging in…'; statusEl.style.color = '#00ff88'; }
        setTimeout(() => { closeScannerModal(); triggerLoginSuccess(); }, 1000);
      } else {
        if (statusEl) { statusEl.innerText = 'Face did not match. Try again.'; statusEl.style.color = '#ff6b7a'; }
        // FIX: give user a retry button instead of auto-closing
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-sm btn-outline';
        retryBtn.style.marginTop = '10px';
        retryBtn.textContent = 'Try Again';
        retryBtn.onclick = () => { retryBtn.remove(); openScannerModal('login'); };
        statusEl.parentNode.insertBefore(retryBtn, statusEl.nextSibling);
      }
    }
  }

  function _stopStream() {
    if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
  }

  function closeScannerModal() {
    const m = document.getElementById('face-id-modal');
    if (m) m.classList.remove('open');
    _stopStream(); // FIX: always stop camera cleanly
  }

  function triggerLoginSuccess() {
    if (typeof App !== 'undefined') {
      localStorage.setItem('wfa_logged_in', 'true');
      localStorage.setItem('wfa_user_role', 'admin');
      localStorage.setItem('wfa_user_name', 'admin');
      localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
      App.showApp(true);
      if (typeof Utils !== 'undefined') Utils.toast('Logged in via Face ID ✅', 'success');
    }
  }

  function isFaceIdRegistered() {
    return !!localStorage.getItem('wfa_admin_face_descriptor');
  }

  return { openScannerModal, closeScannerModal, isFaceIdRegistered };
})();

window.FaceIDModule = FaceIDModule;
