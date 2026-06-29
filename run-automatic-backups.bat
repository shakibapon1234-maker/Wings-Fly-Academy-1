@echo off
title WFA Automatic Backups Launcher
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "run-automatic-backups.ps1"
pause
