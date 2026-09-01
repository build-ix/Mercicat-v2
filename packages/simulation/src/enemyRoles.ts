import type { EnemyRole } from "@mercicat/shared";
import { ENEMY_ROLES, type EnemyRoleDefinition } from "@mercicat/content";
export function getUnlockedEnemyRoles(wave: number): EnemyRoleDefinition[] { return (Object.keys(ENEMY_ROLES) as EnemyRole[]).map(role => ENEMY_ROLES[role]).filter(definition => definition.unlockWave <= wave); }
export { ENEMY_ROLES };
