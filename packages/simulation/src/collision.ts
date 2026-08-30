import type { EntityId, GameState, ProjectileEntity } from "@mercicat/shared";
import { processCollisions } from "./systems/collisionSystem.js";
export interface Hit { projectileId: EntityId; enemyId: EntityId; position: {x:number;y:number}; damage:number; }
export function detectProjectileHits(state: GameState): Hit[] { const hits:Hit[]=[]; const ps=Object.values(state.entities).filter((e):e is ProjectileEntity=>e.kind==="projectile"&&e.lifecycle==="active").sort((a,b)=>a.id-b.id); const es=Object.values(state.entities).filter(e=>e.kind==="enemy"&&e.lifecycle==="active").sort((a,b)=>a.id-b.id); for(const p of ps) for(const e of es){const dx=p.position.x-e.position.x,dy=p.position.y-e.position.y,r=p.radius+e.radius;if(dx*dx+dy*dy<=r*r){hits.push({projectileId:p.id,enemyId:e.id,position:{x:p.position.x,y:p.position.y},damage:p.damage});break;}} return hits; }
export { processCollisions };
