import type { GameState, NetworkSnapshot, SeededRandom } from "@mercicat/shared";

import { hashGameState } from "@mercicat/simulation";

function canonical(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value as object).sort().reduce<Record<string, unknown>>((o, k) => { o[k] = canonical((value as Record<string, unknown>)[k]); return o; }, {});
  }
  return value;
}
export function snapshotChecksum(snapshot: Omit<NetworkSnapshot, "checksum">): string {
  const text = JSON.stringify(canonical(snapshot)); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}
export function serializeCanonicalSnapshot(state: GameState, rng: SeededRandom, dev = false): NetworkSnapshot {
  const snapshot: Omit<NetworkSnapshot, "checksum"> = { tick: state.tick, state: structuredClone(state), stateHash: hashGameState(state), rngState: rng.serialize() };
  return dev ? { ...snapshot, checksum: snapshotChecksum(snapshot) } : snapshot;
}
export function verifySnapshot(snapshot: NetworkSnapshot): boolean {
  return snapshot.stateHash === hashGameState(snapshot.state) && (!snapshot.checksum || snapshot.checksum === snapshotChecksum(snapshot));
}
