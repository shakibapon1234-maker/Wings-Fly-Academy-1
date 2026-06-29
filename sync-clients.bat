@echo off
title WFA Client Sync Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "sync-clients.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Error occurred while launching the PowerShell script.
    echo.
)
pause
