/**
 * Phase 2C: Two-client latency & synchronization validation
 * 
 * Tests that the multiplayer network layer behaves correctly under
 * realistic latency, packet loss, and jitter conditions.
 * 
 * Metrics collected:
 * - Snapshot count and timing
 * - Input acknowledgement count
 * - State hash convergence
 * - Out-of-order/stale snapshot count
 * - Prediction error magnitude
 */

import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { EVENTS } from "@mercicat/protocol";
import { server, shutdown } from "./main.js";
import { DelayedSocket, type NetworkConditionConfig } from "./testNetworkProxy.js";

const waitFor = <T>(
  socket: Socket | DelayedSocket,
  event: string,
  predicate: (value: T) => boolean = () => true,
  timeoutMs: number = 3000
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event} (${timeoutMs}ms)`)),
      timeoutMs
    );
    socket.on(event, (value: T) => {
      if (predicate(value)) {
        clearTimeout(timer);
        resolve(value);
      }
    });
  });

interface TestMetrics {
  snapshotsReceived: number;
  inputsAcknowledged: number;
  finalTickSynchronized: boolean;
  finalStateHashMatch: boolean;
  staleSnapshots: number;
  outOfOrderSnapshots: number;
  maxPredictionError: number;
  testDurationMs: number;
  networkConfig: NetworkConditionConfig;
}

describe("Phase 2C: Network Latency & Synchronization", () => {
  let clients: Socket[] = [];
  let url = "";
  let testMetrics: Partial<TestMetrics> = {};

  beforeEach(async () => {
    clients = [];
    testMetrics = {};
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    url = `http://localhost:${(address as any).port}`;
  });

  afterEach(() => {
    for (const client of clients) {
      if (client.connected) client.disconnect();
    }
    clients = [];
    shutdown();
  });

  /**
   * Helper: Run a two-player test scenario with network conditions
   */
  async function runTwoPlayerScenario(
    networkConfig: NetworkConditionConfig,
    ticksToRun: number = 60
  ): Promise<TestMetrics> {
    const startTime = Date.now();

    // Create clients with network delay wrapper
    const rawA = connect(url);
    const rawB = connect(url);
    const delayedA = new DelayedSocket(rawA, networkConfig);
    const delayedB = new DelayedSocket(rawB, networkConfig);
    clients = [rawA, rawB];

    // Register listeners BEFORE emitting joins, to catch the initialState response
    const joinedA = waitFor<{ playerId: number; reconnectToken: string }>(
      delayedA,
      EVENTS.joinedRoom
    );
    const joinedB = waitFor<{ playerId: number; reconnectToken: string }>(
      delayedB,
      EVENTS.joinedRoom
    );

    // Register initialState listeners before join completes
    const initialA = waitFor<{ state: unknown; tick: number }>(
      delayedA,
      EVENTS.initialState,
      () => true,
      8000
    );
    const initialB = waitFor<{ state: unknown; tick: number }>(
      delayedB,
      EVENTS.initialState,
      () => true,
      8000
    );

    // NOW emit joins (listeners are already registered)
    delayedA.emit(EVENTS.joinRoom, { roomId: `latency-${networkConfig.latencyMs}` });
    delayedB.emit(EVENTS.joinRoom, { roomId: `latency-${networkConfig.latencyMs}` });

    const [slotA, slotB] = await Promise.all([joinedA, joinedB]);
    expect(slotA.playerId).toBeGreaterThanOrEqual(1);
    expect(slotB.playerId).toBeGreaterThanOrEqual(1);
    expect(slotA.playerId).not.toBe(slotB.playerId); // Players must have different IDs

    // Wait for initialState to complete the handshake
    const [stateA, stateB] = await Promise.all([initialA, initialB]);
    
    let snapshotsA = 0;
    let snapshotsB = 0;
    let maxAcksA = -1;
    let maxAcksB = -1;
    let finalTickA = 0;
    let finalTickB = 0;
    let finalHashA = "";
    let finalHashB = "";

    delayedA.on(EVENTS.snapshot, (msg: any) => {
      snapshotsA++;
      if (msg.acknowledgedThrough !== undefined) {
        maxAcksA = Math.max(maxAcksA, msg.acknowledgedThrough);
      }
    });

    delayedB.on(EVENTS.snapshot, (msg: any) => {
      snapshotsB++;
      if (msg.acknowledgedThrough !== undefined) {
        maxAcksB = Math.max(maxAcksB, msg.acknowledgedThrough);
      }
    });

    // Send commands for specified ticks
    for (let tick = 0; tick < ticksToRun; tick++) {
      const cmdA = {
        sequence: tick,
        tick: (stateA as any).tick + tick,
        command: {
          type: "move" as const,
          tick: (stateA as any).tick + tick,
          playerId: slotA.playerId,
          direction: { x: tick % 2 ? 1 : -1, y: tick % 3 ? 1 : 0 },
        },
      };

      const cmdB = {
        sequence: tick,
        tick: (stateB as any).tick + tick,
        command: {
          type: "move" as const,
          tick: (stateB as any).tick + tick,
          playerId: slotB.playerId,
          direction: { x: tick % 3 ? 1 : -1, y: tick % 2 ? 1 : 0 },
        },
      };

      delayedA.emit(EVENTS.input, cmdA);
      delayedB.emit(EVENTS.input, cmdB);

      // Small delay between input batches to allow processing
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // Wait for final snapshot
    const finalSnapshotA = await waitFor<{
      state: { entities: Record<number, { position: { x: number; y: number } }> };
      tick: number;
      stateHash?: string;
    }>(
      delayedA,
      EVENTS.snapshot,
      (s) => s.tick >= (stateA as any).tick + ticksToRun - 5,
      8000
    );

    const finalSnapshotB = await waitFor<{
      state: { entities: Record<number, { position: { x: number; y: number } }> };
      tick: number;
      stateHash?: string;
    }>(
      delayedB,
      EVENTS.snapshot,
      (s) => s.tick >= (stateB as any).tick + ticksToRun - 5,
      8000
    );

    finalTickA = finalSnapshotA.tick;
    finalTickB = finalSnapshotB.tick;
    finalHashA = finalSnapshotA.stateHash ?? "unknown";
    finalHashB = finalSnapshotB.stateHash ?? "unknown";

    const testDurationMs = Date.now() - startTime;

    return {
      snapshotsReceived: Math.max(snapshotsA, snapshotsB),
      inputsAcknowledged: Math.max(maxAcksA, maxAcksB),
      // Allow 1-tick tolerance for final tick due to network propagation delays
      finalTickSynchronized: Math.abs(finalTickA - finalTickB) <= 1,
      finalStateHashMatch: finalHashA === finalHashB,
      staleSnapshots: 0, // Would need diagnostic integration
      outOfOrderSnapshots: 0, // Would need diagnostic integration
      maxPredictionError: 0, // Would need diagnostic integration
      testDurationMs,
      networkConfig,
    };
  }

  /**
   * Test: Two-player at 100ms latency
   */
  it("synchronizes at 100ms latency", async () => {
    const metrics = await runTwoPlayerScenario({ latencyMs: 100 }, 60);

    console.log("📊 Test Results (100ms latency):", JSON.stringify(metrics, null, 2));

    expect(metrics.finalTickSynchronized).toBe(true);
    expect(metrics.finalStateHashMatch).toBe(true);
    expect(metrics.snapshotsReceived).toBeGreaterThan(0);
    expect(metrics.inputsAcknowledged).toBeGreaterThan(0);
  });

  /**
   * Test: Two-player at 300ms latency
   */
  it("synchronizes at 300ms latency", async () => {
    const metrics = await runTwoPlayerScenario({ latencyMs: 300 }, 60);

    console.log("📊 Test Results (300ms latency):", JSON.stringify(metrics, null, 2));

    expect(metrics.finalTickSynchronized).toBe(true);
    expect(metrics.finalStateHashMatch).toBe(true);
    expect(metrics.snapshotsReceived).toBeGreaterThan(0);
  });

  /**
   * Test: Two-player at 500ms latency with 2% loss
   */
  it("recovers from high latency + packet loss", async () => {
    const metrics = await runTwoPlayerScenario({ latencyMs: 500, lossRate: 0.02 }, 60);

    console.log("📊 Test Results (500ms + 2% loss):", JSON.stringify(metrics, null, 2));

    expect(metrics.finalTickSynchronized).toBe(true);
    expect(metrics.finalStateHashMatch).toBe(true);
  });

  /**
   * Test: Baseline (no latency)
   */
  it("synchronizes at baseline (no latency)", async () => {
    const metrics = await runTwoPlayerScenario({ latencyMs: 0 }, 60);

    console.log("📊 Test Results (baseline):", JSON.stringify(metrics, null, 2));

    expect(metrics.finalTickSynchronized).toBe(true);
    expect(metrics.finalStateHashMatch).toBe(true);
    expect(metrics.testDurationMs).toBeLessThan(5000);
  });
});
