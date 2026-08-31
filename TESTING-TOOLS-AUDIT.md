# Testing Infrastructure Assessment (Pre-Fable)

## What I Found

### ✅ What Already Exists

1. **Vitest + Socket.IO Integration Test**
   - Location: `apps/server/src/twoClient.integration.test.ts`
   - Status: 48 lines, fully working
   - Capabilities:
     - Spawns two Socket.IO clients
     - Tests room joining, identity verification, reconnection
     - Tests input override (prevents playerId spoofing)
     - Tests disconnect/reconnect with tokens
   - **Current limitation:** No latency injection, runs locally at ~0ms

2. **Simulation-Level Adverse Network Test**
   - Location: `packages/simulation/tests/adverseNetwork.test.ts`
   - Status: 56 lines, comprehensive
   - Simulates:
     - Deterministic 0-5% packet loss
     - 50-200ms latency
     - Out-of-order snapshots
     - Queue depth monitoring
   - **Use case:** Pure simulation testing (no real client)

3. **Built-in Diagnostics Module**
   - Location: `packages/client/src/diagnostics.ts`
   - Exposed metrics:
     - `latestRttMs` (round-trip time)
     - `averageRttMs` (historical average)
     - `maxSnapshotAgeMs` (oldest snapshot in buffer)
     - `maxQueueDepth` (snapshot buffer fullness)
     - `maxPositionDivergence` (prediction error)
     - `reconciliationErrors` (count)
     - `outOfOrderSnapshots` (count)
     - `staleSnapshots` (count)
   - **Use case:** Real-time measurement during browser tests

4. **NetworkSession Prediction Tracking**
   - Location: `apps/client/src/networkSession.ts`
   - Exposed fields:
     - `lastPredictionError` (distance in units)
     - `predictionErrors` (count > 0.01 threshold)
   - **Use case:** Measure prediction correctness

### ⚠️ What's Missing

1. **Browser Automation Framework**
   - No Playwright, Puppeteer, or Cypress
   - Cannot programmatically open browsers and run headless tests

2. **Latency Injection in Browser Test**
   - The `twoClient.integration.test.ts` connects at localhost, has ~0ms latency
   - Can extend it but no built-in latency emulation for Socket.IO

3. **Four-Player Integration Test**
   - Only `twoClient.integration.test.ts` exists
   - Four-player test would need to be written

4. **Metrics Export/Collection**
   - Diagnostics exist but aren't automatically logged/exported
   - Would need to add console.log or file write to capture them

### 🔧 Tools Available for Testing

- **Vitest** (test runner, configured)
- **Socket.IO** (real networking)
- **NetworkDiagnostics** (measurement)
- **Browser DevTools** (manual latency via throttle)
- **Linux tc netem** (system-level latency injection)
- **pnpm dev** (local server + Vite client)

---

## Recommended Testing Approach

**Awaiting Fable's assessment, but preliminary verdict:**

**Best approach: Hybrid (C)**
1. Use existing `twoClient.integration.test.ts` as base
2. Extend it to support injected latency via Socket.IO message delays
3. Manual browser testing for visual verification (DevTools throttle)
4. Export diagnostics to console for real-time observation

**Fastest path to first reproducible test:**
- Modify `twoClient.integration.test.ts`
- Add a delay wrapper around Socket.IO emit
- Run two clients with 100ms artificial delay
- Verify `maxPositionDivergence` and `reconciliationErrors` stay within threshold
- ~30 mins to implement
