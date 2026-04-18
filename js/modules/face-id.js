// ============================================================
// Wings Fly Aviation Academy — Face ID Module
// Uses @vladmandic/face-api
// ============================================================

const FaceIDModule = (() => {
  let isModelsLoaded = false;
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
  let videoStream = null;

  async function loadModels() {
    if (isModelsLoaded) return true;
    if (typeof faceapi === 'undefined') {
      console.error('face-api.js library not loaded');
      return false;
    }
    
    if (typeof Utils !== 'undefined') Utils.toast('Loading Face ID models...', 'info');
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      isModelsLoaded = true;
      return true;
    } catch (error) {
      console.error('Failed to load face-api models', error);
      if (typeof Utils !== 'undefined') Utils.toast('Failed to load Face ID AI models. Check internet connection.', 'error');
      return false;
    }
  }

  // General function to open video modal for a specific purpose ('register' or 'login')
  async function openScannerModal(mode = 'login') {
    const modelsReady = await loadModels();
    if (!modelsReady) return;

    // Create Modal UI
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
            <div style="position:relative;width:100%;max-width:320px;margin:0 auto;border-radius:15px;overflow:hidden;border:2px solid var(--brand-primary);box-shadow:0 0 20px var(--brand-glow)">
              <video id="face-id-video" width="320" height="240" autoplay muted playsinline style="background:#000;display:block"></video>
              <canvas id="face-id-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%"></canvas>
            </div>
            <button class="btn btn-primary" onclick="FaceIDModule.closeScannerModal()" style="margin-top:20px;width:100%">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(m);
    } else {
      m.classList.add('open');
      document.getElementById('face-id-status').innerText = 'Initializing camera...';
      document.getElementById('face-id-status').style.color = '#00ff88';
    }

    const video = document.getElementById('face-id-video');
    
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = videoStream;
    } catch (err) {
      document.getElementById('face-id-status').innerText = 'Camera access denied or unvailable.';
      document.getElementById('face-id-status').style.color = '#ff6b7a';
      console.error(err);
      return;
    }

    // Handle Detection
    video.addEventListener('play', () => {
      const canvas = document.getElementById('face-id-canvas');
      const displaySize = { width: video.width, height: video.height };
      faceapi.matchDimensions(canvas, displaySize);

      document.getElementById('face-id-status').innerText = 'Looking for face... Please hold still.';

      const interval = setInterval(async () => {
        if (!m.classList.contains('open') || video.paused) {
          clearInterval(interval);
          return;
        }

        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        
        // Clear canvas
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          faceapi.draw.drawDetections(canvas, resizedDetection);
          // faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

          document.getElementById('face-id-status').innerText = 'Face detected! Processing...';
          document.getElementById('face-id-status').style.color = '#ffaa00';

          clearInterval(interval);
          
          // Small delay for UX
          setTimeout(() => {
            handleDetectionResult(mode, detection.descriptor);
          }, 800);
        }
      }, 500);
    });
  }

  function handleDetectionResult(mode, descriptor) {
    if (mode === 'register') {
      const arr = Array.from(descriptor);
      localStorage.setItem('wfa_admin_face_descriptor', JSON.stringify(arr));
      document.getElementById('face-id-status').innerText = 'Face registered successfully!';
      document.getElementById('face-id-status').style.color = '#00ff88';
      if (typeof Utils !== 'undefined') Utils.toast('Face ID saved!', 'success');
      
      setTimeout(() => closeScannerModal(), 1500);
    } 
    else if (mode === 'login') {
      const savedStr = localStorage.getItem('wfa_admin_face_descriptor');
      if (!savedStr) {
        document.getElementById('face-id-status').innerText = 'No Face ID registered!';
        document.getElementById('face-id-status').style.color = '#ff6b7a';
        setTimeout(() => closeScannerModal(), 2000);
        return;
      }
      const savedArr = JSON.parse(savedStr);
      const savedFloat32 = new Float32Array(savedArr);

      // Compare Euclidean distance
      const distance = faceapi.euclideanDistance(descriptor, savedFloat32);
      console.log('Face match distance:', distance);
      
      if (distance < 0.55) { // Threshold for recognition. Lower = stricter.
        document.getElementById('face-id-status').innerText = 'Match found! Logging in...';
        document.getElementById('face-id-status').style.color = '#00ff88';
        
        setTimeout(() => {
          closeScannerModal();
          triggerLoginSuccess();
        }, 1000);
      } else {
        document.getElementById('face-id-status').innerText = 'Face did not match!';
        document.getElementById('face-id-status').style.color = '#ff6b7a';
        setTimeout(() => closeScannerModal(), 2000);
      }
    }
  }

  function closeScannerModal() {
    const m = document.getElementById('face-id-modal');
    if (m) m.classList.remove('open');
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
  }

  function triggerLoginSuccess() {
    if (typeof App !== 'undefined') {
      localStorage.setItem('wfa_logged_in', 'true');
      localStorage.setItem('wfa_user_role', 'admin');
      localStorage.setItem('wfa_user_name', 'admin');
      localStorage.setItem('wfa_user_permissions', JSON.stringify(['*']));
      
      // Attempt to load settings and proceed
      App.showApp(true);
      if (typeof Utils !== 'undefined') Utils.toast('Logged in via Face ID', 'success');
    }
  }

  function isFaceIdRegistered() {
    return !!localStorage.getItem('wfa_admin_face_descriptor');
  }

  return { openScannerModal, closeScannerModal, isFaceIdRegistered };
})();

window.FaceIDModule = FaceIDModule;
