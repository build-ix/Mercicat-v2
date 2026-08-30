import type { InputCommand, PlayerId, SequencedInput, Tick } from "@mercicat/shared";
import { WireInputSchema } from "@mercicat/protocol";

export interface InputBufferOptions { maxSize?: number; maxFutureTicks?: number; }
export class PlayerInputBuffer {
  private readonly pending = new Map<number, SequencedInput>();
  private readonly consumed = new Set<number>();
  private readonly oneShots = new Set<string>();
  private lastSequence = -1;
  private readonly maxSize: number;
  private readonly maxFutureTicks: number;
  constructor(private readonly playerId: PlayerId, options: InputBufferOptions = {}) {
    this.maxSize = options.maxSize ?? 256; this.maxFutureTicks = options.maxFutureTicks ?? 12;
  }
  enqueue(value: unknown, serverTick: Tick): boolean {
    const parsed = WireInputSchema.safeParse(value); if (!parsed.success) return false;
    const input = parsed.data;
    if (input.command.playerId !== this.playerId || input.tick !== input.command.tick || input.sequence <= this.lastSequence) return false;
    if (input.tick < serverTick - 2 || input.tick > serverTick + this.maxFutureTicks || this.pending.has(input.sequence)) return false;
    const oneShot = input.command.type !== "move" ? `${input.command.type}:${input.command.type === "usePickup" ? input.command.pickupId : input.tick}` : "";
    if (oneShot && this.oneShots.has(oneShot)) return false;
    if (this.pending.size >= this.maxSize) return false;
    this.pending.set(input.sequence, Object.freeze({ sequence: input.sequence, tick: input.tick, command: input.command as InputCommand }));
    this.lastSequence = input.sequence; if (oneShot) this.oneShots.add(oneShot); return true;
  }
  drain(tick: Tick): readonly InputCommand[] {
    const values = [...this.pending.values()].filter((v) => v.tick === tick).sort((a, b) => a.sequence - b.sequence);
    for (const value of values) { this.pending.delete(value.sequence); this.consumed.add(value.sequence); }
    return values.map((v) => v.command);
  }
  acknowledge(sequence: number): void { for (const key of this.pending.keys()) if (key <= sequence) this.pending.delete(key); }
  get size(): number { return this.pending.size; }
  get lastAcceptedSequence(): number { return this.lastSequence; }
}
