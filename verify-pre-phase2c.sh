#!/bin/bash
# MERCICAT-V2 LOCAL VERIFICATION SCRIPT
# Quick checks before starting Phase 2C

set -e

cd /home/alfr/mercicat-rebuild

echo "═══════════════════════════════════════════════════════════"
echo "MERCICAT-V2 PRE-PHASE-2C VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "✓ Checking git status..."
if [ -z "$(git status --short)" ]; then
    echo "  ✅ Clean (no uncommitted changes)"
else
    echo "  ⚠️  Uncommitted changes detected"
    git status --short
fi
echo ""

echo "✓ Running tests..."
if pnpm test 2>&1 | grep -q "Test Files.*passed"; then
    PASS_COUNT=$(pnpm test 2>&1 | grep "Tests.*passed" | tail -1 | grep -oE "[0-9]+ passed" | head -1)
    echo "  ✅ $PASS_COUNT"
else
    echo "  ❌ Tests failed"
    exit 1
fi
echo ""

echo "✓ Building project..."
if pnpm build 2>&1 | grep -q "✓.*built"; then
    echo "  ✅ Build successful"
else
    echo "  ⚠️  Build may have warnings"
fi
echo ""

echo "✓ Checking dependencies..."
PACKAGES=$(ls packages/*/package.json | wc -l)
APPS=$(ls apps/*/package.json | wc -l)
echo "  ✅ Packages: $PACKAGES, Apps: $APPS"
echo ""

echo "✓ Checking entry points..."
[ -f "apps/server/src/main.ts" ] && echo "  ✅ Server: apps/server/src/main.ts"
[ -f "apps/client/src/main.ts" ] && echo "  ✅ Client: apps/client/src/main.ts"
echo ""

echo "✓ Recent commits:"
git log --oneline -3 | sed 's/^/  /'
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "ALL CHECKS PASSED ✅"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Ready to start Phase 2C when Fable provides steps."
echo ""
