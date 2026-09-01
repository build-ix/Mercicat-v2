import { GameState, PlayerId } from "@mercicat/shared";
import { DEFAULT_MAP_NODES } from "@mercicat/content";
import { waveDurationTicks } from "./wavePhase.js";

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
    waveTimerTicks: 0,
    waveDurationTicks: waveDurationTicks(1),
    wavePhase: "waveActive",
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
    waveRewards: {},
    score: 0,
    difficulty: 2,
    spawnDirector: {
      threatBudget: 0,
      threatSpent: 0,
      spawnCursor: 0,
      nextSpawnTick: 0,
      activeComposition: {},
      elapsedTicks: 0
    },
    shop: {
      currentNodeId: null,
      telegraphStartTick: null,
      accessible: false,
      used: false
    },
    mapNodes: Object.fromEntries(Object.entries(DEFAULT_MAP_NODES).map(([id, node]) => [id, {
      id: node.id, kind: node.kind, x: node.x, y: node.y, navigationDistance: node.distanceTo
    }]))
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
