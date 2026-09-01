import type { GameState, EnemyRole, SimulationEvent, Difficulty } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES, calculateThreatBudget, getMaxActiveEnemies } from "@mercicat/content";
import { spawnEnemies } from "./enemies.js";

/**
 * Consume one entry from the wave's precomputed threat queue at deterministic
 * wall-clock slots. Composition selection is deliberately separate from
 * pacing: replaying a wave consumes the same RNG in the same order.
 */
export function advanceSpawnDirector(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  state.spawnDirector.elapsedTicks += 1;
  if (state.wavePhase !== "waveActive" || state.phase !== "playing") return;
  const composition = state.spawnDirector.activeComposition;
  const activeEnemies = Object.values(state.entities).filter((entity) => entity.kind === "enemy" && entity.lifecycle === "active").length;
  if (activeEnemies >= getMaxActiveEnemies(Object.keys(state.players).length, state.wave.currentWave)) return;
  const total = Object.values(composition).reduce((sum, count) => sum + count, 0);
  if (total === 0 || state.spawnDirector.spawnCursor >= total) return;
  const duration = Math.max(1, state.waveDurationTicks);
  const cursor = state.spawnDirector.spawnCursor;
  // Use the interval across the transitions between slots; the final slot
  // remains available before the timer transitions out of the wave.
  const scheduledTick = Math.floor(cursor * Math.max(1, duration - 1) / total);
  if (state.spawnDirector.elapsedTicks - 1 < scheduledTick) return;
  state.spawnDirector.nextSpawnTick = state.tick + Math.max(1, Math.ceil(Math.max(1, duration - 1) / total));
  const spawned = spawnEnemies(state, rng, state.wave.currentWave, events, 1);
  if (spawned.length) {
    events.push({ type: "spawnBatchQueued", tick: state.tick, wave: state.wave.currentWave,
      count: spawned.length, roles: spawned.map((enemy) => enemy.enemyType as EnemyRole) });
  }
}

/** Select a stable, affordable composition whose total cost never exceeds the budget. */
export function selectEnemyComposition(wave: number, playerCount: number, difficulty: Difficulty, rng: SeededRandom, budgetMultiplier = 1): Record<EnemyRole, number> {
  let remaining = Math.max(1, Math.round(calculateThreatBudget(wave, playerCount, difficulty) * budgetMultiplier));
  const roles = (Object.keys(ENEMY_ROLES) as EnemyRole[])
    .filter((role) => ENEMY_ROLES[role].unlockWave <= wave).sort();
  // Shuffle candidates with the supplied seeded stream; output serialization
  // remains alphabetically sorted below, while seeds can produce real variety.
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i); [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  const composition: Partial<Record<EnemyRole, number>> = {};
  // Compositions are repeated legal two-member groups. This keeps the
  // per-group max-two invariant while allowing high-budget waves to reach
  // meaningful role counts (up to six).
  const maxPerRole = 2;
  // Seed the queue with two distinct roles whenever the budget can afford such
  // a pair. Without this fallback, the weighted fill below can spend the
  // entire low budget on the same cheap role (or converge to the same capped
  // composition for many seeds). Pair ordering is stable, and the choice is
  // made only through SeededRandom so replay streams remain deterministic.
  const affordablePairs: Array<[EnemyRole, EnemyRole]> = [];
  for (let i = 0; i < roles.length; i += 1) {
    for (let j = i + 1; j < roles.length; j += 1) {
      if (ENEMY_ROLES[roles[i]].threatCost + ENEMY_ROLES[roles[j]].threatCost <= remaining) {
        affordablePairs.push([roles[i], roles[j]]);
      }
    }
  }
  if (affordablePairs.length > 0) {
    const [first, second] = affordablePairs[rng.nextInt(0, affordablePairs.length - 1)];
    composition[first] = 1;
    composition[second] = 1;
    remaining -= ENEMY_ROLES[first].threatCost + ENEMY_ROLES[second].threatCost;
  }
  while (remaining > 0) {
    const groupCounts = roles.reduce((out, role) => { out[role] = (composition[role] ?? 0) % 2; return out; }, {} as Record<EnemyRole, number>);
    const affordable = roles.filter((role) => ENEMY_ROLES[role].threatCost <= remaining && (composition[role] ?? 0) < maxPerRole);
    if (!affordable.length) break;
    const totalWeight = affordable.reduce((sum, role) => sum + ENEMY_ROLES[role].spawnWeight, 0);
    let roll = rng.nextFloat() * totalWeight;
    let selected = affordable[affordable.length - 1];
    for (const role of affordable) {
      roll -= ENEMY_ROLES[role].spawnWeight;
      if (roll < 0) { selected = role; break; }
    }
    remaining -= ENEMY_ROLES[selected].threatCost;
    composition[selected] = (composition[selected] ?? 0) + 1;
  }

  return Object.fromEntries(Object.keys(composition).sort()
    .map((role) => [role, composition[role as EnemyRole]])) as Record<EnemyRole, number>;
}
