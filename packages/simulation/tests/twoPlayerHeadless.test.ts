import { describe, expect, it } from "vitest";
import { SeededRandom, type GameState, type InputCommand } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "../src/index.js";
import { ClientReconciler } from "../../client/src/reconciliation.js";

function script(tick: number, playerId: 1 | 2, changed = false): InputCommand {
  const x = playerId === 1 ? (tick % 4 < 2 ? 1 : -1) : (changed && tick === 77 ? -1 : 0);
  const y = playerId === 2 ? (tick % 6 < 3 ? 1 : -1) : 0;
  return { type: "move", tick, playerId, direction: { x, y } };
}
function run(seed: string, changed = false): string[] {
  let state: GameState = createInitialState(seed, [1, 2]);
  const rng = new SeededRandom(seed);
  const clients = [new ClientReconciler(state, { playerId: 1 }), new ClientReconciler(state, { playerId: 2 })];
  const hashes: string[] = [];
  for (let tick = 0; tick < 150; tick += 1) {
    const commands = [script(tick, 1), script(tick, 2, changed)];
    clients.forEach((client, index) => client.recordInput({ sequence: tick, tick, command: commands[index] }));
    state = step(state, commands, { rng }).state;
    const snapshot = { tick: state.tick, state, stateHash: hashGameState(state), rngState: rng.serialize() };
    clients.forEach((client) => client.reconcile(snapshot, tick));
    hashes.push(hashGameState(state));
  }
  expect(hashGameState(clients[0].state)).toBe(hashGameState(state));
  expect(hashGameState(clients[1].state)).toBe(hashGameState(state));
  return hashes;
}

describe("Week 3 two-player headless determinism", () => {
  it("reconciles two clients and produces byte-identical per-tick hashes twice", () => {
    expect(run("week-3-fixed-seed")).toEqual(run("week-3-fixed-seed"));
  });
  it("changes the final state when one input stream changes", () => {
    expect(run("week-3-fixed-seed").at(-1)).not.toBe(run("week-3-fixed-seed", true).at(-1));
  });
});
