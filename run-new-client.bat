@echo off
title Wings Fly Academy - Client Deployer
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "new-client.ps1"
pause

