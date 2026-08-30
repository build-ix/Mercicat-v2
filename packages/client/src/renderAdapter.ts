import type { EntityId, GameEntity, GameState, PlayerId, Vec2 } from "@mercicat/shared";

export interface RenderEntity { id: EntityId; position: Vec2; health: number; type: string; rotation: number; animationFrame: number; }
export interface RenderContext {
  enemies: RenderEntity[]; projectiles: RenderEntity[]; effects: RenderEntity[]; localPlayer: RenderEntity | null;
  hud: { wave: number; score: number; enemiesRemaining: number; phase: GameState["phase"] };
  /** Compatibility aliases for consumers from Week 3. */ wave: number; score: number;
}
function renderEntity(entity: GameEntity): RenderEntity {
  const type = entity.kind === "enemy" ? (entity as import("@mercicat/shared").EnemyEntity).enemyType : entity.kind;
  const result = { id: entity.id, position: { ...entity.position } as Vec2, health: entity.health, type,
    rotation: Math.atan2(entity.velocity.y, entity.velocity.x) || 0, animationFrame: Math.max(0, entity.spawnTick) % 4 } as RenderEntity;
  // Keep the legacy JSON shape compact while the required fields remain type-safe and accessible.
  Object.defineProperties(result, { rotation: { value: result.rotation, enumerable: false }, animationFrame: { value: result.animationFrame, enumerable: false } });
  return result;
}
export function validateRenderContext(context: RenderContext): void {
  const all = [...context.enemies, ...context.projectiles, ...context.effects, ...(context.localPlayer ? [context.localPlayer] : [])];
  for (const e of all) if (!Number.isFinite(e.id) || !Number.isFinite(e.position.x) || !Number.isFinite(e.position.y) || !Number.isFinite(e.health) || !e.type || !Number.isFinite(e.rotation) || !Number.isInteger(e.animationFrame)) throw new Error(`Invalid render entity ${e.id}`);
  if (!context.hud || !Number.isInteger(context.hud.wave) || !Number.isFinite(context.hud.score) || !Number.isInteger(context.hud.enemiesRemaining)) throw new Error("Invalid render HUD");
}
export function gameStateToRender(state: GameState, localPlayerId?: PlayerId): RenderContext {
  const enemies: RenderEntity[] = [], projectiles: RenderEntity[] = [], effects: RenderEntity[] = [];
  for (const entity of Object.values(state.entities)) {
    if (entity.lifecycle !== "active") continue;
    if (entity.kind === "enemy") enemies.push(renderEntity(entity)); else if (entity.kind === "projectile") projectiles.push(renderEntity(entity)); else if ((entity.kind as string) === "effect") effects.push(renderEntity(entity));
  }
  const entityId = localPlayerId === undefined ? undefined : state.players[localPlayerId];
  const player = entityId === undefined ? undefined : state.entities[entityId];
  const hud = { wave: state.wave.currentWave, score: state.score, enemiesRemaining: enemies.length, phase: state.phase };
  const result: RenderContext = { enemies, projectiles, effects, localPlayer: player?.kind === "player" && player.lifecycle === "active" ? renderEntity(player) : null, hud, wave: hud.wave, score: hud.score };
  validateRenderContext(result); return result;
}
export const snapshotToRenderContext = gameStateToRender;
