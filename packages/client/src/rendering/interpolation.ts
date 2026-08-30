import type { Vec2 } from "@mercicat/shared";
export const SNAP_DISTANCE = 32;
export function blendPosition(a: Vec2, b: Vec2, blend = 0.25): Vec2 { return { x: a.x + (b.x - a.x) * blend, y: a.y + (b.y - a.y) * blend }; }
export function interpolatePosition(a: Vec2, b: Vec2, alpha: number): Vec2 { const t = Math.max(0, Math.min(1, alpha)); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
export function extrapolatePosition(p: Vec2, v: Vec2, elapsedMs: number): Vec2 { const ms = Math.min(33, Math.max(0, elapsedMs)); return { x: p.x + v.x * ms / 1000, y: p.y + v.y * ms / 1000 }; }
export function shouldSnap(a: Vec2, b: Vec2): boolean { return Math.hypot(a.x - b.x, a.y - b.y) > SNAP_DISTANCE; }