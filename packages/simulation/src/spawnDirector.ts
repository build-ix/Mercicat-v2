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

/** Select a stable, affordable composition whose total cost never exceeds the budget.
 * Supports multiple role groups to allow high-budget waves to fill meaningful role counts
 * while maintaining the 2-per-role-per-group diversity invariant.
 */
export function selectEnemyComposition(wave: number, playerCount: number, difficulty: Difficulty, rng: SeededRandom, budgetMultiplier = 1): Record<EnemyRole, number> {
  let remaining = Math.max(1, Math.round(calculateThreatBudget(wave, playerCount, difficulty) * budgetMultiplier));
  const allRoles = (Object.keys(ENEMY_ROLES) as EnemyRole[])
    .filter((role) => ENEMY_ROLES[role].unlockWave <= wave).sort();

  const composition: Partial<Record<EnemyRole, number>> = {};
  const maxPerRolePerGroup = 2;
  let groupCount = 0;

  // Build role groups until budget is exhausted.
  // Each group is independent: the 2-per-role cap applies within each group.
  while (remaining > 0) {
    groupCount += 1;

    // For each group, start with two distinct roles when possible.
    // Shuffle to avoid deterministic pairing.
    const groupRoles = [...allRoles];
    for (let i = groupRoles.length - 1; i > 0; i -= 1) {
      const j = rng.nextInt(0, i);
      [groupRoles[i], groupRoles[j]] = [groupRoles[j], groupRoles[i]];
    }

    const groupComposition: Partial<Record<EnemyRole, number>> = {};
    const affordablePairs: Array<[EnemyRole, EnemyRole]> = [];

    // Find all affordable pairs for this group
    for (let i = 0; i < groupRoles.length; i += 1) {
      for (let j = i + 1; j < groupRoles.length; j += 1) {
        if (ENEMY_ROLES[groupRoles[i]].threatCost + ENEMY_ROLES[groupRoles[j]].threatCost <= remaining) {
          affordablePairs.push([groupRoles[i], groupRoles[j]]);
        }
      }
    }

    // Start the group with a pair if available
    let groupRemaining = remaining;
    if (affordablePairs.length > 0) {
      const [first, second] = affordablePairs[rng.nextInt(0, affordablePairs.length - 1)];
      groupComposition[first] = 1;
      groupComposition[second] = 1;
      groupRemaining -= ENEMY_ROLES[first].threatCost + ENEMY_ROLES[second].threatCost;
    }

    // Fill the group using weighted selection
    while (groupRemaining > 0) {
      const affordable = groupRoles.filter(
        (role) => ENEMY_ROLES[role].threatCost <= groupRemaining && (groupComposition[role] ?? 0) < maxPerRolePerGroup
      );
      if (!affordable.length) break;

      const totalWeight = affordable.reduce((sum, role) => sum + ENEMY_ROLES[role].spawnWeight, 0);
      let roll = rng.nextFloat() * totalWeight;
      let selected = affordable[affordable.length - 1];
      for (const role of affordable) {
        roll -= ENEMY_ROLES[role].spawnWeight;
        if (roll < 0) { selected = role; break; }
      }

      groupRemaining -= ENEMY_ROLES[selected].threatCost;
      groupComposition[selected] = (groupComposition[selected] ?? 0) + 1;
    }

    // Merge group into overall composition
    const groupSpent = Object.entries(groupComposition).reduce(
      (sum, [role, count]) => sum + ENEMY_ROLES[role as EnemyRole].threatCost * count,
      0
    );
    remaining -= groupSpent;

    for (const role of allRoles) {
      if (groupComposition[role]) {
        composition[role] = (composition[role] ?? 0) + groupComposition[role];
      }
    }

    // Avoid infinite loops: if we spent less than the minimum role cost, stop
    if (groupSpent === 0) break;
  }

  return Object.fromEntries(Object.keys(composition).sort()
    .map((role) => [role, composition[role as EnemyRole]])) as Record<EnemyRole, number>;
}
