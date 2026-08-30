import { EntityId, GameState, ProjectileEntity, EnemyEntity } from "@mercicat/shared";

export interface CollisionPair { readonly aId: EntityId; readonly bId: EntityId; }
export interface DamageRequest { readonly sourceId: EntityId | null; readonly targetId: EntityId; readonly amount: number; }

export function detectCollisions(state: GameState): CollisionPair[] {
  const entities = Object.values(state.entities)
    .filter((entity) => entity.lifecycle === "active")
    .sort((a, b) => a.id - b.id);
  const pairs: CollisionPair[] = [];
  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i]; const b = entities[j];
      const dx = a.position.x - b.position.x; const dy = a.position.y - b.position.y;
      const radius = a.radius + b.radius;
      if (dx * dx + dy * dy <= radius * radius) pairs.push({ aId: a.id, bId: b.id });
    }
  }
  return pairs;
}

/** Convert geometric contacts into deterministic damage requests. */
export function processCollisions(state: GameState): DamageRequest[] {
  const requests: DamageRequest[] = [];
  for (const { aId, bId } of detectCollisions(state)) {
    const a = state.entities[aId]; const b = state.entities[bId];
    if (!a || !b || a.lifecycle !== "active" || b.lifecycle !== "active") continue;
    if (a.kind === "projectile" && (a as ProjectileEntity).ownerId !== b.id) {
      const projectile = a as ProjectileEntity;
      requests.push({ sourceId: a.id, targetId: b.id, amount: projectile.damage });
      a.lifecycle = "despawned"; a.despawnTick = state.tick;
    } else if (b.kind === "projectile" && (b as ProjectileEntity).ownerId !== a.id) {
      const projectile = b as ProjectileEntity;
      requests.push({ sourceId: b.id, targetId: a.id, amount: projectile.damage });
      b.lifecycle = "despawned"; b.despawnTick = state.tick;
    } else if (a.kind === "enemy" && b.kind === "player") {
      requests.push({ sourceId: a.id, targetId: b.id, amount: (a as EnemyEntity).contactDamage });
    } else if (b.kind === "enemy" && a.kind === "player") {
      requests.push({ sourceId: b.id, targetId: a.id, amount: (b as EnemyEntity).contactDamage });
    }
  }
  return requests.sort((a, b) => a.targetId - b.targetId || (a.sourceId ?? 0) - (b.sourceId ?? 0));
}
