import type { EnemyEntity, GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
export const WAVE_COUNTS = [0, 3, 5, 7, 9, 11] as const;
export function enemyCount(wave: number): number { return WAVE_COUNTS[Math.max(1, Math.min(5, wave))] ?? 3; }
export function spawnEnemies(state: GameState, rng: SeededRandom, wave = state.wave.currentWave, events: SimulationEvent[] = []): EnemyEntity[] {
 const result: EnemyEntity[]=[]; for(let i=0;i<enemyCount(wave);i++){const id=state.nextEntityId++; const health=18+wave*2+rng.nextInt(-2,2); const e:EnemyEntity={id,kind:"enemy",lifecycle:"active",position:{x:rng.nextInt(-400,400),y:rng.nextInt(-300,300)},velocity:{x:0,y:0},radius:16,health,maxHealth:health,spawnTick:state.tick,despawnTick:null,enemyType:"basic",contactDamage:1,fireCooldownTicks:0,targetPlayerId:null}; state.entities[id]=e; state.wave.spawnedForWave++; result.push(e); events.push({type:"entitySpawned",tick:state.tick,entityId:id,kind:"enemy"});} return result;
}
