/** Contract for a data-driven enemy definition. This module intentionally has no imports. */
export interface EnemyDefinition {
  id: string;
  name: string;
  maxHealth?: number;
  speed: number;
  radius?: number;
  attack?: string;
  xpReward?: number;
  /** Phase 3B role stats. */
  health: number;
  damage: number;
  attackCooldown: number;
}
