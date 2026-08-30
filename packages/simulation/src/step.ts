import { EntityId, GameState, InputCommand, SimulationEvent, SimulationResult, Tick } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "./stateHash";
import { updateEntities, finalizeLifecycle } from "./systems/entitySystem";
import { processCollisions } from "./systems/collisionSystem";
import { applyDamage } from "./systems/damageSystem";
import { spawnEnemies } from "./enemies";
import { updatePlayerRespawns } from "./players";

export interface SimulationContext { readonly rng: SeededRandom; }

export function step(previous: GameState, commands: readonly InputCommand[], context: SimulationContext): SimulationResult {
  const state = structuredClone(previous) as GameState;
  const events: SimulationEvent[] = [];
  if (state.phase !== "playing") return { state, events, stateHash: hashGameState(state) };
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events);
  if (state.wave.spawnedForWave === 0 && !state.wave.waveComplete) spawnEnemies(state, context.rng, state.wave.currentWave, events);
  updateEntities(state, context.rng, events);
  applyDamage(state, processCollisions(state), events);
  updatePlayerRespawns(state, context.rng, events);
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
    if (command.type === "move") player.velocity = { x: clamp(command.direction.x, -1, 1), y: clamp(command.direction.y, -1, 1) };
    if (command.type === "fire" && (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks === 0) {
      const id = state.nextEntityId++; const direction = command.direction;
      state.entities[id] = { id, kind: "projectile", lifecycle: "active", ownerId: player.id,
        position: { x: player.position.x + direction.x * 20, y: player.position.y + direction.y * 20 },
        velocity: { x: direction.x * 300, y: direction.y * 300 }, radius: 4, health: 1, maxHealth: 1,
        spawnTick: state.tick, despawnTick: null, damage: 10, lifetimeTicks: 300, ageTicks: 0 };
      (player as import("@mercicat/shared").PlayerEntity).fireCooldownTicks = 3;
      events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
    }
  }
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
