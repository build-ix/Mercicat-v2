import { GameState, SimulationEvent } from "@mercicat/shared";

/**
 * Advances the match state machine through phases: lobby → countdown → waveActive → waveIntermission → gameOver.
 * Called once per tick before gameplay updates.
 */
export function advanceMatchPhase(state: GameState, allPlayersReady: boolean): void {
  // Lobby: wait for all players to signal ready
  if (state.phase === "lobby" && allPlayersReady) {
    state.phase = "countdown";
    state.matchPhaseStartTick = state.tick;
    state.countdownTick = 30; // 1 second at 30 Hz
  }

  // Countdown: decrement timer, transition to waveActive when 0
  if (state.phase === "countdown" && state.countdownTick !== undefined) {
    state.countdownTick--;
    if (state.countdownTick === 0) {
      state.phase = "waveActive";
      state.wavePhase = "waveActive";
    }
  }

  // waveActive → waveIntermission: handled by updateWaveState() after enemies defeated
  // gameOver: terminal state ("victory" or "defeat") — no transitions out
}
