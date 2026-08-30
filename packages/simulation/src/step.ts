import {
  GameState,
  InputCommand,
  SimulationEvent,
  SimulationResult,
  EntityId,
  Tick
} from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "./stateHash";

export interface SimulationContext {
  readonly rng: SeededRandom;
}

export function step(
  previous: GameState,
  commands: readonly InputCommand[],
  context: SimulationContext
): SimulationResult {
  const state = structuredClone(previous);
  const events: SimulationEvent[] = [];

  if (state.phase !== "playing") {
    return {
      state,
      events,
      stateHash: hashGameState(state)
    };
  }

  const tickCommands = commands
    .filter((command) => command.tick === state.tick)
    .sort(compareCommands);

  applyCommands(state, tickCommands, events);
  updateEntities(state, context.rng, events);
  processCollisions(state, events);
  applyDamage(state, events);
  finalizeLifecycle(state, events);
  updateWaveState(state, context.rng, events);

  state.tick += 1;

  return {
    state,
    events,
    stateHash: hashGameState(state)
  };
}

function compareCommands(a: InputCommand, b: InputCommand): number {
  if (a.playerId !== b.playerId) return a.playerId - b.playerId;
  return a.type.localeCompare(b.type);
}

function applyCommands(
  state: GameState,
  commands: readonly InputCommand[],
  events: SimulationEvent[]
): void {
  for (const command of commands) {
    const playerEntityId = state.players[command.playerId];
    const player = state.entities[playerEntityId];

    if (!player || player.lifecycle !== "active" || player.kind !== "player") {
      continue;
    }

    switch (command.type) {
      case "move": {
        player.velocity = {
          x: clamp(command.direction.x, -1, 1),
          y: clamp(command.direction.y, -1, 1)
        };
        break;
      }

      case "fire": {
        // Fire logic deferred to a separate system
        if (player.fireCooldownTicks > 0) break;

        const projectileId = state.nextEntityId++;
        const spawnOffset = {
          x: command.direction.x * 20,
          y: command.direction.y * 20
        };

        state.entities[projectileId] = {
          id: projectileId,
          kind: "projectile",
          lifecycle: "active",
          ownerId: playerEntityId,
          position: {
            x: player.position.x + spawnOffset.x,
            y: player.position.y + spawnOffset.y
          },
          velocity: {
            x: command.direction.x * 300,
            y: command.direction.y * 300
          },
          radius: 4,
          health: 1,
          maxHealth: 1,
          spawnTick: state.tick,
          despawnTick: null,
          damage: 10,
          lifetimeTicks: 300,
          ageTicks: 0
        };

        player.fireCooldownTicks = 3;

        events.push({
          type: "entitySpawned",
          tick: state.tick,
          entityId: projectileId,
          kind: "projectile"
        });
        break;
      }

      case "usePickup": {
        // Deferred to pickup system
        break;
      }

      case "pause": {
        // Pause is not part of authoritative simulation
        break;
      }
    }
  }
}

function updateEntities(
  state: GameState,
  rng: SeededRandom,
  events: SimulationEvent[]
): void {
  const entities = Object.values(state.entities)
    .filter((e) => e.lifecycle === "active")
    .sort((a, b) => a.id - b.id);

  for (const entity of entities) {
    // Apply velocity
    entity.position = {
      x: entity.position.x + entity.velocity.x,
      y: entity.position.y + entity.velocity.y
    };

    // Decay cooldowns
    if (entity.kind === "player" || entity.kind === "enemy") {
      entity.fireCooldownTicks = Math.max(0, entity.fireCooldownTicks - 1);
    }

    // Projectile aging
    if (entity.kind === "projectile") {
      entity.ageTicks += 1;

      if (entity.ageTicks >= entity.lifetimeTicks) {
        entity.lifecycle = "despawned";
        entity.despawnTick = state.tick;

        events.push({
          type: "entityDespawned",
          tick: state.tick,
          entityId: entity.id,
          reason: "expired"
        });
      }
    }

    // Enemy AI (simplified: random walk)
    if (entity.kind === "enemy" && rng.chance(0.05)) {
      entity.velocity = {
        x: rng.nextInt(-100, 100),
        y: rng.nextInt(-100, 100)
      };
    }
  }
}

interface CollisionPair {
  aId: EntityId;
  bId: EntityId;
}

function detectCollisions(state: GameState): readonly CollisionPair[] {
  const entities = Object.values(state.entities)
    .filter((e) => e.lifecycle === "active")
    .sort((a, b) => a.id - b.id);

  const collisions: CollisionPair[] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const radius = a.radius + b.radius;

      if (dx * dx + dy * dy <= radius * radius) {
        collisions.push({ aId: a.id, bId: b.id });
      }
    }
  }

  return collisions;
}

interface PendingDamage {
  sourceId: EntityId | null;
  targetId: EntityId;
  amount: number;
}

const pendingDamageMap = new WeakMap<GameState, PendingDamage[]>();

function queueDamage(
  state: GameState,
  sourceId: EntityId | null,
  targetId: EntityId,
  amount: number
): void {
  const list = pendingDamageMap.get(state) ?? [];
  list.push({ sourceId, targetId, amount });
  pendingDamageMap.set(state, list);
}

function consumePendingDamage(state: GameState): PendingDamage[] {
  const list = pendingDamageMap.get(state) ?? [];
  pendingDamageMap.delete(state);
  return list.sort(
    (a, b) =>
      a.targetId - b.targetId ||
      (a.sourceId ?? 0) - (b.sourceId ?? 0)
  );
}

function processCollisions(
  state: GameState,
  events: SimulationEvent[]
): void {
  const pairs = detectCollisions(state);

  for (const pair of pairs) {
    const a = state.entities[pair.aId];
    const b = state.entities[pair.bId];

    if (!a || !b) continue;
    if (a.lifecycle !== "active" || b.lifecycle !== "active") continue;

    if (a.kind === "projectile" && a.ownerId !== b.id) {
      queueDamage(state, a.id, b.id, a.damage);
      a.lifecycle = "despawned";
      a.despawnTick = state.tick;
    } else if (b.kind === "projectile" && b.ownerId !== a.id) {
      queueDamage(state, b.id, a.id, b.damage);
      b.lifecycle = "despawned";
      b.despawnTick = state.tick;
    } else if (a.kind === "enemy" && b.kind === "player") {
      queueDamage(state, a.id, b.id, a.contactDamage);
    } else if (b.kind === "enemy" && a.kind === "player") {
      queueDamage(state, b.id, a.id, b.contactDamage);
    }
  }
}

function applyDamage(
  state: GameState,
  events: SimulationEvent[]
): void {
  const requests = consumePendingDamage(state);

  for (const request of requests) {
    const target = state.entities[request.targetId];

    if (!target || target.lifecycle !== "active") continue;
    if (!Number.isFinite(request.amount) || request.amount <= 0) continue;

    target.health = Math.max(0, target.health - request.amount);

    events.push({
      type: "entityDamaged",
      tick: state.tick,
      targetId: target.id,
      sourceId: request.sourceId,
      amount: request.amount,
      remainingHealth: target.health
    });

    if (target.health === 0) {
      target.lifecycle = "dead";
    }
  }
}

function finalizeLifecycle(
  state: GameState,
  events: SimulationEvent[]
): void {
  const deadEntities: EntityId[] = [];

  for (const entity of Object.values(state.entities)) {
    if (entity.lifecycle === "dead") {
      entity.lifecycle = "despawned";
      entity.despawnTick = state.tick;

      events.push({
        type: "entityDespawned",
        tick: state.tick,
        entityId: entity.id,
        reason: "dead"
      });

      deadEntities.push(entity.id);
    }
  }

  for (const id of deadEntities) {
    delete state.entities[id];
  }
}

function updateWaveState(
  state: GameState,
  rng: SeededRandom,
  events: SimulationEvent[]
): void {
  const enemies = Object.values(state.entities).filter(
    (entity) => entity.kind === "enemy"
  );

  if (
    enemies.length === 0 &&
    state.wave.spawnedForWave > 0 &&
    !state.wave.waveComplete
  ) {
    state.wave.waveComplete = true;
    events.push({
      type: "waveCompleted",
      tick: state.tick,
      wave: state.wave.currentWave
    });

    if (state.wave.currentWave >= state.wave.totalWaves) {
      state.wave.matchComplete = true;
      state.phase = "victory";
      events.push({
        type: "matchCompleted",
        tick: state.tick,
        wave: state.wave.currentWave
      });
    } else {
      state.wave.currentWave += 1;
      state.wave.spawnedForWave = 0;
      state.wave.defeatedForWave = 0;
      state.wave.waveComplete = false;
      spawnWave(state, rng, events);
    }
  }
}

function spawnWave(
  state: GameState,
  rng: SeededRandom,
  events: SimulationEvent[]
): void {
  const count = 3 + state.wave.currentWave * 2;

  for (let i = 0; i < count; i++) {
    const id = state.nextEntityId++;
    const enemy = {
      id,
      kind: "enemy" as const,
      lifecycle: "active" as const,
      position: {
        x: rng.nextInt(-500, 500),
        y: rng.nextInt(-500, 500)
      },
      velocity: { x: 0, y: 0 },
      radius: 16,
      health: 10 + state.wave.currentWave * 2,
      maxHealth: 10 + state.wave.currentWave * 2,
      spawnTick: state.tick,
      despawnTick: null,
      enemyType: "basic",
      contactDamage: 1,
      fireCooldownTicks: 0,
      targetPlayerId: null
    };

    state.entities[id] = enemy;
    state.wave.spawnedForWave += 1;

    events.push({
      type: "entitySpawned",
      tick: state.tick,
      entityId: id,
      kind: "enemy"
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
