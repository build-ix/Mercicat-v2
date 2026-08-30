import type { NetworkSnapshot, Tick } from "@mercicat/shared";
export class SnapshotBuffer {
  private snapshots: NetworkSnapshot[] = [];
  constructor(private readonly maxSize = 32) {}
  push(snapshot: NetworkSnapshot): boolean { if (this.snapshots.some((s) => s.tick === snapshot.tick) || (this.snapshots.length && snapshot.tick < this.snapshots[0].tick)) return false; this.snapshots.push(snapshot); this.snapshots.sort((a, b) => a.tick - b.tick); while (this.snapshots.length > this.maxSize) this.snapshots.shift(); return true; }
  bracket(tick: number): readonly [NetworkSnapshot, NetworkSnapshot] | null { let lo: NetworkSnapshot | undefined; let hi: NetworkSnapshot | undefined; for (const s of this.snapshots) { if (s.tick <= tick) lo = s; if (s.tick >= tick) { hi = s; break; } } return lo && hi ? [lo, hi] : null; }
  latest(): NetworkSnapshot | undefined { return this.snapshots[this.snapshots.length - 1]; }
  get size(): number { return this.snapshots.length; }
}
export function interpolateSnapshots(a: NetworkSnapshot, b: NetworkSnapshot, alpha: number): NetworkSnapshot {
  const t = Math.max(0, Math.min(1, alpha)); const state = structuredClone(a.state);
  for (const id of Object.keys(state.entities)) { const x = state.entities[Number(id)]; const y = b.state.entities[Number(id)]; if (x && y) x.position = { x: x.position.x + (y.position.x - x.position.x) * t, y: x.position.y + (y.position.y - x.position.y) * t }; }
  return { tick: a.tick, state, stateHash: a.stateHash };
}
