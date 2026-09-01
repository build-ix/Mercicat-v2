import type { GameState, EnemyRole, SimulationEvent, Difficulty } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES, calculateThreatBudget } from "@mercicat/content";

/** Phase 3B.0 contract stub; authoritative pacing is implemented in 3B.1. */
export function advanceSpawnDirector(state: GameState, _rng: SeededRandom, _events: SimulationEvent[]): void {
  state.spawnDirector.elapsedTicks += 1;
}
export function selectEnemyComposition(wave: number, playerCount: number, difficulty: Difficulty, rng: SeededRandom): Record<EnemyRole, number> {
  let remaining = calculateThreatBudget(wave, playerCount, difficulty);
  const roles = (Object.keys(ENEMY_ROLES) as EnemyRole[]).filter((role) => ENEMY_ROLES[role].unlockWave <= wave).sort();
  const composition: Partial<Record<EnemyRole, number>> = {};
  while (remaining > 0) {
    const affordable = roles.filter((role) => ENEMY_ROLES[role].threatCost <= remaining);
    if (affordable.length === 0) break;
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
  return Object.fromEntries(Object.keys(composition).sort().map((role) => [role, composition[role as EnemyRole]])) as Record<EnemyRole, number>;
}
