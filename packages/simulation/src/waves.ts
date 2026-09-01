import type { GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { advanceWavePhase } from "./wavePhase.js";

/** The supported balance contract is waves 1-20 (and may be extended later). */
export const MAX_WAVES = 20;
export function enemiesRemaining(state: GameState): number {
  let count = 0;
  for (const e of Object.values(state.entities)) {
    if ((e as any).kind === "enemy" && (e as any).lifecycle === "active") count++;
  }
  return count;
}
export function isDefeated(state: GameState): boolean {
  for (const e of Object.values(state.entities)) {
    if ((e as any).kind === "player" && (e as any).health <= 0) return true;
  }
  return false;
}
/** Compatibility entry point; wave advancement is now timer-driven. */
export function advanceWave(state: GameState, _rng: SeededRandom, events: SimulationEvent[]): void {
  advanceWavePhase(state, false, events);
}
