#!/bin/bash
# Quick build script for Wings Fly Academy Android app

echo ""
echo "========================================"
echo "Wings Fly Academy - Android Build Script"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Run this script from project root."
    exit 1
fi

# Step 1: Build web assets
echo "[1/4] Building web assets..."
npm run build:mobile
if [ $? -ne 0 ]; then
    echo "Error: Web asset build failed"
    exit 1
fi
echo "✓ Web assets built successfully"

# Step 2: Verify Android directory
echo "[2/4] Verifying Android setup..."
if [ ! -f "android/gradlew" ]; then
    echo "Error: android/gradlew not found"
    exit 1
fi
echo "✓ Android directory verified"

# Step 3: Build Android
echo "[3/4] Building Android APK..."
cd android
chmod +x gradlew
./gradlew clean build
if [ $? -ne 0 ]; then
    echo "Error: Android build failed"
    cd ..
    exit 1
fi
echo "✓ Android build completed"

# Step 4: Show build outputs
echo "[4/4] Build complete!"
echo ""
echo "========================================"
echo "Build Outputs:"
echo "- Debug APK: app/build/outputs/apk/debug/app-debug.apk"
echo "- Release APK: app/build/outputs/apk/release/app-release.apk"
echo "========================================"
echo ""
cd ..

echo ""
echo "Next steps:"
echo "1. Connect your Android device via USB"
echo "2. Enable USB Debugging on the device"
echo "3. Run: adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
