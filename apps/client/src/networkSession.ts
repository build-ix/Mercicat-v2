import { io, type Socket } from "socket.io-client";
import type { GameState, InputCommand, NetworkSnapshot, PlayerId, SequencedInput } from "@mercicat/shared";
import { SeededRandom, TICK_MS } from "@mercicat/shared";
import { EVENTS, PROTOCOL_VERSION, deserializeSnapshot } from "@mercicat/protocol";
import { step, hashGameState } from "@mercicat/simulation";
import { InputHistory } from "./prediction";
import { replayInputs } from "./inputReplayer";
import { SnapshotBuffer, interpolateSnapshots } from "./snapshotBuffer";

export interface NetworkSessionOptions {
  url: string; roomId: string;
  onSnapshot?: (snapshot: NetworkSnapshot) => void;
  onStatus?: (status: NetworkSessionStatus) => void;
  onError?: (message: unknown) => void;
  /** Number of server ticks to render behind the newest snapshot. */
  interpolationDelayTicks?: number;
  /** Phase 2A: render authoritative state only. Phase 2B+: use prediction/interpolation. Default false. */
  useAuthoritativeOnly?: boolean;
}
export type NetworkSessionStatus = "disconnected" | "connecting" | "connected" | "joined";

export interface PredictionDivergence {
  readonly tick: number;
  readonly predictedHash: string;
  readonly authoritativeHash: string;
}

/** Client transport plus the presentation-only prediction/reconciliation layer. */
export class NetworkSession {
  socket: Socket | null = null;
  playerId: PlayerId | null = null;
  serverTick = 0;
  status: NetworkSessionStatus = "disconnected";
  private current: GameState | null = null;
  private authoritative: GameState | null = null;
  private render: GameState | null = null;
  private predictionRng: SeededRandom | null = null;
  private reconnectToken: string | null = null;
  private lastSnapshotTick = -1;
  private lastSnapshotReceivedAt = 0;
  private readonly interpolationDelayTicks: number;
  acknowledgedThrough = -1;
  predictionErrors = 0;
  lastPredictionError = 0;
  reconciliationCount = 0;
  maxPredictionErrorTicks = 0;
  readonly divergenceEvents: PredictionDivergence[] = [];
  private divergenceStartedAt: number | null = null;
  readonly history = new InputHistory();
  readonly snapshots = new SnapshotBuffer();
  private readonly useAuthoritativeOnly: boolean;

  constructor(private readonly options: NetworkSessionOptions) {
    this.interpolationDelayTicks = Math.max(0, options.interpolationDelayTicks ?? 2);
    this.useAuthoritativeOnly = options.useAuthoritativeOnly ?? false;
  }
  /** Backwards-compatible gameplay state: the locally predicted state. */
  get state(): GameState | null { return this.current; }
  get predictedState(): GameState | null { return this.current; }
  get authoritativeState(): GameState | null { return this.authoritative; }
  get renderState(): GameState | null { return this.render; }
  /** For Phase 2A (auth-only) rendering, use authoritativeState directly. For Phase 2B+, use render (prediction/interpolation). */
  getRenderableState(): GameState | null { return this.useAuthoritativeOnly ? this.authoritative : this.render; }
  get pendingInputs(): readonly SequencedInput[] { return this.history.unacknowledged(this.acknowledgedThrough); }

  private setStatus(status: NetworkSessionStatus): void { this.status = status; this.options.onStatus?.(status); }
  connect(): void {
    if (this.socket) return;
    this.setStatus("connecting");
    const socket = this.socket = io(this.options.url, { autoConnect: true, reconnection: true });
    socket.on("connect", () => this.setStatus("connected"));
    socket.on(EVENTS.hello, (hello: { protocol: number; serverTick: number }) => {
      if (hello.protocol !== PROTOCOL_VERSION) { this.options.onError?.("Protocol version mismatch"); socket.disconnect(); return; }
      this.serverTick = hello.serverTick;
      socket.emit(EVENTS.joinRoom, { roomId: this.options.roomId, ...(this.reconnectToken ? { reconnectToken: this.reconnectToken } : {}) });
    });
    socket.on(EVENTS.joinedRoom, (message: { playerId: PlayerId; reconnectToken: string }) => {
      this.playerId = message.playerId; this.reconnectToken = message.reconnectToken;
      this.setStatus("joined"); socket.emit(EVENTS.ready, { ready: true });
    });
    const accept = (value: unknown): void => {
      try {
        const snapshot = deserializeSnapshot(value);
        if (!this.snapshots.push(snapshot)) return;
        this.serverTick = Math.max(this.serverTick, snapshot.tick);
        if (snapshot.acknowledgedThrough !== undefined) {
          this.acknowledgedThrough = Math.max(this.acknowledgedThrough, snapshot.acknowledgedThrough);
          this.history.acknowledge(this.acknowledgedThrough);
        }
        this.reconcile(snapshot);
        this.lastSnapshotReceivedAt = Date.now();
        this.options.onSnapshot?.(snapshot);
      } catch (error) { this.options.onError?.(error); }
    };
    socket.on(EVENTS.initialState, accept); socket.on(EVENTS.snapshot, accept);
    socket.on(EVENTS.error, (error: unknown) => this.options.onError?.(error));
    socket.on("disconnect", () => { this.playerId = null; this.setStatus("disconnected"); });
  }

  private reconcile(snapshot: NetworkSnapshot): void {
    if (snapshot.tick < this.lastSnapshotTick) return;
    this.lastSnapshotTick = snapshot.tick;
    const before = this.current;
    const predictedHash = before && before.tick === snapshot.tick ? hashGameState(before) : null;
    const hashMismatch = predictedHash !== null && predictedHash !== snapshot.stateHash;
    if (hashMismatch) {
      this.divergenceStartedAt ??= snapshot.tick;
      this.divergenceEvents.push({ tick: snapshot.tick, predictedHash, authoritativeHash: snapshot.stateHash });
      if (this.divergenceEvents.length > 128) this.divergenceEvents.shift();
    }
    this.authoritative = structuredClone(snapshot.state);
    const pending = this.history.unacknowledged(this.acknowledgedThrough);
    const rebuilt = replayInputs(snapshot, pending).state;
    this.predictionRng = SeededRandom.deserialize(snapshot.rngState);
    this.current = rebuilt;
    this.render = structuredClone(rebuilt);
    const localId = this.playerId;
    const oldPlayer = before && localId !== null ? before.entities[before.players[localId]] : undefined;
    const newPlayer = localId !== null ? rebuilt.entities[rebuilt.players[localId]] : undefined;
    this.lastPredictionError = oldPlayer && newPlayer ? Math.hypot(oldPlayer.position.x - newPlayer.position.x, oldPlayer.position.y - newPlayer.position.y) : 0;
    const corrected = before !== null && (hashMismatch || this.lastPredictionError > 0.01 || before.tick !== rebuilt.tick);
    if (corrected) {
      this.predictionErrors++;
      this.reconciliationCount++;
      this.divergenceStartedAt ??= snapshot.tick;
    }
    if (this.divergenceStartedAt !== null) {
      this.maxPredictionErrorTicks = Math.max(this.maxPredictionErrorTicks, snapshot.tick - this.divergenceStartedAt);
      if (hashGameState(rebuilt) === snapshot.stateHash && pending.length === 0) this.divergenceStartedAt = null;
    }
  }

  send(command: Omit<InputCommand, "playerId" | "tick">, tick: number): void {
    if (!this.socket || this.playerId === null || this.status !== "joined") return;
    const full = { ...command, playerId: this.playerId, tick } as InputCommand;
    const record = this.history.record(tick, full);
    this.socket.emit(EVENTS.input, record);
  }

  /** Send one tick's commands and apply them together immediately, matching the server. */
  step(commands: readonly InputCommand[]): GameState | null {
    if (!this.current) return null;
    for (const command of commands) {
      const { playerId: _playerId, tick, ...input } = command;
      this.send(input, tick);
    }
    if (commands.length && this.predictionRng) {
      this.current = step(this.current, commands, { rng: this.predictionRng }).state;
      this.render = structuredClone(this.current);
    }
    return this.current;
  }

  /** Interpolated presentation state for remote entities; local player remains predicted. */
  getInterpolatedState(now = Date.now()): GameState | null {
    if (!this.current) return null;
    const latest = this.snapshots.latest();
    if (!latest) return this.current;
    const targetTick = latest.tick - this.interpolationDelayTicks + Math.max(0, now - this.lastSnapshotReceivedAt) / TICK_MS;
    const bracket = this.snapshots.bracket(targetTick);
    if (!bracket) return this.current;
    const [a, b] = bracket;
    const alpha = a.tick === b.tick ? 0 : (targetTick - a.tick) / (b.tick - a.tick);
    const remote = interpolateSnapshots(a, b, alpha).state;
    const result = structuredClone(this.current);
    for (const [id, entity] of Object.entries(remote.entities)) {
      if (this.playerId !== null && Number(id) === result.players[this.playerId]) continue;
      if (result.entities[Number(id)]) result.entities[Number(id)] = entity;
    }
    this.render = result;
    this.snapshots.discardBefore(Math.floor(targetTick));
    return result;
  }

  reset(): void {
    this.snapshots.lastAppliedTick = -1; this.current = null; this.authoritative = null; this.render = null;
    this.lastSnapshotTick = -1; this.acknowledgedThrough = -1; this.history.clear();
    this.predictionErrors = 0; this.reconciliationCount = 0; this.maxPredictionErrorTicks = 0;
    this.divergenceEvents.length = 0; this.divergenceStartedAt = null; this.lastPredictionError = 0;
  }
  disconnect(): void { this.socket?.disconnect(); this.socket = null; this.playerId = null; this.setStatus("disconnected"); }
}
