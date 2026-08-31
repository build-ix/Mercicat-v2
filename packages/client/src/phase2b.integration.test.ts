import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "@mercicat/simulation";
import { replayInputs } from "../../../apps/client/src/inputReplayer";

describe("Phase 2B prediction and reconciliation", () => {
  it("replays a history from an authoritative snapshot", () => {
    let server = createInitialState("phase2b", [1]);
    const serverRng = new SeededRandom(server.seed);
    const inputs = Array.from({ length: 50 }, (_, tick) => ({
      sequence: tick,
      tick,
      command: { type: "move" as const, tick, playerId: 1, direction: { x: 1, y: 0 } },
    }));
    for (const input of inputs.slice(0, 10)) server = step(server, [input.command], { rng: serverRng }).state;
    const snapshot = { tick: server.tick, state: structuredClone(server), stateHash: hashGameState(server), rngState: serverRng.serialize() };
    for (const input of inputs.slice(10)) server = step(server, [input.command], { rng: serverRng }).state;
    const rebuilt = replayInputs(snapshot, inputs.slice(10));
    expect(rebuilt.replayedInputs).toBe(40);
    expect(hashGameState(rebuilt.state)).toBe(hashGameState(server));
  });

  it("is deterministic under rapid inputs", () => {
    const initial = createInitialState(7, [1]);
    const rng = new SeededRandom(initial.seed);
    const inputs = Array.from({ length: 100 }, (_, tick) => ({
      sequence: tick, tick, command: { type: "move" as const, tick, playerId: 1, direction: { x: tick % 2, y: 0 } },
    }));
    const snapshot = { tick: initial.tick, state: initial, stateHash: hashGameState(initial), rngState: rng.serialize() };
    expect(hashGameState(replayInputs(snapshot, inputs).state)).toBe(hashGameState(replayInputs(snapshot, inputs).state));
  });
});
