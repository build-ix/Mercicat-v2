import { SeededRandom } from "@mercicat/shared";
export interface NetworkSimulationOptions { latencyTicks?: number; loss?: number; reorder?: boolean; seed?: number; }
export class NetworkSimulation {
  private queue: Array<{ deliver: number; value: unknown }> = [];
  private readonly latency: number; private readonly loss: number; private readonly reorder: boolean; private readonly rng: SeededRandom;
  constructor(options: NetworkSimulationOptions = {}) { this.latency = options.latencyTicks ?? 0; this.loss = options.loss ?? 0; this.reorder = options.reorder ?? false; this.rng = new SeededRandom(options.seed ?? 1); }
  send(tick: number, value: unknown): void { if (this.rng.nextFloat() < this.loss) return; this.queue.push({ deliver: tick + this.latency, value }); if (this.reorder && this.queue.length > 1 && this.rng.nextFloat() < 0.5) { const i = this.queue.length - 1; const j = i - 1; [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; } }
  receive(tick: number): unknown[] { const ready = this.queue.filter((v) => v.deliver <= tick); this.queue = this.queue.filter((v) => v.deliver > tick); return ready.map((v) => v.value); }
  reconnect(): void { this.queue = []; }
  get queueDepth(): number { return this.queue.length; }
}
