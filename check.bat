@echo off
:: ═══════════════════════════════════════════════════════════
::  Wings Fly Academy — Regression Guard
::  নতুন কিছু যোগ বা edit করার পরে এই command run করুন:
::
::      check
::
::  সব সবুজ = নিরাপদ।  কোনো লাল = সেটা আগে ঠিক করুন।
:: ═══════════════════════════════════════════════════════════

setlocal enabledelayedexpansion
set PASS=0
set FAIL=0

echo.
echo ══════════════════════════════════════════
echo   Wings Fly Academy — Regression Guard
echo ══════════════════════════════════════════
echo.

:: ── STEP 1: Unit Tests ──────────────────────────────────
echo [1/2] Unit Tests চালাচ্ছি...
echo.

node node_modules\vitest\vitest.mjs run --reporter=verbose 2>&1
if %ERRORLEVEL% EQU 0 (
  echo.
  echo   [PASS] সব Tests পাশ হয়েছে ✓
  set /a PASS+=1
) else (
  echo.
  echo   [FAIL] কিছু Test ফেল হয়েছে — উপরের লাল লাইনগুলো দেখুন
  set /a FAIL+=1
)

echo.
echo ──────────────────────────────────────────
echo.

:: ── STEP 2: ESLint ──────────────────────────────────────
echo [2/2] ESLint চালাচ্ছি...
echo.

node node_modules\eslint\bin\eslint.js js/core/ js/ui/ js/modules/ 2>&1
if %ERRORLEVEL% EQU 0 (
  echo.
  echo   [PASS] ESLint — কোনো Error নেই ✓
  set /a PASS+=1
) else (
  echo.
  echo   [FAIL] ESLint Error পাওয়া গেছে — উপরের লাইনগুলো দেখুন
  set /a FAIL+=1
)

echo.
echo ══════════════════════════════════════════

if %FAIL% EQU 0 (
  echo   ✅  সব ঠিক আছে! নিরাপদে deploy করতে পারবেন।
) else (
  echo   ❌  %FAIL%টি সমস্যা পাওয়া গেছে।
  echo   AI-কে বলুন: "check চালালাম, এই error পেলাম: [error copy করুন]"
)

echo ══════════════════════════════════════════
echo.
endlocal
