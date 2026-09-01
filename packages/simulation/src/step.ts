import { EntityId, GameState, InputCommand, SimulationEvent, SimulationResult, Tick } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "./stateHash.js";
import { updateEntities, finalizeLifecycle } from "./systems/entitySystem.js";
import { processCollisions } from "./systems/collisionSystem.js";
import { applyDamage } from "./systems/damageSystem.js";
import { spawnEnemies } from "./enemies.js";
import { advanceMatchPhase } from "./matchPhase.js";
import { advanceWavePhase } from "./wavePhase.js";
import { advanceShop } from "./shopPlacement.js";
import { advanceSpawnDirector } from "./spawnDirector.js";
import { selectEnemyComposition } from "./spawnDirector.js";
import { calculateThreatBudget } from "@mercicat/content";
export interface SimulationContext { readonly rng: SeededRandom; readonly allPlayersReady?: boolean; }

// Simulation units are world-units per tick at the canonical TICK_RATE.
export const PLAYER_SPEED_PER_TICK = 5;
export const PROJECTILE_SPEED_PER_TICK = 10;

export function step(previous: GameState, commands: readonly InputCommand[], context: SimulationContext): SimulationResult {
  const state = structuredClone(previous) as GameState;
  const events: SimulationEvent[] = [];
  advanceMatchPhase(state, context.allPlayersReady ?? false);
  advanceWavePhase(state, context.allPlayersReady ?? false, events);
  advanceShop(state, events);
  advanceSpawnDirector(state, context.rng, events);
  if (state.phase !== "waveActive" && state.phase !== "playing") {
    state.tick += 1;
    return { state, events, stateHash: hashGameState(state) };
  }
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events);
  if (state.wavePhase === "waveActive" && state.wave.spawnedForWave === 0 && !state.wave.waveComplete) {
    if (Object.keys(state.spawnDirector.activeComposition).length === 0) {
      state.spawnDirector.threatBudget = calculateThreatBudget(state.wave.currentWave, Object.keys(state.players).length, state.difficulty);
      state.spawnDirector.activeComposition = selectEnemyComposition(state.wave.currentWave, Object.keys(state.players).length, state.difficulty, context.rng);
      events.push({ type: "roleCompositionSelected", tick: state.tick, composition: state.spawnDirector.activeComposition });
    }
    spawnEnemies(state, context.rng, state.wave.currentWave, events);
    events.push({ type: "waveStarted", tick: state.tick, wave: state.wave.currentWave });
  }
  updateEnemyAI(state, context.rng, events);
  updateEntities(state, context.rng, events);
  applyDamage(state, processCollisions(state), events);
  finalizeLifecycle(state, events);

  state.tick += 1;
  return { state, events, stateHash: hashGameState(state) };
}

function compareCommands(a: InputCommand, b: InputCommand): number {
  return a.playerId - b.playerId || a.type.localeCompare(b.type);
}
function applyCommands(state: GameState, commands: readonly InputCommand[], events: SimulationEvent[]): void {
  // Movement is a per-tick state sample. A missing move command must not leave
  // the previous velocity active after a key is released.
  for (const entityId of Object.values(state.players)) {
    const player = state.entities[entityId];
    if (player?.kind === "player" && player.lifecycle === "active" && !(player as import("@mercicat/shared").PlayerEntity).downed) player.velocity = { x: 0, y: 0 };
  }
  for (const command of commands) {
    const id = state.players[command.playerId]; const player = state.entities[id];
    if (!player || player.lifecycle !== "active" || player.kind !== "player" || (player as import("@mercicat/shared").PlayerEntity).downed || player.health <= 0) continue;
    const direction = commandDirection(command);
    if (command.type === "move") player.velocity = { x: clamp(direction.x, -1, 1) * PLAYER_SPEED_PER_TICK, y: clamp(direction.y, -1, 1) * PLAYER_SPEED_PER_TICK };
    if (command.type === "fire" && (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks === 0) {
      const id = state.nextEntityId++;
      state.entities[id] = { id, kind: "projectile", lifecycle: "active", ownerId: player.id,
        position: { x: player.position.x + direction.x * 20, y: player.position.y + direction.y * 20 },
        velocity: { x: direction.x * PROJECTILE_SPEED_PER_TICK, y: direction.y * PROJECTILE_SPEED_PER_TICK }, radius: 4, health: 1, maxHealth: 1,
        spawnTick: state.tick, despawnTick: null, damage: 10, lifetimeTicks: 300, ageTicks: 0 };
      (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks = 3;
      events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
    }
  }
}

const ENEMY_SPEED_PER_TICK = 2.5;
const ENEMY_PROJECTILE_SPEED_PER_TICK = 7;
const ENEMY_FIRE_RANGE = 200;

/** Deterministic pursuit and ranged attack behavior, evaluated in entity order. */
function updateEnemyAI(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  const players = Object.values(state.entities).filter((entity) => entity.kind === "player" && entity.lifecycle === "active");
  if (players.length === 0) return;
  const player = players.sort((a, b) => a.id - b.id)[0];
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.kind !== "enemy" || entity.lifecycle !== "active") continue;
    const enemy = entity as import("@mercicat/shared").EnemyEntity;
    enemy.targetPlayerId = (player as import("@mercicat/shared").PlayerEntity).playerId;
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


function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function commandDirection(command: InputCommand): { x: number; y: number } {
  if (command.direction) return command.direction;
  return { x: command.aimX ?? command.moveX ?? 0, y: command.aimY ?? command.moveY ?? 0 };
}
export type { Tick, EntityId };
