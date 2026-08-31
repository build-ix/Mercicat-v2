import { describe, expect, it } from "vitest";
import type { EnemyEntity, GameState, InputCommand, ProjectileEntity } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "../index.js";

function commands(tick: number): InputCommand[] {
  const result: InputCommand[] = [{
    type: "move", tick, playerId: 1,
    direction: { x: tick % 4 < 2 ? 1 : -1, y: tick % 6 < 3 ? 1 : 0 },
  }];
  if (tick % 3 === 0) result.push({ type: "fire", tick, playerId: 1, direction: { x: 1, y: 0 } });
  return result;
}

function run(seed: string, count: number, initial = createInitialState(seed, [1])): { state: GameState; hashes: string[] } {
  let state = initial;
  const rng = new SeededRandom(seed);
  const hashes: string[] = [];
  for (let tick = 0; tick < count; tick += 1) {
    const result = step(state, commands(state.tick), { rng });
    state = result.state;
    hashes.push(result.stateHash);
  }
  return { state, hashes };
}

describe("combat determinism", () => {
  it("produces the same hash for the same seed and 60-tick command sequence", () => {
    expect(run("combat-seed", 60).hashes).toEqual(run("combat-seed", 60).hashes);
  });

  it("can roll back 20 ticks and resimulate to the same final hash", () => {
    const seed = "rollback-combat";
    let state = createInitialState(seed, [1]);
    const rng = new SeededRandom(seed);
    let rollbackState: GameState | undefined;
    let rollbackRng = "";
    for (let tick = 0; tick < 60; tick += 1) {
      if (tick === 40) {
        rollbackState = structuredClone(state);
        rollbackRng = rng.serialize();
      }
      state = step(state, commands(state.tick), { rng }).state;
    }
    const finalHash = hashGameState(state);
    expect(rollbackState).toBeDefined();
    const replayRng = SeededRandom.deserialize(rollbackRng);
    let replay = rollbackState!;
    for (let tick = 40; tick < 60; tick += 1) replay = step(replay, commands(replay.tick), { rng: replayRng }).state;
    expect(hashGameState(replay)).toBe(finalHash);
  });

  it("handles eight enemies and projectiles with deterministic damage", () => {
    const makeState = (): GameState => {
      const state = createInitialState("crowded-combat", [1]);
      const player = state.entities[state.players[1]]!;
      for (let i = 0; i < 8; i += 1) {
        const id = state.nextEntityId++;
        state.entities[id] = {
          id, kind: "enemy", lifecycle: "active", position: { x: 30 + i * 80, y: 0 }, velocity: { x: 0, y: 0 },
          radius: 16, health: 20, maxHealth: 20, spawnTick: 0, despawnTick: null,
          enemyType: "basic", contactDamage: 0.1, fireCooldownTicks: 999, targetPlayerId: null,
        } satisfies EnemyEntity;
      }
      // Several projectiles exercise stable ordering; the first one hits enemy 2.
      for (let i = 0; i < 50; i += 1) {
        const id = state.nextEntityId++;
        state.entities[id] = {
          id, kind: "projectile", lifecycle: "active", ownerId: player.id,
          position: { x: 500 + i * 20, y: 500 }, velocity: { x: 1, y: 0 }, radius: 4,
          health: 1, maxHealth: 1, spawnTick: 0, despawnTick: null, damage: 10,
          lifetimeTicks: 300, ageTicks: 0,
        } satisfies ProjectileEntity;
      }
      return state;
    };
    const a = run("crowded-combat", 1, makeState());
    const b = run("crowded-combat", 1, makeState());
    expect(hashGameState(a.state)).toBe(hashGameState(b.state));
    expect(a.state.entities[2]?.health).toBe(10);
    expect(a.hashes).toEqual(b.hashes);
  });
});
