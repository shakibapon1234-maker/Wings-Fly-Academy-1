@echo off
setlocal
title Wings Fly Academy - Test Runner
cd /d "%~dp0"

REM -- Check if npx is available
where npx >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: npx command not found!
    echo  Node.js install or PATH setup needed.
    echo.
    pause
    exit /b 1
)

:menu
cls
echo.
echo  ========================================================
echo.
echo    Wings Fly Aviation Academy - Test Runner
echo.
echo  ========================================================
echo.
echo    [1]  Run All Tests
echo.
echo    [2]  Watch Mode (auto-run on file change)
echo.
echo    [3]  Exit
echo.
echo  ========================================================
echo.
set /p "choice=  Select option (1/2/3): "

if "%choice%"=="1" goto run_once
if "%choice%"=="2" goto watch
if "%choice%"=="3" goto bye

echo.
echo   Invalid option. Please enter 1, 2 or 3.
timeout /t 2 >nul
goto menu

:run_once
cls
echo.
echo  ========================================================
echo   Running all tests...
echo  ========================================================
echo.
call npx vitest run
echo.
echo  ========================================================
echo   Tests complete!
echo  ========================================================
echo.
echo  Press any key to go back to menu...
pause >nul
goto menu

:watch
cls
echo.
echo  ========================================================
echo   Starting Watch Mode...
echo   Tests will auto-run when files change.
echo   Press Ctrl+C to stop.
echo  ========================================================
echo.
call npx vitest
echo.
echo  Press any key to go back to menu...
pause >nul
goto menu

:bye
exit /b 0
