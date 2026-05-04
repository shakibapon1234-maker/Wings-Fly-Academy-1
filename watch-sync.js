/**
 * ============================================================
 *  Wings Fly Academy — Auto Sync Watcher
 * ============================================================
 *  এই স্ক্রিপ্ট source ফাইল পরিবর্তন হলে অটোমেটিক্যালি
 *  www/ ফোল্ডারে কপি করে এবং Android assets-এ sync করে।
 *
 *  ব্যবহার:  npm run watch
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ── Config ──────────────────────────────────────────────────
const ROOT = __dirname;

// যেসব ফোল্ডার/ফাইল watch করবে
const WATCH_TARGETS = [
  { path: path.join(ROOT, 'js'),       type: 'dir'  },
  { path: path.join(ROOT, 'css'),      type: 'dir'  },
  { path: path.join(ROOT, 'assets'),   type: 'dir'  },
  { path: path.join(ROOT, 'supabase'), type: 'dir'  },
];

// Root-level ফাইলগুলো যেগুলো watch করবে
const WATCH_FILES_PATTERN = /\.(html|js|json|css)$/;

// Debounce: পরপর অনেক পরিবর্তন হলে একবারই build হবে
const DEBOUNCE_MS = 1500;

// ── State ───────────────────────────────────────────────────
let debounceTimer = null;
let isBuilding = false;
let pendingBuild = false;
let buildCount = 0;

// ── Helpers ─────────────────────────────────────────────────
function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: true });
}

function clearLine() {
  process.stdout.write('\r\x1b[K');
}

function log(icon, msg) {
  clearLine();
  console.log(`  ${icon}  ${msg}`);
}

// ── Build Function ──────────────────────────────────────────
function runBuild(trigger) {
  if (isBuilding) {
    pendingBuild = true;
    return;
  }

  isBuilding = true;
  buildCount++;
  const buildNum = buildCount;

  log('🔄', `\x1b[33mBuild #${buildNum} শুরু হচ্ছে...\x1b[0m (trigger: ${trigger})`);

  exec('npm run build:mobile', { cwd: ROOT }, (error, stdout, stderr) => {
    isBuilding = false;

    if (error) {
      log('❌', `\x1b[31mBuild #${buildNum} ব্যর্থ!\x1b[0m`);
      console.error(stderr || error.message);
    } else {
      log('✅', `\x1b[32mBuild #${buildNum} সফল!\x1b[0m — ${timestamp()}`);
    }

    // যদি build চলাকালীন আরো পরিবর্তন হয়ে থাকে
    if (pendingBuild) {
      pendingBuild = false;
      log('📋', 'আরো পরিবর্তন পাওয়া গেছে, আবার build হচ্ছে...');
      runBuild('queued changes');
    }
  });
}

// ── Debounced Trigger ───────────────────────────────────────
function scheduleBuild(changedFile) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runBuild(changedFile);
  }, DEBOUNCE_MS);

  clearLine();
  process.stdout.write(`  ⏳  পরিবর্তন ধরা পড়েছে: ${changedFile} — ${DEBOUNCE_MS}ms পর build হবে...`);
}

// ── Should Ignore? ──────────────────────────────────────────
function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // Ignore www/, node_modules/, android/, .git/, build outputs
  if (normalized.includes('node_modules/')) return true;
  if (normalized.includes('/www/'))         return true;
  if (normalized.includes('/android/'))     return true;
  if (normalized.includes('/.git/'))        return true;
  if (normalized.includes('/.idea/'))       return true;
  if (normalized.includes('/.vscode/'))     return true;
  return false;
}

// ── Watch Directories ───────────────────────────────────────
function watchDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    log('⚠️', `ফোল্ডার পাওয়া যায়নি: ${path.relative(ROOT, dirPath)}`);
    return;
  }

  fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(dirPath, filename);
    if (shouldIgnore(fullPath)) return;
    scheduleBuild(path.relative(ROOT, fullPath));
  });

  log('👁️', `Watching: \x1b[36m${path.relative(ROOT, dirPath)}/\x1b[0m`);
}

// ── Watch Root Files ────────────────────────────────────────
function watchRootFiles() {
  fs.watch(ROOT, (eventType, filename) => {
    if (!filename) return;
    if (!WATCH_FILES_PATTERN.test(filename)) return;
    // Only root-level files, not subdirectories' files
    const fullPath = path.join(ROOT, filename);
    if (shouldIgnore(fullPath)) return;

    // Make sure it's actually a file in the root (not a dir event)
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        scheduleBuild(filename);
      }
    } catch (e) {
      // File might have been deleted, still trigger build
      scheduleBuild(filename);
    }
  });

  log('👁️', `Watching: \x1b[36mRoot ফাইল (*.html, *.js, *.json, *.css)\x1b[0m`);
}

// ── Start ───────────────────────────────────────────────────
console.log('');
console.log('  ╔══════════════════════════════════════════════════╗');
console.log('  ║     🛩️  Wings Fly Academy — Auto Sync Watcher    ║');
console.log('  ╠══════════════════════════════════════════════════╣');
console.log('  ║  কোড পরিবর্তন হলে অটো www/ ও Android sync হবে  ║');
console.log('  ║  বন্ধ করতে: Ctrl+C                              ║');
console.log('  ╚══════════════════════════════════════════════════╝');
console.log('');

// Watch subdirectories
WATCH_TARGETS.forEach(target => {
  watchDirectory(target.path);
});

// Watch root-level files
watchRootFiles();

console.log('');
log('🟢', '\x1b[32mWatcher চালু আছে! কোড পরিবর্তন করুন, অটো sync হবে।\x1b[0m');
console.log('');
