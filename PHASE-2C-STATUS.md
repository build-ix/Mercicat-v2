# Phase 2C Testing Framework — Status Report
**Date:** 2026-08-31  
**Status:** Infrastructure Built, First Iteration Complete

## What We Built

### 1. Network Delay Proxy (`testNetworkProxy.ts`)
- `DelayedSocket` wrapper class
- Configurable latency, packet loss, jitter
- Deterministic seeded RNG for reproducibility
- 70 lines, type-safe TypeScript

### 2. Phase 2C Test Suite (`phase2c.integration.test.ts`)
- Four test scenarios: 100ms, 300ms, 500ms+2% loss, baseline
- Real Socket.IO clients (no mocking)
- Metrics collection: snapshots, acknowledgements, tick sync, state hash
- 220 lines, fully integrated with existing server

### 3. Build Status
✅ Full build passes (no TypeScript errors)  
✅ Existing 22 tests still pass  
✅ New test file executes without build blockers

---

## Current Issue: Tests Timeout

**Problem:** Tests timeout waiting for `initialState` event.

**Root Cause:** The `DelayedSocket` wrapper only delays **client → server** communication. Server → client snapshots arrive immediately with 0ms latency, but the client join acknowledgement is delayed. This creates an asymmetric race condition.

**Example timeline (100ms latency):**
- T=0ms: Client A emits `joinRoom` (enters queue)
- T=100ms: Server receives `joinRoom` from A
- T=100ms: Server responds with `joinedRoom` + `initialState` (sent immediately)
- T=100ms: Client B never sends `joinRoom` because its message is still in queue
- T=5000ms: Test timeout (client still waiting for initial state with both players)

**Attempted fix in current code:** No bidirectional delay wrapper applied yet.

---

## Solution Path: OS-Level Latency (Fable's Recommendation)

Instead of building a full bidirectional Socket.IO proxy, use **Linux `tc netem`** for OS-level loopback delay:

```bash
# Inject 100ms latency on loopback interface
sudo tc qdisc add dev lo root netem delay 100ms

# Add packet loss
sudo tc qdisc change dev lo root netem delay 100ms loss 2%

# Clean up
sudo tc qdisc del dev lo root
```

**Advantages:**
- ✅ Affects all communication (bidirectional, symmetric)
- ✅ No proxy code needed
- ✅ More realistic (applies at kernel level)
- ✅ Supports jitter, reordering, bandwidth limiting
- ✅ Works with real Socket.IO, no interception layer

**Disadvantages:**
- ❌ Requires `sudo` or CAP_NET_ADMIN
- ❌ Affects all localhost traffic (not scoped)
- ❌ Requires GMKtec hardware access for testing

---

## Recommendation: Hybrid Path Forward

### Phase 2C Stage A: Manual Verification Gate (Immediate)

**Start here.** Use the existing browser dev tools for visual verification:

```bash
# Terminal 1: Start server
pnpm --filter @mercicat-server dev

# Terminal 2: Start client (Vite)
pnpm --filter @mercicat-client dev

# Browser: Open http://localhost:5173/?room=test in TWO tabs
# DevTools: Network tab → Throttle to "Slow 3G" (100ms latency)
# Verify: Both players move, no visual desync
```

**Metrics to observe:**
- Position of player 2 (does it match across clients?)
- Movement smoothness under latency
- No "jumping" or "rollback" visuals
- Responsiveness when typing commands

**Time: 30 minutes manual testing**

### Phase 2C Stage B: Extend Existing Two-Client Test (Next)

Keep the test framework but fix it:

**Option 1: Remove proxy, keep simple Socket.IO test**
```ts
// Just run the original twoClient.integration.test.ts
// It tests basic synchronization without artificial latency
// All 22 tests pass
```

**Option 2: Use OS-level delay (if sudo available)**
```ts
// Run test with: sudo tc qdisc add dev lo root netem delay 100ms
// Then: pnpm test
// Clean up after with: sudo tc qdisc del dev lo root
```

**Option 3: Build bidirectional proxy (Future)**
```ts
// Wrap Socket events in BOTH directions
// More code but complete test automation
```

---

## Files Created

| File | Purpose | Status |
|------|---------|--------|
| `apps/server/src/testNetworkProxy.ts` | Latency injection wrapper | ✅ Built, not used yet |
| `apps/server/src/phase2c.integration.test.ts` | Test scenarios | ⚠️ Built, timeout issues |
| This report | Documentation | 📝 For Al's review |

---

## Next Action

**Do you want to:**

1. **Skip automated tests for now** → Use manual browser gate (Stage A) immediately
2. **Debug & fix the test proxy** → Implement bidirectional delay wrapping  
3. **Use OS-level latency** → Add `tc netem` to test setup
4. **Move forward with existing tests** → Run baseline (non-latency) tests only

**My recommendation:** Option 1 (Manual gate) → Option 3 (OS-level latency) if sudo is available.

---

## Summary

**What works:**
- Real two-client Socket.IO test infrastructure
- Build system integration
- Metrics collection framework

**What doesn't work yet:**
- Latency injection (unidirectional → creates race)
- Automated test reliability under delay

**Next focus:**
- Manual visual verification (browser throttling)
- Then extend tests with OS-level delay injection
- Then four-player coverage

---

**Awaiting your direction before proceeding to Stage A.**
