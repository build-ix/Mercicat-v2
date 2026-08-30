import type { NetworkSnapshot } from "./networking.js";
import type { GameState } from "./simulation/contracts.js";
import { SeededRandom } from "./random/SeededRandom.js";

export function serializeRngState(rng: SeededRandom): string { return rng.serialize(); }
export function deserializeRngState(value: string): SeededRandom { return SeededRandom.deserialize(value); }
export function snapshotWithRng(state: GameState, stateHash: string, rng: SeededRandom): NetworkSnapshot {
  return { tick: state.tick, state: structuredClone(state), stateHash, rngState: serializeRngState(rng) };
}
