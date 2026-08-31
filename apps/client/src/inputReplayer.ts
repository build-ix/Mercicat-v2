import type { GameState, InputCommand, NetworkSnapshot, SequencedInput } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { step } from "@mercicat/simulation";

export interface ReplayResult {
  readonly state: GameState;
  readonly replayedTicks: number;
  readonly replayedInputs: number;
}

/**
 * Rebuild a predicted state from an authoritative snapshot and the inputs that
 * have not been acknowledged by the server. Inputs are grouped by simulation
 * tick because the server applies all commands for a tick in one step.
 * Neither the snapshot state nor the supplied inputs are mutated.
 */
export function replayInputs(
  snapshot: Pick<NetworkSnapshot, "state" | "rngState" | "tick">,
  inputs: readonly SequencedInput[],
): ReplayResult {
  const rng = SeededRandom.deserialize(snapshot.rngState);
  const byTick = new Map<number, InputCommand[]>();
  for (const input of [...inputs].sort((a, b) => a.sequence - b.sequence)) {
    const commands = byTick.get(input.tick) ?? [];
    commands.push(structuredClone(input.command));
    byTick.set(input.tick, commands);
  }

  let state = structuredClone(snapshot.state) as GameState;
  const lastInputTick = byTick.size ? Math.max(...byTick.keys()) : snapshot.tick - 1;
  let replayedTicks = 0;
  while (state.tick <= lastInputTick) {
    const commands = byTick.get(state.tick) ?? [];
    state = step(state, commands, { rng }).state;
    replayedTicks += 1;
  }
  return { state, replayedTicks, replayedInputs: inputs.length };
}

export default replayInputs;
