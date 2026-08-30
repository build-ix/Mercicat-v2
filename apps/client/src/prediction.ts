import type { GameState, InputCommand, SequencedInput, Tick } from "@mercicat/shared";
import { step } from "@mercicat/simulation";

export class InputHistory {
  private readonly records: SequencedInput[] = [];
  private nextSequence = 0;
  constructor(private readonly maxSize = 256) {}
  record(tick: Tick, command: InputCommand): SequencedInput { const value = Object.freeze({ sequence: this.nextSequence++, tick, command: structuredClone(command) }); this.records.push(value); while (this.records.length > this.maxSize) this.records.shift(); return value; }
  unacknowledged(afterSequence: number): readonly SequencedInput[] { return this.records.filter((r) => r.sequence > afterSequence); }
  acknowledge(sequence: number): void { while (this.records.length && this.records[0].sequence <= sequence) this.records.shift(); }
  get size(): number { return this.records.length; }
}
export class LocalPrediction {
  state: GameState;
  lastServerTick = -1;
  predictionErrors = 0;
  constructor(initial: GameState) { this.state = structuredClone(initial); }
  tick(inputs: readonly InputCommand[], rng: import("@mercicat/shared").SeededRandom): GameState { this.state = step(this.state, inputs, { rng }).state; return this.state; }
  reconcile(baseline: GameState, unacked: readonly SequencedInput[], rng: import("@mercicat/shared").SeededRandom, threshold = 2): number {
    const old = this.state; this.state = structuredClone(baseline); for (const input of unacked) this.state = step(this.state, [input.command], { rng }).state;
    const a = old.entities[old.players[Object.keys(old.players)[0] as unknown as number]]; const b = this.state.entities[this.state.players[Object.keys(this.state.players)[0] as unknown as number]];
    const error = a && b ? Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) : 0; if (error > threshold) this.predictionErrors++; this.lastServerTick = baseline.tick; return error;
  }
}
