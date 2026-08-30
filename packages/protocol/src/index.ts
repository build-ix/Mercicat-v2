import { z } from "zod";

export const InputCommandSchema = z.object({
  playerId: z.string(),
  direction: z.object({ x: z.number(), y: z.number() }),
  action: z.enum(["move", "attack", "ability"]).optional(),
});

export type InputCommand = z.infer<typeof InputCommandSchema>;

export const SnapshotSchema = z.object({
  tick: z.number(),
  players: z.array(
    z.object({
      id: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      character: z.string(),
      health: z.number(),
    })
  ),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
