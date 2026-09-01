import { describe, expect, it } from "vitest";
import { calculateScaledThreatBudget, getEnemyScaling } from "@mercicat/content";
import { SeededRandom } from "@mercicat/shared";
import { selectEnemyComposition } from "../src/index.js";
import type { Difficulty, EnemyRole } from "@mercicat/shared";
import { ENEMY_ROLES } from "@mercicat/content";

const spend = (c: Record<EnemyRole, number>) => Object.entries(c).reduce((n, [r, x]) => n + ENEMY_ROLES[r as EnemyRole].threatCost * x, 0);

describe("Phase 3B.2 difficulty scaling", () => {
  it("keeps player scaling sub-linear and monotonic", () => {
    for (const wave of [1, 5, 20]) {
      const hp = [2, 3, 4].map(p => getEnemyScaling(wave, p, 2).healthMultiplier);
      expect(hp[0]).toBeLessThan(hp[1]); expect(hp[1]).toBeLessThan(hp[2]);
      expect(hp[2] / hp[0]).toBeLessThan(1.5);
    }
  });
  it("has distinct Adventure and Endless progression curves", () => {
    expect(getEnemyScaling(1, 2, 2).healthMultiplier).toBeLessThan(getEnemyScaling(20, 2, 3).healthMultiplier);
    expect(calculateScaledThreatBudget(20, 2, "endless")).toBeGreaterThan(calculateScaledThreatBudget(20, 2, "adventure"));
  });
  it("caps every role at two and stays within the legacy director budget", () => {
    for (const difficulty of [1, 2, 3, 4] as Difficulty[]) for (let wave = 1; wave <= 12; wave++) {
      const c = selectEnemyComposition(wave, 4, difficulty, new SeededRandom(`${wave}-${difficulty}`));
      expect(Math.max(0, ...Object.values(c))).toBeLessThanOrEqual(2);
      expect(spend(c)).toBeLessThanOrEqual((20 + (wave - 1) * 12) * (1 + .35 * 3) * (1 + .1 * (difficulty - 1)) + 1);
    }
  });
  it("is replay-safe for seeded composition and stat resolution", () => {
    const a = getEnemyScaling(7, 3, 4);
    const b = getEnemyScaling(7, 3, 4);
    expect(a).toEqual(b);
    expect(selectEnemyComposition(7, 3, 4, new SeededRandom("replay"))).toEqual(selectEnemyComposition(7, 3, 4, new SeededRandom("replay")));
  });
});
