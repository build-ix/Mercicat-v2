import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, step } from "../index.js";

describe("match phase state machine", () => {
  it("counts down from lobby and enters an active wave", () => {
    let state = createInitialState("phase-test", [1]);
    state.phase = "lobby";
    const rng = new SeededRandom(state.seed);

    for (let i = 0; i < 29; i += 1) {
      state = step(state, [], { rng, allPlayersReady: true }).state;
    }
    expect(state.phase).toBe("countdown");
    expect(state.countdownTick).toBe(1);

    state = step(state, [], { rng, allPlayersReady: true }).state;
    expect(state.phase).toBe("waveActive");
    expect(state.countdownTick).toBe(0);
  });
});
