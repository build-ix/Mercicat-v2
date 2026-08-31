import { EntityId, GameState, InputCommand, SimulationEvent, SimulationResult, Tick } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "./stateHash.js";
import { updateEntities, finalizeLifecycle } from "./systems/entitySystem.js";
import { processCollisions } from "./systems/collisionSystem.js";
import { applyDamage } from "./systems/damageSystem.js";
import { spawnEnemies } from "./enemies.js";
export interface SimulationContext { readonly rng: SeededRandom; }

// Simulation units are world-units per tick. At 60 Hz these correspond to
// 300 world-units/sec for the player and 600 world-units/sec for shots.
export const PLAYER_SPEED_PER_TICK = 5;
export const PROJECTILE_SPEED_PER_TICK = 10;

export function step(previous: GameState, commands: readonly InputCommand[], context: SimulationContext): SimulationResult {
  const state = structuredClone(previous) as GameState;
  const events: SimulationEvent[] = [];
  if (state.phase !== "playing") return { state, events, stateHash: hashGameState(state) };
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events);
  if (state.wave.spawnedForWave === 0 && !state.wave.waveComplete) spawnEnemies(state, context.rng, state.wave.currentWave, events);
  updateEntities(state, context.rng, events);
  applyDamage(state, processCollisions(state), events);
  if (handlePlayerDefeat(state, events)) {
    state.tick += 1;
    return { state, events, stateHash: hashGameState(state) };
  }
  finalizeLifecycle(state, events);
  updateWaveState(state, context.rng, events);

  state.tick += 1;
  return { state, events, stateHash: hashGameState(state) };
}

function compareCommands(a: InputCommand, b: InputCommand): number {
  return a.playerId - b.playerId || a.type.localeCompare(b.type);
}
function applyCommands(state: GameState, commands: readonly InputCommand[], events: SimulationEvent[]): void {
  for (const command of commands) {
    const id = state.players[command.playerId]; const player = state.entities[id];
    if (!player || player.lifecycle !== "active" || player.kind !== "player") continue;
    if (command.type === "move") player.velocity = { x: clamp(command.direction.x, -1, 1) * PLAYER_SPEED_PER_TICK, y: clamp(command.direction.y, -1, 1) * PLAYER_SPEED_PER_TICK };
    if (command.type === "fire" && (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks === 0) {
      const id = state.nextEntityId++; const direction = command.direction;
      state.entities[id] = { id, kind: "projectile", lifecycle: "active", ownerId: player.id,
        position: { x: player.position.x + direction.x * 20, y: player.position.y + direction.y * 20 },
        velocity: { x: direction.x * PROJECTILE_SPEED_PER_TICK, y: direction.y * PROJECTILE_SPEED_PER_TICK }, radius: 4, health: 1, maxHealth: 1,
        spawnTick: state.tick, despawnTick: null, damage: 10, lifetimeTicks: 300, ageTicks: 0 };
      (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks = 3;
      events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
    }
  }
}
function handlePlayerDefeat(state: GameState, events: SimulationEvent[]): boolean {
  if (state.phase !== "playing") return true;
  if (Object.values(state.entities).some((entity) => entity.kind === "player" && entity.health <= 0)) {
    state.phase = "defeat";
    events.push({ type: "matchDefeated", tick: state.tick, wave: state.wave.currentWave });
    return true;
  }
  return false;
}

function updateWaveState(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  const enemies = Object.values(state.entities).filter((e) => e.kind === "enemy" && e.lifecycle === "active");
  if (enemies.length !== 0 || state.wave.spawnedForWave === 0 || state.wave.waveComplete) return;
  state.wave.waveComplete = true;
  state.wave.defeatedForWave = state.wave.spawnedForWave;
  events.push({ type: "waveCompleted", tick: state.tick, wave: state.wave.currentWave });
  if (state.wave.currentWave >= state.wave.totalWaves) {
    state.wave.matchComplete = true; state.phase = "victory";
    events.push({ type: "matchCompleted", tick: state.tick, wave: state.wave.currentWave });
  } else {
    state.wave.currentWave += 1; state.wave.spawnedForWave = 0; state.wave.defeatedForWave = 0; state.wave.waveComplete = false;
    spawnEnemies(state, rng, state.wave.currentWave, events);
  }
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
export type { Tick, EntityId };
