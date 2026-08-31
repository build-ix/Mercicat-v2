import { GameState, PlayerId } from "@mercicat/shared";

export function createInitialState(
  seed: number | string,
  playerIds: readonly PlayerId[]
): GameState {
  const state: GameState = {
    version: 1,
    tick: 0,
    seed,
    nextEntityId: 1,
    // Legacy local/headless callers begin immediately; network rooms may set
    // this to lobby and provide allPlayersReady to enter the state machine.
    phase: "playing",
    matchPhaseStartTick: 0,
    wavePhase: "spawning",
    entities: {},
    players: {},
    wave: {
      currentWave: 1,
      totalWaves: 5,
      spawnedForWave: 0,
      defeatedForWave: 0,
      waveComplete: false,
      matchComplete: false
    },
    score: 0
  };

  for (const playerId of [...playerIds].sort((a, b) => a - b)) {
    const id = state.nextEntityId++;

    state.entities[id] = {
      id,
      kind: "player",
      lifecycle: "active",
      playerId,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 12,
      health: 100,
      maxHealth: 100,
      spawnTick: 0,
      despawnTick: null,
      fireCooldownTicks: 0
    };

    state.players[playerId] = id;
  }

  return state;
}
