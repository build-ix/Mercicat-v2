import type { GameState, InputCommand, SimulationEvent, SimulationResult } from "@mercicat/shared";
import { calculateThreatBudget, ENEMY_ROLES } from "@mercicat/content";
import { hashGameState } from "../stateHash.js";
import { updateEntities, finalizeLifecycle } from "../systems/entitySystem.js";
import { processCollisions } from "../systems/collisionSystem.js";
import { applyDamage } from "../systems/damageSystem.js";
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
  advanceShop(state, context.rng, events);
  // Select the immutable threat queue before the director consumes its first
  // slot. This preserves spawn-on-wave-start while keeping later spawns paced.
  if (state.wavePhase === "waveActive" && state.wave.spawnedForWave === 0 && !state.wave.waveComplete && Object.keys(state.spawnDirector.activeComposition).length === 0) {
    state.spawnDirector.threatBudget = Math.max(1, Math.round(calculateThreatBudget(state.wave.currentWave, Object.keys(state.players).length, state.difficulty) * (context.budgetMultiplier ?? 1)));
    state.spawnDirector.activeComposition = selectEnemyComposition(state.wave.currentWave, Object.keys(state.players).length, state.difficulty, context.rng, context.budgetMultiplier ?? 1);
    const selectedCost = Object.entries(state.spawnDirector.activeComposition).reduce((sum, [role, count]) => sum + (ENEMY_ROLES[role as keyof typeof ENEMY_ROLES]?.threatCost ?? 0) * count, 0);
    const selectedRoles = Object.keys(state.spawnDirector.activeComposition) as Array<keyof typeof ENEMY_ROLES>;
    state.spawnDirector.compositionSelectionReason = selectedCost >= state.spawnDirector.threatBudget ? "none" : selectedRoles.length === 0 ? "unlock-gate" : selectedRoles.every(role => (state.spawnDirector.activeComposition[role] ?? 0) >= 6) ? "role-cap" : "other";
    events.push({ type: "roleCompositionSelected", tick: state.tick, wave: state.wave.currentWave, composition: state.spawnDirector.activeComposition, groupCount: Math.ceil(Math.max(...Object.values(state.spawnDirector.activeComposition), 0) / 2) });
  }
  advanceSpawnDirector(state, context.rng, events);
  if (state.phase !== "waveActive" && state.phase !== "playing") {
    state.tick += 1;
    return { state, events, stateHash: hashGameState(state) };
  }
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events, createPlayerProjectile);
  updateEnemyAI(state, context.rng, events);
  updateEntities(state, context.rng, events);
  applyDamage(state, processCollisions(state), events);
  finalizeLifecycle(state, events);
  state.tick += 1;
  return { state, events, stateHash: hashGameState(state) };
}
