import type { Difficulty } from "@mercicat/shared";
export interface WaveCompositionRules { wave: number; difficulty: Difficulty; eliteCap: number; disablerCap: number; flankChance: number; threatBudgetFormula: (playerCount: number) => number; maxActiveEnemies: (playerCount: number, wave: number) => number; spawnIntervalTicks: (playerCount: number, wave: number) => number; }
const players = (n: number) => Math.max(2, Math.min(4, n));
export function calculateThreatBudget(wave: number, playerCount: number, difficulty: Difficulty): number { const baseBudget = 20 + (wave - 1) * 12; return Math.round(baseBudget * (1 + 0.35 * (Math.max(1, playerCount) - 1)) * (1 + 0.10 * Math.max(0, difficulty - 1))); }
export const BUDGET_MULTIPLIERS = [1.00, 0.90, 0.85, 0.80] as const;
export function calculateCalibratedThreatBudget(wave: number, playerCount: number, difficulty: Difficulty, multiplier = 1): number { return Math.max(1, Math.round(calculateThreatBudget(wave, playerCount, difficulty) * multiplier)); }
export function getMaxActiveEnemies(playerCount: number, wave: number): number { return 8 + players(playerCount) * 4 + wave; }
export function getSpawnIntervalTicks(playerCount: number, wave: number): number { return Math.max(6, 24 - players(playerCount) * 2 - Math.floor(wave / 3)); }
export function getEliteChance(playerCount: number, wave: number): number { return Math.min(0.20, Math.max(0, 0.03 + wave * 0.02 + (players(playerCount) - 2) * 0.015)); }
export function getDisablerChance(playerCount: number, wave: number): number { return Math.min(0.12, Math.max(0, 0.04 + wave * 0.01 + (players(playerCount) - 2) * 0.01)); }
export function getFlankChance(playerCount: number, wave: number): number { return Math.min(0.30, Math.max(0.10, 0.10 + players(playerCount) * 0.03 + wave * 0.01)); }

export type DifficultyMode = "adventure" | "endless";
export interface ScaledEnemyStats { healthMultiplier: number; damageMultiplier: number; speedMultiplier: number; cooldownMultiplier: number; }
export function difficultyMode(difficulty: Difficulty): DifficultyMode { return difficulty >= 3 ? "endless" : "adventure"; }
const clampWave = (wave: number) => Math.max(1, wave);
const clampPlayers = (count: number) => Math.max(2, Math.min(4, count));
/** Fable 5 contract: sub-linear player scaling, with a stronger Endless tail. */
export function getEnemyScaling(wave: number, playerCount: number, difficulty: Difficulty): ScaledEnemyStats {
  const w = clampWave(wave); const p = clampPlayers(playerCount); const endless = difficultyMode(difficulty) === "endless";
  const player = 1 + (p - 2) * (endless ? 0.10 : 0.09);
  const progress = endless ? 1 + 0.035 * Math.pow(w - 1, 1.08) : 1 + 0.025 * (w - 1);
  const tier = 1 + Math.max(0, difficulty - 1) * (endless ? 0.025 : 0.02);
  return { healthMultiplier: Math.min(3.25, player * progress * tier), damageMultiplier: Math.min(2.05, (1 + (p - 2) * (endless ? 0.075 : 0.06)) * (endless ? 1 + 0.022 * (w - 1) : 1 + 0.015 * (w - 1)) * tier), speedMultiplier: Math.min(1.35, 1 + (p - 2) * 0.025 + (endless ? 0.006 : 0.004) * (w - 1)), cooldownMultiplier: Math.max(0.80, 1 - (p - 2) * 0.025 - (endless ? 0.004 : 0.003) * (w - 1)) };
}
export function calculateScaledThreatBudget(wave: number, playerCount: number, mode: DifficultyMode): number {
  const w = clampWave(wave); const p = clampPlayers(playerCount);
  const base = mode === "endless" ? 24 * Math.pow(1.14, w - 1) : 20 + (w - 1) * 12;
  return Math.max(1, Math.round(base * (1 + (p - 2) * 0.35)));
}
