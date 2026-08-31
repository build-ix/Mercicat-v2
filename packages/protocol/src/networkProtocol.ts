import { z } from "zod";
import type { GameState, InputCommand, NetworkSnapshot, PlayerId, Tick, RoomLifecycleEvent } from "@mercicat/shared";

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
  if (!result || !Number.isInteger(result.tick) || typeof result.stateHash !== "string" || typeof result.rngState !== "string" || !result.state) throw new Error("Invalid snapshot");
  return result;
}
export type { InputCommand };
