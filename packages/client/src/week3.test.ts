import { describe, expect, it } from "vitest";
import { createInitialState, hashGameState } from "@mercicat/simulation";
import { ClientReconciler } from "./reconciliation";
import { NetworkDiagnostics } from "./diagnostics";

describe("client reconciliation and diagnostics", () => {
  it("keeps a bounded prediction history and replaces the baseline", () => {
    const initial = createInitialState("client-test", [1]);
    const client = new ClientReconciler(initial, { playerId: 1, maxHistory: 4 });
    for (let tick = 0; tick < 20; tick += 1) client.recordInput({ sequence: tick, tick, command: { type: "move", tick, playerId: 1, direction: { x: 1, y: 0 } } });
    expect(client.pendingCount).toBe(4);
    const state = structuredClone(initial); state.tick = 20; state.score = 9;
    client.reconcile({ tick: 20, state, stateHash: hashGameState(state) }, Number.POSITIVE_INFINITY);
    expect(client.state.score).toBe(9);
    expect(client.pendingCount).toBe(0);
  });
  it("records RTT, queue depth, and ordering diagnostics", () => {
    const diagnostics = new NetworkDiagnostics();
    const state = createInitialState(1, [1]);
    const snapshot = { tick: 2, state, stateHash: hashGameState(state) };
    diagnostics.inputSent(2); diagnostics.inputsAcknowledged();
    diagnostics.snapshotReceived(snapshot, 100, 180, 3, 220);
    diagnostics.snapshotReceived({ ...snapshot, tick: 1 }, undefined, 200, 1);
    const report = diagnostics.report();
    expect(report.latestRttMs).toBe(80);
    expect(report.maxQueueDepth).toBe(3);
    expect(report.outOfOrderSnapshots).toBe(1);
  });
});