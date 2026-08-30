import type { GameState, NetworkSnapshot, SequencedInput, InputCommand, PlayerId } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { step } from "@mercicat/simulation";

export interface ReconciliationOptions {
  playerId?: PlayerId;
  /** Errors at or below this distance are rendered smoothly. */
  positionSmoothThreshold?: number;
  /** Errors above this distance snap the rendered position. */
  positionSnapThreshold?: number;
  maxHistory?: number;
  /** Supply a deterministic RNG whose state is appropriate for the baseline. */
  rng?: SeededRandom;
}

export interface ReconciliationResult {
  state: GameState;
  renderState: GameState;
  positionError: number;
  acknowledgedThrough: number;
  replayed: number;
  snapped: boolean;
}

/**
 * Server reconciliation is deliberately simulation-state based: a snapshot is
 * always the new baseline, never a delta. The render state may ease a small
 * positional correction, but gameplay fields are copied from the baseline.
 */
export class ClientReconciler {
  state: GameState;
  renderState: GameState;
  private readonly pending: SequencedInput[] = [];
  private readonly smoothThreshold: number;
  private readonly snapThreshold: number;
  private readonly playerId?: PlayerId;
  private readonly maxHistory: number;
  private rng: SeededRandom;
  lastServerTick = -1;
  lastSnapshotTick = -1;
  corrections = 0;
  snaps = 0;

  constructor(initial: GameState, options: ReconciliationOptions = {}) {
    this.state = structuredClone(initial);
    this.renderState = structuredClone(initial);
    this.smoothThreshold = options.positionSmoothThreshold ?? 2;
    this.snapThreshold = options.positionSnapThreshold ?? 32;
    this.playerId = options.playerId;
    this.maxHistory = options.maxHistory ?? 256;
    this.rng = options.rng ?? new SeededRandom(initial.seed);
  }

  recordInput(input: SequencedInput | InputCommand): SequencedInput {
    const record: SequencedInput = "sequence" in input
      ? Object.freeze({ sequence: input.sequence, tick: input.tick, command: structuredClone(input.command) })
      : Object.freeze({ sequence: this.pending.length ? this.pending[this.pending.length - 1].sequence + 1 : 0, tick: input.tick, command: structuredClone(input) });
    if (!this.pending.some((value) => value.sequence === record.sequence)) this.pending.push(record);
    while (this.pending.length > this.maxHistory) this.pending.shift();
    return record;
  }

  reconcile(snapshot: NetworkSnapshot, acknowledgedSequence = Number.POSITIVE_INFINITY): ReconciliationResult {
    if (snapshot.tick < this.lastSnapshotTick) return { state: this.state, renderState: this.renderState, positionError: 0, acknowledgedThrough: -1, replayed: 0, snapped: false };
    this.lastSnapshotTick = snapshot.tick;
    const before = this.state;
    const beforePlayer = this.localPlayer(before);
    const oldPending = this.pending.filter((input) => input.sequence > acknowledgedSequence);
    this.pending.splice(0, this.pending.length, ...oldPending);

    // Replace the authoritative baseline before replaying anything.
    let rebuilt = structuredClone(snapshot.state);
    // The RNG must be rewound to the exact point represented by the snapshot;
    // otherwise a replay that consumes randomness diverges permanently.
    if (snapshot.rngState) this.rng = SeededRandom.deserialize(snapshot.rngState);
    for (const input of oldPending) rebuilt = step(rebuilt, [input.command], { rng: this.rng }).state;
    this.state = rebuilt;
    this.lastServerTick = snapshot.tick;

    const afterPlayer = this.localPlayer(rebuilt);
    const error = beforePlayer && afterPlayer ? Math.hypot(beforePlayer.position.x - afterPlayer.position.x, beforePlayer.position.y - afterPlayer.position.y) : 0;
    const snapped = error > this.snapThreshold;
    if (error > this.smoothThreshold) this.corrections += 1;
    if (snapped) this.snaps += 1;

    // Only position is presentation-smoothed. Health/lifecycle/wave/score and
    // inventory-like state are never blended and therefore cannot drift.
    this.renderState = structuredClone(rebuilt);
    const renderPlayer = this.localPlayer(this.renderState);
    if (!snapped && renderPlayer && afterPlayer && error > 0) {
      const blend = 0.25;
      renderPlayer.position = {
        x: beforePlayer!.position.x + (afterPlayer.position.x - beforePlayer!.position.x) * blend,
        y: beforePlayer!.position.y + (afterPlayer.position.y - beforePlayer!.position.y) * blend
      };
    }
    return { state: this.state, renderState: this.renderState, positionError: error, acknowledgedThrough: acknowledgedSequence, replayed: oldPending.length, snapped };
  }

  predict(command: InputCommand): GameState {
    this.recordInput(command);
    this.state = step(this.state, [command], { rng: this.rng }).state;
    this.renderState = structuredClone(this.state);
    return this.state;
  }

  get pendingCount(): number { return this.pending.length; }
  get pendingInputs(): readonly SequencedInput[] { return this.pending; }

  private localPlayer(state: GameState) {
    const id = this.playerId ?? Number(Object.keys(state.players)[0]);
    return state.entities[state.players[id]] as (GameState["entities"][number] & { position: { x: number; y: number } }) | undefined;
  }
}

export { ClientReconciler as Reconciliation };
