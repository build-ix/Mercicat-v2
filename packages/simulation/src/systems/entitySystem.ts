import { GameState, SimulationEvent, PlayerEntity, EnemyEntity, ProjectileEntity, EnemyRole } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { ENEMY_ROLES } from "@mercicat/content";

/** Advance active entities in stable entity-id order. */
export function updateEntities(
  state: GameState,
  rng: SeededRandom,
  events: SimulationEvent[],
): void {
  const entities = Object.values(state.entities)
    .filter((entity) => entity.lifecycle === "active")
    .sort((a, b) => a.id - b.id);

  for (const entity of entities) {
    entity.position = {
      x: entity.position.x + entity.velocity.x,
      y: entity.position.y + entity.velocity.y,
    };

    if (entity.kind === "player" || entity.kind === "enemy") {
      const combatant = entity as PlayerEntity | EnemyEntity;
      combatant.fireCooldownTicks = Math.max(0, combatant.fireCooldownTicks - 1);
    }

    if (entity.kind === "projectile") {
      const projectile = entity as ProjectileEntity;
      projectile.ageTicks += 1;
      if (projectile.ageTicks >= projectile.lifetimeTicks) {
        markDespawned(state, entity.id, "expired", events);
      }
    }

    if (entity.kind === "enemy" && rng.chance(0.05)) {
      entity.velocity = { x: rng.nextInt(-100, 100), y: rng.nextInt(-100, 100) };
    }
  }
}

export function markDespawned(
  state: GameState,
  entityId: number,
  reason: "dead" | "expired" | "removed",
  events: SimulationEvent[],
): void {
  const entity = state.entities[entityId];
  if (!entity || entity.lifecycle === "despawned") return;
  entity.lifecycle = "despawned";
  entity.despawnTick = state.tick;
  events.push({ type: "entityDespawned", tick: state.tick, entityId, reason,
    ...(entity.kind === "enemy" ? { role: (entity as EnemyEntity).enemyType as EnemyRole, threatCost: ENEMY_ROLES[(entity as EnemyEntity).enemyType as keyof typeof ENEMY_ROLES]?.threatCost } : {}) });
}

/** Remove terminal entities only after all systems have observed them. */
export function finalizeLifecycle(state: GameState, events: SimulationEvent[]): void {
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.lifecycle === "dead" && entity.kind !== "player") {
      if (entity.kind === "enemy") state.score += 10;
      markDespawned(state, entity.id, "dead", events);
    }
  }
  for (const entity of Object.values(state.entities)) {
    if (entity.lifecycle === "despawned") delete state.entities[entity.id];
  }
}
