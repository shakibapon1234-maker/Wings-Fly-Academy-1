@echo off
REM Quick build script for Wings Fly Academy Android app

echo.
echo ========================================
echo Wings Fly Academy - Android Build Script
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: package.json not found. Run this script from project root.
    exit /b 1
)

REM Step 1: Build web assets
echo [1/4] Building web assets...
call npm run build:mobile
if %errorlevel% neq 0 (
    echo Error: Web asset build failed
    exit /b 1
)
echo ✓ Web assets built successfully

REM Step 2: Verify Android directory
echo [2/4] Verifying Android setup...
if not exist "android\gradlew.bat" (
    echo Error: android\gradlew.bat not found
    exit /b 1
)
echo ✓ Android directory verified

REM Step 3: Build Android
echo [3/4] Building Android APK...
cd android
call gradlew.bat clean build
if %errorlevel% neq 0 (
    echo Error: Android build failed
    cd ..
    exit /b 1
)
echo ✓ Android build completed

REM Step 4: Show build outputs
echo [4/4] Build complete!
echo.
echo ========================================
echo Build Outputs:
echo - Debug APK: app\build\outputs\apk\debug\app-debug.apk
echo - Release APK: app\build\outputs\apk\release\app-release.apk
echo ========================================
echo.
cd ..

echo.
echo Next steps:
echo 1. Connect your Android device via USB
echo 2. Enable USB Debugging on the device
echo 3. Run: adb install android\app\build\outputs\apk\debug\app-debug.apk
echo.
