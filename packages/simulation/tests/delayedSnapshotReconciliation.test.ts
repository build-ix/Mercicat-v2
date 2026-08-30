import { describe, expect, it } from "vitest";
import { SeededRandom, type NetworkSnapshot, type InputCommand } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "../src/index.js";
import { ClientReconciler } from "../../client/src/reconciliation.js";

function run(seed: string, changed = false): { hashes: string[]; server: ReturnType<typeof createInitialState>; snapshots: NetworkSnapshot[] } {
  let server = createInitialState(seed, [1]);
  const rng = new SeededRandom(seed);
  const snapshots: NetworkSnapshot[] = [];
  const hashes: string[] = [];
  for (let tick = 0; tick < 100; tick += 1) {
    const command: InputCommand = { type: "move", tick, playerId: 1, direction: { x: tick % 2 ? 1 : -1, y: 0 } };
    server = step(server, [command], { rng }).state;
    hashes.push(hashGameState(server));
    if ((tick + 1) % 5 === 0) snapshots.push({ tick: server.tick, state: structuredClone(server), stateHash: hashGameState(server), rngState: rng.serialize() });
  }
  const client = new ClientReconciler(createInitialState(seed, [1]), { playerId: 1 });
  // Deliver each five-tick snapshot ten ticks after it was emitted.
  for (let i = 0; i < snapshots.length; i += 1) {
    const snapshot = snapshots[i];
    const receiveAt = snapshot.tick + 10;
    if (receiveAt <= 100) client.reconcile(snapshot, snapshot.tick - 1);
  }
  const final = snapshots[snapshots.length - 1];
  if (changed) {
    client.recordInput({ sequence: 100, tick: 100, command: { type: "move", tick: 100, playerId: 1, direction: { x: 1, y: 0 } } });
    client.reconcile(final, 99);
  } else {
    client.reconcile(final, Number.POSITIVE_INFINITY);
  }
  expect(hashGameState(client.state)).toBe(hashGameState(server));
  return { hashes, server, snapshots };
}

describe("delayed snapshot reconciliation", () => {
  it("converges after ten-tick snapshot delay and is byte-identical across runs", () => {
    const first = run("delayed-fixed-seed");
    const second = run("delayed-fixed-seed");
    expect(first.hashes).toEqual(second.hashes);
  });
  it("does not silently ignore a changed unacknowledged input", () => {
    const baseline = run("delayed-change-seed");
    // A command at the snapshot boundary is replayed, so changing it changes the
    // predicted state rather than being hidden by the old prediction baseline.
    const client = new ClientReconciler(baseline.server, { playerId: 1 });
    client.recordInput({ sequence: 100, tick: 100, command: { type: "move", tick: 100, playerId: 1, direction: { x: 1, y: 0 } } });
    client.reconcile(baseline.snapshots.at(-1)!, 99);
    expect(hashGameState(client.state)).not.toBe(hashGameState(baseline.server));
  });
});
