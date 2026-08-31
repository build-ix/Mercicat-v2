import { z } from "zod";
import { hashGameState, type GameState, type InputCommand, type NetworkSnapshot, type PlayerId, type Tick, type RoomLifecycleEvent } from "@mercicat/shared";

export const WireInputSchema = z.object({
  sequence: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  command: z.object({
    type: z.enum(["move", "fire", "usePickup", "pause"]),
    tick: z.number().int().nonnegative(),
    playerId: z.number().int().nonnegative(),
    direction: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
    pickupId: z.number().int().positive().optional()
  })
});
export type WireInput = z.infer<typeof WireInputSchema>;

export interface HelloMessage { protocol: 2; serverTick: Tick; tickRate: number; }
export interface JoinRoomMessage { roomId: string; }
export interface JoinedRoomMessage { roomId: string; playerId: PlayerId; slot: number; }
export interface ReadyMessage { ready: boolean; }
export interface InitialStateMessage { tick: Tick; state: GameState; stateHash: string; rngState: string; checksum?: string; }
export interface RoomEventMessage { roomId: string; event: RoomLifecycleEvent; }
export type SnapshotMessage = NetworkSnapshot;

export const PROTOCOL_VERSION = 2 as const;
export const EVENTS = {
  hello: "hello", joinRoom: "joinRoom", joinedRoom: "joinedRoom", ready: "ready",
  initialState: "initialState", input: "input", snapshot: "snapshot", room: "room",
  error: "protocolError"
} as const;

export function validateWireInput(input: unknown): WireInput {
  return WireInputSchema.parse(input);
}
export function serializeSnapshot(state: GameState, stateHash: string, rngState: string, checksum?: string, acknowledgedThrough = -1): SnapshotMessage & { acknowledgedThrough: number } {
  return { tick: state.tick, state: structuredClone(state), stateHash, rngState, acknowledgedThrough, ...(checksum ? { checksum } : {}) };
}
export function deserializeSnapshot(value: unknown): SnapshotMessage {
  const result = value as SnapshotMessage;
  if (!result || !Number.isInteger(result.tick) || result.tick < 0 || typeof result.stateHash !== "string" || !/^[0-9a-f]{16}$/.test(result.stateHash) || typeof result.rngState !== "string" || !/^[0-9a-f]{8}$/.test(result.rngState) || !result.state || typeof result.state !== "object" || result.state.tick !== result.tick || !Number.isInteger(result.state.nextEntityId) || !result.state.entities || !result.state.players) throw new Error("Invalid snapshot");
  if (result.checksum !== undefined && !/^[0-9a-f]{8}$/.test(result.checksum)) throw new Error("Invalid snapshot checksum");
  if (result.stateHash !== hashGameState(result.state)) throw new Error("Snapshot state hash mismatch");
  return result;
}
export type { InputCommand };
