import type { GameState } from "./simulation/contracts.js";

function canonicalize(value: unknown): unknown {
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Non-finite number in state"); return Number(value.toFixed(6)); }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") return Object.keys(value as object).sort().reduce<Record<string, unknown>>((out, key) => { out[key] = canonicalize((value as Record<string, unknown>)[key]); return out; }, {});
  return value;
}
export function hashGameState(state: GameState): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of JSON.stringify(canonicalize(state))) { hash ^= BigInt(character.charCodeAt(0)); hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn; }
  return hash.toString(16).padStart(16, "0");
}