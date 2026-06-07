#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Wings Fly Academy — Regression Guard
#  নতুন কিছু যোগ বা edit করার পরে এই command run করুন:
#
#      bash check.sh
#
#  সব সবুজ = নিরাপদ।  কোনো লাল = সেটা আগে ঠিক করুন।
# ═══════════════════════════════════════════════════════════

PASS=0
FAIL=0

echo ""
echo "══════════════════════════════════════════"
echo "  Wings Fly Academy — Regression Guard"
echo "══════════════════════════════════════════"
echo ""

# ── STEP 1: Unit Tests ──────────────────────────────────
echo "[1/2] Unit Tests চালাচ্ছি..."
echo ""

node node_modules/vitest/vitest.mjs run --reporter=verbose 2>&1
TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
  echo ""
  echo "  ✅  [PASS] সব Tests পাশ হয়েছে"
  PASS=$((PASS + 1))
else
  echo ""
  echo "  ❌  [FAIL] কিছু Test ফেল হয়েছে — উপরের লাল লাইনগুলো দেখুন"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "──────────────────────────────────────────"
echo ""

# ── STEP 2: ESLint ──────────────────────────────────────
echo "[2/2] ESLint চালাচ্ছি..."
echo ""

node node_modules/eslint/bin/eslint.js js/core/ js/ui/ js/modules/ 2>&1
LINT_EXIT=$?

if [ $LINT_EXIT -eq 0 ]; then
  echo ""
  echo "  ✅  [PASS] ESLint — কোনো Error নেই"
  PASS=$((PASS + 1))
else
  echo ""
  echo "  ❌  [FAIL] ESLint Error পাওয়া গেছে — উপরের লাইনগুলো দেখুন"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "══════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo "  ✅  সব ঠিক আছে! নিরাপদে deploy করতে পারবেন।"
else
  echo "  ❌  ${FAIL}টি সমস্যা পাওয়া গেছে।"
  echo "  AI-কে বলুন: \"check চালালাম, এই error পেলাম: [error copy করুন]\""
fi

echo "══════════════════════════════════════════"
echo ""

exit $FAIL
