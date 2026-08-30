import type { SeededRandom, GameState, InputCommand, TICK_RATE } from "@mercicat/shared";
import { step } from "@mercicat/simulation";
import { serializeCanonicalSnapshot } from "./snapshot";
import type { Room } from "./roomManager";

export interface TickLoopOptions { maxCatchUp?: number; now?: () => number; onSnapshot?: (room: Room, snapshot: ReturnType<typeof serializeCanonicalSnapshot>) => void; }
export class FixedTickLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  readonly maxCatchUp: number;
  constructor(private readonly room: Room, private readonly options: TickLoopOptions = {}) { this.maxCatchUp = options.maxCatchUp ?? 5; }
  start(): void { if (this.timer) return; const now = this.options.now ?? (() => Date.now()); this.nextTime = now(); this.timer = setInterval(() => this.pump(now()), 1000 / 30); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  pump(now = (this.options.now ?? (() => Date.now()))()): number {
    if (!this.nextTime) this.nextTime = now; let count = 0; while (now >= this.nextTime && count < this.maxCatchUp) { this.tick(); this.nextTime += 1000 / 30; count++; }
    if (count === this.maxCatchUp && now >= this.nextTime) this.nextTime = now + 1000 / 30; return count;
  }
  tick(): void {
    const commands: InputCommand[] = [...this.room.inputs.entries()].sort(([a], [b]) => a - b).flatMap(([id, buffer]) => buffer.drain(this.room.state.tick).map((c) => ({ ...c, playerId: id })));
    const result = step(this.room.state, commands, { rng: this.room.rng }); this.room.state = result.state;
    this.options.onSnapshot?.(this.room, serializeCanonicalSnapshot(this.room.state, true));
  }
}
