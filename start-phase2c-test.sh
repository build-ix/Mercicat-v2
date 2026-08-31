#!/bin/bash
# MERCICAT-V2 PHASE 2C TEST LAUNCHER
# Starts server and client for manual testing

set -e
cd /home/alfr/mercicat-rebuild

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     MERCICAT-V2 PHASE 2C: MANUAL VERIFICATION GATE         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "This script starts the game server and opens the Vite dev server."
echo "You will need to:"
echo "  1. Open two browser tabs: http://localhost:5173/?room=test"
echo "  2. Both players join the same room"
echo "  3. Observe movement, interpolation, latency behavior"
echo ""
echo "Starting..."
echo ""

# Kill any existing processes on these ports
pkill -f "node.*mercicat" 2>/dev/null || true
sleep 1

echo "Building project..."
pnpm build --filter "...@mercicat-server" > /dev/null 2>&1
pnpm build --filter "...@mercicat-client" > /dev/null 2>&1

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    STARTING SERVER                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Server will listen on http://localhost:3000"
pnpm --filter @mercicat-server dev &
SERVER_PID=$!
sleep 2

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   STARTING VITE CLIENT                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Client dev server will start on http://localhost:5173"
echo "Open TWO tabs: http://localhost:5173/?room=test"
echo ""
pnpm --filter @mercicat-client dev &
CLIENT_PID=$!

echo ""
echo "Processes started:"
echo "  Server PID: $SERVER_PID"
echo "  Client PID: $CLIENT_PID"
echo ""
echo "Press Ctrl+C to stop both processes."
echo ""

# Wait for all background processes
wait
