import { GameState, InputCommand } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState } from "../src/createInitialState.js";
import { hashGameState } from "../src/stateHash.js";
import { step } from "../src/step.js";
import { describe, expect, it } from "vitest";

function run(seed: number | string, ticks: number): string[] {
  let state = createInitialState(seed, [1]);
  const rng = new SeededRandom(seed);
  const hashes: string[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const commands: InputCommand[] = tick % 10 === 0 ? [{ type: "move", tick, playerId: 1, direction: { x: 1, y: 0 } }] : [];
    const result = step(state, commands, { rng });
    state = result.state; hashes.push(result.stateHash);
  }
  return hashes;
}

describe("deterministic simulation", () => {
  it("produces identical canonical hashes for 120 ticks", () => {
    expect(run("week-1", 120)).toEqual(run("week-1", 120));
  });
  it("changes when the seed changes", () => {
    expect(run("week-1", 120)[119]).not.toBe(run("week-1-other", 120)[119]);
  });
  it("stops a player when the movement sample is released", () => {
    let state = createInitialState(1, [1]);
    const rng = new SeededRandom(1);
    state = step(state, [{ type: "move", tick: 0, playerId: 1, direction: { x: 1, y: 0 } }], { rng }).state;
    expect(state.entities[state.players[1]]?.velocity.x).toBe(5);
    state = step(state, [], { rng }).state;
    expect(state.entities[state.players[1]]?.velocity).toEqual({ x: 0, y: 0 });
  });
  it("hashes canonical state independent of object insertion order", () => {
    const state = createInitialState(1, [1, 2]);
    const reversed = { ...state, entities: Object.fromEntries(Object.entries(state.entities).reverse()) };
    expect(hashGameState(state)).toBe(hashGameState(reversed));
  });
});
