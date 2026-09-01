import type { GameState, SimulationEvent } from "@mercicat/shared";
import { markDespawned } from "./systems/entitySystem.js";

export const TICKS_PER_SECOND = 30;
export const WAVE_WARNING_TICKS = 10 * TICKS_PER_SECOND;

/** The authoritative duration for a wave (20 seconds plus five per wave). */
export function waveDurationTicks(waveNumber: number): number {
  return Math.min(600 + (Math.max(1, waveNumber) - 1) * 150, 1800);
}

function emit(events: SimulationEvent[], type: "waveWarning" | "waveEnding" | "waveEnded" | "intermissionStarted", state: GameState): void {
  events.push({ type, tick: state.tick, wave: state.wave.currentWave });
}

/**
 * Advances the survival-wave state machine. This runs before spawning and is
 * deliberately independent of enemy count: killing every enemy never advances
 * a wave early.
 */
export function advanceWavePhase(state: GameState, allPlayersReady: boolean, events: SimulationEvent[]): void {
  if (state.wavePhase === "waveActive") {
    // A lobby/countdown must not consume the survival clock.
    if (state.phase !== "playing" && state.phase !== "waveActive") return;
    state.waveTimerTicks += 1;
    if (state.waveTimerTicks === state.waveDurationTicks - WAVE_WARNING_TICKS) emit(events, "waveWarning", state);
    const players = Object.values(state.entities).filter((e) => e.kind === "player");
    if (players.length > 0 && players.every((e) => e.health <= 0 || e.lifecycle !== "active")) {
      state.wavePhase = "waveEnding";
      state.phase = "defeat";
      emit(events, "waveEnding", state);
      events.push({ type: "matchDefeated", tick: state.tick, wave: state.wave.currentWave });
      return;
    }
    if (state.waveTimerTicks >= state.waveDurationTicks) {
      state.wavePhase = "waveEnding";
      emit(events, "waveEnding", state);
    }
    return;
  }

  if (state.wavePhase === "waveEnding") {
    // Remove enemies in stable order. Their last combat/pickup frame has
    // already been processed by the previous step.
    for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
      if (entity.kind === "enemy" && entity.lifecycle === "active") markDespawned(state, entity.id, "removed", events);
    }
    state.wave.waveComplete = true;
    state.wave.defeatedForWave = state.wave.spawnedForWave - Object.values(state.entities).filter((e) => e.kind === "enemy").length;
    state.wave.defeatedForWave = Math.max(0, state.wave.defeatedForWave);
    const xp = state.wave.defeatedForWave * 10 + state.waveTimerTicks;
    const materials = state.wave.defeatedForWave + Math.floor(state.waveTimerTicks / 300);
    const loot = [`wave-${state.wave.currentWave}-survival`];
    for (const playerId of Object.keys(state.players).map(Number).sort((a, b) => a - b)) {
      state.waveRewards[playerId] = { xp, materials, loot: [...loot] };
    }
    emit(events, "waveEnded", state);
    events.push({ type: "waveCompleted", tick: state.tick, wave: state.wave.currentWave });
    if (state.wave.currentWave >= state.wave.totalWaves) {
      state.wave.matchComplete = true;
      state.phase = "victory";
    } else {
      state.wavePhase = "intermission";
      state.phase = "playing";
      state.countdownTick = undefined;
      emit(events, "intermissionStarted", state);
    }
    return;
  }

  if (state.wavePhase === "intermission" && allPlayersReady) {
    state.wavePhase = "nextWaveReady";
    state.countdownTick = 30;
  } else if (state.wavePhase === "nextWaveReady") {
    state.countdownTick = Math.max(0, (state.countdownTick ?? 1) - 1);
    if (state.countdownTick === 0) {
      state.wave.currentWave += 1;
      state.wave.spawnedForWave = 0;
      state.wave.defeatedForWave = 0;
      state.wave.waveComplete = false;
      state.waveTimerTicks = 0;
      state.waveDurationTicks = waveDurationTicks(state.wave.currentWave);
      state.spawnDirector.threatBudget = 0;
      state.spawnDirector.threatSpent = 0;
      state.spawnDirector.spawnCursor = 0;
      state.spawnDirector.nextSpawnTick = 0;
      state.spawnDirector.activeComposition = {};
      state.spawnDirector.elapsedTicks = 0;
      state.spawnDirector.compositionSelectionReason = "none";
      state.wavePhase = "waveActive";
      state.phase = "playing";
      events.push({ type: "waveStarted", tick: state.tick, wave: state.wave.currentWave });
    }
  }
}
