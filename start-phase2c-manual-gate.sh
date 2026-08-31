#!/bin/bash
# Phase 2C Stage A: Manual Browser Latency Verification
# 
# Run this to start the development servers, then open two browser tabs
# and manually test two-player synchronization under browser-level latency.
#
# Usage:
#   bash start-phase2c-manual-gate.sh

set -e

echo "🎮 Phase 2C Stage A: Manual Browser Verification"
echo "=================================================="
echo ""
echo "Starting servers..."
echo ""

# Start server in background
echo "📡 Starting server on localhost:3001..."
pnpm --filter @mercicat-server dev &
SERVER_PID=$!

# Give server time to start
sleep 2

# Start client dev server in background
echo "🎨 Starting client on localhost:5173..."
pnpm --filter @mercicat-client dev &
CLIENT_PID=$!

# Give client time to start
sleep 3

echo ""
echo "✅ Servers running"
echo ""
echo "📖 MANUAL VERIFICATION STEPS:"
echo ""
echo "1. Open TWO browser tabs:"
echo "   - Tab A: http://localhost:5173/?room=manual-test"
echo "   - Tab B: http://localhost:5173/?room=manual-test"
echo ""
echo "2. In each tab, DevTools (F12) → Network tab → Settings gear"
echo "   → Check 'Disable cache' and select throttle:"
echo "   → Choose 'Slow 3G' (100ms latency, 400kbps)"
echo ""
echo "3. In Tab A, join game:"
echo "   → Select character, select weapon"
echo "   → Ready up"
echo ""
echo "4. In Tab B, join same room:"
echo "   → Select different character, select weapon"
echo "   → Ready up"
echo ""
echo "5. Verify BOTH tabs see:"
echo "   - Game starts (countdown → arena)"
echo "   - Both characters visible"
echo "   - Own character responds to input immediately"
echo "   - Other character moves smoothly (not jumping/teleporting)"
echo "   - No visual desync after 30+ seconds of play"
echo ""
echo "6. Metrics to check in browser console:"
echo "   - window.networkSession?.lastPredictionError"
echo "   - window.networkSession?.snapshots.length"
echo "   - window.networkSession?.pendingInputs.length"
echo ""
echo "7. When done, Ctrl+C here to stop servers"
echo ""
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo ""

# Wait for Ctrl+C
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; echo ''; echo '🛑 Servers stopped'; exit 0" SIGINT SIGTERM

wait
