// ============================================================
// Wings Fly Aviation Academy — Secure Storage Utility
// Bug #21 Fix: LocalStorage Data Exposure — Web Crypto encryption
// Bug #22 Fix: API Key Storage — encrypt wfa_gemini_key
// Bug #6  Fix: IndexedDB fallback — detect private browsing + memory fallback
// ============================================================

const SecureStorage = (() => {
  'use strict';

  // ── Encryption Config ─────────────────────────────────────
  // Keys to encrypt in localStorage (sensitive data only)
  const SENSITIVE_KEYS = [
    'wfa_gemini_key',      // Bug #22: AI API key
    'wfa_supabase_url',
    'wfa_supabase_anon_key',
    'wfa_admin_pattern',   // Pattern lock hash
    'wfa_admin_face_descriptor', // Face ID data
  ];

  // Salt prefix to identify encrypted values
  const ENC_PREFIX = 'wfa_enc::';

  // ── Derive encryption key from device fingerprint ─────────
  async function _getEncKey() {
    try {
      // Use a stable device fingerprint as key material
      const raw = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        navigator.hardwareConcurrency || '4',
        'WFA_SECURE_SALT_v1'
      ].join('|');

      const enc     = new TextEncoder();
      const keyMat  = await crypto.subtle.importKey(
        'raw', enc.encode(raw), { name: 'PBKDF2' }, false, ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('WFA_SALT_2026'), iterations: 1000, hash: 'SHA-256' },
        keyMat,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      return null; // Crypto API unavailable
    }
  }

  // ── Encrypt a string ──────────────────────────────────────
  async function encrypt(plaintext) {
    if (!plaintext) return plaintext;
    try {
      const key = await _getEncKey();
      if (!key) return plaintext; // Fallback: store plain

      const iv   = crypto.getRandomValues(new Uint8Array(12));
      const enc  = new TextEncoder();
      const buf  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));

      // Pack: iv (12 bytes) + ciphertext as base64
      const combined = new Uint8Array(iv.byteLength + buf.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(buf), iv.byteLength);
      return ENC_PREFIX + btoa(String.fromCharCode(...combined));
    } catch (e) {
      console.warn('[SecureStorage] Encrypt failed, storing plain:', e.message);
      return plaintext;
    }
  }

  // ── Decrypt a string ──────────────────────────────────────
  async function decrypt(ciphertext) {
    if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
    try {
      const key     = await _getEncKey();
      if (!key) return ciphertext.slice(ENC_PREFIX.length); // best-effort

      const raw     = atob(ciphertext.slice(ENC_PREFIX.length));
      const bytes   = new Uint8Array([...raw].map(c => c.charCodeAt(0)));
      const iv      = bytes.slice(0, 12);
      const data    = bytes.slice(12);
      const buf     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(buf);
    } catch (e) {
      console.warn('[SecureStorage] Decrypt failed:', e.message);
      return null;
    }
  }

  // ── Secure setItem ────────────────────────────────────────
  async function setItem(key, value) {
    try {
      if (SENSITIVE_KEYS.includes(key)) {
        const encrypted = await encrypt(value);
        localStorage.setItem(key, encrypted);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[SecureStorage] setItem failed:', e.message);
    }
  }

  // ── Secure getItem ────────────────────────────────────────
  async function getItem(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      if (SENSITIVE_KEYS.includes(key) && raw.startsWith(ENC_PREFIX)) {
        return await decrypt(raw);
      }
      return raw;
    } catch (e) {
      console.warn('[SecureStorage] getItem failed:', e.message);
      return null;
    }
  }

  // ── Sync getItem (for non-sensitive keys) ─────────────────
  function getItemSync(key) {
    return localStorage.getItem(key);
  }

  // ── Migrate existing sensitive keys to encrypted ──────────
  async function migrateToEncrypted() {
    for (const key of SENSITIVE_KEYS) {
      const val = localStorage.getItem(key);
      if (val && !val.startsWith(ENC_PREFIX)) {
        // Value exists but not encrypted — encrypt it now
        const encrypted = await encrypt(val);
        if (encrypted !== val) {
          localStorage.setItem(key, encrypted);
          console.info(`[SecureStorage] Encrypted sensitive key: ${key}`);
        }
      }
    }
  }

  // ── Bug #6 Fix: IndexedDB availability detection ──────────
  // Returns true if IndexedDB is available (false in some private modes)
  function isIndexedDBAvailable() {
    if (typeof indexedDB === 'undefined') return false;
    // Additional check: some browsers block IndexedDB in private mode
    try {
      const req = indexedDB.open('__wfa_test__', 1);
      req.onupgradeneeded = () => {
        try { req.result.close(); indexedDB.deleteDatabase('__wfa_test__'); } catch {}
      };
      return true;
    } catch {
      return false;
    }
  }

  // ── Memory-only fallback storage (for private browsing) ───
  const _memoryStore = new Map();

  const memoryStorage = {
    getItem:    (k)    => _memoryStore.get(k) ?? null,
    setItem:    (k, v) => _memoryStore.set(k, v),
    removeItem: (k)    => _memoryStore.delete(k),
    clear:      ()     => _memoryStore.clear(),
    get length()       { return _memoryStore.size; },
    key: (i) => Array.from(_memoryStore.keys())[i] ?? null,
  };

  // ── Safe localStorage wrapper with memory fallback ────────
  let _storageBackend = localStorage;
  let _usingMemory    = false;

  function initStorage() {
    try {
      // Test localStorage write
      const testKey = '__wfa_ls_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      _storageBackend = localStorage;
      _usingMemory    = false;
    } catch {
      // Private browsing or storage blocked — use in-memory
      _storageBackend = memoryStorage;
      _usingMemory    = true;
      console.warn('[SecureStorage] localStorage unavailable — using memory fallback (private mode?)');
      // Show a user-facing warning after app loads
      setTimeout(() => {
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(
            '⚠️ Private/Incognito mode detected. Data will NOT be saved after closing the tab.',
            'warning', 8000
          );
        }
      }, 3000);
    }
  }

  function safeGet(key)        { try { return _storageBackend.getItem(key); }    catch { return null; } }
  function safeSet(key, value) { try { _storageBackend.setItem(key, value); }    catch {} }
  function safeRemove(key)     { try { _storageBackend.removeItem(key); }        catch {} }

  // ── Init ──────────────────────────────────────────────────
  initStorage();
  // Encrypt existing sensitive keys after a short delay
  setTimeout(migrateToEncrypted, 2000);

  return {
    // Async encrypted access (for sensitive keys)
    setItem, getItem,
    // Sync access (for non-sensitive keys, no encryption)
    getItemSync, safeGet, safeSet, safeRemove,
    // Private browsing detection
    isIndexedDBAvailable, isUsingMemory: () => _usingMemory,
    // Raw memory storage (for internal use)
    memoryStorage,
    // Expose encrypt/decrypt for other modules
    encrypt, decrypt,
    ENC_PREFIX, SENSITIVE_KEYS,
  };
})();

window.SecureStorage = SecureStorage;
