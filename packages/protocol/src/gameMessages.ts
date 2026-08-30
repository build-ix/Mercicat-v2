import { z } from "zod";
import type { GameState, NetworkSnapshot, PlayerId, Tick } from "@mercicat/shared";
export const PlayerInputSchema = z.object({ sequence: z.number().int().nonnegative().optional(), tick: z.number().int().nonnegative(), playerId: z.number().int().positive(), command: z.object({ type: z.enum(["move", "fire", "usePickup", "pause"]), tick: z.number().int().nonnegative(), playerId: z.number().int().positive(), direction: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(), pickupId: z.number().int().positive().optional() }) });
export type PlayerInput = z.infer<typeof PlayerInputSchema>;
export interface GameSnapshot extends NetworkSnapshot { acknowledgedThrough: number; }
export interface PlayerJoined { playerId: PlayerId; initialState: GameState; }
export interface PlayerLeft { playerId: PlayerId; }
export interface GameOver { victor: PlayerId | null; }
export function serializeGameSnapshot(snapshot: GameSnapshot): string { return JSON.stringify(snapshot); }
export function deserializeGameSnapshot(value: string): GameSnapshot { return GameSnapshotSchema.parse(JSON.parse(value)) as unknown as GameSnapshot; }
const GameSnapshotSchema = z.object({ tick: z.number().int().nonnegative(), state: z.object({}).passthrough(), rngState: z.string(), stateHash: z.string(), acknowledgedThrough: z.number().int() });
export function validatePlayerInput(value: unknown, roomPlayerId: PlayerId, serverTick: Tick): PlayerInput { const input = PlayerInputSchema.parse(value); if (input.playerId !== roomPlayerId || input.command.playerId !== roomPlayerId) throw new Error("PLAYER_MISMATCH"); if (input.tick > serverTick || input.command.tick > serverTick) throw new Error("FUTURE_TICK"); return input; }