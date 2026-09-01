import type { Difficulty } from "@mercicat/shared";
export interface WaveCompositionRules { wave: number; difficulty: Difficulty; eliteCap: number; disablerCap: number; flankChance: number; threatBudgetFormula: (playerCount: number) => number; maxActiveEnemies: (playerCount: number, wave: number) => number; spawnIntervalTicks: (playerCount: number, wave: number) => number; }
const players = (n: number) => Math.max(2, Math.min(4, n));
export function calculateThreatBudget(wave: number, playerCount: number, difficulty: Difficulty): number { const baseBudget = 20 + (wave - 1) * 12; return Math.round(baseBudget * (1 + 0.35 * (Math.max(1, playerCount) - 1)) * (1 + 0.10 * Math.max(0, difficulty - 1))); }
export function getMaxActiveEnemies(playerCount: number, wave: number): number { return 8 + players(playerCount) * 4 + wave; }
export function getSpawnIntervalTicks(playerCount: number, wave: number): number { return Math.max(6, 24 - players(playerCount) * 2 - Math.floor(wave / 3)); }
export function getEliteChance(playerCount: number, wave: number): number { return Math.min(0.20, Math.max(0, 0.03 + wave * 0.02 + (players(playerCount) - 2) * 0.015)); }
export function getDisablerChance(playerCount: number, wave: number): number { return Math.min(0.12, Math.max(0, 0.04 + wave * 0.01 + (players(playerCount) - 2) * 0.01)); }
export function getFlankChance(playerCount: number, wave: number): number { return Math.min(0.30, Math.max(0.10, 0.10 + players(playerCount) * 0.03 + wave * 0.01)); }
