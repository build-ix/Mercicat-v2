import type { NetworkSnapshot } from "@mercicat/shared";

export interface ReconciliationDiagnostic {
  atMs: number;
  snapshotTick: number;
  positionError: number;
}
export interface NetworkDiagnosticsReport {
  snapshotsReceived: number;
  staleSnapshots: number;
  outOfOrderSnapshots: number;
  inputsSent: number;
  inputAcknowledgements: number;
  latestRttMs: number;
  averageRttMs: number;
  maxSnapshotAgeMs: number;
  maxQueueDepth: number;
  maxPositionDivergence: number;
  reconciliationErrors: number;
  events: readonly string[];
  corrections: readonly ReconciliationDiagnostic[];
}

/** Bounded, side-effect free metrics recorder suitable for post-match export. */
export class NetworkDiagnostics {
  private readonly rtts: number[] = [];
  private readonly events: string[] = [];
  private readonly corrections: ReconciliationDiagnostic[] = [];
  private lastTick = -1;
  private received = 0;
  private stale = 0;
  private outOfOrder = 0;
  private sent = 0;
  private acknowledged = 0;
  private latestRtt = 0;
  private maxAge = 0;
  private maxQueue = 0;
  private maxDivergence = 0;
  private errors = 0;
  constructor(private readonly maxRecords = 2048) {}

  inputSent(count = 1): void { this.sent += Math.max(0, count); }
  inputsAcknowledged(count = 1): void { this.acknowledged += Math.max(0, count); }
  snapshotReceived(snapshot: NetworkSnapshot, sentAtMs?: number, receivedAtMs = Date.now(), queueDepth = 0, nowMs = receivedAtMs): void {
    this.received += 1; this.maxQueue = Math.max(this.maxQueue, queueDepth);
    if (snapshot.tick < this.lastTick) { this.outOfOrder += 1; this.log(`out-of-order snapshot tick=${snapshot.tick}`); }
    if (snapshot.tick <= this.lastTick) { this.stale += 1; this.log(`stale snapshot tick=${snapshot.tick}`); }
    this.lastTick = Math.max(this.lastTick, snapshot.tick);
    const age = Math.max(0, nowMs - receivedAtMs); this.maxAge = Math.max(this.maxAge, age);
    if (sentAtMs !== undefined) { this.latestRtt = Math.max(0, receivedAtMs - sentAtMs); this.rtts.push(this.latestRtt); if (this.rtts.length > this.maxRecords) this.rtts.shift(); }
  }
  reconciliation(positionDivergence: number, tick: number, atMs = Date.now()): void {
    const magnitude = Math.max(0, positionDivergence); this.maxDivergence = Math.max(this.maxDivergence, magnitude);
    if (magnitude > 0) this.errors += 1;
    this.corrections.push({ atMs, snapshotTick: tick, positionError: magnitude });
    if (this.corrections.length > this.maxRecords) this.corrections.shift();
  }
  report(): NetworkDiagnosticsReport { return { snapshotsReceived: this.received, staleSnapshots: this.stale, outOfOrderSnapshots: this.outOfOrder, inputsSent: this.sent, inputAcknowledgements: this.acknowledged, latestRttMs: this.latestRtt, averageRttMs: this.rtts.length ? this.rtts.reduce((a, b) => a + b, 0) / this.rtts.length : 0, maxSnapshotAgeMs: this.maxAge, maxQueueDepth: this.maxQueue, maxPositionDivergence: this.maxDivergence, reconciliationErrors: this.errors, events: [...this.events], corrections: [...this.corrections] }; }
  private log(message: string): void { this.events.push(message); if (this.events.length > this.maxRecords) this.events.shift(); }
}
