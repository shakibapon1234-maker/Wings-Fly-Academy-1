const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// ⚠️  IMPORTANT: Android assets are managed via 'npm run build:mobile' (node build-www.js + npx cap sync)
// Do NOT manually edit files in android/app/src/main/assets/public/
// Manual edits will be overwritten on the next 'npm run build:mobile' run.
// All changes must be made in root js/, css/, or HTML files, then run build:mobile.

// List of folders and files to copy
const itemsToCopy = [
  'assets',
  'css',
  'js',
  // 'supabase' intentionally excluded — SQL migrations/edge functions should not be bundled into the Android app
  'admin.html',
  'certificate.html',
  'exam.html',
  'index.html',
  'idb-cleaner.html',
  'migrate.html',
  'visitor-form.html',
  'manifest.json',
  'service-worker.js'
];

function copyRecursiveSync(src, dest) {
  try {
    const exists = fs.existsSync(src);
    if (!exists) {
      console.warn(`⚠️  Source not found, skipping: ${src}`);
      return false;
    }
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach(function(childItemName) {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
    return true;
  } catch (e) {
    console.error(`❌ Copy failed: ${src} → ${dest}\n   Reason: ${e.message}`);
    return false;
  }
}

// Clean www folder
try {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
    console.log('🗑️  Cleaned existing www/ folder');
  }
  fs.mkdirSync(destDir);
  console.log('📁 Created www/ folder\n');
} catch (e) {
  console.error(`❌ Failed to prepare www/ directory: ${e.message}`);
  process.exit(1);
}

// Auto-sync DEPLOY_ID from version.json to service-worker.js
// Also auto-sync LOCAL_VERSION_FALLBACK in auto-update.js
try {
  const versionPath = path.join(srcDir, 'version.json');
  const swPath = path.join(srcDir, 'service-worker.js');
  const autoUpdatePath = path.join(srcDir, 'js', 'core', 'auto-update.js');
  if (fs.existsSync(versionPath)) {
    const vData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const newVersion = vData.version;
    const newDeployId = vData.deploy_id;

    // Sync DEPLOY_ID in service-worker.js
    if (newDeployId && fs.existsSync(swPath)) {
      let swContent = fs.readFileSync(swPath, 'utf8');
      swContent = swContent.replace(/const DEPLOY_ID = '.*';/, `const DEPLOY_ID = '${newDeployId}';`);
      fs.writeFileSync(swPath, swContent, 'utf8');
      console.log(`🔄 Auto-synced SW DEPLOY_ID to: ${newDeployId}`);
    }

    // Sync LOCAL_VERSION_FALLBACK in auto-update.js
    if (newVersion && fs.existsSync(autoUpdatePath)) {
      let auContent = fs.readFileSync(autoUpdatePath, 'utf8');
      auContent = auContent.replace(
        /const LOCAL_VERSION_FALLBACK = '[^']+';/,
        `const LOCAL_VERSION_FALLBACK = '${newVersion}';`
      );
      fs.writeFileSync(autoUpdatePath, auContent, 'utf8');
      console.log(`🔄 Auto-synced LOCAL_VERSION_FALLBACK to: ${newVersion}`);
    }
  }
} catch (e) {
  console.warn(`⚠️  Auto-sync version failed: ${e.message}`);
}

// Copy items
let copied = 0;
let failed = 0;
let missing = 0;

itemsToCopy.forEach(item => {
  const srcItem  = path.join(srcDir, item);
  const destItem = path.join(destDir, item);
  try {
    if (fs.existsSync(srcItem)) {
      const ok = copyRecursiveSync(srcItem, destItem);
      if (ok) { console.log(`✅ Copied: ${item}`); copied++; }
      else     { failed++; }
    } else {
      console.warn(`⚠️  Missing: ${item} (not found in source)`);
      missing++;
    }
  } catch (e) {
    console.error(`❌ Error copying ${item}: ${e.message}`);
    failed++;
  }
});

// Build summary
console.log('\n' + '═'.repeat(50));
console.log(`📦 Build Summary:`);
console.log(`   ✅ Copied  : ${copied} item(s)`);
console.log(`   ⚠️  Missing : ${missing} item(s)`);
console.log(`   ❌ Failed  : ${failed} item(s)`);
console.log('═'.repeat(50));

// ── C1 Security Fix: Remove live credentials from build output ──────────────
// supabase-secrets.js contains real URL + anonKey. It must NEVER ship in the
// www/ bundle (APK / ZIP). Only the .stub.js (safe placeholder) is kept.
const secretsInBuild = path.join(destDir, 'js', 'core', 'supabase-secrets.js');
try {
  if (fs.existsSync(secretsInBuild)) {
    fs.rmSync(secretsInBuild);
    console.log('🔒 Removed js/core/supabase-secrets.js from build (credentials must not ship)');
  }
} catch (e) {
  console.error(`❌ Failed to remove supabase-secrets.js from build: ${e.message}`);
}

if (failed > 0) {
  console.error(`\n❌ Build completed WITH ERRORS. Check the log above.`);
  process.exitCode = 1;
} else if (missing > 0) {
  console.warn(`\n⚠️  Build completed with warnings (${missing} missing file(s)).`);
} else {
  console.log(`\n🚀 Build to www/ successful! (credentials stripped ✅)`);
}

