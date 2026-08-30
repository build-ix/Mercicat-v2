export interface RandomSource {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  getState(): number;
  setState(state: number): void;
}

function hashSeed(seed: number | string): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }

  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number | string) {
    const normalized = hashSeed(seed);
    this.state = normalized === 0 ? 0x6d2b79f5 : normalized;
  }

  nextUint32(): number {
    // Mulberry32 state transition.
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("nextInt bounds must be integers");
    }
    if (maxInclusive < minInclusive) {
      throw new Error("maxInclusive must be >= minInclusive");
    }

    const range = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * range);
  }

  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.nextFloat() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    return items[this.nextInt(0, items.length - 1)];
  }

  getState(): number {
    return this.state >>> 0;
  }

  serialize(): string { return (this.state >>> 0).toString(16).padStart(8, "0"); }

  setState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) throw new Error("Invalid RNG state");
    this.state = state >>> 0;
  }

  static deserialize(serialized: string): SeededRandom {
    if (!/^[0-9a-fA-F]{8}$/.test(serialized)) throw new Error("Invalid serialized RNG state");
    const rng = new SeededRandom(1); rng.setState(Number.parseInt(serialized, 16)); return rng;
  }
}
