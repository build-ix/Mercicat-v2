import { createInitialState, step } from "@mercicat/simulation";
import { SeededRandom } from "@mercicat/shared";
import type { GameState, InputCommand } from "@mercicat/shared";

export interface Session {
  readonly state: GameState;
  step(commands: readonly InputCommand[]): GameState;
  reset(): void;
}

/** A session owns the authoritative view consumed by the renderer. */
export type SessionKind = "local" | "network";

export class LocalSession implements Session {
  private current: GameState;
  private rng: SeededRandom;
  constructor(private readonly seed: number | string, private readonly players: readonly number[]) {
    this.current = createInitialState(seed, players);
    this.rng = new SeededRandom(seed);
  }
  get state(): GameState { return this.current; }
  step(commands: readonly InputCommand[]): GameState {
    this.current = step(this.current, commands, { rng: this.rng }).state;
    return this.current;
  }
  reset(): void {
    this.current = createInitialState(this.seed, this.players);
    this.rng = new SeededRandom(this.seed);
  }
}
