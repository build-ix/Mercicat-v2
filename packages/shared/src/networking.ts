import type { GameState, InputCommand, PlayerId, Tick } from "./simulation/contracts.js";

export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_PLAYERS = 4;

export interface SequencedInput {
  readonly sequence: number;
  readonly tick: Tick;
  readonly command: InputCommand;
}

export interface PlayerSlot {
  readonly playerId: PlayerId;
  readonly entityId: number;
  connected: boolean;
  ready: boolean;
  socketId: string | null;
  readonly reconnectToken: string;
}

export type RoomLifecycleEvent =
  | { type: "joined" | "reconnected"; tick: Tick; playerId: PlayerId }
  | { type: "left" | "disconnected"; tick: Tick; playerId: PlayerId };

export interface NetworkSnapshot {
  readonly tick: Tick;
  readonly state: GameState;
  readonly stateHash: string;
  /** Canonical eight-digit hexadecimal state of the server simulation RNG. */
  /** Canonical eight-digit hexadecimal state of the server simulation RNG. */
  readonly rngState: string;
  readonly checksum?: string;
  /** Highest client input sequence accepted by the server for this player. */
  readonly acknowledgedThrough?: number;
}

export interface Diagnostics {
  tickDurationMs: number;
  rttMs: number;
  queueDepth: number;
  predictionError: number;
}

export interface SimulationAdapter {
  readonly tickRate: number;
  step(state: GameState, inputs: readonly InputCommand[]): { state: GameState; stateHash: string };
  hash(state: GameState): string;
}
