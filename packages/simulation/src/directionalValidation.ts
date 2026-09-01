import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runBalanceSweepRun, type BalanceRunTelemetry, type BalanceWaveTelemetry } from "./balanceSweep.js";
export const VALIDATION_SEEDS = [101, 211] as const;
export const BUDGET_MULTIPLIERS = [1, 0.9, 0.85, 0.8] as const;
type Cell = { mode: "adventure" | "endless"; playerCount: 2 | 3 | 4 };
const cells: Cell[] = [{ mode: "adventure", playerCount: 2 }, { mode: "adventure", playerCount: 3 }, { mode: "adventure", playerCount: 4 }, { mode: "endless", playerCount: 2 }, { mode: "endless", playerCount: 3 }, { mode: "endless", playerCount: 4 }];
const primary = [cells[0], cells[5]];
const execute = (c: Cell, seed: number, multiplier: number) => runBalanceSweepRun(c.playerCount, c.mode, seed, "phase3b3-directional", multiplier);
function stable(a: BalanceRunTelemetry, b: BalanceRunTelemetry) { return a.finalStateHash === b.finalStateHash && a.waves.map(w => w.stateHashAtEnd).join() === b.waves.map(w => w.stateHashAtEnd).join(); }
export function runDirectionalValidation(outputDir = "artifacts/phase3b3") {
  const calibrations: unknown[] = [];
  for (const multiplier of BUDGET_MULTIPLIERS) for (const cell of cells) { const ws = VALIDATION_SEEDS.flatMap(seed => execute(cell, seed, multiplier).waves); calibrations.push({ multiplier, cell: `${cell.mode}/${cell.playerCount}p`, viable: ws.filter(w => w.balanceLabel === "viable").length, pressured: ws.filter(w => w.balanceLabel === "pressured").length, punishing: ws.filter(w => w.balanceLabel === "punishing").length, utilization: ws.reduce((a, w) => a + w.threatSpent / Math.max(1, w.threatBudget), 0) / ws.length }); }
  const selectedMultiplier = 0.8;
  const primaryRuns = primary.flatMap(c => VALIDATION_SEEDS.map(seed => execute(c, seed, selectedMultiplier)));
  const primaryRecords = primaryRuns.flatMap(r => r.waves);
  const spotRuns = cells.filter(c => !primary.some(p => p.mode === c.mode && p.playerCount === c.playerCount)).flatMap(c => VALIDATION_SEEDS.map(seed => execute(c, seed, selectedMultiplier)));
  const spotRecords = spotRuns.flatMap(r => r.waves.filter(w => [1, 10, 20].includes(w.wave)));
  const allRecords = [...primaryRecords, ...spotRecords];
  const adv = primaryRecords.filter(w => w.mode === "adventure"), endless = primaryRecords.filter(w => w.mode === "endless");
  const checks = { recordCount: allRecords.length === 104, primaryRecordCount: primaryRecords.length === 80, spotRecordCount: spotRecords.length === 24, noCapViolations: allRecords.every(w => !w.outliers.includes("active-enemy-cap")), lateWaveUtilizationAbove15Percent: allRecords.filter(w => w.wave >= 16).every(w => w.threatSpent / Math.max(1, w.threatBudget) > .15), noTimeoutsWipesPunishing: allRecords.every(w => w.result === "survived" && w.balanceLabel !== "punishing"), compositionTelemetry: allRecords.every(w => Object.keys(w.compositionExpected).length > 0 && Object.keys(w.roleCounts).length === 6 && !w.outliers.includes("composition-observation-mismatch")), endlessMorePressuring: endless.reduce((a, w) => a + w.damageTakenTotal, 0) / endless.length > adv.reduce((a, w) => a + w.damageTakenTotal, 0) / adv.length, stableReplayHashes: primaryRuns.every(r => stable(r, execute({ mode: r.mode, playerCount: r.playerCount }, Number(r.seed), selectedMultiplier))) };
  const verdict = Object.values(checks).every(Boolean) ? "PROCEED_TO_PHASE_2" : "ITERATE_PHASE_1";
  const json = { schemaVersion: "3B.3-directional-phase1", selectedMultiplier, calibrations, checks, verdict, records: allRecords };
  const lines = ["# Phase 3B.3 Phase 1 — Directional Validation", "", `Selected budget multiplier: **${selectedMultiplier.toFixed(2)}**`, `Records: **${allRecords.length}** (primary ${primaryRecords.length}, spot-check ${spotRecords.length})`, `Verdict: **${verdict}**`, "", "## Acceptance checks", "", ...Object.entries(checks).map(([k, v]) => `- ${k}: **${v ? "PASS" : "FAIL"}**`)];
  const markdown = lines.join("\n") + "\n";
  mkdirSync(resolve(outputDir), { recursive: true }); writeFileSync(resolve(outputDir, "phase1-directional.json"), JSON.stringify(json, null, 2)); writeFileSync(resolve(outputDir, "phase1-directional.md"), markdown);
  return { json, markdown };
}
if (process.argv[1]?.endsWith("directionalValidation.js")) console.log(runDirectionalValidation(process.env.OUTPUT_DIR ?? "artifacts/phase3b3").markdown);
