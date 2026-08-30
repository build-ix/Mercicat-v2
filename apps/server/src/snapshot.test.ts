import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "@mercicat/simulation";
import { serializeCanonicalSnapshot } from "./snapshot";

describe("canonical snapshot RNG state", () => {
  it("round-trips RNG state and produces the same subsequent simulation", () => {
    let state = createInitialState("snapshot-rng", [1]);
    const rng = new SeededRandom(state.seed);
    for (let i = 0; i < 17; i++) state = step(state, [], { rng }).state;
    const snapshot = serializeCanonicalSnapshot(state, rng, true);
    const restored = SeededRandom.deserialize(snapshot.rngState!);
    let a = state;
    let b = structuredClone(snapshot.state);
    for (let i = 0; i < 20; i++) {
      a = step(a, [], { rng }).state;
      b = step(b, [], { rng: restored }).state;
      expect(hashGameState(b)).toBe(hashGameState(a));
    }
    expect(snapshot.rngState).toMatch(/^[0-9a-f]{8}$/);
  });
});
