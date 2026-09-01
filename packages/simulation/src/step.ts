import type { EntityId, GameState, InputCommand, SimulationResult, Tick } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { stepCoordinator } from "./engine/stepCoordinator.js";
import type { SimulationContext } from "./engine/simulationContext.js";

/** Public compatibility facade. Legacy callers may omit allPlayersReady. */
export function step(previous: GameState, commands: readonly InputCommand[], context: Pick<SimulationContext, "rng"> & Partial<Pick<SimulationContext, "allPlayersReady">>): SimulationResult {
  return stepCoordinator(previous, commands, { rng: context.rng, allPlayersReady: context.allPlayersReady ?? false });
}

export type { SimulationContext };
export { stepCoordinator };
export const PLAYER_SPEED_PER_TICK = 5;
export const PROJECTILE_SPEED_PER_TICK = 10;
export type { Tick, EntityId };
export { SeededRandom };
