import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, step, waveDurationTicks } from "../src/index.js";

describe("Phase 3A timed wave foundation", () => {
  it("ends on the timer even while enemies remain", () => {
    let state = createInitialState("timer", [1]);
    state.waveDurationTicks = 3;
    const rng = new SeededRandom(state.seed);
    let result = step(state, [], { rng }); state = result.state;
    expect(Object.values(state.entities).some((e) => e.kind === "enemy")).toBe(true);
    result = step(state, [], { rng }); state = result.state;
    result = step(state, [], { rng }); state = result.state;
    expect(state.wavePhase).toBe("waveEnding");
    expect(result.events.some((e) => e.type === "waveEnding")).toBe(true);
  });

  it("scales wave duration by five seconds and caps at sixty seconds", () => {
    expect(waveDurationTicks(1)).toBe(600);
    expect(waveDurationTicks(2)).toBe(750);
    expect(waveDurationTicks(5)).toBe(1200);
    expect(waveDurationTicks(20)).toBe(1800);
  });

  it("transitions a surviving two-player party through intermission", () => {
    let state = createInitialState("two-player", [1, 2]);
    state.waveDurationTicks = 1;
    const rng = new SeededRandom(state.seed);
    state = step(state, [], { rng }).state;
    state = step(state, [], { rng }).state;
    expect(state.wavePhase).toBe("intermission");
    expect(state.wave.waveComplete).toBe(true);
    expect(Object.keys(state.waveRewards)).toEqual(["1", "2"]);
    state = step(state, [], { rng, allPlayersReady: true }).state;
    expect(state.wavePhase).toBe("nextWaveReady");
  });

  it("keeps the authoritative clock stable under variable enemy counts", () => {
    let state = createInitialState("stress", [1]);
    state.waveDurationTicks = 101;
    const rng = new SeededRandom(state.seed);
    for (let i = 0; i < 100; i += 1) {
      if (i % 3 === 0) {
        const id = state.nextEntityId++;
        state.entities[id] = { id, kind: "enemy", lifecycle: "active", position: { x: i, y: 0 }, velocity: { x: 0, y: 0 }, radius: 10, health: 1, maxHealth: 1, spawnTick: state.tick, despawnTick: null, enemyType: "stress", contactDamage: 0, fireCooldownTicks: 0, targetPlayerId: null };
      }
      state = step(state, [], { rng }).state;
    }
    expect(state.waveTimerTicks).toBe(100);
    expect(state.wavePhase).toBe("waveActive");
  });
});
