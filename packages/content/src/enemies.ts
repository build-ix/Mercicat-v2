import type { EnemyDefinition } from "./index.js";

export type EnemyRole = "swarm" | "charger" | "ranged" | "tank" | "disabler" | "flanker";
export interface EnemyRoleDefinition extends EnemyDefinition {
  role: EnemyRole;
  threatCost: number;
  unlockWave: number;
  elite: boolean;
  spawnWeight: number;
  minSpawnIntervalTicks: number;
  counters: readonly string[];
  tags: readonly string[];
}

export const ENEMY_ROLES: Record<EnemyRole, EnemyRoleDefinition> = {
  swarm: { id: "enemy_swarm", name: "Swarm", role: "swarm", threatCost: 1, unlockWave: 1, elite: false, spawnWeight: 1, minSpawnIntervalTicks: 3, counters: ["area_damage", "kiting"], tags: ["fodder", "melee"], health: 10, speed: 1.8, damage: 5, attackCooldown: 0.8 },
  charger: { id: "enemy_charger", name: "Charger", role: "charger", threatCost: 3, unlockWave: 1, elite: false, spawnWeight: 0.8, minSpawnIntervalTicks: 8, counters: ["dodge", "interrupt"], tags: ["melee", "medium"], health: 25, speed: 2.2, damage: 15, attackCooldown: 1.5 },
  ranged: { id: "enemy_ranged", name: "Ranged", role: "ranged", threatCost: 4, unlockWave: 1, elite: false, spawnWeight: 0.7, minSpawnIntervalTicks: 10, counters: ["cover", "target_priority"], tags: ["ranged", "medium"], health: 18, speed: 1.2, damage: 8, attackCooldown: 1, },
  tank: { id: "enemy_tank", name: "Tank", role: "tank", threatCost: 8, unlockWave: 2, elite: false, spawnWeight: 0.5, minSpawnIntervalTicks: 12, counters: ["sustained_damage", "armor_pierce"], tags: ["armor", "heavy"], health: 60, speed: 0.8, damage: 20, attackCooldown: 2 },
  disabler: { id: "enemy_disabler", name: "Disabler", role: "disabler", threatCost: 7, unlockWave: 3, elite: false, spawnWeight: 0.6, minSpawnIntervalTicks: 15, counters: ["cleanse", "focus_fire"], tags: ["special", "disable"], health: 22, speed: 1.4, damage: 10, attackCooldown: 2.5 },
  flanker: { id: "enemy_flanker", name: "Flanker", role: "flanker", threatCost: 5, unlockWave: 2, elite: false, spawnWeight: 0.7, minSpawnIntervalTicks: 9, counters: ["perimeter_awareness", "positioning"], tags: ["fast", "flanking"], health: 15, speed: 2.5, damage: 8, attackCooldown: 0.9 }
};
