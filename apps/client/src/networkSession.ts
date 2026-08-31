import { io, type Socket } from "socket.io-client";
import type { GameState, InputCommand, NetworkSnapshot, PlayerId } from "@mercicat/shared";
import { EVENTS, PROTOCOL_VERSION, deserializeSnapshot } from "@mercicat/protocol";
import { InputHistory } from "./prediction";
import { SnapshotBuffer } from "./snapshotBuffer";

export interface NetworkSessionOptions { url: string; roomId: string; onSnapshot?: (snapshot: NetworkSnapshot) => void; onStatus?: (status: NetworkSessionStatus) => void; onError?: (message: unknown) => void; }
export type NetworkSessionStatus = "disconnected" | "connecting" | "connected" | "joined";
export class NetworkSession {
  socket: Socket | null = null; playerId: PlayerId | null = null; serverTick = 0; status: NetworkSessionStatus = "disconnected"; private current: GameState | null = null; private reconnectToken: string | null = null;
  readonly history = new InputHistory(); readonly snapshots = new SnapshotBuffer();
  constructor(private readonly options: NetworkSessionOptions) {}
  get state(): GameState | null { return this.current; }
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
        if (snapshot.acknowledgedThrough !== undefined) this.history.acknowledge(snapshot.acknowledgedThrough);
        this.current = structuredClone(snapshot.state);
        this.serverTick = snapshot.tick;
        this.options.onSnapshot?.(snapshot);
      } catch (error) { this.options.onError?.(error); }
    };
    socket.on(EVENTS.initialState, accept); socket.on(EVENTS.snapshot, accept);
    socket.on(EVENTS.error, (error: unknown) => this.options.onError?.(error));
    socket.on("disconnect", () => { this.playerId = null; this.setStatus("disconnected"); });
  }
  send(command: Omit<InputCommand, "playerId" | "tick">, tick: number): void {
    if (!this.socket || this.playerId === null || this.status !== "joined") return;
    const full = { ...command, playerId: this.playerId, tick } as InputCommand;
    const record = this.history.record(tick, full); this.socket.emit(EVENTS.input, record);
  }
  step(commands: readonly InputCommand[]): GameState | null {
    for (const command of commands) { const { playerId: _playerId, tick, ...input } = command; this.send(input, tick); }
    return this.current;
  }
  reset(): void { this.snapshots.lastAppliedTick = -1; this.current = null; this.history.acknowledge(Number.MAX_SAFE_INTEGER); }
  disconnect(): void { this.socket?.disconnect(); this.socket = null; this.playerId = null; this.setStatus("disconnected"); }
}
