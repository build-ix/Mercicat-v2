import type { GameState, InputCommand, SimulationAdapter } from "@mercicat/shared";
import { SeededRandom, TICK_RATE } from "@mercicat/shared";
import { step } from "./step.js";
import { hashGameState } from "./stateHash.js";
export function createSimulationAdapter(seed: number | string): SimulationAdapter {
  const rng = new SeededRandom(seed);
  return { tickRate: TICK_RATE, step: (state: GameState, inputs: readonly InputCommand[]) => { const result = step(state, inputs, { rng }); return { state: result.state, stateHash: result.stateHash }; }, hash: hashGameState };
}
