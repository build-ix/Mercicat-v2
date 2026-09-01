import type { EnemyEntity, EnemyRole, GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES } from "@mercicat/content";
export const WAVE_COUNTS = [0, 3, 5, 7, 9, 11] as const;
export function enemyCount(wave: number): number { return WAVE_COUNTS[Math.max(1, Math.min(5, wave))] ?? 3; }
export function spawnEnemies(state: GameState, rng: SeededRandom, wave = state.wave.currentWave, events: SimulationEvent[] = []): EnemyEntity[] {
 const composition = state.spawnDirector.activeComposition;
 const roles = Object.keys(composition).sort() as EnemyRole[];
 const toSpawn: string[] = roles.length > 0
   ? roles.flatMap((role) => Array.from({ length: composition[role] ?? 0 }, () => role))
   : Array.from({ length: enemyCount(wave) }, () => "basic");
 const result: EnemyEntity[]=[];
 for (const role of toSpawn) {
   const id=state.nextEntityId++; const health=18+wave*2+rng.nextInt(-2,2);
   const e:EnemyEntity={id,kind:"enemy",lifecycle:"active",position:{x:rng.nextInt(-400,400),y:rng.nextInt(-300,300)},velocity:{x:0,y:0},radius:16,health,maxHealth:health,spawnTick:state.tick,despawnTick:null,enemyType:role,contactDamage: 0.1,fireCooldownTicks:0,targetPlayerId:null};
   state.entities[id]=e; state.wave.spawnedForWave++; result.push(e); events.push({type:"entitySpawned",tick:state.tick,entityId:id,kind:"enemy"});
 }
 state.spawnDirector.threatSpent = roles.reduce((sum, role) => sum + (composition[role] ?? 0) * (ENEMY_ROLES[role]?.threatCost ?? 0), 0);
 return result;
}
