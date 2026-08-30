import type { GameState, SimulationEvent } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { spawnEnemies } from "./enemies";

export const MAX_WAVES = 5;
export function enemiesRemaining(state: GameState): number { return Object.values(state.entities).filter(e => e.kind === "enemy" && e.lifecycle === "active").length; }
export function isDefeated(state: GameState): boolean { return Object.values(state.entities).some(e => e.kind === "player" && e.health <= 0); }
export function advanceWave(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  if (isDefeated(state)) { state.phase = "defeat"; events.push({ type: "matchDefeated", tick: state.tick, wave: state.wave.currentWave }); return; }
  if (state.wave.spawnedForWave === 0 || !state.wave.waveComplete || enemiesRemaining(state) !== 0) return;
  events.push({ type: "waveCompleted", tick: state.tick, wave: state.wave.currentWave });
  if (state.wave.currentWave >= Math.min(MAX_WAVES, state.wave.totalWaves)) { state.wave.matchComplete = true; state.phase = "victory"; events.push({ type: "matchCompleted", tick: state.tick, wave: state.wave.currentWave }); return; }
  state.wave.currentWave += 1; state.wave.spawnedForWave = 0; state.wave.defeatedForWave = 0; state.wave.waveComplete = false;
  spawnEnemies(state, rng, state.wave.currentWave, events);
  events.push({ type: "waveStarted", tick: state.tick, wave: state.wave.currentWave });
}
