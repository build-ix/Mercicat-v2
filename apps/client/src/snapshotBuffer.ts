import type { NetworkSnapshot, Tick } from "@mercicat/shared";
import { deserializeSnapshot } from "@mercicat/protocol";
export class SnapshotBuffer {
  private snapshots: NetworkSnapshot[] = [];
  lastAppliedTick = -1;
  constructor(private readonly maxSize = 60) {}
  /** Insert in tick order. Late packets are useful for interpolation, so they are
   * accepted unless they have already been consumed or are duplicates. */
  push(snapshot: NetworkSnapshot): boolean {
    try { deserializeSnapshot(snapshot); } catch { return false; }
    if (snapshot.tick <= this.lastAppliedTick || this.snapshots.some((s) => s.tick === snapshot.tick)) return false;
    const index = this.snapshots.findIndex((s) => s.tick > snapshot.tick);
    if (index < 0) this.snapshots.push(snapshot); else this.snapshots.splice(index, 0, snapshot);
    while (this.snapshots.length > this.maxSize) this.snapshots.shift();
    return true;
  }
  applyLatest(): NetworkSnapshot | undefined { const latest = this.latest(); if (latest) this.lastAppliedTick = latest.tick; return latest; }
  bracket(tick: number): readonly [NetworkSnapshot, NetworkSnapshot] | null {
    let lo: NetworkSnapshot | undefined; let hi: NetworkSnapshot | undefined;
    for (const s of this.snapshots) { if (s.tick <= tick) lo = s; if (s.tick >= tick) { hi = s; break; } }
    return lo && hi ? [lo, hi] : null;
  }
  /** Drop snapshots older than the lower interpolation bound, retaining one
   * endpoint so a frame can still be rendered when packets pause. */
  discardBefore(tick: number): void { while (this.snapshots.length > 2 && this.snapshots[1].tick <= tick) this.snapshots.shift(); }
  latest(): NetworkSnapshot | undefined { return this.snapshots[this.snapshots.length - 1]; }
  get size(): number { return this.snapshots.length; }
  get ticks(): readonly number[] { return this.snapshots.map((snapshot) => snapshot.tick); }
}
export function interpolateSnapshots(a: NetworkSnapshot, b: NetworkSnapshot, alpha: number): NetworkSnapshot {
  const t = Math.max(0, Math.min(1, alpha)); const state = structuredClone(a.state);
  for (const id of Object.keys(state.entities)) {
    const x = state.entities[Number(id)]; const y = b.state.entities[Number(id)];
    if (!x || !y) continue;
    x.position = { x: x.position.x + (y.position.x - x.position.x) * t, y: x.position.y + (y.position.y - x.position.y) * t };
    // Rotation is derived from velocity by the renderer; blend velocity too so
    // remote turns do not snap at snapshot boundaries.
    x.velocity = { x: x.velocity.x + (y.velocity.x - x.velocity.x) * t, y: x.velocity.y + (y.velocity.y - x.velocity.y) * t };
  }
  return { tick: a.tick, state, stateHash: a.stateHash, rngState: t < 0.5 ? a.rngState : b.rngState };
}
