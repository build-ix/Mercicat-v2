import type { GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { advanceWavePhase } from "./wavePhase.js";

export const MAX_WAVES = 5;
export function enemiesRemaining(state: GameState): number { return Object.values(state.entities).filter(e => e.kind === "enemy" && e.lifecycle === "active").length; }
export function isDefeated(state: GameState): boolean { return Object.values(state.entities).some(e => e.kind === "player" && e.health <= 0); }
/** Compatibility entry point; wave advancement is now timer-driven. */
export function advanceWave(state: GameState, _rng: SeededRandom, events: SimulationEvent[]): void {
  advanceWavePhase(state, false, events);
}
