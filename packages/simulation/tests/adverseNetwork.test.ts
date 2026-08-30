import { describe, expect, it } from "vitest";
import { SeededRandom, type GameState, type NetworkSnapshot } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "../src/index.js";
import { ClientReconciler } from "../../client/src/reconciliation.js";
import { NetworkDiagnostics } from "../../client/src/diagnostics.js";

function snapshot(state: GameState): NetworkSnapshot { return { tick: state.tick, state: structuredClone(state), stateHash: hashGameState(state) }; }

describe("Week 3 adverse network resilience", () => {
  it("recovers from latency, loss, reordering, and temporary loss with bounded queues", () => {
    let server = createInitialState("adverse-fixed", [1]);
    const client = new ClientReconciler(server, { playerId: 1, maxHistory: 64 });
    const diagnostics = new NetworkDiagnostics();
    const rng = new SeededRandom(server.seed);
    const delayed: NetworkSnapshot[] = [];
    for (let tick = 0; tick < 180; tick += 1) {
      const command = { type: "move" as const, tick, playerId: 1, direction: { x: tick % 2 ? 1 : -1, y: 0 } };
      const input = client.recordInput({ sequence: tick, tick, command });
      client.predict(command);
      server = step(server, [command], { rng }).state;
      // Deterministic 0-5% loss and 50-200ms-ish (2-6 tick) delay.
      if (tick % 23 !== 0) delayed.push(snapshot(server));
      if (delayed.length > 6 && tick % 5 !== 0) {
        const delivered = tick % 7 === 0 ? delayed.pop()! : delayed.shift()!;
        diagnostics.snapshotReceived(delivered, tick * 33 - 100, tick * 33, delayed.length);
        client.reconcile(delivered, delivered.tick - 1);
      }
      expect(client.pendingCount).toBeLessThanOrEqual(64);
      void input;
    }
    while (delayed.length) {
      const delivered = delayed.shift()!;
      client.reconcile(delivered, 179);
    }
    client.reconcile(snapshot(server), Number.POSITIVE_INFINITY);
    expect(client.pendingCount).toBe(0);
    expect(hashGameState(client.state)).toBe(hashGameState(server));
    expect(diagnostics.report().maxQueueDepth).toBeGreaterThan(0);
  });
  it("never lets a client snapshot overwrite server gameplay authority", () => {
    let server = createInitialState("authority", [1]);
    const client = new ClientReconciler(server, { playerId: 1 });
    const rng = new SeededRandom(server.seed);
    for (let tick = 0; tick < 20; tick += 1) server = step(server, [], { rng }).state;
    const fake = snapshot(server);
    const player = fake.state.entities[fake.state.players[1]];
    player.health = 999;
    client.reconcile(fake, Number.POSITIVE_INFINITY);
    expect(client.state.entities[client.state.players[1]].health).toBe(999);
    // A later authoritative snapshot restores gameplay state; render smoothing cannot resist it.
    const authoritative = snapshot(server);
    expect(authoritative.state.entities[authoritative.state.players[1]].health).not.toBe(999);
    client.reconcile(authoritative, Number.POSITIVE_INFINITY);
    expect(client.state.entities[client.state.players[1]].health).toBe(authoritative.state.entities[authoritative.state.players[1]].health);
  });
});
