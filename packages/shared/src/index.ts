// Branded types for type safety and identity

export type EntityId = string & { readonly __brand: "EntityId" };
export type PlayerId = string & { readonly __brand: "PlayerId" };
export type MatchId = string & { readonly __brand: "MatchId" };

export function brandEntityId(id: string): EntityId {
  return id as EntityId;
}

export function brandPlayerId(id: string): PlayerId {
  return id as PlayerId;
}

export function brandMatchId(id: string): MatchId {
  return id as MatchId;
}

// Vector types — deterministic, no methods
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Mul(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Distance(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(b, a));
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

// Tick and time semantics
export const TICK_RATE = 30; // server ticks per second
export const TICK_DURATION = 1 / TICK_RATE; // seconds per tick

// Game constants
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1280;
export const PLAYER_SPEED = 300; // units per second
export const PLAYER_RADIUS = 30;
export const ENEMY_RADIUS = 25;

// Deterministic RNG seeded from server
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Simple LCG for determinism
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
    return Math.abs(this.seed) / 2147483648;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// Result type for error handling
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
