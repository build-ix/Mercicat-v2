import type { EnemyEntity, EnemyRole, GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES, getEnemyScaling } from "@mercicat/content";
export const WAVE_COUNTS = [0, 3, 5, 7, 9, 11] as const;
export function enemyCount(wave: number): number { return WAVE_COUNTS[Math.max(1, Math.min(WAVE_COUNTS.length - 1, wave))] ?? 3; }
/** Spawn at most `maxCount` entries from the director's stable role queue. */
export function spawnEnemies(state: GameState, rng: SeededRandom, wave = state.wave.currentWave, events: SimulationEvent[] = [], maxCount = Number.POSITIVE_INFINITY): EnemyEntity[] {
 const composition = state.spawnDirector.activeComposition;
 const roles = Object.keys(composition).sort() as EnemyRole[];
 const queued: string[] = roles.length > 0
   ? roles.flatMap((role) => Array.from({ length: composition[role] ?? 0 }, () => role))
   : Array.from({ length: enemyCount(wave) }, () => "basic");
 const toSpawn = queued.slice(state.spawnDirector.spawnCursor, state.spawnDirector.spawnCursor + Math.max(0, maxCount));
 const result: EnemyEntity[]=[];
 for (const role of toSpawn) {
   const id=state.nextEntityId++; const definition = ENEMY_ROLES[role as EnemyRole];
   const scaling = getEnemyScaling(wave, Object.keys(state.players).length, state.difficulty);
   // Keep the established wave baseline while applying the role's relative
   // profile; this avoids a difficulty jump for legacy/basic fixtures.
   const health=Math.max(1, Math.round((18 + wave * 2) * scaling.healthMultiplier)) + rng.nextInt(-2,2);
   const attackCooldownTicks = Math.max(1, Math.round((definition?.attackCooldown ?? 1) * 60 * scaling.cooldownMultiplier));
   const e:EnemyEntity={id,kind:"enemy",lifecycle:"active",position:{x:rng.nextInt(-400,400),y:rng.nextInt(-300,300)},velocity:{x:0,y:0},radius:16,health,maxHealth:health,spawnTick:state.tick,despawnTick:null,enemyType:role,contactDamage: (definition?.damage ?? 5) * scaling.damageMultiplier,fireCooldownTicks:0,targetPlayerId:null,moveSpeed:(definition?.speed ?? 1) * scaling.speedMultiplier,attackDamage:(definition?.damage ?? 5) * scaling.damageMultiplier,attackCooldownTicks};
   state.entities[id]=e; state.wave.spawnedForWave++; result.push(e); events.push({type:"entitySpawned",tick:state.tick,entityId:id,kind:"enemy",wave,role:role as EnemyRole,threatCost:definition?.threatCost ?? 0});
 }
 state.spawnDirector.spawnCursor += result.length;
 state.spawnDirector.threatSpent += result.reduce((sum, entity) => sum + (ENEMY_ROLES[entity.enemyType as EnemyRole]?.threatCost ?? 0), 0);
 return result;
}
