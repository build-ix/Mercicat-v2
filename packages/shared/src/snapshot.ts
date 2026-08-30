import type { NetworkSnapshot } from "./networking";
import type { GameState } from "./simulation/contracts";
import { SeededRandom } from "./random/SeededRandom";

export function serializeRngState(rng: SeededRandom): string { return rng.serialize(); }
export function deserializeRngState(value: string): SeededRandom { return SeededRandom.deserialize(value); }
export function snapshotWithRng(state: GameState, stateHash: string, rng: SeededRandom): NetworkSnapshot {
  return { tick: state.tick, state: structuredClone(state), stateHash, rngState: serializeRngState(rng) };
}
