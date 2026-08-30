import { GameState, InputCommand } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { hashGameState } from "./stateHash.js";
import { step } from "./step.js";

export interface ReplayFrame { readonly commands: readonly InputCommand[]; readonly stateHash: string; }

/** Replays recorded commands and fails fast if an authoritative hash diverges. */
export function validateReplay(initial: GameState, frames: readonly ReplayFrame[]): GameState {
  let state = initial;
  const rng = new SeededRandom(initial.seed);
  for (const frame of frames) {
    const result = step(state, frame.commands, { rng });
    if (result.stateHash !== frame.stateHash) {
      throw new Error(`Replay divergence at tick ${state.tick}: expected ${frame.stateHash}, got ${result.stateHash}`);
    }
    state = result.state;
  }
  return state;
}

export function recordReplay(initial: GameState, commandFrames: readonly (readonly InputCommand[])[]): ReplayFrame[] {
  let state = initial;
  const rng = new SeededRandom(initial.seed);
  return commandFrames.map((commands) => {
    const result = step(state, commands, { rng });
    const frame = { commands, stateHash: result.stateHash };
    state = result.state;
    return frame;
  });
}

export function verifyStateHash(state: GameState, expected: string): boolean {
  return hashGameState(state) === expected;
}
