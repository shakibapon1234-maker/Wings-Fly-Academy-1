const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// List of folders and files to copy
const itemsToCopy = [
  'assets',
  'css',
  'js',
  'supabase',
  'admin.html',
  'certificate.html',
  'exam.html',
  'index.html',
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

if (failed > 0) {
  console.error(`\n❌ Build completed WITH ERRORS. Check the log above.`);
  process.exitCode = 1;
} else if (missing > 0) {
  console.warn(`\n⚠️  Build completed with warnings (${missing} missing file(s)).`);
} else {
  console.log(`\n🚀 Build to www/ successful!`);
}

