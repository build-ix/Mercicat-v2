import type { GameState, InputCommand, SimulationEvent, SimulationResult } from "@mercicat/shared";
import { calculateThreatBudget } from "@mercicat/content";
import { hashGameState } from "../stateHash.js";
import { updateEntities, finalizeLifecycle } from "../systems/entitySystem.js";
import { processCollisions } from "../systems/collisionSystem.js";
import { applyDamage } from "../systems/damageSystem.js";
import { spawnEnemies } from "../enemies.js";
import { advanceMatchPhase } from "../matchPhase.js";
import { advanceWavePhase } from "../wavePhase.js";
import { advanceShop } from "../shopPlacement.js";
import { advanceSpawnDirector, selectEnemyComposition } from "../spawnDirector.js";
import { applyCommands, compareCommands } from "../systems/inputSystem.js";
import { createPlayerProjectile } from "../systems/playerCombatSystem.js";
import { updateEnemyAI } from "../systems/enemyAiSystem.js";
import type { SimulationContext } from "./simulationContext.js";

/**
 * Deterministic tick pipeline. RNG-consuming stages are deliberately ordered:
 * spawn director, role composition/spawning, enemy AI, then entity updates.
 * Match, wave, shop, input, collision, damage, and lifecycle stages are pure
 * with respect to RNG. Do not reorder these calls without updating replays.
 */
export function stepCoordinator(previous: GameState, commands: readonly InputCommand[], context: SimulationContext): SimulationResult {
  const state = structuredClone(previous) as GameState;
  const events: SimulationEvent[] = [];
  advanceMatchPhase(state, context.allPlayersReady);
  advanceWavePhase(state, context.allPlayersReady, events);
  advanceShop(state, events);
  advanceSpawnDirector(state, context.rng, events);
  if (state.phase !== "waveActive" && state.phase !== "playing") {
    state.tick += 1;
    return { state, events, stateHash: hashGameState(state) };
  }
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events, createPlayerProjectile);
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
