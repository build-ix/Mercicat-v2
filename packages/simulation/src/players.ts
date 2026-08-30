import type { GameState, PlayerEntity, SimulationEvent } from "@mercicat/shared";
import type { SeededRandom } from "@mercicat/shared";
const RESPAWN_TICKS = 60;
export function updatePlayerRespawns(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  for (const entity of Object.values(state.entities)) {
    if (entity.kind !== "player") continue;
    const player = entity as PlayerEntity;
    if (player.health <= 0 && player.lifecycle === "active") { player.lifecycle = "dead"; player.deadSinceTick = state.tick; }
    if (player.lifecycle === "dead" && player.deadSinceTick !== undefined && state.tick - player.deadSinceTick >= RESPAWN_TICKS) {
      const angle = rng.nextFloat() * Math.PI * 2; player.position = { x: Math.cos(angle) * 480, y: Math.sin(angle) * 270 }; player.velocity = { x: 0, y: 0 }; player.health = player.maxHealth; player.lifecycle = "active"; player.despawnTick = null; player.respawnCount = (player.respawnCount ?? 0) + 1; delete player.deadSinceTick;
      events.push({ type: "entitySpawned", tick: state.tick, entityId: player.id, kind: "player" });
    }
  }
}
export const RESPAWN_DELAY_TICKS = RESPAWN_TICKS;