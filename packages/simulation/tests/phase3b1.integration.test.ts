import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, placeShop, selectEnemyComposition, step } from "../src/index.js";

describe("Phase 3B.1 pacing and shop placement", () => {
  it("keeps a composition within its threat budget", () => {
    const rng = new SeededRandom("budget");
    const composition = selectEnemyComposition(3, 2, 2, rng);
    const costs: Record<string, number> = { swarm: 1, charger: 3, ranged: 4, tank: 8, disabler: 7, flanker: 5 };
    const spent = Object.entries(composition).reduce((sum, [role, count]) => sum + costs[role] * count, 0);
    expect(spent).toBeLessThanOrEqual(90); // calculateThreatBudget(3, 2, 2)
  });

  it("paces the queued enemies instead of spawning all at wave start", () => {
    let state = createInitialState("pace", [1]);
    state.waveDurationTicks = 30;
    const rng = new SeededRandom(state.seed);
    state = step(state, [], { rng }).state;
    const firstCount = Object.values(state.entities).filter((e) => e.kind === "enemy").length;
    for (let i = 0; i < 5; i++) state = step(state, [], { rng }).state;
    const laterCount = Object.values(state.entities).filter((e) => e.kind === "enemy").length;
    expect(firstCount).toBe(1);
    expect(laterCount).toBeGreaterThan(firstCount);
  });

  it("places a safe static shop deterministically", () => {
    const a = createInitialState("shop", [1, 2]);
    const b = structuredClone(a);
    const eventsA: any[] = []; const eventsB: any[] = [];
    placeShop(a, new SeededRandom("shop"), eventsA);
    placeShop(b, new SeededRandom("shop"), eventsB);
    expect(a.shop.currentNodeId).toBe(b.shop.currentNodeId);
    expect(eventsA.map((e) => e.type)).toEqual(["shopTelegraphStarted", "shopOpened"]);
    const node = a.mapNodes[a.shop.currentNodeId!];
    expect(node.kind).toBe("shop");
    expect(a.shop.accessible).toBe(true);
  });
});
