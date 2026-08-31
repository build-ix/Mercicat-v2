import type { GameState, SimulationEvent } from "@mercicat/shared";

/** Legacy entry point retained for callers; players now have one life. */
export function updatePlayerRespawns(state: GameState, _rng: unknown, events: SimulationEvent[]): void {
  if (state.phase !== "playing") return;
  if (Object.values(state.entities).some((entity) => entity.kind === "player" && entity.health <= 0)) {
    state.phase = "defeat";
    events.push({ type: "matchDefeated", tick: state.tick, wave: state.wave.currentWave });
  }
}
export const RESPAWN_DELAY_TICKS = 0;