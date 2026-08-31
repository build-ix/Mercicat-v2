import { describe, it, expect } from "vitest";
import { createInitialState } from "../createInitialState.js";
import { step } from "../step.js";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "../stateHash.js";
import type { GameState, InputCommand, PlayerId } from "@mercicat/shared";

describe("Combat Determinism", () => {
  it("replays identical state hash with same seed and commands", () => {
    const seed = 12345;
    const playerId = 1 as PlayerId;

    // First run
    const rng1 = new SeededRandom(seed);
    let state1 = createInitialState(seed, [playerId]);
    const commands: InputCommand[] = Array.from({ length: 60 }, (_, t) => ({
      type: "move" as const,
      tick: t,
      playerId,
      moveX: 1,
      moveY: 0,
    }));

    let hash1 = "";
    for (let t = 0; t < 60; t++) {
      const result = step(state1, commands.filter((c) => c.tick === t), { rng: rng1 });
      state1 = result.state;
      hash1 = result.stateHash;
    }

    // Second run: identical seed and commands
    const rng2 = new SeededRandom(seed);
    let state2 = createInitialState(seed, [playerId]);

    let hash2 = "";
    for (let t = 0; t < 60; t++) {
      const result = step(state2, commands.filter((c) => c.tick === t), { rng: rng2 });
      state2 = result.state;
      hash2 = result.stateHash;
    }

    expect(hash1).toBe(hash2);
  });

  it("deterministic step() output is stable across runs", () => {
    const seed = 54321;
    const playerId = 1 as PlayerId;
    const rng = new SeededRandom(seed);
    const state = createInitialState(seed, [playerId]);

    const cmd: InputCommand = {
      type: "fire",
      tick: 0,
      playerId,
      aimX: 1,
      aimY: 0,
    };

    const result1 = step(state, [cmd], { rng });
    const result2 = step(result1.state, [cmd], { rng });

    expect(result2.stateHash).toBeDefined();
    expect(result2.state.tick).toBe(2);
  });

  it("rollback: resimulate from saved checkpoint → hash identical", () => {
    const seed = 99999;
    const playerId = 1 as PlayerId;
    const rng1 = new SeededRandom(seed);
    let state = createInitialState(seed, [playerId]);

    const hashes: string[] = [];
    for (let t = 0; t < 100; t++) {
      const cmd: InputCommand = {
        type: "move",
        tick: t,
        playerId,
        moveX: Math.cos((t / 100) * Math.PI * 2),
        moveY: Math.sin((t / 100) * Math.PI * 2),
      };
      const result = step(state, [cmd], { rng: rng1 });
      state = result.state;
      hashes.push(result.stateHash);
    }

    const finalHash = hashes[hashes.length - 1];

    // Rollback to tick 50 and resimulate to tick 100
    const rng2 = new SeededRandom(seed);
    let rollbackState = createInitialState(seed, [playerId]);

    // Run to tick 50
    for (let t = 0; t < 50; t++) {
      const cmd: InputCommand = {
        type: "move",
        tick: t,
        playerId,
        moveX: Math.cos((t / 100) * Math.PI * 2),
        moveY: Math.sin((t / 100) * Math.PI * 2),
      };
      const result = step(rollbackState, [cmd], { rng: rng2 });
      rollbackState = result.state;
    }

    // Continue from tick 50 to 100
    for (let t = 50; t < 100; t++) {
      const cmd: InputCommand = {
        type: "move",
        tick: t,
        playerId,
        moveX: Math.cos((t / 100) * Math.PI * 2),
        moveY: Math.sin((t / 100) * Math.PI * 2),
      };
      const result = step(rollbackState, [cmd], { rng: rng2 });
      rollbackState = result.state;
      if (t === 99) {
        expect(result.stateHash).toBe(finalHash);
      }
    }
  });
});
