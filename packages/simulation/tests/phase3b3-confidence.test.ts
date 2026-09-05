import { describe, expect, it } from "vitest";
import { ENEMY_ROLES, calculateThreatBudget } from "@mercicat/content";
import type { Difficulty, EnemyRole } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { selectEnemyComposition } from "../src/index.js";

function select(seed: number | string, wave = 1, players = 2, difficulty: Difficulty = 2, budgetMultiplier = 1) {
  return selectEnemyComposition(wave, players, difficulty, new SeededRandom(seed), budgetMultiplier);
}

function spent(composition: Record<EnemyRole, number>): number {
  return Object.entries(composition).reduce((sum, [role, count]) => sum + ENEMY_ROLES[role as EnemyRole].threatCost * count, 0);
}

function utilization(spent_val: number, budget: number): number {
  return budget > 0 ? spent_val / budget : 0;
}

describe("Phase 3B.3 confidence run (20+ seeds per cell)", () => {
  it("achieves target utilization across all cells and waves (confidence set)", () => {
    // Generate 24 independent seeds per cell (production standard per diagnostic)
    // Test all 6 cells × 5 calibration waves = 30 wave/cell combinations
    // Total: 24 × 30 = 720 test points
    
    const calibrationCells = [
      { name: "Adventure 2p", players: 2, difficulty: 1 as Difficulty },
      { name: "Adventure 3p", players: 3, difficulty: 1 as Difficulty },
      { name: "Adventure 4p", players: 4, difficulty: 1 as Difficulty },
      { name: "Endless 2p", players: 2, difficulty: 3 as Difficulty },
      { name: "Endless 3p", players: 3, difficulty: 3 as Difficulty },
      { name: "Endless 4p", players: 4, difficulty: 3 as Difficulty },
    ];

    const calibrationWaves = [1, 5, 10, 15, 20];
    const seedCount = 20; // Minimum from diagnostic (24 preferred)

    // Generate seeds for this run
    const seeds = Array.from({ length: seedCount }, (_, i) => `confidence-${i + 1}`);

    const results: Array<{
      cell: string;
      median: number;
      p95: number;
      min: number;
      max: number;
    }> = [];

    for (const cell of calibrationCells) {
      const utilizations: number[] = [];
      let passCount = 0;
      let failCount = 0;

      for (const wave of calibrationWaves) {
        for (const seed of seeds) {
          const composition = select(seed, wave, cell.players, cell.difficulty);
          const budget = calculateThreatBudget(wave, cell.players, cell.difficulty);
          const spent_val = spent(composition);
          const util = utilization(spent_val, budget);
          utilizations.push(util);

          // Check diagnostic thresholds
          if (util >= 0.85) {
            passCount += 1;
          } else {
            failCount += 1;
          }
        }
      }

      const sorted = utilizations.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      results.push({ cell: cell.name, median, p95, min, max });

      console.log(
        `${cell.name}: median=${median.toFixed(3)}, p95=${p95.toFixed(3)}, ` +
        `range=[${min.toFixed(3)}, ${max.toFixed(3)}], pass=${passCount}/${passCount + failCount}`
      );

      // Per diagnostic: median 0.85-1.00, p95 >= 0.75
      expect(median).toBeGreaterThanOrEqual(0.85);
      expect(median).toBeLessThanOrEqual(1.00);
      expect(p95).toBeGreaterThanOrEqual(0.75);
    }

    // Summary
    console.log("\n=== CONFIDENCE RUN SUMMARY ===");
    console.log(`Seeds per cell: ${seedCount}`);
    console.log(`Waves per seed: ${calibrationWaves.length}`);
    console.log(`Total cells: ${calibrationCells.length}`);
    console.log(`Total observations: ${seedCount * calibrationWaves.length * calibrationCells.length}`);
    
    const allMedians = results.map(r => r.median);
    const overallMedian = allMedians.sort((a, b) => a - b)[Math.floor(allMedians.length / 2)];
    console.log(`Overall median utilization: ${overallMedian.toFixed(3)}`);
    console.log("Status: ✓ PASS");
  });

  it("maintains budget discipline across the full seed matrix", () => {
    // Verify no budget overages across the full confidence set
    const calibrationCells = [
      { name: "Adventure 2p", players: 2, difficulty: 1 as Difficulty },
      { name: "Adventure 3p", players: 3, difficulty: 1 as Difficulty },
      { name: "Adventure 4p", players: 4, difficulty: 1 as Difficulty },
      { name: "Endless 2p", players: 2, difficulty: 3 as Difficulty },
      { name: "Endless 3p", players: 3, difficulty: 3 as Difficulty },
      { name: "Endless 4p", players: 4, difficulty: 3 as Difficulty },
    ];

    const calibrationWaves = [1, 5, 10, 15, 20];
    const seedCount = 20;
    const seeds = Array.from({ length: seedCount }, (_, i) => `budget-${i + 1}`);

    let overageCount = 0;
    let totalCount = 0;

    for (const cell of calibrationCells) {
      for (const wave of calibrationWaves) {
        for (const seed of seeds) {
          const composition = select(seed, wave, cell.players, cell.difficulty);
          const budget = calculateThreatBudget(wave, cell.players, cell.difficulty);
          const spent_val = spent(composition);
          totalCount += 1;

          if (spent_val > budget) {
            overageCount += 1;
            console.log(
              `OVERAGE: ${cell.name} wave ${wave} seed ${seed} spent ${spent_val} > ${budget}`
            );
          }
        }
      }
    }

    console.log(`Budget check: ${totalCount} observations, ${overageCount} overages`);
    expect(overageCount).toBe(0);
  });
});
