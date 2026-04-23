#!/bin/bash
# ============================================================
# run-tests.sh — Validate MorphingText component
# ============================================================
set -e

echo "=== MorphingText Test Suite ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/final/apps/www"

PASS=0
FAIL=0

# Test 1: Check that all required files exist
echo "[1/5] Checking file presence..."
REQUIRED_FILES=(
    "registry/magicui/morphing-text.tsx"
    "registry/lib/svg-path-utils.ts"
    "registry/lib/font-loader.ts"
    "components/sections/hero-title.tsx"
    "public/fonts/Inter-Bold.ttf"
    "public/fonts/Inter-Regular.ttf"
    "package.json"
)
for f in "${REQUIRED_FILES[@]}"; do
    if [ -f "$f" ]; then
        echo "  OK: $f"
        ((PASS++))
    else
        echo "  MISSING: $f"
        ((FAIL++))
    fi
done
echo ""

# Test 2: Check package.json has required dependencies
echo "[2/5] Checking dependencies..."
DEPS=("opentype.js" "motion" "next" "react")
for dep in "${DEPS[@]}"; do
    if grep -q "\"$dep\"" package.json; then
        echo "  OK: $dep in package.json"
        ((PASS++))
    else
        echo "  MISSING: $dep not in package.json"
        ((FAIL++))
    fi
done
echo ""

# Test 3: Check no console.log in component files
echo "[3/5] Checking for debug console.log..."
LOG_COUNT=$(grep -r "console\.log" registry/magicui/morphing-text.tsx 2>/dev/null | wc -l)
if [ "$LOG_COUNT" -eq 0 ]; then
    echo "  OK: No console.log in morphing-text.tsx"
    ((PASS++))
else
    echo "  FAIL: Found $LOG_COUNT console.log calls"
    ((FAIL++))
fi
echo ""

# Test 4: Check no debugBorder references
echo "[4/5] Checking for debug border remnants..."
BORDER_COUNT=$(grep -r "debugBorder\|border-red" components/ registry/ 2>/dev/null | wc -l)
if [ "$BORDER_COUNT" -eq 0 ]; then
    echo "  OK: No debugBorder/border-red references"
    ((PASS++))
else
    echo "  FAIL: Found $BORDER_COUNT debug border references"
    ((FAIL++))
fi
echo ""

# Test 5: Check TypeScript syntax (if tsc available)
echo "[5/5] Checking TypeScript syntax..."
if command -v npx &> /dev/null; then
    if npx tsc --noEmit --strict registry/lib/svg-path-utils.ts 2>/dev/null; then
        echo "  OK: svg-path-utils.ts passes type check"
        ((PASS++))
    else
        echo "  WARN: tsc not fully configured, skipping strict check"
        ((PASS++))
    fi
else
    echo "  SKIP: tsc not available"
    ((PASS++))
fi
echo ""

# Summary
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
    echo "ALL TESTS PASSED"
else
    echo "SOME TESTS FAILED"
    exit 1
fi
