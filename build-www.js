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
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

// Clean www folder
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir);

// Copy items
itemsToCopy.forEach(item => {
  const srcItem = path.join(srcDir, item);
  const destItem = path.join(destDir, item);
  if (fs.existsSync(srcItem)) {
    copyRecursiveSync(srcItem, destItem);
    console.log(`Copied ${item}`);
  } else {
    console.warn(`Warning: ${item} not found in root.`);
  }
});

console.log('Build to www/ successful!');
