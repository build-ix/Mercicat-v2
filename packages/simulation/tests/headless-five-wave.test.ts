import { GameState } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState } from "../src/createInitialState.js";
import { step } from "../src/step.js";
import { describe, expect, it } from "vitest";

describe("headless five-wave runner", () => {
  it("completes all five waves without wall-clock or random dependencies", () => {
    let state: GameState = createInitialState("headless-five-wave", [1]);
    const rng = new SeededRandom(state.seed);
    let ticks = 0;
    while (state.phase === "playing" && ticks < 20) {
      // The runner is intentionally headless: remove the current wave's enemies
      // through the same lifecycle state used by damageSystem, then advance.
      for (const entity of Object.values(state.entities)) {
        if (entity.kind === "enemy" && entity.lifecycle === "active") {
          entity.health = 0;
          entity.lifecycle = "dead";
        }
      }
      state = step(state, [], { rng }).state;
      ticks += 1;
    }
    expect(state.phase).toBe("victory");
    expect(state.wave.currentWave).toBe(5);
    expect(state.wave.matchComplete).toBe(true);
    expect(ticks).toBeLessThan(20);
  });
});
