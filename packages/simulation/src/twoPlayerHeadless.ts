import { createInitialState } from "./createInitialState";
import { step } from "./step";
import { hashGameState } from "./stateHash";
import { SeededRandom } from "@mercicat/shared";
import type { InputCommand } from "@mercicat/shared";
export function runTwoPlayerDeterminism(seed: number | string = 42, ticks = 120): string[] {
  const run = (): string[] => { let state = createInitialState(seed, [1, 2]); const rng = new SeededRandom(seed); const hashes: string[] = []; for (let i = 0; i < ticks; i++) { const commands: InputCommand[] = [{ type: "move", tick: state.tick, playerId: 1, direction: { x: i % 2 ? 1 : 0, y: 0 } }, { type: "move", tick: state.tick, playerId: 2, direction: { x: 0, y: i % 3 ? 1 : 0 } }]; const result = step(state, commands, { rng }); state = result.state; hashes.push(hashGameState(state)); } return hashes; };
  const first = run(); const second = run(); if (first.join(",") !== second.join(",")) throw new Error("Determinism failure"); return first;
}
