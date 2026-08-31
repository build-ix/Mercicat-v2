import type { NetworkSnapshot, Tick } from "@mercicat/shared";
import { deserializeSnapshot } from "@mercicat/protocol";
export class SnapshotBuffer {
  private snapshots: NetworkSnapshot[] = [];
  lastAppliedTick = -1;
  constructor(private readonly maxSize = 60) {}
  push(snapshot: NetworkSnapshot): boolean { try { deserializeSnapshot(snapshot); } catch { return false; } if (snapshot.tick <= this.lastAppliedTick || this.snapshots.some((s) => s.tick === snapshot.tick)) return false; const latest = this.latest(); if (latest && snapshot.tick < latest.tick) return false; if (latest && snapshot.tick - latest.tick > 2) console.warn(`Snapshot gap: ${latest.tick} -> ${snapshot.tick}`); this.snapshots.push(snapshot); while (this.snapshots.length > this.maxSize) this.snapshots.shift(); return true; }
  applyLatest(): NetworkSnapshot | undefined { const latest = this.latest(); if (latest) this.lastAppliedTick = latest.tick; return latest; }
  bracket(tick: number): readonly [NetworkSnapshot, NetworkSnapshot] | null { let lo: NetworkSnapshot | undefined; let hi: NetworkSnapshot | undefined; for (const s of this.snapshots) { if (s.tick <= tick) lo = s; if (s.tick >= tick) { hi = s; break; } } return lo && hi ? [lo, hi] : null; }
  latest(): NetworkSnapshot | undefined { return this.snapshots[this.snapshots.length - 1]; }
  get size(): number { return this.snapshots.length; }
}
export function interpolateSnapshots(a: NetworkSnapshot, b: NetworkSnapshot, alpha: number): NetworkSnapshot {
  const t = Math.max(0, Math.min(1, alpha)); const state = structuredClone(a.state);
  for (const id of Object.keys(state.entities)) { const x = state.entities[Number(id)]; const y = b.state.entities[Number(id)]; if (x && y) x.position = { x: x.position.x + (y.position.x - x.position.x) * t, y: x.position.y + (y.position.y - x.position.y) * t }; }
  return { tick: a.tick, state, stateHash: a.stateHash, rngState: t < 0.5 ? a.rngState : b.rngState };
}
