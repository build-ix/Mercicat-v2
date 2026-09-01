import type { GameState, PlayerEntity, SimulationEvent } from "@mercicat/shared";
import { commandDirection } from "./inputSystem.js";

export const PROJECTILE_SPEED_PER_TICK = 10;

/** Creates player projectiles; called from the input system in command order. */
export function createPlayerProjectile(state: GameState, player: PlayerEntity, direction: { x: number; y: number }, events: SimulationEvent[]): void {
  if (player.fireCooldownTicks !== 0) return;
  const id = state.nextEntityId++;
  state.entities[id] = { id, kind: "projectile", lifecycle: "active", ownerId: player.id,
    position: { x: player.position.x + direction.x * 20, y: player.position.y + direction.y * 20 },
    velocity: { x: direction.x * PROJECTILE_SPEED_PER_TICK, y: direction.y * PROJECTILE_SPEED_PER_TICK }, radius: 4, health: 1, maxHealth: 1,
    spawnTick: state.tick, despawnTick: null, damage: 10, lifetimeTicks: 300, ageTicks: 0 };
  player.fireCooldownTicks = 3;
  events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
}

export { commandDirection };
