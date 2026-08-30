import { EntityId, GameState, SimulationEvent } from "@mercicat/shared";
import { DamageRequest } from "./collisionSystem.js";

export function applyDamage(
  state: GameState,
  requests: readonly DamageRequest[],
  events: SimulationEvent[],
): void {
  for (const request of requests) {
    const target = state.entities[request.targetId];
    if (!target || target.lifecycle !== "active") continue;
    if (!Number.isFinite(request.amount) || request.amount <= 0) continue;
    target.health = Math.max(0, target.health - request.amount);
    events.push({ type: "entityDamaged", tick: state.tick, targetId: target.id,
      sourceId: request.sourceId, amount: request.amount, remainingHealth: target.health });
    if (target.health === 0) target.lifecycle = "dead";
  }
}

export function killEntity(state: GameState, entityId: EntityId): void {
  const entity = state.entities[entityId];
  if (entity && entity.lifecycle === "active") entity.health = 0;
  if (entity && entity.lifecycle === "active") entity.lifecycle = "dead";
}
