import { SeededRandom } from "@mercicat/shared";

export interface SimulationContext {
  readonly rng: SeededRandom;
  readonly allPlayersReady: boolean;
  readonly budgetMultiplier?: number;
}
