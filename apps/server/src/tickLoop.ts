import { TICK_MS, type InputCommand, type RoomLifecycleEvent, type SimulationEvent } from "@mercicat/shared";
import { step } from "@mercicat/simulation";
import { serializeCanonicalSnapshot } from "./snapshot.js";
import type { Room } from "./roomManager.js";

export interface TickLoopOptions { maxCatchUp?: number; now?: () => number; onSnapshot?: (room: Room, snapshot: ReturnType<typeof serializeCanonicalSnapshot>) => void; onRoomEvent?: (room: Room, event: RoomLifecycleEvent) => void; onSimulationEvents?: (room: Room, events: readonly SimulationEvent[]) => void; }
export class FixedTickLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  readonly maxCatchUp: number;
  constructor(private readonly room: Room, private readonly options: TickLoopOptions = {}) { this.maxCatchUp = options.maxCatchUp ?? 5; }
  start(): void { if (this.timer) return; const now = this.options.now ?? (() => Date.now()); this.nextTime = now(); this.timer = setInterval(() => this.pump(now()), TICK_MS); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  pump(now = (this.options.now ?? (() => Date.now()))()): number {
    if (!this.nextTime) this.nextTime = now; let count = 0; while (now >= this.nextTime && count < this.maxCatchUp) { this.tick(); this.nextTime += TICK_MS; count++; }
    if (count === this.maxCatchUp && now >= this.nextTime) this.nextTime = now + TICK_MS; return count;
  }
  tick(): void {
    for (const event of this.room.drainLifecycleEvents()) this.options.onRoomEvent?.(this.room, event);
    const commands: InputCommand[] = [...this.room.inputs.entries()].sort(([a], [b]) => a - b).flatMap(([id, buffer]) => buffer.drain(this.room.state.tick).map((c) => ({ ...c, playerId: id })));
    const result = step(this.room.state, commands, { rng: this.room.rng, allPlayersReady: this.room.allReady() }); this.room.state = result.state; this.room.enqueueSimulationEvents(result.events);
    this.options.onSnapshot?.(this.room, serializeCanonicalSnapshot(this.room.state, this.room.rng, true));
    const events = this.room.drainSimulationEvents(); if (events.length) this.options.onSimulationEvents?.(this.room, events);
  }
}
