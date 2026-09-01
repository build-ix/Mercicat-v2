import { describe, expect, it } from "vitest";
import { ENEMY_ROLES, calculateThreatBudget } from "@mercicat/content";
import type { Difficulty, EnemyRole } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { selectEnemyComposition } from "../src/index.js";

function select(seed: number | string, wave = 1, players = 2, difficulty: Difficulty = 2) {
  return selectEnemyComposition(wave, players, difficulty, new SeededRandom(seed));
}
function spent(composition: Record<EnemyRole, number>): number {
  return Object.entries(composition).reduce((sum, [role, count]) => sum + ENEMY_ROLES[role as EnemyRole].threatCost * count, 0);
}

describe("Phase 3B.0 spawn director", () => {
  it("is deterministic for the same seed and varies with a different seed", () => {
    expect(select("same-seed")).toEqual(select("same-seed"));
    expect(select(1)).not.toEqual(select(2));
  });

  it("never exceeds its threat budget", () => {
    for (let wave = 1; wave <= 5; wave += 1) {
      const composition = select(`budget-${wave}`, wave, 4, 4);
      expect(spent(composition)).toBeLessThanOrEqual(calculateThreatBudget(wave, 4, 4));
    }
  });

  it("applies role unlock gates", () => {
    expect(ENEMY_ROLES.swarm.unlockWave).toBe(1);
    expect(ENEMY_ROLES.charger.unlockWave).toBe(1);
    expect(ENEMY_ROLES.ranged.unlockWave).toBe(1);
    expect(ENEMY_ROLES.tank.unlockWave).toBe(2);
    expect(ENEMY_ROLES.flanker.unlockWave).toBe(2);
    expect(ENEMY_ROLES.disabler.unlockWave).toBe(3);
    expect(Object.keys(select("unlock-1", 1)).every((role) => ENEMY_ROLES[role as EnemyRole].unlockWave <= 1)).toBe(true);
    expect(Object.keys(select("unlock-2", 2)).every((role) => ENEMY_ROLES[role as EnemyRole].unlockWave <= 2)).toBe(true);
    expect(Object.keys(select("unlock-3", 3)).every((role) => ENEMY_ROLES[role as EnemyRole].unlockWave <= 3)).toBe(true);
  });

  it("scales budget with players, difficulty, and wave progression", () => {
    expect(calculateThreatBudget(1, 2, 2)).toBeLessThan(calculateThreatBudget(1, 3, 2));
    expect(calculateThreatBudget(1, 3, 2)).toBeLessThan(calculateThreatBudget(1, 4, 2));
    expect(calculateThreatBudget(1, 2, 1)).toBeLessThan(calculateThreatBudget(1, 2, 2));
    expect(calculateThreatBudget(1, 2, 2)).toBeLessThan(calculateThreatBudget(1, 2, 3));
    expect(calculateThreatBudget(1, 2, 3)).toBeLessThan(calculateThreatBudget(1, 2, 4));
    const budgets = [1, 2, 3, 4, 5].map((wave) => calculateThreatBudget(wave, 2, 2));
    expect(budgets).toEqual([30, 48, 65, 83, 101]);
  });

  it("serializes composition keys alphabetically", () => {
    const composition = select("ordering", 5, 4, 4);
    expect(Object.keys(composition)).toEqual([...Object.keys(composition)].sort());
  });

  it("replays identically from an RNG snapshot", () => {
    const rng = new SeededRandom("snapshot");
    const snapshot = rng.serialize();
    const first = selectEnemyComposition(4, 3, 3, rng);
    const replayRng = SeededRandom.deserialize(snapshot);
    expect(selectEnemyComposition(4, 3, 3, replayRng)).toEqual(first);
  });
});
