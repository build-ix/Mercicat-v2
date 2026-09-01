import type { EnemyEntity, GameState, PlayerEntity, SimulationEvent } from "@mercicat/shared";
import type { SeededRandom } from "@mercicat/shared";

const ENEMY_SPEED_PER_TICK = 2.5;
const ENEMY_PROJECTILE_SPEED_PER_TICK = 7;
const ENEMY_FIRE_RANGE = 200;

/** Deterministic pursuit and ranged attack behavior, evaluated in entity order. */
export function updateEnemyAI(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  const players = Object.values(state.entities).filter((entity) => entity.kind === "player" && entity.lifecycle === "active");
  if (players.length === 0) return;
  const player = players.sort((a, b) => a.id - b.id)[0] as PlayerEntity;
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.kind !== "enemy" || entity.lifecycle !== "active") continue;
    const enemy = entity as EnemyEntity;
    enemy.targetPlayerId = player.playerId;
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const distance = Math.hypot(dx, dy);
    enemy.velocity = distance > 0 ? { x: (dx / distance) * ENEMY_SPEED_PER_TICK, y: (dy / distance) * ENEMY_SPEED_PER_TICK } : { x: 0, y: 0 };
    if (distance <= ENEMY_FIRE_RANGE && enemy.fireCooldownTicks === 0 && rng.chance(0.8)) {
      const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
      const id = state.nextEntityId++;
      state.entities[id] = { id, kind: "projectile", lifecycle: "active", ownerId: enemy.id,
        position: { x: enemy.position.x + direction.x * 18, y: enemy.position.y + direction.y * 18 },
        velocity: { x: direction.x * ENEMY_PROJECTILE_SPEED_PER_TICK, y: direction.y * ENEMY_PROJECTILE_SPEED_PER_TICK },
        radius: 4, health: 1, maxHealth: 1, spawnTick: state.tick, despawnTick: null,
        damage: 5, lifetimeTicks: 180, ageTicks: 0 };
      enemy.fireCooldownTicks = 45 + rng.nextInt(0, 15);
      events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
    }
  }
}
