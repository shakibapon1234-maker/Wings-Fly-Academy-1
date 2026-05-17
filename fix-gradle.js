const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'node_modules', '@capacitor-community', 'speech-recognition', 'android', 'build.gradle');

try {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace proguard-android.txt with proguard-android-optimize.txt to fix Gradle 8+ build errors
    if (content.includes("getDefaultProguardFile('proguard-android.txt')")) {
      content = content.replace("getDefaultProguardFile('proguard-android.txt')", "getDefaultProguardFile('proguard-android-optimize.txt')");
      fs.writeFileSync(file, content, 'utf8');
      console.log('✅ Patched speech-recognition build.gradle for modern Android Gradle Plugin compatibility');
    }
  }
} catch (e) {
  console.warn('⚠️ Could not patch speech-recognition build.gradle:', e.message);
}
