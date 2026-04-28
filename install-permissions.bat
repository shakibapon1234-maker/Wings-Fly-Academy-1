@echo off
REM Install Capacitor Permissions Plugin for Face ID Camera Access

echo.
echo ==========================================
echo Installing Capacitor Permissions Plugin
echo ==========================================
echo.

call npm install @capacitor/permissions

echo.
echo Syncing with Android...
call npx cap sync android

echo.
echo ✅ Permissions plugin installed!
echo.
echo Next steps:
echo 1. Build APK: npm run build:mobile ^&^& cd android ^&^& gradlew.bat assembleDebug
echo 2. Install on device: adb install -r android\app\build\outputs\apk\debug\app-debug.apk
echo 3. Test Face ID on your Samsung Z Fold 6
echo.
echo ⚠️  If still getting 'Access denied':
echo    - Go to Settings ^> Apps ^> Wings Fly Academy ^> Permissions ^> Camera
echo    - Toggle Camera permission ON
echo    - Try Face ID again
echo.
pause
