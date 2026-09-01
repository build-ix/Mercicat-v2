import type { Difficulty, EnemyRole, EnemyEntity, GameState, InputCommand, PlayerEntity } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES, getMaxActiveEnemies } from "@mercicat/content";
import { createInitialState } from "./createInitialState.js";
import { step } from "./step.js";
import { MAX_WAVES } from "./waves.js";
import { TICKS_PER_SECOND } from "./wavePhase.js";

export const BALANCE_SCHEMA_VERSION = "3B.3";
export const SWEEP_SEEDS = [101,211,307,401,503,601,701,809,907,1009,1103,1201,1301,1409,1511,1601,1709,1801,1901,2003,2203,2309,2411,2503] as const;
export const ROLES: readonly EnemyRole[] = ["swarm", "charger", "ranged", "tank", "disabler", "flanker"];
type Mode = "adventure" | "endless";
type Result = "survived" | "wiped" | "timed_out";

export interface BalanceWaveTelemetry {
  runId: string; wave: number; mode: Mode; difficulty: Difficulty; playerCount: 2 | 3 | 4; seed: number | string;
  startTick: number; endTick: number; waveDurationSeconds: number; result: Result;
  threatBudget: number; threatSpent: number; threatUnspent: number; spawned: number; defeated: number; remainingAtEnd: number;
  roleCounts: Record<EnemyRole, number>; roleThreat: Record<string, number>; roleDamageTaken: Record<string, number>;
  combatClearTimeSeconds: number | null; completionTimeSeconds: number; damageTakenTotal: number;
  damageTakenByPlayer: Record<string, number>; healthLostPercentByPlayer: Record<string, number>;
  downedPlayers: number; deaths: number; peakConcurrentEnemies: number; peakConcurrentByRole: Record<string, number>;
  enemySecondsByRole: Record<string, number>; playerDamageDealt: number; playerDps: number;
  compositionExpected: Record<string, number>; unusedBudgetReason: "none" | "role-cap" | "unlock-gate" | "spawn-time" | "other";
  stateHashAtEnd: string; balanceLabel: "trivial" | "viable" | "pressured" | "punishing"; outliers: string[];
}
export interface BalanceRunTelemetry { schemaVersion: string; buildId: string; runId: string; seed: number | string; mode: Mode; difficulty: Difficulty; playerCount: 2 | 3 | 4; mapId: string; weaponLoadout: string; wavesReached: number; totalDeaths: number; wipeWave: number | null; totalDamageTaken: number; medianClearTimeSeconds: number | null; p95ClearTimeSeconds: number | null; threatUtilizationMedian: number; damageDistribution: { median: number; p95: number }; finalStateHash: string; rngVersion: string; waves: BalanceWaveTelemetry[]; replay: { commands: InputCommand[]; stateHashes: string[] } }
export interface BalanceSweepReport { schemaVersion: string; generatedAt: string; runs: BalanceRunTelemetry[]; cells: Array<{ mode: Mode; playerCount: number; wave: number; label: string; outliers: string[] }>; confidenceGate: { status: "pass" | "fail"; reasons: string[] } }

const emptyRoles = (): Record<EnemyRole, number> => Object.fromEntries(ROLES.map(r => [r, 0])) as Record<EnemyRole, number>;
const percentile = (values: number[], p: number): number | null => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]; };
const median = (values: number[]): number | null => percentile(values, 0.5);
const modeDifficulty = (mode: Mode): Difficulty => mode === "endless" ? 3 : 2;

function commandsFor(state: GameState): InputCommand[] {
  const enemies = Object.values(state.entities).filter(e => e.kind === "enemy" && e.lifecycle === "active");
  return Object.keys(state.players).map(Number).sort((a, b) => a - b).flatMap(playerId => {
    const player = state.entities[state.players[playerId]];
    const target = enemies.reduce<{ x: number; y: number } | null>((best, e) => {
      if (!best) return e.position; const d = (e.position.x - player.position.x) ** 2 + (e.position.y - player.position.y) ** 2;
      const bd = (best.x - player.position.x) ** 2 + (best.y - player.position.y) ** 2; return d < bd ? e.position : best;
    }, null);
    const dx = target ? target.x - player.position.x : 1, dy = target ? target.y - player.position.y : 0;
    const length = Math.hypot(dx, dy) || 1;
    return [{ type: "move", tick: state.tick, playerId, moveX: target ? -dx / length : (state.tick % 60 < 30 ? 1 : -1), moveY: target ? -dy / length : 0 }, { type: "fire", tick: state.tick, playerId, aimX: dx / length, aimY: dy / length }];
  });
}

export function runBalanceSweepRun(playerCount: 2 | 3 | 4, mode: Mode, seed: number | string, buildId = "local", budgetMultiplier = 0.90): BalanceRunTelemetry {
  const difficulty = modeDifficulty(mode), runId = `${mode}-${playerCount}p-${String(seed)}`;
  let state = createInitialState(seed, Array.from({ length: playerCount }, (_, i) => i + 1));
  state.difficulty = difficulty; state.wave.totalWaves = MAX_WAVES;
  const rng = new SeededRandom(seed), waves: BalanceWaveTelemetry[] = [], commands: InputCommand[] = [], stateHashes: string[] = [];
  const rolesByEntity = new Map<number, EnemyRole>(); const spawnedByWave = new Map<number, Record<EnemyRole, number>>(); const damageByWave = new Map<number, { total: number; byPlayer: Record<string, number>; byRole: Record<string, number>; dealt: number }>();
  const starts = new Map<number, number>(), firstSpawn = new Map<number, number>(), lastDeath = new Map<number, number>();
  const expectedByWave = new Map<number, Record<string, number>>();
  const peaks = new Map<number, { total: number; roles: Record<string, number> }>(); let totalDeaths = 0; let safety = 0;
  while (state.phase !== "victory" && state.phase !== "defeat" && safety++ < 200000) {
    const wave = state.wave.currentWave, frame = commandsFor(state); commands.push(...frame);
    const beforePlayers = new Map(Object.entries(state.players).map(([id, eid]) => [Number(id), state.entities[eid].health]));
    const result = step(state, frame, { rng, allPlayersReady: true, budgetMultiplier }); state = result.state; stateHashes.push(result.stateHash);
    const events = result.events; if (!starts.has(wave)) starts.set(wave, state.tick - 1);
    const damage = damageByWave.get(wave) ?? { total: 0, byPlayer: {}, byRole: {}, dealt: 0 }; const peak = peaks.get(wave) ?? { total: 0, roles: {} };
    for (const e of events) {
      if (e.type === "entitySpawned" && e.kind === "enemy" && e.role) { const eventWave = e.wave ?? wave; rolesByEntity.set(e.entityId, e.role); const observed = spawnedByWave.get(eventWave) ?? emptyRoles(); observed[e.role]++; spawnedByWave.set(eventWave, observed); if (!firstSpawn.has(eventWave)) firstSpawn.set(eventWave, e.tick); }
      if (e.type === "roleCompositionSelected") expectedByWave.set(e.wave, { ...e.composition });
      if (e.type === "entityDamaged") {
        const target = state.entities[e.targetId]; if (target?.kind === "player") { const player = target as PlayerEntity; damage.total += e.amount; damage.byPlayer[String(player.playerId)] = (damage.byPlayer[String(player.playerId)] ?? 0) + e.amount; const role = rolesByEntity.get(e.sourceId ?? -1) ?? "unknown"; damage.byRole[role] = (damage.byRole[role] ?? 0) + e.amount; }
        if (target?.kind === "enemy") damage.dealt += e.amount;
      }
      if (e.type === "entityDespawned" && e.role) { rolesByEntity.set(e.entityId, e.role); }
      if (e.type === "entityDespawned" && e.reason === "dead" && (e.role || rolesByEntity.has(e.entityId))) { lastDeath.set(wave, e.tick); }
      if (e.type === "matchDefeated") { totalDeaths += Object.values(state.entities).filter(e => e.kind === "player" && e.health <= 0).length; }
    }
    const active = Object.values(state.entities).filter(e => e.kind === "enemy" && e.lifecycle === "active") as EnemyEntity[]; peak.total = Math.max(peak.total, active.length); for (const e of active) peak.roles[e.enemyType] = Math.max(peak.roles[e.enemyType] ?? 0, active.filter(x => x.enemyType === e.enemyType).length); peaks.set(wave, peak); damageByWave.set(wave, damage);
    if (events.some(e => e.type === "waveCompleted")) {
      const roleCounts = spawnedByWave.get(wave) ?? emptyRoles();
      const expected = expectedByWave.get(wave) ?? {};
      const byPlayer: Record<string, number> = {}; for (const id of Object.keys(state.players)) byPlayer[id] = damage.byPlayer[id] ?? 0;
      const clear = lastDeath.has(wave) && firstSpawn.has(wave) ? (lastDeath.get(wave)! - firstSpawn.get(wave)!) / TICKS_PER_SECOND : null;
      const completion = (state.waveTimerTicks || state.tick - (starts.get(wave) ?? state.tick)) / TICKS_PER_SECOND; const util = state.spawnDirector.threatBudget ? state.spawnDirector.threatSpent / state.spawnDirector.threatBudget : 0;
      const norm = damage.total / (100 * playerCount), label = norm < .10 && (clear ?? Infinity) < 0.8 ? "trivial" : norm <= .30 && (clear === null || clear <= 1.25 * Math.max(1, completion)) ? "viable" : norm <= .55 && clear !== null && clear <= 1.6 * Math.max(1, completion) ? "pressured" : "punishing";
      const expectedCost = Object.entries(expected).reduce((n, [r, c]) => n + c * (ENEMY_ROLES[r as EnemyRole]?.threatCost ?? 0), 0); const actualCost = Object.entries(roleCounts).reduce((n, [r, c]) => n + c * (ENEMY_ROLES[r as EnemyRole]?.threatCost ?? 0), 0);
      const spawnTimeLimited = state.spawnDirector.spawnCursor < Object.values(expected).reduce((n, c) => n + c, 0);
      const expectedSlots = Object.values(expected).reduce((n, c) => n + c, 0);
      const compositionMismatch = ROLES.some(role => (expected[role] ?? 0) !== roleCounts[role]);
      const outliers: string[] = []; if (util < .85 && !spawnTimeLimited) outliers.push("threat-utilization-below-median-band"); if (compositionMismatch && !spawnTimeLimited) outliers.push("composition-observation-mismatch"); if (active.length > getMaxActiveEnemies(playerCount, wave)) outliers.push("active-enemy-cap"); if (label === "punishing") outliers.push("metric-out-of-band");
      const unusedBudgetReason = spawnTimeLimited ? "spawn-time" : (state.spawnDirector.compositionSelectionReason ?? (util >= .999 ? "none" : "other"));
      const roleThreat: Record<string, number> = {}; for (const r of ROLES) roleThreat[r] = roleCounts[r] * (ENEMY_ROLES[r]?.threatCost ?? 0);
      const healthLost: Record<string, number> = {}; for (const [id, hp] of beforePlayers) healthLost[id] = Math.max(0, 100 - hp) / 100;
      waves.push({ runId, wave, mode, difficulty, playerCount, seed, startTick: starts.get(wave) ?? 0, endTick: state.tick, waveDurationSeconds: state.waveDurationTicks / TICKS_PER_SECOND, result: state.phase === "defeat" ? "wiped" : "survived", threatBudget: state.spawnDirector.threatBudget, threatSpent: state.spawnDirector.threatSpent, threatUnspent: Math.max(0, state.spawnDirector.threatBudget - state.spawnDirector.threatSpent), spawned: state.wave.spawnedForWave, defeated: state.wave.defeatedForWave, remainingAtEnd: 0, roleCounts, roleThreat, roleDamageTaken: damage.byRole, combatClearTimeSeconds: clear, completionTimeSeconds: completion, damageTakenTotal: damage.total, damageTakenByPlayer: byPlayer, healthLostPercentByPlayer: healthLost, downedPlayers: Object.values(state.entities).filter(e => e.kind === "player" && e.health <= 0).length, deaths: totalDeaths, peakConcurrentEnemies: peak.total, peakConcurrentByRole: peak.roles, enemySecondsByRole: {}, playerDamageDealt: damage.dealt, playerDps: damage.dealt / Math.max(completion, 1 / TICKS_PER_SECOND), compositionExpected: expected, unusedBudgetReason, stateHashAtEnd: result.stateHash, balanceLabel: label, outliers });
    }
  }
  const clears = waves.flatMap(w => w.combatClearTimeSeconds === null ? [] : [w.combatClearTimeSeconds]); const damages = waves.map(w => w.damageTakenTotal / (100 * playerCount));
  return { schemaVersion: BALANCE_SCHEMA_VERSION, buildId, runId, seed, mode, difficulty, playerCount, mapId: "default", weaponLoadout: "scripted-pistol", wavesReached: waves.length, totalDeaths, wipeWave: waves.find(w => w.result === "wiped")?.wave ?? null, totalDamageTaken: waves.reduce((n, w) => n + w.damageTakenTotal, 0), medianClearTimeSeconds: median(clears), p95ClearTimeSeconds: percentile(clears, .95), threatUtilizationMedian: median(waves.map(w => w.threatBudget ? w.threatSpent / w.threatBudget : 0)) ?? 0, damageDistribution: { median: median(damages) ?? 0, p95: percentile(damages, .95) ?? 0 }, finalStateHash: stateHashes[stateHashes.length - 1] ?? "", rngVersion: "mulberry32-v1", waves, replay: { commands, stateHashes } };
}

export function runBalanceSweep(buildId = "local"): BalanceSweepReport {
  const runs: BalanceRunTelemetry[] = []; for (const mode of ["adventure", "endless"] as const) for (const players of [2, 3, 4] as const) for (const seed of SWEEP_SEEDS) runs.push(runBalanceSweepRun(players, mode, seed, buildId));
  const cells = runs.flatMap(r => r.waves.map(w => ({ mode: r.mode, playerCount: r.playerCount, wave: w.wave, label: w.balanceLabel, outliers: w.outliers })));
  const reasons = cells.flatMap(c => c.outliers.map(o => `${c.mode}/${c.playerCount}p/wave${c.wave}: ${o}`));
  return { schemaVersion: BALANCE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), runs, cells, confidenceGate: { status: reasons.length ? "fail" : "pass", reasons } };
}

export function reportCsv(report: BalanceSweepReport): string { const head = "runId,mode,playerCount,wave,result,threatBudget,threatSpent,damageTakenTotal,combatClearTimeSeconds,peakConcurrentEnemies,balanceLabel,outliers,stateHashAtEnd"; const rows = report.runs.flatMap(r => r.waves.map(w => [w.runId,w.mode,w.playerCount,w.wave,w.result,w.threatBudget,w.threatSpent,w.damageTakenTotal,w.combatClearTimeSeconds ?? "",w.peakConcurrentEnemies,w.balanceLabel,w.outliers.join("|"),w.stateHashAtEnd].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))); return [head, ...rows].join("\n") + "\n"; }
